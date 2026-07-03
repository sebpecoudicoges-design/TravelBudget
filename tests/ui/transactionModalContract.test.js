import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('transaction shared modal migration', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  const source = fs.readFileSync('public/legacy/js/16_modal_add_edit_via_rpc.js', 'utf8');
  const pwa = fs.readFileSync('src/app/pwa.js', 'utf8');

  it('mounts the stable transaction form template in the shared modal', () => {
    expect(html).toContain('id="tx-modal-template"');
    expect(html).toContain('id="tx-modal-form"');
    expect(source).toContain('window.UI?.createModal?.({');
    expect(source).toContain('id: "tb-transaction-modal"');
    expect(source).toContain('data-tx-save form="tx-modal-form"');
  });

  it('keeps creation, edition and duplication on the same adapter', () => {
    expect(source.match(/_mountTxModal\(/g)?.length).toBe(4);
    expect(source).toContain('transactions.modal.new');
    expect(source).toContain('transactions.modal.edit');
    expect(source).toContain('Duplicate transaction');
  });

  it('removes the legacy overlay and modal shell contracts', () => {
    expect(html).not.toContain('id="overlay"');
    expect(html).not.toContain('id="modal"');
    expect(source).not.toContain('document.getElementById("overlay")');
    expect(source).not.toContain('document.getElementById("modal")');
    expect(source).not.toContain('#modal button.btn.primary');
    expect(pwa).not.toContain('#modal .modal-actions');
  });
});
