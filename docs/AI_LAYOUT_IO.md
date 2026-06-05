# LGFXScreenBuilder — AI Layout Interface

This document is the contract for **an AI assistant** that designs or edits a screen
layout for [LGFXScreenBuilder](https://github.com/tanakamasayuki/LGFXScreenBuilder),
a tool that authors UI screens for embedded displays (LovyanGFX / M5GFX / M5Unified).

You will be given:

1. **This document** (the format and the rules).
2. A **layout JSON** for one screen (exported from the tool, or hand-written).
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
  "scene": "Main",            // screen name (a C identifier)
  "desc": "",                 // free-text note about the screen
  "background": "#000000",    // full-screen background color (context; usually leave as-is)
  "profiles": [
    { "id": "Core", "w": 320, "h": 240, "rot": 0, "parts": [ /* … */ ] },
    { "id": "Stick", "w": 135, "h": 240, "rot": 0, "parts": [ /* … */ ] }
  ]
}
```

- `w` / `h` — the profile's screen size in pixels, at rotation `rot`.
- `rot` — rotation 0–3. `0` is the panel's native orientation; `w`/`h` already reflect it.

---

## 2. Parts

Each profile has a `parts` array, drawn **back-to-front in array order** (first = behind).

**Critical invariant:** the set of `(id, type, parent)` must be **identical in every
profile**. Only the position/size/style differ per profile. If you add, remove, or
rename a part, do it in **all** profiles. Never change a part's `type` between profiles.

All coordinates are **integer pixels, top-left origin (0,0), no scaling**. Anything drawn
outside `w`×`h` is clipped. Keep parts inside the screen.

### Common fields

| field | meaning |
|-------|---------|
| `id` | unique within the scene; a C identifier (`[A-Za-z_]\w*`). Stable across profiles. |
| `type` | `"Rect"`, `"Text"`, `"Image"`, or `"Group"`. |
| `parent` | `null`, or the `id` of a `Group` that contains this part. |
| `visible` | `true` / `false`. A hidden part is kept but not drawn. |

### Per-type fields

**Rect** — a filled rectangle.
`x, y` top-left corner · `w, h` size · `color` `"#rrggbb"`.

**Text** — a single line of text. **Text has no width/height box.**
`x, y` is the **anchor point**; `datum` says which point of the text sits on the anchor;
`size` is a **scale multiplier** (rendered height ≈ font base height × `size`);
`color` `"#rrggbb"`; `text` the string to show.
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

---

## 3. Worked example

The `Main` screen of the sample project, across three profiles:

```json
{
  "format": "lgfxsb-layout",
  "version": 1,
  "scene": "Main",
  "desc": "",
  "background": "#000000",
  "profiles": [
    {
      "id": "Core", "w": 320, "h": 240, "rot": 0,
      "parts": [
        { "id": "headerBand", "type": "Rect", "parent": null, "x": 0, "y": 0, "w": 320, "h": 40, "color": "#1e2a30", "visible": true },
        { "id": "title", "type": "Text", "parent": null, "x": 12, "y": 10, "datum": "TL", "size": 2, "color": "#ffffff", "text": "Main", "visible": true },
        { "id": "battery", "type": "Text", "parent": null, "x": 310, "y": 12, "datum": "TR", "size": 1.5, "color": "#9ce5ac", "text": "82%", "visible": true },
        { "id": "temp", "type": "Text", "parent": null, "x": 18, "y": 70, "datum": "TL", "size": 4, "color": "#ffffff", "text": "24.5C", "visible": true },
        { "id": "panel", "type": "Rect", "parent": null, "x": 18, "y": 150, "w": 284, "h": 54, "color": "#172126", "visible": true }
      ]
    },
    {
      "id": "Stick", "w": 135, "h": 240, "rot": 0,
      "parts": [
        { "id": "headerBand", "type": "Rect", "parent": null, "x": 0, "y": 0, "w": 135, "h": 30, "color": "#1e2a30", "visible": true },
        { "id": "title", "type": "Text", "parent": null, "x": 8, "y": 7, "datum": "TL", "size": 1.5, "color": "#ffffff", "text": "Main", "visible": true },
        { "id": "battery", "type": "Text", "parent": null, "x": 8, "y": 180, "datum": "TL", "size": 1.5, "color": "#9ce5ac", "text": "82%", "visible": true },
        { "id": "temp", "type": "Text", "parent": null, "x": 10, "y": 60, "datum": "TL", "size": 3.5, "color": "#ffffff", "text": "24.5", "visible": true },
        { "id": "panel", "type": "Rect", "parent": null, "x": 10, "y": 110, "w": 115, "h": 60, "color": "#172126", "visible": true }
      ]
    },
    {
      "id": "Cardputer", "w": 240, "h": 135, "rot": 0,
      "parts": [
        { "id": "headerBand", "type": "Rect", "parent": null, "x": 0, "y": 0, "w": 240, "h": 26, "color": "#1e2a30", "visible": true },
        { "id": "title", "type": "Text", "parent": null, "x": 8, "y": 5, "datum": "TL", "size": 1.5, "color": "#ffffff", "text": "Main", "visible": true },
        { "id": "battery", "type": "Text", "parent": null, "x": 232, "y": 6, "datum": "TR", "size": 1.25, "color": "#9ce5ac", "text": "82%", "visible": true },
        { "id": "temp", "type": "Text", "parent": null, "x": 12, "y": 40, "datum": "TL", "size": 3, "color": "#ffffff", "text": "24.5C", "visible": true },
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

## 4. Do / Don't

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

## 5. Round-trip

This format maps one-to-one to the tool's internal model, so a layout exported from the
tool and edited by you can be imported back. Stable IDs are what make editing safe: an
unchanged `id` means "the same part, moved/restyled"; a new `id` means "a new part".

> The tool currently provides **export** ("Copy AI JSON" in Design mode). Re-importing
> AI output is applied manually for now; automatic import is planned (SPEC §8.15).
