// LGFXScreenBuilder example: multi-device profiles (SPEC 8.9 / 11.3).
// en: One design, one binary, several devices. Each profile holds its OWN layout
//     for the same parts, and Profile::Auto picks one at draw time by screen
//     size — so this sketch runs unchanged on Core, StickC Plus2 and Cardputer.
//     Press A to force the next profile explicitly. Forcing a profile that does
//     not match the panel is exactly how you preview ANOTHER device's layout on
//     the hardware you happen to have on your desk (it will not fit — that is
//     the point: you are looking at the other device's coordinates).
// ja: 1 つの設計・1 つのバイナリで複数機種。各プロファイルが同じパーツに対して
//     独立したレイアウトを持ち、Profile::Auto が描画時に画面サイズで選ぶ。
//     だからこのスケッチは Core / StickC Plus2 / Cardputer でそのまま動く。
//     A を押すとプロファイルを明示的に切り替える。パネルと一致しないプロファイル
//     を強制するのは、手元にある実機で「別機種のレイアウト」を下見するための
//     使い方（当然はみ出すが、それは別機種の座標を見ているから）。
#include <M5Unified.h>
// en: Tiled double-buffering (less flicker). Without the lib it draws directly.
// ja: タイル分割ダブルバッファ（ちらつき軽減）。無ければ直接描画にフォールバック。
#if __has_include(<LGFXVirtualCanvas.h>)
#include <LGFXVirtualCanvas.h>
#else
#warning "LGFXVirtualCanvas not found - drawing directly. Install it for flicker-free buffering."
#endif
#include <LGFXScreenBuilder.h>
#include "MyScreen.h"

using namespace MyScreen;

static Screen screen(M5.Display);

// en: The generated Profile enum knows only THIS project's profiles. Auto is
//     always 0; the rest follow the order set in the authoring tool (SPEC 8.9.4).
// ja: 生成される Profile enum はこのプロジェクトのプロファイルだけを知っている。
//     Auto は必ず 0 で、以降はオーサリングツールでの並び順（SPEC 8.9.4）。
static const Profile kProfiles[] = {
    Profile::Auto,
    Profile::Core,
    Profile::Stick,
    Profile::Cardputer,
};
static const char *kNames[] = {"Auto", "Core", "Stick", "Cardputer"};
static constexpr int kCount = sizeof(kProfiles) / sizeof(kProfiles[0]);

static int g_index = 0;

static void draw()
{
  // en: setProfile() only records the choice — nothing is drawn until show().
  //     Auto stays deferred: it resolves against the live screen size on EVERY
  //     show(), so a rotation change is picked up without touching this code.
  // ja: setProfile() は選択を記録するだけで、描画は show() まで起きない。
  //     Auto は遅延解決で、show() のたびに実画面サイズと突き合わせる。だから
  //     回転が変わってもこのコードを触らずに追従する。
  screen.setProfile(kProfiles[g_index]);

  Scene::Main main;
  main.title = kNames[g_index]; // en: shows which profile drew this  / ja: どのプロファイルで描いたか
  main.battery = "82%";
  main.temp = "24.5C";
  screen.show(main);
}

void setup()
{
  M5.begin();
  screen.begin(); // en: captures the board's standard rotation  / ja: ボードの標準回転を記録

  // en: Sanity check for the include order — false means <LGFXVirtualCanvas.h>
  //     was not included BEFORE MyScreen.h, and you are drawing directly.
  // ja: include 順の確認。false なら <LGFXVirtualCanvas.h> が MyScreen.h より
  //     前に include されておらず、直接描画になっている。
  Serial.printf("buffered: %d\n", (int)screen.isBuffered());

  draw();
}

void loop()
{
  M5.update();

  if (M5.BtnA.wasPressed())
  {
    g_index = (g_index + 1) % kCount;
    draw();
  }

  delay(16);
}
