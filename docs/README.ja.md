# オーサリングツール

> English: [README.md](README.md)

本番のブラウザオーサリングツール。静的 ES モジュールで**ビルド不要** — 任意の静的サーバーで
`index.html` を開く。このディレクトリ（`docs/`）が GitHub Pages の配信対象なので、ツール自体が
公開サイトになる。

```sh
python -m http.server 8000 --directory docs
# http://localhost:8000/
```

## 状況（MVP 基盤）

- **Design** モードを実装: 二軸（左ペイン=シーン × 上タブ=プロファイル）。各プロファイルが
  シーンごとに独立レイアウトを持つ（SPEC §8.9.6）。キャンバス描画（Rect / Text は datum / Image は
  プレースホルダ）、レイヤー一覧、インスペクタ、ドラッグ移動、矢印キーの移動/リサイズ（§8.14）、
  ズーム、未選択時の画面（シーン）プロパティ。シーン／パーツの追加・削除・リネーム可
  （パーツ／シーンの増減は全プロファイルのレイアウトを一括更新、§8.9.6）。
- **多言語化**（SPEC §14）: UI 文字列はすべて `src/i18n.js`（`t()` ＋ `data-i18n`）経由。en/ja・
  en フォールバック・言語切替を実装。初期言語はブラウザ設定に追従。
- **プロジェクト永続化**（`src/persist.js`、SPEC §9）: New / Open / Save ツールバー
  （`.lgfxsb.json`）＋ localStorage 自動保存・起動時復元。
- **コード生成**（`src/codegen.js`）: 「.h 出力」で `<Project>.h`（§11 ファサード＋記述子）を
  ダウンロード。`tests/codegen_roundtrip` で end-to-end 検証済み。
- Profiles / Assets / Export の*画面*（本格的な Export ビュー、アセット取り込み等）は未実装
  — ヘッダ出力は現状ツールバーのボタン。

## 構成

- `index.html` — アプリの外枠（モードレール＋3ペイン）
- `styles.css`
- `src/model.js` — プロジェクトデータモデル＋サンプル＋ヘルパ
- `src/store.js` — リアクティブストア（プロジェクト＋UI状態）＋ loadProject
- `src/i18n.js` — 翻訳（en/ja）＋ `t()` ＋静的マークアップ適用
- `src/persist.js` — `.lgfxsb.json` 保存/読込 ＋ localStorage 自動保存
- `src/codegen.js` — プロジェクトモデル → `<Project>.h`
- `src/design.js` — Design モード（描画＋操作）
- `src/main.js` — ブートストラップ

確定済みの使い捨てプローブは `../prototypes/` にある。本ディレクトリは旧・単一ファイルモックを
置き換えた本番再構築であり、GitHub Pages が配信する。
