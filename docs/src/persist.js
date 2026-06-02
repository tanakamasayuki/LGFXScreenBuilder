// Project persistence (SPEC §9): explicit save/open of a single .lgfxsb.json,
// plus lightweight autosave/restore via localStorage. Browser-only APIs are
// guarded so the module is importable under Node (for tests).

const AUTOSAVE_KEY = 'lgfxsb.autosave.v1';

export function serialize(project) {
  return JSON.stringify(project, null, 2);
}

// Minimal validation: must look like a project.
export function isProject(obj) {
  return !!obj && typeof obj === 'object' && Array.isArray(obj.profiles) && Array.isArray(obj.scenes);
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
          resolve(obj);
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
    return isProject(obj) ? obj : null;
  } catch { return null; }
}

export function clearAutosave() {
  if (typeof localStorage === 'undefined') return;
  try { localStorage.removeItem(AUTOSAVE_KEY); } catch { /* ignore */ }
}
