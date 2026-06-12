#!/usr/bin/env node
// Backward-compatibility golden check (SPEC §9.2, Layer 3).
//
// tests/compat/<vN>/ holds a project file FROZEN at format version N and the
// generated header it produced. This guard re-runs the *current* tool over each
// frozen project and compares:
//   1. it still LOADS (migrate does not throw, isProject holds)
//   2. generateHeader(migrate(project)) still equals the frozen .h
//
// Unlike tools/gen-fixtures.mjs (which regenerates live fixtures to track the
// codegen), these goldens are NOT auto-regenerated: a diff is a SIGNAL, not a
// routine update. When it fires, decide which case you are in:
//   - cosmetic / still-compatible codegen change  -> refreeze: rerun with --write
//   - the project-file FORMAT changed semantically -> bump FORMAT_VERSION
//     (docs/src/version.js), add the v(N)->v(N+1) migration, keep this golden as
//     the v N reference, and freeze a new tests/compat/v(N+1) snapshot.
//
//   node tools/check-compat.mjs            # exit 1 on any mismatch
//   node tools/check-compat.mjs --write    # refreeze the .h goldens in place

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { generateHeader } from '../docs/src/codegen.js';
import { migrate, isProject } from '../docs/src/persist.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const compatDir = join(root, 'tests', 'compat');
const norm = (s) => s.replace(/\r/g, '');
const mode = process.argv.includes('--write') ? 'write' : 'check';

if (!existsSync(compatDir)) {
  console.log('no tests/compat directory yet — nothing to check.');
  process.exit(0);
}

// Each version dir holds exactly one <Name>.lgfxsb.json and its <Name>.h golden.
const versions = readdirSync(compatDir, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .sort();

let bad = 0;
let wrote = 0;
let checked = 0;

for (const ver of versions) {
  const dir = join(compatDir, ver);
  const proj = readdirSync(dir).find((f) => f.endsWith('.lgfxsb.json'));
  if (!proj) { console.error(`${ver}: no .lgfxsb.json found`); bad++; continue; }
  const base = proj.replace(/\.lgfxsb\.json$/, '');
  const headerPath = join(dir, `${base}.h`);

  let project;
  try {
    project = JSON.parse(readFileSync(join(dir, proj), 'utf8'));
  } catch (e) {
    console.error(`${ver}/${proj}: invalid JSON — ${e.message}`); bad++; continue;
  }
  if (!isProject(project)) { console.error(`${ver}/${proj}: not a valid project`); bad++; continue; }

  let migrated;
  try {
    migrated = migrate(project);
  } catch (e) {
    console.error(`${ver}/${proj}: migrate() threw — ${e.message}`); bad++; continue;
  }

  const got = norm(generateHeader(migrated));
  const want = existsSync(headerPath) ? norm(readFileSync(headerPath, 'utf8')) : null;
  checked++;

  if (got === want) continue;
  if (mode === 'write') {
    writeFileSync(headerPath, generateHeader(migrated));
    console.log(`refroze: tests/compat/${ver}/${base}.h`);
    wrote++;
  } else {
    bad++;
    if (want === null) console.error(`${ver}: golden ${base}.h is missing`);
    else {
      const a = want.split('\n'), b = got.split('\n');
      let i = 0;
      while (i < Math.max(a.length, b.length) && a[i] === b[i]) i++;
      console.error(`${ver}: generated header differs from the frozen golden (first diff @ line ${i + 1})`);
      console.error(`  frozen:   ${JSON.stringify(a[i])}`);
      console.error(`  current:  ${JSON.stringify(b[i])}`);
    }
  }
}

if (mode === 'write') {
  console.log(wrote ? `\n${wrote} golden(s) refrozen.` : 'all goldens already current.');
  process.exit(0);
}
if (bad) {
  console.error(`\ncompat golden check FAILED (${bad}). If the change is intended and still ` +
    `format-compatible, refreeze: node tools/check-compat.mjs --write. If the project-file ` +
    `format changed, bump FORMAT_VERSION and add a migration (see SPEC §9.2).`);
  process.exit(1);
}
console.log(`compat goldens OK: ${checked} frozen version(s) load, migrate, and regenerate identically.`);
