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

function clampPct(value) {
  return Math.max(0, Math.min(100, safeNum(value)));
}

function formatSignedPct(value) {
  const pct = safeNum(value);
  const abs = Math.abs(pct);
  const decimals = abs >= 10 ? 0 : 1;
  const rounded = Number(pct.toFixed(decimals));
  const prefix = rounded > 0 ? '+' : '';
  return `${prefix}${rounded.toFixed(decimals).replace('.', ',')} %`;
}

function deltaAmountText({ amount, positiveLabel, negativeLabel, neutralLabel, formatCurrency, currency }) {
  const value = safeNum(amount);
  const money = (n) => formatMoney(formatCurrency, n, currency);
  if (Math.abs(value) < 0.005) return `${neutralLabel} : ${money(0)}`;
  return `${value > 0 ? positiveLabel : negativeLabel} : ${money(Math.abs(value))}`;
}

export function renderAnalysisProgressGlassCard(card = {}, idx = 0) {
  const pct = clampPct(card.pct);
  const liquidTop = Math.max(0, 100 - pct);
  return `
      <div class="analysis-stat analysis-stat--glass analysis-stat--glass-${escapeHtml(card.tint)}" title="${escapeHtml(card.title)}" style="animation:analysisGrow .55s ease ${idx * 60}ms both; position:relative; isolation:isolate; overflow:hidden; padding:18px 18px 16px; border-radius:24px; border:1px solid rgba(255,255,255,.74); background:linear-gradient(180deg, rgba(255,255,255,.98), rgba(255,255,255,.90)); box-shadow:0 14px 34px rgba(148,163,184,.16), inset 0 1px 0 rgba(255,255,255,.88); min-height:196px; display:flex; flex-direction:column; justify-content:space-between; gap:14px;">
        <span aria-hidden="true" style="position:absolute; inset:0; border-radius:inherit; background:radial-gradient(circle at 20% 12%, rgba(255,255,255,.94), rgba(255,255,255,0) 36%), radial-gradient(circle at 82% 18%, ${escapeHtml(card.glow)}, rgba(255,255,255,0) 38%), linear-gradient(180deg, rgba(255,255,255,.76), rgba(255,255,255,.36)); pointer-events:none;"></span>
        <span aria-hidden="true" style="position:absolute; left:10px; right:10px; bottom:10px; top:10px; border-radius:20px; background:rgba(255,255,255,.16); border:1px solid ${escapeHtml(card.shell)}; box-shadow:inset 0 0 0 1px rgba(255,255,255,.24); pointer-events:none;"></span>
        <span aria-hidden="true" style="position:absolute; left:10px; right:10px; bottom:10px; height:${pct}%; min-height:${pct > 0 ? 20 : 0}px; border-radius:0 0 20px 20px; overflow:hidden; pointer-events:none;">
          <span style="position:absolute; inset:0; background:${escapeHtml(card.liquid)};"></span>
          <span class="tb-water-glow" style="position:absolute; inset:0; background:linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,.18), rgba(255,255,255,0)); filter:blur(1px); animation:tbWaterGlow 6.2s linear infinite;"></span>
          <svg class="tb-water-wave-back" viewBox="0 0 240 28" preserveAspectRatio="none" style="position:absolute; left:-6px; bottom:0px; width:calc(100% + 140px); height:36px; opacity:.55; animation:tbWaveDriftBack 7.2s linear infinite;">
            <path d="M0,16 C20,8 40,8 60,16 C80,24 100,24 120,16 C140,8 160,8 180,16 C200,24 220,24 240,16 L240,28 L0,28 Z" fill="rgba(255,255,255,.45)"></path>
          </svg>
          <svg class="tb-water-wave-front" viewBox="0 0 320 34" preserveAspectRatio="none" style="position:absolute; left:-8px; bottom:0px; width:calc(100% + 180px); height:42px; opacity:.92; animation:tbWaveDriftFront 5.1s linear infinite;">
            <path d="M0,18 C24,8 48,8 72,18 C96,28 120,28 144,18 C168,8 192,8 216,18 C240,28 264,28 288,18 C304,12 312,12 320,18 L320,34 L0,34 Z" fill="rgba(255,255,255,.65)"></path>
          </svg>
          <span class="tb-water-bubble" style="position:absolute; left:18%; bottom:12px; width:6px; height:6px; border-radius:999px; background:rgba(255,255,255,.14); animation:tbBubbleRise 5.0s ease-in infinite;"></span>
          <span class="tb-water-bubble" style="position:absolute; left:61%; bottom:10px; width:4px; height:4px; border-radius:999px; background:rgba(255,255,255,.12); animation:tbBubbleRise 6.0s ease-in infinite 1.2s;"></span>
          <span class="tb-water-bubble" style="position:absolute; left:77%; bottom:14px; width:5px; height:5px; border-radius:999px; background:rgba(255,255,255,.10); animation:tbBubbleRise 5.6s ease-in infinite 2.0s;"></span>
        </span>
        <span aria-hidden="true" style="position:absolute; left:10px; right:10px; top:calc(${liquidTop}% - 2px); height:24px; pointer-events:none; opacity:${pct > 3 ? '.98' : '0'};">
          <svg viewBox="0 0 320 24" preserveAspectRatio="none" style="width:100%; height:100%; display:block;">
            <path d="M0,14 C28,6 56,6 84,14 C112,22 140,22 168,14 C196,6 224,6 252,14 C280,22 300,22 320,14" fill="none" stroke="rgba(255,255,255,.95)" stroke-width="4" stroke-linecap="round"></path>
            <path d="M0,16 C28,9 56,9 84,16 C112,23 140,23 168,16 C196,9 224,9 252,16 C280,23 300,23 320,16" fill="none" stroke="rgba(255,255,255,.34)" stroke-width="6" stroke-linecap="round" style="filter:blur(2px);"></path>
          </svg>
        </span>
        <span aria-hidden="true" style="position:absolute; left:26px; top:26px; bottom:26px; width:18px; border-radius:999px; background:${escapeHtml(card.haze)}; opacity:.58; pointer-events:none;"></span>
        <div style="position:relative; z-index:1; display:flex; align-items:flex-start; justify-content:space-between; gap:10px;">
          <div>
            <div class="analysis-stat-label" style="font-size:12px; letter-spacing:.06em; text-transform:uppercase; color:rgba(15,23,42,.72);">${escapeHtml(card.label)}</div>
            <div class="analysis-stat-meta" style="margin-top:4px; font-size:12px; color:rgba(15,23,42,.58);">${escapeHtml(card.hint)}</div>
          </div>
          <div style="font-size:11px; font-weight:800; color:rgba(15,23,42,.60);">${pct.toFixed(0)}%</div>
        </div>
        <div style="position:relative; z-index:1; display:flex; flex-direction:column; justify-content:flex-end; gap:8px; min-width:0; flex:1;">
          <div class="analysis-stat-value" style="font-size:25px; line-height:1.14; color:#0f172a; text-shadow:0 1px 0 rgba(255,255,255,.40);">${escapeHtml(card.value)}</div>
          <div class="analysis-stat-meta" style="font-size:12px; color:rgba(15,23,42,.66);">${escapeHtml(card.footer)}</div>
        </div>
      </div>`;
}

export function renderAnalysisProgressDeltaCard({
  idx = 0,
  deltaBudgetTone = '#94a3b8',
  deltaBudgetPct = 0,
  deltaBudgetAmount = 0,
  deltaReferenceTone = '#94a3b8',
  deltaReferencePct = 0,
  deltaReferenceAmount = 0,
  isEn = false,
  formatCurrency,
  currency,
} = {}) {
  const tr = (fr, en) => (isEn ? en : fr);
  return `
      <div class="analysis-stat analysis-stat--delta" style="animation:analysisGrow .55s ease ${idx * 60}ms both; position:relative; overflow:hidden; padding:18px 18px 16px; border-radius:24px; border:1px solid rgba(255,255,255,.68); background:linear-gradient(180deg, rgba(255,255,255,.96), rgba(255,255,255,.88)); box-shadow:0 14px 34px rgba(148,163,184,.16), inset 0 1px 0 rgba(255,255,255,.84); min-height:196px; display:flex; flex-direction:column; justify-content:space-between; gap:14px;">
        <span aria-hidden="true" style="position:absolute; inset:0; border-radius:inherit; background:radial-gradient(circle at 18% 14%, rgba(255,255,255,.92), rgba(255,255,255,0) 34%), linear-gradient(180deg, rgba(255,255,255,.72), rgba(255,255,255,.34)); pointer-events:none;"></span>
        <div style="position:relative; z-index:1;">
          <div class="analysis-stat-label" style="font-size:12px; letter-spacing:.06em; text-transform:uppercase; color:rgba(15,23,42,.72);">${escapeHtml(tr('Écart de tendance', 'Trend gap'))}</div>
          <div class="analysis-stat-meta" style="margin-top:4px; font-size:12px; color:rgba(15,23,42,.58);">${escapeHtml(tr('Projection finale comparée au budget app et à la référence pays.', 'Final projection compared with app budget and country reference.'))}</div>
        </div>
        <div style="position:relative; z-index:1; display:flex; flex-direction:column; gap:12px;">
          <div style="padding:12px 14px; border-radius:16px; background:linear-gradient(180deg, rgba(255,255,255,.72), rgba(255,255,255,.38)); border:1px solid rgba(255,255,255,.78); box-shadow:inset 0 1px 0 rgba(255,255,255,.78);">
            <div style="font-size:12px; color:rgba(15,23,42,.58);">${escapeHtml(tr('Vs budget app', 'Vs app budget'))}</div>
            <div style="margin-top:4px; font-size:24px; font-weight:800; color:${escapeHtml(deltaBudgetTone)};">${escapeHtml(formatSignedPct(deltaBudgetPct))}</div>
            <div style="margin-top:4px; font-size:12px; font-weight:750; color:rgba(15,23,42,.62);">${escapeHtml(deltaAmountText({
              amount: deltaBudgetAmount,
              positiveLabel: tr('Dépassement', 'Over budget'),
              negativeLabel: tr('Économisé', 'Saved'),
              neutralLabel: tr('Écart', 'Gap'),
              formatCurrency,
              currency,
            }))}</div>
          </div>
          <div style="padding:12px 14px; border-radius:16px; background:linear-gradient(180deg, rgba(255,255,255,.72), rgba(255,255,255,.38)); border:1px solid rgba(255,255,255,.78); box-shadow:inset 0 1px 0 rgba(255,255,255,.78);">
            <div style="font-size:12px; color:rgba(15,23,42,.58);">${escapeHtml(tr('Vs référence pays', 'Vs country reference'))}</div>
            <div style="margin-top:4px; font-size:24px; font-weight:800; color:${escapeHtml(deltaReferenceTone)};">${escapeHtml(formatSignedPct(deltaReferencePct))}</div>
            <div style="margin-top:4px; font-size:12px; font-weight:750; color:rgba(15,23,42,.62);">${escapeHtml(deltaAmountText({
              amount: deltaReferenceAmount,
              positiveLabel: tr('Au-dessus', 'Above'),
              negativeLabel: tr('Sous référence', 'Below reference'),
              neutralLabel: tr('Écart', 'Gap'),
              formatCurrency,
              currency,
            }))}</div>
          </div>
        </div>
      </div>`;
}

export function renderAnalysisProgressPanels({
  progressCards = [],
  delta = {},
  cashflowBlock = '',
  unpaidBlock = '',
  cashOnlyBlock = '',
  formatCurrency,
  currency,
  isEn = false,
} = {}) {
  const cards = (Array.isArray(progressCards) ? progressCards : [])
    .map((card, idx) => renderAnalysisProgressGlassCard(card, idx))
    .join('');
  const deltaCard = renderAnalysisProgressDeltaCard({
    ...delta,
    idx: Array.isArray(progressCards) ? progressCards.length : 0,
    formatCurrency,
    currency,
    isEn,
  });
  return `${cards}${deltaCard}${cashflowBlock || ''}${unpaidBlock || ''}${cashOnlyBlock || ''}`;
}

export function buildAnalysisReferenceContext(model = {}) {
  const country = model.referenceContext?.countryLabel && model.referenceContext.countryLabel !== 'Pays —'
    ? model.referenceContext.countryLabel
    : 'Aucune référence pays active';
  const profile = model.referenceContext?.profileLabel && model.referenceContext.profileLabel !== 'Profil —'
    ? model.referenceContext.profileLabel
    : null;
  const style = model.referenceContext?.styleLabel && model.referenceContext.styleLabel !== 'Style —'
    ? model.referenceContext.styleLabel
    : null;
  const adults = model.referenceContext?.adultsLabel && model.referenceContext.adultsLabel !== 'ad. —'
    ? String(model.referenceContext.adultsLabel).replace('ad.', 'adulte(s)')
    : null;
  const children = model.referenceContext?.childrenLabel && model.referenceContext.childrenLabel !== 'enf. —'
    ? String(model.referenceContext.childrenLabel).replace('enf.', 'enfant(s)')
    : null;

  return [
    country,
    profile && `Profil ${profile}`,
    style && `Style ${style}`,
    adults,
    children,
  ].filter(Boolean).join(' • ');
}

export function buildAnalysisReferenceRows(model = {}) {
  return (Array.isArray(model.referenceComparisonSeries) ? model.referenceComparisonSeries : [])
    .filter((row) => safeNum(row?.actualPerDay) > 0 || safeNum(row?.referencePerDay) > 0);
}

export function renderAnalysisReferenceSummary({
  model = {},
  formatCurrency,
} = {}) {
  const money = (value) => formatMoney(formatCurrency, value, model.base);
  const days = Array.isArray(model.days) ? model.days.length : 0;
  const coverage = model.referenceCoverageDays && days ? `${model.referenceCoverageDays}/${days} jours couverts` : 'Aucune source active';
  const delta = safeNum(model.comparablePerDay) - safeNum(model.referencePerDay);
  const deltaTone = delta <= 0 ? 'Sous la référence' : 'Au-dessus de la référence';
  const context = buildAnalysisReferenceContext(model);

  return `
        <div class="analysis-reference-stat">
          <span>Sourcé / jour</span>
          <strong>${escapeHtml(money(model.referencePerDay))}</strong>
          <small>${escapeHtml(coverage)}</small>
        </div>
        <div class="analysis-reference-stat">
          <span>Réel / jour</span>
          <strong>${escapeHtml(money(model.comparablePerDay))}</strong>
          <small>Comparatif net des catégories exclues</small>
        </div>
        <div class="analysis-reference-stat">
          <span>Écart / jour</span>
          <strong>${escapeHtml(money(delta))}</strong>
          <small>${escapeHtml(deltaTone)}</small>
        </div>
                <div class="analysis-reference-inline">
          <div class="analysis-reference-context" style="font-size:1rem;font-weight:700;line-height:1.35;padding:.7rem .9rem;border-radius:16px;background:rgba(148,163,184,.10);border:1px solid rgba(148,163,184,.18);">
            Contexte : ${escapeHtml(context)}
          </div>
        </div>`;
}

export function renderAnalysisReferenceMix({
  model = {},
  formatCurrency,
} = {}) {
  const rows = buildAnalysisReferenceRows(model);
  const money = (value) => formatMoney(formatCurrency, value, model.base);

  if (!rows.length) {
    return `<div class="analysis-reference-empty">Aucune référence pays active sur cette plage.</div>`;
  }

  return `
      <div class="analysis-reference-metal-grid">
        ${rows.map((row) => {
          const ref = safeNum(row?.referencePerDay);
          const actual = safeNum(row?.actualPerDay);
          const diff = actual - ref;
          const tone = diff <= 0 ? 'good' : 'warn';
          return `<div class="analysis-reference-metal analysis-reference-metal--${tone}">
            <div class="analysis-reference-metal-head">
              <span>${escapeHtml(row?.name)}</span>
              <strong>${escapeHtml(money(diff))}</strong>
            </div>
            <div class="analysis-reference-metal-body">
              <div><small>Réel / jour</small><b>${escapeHtml(money(actual))}</b></div>
              <div><small>Sourcé / jour</small><b>${escapeHtml(money(ref))}</b></div>
            </div>
          </div>`;
        }).join('')}
        ${safeNum(model.unmappedPerDay) > 0 ? `<div class="analysis-reference-metal analysis-reference-metal--neutral">
          <div class="analysis-reference-metal-head">
            <span>Non référencé</span>
            <strong>${escapeHtml(money(model.unmappedPerDay))}</strong>
          </div>
          <div class="analysis-reference-metal-body">
            <div><small>Réel / jour</small><b>${escapeHtml(money(model.unmappedPerDay))}</b></div>
            <div><small>Sourcé / jour</small><b>${escapeHtml(money(0))}</b></div>
          </div>
        </div>` : ''}
        ${safeNum(model.excludedPerDay) > 0 ? `<div class="analysis-reference-metal analysis-reference-metal--neutral">
          <div class="analysis-reference-metal-head">
            <span>Exclu du comparatif</span>
            <strong>${escapeHtml(money(model.excludedPerDay))}</strong>
          </div>
          <div class="analysis-reference-metal-body">
            <div><small>Réel / jour</small><b>${escapeHtml(money(model.excludedPerDay))}</b></div>
            <div><small>Traitement</small><b>Hors comparaison sourcée</b></div>
          </div>
        </div>` : ''}
      </div>`;
}
