# build_fontgen

Device-side check for **generated embedded fonts** (SPEC §8.7.7).

The rest of the font-generator test coverage runs off-device:

- `tests/fontgen/u8g2_roundtrip.mjs` — the encoder against a mirror of LovyanGFX's
  own decoder (itself validated against a real bundled font).
- `tests/fontgen/page_smoke.mjs` / `editor_integration.mjs` — the browser pipeline
  and the editor's recipe-and-rebuild flow.

This one closes the loop: the emitted header has to compile, link, and actually
draw on real LovyanGFX — at the line height that was asked for, with `℃` present.

## The committed font

`TestPanelFont.h` is a generated artifact, not hand-written:

- typeface **Roboto** (Apache-2.0, Google Fonts)
- **16px line height**
- presets **ASCII + units + clock**

Regenerate it from <https://tanakamasayuki.github.io/LGFXScreenBuilder/fontgen.html>
(or a local `docs/fontgen.html`) with those settings and the font name
`TestPanelFont`, then replace the file. Keeping it committed means the test does
not need a browser, and a change in encoder output shows up as a diff.

## Running

```sh
cd tests
uv run pytest build_fontgen -v
```
