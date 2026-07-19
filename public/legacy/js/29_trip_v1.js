(function () {
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

  function _isTripEmail(value) {
    const email = String(value || "").trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function _tripInviteUrl(token) {
    const base = window.location.origin + window.location.pathname;
    return base + "#trip&invite=" + encodeURIComponent(token);
  }

  async function _createInviteForExistingMember(memberId, email) {
    const tripId = tripState.activeTripId;
    if (!tripId) throw new Error("Trip introuvable.");
    const cleanEmail = String(email || "").trim();
    if (!_isTripEmail(cleanEmail)) throw new Error("Email invalide.");

    const member = (tripState.members || []).find((m) => String(m.id) === String(memberId));
    if (!member) throw new Error("Participant introuvable.");

    const createdBy = await _ensureSession();
    const token = (crypto?.randomUUID ? crypto.randomUUID() : (Date.now() + "-" + Math.random()).replace(/\./g, ""));
    const expiresAt = new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString();

    const updatePayload = { email: cleanEmail };
    const { error: updateErr } = await sb
      .from(TB_CONST.TABLES.trip_members)
      .update(updatePayload)
      .eq("trip_id", tripId)
      .eq("id", memberId);
    if (updateErr) throw updateErr;

    const { error: inviteErr } = await sb.from(TB_CONST.TABLES.trip_invites).insert({
      token,
      trip_id: tripId,
      role: "member",
      created_by: createdBy,
      expires_at: expiresAt,
      member_id: memberId,
    });
    if (inviteErr) throw inviteErr;

    const url = _tripInviteUrl(token);
    tripState.lastInviteUrl = url;
    return {
      url,
      email: cleanEmail,
      name: member.name || "Participant",
      expiresAt,
    };
  }

  async function _sendInviteForExistingMember(memberId) {
    const member = (tripState.members || []).find((m) => String(m.id) === String(memberId));
    if (!member) throw new Error("Participant introuvable.");
    const currentEmail = String(member.email || "").trim();
    const nextEmail = prompt(`Email pour ${member.name || "ce participant"} :`, currentEmail);
    if (nextEmail === null) return null;
    const email = String(nextEmail || "").trim();
    if (!_isTripEmail(email)) throw new Error("Email invalide.");

    const invite = await _createInviteForExistingMember(memberId, email);
    const tripName = (tripState.trips || []).find((t) => String(t.id) === String(tripState.activeTripId))?.name || "TravelBudget";
    const subject = `Invitation Trip - ${tripName}`;
    const body = [
      `Bonjour ${invite.name || ""}`.trim() + ",",
      "",
      "Voici ton lien d'invitation pour rejoindre le partage Trip :",
      invite.url,
      "",
      "Le lien expire dans 14 jours.",
    ].join("\n");

    await _copyToClipboard(invite.url);
    try {
      window.location.href = `mailto:${encodeURIComponent(invite.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    } catch (_) {}
    return invite;
  }

  async function _acceptInviteFromURL() {
    const hash = window.location.hash || "";
    const m = hash.match(/(?:\?|&|#)invite=([^&]+)/);
    if (!m) return false;
    const token = decodeURIComponent(m[1] || "");
    if (!token) return false;

    try {
      await _rpcAcceptInvite(token);

      const cleaned = hash.replace(/([#&?])invite=[^&]+&?/g, "$1").replace(/[#&?]$/, "");
      window.location.hash = cleaned || "#trip";
      toastOk("[Trip] Invitation acceptée.");
      try { tripState._tripsLoaded = false; } catch (_) {}
      return true;
    } catch (e) {
      toastWarn("[Trip] Invitation invalide/expirée.");
      return false;
    }
  }

async function _rpcAcceptInvite(token) {
  const rpcName = TB_CONST?.RPCS?.accept_trip_invite || "accept_trip_invite";
  const legacy = TB_CONST?.RPCS?.trip_accept_invite || "trip_accept_invite";
  let { error } = await sb.rpc(rpcName, { p_token: token });
  if (error) {
    // fallback
    const res2 = await sb.rpc(legacy, { p_token: token });
    if (res2.error) throw res2.error;
  }
}

  async function _requestPayerApprovalIfNeeded(expenseId, paidByMemberId) {
    try {
      if (!expenseId) return null;
      if (await _tripShouldUseOfflineMode("trip:payerApproval")) return null;
      const rpcName = TB_CONST?.RPCS?.trip_request_payer_approval || "trip_request_payer_approval";
      const { data, error } = await sb.rpc(rpcName, { p_expense_id: expenseId });
      if (error) throw error;
      if (data) {
        try { await _sendTripPayerApprovalPush(data); } catch (_) {}
        try { if (typeof window.tbRefreshInboxBadge === "function") window.tbRefreshInboxBadge(); } catch (_) {}
        toastOk("[Trip] Demande d'ajout Budget envoyée aux participants concernés.");
      }
      return data || null;
    } catch (e) {
      console.warn("[Trip] payer approval request failed:", e);
      return null;
    }
  }

  async function _sendTripPayerApprovalPush(inboxId) {
    if (!inboxId || typeof window.tbSendMobilePushNotification !== "function") return null;
    const { data: item, error } = await sb
      .from(TB_CONST.TABLES.inbox_items)
      .select("id,user_id,source,raw_text,media,target_type,target_id")
      .eq("id", inboxId)
      .maybeSingle();
    if (error || !item?.user_id) return null;
    const media = item.media || {};
    const tripName = media.trip_name || "Trip";
    const label = media.expense_label || "Dépense";
    const amount = media.member_share_amount || media.amount || "";
    const currency = media.currency || "";
    return window.tbSendMobilePushNotification({
      user_id: item.user_id,
      title: "Validation Budget Trip",
      body: `${tripName} · ${label}${amount ? ` · ${amount} ${currency}` : ""}`,
      source: "trip_payer_approval",
      view: "inbox",
      notification_key: `trip-payer-approval:${item.id}`,
      data: {
        kind: "trip_payer_approval",
        id: item.id,
        inbox_id: item.id,
        trip_id: media.trip_id || "",
        expense_id: media.expense_id || item.target_id || "",
        view: "inbox",
      },
    });
  }

  async function _loadPendingTripInvites() {
    try {
      if (await _tripShouldUseOfflineMode("trip:pendingInvites")) return [];
      await _ensureSession();
      const rpcName = TB_CONST?.RPCS?.trip_pending_invites_for_current_user || "trip_pending_invites_for_current_user";
      const { data, error } = await sb.rpc(rpcName);
      if (error) {
        if (!window.__tbTripPendingInviteRpcWarned) {
          window.__tbTripPendingInviteRpcWarned = true;
          console.warn("[Trip] pending invites RPC unavailable:", error);
        }
        return [];
      }
      return (data || []).map((row) => ({
        token: row.token,
        tripId: row.trip_id || row.tripId,
        tripName: row.trip_name || row.tripName || "Trip",
        memberId: row.member_id || row.memberId,
        memberName: row.member_name || row.memberName || "Participant",
        role: row.role || "member",
        inviterEmail: row.inviter_email || row.inviterEmail || "",
        inviterName: row.inviter_name || row.inviterName || row.inviter_email || "",
        expiresAt: row.expires_at || row.expiresAt || null,
        createdAt: row.created_at || row.createdAt || null,
      })).filter((row) => row.token && row.tripId);
    } catch (e) {
      console.warn("[Trip] pending invites load failed:", e);
      return [];
    }
  }

  function _pendingTripInvitesHTML(invites) {
    return window.UI?.tripView?.renderPendingTripInvites({
      invites,
      language: typeof window.tbGetLang === "function" ? window.tbGetLang() : "fr",
      escapeHTML,
    }) || "";
  }

  function _syncTripInviteNotification(invites) {
    try {
      const rows = Array.isArray(invites) ? invites.filter((row) => row?.token && row?.tripId) : [];
      try {
        if (typeof window.tbSetNotificationBucket === "function") {
          window.tbSetNotificationBucket("trip_invites", rows.map((invite) => ({
            title: (typeof window.tbGetLang === "function" && window.tbGetLang() === "en") ? "Trip invitation" : "Invitation Trip",
            body: `${invite.tripName || "Trip"} · ${invite.inviterName || invite.inviterEmail || "TravelBudget"}`,
            view: "trip",
          })));
        }
      } catch (_) {}
      const tab = document.getElementById("tab-trip");
      if (tab) {
        tab.classList.toggle("tb-has-trip-invite", rows.length > 0);
        tab.setAttribute("data-trip-invite-count", rows.length ? String(rows.length) : "");
        tab.title = rows.length ? `${rows.length} invitation Trip en attente` : "";
      }

      let box = document.getElementById("tb-trip-invite-notice");
      if (!rows.length) {
        if (box) box.remove();
        return;
      }

      const en = typeof window.tbGetLang === "function" && window.tbGetLang() === "en";
      if (!box) {
        box = document.createElement("button");
        box.id = "tb-trip-invite-notice";
        box.type = "button";
        box.className = "tb-trip-invite-notice";
        box.addEventListener("click", () => {
          try { showView("trip"); } catch (_) { window.location.hash = "#trip"; }
        });
        document.body.appendChild(box);
      }
      const first = rows[0];
      box.innerHTML = `
        <span class="tb-trip-invite-dot">${rows.length}</span>
        <span class="tb-trip-invite-copy">
          <strong>${escapeHTML(en ? "Trip invitation" : "Invitation Trip")}</strong>
          <small>${escapeHTML(first.tripName || "Trip")} · ${escapeHTML(first.inviterName || first.inviterEmail || "TravelBudget")}</small>
        </span>
      `;
      box.style.display = "inline-flex";
    } catch (e) {
      console.warn("[Trip] invite notification sync failed:", e);
    }
  }

  async function _refreshTripInviteNotification() {
    const invites = await _loadPendingTripInvites();
    tripState.pendingInvites = invites;
    _syncTripInviteNotification(invites);
    return invites;
  }

  window.tbRefreshTripInviteNotifications = _refreshTripInviteNotification;

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

  function _tripT(key, vars) {
    try {
      return window.tbT ? window.tbT(key, vars) : key;
    } catch (_) {
      return key;
    }
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

function _tripFlashMessage(msg, kind) {
  try {
    const previous = document.getElementById("trip-flash-message");
    if (previous) previous.remove();
    const node = document.createElement("div");
    node.id = "trip-flash-message";
    node.setAttribute("role", kind === "warn" ? "alert" : "status");
    node.setAttribute("aria-live", kind === "warn" ? "assertive" : "polite");
    node.textContent = String(msg || "");
    Object.assign(node.style, {
      position: "fixed",
      zIndex: "10050",
      left: "max(12px, env(safe-area-inset-left))",
      right: "max(12px, env(safe-area-inset-right))",
      bottom: "max(16px, calc(env(safe-area-inset-bottom) + 12px))",
      maxWidth: "680px",
      margin: "0 auto",
      padding: "12px 14px",
      borderRadius: "8px",
      border: kind === "warn" ? "1px solid #f59e0b" : "1px solid #22c55e",
      background: kind === "warn" ? "#fff7ed" : "#f0fdf4",
      color: kind === "warn" ? "#7c2d12" : "#14532d",
      boxShadow: "0 10px 28px rgba(15, 23, 42, 0.22)",
      fontSize: "14px",
      lineHeight: "1.4",
      overflowWrap: "anywhere",
    });
    document.body.appendChild(node);
    window.setTimeout(() => node.remove(), kind === "warn" ? 7000 : 3500);
    return true;
  } catch (_) {
    return false;
  }
}

function toastWarn(msg) {
  console.warn("[Trip]", msg);
  if (!_tripFlashMessage(msg, "warn")) alert("[Trip] " + msg);
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
    _tripFlashMessage(msg, "ok");
  }

  function _tripOfflineFallback() {
    try {
      return (typeof window.tbIsOfflineMode === "function" && window.tbIsOfflineMode()) || (navigator && navigator.onLine === false);
    } catch (_) {
      return false;
    }
  }

  async function _tripShouldUseOfflineMode(reason) {
    try {
      if (typeof window.tbShouldUseOfflineMode === "function") {
        return await window.tbShouldUseOfflineMode(reason || "trip");
      }
    } catch (_) {
      return true;
    }
    return _tripOfflineFallback();
  }

  const tripStore = window.Data?.createTripStore?.();
  if (!tripStore?.state) throw new Error("Trip store indisponible");
  let tripState = tripStore.state;
  let _tripExpenseEditorModal = null;
  window.__tripState = tripState;
  window.__tripStore = tripStore;

  function _setActiveTripId(id) {
    if (typeof tripStore.setActiveTripId === "function") return tripStore.setActiveTripId(id, localStorage);
    tripState.activeTripId = id || null;
    return tripState.activeTripId;
  }

  function _resolveActiveTripId() {
    if (typeof tripStore.resolveActiveTripId === "function") return tripStore.resolveActiveTripId(localStorage);
    const stored = localStorage.getItem("travelbudget_trip_active_id_v1");
    tripState.activeTripId = stored && (tripState.trips || []).some(t => t.id === stored) ? stored : tripState.trips[0]?.id || null;
    return tripState.activeTripId;
  }

  function _clearActiveTripId() {
    if (typeof tripStore.clearActiveTripId === "function") return tripStore.clearActiveTripId(localStorage);
    tripState.activeTripId = null;
    try { localStorage.removeItem("travelbudget_trip_active_id_v1"); } catch (_) {}
  }

  function _setTripStoredTab(tab) {
    if (typeof tripStore.setTab === "function") return tripStore.setTab(tab, localStorage);
    const t = tab === "history" ? "history" : "recap";
    try { localStorage.setItem("travelbudget_trip_tab_v1", t); } catch (_) {}
    return t;
  }

  function _readTripStoredTab() {
    if (typeof tripStore.readTab === "function") return tripStore.readTab(localStorage);
    try { return localStorage.getItem("travelbudget_trip_tab_v1") || "recap"; } catch (_) { return "recap"; }
  }

  function _tripRepository() {
    const repository = window.Data?.tripRepository;
    if (!repository) throw new Error("Trip repository indisponible");
    return repository;
  }

  function _tripRepositoryTables() {
    return {
      groups: TB_CONST.TABLES.trip_groups,
      participants: TB_CONST.TABLES.trip_participants,
      members: TB_CONST.TABLES.trip_members,
      expenses: TB_CONST.TABLES.trip_expenses,
      shares: TB_CONST.TABLES.trip_expense_shares,
      settlementEvents: TB_CONST.TABLES.trip_settlement_events,
      settlements: TB_CONST.TABLES.trip_settlements,
      budgetLinks: TB_CONST.TABLES.trip_expense_budget_links,
      transactions: TB_CONST.TABLES.transactions,
    };
  }

  async function _applyTripExpense(tripId, payload) {
    await _ensureSession();
    const rpcName = TB_CONST?.RPCS?.trip_apply_expense_v2
      || TB_CONST?.RPCS?.trip_apply_expense_v1
      || "trip_apply_expense_v1";
    return _tripRepository().applyExpense({ rpcName, tripId, payload });
  }

  function _syncTripStateToAppState(reason) {
    try {
      if (!window.state) return;
      Object.assign(state, tripStore.appSnapshot());
      if (typeof window.tbSaveOfflineSnapshot === "function") window.tbSaveOfflineSnapshot(reason || "trip");
    } catch (_) {}
  }

  // Reset Trip state on auth account switch (prevents cross-account UI bleed)
  try {
    window.addEventListener("tb:auth_scope_changed", () => {
      _clearActiveTripId();
      tripStore.reset();
      _syncTripInviteNotification([]);
    });
  } catch (_) {}

  function _el(id) { return document.getElementById(id); }
  function _root() { return document.getElementById("trip-root"); }
  function _activeWallets() {
    return (state.wallets || []).filter(w => w?.archived !== true);
  }

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

  
  function _tripPivotCurrency() {
    return String(state?.user?.baseCurrency || state?.period?.baseCurrency || "EUR").toUpperCase();
  }

  function _tripConvertToPivot(amount, fromCur) {
    const pivot = _tripPivotCurrency();
    const from = String(fromCur || '').toUpperCase();
    const amt = Number(amount) || 0;
    if (!from || !Number.isFinite(amt)) return 0;
    if (from === pivot) return amt;
    return _safeFx(amt, from, pivot);
  }

  function _txByIdMap() {
    const map = new Map();
    for (const tx of (Array.isArray(state?.transactions) ? state.transactions : [])) {
      const id = String(tx?.id || '');
      if (id) map.set(id, tx);
    }
    for (const [id, tx] of (tripState?.budgetTxById instanceof Map ? tripState.budgetTxById.entries() : [])) {
      if (id && tx && !map.has(String(id))) map.set(String(id), tx);
    }
    return map;
  }

  function _tripAnalysisCategoryKey(expense, txMap) {
    const seen = new Set();
    function _pick(tx) {
      const cat = String(tx?.category || '').trim();
      if (!cat) return null;
      if (/^mouvement interne$/i.test(cat)) return null;
      return cat;
    }
    try {
      const mainTxId = String(expense?.transactionId || '');
      if (mainTxId) {
        seen.add(mainTxId);
        const picked = _pick(txMap.get(mainTxId));
        if (picked) return picked;
      }
      const links = Array.isArray(tripState?.budgetLinks)
        ? tripState.budgetLinks.filter((row) => String(row?.expenseId || '') === String(expense?.id || ''))
        : [];
      for (const link of links) {
        const txId = String(link?.transactionId || '');
        if (!txId || seen.has(txId)) continue;
        seen.add(txId);
        const picked = _pick(txMap.get(txId));
        if (picked) return picked;
      }
    } catch (_) {}
    const expenseCategory = String(expense?.category || '').trim();
    if (expenseCategory && !/^mouvement interne$/i.test(expenseCategory)) return expenseCategory;
    return 'Autre';
  }

  function _buildTripAnalysis(expenses, members, shares) {
    const pivot = _tripPivotCurrency();
    const txMap = _txByIdMap();
    const core = window.Core?.tripRules;
    if (core?.computeTripAnalysis) {
      return core.computeTripAnalysis({
        expenses,
        members,
        shares,
        pivot,
        convertAmount: (amount, currency) => _tripConvertToPivot(amount, currency),
        categoryForExpense: (expense) => _tripAnalysisCategoryKey(expense, txMap),
      });
    }

    const sharesByExpense = _groupBy(shares || [], s => s.expenseId);
    const categoryTotals = new Map();
    const participantTotals = new Map();
    for (const m of (members || [])) {
      participantTotals.set(m.id, { paid: 0, owed: 0, net: 0, expenseCount: 0, name: m.name, isMe: !!m.isMe });
    }

    for (const ex of (expenses || [])) {
      const exAmountPivot = _tripConvertToPivot(ex?.amount, ex?.currency);
      const category = _tripAnalysisCategoryKey(ex, txMap);
      categoryTotals.set(category, (categoryTotals.get(category) || 0) + exAmountPivot);

      const payerId = ex?.paidByMemberId;
      if (payerId && participantTotals.has(payerId)) {
        const row = participantTotals.get(payerId);
        row.paid += exAmountPivot;
        row.expenseCount += 1;
      }

      const sh = sharesByExpense.get(ex?.id) || [];
      for (const row of sh) {
        const memberId = row?.memberId;
        if (!memberId || !participantTotals.has(memberId)) continue;
        participantTotals.get(memberId).owed += _tripConvertToPivot(row?.shareAmount, ex?.currency);
      }
    }

    const categories = Array.from(categoryTotals.entries())
      .map(([name, amount]) => ({ name, amount: _round2(amount) }))
      .filter(x => x.amount > 0.004)
      .sort((a, b) => b.amount - a.amount);

    const participants = Array.from(participantTotals.entries())
      .map(([id, row]) => ({
        id,
        name: row.name,
        isMe: row.isMe,
        paid: _round2(row.paid),
        owed: _round2(row.owed),
        net: _round2(row.paid - row.owed),
        expenseCount: row.expenseCount || 0,
      }))
      .sort((a, b) => Math.abs(b.net) - Math.abs(a.net) || b.paid - a.paid || a.name.localeCompare(b.name));

    return { pivot, categories, participants };
  }


  function _tripHistoryFilterState() {
    const core = window.Core?.tripRules;
    if (core?.normalizeTripHistoryFilters) return core.normalizeTripHistoryFilters(tripState.historyFilters || {});
    return {
      category: String(tripState.historyFilters?.category || ''),
      payer: String(tripState.historyFilters?.payer || ''),
      participant: String(tripState.historyFilters?.participant || ''),
      dateFrom: String(tripState.historyFilters?.dateFrom || ''),
      dateTo: String(tripState.historyFilters?.dateTo || ''),
      amountMin: String(tripState.historyFilters?.amountMin || ''),
      amountMax: String(tripState.historyFilters?.amountMax || ''),
      q: String(tripState.historyFilters?.q || ''),
    };
  }

  function _tripHistoryMatch(ex, txMap, membersById, shareMap, filters) {
    const category = _tripAnalysisCategoryKey(ex, txMap);
    const rows = shareMap.get(ex?.id) || [];
    const core = window.Core?.tripRules;
    if (core?.matchesTripHistoryFilter) {
      return core.matchesTripHistoryFilter({
        expense: ex,
        category,
        membersById,
        sharesByExpense: rows,
        filters,
      });
    }

    const payerId = String(ex?.paidByMemberId || '');
    const q = String(filters?.q || '').trim().toLowerCase();
    if (filters?.category && category !== filters.category) return false;
    if (filters?.payer && payerId !== String(filters.payer)) return false;
    if (filters?.participant) {
  const wanted = String(filters.participant);

  const hasPositiveShare = rows.some((row) =>
    String(row?.memberId || '') === wanted &&
    Number(row?.shareAmount || 0) > 0.004
  );

  if (!hasPositiveShare && payerId !== wanted) return false;
}
    const date = String(ex?.date || '');
    if (filters?.dateFrom && date && date < filters.dateFrom) return false;
    if (filters?.dateTo && date && date > filters.dateTo) return false;
    const amt = Number(ex?.amount || 0);
    if (filters?.amountMin !== '' && Number.isFinite(Number(filters.amountMin)) && amt < Number(filters.amountMin)) return false;
    if (filters?.amountMax !== '' && Number.isFinite(Number(filters.amountMax)) && amt > Number(filters.amountMax)) return false;
    if (q) {
      const payerName = String(membersById.get(payerId)?.name || '').toLowerCase();
      const participantNames = (shareMap.get(ex?.id) || []).map((row) => String(membersById.get(row?.memberId)?.name || '').toLowerCase()).join(' ');
      const hay = [ex?.label || '', category, ex?.currency || '', payerName, participantNames, String(ex?.amount || '')].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }

  function _tripAnalysisBarsHTML(data) {
    return window.UI?.tripView?.renderTripAnalysisBars?.({
      data,
      pivotCurrency: _tripPivotCurrency(),
      language: (typeof window.tbGetLang === "function" && window.tbGetLang() === "en") ? "en" : "fr",
      formatMoney: _fmtMoney,
      escapeHTML,
    }) || "";
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
  const cur = args.p_currency || args.currency || null;

  // Build full payload with explicit NULLs for optional args.
  // This matches our current DB overloads and avoids PostgREST schema-cache mismatch.
  const payload = window.Core?.tripRules?.buildTripTransactionRpcPayload
    ? window.Core.tripRules.buildTripTransactionRpcPayload(args, { userId: uid, today: dateStart })
    : {
      p_wallet_id: args.p_wallet_id ?? null,
      p_type: args.p_type ?? null,
      p_label: args.p_label ?? null,
      p_amount: args.p_amount ?? null,
      p_currency: cur,
      p_date_start: dateStart,
      p_date_end: args.p_date_end || args.date_end || dateStart,
      p_budget_date_start: (args.p_budget_date_start === undefined) ? dateStart : args.p_budget_date_start,
      p_budget_date_end: (args.p_budget_date_end === undefined) ? (args.p_date_end || args.date_end || dateStart) : args.p_budget_date_end,
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
      p_offline_dedupe_key: (args.p_offline_dedupe_key === undefined) ? null : args.p_offline_dedupe_key,
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


function _normalizeCurrency(cur) {
    const fallback = (state?.period?.baseCurrency || "THB");
    const core = window.Core?.tripRules;
    if (core?.normalizeTripCurrency) return core.normalizeTripCurrency(cur, fallback);
    const c = String(cur || fallback || "").trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(c)) return String(fallback).trim().toUpperCase();
    return c;
  }

  function _tripCurrencyOptions(selectedCurrency) {
    const selected = _normalizeCurrency(selectedCurrency);
    const seen = new Set();
    const out = [];

    const pushCur = (value) => {
      const cur = _normalizeCurrency(value);
      if (!cur || seen.has(cur)) return;
      seen.add(cur);
      out.push(cur);
    };

    _activeWallets().forEach(w => pushCur(w?.currency));
    pushCur(tripState?.trips?.find(t => t.id === tripState.activeTripId)?.base_currency);
    pushCur(state?.period?.baseCurrency);
    pushCur(selected);

    return out;
  }

  function _tripCurrencyOptionsHTML(selectedCurrency) {
    const selected = _normalizeCurrency(selectedCurrency);
    return _tripCurrencyOptions(selected)
      .map(cur => `<option value="${escapeHTML(cur)}" ${cur === selected ? "selected" : ""}>${escapeHTML(cur)}</option>`)
      .join("");
  }

  function _tripResolveExpenseCurrency() {
    const paidSel = _el("trip-exp-paidby");
    const payer = (tripState.members || []).find(m => m.id === paidSel?.value) || null;
    const isMe = !!payer?.isMe;
    const walletSel = _el("trip-exp-wallet");
    const currencySel = _el("trip-exp-currency");
    if (!currencySel) return "";

    if (isMe && walletSel?.value) {
      const wallet = findWallet(walletSel.value);
      const walletCur = _normalizeCurrency(wallet?.currency);
      if (walletCur) return walletCur;
    }
    return _normalizeCurrency(currencySel.value);
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

  function _findTravelIdForDate(dateStr) {
    const d = parseISODateOrNull(dateStr);
    if (!d) return state?.activeTravelId || null;

    const travels = Array.isArray(state?.travels) ? state.travels : [];
    for (const t of travels) {
      const s = parseISODateOrNull(t.start);
      const e = parseISODateOrNull(t.end);
      if (s && e && d >= s && d <= e) return t.id;
    }
    return state?.activeTravelId || null;
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
  const core = window.Core?.tripRules;
  if (core?.computeTripSplitParts && split?.mode !== "amount_auto") return core.computeTripSplitParts(amt, members, split);

  const ids = members.map(m => m.id);
  const selectedIds = Array.isArray(split?.selectedMemberIds)
    ? split.selectedMemberIds.map(String).filter(Boolean)
    : ids.slice();

  const selectedSet = new Set(selectedIds);
  const activeIds = ids.filter(id => selectedSet.has(String(id)));
  const n = activeIds.length;
  const mode = (split?.mode || "equal");
  const totalCents = Math.round((Number(amt) || 0) * 100);

  if (!ids.length) return [];
  if (totalCents <= 0) return ids.map(() => 0);

  if (mode === "equal") {
    if (!n) throw new Error("Sélectionne au moins un participant pour la répartition.");
    const selectedParts = _splitEqual(Number(amt), activeIds);
    const byId = new Map(activeIds.map((id, i) => [String(id), selectedParts[i] || 0]));
    return ids.map(id => Number(byId.get(String(id)) || 0));
  }

  if (mode === "percent") {
    const pcts = split?.percents || {};
    const pctList = ids.map(id => {
      if (!selectedSet.has(String(id))) return 0;
      const v = Number(pcts[id]);
      return isFinite(v) ? v : (n ? 100 / n : 0);
    });

    let sumPct = pctList.reduce((a,b)=>a+b,0);
    if (!isFinite(sumPct) || sumPct <= 0) {
      throw new Error("Répartition en % invalide : renseigne des pourcentages (>0).");
    }

    if (Math.abs(sumPct - 100) > 0.01) {
      for (let i = 0; i < pctList.length; i++) {
        pctList[i] = (pctList[i] * 100) / sumPct;
      }
      sumPct = 100;
    }

    let cents = pctList.map(p => Math.floor(totalCents * (p / 100)));
    let used = cents.reduce((a,b)=>a+b,0);
    let delta = totalCents - used;

    const remainders = pctList
      .map((p,i)=>({ i, r: (totalCents * (p / 100)) - cents[i] }))
      .filter(x => pctList[x.i] > 0)
      .sort((a,b)=>b.r-a.r);

    let k = 0;
    while (delta > 0 && remainders.length && k < remainders.length * 2) {
      const i = remainders[k % remainders.length].i;
      cents[i] += 1;
      delta -= 1;
      k += 1;
    }

    return cents.map(c => c / 100);
  }

  if (mode === "amount_auto") {
    const amts = split?.amounts || {};
    const byId = new Map();
    activeIds.map(String).forEach(id => {
      const raw = amts[id];
      const v = (raw === "" || raw == null) ? NaN : Number(raw);
      if (isFinite(v) && v >= 0) byId.set(String(id), Math.round(v * 100));
    });
    const remainingIds = activeIds.map(String).filter(id => !byId.has(id));
    const sum = () => Array.from(byId.values()).reduce((a,b)=>a+b,0);
    const used = sum();
    const left = totalCents - used;
    if (left < -1) throw new Error("Montants > total.");
    if (remainingIds.length) {
      _splitEqual(Math.max(0, left) / 100, remainingIds).forEach((part, i) => byId.set(remainingIds[i], Math.round(part * 100)));
      const diff = totalCents - sum();
      if (diff) byId.set(remainingIds[remainingIds.length - 1], (byId.get(remainingIds[remainingIds.length - 1]) || 0) + diff);
    } else {
      if (Math.abs(left) > 1) throw new Error("Somme differente du total.");
      const lastId = Array.from(byId.keys()).pop() || String(activeIds[activeIds.length - 1] || "");
      if (left && lastId) byId.set(lastId, (byId.get(lastId) || 0) + left);
    }
    return ids.map(id => (byId.get(String(id)) || 0) / 100);
  }

  if (mode === "amount") {
    const amts = split?.amounts || {};
    let cents = ids.map(id => {
      if (!selectedSet.has(String(id))) return 0;
      const v = Number(amts[id]);
      return isFinite(v) ? Math.round(v * 100) : 0;
    });

    const sum = cents.reduce((a,b)=>a+b,0);
    const diff = totalCents - sum;

    if (Math.abs(diff) > 1) {
      throw new Error("Répartition en montants invalide : la somme doit égaler le total.");
    }

    if (diff !== 0) {
      const lastActiveIdx = ids.map(String).findLastIndex(id => selectedSet.has(id));
      if (lastActiveIdx >= 0) cents[lastActiveIdx] += diff;
    }

    return cents.map(c => c / 100);
  }

  return ids.map(() => 0);
}


  
  function _validateSplitParts(amt, parts) {
    const core = window.Core?.tripRules;
    if (core?.validateSplitTotal) {
      const result = core.validateSplitTotal({ total: Number(amt), shares: parts });
      if (!result.ok) throw new Error(result.reason || "Repartition invalide.");
      return true;
    }

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

  function _normalizeTripExpenseForMutation(input) {
    const core = window.Core?.tripRules;
    if (core?.normalizeTripExpenseInput) {
      return core.normalizeTripExpenseInput(input, { fallbackCurrency: state?.period?.baseCurrency || "EUR" });
    }

    const date = String(input?.date || "").trim();
    const label = String(input?.label || "").trim();
    const amount = Number(input?.amount);
    const paidByMemberId = String(input?.paidByMemberId || "").trim();
    if (!date) throw new Error("Date requise.");
    if (!label) throw new Error("Libellé requis.");
    if (!isFinite(amount) || amount <= 0) throw new Error("Montant dépense invalide.");
    if (!paidByMemberId) throw new Error("Sélectionne qui a payé.");
    return {
      expenseId: input?.expenseId || null,
      date,
      label,
      amount,
      currency: _normalizeCurrency(input?.currency),
      paidByMemberId,
      walletId: input?.walletId || "",
      category: String(input?.category || "Autre").trim() || "Autre",
      subcategory: String(input?.subcategory || "").trim() || null,
      budgetDateStart: input?.budgetDateStart || date,
      budgetDateEnd: input?.budgetDateEnd || input?.budgetDateStart || date,
      outOfBudget: input?.outOfBudget === true,
    };
  }

  function _validateTripExpenseForMutation({ input, members, parts, payer, wallet }) {
    const core = window.Core?.tripRules;
    if (core?.validateTripExpenseMutation) {
      const result = core.validateTripExpenseMutation({
        input,
        members,
        shares: parts,
        payer,
        wallet,
        userId: sbUser?.id || window.sbUser?.id || null,
        travelId: state?.activeTravelId || null,
      });
      if (!result.ok) throw new Error(result.reason || "Dépense Trip invalide.");
      return true;
    }

    if (!members?.length) throw new Error("Ajoute au moins un participant.");
    _validateSplitParts(input.amount, parts);
    if (payer?.isMe) {
      if (!input.walletId) throw new Error("Choisis une wallet (pour décompter le paiement).");
      if (!wallet) throw new Error("Wallet invalide.");
      if (String(wallet.currency || "").toUpperCase() !== input.currency) {
        throw new Error(`Devise wallet (${wallet.currency}) différente de la dépense (${input.currency}). Choisis une wallet dans la même devise.`);
      }
    }
    return true;
  }

  function _buildTripExpenseRpcPayload({ input, members, parts }) {
    const core = window.Core?.tripRules;
    if (core?.buildTripExpenseRpcPayload) {
      return core.buildTripExpenseRpcPayload({ input, members, shares: parts, walletTxEnabled: false });
    }

    return {
      expense_id: input.expenseId || null,
      date: input.date,
      label: input.label,
      amount: input.amount,
      currency: input.currency,
      paid_by_member_id: input.paidByMemberId,
      category: input.category || "Autre",
      subcategory: input.subcategory || null,
      budget_date_start: input.budgetDateStart || input.date,
      budget_date_end: input.budgetDateEnd || input.budgetDateStart || input.date,
      shares: members.map((m, i) => ({ member_id: m.id, share_amount: parts[i] ?? 0 })),
      wallet_tx: { enabled: false },
    };
  }

async function _findMatchingTransactions({ date, amount, currency }) {
  await _ensureSession();

  const cur = _normalizeCurrency(currency);
  const targetAmount = Number(amount) || 0;
  const activeTravelId = String(state?.activeTravelId || "");

  const { data, error } = await sb
    .from(TB_CONST.TABLES.transactions)
    .select("id,label,category,subcategory,wallet_id,trip_expense_id,date_start,date_end,amount,currency,pay_now,out_of_budget,travel_id,created_at")
    .eq("type", "expense")
    .eq("currency", cur)
    .is("trip_expense_id", null)
    .order("date_start", { ascending: false })
    .limit(80);

  if (error) throw error;

  let rows = data || [];

  if (activeTravelId) {
    rows = rows.filter(tx => !tx.travel_id || String(tx.travel_id) === activeTravelId);
  }

  return rows
    .map(tx => {
      const sameDate = String(tx.date_start || "") === String(date || "");
      const sameAmount = Math.abs(Number(tx.amount || 0) - targetAmount) < 0.005;
      const score =
        (sameDate ? 100 : 0) +
        (sameAmount ? 100 : 0) +
        (tx.pay_now ? 8 : 0);

      return { ...tx, _tripMatchScore: score };
    })
    .sort((a, b) =>
      Number(b._tripMatchScore || 0) - Number(a._tripMatchScore || 0)
      || String(b.date_start || "").localeCompare(String(a.date_start || ""))
    );
}

  function _tripTxWalletName(walletId) {
    const wallet = (state?.wallets || []).find(w => String(w.id || '') === String(walletId || ''));
    return wallet ? `${wallet.name || 'Wallet'} (${String(wallet.currency || '').toUpperCase()})` : 'Wallet';
  }

  function _tripTxMatchSubtitle(tx) {
    const status = tx?.pay_now ? _tripT('trip.match.pay_now') : _tripT('trip.match.to_pay');
    const budget = tx?.out_of_budget ? _tripT('trip.match.out_budget') : _tripT('trip.match.in_budget');
    return `${status} · ${budget}`;
  }

  function _chooseMatchingTransaction(matches, context = {}) {
  return new Promise((resolve) => {
    const rows = Array.isArray(matches) ? matches.filter(Boolean) : [];
    if (!rows.length) return resolve(null);

    let query = "";
    let exactOnly = true;
    let settled = false;

    const targetDate = String(context.date || "");
    const targetAmount = Number(context.amount || 0);
    const targetCurrency = _normalizeCurrency(context.currency || "");

    function txSearchText(tx) {
      return [
        tx.label || "",
        tx.category || "",
        tx.subcategory || "",
        tx.currency || "",
        tx.date_start || "",
        tx.amount || "",
        _tripTxWalletName(tx.wallet_id || tx.walletId)
      ].join(" ").toLowerCase();
    }

    function filteredRows() {
      const q = query.trim().toLowerCase();

      return rows.filter(tx => {
        const sameDate = String(tx.date_start || "") === targetDate;
        const sameAmount = Math.abs(Number(tx.amount || 0) - targetAmount) < 0.005;

        if (exactOnly && !(sameDate && sameAmount)) return false;
        if (q && !txSearchText(tx).includes(q)) return false;

        return true;
      }).slice(0, 40);
    }

    if (!window.UI?.createModal) throw new Error("Composant de fenetre indisponible.");
    const modalHandle = window.UI.createModal({
      id: "trip-match-modal",
      size: "xl",
      panelClass: "tb-trip-shared-modal tb-trip-match-modal",
      title: "Transaction existante détectée",
      subtitle: "Une transaction Budget ressemble à cette dépense Trip. Lie-la pour éviter un doublon.",
      contentHTML: '<div class="tb-trip-match-content"></div>',
      initialFocus: "#trip-match-search",
      closeLabel: "Fermer",
      onClose(){
        if (settled) return;
        settled = true;
        resolve(null);
      }
    });
    const modal = modalHandle.body.querySelector(".tb-trip-match-content");

    function render() {
      const list = filteredRows();

      modal.innerHTML = window.UI?.tripView?.renderTripTransactionMatchContent?.({
        rows: list,
        query,
        exactOnly,
        targetDate,
        targetAmount,
        targetCurrency,
        walletName: _tripTxWalletName,
        matchSubtitle: _tripTxMatchSubtitle,
        formatMoney: _fmtMoney,
        escapeHTML,
      }) || "";

      const search = modal.querySelector("#trip-match-search");
      if (search) {
        search.oninput = () => {
          query = search.value || "";
          render();
          setTimeout(() => {
            const el = modal.querySelector("#trip-match-search");
            if (el) {
              el.focus();
              try { el.setSelectionRange(el.value.length, el.value.length); } catch (_) {}
            }
          }, 0);
        };
      }

      const exact = modal.querySelector("#trip-match-exact");
      if (exact) {
        exact.onchange = () => {
          exactOnly = !!exact.checked;
          render();
        };
      }

      modal.querySelectorAll("[data-trip-match-new]").forEach(btn => {
        btn.addEventListener("click", () => close(null));
      });

      const linkBtn = modal.querySelector("[data-trip-match-link]");
      if (linkBtn) {
        linkBtn.addEventListener("click", () => {
          const selectedId = modal.querySelector('input[name="trip-match-tx"]:checked')?.value || "";
          close(rows.find(tx => String(tx.id) === String(selectedId)) || null);
        });
      }
    }

    const close = (value) => {
      if (settled) return;
      settled = true;
      modalHandle.destroy();
      resolve(value);
    };
    render();
  });
}

  async function _linkExpenseToTransaction(expenseId, transactionId) {
    await _ensureSession();
    return _tripRepository().linkExpenseTransaction({
      tables: _tripRepositoryTables(), expenseId, transactionId,
    });
  }

  async function _unlinkExpenseFromTransaction(expense) {
    await _ensureSession();
    if (!expense?.transactionId) return;
    await _tripRepository().unlinkExpenseTransaction({
      tables: _tripRepositoryTables(), expenseId: expense.id, transactionId: expense.transactionId,
    });
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

async function _findTripBudgetTransaction({ walletId, amount, currency, category, label, date, payNow, outOfBudget, requireUnlinkedExpense = true }) {
  let query = sb
    .from(TB_CONST.TABLES.transactions)
    .select("id,travel_id,period_id")
    .eq("wallet_id", walletId)
    .eq("type", "expense")
    .eq("amount", amount)
    .eq("currency", currency)
    .eq("category", category)
    .eq("label", label)
    .eq("date_start", date)
    .eq("date_end", date)
    .eq("pay_now", !!payNow)
    .order("created_at", { ascending: false })
    .limit(1);

  if (outOfBudget !== undefined) query = query.eq("out_of_budget", !!outOfBudget);
  if (requireUnlinkedExpense) query = query.is("trip_expense_id", null);

  const { data, error } = await query;
  if (error) throw error;
  return data?.[0] || null;
}

async function _alignTripTransactionTravelPeriod(tx, date, targetPeriodId) {
  if (!tx?.id) return null;
  const targetTravelId = _findTravelIdForDate(date);
  if (
    (targetTravelId && (!tx.travel_id || tx.travel_id !== targetTravelId)) ||
    (targetPeriodId && (!tx.period_id || tx.period_id !== targetPeriodId))
  ) {
    await sb
      .from(TB_CONST.TABLES.transactions)
      .update({
        travel_id: targetTravelId || tx.travel_id || null,
        period_id: targetPeriodId || tx.period_id || null
      })
      .eq("id", tx.id);
  }
  return tx;
}

async function _linkCreatedExpenseTransaction({ tx, expenseId, date, targetPeriodId, missingMessage }) {
  if (!tx) {
    if (missingMessage) console.warn(missingMessage);
    return false;
  }
  await _alignTripTransactionTravelPeriod(tx, date, targetPeriodId);
  await _linkExpenseToTransaction(expenseId, tx.id);
  return true;
}

async function _linkCreatedShareTransaction({ tx, expenseId, memberId, date, targetPeriodId }) {
  if (!tx) return false;
  await sb.from(TB_CONST.TABLES.transactions).update({ is_internal: true }).eq("id", tx.id);
  await _alignTripTransactionTravelPeriod(tx, date, targetPeriodId);
  await _linkShareToTransaction({ expenseId, memberId, transactionId: tx.id });
  return true;
}


  async function _ensureSession() {
    // sb and sbUser are globals in your app
    if (typeof sb === "undefined") throw new Error("Supabase client (sb) introuvable.");
    const uid = sbUser?.id || sbUser?.user?.id || window.sbUser?.id || window.sbUser?.user?.id;
    if (uid) return uid;
    if (await _tripShouldUseOfflineMode("trip:ensureSession")) {
      throw new Error("Mode hors ligne");
    }

    // try fetch from auth
    const { data, error } = await sb.auth.getUser();
    if (error) throw error;
    if (!data?.user?.id) throw new Error("Session non prête. Connecte-toi puis recharge.");
    sbUser = data.user;
    window.sbUser = data.user;
    return data.user.id;
  }

  async function _loadTrips() {
    if (await _tripShouldUseOfflineMode("trip:loadTrips")) {
      tripState.trips = Array.isArray(state?.tripGroups) ? state.tripGroups : [];
      tripState.globalNetRows = Array.isArray(state?.tripNetBalances) ? state.tripNetBalances : [];
      _resolveActiveTripId();
      tripState._tripsLoaded = true;
      return;
    }
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



    _resolveActiveTripId();

    tripState._tripsLoaded = true;
    _syncTripStateToAppState("trip:list");
  }

  async function _auditTripTransactionLinks() {
    const issues = [];
    const expenses = Array.isArray(tripState.expenses) ? tripState.expenses : [];
    const expenseIds = expenses.map((x) => String(x?.id || "")).filter(Boolean);
    if (!expenseIds.length) return issues;

    const expenseById = new Map(expenses.map((ex) => [String(ex.id || ""), ex]));
    const mainTxIds = Array.from(new Set(expenses.map((ex) => String(ex?.transactionId || "")).filter(Boolean)));
    const mainTxById = new Map();

    if (mainTxIds.length) {
      const { data, error } = await sb
        .from(TB_CONST.TABLES.transactions)
        .select("id,trip_expense_id,label,amount,currency")
        .in("id", mainTxIds);
      if (error) throw error;
      (data || []).forEach((tx) => mainTxById.set(String(tx.id || ""), tx));

      for (const ex of expenses) {
        const txId = String(ex?.transactionId || "");
        if (!txId) continue;
        const tx = mainTxById.get(txId);
        if (!tx) {
          issues.push({ type: "missing_transaction", expenseId: ex.id, transactionId: txId, label: ex.label || "" });
        } else if (String(tx.trip_expense_id || "") !== String(ex.id || "")) {
          issues.push({ type: "missing_reverse_link", expenseId: ex.id, transactionId: txId, label: ex.label || "" });
        }
      }
    }

    const { data: reverseRows, error: reverseErr } = await sb
      .from(TB_CONST.TABLES.transactions)
      .select("id,trip_expense_id,label,amount,currency")
      .in("trip_expense_id", expenseIds);
    if (reverseErr) throw reverseErr;
    for (const tx of (reverseRows || [])) {
      const expenseId = String(tx.trip_expense_id || "");
      const ex = expenseById.get(expenseId);
      if (ex && String(ex.transactionId || "") !== String(tx.id || "")) {
        issues.push({ type: "missing_expense_link", expenseId, transactionId: tx.id, label: ex.label || tx.label || "" });
      }
    }

    const budgetTxIds = Array.from(new Set((tripState.budgetLinks || []).map((row) => String(row?.transactionId || "")).filter(Boolean)));
    for (const txId of budgetTxIds) {
      if (!tripState.budgetTxById?.has(String(txId))) {
        const link = (tripState.budgetLinks || []).find((row) => String(row?.transactionId || "") === String(txId));
        issues.push({ type: "missing_share_transaction", expenseId: link?.expenseId || null, transactionId: txId, label: "" });
      }
    }

    return issues;
  }

  async function _loadActiveData() {
    if (await _tripShouldUseOfflineMode("trip:loadActiveData")) {
      tripStore.hydrateOffline(state);
      return;
    }
    const uid = await _ensureSession();
    const tripId = tripState.activeTripId;

    tripStore.clearActive();
    if (!tripId) return;

    tripState.myRole = await _getMyTripRole(tripId);

    // Ensure my member row exists/bound for this trip (identity = auth.uid)
    await _rpcBindMe(tripId);

    const activeData = await _tripRepository().loadActiveTripData({
      tripId,
      tables: _tripRepositoryTables(),
    });
    if (activeData.budgetLoadError) console.warn('[Trip] budget link preload failed', activeData.budgetLoadError);
    tripStore.hydrateRemote(activeData, {
      userId: uid,
      email: sbUser?.email || window.sbUser?.email || "",
    });

    try {
      tripState.linkIssues = await _auditTripTransactionLinks();
    } catch (e) {
      console.warn("[Trip] link consistency audit failed", e);
      tripState.linkIssues = [];
    }
    _syncTripStateToAppState("trip:active");
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
      if (!tripId) {
        console.warn("[Trip] trip_get_balances_v1 skipped: missing active trip id");
        return null;
      }
if (!sb?.rpc) return null;
      if (!TB_CONST?.RPCS?.trip_get_balances_v1) return null;

      console.log("[Trip] RPC trip_get_balances_v1:start", { tripId });

const { data, error } = await sb.rpc(TB_CONST.RPCS.trip_get_balances_v1, { p_trip_id: tripId });

console.log("[Trip] RPC trip_get_balances_v1:done", {
  tripId,
  rows: Array.isArray(data) ? data.length : null,
  hasError: !!error
});

if (error) {
  console.warn("[Trip] RPC trip_get_balances_v1 failed", {
    tripId,
    message: error.message || null,
    details: error.details || null,
    hint: error.hint || null,
    code: error.code || null,
  });
  return null;
}

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
    if (!tripId) {
      console.warn("[Trip] trip_suggest_settlements_v1 skipped: missing active trip id");
      return null;
    }
    if (!sb?.rpc) return null;
    if (!TB_CONST?.RPCS?.trip_suggest_settlements_v1) return null;

    console.log("[Trip] RPC trip_suggest_settlements_v1:start", { tripId, useNetRaw: !!useNetRaw });

    const { data, error } = await sb.rpc(TB_CONST.RPCS.trip_suggest_settlements_v1, {
      p_trip_id: tripId,
      p_use_net_raw: !!useNetRaw,
    });
    
    console.log("[Trip] RPC trip_suggest_settlements_v1:done", {
      tripId,
      rows: Array.isArray(data) ? data.length : null,
      hasError: !!error
    });

    if (error) {
      console.warn("[Trip] RPC trip_suggest_settlements_v1 failed", {
        tripId,
        useNetRaw: !!useNetRaw,
        message: error.message || null,
        details: error.details || null,
        hint: error.hint || null,
        code: error.code || null,
      });
      return null;
    }

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

  function _serializeBalancesForSnapshot(balancesByCur) {
    const out = [];
    for (const [currency, rows] of (balancesByCur || new Map()).entries()) {
      for (const [memberId, amount] of (rows || new Map()).entries()) {
        out.push({ currency, memberId, amount: _round2(amount) });
      }
    }
    return out;
  }

  function _balancesFromSnapshot(snapshot) {
    const out = new Map();
    const rows = Array.isArray(snapshot?.balances) ? snapshot.balances : [];
    for (const row of rows) {
      const cur = String(row?.currency || "").toUpperCase();
      const memberId = row?.memberId || row?.member_id;
      if (!cur || !memberId) continue;
      if (!out.has(cur)) out.set(cur, new Map());
      out.get(cur).set(memberId, Number(row?.amount || 0));
    }
    return out;
  }

  function _settlementsFromSnapshot(snapshot) {
    const out = new Map();
    const rows = Array.isArray(snapshot?.settlements) ? snapshot.settlements : [];
    for (const row of rows) {
      const cur = String(row?.currency || row?.out_currency || "").toUpperCase();
      if (!cur) continue;
      if (!out.has(cur)) out.set(cur, []);
      out.get(cur).push({
        fromId: row?.fromId || row?.from_member_id,
        toId: row?.toId || row?.to_member_id,
        amount: Number(row?.amount || 0),
      });
    }
    return out;
  }

  function _serializeSettlementsForSnapshot(settlementsByCur) {
    const out = [];
    for (const [currency, rows] of (settlementsByCur || new Map()).entries()) {
      for (const row of (rows || [])) {
        out.push({ currency, fromId: row.fromId, toId: row.toId, amount: _round2(row.amount) });
      }
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

function _tripParseLocaleAmount(raw) {
  let s = String(raw ?? "").trim();
  if (!s) return NaN;

  s = s.replace(/[\s\u00A0\u202F]/g, "");

  const hasComma = s.includes(",");
  const hasDot = s.includes(".");

  if (hasComma && hasDot) {
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      s = s.replace(/\./g, "").replace(/,/g, ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (hasComma) {
    s = s.replace(",", ".");
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}  
let _settleModalState = null;

function _ensureSettleModal() {
  if (!window.UI?.createModal) throw new Error("Composant de fenetre indisponible.");
  const handle = window.UI.createModal({
    id: "tripSettleModal",
    size: "md",
    panelClass: "tb-trip-shared-modal tb-trip-settle-modal",
    title: "Règlement",
    contentHTML: window.UI?.tripView?.renderTripSettlementModalContent?.({ escapeHTML }) || "",
    actionsHTML: window.UI?.tripView?.renderTripSettlementModalActions?.({ escapeHTML }) || "",
    initialFocus: "#tripSettleWallet",
    closeLabel: "Fermer",
    onClose(){ _settleModalState = null; }
  });
  const modal = handle.root;
  modal._tbModalHandle = handle;
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
  const wallets = _activeWallets();
  for (const w of wallets) {
    const opt = document.createElement("option");
    opt.value = w.id;
    opt.textContent = `${w.name || "Wallet"} • ${String(w.currency||"").toUpperCase()}`;
    sel.appendChild(opt);
  }
  const defaultWalletId = state.activeWalletId || (wallets[0]?.id || "");
  if (defaultWalletId) sel.value = defaultWalletId;

  const inputAmt = modal.querySelector("#tripSettleAmount");
  const inputCur = modal.querySelector("#tripSettleCurrency");
  let currencyDirty = false;
  const refreshCurrencyOptions = () => {
    const selected = String(inputCur.value || wallets.find(x => x.id === sel.value)?.currency || currency || '').toUpperCase();
    inputCur.innerHTML = _tripCurrencyOptionsHTML(selected);
    inputCur.value = selected;
  };
  refreshCurrencyOptions();
  inputAmt.value = String(_round2(amount));
  inputCur.onchange = () => { currencyDirty = true; refreshNote(); };

  const refreshNote = () => {
    const wid = sel.value;
    const w = wallets.find(x => x.id === wid);
    const wCur = String(w?.currency || "").toUpperCase();
    if (!currencyDirty) {
      refreshCurrencyOptions();
      inputCur.value = wCur || String(currency || '').toUpperCase();
    }
    const txCur = String(inputCur.value || '').toUpperCase();
    const note = modal.querySelector("#tripSettleWalletNote");
    if (!wCur || !txCur) {
      note.textContent = "";
      return;
    }
    if (wCur !== txCur) {
      note.textContent = `⚠ Wallet en ${wCur}. La transaction sera créée en ${txCur} : vérifie que ce comportement est voulu.`;
    } else if (txCur !== String(currency||"").toUpperCase()) {
      note.textContent = `ℹ Règlement Trip en ${String(currency||"").toUpperCase()} mais transaction wallet saisie en ${txCur}.`;
    } else {
      note.textContent = "";
    }
  };
  sel.onchange = refreshNote;
  refreshNote();

  modal.querySelector("#tripSettleOnly").onclick = async () => {
    try {
      await _persistSettlementEventOnly();
      modal._tbModalHandle?.close();
      _settleModalState = null;
      toastOk("Règlement enregistré (sans wallet).");
    } catch (e) {
      toastWarn("[Trip] " + normalizeSbError(e));
    }
  };

  modal.querySelector("#tripSettleConfirm").onclick = async () => {
    try {
      const wid = sel.value;
      const wallets2 = _activeWallets();
      const w = wallets2.find(x => x.id === wid);
      if (!w) throw new Error("Wallet introuvable.");
      const walletCur = String(w.currency || "").toUpperCase();
      const txCur = String((inputCur.value || walletCur)).toUpperCase().slice(0,3);
      const amtW = _round2(_tripParseLocaleAmount(inputAmt.value));
      if (!(amtW > 0)) throw new Error("Montant invalide.");
      if (!txCur) throw new Error("Devise invalide.");
      await _persistSettlementWithWallet({ walletId: wid, walletCurrency: txCur, walletAmount: amtW, walletNativeCurrency: walletCur });
      modal._tbModalHandle?.close();
      _settleModalState = null;
      toastOk("Règlement enregistré.");
    } catch (e) {
      toastWarn("[Trip] " + normalizeSbError(e));
    }
  };

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
        .select("id,wallet_id,type,amount,currency,category,subcategory,label,date_start,date_end,budget_date_start,budget_date_end,pay_now,out_of_budget,affects_budget,is_internal,created_at")
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
            subcategory: row.subcategory || null,
            label: row.label || null,
            dateStart: row.date_start || null,
            dateEnd: row.date_end || null,
            budgetDateStart: row.budget_date_start || row.date_start || null,
            budgetDateEnd: row.budget_date_end || row.budget_date_start || row.date_end || row.date_start || null,
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

/* =========================
   Trip expense <-> documents links
   V1 safe: no financial mutation, link/unlink only.
   Requires SQL table public.trip_expense_documents.
   ========================= */

function _tripExpenseDocumentsTable() {
  return (TB_CONST?.TABLES?.trip_expense_documents) || "trip_expense_documents";
}

function _tripDocumentsTable() {
  return (TB_CONST?.TABLES?.documents) || "documents";
}

function _tripDocumentBucket(doc) {
  return doc?.storage_bucket || "personal-documents";
}

function _tripDocumentName(doc) {
  return doc?.name || doc?.original_filename || "Document";
}

function _tripDocumentRelationLabel(value) {
  const v = String(value || "receipt");
  const labels = {
    invoice: "Facture",
    receipt: "Reçu",
    warranty: "Garantie",
    proof: "Justificatif",
    other: "Autre",
  };
  return labels[v] || labels.other;
}

function _tripDocumentSearchText(doc) {
  return [
    doc?.name || "",
    doc?.original_filename || "",
    doc?.mime_type || "",
    Array.isArray(doc?.tags) ? doc.tags.join(" ") : "",
  ].join(" ").toLowerCase();
}

async function _ensureTripInvoiceFolderId() {
  const uid = await _ensureSession();

  const { data: existing, error: existingErr } = await sb
    .from(_tripDocumentsTable().replace("documents", "document_folders"))
    .select("id")
    .eq("user_id", uid)
    .ilike("name", "Factures")
    .is("parent_id", null)
    .limit(1)
    .maybeSingle();

  if (existingErr) throw existingErr;
  if (existing?.id) return existing.id;

  const { data: created, error: createErr } = await sb
    .from(TB_CONST.TABLES.document_folders)
    .insert({
      user_id: uid,
      name: "Factures",
      parent_id: null
    })
    .select("id")
    .single();

  if (createErr) throw createErr;
  return created.id;
}

function _tripCleanFilename(name){
  return String(name || "document")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120) || "document";
}

function _tripDocumentTagsForRelation(relationType){
  const rel = String(relationType || "receipt");

  const map = {
    receipt: ["Trip", "Reçu"],
    invoice: ["Trip", "Facture"],
    proof: ["Trip", "Justificatif"],
    warranty: ["Trip", "Garantie"],
    other: ["Trip"],
  };

  return map[rel] || map.other;
}

async function _uploadTripExpenseDocumentFile(expenseId, file, relationType = "receipt"){
  const uid = await _ensureSession();
  const ex = (tripState.expenses || []).find(e => String(e.id) === String(expenseId));
  if(!ex) throw new Error("Dépense introuvable.");

  const docId = crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const safe = _tripCleanFilename(file.name || "document");
  const bucket = "personal-documents";
  const path = `${uid}/${docId}/${safe}`;
  const baseName = String(file.name || "Document").replace(/\.[a-z0-9]{1,8}$/i, "");

  const up = await sb.storage.from(bucket).upload(path, file, {
    upsert: false,
    contentType: file.type || undefined
  });
  if(up.error) throw up.error;

  const ins = await sb.from(_tripDocumentsTable()).insert({
    id: docId,
    user_id: uid,
    folder_id: await _ensureTripInvoiceFolderId(),
    name: baseName || "Document",
    original_filename: file.name || safe,
    storage_bucket: bucket,
    storage_path: path,
    mime_type: file.type || "",
    size_bytes: file.size || 0,
    tags: _tripDocumentTagsForRelation(relationType)
  });

  if(ins.error){
    await sb.storage.from(bucket).remove([path]);
    throw ins.error;
  }

  await _linkTripExpenseDocument({
    expenseId,
    tripId: tripState.activeTripId,
    documentId: docId,
    relationType
  });

  return docId;
}

async function _fetchTripExpenseDocumentLinks(expenseId) {
  if (!expenseId) return [];

  const { data: links, error } = await sb
    .from(_tripExpenseDocumentsTable())
    .select("*")
    .eq("expense_id", expenseId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const rows = links || [];
  const docIds = Array.from(new Set(rows.map(row => row.document_id).filter(Boolean)));

  if (!docIds.length) {
    return rows.map(row => ({ ...row, document: null }));
  }

  const { data: docs, error: docsErr } = await sb
    .from(_tripDocumentsTable())
    .select("id,name,original_filename,storage_bucket,storage_path,mime_type,size_bytes,created_at,tags")
    .in("id", docIds);

  if (docsErr) throw docsErr;

  const docsById = new Map((docs || []).map(doc => [String(doc.id), doc]));

  return rows.map(row => ({
    ...row,
    document: docsById.get(String(row.document_id)) || null,
  }));
}

async function _searchTripDocuments(query = "") {
  let req = sb
    .from(_tripDocumentsTable())
    .select("id,name,original_filename,storage_bucket,storage_path,mime_type,size_bytes,created_at,tags")
    .order("created_at", { ascending: false })
    .limit(50);

  const trimmed = String(query || "").trim().toLowerCase();

  const { data, error } = await req;

  if (error) throw error;

  if (!trimmed) return data || [];

  return (data || []).filter(doc =>
    _tripDocumentSearchText(doc).includes(trimmed)
  );
}

async function _unlinkTripExpenseDocument(linkId) {
  const { error } = await sb
    .from(_tripExpenseDocumentsTable())
    .delete()
    .eq("id", linkId);

  if (error) throw error;
}

async function _linkTripExpenseDocument({
  expenseId,
  tripId,
  documentId,
  relationType = "receipt",
}) {
  const payload = {
    user_id: await _ensureSession(),
    expense_id: expenseId,
    trip_id: tripId,
    document_id: documentId,
    relation_type: relationType,
  };

  const { error } = await sb
    .from(_tripExpenseDocumentsTable())
    .insert(payload);

  if (error) throw error;
}

async function _openTripDocument(doc) {
  if (!doc?.storage_path) {
    toastWarn("Document introuvable.");
    return;
  }

  const bucket = _tripDocumentBucket(doc);

  const { data, error } = await sb.storage
    .from(bucket)
    .createSignedUrl(doc.storage_path, 3600);

  if (error) throw error;

  if (data?.signedUrl) {
    window.open(data.signedUrl, "_blank", "noopener");
  }
}

async function _openTripExpenseDocumentsModal(expenseId) {
  const ex = (tripState.expenses || []).find(e => String(e.id) === String(expenseId));

  if (!ex) {
    toastWarn("Dépense introuvable.");
    return;
  }

  let links = [];
  let docs = [];

  try {
    links = await _fetchTripExpenseDocumentLinks(expenseId);
    docs = await _searchTripDocuments("");
  } catch (e) {
    toastWarn(e?.message || String(e));
    return;
  }

  const linkedIds = new Set(
    links.map(x => String(x.document_id))
  );

  const availableDocs = docs.filter(
    doc => !linkedIds.has(String(doc.id))
  );

  const html = window.UI?.tripDocumentView?.renderTripExpenseDocumentsContent?.({
    links,
    availableDocs,
    documentName: _tripDocumentName,
    relationLabel: _tripDocumentRelationLabel,
    escapeHTML
  }) || `<div class="tb-trip-documents-content"><div class="muted">Documents indisponibles.</div></div>`;
  if (!window.UI?.createModal) throw new Error("Composant de fenetre indisponible.");
  const modal = window.UI.createModal({
    id: "trip-expense-docs-modal",
    size: "xl",
    panelClass: "tb-trip-shared-modal tb-trip-documents-modal",
    title: `Documents · ${ex.label || "Dépense"}`,
    subtitle: "Lier ou délier des justificatifs à cette dépense Trip.",
    contentHTML: html,
    actionsHTML: '<button class="btn" type="button" data-trip-doc-close>Fermer</button>',
    initialFocus: "#trip-doc-search",
    closeLabel: "Fermer"
  });
  const root = modal.root;
  root.querySelector("[data-trip-doc-close]")?.addEventListener("click", modal.close);

const docSelect = root.querySelector("#trip-doc-select");
const docSearch = root.querySelector("#trip-doc-search");

if(docSearch && docSelect){
  docSearch.oninput = () => {
    const q = String(docSearch.value || "").toLowerCase().trim();
    const filtered = availableDocs.filter(doc => _tripDocumentSearchText(doc).includes(q));

    docSelect.innerHTML = filtered.map(doc => `
      <option value="${escapeHTML(doc.id)}">
        ${escapeHTML(_tripDocumentName(doc))}
      </option>
    `).join("");
  };
}

root.querySelector("[data-trip-doc-link-selected]")?.addEventListener("click", async () => {
  try{
    const documentId = root.querySelector("#trip-doc-select")?.value || "";
    const relationType = root.querySelector("#trip-doc-relation")?.value || "receipt";

    if(!documentId) return toastWarn("Choisis un document.");

    await _linkTripExpenseDocument({
      expenseId,
      tripId: tripState.activeTripId,
      documentId,
      relationType
    });

    toastOk("Document lié.");
    modal.close();
    await _openTripExpenseDocumentsModal(expenseId);
  }catch(e){
    toastWarn(e?.message || String(e));
  }
});

root.querySelector("[data-trip-doc-upload-btn]")?.addEventListener("click", () => {
  root.querySelector("#trip-doc-upload-input")?.click();
});

root.querySelector("#trip-doc-upload-input")?.addEventListener("change", async (ev) => {
  try{
    const file = ev.target.files?.[0];
    if(!file) return;

    const relationType = root.querySelector("#trip-doc-upload-relation")?.value || "receipt";

await _uploadTripExpenseDocumentFile(expenseId, file, relationType);

    toastOk("Document ajouté et lié.");
    modal.close();
    await _openTripExpenseDocumentsModal(expenseId);
  }catch(e){
    toastWarn(e?.message || String(e));
  }
});

  root.querySelectorAll("[data-open-trip-doc]").forEach(btn => {
    btn.onclick = async () => {
      try {
        const id = btn.getAttribute("data-open-trip-doc");
        const link = links.find(x => String(x.document_id) === String(id));
        if (!link?.document) return;

        await _openTripDocument(link.document);
      } catch (e) {
        toastWarn(e?.message || String(e));
      }
    };
  });

  root.querySelectorAll("[data-unlink-trip-doc]").forEach(btn => {
    btn.onclick = async () => {
      try {
        const linkId = btn.getAttribute("data-unlink-trip-doc");

        await _unlinkTripExpenseDocument(linkId);

        toastOk("Document délié.");

        modal?.close?.();

        await _openTripExpenseDocumentsModal(expenseId);
      } catch (e) {
        toastWarn(e?.message || String(e));
      }
    };
  });

  root.querySelectorAll("[data-link-trip-doc]").forEach(btn => {
    btn.onclick = async () => {
      try {
        const docId = btn.getAttribute("data-link-trip-doc");

        const select = root.querySelector(
          `[data-trip-doc-rel="${docId}"]`
        );

        const relationType = select?.value || "receipt";

        await _linkTripExpenseDocument({
          expenseId,
          tripId: tripState.activeTripId,
          documentId: docId,
          relationType,
        });

        toastOk("Document lié.");

        modal?.close?.();

        await _openTripExpenseDocumentsModal(expenseId);
      } catch (e) {
        toastWarn(e?.message || String(e));
      }
    };
  });
}

function _walletNameById(walletId) {
  return (state.wallets || []).find(w => w.id === walletId)?.name || null;
}

function _tripExpenseSubcategoryOptionsHtml(categoryName, selectedValue) {
  const category = String(categoryName || '').trim();
  if (!category) return '<option value="">Aucune</option>';
  const rows = (typeof getCategorySubcategories === 'function') ? getCategorySubcategories(category) : [];
  const selected = String(selectedValue || '').trim();
  const options = ['<option value="">Aucune</option>'];
  for (const row of rows) {
    const name = String(row?.name || '').trim();
    if (!name) continue;
    const sel = name === selected ? ' selected' : '';
    options.push(`<option value="${escapeHTML(name)}"${sel}>${escapeHTML(name)}</option>`);
  }
  if (selected && !rows.some((row) => String(row?.name || '').trim().toLowerCase() === selected.toLowerCase())) {
    options.push(`<option value="${escapeHTML(selected)}" selected>${escapeHTML(selected)}</option>`);
  }
  return options.join('');
}

function _tripBindExpenseSubcategoryUi(initialValue) {
  const categoryEl = _el('trip-exp-category');
  const subcategoryEl = _el('trip-exp-subcategory');
  if (!categoryEl || !subcategoryEl) return;
  const render = (selectedValue) => {
    subcategoryEl.innerHTML = _tripExpenseSubcategoryOptionsHtml(categoryEl.value, selectedValue);
    subcategoryEl.disabled = !String(categoryEl.value || '').trim();
    subcategoryEl.value = selectedValue || '';
  };
  render(initialValue || '');
  categoryEl.onchange = () => render('');
}

function _yesNoPill(v) {
  return v
    ? '<span class="pill" style="font-size:12px;">Oui</span>'
    : '<span class="pill" style="font-size:12px; background:rgba(0,0,0,0.06); color:#333;">Non</span>';
}

function _ensureExpenseDetailModal() {
  if (!window.UI?.createModal) throw new Error("Composant de fenetre indisponible.");
  const handle = window.UI.createModal({
    id: "tripExpenseDetailModal",
    size: "lg",
    panelClass: "tb-trip-shared-modal tb-trip-detail-modal",
    title: "Détail dépense",
    contentHTML: '<div class="muted" id="tripExpDetailMeta"></div><div id="tripExpDetailBody" class="tb-trip-detail-body"></div>',
    actionsHTML: '<button id="tripExpDetailOk" class="btn" type="button">Fermer</button>',
    closeLabel: "Fermer",
    onClose(){ _expDetailModalState = null; }
  });
  const modal = handle.root;
  modal.querySelector("#tripExpDetailOk").onclick = () => handle.close();
  return modal;
}

async function _openExpenseDetailModal({ ex, shares, members }) {
  const modal = _ensureExpenseDetailModal();
  _expDetailModalState = { expenseId: ex?.id || null };

  const payer = members.find(m => m.id === ex.paidByMemberId) || null;
  const payerName = payer ? payer.name : "—";

  modal.querySelector("#tripExpDetailMeta").textContent = `${ex.date || "—"} • payé par ${payerName}`.trim();
  modal.querySelector("#tripExpDetailBody").innerHTML = `<div class="muted">Chargement du détail…</div>`;

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
  const localLinkIssues = (tripState.linkIssues || []).filter((issue) => String(issue?.expenseId || "") === String(ex?.id || ""));
  const linkIssueHTML = localLinkIssues.length
    ? `<div style="margin-top:12px;padding:10px;border-radius:12px;background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.28);">
         <div style="font-weight:800;margin-bottom:6px;">${escapeHTML(_tripT("trip.linked.audit_title"))}</div>
         ${localLinkIssues.map((issue) => `<div class="muted" style="font-size:12px;">${escapeHTML(issue.type || "link_issue")} • tx ${escapeHTML(String(issue.transactionId || "—"))}</div>`).join("")}
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
        <td style="padding:6px 8px;border-bottom:1px solid rgba(0,0,0,.06);">${tx ? `<button class="btn small" type="button" onclick="tbOpenTransactionFromTrip('${escapeHTML(String(tx.id || ""))}')">${escapeHTML(_tripT("trip.linked.open_transaction"))}</button>` : "—"}</td>
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
        ${mainTx ? `<button class="btn small" type="button" style="margin-top:8px;" onclick="tbOpenTransactionFromTrip('${escapeHTML(String(mainTx.id || ""))}')">${escapeHTML(_tripT("trip.linked.open_transaction"))}</button>` : ``}
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
    ${linkIssueHTML}

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
        <table style="width:100%;border-collapse:collapse;min-width:620px;">
          <thead>
            <tr>
              <th style="text-align:left;padding:8px;border-bottom:1px solid rgba(0,0,0,.08);">Participant</th>
              <th style="text-align:right;padding:8px;border-bottom:1px solid rgba(0,0,0,.08);">Montant tx</th>
              <th style="text-align:left;padding:8px;border-bottom:1px solid rgba(0,0,0,.08);">Catégorie</th>
              <th style="text-align:left;padding:8px;border-bottom:1px solid rgba(0,0,0,.08);">Wallet</th>
              <th style="text-align:left;padding:8px;border-bottom:1px solid rgba(0,0,0,.08);">pay_now / out</th>
              <th style="text-align:left;padding:8px;border-bottom:1px solid rgba(0,0,0,.08);"></th>
            </tr>
          </thead>
          <tbody>
            ${budgetRows || `<tr><td colspan="6" class="muted" style="padding:10px;">Aucun lien budget enregistré pour cette dépense.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;

  modal.querySelector("#tripExpDetailBody").innerHTML = body;
}


async function _createSettlementEventOnly({ tripId, currency, amount, fromId, toId }) {
  const core = window.Core?.tripRules;
  const rpcArgs = core?.buildTripSettlementRpcArgs
    ? core.buildTripSettlementRpcArgs({ tripId, currency, amount, fromMemberId: fromId, toMemberId: toId })
    : {
        p_trip_id: tripId,
        p_currency: String(currency || "").trim().toUpperCase(),
        p_amount: _round2(Number(amount) || 0),
        p_from_member_id: fromId,
        p_to_member_id: toId,
      };
  if (!rpcArgs.p_trip_id || !rpcArgs.p_from_member_id || !rpcArgs.p_to_member_id || !rpcArgs.p_currency || !(Number(rpcArgs.p_amount) > 0)) throw new Error("Règlement invalide.");

  if (sb?.rpc && TB_CONST?.RPCS?.trip_create_settlement_v1) {
    const { data, error } = await sb.rpc(TB_CONST.RPCS.trip_create_settlement_v1, rpcArgs);
    if (!error) return data;
    console.warn("[Trip] trip_create_settlement_v1 fallback", error);
  }

  const uid = await _ensureSession();
  const eventId = (crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + "-" + Math.random().toString(16).slice(2);
  await _tripRepository().createSettlementEvent({ table: TB_CONST.TABLES.trip_settlement_events, event: {
    id: eventId,
    trip_id: rpcArgs.p_trip_id,
    currency: rpcArgs.p_currency,
    amount: rpcArgs.p_amount,
    from_member_id: rpcArgs.p_from_member_id,
    to_member_id: rpcArgs.p_to_member_id,
    created_by: uid,
  } });
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

  await _tripRepository().cancelSettlementEvent({
    table: TB_CONST.TABLES.trip_settlement_events,
    eventId: id,
    cancelledAt: new Date().toISOString(),
  });
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
  if (typeof window.tbAfterMutationRefresh === "function") {
    await window.tbAfterMutationRefresh("trip:settlement_only", { trip: true });
  } else if (typeof window.__tripRefresh === "function") {
    await window.__tripRefresh({ activeOnly: true });
  }
}

async function _persistSettlementWithWallet({ walletId, walletCurrency, walletAmount, walletNativeCurrency }) {
  if (!_settleModalState) throw new Error("Aucun règlement en cours.");
  const uid = await _ensureSession();
  const members = tripState.members || [];
  const { fromId, toId, currency, amount, isOut } = _settleModalState;

  const eventId = (crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + "-" + Math.random().toString(16).slice(2);

  // 1) Persist settlement event (Trip currency & amount)
  const curTrip = String(walletCurrency || currency || "").trim().toUpperCase();
  const amtTrip = _round2(Number(walletAmount) || 0);
  await _tripRepository().createSettlementEvent({ table: TB_CONST.TABLES.trip_settlement_events, event: {
    id: eventId,
    trip_id: tripState.activeTripId,
    currency: curTrip,
    amount: amtTrip,
    from_member_id: fromId,
    to_member_id: toId,
    created_by: uid,
  } });

  // 2) Create wallet transaction (wallet currency & amount)
  const nativeCur = String(walletNativeCurrency || walletCurrency || '').toUpperCase();
  const label = isOut
    ? `[Trip] SETTLE:${eventId} • Règlement à ${(members.find(x => x.id === toId)?.name) || "—"} (${curTrip} ${_round2(amtTrip)} → ${walletCurrency} ${_round2(walletAmount)}${nativeCur && nativeCur !== walletCurrency ? ` ; wallet ${nativeCur}` : ''})`
    : `[Trip] SETTLE:${eventId} • Règlement reçu de ${(members.find(x => x.id === fromId)?.name) || "—"} (${curTrip} ${_round2(amtTrip)} → ${walletCurrency} ${_round2(walletAmount)}${nativeCur && nativeCur !== walletCurrency ? ` ; wallet ${nativeCur}` : ''})`;

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
    p_budget_date_start: date,
    p_budget_date_end: date,
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
    const txRow = await _tripRepository().findLatestTransaction({
      table: TB_CONST.TABLES.transactions,
      match: { user_id: uid, label, currency: walletCurrency, amount: _round2(walletAmount), date_start: date },
    });
    if (txRow?.id) {
      await _tripRepository().linkSettlementTransaction({
        table: TB_CONST.TABLES.trip_settlement_events,
        eventId,
        transactionId: txRow.id,
      });
    }
  } catch (e) {
    console.warn("[Trip] settlement tx link failed", e);
  }

  if (typeof window.tbAfterMutationRefresh === "function") {
    await window.tbAfterMutationRefresh("trip:settlement_wallet", { trip: true });
  } else if (typeof window.__tripRefresh === "function") {
    await window.__tripRefresh({ activeOnly: true });
  }
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
      const walletId = tripState.settlementWalletId || state.activeWalletId || (_activeWallets()?.[0]?.id || "");
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
      await _tripRepository().createSettlementEvent({ table: TB_CONST.TABLES.trip_settlement_events, event: {
        id: eventId,
        trip_id: tripState.activeTripId,
        currency: cur,
        amount: amt,
        from_member_id: fromId,
        to_member_id: toId,
        created_by: uid,
      } });

  
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
        const txRow = await _tripRepository().findLatestTransaction({
          table: TB_CONST.TABLES.transactions,
          match: { user_id: uid, label, currency: cur, amount: amt, date_start: date },
        });
        if (txRow?.id) {
          await _tripRepository().linkSettlementTransaction({
            table: TB_CONST.TABLES.trip_settlement_events,
            eventId,
            transactionId: txRow.id,
          });
        }
      } catch (e) {
        console.warn("[Trip] settlement event tx link failed", e);
      }

  
      // Record in trip_settlements (personal log)
      try {
        await _tripRepository().recordSettlementLog({ table: TB_CONST.TABLES.trip_settlements, row: {
          user_id: uid,
          trip_id: tripState.activeTripId,
          date,
          amount: amt,
          currency: cur,
          direction: isOut ? "out" : "in",
          wallet_id: walletId,
          mode: "virtual",
        } });
      } catch (e) {
        // Non-blocking: even if settlement log fails, wallet tx is the source of truth
        console.warn("[Trip] settlement log insert failed", e);
      }
    }

  async function _createTrip(name) {
    const uid = await _ensureSession();
    const baseCur = state?.period?.baseCurrency || "THB";
    const result = await _tripRepository().createTrip({
      tables: _tripRepositoryTables(),
      userId: uid,
      name,
      baseCurrency: baseCur,
      email: sbUser?.email || window.sbUser?.email || null,
    });
    if (result.defaultMemberError) console.warn("[Trip] default member insert failed (non-blocking):", result.defaultMemberError);
    _setActiveTripId(result.trip.id);
  }

  async function _deleteTrip(tripId) {
    await _ensureSession();
    const result = await _tripRepository().deleteTrip({ tables: _tripRepositoryTables(), tripId });
    if (result.unlinkError) console.warn("Trip unlink before delete failed:", result.unlinkError);

    if (tripState.activeTripId === tripId) tripState.activeTripId = null;
  }

  async function _addMember(name, email) {
    const uid = await _ensureSession();
    const tripId = tripState.activeTripId;
    if (!tripId) return;

    const cleanName = String(name || "").trim();
    if (!cleanName) throw new Error("Nom requis.");

    const cleanEmail = String(email || "").trim();
    await _tripRepository().addMember({
      table: TB_CONST.TABLES.trip_members,
      tripId,
      userId: uid,
      name: cleanName,
      email: cleanEmail || null,
    });
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

    await _tripRepository().deleteMember({ table: TB_CONST.TABLES.trip_members, tripId, memberId });
  }

  async function _renameMember(memberId, newName) {
    await _ensureSession();
    const tripId = tripState.activeTripId;
    if (!tripId) return;
    const name = String(newName || "").trim();
    if (!name) throw new Error("Nom invalide.");

    await _tripRepository().renameMember({ table: TB_CONST.TABLES.trip_members, tripId, memberId, name });
  }
  
  async function _expenseHasBudgetLinks(expenseId) {
    const id = String(expenseId || "");
    if (!id || id.startsWith("local_trip_exp_")) return false;
    if ((tripState.budgetLinks || []).some((row) => String(row?.expenseId || "") === id && row?.transactionId)) return true;
    return false;
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
    let category = ex.category || "Autre";
    let subcategory = ex.subcategory || "";
    let outOfBudget = false;
    let budgetDateStart = ex.budgetDateStart || ex.date || _isoToday();
    let budgetDateEnd = ex.budgetDateEnd || budgetDateStart || ex.date || _isoToday();
    const localTx = ex.transactionId
      ? (Array.isArray(state?.transactions) ? state.transactions : []).find((tx) => String(tx?.id || "") === String(ex.transactionId))
      : null;
    if (localTx) {
      walletId = localTx.walletId || localTx.wallet_id || walletId;
      category = localTx.category || category;
      subcategory = localTx.subcategory || subcategory;
      outOfBudget = (localTx.outOfBudget === true || localTx.out_of_budget === true);
      budgetDateStart = localTx.budgetDateStart || localTx.budget_date_start || budgetDateStart;
      budgetDateEnd = localTx.budgetDateEnd || localTx.budget_date_end || budgetDateEnd;
    }
    const offline = (typeof window.tbIsOfflineMode === "function" && window.tbIsOfflineMode())
      || (typeof navigator !== "undefined" && navigator.onLine === false);
    try {
      const audit = offline ? null : await _fetchExpenseAuditDetails(expenseId);
      const tx = (audit?.myShareLink ? audit.budgetTransactionsById.get(audit.myShareLink.transactionId) : null)
        || audit?.walletTransaction
        || null;
      if (tx) {
        walletId = tx.walletId || "";
        category = tx.category || category;
        subcategory = tx.subcategory || subcategory;
        outOfBudget = tx.outOfBudget === true;
        budgetDateStart = tx.budgetDateStart || budgetDateStart;
        budgetDateEnd = tx.budgetDateEnd || budgetDateEnd;
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
      subcategory,
      budgetDateStart,
      budgetDateEnd,
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

  function _isTripViewActive() {
    try {
      if (typeof activeView === "string") return activeView === "trip";
      if (typeof window !== "undefined" && typeof window.activeView === "string") return window.activeView === "trip";
    } catch (_) {}
    return false;
  }

  function _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms || 0));
  }

  function _tripMutationLooksSettled(meta) {
    const expenses = Array.isArray(tripState?.expenses) ? tripState.expenses : [];
    if (meta?.expectDeletedExpenseId) {
      return !expenses.some(ex => ex && ex.id === meta.expectDeletedExpenseId);
    }
    if (meta?.expectExpenseId) {
      return expenses.some(ex => ex && ex.id === meta.expectExpenseId);
    }
    return true;
  }

  async function _reloadActiveTripDataWithRetry(meta) {
    const attempts = [0, 120, 260, 420];
    let lastErr = null;
    for (let i = 0; i < attempts.length; i++) {
      if (attempts[i] > 0) await _sleep(attempts[i]);
      try {
        await _loadActiveData();
        if (_tripMutationLooksSettled(meta) || i === attempts.length - 1) {
          await _renderUI();
          return;
        }
      } catch (e) {
        lastErr = e;
        if (i === attempts.length - 1) throw e;
      }
    }
    if (lastErr) throw lastErr;
    await _renderUI();
  }

  async function _refreshAfterTripMutation(reason, meta) {
    try { if (typeof window.tbBusyStart === "function") window.tbBusyStart("Mise à jour en cours…"); } catch (_) {}
    try {
      if (typeof refreshFromServer === "function") {
        await refreshFromServer({ skipRender: _isTripViewActive() });
      }

      // Keep financial widgets (wallet + KPI) in sync even outside dashboard.
      try {
        if (typeof window.tbRefreshFinancialState === "function") {
          window.tbRefreshFinancialState(reason || "tripMutation", { cashflow: false });
        } else {
          if (typeof renderWallets === "function") renderWallets();
          if (typeof renderKPI === "function") renderKPI();
        }
      } catch (_) {}

      if (_isTripViewActive()) {
        await _reloadActiveTripDataWithRetry(meta || null);
      } else if (typeof window.__tripRefresh === "function") {
        await window.__tripRefresh({ activeOnly: true });
      }
    } finally {
      try { if (typeof window.tbBusyEnd === "function") window.tbBusyEnd(); } catch (_) {}
    }
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

  async function _integrateExpenseBudgetSideEffects({ expenseId, date, label, amount, currency, paidByMemberId, walletId, category, subcategory, budgetDateStart, budgetDateEnd, outOfBudget, split }) {
    const uid = await _ensureSession();
    const members = tripState.members || [];
    const memberIds = members.map(m => m.id);
    const amt = Number(amount);
    const cur = _normalizeCurrency(currency);
    const cat = (category || "Autre");
    const out = !!outOfBudget;
    const subcat = String(subcategory || "").trim() || null;
    const budgetStart = budgetDateStart || date;
    const budgetEnd = budgetDateEnd || budgetStart || date;
    const payer = members.find(m => m.id === paidByMemberId) || null;
    const paidByMe = !!payer?.isMe;
    const parts = _computeSplitParts(amt, members, split);
    _validateSplitParts(amt, parts);

    const ex = await _tripRepository().getExpenseById({ table: TB_CONST.TABLES.trip_expenses, expenseId });

    if (paidByMe) {
      if (!walletId) throw new Error("Choisis une wallet (pour décompter le paiement).");
      const w = findWallet(walletId);
      if (!w) throw new Error("Wallet invalide.");
      if (String(w.currency || "").toUpperCase() !== cur) {
        throw new Error(`Devise wallet (${w.currency}) différente de la dépense (${cur}). Choisis une wallet dans la même devise.`);
      }

      const targetPeriodId = _findPeriodIdForDate(date);
      const me = members.find(m => m.isMe) || null;
      const budgetFlow = window.Core?.tripRules?.decideTripExpenseBudgetFlow
        ? window.Core.tripRules.decideTripExpenseBudgetFlow({ amount: amt, members, shares: parts })
        : {
          myIdx: me ? memberIds.indexOf(me.id) : -1,
          myShare: me ? Number(parts[memberIds.indexOf(me.id)] ?? 0) : NaN,
          hasMyShare: me ? isFinite(Number(parts[memberIds.indexOf(me.id)] ?? 0)) && Number(parts[memberIds.indexOf(me.id)] ?? 0) > 0 : false,
          isFullShare: me ? isFinite(Number(parts[memberIds.indexOf(me.id)] ?? 0)) && Math.abs(Number(parts[memberIds.indexOf(me.id)] ?? 0) - amt) < 0.005 : false,
        };
      const myIdx = budgetFlow.myIdx;
      const myShare = Number(budgetFlow.myShare);
      const isFullShare = !!budgetFlow.isFullShare;

      if (isFullShare) {
        const { error: rpcErr } = await _rpcApplyTransactionV2(sb, {
          ...(window.Core?.tripRules?.buildTripFullShareTransactionArgs
            ? window.Core.tripRules.buildTripFullShareTransactionArgs({ userId: uid, walletId, label, amount: amt, currency: cur, date, budgetDateStart: budgetStart, budgetDateEnd: budgetEnd, category: cat, subcategory: subcat, outOfBudget: out })
            : { p_user_id: uid, p_wallet_id: walletId, p_type: "expense", p_label: `[Trip] ${label}`, p_amount: amt, p_currency: cur, p_date_start: date, p_date_end: date, p_budget_date_start: budgetStart, p_budget_date_end: budgetEnd, p_category: cat, p_subcategory: subcat, p_pay_now: true, p_out_of_budget: out, p_night_covered: false, p_affects_budget: !out, p_trip_expense_id: null, p_trip_share_link_id: null }),
          ..._rpcFxSnapshotArgs(date, cur)
        });
        if (rpcErr) throw rpcErr;

        const tx = await _findTripBudgetTransaction({ walletId, amount: amt, currency: cur, category: cat, label: `[Trip] ${label}`, date, payNow: true, outOfBudget: out });
        await _linkCreatedExpenseTransaction({ tx, expenseId: ex.id, date, targetPeriodId });
      } else {
        if (!me) {
          toastWarn("[Trip] Impossible de déterminer ta part pour le budget (participant 'moi' manquant).");
        }

        const advanceArgs = window.Core?.tripRules?.buildTripAdvanceTransactionArgs
          ? window.Core.tripRules.buildTripAdvanceTransactionArgs({ userId: uid, walletId, label, amount: amt, currency: cur, date, budgetDateStart: budgetStart, budgetDateEnd: budgetEnd, category: cat, subcategory: subcat })
          : { p_user_id: uid, p_wallet_id: walletId, p_type: "expense", p_label: `[Trip] Avance - ${label}`, p_amount: amt, p_currency: cur, p_date_start: date, p_date_end: date, p_budget_date_start: budgetStart, p_budget_date_end: budgetEnd, p_category: cat, p_subcategory: subcat, p_pay_now: true, p_out_of_budget: true, p_night_covered: false, p_affects_budget: false, p_trip_expense_id: null, p_trip_share_link_id: null };
        const advanceLabel = advanceArgs.p_label;
        const { error: rpcErrA } = await _rpcApplyTransactionV2(sb, {
          ...advanceArgs,
          ..._rpcFxSnapshotArgs(date, cur)
        });
        if (rpcErrA) throw rpcErrA;

        const txA = await _findTripBudgetTransaction({ walletId, amount: amt, currency: cur, category: cat, label: advanceLabel, date, payNow: true, outOfBudget: true });
        await _linkCreatedExpenseTransaction({ tx: txA, expenseId: ex.id, date, targetPeriodId });

        if (me && myIdx >= 0 && budgetFlow.hasMyShare) {
          const shareArgs = window.Core?.tripRules?.buildTripPersonalShareTransactionArgs
            ? window.Core.tripRules.buildTripPersonalShareTransactionArgs({ userId: uid, walletId, label, myShare, currency: cur, date, budgetDateStart: budgetStart, budgetDateEnd: budgetEnd, category: cat, subcategory: subcat, outOfBudget: out })
            : { p_user_id: uid, p_wallet_id: walletId, p_type: "expense", p_label: `[Trip] ${label}`, p_amount: myShare, p_currency: cur, p_date_start: date, p_date_end: date, p_budget_date_start: budgetStart, p_budget_date_end: budgetEnd, p_category: cat, p_subcategory: subcat, p_pay_now: false, p_out_of_budget: out, p_night_covered: false, p_affects_budget: !out, p_trip_expense_id: null, p_trip_share_link_id: null };
          const consLabel = shareArgs.p_label;
          const { error: rpcErrB } = await _rpcApplyTransactionV2(sb, {
            ...shareArgs,
            ..._rpcFxSnapshotArgs(date, cur)
          });
          if (rpcErrB) throw rpcErrB;

          const txB = await _findTripBudgetTransaction({ walletId, amount: myShare, currency: cur, category: cat, label: consLabel, date, payNow: false, outOfBudget: out });
          await _linkCreatedShareTransaction({ tx: txB, expenseId: ex.id, memberId: me.id, date, targetPeriodId });
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
            w = _activeWallets().find(x => String(x.currency || "").toUpperCase() === cur) || null;
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
              p_budget_date_start: budgetStart,
              p_budget_date_end: budgetEnd,
              p_category: cat,
              p_subcategory: subcat,
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
              .select("id,travel_id,period_id")
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
              const targetTravelId = _findTravelIdForDate(date);
          if (
            (targetTravelId && (!tx2.travel_id || tx2.travel_id !== targetTravelId)) ||
            (targetPeriodId && (!tx2.period_id || tx2.period_id !== targetPeriodId))
          ) {
            await sb
              .from(TB_CONST.TABLES.transactions)
              .update({
                travel_id: targetTravelId || tx2.travel_id || null,
                period_id: targetPeriodId || tx2.period_id || null
              })
              .eq("id", tx2.id);
          }
              await _linkShareToTransaction({ expenseId: ex.id, memberId: me.id, transactionId: tx2.id });
            }
          }
        }
      }
    }
  }

  async function _updateExpense({ expenseId, date, label, amount, currency, paidByMemberId, walletId, category, subcategory, budgetDateStart, budgetDateEnd, outOfBudget, split }) {
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

    const input = _normalizeTripExpenseForMutation({ expenseId, date, label, amount, currency, paidByMemberId, walletId, category, subcategory, budgetDateStart, budgetDateEnd, outOfBudget });
    const payer = members.find(m => m.id === input.paidByMemberId) || null;
    const wallet = input.walletId ? findWallet(input.walletId) : null;
    const cur = _normalizeCurrency(currency);
    const parts = _computeSplitParts(amt, members, split);
    _validateTripExpenseForMutation({ input, members, parts, payer, wallet });

    await _cleanupExpenseBudgetLinksBeforeEdit(expenseId);

    const payloadExp = _buildTripExpenseRpcPayload({ input, members, parts });

    const updatedExpenseId = await _applyTripExpense(tripId, payloadExp);

    await _integrateExpenseBudgetSideEffects({ expenseId: updatedExpenseId, date, label, amount: amt, currency: cur, paidByMemberId, walletId, category, subcategory, budgetDateStart, budgetDateEnd, outOfBudget, split });
    await _requestPayerApprovalIfNeeded(updatedExpenseId, paidByMemberId);

    tripState.editingExpenseId = null;
    tripState.editingExpenseDraft = null;
    return updatedExpenseId;
  }

  async function _addExpense({ date, label, amount, currency, paidByMemberId, walletId, category, subcategory, budgetDateStart, budgetDateEnd, outOfBudget, split, skipDuplicateCheck }) {
  const uid = await _ensureSession();
  const tripId = tripState.activeTripId;
  if (!tripId) return;

  const members = tripState.members;
  if (!members.length) throw new Error("Ajoute au moins un participant.");

  const amt = Number(amount);
  if (!date || !isFinite(amt) || amt <= 0) throw new Error("Date et montant (>0) requis.");
  if (!paidByMemberId) throw new Error("Sélectionne qui a payé.");

  const input = _normalizeTripExpenseForMutation({ date, label, amount, currency, paidByMemberId, walletId, category, subcategory, budgetDateStart, budgetDateEnd, outOfBudget });
  const cur = _normalizeCurrency(currency);
  const payer = members.find(m => m.id === paidByMemberId) || null;
  const paidByMe = !!payer?.isMe;

  // If paid by me, ensure we can record it into the Budget system (wallet + category).
  const cat = (category || "Autre");
  const subcat = String(subcategory || "").trim() || null;
  const out = !!outOfBudget;
  const budgetStart = budgetDateStart || date;
  const budgetEnd = budgetDateEnd || budgetStart || date;

  if (paidByMe) {
    if (!walletId) throw new Error("Choisis une wallet (pour décompter le paiement).");
    const w = findWallet(walletId);
    const core = window.Core?.tripRules;
    if (core?.canUseTripWalletForExpense) {
      const walletValidation = core.canUseTripWalletForExpense({
        wallet: w,
        userId: sbUser?.id || window.sbUser?.id || null,
        travelId: state?.activeTravelId || null,
        currency: cur,
      });
      if (!walletValidation.ok) throw new Error(walletValidation.reason || "Wallet invalide.");
    } else {
      if (!w) throw new Error("Wallet invalide.");
      if (String(w.currency || "").toUpperCase() !== cur) {
        throw new Error(`Devise wallet (${w.currency}) différente de la dépense (${cur}). Choisis une wallet dans la même devise (conversion FX non implémentée).`);
      }
    }

    // Duplicate control: if a matching Budget transaction exists, propose linking instead of creating a new one.
      // Duplicate control: if a matching Budget transaction exists, propose linking instead of creating a new one.
      let selectedExistingTransaction = false;
      if (!skipDuplicateCheck) {
      try {
        const matches = await _findMatchingTransactions({ date, amount: amt, currency: cur });
        if (matches.length) {
          const m0 = await _chooseMatchingTransaction(matches, {
            date,
            amount: amt,
            currency: cur
        });
          if (m0) {
            selectedExistingTransaction = true;
            // Create trip expense first, then link.
            // Create trip expense + shares atomically (DB-first V8.1)
            const memberIds = members.map(m => m.id);
            const parts = _computeSplitParts(amt, members, split);
            _validateTripExpenseForMutation({ input, members, parts, payer, wallet: input.walletId ? findWallet(input.walletId) : null });

            const payloadExp = _buildTripExpenseRpcPayload({ input, members, parts });

            const expId = await _applyTripExpense(tripId, payloadExp);
            const ex = await _tripRepository().getExpenseById({ table: TB_CONST.TABLES.trip_expenses, expenseId: expId });

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
                 const budgetPatch = window.Core?.tripRules?.linkedTripPaymentBudgetPatch?.({
                   paymentAmount: m0?.amount,
                   personalShare: myShare,
                   payNow: m0?.pay_now === true,
                 }) || { out_of_budget: true, affects_budget: false };
                 if (looksLikePayment2 && (m0.out_of_budget !== true || m0.affects_budget !== false)) {
                   await sb.from(TB_CONST.TABLES.transactions).update(budgetPatch).eq("id", m0.id);
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
                      p_budget_date_start: budgetStart,
                      p_budget_date_end: budgetEnd,
                      p_category: cat,
                      p_subcategory: subcat,
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
                      .select("id,travel_id,period_id")
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
                      const targetTravelId = _findTravelIdForDate(date);
          if (
            (targetTravelId && (!txB.travel_id || txB.travel_id !== targetTravelId)) ||
            (targetPeriodId && (!txB.period_id || txB.period_id !== targetPeriodId))
          ) {
            await sb
              .from(TB_CONST.TABLES.transactions)
              .update({
                travel_id: targetTravelId || txB.travel_id || null,
                period_id: targetPeriodId || txB.period_id || null
              })
              .eq("id", txB.id);
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
        if (selectedExistingTransaction) throw e;
        console.warn("Trip duplicate check failed:", e);
      }
      }
    }

    // 1) Create Trip expense + shares (DB-first V8.1)
    const memberIds = members.map(m => m.id);
    const parts = _computeSplitParts(amt, members, split);
    _validateTripExpenseForMutation({ input, members, parts, payer, wallet: input.walletId ? findWallet(input.walletId) : null });

    const payloadExp = _buildTripExpenseRpcPayload({ input, members, parts });

    const expId = await _applyTripExpense(tripId, payloadExp);
    const ex = await _tripRepository().getExpenseById({ table: TB_CONST.TABLES.trip_expenses, expenseId: expId });



    // 2) Budget integration
    if (paidByMe) {
      const w = findWallet(walletId);
      const targetPeriodId = _findPeriodIdForDate(date);

      const me = members.find(m => m.isMe) || null;
      const budgetFlow = window.Core?.tripRules?.decideTripExpenseBudgetFlow
        ? window.Core.tripRules.decideTripExpenseBudgetFlow({ amount: amt, members, shares: parts })
        : {
          myIdx: me ? memberIds.indexOf(me.id) : -1,
          myShare: me ? Number(parts[memberIds.indexOf(me.id)] ?? 0) : NaN,
          hasMyShare: me ? isFinite(Number(parts[memberIds.indexOf(me.id)] ?? 0)) && Number(parts[memberIds.indexOf(me.id)] ?? 0) > 0 : false,
          isFullShare: me ? isFinite(Number(parts[memberIds.indexOf(me.id)] ?? 0)) && Math.abs(Number(parts[memberIds.indexOf(me.id)] ?? 0) - amt) < 0.005 : false,
        };
      const myIdx = budgetFlow.myIdx;
      const myShare = Number(budgetFlow.myShare);

      // If I effectively pay 100% (solo / my share == total), we can record a single Budget expense.
      // Otherwise:
      //  - record a cashflow "advance" (pay_now=true, out_of_budget=true) to decrement the wallet
      //  - record my consumption share (pay_now=false) so budget/allocation reflects my real cost
      const isFullShare = !!budgetFlow.isFullShare;

      if (isFullShare) {
        const fullShareArgs = window.Core?.tripRules?.buildTripFullShareTransactionArgs
          ? window.Core.tripRules.buildTripFullShareTransactionArgs({ userId: uid, walletId, label, amount: amt, currency: cur, date, budgetDateStart: budgetStart, budgetDateEnd: budgetEnd, category: cat, subcategory: subcat, outOfBudget: out })
          : { p_user_id: uid, p_wallet_id: walletId, p_type: "expense", p_label: `[Trip] ${label}`, p_amount: amt, p_currency: cur, p_date_start: date, p_date_end: date, p_budget_date_start: budgetStart, p_budget_date_end: budgetEnd, p_category: cat, p_subcategory: subcat, p_pay_now: true, p_out_of_budget: out, p_night_covered: false, p_affects_budget: !out, p_trip_expense_id: null, p_trip_share_link_id: null };
        const { error: rpcErr } = await _rpcApplyTransactionV2(sb, {
          ...fullShareArgs,
          ..._rpcFxSnapshotArgs(date, cur)
        });
        if (rpcErr) throw rpcErr;

        const tx = await _findTripBudgetTransaction({ walletId, amount: amt, currency: cur, category: cat, label: fullShareArgs.p_label, date, payNow: true, outOfBudget: out });
        await _linkCreatedExpenseTransaction({ tx, expenseId: ex.id, date, targetPeriodId, missingMessage: "Budget tx created but not found for linking." });
      } else {
        if (!me) {
          toastWarn("[Trip] Impossible de déterminer ta part pour le budget (participant 'moi' manquant).");
        }

        // A) Cashflow advance (decrement wallet, NOT in budget)
        const advanceArgs = window.Core?.tripRules?.buildTripAdvanceTransactionArgs
          ? window.Core.tripRules.buildTripAdvanceTransactionArgs({ userId: uid, walletId, label, amount: amt, currency: cur, date, budgetDateStart: budgetStart, budgetDateEnd: budgetEnd, category: cat, subcategory: subcat })
          : { p_user_id: uid, p_wallet_id: walletId, p_type: "expense", p_label: `[Trip] Avance - ${label}`, p_amount: amt, p_currency: cur, p_date_start: date, p_date_end: date, p_budget_date_start: budgetStart, p_budget_date_end: budgetEnd, p_category: cat, p_subcategory: subcat, p_pay_now: true, p_out_of_budget: true, p_night_covered: false, p_affects_budget: false, p_trip_expense_id: null, p_trip_share_link_id: null };
        const advanceLabel = advanceArgs.p_label;
        const { error: rpcErrA } = await _rpcApplyTransactionV2(sb, {
          ...advanceArgs,
          ..._rpcFxSnapshotArgs(date, cur)
        });
        if (rpcErrA) throw rpcErrA;

        const txA = await _findTripBudgetTransaction({ walletId, amount: amt, currency: cur, category: cat, label: advanceLabel, date, payNow: true, outOfBudget: true });
        await _linkCreatedExpenseTransaction({ tx: txA, expenseId: ex.id, date, targetPeriodId, missingMessage: "Advance tx created but not found for linking." });

        // B) My consumption share (budget/allocation, but pay_now=false so wallet isn't decremented twice)
        if (me && myIdx >= 0 && budgetFlow.hasMyShare) {
          const existing = await _getShareBudgetLink(ex.id, me.id);
          if (!existing) {
            const shareArgs = window.Core?.tripRules?.buildTripPersonalShareTransactionArgs
              ? window.Core.tripRules.buildTripPersonalShareTransactionArgs({ userId: uid, walletId, label, myShare, currency: cur, date, budgetDateStart: budgetStart, budgetDateEnd: budgetEnd, category: cat, subcategory: subcat, outOfBudget: out })
              : { p_user_id: uid, p_wallet_id: walletId, p_type: "expense", p_label: `[Trip] ${label}`, p_amount: myShare, p_currency: cur, p_date_start: date, p_date_end: date, p_budget_date_start: budgetStart, p_budget_date_end: budgetEnd, p_category: cat, p_subcategory: subcat, p_pay_now: false, p_out_of_budget: out, p_night_covered: false, p_affects_budget: !out, p_trip_expense_id: null, p_trip_share_link_id: null };
            const consLabel = shareArgs.p_label;
            const { error: rpcErrB } = await _rpcApplyTransactionV2(sb, {
              ...shareArgs,
              ..._rpcFxSnapshotArgs(date, cur)
            });
            if (rpcErrB) throw rpcErrB;

            const txB = await _findTripBudgetTransaction({ walletId, amount: myShare, currency: cur, category: cat, label: consLabel, date, payNow: false, outOfBudget: out });
            await _linkCreatedShareTransaction({ tx: txB, expenseId: ex.id, memberId: me.id, date, targetPeriodId });
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
              w = _activeWallets().find(x => String(x.currency || "").toUpperCase() === cur) || null;
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
                p_budget_date_start: budgetStart,
                p_budget_date_end: budgetEnd,
                p_category: cat,
                p_subcategory: subcat,
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
                .select("id,travel_id,period_id")
                
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
                const targetTravelId = _findTravelIdForDate(date);
          if (
            (targetTravelId && (!tx2.travel_id || tx2.travel_id !== targetTravelId)) ||
            (targetPeriodId && (!tx2.period_id || tx2.period_id !== targetPeriodId))
          ) {
            await sb
              .from(TB_CONST.TABLES.transactions)
              .update({
                travel_id: targetTravelId || tx2.travel_id || null,
                period_id: targetPeriodId || tx2.period_id || null
              })
              .eq("id", tx2.id);
          }
                await _linkShareToTransaction({ expenseId: ex.id, memberId: me.id, transactionId: tx2.id });
              }
            }
          }
        }
      }

    }

    await _requestPayerApprovalIfNeeded(ex.id, paidByMemberId);
    return ex.id;
  }

  function _tripExpenseFormForQueue(form) {
    return {
      date: String(form?.date || "").slice(0, 10),
      label: String(form?.label || "").trim(),
      amount: Number(form?.amount || 0),
      currency: _normalizeCurrency(form?.currency),
      paidByMemberId: String(form?.paidByMemberId || ""),
      walletId: String(form?.walletId || ""),
      category: String(form?.category || "Autre"),
      subcategory: String(form?.subcategory || "").trim(),
      budgetDateStart: String(form?.budgetDateStart || form?.date || "").slice(0, 10),
      budgetDateEnd: String(form?.budgetDateEnd || form?.budgetDateStart || form?.date || "").slice(0, 10),
      outOfBudget: !!form?.outOfBudget,
      split: form?.split || { mode: "equal" },
    };
  }

  function _tripValidateExpenseFormOffline(form) {
    const tripId = tripState.activeTripId;
    if (!tripId) throw new Error("Selectionne un trip d'abord.");
    const members = tripState.members || [];
    if (!members.length) throw new Error("Ajoute au moins un participant.");
    const input = _normalizeTripExpenseForMutation(form);
    const amt = Number(input.amount);
    if (!input.date || !input.label || !Number.isFinite(amt) || amt <= 0) throw new Error("Date, libelle et montant (>0) requis.");
    const payer = members.find(m => m.id === input.paidByMemberId) || null;
    if (!payer) throw new Error("Selectionne qui a paye.");
    const wallet = input.walletId ? findWallet(input.walletId) : null;
    const parts = _computeSplitParts(amt, members, form.split);
    _validateTripExpenseForMutation({ input, members, parts, payer, wallet });
    return { input, parts };
  }

  function _tripMakeLocalExpenseId() {
    return `local_trip_exp_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  function _tripApplyOptimisticExpenseMutation({ mode, expenseId, form, queueId }) {
    const tripId = tripState.activeTripId;
    const members = tripState.members || [];
    const { input, parts } = _tripValidateExpenseFormOffline(form);
    const id = mode === "update" ? String(expenseId || "") : _tripMakeLocalExpenseId();
    if (!id) throw new Error("Depense Trip introuvable.");
    if (mode === "update" && id.startsWith("local_trip_exp_")) {
      throw new Error("Cette depense est deja en attente de synchro. Attends la synchro avant de la modifier.");
    }
    const now = new Date().toISOString();
    const row = {
      id,
      tripId,
      date: input.date,
      label: input.label,
      amount: Number(input.amount),
      currency: input.currency,
      paidByMemberId: input.paidByMemberId,
      category: input.category || null,
      subcategory: input.subcategory || null,
      budgetDateStart: input.budgetDateStart || input.date || null,
      budgetDateEnd: input.budgetDateEnd || input.budgetDateStart || input.date || null,
      transactionId: null,
      createdAt: mode === "update"
        ? ((tripState.expenses || []).find((ex) => String(ex.id) === id)?.createdAt || now)
        : now,
      localOnly: mode === "create",
      offlinePending: true,
      offlineQueueId: queueId || "",
    };
    if (mode === "update") {
      tripState.expenses = (tripState.expenses || []).map((ex) => String(ex.id) === id ? Object.assign({}, ex, row) : ex);
    } else {
      tripState.expenses = [row].concat(tripState.expenses || []);
    }
    const shareRows = members.map((m, idx) => ({
      id: `${id}_share_${m.id}`,
      expenseId: id,
      memberId: m.id,
      shareAmount: Number(parts[idx] || 0),
      localOnly: mode === "create",
      offlinePending: true,
      offlineQueueId: queueId || "",
    }));
    tripState.shares = (tripState.shares || []).filter((s) => String(s.expenseId) !== id).concat(shareRows);
    _syncTripStateToAppState(`trip:offline-${mode}`);
    try { if (typeof window.tbSaveOfflineSnapshot === "function") window.tbSaveOfflineSnapshot(`trip:offline-${mode}`); } catch (_) {}
    return id;
  }

  async function _queueTripExpenseMutation({ mode, expenseId, form }) {
    const queuedForm = _tripExpenseFormForQueue(form);
    _tripValidateExpenseFormOffline(queuedForm);
    if (mode === "update") {
      const current = (tripState.expenses || []).find((ex) => String(ex.id || "") === String(expenseId || ""));
      const hasBudgetLink = (tripState.budgetLinks || []).some((row) => String(row?.expenseId || "") === String(expenseId || "") && row?.transactionId);
      if (current?.transactionId || hasBudgetLink) {
        throw new Error("Modification offline impossible pour une depense Trip deja liee a Budget/Wallet. Repasse en ligne pour modifier cette depense.");
      }
    }
    const kind = mode === "update" ? "trip.expense.update" : "trip.expense.create";
    if (typeof window.tbOfflineQueueEnqueue !== "function") throw new Error("File offline indisponible.");
    const queueItem = window.tbOfflineQueueEnqueue(kind, {
      tripId: tripState.activeTripId,
      mode,
      expenseId: expenseId || null,
      form: queuedForm,
      members: (tripState.members || []).map((m) => ({
        id: m.id,
        name: m.name,
        email: m.email || null,
        authUserId: m.authUserId || null,
        userId: m.userId || null,
        isMe: !!m.isMe,
      })),
    }, {
      label: queuedForm.label,
      amount: queuedForm.amount,
      currency: queuedForm.currency,
      type: "trip",
    });
    return _tripApplyOptimisticExpenseMutation({ mode, expenseId, form: queuedForm, queueId: queueItem?.id });
  }

  async function _findExistingTripExpenseForReplay(tripId, form) {
    try {
      const normalizedTripId = String(tripId || "").trim();
      const date = String(form?.date || "").slice(0, 10);
      const label = String(form?.label || "").trim();
      const amount = Number(form?.amount || 0);
      const currency = _normalizeCurrency(form?.currency);
      const paidByMemberId = String(form?.paidByMemberId || "");
      if (!normalizedTripId || !date || !label || !isFinite(amount) || amount <= 0 || !currency || !paidByMemberId) return null;

      const candidates = (tripState.expenses || []).filter((ex) => {
        if (!ex || ex.localOnly) return false;
        return String(ex.tripId || ex.trip_id || normalizedTripId) === normalizedTripId
          && String(ex.date || "").slice(0, 10) === date
          && String(ex.label || "").trim().toLowerCase() === label.toLowerCase()
          && Math.abs(Number(ex.amount || 0) - amount) < 0.005
          && _normalizeCurrency(ex.currency) === currency
          && String(ex.paidByMemberId || ex.paid_by_member_id || "") === paidByMemberId;
      });
      if (candidates.length) {
        candidates.sort((a, b) => String(a.createdAt || a.created_at || "").localeCompare(String(b.createdAt || b.created_at || "")));
        return candidates[0].id || candidates[0].expenseId || null;
      }

      return await _tripRepository().findExpenseByFingerprint({
        table: TB_CONST.TABLES.trip_expenses,
        tripId: normalizedTripId,
        date,
        label,
        amount,
        currency,
        paidByMemberId,
      });
    } catch (e) {
      console.warn("[Trip] offline replay duplicate guard failed", e);
      return null;
    }
  }

  async function _tripReplayOfflineExpenseMutation(payload) {
    const tripId = String(payload?.tripId || "");
    if (!tripId) throw new Error("Trip manquant dans l'action offline.");
    if (tripState._offlineReplaySaving) throw new Error("Synchronisation Trip deja en cours.");
    tripState._offlineReplaySaving = true;
    const previousTripId = tripState.activeTripId;
    try {
      if (tripState.activeTripId !== tripId) {
        _setActiveTripId(tripId);
      }
      await _loadActiveData();
      if (!(tripState.members || []).length && Array.isArray(payload?.members) && payload.members.length) {
        tripState.members = payload.members.map((m) => ({
          id: m.id,
          name: m.name,
          email: m.email || null,
          authUserId: m.authUserId || null,
          userId: m.userId || null,
          isMe: !!m.isMe,
        }));
      }
      const form = _tripExpenseFormForQueue(payload?.form || {});
      if (String(payload?.mode || payload?.kind || "").includes("update") || payload?.expenseId) {
        await _updateExpense(Object.assign({ expenseId: payload.expenseId }, form));
      } else {
        const existingExpenseId = await _findExistingTripExpenseForReplay(tripId, form);
        if (existingExpenseId) return existingExpenseId;
        await _addExpense(Object.assign({}, form, { skipDuplicateCheck: true }));
      }
    } finally {
      tripState._offlineReplaySaving = false;
      if (previousTripId && previousTripId !== tripState.activeTripId) {
        try {
          _setActiveTripId(previousTripId);
          await _loadActiveData();
        } catch (e) {
          console.warn("[Trip] restore active trip after offline replay failed", e);
        }
      }
    }
  }
  window.tbTripReplayOfflineExpenseMutation = _tripReplayOfflineExpenseMutation;

  function _tripCleanupOfflineOptimistic(queueId) {
    const qid = String(queueId || "").trim();
    if (!qid) return 0;
    const before = (tripState.expenses || []).length;
    tripState.expenses = (tripState.expenses || []).filter((ex) => !(ex.localOnly && String(ex.offlineQueueId || "") === qid));
    tripState.shares = (tripState.shares || []).filter((share) => !(share.localOnly && String(share.offlineQueueId || "") === qid));
    const removed = before - (tripState.expenses || []).length;
    if (removed) {
      _syncTripStateToAppState("trip:offline-cleanup");
      try { if (typeof window.tbSaveOfflineSnapshot === "function") window.tbSaveOfflineSnapshot("trip:offline-cleanup"); } catch (_) {}
    }
    return removed;
  }
  window.tbTripCleanupOfflineOptimistic = _tripCleanupOfflineOptimistic;

  async function _deleteExpense(expenseId) {
    await _ensureSession();
    const tripId = tripState.activeTripId;
    if (!tripId || !expenseId) throw new Error("Suppression invalide.");

    if (sb?.rpc && TB_CONST?.RPCS?.trip_delete_expense_v1) {
      const args = window.Core?.tripRules?.buildTripDeleteExpenseRpcArgs
        ? window.Core.tripRules.buildTripDeleteExpenseRpcArgs({ tripId, expenseId })
        : { p_trip_id: tripId, p_expense_id: expenseId };
      const { error } = await sb.rpc(TB_CONST.RPCS.trip_delete_expense_v1, args);
      if (!error) return;
      console.warn("[Trip] trip_delete_expense_v1 fallback", error);
    }

    const ex = tripState.expenses.find(x => x.id === expenseId);
    await _tripRepository().deleteExpenseFallback({
      tables: _tripRepositoryTables(),
      deleteTransactionRpc: TB_CONST.RPCS.delete_transaction || "delete_transaction",
      expenseId,
      transactionId: ex?.transactionId || null,
    });
  }

  async function _moveExpenseToTrip(expenseId, newTripId) {
    await _ensureSession();
    if (!expenseId || !newTripId) throw new Error("[Trip] Déplacement invalide.");

    await _tripRepository().moveExpense({ tables: _tripRepositoryTables(), expenseId, tripId: newTripId });
  }

  function _expenseFormHTML({ editingExpenseId, editingDraft, trip, canWrite, memberOptions, walletOptions, categoryOptions, modal = false }) {
    return window.UI?.tripView?.renderTripExpenseForm({
      editingExpenseId,
      editingDraft,
      trip,
      canWrite,
      memberOptions,
      walletOptions,
      categoryOptions,
      modal,
      language: typeof window.tbGetLang === "function" ? window.tbGetLang() : "fr",
      todayISO: toLocalISODate(new Date()),
      defaultCurrency: state?.period?.baseCurrency || "THB",
      translate: _tripT,
      escapeHTML,
      currencyOptionsHTML: _tripCurrencyOptionsHTML,
    }) || "";
  }


  function _renderTripContextHelp(root) {
    try {
      if (!root) return;
      if (root.querySelector('[data-tb-help="trip-overview"]')) return;
      if (window.tbUxIsDismissed && window.tbUxIsDismissed('trip_overview')) return;
      const card = document.createElement('div');
      card.setAttribute('data-tb-help', 'trip-overview');
      card.className = 'card';
      card.style.marginBottom = '12px';
      card.innerHTML = window.UI?.tripView?.renderTripContextHelp({
        title: _tripT("trip.help.title"),
        bullets: [
          _tripT("trip.help.paid_by_me"),
          _tripT("trip.help.budget"),
          _tripT("trip.help.settlement"),
        ],
        openLabel: _tripT("trip.help.open"),
        hideLabel: _tripT("trip.help.hide"),
        escapeHTML,
      }) || "";
      root.prepend(card);
      const open = card.querySelector('[data-trip-help-open]');
      if (open) open.onclick = () => { try { showView('help'); } catch (_) {} };
      const close = card.querySelector('[data-trip-help-close]');
      if (close) close.onclick = () => { try { if (window.tbUxDismiss) window.tbUxDismiss('trip_overview'); } catch(_) {} card.remove(); };
    } catch (_) {}
  }

  async function _renderUI() {
    const root = _root();
    if (!root) return;

    const trip = tripState.trips.find(t => t.id === tripState.activeTripId) || null;
    const tripClosed = !!(trip && trip.closed_at);
    const tripSnapshot = tripClosed && trip?.close_snapshot && typeof trip.close_snapshot === "object" ? trip.close_snapshot : null;
    const myRole = tripState.myRole || 'owner';
    const canWrite = (myRole !== 'viewer') && !tripClosed;
    const members = tripState.members;
    const expenses = tripState.expenses;
    const editingExpenseId = tripState.editingExpenseId || null;
    const editingDraft = tripState.editingExpenseDraft || null;
    const isTripMobileApp = !!document.body?.classList?.contains("tb-capacitor-app");
    const addExpenseOpen = isTripMobileApp && !!tripState.addExpenseOpen;

    

    const globalNetHTML = "";// removed: global net to avoid confusion
    const pendingInvitesHTML = _pendingTripInvitesHTML(tripState.pendingInvites || []);

    const liveBalancesByCurRaw = _computeBalances();
    const liveBalancesByCur = _unifyBalancesToDisplayCurrency(liveBalancesByCurRaw);
    const liveSettlementsByCur = _computeSettlements(liveBalancesByCur);
    const balancesByCur = tripSnapshot ? _balancesFromSnapshot(tripSnapshot) : liveBalancesByCur;
    const settlementsByCur = tripSnapshot ? _settlementsFromSnapshot(tripSnapshot) : liveSettlementsByCur;
    const settlementSuggestionsRaw = [];
    tripState._lastCloseSnapshot = {
      closedAt: new Date().toISOString(),
      displayCurrency: Array.from(liveBalancesByCur.keys())[0] || String(state?.period?.baseCurrency || "EUR").toUpperCase(),
      balances: _serializeBalancesForSnapshot(liveBalancesByCur),
      settlements: _serializeSettlementsForSnapshot(liveSettlementsByCur),
      expenseCount: Array.isArray(expenses) ? expenses.length : 0,
      memberCount: Array.isArray(members) ? members.length : 0,
    };

    const balHTML = (() => {
      if (!members.length) return `<div class="muted">Ajoute des participants.</div>`;
      const parts = [];
      for (const [cur, m] of balancesByCur.entries()) {
        parts.push(`<div class="muted" style="margin-top:8px;">${escapeHTML(cur)}</div>`);
        for (const mem of members) {
          const v = m.get(mem.id) || 0;
          const cls = v < -1e-9 ? "bad" : (v > 1e-9 ? "good" : "");
          parts.push(
            `<div class="trip-balance-row" style="display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid rgba(0,0,0,0.04);">
              <span class="trip-balance-name">${escapeHTML(mem.name)}${mem.isMe ? " (moi)" : ""}</span>
              <strong class="trip-balance-amount ${cls}">${_fmtMoney(v, cur)}</strong>
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
        const receive = [];
        const pay = [];
        for (const row of settlementSuggestionsRaw) {
          const cur = String(row.out_currency || row.currency || "").toUpperCase();
          const fromId = row.from_member_id || row.fromMemberId;
          const toId = row.to_member_id || row.toMemberId;
          const amt = Number(row.amount || 0);
          if (!cur || !fromId || !toId || !(amt > 0)) continue;
          const line = `<div class="tb-share-row"><span>${escapeHTML(_memName(fromId))} → ${escapeHTML(_memName(toId))}</span><strong>${_fmtMoney(amt, cur)}</strong></div>`;
          if (me && toId === me.id) receive.push(line); else if (me && fromId === me.id) pay.push(line); else pay.push(line);
        }
      }

      const hasAny = (() => {
        for (const [, transfers] of settlementsByCur.entries()) if (transfers?.length) return true;
        return false;
      })();
      const tripUiEn = typeof window.tbGetLang === 'function' && window.tbGetLang() === 'en';
      const stxt = (fr, en) => tripUiEn ? en : fr;

      // Share / copy controls (even if no settlements)
      parts.push(`<div style="display:flex; gap:8px; align-items:center; margin-top:10px; flex-wrap:wrap;">
        <button class="btn" id="trip-copy-settlements" type="button">${escapeHTML(stxt("Copier les règlements", "Copy settlements"))}</button>
        <button class="btn" id="trip-share-settlements" type="button">${escapeHTML(stxt("Partager", "Share"))}</button>
        <span class="muted">${escapeHTML(hasAny ? stxt("Format simple", "Simple format") : stxt("Rien à régler pour l'instant", "Nothing to settle for now"))}</span>
      </div>`);

      if (hasAny) for (const [cur, transfers] of settlementsByCur.entries()) {
        if (!transfers.length) continue;
        parts.push(`<div class="muted" style="margin-top:10px;">${escapeHTML(stxt("Règlements suggérés", "Suggested settlements"))} • ${escapeHTML(cur)}</div>`);
        for (const t of transfers) {
          const from = members.find(x => x.id === t.fromId);
          const to = members.find(x => x.id === t.toId);

          const isMeInvolved = !!me && (t.fromId === me.id || t.toId === me.id);
          let actionBtn = "";
          let actionOnlyBtn = "";

          // Wallet-based settlement only makes sense when I am involved (it creates a Budget transaction in MY wallets).
          if (isMeInvolved) {
            const actionLabel = (t.fromId === me.id) ? `${escapeHTML(stxt("Je paie", "I pay"))} ${escapeHTML(to?.name || "—")}` : `${escapeHTML(stxt("Je reçois de", "I receive from"))} ${escapeHTML(from?.name || "—")}`;
            actionBtn = `<button class="btn" type="button"
                          data-settle-from="${t.fromId}"
                          data-settle-to="${t.toId}"
                          data-settle-cur="${escapeHTML(cur)}"
                          data-settle-amt="${t.amount}">${actionLabel}</button>`;
          }

          // NEW: allow recording a manual settlement even when neither side is "me" (tiers ↔ tiers).
          // This only records a trip_settlement_event, and does NOT touch wallets.
          if (canWrite) {
            const labelOnly = isMeInvolved ? stxt("Solder (sans wallet)", "Settle (without wallet)") : stxt("Marquer comme réglé", "Mark as settled");
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
        parts.push(`<div class="muted" style="margin-top:14px;">${escapeHTML(stxt("Historique règlements", "Settlement history"))}</div>`);
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


    const tripAnalysis = _buildTripAnalysis(expenses, members, tripState.shares || []);
    const tripAnalysisHTML = _tripAnalysisBarsHTML(tripAnalysis);


    const tripOptions = tripState.trips
      .map(t => `<option value="${t.id}" ${t.id === tripState.activeTripId ? "selected" : ""}>${escapeHTML(t.name)}${t.closed_at ? " · clos" : ""}</option>`)
      .join("");
    const closedDate = tripClosed ? String(trip?.closed_at || "").slice(0, 10) : "";
    const tripStatusHTML = trip
      ? `<div style="margin-top:8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <span class="pill" style="${tripClosed ? "background:rgba(34,197,94,.14);border-color:rgba(34,197,94,.35);color:#047857;" : "background:rgba(59,130,246,.12);border-color:rgba(59,130,246,.32);color:#1d4ed8;"}font-weight:800;">
            ${escapeHTML(tripClosed
              ? ((typeof window.tbGetLang === 'function' && window.tbGetLang() === 'en') ? "Closed / frozen" : "Clos / fige")
              : ((typeof window.tbGetLang === 'function' && window.tbGetLang() === 'en') ? "Active / live rates" : "Actif / taux vivants"))}
          </span>
          <span class="muted" style="font-size:12px;">
            ${escapeHTML(tripClosed
              ? (((typeof window.tbGetLang === 'function' && window.tbGetLang() === 'en') ? "Snapshot date: " : "Snapshot du : ") + closedDate)
              : ((typeof window.tbGetLang === 'function' && window.tbGetLang() === 'en') ? "Balances still move with expenses and FX." : "Les balances evoluent encore avec les depenses et les taux."))}
          </span>
        </div>`
      : "";

    const memberOptions = members
      .map(m => {
        const meTag = m.isMe ? " (moi)" : "";
        const emailTag = m.email ? ` — ${escapeHTML(m.email)}` : "";
        return `<option value="${m.id}">${escapeHTML(m.name)}${meTag}${emailTag}</option>`;
      })
      .join("");

    const walletOptions = _activeWallets()
      .map(w => `<option value="${w.id}">${escapeHTML(w.name)} (${escapeHTML(w.currency)})</option>`)
      .join("");

    const categoryOptions = (getCategories() || [])
      .map(c => `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`)
      .join("");

    const tripTxMap = _txByIdMap();
    const membersById = new Map(members.map((m) => [String(m.id), m]));
    const sharesByExpenseForHistory = _groupBy(tripState.shares || [], (row) => row.expenseId);
    const historyFilters = _tripHistoryFilterState();
    const historyCategoryOptions = Array.from(new Set(expenses.map((ex) => _tripAnalysisCategoryKey(ex, tripTxMap)).filter(Boolean))).sort((a,b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
    const filteredExpenses = expenses.filter((ex) => _tripHistoryMatch(ex, tripTxMap, membersById, sharesByExpenseForHistory, historyFilters));
    const linkIssues = Array.isArray(tripState.linkIssues) ? tripState.linkIssues : [];
    const linkIssueExpenseIds = new Set(linkIssues.map((issue) => String(issue?.expenseId || "")).filter(Boolean));
    const linkAuditHTML = window.UI?.tripView?.renderTripLinkAuditCard({
      count: linkIssues.length,
      title: _tripT("trip.linked.audit_title"),
      body: _tripT("trip.linked.audit_body", { count: linkIssues.length }),
      escapeHTML,
    }) || "";

const tripDocCountsByExpense = new Map();

try {
  const visibleExpenseIds = filteredExpenses.map(ex => ex.id).filter(Boolean);

  const offlineDocs = await _tripShouldUseOfflineMode("trip:documentCounts");
  if (!offlineDocs && visibleExpenseIds.length) {
    const { data: docLinkRows, error: docLinkErr } = await sb
      .from((TB_CONST?.TABLES?.trip_expense_documents) || "trip_expense_documents")
      .select("expense_id")
      .in("expense_id", visibleExpenseIds);

    if (!docLinkErr) {
      for (const row of (docLinkRows || [])) {
        const id = String(row.expense_id || "");
        if (!id) continue;
        tripDocCountsByExpense.set(id, (tripDocCountsByExpense.get(id) || 0) + 1);
      }
    }
  }
} catch (e) {
  console.warn("[Trip] document counts failed", e);
}

    const expensesHTML = filteredExpenses.length
      ? await Promise.all(filteredExpenses.map(async ex => {
          const payer = members.find(m => m.id === ex.paidByMemberId);
          const moveUI = ""; // removed move between trips
          const isLinked = await _expenseIsEditLocked(ex);
          const hasShareBudgetLink = (tripState.budgetLinks || []).some((row) => String(row?.expenseId || '') === String(ex.id || '') && row?.transactionId);
          const linkedBadges = [
            ex.transactionId ? `<span class="trip-badge">${escapeHTML(_tripT("trip.linked.main_transaction"))}</span>` : '',
            hasShareBudgetLink ? `<span class="trip-badge">${escapeHTML(_tripT("trip.linked.share_transaction"))}</span>` : '',
            linkIssueExpenseIds.has(String(ex.id || "")) ? `<span class="trip-badge" style="background:rgba(245,158,11,.18);border-color:rgba(245,158,11,.45);">Audit</span>` : ''
          ].filter(Boolean).join('');
          const resolvedCategory = _tripAnalysisCategoryKey(ex, tripTxMap);
          const resolvedSubcategory = String(ex.subcategory || '').trim();
          const budgetWindowLabel = (ex.budgetDateStart || ex.budgetDateEnd)
            ? ` • budget ${escapeHTML(ex.budgetDateStart || ex.date || '—')} → ${escapeHTML(ex.budgetDateEnd || ex.budgetDateStart || ex.date || '—')}`
            : '';
          const shareRows = sharesByExpenseForHistory.get(ex.id) || [];
          const participantNames = shareRows.map((row) => membersById.get(String(row.memberId))?.name).filter(Boolean);
          const participantLabel = participantNames.length ? ` • participants: ${escapeHTML(participantNames.join(', '))}` : '';
          const editBtn = canWrite ? `<button class="btn" type="button" data-edit-exp="${ex.id}" title="${isLinked ? "Édition complète (wallet/budget inclus)" : "Modifier"}">Modifier</button>` : "";
return `
            <div class="trip-history-row" data-trip-expense-row="${escapeHTML(String(ex.id || ""))}">
              <div class="trip-history-copy">
                <div class="trip-history-title">${escapeHTML(ex.label)}<span class="trip-badge">${escapeHTML(resolvedCategory || 'Autre')}</span>${resolvedSubcategory ? `<span class="trip-badge">${escapeHTML(resolvedSubcategory)}</span>` : ''}${linkedBadges}</div>
                <div class="muted" style="font-size:12px;">${escapeHTML(ex.date)}${payer ? ` • payé par ${escapeHTML(payer.name)}` : ""}${budgetWindowLabel}</div>
                ${participantNames.length ? `<div class="trip-history-participants">${participantNames.map((name) => `<span class="trip-participant-pill">${escapeHTML(name)}</span>`).join('')}</div>` : ''}
              </div>
              <div class="trip-history-actions">
                <strong class="trip-history-amount">${_fmtMoney(ex.amount, ex.currency)}</strong>
                ${moveUI}
                <button class="btn" type="button" data-exp-detail="${ex.id}">Détail</button>
                <button class="btn" type="button" data-exp-docs="${ex.id}">
                  📎 Docs${tripDocCountsByExpense.get(String(ex.id)) ? ` (${tripDocCountsByExpense.get(String(ex.id))})` : ""}
                </button>
                ${editBtn}
                ${canWrite ? `<button class="btn danger" type="button" data-del-exp="${ex.id}">Supprimer</button>` : ""}
              </div>
            </div>
          `;
        }))
      : [`<div class="muted">Aucune dépense pour ces filtres.</div>`];

    const expensesHTMLJoined = Array.isArray(expensesHTML) ? expensesHTML.join("") : expensesHTML;

    const editExpenseModalHTML = (editingExpenseId || addExpenseOpen)
      ? _expenseFormHTML({ editingExpenseId, editingDraft, trip, canWrite, memberOptions, walletOptions, categoryOptions, modal: true })
      : "";
    const memberPillsHTML = members.length
      ? `<div class="trip-mobile-member-pills">${members.map(m => `<span class="trip-participant-pill">${escapeHTML(m.name)}${m.isMe ? ` · ${escapeHTML((typeof window.tbGetLang === 'function' && window.tbGetLang() === 'en') ? "me" : "moi")}` : ""}</span>`).join("")}</div>`
      : `<div class="muted">Aucun participant.</div>`;
    const tripManageSummary = escapeHTML((typeof window.tbGetLang === 'function' && window.tbGetLang() === 'en') ? "Manage split" : "Gerer le partage");
    const tripQuickAddLabel = escapeHTML((typeof window.tbGetLang === 'function' && window.tbGetLang() === 'en') ? "+ Shared expense" : "+ Depense partagee");

    root.innerHTML = `
      ${globalNetHTML}
      ${pendingInvitesHTML}
      ${tripClosed ? `<div class="card" style="margin-bottom:12px;border-color:rgba(34,197,94,.35);background:rgba(34,197,94,.08);">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
          <div>
            <h2 style="margin:0 0 4px 0;">${escapeHTML((typeof window.tbGetLang === 'function' && window.tbGetLang() === 'en') ? "Closed split" : "Partage clos")}</h2>
            <div class="muted">${escapeHTML((typeof window.tbGetLang === 'function' && window.tbGetLang() === 'en') ? "Balances are frozen from the closing snapshot." : "Les balances sont figées depuis le snapshot de clôture.")} ${escapeHTML(String(trip.closed_at || "").slice(0, 10))}</div>
          </div>
          ${myRole !== "viewer" ? `<button class="btn" id="trip-reopen" type="button">${escapeHTML((typeof window.tbGetLang === 'function' && window.tbGetLang() === 'en') ? "Reopen" : "Réouvrir")}</button>` : ""}
        </div>
      </div>` : ""}
      <div class="grid">
        <div class="card">
          <div class="trip-mobile-title-row">
            <div>
              <h2>${escapeHTML(_tripT("trip.title"))}</h2>
              ${memberPillsHTML}
            </div>
            <button class="btn primary trip-mobile-add-expense" type="button" data-trip-open-add-exp ${trip && canWrite ? "" : "disabled"}>${tripQuickAddLabel}</button>
          </div>
          <details class="trip-manage-panel" ${isTripMobileApp ? "" : "open"}>
            <summary>${tripManageSummary}</summary>
          <div class="row" style="margin-bottom:10px;">
            <div class="field" style="min-width:260px;">
              <label>${escapeHTML(_tripT("trip.active"))}</label>
              <select id="trip-active">${tripOptions || ""}</select>
              ${tripStatusHTML}
            </div>
            <div class="field" style="flex:1;">
              <label>${escapeHTML(_tripT("trip.new"))}</label>
              <input id="trip-new-name" placeholder="Ex: Laos" />
            </div>
            <div class="field" style="align-self:flex-end;">
              <button class="btn primary" id="trip-create">${escapeHTML(_tripT("trip.create"))}</button>
            </div>
            <div class="field" style="align-self:flex-end;">
              <button class="btn danger" id="trip-delete" ${trip ? "" : "disabled"}>${escapeHTML(_tripT("trip.delete"))}</button>
            </div>
            <div class="field" style="align-self:flex-end;">
              ${tripClosed
                ? `<button class="btn" id="trip-reopen-inline" ${trip && myRole !== "viewer" ? "" : "disabled"}>${escapeHTML((typeof window.tbGetLang === 'function' && window.tbGetLang() === 'en') ? "Reopen / unfreeze" : "Reouvrir / defiger")}</button>`
                : `<button class="btn" id="trip-close" ${trip && myRole !== "viewer" ? "" : "disabled"}>${escapeHTML((typeof window.tbGetLang === 'function' && window.tbGetLang() === 'en') ? "Close / freeze" : "Clore / figer")}</button>`}
            </div>
          </div>

          <h2 style="margin-top:14px;">${escapeHTML(_tripT("trip.participants"))}</h2>
          <div class="row" style="margin-bottom:10px;">
            <div class="field" style="flex:1;">
              <label>${escapeHTML(_tripT("trip.member.name"))}</label>
              <input id="trip-member-name" placeholder="Ex: Paul" />
            </div>
            <div class="field" style="min-width:240px;">
              <label>${escapeHTML(_tripT("trip.member.email"))}</label>
              <input id="trip-member-email" placeholder="ex: paul@email.com" />
            </div>
            <div class="field" style="align-self:flex-end;">
              <button class="btn" id="trip-add-member" ${trip && !tripClosed ? "" : "disabled"}>${escapeHTML(_tripT("trip.member.add"))}</button>
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
                ${canWrite && !m.isMe ? `<button class="btn" type="button" data-resend-invite="${m.id}">${escapeHTML((typeof window.tbGetLang === 'function' && window.tbGetLang() === 'en') ? "Resend invite" : "Renvoyer invitation")}</button>` : ``}
                ${canWrite ? `<button class="btn" type="button" data-rename-member="${m.id}">${escapeHTML(_tripT("trip.member.rename"))}</button>` : ``}
                ${canWrite ? `<button class="btn danger" data-del-member="${m.id}">${escapeHTML(_tripT("trip.delete"))}</button>` : ``}
              </div>
            `).join("") : `<div class="muted">Aucun participant.</div>`}
          </div>
          </details>
        </div>

        ${editingExpenseId
          ? `<div class="card"><h2>${escapeHTML(_tripT("trip.expense"))}</h2><div class="muted">${escapeHTML(_tripT("trip.expense.quick_hint"))}</div></div>`
          : (isTripMobileApp
              ? `<div class="card trip-mobile-expense-launcher">
                  <h2>${escapeHTML(_tripT("trip.expense"))}</h2>
                  <div class="muted">${escapeHTML(_tripT("trip.expense.quick_hint"))}</div>
                  <button class="btn primary" type="button" data-trip-open-add-exp ${trip && canWrite ? "" : "disabled"}>${tripQuickAddLabel}</button>
                </div>`
              : _expenseFormHTML({ editingExpenseId, editingDraft, trip, canWrite, memberOptions, walletOptions, categoryOptions, modal: false }))}
      </div>
      ${linkAuditHTML}

      <div class="card" style="margin-top:12px;">
        <div style="display:flex; gap:8px; align-items:center; justify-content:space-between; flex-wrap:wrap;">
          <h2 style="margin:0;">${escapeHTML((typeof window.tbGetLang === 'function' && window.tbGetLang() === 'en') ? "Recap / History" : "Récap / Historique")}</h2>
          ${(window.UI?.tripView?.renderTripTabs || ((options) => `
            <div class="trip-tabs">
              <button class="btn primary" id="trip-tab-recap" type="button">${escapeHTML(options.recapLabel)}</button>
              <button class="btn trip-tab-btn" id="trip-tab-history" type="button">${escapeHTML(options.historyLabel)}</button>
            </div>`))({
              recapLabel: _tripT("trip.tabs.recap"),
              historyLabel: _tripT("trip.tabs.history"),
              escapeHTML,
            })}
        </div>

        <div id="trip-tab-content-recap" style="margin-top:10px; display:grid; gap:14px;">
          <div style="display:flex; gap:14px; align-items:flex-start; flex-wrap:wrap;">
            <div style="flex:1 1 260px; min-width:260px;">
              <h3 style="margin:0 0 8px 0;">${escapeHTML(_tripT("trip.balances"))}</h3>
              ${balHTML}
            </div>
            <div style="flex:2 1 320px; min-width:320px;">
              ${settlementsHTML}
            </div>
          </div>
          ${tripAnalysisHTML}
        </div>

        <div id="trip-tab-content-history" style="margin-top:10px; display:none;">
          <div class="card trip-history-toolbar">
            <div class="muted trip-history-toolbar-copy">Filtres d'audit du trip actif. Ils ne portent que sur l'historique du partage sélectionné.</div>
            <div class="trip-filter-grid">
              <div class="field"><label>${escapeHTML(_tripT("trip.history.category"))}</label><select id="trip-hist-category"><option value="">${escapeHTML(_tripT("common.all"))}</option>${historyCategoryOptions.map((cat) => `<option value="${escapeHTML(cat)}" ${historyFilters.category === cat ? 'selected' : ''}>${escapeHTML(cat)}</option>`).join('')}</select></div>
              <div class="field"><label>${escapeHTML(_tripT("trip.history.payer"))}</label><select id="trip-hist-payer"><option value="">${escapeHTML(_tripT("common.all_m"))}</option>${members.map((m) => `<option value="${m.id}" ${historyFilters.payer === String(m.id) ? 'selected' : ''}>${escapeHTML(m.name)}</option>`).join('')}</select></div>
              <div class="field"><label>${escapeHTML(_tripT("trip.history.participant"))}</label><select id="trip-hist-participant"><option value="">${escapeHTML(_tripT("common.all_m"))}</option>${members.map((m) => `<option value="${m.id}" ${historyFilters.participant === String(m.id) ? 'selected' : ''}>${escapeHTML(m.name)}</option>`).join('')}</select></div>
              <div class="field"><label>${escapeHTML(_tripT("trip.history.date_from"))}</label><input id="trip-hist-date-from" type="date" value="${escapeHTML(historyFilters.dateFrom)}" /></div>
              <div class="field"><label>${escapeHTML(_tripT("trip.history.date_to"))}</label><input id="trip-hist-date-to" type="date" value="${escapeHTML(historyFilters.dateTo)}" /></div>
              <div class="field"><label>${escapeHTML(_tripT("trip.history.amount_min"))}</label><input id="trip-hist-amount-min" type="number" step="0.01" value="${escapeHTML(historyFilters.amountMin)}" placeholder="0" /></div>
              <div class="field"><label>${escapeHTML(_tripT("trip.history.amount_max"))}</label><input id="trip-hist-amount-max" type="number" step="0.01" value="${escapeHTML(historyFilters.amountMax)}" placeholder="0" /></div>
              <div class="field"><label>${escapeHTML(_tripT("trip.history.search"))}</label><input id="trip-hist-q" type="text" value="${escapeHTML(historyFilters.q)}" placeholder="${escapeHTML(_tripT("trip.history.search_placeholder"))}" /></div>
            </div>
            <div style="display:flex; gap:8px; margin-top:10px; flex-wrap:wrap;">
              <button class="btn" type="button" id="trip-hist-apply">${escapeHTML(_tripT("trip.history.apply"))}</button>
              <button class="btn" type="button" id="trip-hist-reset" style="background:#fff; color:#111; border:1px solid rgba(0,0,0,0.15);">${escapeHTML(_tripT("trip.history.reset"))}</button>
              <span class="muted">${filteredExpenses.length} / ${expenses.length} ${escapeHTML((typeof window.tbGetLang === 'function' && window.tbGetLang() === 'en') ? "expense(s)" : "dépense(s)")}</span>
            </div>
          </div>
          ${expensesHTMLJoined}
        </div>
      </div>
      ${editExpenseModalHTML}
    `;

    const expenseModalTemplate = _el("trip-expense-modal-template");
    if (expenseModalTemplate) {
      if (!window.UI?.createModal) throw new Error("Composant de fenetre indisponible.");
      _tripExpenseEditorModal = window.UI.createModal({
        id: "trip-expense-editor-modal",
        size: "xl",
        panelClass: "tb-trip-shared-modal tb-trip-expense-modal",
        title: expenseModalTemplate.dataset.title || _tripT("trip.expense"),
        subtitle: editingExpenseId ? _tripT("trip.expense.edit_hint") : _tripT("trip.expense.quick_hint"),
        contentHTML: expenseModalTemplate.innerHTML,
        initialFocus: "#trip-exp-label",
        closeLabel: "Fermer",
        onClose: async () => {
          _tripExpenseEditorModal = null;
          try {
            if (tripState.editingExpenseId) await _cancelEditExpense();
            else if (tripState.addExpenseOpen) {
              tripState.addExpenseOpen = false;
              await _renderUI();
            }
          } catch (error) {
            toastWarn(error?.message || String(error));
          }
        }
      });
      expenseModalTemplate.remove();
    } else if (_tripExpenseEditorModal) {
      _tripExpenseEditorModal.destroy();
      _tripExpenseEditorModal = null;
    }

    _renderTripContextHelp(root);

    if (editingDraft) {
      const paidSelInit = _el("trip-exp-paidby");
      if (paidSelInit && editingDraft.paidByMemberId) paidSelInit.value = editingDraft.paidByMemberId;
      const walletSelInit = _el("trip-exp-wallet");
      if (walletSelInit && editingDraft.walletId) walletSelInit.value = editingDraft.walletId;
      const catSelInit = _el("trip-exp-category");
      if (catSelInit && editingDraft.category) catSelInit.value = editingDraft.category;
      _tripBindExpenseSubcategoryUi(editingDraft.subcategory || '');
      const budgetStartInit = _el("trip-exp-budget-start");
      const budgetEndInit = _el("trip-exp-budget-end");
      if (budgetStartInit && editingDraft.budgetDateStart) budgetStartInit.value = editingDraft.budgetDateStart;
      if (budgetEndInit && editingDraft.budgetDateEnd) budgetEndInit.value = editingDraft.budgetDateEnd;
      const outSelInit = _el("trip-exp-out");
      if (outSelInit) outSelInit.value = editingDraft.outOfBudget ? "yes" : "no";
      const splitModeInit = _el("trip-split-mode");
      if (splitModeInit && editingDraft.split?.mode) splitModeInit.value = editingDraft.split.mode;
    } else {
      _tripBindExpenseSubcategoryUi('');
    }

    const sel = _el("trip-active");
    if (sel) {
      sel.onchange = async () => {
        _setActiveTripId(sel.value || null);
        if (typeof window.__tripRefresh === "function") await window.__tripRefresh({ activeOnly: true });
};
    }


    // Tabs: Récap / Historique (balances on left, settlements on right)
    const btnTabRecap = _el("trip-tab-recap");
    const btnTabHist = _el("trip-tab-history");
    const boxRecap = _el("trip-tab-content-recap");
    const boxHist = _el("trip-tab-content-history");

    function _setTripTab(tab) {
      const t = _setTripStoredTab(tab);
      if (boxRecap) boxRecap.style.display = (t === "recap") ? "" : "none";
      if (boxHist) boxHist.style.display = (t === "history") ? "" : "none";
      if (btnTabRecap) {
        btnTabRecap.classList.toggle("primary", t === "recap");
        btnTabRecap.classList.toggle("trip-tab-btn", t !== "recap");
        btnTabRecap.style.cssText = "";
      }
      if (btnTabHist) {
        btnTabHist.classList.toggle("primary", t === "history");
        btnTabHist.classList.toggle("trip-tab-btn", t !== "history");
        btnTabHist.style.cssText = "";
      }
    }

    if (btnTabRecap) btnTabRecap.onclick = () => _setTripTab("recap");
    if (btnTabHist) btnTabHist.onclick = () => _setTripTab("history");

    const applyHist = _el('trip-hist-apply');
    if (applyHist) applyHist.onclick = async () => {
      tripState.historyFilters = {
        category: _el('trip-hist-category')?.value || '',
        payer: _el('trip-hist-payer')?.value || '',
        participant: _el('trip-hist-participant')?.value || '',
        dateFrom: _el('trip-hist-date-from')?.value || '',
        dateTo: _el('trip-hist-date-to')?.value || '',
        amountMin: _el('trip-hist-amount-min')?.value || '',
        amountMax: _el('trip-hist-amount-max')?.value || '',
        q: _el('trip-hist-q')?.value || '',
      };
      await _renderUI();
      _setTripTab('history');
    };
    const resetHist = _el('trip-hist-reset');
    if (resetHist) resetHist.onclick = async () => {
      tripState.historyFilters = {};
      await _renderUI();
      _setTripTab('history');
    };

    let initialTab = _readTripStoredTab();
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

    const btnClose = _el("trip-close");
    if (btnClose) {
      btnClose.onclick = async () => {
        try {
          if (!tripState.activeTripId) return toastWarn("[Trip] Sélectionne un trip d'abord.");
          if (!confirm("Clore ce trip et figer les balances actuelles ?")) return;
          const { error } = await sb
            .from(TB_CONST.TABLES.trip_groups)
            .update({
              closed_at: new Date().toISOString(),
              closed_by: sbUser?.id || null,
              close_snapshot: tripState._lastCloseSnapshot || {},
            })
            .eq("id", tripState.activeTripId);
          if (error) throw error;
          if (typeof window.__tripRefresh === "function") await window.__tripRefresh({ activeOnly: true });
          toastOk("Trip clos et snapshot figé.");
        } catch (e) {
          toastWarn(e?.message || String(e));
        }
      };
    }

    const btnReopen = _el("trip-reopen");
    const btnReopenInline = _el("trip-reopen-inline");
    const handleReopenTrip = async () => {
      try {
        if (!tripState.activeTripId) return;
        if (!confirm("Réouvrir ce trip ? Les balances redeviendront dynamiques.")) return;
        const { error } = await sb
          .from(TB_CONST.TABLES.trip_groups)
          .update({ closed_at: null, closed_by: null, close_snapshot: null })
          .eq("id", tripState.activeTripId);
        if (error) throw error;
        if (typeof window.__tripRefresh === "function") await window.__tripRefresh({ activeOnly: true });
        toastOk("Trip réouvert.");
      } catch (e) {
        toastWarn(e?.message || String(e));
      }
    };
    if (btnReopen) {
      btnReopen.onclick = async () => {
        await handleReopenTrip();
      };
    }
    if (btnReopenInline) btnReopenInline.onclick = handleReopenTrip;

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

    root.querySelectorAll("[data-accept-pending-invite]").forEach(btn => {
      btn.onclick = async () => {
        try {
          const token = btn.getAttribute("data-accept-pending-invite");
          if (!token) return;
          btn.disabled = true;
          await _rpcAcceptInvite(token);
          tripState.pendingInvites = (tripState.pendingInvites || []).filter((row) => String(row?.token || "") !== String(token));
          _syncTripInviteNotification(tripState.pendingInvites);
          tripState._tripsLoaded = false;
          if (typeof window.__tripRefresh === "function") await window.__tripRefresh({ forceTrips: true });
          toastOk("[Trip] Invitation acceptée.");
        } catch (e) {
          toastWarn(e?.message || "[Trip] Invitation invalide/expirée.");
        } finally {
          try { btn.disabled = false; } catch (_) {}
        }
      };
    });

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

    root.querySelectorAll("[data-resend-invite]").forEach(btn => {
      btn.onclick = async () => {
        try {
          const id = btn.getAttribute("data-resend-invite");
          if (!id) return;
          const invite = await _sendInviteForExistingMember(id);
          if (!invite) return;
          if (typeof window.__tripRefresh === "function") await window.__tripRefresh({ activeOnly: true });
          toastOk(`Invitation prete pour ${invite.email}. Lien copie.`);
        } catch (e) {
          toastWarn(e?.message || String(e));
        }
      };
    });


    function _syncExpenseWalletUI() {
      const paidSel = _el("trip-exp-paidby");
      const wSel = _el("trip-exp-wallet");
      const curSel = _el("trip-exp-currency");
      const curHelp = _el("trip-exp-currency-help");
      if (!paidSel || !wSel || !curSel) return;

      const payer = members.find(m => m.id === paidSel.value) || null;
      const isMe = !!payer?.isMe;
      const wallets = _activeWallets();
      const selectedWallet = wallets.find(w => String(w.id || "") === String(wSel.value || "")) || null;

      wSel.disabled = !isMe;
      curSel.disabled = false;

      if (!isMe) {
        const currentCur = _normalizeCurrency(curSel.value || trip?.base_currency || state?.period?.baseCurrency || "THB");
        wSel.value = "";
        curSel.innerHTML = _tripCurrencyOptionsHTML(currentCur);
        curSel.value = currentCur;
        curSel.disabled = false;
        if (curHelp) curHelp.textContent = "Payé par un autre participant : choisis la devise dans la liste.";
        return;
      }

      if (!wallets.length) {
        if (curHelp) curHelp.textContent = "Aucune wallet disponible : crée une wallet avant de saisir une dépense payée par toi.";
        return;
      }

      if (!selectedWallet) {
        const cur = _normalizeCurrency(curSel.value);
        const match = wallets.find(w => _normalizeCurrency(w?.currency) === cur) || wallets[0] || null;
        if (match) wSel.value = match.id;
      }

      const wallet = wallets.find(w => String(w.id || "") === String(wSel.value || "")) || null;
      const walletCur = _normalizeCurrency(wallet?.currency);
      if (walletCur) {
        curSel.innerHTML = `<option value="${escapeHTML(walletCur)}" selected>${escapeHTML(walletCur)}</option>`;
        curSel.value = walletCur;
        curSel.disabled = true;
      } else {
        const currentCur = _normalizeCurrency(curSel.value || trip?.base_currency || state?.period?.baseCurrency || "THB");
        curSel.innerHTML = _tripCurrencyOptionsHTML(currentCur);
        curSel.value = currentCur;
      }

      if (curHelp) {
        curHelp.textContent = walletCur
          ? `Payé par moi : devise imposée par la wallet sélectionnée (${walletCur}).`
          : "Payé par moi : sélectionne une wallet pour imposer la devise.";
      }
    }

    // Split UI (equal / percent / amount)
function _renderSplitParticipantsBox() {
  const box = _el("trip-split-participants-box");
  if (!box) return;

  const members = tripState.members || [];
  box.innerHTML = window.UI?.tripView?.renderTripSplitParticipants({
    members,
    selectedMemberIds: tripState.editingExpenseDraft?.split?.selectedMemberIds,
    escapeHTML,
  }) || "";

  box.querySelectorAll("[data-trip-split-member]").forEach(input => {
    input.onchange = () => _renderSplitBox();
  });
}

function _selectedSplitMemberIds() {
  const checked = Array.from(document.querySelectorAll("[data-trip-split-member]:checked"))
    .map(el => String(el.getAttribute("data-trip-split-member") || ""))
    .filter(Boolean);

  return checked;
}

function _renderSplitBox() {
      const box = _el("trip-split-box");
      if (!box) return;
      const mode = (_el("trip-split-mode")?.value || "equal");
      const members = tripState.members || [];
const selectedIds = _selectedSplitMemberIds();
const selectedSet = new Set(selectedIds);
const activeMembers = members.filter(m => selectedSet.has(String(m.id)));
const amt = Number(_el("trip-exp-amount")?.value || 0);

      // Preserve current inputs if re-rendering
      const prevPct = {};
      const prevAmt = {};
      members.forEach(m => {
        const p = _el(`trip-split-pct-${m.id}`)?.value;
        const amtInput = _el(`trip-split-amt-${m.id}`);
        const a = amtInput && amtInput.dataset.auto !== "1" ? amtInput.value : undefined;
        if (p !== undefined) prevPct[m.id] = p;
        if (a !== undefined) prevAmt[m.id] = a;
      });

      const seedAmounts = members.reduce((acc, m) => {
        const seedAmt = editingDraft?.split?.amounts?.[m.id];
        acc[m.id] = prevAmt[m.id] ?? seedAmt ?? "";
        return acc;
      }, {});
      let autoParts = [];
      if (mode !== "amount") {
        box.dataset.auto = "0";
      }

      if (mode === "amount") {
        box.dataset.auto = "1";
        autoParts = _computeSplitParts(amt, members, {
          mode: "amount_auto",
          selectedMemberIds: selectedIds,
          amounts: seedAmounts,
        });
      }

      box.innerHTML = window.UI?.tripView?.renderTripSplitBox({
        mode,
        members,
        selectedMemberIds: selectedIds,
        activeCount: activeMembers.length,
        amountAutoParts: autoParts,
        previousPercents: prevPct,
        previousAmounts: prevAmt,
        seedPercents: editingDraft?.split?.percents || {},
        seedAmounts,
        escapeHTML,
      }) || "";

      if (mode === "amount") {
        members.forEach(m => {
          const input = _el(`trip-split-amt-${m.id}`);
          if (input && !input.disabled) {
            input.oninput = () => { input.dataset.auto = "0"; };
            input.onchange = _renderSplitBox;
            input.onblur = _renderSplitBox;
          }
        });
        return;
      }
      return;
    }

    const splitModeSel = _el("trip-split-mode");
    if (splitModeSel) splitModeSel.onchange = _renderSplitBox;

    const amtInp = _el("trip-exp-amount");
    if (amtInp) amtInp.oninput = () => {
      const mode = (_el("trip-split-mode")?.value || "equal");
      if (mode === "amount") _renderSplitBox();
    };

    _renderSplitParticipantsBox();
    _renderSplitBox();

    const btnAddExp = _el("trip-add-exp");
    if (btnAddExp) {
      btnAddExp.onclick = async () => {
  if (tripState._expenseSaving) return;
  try {
    tripState._expenseSaving = true;
    btnAddExp.disabled = true;

    const date = _el("trip-exp-date").value;
    const label = _el("trip-exp-label").value.trim();
    const amount = _el("trip-exp-amount").value;
    const currency = _tripResolveExpenseCurrency();
    const paidByMemberId = _el("trip-exp-paidby").value;
    const walletId = _el("trip-exp-wallet")?.value || "";
    const category = _el("trip-exp-category")?.value || "Autre";
    const subcategory = String(_el("trip-exp-subcategory")?.value || '').trim() || '';
    const budgetDateStart = _el("trip-exp-budget-start")?.value || date;
    const budgetDateEnd = _el("trip-exp-budget-end")?.value || budgetDateStart || date;
    const outOfBudget = (_el("trip-exp-out")?.value || "no") === "yes";
    const split = (() => {
      const mode = (_el("trip-split-mode")?.value || "equal");
      const members = (tripState.members || []);
      const selectedMemberIds = _selectedSplitMemberIds();
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
      return {
  mode: mode === "amount" && _el("trip-split-box")?.dataset?.auto === "1" ? "amount_auto" : mode,
  percents,
  amounts,
  selectedMemberIds
};
    })();

    if (editingExpenseId) {
      const expenseForm = { date, label, amount, currency, paidByMemberId, walletId, category, subcategory, budgetDateStart, budgetDateEnd, outOfBudget, split };
      const offlineNow = (typeof window.tbShouldUseOfflineMode === "function")
        ? await window.tbShouldUseOfflineMode("trip:update_expense")
        : (typeof window.tbIsOfflineMode === "function" && window.tbIsOfflineMode());
      if (offlineNow) {
        await _queueTripExpenseMutation({ mode: "update", expenseId: editingExpenseId, form: expenseForm });
        tripState.editingExpenseId = null;
        tripState.editingExpenseDraft = null;
        await _renderUI();
        toastOk("Modification Trip en attente de synchro.");
        return;
      }
      const updatedExpenseId = await _updateExpense({
        expenseId: editingExpenseId,
        date,
        label,
        amount,
        currency,
        paidByMemberId,
        walletId,
        category,
        subcategory,
        budgetDateStart,
        budgetDateEnd,
        outOfBudget,
        split
      });
      await _refreshAfterTripMutation("trip:update_expense", { expectExpenseId: updatedExpenseId || editingExpenseId });
      toastOk("Dépense modifiée.");
    } else {
      const expenseForm = { date, label, amount, currency, paidByMemberId, walletId, category, subcategory, budgetDateStart, budgetDateEnd, outOfBudget, split };
      const offlineNow = (typeof window.tbShouldUseOfflineMode === "function")
        ? await window.tbShouldUseOfflineMode("trip:add_expense")
        : (typeof window.tbIsOfflineMode === "function" && window.tbIsOfflineMode());
      if (offlineNow) {
        await _queueTripExpenseMutation({ mode: "create", form: expenseForm });
        tripState.addExpenseOpen = false;
        await _renderUI();
        toastOk("Depense Trip en attente de synchro.");
        return;
      }
      const createdExpenseId = await _addExpense({
        date,
        label,
        amount,
        currency,
        paidByMemberId,
        walletId,
        category,
        subcategory,
        budgetDateStart,
        budgetDateEnd,
        outOfBudget,
        split
      });
      tripState.addExpenseOpen = false;
      await _refreshAfterTripMutation("trip:add_expense", { expectExpenseId: createdExpenseId });
      toastOk("Dépense ajoutée.");
    }
  } catch (e) {
    toastWarn(e?.message || String(e));
  } finally {
    tripState._expenseSaving = false;
    btnAddExp.disabled = false;
  }
};
    }

    const btnCancelEditExp = _el("trip-cancel-edit-exp");
    if (btnCancelEditExp) {
      btnCancelEditExp.onclick = async () => {
        try {
          if (editingExpenseId) await _cancelEditExpense();
          else {
            tripState.addExpenseOpen = false;
            await _renderUI();
          }
        } catch (e) {
          toastWarn(e?.message || String(e));
        }
      };
    }

    root.querySelectorAll("[data-trip-open-add-exp]").forEach(btn => {
      btn.onclick = async () => {
        try {
          tripState.addExpenseOpen = true;
          tripState.editingExpenseId = null;
          tripState.editingExpenseDraft = null;
          await _renderUI();
          setTimeout(() => { try { _el("trip-exp-label")?.focus(); } catch (_) {} }, 50);
        } catch (e) {
          toastWarn(e?.message || String(e));
        }
      };
    });

    const paidSel = _el("trip-exp-paidby");
    if (paidSel) paidSel.onchange = _syncExpenseWalletUI;

    const curInp = _el("trip-exp-currency");
    if (curInp) curInp.onchange = _syncExpenseWalletUI;

    const walletSel = _el("trip-exp-wallet");
    if (walletSel) walletSel.onchange = _syncExpenseWalletUI;

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
          if (typeof window.tbAfterMutationRefresh === "function") {
            await window.tbAfterMutationRefresh("trip:cancel_settlement", { trip: true });
          } else if (typeof window.__tripRefresh === "function") {
            await window.__tripRefresh({ activeOnly: true });
          }
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


root.querySelectorAll("[data-exp-docs]").forEach(btn => {
  btn.onclick = async () => {
    try {
      const id = btn.getAttribute("data-exp-docs");
      if (!id) return;
      await _openTripExpenseDocumentsModal(id);
    } catch (e) {
      toastWarn(e?.message || String(e));
    }
  };
});

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
          await _refreshAfterTripMutation("trip:delete_expense", { expectDeletedExpenseId: id });
          toastOk("Dépense supprimée.");
        } catch (e) {
          toastWarn(e?.message || String(e));
        }
      };
    });

    try {
      const focusId = String(window.__tbFocusTripExpenseId || "");
      if (focusId) {
        const safeId = (window.CSS && typeof CSS.escape === "function") ? CSS.escape(focusId) : focusId.replace(/"/g, '\\"');
        const row = root.querySelector(`[data-trip-expense-row="${safeId}"]`);
        const detailBtn = root.querySelector(`[data-exp-detail="${safeId}"]`);
        if (row) {
          window.__tbFocusTripExpenseId = "";
          row.scrollIntoView({ behavior: "smooth", block: "center" });
          row.style.boxShadow = "0 0 0 3px rgba(124,58,237,.35)";
          setTimeout(() => { try { row.style.boxShadow = ""; } catch (_) {} }, 2200);
        }
        if (detailBtn) setTimeout(() => { try { detailBtn.click(); } catch (_) {} }, 250);
      }
    } catch (_) {}

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

    if (tripState.activeTripId) _setActiveTripId(tripState.activeTripId);
    tripState.pendingInvites = await _loadPendingTripInvites();
    _syncTripInviteNotification(tripState.pendingInvites);
    await _loadActiveData();
    await _renderUI();
  }
    // Expose for modal callbacks
    window.__tripRefresh = refresh;
    window.tbTripEditExpense = async function tbTripEditExpense(expenseId, opts = {}) {
      const id = String(expenseId || '').trim();
      if (!id) throw new Error("Dépense introuvable.");
      const requestedTripId = String(opts?.tripId || '').trim();
      if (requestedTripId && requestedTripId !== String(tripState.activeTripId || '')) {
        _setActiveTripId(requestedTripId);
        await refresh({ activeOnly: true });
      } else if (!(tripState.expenses || []).some((ex) => String(ex?.id || '') === id)) {
        await refresh({ activeOnly: true });
      }
      await _beginEditExpense(id);
    };


  // Exposed function expected by navigation
  window.renderTrip = async function renderTrip() {
    const root = _root();
    if (!root) return;

    root.innerHTML = `<div class="card"><div class="muted">${escapeHTML(_tripT("common.loading"))}</div></div>`;
    try {
      const offline = await _tripShouldUseOfflineMode("trip:render");
      if (!offline) {
        await _ensureSession();
        await _acceptInviteFromURL();
      }
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

  try {
    window.tbOnLangChange = window.tbOnLangChange || [];
    if (!window.__tbTripLangBound) {
      window.__tbTripLangBound = true;
      window.tbOnLangChange.push(() => {
        try {
          if (typeof window.renderTrip === "function") window.renderTrip();
        } catch (_) {}
      });
    }
  } catch (_) {}
})();
