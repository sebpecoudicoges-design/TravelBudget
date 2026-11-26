import { describe, expect, it } from 'vitest';
import { previewAccountingRestore } from '../../../src/features/accounting/accountingRestorePreview.js';

const scope = Object.freeze({ userId: 'synthetic-user', travelId: 'synthetic-travel' });
const candidate = {
  version: 1, ...scope, createdAt: '2026-01-31T12:00:00.000Z',
  settings: {
    mapping: {}, inferredMapping: {}, classificationVersion: 4,
    mappingBeforeDetailedChart: {}, walletAccounts: {},
    balances: { EUR: { equity: 100, note: 'Note fictive privée' } }, equityMode: 'declared',
    debts: [], archivedDebts: [], positions: [], assetLinks: [], positionAudit: [],
  },
};
const raw = (changes = {}) => JSON.stringify({ ...candidate, ...changes });
const preview = (changes, activeScope = scope) => previewAccountingRestore(raw(changes), activeScope);

describe('isolated accounting restore preview', () => {
  it('returns only a read-only family summary, never the settings or identity', () => {
    const result = preview();
    expect(result).toEqual({
      status: 'scope-reviewed', requiresFurtherValidation: true,
      createdAt: candidate.createdAt, families: ['classification', 'balances', 'debts', 'positions'],
    });
    expect(JSON.stringify(result)).not.toMatch(/fictive|synthetic|equity/);
  });

  it.each([
    [{}, 'scope-unavailable'],
    [{ ...scope, userId: 'other-user' }, 'scope-mismatch'],
    [{ ...scope, travelId: 'other-travel' }, 'scope-mismatch'],
  ])('rejects an unavailable or different active scope: %j', (activeScope, status) => {
    expect(preview({}, activeScope)).toEqual({ status });
  });

  it.each([
    [{ userId: '' }, 'invalid-envelope'],
    [{ createdAt: '2026-02-30T12:00:00.000Z' }, 'invalid-envelope'],
    [{ transactions: [] }, 'invalid-envelope'],
    [{ version: 2 }, 'unsupported-version'],
    [{ settings: {} }, 'invalid-settings'],
    [{ settings: { ...candidate.settings, debts: null } }, 'invalid-settings'],
    [{ settings: { ...candidate.settings, manualRates: {} } }, 'invalid-settings'],
    [{ settings: { ...candidate.settings, equityMode: 'other' } }, 'invalid-settings'],
  ])('does not normalize invalid or partial input: %j', (changes, status) => {
    expect(preview(changes)).toEqual({ status });
  });

  it('never treats a structurally present source reference as validated', () => {
    const result = preview({ settings: {
      ...candidate.settings,
      debts: [{ id: 'fictional-debt', repayments: [{ transactionId: 'not-reviewed' }] }],
    } });
    expect(result).toMatchObject({ status: 'scope-reviewed', requiresFurtherValidation: true });
    expect(JSON.stringify(result)).not.toContain('not-reviewed');
  });

  it('distinguishes bad JSON from a well-formed invalid envelope', () => {
    expect(previewAccountingRestore('{', scope)).toEqual({ status: 'invalid-json' });
    expect(previewAccountingRestore('null', scope)).toEqual({ status: 'invalid-envelope' });
  });

  it('bounds the input in bytes before parsing and rejects excessive nesting', () => {
    expect(previewAccountingRestore('é'.repeat(250001), scope)).toEqual({ status: 'size-limit' });
    const deep = Array.from({ length: 30 }).reduce(value => [value], 1);
    expect(preview({ settings: { ...candidate.settings, debts: [deep] } })).toEqual({ status: 'depth-limit' });
  });
});

describe('active references for the same account and trip', () => {
  const settings = {
    ...candidate.settings,
    walletAccounts: { 'bank-fixture': '512100' },
    debts: [{ originTransactionId: 'funding', assetId: 'linked-house', repayments: [{ transactionId: 'repayment' }] }],
    archivedDebts: [{ originTransactionId: 'archived-source' }],
    positions: [{ transactionIds: ['deposit'] }],
    assetLinks: [{ asset_id: 'linked-car', transaction_id: 'car-purchase' }],
    positionAudit: [{ transactionId: 'historic-source' }],
  };
  const sources = { ...scope, complete: true,
    transactionIds: ['funding', 'repayment', 'deposit', 'car-purchase'],
    assetIds: ['linked-house', 'linked-car'], walletIds: ['bank-fixture'],
  };
  const review = (inventory, data = settings) => previewAccountingRestore(raw({ settings: data }), scope, inventory);

  it('confirms presence of the active references, without using archived rows or claiming restore readiness', () => {
    expect(review(sources)).toMatchObject({ status: 'references-present', requiresFurtherValidation: true });
  });

  it.each([{ complete: false }, { travelId: 'other-trip' }, { userId: 'other-user' }, { walletIds: null }])(
    'never reports an inventory that cannot be trusted as missing data: %j', changes => {
      expect(review({ ...sources, ...changes })).toEqual({ status: 'sources-unavailable' });
    },
  );

  it('reports missing types without returning IDs or data', () => {
    const result = review({ ...sources, transactionIds: ['funding', 'deposit', 'car-purchase'], assetIds: [], walletIds: [] });
    expect(result).toEqual({ status: 'missing-references', missing: { transaction: 1, asset: 2, wallet: 1 } });
    expect(JSON.stringify(result)).not.toMatch(/repayment|linked-house|bank-fixture/);
  });

  it('does not silently skip a malformed active reference', () => {
    expect(review(sources, { ...settings, positions: [{ transactionIds: [null] }] }))
      .toEqual({ status: 'invalid-active-references' });
  });

  it.each([
    ['debt origin and repayment', { debts: [{ originTransactionId: 'funding', repayments: [{ transactionId: 'funding' }] }] }],
    ['multiple positions', { positions: [{ transactionIds: ['deposit'] }, { transactionIds: ['deposit'] }] }],
    ['position and asset purchase', { positions: [{ transactionIds: ['deposit', 'car-purchase'] }] }],
    ['two links for one purchase', { assetLinks: [
      { asset_id: 'linked-car', transaction_id: 'car-purchase' },
      { asset_id: 'linked-house', transaction_id: 'car-purchase' },
    ] }],
  ])('reports a transaction reused by %s without exposing its ID', (_case, changes) => {
    expect(review(sources, { ...settings, ...changes }))
      .toEqual({ status: 'conflicting-references', conflicts: { transaction: 1 } });
  });

  it('does not count archived links or references to the same asset as active transaction conflicts', () => {
    const debts = [...settings.debts, { assetId: 'linked-house', repayments: [] }];
    expect(review(sources, {
      ...settings, debts,
      archivedDebts: [{ originTransactionId: 'funding' }],
      positionAudit: [{ transactionId: 'deposit' }],
    })).toMatchObject({ status: 'references-present', requiresFurtherValidation: true });
  });

});

describe('typed debt and position source review', () => {
  const settings = { ...candidate.settings,
    debts: [{ currency: 'EUR', openingDate: '2026-01-15', openingAmount: 350, originTransactionId: 'funding', repayments: [{ transactionId: 'repayment', principal: 25 }] }],
    positions: [{ currency: 'NZD', transactionIds: ['deposit'] }],
  };
  const sources = { ...scope, complete: true,
    transactionIds: ['funding', 'repayment', 'deposit'], assetIds: [], walletIds: [], asOfDay: '2026-01-31',
    transactionMetadata: [
      { id: 'funding', currency: 'eur', type: 'income', amount: 350, cashDate: '2026-01-15', payNow: true },
      { id: 'repayment', currency: 'EUR', type: 'expense', amount: 30, cashDate: '2026-01-20', payNow: true },
      { id: 'deposit', currency: 'NZD', type: 'expense', amount: 80, cashDate: '2026-01-31', payNow: true },
    ],
  };
  const review = (inventory = sources, data = settings) =>
    previewAccountingRestore(raw({ settings: data }), scope, inventory);

  it('returns a limited match and still does not authorize a restore', () => {
    expect(review()).toMatchObject({ status: 'references-present', requiresFurtherValidation: true });
  });

  it.each([
    [0, { currency: 'AUD' }],
    [1, { type: 'income' }],
    [2, { type: 'transfer', currency: 'USD' }],
  ])('reports one incompatible transaction without returning details: %j', (index, change) => {
    const rows = sources.transactionMetadata.map((row, i) => i === index ? { ...row, ...change } : row);
    expect(review({ ...sources, transactionMetadata: rows }))
      .toEqual({ status: 'incompatible-references', incompatible: { transaction: 1 } });
  });

  it.each([
    [0, 349.99],
    [1, 24.99],
    [2, 0],
  ])('reports a source amount incompatible with the active attribution: %j', (index, amount) => {
    const rows = sources.transactionMetadata.map((row, i) => i === index ? { ...row, amount } : row);
    expect(review({ ...sources, transactionMetadata: rows }))
      .toEqual({ status: 'incompatible-references', incompatible: { transaction: 1 } });
  });

  it('accepts only the principal as repayment, using the same cents check as the ledger', () => {
    const rows = sources.transactionMetadata.map((row, i) => i === 1 ? { ...row, amount: 24.999 } : row);
    expect(review({ ...sources, transactionMetadata: rows }))
      .toMatchObject({ status: 'references-present', requiresFurtherValidation: true });
  });

  it('distinguishes invalid candidate amounts from unavailable source amount metadata', () => {
    const [debt] = settings.debts;
    expect(review(sources, { ...settings, debts: [{ ...debt, openingAmount: null }] }))
      .toEqual({ status: 'invalid-active-references' });
    expect(review(sources, { ...settings, debts: [{ ...debt, repayments: [{ ...debt.repayments[0], principal: 0 }] }] }))
      .toEqual({ status: 'invalid-active-references' });
    const rows = sources.transactionMetadata.map((row, i) => i === 0 ? { ...row, amount: '350' } : row);
    expect(review({ ...sources, transactionMetadata: rows })).toEqual({ status: 'sources-unavailable' });
  });

  it.each([
    [0, { cashDate: '2026-01-16' }],
    [1, { cashDate: '2026-01-14' }],
    [1, { payNow: false }],
    [2, { cashDate: '2026-02-01', budgetDate: '2026-01-31' }],
  ])('reports active sources whose settlement or date is incompatible: %j', (index, change) => {
    const rows = sources.transactionMetadata.map((row, i) => i === index ? { ...row, ...change } : row);
    expect(review({ ...sources, transactionMetadata: rows }))
      .toEqual({ status: 'incompatible-references', incompatible: { transaction: 1 } });
  });

  it('uses the cash date rather than the budget date, inclusive of the debt opening and review day', () => {
    const rows = sources.transactionMetadata.map((row, i) => i === 1
      ? { ...row, cashDate: '2026-01-15', budgetDate: '2026-02-01' } : row);
    expect(review({ ...sources, transactionMetadata: rows }))
      .toMatchObject({ status: 'references-present', requiresFurtherValidation: true });
  });

  it('distinguishes invalid opening dates from incomplete trusted source chronology', () => {
    const [debt] = settings.debts;
    for (const openingDate of ['2026-02-01', '2026-01-00']) {
      expect(review(sources, { ...settings, debts: [{ ...debt, openingDate }] }))
        .toEqual({ status: 'invalid-active-references' });
    }
    expect(review({ ...sources, asOfDay: '2026-02-30' })).toEqual({ status: 'sources-unavailable' });
    const rows = sources.transactionMetadata.map((row, i) => i === 1
      ? { ...row, payNow: undefined } : row);
    expect(review({ ...sources, transactionMetadata: rows })).toEqual({ status: 'sources-unavailable' });
  });

  it('cannot claim compatibility if metadata is missing or ambiguous', () => {
    for (const rows of [
      sources.transactionMetadata.slice(0, 2),
      [...sources.transactionMetadata, { id: 'deposit', currency: 'AUD', type: 'expense' }],
      sources.transactionMetadata.map(row => ({ ...row, currency: null })),
    ]) expect(review({ ...sources, transactionMetadata: rows })).toEqual({ status: 'sources-unavailable' });
  });

  it('rejects a missing denomination in a candidate with an active position', () => {
    expect(review(sources, { ...settings, positions: [{ transactionIds: ['deposit'] }] }))
      .toEqual({ status: 'invalid-active-references' });
  });
});
