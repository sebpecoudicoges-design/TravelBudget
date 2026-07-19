import { describe, expect, it } from 'vitest';

import {
  cashConservativeInfo,
  cashRunwayInfo,
  getCashWallets,
  sumCashWalletsBase,
  toBaseSafe,
} from '../../../src/features/kpi/kpiCashRules.js';

describe('KPI cash rules', () => {
  const wallets = [
    { id: 'cash-aud', name: 'Cash AUD', type: 'cash', currency: 'AUD', balance: 120 },
    { id: 'cash-usd', name: 'Cash USD', type: 'cash', currency: 'USD', balance: 50 },
    { id: 'bank', name: 'Bank', type: 'bank', currency: 'AUD', balance: 1000 },
  ];

  it('detects cash wallets and converts only reliable balances', () => {
    expect(getCashWallets(wallets).map((wallet) => wallet.id)).toEqual(['cash-aud', 'cash-usd']);
    expect(toBaseSafe(10, 'AUD', { baseCurrency: 'AUD' })).toEqual({ ok: true, v: 10 });
    expect(toBaseSafe(10, 'EUR', { baseCurrency: 'AUD', exchangeRates: { 'EUR-BASE': 1.65 } })).toEqual({ ok: true, v: 16.5 });
    expect(toBaseSafe(10, 'USD', { baseCurrency: 'AUD' })).toEqual({ ok: false, v: 0 });

    const summary = sumCashWalletsBase(wallets, { baseCurrency: 'AUD' });
    expect(summary.totalBase).toBe(120);
    expect(summary.excluded).toEqual([{ name: 'Cash USD', currency: 'USD', balance: 50 }]);
  });

  it('computes runway from paid cash expenses in the active travel only', () => {
    const runway = cashRunwayInfo({
      wallets,
      transactions: [
        { type: 'expense', walletId: 'cash-aud', amount: 30, currency: 'AUD', dateStart: '2026-07-18', travelId: 't1', payNow: true },
        { type: 'expense', walletId: 'cash-aud', amount: 20, currency: 'AUD', dateStart: '2026-07-19', travelId: 't1', payNow: true },
        { type: 'expense', walletId: 'cash-aud', amount: 99, currency: 'AUD', dateStart: '2026-07-19', travelId: 'other', payNow: true },
        { type: 'expense', walletId: 'bank', amount: 500, currency: 'AUD', dateStart: '2026-07-19', travelId: 't1', payNow: true },
      ],
      period: { start: '2026-07-18', dailyBudgetBase: 100 },
      baseCurrency: 'AUD',
      activeTravelId: 't1',
      txMatchesActiveTravel: (tx, activeTravelId) => tx.travelId === activeTravelId,
      txAffectsCash: (tx) => tx.payNow !== false,
      now: new Date('2026-07-19T12:00:00'),
    });

    expect(runway.totalBase).toBe(120);
    expect(runway.burnPerDay).toBe(25);
    expect(runway.daysLeft).toBeCloseTo(4.8);
    expect(runway.windowDays).toBe(2);
  });

  it('computes conservative cover from budget allocations', () => {
    const cover = cashConservativeInfo({
      wallets,
      period: { start: '2026-07-17', dailyBudgetBase: 100 },
      baseCurrency: 'AUD',
      periodContains: () => true,
      getDailyBudgetForDate: (day) => ({ '2026-07-17': 40, '2026-07-18': 70 }[day] ?? 100),
      now: new Date('2026-07-19T12:00:00'),
    });

    expect(cover.totalBase).toBe(120);
    expect(cover.burnPerDay).toBe(45);
    expect(cover.daysLeft).toBeCloseTo(2.666, 2);
    expect(cover.activeDays).toBe(2);
  });
});
