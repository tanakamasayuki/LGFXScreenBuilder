// Browser-generated custom font -> exported project header -> LGFXScreenBuilder
// -> real LovyanGFX host renderer. GeneratedScreen.h is produced by
// tests/fontgen/editor_integration.mjs during CI.
#include <LovyanGFX.hpp>
#include <LGFX_AUTODETECT.hpp>
#include <LGFXScreenBuilder.h>

#if __has_include("GeneratedScreen.h")
#include "GeneratedScreen.h"
#define HAVE_GENERATED_FONT_PROJECT 1
#else
#define HAVE_GENERATED_FONT_PROJECT 0
#endif

#include <stdio.h>
#include <sys/stat.h>

static LGFX lcd;

static bool savePng(LovyanGFX &src, const char *path)
{
  size_t len = 0;
  void *png = src.createPng(&len, 0, 0, src.width(), src.height());
  if (!png || !len) return false;
  FILE *fp = fopen(path, "wb");
  const bool ok = fp && fwrite(png, 1, len, fp) == len;
  if (fp) fclose(fp);
  free(png);
  return ok;
}

// The Boot text is centered at y=160 on the Core profile. Its background logo
// ends at y=139, so this region contains only text pixels.
static void textSignature(int &ink, uint32_t &hash)
{
  ink = 0;
  hash = 2166136261u;
  for (int y = 140; y < 200; ++y)
  {
    for (int x = 0; x < lcd.width(); ++x)
    {
      const uint32_t p = lcd.readPixel(x, y);
      if (p) ++ink;
      hash = (hash ^ p) * 16777619u;
    }
  }
}

void setup()
{
  Serial.begin(115200);
  Serial.println("TEST start build_font_project_e2e");

#if HAVE_GENERATED_FONT_PROJECT
  mkdir("output", 0755);
  lcd.init();
  MyScreen::Screen screen(lcd);
  screen.begin();
  screen.setProfile(MyScreen::Profile::Core);

  MyScreen::Scene::Boot scene;
  int inkActual, inkCelsius, inkMissing, inkBars;
  uint32_t hashActual, hashCelsius, hashMissing, hashBars;

  scene.boot = "25.6\xe2\x84\x83 Il1";
  screen.show(scene);
  textSignature(inkActual, hashActual);
  Serial.printf("ACTUAL ink=%d hash=%08x height=%d width=%d\n",
                inkActual, (unsigned)hashActual,
                (int)lcd.fontHeight(), (int)lcd.textWidth(scene.boot));
  Serial.printf("PNG saved=%d\n", savePng(lcd, "output/project-font.png"));

  // Roboto does not contain ℃; this glyph must have survived generation from
  // the Noto Sans JP fallback, u8g2 encoding, project embedding and decoding.
  scene.boot = "\xe2\x84\x83";
  screen.show(scene);
  textSignature(inkCelsius, hashCelsius);
  Serial.printf("CELSIUS ink=%d hash=%08x\n", inkCelsius, (unsigned)hashCelsius);

  // 漢 is outside the Latin UI subset and must render as LovyanGFX's missing
  // glyph box, not accidentally resolve to a neighbouring encoded glyph.
  scene.boot = "\xe6\xbc\xa2";
  screen.show(scene);
  textSignature(inkMissing, hashMissing);
  Serial.printf("MISSING ink=%d hash=%08x\n", inkMissing, (unsigned)hashMissing);

  // Regression guard for narrow bar glyphs that presence detection once lost.
  scene.boot = "Il1";
  screen.show(scene);
  textSignature(inkBars, hashBars);
  Serial.printf("BARS ink=%d hash=%08x\n", inkBars, (unsigned)hashBars);
  Serial.printf("VERSION %s\n", LGFX_FONT_TOOL_E2E_VERSION);
#else
  Serial.println("NO_GENERATED_HEADER");
#endif

  Serial.println("TEST done");
}

void loop() { delay(1000); }
