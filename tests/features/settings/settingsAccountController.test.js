import { describe, expect, it } from 'vitest';

import {
  bindSettingsAccountPanel,
  buildSettingsNotificationPrefs,
  isValidWhatsappPhone,
  normalizeWhatsappPhone,
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

  it('builds notification preferences from stable account hooks', () => {
    const box = makeBox({ '#tb-notif-health': { checked: true } });
    const prefs = buildSettingsNotificationPrefs({
      box,
      notificationPrefs: { inbox: false, trip: true, emojis: false },
      timezone: 'Australia/Brisbane',
    });

    expect(prefs).toMatchObject({
      inbox: false,
      trip: true,
      emojis: false,
      localDevice: true,
      dailyBudget: true,
      healthMealReminders: true,
      timezone: 'Australia/Brisbane',
    });
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
      '#tb-user-whatsapp-save': {},
      '#tb-user-cfthr': { value: '820' },
      '#tb-user-cfthr-save': {},
      '#tb-notif-health': { checked: false },
      '#tb-notif-save': {},
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
      notificationPrefs: {},
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
        tbSaveNotificationPrefs: async (prefs) => calls.push(['notif', prefs]),
      },
      navigatorRef: { onLine: true },
      requestRenderAll: (reason) => calls.push(['render', reason]),
      alertFn: (message) => calls.push(['alert', message]),
      consoleRef: { warn: () => {} },
    });

    await box.querySelector('#tb-user-whatsapp-save').onclick();
    await box.querySelector('#tb-user-cfthr-save').onclick();
    await box.querySelector('#tb-notif-save').onclick();

    expect(calls).toContainEqual(['update', 'profiles', { whatsapp_phone_e164: '+33612345678' }]);
    expect(storage.get('threshold-eur')).toBe('410');
    expect(calls.some((call) => call[0] === 'notif' && call[1].dailyBudget === true)).toBe(true);
  });
});
