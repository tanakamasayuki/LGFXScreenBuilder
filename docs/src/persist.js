// Project persistence (SPEC §9): explicit save/open of a single .lgfxsb.json,
// plus lightweight autosave/restore via localStorage. Browser-only APIs are
// guarded so the module is importable under Node (for tests).

import { FORMAT_VERSION } from './version.js';

const AUTOSAVE_KEY = 'lgfxsb.autosave.v1';

export function serialize(project) {
  // Stamp the current format version first; drop any stale value (SPEC §9.2).
  const { formatVersion, ...rest } = project;
  return JSON.stringify({ formatVersion: FORMAT_VERSION, ...rest }, null, 2);
}

// Minimal validation: must look like a project.
export function isProject(obj) {
  return !!obj && typeof obj === 'object' && Array.isArray(obj.profiles) && Array.isArray(obj.scenes);
}

// Apply forward migrations to a freshly-parsed project (SPEC §9.2, Layer 2).
// A missing formatVersion is treated as 1. A newer-than-known version is loaded
// best-effort with a warning (unknown fields are ignored, and may be dropped on
// save); for pinned operation, self-host the matching release.
export function migrate(project) {
  const v = Number.isInteger(project.formatVersion) ? project.formatVersion : 1;
  if (v > FORMAT_VERSION) {
    console.warn(
      `[lgfxsb] project formatVersion ${v} is newer than this tool (FORMAT_VERSION=${FORMAT_VERSION}); ` +
      'loading best-effort — unknown fields are ignored and may be dropped on save. ' +
      'For pinned operation, self-host the matching release.'
    );
  }
  // Forward migrations (v -> v+1) are applied here as the format evolves.
  return project;
}

// Trigger a file download of text content.
function download(filename, text, mime = 'application/json') {
  if (typeof document === 'undefined') return;
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function saveProjectFile(project) {
  download(`${project.name || 'project'}.lgfxsb.json`, serialize(project));
}

export function downloadText(filename, text, mime) {
  download(filename, text, mime || 'text/plain');
}

// Open a .lgfxsb.json via a file picker; resolves to the parsed project.
export function openProjectFile() {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') { reject(new Error('no document')); return; }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = () => {
      const file = input.files && input.files[0];
      if (!file) { resolve(null); return; }
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const obj = JSON.parse(reader.result);
          if (!isProject(obj)) throw new Error('not a LGFXScreenBuilder project');
          resolve(migrate(obj));
        } catch (e) { reject(e); }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    };
    input.click();
  });
}

// --- autosave (latest state only) ---------------------------------------
export function autosave(project) {
  if (typeof localStorage === 'undefined') return;
  try { localStorage.setItem(AUTOSAVE_KEY, serialize(project)); } catch { /* quota etc. */ }
}

export function loadAutosave() {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    return isProject(obj) ? migrate(obj) : null;
  } catch { return null; }
}

export function clearAutosave() {
  if (typeof localStorage === 'undefined') return;
  try { localStorage.removeItem(AUTOSAVE_KEY); } catch { /* ignore */ }
}

// --- in-place save via File System Access API (§9.3) ---------------------
// Per-target FileSystemFileHandle registry. Keys: 'project' | 'header' | 'sketch'.
// Browser-only APIs are touched inside functions only, so this module still
// imports cleanly under Node (gen-fixtures uses isProject/serialize).
const handles = new Map();

// Common picker file-type filters.
export const ACCEPT = {
  project: { 'application/json': ['.lgfxsb.json', '.json'] },
  header: { 'text/x-c': ['.h'] },
  sketch: { 'text/x-arduino': ['.ino'] },
};

export function fsaSupported() {
  return typeof window !== 'undefined' && 'showSaveFilePicker' in window;
}

// Name of the file currently bound to `key`, or null if none / unsupported.
export function boundFileName(key) {
  const h = handles.get(key);
  return h ? h.name : null;
}

export function clearHandle(key) { handles.delete(key); }
export function clearAllHandles() { handles.clear(); }

async function ensureWritable(handle) {
  const opts = { mode: 'readwrite' };
  if ((await handle.queryPermission(opts)) === 'granted') return true;
  return (await handle.requestPermission(opts)) === 'granted';
}

async function writeHandle(handle, text) {
  const w = await handle.createWritable();
  await w.write(text);
  await w.close();
}

// Save `text` for a logical target. With the File System Access API, overwrites
// the bound file in place; if none is bound yet it prompts once (showSaveFilePicker)
// and binds the chosen file. Without the API it downloads. Always call from a
// user gesture. Returns one of:
//   { method: 'overwrite' | 'picked' | 'download', name }
//   { cancelled: true }              (user dismissed the picker)
//   { error: 'permission-denied' }   (write permission refused)
export async function saveText(key, suggestedName, text, accept, mime) {
  if (fsaSupported()) {
    let handle = handles.get(key);
    let picked = false;
    try {
      if (!handle) {
        handle = await window.showSaveFilePicker({
          suggestedName,
          types: accept ? [{ accept }] : undefined,
        });
        picked = true;
      }
      if (!(await ensureWritable(handle))) return { error: 'permission-denied' };
      await writeHandle(handle, text);
      handles.set(key, handle);
      return { method: picked ? 'picked' : 'overwrite', name: handle.name };
    } catch (e) {
      if (e && e.name === 'AbortError') return { cancelled: true };
      throw e;
    }
  }
  download(suggestedName, text, mime || 'application/octet-stream');
  return { method: 'download', name: suggestedName };
}

// Force a re-pick (Save As) and rebind.
export async function saveAsText(key, suggestedName, text, accept, mime) {
  if (fsaSupported()) handles.delete(key);
  return saveText(key, suggestedName, text, accept, mime);
}

// Open a project. With the File System Access API the handle is kept so a later
// Save overwrites the same file. Resolves to the parsed project, or null if the
// user cancelled. Throws on a non-project / parse error.
export async function openProject() {
  if (fsaSupported()) {
    let handle;
    try {
      [handle] = await window.showOpenFilePicker({
        types: [{ description: 'LGFXScreenBuilder project', accept: ACCEPT.project }],
        multiple: false,
      });
    } catch (e) {
      if (e && e.name === 'AbortError') return null;
      throw e;
    }
    const file = await handle.getFile();
    const obj = JSON.parse(await file.text());
    if (!isProject(obj)) throw new Error('not a LGFXScreenBuilder project');
    handles.set('project', handle);
    return migrate(obj);
  }
  const project = await openProjectFile();
  if (project) handles.delete('project');
  return project;
}
