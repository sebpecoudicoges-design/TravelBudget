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
