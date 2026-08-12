#include <LovyanGFX.hpp>
#include <LGFX_AUTODETECT.hpp>
#include <LGFXScreenBuilder.h>
#include "MyScreen.h" // sample generated header (§11)

#include <stdio.h>
#include <sys/stat.h>

using namespace MyScreen;

static LGFX lcd;
static Screen screen(lcd);

static bool savePng(LovyanGFX &src, const char *path)
{
  size_t len = 0;
  void *png = src.createPng(&len, 0, 0, src.width(), src.height());
  if (!png || len == 0)
  {
    return false;
  }

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
  Serial.println("TEST start build_lovyangfx");

  mkdir("output", 0755);
  lcd.init();
  screen.begin();
  Serial.printf("PANEL %dx%d\n", (int)lcd.width(), (int)lcd.height());

  screen.show(Scene::Boot{});
  const bool bootSaved = savePng(lcd, "output/boot.png");
  Serial.printf("BOOT saved=%d\n", bootSaved);

  Scene::Main main;
  main.title = "Main";
  main.battery = "82%";
  main.temp = "24.5C";
  screen.show(main);

  const bool saved = savePng(lcd, "output/build_lovyangfx.png");
  Serial.printf("PNG saved=%d\n", saved);

  // Transparent scene (§8.16) in DIRECT mode: there is no masked transfer here,
  // but skipping the background fill is exactly equivalent - the parts are opaque,
  // so everything they do not cover keeps showing Main.
  Serial.printf("TRANSPARENT %d\n", (int)screen.supportsTransparentScenes());
  screen.show(Scene::Dialog{});
  Serial.printf("DIALOG saved=%d\n", savePng(lcd, "output/dialog.png"));
  Serial.println("TEST done");
}

void loop()
{
  delay(1000);
}
