// Bootstrap: set up i18n, then wire the store to the active mode's renderer.
// MVP foundation ships the Design mode; other modes are placeholders for now.
import { store, subscribe } from './store.js';
import { renderDesign, initDesign } from './design.js';
import { detectLanguage, setLang, getLang, applyStatic } from './i18n.js';

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

initDesign();
subscribe(render);
render();
