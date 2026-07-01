export function createModal(options = {}) {
  if (typeof document === 'undefined') throw new Error('Modal requires a document.');
  const existing = options.id ? document.getElementById(options.id) : null;
  if (existing) existing.remove();

  const root = document.createElement('div');
  if (options.id) root.id = options.id;
  root.className = `tb-ui-modal-backdrop ${options.rootClass || ''}`.trim();
  root.innerHTML = `
    <section class="tb-ui-modal tb-ui-modal--${options.size || 'md'} ${options.panelClass || ''}" role="dialog" aria-modal="true" aria-labelledby="${options.id || 'tb-ui-modal'}-title">
      <header class="tb-ui-modal__header">
        <div><h3 id="${options.id || 'tb-ui-modal'}-title" class="tb-ui-modal__title"></h3><p class="tb-ui-modal__subtitle" hidden></p></div>
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
  const close = () => { options.onClose?.(); root.remove(); };
  root.querySelector('.tb-ui-modal__close')?.addEventListener('click', close);
  root.addEventListener('click', (event) => { if (event.target === root && options.closeOnBackdrop !== false) close(); });
  document.body.appendChild(root);
  return { root, body, footer, close };
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
