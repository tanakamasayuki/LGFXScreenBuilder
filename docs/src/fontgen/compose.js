// Typeface in, glyph set out (§8.7.7) — the step both entry points share.
//
// Beyond loading and rasterizing, this owns FALLBACK: when the chosen typeface
// has no glyph for a character, the character can be taken from another font
// rather than dropped. That matters because the alternative is a hole in the
// output — Google's Noto Sans JP, for instance, carries no Greek at all, so a
// Japanese UI that shows Ω for ohms silently loses it.
//
// Three things make fallback safe rather than merely convenient:
//
//   * **It is opt-in.** Nothing mixes typefaces behind your back; the UI
//     detects the gap, names it, and offers to fill it.
//   * **Sizes match.** A filled-in glyph is measured on the SAME reference
//     character as the primary (rasterize.js `probeChar`), so it comes out the
//     same height instead of visibly larger or smaller.
//   * **Every source is recorded.** The result carries one entry per typeface
//     used, with its author and licence, because the generated font is then a
//     derived work of all of them and OFL requires the notice to travel.
import { loadGoogleFont, findFont, FALLBACK_CHAIN } from './googlefonts.js';
import { loadFont, unloadFont, rasterizeSet, lineBoxOf } from './rasterize.js';

// 'auto' walks the curated chain; a family name pins one font; null disables it.
export const FALLBACK_AUTO = 'auto';

// Load a typeface for a set of codepoints; returns { family, faces, meta }.
async function acquire(source, codepoints, style) {
  if (source.kind === 'google') {
    const meta = findFont(source.family);
    const g = await loadGoogleFont(source.family, codepoints, style);
    return {
      family: g.family,
      faces: g.faces,
      meta: {
        family: source.family, by: meta?.by, license: meta?.license,
        origin: `Google Fonts (${g.subsets}/${g.of} subsets)`,
      },
    };
  }
  if (!source.buffer) throw new Error('the local font file is not available in this session');
  const f = await loadFont(source.buffer);
  return {
    family: f.family,
    faces: [f.face],
    meta: { family: source.family, by: null, license: null, origin: 'local file supplied by the user' },
  };
}

/**
 * Build the glyph set for a font.
 *
 * @param {Object} o
 *   source     - { kind: 'google'|'local', family, buffer }
 *   fallback   - null | 'auto' | family name
 *   size       - character height in px
 *   codepoints - what to include (BMP only; the caller splits)
 *   style      - { weight, italic }
 *   threshold  - 1bpp alpha cutoff
 *   onProgress - ({ done, total, family }) during rasterizing
 *
 * @returns {Promise<{glyphs, missing, font, sources}>}
 *   sources[0] is always the primary; later entries are fills, each with the
 *   characters it supplied.
 */
export async function composeFont({
  source, fallback = null, size, codepoints, style = {}, threshold = 128, onProgress,
} = {}) {
  const open = [];
  try {
    const primary = await acquire(source, codepoints, style);
    open.push(...primary.faces);
    const first = await rasterizeSet({
      family: primary.family, size, codepoints, style, threshold,
      onProgress: (p) => onProgress?.({ ...p, family: source.family }),
    });

    const glyphs = [...first.glyphs];
    let missing = first.missing;
    const sources = [{ ...primary.meta, count: first.glyphs.length, chars: null }];

    if (missing.length && fallback) {
      // 'auto' tries the curated chain; anything else pins one family. The
      // primary is never its own fallback.
      const chain = (fallback === FALLBACK_AUTO ? FALLBACK_CHAIN : [fallback])
        .filter((f) => f !== source.family);

      for (const family of chain) {
        if (!missing.length) break;
        try {
          const fb = await acquire({ kind: 'google', family }, missing, style);
          open.push(...fb.faces);
          const got = await rasterizeSet({
            family: fb.family, size, codepoints: missing, style, threshold,
            // Match the primary's reference character so the filled-in glyphs
            // are the same height as the rest of the font.
            probeChar: first.font.probe,
            onProgress: (p) => onProgress?.({ ...p, family }),
          });
          if (!got.glyphs.length) continue;
          glyphs.push(...got.glyphs);
          sources.push({
            ...fb.meta,
            count: got.glyphs.length,
            chars: got.glyphs.map((g) => String.fromCodePoint(g.code)).join(''),
          });
          missing = got.missing;
        } catch {
          // A family that will not load is simply not a usable fallback; the
          // characters stay missing and are reported as such.
        }
      }
    }

    glyphs.sort((a, b) => a.code - b.code);
    // The line box has to be re-measured over the merged set: a filled-in glyph
    // can sit higher or lower than anything the primary contributed.
    return { glyphs, missing, font: { ...first.font, ...lineBoxOf(glyphs) }, sources };
  } finally {
    for (const f of open) unloadFont(f);
  }
}

/**
 * Which of `missing` the curated chain could supply, without committing to it.
 * Used to offer the fill rather than perform it — the point of the offer is
 * that it names what would change.
 *
 * @returns {Promise<{family: string, chars: string}[]>}
 */
export async function probeFallback(missing, style = {}, exclude = null) {
  const out = [];
  let left = [...missing];
  for (const family of FALLBACK_CHAIN) {
    if (!left.length) break;
    if (family === exclude) continue;
    let faces = [];
    try {
      const fb = await acquire({ kind: 'google', family }, left, style);
      faces = fb.faces;
      // A tiny size: this only asks "does a glyph exist", not what it looks like.
      const got = await rasterizeSet({ family: fb.family, size: 16, codepoints: left, style });
      if (got.glyphs.length) {
        out.push({ family, chars: got.glyphs.map((g) => String.fromCodePoint(g.code)).join('') });
        left = got.missing;
      }
    } catch {
      /* not a usable fallback */
    } finally {
      for (const f of faces) unloadFont(f);
    }
  }
  return out;
}
