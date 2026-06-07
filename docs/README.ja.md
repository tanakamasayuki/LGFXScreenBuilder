# オーサリングツール

> English: [README.md](README.md)

本番のブラウザオーサリングツール。静的 ES モジュールで**ビルド不要** — 任意の静的サーバーで
`index.html` を開く。このディレクトリ（`docs/`）が GitHub Pages の配信対象なので、ツール自体が
公開サイトになる。

```sh
python -m http.server 8000 --directory docs
# http://localhost:8000/
```

## 状況

- **Design** モードを実装: 二軸（左ペイン=シーン × 上タブ=プロファイル）。各プロファイルが
  シーンごとに独立レイアウトを持つ（SPEC §8.9.6）。キャンバス描画（Rect / Text は datum / Image は
  プレースホルダ）、レイヤー一覧、インスペクタ、ドラッグ移動、矢印キーの移動/リサイズ（§8.14）、
  ズーム、未選択時の画面（シーン）プロパティ。シーン／パーツの追加・削除・リネーム可
  （パーツ／シーンの増減は全プロファイルのレイアウトを一括更新、§8.9.6）。レイヤーパネルは
  ツリー表示（前面が上）＝兄弟内の並べ替え（↑/↓）、グループ化／解除、ドラッグ＆ドロップ
  での親変更（グループ行→入れ子／パーツ行→兄弟／空き→ルート）。いずれも絶対位置を保持、
  グループはカスケード削除（§8.3.1）。
- **Profiles** モード（SPEC §8.9）: 対象ライブラリバー、プロファイル一覧＋追加（解像度／
  カスタム、現レイアウトをクローン）、サイズ／回転／備考＋リネーム・削除、プロファイル順序変更、
  向き・サイズプレビュー、同サイズの既知ボード参考一覧。`Profile::Auto` は画面サイズと
  プロファイル順序で解決し、ボードは割り当てず参考情報として扱う。
- **Assets** モード（SPEC §8.4）: PNG/JPEG 取り込み（取り込み時に標準出力形式の RGB565 へ
  デコード）、サムネイル一覧・プレビュー・リネーム/削除（使用箇所表示）。Image パーツはアセットを
  参照し、Design キャンバスでプレビュー表示。codegen が RGB565 データ＋`AssetDesc` テーブルを
  出力し、ランタイムが `pushImage` で描画（host backend で end-to-end 検証済み）。
  画像スライス、スプライトシート、プロファイル別画像差し替えは現在仕様では扱わない。
- **Fonts** モード（SPEC §8.7）: プリセットカタログ（`src/font-catalog.js`、`tests/manual/font_introspect/gen.py`
  がピン版 LovyanGFX から生成）を**実描画 px 高さ（最重要）**・文字種（ラテン/数字/日本語/簡体字/
  繁体字/韓国語）・等幅か可変幅か・スタイル・ファミリ・利用状態（採用中のみ）・検索で絞り込み（候補が全部見えるよう開いた
  チップ群で表示）、少数をプロジェクトに採用し、各フォントをプロファイル毎に有効化（小画面は小フォントだけに）。
  タイルは **host 実描画のグリフ**を表示する — ラテンは等幅/可変幅が見分けられ（バッジでも明示）、
  CJK はその言語自身でプレビュー（日本語 / 简体中文 / 繁體中文 / 한국어）。`tests/manual/font_introspect`
  ハーネスが lang-ship host で全プリセットを内省（メトリクス＋ASCII/CJK カバレッジ＋等幅フラグ＋
  実サイズのサンプル）し、テストがサンプルを
  1 枚のアトラス（`src/font-atlas.png`＋`src/font-metrics.json`）に詰め、グリッドがフォント毎に
  切り出して表示する（未生成時は近似 CSS プレビューにフォールバック）。同ハーネスは各フォントの
  **正確なフラッシュサイズ**もリンク済み ELF から 1 回のビルドで算出（フォント毎の再ビルド不要）し、
  フォント毎＋プロファイル毎の合計として表示する＝プロファイル毎にフォントを有効化する理由。
  Text インスペクタにはプロファイル毎の font ドロップダウン（そのプロファイルで有効なフォントのみ）があり、
  Design キャンバスは選択フォントを「native 高さ × 倍率」＋近似ファミリでプレビューする。
  codegen は Text 毎に `setFont(&lgfx::v1::fonts::X)` を出力（各出力プロファイルで有効なフォントだけ＝
  プロファイル毎フラッシュ方針）、ランタイムが描画前に適用する。host backend で end-to-end 検証済み
  （`tests/codegen_roundtrip` がプリセット GFX フォントの Text を描画）。
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
  出力サブセット（enum/テーブルを選択分に限定）、描画モード選択（既定は LGFXVirtualCanvas
  による分割ダブルバッファ。直描画も選択可）、検証チェック、ファイル単位ダウンロード。
- **コード生成**（`src/codegen.js`）: `generateHeader(project, opts)`（§11 ファサード＋記述子、
  プロファイル絞り込み、テスト/画面キャプチャ用の `detail::kProfileInfo[]` / `detail::kSceneInfo[]`）
  ＋ `generateSketch(project, framework)`（サンプル `.ino`）。`tests/codegen_roundtrip` で
  end-to-end 検証済み。ツールバー「.h 出力」はワンクリックの近道として残置。
- **AI レイアウト I/O**（`src/ailayout.js` ＋ `src/model.js` の `reconcileAiLayout`/`applyAiLayout`、
  SPEC §8.15）: 「AI用JSONコピー」で現在の画面（全プロファイル）を自己完結・モデル忠実な**minified** JSON でコピー、
  「AI結果を貼付」で編集済みレイアウトを取り込み（同名シーンは上書き・無ければ追加、Undo 対応・適用前プレビュー付き）。
  AI に画面の作成・修正を頼むとき [AI_LAYOUT_IO.md](AI_LAYOUT_IO.md)（AI 向け IF 契約書、英語）と一緒に渡す。
  人間向けの参考訳は [AI_LAYOUT_IO.ja.md](AI_LAYOUT_IO.ja.md) に置くが、AI に渡す正本は英語版とする。

## 構成

- `index.html` — アプリの外枠（モードレール＋3ペイン）
- `styles.css`
- `src/model.js` — プロジェクトデータモデル＋サンプル＋変異/ヘルパ
- `src/boards.js` — ボードカタログ（M5GFX board_t）＋対象ライブラリ補助
- `src/profiles.js` — Profiles モード（プロファイル定義・順序変更＋参考ボード表示）
- `src/exporter.js` — Export モード（プレビュー＋出力サブセット＋ダウンロード）
- `src/assets.js` — Assets モード（PNG 取り込み/RGB565 デコード・プレビュー・使用箇所）
- `src/newproject.js` — 新規プロジェクトダイアログ（§9.1）
- `src/fontsview.js` — Fonts モード（カタログ閲覧/採用＋プロファイル毎有効化）
- `src/fonts.js` — プリセットフォントのカタログ照会＋プレビュー（host サンプル／近似）
- `src/font-catalog.js` — 生成済みプリセットカタログ（`../tests/manual/font_introspect/gen.py` が生成）
- `src/font-metrics.json` ＋ `src/font-atlas.png` — host 内省メトリクス＋サンプルアトラス
  （`../tests/manual/font_introspect` が生成）
- `src/store.js` — リアクティブストア（プロジェクト＋UI状態）＋ loadProject
- `src/i18n.js` — 翻訳（en/ja）＋ `t()` ＋静的マークアップ適用
- `src/persist.js` — `.lgfxsb.json` 保存/読込 ＋ localStorage 自動保存
- `src/codegen.js` — プロジェクトモデル → `<Project>.h`
- `src/design.js` — Design モード（描画＋操作）
- `src/main.js` — ブートストラップ

確定済みの使い捨てプローブは `../prototypes/` にある。本ディレクトリは旧・単一ファイルモックを
置き換えた本番再構築であり、GitHub Pages が配信する。
