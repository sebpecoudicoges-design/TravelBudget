import { describe, expect, it } from 'vitest';
import {
  canAccessAppView,
  canAccessTestCampaign,
  normalizeAppRole,
  resolveAppView,
  roleUiState,
} from '../../src/core/moduleAccessRules.js';

describe('module access rules', () => {
  it('gives admins and testers access to modules and the campaign', () => {
    for (const role of ['admin', 'test', 'TEST']) {
      expect(canAccessAppView('dashboard', role)).toBe(true);
      expect(canAccessAppView('sport', role)).toBe(true);
      expect(canAccessTestCampaign(role)).toBe(true);
    }
  });

  it('opens validated finance modules to standard users and keeps the others frozen', () => {
    expect(normalizeAppRole('member')).toBe('user');
    expect(resolveAppView('dashboard', 'member')).toBe('dashboard');
    expect(resolveAppView('transactions', 'user')).toBe('transactions');
    expect(resolveAppView('subscriptions', 'user')).toBe('subscriptions');
    expect(resolveAppView('analysis', 'user')).toBe('analysis');
    expect(resolveAppView('sport', 'user')).toBe('validation');
    expect(resolveAppView('settings', 'user')).toBe('settings');
    expect(resolveAppView('help', 'user')).toBe('help');
    expect(roleUiState('member')).toMatchObject({ isRestricted: true, canPreviewModules: false });
  });
});
