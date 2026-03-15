/* =========================
   Modal: add/edit via RPC
   ========================= */

function fillModalSelects() {
  const elW = document.getElementById("m-wallet");
  const elC = document.getElementById("m-category");
  if (!elW || !elC) return;


  const activeTravelId = state?.activeTravelId || null;

  const wallets = (state.wallets || []).filter((w) => {
    const tid = w?.travelId || w?.travel_id || null;
    if (!tid) return true; // legacy
    if (!activeTravelId) return true;
    return String(tid) === String(activeTravelId);
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

function fillModalSubcategorySelect(categoryName, selectedValue) {
  const el = document.getElementById("m-subcategory");
  if (!el) return;
  const selected = String(selectedValue || "").trim();
  const rows = (typeof getCategorySubcategories === "function") ? getCategorySubcategories(categoryName) : [];
  const options = ['<option value="">Aucune</option>'];
  for (const row of rows) {
    const name = String(row?.name || "").trim();
    if (!name) continue;
    options.push(`<option value="${escapeHTML(name)}">${escapeHTML(name)}</option>`);
  }
  if (selected && !rows.some((row) => String(row?.name || '').trim().toLowerCase() === selected.toLowerCase())) {
    options.push(`<option value="${escapeHTML(selected)}">${escapeHTML(selected)}</option>`);
  }
  el.innerHTML = options.join("");
  el.value = selected || "";
}

function wireSubcategoryLogic(selectedValue) {
  const catEl = document.getElementById("m-category");
  const subEl = document.getElementById("m-subcategory");
  if (!catEl || !subEl) return;
  fillModalSubcategorySelect(catEl.value, selectedValue);
  catEl.onchange = () => {
    fillModalSubcategorySelect(catEl.value, "");
    if (typeof catEl._tbNightVisibility === "function") catEl._tbNightVisibility();
  };
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

  // Interactive safeguard: if we can't compute FX because EUR->XXX is missing, ask once now.
  // This is intentionally placed on the write-path to avoid prompting during boot.
  try {
    if (txC !== baseC && typeof window.tbFxEnsureEurRatesInteractive === "function") {
      const out = window.tbFxEnsureEurRatesInteractive([txC, baseC], `Nécessaire pour convertir ${txC} → ${baseC}`);
      if (out && out.cancelled) {
        throw new Error("Sauvegarde annulée (taux manquant).");
      }
    }
  } catch (e) {
    // propagate a clean error message
    throw (e instanceof Error) ? e : new Error(String(e));
  }

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

// Build a payload that matches the SECURITY DEFINER `apply_transaction_v2` signature(s).
// IMPORTANT: PostgREST resolves overloads by parameter names. Our DB currently has multiple
// apply_transaction_v2 overloads; missing required params leads to PGRST202 (404 schema cache).
// This helper always sends the full argument set with explicit NULLs/defaults.
function _txBuildApplyV2Args(core, fxOverride) {
  const uid = (window.sbUser && sbUser.id) ? sbUser.id : null;
  const fxDate = fxOverride?.fxDate || core.dateStart;
  const fxCur = fxOverride?.fxCurrency || core.currency;
  const fxArgs = _txBuildFxSnapshotArgs(fxDate, fxCur);

  const cat = String(core.category || "").trim() || (TB_CONST?.CATS?.other || "Autre");

  return {
    p_wallet_id: core.walletId,
    p_type: core.type,
    p_label: core.label,
    p_amount: core.amount,
    p_currency: core.currency,
    p_date_start: core.dateStart,
    p_date_end: core.dateEnd,
    p_category: cat,
    // optional
    p_subcategory: (core.subcategory !== undefined ? core.subcategory : null),
    p_pay_now: !!core.payNow,
    p_out_of_budget: !!core.outOfBudget,
    p_night_covered: !!core.nightCovered,
    p_affects_budget: (core.affectsBudget !== undefined ? !!core.affectsBudget : !core.outOfBudget),
    p_trip_expense_id: core.tripExpenseId || null,
    p_trip_share_link_id: core.tripShareLinkId || null,
    // fx snapshot
    ...fxArgs,
    // keep at end
    p_user_id: uid
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

  const typeEl = document.getElementById("m-type");
  const catEl = document.getElementById("m-category");
  if (typeEl) typeEl.onchange = updateNightVisibility;
  if (catEl) catEl._tbNightVisibility = updateNightVisibility;

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
  fillModalSubcategorySelect("Autre", "");
  document.getElementById("m-start").value = now;
  document.getElementById("m-end").value = now;
  document.getElementById("m-label").value = "";
  document.getElementById("m-paynow").checked = true;
  document.getElementById("m-out").checked = false;
  document.getElementById("m-night").checked = false;

  wireSubcategoryLogic("");
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
  fillModalSubcategorySelect(tx.category || "Autre", tx.subcategory || "");
  document.getElementById("m-start").value = tx.dateStart;
  document.getElementById("m-end").value = tx.dateEnd || tx.dateStart;
  document.getElementById("m-label").value = tx.label || "";
  document.getElementById("m-paynow").checked = !!tx.payNow;
  document.getElementById("m-out").checked = !!tx.outOfBudget;
  document.getElementById("m-night").checked = !!tx.nightCovered;

  wireSubcategoryLogic(tx.subcategory || "");
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
      const res = await sb.rpc(fnName, args);
      return res;
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

function _txIsMissingRpcSignature(err) {
  const code = String(err?.code || '').trim();
  const msg = String(err?.message || '').toLowerCase();
  const details = String(err?.details || '').toLowerCase();
  const hint = String(err?.hint || '').toLowerCase();
  return (
    code === 'PGRST202' ||
    code === '42883' ||
    msg.includes('schema cache') ||
    details.includes('schema cache') ||
    msg.includes('does not exist') ||
    msg.includes('no function matches') ||
    details.includes('does not exist') ||
    details.includes('no function matches') ||
    hint.includes('add explicit type casts')
  );
}

function _txRpcSigCacheKey() {
  return 'tb.update_transaction_v2.signature';
}

function _txGetCachedUpdateRpcAvailability() {
  try {
    return localStorage.getItem(_txRpcSigCacheKey()) || '';
  } catch (_) {
    return '';
  }
}

function _txSetCachedUpdateRpcAvailability(value) {
  try {
    if (!value) localStorage.removeItem(_txRpcSigCacheKey());
    else localStorage.setItem(_txRpcSigCacheKey(), String(value));
  } catch (_) {}
}

async function _txPatchSubcategoryDirect(txId, subcategory) {
  const s = _tbGetSB();
  if (!s) throw new Error('Supabase non prêt.');
  const payload = { subcategory: subcategory || null };
  return await s
    .from(TB_CONST.TABLES.transactions)
    .update(payload)
    .eq('id', txId);
}

function _txFindPeriodIdForDate(dateStr) {
  const ds = String(dateStr || '').slice(0, 10);
  if (!ds) return null;
  const periods = Array.isArray(state?.periods) ? state.periods : [];
  const activeTravelId = String(state?.activeTravelId || '').trim();
  for (const p of periods) {
    if (!p) continue;
    const tid = String(p.travelId || p.travel_id || '').trim();
    if (activeTravelId && tid && tid !== activeTravelId) continue;
    const s = String(p.start || p.dateStart || '').slice(0, 10);
    const e = String(p.end || p.dateEnd || '').slice(0, 10);
    if (s && e && ds >= s && ds <= e) return String(p.id || '').trim() || null;
  }
  return String(state?.period?.id || '').trim() || null;
}

async function _updateTransactionDirectCompat(args) {
  const s = _tbGetSB();
  if (!s) throw new Error('Supabase non prêt.');
  const txId = String(args?.p_tx_id || args?.p_id || '').trim();
  if (!txId) throw new Error('Transaction introuvable.');
  const dateStart = String(args?.p_date_start || '').slice(0, 10);
  const dateEnd = String(args?.p_date_end || args?.p_date_start || '').slice(0, 10) || dateStart;

  const { data: currentRow, error: currentErr } = await s
    .from(TB_CONST.TABLES.transactions)
    .select('id, fx_snapshot_at, fx_rate_snapshot, fx_source_snapshot, fx_base_currency_snapshot, fx_tx_currency_snapshot')
    .eq('id', txId)
    .maybeSingle();
  if (currentErr) return { data: null, error: currentErr };

  const payload = {
    wallet_id: args?.p_wallet_id || null,
    type: args?.p_type || null,
    amount: args?.p_amount,
    currency: args?.p_currency || null,
    category: args?.p_category || null,
    subcategory: (args?.p_subcategory === undefined ? null : (args?.p_subcategory || null)),
    label: args?.p_label || null,
    date_start: dateStart || null,
    date_end: dateEnd || null,
    pay_now: !!args?.p_pay_now,
    out_of_budget: !!args?.p_out_of_budget,
    night_covered: !!args?.p_night_covered,
    updated_at: new Date().toISOString(),
  };

  const fxLocked = !!(currentRow?.fx_snapshot_at);
  if (!fxLocked) {
    if (args?.p_fx_rate_snapshot !== undefined) payload.fx_rate_snapshot = args?.p_fx_rate_snapshot;
    if (args?.p_fx_source_snapshot !== undefined) payload.fx_source_snapshot = args?.p_fx_source_snapshot;
    if (args?.p_fx_snapshot_at !== undefined) payload.fx_snapshot_at = args?.p_fx_snapshot_at;
    if (args?.p_fx_base_currency_snapshot !== undefined) payload.fx_base_currency_snapshot = args?.p_fx_base_currency_snapshot;
    if (args?.p_fx_tx_currency_snapshot !== undefined) payload.fx_tx_currency_snapshot = args?.p_fx_tx_currency_snapshot;
  }

  const periodId = _txFindPeriodIdForDate(dateStart);
  if (periodId) payload.period_id = periodId;
  const activeTravelId = String(state?.activeTravelId || '').trim();
  if (activeTravelId) payload.travel_id = activeTravelId;
  const res = await s
    .from(TB_CONST.TABLES.transactions)
    .update(payload)
    .eq('id', txId)
    .select('id')
    .maybeSingle();
  if (res?.error) return res;
  return { data: res.data?.id || txId, error: null, _tbUsedDirectFallback: true, _tbFxLocked: fxLocked };
}

async function _updateTransactionRpcCompat(args) {
  const txId = String(args?.p_tx_id || args?.p_id || '').trim() || null;
  const hasSubcategory = Object.prototype.hasOwnProperty.call(args || {}, 'p_subcategory');
  const cachedAvailability = _txGetCachedUpdateRpcAvailability();
  if (cachedAvailability === 'missing') {
    return await _updateTransactionDirectCompat(args);
  }

  const variants = [];
  if (args && args.p_tx_id && !args.p_id) variants.push({ ...args, p_id: args.p_tx_id });
  variants.push({ ...args });

  let sawMissingSignature = false;
  for (const variant of variants) {
    try {
      const res = await tbRpcWithRetry('update_transaction_v2', variant);
      if (!res?.error) {
        _txSetCachedUpdateRpcAvailability('present');
        return { ...res, _tbUsedLegacyFallback: false };
      }
      if (!_txIsMissingRpcSignature(res.error)) return res;
      sawMissingSignature = true;
    } catch (e) {
      if (!_txIsMissingRpcSignature(e)) throw e;
      sawMissingSignature = true;
    }
  }

  const fallbackArgs = {
    p_id: args?.p_tx_id || args?.p_id,
    p_wallet_id: args?.p_wallet_id,
    p_type: args?.p_type,
    p_label: args?.p_label,
    p_amount: args?.p_amount,
    p_currency: args?.p_currency,
    p_date_start: args?.p_date_start,
    p_date_end: args?.p_date_end,
    p_category: args?.p_category,
    p_pay_now: args?.p_pay_now,
    p_out_of_budget: args?.p_out_of_budget,
    p_night_covered: args?.p_night_covered,
    p_user_id: args?.p_user_id || null,
    p_trip_expense_id: args?.p_trip_expense_id || null,
    p_trip_share_link_id: args?.p_trip_share_link_id || null,
  };

  try {
    const res = await tbRpcWithRetry('update_transaction_v2', fallbackArgs);
    if (res?.error) {
      if (!_txIsMissingRpcSignature(res.error)) return res;
    } else {
      _txSetCachedUpdateRpcAvailability('present');
      if (hasSubcategory && txId) {
        const patchRes = await _txPatchSubcategoryDirect(txId, args?.p_subcategory || null);
        if (patchRes?.error) return patchRes;
      }
      return { ...res, _tbUsedLegacyFallback: true };
    }
  } catch (e) {
    if (!_txIsMissingRpcSignature(e)) throw e;
    sawMissingSignature = true;
  }

  if (sawMissingSignature) {
    _txSetCachedUpdateRpcAvailability('missing');
    return await _updateTransactionDirectCompat(args);
  }
  return await _updateTransactionDirectCompat(args);
}
async function saveModal() {
  if (_savingTx) return;
  _savingTx = true;

  const btn = document.querySelector("#modal button.btn.primary");
  if (btn) btn.disabled = true;

  try {
    await window.tbWithBusy(async () => {
      await safeCall("Sauvegarde", async () => {
      const type = document.getElementById("m-type").value;
      const walletId = document.getElementById("m-wallet").value;
      const amount = parseFloat(document.getElementById("m-amount").value);
      const category = document.getElementById("m-category").value || "Autre";
      const subcategory = String(document.getElementById("m-subcategory")?.value || "").trim() || null;
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

        // Ensure FX conversion is available for tx currency -> segment/base currency.
        // (Prompts manual EUR rates if provider doesn't support the currency.)
        {
          const txCur = String(wallet?.currency || "").trim().toUpperCase();
          const seg = (typeof window.getBudgetSegmentForDate === "function") ? window.getBudgetSegmentForDate(start) : null;
          const baseCur = String(seg?.baseCurrency || state?.period?.baseCurrency || "EUR").trim().toUpperCase();
          if (txCur && baseCur && txCur !== baseCur) {
            const ensure = (typeof window.tbFxEnsurePairInteractive === "function")
              ? window.tbFxEnsurePairInteractive(txCur, baseCur, "Taux requis pour enregistrer la transaction")
              : (typeof window.tbFxEnsureEurRatesInteractive === "function")
                ? window.tbFxEnsureEurRatesInteractive([txCur, baseCur], "Taux requis pour enregistrer la transaction")
                : { ok: true };
            if (!ensure || ensure.ok !== true) throw new Error("FX manquant : opération annulée");
          }
        }

        const { data, error } = await _updateTransactionRpcCompat({
          p_tx_id: editingTxId,
          p_wallet_id: walletId,
          p_type: type,
          p_amount: amount,
          p_currency: wallet.currency,
          p_category: category,
          p_label: label,
          p_subcategory: subcategory,
          p_date_start: start,
          p_date_end: end,
          p_pay_now: payNow,
          p_out_of_budget: outOfBudget,
          p_night_covered: type === "expense" && /^transport( internationale?| international)?$/i.test(String(category || "").trim()) ? nightCovered : false,
          // FX snapshot is computed for the transaction date + transaction currency.
          // (Use local variables here; `form` is not in scope.)
          ..._txBuildFxSnapshotArgs(start, wallet.currency)
        });
        if (error) throw error;
      } else {
        // Ensure FX conversion is available for tx currency -> segment/base currency.
        {
          const txCur = String(wallet?.currency || "").trim().toUpperCase();
          const seg = (typeof window.getBudgetSegmentForDate === "function") ? window.getBudgetSegmentForDate(start) : null;
          const baseCur = String(seg?.baseCurrency || state?.period?.baseCurrency || "EUR").trim().toUpperCase();
          if (txCur && baseCur && txCur !== baseCur) {
            const ensure = (typeof window.tbFxEnsurePairInteractive === "function")
              ? window.tbFxEnsurePairInteractive(txCur, baseCur, "Taux requis pour enregistrer la transaction")
              : (typeof window.tbFxEnsureEurRatesInteractive === "function")
                ? window.tbFxEnsureEurRatesInteractive([txCur, baseCur], "Taux requis pour enregistrer la transaction")
                : { ok: true };
            if (!ensure || ensure.ok !== true) throw new Error("FX manquant : opération annulée");
          }
        }

        const { data, error } = await tbRpcWithRetry(
          TB_CONST.RPCS.apply_transaction_v2 || "apply_transaction_v2",
          _txBuildApplyV2Args({
            walletId,
            type,
            label,
            amount,
            currency: wallet.currency,
            category,
            subcategory,
            dateStart: start,
            dateEnd: end,
            payNow,
            outOfBudget,
            nightCovered: (type === "expense" && /^transport( internationale?| international)?$/i.test(String(category || "").trim())) ? nightCovered : false,
            affectsBudget: !outOfBudget,
            tripExpenseId: null,
            tripShareLinkId: null
          })
        );
        if (error) throw error;
      }

      closeModal();
      editingTxId = null;
      if (typeof window.tbAfterMutationRefresh === "function") await window.tbAfterMutationRefresh("tx:save");
      else await refreshFromServer();
      });
    }, editingTxId ? "Mise à jour en cours…" : "Enregistrement en cours…");
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

    const { data, error } = await tbRpcWithRetry(
      TB_CONST.RPCS.apply_transaction_v2 || "apply_transaction_v2",
      _txBuildApplyV2Args({
        walletId,
        type: tx.type,
        label: tx.label,
        amount: Number(tx.amount),
        // Preserve original tx currency (do not auto-switch to wallet currency)
        currency: (txCurrency || String(wallet.currency || '').toUpperCase()),
        category: tx.category,
        subcategory: tx.subcategory || null,
        dateStart: txDateStart,
        dateEnd: txDateEnd,
        // Preserve flags exactly (critical: avoid flipping paid/unpaid state)
        payNow: txPayNow,
        outOfBudget: txOutOfBudget,
        nightCovered: txNightCovered,
        affectsBudget: (tx.affects_budget !== undefined) ? !!tx.affects_budget : (tx.affectsBudget !== undefined ? !!tx.affectsBudget : !txOutOfBudget),
        tripExpenseId: tx.trip_expense_id || tx.tripExpenseId || null,
        tripShareLinkId: tx.trip_share_link_id || tx.tripShareLinkId || null
      }, { fxDate: txDateStart, fxCurrency: (txCurrency || String(wallet.currency || '').toUpperCase() || 'EUR') })
    );
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
    try {
      try { if (typeof window.tbBusyStart === "function") window.tbBusyStart("Suppression en cours…"); } catch (_) {}
      const { error } = await sb.rpc("delete_transaction", { p_tx_id: txId });
      if (error) {
        const code = String(error.code || "");
        const msg = String(error.message || "").toLowerCase();
        const details = String(error.details || "").toLowerCase();
        const isTripLinked = code === "23503" && (
          msg.includes("trip_expenses") ||
          details.includes("trip_expenses") ||
          msg.includes("trip_expenses_transaction_fk") ||
          details.includes("trip_expenses_transaction_fk")
        );
        if (isTripLinked) {
          const friendly = "Suppression bloquée : cette transaction est liée à une dépense Partage. Supprime d'abord la dépense depuis l'onglet Trip.";
          try {
            if (typeof toastWarn === "function") toastWarn(friendly);
            else alert(friendly);
          } catch (_) {}
          return;
        }
        throw error;
      }
      try { if (typeof closeModal === "function") closeModal(); } catch (_) {}
      if (typeof window.tbAfterMutationRefresh === "function") await window.tbAfterMutationRefresh("tx:delete");
      else await refreshFromServer();
    } finally {
      try { if (typeof window.tbBusyEnd === "function") window.tbBusyEnd(); } catch (_) {}
    }
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

    const hasLockedFx = !!(tx.fxSnapshotAt || tx.fx_snapshot_at || tx.fxRateSnapshot || tx.fx_rate_snapshot);
    const fxArgs = hasLockedFx
      ? {
          p_fx_rate_snapshot: null,
          p_fx_source_snapshot: null,
          p_fx_snapshot_at: null,
          p_fx_base_currency_snapshot: null,
          p_fx_tx_currency_snapshot: null,
        }
      : _txBuildFxSnapshotArgs(tx.dateStart, String(tx.currency || wallet.currency || '').toUpperCase());

    const { error } = await _updateTransactionRpcCompat({
      p_tx_id: tx.id,
      p_wallet_id: tx.walletId,
      p_type: tx.type,
      p_amount: Number(tx.amount),
      p_currency: tx.currency || wallet.currency,
      p_category: tx.category || "Autre",
      p_label: tx.label || "",
      p_date_start: tx.dateStart,
      p_date_end: tx.dateEnd || tx.dateStart,
      p_pay_now: true,
      p_out_of_budget: !!tx.outOfBudget,
      p_night_covered: !!tx.nightCovered,
      ...fxArgs
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


/* =========================
   Cash: ATM withdraw shortcut
   - Some UI buttons call openAtmWithdrawModal(walletId)
   ========================= */
(function(){
  if (typeof window.openAtmWithdrawModal === "function") return;

  window.openAtmWithdrawModal = function(walletId){
    try{
      if (typeof window.openTxModal !== "function") throw new Error("openTxModal() missing");
      window.openTxModal("expense", walletId);

      // Best-effort prefill
      const labelEl = document.getElementById("tx-label");
      if (labelEl && !labelEl.value) labelEl.value = "Retrait ATM";

      const catEl = document.getElementById("tx-category");
      if (catEl && !catEl.value) catEl.value = "Autre";

      const payEl = document.getElementById("tx-pay-now");
      if (payEl) payEl.checked = true;

      // Amount left empty on purpose
    }catch(e){
      console.warn("[ATM] openAtmWithdrawModal failed", e);
      alert(e?.message || e);
    }
  };
})();
