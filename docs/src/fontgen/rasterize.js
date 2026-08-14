// Glyph rasterizer for the embedded-font generator (§8.7.7).
//
// Rasterizing happens through the browser's own text engine (FontFace + a 2D
// canvas) rather than a bundled TTF parser. That keeps the tool dependency-free
// — no vendored opentype.js — accepts anything the browser accepts (TTF, OTF/CFF,
// WOFF/WOFF2, variable fonts), and, most usefully, makes the on-screen preview
// and the generated glyphs come out of the exact same rasterizer.
//
// Output is per-glyph { code, w, h, x, y, dx, bits } in the shape encodeU8g2()
// wants: `bits` is a row-major 1bpp array, `x` the left bearing, `y` the signed
// distance from the baseline to the bitmap's BOTTOM row, `dx` the advance.

// Whether a glyph actually came from the chosen font is decided by drawing it
// with the font in the stack and again with the font REMOVED, behind the same
// generic fallback. If the two match, the fallback drew it and the font has no
// such glyph; if they differ, the font supplied it.
//
// Two simpler tests were tried first and both ship wrong output:
//
//   * Compare the font behind serif against the font behind monospace. That
//     only works while the two generics resolve to different physical fonts.
//     On a machine with a single CJK font both render 漢 identically and every
//     Latin face is credited with the whole of CJK; on a machine with no font
//     for a character at all, both render the same .notdef box and a tofu gets
//     embedded as if it were a glyph. Which of those happens depends on the
//     machine, so it passes locally and fails on a CI runner.
//   * Compare against the browser's default font and call a match "missing".
//     That drops characters the font really has: `I` and `l` are the same plain
//     bar in most faces.
//
// Both generics are used, and the character counts as present if EITHER pair
// differs — a glyph that happens to be pixel-identical to serif's is unlikely
// to also be pixel-identical to monospace's.
const FALLBACKS = ['serif', 'monospace'];

// Unicode's space characters. They draw nothing, so the shape comparison cannot
// judge them and only the advance can — see rasterizeOne.
const SPACES = new Set([0x20, 0xa0, 0x1680, 0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005,
  0x2006, 0x2007, 0x2008, 0x2009, 0x200a, 0x202f, 0x205f, 0x3000]);

/**
 * Load a font into the document so canvas can draw with it.
 * @param {ArrayBuffer|string} src  font binary, or a URL to fetch
 * @returns {Promise<{family: string, face: FontFace}>}
 */
export async function loadFont(src, familyHint = 'LGFXSBFontGen') {
  // A unique family per load keeps a second import from silently reusing the
  // first one's glyphs (canvas resolves by name, not by FontFace identity).
  const family = `${familyHint}_${(loadFont._n = (loadFont._n || 0) + 1)}`;
  const face = new FontFace(family, typeof src === 'string' ? `url(${JSON.stringify(src)})` : src);
  await face.load();
  document.fonts.add(face);
  return { family, face };
}

export function unloadFont(face) {
  try { document.fonts.delete(face); } catch { /* already gone */ }
}

// Canvas big enough that no glyph at `size` can spill out of it, with the pen
// placed far enough in from the edges to catch negative bearings and overhang.
function makeSurface(size) {
  const pad = Math.ceil(size * 1.5) + 8;
  const w = Math.ceil(size * 4) + pad * 2;
  const h = Math.ceil(size * 4) + pad * 2;
  const cv = typeof OffscreenCanvas !== 'undefined'
    ? new OffscreenCanvas(w, h)
    : Object.assign(document.createElement('canvas'), { width: w, height: h });
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  return { cv, ctx, w, h, originX: pad, originY: Math.ceil(size * 2) + pad };
}

// `fallback` null means "this family alone" — used for measuring, so the line
// box always describes the chosen font and never a fallback that stood in.
// The family is quoted; the generic fallback must NOT be, or the browser treats
// it as the name of a font nobody has and silently uses the default instead —
// which makes it useless as a comparison baseline.
const cssFont = (size, family, { weight = 400, italic = false } = {}, fallback = null) =>
  `${italic ? 'italic ' : ''}${weight} ${size}px "${family}"${fallback ? `, ${fallback}` : ''}`;

// The generic alone, with no chosen family in front of it.
const cssGeneric = (size, generic, { weight = 400, italic = false } = {}) =>
  `${italic ? 'italic ' : ''}${weight} ${size}px ${generic}`;

// The size is pinned to the ink height of a REFERENCE CHARACTER, picked from
// the set being generated. Candidates are tried in this order and the first one
// the font actually draws wins: an ideograph or a hangul syllable if the set has
// them (they fill the em square), then a capital, then a digit.
//
// Picking from the requested set rather than from a fixed probe matters: asking
// canvas whether a family "has" 漢 is not answerable — a Latin-only family falls
// back to a system font, and where no CJK font is installed at all the fallback
// draws an identical tofu through every fallback chain, so the character looks
// present. Restricting candidates to characters the user actually asked for
// sidesteps the question entirely.
const PROBE_CANDIDATES = [0x6f22, 0x56fd, 0x65e5, 0xac00, 0x48, 0x45, 0x4e, 0x30];
// Large enough that the probe's ink height is measured with useful precision.
const REF_PX = 100;

// Ink height of one codepoint at a given CSS px size, or 0 if the font has no
// glyph for it.
function probeInk(surf, cp, cssPx, family, style) {
  const g = rasterizeOne(surf, cp, cssPx, family, style, 128);
  return g && g.h > 0 ? g.h : 0;
}

function pickProbe(family, style, codepoints) {
  const surf = makeSurface(REF_PX);
  const set = new Set(codepoints);
  for (const cp of PROBE_CANDIDATES) {
    if (!set.has(cp)) continue;
    const h = probeInk(surf, cp, REF_PX, family, style);
    if (h) return { cp, refHeight: h };
  }
  // Nothing canonical is in the set (a digits-only clock, say): take the
  // tallest of the first handful, which for such a set is representative.
  let best = null;
  for (const cp of codepoints.slice(0, 24)) {
    const h = probeInk(surf, cp, REF_PX, family, style);
    if (h && (!best || h > best.refHeight)) best = { cp, refHeight: h };
  }
  return best;
}

/**
 * Resolve a requested CHARACTER HEIGHT to the CSS px size that produces it.
 *
 * The size field is the height of the characters themselves, not the line box.
 * Line boxes vary wildly between families — the same "32" gives visibly
 * different text in Noto Sans JP and in Roboto, because one reserves far more
 * room above and below than the other — and what anyone means by 32 is text
 * that is 32 pixels tall. So the size is pinned to a reference character's ink
 * height and the line box becomes a derived value.
 *
 * The line box cannot be computed here: it depends on which characters end up
 * in the font. rasterizeSet() measures it from the glyphs it actually produced,
 * which is both tight and guaranteed not to clip.
 */
export function measureFont(family, size, style = {}, codepoints = [], { probeChar = null, sameEmAs = 0 } = {}) {
  // A fallback font must be measured on the SAME reference character as the
  // font it is filling in for, or its glyphs come out a different size and the
  // seam is obvious.
  const forced = probeChar ? { cp: probeChar.codePointAt(0) } : null;
  if (forced) forced.refHeight = probeInk(makeSurface(REF_PX), forced.cp, REF_PX, family, style);
  if (probeChar && !forced.refHeight && sameEmAs) {
    // The reference character is not available here. Picking a different one
    // from whatever is left would scale this font by an arbitrary glyph — a
    // bracket among the leftovers once made a fallback's kana a quarter too
    // small. Matching the em of the font being filled in for is at least
    // principled, and for two fonts drawn on the same em it is exact.
    return { cssPx: sameEmAs, probe: null, probeHeight: 0 };
  }
  const probe = forced && forced.refHeight ? forced : pickProbe(family, style, codepoints);
  // A font that draws none of the requested characters has no scale to derive;
  // fall back to treating the size as an em size so callers still get output
  // (they will report the empty result themselves).
  if (!probe) return { cssPx: size, probe: null, probeHeight: 0 };

  let cssPx = Math.max(1, REF_PX * size / probe.refHeight);
  const surf = makeSurface(Math.ceil(cssPx));
  let best = null;
  for (let i = 0; i < 16; i++) {
    const got = probeInk(surf, probe.cp, cssPx, family, style);
    if (!best || Math.abs(got - size) < Math.abs(best.got - size)) best = { cssPx, got };
    if (got === size) break;
    cssPx += (got > size ? -1 : 1) * Math.max(0.1, Math.abs(got - size) / 4);
    if (cssPx < 1) { cssPx = 1; break; }
  }
  return { cssPx: best.cssPx, probe: String.fromCodePoint(probe.cp), probeHeight: best.got };
}

// Same thresholded shape and advance?
function sameInk(a, b, threshold) {
  if (Math.round(a.adv) !== Math.round(b.adv)) return false;
  for (let i = 3; i < a.px.length; i += 4) {
    if ((a.px[i] >= threshold) !== (b.px[i] >= threshold)) return false;
  }
  return true;
}

const hasInk = (r, threshold) => {
  for (let i = 3; i < r.px.length; i += 4) if (r.px[i] >= threshold) return true;
  return false;
};

// Rasterize one codepoint. Returns null when the font has no glyph for it.
function rasterizeOne(surf, code, size, family, style, threshold) {
  const ch = String.fromCodePoint(code);
  const { ctx, w, h, originX, originY } = surf;

  // `withFont` false drops the family from the stack, leaving the generic to
  // draw whatever it would have drawn anyway.
  const draw = (fallback, withFont) => {
    ctx.clearRect(0, 0, w, h);
    ctx.font = withFont ? cssFont(size, family, style, fallback) : cssGeneric(size, fallback, style);
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#fff';
    ctx.fillText(ch, originX, originY);
    return { px: ctx.getImageData(0, 0, w, h).data, adv: ctx.measureText(ch).width };
  };

  const a = draw(FALLBACKS[0], true);

  // Present as soon as one pair differs; the second pair is only needed when the
  // first was inconclusive, so a glyph the font HAS usually costs two renders
  // rather than four.
  //
  // Whitespace draws nothing, so shapes cannot decide it — but the ADVANCE can,
  // and it has to: a space taken from a fallback carries that fallback's em,
  // which at the primary's scale can be twice the width of any real glyph in
  // the font. (Micro 5 has no ideographic space; letting the fallback's through
  // gave U+3000 an advance of 71px next to 34px kana.)
  // Whitespace draws nothing, so no comparison can say which font supplied it:
  // a full-width space is one em in every CJK font, so even the advance matches
  // whatever the fallback would have drawn. It is accepted rather than judged,
  // and rasterizeSet caps its advance afterwards — see there.
  if (hasInk(a, threshold)) {
    const differs = (fallback) => {
      const mine = fallback === FALLBACKS[0] ? a : draw(fallback, true);
      const theirs = draw(fallback, false);
      return !sameInk(mine, theirs, threshold);
    };
    if (!differs(FALLBACKS[0]) && !differs(FALLBACKS[1])) return null;
  }

  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      if (a.px[(py * w + px) * 4 + 3] < threshold) continue;
      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;
    }
  }
  if (maxX < 0) return { code, w: 0, h: 0, x: 0, y: 0, dx: Math.round(a.adv), bits: new Uint8Array(0) };

  const gw = maxX - minX + 1;
  const gh = maxY - minY + 1;
  const bits = new Uint8Array(gw * gh);
  for (let py = 0; py < gh; py++) {
    for (let px = 0; px < gw; px++) {
      bits[py * gw + px] = a.px[((minY + py) * w + (minX + px)) * 4 + 3] >= threshold ? 1 : 0;
    }
  }

  return {
    code,
    w: gw,
    h: gh,
    x: minX - originX,          // left bearing from the pen
    y: originY - (maxY + 1),    // baseline -> bitmap bottom (positive = above)
    dx: Math.round(a.adv),
    bits,
  };
}

/**
 * Rasterize a whole character set.
 *
 * @param {Object} opts
 *   family     - CSS family name from loadFont()
 *   size       - target CHARACTER HEIGHT in pixels (see measureFont)
 *   codepoints - sorted array of codepoints
 *   style      - { weight, italic }
 *   threshold  - alpha cutoff for 1bpp (1..255; 128 is a neutral default)
 *   onProgress - ({done, total}) called between chunks
 *   probeChar  - measure on this reference character (fallback fonts pass the
 *                primary's, so their glyphs come out the same size)
 *   sameEmAs   - CSS px to use when probeChar is unavailable here
 * @returns {Promise<{glyphs: Array, missing: Array, font: Object}>}
 *   font is { height, ascent, descent, cssPx, probe } — the line box measured
 *   from the glyphs that were actually produced.
 */
export async function rasterizeSet({
  family, size, codepoints, style = {}, threshold = 128, onProgress, probeChar = null, sameEmAs = 0,
} = {}) {
  const sizing = measureFont(family, size, style, codepoints, { probeChar, sameEmAs });
  // Glyphs are drawn at the CSS size that yields the requested character height.
  const surf = makeSurface(sizing.cssPx);
  const glyphs = [];
  const missing = [];

  // Yield to the event loop every chunk so a ten-thousand-glyph CJK set keeps
  // the progress bar alive instead of freezing the tab.
  const CHUNK = 200;
  for (let i = 0; i < codepoints.length; i++) {
    const g = rasterizeOne(surf, codepoints[i], sizing.cssPx, family, style, threshold);
    if (g) glyphs.push(g); else missing.push(codepoints[i]);
    if ((i + 1) % CHUNK === 0 || i === codepoints.length - 1) {
      onProgress?.({ done: i + 1, total: codepoints.length });
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  // A space is never wider than the widest character. Whitespace cannot be
  // presence-tested, so when the font has no glyph for it the advance comes
  // from whatever the browser fell back to — at THIS font's em, which for a
  // face whose em dwarfs its letters is absurd: Micro 5 at a 32px character
  // height gave U+3000 an advance of 71px next to 34px kana. Capping it keeps
  // the text proportionate without pretending to know who supplied it.
  const widest = glyphs.reduce((a, g) => (g.h && g.dx > a ? g.dx : a), 0);
  if (widest) for (const g of glyphs) { if (!g.h && g.dx > widest) g.dx = widest; }

  return { glyphs, missing, font: { ...sizing, ...lineBoxOf(glyphs) } };
}

/**
 * Which of `codepoints` this family actually draws.
 *
 * Deliberately skips measureFont: answering "does a glyph exist" needs no
 * scale, and measuring costs dozens of renders per family. Used to survey
 * fallback candidates, where the question is only which typeface could supply
 * the gap.
 */
export function hasGlyphs(family, style, codepoints, px = 32) {
  const surf = makeSurface(px);
  return codepoints.filter((cp) => {
    const g = rasterizeOne(surf, cp, px, family, style, 128);
    return !!g && (g.h > 0 || g.w === 0);
  });
}

/**
 * The line box of a glyph set: its furthest ink above and below the baseline.
 *
 * Derived from the glyphs rather than the family's declared metrics, so it is
 * exactly tall enough for this font's contents — no clipping, and no rows of
 * padding paid for in flash because the family reserves room for characters
 * this font does not carry. Exported because a font composed from several
 * typefaces has to be re-measured after the fills are merged in.
 *
 * (g.y is the baseline-to-bitmap-bottom distance, positive above the baseline.)
 */
export function lineBoxOf(glyphs) {
  let ascent = 0;
  let descent = 0;
  for (const g of glyphs) {
    if (!g.h) continue;
    ascent = Math.max(ascent, g.y + g.h);
    descent = Math.max(descent, -g.y);
  }
  ascent = Math.max(1, Math.ceil(ascent));
  descent = Math.max(0, Math.ceil(descent));
  return { ascent, descent, height: ascent + descent };
}
