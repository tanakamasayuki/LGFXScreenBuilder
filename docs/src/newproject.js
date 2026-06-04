// New-project dialog (§9.1): choose project name, target library, the first
// profile (device/size/rotation), and the first scene. On create, a fresh
// single-profile, single-scene project replaces the current one.
import { loadProject } from './store.js';
import { newProject, isValidId } from './model.js';
import { commonResolutions } from './boards.js';
import { t } from './i18n.js';

const $ = (id) => document.getElementById(id);
const presets = commonResolutions(); // [{ w, h, boards: [] }]

function fillDeviceMenu() {
  const sel = $('np-device');
  sel.innerHTML = '';
  presets.forEach((r, i) => {
    const o = document.createElement('option');
    o.value = String(i);
    // Board-derived presets list their boards; board-less common sizes show a note.
    const tail = r.boards.length ? r.boards.join(' / ') : (r.note || '');
    o.textContent = tail ? `${r.w}×${r.h} — ${tail}` : `${r.w}×${r.h}`;
    sel.appendChild(o);
  });
  const custom = document.createElement('option');
  custom.value = 'custom';
  custom.textContent = t('newproj.custom');
  sel.appendChild(custom);
}

// Apply the selected device preset to the width/height/rotation fields.
function applyPreset() {
  const v = $('np-device').value;
  if (v === 'custom') return;
  const r = presets[+v];
  if (!r) return;
  $('np-w').value = r.w;
  $('np-h').value = r.h;
  $('np-rot').value = '0'; // preset dims are the panel's native (rotation-0) orientation
}

function open() {
  fillDeviceMenu();
  $('np-device').value = '0';
  applyPreset();
  $('np-err').textContent = '';
  $('newproj-overlay').hidden = false;
  $('np-name').focus();
}
const close = () => { $('newproj-overlay').hidden = true; };

function create() {
  const name = $('np-name').value.trim();
  const profileId = $('np-prof').value.trim();
  const sceneName = $('np-scene').value.trim();
  const w = +$('np-w').value, h = +$('np-h').value;
  const err = $('np-err');
  if (!isValidId(name)) { err.textContent = t('newproj.errName'); return; }
  if (!isValidId(profileId) || !isValidId(sceneName)) { err.textContent = t('newproj.errId'); return; }
  if (!(w > 0) || !(h > 0)) { err.textContent = t('newproj.errSize'); return; }
  const dev = $('np-device').value;
  const boards = dev === 'custom' ? [] : (presets[+dev] ? presets[+dev].boards : []);
  loadProject(newProject({
    name, targetLibrary: $('np-lib').value, profileId,
    w, h, rotation: +$('np-rot').value, boards, sceneName,
  }));
  close();
}

export function initNewProject(openButtonId) {
  fillDeviceMenu();
  $('np-device').addEventListener('change', applyPreset);
  $('np-create').addEventListener('click', create);
  $('np-cancel').addEventListener('click', close);
  $('newproj-overlay').addEventListener('click', (ev) => { if (ev.target.id === 'newproj-overlay') close(); });
  if (openButtonId) $(openButtonId).addEventListener('click', open);
  return { open, close };
}
