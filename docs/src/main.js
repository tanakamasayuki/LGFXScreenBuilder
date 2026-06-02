// Bootstrap: wire the store to the active mode's renderer.
// MVP foundation ships the Design mode; other modes are placeholders for now.
import { store, subscribe } from './store.js';
import { renderDesign, initDesign } from './design.js';

function render() {
  if (store.ui.mode === 'design') renderDesign();
}

initDesign();
subscribe(render);
render();
