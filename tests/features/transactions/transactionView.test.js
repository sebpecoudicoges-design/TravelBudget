import { describe, expect, it } from 'vitest';
import { renderTransactionsHelpPanel } from '../../../src/features/transactions/transactionView.js';

describe('transactionView', () => {
  it('renders the help panel with stable hooks and escaped labels', () => {
    const html = renderTransactionsHelpPanel({
      t: (key) => ({
        'transactions.help.title': '<Lire>',
        'transactions.help.paid': 'Paye & wallet',
        'transactions.help.unpaid': 'A payer',
        'transactions.help.out': 'Hors budget',
        'transactions.help.hide': 'Masquer',
        'nav.help': 'Aide',
      }[key] || key),
    });

    expect(html).toContain('class="tb-ob-head"');
    expect(html).toContain('class="tb-ob-actions"');
    expect(html).toContain('data-tx-action="open-help"');
    expect(html).toContain('data-tx-help-close="1"');
    expect(html).toContain('&lt;Lire&gt;');
    expect(html).toContain('Paye &amp; wallet');
    expect(html).not.toContain('onclick=');
  });
});
