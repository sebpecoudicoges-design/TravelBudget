function fallbackEscape(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

export function renderPendingTripInvites({ invites, language = 'fr', escapeHTML = fallbackEscape }) {
  const rows = Array.isArray(invites) ? invites.filter((row) => row?.token && row?.tripId) : [];
  if (!rows.length) return '';
  const en = language === 'en';
  const roleLabel = (role) => {
    const value = String(role || 'member');
    if (value === 'viewer') return en ? 'viewer' : 'lecteur';
    if (value === 'owner') return en ? 'owner' : 'proprietaire';
    return en ? 'member' : 'membre';
  };
  return `
    <div class="card" style="margin-bottom:12px;border-color:rgba(59,130,246,.35);background:rgba(59,130,246,.08);">
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;">
        <div>
          <h2 style="margin:0 0 6px 0;">${escapeHTML(en ? 'Pending Trip invitation' : 'Invitation Trip en attente')}</h2>
          <div class="muted">${escapeHTML(en ? 'You have been invited to join a shared trip.' : 'Tu as une invitation pour rejoindre un partage Trip.')}</div>
        </div>
        <span class="trip-badge">${rows.length}</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;margin-top:10px;">
        ${rows.map((invite) => `
          <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
            <div>
              <strong>${escapeHTML(invite.tripName)}</strong>
              <div class="muted" style="font-size:12px;">
                ${escapeHTML(en ? 'Invited by' : 'Invité par')} ${escapeHTML(invite.inviterName || invite.inviterEmail || 'TravelBudget')}
                &middot; ${escapeHTML(en ? 'as' : 'en tant que')} ${escapeHTML(invite.memberName)}
                &middot; ${escapeHTML(roleLabel(invite.role))}
              </div>
            </div>
            <button class="btn primary" type="button" data-accept-pending-invite="${escapeHTML(invite.token)}">${escapeHTML(en ? 'Join' : 'Rejoindre')}</button>
          </div>
        `).join('')}
      </div>
    </div>`;
}

export function renderTripExpenseForm({
  editingExpenseId,
  editingDraft,
  trip,
  canWrite,
  memberOptions,
  walletOptions,
  categoryOptions,
  modal = false,
  language = 'fr',
  todayISO,
  defaultCurrency = 'THB',
  translate = (key) => key,
  escapeHTML = fallbackEscape,
  currencyOptionsHTML = () => '',
}) {
  const title = editingExpenseId ? translate('trip.expense.edit') : translate('trip.expense');
  const subtitle = editingExpenseId
    ? `<div class="muted" style="margin:4px 0 10px 0;">${escapeHTML(translate('trip.expense.edit_hint'))}</div>`
    : '';
  const date = editingDraft?.date || todayISO;
  const budgetStart = editingDraft?.budgetDateStart || date;
  const budgetEnd = editingDraft?.budgetDateEnd || budgetStart;
  const selectedCurrency = editingDraft?.currency || trip?.base_currency || defaultCurrency;
  const submitDisabled = canWrite && trip ? '' : 'disabled';
  const body = `
    <div class="row trip-expense-row trip-expense-row--payer"><div class="field" style="min-width:220px;">
      <label>${escapeHTML(translate('trip.expense.paid_by'))}</label><select id="trip-exp-paidby">${memberOptions}</select>
    </div></div>
    <div class="row trip-expense-row trip-expense-row--meta">
      <div class="field" style="min-width:220px;"><label>${escapeHTML(translate('trip.expense.wallet'))}</label><select id="trip-exp-wallet"><option value="">&mdash;</option>${walletOptions}</select></div>
      <div class="field" style="min-width:200px;"><label>${escapeHTML(translate('trip.expense.category'))}</label><select id="trip-exp-category">${categoryOptions}</select></div>
      <div class="field" style="min-width:220px;"><label>${escapeHTML(translate('trip.expense.subcategory'))}</label><select id="trip-exp-subcategory"></select></div>
    </div>
    <div class="row trip-expense-row trip-expense-row--amount">
      <div class="field" style="flex:1;"><label>${escapeHTML(translate('trip.expense.label'))}</label><input id="trip-exp-label" placeholder="${escapeHTML(translate('trip.expense.label_placeholder'))}" value="${escapeHTML(editingDraft?.label || '')}" /></div>
      <div class="field" style="max-width:160px;"><label>${escapeHTML(translate('trip.expense.amount'))}</label><input id="trip-exp-amount" type="number" step="0.01" placeholder="0" value="${escapeHTML(editingDraft?.amount ?? '')}" /></div>
      <div class="field" style="max-width:180px;"><label>${escapeHTML(translate('trip.expense.currency'))}</label><select id="trip-exp-currency">${currencyOptionsHTML(selectedCurrency)}</select><div id="trip-exp-currency-help" class="muted" style="font-size:12px; margin-top:4px;"></div></div>
    </div>
    <div class="row trip-expense-row trip-expense-row--dates"><div class="field"><label>${escapeHTML(translate('trip.expense.cash_date'))}</label><input id="trip-exp-date" type="date" value="${escapeHTML(date)}" /></div></div>
    <details class="trip-expense-advanced" ${modal ? '' : 'open'}>
      <summary>${escapeHTML(language === 'en' ? 'Advanced' : 'Avance')}</summary>
      <div class="row trip-expense-row trip-expense-row--advanced">
        <div class="field" style="min-width:180px;"><label>${escapeHTML(translate('trip.expense.out_budget'))}</label><select id="trip-exp-out"><option value="no">Non</option><option value="yes">Oui</option></select></div>
        <div class="field"><label>${escapeHTML(translate('trip.expense.budget_start'))}</label><input id="trip-exp-budget-start" type="date" value="${escapeHTML(budgetStart)}" /></div>
        <div class="field"><label>${escapeHTML(translate('trip.expense.budget_end'))}</label><input id="trip-exp-budget-end" type="date" value="${escapeHTML(budgetEnd)}" /></div>
      </div>
    </details>
    <div class="row trip-expense-row trip-expense-row--split" style="align-items:flex-end; gap:12px; margin-top:6px;"><div class="field" style="min-width:220px;">
      <label>${escapeHTML(translate('trip.expense.split'))}</label><select id="trip-split-mode"><option value="equal">${escapeHTML(translate('trip.expense.split_equal'))}</option><option value="percent">%</option><option value="amount">${escapeHTML(translate('trip.expense.split_amounts'))}</option></select>
    </div></div>
    <div id="trip-split-participants-box" style="margin-top:6px;"></div><div id="trip-split-box" style="margin-top:6px;"></div>
    <div class="muted" style="margin-top:6px;">${escapeHTML(translate('trip.expense.budget_hint'))}</div>
    <div class="row trip-expense-row trip-expense-actions-row" style="justify-content:flex-end; margin-top:10px; gap:8px;">
      ${editingExpenseId ? `<button class="btn" type="button" id="trip-cancel-edit-exp">${escapeHTML(translate('trip.expense.cancel_edit'))}</button>` : ''}
      <button class="btn primary" id="trip-add-exp" ${submitDisabled}>${escapeHTML(editingExpenseId ? translate('trip.expense.save_edit') : translate('trip.expense.add'))}</button>
    </div>`;

  if (!modal) return `<div class="card"><h2>${title}</h2>${subtitle}${body}</div>`;
  return `<template id="trip-expense-modal-template" data-title="${escapeHTML(title)}"><div class="trip-expense-sheet-body">${body}</div></template>`;
}
