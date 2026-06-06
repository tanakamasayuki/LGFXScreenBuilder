// Project data model for the authoring tool.
//
// Shape (rich editor form; serialized to .lgfxsb.json, §9):
//   project = {
//     name, targetLibrary, background ('#rrggbb'),
//     profiles: [{ id, w, h, rotation, boards:[], layout }],
//       layout: { [sceneId]: { [partId]: placement } }   // per profile, per scene, per part
//     scenes:   [{ id, desc, parts:[{ id, type, desc, asset }] }],
//   }
// Each profile holds a complete, independent layout per scene (no base/override; §8.9.6).
// The generated struct depends only on part id/type (§8.2); placement lives here.

export const PART_TYPES = ['Rect', 'Text', 'Image'];

// 9-point datum codes, ordering matches lgfxsb::Datum / LovyanGFX textdatum_t.
// Display labels are localized via i18n (datum.<code>).
export const DATUMS = ['TL', 'TC', 'TR', 'ML', 'MC', 'MR', 'BL', 'BC', 'BR'];
export const DATUM_FX = { L: 0, C: 0.5, R: 1 };
export const DATUM_FY = { T: 0, M: 0.5, B: 1 };

// Orientation as a code; localized via i18n (orient.<code>).
export const orient = (w, h) => (w > h ? 'landscape' : h > w ? 'portrait' : 'square');

// Displayed (post-rotation) dimensions. profile.w/h are the panel's native
// (rotation-0) size; the runtime applies setRotation(rotation) before drawing
// (Renderer.h §7), so an odd rotation swaps width/height in the coordinate space
// that layouts are authored in. Use this for canvases/previews, not p.w/p.h.
export const dispDims = (p) => ((p.rotation & 1) ? { w: p.h, h: p.w } : { w: p.w, h: p.h });

// Placement factories. Rect/Image carry w/h; Text carries datum/size (no box; §8.7).
const rect = (x, y, w, h, color, visible = true, r = 0, fill = true) => ({ x, y, w, h, r, fill, color, visible });
const text = (x, y, datum, size, color, content, visible = true) =>
  ({ x, y, datum, size, color, text: content, visible });

// A sample project mirroring the design probe, used until load/save lands.
export function sampleProject() {
  const scenes = [
    {
      id: 'Boot', desc: '起動直後に一瞬だけ出すスプラッシュ', parts: [
        { id: 'logo', type: 'Rect', desc: '' },
        { id: 'boot', type: 'Text', desc: '起動メッセージ' },
      ],
    },
    {
      id: 'Main', desc: '', parts: [
        { id: 'headerBand', type: 'Rect', desc: '' },
        { id: 'title', type: 'Text', desc: '' },
        { id: 'battery', type: 'Text', desc: '' },
        { id: 'temp', type: 'Text', desc: 'メイン計測値' },
        { id: 'panel', type: 'Rect', desc: '' },
      ],
    },
    {
      id: 'Settings', desc: '', parts: [
        { id: 'header', type: 'Rect', desc: '' },
        { id: 'ttl', type: 'Text', desc: '' },
        { id: 'row1', type: 'Text', desc: '' },
      ],
    },
  ];

  const profiles = [
    {
      id: 'Core', w: 320, h: 240, rotation: 0, boards: ['M5Stack', 'Core2', 'CoreS3'],
      layout: {
        Boot: {
          logo: rect(110, 80, 100, 60, '#1e2a30'),
          boot: text(160, 160, 'MC', 2, '#9ce5ac', 'Booting...'),
        },
        Main: {
          headerBand: rect(0, 0, 320, 40, '#1e2a30'),
          title: text(12, 10, 'TL', 2, '#ffffff', 'Main'),
          battery: text(310, 12, 'TR', 1.5, '#9ce5ac', '82%'),
          temp: text(18, 70, 'TL', 4, '#ffffff', '24.5C'),
          panel: rect(18, 150, 284, 54, '#172126'),
        },
        Settings: {
          header: rect(0, 0, 320, 40, '#1e2a30'),
          ttl: text(12, 10, 'TL', 2, '#ffffff', 'Settings'),
          row1: text(18, 60, 'TL', 2, '#ffffff', 'Wi-Fi'),
        },
      },
    },
    {
      id: 'Stick', w: 135, h: 240, rotation: 0, boards: ['StickCPlus', 'StickCPlus2'],
      layout: {
        Boot: {
          logo: rect(30, 80, 75, 50, '#1e2a30'),
          boot: text(69, 148, 'MC', 1.5, '#9ce5ac', 'Boot...'),
        },
        Main: {
          headerBand: rect(0, 0, 135, 30, '#1e2a30'),
          title: text(8, 7, 'TL', 1.5, '#ffffff', 'Main'),
          battery: text(8, 180, 'TL', 1.5, '#9ce5ac', '82%'),
          temp: text(10, 60, 'TL', 3.5, '#ffffff', '24.5'),
          panel: rect(10, 110, 115, 60, '#172126'),
        },
        Settings: {
          header: rect(0, 0, 135, 30, '#1e2a30'),
          ttl: text(8, 7, 'TL', 1.5, '#ffffff', 'Settings'),
          row1: text(10, 40, 'TL', 1.5, '#ffffff', 'Wi-Fi'),
        },
      },
    },
    {
      id: 'Cardputer', w: 240, h: 135, rotation: 0, boards: ['Cardputer', 'DinMeter'],
      layout: {
        Boot: {
          logo: rect(80, 30, 80, 40, '#1e2a30'),
          boot: text(120, 88, 'MC', 1.5, '#9ce5ac', 'Booting...'),
        },
        Main: {
          headerBand: rect(0, 0, 240, 26, '#1e2a30'),
          title: text(8, 5, 'TL', 1.5, '#ffffff', 'Main'),
          battery: text(232, 6, 'TR', 1.25, '#9ce5ac', '82%'),
          temp: text(12, 40, 'TL', 3, '#ffffff', '24.5C'),
          panel: rect(12, 86, 216, 40, '#172126', false),
        },
        Settings: {
          header: rect(0, 0, 240, 26, '#1e2a30'),
          ttl: text(8, 5, 'TL', 1.5, '#ffffff', 'Settings'),
          row1: text(12, 36, 'TL', 1.5, '#ffffff', 'Wi-Fi'),
        },
      },
    },
  ];

  return {
    name: 'MyScreen',
    targetLibrary: 'M5Unified',
    background: '#000000',
    profiles,
    scenes,
    assets: [], // image assets: { id, w, h, dataUrl (preview), rgb565: [] (export) }
    fonts: [],  // adopted preset fonts: { name } (§8.7.3); profile.fonts enables per profile
  };
}

// --- asset mutations (§8.4) ----------------------------------------------
export const assetById = (project, id) => (project.assets || []).find((a) => a.id === id);

// Add an image asset (already decoded to w/h + dataUrl + rgb565). Returns its id.
export function addAsset(project, { name, w, h, dataUrl, rgb565 }) {
  if (!project.assets) project.assets = [];
  const base = (name || 'image').replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9_]/g, '_') || 'image';
  const id = uniqueId(/^[A-Za-z_]/.test(base) ? base : 'img_' + base, new Set(project.assets.map((a) => a.id)));
  project.assets.push({ id, w, h, dataUrl, rgb565 });
  return id;
}

// Remove an asset and clear any Image part that referenced it.
export function removeAsset(project, id) {
  project.assets = (project.assets || []).filter((a) => a.id !== id);
  for (const sc of project.scenes) for (const p of sc.parts) if (p.asset === id) p.asset = null;
}

// Rename an asset (C identifier; becomes a PROGMEM symbol). No-op on dup/invalid.
export function renameAsset(project, oldId, newId) {
  newId = (newId || '').trim();
  if (!newId || newId === oldId || !isValidId(newId)) return oldId;
  if ((project.assets || []).some((a) => a.id === newId)) return oldId;
  const a = assetById(project, oldId);
  if (!a) return oldId;
  a.id = newId;
  for (const sc of project.scenes) for (const p of sc.parts) if (p.asset === oldId) p.asset = newId;
  return newId;
}

// Where an asset is used: list of "scene.part" labels.
export function assetUsage(project, id) {
  const out = [];
  for (const sc of project.scenes) for (const p of sc.parts) if (p.asset === id) out.push(`${sc.id}.${p.id}`);
  return out;
}

// Build a fresh project from the New-project dialog inputs (§9.1): one profile
// and one empty scene. Ids are assumed pre-validated as C identifiers (§8.12).
export function newProject({ name, targetLibrary, profileId, w, h, rotation, boards, sceneName }) {
  const profile = { id: profileId, w, h, rotation, boards: boards ? [...boards] : [], fonts: [], layout: { [sceneName]: {} } };
  return {
    name,
    targetLibrary: targetLibrary || 'M5Unified',
    background: '#000000',
    profiles: [profile],
    scenes: [{ id: sceneName, desc: '', parts: [] }],
    assets: [],
    fonts: [],
  };
}

// --- font adoption (§8.7.3/§8.7.4) ---------------------------------------
// project.fonts = adopted preset fonts [{ name }] (name = catalog/`fonts::` symbol).
// profile.fonts = names enabled for that profile (per-profile usage flag, §8.7.4).
export const isFontAdopted = (project, name) => (project.fonts || []).some((f) => f.name === name);
export const profileFonts = (project, profileId) => {
  const adopted = new Set((project.fonts || []).map((f) => f.name));
  const p = profileById(project, profileId);
  return ((p && p.fonts) || []).filter((n) => adopted.has(n));
};

// Adopt a preset font into the project and enable it for every profile by default.
export function adoptFont(project, name) {
  if (!project.fonts) project.fonts = [];
  if (!project.fonts.some((f) => f.name === name)) project.fonts.push({ name });
  for (const p of project.profiles) { if (!p.fonts) p.fonts = []; if (!p.fonts.includes(name)) p.fonts.push(name); }
  return name;
}

// Drop an adopted font everywhere (project, every profile, and any Text using it).
export function removeFont(project, name) {
  project.fonts = (project.fonts || []).filter((f) => f.name !== name);
  for (const p of project.profiles) {
    if (p.fonts) p.fonts = p.fonts.filter((n) => n !== name);
    clearFontRefs(p, name);
  }
}

// Enable/disable an adopted font for one profile. Disabling clears Text in that
// profile that referenced it (falls back to the default font).
export function toggleProfileFont(project, profileId, name) {
  const p = profileById(project, profileId);
  if (!p) return;
  if (!p.fonts) p.fonts = [];
  if (p.fonts.includes(name)) { p.fonts = p.fonts.filter((n) => n !== name); clearFontRefs(p, name); }
  else p.fonts.push(name);
}

function clearFontRefs(profile, name) {
  for (const sid in (profile.layout || {})) {
    const s = profile.layout[sid];
    for (const pid in s) if (s[pid] && s[pid].font === name) s[pid].font = null;
  }
}

// Where a font is used: list of "profile/scene.part" labels.
export function fontUsage(project, name) {
  const out = [];
  for (const p of project.profiles) {
    for (const sc of project.scenes) {
      const s = p.layout[sc.id];
      if (!s) continue;
      for (const part of sc.parts) if (s[part.id] && s[part.id].font === name) out.push(`${p.id}/${sc.id}.${part.id}`);
    }
  }
  return out;
}

// --- profile mutations (§8.9) --------------------------------------------
// Deep-copy a profile's per-scene/per-part layout so clones stay independent.
function cloneLayout(layout) {
  const out = {};
  for (const sid in layout) { out[sid] = {}; for (const pid in layout[sid]) out[sid][pid] = { ...layout[sid][pid] }; }
  return out;
}

// Add a profile. With cloneFromId, start from a copy of that profile's layout
// (§8.9.6 "copy to start"); otherwise start empty. Returns the new id.
export function addProfile(project, { w, h, rotation }, cloneFromId) {
  const id = uniqueId('Profile', new Set(project.profiles.map((p) => p.id)));
  const src = cloneFromId ? profileById(project, cloneFromId) : null;
  const layout = src ? cloneLayout(src.layout) : {};
  for (const sc of project.scenes) if (!layout[sc.id]) layout[sc.id] = {};
  project.profiles.push({ id, w, h, rotation: rotation == null ? 0 : rotation, boards: [], layout });
  return id;
}

// Remove a profile (never the last one).
export function removeProfile(project, id) {
  if (project.profiles.length <= 1) return false;
  project.profiles = project.profiles.filter((p) => p.id !== id);
  return true;
}

// Rename a profile (C identifier; becomes Profile::<Id>). No-op on dup/invalid.
export function renameProfile(project, oldId, newId) {
  newId = (newId || '').trim();
  if (!newId || newId === oldId || !isValidId(newId)) return oldId;
  if (project.profiles.some((p) => p.id === newId)) return oldId;
  profileById(project, oldId).id = newId;
  return newId;
}

// Toggle a board on a profile. Auto-detect is one board per profile, so
// assigning moves it off any other profile (§8.9.2).
export function toggleBoard(project, profileId, boardId) {
  const p = profileById(project, profileId);
  if (!p) return;
  if (p.boards.includes(boardId)) { p.boards = p.boards.filter((b) => b !== boardId); return; }
  for (const x of project.profiles) if (x !== p) x.boards = x.boards.filter((b) => b !== boardId);
  p.boards.push(boardId);
}

// --- lookups -------------------------------------------------------------
export const sceneById = (project, id) => project.scenes.find((s) => s.id === id);
export const profileById = (project, id) => project.profiles.find((p) => p.id === id);
export const partDef = (scene, id) => scene.parts.find((p) => p.id === id);

// Placement of a part for a given profile + scene (always present in this model).
export function placement(profile, sceneId, partId) {
  const s = profile.layout[sceneId];
  return s ? s[partId] : undefined;
}

// --- structural mutations ------------------------------------------------
// Invariant (§8.2/§8.9.6): a part def (id/type) is shared across all
// profiles; its placement lives per profile, per scene. So adding/removing a
// part or scene must touch every profile's layout in lockstep — that is why
// these live here rather than scattered in the UI.

// en: A valid C identifier (ids become struct members in generated code, §8.12).
// ja: 生成コードで構造体メンバになるため C 識別子に限定（§8.12）。
export const isValidId = (s) => /^[A-Za-z_]\w*$/.test(s);

// Pick an unused id of the form base / base2 / base3 ... given taken ids.
function uniqueId(base, taken) {
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(base + i)) i++;
  return base + i;
}

// Default placement for a freshly added part, roughly centered on the profile.
function defaultPlacement(type, profile) {
  const cx = Math.round(profile.w / 2), cy = Math.round(profile.h / 2);
  if (type === 'Text') return text(cx, cy, 'MC', 1.5, '#ffffff', 'Text');
  const w = Math.min(80, profile.w - 8), h = Math.min(48, profile.h - 8);
  const x = cx - (w >> 1), y = cy - (h >> 1);
  if (type === 'Image') return { x, y, w, h, visible: true };
  return rect(x, y, w, h, '#1e2a30'); // Rect
}

// Absolute origin is always the scene root; retained as a small compatibility
// helper for callers that previously supported groups.
export function absOrigin(profile, sceneId, scene, part) {
  return { x: 0, y: 0 };
}

// Add a part to a scene and create its placement in every profile. Returns id.
export function addPart(project, sceneId, type) {
  const scene = sceneById(project, sceneId);
  const id = uniqueId(type.toLowerCase(), new Set(scene.parts.map((p) => p.id)));
  scene.parts.push({ id, type, desc: '' });
  for (const pr of project.profiles) {
    if (!pr.layout[sceneId]) pr.layout[sceneId] = {};
    pr.layout[sceneId][id] = defaultPlacement(type, pr);
  }
  return id;
}

// Remove a part from the scene and from every profile's layout.
export function removePart(project, sceneId, partId) {
  const scene = sceneById(project, sceneId);
  scene.parts = scene.parts.filter((p) => p.id !== partId);
  for (const pr of project.profiles) {
    const s = pr.layout[sceneId];
    if (s) delete s[partId];
  }
}

// Reorder the selected part. dir +1 = toward front (drawn
// later / shown higher in the layer panel), -1 = toward back. Subtree moves too.
export function reorderPart(project, sceneId, id, dir) {
  const scene = sceneById(project, sceneId);
  const i = scene.parts.findIndex((p) => p.id === id), j = i + dir;
  if (i < 0 || j < 0 || j >= scene.parts.length) return;
  [scene.parts[i], scene.parts[j]] = [scene.parts[j], scene.parts[i]];
}

// Rename a part within a scene (updates every profile's layout key). No-op
// (returns oldId) on empty/duplicate/invalid id.
export function renamePart(project, sceneId, oldId, newId) {
  newId = (newId || '').trim();
  if (!newId || newId === oldId || !isValidId(newId)) return oldId;
  const scene = sceneById(project, sceneId);
  if (scene.parts.some((p) => p.id === newId)) return oldId;
  for (const p of scene.parts) if (p.id === oldId) p.id = newId;
  for (const pr of project.profiles) {
    const s = pr.layout[sceneId];
    if (s && oldId in s) { s[newId] = s[oldId]; delete s[oldId]; }
  }
  return newId;
}

// Add an empty scene and an empty layout for it in every profile. Returns id.
export function addScene(project, baseName = 'Scene') {
  const id = uniqueId(baseName, new Set(project.scenes.map((s) => s.id)));
  project.scenes.push({ id, desc: '', parts: [] });
  for (const pr of project.profiles) pr.layout[id] = {};
  return id;
}

// Remove a scene and its layout from every profile.
export function removeScene(project, sceneId) {
  project.scenes = project.scenes.filter((s) => s.id !== sceneId);
  for (const pr of project.profiles) delete pr.layout[sceneId];
}

// Rename a scene (updates every profile's layout key). No-op on dup/invalid.
export function renameScene(project, oldId, newId) {
  newId = (newId || '').trim();
  if (!newId || newId === oldId || !isValidId(newId)) return oldId;
  if (project.scenes.some((s) => s.id === newId)) return oldId;
  sceneById(project, oldId).id = newId;
  for (const pr of project.profiles) {
    if (pr.layout[oldId]) { pr.layout[newId] = pr.layout[oldId]; delete pr.layout[oldId]; }
  }
  return newId;
}

// --- AI layout import (§8.15) --------------------------------------------
// Fold a one-scene x all-profiles AI layout JSON (docs/AI_LAYOUT_IO.md) back
// into the model. The model keeps ONE shared (id,type)+order per scene
// plus a per-profile placement map, so part definitions are taken from a single
// canonical profile and each project profile's placements are rebuilt from it.

const HEX6 = /^#[0-9a-fA-F]{6}$/;
const toInt = (v, d = 0) => (Number.isFinite(+v) ? Math.round(+v) : d);
const toColor = (v, d) => (typeof v === 'string' && HEX6.test(v) ? v.toLowerCase() : d);

// Placement object for one part, from its AI entry + type (mirrors the factories).
function aiPlacement(type, p) {
  const x = toInt(p.x), y = toInt(p.y), visible = p.visible !== false;
  if (type === 'Text') {
    return {
      x, y,
      datum: DATUMS.includes(p.datum) ? p.datum : 'TL',
      size: Number.isFinite(+p.size) ? +p.size : 1,
      color: toColor(p.color, '#ffffff'),
      text: typeof p.text === 'string' ? p.text : '',
      font: p.font || null,
      visible,
    };
  }
  const w = Math.max(1, toInt(p.w, 1)), h = Math.max(1, toInt(p.h, 1));
  if (type === 'Rect') return {
    x, y, w, h,
    r: Math.max(0, toInt(p.r, 0)),
    fill: p.fill !== false,
    color: toColor(p.color, '#1e2a30'),
    visible,
  };
  return { x, y, w, h, visible }; // Image (asset lives on the part definition)
}

// Reconcile a parsed AI layout against the project. Pure: no mutation. Returns
// { errors[], warnings[], sceneId, exists, mode, partDefs, layouts, partCount }.
export function reconcileAiLayout(project, obj) {
  const errors = [], warnings = [];
  if (!obj || typeof obj !== 'object') return { errors: ['Top-level JSON is not an object.'], warnings };
  if (obj.format && obj.format !== 'lgfxsb-layout') warnings.push(`Unexpected format "${obj.format}".`);
  const sceneId = obj.scene;
  const profs = Array.isArray(obj.profiles) ? obj.profiles : [];
  if (!isValidId(sceneId)) errors.push(`scene "${sceneId}" is not a valid identifier.`);
  if (!profs.length) errors.push('Layout has no profiles.');
  if (errors.length) return { errors, warnings };

  // Canonical profile for definitions: the first profile in the AI JSON.
  const canonical = profs[0];
  const existingScene = sceneById(project, sceneId);

  // Part definitions (id/type/asset) from the canonical profile.
  const partDefs = [], seen = new Set();
  for (const p of (canonical.parts || [])) {
    if (!isValidId(p.id)) { errors.push(`part id "${p.id}" is not a valid identifier.`); continue; }
    if (seen.has(p.id)) { errors.push(`duplicate part id "${p.id}".`); continue; }
    if (!PART_TYPES.includes(p.type)) { errors.push(`part "${p.id}" has unknown type "${p.type}".`); continue; }
    seen.add(p.id);
    let asset = null;
    if (p.type === 'Image' && p.asset) {
      if (assetById(project, p.asset)) asset = p.asset;
      else warnings.push(`asset "${p.asset}" (part ${p.id}) is not in the project — left empty.`);
    }
    const prev = existingScene && partDef(existingScene, p.id); // keep existing description
    partDefs.push({ id: p.id, type: p.type, desc: (prev && prev.desc) || '', asset });
  }
  if (errors.length) return { errors, warnings };

  // Per-profile placements for every PROJECT profile.
  const aiById = new Map(profs.map((p) => [p.id, p]));
  const canonParts = new Map((canonical.parts || []).map((p) => [p.id, p]));
  const layouts = {};
  const skipped = profs.filter((p) => !profileById(project, p.id)).map((p) => p.id);
  if (skipped.length) warnings.push(`profiles not in the project, ignored: ${skipped.join(', ')}.`);
  for (const pr of project.profiles) {
    const src = aiById.get(pr.id);
    if (!src) warnings.push(`profile "${pr.id}" missing from layout — placements cloned from "${canonical.id}".`);
    const srcParts = src ? new Map((src.parts || []).map((p) => [p.id, p])) : null;
    const map = {};
    for (const d of partDefs) {
      const ai = (srcParts && srcParts.get(d.id)) || canonParts.get(d.id) || {};
      map[d.id] = aiPlacement(d.type, ai);
    }
    layouts[pr.id] = map;
  }

  // Cross-profile (id,type) consistency note vs the canonical definition.
  const canonSig = [...canonParts.keys()].map((id) => `${id}:${canonParts.get(id).type}`).sort().join('|');
  for (const p of profs) {
    if (p === canonical) continue;
    const sig = (p.parts || []).map((q) => `${q.id}:${q.type}`).sort().join('|');
    if (sig !== canonSig) warnings.push(`profile "${p.id}" part set differs from "${canonical.id}" — "${canonical.id}" used as the definition.`);
  }

  return { errors, warnings, sceneId, exists: !!existingScene, mode: existingScene ? 'update' : 'add', partDefs, layouts, partCount: partDefs.length };
}

// Apply a parsed AI layout (mutates project). Updates the scene if its id exists,
// otherwise adds it. Returns { ok, sceneId, mode, warnings } or { errors }.
export function applyAiLayout(project, obj) {
  const r = reconcileAiLayout(project, obj);
  if (r.errors.length) return { errors: r.errors, warnings: r.warnings };
  let scene = sceneById(project, r.sceneId);
  const desc = typeof obj.desc === 'string' ? obj.desc : '';
  if (scene) { scene.parts = r.partDefs; scene.desc = desc || scene.desc || ''; }
  else { scene = { id: r.sceneId, desc, parts: r.partDefs }; project.scenes.push(scene); }
  for (const pr of project.profiles) pr.layout[r.sceneId] = r.layouts[pr.id];
  return { ok: true, sceneId: r.sceneId, mode: r.mode, warnings: r.warnings };
}

// Base font height (px) used to convert a text-size multiplier to a px hint (§8.7).
export const BASE_FONT_PX = 8;
export const pxOf = (size) => Math.round(size * BASE_FONT_PX);
