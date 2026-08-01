import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('transactions view extraction contract', () => {
  const main = fs.readFileSync('src/main.js', 'utf8');
  const legacy = fs.readFileSync('public/legacy/js/13_transactions_view.js', 'utf8');
  const view = fs.readFileSync('src/features/transactions/transactionView.js', 'utf8');

  it('exposes the Transactions view module to the legacy runtime', () => {
    expect(main).toContain("import * as transactionView from './features/transactions/transactionView.js'");
    expect(main).toContain('window.TBTransactionView');
    expect(main).toContain('...transactionView');
  });

  it('delegates the Transactions help panel rendering and keeps actions hook-based', () => {
    expect(legacy).toContain('window.TBTransactionView?.renderTransactionsHelpPanel');
    expect(legacy).toContain('data-tx-action="open-help"');
    expect(legacy).not.toContain("onclick=\"showView('help')\"");
    expect(legacy).not.toContain('wrap.style.padding =');
    expect(legacy).not.toContain('transactions.help.title")}</div>');
    expect(view).toContain('export function renderTransactionsHelpPanel');
    expect(view).toContain('class="tb-ob-head"');
    expect(view).toContain('class="tb-ob-actions"');
    expect(view).not.toContain('onclick=');
  });
});
