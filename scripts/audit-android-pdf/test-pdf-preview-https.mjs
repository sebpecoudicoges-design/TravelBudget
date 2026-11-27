import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { request } from 'node:https';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { makePdfFixtureServer } from './pdf_preview_https.mjs';

test('isolated PDF fixture validates TLS and serves only explicit document paths', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'tb-pdf-tls-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const keyFile = join(dir, 'test.key');
  const certFile = join(dir, 'test.crt');
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-subj', '/CN=TravelBudget PDF Fixture',
    '-addext', 'subjectAltName=IP:127.0.0.1', '-keyout', keyFile, '-out', certFile], { stdio: 'ignore' });
  const cert = readFileSync(certFile);
  const output = join(dir, 'site');
  execFileSync(process.execPath, ['scripts/audit-android-pdf/pdf_preview_fixture.mjs', 'src/features/documents/documentView.js', output, 'https']);
  const pdf = readFileSync(join(output, 'audit-document.pdf'));
  const html = readFileSync(join(output, 'index.html'), 'utf8');
  assert.match(html, /frame-src https:\/\/127\.0\.0\.1:8443;/);
  assert.match(html, /<iframe src="https:\/\/127\.0\.0\.1:8443\/audit-document\.pdf\?token=fixture-only"/);
  const entries = [];
  const server = makePdfFixtureServer({ cert, key: readFileSync(keyFile), pdf, observe: entry => entries.push(entry) });
  t.after(() => { server.closeAllConnections(); server.close(); });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const get = (path, { ca = cert, method = 'GET', headers } = {}) => new Promise((resolve, reject) => {
    request({ hostname: '127.0.0.1', port: server.address().port, path, ca, method, headers }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.once('error', reject);
      res.once('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    }).once('error', reject).end();
  });
  const url = '/audit-document.pdf?token=fixture-only';
  await assert.rejects(get(url, { ca: null }), { code: 'DEPTH_ZERO_SELF_SIGNED_CERT' });
  assert.equal((await get('/audit-document.pdf')).status, 404);
  assert.equal((await get(url, { method: 'POST' })).status, 404);
  const inline = await get(url);
  assert.equal(inline.status, 200);
  assert.equal(inline.headers['content-type'], 'application/pdf');
  assert.match(inline.headers['content-disposition'], /^inline;/);
  assert.deepEqual(inline.body, pdf);
  const download = await get(url + '&download=1');
  assert.equal(download.status, 200);
  assert.match(download.headers['content-disposition'], /^attachment;/);
  assert.deepEqual(download.body, pdf);
  const range = await get(url, { headers: { Range: 'bytes=0-7' } });
  assert.equal(range.status, 206);
  assert.equal(range.headers['content-range'], `bytes 0-7/${pdf.length}`);
  assert.deepEqual(range.body, pdf.subarray(0, 8));
  assert.equal((await get(url, { headers: { Range: 'bytes=999999-' } })).status, 416);
  const head = await get(url, { method: 'HEAD' });
  assert.equal(Number(head.headers['content-length']), pdf.length);
  assert.equal(head.body.length, 0);
  assert.deepEqual(entries.map(x => [x.mode, x.method, x.status]), [
    ['inline', 'GET', 200], ['attachment', 'GET', 200], ['inline', 'GET', 206], ['inline', 'HEAD', 200],
  ]);
});
