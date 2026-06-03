# Tests

This directory contains the project-specific pytest/Arduino CLI test suite.

The initial tests are intentionally small:

- build the library against the `lang-ship:host` LovyanGFX backend;
- render a generated scene-shaped data object;
- save a host-side PNG through `LovyanGFX::createPng()`.

As the runtime and generator mature, add snapshot and pixel-diff tests here, following the same pattern used by `LGFXVirtualCanvas`.

`font_introspect/` is a generator step rather than a pass/fail check: `gen.py`
resolves the pinned LovyanGFX (from `../tools/fontgen/sketch.yaml`), emits a C++
table of every preset font, and the harness introspects each one on the host
(metrics + ASCII/CJK coverage + a native-size sample). The test then packs the
samples into one atlas and writes the browser-consumable catalog
(`../docs/src/font-metrics.json` + `font-atlas.png`). Re-run it after bumping the
font library (SPEC §8.7.2).

## Requirements

- `uv` + Arduino CLI (the `lang-ship:host` platform is fetched automatically).
- **Node.js** — the `codegen_roundtrip` test regenerates `MyScreen.h` from the
  authoring tool's codegen (`docs/src/`) via `node` before building, so `node`
  must be on `PATH`.

## Run

```sh
uv run pytest -v
```
