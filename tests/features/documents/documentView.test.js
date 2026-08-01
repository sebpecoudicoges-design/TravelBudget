import { describe, expect, it } from 'vitest';
import {
  renderDocumentAssetsModal,
  renderDocumentAddTagSelectedModal,
  renderDocumentCard,
  renderDocumentFolders,
  renderDocumentInfoModal,
  renderDocumentMain,
  renderDocumentMoveSelectedModal,
  renderDocumentPreviewModal,
  renderDocumentShareModal,
  renderDocumentShareResultModal,
  renderDocumentShell,
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

  it('renders folder navigation with nested folders and active state', () => {
    const html = renderDocumentFolders({
      folders: [{
        id: 'root-1',
        name: 'Administratif',
        count: 3,
        collapsed: false,
        children: [{ id: 'child-1', name: 'Factures', count: 2 }],
      }],
      allCount: 5,
      selectedFolderId: 'child-1',
      ...api,
    });

    expect(html).toContain('Administratif');
    expect(html).toContain('Factures');
    expect(html).toContain("window.tbDocumentsSelectFolder('child-1')");
    expect(html).toContain('tb-doc-folder active');
    expect(html).toContain('<aside class="tb-doc-sidebar"');
    expect(html).toContain('tb-doc-sidebar-mark');
    expect(html).toContain('tb-doc-folder-glyph');
    expect(html).toContain('aria-label="documents.folder.rename"');
    expect(html).not.toContain('>Edit</button>');
    expect(html).not.toContain('>Del</button>');
  });

  it('renders main document area with filters, batch actions and cards', () => {
    const html = renderDocumentMain({
      folderName: 'Factures',
      documentCount: 1,
      sort: 'name_asc',
      search: 'visa',
      tags: [{ value: 'Trip Australie', key: 'trip-australie' }],
      tagFilter: 'Trip Australie',
      tagFilterKey: 'trip-australie',
      onlyFavorites: true,
      selectedCount: 2,
      documentCards: '<article data-doc-id="doc-1"></article>',
      dropTargetLabel: 'Vers Factures',
      ...api,
    });

    expect(html).toContain('Factures');
    expect(html).toContain('value="visa"');
    expect(html).toContain('Trip Australie');
    expect(html).toContain('selected');
    expect(html).toContain('tb-doc-batchbar');
    expect(html).toContain('data-doc-id="doc-1"');
  });

  it('renders the document shell around delegated slots', () => {
    const html = renderDocumentShell({
      foldersHtml: '<aside>Folders</aside>',
      mainHtml: '<main>Docs</main>',
      ...api,
    });

    expect(html).toContain('tb-doc-hero');
    expect(html).toContain('<aside>Folders</aside>');
    expect(html).toContain('<main>Docs</main>');
    expect(html).toContain('tb-doc-file-input');
  });

  it('renders preview and metadata modals from the document view module', () => {
    const preview = renderDocumentPreviewModal({
      name: 'Passeport <scan>',
      url: 'https://example.test/file?x=<1>',
      body: '<iframe src="about:blank"></iframe>',
      ...api,
    });
    const info = renderDocumentInfoModal({
      doc: { id: 'doc-1' },
      currentTags: 'visa, <scan>',
      currentExpiry: '2027-01-02',
      currentNotes: 'Original chez parents',
      suggestions: ['Australie', 'Banque'],
      folderOptionsHtml: '<option value="">Sans dossier</option>',
      ...api,
    });

    expect(preview).toContain('Passeport &lt;scan&gt;');
    expect(preview).toContain('https://example.test/file?x=&lt;1&gt;');
    expect(preview).toContain('documents.action.new_tab');
    expect(info).toContain('tb-doc-info-tags');
    expect(info).toContain('visa, &lt;scan&gt;');
    expect(info).toContain('value="2027-01-02"');
    expect(info).toContain('window.tbDocumentsSaveInfo');
  });

  it('renders share setup and share result modals', () => {
    const setup = renderDocumentShareModal({ count: 2, ...api });
    const result = renderDocumentShareResultModal({
      count: 2,
      duration: '24h',
      bodyText: 'Hello <links>',
      links: [{ name: 'Facture', url: 'https://example.test/doc' }],
      ...api,
    });

    expect(setup).toContain('tb-doc-share-duration');
    expect(setup).toContain("window.tbDocumentsGenerateShareLinks()");
    expect(result).toContain('Hello &lt;links&gt;');
    expect(result).toContain('https://example.test/doc');
    expect(result).toContain("window.tbDocumentsCopyShareLinks()");
  });

  it('renders batch move and tag modals', () => {
    const move = renderDocumentMoveSelectedModal({
      count: 3,
      folderOptions: [['', 'Sans dossier'], ['folder-1', 'Factures']],
      ...api,
    });
    const tag = renderDocumentAddTagSelectedModal({
      count: 3,
      tags: ['trip', 'garantie'],
      ...api,
    });

    expect(move).toContain('tb-doc-batch-folder');
    expect(move).toContain('value="folder-1"');
    expect(move).toContain("window.tbDocumentsApplyMoveSelected()");
    expect(tag).toContain('tb-doc-batch-tag');
    expect(tag).toContain('value="garantie"');
    expect(tag).toContain("window.tbDocumentsApplyAddTagSelected()");
  });
});
