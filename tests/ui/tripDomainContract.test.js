import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Trip domain contract', () => {
  const bridge = fs.readFileSync('src/app/bridge.js', 'utf8');
  const legacy = fs.readFileSync('public/legacy/js/29_trip_v1.js', 'utf8');
  const rules = fs.readFileSync('src/core/tripRules.js', 'utf8');
  const repository = fs.readFileSync('src/data/tripRepository.js', 'utf8');
  const store = fs.readFileSync('src/features/trip/tripStore.js', 'utf8');
  const view = fs.readFileSync('src/features/trip/tripView.js', 'utf8');
  const documentView = fs.readFileSync('public/legacy/js/29_trip_document_view.js', 'utf8');
  const main = fs.readFileSync('src/main.js', 'utf8');

  it('exposes Trip rules, repository, store and view through the bridge', () => {
    expect(bridge).toContain("import * as tripRules from '../core/tripRules.js'");
    expect(bridge).toContain("import { createTripRepository } from '../data/tripRepository.js'");
    expect(bridge).toContain("import { createTripStore } from '../features/trip/tripStore.js'");
    expect(bridge).toContain("import * as tripView from '../features/trip/tripView.js'");
    expect(bridge).toContain('window.Core.tripRules = tripRules');
    expect(bridge).toContain('window.Data.tripRepository');
    expect(bridge).toContain('window.Data.createTripStore');
    expect(bridge).toContain('window.UI.tripView = tripView');
  });

  it('keeps mutation and budget rules in the core module', () => {
    const delegatedRules = [
      'normalizeTripExpenseInput',
      'computeTripSplitParts',
      'validateTripExpenseMutation',
      'buildTripExpenseRpcPayload',
      'buildTripTransactionRpcPayload',
      'decideTripExpenseBudgetFlow',
      'linkedTripPaymentBudgetPatch',
      'computeTripAnalysis',
      'matchesTripHistoryFilter',
      'canUseTripWalletForExpense',
    ];
    for (const token of delegatedRules) {
      expect(rules).toContain(`export function ${token}`);
    }
    for (const token of delegatedRules) {
      expect(
        legacy.includes(`tripRules.${token}`)
        || legacy.includes(`tripRules?.${token}`)
        || legacy.includes(`core.${token}`),
      ).toBe(true);
    }
  });

  it('centralizes Supabase reads and writes in the Trip repository', () => {
    for (const token of [
      'loadActiveTripData',
      'createTrip',
      'deleteTrip',
      'addMember',
      'renameMember',
      'deleteMember',
      'applyExpense',
      'linkExpenseTransaction',
      'unlinkExpenseTransaction',
      'deleteExpenseFallback',
    ]) {
      expect(repository).toContain(`async ${token}`);
    }
    expect(legacy).toContain('function _tripRepository()');
    expect(legacy).toContain('_tripRepository().loadActiveTripData');
    expect(legacy).toContain('_tripRepository().applyExpense');
    expect(legacy).toContain('_tripRepository().deleteExpenseFallback');
  });

  it('uses the Trip store as the bridge between remote/offline data and legacy app state', () => {
    for (const token of ['createInitialTripState', 'createTripStore', 'hydrateOffline', 'hydrateRemote', 'appSnapshot', 'resolveActiveTripId', 'setActiveTripId', 'readTab', 'setTab']) {
      expect(store).toContain(token);
    }
    expect(legacy).toContain('const tripStore = window.Data?.createTripStore?.()');
    expect(legacy).toContain('tripStore.resolveActiveTripId');
    expect(legacy).toContain('tripStore.setActiveTripId');
    expect(legacy).toContain('tripStore.readTab');
    expect(legacy).toContain('tripStore.setTab');
    expect(legacy).toContain('tripStore.hydrateOffline(state)');
    expect(legacy).toContain('tripStore.hydrateRemote(activeData');
    expect(legacy).toContain('tripStore.appSnapshot()');
  });

  it('delegates the extracted Trip view surfaces to src/features/trip', () => {
    for (const token of ['renderPendingTripInvites', 'renderTripExpenseForm', 'renderTripContextHelp', 'renderTripLinkAuditCard', 'renderTripTabs', 'renderTripSplitParticipants']) {
      expect(view).toContain(`export function ${token}`);
      expect(legacy).toContain(`tripView?.${token}`);
    }
    expect(documentView).toContain('function renderTripExpenseDocumentsContent');
    expect(documentView).toContain('window.UI.tripDocumentView');
    expect(main).toContain("'/legacy/js/29_trip_document_view.js'");
    expect(legacy).toContain('tripDocumentView?.renderTripExpenseDocumentsContent');
    expect(legacy).toContain('data-trip-help-open');
    expect(legacy).not.toContain('onclick="showView(\'help\')"');
    expect(legacy).not.toContain('class="card" style="margin-top:12px;border-color:rgba(245,158,11,.35);background:rgba(245,158,11,.08);"');
    expect(legacy).not.toContain('const linkedHTML = links.length');
    expect(legacy).not.toContain('Ajouter ou lier un document');
    expect(legacy).not.toContain('<div class="trip-tabs">\\n            <button class="btn primary" id="trip-tab-recap"');
    expect(legacy).not.toContain('En mode égal, le total est réparti seulement entre les participants cochés');
  });
});
