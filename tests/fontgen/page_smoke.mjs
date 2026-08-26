#!/usr/bin/env node
// The former standalone generator is now a compatibility redirect to the more
// capable upstream LGFXFontToolJs generator. Keep the old URL working while
// making all current UI links go directly to the destination.

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const target = 'https://tanakamasayuki.github.io/LGFXFontToolJs/generator.html';
const redirect = await readFile(join(root, 'docs', 'fontgen.html'), 'utf8');
const index = await readFile(join(root, 'docs', 'index.html'), 'utf8');

const failures = [];
const check = (condition, message) => {
  if (condition) console.log(`  ok   ${message}`);
  else { console.error(`  FAIL ${message}`); failures.push(message); }
};

console.log('font generator hand-off:');
check(redirect.includes(`http-equiv="refresh" content="0; url=${target}"`),
  'the legacy page redirects without JavaScript');
check(redirect.includes(`location.replace('${target}')`),
  'the legacy page replaces browser history when JavaScript is available');
check(redirect.includes(`<a href="${target}">`),
  'the legacy page has a manual fallback link');
check(redirect.includes(`rel="canonical" href="${target}"`),
  'the legacy page declares the upstream canonical URL');
check(index.includes(`<a href="${target}" target="_blank" rel="noopener" data-i18n="cf.standalone">`),
  'the editor links directly to the upstream generator');

if (failures.length) {
  console.error(`\nfontgen redirect smoke FAILED (${failures.length} issue(s)).`);
  process.exit(1);
}
console.log('\nfontgen redirect smoke OK.');
