# build_font_formats

Device-side coverage for every output format a generated font can use (SPEC §8.7.7):
**u8g2**, **GFXfont**, **BFF** (2bpp and 4bpp) and **VLW** (8bpp), all in one scene so the
renderer has to switch between a flash-resident font and a run-time one on consecutive
parts.

```
node tests/build_font_formats/gen.mjs   # writes FormatsScreen.h (not committed)
uv run pytest build_font_formats
```

`gen.mjs` takes the glyphs from `lgfxJapanGothic_16`, which LovyanGFX already ships, and
encodes them four ways with the same library the editor uses — so this needs no browser and
no network. That font is 1bpp, so for the anti-aliased formats the glyphs are box-filtered
first: without that step the encoders would faithfully round-trip a binary image and the
test would prove the plumbing but not the anti-aliasing. The result is deliberately blurry.
It is a fixture for coverage handling, not a specimen of type quality.

## What it actually catches

- **A run-time font that did not load.** BFF and VLW hold no glyph tables until
  `Screen::begin()` calls `detail::initRuntimeFonts()`. The renderer falls back to the
  default face in that state (`usableFont()` in `Renderer.h`), so the text still draws —
  which means ink alone proves nothing. The shade counts are what separate "BFF loaded"
  from "BFF quietly fell back to a 1bpp font".
- **A dark halo around anti-aliased glyphs.** A Text is drawn with the one-argument
  `setTextColor()`, which leaves `back_rgb888 == fore_rgb888`; LovyanGFX then blends
  partial coverage toward `getBaseColor()`, which defaults to black. On this deliberately
  non-black background, dropping `setBaseColor()` from `Renderer.h` takes bff4's minimum
  green from 10 to 8.

Only the bff4 row can fail that last check, and both reasons matter before anyone tries to
strengthen it. VLW reads the framebuffer back and blends against the real pixels whenever
the panel is readable — the host backend is, so VLW is immune here and only needs the base
colour on the unreadable SPI panels this test cannot emulate. And 2bpp's lowest non-zero
coverage is already 1/3, too strong to dip below the background.
