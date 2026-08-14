// Curated web-font sources for the embedded-font generator (§8.7.7).
//
// Generating an embedded font bakes glyph shapes into the sketch's flash, which
// is a redistribution of the typeface — so the curated list is deliberately
// limited to SIL Open Font License 1.1 and Apache-2.0 families, both of which
// permit exactly that (OFL with attribution and the same-licence rule for
// derived font files; Apache-2.0 with attribution). Anything a user brings in
// themselves is their call, and the UI warns about it there.
//
// Fonts are fetched through the Google Fonts CSS API rather than pinned binary
// URLs, because gstatic file paths carry a version hash that changes.

const OFL = { id: 'OFL-1.1', name: 'SIL Open Font License 1.1', url: 'https://openfontlicense.org/' };
const APACHE = { id: 'Apache-2.0', name: 'Apache License 2.0', url: 'https://www.apache.org/licenses/LICENSE-2.0' };

// script: which preset group the family is useful for; `pixel` marks bitmap-ish
// display faces that stay crisp at tiny sizes, which is what most panels want.
export const FONTS = [
  // --- Latin UI ---
  { family: 'Roboto', script: 'latin', license: APACHE, by: 'Christian Robertson' },
  { family: 'Roboto Mono', script: 'latin', mono: true, license: APACHE, by: 'Christian Robertson' },
  { family: 'Roboto Condensed', script: 'latin', license: APACHE, by: 'Christian Robertson' },
  { family: 'Inter', script: 'latin', license: OFL, by: 'Rasmus Andersson' },
  { family: 'Noto Sans', script: 'latin', license: OFL, by: 'Google' },
  { family: 'JetBrains Mono', script: 'latin', mono: true, license: OFL, by: 'JetBrains' },
  { family: 'Oswald', script: 'latin', license: OFL, by: 'Vernon Adams' },
  { family: 'Montserrat', script: 'latin', license: OFL, by: 'Julieta Ulanovsky' },

  // --- display / clock ---
  { family: 'Orbitron', script: 'display', license: OFL, by: 'Matt McInerney' },
  { family: 'Share Tech Mono', script: 'display', mono: true, license: OFL, by: 'Carrois Apostrophe' },
  { family: 'VT323', script: 'display', mono: true, pixel: true, license: OFL, by: 'Peter Hull' },
  { family: 'Silkscreen', script: 'display', pixel: true, license: OFL, by: 'Jason Kottke' },
  { family: 'Micro 5', script: 'display', pixel: true, license: OFL, by: 'Ryoichi Tsunekawa' },
  { family: 'Tiny5', script: 'display', pixel: true, license: OFL, by: 'Sabor Design' },
  { family: 'Pixelify Sans', script: 'display', pixel: true, license: OFL, by: 'Elena Kozadaeva' },

  // --- Japanese ---
  { family: 'Noto Sans JP', script: 'japanese', license: OFL, by: 'Google' },
  { family: 'Noto Serif JP', script: 'japanese', license: OFL, by: 'Google' },
  { family: 'M PLUS 1', script: 'japanese', license: OFL, by: 'Coji Morishita' },
  { family: 'M PLUS 1 Code', script: 'japanese', mono: true, license: OFL, by: 'Coji Morishita' },
  { family: 'M PLUS 2', script: 'japanese', license: OFL, by: 'Coji Morishita' },
  { family: 'Kosugi Maru', script: 'japanese', license: APACHE, by: 'MOTOYA' },
  { family: 'Sawarabi Gothic', script: 'japanese', license: OFL, by: 'mshio' },
  { family: 'Zen Maru Gothic', script: 'japanese', license: OFL, by: 'Yoshimichi Ohira' },
  { family: 'BIZ UDGothic', script: 'japanese', license: OFL, by: 'Morisawa' },
  { family: 'BIZ UDPGothic', script: 'japanese', license: OFL, by: 'Morisawa' },
  { family: 'DotGothic16', script: 'japanese', pixel: true, license: OFL, by: 'Fontworks' },

  // --- other CJK ---
  { family: 'Noto Sans SC', script: 'cjk', license: OFL, by: 'Google' },
  { family: 'Noto Sans TC', script: 'cjk', license: OFL, by: 'Google' },
  { family: 'Noto Sans KR', script: 'cjk', license: OFL, by: 'Google' },
];

export const findFont = (family) => FONTS.find((f) => f.family === family) || null;

const CSS_API = 'https://fonts.googleapis.com/css2';

export const cssUrlFor = (family, weight = 400, italic = false) =>
  `${CSS_API}?family=${encodeURIComponent(family).replace(/%20/g, '+')}:` +
  `ital,wght@${italic ? 1 : 0},${weight}&display=swap`;

// Parse the `unicode-range: U+0-7F, U+2000-206F;` descriptor into pairs.
function parseUnicodeRange(spec) {
  const out = [];
  for (const partRaw of spec.split(',')) {
    const part = partRaw.trim();
    let m = /^U\+([0-9A-Fa-f]+)-([0-9A-Fa-f]+)$/.exec(part);
    if (m) { out.push([parseInt(m[1], 16), parseInt(m[2], 16)]); continue; }
    m = /^U\+([0-9A-Fa-f]*)(\?*)$/.exec(part);
    if (m) {
      const lo = parseInt((m[1] || '0') + '0'.repeat(m[2].length), 16);
      const hi = parseInt((m[1] || '0') + 'F'.repeat(m[2].length), 16);
      out.push([lo, hi]);
    }
  }
  return out;
}

// Split a Google Fonts stylesheet into { url, ranges } per @font-face block.
function parseCss(css) {
  const faces = [];
  for (const m of css.matchAll(/@font-face\s*\{([^}]*)\}/g)) {
    const block = m[1];
    const src = /src:\s*url\(([^)]+)\)/.exec(block);
    if (!src) continue;
    const ur = /unicode-range:\s*([^;]+);/.exec(block);
    faces.push({
      url: src[1].replace(/^['"]|['"]$/g, ''),
      ranges: ur ? parseUnicodeRange(ur[1]) : null, // null = covers everything
    });
  }
  return faces;
}

const intersects = (ranges, cps) =>
  !ranges || cps.some((c) => ranges.some(([lo, hi]) => c >= lo && c <= hi));

/**
 * Load a Google font into the document, fetching only the subsets that actually
 * cover the requested codepoints. Google splits CJK families into ~100 subset
 * files; a clock font needing 20 characters must not pull all of them.
 *
 * The FontFace objects keep their unicode-range, so canvas resolves each
 * codepoint to the right subset on its own.
 *
 * @returns {Promise<{family: string, faces: FontFace[], subsets: number, of: number}>}
 */
export async function loadGoogleFont(family, codepoints, { weight = 400, italic = false } = {}) {
  const res = await fetch(cssUrlFor(family, weight, italic));
  if (!res.ok) throw new Error(`Google Fonts CSS: HTTP ${res.status}`);
  const all = parseCss(await res.text());
  if (!all.length) throw new Error(`Google Fonts CSS: no @font-face for "${family}"`);
  const wanted = all.filter((f) => intersects(f.ranges, codepoints));
  if (!wanted.length) throw new Error(`"${family}" covers none of the selected characters`);

  // A private family name keeps repeated loads (and the page's own webfont
  // links) from colliding with this one.
  const local = `LGFXSBGF_${(loadGoogleFont._n = (loadGoogleFont._n || 0) + 1)}`;
  const faces = await Promise.all(wanted.map(async (f) => {
    const desc = f.ranges ? { unicodeRange: f.ranges.map(([lo, hi]) => `U+${lo.toString(16)}-${hi.toString(16)}`).join(', ') } : {};
    const face = new FontFace(local, `url(${f.url})`, desc);
    await face.load();
    document.fonts.add(face);
    return face;
  }));
  return { family: local, faces, subsets: wanted.length, of: all.length };
}
