#pragma once

#include <stdint.h>

// Basic types and enums: the smallest elements of the data contract shared by
// the generated code and the shared rendering engine.
namespace lgfxsb
{

  using SceneId = uint16_t;

  // Drawable part type (§8.2).
  enum class PartType : uint8_t
  {
    Rect = 0,
    Line,
    Circle,
    Text,
    Image,
  };

  // Text datum / anchor point (§8.7). Values match lgfx::textdatum_t EXACTLY
  // (horizontal = low 2 bits: left/center/right = 0/1/2; vertical = top/middle/
  // bottom = 0/4/8), so PartLayout.datum casts straight to lgfx::textdatum_t.
  // Do NOT renumber to a plain 0..8 sequence: the middle/bottom rows would then
  // map to the wrong datum (this was a bug — MC=4 cast to middle_left).
  enum class Datum : uint8_t
  {
    TL = 0, TC = 1, TR = 2,
    ML = 4, MC = 5, MR = 6,
    BL = 8, BC = 9, BR = 10,
  };

  // Carrier for a "dynamic value" that the generated facade extracts from a
  // scene struct and passes to the shared engine. One per part.
  // Text -> string/integer; visibility control -> boolean.
  struct Value
  {
    enum class Kind : uint8_t { None, Text, Int, Bool } kind = Kind::None;
    const char *s = nullptr;
    long i = 0;
    bool b = false;

    static Value text(const char *v) { Value x; x.kind = Kind::Text; x.s = v; return x; }
    static Value integer(long v)     { Value x; x.kind = Kind::Int;  x.i = v; return x; }
    static Value boolean(bool v)     { Value x; x.kind = Kind::Bool; x.b = v; return x; }
  };

} // namespace lgfxsb
