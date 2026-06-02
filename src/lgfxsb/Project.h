#pragma once

#include "Types.h"

// Project descriptor (the data contract). The generated header emits a const
// instance and the shared engine reads it. Invariant: a generated scene struct
// is determined only by ID/type/parent-child; coordinates, size, style, and
// profile live in this descriptor, kept independent from the Arduino-side
// usage code (§8.2).
namespace lgfxsb
{

  // Static definition of a part (the profile-independent portion). All parts of
  // all scenes are laid out in a single array, sliced by SceneDesc. `parent` is
  // an index into the same array (-1 = scene root).
  struct PartDesc
  {
    const char *id;
    PartType type;
    int16_t parent;       // -1 = root
    const char *text;     // Text preview string (used when there is no dynamic value)
    int16_t assetIndex;   // referenced asset for Image (-1 = none)
  };

  // Per-profile layout of a part (§8.9.6). Each profile holds complete,
  // independent values. Access as layouts[profileIndex * partCount + partIndex].
  struct PartLayout
  {
    int16_t x, y;         // local coordinates relative to the parent origin (Text: the anchor point)
    int16_t w, h;         // rectangle size for Rect/Image (unused for Text)
    uint8_t datum;        // Text datum (Datum)
    float size;           // Text size multiplier (equivalent to setTextSize)
    uint32_t color;       // 0xRRGGBB (Rect fill / Text color)
    bool visible;
  };

  struct SceneDesc
  {
    SceneId id;
    const char *name;
    uint16_t partStart;   // start index into parts[]
    uint16_t partCount;
  };

  // Profile definition (§8.9). `boards` are the lgfx::board_t values targeted by
  // auto-detection (stored as int).
  struct ProfileDesc
  {
    int16_t w, h;
    uint8_t rotation;
    const int16_t *boards;
    uint8_t boardCount;
  };

  struct Project
  {
    const ProfileDesc *profiles;
    uint8_t profileCount;
    uint8_t defaultProfile;   // index of the fallback profile (§8.9.4)

    const SceneDesc *scenes;
    uint16_t sceneCount;

    const PartDesc *parts;    // all parts of all scenes (referenced by range from SceneDesc)
    uint16_t partCount;

    const PartLayout *layouts; // [profileCount][partCount]

    uint32_t background;       // full-screen fill color 0xRRGGBB (§7.4)
  };

} // namespace lgfxsb
