#!/usr/bin/env node
// U8g2 encoder verification (docs/src/fontgen/u8g2enc.js).
//
// The encoder is only useful if LovyanGFX can read what it writes, so this test
// carries a *mirror* of LovyanGFX's decoder — a line-by-line port of
// U8g2font::getGlyph / updateFontMetric / drawChar from
// src/lgfx/v1/lgfx_fonts.cpp — and checks it two ways:
//
//   1. The mirror decodes a REAL LovyanGFX font (lgfx_font_japan_gothic_16 from
//      the pinned library copy), proving the mirror matches the C++ decoder
//      rather than matching our own assumptions.
//   2. Random glyph sets survive encode -> decode with identical bitmaps and
//      metrics, proving the encoder writes what the decoder expects.
//
// Step 1 is skipped with a notice when the pinned LovyanGFX copy is absent
// (it lives in ~/.arduino15/internal after a build), so this stays runnable on
// a bare checkout.
//
//   node tests/fontgen/u8g2_roundtrip.mjs

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { encodeU8g2, costOf, planFor } from '../../docs/src/fontgen/u8g2enc.js';

let failures = 0;
const fail = (msg) => { console.error('FAIL: ' + msg); failures++; };

// --- mirror of LovyanGFX's U8g2font decoder ------------------------------

class Decode {
  constructor(font, ptr) { this.f = font; this.p = ptr; this.bit = 0; }
  unsigned(cnt) {
    // The C++ decoder trusts its data; here a malformed stream must fail loudly
    // instead of spinning, so reading past the array is an error.
    if (this.p >= this.f.length) throw new Error('decode ran past end of font data');
    let bitPos = this.bit;
    let val = this.f[this.p] >> bitPos;
    let end = bitPos + cnt;
    if (end >= 8) { end -= 8; val |= this.f[++this.p] << (8 - bitPos); }
    this.bit = end;
    return val & ((1 << cnt) - 1);
  }
  signed(cnt) { return this.unsigned(cnt) - (1 << (cnt - 1)); }
}

const H = {
  glyphCnt: (f) => f[0], bitsPer0: (f) => f[2], bitsPer1: (f) => f[3],
  bpw: (f) => f[4], bph: (f) => f[5], bpx: (f) => f[6], bpy: (f) => f[7], bpd: (f) => f[8],
  maxW: (f) => (f[9] << 24) >> 24, maxH: (f) => (f[10] << 24) >> 24,
  yOffset: (f) => (f[12] << 24) >> 24,
  upperA: (f) => (f[17] << 8) | f[18],
  lowerA: (f) => (f[19] << 8) | f[20],
  unicode: (f) => (f[21] << 8) | f[22],
};

// Returns the index of the glyph payload, or -1.
function getGlyph(f, encoding) {
  let p = 23;
  if (encoding <= 255) {
    if (encoding >= 0x61) p += H.lowerA(f);
    else if (encoding >= 0x41) p += H.upperA(f);
    for (; f[p + 1]; p += f[p + 1]) if (f[p] === encoding) return p + 2;
    return -1;
  }
  p += H.unicode(f);
  let lut = p;
  let e;
  // The C++ loops assume well-formed data and would spin on anything else, so
  // the mirror bounds them and reports instead.
  do {
    if (lut + 3 >= f.length) throw new Error('unicode jump table ran past end of font data');
    p += (f[lut] << 8) + f[lut + 1];
    e = (f[lut + 2] << 8) + f[lut + 3];
    lut += 4;
  } while (e < encoding);
  for (; p + 2 < f.length && (e = (f[p] << 8) + f[p + 1]) !== 0; p += f[p + 2]) {
    if (e === encoding) return p + 3;
    if (f[p + 2] === 0) throw new Error('unicode glyph entry has a zero jump byte');
  }
  return -1;
}

// Decode one glyph to { w, h, x, y, dx, bits } (bits row-major 0/1).
function decodeGlyph(f, encoding) {
  const at = getGlyph(f, encoding);
  if (at < 0) return null;
  const d = new Decode(f, at);
  const w = d.unsigned(H.bpw(f));
  const h = d.unsigned(H.bph(f));
  const x = d.signed(H.bpx(f));
  const y = d.signed(H.bpy(f));
  const dx = d.signed(H.bpd(f));
  const bits = new Uint8Array(w * h);
  if (w && h) {
    let lx = 0, ly = 0, guard = 0;
    do {
      // The C++ loop cannot make progress on a malformed stream (a zero-length
      // run never advances lx); bound it so a bug surfaces as a failure.
      if (++guard > w * h + 64) throw new Error('bitmap decode made no progress');
      const ab = [d.unsigned(H.bitsPer0(f)), d.unsigned(H.bitsPer1(f))];
      let i = 0;
      do {
        let length = ab[i];
        while (length) {
          const len = Math.min(length, w - lx);
          length -= len;
          if (i) for (let k = 0; k < len; k++) bits[ly * w + lx + k] = 1;
          lx += len;
          if (lx === w) { lx = 0; ly++; }
        }
        i = i ? 0 : 1;
      } while (i || d.unsigned(1) !== 0);
    } while (ly < h);
  }
  return { w, h, x, y, dx, bits };
}

// --- 1. decode a real LovyanGFX font -------------------------------------

function findPinnedLovyanGFX() {
  const base = join(homedir(), '.arduino15', 'internal');
  if (!existsSync(base)) return null;
  const dirs = readdirSync(base).filter((d) => d.startsWith('LovyanGFX_')).sort();
  for (const d of dirs.reverse()) {
    const p = join(base, d, 'LovyanGFX', 'src', 'lgfx', 'Fonts', 'IPA', 'lgfx_font_japan.c');
    if (existsSync(p)) return p;
  }
  return null;
}

// Pull `const uint8_t <name>[<n>] = "...""...";` out of a LovyanGFX font
// source. LovyanGFX stores these fonts as concatenated C string literals with
// octal escapes, so the bytes are unescaped rather than parsed as numbers.
function parseCArray(text, name) {
  const def = new RegExp(`\\b${name}\\s*\\[\\s*\\d*\\s*\\]\\s*=`).exec(text);
  if (!def) return null;
  // The literals contain raw `;` bytes, so the end of the definition cannot be
  // found by searching for one — scan literal by literal and stop at the first
  // `;` encountered OUTSIDE a literal.
  const body = text;
  const out = [];
  const ESC = { n: 10, t: 9, r: 13, f: 12, v: 11, b: 8, a: 7, '\\': 92, "'": 39, '"': 34, '?': 63 };
  let i = def.index + def[0].length;
  while (i < body.length) {
    if (body[i] === ';') break;
    if (body[i] !== '"') { i++; continue; }  // whitespace / newlines between literals
    i++;
    while (i < body.length && body[i] !== '"') {
      if (body[i] !== '\\') { out.push(body.charCodeAt(i++)); continue; }
      i++;
      const c = body[i];
      if (c >= '0' && c <= '7') {
        let oct = '';
        while (oct.length < 3 && body[i] >= '0' && body[i] <= '7') oct += body[i++];
        out.push(parseInt(oct, 8) & 0xff);
      } else if (c === 'x') {
        i++;
        let hex = '';
        while (/[0-9a-fA-F]/.test(body[i])) hex += body[i++];
        out.push(parseInt(hex, 16) & 0xff);
      } else {
        out.push(ESC[c] ?? body.charCodeAt(i));
        i++;
      }
    }
    i++;
  }
  return Uint8Array.from(out);
}

const realPath = findPinnedLovyanGFX();
if (!realPath) {
  console.log('SKIP real-font decode: no pinned LovyanGFX copy under ~/.arduino15/internal');
} else {
  const text = readFileSync(realPath, 'utf8');
  const name = 'lgfx_font_japan_gothic_16';
  const font = parseCArray(text, name);
  if (!font) fail(`real font: ${name} not found in ${realPath}`);
  console.log(`real font: ${name} (${font.length} bytes, glyph_cnt byte ${H.glyphCnt(font)}, height ${H.maxH(font)})`);

  // ASCII, kana and kanji must all resolve and produce a non-empty bitmap with
  // sane geometry — a decoder that mis-reads the layout fails all three.
  for (const [label, ch] of [['A', 'A'], ['0', '0'], ['kana', 'あ'], ['kanji', '漢'], ['degree', '°']]) {
    const g = decodeGlyph(font, ch.codePointAt(0));
    if (!g) { fail(`real font: '${ch}' (${label}) not found`); continue; }
    const ink = g.bits.reduce((a, b) => a + b, 0);
    const ok = g.w > 0 && g.h > 0 && g.w <= 32 && g.h <= 32 && ink > 0 && ink < g.w * g.h;
    if (!ok) fail(`real font: '${ch}' decoded implausibly (w=${g.w} h=${g.h} ink=${ink})`);
    else console.log(`  '${ch}' ${g.w}x${g.h} x=${g.x} y=${g.y} dx=${g.dx} ink=${ink}`);
  }
  // A codepoint the font does not carry must miss cleanly, not wander off.
  if (decodeGlyph(font, 0xe000) !== null) fail('real font: private-use U+E000 unexpectedly resolved');
}

// --- 2. encode -> decode round trip --------------------------------------

// Deterministic PRNG so a failure is reproducible.
let seed = 12345;
const rnd = (n) => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) % n);

function randomGlyph(code, maxW, maxH) {
  const w = rnd(maxW) + 1, h = rnd(maxH) + 1;
  const bits = new Uint8Array(w * h);
  // Mix dense and sparse glyphs so both short and long runs get exercised.
  const density = [1, 3, 8][rnd(3)];
  for (let i = 0; i < bits.length; i++) bits[i] = rnd(density) === 0 ? 1 : 0;
  return { code, w, h, x: rnd(5) - 2, y: rnd(5) - 3, dx: w + rnd(3), bits };
}

function roundtrip(label, glyphs, font) {
  const res = encodeU8g2(glyphs, font);
  const f = res.data;
  const skipped = new Set(res.skipped.map((s) => s.code));
  let checked = 0;
  for (const g of glyphs) {
    if (skipped.has(g.code)) continue;
    const d = decodeGlyph(f, g.code);
    if (!d) { fail(`${label}: U+${g.code.toString(16)} not found after encode`); return; }
    for (const k of ['w', 'h', 'x', 'y', 'dx']) {
      if (d[k] !== g[k]) { fail(`${label}: U+${g.code.toString(16)} ${k} ${d[k]} != ${g[k]}`); return; }
    }
    for (let i = 0; i < g.bits.length; i++) {
      if (d.bits[i] !== g.bits[i]) { fail(`${label}: U+${g.code.toString(16)} bitmap differs at ${i}`); return; }
    }
    checked++;
  }
  // A codepoint that was never encoded must not resolve to a neighbour.
  const absent = 0xfffe;
  if (!glyphs.some((g) => g.code === absent) && decodeGlyph(f, absent)) {
    fail(`${label}: absent U+FFFE resolved`);
  }
  console.log(`  ${label}: ${checked} glyphs, ${f.length} bytes ` +
    `(bits0=${res.bitsPer.b0} bits1=${res.bitsPer.b1}${res.skipped.length ? `, ${res.skipped.length} skipped` : ''})`);
}

console.log('round trip:');

// ASCII only (exercises section A and the upper_A / lower_a fast paths).
roundtrip('ascii', Array.from({ length: 95 }, (_, i) => randomGlyph(0x20 + i, 12, 16)), { height: 16, descent: 3 });

// Unicode only (exercises the jump table with several blocks).
roundtrip('kanji', Array.from({ length: 300 }, (_, i) => randomGlyph(0x4e00 + i * 3, 16, 16)), { height: 16, descent: 3 });

// Mixed, spanning both sections and crossing the 64-glyph block boundary.
roundtrip('mixed', [
  ...Array.from({ length: 95 }, (_, i) => randomGlyph(0x20 + i, 10, 16)),
  ...Array.from({ length: 500 }, (_, i) => randomGlyph(0x3000 + i * 7, 16, 16)),
], { height: 16, descent: 3 });

// Large glyphs: long runs force pair splitting, and big entries approach the
// 255-byte jump-byte ceiling that encodeU8g2 reports as `skipped`.
roundtrip('large', Array.from({ length: 120 }, (_, i) => randomGlyph(0x30 + i, 40, 40)), { height: 40, descent: 8 });

// Width and height are UNSIGNED fields, which LovyanGFX's decoder reads exactly
// at 8 bits, so they may exceed 127. The advance is SIGNED and stops at 7 bits,
// so it is held inside that range here — a font that needs more is rejected
// with an explicit error, checked separately below.
roundtrip('wide', Array.from({ length: 40 }, (_, i) => {
  const g = randomGlyph(0x4e00 + i, 200, 200);
  return { ...g, dx: 60, x: 0, y: -20 };
}), { height: 200, descent: 20 });

// The run-length widths are chosen for FEWEST DROPPED GLYPHS first and smallest
// output second. Size alone is the wrong objective: a glyph is reached through a
// one-byte jump, so an entry over 255 bytes has to be dropped, and the widths
// decide how long entries get. Optimising bytes alone therefore trades whole
// characters away for a few hundred bytes — with a real Japanese set it dropped
// 繊 and 酬 at a 32px character height, and 49 everyday kanji (機 職 織 臓 …) at
// 36px.
//
// Rather than hand-build a set that creates the conflict — the first attempt at
// one did not, and passed identically against the old objective — this asserts
// the property itself against all 64 candidates: whatever the encoder picked
// must drop no more glyphs than any other choice would, and among the choices
// that drop that many it must be the smallest.
// Kanji-like glyph: thin strokes over a large box. Seeded so a failure is
// reproducible rather than "it fails about a third of the time".
let strokeSeed = 1;
function strokeGlyph(code, size, strokes) {
  const rnd = () => (strokeSeed = (strokeSeed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const bits = new Uint8Array(size * size);
  for (let s = 0; s < strokes; s++) {
    const horiz = rnd() < 0.5;
    const pos = Math.floor(rnd() * size);
    const from = Math.floor(rnd() * size);
    const to = from + Math.floor(rnd() * (size - from));
    for (let k = from; k <= to; k++) {
      const y = horiz ? pos : k;
      const x = horiz ? k : pos;
      if (y < size && x < size) bits[y * size + x] = 1;
    }
  }
  return { code, w: size, h: size, x: 0, y: -Math.floor(size / 6), dx: size, bits };
}

console.log('run-length widths are chosen for coverage, not just size:');
strokeSeed = 1;
for (const [label, glyphs, font] of [
  ['sparse', Array.from({ length: 200 }, (_, i) => randomGlyph(0x3000 + i, 16, 16)), { height: 16, descent: 3 }],
  ['big', Array.from({ length: 60 }, (_, i) => randomGlyph(0x4e00 + i, 64, 64)), { height: 64, descent: 10 }],
  // This one actually creates the conflict, and it took a search to find: the
  // obvious hand-built cases (speckle vs solid block) all had the same answer
  // under both objectives, so they proved nothing. Kanji-like glyphs are what
  // does it — thin strokes over a large box, so the entries land just under the
  // 255-byte ceiling and the width choice tips them over. Here the size-optimal
  // choice (b0=5, b1=2) drops 4 glyphs that b0=3, b1=1 keeps.
  ['stroke density', [
    ...Array.from({ length: 60 }, (_, i) => strokeGlyph(0x30 + i, 22, 4)),
    ...Array.from({ length: 200 }, (_, i) => strokeGlyph(0x4e00 + i, 44, 30)),
  ], { height: 44, descent: 7 }],
]) {
  const res = encodeU8g2(glyphs, font);
  const plan = planFor(glyphs);
  let bestLost = Infinity;
  let bestTotal = Infinity;
  for (let b0 = 1; b0 <= 8; b0++) {
    for (let b1 = 1; b1 <= 8; b1++) {
      const c = costOf(plan.runsPerGlyph, plan.glyphs, plan.fixedBits, b0, b1);
      if (c.lost < bestLost || (c.lost === bestLost && c.total < bestTotal)) { bestLost = c.lost; bestTotal = c.total; }
    }
  }
  const got = costOf(plan.runsPerGlyph, plan.glyphs, plan.fixedBits, res.bitsPer.b0, res.bitsPer.b1);
  if (got.lost === bestLost && got.total === bestTotal && res.skipped.length === bestLost) {
    console.log(`  ok   ${label}: bits0=${res.bitsPer.b0} bits1=${res.bitsPer.b1} drops ${got.lost}, ` +
      `the fewest any of the 64 choices can (then smallest at ${Math.ceil(got.total / 8)} payload bytes)`);
  } else {
    fail(`${label}: chose bits0=${res.bitsPer.b0} bits1=${res.bitsPer.b1} dropping ${got.lost} glyph(s) ` +
      `(${res.skipped.length} actually skipped), but another choice drops only ${bestLost}`);
  }
}

// A glyph the format genuinely cannot hold must be refused with something the
// user can act on, not a bare "too large".
console.log('format limits:');
try {
  encodeU8g2([{ code: 0x3000, w: 10, h: 10, x: 0, y: 0, dx: 195, bits: new Uint8Array(100) }],
    { height: 200, descent: 20, probeHeight: 200 });
  fail('an advance beyond the signed 7-bit field was accepted');
} catch (e) {
  const named = /"　"/.test(e.message) && /195/.test(e.message) && /63/.test(e.message);
  const advises = /character height of \d+px or less/.test(e.message);
  if (named && advises) console.log(`  ok   the error names the character, the limit and a size that works\n       ${e.message}`);
  else fail(`unhelpful limit error: ${e.message}`);
}

// Degenerate glyphs: a zero-size glyph (space) and an all-ink block.
roundtrip('edge', [
  { code: 0x20, w: 0, h: 0, x: 0, y: 0, dx: 8, bits: new Uint8Array(0) },
  { code: 0x21, w: 8, h: 16, x: 0, y: -3, dx: 8, bits: new Uint8Array(128).fill(1) },
  { code: 0x22, w: 8, h: 16, x: 0, y: -3, dx: 8, bits: new Uint8Array(128) },
  { code: 0x3042, w: 16, h: 16, x: 0, y: -3, dx: 16, bits: new Uint8Array(256).fill(1) },
], { height: 16, descent: 3 });

if (failures) { console.error(`\nu8g2 round trip FAILED (${failures} issue(s)).`); process.exit(1); }
console.log('\nu8g2 round trip OK.');
