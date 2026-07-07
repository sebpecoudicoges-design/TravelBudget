function fallbackEscape(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

const identity = (value) => value;
const numberValue = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const timeValue = (seconds) => {
  const total = Math.max(0, Math.round(numberValue(seconds, 0)));
  const min = Math.floor(total / 60);
  const sec = total % 60;
  return `${min}:${String(sec).padStart(2, '0')}`;
};

function helpers(api = {}) {
  return {
    esc: api.escapeHTML || fallbackEscape,
    txt: api.translate || ((fr, en) => fr || en || ''),
    n: api.numberValue || numberValue,
    fmtSec: api.formatSeconds || timeValue,
    labelActivity: api.labelActivity || identity,
    labelEquipment: api.labelEquipment || identity,
    localDateISO: api.localDateISO || ((value) => String(value || '').slice(0, 10)),
    todayISO: api.todayISO || (() => new Date().toISOString().slice(0, 10)),
  };
}

export function isTodaySession(session, api) {
  const h = helpers(api);
  return h.localDateISO(session?.started_at || session?.startedAt) === h.todayISO();
}

export function offsetDateISO(day, offset, api) {
  const h = helpers(api);
  const date = new Date(`${String(day || h.todayISO()).slice(0, 10)}T12:00:00`);
  date.setDate(date.getDate() + Number(offset || 0));
  return h.localDateISO(date);
}

export function shortWeekday(day, api) {
  const h = helpers(api);
  const idx = new Date(`${String(day || h.todayISO()).slice(0, 10)}T12:00:00`).getDay();
  const fr = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  const en = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return h.txt(fr[idx] || '', en[idx] || '');
}

export function renderSportWeekVisual({ sessions = [], api = {} }) {
  const h = helpers(api);
  const byDay = new Map();
  (sessions || []).forEach((session) => {
    const day = h.localDateISO(session.started_at || session.startedAt);
    if (!day) return;
    const prev = byDay.get(day) || { day, count: 0, kcal: 0, seconds: 0 };
    prev.count += 1;
    prev.kcal += h.n(session.estimated_kcal || session.estimatedKcal, 0);
    prev.seconds += h.n(session.duration_seconds || session.durationSeconds, 0);
    byDay.set(day, prev);
  });
  const rows = [];
  for (let i = 6; i >= 0; i -= 1) {
    const day = offsetDateISO(h.todayISO(), -i, api);
    rows.push(byDay.get(day) || { day, count: 0, kcal: 0, seconds: 0 });
  }
  const maxKcal = Math.max(1, ...rows.map((row) => h.n(row.kcal, 0)));
  const totalKcal = rows.reduce((sum, row) => sum + h.n(row.kcal, 0), 0);
  const activeDays = rows.filter((row) => row.count > 0).length;
  return `<div class="tb-sport-week">
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap;">
        <div>
          <h3 style="margin:0 0 4px;">${h.esc(h.txt('Semaine sport', 'Sport week'))}</h3>
          <div class="muted">${h.esc(h.txt(`${activeDays} jour(s) actifs, ${Math.round(totalKcal)} kcal brulees`, `${activeDays} active day(s), ${Math.round(totalKcal)} kcal burned`))}</div>
        </div>
        <span class="pill">${h.esc(h.txt('Actif / repos', 'Active / rest'))}</span>
      </div>
      <div class="tb-sport-week-grid">
        ${rows.map((row) => {
          const active = row.count > 0;
          const height = active ? Math.max(18, Math.min(86, (h.n(row.kcal, 0) / maxKcal) * 86)) : 12;
          const title = `${row.day} | ${active ? `${row.count} ${h.txt('seance(s)', 'workout(s)')}, ${Math.round(row.kcal)} kcal, ${h.fmtSec(row.seconds)}` : h.txt('Repos / sans sport', 'Rest / no sport')}`;
          return `<button class="tb-sport-week-day ${active ? 'active' : ''}" type="button" title="${h.esc(title)}">
            <span class="tb-sport-week-bar" style="height:${Math.round(height)}px"></span>
            <strong>${h.esc(shortWeekday(row.day, api))}</strong>
            <small>${active ? `${Math.round(row.kcal)}` : h.esc(h.txt('Repos', 'Rest'))}</small>
          </button>`;
        }).join('')}
      </div>
    </div>`;
}

export function renderSessionContent({
  sessionId,
  plan = [],
  sets = [],
  api = {},
}) {
  const h = helpers(api);
  if (!plan.length) return '';
  const byItem = new Map();
  sets.forEach((set) => {
    const itemIndex = Math.max(0, Math.round(h.n(set.itemIndex, 0)));
    const rows = byItem.get(itemIndex) || [];
    rows.push(set);
    byItem.set(itemIndex, rows);
  });
  return `<details class="tb-sport-session-details">
      <summary>${h.esc(h.txt('Voir le contenu de la seance', 'View workout content'))}</summary>
      <div class="tb-sport-session-content">
        ${plan.map((item, idx) => {
          const itemSets = (byItem.get(idx) || []).slice().sort((a, b) => h.n(a.setIndex, 0) - h.n(b.setIndex, 0));
          const setLine = itemSets.length
            ? itemSets.map((set) => {
              const bits = [`#${Math.max(1, Math.round(h.n(set.setIndex, 1)))}`];
              if (item.mode === 'reps' || set.reps != null) bits.push(`${Math.round(h.n(set.reps, item.targetReps || 0))} reps`);
              if (h.n(set.durationSeconds, 0)) bits.push(h.fmtSec(set.durationSeconds));
              if (h.n(set.weightKg, 0)) bits.push(`${Math.round(h.n(set.weightKg, 0) * 10) / 10} kg`);
              if (h.n(set.distanceM, 0)) bits.push(`${Math.round(h.n(set.distanceM, 0))} m`);
              return `<span>${h.esc(bits.join(' · '))}</span>`;
            }).join('')
            : `<span>${h.esc(h.txt('Series non detaillees', 'Sets not detailed'))}</span>`;
          return `<div class="tb-sport-session-exercise">
            <strong>${idx + 1}. ${h.esc(item.exerciseName || h.labelActivity(item.activityKey || 'strength'))}</strong>
            <div class="muted" style="font-size:12px;margin-top:3px;">${h.esc(h.labelActivity(item.activityKey || 'strength'))} · ${h.esc(h.labelEquipment(item.equipment))} · ${item.mode === 'reps' ? `${Math.round(h.n(item.targetReps, 0))} reps` : h.fmtSec(item.targetSeconds || 0)} · ${itemSets.length || Math.max(1, Math.round(h.n(item.sets, 1)))} ${h.esc(h.txt('series', 'sets'))}</div>
            ${item.notes ? `<div class="muted" style="font-size:12px;margin-top:3px;">${h.esc(item.notes)}</div>` : ''}
            <div class="tb-sport-session-setline">${setLine}</div>
          </div>`;
        }).join('')}
      </div>
    </details>`;
}

export function renderHistoryGrid({
  sessions = [],
  items = [],
  sets = [],
  planForSession = () => [],
  doneSetsForSession = () => [],
  api = {},
}) {
  const h = helpers(api);
  const visibleSessions = (sessions || []).slice(0, 20);
  const hiddenCount = Math.max(0, (sessions || []).length - visibleSessions.length);
  return `<div class="tb-sport-history" style="margin-top:10px;">
      ${visibleSessions.length ? visibleSessions.map((session) => {
        const sessionItems = session.localPlanCount
          ? new Array(session.localPlanCount).fill(null)
          : (items || []).filter((item) => String(item.session_id) === String(session.id));
        const itemIds = new Set(sessionItems.map((item) => String(item?.id || '')).filter(Boolean));
        const setCount = session.localSetCount || (sets || []).filter((set) => itemIds.has(String(set.item_id || ''))).length;
        const firstExercise = session.first_exercise || sessionItems.find(Boolean)?.exercise_name || '';
        return `<div class="tb-sport-history-card">
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">
            <div style="font-weight:950;">${h.esc(h.labelActivity(session.activity_type || sessionItems[0]?.activity_key || 'strength'))}</div>
            <span class="tb-sport-chip">${h.esc(session.localOnly ? h.txt('local', 'local') : h.txt('sync', 'synced'))}</span>
          </div>
          ${firstExercise ? `<div class="muted" style="margin-top:4px;">${h.esc(firstExercise)}</div>` : ''}
          <div class="muted">${h.esc(String(session.started_at || '').slice(0, 16).replace('T', ' '))}</div>
          <div class="tb-sport-meta">
            <span class="tb-sport-chip">${h.fmtSec(session.duration_seconds || 0)}</span>
            <span class="tb-sport-chip">${Math.round(h.n(session.estimated_kcal, 0))} kcal</span>
            <span class="tb-sport-chip">${sessionItems.length} ${h.esc(h.txt('exercices', 'exercises'))}</span>
            <span class="tb-sport-chip">${setCount} ${h.esc(h.txt('series', 'sets'))}</span>
            ${session.perceived_effort ? `<span class="tb-sport-chip">RPE ${h.esc(String(session.perceived_effort))}/10</span>` : ''}
          </div>
          ${session.mood_after ? `<div class="muted" style="margin-top:8px;">${h.esc(h.txt('Apres', 'After'))}: ${h.esc(session.mood_after)}</div>` : ''}
          ${renderSessionContent({ sessionId: session.id, plan: planForSession(session.id), sets: doneSetsForSession(session.id), api })}
          <div class="tb-sport-actions" style="margin-top:10px;">
            <button class="btn primary" type="button" data-sport-repeat-session="${h.esc(String(session.id || ''))}">${h.esc(h.txt('Refaire', 'Repeat'))}</button>
            <button class="btn" type="button" data-sport-edit-session="${h.esc(String(session.id || ''))}">${h.esc(h.txt('Ajuster', 'Adjust'))}</button>
            <button class="btn" type="button" data-sport-edit-date="${h.esc(String(session.id || ''))}" data-sport-date="${h.esc(String(session.started_at || '').slice(0, 10))}">${h.esc(h.txt('Modifier date', 'Edit date'))}</button>
            <button class="btn danger" type="button" data-sport-delete-session="${h.esc(String(session.id || ''))}">${h.esc(h.txt('Supprimer', 'Delete'))}</button>
          </div>
        </div>`;
      }).join('') : `<div class="muted">${h.esc(h.txt('Aucune seance enregistree.', 'No saved workout yet.'))}</div>`}
      ${hiddenCount ? `<div class="muted" style="margin-top:10px;">${h.esc(h.txt(`+ ${hiddenCount} seance(s) plus ancienne(s) masquee(s).`, `+ ${hiddenCount} older workout(s) hidden.`))}</div>` : ''}
    </div>`;
}

export function renderSportHistory({
  sessions = [],
  items = [],
  sets = [],
  status = '',
  error = '',
  recoverableAnonCount = 0,
  unsyncedLocalCount = 0,
  todayMergeCount = 0,
  planForSession = () => [],
  doneSetsForSession = () => [],
  api = {},
}) {
  const h = helpers(api);
  const statusHTML = status ? `<div class="tb-sport-status">${h.esc(status)}</div>` : '';
  const recover = recoverableAnonCount
    ? `<div class="tb-sport-status" style="margin-top:10px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
          <span>${h.esc(h.txt(`${recoverableAnonCount} ancienne(s) seance(s) locale(s) peuvent etre recuperee(s).`, `${recoverableAnonCount} old local workout(s) can be recovered.`))}</span>
          <button class="btn" type="button" id="sport-import-anon-history">${h.esc(h.txt('Recuperer', 'Recover'))}</button>
        </div>`
    : '';
  const sync = unsyncedLocalCount
    ? `<div class="tb-sport-status" style="margin-top:10px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
          <span>${h.esc(h.txt(`${unsyncedLocalCount} seance(s) locale(s) a synchroniser.`, `${unsyncedLocalCount} local workout(s) to sync.`))}</span>
          <button class="btn primary" type="button" id="sport-sync-local-history">${h.esc(h.txt('Synchroniser', 'Sync'))}</button>
        </div>`
    : '';
  const week = renderSportWeekVisual({ sessions, api });
  const grid = renderHistoryGrid({ sessions, items, sets, planForSession, doneSetsForSession, api });
  if (error) {
    return `<div class="tb-sport-card"><h3>${h.esc(h.txt('Historique', 'History'))}</h3>${statusHTML}${recover}${sync}<div class="muted" style="margin-top:10px;">${h.esc(h.txt('Synchro Supabase indisponible, historique local conserve.', 'Supabase sync unavailable, local history kept.'))} ${h.esc(error)}</div>${week}${grid}</div>`;
  }
  return `
      <div class="tb-sport-card">
        <h3>${h.esc(h.txt('Historique', 'History'))}</h3>
        ${statusHTML}
        ${recover}
        ${sync}
        ${todayMergeCount >= 2 ? `<div class="tb-sport-status" style="margin-top:10px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
          <span>${h.esc(h.txt(`${todayMergeCount} seances aujourd hui peuvent etre fusionnees.`, `${todayMergeCount} workouts today can be merged.`))}</span>
          <button class="btn primary" type="button" id="sport-merge-today">${h.esc(h.txt('Fusionner aujourd hui', 'Merge today'))}</button>
        </div>` : ''}
        ${week}
        ${grid}
      </div>`;
}
