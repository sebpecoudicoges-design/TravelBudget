/* =========================
   Transaction FX Snapshot (V6.5)
   - Freezes FX rate used for reporting at the time the transaction exists in DB
   - On each refresh, backfills missing snapshots (best-effort)
   ========================= */

function _baseCurrencyForTx(tx) {
  try {
    const pid = tx?.period_id || tx?.periodId || null;
    if (pid && Array.isArray(state?.periods)) {
      const p = state.periods.find(x => String(x.id) === String(pid));
      const c = p?.baseCurrency || p?.base_currency || p?.currency;
      if (c) return String(c).toUpperCase();
    }
  } catch (_) {}
  // Fallback to date-based segment or current period
  try {
    const ds = String(tx?.date_start || tx?.dateStart || "").slice(0,10);
    const seg = (typeof window.getBudgetSegmentForDate === "function") ? window.getBudgetSegmentForDate(ds) : null;
    const c = seg?.baseCurrency || seg?.base_currency || state?.period?.baseCurrency || state?.period?.base_currency;
    if (c) return String(c).toUpperCase();
  } catch (_) {}
  return "EUR";
}
let _txFxSnapInFlight = false;
let _txFxSnapLastSig = null;

function _txFxSnapSig() {
  try {
    // tie snapshot work to data rev + tx count to avoid repeating in the same session
    const rev = window.__TB_DATA_REV || 0;
    const n = Array.isArray(state?.transactions) ? state.transactions.length : 0;
    return `${rev}:${n}`;
  } catch (_) { return null; }
}

async function ensureTxFxSnapshots(options) {
  try {
    if (!sbUser) return;
    if (window.TB_FREEZE) return;
    if (_txFxSnapInFlight) return;

    const txs = Array.isArray(state.transactions) ? state.transactions : [];
    const pendingAll = txs.filter(t => t && !t.fx_rate_snapshot && !t.fxRateSnapshot);
    if (!pendingAll.length) return;

    const sig = _txFxSnapSig();
    if (sig && sig === _txFxSnapLastSig && !(options && options.force)) return;
    _txFxSnapLastSig = sig;

    _txFxSnapInFlight = true;

    // Keep boot responsive: do small batches. We'll reschedule if still pending.
    const batchSize = Math.max(5, Math.min(15, Number(options?.batchSize) || 10));
    const batch = pendingAll.slice(0, batchSize);

    // Build payloads upfront
    const tasks = batch.map(async (tx) => {
      const ds = String(tx.dateStart || tx.date_start || "").slice(0, 10);
      const base = _baseCurrencyForTx(tx);
      const from = String(tx.currency || base || "").toUpperCase();

      let snap = null;
      try {
        if (typeof window.fxBuildTxSnapshot === "function") {
          snap = window.fxBuildTxSnapshot(from || base, base, ds);
        }
      } catch (_) { snap = null; }
      if (!snap) return { tx, ok: false, reason: "no_snapshot" };

      const payload = {
        fx_rate_snapshot: snap.fx_rate_snapshot,
        fx_source_snapshot: snap.fx_source_snapshot,
        fx_snapshot_at: snap.fx_snapshot_at,
        fx_base_currency_snapshot: snap.fx_base_currency_snapshot,
        fx_tx_currency_snapshot: snap.fx_tx_currency_snapshot,
        updated_at: new Date().toISOString(),
      };

      // Update only if snapshot is still missing (avoid overwriting / avoid a read-before-write)
      const { error } = await sb
        .from(TB_CONST.TABLES.transactions)
        .update(payload)
        .eq("id", tx.id)
        .is("fx_rate_snapshot", null);

      if (error) {
        __errorBus && __errorBus.push && __errorBus.push({ type: "fx_snapshot_update", tx_id: tx.id, error: __errorBus.toPlain(error) });
        return { tx, ok: false, reason: "update_error" };
      }
      return { tx, ok: true };
    });

    // Parallelize to reduce total wall time
    await Promise.allSettled(tasks);

    // If there are still pending snapshots, schedule the next batch in idle time.
    const stillPending = (Array.isArray(state.transactions) ? state.transactions : []).some(t => t && !t.fx_rate_snapshot && !t.fxRateSnapshot);
    if (stillPending && window.TB_DEFER && typeof TB_DEFER.coalesceIdle === "function") {
      TB_DEFER.coalesceIdle("fx:snapshots:continue", () => ensureTxFxSnapshots({ batchSize }), 300);
    }
  } catch (e) {
    __errorBus && __errorBus.push && __errorBus.push({ type: "fx_snapshot_exception", error: __errorBus.toPlain(e) });
  } finally {
    _txFxSnapInFlight = false;
  }
}

// Run snapshots in background, never block UI/boot.
function ensureTxFxSnapshotsDeferred() {
  try {
    if (!sbUser) return;
    if (window.TB_FREEZE) return;
    if (window.TB_DEFER && typeof TB_DEFER.coalesceIdle === "function") {
      TB_DEFER.coalesceIdle("fx:snapshots", async () => {
        try { if (window.TB_PERF && TB_PERF.enabled) TB_PERF.mark("fx:snapshots"); } catch (_) {}
        await ensureTxFxSnapshots({ batchSize: 10 });
        try { if (window.TB_PERF && TB_PERF.enabled) TB_PERF.end("fx:snapshots"); } catch (_) {}
      }, 200);
    } else {
      // fallback
      setTimeout(() => { ensureTxFxSnapshots({ batchSize: 10 }); }, 0);
    }
  } catch (_) {}
}
