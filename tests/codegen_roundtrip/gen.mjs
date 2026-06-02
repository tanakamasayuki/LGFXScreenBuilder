// Generate MyScreen.h for the round-trip test from the authoring tool's own
// codegen, so this test verifies tool -> header -> on-device render.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { sampleProject } from '../../docs/src/model.js';
import { generateHeader } from '../../docs/src/codegen.js';

const dir = dirname(fileURLToPath(import.meta.url));
writeFileSync(join(dir, 'MyScreen.h'), generateHeader(sampleProject()));
console.log('generated MyScreen.h');
