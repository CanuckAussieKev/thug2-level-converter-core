// NOT ORIGINAL - THUG2's skeletons (.ske.xbx) and animations (.ska.xbx), and the quaternion maths of the bones that
// go into them: what a converter that brings skinned models or animations into THUG2 writes (THPS3's people -
// thug2-thps3-level-converter's thps3_levels/thps3_skin.ts; THAW's BMX - thug2-content-pipeline's thaw_bmx). Moved
// from thps3_skin.ts (thug2-thps3-level-converter e80e4bf) when the converters' dependencies followed their engines.
//
// Quaternions: THUG2's are stored as THPS3's - a stored (x, y, z, w) turns a point by its conjugate (measured: THUG2's
// THPS6_human rest pose places its bones where THPS3's Ped_Construction skin has them only that way). The maths below
// is in the usual (Hamilton) sense: conj() at the files' edges.

import { FormatError, Reader, Writer } from "./binio.ts";
import { checksum } from "./qb.ts";

// --- maths ---------------------------------------------------------------------------------------------------------

export type Vec = [number, number, number];
export type Quat = [number, number, number, number]; // x y z w

export const IDENTITY: Quat = [0, 0, 0, 1];

export function qmul(a: Quat, b: Quat): Quat {
    return [
        a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
        a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
        a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
        a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
    ];
}

export function conj(q: Quat): Quat {
    return [-q[0], -q[1], -q[2], q[3]];
}

export function rotate(q: Quat, v: readonly number[]): Vec {
    const r = qmul(qmul(q, [v[0]!, v[1]!, v[2]!, 0]), conj(q));
    return [r[0], r[1], r[2]];
}

export function normalize(q: Quat): Quat {
    const n = Math.hypot(...q) || 1;
    return [q[0] / n, q[1] / n, q[2] / n, q[3] / n];
}

// A rotation matrix's quaternion (rows right / up / at as RenderWare's frames: x maps to right...).
export function matrixQuat(rows: readonly number[]): Quat {
    // (columns of the usual matrix are the rows here)
    const m = (r: number, c: number): number => rows[c * 3 + r]!;
    const trace = m(0, 0) + m(1, 1) + m(2, 2);
    let q: Quat;
    if (trace > 0) {
        const s = Math.sqrt(trace + 1) * 2;
        q = [(m(2, 1) - m(1, 2)) / s, (m(0, 2) - m(2, 0)) / s, (m(1, 0) - m(0, 1)) / s, s / 4];
    } else if (m(0, 0) > m(1, 1) && m(0, 0) > m(2, 2)) {
        const s = Math.sqrt(1 + m(0, 0) - m(1, 1) - m(2, 2)) * 2;
        q = [s / 4, (m(0, 1) + m(1, 0)) / s, (m(0, 2) + m(2, 0)) / s, (m(2, 1) - m(1, 2)) / s];
    } else if (m(1, 1) > m(2, 2)) {
        const s = Math.sqrt(1 + m(1, 1) - m(0, 0) - m(2, 2)) * 2;
        q = [(m(0, 1) + m(1, 0)) / s, s / 4, (m(1, 2) + m(2, 1)) / s, (m(0, 2) - m(2, 0)) / s];
    } else {
        const s = Math.sqrt(1 + m(2, 2) - m(0, 0) - m(1, 1)) * 2;
        q = [(m(0, 2) + m(2, 0)) / s, (m(1, 2) + m(2, 1)) / s, s / 4, (m(1, 0) - m(0, 1)) / s];
    }
    return normalize(q);
}

// --- animation keys ----------------------------------------------------------------------------------------------

export interface RotationKey {
    time: number; // seconds
    q: Quat; // Hamilton (the file's conjugated)
}
export interface TranslationKey {
    time: number;
    t: Vec;
}

// --- THUG2's skeleton (.ske.xbx) -----------------------------------------------------------------------------------
// u32 2, u32 0, u32 bones, the bones' name checksums, their parents' (0: none), their mirror bones' (0: none - the
// flipped animations' partner), then per bone the rest pose: 4f quaternion (THUG2's stored form), 4f translation (w 1)
// - local, relative to the parent.

export interface SkeletonBone {
    name: string;
    parent: number; // -1: none
    mirror: number; // -1: none
    q: Quat; // Hamilton
    t: Vec;
}

export function writeSkeleton(bones: readonly SkeletonBone[]): Buffer {
    const w = new Writer();
    w.write("3I", 2, 0, bones.length);
    const ids = bones.map((b) => checksum(b.name));
    for (const id of ids) w.u32(id);
    for (const b of bones) w.u32(b.parent < 0 ? 0 : ids[b.parent]!);
    for (const b of bones) w.u32(b.mirror < 0 ? 0 : ids[b.mirror]!);
    for (const b of bones) {
        w.write("4f", ...conj(b.q));
        w.write("4f", ...b.t, 1);
    }
    return w.getvalue();
}

// THUG2's skeleton read back: per bone its parent (-1: none) and rest pose (Hamilton).
export function readSkeleton(data: Buffer, name = "ske"): { parents: number[]; rest: { q: Quat; t: Vec }[] } {
    const r = new Reader(data, 0, name);
    const [version, , count] = r.read("3I") as [number, number, number];
    if (version !== 2) throw new FormatError(`${name}: version ${version}`);
    const ids = r.read(`${count}I`);
    const parents = r.read(`${count}I`).map((p) => (p === 0 ? -1 : ids.indexOf(p)));
    r.read(`${count}I`);
    const rest: { q: Quat; t: Vec }[] = [];
    for (let b = 0; b < count; b++) {
        const q = conj(r.read("4f") as Quat);
        const t = r.read("4f").slice(0, 3) as Vec;
        rest.push({ q, t });
    }
    r.expectEnd();
    return { parents, rest };
}

// --- THUG2's animation (.ska.xbx) ----------------------------------------------------------------------------------
// (the layout: thug2-thug1-level-converter/thug1_levels/thug1.ts untableAnim; the decoders 0x00482C20 / 0x00482E70, the player 0x00484760)
// Only the plain key forms are written: rotation {u16 time (frames at 60 a second) | 0x8000 when w < 0, 3 x i16 x y z
// (/ 16384)}, translation {u8 0, u16 time, 3 x i16 x y z (/ 32)}. A bone without rotation keys is held at no rotation;
// with these flags every bone's translation is read from its keys (absolute, as THPS3's).
export const ANIM_FLAGS = 0x06810000;
export const FPS = 60;
const Q_SCALE = 16384;
const T_SCALE = 32;

export interface Track {
    rotations: RotationKey[];
    translations: TranslationKey[];
}

const clampI16 = (v: number): number => Math.max(-32768, Math.min(32767, Math.round(v)));

export function writeAnim(duration: number, tracks: readonly Track[], name = "anim"): Buffer {
    const rot: Buffer[] = [];
    const tra: Buffer[] = [];
    let nq = 0;
    let nt = 0;
    for (const track of tracks) {
        const w = new Writer();
        let last = -1;
        for (const k of track.rotations) {
            const frame = Math.round(k.time * FPS);
            if (frame <= last) continue; // (two keys rounding to one frame: the first kept)
            if (frame >= 0x4000) throw new FormatError(`${name}: a key past frame 0x3FFF`);
            last = frame;
            const q = conj(normalize(k.q)); // (stored form)
            w.u16(frame | (q[3] < 0 ? 0x8000 : 0));
            w.write("3h", clampI16(q[0] * Q_SCALE), clampI16(q[1] * Q_SCALE), clampI16(q[2] * Q_SCALE));
            nq += 1;
        }
        rot.push(w.getvalue());
        const v = new Writer();
        last = -1;
        for (const k of track.translations) {
            const frame = Math.round(k.time * FPS);
            if (frame <= last) continue;
            if (frame > 0xffff) throw new FormatError(`${name}: a key past frame 0xFFFF`);
            last = frame;
            if (k.t.some((x) => Math.abs(x * T_SCALE) > 32767))
                throw new FormatError(`${name}: a translation past 1024 units`);
            v.u8(0);
            v.u16(frame);
            v.write("3h", ...k.t.map((x) => clampI16(x * T_SCALE)));
            nt += 1;
        }
        tra.push(v.getvalue());
    }
    for (const b of [...rot, ...tra]) if (b.length > 0xffff) throw new FormatError(`${name}: a bone's keys past 64 KB`);
    const q = Buffer.concat(rot);
    const t = Buffer.concat(tra);
    const w = new Writer();
    w.write("2I", 1, ANIM_FLAGS);
    w.f32(duration);
    w.write("6I", tracks.length, nq, nt, 0, q.length, t.length);
    for (const b of rot) w.u16(b.length);
    for (const b of tra) w.u16(b.length);
    w.padTo(4);
    w.raw(q);
    w.raw(t);
    w.padTo(4);
    return w.getvalue();
}

// THUG2's .ska.xbx read back (the plain forms writeAnim makes; the self-check's round trip).
export function readAnim(data: Buffer, name = "anim"): { duration: number; tracks: Track[] } {
    const r = new Reader(data, 0, name);
    const [version, flags] = r.read("2I") as [number, number];
    if (version !== 1 || flags !== ANIM_FLAGS) throw new FormatError(`${name}: flags ${flags.toString(16)}`);
    const duration = r.f32();
    const [bones, , , custom, qBytes, tBytes] = r.read("6I") as number[];
    if (custom) throw new FormatError(`${name}: custom keys`);
    const qSizes = r.read(`${bones}H`);
    const tSizes = r.read(`${bones}H`);
    r.offset = (r.offset + 3) & ~3;
    const tracks: Track[] = [];
    for (let b = 0; b < bones!; b++) tracks.push({ rotations: [], translations: [] });
    for (let b = 0; b < bones!; b++) {
        const end = r.offset + qSizes[b]!;
        while (r.offset < end) {
            const h = r.u16();
            if (h & 0x4000) throw new FormatError(`${name}: a packed rotation key`);
            const xyz = r.read("3h").map((x) => x / Q_SCALE);
            const w = Math.sqrt(Math.max(0, 1 - xyz[0]! ** 2 - xyz[1]! ** 2 - xyz[2]! ** 2)) * (h & 0x8000 ? -1 : 1);
            tracks[b]!.rotations.push({ time: (h & 0x3fff) / FPS, q: conj([xyz[0]!, xyz[1]!, xyz[2]!, w]) });
        }
    }
    for (let b = 0; b < bones!; b++) {
        const end = r.offset + tSizes[b]!;
        while (r.offset < end) {
            if (r.u8() !== 0) throw new FormatError(`${name}: a packed translation key`);
            const time = r.u16() / FPS;
            const t = r.read("3h").map((x) => x / T_SCALE) as Vec;
            tracks[b]!.translations.push({ time, t });
        }
    }
    if (tracks.reduce((s, t) => s + t.rotations.length, 0) * 8 !== qBytes) throw new FormatError(`${name}: sizes`);
    if (tracks.reduce((s, t) => s + t.translations.length, 0) * 9 !== tBytes) throw new FormatError(`${name}: sizes`);
    return { duration, tracks };
}
