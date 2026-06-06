// Generate MyScreen.h for the round-trip test from the authoring tool's own
// codegen, so this test verifies tool -> header -> on-device render.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { sampleProject, addAsset, addPart, adoptFont, placement } from '../../docs/src/model.js';
import { generateHeader } from '../../docs/src/codegen.js';

const dir = dirname(fileURLToPath(import.meta.url));
const project = sampleProject();
// The host backend is LovyanGFX (LGFX_AUTODETECT), so target LovyanGFX for the
// generated example sketch include/init path.
project.targetLibrary = 'LovyanGFX';
// Exercise the rounded outline Rect path.
for (const pr of project.profiles) {
  const pl = placement(pr, 'Main', 'panel');
  if (pl) { pl.r = 8; pl.fill = false; }
}

// Exercise the asset/pushImage path: a synthetic 4x4 RGB565 checker bound to a
// new Image part on the Boot scene.
const W = 4, H = 4, rgb565 = [];
for (let i = 0; i < W * H; i++) rgb565.push(((i + (i / W | 0)) % 2) ? 0xF800 : 0x07E0); // red/green
const aid = addAsset(project, { name: 'tile', w: W, h: H, rgb565 });
const imgId = addPart(project, 'Boot', 'Image');
project.scenes.find((s) => s.id === 'Boot').parts.find((p) => p.id === imgId).asset = aid;

// Exercise the preset-font path (§8.7.5): adopt a font (enabled on every profile)
// and reference it from Main.title, so codegen emits &lgfx::v1::fonts::FreeSans12pt7b
// and the runtime setFont()s it before drawing — verified by the rendered PNG.
adoptFont(project, 'FreeSans12pt7b');
for (const pr of project.profiles) {
  const pl = placement(pr, 'Main', 'title');
  if (pl) pl.font = 'FreeSans12pt7b';
}

writeFileSync(join(dir, 'MyScreen.h'), generateHeader(project));
console.log('generated MyScreen.h (rounded Rect, RGB565 asset, preset font)');
