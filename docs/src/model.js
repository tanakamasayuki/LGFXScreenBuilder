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
      id: 'Core', w: 320, h: 240, rotation: 1, boards: ['M5Stack', 'Core2', 'CoreS3'],
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
      id: 'Cardputer', w: 240, h: 135, rotation: 1, boards: ['Cardputer', 'DinMeter'],
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
  };
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
  if (type === 'Text') return text(cx, cy, 'MC', 1.5, '#ffffff', 'Text');
  const w = Math.min(80, profile.w - 8), h = Math.min(48, profile.h - 8);
  const x = cx - (w >> 1), y = cy - (h >> 1);
  if (type === 'Image') return { x, y, w, h, visible: true };
  return rect(x, y, w, h, '#1e2a30'); // Rect
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

// Remove a part from a scene and from every profile's layout. Orphaned children
// (of a deleted group) are re-parented to root.
export function removePart(project, sceneId, partId) {
  const scene = sceneById(project, sceneId);
  scene.parts = scene.parts.filter((p) => p.id !== partId);
  for (const p of scene.parts) if (p.parent === partId) p.parent = null;
  for (const pr of project.profiles) {
    const s = pr.layout[sceneId];
    if (s) delete s[partId];
  }
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
