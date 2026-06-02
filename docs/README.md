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
  deselect.
- Profiles / Assets / Export modes, project save/load (`.lgfxsb.json`), and code
  generation (`<Project>.h`) are not wired up yet.

## Layout

- `index.html` — app shell (mode rail + 3-pane layout)
- `styles.css`
- `src/model.js` — project data model + sample project + helpers
- `src/store.js` — reactive store (project + editor UI state)
- `src/design.js` — Design mode (render + interactions)
- `src/main.js` — bootstrap

The validated throwaway probes live in `../prototypes/`; this directory is the
production rebuild that replaced the earlier single-file mock and is served by
GitHub Pages.
