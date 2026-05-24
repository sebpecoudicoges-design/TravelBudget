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
    const slimRows = (rows, limit, mapper) => {
      const arr = Array.isArray(rows) ? rows : [];
      return arr.slice(0, limit).map((row) => {
        const copy = mapper ? mapper(row || {}) : Object.assign({}, row || {});
        delete copy.media;
        delete copy.raw;
        delete copy.raw_text;
        delete copy.signedUrl;
        delete copy.signed_url;
        delete copy.previewUrl;
        delete copy.preview_url;
        delete copy.thumbnailUrl;
        delete copy.thumbnail_url;
        delete copy.base64;
        delete copy.blob;
        return copy;
      });
    };
    return {
      travels: slimRows(s.travels, 30),
      activeTravelId: s.activeTravelId || null,
      periods: slimRows(s.periods, 60),
      activePeriodId: s.activePeriodId || null,
      period: s.period || null,
      settings: slimRows(s.settings, 200),
      wallets: slimRows(s.wallets, 80),
      walletBalances: slimRows(s.walletBalances, 100),
      walletBalanceMap: s.walletBalanceMap || {},
      transactions: slimRows(s.transactions, 1000),
      recurringRules: slimRows(s.recurringRules, 200),
      categories: s.categories || [],
      categorySubcategories: s.categorySubcategories || [],
      subcategories: s.subcategories || [],
      budgetSegments: slimRows(s.budgetSegments, 120),
      segments: slimRows(s.segments, 120),
      tripGroups: slimRows(s.tripGroups, 80),
      tripExpenses: slimRows(s.tripExpenses, 600),
      tripExpenseShares: slimRows(s.tripExpenseShares, 1600),
      tripParticipants: slimRows(s.tripParticipants, 200),
      tripMembers: slimRows(s.tripMembers, 200),
      tripNetBalances: slimRows(s.tripNetBalances, 300),
      tripBudgetLinks: slimRows(s.tripBudgetLinks, 600),
      tripSettlementEvents: slimRows(s.tripSettlementEvents, 500),
      documents: slimRows(s.documents, 300),
      documentFolders: slimRows(s.documentFolders, 200),
      assetDocuments: slimRows(s.assetDocuments, 300),
      transactionDocuments: slimRows(s.transactionDocuments, 600),
      tripExpenseDocuments: slimRows(s.tripExpenseDocuments, 600),
      assets: slimRows(s.assets, 200),
      assetOwners: slimRows(s.assetOwners, 300),
      assetEvents: slimRows(s.assetEvents, 500),
      sportSessions: slimRows(s.sportSessions, 80),
      sportSessionItems: slimRows(s.sportSessionItems, 400),
      sportSets: slimRows(s.sportSets, 800),
      profile: s.profile || null,
      user: s.user || null,
      hiddenCategories: s.hiddenCategories || [],
    };
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
      const raw = JSON.stringify(payload);
      try {
        try { localStorage.removeItem(k); } catch (_) {}
        localStorage.setItem(k, raw);
      } catch (quotaErr) {
        payload.state.transactions = (payload.state.transactions || []).slice(0, 400);
        payload.state.documents = (payload.state.documents || []).slice(0, 100);
        payload.state.tripExpenses = (payload.state.tripExpenses || []).slice(0, 300);
        payload.state.tripExpenseShares = (payload.state.tripExpenseShares || []).slice(0, 900);
        payload.state.transactionDocuments = [];
        payload.state.tripExpenseDocuments = [];
        payload.state.assetDocuments = [];
        payload.state.sportSets = (payload.state.sportSets || []).slice(0, 300);
        try { localStorage.removeItem(k); } catch (_) {}
        try {
          localStorage.setItem(k, JSON.stringify(payload));
        } catch (smallErr) {
          payload.state.transactions = (payload.state.transactions || []).slice(0, 120);
          payload.state.tripExpenses = (payload.state.tripExpenses || []).slice(0, 120);
          payload.state.tripExpenseShares = (payload.state.tripExpenseShares || []).slice(0, 360);
          payload.state.documents = [];
          payload.state.assets = [];
          payload.state.assetEvents = [];
          payload.state.sportSets = [];
          try { localStorage.removeItem(k); } catch (_) {}
          localStorage.setItem(k, JSON.stringify(payload));
        }
      }
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
    networkUnavailableUntil = Date.now() + 8000;
    window.__TB_OFFLINE_NETWORK__ = { reason: String(reason || "network"), until: networkUnavailableUntil };
    try { document.documentElement.classList.add("tb-supabase-offline"); } catch (_) {}
    try { window.dispatchEvent(new CustomEvent("tb:offline_state_changed", { detail: { offline: true, reason: String(reason || "network") } })); } catch (_) {}
  }

  function clearNetworkUnavailable() {
    networkUnavailableUntil = 0;
    window.__TB_OFFLINE_NETWORK__ = null;
    try { document.documentElement.classList.remove("tb-supabase-offline"); } catch (_) {}
    try { window.dispatchEvent(new CustomEvent("tb:offline_state_changed", { detail: { offline: false } })); } catch (_) {}
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
