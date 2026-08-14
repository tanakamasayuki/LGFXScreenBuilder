# examples

> English: [README.md](README.md)

どの例も同じ `MyScreen.h` を同梱している。
[`fixtures/sample.lgfxsb.json`](../fixtures/sample.lgfxsb.json) から
`node tools/gen-fixtures.mjs` で生成されるので、常に現行の codegen と一致する。
違うのは**スケッチ**のほうで、1 つの例が 1 つの論点だけを示す。

## 読む順番

| # | 例 | ターゲット | 内容 |
| --- | --- | --- | --- |
| 1 | [BasicM5Unified](BasicM5Unified/) | M5Unified | 動く最小構成。`begin()` ＋ `show()` だけ。**直接描画**（下の注意を参照）。 |
| 1' | [BasicLovyanGFX](BasicLovyanGFX/) | LovyanGFX | 同じ内容を素の LovyanGFX で（`LGFX_AUTODETECT` ＋ `display.init()`）。 |
| 2 | [ProfilesM5Unified](ProfilesM5Unified/) | M5Unified | **1 バイナリで複数機種。** `Profile::Auto` と、ボタン A でのプロファイル強制切替。 |
| 3 | [OverlayM5Unified](OverlayM5Unified/) | M5Unified | **動的描画**。静的パーツと同じバッファに電池バーを合成する。 |
| 4 | [DialogM5Unified](DialogM5Unified/) | M5Unified | **透過シーン**。動作中の画面を描き直さずにダイアログを重ねる。 |
| 5 | [MemoryTuningM5Unified](MemoryTuningM5Unified/) | M5Unified | **RAM と分割数**。`Screen` を継承してタイル予算に触り、分割数が動くのを見る。 |
| — | [ExportedSample](ExportedSample/) | M5Unified | **Export 出力そのまま**（ヘッダ＋スケッチ）。シーンツアー、A ボタンで送り。 |

`ExportedSample` はオーサリングツールが実際に吐くものなので、学習用というより
「生成物の形」のリファレンス。他のスケッチは手書きで、安定した公開 API
（`begin` / `show` / `setProfile` / `setOverlay`）しか呼んでいない。

## つまずきやすい 2 点

**直接描画かバッファ描画かは、設定ではなく include で決まる。**
生成ヘッダより**前**に `<LGFXVirtualCanvas.h>` を include すればタイル分割
ダブルバッファ、しなければ直接描画になり、繰り返し更新でちらつく。順序を間違えても
エラーは出ず、黙って直接描画になる。実行時に確認できる:

```cpp
Serial.printf("buffered: %d\n", (int)screen.isBuffered());
```

`Basic*` の 2 例は最小構成を保つために意図的に直接描画のまま。残る 3 例は
`#if __has_include` ガード付きで LGFXVirtualCanvas を include しているので、
未インストールでもビルドは通る。

**overlay コールバックはタイルごとに 1 回走る。** バッファ描画では
`setOverlay()` の関数が 1 フレームのタイル数だけ呼ばれるので、冪等でなければ
ならない（状態は読むだけ。進めない）。`OverlayM5Unified` がその型を示している。

どちらも [docs/BEGINNERS_GUIDE.ja.md](../docs/BEGINNERS_GUIDE.ja.md) で
原理から説明している。

## ビルド

各ディレクトリが自己完結した `sketch.yaml` を持ち、プラットフォームとライブラリを
固定するので、ボードマネージャの設定は要らない:

```sh
arduino-cli compile --profile esp32        examples/OverlayM5Unified   # 実機
arduino-cli compile --profile display_core examples/OverlayM5Unified   # host（SDL）バックエンド
```

CI は全例を両プロファイルでコンパイルする。`display_*` は
[lang-ship host core](https://tanakamasayuki.github.io/lang-ship-arduino-core/) 上で動き、
[画面キャプチャギャラリー](https://tanakamasayuki.github.io/LGFXScreenBuilderScreenshotTest/)
もこれで生成している。

## 自分のプロジェクトにする

これらはサンプルプロジェクトに紐付いている。自分の画面を使うには、
<https://tanakamasayuki.github.io/LGFXScreenBuilder/> で設計して `MyScreen.h` を
`.ino` の隣に出力し、シーン名とフィールド名を直す。生成 API は**あなたの**シーンと
プロファイルしか知らないので、直すべき箇所はコンパイラが全部指してくれる。
手順は [docs/AUTHORING_TUTORIAL.ja.md](../docs/AUTHORING_TUTORIAL.ja.md) を参照。
