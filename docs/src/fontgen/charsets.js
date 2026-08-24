// LGFXFontToolJs owns the character-set vocabulary and resolution rules.
// This file is only the local import boundary used by the editor UI.
export {
  ALL_SET_IDS, AXES, TEMPLATES, codepointsOfSet, countOf, parseRanges,
  resolveCharset, splitBmp, templateById, tierSiblings, toggleSet,
} from 'lgfx-font-tool';

export { codepointsOf } from 'lgfx-font-tool';

import { ALL_SET_IDS } from 'lgfx-font-tool';

// Old project files may contain the small set of ids used before the library
// became authoritative. Map those once; all other unknown ids are dropped.
const LEGACY = {
  ascii: ['ascii'], latin1: ['ascii', 'latinExt'], digits: ['digits'],
  units: ['symUnits', 'symMath', 'symArrows', 'symShapes'],
  clock: ['digits', 'jaPunct'], kana: ['hiragana', 'katakana', 'jaPunct'],
  jaMini: ['ascii', 'hiragana', 'katakana', 'jaPunct', 'hanJa1'],
  ja: ['ascii', 'latinExt', 'hiragana', 'katakana', 'jaPunct', 'hanJa4'],
  cjk: ['ascii', 'hanAll'], cn: ['ascii', 'hanCn2'], tw: ['ascii', 'hanTw2'],
  kr: ['ascii', 'hanKo2', 'hangulKs'],
};
export function migrateSets(sets = []) {
  const known = new Set(ALL_SET_IDS);
  const expanded = sets.flatMap((id) => known.has(id) ? [id] : (LEGACY[id] || []));
  // The library's tier ladders are cumulative, so keeping only the highest
  // selected tier is the exact union of older lower-tier selections.
  const out = [...new Set(expanded)];
  for (const prefix of ['hanJa', 'hanCn', 'hanTw', 'hanKo']) {
    const tiers = out.filter((id) => id.startsWith(prefix));
    if (tiers.length > 1) {
      const keep = tiers.sort().at(-1);
      for (let i = out.length - 1; i >= 0; i--) if (out[i].startsWith(prefix) && out[i] !== keep) out.splice(i, 1);
    }
  }
  return out;
}
