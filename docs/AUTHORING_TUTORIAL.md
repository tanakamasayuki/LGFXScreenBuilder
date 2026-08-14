# Your first screen — an authoring tool tutorial

> 日本語: [AUTHORING_TUTORIAL.ja.md](AUTHORING_TUTORIAL.ja.md)

How to design a screen in the browser, export `MyScreen.h`, and get it onto real
hardware. Nothing to install — one page to open:

**<https://tanakamasayuki.github.io/LGFXScreenBuilder/>**

No prior knowledge assumed. If you would rather first understand how drawing
works and why screens flicker, read [BEGINNERS_GUIDE.md](BEGINNERS_GUIDE.md).

**Contents**

1. [Reading the screen](#1-reading-the-screen)
2. [Creating a project](#2-creating-a-project)
3. [Placing parts](#3-placing-parts)
4. [Adopting fonts](#4-adopting-fonts)
5. [Adding devices (profiles)](#5-adding-devices-profiles)
6. [Exporting and running it](#6-exporting-and-running-it)
7. [Saving your work](#7-saving-your-work)
8. [Tightening the edit → export loop](#8-tightening-the-edit--export-loop)
9. [Asking an AI for a layout](#9-asking-an-ai-for-a-layout)
10. [Common snags](#10-common-snags)

---

## 1. Reading the screen

A **mode rail** on the far left switches between five modes.

| Mode | Purpose |
| --- | --- |
| **Design** | Place parts on a screen (scene). Where you spend your time |
| **Devices** | Add and order profiles (device = size + rotation) |
| **Assets** | Import PNG / JPEG images |
| **Fonts** | Pick fonts and enable them per profile |
| **Export** | Generate and save the `.h` |

Design mode has **two axes**, and that is the first thing to get straight.

```
        ┌──────── top tabs = profiles (devices) ───────┐
        │  Core  │  Stick  │  Cardputer  │            │
┌───────┼──────────────────────────────────────────┬──┐
│ left  │                                          │ i│
│ pane  │                 canvas                   │ n│
│  =    │      (selected scene × selected profile)  │ s│
│scenes │                                          │ p│
│       │                                          │ e│
│ Boot  │                                          │ c│
│ Main  │                                          │ t│
│  …    │                                          │ or│
└───────┴──────────────────────────────────────────┴──┘
```

- A **scene** is one screen (boot screen, main screen, settings screen…).
- A **profile** is a device (Core 320×240, Stick 135×240, …).
- The canvas shows exactly one **scene × profile** combination.

**Important:** parts belong to the scene and are **shared by every profile** —
only their coordinates are per-profile. Add `title` while looking at Core and it
also appears on Stick, where you then give it Stick's position. Delete it and it
is gone from every profile.

## 2. Creating a project

Press **New** in the toolbar.

- **Project name** — becomes the generated C++ namespace, so it must be a **C
  identifier** (letters, digits, `_`; not starting with a digit). `MyScreen` gives
  you `namespace MyScreen` and `MyScreen.h`.
- **First profile — device / size** — pick your board, or **Custom…** to type a
  width and height.
- **First scene** — a scene name, also a C identifier (`Main`, …).

**Create** starts it. If you only want to poke at the tool, the **Demo** button
loads the sample project and is faster.

> **New** discards the current project (it asks first).

## 3. Placing parts

Select a scene in the left pane, then use **+ Add ▾** above the parts list.

| Type | Use for | Main properties |
| --- | --- | --- |
| **Rect** | backing panels, frames, bar troughs | width, height, corner radius, fill, color |
| **Line** | rules, separators | X1,Y1 → X2,Y2, color |
| **Circle** | indicators, dots | radius, fill, color |
| **Text** | labels, values | text, datum, text size (multiplier), font, color |
| **Image** | logos, icons | asset picked from Assets mode |

The **Part ID** becomes the generated field name: name it `battery` and you get
to write `main.battery = "82%";`. C identifier again.

### Controls

| Input | Effect |
| --- | --- |
| Click | select |
| Drag | move (coordinates update live) |
| `↑` `↓` `←` `→` | move 1px |
| `Ctrl` (`⌘`) + arrow | move 10px |
| `Shift` + arrow | resize 1px |
| `Ctrl` + `Shift` + arrow | resize 10px |
| `Delete` / `Backspace` | delete |
| Wheel | zoom |
| Middle-drag | pan |
| Click empty space | deselect → shows **the scene's own properties** |

### Text datum

A Text part's coordinate means different things depending on its **datum**.
Getting this right is what keeps layouts from breaking across devices.

- Left-aligned label → a `top_left`-family datum: X pins the left edge.
- Centered title → `middle_center`: **X is the center**, so it stays centered as
  the string changes length.
- Right-aligned number (battery, etc.) → a `top_right`-family datum: **the right
  edge is pinned**, so `9%` and `100%` line up on the right.

Rule of thumb: for text whose length varies, put the datum on the side you want
to stay put.

### What goes in a part, and what you draw in code

This is the design decision that matters most.

- **Always-there background** that does not depend on the value (frames, grid
  lines, a bar's outline, the 0% state) → **static part**.
- **Only the string changes** → **Text part**. What you type in the editor is a
  *design-time placeholder*; at runtime you replace it through the scene struct.
- **The shape changes with the value** (bar fill, needle, waveform) → **draw it
  from an overlay** (see [OverlayM5Unified](../examples/OverlayM5Unified/)).

Do not bake a representative bar fill into a static part — the overlay will draw
over it and you will see both.

## 4. Adopting fonts

The default is LovyanGFX's `Font0`, which is small and plain. To change it, go to
**Fonts** and **Adopt** the ones you want.

Filter the catalog by **rendered pixel height**, script (Latin / digits /
Japanese / Simplified / Traditional / Korean), fixed vs. variable width, style and
family. The tiles show **glyphs actually rendered on the host**, so what you see
is what you get.

Once adopted, **enable each font per profile**. That is unusual enough to explain:

> Fonts are compiled into the binary and **cost flash**. Latin faces run from a
> few KB to a few tens of KB, but **Japanese / Chinese / Korean fonts run from
> hundreds of KB into the MB range**. Enabling a big CJK font on a small-screen
> device can exhaust flash by itself. So you can say "this font only on Core".
> The tool shows the **exact flash cost per font and per profile** so you can
> budget as you go.

Enabled fonts appear in the **Font** dropdown of the Text inspector — only the
ones enabled for the profile you are looking at. **Font choice is per profile
too**, so you can use a large Japanese face on Core and a small Latin one on Stick.

## 5. Adding devices (profiles)

In **Devices**, press **+ Add ▾**. Pick a resolution, enter a custom size, or
clone the current layout.

- Set **width/height** and **default rotation**.
- Rotation is **relative to the board's standard orientation**: `0` means "the
  normal way round". This works even where the board has a non-zero standard
  rotation (M5GFX does), because the runtime resolves
  `(standard + profile rotation) % 4`.
- **Profile order** is the runtime resolution order. `Profile::Auto` picks the
  **first** profile whose size matches the live screen, falling back to the first
  profile if none match.
- The list of **known boards of the same size** is a reference, **not an
  assignment** — resolution is by size, so same-size devices share one profile.

Adding a profile makes every existing scene and part appear there too. Switch to
Design, select it in the top tabs, and lay out the coordinates.

## 6. Exporting and running it

Go to **Export**.

**Output settings:**

- **Project name** — namespace and file name.
- **Target framework** — M5Unified / M5GFX / LovyanGFX. Only the sample `.ino`'s
  includes and init differ; the drawing API is the same.
- **Target profiles** — export a subset. The `enum class Profile` and the data
  tables shrink to match, so devices you leave out cost no flash.
- **Buffered (LGFXVirtualCanvas)** (default on) — emits the `#if __has_include`
  guarded include in the sample `.ino`. **Leave it on**; it is the flicker fix.
- **Embed AI layouts (comment)** (default off) — see
  [section 9](#9-asking-an-ai-for-a-layout).

Check the **Checks** panel for warnings (e.g. a part in a transparent scene
painted in the color key).

**Save** gives you two files:

- `MyScreen.h` — generated. **Do not hand-edit.**
- `MyScreen_example.ino` — a sample sketch that tours the scenes.

Put the `.h` next to your `.ino` and write:

```cpp
#include <M5Unified.h>

#if __has_include(<LGFXVirtualCanvas.h>)
#include <LGFXVirtualCanvas.h>          // before the generated header!
#endif

#include <LGFXScreenBuilder.h>
#include "MyScreen.h"

using namespace MyScreen;
static Screen screen(M5.Display);

void setup() {
  M5.begin();
  screen.begin();

  Scene::Main main;
  main.title   = "Main";      // field names are the part IDs you chose
  main.battery = "82%";
  screen.show(main);
}

void loop() { M5.update(); }
```

Libraries needed: this one (**LGFXScreenBuilder**), a display library (M5Unified /
M5GFX / LovyanGFX), and optionally **LGFXVirtualCanvas** for flicker-free drawing
(**1.4.0 or newer** if you use transparent scenes).

## 7. Saving your work

**There are two kinds of file and they are not interchangeable.**

| File | Contents | Role |
| --- | --- | --- |
| `*.lgfxsb.json` | the project itself | **the source of truth** — reopen this to edit |
| `MyScreen.h` | generated C++ | derived; throw it away and re-export |

The toolbar's **Save** / **Open** handle `.lgfxsb.json`. **Always save that one** —
a project cannot be recovered from a `.h`. (Embedding AI layouts recovers the
*layout*, but it is not the source of truth.)

There is also autosave to localStorage, restored when you come back — but it is
**not a backup**. Clearing site data deletes it.

## 8. Tightening the edit → export loop

In browsers with the File System Access API (Chrome, Edge, …) exports **overwrite
in place**.

The first **Save** binds the file; every export afterwards **silently overwrites
the same file**. So the loop becomes:

> fix the layout in the browser → **Save** → build in the Arduino IDE → look at
> the device → fix again

with no downloads and no manual copying. The `.h` keeps its own file handle,
independent of the project's, so you can bind it inside your sketch folder while
the `.lgfxsb.json` lives somewhere else entirely. **Save As** is there too, and
browsers without the API fall back to downloads.

## 9. Asking an AI for a layout

**Copy AI JSON** in Design mode puts the current screen — **all profiles** — on
the clipboard as self-contained JSON.

Hand that to a model together with [AI_LAYOUT_IO.md](AI_LAYOUT_IO.md) (the
interface contract for AIs; **the English version is canonical**) and ask for what
you want — "tighten the Stick coordinates", "make the margins consistent". Bring
the result back with **Paste AI JSON**: a scene of the same name is overwritten,
a new name is added, you get a **preview before it applies**, and **Undo works**.

Turning on **Embed AI layouts (comment)** in Export puts every scene's JSON into
the `.h` as a comment block. The compiler strips it, so it has **zero effect on
the binary** — but downstream tools (like the screenshot gallery) can then read
layouts from the header alone, without the `.lgfxsb.json`.

## 10. Common snags

| Symptom | Cause |
| --- | --- |
| Project or part name rejected | must be a C identifier (letters, digits, `_`; not starting with a digit) |
| Fixing one profile broke another | coordinates are per-profile — lay out **each** one |
| Deleting a part removed it everywhere | by design: parts belong to the scene and are shared by all profiles |
| No fonts in the Text dropdown | none enabled for that profile (Fonts mode) |
| Out of flash | almost always a CJK font — revisit per-profile enabling |
| Text drifts off-center | wrong datum; pin the side you want to stay put |
| Wrong layout on the device | `Profile::Auto` needs an exact size match — is there a profile for that size? |
| Flicker on the device | check `screen.isBuffered()`; is `<LGFXVirtualCanvas.h>` included **before** the generated header? |
| Parts vanish in a transparent scene | their color matches the color key (default `#002400`) in RGB565 |
| An old `.h` broke on a new runtime | **re-export** from the `.lgfxsb.json` — the guaranteed recovery path ([COMPATIBILITY.md](COMPATIBILITY.md)) |

## Where to go next

- [BEGINNERS_GUIDE.md](BEGINNERS_GUIDE.md) — how drawing works, flicker, DMA, memory vs. speed
- [../examples/README.md](../examples/README.md) — which example to read first
- [../SPEC.md](../SPEC.md) — the full specification
- [AI_LAYOUT_IO.md](AI_LAYOUT_IO.md) — the layout-JSON contract
