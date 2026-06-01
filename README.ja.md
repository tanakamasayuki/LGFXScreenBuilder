# LGFXScreenBuilder

> English: [README.md](README.md)

LGFXScreenBuilder は、LovyanGFX / M5GFX 向けの Arduino UI オーサリングツールおよび生成ランタイムのプロジェクトです。

ブラウザ上のオーサリングツールで画面を設計し、Arduino 用データを出力し、型付き API から描画することを目標にしています。

現在の状態: 仕様策定と雛形作成の初期段階です。

## オーサリングツール

GitHub Pages:

```text
https://tanakamasayuki.github.io/LGFXScreenBuilder/
```

ローカルプレビュー:

```sh
python -m http.server 8000 --directory docs
```

確認 URL:

```text
http://localhost:8000/
```

GitHub Pages は `main` ブランチの `docs/` ディレクトリを公開します。GitHub Pages のプロジェクトページ配下でも動作するように、`./app.js` や `./styles.css` のような相対パスを使います。

## Arduino API 方針

通常のユーザーコードでは文字列 ID を避け、生成された型付き API を使います。

```cpp
screen.show(Scene::Boot{});

Scene::Main main;
main.header.title = "Main";
main.header.battery = 82;
main.body.temperature = "24.5C";

screen.show(main);
```

現在の仕様は [SPEC.ja.md](SPEC.ja.md) を参照してください。日本語版が固まった後に英語版 `SPEC.md` を追加します。

## テスト

初期テスト雛形では、pytest、Arduino CLI、`lang-ship:host` の LovyanGFX バックエンドを使います。

```sh
cd tests
uv run pytest -v
```

## リリース

リリース自動化は以下で提供します。

```text
.github/workflows/release.yml
tools/bump_version.py
```

リリース workflow は共通の Arduino ライブラリリリースツールキットからコピーしたものです。変更が必要な場合は、原則として共通ツールキット側を更新し、他ライブラリにも反映します。
