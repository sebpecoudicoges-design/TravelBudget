import { describe, expect, it } from 'vitest';
import { buildAssistantContextualInsights, buildAssistantQuickInsights, buildAssistantSnapshot } from '../../src/core/assistantRules.js';

describe('assistant rules core', () => {
  it('builds a cash and pending snapshot from loaded state', () => {
    const snapshot = buildAssistantSnapshot({
      user: { baseCurrency: 'AUD' },
      period: { start: '2026-05-01', end: '2026-05-31', dailyBudgetBase: 100 },
      wallets: [{ id: 'w1', balance: 1200, currency: 'AUD' }],
      transactions: [
        { type: 'expense', amount: 30, currency: 'AUD', payNow: true, category: 'Repas', label: 'Lunch', budgetDateStart: '2026-05-10' },
        { type: 'expense', amount: 50, currency: 'AUD', payNow: false, category: 'Transport', label: 'Bus', budgetDateStart: '2026-05-11' },
        { type: 'income', amount: 900, currency: 'AUD', payNow: false, category: 'Revenu', label: 'Salary', budgetDateStart: '2026-05-12' },
      ],
    }, { today: '2026-05-10' });

    expect(snapshot.walletTotal).toBe(1200);
    expect(snapshot.pendingExpenses).toBe(50);
    expect(snapshot.pendingIncome).toBe(900);
    expect(snapshot.topCategory.name).toBe('Transport');
  });

  it('flags transactions needing classification', () => {
    const insights = buildAssistantQuickInsights({
      user: { baseCurrency: 'EUR' },
      period: { start: '2026-05-01', end: '2026-05-31', dailyBudgetBase: 10 },
      wallets: [{ id: 'w1', balance: 100, currency: 'EUR' }],
      transactions: [
        { type: 'expense', amount: 10, currency: 'EUR', payNow: true, category: 'Autre', label: 'Autre', budgetDateStart: '2026-05-10' },
      ],
    }, { today: '2026-05-10' });

    expect(insights.some((x) => x.code === 'uncategorized')).toBe(true);
  });

  it('flags expiring documents and multi-currency assets', () => {
    const insights = buildAssistantQuickInsights({
      user: { baseCurrency: 'EUR' },
      period: { start: '2026-05-01', end: '2026-05-31', dailyBudgetBase: 100 },
      wallets: [{ id: 'w1', balance: 2000, currency: 'EUR' }],
      documents: [{ id: 'd1', expires_at: '2026-05-20', tags: ['Visa'] }],
      assets: [
        { id: 'a1', currentCurrency: 'AUD' },
        { id: 'a2', currentCurrency: 'EUR' },
      ],
    }, { today: '2026-05-10' });

    expect(insights.some((x) => x.code === 'expiring_docs')).toBe(true);
    expect(insights.some((x) => x.code === 'asset_fx')).toBe(true);
  });

  it('prioritizes transaction-specific signals on the transactions view', () => {
    const insights = buildAssistantContextualInsights({
      user: { baseCurrency: 'EUR' },
      period: { start: '2026-05-01', end: '2026-05-31', dailyBudgetBase: 100 },
      wallets: [{ id: 'w1', balance: 500, currency: 'EUR' }],
      transactions: [
        { type: 'expense', amount: 20, currency: 'EUR', payNow: true, category: 'Autre', label: 'Autre', budgetDateStart: '2026-05-10' },
        { type: 'expense', amount: 40, currency: 'EUR', payNow: false, category: 'Repas', label: 'Dinner', tripExpenseId: 'trip-1', budgetDateStart: '2026-05-11' },
      ],
    }, { today: '2026-05-10', view: 'transactions' });

    expect(insights[0].code).toBe('uncategorized');
    expect(insights.some((x) => x.code === 'trip_linked_tx')).toBe(true);
  });

  it('prioritizes document-specific signals on the documents view', () => {
    const insights = buildAssistantContextualInsights({
      user: { baseCurrency: 'EUR' },
      period: { start: '2026-05-01', end: '2026-05-31', dailyBudgetBase: 100 },
      wallets: [{ id: 'w1', balance: 500, currency: 'EUR' }],
      documents: [
        { id: 'd1', expires_at: '2026-05-20', tags: [] },
      ],
    }, { today: '2026-05-10', view: 'documents' });

    expect(insights[0].code).toBe('expiring_docs');
    expect(insights.some((x) => x.code === 'untagged_docs')).toBe(true);
  });
});
