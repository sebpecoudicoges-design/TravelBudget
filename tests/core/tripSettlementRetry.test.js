import fs from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import { buildTripSettlementRpcArgs } from '../../src/core/tripRules.js';

const source = fs.readFileSync('public/legacy/js/29_trip_v1.js', 'utf8');
const code = source.slice(source.indexOf('async function _persistSettlement(wallet'), source.indexOf('  async function _createTrip('));
function harness(apply, refresh = async () => {}) {
  const controls = [{ disabled: false }, { disabled: false }];
  const model = { fromId: 'from', toId: 'to', currency: 'AUD', amount: 180 };
  const context = vm.createContext({
    _settleModalState: model, tripState: { activeTripId: 'trip' },
    crypto: { randomUUID: () => 'request-1' },
    document: { querySelectorAll: () => controls },
    _tripRepository: () => ({ applySettlement: apply }),
    _round2: n => Math.round(n * 100) / 100, _isoToday: () => '2026-10-17',
    _rpcFxSnapshotArgs: () => ({}), window: { tbAfterMutationRefresh: refresh, Core: { tripRules: { buildTripSettlementRpcArgs } } },
    console: { warn: vi.fn() }, toastWarn: vi.fn(),
  });
  vm.runInContext(code, context);
  return { context, controls, model };
}
const wallet = { walletId: 'wallet', walletCurrency: 'AUD', walletAmount: 50 };

describe('Trip settlement retry safety', () => {
  it('sends one request for concurrent clicks and records the entered partial amount', async () => {
    let finish;
    const apply = vi.fn(() => new Promise(resolve => { finish = resolve; }));
    const { context, controls, model } = harness(apply);
    const first = context._persistSettlementWithWallet(wallet);
    const second = context._persistSettlementWithWallet(wallet);
    expect(apply).toHaveBeenCalledTimes(1);
    expect(controls.every(c => c.disabled)).toBe(true);
    expect(apply.mock.calls[0][0].args).toMatchObject({ p_amount: 50, p_wallet_amount: 50, p_event_id: 'request-1' });
    finish('request-1');
    await Promise.all([first, second]);
    expect(model.saved).toBe(true);
    expect(controls.every(c => !c.disabled)).toBe(true);
  });
  it('retries the identical intent after a lost response, without another UUID', async () => {
    const apply = vi.fn().mockRejectedValueOnce(new Error('response lost')).mockResolvedValue('request-1');
    const { context, controls } = harness(apply);
    await expect(context._persistSettlementWithWallet(wallet)).rejects.toThrow('response lost');
    expect(controls.every(c => !c.disabled)).toBe(true);
    await context._persistSettlementWithWallet({ ...wallet, walletAmount: 999 });
    expect(apply.mock.calls[0][0].args).toBe(apply.mock.calls[1][0].args);
    expect(apply.mock.calls[1][0].args.p_wallet_amount).toBe(50);
  });
  it('does not repeat a saved payment when refreshing the screen fails', async () => {
    const apply = vi.fn().mockResolvedValue('request-1');
    const { context } = harness(apply, async () => { throw new Error('refresh offline'); });
    await context._persistSettlementWithWallet(wallet);
    await context._persistSettlementWithWallet(wallet);
    expect(apply).toHaveBeenCalledTimes(1);
    expect(context.toastWarn).toHaveBeenCalledOnce();
  });
  it('uses the same atomic path for settlement without a wallet', async () => {
    const apply = vi.fn().mockResolvedValue('request-1');
    const { context } = harness(apply);
    await context._persistSettlementEventOnly();
    expect(apply.mock.calls[0][0].args).toMatchObject({ p_amount: 180, p_wallet_id: null, p_wallet_amount: null });
  });
});
