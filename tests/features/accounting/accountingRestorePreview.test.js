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
