// AI layout I/O (SPEC §8.15): build a self-contained, model-faithful JSON of
// ONE scene across ALL profiles, for round-trip authoring/editing by an AI
// assistant. The interface contract handed to the AI is docs/AI_LAYOUT_IO.md
// (published at AI_LAYOUT_DOC_URL). Pure / DOM-free so it can be checked under
// Node, like codegen.js.
//
// Shape (1 scene x all profiles):
//   { format, version, scene, desc, transparent?, background?, profiles: [
//       { id, w, h, rot, parts: [ <part> ... ] } ] }
// A <part> mirrors model.js placement factories. The part SET (id/type)
// is identical across every profile (data contract §8.2); only placement
// differs per profile.

import { sceneById, placement, profileFonts, isTransparentScene, transparentColorOf } from './model.js';
import { contentOf, fontByName, heightOf } from './fonts.js';

// The AI-facing interface contract, embedded in the output as `spec` so an AI
// that only receives the JSON can locate it. The file has no front matter, so
// GitHub Pages serves it verbatim (raw Markdown) at this .md URL.
export const AI_LAYOUT_DOC_URL =
  'https://tanakamasayuki.github.io/LGFXScreenBuilder/AI_LAYOUT_IO.md';

// One part entry. Field set per type matches model.js:
//   Text  -> x,y,datum,size,color,text,font  (no w/h; anchored by datum, §8.7;
//                                              font = adopted font name or null=default)
//   Rect  -> x,y,w,h,r,fill,color
//   Line  -> x,y,x2,y2,color
//   Circle -> x,y,r,fill,color
//   Image -> x,y,w,h,asset                (asset = existing asset name or null)
// `visible` is always emitted (defaults to true).
function partEntry(def, pl) {
  const e = { id: def.id, type: def.type };
  if (def.type === 'Text') {
    e.x = pl.x; e.y = pl.y; e.datum = pl.datum; e.size = pl.size;
    e.color = pl.color; e.text = pl.text; e.font = pl.font || null;
  } else if (def.type === 'Line') {
    e.x = pl.x; e.y = pl.y; e.x2 = pl.x2; e.y2 = pl.y2; e.color = pl.color;
  } else if (def.type === 'Circle') {
    e.x = pl.x; e.y = pl.y; e.r = pl.r || 1; e.fill = pl.fill !== false; e.color = pl.color;
  } else { // Rect / Image
    e.x = pl.x; e.y = pl.y; e.w = pl.w; e.h = pl.h;
    if (def.type === 'Rect') {
      e.r = pl.r || 0;
      e.fill = pl.fill !== false;
      e.color = pl.color;
    }
    if (def.type === 'Image') e.asset = def.asset || null;
  }
  e.visible = pl.visible !== false;
  return e;
}

function fontEntry(name) {
  const f = fontByName(name);
  const h = heightOf(name);
  return {
    name,
    family: (f && f.family) || name,
    content: contentOf(f),
    size: f ? f.size : null,
    unit: f ? f.unit : null,
    height: h == null ? (f && f.unit === 'px' ? f.size : null) : h,
  };
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
    fonts: profileFonts(project, pr.id),
    parts: scene.parts.map((def) => partEntry(def, placement(pr, sceneId, def.id) || {})),
  }));
  const fonts = (project.fonts || []).map((f) => fontEntry(f.name));
  return {
    format: 'lgfxsb-layout',
    version: 1,
    spec: AI_LAYOUT_DOC_URL, // where to read the field types and rules
    scene: scene.id,
    desc: scene.desc || '',
    // Transparent (overlay) scene (§8.16): editable, and it changes what the AI
    // should design — no background of its own, so it must not rely on one.
    // Emitted only when set, mirroring how the model stores it.
    transparent: isTransparentScene(scene) || undefined,
    // Visual context. For a transparent scene the color key matters more than the
    // background (a part painted in it is punched out), so it comes along too.
    background: project.background || undefined, // dropped by JSON.stringify when undefined
    transparentColor: isTransparentScene(scene) ? transparentColorOf(project) : undefined,
    fonts,
    profiles,
  };
}

// Minified JSON string for the clipboard / a downloaded file. The clipboard is
// an AI input (not read by a human), so no whitespace — fewer tokens. The
// contract's worked example stays pretty for human readers; AI parses either.
export function aiLayoutJson(project, sceneId) {
  return JSON.stringify(buildAiLayout(project, sceneId));
}

// Parse a layout JSON pasted from an AI reply. Chat models routinely wrap their
// output in a Markdown code fence (```json ... ```), sometimes with prose around
// it, so strip the first fenced block (the inner content) before parsing; if no
// fence is present, parse the trimmed text as-is. Returns { obj } on success or
// { err } with the parser message.
// AI の返信から貼り付けたレイアウト JSON を取り込む。多くのチャットモデルは出力を
// ```json ... ``` で囲む（前後に文章が付くこともある）ため、最初のフェンス内側を
// 取り出してから parse する。フェンスが無ければそのまま（trim して）parse する。
export function parseAiLayout(text) {
  const src = typeof text === 'string' ? text : '';
  const fence = src.match(/```[^\n`]*\r?\n([\s\S]*?)```/);
  const json = (fence ? fence[1] : src).trim();
  try {
    return { obj: JSON.parse(json) };
  } catch (e) {
    return { err: e.message };
  }
}
