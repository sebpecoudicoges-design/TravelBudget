import { describe, expect, it } from 'vitest';
import { renderInboxCard, renderInboxPreview, renderInboxShell } from '../../../src/features/inbox/inboxView.js';

const api = {
  translate: (fr) => fr,
  formatDateTime: () => '22/07 08:30',
  statusLabel: () => 'A traiter',
  parseQuickText: () => ({ amount: 12.5, currency: 'AUD', label: 'Cafe' }),
  isImage: (item) => /^image\//i.test(String(item?.media_content_type || '')),
  isPdf: (item) => /pdf/i.test(String(item?.media_content_type || '')),
};

describe('inboxView', () => {
  it('renders the inbox shell with filters, counters and stable action hooks', () => {
    const html = renderInboxShell({
      items: [{ id: 'n1', status: 'pending', raw_text: 'Cafe 12.5 AUD' }],
      allItems: [{ status: 'pending' }, { status: 'snoozed' }],
      status: 'active',
      search: 'cafe',
      api,
    });

    expect(html).toContain('id="inbox-status-filter"');
    expect(html).toContain('id="inbox-search"');
    expect(html).toContain('value="cafe"');
    expect(html).toContain('1 à traiter');
    expect(html).toContain('1 reportés');
    expect(html).toContain('data-inbox-action="transaction"');
  });

  it('renders document previews from signed storage urls', () => {
    const html = renderInboxPreview({
      item: { storage_path: 'receipts/a.jpg', media_content_type: 'image/jpeg' },
      signedUrls: { 'receipts/a.jpg': 'https://example.test/a.jpg' },
      api,
    });

    expect(html).toContain('<img');
    expect(html).toContain('https://example.test/a.jpg');
  });

  it('renders Trip payer approval actions without mutating data', () => {
    const html = renderInboxCard({
      item: { id: 't1', status: 'pending', created_at: '2026-07-22', source_from: 'seb@test' },
      api: {
        ...api,
        isTripPayerApproval: () => true,
        tripApprovalCreatesCash: () => true,
        tripApprovalActionLabel: () => 'Valider Trip',
        tripApprovalMeta: () => ({
          trip_name: 'BudgetTravel',
          expense_label: 'Transport',
          amount: 96.16,
          currency: 'AUD',
          created_by_email: 'seb@test',
        }),
      },
    });

    expect(html).toContain('Dépense Trip à ajouter');
    expect(html).toContain('BudgetTravel');
    expect(html).toContain('data-inbox-action="trip-payer-approve"');
    expect(html).toContain('Valider Trip');
  });
});
