// NOT ORIGINAL - the compatibility profiles' mechanism: a profile is data that makes our generated files agree with
// another game's or mod's for online play, kept apart from the converters so every such choice is listed in one place
// (the profile's register) and can be dropped or replaced (e.g. by a run-time translation of the network messages)
// later. This repository knows no profile but "none" (no compatibility data at all): a profile is a package of its own
// that builds its Profile on this one with its data folder - THUGPRO's is thug2-thugpro-compat (its profile.ts:
// load("thugpro" | "none"), the register and its data), which the converters that use it depend on.
//
//   const profile = new Profile("thugpro", "<its data folder>");   // (what a profile package does)
//   profile.section("thaw_levels", "level_names")  ->  {Z_CH: "skatepark", ...}
//   none().section(...)                            ->  {}
// (Ported from compat.py, deleted with its last importer, thug2-thaw-level-converter/thaw_levels/thaw_levels.py.)

import * as fs from "node:fs";
import * as path from "node:path";

type JsonObject = Record<string, unknown>;

export class Profile {
    readonly name: string;
    readonly folder: string | null; // (null: no files - "none")
    private readonly files = new Map<string, JsonObject>();

    constructor(name: string, folder: string | null) {
        this.name = name;
        this.folder = folder;
    }

    // <folder>\<tool>.json as an object ({} for "none" or when the profile has no such file).
    file(tool: string): JsonObject {
        let data = this.files.get(tool);
        if (data === undefined) {
            data = {};
            const file = this.folder === null ? null : path.join(this.folder, `${tool}.json`);
            if (file !== null && fs.existsSync(file)) data = JSON.parse(fs.readFileSync(file, "utf-8")) as JsonObject;
            this.files.set(tool, data);
        }
        return data;
    }

    // One section of a tool's file without its "_..." notes ({} when absent).
    section(tool: string, key: string): JsonObject {
        const section = (this.file(tool)[key] ?? {}) as JsonObject;
        return Object.fromEntries(Object.entries(section).filter(([k]) => !k.startsWith("_")));
    }
}

// The profile without compatibility data (`--compat none`): every file {}.
export const none = (): Profile => new Profile("none", null);

// A section of a profile's file written as a list of entries ("differences"), each {id, op, target, why, ...}: op
// "add" (something the source game hasn't: a node, sector, collision object, script), "set" (fields of something that
// exists change, merged; set on something missing is an error the converter reports, never an add) or "remove"
// (something that exists left out or suppressed). Which sections are lists so is the profile's (thug2-thugpro-compat:
// thugpro_new and port_changes).
export type Op = "add" | "set" | "remove";
export const OPS: readonly Op[] = ["add", "set", "remove"];
export interface Entry {
    id: string;
    op: Op;
    target: Record<string, unknown>;
    why: string;
    required?: boolean; // (port_changes: a level needs it to load / install - kept with --no-port-changes)
    [key: string]: unknown;
}

// A section's entries ({entries: [...]}; none when absent), each checked for id, op, target and why. `where` names the
// section in the error.
export function entryList(data: unknown, where: string): Entry[] {
    const list = (data as { entries?: unknown } | undefined)?.entries ?? [];
    if (!Array.isArray(list)) throw new TypeError(`${where}: entries is not a list`);
    for (const e of list as Entry[]) {
        if (
            typeof e.id !== "string" ||
            !OPS.includes(e.op) ||
            typeof e.target !== "object" ||
            typeof e.why !== "string"
        )
            throw new TypeError(
                `${where}: ${JSON.stringify(e).slice(0, 80)}: needs id, op (add / set / remove), target, why`,
            );
    }
    return list as Entry[];
}

// A profile's file for a tool that rewrites it (a comparison's --extract-thugpro): in the profile package's own clone
// only - the copy npm installs in a project's node_modules is made again on the next install, so a change written
// there would be lost. Exits with a message saying so (use a clone of `repository`, `npm link`ed into the project: its
// README, "Changing it").
export function fileToWrite(file: string, repository: string): string {
    if (
        fs
            .realpathSync(path.dirname(file))
            .split(path.sep)
            .some((p) => p.toLowerCase() === "node_modules")
    ) {
        process.stderr.write(
            `error: ${file} is in an installed copy of ${repository} (node_modules): the register is changed in a ` +
                'clone of that repository - link it into this project (its README, "Changing it") and run again\n',
        );
        process.exit(1);
    }
    return file;
}
