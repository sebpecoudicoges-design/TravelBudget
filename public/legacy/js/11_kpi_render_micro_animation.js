/* =========================
   KPI + Render (micro animation)
   ========================= */

function budgetClass(v) {
  if (v >= state.period.dailyBudgetBase * 0.7) return "good";
  if (v >= state.period.dailyBudgetBase * 0.35) return "warn";
  return "bad";
}

function remainingBudgetBaseFrom(dateStr) {
  const start = parseISODateOrNull(dateStr);
  const end = parseISODateOrNull(state.period.end);
  if (!start || !end) return 0;

  let sum = 0;
  forEachDateInclusive(start, end, (d) => {
    const ds = toLocalISODate(d);
    const b = getDailyBudgetForDate(ds);
    sum += Math.max(0, b);
  });
  return sum;
}

// Budget spent (base currency) for a given day.
// - includes Trip shares paid by someone else (payNow=false) because they impact budget
// - excludes out-of-budget expenses
// - distributes multi-day expenses evenly across covered days
function budgetSpentBaseForDate(dateStr) {
  try {
    const txs = Array.isArray(window.state?.transactions) ? window.state.transactions : [];
    const target = String(dateStr || "");
    if (!target) return 0;

    const _ds = (d) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const da = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${da}`;
    };

    let sum = 0;
    for (const t of txs) {
      const type = String(t?.type || "").toLowerCase();
      if (type !== "expense") continue;

      const affectsBudget = (t.affectsBudget === undefined || t.affectsBudget === null) ? true : !!t.affectsBudget;
      if (!affectsBudget) continue;

      const outOfBudget = !!t.outOfBudget || !!t.out_of_budget;
      if (outOfBudget) continue;

      const s = parseISODateOrNull(t.dateStart || t.date_start || t.date || null);
      const e = parseISODateOrNull(t.dateEnd || t.date_end || t.dateStart || t.date_start || t.date || null);
      if (!s || !e) continue;

      const sds = _ds(s);
      const eds = _ds(e);
      if (target < sds || target > eds) continue;

      const amt = safeNum(t.amount);
      if (!isFinite(amt) || amt === 0) continue;

      const amtBase = amountToBase(amt, t.currency);
      const msPerDay = 24 * 60 * 60 * 1000;
      const days = Math.max(
        1,
        Math.round(
          (Date.UTC(e.getFullYear(), e.getMonth(), e.getDate()) - Date.UTC(s.getFullYear(), s.getMonth(), s.getDate())) / msPerDay
        ) + 1
      );
      sum += (amtBase / days);
    }
    return sum;
  } catch (_) {
    return 0;
  }
}

function projectedEndEUR() {
  const today = toLocalISODate(new Date());
  const remainingBase = remainingBudgetBaseFrom(today);
  const remainingEUR = amountToEUR(remainingBase, state.period.baseCurrency);
  return totalInEUR() - remainingEUR;
}

function netPendingEUR() {
  // Net of unpaid items (pay_now=false):
  // + unpaid incomes, - unpaid expenses
  // Excludes internal/shadow rows (isInternal=true)
  let net = 0;
  for (const tx of (state.transactions || [])) {
    if (!tx) continue;
    if (tx.isInternal) continue;
    if (tx.payNow) continue;

    const v = amountToEUR(Number(tx.amount) || 0, tx.currency);
    if (tx.type === "income") net += v;
    else if (tx.type === "expense") net -= v;
  }
  return net;
}

function projectedEndEURWithOptions(opts) {
  const includeUnpaid = !!opts?.includeUnpaid;
  const today = toLocalISODate(new Date());
  const remainingBase = remainingBudgetBaseFrom(today);
  const remainingEUR = amountToEUR(remainingBase, state.period.baseCurrency);

  const totalNowEUR = totalInEUR();
  const pendingEUR = includeUnpaid ? netPendingEUR() : 0;

  return (totalNowEUR + pendingEUR) - remainingEUR;
}


/* =========================
   CASH helpers
   ========================= */

// Cash wallets definition:
// - Prefer explicit wallet.type === 'cash' (Option 2)
// - Fallback: name contains "cash" (legacy)
function _getCashWallets() {
  const ws = (state.wallets || []);
  const hasType = ws.some(w => typeof w?.type === "string" && w.type.length > 0);

  if (hasType) {
    return ws.filter(w => (w?.type || "other") === "cash");
  }

  return ws.filter(w => String(w?.name || "").toLowerCase().includes("cash"));
}

// Amount convertible to BASE with current engine:
// - BASE currency itself
// - EUR (via EUR-BASE)
// Otherwise: not convertible (FX missing)
function _toBaseSafe(amount, currency) {
  const base = state?.period?.baseCurrency;
  const cur = String(currency || "");
  const amt = Number(amount) || 0;

  if (!base || !cur) return { ok: false, v: 0 };

  // ✅ If cross-rate plugin is present, use it
  if (typeof window.fxConvert === "function") {
    const out = window.fxConvert(amt, cur, base);
    if (out === null) return { ok: false, v: 0 };
    return { ok: true, v: out };
  }

  // Fallback (old engine)
  if (cur === base) return { ok: true, v: amt };
  if (cur === "EUR") {
    const r = Number(state.exchangeRates["EUR-BASE"]) || 0;
    if (!r) return { ok: false, v: 0 };
    return { ok: true, v: amt * r };
  }

  return { ok: false, v: 0 };
}


function _sumCashWalletsBase() {
  const base = state?.period?.baseCurrency;
  let totalBase = 0;
  const excluded = []; // {name,currency,balance}

  for (const w of _getCashWallets()) {
    const cur = w.currency || base;
    const bal = Number(w.balance) || 0;

    // If the wallet is empty, don't surface it as "FX exclu"
    if (!bal) continue;

    const conv = _toBaseSafe(bal, cur);

    if (conv.ok) totalBase += conv.v;
    else excluded.push({ name: w.name || "Wallet", currency: cur, balance: bal });
  }

  return { totalBase, excluded };
}

/* =========================
   Cash runway (UX): based on real cash expenses
   ========================= */
function cashRunwayInfo(windowDays = 7) {
  const cashWallets = _getCashWallets();
  if (!cashWallets.length) return null;

  const { totalBase, excluded } = _sumCashWalletsBase();
  const base = state.period.baseCurrency;

  const cashWalletIds = new Set(cashWallets.map(w => w.id));

  const today = clampMidnight(new Date());

  // Prefer since period start; else last N days
  const ps = parseISODateOrNull(state?.period?.start);
  const start = ps ? clampMidnight(ps) : (() => {
    const s = new Date(today);
    s.setDate(s.getDate() - Math.max(1, Number(windowDays) || 7) + 1);
    return clampMidnight(s);
  })();

  let sumExpenseBase = 0;

  for (const tx of (state.transactions || [])) {
    if (!tx) continue;
    if (tx.type !== "expense") continue;
    if (!tx.payNow) continue; // runway = real cash out
    if (!cashWalletIds.has(tx.walletId)) continue;

    const d = parseISODateOrNull(tx.dateStart);
    if (!d) continue;
    const dd = clampMidnight(d);
    if (dd < start || dd > today) continue;

    const cur = tx.currency || base;
    const conv = _toBaseSafe(Number(tx.amount) || 0, cur);
    if (conv.ok) sumExpenseBase += conv.v;
  }

  const days = Math.max(1, dayCountInclusive(start, today));
  const burnPerDay = sumExpenseBase / days;

  const daysLeft = (burnPerDay > 0) ? (totalBase / burnPerDay) : Infinity;

  return {
    totalBase,
    burnPerDay,
    daysLeft,
    excluded,
    windowDays: days,
  };
}

/* =========================
   Cash conservative cover (UX): based on allocations/budget usage
   ========================= */
function cashConservativeInfo() {
  const cashWallets = _getCashWallets();
  if (!cashWallets.length) return null;

  const { totalBase, excluded } = _sumCashWalletsBase();
  const base = state.period.baseCurrency;

  const today = clampMidnight(new Date());
  const ps = parseISODateOrNull(state?.period?.start);
  const start = ps ? clampMidnight(ps) : clampMidnight(new Date(today));

  // measure completed days (to yesterday)
  const end = new Date(today);
  end.setDate(end.getDate() - 1);

  let sumAllocated = 0;
  let activeDays = 0;

  const s = start;
  const e = (end >= start) ? end : today;

  forEachDateInclusive(s, e, (d) => {
    const ds = toLocalISODate(d);
    if (!periodContains(ds)) return;

    const remaining = getDailyBudgetForDate(ds);
    const allocated = (Number(state.period.dailyBudgetBase || 0) - remaining);

    if (allocated > 0) {
      sumAllocated += allocated;
      activeDays += 1;
    }
  });

  const burnPerDay =
    (activeDays > 0) ? (sumAllocated / activeDays) : Number(state.period.dailyBudgetBase || 0);

  const daysLeft = (burnPerDay > 0) ? (totalBase / burnPerDay) : Infinity;

  return {
    totalBase,
    burnPerDay,
    daysLeft,
    excluded,
    activeDays,
  };
}

function _daysPill(daysLeft, labelPrefix) {
  const thresholds = { warn: 7, urgent: 4, critical: 2 };

  if (!isFinite(daysLeft)) {
    return { level: "good", text: `${labelPrefix}: ∞` };
  }

  const dl = Math.max(0, daysLeft);
  const j = Math.ceil(dl);

  if (dl <= thresholds.critical) return { level: "bad", text: `${labelPrefix}: J-${j} (URGENT)` };
  if (dl <= thresholds.urgent) return { level: "warn", text: `${labelPrefix}: J-${j} (bientôt)` };
  if (dl <= thresholds.warn) return { level: "warn", text: `${labelPrefix}: J-${j}` };
  return { level: "good", text: `${labelPrefix}: ~${Math.floor(dl)} j` };
}

function _renderTodayDetailsHTML(dateStr) {
  // Reprend la logique "allocations" (ce que tu vois dans Budget journalier)
  const base = state.period.baseCurrency;

  const details = (state.allocations || []).filter(a => a.dateStr === dateStr);

  if (!details.length) {
    return `<div class="muted" style="margin-top:8px;">Aucun détail</div>`;
  }

  // Même rendu que ton budget journalier : liste à puces
  return `
    <div style="margin-top:10px; line-height:1.55;">
      ${details.map(x =>
        `• ${escapeHtml(x.label)} : ${Math.round(x.amountBase)} ${base}`
      ).join("<br>")}
    </div>
  `;
}

// mini helper: évite l'injection HTML via label
function escapeHtml(str) {
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function _sumWalletsBase() {
  const base = state?.period?.baseCurrency;
  let total = 0;
  for (const w of (state.wallets || [])) {
    const bal = Number(w.balance) || 0;
    const cur = w.currency || base;
    // amountToBase est déjà patché cross-rate -> parfait
    total += amountToBase(bal, cur);
  }
  return total;
}

function _addDaysISO(dateStr, days) {
  const d = parseISODateOrNull(dateStr);
  if (!d) return dateStr;
  const x = new Date(d);
  x.setDate(x.getDate() + (Number(days) || 0));
  return toLocalISODate(x);
}

function _pilotageInsights() {
  const base = state?.period?.baseCurrency;
  const today = toLocalISODate(new Date());
  const end = state?.period?.end;

  if (!base || !end) return null;

  const todayD = parseISODateOrNull(today);
  const endD = parseISODateOrNull(end);
  if (!todayD || !endD) return null;

  // jours restants incluant aujourd’hui
  const daysRemaining = Math.max(1, dayCountInclusive(clampMidnight(todayD), clampMidnight(endD)));

  const currentDaily = Number(state.period.dailyBudgetBase || 0);
  const balanceBase = _sumWalletsBase();

  // Cible: finir à 0 (on pourra rendre paramétrable plus tard)
  const targetEnd = 0;

  const recommendedDaily = (balanceBase - targetEnd) / daysRemaining;

  // Si tu gardes ton budget actuel, où tu finis ?
  const projectedEndBalance = balanceBase - (currentDaily * daysRemaining);

  // Jusqu’à quand tu tiens avec le budget actuel (date estimée)
  const daysAtCurrent = (currentDaily > 0) ? Math.floor(balanceBase / currentDaily) : Infinity;
  const zeroDate = isFinite(daysAtCurrent)
    ? _addDaysISO(today, Math.max(0, daysAtCurrent))
    : "—";

  // Décision courte
  let decision = "Aligné";
  let decisionLevel = "good";

  if (currentDaily <= 0) {
    decision = "Budget/j invalide";
    decisionLevel = "warn";
  } else {
    const ratio = recommendedDaily / currentDaily;
    if (ratio < 0.95) {
      decision = "Réduire";
      decisionLevel = "warn";
      if (ratio < 0.75) decisionLevel = "bad";
    } else if (ratio > 1.05) {
      decision = "Augmenter";
      decisionLevel = "good";
    } else {
      decision = "Aligné";
      decisionLevel = "good";
    }
  }

  return {
    base,
    today,
    end,
    daysRemaining,
    balanceBase,
    currentDaily,
    recommendedDaily,
    projectedEndBalance,
    zeroDate,
    decision,
    decisionLevel,
  };
}

function _signPillClass(v) {
  if (v >= 0) return "good";
  // négatif : on passe warn puis bad
  const abs = Math.abs(v);
  if (abs < (state.period.dailyBudgetBase || 1) * 3) return "warn";
  return "bad";
}

/* =========================
   KPI render
   ========================= */
function renderKPI() {
  const kpi = document.getElementById("kpi");

  // ✅ GUARD: si la vue n'a pas encore monté le conteneur KPI, on ne fait rien.
  if (!kpi) return;

  const today = toLocalISODate(new Date());
  const base = state.period.baseCurrency;

  const budgetToday = getDailyBudgetForDate(today);
  const includeUnpaid = (localStorage.getItem("travelbudget_kpi_projection_include_unpaid_v1") === "1");
  const totalEur = totalInEUR() + (includeUnpaid ? netPendingEUR() : 0);
  const projEndEur = projectedEndEURWithOptions({ includeUnpaid });
  const pendingEur = includeUnpaid ? netPendingEUR() : 0;

  const runway = cashRunwayInfo();        // dépenses cash réelles
  const cover  = cashConservativeInfo();  // burn prudent (budget/alloc)

  const cashTotalBase = cover ? cover.totalBase : (runway ? runway.totalBase : 0);
  const cashBurnBase  = cover ? cover.burnPerDay : (runway ? runway.burnPerDay : 0);

  const runwayDays = runway ? runway.daysLeft : Infinity;
  const coverDays  = cover  ? cover.daysLeft  : Infinity;

  const criticalDays = Math.min(runwayDays, coverDays);
  const driver = (criticalDays === runwayDays) ? "Dépenses" : "Budget";

  const todayDetailsHTML = _renderTodayDetailsHTML(today);
  const todayBudget = getDailyBudgetForDate(today);
  const todayBudgetSpent = budgetSpentBaseForDate(today);
  const todayPillClass = budgetClass(todayBudget);

  let level = "good";
  if (!isFinite(criticalDays)) level = "good";
  else if (criticalDays <= 2) level = "bad";
  else if (criticalDays <= 7) level = "warn";
  else level = "good";

  const daysText = !isFinite(criticalDays)
    ? "∞"
    : String(Math.max(0, Math.ceil(criticalDays)));

  const excluded = (cover?.excluded?.length ? cover.excluded : (runway?.excluded || []));
  const exclCurrencies = [...new Set(excluded.map(x => x.currency).filter(Boolean))];
  const fxNote = exclCurrencies.length ? `FX exclu : ${exclCurrencies.join(", ")}` : "";
  const pilot = _pilotageInsights();

  const miniCardStyle = `
    border:1px solid rgba(0,0,0,0.06);
    border-radius:16px;
    padding:12px;
    background:rgba(0,0,0,0.015);
  `;

  // Inject responsive CSS once
  if (!document.getElementById("kpiResponsiveStyles")) {
    const st = document.createElement("style");
    st.id = "kpiResponsiveStyles";
    st.textContent = `
      .kpi-layout { grid-template-columns: 420px 1fr; }
      .kpi-mini-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }

      @media (max-width: 1100px) {
        .kpi-layout { grid-template-columns: 1fr; }
      }

      @media (max-width: 720px) {
        .kpi-mini-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      }

      @media (max-width: 480px) {
        .kpi-mini-grid { grid-template-columns: 1fr; }
      }
    `;
    document.head.appendChild(st);
  }

  kpi.innerHTML = `
    <div class="card">
      <div style="display:flex; align-items:flex-end; justify-content:space-between; gap:12px;">
        <h2 style="margin:0;">KPIs</h2>
        <div class="muted" style="font-size:12px;">${today}</div>
      </div>

      <div class="kpi-layout" style="display:grid; gap:14px; margin-top:12px; align-items:start;">

        <!-- LEFT: KPIs -->
        <div>
          <!-- KPI mini-cards -->
          <div class="kpi-mini-grid" style="display:grid; gap:12px;">
            <div style="${miniCardStyle}">
              <div class="muted" style="font-size:12px;">Budget dispo</div>
              <div style="font-weight:800; font-size:26px; line-height:1.1; margin-top:6px; color:var(--text);">
                ${budgetToday.toFixed(0)} <span style="font-weight:700; font-size:14px;" class="muted">${base}</span>
              </div>
              <div class="muted" style="font-size:12px; margin-top:6px;">Aujourd’hui</div>
            </div>

            <div style="${miniCardStyle}">
              <div class="muted" style="font-size:12px;">Total wallets</div>
              <div style="font-weight:800; font-size:26px; line-height:1.1; margin-top:6px; color:var(--text);">
                ${Math.round(totalEur)} <span style="font-weight:700; font-size:14px;" class="muted">€</span>
              </div>
              <div class="muted" style="font-size:12px; margin-top:6px;">Somme convertie</div>
            </div>

            <div style="${miniCardStyle}">
              <div class="muted" style="font-size:12px;">Fin période</div>
              <div style="font-weight:800; font-size:26px; line-height:1.1; margin-top:6px; color:var(--text);">
                ${Math.round(projEndEur)} <span style="font-weight:700; font-size:14px;" class="muted">€</span>
              </div>
              <div class="muted" style="font-size:12px; margin-top:6px;">Projection</div>
              <label class="muted" style="display:flex;align-items:center;gap:8px;margin-top:10px;font-size:12px;user-select:none;">
                <input id="kpiIncludeUnpaidToggle" type="checkbox" ${includeUnpaid ? "checked" : ""} />
                Inclure à recevoir / à payer
                ${includeUnpaid ? `<span style="margin-left:auto;opacity:.85;">Net: <strong style="color:var(--text);">${Math.round(pendingEur)}€</strong></span>` : ``}
              </label>
            </div>
          </div>

          <!-- CASH card -->
          <div style="${miniCardStyle} margin-top:12px;">
            <div class="muted" style="font-size:12px;">Cash</div>

            <div style="display:flex; align-items:baseline; gap:10px; margin-top:8px;">
              <div style="font-weight:900; font-size:36px; line-height:1; color:var(--text);">
                ${daysText}
              </div>
              <div class="muted" style="font-weight:700;">jours</div>

              <span class="pill ${level}" style="margin-left:auto;">
                <span class="dot"></span>${driver}
              </span>
            </div>

            <div class="muted" style="font-size:12px; margin-top:8px;">
              Stock : <strong style="color:var(--text);">${fmtMoney(cashTotalBase, base)}</strong>
              <span style="margin:0 8px;">•</span>
              Burn : <strong style="color:var(--text);">${fmtMoney(cashBurnBase, base)}/j</strong>
            </div>

            ${fxNote ? `<div class="muted" style="font-size:12px; margin-top:6px; color:var(--warn);">${fxNote}</div>` : ``}
          </div>
        </div>

        <!-- RIGHT: Today details -->
        <div style="${miniCardStyle}">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px;">
            <div>
              <div style="font-weight:800; font-size:16px; color:var(--text);">Aujourd’hui</div>
              <div class="muted" style="font-size:12px; margin-top:2px;">${today}</div>
            </div>
            <span class="pill ${todayPillClass}">
              <span class="dot"></span>${todayBudget.toFixed(0)} ${base}
            </span>
          </div>

          ${todayDetailsHTML}
          ${pilot ? `
            <div style="margin-top:14px; padding-top:12px; border-top:1px solid rgba(0,0,0,0.06);">
              <div style="display:flex; justify-content:space-between; align-items:baseline; gap:12px;">
                <div style="font-weight:800; font-size:16px; color:var(--text);">Pilotage</div>
                <span class="pill ${pilot.decisionLevel}">
                  <span class="dot"></span>${pilot.decision}
                </span>
              </div>

              <div class="muted" style="font-size:12px; margin-top:8px;">
                <div style="display:flex; justify-content:space-between; gap:10px;">
                  <span>Budget recommandé</span>
                  <strong style="color:var(--text);">${fmtMoney(pilot.recommendedDaily, pilot.base)}/j</strong>
                </div>

                <div style="display:flex; justify-content:space-between; gap:10px; margin-top:6px;">
                  <span>Fin période (si budget actuel)</span>
                  <span class="pill ${_signPillClass(pilot.projectedEndBalance)}" style="padding:4px 10px;">
                    <span class="dot"></span>${fmtMoney(pilot.projectedEndBalance, pilot.base)}
                  </span>
                </div>

                <div style="display:flex; justify-content:space-between; gap:10px; margin-top:6px;">
                  <span>Date “0” (budget actuel)</span>
                  <strong style="color:var(--text);">${pilot.zeroDate}</strong>
                </div>

                <div style="display:flex; justify-content:space-between; gap:10px; margin-top:6px;">
                  <span>Jours restants</span>
                  <strong style="color:var(--text);">${pilot.daysRemaining}</strong>
                </div>
              </div>
            </div>
          ` : ``}
        </div>
      </div>
    </div>
  `;

  // Toggle: include unpaid (forecast) in KPI projection
  const _tog = document.getElementById("kpiIncludeUnpaidToggle");
  if (_tog) {
    _tog.onchange = () => {
      localStorage.setItem("travelbudget_kpi_projection_include_unpaid_v1", _tog.checked ? "1" : "0");
      renderKPI();
    };
  }
}