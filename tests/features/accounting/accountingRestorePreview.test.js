import { describe, expect, it } from 'vitest';
import { debtLedger } from '../../../src/features/accounting/accountingDebts.js';
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
const ordinary = { isInternal: false, internalTransferId: null };
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
      { ...ordinary, id: 'funding', currency: 'eur', type: 'income', amount: 350, cashDate: '2026-01-15', payNow: true },
      { ...ordinary, id: 'repayment', currency: 'EUR', type: 'expense', amount: 30, cashDate: '2026-01-20', payNow: true },
      { ...ordinary, id: 'deposit', currency: 'NZD', type: 'expense', amount: 80, cashDate: '2026-01-31', payNow: true },
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
      [...sources.transactionMetadata, { ...ordinary, id: 'deposit', currency: 'AUD', type: 'expense' }],
      sources.transactionMetadata.map(row => ({ ...row, currency: null })),
    ]) expect(review({ ...sources, transactionMetadata: rows })).toEqual({ status: 'sources-unavailable' });
  });

  it('rejects a missing denomination in a candidate with an active position', () => {
    expect(review(sources, { ...settings, positions: [{ transactionIds: ['deposit'] }] }))
      .toEqual({ status: 'invalid-active-references' });
  });
});

describe('typed purchases in the accounting restore review', () => {
  const settings = { ...candidate.settings,
    assetLinks: [{ asset_id: 'synthetic-bike', transaction_id: 'synthetic-payment' }],
  };
  const txn = { ...ordinary, id: 'synthetic-payment', type: 'expense', currency: 'EUR', amount: 400,
    cashDate: '2026-01-15', payNow: true };
  const asset = { id: 'synthetic-bike', currency: 'EUR', purchaseValue: 400, purchaseDate: '2026-01-16' };
  const sources = { ...scope, complete: true, asOfDay: '2026-01-31',
    transactionIds: [txn.id], assetIds: [asset.id], walletIds: [],
    transactionMetadata: [txn], assetMetadata: [asset],
  };
  const review = (input = sources, data = settings) =>
    previewAccountingRestore(raw({ settings: data }), scope, input);

  it('accepts a paid expense whose native currency and rounded amount agree', () => {
    expect(review({ ...sources, assetMetadata: [{ ...asset, purchaseValue: 399.999 }] }))
      .toMatchObject({ status: 'references-present', requiresFurtherValidation: true });
  });
  it.each([
    { currency: 'AUD' }, { purchaseValue: 399.99 }, { purchaseDate: '2026-02-01' },
  ])('counts one incompatible purchase without revealing asset data: %j', changes => {
    const result = review({ ...sources, assetMetadata: [{ ...asset, ...changes }] });
    expect(result).toEqual({ status: 'incompatible-references', incompatible: { transaction: 1 } });
  });
  it.each([{ type: 'income' }, { payNow: false }])('rejects an ineligible payment: %j', changes => {
    expect(review({ ...sources, transactionMetadata: [{ ...txn, ...changes }] }))
      .toEqual({ status: 'incompatible-references', incompatible: { transaction: 1 } });
  });
  it('distinguishes incomplete asset metadata from a genuinely missing reference', () => {
    expect(review({ ...sources, assetMetadata: [{ ...asset, purchaseDate: '2026-02-30' }] }))
      .toEqual({ status: 'sources-unavailable' });
    expect(review({ ...sources, assetMetadata: [] })).toEqual({ status: 'sources-unavailable' });
    expect(review({ ...sources, assetMetadata: [asset, asset] })).toEqual({ status: 'sources-unavailable' });
    expect(review({ ...sources, assetIds: [], assetMetadata: [] }))
      .toEqual({ status: 'missing-references', missing: { transaction: 0, asset: 1, wallet: 0 } });
  });
});

describe('typed debt balance history', () => {
  const debt = { id: 'synthetic-loan', name: 'Dette fictive', currency: 'EUR',
    openingAmount: 100, openingDate: '2026-01-01',
    repayments: [{ transactionId: 'payment-2', principal: 50 }, { transactionId: 'payment-1', principal: 60 }],
  };
  const sources = { ...scope, complete: true, asOfDay: '2026-01-31',
    transactionIds: ['payment-1', 'payment-2'], assetIds: [], walletIds: [],
    transactionMetadata: [
      { ...ordinary, id: 'payment-2', currency: 'EUR', type: 'expense', amount: 55, payNow: true, cashDate: '2026-01-20' },
      { ...ordinary, id: 'payment-1', currency: 'EUR', type: 'expense', amount: 65, payNow: true, cashDate: '2026-01-10' },
    ],
  };
  const adjust = (date, amount) => ({ id: 'synthetic-adjustment', date, amount, reason: 'Correction privée fictive' });
  const review = (data = debt, inventory = sources) => previewAccountingRestore(raw({ settings: {
    ...candidate.settings, debts: [data], archivedDebts: [{ ...debt, openingAmount: 1 }],
  } }), scope, inventory);
  const rejected = { status: 'incompatible-references', incompatible: { debt: 1 } };

  it('rejects payments that fit individually but together exceed capital; does not return amounts or identifiers', () => {
    expect(review()).toEqual(rejected);
  });

  it('uses trusted cash-date order and counts same-day adjustments before payment', () => {
    const candidateDebt = { ...debt, adjustments: [adjust('2026-01-20', 10)] };
    expect(review(candidateDebt)).toMatchObject({ status: 'references-present', requiresFurtherValidation: true });
    const tooLate = { ...candidateDebt, adjustments: [adjust('2026-01-21', 10)] };
    expect(review(tooLate)).toEqual(rejected);
    const liveBalance = d => debtLedger({ debts: [d] }, sources.transactionMetadata, sources.asOfDay).rows[0].remaining;
    expect(liveBalance(candidateDebt)).toBe(0);
    expect(liveBalance(tooLate)).toBeNull();
  });

  it('guards balances in cents down to zero, including a signed adjustment', () => {
    const exact = { ...debt, openingAmount: 110.01, adjustments: [adjust('2026-01-10', -0.01)] };
    expect(review(exact)).toMatchObject({ status: 'references-present', requiresFurtherValidation: true });
    expect(review({ ...exact, openingAmount: 110 })).toEqual(rejected);
  });

  it.each([null, [adjust('2026-02-01', 10)], [adjust('2026-01-20', '10')], [adjust('2026-01-20', 0)]])(
    'rejects malformed active adjustments: %j', adjustments => {
      expect(review({ ...debt, adjustments })).toEqual({ status: 'invalid-active-references' });
    },
  );

  it('reports an unavailable or incompatible source before interpreting the debt balance', () => {
    expect(review(debt, { ...sources, transactionMetadata: sources.transactionMetadata.slice(1) }))
      .toEqual({ status: 'sources-unavailable' });
    const [first, second] = sources.transactionMetadata;
    expect(review(debt, { ...sources, transactionMetadata: [{ ...first, payNow: false }, second] }))
      .toEqual({ status: 'incompatible-references', incompatible: { transaction: 1 } });
  });
});

describe('trusted transfer classification in the typed restore preview', () => {
  const tx = { ...ordinary, id: 'synthetic-source', currency: 'EUR', type: 'income', amount: 80,
    cashDate: '2026-01-15', payNow: true };
  const inventory = { ...scope, complete: true, asOfDay: '2026-01-31',
    transactionIds: [tx.id], assetIds: [], walletIds: [],
  };
  const review = (changes, settings = { positions: [{ currency: 'EUR', transactionIds: [tx.id] }] }) =>
    previewAccountingRestore(raw({ settings: { ...candidate.settings, ...settings } }), scope,
      { ...inventory, transactionMetadata: [{ ...tx, ...changes }] });
  const linkedShare = { isInternal: true, tripShareLinkId: 'synthetic-share', tripExpenseId: null,
    label: null, affectsBudget: true, outOfBudget: false };
  const rejected = { status: 'incompatible-references', incompatible: { transaction: 1 } };

  it('rejects an explicit wallet transfer even when its type and budget fields look eligible', () => {
    expect(review({ ...linkedShare, internalTransferId: 'synthetic-transfer' })).toEqual(rejected);
    expect(review({ internalTransferId: 'synthetic-transfer' })).toEqual(rejected);
  });

  it('does not classify an eligible Trip income share as a wallet transfer just because the legacy flag is set', () => {
    expect(review(linkedShare)).toMatchObject({ status: 'references-present', requiresFurtherValidation: true });
    expect(review({ ...linkedShare, tripShareLinkId: null, label: '[Trip] Part entrée - Fixture' }))
      .toMatchObject({ status: 'references-present', requiresFurtherValidation: true });
    expect(review({ ...linkedShare, affectsBudget: false })).toEqual(rejected);
  });

  it.each([{ internalTransferId: undefined }, { isInternal: undefined }, { isInternal: 'false' },
    { ...linkedShare, tripShareLinkId: undefined }, { ...linkedShare, label: undefined }])(
    'distinguishes incomplete trusted classification from incompatibility: %j', changes => {
      expect(review(changes)).toEqual({ status: 'sources-unavailable' });
    },
  );

  it('applies the same transfer exclusion to a debt source, before calculating its timeline', () => {
    expect(review({ internalTransferId: 'synthetic-transfer' }, { debts: [{
      currency: 'EUR', openingDate: '2026-01-15', openingAmount: 80,
      originTransactionId: tx.id, repayments: [],
    }] })).toEqual(rejected);
  });
});
