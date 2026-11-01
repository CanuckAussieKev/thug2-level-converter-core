#!/usr/bin/env node
// NOT ORIGINAL - NeverScript's `ns` (the QB script compiler / decompiler the converters run): where it is, and getting it.
//
//   node lib/neverscript.ts fetch     download ns for this system (once; kept in the cache folder) and print its path
//   node lib/neverscript.ts where     print the ns the converters would use, or exit 1
//   (in a project that installed this package: npx thug2-neverscript fetch | where)
//
// The converters look for ns in this order (findNs): their --ns; the NEVERSCRIPT environment variable; the THUG2
// decompilation's own build (out\neverscript\ns.exe, tools\build_neverscript.ps1) when the project is in its checkout;
// a downloaded release (fetch) in the cache folder; `ns` on PATH. Nothing is ever downloaded without `fetch`.
//
// The release: github.com/CanuckAussieKev/NeverScript (violetvandal's THUG2 fork of byxor's NeverScript, with -lenient),
// its builds for Windows, Linux and macOS, each checked against the SHA-256 below. The cache folder:
// THUG2_CONVERTERS_CACHE, else %LOCALAPPDATA%\thug2-level-converters (Windows), ~/Library/Caches/thug2-level-converters
// (macOS), $XDG_CACHE_HOME or ~/.cache /thug2-level-converters (others).

import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { exitWith, isMain, print, runMain } from "./cli.ts";
import { DECOMP } from "./decomp.ts";

export const RELEASE = {
    repository: "CanuckAussieKev/NeverScript",
    tag: "thug2-v1",
    // `${process.platform}-${process.arch}` -> the release's file and its SHA-256
    files: {
        "win32-x64": ["ns-windows-amd64.exe", "3a81ce40e97b040ca5503d555bbcd945d21f4e513a0f0d7bc0d12408f42de8c3"],
        "win32-ia32": ["ns-windows-386.exe", "956d7ff3583f7599f51ba0e48e611659ea49432753339352ad86417d754d53ae"],
        // (Windows on Arm runs the x64 build)
        "win32-arm64": ["ns-windows-amd64.exe", "3a81ce40e97b040ca5503d555bbcd945d21f4e513a0f0d7bc0d12408f42de8c3"],
        "linux-x64": ["ns-linux-amd64", "4aa3d7cd12dacb47eea9148b67c55b0bdeceedee79251ff8240e3f6742668102"],
        "darwin-arm64": ["ns-darwin-arm64", "824bcf3d02443427dc04013c2e3bf676c6c4c7718ba9c48f287438f50c5767a8"],
        "darwin-x64": ["ns-darwin-amd64", "5ee26af31c695636ba0b0b61c0cd6e8d45b22a181b7e04a9c5300efbbf677a63"],
    } as Readonly<Record<string, readonly [string, string]>>,
} as const;

// The release's file for this system ([name, sha256]), or null when it has none (build ns from source).
export function releaseFile(
    platform: string = process.platform,
    arch: string = process.arch,
): readonly [string, string] | null {
    return RELEASE.files[`${platform}-${arch}`] ?? null;
}

// The folder downloads are kept in.
export function cacheFolder(env: NodeJS.ProcessEnv = process.env, platform: string = process.platform): string {
    if (env.THUG2_CONVERTERS_CACHE) return env.THUG2_CONVERTERS_CACHE;
    const home = os.homedir();
    if (platform === "win32")
        return path.join(env.LOCALAPPDATA ?? path.join(home, "AppData", "Local"), "thug2-level-converters");
    if (platform === "darwin") return path.join(home, "Library", "Caches", "thug2-level-converters");
    return path.join(env.XDG_CACHE_HOME || path.join(home, ".cache"), "thug2-level-converters");
}

// Where fetch puts this system's ns (null: the release has no build for it).
export function cachedNs(): string | null {
    const file = releaseFile();
    return file ? path.join(cacheFolder(), "neverscript", RELEASE.tag, file[0]) : null;
}

function isFile(file: string): boolean {
    try {
        return fs.statSync(file).isFile();
    } catch {
        return false;
    }
}

function onPath(env: NodeJS.ProcessEnv = process.env): string | null {
    const names = process.platform === "win32" ? ["ns.exe"] : ["ns"];
    for (const dir of (env.PATH ?? env.Path ?? "").split(path.delimiter)) {
        if (!dir) continue;
        for (const name of names) if (isFile(path.join(dir, name))) return path.join(dir, name);
    }
    return null;
}

// The ns to use (see the header for the order), or null when there is none.
export function findNs(given?: string | null, env: NodeJS.ProcessEnv = process.env): string | null {
    if (given) return isFile(given) ? given : null;
    if (env.NEVERSCRIPT) return isFile(env.NEVERSCRIPT) ? env.NEVERSCRIPT : null;
    // (the decomp's build is a Windows exe: tools\build_neverscript.ps1)
    const decompBuild =
        DECOMP && process.platform === "win32" ? path.join(DECOMP, "out", "neverscript", "ns.exe") : null;
    const candidates = [decompBuild, cachedNs()];
    for (const file of candidates) if (file && isFile(file)) return file;
    return onPath(env);
}

// What to do without one (the converters' and the content pipeline's message).
export function nsMissing(given?: string | null, env: NodeJS.ProcessEnv = process.env): string {
    if (given) return `${given} not found (--ns): NeverScript's ns, the QB script compiler`;
    if (env.NEVERSCRIPT) return `${env.NEVERSCRIPT} not found (NEVERSCRIPT): NeverScript's ns, the QB script compiler`;
    const lines = [
        "NeverScript's ns (the QB script compiler) not found. Get it with",
        "  npx thug2-neverscript fetch",
        `(downloads ns for this system from github.com/${RELEASE.repository}, release ${RELEASE.tag}), or pass --ns <ns>`,
        "or set NEVERSCRIPT=<ns>.",
    ];
    if (DECOMP) lines.push("In the THUG2 decompilation: tools\\build_neverscript.ps1 builds out\\neverscript\\ns.exe.");
    return lines.join("\n");
}

// The ns to use, or exit with nsMissing's message.
export function requireNs(given?: string | null): string {
    return findNs(given) ?? exitWith(nsMissing(given));
}

export const sha256 = (data: Uint8Array): string => createHash("sha256").update(data).digest("hex");

// Downloads this system's ns from the release into the cache folder (nothing when it is there already) and returns its
// path. Throws when the release has no build for this system, the download fails or its SHA-256 doesn't match.
export async function fetchNs(): Promise<string> {
    const file = releaseFile();
    const target = cachedNs();
    if (!file || !target) {
        throw new Error(
            `no ns build for ${process.platform}-${process.arch} in github.com/${RELEASE.repository} ${RELEASE.tag}: ` +
                "build it from source (Go: go build ./cmd/ns) and pass --ns or set NEVERSCRIPT",
        );
    }
    const [name, expected] = file;
    if (isFile(target) && sha256(fs.readFileSync(target)) === expected) return target;
    const url = `https://github.com/${RELEASE.repository}/releases/download/${RELEASE.tag}/${name}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${url}: ${response.status} ${response.statusText}`);
    const data = new Uint8Array(await response.arrayBuffer());
    const got = sha256(data);
    if (got !== expected) throw new Error(`${url}: SHA-256 ${got}, expected ${expected} - not saved`);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const part = `${target}.part`;
    fs.writeFileSync(part, data, { mode: 0o755 });
    fs.renameSync(part, target);
    return target;
}

const USAGE = "usage: neverscript.ts fetch | where";

async function main(argv: readonly string[]): Promise<number> {
    const [command, ...rest] = argv;
    if (command === "-h" || command === "--help") {
        print(USAGE);
        return 0;
    }
    if (rest.length || (command !== "fetch" && command !== "where"))
        exitWith(`${USAGE}\n(fetch: download ns; where: the ns in use)`);
    if (command === "where") {
        const found = findNs();
        if (!found) exitWith(nsMissing());
        print(found);
        return 0;
    }
    try {
        print(await fetchNs());
    } catch (e) {
        exitWith(e instanceof Error ? e.message : String(e));
    }
    return 0;
}

if (isMain(import.meta.url)) await runMain(() => main(process.argv.slice(2)));
