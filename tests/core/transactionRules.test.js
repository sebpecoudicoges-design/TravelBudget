import { describe, expect, it } from 'vitest';
import {
  isNightCoveredEligibleCategory,
  isTripLinkedTransaction,
  isWalletAdjustmentTransaction,
  normalizeTransactionInput,
  parseLocaleAmount,
  validateTransactionInput,
  validateTripLinkedEdit,
} from '../../src/core/transactionRules.js';

describe('transaction rules core', () => {
  it('parses locale amounts', () => {
    expect(parseLocaleAmount('12,34')).toBe(12.34);
    expect(parseLocaleAmount('1 234,56')).toBe(1234.56);
    expect(parseLocaleAmount('1.234,56')).toBe(1234.56);
    expect(parseLocaleAmount('1,234.56')).toBe(1234.56);
    expect(Number.isNaN(parseLocaleAmount(''))).toBe(true);
  });

  it('normalizes common transaction defaults', () => {
    const tx = normalizeTransactionInput({
      type: 'expense',
      walletId: 'wallet-1',
      amount: '42',
      category: '',
      cashDate: '2026-05-07',
      payNow: true,
      outOfBudget: true,
      nightCovered: true,
    });

    expect(tx.category).toBe('Autre');
    expect(tx.label).toBe('Autre');
    expect(tx.budgetDateStart).toBe('2026-05-07');
    expect(tx.budgetDateEnd).toBe('2026-05-07');
    expect(tx.affectsBudget).toBe(false);
    expect(tx.nightCovered).toBe(false);
  });

  it('keeps nightCovered only for transport expenses', () => {
    expect(isNightCoveredEligibleCategory('Transport')).toBe(true);
    expect(isNightCoveredEligibleCategory('Transport international')).toBe(true);
    expect(normalizeTransactionInput({
      type: 'expense',
      walletId: 'wallet-1',
      amount: 10,
      category: 'Transport',
      cashDate: '2026-05-07',
      nightCovered: true,
    }).nightCovered).toBe(true);
    expect(normalizeTransactionInput({
      type: 'income',
      walletId: 'wallet-1',
      amount: 10,
      category: 'Transport',
      cashDate: '2026-05-07',
      nightCovered: true,
    }).nightCovered).toBe(false);
  });

  it('validates required fields and budget date order', () => {
    expect(validateTransactionInput(normalizeTransactionInput({
      type: 'expense',
      walletId: 'wallet-1',
      amount: 10,
      cashDate: '2026-05-07',
      budgetDateStart: '2026-05-08',
      budgetDateEnd: '2026-05-07',
    })).ok).toBe(false);

    expect(validateTransactionInput(normalizeTransactionInput({
      type: 'expense',
      walletId: 'wallet-1',
      amount: 10,
      cashDate: '2026-05-07',
    })).ok).toBe(true);
  });

  it('prevents destructive edits on trip-linked payment transactions', () => {
    const current = {
      tripExpenseId: 'trip-expense-1',
      walletId: 'wallet-1',
      type: 'expense',
      amount: 100,
      dateStart: '2026-05-07',
      budgetDateStart: '2026-05-07',
      budgetDateEnd: '2026-05-07',
      payNow: true,
      outOfBudget: true,
    };

    expect(validateTripLinkedEdit({ ...current, cashDate: '2026-05-07' }, current).ok).toBe(true);
    expect(validateTripLinkedEdit({ ...current, cashDate: '2026-05-07', amount: 101 }, current).ok).toBe(false);
    expect(validateTripLinkedEdit({ ...current, cashDate: '2026-05-08' }, current).ok).toBe(false);
  });

  it('detects trip-linked transactions from either link column', () => {
    expect(isTripLinkedTransaction({ tripExpenseId: 'expense-1' })).toBe(true);
    expect(isTripLinkedTransaction({ tripShareLinkId: 'share-1' })).toBe(true);
    expect(isTripLinkedTransaction({ trip_expense_id: 'expense-1' })).toBe(true);
    expect(isTripLinkedTransaction({ trip_share_link_id: 'share-1' })).toBe(true);
    expect(isTripLinkedTransaction({})).toBe(false);
  });

  it('detects wallet adjustment transactions', () => {
    expect(isWalletAdjustmentTransaction({ category: 'Ajustement wallet' })).toBe(true);
    expect(isWalletAdjustmentTransaction({ label: 'Ajustement wallet - Cash' })).toBe(true);
    expect(isWalletAdjustmentTransaction({ label: 'Ajustement wallet - Cash' }, { walletAdjustmentCategory: 'Ajustement wallet' })).toBe(true);
    expect(isWalletAdjustmentTransaction({ category: 'Repas', label: 'Lunch' })).toBe(false);
  });
});
