import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import zlib from 'node:zlib';
import { installConnectedFixture, fixtureUser, transactionCount } from './fixtures/connectedStartup.mjs';

// Cold compiled journeys; connected uses synthetic HTTP, not a live account or TTI.
process.env.PLAYWRIGHT_BROWSERS_PATH ||= '.ms-playwright';
const { chromium } = await import('playwright');
const dist = path.resolve('dist');
const output = process.argv[2] || 'test-results/startup.json';
const captureCpu = process.env.TB_CPU_PROFILE === '1';
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
let browser;
const reports = [];
try {
  browser = await chromium.launch();
  for (const journey of ['anonymous', 'connected-fixture']) for (const profile of [{ name: 'desktop', width: 1440, cpu: 1 }, { name: 'mobile-simulated', width: 390, cpu: 4 }]) {
    const context = await browser.newContext({ viewport: { width: profile.width, height: 900 }, serviceWorkers: 'block' });
    const page = await context.newPage();
    const localOrigin = `http://127.0.0.1:${server.address().port}`;
    const fixture = journey === 'connected-fixture' ? await installConnectedFixture(page, localOrigin) : null;
    const unexpectedRequests = [];
    if (!fixture) {
      await page.route('**/*', route => {
        if (new URL(route.request().url()).origin === localOrigin) return route.continue();
        unexpectedRequests.push(new URL(route.request().url()).origin);
        return route.abort();
      });
      await page.routeWebSocket('**/*', socket => { unexpectedRequests.push('WebSocket'); socket.close(); });
    }
    const session = await context.newCDPSession(page);
    await session.send('Network.enable');
    await session.send('Network.setCacheDisabled', { cacheDisabled: true });
    await session.send('Performance.enable');
    if (captureCpu) {
      await session.send('Profiler.enable');
      await session.send('Profiler.setSamplingInterval', { interval: 1000 });
      await session.send('Profiler.start');
    }
    await session.send('Emulation.setCPUThrottlingRate', { rate: profile.cpu });
    if (profile.cpu > 1) await session.send('Network.emulateNetworkConditions', { offline: false, latency: 40, downloadThroughput: 1_250_000, uploadThroughput: 625_000 });
    const requests = new Map();
    const errors = [];
    session.on('Network.requestWillBeSent', e => requests.set(e.requestId, { url: e.request.url, type: e.type, status: null, decodedBytes: 0, transferredBytes: 0 }));
    session.on('Network.responseReceived', e => requests.set(e.requestId, { url: e.response.url, type: e.type, status: e.response.status, decodedBytes: 0, transferredBytes: 0 }));
    session.on('Network.dataReceived', e => { const r = requests.get(e.requestId); if (r) r.decodedBytes += e.dataLength; });
    session.on('Network.loadingFinished', e => { const r = requests.get(e.requestId); if (r) { r.transferredBytes = e.encodedDataLength; r.finished = true; } });
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${localOrigin}/${fixture ? '' : '?freeze=1'}`, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => window.__tbBootReady === true, null, { timeout: 30000 });
    if (fixture) {
      try {
        await page.waitForFunction(({ fixtureUser, transactionCount }) => {
          const ready = window.__TB_BOOT_COMPLETED__ && window.sbUser?.id === fixtureUser
            && window.activeView === 'dashboard' && window.state?.transactions?.length === transactionCount
            && new Set(window.state.transactions.map(row => row.id)).size === transactionCount
            && window.state?.wallets?.length === 1 && window.__cashflowChart
            && window.state?.activityDataLoaded && window.state?.nutritionKpiDataLoaded
            && document.querySelector('#cashflowCurve svg')
            && getComputedStyle(document.querySelector('#auth-overlay')).display === 'none';
          if (ready && !performance.getEntriesByName('tb:connected-ready').length) performance.mark('tb:connected-ready');
          return Boolean(ready);
        }, { fixtureUser, transactionCount }, { timeout: 45000 });
      } catch (error) {
        const state = await page.evaluate(() => ({ boot: window.__TB_BOOT_COMPLETED__, user: window.sbUser?.id, view: window.activeView, tx: window.state?.transactions?.length, wallets: window.state?.wallets?.length, chart: Boolean(window.__cashflowChart) }));
        reports.push({ journey, profile, errors, state, fixture });
        throw new Error(`Connected startup failed: ${JSON.stringify({ state, failures: fixture.failures })}`, { cause: error });
      }
    }
    await page.waitForTimeout(1500); // same observation window for deferred KPI imports in both profiles
    if (captureCpu) {
      const { profile: cpuProfile } = await session.send('Profiler.stop');
      fs.mkdirSync(path.dirname(output), { recursive: true });
      fs.writeFileSync(`${output}.${journey}.${profile.name}.cpuprofile`, JSON.stringify(cpuProfile));
    }
    const timings = await page.evaluate(() => ({ legacyReadyMs: performance.getEntriesByName('tb:legacy-ready')[0]?.startTime, connectedReadyMs: performance.getEntriesByName('tb:connected-ready')[0]?.startTime, authVisible: !!document.querySelector('#auth-email') && getComputedStyle(document.querySelector('#auth-overlay')).display !== 'none' }));
    const metrics = Object.fromEntries((await session.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
    const resources = [...requests.values()];
    const scripts = resources.filter(r => r.type === 'Script');
    const report = { journey, profile, ...timings, fixture, unexpectedRequests, scriptExecutionMs: metrics.ScriptDuration * 1000, scripts: scripts.length, scriptDecodedKiB: scripts.reduce((n, r) => n + r.decodedBytes, 0) / 1024, localTransferredKiB: resources.filter(r => new URL(r.url).origin === localOrigin).reduce((n, r) => n + r.transferredBytes, 0) / 1024, fixtureResponseKiB: fixture ? fixture.calls.reduce((n, call) => n + call.responseBytes, 0) / 1024 : 0, errors, resources };
    reports.push(report);
    // Size/request gates are deterministic; timings are recorded, not hardware-dependent CI gates.
    if (!Number.isFinite(timings.legacyReadyMs) || (fixture && (!Number.isFinite(timings.connectedReadyMs) || fixture.calls.length > 40)) || timings.authVisible === Boolean(fixture) || errors.length || unexpectedRequests.length || fixture?.failures.length || scripts.some(r => !r.finished || r.status !== 200 || new URL(r.url).origin !== localOrigin) || report.scriptDecodedKiB <= 0 || report.scriptDecodedKiB > (fixture ? 2450 : 1500) || scripts.length > 60 || scripts.some(r => (fixture ? /echarts/ : /apexcharts|echarts/).test(r.url))) throw new Error(`Startup contract failed: ${journey}/${profile.name}`);
    await context.close();
  }
} finally {
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(reports, null, 2));
  console.log(JSON.stringify(reports.map(({ resources, fixture, ...summary }) => ({ ...summary, ...(fixture ? { fixtureCalls: fixture.calls.length, fixtureFailures: fixture.failures } : {}) })), null, 2));
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
