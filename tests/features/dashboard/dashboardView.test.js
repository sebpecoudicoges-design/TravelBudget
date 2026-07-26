import { describe, expect, it } from 'vitest';

import {
  renderDashboardOnboardingPanel,
  renderDailyBudgetControls,
  renderDailyBudgetDay,
  getWalletDialogStyles,
  prepareWalletRecentTransactions,
  renderWalletActions,
  renderWalletCard,
  renderWalletCreateDialog,
  renderWalletEditDialog,
  renderWalletEmptyState,
  renderWalletRecentTransactions,
  renderWalletQuickOnboarding,
  renderWalletTypesFixDialog,
  walletRecentTxTouchesWallet,
} from '../../../src/features/dashboard/dashboardView.js';
import {
  addDashboardDays,
  clampDashboardISO,
  loadDailyBudgetView,
  saveDailyBudgetView,
} from '../../../src/features/dashboard/dashboardDailyBudgetState.js';

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

  it('renders wallet dashboard actions with archive and type-fix actions', () => {
    const html = renderWalletActions({
      showArchivedWallets: true,
      missingTypeCount: 2,
      t,
    });
    const compact = renderWalletActions({ showArchivedWallets: false, missingTypeCount: 0, t });

    expect(html).toContain('onclick="createWallet()"');
    expect(html).toContain('openInternalTransferModal()');
    expect(html).toContain('transactions.action.internal_transfer');
    expect(html).toContain('toggleArchivedWallets()');
    expect(html).toContain('wallet.action.hide_archived');
    expect(html).toContain('openWalletTypesFix()');
    expect(html).toContain('Corriger types (2)');
    expect(compact).toContain('wallet.action.show_archived');
    expect(compact).not.toContain('openWalletTypesFix()');
  });

  it('exposes wallet dialog styles outside the legacy file', () => {
    const css = getWalletDialogStyles();

    expect(css).toContain('.tb-dlg-backdrop');
    expect(css).toContain('.tb-dlg-btn.primary');
    expect(css).toContain('var(--panel)');
    expect(css).toContain('var(--bad)');
  });

  it('renders a base wallet card with budget, recent rows and stable actions', () => {
    const html = renderWalletCard({
      wallet: { id: 'wallet-1', name: 'Banque', currency: 'AUD' },
      isBase: true,
      today: '2026-07-14',
      budgetToday: 42.5,
      baseCurrency: 'AUD',
      balance: '100.00 AUD',
      recentHtml: '<div data-recent-row>Lunch</div>',
      barPct: 63,
      t,
    });

    expect(html).toContain('Banque (AUD)');
    expect(html).toContain('100.00 AUD');
    expect(html).toContain('42.50 AUD');
    expect(html).toContain('width:63%;');
    expect(html).toContain('<div data-recent-row>Lunch</div>');
    expect(html).toContain("openTxModal('expense','wallet-1')");
    expect(html).toContain("openTxModal('income','wallet-1')");
    expect(html).toContain("adjustWalletBalance('wallet-1')");
    expect(html).toContain('data-wallet-archive-action="archive"');
  });

  it('renders an archived wallet without transaction or adjustment actions', () => {
    const html = renderWalletCard({
      wallet: { id: 'archived-1', name: 'Ancien cash', currency: 'EUR' },
      archived: true,
      balance: '0.00 EUR',
      t,
    });

    expect(html).toContain('wallet.archived');
    expect(html).toContain('data-wallet-archive-action="unarchive"');
    expect(html).not.toContain("openTxModal('expense'");
    expect(html).not.toContain("openTxModal('income'");
    expect(html).not.toContain('adjustWalletBalance');
  });

  it('renders wallet recent transactions with status and overdraft warning', () => {
    const html = renderWalletRecentTransactions({
      rows: [
        {
          date: '2026-07-15',
          isFutureSoon: true,
          isPaid: false,
          projectedNegative: true,
          tx: { type: 'expense', label: 'Amasym', amount: 25, currency: 'AUD' },
        },
        {
          date: '2026-07-13',
          isFutureSoon: false,
          isPaid: true,
          tx: { type: 'income', label: 'Remboursement', amount: 12, currency: 'AUD' },
        },
      ],
      t,
      fmtMoney: (amount, currency) => `${amount.toFixed(2)} ${currency}`,
    });
    const empty = renderWalletRecentTransactions({ rows: [], t });

    expect(html).toContain('Amasym');
    expect(html).toContain('-25.00 AUD');
    expect(html).toContain('A venir');
    expect(html).toContain('Risque de decouvert');
    expect(html).toContain('Remboursement');
    expect(html).toContain('+12.00 AUD');
    expect(html).toContain('wallet.recent.paid');
    expect(empty).toContain('wallet.recent.empty');
  });

  it('prepares wallet recent transactions outside the legacy dashboard file', () => {
    const rows = prepareWalletRecentTransactions({
      walletId: 'w1',
      wallets: [{ id: 'w1', balance: 20 }],
      activeTravelId: 'trip-1',
      today: '2026-07-25',
      toISODate: (date) => date.toISOString().slice(0, 10),
      transactions: [
        { id: 'old-paid', walletId: 'w1', travelId: 'trip-1', type: 'expense', amount: 5, label: 'Old paid', dateStart: '2026-07-20', payNow: true },
        { id: 'future-soon', walletId: 'w1', travelId: 'trip-1', type: 'expense', amount: 30, label: 'Future', dateStart: '2026-07-27', payNow: false },
        { id: 'future-late', walletId: 'w1', travelId: 'trip-1', type: 'expense', amount: 5, label: 'Too late', dateStart: '2026-08-10', payNow: false },
        { id: 'past-unpaid', walletId: 'w1', travelId: 'trip-1', type: 'expense', amount: 8, label: 'Past unpaid', dateStart: '2026-07-24', payNow: false },
        { id: 'other-wallet', walletId: 'w2', travelId: 'trip-1', type: 'expense', amount: 8, label: 'Other', dateStart: '2026-07-24', payNow: false },
        { id: 'other-trip', walletId: 'w1', travelId: 'trip-2', type: 'expense', amount: 8, label: 'Other trip', dateStart: '2026-07-24', payNow: false },
        { id: 'internal-fee', walletId: 'w1', travelId: 'trip-1', type: 'expense', amount: 2, label: 'Fee', dateStart: '2026-07-24', payNow: false, outOfBudget: false, affectsBudget: true, internalTransferId: 'it-1' },
      ],
    });

    expect(rows.map((row) => row.tx.id)).toEqual(['future-soon', 'past-unpaid', 'old-paid']);
    expect(rows[0]).toMatchObject({ isFutureSoon: true, projectedNegative: true });
    expect(rows[1]).toMatchObject({ isPastUnpaid: true });
    expect(walletRecentTxTouchesWallet({ isInternal: true })).toBe(false);
    expect(walletRecentTxTouchesWallet({ label: 'Trip' }, { isTripBudgetShare: () => true })).toBe(false);
  });

  it('renders daily budget controls with stable ids and date window', () => {
    const html = renderDailyBudgetControls({
      viewStartISO: '2026-07-11',
      viewEndISO: '2026-07-17',
      t,
    });

    expect(html).toContain('id="db-prev"');
    expect(html).toContain('id="db-today"');
    expect(html).toContain('id="db-next"');
    expect(html).toContain('id="db-mode"');
    expect(html).toContain('value="segment"');
    expect(html).toContain('value="voyage"');
    expect(html).toContain('2026-07-11');
    expect(html).toContain('2026-07-17');
  });

  it('keeps daily budget date window helpers outside the legacy file', () => {
    expect(addDashboardDays('2026-07-11', 6)).toBe('2026-07-17');
    expect(addDashboardDays('bad-date', 2)).toBe('bad-date');
    expect(clampDashboardISO('2026-07-10', '2026-07-11', '2026-07-20')).toBe('2026-07-11');
    expect(clampDashboardISO('2026-07-21', '2026-07-11', '2026-07-20')).toBe('2026-07-20');
    expect(clampDashboardISO('2026-07-15', '2026-07-11', '2026-07-20')).toBe('2026-07-15');
  });

  it('loads and saves the daily budget view through an injectable storage', () => {
    const store = new Map();
    const storage = {
      getItem: (key) => store.get(key) || null,
      setItem: (key, value) => store.set(key, value),
    };

    expect(loadDailyBudgetView(storage)).toBeNull();

    saveDailyBudgetView({ mode: 'segment', startISO: '2026-07-14' }, storage);

    expect(store.has('tb_daily_budget_view_v1')).toBe(true);
    expect(loadDailyBudgetView(storage)).toEqual({ mode: 'segment', startISO: '2026-07-14' });
  });

  it('renders a daily budget day with details or an empty allocation state', () => {
    const html = renderDailyBudgetDay({
      date: '2026-07-14',
      budget: 42,
      budgetClassName: 'ok',
      used: 58,
      daily: 100,
      baseCurrency: 'AUD',
      details: [{ label: 'Asset cost', amountBase: 12.4, baseCurrency: 'AUD' }],
      t,
    });
    const empty = renderDailyBudgetDay({ date: '2026-07-15', baseCurrency: 'EUR', t });

    expect(html).toContain('2026-07-14');
    expect(html).toContain('pill ok');
    expect(html).toContain('42 AUD');
    expect(html).toContain('58 AUD');
    expect(html).toContain('100 AUD');
    expect(html).toContain('Asset cost : 12 AUD');
    expect(empty).toContain('dashboard.daily.no_allocation');
  });

  it('renders wallet create and edit dialogs with stable field ids', () => {
    const createHtml = renderWalletCreateDialog();
    const editHtml = renderWalletEditDialog({
      wallet: { name: 'Banque AU', currency: 'AUD', type: 'bank' },
    });

    expect(createHtml).toContain('id="tbWName"');
    expect(createHtml).toContain('id="tbWCur"');
    expect(createHtml).toContain('id="tbWType"');
    expect(createHtml).toContain('id="tbWBal"');
    expect(createHtml).toContain('id="tbWCancel"');
    expect(createHtml).toContain('id="tbWCreate"');
    expect(editHtml).toContain('id="tbWEditName"');
    expect(editHtml).toContain('value="Banque AU"');
    expect(editHtml).toContain('value="AUD" disabled');
    expect(editHtml).toContain('value="bank" selected');
    expect(editHtml).toContain('id="tbWEditOk"');
  });

  it('renders the wallet type fix dialog with suggested defaults', () => {
    const html = renderWalletTypesFixDialog({
      wallets: [
        { id: 'w1', name: 'Cash poche', currency: 'AUD' },
        { id: 'w2', name: 'Wise bank', currency: 'EUR' },
      ],
      inferType: (name) => (String(name).includes('Cash') ? 'cash' : 'bank'),
      typeLabel: (value) => value.toUpperCase(),
    });

    expect(html).toContain('id="tbWFixCancel"');
    expect(html).toContain('id="tbWFixApply"');
    expect(html).toContain('data-wid="w1"');
    expect(html).toContain('data-wid="w2"');
    expect(html).toContain('value="cash" selected');
    expect(html).toContain('value="bank" selected');
    expect(html).toContain('CASH');
    expect(html).toContain('BANK');
  });
});
