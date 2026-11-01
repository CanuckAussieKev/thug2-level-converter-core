// NOT ORIGINAL - this repository's package.json against its files (thug2-level-converter-core's lib/package_check.ts):
// its exports and commands are there, every import of another repository is a pinned dependency's export, and
// importing a module runs no command.

import assert from "node:assert/strict";
import { test } from "node:test";
import { importOutput, packageProblems } from "./lib/package_check.ts";

const ROOT = import.meta.dirname;
const EXT = import.meta.filename.endsWith(".js") ? ".js" : ".ts"; // (.js: an installed copy - npm built it)

test("package.json: exports, commands and dependencies", () => {
    assert.deepEqual(packageProblems(ROOT), []);
});

test("importing a module runs no command", () => {
    assert.equal(importOutput(ROOT, EXT), "");
});
