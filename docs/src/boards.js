// Board reference data for profile assignment (§8.9.2/§8.9.5). Board ids use the
// M5GFX board_t vocabulary; resolutions are the panel's natural orientation.
export const BOARDS = [
  { id: 'M5Stack', w: 320, h: 240 }, { id: 'Core2', w: 320, h: 240 }, { id: 'CoreS3', w: 320, h: 240 },
  { id: 'Tough', w: 320, h: 240 }, { id: 'Station', w: 320, h: 240 },
  { id: 'StickCPlus', w: 135, h: 240 }, { id: 'StickCPlus2', w: 135, h: 240 }, { id: 'StickC', w: 80, h: 160 },
  { id: 'Cardputer', w: 240, h: 135 }, { id: 'DinMeter', w: 240, h: 135 },
  { id: 'Dial', w: 240, h: 240 }, { id: 'AtomS3', w: 128, h: 128 },
  { id: 'CoreInk', w: 200, h: 200 }, { id: 'Paper', w: 540, h: 960 },
];

// Subset that plain LovyanGFX (autodetect) can identify via board_t. Newer M5
// boards (Cardputer, Dial, …) are not detectable there (§8.9.5).
export const LGFX_KNOWN = new Set([
  'M5Stack', 'Core2', 'CoreS3', 'Tough', 'Station', 'StickC', 'StickCPlus', 'StickCPlus2', 'AtomS3', 'CoreInk', 'Paper',
]);

export const TARGET_LIBS = ['M5Unified', 'M5GFX', 'LovyanGFX'];

// Our board ids -> lgfx::board_t enum names. Shared boards use the same name in
// LovyanGFX and M5GFX; the newer ones (Cardputer/Dial/DinMeter) exist only in
// M5GFX's board_t. boardEnum() returns null when a board can't compile on the
// target library, so codegen omits it (§8.9.5).
export const BOARD_T = {
  M5Stack: 'board_M5Stack', Core2: 'board_M5StackCore2', CoreS3: 'board_M5StackCoreS3',
  Tough: 'board_M5Tough', Station: 'board_M5Station',
  StickC: 'board_M5StickC', StickCPlus: 'board_M5StickCPlus', StickCPlus2: 'board_M5StickCPlus2',
  Cardputer: 'board_M5Cardputer', DinMeter: 'board_M5DinMeter', Dial: 'board_M5Dial',
  AtomS3: 'board_M5AtomS3', CoreInk: 'board_M5StackCoreInk', Paper: 'board_M5Paper',
};

export const boardById = (id) => BOARDS.find((b) => b.id === id);
// Orientation-independent dimension key (135x240 == 240x135).
export const dimKey = (w, h) => [Math.min(w, h), Math.max(w, h)].join('x');
// Can the target library auto-detect this board?
export const boardDetectable = (lib, id) => lib !== 'LovyanGFX' || LGFX_KNOWN.has(id);
// board_t name to emit for the target library, or null if not compilable there.
export const boardEnum = (lib, id) => (boardDetectable(lib, id) ? (BOARD_T[id] || null) : null);
// Boards offered as assignment candidates for the target library.
export const boardCatalog = (lib) => (lib === 'LovyanGFX' ? BOARDS.filter((b) => LGFX_KNOWN.has(b.id)) : BOARDS);

// Distinct resolutions (for the "add profile" menu), each with its boards.
export function commonResolutions() {
  const map = new Map();
  for (const b of BOARDS) {
    const k = `${b.w}x${b.h}`;
    if (!map.has(k)) map.set(k, { w: b.w, h: b.h, boards: [] });
    map.get(k).boards.push(b.id);
  }
  return [...map.values()];
}
