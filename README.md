# THUG2 Level Converter Core

> **Not affiliated with or endorsed by Activision, Neversoft or any other rights holder.** A non-commercial fan project
> for preservation, interoperability and education. No game files are included: the tools work only on copies of the
> games you own. Game names are trademarks of their owners. See LICENSE (MIT for the project's own work; no licence for material
> from the games); third-party parts (CPython-derived helpers, downloaded tools) are listed in THIRD_PARTY_NOTICES.md.
> Rights holders: open an issue and it will be dealt with promptly.

What every level converter for Tony Hawk's Underground 2 (PC) shares: THUG2's side of a conversion - the readers and
writers of THUG2's formats and the level port's common steps - the compatibility profiles' mechanism, and the tools'
helpers. No source game's formats or converter: those are in the game's own repository; no compatibility profile's
data: THUGPRO's is [thug2-thugpro-compat](https://github.com/CanuckAussieKev/thug2-thugpro-compat). The converters depend on
this one and on the converters of the games their game is built on (specific to general, core at the bottom; no
cycles):

    thug2-content-pipeline -> every converter below, thug2-thugpro-compat
    thug2-thpg-level-converter -> thug2-thp8-level-converter, thug2-thaw-level-converter, core
    thug2-thp8-level-converter -> thug2-thaw-level-converter, core
    thug2-thaw- / -thps3- / -thps4- / -thug1-level-converter -> thug2-thugpro-compat, core
    thug2-thps2-level-converter -> core
    thug2-thugpro-compat -> core
    thug2-level-converter-core -> nothing

| Converter | Converts | Built on |
|---|---|---|
| [thug2-thps2-level-converter](https://github.com/CanuckAussieKev/thug2-thps2-level-converter) | Tony Hawk's Pro Skater 2 | core |
| [thug2-thps3-level-converter](https://github.com/CanuckAussieKev/thug2-thps3-level-converter) | Tony Hawk's Pro Skater 3 | core |
| [thug2-thps4-level-converter](https://github.com/CanuckAussieKev/thug2-thps4-level-converter) | Tony Hawk's Pro Skater 4 | core |
| [thug2-thug1-level-converter](https://github.com/CanuckAussieKev/thug2-thug1-level-converter) | Tony Hawk's Underground | core |
| [thug2-thaw-level-converter](https://github.com/CanuckAussieKev/thug2-thaw-level-converter) | Tony Hawk's American Wasteland | core |
| [thug2-thp8-level-converter](https://github.com/CanuckAussieKev/thug2-thp8-level-converter) | Tony Hawk's Project 8 | THAW's formats (thaw converter) |
| [thug2-thpg-level-converter](https://github.com/CanuckAussieKev/thug2-thpg-level-converter) | Tony Hawk's Proving Ground | Project 8's engine (thp8 converter) |

The [THUG2 content pipeline](https://github.com/CanuckAussieKev/thug2-content-pipeline) installs what they convert
into the game (the data overlay and its level select) and checks these rules on what it installs (`deps.test.ts`);
the [THUG2 decompilation](https://github.com/CanuckAussieKev/thug2-decomp) runs it.

## What is here

- `lib/` - the tools' helpers: command lines (`cli.ts`, `converter_args.ts`), finding a game's files in the folder
  you name (`install.ts`), where the project and the decomp are (`decomp.ts`), Python-compatible formatting and
  parsing (`py.ts`, `struct.ts`, `re.ts`, `difflib.ts`, `files.ts`: the tools were ported from Python and give the
  same results), edits to game scripts (`edits.ts`), BPS patches (`bps.ts`), PNG images and frame series
  (`frame_diff.ts`), and the check of a repository's package.json (`package_check.ts`: every repository's
  `package.test.ts`).
- `level_port/` - THUG2's scene, collision, texture, archive, script, skeleton and animation formats and what the
  converters share (README.md there).
- `compat/compat.ts` - the compatibility profiles' mechanism: `Profile` (a profile's data folder, one file per
  converter, read by section), `none()` (the profile without data: `--compat none`), the entry lists of its
  difference sections (`entryList`) and the refusal to rewrite an installed copy's data (`fileToWrite`). No profile's
  data or knowledge: a profile is a package of its own that builds its `Profile` on this one - THUGPRO's is
  thug2-thugpro-compat (its `profile.ts` loads "thugpro" or "none"; the register, its data, the hand edits and the node
  helpers of the comparisons with THUGPRO's levels), a dependency of the converters that use it, never of this one.

Here although only some converters use them - each THUG2-side, or shared by converters of unrelated games:
`level_port/thug2_material.ts` and `tri_strip.ts` (THUG2's materials and strips: the THPS2, THPS3 and Project 8
converters), `mips.ts` (THPS2, THPS3), `ped_ai.ts` (THUG2's ped animations: THPS3, THUG1), `ramp_collision.ts`
(THUG2's ramp flags: THPS2), `movers.ts` (THUG2's solid moving props: THPS3), `script_check.ts` (THUG2's script
faults: THUG1), `thug2_skeleton.ts` (THUG2's skeletons and animations: THPS3's people and the content pipeline's
THAW BMX), `lib/frame_diff.ts` (the THPS2
converter, the pipeline's HD art and menus).

## Public API

package.json's `exports` lists the modules other repositories may import (each `./<folder>/<module>.ts`: the `.ts`
for TypeScript, the `.js` npm built for Node) - what the converters, the content pipeline and the decomp's tools use;
a module not listed is internal. Its `commands` lists the tools with a command line (`node level_port/zfight.ts ...`
in a clone; `node tools/pipeline/run.ts level_port/zfight.ts ...` in the decomp); importing a module never runs one.

## Using it

A converter (or any project) depends on it from git, pinned to a tagged commit by https, and imports its exports by
name (the user name `git@` in the URL makes npm record the https URL in package-lock.json - for a plain
`git+https://github.com/...` it records `git+ssh://`, and `npm ci` would then want a GitHub SSH key):

    "dependencies": { "thug2-level-converter-core": "git+https://git@github.com/CanuckAussieKev/thug2-level-converter-core.git#<commit>" }

    import * as qb from "thug2-level-converter-core/level_port/qb.ts";

Node 24 runs the TypeScript directly (type stripping), but never under `node_modules`. So `npm install` builds this
repository (`prepare`: `tsconfig.build.json` writes a `.js` beside every `.ts`, its imports as `.js`) and
`package.json`'s `exports` sends `./<path>.ts` to `./<path>.js` at run time; TypeScript still reads the `.ts` (the
`types` condition). Every project that installs this one and a converter must pin the same commit in both: npm then
installs one copy (two copies would be two sets of classes - a `Struct` from one isn't one of the other's).

On its own:

    npm ci
    npm run typecheck
    npm run lint
    npm test

GitHub Actions runs them on every push (`.github/workflows/ci.yml`).

## Versions

Releases are tagged `v<major>.<minor>.<patch>`; this is `v2.0.0` (the THUGPRO profile - its register and data,
`compat/hand_edits.ts`, `compat/thugpro_nodes.ts`, `compat/thugpro/scripts_hash.ts` - moved to thug2-thugpro-compat;
`compat/compat.ts` keeps only the mechanism). `v1.0.0`: THAW's and Project 8's formats moved to their converters;
explicit exports. The repositories that use it pin the tagged commit.

## With or without the decomp

`lib/decomp.ts` finds the project using this repository - the folder holding the `node_modules` it is installed in (a
converter's clone, the content pipeline, the decomp), or this clone - and the THUG2 decompilation checkout: that
folder or the first one above it with the decomp's `CMakeLists.txt` and `src/game` (or `THUG2_DECOMP=<folder>`).
`out\` is the decomp's when there is one, else the project's. NeverScript's `ns.exe` (QB scripts compiled and
decompiled) is looked for in `out\neverscript` - the decomp builds it there (`tools\build_neverscript.ps1`) - or given
with `--ns <ns.exe>`. A test that reads the decomp's source is skipped without it.

## Changing it

Work in a clone, and link it into the project you test with (`npm link` in the clone, `npm link
thug2-level-converter-core` in the project: its `node_modules` entry then points at the clone; `npm run prepare` in
the clone after each change rebuilds the `.js`). Then commit, push,
tag it (`v<version>`, package.json's version bumped) and move every dependent's pin (`#<commit>`) to the new commit.

Nothing from the games is in this repository: everything is read from your own installed copies each time.
