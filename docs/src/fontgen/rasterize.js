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
// twice with two different fallbacks behind it. If the font supplies the glyph
// both renders are identical; if it does not, one falls back to serif and the
// other to monospace and they diverge.
//
// The tempting alternative — compare against the browser's default font and
// call a match "missing" — is wrong: plain shapes like `I` and `l` render
// identically in most faces, so it drops characters the font really has.
const FALLBACKS = ['serif', 'monospace'];

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
const cssFont = (size, family, { weight = 400, italic = false } = {}, fallback = null) =>
  `${italic ? 'italic ' : ''}${weight} ${size}px "${family}"${fallback ? `, ${fallback}` : ''}`;

// Raw line box of a family at a given CSS px size.
function boxAt(cssPx, family, style) {
  const { ctx } = makeSurface(cssPx);
  ctx.font = cssFont(cssPx, family, style);
  ctx.textBaseline = 'alphabetic';
  const m = ctx.measureText('Hgあ漢pqÅ');
  return {
    ascent: m.fontBoundingBoxAscent || m.actualBoundingBoxAscent || cssPx * 0.8,
    descent: m.fontBoundingBoxDescent || m.actualBoundingBoxDescent || cssPx * 0.2,
  };
}

/**
 * Resolve a requested LINE HEIGHT to the CSS px size that produces it, and
 * return the resulting whole-pixel metrics.
 *
 * The size field means line height, not em size, because that is what the
 * embedded-font world counts in: LovyanGFX's own `lgfxJapanGothic_16` is 16
 * pixels tall, and someone fitting three rows onto a 64px panel is budgeting
 * rows, not ems. A CSS `font-size: 16px` would instead give a ~19px line box
 * for most families, silently overflowing that budget.
 *
 * `height` is the line advance and `descent` how far it extends below the
 * baseline; encodeU8g2 derives the baseline from those two.
 */
export function measureFont(family, height, style = {}) {
  // One measurement at a large reference size gives the family's box ratio;
  // the scale from it lands within a pixel, and the search fixes the rest.
  const REF = 100;
  const ref = boxAt(REF, family, style);
  const ratio = (ref.ascent + ref.descent) / REF;
  let cssPx = Math.max(1, height / (ratio || 1));

  // Nudge until the rounded box matches the request, then keep the closest.
  let best = null;
  for (let i = 0; i < 24; i++) {
    const b = boxAt(cssPx, family, style);
    const a = Math.ceil(b.ascent), d = Math.ceil(b.descent);
    const got = a + d;
    if (!best || Math.abs(got - height) < Math.abs(best.got - height)) best = { cssPx, a, d, got };
    if (got === height) break;
    cssPx += (got > height ? -1 : 1) * Math.max(0.1, Math.abs(got - height) / 4);
    if (cssPx < 1) { cssPx = 1; break; }
  }

  // The line box is what the caller asked for even when no CSS size lands on
  // it exactly; the slack goes to the ascent so descenders stay intact.
  const descent = Math.min(best.d, Math.max(0, height - 1));
  return { cssPx: best.cssPx, ascent: height - descent, descent, height };
}

// Rasterize one codepoint. Returns null when the font has no glyph for it.
function rasterizeOne(surf, code, size, family, style, threshold) {
  const ch = String.fromCodePoint(code);
  const { ctx, w, h, originX, originY } = surf;

  const draw = (fallback) => {
    ctx.clearRect(0, 0, w, h);
    ctx.font = cssFont(size, family, style, fallback);
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#fff';
    ctx.fillText(ch, originX, originY);
    return { px: ctx.getImageData(0, 0, w, h).data, adv: ctx.measureText(ch).width };
  };

  const a = draw(FALLBACKS[0]);
  const b = draw(FALLBACKS[1]);
  if (Math.round(a.adv) !== Math.round(b.adv)) return null;
  for (let i = 3; i < a.px.length; i += 4) {
    if ((a.px[i] >= threshold) !== (b.px[i] >= threshold)) return null;
  }

  // Whitespace legitimately draws nothing: keep it as a zero-size glyph that
  // still advances the pen.
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
 *   size       - target LINE HEIGHT in pixels (see measureFont)
 *   codepoints - sorted array of codepoints
 *   style      - { weight, italic }
 *   threshold  - alpha cutoff for 1bpp (1..255; 128 is a neutral default)
 *   onProgress - ({done, total}) called between chunks
 * @returns {Promise<{glyphs: Array, missing: Array, font: Object}>}
 */
export async function rasterizeSet({
  family, size, codepoints, style = {}, threshold = 128, onProgress,
} = {}) {
  const font = measureFont(family, size, style);
  // Glyphs are drawn at the CSS size that yields the requested line height.
  const surf = makeSurface(font.cssPx);
  const glyphs = [];
  const missing = [];

  // Yield to the event loop every chunk so a ten-thousand-glyph CJK set keeps
  // the progress bar alive instead of freezing the tab.
  const CHUNK = 200;
  for (let i = 0; i < codepoints.length; i++) {
    const g = rasterizeOne(surf, codepoints[i], font.cssPx, family, style, threshold);
    if (g) glyphs.push(g); else missing.push(codepoints[i]);
    if ((i + 1) % CHUNK === 0 || i === codepoints.length - 1) {
      onProgress?.({ done: i + 1, total: codepoints.length });
      await new Promise((r) => setTimeout(r, 0));
    }
  }
  return { glyphs, missing, font };
}
