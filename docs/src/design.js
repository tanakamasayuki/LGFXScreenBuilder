// Design mode: two-axis editor (scenes in the left pane x profiles as top tabs).
// Each profile holds an independent layout per scene; switching either axis
// re-renders the canvas. Ported from the validated design probe.
import { store, update, emit } from './store.js';
import {
  DATUMS, DATUM_FX, DATUM_FY, orient, pxOf, sceneById, profileById, partDef, placement,
} from './model.js';

const $ = (id) => document.getElementById(id);

const curScene = () => sceneById(store.project, store.ui.sceneId);
const curProfile = () => profileById(store.project, store.ui.profileId);
const curPlacement = (partId) => placement(curProfile(), store.ui.sceneId, partId);

let scale = 1; // canvas px per logical px (fit * zoom)

// --- left: scene list ----------------------------------------------------
function renderScenes() {
  const el = $('scene-list');
  el.innerHTML = '';
  for (const s of store.project.scenes) {
    const it = document.createElement('div');
    it.className = 'sitem' + (s.id === store.ui.sceneId ? ' active' : '');
    it.innerHTML = `<span>${s.id}</span><span class="cnt">${s.parts.length} parts</span>`;
    it.onclick = () => update((st) => { st.ui.sceneId = s.id; st.ui.selected = null; });
    el.appendChild(it);
  }
}

// --- center: profile tabs ------------------------------------------------
function renderTabs() {
  const el = $('profile-tabs');
  el.innerHTML = '';
  for (const p of store.project.profiles) {
    const t = document.createElement('div');
    t.className = 'tab' + (p.id === store.ui.profileId ? ' active' : '');
    const def = store.project.defaultProfile === p.id ? '<span class="defbadge">default</span>' : '';
    t.innerHTML = `<span class="t1">${p.id}${def}</span>` +
      `<span class="t2">${p.w}×${p.h} · ${orient(p.w, p.h)} · rot${p.rotation}</span>`;
    t.onclick = () => update((st) => { st.ui.profileId = p.id; });
    el.appendChild(t);
  }
}

// --- center: canvas ------------------------------------------------------
function renderCanvas() {
  const pr = curProfile();
  const scr = $('canvas-screen');
  scale = Math.min(440 / pr.w, 300 / pr.h, 2.2) * store.ui.zoom;
  scr.style.width = pr.w * scale + 'px';
  scr.style.height = pr.h * scale + 'px';
  scr.style.background = store.project.background;
  scr.innerHTML = '';

  for (const def of curScene().parts) {
    const e = curPlacement(def.id);
    if (!e) continue;
    const d = document.createElement('div');
    d.className = 'part ' + def.type.toLowerCase() +
      (def.id === store.ui.selected ? ' selected' : '') + (e.visible ? '' : ' hidden');
    d.dataset.id = def.id;

    if (def.type === 'Text') {
      d.style.color = e.color;
      d.style.fontSize = e.size * 8 * scale + 'px';
      d.textContent = e.text;
      scr.appendChild(d); // append first to measure
      const bw = d.offsetWidth, bh = d.offsetHeight;
      const fx = DATUM_FX[e.datum[1]] || 0, fy = DATUM_FY[e.datum[0]] || 0;
      d.style.left = e.x * scale - fx * bw + 'px';
      d.style.top = e.y * scale - fy * bh + 'px';
      if (def.id === store.ui.selected) {
        const a = document.createElement('div');
        a.className = 'anchor';
        a.style.left = e.x * scale + 'px';
        a.style.top = e.y * scale + 'px';
        scr.appendChild(a);
      }
    } else {
      d.style.left = e.x * scale + 'px';
      d.style.top = e.y * scale + 'px';
      d.style.width = e.w * scale + 'px';
      d.style.height = e.h * scale + 'px';
      if (def.type === 'Rect') d.style.background = e.color;
      scr.appendChild(d);
    }
  }
}

// --- left: part list -----------------------------------------------------
function renderParts() {
  const el = $('part-list');
  el.innerHTML = '';
  $('parts-title').textContent = `Parts（${store.ui.sceneId}）`;
  for (const def of curScene().parts) {
    const e = curPlacement(def.id);
    const it = document.createElement('div');
    it.className = 'pitem' + (def.id === store.ui.selected ? ' active' : '');
    it.innerHTML = `<span>${def.id}${e && e.visible ? '' : ' （非表示）'}</span><span class="ty">${def.type}</span>`;
    it.onclick = () => update((st) => { st.ui.selected = def.id; });
    el.appendChild(it);
  }
}

// --- left: profile meta --------------------------------------------------
function renderProfMeta() {
  const pr = curProfile();
  $('prof-meta').innerHTML =
    `<div class="field"><label>サイズ</label><input value="${pr.w} × ${pr.h}" disabled></div>` +
    `<div class="field"><label>回転</label><input value="${pr.rotation}（${orient(pr.w, pr.h)}）" disabled></div>` +
    `<p class="sub">サイズ・回転・ボード割当は Profiles 画面。ここは配置編集。</p>`;
}

// --- right: inspector ----------------------------------------------------
function row(key, label, type, val) {
  if (type === 'checkbox') {
    return `<div class="field"><label>${label}</label><input type="checkbox" data-k="${key}" ${val ? 'checked' : ''} style="width:auto;min-height:auto"></div>`;
  }
  return `<div class="field"><label>${label}</label><input type="${type}" data-k="${key}" value="${val}"></div>`;
}

function renderInspector() {
  const el = $('props');
  const sel = store.ui.selected;
  if (!sel) { renderSceneProps(); return; }
  const def = partDef(curScene(), sel);
  const e = curPlacement(sel);
  $('insp-title').textContent = `プロパティ（${store.ui.sceneId} / ${store.ui.profileId}）`;
  if (!def || !e) { el.innerHTML = '<p class="sub">パーツを選択してください。</p>'; return; }

  let h = '';
  if (def.type === 'Text') {
    h += `<div class="two">${row('x', 'アンカー X', 'number', e.x)}${row('y', 'アンカー Y', 'number', e.y)}</div>`;
    h += `<div class="field"><label>基準点（datum）</label><select data-k="datum">` +
      DATUMS.map(([v, l]) => `<option value="${v}" ${e.datum === v ? 'selected' : ''}>${v}（${l}）</option>`).join('') +
      `</select></div>`;
    h += row('text', '文字', 'text', e.text);
    h += `<div class="field"><div class="lab"><label>文字サイズ（倍率）</label><span class="sub" id="px-hint">≈ ${pxOf(e.size)}px</span></div>` +
      `<input type="number" data-k="size" step="0.25" min="0.25" value="${e.size}"></div>`;
  } else {
    h += `<div class="two">${row('x', 'X', 'number', e.x)}${row('y', 'Y', 'number', e.y)}</div>`;
    h += `<div class="two">${row('w', '幅', 'number', e.w)}${row('h', '高さ', 'number', e.h)}</div>`;
    if (def.type === 'Rect') h += `<div class="field"><label>色</label><input type="color" data-k="color" value="${e.color}"></div>`;
  }
  h += row('visible', '表示', 'checkbox', e.visible);
  h += `<div class="field"><label>備考（全プロファイル共通）</label><textarea id="p-desc" rows="2">${def.desc || ''}</textarea></div>`;
  el.innerHTML = h;

  el.querySelectorAll('[data-k]').forEach((inp) => {
    const k = inp.dataset.k, t = inp.type;
    const ev = t === 'checkbox' ? 'change' : 'input';
    inp.addEventListener(ev, () => {
      const v = t === 'checkbox' ? inp.checked : (t === 'number' ? (+inp.value || 0) : inp.value);
      e[k] = v;
      if (k === 'size') { const hint = $('px-hint'); if (hint) hint.textContent = '≈ ' + pxOf(v) + 'px'; }
      // keep focus: rerender canvas/list/status but not the inspector
      renderCanvas(); renderParts(); renderStatus();
    });
  });
  const dsc = el.querySelector('#p-desc');
  if (dsc) dsc.oninput = (ev2) => { def.desc = ev2.target.value; };
}

// Part deselected -> edit the scene's own properties (§8.13).
function renderSceneProps() {
  const s = curScene();
  $('insp-title').textContent = `画面プロパティ（${s.id}）`;
  $('props').innerHTML =
    `<div class="field"><label>シーン ID</label><input value="${s.id}" disabled></div>` +
    `<div class="field"><label>パーツ数</label><input value="${s.parts.length}" disabled></div>` +
    `<div class="field"><label>備考（この画面のメモ）</label><textarea id="s-desc" rows="3">${s.desc || ''}</textarea></div>` +
    `<p class="sub">回転はプロファイル単位（Profiles 画面）。パーツを選ぶと配置を編集します。</p>`;
  const dsc = $('s-desc');
  if (dsc) dsc.oninput = (ev) => { s.desc = ev.target.value; };
}

function renderStatus() {
  const pr = curProfile();
  const e = store.ui.selected ? curPlacement(store.ui.selected) : null;
  const detail = e
    ? ('w' in e ? `x:${e.x}, y:${e.y}, w:${e.w}, h:${e.h}` : `x:${e.x}, y:${e.y}, datum:${e.datum}, ×${e.size}`)
    : '';
  $('st-sel').textContent = e ? `${store.ui.sceneId} / 選択: ${store.ui.selected}  (${detail})` : `${store.ui.sceneId} / 未選択`;
  $('st-prof').textContent = `${pr.id} ${pr.w}×${pr.h}（${orient(pr.w, pr.h)} / rotation ${pr.rotation}）`;
  $('zoom-label').textContent = Math.round(store.ui.zoom * 100) + '%';
}

export function renderDesign() {
  renderScenes(); renderTabs(); renderCanvas(); renderParts(); renderProfMeta();
  renderInspector(); renderStatus();
}

// --- interactions (attached once) ---------------------------------------
let drag = null;
export function initDesign() {
  const scr = $('canvas-screen');

  scr.addEventListener('pointerdown', (ev) => {
    if (ev.button !== 0) return;
    const id = ev.target.dataset.id;
    if (!id) { update((st) => { st.ui.selected = null; }); return; }
    update((st) => { st.ui.selected = id; });
    const e = curPlacement(id);
    drag = { id, sx: ev.clientX, sy: ev.clientY, ox: e.x, oy: e.y };
    scr.setPointerCapture(ev.pointerId);
    ev.preventDefault();
  });
  scr.addEventListener('pointermove', (ev) => {
    if (!drag) return;
    const e = curPlacement(drag.id);
    e.x = drag.ox + Math.round((ev.clientX - drag.sx) / scale);
    e.y = drag.oy + Math.round((ev.clientY - drag.sy) / scale);
    renderCanvas(); renderParts(); renderInspector(); renderStatus();
  });
  scr.addEventListener('pointerup', () => { if (drag) { drag = null; renderInspector(); } });

  // Click empty stage / device frame -> deselect -> scene props.
  const stage = $('stage');
  stage.addEventListener('pointerdown', (ev) => {
    if (ev.button !== 0) return;
    if (ev.target.closest('.part') || ev.target.id === 'canvas-screen') return;
    if (store.ui.selected !== null) update((st) => { st.ui.selected = null; });
  });

  // Keymap (§8.14): arrows move ±1, Ctrl ×10, Shift = resize (Rect/Image only).
  document.addEventListener('keydown', (ev) => {
    if (store.ui.mode !== 'design' || !store.ui.selected) return;
    const tag = document.activeElement && document.activeElement.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[ev.key];
    if (!dir) return;
    ev.preventDefault();
    const step = (ev.ctrlKey || ev.metaKey) ? 10 : 1;
    const e = curPlacement(store.ui.selected);
    if (ev.shiftKey) {
      if (!('w' in e)) return; // Text has no box
      e.w = Math.max(2, e.w + dir[0] * step);
      e.h = Math.max(2, e.h + dir[1] * step);
    } else {
      e.x += dir[0] * step;
      e.y += dir[1] * step;
    }
    renderCanvas(); renderParts(); renderInspector(); renderStatus();
  });

  // Zoom controls.
  const setZoom = (z) => update((st) => { st.ui.zoom = Math.max(0.4, Math.min(6, z)); });
  $('zoom-in').onclick = () => setZoom(store.ui.zoom * 1.2);
  $('zoom-out').onclick = () => setZoom(store.ui.zoom / 1.2);
  $('zoom-reset').onclick = () => setZoom(1);
  scr.addEventListener('wheel', (ev) => { ev.preventDefault(); setZoom(store.ui.zoom * (ev.deltaY < 0 ? 1.1 : 1 / 1.1)); }, { passive: false });
}
