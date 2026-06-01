#pragma once

#include "lgfxscreenbuilder_version.h"

namespace Scene
{

  struct Boot
  {
    static constexpr int id = 0;
  };

  struct Main
  {
    static constexpr int id = 1;

    struct Header
    {
      const char *title = "";
      int battery = 0;
    } header;

    struct Body
    {
      const char *temperature = "";
      bool loadingVisible = false;
    } body;
  };

} // namespace Scene

class LGFXScreenBuilder
{
public:
  LGFXScreenBuilder() = default;
  explicit LGFXScreenBuilder(LovyanGFX &gfx) : _gfx(&gfx) {}

  void begin(LovyanGFX *gfx) { _gfx = gfx; }
  void begin(LovyanGFX &gfx) { _gfx = &gfx; }

  template <typename TScene>
  void show(const TScene &scene)
  {
    render(scene);
  }

  template <typename TScene>
  void update(const TScene &scene)
  {
    render(scene);
  }

  void update() {}

private:
  template <typename TScene>
  void render(const TScene &)
  {
    if (_gfx)
    {
      _gfx->fillScreen(0);
    }
  }

  LovyanGFX *_gfx = nullptr;
};
