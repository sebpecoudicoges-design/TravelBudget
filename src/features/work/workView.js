function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function defaultEsc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function langText(fr, en, t) {
  return typeof t === 'function' ? t(fr, en) : fr;
}

export function summarizeWorkWeek(rows = []) {
  const safeRows = Array.isArray(rows) ? rows : [];
  return {
    kcal: safeRows.reduce((sum, row) => sum + num(row.kcal, 0), 0),
    hours: safeRows.reduce((sum, row) => sum + num(row.minutes, 0), 0) / 60,
    maxKcal: Math.max(1, ...safeRows.map(row => num(row.kcal, 0))),
  };
}

export function todayWorkLabel(today = {}, { t } = {}) {
  if (num(today.count, 0)) {
    const hours = Math.round((num(today.minutes, 0) / 60) * 10) / 10;
    return langText(`Aujourd'hui : ${hours}h, ${Math.round(num(today.kcal, 0))} kcal`, `Today: ${hours}h, ${Math.round(num(today.kcal, 0))} kcal`, t);
  }
  if (today.plannedRest) return langText("Repos prevu aujourd'hui.", 'Rest planned today.', t);
  return langText("Aucun travail saisi aujourd'hui.", 'No work logged today.', t);
}

export function renderWorkLoadPanel({
  rows = [],
  rhythm = {},
  shortDay,
  esc = defaultEsc,
  t,
} = {}) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const today = safeRows[safeRows.length - 1] || { kcal: 0, minutes: 0, plannedRest: false };
  const summary = summarizeWorkWeek(safeRows);
  const label = todayWorkLabel(today, { t });
  const mode = String(rhythm?.mode || 'weekend_rest');
  return `<div style="border:1px solid rgba(14,165,233,.18);border-radius:18px;padding:12px;background:linear-gradient(135deg,rgba(14,165,233,.10),rgba(34,197,94,.08)),var(--panel2);margin-bottom:12px;">
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap;">
        <div>
          <h3 style="margin:0 0 4px;">${esc(langText('Rythme & charge', 'Rhythm & load', t))}</h3>
          <div class="muted">${esc(label)}</div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;">
          <span class="pill">${Math.round(summary.kcal)} kcal</span>
          <span class="pill">${Math.round(summary.hours * 10) / 10}h</span>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:7px;align-items:end;margin:12px 0 10px;">
        ${safeRows.map(row => {
          const h = row.kcal ? Math.max(16, Math.min(86, (num(row.kcal, 0) / summary.maxKcal) * 86)) : 12;
          const color = row.kcal ? 'linear-gradient(180deg,#22c55e,#0ea5e9)' : row.plannedRest ? 'linear-gradient(180deg,#cbd5e1,#94a3b8)' : 'linear-gradient(180deg,#fde68a,#f59e0b)';
          const title = `${row.day} | ${row.count ? `${Math.round(num(row.kcal, 0))} kcal, ${Math.round((num(row.minutes, 0) / 60) * 10) / 10}h` : row.plannedRest ? langText('Repos', 'Rest', t) : langText('Non saisi', 'Not logged', t)}${row.labels?.length ? ` | ${row.labels.join(', ')}` : ''}`;
          const dayLabel = typeof shortDay === 'function' ? shortDay(row.day) : String(row.day || '').slice(5);
          return `<button type="button" title="${esc(title)}" style="border:0;background:transparent;padding:0;display:grid;gap:5px;align-items:end;color:inherit;">
            <span style="height:${Math.round(h)}px;border-radius:10px 10px 5px 5px;background:${color};box-shadow:0 8px 18px rgba(15,23,42,.10);"></span>
            <strong style="font-size:11px;">${esc(dayLabel)}</strong>
            <span class="muted" style="font-size:10px;">${row.kcal ? Math.round(num(row.kcal, 0)) : row.plannedRest ? esc(langText('Repos', 'Rest', t)) : '-'}</span>
          </button>`;
        }).join('')}
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
        <label class="muted" for="work-rhythm" style="font-weight:850;">${esc(langText('Rythme', 'Rhythm', t))}</label>
        <select id="work-rhythm" style="border:1px solid var(--border);border-radius:999px;padding:8px 10px;background:var(--panel);font-weight:850;color:inherit;">
          <option value="weekend_rest" ${mode === 'weekend_rest' ? 'selected' : ''}>${esc(langText('Repos samedi/dimanche', 'Rest Saturday/Sunday', t))}</option>
          <option value="daily" ${mode === 'daily' ? 'selected' : ''}>${esc(langText('Travail possible tous les jours', 'Work can happen every day', t))}</option>
        </select>
        <button class="btn small" type="button" id="work-rest-today">${esc(langText("Repos aujourd'hui", 'Rest today', t))}</button>
      </div>
    </div>`;
}
