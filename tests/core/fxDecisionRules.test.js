import { describe, expect, it } from 'vitest';
import { computeFxDecision } from '../../src/core/fxDecisionRules.js';

function series(values) {
  return values.map((rate, index) => ({ date: `2026-01-${String(index + 1).padStart(2, '0')}`, rate }));
}

describe('fxDecisionRules', () => {
  it('recommends converting more when current AUD/EUR is strong', () => {
    const rates = series(Array.from({ length: 90 }, (_, i) => 0.58 + i * 0.0005));
    const decision = computeFxDecision({ rates, weeklyIncomeAud: 1200, eurNeedRatio: 0.7, localAudSafetyRatio: 0.2 });

    expect(decision.status).toBe('ok');
    expect(decision.convertPercent).toBeGreaterThanOrEqual(50);
    expect(decision.convertEur).toBeGreaterThan(0);
  });

  it('keeps more AUD when the rate is weak and local safety matters', () => {
    const rates = series(Array.from({ length: 90 }, (_, i) => 0.64 - i * 0.0006));
    const decision = computeFxDecision({ rates, weeklyIncomeAud: 1200, eurNeedRatio: 0.2, localAudSafetyRatio: 0.75 });

    expect(decision.status).toBe('ok');
    expect(decision.convertPercent).toBeLessThanOrEqual(25);
  });

  it('handles missing rates without crashing', () => {
    const decision = computeFxDecision({ rates: [], weeklyIncomeAud: 1200 });

    expect(decision.status).toBe('missing');
    expect(decision.convertPercent).toBe(0);
  });

  it('uses target AUD hold amount as an exact amount mode decision', () => {
    const rates = series(Array.from({ length: 90 }, (_, i) => 0.6 + i * 0.0002));
    const decision = computeFxDecision({
      rates,
      weeklyIncomeAud: 1200,
      eurNeedRatio: 0.5,
      localAudSafetyRatio: 500 / 1200,
      targetHoldAud: 500,
    });

    expect(decision.holdAud).toBe(500);
    expect(decision.convertAud).toBe(700);
    expect(decision.convertPercent).toBe(58);
    expect(decision.convertEur).toBeCloseTo(700 * decision.currentRate, 6);
  });

  it('returns confidence and weekly decision scenarios', () => {
    const rates = series(Array.from({ length: 90 }, (_, i) => 0.59 + i * 0.0004));
    const decision = computeFxDecision({ rates, weeklyIncomeAud: 1200, eurNeedRatio: 0.6, localAudSafetyRatio: 0.35 });

    expect(decision.confidence.level).toMatch(/low|medium|high/);
    expect(decision.scenarios.convertNow.aud).toBe(decision.convertAud);
    expect(decision.scenarios.convertNow.eur).toBeCloseTo(decision.convertEur, 6);
    expect(decision.scenarios.keepAfterConversion.aud).toBe(decision.holdAud);
  });

  it('supports configurable decision horizons', () => {
    const rates = series([
      ...Array.from({ length: 120 }, (_, i) => 0.64 - i * 0.0002),
      ...Array.from({ length: 60 }, (_, i) => 0.58 + i * 0.001),
    ]);
    const short = computeFxDecision({ rates, weeklyIncomeAud: 1200, eurNeedRatio: 0.5, localAudSafetyRatio: 0.35, horizonDays: 30 });
    const long = computeFxDecision({ rates, weeklyIncomeAud: 1200, eurNeedRatio: 0.5, localAudSafetyRatio: 0.35, horizonDays: 180 });

    expect(short.horizonDays).toBe(30);
    expect(long.horizonDays).toBe(180);
    expect(short.metrics.dataPointsHorizon).toBe(30);
    expect(long.metrics.dataPointsHorizon).toBe(180);
    expect(short.metrics.avgHorizon).not.toBeCloseTo(long.metrics.avgHorizon, 6);
  });
});
