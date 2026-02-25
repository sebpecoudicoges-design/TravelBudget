/* =========================
   FX Snapshot helpers (V6.5 Option B)
   - Build an immutable FX snapshot for a transaction at write-time.
   - Prefer snapshot for conversions when compatible.
   ========================= */

function fxBuildTxSnapshot(txCurrency, baseCurrency, dateStr) {
  const txC = String(txCurrency || "").trim().toUpperCase();
  const baseC = String(baseCurrency || "").trim().toUpperCase();
  const ds = String(dateStr || "").slice(0, 10);

  if (!txC || !baseC) throw new Error("[FX] snapshot: missing currency");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ds)) throw new Error("[FX] snapshot: invalid date");

  // Same currency => identity
  if (txC === baseC) {
    return {
      fx_rate_snapshot: 1,
      fx_source_snapshot: "none",
      fx_snapshot_at: new Date().toISOString(),
      fx_base_currency_snapshot: baseC,
      fx_tx_currency_snapshot: txC,
    };
  }

  // Use the segment FX rules for that day (fixed/auto/live_ecb)
  const seg = (typeof window.getBudgetSegmentForDate === "function") ? window.getBudgetSegmentForDate(ds) : null;
  const rates = (typeof window.fxRatesForSegment === "function")
    ? window.fxRatesForSegment(seg)
    : ((typeof window.fxGetEurRates === "function") ? window.fxGetEurRates() : {});

  if (typeof window.fxRate !== "function") throw new Error("[FX] snapshot: fxRate() missing");
  const rate = window.fxRate(txC, baseC, rates);
  if (!rate || !Number.isFinite(rate) || rate <= 0) {
    throw new Error(`[FX] snapshot: cannot compute rate ${txC}->${baseC} for ${ds}`);
  }

  // Best-effort source detection
  let source = "ecb";
  try {
    const mode = String(seg?.fxMode || seg?.fx_mode || "auto");
    if (mode === "fixed") source = "manual";
    // auto/live_ecb: if rate ultimately depends on EUR_RATES, treat as ecb
  } catch (_) {}

  return {
    fx_rate_snapshot: rate,
    fx_source_snapshot: source,
    fx_snapshot_at: new Date().toISOString(),
    fx_base_currency_snapshot: baseC,
    fx_tx_currency_snapshot: txC,
  };
}

// Convert using snapshot if compatible, otherwise return null.
function fxTryConvertWithSnapshot(amount, tx, targetBaseCurrency) {
  const a = Number(amount) || 0;
  if (!tx) return null;

  const snapRate = Number(tx.fx_rate_snapshot ?? tx.fxRateSnapshot);
  const snapFrom = String(tx.fx_tx_currency_snapshot || tx.fxTxCurrencySnapshot || "").toUpperCase();
  const snapTo = String(tx.fx_base_currency_snapshot || tx.fxBaseCurrencySnapshot || "").toUpperCase();
  const target = String(targetBaseCurrency || "").toUpperCase();

  const txCur = String(tx.currency || "").toUpperCase();
  if (!snapRate || !Number.isFinite(snapRate) || snapRate <= 0) return null;
  if (!snapFrom || !snapTo || !target) return null;

  // Only use when the snapshot matches (immutability guarantee)
  if (snapFrom !== txCur) return null;
  if (snapTo !== target) return null;

  const out = a * snapRate;
  return Number.isFinite(out) ? out : null;
}

window.fxBuildTxSnapshot = fxBuildTxSnapshot;
window.fxTryConvertWithSnapshot = fxTryConvertWithSnapshot;
