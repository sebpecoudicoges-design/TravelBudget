import { internalAccounting, settledAt, validDay } from './accountingRecognition.js';

// Internal prototype. The result is not a restore authorization and carries no settings.
const MAX_BYTES = 500_000;
const MAX_DEPTH = 16;
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const positiveAmount = value => Number.isFinite(value) && value > 0;
const cents = value => Math.round(value * 100);
const isId = value => typeof value === 'string' && value.length > 0 && value.trim() === value;
const isStringMap = value => isRecord(value) && Object.values(value).every(item => typeof item === 'string');
const isRecordList = value => Array.isArray(value) && value.every(isRecord);

const familyChecks = {
  classification: {
    mapping: isStringMap, inferredMapping: isStringMap, mappingBeforeDetailedChart: isStringMap,
    walletAccounts: isStringMap,
    classificationVersion: v => Number.isSafeInteger(v) && v >= 0,
  },
  balances: {
    balances: v => isRecord(v) && Object.values(v).every(isRecord),
    equityMode: v => v === 'declared' || v === 'calculated',
  },
  debts: { debts: isRecordList, archivedDebts: isRecordList },
  positions: { positions: isRecordList, assetLinks: isRecordList, positionAudit: isRecordList },
};
const settingsChecks = Object.assign({}, ...Object.values(familyChecks));
const envelopeFields = ['version', 'userId', 'travelId', 'createdAt', 'settings'];
const hasExactFields = (value, fields) => isRecord(value) &&
  Object.keys(value).length === fields.length && fields.every(field => Object.hasOwn(value, field));

function isTimestamp(value) {
  if (typeof value !== 'string') return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString() === value;
}

function withinDepth(root) {
  const stack = [[root, 0]];
  while (stack.length > 0) {
    const [value, depth] = stack.pop();
    if (depth > MAX_DEPTH) return false;
    if (value !== null && typeof value === 'object') {
      for (const child of Object.values(value)) stack.push([child, depth + 1]);
    }
  }
  return true;
}

function validDebtTimeline(debt, asOfDay) {
  return positiveAmount(debt.openingAmount) && Number.isSafeInteger(cents(debt.openingAmount))
    && cents(debt.openingAmount) > 0 && validDay(debt.openingDate) && debt.openingDate <= asOfDay
    && typeof debt.currency === 'string' && /^[A-Z]{3}$/.test(debt.currency)
    && (debt.adjustments === undefined || (isRecordList(debt.adjustments) && debt.adjustments.every(a =>
      isId(a.id) && typeof a.reason === 'string' && a.reason.trim() && validDay(a.date)
      && a.date >= debt.openingDate && a.date <= asOfDay && Number.isFinite(a.amount)
      && Number.isSafeInteger(cents(a.amount)) && cents(a.amount) !== 0)));
}

function negativeDebtBalance(debt, transactionById) {
  const events = [
    ...(debt.adjustments || []).map(a => ({ date: a.date, id: a.id, kind: 0, delta: cents(a.amount) })),
    ...debt.repayments.map(r => ({
      date: transactionById.get(r.transactionId).cashDate, id: r.transactionId, kind: 1, delta: cents(-r.principal),
    })),
  ].sort((a, b) => a.date.localeCompare(b.date) || a.kind - b.kind || a.id.localeCompare(b.id));
  let balance = BigInt(cents(debt.openingAmount));
  return events.some(e => {
    balance += BigInt(e.delta);
    return balance < 0n;
  });
}

function hasTransferClassification(row) {
  const nullableId = id => id === null || isId(id);
  if (typeof row.isInternal !== 'boolean' || !nullableId(row.internalTransferId)) return false;
  // A legacy internal flag without an explicit transfer ID can describe a Trip share.
  return !row.isInternal || row.internalTransferId !== null
    || (typeof row.affectsBudget === 'boolean' && typeof row.outOfBudget === 'boolean'
      && nullableId(row.tripShareLinkId) && nullableId(row.tripExpenseId)
      && (row.label === null || typeof row.label === 'string'));
}

// An incomplete, unscoped, or malformed inventory cannot prove absence.
function reviewActiveReferences(settings, scope, sources) {
  const sourceLists = { transaction: sources?.transactionIds, asset: sources?.assetIds, wallet: sources?.walletIds };
  if (sources?.complete !== true || sources.userId !== scope.userId || sources.travelId !== scope.travelId ||
      !Object.values(sourceLists).every(ids => Array.isArray(ids) && ids.every(isId))) {
    return { status: 'sources-unavailable' };
  }

  const references = { transaction: new Set(), asset: new Set(), wallet: new Set() };
  const conflictedTransactions = new Set();
  const transactionRules = new Map();
  const typed = sources.transactionMetadata !== undefined;
  const asOfDay = sources.asOfDay;
  if (typed && !validDay(asOfDay)) return { status: 'sources-unavailable' };
  let valid = true;
  const add = (type, id, optional = false) => {
    if (optional && (id === undefined || id === '')) return;
    if (!isId(id)) { valid = false; return; }
    // An operation can finance, repay, or support one active attribution only.
    if (type === 'transaction' && references.transaction.has(id)) conflictedTransactions.add(id);
    references[type].add(id);
  };

  const addTyped = (id, currency, role, amount, openingDate) => {
    add('transaction', id);
    if (!typed) return;
    if (typeof currency !== 'string' || !/^[A-Z]{3}$/.test(currency)) { valid = false; return; }
    if (role !== 'position' && (!positiveAmount(amount) || !validDay(openingDate) || openingDate > asOfDay)) {
      valid = false;
      return;
    }
    transactionRules.set(id, { currency, role, amount, openingDate });
  };

  for (const id of Object.keys(settings.walletAccounts)) add('wallet', id);
  for (const debt of settings.debts) {
    add('asset', debt.assetId, true);
    if (debt.originTransactionId !== undefined && debt.originTransactionId !== '') {
      addTyped(debt.originTransactionId, debt.currency, 'funding', debt.openingAmount, debt.openingDate);
    }
    if (!isRecordList(debt.repayments) || (typed && (!validDebtTimeline(debt, asOfDay)
        || debt.repayments.some(r => !positiveAmount(r.principal) || !Number.isSafeInteger(cents(-r.principal)))))) {
      valid = false;
      continue;
    }
    for (const repayment of debt.repayments) addTyped(repayment.transactionId, debt.currency, 'repayment', repayment.principal, debt.openingDate);
  }
  for (const position of settings.positions) {
    if (!Array.isArray(position.transactionIds)) { valid = false; continue; }
    for (const id of position.transactionIds) addTyped(id, position.currency, 'position');
  }
  for (const link of settings.assetLinks) {
    add('asset', link.asset_id);
    add('transaction', link.transaction_id);
    if (typed) transactionRules.set(link.transaction_id, { role: 'purchase', assetId: link.asset_id });
  }
  if (!valid) return { status: 'invalid-active-references' };
  if (conflictedTransactions.size > 0) {
    return { status: 'conflicting-references', conflicts: { transaction: conflictedTransactions.size } };
  }

  const missing = {};
  for (const [type, ids] of Object.entries(sourceLists)) {
    const existing = new Set(ids);
    missing[type] = [...references[type]].filter(id => !existing.has(id)).length;
  }
  if (Object.values(missing).some(count => count > 0)) return { status: 'missing-references', missing };
  if (typed) {
    const rows = sources.transactionMetadata;
    if (!Array.isArray(rows)) return { status: 'sources-unavailable' };
    const byId = new Map(), sourceIds = new Set(sourceLists.transaction);
    for (const row of rows) {
      if (!isRecord(row) || !sourceIds.has(row.id) || byId.has(row.id)
          || typeof row.currency !== 'string' || !/^[A-Za-z]{3}$/.test(row.currency) || !isId(row.type) || !Number.isFinite(row.amount)
          || typeof row.payNow !== 'boolean' || !validDay(row.cashDate)) {
        return { status: 'sources-unavailable' };
      }
      byId.set(row.id, row);
    }
    const assetById = new Map();
    if (settings.assetLinks.length > 0) {
      const assetIds = new Set(sourceLists.asset);
      if (!Array.isArray(sources.assetMetadata)) return { status: 'sources-unavailable' };
      for (const asset of sources.assetMetadata) {
        if (!isRecord(asset) || !assetIds.has(asset.id) || assetById.has(asset.id)
            || typeof asset.currency !== 'string' || !/^[A-Z]{3}$/.test(asset.currency)
            || !Number.isFinite(asset.purchaseValue) || !validDay(asset.purchaseDate)) {
          return { status: 'sources-unavailable' };
        }
        assetById.set(asset.id, asset);
      }
    }
    let incompatible = 0;
    for (const [id, rule] of transactionRules) {
      const row = byId.get(id);
      if (!row || !hasTransferClassification(row)) return { status: 'sources-unavailable' };
      if (internalAccounting(row)) {
        incompatible++;
        continue;
      }
      if (rule.role === 'purchase') {
        const asset = assetById.get(rule.assetId);
        if (!asset) return { status: 'sources-unavailable' };
        if (row.type !== 'expense' || !settledAt(row, asOfDay) || row.currency.toUpperCase() !== asset.currency
            || !positiveAmount(row.amount) || !positiveAmount(asset.purchaseValue)
            || cents(row.amount) !== cents(asset.purchaseValue) || asset.purchaseDate > asOfDay) incompatible++;
        continue;
      }
      if (!settledAt(row, asOfDay) || row.currency.toUpperCase() !== rule.currency || !positiveAmount(row.amount)
          || (row.type !== 'expense' && (rule.role === 'repayment' || row.type !== 'income'))
          || (rule.role === 'funding' && (row.amount !== rule.amount || row.cashDate > rule.openingDate))
          || (rule.role === 'repayment' && (cents(rule.amount) > cents(row.amount) || row.cashDate < rule.openingDate))) incompatible++;
    }
    if (incompatible > 0) return { status: 'incompatible-references', incompatible: { transaction: incompatible } };
    // Do not compute a debt timeline until every linked source is compatible.
    const negative = settings.debts.filter(debt => negativeDebtBalance(debt, byId)).length;
    if (negative > 0) return { status: 'incompatible-references', incompatible: { debt: negative } };
  }
  return { status: 'references-present' };
}

// The scope must come from the active session, never from the input contents.
export function previewAccountingRestore(raw, scope, sources) {
  if (!isId(scope?.userId) || !isId(scope?.travelId)) return { status: 'scope-unavailable' };
  if (typeof raw !== 'string') return { status: 'invalid-json' };
  if (raw.length > MAX_BYTES || new TextEncoder().encode(raw).length > MAX_BYTES) return { status: 'size-limit' };

  let candidate;
  try { candidate = JSON.parse(raw); } catch { return { status: 'invalid-json' }; }
  if (!hasExactFields(candidate, envelopeFields) || !isId(candidate.userId) ||
      !isId(candidate.travelId) || !isTimestamp(candidate.createdAt)) return { status: 'invalid-envelope' };
  if (candidate.version !== 1) return { status: 'unsupported-version' };
  if (candidate.userId !== scope.userId || candidate.travelId !== scope.travelId) return { status: 'scope-mismatch' };
  if (!withinDepth(candidate.settings)) return { status: 'depth-limit' };
  if (!hasExactFields(candidate.settings, Object.keys(settingsChecks)) ||
      !Object.entries(settingsChecks).every(([key, valid]) => valid(candidate.settings[key]))) {
    return { status: 'invalid-settings' };
  }
  const status = sources === undefined ? 'scope-reviewed' : 'references-present';
  if (sources !== undefined) {
    const checked = reviewActiveReferences(candidate.settings, scope, sources);
    if (checked.status !== status) return checked;
  }
  return {
    status, requiresFurtherValidation: true,
    createdAt: candidate.createdAt, families: Object.keys(familyChecks),
  };
}
