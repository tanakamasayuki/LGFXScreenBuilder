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

- Full-screen fills and background clears are based on the physical size of the actual device (`gfx.width()` / `gfx.height()`).
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

**There is no separate type for fixed labels.** A fixed label is expressed as a `Text` whose value is never assigned at runtime. The generated scene struct's Text field defaults to the design string (§8.2), so if you never assign it, that design string is drawn as-is with no user code; only the ones you assign change dynamically. This keeps the model simple without adding a type. (If a future optimization needs to keep fixed labels out of the scene struct, it would be added as an optional per-Text `dynamic: false` flag — append-only — rather than a new type. §15.)

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

The tool handles the **preset fonts built into LovyanGFX / M5GFX**. The runtime does not output any font payload; it merely references a font with `setFont(&fonts::<Name>)`. **Custom fonts** that generate glyph data for only the used characters from a PC font (TTF/OTF) are not handled in the current specification. If custom fonts are added, the intended scheme — like image assets — is to extract the used characters into data and use the same glyphs in the browser and on the device (consistent with the future direction at the end of this section).

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

- Top-level: `format`, `version`, `spec` (the URL of `docs/AI_LAYOUT_IO.md`, so an AI given only the JSON can fetch the contract), `scene` (Scene ID), `desc` (description), optional `background` (visual context), `fonts[]` (adopted-font context; not editable), and `profiles[]`.
- Value types are explicit in the contract: `w`/`h`/`x`/`y`/`rot`/`version` are integers; `size` is a number that may be fractional; `color` is `"#rrggbb"`; `visible` is boolean.
- Top-level `fonts[]`: adopted fonts with `name`, `family`, `content` (`digits` / `latin` / `ja` / `cn` / `tw` / `ko`), nominal `size`/`unit`, and approximate rendered `height`. This is emitted as authoritative context for choosing existing fonts, but importing the JSON does not add or change font assets.
- Each profile: `id`, `w`, `h`, `rot`, `fonts[]` (the adopted font names enabled for that profile; not editable), and `parts[]`.
- Each part: `id`, `type`, `visible`, plus per-type placement (Text: `x`/`y` anchor, `datum`, `size` multiplier, `color`, `text`, `font` name (or null = default); Rect: `x`/`y`/`w`/`h`/`r`/`fill`/`color`; Line: `x`/`y`/`x2`/`y2`/`color`; Circle: `x`/`y`/`r`/`fill`/`color`; Image: `x`/`y`/`w`/`h`/`asset` name (shared across profiles)).
- **Stripped:** asset binaries (Data URLs / RGB565), namespace / project name, output settings, `targetLibrary`, animation/timing, and Arduino code.
- **Invariant:** the `(id, type)` set is identical across all profiles (the data contract of §8.2). Everything else may differ per profile — coordinates, size, `color`, `visible`, and a Text's `datum`/`size`/`text`/`font`.
- The AI layout format v1 intentionally excludes editable font *family/style* selection beyond the provided font context plus a Text's `font` name + `size` + `color`, profile-specific asset replacement, image slicing, and animation. The AI normally preserves `Image.asset` and adjusts only image position, size, and visibility.
- If the AI determines that the available fonts cannot satisfy the request, it may ask the human to add fonts before or after producing the JSON. This is an **out-of-band operation outside the AI layout JSON**: do not add font-request fields to the JSON, and do not invent or use font names that are not adopted/enabled. Because fonts have storage cost, requests should be limited to cases such as missing script coverage, a large visual-style mismatch, or no natural native height, and should avoid many near-duplicate fonts in the same family.

Export (implemented): the Design screen's **"Copy AI JSON"** action (`docs/src/ailayout.js`) copies the current scene (all profiles) in this format to the clipboard as **minified JSON** (the clipboard is an AI input, so no whitespace — fewer tokens; the contract's worked example stays pretty for human readers). A file download is used as a fallback when the clipboard is unavailable.

Import (implemented): the Design screen's **"Paste AI JSON"** action opens a dialog; the user pastes the JSON (minified or pretty) and sees a live preview (update vs add, part/profile counts, warnings) before applying. Chat models tend to wrap their output in a Markdown code fence (```` ```json … ``` ````, sometimes with prose around it), so import **extracts the first fenced block's inner content before parsing** (and parses as-is when no fence is present). Import is wired through the undo system (`reconcileAiLayout` / `applyAiLayout` in `docs/src/model.js`; fence stripping in `parseAiLayout`, `docs/src/ailayout.js`). Reconciliation rules:

- **Update vs add by scene ID:** if the JSON's `scene` matches an existing scene it is **overwritten**; otherwise it is **added** as a new scene.
- **Part definitions** (the shared `(id, type)` + order + `asset`) are taken from one **canonical profile** — the first profile in profile order; if other profiles' part sets differ, the canonical one wins (with a warning).
- **Profiles** are matched by `id`. A JSON profile not in the project is ignored (warning); a project profile missing from the JSON has its placements cloned from the canonical profile (warning).
- **Validation:** part IDs must be C identifiers and types known; an `asset` name not in the project is cleared to null (warning). The scene draw order is re-normalized.

File-based import and automatic creation of project profiles referenced by the JSON are outside the current scope. Profile creation stays a Devices-mode action (§15).

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
- Output settings

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
- **Backward-compat correctness (render goldens)**: for each past version, load → migrate → generate → render on host the frozen project file, and check **pixel equality against frozen render PNGs (per profile × scene)** (within tolerance). A successful structural migration does not prove visual identity, so the rendered result is the final oracle. A diff is classified as an intended change (refreeze) or a regression (fix). The render engine is pinned via sketch.yaml; on an engine bump the goldens are deliberately refrozen. If isolating the cause is needed, keep current-format goldens too, so that a diff only in the past-version goldens indicates a migration-specific issue.

The check harness reuses the production routines (`docs/src` load/serialize + codegen, host rendering) and the existing fixtures/CI (same style as `tools/gen-fixtures.mjs --check`, host-PNG pixel-diff).

**Pre-first-release operation.** `formatVersion` stays 1, and since there are no past versions, the goldens (render PNGs, frozen projects) need not be created yet. The round-trip check already works with the current fixtures. **At the first format change (when the round-trip diffs), freeze v1** and activate Layer 3.

In the worst case, even if an old generated `.h` becomes unreadable after a library upgrade, recovery is assumed via **re-generation from the project file** (the generated `.h` ⇄ runtime compatibility is best-effort).

## 10. Export Specification

The Arduino-bound export generates the following.

- Screen definition data
- Asset data
- Scene ID definitions
- Typed data structures per scene
- Part ID definitions for the low-level API
- Profile-list and scene-list metadata for tests and screen capture
- The render mode is decided at compile time by whether `<LGFXVirtualCanvas.h>` is included (direct drawing / LGFXVirtualCanvas tiled double buffering; see below)
- Sample usage code (`<Project>_example.ino`)

The sample usage code is generated according to the target framework. LovyanGFX uses `LGFX_AUTODETECT` and `display.init()`, M5Unified uses `M5.begin()` and `M5.Display`, etc.—the includes and initialization differ (the drawing API is common).

The output target profiles can be generated by selecting all profiles or only specific profiles. `enum class Profile` and the generated data are narrowed to only the selected profiles. The generated output preserves the project profile order, and `Profile::Auto` resolves among the included profiles according to §8.9.4.

The generated header emits `detail::kProfileInfo[]` and `detail::kSceneInfo[]` separately from the `lgfxsb::Project` used by normal rendering. These are auxiliary metadata tables for host tests and screen capture, allowing a test harness to enumerate all included profiles and all scenes. They are not part of the drawing runtime data contract.

The actual-device render mode is **decided at compile time by whether `LGFXVirtualCanvas.h` is included**. If `#include <LGFXVirtualCanvas.h>` appears before the generated header (`MyScreen.h`)—i.e., the detection macro `LGFXVIRTUALCANVAS_H` is visible—rendering uses **tiled double buffering through LGFXVirtualCanvas**; otherwise it uses **direct drawing**. Buffering is the default, and the generated sample `.ino` includes `#include <LGFXVirtualCanvas.h>` by default; to use direct drawing, simply drop that include. There is no runtime mode switch (no `setBuffered()`-style API).

Detection looks at whether the header was **actually included**, not at `__has_include` (whether it exists on the path). This way, even if the library is installed, not including it leaves the build in direct mode, avoiding unintended buffering. A direct-drawing build never even names `LGFXVirtualCanvas`, so it genuinely does not depend on it.

The resolved mode is observable via `screen.isBuffered()` (true = tiled double buffering / false = direct drawing), so a wrong include order that silently disables buffering can be noticed.

Include-order rule: place `<LGFXVirtualCanvas.h>` **before all generated screen headers**. Including multiple generated headers (multiple screens) does not collide, because no public macros are emitted; every screen reads the same `LGFXVIRTUALCANVAS_H`, so following the rule yields a consistent mode across all screens. Including an older `LGFXVirtualCanvas` that lacks the detection macro resolves to direct drawing (no version requirement is imposed).

Caveat (multiple translation units): a single `.ino` is fine. If generated headers are used from several `.cpp` files with inconsistent include presence per TU, the drawing-surface type can differ across TUs and cause an ODR violation. For multi-TU builds, fix the mode project-wide via a build flag or similar.

LGFXVirtualCanvas splits the screen into vertical tiles and alternates two small sprites so drawing and transfer can overlap. The default per-tile memory budget follows LGFXVirtualCanvas's default (about 19 KB). LGFXScreenBuilder does not reimplement tiling or transfer control; it draws its basic shapes, Text, and RGB565 Image parts onto the LGFXVirtualCanvas drawing surface. Image parts are pushed once per tile, so large image-heavy screens may pay extra transfer cost, but the primary target of this library is AI-assistable basic layouts centered on Rect / Line / Circle / Text, where tiled rendering is lightweight.

Comments included in the generated code (headers, the sample `.ino`, etc.) must be **English-only, or bilingual English + Japanese (`// en:` / `// ja:` form)**, and **must not be Japanese-only**, so that users of the public Arduino library can read them in English-speaking contexts too (the comment-language policy is shared with §13).

Image assets use `Header/PROGMEM + RAW RGB565` as the standard output. As a result, a UI including images can be built by importing the export result from GitHub Pages into an Arduino project.

LittleFS/SPIFFS/SD, RAM/PSRAM caches, PNG/JPEG references, RGB888/RGBA, Palette/Indexed, custom compression, and other output variations are outside the current scope.

### 10.1 Generated-Output Versioning and Compatibility

The header comment at the top of the generated output records **`FORMAT_VERSION` (and the targeted library version when known)** for diagnosing mismatches (form: `// Generated by LGFXScreenBuilder (formatVersion N). Do not edit by hand.`). The library version is added only when known from an interactive export and is **not** stamped into committed fixtures (to avoid churn on every release).

Compatibility between the generated `.h` and the runtime (the `LGFXScreenBuilder.h` engine) is **best-effort backward compatibility**: a newer engine should, as a rule, read headers produced by older tool versions. The runtime data contract (the `lgfxsb::Project` descriptor) aims to be **additive and layout-stable**; if a breaking runtime change is unavoidable, the **data-contract version is bumped and re-generation is advised**.

The descriptor is initialized as a **positional aggregate**. New fields are **appended**, and the library structs carry a **default member initializer equal to the legacy/neutral value**. Because aggregate initialization is valid with fewer initializers than members, a `.h` generated by an older tool (omitting the new field) **still compiles, and the omitted field takes its default**. Reordering, removing, or mid-inserting a field shifts positions and is a breaking change — only then is the data-contract version bumped and the header regenerated. Designated initializers (C++20) and constructors are not used, for portability and flash-placement reasons.

The **guaranteed recovery path is re-generation from the project file** (§9.2). The project file ⇄ tool backward compatibility (strongly secured in §9.2) is the source of truth; the generated `.h` is a derivative that can, in the worst case, be regenerated to follow the latest runtime. This is intentionally weaker than surface A (the project file), and is supported by re-generation always being cheap (`tools/gen-fixtures.mjs`).

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

The actual-device render mode is fixed at compile time by the `LGFXVirtualCanvas.h` include detection of §10; there is no runtime switch. The generated facade selects the drawing-surface type `Canvas` (direct: `lgfx::LGFXBase`, buffered: `LGFXVirtualCanvas`) from the detection and instantiates the shared engine with it. The resolved mode is observable via `screen.isBuffered()` (true = tiled double buffering / false = direct drawing), which helps notice a wrong include order.

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
- The initially bundled languages are `ja` and `en`, and `en` is the default for unsupported browser languages.
- Candidate extension languages are major languages such as `zh-Hans`, `zh-Hant`, `ko`, `es`, `de`, `fr`.
- When a translation key is missing, fall back to `en`.
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
