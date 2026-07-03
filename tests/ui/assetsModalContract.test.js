import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('assets shared modal migration', () => {
  const source = fs.readFileSync('public/legacy/js/42_assets_ui.js', 'utf8');

  it('routes every asset form through one shared modal adapter', () => {
    expect(source).toContain("window.UI?.createModal?.({");
    expect(source).toContain("id:'tb-assets-shared-modal'");
    expect(source).toContain('data-tb-asset-form=');
    expect(source).toContain('data-tb-asset-owners-form');
    expect(source).toContain('data-tb-asset-transfer-form');
    expect(source).toContain("closest('[data-tb-asset-transfer]')");
    expect(source).toContain('data-tb-asset-sell-form');
    expect(source).toContain('data-tb-asset-docs-form');
    expect(source).toContain('data-tb-asset-submit');
  });

  it('removes the duplicated asset modal shell and keeps inline errors accessible', () => {
    expect(source).not.toContain('tb-asset-modal-backdrop');
    expect(source).not.toContain('tb-asset-modal-head');
    expect(source).not.toContain('tb-asset-modal-actions');
    expect(source.match(/role="alert"/g)).toHaveLength(5);
  });

  it('keeps linked documents readable from the offline snapshot', () => {
    expect(source).toContain('window.state?.documents');
    expect(source).toContain('(CACHE.documentLinks||[]).filter');
    expect(source).toContain('window.state?.transactionDocuments');
    expect(source).toContain('window.state?.tripExpenseDocuments');
  });
});
