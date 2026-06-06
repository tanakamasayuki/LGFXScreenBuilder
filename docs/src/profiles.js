// Devices mode: define profiles (size / default rotation / order) and the
// profile order (§8.9). Each profile holds an independent layout per scene.
// Known boards are shown only as size-reference labels.
// Ported from the validated profiles probe.
import { store, update, mutate, checkpoint } from './store.js';
import {
  orient, dispDims, profileById, addProfile, removeProfile, renameProfile, moveProfile,
} from './model.js';
import {
  dimKey, boardCatalog, commonResolutions,
} from './boards.js';
import { t } from './i18n.js';

const $ = (id) => document.getElementById(id);
const cur = () => profileById(store.project, store.ui.profileId);

// --- left: profile list --------------------------------------------------
function renderProfList() {
  const el = $('profile-list');
  el.innerHTML = '';
  store.project.profiles.forEach((p, i) => {
    const it = document.createElement('div');
    it.className = 'sitem' + (p.id === store.ui.profileId ? ' active' : '');
    it.innerHTML = `<span>${p.id}</span><span class="profile-order"><button class="mini up" title="${t('profiles.up')}" ${i === 0 ? 'disabled' : ''}>↑</button><button class="mini down" title="${t('profiles.down')}" ${i === store.project.profiles.length - 1 ? 'disabled' : ''}>↓</button><span class="cnt">${p.w}×${p.h}</span></span>`;
    it.onclick = () => update((st) => { st.ui.profileId = p.id; });
    it.querySelector('.up').onclick = (ev) => {
      ev.stopPropagation();
      mutate((st) => { moveProfile(st.project, p.id, -1); st.ui.profileId = p.id; });
    };
    it.querySelector('.down').onclick = (ev) => {
      ev.stopPropagation();
      mutate((st) => { moveProfile(st.project, p.id, +1); st.ui.profileId = p.id; });
    };
    el.appendChild(it);
  });
}

// --- center: orientation/size preview + matching board reference ----------
function renderProfCenter() {
  const p = cur();
  $('profile-title').textContent = p ? p.id : '';
  const scr = $('prof-screen'), dev = $('prof-device');
  if (!p) { dev.style.display = 'none'; return; }
  dev.style.display = '';
  // Preview the effective (rotated) screen so the rotation setting is visible.
  const d = dispDims(p);
  const sc = 240 / Math.max(d.w, d.h);
  scr.style.width = d.w * sc + 'px';
  scr.style.height = d.h * sc + 'px';
  scr.textContent = `${d.w} × ${d.h}`;
  const oc = orient(d.w, d.h);
  $('prof-size').textContent = `${t('orient.' + oc)} ${d.w}×${d.h}`;
  $('prof-rot').textContent = `rotation ${p.rotation}`;
  $('prof-orient').textContent = t('orient.' + oc);

  const cat = $('board-catalog');
  cat.innerHTML = '';
  let matched = 0;
  for (const b of boardCatalog()) {
    const mism = dimKey(b.w, b.h) !== dimKey(p.w, p.h);
    if (mism) continue;
    matched++;
    const btn = document.createElement('button');
    btn.className = 'board';
    btn.disabled = true;
    btn.innerHTML = `<div class="bn">${b.id}</div><div class="bd">${b.w}×${b.h}</div>`;
    cat.appendChild(btn);
  }
  if (!matched) {
    const n = document.createElement('div');
    n.className = 'sub'; n.style.gridColumn = '1/-1';
    n.textContent = t('catalog.noMatch');
    cat.appendChild(n);
  }
}

// --- right: profile properties -------------------------------------------
function renderProfProps() {
  const p = cur();
  const el = $('prof-props');
  if (!p) { el.innerHTML = `<p class="sub">${t('props.selectProfile')}</p>`; return; }
  const oc = orient(p.w, p.h);
  el.innerHTML =
    `<div class="field"><label>${t('field.profileId')}</label><input id="pf-id" value="${p.id}"></div>` +
    `<div class="two"><div class="field"><label>${t('field.widthPx')}</label><input id="pf-w" type="number" value="${p.w}"></div>` +
    `<div class="field"><label>${t('field.heightPx')}</label><input id="pf-h" type="number" value="${p.h}"></div></div>` +
    `<p class="sub">${t('orient.' + oc)}</p>` +
    `<div class="field"><label>${t('field.defaultRotation')}</label><select id="pf-rot">` +
    [0, 1, 2, 3].map((r) => `<option value="${r}"${r === p.rotation ? ' selected' : ''}>${r}</option>`).join('') +
    `</select></div>` +
    `<div class="field"><label>${t('field.descProfile')}</label><textarea id="pf-desc" rows="2">${p.desc || ''}</textarea></div>` +
    `<button class="mini" id="pf-del">${t('btn.delProfile')}</button>`;
  // Partial re-render on size/rotation edits to keep input focus (like Design).
  const reSize = () => { renderProfList(); renderProfCenter(); renderBanner(); };
  $('pf-id').addEventListener('change', () => {
    const nid = renameProfile(store.project, p.id, $('pf-id').value);
    update((st) => { st.ui.profileId = nid; });
  });
  $('pf-w').oninput = (e) => { p.w = +e.target.value || p.w; reSize(); };
  $('pf-h').oninput = (e) => { p.h = +e.target.value || p.h; reSize(); };
  $('pf-rot').onchange = (e) => { p.rotation = +e.target.value; renderProfCenter(); };
  $('pf-desc').oninput = (e) => { p.desc = e.target.value; };
  $('pf-del').onclick = () => {
    if (!confirm(t('confirm.delProfile', { id: p.id }))) return;
    mutate((st) => {
      const gone = p.id;
      removeProfile(st.project, gone);
      if (st.ui.profileId === gone) st.ui.profileId = st.project.profiles[0] ? st.project.profiles[0].id : null;
    });
  };
}

// --- banner: validation ---------------------------------------------------
function renderBanner() {
  const b = $('prof-banner');
  b.className = 'banner ok';
  b.textContent = t('banner.ok');
}

export function renderProfiles() {
  renderProfList(); renderProfCenter(); renderProfProps(); renderBanner();
}

// --- interactions (attached once) ----------------------------------------
function renderAddMenu(menu, close) {
  menu.innerHTML = '';
  const pick = (w, h) => () => { close(); mutate((st) => { st.ui.profileId = addProfile(st.project, { w, h }, st.ui.profileId); }); };
  for (const r of commonResolutions()) {
    const it = document.createElement('button');
    it.className = 'menu-item';
    it.innerHTML = `<span class="res">${r.w}×${r.h}</span><span class="sub">${r.boards.join(' / ')}</span>`;
    it.onclick = pick(r.w, r.h);
    menu.appendChild(it);
  }
  const c = document.createElement('button');
  c.className = 'menu-item';
  c.innerHTML = `<span class="res">${t('menu.custom')}</span><span class="sub">${t('menu.customSub')}</span>`;
  c.onclick = pick(320, 240);
  menu.appendChild(c);
}

export function initProfiles() {
  // Inspector inline edits (size/rotation/note/id): one checkpoint per edit session.
  const props = $('prof-props');
  let armed = false;
  props.addEventListener('focusin', () => { armed = true; });
  const armFire = () => { if (armed) { checkpoint(); armed = false; } };
  props.addEventListener('input', armFire, true);
  props.addEventListener('change', armFire, true);
  const menu = $('profile-add-menu');
  const btn = $('profile-add');
  const close = () => menu.classList.remove('open');
  // The menu is position:fixed (so the scrollable left pane can't clip it); place
  // it just under the trigger button. Scrolling closes it (fixed won't follow).
  const place = () => {
    const r = btn.getBoundingClientRect();
    menu.style.top = `${Math.round(r.bottom + 4)}px`;
    menu.style.left = `${Math.round(Math.min(r.left, window.innerWidth - menu.offsetWidth - 8))}px`;
  };
  btn.addEventListener('click', (ev) => {
    ev.stopPropagation();
    if (menu.classList.contains('open')) { close(); return; }
    renderAddMenu(menu, close);
    menu.classList.add('open');
    place();
  });
  menu.addEventListener('click', (ev) => ev.stopPropagation());
  document.addEventListener('click', close);
  window.addEventListener('resize', close);
  // Close when an OUTSIDE scroller moves (the menu is fixed and won't follow it),
  // but not when the user scrolls inside the menu itself.
  document.addEventListener('scroll', (ev) => { if (!menu.contains(ev.target)) close(); }, true);
}
