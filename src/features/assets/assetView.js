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
