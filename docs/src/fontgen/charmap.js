// "Which characters is this actually?" — the charset inspector (§8.7.7).
//
// A preset showing only a count ("4,217 characters") is not enough to decide
// whether it covers what a screen needs. This renders the resolved codepoints
// as text, grouped by Unicode block, so the answer is both readable and
// findable with the browser's own Ctrl+F.
//
// Block names are kept in their official English form rather than translated:
// they are stable identifiers people search for, and localizing ~30 of them
// across eight languages would add noise without adding meaning.

// The blocks these character sets actually reach. Anything outside them falls
// into a single "Other" bucket rather than being hidden.
const BLOCKS = [
  [0x0020, 0x007e, 'Basic Latin (ASCII)'],
  [0x00a0, 0x00ff, 'Latin-1 Supplement'],
  [0x0100, 0x017f, 'Latin Extended-A'],
  [0x0180, 0x024f, 'Latin Extended-B'],
  [0x02b0, 0x02ff, 'Spacing Modifier Letters'],
  [0x0370, 0x03ff, 'Greek and Coptic'],
  [0x0400, 0x04ff, 'Cyrillic'],
  [0x1e00, 0x1eff, 'Latin Extended Additional'],
  [0x2000, 0x206f, 'General Punctuation'],
  [0x2070, 0x209f, 'Super/Subscripts'],
  [0x20a0, 0x20cf, 'Currency Symbols'],
  [0x2100, 0x214f, 'Letterlike Symbols (℃ ℉ ™)'],
  [0x2150, 0x218f, 'Number Forms (Roman numerals)'],
  [0x2190, 0x21ff, 'Arrows'],
  [0x2200, 0x22ff, 'Mathematical Operators'],
  [0x2300, 0x23ff, 'Miscellaneous Technical'],
  [0x2460, 0x24ff, 'Enclosed Alphanumerics'],
  [0x2500, 0x257f, 'Box Drawing'],
  [0x2580, 0x259f, 'Block Elements'],
  [0x25a0, 0x25ff, 'Geometric Shapes'],
  [0x2600, 0x26ff, 'Miscellaneous Symbols'],
  [0x2700, 0x27bf, 'Dingbats'],
  [0x2e80, 0x2eff, 'CJK Radicals Supplement'],
  [0x3000, 0x303f, 'CJK Symbols and Punctuation'],
  [0x3040, 0x309f, 'Hiragana'],
  [0x30a0, 0x30ff, 'Katakana'],
  [0x3100, 0x312f, 'Bopomofo'],
  [0x3130, 0x318f, 'Hangul Compatibility Jamo'],
  [0x3190, 0x319f, 'Kanbun'],
  [0x31f0, 0x31ff, 'Katakana Phonetic Extensions'],
  [0x3200, 0x32ff, 'Enclosed CJK Letters and Months'],
  [0x3300, 0x33ff, 'CJK Compatibility (㎜ ㎏ ㎡)'],
  [0x3400, 0x4dbf, 'CJK Unified Ideographs Extension A'],
  [0x4e00, 0x9fff, 'CJK Unified Ideographs'],
  [0xa000, 0xa48f, 'Yi Syllables'],
  [0xac00, 0xd7af, 'Hangul Syllables'],
  [0xf900, 0xfaff, 'CJK Compatibility Ideographs'],
  [0xfb00, 0xfb4f, 'Alphabetic Presentation Forms'],
  [0xfe30, 0xfe4f, 'CJK Compatibility Forms'],
  [0xff00, 0xffef, 'Halfwidth and Fullwidth Forms'],
];

const blockOf = (cp) => BLOCKS.find(([lo, hi]) => cp >= lo && cp <= hi) || null;

const hex = (cp) => 'U+' + cp.toString(16).toUpperCase().padStart(4, '0');

/**
 * Group codepoints into Unicode blocks, preserving order.
 * @returns [{ name, range, chars, count }]
 */
export function groupByBlock(codepoints) {
  const groups = new Map();
  for (const cp of codepoints) {
    const b = blockOf(cp);
    const key = b ? b[2] : 'Other';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(cp);
  }
  return [...groups].map(([name, cps]) => ({
    name,
    range: `${hex(cps[0])}–${hex(cps[cps.length - 1])}`,
    chars: cps.map((c) => String.fromCodePoint(c)).join(''),
    count: cps.length,
  }));
}

/**
 * Render the inspector into `host`.
 *
 * `missing` (optional) is the set of codepoints the chosen typeface turned out
 * not to have. Showing them struck through in place is the useful view: it
 * answers "is my ℃ in there" and "did this font actually supply it" with one
 * glance, instead of a separate list of orphaned characters.
 */
export function renderCharmap(host, codepoints, { missing = null, emptyText = '' } = {}) {
  host.innerHTML = '';
  if (!codepoints.length) {
    host.innerHTML = `<p class="sub">${emptyText}</p>`;
    return;
  }
  const gone = missing instanceof Set ? missing : new Set(missing || []);
  const frag = document.createDocumentFragment();

  for (const g of groupByBlock(codepoints)) {
    const box = document.createElement('div');
    box.className = 'cm-block';

    const head = document.createElement('div');
    head.className = 'cm-head';
    head.textContent = `${g.name} · ${g.range} · ${g.count.toLocaleString()}`;
    box.appendChild(head);

    const body = document.createElement('div');
    body.className = 'cm-chars';
    if (!gone.size) {
      // One text node for the whole block: a set can run to twenty thousand
      // characters, and one element each would be needlessly heavy.
      body.textContent = g.chars;
    } else {
      // With a missing set, split into runs so only the absent characters get
      // an element — still one node per run, not per character.
      let runText = '';
      let runMissing = null;
      const flush = () => {
        if (!runText) return;
        if (runMissing) {
          const s = document.createElement('span');
          s.className = 'cm-missing';
          s.textContent = runText;
          body.appendChild(s);
        } else {
          body.appendChild(document.createTextNode(runText));
        }
        runText = '';
      };
      for (const ch of g.chars) {
        const isGone = gone.has(ch.codePointAt(0));
        if (runMissing !== null && isGone !== runMissing) flush();
        runMissing = isGone;
        runText += ch;
      }
      flush();
    }
    box.appendChild(body);
    frag.appendChild(box);
  }
  host.appendChild(frag);
}
