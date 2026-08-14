// Standalone embedded-font generator page (docs/fontgen.html, §8.7.7).
//
// This page is deliberately independent of the layout editor: it holds no
// project, touches no store, and its only job is font in -> .h out. People who
// use LovyanGFX without LGFXScreenBuilder should be able to bookmark it on its
// own, so everything it needs lives under docs/src/fontgen/.
//
// The same modules back the editor's integrated flow (fontsview.js), which
// stores a recipe and re-runs this pipeline at export time.
import { ALL_SET_IDS, resolveCharset, splitBmp, codepointsOfSet, migrateSets, countOf } from './charsets.js';
import { createCharsetUI } from './charsetui.js';
import { renderCharmap } from './charmap.js';
import { FONTS, FALLBACK_CHAIN } from './googlefonts.js';
import { composeFont, probeFallback, FALLBACK_AUTO } from './compose.js';
import { drawGlyphs, createLivePreview, autoSample } from './preview.js';
import { encodeU8g2 } from './u8g2enc.js';
import { emitHeader, sanitizeIdent } from './emit.js';
import { t, applyStatic, setLang, getLang, detectLanguage, LANGS } from '../i18n.js';

const $ = (id) => document.getElementById(id);

// --- state ---------------------------------------------------------------

const state = {
  tab: 'google',            // 'google' | 'local'
  family: 'Noto Sans JP',   // curated family name
  weight: 400,
  italic: false,
  localFile: null,          // { name, buffer }
  // Line height. 32 by default: 1bpp CJK below ~24px loses the strokes that
  // tell kanji apart, so the honest starting point is a size that reads.
  size: 32,
  threshold: 128,
  name: 'MyFont',
  // Flat list of set ids (see charsets.js); the picker groups them into axes.
  sets: ['ascii', 'hiragana', 'katakana', 'jaPunct', 'hanJa1', 'symUnits'],
  customText: '',
  customRanges: '',
  // null until the user accepts the offer: fallback never happens unasked.
  fallback: null,           // null | 'auto' | family name
  result: null,             // { header, data, glyphs, missing, stats, charset }
};

// --- character-set panel --------------------------------------------------

let charsetUI = null;

// Currently selected codepoints (presets ∪ custom text ∪ custom ranges).
const currentCharset = () => resolveCharset({
  sets: state.sets,
  customText: state.customText,
  customRanges: state.customRanges,
});

function updateCharsetSummary() {
  const cps = currentCharset();
  const { bmp, dropped } = splitBmp(cps);
  $('fg-charcount').textContent = t('fg.charCount', { n: bmp.length.toLocaleString() });
  // Name the characters: "1 character was dropped" invites the question, and
  // the answer (常用漢字 carries 𠮟, which is outside the BMP) is short.
  $('fg-charwarn').textContent = dropped.length
    ? t('fg.dropped', { n: dropped.length, sample: dropped.map((c) => String.fromCodePoint(c)).join('') })
    : '';
  // A rough flash figure before generating: 1bpp glyph data plus per-glyph
  // overhead, so nobody starts a 20k-glyph run without seeing the scale.
  const approx = Math.round(bmp.length * (state.size * state.size * 0.18 + 6));
  $('fg-estimate').textContent = bmp.length ? t('fg.estimate', { size: fmtBytes(approx) }) : '';
  $('fg-generate').disabled = bmp.length === 0;
  syncSample();
  renderCharmapPanel();
}

// --- charset inspector ----------------------------------------------------

function fillCharmapScope() {
  const sel = $('fg-charmap-scope');
  const keep = sel.value;
  sel.innerHTML = `<option value="">${t('cm.scopeSelected')}</option>` +
    ALL_SET_IDS.map((id) => `<option value="${id}">${t('cs.set.' + id)} (${countOf(id).toLocaleString()})</option>`).join('');
  if (keep) sel.value = keep;
}

// Rendering twenty thousand characters is not free, so it only happens while
// the panel is actually open.
function renderCharmapPanel() {
  if (!$('fg-charmap-details').open) return;
  const scope = $('fg-charmap-scope').value;
  const cps = scope ? codepointsOfSet(scope) : currentCharset();
  // After a run, the same view doubles as the coverage report: characters the
  // typeface turned out not to have are struck through where they sit.
  const missing = !scope && state.result ? state.result.missing : null;
  $('fg-charmap-note').textContent = missing && missing.length
    ? t('cm.missingNote', { n: missing.length.toLocaleString() })
    : t('cm.note');
  renderCharmap($('fg-charmap'), cps, { missing, emptyText: t('cm.empty') });
}

const fmtBytes = (n) => (n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(2)} MB`);

// --- font source panel ----------------------------------------------------

function renderFontList() {
  const host = $('fg-fontlist');
  const q = $('fg-fontsearch').value.trim().toLowerCase();
  host.innerHTML = '';
  for (const f of FONTS) {
    if (q && !f.family.toLowerCase().includes(q) && !f.script.includes(q)) continue;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'fg-font' + (state.family === f.family ? ' on' : '');
    b.innerHTML =
      `<span class="fg-font-name" style="font-family:'${f.family}',sans-serif">${f.family}</span>` +
      `<span class="fg-badges"><span class="badge">${f.license.id}</span>` +
      `<span class="sub">${t('fg.script.' + f.script)}</span></span>`;
    b.onclick = () => { state.family = f.family; renderFontList(); live?.refresh(0); };
    host.appendChild(b);
  }
}

function setTab(tab) {
  state.tab = tab;
  $('fg-tab-google').classList.toggle('on', tab === 'google');
  $('fg-tab-local').classList.toggle('on', tab === 'local');
  $('fg-src-google').hidden = tab !== 'google';
  $('fg-src-local').hidden = tab !== 'local';
}

// --- preview --------------------------------------------------------------

let live = null;
// Whether the user typed their own sample. Until they do, the sample tracks the
// selection, so the preview never shows characters the font will not contain.
let sampleEdited = false;
// A template's own preview string, kept while it still fits the selection so
// that toggling one checkbox does not throw away the sample that made the
// template's point.
let preferredSample = '';

function syncSample() {
  if (sampleEdited) return;
  const cps = currentCharset();
  const have = new Set(cps);
  const fits = preferredSample && [...preferredSample].every((c) => have.has(c.codePointAt(0)));
  $('fg-live-sample').value = fits ? preferredSample : autoSample(cps);
}

// A sample that shows off whatever the user actually selected.
function sampleText(glyphs) {
  const have = new Set(glyphs.map((g) => g.code));
  const candidates = ['12:34', 'Hello 25.6℃', 'あア漢字', 'ABC abc 123'];
  const pick = candidates.filter((s) => [...s].every((c) => have.has(c.codePointAt(0))));
  return pick.join('  ') || [...have].slice(0, 24).map((c) => String.fromCodePoint(c)).join('');
}

// --- generate -------------------------------------------------------------

function status(msg, kind = '') {
  const el = $('fg-status');
  el.textContent = msg;
  el.className = 'fg-status ' + kind;
}

async function generate() {
  const cps = splitBmp(currentCharset()).bmp;
  if (!cps.length) return;

  $('fg-generate').disabled = true;
  $('fg-output').hidden = true;
  try {
    const source = state.tab === 'google'
      ? { kind: 'google', family: state.family }
      : { kind: 'local', family: state.localFile?.name, buffer: state.localFile?.buffer };
    if (state.tab === 'local' && !source.buffer) { status(t('fg.errNoFile'), 'err'); return; }

    const { glyphs, missing, font, sources } = await composeFont({
      source,
      fallback: state.fallback,
      size: state.size,
      codepoints: cps,
      style: { weight: state.weight, italic: state.italic },
      threshold: state.threshold,
      onProgress: ({ done, total, family }) => status(
        t('fg.statusRaster', { done: done.toLocaleString(), total: total.toLocaleString() }) + ` (${family})`),
    });
    if (!glyphs.length) throw new Error(t('fg.errNoGlyphs'));

    status(t('fg.statusEncode'));
    const enc = encodeU8g2(glyphs, font);
    const stats = {
      height: font.height, ascent: font.ascent, descent: font.descent,
      glyphCount: enc.glyphCount, bytes: enc.data.length,
    };
    const charset = { presets: state.sets.map((id) => t('cs.set.' + id)), codepoints: cps };
    const header = emitHeader({ name: state.name, data: enc.data, source: sources[0], sources, charset, stats });

    state.result = { header, data: enc.data, glyphs, missing, stats, font, sources, skipped: enc.skipped };
    showResult();
    status('');
    // Only ask about filling gaps once there are gaps to fill.
    offerFallback(missing);
  } catch (e) {
    status(e.message, 'err');
  } finally {
    $('fg-generate').disabled = false;
  }
}

// Detect what a fallback could supply and offer it. Never applies anything:
// mixing typefaces changes how the font looks, so it is the user's call.
async function offerFallback(missing) {
  const box = $('fg-fallback-offer');
  box.hidden = true;
  if (!missing.length || state.fallback) return;

  $('fg-fallback-text').innerHTML = `<span class="sub">${t('fb.checking')}</span>`;
  box.hidden = false;
  const style = { weight: state.weight, italic: state.italic };
  const found = await probeFallback(missing, style, state.tab === 'google' ? state.family : null);
  if (!found.length) {
    $('fg-fallback-text').innerHTML = `<span class="sub">${t('fb.noneFound', { n: missing.length })}</span>`;
    $('fg-fallback-apply').hidden = true;
    return;
  }
  $('fg-fallback-apply').hidden = false;
  const covered = found.reduce((a, f) => a + [...f.chars].length, 0);
  $('fg-fallback-text').innerHTML =
    `<div>${t('fb.offer', { n: covered, of: missing.length })}</div>` +
    found.map((f) => `<div class="sub">${f.family}: <span class="fg-chars">${f.chars.slice(0, 40)}</span></div>`).join('');
  $('fg-fallback-pick').innerHTML =
    `<option value="${FALLBACK_AUTO}">${t('fb.auto')}</option>` +
    FALLBACK_CHAIN.map((f) => `<option value="${f}">${f}</option>`).join('');
  $('fg-fallback-pick').value = FALLBACK_AUTO;
}

function showResult() {
  const r = state.result;
  $('fg-output').hidden = false;
  $('fg-res-bytes').textContent = fmtBytes(r.stats.bytes);
  $('fg-res-glyphs').textContent = r.stats.glyphCount.toLocaleString();
  $('fg-res-height').textContent = `${r.stats.height}px`;

  const notes = [];
  // Which typeface supplied what: a font composed from several sources is a
  // derived work of all of them, so this is not a nicety.
  for (const src of (r.sources || []).slice(1)) {
    notes.push(t('fb.filled', { n: src.count, family: src.family, sample: src.chars.slice(0, 20) }));
  }
  if (r.missing.length) {
    notes.push(t('fg.missing', {
      n: r.missing.length,
      sample: r.missing.slice(0, 20).map((c) => String.fromCodePoint(c)).join(''),
    }));
  }
  if (r.skipped.length) notes.push(t('fg.skipped', { n: r.skipped.length }));
  $('fg-res-notes').innerHTML = notes.map((n) => `<div class="fg-note">${n}</div>`).join('');

  const text = $('fg-sample').value.trim() || sampleText(r.glyphs);
  drawGlyphs($('fg-preview'), r.glyphs, r.font, text, Number($('fg-zoom').value));

  // Show the whole header. Only a set big enough to make the browser struggle
  // is cut, and then it says so in words rather than trailing off in an ellipsis
  // that reads like the file itself ends there.
  const LIMIT = 512 * 1024;
  const cut = r.header.length > LIMIT;
  $('fg-code').textContent = cut ? r.header.slice(0, LIMIT) : r.header;
  $('fg-code-note').textContent = cut
    ? t('fg.codeTruncated', { shown: fmtBytes(LIMIT), total: fmtBytes(r.header.length) })
    : t('fg.codeFull', { total: fmtBytes(r.header.length) });

  // The inspector doubles as the coverage report once a run has happened.
  renderCharmapPanel();
}

function download(filename, text, mime) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// --- wiring ---------------------------------------------------------------

function bindNumber(id, key, { min, max, onChange } = {}) {
  const el = $(id);
  el.value = state[key];
  el.addEventListener('input', () => {
    let v = Number(el.value);
    if (Number.isNaN(v)) return;
    if (min != null) v = Math.max(min, v);
    if (max != null) v = Math.min(max, v);
    state[key] = v;
    onChange?.();
  });
}

export function initFontgen() {
  setLang(detectLanguage());
  const sel = $('fg-lang');
  sel.innerHTML = LANGS.map((l) => `<option value="${l}">${l}</option>`).join('');
  sel.value = getLang();
  sel.addEventListener('change', () => { setLang(sel.value); redrawAll(); });

  $('fg-tab-google').onclick = () => { setTab('google'); live.refresh(0); };
  $('fg-tab-local').onclick = () => { setTab('local'); live.refresh(0); };
  $('fg-fontsearch').addEventListener('input', renderFontList);
  $('fg-weight').addEventListener('change', () => { state.weight = Number($('fg-weight').value); live.refresh(0); });
  $('fg-italic').addEventListener('change', () => { state.italic = $('fg-italic').checked; live.refresh(0); });

  // Live preview: everything that changes how a glyph looks refreshes it.
  live = createLivePreview({
    canvas: $('fg-live'),
    statusEl: $('fg-live-status'),
    t,
    settings: () => ({
      kind: state.tab,
      family: state.tab === 'google' ? state.family : (state.localFile?.name || ''),
      weight: state.weight,
      italic: state.italic,
      size: state.size,
      threshold: state.threshold,
      localBuffer: state.localFile?.buffer || null,
      sample: $('fg-live-sample').value,
      scale: Number($('fg-live-zoom').value),
      allowed: new Set(currentCharset()),
    }),
  });
  $('fg-live-sample').addEventListener('input', () => {
    // Blanking the field hands control back to the selection.
    sampleEdited = $('fg-live-sample').value.trim() !== '';
    if (!sampleEdited) { preferredSample = ''; syncSample(); }
    live.refresh();
  });
  $('fg-live-zoom').addEventListener('change', () => live.refresh(0));

  $('fg-file').addEventListener('change', async () => {
    const file = $('fg-file').files[0];
    if (!file) return;
    state.localFile = { name: file.name.replace(/\.[^.]+$/, ''), buffer: await file.arrayBuffer() };
    $('fg-filename').textContent = file.name;
    if (state.name === 'MyFont') { state.name = sanitizeIdent(state.localFile.name); $('fg-name').value = state.name; }
    live.refresh(0);
  });

  bindNumber('fg-size', 'size', { min: 6, max: 120, onChange: () => { updateCharsetSummary(); live.refresh(); } });
  bindNumber('fg-threshold', 'threshold', { min: 1, max: 255, onChange: () => live.refresh() });
  $('fg-name').value = state.name;
  $('fg-name').addEventListener('input', () => { state.name = $('fg-name').value; });

  $('fg-custom').addEventListener('input', () => { state.customText = $('fg-custom').value; updateCharsetSummary(); });
  $('fg-ranges').addEventListener('input', () => { state.customRanges = $('fg-ranges').value; updateCharsetSummary(); });

  // Character-set picker (shared with the editor dialog).
  charsetUI = createCharsetUI({
    host: $('fg-presets'),
    getSets: () => state.sets,
    setSets: (v) => { state.sets = v; updateCharsetSummary(); live?.refresh(); },
    getText: () => state.customText,
    setText: (v) => { state.customText = v; $('fg-custom').value = v; },
    setSample: (v) => { preferredSample = v; sampleEdited = false; },
  });

  fillCharmapScope();
  $('fg-charmap-details').addEventListener('toggle', renderCharmapPanel);
  $('fg-charmap-scope').addEventListener('change', renderCharmapPanel);

  $('fg-generate').onclick = generate;
  // Accepting the offer stores the choice and re-runs, so what you see next is
  // the font you will actually get.
  $('fg-fallback-apply').onclick = () => {
    state.fallback = $('fg-fallback-pick').value || FALLBACK_AUTO;
    $('fg-fallback-offer').hidden = true;
    generate();
  };
  $('fg-zoom').addEventListener('input', () => { if (state.result) showResult(); });
  $('fg-sample').addEventListener('input', () => { if (state.result) showResult(); });

  $('fg-download-h').onclick = () => download(`${sanitizeIdent(state.name)}.h`, state.result.header, 'text/x-c');
  $('fg-download-bin').onclick = () => download(`${sanitizeIdent(state.name)}.u8g2`, state.result.data, 'application/octet-stream');
  $('fg-copy').onclick = async () => {
    await navigator.clipboard.writeText(state.result.header);
    status(t('fg.copied'));
  };

  redrawAll();
}

function redrawAll() {
  applyStatic(document);
  renderFontList();
  charsetUI?.render();
  updateCharsetSummary();
  live?.refresh(0);
  if (state.result) showResult();
}
