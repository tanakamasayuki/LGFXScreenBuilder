// U8g2 bitmap-font encoder (§8.7.7).
//
// LovyanGFX draws `lgfx::U8g2font` straight out of a PROGMEM byte array, and
// its own bundled Japanese fonts (fonts::lgfxJapanGothic_*, fonts::efont*) are
// exactly that format — so emitting U8g2 gets us zero-RAM `setFont(&myFont)`
// with no new runtime code on the device side.
//
// The layout below is the inverse of LovyanGFX's decoder in
// src/lgfx/v1/lgfx_fonts.cpp (U8g2font::getGlyph / updateFontMetric / drawChar),
// which is the authority here rather than u8g2's own bdfconv:
//
//   [0..22]  header (see HEADER below)
//   [23..]   section A: glyphs with encoding <= 255
//              { u8 encoding, u8 jump (entry size), ...bit-packed glyph }
//              terminated by a zero jump byte
//   [+unicode] section U: jump table then glyphs with encoding > 255
//              lut:   { u16be offset-delta, u16be max-encoding-in-block } * N
//              glyph: { u16be encoding, u8 jump, ...bit-packed glyph }
//              terminated by a zero encoding
//
// Bit-packed glyph payload (LSB-first within each byte):
//   width(bits_per_char_width) height(bits_per_char_height)
//   x(bits_per_char_x, signed) y(bits_per_char_y, signed)
//   dx(bits_per_delta_x, signed)
//   then run-length pairs: (zero-run, one-run) laid out row-major across the
//   w*h pixel stream, each pair followed by a repeat bit (1 = apply the same
//   pair again), until h rows are filled.

// Signed fields are stored biased: the decoder does `unsigned - (1 << (cnt-1))`.
const bias = (cnt) => 1 << (cnt - 1);

// Field widths are bounded by LovyanGFX's decoder, and the two kinds differ:
//
//   get_unsigned_bits(cnt) accumulates into a uint_fast8_t and masks with
//   ((1U << cnt) - 1), so it is exact up to 8 bits.
//   get_signed_bits(cnt) casts that to int_fast8_t before subtracting the bias;
//   at cnt == 8 a value of 200 wraps to -56 and the result is wrong, so signed
//   fields stop at 7.
//
// That asymmetry is worth keeping: width and height reach 255 rather than 127,
// which is what lets a large font encode at all.
const MAX_UNSIGNED_BITS = 8;
const MAX_SIGNED_BITS = 7;

// Bits needed to hold 0..max as an unsigned field.
function unsignedBits(max) {
  let n = 1;
  while (max >= (1 << n)) n++;
  return n;
}

// Bits needed to hold [min..max] as a biased signed field.
function signedBits(min, max) {
  let n = 1;
  while (min < -bias(n) || max > bias(n) - 1) n++;
  return n;
}

class BitWriter {
  constructor() { this.bytes = []; this.cur = 0; this.nbits = 0; }
  put(value, cnt) {
    for (let i = 0; i < cnt; i++) {
      if ((value >> i) & 1) this.cur |= 1 << this.nbits;
      if (++this.nbits === 8) { this.bytes.push(this.cur); this.cur = 0; this.nbits = 0; }
    }
  }
  // Pad to a byte boundary — every glyph payload starts byte-aligned.
  flush() { if (this.nbits) { this.bytes.push(this.cur); this.cur = 0; this.nbits = 0; } return this.bytes; }
}

// Pixel stream (row-major, 0/1) -> alternating [zeroRun, oneRun, zeroRun, ...].
// Always starts with a zero run (possibly length 0) because the decoder always
// reads the zero field first.
function runsOf(bits) {
  const runs = [];
  let want = 0, n = 0;
  for (const b of bits) {
    if (b === want) { n++; continue; }
    runs.push(n);
    want ^= 1;
    n = 1;
  }
  runs.push(n);
  if (runs.length & 1) runs.push(0); // finish on a complete (zero, one) pair
  return runs;
}

// Split the run list into (zero, one) pairs that fit the chosen field widths.
// A run longer than its field splits into several pairs; because a (max, 0)
// pair emits max zeros and no ones, consecutive same-colour runs concatenate
// back together on decode.
function pairsFor(runs, b0, b1) {
  const m0 = (1 << b0) - 1, m1 = (1 << b1) - 1;
  const pairs = [];
  for (let i = 0; i < runs.length; i += 2) {
    let z = runs[i], o = runs[i + 1];
    while (z > m0) { pairs.push([m0, 0]); z -= m0; }
    while (o > m1) { pairs.push([z, m1]); z = 0; o -= m1; }
    pairs.push([z, o]);
  }
  return pairs;
}

// Bit cost of a pair list, with equal neighbours collapsed onto repeat bits.
function pairBits(pairs, b0, b1) {
  let bits = 0;
  for (let i = 0; i < pairs.length;) {
    let j = i;
    while (j + 1 < pairs.length && pairs[j + 1][0] === pairs[i][0] && pairs[j + 1][1] === pairs[i][1]) j++;
    bits += b0 + b1 + (j - i) + 1; // one pair, (j-i) repeat-1 bits, one repeat-0 bit
    i = j + 1;
  }
  return bits;
}

function writePairs(bw, pairs, b0, b1) {
  for (let i = 0; i < pairs.length;) {
    let j = i;
    while (j + 1 < pairs.length && pairs[j + 1][0] === pairs[i][0] && pairs[j + 1][1] === pairs[i][1]) j++;
    bw.put(pairs[i][0], b0);
    bw.put(pairs[i][1], b1);
    for (let k = i; k < j; k++) bw.put(1, 1);
    bw.put(0, 1);
    i = j + 1;
  }
}

// Pick the (bits_per_0, bits_per_1) pair to encode the font with.
//
// The obvious objective is "smallest font", but it is the wrong one on its own.
// A glyph's entry is reached through a one-byte jump, so an entry over 255 bytes
// cannot be addressed and has to be dropped — and the run-length widths decide
// how long the entries are. Optimising bytes alone therefore trades away whole
// characters to save a few hundred bytes, and the characters it drops are the
// densest ones, which for a Japanese set means everyday kanji: 繊 and 酬 at a
// 32px character height, and 49 of them (機 職 織 臓 …) at 36px.
//
// So the choice is lexicographic: fewest unencodable glyphs first, smallest
// total second. Runs are computed once per glyph and only the bit accounting is
// re-done, so all 64 combinations stay cheap even for a ten-thousand-glyph set.
//
// Exported so a test can assert the lexicographic property against the full 64
// candidates rather than against a hand-built example that may not create the
// conflict at all — the first attempt at one did not.
export function chooseRunBits(runsPerGlyph, glyphs, fixedBitsPerGlyph) {
  let best = null;
  for (let b0 = 1; b0 <= MAX_UNSIGNED_BITS; b0++) {
    for (let b1 = 1; b1 <= MAX_UNSIGNED_BITS; b1++) {
      const c = costOf(runsPerGlyph, glyphs, fixedBitsPerGlyph, b0, b1);
      if (!best || c.lost < best.lost || (c.lost === best.lost && c.total < best.total)) best = { b0, b1, ...c };
    }
  }
  return best;
}

// What one (b0, b1) candidate would cost: payload bits over the whole font, and
// how many glyphs it would push past the 255-byte jump-byte ceiling.
export function costOf(runsPerGlyph, glyphs, fixedBitsPerGlyph, b0, b1) {
  let total = 0;
  let lost = 0;
  for (let i = 0; i < runsPerGlyph.length; i++) {
    const g = glyphs[i];
    const bits = g.w && g.h ? pairBits(pairsFor(runsPerGlyph[i], b0, b1), b0, b1) : 0;
    total += bits;
    if (entryBytes(g, fixedBitsPerGlyph + bits) > 255) lost++;
  }
  return { total, lost };
}

// The per-glyph run list and the fixed metric-field width, so a test can drive
// costOf/chooseRunBits with exactly what the encoder uses.
export function planFor(glyphs) {
  const usable = glyphs.filter((g) => g.code >= 0x20 && g.code <= 0xffff).sort((a, b) => a.code - b.code);
  const bpx = signedBits(Math.min(0, ...usable.map((g) => g.x)), Math.max(0, ...usable.map((g) => g.x)));
  const bpy = signedBits(Math.min(0, ...usable.map((g) => g.y)), Math.max(0, ...usable.map((g) => g.y)));
  const bpd = signedBits(Math.min(0, ...usable.map((g) => g.dx)), Math.max(0, ...usable.map((g) => g.dx)));
  return {
    glyphs: usable,
    runsPerGlyph: usable.map((g) => runsOf(g.bits)),
    fixedBits: unsignedBits(Math.max(1, ...usable.map((g) => g.w)))
      + unsignedBits(Math.max(1, ...usable.map((g) => g.h))) + bpx + bpy + bpd,
  };
}

// Payload bytes plus the 2- or 3-byte per-glyph header the jump byte covers.
const entryBytes = (g, payloadBits) => Math.ceil(payloadBits / 8) + (g.code <= 255 ? 2 : 3);

const u16be = (v) => [(v >> 8) & 0xff, v & 0xff];

/**
 * Encode glyphs into a U8g2 font byte array.
 *
 * @param {Array} glyphs  [{ code, w, h, x, y, dx, bits }] where `bits` is a
 *   row-major w*h array of 0/1 and (x, y) are BDF-style bitmap offsets from the
 *   pen position: x rightwards, y from the baseline to the bitmap's BOTTOM row.
 * @param {Object} font   { height, ascent, descent } in pixels — `height` is the
 *   line advance and `descent` how far below the baseline the line extends.
 * @returns {{ data: Uint8Array, skipped: Array, bitsPer: Object }}
 */
export function encodeU8g2(glyphs, font) {
  const height = Math.round(font.height);
  const descent = Math.round(font.descent); // pixels below the baseline (>= 0)
  const ascent = height - descent;

  // Codepoints above the BMP have no representation in a uint16 encoding.
  const usable = glyphs.filter((g) => g.code >= 0x20 && g.code <= 0xffff)
    .sort((a, b) => a.code - b.code);

  const maxW = Math.max(1, ...usable.map((g) => g.w));
  const maxH = Math.max(1, ...usable.map((g) => g.h));
  const bpw = unsignedBits(maxW);
  const bph = unsignedBits(maxH);
  const bpx = signedBits(Math.min(0, ...usable.map((g) => g.x)), Math.max(0, ...usable.map((g) => g.x)));
  const bpy = signedBits(Math.min(0, ...usable.map((g) => g.y)), Math.max(0, ...usable.map((g) => g.y)));
  const bpd = signedBits(Math.min(0, ...usable.map((g) => g.dx)), Math.max(0, ...usable.map((g) => g.dx)));
  // A field that does not fit is a hard format limit, not a bug to work around.
  // Say which character hit it and what size would work, because "too large for
  // this format" leaves the user guessing.
  const limitFor = (name, n) => {
    const signed = name === 'x' || name === 'y' || name === 'dx';
    const max = signed ? MAX_SIGNED_BITS : MAX_UNSIGNED_BITS;
    if (n <= max) return;
    const cap = signed ? bias(max) - 1 : (1 << max) - 1;
    const worst = usable.reduce((a, g) => (Math.abs(g[name === 'dx' ? 'dx' : name]) > Math.abs(a[name === 'dx' ? 'dx' : name]) ? g : a), usable[0]);
    const value = Math.abs(worst[name === 'dx' ? 'dx' : name]);
    const asked = font.probeHeight || height;
    const fits = Math.max(1, Math.floor(asked * cap / value));
    throw new Error(
      `u8g2: "${String.fromCodePoint(worst.code)}" needs ${name} = ${value}px, but this format ` +
      `stores it in ${max} bits (max ${cap}). Try a character height of ${fits}px or less.`);
  };
  limitFor('width', bpw);
  limitFor('height', bph);
  limitFor('x', bpx);
  limitFor('y', bpy);
  limitFor('dx', bpd);

  const runsPerGlyph = usable.map((g) => runsOf(g.bits));
  const { b0, b1 } = chooseRunBits(runsPerGlyph, usable, bpw + bph + bpx + bpy + bpd);

  // Per-glyph payload (metrics + bitmap), byte-aligned.
  const skipped = [];
  const encoded = [];
  usable.forEach((g, i) => {
    const bw = new BitWriter();
    bw.put(g.w, bpw);
    bw.put(g.h, bph);
    bw.put(g.x + bias(bpx), bpx);
    bw.put(g.y + bias(bpy), bpy);
    bw.put(g.dx + bias(bpd), bpd);
    if (g.w && g.h) writePairs(bw, pairsFor(runsPerGlyph[i], b0, b1), b0, b1);
    const payload = bw.flush();
    // The jump byte covers the whole entry (header + payload) and is a u8, so
    // an entry over 255 bytes cannot be addressed. Report rather than corrupt.
    const entry = entryBytes(g, payload.length * 8);
    if (entry > 255) { skipped.push({ code: g.code, bytes: entry }); return; }
    encoded.push({ code: g.code, payload, entry });
  });

  const lo = encoded.filter((g) => g.code <= 255);
  const hi = encoded.filter((g) => g.code > 255);

  // --- section A: encodings 0..255 ---------------------------------------
  const secA = [];
  let posUpperA = 0, posLowerA = 0;
  for (const g of lo) {
    if (!posUpperA && g.code >= 0x41) posUpperA = secA.length;
    if (!posLowerA && g.code >= 0x61) posLowerA = secA.length;
    secA.push(g.code, g.entry, ...g.payload);
  }
  secA.push(0, 0); // zero jump byte terminates the scan

  // --- section U: unicode jump table + glyphs -----------------------------
  // Blocks keep the linear scan short; the table is a running sum of offsets,
  // so entry k's delta is measured from where entry k-1 left the pointer.
  const BLOCK = 64;
  const blocks = [];
  for (let i = 0; i < hi.length; i += BLOCK) blocks.push(hi.slice(i, i + BLOCK));
  if (!blocks.length) blocks.push([]); // always emit a valid table

  const blockBytes = (blk) => blk.reduce((a, g) => a + g.entry, 0);
  const lutBytes = 4 * blocks.length;
  const lut = [];
  const body = [];
  blocks.forEach((blk, i) => {
    // The decoder accumulates these deltas onto a pointer that starts at the
    // table base: the first entry steps over the table itself, and each later
    // entry steps from one block start to the next.
    lut.push(...u16be(i === 0 ? lutBytes : blockBytes(blocks[i - 1])));
    // The last block owns everything up to U+FFFF so a lookup past the end
    // still lands in a scan that terminates on the trailing zero encoding.
    const last = i === blocks.length - 1;
    lut.push(...u16be(last ? 0xffff : blk[blk.length - 1].code));
    for (const g of blk) body.push(...u16be(g.code), g.entry, ...g.payload);
  });
  body.push(0, 0); // zero encoding terminates the scan

  const secU = [...lut, ...body];
  const posUnicode = secA.length;

  const header = [
    Math.min(255, encoded.length),  // 0  glyph_cnt (informational; u8 saturates)
    0,                              // 1  bbx_mode (unused by LovyanGFX)
    b0,                             // 2  bits_per_0
    b1,                             // 3  bits_per_1
    bpw,                            // 4  bits_per_char_width
    bph,                            // 5  bits_per_char_height
    bpx,                            // 6  bits_per_char_x
    bpy,                            // 7  bits_per_char_y
    bpd,                            // 8  bits_per_delta_x
    maxW & 0xff,                    // 9  max_char_width
    height & 0xff,                  // 10 max_char_height == line height
    0,                              // 11 x_offset
    (-descent) & 0xff,              // 12 y_offset: baseline = height + y_offset
    ascent & 0xff,                  // 13 ascent_A     (u8g2-only)
    (-descent) & 0xff,              // 14 descent_g    (u8g2-only)
    ascent & 0xff,                  // 15 ascent_para  (u8g2-only)
    (-descent) & 0xff,              // 16 descent_para (u8g2-only)
    ...u16be(posUpperA),            // 17 start_pos_upper_A
    ...u16be(posLowerA),            // 19 start_pos_lower_a
    ...u16be(posUnicode),           // 21 start_pos_unicode
  ];

  return {
    data: Uint8Array.from([...header, ...secA, ...secU]),
    skipped,
    bitsPer: { b0, b1, bpw, bph, bpx, bpy, bpd },
    glyphCount: encoded.length,
    metrics: { height, ascent, descent, maxWidth: maxW, maxHeight: maxH },
  };
}
