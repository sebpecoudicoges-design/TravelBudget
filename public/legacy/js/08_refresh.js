/* =========================
   Refresh
   ========================= */
let _refreshInFlight = false;
async function refreshFromServer() {
  if (!sbUser) return;
  if (_refreshInFlight) return;
  _refreshInFlight = true;

  try {
    try { if (window.TB_PERF && TB_PERF.enabled) TB_PERF.mark("supabase:load"); } catch (_) {}
    // FX: ensure daily rates (blocks only if no cached rates yet)
    if (typeof tbFxEnsureDaily === "function") {
      try { await tbFxEnsureDaily({ blockingIfEmpty: true }); } catch (_) {}
    }

    await loadFromSupabase();

    // FX: apply cached daily rates to current period base
    if (typeof tbFxApplyToState === "function") {
      try { tbFxApplyToState({ allowPrompt: true }); } catch (_) {}
    }
    try { if (window.TB_PERF && TB_PERF.enabled) TB_PERF.end("supabase:load"); } catch (_) {}
    // FX snapshots: run in background (do not block refresh/boot)
    if (typeof ensureTxFxSnapshotsDeferred === "function") {
      ensureTxFxSnapshotsDeferred();
    } else if (typeof ensureTxFxSnapshots === "function") {
      // Fallback: fire-and-forget
      try { ensureTxFxSnapshots(); } catch (_) {}
    }
    if (typeof ensureStateIntegrity === "function") ensureStateIntegrity();
    try { if (window.TB_PERF && TB_PERF.enabled) TB_PERF.mark("render:all"); } catch (_) {}
    if (typeof tbRequestRenderAll === "function") tbRequestRenderAll("08_refresh.js"); else if (typeof renderAll === "function") renderAll();
try { if (window.TB_PERF && TB_PERF.enabled) TB_PERF.end("render:all"); } catch (_) {}
    if (window.tbBus && typeof tbBus.emit === "function") tbBus.emit("render:done");
  } catch (e) {
    (window.log?log.error:console.error)("[refreshFromServer]", e);
    alert("Refresh impossible : " + normalizeSbError(e));
  } finally {
    _refreshInFlight = false;
  }
}
