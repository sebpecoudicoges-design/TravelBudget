import { describe, expect, it } from 'vitest';
import { renderSubscriptionsModule } from '../../../src/features/subscriptions/subscriptionView.js';

describe('subscription view', () => {
  const analysis = {
    comparison: [{ currency: 'AUD', planned: 200, actual: 190, delta: -10 }],
    flowComparison: [{ type: 'expense', currency: 'AUD', planned: 200, actual: 190, delta: -10 }],
    actualTotals: [{ currency: 'AUD', expenses: 190, income: 1094, delta: 904 }],
    occurrences: [{ id: 'tx1', occurrenceDate: '2026-08-10', amount: 190, currency: 'AUD', status: 'paid', paid: true, generated: true, rule: { id: 'r1', label: 'Loyer', type: 'expense' } }],
    rules: [{ id: 'r1', label: 'Loyer', amount: 200, currency: 'AUD', type: 'expense', isActive: true }],
    activeRules: [{ id: 'r1' }], paid: [{ id: 'tx1' }], overdue: [], modified: [], manuallyLinked: [],
    ruleInsights: [{ rule: { id: 'r1', label: 'Netflix', type: 'expense' }, trackingOnly: true, paid: [{ id: 'tx1' }], monthly: [{ currency: 'AUD', amount: 19.99, source: 'actual-average' }], totalSpent: [{ currency: 'AUD', amount: 119.94 }], nextDueAt: '2026-09-10', nextDueEstimated: true }],
    associationQueue: [{ transaction: { id: 'tx2', label: 'NETFLIX.COM', amount: 19.99, currency: 'AUD', dateStart: '2026-08-16' }, suggestion: { rule: { id: 'r1', label: 'Netflix' }, confidence: 'high', reasons: ['Même devise', 'Libellé très proche'], duplicateCandidate: null } }],
  };

  it('renders the overview with per-currency planned and actual totals', () => {
    const html = renderSubscriptionsModule({ analysis, tab: 'overview' });
    expect(html).toContain('Abonnements');
    expect(html).toContain('Prévu');
    expect(html).toContain('Prévu, réel et bilan');
    expect(html).toContain('Différence');
    expect(html).toContain('Total dépenses');
    expect(html).toContain('Total revenus');
    expect(html).toContain('tb-subscription-flow__amounts');
    expect(html).toContain('904,00 $AU');
    expect(html).toContain('id="subscriptions-range"');
    expect(html).toMatch(/200,00\s\$AU/);
    expect(html).toContain('data-subscription-tab="occurrences"');
    expect(html).toContain('Analyse par abonnement');
    expect(html).toContain('Netflix');
    expect(html).toContain('Prochaine échéance estimée');
    expect(html).toContain('tb-subscription-spotlight--expense');
    expect(html).toContain('data-subscription-detail="r1"');
    expect(html).toContain('data-subscription-tab="associations"');
  });

  it('renders the assisted association queue with explicit confirmation hooks', () => {
    const html = renderSubscriptionsModule({ analysis, tab: 'associations' });
    expect(html).toContain('Transactions sans abonnement');
    expect(html).toContain('Confiance forte');
    expect(html).toContain('Même devise · Libellé très proche');
    expect(html).toContain('data-subscription-link-transaction="tx2"');
    expect(html).toContain('data-subscription-link-rule="r1"');
  });

  it('renders a detailed subscription sheet with history and contextual actions', () => {
    const html = renderSubscriptionsModule({ analysis: { ...analysis, ruleInsights: [{ ...analysis.ruleInsights[0], linked: analysis.occurrences }] }, detailRuleId: 'r1' });
    expect(html).toContain('data-subscription-detail-panel="r1"');
    expect(html).toContain('Prévu par mois');
    expect(html).toContain('Transactions liées');
    expect(html).toContain('data-rr-act="edit"');
    expect(html).toContain('data-subscription-detail-close');
  });

  it('visually distinguishes income and labels its actual amount as received', () => {
    const html = renderSubscriptionsModule({ analysis: {
      ...analysis,
      flowComparison: [{ type: 'income', currency: 'AUD', planned: 1050, actual: 1094, delta: 44 }],
      ruleInsights: [{ ...analysis.ruleInsights[0], rule: { id: 'salary', label: 'Salaire', type: 'income' } }],
    }, tab: 'overview' });
    expect(html).toContain('tb-subscription-flow--income');
    expect(html).toContain('Encaissé');
    expect(html).toContain('44,00 $AU');
    expect(html).toContain('tb-subscription-spotlight--income');
    expect(html).toContain('Total encaissé');
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
