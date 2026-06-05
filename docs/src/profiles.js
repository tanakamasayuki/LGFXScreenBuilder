// Profiles mode: define profiles (size / default rotation / board assignment)
// and the project's target library (§8.9). Each profile holds an independent
// layout per scene; the fallback ("default") is chosen at export, not here.
// Ported from the validated profiles probe.
import { store, update, mutate, checkpoint } from './store.js';
import {
  orient, profileById, addProfile, removeProfile, renameProfile, toggleBoard,
} from './model.js';
import {
  BOARDS, LGFX_KNOWN, boardById, dimKey, boardDetectable, boardCatalog, commonResolutions,
} from './boards.js';
import { t } from './i18n.js';

const $ = (id) => document.getElementById(id);
const lib = () => store.project.targetLibrary;
const cur = () => profileById(store.project, store.ui.profileId);

// --- left: profile list --------------------------------------------------
function renderProfList() {
  const el = $('profile-list');
  el.innerHTML = '';
  for (const p of store.project.profiles) {
    const it = document.createElement('div');
    it.className = 'sitem' + (p.id === store.ui.profileId ? ' active' : '');
    it.innerHTML = `<span>${p.id}</span><span class="cnt">${p.w}×${p.h} · ${t('profiles.boardsCount', { n: p.boards.length })}</span>`;
    it.onclick = () => update((st) => { st.ui.profileId = p.id; });
    el.appendChild(it);
  }
}

// --- center: orientation/size preview + board chips + catalog ------------
function renderProfCenter() {
  const p = cur();
  $('profile-title').textContent = p ? p.id : '';
  const scr = $('prof-screen'), dev = $('prof-device');
  if (!p) { dev.style.display = 'none'; return; }
  dev.style.display = '';
  const sc = 240 / Math.max(p.w, p.h);
  scr.style.width = p.w * sc + 'px';
  scr.style.height = p.h * sc + 'px';
  scr.textContent = `${p.w} × ${p.h}`;
  const oc = orient(p.w, p.h);
  $('prof-size').textContent = `${t('orient.' + oc)} ${p.w}×${p.h}`;
  $('prof-rot').textContent = `rotation ${p.rotation}`;
  $('prof-orient').textContent = t('orient.' + oc);

  const chips = $('prof-chips');
  chips.innerHTML = '';
  if (!p.boards.length) chips.innerHTML = `<span class="sub">${t('profiles.unassigned')}</span>`;
  for (const bid of p.boards) {
    const b = boardById(bid);
    const warn = (b && dimKey(b.w, b.h) !== dimKey(p.w, p.h)) || !boardDetectable(lib(), bid);
    const c = document.createElement('span');
    c.className = 'chip';
    c.innerHTML = `<span${warn ? ' style="color:var(--warn)"' : ''}>${bid}${warn ? ' ⚠' : ''}</span><button title="×">×</button>`;
    c.querySelector('button').onclick = () => mutate((st) => toggleBoard(st.project, p.id, bid));
    chips.appendChild(c);
  }

  const cat = $('board-catalog');
  cat.innerHTML = '';
  if (lib() === 'LovyanGFX') {
    const note = document.createElement('div');
    note.className = 'sub'; note.style.gridColumn = '1/-1';
    note.textContent = t('catalog.lgfxNote');
    cat.appendChild(note);
  }
  const hideMis = $('hide-mismatch').checked;
  let hidden = 0;
  for (const b of boardCatalog(lib())) {
    const assigned = p.boards.includes(b.id);
    const mism = dimKey(b.w, b.h) !== dimKey(p.w, p.h);
    if (hideMis && mism && !assigned) { hidden++; continue; }
    const owner = store.project.profiles.find((x) => x.id !== p.id && x.boards.includes(b.id));
    const btn = document.createElement('button');
    btn.className = 'board' + (assigned ? ' assigned' : '') + (assigned && mism ? ' mismatch' : '');
    btn.innerHTML = `<div class="bn">${assigned ? '✓ ' : ''}${b.id}</div>` +
      `<div class="bd">${b.w}×${b.h}${mism ? t('board.mismatch') : ''}</div>` +
      (owner && !assigned ? `<div class="taken">${t('board.assignedTo', { owner: owner.id })}</div>` : '');
    btn.onclick = () => mutate((st) => toggleBoard(st.project, p.id, b.id));
    cat.appendChild(btn);
  }
  if (hidden) {
    const n = document.createElement('div');
    n.className = 'sub'; n.style.gridColumn = '1/-1';
    n.textContent = t('catalog.hidden', { n: hidden });
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

// --- banner: validation (size mismatch / undetectable on LovyanGFX) ------
function renderBanner() {
  const b = $('prof-banner');
  const msgs = [];
  for (const p of store.project.profiles) {
    for (const bid of p.boards) {
      const bd = boardById(bid);
      if (bd && dimKey(bd.w, bd.h) !== dimKey(p.w, p.h)) msgs.push(t('banner.mismatch', { profile: p.id, board: bid, w: bd.w, h: bd.h }));
    }
  }
  if (lib() === 'LovyanGFX') {
    for (const p of store.project.profiles) for (const bid of p.boards) if (!LGFX_KNOWN.has(bid)) msgs.push(t('banner.undetectable', { profile: p.id, board: bid }));
  }
  if (msgs.length) { b.className = 'banner bad'; b.textContent = '⚠ ' + msgs.join(' / '); }
  else { b.className = 'banner ok'; b.textContent = t('banner.ok'); }
}

function renderLibNote() {
  $('lib-target').value = lib();
  $('lib-note').textContent = t('libbar.note') + t('lib.note.' + lib());
}

export function renderProfiles() {
  renderLibNote(); renderProfList(); renderProfCenter(); renderProfProps(); renderBanner();
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
  $('lib-target').addEventListener('change', () => mutate((st) => { st.project.targetLibrary = $('lib-target').value; }));
  // Inspector inline edits (size/rotation/note/id): one checkpoint per edit session.
  const props = $('prof-props');
  let armed = false;
  props.addEventListener('focusin', () => { armed = true; });
  const armFire = () => { if (armed) { checkpoint(); armed = false; } };
  props.addEventListener('input', armFire, true);
  props.addEventListener('change', armFire, true);
  $('hide-mismatch').addEventListener('change', () => renderProfCenter());
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
