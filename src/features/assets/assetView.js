function defaultEsc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderPortfolioSummary({
  summary = {},
  money,
  tr,
  t,
  esc = defaultEsc,
} = {}) {
  const translate = typeof tr === 'function' ? tr : (key) => key;
  const fmt = typeof money === 'function' ? money : (value, currency) => `${Math.round(Number(value || 0))} ${currency || ''}`.trim();
  const lang = typeof t === 'function' ? t : (fr) => fr;
  const currency = summary.currency || 'EUR';
  const missing = Array.isArray(summary.missingCurrencies) ? summary.missingCurrencies : [];
  return `<div class="tb-assets-summary">
    <div class="tb-assets-summary-card primary">
      <small>${esc(translate('assets.summary.your_total'))}</small>
      <strong>${esc(fmt(summary.totalOwned, currency))}</strong>
    </div>
    <div class="tb-assets-summary-card">
      <small>${esc(translate('assets.summary.total_assets'))}</small>
      <strong>${esc(fmt(summary.totalCurrent, currency))}</strong>
    </div>
    <div class="tb-assets-summary-card">
      <small>${esc(translate('assets.summary.estimated_depreciation'))}</small>
      <strong class="depr">-${esc(fmt(summary.totalDepreciation, currency))}</strong>
    </div>
    <div class="tb-assets-summary-card">
      <small>${esc(translate('assets.summary.active_assets'))}</small>
      <strong>${esc(summary.count || 0)}</strong>
    </div>
    ${missing.length ? `<div class="tb-assets-summary-note">${esc(lang('Conversion manquante pour : ', 'Missing conversion for: '))}${esc(missing.join(', '))}. ${esc(lang('Ces assets ne sont pas inclus dans les totaux.', 'These assets are not included in totals.'))}</div>` : ''}
  </div>`;
}

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function rowsForAsset(assetOrId, rows = []) {
  const id = typeof assetOrId === 'object' ? assetOrId?.id : assetOrId;
  return (rows || []).filter((row) => String(row?.asset_id) === String(id));
}

function minePercent(rows = []) {
  const me = rows.find((row) => /toi|moi/i.test(String(row?.display_name || '')) || row?.is_me);
  return num(me?.ownership_percent ?? rows[0]?.ownership_percent ?? 100, 100);
}

function totalPercent(rows = []) {
  return Math.round(rows.reduce((sum, row) => sum + num(row?.ownership_percent, 0), 0) * 100) / 100;
}

function isMeOwnerRow(row = {}, userId = '') {
  return /toi|moi/i.test(String(row.display_name || '')) || (!!row.user_id && String(row.user_id) === String(userId || ''));
}

function realizedSalesForMe(assetId, owners = [], events = [], userId = '') {
  return rowsForAsset(assetId, events).reduce((sum, event) => {
    const from = owners.find((owner) => String(owner.id) === String(event?.from_owner_id));
    return from && isMeOwnerRow(from, userId) ? sum + num(event?.amount, 0) : sum;
  }, 0);
}

function realizedPnLForMe(asset, owners = [], events = [], userId = '') {
  const rows = rowsForAsset(asset, owners);
  const ownPct = minePercent(rows);
  const initialCost = num(asset?.purchase_value, 0) * (ownPct / 100);
  return realizedSalesForMe(asset?.id, owners, events, userId) - initialCost;
}

function defaultMoney(value, currency) {
  return `${Math.round(num(value, 0))} ${currency || ''}`.trim();
}

export function renderAssetCard({
  asset = {},
  owners = [],
  events = [],
  documentLinks = [],
  userId = '',
  computeCurrentValue,
  computeDepreciationProgress,
  computeOwnedValue,
  monthlyBudgetAmount,
  money = defaultMoney,
  tr = (key) => key,
  t = (fr) => fr,
  esc = defaultEsc,
  icon = () => '',
  label = () => tr('assets.type.other'),
  eventLabel = (type) => type,
} = {}) {
  const current = typeof computeCurrentValue === 'function' ? computeCurrentValue(asset) : num(asset.current_value ?? asset.purchase_value, 0);
  const progress = typeof computeDepreciationProgress === 'function' ? computeDepreciationProgress(asset) : { ratio: 0 };
  const pctLoss = asset.purchase_value ? Math.round(((num(asset.purchase_value, 0) - current) / num(asset.purchase_value, 1)) * 100) : 0;
  const lossAmount = Math.max(0, num(asset.purchase_value, 0) - current);
  const assetOwners = rowsForAsset(asset, owners);
  const ownPct = minePercent(assetOwners);
  const ownValue = typeof computeOwnedValue === 'function' ? computeOwnedValue(asset, ownPct) : current * ownPct / 100;
  const width = Math.max(0, Math.min(100, Math.round(num(progress.ratio, 0) * 100)));
  const monthlyCost = typeof monthlyBudgetAmount === 'function'
    ? monthlyBudgetAmount(asset, owners)
    : (asset.depreciation_months ? ((num(asset.purchase_value, 0) - num(asset.residual_value, 0)) / num(asset.depreciation_months, 1)) * ownPct / 100 : 0);
  const depreciationStatus = width >= 100 ? tr('assets.card.depreciated') : tr('assets.card.depreciating');
  const total = totalPercent(assetOwners);
  const warning = assetOwners.length && Math.abs(total - 100) > 0.01
    ? `<span class="tb-asset-owner-warning">Total parts : ${esc(total)}%</span>`
    : '';
  const recent = rowsForAsset(asset, events).slice(0, 2);
  const docsCount = rowsForAsset(asset, documentLinks).length;
  const sold = String(asset.status || '').toLowerCase() === 'sold';
  const pnl = realizedPnLForMe(asset, owners, events, userId);

  return `<section class="tb-asset-card" data-asset-id="${esc(asset.id)}">
    <div class="tb-asset-top"><div><div class="tb-asset-kicker">${esc(tr('assets.card.kicker'))}</div><h3>${icon(asset.asset_type)} ${esc(asset.name)}</h3><p>${esc(tr('assets.card.purchased_on'))} ${esc(asset.purchase_date)}</p></div><span>${esc(label(asset.asset_type))}</span></div>
    <div class="tb-asset-metrics"><div class="tb-asset-primary"><small>${esc(tr('assets.card.your_value'))}</small><strong>${esc(money(ownValue, asset.currency))}</strong><em>${ownPct}% ${esc(tr('assets.card.of_asset'))}</em></div><div>
      <small>${esc(tr('assets.card.current_value'))}</small>
      <strong>${esc(money(current, asset.currency))}</strong>
      <em class="depr">${esc(tr('assets.card.depreciation'))} : -${esc(money(lossAmount, asset.currency))} · -${pctLoss}%</em>
    </div></div>
    <div class="tb-asset-facts">
      <span>${esc(tr('assets.card.purchase'))} : <strong>${esc(money(asset.purchase_value, asset.currency))}</strong></span>
      <span>${esc(tr('assets.card.residual_value'))} : <strong>${esc(money(asset.residual_value, asset.currency))}</strong></span>
      <span>${esc(t('Coût budget mensuel', 'Monthly budget cost'))} : <strong>${esc(money(monthlyCost, asset.currency))}/${esc(tr('assets.card.month'))}</strong></span>
      <span class="${asset.include_in_budget ? 'done' : ''}">${esc(asset.include_in_budget ? t('Inclus au budget', 'Included in budget') : t('Hors budget', 'Outside budget'))}</span>
      <span class="${width >= 100 ? 'done' : ''}">${esc(depreciationStatus)}</span>
    </div>
    <div class="tb-asset-progress"><div><small>${esc(tr('assets.card.amortization'))}</small><small>${width >= 100 ? esc(tr('assets.card.floor_reached')) : width + '% ' + esc(tr('assets.card.used'))}</small></div><b><i style="width:${width}%"></i></b></div>
    <div class="tb-asset-chart" id="asset-chart-${esc(asset.id)}"></div>
    <div class="tb-asset-owners">${assetOwners.length ? assetOwners.map((row) => `<span>${esc(row.display_name)} · ${num(row.ownership_percent, 0)}%</span>`).join('') : `<span>${esc(tr('assets.card.ownership_missing'))}</span>`}${warning}</div>
    ${recent.length ? `<div class="tb-asset-events">${recent.map((event) => `<span>${esc(event.event_date || '')} · ${esc(eventLabel(event.event_type))} · ${esc(num(event.percent, 0))}%</span>`).join('')}</div>` : ''}
    ${sold ? `<div class="tb-asset-pnl"><span>${esc(tr('assets.card.realized_pnl'))}</span><strong class="${pnl >= 0 ? 'pos' : 'neg'}">${pnl >= 0 ? '+' : ''}${esc(money(pnl, asset.currency))}</strong></div>` : ''}
    <div class="tb-asset-actions">
      <button type="button" data-tb-asset-edit="${esc(asset.id)}">${esc(tr('assets.action.edit'))}</button><button type="button" data-tb-asset-owners="${esc(asset.id)}">${esc(tr('assets.action.owners'))}</button><button type="button" data-tb-asset-transfer="${esc(asset.id)}">${esc(tr('assets.action.buy_sell'))}</button><button type="button" data-tb-asset-docs="${esc(asset.id)}">Docs (${docsCount})</button>
      <button type="button" data-tb-asset-sell="${esc(asset.id)}">${esc(tr('assets.action.sell_asset'))}</button><button type="button" class="danger" data-tb-asset-archive="${esc(asset.id)}">${esc(tr('assets.action.archive'))}</button>
    </div>
  </section>`;
}

export function assetModalSpec({
  key,
  title,
  subtitle,
  formAttrs,
  contentHTML,
  submitLabel,
  extraActionsHTML = '',
  size = 'lg',
  tr = (keyName) => keyName,
  esc = defaultEsc,
} = {}) {
  const formId = `tb-asset-${key}-form`;
  return {
    title,
    subtitle,
    size,
    formId,
    contentHTML: `<form id="${formId}" ${formAttrs}>${contentHTML}</form>`,
    actionsHTML: `${extraActionsHTML}<button class="btn" type="button" data-tb-asset-close>${esc(tr('documents.action.cancel'))}</button><button class="btn primary" type="submit" data-tb-asset-submit form="${formId}">${esc(submitLabel)}</button>`,
  };
}

export function renderAssetEditorModalSpec({
  mode = 'create',
  asset = {},
  today = () => new Date().toISOString().slice(0, 10),
  tr = (keyName) => keyName,
  t = (fr) => fr,
  esc = defaultEsc,
} = {}) {
  const now = today();
  const a = {
    name: '',
    asset_type: 'car',
    purchase_value: '',
    residual_value: 0,
    currency: 'EUR',
    purchase_date: now,
    depreciation_months: 36,
    include_in_budget: true,
    budget_method: 'linear',
    budget_start_date: now,
    budget_day: Number(now.slice(8, 10)),
    ...asset,
  };
  const isEdit = mode === 'edit';
  return assetModalSpec({
    key: 'editor',
    title: isEdit ? tr('assets.modal.edit_title') : tr('assets.modal.add_title'),
    subtitle: t('Le coût mensuel alimente uniquement Budget et Analyse, jamais le solde des portefeuilles.', 'The monthly cost feeds Budget and Analysis only, never wallet balances.'),
    formAttrs: `data-tb-asset-form="${isEdit ? 'edit' : 'create'}" ${isEdit ? `data-asset-id="${esc(a.id)}"` : ''}`,
    submitLabel: isEdit ? tr('documents.action.save') : tr('assets.action.create_asset'),
    tr,
    esc,
    contentHTML: `<div class="tb-asset-form-grid">
      <label>${esc(tr('assets.form.name'))}<input name="name" required placeholder="Toyota X-Trail" value="${esc(a.name)}"></label>
      <label>${esc(tr('assets.form.type'))}<select name="asset_type"><option value="car" ${a.asset_type === 'car' ? 'selected' : ''}>${esc(tr('assets.type.car'))}</option><option value="real_estate" ${a.asset_type === 'real_estate' ? 'selected' : ''}>${esc(tr('assets.type.real_estate'))}</option><option value="equipment" ${a.asset_type === 'equipment' ? 'selected' : ''}>${esc(tr('assets.type.equipment'))}</option><option value="other" ${a.asset_type === 'other' ? 'selected' : ''}>${esc(tr('assets.type.other'))}</option></select></label>
      <label>${esc(tr('assets.form.purchase_value'))}<input name="purchase_value" required type="number" min="0" step="0.01" placeholder="5000" value="${esc(a.purchase_value)}"></label>
      <label>${esc(tr('assets.form.residual_value'))}<input name="residual_value" type="number" min="0" step="0.01" value="${esc(a.residual_value)}"></label>
      <label>${esc(tr('assets.form.currency'))}<input name="currency" required maxlength="3" value="${esc(a.currency || 'EUR')}"></label>
      <label>${esc(tr('assets.form.purchase_date'))}<input name="purchase_date" required type="date" value="${esc(a.purchase_date || now)}"></label>
      <label>${esc(tr('assets.form.depreciation_months'))}<input name="depreciation_months" required type="number" min="1" step="1" value="${esc(a.depreciation_months || 36)}"></label>
      ${isEdit ? '' : `<label>${esc(tr('assets.form.your_share'))}<input name="ownership_percent" required type="number" min="0" max="100" step="0.01" value="100"></label>`}
      <label class="tb-asset-check"><input name="include_in_budget" type="checkbox" ${a.include_in_budget !== false ? 'checked' : ''}><span>${esc(t('Inclure le coût mensuel dans le budget', 'Include monthly cost in budget'))}</span></label>
      <label>${esc(t('Mode de calcul', 'Calculation mode'))}<select name="budget_method"><option value="linear" ${a.budget_method !== 'manual' ? 'selected' : ''}>${esc(t('Amortissement linéaire', 'Linear depreciation'))}</option><option value="manual" ${a.budget_method === 'manual' ? 'selected' : ''}>${esc(t('Montant mensuel manuel', 'Manual monthly amount'))}</option></select></label>
      <label>${esc(t('Montant mensuel manuel', 'Manual monthly amount'))}<input name="monthly_budget_override" type="number" min="0" step="0.01" value="${esc(a.monthly_budget_override ?? '')}" placeholder="0.00"></label>
      <label>${esc(t('Début dans le budget', 'Budget start'))}<input name="budget_start_date" type="date" value="${esc(a.budget_start_date || a.purchase_date || now)}"></label>
      <label>${esc(t('Fin dans le budget', 'Budget end'))}<input name="budget_end_date" type="date" value="${esc(a.budget_end_date || '')}"></label>
      <label>${esc(t('Jour mensuel', 'Monthly day'))}<input name="budget_day" type="number" min="1" max="31" step="1" value="${esc(a.budget_day || Number(String(a.purchase_date || now).slice(8, 10)) || 1)}"></label>
    </div>
    <div class="tb-asset-modal-error" data-tb-asset-error role="alert" hidden></div>`,
  });
}

export function renderAssetOwnerRow(owner = {}, { tr = (keyName) => keyName, esc = defaultEsc } = {}) {
  return `<div class="tb-owner-row" data-owner-id="${esc(owner.id || '')}"><input name="owner_name" required placeholder="${esc(tr('assets.form.name'))}" value="${esc(owner.display_name || '')}"><input name="owner_percent" required type="number" min="0" max="100" step="0.01" value="${esc(owner.ownership_percent || 0)}"><button type="button" data-tb-owner-remove>x</button></div>`;
}

export function renderAssetOwnersModalSpec({
  asset = {},
  owners = [],
  tr = (keyName) => keyName,
  esc = defaultEsc,
} = {}) {
  const rows = rowsForAsset(asset, owners);
  return assetModalSpec({
    key: 'owners',
    title: tr('assets.owners.title'),
    subtitle: tr('assets.owners.total_hint', { name: asset.name }),
    formAttrs: `data-tb-asset-owners-form data-asset-id="${esc(asset.id)}"`,
    submitLabel: tr('assets.owners.save'),
    tr,
    esc,
    contentHTML: `<div class="tb-owner-list" data-tb-owner-list>${rows.map((owner) => renderAssetOwnerRow(owner, { tr, esc })).join('') || renderAssetOwnerRow({ id: '', display_name: tr('assets.owner.me'), ownership_percent: 100 }, { tr, esc })}</div><button type="button" class="tb-owner-add" data-tb-owner-add>${esc(tr('assets.owners.add'))}</button><div class="tb-owner-total" data-tb-owner-total></div><div class="tb-asset-modal-error" data-tb-asset-error role="alert" hidden></div>`,
  });
}

export function renderAssetTransferModalSpec({
  asset = {},
  owners = [],
  transactions = [],
  today = () => new Date().toISOString().slice(0, 10),
  tr = (keyName) => keyName,
  esc = defaultEsc,
  txLabel = (tx) => tx?.label || tx?.id || '',
} = {}) {
  const rows = rowsForAsset(asset, owners);
  const opts = rows.map((owner) => `<option value="${esc(owner.id)}">${esc(owner.display_name)} · ${num(owner.ownership_percent, 0)}%</option>`).join('');
  const txOpts = (transactions || []).map((tx) => `<option value="${esc(tx.id)}">${esc(txLabel(tx))}</option>`).join('');

  return assetModalSpec({
    key: 'transfer',
    title: tr('assets.transfer.title'),
    subtitle: tr('assets.transfer.body'),
    formAttrs: `data-tb-asset-transfer-form data-asset-id="${esc(asset.id)}"`,
    submitLabel: tr('assets.transfer.submit'),
    tr,
    esc,
    contentHTML: `<div class="tb-asset-form-grid">
        <label>${esc(tr('assets.form.type'))}
          <select name="event_type">
            <option value="transfer_share">${esc(tr('assets.event.transfer_share'))}</option>
            <option value="buy_share">${esc(tr('assets.event.buy_share'))}</option>
            <option value="sell_share">${esc(tr('assets.event.sell_share'))}</option>
          </select>
        </label>

        <label>${esc(tr('assets.transfer.date'))}
          <input name="event_date" type="date" required value="${esc(today())}">
        </label>

        <label>${esc(tr('assets.transfer.seller'))}
          <select name="from_owner_id" required>${opts}</select>
        </label>

        <label>${esc(tr('assets.transfer.buyer'))}
          <select name="to_owner_id" required>${opts}</select>
        </label>

        <label>${esc(tr('assets.transfer.percent'))}
          <input name="percent" required type="number" min="0.01" max="100" step="0.01" value="10">
        </label>

        <label>${esc(tr('assets.transfer.amount'))}
          <input name="amount" type="number" min="0" step="0.01" value="0">
        </label>

        <label>${esc(tr('assets.form.currency'))}
          <input name="currency" maxlength="3" value="${esc(asset.currency || 'EUR')}">
        </label>

        <label>${esc(tr('assets.transfer.linked_transaction'))}
          <select name="linked_transaction_id">
            <option value="">${esc(tr('assets.transfer.no_linked_transaction'))}</option>
            ${txOpts}
          </select>
        </label>

        <label>Note
          <input name="note" placeholder="Rachat part voiture">
        </label>
      </div>

      <div class="tb-asset-modal-error" data-tb-asset-error role="alert" hidden></div>`,
  });
}

export function renderAssetSaleModalSpec({
  asset = {},
  transactions = [],
  today = () => new Date().toISOString().slice(0, 10),
  t = (fr) => fr,
  tr = (keyName) => keyName,
  esc = defaultEsc,
  txLabel = (tx) => tx?.label || tx?.id || '',
} = {}) {
  const txOpts = (transactions || []).map((tx) => `<option value="${esc(tx.id)}">${esc(txLabel(tx))}</option>`).join('');

  return assetModalSpec({
    key: 'sell',
    title: t("Vendre l’asset", 'Sell asset'),
    subtitle: t("Marque l’asset comme vendu. Le prix de vente est réparti selon les parts actuelles. Aucun cashflow n’est créé.", 'Mark the asset as sold. The sale price is split according to current shares. No cashflow is created.'),
    formAttrs: `data-tb-asset-sell-form data-asset-id="${esc(asset.id)}"`,
    submitLabel: t('Valider la vente', 'Confirm sale'),
    tr,
    esc,
    contentHTML: `<div class="tb-asset-form-grid">
        <label>${esc(t('Date de vente', 'Sale date'))}
          <input name="event_date" type="date" required value="${esc(today())}">
        </label>

        <label>${esc(t('Prix de vente total', 'Total sale price'))}
          <input name="amount" type="number" min="0" step="0.01" required value="0">
        </label>

        <label>${esc(t('Devise', 'Currency'))}
          <input name="currency" maxlength="3" required value="${esc(asset.currency || 'EUR')}">
        </label>

        <label>${esc(t('Transaction liée', 'Linked transaction'))}
          <select name="linked_transaction_id">
            <option value="">${esc(t('Aucune transaction liée', 'No linked transaction'))}</option>
            ${txOpts}
          </select>
        </label>

        <label>Note
          <input name="note" placeholder="${esc(t("Vente totale de l’asset", 'Full asset sale'))}">
        </label>
      </div>

      <div class="tb-asset-modal-error" data-tb-asset-error role="alert" hidden></div>`,
  });
}

function defaultDocNameLabel(doc) {
  return doc?.name || doc?.original_filename || 'Document';
}

function defaultDocLabel(doc) {
  if (!doc) return 'Document';
  return [doc.name || doc.original_filename || 'Document', Array.isArray(doc.tags) ? doc.tags.join(', ') : '', String(doc.created_at || '').slice(0, 10)].filter(Boolean).join(' · ');
}

function renderLinkedMovementsHtml(docId, txLinks = [], tripLinks = [], helpers = {}) {
  const {
    t = (fr) => fr,
    esc = defaultEsc,
    findTxById = () => null,
    findTripExpenseById = () => null,
    isTripLinkedTransaction = () => false,
    txDocLine = () => 'Transaction',
    tripDocLine = () => 'Trip',
  } = helpers;
  const normal = (txLinks || []).filter((link) => String(link.document_id || '') === String(docId));
  const trips = (tripLinks || []).filter((link) => String(link.document_id || '') === String(docId));

  if (!normal.length && !trips.length) {
    return `<div class="tb-asset-doc-linked-empty">${esc(t('Aucune transaction liée à ce document.', 'No transaction linked to this document.'))}</div>`;
  }

  return `<div class="tb-asset-doc-linked-tree">
    <strong>${esc(t('Transactions liées au document', 'Transactions linked to document'))}</strong>
    ${normal.map((link) => {
      const tx = findTxById(link.transaction_id);
      const isTripTx = isTripLinkedTransaction(tx);
      return `<div class="tb-asset-doc-linked-line">
    <span class="${isTripTx ? 'trip' : ''}">
      ${esc(isTripTx ? t('Transaction Trip', 'Trip transaction') : t('Transaction', 'Transaction'))}
    </span>
    <button type="button" data-tb-asset-open-tx="${esc(link.transaction_id)}">${esc(txDocLine(tx))}</button>
  </div>`;
    }).join('')}
    ${trips.map((link) => {
      const expense = findTripExpenseById(link.expense_id);
      return `<div class="tb-asset-doc-linked-line">
        <span class="trip">${esc(t('Transaction Trip', 'Trip transaction'))}</span>
        <button type="button" data-tb-asset-open-trip-expense="${esc(link.expense_id)}">${esc(tripDocLine(expense))}</button>
      </div>`;
    }).join('')}
  </div>`;
}

export function renderAssetDocumentsModalSpec({
  asset = {},
  docs = [],
  links = [],
  message = '',
  txLinks = [],
  tripLinks = [],
  tr = (keyName) => keyName,
  t = (fr) => fr,
  esc = defaultEsc,
  docLabel = defaultDocLabel,
  docNameLabel = defaultDocNameLabel,
  findTxById,
  findTripExpenseById,
  isTripLinkedTransaction,
  txDocLine,
  tripDocLine,
} = {}) {
  const linkedIds = new Set((links || []).map((link) => String(link.document_id || '')));
  const candidates = (docs || []).filter((doc) => !linkedIds.has(String(doc.id || ''))).slice(0, 80);
  const linkedHelpers = { t, esc, findTxById, findTripExpenseById, isTripLinkedTransaction, txDocLine, tripDocLine };

  return assetModalSpec({
    key: 'documents',
    title: t('Documents liés', 'Linked documents'),
    subtitle: asset.name || 'Asset',
    size: 'lg',
    formAttrs: `data-tb-asset-docs-form data-asset-id="${esc(asset.id)}"`,
    submitLabel: t('Lier le document', 'Link document'),
    extraActionsHTML: `<button class="btn" type="button" data-tb-asset-doc-upload="${esc(asset.id)}">+ ${esc(t('Ajouter un document', 'Add document'))}</button>`,
    tr,
    esc,
    contentHTML: `${message ? `<div class="tb-asset-modal-error tb-asset-doc-message" data-tb-asset-doc-message>${esc(message)}</div>` : ''}

      <div class="tb-asset-doc-list">
        ${(links || []).length ? links.map((link) => {
          const doc = (docs || []).find((item) => String(item.id || '') === String(link.document_id || ''));
          return `<div class="tb-asset-doc-row tree">
            <div>
              <strong>📄 ${esc(docNameLabel(doc))}</strong>
              <br>
              <span>${esc(t('Type', 'Type'))} : ${esc(tr(`documents.relation.${link.relation_type || 'proof'}`))}</span>
              ${renderLinkedMovementsHtml(link.document_id, txLinks, tripLinks, linkedHelpers)}
            </div>

            <div>
              <button type="button" data-tb-asset-open-doc="${esc(link.document_id)}">${esc(t('Ouvrir', 'Open'))}</button>
              <button type="button" data-tb-asset-unlink-doc="${esc(link.id)}">${esc(t('Délier', 'Unlink'))}</button>
            </div>
          </div>`;
        }).join('') : `<div class="tb-asset-doc-empty">${esc(t('Aucun document lié.', 'No linked document.'))}</div>`}
      </div>

      <div class="tb-asset-form-grid" style="margin-top:14px;">
        <label>${esc(t('Ajouter un document existant', 'Add existing document'))}
          <select name="document_id" required>
            <option value="">${esc(t('Choisir un document', 'Choose a document'))}</option>
            ${candidates.map((doc) => `<option value="${esc(doc.id)}">${esc(docLabel(doc))}</option>`).join('')}
          </select>
        </label>

        <label>${esc(t('Relation', 'Relation'))}
          <select name="relation_type">
            <option value="invoice">${esc(tr('documents.relation.invoice'))}</option>
            <option value="receipt">${esc(tr('documents.relation.receipt'))}</option>
            <option value="warranty">${esc(tr('documents.relation.warranty'))}</option>
            <option value="proof" selected>${esc(tr('documents.relation.proof'))}</option>
            <option value="other">${esc(tr('documents.relation.other'))}</option>
          </select>
        </label>
      </div>

      <div class="tb-asset-modal-error" data-tb-asset-error role="alert" hidden></div>`,
  });
}
