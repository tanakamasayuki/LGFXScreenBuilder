// Assets mode: import image assets (PNG/JPEG), preview them, and manage their
// ids/usage (§8.4). On import an image is decoded to RGB565 for Header/PROGMEM
// output and kept alongside its data URL for preview. Slices and spritesheets
// are outside the current scope.
import { store, update, mutate, checkpoint } from './store.js';
import { assetById, addAsset, removeAsset, renameAsset, assetUsage } from './model.js';
import { t } from './i18n.js';

const $ = (id) => document.getElementById(id);
let selAsset = null;

const cur = () => assetById(store.project, selAsset);

// Decode an image File to { name, w, h, dataUrl, rgb565 } (browser-only: canvas).
function decodeImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read failed'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('decode failed'));
      img.onload = () => {
        const w = img.naturalWidth, h = img.naturalHeight;
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        const ctx = cv.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const px = ctx.getImageData(0, 0, w, h).data; // RGBA8888
        const rgb565 = new Array(w * h);
        for (let i = 0, p = 0; i < rgb565.length; i++, p += 4) {
          rgb565[i] = ((px[p] & 0xF8) << 8) | ((px[p + 1] & 0xFC) << 3) | (px[p + 2] >> 3);
        }
        resolve({ name: file.name, w, h, dataUrl: reader.result, rgb565 });
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function renderList() {
  const el = $('asset-list');
  el.innerHTML = '';
  const assets = store.project.assets || [];
  if (!assets.length) { el.innerHTML = `<p class="sub">${t('assets.empty')}</p>`; return; }
  if (!assets.some((a) => a.id === selAsset)) selAsset = assets[0].id;
  for (const a of assets) {
    const it = document.createElement('div');
    it.className = 'asset-item' + (a.id === selAsset ? ' active' : '');
    it.innerHTML = `<span class="thumb" style="background-image:url('${a.dataUrl}')"></span><span>${a.id}</span><span class="meta">${a.w}×${a.h}</span>`;
    it.onclick = () => { selAsset = a.id; renderAssets(); };
    el.appendChild(it);
  }
}

function renderPreview() {
  const a = cur();
  const box = $('asset-preview');
  $('asset-name').textContent = a ? `${a.id} — ${a.w}×${a.h}` : '';
  if (!a) { box.style.display = 'none'; return; }
  box.style.display = '';
  const fit = Math.min(440 / a.w, 320 / a.h, 8);
  box.style.width = a.w * fit + 'px';
  box.style.height = a.h * fit + 'px';
  box.style.backgroundImage = `url("${a.dataUrl}")`;
}

function renderProps() {
  const a = cur();
  const el = $('asset-props');
  if (!a) { el.innerHTML = `<p class="sub">${t('assets.selectAsset')}</p>`; return; }
  const usage = assetUsage(store.project, a.id);
  el.innerHTML =
    `<div class="field"><label>${t('field.assetId')}</label><input id="a-id" value="${a.id}"></div>` +
    `<div class="field"><label>${t('field.assetSize')}</label><div class="readout">${a.w} × ${a.h}</div></div>` +
    `<div class="field"><label>${t('assets.usage')}</label><div class="readout">${usage.length ? usage.join(', ') : `<span class="sub">${t('assets.unused')}</span>`}</div></div>` +
    `<div class="delrow"><button class="mini danger" id="a-del">${t('btn.delAsset')}</button></div>`;
  $('a-id').addEventListener('change', () => { selAsset = renameAsset(store.project, a.id, $('a-id').value); update(() => {}); });
  $('a-del').onclick = () => {
    if (!confirm(t('confirm.delAsset', { id: a.id }))) return;
    mutate((st) => { removeAsset(st.project, a.id); });
    selAsset = null;
  };
}

export function renderAssets() {
  renderList();
  renderPreview();
  renderProps();
  const n = (store.project.assets || []).length;
  $('asset-st-l').textContent = t('assets.count', { n });
  $('asset-st-r').textContent = t('assets.output');
}

export function initAssets() {
  $('asset-import').addEventListener('click', () => $('asset-file').click());
  $('asset-file').addEventListener('change', async (ev) => {
    const files = [...ev.target.files];
    ev.target.value = '';
    if (!files.length) return;
    checkpoint(); // one undo step for the whole import batch
    for (const f of files) {
      try {
        const decoded = await decodeImage(f);
        selAsset = addAsset(store.project, decoded);
      } catch (e) { alert('Import failed: ' + e.message); }
    }
    update(() => {}); // re-render (and autosave picks it up)
  });
  // Inspector inline edits (asset id rename): one checkpoint per edit session.
  const props = $('asset-props');
  let armed = false;
  props.addEventListener('focusin', () => { armed = true; });
  const armFire = () => { if (armed) { checkpoint(); armed = false; } };
  props.addEventListener('input', armFire, true);
  props.addEventListener('change', armFire, true);
}
