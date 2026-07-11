import { describe, expect, it } from 'vitest';

import {
  renderAssetCard,
  renderAssetEditorModalSpec,
  renderAssetOwnersModalSpec,
  renderPortfolioSummary,
} from '../../../src/features/assets/assetView.js';

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

  it('renders an asset card with budget cost, owners, docs, events and actions', () => {
    const html = renderAssetCard({
      asset: {
        id: 'asset-1',
        name: 'Toyota X-Trail',
        asset_type: 'car',
        purchase_value: 5000,
        residual_value: 1400,
        currency: 'AUD',
        purchase_date: '2026-06-01',
        depreciation_months: 36,
        include_in_budget: true,
      },
      owners: [{ id: 'owner-1', asset_id: 'asset-1', display_name: 'Moi', ownership_percent: 50 }],
      events: [{ id: 'event-1', asset_id: 'asset-1', event_date: '2026-07-01', event_type: 'buy_share', percent: 10 }],
      documentLinks: [{ id: 'doc-link-1', asset_id: 'asset-1', document_id: 'doc-1' }],
      computeCurrentValue: () => 4500,
      computeDepreciationProgress: () => ({ ratio: 0.28 }),
      computeOwnedValue: (_asset, pct) => 4500 * pct / 100,
      monthlyBudgetAmount: () => 50,
      money: (value, currency) => `${Math.round(value)} ${currency}`,
      tr: (key) => key,
      t: (fr) => fr,
      icon: () => 'car',
      label: () => 'Voiture',
      eventLabel: () => 'Achat de part',
    });

    expect(html).toContain('data-asset-id="asset-1"');
    expect(html).toContain('Toyota X-Trail');
    expect(html).toContain('2250 AUD');
    expect(html).toContain('Coût budget mensuel');
    expect(html).toContain('50 AUD/assets.card.month');
    expect(html).toContain('28% assets.card.used');
    expect(html).toContain('Moi · 50%');
    expect(html).toContain('2026-07-01 · Achat de part · 10%');
    expect(html).toContain('Docs (1)');
    expect(html).toContain('data-tb-asset-edit="asset-1"');
    expect(html).toContain('data-tb-asset-docs="asset-1"');
  });

  it('renders realized PnL for sold assets', () => {
    const html = renderAssetCard({
      asset: {
        id: 'asset-1',
        name: 'Sold bike',
        asset_type: 'equipment',
        purchase_value: 1000,
        residual_value: 100,
        currency: 'EUR',
        purchase_date: '2026-01-01',
        depreciation_months: 12,
        status: 'sold',
      },
      owners: [{ id: 'owner-1', asset_id: 'asset-1', display_name: 'Moi', ownership_percent: 100 }],
      events: [{ asset_id: 'asset-1', from_owner_id: 'owner-1', amount: 1200 }],
      computeCurrentValue: () => 600,
      computeDepreciationProgress: () => ({ ratio: 0.5 }),
      computeOwnedValue: (_asset, pct) => 600 * pct / 100,
      money: (value, currency) => `${Math.round(value)} ${currency}`,
      tr: (key) => key,
    });

    expect(html).toContain('assets.card.realized_pnl');
    expect(html).toContain('+200 EUR');
    expect(html).toContain('class="pos"');
  });

  it('renders asset editor and owners modal specs with stable form hooks', () => {
    const editor = renderAssetEditorModalSpec({
      mode: 'edit',
      asset: { id: 'asset-1', name: 'Van', asset_type: 'car', purchase_value: 8000, currency: 'AUD', purchase_date: '2026-06-01', depreciation_months: 24 },
      today: () => '2026-07-11',
      tr: (key) => key,
      t: (fr) => fr,
    });
    expect(editor.formId).toBe('tb-asset-editor-form');
    expect(editor.contentHTML).toContain('data-tb-asset-form="edit"');
    expect(editor.contentHTML).toContain('data-asset-id="asset-1"');
    expect(editor.contentHTML).toContain('name="budget_day"');
    expect(editor.contentHTML).toContain('Inclure le coût mensuel dans le budget');

    const owners = renderAssetOwnersModalSpec({
      asset: { id: 'asset-1', name: 'Van' },
      owners: [{ id: 'owner-1', asset_id: 'asset-1', display_name: 'Moi', ownership_percent: 60 }],
      tr: (key) => key,
    });
    expect(owners.formId).toBe('tb-asset-owners-form');
    expect(owners.contentHTML).toContain('data-tb-asset-owners-form');
    expect(owners.contentHTML).toContain('data-owner-id="owner-1"');
    expect(owners.contentHTML).toContain('Moi');
    expect(owners.contentHTML).toContain('data-tb-owner-add');
  });
});
