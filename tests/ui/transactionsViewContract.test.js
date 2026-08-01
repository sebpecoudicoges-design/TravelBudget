import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('transactions view extraction contract', () => {
  const main = fs.readFileSync('src/main.js', 'utf8');
  const index = fs.readFileSync('index.html', 'utf8');
  const legacy = fs.readFileSync('public/legacy/js/13_transactions_view.js', 'utf8');
  const view = fs.readFileSync('src/features/transactions/transactionView.js', 'utf8');
  const theme = fs.readFileSync('src/ui/premium-theme.css', 'utf8');

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

  it('keeps the Transactions filter workspace styled by the premium theme', () => {
    expect(index).toContain('class="card toolbar-card tx-filters-card tx-workspace-card"');
    expect(index).not.toContain('class="card toolbar-card tx-filters-card tx-workspace-card" style=');
    expect(index).toContain('id="f-from"');
    expect(index).toContain('id="f-wallet"');
    expect(index).toContain('id="f-category"');
    expect(index).toContain('id="f-q"');
    expect(theme).toContain('body:not(.theme-dark) .tx-workspace-card');
    expect(theme).toContain('backdrop-filter: blur(14px)');
  });
});
