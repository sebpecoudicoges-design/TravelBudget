/* =========================
   Onboarding / Empty states
   ========================= */
function hideOnboardingPanel() {
  try { localStorage.setItem("tb_onboarding_hide_v1", "1"); } catch (_) {}
  const el = document.getElementById("onboarding-panel");
  if (el) el.style.display = "none";
}

function renderOnboardingPanel() {
  const panel = document.getElementById("onboarding-panel");
  const body = document.getElementById("onboarding-panel-body");
  if (!panel || !body) return;

  // User can hide it.
  try {
    if (localStorage.getItem("tb_onboarding_hide_v1") === "1") {
      panel.style.display = "none";
      return;
    }
  } catch (_) {}

  const wallets = (window.state && Array.isArray(state.wallets)) ? state.wallets : [];
  const txs = (window.state && Array.isArray(state.transactions)) ? state.transactions : [];

  // "Periods" heuristic: we consider segments/settings present if we have at least one segment or at least one setting row.
  const hasSegments = !!(window.state && Array.isArray(state.segments) && state.segments.length);
  const hasSettings = !!(window.state && Array.isArray(state.settings) && state.settings.length);

  const steps = [];
  if (!wallets.length) steps.push(tbT ? tbT("onboarding.step.wallet") : "1) Crée un <b>wallet</b> (ex : Cash THB).");
  if (!hasSegments && !hasSettings) steps.push(tbT ? tbT("onboarding.step.period") : "2) Configure ta <b>période</b> et ta devise principale.");
  if (!txs.length) steps.push(tbT ? tbT("onboarding.step.tx") : "3) Ajoute une première transaction (ex : <i>Déjeuner 120 THB</i>).");

  if (!steps.length) {
    panel.style.display = "none";
    return;
  }

  panel.style.display = "block";
  body.innerHTML = `
    <div>${steps.join("<br/>")}</div>
    <div style="margin-top:6px; opacity:.8;">${tbT ? tbT("onboarding.tip") : "Astuce : sur chaque champ sensible, clique sur le <b>?</b> pour une explication."}</div>
  `;
}

/* =========================
   Dashboard render
   ========================= */
function renderWallets() {
  // Sur certaines pages (reset/recovery), le DOM dashboard n'existe pas.
  const container = document.getElementById("wallets-container");
  if (!container) return;


  // Onboarding panel / empty states
  renderOnboardingPanel();

  
  container.innerHTML = "";

  // Actions
  const actions = document.createElement("div");
  actions.style.display = "flex";
  actions.style.gap = "10px";
  actions.style.flexWrap = "wrap";
  actions.style.marginBottom = "12px";
  actions.innerHTML = `
    <button class="btn primary" onclick="createWallet()">+ Wallet</button>
  `;
  container.appendChild(actions);


const wallets = Array.isArray(state.wallets) ? state.wallets : [];
// If some wallets are missing a type, propose a guided fix (soft migration).
const missingType = wallets.filter(w => !String(w?.type || "").trim());
if (missingType.length) {
  const btn = document.createElement("button");
  btn.className = "btn";
  btn.textContent = `⚙ Corriger types (${missingType.length})`;
  btn.onclick = () => openWalletTypesFix();
  actions.appendChild(btn);
}
if (!wallets.length) {
  const empty = document.createElement("div");
  empty.className = "hint";
  empty.style.padding = "10px";
  empty.style.border = "1px dashed rgba(0,0,0,.25)";
  empty.style.borderRadius = "10px";
  empty.style.background = "rgba(0,0,0,.02)";
  empty.innerHTML = `
    <b>${tbT ? tbT("wallet.empty.title") : "Aucun wallet."}</b><br/>
    ${tbT ? tbT("wallet.empty.body") : "Crée au moins 1 wallet pour suivre ton solde (ex : Cash THB, Banque EUR)."}
  `;
  container.appendChild(empty);

  // Quick onboarding block
  const ob = document.createElement("div");
  ob.className = "hint";
  ob.style.padding = "10px";
  ob.style.border = "1px solid rgba(0,0,0,.08)";
  ob.style.borderRadius = "12px";
  ob.style.background = "rgba(0,0,0,.02)";
  ob.style.marginTop = "10px";
  const T = (window.tbT ? tbT : (k)=>k);
  ob.innerHTML = `
    <div style="display:flex; justify-content:space-between; gap:10px; align-items:center; flex-wrap:wrap;">
      <div style="font-weight:600;">${T("onboarding.title")}</div>
      <div style="display:flex; gap:8px; flex-wrap:wrap;">
        <button class="btn" type="button" onclick="showView('settings')">Settings</button>
        <button class="btn" type="button" onclick="showView('help')">${T("nav.help")}</button>
      </div>
    </div>
    <div style="margin-top:8px;" class="muted">
      <div>${T("onboarding.step.wallet")}</div>
      <div>${T("onboarding.step.period")}</div>
      <div>${T("onboarding.step.tx")}</div>
      <div style="margin-top:6px;">${T("onboarding.tip")}</div>
    </div>
  `;
  container.appendChild(ob);
}

  // Wallets list (draggable reorder)
  const listEl = document.createElement("div");
  listEl.id = "wallets-list";
  container.appendChild(listEl);

  const today = toLocalISODate(new Date());
  const infoToday = (typeof getDailyBudgetInfoForDate === "function") ? getDailyBudgetInfoForDate(today) : { remaining: getDailyBudgetForDate(today), daily: state?.period?.dailyBudgetBase || 1, baseCurrency: state?.period?.baseCurrency };
  const budgetToday = Number(infoToday.remaining) || 0;
  const daily = Number(infoToday.daily) || (state?.period?.dailyBudgetBase || 1);
  const base = String(infoToday.baseCurrency || state?.period?.baseCurrency || "EUR").toUpperCase();

  const orderedWallets = (typeof sortWalletsBySavedOrder === "function")
    ? sortWalletsBySavedOrder([...(state.wallets || [])])
    : ([...(state.wallets || [])]);

  for (const w of orderedWallets) {
    const isBase = w.currency === base;
    const barPct = isBase ? Math.max(0, Math.min(100, (budgetToday / daily) * 100)) : 0;

    const div = document.createElement("div");
    div.className = "wallet wallet-item";
    div.dataset.walletId = w.id;
    div.innerHTML = `
      <div style="display:flex; justify-content:space-between; gap:10px; align-items:flex-start; flex-wrap:wrap;">
        <div>
          <h3>${w.name} (${w.currency})</h3>
          <p>Solde : <strong style="color:var(--text);">${fmtMoney((typeof window.tbGetWalletEffectiveBalance === "function" ? window.tbGetWalletEffectiveBalance(w.id) : w.balance), w.currency)}</strong></p>
          ${isBase
            ? `<p class="muted">Aujourd’hui (${today}) : budget dispo <strong>${budgetToday.toFixed(2)} ${base}</strong></p>`
            : `<p class="muted">Budget/jour calculé (${base})</p>`}
        </div>
        <div style="display:flex; flex-direction:column; gap:8px; min-width:190px;">
          <button class="btn primary" onclick="openTxModal('expense','${w.id}')">+ Dépense</button>
          <button class="btn" onclick="openTxModal('income','${w.id}')">+ Entrée</button>
          <button class="btn" onclick="editWallet('${w.id}')">✏️ Modifier</button>
          <button class="btn" onclick="adjustWalletBalance('${w.id}')">⚙ Ajuster solde</button>
          <button class="btn" style="border:1px solid rgba(239,68,68,0.6); color: rgba(239,68,68,0.95);" onclick="deleteWallet('${w.id}')">🗑 Supprimer</button>
        </div>
      </div>

      ${isBase ? `
        <div class="bar"><div style="width:${barPct.toFixed(0)}%;"></div></div>
        <div class="muted" style="margin-top:6px;">Niveau budget dispo vs budget/jour</div>
      ` : ""}
    `;
    listEl.appendChild(div);
  }

  // Enable drag & drop reorder
  try { if (typeof enableWalletsReorderDrag === "function") enableWalletsReorderDrag(listEl); } catch (e) {}
}

// Budget spent per day (base currency) computed from transactions.
// Includes Trip shares (payNow=false) because they affect budget; excludes out-of-budget expenses.

// Budget spent per day computed from transactions, expressed in the *segment base currency of that day*.
function budgetSpentBaseForDateFromTx(dateStr) {
  try {
    const txs = Array.isArray(state.transactions) ? state.transactions : [];
    const target = String(dateStr || "");
    if (!target) return 0;

    let sum = 0;
    for (const t of txs) {
      const type = String(t?.type || "").toLowerCase();
      if (type !== "expense") continue;

      const affectsBudget =
        (t.affectsBudget === undefined || t.affectsBudget === null) ? true : !!t.affectsBudget;
      if (!affectsBudget) continue;

      const outOfBudget = !!t.outOfBudget || !!t.out_of_budget;
      if (outOfBudget) continue;

      const s = parseISODateOrNull(t.dateStart || t.date_start || t.date || null);
      const e = parseISODateOrNull(t.dateEnd || t.date_end || t.dateStart || t.date_start || t.date || null);
      if (!s || !e) continue;

      const sds = toLocalISODate(s);
      const eds = toLocalISODate(e);
      if (target < sds || target > eds) continue;

      const amt = Number(t.amount);
      if (!isFinite(amt) || amt === 0) continue;

      const days = dayCountInclusive(s, e);
      const perDayInTxCur = amt / days;

      const perDayBase = (typeof amountToBudgetBaseForDate === "function")
        ? amountToBudgetBaseForDate(perDayInTxCur, t.currency, target)
        : amountToBase(perDayInTxCur, t.currency);

      sum += perDayBase;
    }
    return sum;
  } catch (_) {
    return 0;
  }
}

const DAILY_BUDGET_VIEW_KEY = "travelbudget_daily_budget_view_v1";
const DAILY_BUDGET_WINDOW_DAYS = 7;

function _dbParseISO(iso) { return (typeof parseISODateOrNull === "function") ? parseISODateOrNull(iso) : null; }
function _dbISO(d){ return (typeof toLocalISODate === "function") ? toLocalISODate(d) : ""; }
function _dbAddDays(dateISO, delta){
  const d = _dbParseISO(dateISO);
  if (!d) return dateISO;
  const x = new Date(d);
  x.setDate(x.getDate() + (Number(delta)||0));
  return _dbISO(x);
}
function _dbClampISO(dateISO, minISO, maxISO){
  const d=_dbParseISO(dateISO), mi=_dbParseISO(minISO), ma=_dbParseISO(maxISO);
  if(!d||!mi||!ma) return dateISO;
  if(d<mi) return minISO;
  if(d>ma) return maxISO;
  return dateISO;
}
function _dbLoadView(){
  try{
    const raw=localStorage.getItem(DAILY_BUDGET_VIEW_KEY);
    if(!raw) return null;
    const o=JSON.parse(raw);
    if(o && typeof o.startISO==="string") return o;
  }catch(_){}
  return null;
}
function _dbSaveView(view){
  try{ localStorage.setItem(DAILY_BUDGET_VIEW_KEY, JSON.stringify(view||{})); }catch(_){}
}

function renderDailyBudget() {
  const container = document.getElementById("daily-budget-container");
  if (!container) return; // page reset / dom partiel
  container.innerHTML = "";

  const start = parseISODateOrNull(state?.period?.start);
  const end = parseISODateOrNull(state?.period?.end);
  if (!start || !end) return;

  // base currency can vary by segment; computed per-day.

  
  // --- Pagination / fenêtre glissante (7 jours) ---
  const periodStartISO = state?.period?.start;
  const periodEndISO = state?.period?.end;

  const todayISO = toLocalISODate(new Date());
  let segStartISO = periodStartISO;
  let segEndISO = periodEndISO;

  try {
    if (typeof getBudgetSegmentForDate === "function") {
      const seg = getBudgetSegmentForDate(todayISO);
      if (seg) {
        segStartISO = String(seg.start || seg.start_date || segStartISO);
        segEndISO = String(seg.end || seg.end_date || segEndISO);
      }
    }
  } catch (_) {}

  let view = _dbLoadView();
  if (!view || !view.startISO) {
    const baseStart = _dbAddDays(todayISO, -3);
    const minISO = segStartISO || periodStartISO;
    const maxISO = segEndISO || periodEndISO;
    const clampedStart = _dbClampISO(baseStart, minISO, maxISO);
    view = { mode: (segStartISO && segEndISO) ? "segment" : "voyage", startISO: clampedStart };
    _dbSaveView(view);
  }

  const boundMinISO = (view.mode === "voyage") ? periodStartISO : (segStartISO || periodStartISO);
  const boundMaxISO = (view.mode === "voyage") ? periodEndISO : (segEndISO || periodEndISO);

  let viewStartISO = _dbClampISO(view.startISO, boundMinISO, boundMaxISO);
  let viewEndISO = _dbAddDays(viewStartISO, DAILY_BUDGET_WINDOW_DAYS - 1);
  viewEndISO = _dbClampISO(viewEndISO, boundMinISO, boundMaxISO);

  // Controls
  const ctrl = document.createElement("div");
  ctrl.className = "card";
  ctrl.style.marginBottom = "10px";
  ctrl.style.padding = "10px";
  ctrl.innerHTML = `
    <div style="display:flex; flex-wrap:wrap; gap:8px; align-items:center; justify-content:space-between;">
      <div style="display:flex; flex-wrap:wrap; gap:8px; align-items:center;">
        <button class="btn" id="db-prev">← Avant</button>
        <button class="btn" id="db-today">Aujourd'hui</button>
        <button class="btn" id="db-next">Après →</button>
      </div>
      <div style="display:flex; flex-wrap:wrap; gap:8px; align-items:center;">
        <span class="muted" style="font-size:12px;">Affichage :</span>
        <select class="input" id="db-mode" style="min-width:170px;">
          <option value="segment">Période courante</option>
          <option value="voyage">Tout le voyage</option>
        </select>
        <span class="muted" style="font-size:12px;">${viewStartISO} → ${viewEndISO}</span>
      </div>
    </div>
  `;
  container.appendChild(ctrl);

  const modeSel = ctrl.querySelector("#db-mode");
  if (modeSel) {
    modeSel.value = (view.mode === "voyage") ? "voyage" : "segment";
    modeSel.onchange = () => {
      const v = (modeSel.value === "voyage") ? "voyage" : "segment";
      const baseStart = _dbAddDays(todayISO, -3);
      const minISO = (v === "voyage") ? periodStartISO : (segStartISO || periodStartISO);
      const maxISO = (v === "voyage") ? periodEndISO : (segEndISO || periodEndISO);
      const clampedStart = _dbClampISO(baseStart, minISO, maxISO);
      _dbSaveView({ mode: v, startISO: clampedStart });
      renderDailyBudget();
    };
  }

  const prevBtn = ctrl.querySelector("#db-prev");
  const nextBtn = ctrl.querySelector("#db-next");
  const todayBtn = ctrl.querySelector("#db-today");
  if (prevBtn) prevBtn.onclick = () => {
    const newStart = _dbAddDays(viewStartISO, -DAILY_BUDGET_WINDOW_DAYS);
    _dbSaveView({ mode: view.mode, startISO: newStart });
    renderDailyBudget();
  };
  if (nextBtn) nextBtn.onclick = () => {
    const newStart = _dbAddDays(viewStartISO, DAILY_BUDGET_WINDOW_DAYS);
    _dbSaveView({ mode: view.mode, startISO: newStart });
    renderDailyBudget();
  };
  if (todayBtn) todayBtn.onclick = () => {
    const baseStart = _dbAddDays(todayISO, -3);
    const minISO = (view.mode === "voyage") ? periodStartISO : (segStartISO || periodStartISO);
    const maxISO = (view.mode === "voyage") ? periodEndISO : (segEndISO || periodEndISO);
    const clampedStart = _dbClampISO(baseStart, minISO, maxISO);
    _dbSaveView({ mode: view.mode, startISO: clampedStart });
    renderDailyBudget();
  };

  const dStart = _dbParseISO(viewStartISO);
  const dEnd = _dbParseISO(viewEndISO);
  if (!dStart || !dEnd) return;

  forEachDateInclusive(dStart, dEnd, (d) => {
    const dateStr = toLocalISODate(d);
    const info = (typeof getDailyBudgetInfoForDate === "function") ? getDailyBudgetInfoForDate(dateStr) : { remaining: state.period.dailyBudgetBase - budgetSpentBaseForDateFromTx(dateStr), daily: state.period.dailyBudgetBase, baseCurrency: state.period.baseCurrency };
    const baseDay = String(info.baseCurrency || state.period.baseCurrency || "EUR").toUpperCase();
    const spentBudget = budgetSpentBaseForDateFromTx(dateStr);
    const budget = Number(info.daily) - spentBudget;
    const details = (state.allocations || []).filter((a) => a && a.dateStr === dateStr);

    const div = document.createElement("div");
    div.className = "day";
    div.innerHTML = `
      <div class="top">
        <div><strong>${dateStr}</strong></div>
        <div class="pill ${budgetClass(budget)}"><span class="dot"></span>${budget.toFixed(0)} ${baseDay}</div>
      </div>
      <div style="margin-top:6px; color:#6b7280; font-size:12px; display:flex; justify-content:space-between; gap:10px;">
        <div>Budget utilisé : <b style="color:#111827;">${spentBudget.toFixed(0)} ${baseDay}</b></div>
        <div>Objectif : <b style="color:#111827;">${Number(info.daily).toFixed(0)} ${baseDay}</b></div>
      </div>
      ${details.length
        ? `<div class="details">${details.map((x) => `• ${x.label} : ${Number(x.amountBase).toFixed(0)} ${x.baseCurrency || baseDay}`).join("<br>")}</div>`
        : `<div class="details">Aucune allocation</div>`}
    `;
    container.appendChild(div);
  });
}

/* =========================
   Wallet Create Dialog (UI)
   - Lightweight modal (no external deps)
   ========================= */
function tbOpenWalletDialog() {
  return new Promise((resolve) => {
    // inject styles once
    if (!document.getElementById("tbWalletDlgStyles")) {
      const st = document.createElement("style");
      st.id = "tbWalletDlgStyles";
      st.textContent = `
        .tb-dlg-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;}
        .tb-dlg{background:#fff;border-radius:14px;max-width:520px;width:100%;box-shadow:0 10px 40px rgba(0,0,0,.25);overflow:hidden;}
        .tb-dlg-h{padding:14px 16px;border-bottom:1px solid rgba(0,0,0,.08);font-weight:700;}
        .tb-dlg-b{padding:16px;}
        .tb-dlg-row{margin-bottom:12px;}
        .tb-dlg-row label{display:block;font-size:12px;opacity:.75;margin-bottom:6px;}
        .tb-dlg-row input,.tb-dlg-row select{width:100%;padding:10px 12px;border:1px solid rgba(0,0,0,.18);border-radius:10px;outline:none;}
        .tb-dlg-row .hint{font-size:12px;opacity:.7;margin-top:6px;}
        .tb-dlg-f{display:flex;gap:10px;justify-content:flex-end;padding:14px 16px;border-top:1px solid rgba(0,0,0,.08);}
        .tb-dlg-btn{padding:10px 14px;border-radius:10px;border:1px solid rgba(0,0,0,.18);background:#fff;cursor:pointer;}
        .tb-dlg-btn.primary{background:#111;color:#fff;border-color:#111;}
        .tb-dlg-err{color:#b00020;font-size:12px;margin-top:8px;display:none;}
      `;
      document.head.appendChild(st);
    }

    const backdrop = document.createElement("div");
    backdrop.className = "tb-dlg-backdrop";
    backdrop.innerHTML = `
      <div class="tb-dlg" role="dialog" aria-modal="true" aria-label="Créer un wallet">
        <div class="tb-dlg-h">Créer un wallet</div>
        <div class="tb-dlg-b">
          <div class="tb-dlg-row">
            <label>Nom</label>
            <input id="tbWName" type="text" placeholder="ex: Cash (THB), Banque EUR" />
          </div>
          <div class="tb-dlg-row">
            <label>Devise</label>
            <input id="tbWCur" type="text" placeholder="ex: EUR, THB, VND" maxlength="6" />
            <div class="hint">Code devise (ISO) — ex: EUR, THB.</div>
          </div>
          <div class="tb-dlg-row">
            <label>Type</label>
            <select id="tbWType">
              <option value="cash">Espèces (cash)</option>
              <option value="bank">Banque (bank)</option>
              <option value="card">Carte (card)</option>
              <option value="savings">Épargne (savings)</option>
              <option value="other">Autre (other)</option>
            </select>
            <div class="hint">Le type sert au calcul du KPI “Cash” et du runway (burn).</div>
          </div>
          <div class="tb-dlg-row">
            <label>Solde initial</label>
            <input id="tbWBal" type="text" inputmode="decimal" placeholder="0" value="0" />
          </div>
          <div id="tbWErr" class="tb-dlg-err"></div>
        </div>
        <div class="tb-dlg-f">
          <button class="tb-dlg-btn" id="tbWCancel" type="button">Annuler</button>
          <button class="tb-dlg-btn primary" id="tbWCreate" type="button">Créer</button>
        </div>
      </div>
    `;
    document.body.appendChild(backdrop);

    const $ = (id) => backdrop.querySelector(id);
    const nameEl = $("#tbWName");
    const curEl = $("#tbWCur");
    const typeEl = $("#tbWType");
    const balEl = $("#tbWBal");
    const errEl = $("#tbWErr");

    function close(val) {
      try { backdrop.remove(); } catch (_) {}
      resolve(val);
    }

    function showErr(msg) {
      errEl.textContent = msg;
      errEl.style.display = msg ? "block" : "none";
    }

    function validateAndReturn() {
      const name = String(nameEl.value || "").trim();
      if (!name) return showErr("Nom requis.");

      const currency = String(curEl.value || "").trim().toUpperCase();
      if (!currency) return showErr("Devise requise.");
      if (!/^[A-Z]{3,6}$/.test(currency)) return showErr("Devise invalide (ex: EUR, THB).");

      const type = String(typeEl.value || "").trim().toLowerCase();
      const allowed = ["cash", "bank", "card", "savings", "other"];
      if (!allowed.includes(type)) return showErr("Type invalide.");

      const balStr = String(balEl.value || "0").replace(",", ".").trim();
      const balance = Number(balStr);
      if (!isFinite(balance)) return showErr("Solde invalide.");

      showErr("");
      close({ name, currency, type, balance });
    }

    // close on backdrop click (outside)
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) close(null);
    });
    $("#tbWCancel").addEventListener("click", () => close(null));
    $("#tbWCreate").addEventListener("click", validateAndReturn);

    // Enter key
    backdrop.addEventListener("keydown", (e) => {
      if (e.key === "Escape") return close(null);
      if (e.key === "Enter") {
        e.preventDefault();
        validateAndReturn();
      }
    });

    // focus first input
    setTimeout(() => { try { nameEl.focus(); } catch (_) {} }, 0);
  });
}


/* =========================
   Wallet Type (soft migration) + Edit Dialog
   ========================= */

function tbEscHTML(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function tbInferWalletTypeFromName(name) {
  const raw = String(name || "");
  let s = raw.toLowerCase();
  try {
    s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  } catch (_) {}
  s = s.replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

  const has = (w) => s.includes(w);

  // cash
  if (has("cash") || has("espece") || has("especes") || has("liquide") || has("billet") || has("poche")) return "cash";
  // bank
  if (has("bank") || has("banque") || has("compte") || has("rib") || has("bnp") || has("revolut") || has("wise") || has("n26")) return "bank";
  // card
  if (has("card") || has("carte") || has("cb") || has("visa") || has("mastercard")) return "card";
  // savings
  if (has("savings") || has("epargne") || has("livret") || has("saving")) return "savings";

  return "other";
}

function tbWalletTypeLabel(t) {
  const x = String(t || "").toLowerCase();
  if (window.tbT) {
    // optional i18n keys if you add them later
    const k = "wallet.type." + x;
    const tr = tbT(k);
    if (tr && tr !== k) return tr;
  }
  if (x === "cash") return "Cash (espèces)";
  if (x === "bank") return "Banque";
  if (x === "card") return "Carte";
  if (x === "savings") return "Épargne";
  return "Autre";
}

function tbOpenWalletEditDialog(wallet) {
  return new Promise((resolve) => {
    const w = wallet || {};
    // reuse styles from create dialog
    if (!document.getElementById("tbWalletDlgStyles")) {
      // if create dialog hasn't injected it yet, call it once to ensure styles exist
      // (no-op resolve)
      tbOpenWalletDialog().then(() => {});
    }

    const back = document.createElement("div");
    back.className = "tb-dlg-backdrop";

    const dlg = document.createElement("div");
    dlg.className = "tb-dlg";

    dlg.innerHTML = `
      <div class="tb-dlg-h">Modifier wallet</div>
      <div class="tb-dlg-b">
        <div class="tb-dlg-row">
          <label>Nom</label>
          <input id="tbWEditName" type="text" value="${tbEscHTML(w.name || "")}" />
        </div>

        <div class="tb-dlg-row">
          <label>Devise</label>
          <input type="text" value="${tbEscHTML(w.currency || "")}" disabled />
          <div class="hint">La devise n'est pas modifiable ici (évite les incohérences).</div>
        </div>

        <div class="tb-dlg-row">
          <label>Type</label>
          <select id="tbWEditType">
            <option value="cash">Cash (espèces)</option>
            <option value="bank">Banque</option>
            <option value="card">Carte</option>
            <option value="savings">Épargne</option>
            <option value="other">Autre</option>
          </select>
        </div>
      </div>
      <div class="tb-dlg-f">
        <button class="tb-dlg-btn" id="tbWEditCancel">Annuler</button>
        <button class="tb-dlg-btn primary" id="tbWEditOk">Enregistrer</button>
      </div>
    `;

    back.appendChild(dlg);
    document.body.appendChild(back);

    const $ = (id) => dlg.querySelector(id);

    // default selection
    const sel = $("#tbWEditType");
    sel.value = String(w.type || "other").toLowerCase();

    function close(val) {
      try { document.body.removeChild(back); } catch (_) {}
      resolve(val);
    }

    $("#tbWEditCancel").onclick = () => close(null);
    back.onclick = (e) => { if (e.target === back) close(null); };

    $("#tbWEditOk").onclick = () => {
      const name = String($("#tbWEditName").value || "").trim();
      const type = String($("#tbWEditType").value || "").toLowerCase();

      const allowed = ["cash", "bank", "card", "savings", "other"];
      if (!name) return alert("Nom requis.");
      if (!allowed.includes(type)) return alert("Type invalide.");

      close({ name, type });
    };
  });
}

function openWalletTypesFix() {
  const wallets = Array.isArray(state.wallets) ? state.wallets : [];
  const missing = wallets.filter(w => !String(w?.type || "").trim());
  if (!missing.length) return alert("Tous les wallets ont déjà un type.");

  // ensure styles
  if (!document.getElementById("tbWalletDlgStyles")) {
    tbOpenWalletDialog().then(() => {});
  }

  const back = document.createElement("div");
  back.className = "tb-dlg-backdrop";

  const dlg = document.createElement("div");
  dlg.className = "tb-dlg";

  const rowsHtml = missing.map((w, i) => {
    const sug = tbInferWalletTypeFromName(w.name);
    return `
      <div class="tb-dlg-row" style="display:grid; grid-template-columns: 1fr 170px; gap:10px; align-items:center;">
        <div>
          <div style="font-weight:700;">${tbEscHTML(w.name || "")}</div>
          <div class="hint">${tbEscHTML(w.currency || "")} • suggestion : <b>${tbEscHTML(tbWalletTypeLabel(sug))}</b></div>
        </div>
        <select data-wid="${tbEscHTML(w.id)}">
          <option value="cash">Cash (espèces)</option>
          <option value="bank">Banque</option>
          <option value="card">Carte</option>
          <option value="savings">Épargne</option>
          <option value="other">Autre</option>
        </select>
      </div>
    `;
  }).join("");

  dlg.innerHTML = `
    <div class="tb-dlg-h">Corriger les types de wallets</div>
    <div class="tb-dlg-b">
      <div class="hint" style="margin-bottom:12px;">
        On a détecté des wallets sans type. Sélectionne le bon type (pré-suggéré) puis “Appliquer”.
      </div>
      ${rowsHtml}
    </div>
    <div class="tb-dlg-f">
      <button class="tb-dlg-btn" id="tbWFixCancel">Annuler</button>
      <button class="tb-dlg-btn primary" id="tbWFixApply">Appliquer</button>
    </div>
  `;

  back.appendChild(dlg);
  document.body.appendChild(back);

  // set suggestions as default selection
  dlg.querySelectorAll("select[data-wid]").forEach(sel => {
    const wid = sel.getAttribute("data-wid");
    const w = missing.find(x => String(x.id) === String(wid));
    const sug = tbInferWalletTypeFromName(w?.name);
    sel.value = sug;
  });

  function close() {
    try { document.body.removeChild(back); } catch (_) {}
  }

  dlg.querySelector("#tbWFixCancel").onclick = () => close();
  back.onclick = (e) => { if (e.target === back) close(); };

  dlg.querySelector("#tbWFixApply").onclick = async () => {
    try {
      const updates = [];
      dlg.querySelectorAll("select[data-wid]").forEach(sel => {
        const wid = sel.getAttribute("data-wid");
        const type = String(sel.value || "").toLowerCase();
        updates.push({ wid, type });
      });

      const allowed = ["cash", "bank", "card", "savings", "other"];
      for (const u of updates) {
        if (!allowed.includes(u.type)) throw new Error("Type invalide pour " + u.wid);
      }

      for (const u of updates) {
        const { error } = await sb
          .from(TB_CONST.TABLES.wallets)
          .update({ type: u.type })
          .eq("id", u.wid);
        if (error) throw error;
      }

      close();
      await refreshFromServer();
    } catch (e) {
      console.error(e);
      alert("Erreur mise à jour types : " + (e?.message || e));
    }
  };
}

async function editWallet(walletId) {
  try {
    const w = (state.wallets || []).find(x => String(x.id) === String(walletId));
    if (!w) return;

    const data = await tbOpenWalletEditDialog(w);
    if (!data) return;

    const { error } = await sb
      .from(TB_CONST.TABLES.wallets)
      .update({ name: data.name, type: data.type })
      .eq("id", walletId);
    if (error) throw error;

    await refreshFromServer();
  } catch (e) {
    console.error(e);
    alert("Erreur modification wallet : " + (e?.message || e));
  }
}

/* =========================
   Wallet CRUD
   ========================= */
async function createWallet() {
  try {
    const data = await tbOpenWalletDialog();
    if (!data) return;

    const name = data.name;
    const currency = data.currency;
    const typeRaw = data.type;
    const balance = data.balance;

    // ✅ period_id requis (wallets.period_id NOT NULL)
    const periodId = state?.period?.id || localStorage.getItem(ACTIVE_PERIOD_KEY);
    if (!periodId) return alert("Aucune période active (period_id introuvable).");

    const { error } = await sb.from(TB_CONST.TABLES.wallets).insert([{
      user_id: sbUser.id,
      period_id: periodId,
      name,
      currency,
      type: typeRaw,
      balance
    }]);
    if (error) throw error;

    await refreshFromServer();
  } catch (e) {
    console.error(e);
    alert("Erreur création wallet : " + (e?.message || e));
  }
}

async function deleteWallet(walletId) {
  try {
    const w = (state.wallets || []).find(x => x.id === walletId);
    if (!w) return;

    const { data: tx, error: tErr } = await sb
      .from(TB_CONST.TABLES.transactions)
      .select("id")
      .eq("wallet_id", walletId)
      .limit(1);

    if (tErr) throw tErr;
    if (tx && tx.length) {
      return alert("Impossible de supprimer : des transactions existent sur ce wallet.");
    }

    if (!confirm(`Supprimer le wallet "${w.name} (${w.currency})" ?`)) return;

    const { error } = await sb.from(TB_CONST.TABLES.wallets).delete().eq("id", walletId);
    if (error) throw error;

    await refreshFromServer();
  } catch (e) {
    console.error(e);
    alert(e?.message || "Erreur suppression wallet");
  }
}
