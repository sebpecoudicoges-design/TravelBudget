import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('public/legacy/js/27_cashflow_curve.js', 'utf8');
const tick = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
function harness(render = vi.fn()) {
  const frames = [];
  const context = { window: {}, console: { error: vi.fn() }, renderCashflowChart: render, requestAnimationFrame: (cb) => frames.push(cb) };
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('  let _renderWanted'), source.indexOf('  function _segmentBaseForDate')), context);
  return { context, render, frames, request: () => context.queueRenderCashflow(), frame: async () => { await tick(); frames.shift()?.(); await tick(); } };
}

describe('single cashflow render queue', () => {
  it('coalesces synchronous UI, data and theme requests into one frame and one promise', async () => {
    const h = harness();
    const first = h.request();
    for (let i = 0; i < 100; i++) expect(h.request()).toBe(first);
    await tick();
    expect(h.frames).toHaveLength(1);
    await h.frame(); await first;
    expect(h.render).toHaveBeenCalledTimes(1);
  });
  it('never overlaps Apex renders and applies the latest changes after completion without polling', async () => {
    let finish; let filter = 'all'; const seen = [];
    const render = vi.fn(() => { seen.push(filter); return seen.length === 1 ? new Promise((resolve) => { finish = resolve; }) : undefined; });
    const h = harness(render); const done = h.request(); await h.frame();
    filter = 'none'; h.request(); filter = 'food'; h.request();
    await tick(); expect(h.frames).toHaveLength(0); expect(render).toHaveBeenCalledTimes(1);
    finish(); await h.frame(); await done;
    expect(seen).toEqual(['all', 'food']);
  });
  it('does not suppress rapid consecutive filters or a return to the same scope', async () => {
    const h = harness();
    for (let i = 0; i < 3; i++) { const done = h.request(); await h.frame(); await done; }
    expect(h.render).toHaveBeenCalledTimes(3);
  });
  it('defers boot requests until release', async () => {
    const h = harness(); h.context.window.__TB_BOOTING = true;
    await h.request(); expect(h.context.window.__TB_BOOT_NEEDS_CASHFLOW_CURVE).toBe(true);
    expect(h.frames).toHaveLength(0);
    h.context.window.__TB_BOOTING = false;
    const done = h.request(); await h.frame(); await done; expect(h.render).toHaveBeenCalledTimes(1);
  });
  it('reports a rejected render and permits a later retry', async () => {
    const render = vi.fn().mockRejectedValueOnce(new Error('Apex failed')).mockResolvedValue(undefined);
    const h = harness(render); let done = h.request(); await h.frame(); await done;
    expect(h.context.console.error).toHaveBeenCalledTimes(1);
    done = h.request(); await h.frame(); await done; expect(render).toHaveBeenCalledTimes(2);
  });
  it('routes both public entry points through the queue and removes obsolete cache and hooks', () => {
    expect(source).toContain('window.renderCashflowChart = queueRenderCashflow;');
    expect(source).toContain('window.tbRequestCashflowCurveRender = queueRenderCashflow;');
    for (const dead of ['_cashflowCache', 'tb_cashflow_cache_v1', 'hookRedrawCharts', 'hookRefreshAll', '__lastTs', 'let lastKey', '_runQueuedRender']) expect(source).not.toContain(dead);
  });
});
