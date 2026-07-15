function defaultEsc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function round(value) {
  return Math.round(Number(value) || 0);
}

function hoursLabel(value) {
  const hours = Number(value) || 0;
  if (hours <= 0) return 'Non saisi';
  return `${Math.round(hours * 10) / 10}h`;
}

function goalLabel(health) {
  if (health?.nutritionGoalMode === 'bulk') return `prise de masse +${round(health?.nutritionSurplusKcal)} kcal`;
  if (health?.nutritionGoalMode === 'cut') return `perte douce -${round(health?.nutritionDeficitKcal)} kcal`;
  return 'maintien / recomposition';
}

function sleepDetail(health, esc) {
  const hours = Number(health?.sleepHours) || 0;
  if (hours <= 0) return 'Non saisi';
  const night = String(health?.sleepNightDay || '').slice(5).replace('-', '/');
  return `${Math.round(hours * 10) / 10}h · ${esc(health?.sleepQuality || '')} · nuit du ${esc(night)}`;
}

export function renderKpiResponsiveStyles() {
  return '';
}

export function renderKpiHealthCard({
  healthToday = {},
  healthActions = [],
  esc = defaultEsc,
} = {}) {
  const safe = typeof esc === 'function' ? esc : defaultEsc;
  const actions = Array.isArray(healthActions) ? healthActions : [];
  const color = safe(healthToday.color || '#0ea5e9');
  const score = round(healthToday.score);
  return `<div class="kpi-health-card"><div class="kpi-health-head"><div><div class="muted" style="font-size:12px;">Sante</div><div style="font-weight:900;font-size:22px;line-height:1.15;margin-top:3px;">Suivi du jour</div><div class="muted" style="font-size:12px;margin-top:4px;">Nutrition · sport · travail · sommeil</div></div><span class="pill ${safe(healthToday.level || '')}" style="border-color:${color};color:${color};">${safe(healthToday.label || '')}</span></div><div class="kpi-health-body"><div class="kpi-health-ring" style="background:conic-gradient(${color} ${score}%, rgba(148,163,184,.18) 0);"><div class="kpi-health-ring-inner">${score}<span class="muted" style="font-size:10px;font-weight:700;">/100</span></div></div><div><div class="kpi-health-grid"><div class="kpi-health-metric"><span>Energie a maintenant</span><strong>${round(healthToday.kcal)} / ${round(healthToday.expectedKcalNow)} kcal</strong></div><div class="kpi-health-metric"><span>Balance actuelle</span><strong>${round(healthToday.currentBalance)} kcal</strong></div><div class="kpi-health-metric"><span>Eau bue</span><strong>${round(healthToday.drinkWaterMl)} / 2000 ml</strong></div><div class="kpi-health-metric"><span>Sommeil</span><strong>${hoursLabel(healthToday.sleepHours)}</strong></div></div><div class="muted" style="font-size:12px;margin-top:9px;">${safe(healthToday.advice || '')} Charge: ${round(healthToday.activityKcal)} kcal · Eau aliments: ${round(healthToday.foodWaterMl)} ml.</div><div class="kpi-health-actions">${actions.map((row) => `<div class="kpi-health-action ${safe(row?.tone || '')}"><strong>${safe(row?.title || '')}</strong><span>${safe(row?.body || '')}</span></div>`).join('')}</div><details class="kpi-health-detail"><summary>Comprendre le score</summary><div class="kpi-health-detail-grid"><div>Besoin jour complet: <strong style="color:var(--text);">${round(healthToday.needsKcal)} kcal</strong></div><div>Objectif a cette heure: <strong style="color:var(--text);">${round((Number(healthToday.dayProgress) || 0) * 100)}%</strong></div><div>Score energie: <strong style="color:var(--text);">${round(healthToday.kcalScore)} / 42</strong></div><div>Score eau: <strong style="color:var(--text);">${round(healthToday.hydrationScore)} / 24</strong></div><div>Score proteines: <strong style="color:var(--text);">${round(healthToday.proteinScore)} / 18</strong></div><div>Score sommeil: <strong style="color:var(--text);">${round(healthToday.sleepScore)} / 18</strong></div><div>Score alcool: <strong style="color:var(--text);">${round(healthToday.alcoholScore)} / 10</strong></div><div>Alcool: <strong style="color:var(--text);">${Math.round((Number(healthToday.alcoholDrinks) || 0) * 10) / 10} jour / ${Math.round((Number(healthToday.alcoholWeeklyDrinks) || 0) * 10) / 10} semaine</strong></div><div>Base metabolique: <strong style="color:var(--text);">${round(healthToday.baseline)} kcal</strong></div><div>Sport + travail: <strong style="color:var(--text);">${round(healthToday.activityKcal)} kcal</strong></div><div>Objectif nutrition: <strong style="color:var(--text);">${goalLabel(healthToday)}</strong></div><div>Proteines: <strong style="color:var(--text);">${round(healthToday.protein)} / ${round(healthToday.proteinTarget)}g</strong></div><div>Sommeil: <strong style="color:var(--text);">${sleepDetail(healthToday, safe)}</strong></div></div></details></div></div></div>`;
}

export function renderKpiMiniCard({
  title = '',
  valueHtml = '',
  footerHtml = '',
  extraHtml = '',
  compact = false,
  hidden = false,
  esc = defaultEsc,
} = {}) {
  const safe = typeof esc === 'function' ? esc : defaultEsc;
  return `<div class="kpi-mini-card"${hidden ? ' style="display:none;"' : ''}><div class="muted kpi-mini-title">${safe(title)}</div>${valueHtml ? `<div class="kpi-mini-value${compact ? ' compact' : ''}">${valueHtml}</div>` : ''}${footerHtml ? `<div class="muted kpi-mini-footer">${footerHtml}</div>` : ''}${extraHtml || ''}</div>`;
}

export function renderKpiHeader({
  title = 'KPIs',
  travelOptionHtml = '',
  scopeOptionsHtml = '',
  scopeValue = 'segment',
  helpHtml = '',
  dateISO = '',
  esc = defaultEsc,
} = {}) {
  const safe = typeof esc === 'function' ? esc : defaultEsc;
  const showRange = String(scopeValue || '') === 'range';
  return `<div class="kpi-head"><h2 style="margin:0;">${safe(title)}</h2><div class="kpi-actions"><select id="kpiPeriodSelect" class="kpi-select kpi-period" disabled title="Changer de voyage depuis Settings">${travelOptionHtml}</select><select id="kpiScopeSelect" class="kpi-select">${scopeOptionsHtml}</select>${helpHtml || ''}<div id="kpiRangeBox" class="kpi-range" style="display:${showRange ? 'flex' : 'none'};" data-kpi-range-box="1"><input id="kpiRangeStart" class="kpi-select" type="date" /><span class="muted" style="font-size:12px;">-&gt;</span><input id="kpiRangeEnd" class="kpi-select" type="date" /><button id="kpiRangeApply" class="kpi-input" type="button" style="font-weight:800;cursor:pointer;">Appliquer</button></div><div class="muted" style="font-size:12px;">${safe(dateISO)}</div></div></div>`;
}

export function renderKpiFxCalculator({
  title = 'Convertisseur',
  esc = defaultEsc,
} = {}) {
  const safe = typeof esc === 'function' ? esc : defaultEsc;
  return `<div class="kpi-mini-card"><div class="muted kpi-mini-title">${safe(title)}</div><div class="kpi-fx-row"><input id="kpiFxCalcAmount" class="kpi-input kpi-fx-amount" type="number" inputmode="decimal" placeholder="0" /><select id="kpiFxCalcFrom" class="kpi-input"></select><button id="kpiFxCalcSwap" class="kpi-input" type="button" title="Intervertir les devises" aria-label="Intervertir les devises" style="cursor:pointer;">↔</button><select id="kpiFxCalcTo" class="kpi-input"></select></div><div class="muted" style="font-size:12px;margin-top:8px;"><span id="kpiFxCalcOut">—</span></div></div>`;
}

export function renderKpiPendingDetail({
  items = [],
  max = 8,
  rangeLabel = '',
  detailLabel = 'Detail',
  emptyLabel = 'Aucun element',
  moreLabel = 'autre(s)',
  currency = '',
  amountText,
  esc = defaultEsc,
} = {}) {
  const safe = typeof esc === 'function' ? esc : defaultEsc;
  const list = Array.isArray(items) ? items : [];
  const limit = Math.max(0, Number(max) || 0);
  const shown = list.slice(0, limit);
  const more = Math.max(0, list.length - shown.length);
  const formatAmount = typeof amountText === 'function'
    ? amountText
    : ((value, cur) => `${Math.round(Number(value) || 0)} ${cur || ''}`.trim());

  return `<details class="kpi-pending-detail"><summary>${safe(detailLabel)} <span>${safe(rangeLabel)}</span></summary><div class="kpi-pending-pop">${shown.length ? shown.map((item) => {
          const value = Number(item?.value) || 0;
          return `<div class="kpi-pending-row"><span><strong>${safe(item?.source || '')}</strong><small>${safe(item?.label || '')}${Number(item?.count || 0) > 1 ? ` x${Number(item.count)}` : ''}</small></span><b class="${value >= 0 ? 'pos' : 'neg'}">${safe(formatAmount(value, currency))}</b></div>`;
}).join('') : `<div class="muted" style="font-size:12px;">${safe(emptyLabel)}</div>`}${more > 0 ? `<div class="muted" style="font-size:12px;margin-top:6px;">+${more} ${safe(moreLabel)}</div>` : ''}</div></details>`;
}

export function renderKpiTodayPanel({
  dateISO = '',
  todayLabel = "Aujourd'hui",
  steeringLabel = 'Pilotage',
  dailyBudget = 0,
  base = '',
  todayPillClass = '',
  todayDetailsHtml = '',
  pilot = null,
  recommendedBudgetLabel = 'Budget recommande',
  recommendedBudgetRangeLabel = 'Budget recommande',
  endBalanceLabel = 'Solde fin',
  rangeEndBalanceLabel = 'Solde fin plage',
  estimatedBreakLabel = 'Rupture estimee',
  daysRemainingLabel = 'Jours restants',
  cashLabel = 'Cash',
  daysLabel = 'jours',
  stockLabel = 'Stock',
  burnLabel = 'Burn',
  cashDaysText = '',
  cashLevel = '',
  cashDriver = '',
  cashTotalText = '',
  cashBurnText = '',
  fxNote = '',
  moneyText,
  signPillClass,
  esc = defaultEsc,
} = {}) {
  const safe = typeof esc === 'function' ? esc : defaultEsc;
  const fmtMoney = typeof moneyText === 'function'
    ? moneyText
    : ((value, currency) => `${Math.round(Number(value) || 0)} ${currency || ''}`.trim());
  const signClass = typeof signPillClass === 'function'
    ? signPillClass
    : (() => '');

  return `<div class="kpi-mini-card"><div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px;"><div><div style="font-weight:800; font-size:16px; color:var(--text);">${safe(todayLabel)}</div><div class="muted" style="font-size:12px; margin-top:2px;">${safe(dateISO)}</div></div><span class="pill ${safe(todayPillClass)}"><span class="dot"></span>${Number(dailyBudget || 0).toFixed(0)} ${safe(base)}</span></div>${todayDetailsHtml || ''}${pilot ? `<div style="margin-top:14px; padding-top:12px; border-top:1px solid rgba(0,0,0,0.06);"><div style="display:flex; justify-content:space-between; align-items:baseline; gap:12px;"><div style="font-weight:800; font-size:16px; color:var(--text);">${safe(steeringLabel)}</div><span class="pill ${safe(pilot.decisionLevel || '')}"><span class="dot"></span>${safe(pilot.decision || '')}</span></div><div class="muted" style="font-size:12px; margin-top:8px;"><div style="display:flex; justify-content:space-between; gap:10px;"><span>${safe(pilot.kind === 'range' ? recommendedBudgetRangeLabel : recommendedBudgetLabel)}</span><strong style="color:var(--text);">${safe(fmtMoney(pilot.recommendedDaily, pilot.base))}/j</strong></div><div style="display:flex; justify-content:space-between; gap:10px; margin-top:6px;"><span>${safe(pilot.kind === 'range' ? rangeEndBalanceLabel : endBalanceLabel)}</span><span class="pill ${safe(signClass(pilot.projectedEndBalance))}" style="padding:4px 10px;"><span class="dot"></span>${safe(fmtMoney(pilot.projectedEndBalance, pilot.base))}</span></div>${pilot.kind === 'range' ? '' : `<div style="display:flex; justify-content:space-between; gap:10px; margin-top:6px;"><span>${safe(estimatedBreakLabel)}</span><strong style="color:var(--text);">${safe(pilot.zeroDate || '')}</strong></div><div style="display:flex; justify-content:space-between; gap:10px; margin-top:6px;"><span>${safe(daysRemainingLabel)}</span><strong style="color:var(--text);">${safe(pilot.daysRemaining ?? '')}</strong></div>
            `}</div></div>
      ` : ''}<div style="margin-top:14px; padding-top:12px; border-top:1px solid rgba(0,0,0,0.06);"><div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px;"><div><div class="muted" style="font-size:12px;">${safe(cashLabel)}</div><div style="display:flex; align-items:baseline; gap:8px; margin-top:6px;"><div style="font-weight:900; font-size:30px; line-height:1; color:var(--text);">${safe(cashDaysText)}</div><div class="muted" style="font-weight:700;">${safe(daysLabel)}</div></div></div><span class="pill ${safe(cashLevel)}"><span class="dot"></span>${safe(cashDriver)}</span></div><div class="muted" style="font-size:12px; margin-top:8px; display:flex; flex-wrap:wrap; gap:8px 14px;"><span>${safe(stockLabel)} : <strong style="color:var(--text);">${safe(cashTotalText)}</strong></span><span>${safe(burnLabel)} : <strong style="color:var(--text);">${safe(cashBurnText)}/j</strong></span></div>${fxNote ? `<div class="muted" style="font-size:12px; margin-top:6px; color:var(--warn);">${safe(fxNote)}</div>` : ''}</div></div>`;
}
