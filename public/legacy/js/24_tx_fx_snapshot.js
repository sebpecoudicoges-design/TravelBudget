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
async function ensureTxFxSnapshots() {
  try {
    if (!sbUser) return;
    if (window.TB_FREEZE) return;

    const txs = Array.isArray(state.transactions) ? state.transactions : [];
    const pending = txs.filter(t => t && !t.fx_rate_snapshot && !t.fxRateSnapshot);

    if (!pending.length) return;

    // avoid hammering the API
    const batch = pending.slice(0, 20);

    for (const tx of batch) {
      const ds = String(tx.dateStart || tx.date_start || "").slice(0, 10);
      const base = _baseCurrencyForTx(tx);
      const from = String(tx.currency || "").toUpperCase();
      if (!from || from === base) {
        // identity snapshot
      }

      let snap = null;
      try {
        if (typeof window.fxBuildTxSnapshot === "function") {
          snap = window.fxBuildTxSnapshot(from || base, base, ds);
        }
      } catch (_) {
        snap = null;
      }

      if (!snap) continue;

      // Fetch current snapshot fields from DB to avoid overwriting when state is missing columns
      let current = tx;
      try {
        const { data: cur, error: curErr } = await sb
          .from(TB_CONST.TABLES.transactions)
          .select("fx_rate_snapshot,fx_source_snapshot,fx_snapshot_at,fx_base_currency_snapshot,fx_tx_currency_snapshot")
          .eq("id", tx.id)
          .maybeSingle();
        if (!curErr && cur) current = { ...tx, ...cur };
      } catch (_) {}

      const payload = { updated_at: new Date().toISOString() };
      // Only fill missing snapshot fields; do NOT overwrite once set (DB enforces immutability)
      if (current.fx_rate_snapshot == null) payload.fx_rate_snapshot = snap.fx_rate_snapshot;
      if (current.fx_source_snapshot == null) payload.fx_source_snapshot = snap.fx_source_snapshot;
      if (current.fx_snapshot_at == null) payload.fx_snapshot_at = snap.fx_snapshot_at;
      if (current.fx_base_currency_snapshot == null) payload.fx_base_currency_snapshot = snap.fx_base_currency_snapshot;
      if (current.fx_tx_currency_snapshot == null) payload.fx_tx_currency_snapshot = snap.fx_tx_currency_snapshot;

      // Nothing to do
      const keys = Object.keys(payload);
      if (keys.length <= 1) continue;

      // eslint-disable-next-line no-await-in-loop
      const { error } = await sb
        .from(TB_CONST.TABLES.transactions)
        .update(payload)
        .eq("id", tx.id);

      if (error) {
        // don't break the app; surface in doctor/logs
        __errorBus && __errorBus.push && __errorBus.push({ type: "fx_snapshot_update", tx_id: tx.id, error: __errorBus.toPlain(error) });
      }
    }
  } catch (e) {
    __errorBus && __errorBus.push && __errorBus.push({ type: "fx_snapshot_exception", error: __errorBus.toPlain(e) });
  }
}
