// Buffered render path (§10): including <LGFXVirtualCanvas.h> before
// <LGFXScreenBuilder.h> selects tiled double buffering (Canvas == LGFXVirtualCanvas).
// Renders through the generated MyScreen facade with an overlay (§11.4) and
// captures host PNGs to prove the buffered path compiles AND draws.
#include <LovyanGFX.hpp>
#include <LGFX_AUTODETECT.hpp>
#include <LGFXVirtualCanvas.h>
#include <LGFXScreenBuilder.h>
#include "MyScreen.h"

#include <stdio.h>
#include <sys/stat.h>

using namespace MyScreen;

static LGFX lcd;
static Screen screen(lcd);

// Dynamic drawing that parts cannot express. The gfx parameter is templated, so
// registration deduces GFX = Canvas (here LGFXVirtualCanvas).
template <class GFX>
void mainOverlay(GFX &g, const Scene::Main &) {
  g.fillCircle(20, 20, 8, (uint16_t)0xF800);
}

static bool savePng(LovyanGFX &src, const char *path) {
  size_t len = 0;
  void *png = src.createPng(&len, 0, 0, src.width(), src.height());
  if (!png || len == 0) return false;
  FILE *fp = fopen(path, "wb");
  bool ok = false;
  if (fp) {
    ok = (fwrite(png, 1, len, fp) == len);
    fclose(fp);
  }
  free(png);
  return ok;
}

void setup() {
  Serial.begin(115200);
  Serial.println("TEST start build_buffered");

  mkdir("output", 0755);
  lcd.init();
  screen.begin();
  Serial.printf("PANEL %dx%d\n", (int)lcd.width(), (int)lcd.height());
  Serial.printf("BUFFERED %d\n", (int)screen.isBuffered()); // expect 1 in this build

  screen.setOverlay(mainOverlay);

  screen.show(Scene::Boot{}); // no overlay registered for Boot -> null-overlay path
  Serial.printf("BOOT saved=%d\n", savePng(lcd, "output/boot.png"));

  screen.show(Scene::Main{}); // static parts + overlay, composited per tile
  Serial.printf("PNG saved=%d\n", savePng(lcd, "output/build_buffered.png"));

  // Transparent scene (§8.16): pushed with the color key masked out, so Main
  // must still be on the panel around the dialog. Needs LGFXVirtualCanvas
  // 1.4.0+ in a buffered build, which this sketch.yaml pins.
  Serial.printf("TRANSPARENT %d\n", (int)screen.supportsTransparentScenes());
  screen.show(Scene::Dialog{});
  Serial.printf("DIALOG saved=%d\n", savePng(lcd, "output/dialog.png"));
  Serial.println("TEST done");
}

void loop() {
  delay(1000);
}
