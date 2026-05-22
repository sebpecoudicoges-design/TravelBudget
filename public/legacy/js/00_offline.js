/* =========================
   Offline snapshot support
   V1: read-only restore of the latest loaded state for the current user.
   ========================= */
(function () {
  const SNAPSHOT_VERSION = 2;
  const MAX_AGE_DAYS = 14;
  let networkUnavailableUntil = 0;
  let reachabilityPromise = null;

  function uid() {
    try {
      const u = (typeof sbUser !== "undefined" && sbUser) ? sbUser : (window.sbUser || null);
      return String(u?.id || u?.user?.id || "").trim();
    } catch (_) {
      try { return String(window.sbUser?.id || window.sbUser?.user?.id || "").trim(); } catch (__) { return ""; }
    }
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

  function markNetworkUnavailable(reason) {
    networkUnavailableUntil = Date.now() + 30000;
    window.__TB_OFFLINE_NETWORK__ = { reason: String(reason || "network"), until: networkUnavailableUntil };
    try { document.documentElement.classList.add("tb-supabase-offline"); } catch (_) {}
  }

  function clearNetworkUnavailable() {
    networkUnavailableUntil = 0;
    window.__TB_OFFLINE_NETWORK__ = null;
    try { document.documentElement.classList.remove("tb-supabase-offline"); } catch (_) {}
  }

  function isOfflineMode() {
    try {
      return (navigator && navigator.onLine === false) || Date.now() < Number(networkUnavailableUntil || 0);
    } catch (_) {
      return Date.now() < Number(networkUnavailableUntil || 0);
    }
  }

  function supabaseHealthUrl() {
    const base = String(window.SUPABASE_URL || window.__TB_SUPABASE_URL || "").replace(/\/+$/, "");
    return base ? `${base}/auth/v1/health` : "";
  }

  function supabasePublicHeaders() {
    const anon = String(window.SUPABASE_ANON_KEY || window.__TB_SUPABASE_ANON_KEY || "").trim();
    return anon ? { apikey: anon, Authorization: `Bearer ${anon}` } : {};
  }

  async function isSupabaseReachable(reason) {
    try {
      if (navigator && navigator.onLine === false) {
        markNetworkUnavailable(reason || "navigator-offline");
        return false;
      }
    } catch (_) {}
    if (Date.now() < Number(networkUnavailableUntil || 0)) return false;

    if (reachabilityPromise) return reachabilityPromise;
    reachabilityPromise = (async () => {
      const url = supabaseHealthUrl();
      if (!url) return true;

      const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
      const timeout = controller ? setTimeout(() => controller.abort(), 1400) : null;
      try {
        const res = await fetch(url, {
          method: "GET",
          cache: "no-store",
          headers: supabasePublicHeaders(),
          signal: controller ? controller.signal : undefined,
        });
        if (res && res.status < 500) {
          clearNetworkUnavailable();
          return true;
        }
        markNetworkUnavailable(reason || "supabase-unreachable");
        return false;
      } catch (e) {
        markNetworkUnavailable(reason || e?.name || "supabase-unreachable");
        return false;
      } finally {
        if (timeout) clearTimeout(timeout);
        reachabilityPromise = null;
      }
    })();
    return reachabilityPromise;
  }

  async function shouldUseOfflineMode(reason) {
    if (isOfflineMode()) return true;
    return !(await isSupabaseReachable(reason || "offline-check"));
  }

  window.tbSaveOfflineSnapshot = saveOfflineSnapshot;
  window.tbRestoreOfflineSnapshot = restoreOfflineSnapshot;
  window.tbOfflineMessage = offlineMessage;
  window.tbMarkNetworkUnavailable = markNetworkUnavailable;
  window.tbClearNetworkUnavailable = clearNetworkUnavailable;
  window.tbIsOfflineMode = isOfflineMode;
  window.tbIsSupabaseReachable = isSupabaseReachable;
  window.tbShouldUseOfflineMode = shouldUseOfflineMode;
})();
