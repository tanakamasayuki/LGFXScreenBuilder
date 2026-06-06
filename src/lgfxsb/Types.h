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
    Text,
    Image,
  };

  // Text datum / anchor point (§8.7). The ordering matches LovyanGFX
  // textdatum_t (top_left..bottom_right) so it can be cast directly.
  enum class Datum : uint8_t
  {
    TL = 0, TC, TR,
    ML, MC, MR,
    BL, BC, BR,
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
