import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { installConnectedFixture, fixtureLogin, fixtureUser, transactionCount } from './fixtures/connectedStartup.mjs';

// Cold compiled journeys; connected uses synthetic HTTP, not a live account or TTI.
process.env.PLAYWRIGHT_BROWSERS_PATH ||= '.ms-playwright';
const { chromium } = await import('playwright');
const dist = path.resolve('dist');
const output = process.argv[2] || 'test-results/startup.json';
const captureCpu = process.env.TB_CPU_PROFILE === '1';
const reportOnlyCsp = process.env.TB_AUDIT_CSP_REPORT_ONLY === '1'
  ? execFileSync('python3', ['scripts/audit-web/check-csp-staging.py', '--print-global-report-only'], { encoding: 'utf8' }).trim()
  : null;
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const file = path.resolve(dist, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(dist + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404).end(); return;
  }
  const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
  if (reportOnlyCsp && pathname === '/') res.setHeader('Content-Security-Policy-Report-Only', reportOnlyCsp);
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Content-Encoding': 'gzip', 'Cache-Control': 'no-store' });
  res.end(zlib.gzipSync(fs.readFileSync(file)));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
const reports = [];
try {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined });
  const profiles = [
    { name: 'desktop', width: 1440, cpu: 1, touch: false, deviceScaleFactor: 1 },
    { name: 'mobile-simulated', width: 390, cpu: 4, touch: true, deviceScaleFactor: 2 },
  ];
  for (const journey of ['anonymous', 'connected-fixture', 'signin-fixture']) for (const profile of profiles) {
    const context = await browser.newContext({
      viewport: { width: profile.width, height: 900 }, serviceWorkers: 'block',
      isMobile: profile.touch, hasTouch: profile.touch, deviceScaleFactor: profile.deviceScaleFactor,
    });
    const page = await context.newPage();
    await page.addInitScript(() => {
      if (!globalThis.PerformanceObserver?.supportedEntryTypes.includes('longtask')) return;
      const stats = { count: 0, totalMs: 0, longestMs: 0 };
      window.__tbStartupLongTasks = stats;
      new PerformanceObserver(list => {
        for (const { duration } of list.getEntries()) {
          stats.count++;
          stats.totalMs += duration;
          stats.longestMs = Math.max(stats.longestMs, duration);
        }
      }).observe({ type: 'longtask', buffered: true });
    });
    if (reportOnlyCsp) await page.addInitScript(() => {
      const counts = Object.create(null);
      window.__tbAuditCspCounts = counts;
      document.addEventListener('securitypolicyviolation', ({ effectiveDirective, disposition }) => {
        const key = disposition + ':' + effectiveDirective;
        counts[key] = (counts[key] || 0) + 1;
      });
    });
    const localOrigin = `http://127.0.0.1:${server.address().port}`;
    const fromForm = journey === 'signin-fixture';
    const fixture = journey === 'anonymous' ? null : await installConnectedFixture(page, localOrigin, { seedSession: !fromForm });
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
    session.on('Network.loadingFailed', e => { const r = requests.get(e.requestId); if (r) r.loadError = e.errorText; });
    page.on('pageerror', e => errors.push(e.message));
    let stage = 'navigation';
    try {
      const response = await page.goto(`${localOrigin}/`, { waitUntil: 'load', timeout: 60000 });
      if (reportOnlyCsp && (response?.headers()['content-security-policy-report-only'] !== reportOnlyCsp
        || response.headers()['content-security-policy'])) throw new Error('Unexpected startup CSP headers');
      stage = 'legacy-ready';
      await page.waitForFunction(() => window.__tbBootReady === true, null, { timeout: 30000 });
      if (!fixture || fromForm) {
        stage = 'anonymous-ready';
        await page.waitForFunction(() => {
          const overlay = document.querySelector('#auth-overlay');
          const email = document.querySelector('#auth-email');
          const ready = window.__TB_BOOT_COMPLETED__ === true && !window.sbUser
            && overlay && getComputedStyle(overlay).display !== 'none'
            && email && !email.disabled && email.getClientRects().length > 0;
          if (ready && !performance.getEntriesByName('tb:anonymous-ready').length) performance.mark('tb:anonymous-ready');
          return Boolean(ready);
        }, null, { timeout: 30000 });
        // Check actionability, not just styles: the boot overlay must not intercept input.
        stage = 'anonymous-actionable';
        await page.locator('#auth-email').click({ trial: true, timeout: 5000 });
      }
      if (fromForm) {
        stage = 'signin-submit';
        await page.evaluate(() => {
          document.addEventListener('submit', event => {
            if (event.target?.matches('.auth-form')) performance.mark('tb:signin-submitted');
          }, { capture: true });
        });
        await page.locator('#auth-email').fill(fixtureLogin.email);
        await page.locator('#auth-pass').fill(fixtureLogin.password);
        await page.locator('#auth-submit').click();
      }
      if (fixture) {
        stage = 'connected-ready';
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
      }
    } catch (error) {
      // Preserve the first failing profile; diagnostics must not mask its original error.
      const state = await page.evaluate(() => {
        const overlay = document.querySelector('#auth-overlay');
        const email = document.querySelector('#auth-email');
        return {
          legacyReady: window.__tbBootReady === true,
          bootCompleted: window.__TB_BOOT_COMPLETED__ === true,
          signedIn: Boolean(window.sbUser),
          view: window.activeView,
          transactions: window.state?.transactions?.length,
          wallets: window.state?.wallets?.length,
          chart: Boolean(window.__cashflowChart),
          authVisible: Boolean(overlay && getComputedStyle(overlay).display !== 'none'),
          emailVisible: Boolean(email?.getClientRects().length),
          emailEnabled: Boolean(email && !email.disabled),
        };
      }).catch(() => null);
      reports.push({ journey, profile, failure: { stage, name: error.name }, state, errors, fixture, unexpectedRequests, resources: [...requests.values()] });
      throw new Error(`Startup failed: ${journey}/${profile.name} at ${stage}`, { cause: error });
    }
    await page.waitForTimeout(1500); // same observation window for deferred KPI imports in all profiles
    if (captureCpu) {
      const { profile: cpuProfile } = await session.send('Profiler.stop');
      fs.mkdirSync(path.dirname(output), { recursive: true });
      fs.writeFileSync(`${output}.${journey}.${profile.name}.cpuprofile`, JSON.stringify(cpuProfile));
    }
    const timings = await page.evaluate(() => {
      const submitted = performance.getEntriesByName('tb:signin-submitted')[0]?.startTime;
      const connected = performance.getEntriesByName('tb:connected-ready')[0]?.startTime;
      return {
        legacyReadyMs: performance.getEntriesByName('tb:legacy-ready')[0]?.startTime,
        anonymousReadyMs: performance.getEntriesByName('tb:anonymous-ready')[0]?.startTime,
        connectedReadyMs: connected,
        signinToDashboardMs: submitted === undefined || connected === undefined ? undefined : connected - submitted,
        authVisible: !!document.querySelector('#auth-email') && getComputedStyle(document.querySelector('#auth-overlay')).display !== 'none',
        touchPoints: navigator.maxTouchPoints,
        startupLongTasks: window.__tbStartupLongTasks || null,
        ...(window.__tbAuditCspCounts ? { cspPolicyEvents: window.__tbAuditCspCounts } : {}),
      };
    });
    const metrics = Object.fromEntries((await session.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
    const resources = [...requests.values()];
    const scripts = resources.filter(r => r.type === 'Script');
    const report = { journey, profile, ...timings, fixture, unexpectedRequests, scriptExecutionMs: metrics.ScriptDuration * 1000, scripts: scripts.length, scriptDecodedKiB: scripts.reduce((n, r) => n + r.decodedBytes, 0) / 1024, localTransferredKiB: resources.filter(r => new URL(r.url).origin === localOrigin).reduce((n, r) => n + r.transferredBytes, 0) / 1024, fixtureResponseKiB: fixture ? fixture.calls.reduce((n, call) => n + call.responseBytes, 0) / 1024 : 0, errors, resources };
    reports.push(report);
    if (fromForm && (!(timings.signinToDashboardMs > 0) || !Number.isFinite(timings.anonymousReadyMs)
        || fixture.calls.filter(call => call.path === '/auth/v1/token').length !== 1)) {
      throw new Error(`Expected exactly one form sign-in: ${profile.name}`);
    }
    if ((timings.touchPoints > 0) !== profile.touch) throw new Error(`Unexpected input mode: ${profile.name}`);
    // Size/request gates are deterministic; timings and long tasks are recorded, not hardware-dependent CI gates.
    if (!Number.isFinite(timings.legacyReadyMs) || (fixture ? (!Number.isFinite(timings.connectedReadyMs) || fixture.calls.length > 40) : !Number.isFinite(timings.anonymousReadyMs)) || timings.authVisible === Boolean(fixture) || errors.length || unexpectedRequests.length || fixture?.failures.length || scripts.some(r => !r.finished || r.status !== 200 || new URL(r.url).origin !== localOrigin) || report.scriptDecodedKiB <= 0 || report.scriptDecodedKiB > (fixture ? 2450 : 1500) || scripts.length > 60 || scripts.some(r => (fixture ? /echarts/ : /apexcharts|echarts/).test(r.url))) throw new Error(`Startup contract failed: ${journey}/${profile.name}`);
    await context.close();
  }
} finally {
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(reports, null, 2));
  console.log(JSON.stringify(reports.map(({ resources, fixture, ...summary }) => ({ ...summary, ...(fixture ? { fixtureCalls: fixture.calls.length, fixtureFailures: fixture.failures } : {}) })), null, 2));
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
