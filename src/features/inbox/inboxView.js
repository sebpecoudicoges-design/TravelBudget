function fallbackEscape(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

function fallbackText(fr, en) {
  return fr || en || '';
}

function renderModalFrame({ title, note, body, saveId, saveLabel, api = {} }) {
  const escapeHTML = api.escapeHTML || fallbackEscape;
  const tr = api.translate || fallbackText;
  return `
      <div class="tb-inbox-modal" role="dialog" aria-modal="true">
        <div class="tb-inbox-modal-head">
          <div><h3>${escapeHTML(title)}</h3><div class="tb-inbox-note">${escapeHTML(note)}</div></div>
          <button class="btn" type="button" data-inbox-modal-close>×</button>
        </div>
        <div class="tb-inbox-form-grid">${body}</div>
        <div class="tb-inbox-modal-actions">
          <button class="btn" type="button" data-inbox-modal-close>${escapeHTML(tr('Annuler', 'Cancel'))}</button>
          <button class="btn primary" type="button" id="${escapeHTML(saveId)}">${escapeHTML(saveLabel)}</button>
        </div>
      </div>`;
}

export function notificationCenterStyles() {
  return `
      #tb-notification-center{position:fixed;right:16px;top:82px;z-index:99998;display:flex;flex-direction:column;align-items:flex-end;gap:8px;font-family:inherit;}
      #tb-notification-button{border:1px solid rgba(37,99,235,.24);border-radius:999px;background:rgba(255,255,255,.97);color:#0f172a;box-shadow:0 16px 48px rgba(15,23,42,.18);padding:9px 12px;display:inline-flex;align-items:center;gap:9px;cursor:pointer;font-weight:900;font-size:13px;}
      body.theme-dark #tb-notification-button{background:rgba(15,23,42,.96);color:#f8fafc;border-color:rgba(148,163,184,.28);}
      .tb-notification-dot{display:inline-flex;align-items:center;justify-content:center;min-width:22px;height:22px;padding:0 7px;border-radius:999px;background:#ef4444;color:#fff;font-size:12px;font-weight:900;}
      #tb-notification-panel{width:min(380px,calc(100vw - 32px));max-height:min(460px,calc(100vh - 132px));overflow:auto;border:1px solid rgba(15,23,42,.10);border-radius:8px;background:rgba(255,255,255,.98);box-shadow:0 24px 70px rgba(15,23,42,.24);padding:12px;color:#0f172a;display:none;}
      body.theme-dark #tb-notification-panel{background:rgba(15,23,42,.98);color:#f8fafc;border-color:rgba(148,163,184,.22);}
      .tb-notification-row{border:1px solid rgba(15,23,42,.08);border-radius:8px;padding:10px;background:rgba(248,250,252,.92);display:flex;flex-direction:column;gap:4px;cursor:pointer;margin-top:8px;}
      body.theme-dark .tb-notification-row{background:rgba(30,41,59,.72);border-color:rgba(148,163,184,.16);}
      .tb-notification-row strong{font-size:13px;line-height:1.25;}
      .tb-notification-row small{font-size:12px;color:#64748b;line-height:1.35;}
      body.theme-dark .tb-notification-row small{color:#cbd5e1;}
      .tb-notification-empty{font-size:13px;color:#64748b;padding:8px;}
      @media(max-width:720px){#tb-notification-center{right:12px;top:72px;}#tb-notification-button{padding:8px 10px;}.tb-notification-label{display:none;}}
    `;
}

export function renderNotificationCenterHost({ label = 'Notifications', count = 0, api = {} } = {}) {
  const escapeHTML = api.escapeHTML || fallbackEscape;
  return `<button id="tb-notification-button" type="button"><span class="tb-notification-dot">${escapeHTML(count)}</span><span class="tb-notification-label">${escapeHTML(label)}</span></button><div id="tb-notification-panel"></div>`;
}

export function renderNotificationCenterPanel({ rows, api = {} }) {
  const escapeHTML = api.escapeHTML || fallbackEscape;
  const tr = api.translate || fallbackText;
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) {
    return `<div class="tb-notification-empty">${escapeHTML(tr('Aucune notification.', 'No notifications.'))}</div>`;
  }
  return list.map((row, idx) => `
          <button class="tb-notification-row" type="button" data-notification-idx="${idx}">
            <strong>${escapeHTML(row?.title || tr('Notification', 'Notification'))}</strong>
            <small>${escapeHTML(row?.body || '')}</small>
          </button>
        `).join('');
}

export function renderTripApprovalModal({
  meta = {},
  createsCash = false,
  amount = 0,
  currency = '',
  wallets = [],
  actionLabel = '',
  api = {},
} = {}) {
  const escapeHTML = api.escapeHTML || fallbackEscape;
  const tr = api.translate || fallbackText;
  const title = createsCash ? tr('Ajouter la dépense Trip', 'Add Trip expense') : tr('Ajouter ma part Budget Trip', 'Add my Trip budget share');
  const note = createsCash
    ? tr('Cette action crée le paiement cash complet et ta part Budget.', 'This creates the full cash payment and your Budget share.')
    : tr('Cette action ajoute uniquement ta part au Budget. Elle ne débite pas ta wallet et ne crée pas de paiement cash.', 'This only adds your share to Budget. It does not debit your wallet or create a cash payment.');
  const walletLabel = createsCash ? tr('Wallet à débiter', 'Wallet to debit') : tr('Wallet de référence (non débitée)', 'Reference wallet (not debited)');
  const walletOptions = (Array.isArray(wallets) ? wallets : [])
    .map((wallet) => `<option value="${escapeHTML(wallet?.id || wallet?.wallet_id)}">${escapeHTML(wallet?.name || 'Wallet')} · ${escapeHTML(wallet?.currency || '')}</option>`)
    .join('');

  return renderModalFrame({
    title,
    note,
    saveId: 'tb-trip-approval-save',
    saveLabel: actionLabel || tr('Valider', 'Approve'),
    api,
    body: `
          <div class="field span-2"><label>${escapeHTML(tr('Partage', 'Shared trip'))}</label><input type="text" value="${escapeHTML(meta.trip_name || 'Trip')}" disabled></div>
          <div class="field span-2"><label>${escapeHTML(tr('Dépense', 'Expense'))}</label><input type="text" value="${escapeHTML(meta.expense_label || '')}" disabled></div>
          <div class="field"><label>${escapeHTML(createsCash ? tr('Montant à débiter', 'Amount to debit') : tr('Montant déclaré payé', 'Declared paid amount'))}</label><input type="text" value="${escapeHTML(`${amount || ''} ${currency}`.trim())}" disabled></div>
          <div class="field"><label>${escapeHTML(tr('Ta part budget', 'Your budget share'))}</label><input type="text" value="${escapeHTML(`${Number(meta.payer_share_amount || 0) || 0} ${currency}`)}" disabled></div>
          <div class="field span-2"><label>${escapeHTML(walletLabel)}</label><select id="tb-trip-approval-wallet">${walletOptions}</select></div>`,
  });
}

export function renderTransactionModal({
  initialType = 'expense',
  walletOptions = '',
  amount = '',
  label = '',
  date = '',
  categoryOptions = '',
  subcategoryOptions = '',
  api = {},
} = {}) {
  const escapeHTML = api.escapeHTML || fallbackEscape;
  const tr = api.translate || fallbackText;
  return renderModalFrame({
    title: tr('Créer une transaction', 'Create transaction'),
    note: tr('Prérempli depuis À traiter. Vérifie avant validation.', 'Prefilled from Inbox. Review before saving.'),
    saveId: 'tb-inbox-tx-save',
    saveLabel: tr('Créer transaction', 'Create transaction'),
    api,
    body: `
          <div class="field"><label>${escapeHTML(tr('Type', 'Type'))}</label><select id="tb-inbox-tx-type"><option value="expense" ${initialType === 'expense' ? 'selected' : ''}>${escapeHTML(tr('Dépense', 'Expense'))}</option><option value="income" ${initialType === 'income' ? 'selected' : ''}>${escapeHTML(tr('Entrée', 'Income'))}</option></select></div>
          <div class="field"><label>${escapeHTML(tr('Wallet', 'Wallet'))}</label><select id="tb-inbox-tx-wallet">${walletOptions}</select></div>
          <div class="field"><label>${escapeHTML(tr('Devise', 'Currency'))}</label><input id="tb-inbox-tx-currency" type="text" value="" disabled style="opacity:1;font-weight:800;"></div>
          <div class="field"><label>${escapeHTML(tr('Montant', 'Amount'))}</label><input id="tb-inbox-tx-amount" type="number" step="0.01" value="${escapeHTML(amount)}"></div>
          <div class="field span-2"><label>${escapeHTML(tr('Libellé', 'Label'))}</label><input id="tb-inbox-tx-label" type="text" value="${escapeHTML(label)}"></div>
          <div class="field"><label>${escapeHTML(tr('Date paiement début', 'Cash start date'))}</label><input id="tb-inbox-tx-cash-start" type="date" value="${escapeHTML(date)}"></div>
          <div class="field"><label>${escapeHTML(tr('Date paiement fin', 'Cash end date'))}</label><input id="tb-inbox-tx-cash-end" type="date" value="${escapeHTML(date)}"></div>
          <div class="field"><label>${escapeHTML(tr('Budget du', 'Budget from'))}</label><input id="tb-inbox-tx-budget-start" type="date" value="${escapeHTML(date)}"></div>
          <div class="field"><label>${escapeHTML(tr('Budget au', 'Budget to'))}</label><input id="tb-inbox-tx-budget-end" type="date" value="${escapeHTML(date)}"></div>
          <div class="field"><label>${escapeHTML(tr('Catégorie', 'Category'))}</label><select id="tb-inbox-tx-category">${categoryOptions}</select></div>
          <div class="field"><label>${escapeHTML(tr('Sous-catégorie', 'Subcategory'))}</label><select id="tb-inbox-tx-subcategory">${subcategoryOptions}</select></div>
          <div class="field span-2"><label>${escapeHTML(tr('Options', 'Options'))}</label><div style="display:flex;gap:14px;flex-wrap:wrap;"><label style="display:flex;gap:8px;align-items:center;color:var(--text);font-weight:700;"><input id="tb-inbox-tx-paynow" type="checkbox" checked> ${escapeHTML(tr('Payée maintenant', 'Paid now'))}</label><label style="display:flex;gap:8px;align-items:center;color:var(--text);font-weight:700;"><input id="tb-inbox-tx-out" type="checkbox"> ${escapeHTML(tr('Hors budget', 'Out of budget'))}</label></div></div>`,
  });
}

export function renderLinkTransactionModal({
  optionsHtml = '',
  api = {},
} = {}) {
  const escapeHTML = api.escapeHTML || fallbackEscape;
  const tr = api.translate || fallbackText;
  return renderModalFrame({
    title: tr('Lier à une transaction', 'Link to a transaction'),
    note: tr('Les transactions les plus probables sont en haut selon montant, devise, date et libellé. Le document sera classé comme facture puis lié à la transaction choisie.', 'Likely transactions are shown first using amount, currency, date and label. The document will be filed as an invoice and linked to the selected transaction.'),
    saveId: 'tb-inbox-link-save',
    saveLabel: tr('Lier et classer', 'Link and file'),
    api,
    body: `
          <div class="field span-2">
            <label>${escapeHTML(tr('Rechercher', 'Search'))}</label>
            <input id="tb-inbox-link-search" type="search" placeholder="${escapeHTML(tr('Ex. auberge, 12.50, 2026-05, AUD...', 'Ex. hostel, 12.50, 2026-05, AUD...'))}" autocomplete="off" />
          </div>
          <div class="field span-2">
            <label>${escapeHTML(tr('Transaction', 'Transaction'))}</label>
            <select id="tb-inbox-link-tx">${optionsHtml}</select>
          </div>`,
  });
}

export function renderInboxPreview({ item, signedUrls, api = {} }) {
  const escapeHTML = api.escapeHTML || fallbackEscape;
  const tr = api.translate || fallbackText;
  const isImage = api.isImage || (() => false);
  const isPdf = api.isPdf || (() => false);
  if (!item?.storage_path && !item?.media_url) return '';

  if (!item.storage_path && item.media_url) {
    return `<div class="tb-inbox-preview"><div class="tb-inbox-file">⚠️ ${escapeHTML(tr('Document reçu, non copié dans Storage', 'Document received, not copied to Storage'))}</div></div>`;
  }

  const url = item.storage_path ? (signedUrls || {})[item.storage_path] : '';
  if (!url) {
    return `<div class="tb-inbox-preview"><div class="tb-inbox-file">📎 ${escapeHTML(item.media_content_type || 'Document')} · ${escapeHTML(tr('aperçu indisponible', 'preview unavailable'))}</div></div>`;
  }

  if (isImage(item)) {
    return `<div class="tb-inbox-preview"><a href="${escapeHTML(url)}" target="_blank" rel="noopener"><img src="${escapeHTML(url)}" alt="${escapeHTML(tr('Aperçu document reçu', 'Received document preview'))}" loading="lazy"></a></div>`;
  }
  const icon = isPdf(item) ? '📄' : '📎';
  return `<div class="tb-inbox-preview"><a class="tb-inbox-file" href="${escapeHTML(url)}" target="_blank" rel="noopener">${icon} ${escapeHTML(item.raw_text || item.storage_path || 'Document')}</a></div>`;
}

export function renderInboxCard({ item, signedUrls, api = {} }) {
  const escapeHTML = api.escapeHTML || fallbackEscape;
  const tr = api.translate || fallbackText;
  const fmtDateTime = api.formatDateTime || ((value) => String(value || ''));
  const statusLabel = api.statusLabel || ((value) => String(value || 'pending'));
  const parseQuickText = api.parseQuickText || (() => null);
  const isTripPayerApproval = api.isTripPayerApproval || (() => false);
  const tripApprovalMeta = api.tripApprovalMeta || (() => ({}));
  const tripApprovalCreatesCash = api.tripApprovalCreatesCash || (() => false);
  const tripApprovalActionLabel = api.tripApprovalActionLabel || (() => tr('Valider', 'Approve'));
  const isDisabled = item?.status === 'deleted' || item?.status === 'processed';
  const isActionBlocked = isDisabled || item?.status === 'error';

  if (isTripPayerApproval(item)) {
    const meta = tripApprovalMeta(item);
    const createsCash = tripApprovalCreatesCash(item);
    const amount = `${meta.amount || ''} ${meta.currency || ''}`.trim();
    const title = `${createsCash ? tr('Dépense Trip à ajouter', 'Trip expense to add') : tr('Part Budget Trip à ajouter', 'Trip budget share to add')} · ${meta.trip_name || 'Trip'}`;
    const detail = `${meta.expense_label || tr('Dépense', 'Expense')} · ${amount}`;
    return `
        <article class="tb-inbox-card" data-id="${escapeHTML(item.id)}" data-status="${escapeHTML(item.status || 'pending')}">
          <div class="tb-inbox-meta">
            <span class="tb-inbox-badge">${escapeHTML(statusLabel(item.status))}</span>
            <span>${escapeHTML(fmtDateTime(item.created_at))}</span>
          </div>
          <div class="tb-inbox-text">${escapeHTML(title)}</div>
          <div class="tb-inbox-parse">
            <span class="tb-inbox-chip">Trip</span>
            <span class="tb-inbox-chip">${escapeHTML(detail)}</span>
            <span class="tb-inbox-chip">${escapeHTML(tr('Demandé par', 'Requested by'))} ${escapeHTML(meta.created_by_email || item.source_from || 'TravelBudget')}</span>
          </div>
          <div class="tb-inbox-note">${escapeHTML(createsCash ? tr('Ajoute le paiement cash complet et ta part Budget.', 'Adds the full cash payment and your Budget share.') : tr('Ajoute uniquement ta part au Budget. Aucun paiement cash ne sera créé.', 'Only adds your share to Budget. No cash payment will be created.'))}</div>
          ${item.error_message ? `<div class="tb-inbox-note">${escapeHTML(item.error_message)}</div>` : ''}
          <div class="tb-inbox-buttons">
            <button class="primary" type="button" data-inbox-action="trip-payer-approve" data-id="${escapeHTML(item.id)}" ${isActionBlocked ? 'disabled' : ''}>${escapeHTML(tripApprovalActionLabel(item))}</button>
            <button type="button" data-inbox-action="trip-payer-decline" data-id="${escapeHTML(item.id)}" ${isActionBlocked ? 'disabled' : ''}>${escapeHTML(tr('Refuser', 'Decline'))}</button>
            <button type="button" data-inbox-action="snooze" data-id="${escapeHTML(item.id)}" ${item.status === 'deleted' ? 'disabled' : ''}>${escapeHTML(tr('Reporter', 'Snooze'))}</button>
            <button class="danger" type="button" data-inbox-action="delete" data-id="${escapeHTML(item.id)}" ${item.status === 'deleted' ? 'disabled' : ''}>${escapeHTML(tr('Supprimer', 'Delete'))}</button>
          </div>
        </article>
      `;
  }

  const parsed = parseQuickText(item?.raw_text);
  const text = String(item?.raw_text || '').trim();
  const title = text || (item?.media_count ? tr('Document reçu', 'Received document') : tr('Élément reçu', 'Received item'));
  const mediaBadge = item?.media_count ? `${item.media_count} doc · ${item.media_content_type || 'media'}` : tr('Texte', 'Text');
  const snoozeInfo = item?.status === 'snoozed' && item?.snoozed_until ? `<span class="tb-inbox-badge">⏰ ${escapeHTML(fmtDateTime(item.snoozed_until))}</span>` : '';

  return `
      <article class="tb-inbox-card" data-id="${escapeHTML(item?.id)}" data-status="${escapeHTML(item?.status || 'pending')}">
        <div class="tb-inbox-meta">
          <span class="tb-inbox-badge">${escapeHTML(statusLabel(item?.status))}</span>
          <span>${escapeHTML(fmtDateTime(item?.created_at))}</span>
        </div>
        <div class="tb-inbox-text">${escapeHTML(title)}</div>
        <div class="tb-inbox-parse">
          <span class="tb-inbox-chip">WhatsApp</span>
          <span class="tb-inbox-chip">${escapeHTML(mediaBadge)}</span>
          ${parsed ? `<span class="tb-inbox-chip">${escapeHTML(parsed.amount)} ${escapeHTML(parsed.currency || '')}</span>` : ''}
          ${parsed?.label ? `<span class="tb-inbox-chip">${escapeHTML(parsed.label)}</span>` : ''}
          ${snoozeInfo}
        </div>
        ${renderInboxPreview({ item, signedUrls, api })}
        <div class="tb-inbox-note">${escapeHTML(item?.source_from || '')}${item?.storage_path ? ` · ${escapeHTML(tr('Storage OK', 'Storage OK'))}` : (item?.media_count ? ` · ${escapeHTML(tr('Storage manquant', 'Missing Storage'))}` : '')}</div>
        <div class="tb-inbox-buttons">
          <button class="primary" type="button" data-inbox-action="transaction" data-id="${escapeHTML(item?.id)}" ${isDisabled ? 'disabled' : ''}>${escapeHTML(tr('Créer transaction', 'Create transaction'))}</button>
          <button type="button" data-inbox-action="document" data-id="${escapeHTML(item?.id)}" ${isDisabled || !item?.storage_path ? 'disabled' : ''}>${escapeHTML(tr('Classer document', 'File document'))}</button>
          <button type="button" data-inbox-action="link-transaction" data-id="${escapeHTML(item?.id)}" ${isDisabled || !item?.storage_path ? 'disabled' : ''}>${escapeHTML(tr('Lier à transaction', 'Link transaction'))}</button>
          <button type="button" disabled title="${escapeHTML(tr('En cours de développement', 'Work in progress'))}">${escapeHTML(tr('Dépense partagée', 'Shared expense'))}</button>
          <button type="button" data-inbox-action="snooze" data-id="${escapeHTML(item?.id)}" ${item?.status === 'deleted' ? 'disabled' : ''}>${escapeHTML(tr('Reporter', 'Snooze'))}</button>
          <button class="danger" type="button" data-inbox-action="delete" data-id="${escapeHTML(item?.id)}" ${item?.status === 'deleted' ? 'disabled' : ''}>${escapeHTML(tr('Supprimer', 'Delete'))}</button>
        </div>
      </article>
    `;
}

export function renderInboxShell({
  items,
  allItems,
  status = 'active',
  search = '',
  loading = false,
  error = '',
  signedUrls,
  api = {},
}) {
  const escapeHTML = api.escapeHTML || fallbackEscape;
  const tr = api.translate || fallbackText;
  const rows = Array.isArray(items) ? items : [];
  const sourceRows = Array.isArray(allItems) ? allItems : rows;
  const pendingCount = sourceRows.filter((item) => item?.status === 'pending').length;
  const snoozedCount = sourceRows.filter((item) => item?.status === 'snoozed').length;
  const selected = (value) => status === value ? 'selected' : '';

  return `
      <section class="tb-inbox-shell">
        <div class="tb-inbox-head">
          <div class="tb-inbox-title">
            <h2>${escapeHTML(tr('À traiter', 'Inbox'))}</h2>
            <p>${escapeHTML(tr('Messages WhatsApp, reçus, photos et PDF à classer plus tard.', 'WhatsApp messages, receipts, images and PDFs to process later.'))}</p>
          </div>
          <div class="tb-inbox-actions">
            <select id="inbox-status-filter" aria-label="${escapeHTML(tr('Statut', 'Status'))}">
              <option value="active" ${selected('active')}>${escapeHTML(tr('Actifs', 'Active'))}</option>
              <option value="pending" ${selected('pending')}>${escapeHTML(tr('À traiter', 'Pending'))}</option>
              <option value="snoozed" ${selected('snoozed')}>${escapeHTML(tr('Reportés', 'Snoozed'))}</option>
              <option value="error" ${selected('error')}>${escapeHTML(tr('Refusés / erreurs', 'Declined / errors'))}</option>
              <option value="deleted" ${selected('deleted')}>${escapeHTML(tr('Supprimés', 'Deleted'))}</option>
              <option value="all" ${selected('all')}>${escapeHTML(tr('Tous', 'All'))}</option>
            </select>
            <input id="inbox-search" value="${escapeHTML(search)}" placeholder="${escapeHTML(tr('Rechercher...', 'Search...'))}">
            <button type="button" id="inbox-refresh" class="btn">${escapeHTML(tr('Actualiser', 'Refresh'))}</button>
          </div>
        </div>
        <div class="tb-inbox-parse">
          <span class="tb-inbox-chip">${pendingCount} ${escapeHTML(tr('à traiter', 'pending'))}</span>
          <span class="tb-inbox-chip">${snoozedCount} ${escapeHTML(tr('reportés', 'snoozed'))}</span>
        </div>
        ${loading ? `<div class="tb-inbox-empty">${escapeHTML(tr('Chargement...', 'Loading...'))}</div>` : ''}
        {errorBlock}
        ${!loading && !error && rows.length === 0 ? `<div class="tb-inbox-empty">${escapeHTML(tr('Aucun élément à traiter.', 'No item to process.'))}</div>` : ''}
        ${!loading && !error && rows.length ? `<div class="tb-inbox-list">${rows.map((item) => renderInboxCard({ item, signedUrls, api })).join('')}</div>` : ''}
      </section>
    `.replace('{errorBlock}', error ? `<div class="tb-inbox-empty">${escapeHTML(error)}</div>` : '');
}
