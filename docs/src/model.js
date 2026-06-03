// Project data model for the authoring tool.
//
// Shape (rich editor form; serialized to .lgfxsb.json, §9):
//   project = {
//     name, targetLibrary, background ('#rrggbb'),
//     defaultProfile,                     // fallback chosen at export (§8.9.4); may be null
//     profiles: [{ id, w, h, rotation, boards:[], layout }],
//       layout: { [sceneId]: { [partId]: placement } }   // per profile, per scene, per part
//     scenes:   [{ id, desc, parts:[{ id, type, parent, desc, asset }] }],
//   }
// Each profile holds a complete, independent layout per scene (no base/override; §8.9.6).
// The generated struct depends only on part id/type/parent (§8.2); placement lives here.

export const PART_TYPES = ['Group', 'Rect', 'Text', 'Image'];

// 9-point datum codes, ordering matches lgfxsb::Datum / LovyanGFX textdatum_t.
// Display labels are localized via i18n (datum.<code>).
export const DATUMS = ['TL', 'TC', 'TR', 'ML', 'MC', 'MR', 'BL', 'BC', 'BR'];
export const DATUM_FX = { L: 0, C: 0.5, R: 1 };
export const DATUM_FY = { T: 0, M: 0.5, B: 1 };

// Orientation as a code; localized via i18n (orient.<code>).
export const orient = (w, h) => (w > h ? 'landscape' : h > w ? 'portrait' : 'square');

// Placement factories. Rect/Image carry w/h; Text carries datum/size (no box; §8.7).
const rect = (x, y, w, h, color, visible = true) => ({ x, y, w, h, color, visible });
const text = (x, y, datum, size, color, content, visible = true) =>
  ({ x, y, datum, size, color, text: content, visible });

// A sample project mirroring the design probe, used until load/save lands.
export function sampleProject() {
  const scenes = [
    {
      id: 'Boot', desc: '起動直後に一瞬だけ出すスプラッシュ', parts: [
        { id: 'logo', type: 'Rect', parent: null, desc: '' },
        { id: 'boot', type: 'Text', parent: null, desc: '起動メッセージ' },
      ],
    },
    {
      id: 'Main', desc: '', parts: [
        { id: 'headerBand', type: 'Rect', parent: null, desc: '' },
        { id: 'title', type: 'Text', parent: null, desc: '' },
        { id: 'battery', type: 'Text', parent: null, desc: '' },
        { id: 'temp', type: 'Text', parent: null, desc: 'メイン計測値' },
        { id: 'panel', type: 'Rect', parent: null, desc: '' },
      ],
    },
    {
      id: 'Settings', desc: '', parts: [
        { id: 'header', type: 'Rect', parent: null, desc: '' },
        { id: 'ttl', type: 'Text', parent: null, desc: '' },
        { id: 'row1', type: 'Text', parent: null, desc: '' },
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
    defaultProfile: 'Core',
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
    defaultProfile: profileId,
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

// Remove a profile (never the last one). Fixes defaultProfile if it pointed here.
export function removeProfile(project, id) {
  if (project.profiles.length <= 1) return false;
  project.profiles = project.profiles.filter((p) => p.id !== id);
  if (project.defaultProfile === id) project.defaultProfile = project.profiles[0] ? project.profiles[0].id : null;
  return true;
}

// Rename a profile (C identifier; becomes Profile::<Id>). No-op on dup/invalid.
export function renameProfile(project, oldId, newId) {
  newId = (newId || '').trim();
  if (!newId || newId === oldId || !isValidId(newId)) return oldId;
  if (project.profiles.some((p) => p.id === newId)) return oldId;
  profileById(project, oldId).id = newId;
  if (project.defaultProfile === oldId) project.defaultProfile = newId;
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
// Invariant (§8.2/§8.9.6): a part def (id/type/parent) is shared across all
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
  if (type === 'Group') return { x: cx, y: cy, visible: true }; // logical origin only
  if (type === 'Text') return text(cx, cy, 'MC', 1.5, '#ffffff', 'Text');
  const w = Math.min(80, profile.w - 8), h = Math.min(48, profile.h - 8);
  const x = cx - (w >> 1), y = cy - (h >> 1);
  if (type === 'Image') return { x, y, w, h, visible: true };
  return rect(x, y, w, h, '#1e2a30'); // Rect
}

// --- hierarchy helpers (flat `parts` array + `parent` id; §8.3) ----------
// The array is kept in pre-order (a group is immediately followed by its
// descendants) so draw order = array order and a subtree is a contiguous block.

// Build a forest of { part, children } preserving array order for siblings.
function buildForest(scene) {
  const byId = new Map(scene.parts.map((p) => [p.id, { part: p, children: [] }]));
  const roots = [];
  for (const p of scene.parts) {
    const node = byId.get(p.id);
    const parent = p.parent && byId.get(p.parent);
    if (parent) parent.children.push(node); else roots.push(node);
  }
  return { roots, byId };
}
// Flatten a forest back to a pre-order parts array.
function flattenForest(roots) {
  const out = [];
  const walk = (nodes) => { for (const n of nodes) { out.push(n.part); walk(n.children); } };
  walk(roots);
  return out;
}
// Re-normalize a scene's parts array to pre-order (siblings keep array order).
const normalize = (scene) => flattenForest(buildForest(scene).roots);

// id of a part plus all of its descendants (for cascade delete / cycle checks).
function subtreeIds(scene, rootId) {
  const out = [rootId], stack = [rootId];
  while (stack.length) {
    const cur = stack.pop();
    for (const p of scene.parts) if (p.parent === cur) { out.push(p.id); stack.push(p.id); }
  }
  return out;
}

// Absolute origin of a part = sum of all ancestor groups' local x/y (mirrors
// lgfxsb::Renderer::absOrigin). Cycle-guarded.
export function absOrigin(profile, sceneId, scene, part) {
  let x = 0, y = 0, cur = part;
  const seen = new Set();
  while (cur && cur.parent && !seen.has(cur.id)) {
    seen.add(cur.id);
    const parent = scene.parts.find((p) => p.id === cur.parent);
    if (!parent) break;
    const pl = placement(profile, sceneId, parent.id);
    if (pl) { x += pl.x || 0; y += pl.y || 0; }
    cur = parent;
  }
  return { x, y };
}

// Add a part to a scene and create its placement in every profile. Returns id.
export function addPart(project, sceneId, type) {
  const scene = sceneById(project, sceneId);
  const id = uniqueId(type.toLowerCase(), new Set(scene.parts.map((p) => p.id)));
  scene.parts.push({ id, type, parent: null, desc: '' });
  for (const pr of project.profiles) {
    if (!pr.layout[sceneId]) pr.layout[sceneId] = {};
    pr.layout[sceneId][id] = defaultPlacement(type, pr);
  }
  return id;
}

// Remove a part and (if a group) its whole subtree, from the scene and from
// every profile's layout (§8.3.1: deleting a group cascades to its children).
export function removePart(project, sceneId, partId) {
  const scene = sceneById(project, sceneId);
  const ids = new Set(subtreeIds(scene, partId));
  scene.parts = scene.parts.filter((p) => !ids.has(p.id));
  for (const pr of project.profiles) {
    const s = pr.layout[sceneId];
    if (s) for (const id of ids) delete s[id];
  }
}

// Reorder the selected part among its siblings. dir +1 = toward front (drawn
// later / shown higher in the layer panel), -1 = toward back. Subtree moves too.
export function reorderPart(project, sceneId, id, dir) {
  const scene = sceneById(project, sceneId);
  const { roots, byId } = buildForest(scene);
  const node = byId.get(id);
  if (!node) return;
  const sibs = node.part.parent ? byId.get(node.part.parent).children : roots;
  const i = sibs.indexOf(node), j = i + dir;
  if (j < 0 || j >= sibs.length) return;
  [sibs[i], sibs[j]] = [sibs[j], sibs[i]];
  scene.parts = flattenForest(roots);
}

// Wrap the given parts (which must be siblings) in a new Group, preserving each
// part's absolute position in every profile (§8.3.1). Returns the new group id.
export function groupParts(project, sceneId, ids) {
  const scene = sceneById(project, sceneId);
  const idset = new Set(ids);
  const sel = scene.parts.filter((p) => idset.has(p.id));
  if (!sel.length) return null;
  const parent = sel[0].parent || null;
  if (sel.some((p) => (p.parent || null) !== parent)) return null; // must be siblings
  const gid = uniqueId('group', new Set(scene.parts.map((p) => p.id)));
  for (const pr of project.profiles) {
    const s = pr.layout[sceneId] || (pr.layout[sceneId] = {});
    let ox = Infinity, oy = Infinity;
    for (const m of sel) { const pl = s[m.id]; if (pl) { ox = Math.min(ox, pl.x || 0); oy = Math.min(oy, pl.y || 0); } }
    if (!isFinite(ox)) { ox = 0; oy = 0; }
    s[gid] = { x: ox, y: oy, visible: true };
    for (const m of sel) { const pl = s[m.id]; if (pl) { pl.x = (pl.x || 0) - ox; pl.y = (pl.y || 0) - oy; } }
  }
  const firstIdx = scene.parts.findIndex((p) => idset.has(p.id));
  scene.parts.splice(firstIdx, 0, { id: gid, type: 'Group', parent, desc: '' });
  for (const m of sel) m.parent = gid;
  scene.parts = normalize(scene);
  return gid;
}

// Move a part to a new parent (null = scene root), preserving its absolute
// position in every profile (§8.3.1). `anchorId` (optional) places the moved
// part right after that sibling in draw order; otherwise it goes last among its
// new siblings. Rejects cycles and non-Group containers. Returns true on change.
export function reparentPart(project, sceneId, id, newParent, anchorId) {
  newParent = newParent || null;
  if (newParent === id) return false;
  const scene = sceneById(project, sceneId);
  const part = scene.parts.find((p) => p.id === id);
  if (!part) return false;
  const sub = new Set(subtreeIds(scene, id));
  if (newParent && sub.has(newParent)) return false;           // no cycles
  if (newParent) {
    const np = scene.parts.find((p) => p.id === newParent);
    if (!np || np.type !== 'Group') return false;              // only Group contains
  }
  // Recompute local coords so the absolute position is unchanged, per profile.
  for (const pr of project.profiles) {
    const s = pr.layout[sceneId];
    if (!s) continue;
    const pl = s[id];
    if (!pl) continue;
    const o = absOrigin(pr, sceneId, scene, part);             // ancestors of part
    const childAbsX = o.x + (pl.x || 0), childAbsY = o.y + (pl.y || 0);
    let baseX = 0, baseY = 0;
    if (newParent) {
      const np = scene.parts.find((p) => p.id === newParent);
      const npo = absOrigin(pr, sceneId, scene, np);
      const npl = s[newParent] || { x: 0, y: 0 };
      baseX = npo.x + (npl.x || 0); baseY = npo.y + (npl.y || 0);
    }
    pl.x = childAbsX - baseX; pl.y = childAbsY - baseY;
  }
  part.parent = newParent;
  // Reposition in the flat array; the subtree follows via normalize().
  scene.parts = scene.parts.filter((p) => p.id !== id);
  if (anchorId && anchorId !== id) {
    const idx = scene.parts.findIndex((p) => p.id === anchorId);
    if (idx >= 0) scene.parts.splice(idx + 1, 0, part); else scene.parts.push(part);
  } else {
    scene.parts.push(part);
  }
  scene.parts = normalize(scene);
  return true;
}

// Dissolve a Group: promote children to the group's parent, preserving absolute
// position in every profile, then delete the group (§8.3.1).
export function ungroupPart(project, sceneId, groupId) {
  const scene = sceneById(project, sceneId);
  const g = scene.parts.find((p) => p.id === groupId);
  if (!g || g.type !== 'Group') return;
  const newParent = g.parent || null;
  const kids = scene.parts.filter((p) => p.parent === groupId);
  for (const pr of project.profiles) {
    const s = pr.layout[sceneId];
    if (!s) continue;
    const go = s[groupId] || { x: 0, y: 0 };
    for (const k of kids) { const pl = s[k.id]; if (pl) { pl.x = (pl.x || 0) + (go.x || 0); pl.y = (pl.y || 0) + (go.y || 0); } }
    delete s[groupId];
  }
  for (const k of kids) k.parent = newParent;
  scene.parts = normalize({ parts: scene.parts.filter((p) => p.id !== groupId) });
}

// Rename a part within a scene (updates parent refs and every profile's layout
// key). No-op (returns oldId) on empty/duplicate/invalid id.
export function renamePart(project, sceneId, oldId, newId) {
  newId = (newId || '').trim();
  if (!newId || newId === oldId || !isValidId(newId)) return oldId;
  const scene = sceneById(project, sceneId);
  if (scene.parts.some((p) => p.id === newId)) return oldId;
  for (const p of scene.parts) {
    if (p.id === oldId) p.id = newId;
    if (p.parent === oldId) p.parent = newId;
  }
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

// Base font height (px) used to convert a text-size multiplier to a px hint (§8.7).
export const BASE_FONT_PX = 8;
export const pxOf = (size) => Math.round(size * BASE_FONT_PX);
