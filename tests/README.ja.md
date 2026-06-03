# Tests

このディレクトリは、pytest と Arduino CLI を使ったプロジェクト固有のテストスイートです。

初期テストは最小構成です。

- `lang-ship:host` の LovyanGFX バックエンドでライブラリをビルドする
- 生成シーン相当のデータ構造を描画 API に渡す
- `LovyanGFX::createPng()` で host 側 PNG を保存する

ランタイムとジェネレータが育ったら、`LGFXVirtualCanvas` と同じ形でスナップショット比較やピクセル差分テストを追加します。

`manual/` には**デフォルトスイートに含めない**生成器を置きます。コミット済みの成果物を
作るもので host ビルドを要するため、ディレクトリ走査の対象外（ファイル名に `test_`
接頭辞を付けない）とし、パスを明示したときだけ実行します。

`manual/font_introspect/` はプリセットフォントカタログを再生成します。`gen.py` が
ピン版 LovyanGFX（`../tools/fontgen/sketch.yaml`）を解決して全プリセットフォントの
C++ テーブルを出力し、ハーネスが host 上で各フォントを内省します（メトリクス＋
ASCII/CJK カバレッジ＋等幅フラグ＋実サイズのサンプル＋正確なフラッシュサイズ）。サンプルを
1 枚のアトラスに詰め、ブラウザが消費するカタログ（`../docs/src/font-catalog.js`・
`font-metrics.json`・`font-atlas.png`）を書き出します。フォントライブラリを bump したら
手動で実行します（SPEC §8.7.2）:

```sh
uv run pytest manual/font_introspect/font_introspect.py
```

## 必要なもの

- `uv` ＋ Arduino CLI（`lang-ship:host` プラットフォームは自動取得）。
- **Node.js** — `codegen_roundtrip` テストはビルド前に、オーサリングツールの
  コード生成（`docs/src/`）を `node` で実行して `MyScreen.h` を再生成するため、
  `node` が `PATH` 上に必要。

## 実行

```sh
uv run pytest -v
```
