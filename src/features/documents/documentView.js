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

export function renderDocumentFolders({
  folders = [],
  allCount = 0,
  selectedFolderId = '',
  esc = defaultEsc,
  tr = defaultText,
}) {
  const selected = String(selectedFolderId || '');
  const folderRows = folders.map((folder) => {
    const children = Array.isArray(folder.children) ? folder.children : [];
    const collapsed = !!folder.collapsed;
    const childRows = collapsed ? '' : children.map((child) => `
        <div class="tb-doc-folder-row sub">
          <span class="tb-doc-folder-icon-placeholder"></span>
          <button class="tb-doc-folder${String(child.id) === selected ? ' active' : ''}"
            type="button"
            onclick="window.tbDocumentsSelectFolder('${esc(child.id)}')">
            <span class="tb-doc-folder-label"><span class="tb-doc-folder-glyph" aria-hidden="true">›</span><span>${esc(child.name)}</span></span>
            <small>${esc(child.count || 0)}</small>
          </button>
          <div class="tb-doc-folder-tools">
            <button class="tb-doc-folder-icon" type="button" aria-label="${esc(tr('documents.folder.rename'))}" title="${esc(tr('documents.folder.rename'))}" onclick="window.tbDocumentsRenameFolder('${esc(child.id)}')">✎</button>
            <button class="tb-doc-folder-icon danger" type="button" aria-label="${esc(tr('documents.folder.delete'))}" title="${esc(tr('documents.folder.delete'))}" onclick="window.tbDocumentsDeleteFolder('${esc(child.id)}')">×</button>
          </div>
        </div>
      `).join('');

    return `
      <div class="tb-doc-folder-row">
        ${children.length ? `<button class="tb-doc-folder-icon" type="button" title="${esc(collapsed ? tr('documents.folder.expand') : tr('documents.folder.collapse'))}" onclick="window.tbDocumentsToggleFolderCollapsed('${esc(folder.id)}')">${collapsed ? '+' : '-'}</button>` : `<span class="tb-doc-folder-icon-placeholder"></span>`}
        <button class="tb-doc-folder${String(folder.id) === selected ? ' active' : ''}"
          type="button"
          onclick="window.tbDocumentsSelectFolder('${esc(folder.id)}')">
          <span class="tb-doc-folder-label"><span class="tb-doc-folder-glyph" aria-hidden="true">◆</span><span>${esc(folder.name)}</span></span>
          <small>${esc(folder.count || 0)}</small>
        </button>
        <div class="tb-doc-folder-tools">
          <button class="tb-doc-folder-icon" type="button" aria-label="${esc(tr('documents.folder.subfolder'))}" title="${esc(tr('documents.folder.subfolder'))}" onclick="window.tbDocumentsCreateSubFolder('${esc(folder.id)}')">+</button>
          <button class="tb-doc-folder-icon" type="button" aria-label="${esc(tr('documents.folder.rename'))}" title="${esc(tr('documents.folder.rename'))}" onclick="window.tbDocumentsRenameFolder('${esc(folder.id)}')">✎</button>
          <button class="tb-doc-folder-icon danger" type="button" aria-label="${esc(tr('documents.folder.delete'))}" title="${esc(tr('documents.folder.delete'))}" onclick="window.tbDocumentsDeleteFolder('${esc(folder.id)}')">×</button>
        </div>
      </div>
      ${childRows}
    `;
  }).join('');

  return `<aside class="tb-doc-sidebar" aria-label="${esc(tr('documents.folders'))}">
    <div class="tb-doc-sidebar-head">
      <div class="tb-doc-sidebar-title"><span class="tb-doc-sidebar-mark" aria-hidden="true">▤</span><span><small>${esc(tr('documents.kicker'))}</small><strong>${esc(tr('documents.folders'))}</strong></span></div>
      <button class="btn" type="button" onclick="window.tbDocumentsCreateFolder()">${esc(tr('documents.folder.create'))}</button>
    </div>

    <button class="tb-doc-folder${selected ? '' : ' active'}" type="button" onclick="window.tbDocumentsSelectFolder('')">
      <span class="tb-doc-folder-label"><span class="tb-doc-folder-glyph" aria-hidden="true">●</span><span>${esc(tr('documents.folder.all'))}</span></span>
      <small>${esc(allCount)}</small>
    </button>

    <nav class="tb-doc-folder-list">${folderRows}</nav>
  </aside>`;
}

export function renderDocumentMain({
  folderName = '',
  documentCount = 0,
  sort = 'date_desc',
  search = '',
  tags = [],
  tagFilter = '',
  tagFilterKey = '',
  onlyFavorites = false,
  onlyExpiring = false,
  selectedCount = 0,
  uploading = '',
  loading = false,
  error = '',
  documentCards = '',
  dropTargetLabel = '',
  esc = defaultEsc,
  tr = defaultText,
  atxt = (fr, en) => fr || en || '',
}) {
  const title = folderName || tr('documents.folder.all');
  const sortedTags = Array.isArray(tags) ? tags : [];
  const activeTagKey = String(tagFilterKey || tagFilter || '').toLowerCase();

  return `<div class="tb-doc-main"
    ondragover="event.preventDefault()"
    ondrop="event.preventDefault(); window.tbDocumentsHandleDrop(event)">

    <div class="tb-doc-toolbar">
      <div>
        <strong>${esc(title)}</strong>
        <div class="muted" style="font-size:12px;">
          ${esc(documentCount)} document(s)
        </div>
      </div>

      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        <select class="input"
          onchange="window.tbDocumentsSetSort(this.value)">
          <option value="date_desc" ${sort === 'date_desc' ? 'selected' : ''}>
            ${esc(tr('documents.sort.date_desc'))}
          </option>
          <option value="name_asc" ${sort === 'name_asc' ? 'selected' : ''}>
            ${esc(tr('documents.sort.name_asc'))}
          </option>
          <option value="size_desc" ${sort === 'size_desc' ? 'selected' : ''}>
            ${esc(tr('documents.sort.size_desc'))}
          </option>
        </select>

        <input
          id="tb-doc-search"
          class="tb-doc-search"
          type="search"
          value="${esc(search)}"
          placeholder="${esc(tr('documents.search.placeholder'))}"
          oninput="window.tbDocumentsSetSearch(this.value)"
        />
      </div>
    </div>

    <div class="tb-doc-dropzone"
      onclick="document.getElementById('tb-doc-file-input')?.click()">
      <div>
        <strong>${esc(tr('documents.drop.title'))}</strong>
        <span>${esc(dropTargetLabel)}</span>
      </div>
      <button class="btn primary" type="button" onclick="event.stopPropagation(); document.getElementById('tb-doc-file-input')?.click()">${esc(tr('documents.drop.add'))}</button>
    </div>

    <div class="tb-doc-filters">
      <select class="input" onchange="window.tbDocumentsSetTagFilter(this.value)" title="${esc(tr('documents.filter.tag_title'))}">
        <option value="" ${!tagFilter ? 'selected' : ''}>${esc(tr('documents.filter.all_tags'))}</option>
        ${sortedTags.map((item) => {
          const value = typeof item === 'object' && item ? item.value : item;
          const key = typeof item === 'object' && item ? item.key : value;
          return `<option value="${esc(value)}" ${String(key || '').toLowerCase() === activeTagKey ? 'selected' : ''}>${esc(value)}</option>`;
        }).join('')}
      </select>
      <button class="btn ${onlyFavorites ? 'primary' : ''}" type="button" onclick="window.tbDocumentsToggleFavoritesFilter()">
        ${esc(tr('documents.filter.favorites'))}
      </button>
      <button class="btn ${onlyExpiring ? 'primary' : ''}" type="button" onclick="window.tbDocumentsToggleExpiringFilter()">
        ${esc(tr('documents.filter.expiring'))}
      </button>
      ${tagFilter ? `<button class="btn" type="button" onclick="window.tbDocumentsSetTagFilter('')">Tag: ${esc(tagFilter)} x</button>` : ''}
    </div>

    ${selectedCount ? `
      <div class="tb-doc-batchbar">
        <strong>${esc(tr('documents.batch.selected', { count: selectedCount }))}</strong>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <button class="btn" type="button" onclick="window.tbDocumentsSelectVisible()">${esc(tr('documents.action.select_visible'))}</button>
          <button class="btn primary" type="button" onclick="window.tbDocumentsShareSelected()">${esc(tr('documents.action.share'))}</button>
          <button class="btn" type="button" onclick="window.tbDocumentsAddTagSelected()">${esc(tr('documents.action.add_tag'))}</button>
          <button class="btn" type="button" onclick="window.tbDocumentsMoveSelected()">${esc(tr('documents.action.move'))}</button>
          <button class="btn" type="button" onclick="window.tbDocumentsDeleteSelected()">${esc(tr('documents.action.delete'))}</button>
          <button class="btn" type="button" onclick="window.tbDocumentsClearSelection()">${esc(tr('documents.action.cancel'))}</button>
        </div>
      </div>
    ` : ''}

    ${uploading ? `<div class="tb-doc-uploading">${esc(uploading)}</div>` : ''}
    ${loading ? `<div class="tb-doc-empty">${esc(tr('documents.loading'))}</div>` : ''}

    ${error ? `
      <div class="tb-doc-empty">
        <strong>${esc(atxt('Module Documents non initialise.', 'Documents module not initialized.'))}</strong>
        <br><br>
        ${esc(error)}
        <br><br>
        <span>
          ${esc(atxt('Applique d abord le patch SQL V9.6.5, puis recharge l application.', 'Apply the SQL V9.6.5 patch first, then reload the app.'))}
        </span>
      </div>
    ` : ''}

    ${(!loading && !error && !documentCount)
      ? `<div class="tb-doc-empty">${esc(tr('documents.empty'))}</div>`
      : ''}

    ${(!loading && !error && documentCount)
      ? `<div class="tb-doc-grid">${documentCards}</div>`
      : ''}
  </div>`;
}

export function renderDocumentShell({
  foldersHtml = '',
  mainHtml = '',
  esc = defaultEsc,
  tr = defaultText,
}) {
  return `<div class="tb-doc-hero">
    <div><div class="tb-doc-kicker">${esc(tr('documents.kicker'))}</div><h2>${esc(tr('documents.title'))}</h2><p>${esc(tr('documents.subtitle'))}</p></div>
    <div class="tb-doc-actions">
      <button class="btn" type="button" onclick="window.tbDocumentsCreateFolder()">${esc(tr('documents.folder.create'))}</button>
      <button class="btn primary" type="button" onclick="document.getElementById('tb-doc-file-input')?.click()">${esc(tr('documents.action.add_document'))}</button>
      <input id="tb-doc-file-input" class="tb-doc-hidden-input" type="file" multiple accept="application/pdf,image/*" onchange="window.tbDocumentsUpload(this.files); this.value=''" />
    </div>
  </div>
  <div class="tb-doc-layout">${foldersHtml}${mainHtml}</div>`;
}

export function renderDocumentPreviewModal({
  name = 'Document',
  url = '',
  body = '',
  esc = defaultEsc,
  tr = defaultText,
}) {
  return `<div class="tb-doc-preview">
    <div class="tb-doc-preview-head">
      <strong>${esc(name)}</strong>
      <div style="display:flex;gap:8px;">
        <a class="btn" href="${esc(url)}" target="_blank" rel="noopener">${esc(tr('documents.action.new_tab'))}</a>
        <button class="btn" type="button" onclick="this.closest('.tb-doc-preview-backdrop').remove()">${esc(tr('documents.action.close'))}</button>
      </div>
    </div>
    <div class="tb-doc-preview-body">${body}</div>
  </div>`;
}

export function renderDocumentInfoModal({
  doc = {},
  currentTags = '',
  currentExpiry = '',
  currentNotes = '',
  suggestions = [],
  folderOptionsHtml = '',
  esc = defaultEsc,
  tr = defaultText,
}) {
  return `
    <div class="tb-doc-modal">
      <h3>${esc(tr('documents.modal.info_title'))}</h3>

      <div class="tb-doc-form">
        <div>
          <label>${esc(tr('documents.modal.tags'))}</label>
          <input id="tb-doc-info-tags" class="input" type="text" value="${esc(currentTags)}" placeholder="Australie, WHV, Banque" />
          ${suggestions.length ? `
            <div class="tb-doc-tags" style="margin-top:8px;">
              ${suggestions.map((tag) => `<button class="btn" type="button" data-tag="${esc(tag)}" onclick="window.tbDocumentsToggleSuggestedTag(this.dataset.tag)">${esc(tag)}</button>`).join('')}
            </div>
            <div class="muted" style="font-size:12px;margin-top:4px;">${esc(tr('documents.modal.suggestions_hint'))}</div>
          ` : ''}
        </div>

        <div>
          <label>${esc(tr('documents.modal.folder'))}</label>
          <select id="tb-doc-info-folder" class="input">
            ${folderOptionsHtml}
          </select>
        </div>

        <div>
          <label>${esc(tr('documents.modal.expiry'))}</label>
          <input id="tb-doc-info-expiry" class="input" type="date" value="${esc(currentExpiry)}" />
        </div>

        <div>
          <label>${esc(tr('documents.modal.notes'))}</label>
          <textarea id="tb-doc-info-notes" class="input" placeholder="Ex : original papier chez parents, contrat à renouveler...">${esc(currentNotes)}</textarea>
        </div>
      </div>

      <div class="tb-doc-modal-actions">
        <button class="btn" type="button" onclick="this.closest('.tb-doc-modal-backdrop').remove()">${esc(tr('documents.action.cancel'))}</button>
        <button class="btn primary" type="button" onclick="window.tbDocumentsSaveInfo('${esc(doc.id)}')">${esc(tr('documents.action.save'))}</button>
      </div>
    </div>
  `;
}

export function renderDocumentShareModal({
  count = 0,
  esc = defaultEsc,
  tr = defaultText,
}) {
  return `
    <div class="tb-doc-modal">
      <h3>${esc(tr('documents.share.title', { count }))}</h3>
      <div class="tb-doc-form">
        <label for="tb-doc-share-duration">${esc(tr('documents.share.duration'))}</label>
        <select id="tb-doc-share-duration" class="input">
          <option value="10m">${esc(tr('documents.share.10m'))}</option>
          <option value="1h" selected>${esc(tr('documents.share.1h'))}</option>
          <option value="24h">${esc(tr('documents.share.24h'))}</option>
        </select>
        <p class="muted" style="font-size:13px;margin:0;">
          ${esc(tr('documents.share.hint'))}
        </p>
      </div>
      <div class="tb-doc-modal-actions">
        <button class="btn" type="button" onclick="this.closest('.tb-doc-modal-backdrop').remove()">${esc(tr('documents.action.cancel'))}</button>
        <button class="btn primary" type="button" onclick="window.tbDocumentsGenerateShareLinks()">${esc(tr('documents.action.create_links'))}</button>
      </div>
    </div>
  `;
}

export function renderDocumentShareResultModal({
  count = 0,
  duration = '1h',
  bodyText = '',
  links = [],
  esc = defaultEsc,
  tr = defaultText,
}) {
  return `
    <div class="tb-doc-modal">
      <h3>${esc(tr('documents.share.title', { count }))}</h3>
      <p class="muted" style="font-size:13px;margin-top:-4px;">
        ${esc(tr('documents.share.private_hint'))}
      </p>
      <div class="tb-doc-modal-actions between" style="margin-top:10px;">
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn primary" type="button" onclick="window.tbDocumentsOpenShareEmail()">${esc(tr('documents.action.prepare_email'))}</button>
          <button class="btn" type="button" onclick="window.tbDocumentsCopyShareLinks()">${esc(tr('documents.action.copy_links'))}</button>
          <button class="btn" type="button" onclick="window.tbDocumentsCopyShareBody()">${esc(tr('documents.action.copy_message'))}</button>
        </div>
        <small class="muted">${esc(duration || '1h')}</small>
      </div>
      <textarea class="input tb-doc-share-body" readonly>${esc(bodyText)}</textarea>
      <div class="tb-doc-share-links">
        ${links.map((link) => `
          <div class="tb-doc-share-link">
            <strong>${esc(link.name)}</strong><br>
            ${esc(link.url || '')}
          </div>
        `).join('')}
      </div>
      <div class="tb-doc-modal-actions">
        <button class="btn" type="button" onclick="window.tbDocumentsShareSelected()">${esc(tr('documents.action.recreate'))}</button>
        <button class="btn" type="button" onclick="this.closest('.tb-doc-modal-backdrop').remove()">${esc(tr('documents.action.close'))}</button>
      </div>
    </div>
  `;
}

export function renderDocumentMoveSelectedModal({
  count = 0,
  folderOptions = [],
  esc = defaultEsc,
  tr = defaultText,
}) {
  return `
    <div class="tb-doc-modal">
      <h3>${esc(tr('documents.move.title', { count }))}</h3>
      <div class="tb-doc-form">
        <label for="tb-doc-batch-folder">${esc(tr('documents.move.destination'))}</label>
        <select id="tb-doc-batch-folder" class="input">
          ${folderOptions.map(([id, label]) => `<option value="${esc(id)}">${esc(label)}</option>`).join('')}
        </select>
      </div>
      <div class="tb-doc-modal-actions">
        <button class="btn" type="button" onclick="this.closest('.tb-doc-modal-backdrop').remove()">${esc(tr('documents.action.cancel'))}</button>
        <button class="btn primary" type="button" onclick="window.tbDocumentsApplyMoveSelected()">${esc(tr('documents.action.move'))}</button>
      </div>
    </div>
  `;
}

export function renderDocumentAddTagSelectedModal({
  count = 0,
  tags = [],
  esc = defaultEsc,
  tr = defaultText,
}) {
  return `
    <div class="tb-doc-modal">
      <h3>${esc(tr('documents.tag.title', { count }))}</h3>
      <div class="tb-doc-form">
        <label for="tb-doc-batch-tag">${esc(tr('documents.tag.label'))}</label>
        <input id="tb-doc-batch-tag" class="input" list="tb-doc-known-tags" placeholder="${esc(tr('documents.tag.placeholder'))}" autocomplete="off" />
        <datalist id="tb-doc-known-tags">
          ${tags.map((tag) => `<option value="${esc(tag)}"></option>`).join('')}
        </datalist>
        <p class="muted" style="font-size:13px;margin:0;">
          ${esc(tr('documents.tag.hint'))}
        </p>
      </div>
      <div class="tb-doc-modal-actions">
        <button class="btn" type="button" onclick="this.closest('.tb-doc-modal-backdrop').remove()">${esc(tr('documents.action.cancel'))}</button>
        <button class="btn primary" type="button" onclick="window.tbDocumentsApplyAddTagSelected()">${esc(tr('documents.drop.add'))}</button>
      </div>
    </div>
  `;
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
