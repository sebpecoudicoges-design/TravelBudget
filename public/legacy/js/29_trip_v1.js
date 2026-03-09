/* =========================
   Trip (V1) - simple & stable
   - Supabase sync
   - Linkage to budget transactions (optional, prevents duplicates)
   - Equal split across all members
   Notes:
     Unified schema uses trip_id only (group_id removed).
   ========================= */

(function () {
  // ---------- tiny utils (self-contained) ----------
  // ---------- participants / sharing ----------
  async function _getMyTripRole(tripId) {
    try {
      const uid = await _ensureSession();
      if (!uid) return null;
      const { data, error } = await sb
        .from(TB_CONST.TABLES.trip_participants)
        .select("role")
        .eq("trip_id", tripId)
        .eq("auth_user_id", uid)
        .maybeSingle();
      if (error) return null;
      return data?.role || null;
    } catch (e) {
      return null;
    }
  }

  async function _createInviteLink(tripId, role, inviteeName, inviteeEmail) {
  // role: 'member' | 'viewer'
  const token = (crypto?.randomUUID ? crypto.randomUUID() : (Date.now() + "-" + Math.random()).replace(/\./g, ""));
  const expiresAt = new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString(); // 14 days
  const createdBy = await _ensureSession();

  // Create (optional) placeholder member for this invite, to keep a stable "who is who" mapping.
  // If trip_members.email column doesn't exist yet, we retry without it (backward compatible).
  let memberId = null;
  try {
    const name = String(inviteeName || "").trim() || "Invité";
    const email = String(inviteeEmail || "").trim() || null;

    const memberPayload = {
      trip_id: tripId,
      name,
      is_me: false,
      auth_user_id: null,
      user_id: createdBy,
    };

    if (email) memberPayload.email = email;

    let { data: mData, error: mErr } = await sb
      .from(TB_CONST.TABLES.trip_members)
      .insert([memberPayload])
      .select("id")
      .single();

    if (mErr && String(mErr.message || "").toLowerCase().includes("column") && String(mErr.message || "").toLowerCase().includes("email")) {
      // Retry if email column not present yet
      delete memberPayload.email;
      const retry = await sb.from(TB_CONST.TABLES.trip_members).insert([memberPayload]).select("id").single();
      mData = retry.data;
      mErr = retry.error;
    }
    if (mErr) throw mErr;
    memberId = mData?.id || null;
  } catch (e) {
    console.warn("[Trip] placeholder member creation failed (non-blocking):", e);
    memberId = null;
  }

  const payload = {
    token,
    trip_id: tripId,
    role: role || "member",
    created_by: createdBy,
    expires_at: expiresAt,
  };
  if (memberId) payload.member_id = memberId;

  const { error } = await sb.from(TB_CONST.TABLES.trip_invites).insert(payload);
  if (error) throw error;

  const base = window.location.origin + window.location.pathname;
  const url = base + "#trip&invite=" + encodeURIComponent(token);
  return url;
}

  async function _acceptInviteFromURL() {
    const hash = window.location.hash || "";
    const m = hash.match(/(?:\?|&|#)invite=([^&]+)/);
    if (!m) return false;
    const token = decodeURIComponent(m[1] || "");
    if (!token) return false;

    try {
      await _rpcAcceptInvite(token);

      // remove invite param from hash (avoid re-accept on reload)
      const cleaned = hash.replace(/([#&?])invite=[^&]+&?/g, "$1").replace(/[#&?]$/, "");
      window.location.hash = cleaned || "#trip";
      toastOk("[Trip] Invitation acceptée.");
      // New membership/visibility: reload trip list on next refresh
      try { tripState._tripsLoaded = false; } catch (_) {}
      return true;
    } catch (e) {
      toastWarn("[Trip] Invitation invalide/expirée.");
      return false;
    }
  }

async function _rpcAcceptInvite(token) {
  // Prefer new RPC names, fallback to legacy if DB not migrated.
  const rpcName = TB_CONST?.RPCS?.accept_trip_invite || "accept_trip_invite";
  const legacy = TB_CONST?.RPCS?.trip_accept_invite || "trip_accept_invite";
  let { error } = await sb.rpc(rpcName, { p_token: token });
  if (error) {
    // fallback
    const res2 = await sb.rpc(legacy, { p_token: token });
    if (res2.error) throw res2.error;
  }
}

async function _rpcBindMe(tripId) {
  if (!tripId || typeof tripId !== "string") return;
  // basic UUID sanity check to avoid 400 on RPC
  if (!/^[0-9a-fA-F-]{36}$/.test(tripId)) return;

  const rpcName = TB_CONST?.RPCS?.bind_trip_member_to_auth || "bind_trip_member_to_auth";
  const legacy = TB_CONST?.RPCS?.trip_bind_member_to_auth || "trip_bind_member_to_auth";
  try {
    let { error } = await sb.rpc(rpcName, { p_trip_id: tripId });
    if (error) {
      const res2 = await sb.rpc(legacy, { p_trip_id: tripId });
      if (res2.error) throw res2.error;
    }
    return true;
  } catch (e) {
    // Non-blocking: trip can still load, but "me" won't be binded.
    console.warn("[Trip] bind member RPC failed:", e);
    return false;
  }
}

  function escapeHTML(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  
function _shareText(text) {
  try {
    if (navigator && navigator.share) {
      return navigator.share({ text });
    }
  } catch (e) {}
  _copyToClipboard(text);
  toastInfo("[Trip] Copié (partage non supporté ici).");
}

function toastWarn(msg) {
  console.warn("[Trip]", msg);
  alert("[Trip] " + msg);
}

function toastInfo(msg) {
  // Fallback info toast; reuse toastWarn styling if no dedicated info toast exists.
  try {
    if (typeof window.toastInfo === "function" && window.toastInfo !== toastInfo) {
      return window.toastInfo(msg);
    }
  } catch (e) {}
  if (typeof toastOk === "function") return toastOk(msg);
  return toastWarn(msg);
}

async function _copyToClipboard(text) {
  try {
    if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(String(text ?? ""));
      return true;
    }
  } catch (e) {}
  try {
    window.prompt("Copie ce texte :", String(text ?? ""));
    return true;
  } catch (e) {
    return false;
  }
}

function toastOk(msg) {
    console.log("[Trip]", msg);
  }

  const TRIP_ACTIVE_KEY = "travelbudget_trip_active_id_v1";
  const TRIP_TAB_KEY = "travelbudget_trip_tab_v1";

  let tripState = {
    trips: [],
    activeTripId: null,
    members: [],
    expenses: [],
    shares: [],
    myRole: null,
    lastInviteUrl: null,
    editingExpenseId: null,
    editingExpenseDraft: null,
    _tripsLoaded: false,
  };

  // Reset Trip state on auth account switch (prevents cross-account UI bleed)
  try {
    window.addEventListener("tb:auth_scope_changed", () => {
      try { localStorage.removeItem(TRIP_ACTIVE_KEY); } catch (_) {}
      tripState.trips = [];
      tripState.activeTripId = null;
      tripState.members = [];
      tripState.expenses = [];
      tripState.shares = [];
      tripState.myRole = null;
      tripState.lastInviteUrl = null;
      tripState.editingExpenseId = null;
      tripState.editingExpenseDraft = null;
      tripState._tripsLoaded = false;
    });
  } catch (_) {}

  function _el(id) { return document.getElementById(id); }
  function _root() { return document.getElementById("trip-root"); }

  function _fmtMoney(v, cur) {
    const n = Number(v) || 0;
    return `${Math.round(n * 100) / 100} ${cur || ""}`.trim();
  }

  function _safeFx(amount, from, to) {
    if (typeof window.safeFxConvert === "function") return window.safeFxConvert(amount, from, to, 0);
    if (typeof window.fxConvert === "function") {
      const v = window.fxConvert(amount, from, to);
      return (v === null || !Number.isFinite(v)) ? 0 : v;
    }
    // last-resort fallback: EUR<->BASE using period eurBaseRate when possible
    const base = String(state?.period?.baseCurrency || "").toUpperCase();
    const eurBaseRate = Number(state?.period?.eurBaseRate) || 0;
    const a = Number(amount) || 0;
    const f = String(from || "").toUpperCase();
    const t = String(to || "").toUpperCase();
    if (f === t) return a;
    if (eurBaseRate > 0 && ((f === "EUR" && t === base) || (f === base && t === "EUR"))) {
      return (f === "EUR") ? (a * eurBaseRate) : (a / eurBaseRate);
    }
    return 0;
  }

  function _round2(n) {
    return Math.round((Number(n) || 0) * 100) / 100;
  }

  

function _isoToday() {
  // YYYY-MM-DD in local time
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ---------------------------------------------------------------------------
// RPC helpers
// ---------------------------------------------------------------------------

// Supabase/PostgREST chooses function overloads based on the *named args*.
// With overloaded functions, we must send a payload that matches one signature
// unambiguously. To avoid 404 / ambiguity, always send the full arg set.
async function _rpcApplyTransactionV2(sb, rawArgs) {
  const uid = await _ensureSession();
  const args = rawArgs || {};

  // Normalize dates to ISO yyyy-mm-dd (function expects date)
  const dateStart = args.p_date_start || args.date_start || _isoToday();
  const dateEnd = args.p_date_end || args.date_end || dateStart;
  const cur = args.p_currency || args.currency || null;

  // Build full payload with explicit NULLs for optional args.
  // This matches our current DB overloads and avoids PostgREST schema-cache mismatch.
  const payload = {
    p_wallet_id: args.p_wallet_id ?? null,
    p_type: args.p_type ?? null,
    p_label: args.p_label ?? null,
    p_amount: args.p_amount ?? null,
    p_currency: cur,
    p_date_start: dateStart,
    p_date_end: dateEnd,
    p_category: (args.p_category === undefined) ? null : args.p_category,
    p_subcategory: (args.p_subcategory === undefined) ? null : args.p_subcategory,
    p_pay_now: !!args.p_pay_now,
    p_out_of_budget: !!args.p_out_of_budget,
    p_night_covered: !!args.p_night_covered,
    p_affects_budget: !!args.p_affects_budget,
    p_trip_expense_id: (args.p_trip_expense_id === undefined) ? null : args.p_trip_expense_id,
    p_trip_share_link_id: (args.p_trip_share_link_id === undefined) ? null : args.p_trip_share_link_id,
    p_fx_rate_snapshot: (args.p_fx_rate_snapshot === undefined) ? null : args.p_fx_rate_snapshot,
    p_fx_source_snapshot: (args.p_fx_source_snapshot === undefined) ? null : args.p_fx_source_snapshot,
    p_fx_snapshot_at: (args.p_fx_snapshot_at === undefined) ? null : args.p_fx_snapshot_at,
    p_fx_base_currency_snapshot: (args.p_fx_base_currency_snapshot === undefined) ? null : args.p_fx_base_currency_snapshot,
    p_fx_tx_currency_snapshot: (args.p_fx_tx_currency_snapshot === undefined) ? null : args.p_fx_tx_currency_snapshot,
    p_user_id: args.p_user_id ?? uid,
  };

  // Convenience: if caller didn't provide FX snapshot, derive from helpers
  if (typeof _rpcFxSnapshotArgs === "function") {
    const fx = _rpcFxSnapshotArgs(dateStart, cur);
    for (const k of Object.keys(fx || {})) {
      if (payload[k] === null || payload[k] === undefined) payload[k] = fx[k];
    }
  }

  return sb.rpc(TB_CONST.RPCS.apply_transaction_v2 || "apply_transaction_v2", payload);
}

// FX snapshot args for RPC writes (Trip)
// Uses global fxSnapshotArgsForWrite() if available.
function _rpcFxSnapshotArgs(dateISO, txCurrency) {
  if (typeof window.fxSnapshotArgsForWrite !== "function") return {};
  const snap = window.fxSnapshotArgsForWrite(dateISO, txCurrency);
  return {
    p_fx_rate_snapshot: snap.fx_rate_snapshot,
    p_fx_source_snapshot: snap.fx_source_snapshot,
    p_fx_snapshot_at: snap.fx_snapshot_at,
    p_fx_base_currency_snapshot: snap.fx_base_currency_snapshot,
    p_fx_tx_currency_snapshot: snap.fx_tx_currency_snapshot
  };
}


// Trip Split: atomic expense+shares (prefer V8.3.1 DB-first, fallback V8.1)
async function _rpcTripApplyExpense(sb, tripId, payload) {
  await _ensureSession();
  const fn = (TB_CONST && TB_CONST.RPCS && TB_CONST.RPCS.trip_apply_expense_v2)
    ? TB_CONST.RPCS.trip_apply_expense_v2
    : ((TB_CONST && TB_CONST.RPCS && TB_CONST.RPCS.trip_apply_expense_v1) ? TB_CONST.RPCS.trip_apply_expense_v1 : "trip_apply_expense_v1");
  return sb.rpc(fn, { p_trip_id: tripId, p_payload: payload });
}


function _normalizeCurrency(cur) {
    const fallback = (state?.period?.baseCurrency || "THB");
    const c = String(cur || fallback || "").trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(c)) return String(fallback).trim().toUpperCase();
    return c;
  }



  function _findPeriodIdForDate(dateStr) {
    const d = parseISODateOrNull(dateStr);
    if (!d) return state?.period?.id || null;
    const periods = state?.periods || [];
    for (const p of periods) {
      const s = parseISODateOrNull(p.start);
      const e = parseISODateOrNull(p.end);
      if (s && e && d >= s && d <= e) return p.id;
    }
    // fallback: current active period
    return state?.period?.id || null;
  }
  // Equal split with cent-safe rounding (sum of shares == amount)
  function _splitEqual(amount, memberIds) {
    const amt = Number(amount);
    const n = memberIds.length;
    if (!isFinite(amt) || amt <= 0 || n <= 0) return [];
    const cents = Math.round(amt * 100);
    const base = Math.floor(cents / n);
    let rem = cents - base * n; // 0..n-1
    const out = [];
    for (let i = 0; i < n; i++) {
      const c = base + (rem > 0 ? 1 : 0);
      if (rem > 0) rem--;
      out.push(c / 100);
    }
    return out;
  }
  function _computeSplitParts(amt, members, split) {
    const ids = members.map(m => m.id);
    const n = ids.length;
    const mode = (split?.mode || "equal");
    // Work in cents to ensure sum(parts) == amt
    const totalCents = Math.round(amt * 100);

    if (mode === "percent") {
      const pcts = split?.percents || {};
      // Default: equal percents
      const pctList = ids.map(id => {
        const v = Number(pcts[id]);
        return isFinite(v) ? v : (100 / n);
      });
      let sumPct = pctList.reduce((a,b)=>a+b,0);
      if (!isFinite(sumPct) || sumPct <= 0) {
        throw new Error("Répartition en % invalide : renseigne des pourcentages (>0).");
      }
      // UX: if user didn't sum exactly to 100%, rescale proportionally (tolerance still applies for tiny drift)
      if (Math.abs(sumPct - 100) > 0.01) {
        pctList = pctList.map(p => (p * 100) / sumPct);
        sumPct = 100;
      }
      // Convert to cents
      let cents = pctList.map(p => Math.floor(totalCents * (p/100)));
      let used = cents.reduce((a,b)=>a+b,0);
      let delta = totalCents - used;
      // Distribute remaining cents to highest fractional remainders
      const remainders = pctList.map((p,i)=>({
        i,
        r: (totalCents * (p/100)) - cents[i]
      })).sort((a,b)=>b.r-a.r);
      let k=0;
      while (delta>0 && k<remainders.length*2) {
        const i = remainders[k % remainders.length].i;
        cents[i] += 1;
        delta -= 1;
        k += 1;
      }
      return cents.map(c => c/100);
    }

    if (mode === "amount") {
      const amts = split?.amounts || {};
      // Read member amounts in cents
      let cents = ids.map(id => {
        const v = Number(amts[id]);
        return isFinite(v) ? Math.round(v*100) : 0;
      });
      const sum = cents.reduce((a,b)=>a+b,0);
      const diff = totalCents - sum;
      if (Math.abs(diff) > 1) { // > 0.01
        throw new Error("Répartition en montants invalide : la somme doit égaler le total.");
      }
      // Adjust last member by remaining cent (if needed) to match exactly
      if (diff !== 0 && cents.length) cents[cents.length-1] += diff;
      return cents.map(c => c/100);
    }

    // equal (default)
    return _splitEqual(amt, ids);
  }


  
  function _validateSplitParts(amt, parts) {
    const a = Number(amt) || 0;
    if (!isFinite(a) || a <= 0) throw new Error("Montant dépense invalide.");
    if (!Array.isArray(parts) || !parts.length) throw new Error("Répartition invalide.");
    let sum = 0;
    for (const x of parts) {
      const v = Number(x);
      if (!isFinite(v)) throw new Error("Répartition invalide (NaN).");
      if (v < -0.0001) throw new Error("Répartition invalide (valeur négative).");
      sum += v;
    }
    // Accept tiny rounding tolerance (0.01)
    if (Math.abs(sum - a) > 0.01) {
      throw new Error(`Répartition incohérente : somme ${_round2(sum)} ≠ total ${_round2(a)}.`);
    }
    return true;
  }

async function _findMatchingTransactions({ date, amount, currency }) {
    const uid = await _ensureSession();
    // Heuristic match: same day, same amount/currency, expense type, and not already linked to a trip expense.
    const { data, error } = await sb
      .from(TB_CONST.TABLES.transactions)
      .select("id,label,category,wallet_id,trip_expense_id,date_start,date_end,amount,currency,pay_now,out_of_budget")
      
      .eq("type", "expense")
      .eq("amount", amount)
      .eq("currency", currency)
      .eq("date_start", date)
      .eq("date_end", date)
      .is("trip_expense_id", null)
      .order("created_at", { ascending: false })
      .limit(5);
    if (error) throw error;
    return data || [];
  }

  async function _linkExpenseToTransaction(expenseId, transactionId) {
    const uid = await _ensureSession();

    // Enforce 1 transaction = 1 expense (and 1 expense = 1 transaction)
    // Defensive re-check on server to avoid races / stale state.
    const { data: exRow, error: exErr } = await sb
      .from(TB_CONST.TABLES.trip_expenses)
      .select("id,transaction_id")
      .eq("id", expenseId)
      .maybeSingle();
    if (exErr) throw exErr;
    if (exRow?.transaction_id && exRow.transaction_id !== transactionId) {
      throw new Error("Cette dépense Trip est déjà liée à une transaction.");
    }

    const { data: txRow, error: txErr } = await sb
      .from(TB_CONST.TABLES.transactions)
      .select("id,trip_expense_id")
      .eq("id", transactionId)
      .maybeSingle();
    if (txErr) throw txErr;
    if (txRow?.trip_expense_id && txRow.trip_expense_id !== expenseId) {
      throw new Error("Cette transaction Budget est déjà liée à une autre dépense Trip.");
    }

    // Best-effort 2-step link; rollback on partial failure.
    const { error: e1 } = await sb
      .from(TB_CONST.TABLES.trip_expenses)
      .update({ transaction_id: transactionId })
      
      .eq("id", expenseId);
    if (e1) throw e1;

    const { error: e2 } = await sb
      .from(TB_CONST.TABLES.transactions)
      .update({ trip_expense_id: expenseId })
      
      .eq("id", transactionId);
    if (e2) {
      await sb.from(TB_CONST.TABLES.trip_expenses).update({ transaction_id: null }).eq("id", expenseId);
      throw e2;
    }
  }

  async function _unlinkExpenseFromTransaction(expense) {
    const uid = await _ensureSession();
    if (!expense?.transactionId) return;
    const txId = expense.transactionId;

    await sb.from(TB_CONST.TABLES.transactions).update({ trip_expense_id: null }).eq("id", txId);
    await sb.from(TB_CONST.TABLES.trip_expenses).update({ transaction_id: null }).eq("id", expense.id);
  }


  function _groupBy(arr, keyFn) {
    const m = new Map();
    for (const x of arr) {
      const k = keyFn(x);
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(x);
    }
    return m;
  }

async function _getShareBudgetLink(expenseId, memberId) {
  const uid = await _ensureSession();
  const { data, error } = await sb
    .from(TB_CONST.TABLES.trip_expense_budget_links)
    .select("transaction_id")
    
    .eq("expense_id", expenseId)
    .eq("member_id", memberId)
    .limit(1);
  if (error) throw error;
  return data?.[0]?.transaction_id || null;
}

async function _linkShareToTransaction({ expenseId, memberId, transactionId }) {
  const uid = await _ensureSession();
  const { error } = await sb
    .from(TB_CONST.TABLES.trip_expense_budget_links)
    .upsert([{
      user_id: uid,
      trip_id: tripState.activeTripId,
      expense_id: expenseId,
      member_id: memberId,
      transaction_id: transactionId,
    }], { onConflict: "expense_id,member_id" });
  if (error) throw error;
}


  async function _ensureSession() {
    // sb and sbUser are globals in your app
    if (typeof sb === "undefined") throw new Error("Supabase client (sb) introuvable.");
    const uid = sbUser?.id || sbUser?.user?.id;
    if (uid) return uid;

    // try fetch from auth
    const { data, error } = await sb.auth.getUser();
    if (error) throw error;
    if (!data?.user?.id) throw new Error("Session non prête. Connecte-toi puis recharge.");
    sbUser = data.user;
    return data.user.id;
  }

  async function _loadTrips() {
    const uid = await _ensureSession();
    const { data, error } = await sb
      .from(TB_CONST.TABLES.trip_groups)
      .select("*")
      
      .order("created_at", { ascending: false });
    if (error) throw error;

    tripState.trips = data || [];

    // Global net balances (per trip & currency) for current user (optional view)
    try {
      const { data: netRows, error: netErr } = await sb
        .from(TB_CONST.TABLES.v_trip_user_net_balances)
        .select("*");
      if (!netErr) tripState.globalNetRows = netRows || [];
    } catch (e) {
      tripState.globalNetRows = [];
    }



    const stored = localStorage.getItem(TRIP_ACTIVE_KEY);
    if (stored && tripState.trips.some(t => t.id === stored)) {
      tripState.activeTripId = stored;
    } else {
      tripState.activeTripId = tripState.trips[0]?.id || null;
    }

    tripState._tripsLoaded = true;
  }

  async function _loadActiveData() {
    const uid = await _ensureSession();
    const tripId = tripState.activeTripId;

    tripState.members = [];
    tripState.expenses = [];
    tripState.shares = [];
    if (!tripId) return;

    tripState.myRole = await _getMyTripRole(tripId);

    // Ensure my member row exists/bound for this trip (identity = auth.uid)
    await _rpcBindMe(tripId);

    const [{ data: m, error: mErr }, { data: e, error: eErr }, { data: s, error: sErr }, { data: se, error: seErr }] = await Promise.all([
      sb.from(TB_CONST.TABLES.trip_members).select("*").eq("trip_id", tripId).order("created_at", { ascending: true }),
      sb.from(TB_CONST.TABLES.trip_expenses).select("*").eq("trip_id", tripId).order("date", { ascending: false }),
      sb.from(TB_CONST.TABLES.trip_expense_shares).select("*").eq("trip_id", tripId),
      sb.from(TB_CONST.TABLES.trip_settlement_events).select("*").eq("trip_id", tripId).is("cancelled_at", null),
    ]);

    if (mErr) throw mErr;
    if (eErr) throw eErr;
    if (sErr) throw sErr;
    if (seErr) throw seErr;

    // Determine *exactly one* "me" member row.
    // Rationale: legacy data may have multiple rows with user_id == auth.uid() (because user_id was used as NOT NULL placeholder).
    // We prefer auth_user_id match, then is_me flag, then a single (first) user_id match.
    const _meRow = (m || []).find(r => r.auth_user_id && (String(r.auth_user_id) === String(uid)))
      || (m || []).find(r => r.is_me === true)
      || (m || []).find(r => r.user_id && (String(r.user_id) === String(uid)))
      || null;
    const _meId = _meRow ? _meRow.id : null;

    tripState.members = (m || []).map(x => {
      const isMe = !!(_meId && (String(x.id) === String(_meId)));
      return {
        id: x.id,
        name: x.name,
        email: x.email || ((isMe && (sbUser && sbUser.email)) ? sbUser.email : null),
        authUserId: x.auth_user_id || null,
        userId: x.user_id || null,
        isMe,
      };
    });

    tripState.expenses = (e || []).map(x => ({
      id: x.id,
      date: x.date,
      label: x.label,
      amount: Number(x.amount),
      currency: x.currency,
      paidByMemberId: x.paid_by_member_id,
      transactionId: x.transaction_id || null,
      createdAt: x.created_at,
    }));

    tripState.shares = (s || []).map(x => ({
      id: x.id,
      expenseId: x.expense_id,
      memberId: x.member_id,
      shareAmount: Number(x.share_amount),
    }));


    tripState.settlementEvents = (se || []).map(x => ({
      id: x.id,
      tripId: x.trip_id,
      currency: x.currency,
      amount: Number(x.amount),
      fromMemberId: x.from_member_id,
      toMemberId: x.to_member_id,
      transactionId: x.transaction_id || null,
      createdBy: x.created_by || null,
      createdAt: x.created_at,
      cancelledAt: x.cancelled_at || null,
    }));
  }

  function _computeBalances() {
    const byCurrency = new Map();
    const members = tripState.members;
    const memberIds = new Set(members.map(m => m.id));

    function add(cur, memberId, amt) {
      if (!memberIds.has(memberId)) return;
      if (!byCurrency.has(cur)) byCurrency.set(cur, new Map());
      const m = byCurrency.get(cur);
      m.set(memberId, (m.get(memberId) || 0) + amt);
    }

    const sharesByExpense = _groupBy(tripState.shares, s => s.expenseId);

    for (const ex of tripState.expenses) {
      const cur = ex.currency || (state?.period?.baseCurrency || "");
      const paidBy = ex.paidByMemberId;

      if (paidBy) add(cur, paidBy, Number(ex.amount) || 0);

      const sh = sharesByExpense.get(ex.id) || [];
      for (const row of sh) add(cur, row.memberId, -(Number(row.shareAmount) || 0));
    }

    

    // Apply persisted settlements (netting): payer (from) balance increases, receiver (to) decreases
    for (const ev of (tripState.settlementEvents || [])) {
      if (!ev || ev.cancelledAt) continue;
      const cur = ev.currency || (state?.period?.baseCurrency || "");
      const amt = Number(ev.amount) || 0;
      if (ev.fromMemberId) add(cur, ev.fromMemberId, amt);
      if (ev.toMemberId) add(cur, ev.toMemberId, -amt);
    }

return byCurrency;
  }

  async function _fetchBalancesFromDb(tripId) {
    try {
      if (!tripId || !sb?.rpc) return null;
      if (!TB_CONST?.RPCS?.trip_get_balances_v1) return null;

      const { data, error } = await sb.rpc(TB_CONST.RPCS.trip_get_balances_v1, { p_trip_id: tripId });
      if (error) return null;
      if (!Array.isArray(data)) return null;

      const out = new Map(); // cur -> Map(memberId -> net)
      for (const row of data) {
        const cur = String(row.currency || "").toUpperCase();
        const memberId = row.member_id || row.memberId;
        const net = Number(row.net || 0);
        if (!cur || !memberId) continue;
        if (!out.has(cur)) out.set(cur, new Map());
        const m = out.get(cur);
        m.set(memberId, (m.get(memberId) || 0) + net);
      }
      return out;
    } catch (e) {
      return null;
    }
  }

  async function _fetchSettlementSuggestionsFromDb(tripId, useNetRaw = true) {
    try {
      if (!tripId || !sb?.rpc) return null;
      if (!TB_CONST?.RPCS?.trip_suggest_settlements_v1) return null;

      const { data, error } = await sb.rpc(TB_CONST.RPCS.trip_suggest_settlements_v1, {
        p_trip_id: tripId,
        p_use_net_raw: !!useNetRaw,
      });
      if (error) return null;
      if (!Array.isArray(data)) return null;
      return data;
    } catch (e) {
      return null;
    }
  }


  // Unify balances into the user's display currency.
  // Goal: the UI follows the account base currency (or period base if missing), instead of forcing THB.
  function _unifyBalancesToDisplayCurrency(balancesByCurRaw) {
    const out = new Map();
    const displayCur = String(state?.user?.baseCurrency || state?.period?.baseCurrency || "EUR").toUpperCase();
    const m = new Map();
    const eurBaseRate = Number(state?.period?.eurBaseRate) || 0;

    function convert(amount, fromCur) {
      const amt = Number(amount) || 0;
      const from = String(fromCur || "").toUpperCase();
      if (!from) return 0;
      if (from === displayCur) return amt;
      if (typeof window.fxConvert === "function") {
        const v = window.fxConvert(amt, from, displayCur);
        return Number.isFinite(v) ? v : 0;
      }
      // last-resort fallback: support EUR<->BASE using period eurBaseRate when displayCur or from is EUR
      if (eurBaseRate > 0) {
        if (from === "EUR" && displayCur === "THB") return amt * eurBaseRate;
        if (from === "THB" && displayCur === "EUR") return amt / eurBaseRate;
      }
      return 0;
    }

    for (const [cur, mm] of (balancesByCurRaw || new Map()).entries()) {
      for (const [memberId, v] of (mm || new Map()).entries()) {
        const cv = convert(v, cur);
        if (!cv) continue;
        m.set(memberId, (m.get(memberId) || 0) + cv);
      }
    }

    out.set(displayCur, m);
    return out;
  }




  function _computeSettlements(balancesByCur) {
    const out = new Map(); // cur -> [{fromId,toId,amount}]
    for (const [cur, m] of balancesByCur.entries()) {
      const creditors = [];
      const debtors = [];
      for (const [memberId, bal] of m.entries()) {
        const v = Number(bal) || 0;
        if (v > 1e-9) creditors.push({ memberId, amt: _round2(v) });
        else if (v < -1e-9) debtors.push({ memberId, amt: _round2(-v) }); // positive debt
      }

      creditors.sort((a, b) => b.amt - a.amt);
      debtors.sort((a, b) => b.amt - a.amt);

      const transfers = [];
      let i = 0, j = 0;
      while (i < debtors.length && j < creditors.length) {
        const d = debtors[i];
        const c = creditors[j];
        const pay = Math.min(d.amt, c.amt);
        const payR = _round2(pay);
        if (payR > 0) transfers.push({ fromId: d.memberId, toId: c.memberId, amount: payR });

        d.amt = _round2(d.amt - payR);
        c.amt = _round2(c.amt - payR);

        if (d.amt <= 1e-9) i++;
        if (c.amt <= 1e-9) j++;
      }

      out.set(cur, transfers);
    }
    return out;
  }


  function _buildSettlementMessage(tripName, members, settlementsByCur) {
      const lines = [];
      lines.push(`Règlements • ${tripName}`);
      for (const [cur, transfers] of settlementsByCur.entries()) {
        if (!transfers?.length) continue;
        lines.push("");
        lines.push(`— ${cur} —`);
        for (const t of transfers) {
          const from = members.find(x => x.id === t.fromId);
          const to = members.find(x => x.id === t.toId);
          lines.push(`${from?.name || "—"} → ${to?.name || "—"} : ${_fmtMoney(t.amount, cur)}`);
        }
      }
      if (lines.length === 1) lines.push("", "Aucun règlement nécessaire.");
      return lines.join("\n");
    }

  
let _settleModalState = null;

function _ensureSettleModal() {
  let modal = document.getElementById("tripSettleModal");
  if (modal) return modal;
  modal = document.createElement("div");
  modal.id = "tripSettleModal";
  modal.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.35);display:none;align-items:center;justify-content:center;z-index:9999;padding:16px;";
  modal.innerHTML = `
    <div style="background:#fff;max-width:520px;width:100%;border-radius:14px;padding:14px 14px 12px 14px;box-shadow:0 10px 30px rgba(0,0,0,.2);">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
        <h3 style="margin:0;">Règlement</h3>
        <button id="tripSettleClose" class="btn" type="button">✕</button>
      </div>
      <div class="muted" id="tripSettleContext" style="margin-top:6px;"></div>

      <div style="margin-top:12px;">
        <label class="muted" style="display:block;margin-bottom:6px;">Wallet</label>
        <select id="tripSettleWallet" class="input" style="width:100%"></select>
        <div class="muted" id="tripSettleWalletNote" style="margin-top:6px;font-size:12px;"></div>
      </div>

      <div style="margin-top:12px;">
        <label class="muted" style="display:block;margin-bottom:6px;">Montant (dans la devise de la wallet)</label>
        <input id="tripSettleAmount" class="input" type="number" step="0.01" style="width:100%" />
      </div>

      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px;justify-content:flex-end;">
        <button id="tripSettleOnly" class="btn" type="button">Marquer réglé (sans wallet)</button>
        <button id="tripSettleConfirm" class="btn btn-primary" type="button">Valider</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.querySelector("#tripSettleClose").onclick = () => {
    modal.style.display = "none";
    _settleModalState = null;
  };
  modal.onclick = (e) => {
    if (e.target === modal) {
      modal.style.display = "none";
      _settleModalState = null;
    }
  };
  return modal;
}

function _openSettlementModal({ fromId, toId, currency, amount, isOut, members }) {
  const modal = _ensureSettleModal();
  _settleModalState = { fromId, toId, currency, amount, isOut };
  const from = members.find(x => x.id === fromId)?.name || "—";
  const to = members.find(x => x.id === toId)?.name || "—";
  modal.querySelector("#tripSettleContext").textContent =
    `${from} → ${to} : ${_fmtMoney(amount, currency)} (devise règlement)`;

  const sel = modal.querySelector("#tripSettleWallet");
  sel.innerHTML = "";
  const wallets = state.wallets || [];
  for (const w of wallets) {
    const opt = document.createElement("option");
    opt.value = w.id;
    opt.textContent = `${w.name || "Wallet"} • ${String(w.currency||"").toUpperCase()}`;
    sel.appendChild(opt);
  }
  const defaultWalletId = state.activeWalletId || (wallets[0]?.id || "");
  if (defaultWalletId) sel.value = defaultWalletId;

  const inputAmt = modal.querySelector("#tripSettleAmount");
  // Prefill with settlement amount. If wallet currency differs, user should overwrite manually.
  inputAmt.value = String(_round2(amount));

  const refreshNote = () => {
    const wid = sel.value;
    const w = wallets.find(x => x.id === wid);
    const wCur = String(w?.currency || "").toUpperCase();
    const note = modal.querySelector("#tripSettleWalletNote");
    if (!wCur) {
      note.textContent = "";
      return;
    }
    if (wCur !== String(currency||"").toUpperCase()) {
      note.textContent = `⚠ Wallet en ${wCur}. Saisis le montant équivalent dans ${wCur} (conversion manuelle). Le règlement Trip reste en ${String(currency||"").toUpperCase()}.`;
    } else {
      note.textContent = "";
    }
  };
  sel.onchange = refreshNote;
  refreshNote();

  modal.querySelector("#tripSettleOnly").onclick = async () => {
    try {
      await _persistSettlementEventOnly();
      modal.style.display = "none";
      _settleModalState = null;
      toastOk("Règlement enregistré (sans wallet).");
    } catch (e) {
      toastWarn("[Trip] " + normalizeSbError(e));
    }
  };

  modal.querySelector("#tripSettleConfirm").onclick = async () => {
    try {
      const wid = sel.value;
      const wallets2 = state.wallets || [];
      const w = wallets2.find(x => x.id === wid);
      if (!w) throw new Error("Wallet introuvable.");
      const wCur = String(w.currency || "").toUpperCase();
      const amtW = _round2(Number(inputAmt.value) || 0);
      if (!(amtW > 0)) throw new Error("Montant invalide.");
      await _persistSettlementWithWallet({ walletId: wid, walletCurrency: wCur, walletAmount: amtW });
      modal.style.display = "none";
      _settleModalState = null;
      toastOk("Règlement enregistré.");
    } catch (e) {
      toastWarn("[Trip] " + normalizeSbError(e));
    }
  };

  modal.style.display = "flex";
}
// =========================
// Expense detail modal (UX)
// =========================
let _expDetailModalState = null;

async function _fetchExpenseAuditDetails(expenseId) {
  const out = {
    walletTransaction: null,
    budgetLinks: [],
    budgetTransactionsById: new Map(),
    myShareLink: null,
  };

  if (!expenseId) return out;

  const ex = (tripState.expenses || []).find(x => x.id === expenseId) || null;
  const txIds = new Set();
  if (ex?.transactionId) txIds.add(ex.transactionId);

  try {
    const { data, error } = await sb
      .from(TB_CONST.TABLES.trip_expense_budget_links)
      .select("id,member_id,transaction_id,created_at")
      .eq("expense_id", expenseId)
      .order("created_at", { ascending: true });
    if (!error && Array.isArray(data)) {
      out.budgetLinks = data.map(row => ({
        id: row.id,
        memberId: row.member_id,
        transactionId: row.transaction_id,
        createdAt: row.created_at || null,
      }));
      out.budgetLinks.forEach(row => { if (row.transactionId) txIds.add(row.transactionId); });

      const me = (tripState.members || []).find(m => m.isMe) || null;
      if (me) out.myShareLink = out.budgetLinks.find(row => row.memberId === me.id) || null;
    }
  } catch (_) {}

  if (txIds.size) {
    try {
      const { data, error } = await sb
        .from(TB_CONST.TABLES.transactions)
        .select("id,wallet_id,type,amount,currency,category,label,date_start,date_end,pay_now,out_of_budget,affects_budget,is_internal,created_at")
        .in("id", Array.from(txIds));
      if (!error && Array.isArray(data)) {
        for (const row of data) {
          out.budgetTransactionsById.set(row.id, {
            id: row.id,
            walletId: row.wallet_id || null,
            type: row.type || null,
            amount: Number(row.amount || 0),
            currency: row.currency || null,
            category: row.category || null,
            label: row.label || null,
            dateStart: row.date_start || null,
            dateEnd: row.date_end || null,
            payNow: row.pay_now === true,
            outOfBudget: row.out_of_budget === true,
            affectsBudget: row.affects_budget !== false,
            isInternal: row.is_internal === true,
            createdAt: row.created_at || null,
          });
        }
      }
    } catch (_) {}
  }

  if (ex?.transactionId) out.walletTransaction = out.budgetTransactionsById.get(ex.transactionId) || null;
  return out;
}

function _walletNameById(walletId) {
  return (state.wallets || []).find(w => w.id === walletId)?.name || null;
}

function _yesNoPill(v) {
  return v
    ? '<span class="pill" style="font-size:12px;">Oui</span>'
    : '<span class="pill" style="font-size:12px; background:rgba(0,0,0,0.06); color:#333;">Non</span>';
}

function _ensureExpenseDetailModal() {
  let modal = document.getElementById("tripExpenseDetailModal");
  if (modal) return modal;
  modal = document.createElement("div");
  modal.id = "tripExpenseDetailModal";
  modal.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.35);display:none;align-items:center;justify-content:center;z-index:9999;padding:16px;";
  modal.innerHTML = `
    <div style="background:#fff;max-width:620px;width:100%;border-radius:14px;padding:14px 14px 12px 14px;box-shadow:0 10px 30px rgba(0,0,0,.2);">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
        <h3 style="margin:0;">Détail dépense</h3>
        <button id="tripExpDetailClose" class="btn" type="button">✕</button>
      </div>
      <div class="muted" id="tripExpDetailMeta" style="margin-top:6px;"></div>
      <div id="tripExpDetailBody" style="margin-top:12px;"></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px;justify-content:flex-end;">
        <button id="tripExpDetailOk" class="btn" type="button">OK</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const close = () => {
    modal.style.display = "none";
    _expDetailModalState = null;
  };
  modal.querySelector("#tripExpDetailClose").onclick = close;
  modal.querySelector("#tripExpDetailOk").onclick = close;
  modal.onclick = (e) => { if (e.target === modal) close(); };
  return modal;
}

async function _openExpenseDetailModal({ ex, shares, members }) {
  const modal = _ensureExpenseDetailModal();
  _expDetailModalState = { expenseId: ex?.id || null };

  const payer = members.find(m => m.id === ex.paidByMemberId) || null;
  const payerName = payer ? payer.name : "—";

  modal.querySelector("#tripExpDetailMeta").textContent = `${ex.date || "—"} • payé par ${payerName}`.trim();
  modal.querySelector("#tripExpDetailBody").innerHTML = `<div class="muted">Chargement du détail…</div>`;
  modal.style.display = "flex";

  const audit = await _fetchExpenseAuditDetails(ex?.id);
  if (!_expDetailModalState || _expDetailModalState.expenseId !== ex?.id) return;

  const amt = Number(ex.amount) || 0;
  const cur = ex.currency;

  let sum = 0;
  const rows = (shares || []).map(sh => {
    const m = members.find(mm => mm.id === sh.memberId);
    const shareAmt = Number(sh.shareAmount) || 0;
    sum += shareAmt;
    const pct = (amt > 0) ? (shareAmt / amt * 100) : 0;
    return `
      <tr>
        <td style="padding:6px 8px;border-bottom:1px solid rgba(0,0,0,.06);">${escapeHTML(m?.name || "—")}</td>
        <td style="padding:6px 8px;border-bottom:1px solid rgba(0,0,0,.06);text-align:right;white-space:nowrap;">${_fmtMoney(shareAmt, cur)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid rgba(0,0,0,.06);text-align:right;white-space:nowrap;">${_round2(pct)}%</td>
      </tr>
    `;
  }).join("");

  const diff = _round2(sum - amt);
  const warn = (Math.abs(diff) >= 0.01)
    ? `<div class="muted" style="margin-top:10px;padding:10px;border-radius:10px;background:rgba(255,165,0,.12);">
         ⚠ Somme des parts = ${_fmtMoney(sum, cur)} (écart ${_fmtMoney(diff, cur)}). Vérifie la répartition.
       </div>`
    : "";

  const mainTx = audit.walletTransaction;
  const mainTxWallet = mainTx?.walletId ? _walletNameById(mainTx.walletId) : null;
  const budgetRows = (audit.budgetLinks || []).map(link => {
    const member = members.find(mm => mm.id === link.memberId) || null;
    const tx = audit.budgetTransactionsById.get(link.transactionId) || null;
    const walletName = tx?.walletId ? _walletNameById(tx.walletId) : null;
    return `
      <tr>
        <td style="padding:6px 8px;border-bottom:1px solid rgba(0,0,0,.06);">${escapeHTML(member?.name || "—")}</td>
        <td style="padding:6px 8px;border-bottom:1px solid rgba(0,0,0,.06);text-align:right;white-space:nowrap;">${tx ? _fmtMoney(tx.amount, tx.currency) : "—"}</td>
        <td style="padding:6px 8px;border-bottom:1px solid rgba(0,0,0,.06);">${escapeHTML(tx?.category || "—")}</td>
        <td style="padding:6px 8px;border-bottom:1px solid rgba(0,0,0,.06);">${escapeHTML(walletName || "—")}</td>
        <td style="padding:6px 8px;border-bottom:1px solid rgba(0,0,0,.06);">${tx ? `${_yesNoPill(tx.payNow)} / ${_yesNoPill(tx.outOfBudget)}` : "—"}</td>
      </tr>
    `;
  }).join("");

  const body = `
    <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap;">
      <div style="min-width:0;">
        <div style="font-weight:700;font-size:16px;">${escapeHTML(ex.label || "Dépense")}</div>
        <div class="muted" style="font-size:12px;margin-top:2px;">Trip expense</div>
      </div>
      <div style="font-weight:800;font-size:18px;white-space:nowrap;">${_fmtMoney(amt, cur)}</div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin-top:12px;">
      <div style="border:1px solid rgba(0,0,0,.08);border-radius:12px;padding:10px;">
        <div class="muted" style="font-size:12px;margin-bottom:6px;">Lien wallet principal</div>
        <div style="font-weight:700;">${mainTx ? "Oui" : "Non"}</div>
        <div class="muted" style="font-size:12px;margin-top:6px;">${mainTx ? `${escapeHTML(mainTxWallet || "Wallet inconnue")} • ${escapeHTML(mainTx.category || "—")}` : "Aucune transaction wallet principale liée."}</div>
        ${mainTx ? `<div class="muted" style="font-size:12px;margin-top:6px;">${_fmtMoney(mainTx.amount, mainTx.currency)} • pay_now ${mainTx.payNow ? "oui" : "non"} • out_of_budget ${mainTx.outOfBudget ? "oui" : "non"}</div>` : ``}
      </div>

      <div style="border:1px solid rgba(0,0,0,.08);border-radius:12px;padding:10px;">
        <div class="muted" style="font-size:12px;margin-bottom:6px;">Liens budget de parts</div>
        <div style="font-weight:700;">${audit.budgetLinks.length}</div>
        <div class="muted" style="font-size:12px;margin-top:6px;">${audit.myShareLink ? "Ta part budget est liée à une transaction." : "Aucun lien trouvé pour ta part."}</div>
      </div>

      <div style="border:1px solid rgba(0,0,0,.08);border-radius:12px;padding:10px;">
        <div class="muted" style="font-size:12px;margin-bottom:6px;">Cohérence répartition</div>
        <div style="font-weight:700;">${Math.abs(diff) < 0.01 ? "OK" : "À vérifier"}</div>
        <div class="muted" style="font-size:12px;margin-top:6px;">Somme parts ${_fmtMoney(sum || 0, cur)} • total ${_fmtMoney(amt, cur)}</div>
      </div>
    </div>

    <div style="margin-top:12px;">
      <div class="muted" style="font-size:12px;margin-bottom:6px;">Répartition</div>
      <div style="overflow:auto;border:1px solid rgba(0,0,0,.08);border-radius:12px;">
        <table style="width:100%;border-collapse:collapse;min-width:420px;">
          <thead>
            <tr>
              <th style="text-align:left;padding:8px;border-bottom:1px solid rgba(0,0,0,.08);">Participant</th>
              <th style="text-align:right;padding:8px;border-bottom:1px solid rgba(0,0,0,.08);">Part</th>
              <th style="text-align:right;padding:8px;border-bottom:1px solid rgba(0,0,0,.08);">%</th>
            </tr>
          </thead>
          <tbody>
            ${rows || `<tr><td colspan="3" class="muted" style="padding:10px;">Aucune répartition trouvée.</td></tr>`}
          </tbody>
          <tfoot>
            <tr>
              <td style="padding:8px;font-weight:700;">Total</td>
              <td style="padding:8px;text-align:right;font-weight:700;white-space:nowrap;">${_fmtMoney(sum || 0, cur)}</td>
              <td style="padding:8px;text-align:right;font-weight:700;">${amt > 0 ? _round2((sum/amt)*100) : 0}%</td>
            </tr>
          </tfoot>
        </table>
      </div>
      ${warn}
    </div>

    <div style="margin-top:12px;">
      <div class="muted" style="font-size:12px;margin-bottom:6px;">Liens budget</div>
      <div style="overflow:auto;border:1px solid rgba(0,0,0,.08);border-radius:12px;">
        <table style="width:100%;border-collapse:collapse;min-width:520px;">
          <thead>
            <tr>
              <th style="text-align:left;padding:8px;border-bottom:1px solid rgba(0,0,0,.08);">Participant</th>
              <th style="text-align:right;padding:8px;border-bottom:1px solid rgba(0,0,0,.08);">Montant tx</th>
              <th style="text-align:left;padding:8px;border-bottom:1px solid rgba(0,0,0,.08);">Catégorie</th>
              <th style="text-align:left;padding:8px;border-bottom:1px solid rgba(0,0,0,.08);">Wallet</th>
              <th style="text-align:left;padding:8px;border-bottom:1px solid rgba(0,0,0,.08);">pay_now / out</th>
            </tr>
          </thead>
          <tbody>
            ${budgetRows || `<tr><td colspan="5" class="muted" style="padding:10px;">Aucun lien budget enregistré pour cette dépense.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;

  modal.querySelector("#tripExpDetailBody").innerHTML = body;
  modal.style.display = "flex";
}


async function _createSettlementEventOnly({ tripId, currency, amount, fromId, toId }) {
  const cur = String(currency || "").trim().toUpperCase();
  const amt = _round2(Number(amount) || 0);
  if (!tripId || !fromId || !toId || !cur || !(amt > 0)) throw new Error("Règlement invalide.");

  if (sb?.rpc && TB_CONST?.RPCS?.trip_create_settlement_v1) {
    const { data, error } = await sb.rpc(TB_CONST.RPCS.trip_create_settlement_v1, {
      p_trip_id: tripId,
      p_currency: cur,
      p_amount: amt,
      p_from_member_id: fromId,
      p_to_member_id: toId,
    });
    if (!error) return data;
    console.warn("[Trip] trip_create_settlement_v1 fallback", error);
  }

  const uid = await _ensureSession();
  const eventId = (crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + "-" + Math.random().toString(16).slice(2);
  const { error: seInsErr } = await sb.from(TB_CONST.TABLES.trip_settlement_events).insert([{
    id: eventId,
    trip_id: tripId,
    currency: cur,
    amount: amt,
    from_member_id: fromId,
    to_member_id: toId,
    created_by: uid,
  }]);
  if (seInsErr) throw seInsErr;
  return eventId;
}

async function _cancelSettlementEvent(settlementEventId) {
  const id = String(settlementEventId || "").trim();
  if (!id) throw new Error("Règlement introuvable.");

  if (sb?.rpc && TB_CONST?.RPCS?.trip_cancel_settlement_v1) {
    const { error } = await sb.rpc(TB_CONST.RPCS.trip_cancel_settlement_v1, { p_event_id: id });
    if (!error) return;
    console.warn("[Trip] trip_cancel_settlement_v1 fallback", error);
  }

  const { error } = await sb
    .from(TB_CONST.TABLES.trip_settlement_events)
    .update({ cancelled_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

async function _persistSettlementEventOnly() {
  if (!_settleModalState) throw new Error("Aucun règlement en cours.");
  const { fromId, toId, currency, amount } = _settleModalState;
  await _createSettlementEventOnly({
    tripId: tripState.activeTripId,
    currency,
    amount,
    fromId,
    toId,
  });
  if (typeof window.__tripRefresh === "function") await window.__tripRefresh({ activeOnly: true });
}

async function _persistSettlementWithWallet({ walletId, walletCurrency, walletAmount }) {
  if (!_settleModalState) throw new Error("Aucun règlement en cours.");
  const uid = await _ensureSession();
  const members = tripState.members || [];
  const { fromId, toId, currency, amount, isOut } = _settleModalState;

  const eventId = (crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + "-" + Math.random().toString(16).slice(2);

  // 1) Persist settlement event (Trip currency & amount)
  const curTrip = String(currency || "").trim().toUpperCase();
  const amtTrip = _round2(Number(amount) || 0);
  const { error: seInsErr } = await sb.from(TB_CONST.TABLES.trip_settlement_events).insert([{
    id: eventId,
    trip_id: tripState.activeTripId,
    currency: curTrip,
    amount: amtTrip,
    from_member_id: fromId,
    to_member_id: toId,
    created_by: uid,
  }]);
  if (seInsErr) throw seInsErr;

  // 2) Create wallet transaction (wallet currency & amount)
  const label = isOut
    ? `[Trip] SETTLE:${eventId} • Règlement à ${(members.find(x => x.id === toId)?.name) || "—"} (${curTrip} ${_round2(amtTrip)} → ${walletCurrency} ${_round2(walletAmount)})`
    : `[Trip] SETTLE:${eventId} • Règlement reçu de ${(members.find(x => x.id === fromId)?.name) || "—"} (${curTrip} ${_round2(amtTrip)} → ${walletCurrency} ${_round2(walletAmount)})`;

  const date = _isoToday();
  const txType = isOut ? "expense" : "income";

  const { error: rpcErr } = await _rpcApplyTransactionV2(sb, {
    p_user_id: uid,
    p_wallet_id: walletId,
    p_type: txType,
    p_label: label,
    p_amount: _round2(walletAmount),
    p_currency: walletCurrency,
    p_date_start: date,
    p_date_end: date,
    // category is NOT NULL in transactions; settlement wallet tx is an internal movement
    p_category: (TB_CONST?.CATS?.internal_movement || "Mouvement interne"),
    p_subcategory: null,
    p_pay_now: true,
    p_out_of_budget: true,
    p_night_covered: false,
    p_affects_budget: false,
    p_trip_expense_id: null,
    p_trip_share_link_id: null,
    ..._rpcFxSnapshotArgs(date, walletCurrency)
  });
  if (rpcErr) throw rpcErr;

  // 3) Best-effort link tx id back to settlement event
  try {
    const { data: txRow } = await sb
      .from(TB_CONST.TABLES.transactions)
      .select("id")
      .eq("user_id", uid)
      .eq("label", label)
      .eq("currency", walletCurrency)
      .eq("amount", _round2(walletAmount))
      .eq("date_start", date)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (txRow?.id) {
      await sb.from(TB_CONST.TABLES.trip_settlement_events)
        .update({ transaction_id: txRow.id })
        .eq("id", eventId);
    }
  } catch (e) {
    console.warn("[Trip] settlement tx link failed", e);
  }

  if (typeof window.__tripRefresh === "function") await window.__tripRefresh({ activeOnly: true });
}

// Rename a trip member (participant) — minimal UX (prompt)

async function _recordSettlementAndTx({ fromId, toId, amount, currency }) {
      const uid = await _ensureSession();
      const members = tripState.members || [];
      const me = members.find(x => x.isMe);
      if (!me) throw new Error("Aucun participant 'moi' défini dans ce trip.");
  
      const isOut = fromId === me.id;
      const isIn = toId === me.id;
      if (!isOut && !isIn) {
        throw new Error("Tu ne peux enregistrer qu’un règlement qui te concerne (payer ou recevoir).");
      }
  
      const cur = String(currency || "").trim().toUpperCase();
      const amt = _round2(Number(amount) || 0);
      if (!(amt > 0)) throw new Error("Montant invalide.");
  
      // Choose wallet (required)
      const walletId = tripState.settlementWalletId || state.activeWalletId || (state.wallets?.[0]?.id || "");
      if (!walletId) throw new Error("Aucune wallet disponible. Crée/sélectionne une wallet.");
  
      const w = (state.wallets || []).find(x => x.id === walletId);
      if (!w) throw new Error("Wallet introuvable.");
      if (String(w.currency || "").toUpperCase() !== cur) {
        toastWarn(`Conversion manuelle requise : règlement ${cur}, wallet ${w.currency}.`);
      }
  
      const eventId = (crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + "-" + Math.random().toString(16).slice(2);

      const label = isOut
        ? `[Trip] SETTLE:${eventId} • Règlement à ${(members.find(x => x.id === toId)?.name) || "—"}`
        : `[Trip] SETTLE:${eventId} • Règlement reçu de ${(members.find(x => x.id === fromId)?.name) || "—"}`;

      const date = _isoToday();

      // Persist settlement event (affects trip balances)
      const { error: seInsErr } = await sb.from(TB_CONST.TABLES.trip_settlement_events).insert([{
        id: eventId,
        trip_id: tripState.activeTripId,
        currency: cur,
        amount: amt,
        from_member_id: fromId,
        to_member_id: toId,
        created_by: uid,
      }]);
      if (seInsErr) throw seInsErr;

  
      // Create transaction affecting wallet only (out_of_budget = true)
      const txType = isOut ? "expense" : "income";
      const { error: rpcErr } = await _rpcApplyTransactionV2(sb, {
        p_user_id: uid,
        p_wallet_id: walletId,
        p_type: txType,
        p_label: label,
        p_amount: amt,
        p_currency: cur,
        p_date_start: date,
        p_date_end: date,
        p_category: (TB_CONST?.CATS?.trip || "Trip"),
        p_subcategory: null,
        p_pay_now: true,
        p_out_of_budget: true,
        p_night_covered: false,
        p_affects_budget: false,
        p_trip_expense_id: null,
        p_trip_share_link_id: null,
        ..._rpcFxSnapshotArgs(date, cur)
      });
      if (rpcErr) throw rpcErr;

      // Update settlement event with transaction_id (best-effort)
      try {
        const { data: txRow, error: txErr } = await sb
          .from(TB_CONST.TABLES.transactions)
          .select("id")
          .eq("user_id", uid)
          .eq("label", label)
          .eq("currency", cur)
          .eq("amount", amt)
          .eq("date_start", date)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!txErr && txRow?.id) {
          await sb.from(TB_CONST.TABLES.trip_settlement_events)
            .update({ transaction_id: txRow.id })
            .eq("id", eventId);
        }
      } catch (e) {
        console.warn("[Trip] settlement event tx link failed", e);
      }

  
      // Record in trip_settlements (personal log)
      try {
        await sb.from(TB_CONST.TABLES.trip_settlements).insert({
          user_id: uid,
          trip_id: tripState.activeTripId,
          date,
          amount: amt,
          currency: cur,
          direction: isOut ? "out" : "in",
          wallet_id: walletId,
          mode: "virtual",
        });
      } catch (e) {
        // Non-blocking: even if settlement log fails, wallet tx is the source of truth
        console.warn("[Trip] settlement log insert failed", e);
      }
    }

  async function _createTrip(name) {
    const uid = await _ensureSession();
    const baseCur = state?.period?.baseCurrency || "THB";

    // trip_groups has base_currency NOT NULL in your schema
    const { data, error } = await sb
      .from(TB_CONST.TABLES.trip_groups)
      .insert([{ user_id: uid, name, base_currency: baseCur }])
      .select("*")
      .single();
    if (error) throw error;


    // Access control: register owner participant (RLS) — idempotent upsert (V6.5)
    {
      const { error: pErr } = await sb
        .from(TB_CONST.TABLES.trip_participants)
        .upsert([{ trip_id: data.id, auth_user_id: uid, role: "owner" }], { onConflict: "trip_id,auth_user_id" });
      if (pErr) throw pErr;
    }

    // default member (bound to auth user)
try {
  const meEmail = (sbUser && sbUser.email) ? sbUser.email : null;
  const memPayload = { trip_id: data.id, name: "Moi", is_me: false, auth_user_id: uid, user_id: uid };
  if (meEmail) memPayload.email = meEmail;
  let { error: mErr } = await sb.from(TB_CONST.TABLES.trip_members).insert([memPayload]);
  if (mErr && String(mErr.message || "").toLowerCase().includes("email")) {
    delete memPayload.email;
    mErr = (await sb.from(TB_CONST.TABLES.trip_members).insert([memPayload])).error;
  }
  if (mErr) throw mErr;
} catch (e) {
  console.warn("[Trip] default member insert failed (non-blocking):", e);
}

    tripState.activeTripId = data.id;
    localStorage.setItem(TRIP_ACTIVE_KEY, data.id);
  }

  async function _deleteTrip(tripId) {
    const uid = await _ensureSession();
    // defensive delete children first (avoids 409 even if cascade isn't present)
    // 1) unlink budget transactions that reference trip expenses (if enabled)
    try {
      const { data: exIds } = await sb.from(TB_CONST.TABLES.trip_expenses).select("id,transaction_id").eq("trip_id", tripId);
      const linkedTx = (exIds || []).map(x => x.transaction_id).filter(Boolean);
      const expIds = (exIds || []).map(x => x.id);
      if (linkedTx.length) {
        await sb.from(TB_CONST.TABLES.transactions).update({ trip_expense_id: null }).in("id", linkedTx);
      }
      if (expIds.length) {
        await sb.from(TB_CONST.TABLES.trip_expenses).update({ transaction_id: null }).in("id", expIds);
      }
    } catch (e) {
      console.warn("Trip unlink before delete failed:", e);
    }

    await sb.from(TB_CONST.TABLES.trip_expense_shares).delete().eq("trip_id", tripId);
    await sb.from(TB_CONST.TABLES.trip_expenses).delete().eq("trip_id", tripId);
    await sb.from(TB_CONST.TABLES.trip_members).delete().eq("trip_id", tripId);

    const { error } = await sb.from(TB_CONST.TABLES.trip_groups).delete().eq("id", tripId);
    if (error) throw error;

    if (tripState.activeTripId === tripId) tripState.activeTripId = null;
  }

  async function _addMember(name, email) {
    const uid = await _ensureSession();
    const tripId = tripState.activeTripId;
    if (!tripId) return;

    const cleanName = String(name || "").trim();
    if (!cleanName) throw new Error("Nom requis.");

    const payload = { trip_id: tripId, name: cleanName, is_me: false, auth_user_id: null, user_id: uid };
    const cleanEmail = String(email || "").trim();
    if (cleanEmail) payload.email = cleanEmail;

    let { error } = await sb.from(TB_CONST.TABLES.trip_members).insert([payload]);
    if (error && String(error.message || "").toLowerCase().includes("email")) {
      // tolerate unique/email constraints by inserting without email
      delete payload.email;
      error = (await sb.from(TB_CONST.TABLES.trip_members).insert([payload])).error;
    }
    if (error) throw error;
  }

  async function _deleteMember(memberId) {
    await _ensureSession();
    const tripId = tripState.activeTripId;
    if (!tripId) return;

    // Block deletion if the member is referenced by an expense payer or any share.
    const usedAsPayer = (tripState.expenses || []).some(e => e.paidByMemberId === memberId);
    const usedInShares = (tripState.shares || []).some(s => s.memberId === memberId);
    if (usedAsPayer || usedInShares) {
      toastWarn("Impossible de supprimer ce participant : il est lié à des dépenses (payeur et/ou parts). Réassigne ou supprime d'abord les dépenses concernées.");
      return;
    }

    const { error } = await sb
      .from(TB_CONST.TABLES.trip_members)
      .delete()
      .eq("trip_id", tripId)
      .eq("id", memberId);
    if (error) throw error;
  }

  async function _renameMember(memberId, newName) {
    await _ensureSession();
    const tripId = tripState.activeTripId;
    if (!tripId) return;
    const name = String(newName || "").trim();
    if (!name) throw new Error("Nom invalide.");

    const { error } = await sb
      .from(TB_CONST.TABLES.trip_members)
      .update({ name })
      .eq("trip_id", tripId)
      .eq("id", memberId);
    if (error) throw error;
  }
  
  async function _expenseHasBudgetLinks(expenseId) {
    try {
      const { data, error } = await sb
        .from(TB_CONST.TABLES.trip_expense_budget_links)
        .select("id")
        .eq("expense_id", expenseId)
        .limit(1);
      if (error) return false;
      return !!(data && data.length);
    } catch (e) {
      return false;
    }
  }

  function _expenseIsWalletLinked(ex) {
    return !!(ex && ex.transactionId);
  }

  async function _expenseIsEditLocked(ex) {
    if (!ex?.id) return false;
    if (_expenseIsWalletLinked(ex)) return true;
    return await _expenseHasBudgetLinks(ex.id);
  }

  async function _buildEditDraftForExpense(expenseId) {
    const ex = (tripState.expenses || []).find(x => x.id === expenseId);
    if (!ex) return null;
    const shares = (tripState.shares || []).filter(s => s.expenseId === expenseId);
    const amounts = {};
    shares.forEach(s => { amounts[s.memberId] = Number(s.shareAmount || 0); });

    let walletId = "";
    let category = "Autre";
    let outOfBudget = false;
    try {
      const audit = await _fetchExpenseAuditDetails(expenseId);
      const tx = (audit?.myShareLink ? audit.budgetTransactionsById.get(audit.myShareLink.transactionId) : null)
        || audit?.walletTransaction
        || null;
      if (tx) {
        walletId = tx.walletId || "";
        category = tx.category || category;
        outOfBudget = tx.outOfBudget === true;
      }
    } catch (_) {}

    return {
      expenseId: ex.id,
      date: ex.date || _isoToday(),
      label: ex.label || "",
      amount: Number(ex.amount || 0),
      currency: ex.currency || (state?.period?.baseCurrency || "EUR"),
      paidByMemberId: ex.paidByMemberId || "",
      walletId,
      category,
      outOfBudget,
      split: {
        mode: "amount",
        percents: {},
        amounts,
      },
    };
  }

  async function _beginEditExpense(expenseId) {
    const ex = (tripState.expenses || []).find(x => x.id === expenseId);
    if (!ex) throw new Error("Dépense introuvable.");

    tripState.editingExpenseId = expenseId;
    tripState.editingExpenseDraft = await _buildEditDraftForExpense(expenseId);
    await _renderUI();
  }

  async function _cancelEditExpense() {
    tripState.editingExpenseId = null;
    tripState.editingExpenseDraft = null;
    await _renderUI();
  }

  async function _refreshAfterTripMutation(reason) {
    try { if (typeof window.tbBusyStart === "function") window.tbBusyStart("Mise à jour en cours…"); } catch (_) {}
    if (typeof refreshFromServer === "function") {
      try { await refreshFromServer(); } catch (_) {}
    }
    try {
      if (typeof recomputeAllocations === "function") recomputeAllocations();
    } catch (_) {}
    try {
      if (typeof tbRequestRenderAll === "function") tbRequestRenderAll(reason || "trip:mutation");
      else if (typeof renderAll === "function") renderAll();
    } catch (_) {}
    if (typeof window.__tripRefresh === "function") await window.__tripRefresh({ activeOnly: true });
    try { if (typeof renderWallets === "function") renderWallets(); } catch (_) {}
    try { if (typeof renderDailyBudget === "function") renderDailyBudget(); } catch (_) {}
    try { if (typeof renderKPI === "function") renderKPI(); } catch (_) {}
    try { if (typeof window.tbBusyEnd === "function") window.tbBusyEnd(); } catch (_) {}
  }
  async function _cleanupExpenseBudgetLinksBeforeEdit(expenseId) {
    if (!expenseId) return;
    const ex = (tripState.expenses || []).find(x => x.id === expenseId) || null;
    const mainTxId = ex?.transactionId || null;
    const txIdsToDelete = [];

    try {
      const { data: links, error } = await sb
        .from(TB_CONST.TABLES.trip_expense_budget_links)
        .select("id,transaction_id")
        .eq("expense_id", expenseId);
      if (error) throw error;
      for (const row of (links || [])) {
        const txId = row?.transaction_id || null;
        if (txId && txId !== mainTxId) txIdsToDelete.push(txId);
      }
    } catch (_) {}

    try {
      await sb.from(TB_CONST.TABLES.trip_expense_budget_links).delete().eq("expense_id", expenseId);
    } catch (_) {}

    for (const txId of txIdsToDelete) {
      try {
        const { error } = await sb.rpc(TB_CONST.RPCS.delete_transaction || "delete_transaction", { p_tx_id: txId });
        if (error) throw error;
      } catch (e) {
        console.warn("[Trip] cleanup budget link tx failed", txId, e);
      }
    }
  }

  async function _integrateExpenseBudgetSideEffects({ expenseId, date, label, amount, currency, paidByMemberId, walletId, category, outOfBudget, split }) {
    const uid = await _ensureSession();
    const members = tripState.members || [];
    const memberIds = members.map(m => m.id);
    const amt = Number(amount);
    const cur = _normalizeCurrency(currency);
    const cat = (category || "Autre");
    const out = !!outOfBudget;
    const payer = members.find(m => m.id === paidByMemberId) || null;
    const paidByMe = !!payer?.isMe;
    const parts = _computeSplitParts(amt, members, split);
    _validateSplitParts(amt, parts);

    const { data: ex, error: exErr } = await sb
      .from(TB_CONST.TABLES.trip_expenses)
      .select("*")
      .eq("id", expenseId)
      .single();
    if (exErr) throw exErr;

    if (paidByMe) {
      if (!walletId) throw new Error("Choisis une wallet (pour décompter le paiement).");
      const w = findWallet(walletId);
      if (!w) throw new Error("Wallet invalide.");
      if (String(w.currency || "").toUpperCase() !== cur) {
        throw new Error(`Devise wallet (${w.currency}) différente de la dépense (${cur}). Choisis une wallet dans la même devise.`);
      }

      const targetPeriodId = _findPeriodIdForDate(date);
      const me = members.find(m => m.isMe) || null;
      const myIdx = me ? memberIds.indexOf(me.id) : -1;
      const myShare = (myIdx >= 0) ? Number(parts[myIdx] ?? 0) : NaN;
      const isFullShare = isFinite(myShare) && Math.abs(myShare - amt) < 0.005;

      if (isFullShare) {
        const { error: rpcErr } = await _rpcApplyTransactionV2(sb, {
          p_user_id: uid,
          p_wallet_id: walletId,
          p_type: "expense",
          p_label: `[Trip] ${label}`,
          p_amount: amt,
          p_currency: cur,
          p_date_start: date,
          p_date_end: date,
          p_category: cat,
          p_subcategory: null,
          p_pay_now: true,
          p_out_of_budget: out,
          p_night_covered: false,
          p_affects_budget: !out,
          p_trip_expense_id: null,
          p_trip_share_link_id: null,
          ..._rpcFxSnapshotArgs(date, cur)
        });
        if (rpcErr) throw rpcErr;

        const { data: txRows, error: txErr } = await sb
          .from(TB_CONST.TABLES.transactions)
          .select("id,period_id")
          .eq("wallet_id", walletId)
          .eq("type", "expense")
          .eq("amount", amt)
          .eq("currency", cur)
          .eq("category", cat)
          .eq("label", `[Trip] ${label}`)
          .eq("date_start", date)
          .eq("date_end", date)
          .eq("pay_now", true)
          .eq("out_of_budget", out)
          .is("trip_expense_id", null)
          .order("created_at", { ascending: false })
          .limit(1);
        if (txErr) throw txErr;

        const tx = txRows?.[0] || null;
        if (tx) {
          if (targetPeriodId && (!tx.period_id || tx.period_id !== targetPeriodId)) {
            await sb.from(TB_CONST.TABLES.transactions).update({ period_id: targetPeriodId }).eq("id", tx.id);
          }
          await _linkExpenseToTransaction(ex.id, tx.id);
        }
      } else {
        if (!me) {
          toastWarn("[Trip] Impossible de déterminer ta part pour le budget (participant 'moi' manquant).");
        }

        const advanceLabel = `[Trip] Avance - ${label}`;
        const { error: rpcErrA } = await _rpcApplyTransactionV2(sb, {
          p_user_id: uid,
          p_wallet_id: walletId,
          p_type: "expense",
          p_label: advanceLabel,
          p_amount: amt,
          p_currency: cur,
          p_date_start: date,
          p_date_end: date,
          p_category: cat,
          p_subcategory: null,
          p_pay_now: true,
          p_out_of_budget: true,
          p_night_covered: false,
          p_affects_budget: false,
          p_trip_expense_id: null,
          p_trip_share_link_id: null,
          ..._rpcFxSnapshotArgs(date, cur)
        });
        if (rpcErrA) throw rpcErrA;

        const { data: txRowsA, error: txErrA } = await sb
          .from(TB_CONST.TABLES.transactions)
          .select("id,period_id")
          .eq("wallet_id", walletId)
          .eq("type", "expense")
          .eq("amount", amt)
          .eq("currency", cur)
          .eq("category", cat)
          .eq("label", advanceLabel)
          .eq("date_start", date)
          .eq("date_end", date)
          .eq("pay_now", true)
          .eq("out_of_budget", true)
          .is("trip_expense_id", null)
          .order("created_at", { ascending: false })
          .limit(1);
        if (txErrA) throw txErrA;

        const txA = txRowsA?.[0] || null;
        if (txA) {
          if (targetPeriodId && (!txA.period_id || txA.period_id !== targetPeriodId)) {
            await sb.from(TB_CONST.TABLES.transactions).update({ period_id: targetPeriodId }).eq("id", txA.id);
          }
          await _linkExpenseToTransaction(ex.id, txA.id);
        }

        if (me && myIdx >= 0 && isFinite(myShare) && myShare > 0) {
          const consLabel = `[Trip] ${label}`;
          const { error: rpcErrB } = await _rpcApplyTransactionV2(sb, {
            p_user_id: uid,
            p_wallet_id: walletId,
            p_type: "expense",
            p_label: consLabel,
            p_amount: myShare,
            p_currency: cur,
            p_date_start: date,
            p_date_end: date,
            p_category: cat,
            p_subcategory: null,
            p_pay_now: false,
            p_out_of_budget: out,
            p_night_covered: false,
            p_affects_budget: !out,
            p_trip_expense_id: null,
            p_trip_share_link_id: null,
            ..._rpcFxSnapshotArgs(date, cur)
          });
          if (rpcErrB) throw rpcErrB;

          const { data: txRowsB, error: txErrB } = await sb
            .from(TB_CONST.TABLES.transactions)
            .select("id,period_id")
            .eq("wallet_id", walletId)
            .eq("type", "expense")
            .eq("amount", myShare)
            .eq("currency", cur)
            .eq("category", cat)
            .eq("label", consLabel)
            .eq("date_start", date)
            .eq("date_end", date)
            .eq("pay_now", false)
            .eq("out_of_budget", out)
            .is("trip_expense_id", null)
            .order("created_at", { ascending: false })
            .limit(1);
          if (txErrB) throw txErrB;

          const txB = txRowsB?.[0] || null;
          if (txB) {
            await sb.from(TB_CONST.TABLES.transactions).update({ is_internal: true }).eq("id", txB.id);
            if (targetPeriodId && (!txB.period_id || txB.period_id !== targetPeriodId)) {
              await sb.from(TB_CONST.TABLES.transactions).update({ period_id: targetPeriodId }).eq("id", txB.id);
            }
            await _linkShareToTransaction({ expenseId: ex.id, memberId: me.id, transactionId: txB.id });
          }
        }
      }
    } else {
      const me = members.find(m => m.isMe) || null;
      if (me) {
        const myIdx = memberIds.indexOf(me.id);
        const myShare = Number(parts[myIdx] ?? 0);
        if (isFinite(myShare) && myShare > 0) {
          let wId = walletId || null;
          let w = wId ? findWallet(wId) : null;
          if (!w) {
            w = state.wallets.find(x => String(x.currency || "").toUpperCase() === cur) || null;
            wId = w?.id || null;
          }
          if (!wId || !w) {
            toastWarn(`[Trip] Aucune wallet en ${cur} : impossible d'enregistrer ta part au budget.`);
          } else if (String(w.currency || "").toUpperCase() !== cur) {
            toastWarn(`[Trip] Devise wallet (${w.currency}) différente de ta part (${cur}). Choisis une wallet ${cur}.`);
          } else {
            const targetPeriodId = _findPeriodIdForDate(date);
            const budgetLabel = `[Trip] ${label}`;
            const { error: rpcErr2 } = await _rpcApplyTransactionV2(sb, {
              p_user_id: uid,
              p_wallet_id: wId,
              p_type: "expense",
              p_label: budgetLabel,
              p_amount: myShare,
              p_currency: cur,
              p_date_start: date,
              p_date_end: date,
              p_category: cat,
              p_subcategory: null,
              p_pay_now: false,
              p_out_of_budget: out,
              p_night_covered: false,
              p_affects_budget: !out,
              p_trip_expense_id: null,
              p_trip_share_link_id: null,
              ..._rpcFxSnapshotArgs(date, cur)
            });
            if (rpcErr2) throw rpcErr2;

            const { data: txRows2, error: txErr2 } = await sb
              .from(TB_CONST.TABLES.transactions)
              .select("id,period_id")
              .eq("wallet_id", wId)
              .eq("type", "expense")
              .eq("amount", myShare)
              .eq("currency", cur)
              .eq("category", cat)
              .eq("label", budgetLabel)
              .eq("date_start", date)
              .eq("date_end", date)
              .eq("pay_now", false)
              .is("trip_expense_id", null)
              .order("created_at", { ascending: false })
              .limit(1);
            if (txErr2) throw txErr2;

            const tx2 = txRows2?.[0] || null;
            if (tx2) {
              await sb.from(TB_CONST.TABLES.transactions).update({ is_internal: true }).eq("id", tx2.id);
              if (targetPeriodId && (!tx2.period_id || tx2.period_id !== targetPeriodId)) {
                await sb.from(TB_CONST.TABLES.transactions).update({ period_id: targetPeriodId }).eq("id", tx2.id);
              }
              await _linkShareToTransaction({ expenseId: ex.id, memberId: me.id, transactionId: tx2.id });
            }
          }
        }
      }
    }
  }

  async function _updateExpense({ expenseId, date, label, amount, currency, paidByMemberId, walletId, category, outOfBudget, split }) {
    await _ensureSession();
    const tripId = tripState.activeTripId;
    if (!tripId || !expenseId) throw new Error("Édition invalide.");

    const members = tripState.members || [];
    if (!members.length) throw new Error("Ajoute au moins un participant.");

    const amt = Number(amount);
    if (!date || !label || !isFinite(amt) || amt <= 0) throw new Error("Date, libellé et montant (>0) requis.");
    if (!paidByMemberId) throw new Error("Sélectionne qui a payé.");

    const currentEx = (tripState.expenses || []).find(x => x.id === expenseId);
    if (!currentEx) throw new Error("Dépense introuvable.");

    const cur = _normalizeCurrency(currency);
    const parts = _computeSplitParts(amt, members, split);
    _validateSplitParts(amt, parts);

    await _cleanupExpenseBudgetLinksBeforeEdit(expenseId);

    const payloadExp = {
      expense_id: expenseId,
      date,
      label,
      amount: amt,
      currency: cur,
      paid_by_member_id: paidByMemberId,
      shares: members.map((m, i) => ({ member_id: m.id, share_amount: parts[i] ?? 0 })),
      wallet_tx: { enabled: false },
    };

    const { data: rpcRows, error: rpcErr } = await _rpcTripApplyExpense(sb, tripId, payloadExp);
    if (rpcErr) throw rpcErr;
    const updatedExpenseId = (Array.isArray(rpcRows) ? rpcRows[0]?.expense_id : rpcRows?.expense_id) || null;
    if (!updatedExpenseId) throw new Error("Trip: RPC trip_apply_expense_v2 n'a pas renvoyé expense_id.");

    await _integrateExpenseBudgetSideEffects({ expenseId: updatedExpenseId, date, label, amount: amt, currency: cur, paidByMemberId, walletId, category, outOfBudget, split });

    tripState.editingExpenseId = null;
    tripState.editingExpenseDraft = null;
    return updatedExpenseId;
  }

  async function _addExpense({ date, label, amount, currency, paidByMemberId, walletId, category, outOfBudget, split }) {
    const uid = await _ensureSession();
    const tripId = tripState.activeTripId;
    if (!tripId) return;

    const members = tripState.members;
    if (!members.length) throw new Error("Ajoute au moins un participant.");

    const amt = Number(amount);
    if (!date || !label || !isFinite(amt) || amt <= 0) throw new Error("Date, libellé et montant (>0) requis.");
    if (!paidByMemberId) throw new Error("Sélectionne qui a payé.");

    const cur = _normalizeCurrency(currency);
    const payer = members.find(m => m.id === paidByMemberId) || null;
    const paidByMe = !!payer?.isMe;

    // If paid by me, ensure we can record it into the Budget system (wallet + category).
    const cat = (category || "Autre");
    const out = !!outOfBudget;

    if (paidByMe) {
      if (!walletId) throw new Error("Choisis une wallet (pour décompter le paiement).");
      const w = findWallet(walletId);
      if (!w) throw new Error("Wallet invalide.");
      if (String(w.currency || "").toUpperCase() !== cur) {
        throw new Error(`Devise wallet (${w.currency}) différente de la dépense (${cur}). Choisis une wallet dans la même devise (conversion FX non implémentée).`);
      }

      // Duplicate control: if a matching Budget transaction exists, propose linking instead of creating a new one.
      try {
        const matches = await _findMatchingTransactions({ date, amount: amt, currency: cur });
        if (matches.length) {
          const m0 = matches[0];
          const msg = `Transaction Budget similaire trouvée : ${m0.label || "(sans libellé)"} (${m0.category || "—"}).

Souhaites-tu L I E R la dépense Trip à cette transaction (recommandé pour éviter un doublon) ?`;
          const link = confirm(msg);
          if (link) {
            // Create trip expense first, then link.
            // Create trip expense + shares atomically (DB-first V8.1)
            const memberIds = members.map(m => m.id);
            const parts = _computeSplitParts(amt, members, split);
            _validateSplitParts(amt, parts);

            const payloadExp = {
              expense_id: null,
              date,
              label,
              amount: amt,
              currency: cur,
              paid_by_member_id: paidByMemberId,
              shares: members.map((m, i) => ({ member_id: m.id, share_amount: parts[i] ?? 0 })),
            };

            const { data: rpcRows, error: rpcErr } = await _rpcTripApplyExpense(sb, tripId, payloadExp);
            if (rpcErr) throw rpcErr;
            const expId = (Array.isArray(rpcRows) ? rpcRows[0]?.expense_id : rpcRows?.expense_id) || null;
            if (!expId) throw new Error("Trip: RPC trip_apply_expense n'a pas renvoyé expense_id.");

            const { data: ex, error: exErr } = await sb
              .from(TB_CONST.TABLES.trip_expenses)
              .select("*")
              .eq("id", expId)
              .single();
            if (exErr) throw exErr;

            await _linkExpenseToTransaction(ex.id, m0.id);

            // Determine "my share" for this expense (used to avoid double-counting budget vs cashflow).
            const meMember0 = members.find(mm => mm.isMe) || null;
            const myIdx0 = meMember0 ? members.findIndex(mm => mm.id === meMember0.id) : -1;
            const myShare = (myIdx0 >= 0 ? (parts[myIdx0] ?? 0) : 0);

            // V4.1.2 fix: if we linked to an existing FULL payment transaction for a SHARED expense,

             // exclude that payment from budget allocations (wallet cashflow remains via pay_now=true).
             // Otherwise the payer sees both the full payment and their consumption share in the budget.
             try {
               if (isFinite(myShare) && myShare > 0 && Math.abs(myShare - amt) >= 0.005) {
                 const looksLikePayment2 = (m0 && m0.pay_now === true && Math.abs(Number(m0.amount) - amt) < 0.005);
                 if (looksLikePayment2 && m0.out_of_budget !== true) {
                   await sb.from(TB_CONST.TABLES.transactions).update({ out_of_budget: true }).eq("id", m0.id);
                 }
               }
             } catch (e) {
               console.warn("[Trip] V4.2 could not mark linked payment as out_of_budget", e);
             }


            // Budget integration for duplicate-linking case:
            // - If this was a shared expense, ensure YOUR consumption share exists in Budget and is linked (trip_expense_budget_links)
            try {
              const me = members.find(m => m.isMe) || null;
              const memberIds = members.map(m => m.id);
              const parts2 = _computeSplitParts(amt, members, split);
              const myIdx = me ? memberIds.indexOf(me.id) : -1;
              const myShare2 = (myIdx >= 0) ? Number(parts2[myIdx] ?? 0) : NaN;

              if (me && isFinite(myShare2) && myShare2 > 0) {
                const existingLink = await _getShareBudgetLink(ex.id, me.id);
                if (!existingLink) {
                  // If linked transaction looks like the payment (full amount, pay_now=true), create the share tx (pay_now=false) for budget.
                  const looksLikePayment = (m0 && m0.pay_now === true && Math.abs(Number(m0.amount) - amt) < 0.005);
                  const looksLikeShare = (m0 && m0.pay_now === false && Math.abs(Number(m0.amount) - myShare2) < 0.005);

                  if (Math.abs(myShare2 - amt) < 0.005) {
                    // full share, nothing else to do
                  } else if (looksLikeShare) {
                    await _linkShareToTransaction({ expenseId: ex.id, memberId: me.id, transactionId: m0.id });
                  } else if (looksLikePayment) {
                    const consLabel = `[Trip] ${label}`;
                    const { error: rpcErrB } = await _rpcApplyTransactionV2(sb, {
                      p_user_id: uid,
                      p_wallet_id: walletId,
                      p_type: "expense",
                      p_label: consLabel,
                      p_amount: myShare2,
                      p_currency: cur,
                      p_date_start: date,
                      p_date_end: date,
                      p_category: cat,
                      p_subcategory: null,
                      p_pay_now: false,
                      p_out_of_budget: out,
                      p_night_covered: false,
                      p_affects_budget: !out,
                      p_trip_expense_id: null,
                      p_trip_share_link_id: null,
                      ..._rpcFxSnapshotArgs(date, cur)
                    });
                    if (rpcErrB) throw rpcErrB;

                    const { data: txRowsB, error: txErrB } = await sb
                      .from(TB_CONST.TABLES.transactions)
                      .select("id,period_id")
                      .eq("wallet_id", walletId)
                      .eq("type", "expense")
                      .eq("amount", myShare2)
                      .eq("currency", cur)
                      .eq("category", cat)
                      .eq("label", consLabel)
                      .eq("date_start", date)
                      .eq("date_end", date)
                      .eq("pay_now", false)
                      .eq("out_of_budget", out)
                      .is("trip_expense_id", null)
                      .order("created_at", { ascending: false })
                      .limit(1);
                    if (txErrB) throw txErrB;

                    const txB = txRowsB?.[0] || null;
                    if (txB) {
              await sb.from(TB_CONST.TABLES.transactions).update({ is_internal: true }).eq("id", txB.id);
                      const targetPeriodId = _findPeriodIdForDate(date);
                      if (targetPeriodId && (!txB.period_id || txB.period_id !== targetPeriodId)) {
                        await sb.from(TB_CONST.TABLES.transactions).update({ period_id: targetPeriodId }).eq("id", txB.id);
                      }
                      await _linkShareToTransaction({ expenseId: ex.id, memberId: me.id, transactionId: txB.id });
                    }
                  } else {
                    toastWarn("[Trip] Lien fait, mais la transaction sélectionnée ne ressemble ni au paiement complet ni à ta part. Vérifie le cashflow et ajoute la transaction Budget de ta part si besoin.");
                  }
                }
              }
            } catch (e) {
              console.warn("[Trip] duplicate-link budget integration failed", e);
            }

            emitDataUpdated("trip:expense:link");
            await refreshFromServer();
            showView("trip");
            return;
          }
        }
      } catch (e) {
        console.warn("Trip duplicate check failed:", e);
      }
    }

    // 1) Create Trip expense + shares (DB-first V8.1)
    const memberIds = members.map(m => m.id);
    const parts = _computeSplitParts(amt, members, split);
    _validateSplitParts(amt, parts);

    const payloadExp = {
      expense_id: null,
      date,
      label,
      amount: amt,
      currency: cur,
      paid_by_member_id: paidByMemberId,
      shares: members.map((m, i) => ({ member_id: m.id, share_amount: parts[i] ?? 0 })),
      wallet_tx: { enabled: false },
    };

    const { data: rpcRows, error: rpcErr } = await _rpcTripApplyExpense(sb, tripId, payloadExp);
    if (rpcErr) throw rpcErr;
    const expId = (Array.isArray(rpcRows) ? rpcRows[0]?.expense_id : rpcRows?.expense_id) || null;
    if (!expId) throw new Error("Trip: RPC trip_apply_expense n'a pas renvoyé expense_id.");

    const { data: ex, error: exErr } = await sb
      .from(TB_CONST.TABLES.trip_expenses)
      .select("*")
      .eq("id", expId)
      .single();
    if (exErr) throw exErr;



    // 2) Budget integration
    if (paidByMe) {
      const w = findWallet(walletId);
      const targetPeriodId = _findPeriodIdForDate(date);

      const me = members.find(m => m.isMe) || null;
      const myIdx = me ? memberIds.indexOf(me.id) : -1;
      const myShare = (myIdx >= 0) ? Number(parts[myIdx] ?? 0) : NaN;

      // If I effectively pay 100% (solo / my share == total), we can record a single Budget expense.
      // Otherwise:
      //  - record a cashflow "advance" (pay_now=true, out_of_budget=true) to decrement the wallet
      //  - record my consumption share (pay_now=false) so budget/allocation reflects my real cost
      const isFullShare = isFinite(myShare) && Math.abs(myShare - amt) < 0.005;

      if (isFullShare) {
        const { error: rpcErr } = await _rpcApplyTransactionV2(sb, {
          p_user_id: uid,
          p_wallet_id: walletId,
          p_type: "expense",
          p_label: `[Trip] ${label}`,
          p_amount: amt,
          p_currency: cur,
          p_date_start: date,
          p_date_end: date,
          p_category: cat,
          p_subcategory: null,
          p_pay_now: true,
          p_out_of_budget: out,
          p_night_covered: false,
          p_affects_budget: !out,
          p_trip_expense_id: null,
          p_trip_share_link_id: null,
          ..._rpcFxSnapshotArgs(date, cur)
        });
        if (rpcErr) throw rpcErr;

      // Update settlement event with transaction_id (best-effort)
      try {
        const { data: txRow, error: txErr } = await sb
          .from(TB_CONST.TABLES.transactions)
          .select("id")
          .eq("user_id", uid)
          .eq("label", label)
          .eq("currency", cur)
          .eq("amount", amt)
          .eq("date_start", date)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!txErr && txRow?.id) {
          await sb.from(TB_CONST.TABLES.trip_settlement_events)
            .update({ transaction_id: txRow.id })
            .eq("id", eventId);
        }
      } catch (e) {
        console.warn("[Trip] settlement event tx link failed", e);
      }


        const { data: txRows, error: txErr } = await sb
          .from(TB_CONST.TABLES.transactions)
          .select("id,period_id")
          
          .eq("wallet_id", walletId)
          .eq("type", "expense")
          .eq("amount", amt)
          .eq("currency", cur)
          .eq("category", cat)
          .eq("label", `[Trip] ${label}`)
          .eq("date_start", date)
          .eq("date_end", date)
          .eq("pay_now", true)
          .eq("out_of_budget", out)
          .is("trip_expense_id", null)
          .order("created_at", { ascending: false })
          .limit(1);
        if (txErr) throw txErr;

        const tx = txRows?.[0] || null;
        if (tx) {
          if (targetPeriodId && (!tx.period_id || tx.period_id !== targetPeriodId)) {
            await sb.from(TB_CONST.TABLES.transactions).update({ period_id: targetPeriodId }).eq("id", tx.id);
          }
          await _linkExpenseToTransaction(ex.id, tx.id);
        } else {
          console.warn("Budget tx created but not found for linking.");
        }
      } else {
        if (!me) {
          toastWarn("[Trip] Impossible de déterminer ta part pour le budget (participant 'moi' manquant).");
        }

        // A) Cashflow advance (decrement wallet, NOT in budget)
        const advanceLabel = `[Trip] Avance - ${label}`;
        const { error: rpcErrA } = await _rpcApplyTransactionV2(sb, {
          p_user_id: uid,
          p_wallet_id: walletId,
          p_type: "expense",
          p_label: advanceLabel,
          p_amount: amt,
          p_currency: cur,
          p_date_start: date,
          p_date_end: date,
          p_category: cat,
          p_subcategory: null,
          p_pay_now: true,
          p_out_of_budget: true,
          p_night_covered: false,
          p_affects_budget: false,
          p_trip_expense_id: null,
          p_trip_share_link_id: null,
          ..._rpcFxSnapshotArgs(date, cur)
        });
        if (rpcErrA) throw rpcErrA;

        const { data: txRowsA, error: txErrA } = await sb
          .from(TB_CONST.TABLES.transactions)
          .select("id,period_id")
          
          .eq("wallet_id", walletId)
          .eq("type", "expense")
          .eq("amount", amt)
          .eq("currency", cur)
          .eq("category", cat)
          .eq("label", advanceLabel)
          .eq("date_start", date)
          .eq("date_end", date)
          .eq("pay_now", true)
          .eq("out_of_budget", true)
          .is("trip_expense_id", null)
          .order("created_at", { ascending: false })
          .limit(1);
        if (txErrA) throw txErrA;

        const txA = txRowsA?.[0] || null;
        if (txA) {
          if (targetPeriodId && (!txA.period_id || txA.period_id !== targetPeriodId)) {
            await sb.from(TB_CONST.TABLES.transactions).update({ period_id: targetPeriodId }).eq("id", txA.id);
          }
          await _linkExpenseToTransaction(ex.id, txA.id);
        } else {
          console.warn("Advance tx created but not found for linking.");
        }

        // B) My consumption share (budget/allocation, but pay_now=false so wallet isn't decremented twice)
        if (me && myIdx >= 0 && isFinite(myShare) && myShare > 0) {
          const existing = await _getShareBudgetLink(ex.id, me.id);
          if (!existing) {
            const consLabel = `[Trip] ${label}`;
            const { error: rpcErrB } = await _rpcApplyTransactionV2(sb, {
              p_user_id: uid,
              p_wallet_id: walletId,
              p_type: "expense",
              p_label: consLabel,
              p_amount: myShare,
              p_currency: cur,
              p_date_start: date,
              p_date_end: date,
              p_category: cat,
              p_subcategory: null,
              p_pay_now: false,
              p_out_of_budget: out,
              p_night_covered: false,
              p_affects_budget: !out,
              p_trip_expense_id: null,
              p_trip_share_link_id: null,
              ..._rpcFxSnapshotArgs(date, cur)
            });
            if (rpcErrB) throw rpcErrB;

            const { data: txRowsB, error: txErrB } = await sb
              .from(TB_CONST.TABLES.transactions)
              .select("id,period_id")
              
              .eq("wallet_id", walletId)
              .eq("type", "expense")
              .eq("amount", myShare)
              .eq("currency", cur)
              .eq("category", cat)
              .eq("label", consLabel)
              .eq("date_start", date)
              .eq("date_end", date)
              .eq("pay_now", false)
              .eq("out_of_budget", out)
              .is("trip_expense_id", null)
              .order("created_at", { ascending: false })
              .limit(1);
            if (txErrB) throw txErrB;

            const txB = txRowsB?.[0] || null;
            if (txB) {
              await sb.from(TB_CONST.TABLES.transactions).update({ is_internal: true }).eq("id", txB.id);
              if (targetPeriodId && (!txB.period_id || txB.period_id !== targetPeriodId)) {
                await sb.from(TB_CONST.TABLES.transactions).update({ period_id: targetPeriodId }).eq("id", txB.id);
              }
              await _linkShareToTransaction({ expenseId: ex.id, memberId: me.id, transactionId: txB.id });
            }
          }
        }
      }
    } else {
      // Paid by someone else: optionally record MY share into Budget as an unpaid expense (pay_now=false).
      const me = members.find(m => m.isMe) || null;
      if (me) {
        const myIdx = memberIds.indexOf(me.id);
        const myShare = Number(parts[myIdx] ?? 0);
        if (isFinite(myShare) && myShare > 0) {
          // Avoid duplicates: if already linked for this expense+member, do nothing.
          const existing = await _getShareBudgetLink(ex.id, me.id);
          if (!existing) {
            // Choose wallet for accounting (must match currency). This will NOT decrement wallet when pay_now=false,
            // but WILL count in allocations/budget by date.
            let wId = walletId || null;
            let w = wId ? findWallet(wId) : null;
            if (!w) {
              w = state.wallets.find(x => String(x.currency || "").toUpperCase() === cur) || null;
              wId = w?.id || null;
            }
            if (!wId || !w) {
              toastWarn(`[Trip] Aucune wallet en ${cur} : impossible d'enregistrer ta part au budget. Crée une wallet ${cur} ou active une conversion FX.`);
            } else if (String(w.currency || "").toUpperCase() !== cur) {
              toastWarn(`[Trip] Devise wallet (${w.currency}) différente de ta part (${cur}). Choisis une wallet ${cur} (conversion FX non implémentée).`);
            } else {
              const targetPeriodId = _findPeriodIdForDate(date);
              const budgetLabel = `[Trip] ${label}`;

              const { error: rpcErr2 } = await _rpcApplyTransactionV2(sb, {
                p_user_id: uid,
                p_wallet_id: wId,
                p_type: "expense",
                p_label: budgetLabel,
                p_amount: myShare,
                p_currency: cur,
                p_date_start: date,
                p_date_end: date,
                p_category: cat,
                p_subcategory: null,
                p_pay_now: false,
                p_out_of_budget: out,
                p_night_covered: false,
                p_affects_budget: !out,
                p_trip_expense_id: null,
                p_trip_share_link_id: null,
                ..._rpcFxSnapshotArgs(date, cur)
              });
              if (rpcErr2) throw rpcErr2;

              // Fetch created tx and link via trip_expense_budget_links
              const { data: txRows2, error: txErr2 } = await sb
                .from(TB_CONST.TABLES.transactions)
                .select("id,period_id")
                
                .eq("wallet_id", wId)
                .eq("type", "expense")
                .eq("amount", myShare)
                .eq("currency", cur)
                .eq("category", cat)
                .eq("label", budgetLabel)
                .eq("date_start", date)
                .eq("date_end", date)
                .eq("pay_now", false)
                .is("trip_expense_id", null)
                .order("created_at", { ascending: false })
                .limit(1);
              if (txErr2) throw txErr2;

              const tx2 = txRows2?.[0] || null;
              if (tx2) {
                await sb.from(TB_CONST.TABLES.transactions).update({ is_internal: true }).eq("id", tx2.id);
                if (targetPeriodId && (!tx2.period_id || tx2.period_id !== targetPeriodId)) {
                  await sb.from(TB_CONST.TABLES.transactions).update({ period_id: targetPeriodId }).eq("id", tx2.id);
                }
                await _linkShareToTransaction({ expenseId: ex.id, memberId: me.id, transactionId: tx2.id });
              }
            }
          }
        }
      }

    }
  }

  async function _deleteExpense(expenseId) {
    await _ensureSession();
    const tripId = tripState.activeTripId;
    if (!tripId || !expenseId) throw new Error("Suppression invalide.");

    // Temporary front-first path:
    // remote SQL trip_delete_expense_v1 currently deletes budget links before deleting
    // the linked budget transactions, which can leave orphan budget tx visible in UI.
    // Keep the legacy flow until the SQL RPC is patched and revalidated.

    // Fallback legacy si la RPC n'est pas disponible côté DB
    const ex = tripState.expenses.find(x => x.id === expenseId);

    try {
      const { data: links, error: lerr } = await sb
        .from(TB_CONST.TABLES.trip_expense_budget_links)
        .select("transaction_id")
        .eq("expense_id", expenseId);

      if (lerr && lerr.code !== "PGRST116") throw lerr;
      if (links?.length) {
        const { error: dlerr } = await sb
          .from(TB_CONST.TABLES.trip_expense_budget_links)
          .delete()
          .eq("expense_id", expenseId);
        if (dlerr) throw dlerr;

        for (const row of links) {
          const txId = row.transaction_id;
          if (!txId) continue;
          const { error: derr } = await sb.rpc(TB_CONST.RPCS.delete_transaction || "delete_transaction", { p_tx_id: txId });
          if (derr) throw derr;
        }
      }
    } catch (e) {
      const msg = (e && (e.message || e.toString())) || "";
      if (!msg.toLowerCase().includes("trip_expense_budget_links") &&
          !msg.toLowerCase().includes("relation") &&
          !msg.toLowerCase().includes("does not exist")) {
        throw e;
      }
    }

    if (ex?.transactionId) {
      const txId = ex.transactionId;
      await sb.from(TB_CONST.TABLES.trip_expenses).update({ transaction_id: null }).eq("id", expenseId);
      await sb.from(TB_CONST.TABLES.transactions).update({ trip_expense_id: null }).eq("id", txId);

      const { error: derr } = await sb.rpc(TB_CONST.RPCS.delete_transaction || "delete_transaction", { p_tx_id: txId });
      if (derr) throw derr;
    }

    try {
      const { data: txRefs, error: txRefErr } = await sb
        .from(TB_CONST.TABLES.transactions)
        .select("id")
        .eq("trip_expense_id", expenseId);
      if (txRefErr) throw txRefErr;
      if (txRefs?.length) {
        for (const row of txRefs) {
          if (!row?.id) continue;
          const { error: derr } = await sb.rpc(TB_CONST.RPCS.delete_transaction || "delete_transaction", { p_tx_id: row.id });
          if (derr) throw derr;
        }
      }
    } catch (_) {}

    await sb.from(TB_CONST.TABLES.trip_expense_shares).delete().eq("expense_id", expenseId);
    const { error } = await sb.from(TB_CONST.TABLES.trip_expenses).delete().eq("id", expenseId);
    if (error) throw error;
  }

  async function _moveExpenseToTrip(expenseId, newTripId) {
    await _ensureSession();
    if (!expenseId || !newTripId) throw new Error("[Trip] Déplacement invalide.");

    // 1) Move the expense itself
    {
      const { error } = await sb
        .from(TB_CONST.TABLES.trip_expenses)
        .update({ trip_id: newTripId })
        .eq("id", expenseId);
      if (error) throw error;
    }

    // 2) Keep shares consistent (shares are queried by trip_id AND expense_id in some flows)
    {
      const { error } = await sb
        .from(TB_CONST.TABLES.trip_expense_shares)
        .update({ trip_id: newTripId })
        .eq("expense_id", expenseId);
      if (error) throw error;
    }

    // 3) Best-effort: if budget links table exists, align trip_id as well
    try {
      await sb
        .from(TB_CONST.TABLES.trip_expense_budget_links)
        .update({ trip_id: newTripId })
        .eq("expense_id", expenseId);
    } catch (e) {
      // ignore if table/column doesn't exist in this deployment
    }
  }

  function _expenseFormHTML({ editingExpenseId, editingDraft, trip, canWrite, memberOptions, walletOptions, categoryOptions, modal = false }) {
    const title = editingExpenseId ? "Modifier la dépense" : "Dépense";
    const subtitle = editingExpenseId
      ? `<div class="muted" style="margin:4px 0 10px 0;">Édition complète : split, wallet et budget seront recalculés proprement.</div>`
      : ``;
    const body = `
      <div class="row">
        <div class="field">
          <label>Date</label>
          <input id="trip-exp-date" type="date" value="${escapeHTML(editingDraft?.date || toLocalISODate(new Date()))}" />
        </div>
        <div class="field" style="min-width:220px;">
          <label>Payé par</label>
          <select id="trip-exp-paidby">${memberOptions}</select>
        </div>
      </div>
      <div class="row">
        <div class="field" style="min-width:220px;">
          <label>Wallet (si payé par moi)</label>
          <select id="trip-exp-wallet">
            <option value="">—</option>
            ${walletOptions}
          </select>
        </div>
        <div class="field" style="min-width:200px;">
          <label>Catégorie (Budget)</label>
          <select id="trip-exp-category">
            ${categoryOptions}
          </select>
        </div>
        <div class="field" style="min-width:180px;">
          <label>Hors budget</label>
          <select id="trip-exp-out">
            <option value="no">Non</option>
            <option value="yes">Oui</option>
          </select>
        </div>
      </div>
      <div class="row">
        <div class="field" style="flex:1;">
          <label>Libellé</label>
          <input id="trip-exp-label" placeholder="Ex: Dîner" value="${escapeHTML(editingDraft?.label || "")}" />
        </div>
        <div class="field" style="max-width:160px;">
          <label>Montant</label>
          <input id="trip-exp-amount" type="number" step="0.01" placeholder="0" value="${editingDraft?.amount ?? ""}" />
        </div>
        <div class="field" style="max-width:160px;">
          <label>Devise</label>
          <input id="trip-exp-currency" value="${escapeHTML(editingDraft?.currency || trip?.base_currency || state?.period?.baseCurrency || "THB")}" />
        </div>
      </div>
      <div class="row" style="align-items:flex-end; gap:12px; margin-top:6px;">
        <div class="field" style="min-width:220px;">
          <label>Répartition</label>
          <select id="trip-split-mode">
            <option value="equal">Égal</option>
            <option value="percent">%</option>
            <option value="amount">Montants</option>
          </select>
        </div>
      </div>
      <div id="trip-split-box" style="margin-top:6px;"></div>
      <div class="muted" style="margin-top:6px;">Si tu payes pour plusieurs, la wallet est débitée du total mais le budget ne comptera que ta part.</div>
      <div class="row" style="justify-content:flex-end; margin-top:10px; gap:8px;">
        ${editingExpenseId ? `<button class="btn" type="button" id="trip-cancel-edit-exp">Annuler modification</button>` : ``}
        <button class="btn primary" id="trip-add-exp" ${canWrite ? "" : "disabled"} ${trip ? "" : "disabled"}>${editingExpenseId ? "Enregistrer modifications" : "Ajouter dépense"}</button>
      </div>`;

    if (!modal) {
      return `<div class="card"><h2>${title}</h2>${subtitle}${body}</div>`;
    }

    return `
      <div id="trip-edit-exp-overlay" style="position:fixed; inset:0; background:rgba(15,23,42,0.38); z-index:10020; display:flex; align-items:flex-start; justify-content:center; padding:32px 16px; overflow:auto;">
        <div class="card" style="width:min(920px, 100%); margin:0; box-shadow:0 18px 48px rgba(0,0,0,0.18);">
          <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px;">
            <div>
              <h2 style="margin:0;">${title}</h2>
              ${subtitle}
            </div>
            <button class="btn" type="button" id="trip-edit-exp-close" aria-label="Fermer">✕</button>
          </div>
          ${body}
        </div>
      </div>`;
  }

  async function _renderUI() {
    const root = _root();
    if (!root) return;

    const trip = tripState.trips.find(t => t.id === tripState.activeTripId) || null;
    const myRole = tripState.myRole || 'owner';
    const canWrite = (myRole !== 'viewer');
    const members = tripState.members;
    const expenses = tripState.expenses;
    const editingExpenseId = tripState.editingExpenseId || null;
    const editingDraft = tripState.editingExpenseDraft || null;

    

    const globalNetHTML = "";// removed: global net to avoid confusion


    const balancesByCurRaw = (await _fetchBalancesFromDb(tripState.activeTripId)) || _computeBalances();
    const balancesByCur = _unifyBalancesToDisplayCurrency(balancesByCurRaw);
    const settlementsByCur = _computeSettlements(balancesByCur);
    const settlementSuggestionsRaw = (await _fetchSettlementSuggestionsFromDb(tripState.activeTripId, true)) || [];

    const balHTML = (() => {
      if (!members.length) return `<div class="muted">Ajoute des participants.</div>`;
      const parts = [];
      for (const [cur, m] of balancesByCur.entries()) {
        parts.push(`<div class="muted" style="margin-top:8px;">${escapeHTML(cur)}</div>`);
        for (const mem of members) {
          const v = m.get(mem.id) || 0;
          const cls = v < -1e-9 ? "bad" : (v > 1e-9 ? "good" : "");
          parts.push(
            `<div style="display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid rgba(0,0,0,0.04);">
              <span>${escapeHTML(mem.name)}${mem.isMe ? " (moi)" : ""}</span>
              <strong class="${cls}">${_fmtMoney(v, cur)}</strong>
            </div>`
          );
        }
      }


      // NOTE: settlements history is rendered once below the suggested settlements section
      // to avoid duplicate "Historique règlements" blocks.

      return parts.join("");
    })();

    const settlementsHTML = (() => {
      if (!members.length) return "";
      const me = members.find(x => x.isMe);
      const tripName = (tripState.trips.find(t => t.id === tripState.activeTripId)?.name) || "Trip";
      const parts = [];

      function _memName(id) {
        return (members.find(x => x.id === id)?.name) || "—";
      }

      // NEW (V8.2.0): optimized suggestions from DB (net_raw)
      if (Array.isArray(settlementSuggestionsRaw) && settlementSuggestionsRaw.length) {
        parts.push(`<div class="muted" style="margin-top:10px;">Règlements optimisés (net brut)</div>`);
        for (const row of settlementSuggestionsRaw) {
          const cur = String(row.out_currency || row.currency || "").toUpperCase();
          const fromId = row.from_member_id || row.fromMemberId;
          const toId = row.to_member_id || row.toMemberId;
          const amt = Number(row.amount || 0);
          if (!cur || !fromId || !toId || !(amt > 0)) continue;
          parts.push(
            `<div style="display:flex; justify-content:space-between; align-items:center; gap:10px; padding:6px 0; border-bottom:1px solid rgba(0,0,0,0.04);">
              <span>${escapeHTML(_memName(fromId))} → ${escapeHTML(_memName(toId))}</span>
              <strong>${_fmtMoney(amt, cur)}</strong>
            </div>`
          );
        }
        parts.push(`<div class="muted" style="margin-top:6px; font-size:12px;">Basé sur les parts (avant règlements enregistrés). Les boutons ci-dessous restent basés sur le solde courant.</div>`);
      }

      const hasAny = (() => {
        for (const [, transfers] of settlementsByCur.entries()) if (transfers?.length) return true;
        return false;
      })();

      // Share / copy controls (even if no settlements)
      parts.push(`<div style="display:flex; gap:8px; align-items:center; margin-top:10px; flex-wrap:wrap;">
        <button class="btn" id="trip-copy-settlements" type="button">Copier les règlements</button>
        <button class="btn" id="trip-share-settlements" type="button">Partager</button>
        <span class="muted">${hasAny ? "Format Tricount" : "Rien à régler pour l'instant"}</span>
      </div>`);

      if (!hasAny) return parts.join("");

      for (const [cur, transfers] of settlementsByCur.entries()) {
        if (!transfers.length) continue;
        parts.push(`<div class="muted" style="margin-top:10px;">Règlements suggérés • ${escapeHTML(cur)}</div>`);
        for (const t of transfers) {
          const from = members.find(x => x.id === t.fromId);
          const to = members.find(x => x.id === t.toId);

          const isMeInvolved = !!me && (t.fromId === me.id || t.toId === me.id);
          let actionBtn = "";
          let actionOnlyBtn = "";

          // Wallet-based settlement only makes sense when I am involved (it creates a Budget transaction in MY wallets).
          if (isMeInvolved) {
            const actionLabel = (t.fromId === me.id) ? `Je paie ${escapeHTML(to?.name || "—")}` : `Je reçois de ${escapeHTML(from?.name || "—")}`;
            actionBtn = `<button class="btn" type="button"
                          data-settle-from="${t.fromId}"
                          data-settle-to="${t.toId}"
                          data-settle-cur="${escapeHTML(cur)}"
                          data-settle-amt="${t.amount}">${actionLabel}</button>`;
          }

          // NEW: allow recording a manual settlement even when neither side is "me" (tiers ↔ tiers).
          // This only records a trip_settlement_event, and does NOT touch wallets.
          if (canWrite) {
            const labelOnly = isMeInvolved ? "Solder (sans wallet)" : "Marquer comme réglé";
            actionOnlyBtn = `<button class="btn" type="button" style="background:#fff; color:#111; border:1px solid rgba(0,0,0,0.15);"
                          data-settle-only="1"
                          data-settle-from="${t.fromId}"
                          data-settle-to="${t.toId}"
                          data-settle-cur="${escapeHTML(cur)}"
                          data-settle-amt="${t.amount}">${labelOnly}</button>`;
          }

          parts.push(
            `<div style="display:flex; justify-content:space-between; align-items:center; gap:10px; padding:6px 0; border-bottom:1px solid rgba(0,0,0,0.04);">
              <span>${escapeHTML(from?.name || "—")} → ${escapeHTML(to?.name || "—")}</span>
              <div style="display:flex; align-items:center; gap:10px;">
                <strong>${_fmtMoney(t.amount, cur)}${(String(cur).toUpperCase()==="THB" ? ` <span class="muted" style="font-weight:400;">(≈ ${_fmtMoney(_safeFx(t.amount, "THB", "EUR"), "EUR")})</span>` : "")}</strong>
                ${actionBtn}${actionOnlyBtn}
              </div>
            </div>`
          );
        }
      }


      // Persisted settlements history (affects balances)
      const histRows = (tripState.settlementEvents || []).filter(x => !x.cancelledAt);
      if (histRows.length) {
        parts.push(`<div class="muted" style="margin-top:14px;">Historique règlements</div>`);
        const byDate = histRows.slice().sort((a,b) => (b.createdAt||"").localeCompare(a.createdAt||""));
        for (const ev of byDate) {
          const from = members.find(x => x.id === ev.fromMemberId);
          const to = members.find(x => x.id === ev.toMemberId);
          const canCancel = canWrite && (myRole === "owner" || (sbUser && ev.createdBy === sbUser.id));
          const btn = canCancel ? `<button class="btn" type="button" data-cancel-settle="${ev.id}">Annuler</button>` : "";
          parts.push(
            `<div style="display:flex; justify-content:space-between; align-items:center; gap:10px; padding:6px 0; border-bottom:1px solid rgba(0,0,0,0.04);">
              <span class="muted">${escapeHTML(from?.name || "—")} → ${escapeHTML(to?.name || "—")}</span>
              <div style="display:flex; align-items:center; gap:10px;">
                <strong>${_fmtMoney(ev.amount, ev.currency)}</strong>
                ${btn}
              </div>
            </div>`
          );
        }
      }

      return parts.join("");
    })();


    const tripOptions = tripState.trips
      .map(t => `<option value="${t.id}" ${t.id === tripState.activeTripId ? "selected" : ""}>${escapeHTML(t.name)}</option>`)
      .join("");

    const memberOptions = members
      .map(m => {
        const meTag = m.isMe ? " (moi)" : "";
        const emailTag = m.email ? ` — ${escapeHTML(m.email)}` : "";
        return `<option value="${m.id}">${escapeHTML(m.name)}${meTag}${emailTag}</option>`;
      })
      .join("");

    const walletOptions = (state.wallets || [])
      .map(w => `<option value="${w.id}">${escapeHTML(w.name)} (${escapeHTML(w.currency)})</option>`)
      .join("");

    const categoryOptions = (getCategories() || [])
      .map(c => `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`)
      .join("");

    const expensesHTML = expenses.length
      ? await Promise.all(expenses.map(async ex => {
          const payer = members.find(m => m.id === ex.paidByMemberId);
          const moveUI = ""; // removed move between trips
          const isLinked = await _expenseIsEditLocked(ex);
          const linkedLabel = isLinked ? " • lié au budget/wallet" : (ex.transactionId ? " • lié au budget" : "");
          const editBtn = `<button class="btn" type="button" data-edit-exp="${ex.id}" title="${isLinked ? "Édition complète (wallet/budget inclus)" : "Modifier"}">Modifier</button>`;
return `
            <div style="display:flex; justify-content:space-between; align-items:flex-start; padding:10px 0; border-bottom:1px solid rgba(0,0,0,0.04); gap:12px;">
              <div style="min-width:0;">
                <div style="font-weight:700;">${escapeHTML(ex.label)}</div>
                <div class="muted" style="font-size:12px;">${escapeHTML(ex.date)}${payer ? ` • payé par ${escapeHTML(payer.name)}` : ""}${linkedLabel}</div>
              </div>
              <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap; justify-content:flex-end;">
                <strong>${_fmtMoney(ex.amount, ex.currency)}</strong>
                ${moveUI}
                <button class="btn" type="button" data-exp-detail="${ex.id}">Détail</button>
                ${editBtn}
                <button class="btn danger" type="button" data-del-exp="${ex.id}">Supprimer</button>
              </div>
            </div>
          `;
        }))
      : [`<div class="muted">Aucune dépense.</div>`];

    const expensesHTMLJoined = Array.isArray(expensesHTML) ? expensesHTML.join("") : expensesHTML;

    const editExpenseModalHTML = editingExpenseId
      ? _expenseFormHTML({ editingExpenseId, editingDraft, trip, canWrite, memberOptions, walletOptions, categoryOptions, modal: true })
      : "";

    root.innerHTML = `
      ${globalNetHTML}
      <div class="grid">
        <div class="card">
          <h2>Partage</h2>
          <div class="row" style="margin-bottom:10px;">
            <div class="field" style="min-width:260px;">
              <label>Partage actif</label>
              <select id="trip-active">${tripOptions || ""}</select>
            </div>
            <div class="field" style="flex:1;">
              <label>Nouveau partage</label>
              <input id="trip-new-name" placeholder="Ex: Laos" />
            </div>
            <div class="field" style="align-self:flex-end;">
              <button class="btn primary" id="trip-create">Créer</button>
            </div>
            <div class="field" style="align-self:flex-end;">
              <button class="btn danger" id="trip-delete" ${trip ? "" : "disabled"}>Supprimer</button>
            </div>
          </div>

          <h2 style="margin-top:14px;">Participants</h2>
          <div class="row" style="margin-bottom:10px;">
            <div class="field" style="flex:1;">
              <label>Nom</label>
              <input id="trip-member-name" placeholder="Ex: Paul" />
            </div>
            <div class="field" style="min-width:240px;">
              <label>Email (optionnel)</label>
              <input id="trip-member-email" placeholder="ex: paul@email.com" />
            </div>
            <div class="field" style="align-self:flex-end;">
              <button class="btn" id="trip-add-member" ${trip ? "" : "disabled"}>Ajouter</button>
            </div>
          </div>

          <div id="trip-members-list">
            ${members.length ? members.map(m => `
              <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid rgba(0,0,0,0.04); gap:12px;">
                <div style="min-width:0;">
                  <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                    <strong>${escapeHTML(m.name)}</strong>
                    ${m.isMe ? `<span class="pill" style="font-size:12px;">Moi</span>` : ``}
                  </div>
                  <div class="muted" style="font-size:12px; ${m.isMe ? "font-weight:600;" : ""}">
                    ${m.email ? escapeHTML(m.email) : `<em>invitation en attente</em>`}
                  </div>
                </div>
                ${canWrite ? `<button class="btn" type="button" data-rename-member="${m.id}">Renommer</button>` : ``}
                <button class="btn danger" data-del-member="${m.id}">Supprimer</button>
              </div>
            `).join("") : `<div class="muted">Aucun participant.</div>`}
          </div>
        </div>

        ${editingExpenseId
          ? `<div class="card"><h2>Dépense</h2><div class="muted">Ajout rapide disponible hors édition. La modification s’ouvre dans une fenêtre dédiée.</div></div>`
          : _expenseFormHTML({ editingExpenseId, editingDraft, trip, canWrite, memberOptions, walletOptions, categoryOptions, modal: false })}
      </div>

      <div class="card" style="margin-top:12px;">
        <div style="display:flex; gap:8px; align-items:center; justify-content:space-between; flex-wrap:wrap;">
          <h2 style="margin:0;">Récap / Historique</h2>
          <div style="display:flex; gap:8px; align-items:center;">
            <button class="btn" id="trip-tab-recap" type="button">Récap</button>
            <button class="btn" id="trip-tab-history" type="button" style="background:#fff; color:#111; border:1px solid rgba(0,0,0,0.15);">Historique</button>
          </div>
        </div>

        <div id="trip-tab-content-recap" style="margin-top:10px;">
          <div style="display:flex; gap:14px; align-items:flex-start; flex-wrap:wrap;">
            <div style="flex:1 1 260px; min-width:260px;">
              <h3 style="margin:0 0 8px 0;">Balances</h3>
              ${balHTML}
            </div>
            <div style="flex:2 1 320px; min-width:320px;">
              ${settlementsHTML}
            </div>
          </div>
        </div>

        <div id="trip-tab-content-history" style="margin-top:10px; display:none;">
          ${expensesHTMLJoined}
        </div>
      </div>
      ${editExpenseModalHTML}
    `;

    if (editingDraft) {
      const paidSelInit = _el("trip-exp-paidby");
      if (paidSelInit && editingDraft.paidByMemberId) paidSelInit.value = editingDraft.paidByMemberId;
      const walletSelInit = _el("trip-exp-wallet");
      if (walletSelInit && editingDraft.walletId) walletSelInit.value = editingDraft.walletId;
      const catSelInit = _el("trip-exp-category");
      if (catSelInit && editingDraft.category) catSelInit.value = editingDraft.category;
      const outSelInit = _el("trip-exp-out");
      if (outSelInit) outSelInit.value = editingDraft.outOfBudget ? "yes" : "no";
      const splitModeInit = _el("trip-split-mode");
      if (splitModeInit && editingDraft.split?.mode) splitModeInit.value = editingDraft.split.mode;
    }

    const sel = _el("trip-active");
    if (sel) {
      sel.onchange = async () => {
        tripState.activeTripId = sel.value || null;
        localStorage.setItem(TRIP_ACTIVE_KEY, tripState.activeTripId || "");
        if (typeof window.__tripRefresh === "function") await window.__tripRefresh({ activeOnly: true });
};
    }


    // Tabs: Récap / Historique (balances on left, settlements on right)
    const btnTabRecap = _el("trip-tab-recap");
    const btnTabHist = _el("trip-tab-history");
    const boxRecap = _el("trip-tab-content-recap");
    const boxHist = _el("trip-tab-content-history");

    function _setTripTab(tab) {
      const t = (tab === "history") ? "history" : "recap";
      try { localStorage.setItem(TRIP_TAB_KEY, t); } catch (_) {}
      if (boxRecap) boxRecap.style.display = (t === "recap") ? "" : "none";
      if (boxHist) boxHist.style.display = (t === "history") ? "" : "none";

      // simple visual state
      if (btnTabRecap) {
        btnTabRecap.classList.toggle("primary", t === "recap");
        if (t === "recap") btnTabRecap.style.cssText = "";
        else btnTabRecap.style.cssText = "background:#fff; color:#111; border:1px solid rgba(0,0,0,0.15);";
      }
      if (btnTabHist) {
        btnTabHist.classList.toggle("primary", t === "history");
        if (t === "history") btnTabHist.style.cssText = "";
        else btnTabHist.style.cssText = "background:#fff; color:#111; border:1px solid rgba(0,0,0,0.15);";
      }
    }

    if (btnTabRecap) btnTabRecap.onclick = () => _setTripTab("recap");
    if (btnTabHist) btnTabHist.onclick = () => _setTripTab("history");

    let initialTab = "recap";
    try { initialTab = localStorage.getItem(TRIP_TAB_KEY) || "recap"; } catch (_) {}
    _setTripTab(initialTab);

    const btnCreate = _el("trip-create");
    if (btnCreate) {
      btnCreate.onclick = async () => {
        try {
          const name = _el("trip-new-name").value.trim();
          if (!name) return toastWarn("Nom de trip requis.");
          await _createTrip(name);
          if (typeof window.__tripRefresh === "function") await window.__tripRefresh({ activeOnly: true });
toastOk("Trip créé.");
        } catch (e) {
          console.warn("[Trip] edit blocked", e);
          toastWarn(e?.message || String(e));
        }
      };
    }

    const btnDel = _el("trip-delete");
    if (btnDel) {
      btnDel.onclick = async () => {
        try {
          if (!tripState.activeTripId) return toastWarn("[Trip] Sélectionne un trip d\'abord.");
          if (!confirm("Supprimer ce trip ?")) return;
          const id = tripState.activeTripId;
          await _deleteTrip(id);
          if (typeof window.__tripRefresh === "function") await window.__tripRefresh({ activeOnly: true });
toastOk("Trip supprimé.");
        } catch (e) {
          toastWarn(e?.message || String(e));
        }
      };

    }

    const btnAddMem = _el("trip-add-member");
    if (btnAddMem) {
      btnAddMem.onclick = async () => {
        try {
          const name = _el("trip-member-name").value.trim();
          const email = (_el("trip-member-email")?.value || "").trim();
          if (!name) return toastWarn("Nom requis.");
          await _addMember(name, email);
          if (typeof window.__tripRefresh === "function") await window.__tripRefresh({ activeOnly: true });
toastOk("Participant ajouté.");
        } catch (e) {
          toastWarn(e?.message || String(e));
        }
      };
    }

    root.querySelectorAll("[data-del-member]").forEach(btn => {
      btn.onclick = async () => {
        try {
          const id = btn.getAttribute("data-del-member");
          if (!id) return;
          if (!confirm("Supprimer ce participant ?")) return;
          await _deleteMember(id);
          if (typeof window.__tripRefresh === "function") await window.__tripRefresh({ activeOnly: true });
          toastOk("Participant supprimé.");
        } catch (e) {
          toastWarn(e?.message || String(e));
        }
      };
    });

    root.querySelectorAll("[data-rename-member]").forEach(btn => {
      btn.onclick = async () => {
        try {
          const id = btn.getAttribute("data-rename-member");
          if (!id) return;
          const current = (tripState.members || []).find(m => m.id === id)?.name || "";
          const next = prompt("Nouveau nom du participant :", current);
          if (next === null) return;
          const name = String(next || "").trim();
          if (!name || name === String(current || "").trim()) return;
          await _renameMember(id, name);
          if (typeof window.__tripRefresh === "function") await window.__tripRefresh({ activeOnly: true });
          toastOk("Participant renommé.");
        } catch (e) {
          toastWarn(e?.message || String(e));
        }
      };
    });


    function _syncExpenseWalletUI() {
  
    // Split UI (equal / percent / amount)
    function _renderSplitBox() {
      const box = _el("trip-split-box");
      if (!box) return;
      const mode = (_el("trip-split-mode")?.value || "equal");
      const members = tripState.members || [];
      const amt = Number(_el("trip-exp-amount")?.value || 0);

      // Preserve current inputs if re-rendering
      const prevPct = {};
      const prevAmt = {};
      members.forEach(m => {
        const p = _el(`trip-split-pct-${m.id}`)?.value;
        const a = _el(`trip-split-amt-${m.id}`)?.value;
        if (p !== undefined) prevPct[m.id] = p;
        if (a !== undefined) prevAmt[m.id] = a;
      });

      if (mode === "equal") {
        box.innerHTML = `<div class="muted">Égal entre ${members.length} participant(s).</div>`;
        return;
      }

      let rows = "";
      if (mode === "percent") {
        const def = members.length ? (100 / members.length) : 0;
        members.forEach(m => {
          const seedPct = editingDraft?.split?.percents?.[m.id];
          const v = (prevPct[m.id] ?? seedPct ?? def).toString();
          rows += `<tr>
            <td style="padding:6px 8px;">${escapeHTML(m.name || "—")}${m.isMe ? " <span class='muted'>(moi)</span>" : ""}</td>
            <td style="padding:6px 8px; text-align:right;">
              <input id="trip-split-pct-${m.id}" type="number" step="0.01" min="0" style="max-width:120px;" value="${escapeHTML(v)}" />
            </td>
          </tr>`;
        });
        box.innerHTML = `
          <div class="muted" style="margin-bottom:6px;">Somme = 100%</div>
          <table style="width:100%; border-collapse:collapse;">
            <thead><tr><th style="text-align:left; padding:6px 8px;">Participant</th><th style="text-align:right; padding:6px 8px;">%</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
          <div class="muted" style="margin-top:6px;">Les montants seront arrondis au centime et ajustés pour retomber exactement sur le total.</div>
        `;
        return;
      }

      if (mode === "amount") {
        const def = members.length ? (amt / members.length) : 0;
        members.forEach(m => {
          const seedAmt = editingDraft?.split?.amounts?.[m.id];
          const v = (prevAmt[m.id] ?? seedAmt ?? (def ? def.toFixed(2) : "")).toString();
          rows += `<tr>
            <td style="padding:6px 8px;">${escapeHTML(m.name || "—")}${m.isMe ? " <span class='muted'>(moi)</span>" : ""}</td>
            <td style="padding:6px 8px; text-align:right;">
              <input id="trip-split-amt-${m.id}" type="number" step="0.01" min="0" style="max-width:140px;" value="${escapeHTML(v)}" />
            </td>
          </tr>`;
        });
        box.innerHTML = `
          <div class="muted" style="margin-bottom:6px;">Somme = total</div>
          <table style="width:100%; border-collapse:collapse;">
            <thead><tr><th style="text-align:left; padding:6px 8px;">Participant</th><th style="text-align:right; padding:6px 8px;">Montant</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
          <div class="muted" style="margin-top:6px;">La somme doit égaler le total (à 0,01 près).</div>
        `;
        return;
      }

      box.innerHTML = "";
    }

    const splitModeSel = _el("trip-split-mode");
    if (splitModeSel) splitModeSel.onchange = _renderSplitBox;

    const amtInp = _el("trip-exp-amount");
    if (amtInp) amtInp.oninput = () => {
      const mode = (_el("trip-split-mode")?.value || "equal");
      if (mode === "amount") _renderSplitBox();
    };

    _renderSplitBox();

    const paidSel = _el("trip-exp-paidby");
      const wSel = _el("trip-exp-wallet");
      if (!paidSel || !wSel) return;
      const payer = members.find(m => m.id === paidSel.value) || null;
      const isMe = !!payer?.isMe;
      wSel.disabled = !isMe;
      if (!isMe) {
        wSel.value = "";
        return;
      }
      // Auto-pick a wallet matching the expense currency
      const cur = (_el("trip-exp-currency")?.value || "").trim().toUpperCase();
      const match = (state.wallets || []).find(w => String(w.currency || "").toUpperCase() === cur);
      if (match && (!wSel.value || wSel.value === "")) wSel.value = match.id;
    }

    const btnAddExp = _el("trip-add-exp");
    if (btnAddExp) {
      btnAddExp.onclick = async () => {
        try {
          btnAddExp.disabled = true;

          const date = _el("trip-exp-date").value;
          const label = _el("trip-exp-label").value.trim();
          const amount = _el("trip-exp-amount").value;
          const currency = _el("trip-exp-currency").value.trim().toUpperCase();
          const paidByMemberId = _el("trip-exp-paidby").value;
          const walletId = _el("trip-exp-wallet")?.value || "";
          const category = _el("trip-exp-category")?.value || "Autre";
          const outOfBudget = (_el("trip-exp-out")?.value || "no") === "yes";
          const split = (() => {
            const mode = (_el("trip-split-mode")?.value || "equal");
            const members = (tripState.members || []);
            const percents = {};
            const amounts = {};
            if (mode === "percent") {
              members.forEach(m => {
                const v = _el(`trip-split-pct-${m.id}`)?.value;
                if (v !== undefined) percents[m.id] = v;
              });
            } else if (mode === "amount") {
              members.forEach(m => {
                const v = _el(`trip-split-amt-${m.id}`)?.value;
                if (v !== undefined) amounts[m.id] = v;
              });
            }
            return { mode, percents, amounts };
          })();
          if (editingExpenseId) {
            await _updateExpense({ expenseId: editingExpenseId, date, label, amount, currency, paidByMemberId, walletId, category, outOfBudget, split });
            await _refreshAfterTripMutation("trip:update_expense");
            toastOk("Dépense modifiée.");
          } else {
            await _addExpense({ date, label, amount, currency, paidByMemberId, walletId, category, outOfBudget, split });
            await _refreshAfterTripMutation("trip:add_expense");
            toastOk("Dépense ajoutée.");
          }
        } catch (e) {
          toastWarn(e?.message || String(e));
        }
      };
    }

    const btnCancelEditExp = _el("trip-cancel-edit-exp");
    if (btnCancelEditExp) {
      btnCancelEditExp.onclick = async () => {
        try {
          await _cancelEditExpense();
        } catch (e) {
          toastWarn(e?.message || String(e));
        }
      };
    }

    const btnCloseEditExp = _el("trip-edit-exp-close");
    if (btnCloseEditExp) {
      btnCloseEditExp.onclick = async () => {
        try {
          await _cancelEditExpense();
        } catch (e) {
          toastWarn(e?.message || String(e));
        }
      };
    }

    const editOverlay = _el("trip-edit-exp-overlay");
    if (editOverlay) {
      editOverlay.onclick = async (ev) => {
        if (ev.target !== editOverlay) return;
        try {
          await _cancelEditExpense();
        } catch (e) {
          toastWarn(e?.message || String(e));
        }
      };
    }

    const paidSel = _el("trip-exp-paidby");
    if (paidSel) paidSel.onchange = _syncExpenseWalletUI;

    const curInp = _el("trip-exp-currency");
    if (curInp) curInp.oninput = _syncExpenseWalletUI;

    _syncExpenseWalletUI();


    // Settlement actions (only for transfers involving "me")
    tripState._buildSettlementMessage = _buildSettlementMessage; // expose for safety

    root.querySelectorAll("[data-settle-from][data-settle-to]").forEach(btn => {
      btn.onclick = async () => {
        try {
          const fromId = btn.getAttribute("data-settle-from");
          const toId = btn.getAttribute("data-settle-to");
          const cur = String(btn.getAttribute("data-settle-cur") || "").toUpperCase();
          const amt = Number(btn.getAttribute("data-settle-amt") || 0);

          if (!fromId || !toId || !cur || !(amt > 0)) throw new Error("Règlement invalide.");
          const me = members.find(x => x.isMe);
          const isOut = me && (fromId === me.id);

          _openSettlementModal({ fromId, toId, currency: cur, amount: amt, isOut, members });
        } catch (e) {
          toastWarn(e?.message || String(e));
        }
      };
    });


    root.querySelectorAll("[data-settle-only][data-settle-from][data-settle-to]").forEach(btn => {
      btn.onclick = async () => {
        try {
          const fromId = btn.getAttribute("data-settle-from");
          const toId = btn.getAttribute("data-settle-to");
          const cur = String(btn.getAttribute("data-settle-cur") || "").toUpperCase();
          const amt = Number(btn.getAttribute("data-settle-amt") || 0);
          if (!fromId || !toId || !cur || !(amt > 0)) throw new Error("Règlement invalide.");

          // Create a settlement event ONLY (does not touch wallets)
          _settleModalState = { fromId, toId, currency: cur, amount: amt, isOut: null };
          await _persistSettlementEventOnly();
          _settleModalState = null;

          if (typeof window.__tripRefresh === "function") await window.__tripRefresh({ activeOnly: true });
          toastOk("Règlement enregistré (sans wallet).");
        } catch (e) {
          toastWarn("[Trip] " + normalizeSbError(e));
        }
      };
    });



    root.querySelectorAll("[data-cancel-settle]").forEach(btn => {
      btn.onclick = async () => {
        try {
          const id = btn.getAttribute("data-cancel-settle");
          if (!id) return;
          const ok = confirm("Annuler ce règlement ?\n\nNote: cela ne supprime PAS la transaction wallet associée (si elle existe).");
          if (!ok) return;
          await _cancelSettlementEvent(id);
          if (typeof window.__tripRefresh === "function") await window.__tripRefresh({ activeOnly: true });
toastOk("Règlement annulé.");
        } catch (e) {
          toastWarn("[Trip] " + normalizeSbError(e));
        }
      };
    });


    const btnCopy = _el("trip-copy-settlements");
    if (btnCopy) {
      btnCopy.onclick = async () => {
        try {
          const tripName = (tripState.trips.find(t => t.id === tripState.activeTripId)?.name) || "Trip";
          const msg = (tripState._buildSettlementMessage || _buildSettlementMessage)(tripName, tripState.members || [], settlementsByCur);
          if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(msg);
            toastOk("Copié.");
          } else {
            prompt("Copie ce message :", msg);
          }
        } catch (e) {
          toastWarn(e?.message || String(e));
        }
      };
    }

    const btnShare = _el("trip-share-settlements");
    if (btnShare) {
      btnShare.onclick = async () => {
        try {
          const tripName = (tripState.trips.find(t => t.id === tripState.activeTripId)?.name) || "Trip";
          const msg = (tripState._buildSettlementMessage || _buildSettlementMessage)(tripName, tripState.members || [], settlementsByCur);
          if (navigator.share) {
            await navigator.share({ title: `Règlements • ${tripName}`, text: msg });
          } else if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(msg);
            toastOk("Copié (partage non supporté ici).");
          } else {
            prompt("Partage ce message :", msg);
          }
        } catch (e) {
          toastWarn(e?.message || String(e));
        }
      };
    }



    root.querySelectorAll('[data-exp-detail]').forEach(btn => {
  btn.onclick = async () => {
    try {
      const id = btn.getAttribute('data-exp-detail');
      const ex = (tripState.expenses || []).find(e => e.id === id);
      if (!ex) return;
      const members = tripState.members || [];
      const shares = (tripState.shares || []).filter(s => s.expenseId === id);
      _openExpenseDetailModal({ ex, shares, members });
    } catch (e) {
      toastWarn(e?.message || String(e));
    }
  };
});
root.querySelectorAll("[data-edit-exp]").forEach(btn => {
      btn.onclick = async () => {
        try {
          const id = btn.getAttribute("data-edit-exp");
          if (!id) return;
          await _beginEditExpense(id);
          try {
            setTimeout(() => { try { _el("trip-exp-label")?.focus(); } catch(_) {} }, 50);
          } catch(_) {}
          toastOk("Fenêtre de modification ouverte.");
        } catch (e) {
          toastWarn(e?.message || String(e));
        }
      };
    });
root.querySelectorAll("[data-del-exp]").forEach(btn => {
      btn.onclick = async () => {
        try {
          const id = btn.getAttribute("data-del-exp");
          const ex = (tripState.expenses || []).find(x => x.id === id) || null;
          const isLocked = ex ? await _expenseIsEditLocked(ex) : false;
          const confirmMsg = isLocked
            ? `Supprimer cette dépense ?

Cette suppression retirera aussi les liens budget/wallet associés.`
            : "Supprimer cette dépense ?";
          if (!confirm(confirmMsg)) return;
          await _deleteExpense(id);
          await _refreshAfterTripMutation("trip:delete_expense");
          toastOk("Dépense supprimée.");
        } catch (e) {
          toastWarn(e?.message || String(e));
        }
      };
    });

    // Move expense to another trip
    root.querySelectorAll("[data-move-exp]").forEach(btn => {
      btn.onclick = async () => {
        try {
          const expenseId = btn.getAttribute("data-move-exp");
          const sel = root.querySelector(`[data-move-trip="${expenseId}"]`);
          const newTripId = sel ? (sel.value || "") : "";
          if (!expenseId) return;
          if (!newTripId) return toastWarn("Choisis un trip cible.");

          const targetTrip = (tripState.trips || []).find(t => t.id === newTripId);
          const targetName = targetTrip?.name || "(trip)";
          const ok = confirm(`Déplacer cette dépense vers : ${targetName} ?`);
          if (!ok) return;

          btn.disabled = true;
          await _moveExpenseToTrip(expenseId, newTripId);
          if (typeof window.__tripRefresh === "function") await window.__tripRefresh({ activeOnly: true });
          toastOk("Dépense déplacée.");
        } catch (e) {
          toastWarn(e?.message || String(e));
        } finally {
          try { btn.disabled = false; } catch (_) {}
        }
      };
    });
  }

  // refresh options:
  // - activeOnly: skip reloading trip list if already loaded (faster after mutations)
  // - forceTrips: force reload trip list
  async function refresh(opts) {
    const o = opts || {};
    const needTrips = !!o.forceTrips || !tripState._tripsLoaded || !(tripState.trips || []).length;

    if (!o.activeOnly || needTrips) {
      await _loadTrips();
    }

    // Ensure activeTripId remains valid (even in activeOnly mode)
    if (tripState.activeTripId && !(tripState.trips || []).some(t => t.id === tripState.activeTripId)) {
      tripState.activeTripId = tripState.trips[0]?.id || null;
    }
    if (!tripState.activeTripId && (tripState.trips || []).length) {
      tripState.activeTripId = tripState.trips[0]?.id || null;
    }

    if (tripState.activeTripId) localStorage.setItem(TRIP_ACTIVE_KEY, tripState.activeTripId);
    await _loadActiveData();
    await _renderUI();
  }
    // Expose for modal callbacks
    window.__tripRefresh = refresh;


  // Exposed function expected by navigation
  window.renderTrip = async function renderTrip() {
    const root = _root();
    if (!root) return;

    root.innerHTML = `<div class="card"><div class="muted">Chargement…</div></div>`;
    try {
      await _ensureSession();
      await _acceptInviteFromURL();
      if (typeof window.__tripRefresh === "function") await window.__tripRefresh({ activeOnly: true });
} catch (e) {
      root.innerHTML = `
        <div class="card">
          <h2>Trip</h2>
          <div class="bad" style="margin-top:8px;">Erreur: ${escapeHTML(e?.message || String(e))}</div>
          <div class="muted" style="margin-top:8px;">
            Si tu viens de te connecter, recharge la page.
          </div>
        </div>
      `;
    }
  };
})();