import { describe, expect, it } from 'vitest';
import { renderSportHistory } from '../../../src/features/sport/sportHistoryView.js';
import { renderSportTimer } from '../../../src/features/sport/sportTimerView.js';

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
