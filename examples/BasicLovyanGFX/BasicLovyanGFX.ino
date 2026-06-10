#include <LovyanGFX.hpp>
#include <LGFX_AUTODETECT.hpp>
#include <LGFXScreenBuilder.h>
#include "MyScreen.h" // en: generated output (<project name>.h)  /  ja: 生成物（プロジェクト名.h）

using namespace MyScreen; // en: omit Scene:: / Profile:: / Screen (optional)  /  ja: Scene:: / Profile:: / Screen を省略（任意）

#if defined(SDL_h_)
static LGFX display(HOST_DISPLAY_WIDTH, HOST_DISPLAY_HEIGHT, HOST_DISPLAY_SCALE);
#else
static LGFX display;
#endif

static Screen screen(display); // en: project is already bound to the class  /  ja: プロジェクトはクラスに束縛済み

void setup()
{
  display.init();

#if defined(SDL_h_) && defined(HOST_DISPLAY_ROTATION) && (HOST_DISPLAY_ROTATION != 0)
  display.setRotation(HOST_DISPLAY_ROTATION);
#endif

  screen.begin(); // en: configuration hook after display init  /  ja: display 初期化後の設定フック

  screen.show(Scene::Boot{});

  Scene::Main main;
  main.title = "Main";
  main.battery = "82%";
  main.temp = "24.5C";
  screen.show(main);
}

void loop()
{
}
