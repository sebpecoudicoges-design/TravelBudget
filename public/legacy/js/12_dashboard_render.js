/* =========================
   Dashboard render
   ========================= */
function renderWallets() {
  renderKPI();
  const container = document.getElementById("wallets-container");
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
  const budgetToday = getDailyBudgetForDate(today);
  const daily = state.period.dailyBudgetBase || 1;
  const base = state.period.baseCurrency;

  const orderedWallets = sortWalletsBySavedOrder([...(state.wallets || [])]);

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
          ${isBase ? `<p class="muted">Aujourd’hui (${today}) : budget dispo <strong>${budgetToday.toFixed(2)} ${base}</strong></p>` : `<p class="muted">Budget/jour calculé (${base})</p>`}
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
  enableWalletsReorderDrag(listEl);
}


function renderDailyBudget() {
  const container = document.getElementById("daily-budget-container");
  container.innerHTML = "";

  const start = parseISODateOrNull(state.period.start);
  const end = parseISODateOrNull(state.period.end);
  if (!start || !end) return;

  const base = state.period.baseCurrency;

  forEachDateInclusive(start, end, (d) => {
    const dateStr = toLocalISODate(d);
    const allocated = getAllocatedBaseForDate(dateStr);
    const budget = state.period.dailyBudgetBase - allocated;
    const details = state.allocations.filter((a) => a.dateStr === dateStr);

    const div = document.createElement("div");
    div.className = "day";
    div.innerHTML = `
      <div class="top">
        <div><strong>${dateStr}</strong></div>
        <div class="pill ${budgetClass(budget)}"><span class="dot"></span>${budget.toFixed(0)} ${base}</div>
      </div>
      ${details.length
        ? `<div class="details">${details.map((x) => `• ${x.label} : ${x.amountBase.toFixed(0)} ${base}`).join("<br>")}</div>`
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

    const { error } = await sb.from("wallets").insert([{
      user_id: sbUser.id,
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
      .from("transactions")
      .select("id")
      .eq("wallet_id", walletId)
      .limit(1);

    if (tErr) throw tErr;
    if (tx && tx.length) {
      return alert("Impossible de supprimer : des transactions existent sur ce wallet.");
    }

    if (!confirm(`Supprimer le wallet "${w.name} (${w.currency})" ?`)) return;

    const { error } = await sb.from("wallets").delete().eq("id", walletId);
    if (error) throw error;

    await refreshFromServer();
  } catch (e) {
    console.error(e);
    alert(e?.message || "Erreur suppression wallet");
  }
}

/* =========================
   ATM withdraw helper
   - Adds to selected cash wallet (native currency)
   - Deducts from a EUR bank wallet (first non-cash EUR wallet)
   - Optional EUR fee
   ========================= */
async function openAtmWithdrawModal(cashWalletId) {
  try {
    const cashW = (state.wallets || []).find(w => w.id === cashWalletId);
    if (!cashW) return;

    const bankW = (state.wallets || []).find(w => w.currency === "EUR" && ((w.type || "") === "bank" || ((w.type || "") !== "cash" && !/\bCash\b/i.test(w.name))));
    if (!bankW) return alert("Aucun wallet Banque en EUR trouvé (nécessaire pour le retrait).");

    const today = toLocalISODate(new Date());

    const amountCashStr = (prompt(`Montant retiré (ajout sur ${cashW.name} en ${cashW.currency}) ?`, "0") || "0").replace(",", ".");
    const amountCash = Number(amountCashStr);
    if (!isFinite(amountCash) || amountCash <= 0) return;

    const rateKey = `EUR-${cashW.currency}`;
    const r = Number(state.exchangeRates?.[rateKey] || 0);
    const suggestedEur = (r > 0) ? (amountCash / r) : 0;

    const amountEurStr = (prompt(
      `Montant à débiter en EUR sur ${bankW.name} ?\n(Suggestion: ${suggestedEur ? suggestedEur.toFixed(2) : "?"} EUR)`,
      suggestedEur ? suggestedEur.toFixed(2) : "0"
    ) || "0").replace(",", ".");
    const amountEur = Number(amountEurStr);
    if (!isFinite(amountEur) || amountEur <= 0) return alert("Montant EUR invalide.");

    const feeStr = (prompt("Frais bancaires en EUR (0 si aucun) ?", "0") || "0").replace(",", ".");
    const fee = Number(feeStr);
    if (!isFinite(fee) || fee < 0) return alert("Frais invalides.");

    // + Cash
    const { error: e1 } = await sb.rpc("apply_transaction", {
      p_wallet_id: cashW.id,
      p_type: "income",
      p_amount: amountCash,
      p_currency: cashW.currency,
      p_category: "atm_withdraw",
      p_note: "ATM withdraw (+cash)",
      p_date_start: today,
      p_date_end: today,
      p_pay_now: true,
      p_out_of_budget: true,
      p_night_covered: false
    });
    if (e1) throw e1;

    // - Bank (EUR)
    const { error: e2 } = await sb.rpc("apply_transaction", {
      p_wallet_id: bankW.id,
      p_type: "expense",
      p_amount: amountEur,
      p_currency: "EUR",
      p_category: "atm_withdraw",
      p_note: `ATM withdraw (-bank → ${cashW.currency})`,
      p_date_start: today,
      p_date_end: today,
      p_pay_now: true,
      p_out_of_budget: true,
      p_night_covered: false
    });
    if (e2) throw e2;

    // - Fee
    if (fee > 0) {
      const { error: e3 } = await sb.rpc("apply_transaction", {
        p_wallet_id: bankW.id,
        p_type: "expense",
        p_amount: fee,
        p_currency: "EUR",
        p_category: "bank_fee",
        p_note: "Frais retrait",
        p_date_start: today,
        p_date_end: today,
        p_pay_now: true,
        p_out_of_budget: true,
        p_night_covered: false
      });
      if (e3) throw e3;
    }

    await refreshFromServer();
  } catch (e) {
    console.error(e);
    alert(e?.message || "Erreur retrait ATM");
  }
}


/* =========================
   Wallets: drag & drop reorder (within wallets column)
   - Reorders only UI order, persisted in localStorage (no DB risk)
   - Key: walletOrder_v1 (array of wallet ids)
   ========================= */
const WALLET_ORDER_KEY = "walletOrder_v1";

function loadWalletOrder() {
  try {
    const raw = localStorage.getItem(WALLET_ORDER_KEY);
    const arr = JSON.parse(raw || "null");
    return Array.isArray(arr) ? arr : null;
  } catch {
    return null;
  }
}

function saveWalletOrder(ids) {
  try { localStorage.setItem(WALLET_ORDER_KEY, JSON.stringify(ids)); } catch {}
}

function sortWalletsBySavedOrder(wallets) {
  const order = loadWalletOrder();
  if (!order || order.length === 0) return wallets;

  const byId = new Map(wallets.map(w => [w.id, w]));
  const out = [];
  for (const id of order) {
    const w = byId.get(id);
    if (w) out.push(w);
    byId.delete(id);
  }
  // Append wallets not in saved list
  for (const w of wallets) {
    if (byId.has(w.id)) out.push(w);
  }
  return out;
}

function enableWalletsReorderDrag(listEl) {
  if (!listEl) return;
  const items = listEl.querySelectorAll(".wallet-item");
  items.forEach(item => {
    item.draggable = true;

    item.addEventListener("dragstart", (e) => {
      const t = e.target;
      if (t && (t.closest("button") || t.closest("input") || t.closest("select") || t.closest("textarea") || t.closest("a"))) {
        e.preventDefault();
        return;
      }
      item.classList.add("dragging");
    });

    item.addEventListener("dragend", () => {
      item.classList.remove("dragging");

      // Persist new order
      const ids = [...listEl.querySelectorAll(".wallet-item")].map(el => el.dataset.walletId).filter(Boolean);
      if (ids.length) saveWalletOrder(ids);
    });
  });

  listEl.addEventListener("dragover", (e) => {
    e.preventDefault();
    const dragging = listEl.querySelector(".wallet-item.dragging");
    if (!dragging) return;

    const after = getWalletDragAfterElement(listEl, e.clientY);
    if (after == null) listEl.appendChild(dragging);
    else listEl.insertBefore(dragging, after);
  });
}

function getWalletDragAfterElement(container, y) {
  const els = [...container.querySelectorAll(".wallet-item:not(.dragging)")];
  let closest = { offset: Number.NEGATIVE_INFINITY, element: null };
  for (const child of els) {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) {
      closest = { offset, element: child };
    }
  }
  return closest.element;
}

