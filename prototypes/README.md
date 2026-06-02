# prototypes — throwaway UX probes

> 日本語: [README.ja.md](README.ja.md)

For validating interaction feel only. **One interaction = one HTML file**, no shared framework, minimal, and **meant to be discarded**.
Code here is never moved into the production tool (`tools/authoring/`). Kept separate from the published `docs/`.

Local preview:

```sh
python -m http.server 8001 --directory prototypes
# http://localhost:8001/            <- index.html (link list)
# http://localhost:8001/<name>.html
```

**Lifecycle:** once the production tool (`tools/authoring/`) covers a screen, delete that screen's probe — prune per screen, not all at once.

| File | Validates |
|---|---|
| profiles.html | Profiles screen: profile list/add, orientation & size view, board assignment, default flag |
| design.html | Design: profile switching = directly edit each profile's independent layout (no override concept; add profiles in the Profiles screen) |
| asset-slice.html | Assets: slice a sheet image (drag to create rects, move/resize, name, grid auto-generate) — post-MVP |
| assets.html | Assets full flow: import image (real files OK) → list → select → slice inline |
| export.html | Export: preview generated files (ui_generated.h / ui_assets.h / Basic.ino), output settings, checks |
