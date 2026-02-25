/* =========================
   Transaction FX Snapshot (V6.5)
   - Freezes FX rate used for reporting at the time the transaction exists in DB
   - On each refresh, backfills missing snapshots (best-effort)
   ========================= */
async function ensureTxFxSnapshots() {
  try {
    if (!sbUser) return;
    if (window.TB_FREEZE) return;

    const base = String(state?.period?.baseCurrency || state?.period?.base_currency || "EUR").toUpperCase();
    const txs = Array.isArray(state.transactions) ? state.transactions : [];
    const pending = txs.filter(t => t && !t.fx_rate_snapshot && !t.fxRateSnapshot && String(t.currency || "").toUpperCase() !== base);

    if (!pending.length) return;

    // avoid hammering the API
    const batch = pending.slice(0, 20);

    for (const tx of batch) {
      const from = String(tx.currency || "").toUpperCase();
      const rate = (typeof fxRate === "function") ? fxRate(from, base) : null;
      if (!rate || !Number.isFinite(rate)) continue;

      const payload = {
        fx_rate_snapshot: rate,
        fx_source_snapshot: "ecb_or_manual",
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
