// NOT ORIGINAL - a converter's output folder (its staging folder, e.g. <game>\thug2-decomp-thaw): made safe to empty
// and refill.
//
//   prepareStaging(out, whole)   before converting: refuses a folder that isn't a converter's output (anything in it
//                                but no MARKER / levels.json - a game folder, a typo'd --out); a whole convert (no level
//                                names given) empties it, a partial one keeps it - the levels converted now are
//                                replaced one by one (freshLevelFolder) and levels.json merges (ported_levels.ts
//                                writeManifest); then marks it as ours (MARKER)
//   freshLevelFolder(out, name)  <out>\levels\<name>, emptied: a level converted again keeps nothing of its old files
//   installHint(out)             the converters' last line: what installs the levels into the game

import * as fs from "node:fs";
import * as path from "node:path";
import { exitWith } from "../lib/cli.ts";
import { MANIFEST } from "./ported_levels.ts";

// The file that marks a folder as a converter's output (written first, so a convert that stopped half way still
// leaves it).
export const MARKER = ".thug2-converter-output";

const MARKER_TEXT =
    "This folder is a THUG2 level converter's output: the converters empty it and make it again.\n" +
    "Delete this file only together with the folder.\n";

// Whether `out` may be emptied and written: it doesn't exist, is empty, or holds MARKER or levels.json.
export function isStagingFolder(out: string): boolean {
    if (!fs.existsSync(out)) return true;
    if (!fs.statSync(out).isDirectory()) return false;
    const names = fs.readdirSync(out).map((n) => n.toLowerCase());
    return names.length === 0 || names.includes(MARKER) || names.includes(MANIFEST.toLowerCase());
}

export function prepareStaging(out: string, whole: boolean): void {
    if (!isStagingFolder(out)) {
        exitWith(
            `${out}: not a level converter's output folder (it has other files and no ${MANIFEST}) - ` +
                "nothing was changed; choose a new or empty folder for --out",
        );
    }
    if (whole) fs.rmSync(out, { recursive: true, force: true });
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, MARKER), MARKER_TEXT);
}

export function freshLevelFolder(out: string, name: string): string {
    const dir = path.join(out, "levels", name);
    fs.rmSync(dir, { recursive: true, force: true });
    return dir;
}

export const installHint = (out: string): string =>
    `${out}: install its levels into the game with the THUG2 content pipeline's menu_level/make_menu_level.ts ` +
    "(github.com/CanuckAussieKev/thug2-content-pipeline)";
