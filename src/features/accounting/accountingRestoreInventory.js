import { previewAccountingRestore } from './accountingRestorePreview.js';
import { validDay } from './accountingRecognition.js';

// Prototype only: no current report reader provides this snapshot contract.
const MAX_ROWS_PER_SOURCE = 10_000;
const isId = value => typeof value === 'string' && value.length > 0 && value.trim() === value;
const sameScope = (value, scope) => value?.userId === scope.userId && value?.travelId === scope.travelId;
const sourceNames = ['transactions', 'wallets', 'assets', 'assetLinks'];

function collectPages(pages, scope, snapshot, source) {
  if (!Array.isArray(pages) || !pages.length || pages.length > MAX_ROWS_PER_SOURCE) return null;
  const total = pages[0]?.total;
  if (!Number.isSafeInteger(total) || total < 0 || total > MAX_ROWS_PER_SOURCE) return null;

  const rows = new Map();
  const tripScoped = source === 'transactions' || source === 'wallets';
  for (const page of pages) {
    if (!sameScope(page, scope) || page.snapshot !== snapshot || page.source !== source ||
        page.total !== total || page.offset !== rows.size || !Array.isArray(page.rows) ||
        (!page.rows.length && (total !== 0 || pages.length !== 1)) || page.rows.length + rows.size > total) return null;
    for (const row of page.rows) {
      if (!isId(row?.id) || rows.has(row.id) || row.userId !== scope.userId ||
          (tripScoped && row.travelId !== scope.travelId)) return null;
      if (source === 'assetLinks' && (!isId(row.assetId) || !isId(row.transactionId))) return null;
      rows.set(row.id, row);
    }
  }
  return rows.size === total ? rows : null;
}

function inventoryFor(scope, capture) {
  if (!isId(scope?.userId) || !isId(scope?.travelId) || !sameScope(capture, scope)
      || !isId(capture.snapshot) || !validDay(capture.asOfDay)) return null;
  const values = sourceNames.map(source => collectPages(capture.pages?.[source], scope, capture.snapshot, source));
  if (values.some(value => value === null)) return null;
  const [transactions, wallets, assets, links] = values;
  const linked = new Set();
  for (const link of links.values()) {
    if (!assets.has(link.assetId)) return null;
    // Links are account-wide, while the transaction set contains only this trip.
    linked.add(link.transactionId);
  }
  return {
    userId: scope.userId, travelId: scope.travelId, complete: true, asOfDay: capture.asOfDay,
    transactionIds: [...transactions.keys()], walletIds: [...wallets.keys()], assetIds: [...assets.keys()],
    transactionMetadata: [...transactions.values()].map(row => ({ ...row, hasAssetTransactionLink: linked.has(row.id) })),
    assetMetadata: [...assets.values()],
  };
}

// The caller must supply an independent trusted read over a single server snapshot,
// not a report cache, the candidate file, or matching counts from separate requests.
export function previewAccountingRestoreFromCapture(raw, activeScope, capture) {
  return previewAccountingRestore(raw, activeScope, inventoryFor(activeScope, capture));
}
