// Bootstrap: i18n, project persistence, and wiring the store to the active
// mode's renderer. MVP foundation ships the Design mode; other modes are
// placeholders for now.
import { store, subscribe, loadProject, update, undo, redo, canUndo, canRedo } from './store.js';
import { sampleProject } from './model.js';
import { renderDesign, initDesign } from './design.js';
import { renderProfiles, initProfiles } from './profiles.js';
import { renderExport, initExport } from './exporter.js';
import { renderAssets, initAssets } from './assets.js';
import { generateHeader } from './codegen.js';
import { detectLanguage, setLang, getLang, applyStatic, t } from './i18n.js';
import { saveProjectFile, openProjectFile, downloadText, autosave, loadAutosave } from './persist.js';

const $ = (id) => document.getElementById(id);

function render() {
  applyStatic(document); // static [data-i18n] labels
  const mode = store.ui.mode;
  document.querySelectorAll('.mode[data-mode]').forEach((b) => b.classList.toggle('active', b.dataset.mode === mode));
  const dv = $('view-design'), pv = $('view-profiles'), ev = $('view-export'), av = $('view-assets');
  if (dv) dv.hidden = mode !== 'design';
  if (pv) pv.hidden = mode !== 'profiles';
  if (ev) ev.hidden = mode !== 'export';
  if (av) av.hidden = mode !== 'assets';
  if (mode === 'design') renderDesign();
  else if (mode === 'profiles') renderProfiles();
  else if (mode === 'export') renderExport();
  else if (mode === 'assets') renderAssets();
  const ub = $('btn-undo'), rb = $('btn-redo');
  if (ub) ub.disabled = !canUndo();
  if (rb) rb.disabled = !canRedo();
}

// --- top mode switching --------------------------------------------------
document.querySelectorAll('.mode[data-mode]').forEach((btn) => {
  btn.addEventListener('click', () => { if (!btn.disabled) update((st) => { st.ui.mode = btn.dataset.mode; }); });
});

// Initial language: browser preference (ja/en), default en.
setLang(detectLanguage());

const langSel = document.getElementById('lang');
if (langSel) {
  langSel.value = getLang();
  langSel.addEventListener('change', () => { setLang(langSel.value); render(); });
}

// --- toolbar: project new / open / save / export header ------------------
const onClick = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener('click', fn); };

onClick('btn-undo', undo);
onClick('btn-redo', redo);

// Undo/redo shortcuts. Skip while typing in a field so native text undo works.
document.addEventListener('keydown', (ev) => {
  if (!(ev.ctrlKey || ev.metaKey) || ev.key.toLowerCase() !== 'z' && ev.key.toLowerCase() !== 'y') return;
  const tag = document.activeElement && document.activeElement.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  ev.preventDefault();
  const k = ev.key.toLowerCase();
  if (k === 'y' || (k === 'z' && ev.shiftKey)) redo();
  else undo();
});

onClick('btn-new', () => {
  if (confirm(t('confirm.new'))) loadProject(sampleProject());
});
onClick('btn-open', async () => {
  try {
    const project = await openProjectFile();
    if (project) loadProject(project);
  } catch (e) { alert('Open failed: ' + e.message); }
});
onClick('btn-save', () => saveProjectFile(store.project));
onClick('btn-export-h', () => {
  downloadText(`${store.project.name || 'project'}.h`, generateHeader(store.project), 'text/x-c');
});

// --- autosave (latest state only; §9) ------------------------------------
if (typeof window !== 'undefined') {
  setInterval(() => autosave(store.project), 3000);
  window.addEventListener('beforeunload', () => autosave(store.project));
}

initDesign();
initProfiles();
initExport();
initAssets();
subscribe(render);

// Restore the last autosaved project if present; otherwise keep the sample.
const restored = loadAutosave();
if (restored) loadProject(restored); // emits -> render
else render();
