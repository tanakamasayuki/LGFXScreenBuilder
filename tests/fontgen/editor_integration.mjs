#!/usr/bin/env node
// End-to-end check of the editor's generated-font flow (§8.7.7).
//
// Covers the part the standalone page cannot: that a generated font becomes a
// project recipe, that the recipe (and NOT the glyph bytes) is what gets
// saved, that Text can be assigned the font, and that the exported header
// actually carries the byte array and references it.
//
// Requires a Chromium (see page_smoke.mjs for the playwright setup).
//
//   PLAYWRIGHT_MODULE=... node tests/fontgen/editor_integration.mjs

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, normalize, dirname } from 'node:path';
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

console.log('generate a font from the editor:');
await page.click('.mode[data-mode="fonts"]');
await page.waitForSelector('#cf-add');
await page.click('#cf-add');
await page.waitForSelector('#cf-overlay:not([hidden])');

// Defaults: a CJK-capable face at a line height that stays legible at 1bpp.
check(await page.inputValue('#cf-family') === 'Noto Sans JP', 'the dialog defaults to Noto Sans JP');
check(await page.inputValue('#cf-size') === '32', 'the dialog defaults to a 32px line height');

// The dialog carries the live preview too, beside the controls it previews.
await page.waitForFunction(() => document.querySelector('#cf-live').height === 32, null, { timeout: 90000 });
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
await page.waitForFunction(() => document.querySelector('#cf-live').height === 16, null, { timeout: 90000 });
check(true, 'changing typeface and size updates the dialog preview');

// The dialog carries the same charset inspector as the standalone page: a
// preset must be inspectable as characters, not just as a count.
await page.evaluate(() => { document.querySelector('#cf-charmap-details').open = true; });
await page.waitForSelector('#cf-charmap .cm-block');
const dlgMap = await page.locator('#cf-charmap').innerText();
check(dlgMap.includes('Basic Latin (ASCII)'), 'the dialog lists the selected characters by block');
await page.selectOption('#cf-charmap-scope', 'units');
await page.waitForFunction(() => document.querySelector('#cf-charmap').innerText.includes('℃'));
check(true, 'a single preset can be inspected from the dialog');
await page.selectOption('#cf-charmap-scope', '');

// Default preset is ASCII; that is enough and keeps the run quick.
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
    pr.layout[scene.id][text.id] = { ...(pr.layout[scene.id][text.id] || {}), font: 'PanelFont', text: 'Hi' };
  });
  return { profile: prof.id, scene: scene.id, part: text.id };
});
check(!!assigned, `a Text part was assigned the font (${assigned && assigned.part})`);

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
