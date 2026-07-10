import { describe, expect, it } from 'vitest';

import { renderPortfolioSummary } from '../../../src/features/assets/assetView.js';

describe('Asset view helpers', () => {
  it('renders portfolio summary cards and missing FX note', () => {
    const html = renderPortfolioSummary({
      summary: {
        totalOwned: 1250,
        totalCurrent: 1500,
        totalDepreciation: 500,
        count: 2,
        currency: 'EUR',
        missingCurrencies: ['AUD'],
      },
      money: (value, currency) => `${Math.round(value)} ${currency}`,
      tr: (key) => key,
      t: (fr) => fr,
    });
    expect(html).toContain('assets.summary.your_total');
    expect(html).toContain('1250 EUR');
    expect(html).toContain('Conversion manquante');
    expect(html).toContain('AUD');
  });
});
