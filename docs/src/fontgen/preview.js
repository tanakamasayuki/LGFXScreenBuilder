// Glyph preview for the font generator (§8.7.7).
//
// Two jobs, one renderer:
//
//   drawGlyphs()        paint already-generated glyphs (the result preview)
//   createLivePreview() keep a preview in step with the typeface/size controls
//
// The live one exists because typeface and size are exactly the settings you
// cannot judge from numbers — a 16px line height looks fine in the field and
// unreadable on the panel — and a preview parked below the Generate button is
// too far from those controls to adjust against. It rasterizes ONLY the sample
// string, so it costs a handful of glyphs no matter how large the character set
// is, and it goes through the same rasterizer as the real run: what it shows is
// what the panel gets.
import { loadFont, unloadFont, rasterizeSet } from './rasterize.js';
import { loadGoogleFont } from './googlefonts.js';
import { codepointsOf } from './charsets.js';

/**
 * Draw glyphs onto a canvas as the panel would, 1 device pixel per glyph pixel
 * (times `scale`).
 * @returns the number of sample characters that had a glyph
 */
export function drawGlyphs(canvas, glyphs, font, text, scale = 1, colors = {}) {
  const have = new Map(glyphs.map((g) => [g.code, g]));
  const chars = [...text].map((c) => have.get(c.codePointAt(0))).filter(Boolean);
  const ctx = canvas.getContext('2d');
  canvas.width = Math.max(1, chars.reduce((a, g) => a + g.dx, 0)) * scale;
  canvas.height = Math.max(1, font.height) * scale;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = colors.bg || '#11191d';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = colors.fg || '#7fe3a0';
  const baseline = font.height - font.descent;
  let pen = 0;
  for (const g of chars) {
    const top = baseline - g.y - g.h; // inverse of the decoder's yoffset
    for (let py = 0; py < g.h; py++) {
      for (let px = 0; px < g.w; px++) {
        if (g.bits[py * g.w + px]) ctx.fillRect((pen + g.x + px) * scale, (top + py) * scale, scale, scale);
      }
    }
    pen += g.dx;
  }
  return chars.length;
}

// Loaded typefaces, keyed by what identifies them. Kept across refreshes so
// dragging the size field does not re-fetch the font on every keystroke; the
// Google subsets a sample string needs are small, and the cache is bounded.
const LOADED = new Map();
const MAX_LOADED = 8;

async function acquireFont({ kind, family, weight, italic, localBuffer, codepoints }) {
  const key = `${kind}|${family}|${weight}|${italic}`;
  const hit = LOADED.get(key);
  if (hit && hit.buffer === localBuffer) return hit;

  let entry;
  if (kind === 'google') {
    const g = await loadGoogleFont(family, codepoints, { weight, italic });
    entry = { cssFamily: g.family, faces: g.faces, buffer: localBuffer };
  } else {
    if (!localBuffer) throw new Error('no font file');
    const f = await loadFont(localBuffer);
    entry = { cssFamily: f.family, faces: [f.face], buffer: localBuffer };
  }
  // Evict the oldest, dropping its FontFaces so the document does not grow a
  // pile of dead faces over a long session.
  if (LOADED.size >= MAX_LOADED) {
    const [oldKey, old] = LOADED.entries().next().value;
    for (const f of old.faces) unloadFont(f);
    LOADED.delete(oldKey);
  }
  LOADED.set(key, entry);
  return entry;
}

/**
 * A preview that follows the controls.
 *
 * @param {Object} o
 *   canvas   - target <canvas>
 *   statusEl - element for progress / error text (optional)
 *   settings - () => { kind, family, weight, italic, size, threshold, localBuffer, sample, scale }
 *   t        - translator, for the status line
 */
export function createLivePreview({ canvas, statusEl, settings, t }) {
  let timer = null;
  let generation = 0;

  const say = (msg, err = false) => {
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.classList.toggle('err', err);
  };

  async function run() {
    // Every refresh takes a ticket; a slow font fetch that finishes after a
    // newer request must not paint over the newer result.
    const mine = ++generation;
    const s = settings();
    const text = s.sample || '';
    const cps = [...new Set(codepointsOf(text))].filter((c) => c >= 0x20 && c <= 0xffff).sort((a, b) => a - b);
    if (!cps.length || (s.kind === 'local' && !s.localBuffer)) {
      canvas.width = 1;
      canvas.height = 1;
      say('');
      return;
    }
    try {
      say(t('pv.loading'));
      const font = await acquireFont({ ...s, codepoints: cps });
      if (mine !== generation) return;
      const { glyphs, missing, font: metrics } = await rasterizeSet({
        family: font.cssFamily,
        size: s.size,
        codepoints: cps,
        style: { weight: s.weight, italic: s.italic },
        threshold: s.threshold,
      });
      if (mine !== generation) return;
      const drawn = drawGlyphs(canvas, glyphs, metrics, text, s.scale || 1);
      say(missing.length
        ? t('pv.someMissing', { n: missing.length, sample: missing.slice(0, 8).map((c) => String.fromCodePoint(c)).join('') })
        : t('pv.ok', { h: metrics.height, w: canvas.width / (s.scale || 1), n: drawn }));
    } catch (e) {
      if (mine !== generation) return;
      canvas.width = 1;
      canvas.height = 1;
      say(e.message, true);
    }
  }

  return {
    // Coalesce keystrokes: dragging the size field should fetch once, not once
    // per digit.
    refresh(delay = 250) {
      clearTimeout(timer);
      timer = setTimeout(run, delay);
    },
    refreshNow: run,
  };
}
