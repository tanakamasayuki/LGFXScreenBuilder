// Fonts mode: browse the preset catalog (filter + approximate preview), adopt a
// curated subset into the project, and enable each adopted font per profile
// (§8.7.3/§8.7.4). Filters are shown as open chip groups (not dropdowns) so every
// candidate is visible; the Height facet (rendered px) is the primary one.
import { store, mutate } from './store.js';
import { adoptFont, removeFont, toggleProfileFont, profileFonts, isFontAdopted } from './model.js';
import { filterCatalog, facets, HEIGHT_BUCKETS, approxCss, sampleFor, describe, loadMetrics, sampleImage, flashFor, fmtBytes, monoFor } from './fonts.js';
import { t } from './i18n.js';

const $ = (id) => document.getElementById(id);
const filters = { query: '', height: '', category: '', script: '', style: '', family: '' };

// Render one facet as a row of selectable chips ([All] + each option). Single-
// select (radio semantics): clicking the active chip's value is what stays set.
const chip = (key, value, label) =>
  `<button class="fchip${filters[key] === value ? ' on' : ''}" data-key="${key}" data-val="${value}">${label}</button>`;

function fillFilterControls() {
  const f = facets();
  const group = (id, key, opts) =>
    ($(id).innerHTML = chip(key, '', t('opt.all')) + opts.map(([v, l]) => chip(key, v, l)).join(''));
  group('font-height', 'height', HEIGHT_BUCKETS.map((b) => [b.key, `${b.label}px`]));
  group('font-cat', 'category', f.categories.map((c) => [c, c]));
  group('font-script', 'script', f.scripts.map((s) => [s, t('script.' + s)]));
  group('font-style', 'style', ['regular', 'bold', 'italic'].map((s) => [s, t('style.' + s)]));
  group('font-family', 'family', f.families.map((x) => [x, x]));
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
    const mono = monoFor(f.name);
    const wbadge = mono == null ? ''
      : `<span class="wbadge ${mono ? 'fixed' : 'prop'}">${t(mono ? 'font.mono' : 'font.prop')}</span>`;
    tile.innerHTML =
      prev +
      `<div class="fn">${adopted ? '✓ ' : ''}${f.name}</div>` +
      `<div class="fd">${describe(f)}${wbadge}</div>` +
      (adopted ? `<span class="ftile-rm" title="${t('fonts.remove')}">×</span>` : '');
    // Clicking a tile ADOPTS (add-only, non-destructive) — never removes, so a
    // stray click can't drop an adopted font (which would clear its per-profile
    // enables + Text refs). Removal is deliberate: the tile's × or the right panel.
    if (adopted) {
      // No body handler → clicking an adopted tile does nothing (non-destructive);
      // only the × removes (stopPropagation so it doesn't bubble to the tile).
      tile.querySelector('.ftile-rm').onclick = (ev) => {
        ev.stopPropagation();
        mutate((st) => removeFont(st.project, f.name));
      };
    } else {
      tile.onclick = () => mutate((st) => adoptFont(st.project, f.name));
    }
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
  $('font-q').addEventListener('input', () => { filters.query = $('font-q').value; renderGrid(); });
  // One delegated handler for every chip group: set the facet (toggle off if the
  // active chip is clicked again), restyle the chips, and re-filter the grid.
  for (const id of ['font-height', 'font-cat', 'font-script', 'font-style', 'font-family']) {
    $(id).addEventListener('click', (ev) => {
      const b = ev.target.closest('.fchip');
      if (!b) return;
      const key = b.dataset.key, val = b.dataset.val;
      filters[key] = filters[key] === val ? '' : val;
      $(id).querySelectorAll('.fchip').forEach((c) => c.classList.toggle('on', c.dataset.val === filters[key]));
      renderGrid();
    });
  }
  // Load host-rendered samples lazily; re-render once available so tiles switch
  // to the exact glyphs and the Height filter (needs metrics) takes effect.
  loadMetrics().then((m) => { if (m) renderGrid(); });
}
