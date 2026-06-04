// Board reference data for profile assignment (§8.9.2/§8.9.5). Board ids use the
// M5GFX board_t vocabulary; resolutions are the panel's natural orientation.
export const BOARDS = [
  { id: 'M5Stack', w: 320, h: 240 }, { id: 'Core2', w: 320, h: 240 }, { id: 'CoreS3', w: 320, h: 240 },
  { id: 'Tough', w: 320, h: 240 }, { id: 'Station', w: 320, h: 240 },
  { id: 'StickCPlus', w: 135, h: 240 }, { id: 'StickCPlus2', w: 135, h: 240 }, { id: 'StickC', w: 80, h: 160 },
  { id: 'Cardputer', w: 240, h: 135 }, { id: 'DinMeter', w: 240, h: 135 },
  { id: 'Dial', w: 240, h: 240 }, { id: 'AtomS3', w: 128, h: 128 },
  { id: 'CoreInk', w: 200, h: 200 }, { id: 'Paper', w: 540, h: 960 },
  // Newer M5GFX board_t entries (resolutions from M5GFX 0.2.22 panel setup, in the
  // device's used orientation to match the convention above). All M5GFX/M5Unified-
  // only (not in LGFX_KNOWN). CoreMP135 is not in the ESP32 autodetect path — 320×240
  // assumed; verify against hardware.
  { id: 'CoreS3SE', w: 320, h: 240 }, { id: 'StackChan', w: 320, h: 240 }, { id: 'CoreMP135', w: 320, h: 240 },
  { id: 'StickS3', w: 135, h: 240 }, { id: 'StampPLC', w: 135, h: 240 }, { id: 'NessoN1', w: 135, h: 240 },
  { id: 'CardputerADV', w: 240, h: 135 }, { id: 'AtomS3R', w: 128, h: 128 }, { id: 'VAMeter', w: 240, h: 240 },
  { id: 'AirQ', w: 200, h: 200 }, { id: 'PaperS3', w: 540, h: 960 }, { id: 'PaperColor', w: 400, h: 600 },
  { id: 'PaperMono', w: 480, h: 800 }, { id: 'StopWatch', w: 468, h: 468 },
  { id: 'Tab5', w: 1280, h: 720 }, { id: 'UnitC6L', w: 64, h: 48 },
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
  CoreS3SE: 'board_M5StackCoreS3SE', StackChan: 'board_M5StackChan', CoreMP135: 'board_M5CoreMP135',
  StickS3: 'board_M5StickS3', StampPLC: 'board_M5StampPLC', NessoN1: 'board_ArduinoNessoN1',
  CardputerADV: 'board_M5CardputerADV', AtomS3R: 'board_M5AtomS3R', VAMeter: 'board_M5VAMeter',
  AirQ: 'board_M5AirQ', PaperS3: 'board_M5PaperS3', PaperColor: 'board_M5PaperColor',
  PaperMono: 'board_M5PaperMono', StopWatch: 'board_M5StopWatch',
  Tab5: 'board_M5Tab5', UnitC6L: 'board_M5UnitC6L',
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

// Common panel sizes that aren't tied to a board in the catalog. Design rule:
// behavior is driven by SIZE alone, so these need no board_t — you only pick a
// board when same-size devices need different treatment (and that path is M5-only).
// Famous sizes are offered as presets without a board (e.g. small I2C OLEDs).
export const EXTRA_RESOLUTIONS = [
  { w: 128, h: 64, note: 'OLED' },      // SSD1306/SH1107 — M5 Unit OLED / GLASS / GLASS2
  { w: 72, h: 40, note: 'Mini OLED' },  // M5 Unit MiniOLED
];

// Distinct resolutions (for the "add profile" menu), each with its boards. Board-
// derived sizes come first (with their board ids); board-less common sizes
// (EXTRA_RESOLUTIONS) are appended, skipping any a board already covers.
export function commonResolutions() {
  const map = new Map();
  for (const b of BOARDS) {
    const k = `${b.w}x${b.h}`;
    if (!map.has(k)) map.set(k, { w: b.w, h: b.h, boards: [] });
    map.get(k).boards.push(b.id);
  }
  for (const r of EXTRA_RESOLUTIONS) {
    const k = `${r.w}x${r.h}`;
    if (!map.has(k)) map.set(k, { w: r.w, h: r.h, boards: [], note: r.note });
  }
  return [...map.values()];
}
