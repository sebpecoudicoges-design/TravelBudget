import { describe, expect, it } from 'vitest';
import {
  buildFrankfurterV2RatesUrl,
  normalizeFrankfurterLatest,
  normalizeFrankfurterSeries,
} from '../../src/core/frankfurterRules.js';

describe('Frankfurter V2 rules', () => {
  it('normalizes the V2 latest array to the existing EUR rates contract', () => {
    const result = normalizeFrankfurterLatest([
      { date: '2026-07-05', base: 'EUR', quote: 'AUD', rate: 1.78 },
      { date: '2026-07-04', base: 'EUR', quote: 'THB', rate: 37.1 },
    ]);

    expect(result).toMatchObject({ base: 'EUR', date: '2026-07-05', rates: { EUR: 1, AUD: 1.78, THB: 37.1 } });
  });

  it('normalizes and sorts a V2 time series', () => {
    const rows = normalizeFrankfurterSeries([
      { date: '2026-07-02', base: 'AUD', quote: 'EUR', rate: 0.61 },
      { date: '2026-07-01', base: 'AUD', quote: 'EUR', rate: 0.6 },
      { date: '2026-07-01', base: 'AUD', quote: 'USD', rate: 0.66 },
    ], { base: 'AUD', quote: 'EUR' });

    expect(rows).toEqual([
      { date: '2026-07-01', rate: 0.6 },
      { date: '2026-07-02', rate: 0.61 },
    ]);
  });

  it('builds the documented V2 query parameters', () => {
    const url = new URL(buildFrankfurterV2RatesUrl({
      base: 'AUD',
      quotes: ['EUR'],
      from: '2026-01-01',
      to: '2026-07-05',
    }));

    expect(url.pathname).toBe('/v2/rates');
    expect(url.searchParams.get('base')).toBe('AUD');
    expect(url.searchParams.get('quotes')).toBe('EUR');
    expect(url.searchParams.get('from')).toBe('2026-01-01');
    expect(url.searchParams.get('to')).toBe('2026-07-05');
  });
});
