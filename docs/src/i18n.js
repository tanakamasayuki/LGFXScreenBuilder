// Minimal i18n layer (SPEC §14). Initial languages: en, ja. Unknown browser
// languages fall back to en. Dynamic strings use t(key, params); static markup
// uses [data-i18n] / [data-i18n-title] applied by applyStatic().

const MESSAGES = {
  en: {
    'app.note': 'MVP foundation — Design',
    'btn.new': 'New', 'btn.open': 'Open', 'btn.save': 'Save', 'btn.exportH': 'Export .h',
    'confirm.new': 'Discard the current project and start from the sample?',
    'mode.design': 'Design', 'mode.profiles': 'Profiles', 'mode.assets': 'Assets', 'mode.export': 'Export',
    'pane.scenes': 'Scenes', 'pane.parts': 'Parts', 'pane.profile': 'This profile',
    'parts.title': 'Parts ({scene})',
    'act.addScene': 'Add scene', 'act.delScene': 'Delete this scene',
    'act.addPart': 'Add part of the selected type', 'act.delPart': 'Delete selected part',
    'act.front': 'Bring forward', 'act.back': 'Send backward',
    'act.group': 'Group selection', 'act.ungroup': 'Ungroup',
    'hint.group': 'Group origin (children are positioned relative to it).',
    'confirm.delScene': 'Delete scene "{id}" and its layout in every profile?',
    'confirm.delPart': 'Delete part "{id}"? (a group deletes its children too)',
    'zbar.hint': 'Middle button = pan / wheel = zoom',
    'hint.profileMeta': 'Size, rotation, and board assignment are in the Profiles screen. Here you edit placement.',
    'hint.sceneProps': 'Rotation is per profile (Profiles screen). Select a part to edit its placement.',
    'inspector.scene': 'Screen properties ({scene})',
    'inspector.part': 'Properties ({scene} / {profile})',
    'inspector.selectPart': 'Select a part.',
    'inspector.title': 'Properties',
    'field.sceneId': 'Scene ID', 'field.partCount': 'Parts', 'field.partId': 'Part ID',
    'field.size': 'Size', 'field.rotation': 'Rotation',
    'field.x': 'X', 'field.y': 'Y', 'field.anchorX': 'Anchor X', 'field.anchorY': 'Anchor Y',
    'field.width': 'Width', 'field.height': 'Height',
    'field.datum': 'Datum', 'field.text': 'Text', 'field.textSize': 'Text size (mult.)',
    'field.color': 'Color', 'field.visible': 'Visible',
    'field.descPart': 'Note (shared by all profiles)', 'field.descScene': 'Note (this screen)',
    'list.hidden': ' (hidden)', 'cnt.parts': '{n} parts',
    'status.selected': '{scene} / selected: {id}  ({detail})',
    'status.none': '{scene} / no selection',
    'status.profile': '{profile} {w}×{h} ({orient} / rotation {rot})',
    'orient.landscape': 'landscape', 'orient.portrait': 'portrait', 'orient.square': 'square',
    'units.pxApprox': '≈ {px}px',
    'datum.TL': 'top-left', 'datum.TC': 'top-center', 'datum.TR': 'top-right',
    'datum.ML': 'mid-left', 'datum.MC': 'center', 'datum.MR': 'mid-right',
    'datum.BL': 'bottom-left', 'datum.BC': 'bottom-center', 'datum.BR': 'bottom-right',
  },
  ja: {
    'app.note': 'MVP 基盤 — Design',
    'btn.new': '新規', 'btn.open': '開く', 'btn.save': '保存', 'btn.exportH': '.h 出力',
    'confirm.new': '現在のプロジェクトを破棄してサンプルから始めますか？',
    'mode.design': 'Design', 'mode.profiles': 'Profiles', 'mode.assets': 'Assets', 'mode.export': 'Export',
    'pane.scenes': 'シーン', 'pane.parts': 'パーツ', 'pane.profile': 'このプロファイル',
    'parts.title': 'パーツ（{scene}）',
    'act.addScene': 'シーンを追加', 'act.delScene': 'このシーンを削除',
    'act.addPart': '選択中の種類のパーツを追加', 'act.delPart': '選択中のパーツを削除',
    'act.front': '前面へ移動', 'act.back': '背面へ移動',
    'act.group': '選択をグループ化', 'act.ungroup': 'グループ解除',
    'hint.group': 'グループの原点（子はこの原点を基準に配置）。',
    'confirm.delScene': 'シーン「{id}」と全プロファイルのレイアウトを削除しますか？',
    'confirm.delPart': 'パーツ「{id}」を削除しますか？（グループは子も削除）',
    'zbar.hint': '中ボタン=パン／ホイール=ズーム',
    'hint.profileMeta': 'サイズ・回転・ボード割当は Profiles 画面。ここは配置編集。',
    'hint.sceneProps': '回転はプロファイル単位（Profiles 画面）。パーツを選ぶと配置を編集します。',
    'inspector.scene': '画面プロパティ（{scene}）',
    'inspector.part': 'プロパティ（{scene} / {profile}）',
    'inspector.selectPart': 'パーツを選択してください。',
    'inspector.title': 'プロパティ',
    'field.sceneId': 'シーン ID', 'field.partCount': 'パーツ数', 'field.partId': 'パーツ ID',
    'field.size': 'サイズ', 'field.rotation': '回転',
    'field.x': 'X', 'field.y': 'Y', 'field.anchorX': 'アンカー X', 'field.anchorY': 'アンカー Y',
    'field.width': '幅', 'field.height': '高さ',
    'field.datum': '基準点（datum）', 'field.text': '文字', 'field.textSize': '文字サイズ（倍率）',
    'field.color': '色', 'field.visible': '表示',
    'field.descPart': '備考（全プロファイル共通）', 'field.descScene': '備考（この画面のメモ）',
    'list.hidden': '（非表示）', 'cnt.parts': '{n} parts',
    'status.selected': '{scene} / 選択: {id}  ({detail})',
    'status.none': '{scene} / 未選択',
    'status.profile': '{profile} {w}×{h}（{orient} / rotation {rot}）',
    'orient.landscape': '横', 'orient.portrait': '縦', 'orient.square': '正方',
    'units.pxApprox': '≈ {px}px',
    'datum.TL': '左上', 'datum.TC': '上中', 'datum.TR': '右上',
    'datum.ML': '左中', 'datum.MC': '中央', 'datum.MR': '右中',
    'datum.BL': '左下', 'datum.BC': '下中', 'datum.BR': '右下',
  },
};

export const LANGS = ['en', 'ja'];
let lang = 'en';

export function detectLanguage() {
  const l = (globalThis.navigator && globalThis.navigator.language || 'en').toLowerCase();
  return l.startsWith('ja') ? 'ja' : 'en';
}
export function getLang() { return lang; }
export function setLang(l) { lang = MESSAGES[l] ? l : 'en'; }

export function t(key, params) {
  const table = MESSAGES[lang] || MESSAGES.en;
  let s = (key in table) ? table[key] : (MESSAGES.en[key] !== undefined ? MESSAGES.en[key] : key);
  if (params) for (const k in params) s = s.split('{' + k + '}').join(params[k]);
  return s;
}

// Apply translations to static markup: textContent for [data-i18n], title for [data-i18n-title].
export function applyStatic(root = document) {
  if (!root || !root.querySelectorAll) return;
  root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.getAttribute('data-i18n')); });
  root.querySelectorAll('[data-i18n-title]').forEach((el) => { el.title = t(el.getAttribute('data-i18n-title')); });
}
