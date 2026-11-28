import { describe, expect, it } from 'vitest';
import { previewAccountingRestoreFromCapture } from '../../../src/features/accounting/accountingRestoreInventory.js';

const scope = { userId: 'fixture-account', travelId: 'fixture-travel' };
const snapshot = 'repeatable-fixture-1';
const row = id => ({ ...scope, id });
const page = (source, rows, total = rows.length, offset = 0) => ({ ...scope, snapshot, source, rows, total, offset });
const settings = {
  mapping: {}, inferredMapping: {}, classificationVersion: 4, mappingBeforeDetailedChart: {},
  walletAccounts: {}, balances: {}, equityMode: 'calculated', debts: [], archivedDebts: [],
  positions: [], assetLinks: [], positionAudit: [],
};
const raw = changes => JSON.stringify({
  version: 1, ...scope, createdAt: '2026-01-31T12:00:00.000Z', settings: { ...settings, ...changes },
});
const capture = () => ({
  ...scope, snapshot, asOfDay: '2026-01-31',
  pages: Object.fromEntries(['transactions', 'wallets', 'assets', 'assetLinks'].map(source => [source, [page(source, [])]])),
});
const preview = (c, changes, active = scope) => previewAccountingRestoreFromCapture(raw(changes), active, c);

describe('F14 restore inventory from a witnessed snapshot', () => {
  it('distinguishes an explicitly empty snapshot from an absent source', () => {
    expect(preview(capture())).toMatchObject({ status: 'references-present', requiresFurtherValidation: true });
    const changes = { walletAccounts: { 'fictional-wallet': '512100' } };
    expect(preview(capture(), changes)).toEqual({
      status: 'missing-references', missing: { transaction: 0, wallet: 1, asset: 0 },
    });
    const c = capture();
    delete c.pages.wallets;
    expect(preview(c, changes)).toEqual({ status: 'sources-unavailable' });
    expect(preview(null, changes)).toEqual({ status: 'sources-unavailable' });
  });

  it('accepts a complete two-page source for the current account and trip', () => {
    const c = capture();
    c.pages.wallets = [page('wallets', [row('w1')], 2), page('wallets', [row('w2')], 2, 1)];
    expect(preview(c, { walletAccounts: { w2: '512100' } })).toMatchObject({ status: 'references-present' });
  });

  it.each([
    ['missing tail', pages => pages.pop()],
    ['null rows', pages => { pages[1].rows = null; }],
    ['empty tail', pages => { pages[1].rows = []; }],
    ['mixed snapshots', pages => { pages[1].snapshot = 'later-snapshot'; }],
    ['wrong family', pages => { pages[1].source = 'assets'; }],
    ['ambiguous pagination', pages => { pages[1].offset = 2; }],
    ['changed total', pages => { pages[1].total = 3; }],
    ['duplicate ID', pages => { pages[1].rows[0].id = 'w1'; }],
    ['foreign-account row', pages => { pages[1].rows[0].userId = 'other-account'; }],
    ['foreign-trip row', pages => { pages[1].rows[0].travelId = 'other-trip'; }],
    ['wrong page scope', pages => { pages[1].travelId = 'other-trip'; }],
  ])('does not report missing sources from %s', (_, breakPages) => {
    const c = capture();
    c.pages.wallets = [page('wallets', [row('w1')], 2), page('wallets', [row('w2')], 2, 1)];
    breakPages(c.pages.wallets);
    expect(preview(c, { walletAccounts: { w2: '512100' } })).toEqual({ status: 'sources-unavailable' });
  });

  it.each([{ userId: 'other-account' }, { travelId: 'other-trip' }])(
    'cannot use a completed capture after switching context: %j', changed => {
      expect(preview(capture(), {}, { ...scope, ...changed })).toEqual({ status: 'scope-mismatch' });
      const scopedCandidate = JSON.stringify({ ...JSON.parse(raw()), ...changed });
      expect(previewAccountingRestoreFromCapture(scopedCandidate, { ...scope, ...changed }, capture()))
        .toEqual({ status: 'sources-unavailable' });
    },
  );

  it('derives linked status from the complete source, not from a row flag or the backup', () => {
    const c = capture();
    const tx = {
      ...row('funding'), currency: 'EUR', type: 'income', amount: 300, payNow: true, cashDate: '2026-01-01',
      isInternal: false, internalTransferId: null, tripExpenseId: null, detachedTripPayment: false,
      virtualBudgetOnly: false, recurringInstanceStatus: null, hasAssetTransactionLink: false,
    };
    c.pages.transactions = [page('transactions', [tx])];
    c.pages.assets = [page('assets', [{ id: 'a', userId: scope.userId }])];
    const changes = { debts: [{
      openingAmount: 300, currency: 'EUR', openingDate: '2026-01-01',
      originTransactionId: 'funding', repayments: [],
    }] };
    expect(preview(c, changes)).toMatchObject({ status: 'references-present' });
    c.pages.assetLinks = [page('assetLinks', [
      { id: 'link', userId: scope.userId, assetId: 'a', transactionId: 'funding' },
      { id: 'other', userId: scope.userId, assetId: 'a', transactionId: 'another-trip-transaction' },
    ])];
    expect(preview(c, changes)).toEqual({ status: 'incompatible-references', incompatible: { transaction: 1 } });
    c.pages.assetLinks[0].rows.pop();
    expect(preview(c, changes)).toEqual({ status: 'sources-unavailable' });
  });
});
