import { describe, expect, it } from 'vitest';
import { findPeriodForDate, formatRecurringPeriodCoverage, recurringPeriodCoverage } from '../../src/core/recurringRules.js';

const periods = [
  { id: 'p1', travelId: 't1', start: '2026-01-01', end: '2026-06-30' },
  { id: 'p2', travelId: 't1', start: '2026-07-01', end: '2026-12-31' },
  { id: 'other', travelId: 't2', start: '2026-01-01', end: '2026-12-31' },
];

describe('recurring budget period rules', () => {
  it('resolves the period from the occurrence date and travel', () => {
    expect(findPeriodForDate(periods, 't1', '2026-06-30')?.id).toBe('p1');
    expect(findPeriodForDate(periods, 't1', '2026-07-01')?.id).toBe('p2');
    expect(findPeriodForDate(periods, 't1', '2027-01-01')).toBeNull();
  });

  it('detects rules crossing budget periods', () => {
    expect(recurringPeriodCoverage({ periods, travelId: 't1', startDate: '2026-06-01', endDate: '2026-08-01' })).toMatchObject({ covered: true, crossesPeriods: true });
  });

  it('explains automatic assignment and missing coverage', () => {
    expect(formatRecurringPeriodCoverage({ periods, travelId: 't1', startDate: '2026-06-01', endDate: '2026-08-01' }, 'fr')).toContain('chaque occurrence');
    expect(formatRecurringPeriodCoverage({ periods, travelId: 't1', startDate: '2027-01-01' }, 'en')).toContain('outside');
  });
});
