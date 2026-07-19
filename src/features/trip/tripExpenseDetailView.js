function fallbackEscape(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

function renderYesNoPill(value, yes = 'Oui', no = 'Non', escapeHTML = fallbackEscape) {
  return value
    ? `<span class="pill" style="font-size:12px;">${escapeHTML(yes)}</span>`
    : `<span class="pill" style="font-size:12px;background:rgba(0,0,0,.06);color:#333;">${escapeHTML(no)}</span>`;
}

function asBudgetTransactionMap(value) {
  if (value?.get) return value;
  if (!value || typeof value !== 'object') return new Map();
  return new Map(Object.entries(value));
}

export function renderTripExpenseDetailContent({
  ex,
  shares,
  members,
  audit,
  linkIssues,
  walletNameById = () => null,
  formatMoney = (amount, currency) => `${amount} ${currency || ''}`.trim(),
  round2 = (value) => Math.round((Number(value) || 0) * 100) / 100,
  translate = (key) => key,
  escapeHTML = fallbackEscape,
}) {
  const expense = ex || {};
  const shareRows = Array.isArray(shares) ? shares : [];
  const memberRows = Array.isArray(members) ? members : [];
  const detail = audit || {};
  const budgetLinks = Array.isArray(detail.budgetLinks) ? detail.budgetLinks : [];
  const budgetTransactionsById = asBudgetTransactionMap(detail.budgetTransactionsById);
  const issues = Array.isArray(linkIssues) ? linkIssues : [];
  const amount = Number(expense.amount) || 0;
  const currency = expense.currency || '';
  let sum = 0;

  const splitRows = shareRows.map((share) => {
    const member = memberRows.find((row) => String(row?.id || '') === String(share?.memberId || ''));
    const shareAmount = Number(share?.shareAmount) || 0;
    sum += shareAmount;
    const pct = amount > 0 ? (shareAmount / amount) * 100 : 0;
    return `
      <tr>
        <td data-label="Participant">${escapeHTML(member?.name || '—')}</td>
        <td data-label="Part" style="text-align:right;white-space:nowrap;">${escapeHTML(formatMoney(shareAmount, currency))}</td>
        <td data-label="%" style="text-align:right;white-space:nowrap;">${escapeHTML(String(round2(pct)))}%</td>
      </tr>`;
  }).join('');

  const diff = round2(sum - amount);
  const warning = Math.abs(diff) >= 0.01
    ? `<div class="muted" style="margin-top:10px;padding:10px;border-radius:10px;background:rgba(255,165,0,.12);">
         Somme des parts = ${escapeHTML(formatMoney(sum, currency))} (écart ${escapeHTML(formatMoney(diff, currency))}). Vérifie la répartition.
       </div>`
    : '';

  const linkIssueHTML = issues.length
    ? `<div style="margin-top:12px;padding:10px;border-radius:12px;background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.28);">
         <div style="font-weight:800;margin-bottom:6px;">${escapeHTML(translate('trip.linked.audit_title'))}</div>
         ${issues.map((issue) => `<div class="muted" style="font-size:12px;">${escapeHTML(issue?.type || 'link_issue')} • tx ${escapeHTML(String(issue?.transactionId || '—'))}</div>`).join('')}
       </div>`
    : '';

  const mainTx = detail.walletTransaction || null;
  const mainTxWallet = mainTx?.walletId ? walletNameById(mainTx.walletId) : null;
  const mainTxButton = mainTx?.id
    ? `<button class="btn small" type="button" data-trip-detail-open-tx="${escapeHTML(String(mainTx.id))}">${escapeHTML(translate('trip.linked.open_transaction'))}</button>`
    : '';

  const budgetRows = budgetLinks.map((link) => {
    const member = memberRows.find((row) => String(row?.id || '') === String(link?.memberId || '')) || null;
    const tx = budgetTransactionsById.get(link?.transactionId) || null;
    const walletName = tx?.walletId ? walletNameById(tx.walletId) : null;
    const openButton = tx?.id
      ? `<button class="btn small" type="button" data-trip-detail-open-tx="${escapeHTML(String(tx.id))}">${escapeHTML(translate('trip.linked.open_transaction'))}</button>`
      : '—';
    return `
      <tr>
        <td data-label="Participant">${escapeHTML(member?.name || '—')}</td>
        <td data-label="Montant tx" style="text-align:right;white-space:nowrap;">${tx ? escapeHTML(formatMoney(tx.amount, tx.currency)) : '—'}</td>
        <td data-label="Catégorie">${escapeHTML(tx?.category || '—')}</td>
        <td data-label="Wallet">${escapeHTML(walletName || '—')}</td>
        <td data-label="pay_now / out">${tx ? `${renderYesNoPill(tx.payNow, 'Oui', 'Non', escapeHTML)} / ${renderYesNoPill(tx.outOfBudget, 'Oui', 'Non', escapeHTML)}` : '—'}</td>
        <td data-label="Action">${openButton}</td>
      </tr>`;
  }).join('');

  const splitPercent = amount > 0 ? round2((sum / amount) * 100) : 0;

  return `
    <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap;">
      <div style="min-width:0;">
        <div style="font-weight:700;font-size:16px;">${escapeHTML(expense.label || 'Dépense')}</div>
        <div class="muted" style="font-size:12px;margin-top:2px;">Trip expense</div>
      </div>
      <div style="font-weight:800;font-size:18px;white-space:nowrap;">${escapeHTML(formatMoney(amount, currency))}</div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin-top:12px;">
      <div style="border:1px solid rgba(0,0,0,.08);border-radius:12px;padding:10px;">
        <div class="muted" style="font-size:12px;margin-bottom:6px;">Lien wallet principal</div>
        <div style="font-weight:700;">${mainTx ? 'Oui' : 'Non'}</div>
        <div class="muted" style="font-size:12px;margin-top:6px;">${mainTx ? `${escapeHTML(mainTxWallet || 'Wallet inconnue')} • ${escapeHTML(mainTx.category || '—')}` : 'Aucune transaction wallet principale liée.'}</div>
        ${mainTx ? `<div class="muted" style="font-size:12px;margin-top:6px;">${escapeHTML(formatMoney(mainTx.amount, mainTx.currency))} • pay_now ${mainTx.payNow ? 'oui' : 'non'} • out_of_budget ${mainTx.outOfBudget ? 'oui' : 'non'}</div>` : ''}
        ${mainTxButton ? `<div style="margin-top:8px;">${mainTxButton}</div>` : ''}
      </div>

      <div style="border:1px solid rgba(0,0,0,.08);border-radius:12px;padding:10px;">
        <div class="muted" style="font-size:12px;margin-bottom:6px;">Liens budget de parts</div>
        <div style="font-weight:700;">${escapeHTML(String(budgetLinks.length))}</div>
        <div class="muted" style="font-size:12px;margin-top:6px;">${detail.myShareLink ? 'Ta part budget est liée à une transaction.' : 'Aucun lien trouvé pour ta part.'}</div>
      </div>

      <div style="border:1px solid rgba(0,0,0,.08);border-radius:12px;padding:10px;">
        <div class="muted" style="font-size:12px;margin-bottom:6px;">Cohérence répartition</div>
        <div style="font-weight:700;">${Math.abs(diff) < 0.01 ? 'OK' : 'À vérifier'}</div>
        <div class="muted" style="font-size:12px;margin-top:6px;">Somme parts ${escapeHTML(formatMoney(sum || 0, currency))} • total ${escapeHTML(formatMoney(amount, currency))}</div>
      </div>
    </div>
    ${linkIssueHTML}

    <div style="margin-top:12px;">
      <div class="muted" style="font-size:12px;margin-bottom:6px;">Répartition</div>
      <div style="overflow:auto;border:1px solid rgba(0,0,0,.08);border-radius:12px;">
        <table class="trip-split-table" style="width:100%;border-collapse:collapse;min-width:420px;">
          <thead><tr><th>Participant</th><th style="text-align:right;">Part</th><th style="text-align:right;">%</th></tr></thead>
          <tbody>${splitRows || '<tr><td colspan="3" class="muted" style="padding:10px;">Aucune répartition trouvée.</td></tr>'}</tbody>
          <tfoot><tr><td style="font-weight:700;">Total</td><td style="text-align:right;font-weight:700;white-space:nowrap;">${escapeHTML(formatMoney(sum || 0, currency))}</td><td style="text-align:right;font-weight:700;">${escapeHTML(String(splitPercent))}%</td></tr></tfoot>
        </table>
      </div>
      ${warning}
    </div>

    <div style="margin-top:12px;">
      <div class="muted" style="font-size:12px;margin-bottom:6px;">Liens budget</div>
      <div style="overflow:auto;border:1px solid rgba(0,0,0,.08);border-radius:12px;">
        <table class="trip-split-table" style="width:100%;border-collapse:collapse;min-width:620px;">
          <thead><tr><th>Participant</th><th style="text-align:right;">Montant tx</th><th>Catégorie</th><th>Wallet</th><th>pay_now / out</th><th></th></tr></thead>
          <tbody>${budgetRows || '<tr><td colspan="6" class="muted" style="padding:10px;">Aucun lien budget enregistré pour cette dépense.</td></tr>'}</tbody>
        </table>
      </div>
    </div>`;
}
