#!/usr/bin/env node
// Browser smoke test for the standalone font generator (docs/fontgen.html).
//
// The generator's rasterizer runs on FontFace + canvas, so it cannot be tested
// in Node — this drives the real page in headless Chromium and checks that a
// full run produces a plausible font: glyphs found, bytes emitted, a header
// with the licence notice, and a preview canvas with actual ink in it.
//
// It also asserts the two things most likely to rot silently: that ℃ (U+2103)
// comes out of the "units" preset (the gap in the imported Japanese-mini list
// that motivated that preset), and that the local-file licence warning is on
// the page.
//
// Requires a Chromium from `npx playwright install chromium`; skips loudly if
// playwright is not installed.
//
//   node tests/fontgen/page_smoke.mjs

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'docs');

// playwright is not a dependency of this repo (it would drag a ~170MB browser
// into every checkout), so it is resolved from wherever it happens to be
// installed: node_modules if someone added it, else $PLAYWRIGHT_MODULE.
let chromium;
for (const spec of [process.env.PLAYWRIGHT_MODULE, 'playwright'].filter(Boolean)) {
  try { ({ chromium } = await import(spec)); break; } catch { /* try the next */ }
}
if (!chromium) {
  console.log('SKIP: playwright not found. Install it anywhere, then:');
  console.log('  npx playwright install chromium');
  console.log('  PLAYWRIGHT_MODULE=/path/to/node_modules/playwright/index.mjs node tests/fontgen/page_smoke.mjs');
  process.exit(0);
}

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png',
};

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
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));

await page.goto(`${base}/fontgen.html`);
await page.waitForSelector('#fg-fontlist .fg-font');

console.log('page load:');
check(pageErrors.length === 0, `no uncaught errors${pageErrors.length ? ': ' + pageErrors.join('; ') : ''}`);
check(await page.locator('#fg-presets .fchip').count() >= 10, 'preset chips rendered');

// The local-file licence warning must be present — it is the whole reason
// local files are allowed at all.
await page.click('#fg-tab-local');
const warn = await page.locator('#fg-src-local .fg-warn').innerText();
check(/licen[cs]e|ライセンス/i.test(warn) && warn.length > 100, 'local-file licence warning is shown');
await page.click('#fg-tab-google');

// --- a real generation run ----------------------------------------------
// ASCII + units at 16px from a Latin font: small enough to be quick, and
// `units` is what carries ℃.
console.log('generate (ASCII + units, 16px):');
await page.evaluate(() => {
  document.querySelector('#fg-fontsearch').value = 'Roboto';
  document.querySelector('#fg-fontsearch').dispatchEvent(new Event('input'));
});
// Match on the name span only — the button also holds the licence badge.
await page.locator('#fg-fontlist .fg-font-name').filter({ hasText: /^Roboto$/ }).first().click();
await page.locator('#fg-presets .fchip', { hasText: /Units|単位/ }).first().click();

const counted = await page.locator('#fg-charcount').innerText();
check(/\d/.test(counted), `charset summary shows a count (${counted})`);

// A count alone cannot answer "which characters is this?" — the inspector must
// list them, and must be able to show one preset on its own.
console.log('charset inspector:');
await page.evaluate(() => { document.querySelector('#fg-charmap-details').open = true; });
await page.waitForSelector('#fg-charmap .cm-block');
const mapAll = await page.locator('#fg-charmap').innerText();
check(mapAll.includes('℃'), 'the selected set lists ℃ as an actual character');
check(mapAll.includes('Basic Latin (ASCII)'), 'characters are grouped by Unicode block');
check(/U\+0020/.test(mapAll), 'each block shows its codepoint range');

await page.selectOption('#fg-charmap-scope', 'kana');
await page.waitForFunction(() => document.querySelector('#fg-charmap').innerText.includes('Hiragana'));
const mapKana = await page.locator('#fg-charmap').innerText();
check(mapKana.includes('あ') && mapKana.includes('ア'), 'a single preset can be inspected on its own');
check(!mapKana.includes('Basic Latin (ASCII)'), 'inspecting one preset does not show the others');
await page.selectOption('#fg-charmap-scope', '');

await page.click('#fg-generate');
await page.waitForSelector('#fg-output:not([hidden])', { timeout: 120000 });

const res = await page.evaluate(() => ({
  bytes: document.querySelector('#fg-res-bytes').textContent,
  glyphs: Number(document.querySelector('#fg-res-glyphs').textContent.replace(/[^0-9]/g, '')),
  height: document.querySelector('#fg-res-height').textContent,
  code: document.querySelector('#fg-code').textContent,
  codeNote: document.querySelector('#fg-code-note').textContent,
  // ink in the preview canvas proves glyph bitmaps actually rendered
  ink: (() => {
    const cv = document.querySelector('#fg-preview');
    if (!cv.width || !cv.height) return 0;
    const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i + 1] > 200) n++;
    return n;
  })(),
}));

console.log(`  ${res.glyphs} glyphs, ${res.bytes}, line height ${res.height}, ${res.ink} preview pixels`);
// Roboto covers ASCII and the Latin-1 symbols but not the CJK-compatibility
// unit squares (㎜, ㎏, …), so a chunk of the `units` preset is legitimately
// absent — the run is healthy as long as most of it made it.
check(res.glyphs > 120, `glyph count is plausible (${res.glyphs})`);
check(res.height === '16px', `size is honoured as a 16px line height (${res.height})`);
check(res.ink > 50, `preview canvas has ink (${res.ink})`);
check(res.code.includes('lgfx::U8g2font'), 'header declares an lgfx::U8g2font');
check(res.code.includes('Apache License 2.0'), 'header carries the licence notice');
check(/Typeface\s*:\s*Roboto/.test(res.code), 'header names the typeface');
// The shown code must be the whole file, not a silently elided head — the
// closing guard is the last thing in the header, so its presence proves it.
check(/#endif \/\/ LGFXSB_FONT_TESTPANELFONT_H|#endif \/\/ LGFXSB_FONT_MYFONT_H/.test(res.code),
  'the code pane shows the complete header, down to the closing guard');
check(/\d/.test(res.codeNote), `the pane says how much is shown (${res.codeNote.trim()})`);

// Characters the typeface lacks must be reported, not silently dropped.
const notes = await page.locator('#fg-res-notes').innerText();
check(/\d/.test(notes), `missing characters are reported (${notes.trim().split('\n')[0] || '(none)'})`);

// Render one character at a time to confirm it really made it into the font.
const inkOf = (ch) => page.evaluate(async (c) => {
  const el = document.querySelector('#fg-sample');
  el.value = c;
  el.dispatchEvent(new Event('input'));
  await new Promise((r) => setTimeout(r, 50));
  const cv = document.querySelector('#fg-preview');
  if (!cv.width || !cv.height) return 0;
  const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
  let n = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i + 1] > 200) n++;
  return n;
}, ch);

// ° is the degree sign the `units` preset carries, and Roboto has it.
check(await inkOf('°') > 3, 'U+00B0 ° came through the units preset');
check(await inkOf('A') > 10, 'U+0041 A came through the ASCII preset');
// Regression: `I` and `l` are plain bars that look the same in almost every
// face, so a presence test based on "does it match the default font" drops
// them. They must survive.
check(await inkOf('I') > 5, 'U+0049 I survives (plain shapes are not mistaken for missing)');
check(await inkOf('l') > 5, 'U+006C l survives (plain shapes are not mistaken for missing)');
// ℃ is what the units preset exists for, but Roboto has no glyph for it — so
// the honest outcome here is "absent", which is what the notes above reported.
check(await inkOf('℃') === 0, 'U+2103 ℃ is absent from Roboto and was not faked');

// After a run the inspector doubles as the coverage report: absent characters
// are struck through in place, so "did my ℃ make it" is one glance.
const coverage = await page.evaluate(() => {
  const spans = [...document.querySelectorAll('#fg-charmap .cm-missing')].map((s) => s.textContent).join('');
  return { note: document.querySelector('#fg-charmap-note').textContent, struck: spans };
});
check(coverage.struck.includes('℃'), 'the inspector marks ℃ as missing from this typeface');
check(!coverage.struck.includes('A'), 'characters the typeface does have are not marked missing');
check(/\d/.test(coverage.note), `the inspector explains the marking (${coverage.note.trim().slice(0, 60)}…)`);

check(pageErrors.length === 0, `still no uncaught errors${pageErrors.length ? ': ' + pageErrors.join('; ') : ''}`);

await browser.close();
server.close();

if (failures) { console.error(`\nfontgen page smoke FAILED (${failures} issue(s)).`); process.exit(1); }
console.log('\nfontgen page smoke OK.');
