// Internal prototype. The result is not a restore authorization and carries no settings.
const MAX_BYTES = 500_000;
const MAX_DEPTH = 16;
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
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

// The scope must come from the active session, never from the input contents.
export function previewAccountingRestore(raw, scope) {
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
  return {
    status: 'scope-reviewed', requiresFurtherValidation: true,
    createdAt: candidate.createdAt, families: Object.keys(familyChecks),
  };
}
