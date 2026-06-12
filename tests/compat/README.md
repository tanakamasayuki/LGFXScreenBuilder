# compat — frozen format-version goldens

> 日本語: [README.ja.md](README.ja.md)

Backward-compatibility goldens for the project-file format (SPEC §9.2, Layer 3).
Each `vN/` directory pins a project file **frozen at format version N** together
with everything needed to detect a format/output/render change against it.

These goldens are **not** auto-regenerated (unlike the live fixtures driven by
`tools/gen-fixtures.mjs`). A diff is a deliberate signal, not a routine update.

## What's in `v1/`

`v1` is frozen from the initial release. The reference project exercises the full
v1 format on purpose, so the goldens catch a change to any of it:

- every part type — Rect (filled + outlined/rounded), Line, Circle (filled +
  outlined), Text, Image;
- an adopted preset font (`FreeSans12pt7b`), enabled per profile and used by a Text;
- an image asset (RGB565 + `AssetDesc` + `pushImage`);
- three profiles including a rotated one (`CoreRot`, rotation 1) and a portrait one;
- datum variety (incl. `MC` → `Datum::MidCenter`) and per-profile design text.

| File | Role |
| --- | --- |
| `CompatV1.lgfxsb.json` | the frozen v1 project (the durable input contract) |
| `CompatV1.h` | the header the v1-era codegen produced from it (text golden) |
| `v1.ino` + `sketch.yaml` | host capture: renders every profile × scene to PNG |
| `render/*.png` | frozen render goldens (`<profile>_<scene>.png`, upright/rotated) |
| `test_compat_v1.py` | builds the capture on host and pixel-compares vs `render/` |

## The two oracles

1. **Header text golden** — `node tools/check-compat.mjs` loads the frozen
   project, migrates it, regenerates the header with the *current* codegen, and
   compares to the frozen `.h`. Fast, runs in the Node-guard CI step.
2. **Render pixel golden** — `test_compat_v1.py` builds `v1.ino` on the pinned
   `lang-ship:host` LovyanGFX backend and pixel-compares each capture to
   `render/`. A matching `.h` does not prove the *pixels* are unchanged, so this
   is the final oracle. The engine is pinned in `sketch.yaml`.

## When a golden diffs

Decide which case you're in:

- **Cosmetic / still-compatible codegen change** → refreeze.
  - header: `node tools/check-compat.mjs --write`
  - render: delete the listed `render/*.png` and rerun pytest (it re-bootstraps).
- **The project-file format changed semantically** → bump `FORMAT_VERSION`
  (`docs/src/version.js`), add the `v(N)→v(N+1)` migration in `migrate()`, keep
  this `vN/` as the reference, and freeze a new `v(N+1)/` snapshot.
- **An unintended regression** → fix the cause.

`tools/check-formats.mjs` skips this directory: the frozen projects are pinned to
a past format and must not be re-serialized to the current one.
