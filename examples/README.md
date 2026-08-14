# Examples

> 日本語: [README.ja.md](README.ja.md)

Every example ships the same generated `MyScreen.h`, produced from
[`fixtures/sample.lgfxsb.json`](../fixtures/sample.lgfxsb.json) by
`node tools/gen-fixtures.mjs`, so all of them stay in lockstep with the current
codegen. What differs is the **sketch** — each one isolates a single idea.

## Read them in this order

| # | Example | Target | What it shows |
| --- | --- | --- | --- |
| 1 | [BasicM5Unified](BasicM5Unified/) | M5Unified | The smallest thing that works: `begin()` + `show()`. **Direct drawing** (see note below). |
| 1' | [BasicLovyanGFX](BasicLovyanGFX/) | LovyanGFX | Same sketch for a bare LovyanGFX device (`LGFX_AUTODETECT` + `display.init()`). |
| 2 | [ProfilesM5Unified](ProfilesM5Unified/) | M5Unified | **One binary, several devices.** `Profile::Auto` plus button-A cycling through forced profiles. |
| 3 | [OverlayM5Unified](OverlayM5Unified/) | M5Unified | **Dynamic drawing**: a live battery bar composited into the same buffer as the static parts. |
| 4 | [DialogM5Unified](DialogM5Unified/) | M5Unified | **Transparent scene**: a dialog pushed over the running screen without repainting it. |
| 5 | [MemoryTuningM5Unified](MemoryTuningM5Unified/) | M5Unified | **RAM vs. splits**: derive from `Screen` to reach the tile budget, and watch the tile count move. |
| — | [ExportedSample](ExportedSample/) | M5Unified | The **verbatim Export output** (header *and* sketch). A scene tour; press A for the next screen. |

`ExportedSample` is what the authoring tool actually hands you, so it is a
reference for the generated shape rather than a lesson. The other sketches are
hand-written and call only the stable public API (`begin` / `show` / `setProfile`
/ `setOverlay`).

## Two things that trip people up

**Direct vs. buffered drawing is decided by an include, not a setting.**
If `<LGFXVirtualCanvas.h>` is included **before** the generated header you get
tiled double buffering; otherwise you get direct drawing, which flickers on
repeated updates. Get the order wrong and there is no error — just silent direct
drawing. Check it at runtime:

```cpp
Serial.printf("buffered: %d\n", (int)screen.isBuffered());
```

The `Basic*` sketches are deliberately left in direct mode to stay minimal; the
other three include LGFXVirtualCanvas behind an `#if __has_include` guard so they
still build without it.

**An overlay callback runs once per tile.** In buffered mode your `setOverlay()`
function is invoked for every tile of the frame, so it must be idempotent — read
state, never advance it. `OverlayM5Unified` shows the pattern.

Both are explained from first principles in
[docs/BEGINNERS_GUIDE.md](../docs/BEGINNERS_GUIDE.md).

## Building

Each directory carries a self-contained `sketch.yaml` that pins its platform and
libraries, so no board-manager setup is needed:

```sh
arduino-cli compile --profile esp32        examples/OverlayM5Unified   # real device
arduino-cli compile --profile display_core examples/OverlayM5Unified   # host (SDL) backend
```

CI compiles every example against both profiles. The `display_*` profiles run on
the [lang-ship host core](https://tanakamasayuki.github.io/lang-ship-arduino-core/),
which is also what produces the
[screenshot gallery](https://tanakamasayuki.github.io/LGFXScreenBuilderScreenshotTest/).

## Making them your own

These sketches are wired to the sample project. To use your own screens, design
them at <https://tanakamasayuki.github.io/LGFXScreenBuilder/>, export `MyScreen.h`
next to the `.ino`, and adjust the scene and field names — the compiler will point
at every place that needs updating, because the generated API only knows *your*
scenes and profiles. See [docs/AUTHORING_TUTORIAL.md](../docs/AUTHORING_TUTORIAL.md).
