// Fonts mode: browse the preset catalog (filter + approximate preview), adopt a
// curated subset into the project, and enable each adopted font per profile
// (§8.7.3/§8.7.4). Adopted+enabled fonts feed the Text font dropdown (later
// slice). Codegen `setFont` and the exact host-rendered preview come later.
import { store, mutate } from './store.js';
import { adoptFont, removeFont, toggleProfileFont, profileFonts, isFontAdopted } from './model.js';
import { filterCatalog, facets, approxCss, sampleFor, describe, loadMetrics, sampleImage, flashFor, fmtBytes } from './fonts.js';
import { t } from './i18n.js';

const $ = (id) => document.getElementById(id);
const filters = { query: '', category: '', script: '', style: '', family: '' };

const opt = (value, label, sel) => `<option value="${value}"${sel ? ' selected' : ''}>${label}</option>`;

function fillFilterControls() {
  const f = facets();
  $('font-cat').innerHTML = opt('', t('opt.all')) + f.categories.map((c) => opt(c, c)).join('');
  $('font-script').innerHTML = opt('', t('opt.all')) + f.scripts.map((s) => opt(s, t('script.' + s))).join('');
  $('font-style').innerHTML = opt('', t('opt.all')) + ['regular', 'bold', 'italic'].map((s) => opt(s, t('style.' + s))).join('');
  $('font-family').innerHTML = opt('', t('opt.all')) + f.families.map((x) => opt(x, x)).join('');
}

function renderGrid() {
  const list = filterCatalog(filters);
  $('font-count').textContent = t('fonts.count', { n: list.length });
  const grid = $('font-grid');
  grid.innerHTML = '';
  for (const f of list) {
    const adopted = isFontAdopted(store.project, f.name);
    const tile = document.createElement('button');
    tile.className = 'ftile' + (adopted ? ' adopted' : '');
    tile.dataset.name = f.name;
    // Prefer the exact host-rendered sample (atlas crop); fall back to approx.
    const img = sampleImage(f.name);
    let prev;
    if (img) {
      prev = `<div class="fprev real" style="width:${img.w}px;height:${img.h}px;` +
        `background-image:url('${img.atlas}');background-position:-${img.x}px -${img.y}px;` +
        `background-repeat:no-repeat" role="img" aria-label="${sampleFor(f)}"></div>`;
    } else {
      const size = Math.max(11, Math.min(f.size || 16, 26));
      prev = `<div class="fprev" style="font-family:${approxCss(f)};font-size:${size}px;${f.bold ? 'font-weight:700;' : ''}${f.italic ? 'font-style:italic;' : ''}">${sampleFor(f)}</div>`;
    }
    tile.innerHTML =
      prev +
      `<div class="fn">${adopted ? '✓ ' : ''}${f.name}</div>` +
      `<div class="fd">${describe(f)}</div>`;
    tile.onclick = () => mutate((st) => {
      if (isFontAdopted(st.project, f.name)) removeFont(st.project, f.name);
      else adoptFont(st.project, f.name);
    });
    grid.appendChild(tile);
  }
}

function renderAdopted() {
  const el = $('font-adopted');
  el.innerHTML = '';
  const fonts = store.project.fonts || [];
  $('font-adopted-title').textContent = `${t('fonts.adopted')} · ${t('fonts.adoptedCount', { n: fonts.length })}`;
  if (!fonts.length) { el.innerHTML = `<p class="sub">${t('fonts.none')}</p>`; return; }

  // Per-profile flash budget: sum the flash cost of the fonts enabled on each
  // profile (only the referenced fonts link — this is why the per-profile flag
  // matters; §8.7.4). Shown when host introspection (font-metrics.json) is loaded.
  if (flashFor(fonts[0].name) != null) {
    const totals = store.project.profiles.map((p) => {
      const sum = profileFonts(store.project, p.id).reduce((a, n) => a + (flashFor(n) || 0), 0);
      return `<span class="chip">${p.id}: ${fmtBytes(sum)}</span>`;
    }).join('');
    el.innerHTML = `<div class="font-budget"><span class="sub">${t('fonts.flashBudget')}:</span>${totals}</div>`;
  }

  for (const f of fonts) {
    const row = document.createElement('div');
    row.className = 'fontrow';
    const flash = flashFor(f.name);
    const flashTag = flash != null ? ` <span class="sub">· ${fmtBytes(flash)}</span>` : '';
    const profs = store.project.profiles
      .map((p) => `<label><input type="checkbox" data-prof="${p.id}" data-name="${f.name}" ${profileFonts(store.project, p.id).includes(f.name) ? 'checked' : ''} style="width:auto;min-height:auto"> ${p.id}</label>`)
      .join('');
    row.innerHTML =
      `<div><div class="fn">${f.name}${flashTag}</div><div class="profs"><span class="sub">${t('fonts.enabledOn')}:</span>${profs}</div></div>` +
      `<button class="rm" title="${t('fonts.remove')}" data-rm="${f.name}">×</button>`;
    el.appendChild(row);
  }
  el.querySelectorAll('input[data-prof]').forEach((cb) => {
    cb.addEventListener('change', () => mutate((st) => toggleProfileFont(st.project, cb.dataset.prof, cb.dataset.name)));
  });
  el.querySelectorAll('button[data-rm]').forEach((b) => {
    b.addEventListener('click', () => mutate((st) => removeFont(st.project, b.dataset.rm)));
  });
}

export function renderFonts() {
  renderGrid();
  renderAdopted();
}

export function initFonts() {
  fillFilterControls();
  const bind = (id, key, ev) => $(id).addEventListener(ev, () => { filters[key] = $(id).value; renderGrid(); });
  bind('font-q', 'query', 'input');
  bind('font-cat', 'category', 'change');
  bind('font-script', 'script', 'change');
  bind('font-style', 'style', 'change');
  bind('font-family', 'family', 'change');
  // Load host-rendered samples lazily; re-render the grid once available so the
  // tiles switch from the approximate preview to the exact glyphs.
  loadMetrics().then((m) => { if (m) renderGrid(); });
}
