function fallbackEscape(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

function fallbackText(fr, en) {
  return fr || en || '';
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
