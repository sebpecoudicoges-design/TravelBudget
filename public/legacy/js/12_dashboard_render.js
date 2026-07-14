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

  try {
    if (localStorage.getItem("tb_onboarding_hide_v1") === "1") {
      panel.style.display = "none";
      return;
    }
  } catch (_) {}

  const wallets = (window.state && Array.isArray(state.wallets)) ? state.wallets.filter(w => w?.archived !== true) : [];
  const txs = (window.state && Array.isArray(state.transactions))
    ? state.transactions.filter(t => (t.travelId || t.travel_id) === state.activeTravelId && !t?.isInternal && !t?.is_internal)
    : [];
  const hasSegments = !!(window.state && Array.isArray(state.segments) && state.segments.length);
  const hasSettings = !!(window.state && Array.isArray(state.settings) && state.settings.length);

  const rows = [
    { ok: hasSegments || hasSettings, text: tbT ? tbT("onboarding.step.period") : "Set trip and period.", action: "showView('settings')", label: tbT ? tbT("onboarding.action.period") : "Set trip" },
    { ok: wallets.length > 0, text: tbT ? tbT("onboarding.step.wallet") : "Create a wallet.", action: "if(typeof createWallet==='function')createWallet();else showView('dashboard')", label: tbT ? tbT("onboarding.action.wallet") : "Create wallet" },
    { ok: txs.length > 0, text: tbT ? tbT("onboarding.step.tx") : "Add a first transaction.", action: "if(typeof openTxModal==='function')openTxModal('expense',null);else showView('transactions')", label: tbT ? tbT("onboarding.action.tx") : "Add transaction" }
  ];
  const done = rows.filter(r => r.ok).length;
  if (done === rows.length) {
    panel.style.display = "none";
    return;
  }

  panel.style.display = "block";
  panel.style.border = "1px solid rgba(37,99,235,.18)";
  panel.style.background = "linear-gradient(135deg, rgba(37,99,235,.08), rgba(14,165,233,.05))";
  panel.style.borderRadius = "20px";
  body.innerHTML = window.TBDashboardView?.renderDashboardOnboardingPanel?.({
    rows,
    done,
    total: rows.length,
    t: window.tbT || ((key, vars) => {
      if (key === "onboarding.subtitle") return "Set up the foundation in the right order.";
      if (key === "onboarding.progress") return `${vars?.done || 0}/${vars?.total || 0}`;
      if (key === "onboarding.action.guide") return "Guide";
      if (key === "onboarding.hide") return "Hide";
      if (key === "onboarding.tip") return "Need help? Click ?.";
      return key;
    }),
  }) || "";
}

/* =========================
   UX contextual help
   ========================= */
function _tbUxDismissedMap() {
  try {
    const key = (window.TB_CONST && TB_CONST.LS_KEYS && TB_CONST.LS_KEYS.ux_help_dismissed) || "travelbudget_ux_help_dismissed_v1";
    const raw = localStorage.getItem(key);
    const obj = raw ? JSON.parse(raw) : {};
    return (obj && typeof obj === "object") ? obj : {};
  } catch (_) { return {}; }
}
function _tbUxIsDismissed(id) {
  try { return !!_tbUxDismissedMap()[String(id || "")]; } catch (_) { return false; }
}
function _tbUxDismiss(id) {
  try {
    const key = (window.TB_CONST && TB_CONST.LS_KEYS && TB_CONST.LS_KEYS.ux_help_dismissed) || "travelbudget_ux_help_dismissed_v1";
    const map = _tbUxDismissedMap();
    map[String(id || "")] = 1;
    localStorage.setItem(key, JSON.stringify(map));
  } catch (_) {}
}
window.tbUxDismiss = window.tbUxDismiss || _tbUxDismiss;
window.tbUxIsDismissed = window.tbUxIsDismissed || _tbUxIsDismissed;

function _walletRecentTxDate(tx) {
  return String(tx?.dateStart || tx?.date_start || tx?.budgetDateStart || tx?.budget_date_start || "").slice(0, 10);
}

function _walletRecentTxTouchesWallet(tx) {
  if (!tx) return false;
  if (tx.isInternal || tx.is_internal) return false;
  try {
    if (typeof window.tbIsTripBudgetShare === "function" && window.tbIsTripBudgetShare(tx)) return false;
  } catch (_) {}
  const internalTransferId = tx.internalTransferId || tx.internal_transfer_id || null;
  const budgetOnlyInternalTransferFee =
    !!internalTransferId &&
    String(tx.type || "").toLowerCase() === "expense" &&
    (tx.payNow === false || tx.pay_now === false) &&
    (tx.outOfBudget === false || tx.out_of_budget === false) &&
    (tx.affectsBudget === true || tx.affects_budget === true);
  if (budgetOnlyInternalTransferFee) return false;
  return true;
}

function _walletRecentAddDaysISO(iso, days) {
  const d = new Date(`${String(iso || "").slice(0, 10)}T12:00:00`);
  if (!Number.isFinite(d.getTime())) return String(iso || "").slice(0, 10);
  d.setDate(d.getDate() + (Number(days) || 0));
  return toLocalISODate(d);
}

function _walletRecentTransactionsHTML(walletId, today, T) {
  const wid = String(walletId || "");
  const todayIso = String(today || toLocalISODate(new Date()));
  const maxFutureDate = _walletRecentAddDaysISO(todayIso, 7);
  const wallet = (Array.isArray(state?.wallets) ? state.wallets : [])
    .find((w) => String(w?.id || "") === wid);
  let projectedFutureBalance = Number((typeof window.tbGetWalletEffectiveBalance === "function")
    ? window.tbGetWalletEffectiveBalance(walletId)
    : wallet?.balance) || 0;

  const rows = (Array.isArray(state?.transactions) ? state.transactions : [])
    .filter((tx) => String(tx?.walletId || tx?.wallet_id || "") === wid)
    .filter((tx) => (tx?.travelId || tx?.travel_id || null) === state.activeTravelId)
    .filter(_walletRecentTxTouchesWallet)
    .map((tx) => {
      const date = _walletRecentTxDate(tx);
      const isPaid = tx?.payNow !== false;
      const isFutureSoon = !!date && date > todayIso && date <= maxFutureDate;
      const isPastUnpaid = !!date && date <= todayIso && !isPaid;
      return { tx, date, isPaid, isFutureSoon, isPastUnpaid };
    })
    .filter((row) => !!row.date && (row.date <= todayIso || row.isFutureSoon))
    .sort((a, b) => {
      const pa = a.isFutureSoon ? 0 : (a.isPastUnpaid ? 1 : 2);
      const pb = b.isFutureSoon ? 0 : (b.isPastUnpaid ? 1 : 2);
      if (pa !== pb) return pa - pb;
      if (a.isFutureSoon || a.isPastUnpaid) {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
      } else if (a.date !== b.date) {
        return b.date.localeCompare(a.date);
      }
      return String(a.tx?.label || "").localeCompare(String(b.tx?.label || ""));
    })
    .slice(0, 5)
    .map((row) => {
      if (!row.isFutureSoon) return row;
      const type = String(row.tx?.type || "").toLowerCase();
      const amount = Math.abs(Number(row.tx?.amount) || 0);
      projectedFutureBalance += type === "expense" ? -amount : amount;
      return { ...row, projectedNegative: projectedFutureBalance < 0 };
    });

  if (!rows.length) {
    return window.TBDashboardView?.renderWalletRecentTransactions?.({ rows: [], t: T, esc: escapeHTML })
      || `<div class="muted" style="font-size:12px;">${T("wallet.recent.empty")}</div>`;
  }

  return window.TBDashboardView?.renderWalletRecentTransactions?.({
    rows,
    t: T,
    lang: (window.tbGetLang && window.tbGetLang()) || "fr",
    fmtMoney,
    esc: escapeHTML,
  }) || "";
}

function renderDashboardContextHelp(container) {
  if (!container) return;
  if ((window.tbUxIsDismissed || _tbUxIsDismissed)("dashboard_overview")) return;
  if (container.querySelector('[data-tb-help="dashboard-overview"]')) return;
  const T = window.tbT || ((k) => k);
  const box = document.createElement('div');
  box.setAttribute('data-tb-help', 'dashboard-overview');
  box.className = 'hint';
  box.style.padding = '12px';
  box.style.border = '1px solid rgba(0,0,0,.10)';
  box.style.borderRadius = '14px';
  box.style.background = 'rgba(0,0,0,.03)';
  box.style.marginBottom = '12px';
  box.innerHTML = window.TBDashboardView?.renderDashboardContextHelp?.({ t: T }) || "";
  container.prepend(box);
  const close = box.querySelector('[data-tb-help-close]');
  if (close) close.onclick = () => { try { (window.tbUxDismiss || _tbUxDismiss)('dashboard_overview'); } catch(_) {} box.remove(); };
}


function tbMoveDashboardHeroToTop() {
  try {
    const heroShell = document.getElementById("dashboard-hero-shell");
    const walletsContainer = document.getElementById("wallets-container");
    if (!heroShell || !walletsContainer) return;

    const dashboardRoot = walletsContainer.parentElement || walletsContainer;
    if (dashboardRoot.firstElementChild !== heroShell) {
      dashboardRoot.insertBefore(heroShell, dashboardRoot.firstElementChild || null);
    }
  } catch (_) {}
}

function tbMountExistingKpisIntoHero() {
  try {
    const heroKpiSlot = document.getElementById("dashboard-kpi-embed-slot");
    const kpiContainer = document.getElementById("kpis-container");
    if (!heroKpiSlot || !kpiContainer) return;

    // Si le container KPI est déjà dans le hero, ne rien faire
    if (heroKpiSlot.contains(kpiContainer)) return;

    const oldParent = kpiContainer.parentElement;
    heroKpiSlot.appendChild(kpiContainer);

    // Tenter de masquer l'ancien wrapper KPI s'il devient vide / inutile
    if (oldParent && oldParent !== heroKpiSlot) {
      const txt = String(oldParent.textContent || "").trim().toLowerCase();
      const hasOnlyKpiTitle =
        txt === "kpis" ||
        txt === "kpi" ||
        txt.startsWith("kpis");

      // masque les titres KPI résiduels
      Array.from(oldParent.children || []).forEach((child) => {
        if (child !== kpiContainer) {
          const childTxt = String(child.textContent || "").trim().toLowerCase();
          if (childTxt === "kpis" || childTxt === "kpi" || childTxt.startsWith("kpis")) {
            child.style.display = "none";
          }
        }
      });

      // si c'était clairement un wrapper KPI, on le masque
      if (hasOnlyKpiTitle || oldParent.children.length <= 1) {
        oldParent.style.display = "none";
      }
    }
  } catch (_) {}
}

/* =========================
   Dashboard render
   ========================= */
function renderWallets() {
  const T = (window.tbT ? tbT : (k, vars) => {
    let s = String(k || "");
    if (vars && typeof vars === "object") Object.keys(vars).forEach((v) => { s = s.replaceAll(`{${v}}`, String(vars[v])); });
    return s;
  });
  // Sur certaines pages (reset/recovery), le DOM dashboard n'existe pas.
  const container = document.getElementById("wallets-container");
if (!container) return;

// Onboarding panel / empty states
renderOnboardingPanel();

container.innerHTML = "";

// Actions
const actions = document.createElement("div");
actions.className = "tb-wallet-actions";
actions.style.display = "flex";
actions.style.gap = "10px";
actions.style.flexWrap = "wrap";
actions.style.marginBottom = "12px";
actions.innerHTML = `
  <button class="btn primary" onclick="createWallet()">+ Wallet</button>
  <button class="btn" type="button" onclick="openInternalTransferModal()">
    ↔ ${T("transactions.action.internal_transfer")}
  </button> 
`;
container.appendChild(actions);


const allWallets = Array.isArray(state.wallets) ? state.wallets : [];
const showArchivedWallets = !!window.__tbShowArchivedWallets;
const wallets = allWallets.filter(w => showArchivedWallets || w.archived !== true);
const archiveToggleBtn = document.createElement("button");
archiveToggleBtn.className = "btn";
archiveToggleBtn.type = "button";
archiveToggleBtn.textContent = showArchivedWallets ? T("wallet.action.hide_archived") : T("wallet.action.show_archived");
archiveToggleBtn.onclick = () => toggleArchivedWallets();
actions.appendChild(archiveToggleBtn);
try {
  if (typeof renderKpis === "function") renderKpis();

} catch (_) {}
const kpiHost = document.getElementById("kpis-container");
if (kpiHost && typeof renderKpis === "function") {
  try { renderKpis(); } catch (_) {}
}
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
  empty.innerHTML = window.TBDashboardView?.renderWalletEmptyState?.({ t: T }) || "";
  container.appendChild(empty);

  // Quick onboarding block
  const ob = document.createElement("div");
  ob.className = "hint";
  ob.style.padding = "10px";
  ob.style.border = "1px solid rgba(0,0,0,.08)";
  ob.style.borderRadius = "12px";
  ob.style.background = "rgba(0,0,0,.02)";
  ob.style.marginTop = "10px";
  ob.innerHTML = window.TBDashboardView?.renderWalletQuickOnboarding?.({ t: T }) || "";
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
    ? sortWalletsBySavedOrder([...wallets])
    : ([...wallets]);

  for (const w of orderedWallets) {
    const isBase = w.currency === base;
    const barPct = isBase ? Math.max(0, Math.min(100, (budgetToday / daily) * 100)) : 0;

    const div = document.createElement("div");
    div.className = "wallet wallet-item";
    div.dataset.walletId = w.id;
    div.innerHTML = window.TBDashboardView?.renderWalletCard?.({
      wallet: w,
      isBase,
      today,
      budgetToday,
      daily,
      baseCurrency: base,
      balance: fmtMoney((typeof window.tbGetWalletEffectiveBalance === "function" ? window.tbGetWalletEffectiveBalance(w.id) : w.balance), w.currency),
      recentHtml: _walletRecentTransactionsHTML(w.id, today, T),
      archived: !!w.archived,
      barPct,
      t: T,
    }) || "";
    const archiveAction = div.querySelector("[data-wallet-archive-action]");
    if (archiveAction) archiveAction.onclick = () => w.archived ? unarchiveWallet(w.id) : archiveWallet(w.id);
    listEl.appendChild(div);
  }

  // Enable drag & drop reorder
  try { if (typeof enableWalletsReorderDrag === "function") enableWalletsReorderDrag(listEl); } catch (e) {}

  // Notify reorder script (and any listeners) that wallets have been rendered.
  try { window.dispatchEvent(new CustomEvent("wallets:rendered")); } catch (_) {}
  try { if (window.tbBus && typeof tbBus.emit === "function") tbBus.emit("wallets:rendered", null); } catch (_) {}
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
  const T = window.tbT || ((k) => k);
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
  ctrl.innerHTML = window.TBDashboardView?.renderDailyBudgetControls?.({
    viewStartISO,
    viewEndISO,
    t: T,
  }) || "";
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
    const info = (typeof getDailyBudgetInfoForDate === "function") ? getDailyBudgetInfoForDate(dateStr) : { remaining: 0, daily: 0, used: 0, rows: [], baseCurrency: state.period.baseCurrency };
    const baseDay = String(info.baseCurrency || state.period.baseCurrency || "EUR").toUpperCase();
    const budget = Number(info.remaining) || 0;
    const spentBudget = Math.max(0, Number(info.used) || 0);
    const details = Array.isArray(info.rows) ? info.rows : [];

    const div = document.createElement("div");
    div.className = "day";
    div.innerHTML = window.TBDashboardView?.renderDailyBudgetDay?.({
      date: dateStr,
      budget,
      budgetClassName: budgetClass(budget),
      used: spentBudget,
      daily: Number(info.daily) || 0,
      baseCurrency: baseDay,
      details,
      t: T,
    }) || "";
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
    tbEnsureWalletDlgStyles();

    const backdrop = document.createElement("div");
    backdrop.className = "tb-dlg-backdrop";
    backdrop.innerHTML = window.TBDashboardView?.renderWalletCreateDialog?.() || "";
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

// Inject wallet dialog styles once, without opening any dialog.
function tbEnsureWalletDlgStyles() {
  try {
    if (document.getElementById("tbWalletDlgStyles")) return;
    const st = document.createElement("style");
    st.id = "tbWalletDlgStyles";
    // Use CSS variables so dialogs remain readable in dark theme.
    st.textContent = `
      .tb-dlg-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;}
      .tb-dlg{background:var(--panel);color:var(--text);border-radius:14px;max-width:520px;width:100%;box-shadow:0 10px 40px rgba(0,0,0,.25);overflow:hidden;border:1px solid var(--border);}
      .tb-dlg-h{padding:14px 16px;border-bottom:1px solid var(--border);font-weight:800;}
      .tb-dlg-b{padding:16px;}
      .tb-dlg-row{margin-bottom:12px;}
      .tb-dlg-row label{display:block;font-size:12px;color:var(--muted);font-weight:800;letter-spacing:.2px;margin-bottom:6px;}
      .tb-dlg-row input,.tb-dlg-row select{width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:10px;outline:none;background:var(--panel2);color:var(--text);}
      .tb-dlg-row .hint{font-size:12px;color:var(--muted);margin-top:6px;}
      .tb-dlg-f{display:flex;gap:10px;justify-content:flex-end;padding:14px 16px;border-top:1px solid var(--border);}
      .tb-dlg-btn{padding:10px 14px;border-radius:10px;border:1px solid var(--border);background:var(--panel2);color:var(--text);cursor:pointer;font-weight:800;}
      .tb-dlg-btn.primary{background:var(--accent);color:#fff;border-color:var(--accent);}
      .tb-dlg-err{color:var(--bad);font-size:12px;margin-top:8px;display:none;}
    `;
    document.head.appendChild(st);
  } catch (_) {}
}

function tbOpenWalletEditDialog(wallet) {
  return new Promise((resolve) => {
    const w = wallet || {};
    // ensure styles exist without opening the create dialog
    tbEnsureWalletDlgStyles();

    const back = document.createElement("div");
    back.className = "tb-dlg-backdrop";

    const dlg = document.createElement("div");
    dlg.className = "tb-dlg";

    dlg.innerHTML = window.TBDashboardView?.renderWalletEditDialog?.({ wallet: w }) || "";

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
  const wallets = Array.isArray(state.wallets)
  ? state.wallets.filter(w => (w.travelId || w.travel_id) === state.activeTravelId)
  : [];
  const missing = wallets.filter(w => !String(w?.type || "").trim());
  if (!missing.length) return alert("Tous les wallets ont déjà un type.");

  tbEnsureWalletDlgStyles();

  const back = document.createElement("div");
  back.className = "tb-dlg-backdrop";

  const dlg = document.createElement("div");
  dlg.className = "tb-dlg";

  dlg.innerHTML = window.TBDashboardView?.renderWalletTypesFixDialog?.({
    wallets: missing,
    inferType: tbInferWalletTypeFromName,
    typeLabel: tbWalletTypeLabel,
  }) || "";

  back.appendChild(dlg);
  document.body.appendChild(back);

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

function toggleArchivedWallets() {
  window.__tbShowArchivedWallets = !window.__tbShowArchivedWallets;
  renderWallets();
}

async function archiveWallet(walletId) {
  try {
    const w = (state.wallets || []).find(x => String(x.id) === String(walletId));
    if (!w) return;
    if (!confirm(`${(window.tbT ? tbT("wallet.action.archive") : "Archiver")} "${w.name} (${w.currency})" ?`)) return;
    const { error } = await sb
      .from(TB_CONST.TABLES.wallets)
      .update({ archived: true, archived_at: new Date().toISOString() })
      .eq("id", walletId);
    if (error) throw error;
    await refreshFromServer();
  } catch (e) {
    console.error(e);
    alert(e?.message || "Erreur archive wallet");
  }
}

async function unarchiveWallet(walletId) {
  try {
    const { error } = await sb
      .from(TB_CONST.TABLES.wallets)
      .update({ archived: false, archived_at: null })
      .eq("id", walletId);
    if (error) throw error;
    await refreshFromServer();
  } catch (e) {
    console.error(e);
    alert(e?.message || "Erreur désarchivage wallet");
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

    const travelId = state?.activeTravelId || null;
    if (!travelId) return alert("Aucun voyage actif (travel_id introuvable).");

    const { error } = await sb.from(TB_CONST.TABLES.wallets).insert([{
     user_id: sbUser.id,
     travel_id: travelId,
     period_id: state?.period?.id || null,
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

try {
  window.tbOnLangChange = window.tbOnLangChange || [];
  if (!window.__tbDashboardLangBound) {
    window.__tbDashboardLangBound = true;
    window.tbOnLangChange.push(() => {
      try { if (typeof renderWallets === "function") renderWallets(); } catch (_) {}
    });
  }
} catch (_) {}
