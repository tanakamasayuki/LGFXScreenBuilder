# Tests

このディレクトリは、pytest と Arduino CLI を使ったプロジェクト固有のテストスイートです。

初期テストは最小構成です。

- `lang-ship:host` の LovyanGFX バックエンドでライブラリをビルドする
- 生成シーン相当のデータ構造を描画 API に渡す
- `LovyanGFX::createPng()` で host 側 PNG を保存する

`build_lovyangfx/` と `codegen_roundtrip/` は **direct** モードでビルド・描画する。
`build_buffered/` は `<LGFXVirtualCanvas.h>` を `<LGFXScreenBuilder.h>` より前に
include して **分割ダブルバッファ**経路（SPEC §10）を検証する（`isBuffered()` が true
であること、タイル合成＋overlay のフレームが非空であることをアサート）。このテストは
`LGFXVirtualCanvas` を Arduino ライブラリインデックスから取得する（`sketch.yaml` で版固定）。

両者は**透過シーン**（SPEC §8.16）も検証する。`Main` の上に `Dialog` シーンを表示し、
ダイアログが描かれたこと・その外接矩形の外側の全画素が下のフレームとバイト単位で一致すること
（不透明描画なら消えている）・バッファ構成では抜け色がパネルに届いていないことをアサートする。

ランタイムとジェネレータが育ったら、`LGFXVirtualCanvas` と同じ形でスナップショット比較やピクセル差分テストを追加します。

`build_fontgen/` は**埋め込みフォントの生成**（SPEC §8.7.7）を検証します。
`docs/fontgen.html` が生成したフォントヘッダをビルドし、実際の LovyanGFX 上で
指定どおりの行の高さになること、ASCII・`℃`・縦棒だけの字形（`Il1`）がいずれも
実際に描画されること、フレームが空でないことを確認します。デバイスを使わない側の
検証は `fontgen/`（node ＋ ヘッドレスブラウザ）にあります。詳細は
`build_fontgen/README.md` を参照。

`build_font_project_e2e/` は動的な経路を最後まで接続します。同じ CI 実行内で、
ブラウザエディタが LGFXFontToolJs でフォントを生成・プロジェクトへ埋め込み、出力した
プロジェクトヘッダを LovyanGFX host backend が `Screen` 経由で描画します。
ブラウザプレビューのインク、実描画のインク／メトリクス、補完文字・欠落文字、PNGを検証します。

`manual/` には**デフォルトスイートに含めない**生成器を置きます。コミット済みの成果物を
作るもので host ビルドを要するため、ディレクトリ走査の対象外（ファイル名に `test_`
接頭辞を付けない）とし、パスを明示したときだけ実行します。

`manual/font_introspect/` はプリセットフォントカタログを再生成します。`gen.py` が
ピン版 LovyanGFX（`../tools/fontcatalog/sketch.yaml`）を解決して全プリセットフォントの
C++ テーブルを出力し、ハーネスが host 上で各フォントを内省します（メトリクス＋
ASCII/CJK カバレッジ＋等幅フラグ＋実サイズのサンプル＋正確なフラッシュサイズ）。サンプルを
1 枚のアトラスに詰め、ブラウザが消費するカタログ（`../docs/src/font-catalog.js`・
`font-metrics.json`・`font-atlas.png`）を書き出します。フォントライブラリを bump したら
手動で実行します（SPEC §8.7.2）:

```sh
uv run pytest manual/font_introspect/font_introspect.py
```

## 生成ヘッダの再生成

コミット済みの `MyScreen.h` は、保存済みプロジェクトファイル（`*.lgfxsb.json`＝
オーサリングツールの保存形式）から **本番の** コード生成を通して生成する。これにより
出力フォーマットの変更は、各ヘッダを手で直す代わりに 1 コマンドで全体へ伝播する：

```sh
node tools/gen-fixtures.mjs --write    # その場で再生成
node tools/gen-fixtures.mjs --check    # 古いヘッダがあれば exit 1（CI / pre-commit ガード）
```

真実の元: `fixtures/sample.lgfxsb.json` が `examples/*` と sample ベースの build
テスト（`build_lovyangfx`・`build_buffered`）のコミット済み `MyScreen.h` を生成する
（ヘッダはフレームワーク非依存）。`.ino` は手書き/手調整で公開APIのみを呼ぶため生成
対象にしない。`tests/codegen_roundtrip/MyScreen.h` は
`tests/codegen_roundtrip/codegen_roundtrip.lgfxsb.json` から生成し、その `gen.mjs` は
本ツールへの薄いシム（pytest collection 時に実行。ヘッダは gitignore）。CI は pristine な
チェックアウトで `--check` を走らせ、コミット済みヘッダが codegen から static にずれるのを防ぐ。

プロジェクトファイル（`*.lgfxsb.json`）はシリアライザの正準形に保ち、別途チェックする
（SPEC §9.2）。差分が出る＝プロジェクトファイルのフォーマットが動いた、を意味する（codegen
変更からは独立）：

```sh
node tools/check-formats.mjs --write    # 正準形へ再シリアライズ
node tools/check-formats.mjs --check    # 非正準なファイルがあれば exit 1（CI ガード）
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
