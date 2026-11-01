// NOT ORIGINAL - what thug2-content-pipeline/menu_level/make_menu_level.ts adds to the data overlay for the levels converted from other
// games (thug2-thps4-level-converter/thps4_levels, thug2-thug1-level-converter/thug1_levels, thug2-thps3-level-converter/thps3_levels): their files, their level structures in Levels.qb
// and their signs in the level select.
//
// Each converter writes a staging folder in the THUG2 folder (not read by the game): <thug2>\<staging>\levels\<level>\
// (the converted files) and <thug2>\<staging>\levels.json, a list of levels:
//   folder        the level's name in its own game (THPS4's folder, THUG1's level code)
//   level         the level's name in THUG2 (its folder under levels\, its files, Load_<level>, Level_<level>)
//   load          (optional) the name of its load script and level structure (Load_<load>, Level_<load>) when it
//                 isn't `level` (THPS4's skate shop: Load_practice, a THUGPRO compatibility name - TP-20)
//   sky           the sky level's name, or null
//   display       the level select's sign text ("THUG1 NEW JERSEY")
//   name          the level's own name (the level structure's name=)
//   game          the game it comes from ("THPS4", "THUG1", "THPS3")
//   location      where it is in the real world ("New Jersey, USA") - for the level select
//   icon          a level select sign texture that suits it (THUG2's own, e.g. "sign_philly")
//   level_num     the level select's number for its sign (unique; no career records - the info panel skips them)
//   default_stats the skater's stats there
//   lighting      THUG2 level structure keys (ambient / directional lights)
//   setup_script  (optional) a script of the level's .qb the level structure names as its setup_script (THPS3's
//                 start scripts)
//   startup_script (optional) the same for the level structure's startup_script (THUG1's: loads its sounds)
// and, at the top level next to `levels`, an optional `title`: the level select section's title for a converter this
// project doesn't know (stagingFolders; "TONY HAWK'S ..." - this project's converters' sections have their own).
//
// The manifest is read with parseJson and written with jsonText (lib/json.ts): a float stays a float (the
// lighting's mod factors, "1.0"), and the file's bytes are Python's (indent 1, ASCII, CRLF line ends on Windows).

import * as fs from "node:fs";
import * as path from "node:path";
import { exitWith } from "../lib/cli.ts";
import { jsonText, parseJson } from "../lib/json.ts";
import { Float, floatText } from "../lib/numbers.ts";
import { readText, valueText, writeText } from "../lib/text.ts";

export const MANIFEST = "levels.json";
// The staging folders, in the order their levels are listed.
export const STAGINGS = [
    "thug2-decomp-thps4",
    "thug2-decomp-thug1",
    "thug2-decomp-thps3",
    "thug2-decomp-thaw",
    "thug2-decomp-thps2",
    "thug2-decomp-thp8",
    "thug2-decomp-thpg",
] as const;

export interface LevelEntry {
    folder?: string;
    level: string;
    load?: string;
    sky?: string | null;
    display: string;
    name: string;
    game?: string;
    location?: string;
    icon?: string;
    level_num: number;
    default_stats: number | Float;
    lighting: Record<string, number | Float>;
    setup_script?: string;
    startup_script?: string;
    staging?: string;
    [key: string]: unknown;
}

export interface Manifest {
    levels: LevelEntry[];
    [key: string]: unknown;
}

export function readManifest(file: string): Manifest | null {
    if (!fs.existsSync(file)) return null;
    return parseJson(readText(file)) as Manifest | null;
}

// A convert of some levels only (`convert foun`) updates their entries and keeps the others already in the staging
// folder's list - before, it wrote just the levels of that run and the level select lost the rest.
export function writeManifest(file: string, manifest: unknown): void {
    writeText(file, jsonText(mergeManifest(readManifest(file), manifest as Manifest), 1));
}

export function mergeManifest(old: Manifest | null, fresh: Manifest): Manifest {
    if (!old || !Array.isArray(old.levels) || !Array.isArray(fresh.levels)) return fresh;
    const freshByLevel = new Map(fresh.levels.map((e) => [String(e.level).toLowerCase(), e]));
    const levels: LevelEntry[] = [];
    for (const e of old.levels) {
        const key = String(e.level).toLowerCase();
        const replacement = freshByLevel.get(key);
        levels.push(replacement ?? e);
        freshByLevel.delete(key);
    }
    levels.push(...freshByLevel.values());
    return { ...fresh, levels };
}

function truthy(value: unknown): boolean {
    // (Python's truth of a json value: an empty dict / list / string, 0, None are false)
    if (value === null || value === undefined || value === false || value === 0 || value === "") return false;
    if (Array.isArray(value)) return value.length > 0;
    if (value instanceof Float) return value.value !== 0;
    if (typeof value === "object") return Object.keys(value).length > 0;
    return true;
}

// The staging folders in a THUG2 folder: STAGINGS (this project's converters, in their order), then any other
// thug2-decomp-* folder holding a levels.json - another converter's output - by name. A converter of another game
// needs nothing here to be installed: make_menu_level lists its levels in a level select section of their own, titled
// by its levels.json's `title` (else the folder's name).
export function stagingFolders(game: string): string[] {
    let names: string[];
    try {
        names = fs.readdirSync(game);
    } catch {
        return [...STAGINGS];
    }
    const known = new Set<string>(STAGINGS.map((s) => s.toLowerCase()));
    const others = names
        .filter((n) => /^thug2-decomp-/i.test(n) && !known.has(n.toLowerCase()))
        .filter((n) => fs.existsSync(path.join(game, n, MANIFEST)))
        .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    return [...STAGINGS, ...others];
}

export function loadManifest(game: string): Manifest | null {
    // Every converted level of every staging folder, or null when there are none.
    const levels: LevelEntry[] = [];
    for (const staging of stagingFolders(game)) {
        const manifest = readManifest(path.join(game, staging, MANIFEST));
        if (!truthy(manifest)) continue;
        for (const entry of manifest!.levels) levels.push({ ...entry, staging });
    }
    const numbers = levels.map((e) => e.level_num);
    if (new Set(numbers).size !== numbers.length) {
        exitWith(`converted levels: a level select number is used twice (${valueText(numbers)})`);
    }
    // (the level names are the load scripts' and folders' names: two staging folders naming a level alike - e.g. two
    // converters using a game's bare level name - would replace one with the other in Levels.qb)
    // (a sky may serve several levels of one staging folder - THPS4's)
    const seen = new Map<string, string>();
    for (const e of levels) {
        const staging = e.staging ?? "";
        for (const name of new Set([e.level, loadOf(e)].map((n) => n.toLowerCase()))) {
            const level = seen.get(name);
            if (level !== undefined) exitWith(`converted levels: ${name} is named twice (${level} and ${staging})`);
            seen.set(name, staging);
        }
    }
    for (const e of levels) {
        if (typeof e.sky !== "string") continue;
        const mine = `sky:${e.staging ?? ""}`;
        const other = seen.get(e.sky.toLowerCase());
        if (other !== undefined && other !== mine) {
            exitWith(`converted levels: ${e.sky} is named twice (${other.replace(/^sky:/, "")} and ${e.staging})`);
        }
        seen.set(e.sky.toLowerCase(), mine);
    }
    return levels.length ? { levels } : null;
}

export function structName(entry: LevelEntry): string {
    return `Level_${loadOf(entry)}`;
}

// The name after Load_ / Level_: the entry's `load`, or its level's.
export function loadOf(entry: LevelEntry): string {
    return entry.load ?? entry.level;
}

// Python's "%d" % value: an int, or a float truncated.
function percentD(value: number | Float): string {
    const n = value instanceof Float ? value.value : value;
    return String(Math.trunc(n));
}

// Python's "%s" % value of a lighting value: repr(float(value)) for a float, the int as it is.
function lightingText(value: unknown): string {
    if (value instanceof Float) return floatText(value.value);
    if (typeof value === "number") return Number.isInteger(value) ? String(value) : floatText(value);
    return String(value);
}

export function levelsQbText(manifest: Manifest): string {
    // The level structures and load scripts, as NeverScript text for Levels.qb (LevelNum_Default as the shop's).
    const parts: string[] = [];
    for (const entry of manifest.levels) {
        const s = structName(entry);
        const load = `Load_${loadOf(entry)}`;
        const lines = [
            `script ${load} {`,
            `    load_level ${s} `,
            "} ",
            `${s} = {`,
            `    structure_name=${s} `,
            `    load_script=${load} `,
            `    name="${entry.name.replaceAll('"', "")}" `,
            '    loading_screen="loadscrn_generic" ',
            "    loading_time=8.0 ",
            "    COIM_size=1331200 ",
            `    level_name="${entry.level}" `,
            `    level="${entry.level}" `,
        ];
        if (truthy(entry.sky)) lines.push(`    sky="${entry.sky}" `);
        if (truthy(entry.startup_script)) {
            // (load_level runs it before the node array is parsed: THUG1's load its sounds there)
            lines.push(`    startup_script=${entry.startup_script} `);
        }
        if (truthy(entry.setup_script)) {
            // (load_level runs it once the node array is up, and reset_level again)
            lines.push(`    setup_script=${entry.setup_script} `);
        }
        lines.push(
            `    qb="levels\\\\${entry.level}\\\\${entry.level}.qb" `,
            `    default_stats=${percentD(entry.default_stats)} `,
            `    default_stats_classic=${percentD(entry.default_stats)} `,
            "    level_number=LevelNum_Default ",
            "    skip_teammate_pro ",
        );
        for (const [key, value] of Object.entries(entry.lighting)) lines.push(`    ${key}=${lightingText(value)} `);
        lines.push("} ");
        parts.push(`${lines.join("\n")}\n`);
    }
    return parts.join("");
}

export function addToLevels(text: string, manifest: Manifest): string {
    const anchor = "\nscript Load_TestLevel {";
    if (text.split(anchor).length - 1 !== 1) exitWith("Levels.qb: Load_TestLevel not found once");
    // (a function as the replacement: a string one would read "$&" / "$1")
    return text.replace(anchor, () => `\n${levelsQbText(manifest)}${anchor.slice(1)}`);
}

export function signsText(manifest: Manifest, indent: string): string {
    return manifest.levels
        .map(
            (e) =>
                `${indent}{text="${e.display.replaceAll('"', "")}" level_num=${percentD(e.level_num)} num_goals=0 flag=LEVEL_UNLOCKED_TR level=Load_${loadOf(e)} ` +
                "sign_texture=sign_training dot_pos=(89.0, 82.0)} \n",
        )
        .join("");
}

export function signNumbers(manifest: Manifest): number[] {
    return manifest.levels.map((e) => e.level_num);
}

export function installFiles(game: string, overlay: string, manifest: Manifest | null = null): string[] {
    // The converted levels (every staging folder's) into the overlay's levels folder.
    void manifest;
    const installed: string[] = [];
    for (const staging of stagingFolders(game)) {
        const source = path.join(game, staging, "levels");
        if (!fs.existsSync(source) || !fs.statSync(source).isDirectory()) continue;
        for (const entry of fs.readdirSync(source)) {
            const target = path.join(overlay, "levels", entry);
            if (fs.existsSync(target) && fs.statSync(target).isDirectory()) fs.rmSync(target, { recursive: true });
            const from = path.join(source, entry);
            // (shutil.copytree: a directory only, into a target that isn't there, file times kept)
            if (!fs.statSync(from).isDirectory()) throw new Error(`copytree: ${from} is not a directory`);
            if (fs.existsSync(target)) throw new Error(`copytree: ${target} exists`);
            fs.cpSync(from, target, { recursive: true, preserveTimestamps: true, errorOnExist: true, force: false });
            installed.push(entry);
        }
        // Game scripts a converter brings along (<staging>\scripts\...: THUG1's driving scripts, PC-THUG1-22 -
        // thug2-thug1-level-converter/thug1_levels drivingScripts) into the overlay's scripts folder, where they replace the game's file of
        // the same name (THUG2's empty player_controlled_vehicle.qb / misc\car_scripts.qb).
        const scripts = path.join(game, staging, "scripts");
        if (fs.existsSync(scripts) && fs.statSync(scripts).isDirectory()) {
            fs.cpSync(scripts, path.join(overlay, "scripts"), {
                recursive: true,
                preserveTimestamps: true,
                force: true,
            });
            installed.push(`scripts (${staging})`);
        }
        // Models a converter brings along (<staging>\models\<name>\...: THPS3's TPN-THPS3, THUGPRO's own models read from
        // its install) into the overlay's models folder, where the game looks for models\<name>\<name>.mdl.
        // (and the animations and skeletons a converter brings for its own people: <staging>\anims\<game>\...,
        // <staging>\skeletons\... - ped_models.ts)
        for (const folder of ["models", "anims", "skeletons"]) {
            const from = path.join(game, staging, folder);
            if (!fs.existsSync(from) || !fs.statSync(from).isDirectory()) continue;
            for (const entry of fs.readdirSync(from)) {
                const target = path.join(overlay, folder, entry);
                // (merged, not replaced: two stagings may both bring models\veh\... - THUG1's El train and leaf blower,
                // say; make_menu_level empties the overlay before each run anyway)
                fs.cpSync(path.join(from, entry), target, { recursive: true, preserveTimestamps: true, force: true });
                installed.push(`${folder}\\${entry}`);
            }
        }
    }
    return installed.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}
