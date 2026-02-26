/* =========================
   Dashboard render
   ========================= */
function renderWallets() {
  // Sur certaines pages (reset/recovery), le DOM dashboard n'existe pas.
  const container = document.getElementById("wallets-container");
  if (!container) return;

  
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
          <p>Solde : <strong style="color:var(--text);">${fmtMoney(w.balance, w.currency)}</strong></p>
          ${isBase
            ? `<p class="muted">Aujourd’hui (${today}) : budget dispo <strong>${budgetToday.toFixed(2)} ${base}</strong></p>`
            : `<p class="muted">Budget/jour calculé (${base})</p>`}
        </div>
        <div style="display:flex; flex-direction:column; gap:8px; min-width:190px;">
          <button class="btn primary" onclick="openTxModal('expense','${w.id}')">+ Dépense</button>
          <button class="btn" onclick="openTxModal('income','${w.id}')">+ Entrée</button>
          <button class="btn" onclick="adjustWalletBalance('${w.id}')">⚙ Ajuster solde</button>
          ${(((w.type || "") === "cash" || /\bCash\b/i.test(w.name)) ? `<button class="btn" onclick="openAtmWithdrawModal('${w.id}')">🏧 Retrait</button>` : ``)}
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
   Wallet CRUD
   ========================= */
async function createWallet() {
  try {
    const name = (prompt("Nom du wallet ? (ex: Cash (VND), Banque EUR)") || "").trim();
    if (!name) return;

    const currency = (prompt("Devise ? (ex: EUR, THB, VND)") || "").trim().toUpperCase();
    if (!currency) return;

    const typeRaw = (prompt("Type ? (cash, bank, card, savings, other)", "cash") || "").trim().toLowerCase();
    const allowed = ["cash", "bank", "card", "savings", "other"];
    if (!allowed.includes(typeRaw)) return alert("Type invalide. Valeurs: cash, bank, card, savings, other.");

    const balanceStr = (prompt("Solde initial ?", "0") || "0").replace(",", ".");
    const balance = Number(balanceStr);
    if (!isFinite(balance)) return alert("Solde invalide.");

    // ✅ period_id requis (wallets.period_id NOT NULL)
    const periodId = state?.period?.id || localStorage.getItem(ACTIVE_PERIOD_KEY);
    if (!periodId) return alert("Aucune période active (period_id introuvable).");

    const { error } = await sb.from(TB_CONST.TABLES.wallets).insert([{
      user_id: sbUser.id,
      period_id: periodId,
      name,
      currency,
      balance,
      type: typeRaw,
    }]);
    if (error) throw error;

    await refreshFromServer();
  } catch (e) {
    console.error(e);
    alert(e?.message || "Erreur création wallet");
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
