import { describe, it, expect } from 'vitest';
import { shouldAutoCashflowOnly, validateOneToOneLink, validateSplitTotal } from '../../src/core/tripRules.js';

describe('trip rules core', () => {
  it('auto cashflow-only only when linked + payment total + shared', () => {
    expect(shouldAutoCashflowOnly({ linked: true, isPaymentTotal: true, total: 100, myShare: 10 })).toBe(true);
    expect(shouldAutoCashflowOnly({ linked: true, isPaymentTotal: true, total: 100, myShare: 100 })).toBe(false);
    expect(shouldAutoCashflowOnly({ linked: true, isPaymentTotal: false, total: 100, myShare: 10 })).toBe(false);
    expect(shouldAutoCashflowOnly({ linked: false, isPaymentTotal: true, total: 100, myShare: 10 })).toBe(false);
  });

  it('enforces 1:1 link', () => {
    expect(validateOneToOneLink({ txTripExpenseId: 'x', expenseLinkedTxId: null }).ok).toBe(false);
    expect(validateOneToOneLink({ txTripExpenseId: null, expenseLinkedTxId: 'y' }).ok).toBe(false);
    expect(validateOneToOneLink({ txTripExpenseId: null, expenseLinkedTxId: null }).ok).toBe(true);
  });

  it('validates split totals', () => {
    expect(validateSplitTotal({ total: 100, shares: [10, 90] }).ok).toBe(true);
    expect(validateSplitTotal({ total: 100, shares: [10, 80] }).ok).toBe(false);
  });
});
