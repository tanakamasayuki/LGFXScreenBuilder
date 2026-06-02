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

// 9-point datum, ordering matches lgfxsb::Datum / LovyanGFX textdatum_t.
export const DATUMS = [
  ['TL', '左上'], ['TC', '上中'], ['TR', '右上'],
  ['ML', '左中'], ['MC', '中央'], ['MR', '右中'],
  ['BL', '左下'], ['BC', '下中'], ['BR', '右下'],
];
export const DATUM_FX = { L: 0, C: 0.5, R: 1 };
export const DATUM_FY = { T: 0, M: 0.5, B: 1 };

export const orient = (w, h) => (w > h ? '横' : h > w ? '縦' : '正方');

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

// Base font height (px) used to convert a text-size multiplier to a px hint (§8.7).
export const BASE_FONT_PX = 8;
export const pxOf = (size) => Math.round(size * BASE_FONT_PX);
