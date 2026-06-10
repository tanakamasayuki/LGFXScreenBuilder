# LGFXScreenBuilder — AI Layout Interface 日本語参考訳

この文書は [AI_LAYOUT_IO.md](AI_LAYOUT_IO.md) の日本語参考訳です。人間が仕様内容を確認するための文書であり、AI に渡す正本は英語版 `AI_LAYOUT_IO.md` です。JSON の `spec` フィールドも英語版 URL のままにします。

この文書は、[LGFXScreenBuilder](https://github.com/tanakamasayuki/LGFXScreenBuilder) の画面レイアウトを設計・編集する **AI アシスタント向け契約書**です。LGFXScreenBuilder は、組み込みディスプレイ向け UI 画面（LovyanGFX / M5GFX / M5Unified）を作成するツールです。

AI には以下を渡します。

1. **この仕様書**（形式とルール）。
2. 1 画面分の **layout JSON**（ツールから出力、または手書き）。通常は **minified**（1 行）です。下の整形例は読みやすさのためです。
3. **依頼内容**（「時計画面を作って」「バッテリーを右上へ移動して」など）。

AI は回答として、**この形式どおりの layout JSON**を出力します。JSON として有効にし、コメントや末尾カンマを含めません。パーツの追加・削除・リネーム依頼でない限り、part ID は保持します。

---

## 1. 1つのレイアウトが表すもの

1 つのレイアウトは、**全デバイスプロファイルにまたがる 1 画面（scene）**を表します。*profile* は対象デバイスサイズです（例: 320×240 ボードと 135×240 ボード）。横長画面に合う配置が縦長画面に合うとは限らないため、同じ画面を profile ごとに独立して配置します。

```jsonc
{
  "format": "lgfxsb-layout",
  "version": 1,
  "spec": "https://tanakamasayuki.github.io/LGFXScreenBuilder/AI_LAYOUT_IO.md",
  "scene": "Main",            // 画面名（C 識別子）
  "desc": "",                 // 画面の自由記述メモ
  "background": "#000000",    // 全画面背景色（文脈情報。通常はそのまま）
  "fonts": [                  // このレイアウトで利用可能な採用済みフォント（文脈情報。編集しない）
    { "name": "Font4", "family": "Font4", "content": "latin", "size": null, "unit": null, "height": null },
    { "name": "efontJA_16", "family": "efontJA", "content": "ja", "size": 16, "unit": "px", "height": 16 }
  ],
  "profiles": [
    { "id": "Core", "w": 320, "h": 240, "rot": 0, "fonts": [ "Font4", "efontJA_16" ], "parts": [ /* … */ ] },
    { "id": "Stick", "w": 135, "h": 240, "rot": 0, "fonts": [ "Font4" ], "parts": [ /* … */ ] }
  ]
}
```

- `spec` — この文書の URL。AI がルールを再取得できるようにするためのもの。変更せず返します。
- `w` / `h` — `rot` 適用後の profile の画面サイズ（px）。
- `rot` — 回転 0–3。`0` はパネルのネイティブ向きです。`w`/`h` はすでにその向きを反映しています。
- トップレベル `fonts` — プロジェクトで採用済みのプリセットフォント。Text の `font` 選択のための文脈情報です。変更せず返します。
- profile の `fonts` — その profile で有効かつ選択可能なフォント名。Text は `null` または同じ profile の `fonts` 配列にあるフォント名だけを使えます。

---

## 2. Parts

各 profile は `parts` 配列を持ちます。描画順は **配列順で奥から手前**です（先頭が背面）。

**重要な不変条件:** `(id, type)` の集合は **すべての profile で同一**でなければなりません。それ以外の値、つまり位置、サイズ（`w`/`h`）、`color`、`visible`、Text の `datum`/`size`/`text`/`font` は、画面に合わせて profile ごとに変えて構いません。パーツを追加・削除・リネームする場合は、**すべての profile**で行います。profile 間で同じ part の `type` を変えてはいけません。

すべての座標は **整数 px、左上原点 (0,0)、スケーリングなし**です。`w`×`h` の外に描いたものはクリップされます。パーツは画面内に収めます。

### 共通フィールド

| field | 意味 |
|-------|------|
| `id` | scene 内で一意な C 識別子（`[A-Za-z_]\w*`）。profile 間で安定していること。 |
| `type` | `"Rect"`、`"Line"`、`"Circle"`、`"Text"`、`"Image"` のいずれか。 |
| `visible` | `true` / `false`。非表示 part は保持されるが描画されない。 |

### 値の型

| field | JSON type | notes |
|-------|-----------|-------|
| `w`, `h`, `x`, `y`, `x2`, `y2`, `r` | **integer** | px。小数座標や小数サイズは不可。`x2`/`y2` は Line の終点。`r` は Rect の角丸半径または Circle の半径。 |
| `rot` | **integer** | 0、1、2、3。 |
| `size` (Text) | **number** | 拡大率。**小数可**（例: `1`, `1.5`, `3.5`）。 |
| `height` (font) | **integer or null** | Text `size: 1` のおおよその描画高さ（px）。 |
| `color` | **string** | `"#rrggbb"`（6 桁 hex、小文字）。 |
| `visible`, `fill` | **boolean** | `true` / `false`。`fill` は Rect と Circle で使う。 |
| `id`, `type`, `datum`, `text`, `family`, `content` | **string** | — |
| `asset`, `font`, `unit` | **string or null** | asset 名 / font 名 / 単位、または `null`。 |
| `scene`, `desc`, `spec`, `format` | **string** | — |
| `version` | **integer** | 現在は `1`。 |

### フォント文脈

トップレベル `fonts` は、ツールが使える採用済みプリセットフォントの一覧です。各エントリは文脈情報であり、編集対象ではありません。

| field | 意味 |
|-------|------|
| `name` | Text `font` に入れる LovyanGFX / M5GFX プリセットフォントの正確なシンボル名。 |
| `family` | フォントの family/group。視覚的に一貫したフォントを選ぶための参考。 |
| `content` | 対応文字カテゴリ: `"digits"`, `"latin"`, `"ja"`, `"cn"`, `"tw"`, `"ko"`。CJK フォントは ASCII も持ちます。 |
| `size` / `unit` | カタログ上の公称サイズ（分かる場合）。 |
| `height` | Text `size: 1` のおおよその描画高さ（px、分かる場合）。 |

`content` を使い、数字専用フォントを単語に使ったり、Latin 専用フォントを日本語に使ったりしないようにします。profile レベルの `fonts` が、その profile で実際に選択可能な一覧です。フォントメタデータを追加・削除・編集してはいけません。フォントカタログはツールが管理します。

`family` は LovyanGFX / M5GFX のプリセット group であり、編集可能な CSS font family ではありません。ブラウザプレビューは以下のように近似します。既存フォントから選ぶときの視覚ヒントとしてだけ使います。

| family | visual hint |
|--------|-------------|
| `FreeSans` | sans-serif。Arimo / Liberation Sans / Arial に近い。 |
| `FreeSerif` | serif。Tinos / Liberation Serif / Georgia に近い。 |
| `FreeMono` | 等幅。Cousine / Liberation Mono に近い。 |
| `DejaVu` | 中庸な sans-serif。 |
| `Roboto_Thin` | とても細い sans-serif。 |
| `Orbitron_Light` | 幾何学的なデジタル表示風。 |
| `Satisfy` | 筆記体。 |
| `Yellowtail` | 筆記体。 |
| `lgfxJapanGothic`, `lgfxJapanGothicP`, `efontJA` | 日本語ゴシック / sans-serif。 |
| `lgfxJapanMincho`, `lgfxJapanMinchoP` | 日本語明朝 / serif。 |
| `efontCN` | 簡体字中国語 sans-serif。 |
| `efontTW` | 繁体字中国語 sans-serif。 |
| `efontKR` | 韓国語 sans-serif。 |

一部の内蔵ビットマップフォントは、フォント `name` 自体が family です。これらは特殊な視覚ケースとして扱います。

| font name | visual hint |
|-----------|-------------|
| `Font0` | 小さな 6x8 GLCD 風 bitmap sans。極小 UI ラベル向き。 |
| `Font2` | やや大きい比例 bitmap sans。組み込み LCD UI 風。 |
| `Font4` | 大きい比例 bitmap sans。組み込み LCD UI 風。 |
| `Font6` | 丸みのある LCD 風の数字/時刻フォント。数字と時刻向け。 |
| `Font7` | 7 セグ風の数字/時刻フォント。数字と時刻向け。 |
| `Font8` | 非常に大きい Arial 風の数字フォント。大きな数値表示向け。 |
| `Font8x8C64` | 8x8 Commodore 64 風 bitmap フォント。 |
| `AsciiFont8x16` | 固定 8x16 ASCII bitmap。VGA/DOS 端末風。 |
| `AsciiFont24x48` | 固定 24x48 ASCII bitmap。拡大された端末風。 |
| `TomThumb` | 極小 bitmap serif/display フォント。 |

### 型ごとのフィールド

**Rect** — 矩形または角丸矩形。
`x, y` は左上 · `w, h` はサイズ · `r` は角丸半径 · `fill` は描画モード · `color` は `"#rrggbb"`。
`r: 0` は通常の角、`r > 0` は角丸です。`fill: true` は `fillRect` / `fillRoundRect`、`fill: false` は `drawRect` / `drawRoundRect` の枠だけ描画です。枠線の太さは LovyanGFX/M5GFX 既定の 1px とし、stroke-width 系フィールドは追加しません。

**Line** — 1 px の直線。
`x, y` は始点 · `x2, y2` は終点 · `color` は `"#rrggbb"` です。
LovyanGFX/M5GFX の `drawLine(x, y, x2, y2, color)` に対応します。stroke-width、dash、arrow、cap-style 系フィールドは追加しません。

**Circle** — 円。
`x, y` は中心点 · `r` は半径 · `fill` は描画モード · `color` は `"#rrggbb"` です。
`fill: true` は `fillCircle`、`fill: false` は `drawCircle` に対応します。

**Text** — 1 行テキスト。**Text には幅/高さの box がありません。** 折り返し、クリップ、省略、box 内アラインメントはありません。収まる長さにするか、profile ごとに `text`/`size` を変えます。
`x, y` は **アンカーポイント**です。`datum` はテキストのどの点をアンカーに置くかを表します。
`size` は **拡大率**です（描画高さ ≈ フォント基準高さ × `size`）。
`color` は `"#rrggbb"`、`text` は表示文字列です。
`font` はフォント名（string）または既定フォントを表す `null` です。**依頼で変更を求められない限り `font` はそのまま保持**します。使えるのは同じ profile の `fonts` 配列にあるフォント名だけです。フォント名を捏造してはいけません。また `fontFamily`/`bold`/`italic` フィールドを追加してはいけません。
フォントは埋め込み bitmap/preset フォントです。`size` は描画 bitmap を拡大するため、整数または見た目のよい倍率（`1`, `2`, `3`, 場合により `1.5`）の方がきれいに見えます。任意の小数倍率は、bitmap の線を不均一にしたり、ぼやけさせたりする場合があります。扱いにくい倍率を使う前に、適切なネイティブ `height` を持つ利用可能フォントを選ぶことを優先します。
`datum` は、縦 `T`/`M`/`B` × 横 `L`/`C`/`R` の組み合わせです。
`TL TC TR ML MC MR BL BC BR` のいずれかです。例: `TR` はテキストの右上を `(x,y)` に置く右寄せ、`MC` は `(x,y)` を中心にします。

**Image** — プロジェクトの asset ライブラリにある bitmap。
`x, y` は左上 · `w, h` はサイズ · `asset` は **既存 asset 名**（string）または `null`。
画像データの作成、画像スライス、画像内領域の参照はできません。ユーザーが既存 asset への切り替えを明示しない限り、`asset` はそのまま保持します。通常のレイアウト編集では `x` / `y` / `w` / `h` / `visible` だけを調整します。

---

## 3. 例

サンプルプロジェクトの `Main` 画面を 3 profile で表した例です。

```json
{
  "format": "lgfxsb-layout",
  "version": 1,
  "spec": "https://tanakamasayuki.github.io/LGFXScreenBuilder/AI_LAYOUT_IO.md",
  "scene": "Main",
  "desc": "",
  "background": "#000000",
  "fonts": [
    { "name": "Font4", "family": "Font4", "content": "latin", "size": null, "unit": null, "height": null },
    { "name": "efontJA_16", "family": "efontJA", "content": "ja", "size": 16, "unit": "px", "height": 16 }
  ],
  "profiles": [
    {
      "id": "Core", "w": 320, "h": 240, "rot": 0,
      "fonts": [ "Font4", "efontJA_16" ],
      "parts": [
        { "id": "headerBand", "type": "Rect", "x": 0, "y": 0, "w": 320, "h": 40, "r": 0, "fill": true, "color": "#1e2a30", "visible": true },
        { "id": "title", "type": "Text", "x": 12, "y": 10, "datum": "TL", "size": 2, "color": "#ffffff", "text": "Main", "font": null, "visible": true },
        { "id": "battery", "type": "Text", "x": 310, "y": 12, "datum": "TR", "size": 1.5, "color": "#9ce5ac", "text": "82%", "font": null, "visible": true },
        { "id": "temp", "type": "Text", "x": 18, "y": 70, "datum": "TL", "size": 4, "color": "#ffffff", "text": "24.5C", "font": null, "visible": true },
        { "id": "panel", "type": "Rect", "x": 18, "y": 150, "w": 284, "h": 54, "r": 8, "fill": true, "color": "#172126", "visible": true }
      ]
    },
    {
      "id": "Stick", "w": 135, "h": 240, "rot": 0,
      "fonts": [ "Font4" ],
      "parts": [
        { "id": "headerBand", "type": "Rect", "x": 0, "y": 0, "w": 135, "h": 30, "r": 0, "fill": true, "color": "#1e2a30", "visible": true },
        { "id": "title", "type": "Text", "x": 8, "y": 7, "datum": "TL", "size": 1.5, "color": "#ffffff", "text": "Main", "font": null, "visible": true },
        { "id": "battery", "type": "Text", "x": 8, "y": 180, "datum": "TL", "size": 1.5, "color": "#9ce5ac", "text": "82%", "font": null, "visible": true },
        { "id": "temp", "type": "Text", "x": 10, "y": 60, "datum": "TL", "size": 3.5, "color": "#ffffff", "text": "24.5", "font": null, "visible": true },
        { "id": "panel", "type": "Rect", "x": 10, "y": 110, "w": 115, "h": 60, "r": 6, "fill": true, "color": "#172126", "visible": true }
      ]
    },
    {
      "id": "Cardputer", "w": 240, "h": 135, "rot": 0,
      "fonts": [ "Font4" ],
      "parts": [
        { "id": "headerBand", "type": "Rect", "x": 0, "y": 0, "w": 240, "h": 26, "r": 0, "fill": true, "color": "#1e2a30", "visible": true },
        { "id": "title", "type": "Text", "x": 8, "y": 5, "datum": "TL", "size": 1.5, "color": "#ffffff", "text": "Main", "font": null, "visible": true },
        { "id": "battery", "type": "Text", "x": 232, "y": 6, "datum": "TR", "size": 1.25, "color": "#9ce5ac", "text": "82%", "font": null, "visible": true },
        { "id": "temp", "type": "Text", "x": 12, "y": 40, "datum": "TL", "size": 3, "color": "#ffffff", "text": "24.5C", "font": null, "visible": true },
        { "id": "panel", "type": "Rect", "x": 12, "y": 86, "w": 216, "h": 40, "r": 6, "fill": true, "color": "#172126", "visible": false }
      ]
    }
  ]
}
```

すべての profile が同じ 5 つのパーツ（`headerBand`, `title`, `battery`, `temp`, `panel`）と同じ型を持ち、座標やサイズだけが違う点に注意してください。`Cardputer` では `panel` が非表示（`"visible": false`）です。

---

## 4. 出力ルール

**生の JSON だけ**を出力します。Markdown コードフェンス、説明文、コメントを付けてはいけません。

**すべての profile を含むレイアウト全体**を返します。patch、diff、一部 profile、変更パーツだけを返してはいけません。

**profile リストを保持**します。ユーザーが profile レベルの変更を明示しない限り、profile の追加・削除・リネーム・並べ替えや、`id`/`w`/`h`/`rot` の変更をしてはいけません。

**トップレベル `fonts` と各 profile の `fonts` 配列は変更せず保持**します。これらはカタログ/文脈データであり、レイアウト編集対象ではありません。Text `font` の有効な選択肢を判断するためだけに使います。

**`parts` 配列順を profile 間で一貫させます。** 配列順は描画順です。レイヤー順を変える場合は、すべての profile で同じ相対順にします。

**パーツは全 profile 共通**（`(id, type)` の集合は全 profile で同一）です。隠すか削除かは**スコープ**で決めます。**特定の profile でだけ使わない**部品は、その profile から削除せず `"visible": false` で非表示にします（一部の profile からだけ削除すると不変条件が崩れ、その部品を使う他の profile からも消えてしまいます）。**どの profile でも使わない**部品は、part ごと削除して構いません（その場合は**すべての profile**から削除します）。

**ここで定義した part type と field だけを使います。** 「もっとリッチに」などの見た目改善依頼でも、`radius`, `cornerRadius`, `stroke`, `strokeWidth`, `border`, `opacity`, `alpha`, `gradient`, `shadow`, `fontFamily`, `fontStyle`, `fontWeight`, `bold`, `italic`, `wrap`, `align` など未対応フィールドを作ってはいけません。カード、区切り線、ハイライト、簡単な影、簡単なマークは `Rect`、`Line`、`Circle`、`Text` の重ね合わせで近似します。`Image` は既存 project asset を配置する場合だけ使い、asset 名、画像スライス、プロファイル別 asset 差し替えを捏造してはいけません。

`font` フィールドは対応済み Text フィールドです。この制限は他の text styling フィールドについてのものです。依頼で明示されない限り `font` はそのまま保持します。変更する場合も、同じ profile の `fonts` リストにあるフォントだけを使い、フォント名を捏造してはいけません。

利用可能フォントでは依頼を満たせない場合、layout JSON を作る前または後に、人間へフォント追加を依頼して構いません。この依頼は layout JSON 形式の **外側**です。JSON にフォント追加要求フィールドを入れたり、該当 profile の `fonts` 配列にないフォント名を使ったりしてはいけません。必要な文字種がない、見た目が大きく違う、利用可能なネイティブ高さでは bitmap 拡大率が不自然になる、など必要な場合だけ新規フォントを依頼します。フォント追加は任意であり、却下されることがあります。フォントはストレージを消費するため、不要なフォントや同系統の重複フォントを依頼しないでください。

**この形式には含まれず、追加してはいけないもの:** 提供済みフォント文脈と Text の `font` 名 + `size` + `color` を超える編集可能な font family/style 指定、animation/transition/keyframe/fade/duration/delay/timing、project-level data（`assets`、asset binary / Data URL、`targetLibrary`、画像スライス、project name/namespace、output settings、Arduino code）。これは `.lgfxsb.json` project file ではなく、Arduino 生成出力でもありません。**静的レイアウトだけ**を表します。

**静的レイアウトの境界。** このレイアウトは静的な「下地」を表します。`Text` の `text` は確定文言ではなく**プレビュー値**で、実行時にユーザーコードが文字列を差し替えます（描画自体はツールが行うので、ラベル・状態文字・数値表示は `Text` として置いてください）。一方、グラフのデータ線、プログレスバーの塗り、メーターの針のように**値に応じて形状が変わる描画は、利用者の Arduino コード（overlay フック、SPEC §11.4）の責務**であり、この JSON の対象外です。デザインに含めるのは値に依存せず常に出る部分（罫線・軸、バーの枠と 0% 状態）までとし、**代表値やサンプルの塗り・線を静的 part に焼き込まないでください**（overlay が上から描き、二重・食い違いになります）。

---

## 5. Do / Don't

**Do**
- `(id, type)` の集合をすべての profile で同一にする。
- すべての part を profile の `w`×`h` 内に収める。
- profile のアスペクト比に合わせてサイズと位置を調整する（縦長 135×240 には、横長 320×240 とは違う配置が必要）。
- text の整列には anchor + `datum` を使う（例: 右寄せ値は `x = w` の `TR`）。
- 特定の profile で使わない部品は、削除せず `"visible": false` で非表示にする。
- すべての profile を含む全体オブジェクトを、有効な JSON として返す。

**Don't**
- 一部の profile からだけ part を削除しない（`(id, type)` の集合がずれる）。どの profile でも使わない部品だけ、全 profile から削除する。
- `Text` に `w`/`h` を追加しない（Text には存在しない）。
- `asset` 名を捏造しない。既存 asset だけを参照する。
- 明示的に依頼されない限り `Image.asset` を変更しない。画像スライス用 field を追加しない。
- profile 間で part の `id` や `type` を変えない。
- ここにない field を追加しない。コメントや末尾カンマを含めない。

---

## 6. ラウンドトリップ

この形式はツールの内部モデルと 1 対 1 に対応するため、ツールから出力した layout を AI が編集し、再度取り込めます。安定した ID が安全な編集を支えます。変更されていない `id` は「同じ part を移動/再スタイルした」ことを表し、新しい `id` は「新しい part」を表します。

> ツールは Design モードに **export**（「AI用JSONコピー」）と **import**（「AI結果を貼付」）の両方を提供します。import 時、同名 scene があれば **更新**、新しい名前なら **追加**されます。import は undo 可能です。（SPEC §8.15）
