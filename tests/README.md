# Tests

This directory contains the project-specific pytest/Arduino CLI test suite.

The initial tests are intentionally small:

- build the library against the `lang-ship:host` LovyanGFX backend;
- render a generated scene-shaped data object;
- save a host-side PNG through `LovyanGFX::createPng()`.

`build_lovyangfx/` and `codegen_roundtrip/` build and render in **direct** mode;
`build_buffered/` covers the **tiled double-buffer** path (SPEC §10) by including
`<LGFXVirtualCanvas.h>` before `<LGFXScreenBuilder.h>` — it asserts `isBuffered()`
is true and that the tiled+overlay frame is non-blank. That test pulls
`LGFXVirtualCanvas` from the Arduino library index (pinned in its `sketch.yaml`).

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

## Regenerating generated headers

Committed `MyScreen.h` files are generated from stored project files
(`*.lgfxsb.json`, the authoring tool's save format) through the **production**
codegen, so an output-format change propagates with one command instead of
hand-editing each header:

```sh
node tools/gen-fixtures.mjs --write    # regenerate in place
node tools/gen-fixtures.mjs --check    # exit 1 if any header is stale (CI / pre-commit guard)
```

Source of truth: `fixtures/sample.lgfxsb.json` drives both `examples/*/MyScreen.h`
(the header is framework-agnostic). The `.ino` files are hand-written/curated and
call only the stable public API, so they are not generated. `tests/build_lovyangfx/MyScreen.h`
is hand-written on purpose (it previews a nested-group facade the codegen cannot
emit yet) and is exempt. `tests/codegen_roundtrip/MyScreen.h` is generated from
`tests/codegen_roundtrip/codegen_roundtrip.lgfxsb.json`; its `gen.mjs` is now a
thin shim over this tool, invoked at pytest collection. CI runs `--check` on the
pristine checkout so committed headers cannot silently drift from the codegen.

Project files (`*.lgfxsb.json`) are kept in canonical serializer form, checked
separately (SPEC §9.2). A diff means the project-file format moved (independent of
codegen changes):

```sh
node tools/check-formats.mjs --write    # re-serialize (normalize) in place
node tools/check-formats.mjs --check    # exit 1 if any project file is non-canonical (CI guard)
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
