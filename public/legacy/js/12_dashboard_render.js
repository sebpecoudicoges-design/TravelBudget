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
  const txs = (window.state && Array.isArray(state.transactions))
  ? state.transactions.filter(t => (t.travelId || t.travel_id) === state.activeTravelId)
  : [];

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

renderOnboardingPanel = function () {
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
  body.innerHTML = `
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:14px;flex-wrap:wrap;">
      <div>
        <div class="muted" style="margin-bottom:6px;">${tbT ? tbT("onboarding.subtitle") : "Set up the foundation in the right order."}</div>
        <div class="pill" style="display:inline-flex;font-weight:900;">${tbT ? tbT("onboarding.progress", { done, total: rows.length }) : `${done}/${rows.length}`}</div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn primary" type="button" onclick="if(typeof tbStartGuidedTour==='function')tbStartGuidedTour({mode:'dashboard'});">${tbT ? tbT("onboarding.action.guide") : "Guide"}</button>
        <button class="btn" type="button" onclick="hideOnboardingPanel()">${tbT ? tbT("onboarding.hide") : "Hide"}</button>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px;margin-top:12px;">
      ${rows.map((row) => `
        <div style="border:1px solid ${row.ok ? "rgba(16,185,129,.28)" : "rgba(148,163,184,.25)"};background:${row.ok ? "rgba(16,185,129,.08)" : "rgba(255,255,255,.62)"};border-radius:16px;padding:12px;">
          <div style="display:flex;gap:8px;align-items:flex-start;">
            <span style="width:24px;height:24px;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;font-weight:950;background:${row.ok ? "rgba(16,185,129,.18)" : "rgba(37,99,235,.12)"};color:${row.ok ? "#047857" : "#1d4ed8"};">${row.ok ? "&#10003;" : "&bull;"}</span>
            <div style="min-width:0;flex:1;">
              <div style="font-weight:800;line-height:1.3;">${row.text}</div>
              ${row.ok ? "" : `<button class="btn" type="button" style="margin-top:10px;padding:7px 10px;font-size:12px;" onclick="${row.action}">${row.label}</button>`}
            </div>
          </div>
        </div>`).join("")}
    </div>
    <div style="margin-top:10px; opacity:.82;" class="muted">${tbT ? tbT("onboarding.tip") : "Need help? Click ?."}</div>
  `;
};

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

function _walletUpcomingTransactions(walletId, today) {
  const wid = String(walletId || "");
  const minDate = String(today || toLocalISODate(new Date()));
  const maxDate = _walletRecentAddDaysISO(minDate, 7);
  return (Array.isArray(state?.transactions) ? state.transactions : [])
    .filter((tx) => String(tx?.walletId || tx?.wallet_id || "") === wid)
    .filter((tx) => (tx?.travelId || tx?.travel_id || null) === state.activeTravelId)
    .filter(_walletRecentTxTouchesWallet)
    .filter((tx) => {
      const d = _walletRecentTxDate(tx);
      return !!d && d > minDate && d <= maxDate;
    })
    .sort((a, b) => {
      const da = _walletRecentTxDate(a);
      const db = _walletRecentTxDate(b);
      if (da !== db) return da.localeCompare(db);
      return String(a?.label || "").localeCompare(String(b?.label || ""));
    })
    .slice(0, 2);
}

function _walletRecentTransactions(walletId, today) {
  const wid = String(walletId || "");
  const maxDate = String(today || toLocalISODate(new Date()));
  return (Array.isArray(state?.transactions) ? state.transactions : [])
    .filter((tx) => String(tx?.walletId || tx?.wallet_id || "") === wid)
    .filter((tx) => (tx?.travelId || tx?.travel_id || null) === state.activeTravelId)
    .filter(_walletRecentTxTouchesWallet)
    .filter((tx) => {
      const d = _walletRecentTxDate(tx);
      return !!d && d <= maxDate;
    })
    .sort((a, b) => {
      const da = _walletRecentTxDate(a);
      const db = _walletRecentTxDate(b);
      if (db !== da) return db.localeCompare(da);
      return (Number(b?.createdAt || 0) - Number(a?.createdAt || 0));
    })
    .slice(0, 5);
}

function _walletRecentTransactionsHTML(walletId, today, T) {
  const recentRows = _walletRecentTransactions(walletId, today);
  const upcomingRows = _walletUpcomingTransactions(walletId, today);
  const upcomingCount = Math.min(2, upcomingRows.length);
  const wallet = (Array.isArray(state?.wallets) ? state.wallets : [])
    .find((w) => String(w?.id || "") === String(walletId || ""));
  let projectedBalance = Number((typeof window.tbGetWalletEffectiveBalance === "function")
    ? window.tbGetWalletEffectiveBalance(walletId)
    : wallet?.balance) || 0;
  const rows = upcomingCount
    ? [
        ...upcomingRows.slice(0, upcomingCount).map((tx) => {
          const type = String(tx?.type || "").toLowerCase();
          const amount = Math.abs(Number(tx?.amount) || 0);
          projectedBalance += type === "expense" ? -amount : amount;
          return { ...tx, __tbWalletUpcoming: true, __tbWalletProjectedNegative: projectedBalance < 0 };
        }),
        ...recentRows.slice(0, Math.max(0, 5 - upcomingCount))
      ]
    : recentRows;
  if (!rows.length) {
    return `<div class="muted" style="font-size:12px;">${T("wallet.recent.empty")}</div>`;
  }
  return rows.map((tx) => {
    const type = String(tx?.type || "").toLowerCase();
    const sign = type === "expense" ? "-" : "+";
    const isPaid = tx?.payNow !== false;
    const isUpcoming = !!tx.__tbWalletUpcoming;
    const projectedNegative = !!tx.__tbWalletProjectedNegative;
    const statusColor = isUpcoming ? "rgba(59,130,246,.12)" : (isPaid ? "rgba(16,185,129,.12)" : "rgba(245,158,11,.14)");
    const statusBorder = isUpcoming ? "rgba(59,130,246,.35)" : (isPaid ? "rgba(16,185,129,.35)" : "rgba(245,158,11,.38)");
    const statusText = isUpcoming ? ((window.tbGetLang && window.tbGetLang() === "en") ? "Upcoming" : "A venir") : (isPaid ? T("wallet.recent.paid") : T("wallet.recent.unpaid"));
    const warningChip = projectedNegative
      ? `<span title="${escapeHTML((window.tbGetLang && window.tbGetLang() === "en") ? "Wallet may go below zero" : "Le wallet peut passer sous zero")}" style="display:inline-flex;align-items:center;border:1px solid rgba(244,63,94,.35);background:rgba(244,63,94,.10);border-radius:999px;padding:1px 6px;color:#be123c;font-weight:800;">${escapeHTML((window.tbGetLang && window.tbGetLang() === "en") ? "risk < 0" : "risque < 0")}</span>`
      : "";
    const label = escapeHTML(String(tx?.label || tx?.category || "Transaction"));
    const date = escapeHTML(_walletRecentTxDate(tx));
    const amount = escapeHTML(`${sign}${fmtMoney(Math.abs(Number(tx?.amount) || 0), tx?.currency || "")}`);
    const amountColor = type === "expense" ? "#b42335" : "#047857";
    return `
      <div style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;padding:8px 0;border-top:1px solid rgba(15,23,42,.07);">
        <div style="min-width:0;">
          <div style="font-weight:700;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${label}${warningChip ? ` ${warningChip}` : ""}</div>
          <div class="muted" style="font-size:12px;">${date} · <span style="display:inline-flex;align-items:center;border:1px solid ${statusBorder};background:${statusColor};border-radius:999px;padding:1px 7px;color:var(--text);font-weight:700;">${escapeHTML(statusText)}</span></div>
        </div>
        <div style="font-weight:800;white-space:nowrap;color:${amountColor};">${amount}</div>
      </div>
    `;
  }).join("");
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
    return `<div class="muted" style="font-size:12px;">${T("wallet.recent.empty")}</div>`;
  }

  return rows.map((row) => {
    const tx = row.tx;
    const type = String(tx?.type || "").toLowerCase();
    const sign = type === "expense" ? "-" : "+";
    const statusColor = row.isFutureSoon
      ? "rgba(59,130,246,.12)"
      : (row.isPaid ? "rgba(16,185,129,.12)" : "rgba(245,158,11,.14)");
    const statusBorder = row.isFutureSoon
      ? "rgba(59,130,246,.35)"
      : (row.isPaid ? "rgba(16,185,129,.35)" : "rgba(245,158,11,.38)");
    const statusText = row.isFutureSoon
      ? ((window.tbGetLang && window.tbGetLang() === "en") ? "Upcoming" : "A venir")
      : (row.isPaid ? T("wallet.recent.paid") : T("wallet.recent.unpaid"));
    const warningChip = row.isFutureSoon && row.projectedNegative
      ? `<span title="${escapeHTML((window.tbGetLang && window.tbGetLang() === "en") ? "Overdraft risk" : "Risque de decouvert")}" style="display:inline-flex;align-items:center;gap:4px;border:1px solid rgba(244,63,94,.38);background:rgba(244,63,94,.10);border-radius:999px;padding:2px 7px;color:#be123c;font-size:11px;font-weight:850;">${escapeHTML((window.tbGetLang && window.tbGetLang() === "en") ? "! Overdraft risk" : "! Risque de decouvert")}</span>`
      : "";
    const label = escapeHTML(String(tx?.label || tx?.category || "Transaction"));
    const date = escapeHTML(row.date);
    const amount = escapeHTML(`${sign}${fmtMoney(Math.abs(Number(tx?.amount) || 0), tx?.currency || "")}`);
    const amountColor = type === "expense" ? "#b42335" : "#047857";
    return `
      <div style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;padding:8px 0;border-top:1px solid rgba(15,23,42,.07);">
        <div style="min-width:0;">
          <div style="font-weight:700;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${label}</div>
          <div class="muted" style="font-size:12px;">${date} - <span style="display:inline-flex;align-items:center;border:1px solid ${statusBorder};background:${statusColor};border-radius:999px;padding:1px 7px;color:var(--text);font-weight:700;">${escapeHTML(statusText)}</span></div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;font-weight:800;white-space:nowrap;color:${amountColor};">${amount}${warningChip}</div>
      </div>
    `;
  }).join("");
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
  box.innerHTML = `
    <div style="display:flex; justify-content:space-between; gap:12px; align-items:flex-start; flex-wrap:wrap;">
      <div style="min-width:260px; flex:1;">
        <div style="font-weight:700; margin-bottom:6px;">${T("dashboard.help.title")}</div>
        <div class="muted">
          <div>• ${T("dashboard.help.wallets")}</div>
          <div>• ${T("dashboard.help.daily")}</div>
          <div>• ${T("dashboard.help.trip")}</div>
        </div>
      </div>
      <div style="display:flex; gap:8px; flex-wrap:wrap;">
        <button class="btn" type="button" onclick="showView('help')">${T("nav.help")}</button>
        <button class="btn" type="button" onclick="showView('trip')">${T("nav.trip")}</button>
        <button class="btn" type="button" data-tb-help-close="dashboard_overview">${T("common.hide")}</button>
      </div>
    </div>`;
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
  ob.innerHTML = `
    <div style="display:flex; justify-content:space-between; gap:10px; align-items:center; flex-wrap:wrap;">
      <div style="font-weight:600;">${T("onboarding.title")}</div>
      <div style="display:flex; gap:8px; flex-wrap:wrap;">
        <button class="btn" type="button" onclick="showView('settings')">${T("nav.settings")}</button>
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
    ? sortWalletsBySavedOrder([...wallets])
    : ([...wallets]);

  for (const w of orderedWallets) {
    const isBase = w.currency === base;
    const barPct = isBase ? Math.max(0, Math.min(100, (budgetToday / daily) * 100)) : 0;

    const div = document.createElement("div");
    div.className = "wallet wallet-item";
    div.dataset.walletId = w.id;
    div.innerHTML = `
      <div style="display:flex; justify-content:space-between; gap:18px; align-items:flex-start; flex-wrap:wrap;">
        <div style="min-width:280px; flex:1 1 520px;">
          <h3>${w.name} (${w.currency}) ${w.archived ? `<span class="pill">${T("wallet.archived")}</span>` : ""}</h3>
          <p>${T("wallet.balance")} : <strong style="color:var(--text);">${fmtMoney((typeof window.tbGetWalletEffectiveBalance === "function" ? window.tbGetWalletEffectiveBalance(w.id) : w.balance), w.currency)}</strong></p>
          ${isBase
            ? `<p class="muted">${T("wallet.today_budget", { date: today })} <strong>${budgetToday.toFixed(2)} ${base}</strong></p>`
            : `<p class="muted">${T("wallet.daily_budget_base", { currency: base })}</p>`}
          <div style="margin-top:12px;max-width:620px;">
            <div class="muted" style="font-size:12px;text-transform:uppercase;letter-spacing:.04em;font-weight:800;">${T("wallet.recent.title")}</div>
            ${_walletRecentTransactionsHTML(w.id, today, T)}
          </div>
          ${isBase ? `
            <div class="bar" style="margin-top:12px;"><div style="width:${barPct.toFixed(0)}%;"></div></div>
            <div class="muted" style="margin-top:6px;">${T("wallet.budget_level")}</div>
          ` : ""}
        </div>
        <div class="tb-wallet-action-col" style="display:flex; flex-direction:column; gap:8px; flex:0 0 200px;">
          <button class="btn primary" onclick="openTxModal('expense','${w.id}')">${T("wallet.action.add_expense")}</button>
          <button class="btn" onclick="openTxModal('income','${w.id}')">${T("wallet.action.add_income")}</button>
          <button class="btn" onclick="editWallet('${w.id}')">✏️ ${T("wallet.action.edit")}</button>
          <button class="btn" onclick="adjustWalletBalance('${w.id}')">⚙ ${T("wallet.action.adjust")}</button>
          <button class="btn" style="border:1px solid rgba(239,68,68,0.6); color: rgba(239,68,68,0.95);" onclick="deleteWallet('${w.id}')">🗑 ${T("wallet.action.delete")}</button>
        </div>
      </div>

    `;
    const actionCol = div.querySelector(".tb-wallet-action-col");
    if (actionCol) {
      if (w.archived) {
        actionCol.querySelectorAll("button").forEach((btn) => {
          const action = String(btn.getAttribute("onclick") || "");
          if (action.includes("openTxModal") || action.includes("adjustWalletBalance")) btn.remove();
        });
      }
      const archiveBtn = document.createElement("button");
      archiveBtn.className = "btn";
      archiveBtn.textContent = w.archived ? T("wallet.action.unarchive") : T("wallet.action.archive");
      archiveBtn.onclick = () => w.archived ? unarchiveWallet(w.id) : archiveWallet(w.id);
      const deleteBtn = actionCol.querySelector("button[onclick^='deleteWallet']");
      if (deleteBtn) actionCol.insertBefore(archiveBtn, deleteBtn);
      else actionCol.appendChild(archiveBtn);
    }
    listEl.appendChild(div);
  }

  // Enable drag & drop reorder
  try { if (typeof enableWalletsReorderDrag === "function") enableWalletsReorderDrag(listEl); } catch (e) {}

  // Notify reorder script (and any listeners) that wallets have been rendered.
  try { window.dispatchEvent(new CustomEvent("wallets:rendered")); } catch (_) {}
  try { if (window.tbBus && typeof tbBus.emit === "function") tbBus.emit("wallets:rendered", null); } catch (_) {}
}

// Budget spent per day (base currency) computed from transactions.
// Includes Trip shares (payNow=false) because they affect budget; excludes out-of-budget expenses.

// Budget spent per day computed from transactions, expressed in the *segment base currency of that day*.
function budgetSpentBaseForDateFromTx(dateStr) {
  try {
    const txs = Array.isArray(state.transactions)
  ? state.transactions.filter(t => (t.travelId || t.travel_id) === state.activeTravelId)
  : [];
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

      const budgetStartISO = (typeof tbTxBudgetStart === 'function')
        ? tbTxBudgetStart(t)
        : (t.budgetDateStart || t.budget_date_start || t.dateStart || t.date_start || t.date || null);
      const budgetEndISO = (typeof tbTxBudgetEnd === 'function')
        ? tbTxBudgetEnd(t)
        : (t.budgetDateEnd || t.budget_date_end || t.dateEnd || t.date_end || budgetStartISO || null);

      const s = parseISODateOrNull(budgetStartISO);
      const e = parseISODateOrNull(budgetEndISO);
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
  ctrl.innerHTML = `
    <div style="display:flex; flex-wrap:wrap; gap:8px; align-items:center; justify-content:space-between;">
      <div style="display:flex; flex-wrap:wrap; gap:8px; align-items:center;">
        <button class="btn" id="db-prev">${T("common.previous")}</button>
        <button class="btn" id="db-today">${T("kpi.today")}</button>
        <button class="btn" id="db-next">${T("common.next")}</button>
      </div>
      <div style="display:flex; flex-wrap:wrap; gap:8px; align-items:center;">
        <span class="muted" style="font-size:12px;">${T("dashboard.daily.display")} :</span>
        <select class="input" id="db-mode" style="min-width:170px;">
          <option value="segment">${T("dashboard.daily.current_period")}</option>
          <option value="voyage">${T("analysis.period.all_trip")}</option>
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
        <div>${T("dashboard.daily.used")} : <b style="color:#111827;">${spentBudget.toFixed(0)} ${baseDay}</b></div>
        <div>${T("dashboard.daily.target")} : <b style="color:#111827;">${Number(info.daily).toFixed(0)} ${baseDay}</b></div>
      </div>
      ${details.length
        ? `<div class="details">${details.map((x) => `• ${x.label} : ${Number(x.amountBase).toFixed(0)} ${x.baseCurrency || baseDay}`).join("<br>")}</div>`
        : `<div class="details">${T("dashboard.daily.no_allocation")}</div>`}
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
    tbEnsureWalletDlgStyles();

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
  const wallets = Array.isArray(state.wallets)
  ? state.wallets.filter(w => (w.travelId || w.travel_id) === state.activeTravelId)
  : [];
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
