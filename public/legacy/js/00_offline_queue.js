/* =========================
   Offline mutation queue V2
   - Minimal durable queue for safe offline writes.
   - V2 scope: new transactions first; sport keeps its local history queue.
   ========================= */
(function () {
  if (window.__TB_OFFLINE_QUEUE_V2_LOADED__) return;
  window.__TB_OFFLINE_QUEUE_V2_LOADED__ = true;

  const QUEUE_VERSION = 2;
  const KEY_PREFIX = "travelbudget_offline_queue_v2";
  const LOCK_PREFIX = "travelbudget_offline_queue_v2_lock";
  const LOCK_TTL_MS = 45000;
  const OWNER = `oq_owner_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  let syncing = false;

  function uid() {
    try {
      const u = (typeof sbUser !== "undefined" && sbUser) ? sbUser : (window.sbUser || null);
      return String(u?.id || u?.user?.id || "").trim();
    } catch (_) {
      try { return String(window.sbUser?.id || window.sbUser?.user?.id || "").trim(); } catch (__) { return ""; }
    }
  }

  function key() {
    return `${KEY_PREFIX}_${uid() || "anon"}`;
  }

  function lockKey() {
    return `${LOCK_PREFIX}_${uid() || "anon"}`;
  }

  function nowISO() {
    try { return new Date().toISOString(); } catch (_) { return ""; }
  }

  function safeRead() {
    try {
      const payload = JSON.parse(localStorage.getItem(key()) || "null");
      if (!payload || !Array.isArray(payload.items)) return [];
      return payload.items.filter(Boolean);
    } catch (_) {
      return [];
    }
  }

  function safeWrite(items) {
    try {
      localStorage.setItem(key(), JSON.stringify({
        version: QUEUE_VERSION,
        savedAt: nowISO(),
        items: Array.isArray(items) ? items : [],
      }));
      dispatchChanged();
      return true;
    } catch (e) {
      console.warn("[OfflineQueue] write failed", e?.message || e);
      return false;
    }
  }

  function readLock() {
    try {
      const raw = JSON.parse(localStorage.getItem(lockKey()) || "null");
      return raw && typeof raw === "object" ? raw : null;
    } catch (_) {
      return null;
    }
  }

  function acquireLock(reason) {
    const now = Date.now();
    const current = readLock();
    if (current?.owner && current.owner !== OWNER && Number(current.expiresAt || 0) > now) {
      return false;
    }
    const next = {
      owner: OWNER,
      reason: String(reason || "sync"),
      createdAt: now,
      expiresAt: now + LOCK_TTL_MS,
    };
    try {
      localStorage.setItem(lockKey(), JSON.stringify(next));
      const check = readLock();
      return check?.owner === OWNER;
    } catch (_) {
      return false;
    }
  }

  function releaseLock() {
    try {
      const current = readLock();
      if (!current || current.owner === OWNER) localStorage.removeItem(lockKey());
    } catch (_) {}
  }

  function dispatchChanged(extra) {
    try {
      window.dispatchEvent(new CustomEvent("tb:offline_queue_changed", {
        detail: Object.assign({ count: safeRead().filter((x) => x.status !== "done").length }, extra || {}),
      }));
    } catch (_) {}
  }

  function message(fr, en) {
    try {
      const lang = String(window.__tbLang || localStorage.getItem("tb_lang_v1") || navigator.language || "fr").toLowerCase();
      return lang.startsWith("en") ? en : fr;
    } catch (_) {
      return fr;
    }
  }

  function toastInfo(text) {
    try {
      if (typeof window.toastOk === "function") window.toastOk(text);
      else if (typeof window.toastWarn === "function") window.toastWarn(text);
      else console.info(text);
    } catch (_) {}
  }

  function makeId(kind) {
    return `oq_${String(kind || "item").replace(/[^a-z0-9_-]/gi, "_")}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  function singletonKind(kind) {
    return String(kind || "") === "sport.sync_local";
  }

  function cleanupOptimisticRows(queueId) {
    try {
      if (!window.state || !Array.isArray(state.transactions)) return 0;
      const before = state.transactions.length;
      const qid = String(queueId || "").trim();
      state.transactions = state.transactions.filter((tx) => {
        if (!tx || !(tx.localOnly || tx.offlinePending || tx.local_only || tx.offline_pending)) return true;
        if (!qid) return false;
        const rowQueueId = String(tx.offlineQueueId || tx.offline_queue_id || tx.id || "").trim();
        return rowQueueId !== qid;
      });
      const removed = before - state.transactions.length;
      if (removed) {
        try { if (typeof window.tbSaveOfflineSnapshot === "function") window.tbSaveOfflineSnapshot("offline-queue:cleanup"); } catch (_) {}
        try { if (typeof window.renderAll === "function") window.renderAll(); } catch (_) {}
      }
      return removed;
    } catch (_) {
      return 0;
    }
  }

  function enqueue(kind, payload, meta) {
    const items = safeRead();
    const normalizedKind = String(kind || "unknown");
    if (singletonKind(normalizedKind)) {
      const existing = items.find((item) => item && item.kind === normalizedKind && item.status !== "done");
      if (existing) {
        existing.updatedAt = nowISO();
        existing.payload = Object.assign({}, existing.payload || {}, payload || {});
        existing.meta = Object.assign({}, existing.meta || {}, meta || {});
        safeWrite(items);
        toastInfo(message("Action deja en attente. Synchro au retour reseau.", "Action already pending. It will sync when the connection returns."));
        return existing;
      }
    }
    const item = {
      id: makeId(kind),
      kind: normalizedKind,
      status: "pending",
      attempts: 0,
      createdAt: nowISO(),
      updatedAt: nowISO(),
      payload: payload || {},
      meta: meta || {},
    };
    items.push(item);
    safeWrite(items);
    toastInfo(message("Action enregistree hors ligne. Synchro au retour reseau.", "Saved offline. It will sync when the connection returns."));
    return item;
  }

  function remove(id) {
    cleanupOptimisticRows(id);
    const items = safeRead().filter((item) => String(item.id) !== String(id));
    safeWrite(items);
  }

  function count() {
    return safeRead().filter((item) => item.status !== "done").length;
  }

  function pending() {
    return safeRead().filter((item) => item.status !== "done");
  }

  function isPermanentFailure(kind, error) {
    const k = String(kind || "");
    const msg = String(error?.message || error || "").toLowerCase();
    if (!msg) return false;
    const looksLikeOldTripFailure = (
      msg.includes("transactions_trip_expense_unique") ||
      msg.includes("duplicate key value") ||
      msg.includes("trip_expenses_transaction_fk") ||
      msg.includes("violates foreign key constraint") ||
      msg.includes("le lien avec la transaction") ||
      msg.includes("ajoute au moins un participant") ||
      msg.includes("shares are empty") ||
      msg.includes("already linked") ||
      msg.includes("deja lie") ||
      msg.includes("liÃ")
    );
    if (looksLikeOldTripFailure && (k.startsWith("trip.expense") || k.startsWith("transaction."))) return true;
    if (k.startsWith("trip.expense")) {
      return (
        msg.includes("transactions_trip_expense_unique") ||
        msg.includes("duplicate key value") ||
        msg.includes("deja liee") ||
        msg.includes("déjà liée") ||
        msg.includes("already linked") ||
        msg.includes("trip_expenses_transaction_fk") ||
        msg.includes("violates foreign key constraint") ||
        msg.includes("le lien avec la transaction") ||
        msg.includes("ajoute au moins un participant")
      );
    }
    return false;
  }

  function cleanupItemSideEffects(item) {
    try {
      if (String(item?.kind || "").startsWith("trip.expense") && typeof window.tbTripCleanupOfflineOptimistic === "function") {
        window.tbTripCleanupOfflineOptimistic(item.id);
      }
      if (String(item?.kind || "").startsWith("transaction.")) cleanupOptimisticRows(item.id);
    } catch (_) {}
  }

  function discardFailed(filterKind) {
    const kind = String(filterKind || "").trim();
    const before = safeRead();
    const removed = [];
    const next = before.filter((item) => {
      const failed = item && item.error;
      const permanent = item && isPermanentFailure(item.kind, item.error || item.lastError || item.meta?.error);
      const match = !kind || String(item.kind || "") === kind || String(item.kind || "").startsWith(kind);
      if ((failed || permanent) && match) {
        removed.push(item);
        cleanupItemSideEffects(item);
        return false;
      }
      return true;
    });
    safeWrite(next);
    return removed;
  }

  async function runItem(item) {
    if (!item || item.status === "done") return true;
    if (item.kind === "transaction.apply_v2") {
      const rpcName = item.payload?.rpcName || window.TB_CONST?.RPCS?.apply_transaction_v2 || "apply_transaction_v2";
      let args = item.payload?.args || {};
      if (item.payload?.coreArgs && typeof window._txBuildApplyV2Args === "function") {
        args = window._txBuildApplyV2Args(item.payload.coreArgs, { skipInteractiveFx: false });
      }
      if (!window.sb || typeof window.sb.rpc !== "function") throw new Error("Supabase indisponible");
      const { error } = await window.sb.rpc(rpcName, args);
      if (error) throw error;
      return true;
    }
    if (item.kind === "transaction.update_v2") {
      const args = item.payload?.args || {};
      if (typeof window._txUpdateTransactionRpcCompat === "function") {
        const res = await window._txUpdateTransactionRpcCompat(args);
        if (res?.error) throw res.error;
        return true;
      }
      if (!window.sb || typeof window.sb.rpc !== "function") throw new Error("Supabase indisponible");
      const rpcName = item.payload?.rpcName || window.TB_CONST?.RPCS?.update_transaction_v2 || "update_transaction_v2";
      const { error } = await window.sb.rpc(rpcName, args);
      if (error) throw error;
      return true;
    }
    if (item.kind === "sport.sync_local") {
      if (typeof window.tbSportSyncLocalWorkouts === "function") {
        await window.tbSportSyncLocalWorkouts();
      }
      return true;
    }
    if (item.kind === "trip.expense.create" || item.kind === "trip.expense.update") {
      if (typeof window.tbTripReplayOfflineExpenseMutation !== "function") {
        throw new Error("Trip indisponible pour rejouer l'action offline");
      }
      await window.tbTripReplayOfflineExpenseMutation(Object.assign({}, item.payload || {}, {
        mode: item.kind === "trip.expense.update" ? "update" : "create",
      }));
      try {
        if (typeof window.tbTripCleanupOfflineOptimistic === "function") window.tbTripCleanupOfflineOptimistic(item.id);
      } catch (_) {}
      return true;
    }
    throw new Error(`Type de queue inconnu: ${item.kind}`);
  }

  async function sync(reason) {
    if (syncing) return { ok: false, skipped: "already-syncing" };
    if (!acquireLock(reason)) return { ok: false, skipped: "locked" };
    let synced = 0;
    try {
      try {
        if (typeof window.tbShouldUseOfflineMode === "function" && await window.tbShouldUseOfflineMode(`offline-queue:${reason || "sync"}`)) {
          return { ok: false, skipped: "offline" };
        }
      } catch (_) {
        return { ok: false, skipped: "offline-check" };
      }

      const items = safeRead();
      const todo = items.filter((item) => item.status !== "done");
      if (!todo.length) return { ok: true, synced: 0 };

      syncing = true;
      for (const item of todo) {
        try {
          item.status = "syncing";
          item.attempts = Number(item.attempts || 0) + 1;
          item.updatedAt = nowISO();
          safeWrite(items);
          await runItem(item);
          remove(item.id);
          synced += 1;
        } catch (e) {
          if (isPermanentFailure(item.kind, e)) {
            item.status = "discarded";
            item.error = e?.message || String(e);
            item.updatedAt = nowISO();
            cleanupItemSideEffects(item);
            const remaining = safeRead().filter((x) => String(x.id) !== String(item.id));
            safeWrite(remaining);
            toastInfo(message("Ancienne action offline Trip ignoree car elle n'est plus rejouable.", "Old Trip offline action skipped because it is no longer replayable."));
            continue;
          }
          item.status = "pending";
          item.error = e?.message || String(e);
          item.updatedAt = nowISO();
          safeWrite(items);
          throw e;
        }
      }
      if (synced) {
        cleanupOptimisticRows("");
        toastInfo(message(`${synced} action(s) hors ligne synchronisee(s).`, `${synced} offline action(s) synced.`));
        try {
          if (typeof window.refreshFromServer === "function") await window.refreshFromServer({ force: true });
        } catch (_) {}
      }
      return { ok: true, synced };
    } finally {
      syncing = false;
      releaseLock();
      dispatchChanged({ synced });
    }
  }

  window.tbOfflineQueueEnqueue = enqueue;
  window.tbOfflineQueueSync = sync;
  window.tbOfflineQueueCount = count;
  window.tbOfflineQueuePending = pending;
  window.tbOfflineQueueDiscardFailed = discardFailed;
  window.tbOfflineQueueCleanupOptimistic = cleanupOptimisticRows;

  window.addEventListener("online", () => {
    setTimeout(() => { sync("online").catch((e) => console.warn("[OfflineQueue] sync failed", e?.message || e)); }, 1200);
  });
  window.addEventListener("tb:offline_state_changed", (ev) => {
    if (ev?.detail && ev.detail.offline === false) {
      setTimeout(() => { sync("state-online").catch((e) => console.warn("[OfflineQueue] sync failed", e?.message || e)); }, 800);
    }
  });
})();
