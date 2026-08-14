// Generated-font UI inside the editor (Fonts mode, §8.7.7).
//
// Same pipeline as the standalone page, different ending: instead of handing
// the user a .h to download, this stores the RECIPE on the project and keeps
// the bytes in the session cache (build.js). The project file therefore never
// carries font data, and export rebuilds what it needs.
import { store, mutate } from '../store.js';
import { adoptCustomFont, removeFont, customFontNames, fontEntry } from '../model.js';
import { t } from '../i18n.js';
import { PRESETS, PRESET_GROUPS, resolveCharset, splitBmp, codepointsOfPreset } from './charsets.js';
import { renderCharmap } from './charmap.js';
import { FONTS } from './googlefonts.js';
import { buildFont, cachedFont, isCached, rememberLocalFile, hasLocalFile, forgetFont, recipeKey } from './build.js';

const $ = (id) => document.getElementById(id);
const fmtBytes = (n) => (n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(2)} MB`);

// Dialog state; `editing` is the name being replaced, or null when adding.
let dlg = null;

const blankRecipe = () => ({
  source: { kind: 'google', family: 'M PLUS 1 Code', weight: 400, italic: false },
  size: 16,
  threshold: 128,
  presets: ['ascii'],
  customText: '',
  customRanges: '',
});

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

// --- dialog ---------------------------------------------------------------

function renderPresetChips() {
  const host = $('cf-presets');
  host.innerHTML = '';
  for (const group of PRESET_GROUPS) {
    const row = document.createElement('div');
    row.className = 'fg-chips';
    row.style.marginBottom = '4px';
    for (const p of PRESETS.filter((x) => x.group === group)) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'fchip' + (dlg.recipe.presets.includes(p.id) ? ' on' : '');
      b.innerHTML = `${t('fg.preset.' + p.id)} <span class="fg-n">${p.count.toLocaleString()}</span>`;
      b.onclick = () => {
        const i = dlg.recipe.presets.indexOf(p.id);
        if (i < 0) dlg.recipe.presets.push(p.id); else dlg.recipe.presets.splice(i, 1);
        renderPresetChips();
        updateCount();
      };
      row.appendChild(b);
    }
    host.appendChild(row);
  }
}

const dlgCharset = () => splitBmp(resolveCharset({
  presets: dlg.recipe.presets,
  customText: dlg.recipe.customText,
  customRanges: dlg.recipe.customRanges,
})).bmp;

function updateCount() {
  const cps = dlgCharset();
  $('cf-charcount').textContent = t('fg.charCount', { n: cps.length.toLocaleString() });
  const approx = Math.round(cps.length * (dlg.recipe.size * dlg.recipe.size * 0.18 + 6));
  $('cf-estimate').textContent = cps.length ? t('fg.estimate', { size: fmtBytes(approx) }) : '';
  renderCharmapPanel();
}

function fillCharmapScope() {
  const sel = $('cf-charmap-scope');
  const keep = sel.value;
  sel.innerHTML = `<option value="">${t('cm.scopeSelected')}</option>` +
    PRESETS.map((p) => `<option value="${p.id}">${t('fg.preset.' + p.id)} (${p.count.toLocaleString()})</option>`).join('');
  if (keep) sel.value = keep;
}

// Only rendered while the panel is open — a CJK set is twenty thousand nodes'
// worth of text and nobody should pay for it just by opening the dialog.
function renderCharmapPanel() {
  if (!dlg || !$('cf-charmap-details').open) return;
  const scope = $('cf-charmap-scope').value;
  const cps = scope ? codepointsOfPreset(scope) : dlgCharset();
  // After a build the same view reports coverage: characters this typeface
  // turned out not to have are struck through where they sit.
  const missing = !scope && dlg.built ? dlg.built.entry.missing : null;
  $('cf-charmap-note').textContent = missing && missing.length
    ? t('cm.missingNote', { n: missing.length.toLocaleString() })
    : t('cm.note');
  renderCharmap($('cf-charmap'), cps, { missing, emptyText: t('cm.empty') });
}

function setTab(kind) {
  dlg.recipe.source.kind = kind;
  $('cf-tab-google').classList.toggle('on', kind === 'google');
  $('cf-tab-local').classList.toggle('on', kind === 'local');
  $('cf-src-google').hidden = kind !== 'google';
  $('cf-src-local').hidden = kind !== 'local';
}

export function openDialog(name = null) {
  const existing = name ? fontEntry(store.project, name) : null;
  dlg = {
    editing: name,
    recipe: existing ? structuredClone(existing.custom) : blankRecipe(),
    built: null,
  };

  $('cf-name').value = name || 'MyFont';
  $('cf-name').disabled = !!name; // renaming would orphan the Text refs
  $('cf-size').value = dlg.recipe.size;
  $('cf-threshold').value = dlg.recipe.threshold;
  $('cf-weight').value = dlg.recipe.source.weight;
  $('cf-custom').value = dlg.recipe.customText;
  $('cf-ranges').value = dlg.recipe.customRanges;
  $('cf-family').innerHTML = FONTS
    .map((f) => `<option value="${f.family}">${f.family} — ${f.license.id}</option>`).join('');
  $('cf-family').value = dlg.recipe.source.kind === 'google' ? dlg.recipe.source.family : FONTS[0].family;
  $('cf-filename').textContent = dlg.recipe.source.kind === 'local' ? dlg.recipe.source.family : '';
  $('cf-err').textContent = '';
  $('cf-status').textContent = '';
  $('cf-preview-wrap').hidden = true;

  setTab(dlg.recipe.source.kind);
  renderPresetChips();
  fillCharmapScope();
  $('cf-charmap-details').open = false;
  updateCount();
  $('cf-overlay').hidden = false;
}

const closeDialog = () => { $('cf-overlay').hidden = true; dlg = null; };

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
    $('cf-status').textContent = t('cf.built', {
      glyphs: entry.stats.glyphCount.toLocaleString(), size: fmtBytes(entry.stats.bytes),
    });
    dlg.built = { name, entry };
    drawPreview(entry);
    renderCharmapPanel();
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
  const have = new Map(entry.glyphs.map((g) => [g.code, g]));
  const text = ['Hello 25.6℃', 'あア漢字 12:34', 'ABC abc 0123']
    .find((s) => [...s].every((c) => have.has(c.codePointAt(0))))
    || entry.glyphs.slice(0, 20).map((g) => String.fromCodePoint(g.code)).join('');
  const chars = [...text].map((c) => have.get(c.codePointAt(0))).filter(Boolean);
  const scale = 2;
  const cv = $('cf-preview');
  cv.width = Math.max(1, chars.reduce((a, g) => a + g.dx, 0)) * scale;
  cv.height = entry.font.height * scale;
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#11191d';
  ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.fillStyle = '#7fe3a0';
  const baseline = entry.font.height - entry.font.descent;
  let pen = 0;
  for (const g of chars) {
    const top = baseline - g.y - g.h;
    for (let py = 0; py < g.h; py++) {
      for (let px = 0; px < g.w; px++) {
        if (g.bits[py * g.w + px]) ctx.fillRect((pen + g.x + px) * scale, (top + py) * scale, scale, scale);
      }
    }
    pen += g.dx;
  }
  $('cf-preview-wrap').hidden = false;
}

export function initCustomFonts() {
  if (!$('cf-overlay')) return;

  $('cf-add').addEventListener('click', () => openDialog(null));
  $('cf-cancel').addEventListener('click', closeDialog);
  $('cf-tab-google').addEventListener('click', () => { setTab('google'); dlg.recipe.source.family = $('cf-family').value; });
  $('cf-tab-local').addEventListener('click', () => setTab('local'));

  $('cf-family').addEventListener('change', () => { dlg.recipe.source.family = $('cf-family').value; });
  $('cf-weight').addEventListener('change', () => { dlg.recipe.source.weight = Number($('cf-weight').value); });
  $('cf-size').addEventListener('input', () => { dlg.recipe.size = Number($('cf-size').value) || 16; updateCount(); });
  $('cf-threshold').addEventListener('input', () => { dlg.recipe.threshold = Number($('cf-threshold').value) || 128; });
  $('cf-custom').addEventListener('input', () => { dlg.recipe.customText = $('cf-custom').value; updateCount(); });
  $('cf-ranges').addEventListener('input', () => { dlg.recipe.customRanges = $('cf-ranges').value; updateCount(); });

  $('cf-file').addEventListener('change', async () => {
    const file = $('cf-file').files[0];
    if (!file) return;
    dlg.pendingFile = await file.arrayBuffer();
    dlg.recipe.source.family = file.name.replace(/\.[^.]+$/, '');
    $('cf-filename').textContent = file.name;
  });

  $('cf-charmap-details').addEventListener('toggle', renderCharmapPanel);
  $('cf-charmap-scope').addEventListener('change', renderCharmapPanel);
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
