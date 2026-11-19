import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import vm from 'node:vm';

function harness(id) {
  let callback;
  const close = vi.fn();
  const exchangeCodeForSession = vi.fn().mockResolvedValue({});
  const context = {
    URL, URLSearchParams, console,
    window: { Capacitor: { Plugins: {
      App: { getInfo: async () => ({ id }), addListener: (_, listener) => { callback = listener; } },
      Browser: { close },
    } } },
    sb: { auth: { exchangeCodeForSession, getUser: async () => ({ data: {} }) } },
    sbUser: null,
  };
  vm.runInNewContext(fs.readFileSync('public/legacy/js/03_ui_auth.js', 'utf8'), context);
  context.showAuth = vi.fn();
  context.tbAuthLogError = vi.fn();
  return { context, close, exchangeCodeForSession, callback };
}

describe('Android OAuth package isolation', () => {
  for (const id of ['com.travelbudget.app', 'fr.pecloud.travelbudget']) {
    it(`uses the installed package and accepts its callback: ${id}`, async () => {
      const h = harness(id);
      expect(await h.context.tbMobileAuthRedirectUrl()).toBe(`${id}://auth-callback`);
      await h.callback({ url: `${id}://auth-callback?code=test-code` });
      expect(h.exchangeCodeForSession).toHaveBeenCalledWith('test-code');
      expect(h.close).toHaveBeenCalledOnce();
    });
  }
  it.each([
    'com.travelbudget.app://auth-callback?code=other-package',
    'fr.pecloud.travelbudget://auth-callback.evil?code=bad',
    'fr.pecloud.travelbudget://auth-callback/path?code=bad',
    'fr.pecloud.travelbudget://user@auth-callback?code=bad',
    'https://auth-callback?code=bad',
    'invalid URL',
  ])('ignores unrelated links without closing the browser: %s', async (url) => {
    const h = harness('fr.pecloud.travelbudget');
    await h.callback({ url });
    expect(h.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(h.close).not.toHaveBeenCalled();
    expect(h.context.showAuth).not.toHaveBeenCalled();
  });
  it.each([undefined, 'unexpected.package'])('rejects an unavailable or unknown package: %s', async (id) => {
    await expect(harness(id).context.tbMobileAuthRedirectUrl()).rejects.toThrow('Identifiant Android indisponible');
  });
  it('closes an accepted callback after a failed exchange without logging its tokens', async () => {
    const h = harness('fr.pecloud.travelbudget');
    h.exchangeCodeForSession.mockResolvedValue({ error: new Error('Exchange failed') });
    await h.callback({ url: 'fr.pecloud.travelbudget://auth-callback?code=private-code' });
    expect(h.close).toHaveBeenCalledOnce();
    expect(h.context.showAuth).toHaveBeenCalled();
    expect(JSON.stringify(h.context.tbAuthLogError.mock.calls)).not.toContain('private-code');
  });
});
