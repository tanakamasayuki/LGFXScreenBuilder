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
import { loadGoogleFont } from './googlefonts.js';
import { codepointsOf } from './charsets.js';
import {
  createBitmap, drawString, generateFont, loadTtf, measureText, unloadTtf,
} from 'lgfx-font-tool';

/** Draw a neutral LGFXFontTool model with the pixel-exact LovyanGFX renderer. */
export function drawModel(canvas, model, text, scale = 1, colors = {}) {
  const m = measureText(model, text);
  const w = Math.max(1, m.width), h = Math.max(1, m.height);
  const bmp = createBitmap(w, h, 1);
  drawString(bmp, model, text, 0, 0);
  canvas.width = w * scale;
  canvas.height = h * scale;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = colors.bg || '#11191d';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = colors.fg || '#7fe3a0';
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (bmp.data[y * bmp.stride + (x >> 3)] & (0x80 >> (x & 7))) {
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  }
  return [...text].filter((ch) => model.glyphs.has(ch.codePointAt(0))).length;
}

/**
 * Draw glyphs onto a canvas as the panel would, 1 device pixel per glyph pixel
 * (times `scale`).
 * @returns the number of sample characters that had a glyph
 */
export function drawGlyphs(canvas, glyphs, font, text, scale = 1, colors = {}) {
  const have = new Map(glyphs.map((g) => [g.code, g]));
  const allowed = colors.allowed || null;

  // A character that will not be in the generated font is drawn as a crossed
  // box rather than skipped. Silently closing the gap is the worst option: the
  // line still reads as a sentence, so nothing tells you a character is gone.
  // Two reasons, two colours: red = this typeface has no such glyph, amber =
  // the glyph exists but the character is outside the selected set.
  const cells = [...text].map((ch) => {
    const cp = ch.codePointAt(0);
    const g = have.get(cp) || null;
    if (!g) return { g: null, why: 'missing' };
    if (allowed && !allowed.has(cp)) return { g: null, why: 'excluded' };
    return { g, why: null };
  });

  const tofuW = Math.max(4, Math.round(font.height * 0.5));
  const widthOf = (c) => (c.g ? c.g.dx : tofuW + 1);

  const ctx = canvas.getContext('2d');
  canvas.width = Math.max(1, cells.reduce((a, g) => a + widthOf(g), 0)) * scale;
  canvas.height = Math.max(1, font.height) * scale;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = colors.bg || '#11191d';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const fg = colors.fg || '#7fe3a0';
  const COLOR = { missing: colors.missing || '#ff6b6b', excluded: colors.excluded || '#e8a33d' };
  const baseline = font.height - font.descent;
  let pen = 0;
  let drawn = 0;

  for (const cell of cells) {
    const g = cell.g;
    if (!g) {
      // Box outline plus a diagonal cross, one device pixel thick at any scale.
      const x0 = pen * scale;
      const y0 = Math.round(font.height * 0.08) * scale;
      const w = tofuW * scale;
      const h = Math.round(font.height * 0.84) * scale;
      ctx.strokeStyle = COLOR[cell.why];
      ctx.lineWidth = Math.max(1, scale);
      ctx.strokeRect(x0 + ctx.lineWidth / 2, y0 + ctx.lineWidth / 2, w - ctx.lineWidth, h - ctx.lineWidth);
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x0 + w, y0 + h);
      ctx.moveTo(x0 + w, y0);
      ctx.lineTo(x0, y0 + h);
      ctx.stroke();
      pen += widthOf(cell);
      continue;
    }
    ctx.fillStyle = fg;
    const top = baseline - g.y - g.h; // inverse of the decoder's yoffset
    for (let py = 0; py < g.h; py++) {
      for (let px = 0; px < g.w; px++) {
        if (g.bits[py * g.w + px]) ctx.fillRect((pen + g.x + px) * scale, (top + py) * scale, scale, scale);
      }
    }
    pen += g.dx;
    drawn++;
  }
  return drawn;
}

// Loaded typefaces, keyed by what identifies them. Kept across refreshes so
// dragging the size field does not re-fetch the font on every keystroke; the
// Google subsets a sample string needs are small, and the cache is bounded.
const LOADED = new Map();
const MAX_LOADED = 8;

async function acquireFont({ kind, family, weight, italic, localBuffer, codepoints }) {
  const key = `${kind}|${family}|${weight}|${italic}`;
  const hit = LOADED.get(key);

  if (kind === 'google') {
    // Widen an existing load rather than reusing it as-is: the sample changes,
    // and a Google CJK family is ~120 subsets, so the subsets fetched for one
    // sample rarely cover the next. Reusing the partial font would report the
    // new characters as missing from the typeface, which is simply false.
    const g = await loadGoogleFont(family, codepoints, { weight, italic, into: hit?.google });
    const entry = {
      cssFamily: g.family,
      faces: [...(hit?.faces || []), ...g.faces],
      google: { family: g.family, loaded: g.loaded },
      buffer: null,
    };
    LOADED.delete(key);
    LOADED.set(key, entry);
    evict();
    return entry;
  }

  if (hit && hit.buffer === localBuffer) return hit;
  if (!localBuffer) throw new Error('no font file');
  const f = await loadTtf(localBuffer);
  const entry = { cssFamily: f.family, faces: [f.face], buffer: localBuffer };
  LOADED.set(key, entry);
  evict();
  return entry;
}

// Drop the least recently used entry's FontFaces so the document does not grow
// a pile of dead faces over a long session.
function evict() {
  while (LOADED.size > MAX_LOADED) {
    const [oldKey, old] = LOADED.entries().next().value;
    for (const f of old.faces) unloadTtf(f);
    LOADED.delete(oldKey);
  }
}

// A representative sample drawn from what is actually selected. Falling back to
// a fixed string would preview characters the font will not contain, which is
// exactly the confusion this avoids.
export function autoSample(codepoints) {
  const have = new Set(codepoints);
  const candidates = ['Hello 25.6\u2103', '\u3042\u30a2\u6f22\u5b57', '12:34', 'ABC abc 0123', '\uac00\ub098\ub2e4'];
  const fits = candidates.filter((s) => [...s].every((c) => have.has(c.codePointAt(0))));
  if (fits.length) return fits.join('  ');
  // Nothing canonical fits: show the start of the selection itself.
  return codepoints.slice(0, 16).map((c) => String.fromCodePoint(c)).join('');
}

/**
 * A preview that follows the controls.
 *
 * @param {Object} o
 *   canvas   - target <canvas>
 *   statusEl - element for progress / error text (optional)
 *   settings - () => { kind, family, weight, italic, size, threshold, localBuffer,
 *                      sample, scale, allowed }  (allowed: Set of selected codepoints)
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
    // Characters outside the current character set would be drawn from the
    // typeface but never reach the generated font, so say so rather than
    // showing a preview the output cannot match.
    const outside = s.allowed ? cps.filter((c) => !s.allowed.has(c)) : [];
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
      const made = await generateFont({
        family: font.cssFamily,
        px: s.size,
        codepoints: cps,
        style: { weight: s.weight, italic: s.italic },
        threshold: s.threshold,
      });
      if (mine !== generation) return;
      const drawn = drawModel(canvas, made.font, text, s.scale || 1);
      // Both numbers matter: the character height is what was asked for, the
      // line height is what it costs per row on the panel.
      const notes = [t('pv.ok', {
        c: made.font.meta.format?.gen?.probeHeight || s.size,
        h: made.font.ascent + made.font.descent,
        w: canvas.width / (s.scale || 1), n: drawn,
      })];
      if (made.missing.length) {
        notes.push(t('pv.someMissing', {
          n: made.missing.length, sample: made.missing.slice(0, 8).map((c) => String.fromCodePoint(c)).join(''),
        }));
      }
      if (outside.length) {
        notes.push(t('pv.notSelected', {
          n: outside.length, sample: outside.slice(0, 8).map((c) => String.fromCodePoint(c)).join(''),
        }));
      }
      say(notes.join('  '), outside.length > 0);
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
