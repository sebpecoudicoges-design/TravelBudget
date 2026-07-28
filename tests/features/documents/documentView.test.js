import { describe, expect, it } from 'vitest';
import {
  renderDocumentAssetsModal,
  renderDocumentCard,
  renderDocumentTransactionsModal,
} from '../../../src/features/documents/documentView.js';

const api = {
  tr: (key) => ({
    'documents.folder.unclassified': 'Sans dossier',
    'documents.action.move': 'Deplacer',
    'documents.action.open': 'Ouvrir',
    'documents.action.info': 'Infos',
    'documents.action.rename': 'Renommer',
    'documents.action.delete': 'Supprimer',
    'documents.linked_transactions.title': 'Transactions liees',
  }[key] || key),
  atxt: (fr) => fr,
  fmtDate: () => '2026-07-25',
  fmtSize: () => '42 KB',
  fmtExpiry: () => 'Expire bientot',
  isSelected: (id) => id === 'doc-1',
};

describe('document view', () => {
  it('renders a document card with actions, folders and link badges', () => {
    const html = renderDocumentCard({
      id: 'doc-1',
      name: 'Facture <test>',
      mime_type: 'application/pdf',
      size_bytes: 42_000,
      folder_id: 'folder-1',
      is_favorite: true,
      tags: ['trip', '<audit>'],
      notes: 'Note importante',
      expires_at: '2026-08-01',
    }, {
      ...api,
      folders: [{ id: 'folder-1', name: 'Administratif' }],
      linkCounts: { 'doc-1': { transactions: 2, tripTransactions: 1, assets: 1 } },
    });

    expect(html).toContain('data-doc-id="doc-1"');
    expect(html).toContain('Facture &lt;test&gt;');
    expect(html).toContain('value="folder-1"');
    expect(html).toContain('Transactions 3');
    expect(html).toContain('Assets 1');
    expect(html).toContain('checked');
    expect(html).toContain('window.tbDocumentsPreview');
  });

  it('escapes image metadata and keeps thumbnail hydration hooks', () => {
    const html = renderDocumentCard({
      id: 'doc-&',
      original_filename: 'Photo',
      mime_type: 'image/png',
      storage_path: 'folder/<image>.png',
      storage_bucket: 'bucket<&>',
    }, api);

    expect(html).toContain('data-thumb-path="folder/&lt;image&gt;.png"');
    expect(html).toContain('data-thumb-bucket="bucket&lt;&amp;&gt;"');
    expect(html).toContain("window.tbDocumentsToggleSelect('doc-&amp;')");
  });

  it('renders transaction and Trip link modal content from the document view module', () => {
    const html = renderDocumentTransactionsModal({
      doc: { id: 'doc-1', name: 'Facture Trip' },
      links: [{ id: 'link-1', transaction_id: 'tx-1', relation_type: 'invoice' }],
      tripLinks: [{ id: 'trip-link-1', expense_id: 'expense-1', relation_type: 'receipt' }],
      candidates: [{ id: 'tx-2', label: 'Candidate' }],
      searchQuery: 'beer',
      findTxById: () => ({ id: 'tx-1', label: 'Biere' }),
      txLabel: (tx) => tx?.label || 'missing',
      findTripExpenseById: () => ({ id: 'expense-1', label: 'Trip beer' }),
      tripExpenseLabel: (expense) => expense?.label || 'missing',
      ...api,
    });

    expect(html).toContain('Facture Trip');
    expect(html).toContain('Biere');
    expect(html).toContain('Trip beer');
    expect(html).toContain('value="tx-2"');
    expect(html).toContain("window.tbDocumentsApplyLinkTransaction('doc-1')");
  });

  it('renders asset link modal content from the document view module', () => {
    const html = renderDocumentAssetsModal({
      doc: { id: 'doc-2', name: 'Garantie' },
      links: [{ id: 'asset-link-1', asset_id: 'asset-1', relation_type: 'warranty' }],
      assets: [{ id: 'asset-1', name: 'Camera' }],
      candidates: [{ id: 'asset-2', name: 'Laptop' }],
      assetLabel: (asset) => asset?.name || 'missing',
      ...api,
    });

    expect(html).toContain('Garantie');
    expect(html).toContain('Camera');
    expect(html).toContain('value="asset-2"');
    expect(html).toContain("window.tbDocumentsApplyLinkAsset('doc-2')");
    expect(html).toContain('selected');
  });
});
