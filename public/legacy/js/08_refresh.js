/* =========================
   Refresh
   ========================= */
let _refreshInFlight = false;
async function refreshFromServer() {
  if (!sbUser) return;
  if (_refreshInFlight) return;
  _refreshInFlight = true;

  try {
    await loadFromSupabase();
    if (typeof ensureStateIntegrity === "function") ensureStateIntegrity();
    renderAll();
    if (window.tbBus && typeof tbBus.emit === "function") tbBus.emit("render:done");
  } catch (e) {
    (window.log?log.error:console.error)("[refreshFromServer]", e);
    alert("Refresh impossible : " + normalizeSbError(e));
  } finally {
    _refreshInFlight = false;
  }
}

