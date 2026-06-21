import { describe, expect, it } from 'vitest';
import { mergeSportExerciseLibraries, normalizeSportExerciseRow } from '../../src/core/sportLibraryRules.js';

describe('sport library rules core', () => {
  it('normalizes SQL sport exercise rows for the legacy builder', () => {
    expect(normalizeSportExerciseRow({
      exercise_key: 'boxing_heavy_bag',
      name_fr: 'Sac de frappe',
      name_en: 'Heavy bag',
      activity_key: 'boxing',
      goal: 'boxing',
      equipment: 'boxing',
      mode: 'time',
      default_seconds: 180,
      default_sets: 6,
      default_rest_seconds: 60,
      met_value: 7.8,
      tags: ['boxe', 'cardio'],
    })).toEqual({
      key: 'boxing_heavy_bag',
      goal: 'boxing',
      equipment: 'boxing',
      activityKey: 'boxing',
      fr: 'Sac de frappe',
      en: 'Heavy bag',
      mode: 'time',
      reps: 0,
      seconds: 180,
      sets: 6,
      rest: 60,
      weightKg: 0,
      loadLabel: '',
      repMin: 0,
      repMax: 0,
      distanceM: 0,
      metValue: 7.8,
      tags: ['boxe', 'cardio'],
    });
  });

  it('normalizes SQL reference loads and rep ranges', () => {
    expect(normalizeSportExerciseRow({
      key: 'dumbbell_incline_press',
      name_fr: 'Developpe incline halteres',
      name_en: 'Incline dumbbell press',
      activity_key: 'strength',
      goal: 'strength',
      equipment: 'dumbbell',
      mode: 'reps',
      default_reps: 8,
      default_sets: 3,
      default_rest_seconds: 120,
      default_weight_kg: 40,
      load_label: '2 x 20 kg',
      rep_min: 8,
      rep_max: 12,
    })).toMatchObject({
      key: 'dumbbell_incline_press',
      reps: 8,
      sets: 3,
      rest: 120,
      weightKg: 40,
      loadLabel: '2 x 20 kg',
      repMin: 8,
      repMax: 12,
    });
  });

  it('lets SQL rows override fallback rows by key while keeping fallback entries', () => {
    const merged = mergeSportExerciseLibraries(
      [{ key: 'pushup', fr: 'Push-up', en: 'Push-up', goal: 'strength', equipment: 'bodyweight', activityKey: 'bodyweight_strength', mode: 'reps', reps: 12, sets: 3, rest: 60 }],
      [{ exercise_key: 'pushup', name_fr: 'Pompes', name_en: 'Push-ups', goal: 'strength', equipment: 'bodyweight', activity_key: 'bodyweight_strength', mode: 'reps', default_reps: 15, default_sets: 4, default_rest_seconds: 45 }]
    );

    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ key: 'pushup', fr: 'Pompes', reps: 15, sets: 4, rest: 45, source: 'sql' });
  });
});
