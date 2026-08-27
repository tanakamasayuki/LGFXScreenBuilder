#!/usr/bin/env node
// U8g2 encoder verification (lgfx-font-tool's `encode(font, {format: 'u8g2'})`).
//
// The bytes this project ships in a generated header come out of LGFXFontToolJs,
// and they are only useful if LovyanGFX can read them. So this test carries a
// *mirror* of LovyanGFX's decoder — a line-by-line port of
// U8g2font::getGlyph / updateFontMetric / drawChar from
// src/lgfx/v1/lgfx_fonts.cpp — and checks it two ways:
//
//   1. The mirror decodes a REAL LovyanGFX font (lgfx_font_japan_gothic_16 from
//      the pinned library copy), proving the mirror matches the C++ decoder
//      rather than matching our own assumptions.
//   2. Random glyph sets survive encode -> decode with identical bitmaps and
//      metrics, proving the encoder writes what the decoder expects.
//
// The mirror is deliberately independent of `decodeU8g2()` in the same library:
// checking an encoder with its own decoder would pass even if both drifted away
// from LovyanGFX together.
//
// Step 1 is skipped with a notice when the pinned LovyanGFX copy is absent
// (it lives in ~/.arduino15/internal after a build), so this stays runnable on
// a bare checkout.
//
//   node tests/fontgen/u8g2_roundtrip.mjs

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

// The authoring tool's dependencies live under docs/, not at the repo root.
const requireFromDocs = createRequire(new URL('../../docs/package.json', import.meta.url));
const { createFont, createBitmap, setPixel, encode, canEncode } =
  await import(pathToFileURL(requireFromDocs.resolve('lgfx-font-tool')).href);

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

// The test cases below describe glyphs the way u8g2 stores them — width,
// height, BDF-style bearings and an unpacked 0/1 bitmap. The library takes the
// neutral model instead, so convert: its bitmap is 1bpp MSB-first, and its
// yOffset measures the baseline to the bitmap's TOP (negative upward) where
// u8g2's `y` measures the baseline to the BOTTOM.
function toModel(glyphs, { height, descent }) {
  const map = new Map();
  for (const g of glyphs) {
    const bitmap = createBitmap(g.w, g.h, 1);
    for (let row = 0; row < g.h; row++) {
      for (let col = 0; col < g.w; col++) {
        if (g.bits[row * g.w + col]) setPixel(bitmap, col, row, 1);
      }
    }
    map.set(g.code, {
      codepoint: g.code,
      xOffset: g.x,
      yOffset: -(g.y + g.h),
      xAdvance: g.dx,
      bitmap,
    });
  }
  return createFont({
    familyName: 'roundtrip', styleName: 'Regular',
    ascent: height - descent, descent, lineHeight: height, glyphs: map,
  });
}

const errorsOf = (model) => canEncode(model, 'u8g2').issues.filter((i) => i.level === 'error');

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
  const model = toModel(glyphs, font);
  // A glyph the format cannot address is dropped by `dropInvalid`. Silently
  // losing a character is the failure mode that actually bites on a device, so
  // take the drop list from canEncode() and hold the encoder to exactly it.
  const skipped = new Set(errorsOf(model).filter((i) => i.codepoint !== undefined).map((i) => i.codepoint));
  const f = encode(model, { format: 'u8g2', dropInvalid: true });
  let checked = 0;
  for (const g of glyphs) {
    const d = decodeGlyph(f, g.code);
    if (skipped.has(g.code)) {
      if (d) fail(`${label}: U+${g.code.toString(16)} was reported as dropped but decoded anyway`);
      continue;
    }
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
    `(bits0=${H.bitsPer0(f)} bits1=${H.bitsPer1(f)}${skipped.size ? `, ${skipped.size} dropped` : ''})`);
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
// 255-byte jump-byte ceiling that the encoder reports as GLYPH_BYTES_OVER.
roundtrip('large', Array.from({ length: 120 }, (_, i) => randomGlyph(0x30 + i, 40, 40)), { height: 40, descent: 8 });

// Big glyphs, at the largest size the format really supports. The per-glyph
// width and height fields are unsigned and the decoder reads them at up to 8
// bits, but that capacity is not reachable: the HEADER stores max_char_width and
// max_char_height as `int8_t`, and getDefaultMetric assigns max_char_height
// straight to metrics->height, so anything over 127 comes back negative. 127 is
// therefore the true ceiling for both, and the advance stops earlier still, at
// the signed 7-bit 63.
roundtrip('wide', Array.from({ length: 40 }, (_, i) => {
  const g = randomGlyph(0x4e00 + i, 120, 120);
  return { ...g, dx: 60, x: 0, y: -20 };
}), { height: 127, descent: 20 });

// --- 3. dropped glyphs are always reported -------------------------------

// A glyph is reached through a one-byte jump, so an entry over 255 bytes cannot
// be addressed and has to be dropped. Which glyphs that hits depends on the
// run-length widths, and choosing those for FEWEST DROPS first (rather than
// smallest output) is what keeps everyday kanji in a large font — the objective
// lives in lgfx-font-tool's chooseRunBits and is tested there against all 64
// candidates. What matters HERE is the property a generated header depends on:
// a glyph that does not survive must appear in canEncode()'s issues, so the
// editor can list it, rather than going missing between the recipe and the panel.
//
// Kanji-like glyph: thin strokes over a large box, which is what actually lands
// entries near the ceiling. Seeded so a failure is reproducible rather than
// "it fails about a third of the time".
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

console.log('every dropped glyph is reported, never silently missing:');
strokeSeed = 1;
let exercised = false;
for (const [label, glyphs, font] of [
  ['sparse', Array.from({ length: 200 }, (_, i) => randomGlyph(0x3000 + i, 16, 16)), { height: 16, descent: 3 }],
  ['big', Array.from({ length: 60 }, (_, i) => randomGlyph(0x4e00 + i, 64, 64)), { height: 64, descent: 10 }],
  ['stroke density', [
    ...Array.from({ length: 60 }, (_, i) => strokeGlyph(0x30 + i, 22, 4)),
    ...Array.from({ length: 200 }, (_, i) => strokeGlyph(0x4e00 + i, 44, 30)),
  ], { height: 44, descent: 7 }],
  // The three above are sized so nothing has to be dropped — that is the point
  // of the coverage-first width choice. This one is deliberately past the
  // ceiling, so the reporting path is actually exercised rather than vacuously
  // satisfied by an empty drop list.
  ['over the ceiling', Array.from({ length: 40 }, (_, i) => {
    const g = randomGlyph(0x4e00 + i, 120, 120);
    return { ...g, dx: 60, x: 0, y: -20 };
  }), { height: 127, descent: 20 }],
]) {
  const model = toModel(glyphs, font);
  const reported = errorsOf(model).filter((i) => i.codepoint !== undefined);
  const data = encode(model, { format: 'u8g2', dropInvalid: true });
  const missing = glyphs.filter((g) => !decodeGlyph(data, g.code)).map((g) => g.code);
  const reportedCodes = new Set(reported.map((i) => i.codepoint));
  const unreported = missing.filter((c) => !reportedCodes.has(c));
  if (unreported.length) {
    fail(`${label}: ${unreported.length} glyph(s) vanished without being reported ` +
      `(first U+${unreported[0].toString(16)})`);
  } else if (reported.some((i) => i.code !== 'GLYPH_BYTES_OVER')) {
    fail(`${label}: unexpected drop reason ${reported.map((i) => i.code).join(', ')}`);
  } else {
    console.log(`  ok   ${label}: ${glyphs.length - missing.length}/${glyphs.length} kept, ` +
      `${missing.length} dropped and all ${missing.length ? 'reported as GLYPH_BYTES_OVER' : 'accounted for'}`);
    if (missing.length) exercised = true;
  }
}

// A green run that never actually dropped anything would prove nothing about
// the reporting path, so require at least one case to have exercised it.
if (!exercised) fail('no case dropped a glyph — the drop-reporting path went untested');

// --- 4. limits the format cannot hold ------------------------------------

// These must be refused with something actionable, not truncated into a font
// that draws wrong on the device.
console.log('format limits:');

function refuses(label, glyphs, font, wantCode) {
  try {
    encode(toModel(glyphs, font), { format: 'u8g2', dropInvalid: true });
    fail(`${label}: accepted, but the format cannot hold it`);
  } catch (e) {
    const issue = e.issues?.find((i) => i.code === wantCode);
    if (!issue) fail(`${label}: threw without a ${wantCode} issue (${e.message})`);
    else console.log(`  ok   ${label}: refused as ${wantCode} ${JSON.stringify(issue.params)}`);
  }
}

// The advance field is signed 7-bit, so 195 cannot be stored. dropInvalid must
// not paper over it either — losing the glyph silently would be worse.
refuses('an advance beyond the signed 7-bit field',
  [{ code: 0x3000, w: 10, h: 10, x: 0, y: 0, dx: 195, bits: new Uint8Array(100) }],
  { height: 20, descent: 4 }, 'XADVANCE_RANGE');

// The header's own fields are a second, tighter limit than the per-glyph ones,
// and the failure they cause is worse than clipping: getDefaultMetric assigns
// max_char_height (an int8_t) straight to metrics->height, so a line box over
// 127 comes back negative and the text lays out inverted. This is a FONT-level
// constraint, so dropInvalid cannot bypass it.
refuses('a line height beyond the header int8',
  [{ code: 0x41, w: 100, h: 100, x: 0, y: -20, dx: 60, bits: new Uint8Array(10000) }],
  { height: 200, descent: 20 }, 'LINE_BOX_TOO_TALL');

// Degenerate glyphs: a zero-size glyph (space) and an all-ink block.
roundtrip('edge', [
  { code: 0x20, w: 0, h: 0, x: 0, y: 0, dx: 8, bits: new Uint8Array(0) },
  { code: 0x21, w: 8, h: 16, x: 0, y: -3, dx: 8, bits: new Uint8Array(128).fill(1) },
  { code: 0x22, w: 8, h: 16, x: 0, y: -3, dx: 8, bits: new Uint8Array(128) },
  { code: 0x3042, w: 16, h: 16, x: 0, y: -3, dx: 16, bits: new Uint8Array(256).fill(1) },
], { height: 16, descent: 3 });

if (failures) { console.error(`\nu8g2 round trip FAILED (${failures} issue(s)).`); process.exit(1); }
console.log('\nu8g2 round trip OK.');
