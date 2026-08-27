#!/usr/bin/env node
// Generates FormatsScreen.h: one project, four custom fonts, one per output
// format (SPEC §8.7.7).
//
// This exists to cover the part the browser tests cannot reach cheaply. The
// editor's flow rasterizes a typeface through canvas and needs Chromium; what
// has to be proved on a real device is the OTHER half — that codegen emits each
// format correctly, that the run-time formats (BFF / VLW) load and draw, and
// that they keep working when the renderer switches between them per part.
//
// So the glyphs come from a font LovyanGFX already ships, encoded four ways by
// the same library the editor uses. No browser, no network.
//
//   node tests/build_font_formats/gen.mjs
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { generateHeader } from '../../docs/src/codegen.js';

const here = dirname(fileURLToPath(import.meta.url));
const requireFromDocs = createRequire(new URL('../../docs/package.json', import.meta.url));
const L = await import(pathToFileURL(requireFromDocs.resolve('lgfx-font-tool')).href);

// Ramp glyphs would prove anti-aliasing most directly, but they are not text.
// A real typeface at a real size is what the device will actually draw, and its
// diagonals are where the coverage levels show up.
const SAMPLE = 'AVWXZ';
const base = await L.loadFont('lgfxJapanGothic_16');
const sub = L.subset(base, SAMPLE);

// The bundled font is 1bpp, so its coverage is only ever 0 or 255 and encoding
// it to 2/4/8bpp would round-trip a binary image — proving the plumbing but not
// the anti-aliasing. Softening it gives genuine intermediate coverage from real
// glyph shapes, which is what the device test needs, and needs no browser
// rasterizer to produce. The result is deliberately blurry: it is a test
// fixture for coverage handling, not a specimen of type quality.
function softened(font) {
  const glyphs = new Map();
  for (const [cp, g] of font.glyphs) {
    const { width: w, height: h } = g.bitmap;
    const out = L.createBitmap(w, h, 8);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let sum = 0, n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const sx = x + dx, sy = y + dy;
            if (sx < 0 || sy < 0 || sx >= w || sy >= h) { n++; continue; }
            sum += L.getPixel(g.bitmap, sx, sy) ? 255 : 0;
            n++;
          }
        }
        L.setPixel(out, x, y, Math.round(sum / n));
      }
    }
    glyphs.set(cp, { ...g, bitmap: out });
  }
  return L.createFont({
    familyName: font.familyName, styleName: font.styleName,
    ascent: font.ascent, descent: font.descent, lineHeight: font.lineHeight, glyphs,
  });
}
const softSub = softened(sub);

const FORMATS = [
  { name: 'FmtU8g2', format: 'u8g2', bpp: 1 },
  { name: 'FmtGfx', format: 'gfx', bpp: 1 },
  { name: 'FmtBff2', format: 'bff', bpp: 2 },
  { name: 'FmtBff4', format: 'bff', bpp: 4 },
  { name: 'FmtVlw', format: 'vlw', bpp: 8 },
];

const fontData = new Map();
for (const f of FORMATS) {
  // 1bpp formats must take the binary source: encoding softened coverage into
  // u8g2 or GFXfont would be rejected outright (both refuse a bpp != 1 model).
  const src = f.bpp > 1 ? softSub : sub;
  const data = L.encode(src, { format: f.format, dropInvalid: true, ...(f.format === 'bff' ? { bpp: f.bpp } : {}) });
  fontData.set(f.name, {
    data,
    format: f.format,
    bpp: f.bpp,
    source: { family: 'lgfxJapanGothic_16 (bundled with LovyanGFX)', license: { name: 'M+ / IPA derived — see LovyanGFX' } },
    sources: null,
    charset: { presets: [], codepoints: [...sub.glyphs.keys()] },
    stats: {
      height: sub.ascent + sub.descent, ascent: sub.ascent, descent: sub.descent,
      glyphCount: sub.glyphs.size, bytes: data.length,
    },
  });
  console.log(`${f.name}: ${f.format} ${f.bpp}bpp, ${data.length} bytes`);
}

const parts = FORMATS.map((f, i) => ({
  id: f.name, type: 'Text',
  // One Text per format, stacked, each pinned to its own font. Drawing them in
  // one scene is the point: the renderer has to switch between a flash-resident
  // font and a run-time one on consecutive parts.
  x: 4, y: 4 + i * 20, datum: 'top_left', size: 1, color: '#ffffff', font: f.name, text: SAMPLE,
}));

const project = {
  formatVersion: 1,
  name: 'FormatsScreen',
  targetLibrary: 'LovyanGFX',
  // Deliberately NOT black. LovyanGFX's base color defaults to black, so a
  // black background would make the anti-aliasing blend correct by accident and
  // the halo check below would prove nothing.
  background: '#1e2a30',
  profiles: [{
    id: 'Host', w: 320, h: 240, rotation: 0,
    fonts: FORMATS.map((f) => f.name),
    layout: { Main: Object.fromEntries(parts.map((p) => [p.id, p])) },
  }],
  scenes: [{ id: 'Main', parts: FORMATS.map((f) => ({ id: f.name, type: 'Text' })) }],
  fonts: FORMATS.map((f) => ({ name: f.name, custom: { format: f.format, bpp: f.bpp, size: 16, sets: ['ascii'] } })),
  assets: [],
};

const header = generateHeader(project, { fontData });
writeFileSync(join(here, 'FormatsScreen.h'), header);
console.log(`wrote FormatsScreen.h (${header.length} bytes)`);
