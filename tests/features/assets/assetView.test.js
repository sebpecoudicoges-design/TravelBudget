import { describe, expect, it } from 'vitest';

import {
  renderAssetCard,
  renderAssetDocumentsModalSpec,
  renderAssetEditorModalSpec,
  renderAssetOwnersModalSpec,
  renderAssetSaleModalSpec,
  renderAssetTransferModalSpec,
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

  it('renders transfer, sale and document modal specs with stable hooks', () => {
    const transfer = renderAssetTransferModalSpec({
      asset: { id: 'asset-1', name: 'Van', currency: 'AUD' },
      owners: [
        { id: 'owner-1', asset_id: 'asset-1', display_name: 'Moi', ownership_percent: 60 },
        { id: 'owner-2', asset_id: 'asset-1', display_name: 'Co-owner', ownership_percent: 40 },
      ],
      transactions: [{ id: 'tx-1', label: 'Achat part' }],
      today: () => '2026-07-11',
      tr: (key) => key,
      txLabel: (tx) => tx.label,
    });
    expect(transfer.formId).toBe('tb-asset-transfer-form');
    expect(transfer.contentHTML).toContain('data-tb-asset-transfer-form');
    expect(transfer.contentHTML).toContain('data-asset-id="asset-1"');
    expect(transfer.contentHTML).toContain('owner-1');
    expect(transfer.contentHTML).toContain('tx-1');

    const sale = renderAssetSaleModalSpec({
      asset: { id: 'asset-1', name: 'Van', currency: 'AUD' },
      transactions: [{ id: 'tx-2', label: 'Vente van' }],
      today: () => '2026-07-12',
      tr: (key) => key,
      t: (fr) => fr,
      txLabel: (tx) => tx.label,
    });
    expect(sale.formId).toBe('tb-asset-sell-form');
    expect(sale.contentHTML).toContain('data-tb-asset-sell-form');
    expect(sale.contentHTML).toContain('Prix de vente total');
    expect(sale.contentHTML).toContain('tx-2');

    const docs = renderAssetDocumentsModalSpec({
      asset: { id: 'asset-1', name: 'Van' },
      docs: [{ id: 'doc-1', name: 'Facture.pdf', tags: ['van'], created_at: '2026-07-01' }],
      links: [{ id: 'link-1', asset_id: 'asset-1', document_id: 'doc-2', relation_type: 'invoice' }],
      txLinks: [{ document_id: 'doc-2', transaction_id: 'tx-3' }],
      assetTransactionLinks: [{ id: 'asset-tx-1', asset_id: 'asset-1', transaction_id: 'tx-4', relation_type: 'purchase', exclude_from_budget: true }],
      transactions: [{ id: 'tx-4', label: 'Achat Van', amount: 8000, currency: 'AUD' }],
      tr: (key) => key,
      t: (fr) => fr,
      findTxById: () => ({ id: 'tx-3', label: 'Paiement' }),
      txDocLine: (tx) => tx.label,
    });
    expect(docs.formId).toBe('tb-asset-documents-form');
    expect(docs.contentHTML).toContain('data-tb-asset-docs-form');
    expect(docs.contentHTML).toContain('data-tb-asset-open-tx="tx-3"');
    expect(docs.contentHTML).toContain('data-tb-asset-unlink-doc="link-1"');
    expect(docs.contentHTML).toContain('Mouvements liés à l’asset');
    expect(docs.contentHTML).toContain('data-tb-asset-link-movement');
    expect(docs.contentHTML).toContain('data-tb-asset-unlink-movement="asset-tx-1"');
    expect(docs.contentHTML).toContain('Sorti du budget pour éviter le double comptage.');
    expect(docs.actionsHTML).toContain('data-tb-asset-doc-upload="asset-1"');
    expect(docs.contentHTML).toContain('Facture.pdf');
  });
});
