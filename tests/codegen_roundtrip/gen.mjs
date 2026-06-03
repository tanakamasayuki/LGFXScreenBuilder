// Generate MyScreen.h for the round-trip test from the authoring tool's own
// codegen, so this test verifies tool -> header -> on-device render.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { sampleProject, groupParts } from '../../docs/src/model.js';
import { generateHeader } from '../../docs/src/codegen.js';

const dir = dirname(fileURLToPath(import.meta.url));
const project = sampleProject();
// The host backend is LovyanGFX (LGFX_AUTODETECT), so target LovyanGFX: codegen
// then emits only board_t names that exist in LovyanGFX (Cardputer/DinMeter are
// dropped), keeping the generated board tables compilable here.
project.targetLibrary = 'LovyanGFX';
// Exercise the Group codegen path (nested struct + access path s.group.title):
// wrap the Main header texts in a group so the round-trip compiles and renders
// grouped, position-preserved layout on a real backend.
groupParts(project, 'Main', ['title', 'battery']);
writeFileSync(join(dir, 'MyScreen.h'), generateHeader(project));
console.log('generated MyScreen.h (Group in Main, LovyanGFX board tables)');
