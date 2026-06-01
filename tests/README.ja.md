# Tests

このディレクトリは、pytest と Arduino CLI を使ったプロジェクト固有のテストスイートです。

初期テストは最小構成です。

- `lang-ship:host` の LovyanGFX バックエンドでライブラリをビルドする
- 生成シーン相当のデータ構造を描画 API に渡す
- `LovyanGFX::createPng()` で host 側 PNG を保存する

ランタイムとジェネレータが育ったら、`LGFXVirtualCanvas` と同じ形でスナップショット比較やピクセル差分テストを追加します。

## 実行

```sh
uv run pytest -v
```
