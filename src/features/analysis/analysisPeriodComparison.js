import { clampRange, comparisonMetrics, previousComparableRange } from './analysisPeriodRules.js';

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function money(formatter, value, currency) {
  if (typeof formatter === 'function') return formatter(Number(value) || 0, currency);
  return `${(Number(value) || 0).toFixed(2)} ${String(currency || '').trim()}`.trim();
}

export function renderPeriodComparison({ current = {}, previous = {}, range = {}, metrics = {}, formatCurrency, isEn = false } = {}) {
  const tr = (fr, en) => isEn ? en : fr;
  const amount = (value) => money(formatCurrency, value, current.base);
  const pct = metrics.deltaPct == null ? tr('Nouvelle référence', 'New baseline') : `${metrics.deltaPct > 0 ? '+' : ''}${metrics.deltaPct.toFixed(1)} %`;
  return `<section class="analysis-stat tb-analysis-comparison" style="margin:14px 0;padding:16px 18px;color:var(--text);background:var(--panel);border:1px solid var(--border);border-radius:var(--tb-radius-md);">
    <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;"><div><small>${esc(tr('COMPARAISON DE RYTHME', 'PACE COMPARISON'))}</small><h3 style="margin:4px 0;">${esc(current.start)} → ${esc(current.end)}</h3><span style="color:var(--muted);">${esc(tr('Face à', 'Compared with'))} ${esc(range.start)} → ${esc(range.end)}</span></div><strong style="color:${metrics.favorable ? 'var(--good)' : 'var(--bad)'};font-size:22px;">${esc(pct)}</strong></div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-top:14px;">
      <div><small>${esc(tr('Actuel / jour', 'Current / day'))}</small><strong style="display:block;">${esc(amount(metrics.currentDaily))}</strong></div>
      <div><small>${esc(tr('Précédent / jour', 'Previous / day'))}</small><strong style="display:block;">${esc(amount(metrics.previousDaily))}</strong></div>
      <div><small>${esc(tr('Écart / jour', 'Difference / day'))}</small><strong style="display:block;">${esc(amount(metrics.delta))}</strong></div>
      <div><small>${esc(tr('Dépenses comparées', 'Compared spend'))}</small><strong style="display:block;">${esc(amount(previous.spentToToday))}</strong></div>
    </div></section>`;
}

export function renderPreviousPeriodComparison({ host, current, periodPreset = 'range', travelBounds, computeForRange, formatCurrency, isEn = false } = {}) {
  if (!host) return null;
  host.innerHTML = '';
  try {
    const range = clampRange(previousComparableRange(current, periodPreset), travelBounds);
    if (!range.start) throw new Error('no previous range');
    const previous = computeForRange(range);
    const metrics = comparisonMetrics(current, previous);
    host.innerHTML = renderPeriodComparison({ current, previous, range, metrics, formatCurrency, isEn });
    return { range, previous, metrics };
  } catch (error) {
    host.innerHTML = `<div class="analysis-stat" style="margin:14px 0;color:var(--muted);">${esc(isEn ? 'No comparable previous period in this trip.' : 'Aucune période précédente comparable dans ce voyage.')}</div>`;
    return null;
  }
}
