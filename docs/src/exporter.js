// Export mode: preview generated artifacts, choose the output profile subset,
// and download. The first included profile is the final Auto fallback (§8.9).
import { store } from './store.js';
import { generateHeader, generateSketch } from './codegen.js';
import {
  isValidId, hasTransparentScene, isTransparentScene, transparentColorOf,
  placement, to565,
} from './model.js';
import { saveText, saveAsText, boundFileName, ACCEPT } from './persist.js';
import { flash } from './toast.js';
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
// buffered defaults to true (less flicker); persisted on the project like targetLibrary.
const buffered = () => store.project.buffered !== false;
// embedAiLayouts defaults to false (keeps headers lean); opt-in per §10.2.
const embedAi = () => store.project.embedAiLayouts === true;
const opts = () => ({ profiles: [...included], buffered: buffered(), embedAiLayouts: embedAi() });

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
  // Transparent scenes (§8.16): the color key is masked out of the transfer, so a
  // part painted in it becomes a hole instead of a shape. Compared after RGB565
  // quantization, because that is the depth the panel — and the mask — work at.
  if (hasTransparentScene(pr)) {
    const key = to565(transparentColorOf(pr));
    const hits = new Set();
    for (const s of pr.scenes) {
      if (!isTransparentScene(s)) continue;
      for (const p of s.parts) {
        for (const prof of pr.profiles) {
          const e = placement(prof, s.id, p.id);
          if (e && e.color && to565(e.color) === key) { hits.add(`${s.id}.${p.id}`); break; }
        }
      }
    }
    checks.push(hits.size
      ? { ok: false, t: t('check.keyCollision', { list: [...hits].join(', ') }) }
      : { ok: true, t: t('check.keyClear') });
  }
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
  // Reflect the project name, but don't clobber the field (or cursor) while editing.
  const nameEl = $('export-name');
  if (document.activeElement !== nameEl) nameEl.value = store.project.name || '';
  $('export-buffered').checked = buffered();
  // The color key only matters when a transparent scene exists, so the field is
  // hidden until then rather than adding noise to every project (§8.16).
  $('export-transp-field').hidden = !hasTransparentScene(store.project);
  $('export-transp').value = transparentColorOf(store.project);
  $('export-embed-ai').checked = embedAi();
  reconcile();
  renderFiles();
  renderProfSel();
  renderChecks();
  $('export-curfile').textContent = selFile || '';
  // Show which on-disk file an overwrite-save would target (§10.3).
  const bound = selFile ? boundFileName(targetOf(selFile).key) : null;
  $('export-bound').textContent = bound ? t('export.boundTo', { name: bound }) : '';
  $('export-code').textContent = included.size ? contentOf(selFile) : '';
  const parts = store.project.scenes.reduce((n, s) => n + s.parts.length, 0);
  $('export-st-l').textContent = t('export.status', { scenes: store.project.scenes.length, sel: included.size, total: store.project.profiles.length, parts });
  $('export-st-r').textContent = fw();
  $('export-summary').textContent = t('export.summaryText', { name: store.project.name, fw: fw() });
}

export function initExport() {
  // Project name = generated namespace + output .h/.ino/.json file names (§9.1).
  // It must be a C identifier; on an invalid value, show an error and keep the
  // last good name so codegen never emits a broken namespace.
  $('export-name').addEventListener('input', () => {
    const v = $('export-name').value.trim();
    const errEl = $('export-name-err');
    if (!isValidId(v)) { errEl.textContent = t('newproj.errName'); return; }
    errEl.textContent = '';
    store.project.name = v;
    renderExport();
  });
  $('export-buffered').addEventListener('change', () => {
    store.project.buffered = $('export-buffered').checked;
    renderExport();
  });
  $('export-transp').addEventListener('input', () => {
    store.project.transparentColor = $('export-transp').value;
    renderExport();
  });
  $('export-embed-ai').addEventListener('change', () => {
    store.project.embedAiLayouts = $('export-embed-ai').checked;
    renderExport();
  });
  $('export-fw').addEventListener('change', () => {
    store.project.targetLibrary = $('export-fw').value;
    renderExport();
  });
  $('export-save').addEventListener('click', () => doSave(saveText));
  $('export-saveas').addEventListener('click', () => doSave(saveAsText));
}

// Logical target / picker filter / mime for the currently-selected output file.
function targetOf(name) {
  return name.endsWith('.ino')
    ? { key: 'sketch', accept: ACCEPT.sketch, mime: 'text/x-arduino' }
    : { key: 'header', accept: ACCEPT.header, mime: 'text/x-c' };
}

// In-place save / Save As of the selected file (§9.3, §10.3). `fn` is saveText
// (overwrite the bound file, else pick) or saveAsText (always re-pick).
async function doSave(fn) {
  if (!included.size || !selFile) return;
  const { key, accept, mime } = targetOf(selFile);
  try {
    const r = await fn(key, selFile, contentOf(selFile), accept, mime);
    if (!r || r.cancelled) return;
    if (r.error === 'permission-denied') { flash(t('save.denied')); return; }
    const name = r.name || selFile;
    if (r.method === 'overwrite') flash(t('save.overwrote', { name }));
    else if (r.method === 'picked') flash(t('save.savedTo', { name }));
    else flash(t('save.downloaded', { name }));
    renderExport(); // refresh the bound-file indicator
  } catch (e) {
    flash(t('save.failed', { msg: e.message }));
  }
}
