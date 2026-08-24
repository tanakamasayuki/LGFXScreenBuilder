#!/usr/bin/env node
// Structural smoke test for the project loaded initially and by the Demo button.

import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { DATUM_FX, DATUM_FY, PART_TYPES, dispDims, sampleProject } from '../docs/src/model.js';
import { generateHeader, generateSketch } from '../docs/src/codegen.js';
import { FONT_CATALOG } from '../docs/src/font-catalog.js';

const requireFromDocs = createRequire(new URL('../docs/package.json', import.meta.url));
const fontToolUrl = pathToFileURL(requireFromDocs.resolve('lgfx-font-tool')).href;
const { loadFont, measureText } = await import(fontToolUrl);

const project = sampleProject();
const sceneIds = new Set(project.scenes.map((scene) => scene.id));
const demonstratedTypes = new Set();
const adoptedFonts = new Set(project.fonts.map((font) => font.name));
const catalogFonts = new Set(FONT_CATALOG.map((font) => font.name));
let textCount = 0;
let unitSizeCount = 0;

if (project.scenes.length < 8) throw new Error(`demo has only ${project.scenes.length} scenes`);
if (sceneIds.size !== project.scenes.length) throw new Error('demo scene IDs must be unique');
if (adoptedFonts.size < 12) throw new Error(`demo adopts only ${adoptedFonts.size} fonts`);
for (const font of adoptedFonts) {
  if (!catalogFonts.has(font)) throw new Error(`demo adopts unknown preset font ${font}`);
}

for (const scene of project.scenes) {
  const partIds = new Set(scene.parts.map((part) => part.id));
  if (partIds.size !== scene.parts.length) throw new Error(`${scene.id}: part IDs must be unique`);
  for (const part of scene.parts) demonstratedTypes.add(part.type);

  for (const profile of project.profiles) {
    const enabledFonts = new Set(profile.fonts || []);
    for (const font of adoptedFonts) {
      if (!enabledFonts.has(font)) throw new Error(`${profile.id}: ${font} is not enabled`);
    }
    const placements = profile.layout[scene.id];
    if (!placements) throw new Error(`${profile.id}: missing ${scene.id} layout`);
    const placementIds = Object.keys(placements);
    if (placementIds.length !== partIds.size || placementIds.some((id) => !partIds.has(id))) {
      throw new Error(`${profile.id}/${scene.id}: layout does not match its parts`);
    }

    const { w, h } = dispDims(profile);
    for (const part of scene.parts) {
      const p = placements[part.id];
      if (part.type === 'Text' && p.font && !enabledFonts.has(p.font)) {
        throw new Error(`${profile.id}/${scene.id}/${part.id}: ${p.font} is not enabled`);
      }
      if (part.type === 'Text') {
        textCount++;
        if (p.size < 1) throw new Error(`${profile.id}/${scene.id}/${part.id}: font size is below 1x`);
        if (p.size === 1) unitSizeCount++;
      }
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
    const usedHere = new Set(scene.parts
      .filter((part) => part.type === 'Text')
      .map((part) => placements[part.id].font)
      .filter(Boolean));
    if (usedHere.size < 2) throw new Error(`${profile.id}/${scene.id}: uses fewer than two fonts`);
  }
}
if (unitSizeCount / textCount < 0.9) {
  throw new Error(`only ${unitSizeCount}/${textCount} demo texts use the basic 1x size`);
}

// Anchor-only checks miss the failure users actually see: a preset font has
// its own native dimensions, so its rendered pixels can overflow or collide
// even while x/y remain inside the display. Measure with LGFXFontToolJs—the
// same renderer model used by the editor—and check the final text rectangles.
for (const profile of project.profiles) {
  const { w, h } = dispDims(profile);
  for (const scene of project.scenes) {
    const boxes = [];
    for (const part of scene.parts.filter((part) => part.type === 'Text')) {
      const p = profile.layout[scene.id][part.id];
      const font = await loadFont(p.font || 'Font0');
      const measured = measureText(font, p.text, { sizeX: p.size, sizeY: p.size, datum: 'top-left' });
      const box = {
        id: part.id,
        x: p.x - (DATUM_FX[p.datum[1]] || 0) * measured.width,
        y: p.y - (DATUM_FY[p.datum[0]] || 0) * measured.height,
        w: measured.width,
        h: measured.height,
      };
      if (box.x < 0 || box.y < 0 || box.x + box.w > w || box.y + box.h > h) {
        throw new Error(`${profile.id}/${scene.id}/${part.id}: rendered text is outside ${w}x${h}`);
      }
      boxes.push(box);
    }
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i], b = boxes[j];
        if (a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y) {
          throw new Error(`${profile.id}/${scene.id}: rendered text ${a.id} overlaps ${b.id}`);
        }
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
for (const font of adoptedFonts) {
  if (!header.includes(`&lgfx::v1::fonts::${font}`)) throw new Error(`${font}: missing from generated header`);
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

console.log(`Sample project OK: ${project.scenes.length} scenes, ${project.profiles.length} profiles, ${adoptedFonts.size} fonts, favicon linked.`);
