// NOT ORIGINAL - a repository's package.json checked against its files: what each converter repository's
// package.test.ts runs (and this one's), so that the dependency rules hold in every clone and in CI.
//
//   - "exports" names the public modules other repositories may import ("./<folder>/<module>.ts", each to its .ts for
//     TypeScript and its .js - made by prepare - for Node): each must be there, and not a test;
//   - "commands" names every command-line tool ("<folder>/<tool>.ts" - what thug2-content-pipeline's run.ts runs): a
//     module with a main block (isMain(import.meta.url)) is listed, and only those;
//   - every import of another thug2-* repository names a dependency of this one, pinned to a commit of it by https
//     (git+https://github.com/CanuckAussieKev/<name>.git#<commit>: no SSH key needed), and a module that repository
//     exports - no reaching into another repository's internals;
//   - importing any module runs no command (importOutput: every module imported in a child process prints nothing and
//     exits 0).

import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import { createRequire } from "node:module";
import * as path from "node:path";
import { pathToFileURL } from "node:url";

export interface PackageJson {
    name: string;
    version?: string;
    dependencies?: Record<string, string>;
    exports?: Record<string, unknown>;
    commands?: string[];
}

// One of this project's repositories: thug2-level-converter-core, thug2-<game>-level-converter,
// thug2-content-pipeline.
export const OUR_PACKAGE = /^thug2-(?:level-converter-core|[a-z0-9]+-level-converter|content-pipeline)$/;
export const PIN = /^git\+https:\/\/github\.com\/CanuckAussieKev\/(thug2-[a-z0-9-]+)\.git#([0-9a-f]{40})$/;

export const readPackage = (root: string): PackageJson =>
    JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf-8")) as PackageJson;

// The repository's TypeScript sources ("<folder>/<file>.ts", "/" separators), sorted; node_modules, out and dot
// folders left out.
export function sourceFiles(root: string): string[] {
    const out: string[] = [];
    const walk = (dir: string, rel: string): void => {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            if (e.name.startsWith(".") || e.name === "node_modules" || e.name === "out") continue;
            const r = rel ? `${rel}/${e.name}` : e.name;
            if (e.isDirectory()) walk(path.join(dir, e.name), r);
            else if (e.name.endsWith(".ts") && !e.name.endsWith(".d.ts")) out.push(r);
        }
    };
    walk(root, "");
    return out.sort();
}

export const isTest = (file: string): boolean => file.endsWith(".test.ts");

// The modules a package.json exports: "./level_port/qb.ts" -> "level_port/qb.ts".
export function exportedModules(pkg: PackageJson): Set<string> {
    return new Set(
        Object.keys(pkg.exports ?? {})
            .filter((k) => k.endsWith(".ts"))
            .map((k) => k.replace(/^\.\//, "")),
    );
}

// An export entry as written in package.json (the .ts for TypeScript, the .js npm built for Node).
export const exportEntry = (module: string): { types: string; default: string } => ({
    types: `./${module}`,
    default: `./${module.replace(/\.ts$/, ".js")}`,
});

const MAIN_BLOCK =
    /^if \((?:[^\n]*&& )?isMain\(import\.meta\.url\)\)|^if \(process\.argv\[1\] && path\.resolve\(process\.argv\[1\]\)/m;

// A module with a main block: a command-line tool.
export const hasMain = (source: string): boolean => MAIN_BLOCK.test(source);

export interface PackageImport {
    file: string; // the importing file
    spec: string; // "thug2-level-converter-core/level_port/qb.ts"
    pkg: string; // "thug2-level-converter-core"
    module: string; // "level_port/qb.ts"
}

const SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(\s*|^import\s+)["'](thug2-[a-z0-9-]+(?:\/[^"']*)?)["']/gm;

// Every import of one of this project's other repositories in the given sources.
export function packageImports(root: string, files: readonly string[] = sourceFiles(root)): PackageImport[] {
    const out: PackageImport[] = [];
    for (const file of files) {
        const source = fs.readFileSync(path.join(root, file), "utf-8");
        for (const m of source.matchAll(SPECIFIER)) {
            const spec = m[1]!;
            const slash = spec.indexOf("/");
            const pkg = slash < 0 ? spec : spec.slice(0, slash);
            if (!OUR_PACKAGE.test(pkg)) continue;
            out.push({ file, spec, pkg, module: slash < 0 ? "" : spec.slice(slash + 1) });
        }
    }
    return out;
}

// The installed package.json of a dependency, as resolved from `root` (null: not installed).
export function installedPackage(root: string, name: string): { dir: string; pkg: PackageJson } | null {
    try {
        const file = fs.realpathSync(createRequire(path.join(root, "package.json")).resolve(`${name}/package.json`));
        return { dir: path.dirname(file), pkg: JSON.parse(fs.readFileSync(file, "utf-8")) as PackageJson };
    } catch {
        return null;
    }
}

// What is wrong with the repository at `root` (empty: nothing).
export function packageProblems(root: string): string[] {
    const problems: string[] = [];
    const pkg = readPackage(root);
    const files = sourceFiles(root);
    const have = new Set(files);
    for (const m of exportedModules(pkg)) {
        if (!have.has(m)) problems.push(`exports ./${m}: no such module`);
        else if (isTest(m)) problems.push(`exports ./${m}: a test`);
        const entry = JSON.stringify(pkg.exports?.[`./${m}`]);
        if (entry !== JSON.stringify(exportEntry(m)))
            problems.push(`exports ./${m}: should be ${JSON.stringify(exportEntry(m))}`);
    }
    for (const key of Object.keys(pkg.exports ?? {}))
        if (!key.endsWith(".ts") && key !== "./package.json") problems.push(`exports ${key}: not a module`);
    const commands = new Set(pkg.commands ?? []);
    for (const c of commands) if (!have.has(c)) problems.push(`commands ${c}: no such module`);
    for (const f of files) {
        if (isTest(f)) continue;
        const main = hasMain(fs.readFileSync(path.join(root, f), "utf-8"));
        if (main && !commands.has(f)) problems.push(`${f}: a command-line tool missing from "commands"`);
        if (!main && commands.has(f)) problems.push(`commands ${f}: has no main block (isMain(import.meta.url))`);
    }
    const deps = pkg.dependencies ?? {};
    for (const [name, spec] of Object.entries(deps)) {
        if (!OUR_PACKAGE.test(name)) continue;
        const m = PIN.exec(spec);
        if (!m || m[1] !== name)
            problems.push(
                `dependency ${name}: "${spec}" is not git+https://github.com/CanuckAussieKev/${name}.git#<commit>`,
            );
    }
    const exportsOf = new Map<string, Set<string> | null>();
    for (const imp of packageImports(root, files)) {
        if (imp.pkg === pkg.name) {
            problems.push(`${imp.file}: imports its own repository by name (${imp.spec}): use a relative path`);
            continue;
        }
        if (!(imp.pkg in deps)) {
            problems.push(`${imp.file}: imports ${imp.spec} - ${imp.pkg} is not a dependency`);
            continue;
        }
        if (!exportsOf.has(imp.pkg)) {
            const installed = installedPackage(root, imp.pkg);
            exportsOf.set(imp.pkg, installed ? exportedModules(installed.pkg) : null);
        }
        const exported = exportsOf.get(imp.pkg);
        if (exported === null) problems.push(`${imp.file}: ${imp.pkg} is not installed (npm ci)`);
        else if (!exported?.has(imp.module))
            problems.push(`${imp.file}: imports ${imp.spec}, which ${imp.pkg} doesn't export`);
    }
    return problems;
}

// What importing every module of the repository (tests left out) prints, in a child process with no command line of
// its own: "" when no module runs a command when imported. `ext` ".js": the .js files npm built (an installed copy -
// Node strips no types under node_modules).
export function importOutput(root: string, ext: ".ts" | ".js" = ".ts"): string {
    const urls = sourceFiles(root)
        .filter((f) => !isTest(f))
        .map((f) => pathToFileURL(path.join(root, ext === ".js" ? f.replace(/\.ts$/, ".js") : f)).href);
    const code = `for (const u of ${JSON.stringify(urls)}) await import(u);`;
    const r = spawnSync(process.execPath, ["--input-type=module", "--no-warnings", "-e", code], {
        cwd: root,
        encoding: "utf-8",
        maxBuffer: 64 * 1024 * 1024,
    });
    const out = `${r.stdout ?? ""}${r.stderr ?? ""}`.trim();
    return r.status === 0 ? out : `exit ${r.status}${out ? `: ${out}` : ""}`;
}
