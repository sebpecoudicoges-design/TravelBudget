import { describe, expect, it } from 'vitest';

import {
  getSettingsCardSummary,
  getSettingsPanelState,
  getBudgetSegmentDeleteReadiness,
  normalizeManualFxRates,
  renderCreatePeriodModalBody,
  renderCreateVoyageModalBody,
  renderSettingsAccountPanel,
  renderSettingsHero,
  renderSettingsManualFxPanel,
  renderSettingsPeriodCard,
  renderSettingsPeriodReference,
  renderSettingsTravelOverview,
  setSettingsPanelState,
} from '../../../src/features/settings/settingsView.js';
import {
  renderGuidedCategoryModalBody,
  renderGuidedSubcategoryModalBody,
  renderSettingsCategoriesList,
  notifySettingsValidation,
  validateCategoryDraft,
  validateSubcategoryDraft,
} from '../../../src/features/settings/settingsCategoriesView.js';

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
      'settings.fx.title': 'Taux perso',
      'settings.fx.subtitle': 'Change manuel',
      'settings.fx.add_title': 'Ajouter un taux',
      'settings.fx.add': 'Ajouter',
      'settings.fx.currency': 'Devise',
      'settings.fx.rate': 'Taux',
      'settings.fx.date': 'Date',
      'settings.fx.status': 'Statut',
      'settings.fx.actions': 'Actions',
      'settings.fx.update_needed': 'A revoir',
      'settings.fx.edit': 'Modifier',
      'settings.fx.delete': 'Supprimer',
      'settings.fx.empty': 'Aucun taux perso',
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

  it('renders create voyage and period modal bodies with stable fields', () => {
    const voyageHtml = renderCreateVoyageModalBody({
      start: '2026-07-18',
      end: '2026-08-17',
    });
    expect(voyageHtml).toContain('id="tb-vstart"');
    expect(voyageHtml).toContain('value="2026-07-18"');
    expect(voyageHtml).toContain('id="tb-vend"');
    expect(voyageHtml).toContain('value="2026-08-17"');
    expect(voyageHtml).toContain('non chevauchant');

    const periodHtml = renderCreatePeriodModalBody({
      start: '2026-07-01',
      end: '2026-07-31',
      currency: '<aud>',
      dailyBudget: '<85>',
    });
    expect(periodHtml).toContain('id="tb-pstart"');
    expect(periodHtml).toContain('min="2026-07-01"');
    expect(periodHtml).toContain('max="2026-07-31"');
    expect(periodHtml).toContain('id="tb-pcur"');
    expect(periodHtml).toContain('value="&lt;AUD&gt;"');
    expect(periodHtml).toContain('id="tb-pbud"');
    expect(periodHtml).toContain('value="&lt;85&gt;"');
    expect(periodHtml).toContain('split automatique');
  });

  it('checks budget segment deletion readiness before legacy safeCall', () => {
    expect(getBudgetSegmentDeleteReadiness({
      segments: [{ id: 'seg-1' }],
      segmentId: 'seg-1',
    })).toEqual({ ok: false, reason: 'Impossible: au moins 1 période requise.' });

    expect(getBudgetSegmentDeleteReadiness({
      segments: [{ id: 'seg-1' }, { id: 'seg-2' }],
      segmentId: 'missing',
    })).toEqual({ ok: false, reason: 'Période introuvable.' });

    expect(getBudgetSegmentDeleteReadiness({
      segments: [{ id: 'seg-1' }, { id: 'seg-2' }],
      segmentId: 'seg-2',
    })).toEqual({ ok: true, reason: '' });
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

  it('normalizes manual FX rates for rendering', () => {
    const list = normalizeManualFxRates({
      manualRates: {
        usd: { rate: 1.23456789, asOf: '2026-07-10T12:00:00Z' },
        EUR: { rate: 1, asOf: '2026-07-10' },
        lak: { rate: 24000, asOf: '2026-07-09' },
        bad: { rate: 0, asOf: '2026-07-09' },
      },
      manualFxMeta: (currency) => ({ stale: currency === 'USD' }),
    });

    expect(list).toEqual([
      { c: 'LAK', rate: 24000, asOf: '2026-07-09', stale: false },
      { c: 'USD', rate: 1.23456789, asOf: '2026-07-10', stale: true },
    ]);
  });

  it('renders manual FX panel with badges and stable actions', () => {
    const html = renderSettingsManualFxPanel({
      manualList: [
        { c: 'USD', rate: 1.23456789, asOf: '2026-07-10', stale: true },
        { c: 'AUD', rate: 1.78, asOf: '2026-07-09', stale: false },
      ],
      t,
    });

    expect(html).toContain('data-act="mf-toggle"');
    expect(html).toContain('data-manual-fx-list');
    expect(html).toContain('data-manual-fx-arrow');
    expect(html).toContain('data-act="mf-add"');
    expect(html).toContain('data-act="mf-edit" data-cur="USD"');
    expect(html).toContain('data-act="mf-del" data-cur="AUD"');
    expect(html).toContain('1.234568');
    expect(html).toContain('A revoir');
  });

  it('renders the manual FX empty state', () => {
    const html = renderSettingsManualFxPanel({ manualList: [], t });

    expect(html).toContain('Aucun taux perso');
    expect(html).toContain('tb-fx-ok-badge');
  });

  it('renders category and subcategory settings with stable actions', () => {
    const html = renderSettingsCategoriesList({
      categories: ['Food'],
      colors: { Food: '#22c55e' },
      simpleMode: true,
      getSubRows: () => [
        { id: 'sub-1', name: 'Restaurant', color: '#f97316', isActive: true, source: 'sql' },
        { name: '<Detected>', isActive: false, source: 'fallback' },
      ],
      getMapping: (_category, subcategory) => subcategory
        ? { explicit: true, mappingStatus: 'mapped', analyticFamily: 'food', sourceLabel: 'Manuel' }
        : { mappingStatus: 'excluded', sourceLabel: 'Catégorie' },
      getUsage: (_category, subcategory) => ({ txCount: subcategory ? 2 : 5 }),
      analyticSelectOptions: (value) => `<option selected>${value}</option>`,
      analyticStatusPillHtml: (mapping) => `<span data-status>${mapping.mappingStatus}</span>`,
      analyticUsagePillHtml: (count) => `<span data-usage>${count}</span>`,
      analyticFamilyLabel: () => 'Alimentation',
    });

    expect(html).toContain('tb-simple-mode-note');
    expect(html).toContain('tb-category-card');
    expect(html).toContain('Food');
    expect(html).toContain('2 sous-catégories');
    expect(html).toContain('5 transactions');
    expect(html).toContain('tb-subcat-row');
    expect(html).toContain('Restaurant');
    expect(html).toContain('&lt;Detected&gt;');
    expect(html).toContain("saveAnalyticCategoryMapping('Food',this.value)");
    expect(html).toContain("saveAnalyticSubcategoryMapping('Food','Restaurant',this.value)");
    expect(html).toContain("moveSubcategory('sub-1','up')");
    expect(html).toContain("importExistingSubcategory('Food','&lt;Detected&gt;')");
  });

  it('renders guided category and subcategory modal bodies', () => {
    const categoryHtml = renderGuidedCategoryModalBody({
      name: '<Santé>',
      color: '#ef4444',
      mapping: 'food',
      analyticSelectOptions: (value, inherit) => `<option data-inherit="${inherit}">${value}</option>`,
    });
    expect(categoryHtml).toContain('tb-cat-create-name');
    expect(categoryHtml).toContain('&lt;Santé&gt;');
    expect(categoryHtml).toContain('value="#ef4444"');
    expect(categoryHtml).toContain('<option data-inherit="false">food</option>');

    const subcategoryHtml = renderGuidedSubcategoryModalBody({
      category: 'Food',
      name: 'Visa',
      color: '#94a3b8',
      mapping: '__inherit__',
      analyticSelectOptions: (value, inherit) => `<option data-inherit="${inherit}">${value}</option>`,
    });
    expect(subcategoryHtml).toContain('tb-subcat-create-name');
    expect(subcategoryHtml).toContain('value="Food" disabled');
    expect(subcategoryHtml).toContain('value="Visa"');
    expect(subcategoryHtml).toContain('<option data-inherit="true">__inherit__</option>');
  });

  it('validates subcategory drafts before legacy writes', () => {
    const rows = [
      { id: 'sub-1', name: 'Restaurant' },
      { name: 'Detected' },
    ];

    expect(validateSubcategoryDraft({ category: '', name: 'Visa' })).toMatchObject({
      ok: false,
      reason: 'Sous-catégorie invalide.',
    });
    expect(validateSubcategoryDraft({ category: 'Food', name: 'Visa', color: 'blue' })).toMatchObject({
      ok: false,
      reason: 'Couleur invalide.',
    });
    expect(validateSubcategoryDraft({ category: 'Food', name: 'Restaurant', rows })).toMatchObject({
      ok: false,
      reason: 'Cette sous-catégorie existe déjà pour cette catégorie.',
    });
    expect(validateSubcategoryDraft({ category: 'Food', name: 'Restaurant', rows, sqlOnly: true })).toMatchObject({
      ok: false,
      reason: 'Cette sous-catégorie existe déjà en SQL pour cette catégorie.',
    });
    expect(validateSubcategoryDraft({ category: 'Food', name: 'Detected', rows, sqlOnly: true })).toMatchObject({
      ok: true,
      name: 'Detected',
    });
    expect(validateSubcategoryDraft({ category: 'Food', name: 'restaurant', rows, currentId: 'sub-1' })).toMatchObject({
      ok: true,
      name: 'restaurant',
    });
  });

  it('validates category drafts before legacy writes', () => {
    expect(validateCategoryDraft({ name: '' })).toEqual({
      ok: false,
      reason: 'Nom de catégorie vide.',
    });
    expect(validateCategoryDraft({ name: 'Food', color: 'blue' })).toEqual({
      ok: false,
      reason: 'Couleur invalide.',
    });
    expect(validateCategoryDraft({ name: '  Food  ', color: '' })).toEqual({
      ok: true,
      reason: '',
      name: 'Food',
      color: '#94a3b8',
    });
    expect(validateCategoryDraft({ name: 'Food', color: '#22c55e' })).toEqual({
      ok: true,
      reason: '',
      name: 'Food',
      color: '#22c55e',
    });
  });

  it('notifies Settings validation with the best available channel', () => {
    const calls = [];

    expect(notifySettingsValidation({
      message: ' Couleur invalide. ',
      toastWarn: (message) => calls.push(['warn', message]),
      toastInfo: (message) => calls.push(['info', message]),
      alertFn: (message) => calls.push(['alert', message]),
    })).toEqual({ ok: true, method: 'toastWarn', message: 'Couleur invalide.' });
    expect(calls).toEqual([['warn', 'Couleur invalide.']]);

    calls.length = 0;
    expect(notifySettingsValidation({
      message: '',
      toastInfo: (message) => calls.push(['info', message]),
    })).toEqual({ ok: true, method: 'toastInfo', message: 'Valeur invalide.' });
    expect(calls).toEqual([['info', 'Valeur invalide.']]);

    expect(notifySettingsValidation({ message: 'Nom vide' })).toEqual({
      ok: false,
      method: 'none',
      message: 'Nom vide',
    });
  });

  it('renders a period card with stable fields and actions', () => {
    const html = renderSettingsPeriodCard({
      segment: {
        id: 'seg-1',
        start: '2026-07-01',
        end: '2026-07-07',
        dailyBudgetBase: 85,
      },
      currency: 'aud',
      durationDays: 7,
      countryLabel: 'Australie',
      localAmountMain: '85 AUD',
      rateDisplay: '1.78',
      nightTransportBudget: '20 AUD',
      fxNeedsUpdate: true,
      override: { travel_profile: 'couple', travel_style: 'comfort', adult_count: 2, child_count: 1 },
      resolvedCountry: { country_code: 'AU', region_code: 'QLD' },
      countryOptionsHtml: '<option value="AU" selected>Australie</option>',
      helpHtml: '<span data-help>?</span>',
      t,
    });

    expect(html).toContain('data-act="toggle-period"');
    expect(html).toContain('Modifier la période');
    expect(html).toContain('Période 2026-07-01 → 2026-07-07');
    expect(html).toContain('7 jours');
    expect(html).toContain('Australie · AUD · 85 AUD');
    expect(html).toContain('data-br-inline-seg-id="seg-1"');
    expect(html).toContain('data-k="start_date" value="2026-07-01"');
    expect(html).toContain('data-k="daily_budget_base" value="85"');
    expect(html).toContain('data-br="seg-mode"');
    expect(html).toContain('<option value="custom" selected>');
    expect(html).toContain('data-br="seg-country"');
    expect(html).toContain('data-act="save"');
    expect(html).toContain('data-act="del"');
  });

  it('renders a period card in inherited English mode', () => {
    const html = renderSettingsPeriodCard({
      segment: { id: 'seg-2', start: '2026-08-01', end: '2026-08-02', dailyBudgetBase: 100 },
      currency: 'usd',
      durationDays: 2,
      countryLabel: 'United States',
      localAmountMain: '100 USD',
      rateDisplay: '—',
      nightTransportBudget: '0 USD',
      override: null,
      resolvedCountry: { country_code: 'US', region_code: '' },
      lang: 'en',
      t,
    });

    expect(html).toContain('Period 2026-08-01 → 2026-08-02');
    expect(html).toContain('2 days');
    expect(html).toContain('<option value="inherit" selected>');
    expect(html).toContain('display:none;');
    expect(html).toContain('Save');
    expect(html).toContain('Delete');
  });

  it('renders a period reference summary with posts and edit actions', () => {
    const html = renderSettingsPeriodReference({
      sourceLabel: 'Réglage propre à cette période',
      inherited: false,
      countryName: 'Australie',
      countryCode: 'AU',
      profile: 'solo',
      style: 'standard',
      recommendedMain: '92 AUD',
      recommendedSecondary: '55 EUR',
      plannedMain: '85 AUD',
      plannedSecondary: '51 EUR',
      modeText: 'Personnalise',
      plannedDiff: "-4.00 EUR d'ecart",
      posts: [
        { label: 'Logement', amount: '45.00 AUD' },
        { label: 'Repas', amount: '20.00 AUD' },
      ],
      t,
    });

    expect(html).toContain('tb-period-compare');
    expect(html).toContain('Référence de la période');
    expect(html).toContain('Réglage propre à cette période');
    expect(html).toContain('Australie');
    expect(html).toContain('92 AUD');
    expect(html).toContain('55 EUR · base');
    expect(html).toContain('Logement');
    expect(html).toContain('45.00 AUD');
    expect(html).toContain('data-act="edit-seg"');
    expect(html).toContain('data-br-act="seg-reset"');
    expect(html).toContain('display:;');
  });

  it('renders an inherited English period reference with hidden reset', () => {
    const html = renderSettingsPeriodReference({
      sourceLabel: 'Inherited',
      inherited: true,
      countryCode: 'US',
      recommendedMain: '100 USD',
      plannedMain: '90 USD',
      modeText: 'Inherited',
      plannedDiff: '-10.00 USD gap',
      lang: 'en',
      t,
    });

    expect(html).toContain('Period reference');
    expect(html).toContain('Country');
    expect(html).toContain('Planned / day');
    expect(html).toContain('Edit');
    expect(html).toContain('Inherit');
    expect(html).toContain('display:none;');
    expect(html).toContain('tb-settings-pill--positive');
  });

  it('renders the travel overview with editable trip fields and reference posts', () => {
    const html = renderSettingsTravelOverview({
      travelName: '<BudgetTravel>',
      segmentCount: 2,
      totalDays: 14,
      baseCurrency: 'aud',
      budgetMain: '85 AUD',
      budgetSecondary: '51 EUR',
      referenceMain: 'Australie',
      referenceSub: 'solo · standard',
      recommendationMain: '92 AUD',
      recommendationSecondary: '55 EUR',
      cadenceMain: 'Sous la reco',
      cadenceSub: "4.00 AUD d'ecart",
      startISO: '2026-07-01',
      endISO: '2026-07-14',
      countryOptionsHtml: '<option value="AU" selected>Australie</option>',
      profile: 'solo',
      style: 'standard',
      adults: 1,
      children: 0,
      posts: [{ label: 'Repas', amount: '25 AUD' }],
    });

    expect(html).toContain('&lt;BudgetTravel&gt;');
    expect(html).toContain('2 périodes');
    expect(html).toContain('14 jours');
    expect(html).toContain('Base · AUD');
    expect(html).toContain('id="tb-inline-travel-select"');
    expect(html).toContain('id="tb-inline-travel-name"');
    expect(html).toContain('data-br="travel-country"');
    expect(html).toContain('<option value="AU" selected>Australie</option>');
    expect(html).toContain('Repas');
    expect(html).toContain('25 AUD');
    expect(html).toContain('id="tb-inline-save-travel"');
  });
});
