import { it, expect, vi } from 'vitest';
import { convertAccountingAmount, loadAccountingFx } from '../../../src/features/accounting/accountingFx.js';

it('uses the last prior published rate for a weekend, never a future or stale rate', () => {
  const fx = { series: { 'AUD:EUR': [{ date: '2026-01-30', rate: 0.6 }, { date: '2026-02-02', rate: 0.7 }] } };
  expect(convertAccountingAmount(100, 'AUD', 'EUR', '2026-01-31', fx)).toMatchObject({ amount: 60, fxDate: '2026-01-30', originalAmount: 100 });
  expect(convertAccountingAmount(100, 'AUD', 'EUR', '2026-01-29', fx).amount).toBeNull();
  expect(convertAccountingAmount(100, 'AUD', 'EUR', '2026-02-20', fx).amount).toBeNull();
  expect(convertAccountingAmount(null, 'EUR', 'EUR', '2026-01-31').amount).toBeNull();
  expect(convertAccountingAmount(0, 'AUD', 'EUR', '2026-01-31').amount).toBe(0);
});
it('uses only dated manual FX fallback and respects direction and provider precedence', () => {
  const fx = { manualRates: { AUD: { rate: 2, asOf: '2026-01-30' }, USD: { rate: 1.2, asOf: '2026-01-30' } } };
  expect(convertAccountingAmount(100, 'AUD', 'EUR', '2026-01-31', fx).amount).toBe(50);
  expect(convertAccountingAmount(100, 'EUR', 'AUD', '2026-01-31', fx).amount).toBe(200);
  expect(convertAccountingAmount(100, 'AUD', 'USD', '2026-01-31', fx).amount).toBe(60);
  fx.series = { 'AUD:EUR': [{ date: '2026-01-30', rate: 0.6 }] };
  expect(convertAccountingAmount(100, 'AUD', 'EUR', '2026-01-31', fx).amount).toBe(60);
  expect(convertAccountingAmount(100, 'USD', 'EUR', '2025-01-31', fx).amount).toBeNull();
});
it('batches public FX reads by pair/year and caches only rate data', async () => {
  const fetchImpl = vi.fn(async url => {
    const u = new URL(url);
    expect([...u.searchParams.keys()].sort()).toEqual(['base', 'from', 'quotes', 'to']);
    return { ok: true, json: async () => [{ base: 'CAD', quote: 'EUR', date: '2024-01-05', rate: 0.7 }] };
  });
  const args = { currencies: ['CAD', 'CAD', 'EUR'], target: 'EUR', dates: ['2024-01-05', '2024-05-05'], today: '2024-06-01', fetchImpl };
  const result = await loadAccountingFx(args);
  expect(fetchImpl).toHaveBeenCalledTimes(1);
  expect(result.series['CAD:EUR']).toHaveLength(1);
  await loadAccountingFx({ ...args, offline: true });
  expect(fetchImpl).toHaveBeenCalledTimes(1);
});
it('reports unavailable currencies and does not fabricate a series', async () => {
  const fx = await loadAccountingFx({ currencies: ['XXX'], target: 'EUR', dates: ['2026-01-01'], today: '2026-01-31', fetchImpl: async () => ({ ok: false }) });
  expect(fx.errors).toEqual(['XXX/EUR · 2026']);
  expect(fx.series['XXX:EUR']).toEqual([]);
});
