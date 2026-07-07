import { describe, expect, it } from 'vitest';
import {
  addSandboxSetToExercise,
  normalizeSandboxSetIndexes,
  removeSandboxSet,
  syncSandboxPlanSetCounts,
} from '../../../src/features/sport/sportSessionSandboxRules.js';

const plan = [
  { exerciseName: 'Squat arriere', activityKey: 'strength', equipment: 'barbell', mode: 'reps', targetReps: 10, targetSeconds: 0, distanceM: 0, sets: 2 },
  { exerciseName: 'Gainage', activityKey: 'core', equipment: 'bodyweight', mode: 'time', targetSeconds: 60, sets: 1 },
  { exerciseName: 'Curl halteres', activityKey: 'strength', equipment: 'dumbbell', mode: 'reps', targetReps: 15, sets: 1 },
];

const api = {
  numberValue: (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  },
  setWorkSeconds: (item) => (item.mode === 'time' ? item.targetSeconds : 45),
  supportsExternalLoad: (item) => item.equipment !== 'bodyweight',
  lastLoadForExercise: (_item, fallback) => fallback + 5,
  effectiveLoadKg: (_item, fallback) => fallback || 20,
};

describe('Sport session sandbox rules', () => {
  it('renumbers set indexes per exercise without mutating original sets', () => {
    const doneSets = [
      { itemIndex: 0, setIndex: 4 },
      { itemIndex: 1, setIndex: 9 },
      { itemIndex: 0, setIndex: 8 },
    ];

    const normalized = normalizeSandboxSetIndexes(doneSets);

    expect(normalized.map((set) => `${set.itemIndex}:${set.setIndex}`)).toEqual(['0:1', '1:1', '0:2']);
    expect(doneSets.map((set) => set.setIndex)).toEqual([4, 9, 8]);
  });

  it('syncs plan set counts from completed sets', () => {
    expect(syncSandboxPlanSetCounts(plan, [
      { itemIndex: 0 },
      { itemIndex: 0 },
      { itemIndex: 2 },
    ]).map((item) => item.sets)).toEqual([2, 0, 1]);
  });

  it('removes one set, then renumbers and updates plan counts', () => {
    const result = removeSandboxSet({
      plan,
      index: 1,
      doneSets: [
        { itemIndex: 0, setIndex: 1 },
        { itemIndex: 0, setIndex: 2 },
        { itemIndex: 1, setIndex: 1 },
      ],
    });

    expect(result.doneSets).toEqual([
      { itemIndex: 0, setIndex: 1 },
      { itemIndex: 1, setIndex: 1 },
    ]);
    expect(result.plan.map((item) => item.sets)).toEqual([1, 1, 0]);
  });

  it('adds a set after the selected exercise block, not at the end of the workout', () => {
    const result = addSandboxSetToExercise({
      plan,
      itemIndex: 0,
      weightKg: 70,
      now: '2026-07-07T08:00:00.000Z',
      api,
      doneSets: [
        { itemIndex: 0, setIndex: 1, itemId: 'squat-item', reps: 10 },
        { itemIndex: 0, setIndex: 2, itemId: 'squat-item', reps: 9 },
        { itemIndex: 1, setIndex: 1, itemId: 'core-item', durationSeconds: 60 },
      ],
    });

    expect(result.doneSets.map((set) => set.itemIndex)).toEqual([0, 0, 0, 1]);
    expect(result.doneSets[2]).toMatchObject({
      itemIndex: 0,
      setIndex: 3,
      itemId: 'squat-item',
      reps: 10,
      durationSeconds: 45,
      weightKg: 75,
      completedAt: '2026-07-07T08:00:00.000Z',
    });
    expect(result.plan.map((item) => item.sets)).toEqual([3, 1, 0]);
  });

  it('adds a time bodyweight set without reps or external load', () => {
    const result = addSandboxSetToExercise({
      plan,
      itemIndex: 1,
      weightKg: 59,
      now: '2026-07-07T08:05:00.000Z',
      api,
      doneSets: [{ itemIndex: 0, setIndex: 1, reps: 10, weightKg: 70 }],
    });

    expect(result.doneSets[1]).toMatchObject({
      itemIndex: 1,
      setIndex: 1,
      reps: null,
      durationSeconds: 60,
      weightKg: 0,
    });
  });
});
