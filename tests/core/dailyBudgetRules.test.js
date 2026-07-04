import { describe, expect, it } from 'vitest';
import {
  buildDailyBudgetAllocations,
  isInternalMovement,
  isTripBudgetShare,
  summarizeDailyBudget,
  transactionAffectsCash,
  transactionAffectsDailyBudget,
  transactionAmountForDate,
  transactionMatchesTravel,
} from '../../src/core/dailyBudgetRules.js';

describe('daily budget rules core', () => {
  it('keeps Trip shares in budget but excludes their payment advance', () => {
    const advance = {
      type: 'expense',
      label: '[Trip] Avance - Biere',
      amount: 81.38,
      payNow: true,
      outOfBudget: true,
      isInternal: true,
      tripExpenseId: 'expense-1',
    };
    const share = {
      type: 'expense',
      label: '[Trip] Biere',
      amount: 40.69,
      payNow: false,
      affectsBudget: true,
      isInternal: true,
      tripShareLinkId: 'share-1',
    };

    expect(isTripBudgetShare(advance)).toBe(false);
    expect(isInternalMovement(advance)).toBe(true);
    expect(transactionAffectsDailyBudget(advance)).toBe(false);
    expect(transactionAffectsCash(advance)).toBe(false);

    expect(isTripBudgetShare(share)).toBe(true);
    expect(isInternalMovement(share)).toBe(false);
    expect(transactionAffectsDailyBudget(share)).toBe(true);
    expect(transactionAffectsCash(share)).toBe(false);
  });

  it('distributes an expense evenly using timezone-safe ISO dates', () => {
    const tx = {
      id: 'tx-1',
      type: 'expense',
      amount: 96.16,
      currency: 'AUD',
      budgetDateStart: '2026-06-27',
      budgetDateEnd: '2026-06-28',
      label: 'Transport',
    };

    expect(transactionAmountForDate(tx, '2026-06-26')).toBe(0);
    expect(transactionAmountForDate(tx, '2026-06-27')).toBeCloseTo(48.08);
    expect(buildDailyBudgetAllocations(tx, {
      baseCurrencyForDate: () => 'AUD',
      convertAmount: (amount) => amount,
    })).toEqual([
      expect.objectContaining({ dateStr: '2026-06-27', amountBase: 48.08, baseCurrency: 'AUD' }),
      expect.objectContaining({ dateStr: '2026-06-28', amountBase: 48.08, baseCurrency: 'AUD' }),
    ]);
  });

  it('uses custom budget dates independently from the recurring cash date', () => {
    const amaysim = {
      id: 'amaysim', type: 'expense', amount: 25.28, currency: 'EUR',
      dateStart: '2026-07-04', budgetDateStart: '2026-07-06', budgetDateEnd: '2026-07-06',
    };
    const ecolodge = {
      id: 'ecolodge', type: 'expense', amount: 210, currency: 'AUD',
      dateStart: '2026-07-05', budgetDateStart: '2026-07-05', budgetDateEnd: '2026-07-11',
    };

    expect(transactionAmountForDate(amaysim, '2026-07-04')).toBe(0);
    expect(transactionAmountForDate(amaysim, '2026-07-06')).toBeCloseTo(25.28);
    expect(buildDailyBudgetAllocations(ecolodge)).toHaveLength(7);
    expect(transactionAmountForDate(ecolodge, '2026-07-05')).toBeCloseTo(30);
    expect(transactionAmountForDate(ecolodge, '2026-07-11')).toBeCloseTo(30);
  });

  it('combines transaction and asset rows into one daily result', () => {
    const result = summarizeDailyBudget({
      dailyBudget: 100,
      allocations: [{ amountBase: 25, label: 'Repas' }],
      assetAllocations: [{ amountBase: 12, label: 'Patrimoine' }],
    });

    expect(result).toMatchObject({
      daily: 100,
      transactionUsed: 25,
      assetUsed: 12,
      used: 37,
      remaining: 63,
    });
    expect(result.rows).toHaveLength(2);
  });

  it('includes global rows and rows from the active travel only', () => {
    expect(transactionMatchesTravel({}, 'travel-1')).toBe(true);
    expect(transactionMatchesTravel({ travelId: 'travel-1' }, 'travel-1')).toBe(true);
    expect(transactionMatchesTravel({ travel_id: 'travel-2' }, 'travel-1')).toBe(false);
  });
});
