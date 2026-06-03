import { describe, expect, it } from 'vitest';
import { canForceMobileNotification, normalizeNotificationPrefs, notificationPrefKeyForPayload } from '../../src/core/notificationRules.js';

describe('notification rules core', () => {
  it('normalizes mobile notification preferences with safe defaults', () => {
    expect(normalizeNotificationPrefs({ dailyBudget: true, inbox: false })).toMatchObject({
      enabled: true,
      dailyBudget: true,
      inbox: false,
      trip: true,
      lowBudget: true,
      mobilePush: true,
    });
  });

  it('maps push payloads to preference buckets', () => {
    expect(notificationPrefKeyForPayload({ source: 'daily_budget' })).toBe('dailyBudget');
    expect(notificationPrefKeyForPayload({ data: { kind: 'low_budget' } })).toBe('lowBudget');
    expect(notificationPrefKeyForPayload({ view: 'trip' })).toBe('trip');
    expect(notificationPrefKeyForPayload({ source: 'inbox' })).toBe('inbox');
  });

  it('allows forced mobile push only for admin or internal senders', () => {
    expect(canForceMobileNotification({ mode: 'user', isAdmin: false })).toBe(false);
    expect(canForceMobileNotification({ mode: 'user', isAdmin: true })).toBe(true);
    expect(canForceMobileNotification({ mode: 'internal', isAdmin: false })).toBe(true);
  });
});
