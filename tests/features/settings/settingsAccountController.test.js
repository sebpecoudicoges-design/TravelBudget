import { describe, expect, it } from 'vitest';

import {
  accountExportFilename,
  bindSettingsAccountPanel,
  collectLocalAccountData,
  formatDeletionStatus,
  isValidWhatsappPhone,
  normalizeWhatsappPhone,
  validateSettingsAccountDraft,
} from '../../../src/features/settings/settingsAccountController.js';

function makeBox(fields = {}) {
  const nodes = new Map(Object.entries(fields));
  return {
    querySelector(selector) {
      if (!nodes.has(selector)) nodes.set(selector, {});
      return nodes.get(selector);
    },
    nodes,
  };
}

describe('Settings account controller', () => {
  it('normalizes and validates international WhatsApp numbers', () => {
    expect(normalizeWhatsappPhone(' +33 6 12.34-56-78 ')).toBe('+33612345678');
    expect(isValidWhatsappPhone('+33612345678')).toBe(true);
    expect(isValidWhatsappPhone('0612345678')).toBe(false);
    expect(isValidWhatsappPhone('')).toBe(true);
  });

  it('validates the whole account form before the first remote write', () => {
    expect(validateSettingsAccountDraft({
      whatsapp: '+33 6 12 34 56 78', birthDate: '1997-06-22', weightKg: '59,2', heightCm: '162',
      baseCurrency: 'aud', uiMode: 'advanced', cashflowThreshold: '820',
    })).toMatchObject({ ok: true, phone: '+33612345678', baseCurrency: 'AUD', weightKg: 59.2 });
    expect(validateSettingsAccountDraft({
      whatsapp: '0612345678', birthDate: '1997-06-22', weightKg: '59', heightCm: '162',
      baseCurrency: 'AUD', uiMode: 'advanced', cashflowThreshold: '820',
    })).toEqual({ ok: false, reason: 'Format WhatsApp invalide.' });
  });

  it('exports only Travel Budget device data and keeps structured values', () => {
    const values = new Map([
      ['travelbudget_cache_v1', '{"pending":2}'],
      ['tb:offline:queue', '[1,2]'],
      ['unrelated-site-key', 'secret'],
    ]);
    const storage = {
      length: values.size,
      key: (index) => [...values.keys()][index],
      getItem: (key) => values.get(key) ?? null,
    };

    expect(collectLocalAccountData(storage)).toEqual({
      travelbudget_cache_v1: { pending: 2 },
      'tb:offline:queue': [1, 2],
    });
    expect(accountExportFilename(new Date('2026-07-26T01:02:03Z')))
      .toBe('travelbudget-account-export-2026-07-26.json');
  });

  it('formats pending and terminal deletion states', () => {
    expect(formatDeletionStatus({ status: 'pending', execute_after: '2026-08-02T00:00:00Z' }, 'fr-FR'))
      .toContain('02/08/2026');
    expect(formatDeletionStatus({ status: 'cancelled' })).toBe('Demande annulée.');
    expect(formatDeletionStatus({ status: 'processing' })).toBe('Suppression en cours.');
  });

  it('binds account actions while preserving injected side effects', async () => {
    const calls = [];
    const storage = new Map();
    const box = makeBox({
      '#tb-account-email': { value: '' },
      '#tb-account-whatsapp': { value: '+33 6 12 34 56 78' },
      '#tb-account-birthdate': { value: '1997-06-22' },
      '#tb-account-body-weight': { value: '59' },
      '#tb-account-body-height': { value: '162' },
      '#tb-user-basecur': { value: 'AUD' },
      '#tb-user-uimode': { value: 'advanced' },
      '#tb-user-whatsapp-save': {},
      '#tb-user-birthdate-save': {},
      '#tb-user-basecur-save': {},
      '#tb-user-uimode-save': {},
      '#tb-user-account-save': {},
      '#tb-user-cfthr': { value: '820' },
      '#tb-user-cfthr-save': {},
    });
    const sb = {
      auth: { getUser: async () => ({ data: { user: { id: 'user-1', email: 'seb@example.com' } } }) },
      from(table) {
        return {
          select() { return this; },
          eq() { return this; },
          maybeSingle: async () => ({ data: table === 'profiles' ? { whatsapp_phone_e164: '+33111111111' } : null, error: null }),
          update(payload) { calls.push(['update', table, payload]); return this; },
          upsert(payload) { calls.push(['upsert', table, payload]); return Promise.resolve({ error: null }); },
        };
      },
    };

    bindSettingsAccountPanel({
      box,
      state: { user: {} },
      constants: {
        TABLES: { profiles: 'profiles', settings: 'settings' },
        LS_KEYS: { cashflow_threshold_eur: 'threshold-eur' },
      },
      currency: 'AUD',
      safeCall: async (_label, fn) => fn(),
      getSupabase: () => sb,
      isOffline: () => false,
      localStorageRef: {
        getItem: (key) => storage.get(key) ?? null,
        setItem: (key, value) => storage.set(key, value),
        removeItem: (key) => storage.delete(key),
      },
      windowRef: {
        safeFxConvert: (value, from, to) => (from === 'AUD' && to === 'EUR' ? value / 2 : value),
        tbNormalizeUiMode: (value) => value,
        tbApplyUiModeToDocument: () => calls.push(['mode-applied']),
      },
      navigatorRef: { onLine: true },
      requestRenderAll: (reason) => calls.push(['render', reason]),
      alertFn: (message) => calls.push(['alert', message]),
      consoleRef: { warn: () => {} },
    });

    await box.querySelector('#tb-user-account-save').onclick();

    expect(calls).toContainEqual(['update', 'profiles', { whatsapp_phone_e164: '+33612345678' }]);
    expect(storage.get('threshold-eur')).toBe('410');
    expect(calls).toContainEqual(['render', 'settings:account_all']);
    expect(calls).toContainEqual(['alert', 'Compte et préférences enregistrés.']);
  });
});
