// LGFXScreenBuilder example: dynamic drawing hook (overlay, SPEC 11.4).
// en: The static parts (title / battery text / temp) come from MyScreen.h.
//     An overlay composites a live battery bar that parts cannot express,
//     into the SAME buffer as the parts (no extra flicker).
// ja: 静的パーツ（タイトル / 電池テキスト / 温度）は MyScreen.h から。
//     パーツでは表現できない「動く電池バー」を overlay で同じバッファに合成する
//     （別バッファ不要・追加のちらつきなし）。
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

// en: Live value advanced in loop(); the overlay only READS it (draw-only).
// ja: loop() で進める実データ。overlay は読むだけ（描画専用）。
static int g_batteryPct = 100;

// en: Overlay for the Main scene. Runs after show() drew the parts, ONCE PER TILE
//     in buffered mode, so it must be idempotent: same input -> same picture.
//     Templating the gfx param avoids naming the canvas type; GFX deduces to Canvas.
// ja: Main シーン用 overlay。show() がパーツを描いた後に呼ばれ、バッファ時は
//     タイル毎に複数回走るため冪等であること（同入力→同描画）。
//     gfx をテンプレートにするとキャンバス型名を書かずに済む（GFX=Canvas に推論）。
template <class GFX>
void mainOverlay(GFX &g, const Scene::Main &s)
{
  (void)s; // en: this demo reads g_batteryPct; s carries the typed text fields  / ja: 本例は g_batteryPct を使用。s は型付きテキスト
  // en: Profile-relative geometry so it fits Core / Stick / Cardputer alike.
  // ja: プロファイル相対の座標。Core / Stick / Cardputer いずれにも収まる。
  const int w = g.width(), h = g.height();
  const int margin = w / 12;
  const int barW = w - margin * 2;
  const int barH = h / 12;
  const int x = margin, y = h - barH - margin;

  // en: Color shifts with the level (green -> amber -> red).
  // ja: 残量で色が変わる（緑→橙→赤）。
  uint32_t fill = (g_batteryPct > 50)   ? 0x4caf50
                  : (g_batteryPct > 20) ? 0xffb300
                                        : 0xe53935;
  const int fillW = barW * g_batteryPct / 100;

  g.drawRoundRect(x, y, barW, barH, barH / 3, 0xffffff);
  if (fillW > 2)
    g.fillRoundRect(x + 1, y + 1, fillW - 2, barH - 2, barH / 3, fill);
}

void setup()
{
  M5.begin();
  screen.begin();                 // en: Profile::Auto resolves by screen size  / ja: 画面サイズで自動判定
  screen.setOverlay(mainOverlay); // en: register once  / ja: 一度だけ登録
}

void loop()
{
  M5.update();

  // en: Advance state OUTSIDE the overlay (sensor read / animation goes here).
  // ja: 状態は overlay の外で進める（センサ取得やアニメはここ）。
  static int dir = -1;
  g_batteryPct += dir;
  if (g_batteryPct <= 0 || g_batteryPct >= 100)
    dir = -dir;

  Scene::Main main;
  static char buf[8];
  snprintf(buf, sizeof(buf), "%d%%", g_batteryPct);
  main.battery = buf; // en: text label stays in sync with the bar  / ja: テキストもバーと同期
  screen.show(main);  // en: overlay runs automatically (per tile when buffered)  / ja: overlay が自動実行（バッファ時はタイル毎）

  delay(33);
}
