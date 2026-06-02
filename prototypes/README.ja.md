# prototypes — 使い捨てUXプローブ

操作感の検証専用。**1インタラクション＝1枚のHTML**で、共有フレームワークなし・最小・**捨てる前提**。
本番（`tools/authoring/`）にはコードを移さない。公開物の `docs/` とは分離する。

ローカル確認:

```sh
python -m http.server 8001 --directory prototypes
# http://localhost:8001/            ← index.html（リンク集）
# http://localhost:8001/<name>.html
```

**寿命:** 本番（`tools/authoring/`）が各画面をカバーしたら、その画面のプローブから順に削除する（一斉削除ではなく画面単位で間引く）。

| ファイル | 検証対象 |
|---|---|
| profiles.html | Profiles 画面：プロファイル一覧/追加・向き/サイズ表示・ボード割当・default |
| design.html | Design：左ペイン=シーン／上タブ=プロファイルの二軸。各プロファイルがシーンごとに独立レイアウトを持つ（上書き概念なし。プロファイル追加は Profiles 画面） |
| assets.html | Assets 全体フロー：画像 Import（実ファイル可）→ 一覧 → 選択 → インラインでスライス（スライスは post-MVP） |
| export.html | Export：生成物（ui_generated.h / ui_assets.h / Basic.ino）プレビュー・出力設定・チェック |
