import { describe, expect, it } from 'vitest';
import {
  analysisBucketOrder,
  computeTrendGap,
  formatSignedMoney,
  formatSignedPercent,
  mapToSourcedBucket,
  normalizeAnalysisKey,
  sqlAnalyticFamilyToBucket,
} from '../../src/core/budgetAnalysisRules.js';

describe('budget analysis rules core', () => {
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
});
