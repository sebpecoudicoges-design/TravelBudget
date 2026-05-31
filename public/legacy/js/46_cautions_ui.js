/* TravelBudget - Cautions
   Suivi des depots/cautions immobilises, sans mutation automatique des wallets. */
(function () {
  let CACHE = { rows: [], documents: [], folders: [], empty: true, demo: false };
  const HIDE_SETTLED_KEY = "travelbudget_cautions_hide_settled_v1";

  function esc(v) {
    try { return escapeHTML(String(v ?? "")); }
    catch (_) { return String(v ?? "").replace(/[&<>'"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c])); }
  }
  function atxt(fr, en) {
    try { return (typeof window.tbGetLang === "function" && window.tbGetLang() === "en") ? en : fr; }
    catch (_) { return fr; }
  }
  function table(name, fallback) {
    return (window.TB_CONST && window.TB_CONST.TABLES && window.TB_CONST.TABLES[name]) || fallback || name;
  }
  function client() {
    try { if (typeof sb !== "undefined" && sb && sb.from) return sb; } catch (_) {}
    try { if (window.sb && window.sb.from) return window.sb; } catch (_) {}
    return null;
  }
  function today() { return new Date().toISOString().slice(0, 10); }
  function n(v, fallback) { const x = Number(v); return Number.isFinite(x) ? x : (fallback || 0); }
  function normKey(v) {
    return String(v || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }
  function money(v, cur) {
    try { return fmtMoney(v, cur); }
    catch (_) { return `${n(v).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} ${cur || ""}`.trim(); }
  }
  function baseCurrency() {
    try {
      const c = String(window.state?.period?.baseCurrency || window.state?.user?.baseCurrency || window.state?.settings?.base_currency || "EUR").toUpperCase();
      return /^[A-Z]{3}$/.test(c) ? c : "EUR";
    } catch (_) { return "EUR"; }
  }
  function activeTravelId() {
    try { return String(window.state?.activeTravelId || window.state?.period?.travel_id || "").trim(); }
    catch (_) { return ""; }
  }
  async function currentUserId() {
    try { if (window.sbUser && window.sbUser.id) return window.sbUser.id; } catch (_) {}
    try { if (typeof sbUser !== "undefined" && sbUser && sbUser.id) return sbUser.id; } catch (_) {}
    const c = client();
    if (c && c.auth && typeof c.auth.getUser === "function") {
      const res = await c.auth.getUser();
      return res?.data?.user?.id || "";
    }
    return "";
  }
  function isOffline() {
    try { if (typeof window.tbIsOfflineMode === "function" && window.tbIsOfflineMode()) return true; } catch (_) {}
    return typeof navigator !== "undefined" && navigator.onLine === false;
  }
  function statusLabel(s) {
    return ({
      held: atxt("En attente", "Held"),
      partial: atxt("Retour partiel", "Partial"),
      returned: atxt("Rendue", "Returned"),
      lost: atxt("Perdue", "Lost")
    })[String(s || "held")] || atxt("En attente", "Held");
  }
  function statusClass(s) {
    return ({
      held: "held",
      partial: "partial",
      returned: "returned",
      lost: "lost"
    })[String(s || "held")] || "held";
  }
  function remaining(row) {
    const amount = n(row?.amount);
    if (String(row?.status || "") === "returned") return 0;
    if (String(row?.status || "") === "lost") return amount;
    return Math.max(0, amount - n(row?.returned_amount));
  }
  function isOverdue(row) {
    const expected = String(row?.expected_return_date || "");
    return expected && expected < today() && !["returned", "lost"].includes(String(row?.status || ""));
  }
  function hideSettled() {
    try { return localStorage.getItem(HIDE_SETTLED_KEY) !== "0"; }
    catch (_) { return true; }
  }
  function setHideSettled(v) {
    try { localStorage.setItem(HIDE_SETTLED_KEY, v ? "1" : "0"); } catch (_) {}
  }
  function isSettledRow(row) {
    const st = String(row?.status || "");
    const settlement = String(row?.settlement_status || "");
    return st === "returned" || settlement === "settled";
  }
  function linkedReturnIds(row) {
    const ids = Array.isArray(row?.linked_return_transaction_ids) ? row.linked_return_transaction_ids : [];
    const one = row?.linked_return_transaction_id ? [row.linked_return_transaction_id] : [];
    return Array.from(new Set(ids.concat(one).map(x => String(x || "").trim()).filter(Boolean)));
  }
  function settlementDocIds(row) {
    const ids = Array.isArray(row?.settlement_document_ids) ? row.settlement_document_ids : [];
    return Array.from(new Set(ids.map(x => String(x || "").trim()).filter(Boolean)));
  }
  function convertAmount(amount, fromCurrency, toCurrency, dateISO) {
    const amt = n(amount);
    const from = String(fromCurrency || toCurrency || "EUR").toUpperCase();
    const to = String(toCurrency || from || "EUR").toUpperCase();
    if (from === to) return amt;
    try {
      if (typeof window.amountToDisplayForDate === "function") {
        const out = window.amountToDisplayForDate(amt, from, dateISO || today());
        if (Number.isFinite(out)) return out;
      }
    } catch (_) {}
    try {
      if (typeof window.fxConvert === "function") {
        const rates = typeof window.fxGetEurRates === "function" ? window.fxGetEurRates() : undefined;
        const out = window.fxConvert(amt, from, to, rates);
        if (Number.isFinite(out)) return out;
      }
    } catch (_) {}
    return null;
  }
  function txType(tx) { return String(tx?.type || "").toLowerCase(); }
  function txDate(tx) {
    return String(tx?.budgetDateStart || tx?.budget_date_start || tx?.dateStart || tx?.date_start || tx?.occurrence_date || tx?.date || tx?.created_at?.slice?.(0, 10) || today()).slice(0, 10);
  }
  function txPaid(tx) {
    if (typeof tx?.payNow === "boolean") return tx.payNow;
    if (typeof tx?.pay_now === "boolean") return tx.pay_now;
    return !!tx?.payNow || !!tx?.pay_now;
  }
  function txAmount(tx) { return Math.abs(n(tx?.amount ?? tx?.value ?? tx?.total)); }
  function txTravelMatches(tx) {
    const tid = activeTravelId();
    if (!tid) return true;
    const rowTid = String(tx?.travel_id || tx?.travelId || "").trim();
    return !rowTid || rowTid === tid;
  }
  function isCautionPaidTx(tx) {
    return txType(tx) === "expense" && normKey(tx?.category) === "caution" && txTravelMatches(tx);
  }
  function isCautionReturnTx(tx) {
    return txType(tx) === "income" && normKey(tx?.category) === "caution" && txTravelMatches(tx);
  }
  function cautionTxs() {
    return (Array.isArray(window.state?.transactions) ? window.state.transactions : [])
      .filter((tx) => isCautionPaidTx(tx) || isCautionReturnTx(tx))
      .sort((a, b) => String(txDate(b)).localeCompare(String(txDate(a))));
  }
  function txCurrency(tx, fallback) { return String(tx?.currency || tx?.original_currency || fallback || baseCurrency()).toUpperCase(); }
  function txAmountInBase(tx, cur) {
    const out = convertAmount(txAmount(tx), txCurrency(tx, cur), cur, txDate(tx));
    return out === null ? txAmount(tx) : out;
  }
  function cautionTxAnalysis() {
    const cur = baseCurrency();
    const rows = cautionTxs();
    const paidRows = rows.filter(isCautionPaidTx);
    const returnRows = rows.filter(isCautionReturnTx);
    const bySub = new Map();
    let paid = 0;
    let returned = 0;
    let planned = 0;
    for (const tx of rows) {
      const converted = txAmountInBase(tx, cur);
      if (isCautionReturnTx(tx)) returned += converted;
      else if (txPaid(tx)) paid += converted;
      else planned += converted;
      const sub = String(tx?.subcategory || "").trim() || atxt("Sans sous-categorie", "No subcategory");
      const prev = bySub.get(sub) || { name: sub, total: 0, paid: 0, planned: 0, count: 0 };
      prev.total += converted;
      if (isCautionReturnTx(tx) || txPaid(tx)) prev.paid += converted;
      else prev.planned += converted;
      prev.count += 1;
      bySub.set(sub, prev);
    }
    return {
      currency: cur,
      rows,
      paidRows,
      returnRows,
      total: paid + planned,
      paid,
      returned,
      balance: paid + planned - returned,
      planned,
      bySub: Array.from(bySub.values()).sort((a, b) => b.total - a.total)
    };
  }

  async function loadCautions() {
    if (isOffline()) {
      const rows = Array.isArray(window.state?.cautionDeposits) ? window.state.cautionDeposits : [];
      const documents = Array.isArray(window.state?.documents) ? window.state.documents : [];
      const folders = Array.isArray(window.state?.documentFolders) ? window.state.documentFolders : [];
      CACHE = { rows, documents, folders, empty: !rows.length, demo: false, offline: true };
      return CACHE;
    }
    const c = client();
    if (!c) {
      CACHE = { rows: [], empty: true, demo: false, reason: "client-missing" };
      return CACHE;
    }
    try {
      let q = c.from(table("caution_deposits", "caution_deposits"))
        .select("*")
        .order("created_at", { ascending: false });
      const tid = activeTravelId();
      if (tid) q = q.or(`travel_id.eq.${tid},travel_id.is.null`);
      const { data, error } = await q;
      if (error) throw error;
      const rows = data || [];
      let documents = Array.isArray(window.state?.documents) ? window.state.documents : [];
      let folders = Array.isArray(window.state?.documentFolders) ? window.state.documentFolders : [];
      try {
        const [docsRes, foldersRes] = await Promise.all([
          c.from(table("documents", "documents")).select("id,name,original_filename,created_at,tags,folder_id").order("created_at", { ascending: false }).limit(200),
          c.from(table("document_folders", "document_folders")).select("id,name,parent_id,created_at").order("name", { ascending: true }).limit(300)
        ]);
        if (!docsRes.error) documents = docsRes.data || documents;
        if (!foldersRes.error) folders = foldersRes.data || folders;
      } catch (e) {
        console.warn("[TB][cautions] documents load skipped", e);
      }
      CACHE = { rows, documents, folders, empty: !rows.length, demo: false, reason: "" };
      try {
        if (window.state) state.cautionDeposits = rows;
        if (window.state) state.documents = documents;
        if (window.state) state.documentFolders = folders;
        if (typeof window.tbSaveOfflineSnapshot === "function") window.tbSaveOfflineSnapshot("cautions:load");
      } catch (_) {}
      return CACHE;
    } catch (e) {
      console.warn("[TB][cautions] load failed", e);
      CACHE = { rows: [], empty: true, demo: false, reason: e && (e.message || e.details || e.code) };
      return CACHE;
    }
  }

  function readPayload(form) {
    const fd = new FormData(form);
    const label = String(fd.get("label") || "").trim();
    const amount = Number(fd.get("amount") || 0);
    const currency = String(fd.get("currency") || baseCurrency()).trim().toUpperCase();
    const status = String(fd.get("status") || "held");
    const returnedAmountRaw = String(fd.get("returned_amount") || "").trim();
    if (!label) throw new Error(atxt("Nom de caution requis.", "Deposit name is required."));
    if (!Number.isFinite(amount) || amount < 0) throw new Error(atxt("Montant invalide.", "Invalid amount."));
    if (!/^[A-Z]{3}$/.test(currency)) throw new Error(atxt("Devise invalide.", "Invalid currency."));
    if (!["held", "partial", "returned", "lost"].includes(status)) throw new Error(atxt("Statut invalide.", "Invalid status."));
    const returnedAmount = returnedAmountRaw ? Number(returnedAmountRaw) : null;
    if (returnedAmount !== null && (!Number.isFinite(returnedAmount) || returnedAmount < 0)) throw new Error(atxt("Montant rendu invalide.", "Invalid returned amount."));
    return {
      label,
      counterparty: String(fd.get("counterparty") || "").trim() || null,
      amount,
      currency,
      paid_date: String(fd.get("paid_date") || "").slice(0, 10) || null,
      expected_return_date: String(fd.get("expected_return_date") || "").slice(0, 10) || null,
      returned_date: String(fd.get("returned_date") || "").slice(0, 10) || null,
      returned_amount: returnedAmount,
      status,
      note: String(fd.get("note") || "").trim() || null,
      updated_at: new Date().toISOString()
    };
  }

  async function saveFromForm(form) {
    const c = client();
    if (!c) throw new Error(atxt("Client Supabase indisponible.", "Supabase client unavailable."));
    const uid = await currentUserId();
    if (!uid) throw new Error(atxt("Utilisateur deconnecte.", "User disconnected."));
    const id = form.getAttribute("data-caution-id") || "";
    const payload = readPayload(form);
    if (id) {
      const { error } = await c.from(table("caution_deposits", "caution_deposits")).update(payload).eq("id", id);
      if (error) throw error;
      return;
    }
    payload.user_id = uid;
    payload.travel_id = activeTravelId() || null;
    const { error } = await c.from(table("caution_deposits", "caution_deposits")).insert([payload]);
    if (error) throw error;
  }

  async function updateStatus(id, status) {
    const c = client();
    if (!c) throw new Error(atxt("Client Supabase indisponible.", "Supabase client unavailable."));
    const payload = { status, updated_at: new Date().toISOString() };
    if (status === "returned") {
      const row = CACHE.rows.find(r => String(r.id) === String(id));
      payload.returned_date = today();
      payload.returned_amount = n(row?.amount);
    }
    const { error } = await c.from(table("caution_deposits", "caution_deposits")).update(payload).eq("id", id);
    if (error) throw error;
  }

  async function removeCaution(id) {
    const c = client();
    if (!c) throw new Error(atxt("Client Supabase indisponible.", "Supabase client unavailable."));
    const { error } = await c.from(table("caution_deposits", "caution_deposits")).delete().eq("id", id);
    if (error) throw error;
  }

  function summaryHtml(rows, analysis) {
    const cur = baseCurrency();
    let locked = 0;
    let returned = 0;
    let lost = 0;
    let overdue = 0;
    for (const row of rows) {
      const date = row.paid_date || row.expected_return_date || today();
      const rem = convertAmount(remaining(row), row.currency, cur, date);
      const ret = convertAmount(n(row.returned_amount), row.currency, cur, row.returned_date || date);
      const amount = convertAmount(n(row.amount), row.currency, cur, date);
      if (String(row.status || "") === "lost") lost += amount ?? n(row.amount);
      else locked += rem ?? remaining(row);
      returned += ret ?? n(row.returned_amount);
      if (isOverdue(row)) overdue += 1;
    }
    return `<div class="tb-cautions-summary">
      <div class="tb-caution-kpi primary"><span>${esc(atxt("Immobilise", "Locked"))}</span><strong>${esc(money(locked, cur))}</strong></div>
      <div class="tb-caution-kpi tx"><span>${esc(atxt("Cautions a gerer", "Deposits to manage"))}</span><strong>${esc(money(analysis?.total || 0, analysis?.currency || cur))}</strong></div>
      <div class="tb-caution-kpi"><span>${esc(atxt("Rendu", "Returned"))}</span><strong>${esc(money(returned, cur))}</strong></div>
      <div class="tb-caution-kpi"><span>${esc(atxt("Perdu", "Lost"))}</span><strong>${esc(money(lost, cur))}</strong></div>
      <div class="tb-caution-kpi warn"><span>${esc(atxt("En retard", "Overdue"))}</span><strong>${esc(overdue)}</strong></div>
    </div>`;
  }

  function cardHtml(row) {
    const st = statusClass(row.status);
    const overdue = isOverdue(row);
    const remainingLabel = money(remaining(row), row.currency);
    const meta = [
      row.counterparty,
      row.paid_date ? `${atxt("Payee", "Paid")} ${row.paid_date}` : "",
      row.expected_return_date ? `${atxt("Retour prevu", "Expected")} ${row.expected_return_date}` : ""
    ].filter(Boolean).join(" · ");
    return `<article class="tb-caution-card ${esc(st)} ${overdue ? "overdue" : ""}">
      <div class="tb-caution-card-main">
        <div>
          <div class="tb-caution-title">${esc(row.label)}</div>
          <div class="tb-caution-meta">${esc(meta || atxt("Aucun detail", "No detail"))}</div>
        </div>
        <div class="tb-caution-amount">
          <strong>${esc(money(row.amount, row.currency))}</strong>
          <span>${esc(atxt("Reste", "Left"))} ${esc(remainingLabel)}</span>
        </div>
      </div>
      <div class="tb-caution-card-foot">
        <span class="tb-caution-status ${esc(st)}">${esc(statusLabel(row.status))}${overdue ? ` · ${esc(atxt("retard", "overdue"))}` : ""}</span>
        <div class="tb-caution-actions">
          <button type="button" data-tb-caution-edit="${esc(row.id)}">${esc(atxt("Modifier", "Edit"))}</button>
          ${String(row.status || "") !== "returned" ? `<button type="button" data-tb-caution-return="${esc(row.id)}">${esc(atxt("Marquer rendue", "Mark returned"))}</button>` : ""}
          <button type="button" class="danger" data-tb-caution-delete="${esc(row.id)}">${esc(atxt("Supprimer", "Delete"))}</button>
        </div>
      </div>
      ${row.note ? `<p class="tb-caution-note">${esc(row.note)}</p>` : ""}
    </article>`;
  }

  function formHtml(row) {
    const r = row || {};
    const id = r.id || "";
    return `<form class="tb-caution-form" data-tb-caution-form data-caution-id="${esc(id)}">
      <div class="tb-caution-form-title">${esc(id ? atxt("Modifier la caution", "Edit deposit") : atxt("Nouvelle caution", "New deposit"))}</div>
      <label>${esc(atxt("Nom", "Name"))}<input name="label" required value="${esc(r.label || "")}" placeholder="${esc(atxt("Appartement, hotel, location...", "Apartment, hotel, rental..."))}"></label>
      <label>${esc(atxt("Tiers", "Counterparty"))}<input name="counterparty" value="${esc(r.counterparty || "")}" placeholder="${esc(atxt("Hotel, agence, proprietaire", "Hotel, agency, owner"))}"></label>
      <div class="tb-caution-form-grid">
        <label>${esc(atxt("Montant", "Amount"))}<input name="amount" type="number" min="0" step="0.01" required value="${esc(r.amount ?? "")}"></label>
        <label>${esc(atxt("Devise", "Currency"))}<input name="currency" maxlength="3" required value="${esc(r.currency || baseCurrency())}"></label>
        <label>${esc(atxt("Date payee", "Paid date"))}<input name="paid_date" type="date" value="${esc(String(r.paid_date || "").slice(0, 10))}"></label>
        <label>${esc(atxt("Retour prevu", "Expected return"))}<input name="expected_return_date" type="date" value="${esc(String(r.expected_return_date || "").slice(0, 10))}"></label>
        <label>${esc(atxt("Statut", "Status"))}<select name="status">
          ${["held", "partial", "returned", "lost"].map(s => `<option value="${s}" ${String(r.status || "held") === s ? "selected" : ""}>${esc(statusLabel(s))}</option>`).join("")}
        </select></label>
        <label>${esc(atxt("Montant rendu", "Returned amount"))}<input name="returned_amount" type="number" min="0" step="0.01" value="${esc(r.returned_amount ?? "")}"></label>
        <label>${esc(atxt("Date rendue", "Returned date"))}<input name="returned_date" type="date" value="${esc(String(r.returned_date || "").slice(0, 10))}"></label>
      </div>
      <label>${esc(atxt("Note", "Note"))}<textarea name="note" rows="2">${esc(r.note || "")}</textarea></label>
      <div class="tb-caution-form-actions">
        <button class="btn primary" type="submit">${esc(atxt("Enregistrer", "Save"))}</button>
        ${id ? `<button class="btn" type="button" data-tb-caution-cancel>${esc(atxt("Annuler", "Cancel"))}</button>` : ""}
      </div>
      <div class="tb-caution-form-error" data-tb-caution-error hidden></div>
    </form>`;
  }

  function listHtml(rows) {
    const visibleRows = hideSettled() ? rows.filter(row => !isSettledRow(row)) : rows;
    if (!visibleRows.length) {
      return `<div class="tb-cautions-empty">
        <strong>${esc(rows.length ? atxt("Toutes les cautions visibles sont soldees.", "All visible deposits are settled.") : atxt("Aucune caution suivie.", "No deposit tracked."))}</strong>
        <span>${esc(rows.length ? atxt("Decoche le filtre pour revoir l'historique solde.", "Uncheck the filter to review settled history.") : atxt("Ajoute une caution pour voir ce qui reste immobilise, rendu, perdu ou en retard.", "Add a deposit to track what remains locked, returned, lost or overdue."))}</span>
      </div>`;
    }
    return `<div class="tb-cautions-grid">${visibleRows.map(cardHtml).join("")}</div>`;
  }

  function winkHtml(rows, analysis) {
    const openRows = (rows || []).filter(row => !isSettledRow(row));
    const openPaid = (analysis?.paidRows || []).filter(tx => !isSettledRow(reconciliationForPaid(tx.id, rows)));
    const remainingTotal = openRows.reduce((sum, row) => {
      const converted = convertAmount(remaining(row), row.currency, analysis?.currency || baseCurrency(), row.expected_return_date || row.paid_date || today());
      return sum + (converted ?? remaining(row));
    }, 0);
    return `<div class="tb-caution-wink">
      <strong>${esc(atxt("Clin d'oeil", "Quick wink"))}</strong>
      <span>${esc(atxt(
        `${openRows.length} caution(s) non soldee(s), ${openPaid.length} connexion(s) transaction a finaliser, reste ${money(remainingTotal, analysis?.currency || baseCurrency())}.`,
        `${openRows.length} unsettled deposit(s), ${openPaid.length} transaction connection(s) left, ${money(remainingTotal, analysis?.currency || baseCurrency())} remaining.`
      ))}</span>
    </div>`;
  }

  function statusHtml(data) {
    if (!data?.offline && !data?.reason) return "";
    const msg = data?.offline
      ? atxt("Mode hors ligne : affichage depuis le dernier snapshot local.", "Offline mode: showing the latest local snapshot.")
      : `${atxt("Cautions chargees en mode degrade.", "Deposits loaded in degraded mode.")} ${data.reason || ""}`;
    return `<div class="tb-caution-status-panel ${data?.reason ? "error" : ""}">${esc(msg)}</div>`;
  }

  function settlementLabel(status) {
    return ({
      open: atxt("A verifier", "To review"),
      settled: atxt("Soldee", "Settled"),
      partial: atxt("Partielle", "Partial"),
      lost: atxt("Perdue", "Lost"),
      disputed: atxt("Ecart a justifier", "Difference to justify")
    })[String(status || "open")] || atxt("A verifier", "To review");
  }
  function depositStatusFromSettlement(status) {
    return ({ settled: "returned", partial: "partial", lost: "lost", disputed: "partial", open: "held" })[String(status || "open")] || "held";
  }
  function reconciliationForPaid(txId, rows) {
    return (rows || []).find(row => String(row?.linked_paid_transaction_id || "") === String(txId || ""));
  }
  function returnTxById(id, analysis) {
    return (analysis?.returnRows || []).find(tx => String(tx?.id || "") === String(id || ""));
  }
  function returnOptionsHtml(selectedId, analysis) {
    const rows = analysis?.returnRows || [];
    return `<option value="">${esc(atxt("Aucun retour selectionne", "No return selected"))}</option>` + rows.map(tx => {
      const label = `${txDate(tx)} · ${txLabel(tx)} · ${money(txAmount(tx), txCurrency(tx, analysis.currency))}`;
      return `<option value="${esc(tx.id || "")}" ${String(selectedId || "") === String(tx.id || "") ? "selected" : ""}>${esc(label)}</option>`;
    }).join("");
  }
  function reconciliationDifference(paidTx, returnTx, row, analysis) {
    const paid = txAmountInBase(paidTx, analysis.currency);
    const returned = returnTx ? txAmountInBase(returnTx, analysis.currency) : n(row?.returned_amount);
    return paid - returned;
  }
  function returnTxsByIds(ids, analysis) {
    const selected = new Set((ids || []).map(id => String(id || "")));
    return (analysis?.returnRows || []).filter(tx => selected.has(String(tx?.id || "")));
  }
  function txSearchText(tx) {
    return normKey([
      txLabel(tx),
      txDate(tx),
      txAmount(tx),
      txCurrency(tx),
      tx?.category || "",
      tx?.subcategory || "",
      tx?.wallet_name || tx?.walletName || "",
      tx?.note || "",
    ].join(" "));
  }
  function sameAmount(a, b) {
    return Math.abs(n(a) - n(b)) < 0.01;
  }
  function returnCandidateGroups(paidTx, selectedIds, analysis) {
    const selected = new Set((selectedIds || []).map(id => String(id || "")));
    const paidAmount = txAmountInBase(paidTx, analysis.currency);
    const rows = (analysis?.returnRows || []).map(tx => ({
      tx,
      exact: sameAmount(txAmountInBase(tx, analysis.currency), paidAmount),
      selected: selected.has(String(tx?.id || "")),
    }));
    const exact = rows.filter(x => x.exact || x.selected);
    const other = rows.filter(x => !x.exact && !x.selected);
    return { exact, other };
  }
  function returnCheckboxHtml(item, analysis) {
    const tx = item.tx;
    const search = txSearchText(tx);
    const amount = money(txAmount(tx), txCurrency(tx, analysis.currency));
    return `<label class="tb-caution-return-option ${item.exact ? "suggested" : ""}" data-tb-caution-return-option data-search="${esc(search)}">
      <input type="checkbox" name="linked_return_transaction_ids" value="${esc(tx.id || "")}" ${item.selected ? "checked" : ""}>
      <span>
        <strong>${esc(txLabel(tx))}</strong>
        <small>${esc(txDate(tx))} - ${esc(amount)} - ${esc(tx?.subcategory || atxt("Sans sous-categorie", "No subcategory"))}</small>
      </span>
      ${item.exact ? `<em>${esc(atxt("montant exact", "exact amount"))}</em>` : ""}
    </label>`;
  }
  function returnPickerHtml(paidTx, selectedIds, analysis) {
    const groups = returnCandidateGroups(paidTx, selectedIds, analysis);
    const exactHtml = groups.exact.length
      ? `<div class="tb-caution-picker-group"><b>${esc(atxt("Propositions montant exact", "Exact amount suggestions"))}</b>${groups.exact.map(item => returnCheckboxHtml(item, analysis)).join("")}</div>`
      : `<div class="tb-caution-picker-empty">${esc(atxt("Aucun revenu Caution au montant exact.", "No Caution income with the exact amount."))}</div>`;
    const otherHtml = groups.other.length
      ? groups.other.map(item => returnCheckboxHtml(item, analysis)).join("")
      : `<div class="tb-caution-picker-empty">${esc(atxt("Aucun autre revenu Caution.", "No other Caution income."))}</div>`;
    return `<div class="tb-caution-picker" data-tb-caution-return-picker>
      ${exactHtml}
      <div class="tb-caution-picker-group">
        <b>${esc(atxt("Recherche revenus Caution", "Search Caution income"))}</b>
        <input type="search" data-tb-caution-return-filter placeholder="${esc(atxt("Date, montant, libelle, sous-categorie...", "Date, amount, label, subcategory..."))}" autocomplete="off">
        <div class="tb-caution-picker-scroll">${otherHtml}</div>
      </div>
    </div>`;
  }
  function folderMap() {
    return new Map((CACHE.folders || []).map(folder => [String(folder?.id || ""), folder]));
  }
  function folderPath(folderId) {
    const folders = folderMap();
    const seen = new Set();
    const parts = [];
    let current = folders.get(String(folderId || ""));
    while (current && !seen.has(String(current.id))) {
      seen.add(String(current.id));
      parts.unshift(String(current.name || atxt("Dossier", "Folder")));
      current = folders.get(String(current.parent_id || ""));
    }
    return parts.join(" / ") || atxt("Sans dossier", "No folder");
  }
  function docTitle(doc) {
    return doc?.name || doc?.original_filename || atxt("Document", "Document");
  }
  function docSearchText(doc) {
    return normKey([docTitle(doc), folderPath(doc?.folder_id), (doc?.tags || []).join(" "), String(doc?.created_at || "").slice(0, 10)].join(" "));
  }
  function documentOptionsHtml(selectedIds) {
    const selected = new Set((selectedIds || []).map(id => String(id || "")));
    return (CACHE.documents || []).map(doc => {
      const label = doc?.name || doc?.original_filename || atxt("Document", "Document");
      const date = String(doc?.created_at || "").slice(0, 10);
      return `<option value="${esc(doc.id || "")}" ${selected.has(String(doc.id || "")) ? "selected" : ""}>${esc(label)}${date ? ` - ${esc(date)}` : ""}</option>`;
    }).join("");
  }
  function documentPickerHtml(selectedIds) {
    const selected = new Set((selectedIds || []).map(id => String(id || "")));
    const docs = (CACHE.documents || []).slice().sort((a, b) => {
      const sa = selected.has(String(a?.id || "")) ? 0 : 1;
      const sb = selected.has(String(b?.id || "")) ? 0 : 1;
      if (sa !== sb) return sa - sb;
      return String(b?.created_at || "").localeCompare(String(a?.created_at || ""));
    });
    if (!docs.length) {
      return `<div class="tb-caution-picker-empty">${esc(atxt("Aucun document disponible. Ajoute d'abord tes justificatifs dans Documents.", "No document available. Add proofs in Documents first."))}</div>`;
    }
    return `<div class="tb-caution-doc-picker" data-tb-caution-doc-picker>
      <input type="search" data-tb-caution-doc-filter placeholder="${esc(atxt("Rechercher dossier, document, tag...", "Search folder, document, tag..."))}" autocomplete="off">
      <div class="tb-caution-doc-grid">
        ${docs.map(doc => `<label class="tb-caution-doc-option ${selected.has(String(doc?.id || "")) ? "selected" : ""}" data-tb-caution-doc-option data-search="${esc(docSearchText(doc))}">
          <input type="checkbox" name="settlement_document_ids" value="${esc(doc.id || "")}" ${selected.has(String(doc?.id || "")) ? "checked" : ""}>
          <span class="tb-caution-doc-icon">DOC</span>
          <span>
            <strong>${esc(docTitle(doc))}</strong>
            <small>${esc(folderPath(doc?.folder_id))}${doc?.created_at ? ` - ${esc(String(doc.created_at).slice(0, 10))}` : ""}</small>
          </span>
        </label>`).join("")}
      </div>
    </div>`;
  }
  function documentLinksHtml(row) {
    const ids = new Set(settlementDocIds(row));
    const docs = (CACHE.documents || []).filter(doc => ids.has(String(doc?.id || "")));
    if (!docs.length) return "";
    return `<div class="tb-caution-doc-chips">
      ${docs.map(doc => `<button class="tb-caution-doc-chip" type="button" onclick="showView('documents')" title="${esc(folderPath(doc?.folder_id))}">
        <span>DOC</span>
        <b>${esc(docTitle(doc))}</b>
        <small>${esc(folderPath(doc?.folder_id))}</small>
      </button>`).join("")}
    </div>`;
  }
  function reconciliationMultiDifference(paidTx, returnTxs, row, analysis) {
    const paid = txAmountInBase(paidTx, analysis.currency);
    const returnedFromTxs = (returnTxs || []).reduce((sum, tx) => sum + txAmountInBase(tx, analysis.currency), 0);
    const returned = returnedFromTxs || n(row?.returned_amount);
    return paid - returned;
  }
  async function saveReconciliation(form) {
    const c = client();
    if (!c) throw new Error(atxt("Client Supabase indisponible.", "Supabase client unavailable."));
    const uid = await currentUserId();
    if (!uid) throw new Error(atxt("Utilisateur deconnecte.", "User disconnected."));
    const fd = new FormData(form);
    const paidId = String(form.getAttribute("data-paid-tx-id") || "");
    const paidTx = (Array.isArray(window.state?.transactions) ? window.state.transactions : []).find(tx => String(tx?.id || "") === paidId);
    if (!paidTx) throw new Error(atxt("Transaction de caution introuvable.", "Deposit transaction not found."));
    const returnIds = fd.getAll("linked_return_transaction_ids").map(x => String(x || "").trim()).filter(Boolean);
    const docIds = fd.getAll("settlement_document_ids").map(x => String(x || "").trim()).filter(Boolean);
    const allTxs = Array.isArray(window.state?.transactions) ? window.state.transactions : [];
    const returnTxs = allTxs.filter(tx => returnIds.includes(String(tx?.id || "")));
    const settlementStatus = String(fd.get("settlement_status") || "open");
    const note = String(fd.get("settlement_note") || "").trim() || null;
    const existingId = String(form.getAttribute("data-caution-id") || "");
    const payload = {
      user_id: uid,
      travel_id: activeTravelId() || null,
      label: txLabel(paidTx),
      counterparty: String(paidTx?.counterparty || paidTx?.merchant || "").trim() || null,
      amount: txAmount(paidTx),
      currency: txCurrency(paidTx),
      paid_date: txDate(paidTx) || null,
      returned_date: returnTxs.length ? txDate(returnTxs[0]) : null,
      returned_amount: returnTxs.length ? returnTxs.reduce((sum, tx) => sum + txAmount(tx), 0) : null,
      status: depositStatusFromSettlement(settlementStatus),
      linked_paid_transaction_id: paidId || null,
      linked_return_transaction_id: returnIds[0] || null,
      linked_return_transaction_ids: returnIds,
      settlement_status: settlementStatus,
      settlement_note: note,
      settlement_document_url: null,
      settlement_document_label: null,
      settlement_document_ids: docIds,
      note,
      updated_at: new Date().toISOString()
    };
    if (existingId) {
      const { error } = await c.from(table("caution_deposits", "caution_deposits")).update(payload).eq("id", existingId);
      if (error) throw error;
      return;
    }
    const { error } = await c.from(table("caution_deposits", "caution_deposits")).insert([payload]);
    if (error) throw error;
  }

  function txLabel(tx) {
    return String(tx?.label || tx?.description || tx?.note || tx?.title || atxt("Transaction", "Transaction")).trim();
  }
  function analysisHtml(analysis) {
    const rows = analysis?.rows || [];
    const subRows = analysis?.bySub || [];
    if (!rows.length) {
      return `<section class="tb-caution-analysis">
        <div class="tb-caution-analysis-head">
          <div>
            <h3>${esc(atxt("Analyse categorie Caution", "Caution category analysis"))}</h3>
            <p>${esc(atxt("Aucune transaction avec la categorie Caution sur le voyage courant.", "No transaction with the Caution category in the current trip."))}</p>
          </div>
        </div>
      </section>`;
    }
    return `<section class="tb-caution-analysis">
      <div class="tb-caution-analysis-head">
        <div>
          <h3>${esc(atxt("Analyse categorie Caution", "Caution category analysis"))}</h3>
          <p>${esc(atxt("Source: transactions categorie Caution, groupees par sous-categorie.", "Source: Caution category transactions, grouped by subcategory."))}</p>
        </div>
        <div class="tb-caution-analysis-total">
          <span>${esc(atxt("Total", "Total"))}</span>
          <strong>${esc(money(analysis.total, analysis.currency))}</strong>
        </div>
      </div>
      <div class="tb-caution-analysis-kpis">
        <div><span>${esc(atxt("Payees", "Paid"))}</span><strong>${esc(money(analysis.paid, analysis.currency))}</strong></div>
        <div><span>${esc(atxt("Retour revenu", "Income returns"))}</span><strong>${esc(money(analysis.returned, analysis.currency))}</strong></div>
        <div><span>${esc(atxt("A payer", "Planned"))}</span><strong>${esc(money(analysis.planned, analysis.currency))}</strong></div>
        <div><span>${esc(atxt("Ecart", "Difference"))}</span><strong>${esc(money(analysis.balance, analysis.currency))}</strong></div>
      </div>
      <div class="tb-caution-subcats">
        ${subRows.map(row => `<div class="tb-caution-subcat-row">
          <div><strong>${esc(row.name)}</strong><span>${esc(row.count)} ${esc(atxt("transaction(s)", "transaction(s)"))}</span></div>
          <b>${esc(money(row.total, analysis.currency))}</b>
        </div>`).join("")}
      </div>
      <div class="tb-caution-recent">
        ${rows.slice(0, 6).map(tx => `<div class="tb-caution-tx-row">
          <div><strong>${esc(txLabel(tx))}</strong><span>${esc(txDate(tx))} · ${esc(tx?.subcategory || atxt("Sans sous-categorie", "No subcategory"))}</span></div>
          <b>${esc(money(txAmount(tx), tx.currency || analysis.currency))}</b>
        </div>`).join("")}
      </div>
    </section>`;
  }

  function reconciliationHtml(analysis, rows) {
    const paid = analysis?.paidRows || [];
    const hideDone = hideSettled();
    const visiblePaid = hideDone ? paid.filter(tx => !isSettledRow(reconciliationForPaid(tx.id, rows))) : paid;
    if (!paid.length) {
      return `<section class="tb-caution-match">
        <div class="tb-caution-analysis-head">
          <div>
            <h3>${esc(atxt("Cautions a gerer", "Deposits to manage"))}</h3>
            <p>${esc(atxt("Ajoute une depense categorie Caution : elle deviendra une caution a gerer, a rapprocher plus tard avec un revenu Caution.", "Add an expense in the Caution category: it becomes a deposit to manage and later reconcile with Caution income."))}</p>
          </div>
        </div>
      </section>`;
    }
    return `<section class="tb-caution-match">
      <div class="tb-caution-analysis-head">
        <div>
          <h3>${esc(atxt("Cautions a gerer", "Deposits to manage"))}</h3>
          <p>${esc(atxt("Chaque depense Caution cree une caution a gerer. Les revenus Caution au montant exact sont proposes d'abord, sinon utilise la recherche.", "Each Caution expense creates a deposit to manage. Exact Caution income matches are suggested first; otherwise use search."))}</p>
        </div>
        <label class="tb-caution-toggle"><input type="checkbox" data-tb-caution-hide-settled ${hideDone ? "checked" : ""}> ${esc(atxt("Masquer les soldees", "Hide settled"))}</label>
      </div>
      <div class="tb-caution-match-list">
        ${visiblePaid.map(tx => {
          const row = reconciliationForPaid(tx.id, rows);
          const selectedReturnIds = linkedReturnIds(row);
          const selectedReturns = returnTxsByIds(selectedReturnIds, analysis);
          const diff = reconciliationMultiDifference(tx, selectedReturns, row, analysis);
          return `<form class="tb-caution-match-card" data-tb-caution-reconcile-form data-paid-tx-id="${esc(tx.id || "")}" data-caution-id="${esc(row?.id || "")}">
            <div class="tb-caution-match-title">
              <div>
                <strong>${esc(txLabel(tx))}</strong>
                <span>${esc(txDate(tx))} · ${esc(tx?.subcategory || atxt("Sans sous-categorie", "No subcategory"))}</span>
              </div>
              <b>${esc(money(txAmount(tx), txCurrency(tx, analysis.currency)))}</b>
            </div>
            <div class="tb-caution-match-grid">
              <div class="tb-caution-match-field wide">
                <label>${esc(atxt("Revenus Caution a rattacher", "Caution income to link"))}</label>
                ${returnPickerHtml(tx, selectedReturnIds, analysis)}
              </div>
              <label>${esc(atxt("Statut", "Status"))}<select name="settlement_status">
                ${["open", "settled", "partial", "lost", "disputed"].map(s => `<option value="${s}" ${String(row?.settlement_status || "open") === s ? "selected" : ""}>${esc(settlementLabel(s))}</option>`).join("")}
              </select></label>
              <label class="wide">${esc(atxt("Commentaire", "Comment"))}<textarea name="settlement_note" rows="3" placeholder="${esc(atxt("Ex: frais retenus, menage, degradation, ecart justifie...", "Ex: retained fee, cleaning, damage, justified difference..."))}">${esc(row?.settlement_note || row?.note || "")}</textarea></label>
              <div class="tb-caution-match-field wide">
                <label>${esc(atxt("Documents et dossiers", "Documents and folders"))}</label>
                ${documentPickerHtml(settlementDocIds(row))}
              </div>
            </div>
            <div class="tb-caution-match-foot">
              <span class="${Math.abs(diff) < 0.01 ? "ok" : "warn"}">${esc(atxt("Ecart", "Difference"))}: ${esc(money(diff, analysis.currency))}</span>
              ${documentLinksHtml(row)}
              <button class="btn primary" type="submit">${esc(atxt("Enregistrer rapprochement", "Save reconciliation"))}</button>
            </div>
            <div class="tb-caution-form-error" data-tb-caution-error hidden></div>
          </form>`;
        }).join("") || `<div class="tb-cautions-empty"><strong>${esc(atxt("Tout est solde.", "Everything is settled."))}</strong><span>${esc(atxt("Active l'affichage des soldees pour revoir l'historique.", "Show settled items to review history."))}</span></div>`}
      </div>
    </section>`;
  }

  function styles() {
    if (document.getElementById("tb-cautions-style")) return;
    const st = document.createElement("style");
    st.id = "tb-cautions-style";
    st.textContent = `
      .tb-cautions-shell{display:flex;flex-direction:column;gap:16px;}
      .tb-cautions-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;}
      .tb-cautions-head h2{margin:0;font-size:24px;}
      .tb-cautions-head p{margin:6px 0 0;color:var(--muted);line-height:1.45;}
      .tb-cautions-badge{border:1px solid rgba(16,185,129,.22);background:rgba(16,185,129,.09);color:#047857;border-radius:999px;padding:7px 10px;font-weight:800;font-size:12px;white-space:nowrap;}
      .tb-caution-wink{display:flex;align-items:center;justify-content:space-between;gap:12px;border:1px solid rgba(16,185,129,.24);background:linear-gradient(135deg,rgba(16,185,129,.13),rgba(59,130,246,.08));border-radius:16px;padding:12px 14px;}
      .tb-caution-wink strong{font-size:14px;}
      .tb-caution-wink span{color:var(--muted);font-size:13px;line-height:1.4;}
      .tb-caution-toggle{display:inline-flex;align-items:center;gap:8px;border:1px solid var(--border);border-radius:999px;padding:8px 11px;background:rgba(255,255,255,.62);font-weight:900;font-size:12px;color:var(--muted);white-space:nowrap;}
      .tb-caution-toggle input{width:16px;height:16px;}
      .tb-cautions-layout{display:grid;grid-template-columns:minmax(260px,340px) 1fr;gap:16px;align-items:start;}
      .tb-cautions-summary{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;}
      .tb-caution-kpi{border:1px solid var(--border);border-radius:14px;padding:12px;background:rgba(255,255,255,.68);}
      .tb-caution-kpi span{display:block;color:var(--muted);font-size:12px;font-weight:800;margin-bottom:6px;}
      .tb-caution-kpi strong{font-size:18px;}
      .tb-caution-kpi.primary{border-color:rgba(16,185,129,.28);background:linear-gradient(135deg,rgba(16,185,129,.14),rgba(14,165,233,.08));}
      .tb-caution-kpi.warn{border-color:rgba(245,158,11,.28);}
      .tb-caution-kpi.tx{border-color:rgba(59,130,246,.24);background:rgba(59,130,246,.08);}
      .tb-caution-status-panel{border:1px solid rgba(245,158,11,.28);background:rgba(245,158,11,.10);color:#92400e;border-radius:14px;padding:11px 12px;font-size:13px;font-weight:800;}
      .tb-caution-status-panel.error{border-color:rgba(239,68,68,.26);background:rgba(239,68,68,.10);color:#b91c1c;}
      .tb-caution-analysis{border:1px solid rgba(59,130,246,.18);border-radius:18px;background:rgba(255,255,255,.72);padding:14px;display:flex;flex-direction:column;gap:12px;}
      .tb-caution-analysis-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;}
      .tb-caution-analysis h3{margin:0;font-size:18px;}
      .tb-caution-analysis p{margin:5px 0 0;color:var(--muted);font-size:13px;line-height:1.45;}
      .tb-caution-analysis-total{text-align:right;white-space:nowrap;}
      .tb-caution-analysis-total span,.tb-caution-analysis-kpis span,.tb-caution-subcat-row span,.tb-caution-tx-row span{display:block;color:var(--muted);font-size:12px;}
      .tb-caution-analysis-total strong{font-size:22px;}
      .tb-caution-analysis-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;}
      .tb-caution-analysis-kpis>div{border:1px solid var(--border);border-radius:14px;padding:10px;background:rgba(248,250,252,.72);}
      .tb-caution-match{border:1px solid rgba(16,185,129,.18);border-radius:18px;background:rgba(255,255,255,.72);padding:14px;display:flex;flex-direction:column;gap:12px;}
      .tb-caution-match-list{display:flex;flex-direction:column;gap:10px;}
      .tb-caution-match-card{border:1px solid var(--border);border-radius:16px;background:rgba(248,250,252,.72);padding:12px;display:flex;flex-direction:column;gap:10px;}
      .tb-caution-match-title,.tb-caution-match-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;}
      .tb-caution-match-title span{display:block;color:var(--muted);font-size:12px;margin-top:2px;}
      .tb-caution-match-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;}
      .tb-caution-match-grid label,.tb-caution-match-field{display:flex;flex-direction:column;gap:6px;color:var(--muted);font-size:12px;font-weight:800;}
      .tb-caution-match-grid .wide{grid-column:1 / -1;}
      .tb-caution-match-grid input,.tb-caution-match-grid select,.tb-caution-match-grid textarea{width:100%;border:1px solid var(--border);border-radius:12px;background:var(--card);color:var(--text);padding:10px 11px;font:inherit;}
      .tb-caution-match-grid select[multiple]{min-height:108px;padding:7px;}
      .tb-caution-picker,.tb-caution-doc-picker{border:1px solid var(--border);border-radius:14px;background:rgba(255,255,255,.62);padding:10px;display:flex;flex-direction:column;gap:10px;}
      .tb-caution-picker-group{display:flex;flex-direction:column;gap:7px;}
      .tb-caution-picker-group>b{color:var(--text);font-size:12px;}
      .tb-caution-picker-scroll{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:7px;max-height:230px;overflow:auto;padding-right:3px;}
      .tb-caution-return-option{display:flex!important;flex-direction:row!important;align-items:flex-start!important;gap:9px!important;border:1px solid var(--border);border-radius:12px;background:rgba(248,250,252,.82);padding:9px!important;color:var(--text)!important;font-weight:700!important;}
      .tb-caution-return-option.suggested{border-color:rgba(16,185,129,.36);background:rgba(16,185,129,.10);}
      .tb-caution-return-option input{width:16px!important;height:16px!important;margin-top:2px;flex:0 0 auto;}
      .tb-caution-return-option span{display:flex;flex-direction:column;gap:2px;min-width:0;}
      .tb-caution-return-option small{color:var(--muted);font-size:11px;line-height:1.3;}
      .tb-caution-return-option em{margin-left:auto;font-style:normal;color:#047857;background:rgba(16,185,129,.13);border-radius:999px;padding:3px 7px;font-size:10px;white-space:nowrap;}
      .tb-caution-picker-empty{border:1px dashed var(--border);border-radius:12px;padding:10px;color:var(--muted);font-size:12px;background:rgba(148,163,184,.08);}
      .tb-caution-doc-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px;max-height:260px;overflow:auto;padding-right:3px;}
      .tb-caution-doc-option{display:grid!important;grid-template-columns:auto auto minmax(0,1fr)!important;align-items:center!important;gap:9px!important;border:1px solid var(--border);border-radius:13px;background:rgba(248,250,252,.82);padding:9px!important;color:var(--text)!important;font-weight:700!important;}
      .tb-caution-doc-option.selected{border-color:rgba(37,99,235,.34);background:rgba(59,130,246,.10);}
      .tb-caution-doc-option input{width:16px!important;height:16px!important;}
      .tb-caution-doc-icon,.tb-caution-doc-chip span{display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:10px;background:rgba(37,99,235,.12);color:#1d4ed8;font-size:10px;font-weight:950;}
      .tb-caution-doc-option span:last-child{display:flex;flex-direction:column;gap:2px;min-width:0;}
      .tb-caution-doc-option strong,.tb-caution-doc-chip b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
      .tb-caution-doc-option small,.tb-caution-doc-chip small{color:var(--muted);font-size:11px;line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
      .tb-caution-match-foot span{font-weight:900;border-radius:999px;padding:7px 10px;background:rgba(148,163,184,.12);}
      .tb-caution-match-foot span.ok{color:#047857;background:rgba(16,185,129,.12);}
      .tb-caution-match-foot span.warn{color:#b45309;background:rgba(245,158,11,.14);}
      .tb-caution-match-foot a{font-size:12px;font-weight:800;color:#2563eb;}
      .tb-caution-doc-chips{display:flex;gap:8px;flex-wrap:wrap;}
      .tb-caution-doc-chip{border:1px solid var(--border);border-radius:14px;background:rgba(255,255,255,.76);padding:7px 9px;display:grid;grid-template-columns:auto minmax(0,1fr);grid-template-rows:auto auto;gap:2px 8px;align-items:center;max-width:260px;color:var(--text);cursor:pointer;}
      .tb-caution-doc-chip span{grid-row:1 / 3;}
      .tb-caution-subcats,.tb-caution-recent{display:flex;flex-direction:column;gap:8px;}
      .tb-caution-subcat-row,.tb-caution-tx-row{display:flex;justify-content:space-between;gap:12px;border:1px solid var(--border);border-radius:14px;padding:10px;background:rgba(255,255,255,.62);}
      .tb-caution-form,.tb-caution-card,.tb-cautions-empty{border:1px solid var(--border);border-radius:18px;background:rgba(255,255,255,.72);padding:14px;box-shadow:0 10px 30px rgba(15,23,42,.06);}
      .tb-caution-form-title{font-weight:900;margin-bottom:10px;}
      .tb-caution-form{display:flex;flex-direction:column;gap:10px;}
      .tb-caution-form label{display:flex;flex-direction:column;gap:6px;font-size:12px;font-weight:800;color:var(--muted);}
      .tb-caution-form input,.tb-caution-form select,.tb-caution-form textarea{width:100%;border:1px solid var(--border);border-radius:12px;background:var(--card);color:var(--text);padding:10px 11px;font:inherit;}
      .tb-caution-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
      .tb-caution-form-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;}
      .tb-caution-form-error{color:#b91c1c;font-weight:800;font-size:12px;}
      .tb-cautions-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;}
      .tb-caution-card{display:flex;flex-direction:column;gap:10px;}
      .tb-caution-card.overdue{border-color:rgba(245,158,11,.42);}
      .tb-caution-card-main,.tb-caution-card-foot{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;}
      .tb-caution-title{font-weight:900;font-size:16px;}
      .tb-caution-meta,.tb-caution-note,.tb-caution-amount span{color:var(--muted);font-size:12px;line-height:1.45;}
      .tb-caution-amount{text-align:right;white-space:nowrap;}
      .tb-caution-amount strong{display:block;font-size:18px;}
      .tb-caution-status{display:inline-flex;border-radius:999px;padding:6px 9px;font-size:12px;font-weight:900;background:rgba(148,163,184,.12);}
      .tb-caution-status.held{color:#0369a1;background:rgba(14,165,233,.12);}
      .tb-caution-status.partial{color:#a16207;background:rgba(245,158,11,.14);}
      .tb-caution-status.returned{color:#047857;background:rgba(16,185,129,.13);}
      .tb-caution-status.lost{color:#b91c1c;background:rgba(239,68,68,.12);}
      .tb-caution-actions{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;}
      .tb-caution-actions button{border:1px solid var(--border);background:var(--card);border-radius:999px;padding:7px 10px;font-weight:800;cursor:pointer;color:var(--text);}
      .tb-caution-actions button.danger{color:#b91c1c;border-color:rgba(239,68,68,.28);}
      .tb-cautions-empty{display:flex;flex-direction:column;gap:6px;color:var(--muted);}
      .tb-cautions-empty strong{color:var(--text);}
      @media(max-width:880px){.tb-cautions-layout{grid-template-columns:1fr}.tb-cautions-summary{grid-template-columns:1fr 1fr}.tb-cautions-head,.tb-caution-analysis-head,.tb-caution-wink{flex-direction:column;align-items:flex-start}.tb-caution-card-main,.tb-caution-card-foot{flex-direction:column}.tb-caution-amount,.tb-caution-analysis-total{text-align:left}.tb-caution-actions{justify-content:flex-start}.tb-caution-analysis-kpis,.tb-caution-match-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(st);
  }

  function bindOnce() {
    if (window.__tbCautionsBound) return;
    window.__tbCautionsBound = true;
    document.addEventListener("click", async (ev) => {
      const edit = ev.target?.closest?.("[data-tb-caution-edit]");
      if (edit) {
        ev.preventDefault();
        const row = CACHE.rows.find(r => String(r.id) === String(edit.getAttribute("data-tb-caution-edit")));
        const host = document.getElementById("tb-caution-form-host");
        if (host && row) host.innerHTML = formHtml(row);
        return;
      }
      const cancel = ev.target?.closest?.("[data-tb-caution-cancel]");
      if (cancel) {
        ev.preventDefault();
        const host = document.getElementById("tb-caution-form-host");
        if (host) host.innerHTML = formHtml();
        return;
      }
      const ret = ev.target?.closest?.("[data-tb-caution-return]");
      if (ret) {
        ev.preventDefault();
        try { await updateStatus(ret.getAttribute("data-tb-caution-return"), "returned"); await renderCautions("returned"); }
        catch (e) { alert(e && (e.message || e.code) || e); }
        return;
      }
      const del = ev.target?.closest?.("[data-tb-caution-delete]");
      if (del) {
        ev.preventDefault();
        if (!confirm(atxt("Supprimer cette caution ?", "Delete this deposit?"))) return;
        try { await removeCaution(del.getAttribute("data-tb-caution-delete")); await renderCautions("delete"); }
        catch (e) { alert(e && (e.message || e.code) || e); }
      }
    });
    document.addEventListener("change", async (ev) => {
      const toggle = ev.target?.closest?.("[data-tb-caution-hide-settled]");
      if (!toggle) return;
      setHideSettled(!!toggle.checked);
      await renderCautions("hide-settled");
    });
    document.addEventListener("input", (ev) => {
      const returnFilter = ev.target?.closest?.("[data-tb-caution-return-filter]");
      if (returnFilter) {
        const q = normKey(returnFilter.value || "");
        const picker = returnFilter.closest("[data-tb-caution-return-picker]");
        picker?.querySelectorAll?.("[data-tb-caution-return-option]").forEach((option) => {
          const search = String(option.getAttribute("data-search") || "");
          option.style.display = !q || search.includes(q) ? "" : "none";
        });
        return;
      }
      const docFilter = ev.target?.closest?.("[data-tb-caution-doc-filter]");
      if (docFilter) {
        const q = normKey(docFilter.value || "");
        const picker = docFilter.closest("[data-tb-caution-doc-picker]");
        picker?.querySelectorAll?.("[data-tb-caution-doc-option]").forEach((option) => {
          const search = String(option.getAttribute("data-search") || "");
          option.style.display = !q || search.includes(q) ? "" : "none";
        });
      }
    });
    document.addEventListener("submit", async (ev) => {
      const reconciliationForm = ev.target?.matches?.("[data-tb-caution-reconcile-form]") ? ev.target : null;
      if (reconciliationForm) {
        ev.preventDefault();
        const submit = reconciliationForm.querySelector('button[type="submit"]');
        const old = submit ? submit.textContent : "";
        const err = reconciliationForm.querySelector("[data-tb-caution-error]");
        if (err) { err.hidden = true; err.textContent = ""; }
        if (submit) { submit.disabled = true; submit.textContent = atxt("Enregistrement...", "Saving..."); }
        try {
          await saveReconciliation(reconciliationForm);
          await renderCautions("reconciliation-saved");
        } catch (e) {
          console.error("[TB][cautions] reconciliation save failed", e);
          if (err) { err.hidden = false; err.textContent = String(e && (e.message || e.details || e.code) || e); }
        } finally {
          if (submit) { submit.disabled = false; submit.textContent = old || atxt("Enregistrer", "Save"); }
        }
        return;
      }
      const form = ev.target?.matches?.("[data-tb-caution-form]") ? ev.target : null;
      if (!form) return;
      ev.preventDefault();
      const submit = form.querySelector('button[type="submit"]');
      const old = submit ? submit.textContent : "";
      const err = form.querySelector("[data-tb-caution-error]");
      if (err) { err.hidden = true; err.textContent = ""; }
      if (submit) { submit.disabled = true; submit.textContent = atxt("Enregistrement...", "Saving..."); }
      try {
        await saveFromForm(form);
        await renderCautions("save");
      } catch (e) {
        console.error("[TB][cautions] save failed", e);
        if (err) { err.hidden = false; err.textContent = String(e && (e.message || e.details || e.code) || e); }
      } finally {
        if (submit) { submit.disabled = false; submit.textContent = old || atxt("Enregistrer", "Save"); }
      }
    });
  }

  async function renderCautions(reason) {
    styles();
    bindOnce();
    const root = document.getElementById("cautions-root") || document.getElementById("view-cautions");
    if (!root) return;
    root.innerHTML = `<div class="tb-cautions-shell"><div class="tb-cautions-head"><div><h2>${esc(atxt("Cautions", "Deposits"))}</h2><p>${esc(atxt("Chargement...", "Loading..."))}</p></div></div></div>`;
    const data = await loadCautions();
    const analysis = cautionTxAnalysis();
    const build = window.TB_BUILD_LABEL || "V10";
    root.innerHTML = `<div class="tb-cautions-shell">
      <div class="tb-cautions-head">
        <div>
          <h2>${esc(atxt("Cautions", "Deposits"))}</h2>
          <p>${esc(atxt("Suis les cautions versees, les retours prevus, les pertes et le montant encore immobilise.", "Track paid deposits, expected returns, losses and locked amount."))}</p>
        </div>
        <div class="tb-cautions-badge">${esc(build)} · ${esc(atxt("Cautions", "Deposits"))}</div>
      </div>
      ${statusHtml(data)}
      ${winkHtml(data.rows, analysis)}
      ${summaryHtml(data.rows, analysis)}
      ${analysisHtml(analysis)}
      ${reconciliationHtml(analysis, data.rows)}
      <div class="tb-cautions-layout">
        <div id="tb-caution-form-host">${formHtml()}</div>
        ${listHtml(data.rows)}
      </div>
    </div>`;
  }

  window.renderCautions = renderCautions;
  try {
    window.tbOnLangChange = window.tbOnLangChange || [];
    if (!window.__tbCautionsLangBound) {
      window.__tbCautionsLangBound = true;
      window.tbOnLangChange.push(() => {
        try {
          const view = document.getElementById("view-cautions");
          if (view && !view.classList.contains("hidden")) renderCautions("lang");
        } catch (_) {}
      });
    }
  } catch (_) {}
})();
