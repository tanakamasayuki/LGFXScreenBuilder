// Design mode: two-axis editor (scenes in the left pane x profiles as top tabs).
// Each profile holds an independent layout per scene; switching either axis
// re-renders the canvas. Ported from the validated design probe.
import { store, update, mutate, checkpoint } from './store.js';
import {
  DATUMS, DATUM_FX, DATUM_FY, orient, dispDims, pxOf, sceneById, profileById, partDef, placement,
  addPart, removePart, renamePart, addScene, removeScene, renameScene,
  absOrigin, reorderPart, assetById, profileFonts,
  reconcileAiLayout, applyAiLayout,
} from './model.js';
import { loadMetrics, metricsFor, approxCss, approxWeight, fontByName, fontDetailUrl } from './fonts.js';
import { aiLayoutJson, parseAiLayout } from './ailayout.js';
import { downloadText } from './persist.js';
import { t } from './i18n.js';

// Transient bottom-center toast for one-shot feedback (e.g. clipboard copy).
function flash(msg) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(flash._t);
  flash._t = setTimeout(() => el.classList.remove('show'), 1800);
}

// Approximate on-canvas height (px) of a Text part's font at multiplier 1.
// Uses the host-introspected native height when available, else the default
// 8px (Font0). The exact glyphs differ (approximate preview, SPEC §8.7.3).
function fontBaseHeight(fontName) {
  if (!fontName) return 8;
  const m = metricsFor(fontName);
  return (m && m.height) || 8;
}

const $ = (id) => document.getElementById(id);

const curScene = () => sceneById(store.project, store.ui.sceneId);
const curProfile = () => profileById(store.project, store.ui.profileId);
const curPlacement = (partId) => placement(curProfile(), store.ui.sceneId, partId);
const orientText = (w, h) => t('orient.' + orient(w, h));

let scale = 1; // canvas px per logical px (fit * zoom)
// --- left: scene list ----------------------------------------------------
function renderScenes() {
  const el = $('scene-list');
  el.innerHTML = '';
  $('scene-del').disabled = store.project.scenes.length <= 1;
  for (const s of store.project.scenes) {
    const it = document.createElement('div');
    it.className = 'sitem' + (s.id === store.ui.sceneId ? ' active' : '');
    it.innerHTML = `<span>${s.id}</span><span class="cnt">${t('cnt.parts', { n: s.parts.length })}</span>`;
    it.onclick = () => { lineKeyMode = 'move'; update((st) => { st.ui.sceneId = s.id; st.ui.selected = null; }); };
    el.appendChild(it);
  }
}

// --- center: profile tabs ------------------------------------------------
function renderTabs() {
  const el = $('profile-tabs');
  el.innerHTML = '';
  for (const p of store.project.profiles) {
    const tab = document.createElement('div');
    tab.className = 'tab' + (p.id === store.ui.profileId ? ' active' : '');
    const d = dispDims(p); // show the effective (rotated) screen, matching the canvas
    tab.innerHTML = `<span class="t1">${p.id}</span>` +
      `<span class="t2">${d.w}×${d.h} · ${orientText(d.w, d.h)} · rot${p.rotation}</span>`;
    tab.onclick = () => update((st) => { st.ui.profileId = p.id; });
    el.appendChild(tab);
  }
}

// --- center: canvas ------------------------------------------------------
function renderCanvas() {
  const pr = curProfile();
  const scr = $('canvas-screen');
  const { w: dw, h: dh } = dispDims(pr); // rotation-aware canvas size (§7)
  // 100% = actual size (1 logical px : 1 CSS px), so a device's resolution shows
  // its real size (small vs large devices differ) and rotation swaps width/height.
  // Use the zoom buttons / Fit to rescale; the stage scrolls when larger.
  scale = store.ui.zoom;
  scr.style.width = dw * scale + 'px';
  scr.style.height = dh * scale + 'px';
  scr.style.background = store.project.background;
  scr.innerHTML = '';

  const scene = curScene();
  for (const def of scene.parts) {
    const e = curPlacement(def.id);
    if (!e) continue;
    // Hidden parts appear on the canvas only while selected, so visible:false parts
    // don't clutter the layout. They stay in the part list and can be selected there.
    // 非表示パーツは選択中だけキャンバスに出す（レイアウトを汚さない）。リストには残り、
    // そこから選択できる。
    const isSel = def.id === store.ui.selected;
    if (!e.visible && !isSel) continue;
    const o = absOrigin(pr, store.ui.sceneId, scene, def);
    const ax = (o.x + e.x) * scale, ay = (o.y + e.y) * scale;
    const d = document.createElement('div');
    d.className = 'part ' + def.type.toLowerCase() +
      (isSel ? ' selected' : '') + (e.visible ? '' : ' hidden');
    d.dataset.id = def.id;

    if (def.type === 'Text') {
      d.style.color = e.color;
      // Size = chosen font's native px height × multiplier (default font = 8px).
      // Family/style approximate the preset (exact glyphs come from the device).
      const cat = e.font ? fontByName(e.font) : null;
      d.style.fontSize = fontBaseHeight(e.font) * e.size * scale + 'px';
      d.style.fontFamily = cat ? approxCss(cat) : '';
      d.style.fontWeight = cat ? approxWeight(cat) : '';
      d.style.fontStyle = cat && cat.italic ? 'italic' : '';
      d.textContent = e.text;
      scr.appendChild(d); // append first to measure
      const bw = d.offsetWidth, bh = d.offsetHeight;
      const fx = DATUM_FX[e.datum[1]] || 0, fy = DATUM_FY[e.datum[0]] || 0;
      d.style.left = ax - fx * bw + 'px';
      d.style.top = ay - fy * bh + 'px';
      if (def.id === store.ui.selected) {
        const a = document.createElement('div');
        a.className = 'anchor';
        a.style.left = ax + 'px';
        a.style.top = ay + 'px';
        scr.appendChild(a);
      }
    } else {
      d.style.left = ax + 'px';
      d.style.top = ay + 'px';
      if (def.type === 'Line') {
        const x2 = (e.x2 ?? e.x) * scale, y2 = (e.y2 ?? e.y) * scale;
        const dx = x2 - ax, dy = y2 - ay;
        const len = Math.max(1, Math.hypot(dx, dy));
        d.style.width = len + 'px';
        d.style.height = Math.max(1, scale) + 'px';
        d.style.background = e.color;
        d.style.transformOrigin = '0 50%';
        d.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
      } else if (def.type === 'Circle') {
        const rr = Math.max(1, e.r || 1) * scale;
        d.style.left = ax - rr + 'px';
        d.style.top = ay - rr + 'px';
        d.style.width = rr * 2 + 'px';
        d.style.height = rr * 2 + 'px';
        d.style.borderRadius = '50%';
        if (e.fill === false) {
          d.style.background = 'transparent';
          d.style.border = `${Math.max(1, scale)}px solid ${e.color}`;
          d.style.boxSizing = 'border-box';
        } else {
          d.style.background = e.color;
          d.style.border = '0';
        }
      } else {
        d.style.width = e.w * scale + 'px';
        d.style.height = e.h * scale + 'px';
      }
      if (def.type === 'Rect') {
        d.style.borderRadius = Math.max(0, e.r || 0) * scale + 'px';
        if (e.fill === false) {
          d.style.background = 'transparent';
          d.style.border = `${Math.max(1, scale)}px solid ${e.color}`;
          d.style.boxSizing = 'border-box';
        } else {
          d.style.background = e.color;
          d.style.border = '0';
        }
      }
      if (def.type === 'Image' && def.asset) {
        const a = assetById(store.project, def.asset);
        if (a) { d.style.backgroundImage = `url("${a.dataUrl}")`; d.style.backgroundSize = '100% 100%'; d.classList.remove('image'); }
      }
      scr.appendChild(d);
      if (def.type === 'Line' && def.id === store.ui.selected) {
        const x2 = (e.x2 ?? e.x) * scale, y2 = (e.y2 ?? e.y) * scale;
        for (const [handle, hx, hy] of [['p1', ax, ay], ['p2', x2, y2]]) {
          const h = document.createElement('div');
          h.className = 'line-handle';
          h.dataset.id = def.id;
          h.dataset.handle = handle;
          h.style.left = hx + 'px';
          h.style.top = hy + 'px';
          scr.appendChild(h);
        }
      }
    }
  }
}

// --- left: part list -----------------------------------------------------
function renderParts() {
  const el = $('part-list');
  el.innerHTML = '';
  $('parts-title').textContent = t('parts.title', { scene: store.ui.sceneId });
  const scene = curScene();
  const sel = store.ui.selected;
  $('part-del').disabled = !sel;
  $('part-front').disabled = !sel;
  $('part-back').disabled = !sel;

  // Front-on-top: the last-drawn part shows first in the layer list.
  for (let i = scene.parts.length - 1; i >= 0; i--) {
    const def = scene.parts[i];
    const e = curPlacement(def.id);
    const hidden = !(e && e.visible);
    const it = document.createElement('div');
    it.className = 'pitem' + (def.id === sel ? ' active' : '');
    it.innerHTML = `<span>${def.id}${hidden ? t('list.hidden') : ''}</span><span class="ty">${def.type}</span>`;
    it.onclick = () => { lineKeyMode = 'move'; update((st) => { st.ui.selected = def.id; }); };
    el.appendChild(it);
  }
}

// Read-only value row (plain text, not an editable input).
const readout = (label, value) => `<div class="field"><label>${label}</label><div class="readout">${value}</div></div>`;

// --- left: profile meta --------------------------------------------------
function renderProfMeta() {
  const pr = curProfile();
  const d = dispDims(pr); // effective (rotated) screen size shown in the canvas
  $('prof-meta').innerHTML =
    readout(t('field.size'), `${d.w} × ${d.h}`) +
    readout(t('field.rotation'), `${pr.rotation} <span class="unit">（${orientText(d.w, d.h)}）</span>`) +
    `<p class="sub">${t('hint.profileMeta')}</p>`;
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
  $('insp-title').textContent = t('inspector.part', { scene: store.ui.sceneId, profile: store.ui.profileId });
  if (!def || !e) { el.innerHTML = `<p class="sub">${t('inspector.selectPart')}</p>`; return; }

  let h = '';
  h += `<div class="field"><label>${t('field.partId')}</label><input type="text" id="p-id" value="${sel}"></div>`;
  if (def.type === 'Text') {
    h += `<div class="two">${row('x', t('field.anchorX'), 'number', e.x)}${row('y', t('field.anchorY'), 'number', e.y)}</div>`;
    h += `<div class="field"><label>${t('field.datum')}</label><select data-k="datum">` +
      DATUMS.map((v) => `<option value="${v}" ${e.datum === v ? 'selected' : ''}>${v}（${t('datum.' + v)}）</option>`).join('') +
      `</select></div>`;
    h += row('text', t('field.text'), 'text', e.text);
    h += `<div class="field"><div class="lab"><label>${t('field.textSize')}</label><span class="sub" id="px-hint">${t('units.pxApprox', { px: pxOf(e.size) })}</span></div>` +
      `<input type="number" data-k="size" step="0.25" min="0.25" value="${e.size}"></div>`;
    // Font dropdown: only the fonts enabled for this profile (§8.7.3/§8.7.4).
    const enabled = profileFonts(store.project, store.ui.profileId);
    h += `<div class="field"><label>${t('field.font')}</label><select data-k="font">` +
      `<option value="" ${!e.font ? 'selected' : ''}>${t('font.default')}</option>` +
      enabled.map((n) => `<option value="${n}" ${e.font === n ? 'selected' : ''}>${n}</option>`).join('') +
      `</select>` +
      (enabled.length ? '' : `<span class="sub">${t('font.noneEnabled')}</span>`) +
      // Link to the selected font's catalog page (characters/metrics); only when a
      // non-default font is chosen and a catalog base URL is configured.
      (e.font && fontDetailUrl(e.font)
        ? ` <a class="font-detail" href="${fontDetailUrl(e.font)}" target="_blank" rel="noopener" title="${t('font.detailTitle')}">${t('font.detail')} ↗</a>` : '') +
      `</div>`;
  } else if (def.type === 'Line') {
    h += `<div class="two">${row('x', t('field.x1'), 'number', e.x)}${row('y', t('field.y1'), 'number', e.y)}</div>`;
    h += `<div class="two">${row('x2', t('field.x2'), 'number', e.x2)}${row('y2', t('field.y2'), 'number', e.y2)}</div>`;
    h += `<div class="field"><label>${t('field.color')}</label><input type="color" data-k="color" value="${e.color}"></div>`;
  } else {
    h += `<div class="two">${row('x', t('field.x'), 'number', e.x)}${row('y', t('field.y'), 'number', e.y)}</div>`;
    if (def.type === 'Circle') {
      h += `<div class="two">${row('r', t('field.radius'), 'number', e.r || 1)}${row('fill', t('field.fill'), 'checkbox', e.fill !== false)}</div>`;
      h += `<div class="field"><label>${t('field.color')}</label><input type="color" data-k="color" value="${e.color}"></div>`;
    } else {
      h += `<div class="two">${row('w', t('field.width'), 'number', e.w)}${row('h', t('field.height'), 'number', e.h)}</div>`;
    }
    if (def.type === 'Rect') {
      h += `<div class="two">${row('r', t('field.cornerRadius'), 'number', e.r || 0)}${row('fill', t('field.fill'), 'checkbox', e.fill !== false)}</div>`;
      h += `<div class="field"><label>${t('field.color')}</label><input type="color" data-k="color" value="${e.color}"></div>`;
    }
    if (def.type === 'Image') {
      const assets = store.project.assets || [];
      h += `<div class="field"><label>${t('field.asset')}</label><select id="p-asset">` +
        `<option value="">${t('field.assetNone')}</option>` +
        assets.map((a) => `<option value="${a.id}" ${def.asset === a.id ? 'selected' : ''}>${a.id} (${a.w}×${a.h})</option>`).join('') +
        `</select></div>`;
    }
  }
  h += row('visible', t('field.visible'), 'checkbox', e.visible);
  h += `<div class="field"><label>${t('field.descPart')}</label><textarea id="p-desc" rows="2">${def.desc || ''}</textarea></div>`;
  el.innerHTML = h;

  el.querySelectorAll('[data-k]').forEach((inp) => {
    const k = inp.dataset.k, type = inp.type;
    const ev = type === 'checkbox' ? 'change' : 'input';
    inp.addEventListener(ev, () => {
      const v = type === 'checkbox' ? inp.checked : (type === 'number' ? (+inp.value || 0) : inp.value);
      e[k] = k === 'font' && v === '' ? null : (k === 'r' ? Math.max(0, v) : v); // empty font = default
      if (k === 'size') { const hint = $('px-hint'); if (hint) hint.textContent = t('units.pxApprox', { px: pxOf(v) }); }
      // keep focus: rerender canvas/list/status but not the inspector
      renderCanvas(); renderParts(); renderStatus();
    });
  });
  const dsc = el.querySelector('#p-desc');
  if (dsc) dsc.oninput = (ev2) => { def.desc = ev2.target.value; };
  // Rename on commit (change, not input): no-op on invalid/duplicate id.
  const idInp = el.querySelector('#p-id');
  if (idInp) idInp.addEventListener('change', () => {
    const nid = renamePart(store.project, store.ui.sceneId, sel, idInp.value);
    update((st) => { st.ui.selected = nid; });
  });
  const assetSel = el.querySelector('#p-asset');
  if (assetSel) assetSel.addEventListener('change', () => { def.asset = assetSel.value || null; renderCanvas(); renderParts(); });
}

// Part deselected -> edit the scene's own properties (§8.13).
function renderSceneProps() {
  const s = curScene();
  $('insp-title').textContent = t('inspector.scene', { scene: s.id });
  $('props').innerHTML =
    `<div class="field"><label>${t('field.sceneId')}</label><input type="text" id="s-id" value="${s.id}"></div>` +
    readout(t('field.partCount'), s.parts.length) +
    `<div class="field"><label>${t('field.descScene')}</label><textarea id="s-desc" rows="3">${s.desc || ''}</textarea></div>` +
    `<p class="sub">${t('hint.sceneProps')}</p>`;
  const dsc = $('s-desc');
  if (dsc) dsc.oninput = (ev) => { s.desc = ev.target.value; };
  const idInp = $('s-id');
  if (idInp) idInp.addEventListener('change', () => {
    const nid = renameScene(store.project, s.id, idInp.value);
    update((st) => { st.ui.sceneId = nid; });
  });
}

function renderStatus() {
  const pr = curProfile();
  const e = store.ui.selected ? curPlacement(store.ui.selected) : null;
  if (e) {
    const detail = 'x2' in e
      ? `x1:${e.x}, y1:${e.y}, x2:${e.x2}, y2:${e.y2}`
      : ('w' in e
      ? `x:${e.x}, y:${e.y}, w:${e.w}, h:${e.h}`
      : ('text' in e ? `x:${e.x}, y:${e.y}, datum:${e.datum}, ×${e.size}` : `x:${e.x}, y:${e.y}, r:${e.r}`));
    $('st-sel').textContent = t('status.selected', { scene: store.ui.sceneId, id: store.ui.selected, detail });
  } else {
    $('st-sel').textContent = t('status.none', { scene: store.ui.sceneId });
  }
  const dp = dispDims(pr);
  $('st-prof').textContent = t('status.profile', { profile: pr.id, w: dp.w, h: dp.h, orient: orientText(dp.w, dp.h), rot: pr.rotation });
  $('zoom-label').textContent = Math.round(store.ui.zoom * 100) + '%';
}

export function renderDesign() {
  renderScenes(); renderTabs(); renderCanvas(); renderParts(); renderProfMeta();
  renderInspector(); renderStatus();
}

// --- interactions (attached once) ---------------------------------------
let drag = null;
let lineKeyMode = 'move';
export function initDesign() {
  const scr = $('canvas-screen');

  // Host font metrics refine Text sizing on the canvas; re-render once loaded.
  loadMetrics().then((m) => { if (m && store.ui.mode === 'design') renderCanvas(); });

  scr.addEventListener('pointerdown', (ev) => {
    if (ev.button !== 0) return;
    const id = ev.target.dataset.id;
    if (!id) { lineKeyMode = 'move'; update((st) => { st.ui.selected = null; }); return; }
    update((st) => { st.ui.selected = id; });
    const e = curPlacement(id);
    let mode = ev.target.dataset.handle || 'move';
    if ('x2' in e && mode === 'move') {
      const r = scr.getBoundingClientRect();
      const px = (ev.clientX - r.left) / scale;
      const py = (ev.clientY - r.top) / scale;
      const d1 = Math.hypot(px - e.x, py - e.y);
      const d2 = Math.hypot(px - e.x2, py - e.y2);
      const hit = Math.max(5, 8 / scale);
      if (d2 <= hit && d2 <= d1) mode = 'p2';
      else if (d1 <= hit) mode = 'p1';
    }
    lineKeyMode = 'x2' in e ? mode : 'move';
    drag = { id, mode, sx: ev.clientX, sy: ev.clientY, ox: e.x, oy: e.y, ox2: e.x2, oy2: e.y2 };
    scr.setPointerCapture(ev.pointerId);
    ev.preventDefault();
  });
  scr.addEventListener('pointermove', (ev) => {
    if (!drag) return;
    if (!drag.moved) { checkpoint(); drag.moved = true; } // one undo step per drag
    const e = curPlacement(drag.id);
    const dx = Math.round((ev.clientX - drag.sx) / scale);
    const dy = Math.round((ev.clientY - drag.sy) / scale);
    if ('x2' in e) {
      if (drag.mode === 'p2') {
        e.x2 = drag.ox2 + dx;
        e.y2 = drag.oy2 + dy;
      } else if (drag.mode === 'p1') {
        e.x = drag.ox + dx;
        e.y = drag.oy + dy;
      } else {
        e.x = drag.ox + dx;
        e.y = drag.oy + dy;
        e.x2 = drag.ox2 + dx;
        e.y2 = drag.oy2 + dy;
      }
    } else {
      e.x = drag.ox + dx;
      e.y = drag.oy + dy;
    }
    renderCanvas(); renderParts(); renderInspector(); renderStatus();
  });
  scr.addEventListener('pointerup', () => { if (drag) { drag = null; renderInspector(); } });

  // Click empty stage / device frame -> deselect -> scene props.
  const stage = $('stage');
  stage.addEventListener('pointerdown', (ev) => {
    if (ev.button !== 0) return;
    if (ev.target.closest('.part') || ev.target.closest('.line-handle') || ev.target.id === 'canvas-screen') return;
    if (store.ui.selected !== null) {
      lineKeyMode = 'move';
      update((st) => { st.ui.selected = null; });
    }
  });

  // Keymap (§8.14): arrows move ±1, Ctrl ×10, Shift resizes Rect/Image,
  // moves the Line end point, or changes Circle radius.
  document.addEventListener('keydown', (ev) => {
    if (store.ui.mode !== 'design' || !store.ui.selected) return;
    const tag = document.activeElement && document.activeElement.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[ev.key];
    if (!dir) return;
    ev.preventDefault();
    const step = (ev.ctrlKey || ev.metaKey) ? 10 : 1;
    const e = curPlacement(store.ui.selected);
    checkpoint(); // one undo step per nudge
    if ('x2' in e) {
      if (lineKeyMode === 'p2') {
        e.x2 += dir[0] * step;
        e.y2 += dir[1] * step;
      } else if (lineKeyMode === 'p1') {
        e.x += dir[0] * step;
        e.y += dir[1] * step;
      } else {
        e.x += dir[0] * step;
        e.y += dir[1] * step;
        e.x2 += dir[0] * step;
        e.y2 += dir[1] * step;
      }
    } else if (ev.shiftKey) {
      if ('r' in e && !('w' in e)) {
        e.r = Math.max(1, e.r + (dir[0] + dir[1]) * step);
      } else if (!('w' in e)) return; // Text has no box
      else {
        e.w = Math.max(2, e.w + dir[0] * step);
        e.h = Math.max(2, e.h + dir[1] * step);
      }
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
  $('zoom-reset').onclick = () => setZoom(1); // 100% = actual size
  // Fit: scale the current profile's screen to the stage (then zoom adjusts from there).
  $('zoom-fit').onclick = () => {
    const { w: dw, h: dh } = dispDims(curProfile());
    const r = $('stage').getBoundingClientRect();
    const availW = Math.max(40, r.width - 36), availH = Math.max(40, r.height - 36); // 18px padding each side
    setZoom(Math.min(availW / dw, availH / dh) * 0.9); // leave a little margin around the canvas
  };
  scr.addEventListener('wheel', (ev) => { ev.preventDefault(); setZoom(store.ui.zoom * (ev.deltaY < 0 ? 1.1 : 1 / 1.1)); }, { passive: false });

  // Scene add / delete (delete is disabled when only one scene remains).
  $('scene-add').onclick = () => mutate((st) => {
    st.ui.sceneId = addScene(st.project);
    st.ui.selected = null;
  });
  $('scene-del').onclick = () => {
    if (store.project.scenes.length <= 1) return;
    if (!confirm(t('confirm.delScene', { id: store.ui.sceneId }))) return;
    mutate((st) => {
      removeScene(st.project, st.ui.sceneId);
      st.ui.sceneId = st.project.scenes[0].id;
      st.ui.selected = null;
    });
  };

  // Part add (of the picked type) / delete (the selected part).
  $('part-add').onclick = () => mutate((st) => {
    lineKeyMode = 'move';
    st.ui.selected = addPart(st.project, st.ui.sceneId, $('part-type').value);
  });
  $('part-del').onclick = () => {
    const sel = store.ui.selected;
    if (!sel) return;
    if (!confirm(t('confirm.delPart', { id: sel }))) return;
    mutate((st) => {
      removePart(st.project, st.ui.sceneId, sel);
      lineKeyMode = 'move';
      st.ui.selected = null;
    });
  };

  // Reorder among siblings (↑ = toward front, ↓ = toward back; §8.3).
  $('part-front').onclick = () => { if (store.ui.selected) mutate((st) => reorderPart(st.project, st.ui.sceneId, st.ui.selected, +1)); };
  $('part-back').onclick = () => { if (store.ui.selected) mutate((st) => reorderPart(st.project, st.ui.sceneId, st.ui.selected, -1)); };

  // Inspector inline edits: checkpoint once per focused-field edit session, in
  // capture phase so the snapshot is taken before the field's own handler mutates.
  const insp = $('props');
  let armed = false;
  insp.addEventListener('focusin', () => { armed = true; });
  const armFire = () => { if (armed) { checkpoint(); armed = false; } };
  insp.addEventListener('input', armFire, true);
  insp.addEventListener('change', armFire, true);

  // Copy the current scene (all profiles) as AI layout JSON (§8.15). Clipboard
  // first; if unavailable (e.g. non-secure context), fall back to a download.
  $('btn-copy-ai').onclick = async () => {
    const json = aiLayoutJson(store.project, store.ui.sceneId);
    try {
      await navigator.clipboard.writeText(json);
      flash(t('ailayout.copied', { scene: store.ui.sceneId }));
    } catch {
      downloadText(`${store.ui.sceneId}.ai-layout.json`, json, 'application/json');
      flash(t('ailayout.downloaded'));
    }
  };

  // Paste AI JSON: import a layout (§8.15). Existing scene id -> update, else add.
  const pasteOv = $('paste-overlay'), pasteTa = $('paste-json');
  const pasteSummary = $('paste-summary'), pasteErr = $('paste-err'), pasteImport = $('paste-import');
  const closePaste = () => { pasteOv.hidden = true; };
  // Tolerate a Markdown code fence around AI output (```json ... ```); parseAiLayout strips it.
  const parsePaste = () => parseAiLayout(pasteTa.value);
  const refreshPaste = () => {
    pasteSummary.textContent = ''; pasteErr.textContent = '';
    if (!pasteTa.value.trim()) { pasteSummary.textContent = t('paste.empty'); pasteImport.disabled = true; return; }
    const { obj, err } = parsePaste();
    if (err) { pasteErr.textContent = t('paste.invalid', { msg: err }); pasteImport.disabled = true; return; }
    const r = reconcileAiLayout(store.project, obj);
    if (r.errors.length) { pasteErr.textContent = r.errors.join(' '); pasteImport.disabled = true; return; }
    let s = t(r.mode === 'update' ? 'paste.willUpdate' : 'paste.willAdd',
      { scene: r.sceneId, parts: r.partCount, profiles: store.project.profiles.length });
    if (r.warnings.length) s += ' ' + t('paste.warnings', { n: r.warnings.length, list: r.warnings.join(' ') });
    pasteSummary.textContent = s; pasteImport.disabled = false;
  };
  $('btn-paste-ai').onclick = () => { pasteTa.value = ''; refreshPaste(); pasteOv.hidden = false; pasteTa.focus(); };
  pasteTa.addEventListener('input', refreshPaste);
  $('paste-cancel').onclick = closePaste;
  pasteOv.addEventListener('pointerdown', (ev) => { if (ev.target === pasteOv) closePaste(); });
  pasteImport.onclick = () => {
    const { obj, err } = parsePaste();
    if (err) { refreshPaste(); return; }
    if (reconcileAiLayout(store.project, obj).errors.length) { refreshPaste(); return; }
    let res;
    mutate((st) => { res = applyAiLayout(st.project, obj); st.ui.sceneId = res.sceneId; st.ui.selected = null; });
    closePaste();
    flash(t('paste.imported', { scene: res.sceneId, mode: res.mode }));
  };
}
