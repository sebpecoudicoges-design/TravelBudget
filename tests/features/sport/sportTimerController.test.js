import { describe, expect, it } from 'vitest';
import { buildWorkoutSequence } from '../../../src/core/sportRules.js';
import {
  addCircuitRound,
  addSetForCurrentExercise,
  adjustCurrentStepSeconds,
  completeTimerStep,
  createTimerState,
  currentTimerStep,
  skipRestStep,
  togglePause,
} from '../../../src/features/sport/sportTimerController.js';

const now = Date.parse('2026-07-08T08:00:00.000Z');

describe('sport timer controller', () => {
  it('tolerates an empty timer state before the workout starts', () => {
    expect(currentTimerStep(null)).toBeNull();
    expect(currentTimerStep({})).toBeNull();
  });

  it('creates a timer with defaults for the first work step', () => {
    const bench = { exerciseName: 'Bench', mode: 'reps', targetReps: 10, sets: 1, restSeconds: 90, weightKg: 55 };
    const timer = createTimerState({
      sequence: buildWorkoutSequence([bench]),
      planSnapshot: [bench],
      now,
      bodyWeightKg: 59,
      bodyHeightCm: 162,
      effectiveLoadKg: (item) => item.weightKg,
      lastLoadForExercise: (_item, fallback) => fallback + 5,
    });

    expect(timer.index).toBe(0);
    expect(timer.stepReps).toBe(10);
    expect(timer.stepLoadKg).toBe(60);
    expect(timer.bodyHeightCm).toBe(162);
    expect(timer.planSnapshot).toEqual([bench]);
    expect(timer.planSnapshot[0]).not.toBe(bench);
  });

  it('keeps the workout plan captured at start when the editable plan changes', () => {
    const originalPlan = [
      { exerciseName: 'Front squat', mode: 'reps', targetReps: 10, sets: 1 },
      { exerciseName: 'Bench', mode: 'reps', targetReps: 8, sets: 1 },
    ];
    const timer = createTimerState({
      sequence: buildWorkoutSequence(originalPlan),
      planSnapshot: originalPlan,
      now,
      bodyWeightKg: 59,
    });

    originalPlan.splice(0, 1);

    expect(timer.planSnapshot.map((item) => item.exerciseName)).toEqual(['Front squat', 'Bench']);
  });

  it('completes a work step, records the actual reps/load and moves to rest', () => {
    const bench = { exerciseName: 'Bench', mode: 'reps', targetReps: 10, sets: 2, restSeconds: 90, weightKg: 55 };
    const timer = createTimerState({ sequence: buildWorkoutSequence([bench]), now, bodyWeightKg: 59 });
    const result = completeTimerStep(timer, {
      now: now + 30_000,
      reps: 8,
      loadKg: 57.5,
      effectiveLoadKg: (item) => item.weightKg,
      lastLoadForExercise: (_item, fallback) => fallback,
    });

    expect(result.finished).toBe(false);
    expect(result.nextStep.kind).toBe('rest');
    expect(result.timer.doneSets).toMatchObject([{ itemIndex: 0, setIndex: 1, reps: 8, weightKg: 57.5 }]);
    expect(result.timer.stepEndAt).toBe(now + 30_000 + 90_000);
  });

  it('adds a set after the current rest and keeps it before the next exercise', () => {
    const bench = { exerciseName: 'Bench', mode: 'reps', targetReps: 10, sets: 1, restSeconds: 90 };
    const row = { exerciseName: 'Row', mode: 'reps', targetReps: 10, sets: 1, restSeconds: 60 };
    const timer = createTimerState({ sequence: buildWorkoutSequence([bench, row]), now, bodyWeightKg: 59 });
    const result = addSetForCurrentExercise({ ...timer, index: 1 }, [bench, row], { defaultRestSeconds: 60 });

    expect(result.inserted).toBe(true);
    expect(result.plan[0].sets).toBe(2);
    expect(result.timer.sequence.map((step) => [step.kind, step.itemIndex, step.setIndex])).toEqual([
      ['work', 0, 1],
      ['rest', 0, 1],
      ['work', 0, 2],
      ['rest', 0, 2],
      ['work', 1, 1],
    ]);
  });

  it('appends a full circuit round in exercise order', () => {
    const rope = { exerciseName: 'Corde', mode: 'time', targetSeconds: 180, sets: 1, restSeconds: 30 };
    const bag = { exerciseName: 'Boxe', mode: 'time', targetSeconds: 180, sets: 1, restSeconds: 0 };
    const first = createTimerState({ sequence: buildWorkoutSequence([rope, bag], { circuitEnabled: true, rounds: 1 }), now, bodyWeightKg: 59 });
    const result = addCircuitRound(first, [rope, bag], { enabled: true, rounds: 1, roundRestSeconds: 60 });
    const work = result.timer.sequence.filter((step) => step.kind === 'work');

    expect(result.roundIndex).toBe(2);
    expect(result.plan.map((item) => item.sets)).toEqual([2, 2]);
    expect(work.map((step) => [step.itemIndex, step.setIndex])).toEqual([[0, 1], [1, 1], [0, 2], [1, 2]]);
  });

  it('skips rest and applies defaults to the next work step', () => {
    const bench = { exerciseName: 'Bench', mode: 'reps', targetReps: 10, sets: 1, restSeconds: 90 };
    const row = { exerciseName: 'Row', mode: 'reps', targetReps: 12, sets: 1, restSeconds: 60, weightKg: 30 };
    const timer = createTimerState({ sequence: buildWorkoutSequence([bench, row]), now, bodyWeightKg: 59 });
    const result = skipRestStep({ ...timer, index: 1 }, {
      now: now + 10_000,
      effectiveLoadKg: (item) => item.weightKg || 0,
      lastLoadForExercise: (_item, fallback) => fallback,
    });

    expect(result.skipped).toBe(true);
    expect(result.nextStep.item.exerciseName).toBe('Row');
    expect(result.timer.stepReps).toBe(12);
    expect(result.timer.stepLoadKg).toBe(30);
  });

  it('adjusts timed steps and pauses without losing the remaining time', () => {
    const plank = { exerciseName: 'Gainage', mode: 'time', targetSeconds: 60, sets: 1, restSeconds: 0 };
    const timer = createTimerState({ sequence: buildWorkoutSequence([plank]), now, bodyWeightKg: 59 });
    const adjusted = adjustCurrentStepSeconds(timer, 30, { now: now + 10_000 });
    const paused = togglePause(adjusted.timer, { now: now + 20_000 });
    const resumed = togglePause(paused.timer, { now: now + 50_000 });

    expect(adjusted.adjusted).toBe(true);
    expect(adjusted.timer.sequence[0].duration).toBe(90);
    expect(paused.paused).toBe(true);
    expect(resumed.paused).toBe(false);
    expect(resumed.timer.stepEndAt).toBe(adjusted.timer.stepEndAt + 30_000);
  });

  it('finishes early without recording future abs sets', () => {
    const bench = { exerciseName: 'Bench', mode: 'reps', targetReps: 10, sets: 1, restSeconds: 60 };
    const abs = { exerciseName: 'Abdos', mode: 'reps', targetReps: 20, sets: 3, restSeconds: 45 };
    const timer = createTimerState({ sequence: buildWorkoutSequence([bench, abs]), now, bodyWeightKg: 59 });
    const result = completeTimerStep(timer, { now: now + 25_000, reps: 10, loadKg: 50 });

    expect(result.timer.doneSets).toHaveLength(1);
    expect(result.timer.doneSets[0]).toMatchObject({ itemIndex: 0, setIndex: 1 });
    expect(result.timer.doneSets.some((set) => set.itemIndex === 1)).toBe(false);
  });
});
