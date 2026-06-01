#include <LovyanGFX.hpp>
#include <LGFX_AUTODETECT.hpp>
#include <LGFXScreenBuilder.h>

#include <stdio.h>
#include <sys/stat.h>

static LGFX lcd;
static LGFXScreenBuilder screen(lcd);

static bool savePng(LovyanGFX& src, const char* path) {
  size_t len = 0;
  void* png = src.createPng(&len, 0, 0, src.width(), src.height());
  if (!png || len == 0) {
    return false;
  }

  FILE* fp = fopen(path, "wb");
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
  Serial.println("TEST start build_lovyangfx");

  mkdir("output", 0755);
  lcd.init();
  Serial.printf("PANEL %dx%d\n", (int)lcd.width(), (int)lcd.height());

  screen.show(Scene::Boot{});

  Scene::Main main;
  main.header.title = "Main";
  main.header.battery = 82;
  main.body.temperature = "24.5C";
  screen.show(main);

  lcd.setTextColor(TFT_WHITE);
  lcd.drawString("LGFXScreenBuilder", 4, 4);

  const bool saved = savePng(lcd, "output/build_lovyangfx.png");
  Serial.printf("PNG saved=%d\n", saved);
  Serial.println("TEST done");
}

void loop() {
  delay(1000);
}
