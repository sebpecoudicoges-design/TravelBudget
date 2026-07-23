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
    supportsExternalLoad: api.supportsExternalLoad || (() => false),
    lastLoadForExercise: api.lastLoadForExercise || (() => 0),
    effectiveLoadKg: api.effectiveLoadKg || (() => 0),
    bodyWeight: api.bodyWeight || (() => 0),
    progressionRepRange: api.progressionRepRange || (() => null),
  };
}

export function stepLabel(step, api) {
  const h = helpers(api);
  if (!step) return h.txt('Fin', 'End');
  if (step.kind === 'round_rest') return `${h.txt('Fin du tour', 'End of round')} ${step.roundIndex}`;
  if (step.kind === 'rest') return h.txt('Repos', 'Rest');
  return step.item?.exerciseName || h.labelActivity(step.item?.activityKey || 'strength');
}

export function repRangeText(item, api) {
  const h = helpers(api);
  const range = h.progressionRepRange(item);
  if (range && range.max > range.min) return `${range.min}-${range.max} reps`;
  return `${Math.max(0, Math.round(h.n(item?.targetReps, 0)))} reps`;
}

export function stepLoadText(step, timer, api, currentStep) {
  const h = helpers(api);
  if (!step?.item || !h.supportsExternalLoad(step.item)) return '';
  const base = h.effectiveLoadKg(step.item, timer?.bodyWeightKg || h.bodyWeight());
  const kg = step === currentStep
    ? h.n(timer?.stepLoadKg, h.lastLoadForExercise(step.item, base))
    : h.lastLoadForExercise(step.item, base);
  const label = step.item?.loadLabel ? ` · ${step.item.loadLabel}` : '';
  return `${Math.round(kg * 10) / 10} kg${label}`;
}

export function stepTargetText(step, timer, api) {
  const h = helpers(api);
  if (!step?.item) return '';
  if (step.kind !== 'work') return step.duration ? h.fmtSec(step.duration) : '';
  if (step.item.mode === 'time') return h.fmtSec(step.item.targetSeconds || step.duration || 0);
  return repRangeText(step.item, api);
}

export function stepPreviewText(step, timer, api, currentStep) {
  const h = helpers(api);
  if (!step) return h.txt('Fin de seance', 'End of workout');
  if (step.kind !== 'work') return `${stepLabel(step, api)}${step.duration ? ` · ${h.fmtSec(step.duration)}` : ''}`;
  return [stepLabel(step, api), stepLoadText(step, timer, api, currentStep), stepTargetText(step, timer, api)].filter(Boolean).join(' · ');
}

export function timerStepGoalText(step, timer, api) {
  const h = helpers(api);
  if (!step?.item) return '-';
  if (step.kind !== 'work') return step.duration ? h.fmtSec(step.duration) : '-';
  if (step.item.mode === 'time') return h.fmtSec(step.item.targetSeconds || step.duration || 0);
  const current = Math.max(0, Math.round(h.n(timer?.stepReps ?? step.item.targetReps, 0)));
  const range = repRangeText(step.item, api);
  return range.includes('-') ? `${current} vise ${range}` : `${current} reps`;
}

export function renderTimerTimeline({ timer, api, currentStep }) {
  const h = helpers(api);
  const seq = timer?.sequence || [];
  const start = Math.max(0, h.n(timer?.index, 0) - 1);
  const rows = seq.slice(start, start + 5);
  return rows.map((row, idx) => {
    const absolute = start + idx;
    const active = absolute === timer.index;
    const kind = row.kind === 'work' ? h.txt('Serie', 'Set') : row.kind === 'round_rest' ? h.txt('Tour', 'Round') : h.txt('Repos', 'Rest');
    const detail = row.kind === 'work'
      ? `${row.setIndex || 1}/${Math.max(1, h.n(row.item?.sets, row.setIndex || 1))}`
      : (row.duration ? h.fmtSec(row.duration) : '');
    return `<div class="tb-sport-time-step ${active ? 'active' : ''}">
        <small>${h.esc(kind)} ${h.esc(detail)}</small>
        <b>${h.esc(stepLabel(row, api))}</b>
        ${row.kind === 'work' ? `<small>${h.esc([stepLoadText(row, timer, api, currentStep), stepTargetText(row, timer, api)].filter(Boolean).join(' · '))}</small>` : ''}
      </div>`;
  }).join('');
}

export function renderSportTimer({
  timer,
  plan = [],
  circuit = {},
  timerFocus = false,
  timerBeepVolume = 70,
  currentStep = null,
  now = Date.now(),
  api = {},
}) {
  const h = helpers(api);
  if (!timer) {
    return `
        <div class="tb-sport-card">
          <h3>${h.esc(h.txt('Timer guide', 'Guided timer'))}</h3>
          <div class="tb-sport-timer">
            <div class="kind">${h.esc(h.txt('Pret', 'Ready'))}</div>
            <div class="name">${h.esc(h.txt('Construis ta seance', 'Build your workout'))}</div>
            <div class="hint">${h.esc(h.txt('Lance le timer apres avoir ajoute tes exercices.', 'Start the timer after adding exercises.'))}</div>
            <div class="tb-sport-actions" style="justify-content:center;">
              <button class="btn primary" type="button" id="sport-start" ${plan.length ? '' : 'disabled'}>${h.esc(h.txt('Lancer la seance', 'Start workout'))}</button>
              <button class="btn" type="button" id="sport-mark-done" ${plan.length ? '' : 'disabled'}>${h.esc(h.txt('Marquer faite', 'Mark done'))}</button>
            </div>
          </div>
        </div>`;
  }

  const step = currentStep;
  const elapsed = Math.max(0, Math.round((now - timer.startedAt) / 1000));
  const remaining = step && step.duration ? Math.max(0, Math.ceil((timer.stepEndAt - now) / 1000)) : 0;
  const workDone = timer.doneSets.length;
  const totalWork = timer.sequence.filter((row) => row.kind === 'work').length;
  const isRest = step?.kind === 'rest' || step?.kind === 'round_rest';
  const displayValue = isRest ? h.fmtSec(remaining) : (step?.item?.mode === 'time' ? h.fmtSec(remaining) : `${h.n(timer.stepReps ?? step?.item?.targetReps, 0)} reps`);
  const roundInfo = step?.roundIndex ? ` - ${h.esc(h.txt('Tour', 'Round'))} ${step.roundIndex}${step.roundTotal ? `/${step.roundTotal}` : ''}` : '';
  const amrap = circuit?.enabled && h.n(circuit?.amrapMinutes, 0) > 0;
  const amrapRemaining = amrap && timer.timeCapEndAt ? Math.max(0, Math.ceil((timer.timeCapEndAt - now) / 1000)) : 0;
  const volume = Math.max(0, Math.min(100, Math.round(h.n(timerBeepVolume, 70))));
  const loadText = step?.kind === 'work' && h.supportsExternalLoad(step.item)
    ? `${Math.round(h.n(timer.stepLoadKg, 0) * 10) / 10} kg${step.item?.loadLabel ? ` · ${step.item.loadLabel}` : ''}`
    : '-';
  const next = timer.sequence[timer.index + 1];
  const nextPreview = stepPreviewText(next, timer, api, step);

  return `
      <div class="tb-sport-card tb-sport-timer-card ${timerFocus ? 'focus' : ''}">
        <h3>${h.esc(h.txt('Timer guide', 'Guided timer'))}</h3>
        <div class="tb-sport-timer tb-sport-timer-v2">
          <div class="tb-sport-live-head">
            <div>
              <div class="kind">${h.esc(isRest ? h.txt('Repos', 'Rest') : h.txt('Travail', 'Work'))}${roundInfo}</div>
              <div class="hint" data-sport-timer-progress>${h.esc(h.txt('Progression', 'Progress'))}: ${workDone}/${totalWork} · ${h.esc(h.txt('Temps total', 'Total time'))}: ${h.fmtSec(elapsed)}</div>
            </div>
            <div class="tb-sport-actions" style="justify-content:flex-end;">
              <button class="btn small" type="button" id="sport-timer-focus">${h.esc(timerFocus ? h.txt('Reduire', 'Exit focus') : h.txt('Grand ecran', 'Big screen'))}</button>
              ${amrap ? `<div class="tb-sport-next">${h.esc(h.txt('AMRAP', 'AMRAP'))}: ${h.fmtSec(amrapRemaining)} · ${h.esc(h.txt('Tours', 'Rounds'))}: ${h.n(timer.roundsCompleted, 0)}</div>` : `<div class="tb-sport-next">${h.esc(h.txt('Ensuite', 'Next'))}: ${h.esc(nextPreview)}</div>`}
            </div>
          </div>
          <div class="tb-sport-live-main">
            <div class="tb-sport-live-focus">
              <div class="name">${h.esc(isRest ? stepLabel(step, api) : (step?.item?.exerciseName || ''))}</div>
              <div class="clock" data-sport-timer-clock>${h.esc(displayValue)}</div>
              <div class="hint">${step?.kind === 'work' ? `${h.esc(h.labelEquipment(step.item.equipment))} · ${h.esc(h.txt('Objectif', 'Target'))}: ${h.esc(timerStepGoalText(step, timer, api))}` : h.esc(h.txt('Respire, prochaine serie prete.', 'Breathe, next set is ready.'))}</div>
            </div>
            <div class="tb-sport-live-panel">
              <div class="tb-sport-live-grid">
                <div class="tb-sport-live-kpi"><span>${h.esc(h.txt('Serie', 'Set'))}</span><strong>${step?.setIndex || '-'}${step?.item?.sets ? ` / ${Math.max(h.n(step.item.sets, 1), h.n(step.setIndex, 1))}` : ''}</strong></div>
                <div class="tb-sport-live-kpi"><span>${h.esc(h.txt('Prochaine', 'Next'))}</span><strong>${h.esc(nextPreview)}</strong></div>
                <div class="tb-sport-live-kpi"><span>${h.esc(h.txt('Charge', 'Load'))}</span><strong>${h.esc(loadText)}</strong></div>
                <div class="tb-sport-live-kpi"><span>${h.esc(h.txt('Fait', 'Done'))}</span><strong>${workDone} ${h.esc(h.txt('series', 'sets'))}</strong></div>
              </div>
              ${step?.kind === 'work' ? (h.supportsExternalLoad(step.item) ? `<div class="tb-sport-control-row">
              <span class="hint">${h.esc(h.txt('Charge serie', 'Set load'))}</span>
              <button class="btn small" type="button" data-sport-load-delta="-2.5">-2.5</button>
              <input id="sport-step-load" type="number" step="0.5" inputmode="decimal" value="${h.esc(String(h.n(timer.stepLoadKg ?? h.lastLoadForExercise(step.item, h.effectiveLoadKg(step.item, timer.bodyWeightKg)), 0)))}" />
              <button class="btn small" type="button" data-sport-load-delta="2.5">+2.5</button>
              <span class="hint">kg · ${h.esc(h.txt('dernier', 'last'))}: ${Math.round(h.lastLoadForExercise(step.item, h.effectiveLoadKg(step.item, timer.bodyWeightKg)) * 10) / 10}</span>
            </div>` : `<div class="hint">${h.esc(h.txt('Charge externe', 'External load'))}: 0 kg</div>`) : ''}
          ${step?.kind === 'work' && step?.item?.mode === 'reps' ? `<div class="tb-sport-control-row">
            <span class="hint">${h.esc(h.txt('Reps serie', 'Set reps'))}</span>
            <button class="btn small" type="button" data-sport-reps-delta="-1">-1</button>
            <input id="sport-step-reps" type="number" step="1" inputmode="numeric" min="0" value="${h.esc(String(Math.max(0, Math.round(h.n(timer.stepReps ?? step.item.targetReps, 0)))))}" />
            <button class="btn small" type="button" data-sport-reps-delta="1">+1</button>
          </div>` : ''}
            </div>
          </div>
          <div class="tb-sport-timeline">${renderTimerTimeline({ timer, api, currentStep: step })}</div>
          <div class="tb-sport-volume-row">
            <span>${h.esc(h.txt('Bip', 'Beep'))} ${volume}%</span>
            <input id="sport-beep-volume" type="range" min="0" max="100" step="5" value="${h.esc(String(volume))}">
            <button class="btn small" type="button" id="sport-beep-test">${h.esc(h.txt('Tester', 'Test'))}</button>
          </div>
          <div class="tb-sport-actions" style="justify-content:center;">
            ${step?.kind === 'work' ? `<button class="btn primary" type="button" id="sport-step-done">${h.esc(h.txt('Fini', 'Done'))}</button>` : ''}
            ${step?.item && !amrap ? `<button class="btn" type="button" id="sport-add-set">+ ${h.esc(circuit?.enabled ? h.txt('Tour', 'Round') : h.txt('serie', 'set'))}</button>` : ''}
            ${isRest ? `<button class="btn primary" type="button" id="sport-skip-rest">${h.esc(h.txt('Sauter le repos', 'Skip rest'))}</button>` : ''}
            ${step?.duration ? '<button class="btn" type="button" id="sport-minus-time">-15s</button><button class="btn" type="button" id="sport-plus-time">+30s</button>' : ''}
            <button class="btn" type="button" id="sport-pause">${timer.paused ? h.esc(h.txt('Reprendre', 'Resume')) : h.esc(h.txt('Pause', 'Pause'))}</button>
            <button class="btn danger" type="button" id="sport-finish">${h.esc(h.txt('Terminer', 'Finish'))}</button>
          </div>
        </div>
      </div>`;
}

export function renderFinishWorkoutModal({
  summary = {},
  api = {},
} = {}) {
  const h = helpers(api);
  const durationSeconds = h.n(summary.durationSeconds ?? summary.duration_seconds, 0);
  const estimatedKcal = h.n(summary.estimatedKcal ?? summary.estimated_kcal, 0);
  const doneSets = Array.isArray(summary.doneSets) ? summary.doneSets : [];

  return `
      <div class="tb-sport-modal">
        <h3>${h.esc(h.txt('Seance terminee', 'Workout complete'))}</h3>
        <div class="muted" id="sport-finish-summary-line">${h.fmtSec(durationSeconds)} - ${Math.round(estimatedKcal)} kcal - ${doneSets.length} ${h.esc(h.txt('series', 'sets'))}</div>
        <div class="tb-sport-field" style="margin-top:12px;">
          <label>${h.esc(h.txt('Ajouter a la fin', 'Add at the end'))}</label>
          <div class="tb-sport-choice-row">
            <button class="tb-sport-choice" type="button" id="sport-finish-add-plank">+ ${h.esc(h.txt('Planche 1 min', 'Plank 1 min'))}</button>
            <button class="tb-sport-choice" type="button" id="sport-finish-add-stretch">+ ${h.esc(h.txt('Stretch 5 min', 'Stretch 5 min'))}</button>
          </div>
        </div>
        <div class="tb-sport-field" style="margin-top:14px;">
          <label>${h.esc(h.txt('Comment tu te sens ?', 'How do you feel?'))}</label>
          <div class="tb-sport-choice-row" id="sport-finish-mood">
            <button class="tb-sport-choice" type="button" data-mood="${h.esc(h.txt('Tres bien', 'Great'))}">${h.esc(h.txt('Tres bien', 'Great'))}</button>
            <button class="tb-sport-choice" type="button" data-mood="${h.esc(h.txt('OK', 'OK'))}">${h.esc(h.txt('OK', 'OK'))}</button>
            <button class="tb-sport-choice" type="button" data-mood="${h.esc(h.txt('Dur', 'Hard'))}">${h.esc(h.txt('Dur', 'Hard'))}</button>
            <button class="tb-sport-choice" type="button" data-mood="${h.esc(h.txt('Douleur', 'Pain'))}">${h.esc(h.txt('Douleur', 'Pain'))}</button>
          </div>
        </div>
        <div class="tb-sport-field">
          <label>${h.esc(h.txt('Effort ressenti /10', 'Perceived effort /10'))}</label>
          <input id="sport-finish-effort" type="range" min="1" max="10" value="6">
          <div class="muted"><span id="sport-finish-effort-value">6</span>/10</div>
        </div>
        <div class="tb-sport-field" style="margin-top:10px;">
          <label>${h.esc(h.txt('Notes', 'Notes'))}</label>
          <textarea id="sport-finish-notes" rows="3" placeholder="${h.esc(h.txt('Ex : bonne forme, epaule sensible, a refaire...', 'E.g. felt good, shoulder sensitive, repeat this...'))}"></textarea>
        </div>
        <div class="tb-sport-actions" style="justify-content:flex-end;margin-top:14px;">
          <button class="btn" type="button" id="sport-finish-cancel">${h.esc(h.txt('Ignorer', 'Skip'))}</button>
          <button class="btn primary" type="button" id="sport-finish-save">${h.esc(h.txt('Sauvegarder', 'Save'))}</button>
        </div>
      </div>`;
}
