import { describe, expect, it } from 'vitest';
import { renderSportHistory } from '../../../src/features/sport/sportHistoryView.js';
import { renderLoadRecommendations, renderPlannedSportWeek, renderProgramSettings } from '../../../src/features/sport/sportProgramView.js';
import { renderFinishWorkoutModal, renderFreeTimer, renderSportTimer } from '../../../src/features/sport/sportTimerView.js';

const api = {
  translate: (fr) => fr,
  escapeHTML: (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]),
  numberValue: (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  },
  formatSeconds: (seconds) => `${Math.round(Number(seconds || 0))}s`,
  labelActivity: (key) => ({ strength: 'Musculation', boxing: 'Boxe' }[key] || key),
  labelEquipment: (key) => ({ barbell: 'Barre', dumbbell: 'Haltere' }[key] || key || ''),
  localDateISO: (value) => String(value instanceof Date ? value.toISOString() : value || '').slice(0, 10),
  todayISO: () => '2026-07-07',
  supportsExternalLoad: (item) => item?.equipment === 'barbell',
  lastLoadForExercise: () => 55,
  effectiveLoadKg: () => 50,
  bodyWeight: () => 59,
  progressionRepRange: (item) => item?.repMin ? { min: item.repMin, max: item.repMax } : null,
  restSecondsForItem: (item) => item?.restSeconds || 90,
  shortWeekday: (day) => ({ '2026-07-06': 'Lun', '2026-07-07': 'Mar' }[day] || day),
  currentProgramWeek: () => 'A',
  nextPlannedSportRow: (days, day) => days.find((row) => row.planned && row.day >= day) || null,
  catchupPlannedSportRow: () => null,
  lastProgramSessionDone: () => ({ started_at: '2026-07-01T06:00:00', estimated_kcal: 310 }),
  sessionPlannedLoadSummary: () => 'Developpe couche 60 kg x 6-10',
  sessionProgressionPreview: () => 'Developpe couche : vise 6-10 reps.',
  sessionExerciseName: (item) => item?.exerciseName || '',
  plannedExerciseLoadLabel: () => '60 kg',
  exerciseProgressionRows: (session) => (session?.plan || []).map((item) => ({
    name: item.exerciseName,
    sets: item.sets,
    range: { min: item.repMin, max: item.repMax },
    inc: 2.5,
    loadLabel: '60 kg',
    external: true,
  })),
  nextMondayISO: () => '2026-07-13',
};

describe('Sport timer view', () => {
  it('renders the idle timer with disabled controls when no plan exists', () => {
    const html = renderSportTimer({ timer: null, plan: [], api });

    expect(html).toContain('Timer guide');
    expect(html).toContain('Construis ta seance');
    expect(html).toContain('id="sport-start" disabled');
    expect(html).toContain('id="sport-mark-done" disabled');
  });

  it('renders active set controls with load, rep range and next step', () => {
    const currentStep = {
      kind: 'work',
      setIndex: 2,
      item: { exerciseName: 'Developpe couche', activityKey: 'strength', equipment: 'barbell', mode: 'reps', targetReps: 8, repMin: 6, repMax: 10, sets: 3 },
    };
    const timer = {
      startedAt: 1000,
      stepEndAt: 60000,
      stepLoadKg: 57.5,
      stepReps: 9,
      doneSets: [{}],
      sequence: [
        { kind: 'work', setIndex: 1, item: currentStep.item },
        currentStep,
        { kind: 'rest', duration: 120 },
      ],
      index: 1,
      bodyWeightKg: 59,
    };

    const html = renderSportTimer({ timer, plan: [currentStep.item], currentStep, now: 31000, timerBeepVolume: 80, api });

    expect(html).toContain('Developpe couche');
    expect(html).toContain('9 vise 6-10 reps');
    expect(html).toContain('57.5 kg');
    expect(html).toContain('id="sport-step-load"');
    expect(html).toContain('id="sport-step-reps"');
    expect(html).toContain('id="sport-add-set"');
    expect(html).toContain('Bip');
  });

  it('renders the finish modal through the timer view with stable hooks', () => {
    const html = renderFinishWorkoutModal({
      summary: { durationSeconds: 1800, estimatedKcal: 320, doneSets: [{}, {}, {}] },
      api,
    });

    expect(html).toContain('Seance terminee');
    expect(html).toContain('1800s - 320 kcal - 3 series');
    expect(html).toContain('id="sport-finish-add-plank"');
    expect(html).toContain('id="sport-finish-add-stretch"');
    expect(html).toContain('data-mood="Tres bien"');
    expect(html).toContain('id="sport-finish-effort"');
    expect(html).toContain('id="sport-finish-save"');
  });

  it('renders the free timer selector and running actions with stable hooks', () => {
    const selected = { exerciseName: 'Course facile', activityKey: 'cardio', equipment: 'none', mode: 'time' };
    const idle = renderFreeTimer({
      selected,
      selectedKey: 'easy_run',
      exerciseOptionsHTML: '<option value="easy_run" selected>Course facile</option>',
      api,
    });
    expect(idle).toContain('Chrono libre');
    expect(idle).toContain('id="sport-free-exercise"');
    expect(idle).toContain('id="sport-free-start"');

    const running = renderFreeTimer({
      running: { paused: false },
      selected,
      elapsedSeconds: 90,
      timerFocus: true,
      api,
    });
    expect(running).toContain('tb-sport-free-card focus');
    expect(running).toContain('90s');
    expect(running).toContain('id="sport-free-focus"');
    expect(running).toContain('id="sport-free-stop"');
    expect(running).toContain('id="sport-free-pause"');
    expect(running).toContain('id="sport-free-cancel"');
  });

  it('renders free timer result fields when stopped', () => {
    const html = renderFreeTimer({
      running: { stoppedAt: 1000, resultReps: 12, resultWeightKg: 55, resultDistanceM: 5000 },
      selected: { exerciseName: 'Developpe couche', activityKey: 'strength', equipment: 'barbell', mode: 'reps' },
      elapsedSeconds: 120,
      stopped: true,
      api,
    });

    expect(html).toContain('id="sport-free-reps"');
    expect(html).toContain('id="sport-free-load"');
    expect(html).toContain('id="sport-free-distance"');
    expect(html).toContain('id="sport-free-effort"');
    expect(html).toContain('id="sport-free-save"');
    expect(html).toContain('5 km');
  });
});

describe('Sport history view', () => {
  it('renders week visual, merge affordance and workout details', () => {
    const sessions = [
      { id: 's1', activity_type: 'strength', started_at: '2026-07-07T06:00:00', duration_seconds: 1800, estimated_kcal: 250, perceived_effort: 8 },
      { id: 's2', activity_type: 'boxing', started_at: '2026-07-07T18:00:00', duration_seconds: 900, estimated_kcal: 160 },
    ];
    const items = [
      { id: 'i1', session_id: 's1', activity_key: 'strength', exercise_name: 'Squat arriere' },
    ];
    const sets = [
      { item_id: 'i1' },
    ];
    const html = renderSportHistory({
      sessions,
      items,
      sets,
      status: 'Historique synchronise',
      todayMergeCount: 2,
      planForSession: () => [{ exerciseName: 'Squat arriere', activityKey: 'strength', equipment: 'barbell', mode: 'reps', targetReps: 10, sets: 3 }],
      doneSetsForSession: () => [{ itemIndex: 0, setIndex: 1, reps: 10, weightKg: 75 }],
      api,
    });

    expect(html).toContain('Historique synchronise');
    expect(html).toContain('Fusionner aujourd hui');
    expect(html).toContain('Semaine sport');
    expect(html).toContain('Squat arriere');
    expect(html).toContain('#1');
    expect(html).toContain('75 kg');
    expect(html).toContain('data-sport-edit-session="s1"');
  });

  it('renders recovery and sync banners without owning legacy handlers', () => {
    const html = renderSportHistory({
      sessions: [],
      recoverableAnonCount: 1,
      unsyncedLocalCount: 2,
      error: 'network down',
      api,
    });

    expect(html).toContain('sport-import-anon-history');
    expect(html).toContain('sport-sync-local-history');
    expect(html).toContain('Synchro Supabase indisponible');
    expect(html).toContain('Aucune seance enregistree');
  });
});

describe('Sport program view', () => {
  it('renders planned week cockpit with start, prepare and load hints', () => {
    const days = [
      { day: '2026-07-06', weekday: 1, code: 'A1', weekLabel: 'A', planned: true, session: { id: 'a1', name: 'A1 Poussee', plan: [{ exerciseName: 'Developpe couche', equipment: 'barbell', mode: 'reps', sets: 3, repMin: 6, repMax: 10, restSeconds: 180 }] } },
      { day: '2026-07-07', weekday: 2, code: '', weekLabel: 'A', planned: false, session: null },
    ];

    const html = renderPlannedSportWeek({ days, program: { enabled: true }, api: { ...api, todayISO: () => '2026-07-06' } });

    expect(html).toContain('Cockpit entrainement');
    expect(html).toContain('data-sport-load-session-favorite="a1"');
    expect(html).toContain('Developpe couche 60 kg x 6-10');
    expect(html).toContain('+2.5 kg quand toutes les series touchent 10');
    expect(html).toContain('Repos');
  });

  it('renders editable A/B planning controls', () => {
    const html = renderProgramSettings({
      program: { enabled: true, startDate: '2026-07-06', cycle: 'A/B', days: { 1: 'A1/B1', 5: 'A3/B3' } },
      api,
    });

    expect(html).toContain('id="sport-program-enabled"');
    expect(html).toContain('id="sport-program-start" type="date" value="2026-07-06"');
    expect(html).toContain('data-sport-program-day="1"');
    expect(html).toContain('<option value="A1/B1" selected>A1 / B1</option>');
    expect(html).toContain('id="sport-program-reset"');
  });
});

describe('Sport progression view', () => {
  it('renders load recommendations with stable action hooks', () => {
    const html = renderLoadRecommendations({
      recommendations: [{
        id: 'rec-1',
        exercise_id: 'barbell_bench_press',
        program_exercise_id: 'program-ex-1',
        recommended_weight_kg: 65,
        reason_text: 'Haut de plage atteint.',
      }],
      api,
    });

    expect(html).toContain('Recommandations de charge');
    expect(html).toContain('barbell_bench_press');
    expect(html).toContain('65 kg');
    expect(html).toContain('data-sport-apply-load-recommendation="rec-1"');
    expect(html).toContain('data-sport-apply-all-load-recommendation="rec-1"');
    expect(html).toContain('data-sport-modify-load-recommendation="rec-1"');
    expect(html).toContain('data-sport-reject-load-recommendation="rec-1"');
  });
});
