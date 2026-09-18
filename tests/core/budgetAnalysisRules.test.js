import { describe, expect, it } from 'vitest';
import {
  analysisBucketOrder,
  affectsBudgetAnalysisDataset,
  computeTrendGap,
  formatSignedMoney,
  formatSignedPercent,
  mapToSourcedBucket,
  normalizeAnalysisKey,
  sqlAnalyticFamilyToBucket,
} from '../../src/core/budgetAnalysisRules.js';
import { projectBudgetConsumption, isInternalTransferCapital, selectBudgetAnalysisRows } from '../../src/features/analysis/analysisCashBreakdown.js';

describe('budget analysis rules core', () => {
  it('preserves savings, deducts credits and honours known future commitments', () => {
    const input = { spent: 5380, spentToToday: 5305.56, targetToToday: 5492.4, totalBudget: 6097.86, start: '2026-05-15', end: '2026-10-02', today: '2026-09-18' };
    expect(projectBudgetConsumption(input)).toBeCloseTo(5890.42, 1);
    expect(projectBudgetConsumption({ ...input, spent: 6500 })).toBe(6500);
    expect(projectBudgetConsumption({ ...input, today: '2026-10-03' })).toBe(5380);
    expect(projectBudgetConsumption({ ...input, today: '2026-05-01' })).toBe(6097.86);
    expect(projectBudgetConsumption({ ...input, targetToToday: 0 })).toBe(6097.86);
    expect(projectBudgetConsumption({ ...input, spent: -50, spentToToday: -50 })).toBe(0);
  });

  it('distinguishes transfer capital from budget-affecting fees and replaces only linked estimates', () => {
    const estimate = { id: 'estimate', internal_transfer_id: 'transfer', type: 'expense', currency: 'EUR', affects_budget: true, is_internal: false, pay_now: false, label: 'Mouvement interne — frais estimés' };
    const real = { ...estimate, id: 'real', pay_now: true, label: 'Frais reels' };
    const capital = { ...real, id: 'capital', affects_budget: false, category: 'Mouvement interne' };
    expect(isInternalTransferCapital(estimate)).toBe(false);
    expect(isInternalTransferCapital(capital)).toBe(true);
    expect(isInternalTransferCapital({ ...real, type: 'income' })).toBe(true);
    expect(selectBudgetAnalysisRows([estimate, capital])).toEqual([estimate, capital]);
    expect(selectBudgetAnalysisRows([estimate, real, capital])).toEqual([real, capital]);
    expect(selectBudgetAnalysisRows([estimate, { ...real, currency: 'AUD' }])).toHaveLength(2);
    expect(selectBudgetAnalysisRows([estimate, { ...real, internal_transfer_id: 'other' }])).toHaveLength(2);
  });
  it('computes the trend delta versus app budget', () => {
    const gap = computeTrendGap({ projection: 87.73, budget: 110.97, currency: 'EUR' });

    expect(gap.status).toBe('under');
    expect(Math.round(gap.percent)).toBe(-21);
    expect(gap.delta).toBeCloseTo(-23.24, 2);
    expect(formatSignedPercent(gap.percent)).toBe('-21 %');
    expect(formatSignedMoney(gap.delta, gap.currency)).toBe('-23,24 EUR');
  });

  it('maps configured analytic rules before fallback constants', () => {
    const mappingByTxId = {
      tx1: { mappingStatus: 'excluded', analyticFamily: null },
      tx2: { mappingStatus: 'mapped', analyticFamily: 'food' },
    };
    const fallbackMapping = {
      logement: { compare_mode: 'mapped', sourced_bucket: 'Logement' },
      sante: { compare_mode: 'excluded' },
    };

    expect(normalizeAnalysisKey('Santé')).toBe('sante');
    expect(sqlAnalyticFamilyToBucket('activities')).toBe('Activités');
    expect(mapToSourcedBucket({ categoryName: 'Immo', tx: { id: 'tx1' }, mappingByTxId, fallbackMapping })).toMatchObject({
      mode: 'excluded',
      source: 'sql',
    });
    expect(mapToSourcedBucket({ categoryName: 'Repas', tx: { id: 'tx2' }, mappingByTxId, fallbackMapping })).toMatchObject({
      mode: 'mapped',
      bucket: 'Repas',
      source: 'sql',
    });
    expect(mapToSourcedBucket({ categoryName: 'Logement', fallbackMapping })).toMatchObject({
      mode: 'mapped',
      bucket: 'Logement',
      source: 'fallback',
    });
  });

  it('builds bucket order from base order and dynamic fallback mapping', () => {
    expect(analysisBucketOrder({
      baseOrder: ['Logement', 'Repas'],
      fallbackMapping: {
        visa: { compare_mode: 'excluded' },
        data: { compare_mode: 'mapped', sourced_bucket: 'Connectivité' },
      },
    })).toEqual(['Logement', 'Repas', 'Connectivité']);
  });

  it('keeps cashflow-only rows out of budget analysis totals', () => {
    expect(affectsBudgetAnalysisDataset({ type: 'expense', affects_budget: true })).toBe(true);
    expect(affectsBudgetAnalysisDataset({ type: 'expense', affectsBudget: false })).toBe(false);
    expect(affectsBudgetAnalysisDataset({ type: 'income', affects_budget: true })).toBe(false);
  });

});
