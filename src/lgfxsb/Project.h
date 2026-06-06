#pragma once

#include "Types.h"

// Project descriptor (the data contract). The generated header emits a const
// instance and the shared engine reads it. Invariant: a generated scene struct
// is determined only by ID/type; coordinates, size, style, and profile live in
// this descriptor, kept independent from the Arduino-side usage code (§8.2).
namespace lgfxsb
{

  // Static definition of a part (the profile-independent portion). All parts of
  // all scenes are laid out in a single array, sliced by SceneDesc.
  struct PartDesc
  {
    const char *id;
    PartType type;
    const char *text;     // Text preview string (used when there is no dynamic value)
    int16_t assetIndex;   // referenced asset for Image (-1 = none)
  };

  // Per-profile layout of a part (§8.9.6). Each profile holds complete,
  // independent values. Access as layouts[profileIndex * partCount + partIndex].
  struct PartLayout
  {
    int16_t x, y;         // scene coordinates (Text: the anchor point)
    int16_t w, h;         // rectangle size for Rect/Image (unused for Text)
    int16_t r;            // corner radius for Rect
    uint8_t datum;        // Text datum (Datum)
    float size;           // Text size multiplier (equivalent to setTextSize)
    uint32_t color;       // 0xRRGGBB (Rect fill / Text color)
    bool fill;            // Rect: true = fill, false = outline
    bool visible;
    const void *font;     // Text preset font: &lgfx::v1::fonts::X, or null = default.
                          // void* keeps this header framework-agnostic (the Renderer
                          // casts to const lgfx::v1::IFont*). Trailing field so older
                          // generated headers value-initialize it to null.
  };

  struct SceneDesc
  {
    SceneId id;
    const char *name;
    uint16_t partStart;   // start index into parts[]
    uint16_t partCount;
  };

  // Profile definition (§8.9). Auto-detection is based on screen size only.
  struct ProfileDesc
  {
    int16_t w, h;
    uint8_t rotation;
  };

  // Image asset: RGB565 pixels (row-major), referenced by PartDesc::assetIndex
  // (§8.4, Header/PROGMEM + RAW RGB565).
  struct AssetDesc
  {
    const uint16_t *data;
    int16_t w, h;
  };

  struct Project
  {
    const ProfileDesc *profiles;
    uint8_t profileCount;

    const SceneDesc *scenes;
    uint16_t sceneCount;

    const PartDesc *parts;    // all parts of all scenes (referenced by range from SceneDesc)
    uint16_t partCount;

    const PartLayout *layouts; // [profileCount][partCount]

    uint32_t background;       // full-screen fill color 0xRRGGBB (§7.4)

    // Appended after background so older generated headers (which omit these)
    // still aggregate-initialize them to {nullptr, 0}.
    const AssetDesc *assets;   // image assets (RGB565); referenced by PartDesc::assetIndex
    uint16_t assetCount;
  };

} // namespace lgfxsb
