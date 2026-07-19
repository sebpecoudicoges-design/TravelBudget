function fallbackEscape(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

export function renderTripBalancesPanel({
  members,
  balancesByCur,
  title = 'Balances',
  emptyLabel = 'Ajoute des participants.',
  meLabel = 'moi',
  formatMoney = (amount, currency) => `${amount} ${currency || ''}`.trim(),
  escapeHTML = fallbackEscape,
}) {
  const rows = Array.isArray(members) ? members : [];
  if (!rows.length) return `<div class="muted">${escapeHTML(emptyLabel)}</div>`;
  const balances = balancesByCur instanceof Map ? balancesByCur : new Map();
  const parts = [`<h3 style="margin:0 0 8px 0;">${escapeHTML(title)}</h3>`];
  for (const [currency, memberMap] of balances.entries()) {
    parts.push(`<div class="muted" style="margin-top:8px;">${escapeHTML(currency)}</div>`);
    for (const member of rows) {
      const value = memberMap?.get?.(member.id) || 0;
      const cls = value < -1e-9 ? 'bad' : (value > 1e-9 ? 'good' : '');
      parts.push(
        `<div class="trip-balance-row" style="display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid rgba(0,0,0,0.04);">
          <span class="trip-balance-name">${escapeHTML(member?.name || '—')}${member?.isMe ? ` (${escapeHTML(meLabel)})` : ''}</span>
          <strong class="trip-balance-amount ${cls}">${escapeHTML(formatMoney(value, currency))}</strong>
        </div>`,
      );
    }
  }
  return parts.join('');
}

export function renderTripSettlementsPanel({
  members,
  settlementsByCur,
  settlementEvents,
  canWrite = false,
  myRole = 'viewer',
  currentUserId = '',
  labels = {},
  formatMoney = (amount, currency) => `${amount} ${currency || ''}`.trim(),
  safeFx = (amount) => amount,
  escapeHTML = fallbackEscape,
}) {
  const rows = Array.isArray(members) ? members : [];
  if (!rows.length) return '';
  const txt = (key, fallback) => labels[key] || fallback;
  const me = rows.find((member) => member?.isMe);
  const settlements = settlementsByCur instanceof Map ? settlementsByCur : new Map();
  const parts = [];
  const memberName = (id) => rows.find((member) => member?.id === id)?.name || '—';
  let hasAny = false;
  for (const [, transfers] of settlements.entries()) {
    if (Array.isArray(transfers) && transfers.length) {
      hasAny = true;
      break;
    }
  }

  parts.push(`<div style="display:flex; gap:8px; align-items:center; margin-top:10px; flex-wrap:wrap;">
        <button class="btn" id="trip-copy-settlements" type="button">${escapeHTML(txt('copy', 'Copier les règlements'))}</button>
        <button class="btn" id="trip-share-settlements" type="button">${escapeHTML(txt('share', 'Partager'))}</button>
        <span class="muted">${escapeHTML(hasAny ? txt('simpleFormat', 'Format simple') : txt('nothing', "Rien à régler pour l'instant"))}</span>
      </div>`);

  if (hasAny) {
    for (const [currency, transfers] of settlements.entries()) {
      if (!Array.isArray(transfers) || !transfers.length) continue;
      parts.push(`<div class="muted" style="margin-top:10px;">${escapeHTML(txt('suggested', 'Règlements suggérés'))} • ${escapeHTML(currency)}</div>`);
      for (const transfer of transfers) {
        const from = rows.find((member) => member?.id === transfer?.fromId);
        const to = rows.find((member) => member?.id === transfer?.toId);
        const isMeInvolved = !!me && (transfer?.fromId === me.id || transfer?.toId === me.id);
        let actionBtn = '';
        let actionOnlyBtn = '';
        if (isMeInvolved) {
          const actionLabel = transfer?.fromId === me.id
            ? `${escapeHTML(txt('iPay', 'Je paie'))} ${escapeHTML(to?.name || '—')}`
            : `${escapeHTML(txt('iReceive', 'Je reçois de'))} ${escapeHTML(from?.name || '—')}`;
          actionBtn = `<button class="btn" type="button"
                          data-settle-from="${escapeHTML(transfer?.fromId || '')}"
                          data-settle-to="${escapeHTML(transfer?.toId || '')}"
                          data-settle-cur="${escapeHTML(currency)}"
                          data-settle-amt="${escapeHTML(transfer?.amount || 0)}">${actionLabel}</button>`;
        }
        if (canWrite) {
          const labelOnly = isMeInvolved ? txt('settleWithoutWallet', 'Solder (sans wallet)') : txt('markSettled', 'Marquer comme réglé');
          actionOnlyBtn = `<button class="btn" type="button" style="background:#fff; color:#111; border:1px solid rgba(0,0,0,0.15);"
                          data-settle-only="1"
                          data-settle-from="${escapeHTML(transfer?.fromId || '')}"
                          data-settle-to="${escapeHTML(transfer?.toId || '')}"
                          data-settle-cur="${escapeHTML(currency)}"
                          data-settle-amt="${escapeHTML(transfer?.amount || 0)}">${escapeHTML(labelOnly)}</button>`;
        }
        const approx = String(currency).toUpperCase() === 'THB'
          ? ` <span class="muted" style="font-weight:400;">(≈ ${escapeHTML(formatMoney(safeFx(transfer?.amount, 'THB', 'EUR'), 'EUR'))})</span>`
          : '';
        parts.push(
          `<div style="display:flex; justify-content:space-between; align-items:center; gap:10px; padding:6px 0; border-bottom:1px solid rgba(0,0,0,0.04);">
              <span>${escapeHTML(from?.name || '—')} → ${escapeHTML(to?.name || '—')}</span>
              <div style="display:flex; align-items:center; gap:10px;">
                <strong>${escapeHTML(formatMoney(transfer?.amount, currency))}${approx}</strong>
                ${actionBtn}${actionOnlyBtn}
              </div>
            </div>`,
        );
      }
    }
  }

  const histRows = (Array.isArray(settlementEvents) ? settlementEvents : []).filter((event) => !event?.cancelledAt);
  if (histRows.length) {
    parts.push(`<div class="muted" style="margin-top:14px;">${escapeHTML(txt('history', 'Historique règlements'))}</div>`);
    for (const event of histRows.slice().sort((a, b) => (b?.createdAt || '').localeCompare(a?.createdAt || ''))) {
      const canCancel = canWrite && (myRole === 'owner' || (currentUserId && event?.createdBy === currentUserId));
      const btn = canCancel ? `<button class="btn" type="button" data-cancel-settle="${escapeHTML(event?.id || '')}">${escapeHTML(txt('cancel', 'Annuler'))}</button>` : '';
      parts.push(
        `<div style="display:flex; justify-content:space-between; align-items:center; gap:10px; padding:6px 0; border-bottom:1px solid rgba(0,0,0,0.04);">
              <span class="muted">${escapeHTML(memberName(event?.fromMemberId))} → ${escapeHTML(memberName(event?.toMemberId))}</span>
              <div style="display:flex; align-items:center; gap:10px;">
                <strong>${escapeHTML(formatMoney(event?.amount, event?.currency))}</strong>
                ${btn}
              </div>
            </div>`,
      );
    }
  }

  return parts.join('');
}

export function renderTripHistoryToolbar({
  categories,
  members,
  filters = {},
  filteredCount = 0,
  totalCount = 0,
  labels = {},
  isEnglish = false,
  escapeHTML = fallbackEscape,
}) {
  const cats = Array.isArray(categories) ? categories : [];
  const rows = Array.isArray(members) ? members : [];
  const txt = (key, fallback) => labels[key] || fallback;
  const categoryOptions = cats
    .map((category) => `<option value="${escapeHTML(category)}" ${filters.category === category ? 'selected' : ''}>${escapeHTML(category)}</option>`)
    .join('');
  const memberOptions = (selected) => rows
    .map((member) => {
      const id = String(member?.id || '');
      return `<option value="${escapeHTML(id)}" ${selected === id ? 'selected' : ''}>${escapeHTML(member?.name || '—')}</option>`;
    })
    .join('');

  return `
          <div class="card trip-history-toolbar">
            <div class="muted trip-history-toolbar-copy">${escapeHTML(txt('copy', "Filtres d'audit du trip actif. Ils ne portent que sur l'historique du partage sélectionné."))}</div>
            <div class="trip-filter-grid">
              <div class="field"><label>${escapeHTML(txt('category', 'Catégorie'))}</label><select id="trip-hist-category"><option value="">${escapeHTML(txt('all', 'Tout'))}</option>${categoryOptions}</select></div>
              <div class="field"><label>${escapeHTML(txt('payer', 'Payé par'))}</label><select id="trip-hist-payer"><option value="">${escapeHTML(txt('allMembers', 'Tous'))}</option>${memberOptions(String(filters.payer || ''))}</select></div>
              <div class="field"><label>${escapeHTML(txt('participant', 'Participant'))}</label><select id="trip-hist-participant"><option value="">${escapeHTML(txt('allMembers', 'Tous'))}</option>${memberOptions(String(filters.participant || ''))}</select></div>
              <div class="field"><label>${escapeHTML(txt('dateFrom', 'Du'))}</label><input id="trip-hist-date-from" type="date" value="${escapeHTML(filters.dateFrom || '')}" /></div>
              <div class="field"><label>${escapeHTML(txt('dateTo', 'Au'))}</label><input id="trip-hist-date-to" type="date" value="${escapeHTML(filters.dateTo || '')}" /></div>
              <div class="field"><label>${escapeHTML(txt('amountMin', 'Montant min'))}</label><input id="trip-hist-amount-min" type="number" step="0.01" value="${escapeHTML(filters.amountMin || '')}" placeholder="0" /></div>
              <div class="field"><label>${escapeHTML(txt('amountMax', 'Montant max'))}</label><input id="trip-hist-amount-max" type="number" step="0.01" value="${escapeHTML(filters.amountMax || '')}" placeholder="0" /></div>
              <div class="field"><label>${escapeHTML(txt('search', 'Recherche'))}</label><input id="trip-hist-q" type="text" value="${escapeHTML(filters.q || '')}" placeholder="${escapeHTML(txt('searchPlaceholder', 'Libellé, catégorie...'))}" /></div>
            </div>
            <div style="display:flex; gap:8px; margin-top:10px; flex-wrap:wrap;">
              <button class="btn" type="button" id="trip-hist-apply">${escapeHTML(txt('apply', 'Appliquer'))}</button>
              <button class="btn" type="button" id="trip-hist-reset" style="background:#fff; color:#111; border:1px solid rgba(0,0,0,0.15);">${escapeHTML(txt('reset', 'Réinitialiser'))}</button>
              <span class="muted">${escapeHTML(String(filteredCount))} / ${escapeHTML(String(totalCount))} ${escapeHTML(isEnglish ? 'expense(s)' : 'dépense(s)')}</span>
            </div>
          </div>`;
}
