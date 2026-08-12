# Changelog / 変更履歴

## Unreleased
- (EN) Add transparent scenes (§8.16): a scene can be marked as an overlay, drawn on top of the screen already on the panel with no background of its own — a dialog with rounded corners or a shadow shows the running screen through it, and the screen below is never redrawn. Buffered builds push the frame through LGFXVirtualCanvas `renderTransparent()` with a project-wide color key (`project.transparentColor`, default `#002400` = `TFT_TRANSPARENT`); direct builds simply skip the background fill, which is equivalent. New example `DialogM5Unified`, and `Screen::supportsTransparentScenes()` reports whether the build honors it.
- (JA) 透過シーンを追加（§8.16）: シーンをオーバーレイ指定すると、自前の背景を持たず、パネルに出ている画面の上に重ねて描かれる。角丸や影のあるダイアログの外側からは動作中の画面が見え、下の画面は描き直されない。バッファ構成では LGFXVirtualCanvas の `renderTransparent()` にプロジェクト単位の抜け色（`project.transparentColor`、既定 `#002400` = `TFT_TRANSPARENT`）で転送し、直描画構成では背景を塗らないだけで等価になる。サンプル `DialogM5Unified` を追加。ビルドが対応しているかは `Screen::supportsTransparentScenes()` で分かる。
- (EN) Requires LGFXVirtualCanvas **1.4.0 or newer** for transparent scenes in a buffered build; an older version draws them as ordinary opaque screens and emits a `#warning`, so projects that do not use the feature keep building unchanged.
- (JA) バッファ構成の透過シーンには LGFXVirtualCanvas **1.4.0 以降**が必要。それより古い場合は通常の不透明画面として描き `#warning` を出すので、この機能を使わないプロジェクトは従来どおりビルドできる。
- (EN) `SceneDesc::transparent` and `Project::transparentColor` are appended to the descriptor and emitted **only when a scene uses them**, so a project without a transparent scene generates byte-identical output and its `.lgfxsb.json` is unchanged — `formatVersion` stays 1 (SPEC §9.2, Layer 1).
- (JA) `SceneDesc::transparent` と `Project::transparentColor` は記述子の末尾に追加し、**使うときだけ出力**する。透過シーンを持たないプロジェクトの生成物はバイト単位で同一、`.lgfxsb.json` も不変で、`formatVersion` は 1 のまま（SPEC §9.2 レイヤ1）。

## 0.2.0
- (EN) Initial release
- (JA) 初期リリース
