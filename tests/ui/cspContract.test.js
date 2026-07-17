import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('CSP contract', () => {
  const netlify = fs.readFileSync('netlify.toml', 'utf8');
  const serviceWorker = fs.readFileSync('public/sw.js', 'utf8');

  it('allows service worker CDN refreshes in connect-src report-only policy', () => {
    expect(serviceWorker).toContain('fetch(url, { cache: "no-store" })');
    expect(netlify).toContain('Content-Security-Policy-Report-Only');
    expect(netlify).toContain('connect-src');
    expect(netlify).toContain('https://cdn.jsdelivr.net');
  });
});
