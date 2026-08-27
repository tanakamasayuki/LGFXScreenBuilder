// Device-side check for every output format a generated font can use (§8.7.7).
//
// The browser tests prove the editor produces the bytes it means to. This proves
// the other half on real LovyanGFX: that each format compiles, links, loads and
// draws through the shared renderer — including the two that LovyanGFX parses at
// run time (BFF, VLW) and therefore cannot be pointed at as plain constants.
//
// Three things are checked that a compile alone would not catch:
//   1. Every font draws ink at all. A run-time font that failed to load falls
//      back to the default face, which still "works" and would pass a build.
//   2. The anti-aliased formats produce intermediate coverage levels and the
//      1bpp ones do not. That is the whole reason to pay for them.
//   3. Those levels blend toward the SCENE BACKGROUND. With the one-argument
//      setTextColor() LovyanGFX blends toward getBaseColor(), which defaults to
//      black — so on this non-black background a missing setBaseColor() shows up
//      as a dark halo, which is what the shade census below would reveal.
#include <LovyanGFX.hpp>
#include <LGFX_AUTODETECT.hpp>
#include <LGFXScreenBuilder.h>
#include "FormatsScreen.h"

#include <stdio.h>

using namespace FormatsScreen;

static LGFX lcd;
static Screen screen(lcd);

// Rows are 20px apart, in the order the generator emitted them.
struct Row { const char *label; int y; };
static const Row kRows[] = {
  {"u8g2", 4}, {"gfx", 24}, {"bff2", 44}, {"bff4", 64}, {"vlw8", 84},
};

// Ink and distinct colors inside one row's band.
//
// readPixel() hands back the panel's own raw value (RGB565 here), not RGB888,
// so nothing may assume a channel layout: "background" is whatever an empty
// corner reads, and a shade is any value distinct from the ones already seen.
// That keeps the measurement honest on any colour depth.
static void census(const Row &r, uint32_t bg, int *ink, int *shades, int *minG)
{
  uint32_t seen[128];
  int sh = 0, n = 0;
  // Green is the widest channel in RGB565 (6 bits), so it resolves the blend
  // most finely. Text is white and the background's green is 10/63, so every
  // pixel of a correct blend sits at or above 10. If setBaseColor() were missing
  // the fringe would blend toward BLACK instead and drop below it — which is the
  // dark halo this number exists to catch.
  int lowG = 63;
  const int w = lcd.width() < 120 ? lcd.width() : 120;
  for (int y = r.y; y < r.y + 18 && y < lcd.height(); ++y)
  {
    for (int x = 0; x < w; ++x)
    {
      const uint32_t c = lcd.readPixel(x, y);
      if (c != bg) ++n;
      bool known = false;
      for (int i = 0; i < sh; ++i) { if (seen[i] == c) { known = true; break; } }
      if (!known && sh < (int)(sizeof(seen) / sizeof(seen[0]))) seen[sh++] = c;
      const int gch = (int)((c >> 5) & 0x3f);
      if (gch < lowG) lowG = gch;
    }
  }
  *ink = n;
  *shades = sh;
  *minG = lowG;
}

void setup()
{
  Serial.begin(115200);
  Serial.println("TEST start build_font_formats");

  lcd.init();
  screen.begin();

  // The renderer sets the base colour per Text, and the base colour is NOT text
  // state — LovyanGFX also fills clear() / clearDisplay() and the scroll gap
  // with it. So a scene must put back what it found, or a later display.clear()
  // in the sketch would paint in whatever colour the last Text happened to use.
  // A deliberately odd value in, the same value out.
  lcd.setBaseColor((uint32_t)0x123456u);
  const uint32_t baseBefore = lcd.getBaseColor();
  screen.show(Scene::Main::id);
  Serial.printf("BASECOLOR before=%06x after=%06x\n",
                (unsigned)baseBefore, (unsigned)lcd.getBaseColor());
  Serial.printf("PANEL %dx%d\n", (int)lcd.width(), (int)lcd.height());
  // An untouched corner IS the background, whatever depth the panel uses.
  const uint32_t bg = lcd.readPixel(lcd.width() - 4, lcd.height() - 4);
  Serial.printf("BG %06x bgGreen=%d\n", (unsigned)bg, (int)((bg >> 5) & 0x3f));

  // The halo pair: same font, same light band, only PartLayout::bg differs.
  // HaloGood is told the band's colour; HaloBad follows the dark screen fill,
  // so its soft edges are dragged toward BLACK instead of toward the band —
  // putting pixels darker than the correct blend can ever produce.
  {
    const uint32_t band = lcd.readPixel(190, 126);
    int goodInk = 0, goodSh = 0, goodMin = 0, badInk = 0, badSh = 0, badMin = 0;
    census(Row{"good", 124}, band, &goodInk, &goodSh, &goodMin);
    census(Row{"bad", 144}, band, &badInk, &badSh, &badMin);
    Serial.printf("HALO band=%06x good_shades=%d good_min=%d bad_shades=%d bad_min=%d\n",
                  (unsigned)band, goodSh, goodMin, badSh, badMin);
  }

  for (const auto &r : kRows)
  {
    int ink = 0, shades = 0, minG = 0;
    census(r, bg, &ink, &shades, &minG);
    Serial.printf("ROW %s ink=%d shades=%d ming=%d\n", r.label, ink, shades, minG);
  }

  Serial.println("TEST done");
}

void loop() {}
