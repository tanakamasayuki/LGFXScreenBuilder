// Generate the preset-font catalog (SPEC §8.7.2) by parsing the LovyanGFX and
// M5GFX `lgfx_fonts.hpp` at the versions pinned in tools/fontgen/sketch.yaml,
// classifying each font by name, and writing docs/src/font-catalog.js.
//
// The version is taken from the sketch.yaml pin (not "whatever is in internal"):
// ~/.arduino15/internal can hold several versions of a library, and a freshly
// bumped version is only downloaded on the first build. So resolve the exact
// pinned version and fail loudly if it is not present (build tools/fontgen).
//
// Usage: node tools/gen-fonts.mjs
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const INTERNAL = join(homedir(), '.arduino15', 'internal');
const SKETCH = join(ROOT, 'tools', 'fontgen', 'sketch.yaml');

// Read pinned library versions from the catalog-source sketch.yaml.
function pinnedVersions() {
  const yaml = readFileSync(SKETCH, 'utf8');
  const out = {};
  const re = /^\s*-\s*(LovyanGFX|M5GFX)\s*\(([^)]+)\)/gm;
  let m;
  while ((m = re.exec(yaml))) out[m[1]] = m[2].trim();
  return out;
}

// Resolve `<Name>/.../lgfx_fonts.hpp` for the EXACT pinned version under internal.
function resolveHeader(name, version) {
  if (!existsSync(INTERNAL)) throw new Error(`${INTERNAL} does not exist — build tools/fontgen first.`);
  const prefix = `${name}_${version}_`;
  const dirs = readdirSync(INTERNAL).filter((d) => d.startsWith(prefix));
  if (!dirs.length) {
    throw new Error(`${name} ${version} not found under ${INTERNAL}.\n` +
      `Bump is pinned in tools/fontgen/sketch.yaml but not yet downloaded — build it once:\n` +
      `  arduino-cli compile --profile host tools/fontgen`);
  }
  if (dirs.length > 1) console.warn(`! ${name} ${version}: ${dirs.length} copies, using ${dirs[0]}`);
  const p = join(INTERNAL, dirs[0], name, 'src', 'lgfx', 'v1', 'lgfx_fonts.hpp');
  if (!existsSync(p)) throw new Error(`${p} missing`);
  return p;
}

const CATEGORY = {
  GLCDfont: 'bitmap', BMPfont: 'bitmap', RLEfont: 'bitmap', FixedBMPfont: 'bitmap',
  GFXfont: 'gfx', U8g2font: 'u8g2', BDFfont: 'bdf', VLWfont: 'vlw',
};

// Classify a font from its type symbol + name into filterable attributes.
function classify(typeSym, name) {
  const category = CATEGORY[typeSym] || 'other';
  const bold = /Bold|_bi?$/.test(name);
  const italic = /Oblique|Italic|_b?i$/.test(name);
  const cjk = /(Japan|efont|lgfxJapan|Gothic|Mincho|CN|JA|KR|TW|Kanji)/.test(name);

  let family = name, size = null, unit = null, script = cjk ? 'cjk' : 'latin';

  let m;
  if ((m = name.match(/^(.*?)(\d+)pt7b$/))) {            // GFX: FreeSansBold12pt7b
    family = m[1].replace(/(Bold|Oblique|Italic)+$/, '');
    size = +m[2]; unit = 'pt';
  } else if ((m = name.match(/^efont([A-Z]{2})?_(\d+)(_(b|i|bi))?$/))) { // efontCN_16_bi
    family = 'efont' + (m[1] || '');
    size = +m[2]; unit = 'px';
  } else if ((m = name.match(/^(.*?)_(\d+)$/))) {        // Orbitron_Light_24 / lgfxJapanGothic_8
    family = m[1].replace(/_+$/, '');
    size = +m[2]; unit = 'px';
  } else if (category !== 'bitmap' && (m = name.match(/^([A-Za-z]+?)(\d+)$/))) { // DejaVu40
    family = m[1]; size = +m[2]; unit = 'px';
  }
  // bitmap classics (Font0/2/4…, AsciiFont8x16): keep the name as the family.
  if (category === 'bitmap') { family = name; size = null; unit = null; }

  return { name, type: typeSym, category, family, bold, italic, size, unit, script };
}

function parse(path) {
  const src = readFileSync(path, 'utf8');
  const block = src.slice(src.indexOf('namespace fonts'));
  const re = /extern\s+const\s+lgfx::(\w*[Ff]ont)\s+(\w+)\s*;/g;
  const out = [];
  let m;
  while ((m = re.exec(block))) out.push(classify(m[1], m[2]));
  return out;
}

const versions = pinnedVersions();
if (!versions.LovyanGFX) {
  throw new Error(`tools/fontgen/sketch.yaml must pin LovyanGFX. Got: ${JSON.stringify(versions)}`);
}

// LovyanGFX is the representative single catalog: at the pinned versions the
// LovyanGFX and M5GFX font sets are identical, so we parse + introspect once on
// LovyanGFX and reuse it for M5GFX/M5Unified (§8.7.2).
const catalog = parse(resolveHeader('LovyanGFX', versions.LovyanGFX));
console.log(`LovyanGFX ${versions.LovyanGFX}: ${catalog.length} fonts (representative catalog)`);

// Diff guard: if a future bump makes M5GFX's set diverge, flag it (decide then
// whether to add the extras or ignore uncommon ones). Best-effort: skip if M5GFX
// is not pinned/downloaded.
let m5note = 'M5GFX assumed identical (not checked)';
if (versions.M5GFX) {
  try {
    const m5 = parse(resolveHeader('M5GFX', versions.M5GFX));
    const L = new Set(catalog.map((f) => f.name)), M = new Set(m5.map((f) => f.name));
    const onlyL = [...L].filter((x) => !M.has(x)), onlyM = [...M].filter((x) => !L.has(x));
    if (onlyL.length || onlyM.length) {
      console.warn(`! font set DIVERGES from M5GFX ${versions.M5GFX}: LovyanGFX-only ${onlyL.length}, M5GFX-only ${onlyM.length}`);
      if (onlyL.length) console.warn(`  LovyanGFX-only: ${onlyL.slice(0, 12).join(', ')}`);
      if (onlyM.length) console.warn(`  M5GFX-only: ${onlyM.slice(0, 12).join(', ')}`);
      console.warn(`  Catalog uses LovyanGFX as representative; review whether to add the extras (§8.7.2).`);
      m5note = `DIVERGES from M5GFX ${versions.M5GFX} (LovyanGFX-only ${onlyL.length}, M5GFX-only ${onlyM.length}) — using LovyanGFX`;
    } else {
      console.log(`M5GFX ${versions.M5GFX}: identical font set (diff guard OK)`);
      m5note = `identical to M5GFX ${versions.M5GFX} (diff-checked)`;
    }
  } catch (e) { console.warn(`! M5GFX diff check skipped: ${e.message.split('\n')[0]}`); }
}

const banner = `// GENERATED by tools/gen-fonts.mjs from lgfx_fonts.hpp. Do not edit by hand.\n` +
  `// Source: LovyanGFX ${versions.LovyanGFX} (representative single catalog; ${m5note}).\n` +
  `// Name-derived classification only (SPEC §8.7.2); host metrics/coverage/size/preview added later.\n`;
const body = `export const FONT_CATALOG = ${JSON.stringify(catalog, null, 0)};\n\n` +
  `// Single representative catalog. At the pinned versions LovyanGFX and M5GFX\n` +
  `// share the same font set, so every target library uses this one catalog.\n` +
  `export const catalogFor = (_lib) => FONT_CATALOG;\n`;
writeFileSync(join(ROOT, 'docs', 'src', 'font-catalog.js'), banner + body);
console.log('wrote docs/src/font-catalog.js');
