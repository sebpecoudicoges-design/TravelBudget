import fs from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import {
  renderPendingTripInvites,
  renderTripTabs,
  renderTripContextHelp,
  renderTripExpenseForm,
  renderTripAnalysisBars,
  renderTripLinkAuditCard,
  renderTripSplitBox,
  renderTripSplitParticipants,
} from '../../../src/features/trip/tripView.js';

function loadTripDocumentView() {
  const sandbox = { window: { UI: {} } };
  vm.runInNewContext(fs.readFileSync('public/legacy/js/29_trip_document_view.js', 'utf8'), sandbox);
  return sandbox.window.UI.tripDocumentView;
}

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
    expect(html).toContain('id="trip-exp-label"');
    expect(html).toContain('value="2026-07-06"');
    expect(html).toContain('value="2026-07-08"');
    expect(html).toContain('id="trip-cancel-edit-exp"');
    expect(html).not.toContain('id="trip-add-exp" disabled');
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
    expect(html).toContain('Montant');
  });

  it('renders expense document links with stable hooks and escaped names', () => {
    const html = loadTripDocumentView().renderTripExpenseDocumentsContent({
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
