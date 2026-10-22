import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import zlib from 'node:zlib';

// A cold, anonymous, compiled journey; not authenticated TTI or a real device benchmark.
process.env.PLAYWRIGHT_BROWSERS_PATH ||= '.ms-playwright';
const { chromium } = await import('playwright');
const dist = path.resolve('dist');
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const file = path.resolve(dist, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(dist + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404).end(); return;
  }
  const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Content-Encoding': 'gzip', 'Cache-Control': 'no-store' });
  res.end(zlib.gzipSync(fs.readFileSync(file)));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch();
const reports = [];
try {
  for (const profile of [{ name: 'desktop', width: 1440, cpu: 1 }, { name: 'mobile-simulated', width: 390, cpu: 4 }]) {
    const context = await browser.newContext({ viewport: { width: profile.width, height: 900 }, serviceWorkers: 'block' });
    const page = await context.newPage();
    const session = await context.newCDPSession(page);
    await session.send('Network.enable');
    await session.send('Network.setCacheDisabled', { cacheDisabled: true });
    await session.send('Performance.enable');
    await session.send('Emulation.setCPUThrottlingRate', { rate: profile.cpu });
    if (profile.cpu > 1) await session.send('Network.emulateNetworkConditions', { offline: false, latency: 40, downloadThroughput: 1_250_000, uploadThroughput: 625_000 });
    const requests = new Map();
    const errors = [];
    session.on('Network.requestWillBeSent', e => requests.set(e.requestId, { url: e.request.url, type: e.type, status: null, decodedBytes: 0, transferredBytes: 0 }));
    session.on('Network.responseReceived', e => requests.set(e.requestId, { url: e.response.url, type: e.type, status: e.response.status, decodedBytes: 0, transferredBytes: 0 }));
    session.on('Network.dataReceived', e => { const r = requests.get(e.requestId); if (r) r.decodedBytes += e.dataLength; });
    session.on('Network.loadingFinished', e => { const r = requests.get(e.requestId); if (r) { r.transferredBytes = e.encodedDataLength; r.finished = true; } });
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/?freeze=1`, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => window.__tbBootReady === true, { timeout: 30000 });
    await page.waitForTimeout(1500); // same observation window for deferred KPI imports in both profiles
    const timings = await page.evaluate(() => ({ legacyReadyMs: performance.getEntriesByName('tb:legacy-ready')[0]?.startTime, authVisible: !!document.querySelector('#auth-email') && getComputedStyle(document.querySelector('#auth-overlay')).display !== 'none' }));
    const metrics = Object.fromEntries((await session.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
    const resources = [...requests.values()];
    const scripts = resources.filter(r => r.type === 'Script');
    const report = { profile, ...timings, scriptExecutionMs: metrics.ScriptDuration * 1000, scripts: scripts.length, scriptDecodedKiB: scripts.reduce((n, r) => n + r.decodedBytes, 0) / 1024, transferredKiB: resources.reduce((n, r) => n + r.transferredBytes, 0) / 1024, errors, resources };
    reports.push(report);
    // Size/request gates are deterministic; timings are recorded, not hardware-dependent CI gates.
    if (!timings.authVisible || errors.length || scripts.some(r => !r.finished || r.status !== 200 || new URL(r.url).hostname !== '127.0.0.1') || report.scriptDecodedKiB <= 0 || report.scriptDecodedKiB > 1500 || scripts.length > 60 || scripts.some(r => /apexcharts|echarts/.test(r.url))) throw new Error(`Startup contract failed: ${profile.name}`);
    await context.close();
  }
} finally {
  const output = process.argv[2] || 'test-results/startup.json';
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(reports, null, 2));
  console.log(JSON.stringify(reports.map(({ resources, ...summary }) => summary), null, 2));
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
