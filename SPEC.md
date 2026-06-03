# LGFXScreenBuilder Specification

## 1. Overview

LGFXScreenBuilder is a project for creating the screen data of Arduino applications that use LovyanGFX and M5GFX with a browser-based authoring tool, and outputting it in a form usable as an Arduino library.

This project does not provide a GUI framework itself. Instead, it provides a mechanism for designing and managing screen layouts, assets, scenes, and animation definitions, and treating them on the embedded side as a lightweight drawing runtime.

Instead of building screens directly in code, developers design screens with an HTML-based authoring tool that runs on GitHub Pages, and incorporate the generated data into their Arduino projects.

## 2. Goals

- Make it possible to create screen layouts for LovyanGFX/M5GFX with a GUI.
- Separate screen design from the application logic on the Arduino side.
- Centrally manage scenes, parts, assets, and animations.
- Provide a structure that can support multiple M5Stack-family devices and LovyanGFX-compatible devices.
- Make it possible to easily load the generated output from an Arduino library and update the screen display simply by updating values.
- Make it possible to distribute and run the authoring tool using GitHub Pages alone.

## 3. Non-Goals

- Do not implement a general-purpose GUI framework like LVGL.
- Do not provide a complex widget-tree management API on the Arduino side.
- Do not require a web server or cloud storage features.
- In the initial phase, do not require an advanced event system, layout engine, or two-way data binding.
- Do not cover all display devices from the start.

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
3. Registers assets such as images, fonts, and colors.
4. Creates a scene.
5. Places parts such as Text, Image, and Rect on the scene.
6. Overrides per-profile coordinates and display settings as needed.
7. Configures animations and the display for state changes.
8. Exports the data for Arduino.
9. Uses the LGFXScreenBuilder library in an Arduino project and loads the generated data.
10. In the application code, assigns values to the generated scene structures and draws them.

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
- Playing basic animations
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
  main.header.battery = 82;
  main.body.temperature = "24.5C";
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
  main.header.battery = 82;
  main.body.temperature = "24.5C";
  screen.show(main);
}
```

### 7.3 Backend Abstraction

Inside the Arduino runtime, a common drawing API of LovyanGFX and M5GFX is assumed. The following are abstracted as needed.

- String drawing
- Image drawing
- Rectangle drawing
- Sprite drawing
- Color conversion
- Screen size retrieval
- Clipping

### 7.4 Drawing Resolution

Drawing is resolved based on the currently selected profile (§8.9).

- Full-screen fills and background clears are based on the physical size of the actual device (`gfx.width()` / `gfx.height()`).
- Each part is drawn with the logical coordinates of the currently selected profile treated as absolute pixels, with the origin at the top-left. No coordinate scaling is performed.
- Drawing that extends outside the physical screen is left to the clipping of the drawing backend.
- Rotation applies the rotation value (0–3) of the currently selected profile via `setRotation()` (§8.9.3).

Even if the logical coordinate space (the profile's size) and the physical screen size differ, drawing is done with the top-left as the origin without scaling. For example, if a 135×240 profile is used on a board with a physical 320×240, the background is drawn over the full 320×240, while the parts are drawn in the top-left 135×240 region. If a profile larger than the physical screen is used, the overflowing portion is clipped. To preserve the meaning of the coordinates, no automatic scaling or automatic repositioning is performed (a layout engine is a non-goal).

## 8. Functional Requirements

### 8.0 Top-Level Modes of the Web Authoring Tool

Rather than fully transitioning the entire screen, the authoring tool switches top-level modes while maintaining a common 3-pane layout.

Top-level modes:

- Design: Scenes, layers, part placement, property editing
- Assets: Management of images, fonts, sprite sheets, slices, and output formats
- Export: Arduino output artifacts, generation API, asset output settings, downloads
- Devices: Management of profiles (screen size, rotation, assigned board, layout) and the target library

In the MVP, Design is implemented as the core, and Assets and Export are gradually expanded within the same layout. Switching the preview target profile is placed as tabs at the top of the Design canvas. Devices is treated as an independent mode once editing of profiles and per-device layouts increases.

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

- Asset: Material referenced by a Part, not something placed directly on the screen. Images, fonts, sprite sheets, color palettes, etc.
- Part: A general term for the elements placed on a Scene. There are Parts that draw (Text, Image, Rect, etc.) and container Parts (Group) that group children without drawing.
- Group: A container Part that groups child Parts. It provides hierarchy, namespace, and a local-coordinate reference, and does not draw itself.
- Component: A template for reusing multiple Parts. Not handled in the MVP; a future extension.

A Group is also a kind of Part (a container Part) and is added from `Parts`. In Design mode, the `Parts` section always displays the Parts that can be added. The path for adding elements to the screen is unified into `Parts`, and Assets are not given special treatment alone.

Assets mode is used to register material and manage slices, sprite sheets, fonts, and output formats. When an Image is added in Design mode, the referenced Asset is selected in the property pane on the right.

The Parts supported in the MVP are limited to the following.

- Text
- Image
- Rect
- Group

Candidate future extensions are as follows.

- Icon
- Gauge
- Graph
- Container
- Button

`Text` is a general-purpose part that displays an arbitrary string. It can be used for fixed labels, status strings, or displaying numbers converted to strings. The name is `Text` rather than `Label`, prioritizing an expression that corresponds well to the drawing APIs of LovyanGFX/M5GFX.

A part dedicated to numeric display is not added in the MVP. When you want to handle a prefix/suffix, decimal places, and units for temperature, voltage, battery level, etc., in the initial phase the user code assembles the string and passes it to `Text`.

In the future, a `ValueText` or `Value`-family part will be added as needed, configurable with the following.

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
- Local coordinates relative to the parent Group
- Size
- Visibility state
- Drawing order
- Style
- Referenced asset
- Per-profile layout (§8.9)

However, the items a part has differ by type. Text does not have a size (width/height); it is placed by an anchor point (`x` / `y`) + a datum + a text size (multiplier) (§8.7). Image / Rect have a rectangle size (`w` / `h`).

The generated structures (the data contract) are determined only by the part's ID, type, and parent-child relationships. Coordinates, size, visibility state, style, preview strings, and per-profile layout are not included in the structures. As a result, the Arduino-side usage code (e.g., `main.header.title = "..."`) stays constant regardless of device or profile, and adding a profile later does not change the structure definitions. This is an invariant to avoid rework in multi-device support.

A part's layout (coordinates/size/visibility/style) is held **as a complete, independent value per profile**. There is no concept of a base or a diff (override). When adding a profile, you can start by copying an existing profile's layout. In a single-profile project, only one set of layouts is held.

The coordinate system uses local coordinates as the standard. A Scene has a root coordinate system, and Parts under a Group store `x` / `y` relative to the origin of the parent Group (since a Group is also a Part, nesting works the same way). When drawing, the parent's coordinates are added to resolve to absolute coordinates.

The editor uses local coordinates as the primary edited value, and displays absolute coordinates as auxiliary information as needed.

### 8.3 Group Management

Multiple parts can be grouped.

The MVP Group is a container Part that provides hierarchy, namespace, and a local-coordinate reference (it does not draw itself).

What the MVP Group has:

- ID
- Local coordinates
- Child Parts
- Drawing order

The following are not handled in the MVP.

- Visibility
- Clipping
- Background
- Border
- Animation

In the future, the following will be operable on a per-group basis.

- Move
- Visibility
- Animation
- Clipping

The `children` array of a scene and a group represents the drawing order. Drawing proceeds from the head of the array, and later parts are drawn in front. That is, the last-drawn part is displayed on top of the overlap.

In the layer panel, in line with common design tools, front parts are displayed at the top and back parts at the bottom. Changing the layer order is done with the "Bring forward" / "Send backward" buttons (`↑` / `↓`) on the layer panel. These are button operations on the panel, distinct from the arrow keys that move the selected part on the canvas (§8.14).

#### 8.3.1 Reordering and Moving Parts In and Out of Groups

Layer reordering happens **among siblings that share the same parent (the same level)**. "Bring forward / Send backward" swaps the selected part with an adjacent sibling; it does not move the part across levels.

**Drag and drop** in the layer tree performs both reordering and **changing the parent (moving parts in and out of groups)**. The behavior depends on the drop target:

- Drop onto a group row: **nest inside** that group.
- Drop onto another part row: make it a **sibling of that part (same parent)**.
- Drop onto an empty area of the tree: move it to the **scene root**.

When a part is **moved into or out of** a group, its **absolute on-screen position is preserved**. The local coordinates are recomputed relative to the new parent's origin, so the layout does not shift when moving parts in and out. Parts are expected to be freely movable in and out of groups at any time.

Group operations:

- **Group**: wrap the selection in a new Group. The Group is created at the same parent as the selection, and the children's absolute positions are preserved.
- **Ungroup**: dissolve a Group and lift its children up to that Group's parent (preserving absolute positions).

Constraints:

- Only a Group can be a container that holds children (a drawing Part cannot be a container).
- A part's own descendant cannot become its new parent (no cycles).
- Deleting a group also deletes all of its descendant children.

`displayOrder` is auxiliary information for the UI list display and is handled separately from the drawing order.

Example:

```text
Header
  Logo
  Title
  StatusIcon
```

The values of grouped parts are turned into structure fields following the group hierarchy in the Arduino-bound generated code as well.

Example:

```cpp
Scene::Main main;
main.header.title = "Status";
main.header.battery = 82;
main.body.temperature = "24.5C";

screen.show(main);
```

Even fields with the same name are not automatically treated as the same value. If you want to reflect the same value in multiple places, assign the same value in the user code.

Example:

```cpp
int battery = readBatteryLevel();

main.header.battery = battery;
main.footer.battery = battery;
```

### 8.4 Asset Management

Images, fonts, colors, sprite sheets, and the like can be managed within the project.

Examples of image assets:

- dashboard.png
- logo.png
- icons.png
- loading.png

Assets are given a unique ID.

Image assets are designed so that multiple storage formats and drawing paths can be selected depending on the use case.

Assumed asset types:

- Flash direct-draw RAW
- In-memory fast drawing
- Compressed format

Flash direct-draw RAW is pre-converted to a format close to the drawing target, such as RGB565, and draws data in PROGMEM or on the file system directly via the equivalent of `pushImage()`. Its expansion processing is light, and it is the standard format for ordinary UI parts and fixed images displayed frequently.

In-memory fast drawing holds an already-expanded image in RAM/PSRAM at startup or at scene start, and uses it at high speed for repeated drawing and animation. Because RAM usage increases, it is explicitly selected per target asset.

The compressed format holds compressed data such as PNG/JPEG and decodes it for drawing at the necessary timing. It is used for images where you want to reduce Flash usage, or images that are displayed only occasionally. Because the cost is high for frequent redrawing or tile-split drawing, it is not made the standard format.

In the initial implementation, Flash direct-draw RAW is given top priority, and in-memory fast drawing and the compressed format are treated as extensible formats.

### 8.5 Slicing

Multiple asset regions can be cut out from a large image.

Example:

```text
dashboard.png
  logo
  battery
  wifi
  loading_frame_01
  loading_frame_02
```

### 8.6 Sprite Sheet Support

Images for frame animation can be managed as a sprite sheet.

Example:

```text
loading.png
  frame0
  frame1
  frame2
  frame3
```

### 8.7 Font Management

The following can be managed.

- Font registration
- Font selection
- Size
- Color
- Placement

A Text part is placed by an **anchor point (`x` / `y`) + a datum**. Character drawing in LovyanGFX/M5GFX is based on `drawString(text, x, y)` + `setTextDatum(...)`, and `datum` determines where on the text (one of 9 points: top/middle/bottom vertically × left/center/right horizontally) x,y is aligned. As a result, **center alignment and right alignment relative to a point can be expressed with the datum alone**, and a Text part does not have a drawing rectangle (width/height). The editor's selection box is automatically computed from the measured text bounds. Image / Rect inherently require a rectangle (`w` / `h`), so they keep it as before.

**Clipping (truncation/ellipsis), wrapping (multiple lines), and in-box alignment** for an arbitrary-width rectangle are deferred as a "text box" feature that gives Text a width and height (§15). The MVP sticks to the equivalent of a single-line `drawString`, and does not have automatic wrapping at the screen edge (the equivalent of `setTextWrap`).

The unit for specifying text size is the **multiplier as the canonical (stored) value**. Text enlargement in LovyanGFX/M5GFX is `setTextSize(float)` = a multiplier relative to the base font, which is the primary primitive, and the px height is a derived value (font-dependent) obtained as "base font height × multiplier". Therefore, by making the stored value the multiplier, the actual-device display matches the generated code (which directly outputs `setTextSize(n)`), avoiding silent size discrepancies.

In addition to the multiplier input, the editor **displays the resulting px height as auxiliary information** (in the MVP, which assumes the default font, it can be computed accurately as `base height × multiplier`). The reverse-lookup input of "entering a px height and automatically selecting the font + multiplier" is deferred (§15).

In the initial phase, the font preview in the browser is an approximate display. The look is checked using fonts the browser can handle, such as web fonts, system fonts, and user-loaded TTF/OTF.

For Arduino output, a font-reference scheme that is easy to handle with LovyanGFX/M5GFX is prioritized. Because the browser preview and the actual-device display may not match exactly, the spec treats it as an approximate preview.

If matching the actual-device display becomes necessary in the future, a scheme will be considered that extracts the characters used and outputs them as a glyph atlas or bitmap font, using the same glyph data in the browser preview and the Arduino runtime.

#### 8.7.1 Font policy (presets first)

The MVP handles only the **preset fonts built into LovyanGFX / M5GFX**. The runtime does not output any font payload; it merely references a font with `setFont(&fonts::<Name>)`. **Custom fonts** that generate glyph data for only the used characters from a PC font (TTF/OTF) are deferred (§15). Even when custom fonts are added, the intended scheme — like image assets — is to extract the used characters into data and use the same glyphs in the browser and on the device (consistent with the future direction at the end of this section).

#### 8.7.2 Font catalog (how it is generated)

The list (catalog) of available preset fonts is **generated offline and shipped as JSON**, and the browser tool only reads it (the same standing as the board list; no C++ is parsed at runtime).

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
- Fonts not present in the target library's `fonts::` are **omitted + warned** (handled the same as board assignment, §8.9.5). This does not normally happen with the single representative catalog (LovyanGFX), but is kept as insurance against version skew.

### 8.8 Animation

The following animations are candidates for support.

- Frame animation
- Show/hide toggling
- Fade
- Move
- Scale

Animation can be executed at the following timings.

- At scene start
- At scene end
- On state change
- On explicit execution from the Arduino-side API

### 8.9 Profiles (Multi-Device Support)

Multi-device support is done not by directly tying a board to a layout, but through a unit called a profile (Profile). The design policy is "works cleanly on a single device, and does not break when devices are added later", and the data structure alone is first fixed in a form that can withstand future multi-device support.

#### 8.9.1 What a Profile Is

A profile is a unit that defines a layout, and it has the following.

- ID (a C/C++ identifier; in the generated code it becomes a `Profile::<Id>` constant)
- Screen size (width/height at the default rotation)
- Rotation (0–3). Orientation is expressed by this rotation (§8.9.3)
- Assigned boards (targets of auto-detection; zero or more, multiple allowed)

What the user specifies is a profile, not a board. A profile itself **does not have a default (fallback) flag**. The profile used as a fallback is chosen at output time (§8.9.4, §10).

Profile creation flow:

1. Create a profile by specifying the screen size (this size becomes the logical coordinate space of the layout).
2. Add zero or more boards to be assigned by auto-detection.
3. A profile with no boards added is not selected automatically and is used by specifying it explicitly in the program.

#### 8.9.2 Board Assignment

One or more boards can be assigned to a single profile.

- For devices you want to keep separate (e.g., M5Stack Core2 and CoreS3 are both 320×240 but differ in things like button areas), make a profile with one board each.
- For devices you want to group (e.g., M5StickC Plus and Plus2 differ only internally but use the screen and buttons the same way), assign multiple boards to one profile and share it. Because it is sharing rather than copying, fixing one is reflected in the other.
- "Grouping by resolution" is expressed as one way of using this mechanism: putting boards of the same resolution into one profile.

Boards within the same profile are assumed to have the same screen size and rotation. If you try to mix boards with different sizes or rotation behaviors, the authoring tool warns.

#### 8.9.3 Rotation and Orientation

Orientation (portrait/landscape) is not made into a separate profile but expressed by rotation.

- A profile has a rotation (0–3). Orientation is expressed by this rotation.
- The canvas width/height become the profile's screen size with width/height swapped by the rotation.
- The runtime only applies the rotation of the currently selected profile via `setRotation()`, and does not carry per-board rotation logic. The problem of different default rotations per board is absorbed by the authoring tool, which has a per-board default-rotation table used as the initial value when creating a profile and assigning a board.

The feature to change rotation per scene (changing portrait/landscape per screen on the same device) is deferred (§15).

#### 8.9.4 Profile Selection at Runtime

The profile selection order is as follows.

1. `Profile::Auto` (default): resolves the result of `getBoard()` against the assignment table.
2. `screen.setProfile(Profile::<Id>)`: the user specifies it explicitly to override. Used for a self-built panel (`board_unknown`) or when you intentionally want to use a different layout.
3. Fallback: a board that was detected but is not assigned to any profile, or an unknown board, uses the fallback profile.

The fallback profile (= the default in the generated code) is **chosen at output time**, not by a flag on the profile side (§10). This is a build-level concern of "which profile in this output is the receptacle for undetermined boards", and one is specified from among the profiles included in the output target. In a single-device build (one output target), that profile itself is the receptacle, so no specification is needed. Only when there are multiple outputs is one chosen. The chosen value is remembered as `defaultProfile` (directly under the project, optional) in the project file and used as the initial selection for the next output (§9).

The fallback specification is independent of layout saving. Because each profile fully holds its own layout (§8.2), changing the fallback selection does not affect any profile's layout.

In the future, a scheme to automatically fall back an unknown board to the profile closest to the physical resolution is a candidate extension. In the MVP, a fixed fallback profile is sufficient.

#### 8.9.5 Premises of Board Detection

Board detection uses `getBoard()` (`lgfx::board_t`) of M5GFX / M5Unified / LovyanGFX.

- M5GFX / M5Unified can comprehensively detect current M5 boards (the Core family, the StickC family, Cardputer, Dial, DinMeter, Tab5, external I2C displays such as M5UnitLCD/OLED/GLASS, etc.).
- Bare LovyanGFX (autodetect) can detect only the boards known to that library, and cannot detect newer M5 boards (Cardputer, Dial, etc.).
- Either way, autodetect or M5 initialization is a premise, and a hand-written self-built LGFX configuration results in `board_unknown`.

Therefore, the vocabulary of assigned boards is unified to M5GFX `board_t` names. In an environment with only bare LovyanGFX, undetectable boards are handled by resolution fallback, and boards that cannot be distinguished at the same resolution (e.g., Core2 and CoreS3) are specified by a compile-time hint.

The boards the authoring tool offers as assignment candidates follow the project's **target library** (selected in §9). M5GFX / M5Unified offers all M5 boards as candidates, while bare LovyanGFX offers only the subset that library can detect (newer devices not included are created as profiles with no board assigned and manually specified with `setProfile()`).

If a project that has boards assigned with M5GFX/M5Unified is later changed to LovyanGFX (e.g., Cardputer is already assigned), that assignment is **not automatically deleted but kept, and warned as "auto-detection not possible"**. On the actual device, it follows the fallback rules above: if the resolution matches, it falls back to that profile; if ambiguous at the same resolution, it is resolved by a compile-time hint or `setProfile()`. Seeing the warning, the user can choose to remove the assignment, switch to manual operation, etc.

#### Auto-Detection Extension Rules (Outside the MVP. Defined as rules.)

As an aid when `getBoard()` cannot determine the board, the following are used in order. They are not implemented in the MVP, but are defined as future detection rules.

1. **Resolution** … Narrow down to the group of profiles of the same size by `gfx.width()` × `gfx.height()`.
2. **MCU chip type** … Determine ESP32 / ESP32-S3 etc. by the compile-time `CONFIG_IDF_TARGET_*` or the runtime `ESP.getChipModel()`, and distinguish profiles of the same resolution. Example: the 320×240 Core2 (ESP32) and CoreS3 (ESP32-S3) can be distinguished by chip, and can be selected automatically even with bare LovyanGFX.
3. Only when still indistinguishable (same resolution, same chip), fall back to a compile-time hint or manual specification via `setProfile()`.

As a result, many of the "boards that cannot be distinguished at the same resolution" mentioned at the top of §8.9.5 are resolved by chip detection, narrowing the range that requires manual specification.

#### 8.9.6 Per-Profile Layout

Each profile holds the following as its own layout, **independently as complete values** (no concept of diff/base; §8.2).

- Coordinates (per part)
- Size (per part)
- Visibility (per part)
- Asset replacement (per part)
- Font size (per part)
- Rotation (per profile, §8.9.3)

A new profile can start from empty, or **start by copying** the layout of an existing profile. After copying, each profile is independent, and editing one does not propagate to the other.

The diff highlight of "showing items whose value differs from the default in the display" is a display-only aid rather than something saved, and is meaningful only when the compared targets are the same size, so it is deferred (§15).

#### 8.9.7 External Displays

Small displays connected via I2C (M5UnitLCD / OLED / GLASS, etc.) are also detected as individual boards, so they are handled by the same model. One `LGFXScreenBuilder` instance handles one drawing target (gfx); driving the main screen and an external display simultaneously uses separate instances. Simultaneous driving of multiple screens is a future extension.

### 8.10 Preview Switching

On the web authoring tool, you can switch the target profile and check the layout.

The preview lets you check the following.

- Screen size
- Safe area
- Part placement
- Visibility
- Simple animation playback

### 8.11 Namespace Management

Parts are managed in a hierarchical namespace. In the Arduino-bound generated code, instead of handling string IDs directly, they can be used as structure fields per scene.

Example:

```text
Main.header.title
Main.header.battery
Main.body.temperature
Main.body.loading
Settings.volume
Settings.brightness
```

The namespace achieves the following.

- Unique identifiers
- Auto-completion in the editor
- Improved readability of the Arduino-side API
- Support for large-scale projects

The generated code (`Scene`, `Profile`, etc.) is wrapped in a **project-name namespace** so as not to pollute the global scope. Because the project name becomes a namespace, it is limited to a C/C++ identifier (§8.12). The `LGFXScreenBuilder` class body itself is placed globally as an entry point.

On the usage side, writing `using namespace <Project>;` lets you omit the `Scene::` / `Profile::` prefix, and omitting it lets you use the fully qualified form (`<Project>::Scene::Main`, etc.) to avoid collisions.

Arduino-side usage example (when the project name is `MyScreen`):

```cpp
using namespace MyScreen;          // optional; to omit the prefix

Scene::Main main;
main.header.title = "Main";
main.header.battery = 82;
main.body.temperature = "24.5C";
main.body.loadingVisible = false;

screen.show(main);
```

The authoring tool and the generated runtime do not provide automatic variable binding. Value sharing, conversion, and timing of reflection are the responsibility of the user code.

### 8.12 ID Naming Rules

IDs that are converted into type names, field names, and constant names in the Arduino-bound C++ code—such as scenes, groups, parts, and assets—are in principle limited to names usable as C/C++ identifiers.

Basic rules:

- Usable characters are ASCII alphanumerics and `_`.
- The first character is a letter or `_`.
- Do not start with a digit.
- Do not use C/C++ reserved words such as `class`, `struct`, `template`, `namespace`, `int`, `float`, `bool`, `auto`.
- Do not duplicate IDs within the same hierarchy.
- Case-sensitive, but because it is confusing, IDs that differ only in case within the same hierarchy are warned.

Recommended style:

- Scene IDs are `PascalCase`. Examples: `Boot`, `Main`, `Settings`
- Group, part, and asset IDs are `camelCase` or `snake_case`. Examples: `header`, `batteryLevel`, `loading_icon`
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

The diff highlight of "showing items whose value differs from the default in the display" is deferred (it is meaningful only between profiles of the same size and has limited use; §8.9.6).

As a UI-only common item, elements that line up in a list (scenes, parts, groups, assets, slices, profiles) can have a `displayOrder` and a `description` (remarks). `displayOrder` is used to control the display order in the UI, and ties are sorted by ascending ID. `description` is a working note, treated as an optional, low-priority item, and is not included in the Arduino-bound output (if empty, it is not output).

### 8.14 Editor Operations (Key Map)

Common key/mouse operations are defined for editing screens that have a canvas (Design, slice editing in Assets, etc.). They are aligned with common conventions of shape-editing tools.

Selection and focus:

- Click a part/slice: select it.
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

### 8.15 Layout JSON Import/Export (for AI Collaboration; post-MVP)

The Design screen provides a feature to import/export the layout of a single screen as a simple **JSON**. The main purpose is to hand a screen back and forth when **asking an AI to modify or create a screen** (a self-contained, minimal format that a generative AI can easily read and write). This is distinct from the project file (§9) and also from the Arduino generated output (§10).

Export policy:

- **Strip project-specific information.** Do not include asset binaries (Data URLs), board assignments, the namespace / project name, output settings, `defaultProfile`, and so on.
- So that the screen can be understood at a glance, embed the **screen size (width/height), rotation, screen name (Scene ID), and description** at the top.
- Then export the **part placement information**: type, ID, parent/child (group hierarchy), and the per-type placement values (Text: anchor `x`/`y`, datum, text-size multiplier, color, preview string, visibility; Rect/Image: `x`/`y`/`w`/`h`, color or referenced asset name, visibility). Use a granularity that conveys the meaning of the layout to the AI.

Import policy:

- **Import** the JSON above and reconstruct the screen from the size, screen name, description, and placement information.

Open questions (to be decided later):

- Whether an import is **applied to an existing screen**, or is **import-only and reflected via "add as a screen" after a preview**.
- Which profile (which screen size) the layout is treated as (matching against the size embedded at export time, and behavior on mismatch).
- Handling of ID collisions on import and of referenced assets that are not registered.

This is not implemented in the MVP; the format and import method will be worked out separately (§15).

## 9. Project File

The official save format of a project is `.lgfxsb.json`. The user explicitly saves/loads this file, and in-browser storage is treated as an auxiliary feature for automatic restoration.

Basic startup flow:

- If there is a previous auto-save, you can choose to restore, create new, or open a project.
- If there is no previous auto-save, you can choose to create new or open a project.
- When creating new, specify the target library (LovyanGFX / M5GFX / M5Unified, default M5Unified), the first profile (target device / screen size / rotation), the project name, and the first scene. Because the target library affects the board assignment candidates, the auto-detection behavior, and the generated samples, it is chosen first. Changes after creation are made on the Devices (Profiles) screen. M5GFX and M5Unified have the same board detection and candidates (all M5 boards), differing only in the initialization of the generated sample (`display.begin()` / `M5.begin()`). Only bare LovyanGFX has a subset of candidates.
- When an existing project is opened, the profile settings in the project file are used.

A project can basically be saved as a single file.

Internally, the authoring tool separately handles a rich project JSON that is easy to edit and the generation data used for Arduino output.

The rich project JSON can hold UI display order, descriptions, selection state, preview auxiliary information, etc. The generation data is normalized to only the information needed by the Arduino runtime.

The project file includes the following.

- Meta information (including the project name and the target library. Because the project name becomes the namespace of the generated code, it is limited to a C/C++ identifier. §8.12)
- Profile definitions (ID, size, default rotation, assigned boards)
- The fallback profile `defaultProfile` (directly under the project, optional. Remembers the value chosen at output time. §8.9.4, §10)
- Scene definitions
- Part definitions
- Group definitions
- Animation definitions
- Asset definitions
- Font definitions
- Output settings

A part's layout is held keyed by the profile ID, as a **complete value per profile** (§8.2). There is no concept of a base or a diff. For a single profile, only one set. The generated structures are determined only by the part's ID, type, and parent-child relationships, and do not depend on profile or layout values.

In the MVP, asset source data such as images and fonts is embedded in `.lgfxsb.json` as a Data URL. This makes it possible to carry the editing project as a single file.

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

In the future, a `.lgfxsb` zip package format will be added for large projects.

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

For supported browsers, overwrite saving via the File System Access API will be considered in the future. In the MVP, download saving is the basis.

Undo/Redo is managed with an in-memory history stack and is not included in the save file or the auto-save. In the MVP, it is a snapshot scheme of the project JSON, with the maximum history count limited.

Auto-save targets only the latest state, and the Undo history is not persisted. For small state, localStorage is considered; for state including large assets, IndexedDB is considered.

Optional items are not output to the JSON if unset. By not pointlessly outputting empty strings or empty arrays, the diff of the project file is made easier to read.

At generation time, the following UI-only information is excluded from the rich project JSON.

- `displayOrder`
- `description`
- Temporary UI state such as the selected tab or selected item
- Browser-preview-only auxiliary information

## 10. Export Specification

The Arduino-bound export generates the following.

- Screen definition data
- Asset data
- Scene ID definitions
- Typed data structures per scene
- Part ID definitions for the low-level API
- Sample usage code (`<Project>_example.ino`)

The sample usage code is generated according to the target framework. LovyanGFX uses `LGFX_AUTODETECT` and `display.init()`, M5Unified uses `M5.begin()` and `M5.Display`, etc.—the includes and initialization differ (the drawing API is common).

The output target profiles can be generated by selecting all or only specific devices. `enum class Profile` and the generated data are narrowed to only the selected profiles. **The fallback profile (default) is chosen on this output screen** (§8.9.4). A single-device build (one output target) needs no specification because that profile itself is the receptacle. Only when there are multiple outputs is one fallback chosen from among the output targets. The selection is remembered as `defaultProfile` (§9) and used as the initial value for the next output.

Comments included in the generated code (headers, the sample `.ino`, etc.) must be **English-only, or bilingual English + Japanese (`// en:` / `// ja:` form)**, and **must not be Japanese-only**, so that users of the public Arduino library can read them in English-speaking contexts too (the comment-language policy is shared with §13).

The output method for image assets can be selected from the following.

- Header file embedding
- PROGMEM placement
- File output for SPIFFS/LittleFS
- raw RGB565 data
- PNG/JPEG reference

In the initial phase, header file output, which is easy to handle in the Arduino IDE, is prioritized.

For each asset, the storage destination and the drawing format can be specified separately.

Storage destination candidates:

- Header/PROGMEM
- LittleFS/SPIFFS
- SD
- RAM/PSRAM cache

Drawing format candidates:

- RAW RGB565
- RAW RGB888/RGBA8888
- Palette/Indexed
- PNG
- JPEG
- A custom compressed format added in the future

In the MVP, `Header/PROGMEM + RAW RGB565` is the standard output. As a result, you can build a UI including images simply by importing the export result from GitHub Pages into an Arduino project.

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
main.header.title = "Main";
main.header.battery = 82;
main.body.temperature = "24.5C";
main.body.wifiVisible = true;

screen.show(main);
```

On update, the same scene structure is passed.

```cpp
main.header.battery = 79;
main.body.temperature = "25.1C";
screen.update(main);
```

### 11.1 Shared Engine and Generated Facade

The library provides a **shared engine** that holds the drawing logic, and a **thin facade class `Screen`** generated per project binds the project descriptor to it.

Shared engine (on the library side; not used directly by the user):

```cpp
namespace lgfxsb {
  struct Project { /* profiles, boardMap, defaultProfile, scenes[], assets[] */ };

  class Renderer {
  protected:
    lgfx::LGFX_Device* _gfx = nullptr;   // the device type that has getBoard() (base of LGFX / M5GFX / M5.Display)
    const Project& _project;
    uint8_t _profile = 0;          // 0 = Auto (actual resolution is deferred to draw time)
    void renderScene(/* sceneref */, uint8_t profile);
  public:
    Renderer(lgfx::LGFX_Device& gfx, const Project& project) : _gfx(&gfx), _project(project) {}
    void begin();                  // configuration hook after display init (does not touch profile selection)
    void play(const char* animationId);
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
    struct Header { const char* title = ""; int battery = 0; } header;
    struct Body   { const char* temperature = ""; bool wifiVisible = true; } body;
  };
}

extern const lgfxsb::Project project;          // entry point for all data (generated)

class Screen : public lgfxsb::Renderer {       // project-specific facade
public:
  explicit Screen(lgfx::LGFX_Device& gfx) : Renderer(gfx, project) {}   // bind the descriptor
  void setProfile(Profile p);                  // accepts only this type (other projects are type errors)
  template <class TScene> void show(const TScene& s);     // limited to this project's scenes
  template <class TScene> void update(const TScene& s);
};

} // namespace MyScreen
```

Because `Screen` binds the descriptor in its constructor, the user does not need to pass `project` every time. `setProfile()` names the `Profile` of the same namespace, so it is type-safe (passing another project's `Profile` is a compile error).

The receiving type for `gfx` is `lgfx::LGFX_Device` (a subclass of the `LovyanGFX` base that has `getBoard()`, used for auto-detection). The LovyanGFX autodetect `LGFX`, `M5GFX`, and `M5.Display` that the user passes are all derived from `lgfx::LGFX_Device`, so they can be accepted by the same API.

`show` / `update` are emitted by the generated code as **function overloads** per scene type (not templates). Because overloads exist only for the generated scene types of the project itself, the "limited to this project's scenes" property is preserved, and passing an unknown type is a compile error. The template syntax is exposed neither to the user nor to the library's public API.

### 11.2 Usage Example

```cpp
#include <LovyanGFX.hpp>
#include <LGFX_AUTODETECT.hpp>
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
  main.header.title     = "Main";
  main.header.battery   = 82;
  main.body.temperature = "24.5C";
  screen.show(main);
}

void loop() {
  static Scene::Main main;
  main.header.battery   = readBattery();
  main.body.temperature = formatTemp(readTemp());
  screen.update(main);             // swap only the values and redraw
  delay(1000);
}
```

Normally, `setProfile()` is not called, and it is left to the default `Profile::Auto` (auto-detection by `getBoard()`).

### 11.3 Profile Selection (Order-Independent, Deferred Resolution)

The order of `setProfile()` and `begin()` is not fixed. Because `setProfile()` only records the selection and does not touch the hardware, it can be called either before or after `begin()`, or to switch during execution. The actual resolution of `Profile::Auto` (`getBoard()`) and the rotation (`setRotation`) are deferred and applied at draw time (`show` / `update`), so as long as the order `display.init()` → `show()` is observed, there is no need to be conscious of the order.

```cpp
screen.setProfile(Profile::Stick);   // override auto-detection (self-built panel, etc.); either before or after begin
screen.setProfile(Profile::Auto);    // return to auto-detection
```

`Profile::Auto` resolves only assigned boards, and unassigned/unknown boards fall back to the default profile (§8.9). What the user specifies is a profile, not a board. Because `auto` is a C/C++ reserved word, auto-detection is `Auto`. When multiple projects coexist, the `Screen` class becomes a distinct type, and passing another project's `Profile` / `Scene` is a type error (§8.11).

M5GFX is integrated into the same API to the extent that it can be treated as a LovyanGFX derivative or compatible API.

`show("Main")` and `setText("Main.temperature", "...")` using string IDs are treated as a debugging-use or low-level-compatibility API, and are not made the recommended API for normal use.

## 12. Host Preview and Screenshots

In addition to actual-device checking, a mechanism is provided to output the drawing result as a PNG in a host environment.

Because LovyanGFX's host execution environment can turn the drawing result into a PNG using `createPng()`, the design allows the generated code to include test-use screenshot helper functions.

Assumed uses:

- Regression testing of the generated UI
- PNG snapshot checking on GitHub Actions
- Comparison of direct LovyanGFX/M5GFX drawing and drawing via LGFXVirtualCanvas
- Checking the diff between the approximate font preview and the actual drawing result

Example of the generated test helper API:

```cpp
#if defined(LGFXSB_ENABLE_HOST_SCREENSHOT)
bool saveScreenshot(LovyanGFX& gfx, const char* path);

template <typename TScene>
bool renderScreenshot(LovyanGFX& gfx, const TScene& scene, const char* path);
#endif
```

`renderScreenshot()` draws the target scene and then saves the full screen as a PNG. It is disabled in normal Arduino actual-device builds and enabled only in host tests or development builds.

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
    Basic/
      Basic.ino
      MyScreen.h                    #   sample generated header
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

## 15. MVP Scope

For the first implementation, the following is the MVP.

- Basic screens of the web authoring tool (3 panes + mode switching, ja/en, startup flow)
- Profile creation (screen size / default rotation) + `Profile::Auto` auto-detection, board assignment, fallback selection at output time
- Scene creation
- Text/Image/Rect/Group part placement (direct manipulation: add/move/resize/group/layer order)
- Text with only the default font + size and color (custom font registration is out of scope)
- PNG image asset registration (Data URL embedding)
- JSON project save/load (single `.lgfxsb.json`, download method)
- Arduino header file output (Header/PROGMEM + RAW RGB565, single header)
- Static scene drawing in LovyanGFX/M5GFX
- Text part value update / visibility toggling
- Undo/Redo (in-memory history)
- Auto-save/restore (latest state only, lightweight)
- ID validation / duplication detection
- Basic sample

In the MVP, implementation centers on a single profile. In line with the policy "works cleanly on a single device, and does not break when devices are added later", building out the layout for each of multiple profiles is outside the MVP scope.

The MVP defers the following.

- Layout editing of multiple profiles (independent per profile; new ones start by cloning)
- Diff highlight display of "items whose value differs from the default" (valid only between the same sizes)
- Per-scene rotation setting (the MVP has rotation only per profile)
- Reverse-lookup input of text size px height (entering a px height to automatically select the font + multiplier; the MVP uses multiplier specification + px auxiliary display. §8.7)
- Text box (giving Text a width and height to perform clipping/wrapping/in-box alignment; the MVP has only single-line anchor + datum. §8.7)
- Layout JSON import/export (for AI collaboration; import/export the size, name, description, and placement of a single screen as a self-contained JSON with project-specific information stripped. The import method is undecided. §8.15)
- Auto-detection extension rules (assisted detection by resolution and MCU chip ESP32/S3. §8.9.5)
- Animation in general (frame/fade/move/scale, playback and editing)
- Additional Parts such as Icon/Gauge/Graph/Container/Button
- ValueText/Value family (dedicated numeric display: prefix/suffix/decimal places/unit)
- Custom font (TTF/OTF) registration and management (the MVP has only the default font + size/color)
- Asset slicing (§8.5)
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

## 17. Success Criteria

The success criteria for the initial release are as follows.

- The authoring tool can be opened on GitHub Pages.
- A screen can be created and saved as a project file.
- Data for Arduino can be exported.
- The sample can be built on both LovyanGFX and M5GFX.
- Values can be assigned to the generated scene structures from the Arduino side, and text update and visibility toggling can be done.
- Management of multiple screens becomes clearer than directly lining up existing `drawString()` and `drawPng()` calls.
