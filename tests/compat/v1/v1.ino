// Backward-compat render capture (SPEC §9.2, Layer 3). Renders every profile x
// scene of the FROZEN v1 reference (CompatV1.h) to output/<profile>_<scene>.png
// on the host LovyanGFX backend. test_compat_v1.py pixel-compares these against
// the frozen references in render/. Direct mode (no LGFXVirtualCanvas): the
// golden is about layout/codegen output, which buffering does not change.
//
// Each profile is rendered into its OWN off-screen device sized to the profile's
// native w/h; the runtime applies the profile rotation, so createPng yields the
// upright display-size image. show(SceneId) draws the deterministic design state
// (no live data, no overlay), which is exactly what a golden needs.
#include <LovyanGFX.hpp>
#include <LGFX_AUTODETECT.hpp>
#include <LGFXScreenBuilder.h>
#include "CompatV1.h"

#include <stdio.h>
#include <sys/stat.h>

using namespace CompatV1;

static bool savePng(LovyanGFX &src, const char *path)
{
  size_t len = 0;
  void *png = src.createPng(&len, 0, 0, src.width(), src.height());
  if (!png || len == 0)
    return false;
  FILE *fp = fopen(path, "wb");
  bool ok = false;
  if (fp)
  {
    ok = (fwrite(png, 1, len, fp) == len);
    fclose(fp);
  }
  free(png);
  return ok;
}

void setup()
{
  Serial.begin(115200);
  Serial.println("TEST start compat_v1");
  mkdir("output", 0755);

  for (uint8_t pi = 0; pi < detail::kProfileInfoCount; ++pi)
  {
    const auto &P = detail::kProfileInfo[pi];
    LGFX dev(P.w, P.h); // off-screen device at the profile's native size
    dev.init();
    Screen screen(dev);
    screen.begin();
    // Profile enum is { Auto=0, <profiles...> }, so the array index pi maps to
    // enum value pi + 1 (resolveProfileIndex subtracts the 1 back).
    screen.setProfile(static_cast<Profile>(P.index + 1));

    for (uint16_t si = 0; si < detail::kSceneInfoCount; ++si)
    {
      const auto &S = detail::kSceneInfo[si];
      screen.show(S.id);
      char path[80];
      snprintf(path, sizeof(path), "output/%s_%s.png", P.name, S.name);
      bool ok = savePng(dev, path);
      Serial.printf("CAP %s %dx%d ok=%d\n", path, (int)dev.width(), (int)dev.height(), ok);
    }
  }

  Serial.println("TEST done compat_v1");
}

void loop() { delay(1000); }
