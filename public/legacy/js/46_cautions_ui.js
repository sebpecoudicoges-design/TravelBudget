/* TravelBudget - Cautions
   Suivi des depots/cautions immobilises, sans mutation automatique des wallets. */
(function () {
  let CACHE = { rows: [], empty: true, demo: false };

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
  function isCautionTx(tx) {
    return txType(tx) === "expense" && normKey(tx?.category) === "caution" && txTravelMatches(tx);
  }
  function cautionTxs() {
    return (Array.isArray(window.state?.transactions) ? window.state.transactions : [])
      .filter(isCautionTx)
      .sort((a, b) => String(txDate(b)).localeCompare(String(txDate(a))));
  }
  function cautionTxAnalysis() {
    const cur = baseCurrency();
    const rows = cautionTxs();
    const bySub = new Map();
    let paid = 0;
    let planned = 0;
    for (const tx of rows) {
      const amount = convertAmount(txAmount(tx), tx.currency || tx.original_currency || cur, cur, txDate(tx));
      const converted = amount === null ? txAmount(tx) : amount;
      if (txPaid(tx)) paid += converted;
      else planned += converted;
      const sub = String(tx?.subcategory || "").trim() || atxt("Sans sous-categorie", "No subcategory");
      const prev = bySub.get(sub) || { name: sub, total: 0, paid: 0, planned: 0, count: 0 };
      prev.total += converted;
      if (txPaid(tx)) prev.paid += converted;
      else prev.planned += converted;
      prev.count += 1;
      bySub.set(sub, prev);
    }
    return {
      currency: cur,
      rows,
      total: paid + planned,
      paid,
      planned,
      bySub: Array.from(bySub.values()).sort((a, b) => b.total - a.total)
    };
  }

  async function loadCautions() {
    if (isOffline()) {
      const rows = Array.isArray(window.state?.cautionDeposits) ? window.state.cautionDeposits : [];
      CACHE = { rows, empty: !rows.length, demo: false, offline: true };
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
      CACHE = { rows, empty: !rows.length, demo: false, reason: "" };
      try {
        if (window.state) state.cautionDeposits = rows;
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
      <div class="tb-caution-kpi tx"><span>${esc(atxt("Categorie Caution", "Caution category"))}</span><strong>${esc(money(analysis?.total || 0, analysis?.currency || cur))}</strong></div>
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
    if (!rows.length) {
      return `<div class="tb-cautions-empty">
        <strong>${esc(atxt("Aucune caution suivie.", "No deposit tracked."))}</strong>
        <span>${esc(atxt("Ajoute une caution pour voir ce qui reste immobilise, rendu, perdu ou en retard.", "Add a deposit to track what remains locked, returned, lost or overdue."))}</span>
      </div>`;
    }
    return `<div class="tb-cautions-grid">${rows.map(cardHtml).join("")}</div>`;
  }

  function statusHtml(data) {
    if (!data?.offline && !data?.reason) return "";
    const msg = data?.offline
      ? atxt("Mode hors ligne : affichage depuis le dernier snapshot local.", "Offline mode: showing the latest local snapshot.")
      : `${atxt("Cautions chargees en mode degrade.", "Deposits loaded in degraded mode.")} ${data.reason || ""}`;
    return `<div class="tb-caution-status-panel ${data?.reason ? "error" : ""}">${esc(msg)}</div>`;
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
        <div><span>${esc(atxt("A payer", "Planned"))}</span><strong>${esc(money(analysis.planned, analysis.currency))}</strong></div>
        <div><span>${esc(atxt("Transactions", "Transactions"))}</span><strong>${esc(rows.length)}</strong></div>
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
      .tb-caution-analysis-kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;}
      .tb-caution-analysis-kpis>div{border:1px solid var(--border);border-radius:14px;padding:10px;background:rgba(248,250,252,.72);}
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
      @media(max-width:880px){.tb-cautions-layout{grid-template-columns:1fr}.tb-cautions-summary{grid-template-columns:1fr 1fr}.tb-cautions-head,.tb-caution-analysis-head{flex-direction:column}.tb-caution-card-main,.tb-caution-card-foot{flex-direction:column}.tb-caution-amount,.tb-caution-analysis-total{text-align:left}.tb-caution-actions{justify-content:flex-start}.tb-caution-analysis-kpis{grid-template-columns:1fr}}
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
    document.addEventListener("submit", async (ev) => {
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
      ${summaryHtml(data.rows, analysis)}
      ${analysisHtml(analysis)}
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
