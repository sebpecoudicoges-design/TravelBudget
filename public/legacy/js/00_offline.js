/* =========================
   Offline snapshot support
   V1: read-only restore of the latest loaded state for the current user.
   ========================= */
(function () {
  const SNAPSHOT_VERSION = 2;
  const MAX_AGE_DAYS = 14;

  function uid() {
    try { return String(window.sbUser?.id || window.sbUser?.user?.id || "").trim(); } catch (_) { return ""; }
  }

  function key() {
    const id = uid();
    return id ? `travelbudget_offline_snapshot_v2_${id}` : "";
  }

  function legacyKey() {
    const id = uid();
    return id ? `travelbudget_offline_snapshot_v1_${id}` : "";
  }

  function cloneStateForSnapshot() {
    const s = window.state || {};
    try {
      return JSON.parse(JSON.stringify(s));
    } catch (_) {
      return {
        travels: s.travels || [],
        activeTravelId: s.activeTravelId || null,
        periods: s.periods || [],
        activePeriodId: s.activePeriodId || null,
        period: s.period || null,
        settings: s.settings || [],
        wallets: s.wallets || [],
        walletBalances: s.walletBalances || [],
        transactions: s.transactions || [],
        recurringRules: s.recurringRules || [],
        categories: s.categories || [],
        categorySubcategories: s.categorySubcategories || [],
        subcategories: s.subcategories || [],
        budgetSegments: s.budgetSegments || [],
        segments: s.segments || [],
        tripGroups: s.tripGroups || [],
        tripExpenses: s.tripExpenses || [],
        tripParticipants: s.tripParticipants || [],
        tripMembers: s.tripMembers || [],
        tripNetBalances: s.tripNetBalances || [],
        documents: s.documents || [],
        documentFolders: s.documentFolders || [],
        assetDocuments: s.assetDocuments || [],
        transactionDocuments: s.transactionDocuments || [],
        tripExpenseDocuments: s.tripExpenseDocuments || [],
        assets: s.assets || [],
        assetOwners: s.assetOwners || [],
        assetEvents: s.assetEvents || [],
        sportSessions: s.sportSessions || [],
        sportSessionItems: s.sportSessionItems || [],
        sportSets: s.sportSets || [],
        user: s.user || null,
        hiddenCategories: s.hiddenCategories || [],
      };
    }
  }

  function saveOfflineSnapshot(reason) {
    try {
      const k = key();
      if (!k || !window.state) return false;
      const payload = {
        version: SNAPSHOT_VERSION,
        savedAt: new Date().toISOString(),
        reason: String(reason || "refresh"),
        state: cloneStateForSnapshot(),
      };
      localStorage.setItem(k, JSON.stringify(payload));
      window.__TB_OFFLINE_SNAPSHOT__ = { savedAt: payload.savedAt, restored: false };
      return true;
    } catch (e) {
      console.warn("[Offline] snapshot save failed", e?.message || e);
      return false;
    }
  }

  function restoreOfflineSnapshot(reason) {
    try {
      const k = key();
      if (!k) return false;
      let payload = JSON.parse(localStorage.getItem(k) || "null");
      if (!payload || !payload.state) {
        payload = JSON.parse(localStorage.getItem(legacyKey()) || "null");
      }
      if (!payload || !payload.state) return false;
      const savedMs = Date.parse(payload.savedAt || "");
      if (!Number.isFinite(savedMs)) return false;
      if ((Date.now() - savedMs) > MAX_AGE_DAYS * 24 * 60 * 60 * 1000) return false;
      window.state = Object.assign(window.state || {}, payload.state);
      window.__TB_OFFLINE_SNAPSHOT__ = { savedAt: payload.savedAt, restored: true, reason: String(reason || "offline") };
      try { document.documentElement.classList.add("tb-offline-restored"); } catch (_) {}
      try { if (typeof window.ensureStateIntegrity === "function") window.ensureStateIntegrity(); } catch (_) {}
      return true;
    } catch (e) {
      console.warn("[Offline] snapshot restore failed", e?.message || e);
      return false;
    }
  }

  function offlineMessage() {
    try {
      const lang = String(window.__tbLang || localStorage.getItem("tb_lang_v1") || navigator.language || "fr").toLowerCase();
      return lang.startsWith("en")
        ? "Offline: restored the latest local data. Changes are disabled until the connection returns."
        : "Hors ligne : dernier etat local restaure. Les modifications sont a faire quand la connexion revient.";
    } catch (_) {
      return "Hors ligne : dernier etat local restaure.";
    }
  }

  window.tbSaveOfflineSnapshot = saveOfflineSnapshot;
  window.tbRestoreOfflineSnapshot = restoreOfflineSnapshot;
  window.tbOfflineMessage = offlineMessage;
})();
