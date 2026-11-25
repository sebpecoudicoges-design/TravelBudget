import { expect, it, vi } from 'vitest';
vi.mock('npm:@supabase/supabase-js@2.57.4', () => ({ createClient: vi.fn() }));
import { collectAccountData, purgeAccount, removeAccountStorage } from '../../supabase/functions/_shared/account-data.ts';

function client(failure, shared = false) {
  const deleteUser = vi.fn(async () => ({ error: null }));
  return { auth: { admin: { deleteUser } }, from: table => {
    let operation = 'select'; let patch; let pageStart = 0; const filters = [];
    const query = {
      select: () => query, range: from => { pageStart = from; return query; }, order: () => query, limit: () => query,
      eq: (key, value) => { filters.push([key, value]); return query; }, neq: () => query, not: () => query,
      update: value => { operation = 'update'; patch = value; return query; },
      delete: () => { operation = 'delete'; return query; },
      then: resolve => {
        const fail = failure === table && (operation === 'update' && (patch.auth_user_id === null || patch.user_id === null || patch.closed_by === null)
          || table === 'trip_participants' && operation === 'delete' && filters.some(([key]) => key === 'trip_id'));
        let data = [];
        if (shared && !pageStart && operation === 'select' && table === 'trip_groups') data = [{ id: 'shared-trip', closed_by: 'other' }];
        if (shared && operation === 'select' && table === 'trip_participants') data = [{ auth_user_id: 'successor' }];
        return Promise.resolve(resolve({ data, error: fail ? { message: 'injected failure' } : null }));
      },
    };
    return query;
  } };
}

it.each([['trip_members', false], ['asset_owners', false], ['trip_groups', false], ['trip_members', true], ['trip_participants', true]])('stops before Auth deletion on %s failure, shared=%s', async (table, shared) => {
  const admin = client(table, shared);
  await expect(purgeAccount(admin, 'synthetic-user')).rejects.toThrow('injected failure');
  expect(admin.auth.admin.deleteUser).not.toHaveBeenCalled();
});

it('still deletes Auth last when cleanup succeeds', async () => {
  const admin = client(null);
  await expect(purgeAccount(admin, 'synthetic-user')).resolves.toMatchObject({ storageObjectsRemoved: 0 });
  expect(admin.auth.admin.deleteUser).toHaveBeenCalledWith('synthetic-user');
});

it('persists the checkpoint before deleting Auth', async () => {
  const admin = client(null);
  const checkpoint = vi.fn(async () => { expect(admin.auth.admin.deleteUser).not.toHaveBeenCalled(); });
  await purgeAccount(admin, 'synthetic-user', checkpoint);
  expect(checkpoint).toHaveBeenCalledOnce();
  expect(admin.auth.admin.deleteUser).toHaveBeenCalledOnce();
});

it('does not delete Auth if checkpoint persistence fails', async () => {
  const admin = client(null);
  await expect(purgeAccount(admin, 'synthetic-user', async () => { throw new Error('checkpoint unavailable'); })).rejects.toThrow('checkpoint unavailable');
  expect(admin.auth.admin.deleteUser).not.toHaveBeenCalled();
});

function largeDocumentClient(total) {
  const admin = client(null);
  const originalFrom = admin.from;
  admin.storage = { from: () => ({ remove: vi.fn(async () => ({ error: null })) }) };
  admin.from = table => {
    if (table !== 'documents') return originalFrom(table);
    const query = { select: () => query, eq: () => query, order: () => query, delete: () => originalFrom(table).delete(),
      range: async (from, to) => ({ data: Array.from({ length: Math.max(0, Math.min(to + 1, total) - from) }, (_, index) => ({ id: from + index })), error: null }) };
    return query;
  };
  return admin;
}

it('stops the purge before Auth when the document inventory exceeds its safety limit', async () => {
  const admin = largeDocumentClient(50001);
  await expect(purgeAccount(admin, 'synthetic-user')).rejects.toThrow('documents: row limit exceeded');
  expect(admin.auth.admin.deleteUser).not.toHaveBeenCalled();
});

it('accepts an inventory exactly at the limit after checking the following page', async () => {
  await expect(removeAccountStorage(largeDocumentClient(50000), 'synthetic-user')).resolves.toBe(0);
});

function storageRecords(bucket, path) {
  const remove = vi.fn(async () => ({ error: null }));
  const createSignedUrl = vi.fn(async () => ({ data: { signedUrl: 'https://example.invalid/signed' }, error: null }));
  return { remove, createSignedUrl, admin: {
    from: table => {
      const data = table === 'documents' || table === 'inbox_items' && bucket === 'inbox-documents' ? [{ id: table, storage_bucket: bucket, storage_path: path }] : [];
      const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: null, error: null }), order: () => query, range: async from => ({ data: data.slice(from), error: null }) };
      return query;
    }, storage: { from: () => ({ remove, createSignedUrl }) },
  } };
}

it.each([
  ['personal-documents', 'other-user/document/file.pdf'],
  ['personal-documents', 'synthetic-user-other/document/file.pdf'],
  ['app-downloads', 'synthetic-user/document/file.pdf'],
  ['inbox-documents', 'whatsapp/other-user/message.pdf'],
  ['personal-documents', 'synthetic-user/../other-user/file.pdf'],
  ['personal-documents', 'synthetic-user/%2e%2e/file.pdf'],
  ['personal-documents', 'synthetic-user/folder\\file.pdf'],
])('refuses an untrusted Storage reference %s / %s before any removal', async (bucket, path) => {
  const { admin, remove } = storageRecords(bucket, path);
  await expect(removeAccountStorage(admin, 'synthetic-user')).rejects.toThrow('Storage path denied');
  expect(remove).not.toHaveBeenCalled();
});

it.each([
  ['personal-documents', 'synthetic-user/document/file.pdf'],
  ['inbox-documents', 'whatsapp/synthetic-user/message.pdf'],
])('accepts the account upload format %s and deduplicates linked inbox files', async (bucket, path) => {
  const { admin, remove } = storageRecords(bucket, path);
  await expect(removeAccountStorage(admin, 'synthetic-user')).resolves.toBe(1);
  expect(remove).toHaveBeenCalledExactlyOnceWith([path]);
});

it('does not sign a foreign file through the account export', async () => {
  const { admin, createSignedUrl } = storageRecords('personal-documents', 'other-user/document/file.pdf');
  await expect(collectAccountData(admin, 'synthetic-user', undefined)).rejects.toThrow('Storage path denied');
  expect(createSignedUrl).not.toHaveBeenCalled();
});

it('continues past capped inventory pages in stable order before removing any files', async () => {
  const remove = vi.fn(async () => ({ error: null }));
  const paths = ['one.pdf', 'two.pdf', 'three.pdf'].map(name => `synthetic-user/document/${name}`);
  const paginate = vi.fn(async from => ({ data: paths.slice(from, from + 1).map(storage_path => ({ id: storage_path, storage_path, storage_bucket: 'personal-documents' })), error: null }));
  const order = vi.fn(() => query);
  const query = { select: () => query, eq: () => query, order, range: paginate };
  const admin = client(null);
  const from = admin.from;
  admin.from = table => table === 'documents' ? query : from(table);
  admin.storage = { from: () => ({ remove }) };
  await expect(removeAccountStorage(admin, 'synthetic-user')).resolves.toBe(3);
  expect(paginate.mock.calls.map(([offset]) => offset)).toEqual([0, 1, 2, 3]);
  expect(order).toHaveBeenCalledWith('id', { ascending: true });
  expect(remove).toHaveBeenCalledExactlyOnceWith(paths);
});

it('stops before any file removal if a stable inventory returns a repeated row', async () => {
  const remove = vi.fn(async () => ({ error: null }));
  const row = { id: 'doc-1', storage_path: 'synthetic-user/document/one.pdf', storage_bucket: 'personal-documents' };
  const query = { select: () => query, eq: () => query, order: () => query,
    range: async from => ({ data: from < 2 ? [row] : [], error: null }) };
  const admin = client(null);
  const from = admin.from;
  admin.from = table => table === 'documents' ? query : from(table);
  admin.storage = { from: () => ({ remove }) };
  await expect(removeAccountStorage(admin, 'synthetic-user')).rejects.toThrow('documents: unstable account inventory');
  expect(remove).not.toHaveBeenCalled();
});
