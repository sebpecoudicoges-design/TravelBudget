import { describe, expect, it } from 'vitest';
import {
  buildSubscriptionAnalysis,
  computeFirstSubscriptionDueDate,
  subscriptionOccurrenceStatus,
  subscriptionRulesForTransaction,
} from '../../src/core/subscriptionRules.js';

describe('subscription rules', () => {
  it('anchors a fortnightly weekday after the start boundary', () => {
    expect(computeFirstSubscriptionDueDate({
      ruleType: 'weekly', startDate: '2026-08-17', weekday: 4, intervalCount: 2,
    })).toBe('2026-09-03');
  });

  it('moves an every-x-month rule by its full interval when the day already passed', () => {
    expect(computeFirstSubscriptionDueDate({
      ruleType: 'every_x_months', startDate: '2026-08-17', monthday: 3, intervalCount: 2,
    })).toBe('2026-10-03');
  });

  it('distinguishes paid, modified, overdue and manually linked occurrences', () => {
    expect(subscriptionOccurrenceStatus({ payNow: true }, '2026-08-15')).toBe('paid');
    expect(subscriptionOccurrenceStatus({ generatedByRule: true, recurringInstanceStatus: 'detached' }, '2026-08-15')).toBe('modified');
    expect(subscriptionOccurrenceStatus({ generatedByRule: true, occurrenceDate: '2026-08-01' }, '2026-08-15')).toBe('overdue');
    expect(subscriptionOccurrenceStatus({ generatedByRule: false, occurrenceDate: '2026-08-20' }, '2026-08-15')).toBe('linked');
  });

  it('compares planned rule amounts with paid actual amounts per currency', () => {
    const rule = { id: 'r1', travelId: 't1', type: 'expense', amount: 100, currency: 'AUD', isActive: true };
    const analysis = buildSubscriptionAnalysis({
      rules: [rule], travelId: 't1', startDate: '2026-08-01', endDate: '2026-08-31', today: '2026-08-15',
      transactions: [
        { id: 'g1', recurringRuleId: 'r1', generatedByRule: true, recurringInstanceStatus: 'confirmed', occurrenceDate: '2026-08-03', payNow: true, amount: 92, currency: 'AUD' },
        { id: 'g2', recurringRuleId: 'r1', generatedByRule: true, recurringInstanceStatus: 'generated', occurrenceDate: '2026-08-17', payNow: false, amount: 100, currency: 'AUD' },
        { id: 'm1', recurringRuleId: 'r1', generatedByRule: false, occurrenceDate: '2026-08-10', payNow: true, amount: 105, currency: 'AUD' },
      ],
    });
    expect(analysis.comparison).toEqual([{ currency: 'AUD', planned: 200, actual: 197, delta: -3 }]);
    expect(analysis.manuallyLinked).toHaveLength(1);
    expect(analysis.paid).toHaveLength(2);
  });

  it('only offers compatible rules to a manual transaction', () => {
    const rules = [
      { id: 'ok', travelId: 't1', type: 'expense', currency: 'AUD' },
      { id: 'income', travelId: 't1', type: 'income', currency: 'AUD' },
      { id: 'eur', travelId: 't1', type: 'expense', currency: 'EUR' },
      { id: 'tracking', travelId: 't1', type: 'income', currency: 'EUR', trackingOnly: true },
    ];
    expect(subscriptionRulesForTransaction(rules, { travelId: 't1', type: 'expense', currency: 'AUD' }).map((row) => row.id)).toEqual(['ok', 'tracking']);
  });

  it('builds a per-subscription monthly average, lifetime spend and inferred next date', () => {
    const analysis = buildSubscriptionAnalysis({
      rules: [{ id: 'netflix', travelId: 't1', label: 'Netflix', trackingOnly: true, type: 'expense', currency: 'AUD' }],
      travelId: 't1', startDate: '2026-08-01', endDate: '2026-08-31', today: '2026-08-15',
      transactions: [
        { id: 'july', recurringRuleId: 'netflix', generatedByRule: false, occurrenceDate: '2026-07-10', payNow: true, amount: 20, currency: 'AUD' },
        { id: 'august', recurringRuleId: 'netflix', generatedByRule: false, occurrenceDate: '2026-08-10', payNow: true, amount: 24, currency: 'AUD' },
      ],
    });
    expect(analysis.occurrences).toHaveLength(1);
    expect(analysis.ruleInsights[0].monthly).toEqual([{ currency: 'AUD', amount: 22, source: 'actual-average' }]);
    expect(analysis.ruleInsights[0].totalSpent).toEqual([{ currency: 'AUD', amount: 44 }]);
    expect(analysis.ruleInsights[0].nextDueAt).toBe('2026-09-10');
    expect(analysis.ruleInsights[0].nextDueEstimated).toBe(true);
  });

  it('applies the flow filter to totals as well as rows', () => {
    const analysis = buildSubscriptionAnalysis({
      type: 'expense', travelId: 't1',
      rules: [{ id: 'expense', travelId: 't1', type: 'expense', amount: 10, currency: 'EUR' }, { id: 'income', travelId: 't1', type: 'income', amount: 50, currency: 'EUR' }],
      transactions: [{ recurringRuleId: 'expense', generatedByRule: true, occurrenceDate: '2026-08-01', amount: 10, currency: 'EUR' }, { recurringRuleId: 'income', generatedByRule: true, occurrenceDate: '2026-08-01', amount: 50, currency: 'EUR' }],
    });
    expect(analysis.rules.map((rule) => rule.id)).toEqual(['expense']);
    expect(analysis.comparison[0].planned).toBe(10);
  });
});
