import { describe, expect, it } from 'vitest';
import { calendarPresetRange, clampRange, comparisonMetrics, previousComparableRange } from '../../../src/features/analysis/analysisPeriodRules.js';

describe('analysis period rules', () => {
  it('builds calendar month and ISO-like Monday week presets', () => {
    expect(calendarPresetRange('month', '2026-09-19')).toEqual({ start: '2026-09-01', end: '2026-09-30' });
    expect(calendarPresetRange('previous-month', '2026-09-19')).toEqual({ start: '2026-08-01', end: '2026-08-31' });
    expect(calendarPresetRange('week', '2026-09-19')).toEqual({ start: '2026-09-14', end: '2026-09-20' });
    expect(calendarPresetRange('previous-week', '2026-09-19')).toEqual({ start: '2026-09-07', end: '2026-09-13' });
  });

  it('clips presets to the selected trip and rejects disjoint ranges', () => {
    expect(clampRange({ start: '2026-09-01', end: '2026-09-30' }, { start: '2026-09-05', end: '2026-09-22' })).toEqual({ start: '2026-09-05', end: '2026-09-22' });
    expect(clampRange({ start: '2026-09-01', end: '2026-09-04' }, { start: '2026-09-05' })).toEqual({ start: '', end: '' });
  });

  it('aligns month and week comparisons, and keeps a contiguous fallback for custom ranges', () => {
    expect(previousComparableRange({ start: '2026-09-01', elapsedDays: 19 }, 'month')).toEqual({ start: '2026-08-01', end: '2026-08-19' });
    expect(previousComparableRange({ start: '2026-09-14', elapsedDays: 6 }, 'week')).toEqual({ start: '2026-09-07', end: '2026-09-12' });
    expect(previousComparableRange({ start: '2026-09-14', elapsedDays: 6 })).toEqual({ start: '2026-09-08', end: '2026-09-13' });
    expect(comparisonMetrics({ avgPerDay: 40 }, { avgPerDay: 50 })).toEqual({ currentDaily: 40, previousDaily: 50, delta: -10, deltaPct: -20, favorable: true });
    expect(comparisonMetrics({ avgPerDay: 12 }, { avgPerDay: 0 }).deltaPct).toBeNull();
  });
});
