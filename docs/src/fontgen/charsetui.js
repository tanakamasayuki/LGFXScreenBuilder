// Character-set picker used by the editor's generated-font dialog (§8.7.7).
//
// The layout follows the model in charsets.js rather than dressing it up:
//
//   * 'multi' axes render real checkboxes. They are additive, and a control
//     that adds should look like one — chips read as a radio group, which is
//     what made the previous picker misleading.
//   * 'tier' axes render one row per language with a mutually exclusive ladder
//     (なし → 常用 → ＋人名用 → …). Tiers are cumulative, so moving right can
//     only add characters; the row is a scale, and looks like a scale.
//   * Templates sit on top as one-click starting points. They only fill in a
//     selection — everything stays editable afterwards, so they teach the model
//     instead of hiding it.
import { AXES, TEMPLATES, countOf, toggleSet, templateById } from './charsets.js';
import { t } from '../i18n.js';

const fmt = (n) => n.toLocaleString();

/**
 * @param {Object} o
 *   host      - container element
 *   getSets   - () => string[]      current selection
 *   setSets   - (string[]) => void  called on every change
 *   getText    - () => string       current custom text
 *   setText    - (string) => void
 *   setSample  - (string) => void  preview string a template switches to
 */
export function createCharsetUI({ host, getSets, setSets, getText, setText, setSample }) {
  function apply(next) {
    setSets(next);
    render();
  }

  function renderTemplates() {
    const box = document.createElement('div');
    box.className = 'cs-templates';
    box.innerHTML = `<div class="cs-axis-title">${t('cs.templates')}</div>`;
    const row = document.createElement('div');
    row.className = 'fg-chips';
    for (const tpl of TEMPLATES) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'fchip';
      b.textContent = t('cs.tpl.' + tpl.id);
      b.title = t('cs.tplApply');
      b.onclick = () => {
        // A template replaces the selection rather than adding to it: half of
        // one template plus half of another is nobody's intent. The preview
        // string switches with it, so the difference between templates is
        // visible rather than something to infer from the counts.
        setText(tpl.text || '');
        setSample?.(tpl.sample || '');
        apply([...tpl.sets]);
      };
      row.appendChild(b);
    }
    box.appendChild(row);
    return box;
  }

  function renderMultiAxis(axis, sets) {
    const box = document.createElement('div');
    box.className = 'cs-axis';
    box.innerHTML = `<div class="cs-axis-title">${t('cs.axis.' + axis.id)}</div>`;
    const row = document.createElement('div');
    row.className = 'cs-checks';
    for (const id of axis.sets) {
      const label = document.createElement('label');
      label.className = 'cs-check' + (sets.includes(id) ? ' on' : '');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = sets.includes(id);
      cb.onchange = () => apply(toggleSet(getSets(), id, cb.checked));
      label.appendChild(cb);
      label.appendChild(document.createTextNode(' ' + t('cs.set.' + id) + ' '));
      const n = document.createElement('span');
      n.className = 'cs-n';
      n.textContent = fmt(countOf(id));
      label.appendChild(n);
      row.appendChild(label);
    }
    box.appendChild(row);
    return box;
  }

  function renderTierAxis(axis, sets) {
    const box = document.createElement('div');
    box.className = 'cs-axis';
    box.innerHTML = `<div class="cs-axis-title">${t('cs.axis.' + axis.id)}` +
      (axis.id === 'han' ? ` <span class="sub">${t('cs.hanNote')}</span>` : '') + '</div>';
    for (const lang of axis.languages) {
      const row = document.createElement('div');
      row.className = 'cs-tier';
      const name = document.createElement('span');
      name.className = 'cs-tier-name';
      name.textContent = t('cs.lang.' + lang.id);
      row.appendChild(name);

      const chosen = lang.tiers.find((id) => sets.includes(id)) || null;

      const none = document.createElement('button');
      none.type = 'button';
      none.className = 'fchip' + (chosen ? '' : ' on');
      none.textContent = t('cs.none');
      none.onclick = () => { if (chosen) apply(toggleSet(getSets(), chosen, false)); };
      row.appendChild(none);

      for (const id of lang.tiers) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'fchip' + (chosen === id ? ' on' : '');
        b.innerHTML = `${t('cs.set.' + id)} <span class="cs-n">${fmt(countOf(id))}</span>`;
        b.onclick = () => apply(toggleSet(getSets(), id, chosen !== id));
        row.appendChild(b);
      }
      box.appendChild(row);
    }
    return box;
  }

  function render() {
    const sets = getSets();
    host.innerHTML = '';
    host.appendChild(renderTemplates());
    for (const axis of AXES) {
      host.appendChild(axis.kind === 'multi' ? renderMultiAxis(axis, sets) : renderTierAxis(axis, sets));
    }
  }

  return { render };
}

export { templateById };
