function fallbackEscape(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

function baseApi(api = {}) {
  return {
    translate: (fr, en) => fr || en || '',
    escapeHTML: fallbackEscape,
    numberValue: (value, fallback = 0) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : fallback;
    },
    todayISO: () => new Date().toISOString().slice(0, 10),
    shortWeekday: (day) => String(day || '').slice(5, 10),
    formatSeconds: (seconds) => `${Math.round(Number(seconds || 0))}s`,
    currentProgramWeek: () => 'A',
    nextPlannedSportRow: (days, day) => (days || []).find((row) => row?.planned && row.day >= day) || null,
    ...api,
  };
}

function renderProgramCockpit({ days, program, api = {} }) {
  const helpers = baseApi(api);
  const t = helpers.translate;
  const esc = helpers.escapeHTML;
  const n = helpers.numberValue;
  const weekLabel = days[0]?.weekLabel || helpers.currentProgramWeek(program);
  const today = helpers.todayISO();
  const todayRow = days.find((row) => row.day === today);
  const next = helpers.nextPlannedSportRow(days, today);
  const target = todayRow?.session || next?.session || null;
  const targetRow = todayRow?.session ? todayRow : next;
  const catchup = helpers.catchupPlannedSportRow?.(days, today);
  const last = helpers.lastProgramSessionDone?.() || null;
  const progressionRows = helpers.exerciseProgressionRows?.(target) || [];
  const loads = (target?.plan || []).slice(0, 8);
  const todayLabel = todayRow?.session ? `${todayRow.code || ''} · ${todayRow.session.name}` : t("Repos aujourd'hui", 'Rest today');
  const nextLabel = next?.session ? `${next.day === today ? t("Aujourd'hui", 'Today') : helpers.shortWeekday(next.day)} · ${next.code || ''}` : t('Aucune seance', 'No workout');

  return `<div class="tb-sport-program-cockpit">
      <div class="tb-sport-program-head">
        <div>
          <span>${esc(t('Programme V3', 'Program V3'))}</span>
          <strong>${esc(t('Cockpit entrainement', 'Training cockpit'))}</strong>
          <small>${esc(t(`Cycle ${weekLabel} actif, recurrence parametrable juste dessous.`, `Active ${weekLabel} cycle, recurrence can be edited below.`))}</small>
        </div>
        <div class="tb-sport-actions">
          ${todayRow?.session ? `<button class="btn small primary" type="button" data-sport-start-planned-today="${esc(todayRow.session.id)}">${esc(t("Lancer aujourd'hui", 'Start today'))}</button>` : ''}
          ${target ? `<button class="btn small" type="button" data-sport-load-session-favorite="${esc(target.id)}">${esc(t('Preparer', 'Prepare'))}</button>` : ''}
        </div>
      </div>
      <div class="tb-sport-program-kpis">
        <div><span>${esc(t('Semaine', 'Week'))}</span><strong>${esc(weekLabel)}</strong><small>${esc(t('Alternance A/B', 'A/B rotation'))}</small></div>
        <div><span>${esc(t("Aujourd'hui", 'Today'))}</span><strong>${esc(todayLabel)}</strong><small>${esc(todayRow?.session ? t('Seance prevue', 'Workout planned') : t('Recuperation', 'Recovery'))}</small></div>
        <div><span>${esc(t('Prochaine', 'Next'))}</span><strong>${esc(nextLabel)}</strong><small>${esc(next?.session?.name || t('Planning a completer', 'Planning to complete'))}</small></div>
        <div><span>${esc(t('Derniere', 'Last'))}</span><strong>${esc(last ? String(last.started_at || last.startedAt || '').slice(5, 10).replace('-', '/') : '-')}</strong><small>${esc(last ? `${Math.round(n(last.estimated_kcal, 0))} kcal` : t('Aucune seance', 'No workout'))}</small></div>
      </div>
      ${catchup?.session ? `<div class="tb-sport-program-catchup">
        <div><strong>${esc(t('Seance a rattraper', 'Workout to catch up'))}</strong><small>${esc(`${catchup.day} · ${catchup.code || catchup.session.name} · ${catchup.session.name}`)}</small></div>
        <button class="btn small" type="button" data-sport-load-session-favorite="${esc(catchup.session.id)}">${esc(t('Charger', 'Load'))}</button>
      </div>` : ''}
      ${target ? `<div class="tb-sport-program-focus">
        <div>
          <span>${esc(t(targetRow?.day === today ? 'Seance du jour' : 'Prochaine seance', targetRow?.day === today ? "Today's workout" : 'Next workout'))}</span>
          <strong>${esc(target.name)}</strong>
          <small>${esc(helpers.sessionPlannedLoadSummary?.(target) || '')}</small>
        </div>
        <em>${esc(helpers.sessionProgressionPreview?.(target) || '')}</em>
      </div>` : ''}
      ${loads.length ? `<div class="tb-sport-program-loads">
        ${loads.map((item) => {
          const range = helpers.progressionRepRange?.(item);
          const sets = Math.max(1, Math.round(n(item.sets, 1)));
          const targetText = item.mode === 'reps'
            ? `${sets} x ${range ? `${range.min}-${range.max}` : Math.round(n(item.targetReps, 0))} reps`
            : `${sets} x ${helpers.formatSeconds(item.targetSeconds || 0)}`;
          return `<div>
          <span>${esc(helpers.sessionExerciseName?.(item) || item?.exerciseName || '')}</span>
          <strong>${esc(helpers.plannedExerciseLoadLabel?.(item) || '')}</strong>
          <small>${esc(targetText)} · ${esc(t('repos', 'rest'))} ${esc(helpers.formatSeconds(helpers.restSecondsForItem?.(item) || 0))}</small>
        </div>`;
        }).join('')}
      </div>` : ''}
      ${progressionRows.length ? `<div class="tb-sport-program-progression">
        <strong>${esc(t('Progression exercice par exercice', 'Exercise-by-exercise progression'))}</strong>
        ${progressionRows.map((row) => `<div>
          <span>${esc(row.name)}</span>
          <small>${esc(`${row.sets} x ${row.range ? `${row.range.min}-${row.range.max}` : '-'} · ${row.loadLabel}`)}</small>
          <b>${esc(row.external && row.range ? t(`+${row.inc} kg quand toutes les series touchent ${row.range.max}`, `+${row.inc} kg when every set reaches ${row.range.max}`) : t('Progression reps/temps', 'Reps/time progression'))}</b>
        </div>`).join('')}
      </div>` : ''}
    </div>`;
}

export function renderPlannedSportWeek({ days, program, api = {} }) {
  if (!Array.isArray(days) || !days.length) return '';
  const helpers = baseApi(api);
  const t = helpers.translate;
  const esc = helpers.escapeHTML;
  const weekLabel = days[0]?.weekLabel || helpers.currentProgramWeek(program);
  const today = helpers.todayISO();
  return `<div class="tb-sport-planned-week">
      ${renderProgramCockpit({ days, program, api: helpers })}
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap;">
        <div>
          <strong>${esc(t('Semaine planifiee', 'Planned week'))}</strong>
          <div class="muted">${esc(t(`Cycle ${weekLabel} actif : seance les lundi, mercredi et vendredi.`, `Active ${weekLabel} cycle: workout on Monday, Wednesday and Friday.`))}</div>
        </div>
        <span class="pill">${esc(t('Semaine', 'Week'))} ${esc(weekLabel)}</span>
      </div>
      <div class="tb-sport-planned-grid">
        ${days.map((row) => {
          const isToday = row.day === today;
          const planned = Boolean(row.session);
          const label = planned ? (row.code || row.session.name) : t('Repos', 'Rest');
          const detail = planned ? row.session.name : t('Jour de repos actuel', 'Current rest day');
          return `<button class="tb-sport-planned-day ${planned ? 'planned' : 'rest'} ${isToday ? 'today' : ''}" type="button" ${planned ? `data-sport-load-session-favorite="${esc(row.session.id)}"` : ''} title="${esc(`${row.day} | ${detail}`)}">
            <span>${esc(helpers.shortWeekday(row.day))}</span>
            <strong>${esc(label)}</strong>
            <small>${esc(detail)}</small>
          </button>`;
        }).join('')}
      </div>
    </div>`;
}

function renderProgramDayOptions(value, api = {}) {
  const helpers = baseApi(api);
  const t = helpers.translate;
  const esc = helpers.escapeHTML;
  const current = String(value || '');
  const options = [
    ['', t('Repos', 'Rest')],
    ['A1/B1', 'A1 / B1'],
    ['A2/B2', 'A2 / B2'],
    ['A3/B3', 'A3 / B3'],
    ['A1', 'A1'],
    ['A2', 'A2'],
    ['A3', 'A3'],
    ['B1', 'B1'],
    ['B2', 'B2'],
    ['B3', 'B3'],
  ];
  return options.map((row) => `<option value="${esc(row[0])}" ${row[0] === current ? 'selected' : ''}>${esc(row[1])}</option>`).join('');
}

export function renderProgramSettings({ program, api = {} }) {
  const helpers = baseApi(api);
  const t = helpers.translate;
  const esc = helpers.escapeHTML;
  const p = Object.assign({ enabled: false, startDate: helpers.nextMondayISO?.(helpers.todayISO()) || helpers.todayISO(), cycle: 'A/B', days: { 1: 'A1/B1', 3: 'A2/B2', 5: 'A3/B3' } }, program || {});
  const dayLabels = [t('Lun', 'Mon'), t('Mar', 'Tue'), t('Mer', 'Wed'), t('Jeu', 'Thu'), t('Ven', 'Fri'), t('Sam', 'Sat'), t('Dim', 'Sun')];
  return `<details class="tb-sport-advanced" style="margin:10px 0;" ${p.enabled ? 'open' : ''}>
      <summary>${esc(t('Regler planning et recurrence', 'Configure planning and recurrence'))}</summary>
      <div class="tb-sport-fields" style="margin-top:10px;">
        <div class="tb-sport-field"><label>${esc(t('Actif', 'Active'))}</label><select id="sport-program-enabled"><option value="on" ${p.enabled ? 'selected' : ''}>${esc(t('Actif', 'Active'))}</option><option value="off" ${!p.enabled ? 'selected' : ''}>${esc(t('Pause', 'Paused'))}</option></select></div>
        <div class="tb-sport-field"><label>${esc(t('Debut cycle', 'Cycle start'))}</label><input id="sport-program-start" type="date" value="${esc(String(p.startDate || p.start_date || helpers.todayISO()).slice(0, 10))}"></div>
        <div class="tb-sport-field"><label>${esc(t('Cycle', 'Cycle'))}</label><select id="sport-program-cycle"><option value="A/B" ${String(p.cycle || 'A/B') === 'A/B' ? 'selected' : ''}>A/B</option><option value="A" ${String(p.cycle || '') === 'A' ? 'selected' : ''}>${esc(t('Semaine A fixe', 'Fixed week A'))}</option><option value="B" ${String(p.cycle || '') === 'B' ? 'selected' : ''}>${esc(t('Semaine B fixe', 'Fixed week B'))}</option></select></div>
        ${dayLabels.map((label, idx) => `<div class="tb-sport-field"><label>${esc(label)}</label><select data-sport-program-day="${idx + 1}">${renderProgramDayOptions(p.days?.[idx + 1], helpers)}</select></div>`).join('')}
      </div>
      <div class="tb-sport-actions" style="margin-top:10px;">
        <button class="btn small" type="button" id="sport-program-reset">${esc(t('Planning A/B par defaut', 'Default A/B planning'))}</button>
      </div>
    </details>`;
}

export function renderLoadRecommendations({ recommendations = [], api = {} } = {}) {
  const rows = Array.isArray(recommendations) ? recommendations : [];
  if (!rows.length) return '';
  const helpers = baseApi(api);
  const t = helpers.translate;
  const esc = helpers.escapeHTML;
  const n = helpers.numberValue;
  return `<div class="tb-sport-simple" style="margin:12px 0;">
      <strong>${esc(t('Recommandations de charge', 'Load recommendations'))}</strong>
      <div class="tb-sport-library-grid" style="margin-top:10px;">
        ${rows.map((row) => `<div class="btn" style="display:grid;text-align:left;gap:7px;">
          <div><strong>${esc(row.exercise_id)}</strong> · ${esc(String(n(row.recommended_weight_kg, 0)))} kg</div>
          <small class="muted">${esc(row.reason_text || '')}</small>
          <div class="tb-sport-actions">
            ${row.program_exercise_id ? `<button class="btn small primary" type="button" data-sport-apply-load-recommendation="${esc(row.id)}">${esc(t('Accepter et appliquer', 'Accept and apply'))}</button>
            <button class="btn small" type="button" data-sport-apply-all-load-recommendation="${esc(row.id)}">${esc(t('Appliquer aux variantes compatibles', 'Apply to compatible variants'))}</button>
            <button class="btn small" type="button" data-sport-modify-load-recommendation="${esc(row.id)}">${esc(t('Modifier', 'Adjust'))}</button>` : ''}
            <button class="btn small" type="button" data-sport-reject-load-recommendation="${esc(row.id)}">${esc(t('Conserver la charge', 'Keep current load'))}</button>
          </div>
        </div>`).join('')}
      </div>
    </div>`;
}
