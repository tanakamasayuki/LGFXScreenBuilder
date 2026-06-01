# LGFXScreenBuilder 仕様書

## 1. 概要

LGFXScreenBuilder は、LovyanGFX および M5GFX を利用する Arduino 向けアプリケーションの画面データを、ブラウザ上のオーサリングツールで作成し、Arduino ライブラリとして利用できる形に出力するためのプロジェクトである。

本プロジェクトは GUI フレームワークそのものを提供するのではなく、画面レイアウト、アセット、シーン、アニメーション定義を設計・管理し、組み込み側では軽量な描画ランタイムとして扱える仕組みを提供する。

開発者は画面をコードで直接組み立てる代わりに、GitHub Pages 上で動作する HTML ベースのオーサリングツールで画面を設計し、生成されたデータを Arduino プロジェクトへ組み込む。

## 2. 目的

- LovyanGFX/M5GFX 向けの画面レイアウトを GUI で作成できるようにする。
- 画面デザインと Arduino 側のアプリケーションロジックを分離する。
- シーン、パーツ、アセット、アニメーションを一元管理する。
- 複数の M5Stack 系デバイスや LovyanGFX 対応デバイスに対応できる構造を提供する。
- 生成物を Arduino ライブラリから簡単に読み込み、値更新だけで画面表示を更新できるようにする。
- GitHub Pages だけでオーサリングツールを配布・実行できるようにする。

## 3. 非目標

- LVGL のような汎用 GUI フレームワークを実装しない。
- Arduino 側で複雑なウィジェットツリー管理 API を提供しない。
- Web サーバーやクラウド保存機能を必須にしない。
- 初期段階では高度なイベントシステム、レイアウトエンジン、双方向データバインディングを必須要件にしない。
- すべての表示デバイスを最初から網羅しない。

## 4. 想定ユーザー

主な対象ユーザーは以下とする。

- M5Stack 利用者
- LovyanGFX 利用者
- M5GFX 利用者
- Arduino 利用者
- ESP32 系の組み込み GUI 開発者

想定スキルは以下とする。

- Arduino の基本的な開発経験がある。
- LovyanGFX または M5GFX の基本的な描画 API を理解している。
- LVGL などの本格的な GUI フレームワーク経験は必須としない。

## 5. 利用シナリオ

1. ユーザーが GitHub Pages 上のオーサリングツールを開く。
2. 対象デバイスまたは画面サイズを選択する。
3. 画像、フォント、色などのアセットを登録する。
4. シーンを作成する。
5. シーン上に Text、Image、Gauge などのパーツを配置する。
6. 必要に応じて機種別の座標や表示設定を上書きする。
7. アニメーションや状態変更時の表示を設定する。
8. Arduino 用データをエクスポートする。
9. Arduino プロジェクトで LGFXScreenBuilder ライブラリを利用し、生成データを読み込む。
10. アプリケーションコードでは、生成されたシーン構造体に値を代入して描画する。

## 6. システム構成

LGFXScreenBuilder は以下の要素で構成する。

- Arduino ライブラリ
- Web オーサリングツール
- プロジェクトファイル形式
- Arduino 向けエクスポート形式
- サンプルスケッチ
- GitHub Pages 配信用ドキュメントおよびビルド成果物

### 6.1 Arduino ライブラリ

Arduino ライブラリは、生成された画面定義とアセットを LovyanGFX または M5GFX に描画する軽量ランタイムである。

ライブラリは以下を提供する。

- シーンの読み込み
- シーンの切り替え
- パーツの描画
- パーツ値の更新
- 表示/非表示の切り替え
- 基本アニメーションの再生
- LovyanGFX/M5GFX の差異を吸収する描画アダプタ

### 6.2 Web オーサリングツール

Web オーサリングツールは HTML/CSS/JavaScript で実装し、GitHub Pages 上で静的サイトとして動作する。

ツールは以下を満たす。

- ブラウザだけで実行できる。
- サーバー側処理を必須にしない。
- プロジェクトファイルをローカルに保存・読み込みできる。
- Arduino 向け生成物をダウンロードできる。
- プレビュー画面で複数デバイス表示を切り替えられる。

## 7. 対応描画バックエンド

### 7.1 LovyanGFX

LovyanGFX を直接利用する環境に対応する。

想定される利用形態は以下とする。

```cpp
LGFX gfx;
LGFXScreenBuilder screen;

screen.begin(&gfx);

screen.show(Scene::Boot{});

Scene::Main main;
main.header.battery = 82;
main.body.temperature = "24.5C";
screen.show(main);
```

### 7.2 M5GFX

M5GFX を利用する M5Stack 系デバイスに対応する。

想定される利用形態は以下とする。

```cpp
M5GFX display;
LGFXScreenBuilder screen;

display.begin();
screen.begin(&display);

screen.show(Scene::Boot{});

Scene::Main main;
main.header.battery = 82;
main.body.temperature = "24.5C";
screen.show(main);
```

### 7.3 バックエンド抽象化

Arduino ランタイム内部では、LovyanGFX と M5GFX の共通描画 API を前提にする。必要に応じて以下を抽象化する。

- 文字列描画
- 画像描画
- 矩形描画
- スプライト描画
- 色変換
- 画面サイズ取得
- クリッピング

## 8. 機能要件

### 8.1 シーン管理

複数の画面をシーンとして管理できる。

例:

- Boot
- Main
- Settings
- Status
- Info

シーンは一意の ID を持つ。Arduino 側では ID または生成された定数を使って切り替えられる。

### 8.2 パーツ管理

画面はパーツの集合として構成する。

初期対応候補は以下とする。

- Text
- Image
- Icon
- Button
- Gauge
- Graph
- Container
- Group

各パーツは以下を持つ。

- ID
- 種別
- 座標
- サイズ
- 表示状態
- 描画順
- スタイル
- 参照アセット
- 機種別オーバーライド

### 8.3 グループ管理

複数パーツをグループ化できる。

グループ単位で以下を操作できる。

- 移動
- 表示/非表示
- 描画順
- アニメーション

例:

```text
Header
  Logo
  Title
  StatusIcon
```

グループ化されたパーツの値は、Arduino 向け生成コードでもグループ階層に従って構造体フィールド化する。

例:

```cpp
Scene::Main main;
main.header.title = "Status";
main.header.battery = 82;
main.body.temperature = "24.5C";

screen.show(main);
```

同名フィールドであっても、自動的に同じ値として扱わない。同じ値を複数箇所へ反映したい場合は、ユーザーコード側で同じ値を代入する。

例:

```cpp
int battery = readBatteryLevel();

main.header.battery = battery;
main.footer.battery = battery;
```

### 8.4 アセット管理

画像、フォント、色、スプライトシートなどをプロジェクト内で管理できる。

画像アセットの例:

- dashboard.png
- logo.png
- icons.png
- loading.png

アセットには一意の ID を付与する。

画像アセットは、用途に応じて複数の保存形式と描画経路を選択できる設計にする。

想定するアセット種別:

- Flash 直描画 RAW
- オンメモリ高速描画
- 圧縮フォーマット

Flash 直描画 RAW は、RGB565 など描画先に近い形式へ事前変換し、PROGMEM やファイルシステム上のデータを `pushImage()` 相当で直接描画する。展開処理が軽く、通常の UI パーツや頻繁に表示する固定画像の標準形式とする。

オンメモリ高速描画は、起動時またはシーン開始時に RAM/PSRAM 上へ展開済み画像を保持し、繰り返し描画やアニメーションで高速に利用する。RAM 使用量が増えるため、対象アセットごとに明示的に選択する。

圧縮フォーマットは、PNG/JPEG などの圧縮データを保持し、必要なタイミングでデコードして描画する。Flash 使用量を抑えたい画像や、たまにしか表示しない画像に利用する。頻繁な再描画やタイル分割描画ではコストが高くなるため、標準形式にはしない。

初期実装では、Flash 直描画 RAW を最優先とし、オンメモリ高速描画と圧縮フォーマットは拡張可能な形式として扱う。

### 8.5 スライス機能

大きな画像から複数のアセット領域を切り出せる。

例:

```text
dashboard.png
  logo
  battery
  wifi
  loading_frame_01
  loading_frame_02
```

### 8.6 スプライトシート対応

フレームアニメーション用の画像をスプライトシートとして管理できる。

例:

```text
loading.png
  frame0
  frame1
  frame2
  frame3
```

### 8.7 フォント管理

以下を管理できる。

- フォント登録
- フォント選択
- サイズ
- 色
- 配置

初期段階では、ブラウザ上のフォントプレビューは近似表示とする。Web フォント、システムフォント、ユーザーが読み込んだ TTF/OTF など、ブラウザで扱えるフォントを利用して見た目を確認する。

Arduino 出力では、LovyanGFX/M5GFX で扱いやすいフォント参照方式を優先する。ブラウザプレビューと実機表示は完全一致しない可能性があるため、仕様上は近似プレビューとして扱う。

将来的に実機表示との一致度が必要になった場合は、使用文字を抽出して Glyph atlas またはビットマップフォントとして出力し、ブラウザプレビューと Arduino ランタイムで同じ glyph データを使う方式を検討する。

### 8.8 アニメーション

以下のアニメーションをサポート候補とする。

- フレームアニメーション
- 表示切り替え
- フェード
- 移動
- 拡大縮小

アニメーションは以下のタイミングで実行できる。

- シーン開始時
- シーン終了時
- 状態変更時
- Arduino 側 API からの明示実行時

### 8.9 複数機種対応

共通レイアウトを基本とし、必要な場合のみ機種別オーバーライドを定義できる。

オーバーライド対象は以下とする。

- 座標
- サイズ
- 表示/非表示
- アセット差し替え
- フォントサイズ

初期対応候補デバイスは以下とする。

- M5Stack Core2
- M5Stack CoreS3
- M5StickC Plus
- M5Cardputer
- 任意の LovyanGFX 画面サイズ

### 8.10 プレビュー切り替え

Web オーサリングツール上で対象デバイスを切り替え、レイアウトを確認できる。

プレビューでは以下を確認できる。

- 画面サイズ
- セーフエリア
- パーツ配置
- 表示/非表示
- アニメーションの簡易再生

### 8.11 名前空間管理

パーツは階層的な名前空間で管理する。Arduino 向け生成コードでは、文字列 ID を直接扱うのではなく、シーンごとの構造体フィールドとして利用できるようにする。

例:

```text
Main.header.title
Main.header.battery
Main.body.temperature
Main.body.loading
Settings.volume
Settings.brightness
```

名前空間により以下を実現する。

- 一意な識別子
- エディタ上の自動補完
- Arduino 側 API の可読性向上
- 大規模プロジェクトへの対応

Arduino 側の利用例:

```cpp
Scene::Main main;
main.header.title = "Main";
main.header.battery = 82;
main.body.temperature = "24.5C";
main.body.loadingVisible = false;

screen.show(main);
```

オーサリングツールおよび生成ランタイムは、変数の自動バインド機能を提供しない。値の共有、変換、反映タイミングはユーザーコード側の責務とする。

### 8.12 エディタ支援

Web オーサリングツールでは以下の補助機能を提供する。

- パーツ ID の自動補完
- 参照先アセットの選択補完
- シーン ID の選択補完
- 未使用アセットの検出
- ID 重複の検出
- デバイス別差分の表示

## 9. プロジェクトファイル

プロジェクトは単一ファイルとして保存できることを基本とする。

プロジェクトファイルには以下を含める。

- メタ情報
- 対象デバイス
- シーン定義
- パーツ定義
- グループ定義
- アニメーション定義
- アセット定義
- フォント定義
- 出力設定

ファイル形式は JSON を第一候補とする。必要に応じて画像などのバイナリアセットは別ファイルまたは Data URL として扱う。

## 10. エクスポート仕様

Arduino 向けエクスポートでは、以下を生成する。

- 画面定義データ
- アセットデータ
- シーン ID 定義
- シーンごとの型付きデータ構造体
- 低レベル API 用のパーツ ID 定義
- サンプル利用コード

画像アセットの出力方式は以下を選択可能にする。

- ヘッダファイル埋め込み
- PROGMEM 配置
- SPIFFS/LittleFS 向けファイル出力
- raw RGB565 データ
- PNG/JPEG 参照

初期段階では、Arduino IDE で扱いやすいヘッダファイル出力を優先する。

アセットごとに、保存先と描画形式を分けて指定できるようにする。

保存先の候補:

- Header/PROGMEM
- LittleFS/SPIFFS
- SD
- RAM/PSRAM キャッシュ

描画形式の候補:

- RAW RGB565
- RAW RGB888/RGBA8888
- Palette/Indexed
- PNG
- JPEG
- 将来追加の独自圧縮形式

MVP では `Header/PROGMEM + RAW RGB565` を標準出力とする。これにより、GitHub Pages 上のエクスポート結果を Arduino プロジェクトへ取り込むだけで、画像を含む UI をビルドできる。

## 11. Arduino API 仕様案

推奨 API は、生成されたシーン構造体を `screen.show()` に渡す形とする。

データを持たないシーンは、一時オブジェクトを渡して描画する。

```cpp
screen.show(Scene::Boot{});
```

データを持つシーンは、生成された構造体に値を代入して描画する。

```cpp
Scene::Main main;
main.header.title = "Main";
main.header.battery = 82;
main.body.temperature = "24.5C";
main.body.wifiVisible = true;

screen.show(main);
```

更新時も同じシーン構造体を渡す。

```cpp
main.header.battery = 79;
main.body.temperature = "25.1C";
screen.update(main);
```

生成されるシーン構造体の例:

```cpp
namespace Scene {

struct Boot {
  static constexpr SceneId id = SceneId::Boot;
};

struct Main {
  static constexpr SceneId id = SceneId::Main;

  struct Header {
    const char* title = "";
    int battery = 0;
  } header;

  struct Body {
    const char* temperature = "";
    bool wifiVisible = true;
  } body;
};

}
```

ライブラリの最小 API は以下を候補とする。

```cpp
class LGFXScreenBuilder {
public:
  void begin(LovyanGFX* gfx);

  template <typename TScene>
  void show(const TScene& scene);

  template <typename TScene>
  void update(const TScene& scene);

  void update();

  void play(const char* animationId);
};
```

M5GFX は LovyanGFX 派生または互換 API として扱える範囲で同一 API に統合する。

文字列 ID を使った `show("Main")` や `setText("Main.temperature", "...")` は、デバッグ用途または低レベル互換 API として扱い、通常利用の推奨 API にはしない。

## 12. ホストプレビューとスクリーンショット

実機確認に加えて、host 環境で描画結果を PNG として出力できる仕組みを用意する。

LovyanGFX の host 実行環境では `createPng()` を使って描画結果を PNG 化できるため、生成コードにはテスト用のスクリーンショット補助関数を含められる設計にする。

想定用途:

- 生成された UI の回帰テスト
- GitHub Actions 上での PNG スナップショット確認
- LovyanGFX/M5GFX 直接描画と LGFXVirtualCanvas 経由描画の比較
- フォント近似プレビューと実描画結果の差分確認

生成されるテスト補助 API の例:

```cpp
#if defined(LGFXSB_ENABLE_HOST_SCREENSHOT)
bool saveScreenshot(LovyanGFX& gfx, const char* path);

template <typename TScene>
bool renderScreenshot(LovyanGFX& gfx, const TScene& scene, const char* path);
#endif
```

`renderScreenshot()` は対象シーンを描画した後、全画面を PNG として保存する。通常の Arduino 実機向けビルドでは無効化し、host テストまたは開発用ビルドでのみ有効にする。

## 13. ディレクトリ構成案

```text
LGFXScreenBuilder/
  src/
    LGFXScreenBuilder.h
    LGFXScreenBuilder.cpp
    LGFXSB_Backend.h
    LGFXSB_Scene.h
    LGFXSB_Asset.h
  examples/
    Basic/
    M5GFX_Basic/
    MultiDevice/
  tools/
    authoring/
      index.html
      src/
      assets/
  docs/
    index.html
  SPEC.ja.md
  README.md
  library.properties
```

GitHub Pages は `docs/` または GitHub Actions で生成した静的成果物を公開する。

## 14. GitHub Pages 配布要件

オーサリングツールは GitHub Pages 上で動作する。

要件:

- 静的ファイルのみで配布できる。
- 最新の Chrome、Edge、Firefox、Safari のいずれかで動作する。
- プロジェクトファイルをローカルファイルとして読み書きできる。
- エクスポート結果を ZIP または複数ファイルとしてダウンロードできる。
- ネットワーク接続なしでも、ページ読み込み後の編集作業が継続できることが望ましい。

## 15. MVP 範囲

最初の実装では以下を MVP とする。

- Web オーサリングツールの基本画面
- 画面サイズプリセット選択
- シーン作成
- Text/Image/Group パーツ配置
- PNG 画像アセット登録
- JSON プロジェクト保存/読み込み
- Arduino ヘッダファイル出力
- LovyanGFX/M5GFX での静的シーン描画
- Text パーツの値更新
- 表示/非表示切り替え
- Basic サンプル

MVP では以下を後回しにする。

- 高度なアニメーションエディタ
- Graph/Gauge の詳細編集
- 実機プレビュー
- UIFlow 連携
- コンポーネント共有
- クラウド保存

## 16. 将来拡張

将来的に以下を検討する。

- Web シミュレータ
- 実機プレビュー
- UIFlow 連携
- データバインディング
- テーマ管理
- コンポーネントライブラリ共有
- GitHub Actions による自動 Pages デプロイ
- TypeScript 型定義を利用したエディタ補完
- 複数言語ドキュメント

## 17. 成功条件

初期リリースの成功条件は以下とする。

- GitHub Pages 上でオーサリングツールを開ける。
- 画面を作成してプロジェクトファイルとして保存できる。
- Arduino 用データをエクスポートできる。
- LovyanGFX と M5GFX の両方でサンプルがビルドできる。
- Arduino 側からパーツ ID を指定してテキスト更新と表示切り替えができる。
- 既存の `drawString()` や `drawPng()` を直接並べるよりも、複数画面の管理が明確になる。
