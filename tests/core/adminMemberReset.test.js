import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const source = readFileSync(new URL('../../public/legacy/js/30_members_admin.js', import.meta.url), 'utf8');
const users = [{ id: 'member-one' }, { id: 'member-two' }];
const wipeUrl = 'https://supabase-fixture.invalid/functions/v1/admin-wipe-user';

function fixture(lang, reply) {
  const list = { innerHTML: '' };
  const status = { textContent: '' };
  const fetch = vi.fn(async (url) => {
    if (url === wipeUrl) return reply();
    if (url.endsWith('/admin-list-users')) return new Response(JSON.stringify({ users }));
    throw new Error('Unexpected request');
  });
  const prompt = vi.fn(() => 'WIPE');
  const alert = vi.fn();
  const vm = runInNewContext(source + `
    __membersCache.users = users;
    renderUsers();
    ({ run: adminWipeUser, refresh: adminRefreshUsers })
  `, {
    users, fetch, prompt, alert, console: { error: vi.fn() },
    document: {
      documentElement: { lang },
      getElementById: id => ({ 'admin-users-list': list, 'admin-users-status': status })[id],
    },
    sb: {
      supabaseUrl: 'https://supabase-fixture.invalid',
      supabaseKey: 'fixture',
      auth: {
        getUser: async () => ({ data: { user: { id: 'admin' } } }),
        getSession: async () => ({ data: { session: { access_token: 'fixture' } } }),
      },
    },
  });
  return { ...vm, list, status, alert, prompt, fetch, requests: () => fetch.mock.calls.filter(([url]) => url === wipeUrl) };
}

describe.each([
  ['fr', 'Vider compte', 'Réinitialisation non confirmée', 'Ne relancez pas', 'Réinitialisation confirmée.'],
  ['en', 'Reset account', 'Reset not confirmed', 'Do not retry', 'Reset confirmed.'],
])('Members reset (%s)', (lang, button, uncertainty, warning, confirmation) => {
  it.each([
    ['HTTP failure', () => new Response(JSON.stringify({ error: 'fixture constraint failure' }), { status: 500 })],
    ['transport failure', () => Promise.reject(new TypeError('connection lost'))],
    ['negative reply', () => new Response(JSON.stringify({ success: false, message: 'incorrect success-looking copy' }))],
    ['unreadable reply', () => new Response('<html>unknown</html>')],
  ])('requires certainty after %s, even after refreshing the member list', async (_, reply) => {
    const f = fixture(lang, reply);
    expect(f.list.innerHTML).toContain(button);
    await f.run('member-one');
    expect(f.alert).toHaveBeenCalledTimes(1);
    expect(f.alert.mock.calls[0][0]).toContain(uncertainty);
    expect(f.status.textContent).toContain(warning);
    await f.refresh();
    expect(f.list.innerHTML).toContain('disabled aria-describedby="member-reset-warning-member-one"');
    expect(f.list.innerHTML).not.toContain('disabled aria-describedby="member-reset-warning-member-two"');
    expect(f.list.innerHTML).toContain(warning);
    await f.run('member-one', '', 'travel');
    expect(f.requests()).toHaveLength(1);
    expect(f.prompt).toHaveBeenCalledTimes(1);
    expect(f.status.textContent).toContain(warning);
  });

  it('keeps only one request in flight and confirms only explicit success', async () => {
    const f = fixture(lang, () => new Response(JSON.stringify({ success: true })));
    await Promise.all([f.run('member-one'), f.run('member-one')]);
    expect(f.requests()).toHaveLength(1);
    expect(f.prompt).toHaveBeenCalledTimes(1);
    expect(f.alert).toHaveBeenCalledExactlyOnceWith(confirmation);
    expect(f.list.innerHTML).not.toContain('member-reset-warning-');
  });

  it('cancellation sends nothing and does not impose a warning', async () => {
    const f = fixture(lang, () => { throw new Error('Unexpected request'); });
    f.prompt.mockReturnValue(null);
    await f.run('member-one');
    expect(f.requests()).toHaveLength(0);
    expect(f.alert).not.toHaveBeenCalled();
    expect(f.list.innerHTML).not.toContain('member-reset-warning-');
  });
});
