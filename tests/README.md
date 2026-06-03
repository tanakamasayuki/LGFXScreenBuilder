# Tests

This directory contains the project-specific pytest/Arduino CLI test suite.

The initial tests are intentionally small:

- build the library against the `lang-ship:host` LovyanGFX backend;
- render a generated scene-shaped data object;
- save a host-side PNG through `LovyanGFX::createPng()`.

As the runtime and generator mature, add snapshot and pixel-diff tests here, following the same pattern used by `LGFXVirtualCanvas`.

`manual/` holds generators that are **not** part of the default suite — they
produce committed artifacts and need a host build, so they are excluded from the
directory scan (their files have no `test_` prefix) and run only by explicit path.

`manual/font_introspect/` regenerates the preset-font catalog: `gen.py` resolves
the pinned LovyanGFX (from `../tools/fontgen/sketch.yaml`), emits a C++ table of
every preset font, and the harness introspects each one on the host (metrics +
ASCII/CJK coverage + fixed-pitch flag + a native-size sample + exact flash size).
It packs the samples into one atlas and writes the browser-consumable catalog
(`../docs/src/font-catalog.js`, `font-metrics.json`, `font-atlas.png`). Run it by
hand after bumping the font library (SPEC §8.7.2):

```sh
uv run pytest manual/font_introspect/font_introspect.py
```

## Requirements

- `uv` + Arduino CLI (the `lang-ship:host` platform is fetched automatically).
- **Node.js** — the `codegen_roundtrip` test regenerates `MyScreen.h` from the
  authoring tool's codegen (`docs/src/`) via `node` before building, so `node`
  must be on `PATH`.

## Run

```sh
uv run pytest -v
```
