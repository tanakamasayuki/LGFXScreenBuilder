// LGFXScreenBuilder example: the smallest possible sketch (bare LovyanGFX).
// en: Deliberately minimal, so it draws DIRECTLY to the panel — every show()
//     clears and repaints in front of the user, which flickers on repeated
//     updates. That is fine here (two show() calls in setup, nothing in loop).
//     To get flicker-free tiled double buffering, install LGFXVirtualCanvas and
//     add this ABOVE "MyScreen.h" — no other change is needed:
//         #if __has_include(<LGFXVirtualCanvas.h>)
//         #include <LGFXVirtualCanvas.h>
//         #endif
//     See OverlayM5Unified for a sketch that does exactly that, and
//     docs/BEGINNERS_GUIDE.md for why direct drawing flickers.
// ja: 意図的に最小構成なので、パネルへ直接描画する。show() のたびに画面を消して
//     描き直すのが利用者に見えるため、繰り返し更新するとちらつく。この例では
//     setup で 2 回描くだけなので問題にならない。
//     ちらつかないタイル分割ダブルバッファにするには、LGFXVirtualCanvas を
//     インストールして、"MyScreen.h" より前に次を足すだけでよい:
//         #if __has_include(<LGFXVirtualCanvas.h>)
//         #include <LGFXVirtualCanvas.h>
//         #endif
//     実際にそうしている例は OverlayM5Unified、理由は
//     docs/BEGINNERS_GUIDE.ja.md を参照。
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
