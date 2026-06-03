// Minimal reactive store: holds the project plus editor UI state and notifies
// subscribers on change. No framework, no build step.
import { sampleProject } from './model.js';

const listeners = new Set();

export const store = {
  project: sampleProject(),
  ui: {
    mode: 'design',       // active top mode (design | profiles | assets | export)
    sceneId: 'Main',      // active scene (left pane)
    profileId: 'Core',    // active profile (top tabs)
    selected: 'title',    // selected part id, or null (= scene-level properties)
    zoom: 1,
  },
};

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function emit() {
  for (const fn of listeners) fn();
}

// Apply a mutation then notify. `fn` receives the store for in-place edits.
// Use for UI-only changes (selection, zoom, mode); for project edits use mutate().
export function update(fn) {
  fn(store);
  emit();
}

// --- undo / redo ---------------------------------------------------------
// Snapshot-based history of the project (UI state is not part of history). A
// checkpoint captures the project *before* a change; discrete edits go through
// mutate(), continuous/inline edits call checkpoint() once at gesture start.
const MAX_HISTORY = 50;
const undoStack = [];
const redoStack = [];
const clone = (p) => (typeof structuredClone === 'function' ? structuredClone(p) : JSON.parse(JSON.stringify(p)));

export function checkpoint() {
  undoStack.push(clone(store.project));
  if (undoStack.length > MAX_HISTORY) undoStack.shift();
  redoStack.length = 0;
}

// Checkpoint, apply a project mutation, then notify.
export function mutate(fn) {
  checkpoint();
  fn(store);
  emit();
}

export const canUndo = () => undoStack.length > 0;
export const canRedo = () => redoStack.length > 0;

// Clamp UI references that a restored project may no longer contain.
function reconcileUi() {
  const pr = store.project;
  if (!pr.scenes.some((s) => s.id === store.ui.sceneId)) store.ui.sceneId = pr.scenes[0] ? pr.scenes[0].id : null;
  if (!pr.profiles.some((p) => p.id === store.ui.profileId)) store.ui.profileId = pr.profiles[0] ? pr.profiles[0].id : null;
  const sc = pr.scenes.find((s) => s.id === store.ui.sceneId);
  if (!sc || !sc.parts.some((p) => p.id === store.ui.selected)) store.ui.selected = null;
}

export function undo() {
  if (!undoStack.length) return;
  redoStack.push(clone(store.project));
  store.project = undoStack.pop();
  reconcileUi();
  emit();
}

export function redo() {
  if (!redoStack.length) return;
  undoStack.push(clone(store.project));
  store.project = redoStack.pop();
  reconcileUi();
  emit();
}

// Replace the whole project (load/open/new) and reset UI to valid defaults.
export function loadProject(project) {
  store.project = project;
  undoStack.length = 0;
  redoStack.length = 0;
  const firstScene = project.scenes[0];
  const firstProfile = project.profiles[0];
  store.ui.sceneId = firstScene ? firstScene.id : null;
  store.ui.profileId = firstProfile ? firstProfile.id : null;
  store.ui.selected = null;
  store.ui.zoom = 1;
  emit();
}
