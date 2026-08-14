// Font-CATALOG host harness (SPEC §8.7.2) — the preset-font catalog, not the
// font generator of §8.7.7 (that lives in docs/src/fontgen/ and needs no sketch).
//
// This sketch exists to pin library versions: building it downloads the exact
// LovyanGFX / M5GFX copies named in sketch.yaml into ~/.arduino15/internal, and
// tests/manual/font_introspect/gen.py reads that pin as its single source of
// truth. The introspection itself (metrics / coverage / data size + a sample
// PNG per font for the adoption preview) runs from that harness.
#include <LovyanGFX.hpp>
#include <LGFX_AUTODETECT.hpp>

void setup() {}
void loop() {}
