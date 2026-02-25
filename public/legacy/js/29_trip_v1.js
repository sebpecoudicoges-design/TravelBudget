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
      const { data, error } = await sb
        .from("trip_participants")
        .select("role")
        .eq("trip_id", tripId)
        .eq("auth_user_id", state.user.id)
        .maybeSingle();
      if (error) return null;
      return data?.role || null;
    } catch (e) {
      return null;
    }
  }

  async function _createInviteLink(tripId, role) {
    // role: 'member' | 'viewer'
    const token = (crypto?.randomUUID ? crypto.randomUUID() : (Date.now() + "-" + Math.random()).replace(/\./g, ""));
    const expiresAt = new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString(); // 14 days
    const payload = {
      token,
      trip_id: tripId,
      role: role || "member",
      created_by: await _ensureSession(),
      expires_at: expiresAt,
    };
    const { error } = await sb.from("trip_invites").insert(payload);
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
      const { error } = await sb.rpc("trip_accept_invite", { p_token: token });
      if (error) throw error;

      // remove invite param from hash (avoid re-accept on reload)
      const cleaned = hash.replace(/([#&?])invite=[^&]+&?/g, "$1").replace(/[#&?]$/, "");
      window.location.hash = cleaned || "#trip";
      toastOk("[Trip] Invitation acceptée.");
      return true;
    } catch (e) {
      toastWarn("[Trip] Invitation invalide/expirée.");
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

  let tripState = {
    trips: [],
    activeTripId: null,
    members: [],
    expenses: [],
    shares: [],
    myRole: null,
    lastInviteUrl: null,
  };

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
      .from("transactions")
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
      .from("trip_expenses")
      .select("id,transaction_id")
      .eq("id", expenseId)
      .maybeSingle();
    if (exErr) throw exErr;
    if (exRow?.transaction_id && exRow.transaction_id !== transactionId) {
      throw new Error("Cette dépense Trip est déjà liée à une transaction.");
    }

    const { data: txRow, error: txErr } = await sb
      .from("transactions")
      .select("id,trip_expense_id")
      .eq("id", transactionId)
      .maybeSingle();
    if (txErr) throw txErr;
    if (txRow?.trip_expense_id && txRow.trip_expense_id !== expenseId) {
      throw new Error("Cette transaction Budget est déjà liée à une autre dépense Trip.");
    }

    // Best-effort 2-step link; rollback on partial failure.
    const { error: e1 } = await sb
      .from("trip_expenses")
      .update({ transaction_id: transactionId })
      
      .eq("id", expenseId);
    if (e1) throw e1;

    const { error: e2 } = await sb
      .from("transactions")
      .update({ trip_expense_id: expenseId })
      
      .eq("id", transactionId);
    if (e2) {
      await sb.from("trip_expenses").update({ transaction_id: null }).eq("id", expenseId);
      throw e2;
    }
  }

  async function _unlinkExpenseFromTransaction(expense) {
    const uid = await _ensureSession();
    if (!expense?.transactionId) return;
    const txId = expense.transactionId;

    await sb.from("transactions").update({ trip_expense_id: null }).eq("id", txId);
    await sb.from("trip_expenses").update({ transaction_id: null }).eq("id", expense.id);
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
    .from("trip_expense_budget_links")
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
    .from("trip_expense_budget_links")
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
      .from("trip_groups")
      .select("*")
      
      .order("created_at", { ascending: false });
    if (error) throw error;

    tripState.trips = data || [];

    // Global net balances (per trip & currency) for current user (optional view)
    try {
      const { data: netRows, error: netErr } = await sb
        .from("v_trip_user_net_balances")
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
  }

  async function _loadActiveData() {
    const uid = await _ensureSession();
    const tripId = tripState.activeTripId;

    tripState.members = [];
    tripState.expenses = [];
    tripState.shares = [];
    if (!tripId) return;

    tripState.myRole = await _getMyTripRole(tripId);

    const [{ data: m, error: mErr }, { data: e, error: eErr }, { data: s, error: sErr }, { data: se, error: seErr }] = await Promise.all([
      sb.from("trip_members").select("*").eq("trip_id", tripId).order("created_at", { ascending: true }),
      sb.from("trip_expenses").select("*").eq("trip_id", tripId).order("date", { ascending: false }),
      sb.from("trip_expense_shares").select("*").eq("trip_id", tripId),
      sb.from("trip_settlement_events").select("*").eq("trip_id", tripId).is("cancelled_at", null),
    ]);

    if (mErr) throw mErr;
    if (eErr) throw eErr;
    if (sErr) throw sErr;
    if (seErr) throw seErr;

    tripState.members = (m || []).map(x => ({
      id: x.id,
      name: x.name,
      isMe: !!x.is_me,
    }));

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

  // Unify balances into a single THB view (for readability).
  // Shows EUR equivalent (≈) using fxConvert if available, otherwise period eurBaseRate.
  function _unifyBalancesToTHB(balancesByCurRaw) {
    const out = new Map();
    const mTHB = new Map();
    const eurBaseRate = Number(state?.period?.eurBaseRate) || 0;

    function toTHB(amount, cur) {
      const amt = Number(amount) || 0;
      const c = String(cur || "").toUpperCase();
      if (!c) return 0;
      if (c === "THB") return amt;
      if (typeof window.fxConvert === "function") {
        const v = window.fxConvert(amt, c, "THB");
        return Number.isFinite(v) ? v : 0;
      }
      // fallback: only EUR<->THB supported via period rate
      if (c === "EUR" && eurBaseRate > 0) return amt * eurBaseRate;
      return 0;
    }

    for (const [cur, m] of (balancesByCurRaw || new Map()).entries()) {
      for (const [memberId, v] of m.entries()) {
        const thb = toTHB(v, cur);
        if (!thb) continue;
        mTHB.set(memberId, (mTHB.get(memberId) || 0) + thb);
      }
    }

    out.set("THB", mTHB);
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

async function _persistSettlementEventOnly() {
  if (!_settleModalState) throw new Error("Aucun règlement en cours.");
  const uid = await _ensureSession();
  const { fromId, toId, currency, amount } = _settleModalState;
  const eventId = (crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + "-" + Math.random().toString(16).slice(2);
  const { error: seInsErr } = await sb.from("trip_settlement_events").insert([{
    id: eventId,
    trip_id: tripState.activeTripId,
    currency: String(currency || "").trim().toUpperCase(),
    amount: _round2(Number(amount) || 0),
    from_member_id: fromId,
    to_member_id: toId,
    created_by: uid,
  }]);
  if (seInsErr) throw seInsErr;
  if (typeof window.__tripRefresh === "function") await window.__tripRefresh();
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
  const { error: seInsErr } = await sb.from("trip_settlement_events").insert([{
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

  const { error: rpcErr } = await sb.rpc("apply_transaction", {
    p_user_id: uid,
    p_wallet_id: walletId,
    p_type: txType,
    p_label: label,
    p_amount: _round2(walletAmount),
    p_currency: walletCurrency,
    p_date_start: date,
    p_date_end: date,
    p_category: null,
    p_subcategory: null,
    p_pay_now: true,
    p_out_of_budget: true,
    p_trip_expense_id: null,
    p_trip_share_link_id: null,
  });
  if (rpcErr) throw rpcErr;

  // 3) Best-effort link tx id back to settlement event
  try {
    const { data: txRow } = await sb
      .from("transactions")
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
      await sb.from("trip_settlement_events")
        .update({ transaction_id: txRow.id })
        .eq("id", eventId);
    }
  } catch (e) {
    console.warn("[Trip] settlement tx link failed", e);
  }

  if (typeof window.__tripRefresh === "function") await window.__tripRefresh();
}

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
      const { error: seInsErr } = await sb.from("trip_settlement_events").insert([{
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
      const { error: rpcErr } = await sb.rpc("apply_transaction", {
        p_wallet_id: walletId,
        p_type: txType,
        p_amount: amt,
        p_currency: cur,
        p_category: "Trip",
        p_label: label,
        p_date_start: date,
        p_date_end: date,
        p_pay_now: true,
        p_out_of_budget: true,
        p_night_covered: false,
      });
      if (rpcErr) throw rpcErr;

      // Update settlement event with transaction_id (best-effort)
      try {
        const { data: txRow, error: txErr } = await sb
          .from("transactions")
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
          await sb.from("trip_settlement_events")
            .update({ transaction_id: txRow.id })
            .eq("id", eventId);
        }
      } catch (e) {
        console.warn("[Trip] settlement event tx link failed", e);
      }

  
      // Record in trip_settlements (personal log)
      try {
        await sb.from("trip_settlements").insert({
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
      .from("trip_groups")
      .insert([{ user_id: uid, name, base_currency: baseCur }])
      .select("*")
      .single();
    if (error) throw error;


    // Access control: register owner participant (RLS)
    // Some schemas/triggers may already create this row; ignore unique/409 conflicts.
    {
      const { error: pErr } = await sb.from("trip_participants").insert([{ trip_id: data.id, auth_user_id: uid, role: "owner" }]);
      if (pErr) {
        const status = pErr.status || pErr.statusCode;
        const code = pErr.code;
        if (status === 409 || code === "23505") {
          console.warn("[Trip] owner participant already exists (ignored)");
        } else {
          throw pErr;
        }
      }
    }

    // default member: Me
    const memPayload = { user_id: uid, trip_id: data.id, name: "Moi", is_me: true };
    const { error: mErr } = await sb.from("trip_members").insert([memPayload]);
    if (mErr) throw mErr;

    tripState.activeTripId = data.id;
    localStorage.setItem(TRIP_ACTIVE_KEY, data.id);
  }

  async function _deleteTrip(tripId) {
    const uid = await _ensureSession();
    // defensive delete children first (avoids 409 even if cascade isn't present)
    // 1) unlink budget transactions that reference trip expenses (if enabled)
    try {
      const { data: exIds } = await sb.from("trip_expenses").select("id,transaction_id").eq("trip_id", tripId);
      const linkedTx = (exIds || []).map(x => x.transaction_id).filter(Boolean);
      const expIds = (exIds || []).map(x => x.id);
      if (linkedTx.length) {
        await sb.from("transactions").update({ trip_expense_id: null }).in("id", linkedTx);
      }
      if (expIds.length) {
        await sb.from("trip_expenses").update({ transaction_id: null }).in("id", expIds);
      }
    } catch (e) {
      console.warn("Trip unlink before delete failed:", e);
    }

    await sb.from("trip_expense_shares").delete().eq("trip_id", tripId);
    await sb.from("trip_expenses").delete().eq("trip_id", tripId);
    await sb.from("trip_members").delete().eq("trip_id", tripId);

    const { error } = await sb.from("trip_groups").delete().eq("id", tripId);
    if (error) throw error;

    if (tripState.activeTripId === tripId) tripState.activeTripId = null;
  }

  async function _addMember(name, isMe) {
    const uid = await _ensureSession();
    const tripId = tripState.activeTripId;
    if (!tripId) return;

    if (isMe) {
      await sb.from("trip_members").update({ is_me: false }).eq("trip_id", tripId);
    }

    const payload = { user_id: uid, trip_id: tripId, name, is_me: !!isMe };
    const { error } = await sb.from("trip_members").insert([payload]);
    if (error) throw error;
  }

  async function _deleteMember(memberId) {
    const uid = await _ensureSession();
    const tripId = tripState.activeTripId;
    if (!tripId) return;

    // Block deletion if the member is referenced by an expense payer or any share.
    const usedAsPayer = tripState.expenses.some(e => e.paidByMemberId === memberId);
    const usedInShares = tripState.shares.some(s => s.memberId === memberId);
    if (usedAsPayer || usedInShares) {
      toastWarn("Impossible de supprimer ce participant : il est lié à des dépenses (payeur et/ou parts). Réassigne ou supprime d'abord les dépenses concernées.");
      return;
    }

    const { error } = await sb.from("trip_members").delete().eq("trip_id", tripId).eq("id", memberId);
    if (error) throw error;
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
            const { data: ex, error: exErr } = await sb
              .from("trip_expenses")
              .insert([{
                user_id: uid,
                trip_id: tripId,
                date,
                label,
                amount: amt,
                currency: cur,
                paid_by_member_id: paidByMemberId,
              }])
              .select("*")
              .single();
            if (exErr) throw exErr;

            // Shares
            const memberIds = members.map(m => m.id);
            const parts = _computeSplitParts(amt, members, split);
            _validateSplitParts(amt, parts);
            const shares = members.map((m, i) => ({
              user_id: uid,
              trip_id: tripId,
              expense_id: ex.id,
              member_id: m.id,
              share_amount: parts[i] ?? 0,
            }));
            const { error: sErr } = await sb.from("trip_expense_shares").insert(shares);
            if (sErr) throw sErr;

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
                   await sb.from("transactions").update({ out_of_budget: true }).eq("id", m0.id);
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
                    const { error: rpcErrB } = await sb.rpc("apply_transaction", {
                      p_wallet_id: walletId,
                      p_type: "expense",
                      p_amount: myShare2,
                      p_currency: cur,
                      p_category: cat,
                      p_label: consLabel,
                      p_date_start: date,
                      p_date_end: date,
                      p_pay_now: false,
                      p_out_of_budget: out,
                      p_night_covered: false,
                    });
                    if (rpcErrB) throw rpcErrB;

                    const { data: txRowsB, error: txErrB } = await sb
                      .from("transactions")
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
              await sb.from("transactions").update({ is_internal: true }).eq("id", txB.id);
                      const targetPeriodId = _findPeriodIdForDate(date);
                      if (targetPeriodId && (!txB.period_id || txB.period_id !== targetPeriodId)) {
                        await sb.from("transactions").update({ period_id: targetPeriodId }).eq("id", txB.id);
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

    // 1) Create Trip expense + shares
    const { data: ex, error: exErr } = await sb
      .from("trip_expenses")
      .insert([{
        user_id: uid,
        trip_id: tripId,
        date,
        label,
        amount: amt,
        currency: cur,
        paid_by_member_id: paidByMemberId,
      }])
      .select("*")
      .single();
    if (exErr) throw exErr;

    const memberIds = members.map(m => m.id);
            const parts = _computeSplitParts(amt, members, split);

    _validateSplitParts(amt, parts);

    const shares = members.map((m, i) => ({
      user_id: uid,
      trip_id: tripId,
      expense_id: ex.id,
      member_id: m.id,
      share_amount: parts[i] ?? 0,
    }));
    const { error: sErr } = await sb.from("trip_expense_shares").insert(shares);
    if (sErr) throw sErr;


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
        const { error: rpcErr } = await sb.rpc("apply_transaction", {
          p_wallet_id: walletId,
          p_type: "expense",
          p_amount: amt,
          p_currency: cur,
          p_category: cat,
          p_label: `[Trip] ${label}`,
          p_date_start: date,
          p_date_end: date,
          p_pay_now: true,
          p_out_of_budget: out,
          p_night_covered: false,
        });
        if (rpcErr) throw rpcErr;

      // Update settlement event with transaction_id (best-effort)
      try {
        const { data: txRow, error: txErr } = await sb
          .from("transactions")
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
          await sb.from("trip_settlement_events")
            .update({ transaction_id: txRow.id })
            .eq("id", eventId);
        }
      } catch (e) {
        console.warn("[Trip] settlement event tx link failed", e);
      }


        const { data: txRows, error: txErr } = await sb
          .from("transactions")
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
            await sb.from("transactions").update({ period_id: targetPeriodId }).eq("id", tx.id);
          }
          await _linkExpenseToTransaction(ex.id, tx.id);
        } else {
          console.warn("Budget tx created but not found for linking.");
        }
      } else {
        if (!me || myIdx < 0 || !isFinite(myShare) || myShare <= 0) {
          toastWarn("[Trip] Impossible de déterminer ta part pour le budget (participant 'moi' manquant).");
        }

        // A) Cashflow advance (decrement wallet, NOT in budget)
        const advanceLabel = `[Trip] Avance - ${label}`;
        const { error: rpcErrA } = await sb.rpc("apply_transaction", {
          p_wallet_id: walletId,
          p_type: "expense",
          p_amount: amt,
          p_currency: cur,
          p_category: cat,
          p_label: advanceLabel,
          p_date_start: date,
          p_date_end: date,
          p_pay_now: true,
          p_out_of_budget: true, // key: do NOT count this advance in budget/allocations
          p_night_covered: false,
        });
        if (rpcErrA) throw rpcErrA;

        const { data: txRowsA, error: txErrA } = await sb
          .from("transactions")
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
            await sb.from("transactions").update({ period_id: targetPeriodId }).eq("id", txA.id);
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
            const { error: rpcErrB } = await sb.rpc("apply_transaction", {
              p_wallet_id: walletId,
              p_type: "expense",
              p_amount: myShare,
              p_currency: cur,
              p_category: cat,
              p_label: consLabel,
              p_date_start: date,
              p_date_end: date,
              p_pay_now: false,
              p_out_of_budget: out,
              p_night_covered: false,
            });
            if (rpcErrB) throw rpcErrB;

            const { data: txRowsB, error: txErrB } = await sb
              .from("transactions")
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
              await sb.from("transactions").update({ is_internal: true }).eq("id", txB.id);
              if (targetPeriodId && (!txB.period_id || txB.period_id !== targetPeriodId)) {
                await sb.from("transactions").update({ period_id: targetPeriodId }).eq("id", txB.id);
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

              const { error: rpcErr2 } = await sb.rpc("apply_transaction", {
                p_wallet_id: wId,
                p_type: "expense",
                p_amount: myShare,
                p_currency: cur,
                p_category: cat,
                p_label: budgetLabel,
                p_date_start: date,
                p_date_end: date,
                p_pay_now: false,
                p_out_of_budget: out,
                p_night_covered: false,
              });
              if (rpcErr2) throw rpcErr2;

              // Fetch created tx and link via trip_expense_budget_links
              const { data: txRows2, error: txErr2 } = await sb
                .from("transactions")
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
                await sb.from("transactions").update({ is_internal: true }).eq("id", tx2.id);
                if (targetPeriodId && (!tx2.period_id || tx2.period_id !== targetPeriodId)) {
                  await sb.from("transactions").update({ period_id: targetPeriodId }).eq("id", tx2.id);
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
    const uid = await _ensureSession();

    // Load expense locally (for transaction links)
    const ex = tripState.expenses.find(x => x.id === expenseId);

    // 1) If there are per-share budget links (unpaid "my share" etc.), remove them and delete their transactions.
    //    IMPORTANT: delete link rows BEFORE deleting transactions (FK safety).
    try {
      const { data: links, error: lerr } = await sb
        .from("trip_expense_budget_links")
        .select("transaction_id")
        
        .eq("expense_id", expenseId);

      if (lerr && lerr.code !== "PGRST116") throw lerr; // ignore "relation does not exist" style errors defensively
      if (links?.length) {
        // Delete link rows first
        const { error: dlerr } = await sb
          .from("trip_expense_budget_links")
          .delete()
          
          .eq("expense_id", expenseId);
        if (dlerr) throw dlerr;

        // Then delete each linked transaction (wallet adjusted by RPC)
        for (const row of links) {
          const txId = row.transaction_id;
          if (!txId) continue;
          const { error: derr } = await sb.rpc("delete_transaction", { p_tx_id: txId });
          if (derr) throw derr;
        }
      }
    } catch (e) {
      // If the link table doesn't exist in this deployment, ignore. Otherwise rethrow.
      const msg = (e && (e.message || e.toString())) || "";
      if (!msg.toLowerCase().includes("trip_expense_budget_links") &&
          !msg.toLowerCase().includes("relation") &&
          !msg.toLowerCase().includes("does not exist")) {
        throw e;
      }
    }

    // 2) If this expense is linked 1:1 to a budget transaction (paid by me), delete that transaction as well.
    //    IMPORTANT: clear trip_expenses.transaction_id first (FK safety), then call delete_transaction (which removes the tx and adjusts wallet).
    if (ex?.transactionId) {
      const txId = ex.transactionId;

      // Clear references on both sides (safe even if one column doesn't exist / RLS blocks some updates)
      await sb.from("trip_expenses").update({ transaction_id: null }).eq("id", expenseId);
      await sb.from("transactions").update({ trip_expense_id: null }).eq("id", txId);

      const { error: derr } = await sb.rpc("delete_transaction", { p_tx_id: txId });
      if (derr) throw derr;
    }

    
    // 2b) Safety net: if ANY transaction still references this expense via trip_expense_id, delete it/them first
    //     (prevents FK violations like: transactions_trip_expense_fk / transactions_trip_expense_id_fk)
    try {
      const { data: txRefs, error: txRefErr } = await sb
        .from("transactions")
        .select("id")
        
        .eq("trip_expense_id", expenseId);
      if (txRefErr) throw txRefErr;
      if (txRefs?.length) {
        for (const row of txRefs) {
          if (!row?.id) continue;
          const { error: derr } = await sb.rpc("delete_transaction", { p_tx_id: row.id });
          if (derr) throw derr;
        }
      }
    } catch (e) {
      // If RLS blocks the select or the column doesn't exist, we can't do more here.
      // In that case, the delete below may still fail; surface the error to the user.
    }

// 3) Delete shares and the expense itself
    await sb.from("trip_expense_shares").delete().eq("expense_id", expenseId);
    const { error } = await sb.from("trip_expenses").delete().eq("id", expenseId);
    if (error) throw error;
  }

  async function _moveExpenseToTrip(expenseId, newTripId) {
    await _ensureSession();
    if (!expenseId || !newTripId) throw new Error("[Trip] Déplacement invalide.");

    // 1) Move the expense itself
    {
      const { error } = await sb
        .from("trip_expenses")
        .update({ trip_id: newTripId })
        .eq("id", expenseId);
      if (error) throw error;
    }

    // 2) Keep shares consistent (shares are queried by trip_id AND expense_id in some flows)
    {
      const { error } = await sb
        .from("trip_expense_shares")
        .update({ trip_id: newTripId })
        .eq("expense_id", expenseId);
      if (error) throw error;
    }

    // 3) Best-effort: if budget links table exists, align trip_id as well
    try {
      await sb
        .from("trip_expense_budget_links")
        .update({ trip_id: newTripId })
        .eq("expense_id", expenseId);
    } catch (e) {
      // ignore if table/column doesn't exist in this deployment
    }
  }

  function _renderUI() {
    const root = _root();
    if (!root) return;

    const trip = tripState.trips.find(t => t.id === tripState.activeTripId) || null;
    const myRole = tripState.myRole || 'owner';
    const canWrite = (myRole !== 'viewer');
    const members = tripState.members;
    const expenses = tripState.expenses;

    

    const globalNetHTML = (() => {
      const rows = (tripState.globalNetRows || []);
      if (!rows.length) return "";
      // Aggregate totals by currency
      const totals = new Map(); // cur -> net
      for (const r of rows) {
        const cur = r.currency;
        const net = Number(r.net) || 0;
        totals.set(cur, (totals.get(cur) || 0) + net);
      }
      const totalLines = [];
      for (const [cur, net] of totals.entries()) {
        const label = net < -1e-9 ? "Net (je dois)" : (net > 1e-9 ? "Net (on me doit)" : "Net");
        totalLines.push(`<div><b>${escapeHTML(cur)}</b> : ${escapeHTML(_fmtMoney(_round2(net), cur))}</div>`);
      }

      // Per-trip breakdown (only show trips with non-zero net)
      const tripLines = [];
      for (const r of rows) {
        const net = Number(r.net) || 0;
        if (Math.abs(net) < 1e-9) continue;
        tripLines.push(`<div style="display:flex;justify-content:space-between;gap:12px;">
          <div class="muted">${escapeHTML(r.trip_name || "Trip")}</div>
          <div>${escapeHTML(_fmtMoney(_round2(net), r.currency))} <span class="muted">${escapeHTML(r.currency)}</span></div>
        </div>`);
      }

      return `
        <div class="card" style="margin-bottom:12px;">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;">
            <h3 style="margin:0;">Solde global</h3>
            <div class="muted" style="font-size:12px;">(tous trips)</div>
          </div>
          <div style="margin-top:8px;">${totalLines.join("") || `<div class="muted">0</div>`}</div>
          ${tripLines.length ? `<div style="margin-top:10px;border-top:1px solid rgba(0,0,0,.08);padding-top:10px;">${tripLines.join("")}</div>` : ""}
        </div>
      `;
    })();

const balancesByCurRaw = _computeBalances();
    const balancesByCur = _unifyBalancesToTHB(balancesByCurRaw);
    const settlementsByCur = _computeSettlements(balancesByCur);

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
              <strong class="${cls}">${_fmtMoney(v, cur)}${(String(cur).toUpperCase()==="THB" ? ` <span class="muted" style="font-weight:400;">(≈ ${_fmtMoney(_safeFx(v, "THB", "EUR"), "EUR")})</span>` : "")}</strong>
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

    const settlementsHTML = (() => {
      if (!members.length) return "";
      const me = members.find(x => x.isMe);
      const tripName = (tripState.trips.find(t => t.id === tripState.activeTripId)?.name) || "Trip";
      const parts = [];

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
          if (isMeInvolved) {
            const actionLabel = (t.fromId === me.id) ? `Je paie ${escapeHTML(to?.name || "—")}` : `Je reçois de ${escapeHTML(from?.name || "—")}`;
            actionBtn = `<button class="btn" type="button"
                          data-settle-from="${t.fromId}"
                          data-settle-to="${t.toId}"
                          data-settle-cur="${escapeHTML(cur)}"
                          data-settle-amt="${t.amount}">${actionLabel}</button>`;
            actionOnlyBtn = `<button class="btn" type="button" style="background:#fff; color:#111; border:1px solid rgba(0,0,0,0.15);"
                          data-settle-only="1"
                          data-settle-from="${t.fromId}"
                          data-settle-to="${t.toId}"
                          data-settle-cur="${escapeHTML(cur)}"
                          data-settle-amt="${t.amount}">Solder (sans wallet)</button>`;
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
      .map(m => `<option value="${m.id}">${escapeHTML(m.name)}${m.isMe ? " (moi)" : ""}</option>`)
      .join("");

    const walletOptions = (state.wallets || [])
      .map(w => `<option value="${w.id}">${escapeHTML(w.name)} (${escapeHTML(w.currency)})</option>`)
      .join("");

    const categoryOptions = (getCategories() || [])
      .map(c => `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`)
      .join("");

    const expensesHTML = expenses.length
      ? expenses.map(ex => {
          const payer = members.find(m => m.id === ex.paidByMemberId);
          const canMove = canWrite && (tripState.trips || []).length > 1;

          const moveOptions = (tripState.trips || [])
            .filter(t => t.id !== tripState.activeTripId)
            .map(t => `<option value="${t.id}">${escapeHTML(t.name)}</option>`)
            .join("");

          const moveUI = canMove ? `
            <div style="display:flex; gap:8px; align-items:center;">
              <select class="input" data-move-trip="${ex.id}" style="height:32px; padding:0 8px;">
                <option value="">Déplacer vers…</option>
                ${moveOptions}
              </select>
              <button class="btn" type="button" data-move-exp="${ex.id}">Déplacer</button>
            </div>
          ` : "";

          return `
            <div style="display:flex; justify-content:space-between; align-items:flex-start; padding:10px 0; border-bottom:1px solid rgba(0,0,0,0.04); gap:12px;">
              <div style="min-width:0;">
                <div style="font-weight:700;">${escapeHTML(ex.label)}</div>
                <div class="muted" style="font-size:12px;">${escapeHTML(ex.date)}${payer ? ` • payé par ${escapeHTML(payer.name)}` : ""}${ex.transactionId ? " • lié au budget" : ""}</div>
              </div>
              <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap; justify-content:flex-end;">
                <strong>${_fmtMoney(ex.amount, ex.currency)}</strong>
                ${moveUI}
                <button class="btn danger" type="button" data-del-exp="${ex.id}">Supprimer</button>
              </div>
            </div>
          `;
        }).join("")
      : `<div class="muted">Aucune dépense.</div>`;

    root.innerHTML = `
      ${globalNetHTML}
      <div class="grid">
        <div class="card">
          <h2>Voyage</h2>
          <div class="row" style="margin-bottom:10px;">
            <div class="field" style="min-width:260px;">
              <label>Trip actif</label>
              <select id="trip-active">${tripOptions || ""}</select>
            </div>
            <div class="field" style="flex:1;">
              <label>Nouveau trip</label>
              <input id="trip-new-name" placeholder="Ex: Thaïlande" />
            </div>
            <div class="field" style="align-self:flex-end;">
              <button class="btn primary" id="trip-create">Créer</button>
            </div>
            <div class="field" style="align-self:flex-end;">
              <button class="btn danger" id="trip-delete" ${trip ? "" : "disabled"}>Supprimer</button>
            </div>
            <div class="field" style="align-self:flex-end;">
              <select id="trip-invite-role" style="height:38px;">
                <option value="member">Inviter (membre)</option>
                <option value="viewer">Inviter (lecture)</option>
              </select>
            </div>
            <div class="field" style="align-self:flex-end;">
              <button class="btn" id="trip-invite" ${trip && canWrite ? "" : "disabled"}>Lien</button>
            </div>
            <div class="field" style="align-self:flex-end;">
                <div class="field" style="flex:1;min-width:260px;">
    <input id="tripInviteUrl" class="input" style="width:100%;" readonly placeholder="Lien d'invitation…"/>
  </div>
  <div class="field" style="align-self:flex-end;">
    <button class="btn" id="trip-invite-share" ${trip ? "" : "disabled"}>Partager</button>
  </div>
  <div class="field" style="align-self:flex-end;">
<button class="btn" id="trip-invite-copy" ${trip ? "" : "disabled"}>Copier</button>
            </div>
            </div>
          </div>

          <h2 style="margin-top:14px;">Participants</h2>
          <div class="row" style="margin-bottom:10px;">
            <div class="field" style="flex:1;">
              <label>Nom</label>
              <input id="trip-member-name" placeholder="Ex: Paul" />
            </div>
            <div class="field" style="min-width:140px;">
              <label>Moi</label>
              <select id="trip-member-me">
                <option value="no">Non</option>
                <option value="yes">Oui</option>
              </select>
            </div>
            <div class="field" style="align-self:flex-end;">
              <button class="btn" id="trip-add-member" ${trip ? "" : "disabled"}>Ajouter</button>
            </div>
          </div>

          <div id="trip-members-list">
            ${members.length ? members.map(m => `
              <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid rgba(0,0,0,0.04);">
                <div>
                  <strong>${escapeHTML(m.name)}</strong>
                  <span class="muted" style="font-size:12px;">${m.isMe ? " (moi)" : ""}</span>
                </div>
                <button class="btn danger" data-del-member="${m.id}">Supprimer</button>
              </div>
            `).join("") : `<div class="muted">Aucun participant.</div>`}
          </div>
        </div>

        <div class="card">
          <h2>Dépense</h2>
          <div class="row">
            <div class="field">
              <label>Date</label>
              <input id="trip-exp-date" type="date" value="${toLocalISODate(new Date())}" />
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
              <input id="trip-exp-label" placeholder="Ex: Dîner" />
            </div>
            <div class="field" style="max-width:160px;">
              <label>Montant</label>
              <input id="trip-exp-amount" type="number" step="0.01" placeholder="0" />
            </div>
            <div class="field" style="max-width:160px;">
              <label>Devise</label>
              <input id="trip-exp-currency" value="${escapeHTML(trip?.base_currency || state?.period?.baseCurrency || "THB")}" />
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
          <div class="row" style="justify-content:flex-end; margin-top:10px;">
            <button class="btn primary" id="trip-add-exp" ${canWrite ? "" : "disabled"} ${trip ? "" : "disabled"}>Ajouter dépense</button>
          </div>

          <h2 style="margin-top:16px;">Balances</h2>
          ${balHTML}
          <div style="margin-top:14px;"></div>
          ${settlementsHTML}
        </div>
      </div>

      <div class="card" style="margin-top:12px;">
        <h2>Historique</h2>
        ${expensesHTML}
      </div>
    `;

    const sel = _el("trip-active");
    if (sel) {
      sel.onchange = async () => {
        tripState.activeTripId = sel.value || null;
        localStorage.setItem(TRIP_ACTIVE_KEY, tripState.activeTripId || "");
        if (typeof window.__tripRefresh === "function") await window.__tripRefresh();
};
    }

    const btnCreate = _el("trip-create");
    if (btnCreate) {
      btnCreate.onclick = async () => {
        try {
          const name = _el("trip-new-name").value.trim();
          if (!name) return toastWarn("Nom de trip requis.");
          await _createTrip(name);
          if (typeof window.__tripRefresh === "function") await window.__tripRefresh();
toastOk("Trip créé.");
        } catch (e) {
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
          if (typeof window.__tripRefresh === "function") await window.__tripRefresh();
toastOk("Trip supprimé.");
        } catch (e) {
          toastWarn(e?.message || String(e));
        }
      };

    // Invite link (requires login)
    const btnInvite = _el("trip-invite");
    const btnInviteCopy = _el("trip-invite-copy");
    if (btnInvite) {
btnInvite.onclick = async () => {
      try {
        const tripId = tripState.activeTripId;
        if (!tripId) return toastWarn("[Trip] Sélectionne un trip d'abord.");
        const roleSel = _el("trip-invite-role");
        const role = roleSel ? roleSel.value : "member";
        const url = await _createInviteLink(tripId, role);
        tripState.inviteUrl = url;
        const el = document.getElementById("tripInviteUrl");
        if (el) el.value = url || "";
        toastInfo("[Trip] Lien créé.");
      } catch (e) {
        toastWarn("[Trip] " + normalizeSbError(e));
      }
    };

    }
    
    const btnInviteShare = _el("trip-invite-share");
    if (btnInviteShare) {
      btnInviteShare.onclick = async () => {
        try {
          const url = tripState.inviteUrl;
          if (!url) return toastWarn("[Trip] Crée d’abord un lien.");
          await _shareText("Rejoins mon trip : " + url);
        } catch (e) {
          toastWarn("[Trip] " + normalizeSbError(e));
        }
      };
    }
if (btnInviteCopy) {
      btnInviteCopy.onclick = async () => {
        try {
          const url = tripState.inviteUrl;
          if (!url) return toastWarn("[Trip] Crée d’abord un lien.");
          _copyToClipboard(url);
          toastInfo("[Trip] Lien copié.");
        } catch (e) {
          toastWarn("[Trip] " + normalizeSbError(e));
        }
      };
    }

    }

    const btnAddMem = _el("trip-add-member");
    if (btnAddMem) {
      btnAddMem.onclick = async () => {
        try {
          const name = _el("trip-member-name").value.trim();
          const isMe = _el("trip-member-me").value === "yes";
          if (!name) return toastWarn("Nom requis.");
          await _addMember(name, isMe);
          if (typeof window.__tripRefresh === "function") await window.__tripRefresh();
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
          if (!confirm("Supprimer ce participant ?")) return;
          await _deleteMember(id);
          if (typeof window.__tripRefresh === "function") await window.__tripRefresh();
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
          const v = (prevPct[m.id] ?? def).toString();
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
          const v = (prevAmt[m.id] ?? (def ? def.toFixed(2) : "")).toString();
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
          await _addExpense({ date, label, amount, currency, paidByMemberId, walletId, category, outOfBudget, split });
          if (typeof window.__tripRefresh === "function") await window.__tripRefresh();
toastOk("Dépense ajoutée.");
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
          const me = members.find(x => x.is_me);
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

          if (typeof window.__tripRefresh === "function") await window.__tripRefresh();
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
          const { error } = await sb
            .from("trip_settlement_events")
            .update({ cancelled_at: new Date().toISOString() })
            .eq("id", id);
          if (error) throw error;
          if (typeof window.__tripRefresh === "function") await window.__tripRefresh();
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

    root.querySelectorAll("[data-del-exp]").forEach(btn => {
      btn.onclick = async () => {
        try {
          const id = btn.getAttribute("data-del-exp");
          if (!confirm("Supprimer cette dépense ?")) return;
          await _deleteExpense(id);
          if (typeof window.__tripRefresh === "function") await window.__tripRefresh();
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
          if (typeof window.__tripRefresh === "function") await window.__tripRefresh();
          toastOk("Dépense déplacée.");
        } catch (e) {
          toastWarn(e?.message || String(e));
        } finally {
          try { btn.disabled = false; } catch (_) {}
        }
      };
    });
  }

  async function refresh() {
    await _loadTrips();
    if (tripState.activeTripId) localStorage.setItem(TRIP_ACTIVE_KEY, tripState.activeTripId);
    await _loadActiveData();
    _renderUI();
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
      if (typeof window.__tripRefresh === "function") await window.__tripRefresh();
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