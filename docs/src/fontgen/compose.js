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
import { loadFont, unloadFont, rasterizeSet, lineBoxOf, hasGlyphs } from './rasterize.js';

// 'auto' walks the curated chain; a family name pins one font; null disables it.
export const FALLBACK_AUTO = 'auto';

// Identifies a primary rasterization, so accepting a fallback offer can reuse
// the pass already done instead of redoing the whole set. Cheap FNV-1a over the
// codepoints plus the settings that change how a glyph is drawn.
function primaryKey(source, size, threshold, style, codepoints) {
  let h = 0x811c9dc5;
  for (const c of codepoints) { h ^= c; h = Math.imul(h, 0x01000193); }
  return [source.kind, source.family, size, threshold, style.weight, style.italic,
    codepoints.length, h >>> 0].join('|');
}

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
 *   primed     - a previous run's `primed`, to skip re-rasterizing the primary
 *   chain      - families to try, overriding the automatic order (the offer
 *                already knows which ones help)
 *
 * @returns {Promise<{glyphs, missing, font, sources}>}
 *   sources[0] is always the primary; later entries are fills, each with the
 *   characters it supplied.
 */
export async function composeFont({
  source, fallback = null, size, codepoints, style = {}, threshold = 128, onProgress,
  primed = null, chain: plan = null,
} = {}) {
  const open = [];
  const key = primaryKey(source, size, threshold, style, codepoints);
  try {
    // Accepting a fallback offer changes nothing about the primary, so its
    // glyphs are reused rather than rasterized a second time. For a few
    // thousand kanji that is the difference between one pass and two.
    let first = primed && primed.key === key ? primed.result : null;
    if (!first) {
      const primary = await acquire(source, codepoints, style);
      open.push(...primary.faces);
      first = await rasterizeSet({
        family: primary.family, size, codepoints, style, threshold,
        onProgress: (p) => onProgress?.({ ...p, family: source.family }),
      });
      first = { ...first, meta: primary.meta };
    }

    const glyphs = [...first.glyphs];
    const skipped = [];
    let missing = first.missing;
    const sources = [{ ...first.meta, count: first.glyphs.length, chars: null }];

    if (missing.length && fallback) {
      // 'auto' tries the curated chain; anything else pins one family. The
      // primary is never its own fallback.
      //
      // `plan` reorders that chain rather than replacing it. The offer already
      // established which families actually supply the gap, and no family covers
      // all of it (Noto Sans has Ω but not ←, Symbols 2 has ▲ but not ℃), so
      // trying those first means the loop below usually finishes before the
      // others are ever fetched — the saving the plan exists for.
      //
      // Replacing the chain outright was wrong, because a plan is a snapshot of
      // ONE gap and the gap moves: with the fallback already on, changing the
      // character set to Korean left the plan at [Noto Sans, Noto Sans JP] and
      // 2,350 hangul were reported missing while Noto Sans KR, three lines down
      // the chain, was never asked. A plan may now only make the answer arrive
      // sooner, never make it smaller.
      const rest = fallback === FALLBACK_AUTO ? FALLBACK_CHAIN : [fallback];
      const chain = [...(plan || []), ...rest]
        .filter((f, i, a) => f !== source.family && a.indexOf(f) === i);

      for (const family of chain) {
        if (!missing.length) break;
        try {
          // Ask for the reference character too: subsets are fetched by
          // intersection, so requesting only the missing characters can leave
          // the probe's subset unloaded — and then the font gets scaled by
          // whatever else happened to be in the set.
          const probeCp = first.font.probe ? first.font.probe.codePointAt(0) : null;
          const want = probeCp ? [...new Set([...missing, probeCp])].sort((x, y) => x - y) : missing;
          const fb = await acquire({ kind: 'google', family }, want, style);
          open.push(...fb.faces);
          const got = await rasterizeSet({
            family: fb.family, size, codepoints: missing, style, threshold,
            // Match the primary's reference character so the filled-in glyphs
            // are the same height as the rest of the font; if this family has
            // no such character, match its em instead.
            probeChar: first.font.probe,
            sameEmAs: first.font.cssPx,
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
        } catch (e) {
          // A family that will not load is simply not a usable fallback and the
          // characters stay missing — but swallowing the reason hides real bugs,
          // so it is kept and surfaced with the result.
          skipped.push({ family, reason: e.message });
        }
      }
    }

    glyphs.sort((a, b) => a.code - b.code);
    // The line box has to be re-measured over the merged set: a filled-in glyph
    // can sit higher or lower than anything the primary contributed.
    if (skipped.length) console.warn('[lgfxsb] fallback skipped:', skipped);
    return {
      glyphs, missing, font: { ...first.font, ...lineBoxOf(glyphs) }, sources, skippedFallbacks: skipped,
      // Hand the primary pass back so a follow-up run can skip it.
      primed: { key, result: first },
    };
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
      // Existence only — no measuring, no scaling. The offer just needs to know
      // which typeface could supply the gap; the real pass happens if accepted.
      const found = hasGlyphs(fb.family, style, left);
      if (found.length) {
        out.push({ family, chars: found.map((c) => String.fromCodePoint(c)).join('') });
        const got = new Set(found);
        left = left.filter((c) => !got.has(c));
      }
    } catch {
      /* not a usable fallback */
    } finally {
      for (const f of faces) unloadFont(f);
    }
  }
  return out;
}
