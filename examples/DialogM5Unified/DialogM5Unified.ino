// LGFXScreenBuilder example: transparent scene (dialog overlay, SPEC 8.16).
// en: The Dialog scene in MyScreen.h is marked "transparent" in the authoring
//     tool. It has NO background of its own: it is pushed over whatever is
//     already on the panel, with the project's color key masked out — so the
//     rounded corners show the screen underneath instead of a box.
//     Press A to open the dialog, B to close it. Closing is the ONLY moment the
//     screen below has to be drawn again.
// ja: MyScreen.h の Dialog シーンはツール側で「透過シーン」に指定してある。
//     自前の背景を持たず、パネルに出ている絵の上に重ねて転送され、抜け色は
//     マスクされる。だから角丸の外側は箱ではなく下の画面が見える。
//     A で開き、B で閉じる。下の画面を描き直すのは「閉じる時だけ」。
#include <M5Unified.h>
// en: Buffered drawing is what makes the overlay flicker-free AND atomic; a
//     transparent scene needs LGFXVirtualCanvas 1.4.0 or newer. Without the
//     library it falls back to direct drawing, which still works (the parts are
//     opaque, so skipping the background fill is equivalent) but flickers.
// ja: バッファリングすると重ね描画がちらつかず一括転送になる。透過シーンには
//     LGFXVirtualCanvas 1.4.0 以降が必要。ライブラリが無ければ直接描画に
//     フォールバックし、動作はする（パーツは不透明なので背景を塗らないだけで
//     等価）が、ちらつく。
#if __has_include(<LGFXVirtualCanvas.h>)
#include <LGFXVirtualCanvas.h>
#else
#warning "LGFXVirtualCanvas not found - drawing directly. Install 1.4.0+ for flicker-free overlays."
#endif
#include <LGFXScreenBuilder.h>
#include "MyScreen.h"

using namespace MyScreen;

static Screen screen(M5.Display);

// en: Which screen is under the dialog, so closing can repaint exactly that.
// ja: ダイアログの下にある画面。閉じる時にそれだけを描き直すため保持する。
static void showBase()
{
  Scene::Main main;
  main.title = "Main";
  main.battery = "82%";
  main.temp = "24.5C";
  screen.show(main);
}

static bool g_dialogOpen = false;

void setup()
{
  M5.begin();
  screen.begin(); // en: Profile::Auto resolves by screen size  / ja: 画面サイズで自動判定

  // en: false only on a buffered build with LGFXVirtualCanvas older than 1.4.0,
  //     where a transparent scene is drawn as an ordinary opaque screen.
  // ja: false になるのはバッファ構成で LGFXVirtualCanvas が 1.4.0 未満のときだけ。
  //     その場合、透過シーンは通常の不透明画面として描かれる。
  Serial.printf("transparent scenes: %d\n", (int)screen.supportsTransparentScenes());

  showBase();
}

void loop()
{
  M5.update();

  if (M5.BtnA.wasPressed() && !g_dialogOpen)
  {
    g_dialogOpen = true;
    // en: The screen below is NOT redrawn — only the dialog's own pixels are
    //     transferred, so this costs a fraction of a full frame.
    // ja: 下の画面は描き直さない。ダイアログが実際に描いた画素だけが転送される。
    screen.show(Scene::Dialog{});
  }

  if (M5.BtnB.wasPressed() && g_dialogOpen)
  {
    g_dialogOpen = false;
    // en: Dismissing is the one case that needs the layer below repainted.
    // ja: 消すときだけは下のレイヤを描き直す必要がある。
    showBase();
  }

  delay(16);
}
