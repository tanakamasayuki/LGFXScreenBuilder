#!/usr/bin/env node
// i18n key-parity check (SPEC §14).
//
// `en` is the source of truth. Every other language table must define exactly
// the same key set — no missing keys (which would silently fall back to en and
// show English in a localized UI) and no stray keys (a typo'd key that never
// renders). Adding a UI string means adding its key to every language, and this
// guard makes a forgotten one fail CI instead of leaking English at runtime.
//
//   node tools/check-i18n.mjs   # exit 1 on any missing/extra key

import { MESSAGES, LANGS } from '../docs/src/i18n.js';

const en = new Set(Object.keys(MESSAGES.en));
let bad = 0;

// Every advertised language must have a table.
for (const l of LANGS) {
  if (!MESSAGES[l]) { console.error(`MISSING TABLE: "${l}" is in LANGS but has no MESSAGES entry`); bad++; }
}
// Every table must be advertised in LANGS (so the language picker can reach it).
for (const l of Object.keys(MESSAGES)) {
  if (!LANGS.includes(l)) { console.error(`ORPHAN TABLE: MESSAGES["${l}"] is not listed in LANGS`); bad++; }
}

for (const l of Object.keys(MESSAGES)) {
  if (l === 'en') continue;
  const keys = new Set(Object.keys(MESSAGES[l]));
  const missing = [...en].filter((k) => !keys.has(k));
  const extra = [...keys].filter((k) => !en.has(k));
  if (missing.length) { console.error(`${l}: ${missing.length} missing key(s): ${missing.join(', ')}`); bad++; }
  if (extra.length) { console.error(`${l}: ${extra.length} extra key(s): ${extra.join(', ')}`); bad++; }
}

if (bad) {
  console.error(`\ni18n parity check FAILED (${bad} issue(s)).`);
  process.exit(1);
}
console.log(`i18n parity OK: ${LANGS.length} languages, ${en.size} keys each.`);
