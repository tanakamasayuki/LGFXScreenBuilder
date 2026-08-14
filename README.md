# LGFXScreenBuilder

> 日本語: [README.ja.md](README.ja.md)

Design device screens in your browser, export generated Arduino C++, and draw them
from a small **typed** API — for [LovyanGFX](https://github.com/lovyan03/LovyanGFX),
[M5GFX](https://github.com/m5stack/M5GFX), and [M5Unified](https://github.com/m5stack/M5Unified).

LGFXScreenBuilder is **not** a GUI framework like LVGL. It separates *screen design*
from *application logic*: you lay out scenes, parts, fonts, and image assets in a
GitHub Pages authoring tool, export a header, and update the display by passing
values to generated structs. No string IDs, no widget tree, no web server.

- **Authoring tool:** <https://tanakamasayuki.github.io/LGFXScreenBuilder/>
- **Font generator** (standalone — works without this library, just downloads a `.h`):
  <https://tanakamasayuki.github.io/LGFXScreenBuilder/fontgen.html>
- **Live screenshot gallery** (every profile × scene, rendered on a host backend):
  <https://tanakamasayuki.github.io/LGFXScreenBuilderScreenshotTest/>

## How it works

```
 Browser authoring tool          Your Arduino sketch
 ────────────────────────        ───────────────────────────────
 design scenes / parts /         #include "MyScreen.h"
 fonts / images / profiles       screen.show(scene struct with live values)
        │  Export .h                       ▲
        └──────── MyScreen.h ──────────────┘
```

You design once for **multiple devices** (a *profile* per device/size). At runtime
`Profile::Auto` picks the right layout by screen size, so one binary fits a Core,
a StickC, a Cardputer, etc.

## Quick start (Arduino)

1. Install this library (Library Manager → *LGFXScreenBuilder*, or clone into your
   `libraries/` folder) plus your display library (M5Unified, M5GFX, or LovyanGFX).
2. Open the authoring tool, design your screens, and **Export .h** (e.g. `MyScreen.h`).
   Drop it next to your `.ino`.
3. Fill a scene struct with live values and draw it:

```cpp
#include <M5Unified.h>
#include <LGFXScreenBuilder.h>
#include "MyScreen.h"          // exported from the authoring tool

using namespace MyScreen;       // optional: omit Scene:: / Profile:: / Screen

static Screen screen(M5.Display);

void setup() {
  M5.begin();
  screen.begin();               // Profile::Auto resolves by screen size

  screen.show(Scene::Boot{});   // a screen with no live data

  Scene::Main main;             // fields are the parts you named in the editor
  main.title   = "Main";
  main.battery = "82%";
  main.temp    = "24.5C";
  screen.show(main);            // draw it
}

void loop() { M5.update(); }
```

Static parts (background rectangles, labels, images) live in the exported header;
your code only supplies the values that change. See [examples/](examples/).

## Features

- **One design, many devices.** A profile per device holds an independent layout of
  the same parts; `Profile::Auto` selects by screen size and profile order.
- **Parts:** rounded rectangles, lines, circles, single-line text (anchored by
  datum, scaled by multiplier), and PNG/JPEG image assets (decoded to RGB565).
- **Preset fonts, per profile.** Browse a catalog of LovyanGFX fonts (filter by
  rendered height, script, fixed/proportional, …), adopt a subset, and enable each
  font only on the profiles that need it — small screens stay within their flash
  budget (the tool shows the exact per-font flash cost).
- **Per-profile design text.** Each profile can carry its own placeholder string;
  your code overrides it at runtime via the scene struct.
- **AI layout I/O.** Copy a scene as self-contained JSON, hand it to an AI with
  [docs/AI_LAYOUT_IO.md](docs/AI_LAYOUT_IO.md), and paste the result back.
- **Dynamic overlay** (gauges, bars, waveforms) composited into the same buffer as
  the static parts — see [examples/OverlayM5Unified/](examples/OverlayM5Unified/).
- **Transparent scenes.** Mark a scene as an overlay and it is drawn on top of the
  screen already on the panel, with no background of its own — a dialog with rounded
  corners shows the running screen through them, and the screen below is never
  redrawn. See [examples/DialogM5Unified/](examples/DialogM5Unified/).
- **Buffered or direct drawing.** Tiled double-buffering via the optional
  `LGFXVirtualCanvas` library reduces flicker; drop it to draw directly (transparent
  scenes want `LGFXVirtualCanvas` 1.4.0 or newer when buffered).
- **Host screenshots.** Generated metadata lets a host backend render every
  profile × scene to PNG for regression testing — see the live gallery above.
- **Localized UI:** English, Japanese, Simplified/Traditional Chinese, Korean,
  Spanish, French, German.

## The generated API

The exported `MyScreen.h` defines a typed facade — no string IDs in normal use:

```cpp
screen.show(sceneId);                 // a scene by metadata index (preview/tour state)
screen.show(Scene::Main{...});        // a scene with live values (per-scene overload)
screen.setProfile(Profile::Core);     // force a profile (default: Profile::Auto)
screen.setOverlay(mainOverlay);       // optional dynamic drawing for one scene (§11.4)
```

Passing an unknown scene type is a compile error; the API only knows *this*
project's scenes and profiles.

## Examples

| Example | Target | Shows |
| --- | --- | --- |
| [BasicLovyanGFX](examples/BasicLovyanGFX/) | LovyanGFX | minimal `show()` on a bare LovyanGFX device |
| [BasicM5Unified](examples/BasicM5Unified/) | M5Unified | minimal `show()` on M5 hardware |
| [ExportedSample](examples/ExportedSample/) | M5Unified | verbatim Export output — a scene tour (button A advances) |
| [OverlayM5Unified](examples/OverlayM5Unified/) | M5Unified | a dynamic overlay (live battery bar) over static parts |
| [DialogM5Unified](examples/DialogM5Unified/) | M5Unified | a transparent scene: a dialog over a screen that is never redrawn |
| [ProfilesM5Unified](examples/ProfilesM5Unified/) | M5Unified | one binary, several devices: `Profile::Auto` plus forced profiles |
| [MemoryTuningM5Unified](examples/MemoryTuningM5Unified/) | M5Unified | tuning the tile memory budget by deriving from the generated `Screen` |

Every example regenerates its `MyScreen.h` from a stored project via
`tools/gen-fixtures.mjs`, so they always match the current codegen.
[examples/README.md](examples/README.md) suggests a reading order.

## Documentation

- [docs/AUTHORING_TUTORIAL.md](docs/AUTHORING_TUTORIAL.md) — **start here**: designing your first
  screen in the browser, from New to Export to running it on hardware
- [docs/BEGINNERS_GUIDE.md](docs/BEGINNERS_GUIDE.md) — **beginner's guide**: how drawing works,
  flicker and double buffering, DMA, the memory/speed trade-off, LovyanGFX and library quirks, strengths and limits
- [SPEC.md](SPEC.md) — full specification (Japanese: [SPEC.ja.md](SPEC.ja.md))
- [docs/COMPATIBILITY.md](docs/COMPATIBILITY.md) — version FAQ: what carries a version, and how to
  recover when an old header and a new runtime disagree
- [docs/AI_LAYOUT_IO.md](docs/AI_LAYOUT_IO.md) — the layout-JSON contract handed to an AI
- [docs/README.md](docs/README.md) — the authoring tool itself (developer notes)

## Tests

The authoring tool is plain ES modules (no build step). Repository guards run under
Node, and screen rendering is checked on the `lang-ship:host` LovyanGFX backend via
pytest and Arduino CLI:

```sh
# Node guards (generated headers / project format / AI block / i18n parity)
node tools/gen-fixtures.mjs --check
node tools/check-formats.mjs --check
node tools/check-ai-layout-embed.mjs
node tools/check-i18n.mjs

# Host rendering tests
cd tests && uv run pytest -v
```

## Local preview of the authoring tool

GitHub Pages serves the `docs/` directory on `main`. To preview locally:

```sh
python -m http.server 8000 --directory docs
# open http://localhost:8000/
```

## License & release

[MIT](LICENSE). Release automation lives in `.github/workflows/release.yml` and
`tools/bump_version.py`, shared with other Arduino libraries; the version is in
[library.properties](library.properties).
