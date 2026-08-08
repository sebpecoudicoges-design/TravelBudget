const ICONS = {
  success: '✓',
  error: '!',
  warning: '!',
  info: 'i',
};

function feedbackKind(kind) {
  const value = String(kind || 'info').toLowerCase();
  if (value === 'ok' || value === 'success') return 'success';
  if (value === 'warn' || value === 'warning') return 'warning';
  if (value === 'error' || value === 'danger') return 'error';
  return 'info';
}

function ensureFeedbackHost() {
  if (typeof document === 'undefined' || !document.body) return null;
  let host = document.getElementById('tb-feedback-host');
  if (host) return host;
  host = document.createElement('section');
  host.id = 'tb-feedback-host';
  host.className = 'tb-feedback-host';
  host.setAttribute('aria-label', 'Notifications');
  host.setAttribute('aria-live', 'polite');
  document.body.appendChild(host);
  return host;
}

export function showFeedback(message, options = {}) {
  const text = String(message || '').trim();
  if (!text) return false;
  const host = ensureFeedbackHost();
  if (!host) return false;

  const kind = feedbackKind(options.kind);
  const previous = Array.from(host.children).find((node) => node.dataset?.feedbackMessage === text);
  if (previous) previous.remove();

  const item = document.createElement('article');
  item.className = `tb-feedback tb-feedback--${kind}`;
  item.dataset.feedbackMessage = text;
  item.setAttribute('role', kind === 'error' || kind === 'warning' ? 'alert' : 'status');

  const icon = document.createElement('span');
  icon.className = 'tb-feedback__icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = ICONS[kind];

  const copy = document.createElement('span');
  copy.className = 'tb-feedback__copy';
  copy.textContent = text;

  const close = document.createElement('button');
  close.className = 'tb-feedback__close';
  close.type = 'button';
  close.setAttribute('aria-label', 'Fermer la notification');
  close.textContent = '×';
  close.addEventListener('click', () => item.remove());

  item.append(icon, copy, close);
  host.appendChild(item);
  (window.requestAnimationFrame || window.setTimeout)(() => item.classList.add('is-visible'));

  const duration = Number(options.duration) || (kind === 'error' || kind === 'warning' ? 7000 : 4200);
  window.setTimeout(() => {
    item.classList.remove('is-visible');
    window.setTimeout(() => item.remove(), 220);
  }, duration);
  return true;
}

export function installGlobalFeedback() {
  if (typeof window === 'undefined') return;
  window.tbNotify = (message, options) => showFeedback(message, options);
  window.toastOk = (message) => showFeedback(message, { kind: 'success' });
  window.toastWarn = (message) => showFeedback(message, { kind: 'error' });
  window.toastInfo = (message) => showFeedback(message, { kind: 'info' });
}
