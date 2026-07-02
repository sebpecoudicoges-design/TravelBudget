const modalRegistry = new Map();

export function createModal(options = {}) {
  if (typeof document === 'undefined') throw new Error('Modal requires a document.');
  if (options.id && modalRegistry.has(options.id)) modalRegistry.get(options.id).destroy();
  const existing = options.id ? document.getElementById(options.id) : null;
  if (existing) existing.remove();
  const previouslyFocused = document.activeElement;

  const root = document.createElement('div');
  if (options.id) root.id = options.id;
  root.className = `tb-ui-modal-backdrop ${options.rootClass || ''}`.trim();
  root.innerHTML = `
    <section class="tb-ui-modal tb-ui-modal--${options.size || 'md'} ${options.panelClass || ''}" role="dialog" aria-modal="true" aria-labelledby="${options.id || 'tb-ui-modal'}-title" aria-describedby="${options.id || 'tb-ui-modal'}-subtitle" tabindex="-1">
      <header class="tb-ui-modal__header">
        <div><h3 id="${options.id || 'tb-ui-modal'}-title" class="tb-ui-modal__title"></h3><p id="${options.id || 'tb-ui-modal'}-subtitle" class="tb-ui-modal__subtitle" hidden></p></div>
        <button class="btn tb-ui-modal__close" type="button" aria-label="${options.closeLabel || 'Fermer'}">×</button>
      </header>
      <div class="tb-ui-modal__body"></div>
      <footer class="tb-ui-modal__footer" hidden></footer>
    </section>`;

  const title = root.querySelector('.tb-ui-modal__title');
  const subtitle = root.querySelector('.tb-ui-modal__subtitle');
  const body = root.querySelector('.tb-ui-modal__body');
  const footer = root.querySelector('.tb-ui-modal__footer');
  if (title) title.textContent = options.title || '';
  if (subtitle && options.subtitle) { subtitle.textContent = options.subtitle; subtitle.hidden = false; }
  if (body && options.contentHTML) body.innerHTML = options.contentHTML;
  if (footer && options.actionsHTML) { footer.innerHTML = options.actionsHTML; footer.hidden = false; }
  let closed = false;
  const focusableSelector = 'button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])';
  const onKeyDown = (event) => {
    if (event.key === 'Escape' && options.closeOnEscape !== false) {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = Array.from(root.querySelectorAll(focusableSelector));
    if (!focusable.length) { event.preventDefault(); root.querySelector('.tb-ui-modal')?.focus(); return; }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };
  const destroy = () => {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKeyDown);
    root.remove();
    if (options.id && modalRegistry.get(options.id)?.root === root) modalRegistry.delete(options.id);
  };
  const close = () => {
    if (closed) return;
    try { options.onClose?.(); }
    finally {
      destroy();
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') previouslyFocused.focus();
    }
  };
  root.querySelector('.tb-ui-modal__close')?.addEventListener('click', close);
  root.addEventListener('click', (event) => { if (event.target === root && options.closeOnBackdrop !== false) close(); });
  document.addEventListener('keydown', onKeyDown);
  document.body.appendChild(root);
  const initialFocus = options.initialFocus ? root.querySelector(options.initialFocus) : root.querySelector(focusableSelector);
  (initialFocus || root.querySelector('.tb-ui-modal'))?.focus();
  const handle = { root, body, footer, close, destroy };
  if (options.id) modalRegistry.set(options.id, handle);
  return handle;
}

function escapeHTML(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function stateMessage({ kind = 'empty', title = '', message = '' } = {}) {
  const safeKind = ['loading', 'empty', 'error', 'offline'].includes(kind) ? kind : 'empty';
  return `<div class="tb-ui-state tb-ui-state--${safeKind}" role="status"><strong>${escapeHTML(title)}</strong>${message ? `<span>${escapeHTML(message)}</span>` : ''}</div>`;
}
