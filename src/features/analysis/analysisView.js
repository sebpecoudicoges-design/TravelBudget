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

function safeNum(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function formatMoney(formatter, value, currency) {
  if (typeof formatter === 'function') return formatter(value, currency);
  return `${safeNum(value).toFixed(2)} ${String(currency || '').trim()}`.trim();
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

export function buildAnalysisInsights({
  model = {},
  isEn = false,
  formatCurrency,
} = {}) {
  const day = isEn ? 'day' : 'jour';
  const money = (value) => formatMoney(formatCurrency, value, model.base);
  const projection = safeNum(model.projection);
  const totalBudget = safeNum(model.totalBudget);
  const comparablePerDay = safeNum(model.comparablePerDay);
  const referencePerDay = safeNum(model.referencePerDay);
  const avgPerDay = safeNum(model.avgPerDay);
  const budgetPerDay = safeNum(model.budgetPerDay);
  const spent = Math.max(safeNum(model.spent), 1);
  const outAmount = safeNum(model.outAmount);
  const excludedPerDay = safeNum(model.excludedPerDay);
  const nightCoveredCount = safeNum(model.nightCoveredCount);
  const delta = projection - totalBudget;
  const sourcedGap = comparablePerDay - referencePerDay;
  const top = Array.isArray(model.topCategories) ? model.topCategories[0] : null;
  const topUnmapped = Array.isArray(model.unmappedCategorySeries) ? model.unmappedCategorySeries[0] : null;
  const nightLine = nightCoveredCount > 0
    ? {
        icon: '🌙',
        title: isEn ? `Night transports: ${nightCoveredCount} case(s)` : `Transports de nuit : ${nightCoveredCount} cas`,
        body: isEn
          ? `${money(model.nightCoveredPotentialSavings)} in potential accommodation savings remains visible separately, without adjusting the main budget.`
          : `${money(model.nightCoveredPotentialSavings)} d'économie potentielle logement restent visibles à part, sans corriger le budget principal.`,
      }
    : null;

  const insights = [
    ...(nightLine ? [nightLine] : []),
    {
      icon: sourcedGap > 0 ? '🧭' : '🌿',
      title: sourcedGap > 0
        ? (isEn ? 'Actual above reference' : 'Réel au-dessus du sourcé')
        : (isEn ? 'Actual below reference' : 'Réel sous le sourcé'),
      body: sourcedGap > 0
        ? (isEn
            ? `On the comparable scope, you spend ${money(comparablePerDay)}/${day} versus a country reference of ${money(referencePerDay)}/${day}, so ${money(sourcedGap)}/${day} above.`
            : `Sur le périmètre comparable, tu dépenses ${money(comparablePerDay)}/jour contre une référence pays de ${money(referencePerDay)}/jour, soit ${money(sourcedGap)}/jour au-dessus.`)
        : (isEn
            ? `On the comparable scope, you spend ${money(comparablePerDay)}/${day} versus a country reference of ${money(referencePerDay)}/${day}, so ${money(Math.abs(sourcedGap))}/${day} below.`
            : `Sur le périmètre comparable, tu dépenses ${money(comparablePerDay)}/jour contre une référence pays de ${money(referencePerDay)}/jour, soit ${money(Math.abs(sourcedGap))}/jour en dessous.`),
    },
    {
      icon: avgPerDay > budgetPerDay ? '⚠️' : '✅',
      title: avgPerDay > budgetPerDay
        ? (isEn ? 'Pace above target' : 'Cadence au-dessus de la cible')
        : (isEn ? 'Pace under control' : 'Cadence maîtrisée'),
      body: avgPerDay > budgetPerDay
        ? (isEn
            ? `Overall, you are running at ${money(avgPerDay)}/${day} for an app target of ${money(budgetPerDay)}/${day}. On the referenced comparable scope, you are at ${money(comparablePerDay)}/${day}.`
            : `Globalement, tu tournes à ${money(avgPerDay)}/jour pour une cible app de ${money(budgetPerDay)}/jour. Sur le comparable sourcé, tu es à ${money(comparablePerDay)}/jour.`)
        : (isEn
            ? `Overall, you stay below target with ${money(avgPerDay)}/${day} versus ${money(budgetPerDay)}/${day} targeted. On the referenced comparable scope, you are at ${money(comparablePerDay)}/${day}.`
            : `Globalement, tu restes sous la cible avec ${money(avgPerDay)}/jour contre ${money(budgetPerDay)}/jour visés. Sur le comparable sourcé, tu es à ${money(comparablePerDay)}/jour.`),
    },
    {
      icon: top ? '🧲' : '•',
      title: top ? `${isEn ? 'Dominant category' : 'Catégorie dominante'} : ${top[0]}` : (isEn ? 'No dominant category' : 'Aucune catégorie dominante'),
      body: top
        ? (isEn
            ? `${money(top[1])} committed, ${((safeNum(top[1]) / spent) * 100).toFixed(1)}% of the analyzed total.`
            : `${money(top[1])} engagés, soit ${((safeNum(top[1]) / spent) * 100).toFixed(1)}% du total analysé.`)
        : (isEn ? 'Add a few expenses to reveal trends.' : 'Ajoute quelques dépenses pour faire émerger les tendances.'),
    },
    {
      icon: delta > 0 ? '📈' : '🌿',
      title: delta > 0 ? (isEn ? 'Projection above cap' : 'Projection au-dessus du cap') : (isEn ? 'Projection on track' : 'Projection dans la trajectoire'),
      body: delta > 0
        ? (isEn
            ? `At the current pace, you would end at ${money(projection)}, ${money(delta)} above budget.`
            : `Au rythme actuel, tu finirais à ${money(projection)}, soit ${money(delta)} au-dessus du budget.`)
        : (isEn
            ? `The projection ends at ${money(projection)}. You keep a margin of about ${money(Math.abs(delta))}.`
            : `La projection termine à ${money(projection)}. Tu gardes une marge d’environ ${money(Math.abs(delta))}.`),
    },
    {
      icon: topUnmapped ? '🧩' : (excludedPerDay > 0 ? '🪶' : (outAmount > 0 ? '🎯' : '🧭')),
      title: topUnmapped
        ? `${isEn ? 'Map next' : 'À mapper ensuite'} : ${topUnmapped.name}`
        : (excludedPerDay > 0
            ? (isEn ? 'Comparable view cleaned from exclusions' : 'Comparatif nettoyé des exclus')
            : (outAmount > 0
                ? (isEn ? 'Out-of-budget visible' : 'Hors budget visible')
                : (isEn ? 'Clean budget reading' : 'Lecture budgétaire propre'))),
      body: topUnmapped
        ? (isEn
            ? `${money(topUnmapped.actual)} remains in an unmapped category. It stays visible separately and does not mix into the mapped comparison.`
            : `${money(topUnmapped.actual)} restent dans une catégorie non référencée. Elle est visible à part et ne se mélange pas au comparatif mappé.`)
        : (excludedPerDay > 0
            ? (isEn
                ? `${money(excludedPerDay)}/${day} are excluded from the referenced comparison by the centralized mapping, while remaining visible in the global steering view.`
                : `${money(excludedPerDay)}/jour sont exclus du comparatif sourcé selon le mapping centralisé, tout en restant visibles dans le pilotage global.`)
            : (outAmount > 0
                ? (isEn
                    ? `${money(outAmount)} out of budget on the range. You can exclude categories without polluting the trajectory.`
                    : `${money(outAmount)} hors budget sur la plage. Tu peux exclure des catégories sans polluer la trajectoire.`)
                : (isEn ? 'No notable out-of-budget expense on the current range.' : 'Aucune dépense hors budget notable sur la plage courante.'))),
    },
  ];

  return {
    insights,
    livePill: isEn
      ? `${Array.isArray(model.txs) ? model.txs.length : 0} expenses • ${Array.isArray(model.days) ? model.days.length : 0} days • ${model.base || ''}`
      : `${Array.isArray(model.txs) ? model.txs.length : 0} dépenses • ${Array.isArray(model.days) ? model.days.length : 0} jours • ${model.base || ''}`,
  };
}

export function renderAnalysisInsights(options = {}) {
  return buildAnalysisInsights(options).insights.map((item) => `
      <div class="analysis-insight">
        <div class="analysis-insight-badge">${escapeHtml(item.icon)}</div>
        <div>
          <p class="analysis-insight-title">${escapeHtml(item.title)}</p>
          <p class="analysis-insight-body">${escapeHtml(item.body)}</p>
        </div>
      </div>
    `).join('');
}

export function buildAnalysisNightCoveredRows(model = {}) {
  return (Array.isArray(model.nightCoveredRows) ? model.nightCoveredRows : [])
    .slice()
    .sort((a, b) => String(b?.date || '').localeCompare(String(a?.date || '')))
    .slice(0, 6);
}

export function renderAnalysisNightCovered({
  model = {},
  formatCurrency,
} = {}) {
  const count = safeNum(model.nightCoveredCount);
  const money = (value) => formatMoney(formatCurrency, value, model.base);

  if (!count) {
    return `<div class="muted">Aucun transport marqué comme remplaçant une nuit d'hébergement sur la plage analysée.</div>`;
  }

  const rows = buildAnalysisNightCoveredRows(model);
  return `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:14px;">
        <div style="padding:12px 14px;border:1px solid var(--border);border-radius:18px;background:linear-gradient(180deg, rgba(59,130,246,.08), rgba(255,255,255,.5));">
          <div class="muted" style="font-size:12px;">Transports concernés</div>
          <div style="font-size:24px;font-weight:800;">${count}</div>
        </div>
        <div style="padding:12px 14px;border:1px solid var(--border);border-radius:18px;background:linear-gradient(180deg, rgba(16,185,129,.10), rgba(255,255,255,.5));">
          <div class="muted" style="font-size:12px;">Économie potentielle logement</div>
          <div style="font-size:24px;font-weight:800;">${escapeHtml(money(model.nightCoveredPotentialSavings))}</div>
        </div>
        <div style="padding:12px 14px;border:1px solid var(--border);border-radius:18px;background:linear-gradient(180deg, rgba(245,158,11,.10), rgba(255,255,255,.5));">
          <div class="muted" style="font-size:12px;">Moyenne par nuit remplacée</div>
          <div style="font-size:24px;font-weight:800;">${escapeHtml(money(model.nightCoveredAverageSaving))}</div>
        </div>
      </div>
      <div class="muted" style="margin-bottom:10px;font-size:12px;line-height:1.45;">Signal analytique uniquement : ces montants n'altèrent ni le budget, ni les KPI, ni la projection. Ils servent à expliquer le logement potentiellement évité par des transports de nuit.</div>
      <div style="display:grid;gap:8px;">
        ${rows.map((row) => `
          <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;padding:10px 0;border-top:1px solid var(--border);">
            <div style="min-width:0;">
              <div style="font-weight:700;">${escapeHtml(row?.label)}</div>
              <div class="muted" style="font-size:12px;">${escapeHtml(row?.date)} • ${escapeHtml(row?.category)}</div>
            </div>
            <div style="text-align:right;white-space:nowrap;">
              <div style="font-weight:700;">${escapeHtml(money(row?.saving))}</div>
              <div class="muted" style="font-size:12px;">transport ${escapeHtml(money(row?.spent))}</div>
            </div>
          </div>`).join('')}
      </div>`;
}

export function buildAnalysisSubcategoryRows(model = {}) {
  return (Array.isArray(model.subcategorySeries) ? model.subcategorySeries : []).slice(0, 10);
}

export function renderAnalysisSubcategoryBreakdown({
  model = {},
  formatCurrency,
  accent = '#3b82f6',
} = {}) {
  const rows = buildAnalysisSubcategoryRows(model);
  const money = (value) => formatMoney(formatCurrency, value, model.base);

  if (!rows.length) {
    return `<div class="muted">Aucune sous-catégorie exploitée sur la plage actuelle.</div>`;
  }

  return rows.map((row, idx) => `
    <div class="tb-analysis-clickable" data-subkey="${escapeHtml(row?.key)}" style="display:flex;align-items:center;gap:10px;justify-content:space-between;padding:8px 8px;border-radius:14px;border:1px solid transparent;border-top:${idx ? '1px solid var(--border)' : '1px solid transparent'};">
      <div style="display:flex;align-items:center;gap:10px;min-width:0;">
        <span style="display:inline-block;width:10px;height:10px;border-radius:999px;background:${escapeHtml(row?.color || accent)};flex:0 0 auto;"></span>
        <div style="min-width:0;">
          <div style="font-weight:600;">${escapeHtml(row?.subcategoryName || 'Sans sous-catégorie')}</div>
          <div class="muted" style="font-size:12px;">${escapeHtml(row?.categoryName || 'Autre')}</div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;white-space:nowrap;">
        <div style="font-weight:700;">${escapeHtml(money(row?.actual))}</div>
        <button type="button" class="tb-analysis-detail-btn">Détail</button>
      </div>
    </div>
  `).join('');
}
