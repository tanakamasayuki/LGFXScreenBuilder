#include <LovyanGFX.hpp>
#include <LGFX_AUTODETECT.hpp>
#include <LGFXScreenBuilder.h>

static LGFX display;
static LGFXScreenBuilder screen(display);

void setup()
{
  display.init();

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
