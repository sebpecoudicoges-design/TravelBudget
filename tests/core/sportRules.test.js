import { describe, expect, it } from 'vitest';
import { appendCircuitRound, bindSportSetRows, buildSportPersistenceRows, buildWorkoutSequence, completedWorkout, estimateSportSessionKcal, finalizeWorkout, insertExerciseSet, kcalFromMet, SPORT_REST_MET, totalPlanRestSeconds, totalPlanWorkSeconds } from '../../src/core/sportRules.js';
import { analyzeExerciseLoadProgression, estimatedOneRepMax } from '../../src/core/sportProgressionRules.js';
import { estimateWorkDayKcal } from '../../src/core/workRules.js';
import { resolveDailyBaselineKcal } from '../../src/core/bodyEnergyRules.js';

describe('sport rules core', () => {
  it('estimates one rep max with Epley', () => {
    expect(estimatedOneRepMax(90, 10)).toBe(120);
  });

  it('keeps a single successful pyramid top set as the next reference load', () => {
    const result = analyzeExerciseLoadProgression({
      sets: [{ weightKg: 80, reps: 10 }, { weightKg: 85, reps: 10 }, { weightKg: 90, reps: 10 }],
      repMin: 6, repMax: 10, plannedSets: 3, incrementKg: 5,
    });
    expect(result).toMatchObject({
      latestE1rmKg: 120,
      referenceWeightKg: 90,
      recommendedWeightKg: 90,
      setsAtReferenceWeight: 1,
      reasonCode: 'TOP_RANGE_SINGLE_HEAVY_SET',
    });
  });

  it('increases only after every planned set reaches the top of the range', () => {
    const complete = analyzeExerciseLoadProgression({
      sets: [{ weightKg: 90, reps: 10 }, { weightKg: 90, reps: 10 }, { weightKg: 90, reps: 10 }],
      repMin: 6, repMax: 10, plannedSets: 3, incrementKg: 5,
    });
    const partial = analyzeExerciseLoadProgression({
      sets: [{ weightKg: 90, reps: 10 }, { weightKg: 90, reps: 9 }, { weightKg: 90, reps: 8 }],
      repMin: 6, repMax: 10, plannedSets: 3, incrementKg: 5,
    });
    expect(complete).toMatchObject({ recommendedWeightKg: 95, reasonCode: 'TOP_RANGE_ALL_SETS' });
    expect(partial).toMatchObject({ recommendedWeightKg: 90, reasonCode: 'KEEP_WEIGHT_BUILD_REPS' });
  });

  it('does not promote a heaviest attempt below the minimum repetitions', () => {
    const result = analyzeExerciseLoadProgression({
      sets: [{ weightKg: 80, reps: 10 }, { weightKg: 85, reps: 8 }, { weightKg: 90, reps: 4 }],
      repMin: 6, repMax: 10, plannedSets: 3,
    });
    expect(result).toMatchObject({
      heaviestAttemptedWeightKg: 90,
      referenceWeightKg: 85,
      recommendedWeightKg: 85,
      reasonCode: 'HEAVIEST_SET_BELOW_MIN_REPS',
    });
  });

  it('excludes warmups, failed and invalid sets from the reference load', () => {
    const result = analyzeExerciseLoadProgression({
      sets: [
        { weightKg: 50, reps: 10, warmup: true },
        { weightKg: 90, reps: 10, failed: true },
        { weightKg: 85, reps: 8, completed: true },
      ],
      repMin: 6, repMax: 10, plannedSets: 3,
    });
    expect(result.referenceWeightKg).toBe(85);
    expect(result.latestWeightKg).toBe(85);
  });
  it('uses the standard MET kcal formula', () => {
    expect(Math.round(kcalFromMet({ met: 5, kg: 70, minutes: 60 }))).toBe(368);
    expect(Math.round(kcalFromMet({ met: 12, kg: 70, minutes: 60 }))).toBe(882);
  });

  it('separates work and rest MET values', () => {
    const kcal = estimateSportSessionKcal({
      workSeconds: 45 * 60,
      restSeconds: 15 * 60,
      workMet: 8,
      restMet: SPORT_REST_MET,
      kg: 70,
    });

    expect(Math.round(kcal)).toBe(465);
  });

  it('sums planned work and rest durations per set', () => {
    const items = [
      { sets: 3, targetSeconds: 40, restSeconds: 60 },
      { planned_sets: 2, target_seconds: 30, rest_seconds: 45 },
    ];

    expect(totalPlanWorkSeconds(items)).toBe(180);
    expect(totalPlanRestSeconds(items)).toBe(270);
  });

  it('estimates physical work days from MET and body weight', () => {
    expect(Math.round(estimateWorkDayKcal({ hours: 8, met: 4.8, kg: 70 }))).toBe(2128);
    expect(Math.round(estimateWorkDayKcal({ hours: 8, breakMinutes: 45, met: 4.8, kg: 70 }))).toBe(1929);
  });

  it('keeps basal metabolism estimable but user-overridable', () => {
    expect(Math.round(resolveDailyBaselineKcal({ kg: 70, heightCm: 175, age: 30, sex: 'male' }).bmr)).toBe(1649);
    expect(Math.round(resolveDailyBaselineKcal({ kg: 70, heightCm: 175, birthDate: '1997-06-22', sex: 'male', today: new Date('2026-06-14T12:00:00') }).bmr)).toBe(1659);
    expect(resolveDailyBaselineKcal({ customBmr: 1800 }).source).toBe('manual');
  });

  it('keeps only exercises and sets actually completed in a timer workout', () => {
    const result = completedWorkout(
      [{ name: 'Bench', sets: 3 }, { name: 'Abs', sets: 3 }],
      [
        { itemIndex: 0, setIndex: 1, reps: 10 },
        { itemIndex: 0, setIndex: 2, reps: 8 },
        { itemIndex: 1, setIndex: 1, reps: 20, estimated: true },
      ],
    );
    expect(result.plan).toEqual([{ name: 'Bench', sets: 2 }]);
    expect(result.doneSets).toHaveLength(2);
    expect(result.doneSets.every((set) => set.itemIndex === 0)).toBe(true);
  });

  it('appends a complete circuit round in exercise order', () => {
    const rope = { mode: 'time', targetSeconds: 180, restSeconds: 60 };
    const bag = { mode: 'time', targetSeconds: 180, restSeconds: 60 };
    const first = appendCircuitRound([], [rope, bag], { roundRestSeconds: 90 });
    const second = appendCircuitRound(first.sequence, [rope, bag], { roundRestSeconds: 90 });
    const work = second.sequence.filter((step) => step.kind === 'work');

    expect(second.roundIndex).toBe(2);
    expect(work.map((step) => [step.itemIndex, step.setIndex])).toEqual([[0, 1], [1, 1], [0, 2], [1, 2]]);
    expect(second.sequence.some((step) => step.kind === 'round_rest' && step.duration === 90)).toBe(true);
  });

  it('builds work and rest in order without trailing workout rest', () => {
    const bench = { mode: 'reps', sets: 2, restSeconds: 90 };
    const row = { mode: 'reps', sets: 1, restSeconds: 60 };
    const sequence = buildWorkoutSequence([bench, row]);

    expect(sequence.map((step) => [step.kind, step.itemIndex, step.setIndex])).toEqual([
      ['work', 0, 1],
      ['rest', 0, 1],
      ['work', 0, 2],
      ['rest', 0, 2],
      ['work', 1, 1],
    ]);
  });

  it('inserts an added set after the current rest and before the next exercise', () => {
    const bench = { mode: 'reps', sets: 1, restSeconds: 90 };
    const row = { mode: 'reps', sets: 1, restSeconds: 60 };
    const initial = buildWorkoutSequence([bench, row]);
    const duringWork = insertExerciseSet(initial, 0, []);
    const duringRest = insertExerciseSet(initial, 1, []);

    [duringWork, duringRest].forEach((result) => {
      expect(result.inserted).toBe(true);
      expect(result.sequence.map((step) => [step.kind, step.itemIndex, step.setIndex])).toEqual([
        ['work', 0, 1],
        ['rest', 0, 1],
        ['work', 0, 2],
        ['rest', 0, 2],
        ['work', 1, 1],
      ]);
    });
  });

  it('does not add a useless rest after a new final set', () => {
    const squat = { mode: 'reps', sets: 1, restSeconds: 120 };
    const result = insertExerciseSet(buildWorkoutSequence([squat]), 0, []);

    expect(result.sequence.map((step) => step.kind)).toEqual(['work', 'work']);
    expect(result.sequence.at(-1).setIndex).toBe(2);
  });

  it('finalizes only completed exercises after an early stop', () => {
    const summary = finalizeWorkout({
      plan: [{ exerciseName: 'Bench', sets: 3 }, { exerciseName: 'Abs', sets: 3 }],
      doneSets: [
        { itemIndex: 0, setIndex: 1, reps: 10 },
        { itemIndex: 1, setIndex: 1, reps: 20, estimated: true },
      ],
      startedAt: '2026-07-05T08:00:00.000Z',
      endedAt: '2026-07-05T08:10:00.000Z',
      bodyWeightKg: 59,
      estimateKcal: ({ doneSets }) => doneSets.length * 42,
    });

    expect(summary.plan).toEqual([{ exerciseName: 'Bench', sets: 1 }]);
    expect(summary.doneSets).toHaveLength(1);
    expect(summary.durationSeconds).toBe(600);
    expect(summary.estimatedKcal).toBe(42);
  });

  it('builds identical SQL rows for immediate and deferred history sync', () => {
    const summary = {
      startedAt: '2026-07-05T08:00:00.000Z',
      endedAt: '2026-07-05T08:10:00.000Z',
      durationSeconds: 600,
      bodyWeightKg: 59,
      estimatedKcal: 120,
      plan: [{ activityKey: 'strength', exerciseName: 'Bench', equipment: 'barbell', mode: 'reps', sets: 1, restSeconds: 90 }],
      doneSets: [{ itemIndex: 0, setIndex: 1, reps: 10, durationSeconds: 30, weightKg: 50 }],
    };
    const rows = buildSportPersistenceRows(summary, { userId: 'user-1', travelId: 'travel-1', sessionId: 'session-1' });
    const deferredRows = buildSportPersistenceRows({
      started_at: summary.startedAt,
      ended_at: summary.endedAt,
      duration_seconds: 600,
      body_weight_kg: 59,
      estimated_kcal: 120,
      plan: [{ activity_key: 'strength', exercise_name: 'Bench', equipment: 'barbell', mode: 'reps', planned_sets: 1, rest_seconds: 90 }],
      doneSets: [{ itemIndex: 0, set_index: 1, reps: 10, duration_seconds: 30, weight_kg: 50 }],
    }, { userId: 'user-1', travelId: 'travel-1', sessionId: 'session-1' });
    const savedSets = bindSportSetRows(rows.sets, new Map([[0, 'item-1']]));

    expect(deferredRows).toEqual(rows);
    expect(rows.session).toMatchObject({ user_id: 'user-1', activity_type: 'strength', duration_seconds: 600, estimated_kcal: 120 });
    expect(rows.items[0]).toMatchObject({ session_id: 'session-1', exercise_name: 'Bench', planned_sets: 1 });
    expect(savedSets[0]).toMatchObject({ item_id: 'item-1', set_index: 1, reps: 10, weight_kg: 50 });
    expect(savedSets[0]).not.toHaveProperty('itemIndex');
  });
});
