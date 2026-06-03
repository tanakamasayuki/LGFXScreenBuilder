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

// Distinct values for the filter controls.
export function facets() {
  const c = FONT_CATALOG;
  return {
    categories: [...new Set(c.map((f) => f.category))].sort(),
    families: [...new Set(c.map((f) => f.family))].sort(),
    scripts: [...new Set(c.map((f) => f.script))].sort(),
  };
}

// Filter the catalog. style ∈ 'regular'|'bold'|'italic' (optional).
export function filterCatalog({ category, family, script, style, query } = {}) {
  const q = (query || '').toLowerCase();
  return FONT_CATALOG.filter((f) => {
    if (category && f.category !== category) return false;
    if (family && f.family !== family) return false;
    if (script && f.script !== script) return false;
    if (style === 'bold' && !f.bold) return false;
    if (style === 'italic' && !f.italic) return false;
    if (style === 'regular' && (f.bold || f.italic)) return false;
    if (q && !f.name.toLowerCase().includes(q)) return false;
    return true;
  });
}

export const fontByName = (name) => FONT_CATALOG.find((f) => f.name === name) || null;

// Approximate CSS font-family that resembles the preset's family/category.
export function approxCss(f) {
  if (!f) return 'system-ui,sans-serif';
  if (f.script === 'cjk') return '"Hiragino Sans","Noto Sans JP","Yu Gothic",system-ui,sans-serif';
  const fam = f.family.toLowerCase();
  if (f.category === 'bitmap' || /mono|tomthumb/.test(fam)) return 'ui-monospace,Menlo,Consolas,monospace';
  if (/serif/.test(fam)) return 'Georgia,"Times New Roman",serif';
  if (/satisfy|yellowtail/.test(fam)) return '"Segoe Script","Brush Script MT",cursive';
  return 'system-ui,Arial,sans-serif';
}

// A representative sample string for a font (Japanese for CJK fonts).
export const sampleFor = (f) => (f && f.script === 'cjk' ? 'あいう 漢字 12' : 'AaBbGg 0123');

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

// Fixed-pitch (true) / proportional (false) / unknown (null) from introspection.
export const monoFor = (name) => {
  const m = metricsFor(name);
  return m && typeof m.mono === 'boolean' ? m.mono : null;
};

// Short human label of a font's classification (+ flash size when introspected).
export function describe(f) {
  if (!f) return '';
  const bits = [f.category];
  if (f.size) bits.push(`${f.size}${f.unit || ''}`);
  if (f.bold) bits.push('Bold');
  if (f.italic) bits.push('Italic');
  if (f.script === 'cjk') bits.push('CJK');
  const flash = flashFor(f.name);
  if (flash != null) bits.push(fmtBytes(flash));
  return bits.join(' · ');
}
