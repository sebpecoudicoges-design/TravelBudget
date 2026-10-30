const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function selectionAmounts(rows = []) {
  const currencies = new Map();
  for (const row of rows) {
    const amount = Number(row.amount);
    if (!Number.isFinite(amount) || !['income', 'expense'].includes(row.type)) continue;
    const currency = String(row.currency || '').toUpperCase();
    const group = currencies.get(currency) || { currency, count: 0, income: 0, expense: 0 };
    group.count++;
    group[row.type] += amount;
    currencies.set(currency, group);
  }
  return [...currencies.values()].map(group => ({ ...group, total: group.income - group.expense,
    average: (group.income - group.expense) / group.count }));
}

export function renderSelectionAmounts({ rows = [], t, format }) {
  return selectionAmounts(rows).map(group => `<div class="tb-selection-amounts" data-selection-currency="${esc(group.currency)}">
    <span>${esc(t('transactions.selection.total'))} : <strong>${esc(format(group.total, group.currency))}</strong></span>
    <span>${esc(t('transactions.selection.average'))} : <strong>${esc(format(group.average, group.currency))}</strong></span>
    <span>${esc(t('transactions.selection.income'))} : ${esc(format(group.income, group.currency))}</span>
    <span>${esc(t('transactions.selection.expense'))} : ${esc(format(group.expense, group.currency))}</span>
  </div>`).join('');
}

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
