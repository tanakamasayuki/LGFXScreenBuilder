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
  ズーム、未選択時の画面（シーン）プロパティ。
- Profiles / Assets / Export モード、プロジェクト保存/読込（`.lgfxsb.json`）、コード生成
  （`<Project>.h`）は未接続。

## 構成

- `index.html` — アプリの外枠（モードレール＋3ペイン）
- `styles.css`
- `src/model.js` — プロジェクトデータモデル＋サンプル＋ヘルパ
- `src/store.js` — リアクティブストア（プロジェクト＋エディタ UI 状態）
- `src/design.js` — Design モード（描画＋操作）
- `src/main.js` — ブートストラップ

確定済みの使い捨てプローブは `../prototypes/` にある。本ディレクトリは旧・単一ファイルモックを
置き換えた本番再構築であり、GitHub Pages が配信する。
