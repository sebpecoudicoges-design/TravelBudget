import { describe, expect, it } from 'vitest';

import {
  getSettingsCardSummary,
  getSettingsPanelState,
  renderSettingsAccountPanel,
  renderSettingsHero,
  setSettingsPanelState,
} from '../../../src/features/settings/settingsView.js';

describe('Settings view helpers', () => {
  const t = (key, vars = {}) => {
    const dict = {
      'analysis.trip.active': 'Voyage actif',
      'settings.card.account': 'Compte',
      'settings.card.account_summary': `Devise ${vars.base}`,
      'settings.card.travel': 'Voyage',
      'settings.card.travel_summary': `Actif ${vars.name}`,
      'settings.card.periods': 'Periodes',
      'settings.card.periods_summary': `${vars.count} periodes`,
      'settings.card.periods_count': `${vars.count} periodes`,
      'settings.card.recurring': 'Regles',
      'settings.card.recurring_summary': `${vars.count} regles`,
      'settings.card.recurring_count': `${vars.count} regles`,
      'settings.card.palette': 'Palette',
      'settings.card.palette_summary': 'Visuel',
      'settings.card.visual': 'Visuel',
      'settings.card.categories': 'Categories',
      'settings.card.categories_summary': 'Classement',
      'settings.card.classification': 'Classification',
      'settings.hero.title': 'Reglages',
      'settings.hero.body': 'Pilote tes donnees',
    };
    return dict[key] || key;
  };

  const state = {
    activeTravelId: 'travel-1',
    user: { baseCurrency: 'aud' },
    travels: [{ id: 'travel-1', name: 'BudgetTravel' }],
    period: { name: 'Fallback' },
    budgetSegments: [{ id: 'seg-1' }, { id: 'seg-2' }],
    recurringRules: [{ id: 'rule-1' }],
  };

  it('summarizes the main settings cards from app state', () => {
    expect(getSettingsCardSummary({ id: 'tb-account-card', state, t })).toMatchObject({
      kicker: 'Compte',
      summary: 'Devise AUD',
      pills: ['AUD'],
    });
    expect(getSettingsCardSummary({ id: 'tb-travel-card', state, t })).toMatchObject({
      kicker: 'Voyage',
      summary: 'Actif BudgetTravel',
      pills: ['BudgetTravel'],
    });
    expect(getSettingsCardSummary({ id: 'tb-periods-card', state, t }).pills).toEqual(['2 periodes']);
    expect(getSettingsCardSummary({ id: 'tb-recurring-card', state, t }).pills).toEqual(['1 regles']);
  });

  it('renders the settings hero with escaped state values and counters', () => {
    const html = renderSettingsHero({
      state: {
        ...state,
        travels: [{ id: 'travel-1', name: '<BudgetTravel>' }],
      },
      t,
    });

    expect(html).toContain('tb-settings-hero-title');
    expect(html).toContain('Reglages');
    expect(html).toContain('&lt;BudgetTravel&gt;');
    expect(html).toContain('2 periodes');
    expect(html).toContain('1 regles');
  });

  it('renders the account panel with stable inputs and selected preferences', () => {
    const html = renderSettingsAccountPanel({
      baseCurrency: 'aud',
      currencies: ['EUR', 'AUD', 'USD'],
      savedBirthDate: '1997-06-22',
      savedBodyWeight: '59',
      savedBodyHeight: '162',
      thresholdDisplay: '820',
      thresholdEur: 500,
      notificationPrefs: { healthMealReminders: true },
      simpleMode: true,
      t,
    });

    expect(html).toContain('id="tb-account-email"');
    expect(html).toContain('id="tb-account-whatsapp"');
    expect(html).toContain('value="1997-06-22"');
    expect(html).toContain('id="tb-account-body-weight"');
    expect(html).toContain('value="59"');
    expect(html).toContain('id="tb-account-body-height"');
    expect(html).toContain('value="162"');
    expect(html).toContain('<option value="AUD" selected>AUD</option>');
    expect(html).toContain('<option value="simple" selected>');
    expect(html).toContain('id="tb-user-cfthr"');
    expect(html).toContain('value="820"');
    expect(html).toContain('id="tb-notif-health" type="checkbox" checked');
    expect(html).toContain('id="tb-notif-open-manager"');
  });

  it('stores and restores panel open state', () => {
    const map = new Map();
    const storage = {
      getItem: (key) => map.get(key) ?? null,
      setItem: (key, value) => map.set(key, value),
    };

    expect(getSettingsPanelState('tb-travel-card', true, storage)).toBe(true);
    setSettingsPanelState('tb-travel-card', false, storage);
    expect(getSettingsPanelState('tb-travel-card', true, storage)).toBe(false);
    setSettingsPanelState('tb-travel-card', true, storage);
    expect(getSettingsPanelState('tb-travel-card', false, storage)).toBe(true);
  });
});
