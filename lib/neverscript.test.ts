// NOT ORIGINAL - tests of finding NeverScript's ns (lib/neverscript.ts): the order, the release's files, the cache
// folder, the messages. No download (fetchNs is not run here).

import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { test } from "node:test";
import { cacheFolder, findNs, nsMissing, RELEASE, releaseFile, sha256 } from "./neverscript.ts";

test("the release has a build for each supported system, each with a SHA-256", () => {
    for (const system of ["win32-x64", "win32-ia32", "linux-x64", "darwin-arm64", "darwin-x64"]) {
        const [platform, arch] = system.split("-") as [string, string];
        const file = releaseFile(platform, arch);
        assert.ok(file, system);
        assert.match(file[1], /^[0-9a-f]{64}$/, system);
    }
    assert.equal(releaseFile("freebsd", "x64"), null);
    assert.equal(RELEASE.tag, "thug2-v1");
    assert.equal(sha256(new Uint8Array()), "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
});

test("the cache folder: the variable, else the system's cache", () => {
    assert.equal(cacheFolder({ THUG2_CONVERTERS_CACHE: "X" }, "linux"), "X");
    assert.equal(cacheFolder({ LOCALAPPDATA: "L" }, "win32"), path.join("L", "thug2-level-converters"));
    assert.equal(cacheFolder({ XDG_CACHE_HOME: "C" }, "linux"), path.join("C", "thug2-level-converters"));
    assert.equal(cacheFolder({}, "darwin"), path.join(os.homedir(), "Library", "Caches", "thug2-level-converters"));
});

test("findNs: --ns, then NEVERSCRIPT - each must exist; the messages say how to get it", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ns-"));
    try {
        const ns = path.join(dir, "ns.exe");
        fs.writeFileSync(ns, "");
        const missing = path.join(dir, "none.exe");
        assert.equal(findNs(ns, {}), ns);
        assert.equal(findNs(missing, { NEVERSCRIPT: ns }), null);
        assert.equal(findNs(undefined, { NEVERSCRIPT: ns }), ns);
        assert.equal(findNs(undefined, { NEVERSCRIPT: missing }), null);
        assert.match(nsMissing(missing, {}), /not found \(--ns\)/);
        assert.match(nsMissing(undefined, { NEVERSCRIPT: missing }), /not found \(NEVERSCRIPT\)/);
        assert.match(nsMissing(undefined, {}), /npx thug2-neverscript fetch/);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});
