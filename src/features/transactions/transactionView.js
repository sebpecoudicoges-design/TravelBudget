const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ESC[char]);
}

function fallbackT(key) {
  return String(key || '');
}

export function renderTransactionsHelpPanel({
  t = fallbackT,
} = {}) {
  const tr = typeof t === 'function' ? t : fallbackT;
  const rows = [
    tr('transactions.help.paid'),
    tr('transactions.help.unpaid'),
    tr('transactions.help.out'),
  ].filter(Boolean);

  return `
    <div class="tb-ob-head">
      <div class="tb-ob-body">
        <div class="tb-ob-title tb-ob-sub">${esc(tr('transactions.help.title'))}</div>
        <div class="muted">
          ${rows.map((row) => `<div>- ${esc(row)}</div>`).join('')}
        </div>
      </div>
      <div class="tb-ob-actions">
        <button class="btn" type="button" data-tx-action="open-help">${esc(tr('nav.help'))}</button>
        <button class="btn" type="button" data-tx-help-close="1">${esc(tr('transactions.help.hide'))}</button>
      </div>
    </div>`;
}
