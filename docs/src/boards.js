// Board reference data for profile-size selection (§8.9). Board ids are labels
// only; they are not saved to profiles and are not emitted to generated code.
export const BOARDS = [
  { id: 'M5Stack', w: 320, h: 240 }, { id: 'Core2', w: 320, h: 240 }, { id: 'CoreS3', w: 320, h: 240 },
  { id: 'Tough', w: 320, h: 240 }, { id: 'Station', w: 320, h: 240 },
  { id: 'StickCPlus', w: 135, h: 240 }, { id: 'StickCPlus2', w: 135, h: 240 }, { id: 'StickC', w: 80, h: 160 },
  { id: 'Cardputer', w: 240, h: 135 }, { id: 'DinMeter', w: 240, h: 135 },
  { id: 'Dial', w: 240, h: 240 }, { id: 'AtomS3', w: 128, h: 128 },
  { id: 'CoreInk', w: 200, h: 200 }, { id: 'Paper', w: 540, h: 960 },
  // Newer M5 devices. Sizes are reference values for choosing profiles.
  { id: 'CoreS3SE', w: 320, h: 240 }, { id: 'StackChan', w: 320, h: 240 }, { id: 'CoreMP135', w: 320, h: 240 },
  { id: 'StickS3', w: 135, h: 240 }, { id: 'StampPLC', w: 135, h: 240 }, { id: 'NessoN1', w: 135, h: 240 },
  { id: 'CardputerADV', w: 240, h: 135 }, { id: 'AtomS3R', w: 128, h: 128 }, { id: 'VAMeter', w: 240, h: 240 },
  { id: 'AirQ', w: 200, h: 200 }, { id: 'PaperS3', w: 540, h: 960 }, { id: 'PaperColor', w: 400, h: 600 },
  { id: 'PaperMono', w: 480, h: 800 }, { id: 'StopWatch', w: 468, h: 468 },
  { id: 'Tab5', w: 1280, h: 720 }, { id: 'UnitC6L', w: 64, h: 48 },
];

export const TARGET_LIBS = ['M5Unified', 'M5GFX', 'LovyanGFX'];

export const boardCatalog = () => BOARDS;

// Common panel sizes that aren't tied to a board in the catalog.
export const EXTRA_RESOLUTIONS = [
  { w: 128, h: 64, note: 'OLED' },      // SSD1306/SH1107 — M5 Unit OLED / GLASS / GLASS2
  { w: 72, h: 40, note: 'Mini OLED' },  // M5 Unit MiniOLED
];

// Distinct resolutions (for the "add profile" menu), each with reference board
// labels. Board-less common sizes are appended, skipping any a board already covers.
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
