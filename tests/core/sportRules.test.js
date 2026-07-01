import { describe, expect, it } from 'vitest';
import { completedWorkout, estimateSportSessionKcal, kcalFromMet, SPORT_REST_MET, totalPlanRestSeconds, totalPlanWorkSeconds } from '../../src/core/sportRules.js';
import { estimateWorkDayKcal } from '../../src/core/workRules.js';
import { resolveDailyBaselineKcal } from '../../src/core/bodyEnergyRules.js';

describe('sport rules core', () => {
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
});
