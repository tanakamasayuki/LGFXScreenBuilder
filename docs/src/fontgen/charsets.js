// Character-set presets for the embedded-font generator (§8.7.7).
//
// A generated font only carries the glyphs you ask for, so "which characters"
// is the single biggest lever on flash size. Picking codepoints by hand is
// impractical, so the generator ships presets: the bulk lists come from
// charsets-data.js (imported by tools/gen-charsets.mjs from the efont Arduino
// library's enable-headers — the lists only, not the font data), and the small
// curated sets below fill the gaps those lists leave. Most importantly `units`:
// the "Japanese mini" list has ° but NOT ℃ (U+2103), which is exactly what a
// thermometer UI needs.
//
// Presets are additive: the UI checks several and the generator unions them,
// then adds any custom characters on top.
import { SET_RANGES, SET_COUNTS } from './charsets-data.js';

// "20-7E,A0" -> [0x20..0x7E, 0xA0]. Whitespace and empty items are ignored.
export function parseRanges(spec) {
  const out = [];
  for (const partRaw of String(spec).split(',')) {
    const part = partRaw.trim();
    if (!part) continue;
    const m = /^(?:U\+)?([0-9A-Fa-f]+)(?:\s*-\s*(?:U\+)?([0-9A-Fa-f]+))?$/.exec(part);
    if (!m) continue;
    const a = parseInt(m[1], 16);
    const b = m[2] === undefined ? a : parseInt(m[2], 16);
    for (let c = Math.min(a, b); c <= Math.max(a, b); c++) out.push(c);
  }
  return out;
}

// Codepoints of a literal string, surrogate pairs collapsed to one codepoint.
export const codepointsOf = (text) => [...String(text)].map((ch) => ch.codePointAt(0));

// Curated sets efont does not provide. Written as literal text (not ranges) so
// the intent stays readable and reviewable in the diff.
const UNITS_TEXT =
  '°℃℉±×÷≒≠≤≥≦≧∞√∑∴‰µΩΔ' +          // math / measurement
  '¢£¥€§¶†‡©®™' +                      // currency / marks
  '←→↑↓⇒⇔' +                           // arrows
  '■□▲△▼▽●○◎◆◇★☆※〒♪♭♯' +          // ui glyphs
  '½¼¾¹²³⁰ⁿ' +                         // fractions / superscripts
  '㎜㎝㎞㎎㎏㎡㎥㏄ℓ';                   // squared CJK units (font support varies)

const CLOCK_TEXT =
  '0123456789:.,/- +' +
  'AMPamp' +                            // AM/PM
  '年月日時分秒週曜' +
  '月火水木金土日' +
  '午前後';

const KANA_TEXT =
  'ぁあぃいぅうぇえぉおかがきぎくぐけげこごさざしじすずせぜそぞただちぢっつづてでとど' +
  'なにぬねのはばぱひびぴふぶぷへべぺほぼぽまみむめもゃやゅゆょよらりるれろゎわゐゑをん' +
  'ァアィイゥウェエォオカガキギクグケゲコゴサザシジスズセゼソゾタダチヂッツヅテデトド' +
  'ナニヌネノハバパヒビピフブプヘベペホボポマミムメモャヤュユョヨラリルレロヮワヰヱヲンヴヵヶ' +
  '、。「」『』（）・ー〜ヽヾゝゞ゛゜';

// A preset is { id, group, from } where `from` is either efont range data or a
// literal character list. `count` is filled in by expand().
const RAW = [
  { id: 'ascii', group: 'latin', ranges: '20-7E' },
  { id: 'latin1', group: 'latin', ranges: SET_RANGES.latin1, count: SET_COUNTS.latin1 },
  { id: 'digits', group: 'latin', text: '0123456789' },
  { id: 'units', group: 'symbol', text: UNITS_TEXT },
  { id: 'clock', group: 'symbol', text: CLOCK_TEXT },
  { id: 'kana', group: 'japanese', text: KANA_TEXT },
  { id: 'jaMini', group: 'japanese', ranges: SET_RANGES.jaMini, count: SET_COUNTS.jaMini },
  { id: 'ja', group: 'japanese', ranges: SET_RANGES.ja, count: SET_COUNTS.ja },
  { id: 'cjk', group: 'cjk', ranges: SET_RANGES.cjk, count: SET_COUNTS.cjk },
  { id: 'cn', group: 'cjk', ranges: SET_RANGES.cn, count: SET_COUNTS.cn },
  { id: 'tw', group: 'cjk', ranges: SET_RANGES.tw, count: SET_COUNTS.tw },
  { id: 'kr', group: 'cjk', ranges: SET_RANGES.kr, count: SET_COUNTS.kr },
];

// Codepoints are expanded lazily: the CJK sets are ~20k entries each and a
// page that only generates ASCII should never pay for them.
const cache = new Map();
export function codepointsOfPreset(id) {
  if (cache.has(id)) return cache.get(id);
  const p = RAW.find((x) => x.id === id);
  if (!p) return [];
  const cps = p.text ? codepointsOf(p.text) : parseRanges(p.ranges);
  const uniq = [...new Set(cps)].sort((a, b) => a - b);
  cache.set(id, uniq);
  return uniq;
}

// Catalog for the UI: id + group + character count (no codepoints expanded for
// the sets that already carry a generated count).
export const PRESETS = RAW.map((p) => ({
  id: p.id,
  group: p.group,
  count: p.count ?? (p.text ? new Set(codepointsOf(p.text)).size : parseRanges(p.ranges).length),
}));

export const PRESET_GROUPS = ['latin', 'symbol', 'japanese', 'cjk'];

// Union of the selected presets + literal custom text + custom ranges.
// Always sorted ascending, deduped, and stripped of control characters (a
// glyph for U+0000..U+001F is never drawable and only wastes flash).
export function resolveCharset({ presets = [], customText = '', customRanges = '' } = {}) {
  const set = new Set();
  for (const id of presets) for (const c of codepointsOfPreset(id)) set.add(c);
  for (const c of codepointsOf(customText)) set.add(c);
  for (const c of parseRanges(customRanges)) set.add(c);
  return [...set].filter((c) => c >= 0x20 && c !== 0x7f).sort((a, b) => a - b);
}

// U8g2/VLW address glyphs with a uint16 encoding, so anything outside the BMP
// cannot be represented. Callers report these back to the user rather than
// silently dropping them.
export const splitBmp = (cps) => ({
  bmp: cps.filter((c) => c <= 0xffff),
  dropped: cps.filter((c) => c > 0xffff),
});
