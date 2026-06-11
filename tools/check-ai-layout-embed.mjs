#!/usr/bin/env node
// Embedded AI-layout block regression check (SPEC §10.2).
//
// generateHeader(project, {embedAiLayouts:true}) appends a comment-only block:
//     /* LGFXSB-AI-LAYOUTS v1 (...)
//     <pretty JSON, every "/" escaped as "\/">
//     LGFXSB-AI-LAYOUTS END */
// The screenshot gallery derives per-scene data from this block in the *.h
// ALONE, so the format is a consumed contract — but gen-fixtures only checks the
// header text matches, never that the block still parses. This pins the
// invariants a codegen refactor could silently break:
//   1. opt-in    — no block unless embedAiLayouts is set
//   2. no "*/"   — the escaped JSON can never close the comment early
//   3. parseable — the text between the sentinels is valid JSON as-is (the "\/"
//                  escape is valid JSON, so no un-escaping step is needed)
//   4. faithful  — it carries every scene, matching buildAiLayout for the
//                  exported profiles (what an AI / the gallery reads back)
//
//   node tools/check-ai-layout-embed.mjs   # exit 1 on any violation

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { generateHeader } from '../docs/src/codegen.js';
import { buildAiLayout } from '../docs/src/ailayout.js';
import { isProject } from '../docs/src/persist.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// Multi-scene, multi-profile source → exercises every scene and per-profile
// placement in one pass.
const SOURCE = 'fixtures/sample.lgfxsb.json';

const SENTINEL_OPEN = 'LGFXSB-AI-LAYOUTS v1';
const SENTINEL_END = 'LGFXSB-AI-LAYOUTS END */';
const BLOCK_RE = /\/\* LGFXSB-AI-LAYOUTS v1[^\n]*\n([\s\S]*?)\nLGFXSB-AI-LAYOUTS END \*\//;

const fail = [];
const check = (cond, msg) => { if (!cond) fail.push(msg); };

const project = JSON.parse(readFileSync(join(root, SOURCE), 'utf8'));
if (!isProject(project)) {
  console.error(`${SOURCE}: not a valid project file`);
  process.exit(2);
}

// 1. opt-in: default output carries no block.
const plain = generateHeader(project);
check(!plain.includes(SENTINEL_OPEN),
  'default header (embedAiLayouts off) must not contain the AI-layout block');

// Generate the embedded variant once for the remaining checks.
const header = generateHeader(project, { embedAiLayouts: true });

const m = header.match(BLOCK_RE);
check(!!m, 'embedAiLayouts header must contain a parseable AI-layout block (sentinels not found)');

if (m) {
  const body = m[1];

  // 2. The embedded JSON must never contain "*/" (would close the comment early).
  //    Search the body only — the closing sentinel itself legitimately has "*/".
  check(!body.includes('*/'),
    'embedded JSON contains "*/" — it would close the comment block early (escape regression)');

  // 3. The block body is valid JSON exactly as written (no un-escaping needed).
  let doc = null;
  try { doc = JSON.parse(body); }
  catch (e) { fail.push(`embedded block is not valid JSON: ${e.message}`); }

  if (doc) {
    check(doc.format === 'lgfxsb-ai-layouts', `format must be "lgfxsb-ai-layouts" (got ${JSON.stringify(doc.format)})`);
    check(doc.version === 1, `version must be 1 (got ${JSON.stringify(doc.version)})`);
    // The "/" escape applies to the spec URL too; it must round-trip back intact.
    check(/^https?:\/\//.test(doc.spec || ''), `spec URL did not round-trip (got ${JSON.stringify(doc.spec)})`);

    // 4. Faithful: one entry per scene, matching buildAiLayout for the exported
    //    profiles (the gallery / AI reads exactly this).
    const want = project.scenes.map((sc) => buildAiLayout(project, sc.id)).filter(Boolean);
    check(Array.isArray(doc.scenes) && doc.scenes.length === want.length,
      `expected ${want.length} scene(s) in the block, got ${Array.isArray(doc.scenes) ? doc.scenes.length : 'non-array'}`);
    if (Array.isArray(doc.scenes) && doc.scenes.length === want.length) {
      check(JSON.stringify(doc.scenes) === JSON.stringify(want),
        'embedded scenes do not match buildAiLayout output (block is stale or lossy)');
    }
  }
}

if (fail.length) {
  console.error(`AI-layout embed check FAILED (${fail.length}):`);
  for (const f of fail) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`AI-layout embed block OK (${SOURCE}): opt-in, no "*/", parseable, ${project.scenes.length} scene(s) faithful.`);
