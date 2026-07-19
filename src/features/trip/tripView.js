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
<div class="card" style="margin-bottom:12px;border-color:rgba(59,130,246,.35);background:rgba(59,130,246,.08);"><div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;"><div><h2 style="margin:0 0 6px 0;">${escapeHTML(en ? 'Pending Trip invitation' : 'Invitation Trip en attente')}</h2><div class="muted">${escapeHTML(en ? 'You have been invited to join a shared trip.' : 'Tu as une invitation pour rejoindre un partage Trip.')}</div></div><span class="trip-badge">${rows.length}</span></div><div style="display:flex;flex-direction:column;gap:8px;margin-top:10px;">${rows.map((invite) => `<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;"><div><strong>${escapeHTML(invite.tripName)}</strong><div class="muted" style="font-size:12px;">${escapeHTML(en ? 'Invited by' : 'Invité par')} ${escapeHTML(invite.inviterName || invite.inviterEmail || 'TravelBudget')} &middot; ${escapeHTML(en ? 'as' : 'en tant que')} ${escapeHTML(invite.memberName)} &middot; ${escapeHTML(roleLabel(invite.role))}</div></div><button class="btn primary" type="button" data-accept-pending-invite="${escapeHTML(invite.token)}">${escapeHTML(en ? 'Join' : 'Rejoindre')}</button></div>`).join('')}</div></div>`;
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
  const body = `<div class="row trip-expense-row trip-expense-row--payer"><div class="field" style="min-width:220px;"><label>${escapeHTML(translate('trip.expense.paid_by'))}</label><select id="trip-exp-paidby">${memberOptions}</select></div></div><div class="row trip-expense-row trip-expense-row--meta"><div class="field" style="min-width:220px;"><label>${escapeHTML(translate('trip.expense.wallet'))}</label><select id="trip-exp-wallet"><option value="">&mdash;</option>${walletOptions}</select></div><div class="field" style="min-width:200px;"><label>${escapeHTML(translate('trip.expense.category'))}</label><select id="trip-exp-category">${categoryOptions}</select></div><div class="field" style="min-width:220px;"><label>${escapeHTML(translate('trip.expense.subcategory'))}</label><select id="trip-exp-subcategory"></select></div></div><div class="row trip-expense-row trip-expense-row--amount"><div class="field" style="flex:1;"><label>${escapeHTML(translate('trip.expense.label'))}</label><input id="trip-exp-label" placeholder="${escapeHTML(translate('trip.expense.label_placeholder'))}" value="${escapeHTML(editingDraft?.label || '')}" /></div><div class="field" style="max-width:160px;"><label>${escapeHTML(translate('trip.expense.amount'))}</label><input id="trip-exp-amount" type="number" step="0.01" placeholder="0" value="${escapeHTML(editingDraft?.amount ?? '')}" /></div><div class="field" style="max-width:180px;"><label>${escapeHTML(translate('trip.expense.currency'))}</label><select id="trip-exp-currency">${currencyOptionsHTML(selectedCurrency)}</select><div id="trip-exp-currency-help" class="muted" style="font-size:12px;margin-top:4px;"></div></div></div><div class="row trip-expense-row trip-expense-row--dates"><div class="field"><label>${escapeHTML(translate('trip.expense.cash_date'))}</label><input id="trip-exp-date" type="date" value="${escapeHTML(date)}" /></div></div><details class="trip-expense-advanced" ${modal ? '' : 'open'}><summary>${escapeHTML(language === 'en' ? 'Advanced' : 'Avance')}</summary><div class="row trip-expense-row trip-expense-row--advanced"><div class="field" style="min-width:180px;"><label>${escapeHTML(translate('trip.expense.out_budget'))}</label><select id="trip-exp-out"><option value="no">Non</option><option value="yes">Oui</option></select></div><div class="field"><label>${escapeHTML(translate('trip.expense.budget_start'))}</label><input id="trip-exp-budget-start" type="date" value="${escapeHTML(budgetStart)}" /></div><div class="field"><label>${escapeHTML(translate('trip.expense.budget_end'))}</label><input id="trip-exp-budget-end" type="date" value="${escapeHTML(budgetEnd)}" /></div></div></details><div class="row trip-expense-row trip-expense-row--split" style="align-items:flex-end;gap:12px;margin-top:6px;"><div class="field" style="min-width:220px;"><label>${escapeHTML(translate('trip.expense.split'))}</label><select id="trip-split-mode"><option value="equal">${escapeHTML(translate('trip.expense.split_equal'))}</option><option value="percent">%</option><option value="amount">${escapeHTML(translate('trip.expense.split_amounts'))}</option></select></div></div><div id="trip-split-participants-box" style="margin-top:6px;"></div><div id="trip-split-box" style="margin-top:6px;"></div><div class="muted" style="margin-top:6px;">${escapeHTML(translate('trip.expense.budget_hint'))}</div><div class="row trip-expense-row trip-expense-actions-row" style="justify-content:flex-end;margin-top:10px;gap:8px;">${editingExpenseId ? `<button class="btn" type="button" id="trip-cancel-edit-exp">${escapeHTML(translate('trip.expense.cancel_edit'))}</button>` : ''}<button class="btn primary" id="trip-add-exp" ${submitDisabled}>${escapeHTML(editingExpenseId ? translate('trip.expense.save_edit') : translate('trip.expense.add'))}</button></div>`;

  return modal
    ? `<template id="trip-expense-modal-template" data-title="${escapeHTML(title)}"><div class="trip-expense-sheet-body">${body}</div></template>`
    : `<div class="card"><h2>${title}</h2>${subtitle}${body}</div>`;
}

export function renderTripContextHelp({
  title,
  bullets,
  openLabel,
  hideLabel,
  escapeHTML = fallbackEscape,
}) {
  const lines = Array.isArray(bullets) ? bullets.filter(Boolean) : [];
  return `
<div class="trip-help-card-row"><div class="trip-help-card-copy"><h2>${escapeHTML(title)}</h2><div class="muted">${lines.map((line) => `<div>• ${escapeHTML(line)}</div>`).join('')}</div></div><div class="trip-help-card-actions"><button class="btn" type="button" data-trip-help-open="1">${escapeHTML(openLabel)}</button><button class="btn" type="button" data-trip-help-close="1">${escapeHTML(hideLabel)}</button></div></div>`;
}

export function renderTripLinkAuditCard({
  count = 0,
  title,
  body,
  escapeHTML = fallbackEscape,
}) {
  const n = Number(count) || 0;
  if (n <= 0) return '';
  return `
<div class="card trip-link-audit-card"><div class="trip-link-audit-card-row"><div><h2>${escapeHTML(title)}</h2><div class="muted">${escapeHTML(body)}</div></div><span class="trip-badge">${escapeHTML(String(n))}</span></div></div>`;
}

export function renderTripAnalysisBars({
  data,
  pivotCurrency,
  language = 'fr',
  formatMoney = (amount, currency) => `${amount} ${currency || ''}`.trim(),
  escapeHTML = fallbackEscape,
}) {
  const pivot = String(data?.pivot || pivotCurrency || '').toUpperCase();
  const isEn = language === 'en';
  const txt = (fr, en) => (isEn ? en : fr);
  const categories = Array.isArray(data?.categories) ? data.categories : [];
  const participants = Array.isArray(data?.participants) ? data.participants : [];
  const totalCat = categories.reduce((sum, row) => sum + (Number(row?.amount) || 0), 0);
  const maxCat = Math.max(1, ...categories.map((row) => Number(row?.amount) || 0));
  const maxParticipant = Math.max(1, ...participants.map((row) => Math.max(Math.abs(Number(row?.net) || 0), Number(row?.paid) || 0, Number(row?.owed) || 0)));
  const topCategory = categories[0] || null;
  const highestAdvance = [...participants].sort((a, b) => (Number(b?.net) || 0) - (Number(a?.net) || 0))[0] || null;
  const highestDebt = [...participants].sort((a, b) => (Number(a?.net) || 0) - (Number(b?.net) || 0))[0] || null;
  const settledParticipants = participants.filter((row) => Math.abs(Number(row?.net) || 0) < 0.01).length;

  const catHTML = categories.length
    ? categories.map((row) => {
      const amount = Number(row?.amount) || 0;
      const pct = totalCat > 0 ? (amount / totalCat) * 100 : 0;
      const width = Math.max(8, Math.min(100, (amount / maxCat) * 100));
      return `
            <div class="trip-analysis-row">
              <div class="trip-analysis-row-head">
                <strong class="trip-analysis-row-title">${escapeHTML(row?.name)}</strong>
                <div class="trip-analysis-row-values">
                  <strong>${escapeHTML(formatMoney(amount, pivot))}</strong>
                  <div class="muted" style="font-size:12px;">${pct.toFixed(1)}%</div>
                </div>
              </div>
              <div class="trip-analysis-meter"><span style="width:${width.toFixed(1)}%;"></span></div>
            </div>`;
    }).join('')
    : `<div class="muted">${escapeHTML(txt("Aucune dépense exploitable pour l’analyse catégorie.", 'No usable expense for category analysis.'))}</div>`;

  const participantHTML = participants.length
    ? participants.map((row) => {
      const net = Number(row?.net) || 0;
      const tone = net > 0.009 ? '#16a34a' : (net < -0.009 ? '#dc2626' : '#475569');
      const widthPaid = Math.max(6, Math.min(100, ((Number(row?.paid) || 0) / maxParticipant) * 100));
      const widthOwed = Math.max(6, Math.min(100, ((Number(row?.owed) || 0) / maxParticipant) * 100));
      return `
            <div class="trip-analysis-row">
              <div class="trip-analysis-row-head">
                <div>
                  <strong class="trip-analysis-row-title">${escapeHTML(row?.name)}${row?.isMe ? ` (${escapeHTML(txt('moi', 'me'))})` : ''}</strong>
                  <div class="muted" style="font-size:12px;">${Number(row?.expenseCount) || 0} ${escapeHTML(txt('dépense(s) payée(s)', 'paid expense(s)'))}</div>
                </div>
                <div class="trip-analysis-row-values">
                  <strong style="color:${tone};">${escapeHTML(formatMoney(net, pivot))}</strong>
                  <div class="muted" style="font-size:12px;">${escapeHTML(txt('Net = payé - part due', 'Net = paid - owed share'))}</div>
                </div>
              </div>
              <div style="display:grid; gap:6px;">
                <div style="display:flex; justify-content:space-between; gap:10px; font-size:12px;"><span class="muted">${escapeHTML(txt('Payé', 'Paid'))}</span><span>${escapeHTML(formatMoney(row?.paid, pivot))}</span></div>
                <div class="trip-analysis-meter trip-analysis-meter--paid"><span style="width:${widthPaid.toFixed(1)}%;"></span></div>
                <div style="display:flex; justify-content:space-between; gap:10px; font-size:12px;"><span class="muted">${escapeHTML(txt('Part due', 'Owed share'))}</span><span>${escapeHTML(formatMoney(row?.owed, pivot))}</span></div>
                <div class="trip-analysis-meter trip-analysis-meter--owed"><span style="width:${widthOwed.toFixed(1)}%;"></span></div>
              </div>
            </div>`;
    }).join('')
    : `<div class="muted">${escapeHTML(txt('Aucune donnée exploitable pour l’analyse participant.', 'No usable data for participant analysis.'))}</div>`;

  const debtCopy = highestDebt
    ? (isEn
      ? `${escapeHTML(highestDebt.name)} owes ${escapeHTML(formatMoney(Math.abs(Number(highestDebt.net) || 0), pivot))}`
      : `${escapeHTML(highestDebt.name)} doit ${escapeHTML(formatMoney(Math.abs(Number(highestDebt.net) || 0), pivot))}`)
    : escapeHTML(txt('Aucun écart notable', 'No notable gap'));

  return `
      <div class="trip-analysis-shell">
        <div class="trip-analysis-summary">
          <div class="trip-analysis-kpi">
            <span>${escapeHTML(txt('Total du trip', 'Trip total'))}</span>
            <strong>${escapeHTML(formatMoney(totalCat, pivot))}</strong>
            <small>${categories.length} ${escapeHTML(txt('catégorie(s)', 'category/categories'))} · ${participants.length} ${escapeHTML(txt('participant(s)', 'participant(s)'))}</small>
          </div>
          <div class="trip-analysis-kpi">
            <span>${escapeHTML(txt('Catégorie dominante', 'Dominant category'))}</span>
            <strong>${escapeHTML(topCategory?.name || '—')}</strong>
            <small>${topCategory ? escapeHTML(formatMoney(topCategory.amount, pivot)) : escapeHTML(txt('Aucune donnée', 'No data'))}</small>
          </div>
          <div class="trip-analysis-kpi">
            <span>${escapeHTML(txt('Avance la plus forte', 'Highest advance'))}</span>
            <strong>${escapeHTML(highestAdvance?.name || '—')}</strong>
            <small>${highestAdvance ? escapeHTML(formatMoney(highestAdvance.net, pivot)) : escapeHTML(txt('Aucune donnée', 'No data'))}</small>
          </div>
          <div class="trip-analysis-kpi">
            <span>${escapeHTML(txt('Équilibre', 'Balance'))}</span>
            <strong>${settledParticipants}/${participants.length || 0}</strong>
            <small>${debtCopy}</small>
          </div>
        </div>
        <div class="trip-analysis-grid">
          <div class="trip-analysis-card">
            <div class="trip-analysis-card-head">
              <div>
                <h3 style="margin:0;">${escapeHTML(txt('Analyse catégorie', 'Category analysis'))}</h3>
                <div class="muted" style="font-size:12px;">${escapeHTML(txt('Lecture du trip en devise pivot du compte.', 'Trip readout in the account pivot currency.'))}</div>
              </div>
              <div class="pill">${escapeHTML(pivot)}</div>
            </div>
            ${catHTML}
          </div>
          <div class="trip-analysis-card">
            <div class="trip-analysis-card-head">
              <div>
                <h3 style="margin:0;">${escapeHTML(txt('Analyse participant', 'Participant analysis'))}</h3>
                <div class="muted" style="font-size:12px;">${escapeHTML(txt('Qui paie, qui consomme, qui avance.', 'Who pays, who consumes, who advances.'))}</div>
              </div>
              <div class="pill">${escapeHTML(txt('Pivot', 'Pivot'))} ${escapeHTML(pivot)}</div>
            </div>
            ${participantHTML}
          </div>
        </div>
      </div>`;
}

export function renderTripTabs(options) {
  const escapeHTML = options.escapeHTML || fallbackEscape;
  return `<div class="trip-tabs"><button class="btn primary" id="trip-tab-recap" type="button">${escapeHTML(options.recapLabel)}</button><button class="btn trip-tab-btn" id="trip-tab-history" type="button">${escapeHTML(options.historyLabel)}</button></div>`;
}

export function renderTripSplitParticipants({
  members,
  selectedMemberIds,
  title = 'Participants concernés',
  hint = 'En mode égal, le total est réparti seulement entre les participants cochés. Les autres ont une part à 0.',
  meLabel = '(moi)',
  emptyLabel = '—',
  escapeHTML = fallbackEscape,
}) {
  const rows = Array.isArray(members) ? members : [];
  const defaultSelected = rows.map((member) => String(member?.id ?? '')).filter(Boolean);
  const selected = new Set(
    Array.isArray(selectedMemberIds)
      ? selectedMemberIds.map(String)
      : defaultSelected,
  );

  return `
    <div class="muted" style="margin-bottom:6px;">${escapeHTML(title)}</div>
    <div style="display:flex;flex-wrap:wrap;gap:8px;">
      ${rows.map((member) => {
        const id = String(member?.id ?? '');
        const checked = selected.has(id) ? 'checked' : '';
        const name = member?.name || emptyLabel;
        const suffix = member?.isMe ? ` ${meLabel}` : '';
        return `
        <label style="display:inline-flex;align-items:center;gap:6px;border:1px solid rgba(148,163,184,.28);border-radius:999px;padding:6px 10px;background:rgba(255,255,255,.72);cursor:pointer;">
          <input type="checkbox" data-trip-split-member="${escapeHTML(id)}" ${checked} />
          <span>${escapeHTML(name)}${escapeHTML(suffix)}</span>
        </label>`;
      }).join('')}
    </div>
    <div class="muted" style="font-size:12px;margin-top:6px;">${escapeHTML(hint)}</div>
  `;
}

export function renderTripSplitBox({
  mode = 'equal',
  members,
  selectedMemberIds,
  activeCount,
  amountAutoParts,
  previousPercents,
  previousAmounts,
  seedPercents,
  seedAmounts,
  escapeHTML = fallbackEscape,
}) {
  const rows = Array.isArray(members) ? members : [];
  const selected = new Set(Array.isArray(selectedMemberIds) ? selectedMemberIds.map(String) : []);
  const activeRows = Number(activeCount) || rows.filter((member) => selected.has(String(member?.id ?? ''))).length;
  const previousPct = previousPercents || {}, previousAmt = previousAmounts || {}, seededPct = seedPercents || {}, seededAmt = seedAmounts || {};
  const nameCell = (member) => `${escapeHTML(member?.name || '—')}${member?.isMe ? " <span class='muted'>(moi)</span>" : ''}`;

  if (mode === 'equal') {
    return `<div class="muted">Égal entre ${activeRows} participant(s) coché(s).</div>`;
  }

  if (mode === 'percent') {
    const def = activeRows ? (100 / activeRows) : 0;
    const body = rows.map((member) => {
      const id = String(member?.id ?? '');
      const isActive = selected.has(id);
      const disabled = isActive ? '' : 'disabled';
      const value = (previousPct[id] ?? seededPct[id] ?? def).toString();
      return `<tr>
            <td style="padding:6px 8px;">${nameCell(member)}</td>
            <td style="padding:6px 8px; text-align:right;">
              <input id="trip-split-pct-${escapeHTML(id)}" type="number" step="0.01" min="0" style="max-width:120px;" value="${escapeHTML(isActive ? value : '0')}" ${disabled} />
            </td>
          </tr>`;
    }).join('');

    return `
          <div class="muted" style="margin-bottom:6px;">Somme = 100%</div>
          <table style="width:100%; border-collapse:collapse;">
            <thead><tr><th style="text-align:left; padding:6px 8px;">Participant</th><th style="text-align:right; padding:6px 8px;">%</th></tr></thead>
            <tbody>${body}</tbody>
          </table>
          <div class="muted" style="margin-top:6px;">Les montants seront arrondis au centime et ajustés pour retomber exactement sur le total.</div>
        `;
  }

  if (mode === 'amount') {
    const autoParts = Array.isArray(amountAutoParts) ? amountAutoParts : [];
    const body = rows.map((member, index) => {
      const id = String(member?.id ?? '');
      const isActive = selected.has(id);
      const disabled = isActive ? '' : 'disabled';
      const autoValue = autoParts[index] ?? 0;
      const hasManualValue = previousAmt[id] !== undefined || seededAmt[id] !== undefined;
      const value = hasManualValue
        ? (previousAmt[id] ?? seededAmt[id] ?? '').toString()
        : (isActive ? Number(autoValue || 0).toFixed(2) : '0');
      const autoAttr = !hasManualValue && isActive ? 'data-auto="1"' : 'data-auto="0"';
      return `<tr>
            <td style="padding:6px 8px;">${nameCell(member)}</td>
            <td style="padding:6px 8px; text-align:right;">
              <input id="trip-split-amt-${escapeHTML(id)}" type="number" step="0.01" min="0" style="max-width:140px;" value="${escapeHTML(isActive ? value : '0')}" ${autoAttr} ${disabled} />
            </td>
          </tr>`;
    }).join('');

    return `
          <table style="width:100%; border-collapse:collapse;">
            <thead><tr><th style="text-align:left; padding:6px 8px;">Participant</th><th style="text-align:right; padding:6px 8px;">Montant</th></tr></thead>
            <tbody>${body}</tbody>
          </table>
        `;
  }

  return '';
}
