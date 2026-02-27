/* =========================
   Modal: add/edit via RPC
   ========================= */

function fillModalSelects() {
  const elW = document.getElementById("m-wallet");
  const elC = document.getElementById("m-category");
  if (!elW || !elC) return;

  const activePid = state?.period?.id || null;

  const wallets = (state.wallets || []).filter((w) => {
    const pid = w?.periodId || w?.period_id || w?.periodID || null;
    // If wallet has no period, keep it (legacy). Otherwise, keep only active period wallets.
    if (!pid) return true;
    if (!activePid) return true;
    return String(pid) === String(activePid);
  });

  elW.innerHTML = wallets
    .map((w) => `<option value="${w.id}">${w.name} (${w.currency})</option>`)
    .join("");

  elC.innerHTML = getCategories()
    .map((c) => `<option value="${c}">${c}</option>`)
    .join("");
}

function _ensureSelectValue(el) {
  if (!el) return;
  const v = String(el.value || "");
  const ok = Array.from(el.options || []).some((o) => String(o.value) === v);
  if (!ok) el.value = el.options && el.options[0] ? el.options[0].value : "";
}

/**
 * Given a date, returns the period_id the backend is likely to pick.
 * IMPORTANT: Your periods currently overlap, so a date can belong to multiple periods.
 * We mimic a "most recent start_date wins" behavior.
 */
function _periodIdForDate(dateStr) {
  const d = parseISODateOrNull(dateStr);
  if (!d) return null;

  const periods = Array.isArray(state.periods) ? state.periods : [];
  const sorted = periods
    .slice()
    .sort((a, b) => String(b.start).localeCompare(String(a.start))); // start desc

  for (const p of sorted) {
    const ps = parseISODateOrNull(p.start);
    const pe = parseISODateOrNull(p.end);
    if (!ps || !pe) continue;
    if (d >= ps && d <= pe) return p.id;
  }
  return null;
}


// Build FX snapshot args for RPC writes (V6.6 RPC wrapper)
// Ensures server receives immutable snapshot fields atomically with the write.
function _txResolveBaseCurrencyForDate(dateISO) {
  const ds = String(dateISO || "").slice(0, 10);
  try {
    if (typeof window.getBudgetSegmentForDate === "function") {
      const seg = window.getBudgetSegmentForDate(ds);
      const bc = seg?.base_currency || seg?.baseCurrency || seg?.currency || seg?.baseCurrencyCode;
      if (bc) return String(bc).toUpperCase();
    }
  } catch (_) {}
  return String(state?.period?.baseCurrency || state?.period?.base_currency || "EUR").toUpperCase();
}

function _txBuildFxSnapshotArgs(dateISO, txCurrency) {
  const ds = String(dateISO || "").slice(0, 10);
  const txC = (String(txCurrency || "").trim().toUpperCase() || "EUR");
  const baseC = _txResolveBaseCurrencyForDate(ds);

  if (typeof window.fxBuildTxSnapshot !== "function") {
    throw new Error("fxBuildTxSnapshot() not found (09_fx_snapshot.js not loaded?)");
  }

  const snap = window.fxBuildTxSnapshot(txC, baseC, ds);
  return {
    p_fx_rate_snapshot: snap.fx_rate_snapshot,
    p_fx_source_snapshot: snap.fx_source_snapshot,
    p_fx_snapshot_at: snap.fx_snapshot_at,
    p_fx_base_currency_snapshot: snap.fx_base_currency_snapshot,
    p_fx_tx_currency_snapshot: snap.fx_tx_currency_snapshot
  };
}

function wireNightLogic() {
  const updateNightVisibility = () => {
    const t = document.getElementById("m-type").value;
    const c = document.getElementById("m-category").value;
    const block = document.getElementById("m-night-block");
    block.classList.toggle("hidden", !(t === "expense" && c === "Transport"));
    if (!(t === "expense" && c === "Transport")) document.getElementById("m-night").checked = false;
  };

  document.getElementById("m-type").onchange = updateNightVisibility;
  document.getElementById("m-category").onchange = updateNightVisibility;

  document.getElementById("m-night").onchange = () => {
    if (document.getElementById("m-night").checked) document.getElementById("m-out").checked = true;
  };

  updateNightVisibility();
}

function openTxModal(type = "expense", walletId = null) {
  editingTxId = null;
  fillModalSelects();
  _setTxModalLock(false);

  const now = toLocalISODate(new Date());
  document.getElementById("modal-title").textContent = "Nouvelle transaction";
  document.getElementById("m-type").value = type;

  const elW = document.getElementById("m-wallet");
  elW.value = walletId || state.wallets[0]?.id || "";
  _ensureSelectValue(elW);

  document.getElementById("m-amount").value = "";
  document.getElementById("m-category").value = "Autre";
  document.getElementById("m-start").value = now;
  document.getElementById("m-end").value = now;
  document.getElementById("m-label").value = "";
  document.getElementById("m-paynow").checked = true;
  document.getElementById("m-out").checked = false;
  document.getElementById("m-night").checked = false;

  wireNightLogic();

  document.getElementById("overlay").style.display = "block";
  document.getElementById("modal").style.display = "block";
}

function openTxEditModal(txId) {
  const tx = state.transactions.find((t) => t.id === txId);
  if (!tx) return alert("Transaction introuvable.");

  editingTxId = txId;
  fillModalSelects();

  const tripExpenseId = _txTripExpenseId(tx);
  if (tripExpenseId) {
    _setTxModalLock(true, "Transaction liée à une dépense Trip : édition verrouillée (seuls libellé/catégorie restent modifiables).");
  } else {
    _setTxModalLock(false);
  }

  document.getElementById("modal-title").textContent = "Modifier transaction";

  const _btnResnap = document.getElementById("m-resnap");
  if (_btnResnap) {
    _btnResnap.style.display = (_isDebugMode() && !window.TB_FREEZE && !tx.pay_now) ? "inline-block" : "none";
  }
  document.getElementById("m-type").value = tx.type;

  const elW = document.getElementById("m-wallet");
  elW.value = tx.walletId;
  _ensureSelectValue(elW);

  document.getElementById("m-amount").value = tx.amount;
  document.getElementById("m-category").value = tx.category || "Autre";
  document.getElementById("m-start").value = tx.dateStart;
  document.getElementById("m-end").value = tx.dateEnd || tx.dateStart;
  document.getElementById("m-label").value = tx.label || "";
  document.getElementById("m-paynow").checked = !!tx.payNow;
  document.getElementById("m-out").checked = !!tx.outOfBudget;
  document.getElementById("m-night").checked = !!tx.nightCovered;

  wireNightLogic();

  document.getElementById("overlay").style.display = "block";
  document.getElementById("modal").style.display = "block";
}

function closeModal() {
  document.getElementById("overlay").style.display = "none";
  document.getElementById("modal").style.display = "none";
}

function _txTripExpenseId(tx) {
  return tx?.tripExpenseId || tx?.trip_expense_id || null;
}

function _setTxModalLock(isLocked, reason) {
  const ids = ["m-type", "m-wallet", "m-amount", "m-start", "m-end", "m-paynow", "m-out", "m-night"];
  for (const id of ids) {
    const el = document.getElementById(id);
    if (el) el.disabled = !!isLocked;
  }
  const note = document.getElementById("m-lock-note");
  if (note) {
    note.textContent = isLocked ? (reason || "Cette transaction est verrouillée.") : "";
    note.style.display = isLocked ? "block" : "none";
  }
}

let _savingTx = false;

async function _findLikelyCreatedTxId({ walletId, type, amount, start, end, label }) {
  try {
    const { data, error } = await sb
      .from(TB_CONST.TABLES.transactions)
      .select("id,label,amount,type,wallet_id,date_start,date_end,created_at")
      .eq("wallet_id", walletId)
      .eq("type", type)
      .eq("date_start", start)
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) return null;
    const arr = Array.isArray(data) ? data : [];
    // Match by amount + label when possible
    const best = arr.find(x => Math.abs(Number(x.amount) - Number(amount)) < 0.0001 && String(x.label||"") === String(label||""))
      || arr.find(x => Math.abs(Number(x.amount) - Number(amount)) < 0.0001)
      || arr[0];
    return best?.id || null;
  } catch (_) {
    return null;
  }
}

function _snapshotBaseCurrencyForTxDate(dateStr) {
  const ds = String(dateStr || "").slice(0, 10);
  const seg = (typeof window.getBudgetSegmentForDate === "function") ? window.getBudgetSegmentForDate(ds) : null;
  return String(seg?.baseCurrency || state?.period?.baseCurrency || state?.period?.base_currency || "EUR").toUpperCase();
}

async function _ensureTxSnapshotById(txId, txCurrency, txDateStart) {
  if (!txId) return;
  if (window.TB_FREEZE) return;
  if (typeof window.fxBuildTxSnapshot !== "function") return;

  // Read current row to avoid overwriting immutable snapshots
  const { data: rows, error: rerr } = await sb
    .from(TB_CONST.TABLES.transactions)
    .select("id, period_id, currency, date_start, fx_rate_snapshot, fx_source_snapshot, fx_snapshot_at, fx_base_currency_snapshot, fx_tx_currency_snapshot")
    .eq("id", txId)
    .limit(1);

  if (rerr) throw rerr;
  const cur = Array.isArray(rows) ? rows[0] : null;
  if (!cur) return;

  const complete =
    cur.fx_rate_snapshot != null &&
    cur.fx_source_snapshot != null &&
    cur.fx_snapshot_at != null &&
    cur.fx_base_currency_snapshot != null &&
    cur.fx_tx_currency_snapshot != null;

  if (complete) return;

  // Resolve base currency by period_id when possible
  let baseCur = null;
  try {
    const pid = cur.period_id;
    if (pid && Array.isArray(state?.periods)) {
      const p = state.periods.find((x) => String(x.id) === String(pid));
      baseCur = p?.baseCurrency || p?.base_currency || p?.currency || null;
    }
  } catch (_) {}

  if (!baseCur) baseCur = _snapshotBaseCurrencyForTxDate(txDateStart);
  baseCur = String(baseCur || "EUR").toUpperCase();

  const txCur = String(cur.currency || txCurrency || "").toUpperCase();
  const ds = String(cur.date_start || txDateStart || "").slice(0, 10);

  const snap = window.fxBuildTxSnapshot(txCur, baseCur, ds);

  const payload = { updated_at: new Date().toISOString() };
  if (cur.fx_rate_snapshot == null) payload.fx_rate_snapshot = snap.fx_rate_snapshot;
  if (cur.fx_source_snapshot == null) payload.fx_source_snapshot = snap.fx_source_snapshot;
  if (cur.fx_snapshot_at == null) payload.fx_snapshot_at = snap.fx_snapshot_at;
  if (cur.fx_base_currency_snapshot == null) payload.fx_base_currency_snapshot = snap.fx_base_currency_snapshot;
  if (cur.fx_tx_currency_snapshot == null) payload.fx_tx_currency_snapshot = snap.fx_tx_currency_snapshot;

  // Nothing to do
  if (Object.keys(payload).length <= 1) return;

  const { error } = await sb
    .from(TB_CONST.TABLES.transactions)
    .update(payload)
    .eq("id", txId);

  if (error) throw error;
}


/* =========================
   RPC helper: retry on transient network failure
   - Handles "TypeError: Failed to fetch" / ERR_CONNECTION_CLOSED
   ========================= */
async function tbRpcWithRetry(fnName, args, opts) {
  const retries = Math.max(0, Number(opts?.retries ?? 2));
  const baseDelayMs = Math.max(50, Number(opts?.baseDelayMs ?? 500));

  let lastErr = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await sb.rpc(fnName, args);
    } catch (e) {
      lastErr = e;
      const msg = String(e?.message || e || '');
      const isNet = (e instanceof TypeError) || /failed to fetch/i.test(msg) || /network/i.test(msg);
      if (!isNet || attempt >= retries) break;
      const delay = baseDelayMs * Math.pow(2, attempt);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}
async function saveModal() {
  if (_savingTx) return;
  _savingTx = true;

  const btn = document.querySelector("#modal button.btn.primary");
  if (btn) btn.disabled = true;

  try {
    await safeCall("Sauvegarde", async () => {
      const type = document.getElementById("m-type").value;
      const walletId = document.getElementById("m-wallet").value;
      const amount = parseFloat(document.getElementById("m-amount").value);
      const category = document.getElementById("m-category").value || "Autre";
      const start = document.getElementById("m-start").value;
      const end = document.getElementById("m-end").value || start;
      const label = (document.getElementById("m-label").value || "").trim() || category;
      const payNow = document.getElementById("m-paynow").checked;
      let outOfBudget = document.getElementById("m-out").checked;
      const nightCovered = document.getElementById("m-night").checked;

      if (!start) throw new Error("Date début invalide.");
      if (parseISODateOrNull(end) < parseISODateOrNull(start)) throw new Error("Date fin < date début.");
      if (!isFinite(amount) || amount <= 0) throw new Error("Montant invalide.");

      const wallet = findWallet(walletId);
      if (!wallet) throw new Error("Wallet invalide.");

      if (nightCovered) outOfBudget = true;

      // === KEY FIX: periods overlap, RPC derives period_id from date ===
      // If the wallet belongs to period A but the date falls into period B (derived by start_date),
      // apply_transaction will reject with period_id mismatch.
      const walletPid = wallet?.periodId || wallet?.period_id || null;
      const derivedPid = _periodIdForDate(start);

      if (!editingTxId && derivedPid && walletPid && String(derivedPid) !== String(walletPid)) {
        throw new Error(
          `Périodes qui se chevauchent : la date ${start} est résolue sur la période ${derivedPid} (RPC), ` +
          `mais le wallet appartient à ${walletPid}. ` +
          `→ Change la date / change de période active / utilise un wallet de la même période.`
        );
      }

      if (editingTxId) {
        const current = state.transactions.find((t) => t.id === editingTxId);
        const tripExpenseId = _txTripExpenseId(current);
        if (tripExpenseId) {
          // Locked fields for Trip-linked payment transaction: prevent breaking 1:1 coherence.
          if (walletId !== current.walletId) throw new Error("Transaction liée à Trip : changement de wallet interdit.");
          if (type !== current.type) throw new Error("Transaction liée à Trip : changement de type interdit.");
          if (Math.abs(Number(amount) - Number(current.amount)) > 0.0001)
            throw new Error("Transaction liée à Trip : changement de montant interdit (modifie la dépense Trip à la place).");
          if (String(start) !== String(current.dateStart) || String(end) !== String(current.dateEnd || current.dateStart)) {
            throw new Error("Transaction liée à Trip : changement de dates interdit.");
          }
          if (!!payNow !== !!current.payNow) throw new Error("Transaction liée à Trip : changement pay_now interdit.");
          if (!!outOfBudget !== !!current.outOfBudget) throw new Error("Transaction liée à Trip : flag out_of_budget géré automatiquement.");
        }

        const { data, error } = await tbRpcWithRetry("update_transaction_v2", {
          p_tx_id: editingTxId,
          p_wallet_id: walletId,
          p_type: type,
          p_amount: amount,
          p_currency: wallet.currency,
          p_category: category,
          p_label: label,
          p_date_start: start,
          p_date_end: end,
          p_pay_now: payNow,
          p_out_of_budget: outOfBudget,
          p_night_covered: type === "expense" && category === "Transport" ? nightCovered : false,
          // FX snapshot is computed for the transaction date + transaction currency.
          // (Use local variables here; `form` is not in scope.)
          ..._txBuildFxSnapshotArgs(start, wallet.currency)
        });
        if (error) throw error;
      } else {
        const { data, error } = await tbRpcWithRetry("apply_transaction_v2", {
          p_wallet_id: walletId,
          p_type: type,
          p_amount: amount,
          p_currency: wallet.currency,
          p_category: category,
          p_label: label,
          p_date_start: start,
          p_date_end: end,
          p_pay_now: payNow,
          p_out_of_budget: outOfBudget,
          p_night_covered: type === "expense" && category === "Transport" ? nightCovered : false,
          // FX snapshot is computed for the transaction date + transaction currency.
          // (Use local variables here; `form` is not in scope.)
          ..._txBuildFxSnapshotArgs(start, wallet.currency)
        });
        if (error) throw error;
      }

      closeModal();
      editingTxId = null;
      await refreshFromServer();
    });
  } finally {
    _savingTx = false;
    if (btn) btn.disabled = false;
  }
}


function _isDebugMode() {
  try { return new URLSearchParams(location.search).get("debug") === "1"; } catch (_) { return false; }
}

async function resnapshotModal() {
  if (window.TB_FREEZE) {
    alert("Mode freeze actif : aucune écriture autorisée.");
    return;
  }
  if (!editingTxId) {
    alert("Aucune transaction à re-snapshot.");
    return;
  }
  const tx = state.transactions.find((t) => t.id === editingTxId);
  if (!tx) throw new Error("Transaction introuvable.");

  // Normalize fields (depending on load path, tx can be snake_case or camelCase)
  const txPayNow = (tx.pay_now !== undefined) ? !!tx.pay_now : !!tx.payNow;
  const txOutOfBudget = (tx.out_of_budget !== undefined) ? !!tx.out_of_budget : !!tx.outOfBudget;
  const txNightCovered = (tx.night_covered !== undefined) ? !!tx.night_covered : !!tx.nightCovered;
  const txDateStart = tx.date_start || tx.dateStart;
  const txDateEnd = tx.date_end || tx.dateEnd;
  const txCurrency = String(tx.currency || "").toUpperCase();

  // Recommended: allow only for unpaid (pay_now=false)
  if (txPayNow) {
    alert("Cette transaction est déjà payée. Re-snapshot = supprimer + recréer manuellement si nécessaire.");
    return;
  }

  const ok = confirm("Re-snapshot : recréer la transaction (nouveau taux) puis supprimer l'ancienne. Continuer ?");
  if (!ok) return;

  await safeCall("Re-snapshot", async () => {
    const walletId = tx.wallet_id || tx.walletId;
    const wallet = findWallet(walletId);
    if (!wallet) throw new Error("Wallet introuvable.");

    const { data, error } = await tbRpcWithRetry("apply_transaction_v2", {
      p_wallet_id: walletId,
      p_type: tx.type,
      p_amount: Number(tx.amount),
      // Preserve original tx currency (do not auto-switch to wallet currency)
      p_currency: (txCurrency || String(wallet.currency || '').toUpperCase()),
      p_category: tx.category,
      p_label: tx.label,
      p_date_start: txDateStart,
      p_date_end: txDateEnd,
      // Preserve flags exactly (critical: avoid flipping paid/unpaid state)
      p_pay_now: txPayNow,
      p_out_of_budget: txOutOfBudget,
      p_night_covered: txNightCovered,
      ..._txBuildFxSnapshotArgs(txDateStart, (txCurrency || String(wallet.currency || '').toUpperCase() || 'EUR'))
    });
    if (error) throw error;

    let createdId = null;
    if (typeof data === "string") createdId = data;
    if (!createdId) {
      // fallback: try find by label + dates + amount recently created
      const start = String(tx.date_start || tx.dateStart || "").slice(0,10);
      const { data: rows, error: ferr } = await sb
        .from(TB_CONST.TABLES.transactions)
        .select("id, created_at")
        .eq("wallet_id", walletId)
        .eq("label", tx.label)
        .eq("date_start", start)
        .order("created_at", { ascending: false })
        .limit(1);
      if (ferr) throw ferr;
      createdId = rows && rows[0] ? rows[0].id : null;
    }

    if (!createdId) throw new Error("Impossible de retrouver la transaction recréée.");

    // Freeze snapshot for the created tx (best-effort)
    await _ensureTxSnapshotById(createdId, wallet.currency, tx.date_start || tx.dateStart);

    // Delete old tx
    const { error: derr } = await sb.rpc("delete_transaction", { p_tx_id: editingTxId });
    if (derr) throw derr;

    closeModal();
    editingTxId = null;
    await refreshFromServer();
  });
}

async function deleteTx(txId) {
  const ok = confirm("Supprimer cette transaction ? (solde wallet ajusté automatiquement)");
  if (!ok) return;

  await safeCall("Suppression", async () => {
    const { error } = await sb.rpc("delete_transaction", { p_tx_id: txId });
    if (error) throw error;
    await refreshFromServer();
  });
}

async function markTxAsPaid(txId) {
  await safeCall("Marquer comme payé", async () => {
    const tx = state.transactions.find((t) => t.id === txId);
    if (!tx) throw new Error("Transaction introuvable.");
    if (tx.type !== "expense" && tx.type !== "income") throw new Error("Seules les dépenses et les recettes sont concernées.");
    if (tx.payNow) return;

    const wallet = findWallet(tx.walletId);
    if (!wallet) throw new Error("Wallet introuvable.");

    const { error } = await tbRpcWithRetry("update_transaction_v2", {
      p_tx_id: tx.id,
      p_wallet_id: tx.walletId,
      p_type: tx.type,
      p_amount: Number(tx.amount),
      p_currency: wallet.currency,
      p_category: tx.category || "Autre",
      p_label: tx.label || "",
      p_date_start: tx.dateStart,
      p_date_end: tx.dateEnd || tx.dateStart,
      p_pay_now: true,
      p_out_of_budget: !!tx.outOfBudget,
      p_night_covered: !!tx.nightCovered,
      ..._txBuildFxSnapshotArgs(tx.dateStart, String(wallet.currency || '').toUpperCase())
    });

    if (error) throw error;

    await refreshFromServer();
  });
}

/* =========================
   Expose handlers globally
   (fix: onclick="deleteTx(...)" etc.)
   ========================= */
(function exposeTxHandlersToWindow() {
  try {
    window.openTxModal = openTxModal;
    window.openTxEditModal = openTxEditModal;
    window.saveModal = saveModal;
    window.closeModal = closeModal;
    window.deleteTx = deleteTx;
    window.markTxAsPaid = markTxAsPaid;
  } catch (_) {
    // no-op
  }
})();
