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
  （パーツ／シーンの増減は全プロファイルのレイアウトを一括更新、§8.9.6）。レイヤーパネルは
  ツリー表示（前面が上）＝兄弟内の並べ替え（↑/↓）、グループ化／解除、ドラッグ＆ドロップ
  での親変更（グループ行→入れ子／パーツ行→兄弟／空き→ルート）。いずれも絶対位置を保持、
  グループはカスケード削除（§8.3.1）。
- **Profiles** モード（SPEC §8.9）: 対象ライブラリバー、プロファイル一覧＋追加（解像度／
  カスタム、現レイアウトをクローン）、サイズ／回転／備考＋リネーム・削除、ボード割り当て
  （クリックでトグル、自動判定は1ボード=1プロファイル）、向き・サイズプレビュー、検証バナー
  （寸法不一致・LovyanGFX で自動判定不可）。フォールバックは Export 時に選択。
  ボード割り当てはプロファイル別 `board_t` テーブルとして出力され、`Profile::Auto` が
  実機 `getBoard()` で解決する（対象ライブラリの `board_t` に無いボードは省略、§8.9.5）。
- **Assets** モード（SPEC §8.4）: PNG/JPEG 取り込み（取り込み時に MVP 出力形式の RGB565 へ
  デコード）、サムネイル一覧・プレビュー・リネーム/削除（使用箇所表示）。Image パーツはアセットを
  参照し、Design キャンバスでプレビュー表示。codegen が RGB565 データ＋`AssetDesc` テーブルを
  出力し、ランタイムが `pushImage` で描画（host backend で end-to-end 検証済み）。
  スライス・スプライトシート・フォントは post-MVP。
- **多言語化**（SPEC §14）: UI 文字列はすべて `src/i18n.js`（`t()` ＋ `data-i18n`）経由。en/ja・
  en フォールバック・言語切替を実装。初期言語はブラウザ設定に追従。
- **Undo / Redo**: スナップショット式のプロジェクト履歴（ツールバー ↶/↷、Ctrl/⌘+Z、
  Ctrl/⌘+Shift+Z）。離散操作は `store.mutate` で checkpoint、ドラッグ・矢印・インスペクタ編集は
  ジェスチャ単位で 1 回 checkpoint。UI のみの変更（選択・ズーム・モード）は履歴に含めない。
- **プロジェクト永続化**（`src/persist.js`、SPEC §9）: Open / Save ツールバー
  （`.lgfxsb.json`）＋ localStorage 自動保存・起動時復元。**New** はダイアログ
  （`src/newproject.js`、§9.1）でプロジェクト名・対象ライブラリ・最初のプロファイル
  （デバイス/サイズ/回転）・最初のシーンを指定。
- **Export** モード（SPEC §10）: ファイル一覧（`<Project>.h` / `<Project>_example.ino`）＋
  コードプレビュー、対象フレームワーク選択（M5Unified / M5GFX / LovyanGFX）、プロファイル別
  出力サブセット＋fallback 選択（enum/テーブルを選択分に限定、fallback は `defaultProfile` に記憶）、
  検証チェック、ファイル単位ダウンロード。アセット出力・zip パッケージは post-MVP。
- **コード生成**（`src/codegen.js`）: `generateHeader(project, opts)`（§11 ファサード＋記述子、
  プロファイル絞り込み/fallback 任意）＋ `generateSketch(project, framework)`（サンプル `.ino`）。
  `tests/codegen_roundtrip` で end-to-end 検証済み。ツールバー「.h 出力」はワンクリックの近道として残置。

## 構成

- `index.html` — アプリの外枠（モードレール＋3ペイン）
- `styles.css`
- `src/model.js` — プロジェクトデータモデル＋サンプル＋変異/ヘルパ
- `src/boards.js` — ボードカタログ（M5GFX board_t）＋対象ライブラリ補助
- `src/profiles.js` — Profiles モード（プロファイル定義＋ボード割り当て）
- `src/exporter.js` — Export モード（プレビュー＋出力サブセット/fallback＋ダウンロード）
- `src/assets.js` — Assets モード（PNG 取り込み/RGB565 デコード・プレビュー・使用箇所）
- `src/newproject.js` — 新規プロジェクトダイアログ（§9.1）
- `src/store.js` — リアクティブストア（プロジェクト＋UI状態）＋ loadProject
- `src/i18n.js` — 翻訳（en/ja）＋ `t()` ＋静的マークアップ適用
- `src/persist.js` — `.lgfxsb.json` 保存/読込 ＋ localStorage 自動保存
- `src/codegen.js` — プロジェクトモデル → `<Project>.h`
- `src/design.js` — Design モード（描画＋操作）
- `src/main.js` — ブートストラップ

確定済みの使い捨てプローブは `../prototypes/` にある。本ディレクトリは旧・単一ファイルモックを
置き換えた本番再構築であり、GitHub Pages が配信する。
