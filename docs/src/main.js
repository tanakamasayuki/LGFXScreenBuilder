// Bootstrap: i18n, project persistence, and wiring the store to the active
// mode's renderer. MVP foundation ships the Design mode; other modes are
// placeholders for now.
import { store, subscribe, loadProject } from './store.js';
import { sampleProject } from './model.js';
import { renderDesign, initDesign } from './design.js';
import { generateHeader } from './codegen.js';
import { detectLanguage, setLang, getLang, applyStatic, t } from './i18n.js';
import { saveProjectFile, openProjectFile, downloadText, autosave, loadAutosave } from './persist.js';

function render() {
  applyStatic(document); // static [data-i18n] labels
  if (store.ui.mode === 'design') renderDesign();
}

// Initial language: browser preference (ja/en), default en.
setLang(detectLanguage());

const langSel = document.getElementById('lang');
if (langSel) {
  langSel.value = getLang();
  langSel.addEventListener('change', () => { setLang(langSel.value); render(); });
}

// --- toolbar: project new / open / save / export header ------------------
const onClick = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener('click', fn); };

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
subscribe(render);

// Restore the last autosaved project if present; otherwise keep the sample.
const restored = loadAutosave();
if (restored) loadProject(restored); // emits -> render
else render();
