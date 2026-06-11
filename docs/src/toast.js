// Transient bottom-center toast for one-shot feedback (clipboard copy, save, …).
// Shared by design / export / main so they all surface the same notification.
export function flash(msg) {
  if (typeof document === 'undefined') return;
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(flash._t);
  flash._t = setTimeout(() => el.classList.remove('show'), 1800);
}
