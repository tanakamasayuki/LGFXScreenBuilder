# Getting started with LGFXScreenBuilder — how drawing works, and the memory/speed trade-off

> 日本語: [BEGINNERS_GUIDE.ja.md](BEGINNERS_GUIDE.ja.md)

This guide is for people who want to put something on an M5Stack / ESP32 screen but do not
yet know *why* it flickers, *why* RAM runs out, or *what* DMA buys them.

It starts from **how the hardware actually paints pixels**, then covers flicker, double
buffering, the quirks of LovyanGFX / M5GFX, and finally what LGFXScreenBuilder takes care
of for you — and what it deliberately does **not** (its limits).

This is not an API reference. For that see [SPEC.md](../SPEC.md); for a usage summary see
[README.md](../README.md).

**Contents**

1. [How the screen actually lights up](#1-how-the-screen-actually-lights-up)
2. [Why it flickers](#2-why-it-flickers)
3. [Double buffering — and why it does not fit](#3-double-buffering--and-why-it-does-not-fit)
4. [Tiled double buffering and DMA](#4-tiled-double-buffering-and-dma)
5. [How this works in LGFXScreenBuilder](#5-how-this-works-in-lgfxscreenbuilder)
6. [The memory/speed trade-off table](#6-the-memoryspeed-trade-off-table)
7. [LovyanGFX / M5GFX quirks](#7-lovyangfx--m5gfx-quirks)
8. [This library's quirks](#8-this-librarys-quirks)
9. [Transparent scenes (dialogs)](#9-transparent-scenes-dialogs)
10. [Strengths and limits](#10-strengths-and-limits)
11. [Troubleshooting](#11-troubleshooting)

---

## 1. How the screen actually lights up

The biggest difference from desktop graphics: **the MCU does not hold the screen.**

The small LCDs attached to M5Stack / ESP32 boards are usually **panels with a built-in
controller** (ILI9341, ST7789, …). The panel itself contains pixel memory (GRAM), and its
display circuitry keeps reading that memory out to the glass. All the MCU does is:

> send over SPI (or an I80 parallel bus) **"write this run of pixels into this rectangle"**

The panel's GRAM changes the moment the bytes land, and the next refresh shows it.

```
  ESP32                          LCD panel
  ┌───────────────┐  SPI 40–80MHz  ┌────────────────────┐
  │  your code    │ ─────────────► │ controller         │
  │ lcd.fillRect()│  "at x,y,w,h,  │   ↓ write          │
  └───────────────┘   these pixels"│ GRAM (pixel memory)│
                                   │   ↓ scanned out    │
                                   │ LCD glass          │
                                   └────────────────────┘
```

Almost every property of embedded graphics follows from this.

- **You see it as you draw it.** `fillScreen()` then `drawString()` shows the user *both*
  the blanked screen and the screen with text. Nothing swaps whole frames for you.
- **Bytes transferred = time.** A 320×240 16-bit full screen is 320 × 240 × 2 =
  **153,600 bytes**. At 40 MHz SPI that is about **31 ms**; at 80 MHz about **15 ms**.
  So **as long as you redraw the whole screen, 40 MHz caps you at ~32 fps** — a floor no
  amount of drawing cleverness removes.
- **You generally cannot read the panel back** (unsupported or very slow on most setups).
  That is why "blend semi-transparently over what is already there" is hard.

### Colors are RGB565

Each pixel is 16 bits: 5 red / 6 green / 5 blue. A 24-bit color like `#4CAF50` is always
quantized to that grid. Banding in gradients is this, not a bug.

---

## 2. Why it flickers

A direct consequence of "you see it as you draw it". Write the obvious update loop:

```cpp
void loop() {
  lcd.fillScreen(TFT_BLACK);          // <- the screen visibly goes black
  lcd.drawString("Temp", 10, 10);     // <- text comes back
  lcd.drawString("24.5C", 10, 40);
  delay(100);
}
```

The eye sees ten **black blinks** per second. That is flicker: the *clear* half of
"clear, then draw" is on screen long enough to be seen.

Two naive fixes both hit a wall:

**(a) Don't clear — overwrite only what changed.** When `100` becomes `99`, the stale digit
stays. Paint a background rectangle first and that small rectangle flickers instead. The
bookkeeping of "what do I have to erase" collapses as parts multiply.

**(b) Only redraw when something changed.** Fewer flickers, but each one is still there,
and it is useless for animation or live values.

The real problem is that **the update is not atomic** — intermediate states are visible.
So build the intermediate state somewhere invisible.

---

## 3. Double buffering — and why it does not fit

The answer is clear: **keep a screen-sized buffer in RAM, draw into it, and blast the
finished image to the panel in one go.** The panel only ever shows finished frames, so
intermediate states cannot be seen by construction.

The problem is the price.

| Screen | Full-screen buffer (16-bit) |
| --- | --- |
| 128×128 (AtomS3) | 32 KB |
| 135×240 (StickC Plus) | 63 KB |
| 240×135 (Cardputer) | 63 KB |
| **320×240 (Core / Core2)** | **150 KB** |
| 320×480 (CoreS3 portrait) | 300 KB |
| 720×1280 (Tab5) | 1.8 MB |

Meanwhile an ESP32 has roughly 320 KB of internal DRAM, minus the WiFi/BLE stacks, heap
fragmentation, and your own buffers. **A 320×240 full-screen double buffer either does not
fit, or fits and leaves you room for nothing else.** (PSRAM boards have the capacity — but
PSRAM is slow and, as we will see, disables DMA.)

This is the central dilemma of embedded GUIs: **removing flicker needs a buffer, and there
is no RAM for one.**

---

## 4. Tiled double buffering and DMA

The compromise: don't keep a full-screen buffer. **Cut the screen into horizontal bands
(tiles), finish one band at a time, and send it.**
[LGFXVirtualCanvas](https://github.com/tanakamasayuki/LGFXVirtualCanvas) does exactly this.

```
   screen (virtual)              tile buffers in real RAM
  ┌─────────────┐  tile 0        ┌─────────────┐
  │   tile 0    │ ──draw──────►  │  ~19 KB × 2 │ ──DMA──► panel
  ├─────────────┤  tile 1        └─────────────┘
  │   tile 1    │ ──draw──────►     (reused)
  ├─────────────┤
  │     …       │
  └─────────────┘
```

At 320×240 one line is 320 × 2 = 640 bytes. With the default ~19 KB budget, 19456 / 640 ≈
**30 lines** per tile, i.e. **8 tiles**. RAM needed: 19 KB × 2 = **~38 KB** — a quarter of
150 KB.

### Your draw function still uses full-screen coordinates

Hand-rolled tiling is painful because the offset arithmetic infects every draw call.
LGFXVirtualCanvas instead lets you **write one draw function in full-screen coordinates and
runs it once per tile**, hiding the Y offset and the clipping.

```cpp
void drawScene(LGFXVirtualCanvas& g) {
  g.fillScreen(TFT_BLACK);
  g.fillCircle(160, 120, 40, TFT_YELLOW);   // plain full-screen coordinates
}
screen.render(drawScene);                    // called 8 times inside
```

**This is the single most important quirk.** Your draw function runs **once per tile**, so
8 times per frame. The `fillCircle` is simply clipped away on tiles it does not touch, so
the *picture* is right — but **any computation or sensor read inside the function happens
8 times** (see [section 8](#8-this-librarys-quirks)).

### Where DMA comes in

DMA (Direct Memory Access) is hardware that moves memory ↔ peripheral **without the CPU**.
When LovyanGFX pushes a sprite that lives in internal RAM, it starts an **asynchronous
SPI-DMA transfer and returns without waiting for it to finish**. The CPU is free immediately.

That is what makes the *second* tile buffer worth its RAM:

```
  time ───────────────────────────────────────────►
  CPU:  draw T0 │ draw T1 │ draw T2 │ draw T3 │ …
  DMA:          │ push T0 │ push T1 │ push T2 │ …
                 ↑ overlapped
```

While DMA pushes tile 0 out of one buffer, the CPU draws tile 1 into the other (ping-pong).
A frame therefore costs **≈ max(total drawing, total transfer)**.

With a single buffer you must `waitDMA()` before reusing it — otherwise you overwrite bytes
that are still in flight and corrupt the tile — so the cost becomes **drawing + transfer**.
This is why LGFXVirtualCanvas enables double buffering automatically on any surface that
splits into two or more tiles.

### PSRAM is "slow but roomy"

Putting tile buffers in PSRAM lets you use bigger tiles (fewer splits), so the draw callback
re-runs fewer times. **If drawing dominates, you win.** But:

- PSRAM is much slower than internal RAM, to write and to read.
- **LovyanGFX pushes PSRAM sprites without DMA.** The transfer becomes synchronous, the
  overlap above disappears, and the second buffer has nothing left to overlap with.

**If transfer dominates, you lose.** It is not a free speedup — measure it.

---

## 5. How this works in LGFXScreenBuilder

LGFXScreenBuilder selects between the two modes **by include, not by configuration**.

```cpp
#include <M5Unified.h>

#if __has_include(<LGFXVirtualCanvas.h>)
#include <LGFXVirtualCanvas.h>          // present -> buffered; absent -> direct
#endif

#include <LGFXScreenBuilder.h>
#include "MyScreen.h"                    // generated header comes after
```

- **Include `<LGFXVirtualCanvas.h>` before the generated header → tiled double buffering.**
- **Don't → direct drawing.**
- There is no runtime switch (no `setBuffered()` API).

The `__has_include` guard only exists so the sketch still builds when the library is not
installed; the mode is decided by whether the header was **actually included**.

### Always verify that it took effect

**The most common mistake is include order.** Put it after the generated header and you get
no error and no warning — just silent direct drawing. One line tells you:

```cpp
void setup() {
  M5.begin();
  screen.begin();
  Serial.printf("buffered=%d transparent=%d\n",
                screen.isBuffered(), screen.supportsTransparentScenes());
}
```

### Every `show()` redraws everything

There is no partial update. `show()` **redraws every part of the scene, every time.** That
is not laziness — it is what makes the tiled model work. When drawing is buffered the
redraw is invisible, so the "what do I have to erase" bookkeeping simply stops existing.

```cpp
Scene::Main main;
main.title   = "Main";
main.battery = "82%";
main.temp    = "24.5C";
screen.show(main);          // draws 8 tiles, DMA-pushes 8 times
```

### Tuning the tile budget

`Screen` holds its `LGFXVirtualScreen` as a **protected member** (`_vscreen`). It is not
exposed on the public API, so to change the ~19 KB default, derive from the generated
`Screen`:

```cpp
struct MyScreenTuned : MyScreen::Screen {
  using MyScreen::Screen::Screen;
#if defined(LGFXVIRTUALCANVAS_H)
  void tune() { _vscreen.setMemoryLimit(40 * 1024); }   // bigger tiles = fewer splits
#endif
};
```

---

## 6. The memory/speed trade-off table

Rough figures for 320×240 / 16-bit / 40 MHz SPI (measure your own setup).

| Mode | Extra RAM | Flicker | Frame time | Good for |
| --- | --- | --- | --- | --- |
| Direct drawing | 0 | **yes** | transfer only ≈ 31 ms | boards with truly no RAM, static screens |
| Tiled, single buffer | ~19 KB | no | draw + transfer (serial) | minimal RAM, cheap drawing |
| **Tiled, double buffer** (default) | **~38 KB** | no | **max(draw, transfer)** ≈ 31 ms+ | **almost always the right choice** |
| Full-screen double buffer | 150 KB | no | max(draw, transfer) | PSRAM / large-RAM boards only |
| Tiles in PSRAM | per budget | no | DMA off, transfer synchronous | draw-bound with too many splits |

Principles worth memorizing:

- **More tiles never reduces total drawing time.** It only adds per-tile overhead
  (`fillScreen`, `pushSprite`, and re-running your callback). Tiling is a tool for
  *spending less RAM*, not for going faster.
- **Transfer time is fixed by screen size and SPI clock.** No drawing optimization lowers it.
- **Flicker-free costs about 38 KB.** In most projects that is a bargain.

---

## 7. LovyanGFX / M5GFX quirks

Even with LGFXScreenBuilder you touch the raw API as soon as you write an overlay. The
usual traps:

### Drawing state is sticky (the big one)

`setTextColor` / `setTextDatum` / `setTextSize` / `setFont` **persist**. Change one anywhere
and it affects everything drawn afterwards.

```cpp
g.setTextDatum(middle_center);
g.drawString("A", 100, 60);
g.drawString("B", 100, 90);   // still middle_center
```

This is exactly why the LGFXScreenBuilder engine re-applies font / color / size / datum for
**every** Text part ([Renderer.h](../src/lgfxsb/Renderer.h)) — so one part's settings cannot
leak into the next. Keep the same discipline in your overlay: **never assume the current
state is what you left it as.**

### Rotation 0 is not necessarily "the board's normal orientation"

M5GFX sets a board-specific standard rotation and leaves it that way after `M5.begin()`.
LGFXScreenBuilder absorbs this: `begin()` captures the board's standard rotation, and a
profile's rotation is applied **relative** to it as `(base + profile.rotation) % 4`. So in
the authoring tool, profile rotation 0 always means "this board's normal orientation".

If you call `setRotation()` yourself, be aware you are moving that baseline.

### Colors are written as 24-bit but stored as 16-bit

`0x4CAF50` is accepted and then quantized to RGB565, so **two colors you meant to be
different can end up identical**. This is why the transparent-scene color-key check compares
values *after* quantizing to RGB565 — that is the depth at which the mask actually operates.

### Fonts cost flash; CJK fonts cost a lot of flash

LovyanGFX preset fonts are compiled into the binary. Latin faces are a few KB to a few tens
of KB, but **Japanese / Chinese / Korean fonts run from hundreds of KB into the MB range**.
Enabling a large CJK font on a small-screen profile can blow the flash budget by itself.

That is precisely why LGFXScreenBuilder makes you enable fonts **per profile**, and why the
authoring tool shows the **exact flash cost of each font**.

### `startWrite` / `endWrite`

Wrapping many small draws in `startWrite()` / `endWrite()` collapses the SPI transactions
into one and is faster. In buffered mode LGFXVirtualCanvas manages this, so you **do not
need to — and should not — call them inside an overlay**.

### Anti-aliasing across tile boundaries

Neighborhood-dependent drawing (`drawSmoothLine`, blurs, filters) can differ slightly from a
whole-screen render at tile seams, because each tile is drawn and clipped independently.
LovyanGFX's default primitives are not anti-aliased, so this rarely matters.

---

## 8. This library's quirks

### Overlays run once per tile ← most important

The function you register with `setOverlay()` runs after the static parts — **once per
tile**, so 8 times per frame in buffered mode.

An overlay must therefore be **idempotent**: same input, same picture.
[examples/OverlayM5Unified](../examples/OverlayM5Unified/) demonstrates the discipline.

```cpp
// WRONG: the value changes per tile, so bands disagree with each other
void bad(GFX& g, const Scene::Main& s) {
  int v = analogRead(36);          // read per tile -> 8 different values
  g.fillRect(0, 0, v, 10, 0xF800);
}

// RIGHT: advance state in loop(); the overlay only reads it
static int g_value;
void good(GFX& g, const Scene::Main& s) {
  g.fillRect(0, 0, g_value, 10, 0xF800);
}
void loop() {
  g_value = analogRead(36);        // once per frame
  screen.show(main);
}
```

For the same reason, never call `millis()`, `random()`, sensor reads, or I/O inside an
overlay — and keep it cheap. You pay for it eight times.

### Callbacks are plain function pointers

Inherited from LGFXVirtualCanvas: **capturing lambdas cannot be passed.** Keep state in a
file-scope `static` or a global, as above.

### Images are pre-decoded, so they are safe here

Calling `drawPng()` / `drawJpg()` inside an overlay **re-decodes the whole image on every
tile** — clipping trims the output, not the decoding work. Eight tiles, eight decodes.

LGFXScreenBuilder's Image parts avoid this: the authoring tool decodes to **raw RGB565** at
import time and bakes it into the header, so at runtime it is just `pushImage`, which *is*
clipped per tile. Only worry about this when you handle PNGs yourself — decode once into a
sprite in `setup()`.

### Using it from multiple .cpp files

The render mode **changes a type** (`Canvas` is either `LGFXVirtualCanvas` or
`lgfx::LGFXBase`). If translation units disagree about the include, that is an ODR
violation. A single `.ino` is fine; with multiple `.cpp` files, pin the mode project-wide
with a build flag.

### Dividing work between static parts and overlays

- **Invariant background** (graph gridlines, a bar's frame, the 0% state) → **static part**
- **Strings** (the value changes, the shape does not) → **static Text part + scene struct field**
- **Shapes that change with the value** (bar fill, needle, waveform) → **overlay**

"The user can change it" does not mean "overlay" — swapping a string is the second case.
And do not bake a representative bar fill into a static part; the overlay will draw over it
and you will see both.

---

## 9. Transparent scenes (dialogs)

Redrawing the whole screen just to show a confirmation box is wasteful, and the screen
underneath visibly blinks. LGFXScreenBuilder lets a scene be marked **transparent**.

The mechanism is simple: each tile is cleared with a **color key** (default `#002400`) and
pushed with that color **masked out**. Pixels still holding the key are never transferred,
so the panel keeps whatever was there. That is why the live screen shows through the
**rounded corners** of a dialog.

Requirements and behavior:

| Build | Behavior |
| --- | --- |
| Direct drawing | works as-is (not painting a background *is* the transparency) |
| Buffered + LGFXVirtualCanvas **1.4.0 or newer** | true transparency via `renderTransparent()` |
| Buffered + older than 1.4.0 | emits `#warning`; drawn as **an ordinary opaque screen** |

Check with `screen.supportsTransparentScenes()`.

**Two things to remember:**

1. **Closing the dialog means redrawing the screen underneath yourself.** The library does
   not manage layers; nobody can restore pixels the dialog never touched, so calling
   `show(previousScene)` is the application's job.
2. **A part painted in the color key becomes a hole**, not a shape. The authoring tool flags
   this at export time.

Alpha blending (semi-transparency) is **not supported**: the mask is all-or-nothing per
pixel, and real compositing would need a full framebuffer or panel readback.

See [examples/DialogM5Unified](../examples/DialogM5Unified/) for a working example.

---

## 10. Strengths and limits

### What it is good at

- **Layout leaves your code.** Coordinate magic numbers disappear from the sketch and become
  something you drag in a browser. No string IDs either — `main.battery = "82%"` is a
  **typed field**, so a typo is a compile error.
- **One binary, several boards.** Each profile keeps its own layout and `Profile::Auto`
  picks by screen size at runtime — Core / StickC / Cardputer from one build.
- **Flicker handling is one include.** Tiling, DMA and double buffering live in
  LGFXVirtualCanvas; your code does not change.
- **Almost no RAM.** Layout is a descriptor table in flash (`PROGMEM`); runtime heap is
  basically just the tile buffers (~38 KB).
- **Screenshot regression tests.** Generated metadata lets a host backend render every
  profile × every scene to PNG.
- **AI-assisted layout.** Copy a scene as self-contained JSON and hand it to a model
  ([AI_LAYOUT_IO.md](AI_LAYOUT_IO.md)).

### What it is not (deliberate non-goals)

- **Not a GUI framework.** No buttons, hit-testing, focus, scroll views, or event dispatch.
  Input handling is yours. If you need that, look at LVGL.
- **No widget tree or layout engine.** Absolute coordinates only — no flexbox-style
  auto-placement, no parent/child, no groups.
- **No animation engine.** Interpolation, easing and timelines belong to your application;
  the library only draws "this state, now".
- **Not retained mode.** No recorded draw list, no diffing — everything is redrawn each
  time. So **the transfer floor (~31 ms at 40 MHz, 320×240) does not go away.** For higher
  frame rates you must do partial updates yourself, or narrow the area with
  `LGFXVirtualSprite`.
- **No alpha compositing** (see [section 9](#9-transparent-scenes-dialogs)).
- **A small set of part types**: rounded rect, line, circle, single-line text, image. No
  multi-line text, arcs, polygons or tables — draw those in an overlay.
- **Image slicing, sprite sheets and per-profile image swaps are out of scope** in the
  current spec.
- **No filesystem image loading.** Images are baked into the header as RGB565 and therefore
  **cost flash** — not a fit for many large images.

In short: it is optimized for **a fixed instrument-panel layout whose values change**, not
for an interactive application UI.

---

## 11. Troubleshooting

| Symptom | Suspect |
| --- | --- |
| Flicker | Is `screen.isBuffered()` false? Is `<LGFXVirtualCanvas.h>` included **before** the generated header? |
| Overlay disagrees band to band | Reading values inside the overlay. Advance state in `loop()`, read-only in the overlay |
| Overlay is slow | It runs once per tile. Move heavy computation, decoding and I/O out |
| Residue after closing a dialog | You must `show()` the underlying scene again yourself |
| Dialog renders opaque | LGFXVirtualCanvas older than 1.4.0 — check `supportsTransparentScenes()` |
| Part of the dialog disappears | That part's color matches the color key (default `#002400`) in RGB565 |
| Out of flash | Revisit per-profile font enabling; a CJK font is the usual culprit |
| Lambda won't compile as a callback | Callbacks are function pointers; captures are not allowed |
| Layout breaks on one board | `Profile::Auto` resolves by exact size match — is there a profile for that size? |
| Colors are off | RGB565 quantization |

## Where to go next

- [README.md](../README.md) — usage summary and the example index
- [SPEC.md](../SPEC.md) — full spec (§8.8 dynamic drawing, §10 export, §11.4 overlays)
- [LGFXVirtualCanvas](https://github.com/tanakamasayuki/LGFXVirtualCanvas) — tiling, DMA and diff transfer in detail
- [examples/](../examples/) — from the minimal sketch to overlays and transparent dialogs
