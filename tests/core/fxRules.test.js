import { describe, expect, it } from 'vitest';
import {
  buildTxFxSnapshot,
  fxConvert,
  fxRate,
  normalizeCurrency,
  normalizePivotRates,
  tryConvertWithSnapshot,
} from '../../src/core/fxRules.js';

describe('fx core rules', () => {
  const rates = { EUR: 1, THB: 40, JPY: 160, USD: 1.1 };

  it('normalizes ISO3 currencies and pivot rates', () => {
    expect(normalizeCurrency(' jpy ')).toBe('JPY');
    expect(normalizeCurrency('EURO')).toBeNull();
    expect(normalizePivotRates({ jpy: '160', bad: -1, usd: 'x' })).toEqual({ EUR: 1, JPY: 160 });
  });

  it('computes rates via EUR pivot while allowing non-EUR business base currency', () => {
    expect(fxRate('THB', 'JPY', rates)).toBe(4);
    expect(fxRate('JPY', 'THB', rates)).toBe(0.25);
    expect(fxRate('JPY', 'JPY', rates)).toBe(1);
  });

  it('converts amounts to a variable base currency', () => {
    expect(fxConvert(100, 'THB', 'JPY', rates)).toBe(400);
    expect(fxConvert(1600, 'JPY', 'EUR', rates)).toBe(10);
    expect(fxConvert(10, 'EUR', 'JPY', rates)).toBe(1600);
  });

  it('uses explicit fallback for the configured base currency when rates are missing', () => {
    expect(fxRate('EUR', 'LAK', {}, {
      fallbackCurrency: 'LAK',
      fallbackPivotToCurrencyRate: 22000,
    })).toBe(22000);
    expect(fxConvert(2, 'EUR', 'LAK', {}, {
      fallbackCurrency: 'LAK',
      fallbackPivotToCurrencyRate: 22000,
    })).toBe(44000);
  });

  it('builds deterministic transaction snapshots for any base currency', () => {
    const snap = buildTxFxSnapshot({
      txCurrency: 'THB',
      baseCurrency: 'JPY',
      date: '2026-05-07',
      rates,
      now: '2026-05-07T00:00:00.000Z',
      source: 'test',
    });

    expect(snap).toEqual({
      fx_rate_snapshot: 4,
      fx_source_snapshot: 'test',
      fx_snapshot_at: '2026-05-07T00:00:00.000Z',
      fx_base_currency_snapshot: 'JPY',
      fx_tx_currency_snapshot: 'THB',
    });
  });

  it('uses identity snapshots for same-currency writes', () => {
    expect(buildTxFxSnapshot({
      txCurrency: 'JPY',
      baseCurrency: 'JPY',
      date: '2026-05-07',
      now: '2026-05-07T00:00:00.000Z',
    }).fx_rate_snapshot).toBe(1);
  });

  it('converts with snapshot only when it matches transaction and target currencies', () => {
    const tx = {
      currency: 'THB',
      fx_rate_snapshot: 4,
      fx_tx_currency_snapshot: 'THB',
      fx_base_currency_snapshot: 'JPY',
    };

    expect(tryConvertWithSnapshot(100, tx, 'JPY')).toBe(400);
    expect(tryConvertWithSnapshot(100, tx, 'EUR')).toBeNull();
    expect(tryConvertWithSnapshot(100, { ...tx, currency: 'USD' }, 'JPY')).toBeNull();
  });
});
