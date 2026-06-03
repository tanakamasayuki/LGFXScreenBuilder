# Authoring Tool

> 日本語: [README.ja.md](README.ja.md)

The production browser authoring tool. Static ES modules, **no build step** — open
`index.html` over any static server. This directory (`docs/`) is what GitHub Pages
serves, so the tool *is* the published site.

```sh
python -m http.server 8000 --directory docs
# http://localhost:8000/
```

## Status (MVP foundation)

- **Design** mode is implemented: two axes — scenes (left pane) × profiles (top
  tabs); each profile holds an independent layout per scene (SPEC §8.9.6). Canvas
  rendering (Rect / Text with datum / Image placeholder), layer list, inspector,
  drag-move, arrow-key nudge/resize (§8.14), zoom, and scene-level properties on
  deselect. Scenes and parts can be added/deleted/renamed; adding or removing a
  part/scene updates every profile's layout in lockstep (§8.9.6). Layer panel is a
  tree (front-on-top): reorder among siblings (↑/↓), group/ungroup, and drag-drop
  reparenting (onto a group = nest, onto a part = sibling, empty = root) — all
  with absolute position preserved; cascade delete of groups (§8.3.1).
- **Profiles** mode (SPEC §8.9): target-library bar, profile list with add
  (by resolution / custom, cloning the current layout), size/rotation/note +
  rename/delete, board assignment (click-to-toggle, one board per profile),
  orientation/size preview, and a validation banner (size mismatch, boards not
  auto-detectable on LovyanGFX). The fallback profile is chosen at export, not
  here. Board assignments are emitted as per-profile `board_t` tables so
  `Profile::Auto` resolves via `getBoard()` at runtime (boards not present in the
  target library's `board_t` are omitted; §8.9.5).
- **i18n** (SPEC §14): all UI strings go through `src/i18n.js` (`t()` + `data-i18n`),
  en/ja with an en fallback and a language switcher; default follows the browser.
- **Project persistence** (`src/persist.js`, SPEC §9): New / Open / Save toolbar
  (`.lgfxsb.json`) plus localStorage autosave + restore-on-start.
- **Code generation** (`src/codegen.js`): "Export .h" downloads `<Project>.h` (the
  §11 facade + descriptor); verified end-to-end by `tests/codegen_roundtrip`.
- Profiles / Assets / Export *screens* (a full Export view, asset import, etc.) are
  not built yet — header export is currently a toolbar button.

## Layout

- `index.html` — app shell (mode rail + 3-pane layout)
- `styles.css`
- `src/model.js` — project data model + sample project + mutations/helpers
- `src/boards.js` — board catalog (M5GFX board_t) + target-library helpers
- `src/profiles.js` — Profiles mode (define profiles + board assignment)
- `src/store.js` — reactive store (project + editor UI state) + loadProject
- `src/i18n.js` — translations (en/ja) + `t()` + static-markup applier
- `src/persist.js` — save/open `.lgfxsb.json` + localStorage autosave
- `src/codegen.js` — project model → `<Project>.h`
- `src/design.js` — Design mode (render + interactions)
- `src/main.js` — bootstrap

The validated throwaway probes live in `../prototypes/`; this directory is the
production rebuild that replaced the earlier single-file mock and is served by
GitHub Pages.
