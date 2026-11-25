import { expect, it, vi } from 'vitest';
vi.mock('npm:@supabase/supabase-js@2.57.4', () => ({ createClient: vi.fn() }));
import { collectAccountData, purgeAccount, removeAccountStorage } from '../../supabase/functions/_shared/account-data.ts';

const emptyList = async () => ({ data: [], error: null });

function client(failure, shared = false) {
  const deleteUser = vi.fn(async () => ({ error: null }));
  return { auth: { admin: { deleteUser } }, rpc: vi.fn(async () => ({ data: 0, error: null })), storage: { from: () => ({ list: emptyList }) }, from: table => {
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
        return Promise.resolve(resolve({ data, count: 0, error: fail ? { message: 'injected failure' } : null }));
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
  admin.storage = { from: () => ({ list: emptyList, remove: vi.fn(async () => ({ error: null })) }) };
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
    }, storage: { from: () => ({ list: emptyList, remove, createSignedUrl }) },
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
  admin.storage = { from: () => ({ list: emptyList, remove }) };
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
  admin.storage = { from: () => ({ list: emptyList, remove }) };
  await expect(removeAccountStorage(admin, 'synthetic-user')).rejects.toThrow('documents: unstable account inventory');
  expect(remove).not.toHaveBeenCalled();
});


it('clears referenced and unreferenced files under the account folders while leaving a neighboring account untouched', async () => {
  const admin = client(null);
  const files = {
    'personal-documents': new Set(['synthetic-user/a/receipt.pdf', 'synthetic-user/a/draft.pdf', 'neighbor/a/receipt.pdf']),
    'inbox-documents': new Set(['whatsapp/synthetic-user/receipt.pdf']),
  };
  const list = vi.fn(async (bucket, prefix, { offset }) => {
    const children = new Map();
    for (const key of files[bucket]) {
      if (!key.startsWith(prefix + '/')) continue;
      const remainder = key.slice(prefix.length + 1);
      const [name, ...rest] = remainder.split('/');
      children.set(name, { name, id: rest.length ? null : key });
    }
    // Deliberately use capped one-item pages to verify offsets are advanced by actual length.
    return { data: [...children.values()].sort((x, y) => x.name.localeCompare(y.name)).slice(offset, offset + 1), error: null };
  });
  const remove = vi.fn(async (bucket, paths) => {
    for (const path of paths) files[bucket].delete(path);
    return { error: null };
  });
  admin.storage = { from: bucket => ({ list: (...args) => list(bucket, ...args), remove: paths => remove(bucket, paths) }) };
  await expect(removeAccountStorage(admin, 'synthetic-user')).resolves.toBe(3);
  expect([...files['personal-documents']]).toEqual(['neighbor/a/receipt.pdf']);
  expect([...files['inbox-documents']]).toEqual([]);
  expect(list.mock.calls.every(([bucket, path]) => path.startsWith(bucket === 'inbox-documents' ? 'whatsapp/synthetic-user' : 'synthetic-user'))).toBe(true);
});

it('keeps the checkpoint and Auth untouched if Storage still reports a file after removal', async () => {
  const admin = client(null);
  admin.storage = { from: bucket => ({
    list: async (_prefix, { offset }) => ({
      data: offset || bucket !== 'personal-documents' ? [] : [{ id: 'fixture-file', name: 'receipt.pdf' }], error: null,
    }),
    remove: async () => ({ error: null }),
  }) };
  const checkpoint = vi.fn();
  await expect(purgeAccount(admin, 'synthetic-user', checkpoint)).rejects.toThrow('account inventory not empty');
  expect(checkpoint).not.toHaveBeenCalled();
  expect(admin.auth.admin.deleteUser).not.toHaveBeenCalled();
});


it('counts deletes without assuming an id column on tables such as assistant_request_quota', async () => {
  const admin = client(null);
  const from = admin.from;
  const select = vi.fn(() => { throw new Error('quota has no id column'); });
  const eq = vi.fn(async () => ({ count: 7, error: null }));
  const remove = vi.fn(() => ({ eq, select }));
  admin.from = table => table === 'assistant_request_quota' ? { delete: remove } : from(table);
  const result = await purgeAccount(admin, 'synthetic-user');
  expect(result.deletedRows.assistant_request_quota).toBe(7);
  expect(remove).toHaveBeenCalledWith({ count: 'exact' });
  expect(eq).toHaveBeenCalledWith('user_id', 'synthetic-user');
  expect(select).not.toHaveBeenCalled();
});


it('uses the atomic wallet cleanup before checkpoint and Auth deletion', async () => {
  const admin = client(null);
  admin.rpc.mockResolvedValue({ data: 2, error: null });
  const checkpoint = vi.fn(async () => {
    expect(admin.rpc).toHaveBeenCalledExactlyOnceWith('purge_account_wallet_transactions', { p_user_id: 'synthetic-user' });
  });
  const result = await purgeAccount(admin, 'synthetic-user', checkpoint);
  expect(result.deletedRows.transactions).toBe(2);
  expect(checkpoint).toHaveBeenCalledOnce();
});

it('does not reach the checkpoint or Auth when wallet cleanup fails', async () => {
  const admin = client(null);
  admin.rpc.mockResolvedValue({ error: new Error('fixture wallet cleanup unavailable') });
  const checkpoint = vi.fn();
  await expect(purgeAccount(admin, 'synthetic-user', checkpoint)).rejects.toThrow('fixture wallet cleanup unavailable');
  expect(checkpoint).not.toHaveBeenCalled();
  expect(admin.auth.admin.deleteUser).not.toHaveBeenCalled();
});
