function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function translate(t, key, vars) {
  return typeof t === 'function' ? t(key, vars) : key;
}

export function buildAnalysisOverviewCards({
  model = {},
  travel = null,
  periodId = 'active',
  scope = 'budget',
  mode = 'planned',
  currencyMode = 'account',
  t,
} = {}) {
  const rangeText = `${model.start || '-'} -> ${model.end || '-'}`;
  const scopeText = scope === 'all'
    ? translate(t, 'analysis.scope.budget_out')
    : (scope === 'out' ? translate(t, 'analysis.scope.out') : translate(t, 'analysis.scope.budget'));
  const modeText = mode === 'expenses'
    ? translate(t, 'analysis.mode.expenses')
    : translate(t, 'analysis.mode.planned');
  const periodText = periodId === 'active'
    ? translate(t, 'analysis.period.active')
    : (periodId === 'all'
      ? translate(t, 'analysis.period.all_trip')
      : (periodId === 'range' ? translate(t, 'analysis.filter.range') : translate(t, 'analysis.period.targeted')));
  const dayCount = Array.isArray(model.days) ? model.days.length : 0;
  const txCount = Array.isArray(model.txs) ? model.txs.length : 0;

  return [
    {
      label: translate(t, 'analysis.filter.travel'),
      value: String(travel?.name || translate(t, 'analysis.trip.active')),
      meta: `${periodText} - ${rangeText}`,
      accent: 'travel',
    },
    {
      label: translate(t, 'analysis.overview.reading'),
      value: scopeText,
      meta: `${modeText} - ${translate(t, 'analysis.days_analyzed', { count: dayCount })}`,
      accent: 'scope',
    },
    {
      label: translate(t, 'analysis.filter.currency'),
      value: String(model.base || '').toUpperCase(),
      meta: currencyMode === 'account'
        ? translate(t, 'analysis.currency.account_pivot')
        : translate(t, 'analysis.currency.period_segment'),
      accent: 'currency',
    },
    {
      label: translate(t, 'analysis.overview.coverage'),
      value: translate(t, 'analysis.expenses_count', { count: txCount }),
      meta: Number(model.comparableDays) > 0
        ? translate(t, 'analysis.reference.comparable_days', { count: Number(model.comparableDays) })
        : translate(t, 'analysis.reference.missing_range'),
      accent: 'coverage',
    },
  ];
}

export function renderAnalysisOverviewStrip(options = {}) {
  return buildAnalysisOverviewCards(options).map((card) => `
      <div class="analysis-overview-card analysis-overview-card--${escapeHtml(card.accent)}">
        <div class="analysis-overview-label">${escapeHtml(card.label)}</div>
        <div class="analysis-overview-value">${escapeHtml(card.value)}</div>
        <div class="analysis-overview-meta">${escapeHtml(card.meta)}</div>
      </div>
    `).join('');
}
