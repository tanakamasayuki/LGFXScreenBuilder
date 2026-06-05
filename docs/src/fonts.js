// Preset-font catalog queries + preview (SPEC §8.7.2/§8.7.3). The catalog
// (docs/src/font-catalog.js) is generated offline; host metrics + a sample
// atlas (font-metrics.json / font-atlas.png) are produced by the introspection
// harness (tests/manual/font_introspect, phase 1b). When the metrics are present the
// preview shows the exact host-rendered glyphs (atlas crop); otherwise it falls
// back to an approximate CSS font.
import { FONT_CATALOG, catalogFor } from './font-catalog.js';

export { catalogFor, FONT_CATALOG };

// Host-introspected metrics + sample atlas, loaded lazily from font-metrics.json.
// Stays null in non-browser contexts (no fetch) → callers use the approx preview.
let METRICS = null;
export async function loadMetrics() {
  if (METRICS || typeof fetch === 'undefined') return METRICS;
  try {
    const url = new URL('./font-metrics.json', import.meta.url);
    const res = await fetch(url);
    if (res.ok) METRICS = await res.json();
  } catch { /* offline / not generated yet → approx preview */ }
  return METRICS;
}

// Host metrics for a font (height/baseline/ascii/cjk/sample box), or null.
export const metricsFor = (name) => (METRICS && METRICS.fonts[name]) || null;

// Atlas crop for a font's host-rendered sample, or null if not introspected.
// Returns {atlas, x, y, w, h} where atlas is the PNG URL.
export function sampleImage(name) {
  const m = metricsFor(name);
  if (!METRICS || !m || !m.box) return null;
  const [x, y, w, h] = m.box;
  return { atlas: new URL('./' + METRICS.atlas, import.meta.url).href, x, y, w, h };
}

// Height buckets (rendered px height, the most useful filter for fitting a font
// to a screen). Matched against the host-introspected height; ignored until the
// metrics are loaded. min/max inclusive.
export const HEIGHT_BUCKETS = [
  { key: 'xs', label: '≤10', max: 10 },
  { key: 's', label: '11–16', min: 11, max: 16 },
  { key: 'm', label: '17–24', min: 17, max: 24 },
  { key: 'l', label: '25–36', min: 25, max: 36 },
  { key: 'xl', label: '37+', min: 37 },
];

// Rendered px height of a font from the host metrics, or null if not loaded.
export const heightOf = (name) => { const m = metricsFor(name); return m ? m.height : null; };

export const isCjkScript = (s) => !!s && s !== 'latin'; // ja/cn/tw/ko

// Content classification used as the primary "what's in it" facet. CJK fonts use
// their language (ja/cn/tw/ko, name-derived); Latin-script fonts split into
// digit-only (e.g. the 7-segment Font7/Font8) vs Latin (has letters — nearly all
// of these also carry Latin-1 accents). Falls back to 'latin' until metrics load.
export const CONTENT_TYPES = ['latin', 'digits', 'ja', 'cn', 'tw', 'ko'];
export function contentOf(f) {
  if (!f) return 'latin';
  if (isCjkScript(f.script)) return f.script;
  const m = metricsFor(f.name);
  if (m && !m.letters && m.digits) return 'digits';
  return 'latin';
}

// Fixed-pitch (true) / proportional (false) / unknown (null) from introspection.
export const monoFor = (name) => {
  const m = metricsFor(name);
  return m && typeof m.mono === 'boolean' ? m.mono : null;
};

// Distinct values for the filter controls.
export function facets() {
  return { families: [...new Set(FONT_CATALOG.map((f) => f.family))].sort() };
}

// Filter the catalog. style ∈ 'regular'|'bold'|'italic'; height = a bucket key;
// content ∈ CONTENT_TYPES; mono ∈ 'fixed'|'prop'. All optional. height/content/
// mono need host metrics and are ignored for a font until those have loaded.
export function filterCatalog({ family, style, query, height, content, mono } = {}) {
  const q = (query || '').toLowerCase();
  const bucket = height && HEIGHT_BUCKETS.find((b) => b.key === height);
  return FONT_CATALOG.filter((f) => {
    if (family && f.family !== family) return false;
    if (style === 'bold' && !f.bold) return false;
    if (style === 'italic' && !f.italic) return false;
    if (style === 'regular' && (f.bold || f.italic)) return false;
    if (q && !f.name.toLowerCase().includes(q)) return false;
    if (content && contentOf(f) !== content) return false;
    if (mono) { const mo = monoFor(f.name); if (mo != null && mo !== (mono === 'fixed')) return false; }
    if (bucket) {
      const h = heightOf(f.name); // null until metrics load → don't filter yet
      if (h != null && ((bucket.min && h < bucket.min) || (bucket.max && h > bucket.max))) return false;
    }
    return true;
  });
}

export const fontByName = (name) => FONT_CATALOG.find((f) => f.name === name) || null;

// External font-catalog site (LGFXFontCatalog, GitHub Pages). Per-font detail page
// is `${FONT_SITE_BASE}/fonts/<name>.html` — name only, latest fixed (SPEC §8.7 link
// contract). Set to '' to hide the "detail" links everywhere.
export const FONT_SITE_BASE = 'https://tanakamasayuki.github.io/LGFXFontCatalog';
export const fontDetailUrl = (name) =>
  FONT_SITE_BASE && name ? `${FONT_SITE_BASE}/fonts/${encodeURIComponent(name)}.html` : null;

// LovyanGFX font family -> a CSS font stack that resembles it for the preview
// (SPEC §8.7.3: approximate, never the embedded glyphs). The distinctive Latin
// display faces (Orbitron / Satisfy / Yellowtail / Roboto) are loaded via Google
// Fonts in index.html; the metric-compatible ones (Free*) and the CJK families
// resolve to comparable system fonts. Each stack ends in a generic so it still
// degrades sensibly offline or when a font is missing.
const FAMILY_CSS = {
  FreeSans: '"Arimo","Liberation Sans",Arial,"Helvetica Neue",sans-serif',
  FreeSerif: '"Tinos","Liberation Serif",Georgia,"Times New Roman",serif',
  FreeMono: '"Cousine","Liberation Mono",ui-monospace,Menlo,Consolas,monospace',
  DejaVu: '"DejaVu Sans","Bitstream Vera Sans","Noto Sans",Verdana,sans-serif',
  Roboto_Thin: '"Roboto","Noto Sans",system-ui,sans-serif',
  Orbitron_Light: '"Orbitron","Eurostile","Arial Narrow",sans-serif',
  Satisfy: '"Satisfy","Segoe Script","Brush Script MT",cursive',
  Yellowtail: '"Yellowtail","Segoe Script","Brush Script MT",cursive',
  lgfxJapanGothic: '"M PLUS 1p","Hiragino Sans","Noto Sans JP","Yu Gothic",sans-serif',
  lgfxJapanGothicP: '"M PLUS 1p","Hiragino Sans","Noto Sans JP","Yu Gothic",sans-serif',
  lgfxJapanMincho: '"Noto Serif JP","Hiragino Mincho ProN","Yu Mincho",serif',
  lgfxJapanMinchoP: '"Noto Serif JP","Hiragino Mincho ProN","Yu Mincho",serif',
  efontJA: '"Noto Sans JP","Hiragino Sans","Yu Gothic",sans-serif',
  efontCN: '"Noto Sans SC","PingFang SC","Microsoft YaHei",sans-serif',
  efontTW: '"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif',
  efontKR: '"Noto Sans KR","Apple SD Gothic Neo","Malgun Gothic",sans-serif',
};

// Approximate CSS font-family that resembles the preset's family (then category).
export function approxCss(f) {
  if (!f) return 'system-ui,sans-serif';
  const mapped = FAMILY_CSS[f.family];
  if (mapped) return mapped;
  // Unmapped family (bitmap Font0/AsciiFont, TomThumb, …): fall back by script/category.
  if (isCjkScript(f.script)) {
    if (f.script === 'ko') return '"Noto Sans KR","Apple SD Gothic Neo","Malgun Gothic",sans-serif';
    return '"Hiragino Sans","Noto Sans JP","Yu Gothic","Noto Sans SC",sans-serif';
  }
  const fam = (f.family || '').toLowerCase();
  if (f.category === 'bitmap' || /mono|tomthumb/.test(fam)) return 'ui-monospace,Menlo,Consolas,monospace';
  if (/serif/.test(fam)) return 'Georgia,"Times New Roman",serif';
  return 'system-ui,Arial,sans-serif';
}

// Approximate font-weight for the preview: bold faces -> 700; the "Thin" display
// family renders lighter (Roboto ships a 100 weight); otherwise normal.
export function approxWeight(f) {
  if (!f) return '';
  if (f.bold) return '700';
  if (f.family === 'Roboto_Thin') return '100';
  return '';
}

// A representative sample string for a font (script-appropriate for CJK).
// Kept in sync with gen.py sample_for: CJK appends "ABC123" since those fonts
// also carry ASCII and the latin glyphs are otherwise invisible in the preview.
export const sampleFor = (f) => {
  if (!f || !isCjkScript(f.script)) return 'AaBbGg 0123';
  const word = { ja: '日本語', cn: '简体中文', tw: '繁體中文', ko: '한국어' }[f.script] || '日本語';
  return `${word} ABC123`;
};

// Human-readable byte size (e.g. 159287 -> "156 KB").
export function fmtBytes(n) {
  if (!n && n !== 0) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

// Per-font flash cost in bytes from the host introspection (or null).
export const flashFor = (name) => {
  const m = metricsFor(name);
  return m && typeof m.flash === 'number' ? m.flash : null;
};

// Short human label of a font's classification (+ flash size when introspected).
// Prefers the host-rendered px height (what the Height filter matches) over the
// name-derived nominal size; falls back to the nominal size until metrics load.
export function describe(f) {
  if (!f) return '';
  const bits = [f.category];
  const h = heightOf(f.name);
  if (h != null) bits.push(`${h}px`);
  else if (f.size) bits.push(`${f.size}${f.unit || ''}`);
  if (f.bold) bits.push('Bold');
  if (f.italic) bits.push('Italic');
  if (isCjkScript(f.script)) bits.push(f.script.toUpperCase());
  const flash = flashFor(f.name);
  if (flash != null) bits.push(fmtBytes(flash));
  return bits.join(' · ');
}
