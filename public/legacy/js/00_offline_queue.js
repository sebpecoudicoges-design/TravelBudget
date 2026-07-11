/* =========================
   Offline mutation queue adapter
   - Durable storage, deduplication, locks and retries live in src/data.
   - Domain replay handlers stay here while legacy modules are migrated.
   ========================= */
(function () {
  if (window.__TB_OFFLINE_QUEUE_V2_LOADED__) return;
  window.__TB_OFFLINE_QUEUE_V2_LOADED__ = true;

  const KEY_PREFIX = "travelbudget_offline_queue_v2";
  const LOCK_PREFIX = "travelbudget_offline_queue_v2_lock";
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

  const queueStore = window.Data?.createMutationQueueStore?.({
    storage: localStorage,
    queueKey: key,
    lockKey,
    owner: OWNER,
    idFactory: makeId,
    onChange: (items, detail) => {
      try { window.Data?.appStore?.set("offlineMutations", items); } catch (_) {}
      try {
        window.dispatchEvent(new CustomEvent("tb:offline_queue_changed", {
          detail: Object.assign({ count: items.filter((item) => item.status !== "done").length }, detail || {}),
        }));
      } catch (_) {}
    },
  });

  if (!queueStore) throw new Error("Mutation queue store indisponible");

  function safeRead() {
    try { return queueStore.read(); } catch (_) { return []; }
  }

  function safeWrite(items) {
    try {
      queueStore.write(items);
      return true;
    } catch (e) {
      console.warn("[OfflineQueue] write failed", e?.message || e);
      return false;
    }
  }

  function acquireLock(reason) {
    try { return queueStore.acquireLock(reason); } catch (_) { return false; }
  }

  function releaseLock() {
    try { queueStore.releaseLock(); } catch (_) {}
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
    return ["sport.sync_local", "nutrition.sync_local"].includes(String(kind || ""));
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
    const normalizedKind = String(kind || "unknown");
    const result = queueStore.enqueue(normalizedKind, payload || {}, meta || {}, { singleton: singletonKind(normalizedKind) });
    toastInfo(result.deduplicated
      ? message("Action deja en attente. J'ai garde une seule synchro.", "Action already pending. Kept one sync only.")
      : message("Action enregistree hors ligne. Synchro au retour reseau.", "Saved offline. It will sync when the connection returns."));
    return result.item;
  }

  function remove(id) {
    cleanupOptimisticRows(id);
    queueStore.remove(id);
  }

  function count() {
    return safeRead().filter((item) => item.status !== "done").length;
  }

  function pending() {
    return safeRead().filter((item) => item.status !== "done");
  }

  function errorText(error) {
    const raw = String(error?.message || error || "").toLowerCase();
    try {
      return raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    } catch (_) {
      return raw;
    }
  }

  function isPermanentFailure(kind, error) {
    const k = String(kind || "");
    const msg = errorText(error);
    if (!msg) return false;
    const looksLikeOldTripFailure = (
      msg.includes("transactions_trip_expense_unique") ||
      msg.includes("duplicate key value") ||
      msg.includes("trip_expenses_transaction_fk") ||
      msg.includes("violates foreign key constraint") ||
      msg.includes("le lien avec la transaction") ||
      msg.includes("ajoute au moins un participant") ||
      msg.includes("shares are empty") ||
      msg.includes("cette depense trip est deja liee") ||
      msg.includes("cette depense est deja liee") ||
      msg.includes("liee") ||
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

  function isTripConflictItem(item) {
    if (!item) return false;
    const k = String(item.kind || "");
    const err = item.error || item.lastError || item.meta?.error;
    const payload = item.payload || {};
    const args = payload.args || payload.coreArgs || {};
    if (isPermanentFailure(k, err)) return true;
    if (k.startsWith("trip.expense")) {
      if (Number(item.attempts || 0) > 0 || err) return true;
      if (!Array.isArray(payload.members) || !payload.members.length) return true;
      return false;
    }
    if (k === "transaction.update_v2") {
      if (args.p_trip_expense_id || args.tripExpenseId || args.trip_expense_id) return true;
      if (Number(item.attempts || 0) > 0 && err && errorText(err).includes("trip")) return true;
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

  function discardKind(filterKind) {
    const kind = String(filterKind || "").trim();
    if (!kind) return [];
    const before = safeRead();
    const removed = [];
    const next = before.filter((item) => {
      const match = item && (String(item.kind || "") === kind || String(item.kind || "").startsWith(kind));
      if (match) {
        removed.push(item);
        cleanupItemSideEffects(item);
        return false;
      }
      return true;
    });
    if (removed.length) safeWrite(next);
    return removed;
  }

  function discardTripConflicts(options) {
    const opts = options || {};
    const before = safeRead();
    const removed = [];
    const next = before.filter((item) => {
      if (isTripConflictItem(item)) {
        removed.push(item);
        cleanupItemSideEffects(item);
        return false;
      }
      return true;
    });
    if (removed.length) {
      safeWrite(next);
      if (!opts.silent) {
        toastInfo(message(`${removed.length} ancienne(s) action(s) Trip retiree(s).`, `${removed.length} old Trip action(s) removed.`));
      }
    }
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
      await window.Data.supabaseRepository.rpc(rpcName, args);
      return true;
    }
    if (item.kind === "transaction.update_v2") {
      const args = item.payload?.args || {};
      if (typeof window._txUpdateTransactionRpcCompat === "function") {
        const res = await window._txUpdateTransactionRpcCompat(args);
        if (res?.error) throw res.error;
        return true;
      }
      const rpcName = item.payload?.rpcName || window.TB_CONST?.RPCS?.update_transaction_v2 || "update_transaction_v2";
      await window.Data.supabaseRepository.rpc(rpcName, args);
      return true;
    }
    if (item.kind === "transaction.delete") {
      const txId = item.payload?.txId || item.payload?.p_tx_id;
      if (!txId) throw new Error("Transaction a supprimer introuvable");
      const rpcName = item.payload?.rpcName || window.TB_CONST?.RPCS?.delete_transaction || "delete_transaction";
      await window.Data.supabaseRepository.rpc(rpcName, { p_tx_id: txId });
      return true;
    }
    if (item.kind === "sport.sync_local") {
      if (typeof window.tbSportSyncLocalWorkouts !== "function" && typeof window.tbLoadLegacyDomain === "function") {
        await window.tbLoadLegacyDomain("sport");
      }
      if (typeof window.tbSportSyncLocalWorkouts === "function") {
        await window.tbSportSyncLocalWorkouts();
      }
      return true;
    }
    if (item.kind === "nutrition.sync_local") {
      if (typeof window.tbNutritionSyncLocal === "function") {
        await window.tbNutritionSyncLocal("offline-queue");
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
    let failed = 0;
    try {
      try {
        if (typeof window.tbShouldUseOfflineMode === "function" && await window.tbShouldUseOfflineMode(`offline-queue:${reason || "sync"}`)) {
          return { ok: false, skipped: "offline" };
        }
      } catch (_) {
        return { ok: false, skipped: "offline-check" };
      }

      const force = ["manual", "diagnostic"].includes(String(reason || ""));
      const todo = queueStore.runnable(force);
      if (!todo.length) return { ok: true, synced: 0 };

      syncing = true;
      const result = await window.Data.flushMutationQueue({
        store: queueStore,
        run: runItem,
        force,
        isPermanentFailure: (item, error) => isPermanentFailure(item.kind, error),
        onSuccess: (item) => {
          if (String(item?.kind || "").startsWith("transaction.")) cleanupOptimisticRows(item.id);
        },
        onPermanentFailure: (item) => {
          cleanupItemSideEffects(item);
          toastInfo(message("Ancienne action offline Trip ignoree car elle n'est plus rejouable.", "Old Trip offline action skipped because it is no longer replayable."));
        },
      });
      synced = result.synced;
      failed = result.failed;
      if (failed) console.warn(`[OfflineQueue] ${failed} action(s) deferred; later actions continued.`);
      if (synced) {
        toastInfo(message(`${synced} action(s) hors ligne synchronisee(s).`, `${synced} offline action(s) synced.`));
        try {
          if (typeof window.refreshFromServer === "function") await window.refreshFromServer({ force: true });
        } catch (_) {}
      }
      return { ok: failed === 0, synced, failed };
    } finally {
      syncing = false;
      releaseLock();
      dispatchChanged({ synced, failed });
    }
  }

  window.tbOfflineQueueEnqueue = enqueue;
  window.tbOfflineQueueSync = sync;
  window.tbOfflineQueueCount = count;
  window.tbOfflineQueuePending = pending;
  window.tbOfflineQueueRemove = remove;
  window.tbOfflineQueueDiscardFailed = discardFailed;
  window.tbOfflineQueueDiscardKind = discardKind;
  window.tbOfflineQueueDiscardTripConflicts = discardTripConflicts;
  window.tbOfflineQueueCleanupOptimistic = cleanupOptimisticRows;

  setTimeout(() => {
    try { discardTripConflicts({ silent: true }); } catch (_) {}
  }, 600);

  window.addEventListener("online", () => {
    setTimeout(() => { sync("online").catch((e) => console.warn("[OfflineQueue] sync failed", e?.message || e)); }, 1200);
  });
  window.addEventListener("tb:offline_state_changed", (ev) => {
    if (ev?.detail && ev.detail.offline === false) {
      setTimeout(() => { sync("state-online").catch((e) => console.warn("[OfflineQueue] sync failed", e?.message || e)); }, 800);
    }
  });
})();
