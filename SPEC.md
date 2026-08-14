# LGFXScreenBuilder Specification

## 1. Overview

LGFXScreenBuilder is a project for creating the screen data of Arduino applications that use LovyanGFX and M5GFX with a browser-based authoring tool, and outputting it in a form usable as an Arduino library.

This project does not provide a GUI framework itself. Instead, it provides a mechanism for designing and managing screen layouts, assets, and scenes, and treating them on the embedded side as a lightweight static drawing runtime.

Instead of building screens directly in code, developers design screens with an HTML-based authoring tool that runs on GitHub Pages, and incorporate the generated data into their Arduino projects.

## 2. Goals

- Make it possible to create screen layouts for LovyanGFX/M5GFX with a GUI.
- Separate screen design from the application logic on the Arduino side.
- Centrally manage scenes, parts, and assets.
- Provide a structure that can support multiple M5Stack-family devices and LovyanGFX-compatible devices.
- Make it possible to easily load the generated output from an Arduino library and update the screen display simply by updating values.
- Provide static layout JSON that is easy for AI assistants to understand and edit.
- Make it possible to distribute and run the authoring tool using GitHub Pages alone.

## 3. Non-Goals

- Do not implement a general-purpose GUI framework like LVGL.
- Do not provide a complex widget-tree management API on the Arduino side.
- Do not require a web server or cloud storage features.
- Do not provide an advanced event system, layout engine, or two-way data binding.
- Do not provide an animation engine, state-transition engine, or real-time graph drawing engine.
- Sensor reading, value formatting, high-frequency updates, custom drawing, and application state management are responsibilities of user code.
- Do not aim to cover every display device.

## 4. Intended Users

The primary target users are as follows.

- M5Stack users
- LovyanGFX users
- M5GFX users
- Arduino users
- ESP32-family embedded GUI developers

The assumed skill set is as follows.

- Has basic Arduino development experience.
- Understands the basic drawing API of LovyanGFX or M5GFX.
- Experience with a full-featured GUI framework such as LVGL is not required.

## 5. Usage Scenario

1. The user opens the authoring tool on GitHub Pages.
2. Creates a profile (target device / screen size / rotation).
3. Registers image assets and colors, and adopts fonts.
4. Creates a scene.
5. Places parts such as Text, Image, and Rect on the scene.
6. Overrides per-profile coordinates and display settings as needed.
7. Exports the data for Arduino.
8. Uses the LGFXScreenBuilder library in an Arduino project and loads the generated data.
9. In the application code, assigns values to the generated scene structures and draws them. Real-time graphs or custom drawing are implemented by user code directly with LovyanGFX/M5GFX.

## 6. System Configuration

LGFXScreenBuilder consists of the following elements.

- Arduino library
- Web authoring tool
- Project file format
- Arduino export format
- Sample sketches
- Documentation and build artifacts for GitHub Pages distribution

### 6.1 Arduino Library

The Arduino library is a lightweight runtime that draws the generated screen definitions and assets to LovyanGFX or M5GFX.

The library provides the following.

- Loading scenes
- Switching scenes
- Drawing parts
- Updating part values
- Toggling visibility
- A drawing adapter that absorbs the differences between LovyanGFX and M5GFX

### 6.2 Web Authoring Tool

The web authoring tool is implemented in HTML/CSS/JavaScript and operates as a static site on GitHub Pages.

The tool satisfies the following.

- Can run in the browser alone.
- Does not require server-side processing.
- Can save and load project files locally.
- Can download Arduino output artifacts.
- Can switch the display of multiple profiles in the preview screen.
- Bundles Japanese/English as the initial languages, and supports localizing the UI strings.
- Automatically selects the initial language based on the browser language, and lets the user switch it manually.
- Has a structure where supported languages can be increased simply by adding a translation dictionary, on the premise of adding major languages such as Chinese.
- Uses a 3-pane layout as the basis: lists such as scenes/assets on the left, editing in the center, and preview/auxiliary information on the right.

## 7. Supported Drawing Backends

### 7.1 LovyanGFX

Supports environments that use LovyanGFX directly.

The assumed usage form is as follows.

```cpp
using namespace MyScreen;          // generated output (§11)

LGFX gfx;
MyScreen::Screen screen(gfx);      // pass gfx to the generated facade

void setup() {
  gfx.init();
  screen.begin();

  screen.show(Scene::Boot{});

  Scene::Main main;
  main.battery = 82;
  main.temperature = "24.5C";
  screen.show(main);
}
```

### 7.2 M5GFX

Supports M5Stack-family devices that use M5GFX.

The assumed usage form is as follows.

```cpp
using namespace MyScreen;          // generated output (§11)

M5GFX display;
MyScreen::Screen screen(display);  // pass display to the generated facade

void setup() {
  display.begin();
  screen.begin();

  screen.show(Scene::Boot{});

  Scene::Main main;
  main.battery = 82;
  main.temperature = "24.5C";
  screen.show(main);
}
```

### 7.3 Backend Abstraction

Inside the Arduino runtime, a common drawing API of LovyanGFX and M5GFX is assumed. The following are abstracted as needed.

- String drawing
- Image drawing
- Rectangle drawing
- Color conversion
- Screen size retrieval
- Clipping

### 7.4 Drawing Resolution

Drawing is resolved based on the currently selected profile (§8.9).

- Full-screen fills and background clears are based on the physical size of the actual device (`gfx.width()` / `gfx.height()`). A transparent scene (§8.16) performs no background clear at all.
- Each part is drawn with the logical coordinates of the currently selected profile treated as absolute pixels, with the origin at the top-left. No coordinate scaling is performed.
- Drawing that extends outside the physical screen is left to the clipping of the drawing backend.
- Rotation applies the currently selected profile's rotation value (0–3) relative to the underlying display's standard orientation, via `setRotation((base + rotation) % 4)` (§8.9.3).

Even if the logical coordinate space (the profile's size) and the physical screen size differ, drawing is done with the top-left as the origin without scaling. For example, if a 135×240 profile is used on a physical 320×240 display, the background is drawn over the full 320×240, while the parts are drawn in the top-left 135×240 region. If a profile larger than the physical screen is used, the overflowing portion is clipped. To preserve the meaning of the coordinates, no automatic scaling or automatic repositioning is performed (a layout engine is a non-goal).

## 8. Functional Requirements

### 8.0 Top-Level Modes of the Web Authoring Tool

Rather than fully transitioning the entire screen, the authoring tool switches top-level modes while maintaining a common 3-pane layout.

Top-level modes:

- Design: Scenes, layers, part placement, property editing
- Assets: Management of image assets, colors, and image output format
- Fonts: Adoption of preset fonts, per-profile enablement, and font information/preview
- Export: Arduino output artifacts, generation API, asset output settings, downloads
- Devices: Management of profiles (screen size, rotation, order, layout)

Design is the core mode, and Assets, Fonts, and Export use the same 3-pane structure. Switching the preview target profile is placed as tabs at the top of the Design canvas. Devices is an independent mode for editing profiles and device-specific layouts.

### 8.1 Scene Management

Multiple screens can be managed as scenes.

Examples:

- Boot
- Main
- Settings
- Status
- Info

A scene has a unique ID. On the Arduino side, scenes can be switched using the ID or a generated constant.

A scene may also be marked **transparent**, which makes it an overlay drawn on top of the screen already on the panel instead of a full screen of its own (§8.16).

### 8.2 Part Management

A screen is composed as a collection of parts.

The terminology is organized as follows.

- Asset: Material referenced by a Part, not something placed directly on the screen. Images, fonts, color palettes, etc.
- Part: A general term for drawable elements placed on a Scene. Text, Image, Rect, Line, Circle, etc.
- Component: A template for reusing multiple Parts. Not handled in the current specification; a future extension.

In Design mode, the `Parts` section always displays the Parts that can be added. The path for adding elements to the screen is unified into `Parts`, and Assets are not given special treatment alone.

Assets mode is used to manage image material, colors, and image output format. Fonts are adopted, previewed, and enabled per profile in Fonts mode. When an Image is added in Design mode, the referenced Asset is selected in the property pane on the right.

The supported Parts are as follows.

- Text
- Image
- Rect
- Line
- Circle

Rect / Line / Circle are basic shapes included so AI-assisted static layouts can look reasonably polished. They stay within the range that maps naturally to LovyanGFX/M5GFX basic drawing APIs. Rect uses `x` / `y` / `w` / `h` / `r` to represent a rectangle or rounded rectangle, and `fill` switches between filled drawing (`fillRect` / `fillRoundRect`) and outline-only drawing (`drawRect` / `drawRoundRect`). Stroke width, shadows, gradients, complex paths, boolean operations, and other advanced vector editing features are not provided.

Ellipse is outside the current scope. RoundRect and Circle cover the common UI layout cases, while Ellipse would add another type and parameter set, so it is considered only when a concrete need appears.

Candidate future extensions are as follows.

- Icon
- Gauge
- Graph
- Container
- Button

`Text` is a general-purpose part that displays an arbitrary string. It can be used for fixed labels, status strings, or displaying numbers converted to strings. The name is `Text` rather than `Label`, prioritizing an expression that corresponds well to the drawing APIs of LovyanGFX/M5GFX.

**There is no separate type for fixed labels.** A fixed label is expressed as a `Text` whose value is never assigned at runtime. The generated scene struct's Text field defaults to **null (unset)**; when it is unset, the renderer draws that part's **per-profile design string** (stored per profile in the static layout, §8.9.6), so a fixed label can show **different text per device** with no user code. Assigning the field overrides it with **one runtime value shared across all profiles**; only the ones you assign change dynamically. This keeps the model simple without adding a type. (The first profile's design string is emitted as a `// design: …` comment on the struct field for reference. If a future optimization needs to keep fixed labels out of the scene struct, it would be added as an optional per-Text `dynamic: false` flag — append-only — rather than a new type. §15.)

A part dedicated to numeric display is not added in the current specification. When you want to handle a prefix/suffix, decimal places, and units for temperature, voltage, battery level, etc., user code assembles the string and passes it to `Text`.

A `ValueText` or `Value`-family part is not handled in the current specification. If introduced, it would be considered separately with settings such as the following.

- Numeric value
- prefix
- suffix
- Decimal places
- Min/max values
- Unit
- Zero padding and sign display

Each part has the following.

- ID
- Type
- Coordinates in the root coordinate system
- Size
- Visibility state
- Drawing order
- Style
- Referenced asset
- Per-profile layout (§8.9)

However, the items a part has differ by type. Text does not have a size (width/height); it is placed by an anchor point (`x` / `y`) + a datum + a text size (multiplier) (§8.7). Image / Rect have a rectangle size (`w` / `h`). Line has a start point (`x` / `y`) and an end point (`x2` / `y2`). Circle has a center point (`x` / `y`) and radius (`r`).

The generated structures (the data contract) are determined only by the part's ID and type. Coordinates, size, visibility state, style, preview strings, and per-profile layout are not included in the structures. As a result, the Arduino-side usage code (e.g., `main.title = "..."`) stays constant regardless of device or profile, and adding a profile later does not change the structure definitions. This is an invariant to avoid rework in multi-device support.

A part's layout (coordinates/size/visibility/style) is held **as a complete, independent value per profile**. There is no concept of a base or a diff (override). When adding a profile, you can start by copying an existing profile's layout. In a single-profile project, only one set of layouts is held.

The coordinate system uses the Scene root coordinate system as the standard. Each Part stores `x` / `y` as absolute coordinates on the screen.

The editor uses absolute coordinates as the primary edited value.

### 8.3 Layer Order Management

The Scene `parts` array represents the drawing order. Drawing proceeds from the head of the array, and later parts are drawn in front. That is, the last-drawn part is displayed on top of the overlap.

In the layer panel, in line with common design tools, front parts are displayed at the top and back parts at the bottom. Changing the layer order is done with the "Bring forward" / "Send backward" buttons (`↑` / `↓`) on the layer panel. These are button operations on the panel, distinct from the arrow keys that move the selected part on the canvas (§8.14).

Moving multiple parts together is treated as an editor operation that does not create a dedicated Part in saved data. The editor applies the same movement delta to the selected Parts without changing the saved structure.

`displayOrder` is auxiliary information for the UI list display and is handled separately from the drawing order.

Example:

```text
Logo
Title
StatusIcon
```

Part values are emitted as fields of the Scene structure in the Arduino-bound generated code.

Example:

```cpp
Scene::Main main;
main.title = "Status";
main.battery = 82;
main.temperature = "24.5C";

screen.show(main);
```

Even fields with the same name are not automatically treated as the same value. If you want to reflect the same value in multiple places, assign the same value in the user code.

Example:

```cpp
int battery = readBatteryLevel();

main.battery = battery;
main.footerBattery = battery;
```

### 8.4 Asset Management

Images, fonts, colors, and the like can be managed within the project.

Examples of image assets:

- dashboard.png
- logo.png
- icons.png
- loading.png

Assets are given a unique ID.

An Image Part references an existing image asset. The image asset payload is shared project-wide, and profile-specific differences are handled by placement values: `x` / `y` / `w` / `h` / `visible`. Profile-specific image replacement is outside the current scope. If needed, user code switches images directly, or the user prepares the required image as a separate asset and references it from a separate layout.

Image assets are converted to a format close to the drawing target for Arduino output.

Supported image output:

- Flash direct-draw RAW

Flash direct-draw RAW is pre-converted to a format close to the drawing target, such as RGB565, and draws data in PROGMEM or on the file system directly via the equivalent of `pushImage()`. Its expansion processing is light, and it is the standard format for ordinary UI parts and fixed images displayed frequently.

In-memory fast drawing, compressed formats, and storage-destination variations (LittleFS/SPIFFS/SD/RAM/PSRAM) are not handled in the current specification. If needed, user code manages those images and draws them directly with LovyanGFX/M5GFX.

### 8.5 Image Slicing

Image slicing is outside the current scope. Required images are prepared in advance with an external tool and registered as individual image assets.

### 8.6 Sprite Sheet Support

Sprite sheets are outside the current scope. Frame animation, auto-play, and frame selection from regions inside an image are not provided. If needed, user code draws directly with LovyanGFX/M5GFX.

### 8.7 Font Management

The following can be managed.

- Font registration
- Font selection
- Size
- Color
- Placement

A Text part is placed by an **anchor point (`x` / `y`) + a datum**. Character drawing in LovyanGFX/M5GFX is based on `drawString(text, x, y)` + `setTextDatum(...)`, and `datum` determines where on the text (one of 9 points: top/middle/bottom vertically × left/center/right horizontally) x,y is aligned. As a result, **center alignment and right alignment relative to a point can be expressed with the datum alone**, and a Text part does not have a drawing rectangle (width/height). The editor's selection box is automatically computed from the measured text bounds. Image / Rect inherently require a rectangle (`w` / `h`), so they keep it as before.

**Clipping (truncation/ellipsis), wrapping (multiple lines), and in-box alignment** for an arbitrary-width rectangle are not handled in the current specification. Text is equivalent to a single-line `drawString`, and does not have automatic wrapping at the screen edge (the equivalent of `setTextWrap`).

The unit for specifying text size is the **multiplier as the canonical (stored) value**. Text enlargement in LovyanGFX/M5GFX is `setTextSize(float)` = a multiplier relative to the base font, which is the primary primitive, and the px height is a derived value (font-dependent) obtained as "base font height × multiplier". Therefore, by making the stored value the multiplier, the actual-device display matches the generated code (which directly outputs `setTextSize(n)`), avoiding silent size discrepancies.

In addition to the multiplier input, the editor **displays the resulting px height as auxiliary information**. The reverse-lookup input of "entering a px height and automatically selecting the font + multiplier" is not handled in the current specification.

The live font preview in the browser is an approximate display. The look is checked using fonts the browser can handle, such as web fonts, system fonts, and user-loaded TTF/OTF.

For Arduino output, a font-reference scheme that is easy to handle with LovyanGFX/M5GFX is prioritized. Because the browser preview and the actual-device display may not match exactly, the spec treats it as an approximate preview.

If matching the actual-device display becomes necessary in the future, a scheme will be considered that extracts the characters used and outputs them as a glyph atlas or bitmap font, using the same glyph data in the browser preview and the Arduino runtime.

#### 8.7.1 Font policy (presets first)

The tool handles the **preset fonts built into LovyanGFX / M5GFX** first. For a preset, the runtime outputs no font payload; it merely references the font with `setFont(&fonts::<Name>)`, which is why a preset costs flash only where it is actually used (§8.7.4).

Beyond the presets, the tool can **generate an embedded font** from a web font or a user-supplied typeface, carrying only the characters the project needs (§8.7.7). That output *does* put glyph data in the header, and is the mechanism the rest of this section anticipated for matching the device exactly.

#### 8.7.2 Font catalog (how it is generated)

The list (catalog) of available preset fonts is **generated offline and shipped as JSON**, and the browser tool only reads it (no C++ is parsed at runtime).

- **The set can differ per library, but at the pinned versions (LovyanGFX 1.2.21 / M5GFX 0.2.22) it is identical** (186 each, no name-set difference; both include the efont-family Japanese/Chinese/Korean). So **LovyanGFX is the representative single catalog**: parsing and host introspection are done **once on LovyanGFX** and reused for M5GFX/M5Unified (which also avoids the question of whether M5GFX builds on host). The generator **continuously diff-checks the name set against M5GFX** so a future bump that diverges is detected (ignore the extras if uncommon, or add them if needed). Shared fonts are declared under the same name in `namespace fonts::`.
- **Attributes obtainable mechanically from the name** are classified first: type (`font_type_t` = glcd / bmp / rle / gfx / bdf / vlw / u8g2 …), family stem (FreeMono / FreeSans / FreeSerif / DejaVu / Orbitron / efont …), style (Bold / Oblique / Italic), nominal size, and script tendency (efont family = CJK).
- **Attributes not obtainable from the name alone are introspected on the host** (Arduino host environment): actual pixel height, baseline, advance (`getDefaultMetric(FontMetrics*)`), data/flash size, and available character coverage (GFXfont has `first/last` + `range[]` in source, but U8g2/efont are binary, so coverage is determined by probing codepoints). Metrics, coverage, and size are obtained together in a single introspection harness and baked into the catalog JSON. The per-font flash size is the exact link cost attributed from the harness's own linked ELF (each font object + its data symbols, via `nm`) — a single build, not one compile per font. It is surfaced per font and summed as a per-profile flash budget (§8.7.4).
- **The same host harness renders an actual-drawing sample of each font to PNG and ships it with the catalog** (draw a representative string at the real font size via `setFont`→`drawString`→`createPng`; include a Japanese sample for CJK-capable fonts, judged from coverage). This lets the adoption UI preview the **same glyphs as the device** (not an approximation). Because there are many, they are packed into a sprite atlas or similar to keep size down.
- **The version to parse is taken from the sketch.yaml pin as the source of truth.** `~/.arduino15/internal` may hold several versions of a library, and a freshly bumped version is only downloaded on the first build, so the pinned version is resolved exactly as `<Name>_<version>_<hash>` and, if absent, **fails loudly rather than silently parsing an old copy** (prompting a rebuild). A dedicated font-catalog sketch.yaml (pinning both LovyanGFX and M5GFX) is the single source of versions, shared by the host introspection harness.
- Catalog generation (parse + host introspection + sample PNGs) runs in CI/by hand, and the resulting JSON (+ preview images) is kept as an artifact, regenerated when a library is updated. The generated output records the versions it referenced.

#### 8.7.3 Font adoption (project assets) and selection UX

There are ~200 presets, too many to list all in the Text dropdown. So **fonts are treated as "project assets" like images.**

- The project holds an **adopted-font set** `project.fonts` (a small set chosen from the catalog).
- Adding (adopting) a font is done in a dedicated dialog that **filters the catalog by type / family / style / size / script** and confirms the look with an **approximate preview** before adopting.
- **Adoption picks "use it" per profile** (§8.7.4). The Text inspector's font dropdown shows **only the fonts enabled for that profile** (keeps it small and prevents misuse of fonts unsuited to the device).

Preview fidelity: **the preview at font adoption (selection) time shows the host-rendered sample PNG (§8.7.2) = the same glyphs as the device** (not an approximation). The live display of **arbitrary text + an arbitrary multiplier on the Design canvas remains approximate** (preset glyph data is not in the browser; the look is matched with a web/system font close to the family type — mono/sans/serif — plus the measured pixel height from the catalog). When a live exact match for arbitrary strings is required, proceed to custom fonts that extract the used characters (glyph atlas output) (§15).

#### 8.7.4 Data model and flash (per-profile font usage)

- A Text part **has a font reference**. If unset, the default (equivalent to `Font0`) is used.
- The font reference is a **per-profile layout value** (paired with "font size is per profile" in §8.9.6). The same Text can be assigned a different font and multiplier per device.
- Each profile holds a **set of "fonts to use"** (a per-profile usage flag over the adopted fonts). A small screen can enable only small fonts and not use large ones. A Text's font is chosen from the set enabled for that profile.
- The existing **size multiplier (`setTextSize`) is unchanged**; the font + multiplier pair determines the final look.
- The adopted fonts `project.fonts` reference catalog presets by id (C identifier), and layouts reference that id (the same indirection as image-asset references).

**Flash-usage model (why the per-profile flag):** preset fonts are part of the library, but **only those referenced via `&fonts::X` are linked into the actual binary**. The generated code references with `setFont` only the fonts actually used by the Text of the profiles included in that build (the export targets of §10). Therefore **building only the small screen does not link the large fonts**. The per-profile "fonts to use" flag makes this explicit and lets the user see the font count = flash usage per device (avoiding unknowingly carrying many fonts and bloating flash).

#### 8.7.5 Output (codegen / runtime)

- The generated code outputs `setFont(&fonts::<Name>)` + `setTextSize(<multiplier>)` when drawing Text (reference only; no font payload is emitted).
- Only the fonts used by each included profile are referenced (the flash policy of §8.7.4).
- Fonts not present in the target library's `fonts::` are **omitted + warned**. This does not normally happen with the single representative catalog (LovyanGFX), but is kept as insurance against version skew.

#### 8.7.6 Link to the external font catalog

Per-font detail (**the full list of covered characters — checkable via the browser's
in-page find**, metrics, flash, fixed/proportional, glyph count, specimen preview) is
provided by a separate static site, **LGFXFontCatalog** (GitHub Pages; self-contained,
rarely updated). This tool only **links** to it.

- **Link URL** = `<BASE>/fonts/<name>.html`, where `<name>` is the font symbol name.
  **Name only, latest fixed** (no version in the URL — the site always shows its own
  latest version).
- `BASE` is a **single constant** in this tool (`FONT_SITE_BASE` in `docs/src/fonts.js`).
  Set it to empty to hide every link.
- Link placement: **the Fonts-mode grid tiles** (a hover "↗"), **each adopted-font row**
  ("Detail ↗"), and the **Text inspector font picker** ("Detail ↗" when a non-default font
  is selected). All open in a **new tab** (`target=_blank rel=noopener`).
- **Version skew tolerance**: if this tool later updates LovyanGFX while the site lags,
  names are stable enough to still match; an absent name falls back to the index / a 404.
- The catalog site's own spec lives in the LGFXFontCatalog repo (`SPEC.ja.md` / `SPEC.md`).

#### 8.7.7 Generated embedded fonts

The presets cover a lot, but not "this typeface, this size, these characters". So the
tool can **generate a font**: rasterize a chosen typeface at a chosen size for a chosen
character set, and emit it as data the sketch carries. Because only the requested
characters are included, a Japanese UI that needs 300 characters costs 300 characters of
flash rather than a full CJK font.

**Output format — u8g2.** Of the three embeddable formats LovyanGFX can draw
(`lgfx::U8g2font`, `lgfx::GFXfont` with `EncodeRange`, and VLW via `loadFont(const
uint8_t*)`), the generator emits **u8g2**: it is 1bpp so a CJK set stays affordable, it
is `constexpr` and lives in flash with no RAM cost and no runtime loading, and it is what
LovyanGFX's own `fonts::lgfxJapanGothic_*` / `fonts::efont*` already are — so nothing new
runs on the device. The encoder (`docs/src/fontgen/u8g2enc.js`) is written against
LovyanGFX's decoder in `src/lgfx/v1/lgfx_fonts.cpp`, and `tests/fontgen/u8g2_roundtrip.mjs`
holds a mirror of that decoder, checks it against a real bundled font, and round-trips the
encoder through it. Glyphs are addressed with a uint16 encoding, so codepoints above
U+FFFF cannot be represented and are reported as dropped rather than silently lost.

**Rasterizing — the browser's own text engine.** Glyphs are drawn through `FontFace` +
a 2D canvas rather than a bundled font parser. That accepts anything the browser accepts
(TTF, OTF/CFF, WOFF/WOFF2, variable fonts), adds no dependency to a tool that has no build
step, and makes the preview and the emitted glyphs come out of the same rasterizer.

Whether a glyph really came from the chosen typeface is decided by drawing it **with the
font in the stack and again with the font removed**, behind the same generic fallback. If
the two match, the fallback drew it and the font has no such glyph. Both generics are used
and the character counts as present if either pair differs, since a glyph that happens to
be pixel-identical to serif's is unlikely to also be pixel-identical to monospace's.

"Unlikely" is not "never", so **a character that still looks absent is asked once more at a
different size**. A font that genuinely lacks a glyph matches its fallback at every size; a
pixel collision is a property of the size and does not survive being re-rolled. Noto Sans KR
unquestionably contains 굡, but at a 43.8px em it thresholded to exactly the same pixels and
advance as both generics and was reported missing, while the other 2,349 hangul of the same
set came through — and at 32.9, 38.4, 49.3 and 54.8px the same character is found. The retry
is affordable because it is skipped when none of the family's loaded faces *declares* the
codepoint: `unicode-range` over-declares and so can never prove a glyph is present, but it is
exact in the other direction, and a Latin face asked for 2,350 hangul declares none of them.

Two simpler tests were tried first and both ship wrong output. Comparing *the font behind
serif* against *the font behind monospace* only works while the two generics resolve to
different physical fonts: on a machine with one CJK font both draw 漢 identically and a
Latin face is credited with the whole of CJK, and on a machine with no font for a character
at all both draw the same `.notdef` box, so a tofu is embedded as if it were a glyph. Which
of those happens depends on the machine's installed fonts — it passed locally and failed on
a CI runner. Comparing against the browser's default font and calling a match "missing"
fails the other way: it drops characters the font really has, because `I` and `l` are the
same plain bar in most faces. The consequence is not cosmetic — under the weaker test a
Roboto font was credited with 41 CJK unit symbols it does not have, and shipped their tofu.

For the same reason, "ink appeared on the panel" is not evidence a glyph exists:
LovyanGFX draws a hollow rectangle for a character the font lacks
(`IFont::drawCharDummy`), so the device test compares against that placeholder rather than
merely counting pixels.

**Size means character height.** The size field is the ink height of a **reference
character**, not a line box and not a CSS `font-size`. Line boxes vary wildly between
families — the same number gives visibly different text in two typefaces because one
reserves far more room above and below than the other — and what anyone means by 32 is
text that is 32 pixels tall. The reference is picked from the set being generated: an
ideograph or hangul syllable if it contains one (they fill the em square), otherwise a
capital, otherwise a digit. Picking from the requested set is deliberate — asking canvas
whether a family "has" 漢 is not answerable, because a Latin-only family falls back to a
system font, and where no CJK font is installed the fallback draws an identical tofu
through every fallback chain, so the character looks present.

The **line box is derived from the glyphs that were actually produced** (their furthest
ink above and below the baseline), not from the family's declared metrics. It is therefore
exactly tall enough for this font's contents: no clipping, and no rows of padding paid for
in flash because the family reserves room for characters this font does not carry.

The default is **32px**: at 1bpp, CJK below roughly 24px loses the strokes that tell one
kanji from another, so the starting point is a size that actually reads. The default
typeface is **Noto Sans JP** for the same reason — the harder case (CJK) should be the one
that works out of the box.

**A live preview sits with those two controls.** Typeface and size are exactly the settings
numbers cannot convey, and a preview parked below the Generate button is too far away to
adjust against. So the preview lives next to them and follows every change, rasterizing
**only the sample string** — a handful of glyphs regardless of how large the character set
is — through the same rasterizer as the real run. It is not an approximation: those are the
output pixels, at 1:1 by default.

**Character sets are composed, not picked from a menu of bundles.** Selection runs on
independent axes — Latin/European, kana and Japanese punctuation, han, hangul, symbols —
plus free-form extra characters and `U+xxxx-U+yyyy` ranges. Everything is unioned.

- **Every set is derived from Unicode's own data** (`tools/gen-charsets.mjs`): Unihan's
  `kJoyoKanji`, `kJinmeiyoKanji`, `kJis0`, `kGB0`, `kBigFive` and `kKoreanEducationHanja`,
  plus `KSC5601.TXT`. Sizes match the published standards exactly (JIS level 1 = 2,965,
  GB 2312 level 1 = 3,755, KS X 1001 hangul = 2,350, …), so a set is auditable rather than
  something to take on faith.
- **Han is per language, unioned.** Japanese, Simplified, Traditional and Korean are
  different repertoires, not points on one scale — measured against the sets this replaced,
  "CJK" was missing 536 characters that "Japanese" had, including the 社/祉/祈 variant forms.
  So each language gets its own level, and the results combine. "All CJK ideographs" is
  simply another entry rather than something sitting above Japanese.
- **Tiers are cumulative unions.** The raw standards do not nest: 常用漢字 has 34 characters
  outside JIS level 1 and 4 outside JIS X 0208 entirely. Each tier is therefore defined as
  everything below it plus one more standard, so moving up a level can never silently drop a
  character. The previous sets failed exactly this — their "Japanese mini" carried 9
  characters (`～ ＼ ￡ ―`, the CP932 forms) that their "Japanese" did not.
- **Additive sets are checkboxes; tiers are ladders.** A control that adds must not look
  like a radio group, and a scale should look like a scale.
- **Templates** (Clock, Sensor readout, Japanese UI, …) fill in a selection in one click and
  leave it editable, so they teach the model instead of hiding it.

The one thing standards do not cover is what a small screen needs beyond letters, so the
symbol categories (units & measurement, mathematics, arrows, shapes, currency, enclosed,
misc) are literal lists in the generator — reviewable character by character in its diff.
`℃` (U+2103) lives in **units & measurement**, which is what a thermometer UI reaches for.
`Ω` deliberately does not: it is a Greek letter, it lives in the Greek set, and the CJK
webfonts this tool recommends carry no Greek at all (Google's Noto Sans JP has none of
U+0370..U+03FF), so putting it in a default-selected set would report a missing character
on every fresh page load, for one symbol.

**Fallback fills the gaps the typeface leaves.** No single typeface covers everything a
screen might need — Google's Noto Sans JP carries no Greek at all, so a Japanese UI showing
Ω for ohms would simply lose it. So a character the chosen typeface has no glyph for can be
taken from another one. Three properties make that safe rather than merely convenient:

- **It is offered, never applied unasked.** Mixing typefaces changes how the font looks, so
  the tool detects the gap, names the characters, names the typeface that could supply them,
  and waits for one click. The choice is stored on the recipe, so an export rebuilds the
  same font.
- **Sizes match.** A filled-in glyph is measured on the *same* reference character as the
  primary, so it comes out the same height instead of visibly larger or smaller.
- **Every source is credited.** The generated font is a derived work of each typeface it
  drew from, so the header carries one attribution block per source with its author, licence
  and the characters it supplied. OFL requires exactly this.

The automatic chain is Noto Sans Symbols 2 → Noto Sans → Noto Sans JP → SC → KR, and each
one genuinely contributes: of ‰ ℃ ℉ ← ▲ ② ☃ Ω, Symbols 2 draws ▲ ② ☃, Noto Sans draws ② Ω,
and Noto Sans JP draws everything but Ω. (`unicode-range` is no guide here — all three
declare coverage of all eight.) A specific family can be pinned instead.

A fallback is a decision about **one** typeface's gaps, so changing the typeface, weight or
style drops it rather than carrying it onto a font whose gaps are different; and once it is
on it stays visible and changeable, because a setting that can only be turned on is a trap.

**Whitespace is capped, not judged.** A space draws nothing, so no comparison can say which
font supplied it — a full-width space is one em in every CJK font, so even its advance
matches whatever the browser would have fallen back to. It is therefore accepted rather
than presence-tested, and its advance is capped afterwards at the widest inked glyph in the
same pass. Without that cap the advance comes from the fallback at *this* font's em, which
for a face whose em dwarfs its letters is absurd: Micro 5 at a 32px character height gave
U+3000 an advance of 71px next to 34px kana, and that alone pushed the font past the
format's advance limit.

**Run-length widths are chosen for coverage first, size second.** A glyph's entry is reached
through a one-byte jump, so an entry over 255 bytes cannot be addressed and has to be
dropped — and the two run-length field widths decide how long entries get. Choosing them to
minimise total size alone therefore trades whole characters away for a fraction of a percent
of flash, and the characters it drops are the densest, which for a Japanese set means
everyday kanji: 繊 and 酬 at a 32px character height, and 49 of them (機 職 織 臓 綱 …) at
36px. The search is now lexicographic — fewest unencodable glyphs, then smallest output — so
the same 2,493-character set encodes complete at 32px for 1.3% more flash, and loses 7 rather
than 49 characters at 36px. Where nothing would be dropped either way the size objective
still decides, so ordinary fonts are byte-identical. Any glyph that still cannot be encoded
is named in the result, not just counted, because the answer decides what to do about it: a
slightly smaller character height usually brings it back.

**The format has hard limits, and they are reported as such.** u8g2 stores a glyph's width
and height in unsigned fields (up to 8 bits, so 255) but its bearings and advance in signed
ones — and LovyanGFX's decoder casts those through `int_fast8_t`, which caps them at 7 bits,
so an advance cannot exceed 63px. A font whose glyphs are wider than that genuinely cannot
be encoded; the error therefore names the character, the limit it hit and the largest
character height that would work, rather than saying the size is "too large".

Characters above U+FFFF are excluded from the curated sets at generation time rather than
reported at selection time. A uint16 glyph encoding can never address them, so carrying one
would mean telling every project that selects 常用漢字 about 𠮟 (U+20B9F) it can do nothing
about. The BMP check survives for custom text and ranges, where the user typed the character
and can act on the warning — and there it names the character, because "1 character was
dropped" only invites the question.

Two costs the fallback pass deliberately does not pay twice: accepting the offer reuses the
primary rasterization instead of redoing it (for a few thousand kanji that is the difference
between one pass and two), and it tries the families the survey found could help *first*, so
the pass normally finishes before the rest of the chain is ever fetched. `unicode-range` is
no help in that survey — Google's subsets declare coverage the fonts do not have, claiming
all of ‰ ℃ ℉ ← ▲ ② ☃ Ω for three families that between them draw quite different subsets of
it — so the survey rasterizes, but without measuring, since "does a glyph exist" needs no
scale.

**A survey may reorder the chain; it must never truncate it.** The survey describes *one*
gap, and the gap moves whenever the character set changes — which, unlike a typeface change,
does not clear the fallback. Letting the survey stand in for the chain therefore lost
coverage silently: with the fallback already on, switching to the Korean set kept a plan of
[Noto Sans, Noto Sans JP] and reported 2,350 hangul as absent from the typeface, while Noto
Sans KR — three entries further down the chain, and holding every one of them — was never
asked. The plan is now a prefix of the full chain rather than a replacement for it, so a
stale plan can only cost a little time, never coverage.

A count ("4,217 characters") does not tell anyone whether a set covers what their screen
needs, so both entry points carry a **charset inspector**: the resolved codepoints listed as
real characters, grouped by Unicode block, findable with the browser's own Ctrl+F, and
scopeable to one set at a time. After a run the same view becomes the coverage report —
characters the chosen typeface turned out not to have are struck through **in place**, so
"did my ℃ make it" is one glance rather than a separate list to cross-reference.

The **preview marks what will not make it** rather than closing the gap: a character the
typeface has no glyph for is drawn as a red crossed box, one outside the selected character
set as an amber one. Skipping them was the earlier behaviour and the worst option — the
line still reads as a sentence, so nothing tells you a character went missing. The
generated header is likewise shown in full, and says so; only a set large enough to strain
the browser is cut, and then it says that in words instead of trailing off in an ellipsis
that reads like the end of the file.

**Two ways to use it, one pipeline.**

- **Standalone page** (`docs/fontgen.html`): typeface → size → characters → download `.h`.
  It holds no project state and is useful on its own to anyone using LovyanGFX or M5GFX
  without this editor.
- **In the editor** (Fonts mode): the same dialog, but the result is adopted onto the
  project. A generated font behaves like any other adopted font — per-profile enable,
  selectable on Text, subject to the same flash policy (§8.7.4) — and codegen emits its
  byte array plus `static const lgfx::U8g2font kFont_<name>(...)`, referenced from the
  layout table. A font enabled on no exported profile is not emitted at all.

**The project stores the recipe, not the bytes.** `project.fonts` holds
`{ name, custom: recipe }` where the recipe is the typeface, size, threshold and character
selection. Glyph data is rebuilt on export (`docs/src/fontgen/build.js`) and never
serialized. This keeps project files small, keeps a shared project from carrying a
redistributable copy of a typeface, and means editing a recipe cannot leave stale bytes
behind. The cost is that a reopened project must rebuild: Google fonts are re-fetched
automatically, while a typeface supplied as a local file has to be supplied again, which
the UI asks for rather than exporting a header with a font quietly missing.

**Licensing is part of the output.** Generating an embedded font converts a typeface's
glyphs into data shipped inside firmware, which is redistribution. The curated web-font
list is therefore limited to **SIL Open Font License 1.1 and Apache-2.0** families, both of
which permit it. Local files are allowed — many perfectly licensed fonts are not on that
list — but the UI warns prominently that most commercial and OS-bundled typefaces forbid
exactly this, and the generated header records the source as a local file with an unknown
licence. Every generated header carries an attribution block naming the typeface, author,
licence and origin, because OFL and Apache both require the notice to travel with derived
font data and the emitted array *is* derived font data.

### 8.8 Dynamic Drawing and Animation

LGFXScreenBuilder generates static base layouts. It does not provide an animation engine, state-transition engine, real-time graph engine, or drawing engine for high-frequency updates.

When dynamic visuals are needed, user code is responsible for them:

- Update generated Text values.
- Toggle Part visibility when needed.
- Draw graphs, waveforms, meters, game-like visuals, and similar content directly with LovyanGFX/M5GFX.
- Manage timers, state transitions, and animation progress in the application.

The static layer covers only "what is always drawn regardless of any dynamic value." Think of the boundary as three categories:

- ① The **invariant scaffold** (a graph's gridlines and axes; a progress bar's outline and unfilled / 0% track) is placed as static parts and drawn by `show()`.
- ② **Text** is a static part (its position, datum, size, font, and color are design), but its displayed string is substituted at runtime by user code through the scene struct (the `text` field is a preview value). `show()` draws it — this is not an overlay.
- ③ **Drawing whose shape changes with a value** (a data line, a bar fill, a meter needle) is drawn by the user in an overlay (§11.4).

"The user can change it" does not imply an overlay: string substitution is category ②. Do not bake a representative or sample fill/line into the static parts (the overlay would draw over them, causing duplication or mismatch).

This keeps the tool and AI layout JSON focused on static layouts and avoids making the specification unnecessarily complex.

### 8.9 Profiles (Multi-Device Support)

Multiple-device support is performed through the unit of a profile (Profile). A profile groups screen size, rotation, and layout. Devices with the same screen size can use the same profile.

#### 8.9.1 What a Profile Is

A profile is a unit that defines a layout, and it has the following.

- ID (a C/C++ identifier; in the generated code it becomes a `Profile::<Id>` constant)
- Screen size (width/height at the default rotation)
- Rotation (0–3). Orientation is expressed by this rotation (§8.9.3)
What the user specifies is a profile, not a device. Profiles are stored as an ordered array, and that order is used as the UI display order, the same-size priority for `Profile::Auto`, and the final catch-all priority.

Profile creation flow:

1. Create a profile by specifying the screen size (this size becomes the logical coordinate space of the layout).
2. Specify the rotation.
3. If multiple profiles have the same size, adjust their order on the Devices screen and place the one that `Profile::Auto` should prefer above the others.
4. If automatic selection should not be used, specify the profile explicitly with `setProfile()` in user code.

#### 8.9.2 Profile Order

Profile order can be changed on the Devices screen.

- When multiple profiles match the same screen size, `Profile::Auto` selects the first one in profile order.
- When no profile matches the screen size, `Profile::Auto` uses the first profile as the final catch-all.
- To use different layouts for different devices with the same size, user code calls `setProfile()` and specifies the profile explicitly.

#### 8.9.3 Rotation and Orientation

Orientation (portrait/landscape) is not made into a separate profile but expressed by rotation.

- A profile has a rotation (0–3). The rotation is **relative to the board's standard orientation** and is shown in the UI as 0°/90°/180°/270°. 0 (0°) = the standard orientation established by the underlying display (`M5.begin()` / `display.init()`).
- The canvas width/height become the profile's screen size with width/height swapped by the rotation.
- The runtime captures the underlying display's standard rotation as a base (via `getRotation()` in `begin()`, right after display init) and applies `setRotation((base + profile rotation) % 4)`. This makes the same project render correctly even on boards whose standard rotation is not 0 (e.g. M5GFX's M5Stack defaults to rotation 1). There is no per-device-name branching — only the generic base offset.

Changing rotation per scene (changing portrait/landscape per screen on the same device) is outside the current scope (§15).

#### 8.9.4 Profile Selection at Runtime

The guiding idea is: "**what can be selected by size is selected automatically by size match; when the same size needs a different layout, user code specifies the profile explicitly**". `Profile::Auto` (default) resolves in the following priority order.

1. **Size match**: choose among the profiles whose size equals the physical screen size (post-rotation `width()`×`height()`).
   - Exactly one matches → use it. **The normal case** — with one profile per size, every device of that size lands here automatically (no manual selection needed).
   - Multiple match → use the first one in profile order. That device is definitely of that size, so rendering it with a size-matching layout is correct. The authoring tool shows when multiple same-size profiles exist and lets the user reorder them as needed.
   - None match → next.
2. **Final catch-all**: if no size matches either (e.g. an unknown screen size), use the first profile in profile order. It still renders even at a different size (absolute drawing in logical coordinates, clipped outside the physical bounds).

An explicit `screen.setProfile(Profile::<Id>)` can override this auto resolution at any time (a self-built panel, intentionally checking a different layout, etc.).

**MCU chip type and device type are not used for detection**. To distinguish different same-size devices, resolve it via profile order or `setProfile()`.

Profile order is independent of layout saving. Because each profile fully holds its own layout (§8.2), reordering profiles does not affect any profile's layout.

**Orientation (portrait/landscape) handling**: size match **distinguishes orientation**. Because it compares the post-rotation `width()`×`height()`, 135×240 (portrait) and 240×135 (landscape) are different sizes. Example: StickCPlus (portrait 135×240) and Cardputer (landscape 240×135) resolve to different profiles under auto-detection (a separate concern from the authoring "add resolution" menu, which groups orientation-independently).

Rotation is a per-profile value (§8.9.3). To reuse a layout across orientations, create a separate profile per orientation and use "copy to start" (§8.9.6). Device-specific rotation override is outside the current scope (§15).

#### 8.9.6 Per-Profile Layout

Each profile holds the following as its own layout, **independently as complete values** (no concept of diff/base; §8.2).

- Coordinates (per part)
- Size (per part)
- Visibility (per part)
- Font size (per part)
- Rotation (per profile, §8.9.3)

A new profile can start from empty, or **start by copying** the layout of an existing profile. After copying, each profile is independent, and editing one does not propagate to the other.

The diff highlight of "showing items whose value differs from a comparison source" is a display-only aid rather than something saved, and is meaningful only when the compared targets are the same size, so it is outside the current scope (§15).

#### 8.9.7 External Displays

Small displays connected via I2C (M5UnitLCD / OLED / GLASS, etc.) are handled by creating profiles that match their screen sizes, or by explicitly selecting a profile in user code. One `LGFXScreenBuilder` instance handles one drawing target (gfx); driving the main screen and an external display simultaneously uses separate instances. Simultaneous driving of multiple screens is outside the current scope.

### 8.10 Preview Switching

On the web authoring tool, you can switch the target profile and check the layout.

The preview lets you check the following.

- Screen size
- Safe area
- Part placement
- Visibility

Hidden parts (`visible: false`) appear on the editing canvas **only while selected**,
drawn dimmed (and not drawn otherwise), so they don't clutter the layout. They remain
in the layer list at all times, so they can be selected there and repositioned. Export
and on-device rendering do not draw hidden parts at all.

### 8.11 Namespace Management

Parts are managed by unique IDs within each Scene. In the Arduino-bound generated code, instead of handling string IDs directly, they can be used as structure fields per scene.

Example:

```text
Main.title
Main.battery
Main.temperature
Main.loading
Settings.volume
Settings.brightness
```

The namespace achieves the following.

- Unique identifiers
- Auto-completion in the editor
- Improved readability of the Arduino-side API
- Support for projects organized by scene

The generated code (`Scene`, `Profile`, etc.) is wrapped in a **project-name namespace** so as not to pollute the global scope. Because the project name becomes a namespace, it is limited to a C/C++ identifier (§8.12). The `LGFXScreenBuilder` class body itself is placed globally as an entry point.

On the usage side, writing `using namespace <Project>;` lets you omit the `Scene::` / `Profile::` prefix, and omitting it lets you use the fully qualified form (`<Project>::Scene::Main`, etc.) to avoid collisions.

Arduino-side usage example (when the project name is `MyScreen`):

```cpp
using namespace MyScreen;          // optional; to omit the prefix

Scene::Main main;
main.title = "Main";
main.battery = 82;
main.temperature = "24.5C";
main.loadingVisible = false;

screen.show(main);
```

The authoring tool and the generated runtime do not provide automatic variable binding. Value sharing, conversion, and timing of reflection are the responsibility of the user code.

### 8.12 ID Naming Rules

IDs that are converted into type names, field names, and constant names in the Arduino-bound C++ code—such as scenes, parts, and assets—are in principle limited to names usable as C/C++ identifiers.

Basic rules:

- Usable characters are ASCII alphanumerics and `_`.
- The first character is a letter or `_`.
- Do not start with a digit.
- Do not use C/C++ reserved words such as `class`, `struct`, `template`, `namespace`, `int`, `float`, `bool`, `auto`.
- Do not duplicate IDs within the same Scene.
- Case-sensitive, but because it is confusing, IDs that differ only in case within the same Scene are warned.

Recommended style:

- Scene IDs are `PascalCase`. Examples: `Boot`, `Main`, `Settings`
- Part and asset IDs are `camelCase` or `snake_case`. Examples: `header`, `batteryLevel`, `loading_icon`
- Profile IDs are `PascalCase`. In the generated code they become `Profile::<Id>` constants. Examples: `Core`, `Stick`. The built-in profile representing auto-detection is `Auto` (`auto` cannot be used because it is a reserved word).
- Because the project name becomes the namespace of the generated code, it follows the same ID naming rules (C/C++ identifier; reserved words not allowed). By convention `PascalCase`. Example: `MyScreen`

The authoring tool validates IDs at input time and requires fixing invalid IDs before saving or exporting. A scheme that auto-converts to generate an alternate name is not adopted. This is to make the on-screen ID match the completion name on the Arduino side.

### 8.13 Editor Assistance

The web authoring tool provides the following assistance features.

- Auto-completion of part IDs
- Selection completion of referenced assets
- Selection completion of scene IDs
- Detection of unused assets
- Detection of ID duplication
- List filtering by ID string
- List reordering by display order
- Editing of explanatory notes (remarks)
- Pre-execution confirmation of destructive operations (such as deletion) (a policy common to all screens)

The diff highlight of "showing items whose value differs from a comparison source" is outside the current scope (it is meaningful only between profiles of the same size and has limited use; §8.9.6).

As a UI-only common item, elements that line up in a list (scenes, parts, assets, profiles) can have a `displayOrder` and a `description` (remarks). `displayOrder` is used to control the display order in the UI, and ties are sorted by ascending ID. `description` is a working note, treated as an optional, low-priority item, and is not included in the Arduino-bound output (if empty, it is not output).

### 8.14 Editor Operations (Key Map)

Common key/mouse operations are defined for the Design screen canvas. They are aligned with common conventions of shape-editing tools.

Selection and focus:

- Click a part: select it.
- Click an empty area of the canvas / outside the editing target (the screen frame / image): deselect. In Design, when deselected, the property pane displays **the properties of that screen (scene) itself (remarks, etc.)**.
- While a text input field (`input` / `textarea` / `select`) has focus, the key operations below are not performed (normal text editing takes priority).

Move and resize (for the selected element):

| Operation | Effect |
|---|---|
| `↑` `↓` `←` `→` | Move (±1px) |
| `Ctrl` (`⌘` on macOS) + arrow | Move (±10px) |
| `Shift` + arrow | Resize (`→`/`←` = width, `↓`/`↑` = height; ±1px) |
| `Ctrl` (`⌘`) + `Shift` + arrow | Resize (±10px) |
| Drag | Move (coordinates are updated live during drag) |
| `Delete` / `Backspace` | Delete the selected element (follows the destructive-operation confirmation policy; §8.13) |

Coordinates and sizes are handled as integer pixels (the profile's logical coordinates) (§7.4, §8.9.6).

Display scale and display position (pan/zoom):

- Mouse wheel: zoom in/out the canvas/image.
- Middle mouse button + drag: move the display position (pan; CAD-tool style).
- Zoom UI: place `−` / scale display / `＋` buttons and a "Reset to 100%" button on the screen (operated via UI rather than keys).

Auxiliary display:

- Major shortcuts are shown concisely as a permanently placed hint (TIPS) at the bottom-right of the screen, etc.

Text size uses the multiplier as the stored value, and the px height is auxiliary information (§8.7).

### 8.15 Layout JSON Import/Export (for AI Collaboration)

The tool exchanges the layout of a screen as a simple **JSON**, so that a screen can be handed back and forth when **asking an AI to modify or create a screen**. This is distinct from the project file (§9) and from the Arduino generated output (§10).

AI collaboration is not a replacement for the authoring tool. It is an auxiliary feature for importing and exporting static layout proposals against a user-managed project. Based on the provided JSON and contract, the AI may propose placement, size, color, visibility, Text content, and Text font choices. The user decides whether to import the result, adjust it, or add project assets such as fonts and images.

Basic flow:

1. The user prepares scenes, profiles, image assets, and adopted fonts in the tool.
2. The user copies the AI layout JSON from the Design screen.
3. The AI edits or creates a static layout according to the JSON and contract.
4. If required fonts are missing, the AI may ask the user to add fonts in an out-of-band conversation outside the JSON.
5. The user adopts fonts in Fonts mode and enables them per profile as needed.
6. The user pastes the AI JSON, reviews the preview and warnings, and then imports it.

Font addition is a human-side operation. The AI layout JSON receives adopted fonts and per-profile enabled fonts only as confirmed context; it does not add, remove, or change font assets. The AI must not put an unadopted font name into `font`; if needed, it asks the user before or after JSON generation which script, visual style, or size is required.

**Scope and granularity (decided):** the unit is **one scene across all profiles** — the same screen laid out for every device size — so the AI can keep the per-device layouts consistent in one pass. The format is **model-faithful and round-trippable**: it mirrors the internal model values almost one-to-one (absolute pixel coordinates, datum, size multiplier, color), so a layout exported from the tool and edited by the AI can be reconstructed. Stable part IDs are what make round-trip editing safe.

The AI-facing interface contract is a standalone, **English-only** document, [docs/AI_LAYOUT_IO.md](docs/AI_LAYOUT_IO.md), served verbatim on GitHub Pages (the file has no front matter, so Jekyll does not convert it). The canonical contract URL embedded in exported JSON (the `spec` field) is `https://tanakamasayuki.github.io/LGFXScreenBuilder/AI_LAYOUT_IO.md` — the same `.md` URL throughout. A Japanese reference translation for humans is provided as [docs/AI_LAYOUT_IO.ja.md](docs/AI_LAYOUT_IO.ja.md), but the contract given to AIs and the `spec` URL remain the English version. (Per the doc-naming convention this contract is intentionally English-only, since it is read by an AI.)

Format:

- Top-level: `format`, `version`, `spec` (the URL of `docs/AI_LAYOUT_IO.md`, so an AI given only the JSON can fetch the contract), `scene` (Scene ID), `desc` (description), optional `transparent` (the overlay flag of §8.16 — editable, since it changes what the scene may rely on), optional `background` and `transparentColor` (visual context; the latter only for a transparent scene), `fonts[]` (adopted-font context; not editable), and `profiles[]`.
- Value types are explicit in the contract: `w`/`h`/`x`/`y`/`rot`/`version` are integers; `size` is a number that may be fractional; `color` is `"#rrggbb"`; `visible` is boolean.
- Top-level `fonts[]`: adopted fonts with `name`, `family`, `content` (`digits` / `latin` / `ja` / `cn` / `tw` / `ko`), nominal `size`/`unit`, and approximate rendered `height`. This is emitted as authoritative context for choosing existing fonts, but importing the JSON does not add or change font assets.
- Each profile: `id`, `w`, `h`, `rot`, `fonts[]` (the adopted font names enabled for that profile; not editable), and `parts[]`.
- Each part: `id`, `type`, `visible`, plus per-type placement (Text: `x`/`y` anchor, `datum`, `size` multiplier, `color`, `text`, `font` name (or null = default); Rect: `x`/`y`/`w`/`h`/`r`/`fill`/`color`; Line: `x`/`y`/`x2`/`y2`/`color`; Circle: `x`/`y`/`r`/`fill`/`color`; Image: `x`/`y`/`w`/`h`/`asset` name (shared across profiles)).
- **Stripped:** asset binaries (Data URLs / RGB565), namespace / project name, output settings, `targetLibrary`, animation/timing, and Arduino code.
- **Invariant:** the `(id, type)` set is identical across all profiles (the data contract of §8.2). Everything else may differ per profile — coordinates, size, `color`, `visible`, and a Text's `datum`/`size`/`text`/`font`.
- The AI layout format v1 intentionally excludes editable font *family/style* selection beyond the provided font context plus a Text's `font` name + `size` + `color`, profile-specific asset replacement, image slicing, and animation. The AI normally preserves `Image.asset` and adjusts only image position, size, and visibility.
- If the AI determines that the available fonts cannot satisfy the request, it may ask the human to add fonts before or after producing the JSON. This is an **out-of-band operation outside the AI layout JSON**: do not add font-request fields to the JSON, and do not invent or use font names that are not adopted/enabled. Because fonts have storage cost, requests should be limited to cases such as missing script coverage, a large visual-style mismatch, or no natural native height, and should avoid many near-duplicate fonts in the same family.

Export (implemented): the Design screen's **"Copy AI JSON"** action (`docs/src/ailayout.js`) copies the current scene (all profiles) in this format to the clipboard as **minified JSON** (the clipboard is an AI input, so no whitespace — fewer tokens; the contract's worked example stays pretty for human readers). A file download is used as a fallback when the clipboard is unavailable.

The same per-scene layout can optionally be **embedded in the generated header** (all scenes, inside a comment block) for downstream tooling that only has the `.h` — see §10.2.

Import (implemented): the Design screen's **"Paste AI JSON"** action opens a dialog; the user pastes the JSON (minified or pretty) and sees a live preview (update vs add, part/profile counts, warnings) before applying. Chat models tend to wrap their output in a Markdown code fence (```` ```json … ``` ````, sometimes with prose around it), so import **extracts the first fenced block's inner content before parsing** (and parses as-is when no fence is present). Import is wired through the undo system (`reconcileAiLayout` / `applyAiLayout` in `docs/src/model.js`; fence stripping in `parseAiLayout`, `docs/src/ailayout.js`). Reconciliation rules:

- **Update vs add by scene ID:** if the JSON's `scene` matches an existing scene it is **overwritten**; otherwise it is **added** as a new scene.
- **Part definitions** (the shared `(id, type)` + order + `asset`) are taken from one **canonical profile** — the first profile in profile order; if other profiles' part sets differ, the canonical one wins (with a warning).
- **Profiles** are matched by `id`. A JSON profile not in the project is ignored (warning); a project profile missing from the JSON has its placements cloned from the canonical profile (warning).
- **Validation:** part IDs must be C identifiers and types known; an `asset` name not in the project is cleared to null (warning). The scene draw order is re-normalized.

File-based import and automatic creation of project profiles referenced by the JSON are outside the current scope. Profile creation stays a Devices-mode action (§15).

### 8.16 Transparent Scenes (Overlay / Dialog)

A scene can be marked **transparent**: it is drawn **on top of whatever is already on the panel**, with no background of its own. The motivating case is a dialog — a confirmation box over a running screen — where redrawing the whole screen to show a box is both wasteful and visibly flickery.

This rests on LGFXVirtualCanvas's transparent transfer (its SPEC §22, added in **1.4.0**): the tile is cleared with a **color key** and pushed with that color masked out, so every pixel the scene did not draw keeps showing the panel. That is what lets a *shaped* overlay — rounded corners, a drop shadow — sit on an existing image instead of a rectangle.

**Model.** Transparency is a property of the **scene** (`scene.transparent`), because "is this screen a dialog" is the same decision on every device; per-profile variation would only produce layouts that disagree about what they are. The color key is a property of the **project** (`project.transparentColor`, default `#002400`), because it is a palette-level reservation: the one color the project's artwork never paints. The default is LovyanGFX's `TFT_TRANSPARENT` (RGB565 `0x0120`) expressed as RGB888, i.e. LGFXVirtualCanvas's own default, so a project that leaves it alone needs no runtime configuration.

**Runtime behavior.** The mode a build resolves to (§10) decides *how*, not *whether*:

- **Buffered** (`<LGFXVirtualCanvas.h>` included): the engine sets the color key, turns the library's per-tile auto-clear back on for the duration of the render, and calls `renderTransparent()`. Auto-clear is required here — `setAutoClear(false)` combined with `renderTransparent()` is explicitly unsupported (LGFXVirtualCanvas SPEC §22.3) — so it is toggled per render rather than left off as it is for opaque scenes, which clear themselves via `fillScreen()`.
- **Direct**: nothing special is needed. Skipping the background fill *is* the transparency: the parts are opaque, so everything they do not cover is left untouched. The result differs only in that the drawing is not atomic (it can flicker), like any direct-mode drawing.
- **Buffered on LGFXVirtualCanvas < 1.4.0**: `renderTransparent()` does not exist, so a transparent scene is drawn as an **ordinary opaque screen** (the background is filled) and the build emits a `#warning`. This is a deliberate degradation rather than a hard error: it keeps a project that does not use the feature building against an older library. `Screen::supportsTransparentScenes()` reports which case a build is in, alongside `isBuffered()`.

**Contract with the application.** The library does not track layers; which screen is under the dialog and when it is dismissed stays with the sketch. Two consequences:

- **Dismissing means redrawing the screen underneath.** Showing a transparent scene never touched those pixels, so nothing else can restore them.
- A part painted **in the color key** is punched out — it becomes a hole, not a shape. The authoring tool guards this: Export lists any part in a transparent scene whose color matches the key, compared **after RGB565 quantization**, because that is the depth at which the panel and the mask actually work.

**Authoring tool.** The scene inspector carries the flag and the scene list marks such scenes. On the canvas a transparent scene shows the **image-editor checkerboard** instead of a background color, since what shows through is genuinely unknown at design time — it is whatever the device had on screen. Parts painted in the color key get the same grid (filled shapes) or a warning outline. The grid squares are a fixed CSS size and deliberately **do not scale with zoom**: like a transparency grid in an image editor, they are chrome, not content. The color-key picker appears in Output settings only once the project has a transparent scene.

**Generated output.** Both fields are emitted **only when used** (§10.1's append rule makes this safe): a transparent scene appends `true` to its `SceneDesc`, and `Project::transparentColor` is emitted only when the project has one. A project without a transparent scene therefore generates byte-identical output to before the feature existed, and its `.lgfxsb.json` is unchanged — which is why this was an additive change that did **not** bump `formatVersion` (§9.2, Layer 1).

**Not in scope.** Alpha blending / semi-transparency (the mask is per-pixel all-or-nothing; true compositing needs a full framebuffer or a panel read-back), and bounding-box optimization — the overlay is currently rendered through the full-screen `LGFXVirtualScreen`, so the draw callback runs for every tile even when the dialog is small. Routing a transparent scene through an `LGFXVirtualSprite` sized to the scene's parts is the natural next step (§16).

## 9. Project File

The official save format of a project is `.lgfxsb.json`. The user explicitly saves/loads this file, and in-browser storage is treated as an auxiliary feature for automatic restoration.

Basic startup flow:

- No startup chooser is shown: if a previous auto-save exists it is restored automatically, otherwise the sample project opens. Switching between continue / new / open is done explicitly via the toolbar New / Open.
- When creating new, specify the target library (LovyanGFX / M5GFX / M5Unified, default M5Unified), the profile to create (screen size / rotation), the project name, and the first scene. Because the target library affects the generated samples and API assumptions, it is chosen as an initial value during project creation. The output target library can be selected on the Export screen. M5GFX and M5Unified differ in the initialization of the generated sample (`display.begin()` / `M5.begin()`).
- When an existing project is opened, the profile settings in the project file are used.

A project can basically be saved as a single file.

Internally, the authoring tool separately handles a rich project JSON that is easy to edit and the generation data used for Arduino output.

The rich project JSON can hold UI display order, descriptions, selection state, preview auxiliary information, etc. The generation data is normalized to only the information needed by the Arduino runtime.

The project file includes the following.

- Meta information (including the project name and the target library. Because the project name becomes the namespace of the generated code, it is limited to a C/C++ identifier. §8.12)
- Profile definitions (ID, size, default rotation, order)
- Scene definitions
- Part definitions
- Asset definitions
- Font definitions
- Scene-level `transparent` flag (§8.16) and the project-level `transparentColor` color key; both are stored only when in use (absent = opaque / the default key)
- Output settings (the render-mode `buffered` flag = use LGFXVirtualCanvas; absent means true = buffered. §10. The `embedAiLayouts` flag = embed the AI layout comment block in the generated header; absent/false means off. §10.2)

A part's layout is held keyed by the profile ID, as a **complete value per profile** (§8.2). There is no concept of a base or a diff. For a single profile, only one set. The generated structures are determined only by the part's ID and type, and do not depend on profile or layout values.

Asset source data such as images and fonts is embedded in `.lgfxsb.json` as a Data URL. This makes it possible to carry the editing project as a single file.

Example:

```json
{
  "assets": [
    {
      "id": "logo",
      "type": "image",
      "fileName": "logo.png",
      "mime": "image/png",
      "dataUrl": "data:image/png;base64,..."
    }
  ]
}
```

The `.lgfxsb` zip package format is outside the current scope.

```text
project.lgfxsb
  project.json
  assets/
    logo.png
    icons.png
  fonts/
    main.ttf
```

The assets included in the JSON are the source data for resuming editing. The Arduino export includes data already converted for Arduino, such as RAW RGB565 or PROGMEM arrays.

The roles of saving and exporting are separated.

- Save Project: downloads `.lgfxsb.json`.
- Open Project: loads `.lgfxsb.json`.
- Export Arduino: downloads `<Project>.h` (e.g., `MyScreen.h`) or `<Project>.zip`.

Output file names are based on the project name (`<Project>.h` / `<Project>_assets.h` / `<Project>_example.ino` / `<Project>.zip`). This is aligned with the namespace of the generated code (§8.11) to avoid file collisions when multiple projects coexist.

Saving is based on downloading `.lgfxsb.json`. Overwrite saving via the File System Access API is outside the current scope.

Undo/Redo is managed with an in-memory history stack and is not included in the save file or the auto-save. It uses a snapshot scheme of the project JSON, with the maximum history count limited.

Auto-save targets only the latest state, and the Undo history is not persisted. For small state, localStorage is considered; for state including large assets, IndexedDB is considered.

Optional items are not output to the JSON if unset. By not pointlessly outputting empty strings or empty arrays, the diff of the project file is made easier to read.

At generation time, the following UI-only information is excluded from the rich project JSON.

- `displayOrder`
- `description`
- Temporary UI state such as the selected tab or selected item
- Browser-preview-only auxiliary information

### 9.2 Version Compatibility and Migration

The project file (`.lgfxsb.json`) **prioritizes backward compatibility**. The minimum guarantee is "works with the latest browser + latest library," and older project files should remain loadable as much as possible. Forward compatibility (an old tool reading a newer file) is not guaranteed; pinned operation on a past version is covered by self-hosting the authoring tool bundled in that release.

The project file carries a **`formatVersion` (integer)** on an axis **separate** from the library/tool semver. A missing value is treated as 1. `formatVersion` is bumped **only when the project-file format actually changes**, not on every release. The tool-side value lives as the `FORMAT_VERSION` constant in **`docs/src/version.js`** (kept in-tree rather than fetched, so the authoring tool works when served from `docs/` alone; updated by hand only on a format change, independently of `bump_version.py`). The round-trip check pairs with this constant to catch a forgotten bump.

Compatibility is secured in **three layers**.

**Layer 1: tolerant loader.** On load, unknown fields are ignored and missing fields are filled with defaults. As a result, additive changes that do not affect output stay backward compatible without bumping `formatVersion`.

**Layer 2: formatVersion and migration.** Only for changes the tolerant loader cannot absorb (semantic reinterpretation, a rename requiring transformation of the old value, removal) is `formatVersion` bumped, with a **forward-only chained migration** (v1→v2→…→current) applied on load. If `formatVersion` is newer than the tool knows, the file is **not rejected**: it is loaded best-effort **with a warning** (the known parts work; the warning notes that unknown fields may be dropped on save, and recommends self-hosting the matching release for pinned operation; preserving unknown fields is a future enhancement).

**Layer 3: golden checks (CI).** These mechanically detect a "forgotten bump" and a "behavior change for old files." The comparison surfaces are kept strictly separate, and **generation data and the `.h` are not used** (they would yield false positives on output-logic changes).

- **Bump completeness (project-file round-trip)**: for a representative project, check that `serialize(load(file))` equals the committed file. A diff means the load/serialize representation changed, i.e., the format moved. **If a diff appears while `formatVersion` is unchanged, CI fails** (forgotten-bump detection). Changing only the output logic (codegen) does not touch load/serialize, so it does not trigger.
- **Backward-compat correctness (two goldens, per frozen version)**: each `tests/compat/vN/` holds a frozen project plus two goldens.
  - **Header text golden** (`tools/check-compat.mjs`): load → migrate → generate with the *current* codegen and compare to the frozen `.h`. Fast, Node-only. (This is the backward-compat surface and does use the `.h`; it is separate from the bump-completeness round-trip above, which deliberately does not.)
  - **Render pixel golden** (`tests/compat/vN/test_compat_*.py`): build the frozen `.h` on the pinned `lang-ship:host` LovyanGFX backend, render every profile × scene, and check **pixel equality against frozen render PNGs**. A matching `.h` does not prove the *pixels* are unchanged, so this is the final oracle. The render engine is pinned via sketch.yaml; on an engine bump the goldens are deliberately refrozen.
  - A diff is classified as an intended change (refreeze) or a regression (fix).

The check harness reuses the production routines (`docs/src` load/serialize + codegen, host rendering) and the existing fixtures/CI (same style as `tools/gen-fixtures.mjs --check`, host-PNG pixel-diff).

**v1 frozen at initial release.** Rather than wait for the first format change, **v1 was frozen at the initial release** in `tests/compat/v1/`: a reference project that exercises the full format (every part type, an adopted font, an image asset, a rotated profile, datum variety, per-profile text) plus its header and render goldens. Layer 3 is therefore active now. `tools/check-formats.mjs` skips `tests/compat/` so the frozen projects are never re-serialized to a newer format. **On a format change, bump `FORMAT_VERSION`, add the migration, keep `tests/compat/v1/` as the v1 reference, and freeze a new `tests/compat/v2/`.**

In the worst case, even if an old generated `.h` becomes unreadable after a library upgrade, recovery is assumed via **re-generation from the project file** (the generated `.h` ⇄ runtime compatibility is best-effort).

### 9.3 In-place Save (File System Access API)

Where the browser exposes the File System Access API (`window.showOpenFilePicker` / `showSaveFilePicker`, currently Chromium-based browsers), saving **overwrites the chosen file in place** instead of downloading a fresh copy. The tool keeps a `FileSystemFileHandle` per output target — the project `.lgfxsb.json`, and the exported `.h` / `.ino` (§10.3):

- **Open** (project) uses `showOpenFilePicker` and keeps the returned handle.
- **Save / Export** writes back to the bound handle via `createWritable()` after a one-time read-write permission grant (`requestPermission({ mode: 'readwrite' })`); no download occurs. Writes are always **user-initiated** (a button gesture) — the tool never writes to disk on its own (autosave stays in localStorage only).
- If no handle is bound yet (new project, or the first save/export), the action prompts once via `showSaveFilePicker`, binds the chosen file, and writes. **Save As** re-picks and rebinds.
- **New** clears the project binding.

Browsers without the API keep the prior behavior: Open via `<input type="file">`, Save/Export via download. The localStorage autosave/restore (recovery) is unchanged and independent of this.

The binding is **not persisted across reloads** in this version: after a reload, autosave restores the content, but the first save re-prompts for the file (an IndexedDB-backed rebind is a possible later enhancement). The bound file names are shown in the UI so it is clear which file a save will overwrite.

## 10. Export Specification

The Arduino-bound export generates the following.

- Screen definition data
- Asset data
- Scene ID definitions
- Typed data structures per scene
- Part ID definitions for the low-level API
- Profile-list and scene-list metadata for tests and screen capture
- The render mode is decided at compile time by whether `<LGFXVirtualCanvas.h>` is included (direct drawing / LGFXVirtualCanvas tiled double buffering; see below)
- Sample usage code (`<Project>_example.ino`) — a **scene tour**: it shows each scene in turn in its per-profile design state via `screen.show(id)`, advancing on **button A** (M5Unified) or a **timer** (~2.5 s, bare LovyanGFX/M5GFX), with a comment showing how to push live data through a scene struct

The sample usage code is generated according to the target framework. LovyanGFX uses `LGFX_AUTODETECT` and `display.init()`, M5Unified uses `M5.begin()` and `M5.Display`, etc.—the includes and initialization differ (the drawing API is common).

The output target profiles can be generated by selecting all profiles or only specific profiles. `enum class Profile` and the generated data are narrowed to only the selected profiles. The generated output preserves the project profile order, and `Profile::Auto` resolves among the included profiles according to §8.9.4.

The generated header emits `detail::kProfileInfo[]` and `detail::kSceneInfo[]` separately from the `lgfxsb::Project` used by normal rendering. These are auxiliary metadata tables for host tests and screen capture, allowing a test harness to enumerate all included profiles and all scenes. They are not part of the drawing runtime data contract.

The actual-device render mode is **decided at compile time by whether `LGFXVirtualCanvas.h` is included**. If `#include <LGFXVirtualCanvas.h>` appears before the generated header (`MyScreen.h`)—i.e., the detection macro `LGFXVIRTUALCANVAS_H` is visible—rendering uses **tiled double buffering through LGFXVirtualCanvas**; otherwise it uses **direct drawing**. There is no runtime mode switch (no `setBuffered()`-style API).

Buffering is the **default** (direct drawing tends to flicker). The Export screen has a "Buffered (LGFXVirtualCanvas)" toggle (default on); when on, the generated sample `.ino` emits the include. That include is **wrapped in `#if __has_include(<LGFXVirtualCanvas.h>)`** so the sketch still compiles when the library isn't installed, falling back to direct drawing (with a `#warning` pointing to it). Turning the toggle off emits no include at all, so it always draws directly.

Detection looks at whether the header was **actually included** (whether the detection macro is visible), not at `__has_include` (whether it exists on the path). This way, even if the library is installed, not including it leaves the build in direct mode, avoiding unintended buffering. A direct-drawing build never even names `LGFXVirtualCanvas`, so it genuinely does not depend on it. Note that this **library-side detection (the visible macro)** is a separate layer from the generated sample `.ino`'s own `#if __has_include(...)` guard: the latter only decides whether to emit the include line (and to fall back when the library is absent); the final mode is still determined by whether the include actually happened.

The resolved mode is observable via `screen.isBuffered()` (true = tiled double buffering / false = direct drawing), so a wrong include order that silently disables buffering can be noticed.

Transparent scenes (§8.16) additionally require **LGFXVirtualCanvas 1.4.0 or newer** in a buffered build (the version is checked through its `LGFXVIRTUALCANVAS_VERSION_*` macros); an older one draws them opaque with a `#warning`. Direct drawing has no such requirement.

Include-order rule: place `<LGFXVirtualCanvas.h>` **before all generated screen headers**. Including multiple generated headers (multiple screens) does not collide, because no public macros are emitted; every screen reads the same `LGFXVIRTUALCANVAS_H`, so following the rule yields a consistent mode across all screens. Including an older `LGFXVirtualCanvas` that lacks the detection macro resolves to direct drawing (no version requirement is imposed).

Caveat (multiple translation units): a single `.ino` is fine. If generated headers are used from several `.cpp` files with inconsistent include presence per TU, the drawing-surface type can differ across TUs and cause an ODR violation. For multi-TU builds, fix the mode project-wide via a build flag or similar.

LGFXVirtualCanvas splits the screen into vertical tiles and alternates two small sprites so drawing and transfer can overlap. The default per-tile memory budget follows LGFXVirtualCanvas's default (about 19 KB). LGFXScreenBuilder does not reimplement tiling or transfer control; it draws its basic shapes, Text, and RGB565 Image parts onto the LGFXVirtualCanvas drawing surface. Image parts are pushed once per tile, so large image-heavy screens may pay extra transfer cost, but the primary target of this library is AI-assistable basic layouts centered on Rect / Line / Circle / Text, where tiled rendering is lightweight.

Comments included in the generated code (headers, the sample `.ino`, etc.) must be **English-only, or bilingual English + Japanese (`// en:` / `// ja:` form)**, and **must not be Japanese-only**, so that users of the public Arduino library can read them in English-speaking contexts too (the comment-language policy is shared with §13).

Image assets use `Header/PROGMEM + RAW RGB565` as the standard output. As a result, a UI including images can be built by importing the export result from GitHub Pages into an Arduino project.

LittleFS/SPIFFS/SD, RAM/PSRAM caches, PNG/JPEG references, RGB888/RGBA, Palette/Indexed, custom compression, and other output variations are outside the current scope.

### 10.1 Generated-Output Versioning and Compatibility

The header comment at the top of the generated output records **`FORMAT_VERSION` (and the targeted library version when known)** for diagnosing mismatches (form: `// Generated by LGFXScreenBuilder (formatVersion N). Do not edit by hand.`). The library version is added only when known from an interactive export and is **not** stamped into committed fixtures (to avoid churn on every release).

Compatibility between the generated `.h` and the runtime (the `LGFXScreenBuilder.h` engine) is **best-effort backward compatibility**: a newer engine should, as a rule, read headers produced by older tool versions. The runtime data contract (the `lgfxsb::Project` descriptor) aims to be **additive and layout-stable**; if a breaking runtime change is unavoidable, the **data-contract version is bumped and re-generation is advised**.

The descriptor is initialized as a **positional aggregate**. New fields are **appended**, and the library structs carry a **default member initializer equal to the legacy/neutral value**. Because aggregate initialization is valid with fewer initializers than members, a `.h` generated by an older tool (omitting the new field) **still compiles, and the omitted field takes its default**. The transparent-scene fields (§8.16) are the worked example: `SceneDesc::transparent` and `Project::transparentColor` are appended and emitted **only when a scene uses them**, so a project without a transparent scene generates the same bytes it did before the fields existed. Reordering, removing, or mid-inserting a field shifts positions and is a breaking change — only then is the data-contract version bumped and the header regenerated. Designated initializers (C++20) and constructors are not used, for portability and flash-placement reasons.

The **guaranteed recovery path is re-generation from the project file** (§9.2). The project file ⇄ tool backward compatibility (strongly secured in §9.2) is the source of truth; the generated `.h` is a derivative that can, in the worst case, be regenerated to follow the latest runtime. This is intentionally weaker than surface A (the project file), and is supported by re-generation always being cheap (`tools/gen-fixtures.mjs`).

### 10.2 Embedded AI Layout Block (optional)

The Export screen has an opt-in **"Embed AI layouts (comment)"** toggle (default **off**). When on, the generated header carries the AI layout JSON (§8.15) for **every scene** inside a single **comment block**, so downstream tooling can recover the layouts from the header alone — without the project file (§9). Because it is a comment, it is **stripped by the compiler and adds nothing to the compiled binary**.

The block is delimited by sentinel lines and placed at the end of the generated header:

```
/* LGFXSB-AI-LAYOUTS v1 (generated; comment only — stripped at compile, do not edit)
{ "format": "lgfxsb-ai-layouts", "version": 1, "spec": "<AI_LAYOUT_IO.md URL>",
  "scenes": [ <one §8.15 layout per scene, in scene order> ] }
LGFXSB-AI-LAYOUTS END */
```

- `scenes[]` holds one entry per scene, each **identical to the single-scene "Copy AI JSON" export of §8.15** (one scene across all profiles, self-contained including the `fonts[]` context), in project scene order. A consumer can hand any one entry to an AI verbatim.
- The embedded JSON **escapes `/` as `\/`**. This is valid JSON, and it guarantees the sequence `*/` can never occur inside the block, so the block comment cannot terminate early. A reader extracts the text between the sentinels and parses it with a normal JSON parser (no un-escaping needed; re-serialize to normalize if a clean copy is wanted).
- The toggle state is persisted in the project's output settings (§9). The default is **off** so headers stay lean for users who do not need it.
- Because this block is a consumed contract, CI verifies its invariants (`tools/check-ai-layout-embed.mjs`): opt-in, free of `*/`, parseable as-is between the sentinels, and faithful to the §8.15 output for every scene.

This block is the single source for tools such as the screenshot gallery: they parse the header once to obtain scene names, descriptions, profiles, and the per-scene AI JSON (for example, a "copy this scene's layout" button), with **no dependency on `.lgfxsb.json`**.

### 10.3 In-place Overwrite of Exported Files

Exported files reuse the in-place save mechanism of §9.3, and the **`.h` overwrite is the primary case**. It is the core of the **edit → export → screenshot-capture → fix** loop: the first Export binds the `.h` (and optionally the `_example.ino`) to a file — for example the `Sfm.h` consumed by a screenshot test repo (§10.2) — and every later **Export overwrites that same file silently**, so re-exporting after a layout fix needs no re-download or manual file replacement. With *Embed AI layouts* (§10.2) on, that single overwritten `.h` also refreshes the gallery's layout data in one step.

Each exportable file keeps its own handle, independent of the project handle, so the `.h` can be bound to a path outside the project (the test repo) while the `.lgfxsb.json` is saved elsewhere. Browsers without the File System Access API fall back to downloading the file as before (§9.3).

## 11. Proposed Arduino API Specification

The recommended API is to pass the generated scene structure to `screen.show()`. `screen` is an instance of the `Screen` class that the generated code outputs inside the project namespace (a thin facade that binds the project descriptor to the shared engine; details below).

The following examples assume the generated code is imported with `using namespace <Project>;` (e.g., `MyScreen`), allowing the `Scene::` / `Profile::` / `Screen` prefix to be omitted (§8.11).

A scene with no data is drawn by passing a temporary object.

```cpp
screen.show(Scene::Boot{});
```

A scene with data is drawn by assigning values to the generated structure.

```cpp
Scene::Main main;
main.title = "Main";
main.battery = 82;
main.temperature = "24.5C";
main.wifiVisible = true;

screen.show(main);
```

To redraw with new values, pass the updated scene structure to `show` again (drawing is always a single `show`).

```cpp
main.battery = 79;
main.temperature = "25.1C";
screen.show(main);
```

### 11.1 Shared Engine and Generated Facade

The library provides a **shared engine** that holds the drawing logic, and a **thin facade class `Screen`** generated per project binds the project descriptor to it.

Shared engine (on the library side; not used directly by the user):

```cpp
namespace lgfxsb {
  struct Project { /* profiles, scenes[], assets[] */ };

  // The drawing engine is parameterized by the canvas type Canvas. The generated
  // header selects this type via the include detection in §10 (lgfx::LGFXBase for
  // direct, LGFXVirtualCanvas for buffered), and it is instantiated once per build.
  template <class Canvas>
  class RendererT {
  protected:
    lgfx::LGFX_Device* _gfx = nullptr;   // base of LGFX / M5GFX / M5.Display
    const Project& _project;
    uint8_t _profile = 0;          // 0 = Auto (actual resolution is applied at draw time)
    // draws parts onto a Canvas; in buffered mode this runs once per tile
    template <class SceneT>
    void renderScene(SceneId id, const Value* values, uint16_t count, const SceneT& s);
  public:
    RendererT(lgfx::LGFX_Device& gfx, const Project& project) : _gfx(&gfx), _project(project) {}
    void begin();                  // configuration hook after display init (does not touch profile selection)
  };
}
```

Generated code (output to the project namespace; data types + facade class):

```cpp
namespace MyScreen {

enum class Profile : uint8_t { Auto = 0, Core, Stick, Cardputer };

namespace Scene {
  struct Boot { static constexpr SceneId id = SceneId::Boot; };
  struct Main {
    static constexpr SceneId id = SceneId::Main;
    const char* title = "";
    int battery = 0;
    const char* temperature = "";
    bool wifiVisible = true;
  };
}

extern const lgfxsb::Project project;          // entry point for all data (generated)

// Compile-time render-mode selection via include detection (§10).
#if defined(LGFXVIRTUALCANVAS_H)
using Canvas = LGFXVirtualCanvas;              // tiled double-buffered surface
#else
using Canvas = lgfx::LGFXBase;                 // direct-drawing surface (base of device / sprite)
#endif

class Screen : public lgfxsb::RendererT<Canvas> {  // project-specific facade
public:
  explicit Screen(lgfx::LGFX_Device& gfx) : RendererT(gfx, project) {}   // bind the descriptor
  void setProfile(Profile p);                  // accepts only this type (other projects are type errors)

  bool isBuffered() const;                      // observe the resolved mode (true = buffered / false = direct)
  bool supportsTransparentScenes() const;       // false only when buffered on LGFXVirtualCanvas < 1.4.0 (§8.16)

  void show(lgfxsb::SceneId id);                // for tests/capture (draws with preview values)
  void show(const Scene::Boot& s);              // overload per scene type in this project
  void show(const Scene::Main& s);

  // optional dynamic overlay, registered once per scene (§11.4)
  void setOverlay(void (*fn)(Canvas&, const Scene::Boot&));
  void setOverlay(void (*fn)(Canvas&, const Scene::Main&));
};

} // namespace MyScreen
```

Because `Screen` binds the descriptor in its constructor, the user does not need to pass `project` every time. `setProfile()` names the `Profile` of the same namespace, so it is type-safe (passing another project's `Profile` is a compile error).

The receiving type for `gfx` is `lgfx::LGFX_Device` (a subclass of the `LovyanGFX` base). The LovyanGFX autodetect `LGFX`, `M5GFX`, and `M5.Display` that the user passes are all derived from `lgfx::LGFX_Device`, so they can be accepted by the same API.

`show` is emitted by the generated code as **function overloads** per scene type (not templates). Because overloads exist only for the generated scene types of the project itself, the "limited to this project's scenes" property is preserved, and passing an unknown type is a compile error. The template syntax is not exposed on `show` (only the overlay hook lets the user optionally template the gfx parameter; see §11.4).

`show(lgfxsb::SceneId id)` is an auxiliary API for host tests and screen capture. It draws a scene enumerated from `detail::kSceneInfo[]` using the generated preview strings instead of dynamic Text values. Normal application code should use the typed overloads that accept generated scene structures.

The actual-device render mode is fixed at compile time by the `LGFXVirtualCanvas.h` include detection of §10; there is no runtime switch. The generated facade selects the drawing-surface type `Canvas` (direct: `lgfx::LGFXBase`, buffered: `LGFXVirtualCanvas`) from the detection and instantiates the shared engine with it. The resolved mode is observable via `screen.isBuffered()` (true = tiled double buffering / false = direct drawing), which helps notice a wrong include order. `screen.supportsTransparentScenes()` reports whether transparent scenes (§8.16) are honored in this build.

### 11.2 Usage Example

```cpp
#include <LovyanGFX.hpp>
#include <LGFX_AUTODETECT.hpp>
#include <LGFXVirtualCanvas.h>    // use the default tiled double buffering (drop it for direct; §10)
#include <LGFXScreenBuilder.h>
#include "MyScreen.h"             // generated output (ProjectName.h)

using namespace MyScreen;          // omit Scene:: / Profile:: / Screen (optional)

static LGFX display;
static Screen screen(display);     // the project is already bound to the class

void setup() {
  display.init();
  screen.begin();                  // configuration hook after display init

  screen.show(Scene::Boot{});

  Scene::Main main;
  main.title       = "Main";
  main.battery     = 82;
  main.temperature = "24.5C";
  screen.show(main);
}

void loop() {
  static Scene::Main main;
  main.battery     = readBattery();
  main.temperature = formatTemp(readTemp());
  screen.show(main);               // redraw with new values (drawing is always show)
  delay(1000);
}
```

Normally, `setProfile()` is not called, and it is left to the default `Profile::Auto` (auto-detection by screen size).

### 11.3 Profile Selection (Order-Independent, Draw-Time Resolution)

The order of `setProfile()` and `begin()` is not fixed. Because `setProfile()` only records the selection and does not touch the hardware, it can be called either before or after `begin()`, or to switch during execution. The actual resolution of `Profile::Auto` and the rotation (`setRotation`) are applied at draw time (`show`), so as long as the order `display.init()` → `show()` is observed, there is no need to be conscious of the order.

```cpp
screen.setProfile(Profile::Stick);   // override auto-detection (self-built panel, etc.); either before or after begin
screen.setProfile(Profile::Auto);    // return to auto-detection
```

`Profile::Auto` resolves by size match, then profile order (§8.9). What the user specifies is a profile, not a device. Because `auto` is a C/C++ reserved word, auto-detection is `Auto`. When multiple projects coexist, the `Screen` class becomes a distinct type, and passing another project's `Profile` / `Scene` is a type error (§8.11).

M5GFX is integrated into the same API to the extent that it can be treated as a LovyanGFX derivative or compatible API.

`show("Main")` and `setText("Main.temperature", "...")` using string IDs are treated as a debugging-use or low-level-compatibility API, and are not made the recommended API for normal use.

### 11.4 Dynamic Drawing Hook (overlay)

A hook is provided to **composite dynamic drawing that parts cannot express** (gauge needles, waveforms, etc.) **into the same buffer as the static parts**. Drawing directly after `show()` returns would require a separate buffer and reintroduce flicker, so the drawing is invoked from inside `show`. This is positioned as the single buffer-consistent route for the non-goal of §3 (user-custom drawing).

- **Registered once per scene** (pre-registration). `setOverlay` is overloaded per scene type, so overload resolution dispatches "second-argument type → that scene's slot" in a type-safe way. The `show` call sites stay unaware of overlays.
- **The signature is `void(Canvas&, const SceneT&)`**. The user may template the gfx parameter as `template <class GFX>`. Because the render mode is fixed to a single `Canvas`, `GFX = Canvas` is deduced at registration, so the user need not name `Canvas`. The scene type is mandatory: it carries both typed data access (`s.battery`, etc.) and the registration-slot selection.
- **Invocation timing**: called **after** each `show` has drawn the static parts. It runs **once per tile in buffered mode** and **once in direct mode**. Therefore the overlay must be **draw-only and idempotent**. Advance state (animation, `millis()`, sensor reads) in `loop()`, and pass results via the scene struct `s` or your own state; the same input must always produce the same picture.
- For an unregistered scene, nothing extra is drawn.
- `show(lgfxsb::SceneId)` (the preview/capture path) does not invoke overlays, since it has no dynamic data.

The documentation example uses no `using namespace`; it shows a namespace-qualified named function.

```cpp
#include <LovyanGFX.hpp>
#include <LGFX_AUTODETECT.hpp>
#include <LGFXVirtualCanvas.h>      // include => tiled double buffering / drop it => direct (§10)
#include <LGFXScreenBuilder.h>
#include "MyScreen.h"

static LGFX display;
static MyScreen::Screen screen(display);

// Dynamic drawing for the Main scene that parts cannot express.
// Templating the gfx parameter avoids naming the canvas type.
// The scene type stays explicit (typed data + registration-slot selection).
template <class GFX>
void mainOverlay(GFX& g, const MyScreen::Scene::Main& s) {
  const float a = s.battery / 100.0f * 270 - 135;
  g.drawLine(120, 120,
             120 + cosf(a * DEG_TO_RAD) * 60,
             120 + sinf(a * DEG_TO_RAD) * 60, TFT_RED);
}

void setup() {
  display.init();
  screen.begin();
  screen.setOverlay(mainOverlay);          // register once; deduces GFX = Canvas
}

void loop() {
  static MyScreen::Scene::Main main;
  main.battery = readBattery();            // advance state here, outside the overlay
  screen.show(main);                       // the overlay runs automatically (per tile when buffered)
  delay(100);
}
```

Writing the concrete `MyScreen::Canvas&` directly also binds to the same `setOverlay` (use this if you want body type errors reported at definition time).

## 12. Host Preview and Screenshots

In addition to actual-device checking, a mechanism is provided to output the drawing result as a PNG in a host environment.

Because LovyanGFX's host execution environment can turn the drawing result into a PNG using `createPng()`, the generated code includes metadata that lets test code enumerate all profiles and scenes.

Assumed uses:

- Regression testing of the generated UI
- PNG snapshot checking on GitHub Actions
- Comparison of direct LovyanGFX/M5GFX drawing and drawing via LGFXVirtualCanvas
- Checking the diff between the approximate font preview and the actual drawing result

Example of the generated test/capture metadata:

```cpp
namespace MyScreen::detail {
  struct ProfileInfo {
    const char* name;
    uint8_t index;
    int16_t w, h;
    uint8_t rotation;
  };

  struct SceneInfo {
    const char* name;
    lgfxsb::SceneId id;
    uint16_t index;
  };

  static constexpr ProfileInfo kProfileInfo[];
  static constexpr uint8_t kProfileInfoCount;
  static constexpr SceneInfo kSceneInfo[];
  static constexpr uint16_t kSceneInfoCount;
}
```

Capture code can loop over `detail::kProfileInfo[]` and `detail::kSceneInfo[]`, call `screen.setProfile(static_cast<Profile>(profile.index + 1))`, and then call `screen.show(scene.id)` to draw every combination. `profile.name` and `scene.name` are intended for filenames. By changing only the generated header name and namespace, the same capture harness can be reused across projects.

These arrays are not referenced by `Screen` or `lgfxsb::Project`. In normal Arduino builds they remain unused, so optimization can discard them rather than keeping them in flash.

## 13. Proposed Directory Structure

```text
LGFXScreenBuilder/
  src/                              # Arduino runtime (header-only)
    LGFXScreenBuilder.h             #   umbrella header
    lgfxscreenbuilder_version.h
    lgfxsb/
      Types.h                       #   enums + Value
      Project.h                     #   generated-data descriptor (data contract)
      Renderer.h                    #   shared rendering engine
  examples/
    BasicLovyanGFX/                 # LovyanGFX variant (real ESP32 + Native/SDL preview)
      BasicLovyanGFX.ino
      MyScreen.h                    #   sample generated header
    BasicM5Unified/                 # M5Unified variant (differs only in include + init; MyScreen.h shared)
      BasicM5Unified.ino
      MyScreen.h
  docs/                             # GitHub Pages site = the authoring tool (static ES modules, no build)
    index.html
    styles.css
    src/                            #   model.js / store.js / design.js / main.js
  tools/
    bump_version.py
  tests/                            # host-build pytest harness
  SPEC.ja.md  SPEC.md  README.md  README.ja.md
  library.properties
```

GitHub Pages publishes `docs/`. **The authoring tool itself lives directly under `docs/`** (since it is a no-build static artifact, `docs/` is both the source and the published site). No separate build/CI step is needed. `src/` (the Arduino library) is header-only (no `.cpp`; §11.1). `tools/` holds development helpers such as the release script.

#### Comment Language Policy

Comments in the code within the repository (`src/`, `examples/`, the tool, and generated output) **must not be Japanese-only**. They are English-only, or bilingual English + Japanese (`// en:` / `// ja:` form). Guidelines:

- `examples/` (sample programs): basically bilingual, since this is where Japanese users learn.
- `src/`: bilingual is preferred, but English-only is also acceptable.
- Generated code (`<Project>.h`, the sample `.ino`): English-only or bilingual (§10).

This is a policy about in-code comments, separate from the documentation file naming (Japanese = `*.ja.md`, English = `*.md`).

## 14. GitHub Pages Distribution Requirements

The authoring tool runs on GitHub Pages.

Published URL:

```text
https://tanakamasayuki.github.io/LGFXScreenBuilder/
```

GitHub Pages publishes the `docs/` directory of the `main` branch.

Local verification is done as follows.

```sh
python -m http.server 8000 --directory docs
```

Verification URL:

```text
http://localhost:8000/
```

So that it also works under a GitHub Pages project page, references to CSS/JavaScript/images use relative paths such as `./styles.css` and `./app.js`.

Requirements:

- Can be distributed with static files only.
- Works in one of the latest Chrome, Edge, Firefox, or Safari.
- Can read and write project files as local files.
- Can download the export result as a ZIP or multiple files.
- It is desirable that editing work can continue after the page is loaded, even without a network connection.
- UI strings are localized via key management equivalent to `data-i18n` or an equivalent mechanism, and wording is not scattered across HTML/logic.
- The bundled languages are `en`, `ja`, `zh-Hans`, `zh-Hant`, `ko`, `es`, `fr`, and `de`; `en` is the default for unsupported browser languages. The browser language auto-selects the initial one (Chinese resolves to `zh-Hant` for Taiwan/Hong Kong/Macau or an explicit `-hant` tag, otherwise `zh-Hans`).
- When a translation key is missing, fall back to `en`. CI enforces full key parity across every language table (`tools/check-i18n.mjs`), so a forgotten key fails the build instead of leaking English at runtime.
- Accessibility wording other than display text, such as `placeholder`, `aria-label`, and `title`, is also a translation target.

### 14.1 Release Bundling and Self-Hosting (Pinning a Past Version)

GitHub Pages always serves the latest (`docs/` of `main`). For **pinned operation** on a past version, each release **bundles the authoring tool**.

- The release archive (zip) contains all tracked files except tests, so **`docs/` (the whole tool) + the library + examples are bundled at the same tag**.
- Because `docs/` is a no-build static site, extracting the archive and serving its root self-hosts that version's tool (served under `docs/`). Serving the release root also lets the tool reach `../library.properties` etc.
- This reproduces **deterministic output** for that tool+library combination. It is also the recommended path when a file's `formatVersion` is newer than the tool knows (§9.2).
- Version visibility: `formatVersion` is shown from `docs/src/version.js` with docs alone; the library/release semver is shown best-effort by reading `library.properties` when the release root is served (omitted when serving `docs/` standalone).

Self-hosting steps:

```sh
# Extract the release archive and serve its root
python -m http.server 8000 --directory LGFXScreenBuilder-<version>
# → open http://localhost:8000/docs/
```

## 15. Current Scope

LGFXScreenBuilder is responsible for creating AI-assistable static basic layouts and generating drawing data that is convenient for Arduino code. The current scope is as follows.

- Basic screens of the web authoring tool (3 panes + mode switching, ja/en, startup flow)
- Profile creation (screen size / default rotation), `Profile::Auto` auto-detection, and profile reordering
- Scene creation
- Text/Image/Rect/Line/Circle part placement (direct manipulation: add/move/resize/layer order)
- Text font selection, size, color, datum, and single-line display
- PNG image asset registration (Data URL embedding)
- JSON project save/load (single `.lgfxsb.json`, download method)
- Arduino header file output (Header/PROGMEM + RAW RGB565, single header)
- Static scene drawing in LovyanGFX/M5GFX
- Text part value update / visibility toggling
- Undo/Redo (in-memory history)
- Auto-save/restore (latest state only, lightweight)
- ID validation / duplication detection
- Basic sample

The current scope excludes the following.

- Diff highlight display of "items whose value differs from a comparison source" (valid only between the same sizes)
- Per-scene rotation setting (rotation is per profile)
- Reverse-lookup input of text size px height (entering a px height to automatically select the font + multiplier; the current scope uses multiplier specification + px auxiliary display. §8.7)
- Text box (giving Text a width and height to perform clipping/wrapping/in-box alignment; the current scope has only single-line anchor + datum. §8.7)
- File-based AI layout import (clipboard paste import and export are implemented — "Paste AI JSON" / "Copy AI JSON"; opening a `.json` file is outside the current scope. §8.15)
- Device-specific rotation override (rotation is per profile. §8.9.4)
- Animation in general (frame/fade/move/scale, playback and editing)
- Additional Parts such as Icon/Gauge/Graph/Container/Button
- Ellipse
- ValueText/Value family (dedicated numeric display: prefix/suffix/decimal places/unit)
- Custom font (TTF/OTF) registration and management (the current scope uses LovyanGFX/M5GFX preset fonts)
- Asset slicing (§8.5)
- Profile-specific image asset replacement
- Sprite sheets (§8.6)
- Asset storage-destination variations (LittleFS/SPIFFS/SD/RAM/PSRAM)
- Drawing format variations (RGB888/RGBA, Palette, PNG/JPEG, custom compression) / in-memory and compressed drawing paths
- ZIP package output (`.lgfxsb` / `<Project>.zip`)
- Overwrite saving via the File System Access API
- Advanced editor assistance (unused asset detection, per-device diff display, etc.)
- Host-environment screenshots / regression test helpers (§12)
- Actual-device preview
- UIFlow integration
- Component sharing
- Cloud storage

## 16. Future Extensions

The following are considered in the future.

- Web simulator
- Actual-device preview
- UIFlow integration
- Data binding
- Theme management
- Component library sharing
- Automatic Pages deployment via GitHub Actions
- Editor completion using TypeScript type definitions
- Multi-language documentation
- Static text designation (fixed text not exposed as a value; §16.1)
- Font context JSON (limited subset for AI / font asset management; §16.2)
- Bounding-box overlays: render a transparent scene (§8.16) through an `LGFXVirtualSprite` sized to its parts, so the draw callback and the masked scan cover only the dialog instead of the whole screen
- Per-scene color key, if a project ever needs two different transparent palettes (§8.16 keeps it project-wide today)

### 16.1 Static text (fixed-text designation)

Add a flag to a Text part to choose between fixed text (a literal) and a settable value.

- The current generated code emits every Text as a settable field, but fixed labels whose content is determined by ID should not be exposed as values — they should be embedded as literals in the generated code.
- Add a `static` (fixed / not exposed — descriptor preview string only, not a struct field) vs `dynamic` (settable value) distinction on Text.
- This is a tool-wide Text feature.

### 16.2 Font context JSON (for AI / font asset management)

In the future, consider a limited JSON format for font asset management and pre-layout AI consultation, separate from the layout JSON.

This is not part of the layout JSON contract in [docs/AI_LAYOUT_IO.md](docs/AI_LAYOUT_IO.md). AI Layout I/O handles only the confirmed information needed to round-trip-edit a screen layout. Font-addition decisions and font asset inventory are a different responsibility, so they should be defined as a separate specification only when needed.

Possible uses:

- Let an AI inspect only the available fonts before generating a layout JSON.
- Decide whether an out-of-band font-addition request is needed for the required script, visual style, or size.
- Inspect adopted fonts, per-profile enabled fonts, font size/script/flash-cost information, and related font asset management data.

This is not implemented for now. The format name, fields, and UI (for example, "Copy font context JSON") are undecided. If introduced, it should be a separate command and separate specification, not mixed into AI layout JSON with fields such as `fontRequests`.
