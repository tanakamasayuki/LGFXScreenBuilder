#!/usr/bin/env node
// End-to-end check of the editor's generated-font flow (§8.7.7).
//
// Covers the part the standalone page cannot: that a generated font becomes a
// project recipe, that the recipe (and NOT the glyph bytes) is what gets
// saved, that Text can be assigned and pixel-rendered with the font, and that
// the exported project header carries the byte array and references it. In CI
// that exact header is handed to the LovyanGFX host test, closing the browser →
// generated project → C++ renderer loop.
//
// Requires a Chromium (see page_smoke.mjs for the playwright setup).
//
//   PLAYWRIGHT_MODULE=... node tests/fontgen/editor_integration.mjs

import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { join, extname, normalize, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'docs');

let chromium;
for (const spec of [process.env.PLAYWRIGHT_MODULE, 'playwright'].filter(Boolean)) {
  try { ({ chromium } = await import(spec)); break; } catch { /* try the next */ }
}
if (!chromium) { console.log('SKIP: playwright not found (see tests/fontgen/page_smoke.mjs)'); process.exit(0); }

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
const server = createServer(async (req, res) => {
  try {
    const path = normalize(decodeURIComponent(req.url.split('?')[0]));
    if (path.includes('..')) { res.writeHead(403).end(); return; }
    const file = join(root, path === '/' ? 'index.html' : path);
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404).end('not found'); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

let failures = 0;
const check = (cond, msg) => { if (cond) console.log(`  ok   ${msg}`); else { console.error(`  FAIL ${msg}`); failures++; } };

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

// A fresh session: no autosaved project from an earlier run.
await page.goto(`${base}/index.html`);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForSelector('#view-design:not([hidden])');

// Selecting a preset whose bytes are not loaded yet must not flash a CSS/system
// font. Keep the previous exact bitmap visible until the requested model is
// ready, then switch the project state and canvas together.
console.log('cold font selection:');
await page.waitForSelector('#canvas-screen canvas.part.text[data-id="boot"]');
let releaseFont;
let sawFontRequest;
const fontGate = new Promise((r) => { releaseFont = r; });
const requestedFont = new Promise((r) => { sawFontRequest = r; });
await page.route('**/dist/data/FreeSans24pt7b.gfx', async (route) => {
  sawFontRequest();
  await fontGate;
  await route.continue();
});
await page.evaluate(async () => {
  const { store, mutate } = await import('./src/store.js');
  const { adoptFont } = await import('./src/model.js');
  mutate((st) => {
    adoptFont(st.project, 'FreeSans24pt7b');
    st.ui.sceneId = 'Boot';
    st.ui.selected = 'boot';
  });
});
const previousFont = await page.evaluate(async () => {
  const { store } = await import('./src/store.js');
  return store.project.profiles[0].layout.Boot.boot.font || null;
});
await page.selectOption('#props select[data-k="font"]', 'FreeSans24pt7b');
await requestedFont;
const whileLoading = await page.evaluate(async () => {
  const { store } = await import('./src/store.js');
  const part = store.project.profiles[0].layout.Boot.boot;
  const shown = document.querySelector('#canvas-screen .part.text[data-id="boot"]');
  return { committed: part.font, tag: shown?.tagName, text: shown?.textContent || '' };
});
check(whileLoading.committed === previousFont,
  `the project keeps the previous font until loading completes (${previousFont || 'Font0'})`);
check(whileLoading.tag === 'CANVAS' && !whileLoading.text,
  'no CSS/system-font text is shown during the load');
releaseFont();
await page.waitForFunction(async () => {
  const { store } = await import('./src/store.js');
  return store.project.profiles[0].layout.Boot.boot.font === 'FreeSans24pt7b' &&
    !!document.querySelector('#canvas-screen canvas.part.text[data-id="boot"]');
});
check(true, 'the exact bitmap replaces it after loading');
await page.unroute('**/dist/data/FreeSans24pt7b.gfx');
await page.evaluate(async () => {
  const { mutate } = await import('./src/store.js');
  const { removeFont } = await import('./src/model.js');
  mutate((st) => {
    removeFont(st.project, 'FreeSans24pt7b');
    st.ui.selected = null;
  });
});

console.log('generate a font from the editor:');
await page.click('.mode[data-mode="fonts"]');
await page.waitForSelector('#cf-add');
await page.click('#cf-add');
await page.waitForSelector('#cf-overlay:not([hidden])');

// Defaults: a CJK-capable face at the character height where legibility has
// already flattened but flash has not — 24px, not 32 (SPEC §8.7.7).
check(await page.inputValue('#cf-family') === 'Noto Sans JP', 'the dialog defaults to Noto Sans JP');
check(await page.inputValue('#cf-size') === '24', 'the dialog defaults to a 24px character height');

// The dialog carries the live preview too, beside the controls it previews.
// The canvas height is the DERIVED line box, so the settled state is detected
// from the status line, which reports the character height that was asked for.
const rendered = (px) => new RegExp(`(characters|文字) ${px}px`);
const settled = (px) => page.waitForFunction(
  (re) => new RegExp(re).test(document.querySelector('#cf-live-status').textContent),
  rendered(px).source, { timeout: 90000 });
await settled(24);
const dlgInk = await page.evaluate(() => {
  const cv = document.querySelector('#cf-live');
  const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
  let n = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i + 1] > 200) n++;
  return n;
});
check(dlgInk > 100, `the dialog's live preview drew glyphs (${dlgInk} px)`);

await page.fill('#cf-name', 'PanelFont');
await page.fill('#cf-size', '16');
await page.selectOption('#cf-family', 'Roboto');
await settled(16);
check(true, 'changing typeface and size updates the dialog preview');

// The dialog carries the same charset inspector as the standalone page: a
// preset must be inspectable as characters, not just as a count.
await page.evaluate(() => { document.querySelector('#cf-charmap-details').open = true; });
await page.waitForSelector('#cf-charmap .cm-block');
const dlgMap = await page.locator('#cf-charmap').innerText();
check(dlgMap.includes('Basic Latin (ASCII)'), 'the dialog lists the selected characters by block');
await page.selectOption('#cf-charmap-scope', 'symUnits');
await page.waitForFunction(() => document.querySelector('#cf-charmap').innerText.includes('℃'));
check(true, 'a single set can be inspected from the dialog');
await page.selectOption('#cf-charmap-scope', '');

// The picker must offer checkboxes for additive sets and ladders for han.
check(await page.locator('#cf-presets .cs-check').count() >= 10, 'the dialog renders additive sets as checkboxes');
check(await page.locator('#cf-presets .cs-tier').count() >= 5, 'the dialog renders per-language han tiers');

// Keep the run small: the Latin UI template drops the kanji the default carries.
await page.locator('#cf-presets .cs-templates .fchip').filter({ hasText: /Latin UI|英数UI/ }).first().click();

// Build once to discover Roboto's gaps, then accept the offered fallback. This
// makes the exported project exercise multi-source sizing and U+2103 as well.
await page.click('#cf-preview-btn');
await page.waitForFunction(() => !document.querySelector('#cf-fallback-apply').hidden, null, { timeout: 120000 });
await page.click('#cf-fallback-apply');
await page.waitForFunction(() => !document.querySelector('#cf-ok').disabled, null, { timeout: 120000 });
await page.click('#cf-ok');
// The dialog closes only after the font has actually been built and adopted.
await page.waitForFunction(() => document.getElementById('cf-overlay').hidden, null, { timeout: 120000 });

const listed = await page.locator('#cf-list').innerText();
check(/PanelFont/.test(listed), `the font is listed (${listed.replace(/\n/g, ' · ')})`);
check(/16px/.test(listed), 'the list shows the recipe size');

// --- the project stores the recipe, not the bytes ------------------------
console.log('project file:');
const saved = await page.evaluate(async () => {
  const { store } = await import('./src/store.js');
  const { serialize } = await import('./src/persist.js');
  return serialize(store.project);
});
const parsed = JSON.parse(saved);
const entry = parsed.fonts.find((f) => f.name === 'PanelFont');
check(!!entry, 'the project carries a PanelFont entry');
check(!!entry.custom && entry.custom.size === 16, 'the entry holds the recipe (size 16)');
check(entry.custom.source.family === 'Roboto', 'the recipe names the typeface');
check(entry.custom.fallback === 'auto', 'the recipe records the accepted fallback');
check(!/kFontData|0x[0-9a-f]{2}, 0x/.test(saved), 'the project file contains no glyph bytes');
check(saved.length < 200000, `the project file stayed small (${saved.length} bytes)`);

// --- assign it to a Text part and export ---------------------------------
console.log('export:');
const assigned = await page.evaluate(async () => {
  const { store, mutate } = await import('./src/store.js');
  const p = store.project;
  const prof = p.profiles[0];
  const scene = p.scenes[0];
  const text = scene.parts.find((x) => x.type === 'Text');
  if (!text) return null;
  mutate((st) => {
    const pr = st.project.profiles[0];
    pr.layout[scene.id] = pr.layout[scene.id] || {};
    pr.layout[scene.id][text.id] = {
      ...(pr.layout[scene.id][text.id] || {}), font: 'PanelFont', text: '25.6℃ Il1',
    };
  });
  return { profile: prof.id, scene: scene.id, part: text.id };
});
check(!!assigned, `a Text part was assigned the font (${assigned && assigned.part})`);

// The Design canvas must consume the cached neutral model, not fall back to a
// browser CSS font. A canvas with ink proves drawString rendered the embedded
// glyph bitmaps (including the fallback-sourced ℃).
await page.click('.mode[data-mode="design"]');
await page.waitForFunction((id) => {
  const cv = document.querySelector(`#canvas-screen canvas.part.text[data-id="${id}"]`);
  if (!cv) return false;
  const px = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
  for (let i = 3; i < px.length; i += 4) if (px[i]) return true;
  return false;
}, assigned.part);
const designPreview = await page.evaluate((id) => {
  const cv = document.querySelector(`#canvas-screen canvas.part.text[data-id="${id}"]`);
  const px = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
  let ink = 0;
  for (let i = 3; i < px.length; i += 4) if (px[i]) ink++;
  return { tag: cv.tagName, ink, w: cv.width, h: cv.height };
}, assigned.part);
check(designPreview.tag === 'CANVAS' && designPreview.ink > 30,
  `Design rendered the embedded font model (${designPreview.w}x${designPreview.h}, ${designPreview.ink} ink px)`);

const header = await page.evaluate(async () => {
  const { store } = await import('./src/store.js');
  const { generateHeader } = await import('./src/codegen.js');
  const { ensureFontData, fontDataMap } = await import('./src/fontgen/build.js');
  const { missing } = await ensureFontData(store.project);
  return {
    missing: missing.map((m) => m.name),
    src: generateHeader(store.project, { fontData: fontDataMap(store.project) }),
  };
});
check(header.missing.length === 0, `nothing failed to rebuild${header.missing.length ? ': ' + header.missing : ''}`);
check(header.src.includes('static const uint8_t kFontData_PanelFont['), 'the header emits the glyph byte array');
check(header.src.includes('lgfx::U8g2font kFont_PanelFont(kFontData_PanelFont)'), 'the header wraps it in an lgfx::U8g2font');
check(header.src.includes('&kFont_PanelFont'), 'the layout table references the generated font');
check(/Rasterized from: Roboto/.test(header.src), 'the header carries the attribution notice');
check(/Apache License 2\.0/.test(header.src), 'the header states the licence');
check(!header.src.includes('fonts::PanelFont'), 'it is not emitted as a library preset symbol');

// CI feeds this exact browser-generated project header to a real LovyanGFX host
// build. Local runs omit the env var and remain non-mutating.
if (process.env.LGFX_FONT_TOOL_E2E_HEADER) {
  const VERSION = await page.evaluate(async () => (await import('lgfx-font-tool')).VERSION);
  const marked = `// Browser-generated E2E fixture: lgfx-font-tool ${VERSION}\n` +
    `#define LGFX_FONT_TOOL_E2E_VERSION "${VERSION}"\n` + header.src;
  await writeFile(resolve(process.env.LGFX_FONT_TOOL_E2E_HEADER), marked);
  console.log(`  wrote C++ E2E header (${VERSION})`);
}

// A font enabled nowhere must not be emitted — that is the flash policy.
console.log('flash policy:');
const unused = await page.evaluate(async () => {
  const { store, mutate } = await import('./src/store.js');
  const { generateHeader } = await import('./src/codegen.js');
  const { fontDataMap } = await import('./src/fontgen/build.js');
  mutate((st) => { for (const p of st.project.profiles) p.fonts = (p.fonts || []).filter((n) => n !== 'PanelFont'); });
  return generateHeader(store.project, { fontData: fontDataMap(store.project) });
});
check(!unused.includes('kFontData_PanelFont'), 'a font disabled on every profile is not emitted');

check(errors.length === 0, `no uncaught errors${errors.length ? ': ' + errors.join('; ') : ''}`);

await browser.close();
server.close();

if (failures) { console.error(`\neditor integration FAILED (${failures} issue(s)).`); process.exit(1); }
console.log('\neditor integration OK.');
