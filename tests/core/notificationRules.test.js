import { describe, expect, it } from 'vitest';
import { canForceMobileNotification, composeDailyBudgetNotification, normalizeNotificationPrefs, notificationPrefKeyForPayload, selectActivityNudge, selectBudgetNotificationVariant } from '../../src/core/notificationRules.js';

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
      emojis: true,
      motivationalTone: true,
      sportReminder: true,
      workReminder: true,
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

  it('adds contextual activity nudges without forcing spam', () => {
    expect(selectActivityNudge({ slot: 'morning', activity: { sportCount: 0 }, prefs: { sportReminder: true } })?.fr).toContain('15 min');
    expect(selectActivityNudge({ slot: 'morning', activity: { sportCount: 1 }, prefs: { sportReminder: true } })).toBe(null);
    expect(selectActivityNudge({ slot: 'evening', activity: { workKcal: 1200, workMinutes: 480 }, prefs: { workReminder: true } })?.fr).toContain('Travail note');
  });

  it('composes a user-facing daily notification with optional emojis', () => {
    const msg = composeDailyBudgetNotification({
      slot: 'morning',
      remainingToday: 12,
      daily: 25,
      spentToday: 13,
      currency: 'AUD',
      activity: { sportCount: 0 },
      prefs: { emojis: false, sportReminder: true },
    });
    expect(msg.titleFr).toBe('Budget du matin');
    expect(msg.bodyFr).toContain('12 AUD');
    expect(msg.bodyFr).toContain('13 AUD / 25 AUD');
    expect(msg.bodyFr).toContain('ping-pong');
  });
});
