import fs from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

describe('service worker installation', () => {
  it('installs the essential shell when Capacitor rejects favicon.ico', async () => {
    const handlers = {};
    const skipWaiting = vi.fn();
    const addAll = vi.fn(async urls => {
      for (const url of urls) {
        if (url === '/favicon.ico') throw new TypeError('Request failed');
        expect(fs.existsSync(url === '/' ? 'index.html' : url === '/index.html' ? 'index.html' : `public${url}`)).toBe(true);
      }
    });
    vm.runInNewContext(fs.readFileSync('public/sw.js', 'utf8'), {
      self: { addEventListener: (name, handler) => { handlers[name] = handler; }, skipWaiting },
      caches: { open: async () => ({ addAll }) },
    });
    let installing;
    handlers.install({ waitUntil: promise => { installing = promise; } });
    await installing;
    expect(skipWaiting).toHaveBeenCalledOnce();
    expect(addAll.mock.calls[0][0]).toEqual(['/', '/index.html', '/offline.html', '/manifest.webmanifest', '/pwa-icon.svg']);
    const pwa = fs.readFileSync('src/app/pwa.js', 'utf8');
    expect(pwa).not.toContain('"/favicon.ico"');
  });
});
