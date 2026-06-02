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
export function update(fn) {
  fn(store);
  emit();
}

// Replace the whole project (load/open/new) and reset UI to valid defaults.
export function loadProject(project) {
  store.project = project;
  const firstScene = project.scenes[0];
  const firstProfile = project.profiles[0];
  store.ui.sceneId = firstScene ? firstScene.id : null;
  store.ui.profileId = firstProfile ? firstProfile.id : null;
  store.ui.selected = null;
  store.ui.zoom = 1;
  emit();
}
