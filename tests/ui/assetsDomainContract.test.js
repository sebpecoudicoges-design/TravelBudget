import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('assets domain extraction contract', () => {
  const bridge = fs.readFileSync('src/app/bridge.js', 'utf8');
  const core = fs.readFileSync('public/legacy/js/41_assets_core.js', 'utf8');
  const legacy = fs.readFileSync('public/legacy/js/42_assets_ui.js', 'utf8');
  const rules = fs.readFileSync('src/core/assetRules.js', 'utf8');
  const view = fs.readFileSync('src/features/assets/assetView.js', 'utf8');

  it('exposes asset rules and views through the modular bridge', () => {
    expect(bridge).toContain("import * as assetRules from '../core/assetRules.js'");
    expect(bridge).toContain("import * as assetView from '../features/assets/assetView.js'");
    expect(bridge).toContain('window.Core.assetRules = assetRules');
    expect(bridge).toContain('window.UI.assetView = assetView');
  });

  it('keeps asset cards, summaries and forms delegated to assetView', () => {
    expect(legacy).toContain('window.UI.assetView.renderPortfolioSummary');
    expect(legacy).toContain('window.UI.assetView.renderAssetCard');
    expect(legacy).toContain('window.UI?.assetView?.renderAssetEditorModalSpec');
    expect(legacy).toContain('window.UI?.assetView?.renderAssetOwnersModalSpec');
    expect(legacy).toContain('window.UI?.assetView?.renderAssetTransferModalSpec');
    expect(legacy).toContain('window.UI?.assetView?.renderAssetSaleModalSpec');
    expect(legacy).toContain('window.UI?.assetView?.renderAssetDocumentsModalSpec');
    expect(legacy).toContain('window.Core?.assetRules?.assetMonthlyBudgetAmount');
    expect(legacy).toContain("assetTransactionLinkTable(){ return table('asset_transaction_links','asset_transaction_links'); }");
    expect(legacy).toContain('updateLinkedTransactionBudgetFlags');
  });

  it('keeps monthly budget cost normalized in core and rendered in extracted views', () => {
    expect(core).toContain('monthly_budget_override');
    expect(core).toContain('budget_day');
    expect(core).toContain('budget_category');
    expect(rules).toContain('assetMonthlyBudgetAmount');
    expect(rules).toContain('buildAssetBudgetTransactions');
    expect(rules).toContain('buildAssetLinkedTransactionBudgetPatch');
    expect(rules).toContain('assetBudget: true');
    expect(view).toContain('renderPortfolioSummary');
    expect(view).toContain('renderAssetCard');
    expect(view).toContain('renderAssetEditorModalSpec');
    expect(view).toContain('renderAssetTransferModalSpec');
    expect(view).toContain('renderAssetSaleModalSpec');
    expect(view).toContain('renderAssetDocumentsModalSpec');
  });
});
