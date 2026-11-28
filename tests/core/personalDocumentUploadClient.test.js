import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

function source(file, begin, end) {
  const code = readFileSync(new URL(`../../public/legacy/js/${file}.js`, import.meta.url), 'utf8');
  const first = code.indexOf(begin);
  const last = code.indexOf(end, first + begin.length);
  if (first < 0 || last < 0) throw new Error(`Upload boundary missing: ${file}`);
  return code.slice(first, last);
}
const helper = source('00_constants', 'window.tbWritePersonalDocument =', 'try { if (!window.__tbBuildLogged)');
const entrypoints = [
  ['Documents', '43_documents_ui', 'async function upload(files, opts)', 'async function signedUrl', 'upload([file], { afterUpload })', []],
  ['Transactions', '13_transactions_view', 'async function _txDocUploadAndLink', 'window.tbTxDocUploadAndLink', '_txDocUploadAndLink("tx-fixture", [file])', ['transaction_documents']],
  ['Trip', '29_trip_v1', 'async function _uploadTripExpenseDocumentFile', 'async function _fetchTripExpenseDocumentLinks', '_uploadTripExpenseDocumentFile("expense-fixture", file)', ['trip-link']],
];

describe.each(entrypoints)('%s scoped document upload', (name, script, begin, end, call, links) => {
  it.each(['confirmed', 'transport-error', 'missing-confirmation'])('%s', async outcome => {
    const uid = '10000000-0000-4000-8000-000000000001';
    const documentId = '20000000-0000-4000-8000-000000000001';
    const path = `${uid}/${documentId}/receipt.pdf`;
    const file = new File(['synthetic fixture'], 'receipt.pdf', { type: 'application/pdf' });
    const events = [];
    let finishUpload;
    const invoke = vi.fn(() => {
      events.push('admission');
      return new Promise(resolve => { finishUpload = resolve; });
    });
    const useRawStorage = vi.fn(() => { throw new Error('Unexpected direct Storage call'); });
    const client = {
      functions: { invoke },
      storage: { from: useRawStorage },
      from: table => ({ insert: async row => {
        events.push({ table, row });
        return { error: null };
      } }),
    };
    const afterUpload = vi.fn();
    const notify = vi.fn();
    const sandbox = {
      window: {}, file, afterUpload, notify,
      console: { warn: vi.fn() },
      crypto: { randomUUID: () => documentId },
      CACHE: { selectedFolderId: 'folder-fixture' },
      BUCKET: 'personal-documents', TB_TX_DOC_BUCKET: 'personal-documents',
      renderShell() {}, ensureLoaded: async () => {},
      client: () => client, sb: client, tr: key => key, table: key => key,
      currentUserId: async () => uid, cleanFilename: name => name,
      _txDocFindTx: () => ({ label: 'Team lunch' }), _txDocClient: () => client,
      _txDocCurrentUserId: async () => uid, _txDocEnsureInvoicesFolder: async () => 'folder-fixture',
      _txDocTable: key => key, _txDocCleanFilename: name => name, _txDocT: key => key,
      _ensureSession: async () => uid, tripState: { activeTripId: 'trip-fixture', expenses: [{ id: 'expense-fixture' }] },
      _tripCleanFilename: name => name, _tripDocumentsTable: () => 'documents',
      _ensureTripInvoiceFolderId: async () => 'folder-fixture', _tripDocumentTagsForRelation: () => [],
      _linkTripExpenseDocument: async row => events.push({ table: 'trip-link', row }),
    };
    const promise = runInNewContext(`${helper}\n${source(script, begin, end)}\n${call}`, sandbox);
    const observed = Promise.resolve(promise).then(value => ({ value }), error => ({ error }));
    await vi.waitFor(() => expect(invoke).toHaveBeenCalledOnce());
    expect(events).toEqual(['admission']);
    expect(invoke).toHaveBeenCalledWith('write-personal-document', {
      headers: {
        'x-document-content-type': 'application/pdf',
        'x-document-id': documentId,
        'x-document-filename': 'receipt.pdf',
      },
      body: file,
    });
    finishUpload(outcome === 'confirmed' ? { data: { path } } : outcome === 'transport-error'
      ? { error: new Error('Synthetic transport interruption') }
      : { data: {} });
    const result = await observed;
    expect(useRawStorage).not.toHaveBeenCalled();
    if (outcome === 'confirmed') {
      expect(result.error).toBeUndefined();
      expect(events.slice(1).map(event => event.table)).toEqual(['documents', ...links]);
      expect(events[1].row).toMatchObject({ user_id: uid, id: documentId, storage_path: path, storage_bucket: 'personal-documents' });
      if (name === 'Documents') expect(afterUpload).toHaveBeenCalledWith([documentId]);
      if (name === 'Transactions') expect(events[2].row).toMatchObject({ transaction_id: 'tx-fixture', document_id: documentId });
      if (name === 'Trip') expect(events[2].row).toMatchObject({ expenseId: 'expense-fixture', tripId: 'trip-fixture', documentId });
    } else {
      expect(events).toEqual(['admission']);
      if (name === 'Documents') {
        expect(afterUpload).toHaveBeenCalledWith([]);
        expect(notify).toHaveBeenCalledWith(expect.stringContaining('1 erreur'), 'error');
      } else {
        expect(result.error?.message).toMatch(/transport interruption|did not confirm/);
      }
    }
  });
});
