#!/usr/bin/env node
// Browser smoke test for the standalone font generator (docs/fontgen.html).
//
// The generator's rasterizer runs on FontFace + canvas, so it cannot be tested
// in Node — this drives the real page in headless Chromium and checks that a
// full run produces a plausible font: glyphs found, bytes emitted, a header
// with the licence notice, and a preview canvas with actual ink in it.
//
// It also asserts what is most likely to rot silently: that the character-set
// picker offers checkboxes for additive sets and ladders for the per-language
// han tiers, that the inspector lists real characters, that ℃ (U+2103) is both
// selectable and honestly reported as absent from a typeface that lacks it, and
// that the local-file licence warning is on the page.
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
check(await page.locator('#fg-presets .cs-check').count() >= 10, 'additive sets render as checkboxes');
check(await page.locator('#fg-presets .cs-tier').count() >= 5, 'per-language han tiers render as ladders');
check(await page.locator('#fg-presets .cs-templates .fchip').count() >= 5, 'templates are offered');

// Defaults: a CJK-capable face at a line height that stays legible at 1bpp.
check(await page.locator('#fg-fontlist .fg-font.on .fg-font-name').innerText() === 'Noto Sans JP',
  'the default typeface is Noto Sans JP');
check(await page.inputValue('#fg-size') === '32', 'the default character height is 32px');
check(await page.inputValue('#fg-live-zoom') === '1', 'the preview zoom defaults to 1x');

// The live preview sits with the typeface/size controls and must actually
// paint, without anyone pressing Generate.
console.log('live preview:');
// Wait for the status line to report a finished render. A generic "canvas is
// bigger than nothing" check would pass on the 300x150 default a canvas has
// before anything is drawn, and measure an empty surface.
const rendered = (px) => new RegExp(`(characters|文字) ${px}px`);
const t0 = Date.now();
await page.waitForFunction(
  (re) => new RegExp(re).test(document.querySelector('#fg-live-status').textContent),
  rendered(32).source, { timeout: 90000 });
console.log(`  (typeface loaded and previewed in ${((Date.now() - t0) / 1000).toFixed(1)}s)`);
const liveInk = await page.evaluate(() => {
  const cv = document.querySelector('#fg-live');
  const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
  let n = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i + 1] > 200) n++;
  return { n, h: cv.height, status: document.querySelector('#fg-live-status').textContent };
});
check(liveInk.n > 100, `the live preview drew glyphs (${liveInk.n} px)`);
// The size is the CHARACTER height; the line box is derived and must be at
// least as tall, never shorter (which would clip).
check(liveInk.h >= 32, `the line box covers the 32px characters (canvas ${liveInk.h}px at 1x)`);
check(rendered(32).test(liveInk.status), `it reports both heights (${liveInk.status.trim()})`);

// Changing the size must move the preview without a Generate run.
await page.fill('#fg-size', '16');
await page.waitForFunction(
  (re) => new RegExp(re).test(document.querySelector('#fg-live-status').textContent),
  rendered(16).source, { timeout: 60000 });
check(true, 'changing the character height updates the live preview');
await page.fill('#fg-size', '32');
await page.waitForFunction(
  (re) => new RegExp(re).test(document.querySelector('#fg-live-status').textContent),
  rendered(32).source, { timeout: 60000 });

// The point of sizing by character height: the same number must produce the
// same visible text size in different typefaces. Line boxes vary a lot between
// families, so sizing by the line box did not.
console.log('size is consistent across typefaces:');
const heights = await page.evaluate(async () => {
  const { loadGoogleFont } = await import('./src/fontgen/googlefonts.js');
  const { rasterizeSet, unloadFont } = await import('./src/fontgen/rasterize.js');
  const probe = { latin: 'H'.codePointAt(0), cjk: '漢'.codePointAt(0) };
  const out = [];
  for (const [family, kind] of [['Roboto', 'latin'], ['Inter', 'latin'], ['Noto Sans JP', 'cjk'], ['BIZ UDGothic', 'cjk']]) {
    const cp = probe[kind];
    const g = await loadGoogleFont(family, [cp], {});
    const { glyphs, font } = await rasterizeSet({ family: g.family, size: 32, codepoints: [cp] });
    for (const f of g.faces) unloadFont(f);
    out.push({ family, ink: glyphs[0] ? glyphs[0].h : 0, line: font.height });
  }
  return out;
});
for (const h of heights) console.log(`  ${h.family.padEnd(14)} character ${h.ink}px, line ${h.line}px`);
const inks = heights.map((h) => h.ink);
check(inks.every((v) => Math.abs(v - 32) <= 1),
  `every typeface renders its reference character at 32px (${inks.join(', ')})`);

// Applying a template must switch the preview string too, or every template
// previews the same characters and the difference is invisible.
console.log('templates change the preview:');
const tplSample = async (label) => {
  await page.locator('#fg-presets .cs-templates .fchip').filter({ hasText: label }).first().click();
  await page.waitForTimeout(50);
  return page.inputValue('#fg-live-sample');
};
const clockSample = await tplSample(/^Clock$|^時計$/);
const jaSample = await tplSample(/Japanese UI|日本語UI/);
const koSample = await tplSample(/Korean UI|韓国語UI/);
check(clockSample !== jaSample && jaSample !== koSample,
  `each template previews its own string (${clockSample} / ${jaSample} / ${koSample})`);
check(/[ぁ-ん]/.test(jaSample), 'the Japanese template previews Japanese');
check(/[가-힣]/.test(koSample), 'the Korean template previews Korean');

// And the sample must actually render — a template whose own sample falls
// outside its own selection would warn instead of drawing.
await page.waitForFunction(() => {
  const s = document.querySelector('#fg-live-status').textContent;
  return s && !s.includes('…');
}, null, { timeout: 90000 });
const koStatus = await page.locator('#fg-live-status').innerText();
check(!/not in the selected|選択中の文字種に含まれません/.test(koStatus),
  `a template's own sample is inside its own selection (${koStatus.trim().slice(0, 70)})`);

// The Korean and Chinese templates exist at all — Japanese should not be the
// only language with a starting point.
const tplNames = await page.locator('#fg-presets .cs-templates .fchip').allInnerTexts();
check(tplNames.length >= 10, `templates cover more than Japanese (${tplNames.length}: ${tplNames.join(', ')})`);

// The defaults must be clean: the out-of-the-box typeface has to be able to
// draw the out-of-the-box character set. Ω lives in the Greek set for exactly
// this reason — Google's Noto Sans JP carries no Greek at all, so a units set
// containing it would warn on every fresh page load.
console.log('the default selection works with the default typeface:');
const defaults = await page.evaluate(async () => {
  const { resolveCharset, splitBmp } = await import('./src/fontgen/charsets.js');
  const { loadGoogleFont } = await import('./src/fontgen/googlefonts.js');
  const { rasterizeSet, unloadFont } = await import('./src/fontgen/rasterize.js');
  const sets = ['ascii', 'hiragana', 'katakana', 'jaPunct', 'hanJa1', 'symUnits'];
  const { bmp, dropped } = splitBmp(resolveCharset({ sets }));
  // Only the symbol and kana sets: rasterizing 2,000 kanji here would dominate
  // the run, and the kanji are not what this is guarding.
  const probe = bmp.filter((c) => c < 0x4e00);
  const g = await loadGoogleFont('Noto Sans JP', probe, {});
  const { missing } = await rasterizeSet({ family: g.family, size: 16, codepoints: probe });
  for (const f of g.faces) unloadFont(f);
  return {
    missing: missing.map((c) => String.fromCodePoint(c)),
    dropped: dropped.map((c) => 'U+' + c.toString(16).toUpperCase()),
    checked: probe.length,
  };
});
check(defaults.missing.length === 0,
  `Noto Sans JP draws every non-kanji character of the default set (${defaults.checked} checked${defaults.missing.length ? ', missing: ' + defaults.missing.join('') : ''})`);
// Nothing in the default selection is unrepresentable: 𠮟 (U+20B9F) is
// nominally part of 常用漢字, but a uint16 glyph encoding can never address it,
// so it is excluded from the curated sets rather than reported on every load.
check(defaults.dropped.length === 0,
  `nothing in the default selection is unrepresentable (${defaults.dropped.join(', ') || 'none dropped'})`);

// Characters that will not be in the generated font must be visible, not
// silently closed up — a gap you cannot see is a gap you ship. Two reasons,
// two colours: red = the typeface has no such glyph, amber = outside the
// selected character set.
console.log('characters that will not make it are shown, not skipped:');
const marks = await page.evaluate(async () => {
  const el = document.querySelector('#fg-live-sample');
  el.value = 'A\u2603B';            // U+2603 SNOWMAN: outside the selection here
  el.dispatchEvent(new Event('input'));
  await new Promise((r) => setTimeout(r, 1800));
  const cv = document.querySelector('#fg-live');
  const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
  let amber = 0, green = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i] > 180 && d[i + 1] > 120 && d[i + 1] < 200 && d[i + 2] < 120) amber++;
    else if (d[i + 1] > 200 && d[i] < 180) green++;
  }
  return { amber, green, status: document.querySelector('#fg-live-status').textContent };
});
check(marks.amber > 20, `an out-of-selection character is boxed in amber (${marks.amber} px)`);
check(marks.green > 20, `the selected characters still draw (${marks.green} px)`);
check(/amber crossed|\u6a59\u8272/.test(marks.status), `the status explains the amber marker (${marks.status.trim().slice(0, 80)})`);

// Regression: a Google CJK family is served as ~120 subsets, and reusing the
// subsets fetched for an earlier sample made new characters look absent from
// the typeface. Noto Sans JP unquestionably has 気温.
console.log('subsets are fetched as the sample widens:');
const widened = await page.evaluate(async () => {
  const el = document.querySelector('#fg-live-sample');
  for (const v of ['\u8587\u8587', '\u6c17\u6e29']) {   // 薔薇 then 気温
    el.value = v;
    el.dispatchEvent(new Event('input'));
    await new Promise((r) => setTimeout(r, 2500));
  }
  const cv = document.querySelector('#fg-live');
  const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
  let red = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i] > 180 && d[i + 1] < 120 && d[i + 2] < 120) red++;
  return { red, status: document.querySelector('#fg-live-status').textContent };
});
check(widened.red === 0, `気温 is found after an earlier sample loaded other subsets (${widened.red} red px)`);
await page.evaluate(() => {
  const el = document.querySelector('#fg-live-sample');
  el.value = '';
  el.dispatchEvent(new Event('input'));
});

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
// Latin UI template: ASCII + Latin-1 + units — small, quick, and it carries ℃.
await page.locator('#fg-presets .cs-templates .fchip').filter({ hasText: /Latin UI|英数UI/ }).first().click();

const counted = await page.locator('#fg-charcount').innerText();
check(/\d/.test(counted), `charset summary shows a count (${counted})`);

// ℃ is in the selection here but Roboto has no glyph for it — the canonical
// "the font is missing a character you asked for" case, and it must be red.
const redBox = await page.evaluate(async () => {
  const el = document.querySelector('#fg-live-sample');
  el.value = 'A\u2103B';
  el.dispatchEvent(new Event('input'));
  await new Promise((r) => setTimeout(r, 2000));
  const cv = document.querySelector('#fg-live');
  const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
  let red = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i] > 180 && d[i + 1] < 120 && d[i + 2] < 120) red++;
  return { red, status: document.querySelector('#fg-live-status').textContent };
});
check(redBox.red > 20, `a character the typeface lacks is boxed in red (${redBox.red} px)`);
check(/red crossed|\u8d64\u3044/.test(redBox.status), `the status explains the red marker (${redBox.status.trim().slice(0, 80)})`);


// A count alone cannot answer "which characters is this?" — the inspector must
// list them, and must be able to show one preset on its own.
console.log('charset inspector:');
await page.evaluate(() => { document.querySelector('#fg-charmap-details').open = true; });
await page.waitForSelector('#fg-charmap .cm-block');
const mapAll = await page.locator('#fg-charmap').innerText();
check(mapAll.includes('℃'), 'the selected set lists ℃ as an actual character');
check(mapAll.includes('Basic Latin (ASCII)'), 'characters are grouped by Unicode block');
check(/U\+0020/.test(mapAll), 'each block shows its codepoint range');

await page.selectOption('#fg-charmap-scope', 'hiragana');
await page.waitForFunction(() => document.querySelector('#fg-charmap').innerText.includes('Hiragana'));
const mapKana = await page.locator('#fg-charmap').innerText();
check(mapKana.includes('あ'), 'a single set can be inspected on its own');
check(!mapKana.includes('Basic Latin (ASCII)'), 'inspecting one set does not show the others');
await page.selectOption('#fg-charmap-scope', '');

// Generate at 16 so the run is quick, and so the result's line height can be
// checked against a known character height.
await page.fill('#fg-size', '16');
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
// The size is the CHARACTER height, so the line box is derived and larger:
// tall enough for accents and descenders, but not the ~3x a family's declared
// metrics would reserve.
const lineH = Number(res.height.replace('px', ''));
check(lineH >= 16 && lineH <= 40, `the derived line box is sane for 16px characters (${res.height})`);
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

// When the typeface cannot supply a character, the tool offers to take it from
// another one — offers, not does: mixing typefaces changes how the font looks,
// so it stays the user's call. Roboto has no ℃, and Google's Noto Sans JP has
// no Greek at all, which is how these gaps arise in practice.
console.log('fallback is offered for characters the typeface lacks:');
await page.waitForFunction(
  () => !document.querySelector('#fg-fallback-offer').hidden
     && !/…$/.test(document.querySelector('#fg-fallback-text').textContent.trim()),
  null, { timeout: 90000 });
const offer = await page.evaluate(() => ({
  text: document.querySelector('#fg-fallback-text').innerText,
  applyShown: !document.querySelector('#fg-fallback-apply').hidden,
  notes: document.querySelector('#fg-res-notes').innerText,
}));
check(offer.applyShown, `the fill is offered (${offer.text.replace(/\n/g, ' | ').slice(0, 110)})`);
check(/Noto Sans/.test(offer.text), 'it names the typeface that would supply them');
check(/℃/.test(offer.notes), 'and until then the gap is still reported');

// Accepting it re-runs, and the character is really in the font afterwards.
await page.click('#fg-fallback-apply');
await page.waitForFunction(
  () => document.querySelector('#fg-res-notes').innerText.includes('Noto Sans'),
  null, { timeout: 120000 });
const filled = await page.evaluate(async () => {
  const el = document.querySelector('#fg-sample');
  el.value = '℃';
  el.dispatchEvent(new Event('input'));
  await new Promise((r) => setTimeout(r, 100));
  const cv = document.querySelector('#fg-preview');
  const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
  let green = 0, red = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 1] > 200 && d[i] < 180) green++;
    else if (d[i] > 180 && d[i + 1] < 120) red++;
  }
  return {
    green, red,
    notes: document.querySelector('#fg-res-notes').innerText,
    code: document.querySelector('#fg-code').textContent,
  };
});
check(filled.green > 20 && filled.red === 0, `℃ is now in the font and draws normally (${filled.green} ink px, ${filled.red} red)`);
check(/filled in from|補完しました/.test(filled.notes), `the fill is reported (${filled.notes.trim().split('\n')[0]})`);
// A font built from two typefaces is a derived work of both, so both must be
// credited in the header.
check(/Font source 2/.test(filled.code), 'the header carries a second attribution block');
check((filled.code.match(/License  :/g) || []).length >= 2, 'with a licence for each typeface used');

// Once the fill is applied the inspector must stop calling ℃ missing — it is in
// the font now, just from a different typeface.
const afterFill = await page.evaluate(() => [...document.querySelectorAll('#fg-charmap .cm-missing')].map((x) => x.textContent).join(''));
check(!afterFill.includes('℃'), `the inspector no longer marks ℃ missing (${afterFill || 'nothing struck'})`);

// A fallback is a decision about ONE typeface's gaps, so switching typeface must
// drop it — otherwise it sticks with no way to change or clear it.
console.log('fallback follows the typeface:');
const stickiness = await page.evaluate(async () => {
  const before = !document.querySelector('#fg-fallback-clear').hidden;
  // Switch to another typeface and back.
  document.querySelector('#fg-fontsearch').value = 'Inter';
  document.querySelector('#fg-fontsearch').dispatchEvent(new Event('input'));
  const tile = [...document.querySelectorAll('#fg-fontlist .fg-font-name')].find((n) => n.textContent === 'Inter');
  tile.closest('.fg-font').click();
  await new Promise((r) => setTimeout(r, 100));
  return { before, offerHidden: document.querySelector('#fg-fallback-offer').hidden };
});
check(stickiness.offerHidden, 'changing typeface clears the fallback decision');

// Filled-in glyphs must sit at the primary's scale, and whitespace is the case
// that gets this wrong: it draws nothing, so only its advance can say which
// font supplied it. Left unchecked, Micro 5 (whose em is more than twice its
// cap height) took the ideographic space from a fallback at ITS em and U+3000
// came out 71px wide next to 34px kana.
console.log('fills are scaled to the primary, whitespace included:');
const scaled = await page.evaluate(async () => {
  const { resolveCharset, splitBmp } = await import('./src/fontgen/charsets.js');
  const { composeFont } = await import('./src/fontgen/compose.js');
  const { encodeU8g2 } = await import('./src/fontgen/u8g2enc.js');
  const cps = splitBmp(resolveCharset({ sets: ['ascii', 'hiragana', 'jaPunct'], customText: '気温' })).bmp;
  const c = await composeFont({ source: { kind: 'google', family: 'Micro 5' }, fallback: 'auto', size: 32, codepoints: cps });
  const by = new Map(c.glyphs.map((g) => [g.code, g]));
  let encoded = null;
  try { encoded = encodeU8g2(c.glyphs, c.font).glyphCount; } catch (e) { encoded = e.message; }
  return {
    space: by.get(0x3000)?.dx, kana: by.get(0x3042)?.dx, kanji: by.get(0x6c17)?.dx,
    widest: c.glyphs.reduce((a, g) => (g.h && g.dx > a ? g.dx : a), 0),
    skipped: c.skippedFallbacks || [], encoded,
  };
});
check(scaled.space != null, `the ideographic space is in the font (dx=${scaled.space})`);
check(scaled.space <= Math.max(scaled.kana, scaled.kanji, scaled.widest),
  `whitespace is no wider than the widest character (space ${scaled.space}, kana ${scaled.kana}, kanji ${scaled.kanji}, widest ${scaled.widest})`);
check(scaled.skipped.length === 0,
  `no fallback family failed silently${scaled.skipped.length ? ': ' + JSON.stringify(scaled.skipped) : ''}`);
check(typeof scaled.encoded === 'number', `and the result encodes (${scaled.encoded} glyphs)`);

// Korean has to be reachable through the chain too — it sits at the end of it.
//
// The second run passes a STALE plan. A plan is the offer's survey of one
// particular gap, and the page keeps it across a character-set change: with the
// fallback already on, switching to the Korean set left the plan at the
// families that had covered the previous gap, and because the plan replaced the
// chain outright, Noto Sans KR was never asked and 2,350 hangul were reported
// as absent. A plan may reorder the chain; it must not truncate it.
console.log('the chain reaches Korean:');
const korean = await page.evaluate(async () => {
  const { resolveCharset, splitBmp } = await import('./src/fontgen/charsets.js');
  const { composeFont } = await import('./src/fontgen/compose.js');
  const cps = splitBmp(resolveCharset({ sets: ['ascii', 'hangulKs'] })).bmp.slice(0, 120);
  const src = { kind: 'google', family: 'Roboto' };
  const c = await composeFont({ source: src, fallback: 'auto', size: 24, codepoints: cps });
  const stale = await composeFont({
    source: src, fallback: 'auto', size: 24, codepoints: cps,
    primed: c.primed, chain: ['Noto Sans Symbols 2', 'Noto Sans'],
  });
  return {
    sources: c.sources.map((x) => `${x.family}:${x.count}`), missing: c.missing.length,
    staleSources: stale.sources.map((x) => `${x.family}:${x.count}`), staleMissing: stale.missing.length,
  };
});
check(korean.missing === 0 && korean.sources.some((x) => x.startsWith('Noto Sans KR')),
  `hangul is filled in (${korean.sources.join(', ')}, ${korean.missing} still missing)`);
check(korean.staleMissing === 0 && korean.staleSources.some((x) => x.startsWith('Noto Sans KR')),
  `a stale plan cannot truncate the chain (${korean.staleSources.join(', ')}, ${korean.staleMissing} still missing)`);

// The presence test decides by whether the rendering matches what the generic
// fallback draws, so it is wrong when they match by coincidence. Noto Sans KR
// has 굡, but at a 43.8px em it thresholded identically to BOTH generics and was
// dropped, while the other 2,349 hangul of the same set came through. A genuine
// absence matches at every size, so a second opinion at another size settles it.
console.log('a pixel collision is not mistaken for a missing glyph:');
const collision = await page.evaluate(async () => {
  const { loadGoogleFont } = await import('./src/fontgen/googlefonts.js');
  const { rasterizeSet, unloadFont } = await import('./src/fontgen/rasterize.js');
  const cps = [0xad61, 0xac00];                       // 굡 가
  const g = await loadGoogleFont('Noto Sans KR', [...cps, 0x48], {});
  const out = [];
  for (const size of [24, 28, 32, 36, 40]) {
    // probeChar 'H' reproduces the fallback pass, where the size is pinned to
    // the PRIMARY's reference character — which is how 43.8px arises.
    const r = await rasterizeSet({ family: g.family, size, codepoints: cps, probeChar: 'H' });
    out.push({ size, px: Math.round(r.font.cssPx * 10) / 10, missing: r.missing.length });
  }
  for (const f of g.faces) unloadFont(f);
  return out;
});
console.log('  ' + collision.map((c) => `${c.size}→${c.px}px:${c.missing}`).join('  '));
check(collision.every((c) => c.missing === 0),
  `Noto Sans KR keeps 굡 at every size (${collision.filter((c) => c.missing).map((c) => c.px + 'px').join(', ') || 'none dropped'})`);

check(pageErrors.length === 0, `still no uncaught errors${pageErrors.length ? ': ' + pageErrors.join('; ') : ''}`);

await browser.close();
server.close();

if (failures) { console.error(`\nfontgen page smoke FAILED (${failures} issue(s)).`); process.exit(1); }
console.log('\nfontgen page smoke OK.');
