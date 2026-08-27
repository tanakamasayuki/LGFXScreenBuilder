// Generated-font UI inside the editor (Fonts mode, §8.7.7).
//
// This stores the RECIPE on the project and keeps the bytes in the session
// cache (build.js). The project file therefore never
// carries font data, and export rebuilds what it needs.
import { store, mutate } from '../store.js';
import { adoptCustomFont, removeFont, customFontNames, fontEntry } from '../model.js';
import { t } from '../i18n.js';
import { ALL_SET_IDS, resolveCharset, splitBmp, codepointsOfSet, migrateSets, countOf } from './charsets.js';
import { createCharsetUI } from './charsetui.js';
import { renderCharmap } from './charmap.js';
import { drawModel, createLivePreview, autoSample, quantizeCoverage } from './preview.js';
import { FONTS, FALLBACK_CHAIN } from './googlefonts.js';
import { probeFallback, FALLBACK_AUTO } from './compose.js';
import { buildFont, cachedFont, isCached, rememberLocalFile, hasLocalFile, forgetFont, recipeKey,
         formatOf, bppOf, isAntiAliased } from './build.js';

const $ = (id) => document.getElementById(id);
const fmtBytes = (n) => (n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(2)} MB`);

// Dialog state; `editing` is the name being replaced, or null when adding.
let dlg = null;
let live = null;

// Whether the user typed their own preview sample. Until they do, the sample
// tracks the selection, so the preview never shows characters the generated
// font will not contain.
let sampleEdited = false;
// A template's own preview string, kept while it still fits the selection.
let preferredSample = '';

function syncSample() {
  if (sampleEdited || !dlg) return;
  const cps = dlgCharset();
  const have = new Set(cps);
  const fits = preferredSample && [...preferredSample].every((c) => have.has(c.codePointAt(0)));
  $('cf-live-sample').value = fits ? preferredSample : autoSample(cps);
}

const blankRecipe = () => ({
  source: { kind: 'google', family: 'Noto Sans JP', weight: 400, italic: false },
  // Character height. 24 is the point where legibility gains start flattening:
  // above it, flash keeps climbing while legibility has already flattened — and
  // an embedded font costs flash on every profile it is enabled for.
  size: 24,
  threshold: 128,
  // Output format (§8.7.7). u8g2 is 1bpp, costs no RAM and needs no load step,
  // which is what makes a CJK set affordable; the others trade that away for
  // anti-aliasing or for the format limits u8g2 imposes.
  format: 'u8g2',
  bpp: 2,
  // Flat list of set ids (see charsets.js); the picker groups them into axes.
  sets: ['ascii', 'hiragana', 'katakana', 'jaPunct', 'hanJa1', 'symUnits'],
  customText: '',
  customRanges: '',
  // null until the user accepts the offer: fallback never happens unasked.
  fallback: null,
});

// What each format actually costs, so the choice is not made on the name alone.
// Sizes are the same six glyphs encoded four ways (u8g2 123B / BFF-2bpp 256B /
// BFF-4bpp 365B / VLW 621B); the draw figures are from the same measurement on
// an off-screen sprite, where u8g2 and VLW came out level and BFF about 3x.
const FORMAT_NOTES = {
  u8g2: 'Smallest, no RAM, no load step. 1bpp. Advance is capped at 63px and a glyph at 255 bytes.',
  gfx: 'Same 1bpp size class, without u8g2\u2019s 63px advance and 255-byte glyph limits \u2014 so it reaches sizes u8g2 refuses. Glyph lookup is a linear scan, which is slow for a scattered (CJK) set.',
  bff: 'Anti-aliased at 2 or 4bpp for roughly 2\u20133x the flash. Decoded per character while drawing, so it is the slowest of the four. Needs LovyanGFX 1.2.21+ / M5GFX 0.2.21+.',
  vlw: 'Full 8bpp anti-aliasing, and as fast to draw as u8g2. Costs about 5x the flash and 9 bytes of RAM per glyph, permanently \u2014 affordable for a small set, not for a CJK one.',
};

// BFF is the only format with a depth to choose; u8g2 and GFXfont are 1bpp and
// VLW is 8bpp by definition. Anything above 1bpp also makes the ink threshold
// meaningless, because coverage is kept instead of being cut at a value.
function syncFormatUI() {
  if (!dlg) return;
  const fmt = formatOf(dlg.recipe);
  $('cf-bpp-field').hidden = fmt !== 'bff';
  const thresholdField = $('cf-threshold').closest('.field');
  if (thresholdField) thresholdField.hidden = isAntiAliased(dlg.recipe);
  $('cf-format-note').textContent = FORMAT_NOTES[fmt] || '';
}

// --- typeface picker ------------------------------------------------------

// What each group's cards spell out. A Latin sample tells you nothing about a
// Japanese face, so the string follows the script the family is curated for.
const FACE_SAMPLE = {
  latin: 'Aa Bb 123', display: 'Aa 12:34', symbol: 'Aa 123',
  japanese: 'あア漢 12', cjk: '漢字 12',
};
const FACE_GROUPS = [
  ['latin', 'Latin / UI'], ['display', 'Display / clock'],
  ['japanese', 'Japanese'], ['cjk', 'CJK'], ['symbol', 'Symbols'],
];
const sampleFor = (f) => FACE_SAMPLE[f.script] || FACE_SAMPLE.latin;

// Load the preview faces themselves, subset with Google Fonts' `text=` to just
// the characters the cards show — a few hundred bytes per family instead of a
// full webfont. Requested per group, because `text=` applies to every family in
// a request and a Latin face has nothing to return for 漢.
let facesRequested = false;
function ensurePreviewFaces() {
  if (facesRequested || typeof document === 'undefined') return;
  facesRequested = true;
  for (const [script] of FACE_GROUPS) {
    const fams = FONTS.filter((f) => f.script === script);
    if (!fams.length) continue;
    const text = [...new Set(fams.map(sampleFor).join('') + fams.map((f) => f.family).join(''))].join('');
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?' +
      fams.map((f) => 'family=' + encodeURIComponent(f.family)).join('&') +
      '&text=' + encodeURIComponent(text) + '&display=swap';
    document.head.appendChild(link);
  }
}

function renderFamilyGrid() {
  const grid = $('cf-family-grid');
  if (!grid || !dlg) return;
  ensurePreviewFaces();
  const q = ($('cf-family-search').value || '').trim().toLowerCase();
  const selected = dlg.recipe.source.family;
  let html = '';
  for (const [script, label] of FACE_GROUPS) {
    const fams = FONTS.filter((f) => f.script === script &&
      (!q || f.family.toLowerCase().includes(q) || (f.by || '').toLowerCase().includes(q)));
    if (!fams.length) continue;
    html += `<div class="fg-facehead">${label}</div>`;
    for (const f of fams) {
      const css = `'${f.family}', system-ui, sans-serif`;
      html += `<button type="button" class="fg-face${f.family === selected ? ' on' : ''}" ` +
        `data-family="${f.family}" title="${f.by || ''}">` +
        `<span class="fg-face-sample" style="font-family:${css}">${sampleFor(f)}</span>` +
        `<span class="fg-face-name">${f.family}</span>` +
        `<span class="fg-face-lic">${f.license.id}</span></button>`;
    }
  }
  grid.innerHTML = html || `<div class="fg-facehead">${t('fg.familyNone')}</div>`;
  grid.querySelectorAll('.fg-face').forEach((b) => {
    b.addEventListener('click', () => pickFamily(b.dataset.family));
  });
}

function pickFamily(family) {
  if (!dlg || dlg.recipe.source.family === family) return;
  dlg.recipe.source.family = family;
  $('cf-family').value = family;
  forgetFallback();
  renderFamilyGrid();
  live.refresh(0);
}

// --- right-pane list ------------------------------------------------------

export function renderCustomFonts() {
  const el = $('cf-list');
  if (!el) return;
  el.innerHTML = '';
  const names = customFontNames(store.project);
  if (!names.length) { el.innerHTML = `<p class="sub">${t('cf.none')}</p>`; return; }

  for (const name of names) {
    const recipe = fontEntry(store.project, name).custom;
    const hit = cachedFont(name);
    const fresh = isCached(name, recipe);
    const row = document.createElement('div');
    row.className = 'fontrow';
    // "Not built" is the normal state right after opening a project — the
    // recipe is stored but the bytes are not, so say what will happen rather
    // than showing it as an error.
    const stateText = fresh
      ? `${hit.stats.glyphCount} ${t('cf.glyphs')} · ${fmtBytes(hit.stats.bytes)}`
      : recipe.source.kind === 'local' && !hasLocalFile(name)
        ? t('cf.needsFile')
        : t('cf.notBuilt');
    row.innerHTML =
      `<div><div class="fn">${name} <span class="sub">${recipe.size}px</span></div>` +
      `<div class="sub">${recipe.source.family} · ${stateText}</div></div>` +
      `<span><button class="mini" data-edit="${name}">${t('cf.edit')}</button>` +
      `<button class="rm" data-rm="${name}" title="${t('fonts.remove')}">×</button></span>`;
    el.appendChild(row);
  }
  el.querySelectorAll('button[data-edit]').forEach((b) => {
    b.addEventListener('click', () => openDialog(b.dataset.edit));
  });
  el.querySelectorAll('button[data-rm]').forEach((b) => {
    b.addEventListener('click', () => {
      forgetFont(b.dataset.rm);
      mutate((st) => removeFont(st.project, b.dataset.rm));
    });
  });
}

// Bring a stored recipe up to the current set model.
function migrated(recipe) {
  const legacy = recipe.presets || [];
  recipe.sets = migrateSets(recipe.sets || legacy);
  delete recipe.presets;
  return recipe;
}

// --- dialog ---------------------------------------------------------------

let charsetUI = null;

const dlgCharset = () => splitBmp(resolveCharset({
  sets: dlg.recipe.sets,
  customText: dlg.recipe.customText,
  customRanges: dlg.recipe.customRanges,
})).bmp;

function updateCount() {
  const cps = dlgCharset();
  $('cf-charcount').textContent = t('fg.charCount', { n: cps.length.toLocaleString() });
  const approx = Math.round(cps.length * (dlg.recipe.size * dlg.recipe.size * 0.18 + 6));
  $('cf-estimate').textContent = cps.length ? t('fg.estimate', { size: fmtBytes(approx) }) : '';
  syncSample();
  renderCharmapPanel();
}

function fillCharmapScope() {
  const sel = $('cf-charmap-scope');
  const keep = sel.value;
  sel.innerHTML = `<option value="">${t('cm.scopeSelected')}</option>` +
    ALL_SET_IDS.map((id) => `<option value="${id}">${t('cs.set.' + id)} (${countOf(id).toLocaleString()})</option>`).join('');
  if (keep) sel.value = keep;
}

// Only rendered while the panel is open — a CJK set is twenty thousand nodes'
// worth of text and nobody should pay for it just by opening the dialog.
function renderCharmapPanel() {
  if (!dlg || !$('cf-charmap-details').open) return;
  const scope = $('cf-charmap-scope').value;
  const cps = scope ? codepointsOfSet(scope) : dlgCharset();
  // After a build the same view reports coverage: characters this typeface
  // turned out not to have are struck through where they sit.
  const missing = !scope && dlg.built ? dlg.built.entry.missing : null;
  $('cf-charmap-note').textContent = missing && missing.length
    ? t('cm.missingNote', { n: missing.length.toLocaleString() })
    : t('cm.note');
  renderCharmap($('cf-charmap'), cps, { missing, emptyText: t('cm.empty') });
}

function setTab(kind) {
  if (dlg && dlg.recipe.source.kind !== kind) forgetFallback();
  dlg.recipe.source.kind = kind;
  live?.refresh(0);
  $('cf-tab-google').classList.toggle('on', kind === 'google');
  $('cf-tab-local').classList.toggle('on', kind === 'local');
  $('cf-src-google').hidden = kind !== 'google';
  $('cf-src-local').hidden = kind !== 'local';
}

export function openDialog(name = null) {
  const existing = name ? fontEntry(store.project, name) : null;
  dlg = {
    editing: name,
    // Recipes saved against the previous set ids are mapped onto current ones
    // (charsets.js migrateSets) rather than silently losing their selection.
    recipe: existing ? migrated(structuredClone(existing.custom)) : blankRecipe(),
    built: null,
  };

  $('cf-name').value = name || 'MyFont';
  $('cf-name').disabled = !!name; // renaming would orphan the Text refs
  $('cf-size').value = dlg.recipe.size;
  $('cf-threshold').value = dlg.recipe.threshold;
  $('cf-format').value = formatOf(dlg.recipe);
  $('cf-bpp').value = String(dlg.recipe.bpp || 2);
  syncFormatUI();
  $('cf-weight').value = dlg.recipe.source.weight;
  $('cf-custom').value = dlg.recipe.customText;
  $('cf-ranges').value = dlg.recipe.customRanges;
  $('cf-family').innerHTML = FONTS
    .map((f) => `<option value="${f.family}">${f.family} — ${f.license.id}</option>`).join('');
  $('cf-family').value = dlg.recipe.source.kind === 'google' ? dlg.recipe.source.family : FONTS[0].family;
  $('cf-family-search').value = '';
  renderFamilyGrid();
  $('cf-filename').textContent = dlg.recipe.source.kind === 'local' ? dlg.recipe.source.family : '';
  $('cf-err').textContent = '';
  $('cf-status').textContent = '';
  $('cf-preview-wrap').hidden = true;
  $('cf-fallback-offer').hidden = true;
  dlg.fallbackPlan = null;
  if (dlg.recipe.fallback) showFallbackActive();

  sampleEdited = false;
  preferredSample = '';

  setTab(dlg.recipe.source.kind);
  charsetUI.render();
  fillCharmapScope();
  $('cf-charmap-details').open = false;
  updateCount();
  $('cf-overlay').hidden = false;
  live.refresh(0);
}

const closeDialog = () => { $('cf-overlay').hidden = true; dlg = null; };

// A fallback is a decision about ONE typeface's gaps. Switching typeface (or
// weight) makes it meaningless, so it is dropped rather than carried over to a
// font whose gaps are different.
function forgetFallback() {
  if (!dlg) return;
  dlg.recipe.fallback = null;
  dlg.fallbackPlan = null;
  dlg.built = null;
  $('cf-fallback-offer').hidden = true;
  dlg.fallbackPlan = null;
  if (dlg.recipe.fallback) showFallbackActive();
}

// Once it is on, keep it visible and changeable — otherwise the only way back
// would be to delete the font and start again.
function showFallbackActive() {
  $('cf-fallback-offer').hidden = false;
  $('cf-fallback-apply').hidden = true;
  $('cf-fallback-clear').hidden = false;
  $('cf-fallback-text').innerHTML = `<div>${t('fb.active')}</div>`;
  $('cf-fallback-pick').innerHTML =
    `<option value="${FALLBACK_AUTO}">${t('fb.auto')}</option>` +
    FALLBACK_CHAIN.map((f) => `<option value="${f}">${f}</option>`).join('');
  $('cf-fallback-pick').value = dlg.recipe.fallback;
}

// Offer to fill gaps from another typeface. Never applies anything on its own:
// mixing typefaces changes how the font looks, so it is the user's call.
async function offerFallback(missing) {
  const box = $('cf-fallback-offer');
  box.hidden = true;
  if (dlg.recipe.fallback) { showFallbackActive(); return; }
  if (!missing.length) return;
  $('cf-fallback-text').innerHTML = `<span class="sub">${t('fb.checking')}</span>`;
  box.hidden = false;
  const style = { weight: dlg.recipe.source.weight, italic: !!dlg.recipe.source.italic };
  const found = await probeFallback(missing, style, dlg.recipe.source.kind === 'google' ? dlg.recipe.source.family : null);
  if (!dlg) return;
  if (!found.length) {
    $('cf-fallback-text').innerHTML = `<span class="sub">${t('fb.noneFound', { n: missing.length })}</span>`;
    $('cf-fallback-apply').hidden = true;
    return;
  }
  $('cf-fallback-apply').hidden = false;
  $('cf-fallback-clear').hidden = true;
  dlg.fallbackPlan = found.map((f) => f.family);
  const covered = found.reduce((a, f) => a + [...f.chars].length, 0);
  $('cf-fallback-text').innerHTML =
    `<div>${t('fb.offer', { n: covered, of: missing.length })}</div>` +
    found.map((f) => `<div class="sub">${f.family}: <span class="fg-chars">${f.chars.slice(0, 40)}</span></div>`).join('');
  $('cf-fallback-pick').innerHTML =
    `<option value="${FALLBACK_AUTO}">${t('fb.auto')}</option>` +
    FALLBACK_CHAIN.map((f) => `<option value="${f}">${f}</option>`).join('');
  $('cf-fallback-pick').value = FALLBACK_AUTO;
}

// Build with the dialog's current values, reporting progress and errors inline.
async function buildNow() {
  const name = ($('cf-name').value || '').trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) { $('cf-err').textContent = t('cf.errName'); return null; }
  if (dlg.recipe.source.kind === 'local' && !hasLocalFile(name) && !dlg.pendingFile) {
    $('cf-err').textContent = t('fg.errNoFile');
    return null;
  }
  if (!dlgCharset().length) { $('cf-err').textContent = t('cf.errNoChars'); return null; }

  $('cf-err').textContent = '';
  $('cf-ok').disabled = $('cf-preview-btn').disabled = true;
  try {
    if (dlg.pendingFile) rememberLocalFile(name, dlg.pendingFile);
    const entry = await buildFont(name, dlg.recipe, {
      onProgress: ({ done, total }) => {
        $('cf-status').textContent = t('fg.statusRaster', { done: done.toLocaleString(), total: total.toLocaleString() });
      },
    });
    const filled = (entry.sources || []).slice(1);
    $('cf-status').textContent = t('cf.built', {
      glyphs: entry.stats.glyphCount.toLocaleString(), size: fmtBytes(entry.stats.bytes),
    }) + filled.map((src) => '  ' + t('fb.filled', {
      n: src.count, family: src.family, sample: src.chars.slice(0, 12),
    })).join('');
    dlg.built = { name, entry };
    drawPreview(entry);
    renderCharmapPanel();
    offerFallback(entry.missing);
    return dlg.built;
  } catch (e) {
    $('cf-err').textContent = e.message;
    $('cf-status').textContent = '';
    return null;
  } finally {
    $('cf-ok').disabled = $('cf-preview-btn').disabled = false;
  }
}

// Draw a sample from the generated 1bpp glyphs — the same pixels the panel gets.
function drawPreview(entry) {
  const glyphs = [...entry.model.glyphs.keys()];
  const have = new Set(glyphs);
  const text = ['Hello 25.6℃', 'あア漢字 12:34', 'ABC abc 0123']
    .find((s) => [...s].every((c) => have.has(c.codePointAt(0))))
    || glyphs.slice(0, 20).map((c) => String.fromCodePoint(c)).join('');
  // The built model is 8bpp for any anti-aliased format; show it at the depth
  // the encoder kept, not at full coverage.
  drawModel($('cf-preview'), quantizeCoverage(entry.model, entry.bpp || 1), text, 1);
  $('cf-preview-wrap').hidden = false;
}

export function initCustomFonts() {
  if (!$('cf-overlay')) return;

  $('cf-add').addEventListener('click', () => openDialog(null));
  $('cf-cancel').addEventListener('click', closeDialog);
  $('cf-tab-google').addEventListener('click', () => { setTab('google'); dlg.recipe.source.family = $('cf-family').value; renderFamilyGrid(); });
  $('cf-tab-local').addEventListener('click', () => setTab('local'));

  $('cf-family-search').addEventListener('input', renderFamilyGrid);
  $('cf-weight').addEventListener('change', () => { dlg.recipe.source.weight = Number($('cf-weight').value); forgetFallback(); live.refresh(0); });
  $('cf-size').addEventListener('input', () => { dlg.recipe.size = Number($('cf-size').value) || 32; updateCount(); live.refresh(); });
  $('cf-threshold').addEventListener('input', () => { dlg.recipe.threshold = Number($('cf-threshold').value) || 128; live.refresh(); });
  // Changing format or depth changes the GLYPHS, not just the packing: a binary
  // pass and an anti-aliased one rasterize differently, so the built bytes are
  // dropped and the preview re-rendered rather than reused.
  $('cf-format').addEventListener('change', () => {
    dlg.recipe.format = $('cf-format').value;
    dlg.built = null;
    syncFormatUI();
    live.refresh(0);
  });
  $('cf-bpp').addEventListener('change', () => {
    dlg.recipe.bpp = Number($('cf-bpp').value) || 2;
    dlg.built = null;
    syncFormatUI();
    live.refresh(0);
  });

  // Live preview beside the controls: only the sample string is rasterized, so
  // it stays instant no matter how large the character set is.
  live = createLivePreview({
    canvas: $('cf-live'),
    statusEl: $('cf-live-status'),
    t,
    // A debounced refresh can land after the dialog closed; an empty sample
    // makes the preview clear itself instead of throwing on a null dialog.
    settings: () => (!dlg ? { sample: '' } : {
      kind: dlg.recipe.source.kind,
      family: dlg.recipe.source.family,
      weight: dlg.recipe.source.weight,
      italic: !!dlg.recipe.source.italic,
      size: dlg.recipe.size,
      threshold: dlg.recipe.threshold,
      bpp: bppOf(dlg.recipe),
      localBuffer: dlg.pendingFile || null,
      sample: $('cf-live-sample').value,
      scale: Number($('cf-live-zoom').value),
      allowed: new Set(dlgCharset()),
    }),
  });
  $('cf-live-sample').addEventListener('input', () => {
    // Blanking the field hands control back to the selection.
    sampleEdited = $('cf-live-sample').value.trim() !== '';
    if (!sampleEdited) { preferredSample = ''; syncSample(); }
    live.refresh();
  });
  $('cf-live-zoom').addEventListener('change', () => live.refresh(0));
  $('cf-custom').addEventListener('input', () => { dlg.recipe.customText = $('cf-custom').value; updateCount(); });
  $('cf-ranges').addEventListener('input', () => { dlg.recipe.customRanges = $('cf-ranges').value; updateCount(); });

  $('cf-file').addEventListener('change', async () => {
    const file = $('cf-file').files[0];
    if (!file) return;
    dlg.pendingFile = await file.arrayBuffer();
    dlg.recipe.source.family = file.name.replace(/\.[^.]+$/, '');
    $('cf-filename').textContent = file.name;
    forgetFallback();
    live.refresh(0);
  });

  charsetUI = createCharsetUI({
    host: $('cf-presets'),
    getSets: () => dlg.recipe.sets,
    setSets: (v) => { dlg.recipe.sets = v; updateCount(); live?.refresh(); },
    getText: () => dlg.recipe.customText,
    setText: (v) => { dlg.recipe.customText = v; $('cf-custom').value = v; },
    setSample: (v) => { preferredSample = v; sampleEdited = false; },
  });

  $('cf-charmap-details').addEventListener('toggle', renderCharmapPanel);
  $('cf-charmap-scope').addEventListener('change', renderCharmapPanel);
  $('cf-fallback-apply').addEventListener('click', () => {
    const pick = $('cf-fallback-pick').value || FALLBACK_AUTO;
    if (pick !== FALLBACK_AUTO) dlg.fallbackPlan = null;
    dlg.recipe.fallback = pick;
    $('cf-fallback-offer').hidden = true;
  dlg.fallbackPlan = null;
  if (dlg.recipe.fallback) showFallbackActive();
    buildNow();
  });
  // Changing the source while it is on rebuilds with the new one.
  $('cf-fallback-pick').addEventListener('change', () => {
    if (!dlg || !dlg.recipe.fallback) return;
    dlg.recipe.fallback = $('cf-fallback-pick').value;
    dlg.fallbackPlan = null;
    buildNow();
  });
  $('cf-fallback-clear').addEventListener('click', () => {
    dlg.recipe.fallback = null;
    dlg.fallbackPlan = null;
    buildNow();
  });
  $('cf-preview-btn').addEventListener('click', buildNow);

  $('cf-ok').addEventListener('click', async () => {
    // Always build before adopting: a recipe that cannot produce a font must
    // not end up on the project, where it would only fail again at export.
    const ok = (dlg.built && dlg.built.entry.key === recipeKey(dlg.recipe) && dlg.built.name === $('cf-name').value.trim())
      ? dlg.built : await buildNow();
    if (!ok) return;
    mutate((st) => adoptCustomFont(st.project, ok.name, dlg.recipe));
    closeDialog();
  });
}
