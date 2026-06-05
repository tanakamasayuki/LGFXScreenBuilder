// Design mode: two-axis editor (scenes in the left pane x profiles as top tabs).
// Each profile holds an independent layout per scene; switching either axis
// re-renders the canvas. Ported from the validated design probe.
import { store, update, mutate, checkpoint } from './store.js';
import {
  DATUMS, DATUM_FX, DATUM_FY, orient, pxOf, sceneById, profileById, partDef, placement,
  addPart, removePart, renamePart, addScene, removeScene, renameScene,
  absOrigin, reorderPart, groupParts, ungroupPart, reparentPart, assetById, profileFonts,
} from './model.js';
import { loadMetrics, metricsFor, approxCss, fontByName, fontDetailUrl } from './fonts.js';
import { aiLayoutJson } from './ailayout.js';
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
let dragId = null; // part id being dragged in the layer tree

// --- left: scene list ----------------------------------------------------
function renderScenes() {
  const el = $('scene-list');
  el.innerHTML = '';
  $('scene-del').disabled = store.project.scenes.length <= 1;
  for (const s of store.project.scenes) {
    const it = document.createElement('div');
    it.className = 'sitem' + (s.id === store.ui.sceneId ? ' active' : '');
    it.innerHTML = `<span>${s.id}</span><span class="cnt">${t('cnt.parts', { n: s.parts.length })}</span>`;
    it.onclick = () => update((st) => { st.ui.sceneId = s.id; st.ui.selected = null; });
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
    const def = store.project.defaultProfile === p.id ? '<span class="defbadge">default</span>' : '';
    tab.innerHTML = `<span class="t1">${p.id}${def}</span>` +
      `<span class="t2">${p.w}×${p.h} · ${orientText(p.w, p.h)} · rot${p.rotation}</span>`;
    tab.onclick = () => update((st) => { st.ui.profileId = p.id; });
    el.appendChild(tab);
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

  const scene = curScene();
  for (const def of scene.parts) {
    if (def.type === 'Group') continue; // logical node: no visual, select via layer panel
    const e = curPlacement(def.id);
    if (!e) continue;
    const o = absOrigin(pr, store.ui.sceneId, scene, def); // parent-group origin
    const ax = (o.x + e.x) * scale, ay = (o.y + e.y) * scale;
    const d = document.createElement('div');
    d.className = 'part ' + def.type.toLowerCase() +
      (def.id === store.ui.selected ? ' selected' : '') + (e.visible ? '' : ' hidden');
    d.dataset.id = def.id;

    if (def.type === 'Text') {
      d.style.color = e.color;
      // Size = chosen font's native px height × multiplier (default font = 8px).
      // Family/style approximate the preset (exact glyphs come from the device).
      const cat = e.font ? fontByName(e.font) : null;
      d.style.fontSize = fontBaseHeight(e.font) * e.size * scale + 'px';
      d.style.fontFamily = cat ? approxCss(cat) : '';
      d.style.fontWeight = cat && cat.bold ? '700' : '';
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
      d.style.width = e.w * scale + 'px';
      d.style.height = e.h * scale + 'px';
      if (def.type === 'Rect') d.style.background = e.color;
      if (def.type === 'Image' && def.asset) {
        const a = assetById(store.project, def.asset);
        if (a) { d.style.backgroundImage = `url("${a.dataUrl}")`; d.style.backgroundSize = '100% 100%'; d.classList.remove('image'); }
      }
      scr.appendChild(d);
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
  const selDef = sel ? partDef(scene, sel) : null;
  $('part-del').disabled = !sel;
  $('part-front').disabled = !sel;
  $('part-back').disabled = !sel;
  $('part-group').disabled = !sel;
  $('part-ungroup').disabled = !(selDef && selDef.type === 'Group');

  // Tree, front-on-top: within each sibling list the last-drawn part shows first.
  const childrenOf = (pid) => scene.parts.filter((p) => (p.parent || null) === pid);
  const emit = (pid, depth) => {
    const sibs = childrenOf(pid);
    for (let i = sibs.length - 1; i >= 0; i--) {
      const def = sibs[i];
      const e = curPlacement(def.id);
      const hidden = def.type !== 'Group' && !(e && e.visible);
      const it = document.createElement('div');
      it.className = 'pitem' + (def.id === sel ? ' active' : '');
      it.style.paddingLeft = (8 + depth * 14) + 'px';
      const tag = def.type === 'Group' ? '▾ ' : '';
      it.innerHTML = `<span>${tag}${def.id}${hidden ? t('list.hidden') : ''}</span><span class="ty">${def.type}</span>`;
      it.onclick = () => update((st) => { st.ui.selected = def.id; });
      // Drag-drop reparent (§8.3.1): onto a group = nest; onto a part = sibling.
      it.draggable = true;
      it.dataset.id = def.id;
      it.ondragstart = (ev) => { dragId = def.id; if (ev.dataTransfer) ev.dataTransfer.effectAllowed = 'move'; };
      it.ondragend = () => { dragId = null; el.querySelectorAll('.dropok').forEach((n) => n.classList.remove('dropok')); };
      it.ondragover = (ev) => { if (dragId && dragId !== def.id) { ev.preventDefault(); it.classList.add('dropok'); } };
      it.ondragleave = () => it.classList.remove('dropok');
      it.ondrop = (ev) => {
        ev.preventDefault(); ev.stopPropagation();
        it.classList.remove('dropok');
        if (!dragId || dragId === def.id) return;
        const id = dragId; dragId = null;
        const newParent = def.type === 'Group' ? def.id : (def.parent || null);
        const anchor = def.type === 'Group' ? null : def.id;
        mutate((st) => { reparentPart(st.project, st.ui.sceneId, id, newParent, anchor); st.ui.selected = id; });
      };
      el.appendChild(it);
      if (def.type === 'Group') emit(def.id, depth + 1);
    }
  };
  emit(null, 0);
}

// Read-only value row (plain text, not an editable input).
const readout = (label, value) => `<div class="field"><label>${label}</label><div class="readout">${value}</div></div>`;

// --- left: profile meta --------------------------------------------------
function renderProfMeta() {
  const pr = curProfile();
  $('prof-meta').innerHTML =
    readout(t('field.size'), `${pr.w} × ${pr.h}`) +
    readout(t('field.rotation'), `${pr.rotation} <span class="unit">（${orientText(pr.w, pr.h)}）</span>`) +
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
  } else if (def.type === 'Group') {
    h += `<div class="two">${row('x', t('field.x'), 'number', e.x)}${row('y', t('field.y'), 'number', e.y)}</div>`;
    h += `<p class="sub">${t('hint.group')}</p>`;
  } else {
    h += `<div class="two">${row('x', t('field.x'), 'number', e.x)}${row('y', t('field.y'), 'number', e.y)}</div>`;
    h += `<div class="two">${row('w', t('field.width'), 'number', e.w)}${row('h', t('field.height'), 'number', e.h)}</div>`;
    if (def.type === 'Rect') h += `<div class="field"><label>${t('field.color')}</label><input type="color" data-k="color" value="${e.color}"></div>`;
    if (def.type === 'Image') {
      const assets = store.project.assets || [];
      h += `<div class="field"><label>${t('field.asset')}</label><select id="p-asset">` +
        `<option value="">${t('field.assetNone')}</option>` +
        assets.map((a) => `<option value="${a.id}" ${def.asset === a.id ? 'selected' : ''}>${a.id} (${a.w}×${a.h})</option>`).join('') +
        `</select></div>`;
    }
  }
  if (def.type !== 'Group') h += row('visible', t('field.visible'), 'checkbox', e.visible);
  h += `<div class="field"><label>${t('field.descPart')}</label><textarea id="p-desc" rows="2">${def.desc || ''}</textarea></div>`;
  el.innerHTML = h;

  el.querySelectorAll('[data-k]').forEach((inp) => {
    const k = inp.dataset.k, type = inp.type;
    const ev = type === 'checkbox' ? 'change' : 'input';
    inp.addEventListener(ev, () => {
      const v = type === 'checkbox' ? inp.checked : (type === 'number' ? (+inp.value || 0) : inp.value);
      e[k] = (k === 'font' && v === '') ? null : v; // empty font = default
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
    const detail = 'w' in e
      ? `x:${e.x}, y:${e.y}, w:${e.w}, h:${e.h}`
      : `x:${e.x}, y:${e.y}, datum:${e.datum}, ×${e.size}`;
    $('st-sel').textContent = t('status.selected', { scene: store.ui.sceneId, id: store.ui.selected, detail });
  } else {
    $('st-sel').textContent = t('status.none', { scene: store.ui.sceneId });
  }
  $('st-prof').textContent = t('status.profile', { profile: pr.id, w: pr.w, h: pr.h, orient: orientText(pr.w, pr.h), rot: pr.rotation });
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

  // Host font metrics refine Text sizing on the canvas; re-render once loaded.
  loadMetrics().then((m) => { if (m && store.ui.mode === 'design') renderCanvas(); });

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
    if (!drag.moved) { checkpoint(); drag.moved = true; } // one undo step per drag
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
    checkpoint(); // one undo step per nudge
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
    st.ui.selected = addPart(st.project, st.ui.sceneId, $('part-type').value);
  });
  $('part-del').onclick = () => {
    const sel = store.ui.selected;
    if (!sel) return;
    if (!confirm(t('confirm.delPart', { id: sel }))) return;
    mutate((st) => {
      removePart(st.project, st.ui.sceneId, sel);
      st.ui.selected = null;
    });
  };

  // Reorder among siblings (↑ = toward front, ↓ = toward back; §8.3).
  $('part-front').onclick = () => { if (store.ui.selected) mutate((st) => reorderPart(st.project, st.ui.sceneId, st.ui.selected, +1)); };
  $('part-back').onclick = () => { if (store.ui.selected) mutate((st) => reorderPart(st.project, st.ui.sceneId, st.ui.selected, -1)); };

  // Group the selection / ungroup the selected group (§8.3.1, absolute position kept).
  $('part-group').onclick = () => {
    if (!store.ui.selected) return;
    mutate((st) => { const g = groupParts(st.project, st.ui.sceneId, [st.ui.selected]); if (g) st.ui.selected = g; });
  };
  $('part-ungroup').onclick = () => {
    const sel = store.ui.selected;
    if (!sel) return;
    mutate((st) => { ungroupPart(st.project, st.ui.sceneId, sel); st.ui.selected = null; });
  };

  // Drop on the empty area of the layer list = move to scene root (§8.3.1).
  const list = $('part-list');
  list.addEventListener('dragover', (ev) => { if (dragId) ev.preventDefault(); });
  list.addEventListener('drop', (ev) => {
    ev.preventDefault();
    if (!dragId) return;
    const id = dragId; dragId = null;
    mutate((st) => { reparentPart(st.project, st.ui.sceneId, id, null); st.ui.selected = id; });
  });

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
}
