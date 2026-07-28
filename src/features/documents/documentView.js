function defaultEsc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]));
}

function defaultText(key) {
  return String(key || '');
}

export function renderDocumentCard(doc = {}, options = {}) {
  const esc = options.esc || defaultEsc;
  const tr = options.tr || defaultText;
  const atxt = options.atxt || ((fr, en) => fr || en || '');
  const fmtDate = options.fmtDate || ((value) => String(value || '').slice(0, 10));
  const fmtSize = options.fmtSize || ((value) => String(value || '0'));
  const fmtExpiry = options.fmtExpiry || (() => '');
  const isPdf = options.isPdf || ((mime, name) => /pdf/i.test(`${mime || ''} ${name || ''}`));
  const isImg = options.isImg || ((mime) => /^image\//i.test(String(mime || '')));
  const folders = Array.isArray(options.folders) ? options.folders : [];
  const linkCounts = options.linkCounts || {};
  const isSelected = typeof options.isSelected === 'function' ? options.isSelected : (() => false);
  const bucket = options.bucket || 'personal-documents';
  const name = doc.name || doc.original_filename || 'Document';
  const mime = doc.mime_type || '';
  const icon = isPdf(mime, name) ? 'PDF' : (isImg(mime) ? 'IMG' : 'DOC');
  const moveOptions = [
    `<option value="">${esc(tr('documents.folder.unclassified'))}</option>`,
    ...folders.map((folder) => `
      <option
        value="${esc(folder.id)}"
        ${String(folder.id) === String(doc.folder_id || '') ? 'selected' : ''}>
        ${esc(folder.name)}
      </option>
    `),
  ].join('');
  const thumb = isImg(mime)
    ? `<div class="tb-doc-thumb" data-thumb-path="${esc(doc.storage_path)}" data-thumb-bucket="${esc(doc.storage_bucket || bucket)}">${icon}</div>`
    : `<div class="tb-doc-thumb">${icon}</div>`;
  const tags = Array.isArray(doc.tags) ? doc.tags : [];
  const expiry = fmtExpiry(doc.expires_at);
  const notePreview = String(doc.notes || '').trim();
  const counts = linkCounts[String(doc.id)] || {};
  const txCount = Number(counts.transactions || 0) + Number(counts.tripTransactions || 0);
  const assetCount = Number(counts.assets || 0);
  const linkBadges = [
    txCount ? `<span class="tb-doc-link-badge">${esc(atxt('Transactions', 'Transactions'))} ${esc(txCount)}</span>` : '',
    assetCount ? `<span class="tb-doc-link-badge">${esc(atxt('Assets', 'Assets'))} ${esc(assetCount)}</span>` : '',
  ].filter(Boolean).join('');

  return `<article class="tb-doc-card" data-doc-id="${esc(doc.id)}">
    <div class="tb-doc-top">
      <label class="tb-doc-select">
        <input type="checkbox"
          ${isSelected(doc.id) ? 'checked' : ''}
          onchange="window.tbDocumentsToggleSelect('${esc(doc.id)}')" />
      </label>

      ${thumb}

      <button class="tb-doc-fav"
        type="button"
        title="${esc(atxt('Favori', 'Favorite'))}"
        onclick="window.tbDocumentsToggleFavorite('${esc(doc.id)}')">
        ${esc(doc.is_favorite ? atxt('Favori', 'Saved') : atxt('Favori', 'Save'))}
      </button>
    </div>

    <div class="tb-doc-name">${esc(name)}</div>

    <div class="tb-doc-meta">
      <span>${esc(fmtDate(doc.created_at))}</span>
      <span>-</span>
      <span>${esc(fmtSize(doc.size_bytes))}</span>
    </div>

    ${linkBadges ? `<div class="tb-doc-link-badges">${linkBadges}</div>` : ''}

    ${tags.length ? `<div class="tb-doc-tags">${tags.map((tag) => `<span class="tb-doc-tag">${esc(tag)}</span>`).join('')}</div>` : ''}

    ${expiry ? `<div class="tb-doc-expiry">${esc(expiry)}</div>` : ''}
    ${notePreview ? `<div class="tb-doc-note">${esc(notePreview.length > 90 ? `${notePreview.slice(0, 90)}...` : notePreview)}</div>` : ''}

    <select class="input"
      title="${esc(tr('documents.action.move'))}"
      onchange="window.tbDocumentsMove('${esc(doc.id)}', this.value)">
      ${moveOptions}
    </select>

    <div class="tb-doc-card-actions">
      <button class="btn primary" type="button" onclick="window.tbDocumentsPreview('${esc(doc.id)}')">${esc(tr('documents.action.open'))}</button>
      <button class="btn" type="button" onclick="window.tbDocumentsEditMeta('${esc(doc.id)}')">${esc(tr('documents.action.info'))}</button>
      <details class="tb-doc-more">
        <summary>${esc(atxt('Plus', 'More'))}</summary>
        <div>
          <button class="btn" type="button" onclick="window.tbDocumentsRename('${esc(doc.id)}')">${esc(tr('documents.action.rename'))}</button>
          <button class="btn" type="button" onclick="window.tbDocumentsOpenTransactionLinks('${esc(doc.id)}')">
            ${esc(tr('documents.linked_transactions.title'))} (${esc(txCount)})
          </button>
          <button class="btn" type="button" onclick="window.tbDocumentsOpenAssetLinks('${esc(doc.id)}')">
            ${esc(atxt('Assets', 'Linked assets'))} (${esc(assetCount)})
          </button>
          <button class="btn danger" type="button" onclick="window.tbDocumentsDelete('${esc(doc.id)}')">${esc(tr('documents.action.delete'))}</button>
        </div>
      </details>
    </div>
  </article>`;
}

function relationOptions({ tr, esc, selected = '' }) {
  return ['invoice', 'receipt', 'warranty', 'proof', 'other']
    .map((type) => `<option value="${esc(type)}" ${String(selected) === type ? 'selected' : ''}>${esc(tr(`documents.relation.${type}`))}</option>`)
    .join('');
}

function linkedRow({ title, relation, actions, esc, tr }) {
  return `<div class="tb-doc-share-link"><strong>${esc(title)}</strong><br><span class="muted">${esc(tr(`documents.relation.${relation}`))}</span><div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;">${actions}</div></div>`;
}

export function renderDocumentTransactionsModal({
  doc = {},
  links = [],
  tripLinks = [],
  candidates = [],
  searchQuery = '',
  message = '',
  findTxById = () => null,
  txLabel = () => '',
  findTripExpenseById = () => null,
  tripExpenseLabel = () => '',
  esc = defaultEsc,
  tr = defaultText,
}) {
  const docName = doc.name || doc.original_filename || 'Document';
  const linkedTransactions = links.length ? links.map((link) => {
    const tx = findTxById(link.transaction_id);
    return linkedRow({
      title: txLabel(tx),
      relation: link.relation_type || 'invoice',
      actions: `${tx ? `<button class="btn small primary" type="button" onclick="window.tbOpenTransactionFromDocument('${esc(link.transaction_id)}')">${esc(tr('documents.linked_transactions.open'))}</button>` : ''}<button class="btn small" type="button" onclick="window.tbDocumentsUnlinkTransaction('${esc(link.id)}','${esc(doc.id)}')">${esc(tr('transactions.documents.unlink'))}</button>`,
      esc,
      tr,
    });
  }).join('') : `<div class="tb-doc-empty">${esc(tr('documents.linked_transactions.empty'))}</div>`;

  const linkedTrips = tripLinks.length ? tripLinks.map((link) => {
    const expense = findTripExpenseById(link.expense_id);
    return linkedRow({
      title: tripExpenseLabel(expense),
      relation: link.relation_type || 'receipt',
      actions: `<button class="btn small primary" type="button" onclick="window.tbOpenTripExpenseFromDocument('${esc(link.expense_id)}')">Ouvrir Trip</button><button class="btn small" type="button" onclick="window.tbDocumentsUnlinkTripExpense('${esc(link.id)}','${esc(doc.id)}')">${esc(tr('transactions.documents.unlink'))}</button>`,
      esc,
      tr,
    });
  }).join('') : `<div class="tb-doc-empty">Aucune dépense Trip liée.</div>`;

  const candidateOptions = candidates.length
    ? candidates.map((tx) => `<option value="${esc(tx.id)}">${esc(txLabel(tx))}</option>`).join('')
    : `<option value="">${esc(searchQuery ? tr('documents.linked_transactions.no_result') : tr('documents.linked_transactions.search_first'))}</option>`;

  return `
    <div class="tb-doc-modal">
      <h3>${esc(tr('documents.linked_transactions.title'))}</h3>
      <p class="muted" style="font-size:13px;margin-top:-6px;">${esc(docName)}</p>
      ${message ? `<div class="tb-doc-uploading">${esc(message)}</div>` : ''}

      <div style="display:flex;flex-direction:column;gap:8px;max-height:220px;overflow:auto;margin-bottom:12px;">${linkedTransactions}</div>
      <div style="margin:10px 0 12px;">
        <strong>Dépenses Trip liées</strong>
        <div style="display:flex;flex-direction:column;gap:8px;max-height:180px;overflow:auto;margin-top:8px;">${linkedTrips}</div>
      </div>
      <div class="tb-doc-form">
        <label>${esc(tr('documents.linked_transactions.add'))}</label>
        <input id="tb-doc-link-tx-search" class="input" type="search" value="${esc(searchQuery)}" placeholder="${esc(tr('documents.linked_transactions.search_placeholder'))}" oninput="window.tbDocumentsFilterTransactionSearch('${esc(doc.id)}', this.value)" autocomplete="off" />
        <select id="tb-doc-link-tx-id" class="input" size="${Math.min(Math.max(candidates.length || 1, 4), 8)}">
          ${candidateOptions}
        </select>
        <div class="muted" style="font-size:12px;line-height:1.35;">${esc(tr('documents.linked_transactions.search_hint'))}</div>
        <select id="tb-doc-link-type" class="input">
          ${relationOptions({ tr, esc })}
        </select>
      </div>

      <div class="tb-doc-modal-actions">
        <button class="btn" type="button" onclick="this.closest('.tb-doc-modal-backdrop').remove()">${esc(tr('documents.action.cancel'))}</button>
        <button class="btn primary" type="button" onclick="window.tbDocumentsApplyLinkTransaction('${esc(doc.id)}')">${esc(tr('documents.linked_transactions.link'))}</button>
      </div>
    </div>
  `;
}

export function renderDocumentAssetsModal({
  doc = {},
  links = [],
  assets = [],
  candidates = [],
  message = '',
  assetLabel = () => '',
  esc = defaultEsc,
  tr = defaultText,
  atxt = (fr, en) => fr || en || '',
}) {
  const docName = doc.name || doc.original_filename || 'Document';
  const linkedAssets = links.length ? links.map((link) => {
    const asset = assets.find((item) => String(item.id || '') === String(link.asset_id || ''));
    return linkedRow({
      title: assetLabel(asset),
      relation: link.relation_type || 'proof',
      actions: `<button class="btn small primary" type="button" onclick="window.tbOpenAssetFromDocument('${esc(link.asset_id)}')">${esc(atxt('Ouvrir Patrimoine', 'Open Assets'))}</button><button class="btn small" type="button" onclick="window.tbDocumentsUnlinkAsset('${esc(link.id)}','${esc(doc.id)}')">${esc(tr('transactions.documents.unlink'))}</button>`,
      esc,
      tr,
    });
  }).join('') : `<div class="tb-doc-empty">${esc(atxt('Aucun asset lié.', 'No linked asset.'))}</div>`;

  const candidateOptions = candidates.length
    ? candidates.map((asset) => `<option value="${esc(asset.id)}">${esc(assetLabel(asset))}</option>`).join('')
    : `<option value="">${esc(atxt('Aucun asset disponible', 'No available asset'))}</option>`;

  return `
    <div class="tb-doc-modal">
      <h3>${esc(atxt('Assets', 'Linked assets'))}</h3>
      <p class="muted" style="font-size:13px;margin-top:-6px;">${esc(docName)}</p>
      ${message ? `<div class="tb-doc-uploading">${esc(message)}</div>` : ''}
      <div style="display:flex;flex-direction:column;gap:8px;max-height:220px;overflow:auto;margin-bottom:12px;">${linkedAssets}</div>
      <div class="tb-doc-form">
        <label>${esc(atxt('Ajouter un asset', 'Add asset'))}</label>
        <select id="tb-doc-link-asset-id" class="input">
          ${candidateOptions}
        </select>
        <select id="tb-doc-link-asset-type" class="input">
          ${relationOptions({ tr, esc, selected: 'proof' })}
        </select>
      </div>
      <div class="tb-doc-modal-actions">
        <button class="btn" type="button" onclick="this.closest('.tb-doc-modal-backdrop').remove()">${esc(tr('documents.action.cancel'))}</button>
        <button class="btn primary" type="button" onclick="window.tbDocumentsApplyLinkAsset('${esc(doc.id)}')">${esc(atxt('Lier l’asset', 'Link asset'))}</button>
      </div>
    </div>`;
}
