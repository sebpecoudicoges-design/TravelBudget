import { describe, expect, it } from 'vitest';
import {
  renderPendingTripInvites,
  renderTripManagementCard,
  renderTripTabs,
  renderTripContextHelp,
  renderTripExpenseForm,
  renderTripAnalysisBars,
  renderTripLinkAuditCard,
  renderTripTransactionMatchContent,
  renderTripSettlementModalActions,
  renderTripSettlementModalContent,
  renderTripSplitBox,
  renderTripSplitParticipants,
} from '../../../src/features/trip/tripView.js';
import { renderTripExpenseDetailContent } from '../../../src/features/trip/tripExpenseDetailView.js';
import { renderTripExpenseDocumentsContent } from '../../../src/features/trip/tripDocumentView.js';
import {
  renderTripBalancesPanel,
  renderTripHistoryToolbar,
  renderTripSettlementsPanel,
} from '../../../src/features/trip/tripRecapView.js';

describe('Trip view', () => {
  it('renders pending invitations and escapes remote content', () => {
    const html = renderPendingTripInvites({
      language: 'fr',
      invites: [{
        token: 'token-1', tripId: 'trip-1', tripName: '<Road trip>',
        inviterName: 'Alex', memberName: 'Seb', role: 'owner',
      }],
    });
    expect(html).toContain('Invitation Trip en attente');
    expect(html).toContain('&lt;Road trip&gt;');
    expect(html).toContain('data-accept-pending-invite="token-1"');
    expect(html).toContain('proprietaire');
  });

  it('renders the Trip management card with stable controls and escaped members', () => {
    const html = renderTripManagementCard({
      title: '<Trip>',
      members: [
        { id: 'seb', name: 'Seb', email: 'seb@example.com', isMe: true },
        { id: 'alex', name: '<Alex>', email: '' },
      ],
      tripOptions: '<option value="trip-1">Road</option>',
      tripStatusHTML: '<span class="trip-badge">ok</span>',
      trip: { id: 'trip-1' },
      tripClosed: false,
      myRole: 'owner',
      canWrite: true,
      isMobile: false,
      labels: {
        quickAddExpense: '+ Shared expense',
        manageSummary: 'Manage split',
        activeTrip: 'Active trip',
        newTrip: 'New trip',
        createTrip: 'Create',
        delete: 'Delete',
        closeInline: 'Close / freeze',
        participants: 'Participants',
        memberName: 'Name',
        memberEmail: 'Email',
        addMember: 'Add',
        resendInvite: 'Resend invite',
        renameMember: 'Rename',
        pendingInvite: 'pending invitation',
      },
    });

    expect(html).toContain('&lt;Trip&gt;');
    expect(html).toContain('&lt;Alex&gt;');
    expect(html).toContain('id="trip-active"');
    expect(html).toContain('id="trip-new-name"');
    expect(html).toContain('id="trip-create"');
    expect(html).toContain('id="trip-delete"');
    expect(html).toContain('id="trip-close"');
    expect(html).toContain('id="trip-member-name"');
    expect(html).toContain('id="trip-member-email"');
    expect(html).toContain('id="trip-add-member"');
    expect(html).toContain('data-trip-open-add-exp');
    expect(html).toContain('data-resend-invite="alex"');
    expect(html).toContain('data-rename-member="alex"');
    expect(html).toContain('data-del-member="alex"');
    expect(html).not.toContain('onclick=');
  });

  it('renders balances and settlements recap with stable action hooks', () => {
    const balancesByCur = new Map([
      ['AUD', new Map([['seb', 12], ['alex', -12]])],
    ]);
    const settlementsByCur = new Map([
      ['AUD', [{ fromId: 'alex', toId: 'seb', amount: 12 }]],
    ]);
    const members = [
      { id: 'seb', name: 'Seb', isMe: true },
      { id: 'alex', name: '<Alex>' },
    ];
    const balances = renderTripBalancesPanel({
      members,
      balancesByCur,
      title: '<Balances>',
      formatMoney: (amount, currency) => `${Number(amount).toFixed(0)} ${currency}`,
    });
    const settlements = renderTripSettlementsPanel({
      members,
      settlementsByCur,
      settlementEvents: [{ id: 'settle-1', fromMemberId: 'alex', toMemberId: 'seb', amount: 5, currency: 'AUD', createdBy: 'user-1' }],
      canWrite: true,
      myRole: 'owner',
      currentUserId: 'user-1',
      formatMoney: (amount, currency) => `${Number(amount).toFixed(0)} ${currency}`,
    });

    expect(balances).toContain('&lt;Balances&gt;');
    expect(balances).toContain('&lt;Alex&gt;');
    expect(balances).toContain('good');
    expect(balances).toContain('bad');
    expect(settlements).toContain('id="trip-copy-settlements"');
    expect(settlements).toContain('id="trip-share-settlements"');
    expect(settlements).toContain('data-settle-from="alex"');
    expect(settlements).toContain('data-settle-to="seb"');
    expect(settlements).toContain('data-settle-only="1"');
    expect(settlements).toContain('data-cancel-settle="settle-1"');
    expect(settlements).not.toContain('onclick=');
  });

  it('renders Trip history toolbar with filters and stable ids', () => {
    const html = renderTripHistoryToolbar({
      categories: ['Food', '<Transport>'],
      members: [{ id: 'seb', name: 'Seb' }, { id: 'alex', name: '<Alex>' }],
      filters: {
        category: '<Transport>',
        payer: 'seb',
        participant: 'alex',
        dateFrom: '2026-07-01',
        dateTo: '2026-07-10',
        amountMin: '5',
        amountMax: '50',
        q: '<beer>',
      },
      filteredCount: 2,
      totalCount: 5,
      labels: {
        category: 'Category',
        payer: 'Payer',
        participant: 'Participant',
        apply: 'Apply',
        reset: 'Reset',
      },
    });

    expect(html).toContain('trip-history-toolbar');
    expect(html).toContain('id="trip-hist-category"');
    expect(html).toContain('id="trip-hist-payer"');
    expect(html).toContain('id="trip-hist-participant"');
    expect(html).toContain('id="trip-hist-date-from"');
    expect(html).toContain('id="trip-hist-date-to"');
    expect(html).toContain('id="trip-hist-amount-min"');
    expect(html).toContain('id="trip-hist-amount-max"');
    expect(html).toContain('id="trip-hist-q"');
    expect(html).toContain('id="trip-hist-apply"');
    expect(html).toContain('id="trip-hist-reset"');
    expect(html).toContain('&lt;Transport&gt;');
    expect(html).toContain('&lt;Alex&gt;');
    expect(html).toContain('value="&lt;beer&gt;"');
    expect(html).toContain('2 / 5');
    expect(html).not.toContain('onclick=');
  });

  it('does not render an invitation block without valid rows', () => {
    expect(renderPendingTripInvites({ invites: [{ tripId: 'trip-1' }] })).toBe('');
  });

  it('renders the editable expense modal with stable control ids', () => {
    const html = renderTripExpenseForm({
      editingExpenseId: 'expense-1',
      editingDraft: {
        label: 'Lunch', amount: 24, currency: 'AUD', date: '2026-07-05',
        budgetDateStart: '2026-07-06', budgetDateEnd: '2026-07-08',
      },
      trip: { id: 'trip-1', base_currency: 'AUD' },
      canWrite: true,
      memberOptions: '<option>Seb</option>',
      walletOptions: '<option>Bank</option>',
      categoryOptions: '<option>Food</option>',
      modal: true,
      language: 'en',
      todayISO: '2026-07-05',
      translate: (key) => key,
      currencyOptionsHTML: (currency) => `<option>${currency}</option>`,
    });
    expect(html).toContain('id="trip-expense-modal-template"');
    expect(html).toContain('trip-expense-form-grid--meta');
    expect(html).toContain('trip-expense-form-grid--amount');
    expect(html).toContain('trip-expense-actions-row');
    expect(html).toContain('id="trip-exp-label"');
    expect(html).toContain('value="2026-07-06"');
    expect(html).toContain('value="2026-07-08"');
    expect(html).toContain('id="trip-cancel-edit-exp"');
    expect(html).not.toContain('id="trip-add-exp" disabled');
    expect(html).not.toContain('min-width:220px');
    expect(html).not.toContain('max-width:160px');
  });

  it('renders expense details with split, budget links and stable transaction hooks', () => {
    const html = renderTripExpenseDetailContent({
      ex: { id: 'ex-1', label: '<Beer>', amount: 30, currency: 'AUD' },
      shares: [
        { memberId: 'seb', shareAmount: 10 },
        { memberId: 'alex', shareAmount: 20 },
      ],
      members: [
        { id: 'seb', name: 'Seb' },
        { id: 'alex', name: '<Alex>' },
      ],
      audit: {
        walletTransaction: { id: 'tx-main', amount: -30, currency: 'AUD', walletId: 'wallet-1', category: 'Sorties', payNow: true, outOfBudget: false },
        budgetLinks: [{ memberId: 'seb', transactionId: 'tx-share' }],
        budgetTransactionsById: new Map([
          ['tx-share', { id: 'tx-share', amount: -10, currency: 'AUD', walletId: 'wallet-1', category: '<Trip>', payNow: false, outOfBudget: true }],
        ]),
        myShareLink: true,
      },
      linkIssues: [{ type: '<missing>', transactionId: 'tx-x' }],
      walletNameById: () => '<Bank>',
      formatMoney: (amount, currency) => `${Number(amount).toFixed(0)} ${currency}`,
      round2: (value) => Math.round(Number(value) * 100) / 100,
      translate: (key) => key === 'trip.linked.open_transaction' ? 'Open tx' : '<Audit>',
    });

    expect(html).toContain('&lt;Beer&gt;');
    expect(html).toContain('&lt;Alex&gt;');
    expect(html).toContain('&lt;Bank&gt;');
    expect(html).toContain('&lt;Trip&gt;');
    expect(html).toContain('&lt;missing&gt;');
    expect(html).toContain('data-trip-detail-open-tx="tx-main"');
    expect(html).toContain('data-trip-detail-open-tx="tx-share"');
    expect(html).toContain('data-label="Participant"');
    expect(html).toContain('data-label="Montant tx"');
    expect(html).toContain('30 AUD');
    expect(html).not.toContain('onclick=');
  });

  it('disables expense submission without write access or an active Trip', () => {
    const html = renderTripExpenseForm({
      canWrite: false,
      trip: null,
      todayISO: '2026-07-05',
      translate: (key) => key,
    });
    expect(html).toContain('id="trip-add-exp" disabled');
  });

  it('renders context help with stable action hooks and escaped copy', () => {
    const html = renderTripContextHelp({
      title: '<Trip help>',
      bullets: ['Paid by me', '<Budget>'],
      openLabel: 'Open help',
      hideLabel: 'Hide',
    });
    expect(html).toContain('trip-help-card-row');
    expect(html).toContain('&lt;Trip help&gt;');
    expect(html).toContain('&lt;Budget&gt;');
    expect(html).toContain('data-trip-help-open="1"');
    expect(html).toContain('data-trip-help-close="1"');
    expect(html).not.toContain('onclick=');
  });

  it('renders the link audit card only when issues exist', () => {
    expect(renderTripLinkAuditCard({ count: 0 })).toBe('');
    const html = renderTripLinkAuditCard({
      count: 2,
      title: '<Audit>',
      body: '2 <issues>',
    });
    expect(html).toContain('trip-link-audit-card');
    expect(html).toContain('&lt;Audit&gt;');
    expect(html).toContain('2 &lt;issues&gt;');
    expect(html).toContain('<span class="trip-badge">2</span>');
  });

  it('renders Trip analysis bars with category and participant balances', () => {
    const html = renderTripAnalysisBars({
      data: {
        pivot: 'AUD',
        categories: [
          { name: '<Food>', amount: 120 },
          { name: 'Transport', amount: 30 },
        ],
        participants: [
          { name: 'Seb', isMe: true, paid: 100, owed: 70, net: 30, expenseCount: 2 },
          { name: '<Alex>', paid: 50, owed: 80, net: -30, expenseCount: 1 },
        ],
      },
      formatMoney: (amount, currency) => `${Number(amount).toFixed(0)} ${currency}`,
    });

    expect(html).toContain('trip-analysis-shell');
    expect(html).toContain('&lt;Food&gt;');
    expect(html).toContain('&lt;Alex&gt;');
    expect(html).toContain('Total du trip');
    expect(html).toContain('150 AUD');
    expect(html).toContain('Seb (moi)');
    expect(html).toContain('&lt;Alex&gt; doit 30 AUD');
  });

  it('renders transaction match candidates with stable search and link hooks', () => {
    const html = renderTripTransactionMatchContent({
      query: '<beer>',
      exactOnly: true,
      targetDate: '2026-07-10',
      targetAmount: 42,
      targetCurrency: 'AUD',
      rows: [
        {
          id: 'tx-1',
          label: '<Biere>',
          amount: 42,
          currency: 'AUD',
          category: 'Sorties',
          subcategory: 'Bar',
          date_start: '2026-07-10',
          date_end: '2026-07-10',
          wallet_id: 'wallet-1',
        },
      ],
      walletName: () => '<Bank AUD>',
      matchSubtitle: () => 'paye · budget',
      formatMoney: (amount, currency) => `${Number(amount).toFixed(0)} ${currency}`,
    });

    expect(html).toContain('id="trip-match-search"');
    expect(html).toContain('value="&lt;beer&gt;"');
    expect(html).toContain('id="trip-match-exact" type="checkbox" checked');
    expect(html).toContain('&lt;Biere&gt;');
    expect(html).toContain('&lt;Bank AUD&gt;');
    expect(html).toContain('Même date');
    expect(html).toContain('Même montant');
    expect(html).toContain('Recommandé');
    expect(html).toContain('data-trip-match-new');
    expect(html).toContain('data-trip-match-link');
  });

  it('renders settlement modal content and actions with stable ids', () => {
    const content = renderTripSettlementModalContent();
    const actions = renderTripSettlementModalActions();

    expect(content).toContain('id="tripSettleContext"');
    expect(content).toContain('for="tripSettleWallet"');
    expect(content).toContain('id="tripSettleWallet"');
    expect(content).toContain('id="tripSettleCurrency"');
    expect(content).toContain('id="tripSettleAmount"');
    expect(actions).toContain('id="tripSettleOnly"');
    expect(actions).toContain('Régler sans wallet');
    expect(actions).toContain('id="tripSettleConfirm"');
    expect(actions).toContain('Valider');
  });

  it('renders Trip tabs with stable ids and escaped labels', () => {
    const html = renderTripTabs({ recapLabel: '<Recap>', historyLabel: 'History' });
    expect(html).toContain('class="trip-tabs"');
    expect(html).toContain('id="trip-tab-recap"');
    expect(html).toContain('id="trip-tab-history"');
    expect(html).toContain('&lt;Recap&gt;');
    expect(html).not.toContain('onclick=');
  });

  it('renders split participants with stable checkbox hooks', () => {
    const html = renderTripSplitParticipants({
      members: [
        { id: 'seb', name: 'Seb', isMe: true },
        { id: 'alex', name: '<Alex>' },
      ],
      selectedMemberIds: ['alex'],
    });
    expect(html).toContain('Participants concernés');
    expect(html).toContain('data-trip-split-member="seb"');
    expect(html).toContain('data-trip-split-member="alex" checked');
    expect(html).toContain('Seb (moi)');
    expect(html).toContain('&lt;Alex&gt;');
    expect(html).toContain('En mode égal');
  });

  it('renders the percent split table with stable inputs', () => {
    const html = renderTripSplitBox({
      mode: 'percent',
      members: [
        { id: 'seb', name: 'Seb', isMe: true },
        { id: 'alex', name: '<Alex>' },
      ],
      selectedMemberIds: ['alex'],
      activeCount: 1,
      previousPercents: { alex: '100' },
    });
    expect(html).toContain('Somme = 100%');
    expect(html).toContain('trip-split-pct-seb');
    expect(html).toContain('value="0" disabled');
    expect(html).toContain('trip-split-pct-alex');
    expect(html).toContain('value="100"');
    expect(html).toContain('class="trip-split-table"');
    expect(html).toContain('data-label="Participant"');
    expect(html).toContain('data-label="%"');
    expect(html).toContain('&lt;Alex&gt;');
    expect(html).toContain('Les montants seront arrondis');
  });

  it('renders the amount split table with auto and manual values', () => {
    const html = renderTripSplitBox({
      mode: 'amount',
      members: [
        { id: 'seb', name: 'Seb', isMe: true },
        { id: 'alex', name: 'Alex' },
        { id: 'sam', name: 'Sam' },
      ],
      selectedMemberIds: ['seb', 'alex'],
      amountAutoParts: [8.5, 6.25, 0],
      previousAmounts: { alex: '7.00' },
    });
    expect(html).toContain('trip-split-amt-seb');
    expect(html).toContain('value="8.50" data-auto="1"');
    expect(html).toContain('trip-split-amt-alex');
    expect(html).toContain('value="7.00" data-auto="0"');
    expect(html).toContain('trip-split-amt-sam');
    expect(html).toContain('value="0" data-auto="0" disabled');
    expect(html).toContain('class="trip-split-table"');
    expect(html).toContain('data-label="Montant"');
    expect(html).toContain('Montant');
  });

  it('renders expense document links with stable hooks and escaped names', () => {
    const html = renderTripExpenseDocumentsContent({
      links: [
        { id: 'link-1', relation_type: 'receipt', document_id: 'doc-1', document: { id: 'doc-1', name: '<Receipt>' } },
        { id: 'link-2', relation_type: 'proof', document_id: 'doc-2', document: null },
      ],
      availableDocs: [{ id: 'doc-3', name: 'Invoice' }],
      documentName: (doc) => doc.name,
      relationLabel: (type) => `Relation ${type}`,
    });
    expect(html).toContain('tb-trip-documents-content');
    expect(html).toContain('&lt;Receipt&gt;');
    expect(html).toContain('Relation receipt');
    expect(html).toContain('data-open-trip-doc="doc-1"');
    expect(html).toContain('data-unlink-trip-doc="link-1"');
    expect(html).toContain('Document supprimé');
    expect(html).toContain('id="trip-doc-search"');
    expect(html).toContain('id="trip-doc-select"');
    expect(html).toContain('value="doc-3"');
    expect(html).toContain('data-trip-doc-link-selected');
    expect(html).toContain('data-trip-doc-upload-btn');
    expect(html).toContain('id="trip-doc-upload-input"');
  });
});
