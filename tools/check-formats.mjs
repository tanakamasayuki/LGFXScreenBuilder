#!/usr/bin/env node
// Project-file format integrity check (SPEC §9.2, Layer 3 "bump completeness").
//
// Verifies every committed *.lgfxsb.json is in canonical serializer form:
//     serialize(load(file)) === file
// A diff means the project-file representation moved — either load/serialize
// changed (the format shifted) or the file was hand-edited away from canonical
// form. Output-logic (codegen) changes do NOT touch load/serialize, so they do
// not trigger this (that is the point: this isolates the project-file format
// from the generated output).
//
//   node tools/check-formats.mjs --check   # exit 1 if any file is non-canonical
//   node tools/check-formats.mjs --write   # re-serialize (normalize) in place
//
// Not yet covered (see SPEC §9.2): strict "formatVersion not bumped" enforcement
// (needs formatVersion stamped into files) and the backward-compat render
// goldens (frozen at the first real format change). This guards canonical-form
// drift today and is the scaffold for those.

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import { serialize, isProject } from '../docs/src/persist.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKIP_DIRS = new Set(['node_modules', '.git', 'build']);

function findProjectFiles(dir) {
  const out = [];
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    if (ent.isDirectory()) {
      if (SKIP_DIRS.has(ent.name)) continue;
      out.push(...findProjectFiles(join(dir, ent.name)));
    } else if (ent.name.endsWith('.lgfxsb.json')) {
      out.push(join(dir, ent.name));
    }
  }
  return out;
}

const mode = process.argv.includes('--check') ? 'check'
  : process.argv.includes('--write') ? 'write' : null;
if (!mode) {
  console.error('usage: node tools/check-formats.mjs --check | --write');
  process.exit(2);
}

const files = findProjectFiles(root).sort();
const bad = [];
for (const path of files) {
  const rel = relative(root, path);
  const raw = readFileSync(path, 'utf8');
  let next;
  try {
    const obj = JSON.parse(raw);
    if (!isProject(obj)) { console.error(`SKIP (not a project): ${rel}`); continue; }
    next = serialize(obj) + '\n'; // canonical on-disk form: pretty JSON + trailing newline
  } catch (e) {
    console.error(`INVALID JSON: ${rel} — ${e.message}`);
    bad.push(rel);
    continue;
  }
  if (raw === next) continue;
  if (mode === 'write') {
    writeFileSync(path, next);
    console.log(`normalized: ${rel}`);
  } else {
    bad.push(rel);
    const a = raw.split('\n'), b = next.split('\n');
    let i = 0;
    while (i < Math.max(a.length, b.length) && a[i] === b[i]) i++;
    console.error(`NON-CANONICAL: ${rel} (first diff @ line ${i + 1})`);
    console.error(`  committed:  ${JSON.stringify(a[i])}`);
    console.error(`  canonical:  ${JSON.stringify(b[i])}`);
  }
}

if (mode === 'check') {
  if (bad.length) {
    console.error(`\n${bad.length} project file(s) not in canonical form — run: node tools/check-formats.mjs --write`);
    process.exit(1);
  }
  console.log(`all ${files.length} project file(s) canonical.`);
} else {
  console.log('done.');
}
