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
