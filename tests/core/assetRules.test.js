import { describe, expect, it } from 'vitest';
import {
  applyAssetTransactionLinksToBudget,
  assetMonthlyBudgetAmount,
  buildAssetLinkedTransactionBudgetPatch,
  buildAssetLinkedTransactionBudgetPatchFromLinks,
  buildAssetBudgetTransactions,
  convertAssetAmount,
  summarizeAssetPortfolio,
} from '../../src/core/assetRules.js';

describe('asset rules core', () => {
  it('converts asset portfolio totals into the configured base currency', () => {
    const summary = summarizeAssetPortfolio([
      {
        id: 'aud-car',
        purchase_value: 2000,
        residual_value: 1000,
        depreciation_months: 10,
        purchase_date: '2026-01-01',
        currency: 'AUD',
        status: 'active',
      },
      {
        id: 'eur-bike',
        purchase_value: 1000,
        residual_value: 1000,
        depreciation_months: 10,
        purchase_date: '2026-01-01',
        currency: 'EUR',
        status: 'active',
      },
    ], [
      { asset_id: 'aud-car', display_name: 'Moi', ownership_percent: 50 },
      { asset_id: 'eur-bike', display_name: 'Moi', ownership_percent: 100 },
    ], {
      baseCurrency: 'EUR',
      rates: { EUR: 1, AUD: 2 },
      computeCurrentValue: (asset) => asset.id === 'aud-car' ? 1000 : 1000,
    });

    expect(summary.currency).toBe('EUR');
    expect(summary.totalCurrent).toBe(1500);
    expect(summary.totalOwned).toBe(1250);
    expect(summary.totalDepreciation).toBe(500);
    expect(summary.missingCurrencies).toEqual([]);
  });

  it('does not add raw foreign amounts when an FX rate is missing', () => {
    const summary = summarizeAssetPortfolio([
      {
        id: 'aud-car',
        purchase_value: 2000,
        residual_value: 1000,
        depreciation_months: 10,
        purchase_date: '2026-01-01',
        currency: 'AUD',
        status: 'active',
      },
    ], [], {
      baseCurrency: 'EUR',
      rates: { EUR: 1 },
      computeCurrentValue: () => 1000,
    });

    expect(summary.totalCurrent).toBe(0);
    expect(summary.totalOwned).toBe(0);
    expect(summary.convertedCount).toBe(0);
    expect(summary.missingCurrencies).toEqual(['AUD']);
  });

  it('converts with fallback rate for the configured base currency', () => {
    expect(convertAssetAmount(10, 'EUR', 'JPY', {
      fallbackCurrency: 'JPY',
      fallbackPivotToCurrencyRate: 160,
    })).toBe(1600);
  });

  it('computes the owned monthly cost without creating wallet cashflow', () => {
    const asset = {
      id: 'van', purchase_value: 12000, residual_value: 2400,
      depreciation_months: 24, include_in_budget: true,
    };
    expect(assetMonthlyBudgetAmount(asset, [
      { asset_id: 'van', display_name: 'Moi', ownership_percent: 50 },
    ])).toBe(200);
  });

  it('creates monthly budget-only rows and handles shorter months', () => {
    const rows = buildAssetBudgetTransactions({
      assets: [{
        id: 'camera', name: 'Camera', purchase_value: 1200, residual_value: 0,
        depreciation_months: 12, purchase_date: '2026-01-31', budget_day: 31,
        currency: 'AUD', status: 'active', include_in_budget: true,
      }],
      rangeStart: '2026-01-01',
      rangeEnd: '2026-03-31',
    });
    expect(rows.map((row) => row.dateStart)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31']);
    expect(rows.every((row) => row.virtualBudgetOnly && row.affectsBudget)).toBe(true);
    expect(rows.every((row) => row.amount === 100)).toBe(true);
  });

  it('excludes disabled and archived assets from budget analysis', () => {
    const rows = buildAssetBudgetTransactions({
      assets: [
        { id: 'off', include_in_budget: false, purchase_value: 100, purchase_date: '2026-01-01' },
        { id: 'sold', status: 'sold', purchase_value: 100, purchase_date: '2026-01-01' },
      ],
      rangeStart: '2026-01-01',
      rangeEnd: '2026-01-31',
    });
    expect(rows).toEqual([]);
  });

  it('excludes only asset purchase links from budget while keeping extra costs normal', () => {
    const rows = applyAssetTransactionLinksToBudget([
      { id: 'tx-purchase', type: 'expense', outOfBudget: false, affectsBudget: true },
      { id: 'tx-extra', type: 'expense', outOfBudget: false, affectsBudget: true },
    ], [
      { asset_id: 'asset-1', transaction_id: 'tx-purchase', relation_type: 'purchase', exclude_from_budget: true },
      { asset_id: 'asset-1', transaction_id: 'tx-extra', relation_type: 'extra_cost', exclude_from_budget: true },
    ]);

    expect(rows[0]).toMatchObject({
      outOfBudget: true,
      out_of_budget: true,
      affectsBudget: false,
      affects_budget: false,
      assetBudgetExcluded: true,
    });
    expect(rows[1]).toMatchObject({ outOfBudget: false, affectsBudget: true });
  });

  it('returns the direct transaction patch for an asset acquisition', () => {
    expect(buildAssetLinkedTransactionBudgetPatch({
      transaction_id: 'tx-1',
      relation_type: 'purchase',
      exclude_from_budget: true,
    })).toEqual({ out_of_budget: true, affects_budget: false });

    expect(buildAssetLinkedTransactionBudgetPatch({
      transaction_id: 'tx-2',
      relation_type: 'maintenance',
      exclude_from_budget: true,
    })).toEqual({ out_of_budget: false, affects_budget: true });
  });

  it('keeps a transaction excluded while any asset purchase link still excludes it', () => {
    expect(buildAssetLinkedTransactionBudgetPatchFromLinks([
      { transaction_id: 'tx-1', relation_type: 'purchase', exclude_from_budget: false },
      { transaction_id: 'tx-1', relation_type: 'sale', exclude_from_budget: true },
    ])).toEqual({ out_of_budget: true, affects_budget: false });

    expect(buildAssetLinkedTransactionBudgetPatchFromLinks([
      { transaction_id: 'tx-1', relation_type: 'purchase', exclude_from_budget: false },
      { transaction_id: 'tx-1', relation_type: 'extra_cost', exclude_from_budget: true },
    ])).toEqual({ out_of_budget: false, affects_budget: true });
  });
});
