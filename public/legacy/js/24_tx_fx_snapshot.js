/* =========================
   Transaction FX Snapshot (V6.5)
   - Freezes FX rate used for reporting at the time the transaction exists in DB
   - On each refresh, backfills missing snapshots (best-effort)
   ========================= */
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
      const seg = (typeof window.getBudgetSegmentForDate === "function") ? window.getBudgetSegmentForDate(ds) : null;
      const base = String(seg?.baseCurrency || state?.period?.baseCurrency || state?.period?.base_currency || "EUR").toUpperCase();
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

      const payload = {
        fx_rate_snapshot: snap.fx_rate_snapshot,
        fx_source_snapshot: snap.fx_source_snapshot,
        fx_snapshot_at: snap.fx_snapshot_at,
        fx_base_currency_snapshot: snap.fx_base_currency_snapshot,
        fx_tx_currency_snapshot: snap.fx_tx_currency_snapshot,
        updated_at: new Date().toISOString(),
      };

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
