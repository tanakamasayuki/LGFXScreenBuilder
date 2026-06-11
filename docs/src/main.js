// Bootstrap: i18n, undo/redo, project persistence, mode switching, and wiring
// the store to the active mode's renderer.
import { store, subscribe, loadProject, update, undo, redo, canUndo, canRedo } from './store.js';
import { renderDesign, initDesign } from './design.js';
import { renderProfiles, initProfiles } from './profiles.js';
import { renderExport, initExport } from './exporter.js';
import { renderAssets, initAssets } from './assets.js';
import { renderFonts, initFonts } from './fontsview.js';
import { initNewProject } from './newproject.js';
import { generateHeader } from './codegen.js';
import { sampleProject } from './model.js';
import { detectLanguage, setLang, getLang, applyStatic, t } from './i18n.js';
import { serialize, openProject, saveText, autosave, loadAutosave, clearAllHandles, ACCEPT } from './persist.js';
import { flash } from './toast.js';

const $ = (id) => document.getElementById(id);

function render() {
  applyStatic(document); // static [data-i18n] labels
  const mode = store.ui.mode;
  document.querySelectorAll('.mode[data-mode]').forEach((b) => b.classList.toggle('active', b.dataset.mode === mode));
  const dv = $('view-design'), pv = $('view-profiles'), ev = $('view-export'), av = $('view-assets'), fv = $('view-fonts');
  if (dv) dv.hidden = mode !== 'design';
  if (pv) pv.hidden = mode !== 'profiles';
  if (ev) ev.hidden = mode !== 'export';
  if (av) av.hidden = mode !== 'assets';
  if (fv) fv.hidden = mode !== 'fonts';
  if (mode === 'design') renderDesign();
  else if (mode === 'profiles') renderProfiles();
  else if (mode === 'export') renderExport();
  else if (mode === 'assets') renderAssets();
  else if (mode === 'fonts') renderFonts();
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

// New project opens a dialog (§9.1) to choose name/library/profile/scene.
initNewProject('btn-new');
// Demo loads the rich sample project (multi-profile, Boot/Main/Settings) so a
// fresh user can explore a populated project instead of the blank New scene.
// Confirm first since it replaces the current project.
onClick('btn-demo', () => {
  if (confirm(t('demo.confirm'))) { clearAllHandles(); loadProject(sampleProject()); }
});
onClick('btn-open', async () => {
  try {
    const project = await openProject();
    if (project) loadProject(project); // openProject already bound the handle
  } catch (e) { alert('Open failed: ' + e.message); }
});
onClick('btn-save', async () => {
  const name = `${store.project.name || 'project'}.lgfxsb.json`;
  try { saveFeedback(await saveText('project', name, serialize(store.project), ACCEPT.project, 'application/json'), name); }
  catch (e) { flash(t('save.failed', { msg: e.message })); }
});
onClick('btn-export-h', async () => {
  const name = `${store.project.name || 'project'}.h`;
  // Use the project's persisted output settings (buffered / embed AI layouts).
  const opts = { buffered: store.project.buffered !== false, embedAiLayouts: store.project.embedAiLayouts === true };
  try { saveFeedback(await saveText('header', name, generateHeader(store.project, opts), ACCEPT.header, 'text/x-c'), name); }
  catch (e) { flash(t('save.failed', { msg: e.message })); }
});

// Toast the outcome of an in-place save (§9.3) uniformly across save actions.
function saveFeedback(r, fallbackName) {
  if (!r || r.cancelled) return;
  if (r.error === 'permission-denied') { flash(t('save.denied')); return; }
  const name = r.name || fallbackName;
  if (r.method === 'overwrite') flash(t('save.overwrote', { name }));
  else if (r.method === 'picked') flash(t('save.savedTo', { name }));
  else flash(t('save.downloaded', { name }));
}

// --- autosave (latest state only; §9) ------------------------------------
if (typeof window !== 'undefined') {
  setInterval(() => autosave(store.project), 3000);
  window.addEventListener('beforeunload', () => autosave(store.project));
}

initDesign();
initProfiles();
initExport();
initAssets();
initFonts();
subscribe(render);

// Restore the last autosaved project if present; otherwise keep the sample.
const restored = loadAutosave();
if (restored) loadProject(restored); // emits -> render
else render();
