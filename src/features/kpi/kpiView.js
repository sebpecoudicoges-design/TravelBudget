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
  return `
    .kpi-layout { grid-template-columns: minmax(360px, 470px) minmax(0, 1fr); }
    .kpi-mini-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap:14px; }
    .kpi-health-card { grid-column:1 / -1; border:1px solid rgba(148,163,184,.22); border-radius:16px; padding:14px; background:linear-gradient(135deg,rgba(56,189,248,.07),rgba(34,197,94,.05)),var(--panel2); box-shadow:0 14px 32px rgba(15,23,42,.07); }
    .kpi-health-head { display:flex; align-items:center; justify-content:space-between; gap:12px; }
    .kpi-health-body { display:grid; grid-template-columns:84px 1fr; gap:12px; align-items:center; margin-top:12px; }
    .kpi-health-ring { width:84px; aspect-ratio:1; border-radius:50%; display:grid; place-items:center; box-shadow:inset 0 0 0 1px rgba(148,163,184,.18); }
    .kpi-health-ring-inner { width:60px; aspect-ratio:1; border-radius:50%; background:var(--panel); border:1px solid var(--border); display:grid; place-items:center; text-align:center; font-weight:900; color:var(--text); }
    .kpi-health-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:8px; }
    .kpi-health-metric { border:1px solid var(--border); border-radius:10px; padding:9px; background:var(--panel); min-width:0; }
    .kpi-health-metric span { display:block; font-size:11px; color:var(--muted); }
    .kpi-health-metric strong { display:block; margin-top:3px; font-size:13px; color:var(--text); overflow-wrap:anywhere; }
    .kpi-health-detail { margin-top:10px; border-top:1px solid var(--border); padding-top:9px; }
    .kpi-health-detail summary { cursor:pointer; font-size:12px; color:var(--muted); }
    .kpi-health-detail-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; margin-top:8px; font-size:12px; color:var(--muted); }
    .kpi-health-actions { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:8px; margin-top:10px; }
    .kpi-health-action { border:1px solid var(--border); border-radius:12px; padding:10px; background:var(--panel); }
    .kpi-health-action strong { display:block; font-size:13px; color:var(--text); }
    .kpi-health-action span { display:block; margin-top:4px; font-size:12px; color:var(--muted); line-height:1.3; }
    .kpi-health-action.good { border-color:rgba(34,197,94,.35); background:rgba(34,197,94,.08); }
    .kpi-health-action.warn { border-color:rgba(245,158,11,.38); background:rgba(245,158,11,.09); }
    .kpi-health-action.info { border-color:rgba(14,165,233,.35); background:rgba(14,165,233,.08); }
    .kpi-pending-detail { margin-top:8px; position:relative; }
    .kpi-pending-detail summary { cursor:pointer; list-style:none; display:flex; align-items:center; justify-content:space-between; gap:8px; font-size:12px; color:var(--muted); }
    .kpi-pending-detail summary::-webkit-details-marker { display:none; }
    .kpi-pending-detail summary span { font-size:11px; opacity:.8; }
    .kpi-pending-pop { margin-top:8px; padding:10px; border:1px solid var(--border); border-radius:14px; background:var(--panel); box-shadow:0 14px 28px rgba(15,23,42,.08); display:grid; gap:8px; }
    .kpi-pending-row { display:flex; align-items:flex-start; justify-content:space-between; gap:10px; font-size:12px; }
    .kpi-pending-row small { display:block; margin-top:2px; color:var(--muted); line-height:1.25; }
    .kpi-pending-row b { white-space:nowrap; }
    .kpi-pending-row b.pos { color:#059669; }
    .kpi-pending-row b.neg { color:#e11d48; }

    @media (max-width: 1100px) {
      .kpi-layout { grid-template-columns: 1fr; }
    }

    @media (max-width: 720px) {
      .kpi-mini-grid { grid-template-columns: 1fr; }
      .kpi-health-body { grid-template-columns:1fr; }
      .kpi-health-ring { margin:auto; }
      .kpi-health-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
    }

    @media (max-width: 480px) {
      .kpi-mini-grid { grid-template-columns: 1fr; }
      .kpi-health-head { align-items:flex-start; flex-direction:column; }
      .kpi-health-grid { grid-template-columns:1fr; }
    }
  `;
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
  return `
    <div class="kpi-health-card">
      <div class="kpi-health-head">
        <div>
          <div class="muted" style="font-size:12px;">Sante</div>
          <div style="font-weight:900;font-size:22px;line-height:1.15;margin-top:3px;">Suivi du jour</div>
          <div class="muted" style="font-size:12px;margin-top:4px;">Nutrition · sport · travail · sommeil</div>
        </div>
        <span class="pill ${safe(healthToday.level || '')}" style="border-color:${color};color:${color};">${safe(healthToday.label || '')}</span>
      </div>
      <div class="kpi-health-body">
        <div class="kpi-health-ring" style="background:conic-gradient(${color} ${score}%, rgba(148,163,184,.18) 0);">
          <div class="kpi-health-ring-inner">${score}<span class="muted" style="font-size:10px;font-weight:700;">/100</span></div>
        </div>
        <div>
          <div class="kpi-health-grid">
            <div class="kpi-health-metric"><span>Energie a maintenant</span><strong>${round(healthToday.kcal)} / ${round(healthToday.expectedKcalNow)} kcal</strong></div>
            <div class="kpi-health-metric"><span>Balance actuelle</span><strong>${round(healthToday.currentBalance)} kcal</strong></div>
            <div class="kpi-health-metric"><span>Eau bue</span><strong>${round(healthToday.drinkWaterMl)} / 2000 ml</strong></div>
            <div class="kpi-health-metric"><span>Sommeil</span><strong>${hoursLabel(healthToday.sleepHours)}</strong></div>
          </div>
          <div class="muted" style="font-size:12px;margin-top:9px;">${safe(healthToday.advice || '')} Charge: ${round(healthToday.activityKcal)} kcal · Eau aliments: ${round(healthToday.foodWaterMl)} ml.</div>
          <div class="kpi-health-actions">
            ${actions.map((row) => `<div class="kpi-health-action ${safe(row?.tone || '')}"><strong>${safe(row?.title || '')}</strong><span>${safe(row?.body || '')}</span></div>`).join('')}
          </div>
          <details class="kpi-health-detail">
            <summary>Comprendre le score</summary>
            <div class="kpi-health-detail-grid">
              <div>Besoin jour complet: <strong style="color:var(--text);">${round(healthToday.needsKcal)} kcal</strong></div>
              <div>Objectif a cette heure: <strong style="color:var(--text);">${round((Number(healthToday.dayProgress) || 0) * 100)}%</strong></div>
              <div>Score energie: <strong style="color:var(--text);">${round(healthToday.kcalScore)} / 42</strong></div>
              <div>Score eau: <strong style="color:var(--text);">${round(healthToday.hydrationScore)} / 24</strong></div>
              <div>Score proteines: <strong style="color:var(--text);">${round(healthToday.proteinScore)} / 18</strong></div>
              <div>Score sommeil: <strong style="color:var(--text);">${round(healthToday.sleepScore)} / 18</strong></div>
              <div>Score alcool: <strong style="color:var(--text);">${round(healthToday.alcoholScore)} / 10</strong></div>
              <div>Alcool: <strong style="color:var(--text);">${Math.round((Number(healthToday.alcoholDrinks) || 0) * 10) / 10} jour / ${Math.round((Number(healthToday.alcoholWeeklyDrinks) || 0) * 10) / 10} semaine</strong></div>
              <div>Base metabolique: <strong style="color:var(--text);">${round(healthToday.baseline)} kcal</strong></div>
              <div>Sport + travail: <strong style="color:var(--text);">${round(healthToday.activityKcal)} kcal</strong></div>
              <div>Objectif nutrition: <strong style="color:var(--text);">${goalLabel(healthToday)}</strong></div>
              <div>Proteines: <strong style="color:var(--text);">${round(healthToday.protein)} / ${round(healthToday.proteinTarget)}g</strong></div>
              <div>Sommeil: <strong style="color:var(--text);">${sleepDetail(healthToday, safe)}</strong></div>
            </div>
          </details>
        </div>
      </div>
    </div>
  `;
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

  return `
    <details class="kpi-pending-detail">
      <summary>${safe(detailLabel)} <span>${safe(rangeLabel)}</span></summary>
      <div class="kpi-pending-pop">
        ${shown.length ? shown.map((item) => {
          const value = Number(item?.value) || 0;
          return `
          <div class="kpi-pending-row">
            <span><strong>${safe(item?.source || '')}</strong><small>${safe(item?.label || '')}${Number(item?.count || 0) > 1 ? ` x${Number(item.count)}` : ''}</small></span>
            <b class="${value >= 0 ? 'pos' : 'neg'}">${safe(formatAmount(value, currency))}</b>
          </div>`;
        }).join('') : `<div class="muted" style="font-size:12px;">${safe(emptyLabel)}</div>`}
        ${more > 0 ? `<div class="muted" style="font-size:12px;margin-top:6px;">+${more} ${safe(moreLabel)}</div>` : ''}
      </div>
    </details>
  `;
}

export default {
  renderKpiHealthCard,
  renderKpiPendingDetail,
  renderKpiResponsiveStyles,
};
