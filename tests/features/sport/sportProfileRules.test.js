import { describe, expect, it } from 'vitest';
import {
  buildExerciseProgressionRowsFromSessions,
  buildExerciseProgressionAnalysis,
  buildBodyCompositionAnalysis,
  buildCardioCapacity,
  buildMobilityAnalysis,
  buildSportProfileRadarData,
  chooseBestCapacity,
  exerciseProfileBucket,
  profileExerciseCapacity,
  estimateVmaFromRun,
} from '../../../src/features/sport/sportProfileRules.js';

const api = {
  numberValue: (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  },
  labelActivity: (key) => key || '',
  localDateISO: (value) => String(value instanceof Date ? value.toISOString() : value || '').slice(0, 10),
};

describe('Sport profile rules', () => {
  it('classifies bench press as push and triceps extension as lower-priority push', () => {
    expect(exerciseProfileBucket({ exerciseName: 'Developpe couche', equipment: 'barbell' })).toBe('push');
    expect(exerciseProfileBucket({ exerciseName: 'Extension triceps', equipment: 'dumbbell' })).toBe('push');

    const bench = profileExerciseCapacity(
      { exerciseName: 'Developpe couche', equipment: 'barbell', mode: 'reps' },
      { reps: 10, weightKg: 55 },
      'push',
      59,
      api,
    );
    const triceps = profileExerciseCapacity(
      { exerciseName: 'Extension triceps', equipment: 'dumbbell', mode: 'reps' },
      { reps: 10, weightKg: 30 },
      'push',
      59,
      api,
    );

    expect(bench.priority).toBeGreaterThan(triceps.priority);
    expect(bench.basis).toContain('developpe couche 1.35 x PDC');
    expect(triceps.basis).toContain('isolation');
  });

  it('prefers a main push movement over a triceps isolation even when isolation has a high score', () => {
    const bench = profileExerciseCapacity(
      { exerciseName: 'Developpe couche', equipment: 'barbell', mode: 'reps' },
      { reps: 10, weightKg: 55 },
      'push',
      59,
      api,
    );
    const triceps = profileExerciseCapacity(
      { exerciseName: 'Extension triceps', equipment: 'dumbbell', mode: 'reps' },
      { reps: 15, weightKg: 40 },
      'push',
      59,
      api,
    );

    expect(triceps.score).toBeGreaterThanOrEqual(bench.score);
    expect(chooseBestCapacity(triceps, bench)).toBe(bench);
  });

  it('builds a stricter radar with bench as the push basis', () => {
    const data = buildSportProfileRadarData({
      now: new Date('2026-07-07T12:00:00.000Z'),
      bodyWeightKg: 59,
      sessions: [{ id: 's1', started_at: '2026-07-07T06:00:00.000Z', duration_seconds: 2600, estimated_kcal: 300, body_weight_kg: 59 }],
      planForSession: () => [
        { exerciseName: 'Extension triceps', equipment: 'dumbbell', mode: 'reps' },
        { exerciseName: 'Developpe couche', equipment: 'barbell', mode: 'reps' },
      ],
      doneSetsForSession: () => [
        { itemIndex: 0, reps: 15, weightKg: 40 },
        { itemIndex: 1, reps: 10, weightKg: 55 },
      ],
      sleepRows: {
        '2026-07-05': { hours: 8 },
        '2026-07-06': { hours: 8 },
      },
      api,
    });

    const push = data.classicAxes.find((axis) => axis.key === 'push');
    expect(push.raw).toContain('Developpe couche');
    expect(push.basis).toBe('developpe couche 1.35 x PDC');
    expect(push.value).toBeLessThan(100);
    expect(push.value).toBeGreaterThan(60);
    expect(data.axes.map((axis) => axis.key)).toEqual(['force', 'endurance', 'cardio', 'explosive', 'mobility', 'recovery']);
    expect(data.athleticProfile.priority).toContain('10 a 12 points');
    expect(data.athleticProfile.archetypes.map((row) => row.label)).toEqual(['Grimpeur', 'Powerlifter', 'Hyrox', 'Endurance']);
    expect(data.athleticProfile.balances[0].label).toBe('Poussee / Tirage');
  });

  it('prioritizes measured VMA, then estimated VMA, then kcal per minute', () => {
    const sessions = [{
      id: 'run-1',
      duration_seconds: 360,
      estimated_kcal: 90,
      perceived_effort: 9,
    }];
    const planForSession = () => [{ exerciseName: 'Test course 6 min', activityKey: 'running', mode: 'time' }];
    const doneSetsForSession = () => [{ itemIndex: 0, durationSeconds: 360, distanceM: 1500 }];

    const measured = buildCardioCapacity({
      measuredVmaKmh: 17.2,
      sessions,
      planForSession,
      doneSetsForSession,
    });
    expect(measured.source).toBe('measured_vma');
    expect(measured.vmaKmh).toBe(17.2);

    const estimated = buildCardioCapacity({ sessions, planForSession, doneSetsForSession });
    expect(estimated.source).toBe('estimated_vma');
    expect(estimated.vmaKmh).toBe(15);
    expect(estimated.averageSpeedKmh).toBe(15);

    const fallback = buildCardioCapacity({
      sessions: [{ id: 'bike-1', duration_seconds: 600, estimated_kcal: 120 }],
      planForSession: () => [{ exerciseName: 'Velo', activityKey: 'cycling' }],
      doneSetsForSession: () => [],
    });
    expect(fallback.source).toBe('kcal_per_min');
    expect(fallback.raw).toBe('12 kcal/min');
  });

  it('only estimates VMA from a credible test or high perceived effort', () => {
    expect(estimateVmaFromRun({
      distanceM: 1500,
      durationSeconds: 360,
      perceivedEffort: 6,
      label: 'Footing facile',
    })).toBeNull();
    expect(estimateVmaFromRun({
      distanceM: 1500,
      durationSeconds: 360,
      perceivedEffort: 9,
      label: 'Course',
    })).toMatchObject({ vmaKmh: 15, averageSpeedKmh: 15 });
  });

  it('analyzes comparable impedance trends and warns about hydration shifts', () => {
    const analysis = buildBodyCompositionAnalysis([
      {
        measured_on: '2026-07-01',
        weight_kg: 70,
        body_fat_pct: 20,
        lean_mass_kg: 56,
        body_water_pct: 55,
        protocol_quality_score: 90,
      },
      {
        measured_on: '2026-07-22',
        weight_kg: 71,
        body_fat_pct: 19.5,
        lean_mass_kg: 57.2,
        body_water_pct: 57.2,
        protocol_quality_score: 92,
      },
    ]);

    expect(analysis.previous.measured_on).toBe('2026-07-01');
    expect(analysis.metrics.find((row) => row.key === 'lean_mass_kg').delta).toBe(1.2);
    expect(analysis.insights.join(' ')).toContain('masse maigre');
    expect(analysis.warnings.join(' ')).toContain('Variation d eau');
  });

  it('builds the simple five-test mobility score and exposes pain separately', () => {
    const performed_at = '2026-07-23T08:00:00Z';
    const analysis = buildMobilityAnalysis([
      { performed_at, test_code: 'toe_touch', central_value: 2, central_pain: 0 },
      { performed_at, test_code: 'deep_squat', central_value: 1, central_pain: 0 },
      { performed_at, test_code: 'shoulder_reach', central_value: 2, central_pain: 0 },
      { performed_at, test_code: 'trunk_rotation', central_value: 1, central_pain: 2 },
      { performed_at, test_code: 'ankle_wall', central_value: 1, central_pain: 0 },
    ]);

    expect(analysis.score10).toBe(7);
    expect(analysis.radarScore).toBe(70);
    expect(analysis.label).toBe('correcte');
    expect(analysis.warnings).toEqual(['Rotation du tronc: douleur 2/10']);
  });

  it('builds load progression analysis with main lifts first and exercise filtering', () => {
    const rows = [
      { exercise_id: 'extension_triceps', estimated_1rm_kg: 32, weight_kg: 25, reps: 8, created_at: '2026-07-05T08:00:00Z' },
      { exercise_id: 'barbell_bench_press', estimated_1rm_kg: 72, weight_kg: 60, reps: 6, created_at: '2026-07-02T08:00:00Z' },
      { exercise_id: 'barbell_bench_press', estimated_1rm_kg: 76, weight_kg: 62.5, reps: 6, created_at: '2026-07-09T08:00:00Z' },
      { exercise_id: 'barbell_back_squat', estimated_1rm_kg: 104, weight_kg: 82.5, reps: 8, created_at: '2026-07-06T08:00:00Z' },
    ];

    const all = buildExerciseProgressionAnalysis(rows);
    expect(all.exercises[0].key).toBe('barbell_back_squat');
    expect(all.exercises[1].key).toBe('barbell_bench_press');
    expect(all.exercises[1].delta).toBe(4);
    expect(all.options.map((row) => row.key)).toContain('barbell_bench_press');

    const filtered = buildExerciseProgressionAnalysis(rows, { selectedExercise: 'barbell_bench_press' });
    expect(filtered.exercises).toHaveLength(1);
    expect(filtered.exercises[0].best.estimated_1rm_kg).toBe(76);
  });

  it('rebuilds e1RM progression rows from stored workout sets when metric history is empty', () => {
    const rows = buildExerciseProgressionRowsFromSessions({
      sessions: [{ id: 'session-1', started_at: '2026-07-10T06:00:00Z' }],
      planForSession: () => [
        { exerciseName: 'Squat arriere', exerciseKey: 'barbell_back_squat' },
        { exerciseName: 'Developpe couche', exerciseKey: 'barbell_bench_press' },
      ],
      doneSetsForSession: () => [
        { itemIndex: 0, setIndex: 1, reps: 8, weightKg: 80, completedAt: '2026-07-10T06:10:00Z' },
        { itemIndex: 1, setIndex: 1, reps: 6, weightKg: 60, completedAt: '2026-07-10T06:20:00Z' },
      ],
    });

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      exercise_id: 'barbell_back_squat',
      session_id: 'session-1',
      estimated_1rm_kg: 101.3,
      calculation_method: 'epley_set_fallback',
    });
  });
});
