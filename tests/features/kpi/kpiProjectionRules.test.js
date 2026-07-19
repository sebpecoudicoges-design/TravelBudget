import { describe, expect, it } from 'vitest';

import {
  datesOverlap,
  daysPill,
  fmtKpiCompact,
  parseKpiScope,
  pendingAmountText,
  pendingProjectionItems,
  resolveKpiRange,
  signPillClass,
  tripNetRowInRange,
} from '../../../src/features/kpi/kpiProjectionRules.js';

describe('KPI projection rules', () => {
  it('formats compact amounts and resolves scope/range helpers', () => {
    expect(fmtKpiCompact(1234)).toBe('1234');
    expect(fmtKpiCompact(Number.NaN)).toBe('0');
    expect(parseKpiScope('seg:abc')).toEqual({ kind: 'seg', segId: 'abc', raw: 'seg:abc' });
    expect(parseKpiScope('range:2026-07-01:2026-07-10')).toEqual({
      kind: 'range',
      startISO: '2026-07-01',
      endISO: '2026-07-10',
      raw: 'range:2026-07-01:2026-07-10',
    });
    expect(resolveKpiRange({ kind: 'range' }, '2026-07-05', {
      period: { start: '2026-07-01', end: '2026-07-31' },
      getBudgetSegmentForDate: () => ({ start: '2026-07-04', end: '2026-07-12' }),
    })).toEqual({ startISO: '2026-07-04', endISO: '2026-07-12' });
  });

  it('filters date ranges and trip net rows by linked period', () => {
    expect(datesOverlap('2026-07-01', '2026-07-05', '2026-07-05', '2026-07-08')).toBe(true);
    expect(datesOverlap('2026-07-01', '2026-07-04', '2026-07-05', '2026-07-08')).toBe(false);
    expect(tripNetRowInRange(
      { period_id: 'p1' },
      '2026-07-20',
      '2026-07-25',
      [{ id: 'p1', start: '2026-07-01', end: '2026-07-10' }],
    )).toBe(false);
  });

  it('builds grouped pending projection items from transactions and trip balances', () => {
    const items = pendingProjectionItems({
      transactions: [
        { type: 'expense', label: 'A payer', amount: 12, currency: 'EUR', dateStart: '2026-07-03' },
        { type: 'expense', label: 'A payer', amount: 8, currency: 'EUR', dateStart: '2026-07-04' },
        { type: 'income', label: 'Salaire', amount: 100, currency: 'EUR', dateStart: '2026-07-05' },
        { type: 'expense', label: 'Hors plage', amount: 99, currency: 'EUR', dateStart: '2026-08-01' },
      ],
      tripRows: [
        { tripId: 't1', tripName: 'Weekend', net: -35, currency: 'EUR', periodId: 'p1' },
      ],
      periods: [{ id: 'p1', start: '2026-07-01', end: '2026-07-31' }],
      rangeStartISO: '2026-07-01',
      rangeEndISO: '2026-07-10',
      displayDateISO: '2026-07-05',
      isPendingTransaction: (tx) => tx.label !== 'Hors plage',
      toPivot: (amount) => amount,
      toPivotStrict: (amount) => amount,
      normalizeText: (value) => String(value || '').toLowerCase().trim(),
    });

    expect(items).toHaveLength(3);
    expect(items.find((item) => item.label === 'A payer')).toMatchObject({ value: -20, count: 2 });
    expect(items.find((item) => item.label === 'Salaire')).toMatchObject({ value: 100, kind: 'receive' });
    expect(items.find((item) => item.label === 'Weekend')).toMatchObject({ value: -35, source: 'À payer Trip' });
    expect(pendingAmountText(-1234, 'AUD')).toMatch(/- .*AUD/);
  });

  it('classifies cash and sign pills without reading global state', () => {
    expect(daysPill(Infinity, 'Cash')).toEqual({ level: 'good', text: 'Cash: ∞' });
    expect(daysPill(1.4, 'Cash')).toEqual({ level: 'bad', text: 'Cash: J-2 (URGENT)' });
    expect(daysPill(5.2, 'Cash')).toEqual({ level: 'warn', text: 'Cash: J-6' });
    expect(signPillClass(10, 100)).toBe('good');
    expect(signPillClass(-100, 100)).toBe('warn');
    expect(signPillClass(-400, 100)).toBe('bad');
  });
});
