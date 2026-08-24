#!/usr/bin/env node
// Structural smoke test for the project loaded initially and by the Demo button.

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PART_TYPES, dispDims, sampleProject } from '../docs/src/model.js';
import { generateHeader, generateSketch } from '../docs/src/codegen.js';

const project = sampleProject();
const sceneIds = new Set(project.scenes.map((scene) => scene.id));
const demonstratedTypes = new Set();

if (project.scenes.length < 8) throw new Error(`demo has only ${project.scenes.length} scenes`);
if (sceneIds.size !== project.scenes.length) throw new Error('demo scene IDs must be unique');

for (const scene of project.scenes) {
  const partIds = new Set(scene.parts.map((part) => part.id));
  if (partIds.size !== scene.parts.length) throw new Error(`${scene.id}: part IDs must be unique`);
  for (const part of scene.parts) demonstratedTypes.add(part.type);

  for (const profile of project.profiles) {
    const placements = profile.layout[scene.id];
    if (!placements) throw new Error(`${profile.id}: missing ${scene.id} layout`);
    const placementIds = Object.keys(placements);
    if (placementIds.length !== partIds.size || placementIds.some((id) => !partIds.has(id))) {
      throw new Error(`${profile.id}/${scene.id}: layout does not match its parts`);
    }

    const { w, h } = dispDims(profile);
    for (const part of scene.parts) {
      const p = placements[part.id];
      const points = part.type === 'Line'
        ? [[p.x, p.y], [p.x2, p.y2]]
        : part.type === 'Circle'
          ? [[p.x - p.r, p.y - p.r], [p.x + p.r, p.y + p.r]]
          : part.type === 'Rect' || part.type === 'Image'
            ? [[p.x, p.y], [p.x + p.w, p.y + p.h]]
            : [[p.x, p.y]];
      if (points.some(([x, y]) => x < 0 || y < 0 || x > w || y > h)) {
        throw new Error(`${profile.id}/${scene.id}/${part.id}: placement is outside ${w}x${h}`);
      }
    }
  }
}

for (const type of PART_TYPES.filter((type) => type !== 'Image')) {
  if (!demonstratedTypes.has(type)) throw new Error(`demo does not demonstrate ${type}`);
}

const header = generateHeader(project);
const sketch = generateSketch(project, project.targetLibrary);
for (const scene of project.scenes) {
  if (!header.includes(`struct ${scene.id} {`)) throw new Error(`${scene.id}: missing from generated header`);
}
if (!header.includes(`kSceneInfoCount = ${project.scenes.length}`)
    || !sketch.includes('kSceneCount = detail::kSceneInfoCount')) {
  throw new Error('generated example does not tour every demo scene');
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const favicon = await readFile(join(root, 'docs', 'favicon.svg'), 'utf8');
if (!favicon.includes('<svg')) throw new Error('favicon.svg is not an SVG');
for (const page of ['index.html', 'fontgen.html']) {
  const html = await readFile(join(root, 'docs', page), 'utf8');
  if (!html.includes('rel="icon" href="./favicon.svg"')) {
    throw new Error(`${page}: favicon is not linked`);
  }
}

console.log(`Sample project OK: ${project.scenes.length} scenes, ${project.profiles.length} profiles, favicon linked.`);
