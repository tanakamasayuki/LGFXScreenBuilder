# prototypes — throwaway UX probes

> 日本語: [README.ja.md](README.ja.md)

For validating interaction feel only. **One interaction = one HTML file**, no shared framework, minimal, and **meant to be discarded**.
Code here is never promoted to the production tool in `docs/`; these probes stay throwaway.

Local preview:

```sh
python -m http.server 8001 --directory prototypes
# http://localhost:8001/            <- index.html (link list)
# http://localhost:8001/<name>.html
```

**Lifecycle:** once the production tool (`docs/`) covers a screen, delete that screen's probe — prune per screen, not all at once.

| File | Validates |
|---|---|
| profiles.html | Profiles screen: profile list/add, orientation & size view, board assignment, default flag |
| design.html | Design: two axes — scenes (left pane) × profiles (top tabs); each profile holds an independent layout per scene (no override concept; add profiles in the Profiles screen) |
| assets.html | Assets full flow: import image (real files OK) → list → select → slice inline (slicing is post-MVP) |
| export.html | Export: preview generated files (ui_generated.h / ui_assets.h / Basic.ino), output settings, checks |
