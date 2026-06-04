#include <LovyanGFX.hpp>
#include <LGFX_AUTODETECT.hpp>
#include <LGFXScreenBuilder.h>
#include "MyScreen.h" // en: generated output (<project name>.h)  /  ja: 生成物（プロジェクト名.h）

using namespace MyScreen; // en: omit Scene:: / Profile:: / Screen (optional)  /  ja: Scene:: / Profile:: / Screen を省略（任意）

static LGFX display;
static Screen screen(display); // en: project is already bound to the class  /  ja: プロジェクトはクラスに束縛済み

void setup()
{
  display.init();
  screen.begin(); // en: configuration hook after display init  /  ja: display 初期化後の設定フック

  screen.show(Scene::Boot{});

  Scene::Main main;
  main.header.title = "Main";
  main.header.battery = 82;
  main.body.temperature = "24.5C";
  screen.show(main);
}

void loop()
{
}
