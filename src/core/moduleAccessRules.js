export const PRIVILEGED_MODULE_ROLES = Object.freeze(['admin', 'test']);

export const ALWAYS_AVAILABLE_VIEWS = Object.freeze([
  'dashboard',
  'transactions',
  'analysis',
  'validation',
  'settings',
  'help',
]);

export const TEST_CAMPAIGN_VIEW = 'testing';

export function normalizeAppRole(role) {
  const value = String(role || '').trim().toLowerCase();
  if (value === 'admin' || value === 'test') return value;
  return 'user';
}

export function hasModulePreviewAccess(role) {
  return PRIVILEGED_MODULE_ROLES.includes(normalizeAppRole(role));
}

export function canAccessAppView(view, role) {
  const target = String(view || 'dashboard').trim().toLowerCase();
  const normalizedRole = normalizeAppRole(role);
  if (hasModulePreviewAccess(normalizedRole)) return true;
  return ALWAYS_AVAILABLE_VIEWS.includes(target);
}

export function canAccessTestCampaign(role) {
  return hasModulePreviewAccess(role);
}

export function resolveAppView(view, role) {
  const target = String(view || 'dashboard').trim().toLowerCase();
  return canAccessAppView(target, role) ? target : 'validation';
}

export function roleUiState(role) {
  const normalizedRole = normalizeAppRole(role);
  return {
    role: normalizedRole,
    isAdmin: normalizedRole === 'admin',
    isTester: normalizedRole === 'test',
    canPreviewModules: hasModulePreviewAccess(normalizedRole),
    canUseTestCampaign: canAccessTestCampaign(normalizedRole),
    isRestricted: !hasModulePreviewAccess(normalizedRole),
  };
}
