import { describe, expect, it } from 'vitest';
import {
  buildSportProfileRadarData,
  chooseBestCapacity,
  exerciseProfileBucket,
  profileExerciseCapacity,
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

    const push = data.axes.find((axis) => axis.key === 'push');
    expect(push.raw).toContain('Developpe couche');
    expect(push.basis).toBe('developpe couche 1.35 x PDC');
    expect(push.value).toBeLessThan(100);
    expect(push.value).toBeGreaterThan(80);
  });
});
