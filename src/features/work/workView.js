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

export function normalizeWorkSpace(value) {
  return ['today', 'career', 'history'].includes(String(value || '')) ? String(value) : 'today';
}

export function renderWorkSectionTabs({ activeSpace = 'today', esc = defaultEsc, t } = {}) {
  const active = normalizeWorkSpace(activeSpace);
  const tabs = [
    ['today', "Aujourd'hui", 'Today'],
    ['career', 'Parcours', 'Career'],
    ['history', 'Historique', 'History'],
  ];
  return `<nav class="tb-work-section-tabs" role="tablist" aria-label="${esc(langText('Espaces Travail', 'Work spaces', t))}">${tabs.map(([key, fr, en]) => `<button class="tb-work-section-tab" id="work-space-tab-${key}" type="button" role="tab" data-work-space="${key}" aria-controls="work-space-panel-${key}" aria-selected="${active === key}">${esc(langText(fr, en, t))}</button>`).join('')}</nav>`;
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
  return `<section class="tb-work-card tb-work-load">
      <div class="tb-work-load-head">
        <div>
          <h3>${esc(langText('Rythme & charge', 'Rhythm & load', t))}</h3>
          <div class="muted">${esc(label)}</div>
        </div>
        <div class="tb-work-load-kpis">
          <span class="pill">${Math.round(summary.kcal)} kcal</span>
          <span class="pill">${Math.round(summary.hours * 10) / 10}h</span>
        </div>
      </div>
      <div class="tb-work-load-chart">
        ${safeRows.map(row => {
          const h = row.kcal ? Math.max(16, Math.min(86, (num(row.kcal, 0) / summary.maxKcal) * 86)) : 12;
          const title = `${row.day} | ${row.count ? `${Math.round(num(row.kcal, 0))} kcal, ${Math.round((num(row.minutes, 0) / 60) * 10) / 10}h` : row.plannedRest ? langText('Repos', 'Rest', t) : langText('Non saisi', 'Not logged', t)}${row.labels?.length ? ` | ${row.labels.join(', ')}` : ''}`;
          const dayLabel = typeof shortDay === 'function' ? shortDay(row.day) : String(row.day || '').slice(5);
          return `<button class="tb-work-load-day ${row.kcal ? 'has-work' : row.plannedRest ? 'is-rest' : 'is-missing'}" type="button" title="${esc(title)}" aria-label="${esc(title)}">
            <span class="tb-work-load-bar" style="height:${Math.round(h)}px"></span>
            <strong>${esc(dayLabel)}</strong>
            <small class="muted">${row.kcal ? Math.round(num(row.kcal, 0)) : row.plannedRest ? esc(langText('Repos', 'Rest', t)) : '-'}</small>
          </button>`;
        }).join('')}
      </div>
      <div class="tb-work-load-controls">
        <label class="muted" for="work-rhythm">${esc(langText('Rythme', 'Rhythm', t))}</label>
        <select id="work-rhythm">
          <option value="weekend_rest" ${mode === 'weekend_rest' ? 'selected' : ''}>${esc(langText('Repos samedi/dimanche', 'Rest Saturday/Sunday', t))}</option>
          <option value="daily" ${mode === 'daily' ? 'selected' : ''}>${esc(langText('Travail possible tous les jours', 'Work can happen every day', t))}</option>
        </select>
        <button class="btn small" type="button" id="work-rest-today">${esc(langText("Repos aujourd'hui", 'Rest today', t))}</button>
      </div>
    </section>`;
}

function defaultMoney(value, currency = 'AUD') {
  return `${Math.round(num(value, 0))} ${currency}`;
}

function defaultShortDate(value) {
  return String(value || '').slice(0, 10);
}

function careerRange({ engagements = [], statuses = [], today = '' } = {}) {
  const dates = [];
  [...engagements, ...statuses].forEach((row) => {
    if (row?.start_date) dates.push(row.start_date);
    if (row?.end_date) dates.push(row.end_date);
  });
  dates.push(today || new Date().toISOString().slice(0, 10));
  dates.sort();
  const start = new Date(`${dates[0] || today}T12:00:00`);
  const end = new Date(`${dates[dates.length - 1] || today}T12:00:00`);
  if (end - start < 86400000 * 30) end.setDate(end.getDate() + 30);
  return { start, end, span: Math.max(1, end - start) };
}

function careerPosition(start, end, range, today) {
  const s = new Date(`${String(start || today).slice(0, 10)}T12:00:00`);
  const e = new Date(`${String(end || today).slice(0, 10)}T12:00:00`);
  const left = Math.max(0, Math.min(100, ((s - range.start) / range.span) * 100));
  const right = Math.max(left, Math.min(100, ((e - range.start) / range.span) * 100));
  return { left, width: Math.max(1, right - left) };
}

function renderCareerTimeline({
  engagements = [],
  statuses = [],
  today = '',
  shortDate = defaultShortDate,
  esc = defaultEsc,
  t,
} = {}) {
  const range = careerRange({ engagements, statuses, today });
  const rows = [
    ...engagements.map((row) => ({ ...row, _kind: 'job' })),
    ...statuses.map((row) => ({ ...row, _kind: 'status' })),
  ].sort((a, b) => String(a.start_date).localeCompare(String(b.start_date)));

  if (!rows.length) {
    return `<div class="tb-career-empty">${esc(langText('Ajoute une mission ou une période pour démarrer la fresque.', 'Add a job or period to start the timeline.', t))}</div>`;
  }

  return `<div aria-label="${esc(langText('Fresque professionnelle', 'Career timeline', t))}">${rows.map((row) => {
    const position = careerPosition(row.start_date, row.end_date, range, today);
    const color = row.color || (row._kind === 'status' ? '#94a3b8' : '#0ea5e9');
    const label = row.name || row.label || '';
    const title = `${shortDate(row.start_date)} - ${row.end_date ? shortDate(row.end_date) : langText('en cours', 'ongoing', t)}`;
    return `<div class="tb-career-track">
      <div class="tb-career-track-label" title="${esc(label)}">${esc(label)}</div>
      <div class="tb-career-rail" title="${esc(title)}">
        <span class="tb-career-bar" style="left:${position.left}%;width:${position.width}%;background:${esc(color)}"></span>
      </div>
    </div>`;
  }).join('')}</div>`;
}

function renderCareerJobs({
  engagements = [],
  careerSummary = {},
  renderFolders = () => '',
  money = defaultMoney,
  shortDate = defaultShortDate,
  esc = defaultEsc,
  t,
} = {}) {
  const rows = careerSummary.engagements || [];
  return engagements.map((job) => {
    const item = rows.find((row) => String(row.engagement?.id) === String(job.id)) || { netHours: 0, totalReceived: 0, hourlyNet: null };
    const meta = [job.employer, job.role_title].filter(Boolean).join(' · ');
    return `<article class="tb-career-job">
      <div class="tb-career-job-top">
        <div><strong>${esc(job.name)}</strong><div class="muted">${esc(meta)}${meta ? ' · ' : ''}${esc(shortDate(job.start_date))}${job.end_date ? ` - ${esc(shortDate(job.end_date))}` : ''}</div></div>
        <span class="tb-career-color" style="background:${esc(job.color || '#0ea5e9')}"></span>
      </div>
      <div class="tb-career-job-stats">
        <span class="pill">${Math.round(num(item.netHours, 0) * 10) / 10}h</span>
        <span class="pill">${esc(money(item.totalReceived, job.currency))}</span>
        <span class="pill">${item.hourlyNet == null ? '--' : esc(money(item.hourlyNet, job.currency))}/h</span>
      </div>
      ${renderFolders('job', job.id)}
      <div class="tb-career-job-actions">
        <button class="btn small" data-career-edit-job="${esc(job.id)}" type="button">${esc(langText('Modifier', 'Edit', t))}</button>
        <button class="btn small" data-career-link-folder="${esc(job.id)}" type="button">${esc(langText('Lier un dossier', 'Link folder', t))}</button>
        <button class="btn small" data-career-delete-job="${esc(job.id)}" type="button">${esc(langText('Supprimer', 'Delete', t))}</button>
      </div>
    </article>`;
  }).join('');
}

function renderCareerActivity({
  incomes = [],
  statuses = [],
  engagements = [],
  renderFolders = () => '',
  money = defaultMoney,
  shortDate = defaultShortDate,
  esc = defaultEsc,
  t,
} = {}) {
  const jobById = (id) => engagements.find((row) => String(row.id) === String(id));
  const rows = [
    ...incomes.map((row) => ({
      kind: 'income',
      id: row.id,
      date: row.received_date,
      title: jobById(row.engagement_id)?.name || langText('Revenu hors mission', 'Unassigned income', t),
      detail: `${money(row.net_amount, row.currency)} ${langText('net', 'net', t)}${row.gross_amount == null ? '' : ` · ${money(row.gross_amount, row.currency)} ${langText('brut', 'gross', t)}`}${row.period_start ? ` · ${shortDate(row.period_start)}${row.period_end ? ` - ${shortDate(row.period_end)}` : ''}` : ''}`,
    })),
    ...statuses.map((row) => ({
      kind: 'status',
      id: row.id,
      date: row.start_date,
      title: row.label,
      detail: `${shortDate(row.start_date)}${row.end_date ? ` - ${shortDate(row.end_date)}` : ` · ${langText('en cours', 'ongoing', t)}`}`,
    })),
  ].sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 12);

  if (!rows.length) return '';
  return `<div class="tb-career-activity-group">
    <strong>${esc(langText('Revenus et périodes', 'Income and periods', t))}</strong>
    ${rows.map((item) => `<div class="tb-career-activity">
      <div class="tb-career-activity-row"><div><b>${esc(item.title)}</b><div class="muted">${esc(shortDate(item.date))} · ${esc(item.detail)}</div></div>
      <div class="tb-career-activity-actions">
        <button class="btn small" type="button" data-career-edit-${item.kind}="${esc(item.id)}">${esc(langText('Modifier', 'Edit', t))}</button>
        <button class="btn small" type="button" data-career-link-folder-kind="${esc(item.kind)}" data-career-link-folder-id="${esc(item.id)}">${esc(langText('Lier un dossier', 'Link folder', t))}</button>
        <button class="btn small" type="button" data-career-delete-${item.kind}="${esc(item.id)}">x</button>
      </div></div>
      ${renderFolders(item.kind, item.id)}
    </div>`).join('')}
  </div>`;
}

export function renderWorkCareerPanel({
  data = {},
  careerSummary = {},
  today = '',
  money = defaultMoney,
  shortDate = defaultShortDate,
  esc = defaultEsc,
  t,
} = {}) {
  const engagements = data.engagements || [];
  const statuses = data.statuses || [];
  const incomes = data.incomes || [];
  const renderFolders = data.renderFolders || (() => '');
  const totals = careerSummary.totals || {};
  const currency = engagements[0]?.currency || 'AUD';
  const received = Object.entries(totals.receivedByCurrency || {});

  return `<section class="tb-career">
    <div class="tb-career-head">
      <div>
        <h3>${esc(langText('Parcours professionnel', 'Career', t))}</h3>
        <div class="muted">${esc(langText('Temps travaillé, revenus reçus et périodes de transition.', 'Worked time, received income and transition periods.', t))}</div>
      </div>
      <div class="tb-career-actions">
        <button class="btn primary" data-career-open="job" type="button">+ ${esc(langText('Mission', 'Job', t))}</button>
        <button class="btn" data-career-open="income" type="button">+ ${esc(langText('Revenu', 'Income', t))}</button>
        <button class="btn" data-career-open="status" type="button">+ ${esc(langText('Période', 'Period', t))}</button>
      </div>
    </div>
    ${data.error ? `<div class="tb-career-error">${esc(data.error)}</div>` : ''}
    <div class="tb-career-kpis">
      <div class="tb-career-kpi"><small>${esc(langText('Net reçu par devise', 'Net received by currency', t))}</small><strong>${received.length ? received.map(([code, amount]) => esc(money(amount, code))).join('<br>') : esc(money(totals.totalReceived || 0, currency))}</strong></div>
      <div class="tb-career-kpi"><small>${esc(langText('Heures nettes', 'Net hours', t))}</small><strong>${Math.round(num(totals.netHours, 0) * 10) / 10}h</strong></div>
      <div class="tb-career-kpi"><small>${esc(langText('Taux net réel', 'Actual net rate', t))}</small><strong>${totals.hourlyNet == null ? '--' : esc(money(totals.hourlyNet, currency))}/h</strong></div>
      <div class="tb-career-kpi"><small>${esc(langText('Missions', 'Jobs', t))}</small><strong>${engagements.length}</strong></div>
    </div>
    ${renderCareerTimeline({ engagements, statuses, today, shortDate, esc, t })}
    <div class="tb-career-jobs">${renderCareerJobs({ engagements, careerSummary, renderFolders, money, shortDate, esc, t })}</div>
    ${renderCareerActivity({ incomes, statuses, engagements, renderFolders, money, shortDate, esc, t })}
  </section>`;
}
