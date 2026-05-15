import { describe, expect, it } from 'vitest';
import {
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
});
