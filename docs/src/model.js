// Project data model for the authoring tool.
//
// Shape (rich editor form; serialized to .lgfxsb.json, §9):
//   project = {
//     name, targetLibrary, background ('#rrggbb'), transparentColor ('#rrggbb'),
//     profiles: [{ id, w, h, rotation, layout }],
//       layout: { [sceneId]: { [partId]: placement } }   // per profile, per scene, per part
//     scenes:   [{ id, desc, transparent, parts:[{ id, type, desc, asset }] }],
//   }
// Each profile holds a complete, independent layout per scene (no base/override; §8.9.6).
// The generated struct depends only on part id/type (§8.2); placement lives here.

export const PART_TYPES = ['Rect', 'Line', 'Circle', 'Text', 'Image'];

// Color key for transparent (overlay) scenes (§8.16). Default = LovyanGFX's
// TFT_TRANSPARENT (RGB565 0x0120) as #rrggbb, i.e. LGFXVirtualCanvas's own
// default, so a project that never touches the setting needs no C++ side change.
export const DEFAULT_TRANSPARENT_COLOR = '#002400';
export const transparentColorOf = (project) =>
  (project && project.transparentColor) || DEFAULT_TRANSPARENT_COLOR;
// A scene drawn on top of whatever is already on the panel (dialogs etc.): no
// background fill, and the color key is masked out of the transfer.
export const isTransparentScene = (scene) => !!(scene && scene.transparent);
// Whether the project needs the transparent-scene fields in its generated header.
export const hasTransparentScene = (project) =>
  (project.scenes || []).some(isTransparentScene);

// RGB565 quantization: the panel (and therefore the color-key comparison) is
// 16-bit, so two distinct #rrggbb values can collide once drawn. Used by the
// export check that warns about a part painted in the key color (§8.16).
export function to565(css) {
  const v = parseInt(String(css || '#000000').replace('#', ''), 16) || 0;
  return (((v >> 16) & 0xF8) << 8) | (((v >> 8) & 0xFC) << 3) | ((v & 0xFF) >> 3);
}

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

// Placement factories. Rect/Image carry w/h; Line carries x2/y2; Circle carries r.
// Text carries datum/size (no box; §8.7).
const rect = (x, y, w, h, color, visible = true, r = 0, fill = true) => ({ x, y, w, h, r, fill, color, visible });
const line = (x, y, x2, y2, color, visible = true) => ({ x, y, x2, y2, color, visible });
const circle = (x, y, r, color, visible = true, fill = true) => ({ x, y, r, fill, color, visible });
const text = (x, y, datum, size, color, content, visible = true) =>
  ({ x, y, datum, size, color, text: content, visible });

// A varied sample project used by the Demo button and as the initial project.
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
    {
      id: 'Dialog', desc: '前の画面に重ねる確認ダイアログ（透過シーン）', transparent: true, parts: [
        { id: 'shadow', type: 'Rect', desc: '' },
        { id: 'box', type: 'Rect', desc: '' },
        { id: 'frame', type: 'Rect', desc: '' },
        { id: 'msg', type: 'Text', desc: '確認メッセージ' },
        { id: 'hint', type: 'Text', desc: '' },
      ],
    },
    {
      id: 'Clock', desc: '中央寄せテキストを使った時計画面', parts: [
        { id: 'clockPanel', type: 'Rect', desc: '' },
        { id: 'time', type: 'Text', desc: '現在時刻' },
        { id: 'date', type: 'Text', desc: '日付' },
        { id: 'alarm', type: 'Text', desc: 'アラーム時刻' },
      ],
    },
    {
      id: 'Sensors', desc: '円形ゲージと複数の計測値', parts: [
        { id: 'sensorTitle', type: 'Text', desc: '' },
        { id: 'gauge', type: 'Circle', desc: 'ゲージ外周' },
        { id: 'gaugeCore', type: 'Circle', desc: 'ゲージ中央' },
        { id: 'tempValue', type: 'Text', desc: '温度' },
        { id: 'humidity', type: 'Text', desc: '湿度' },
        { id: 'pressure', type: 'Text', desc: '気圧' },
      ],
    },
    {
      id: 'Network', desc: 'ネットワーク状態と電波強度', parts: [
        { id: 'networkHeader', type: 'Rect', desc: '' },
        { id: 'networkTitle', type: 'Text', desc: '' },
        { id: 'ssid', type: 'Text', desc: 'SSID' },
        { id: 'ip', type: 'Text', desc: 'IPアドレス' },
        { id: 'signal1', type: 'Rect', desc: '' },
        { id: 'signal2', type: 'Rect', desc: '' },
        { id: 'signal3', type: 'Rect', desc: '' },
        { id: 'signal4', type: 'Rect', desc: '' },
        { id: 'networkState', type: 'Text', desc: '接続状態' },
      ],
    },
    {
      id: 'Chart', desc: 'Line部品を組み合わせた折れ線グラフ', parts: [
        { id: 'chartTitle', type: 'Text', desc: '' },
        { id: 'axisX', type: 'Line', desc: '' },
        { id: 'axisY', type: 'Line', desc: '' },
        { id: 'trend1', type: 'Line', desc: '' },
        { id: 'trend2', type: 'Line', desc: '' },
        { id: 'trend3', type: 'Line', desc: '' },
        { id: 'trend4', type: 'Line', desc: '' },
        { id: 'trend5', type: 'Line', desc: '' },
        { id: 'current', type: 'Text', desc: '最新値' },
      ],
    },
  ];

  const profiles = [
    {
      id: 'Core', w: 320, h: 240, rotation: 0,
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
        Dialog: {
          shadow: rect(66, 76, 200, 100, '#000000', true, 10),
          box: rect(60, 70, 200, 100, '#1e2a30', true, 10),
          frame: rect(60, 70, 200, 100, '#9ce5ac', true, 10, false),
          msg: text(160, 105, 'MC', 2, '#ffffff', 'Delete?'),
          hint: text(160, 145, 'MC', 1.5, '#9ce5ac', 'A:OK  B:Cancel'),
        },
        Clock: {
          clockPanel: rect(28, 32, 264, 176, '#172126', true, 16),
          time: text(160, 90, 'MC', 5, '#ffffff', '12:34'),
          date: text(160, 145, 'MC', 2, '#9ce5ac', 'MON 24 AUG'),
          alarm: text(160, 180, 'MC', 1.5, '#6f8a92', 'ALARM 06:30'),
        },
        Sensors: {
          sensorTitle: text(16, 12, 'TL', 2, '#ffffff', 'Sensors'),
          gauge: circle(92, 126, 62, '#9ce5ac', true, false),
          gaugeCore: circle(92, 126, 48, '#172126'),
          tempValue: text(92, 126, 'MC', 3, '#ffffff', '24.5C'),
          humidity: text(180, 90, 'TL', 2, '#75c9ff', 'Humidity 60%'),
          pressure: text(180, 135, 'TL', 2, '#9ce5ac', '1013 hPa'),
        },
        Network: {
          networkHeader: rect(0, 0, 320, 38, '#1e2a30'),
          networkTitle: text(12, 9, 'TL', 2, '#ffffff', 'Network'),
          ssid: text(16, 62, 'TL', 2, '#ffffff', 'SSID: lab-net'),
          ip: text(16, 98, 'TL', 1.5, '#75c9ff', '192.168.1.42'),
          signal1: rect(230, 142, 10, 18, '#9ce5ac'),
          signal2: rect(246, 130, 10, 30, '#9ce5ac'),
          signal3: rect(262, 116, 10, 44, '#9ce5ac'),
          signal4: rect(278, 100, 10, 60, '#26383d'),
          networkState: text(16, 165, 'TL', 2, '#9ce5ac', 'Connected'),
        },
        Chart: {
          chartTitle: text(14, 10, 'TL', 2, '#ffffff', 'Temperature / 24h'),
          axisX: line(38, 195, 296, 195, '#6f8a92'),
          axisY: line(38, 50, 38, 195, '#6f8a92'),
          trend1: line(40, 160, 85, 145, '#9ce5ac'),
          trend2: line(85, 145, 130, 155, '#9ce5ac'),
          trend3: line(130, 155, 180, 100, '#9ce5ac'),
          trend4: line(180, 100, 230, 120, '#9ce5ac'),
          trend5: line(230, 120, 292, 72, '#9ce5ac'),
          current: text(292, 55, 'TR', 2, '#9ce5ac', '24.5C'),
        },
      },
    },
    {
      id: 'Stick', w: 135, h: 240, rotation: 0,
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
        Dialog: {
          shadow: rect(14, 84, 115, 80, '#000000', true, 8),
          box: rect(10, 80, 115, 80, '#1e2a30', true, 8),
          frame: rect(10, 80, 115, 80, '#9ce5ac', true, 8, false),
          msg: text(67, 105, 'MC', 1.5, '#ffffff', 'Delete?'),
          hint: text(67, 140, 'MC', 1, '#9ce5ac', 'A:OK B:No'),
        },
        Clock: {
          clockPanel: rect(7, 40, 121, 150, '#172126', true, 12),
          time: text(67, 92, 'MC', 3, '#ffffff', '12:34'),
          date: text(67, 132, 'MC', 1.25, '#9ce5ac', 'MON 24 AUG'),
          alarm: text(67, 165, 'MC', 1, '#6f8a92', 'ALARM 06:30'),
        },
        Sensors: {
          sensorTitle: text(8, 8, 'TL', 1.5, '#ffffff', 'Sensors'),
          gauge: circle(67, 88, 42, '#9ce5ac', true, false),
          gaugeCore: circle(67, 88, 33, '#172126'),
          tempValue: text(67, 88, 'MC', 2.25, '#ffffff', '24.5'),
          humidity: text(8, 150, 'TL', 1.25, '#75c9ff', 'Humidity 60%'),
          pressure: text(8, 180, 'TL', 1.25, '#9ce5ac', '1013 hPa'),
        },
        Network: {
          networkHeader: rect(0, 0, 135, 30, '#1e2a30'),
          networkTitle: text(8, 7, 'TL', 1.5, '#ffffff', 'Network'),
          ssid: text(8, 48, 'TL', 1.25, '#ffffff', 'lab-net'),
          ip: text(8, 78, 'TL', 1, '#75c9ff', '192.168.1.42'),
          signal1: rect(75, 134, 8, 14, '#9ce5ac'),
          signal2: rect(87, 124, 8, 24, '#9ce5ac'),
          signal3: rect(99, 112, 8, 36, '#9ce5ac'),
          signal4: rect(111, 98, 8, 50, '#26383d'),
          networkState: text(8, 180, 'TL', 1.5, '#9ce5ac', 'Connected'),
        },
        Chart: {
          chartTitle: text(8, 8, 'TL', 1.25, '#ffffff', 'Temperature'),
          axisX: line(18, 210, 125, 210, '#6f8a92'),
          axisY: line(18, 42, 18, 210, '#6f8a92'),
          trend1: line(20, 170, 40, 155, '#9ce5ac'),
          trend2: line(40, 155, 60, 165, '#9ce5ac'),
          trend3: line(60, 165, 80, 105, '#9ce5ac'),
          trend4: line(80, 105, 100, 125, '#9ce5ac'),
          trend5: line(100, 125, 122, 70, '#9ce5ac'),
          current: text(125, 45, 'TR', 1.25, '#9ce5ac', '24.5'),
        },
      },
    },
    {
      id: 'Cardputer', w: 240, h: 135, rotation: 0,
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
        Dialog: {
          shadow: rect(44, 34, 160, 75, '#000000', true, 8),
          box: rect(40, 30, 160, 75, '#1e2a30', true, 8),
          frame: rect(40, 30, 160, 75, '#9ce5ac', true, 8, false),
          msg: text(120, 55, 'MC', 1.5, '#ffffff', 'Delete?'),
          hint: text(120, 88, 'MC', 1, '#9ce5ac', 'A:OK  B:Cancel'),
        },
        Clock: {
          clockPanel: rect(20, 18, 200, 100, '#172126', true, 12),
          time: text(120, 52, 'MC', 3, '#ffffff', '12:34'),
          date: text(120, 84, 'MC', 1.25, '#9ce5ac', 'MON 24 AUG'),
          alarm: text(120, 105, 'MC', 1, '#6f8a92', 'ALARM 06:30'),
        },
        Sensors: {
          sensorTitle: text(8, 5, 'TL', 1.5, '#ffffff', 'Sensors'),
          gauge: circle(62, 75, 42, '#9ce5ac', true, false),
          gaugeCore: circle(62, 75, 33, '#172126'),
          tempValue: text(62, 75, 'MC', 2.25, '#ffffff', '24.5'),
          humidity: text(118, 48, 'TL', 1.25, '#75c9ff', 'Humidity 60%'),
          pressure: text(118, 78, 'TL', 1.25, '#9ce5ac', '1013 hPa'),
        },
        Network: {
          networkHeader: rect(0, 0, 240, 26, '#1e2a30'),
          networkTitle: text(8, 5, 'TL', 1.5, '#ffffff', 'Network'),
          ssid: text(8, 40, 'TL', 1.25, '#ffffff', 'SSID: lab-net'),
          ip: text(8, 64, 'TL', 1.1, '#75c9ff', '192.168.1.42'),
          signal1: rect(175, 82, 8, 12, '#9ce5ac'),
          signal2: rect(188, 74, 8, 20, '#9ce5ac'),
          signal3: rect(201, 64, 8, 30, '#9ce5ac'),
          signal4: rect(214, 52, 8, 42, '#26383d'),
          networkState: text(8, 104, 'TL', 1.25, '#9ce5ac', 'Connected'),
        },
        Chart: {
          chartTitle: text(8, 5, 'TL', 1.25, '#ffffff', 'Temperature / 24h'),
          axisX: line(22, 118, 228, 118, '#6f8a92'),
          axisY: line(22, 30, 22, 118, '#6f8a92'),
          trend1: line(24, 95, 62, 82, '#9ce5ac'),
          trend2: line(62, 82, 100, 92, '#9ce5ac'),
          trend3: line(100, 92, 138, 55, '#9ce5ac'),
          trend4: line(138, 55, 176, 70, '#9ce5ac'),
          trend5: line(176, 70, 224, 38, '#9ce5ac'),
          current: text(228, 20, 'TR', 1.25, '#9ce5ac', '24.5C'),
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
export function newProject({ name, targetLibrary, profileId, w, h, rotation, sceneName }) {
  const profile = { id: profileId, w, h, rotation, fonts: [], layout: { [sceneName]: {} } };
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
// project.fonts holds two kinds of entry, both keyed by `name`:
//   { name }                 a preset font, referenced as `fonts::<name>`
//   { name, custom: recipe } a generated font (§8.7.7), emitted into the header
// A custom entry stores only the RECIPE (typeface / size / characters); the
// glyph bytes are rebuilt at export time and never enter the project file.
// profile.fonts = names enabled for that profile (per-profile usage flag, §8.7.4).
export const isFontAdopted = (project, name) => (project.fonts || []).some((f) => f.name === name);
export const fontEntry = (project, name) => (project.fonts || []).find((f) => f.name === name) || null;
export const isCustomFont = (project, name) => !!fontEntry(project, name)?.custom;
export const customFontNames = (project) =>
  (project.fonts || []).filter((f) => f.custom).map((f) => f.name);
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

// Adopt (or update) a generated custom font. `recipe` is the font-generator
// input, not glyph data — see docs/src/fontgen/build.js.
export function adoptCustomFont(project, name, recipe) {
  if (!project.fonts) project.fonts = [];
  const existing = project.fonts.find((f) => f.name === name);
  if (existing) existing.custom = recipe;
  else project.fonts.push({ name, custom: recipe });
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
  project.profiles.push({ id, w, h, rotation: rotation == null ? 0 : rotation, layout });
  return id;
}

// Remove a profile (never the last one).
export function removeProfile(project, id) {
  if (project.profiles.length <= 1) return false;
  project.profiles = project.profiles.filter((p) => p.id !== id);
  return true;
}

export function moveProfile(project, id, dir) {
  const i = project.profiles.findIndex((p) => p.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= project.profiles.length) return false;
  [project.profiles[i], project.profiles[j]] = [project.profiles[j], project.profiles[i]];
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
  if (type === 'Line') return line(x, y, x + w, y, '#ffffff');
  if (type === 'Circle') return circle(cx, cy, Math.max(4, Math.min(w, h) >> 1), '#1e2a30');
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

// Reorder a scene among its siblings (dir = -1 up / +1 down). Scene order is the
// display order and the generated SceneId enum order. No-op at the boundaries.
export function moveScene(project, sceneId, dir) {
  const i = project.scenes.findIndex((s) => s.id === sceneId), j = i + dir;
  if (i < 0 || j < 0 || j >= project.scenes.length) return false;
  [project.scenes[i], project.scenes[j]] = [project.scenes[j], project.scenes[i]];
  return true;
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
  if (type === 'Line') return {
    x, y,
    x2: toInt(p.x2, x + 40),
    y2: toInt(p.y2, y),
    color: toColor(p.color, '#ffffff'),
    visible,
  };
  if (type === 'Circle') return {
    x, y,
    r: Math.max(1, toInt(p.r, 12)),
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

  return {
    errors, warnings, sceneId, exists: !!existingScene,
    mode: existingScene ? 'update' : 'add',
    transparent: obj.transparent === true, // scene-level flag (§8.16); absent = opaque
    partDefs, layouts, partCount: partDefs.length,
  };
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
  // Transparent is a property of the scene, so it round-trips like desc: the flag
  // is only stored when set, keeping opaque scenes out of the file (§8.16).
  if (r.transparent) scene.transparent = true;
  else delete scene.transparent;
  for (const pr of project.profiles) pr.layout[r.sceneId] = r.layouts[pr.id];
  return { ok: true, sceneId: r.sceneId, mode: r.mode, warnings: r.warnings };
}

// Base font height (px) used to convert a text-size multiplier to a px hint (§8.7).
export const BASE_FONT_PX = 8;
export const pxOf = (size) => Math.round(size * BASE_FONT_PX);
