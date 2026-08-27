import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('transaction shared modal migration', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  const source = fs.readFileSync('public/legacy/js/16_modal_add_edit_via_rpc.js', 'utf8');
  const pwa = fs.readFileSync('src/app/pwa.js', 'utf8');
  const transactions = fs.readFileSync('public/legacy/js/13_transactions_view.js', 'utf8');

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

  it('shows internal transfers as readonly before any generic mutation', () => {
    expect(source).toContain('kind: "internal_transfer"');
    expect(source).toContain('if (lockState.readonly)');
    expect(source).toContain('_setTxModalReadOnly(true, lockState.reason)');
    expect(source).toContain('Transfert interne depuis le Dashboard');
    expect(source).not.toContain('Locked fields for Trip-linked payment transaction');
  });

  it('confirms successful transaction mutations through the shared feedback service', () => {
    expect(source).toContain('toastOk(wasEditing ? "Transaction modifiée." : "Transaction enregistrée.")');
    expect(source).toContain('toastOk("Transaction supprimée.")');
    expect(source).toContain('toastOk("Transaction marquée comme payée.")');
    expect(source).toContain('if (typeof toastWarn === "function") toastWarn(message); else alert(message)');
  });

  it('allows a generated occurrence to change subscription only after a safety confirmation', () => {
    expect(source).toContain('transactions.subscription.generated_change_confirm');
    expect(source).toContain('if (!confirm(message)) return;');
    expect(source).toContain('if (recurringRuleChanged)');
    expect(source).not.toContain('select.disabled = generated');
  });

  it('lists every travel subscription and warns instead of hiding different flows or currencies', () => {
    expect(source).toContain('subscriptionRulesForTransaction');
    expect(source).toContain('transactions.subscription.mismatch_confirm');
    expect(source).toContain('tous les abonnements actifs du voyage sont proposés');
    expect(source).not.toContain('if (!trackingOnly && type');
  });

  it('stages several documents and uploads them only after transaction creation', () => {
    expect(html).toContain('id="m-documents" type="file" multiple');
    expect(html).toContain('id="m-documents-list"');
    expect(source).toContain('let txPendingDocuments = [];');
    expect(source).toContain('const createdId = _txCreatedId(data);');
    expect(source).toContain('await window.tbTxDocUploadAndLink(createdId, txPendingDocuments');
    expect(source).toContain('L’envoi de documents nécessite une connexion');
    expect(transactions).toContain('window.tbTxDocUploadAndLink = _txDocUploadAndLink;');
  });
});
