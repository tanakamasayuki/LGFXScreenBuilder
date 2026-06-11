# LGFXScreenBuilder

> English: [README.md](README.md)

デバイス画面をブラウザで設計し、生成された Arduino C++ を出力し、小さな**型付き** API
で描画する —
[LovyanGFX](https://github.com/lovyan03/LovyanGFX) /
[M5GFX](https://github.com/m5stack/M5GFX) /
[M5Unified](https://github.com/m5stack/M5Unified) 向けです。

LGFXScreenBuilder は LVGL のような GUI フレームワークでは**ありません**。*画面設計* と
*アプリのロジック* を分離します。シーン・パーツ・フォント・画像アセットを GitHub Pages の
オーサリングツールで配置し、ヘッダを出力し、生成された構造体に値を渡して表示を更新します。
文字列 ID も、ウィジェットツリーも、Web サーバーも不要です。

- **オーサリングツール:** <https://tanakamasayuki.github.io/LGFXScreenBuilder/>
- **画面キャプチャギャラリー**（全プロファイル × 全シーンを host バックエンドで描画）:
  <https://tanakamasayuki.github.io/LGFXScreenBuilderScreenshotTest/>

## 仕組み

```
 ブラウザのオーサリングツール       あなたの Arduino スケッチ
 ────────────────────────         ───────────────────────────────
 シーン / パーツ / フォント /        #include "MyScreen.h"
 画像 / プロファイルを設計           screen.show(値を入れたシーン構造体)
        │  .h を出力                          ▲
        └──────── MyScreen.h ────────────────┘
```

**複数デバイス**向けに一度だけ設計します（デバイス/サイズごとに *プロファイル*）。実行時は
`Profile::Auto` が画面サイズでレイアウトを選ぶので、1 つのバイナリで Core・StickC・Cardputer
などに対応できます。

## クイックスタート（Arduino）

1. 本ライブラリ（Library Manager → *LGFXScreenBuilder*、または `libraries/` に clone）と、
   ディスプレイライブラリ（M5Unified / M5GFX / LovyanGFX）をインストールします。
2. オーサリングツールで画面を設計し、**Export .h**（例: `MyScreen.h`）。`.ino` の隣に置きます。
3. シーン構造体に実データを入れて描画します。

```cpp
#include <M5Unified.h>
#include <LGFXScreenBuilder.h>
#include "MyScreen.h"          // オーサリングツールからの出力

using namespace MyScreen;       // 任意: Scene:: / Profile:: / Screen を省略

static Screen screen(M5.Display);

void setup() {
  M5.begin();
  screen.begin();               // Profile::Auto が画面サイズで解決

  screen.show(Scene::Boot{});   // 実データのない画面

  Scene::Main main;             // フィールド = エディタで名付けたパーツ
  main.title   = "Main";
  main.battery = "82%";
  main.temp    = "24.5C";
  screen.show(main);            // 描画
}

void loop() { M5.update(); }
```

静的パーツ（背景の矩形・ラベル・画像）は出力ヘッダに入ります。コードは変化する値だけを渡します。
[examples/](examples/) を参照してください。

## 特長

- **1 つの設計で多デバイス。** デバイスごとのプロファイルが同じパーツの独立レイアウトを保持し、
  `Profile::Auto` が画面サイズとプロファイル順で選択します。
- **パーツ:** 角丸矩形・直線・円・1 行テキスト（datum でアンカー、倍率で拡大）・
  PNG/JPEG 画像アセット（RGB565 へデコード）。
- **プリセットフォントをプロファイル毎に。** LovyanGFX フォントのカタログを閲覧（描画高・スクリプト・
  等幅/可変などで絞り込み）、必要な分だけ採用し、各フォントを必要なプロファイルだけで有効化します。
  小さな画面はフラッシュ予算内に収まります（フォント毎の正確なフラッシュ消費を表示）。
- **プロファイル毎のデザインテキスト。** 各プロファイルが独自のプレースホルダ文字列を持て、
  実行時にシーン構造体で上書きできます。
- **AI レイアウト I/O。** シーンを自己完結 JSON でコピーし、
  [docs/AI_LAYOUT_IO.ja.md](docs/AI_LAYOUT_IO.ja.md) と一緒に AI へ渡し、結果を貼り戻せます。
- **動的オーバーレイ**（ゲージ・バー・波形）を静的パーツと同じバッファに合成 —
  [examples/OverlayM5Unified/](examples/OverlayM5Unified/) を参照。
- **バッファ描画 / 直接描画。** 任意の `LGFXVirtualCanvas` ライブラリによるタイル分割
  ダブルバッファでちらつきを低減。外せば直接描画になります。
- **host 画面キャプチャ。** 生成メタデータにより host バックエンドで全プロファイル × 全シーンを
  PNG 化し回帰テストできます（上記ギャラリー）。
- **多言語 UI:** 英語・日本語・簡体字中国語・繁体字中国語・韓国語・スペイン語・フランス語・ドイツ語。

## 生成される API

出力 `MyScreen.h` が型付きファサードを定義します（通常は文字列 ID 不要）。

```cpp
screen.show(sceneId);                 // メタデータ番号でシーン（プレビュー/ツアー状態）
screen.show(Scene::Main{...});        // 実データ付きシーン（シーン毎オーバーロード）
screen.setProfile(Profile::Core);     // プロファイル強制（既定: Profile::Auto）
screen.setOverlay(mainOverlay);       // 1 シーン向けの任意の動的描画（§11.4）
```

未知のシーン型を渡すとコンパイルエラーになります。API は*このプロジェクトの*シーンと
プロファイルだけを知っています。

## examples

| 例 | ターゲット | 内容 |
| --- | --- | --- |
| [BasicLovyanGFX](examples/BasicLovyanGFX/) | LovyanGFX | 素の LovyanGFX デバイスでの最小 `show()` |
| [BasicM5Unified](examples/BasicM5Unified/) | M5Unified | M5 ハードでの最小 `show()` |
| [ExportedSample](examples/ExportedSample/) | M5Unified | Export 出力そのまま — シーンツアー（A ボタンで送り） |
| [OverlayM5Unified](examples/OverlayM5Unified/) | M5Unified | 静的パーツ上の動的オーバーレイ（電池バー） |

`ExportedSample` と `OverlayM5Unified` の `MyScreen.h` は、保存済みプロジェクトから
`tools/gen-fixtures.mjs` で再生成されるため、常に現行の codegen と一致します。

## ドキュメント

- [SPEC.ja.md](SPEC.ja.md) — 全仕様（English: [SPEC.md](SPEC.md)）
- [docs/AI_LAYOUT_IO.ja.md](docs/AI_LAYOUT_IO.ja.md) — AI に渡すレイアウト JSON 契約（正本は英語版）
- [docs/README.ja.md](docs/README.ja.md) — オーサリングツール本体（開発者向けメモ）

## テスト

オーサリングツールは素の ES モジュール（ビルド不要）。リポジトリのガードは Node で、画面描画は
`lang-ship:host` の LovyanGFX バックエンドで pytest + Arduino CLI により検証します。

```sh
# Node ガード（生成ヘッダ / プロジェクト形式 / AI ブロック / i18n キー一致）
node tools/gen-fixtures.mjs --check
node tools/check-formats.mjs --check
node tools/check-ai-layout-embed.mjs
node tools/check-i18n.mjs

# host 描画テスト
cd tests && uv run pytest -v
```

## オーサリングツールのローカルプレビュー

GitHub Pages は `main` の `docs/` を公開します。ローカル確認は次のとおりです。

```sh
python -m http.server 8000 --directory docs
# http://localhost:8000/ を開く
```

## ライセンス & リリース

[MIT](LICENSE)。リリース自動化は `.github/workflows/release.yml` と `tools/bump_version.py`
（他の Arduino ライブラリと共通）。バージョンは [library.properties](library.properties) にあります。
