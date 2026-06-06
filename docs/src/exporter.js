// Export mode: preview generated artifacts, choose the output profile subset,
// and download. The first included profile is the final Auto fallback (§8.9).
import { store } from './store.js';
import { generateHeader, generateSketch } from './codegen.js';
import { isValidId } from './model.js';
import { downloadText } from './persist.js';
import { t } from './i18n.js';

const $ = (id) => document.getElementById(id);

// Module-local UI state (not part of the persisted project).
let included = null; // Set<profileId>
let selFile = null;
let fwInit = false;

const fw = () => $('export-fw').value;
const hfile = () => `${store.project.name || 'project'}.h`;
const inofile = () => `${store.project.name || 'project'}_example.ino`;
const files = () => [{ name: hfile(), meta: 'C++' }, { name: inofile(), meta: 'Sample' }];
const opts = () => ({ profiles: [...included] });

// Keep UI state consistent with the current project (profiles may have changed).
function reconcile() {
  const ids = store.project.profiles.map((p) => p.id);
  if (!included) included = new Set(ids);
  else for (const id of [...included]) if (!ids.includes(id)) included.delete(id);
  if (!included.size && ids.length) ids.forEach((id) => included.add(id));
  const names = files().map((f) => f.name);
  if (!names.includes(selFile)) selFile = names[0];
}

function contentOf(name) {
  if (name === hfile()) return generateHeader(store.project, opts());
  if (name === inofile()) return generateSketch(store.project, fw(), opts());
  return '';
}

function renderFiles() {
  const el = $('export-files');
  el.innerHTML = '';
  for (const f of files()) {
    const it = document.createElement('div');
    it.className = 'sitem' + (f.name === selFile ? ' active' : '');
    it.innerHTML = `<span>${f.name}</span><span class="cnt">${f.meta}</span>`;
    it.onclick = () => { selFile = f.name; renderExport(); };
    el.appendChild(it);
  }
}

function renderProfSel() {
  const el = $('export-profsel');
  el.innerHTML = '';
  for (const p of store.project.profiles) {
    const inc = included.has(p.id);
    const row = document.createElement('div');
    row.className = 'profsel-row';
    let html = `<label style="flex:1"><input type="checkbox" class="inc" ${inc ? 'checked' : ''} style="width:auto;min-height:auto"> ${p.id} <span class="cnt">${p.w}×${p.h}</span></label>`;
    row.innerHTML = html;
    row.querySelector('.inc').onchange = (e) => { if (e.target.checked) included.add(p.id); else included.delete(p.id); renderExport(); };
    el.appendChild(row);
  }
  const note = document.createElement('p');
  note.className = 'sub';
  note.style.margin = '6px 0 0';
  note.textContent = t('export.autoNote');
  el.appendChild(note);
}

function renderChecks() {
  const el = $('export-checks');
  el.innerHTML = '';
  const pr = store.project;
  const ids = [];
  pr.profiles.forEach((p) => ids.push(p.id));
  pr.scenes.forEach((s) => { ids.push(s.id); s.parts.forEach((pt) => ids.push(pt.id)); });
  const allValid = ids.every((id) => isValidId(id));
  // Duplicate check: profile ids, scene ids, and part ids within each scene.
  let dup = new Set(pr.profiles.map((p) => p.id)).size !== pr.profiles.length ||
    new Set(pr.scenes.map((s) => s.id)).size !== pr.scenes.length;
  for (const s of pr.scenes) if (new Set(s.parts.map((p) => p.id)).size !== s.parts.length) dup = true;

  const checks = [
    { ok: allValid, t: t('check.idValid') },
    { ok: !dup, t: t('check.idUnique') },
  ];
  if (included.size === 0) checks.push({ ok: false, t: t('check.selectProfile') });
  else if (included.size === 1) checks.push({ ok: true, t: t('check.single', { id: [...included][0] }) });
  else checks.push({ ok: true, t: t('check.multi', { id: [...included][0] }) });

  for (const c of checks) {
    const d = document.createElement('div');
    d.className = 'check ' + (c.ok ? 'ok' : 'warn');
    d.innerHTML = `<span class="i">${c.ok ? '✓' : '⚠'}</span><span>${c.t}</span>`;
    el.appendChild(d);
  }
}

export function renderExport() {
  if (!fwInit) { $('export-fw').value = store.project.targetLibrary || 'M5Unified'; fwInit = true; }
  reconcile();
  renderFiles();
  renderProfSel();
  renderChecks();
  $('export-curfile').textContent = selFile || '';
  $('export-code').textContent = included.size ? contentOf(selFile) : '';
  const parts = store.project.scenes.reduce((n, s) => n + s.parts.length, 0);
  $('export-st-l').textContent = t('export.status', { scenes: store.project.scenes.length, sel: included.size, total: store.project.profiles.length, parts });
  $('export-st-r').textContent = fw();
  $('export-summary').textContent = t('export.summaryText', { name: store.project.name, fw: fw() });
}

export function initExport() {
  $('export-fw').addEventListener('change', renderExport);
  $('export-download').addEventListener('click', () => {
    if (!included.size || !selFile) return;
    const mime = selFile.endsWith('.h') ? 'text/x-c' : 'text/plain';
    downloadText(selFile, contentOf(selFile), mime);
  });
}
