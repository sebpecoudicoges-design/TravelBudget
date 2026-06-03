import { describe, expect, it } from 'vitest';
import { computeTrendGap, formatSignedMoney, formatSignedPercent } from '../../src/core/budgetAnalysisRules.js';

describe('budget analysis rules core', () => {
  it('computes the trend delta versus app budget', () => {
    const gap = computeTrendGap({ projection: 87.73, budget: 110.97, currency: 'EUR' });

    expect(gap.status).toBe('under');
    expect(Math.round(gap.percent)).toBe(-21);
    expect(gap.delta).toBeCloseTo(-23.24, 2);
    expect(formatSignedPercent(gap.percent)).toBe('-21 %');
    expect(formatSignedMoney(gap.delta, gap.currency)).toBe('-23,24 EUR');
  });
});
