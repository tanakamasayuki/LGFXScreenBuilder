// LGFXScreenBuilder example: tuning the tile memory budget (SPEC 10).
// en: Buffered drawing splits the screen into tiles and reuses two small sprites
//     (~19 KB each by default) instead of one full-screen buffer (320x240x2 =
//     150 KB). The budget is LGFXVirtualCanvas's, and LGFXScreenBuilder holds
//     that manager as a PROTECTED member (_vscreen) — it is not on the public
//     API — so reaching it means deriving from the generated Screen, as below.
//     Press A to cycle budgets and watch the tile count change on Serial.
//     Bigger tiles = fewer splits = the draw callback re-runs fewer times, at
//     the cost of RAM. It does NOT reduce total drawing work per frame, and the
//     transfer time is fixed by screen size and bus clock either way.
//     See docs/BEGINNERS_GUIDE.md sections 4 and 6.
// ja: バッファ描画は画面をタイルに分割し、全画面バッファ（320x240x2 = 150 KB）の
//     代わりに小さな sprite 2 枚（既定で各約 19 KB）を使い回す。この予算は
//     LGFXVirtualCanvas のもので、LGFXScreenBuilder はそのマネージャを
//     protected メンバ（_vscreen）として持つ。公開 API には出ていないので、
//     触るには下記のように生成された Screen を継承する。
//     A で予算を切り替えると、分割数が Serial で変わるのが見える。
//     タイルを大きくする＝分割が減る＝描画コールバックの再実行回数が減る。
//     引き換えに RAM を食う。1 フレームの描画総量は減らないし、転送時間は
//     どちらにせよ画面サイズとバスクロックで決まる。
//     docs/BEGINNERS_GUIDE.ja.md の 4 章・6 章を参照。
#include <M5Unified.h>
// en: Without this the sketch still builds and runs — it just draws directly,
//     and every knob below becomes a no-op (there are no tiles to size).
// ja: 無くてもビルドも動作もする。直接描画になり、下の調整は全て no-op になる
//     （そもそもタイルが無い）。
#if __has_include(<LGFXVirtualCanvas.h>)
#include <LGFXVirtualCanvas.h>
#else
#warning "LGFXVirtualCanvas not found - drawing directly. Install it to try the tile budget."
#endif
#include <LGFXScreenBuilder.h>
#include "MyScreen.h"

using namespace MyScreen;

// en: Deriving is the supported way to reach the tile manager: _vscreen is
//     protected, so a subclass sees it while ordinary user code does not.
//     Everything touching it is guarded, so this class also compiles in a
//     direct-drawing build where _vscreen does not exist at all.
// ja: タイルマネージャに触る正規の方法が継承。_vscreen は protected なので、
//     派生クラスからは見えるが通常の利用コードからは見えない。
//     参照箇所は全てガードしてあるので、_vscreen が存在しない直接描画ビルドでも
//     このクラスはコンパイルできる。
struct TunedScreen : Screen
{
  using Screen::Screen; // en: inherit the constructor  / ja: コンストラクタを継承

  // en: Returns false if the budget could not be satisfied. LGFXVirtualCanvas
  //     does NOT silently fall back: a failed allocation stays failed and
  //     render() draws nothing, so check it instead of assuming.
  // ja: 予算を満たせなければ false。LGFXVirtualCanvas は黙ってフォールバック
  //     しない。確保に失敗したままなら render() は何も描かないので、
  //     前提にせず確認すること。
  bool setBudget(size_t bytes)
  {
#if defined(LGFXVIRTUALCANVAS_H)
    _vscreen.setMemoryLimit(bytes);
    return _vscreen.begin(); // en: allocate now, so failure surfaces here  / ja: ここで確保して失敗を露出させる
#else
    (void)bytes;
    return false;
#endif
  }

  void report(const char *label) const
  {
#if defined(LGFXVIRTUALCANVAS_H)
    // en: doubleBuffer() is the RESOLVED mode: auto turns it on from 2 tiles up
    //     (1 tile has nothing to overlap with), and off for PSRAM tiles, which
    //     LovyanGFX pushes without DMA.
    // ja: doubleBuffer() は解決後の実モード。auto は 2 タイル以上で有効になり
    //     （1 タイルでは重ねる相手が無い）、PSRAM タイルでは無効になる
    //     （LovyanGFX が DMA 無しで push するため）。
    Serial.printf("%-9s tiles=%d height=%dpx double=%d psram=%d\n",
                  label, _vscreen.tileCount(), _vscreen.tileHeight(),
                  (int)_vscreen.doubleBuffer(), (int)_vscreen.tileIsPsram());
#else
    Serial.printf("%-9s direct drawing - no tiles\n", label);
#endif
  }
};

static TunedScreen screen(M5.Display);

// en: 0 = "leave the library default" (~19 KB per tile buffer).
// ja: 0 は「ライブラリ既定のまま」（タイルバッファ 1 枚あたり約 19 KB）。
static const size_t kBudgets[] = {0, 8 * 1024, 40 * 1024};
static const char *kLabels[] = {"default", "8KB", "40KB"};
static constexpr int kCount = sizeof(kBudgets) / sizeof(kBudgets[0]);

static int g_index = 0;

static void apply()
{
  if (kBudgets[g_index] != 0 && !screen.setBudget(kBudgets[g_index]))
    Serial.printf("%-9s allocation FAILED - not enough RAM\n", kLabels[g_index]);

  screen.report(kLabels[g_index]);

  Scene::Main main;
  main.title = kLabels[g_index];
  main.battery = "82%";
  main.temp = "24.5C";
  screen.show(main); // en: same picture at any budget  / ja: 予算が違っても絵は同じ
}

void setup()
{
  M5.begin();
  screen.begin();

  // en: false means <LGFXVirtualCanvas.h> was not included BEFORE MyScreen.h.
  // ja: false なら <LGFXVirtualCanvas.h> が MyScreen.h より前に無い。
  Serial.printf("buffered: %d\n", (int)screen.isBuffered());

  apply();
}

void loop()
{
  M5.update();

  if (M5.BtnA.wasPressed())
  {
    g_index = (g_index + 1) % kCount;
    apply();
  }

  delay(16);
}
