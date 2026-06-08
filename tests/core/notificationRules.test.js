import { describe, expect, it } from 'vitest';
import { canForceMobileNotification, normalizeNotificationPrefs, notificationPrefKeyForPayload, selectBudgetNotificationVariant } from '../../src/core/notificationRules.js';

describe('notification rules core', () => {
  it('normalizes mobile notification preferences with safe defaults', () => {
    expect(normalizeNotificationPrefs({ dailyBudget: true, inbox: false })).toMatchObject({
      enabled: true,
      dailyBudget: true,
      morningBudget: true,
      eveningSummary: false,
      serverPush: true,
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

  it('selects varied daily budget notification variants', () => {
    expect(selectBudgetNotificationVariant({ remainingToday: -5, delta: 20, pct: 12 }).tone).toBe('over_today');
    expect(selectBudgetNotificationVariant({ remainingToday: 30, delta: -23.4, pct: -21 }).tone).toBe('ahead');
    expect(selectBudgetNotificationVariant({ remainingToday: 30, delta: 23.4, pct: 21 }).tone).toBe('above_trend');
    expect(selectBudgetNotificationVariant({ remainingToday: 30, delta: 0, pct: 0 }).tone).toBe('steady');
  });
});
