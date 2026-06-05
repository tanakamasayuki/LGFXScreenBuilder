# LGFXScreenBuilder — AI Layout Interface

This document is the contract for **an AI assistant** that designs or edits a screen
layout for [LGFXScreenBuilder](https://github.com/tanakamasayuki/LGFXScreenBuilder),
a tool that authors UI screens for embedded displays (LovyanGFX / M5GFX / M5Unified).

You will be given:

1. **This document** (the format and the rules).
2. A **layout JSON** for one screen (exported from the tool, or hand-written). It is
   usually **minified** (a single line); that is normal. The pretty example below is
   only for readability.
3. A **request** ("make a clock screen", "move the battery to the top-right", …).

Produce a **layout JSON in exactly this format** as your answer. Keep it valid JSON
(no comments, no trailing commas). Preserve part IDs unless the request is to add,
remove, or rename parts.

---

## 1. What one layout describes

A layout is **one screen (a "scene") across all device profiles**. A *profile* is a
target device size (e.g. a 320×240 board vs a 135×240 board). The same screen is laid
out independently for each profile, because a layout that fits a wide screen does not
fit a tall one.

```jsonc
{
  "format": "lgfxsb-layout",
  "version": 1,
  "spec": "https://tanakamasayuki.github.io/LGFXScreenBuilder/AI_LAYOUT_IO.md",
  "scene": "Main",            // screen name (a C identifier)
  "desc": "",                 // free-text note about the screen
  "background": "#000000",    // full-screen background color (context; usually leave as-is)
  "fonts": [                  // adopted fonts available to this layout (context; do not edit)
    { "name": "Font4", "family": "Font4", "content": "latin", "size": null, "unit": null, "height": null },
    { "name": "efontJA_16", "family": "efontJA", "content": "ja", "size": 16, "unit": "px", "height": 16 }
  ],
  "profiles": [
    { "id": "Core", "w": 320, "h": 240, "rot": 0, "fonts": [ "Font4", "efontJA_16" ], "parts": [ /* … */ ] },
    { "id": "Stick", "w": 135, "h": 240, "rot": 0, "fonts": [ "Font4" ], "parts": [ /* … */ ] }
  ]
}
```

- `spec` — the URL of this document (so you can re-fetch the rules). Echo it back unchanged.
- `w` / `h` — the profile's screen size in pixels, at rotation `rot`.
- `rot` — rotation 0–3. `0` is the panel's native orientation; `w`/`h` already reflect it.
- top-level `fonts` — the adopted preset fonts available in the project. This is
  context for choosing Text `font` values; echo it back unchanged.
- profile `fonts` — the font names enabled and selectable on that profile. A Text
  may use only `null` or a font name from the same profile's `fonts` array.

---

## 2. Parts

Each profile has a `parts` array, drawn **back-to-front in array order** (first = behind).

**Critical invariant:** the set of `(id, type, parent)` must be **identical in every
profile**. Everything else may differ per profile when needed to fit the screen —
position, size (`w`/`h`), `color`, `visible`, and a Text's `datum`/`size`/`text`/`font`.
If you add, remove, or rename a part, do it in **all** profiles. Never change a part's
`type` between profiles.

All coordinates are **integer pixels, top-left origin (0,0), no scaling**. Anything drawn
outside `w`×`h` is clipped. Keep parts inside the screen.

### Common fields

| field | meaning |
|-------|---------|
| `id` | unique within the scene; a C identifier (`[A-Za-z_]\w*`). Stable across profiles. |
| `type` | `"Rect"`, `"Text"`, `"Image"`, or `"Group"`. |
| `parent` | `null`, or the `id` of a `Group` that contains this part. |
| `visible` | `true` / `false`. A hidden part is kept but not drawn. |

### Field value types

| field | JSON type | notes |
|-------|-----------|-------|
| `w`, `h`, `x`, `y` | **integer** | pixels. No fractional coordinates or sizes. |
| `rot` | **integer** | 0, 1, 2, or 3. |
| `size` (Text) | **number** | a scale multiplier; **may be fractional** (e.g. `1`, `1.5`, `3.5`). |
| `height` (font) | **integer or null** | approximate rendered pixel height at Text `size: 1`. |
| `color` | **string** | `"#rrggbb"` (6 hex digits, lowercase). |
| `visible` | **boolean** | `true` / `false`. |
| `id`, `type`, `datum`, `text`, `family`, `content` | **string** | — |
| `parent`, `asset`, `font`, `unit` | **string or null** | a referenced ID / asset name / font name / unit, or `null`. |
| `scene`, `desc`, `spec`, `format` | **string** | — |
| `version` | **integer** | currently `1`. |

### Font context

Top-level `fonts` lists the adopted preset fonts that the tool can use. Each entry is
context only:

| field | meaning |
|-------|---------|
| `name` | the exact LovyanGFX / M5GFX preset font symbol to put in a Text `font`. |
| `family` | the font family/group, useful for choosing visually consistent fonts. |
| `content` | supported content category: `"digits"`, `"latin"`, `"ja"`, `"cn"`, `"tw"`, or `"ko"`. CJK fonts also carry ASCII. |
| `size` / `unit` | catalog nominal size, when known. |
| `height` | approximate rendered height in pixels at Text `size: 1`, when known. |

Use `content` to avoid choosing a digit-only font for words, or a Latin-only font for
Japanese text. Profile-level `fonts` is the actual selectable list for that profile.
Do not add, remove, or edit font metadata; the tool owns the font catalog.

`family` is a LovyanGFX / M5GFX preset group, not an editable CSS font family. The
browser preview approximates families roughly as follows; use this only as a visual
hint when choosing among already available fonts.

| family | visual hint |
|--------|-------------|
| `FreeSans` | sans-serif, similar to Arimo / Liberation Sans / Arial |
| `FreeSerif` | serif, similar to Tinos / Liberation Serif / Georgia |
| `FreeMono` | monospaced, similar to Cousine / Liberation Mono |
| `DejaVu` | neutral sans-serif |
| `Roboto_Thin` | very light sans-serif |
| `Orbitron_Light` | geometric digital display |
| `Satisfy` | cursive script |
| `Yellowtail` | cursive script |
| `lgfxJapanGothic`, `lgfxJapanGothicP`, `efontJA` | Japanese gothic / sans-serif |
| `lgfxJapanMincho`, `lgfxJapanMinchoP` | Japanese mincho / serif |
| `efontCN` | simplified Chinese sans-serif |
| `efontTW` | traditional Chinese sans-serif |
| `efontKR` | Korean sans-serif |

Some built-in bitmap fonts have the font `name` itself as the family. Treat these as
special visual cases:

| font name | visual hint |
|-----------|-------------|
| `Font0` | small 6x8 GLCD-style bitmap sans; best for tiny UI labels. |
| `Font2` | larger proportional bitmap sans; embedded LCD UI style. |
| `Font4` | large proportional bitmap sans; embedded LCD UI style. |
| `Font6` | rounded LCD-style digits/time font; intended for numbers and time. |
| `Font7` | 7-segment digits/time font; intended for numbers and time. |
| `Font8` | very large Arial-like digits font; intended for large numbers. |
| `Font8x8C64` | 8x8 Commodore 64-style bitmap font. |
| `AsciiFont8x16` | fixed 8x16 ASCII bitmap; VGA/DOS terminal-like. |
| `AsciiFont24x48` | fixed 24x48 ASCII bitmap; scaled terminal-like. |
| `TomThumb` | extremely small bitmap serif/display font. |

### Per-type fields

**Rect** — a filled rectangle.
`x, y` top-left corner · `w, h` size · `color` `"#rrggbb"`.

**Text** — a single line of text. **Text has no width/height box.** There is no
wrapping, clipping, ellipsis, or in-box alignment; keep the text short enough to fit, or
use different `text`/`size` values per profile.
`x, y` is the **anchor point**; `datum` says which point of the text sits on the anchor;
`size` is a **scale multiplier** (rendered height ≈ font base height × `size`);
`color` `"#rrggbb"`; `text` the string to show;
`font` the font name (string) or `null` for the default. **Preserve `font` as-is**
unless the request asks you to change it; only use a font name from the same profile's
`fonts` array, never invent a font name, and never add `fontFamily`/`bold`/`italic`
fields.
Fonts are embedded bitmap/preset fonts. `size` scales the rendered bitmap, so integer
or visually round multipliers (`1`, `2`, `3`, sometimes `1.5`) usually look cleaner;
arbitrary fractional multipliers can make bitmap strokes uneven or blurry. Prefer
choosing an available font with a suitable native `height` before using awkward scale
values.
`datum` is one of (vertical `T`/`M`/`B` × horizontal `L`/`C`/`R`):
`TL TC TR ML MC MR BL BC BR`. Example: `TR` right-aligns text whose top-right corner is at `(x,y)`; `MC` centers text on `(x,y)`.

**Image** — a bitmap from the project's asset library.
`x, y` top-left · `w, h` size · `asset` the **existing asset name** (string) or `null`.
You **cannot create image data**; you may only place, resize, or point an Image at an
asset name that already exists in the project.

**Group** — a logical container with an origin; it draws nothing itself.
`x, y` is the group origin. **Children's coordinates are relative to the group origin.**
A Group has no `w`/`h`/`color`. Use groups to move a cluster of parts together.
Containers may only be `Group`s, and the hierarchy must not form a cycle.
A Group still carries `visible` for shape consistency, but it draws nothing, so leave it
unchanged — to hide content, set `visible: false` on the child drawing parts.

---

## 3. Worked example

The `Main` screen of the sample project, across three profiles:

```json
{
  "format": "lgfxsb-layout",
  "version": 1,
  "spec": "https://tanakamasayuki.github.io/LGFXScreenBuilder/AI_LAYOUT_IO.md",
  "scene": "Main",
  "desc": "",
  "background": "#000000",
  "fonts": [
    { "name": "Font4", "family": "Font4", "content": "latin", "size": null, "unit": null, "height": null },
    { "name": "efontJA_16", "family": "efontJA", "content": "ja", "size": 16, "unit": "px", "height": 16 }
  ],
  "profiles": [
    {
      "id": "Core", "w": 320, "h": 240, "rot": 0,
      "fonts": [ "Font4", "efontJA_16" ],
      "parts": [
        { "id": "headerBand", "type": "Rect", "parent": null, "x": 0, "y": 0, "w": 320, "h": 40, "color": "#1e2a30", "visible": true },
        { "id": "title", "type": "Text", "parent": null, "x": 12, "y": 10, "datum": "TL", "size": 2, "color": "#ffffff", "text": "Main", "font": null, "visible": true },
        { "id": "battery", "type": "Text", "parent": null, "x": 310, "y": 12, "datum": "TR", "size": 1.5, "color": "#9ce5ac", "text": "82%", "font": null, "visible": true },
        { "id": "temp", "type": "Text", "parent": null, "x": 18, "y": 70, "datum": "TL", "size": 4, "color": "#ffffff", "text": "24.5C", "font": null, "visible": true },
        { "id": "panel", "type": "Rect", "parent": null, "x": 18, "y": 150, "w": 284, "h": 54, "color": "#172126", "visible": true }
      ]
    },
    {
      "id": "Stick", "w": 135, "h": 240, "rot": 0,
      "fonts": [ "Font4" ],
      "parts": [
        { "id": "headerBand", "type": "Rect", "parent": null, "x": 0, "y": 0, "w": 135, "h": 30, "color": "#1e2a30", "visible": true },
        { "id": "title", "type": "Text", "parent": null, "x": 8, "y": 7, "datum": "TL", "size": 1.5, "color": "#ffffff", "text": "Main", "font": null, "visible": true },
        { "id": "battery", "type": "Text", "parent": null, "x": 8, "y": 180, "datum": "TL", "size": 1.5, "color": "#9ce5ac", "text": "82%", "font": null, "visible": true },
        { "id": "temp", "type": "Text", "parent": null, "x": 10, "y": 60, "datum": "TL", "size": 3.5, "color": "#ffffff", "text": "24.5", "font": null, "visible": true },
        { "id": "panel", "type": "Rect", "parent": null, "x": 10, "y": 110, "w": 115, "h": 60, "color": "#172126", "visible": true }
      ]
    },
    {
      "id": "Cardputer", "w": 240, "h": 135, "rot": 0,
      "fonts": [ "Font4" ],
      "parts": [
        { "id": "headerBand", "type": "Rect", "parent": null, "x": 0, "y": 0, "w": 240, "h": 26, "color": "#1e2a30", "visible": true },
        { "id": "title", "type": "Text", "parent": null, "x": 8, "y": 5, "datum": "TL", "size": 1.5, "color": "#ffffff", "text": "Main", "font": null, "visible": true },
        { "id": "battery", "type": "Text", "parent": null, "x": 232, "y": 6, "datum": "TR", "size": 1.25, "color": "#9ce5ac", "text": "82%", "font": null, "visible": true },
        { "id": "temp", "type": "Text", "parent": null, "x": 12, "y": 40, "datum": "TL", "size": 3, "color": "#ffffff", "text": "24.5C", "font": null, "visible": true },
        { "id": "panel", "type": "Rect", "parent": null, "x": 12, "y": 86, "w": 216, "h": 40, "color": "#172126", "visible": false }
      ]
    }
  ]
}
```

Note how every profile carries the **same five parts** (`headerBand`, `title`,
`battery`, `temp`, `panel`) with the same types, but different coordinates, sizes, and —
on `Cardputer` — `panel` hidden (`"visible": false`).

---

## 4. Output rules

Output **raw JSON only**. Do not wrap the response in Markdown code fences, prose,
explanations, or comments.

Return the **entire layout object, including every profile**. Do not return patches,
diffs, partial profiles, or only the changed parts.

**Preserve the profile list.** Do not add, remove, rename, or reorder profiles, and do
not change a profile's `id`, `w`, `h`, or `rot`, unless the user explicitly asks for a
profile-level change.

**Preserve top-level `fonts` and every profile's `fonts` array unchanged.** They are
catalog/context data, not layout edits. Use them only to decide valid Text `font`
values.

**Keep the `parts` array order consistent across profiles**, because array order is the
draw order. If you reorder layers, apply the same relative order to every profile. For
grouped parts, keep the hierarchy valid and avoid cycles.

If a part should not appear on a certain profile, keep the part and set
`"visible": false` — do **not** delete it from that profile.

**Use only the part types and fields defined here.** For visual-polish requests such as
"make it richer", do not invent unsupported fields such as `radius`, `cornerRadius`,
`stroke`, `border`, `opacity`, `alpha`, `gradient`, `shadow`, `fontFamily`, `fontStyle`,
`fontWeight`, `bold`, `italic`, `wrap`, or `align`. Approximate cards, dividers,
highlights, and simple shadows by layering `Rect` and `Text` parts. Use `Image` only to
reference an existing project asset.

The `font` field **is** a supported Text field — this restriction is only about *other*
text-styling fields. Preserve `font` as-is unless the request explicitly asks to switch
to another font that appears in the same profile's `fonts` list, and never invent a
new font name.

**This format does not include**, and you must not add: editable font *family/style*
selection beyond the provided font catalog context plus Text `font` name + `size` +
`color`; animation/transition/keyframe/fade/duration/delay/timing; or any project-level
data (`assets`, asset binaries / Data URLs, `boards`, `targetLibrary`, `defaultProfile`,
project name/namespace, output settings, Arduino code). This is **not** the
`.lgfxsb.json` project file and **not** Arduino generated output. Represent **static
layouts only**.

---

## 5. Do / Don't

**Do**
- Keep the `(id, type, parent)` set identical across all profiles.
- Keep every part inside its profile's `w`×`h`.
- Adapt sizes and positions to each profile's aspect ratio (a tall 135×240 needs a
  different arrangement than a wide 320×240).
- Reuse anchors + `datum` to align text (e.g. `TR` at `x = w` for a right-aligned value).
- Return the whole object, with all profiles, as valid JSON.

**Don't**
- Don't add `w`/`h` to a `Text` (it has none) or to a `Group`.
- Don't invent `asset` names — only reference assets that already exist.
- Don't change a part's `id` or `type` between profiles.
- Don't add fields not described here, and don't include comments or trailing commas.

---

## 6. Round-trip

This format maps one-to-one to the tool's internal model, so a layout exported from the
tool and edited by you can be imported back. Stable IDs are what make editing safe: an
unchanged `id` means "the same part, moved/restyled"; a new `id` means "a new part".

> The tool provides both **export** ("Copy AI JSON") and **import** ("Paste AI JSON") in
> Design mode. On import, a scene whose name already exists is **updated**; a new name is
> **added**. Import is undoable. (SPEC §8.15.)
