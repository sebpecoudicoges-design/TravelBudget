import { describe, expect, it } from 'vitest';
import { renderSubscriptionsModule } from '../../../src/features/subscriptions/subscriptionView.js';

describe('subscription view', () => {
  const analysis = {
    comparison: [{ currency: 'AUD', planned: 200, actual: 190, delta: -10 }],
    occurrences: [{ id: 'tx1', occurrenceDate: '2026-08-10', amount: 190, currency: 'AUD', status: 'paid', paid: true, generated: true, rule: { id: 'r1', label: 'Loyer', type: 'expense' } }],
    rules: [{ id: 'r1', label: 'Loyer', amount: 200, currency: 'AUD', type: 'expense', isActive: true }],
    activeRules: [{ id: 'r1' }], paid: [{ id: 'tx1' }], overdue: [], modified: [], manuallyLinked: [],
    ruleInsights: [{ rule: { id: 'r1', label: 'Netflix' }, trackingOnly: true, paid: [{ id: 'tx1' }], monthly: [{ currency: 'AUD', amount: 19.99, source: 'actual-average' }], totalSpent: [{ currency: 'AUD', amount: 119.94 }], nextDueAt: '2026-09-10', nextDueEstimated: true }],
  };

  it('renders the overview with per-currency planned and actual totals', () => {
    const html = renderSubscriptionsModule({ analysis, tab: 'overview' });
    expect(html).toContain('Abonnements');
    expect(html).toContain('Prévu');
    expect(html).toContain('Réel payé');
    expect(html).toMatch(/200,00\s\$AU/);
    expect(html).toContain('data-subscription-tab="occurrences"');
    expect(html).toContain('Analyse par abonnement');
    expect(html).toContain('Netflix');
    expect(html).toContain('Prochaine échéance estimée');
  });

  it('renders traceable occurrences and rule actions without losing stable hooks', () => {
    const occurrences = renderSubscriptionsModule({ analysis, tab: 'occurrences' });
    const rules = renderSubscriptionsModule({ analysis, tab: 'rules' });
    expect(occurrences).toContain('data-subscription-open-transaction="tx1"');
    expect(occurrences).toContain('Créée par la règle');
    expect(rules).toContain('data-rr-act="edit"');
    expect(rules).toContain('id="tb-recurring-add-btn"');
  });

  it('renders tracking-only rules without automatic pause or resume actions', () => {
    const html = renderSubscriptionsModule({ analysis: { ...analysis, rules: [{ id: 'manual', label: 'Netflix', trackingOnly: true, isActive: false }] }, tab: 'rules' });
    expect(html).toContain('Suivi manuel');
    expect(html).toContain('Aucune transaction générée');
    expect(html).not.toContain('data-rr-act="resume"');
  });
});
