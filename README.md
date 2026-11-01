# THUG2 Level Converter Core

> **Not affiliated with or endorsed by Activision, Neversoft or any other rights holder.** A non-commercial fan project
> for preservation, interoperability and education. No game files are included: the tools work only on copies of the
> games you own. Game names are trademarks of their owners. See LICENSE (MIT for the project's own work; no licence for material
> from the games); third-party parts (CPython-derived helpers, downloaded tools) are listed in THIRD_PARTY_NOTICES.md.
> Rights holders: open an issue and it will be dealt with promptly.

What every level converter for Tony Hawk's Underground 2 (PC) shares: the readers and writers of THUG2's formats, the
level port's common steps, the THUGPRO compatibility register, and the formats more than one converter reads. Each
game's converter is a repository of its own that depends only on this one:

| Converter | Converts |
|---|---|
| [thug2-thps2-level-converter](https://github.com/CanuckAussieKev/thug2-thps2-level-converter) | Tony Hawk's Pro Skater 2 |
| [thug2-thps3-level-converter](https://github.com/CanuckAussieKev/thug2-thps3-level-converter) | Tony Hawk's Pro Skater 3 |
| [thug2-thps4-level-converter](https://github.com/CanuckAussieKev/thug2-thps4-level-converter) | Tony Hawk's Pro Skater 4 |
| [thug2-thug1-level-converter](https://github.com/CanuckAussieKev/thug2-thug1-level-converter) | Tony Hawk's Underground |
| [thug2-thaw-level-converter](https://github.com/CanuckAussieKev/thug2-thaw-level-converter) | Tony Hawk's American Wasteland |
| [thug2-thp8-level-converter](https://github.com/CanuckAussieKev/thug2-thp8-level-converter) | Tony Hawk's Project 8 |
| [thug2-thpg-level-converter](https://github.com/CanuckAussieKev/thug2-thpg-level-converter) | Tony Hawk's Proving Ground |

The [THUG2 content pipeline](https://github.com/CanuckAussieKev/thug2-content-pipeline) installs what they convert
into the game (the data overlay and its level select), and the
[THUG2 decompilation](https://github.com/CanuckAussieKev/thug2-decomp) runs it.

## What is here

- `lib/` - the tools' helpers: command lines (`cli.ts`, `converter_args.ts`), finding a game's files in the folder
  you name (`install.ts`), where the project and the decomp are (`decomp.ts`), Python-compatible formatting and
  parsing (`py.ts`, `struct.ts`, `re.ts`, `difflib.ts`, `files.ts`: the tools were ported from Python and give the
  same results), edits to game scripts (`edits.ts`), BPS patches (`bps.ts`), PNG images and frame series
  (`frame_diff.ts`).
- `level_port/` - THUG2's scene, collision, texture, archive and script formats and what the converters share
  (README.md there).
- `compat/` - the compatibility profiles: `compat/thugpro` is the THUGPRO register (README.md there: every TP-n entry)
  and its data, one file per converter; `compat.ts` reads them, `thugpro_nodes.ts` holds the node array helpers of
  the comparisons with THUGPRO's levels.
- `thaw/` - Tony Hawk's American Wasteland's level files (`thaw.ts`), its scripts in THUG2's free skate
  (`thaw_scripts.ts`) and its node flags (`node_flags.ts`): the THAW, Project 8 and Proving Ground converters read
  them, and so do the THAW BMX tools.
- `thp8/` - Tony Hawk's Project 8's formats (Xbox 360: archives, scenes, textures, materials, Havok collision) and its
  level converter (`thp8_levels.ts`): Proving Ground's converter runs the same one with its own game profile.

## Using it

A converter (or any project) depends on it from git, pinned to a commit, and imports it by name:

    "dependencies": { "thug2-level-converter-core": "github:CanuckAussieKev/thug2-level-converter-core#<commit>" }

    import * as qb from "thug2-level-converter-core/level_port/qb.ts";

Node 24 runs the TypeScript directly (type stripping), but never under `node_modules`. So `npm install` builds this
repository (`prepare`: `tsconfig.build.json` writes a `.js` beside every `.ts`, its imports as `.js`) and
`package.json`'s `exports` sends `./<path>.ts` to `./<path>.js` at run time; TypeScript still reads the `.ts` (the
`types` condition). Every project that installs this one and a converter must pin the same commit in both: npm then
installs one copy (two copies would be two sets of classes - a `Struct` from one isn't one of the other's).

On its own:

    npm install
    npm run typecheck
    npm run lint
    npm test

## With or without the decomp

`lib/decomp.ts` finds the project using this repository - the folder holding the `node_modules` it is installed in (a
converter's clone, the content pipeline, the decomp), or this clone - and the THUG2 decompilation checkout: that
folder or the first one above it with the decomp's `CMakeLists.txt` and `src/game` (or `THUG2_DECOMP=<folder>`).
`out\` is the decomp's when there is one, else the project's. NeverScript's `ns.exe` (QB scripts compiled and
decompiled) is looked for in `out\neverscript` - the decomp builds it there (`tools\build_neverscript.ps1`) - or given
with `--ns <ns.exe>`. `compat/thugpro/scripts_hash.ts` reads the decomp's `src/game/net/thugpro_join.h`; a test that
reads the decomp's source is skipped without it.

## Changing it

Work in a clone, and link it into the project you test with (`npm link` in the clone, `npm link
thug2-level-converter-core` in the project: its `node_modules` entry then points at the clone; `npm run prepare` in
the clone after each change rebuilds the `.js`). The THUGPRO comparisons' `--extract-thugpro` rewrite the register's
data in `compat/thugpro` - only in a clone (an installed copy refuses: `compat.profileFileToWrite`). Then commit, push,
and move every dependent's pin (`#<commit>`) to the new commit.

Nothing from the games is in this repository: everything is read from your own installed copies each time.
