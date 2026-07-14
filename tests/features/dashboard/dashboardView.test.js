import { describe, expect, it } from 'vitest';

import {
  renderDashboardContextHelp,
  renderDashboardOnboardingPanel,
  renderWalletEmptyState,
  renderWalletQuickOnboarding,
} from '../../../src/features/dashboard/dashboardView.js';

describe('Dashboard view helpers', () => {
  const t = (key, vars = {}) => {
    const dict = {
      'onboarding.subtitle': 'Base a configurer',
      'onboarding.progress': `${vars.done}/${vars.total}`,
      'onboarding.action.guide': 'Guide',
      'onboarding.hide': 'Masquer',
      'onboarding.tip': 'Clique sur aide',
    };
    return dict[key] || key;
  };

  it('renders the onboarding checklist with stable dashboard actions', () => {
    const html = renderDashboardOnboardingPanel({
      rows: [
        { ok: true, text: 'Période OK', action: "showView('settings')", label: 'Regler' },
        { ok: false, text: 'Créer wallet', action: 'createWallet()', label: 'Wallet' },
      ],
      done: 1,
      total: 2,
      t,
    });

    expect(html).toContain('Base a configurer');
    expect(html).toContain('1/2');
    expect(html).toContain('tbStartGuidedTour');
    expect(html).toContain('hideOnboardingPanel()');
    expect(html).toContain('Période OK');
    expect(html).toContain('Créer wallet');
    expect(html).toContain('onclick="createWallet()"');
    expect(html).toContain('Wallet');
  });

  it('renders dashboard contextual help with stable navigation actions', () => {
    const html = renderDashboardContextHelp({ t });

    expect(html).toContain('dashboard.help.title');
    expect(html).toContain("showView('help')");
    expect(html).toContain("showView('trip')");
    expect(html).toContain('data-tb-help-close="dashboard_overview"');
  });

  it('renders wallet empty and quick onboarding states outside the legacy file', () => {
    const html = [
      renderWalletEmptyState({ t }),
      renderWalletQuickOnboarding({ t }),
    ].join('\n');

    expect(html).toContain('wallet.empty.title');
    expect(html).toContain('wallet.empty.body');
    expect(html).toContain("showView('settings')");
    expect(html).toContain("showView('help')");
    expect(html).toContain('onboarding.step.wallet');
    expect(html).toContain('onboarding.step.period');
    expect(html).toContain('onboarding.step.tx');
  });
});
