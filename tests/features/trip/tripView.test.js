import { describe, expect, it } from 'vitest';
import { renderPendingTripInvites, renderTripContextHelp, renderTripExpenseForm } from '../../../src/features/trip/tripView.js';

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
});
