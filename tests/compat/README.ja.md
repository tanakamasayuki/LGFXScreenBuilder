# compat — フォーマットバージョン凍結ゴールデン

> English: [README.md](README.md)

プロジェクトファイル形式の後方互換ゴールデン（SPEC §9.2 Layer 3）。各 `vN/`
ディレクトリは、**フォーマットバージョン N で凍結した**プロジェクトファイルと、それに対する
形式/出力/描画の変化を検出するための一式を保持します。

これらは `tools/gen-fixtures.mjs` が駆動するライブ fixture と違い、**自動再生成されません**。
差分は意図的なシグナルであって、ルーチンの更新ではありません。

## `v1/` の内容

`v1` は初回リリース時点の凍結です。リファレンスプロジェクトは v1 形式を意図的に網羅し、
そのいずれが変わってもゴールデンが検知します。

- 全パーツ種別 — Rect（塗り＋角丸アウトライン）・Line・Circle（塗り＋アウトライン）・Text・Image
- 採用プリセットフォント（`FreeSans12pt7b`、プロファイル毎に有効化し Text で使用）
- 画像アセット（RGB565 ＋ `AssetDesc` ＋ `pushImage`）
- 3 プロファイル（回転あり `CoreRot`=rotation 1、縦持ち含む）
- datum の多様性（`MC` → `Datum::MidCenter` を含む）とプロファイル毎デザインテキスト

| ファイル | 役割 |
| --- | --- |
| `CompatV1.lgfxsb.json` | 凍結 v1 プロジェクト（恒久的な入力契約） |
| `CompatV1.h` | v1 時点の codegen が生成したヘッダ（テキストゴールデン） |
| `v1.ino` + `sketch.yaml` | host キャプチャ。全プロファイル×シーンを PNG 化 |
| `render/*.png` | 凍結レンダリングゴールデン（`<profile>_<scene>.png`、回転反映の upright） |
| `test_compat_v1.py` | host でキャプチャをビルドし `render/` と画素比較 |

## 2 つのオラクル

1. **ヘッダテキストゴールデン** — `node tools/check-compat.mjs` が凍結プロジェクトを
   load → migrate → *現行* codegen で再生成し、凍結 `.h` と比較。軽量で Node ガード CI で実行。
2. **レンダリング画素ゴールデン** — `test_compat_v1.py` が `v1.ino` を pin した
   `lang-ship:host` LovyanGFX バックエンドでビルドし、各キャプチャを `render/` と画素比較。
   `.h` 一致は*画素*不変を保証しないため、これが最終オラクル。エンジンは `sketch.yaml` で固定。

## 差分が出たら

どのケースか判断します。

- **見た目のみ／互換性を保つ codegen 変更** → 再凍結。
  - ヘッダ: `node tools/check-compat.mjs --write`
  - 描画: 該当 `render/*.png` を削除して pytest 再実行（再 bootstrap される）。
- **プロジェクト形式の意味的変更** → `FORMAT_VERSION`（`docs/src/version.js`）を bump し、
  `migrate()` に `v(N)→v(N+1)` マイグレーションを追加。この `vN/` は参照として残し、
  新しい `v(N+1)/` スナップショットを凍結。
- **意図しない退行** → 原因を修正。

`tools/check-formats.mjs` はこのディレクトリをスキップします（凍結プロジェクトは過去形式に
固定されており、現行形式へ再シリアライズしてはならないため）。
