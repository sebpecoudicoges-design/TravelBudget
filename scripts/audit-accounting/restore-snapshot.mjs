// Disposable F14 fixture. This is not the production schema, a migration, or an import.
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { previewAccountingRestoreFromCapture } from '../../src/features/accounting/accountingRestoreInventory.js';
import { startNutritionAuditPostgres } from '../audit-nutrition/local-postgres.mjs';

const [pgBin, driver] = process.argv.slice(2);
if (!pgBin || !driver) throw Error('Provide local PostgreSQL binaries and pg module.');
const db = await startNutritionAuditPostgres(pgBin, driver);
try {
  const writer = await db.connect();
  const reader = await db.connect();
  const scope = { userId: 'account-a', travelId: 'travel-a' };
  const asOfDay = '2026-01-31';
  const families = ['wallets', 'transactions', 'assets', 'assetLinks'];
  const funding = {
    currency: 'EUR', type: 'income', amount: 300, payNow: true, cashDate: '2026-01-01',
    isInternal: false, internalTransferId: null, tripExpenseId: null, detachedTripPayment: false,
    virtualBudgetOnly: false, recurringInstanceStatus: null,
  };
  const raw = JSON.stringify({ version: 1, ...scope, createdAt: asOfDay + 'T12:00:00.000Z', settings: {
    mapping: {}, inferredMapping: {}, classificationVersion: 4, mappingBeforeDetailedChart: {},
    walletAccounts: { 'wallet-2': '512100' }, balances: {}, equityMode: 'calculated',
    debts: [{ openingAmount: 300, currency: 'EUR', openingDate: '2026-01-01', originTransactionId: 'funding', repayments: [] }],
    archivedDebts: [], positions: [], assetLinks: [], positionAudit: [],
  } });

  await writer.query(`
    CREATE TABLE fixture_source (
      family text NOT NULL, owner_id text NOT NULL, travel_id text,
      id text NOT NULL, metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      PRIMARY KEY (family, owner_id, id)
    );
  `);
  const insert = (family, owner, travel, id, meta = {}) =>
    writer.query('INSERT INTO fixture_source VALUES ($1,$2,$3,$4,$5)', [family, owner, travel, id, meta]);
  await insert('wallets', scope.userId, scope.travelId, 'wallet-1');
  await insert('wallets', scope.userId, scope.travelId, 'wallet-2');
  await insert('wallets', scope.userId, 'other-travel', 'elsewhere');
  await insert('wallets', 'account-b', scope.travelId, 'foreign');
  await insert('transactions', scope.userId, scope.travelId, 'funding', funding);
  await insert('assets', scope.userId, 'other-travel', 'asset-1');
  await insert('assets', 'account-b', scope.travelId, 'foreign-asset');
  await insert('assetLinks', 'account-b', 'other-travel', 'foreign-link',
    { assetId: 'foreign-asset', transactionId: 'funding' });

  async function readCapture(afterFirstPage) {
    await reader.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    try {
      assert.equal((await reader.query('SHOW transaction_read_only')).rows[0].transaction_read_only, 'on');
      assert.equal((await reader.query('SHOW transaction_isolation')).rows[0].transaction_isolation, 'repeatable read');
      const reportedSnapshot = async () => (await reader.query('SELECT pg_current_snapshot()::text AS version')).rows[0].version;
      const snapshot = await reportedSnapshot();
      const pages = {};
      for (const source of families) {
        const travelScoped = ['wallets', 'transactions'].includes(source);
        const filter = 'family = $1 AND owner_id = $2 AND (NOT $3::boolean OR travel_id = $4)';
        const args = [source, scope.userId, travelScoped, scope.travelId];
        const total = (await reader.query('SELECT count(*)::int AS total FROM fixture_source WHERE ' + filter, args)).rows[0].total;
        assert.ok(total < 10, 'this is a bounded fixture, not a general reader');
        pages[source] = [];
        for (let offset = 0; offset < Math.max(total, 1); offset++) {
          const { rows } = await reader.query(
            'SELECT id, owner_id, travel_id, metadata FROM fixture_source WHERE ' + filter + ' ORDER BY id LIMIT 1 OFFSET $5',
            [...args, offset],
          );
          pages[source].push({ ...scope, source, total, offset, snapshot: await reportedSnapshot(),
            rows: rows.map(row => ({ ...row.metadata, userId: row.owner_id, travelId: row.travel_id, id: row.id })) });
          if (source === 'wallets' && offset === 0) await afterFirstPage?.();
        }
      }
      return { ...scope, asOfDay, snapshot, pages };
    } finally {
      await reader.query('ROLLBACK');
    }
  }

  // Model confirmation in the fixture only. Compare the validated scoped content,
  // not the global transaction label or the preview's coarse success status.
  const scopedContent = capture => ({
    asOfDay: capture.asOfDay,
    sources: Object.fromEntries(families.map(family =>
      [family, capture.pages[family].flatMap(page => page.rows)])),
  });
  const startReview = (candidate, reviewedScope, capture, localRevision) => {
    if (typeof localRevision !== 'string' || !localRevision ||
        previewAccountingRestoreFromCapture(candidate, reviewedScope, capture).status !== 'references-present') return null;
    return structuredClone({ candidate, reviewedScope, localRevision, content: scopedContent(capture) });
  };
  function confirmDryRun(review, candidate, activeScope, fresh, localRevision) {
    if (!review ||
        review.reviewedScope.userId !== activeScope.userId ||
        review.reviewedScope.travelId !== activeScope.travelId) return 'scope-unavailable';
    if (review.candidate !== candidate || review.localRevision !== localRevision) return 'review-required';
    if (previewAccountingRestoreFromCapture(candidate, activeScope, fresh).status !== 'references-present') {
      return 'references-not-confirmed';
    }
    return isDeepStrictEqual(review.content, scopedContent(fresh)) ? 'dry-run-ready' : 'review-required';
  }

  const before = await readCapture();
  const review = startReview(raw, scope, before, 'local-r1');
  assert.ok(review);
  assert.equal(startReview(raw, scope, before), null);
  assert.equal(confirmDryRun(review, raw, scope, await readCapture(), 'local-r1'), 'dry-run-ready');

  // An unrelated commit can advance the DB's clock without changing the reviewed scope.
  await insert('wallets', 'account-b', scope.travelId, 'irrelevant-new-wallet');
  const unrelated = await readCapture();
  assert.notEqual(before.snapshot, unrelated.snapshot);
  assert.equal(confirmDryRun(review, raw, scope, unrelated, 'local-r1'), 'dry-run-ready');

  // A scoped metadata change can leave all IDs, counts, and the coarse result identical.
  await writer.query("UPDATE fixture_source SET metadata = metadata || $2::jsonb WHERE family = 'transactions' AND owner_id = $1 AND id = 'funding'",
    [scope.userId, { cashDate: '2025-12-31' }]);
  const compatible = await readCapture();
  assert.equal(previewAccountingRestoreFromCapture(raw, scope, compatible).status, 'references-present');
  const ids = (capture, family) => capture.pages[family].flatMap(p => p.rows.map(row => row.id));
  for (const family of families) assert.deepEqual(ids(before, family), ids(compatible, family));
  assert.equal(confirmDryRun(review, raw, scope, compatible, 'local-r1'), 'review-required');
  const reviewedAgain = startReview(raw, scope, compatible, 'local-r1');
  assert.equal(confirmDryRun(reviewedAgain, raw, scope, compatible, 'local-r1'), 'dry-run-ready');
  assert.equal(confirmDryRun(reviewedAgain, raw, scope, compatible, 'local-r2'), 'review-required');
  assert.equal(confirmDryRun(reviewedAgain, raw + '\n', scope, compatible, 'local-r1'), 'review-required');
  assert.equal(confirmDryRun(reviewedAgain, raw, { ...scope, travelId: 'other-travel' }, compatible, 'local-r1'), 'scope-unavailable');
  assert.equal(confirmDryRun(reviewedAgain, raw, { ...scope, userId: 'account-b' }, compatible, 'local-r1'), 'scope-unavailable');

  const frozen = await readCapture(async () => {
    await writer.query('BEGIN');
    await insert('wallets', scope.userId, scope.travelId, 'wallet-0');
    await insert('assetLinks', scope.userId, 'other-travel', 'asset-funding-link',
      { assetId: 'asset-1', transactionId: 'funding' });
    await writer.query('COMMIT');
  });
  const current = await readCapture();
  const preview = capture => previewAccountingRestoreFromCapture(raw, scope, capture);
  assert.notEqual(frozen.snapshot, current.snapshot);
  assert.deepEqual(ids(frozen, 'wallets'), ['wallet-1', 'wallet-2']);
  assert.deepEqual(ids(current, 'wallets'), ['wallet-0', 'wallet-1', 'wallet-2']);
  assert.deepEqual(ids(frozen, 'assetLinks'), []);
  assert.deepEqual(ids(current, 'assetLinks'), ['asset-funding-link']);
  assert.deepEqual(ids(current, 'assets'), ['asset-1']);
  assert.equal(preview(frozen).status, 'references-present');
  assert.deepEqual(preview(current), { status: 'incompatible-references', incompatible: { transaction: 1 } });
  const mixed = { ...frozen, pages: { ...frozen.pages, assetLinks: current.pages.assetLinks } };
  assert.deepEqual(preview(mixed), { status: 'sources-unavailable' });
  assert.equal(confirmDryRun(reviewedAgain, raw, scope, current, 'local-r1'), 'references-not-confirmed');
  assert.equal(confirmDryRun(reviewedAgain, raw, scope, mixed, 'local-r1'), 'references-not-confirmed');
  assert.equal(startReview(raw, scope, current, 'local-r1'), null);
  console.log('PASS: dry-run confirmation requires the same candidate, scope, local revision, and compatible scoped content.');
  console.log('PASS: coherent historical and current captures, account/travel filters, and mixed capture rejected.');
} finally {
  await db.close();
}
