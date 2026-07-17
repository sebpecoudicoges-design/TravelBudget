import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('CSP contract', () => {
  const netlify = fs.readFileSync('netlify.toml', 'utf8');
  const serviceWorker = fs.readFileSync('public/sw.js', 'utf8');

  it('does not let the service worker warm up cross-origin CDN resources', () => {
    expect(serviceWorker).toContain('fetch(url, { cache: "no-store" })');
    expect(serviceWorker).toContain('if (url.origin === self.location.origin) return true;');
    expect(serviceWorker).toContain('return false;');
    expect(netlify).toContain('Content-Security-Policy-Report-Only');
    expect(netlify).toContain('connect-src');
    expect(netlify).toContain('https://cdn.jsdelivr.net');
  });
});
