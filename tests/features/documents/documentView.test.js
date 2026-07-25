import { describe, expect, it } from 'vitest';
import { renderDocumentCard } from '../../../src/features/documents/documentView.js';

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
});
