// AI layout I/O (SPEC §8.15): build a self-contained, model-faithful JSON of
// ONE scene across ALL profiles, for round-trip authoring/editing by an AI
// assistant. The interface contract handed to the AI is docs/AI_LAYOUT_IO.md
// (published at AI_LAYOUT_DOC_URL). Pure / DOM-free so it can be checked under
// Node, like codegen.js.
//
// Shape (1 scene x all profiles):
//   { format, version, scene, desc, background?, profiles: [
//       { id, w, h, rot, parts: [ <part> ... ] } ] }
// A <part> mirrors model.js placement factories. The part SET (id/type/parent)
// is identical across every profile (data contract §8.2); only placement
// differs per profile.

import { sceneById, placement } from './model.js';

// The AI-facing interface contract, embedded in the output as `spec` so an AI
// that only receives the JSON can locate it. The file has no front matter, so
// GitHub Pages serves it verbatim (raw Markdown) at this .md URL.
export const AI_LAYOUT_DOC_URL =
  'https://tanakamasayuki.github.io/LGFXScreenBuilder/AI_LAYOUT_IO.md';

// One part entry. Field set per type matches model.js:
//   Text  -> x,y,datum,size,color,text   (no w/h; anchored by datum, §8.7)
//   Group -> x,y                          (logical origin only)
//   Rect  -> x,y,w,h,color
//   Image -> x,y,w,h,asset                (asset = existing asset name or null)
// `visible` is always emitted (defaults to true).
function partEntry(def, pl) {
  const e = { id: def.id, type: def.type, parent: def.parent || null };
  if (def.type === 'Text') {
    e.x = pl.x; e.y = pl.y; e.datum = pl.datum; e.size = pl.size;
    e.color = pl.color; e.text = pl.text;
  } else if (def.type === 'Group') {
    e.x = pl.x; e.y = pl.y;
  } else { // Rect / Image
    e.x = pl.x; e.y = pl.y; e.w = pl.w; e.h = pl.h;
    if (def.type === 'Rect') e.color = pl.color;
    if (def.type === 'Image') e.asset = def.asset || null;
  }
  e.visible = pl.visible !== false;
  return e;
}

// Build the AI layout object for `sceneId`, or null if the scene is missing.
export function buildAiLayout(project, sceneId) {
  const scene = sceneById(project, sceneId);
  if (!scene) return null;
  const profiles = project.profiles.map((pr) => ({
    id: pr.id,
    w: pr.w,
    h: pr.h,
    rot: pr.rotation || 0,
    parts: scene.parts.map((def) => partEntry(def, placement(pr, sceneId, def.id) || {})),
  }));
  return {
    format: 'lgfxsb-layout',
    version: 1,
    spec: AI_LAYOUT_DOC_URL, // where to read the field types and rules
    scene: scene.id,
    desc: scene.desc || '',
    background: project.background || undefined, // dropped by JSON.stringify when undefined
    profiles,
  };
}

// Pretty-printed JSON string for the clipboard / a downloaded file.
export function aiLayoutJson(project, sceneId) {
  return JSON.stringify(buildAiLayout(project, sceneId), null, 2);
}
