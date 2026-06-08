import { describe, expect, it } from 'vitest';
import { estimateSportSessionKcal, kcalFromMet, SPORT_REST_MET, totalPlanRestSeconds, totalPlanWorkSeconds } from '../../src/core/sportRules.js';
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
    expect(Math.round(estimateWorkDayKcal({ hours: 8, met: 4.8, kg: 70 }))).toBe(2822);
    expect(Math.round(estimateWorkDayKcal({ hours: 8, breakMinutes: 45, met: 4.8, kg: 70 }))).toBe(2629);
  });

  it('keeps basal metabolism estimable but user-overridable', () => {
    expect(Math.round(resolveDailyBaselineKcal({ kg: 70, heightCm: 175, age: 30, sex: 'male' }).bmr)).toBe(1649);
    expect(resolveDailyBaselineKcal({ customBmr: 1800 }).source).toBe('manual');
  });
});
