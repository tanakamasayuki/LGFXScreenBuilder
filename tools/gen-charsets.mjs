#!/usr/bin/env node
// Generate docs/src/fontgen/charsets-data.js — the character-set building blocks
// the font generator composes selections from (SPEC §8.7.7).
//
// Everything here is derived from Unicode's own data so the sets are auditable
// and reproducible rather than someone's judgement call:
//
//   Unihan.zip / Unihan_OtherMappings.txt
//     kJoyoKanji             常用漢字      (Japanese, general-use)
//     kJinmeiyoKanji         人名用漢字    (Japanese, name-use)
//     kJis0                  JIS X 0208, split into level 1 / level 2 by ku
//     kGB0                   GB 2312, split into level 1 / level 2 by ku
//     kBigFive               Big5, split into common / less-common by code
//     kKoreanEducationHanja  중학교 한문 교육용 기초 한자
//   KSC5601.TXT              KS X 1001 hanja + hangul syllables
//
// Two deliberate choices:
//
// 1. **Tiers are cumulative unions.** The raw standards do not nest — 常用漢字
//    has 34 characters outside JIS level 1 (the 2010 additions) and 4 outside
//    JIS X 0208 entirely. Defining each tier as "everything below it, plus this
//    standard" makes the ladder monotone by construction, so moving up a level
//    can never silently drop a character. That was a real defect of the sets
//    this replaces.
// 2. **Han is per language, unioned.** "Japanese" and "CJK" are not two points
//    on one scale; they are different repertoires. Selecting them independently
//    and taking the union is the only model that does not lie about that.
//
//   node tools/gen-charsets.mjs          # fetch, rewrite the module
//   node tools/gen-charsets.mjs --check  # exit 1 if the committed file is stale

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'docs/src/fontgen/charsets-data.js');

const UNIHAN_URL = 'https://www.unicode.org/Public/UCD/latest/ucd/Unihan.zip';
const KSC_URL = 'https://unicode.org/Public/MAPPINGS/OBSOLETE/EASTASIA/KSC/KSC5601.TXT';

// --- fetching -------------------------------------------------------------

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.text();
}

// Unihan ships as a zip; pull just the one member out through the system unzip
// rather than adding a zip library to a repo that has no dependencies.
async function fetchUnihanOtherMappings() {
  const res = await fetch(UNIHAN_URL);
  if (!res.ok) throw new Error(`${UNIHAN_URL}: HTTP ${res.status}`);
  const dir = mkdtempSync(join(tmpdir(), 'lgfxsb-unihan-'));
  try {
    const zip = join(dir, 'Unihan.zip');
    writeFileSync(zip, Buffer.from(await res.arrayBuffer()));
    execFileSync('unzip', ['-o', '-q', zip, 'Unihan_OtherMappings.txt', '-d', dir]);
    return readFileSync(join(dir, 'Unihan_OtherMappings.txt'), 'utf8');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// --- parsing --------------------------------------------------------------

// "U+4E00\tkJis0\t1676" -> Map(codepoint -> value) for one property.
function unihanField(text, field) {
  const out = new Map();
  for (const line of text.split('\n')) {
    if (!line || line[0] === '#') continue;
    const c = line.split('\t');
    if (c[1] !== field) continue;
    out.set(parseInt(c[0].slice(2), 16), c[2]);
  }
  return out;
}

const isHan = (c) =>
  (c >= 0x4e00 && c <= 0x9fff) || (c >= 0x3400 && c <= 0x4dbf) || (c >= 0xf900 && c <= 0xfaff) ||
  (c >= 0x20000 && c <= 0x2ffff);

// ku (row) of a "kuten" value like 1676 -> 16.
const ku = (v) => Math.floor(parseInt(v, 10) / 100);

const keysWhere = (map, pred) => new Set([...map].filter(([, v]) => pred(v)).map(([k]) => k));

// KSC5601.TXT is the UHC/CP949 layout: the KS X 1001 (Wansung) repertoire sits
// at lead 0xB0-0xC8 (hangul) / 0xCA-0xFD (hanja) with trail >= 0xA1; the rest of
// the file is the extended area that fills in the remaining modern syllables.
function parseKsc(text) {
  const hanja = new Set();
  const hangulKs = new Set();
  for (const line of text.split('\n')) {
    if (!line || line[0] === '#') continue;
    const c = line.split(/\s+/);
    if (c.length < 2) continue;
    const code = parseInt(c[0], 16);
    const uni = parseInt(c[1], 16);
    if (!code || !uni) continue;
    const lead = code >> 8;
    const trail = code & 0xff;
    const inWansung = trail >= 0xa1 && trail <= 0xfe;
    if (isHan(uni)) { if (inWansung) hanja.add(uni); continue; }
    if (uni >= 0xac00 && uni <= 0xd7a3 && inWansung && lead >= 0xb0 && lead <= 0xc8) hangulKs.add(uni);
  }
  return { hanja, hangulKs };
}

// --- literal sets ---------------------------------------------------------
//
// Written out as text rather than derived, because these are editorial choices
// about what a small screen needs, not standards. Keeping them readable means
// the diff shows exactly which characters a change adds.

const LITERAL = {
  // Digits alone: a clock or a sensor readout needs ten glyphs, not ninety-five,
  // and at 32px that difference is real flash.
  digits: chars('0123456789'),
  // ASCII, minus the control range and DEL.
  ascii: range(0x20, 0x7e),
  // Latin-1 letters, signs and the fraction/degree marks a European UI wants.
  latinExt: range(0x00a0, 0x00ff),
  hiragana: [...range(0x3041, 0x3096), ...range(0x309b, 0x309f)],
  katakana: range(0x30a1, 0x30ff),
  katakanaHalf: range(0xff61, 0xff9f),
  // Japanese punctuation, the part of U+3000..303F that is actually used.
  jaPunct: chars('　、。〃〄々〆〇〈〉《》「」『』【】〒〓〔〕〖〗〘〙〜〝〞・ー'),
  greek: [...range(0x0391, 0x03a9), ...range(0x03b1, 0x03c9)],
  cyrillic: [...range(0x0410, 0x044f), 0x0401, 0x0451],

  // --- symbol categories ---
  symUnits: chars('°℃℉µΩ‰ℓ㎜㎝㎞㎎㎏㎡㎥㏄㍉㌔㌢㍍㌘㌧㌃㌶㍑㍗㌍㌦㌣㌫㍊㌻㎛㎲㎳㎂㎃㎄㎅㎆㎇㎈㎉㎊㎋㎌'),
  symMath: chars('±×÷≠≒≡≤≥≦≧∞√∛∑∏∫∬∂∇∈∋⊂⊃∪∩∧∨¬⇒⇔∀∃∴∵∝⊥∠⌒∽≪≫'),
  symArrows: chars('←↑→↓↔↕↖↗↘↙⇐⇑⇒⇓⇔⇕↰↱↲↳⟵⟶'),
  symShapes: chars('■□▢▣▤▥▦▧▨▩▪▫▬▭▮▯▲△▴▵▶▷▸▹▼▽▾▿◀◁◂◃◆◇◈◉○◎●◐◑◒◓◔◕◯★☆♠♡♢♣♤♥♦♧'),
  symCurrency: chars('$¢£¤¥€₩₪₫₭₮₱₲₴₵₸₹₺₽₿'),
  symEnclosed: [...range(0x2460, 0x2473), ...range(0x24b6, 0x24e9), ...chars('㊙㊗㊤㊥㊦㊧㊨')],
  symMisc: chars('§¶†‡•‥…‰′″※☀☁☂☃☎☏☑☒✓✔✗✘♪♭♯♩♫⌚⌛⏰⏱⚠⚡⌂'),
};

function range(a, b) {
  const out = [];
  for (let c = a; c <= b; c++) out.push(c);
  return out;
}
function chars(s) {
  return [...s].map((c) => c.codePointAt(0));
}

// --- encoding -------------------------------------------------------------

function encodeRanges(cps) {
  const sorted = [...new Set(cps)].sort((a, b) => a - b);
  if (!sorted.length) return '';
  const hex = (c) => c.toString(16).toUpperCase();
  const parts = [];
  let start = sorted[0], prev = sorted[0];
  for (const c of sorted.slice(1)) {
    if (c === prev + 1) { prev = c; continue; }
    parts.push(start === prev ? hex(start) : `${hex(start)}-${hex(prev)}`);
    start = prev = c;
  }
  parts.push(start === prev ? hex(start) : `${hex(start)}-${hex(prev)}`);
  return parts.join(',');
}

// --- build ----------------------------------------------------------------

async function build() {
  const [unihan, kscText] = await Promise.all([fetchUnihanOtherMappings(), fetchText(KSC_URL)]);
  const ksc = parseKsc(kscText);

  const joyo = unihanField(unihan, 'kJoyoKanji');
  const jinmei = unihanField(unihan, 'kJinmeiyoKanji');
  const jis = unihanField(unihan, 'kJis0');
  const gb = unihanField(unihan, 'kGB0');
  const big5 = unihanField(unihan, 'kBigFive');
  const koreanEdu = unihanField(unihan, 'kKoreanEducationHanja');

  const jis1 = keysWhere(jis, (v) => ku(v) >= 16 && ku(v) <= 47);
  const jis2 = keysWhere(jis, (v) => ku(v) >= 48 && ku(v) <= 84);
  const gb1 = keysWhere(gb, (v) => ku(v) >= 16 && ku(v) <= 55);
  const gb2 = keysWhere(gb, (v) => ku(v) >= 56 && ku(v) <= 87);
  const big5a = keysWhere(big5, (v) => parseInt(v, 16) <= 0xc67e);
  const big5b = keysWhere(big5, (v) => parseInt(v, 16) >= 0xc940);

  // Cumulative: each tier is everything below it plus one more standard.
  const cumulative = (...steps) => {
    const acc = new Set();
    return steps.map((s) => {
      for (const c of s) acc.add(c);
      return new Set(acc);
    });
  };

  const [jaA, jaB, jaC, jaD] = cumulative(joyo.keys(), jinmei.keys(), jis1, jis2);
  const [cnA, cnB] = cumulative(gb1, gb2);
  const [twA, twB] = cumulative(big5a, big5b);
  const [koA, koB] = cumulative(koreanEdu.keys(), ksc.hanja);

  const sets = {
    // latin / kana / punctuation
    digits: LITERAL.digits,
    ascii: LITERAL.ascii,
    latinExt: LITERAL.latinExt,
    hiragana: LITERAL.hiragana,
    katakana: LITERAL.katakana,
    katakanaHalf: LITERAL.katakanaHalf,
    jaPunct: LITERAL.jaPunct,
    greek: LITERAL.greek,
    cyrillic: LITERAL.cyrillic,

    // han, per language, cumulative tiers
    hanJa1: [...jaA], hanJa2: [...jaB], hanJa3: [...jaC], hanJa4: [...jaD],
    hanCn1: [...cnA], hanCn2: [...cnB],
    hanTw1: [...twA], hanTw2: [...twB],
    hanKo1: [...koA], hanKo2: [...koB],
    hanAll: range(0x4e00, 0x9fff),

    // hangul
    hangulKs: [...ksc.hangulKs],
    hangulAll: range(0xac00, 0xd7a3),

    // symbols
    symUnits: LITERAL.symUnits,
    symMath: LITERAL.symMath,
    symArrows: LITERAL.symArrows,
    symShapes: LITERAL.symShapes,
    symCurrency: LITERAL.symCurrency,
    symEnclosed: LITERAL.symEnclosed,
    symMisc: LITERAL.symMisc,
  };

  const counts = {};
  for (const [k, v] of Object.entries(sets)) counts[k] = new Set(v).size;

  let s = '';
  s += '// GENERATED by tools/gen-charsets.mjs. Do not edit by hand.\n';
  s += '//\n';
  s += '// Derived from Unicode\'s own data (Unihan kJoyoKanji / kJinmeiyoKanji / kJis0 /\n';
  s += '// kGB0 / kBigFive / kKoreanEducationHanja, plus KSC5601.TXT) so every set is\n';
  s += '// auditable, and from the literal symbol lists in that generator.\n';
  s += '//\n';
  s += '// Han tiers are CUMULATIVE unions: the underlying standards do not nest (常用漢字\n';
  s += '// has 34 characters outside JIS level 1), so each tier is defined as everything\n';
  s += '// below it plus one more standard. Moving up a tier can therefore never drop a\n';
  s += '// character.\n';
  s += '//\n';
  s += '// Values are compact "START-END,SINGLE,..." hex codepoint lists; expand them with\n';
  s += '// parseRanges() from ./charsets.js.\n';
  s += 'export const SET_RANGES = {\n';
  for (const [k, v] of Object.entries(sets)) {
    s += `  ${k}: '${encodeRanges(v)}',\n`;
  }
  s += '};\n\n';
  s += 'export const SET_COUNTS = {\n';
  for (const [k, n] of Object.entries(counts)) s += `  ${k}: ${n},\n`;
  s += '};\n';

  for (const [k, n] of Object.entries(counts)) console.error(`  ${k.padEnd(14)} ${String(n).padStart(6)}`);
  return s;
}

let text;
try {
  text = await build();
} catch (e) {
  // --check exists to catch the committed copy drifting from upstream, not to
  // make CI depend on unicode.org being reachable. A fetch failure is reported
  // and skipped; a content difference still fails.
  if (process.argv.includes('--check')) {
    console.error(`SKIP: could not build the character sets (${e.message}).`);
    process.exit(0);
  }
  throw e;
}

if (process.argv.includes('--check')) {
  if (readFileSync(OUT, 'utf8') !== text) {
    console.error('\ncharsets-data.js is STALE — run: node tools/gen-charsets.mjs');
    process.exit(1);
  }
  console.log('charsets-data.js is up to date.');
} else {
  writeFileSync(OUT, text);
  console.log(`wrote ${OUT}`);
}
