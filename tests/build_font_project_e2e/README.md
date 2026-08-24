# build_font_project_e2e

Full generated-font integration test:

1. `tests/fontgen/editor_integration.mjs` runs the real browser editor.
2. LGFXFontToolJs generates a Roboto font with a Noto Sans JP fallback.
3. The editor assigns it to a Text part and exports the complete project header
   as `GeneratedScreen.h`.
4. This sketch compiles that exact header and renders it through
   `LGFXScreenBuilder::Screen` on the LovyanGFX host backend.
5. Pytest checks metrics, ink, the fallback-sourced `℃`, missing-glyph behavior,
   narrow glyphs, and a PNG capture.

The generated header is intentionally ignored by git. CI creates it before the
pytest phase. For a local full run:

```sh
LGFX_FONT_TOOL_E2E_HEADER=tests/build_font_project_e2e/GeneratedScreen.h \
  PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs \
  node tests/fontgen/editor_integration.mjs
cd tests
LGFX_FONT_TOOL_E2E=1 uv run pytest build_font_project_e2e -v
```
