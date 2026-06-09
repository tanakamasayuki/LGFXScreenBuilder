// Thin shim: regenerate this fixture's MyScreen.h via the shared, production
// codegen tool so pytest's `node gen.mjs` and `tools/gen-fixtures.mjs` are one
// codepath. Source of truth: codegen_roundtrip.lgfxsb.json (the authoring tool's
// save format), which exercises a rounded-outline Rect, an RGB565 image asset,
// and a preset font — see tools/gen-fixtures.mjs.
import { regenerate } from '../../tools/gen-fixtures.mjs';

const { written } = regenerate('write', 'codegen_roundtrip');
console.log(written.length ? `regenerated ${written.join(', ')}` : 'MyScreen.h already current');
