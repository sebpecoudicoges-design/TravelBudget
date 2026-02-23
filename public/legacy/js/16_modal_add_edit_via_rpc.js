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

        const { error } = await sb.rpc("update_transaction", {
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
        });
        if (error) throw error;
      } else {
        const { error } = await sb.rpc("apply_transaction", {
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
    if (tx.type !== "expense") throw new Error("Seules les dépenses sont concernées.");
    if (tx.payNow) return;

    const wallet = findWallet(tx.walletId);
    if (!wallet) throw new Error("Wallet introuvable.");

    const { error } = await sb.rpc("update_transaction", {
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