// Generate MyScreen.h for the round-trip test from the authoring tool's own
// codegen, so this test verifies tool -> header -> on-device render.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { sampleProject, groupParts } from '../../docs/src/model.js';
import { generateHeader } from '../../docs/src/codegen.js';

const dir = dirname(fileURLToPath(import.meta.url));
const project = sampleProject();
// Exercise the Group codegen path (nested struct + access path s.group.title):
// wrap the Main header texts in a group so the round-trip compiles and renders
// grouped, position-preserved layout on a real backend.
groupParts(project, 'Main', ['title', 'battery']);
writeFileSync(join(dir, 'MyScreen.h'), generateHeader(project));
console.log('generated MyScreen.h (with a Group in Main)');
