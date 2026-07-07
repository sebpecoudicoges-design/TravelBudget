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
    supportsExternalLoad: api.supportsExternalLoad || (() => false),
    lastLoadForExercise: api.lastLoadForExercise || (() => 0),
    setWorkSeconds: api.setWorkSeconds || (() => 0),
  };
}

export function renderSandboxSetRow({ set, index, plan = [], api = {} }) {
  const h = helpers(api);
  const item = plan[Math.max(0, Math.round(h.n(set?.itemIndex, 0)))] || {};
  const isReps = item.mode === 'reps' || set?.reps != null;
  const supportsLoad = h.supportsExternalLoad(item);
  const loadValue = supportsLoad
    ? (h.n(set?.weightKg, 0) > 0 ? h.n(set.weightKg, 0) : h.lastLoadForExercise(item, set?.weightKg))
    : 0;
  return `<div class="tb-sport-set-editor-row">
        <div>
          <strong>${h.esc(item.exerciseName || h.labelActivity(item.activityKey || 'strength'))}</strong>
          <div class="muted">${h.esc(h.txt('Serie', 'Set'))} ${h.esc(String(set?.setIndex || index + 1))} · ${h.fmtSec(set?.durationSeconds || 0)} · MET ${h.esc(String(Math.round(h.n(item.metValue, 0) * 10) / 10))}</div>
        </div>
        <label style="display:grid;gap:4px;">
          <span class="muted" style="font-size:12px;">${h.esc(h.txt('Reps', 'Reps'))}</span>
          <input data-sport-sandbox-reps="${index}" type="number" min="0" step="1" inputmode="numeric" value="${h.esc(String(isReps ? Math.round(h.n(set?.reps, item.targetReps || 0)) : ''))}" ${isReps ? '' : 'disabled'} />
        </label>
        <label style="display:grid;gap:4px;">
          <span class="muted" style="font-size:12px;">sec</span>
          <input data-sport-sandbox-seconds="${index}" type="number" min="0" step="1" inputmode="numeric" value="${h.esc(String(Math.round(h.n(set?.durationSeconds, h.setWorkSeconds(item)))))}" />
        </label>
        <label style="display:grid;gap:4px;">
          <span class="muted" style="font-size:12px;">kg</span>
          <input data-sport-sandbox-load="${index}" type="number" step="0.5" inputmode="decimal" value="${h.esc(String(loadValue))}" ${supportsLoad ? '' : 'disabled'} />
        </label>
        <button class="btn danger small" type="button" data-sport-sandbox-delete="${index}" title="${h.esc(h.txt('Supprimer la serie', 'Delete set'))}">&times;</button>
      </div>`;
}

export function renderSandboxSetList({ doneSets = [], plan = [], api = {} }) {
  return (doneSets || []).map((set, index) => renderSandboxSetRow({ set, index, plan, api })).join('');
}

export function renderSandboxContent({
  session = {},
  plan = [],
  doneSets = [],
  weightKg = 0,
  api = {},
}) {
  const h = helpers(api);
  return `
        <div class="tb-sport-stats" style="margin:12px 0;">
          <div class="tb-sport-stat"><span>${h.esc(h.txt('Avant', 'Before'))}</span><strong>${Math.round(h.n(session.estimated_kcal || session.estimatedKcal, 0))} kcal</strong></div>
          <div class="tb-sport-stat"><span>${h.esc(h.txt('Apres', 'After'))}</span><strong id="sport-sandbox-kcal">0 kcal</strong></div>
          <div class="tb-sport-stat"><span>${h.esc(h.txt('Series', 'Sets'))}</span><strong id="sport-sandbox-set-count">${doneSets.length}</strong></div>
          <div class="tb-sport-stat"><span>${h.esc(h.txt('Poids corps', 'Body weight'))}</span><strong>${Math.round(h.n(weightKg, 0) * 10) / 10} kg</strong></div>
        </div>
        <div style="display:flex;gap:8px;align-items:end;flex-wrap:wrap;margin-bottom:10px;">
          <label style="display:grid;gap:4px;min-width:220px;flex:1;">
            <span class="muted" style="font-size:12px;">${h.esc(h.txt('Ajouter une serie', 'Add a set'))}</span>
            <select id="sport-sandbox-add-exercise">
              ${plan.map((item, idx) => `<option value="${idx}">${h.esc(item.exerciseName || h.labelActivity(item.activityKey || 'strength'))}</option>`).join('')}
            </select>
          </label>
          <button class="btn" type="button" id="sport-sandbox-add-set">+ ${h.esc(h.txt('Serie', 'Set'))}</button>
        </div>
        <div style="display:grid;gap:8px;" id="sport-sandbox-set-list">
          ${renderSandboxSetList({ doneSets, plan, api })}
        </div>`;
}

export function renderSandboxActions({ api = {} } = {}) {
  const h = helpers(api);
  return `<button class="btn" type="button" id="sport-sandbox-cancel">${h.esc(h.txt('Annuler', 'Cancel'))}</button><button class="btn primary" type="button" id="sport-sandbox-save">${h.esc(h.txt('Sauvegarder', 'Save'))}</button>`;
}
