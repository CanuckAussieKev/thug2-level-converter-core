// NOT ORIGINAL - tests of a converter's output folder handling (level_port/staging.ts): a folder that isn't a
// converter's output is never emptied; a whole convert empties it, a partial one keeps the other levels.

import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { test } from "node:test";
import { SystemExit } from "../lib/py.ts";
import { MANIFEST, STAGINGS, stagingFolders } from "./ported_levels.ts";
import { freshLevelFolder, isStagingFolder, MARKER, prepareStaging } from "./staging.ts";

function scratch(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), "staging-"));
}

function write(file: string, text = "x"): void {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
}

test("a new or empty folder is made and marked", () => {
    const root = scratch();
    try {
        const out = path.join(root, "out");
        prepareStaging(out, true);
        assert.ok(fs.existsSync(path.join(out, MARKER)));
        const empty = path.join(root, "empty");
        fs.mkdirSync(empty);
        prepareStaging(empty, false);
        assert.ok(fs.existsSync(path.join(empty, MARKER)));
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test("a folder with other files and no marker / levels.json is refused and left alone", () => {
    const root = scratch();
    try {
        const game = path.join(root, "Game");
        write(path.join(game, "THUG2.exe"));
        write(path.join(game, "Data", "pre", "qb_scripts.prx"));
        assert.equal(isStagingFolder(game), false);
        for (const whole of [true, false]) {
            assert.throws(
                () => prepareStaging(game, whole),
                (e: unknown) => e instanceof SystemExit && e.code === 1,
            );
        }
        assert.ok(fs.existsSync(path.join(game, "THUG2.exe")));
        assert.ok(fs.existsSync(path.join(game, "Data", "pre", "qb_scripts.prx")));
        assert.equal(fs.existsSync(path.join(game, MARKER)), false);
        // (a file, not a folder)
        assert.equal(isStagingFolder(path.join(game, "THUG2.exe")), false);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test("a whole convert empties the folder; a partial one keeps the other levels", () => {
    const root = scratch();
    try {
        const out = path.join(root, "out");
        write(path.join(out, MANIFEST), '{"levels": []}');
        write(path.join(out, "levels", "a", "a.qb"));
        write(path.join(out, "levels", "b", "b.qb"));
        prepareStaging(out, false);
        assert.ok(fs.existsSync(path.join(out, "levels", "a", "a.qb")));
        const fresh = freshLevelFolder(out, "a");
        assert.equal(fresh, path.join(out, "levels", "a"));
        assert.equal(fs.existsSync(fresh), false);
        assert.ok(fs.existsSync(path.join(out, "levels", "b", "b.qb")));
        prepareStaging(out, true);
        assert.deepEqual(fs.readdirSync(out), [MARKER]);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test("a folder a stopped convert left (marker, no levels.json) is still ours", () => {
    const root = scratch();
    try {
        const out = path.join(root, "out");
        write(path.join(out, MARKER));
        write(path.join(out, "levels", "a", "a.qb"));
        assert.ok(isStagingFolder(out));
        prepareStaging(out, true);
        assert.deepEqual(fs.readdirSync(out), [MARKER]);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test("stagingFolders: this project's converters first, then any other output with a levels.json, by name", () => {
    const root = scratch();
    try {
        write(path.join(root, "thug2-decomp-zzz", MANIFEST), '{"levels": []}');
        write(path.join(root, "thug2-decomp-aaa", MANIFEST), '{"levels": []}');
        write(path.join(root, "thug2-decomp-data", "scripts", "x.qb"));
        write(path.join(root, "thug2-decomp-thaw-bmx", "thaw_bmx.json"));
        write(path.join(root, "Data", "pre", "qb_scripts.prx"));
        const found = stagingFolders(root);
        assert.deepEqual(found.slice(0, STAGINGS.length), [...STAGINGS]);
        assert.deepEqual(found.slice(STAGINGS.length), ["thug2-decomp-aaa", "thug2-decomp-zzz"]);
        assert.deepEqual(stagingFolders(path.join(root, "none")), [...STAGINGS]);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});
