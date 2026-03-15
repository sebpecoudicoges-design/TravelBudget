/* =========================
   Transactions view (UX upgrade, logic unchanged)
   - Quick date-range shortcuts (Today / 7 days / Period / All)
   - Persist filters in localStorage
   - Preserve filter selections across re-renders
   ========================= */

const TX_FILTERS_KEY = "travelbudget_tx_filters_v1";

function _txEl(id){ return document.getElementById(id); }

function _txGetFilters() {
  return {
    from: _txEl("f-from")?.value || "",
    to: _txEl("f-to")?.value || "",
    walletId: _txEl("f-wallet")?.value || "all",
    cat: _txEl("f-category")?.value || "all",
    type: _txEl("f-type")?.value || "all",
    pay: _txEl("f-pay")?.value || "all",
    out: _txEl("f-out")?.value || "all",
    night: _txEl("f-night")?.value || "all",
    recurring: _txEl("f-recurring")?.value || "all",
    q: _txEl("f-q")?.value || "",
  };
}

function _txSetFilters(f) {
  if (!f) return;
  if (_txEl("f-from")) _txEl("f-from").value = f.from ?? "";
  if (_txEl("f-to")) _txEl("f-to").value = f.to ?? "";
  if (_txEl("f-wallet")) _txEl("f-wallet").value = f.walletId ?? "all";
  if (_txEl("f-category")) _txEl("f-category").value = f.cat ?? "all";
  if (_txEl("f-type")) _txEl("f-type").value = f.type ?? "all";
  if (_txEl("f-pay")) _txEl("f-pay").value = f.pay ?? "all";
  if (_txEl("f-out")) _txEl("f-out").value = f.out ?? "all";
  if (_txEl("f-night")) _txEl("f-night").value = f.night ?? "all";
  if (_txEl("f-recurring")) _txEl("f-recurring").value = f.recurring ?? "all";
  if (_txEl("f-q")) _txEl("f-q").value = f.q ?? "";
}

function _txLoadStoredFilters() {
  try {
    const raw = localStorage.getItem(TX_FILTERS_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    return (obj && typeof obj === "object") ? obj : null;
  } catch {
    return null;
  }
}

function _txSaveStoredFilters() {
  try {
    localStorage.setItem(TX_FILTERS_KEY, JSON.stringify(_txGetFilters()));
  } catch {}
}

function _txEnsureShortcutsUI() {
  // Insert a small shortcut bar above filters (no HTML changes required).
  const anchor = _txEl("f-from") || _txEl("f-wallet") || _txEl("tx-list");
  if (!anchor) return;

  const host = anchor.closest(".card") || anchor.parentElement;
  if (!host) return;

  if (host.querySelector("[data-tx-shortcuts='1']")) return;

  const wrap = document.createElement("div");
  wrap.setAttribute("data-tx-shortcuts", "1");
  wrap.style.display = "flex";
  wrap.style.flexWrap = "wrap";
  wrap.style.gap = "8px";
  wrap.style.alignItems = "center";
  wrap.style.marginBottom = "10px";

  const mkBtn = (label, onClick) => {
    const b = document.createElement("button");
    b.className = "btn small";
    b.type = "button";
    b.textContent = label;
    b.addEventListener("click", onClick);
    return b;
  };

  const setRange = (from, to) => {
    if (_txEl("f-from")) _txEl("f-from").value = from || "";
    if (_txEl("f-to")) _txEl("f-to").value = to || "";
    renderTransactions();
  };

  wrap.appendChild(mkBtn("Aujourd’hui", () => {
    const d = toLocalISODate(new Date());
    setRange(d, d);
  }));

  wrap.appendChild(mkBtn("7 jours", () => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 6);
    setRange(toLocalISODate(start), toLocalISODate(end));
  }));

  wrap.appendChild(mkBtn("Voyage", () => {
    const t = (state?.travels || []).find(x => String(x.id) === String(state?.activeTravelId || ""));
    setRange(t?.start || state?.period?.start || "", t?.end || state?.period?.end || "");
  }));

  wrap.appendChild(mkBtn("Tout", () => {
    setRange("", "");
  }));

  // Small separator
  const sep = document.createElement("span");
  sep.className = "muted";
  sep.style.margin = "0 4px";
  sep.textContent = "•";
  wrap.appendChild(sep);

  wrap.appendChild(mkBtn("Payé", () => {
    if (_txEl("f-pay")) _txEl("f-pay").value = "paid";
    renderTransactions();
  }));
  wrap.appendChild(mkBtn("À payer", () => {
    if (_txEl("f-pay")) _txEl("f-pay").value = "unpaid";
    renderTransactions();
  }));
  wrap.appendChild(mkBtn("Tous", () => {
    if (_txEl("f-pay")) _txEl("f-pay").value = "all";
    renderTransactions();
  }));

  // Insert before first filter field row if possible, else at top
  const firstField = anchor.closest(".row") || anchor.closest(".field") || anchor;
  if (firstField && firstField.parentElement) {
    firstField.parentElement.insertBefore(wrap, firstField);
  } else {
    host.insertBefore(wrap, host.firstChild);
  }
}


function _txEnsureHelpUI() {
  const anchor = _txEl("f-from") || _txEl("f-wallet") || _txEl("tx-list");
  if (!anchor) return;
  const host = anchor.closest(".card") || anchor.parentElement;
  if (!host) return;
  if (host.querySelector('[data-tb-help="transactions-overview"]')) return;
  try { if (window.tbUxIsDismissed && window.tbUxIsDismissed('transactions_overview')) return; } catch (_) {}
  const wrap = document.createElement('div');
  wrap.setAttribute('data-tb-help', 'transactions-overview');
  wrap.className = 'hint';
  wrap.style.padding = '10px';
  wrap.style.border = '1px solid rgba(0,0,0,.10)';
  wrap.style.borderRadius = '12px';
  wrap.style.background = 'rgba(0,0,0,.03)';
  wrap.style.marginBottom = '10px';
  wrap.innerHTML = `
    <div style="display:flex; justify-content:space-between; gap:12px; align-items:flex-start; flex-wrap:wrap;">
      <div style="min-width:260px; flex:1;">
        <div style="font-weight:700; margin-bottom:6px;">Comment lire les transactions</div>
        <div class="muted">
          <div>• <b>Payé</b> impacte la wallet tout de suite.</div>
          <div>• <b>À payer</b> reste planifié, sans sortir du cash pour l’instant.</div>
          <div>• <b>Hors budget</b> n’alimente pas le budget/jour, mais peut quand même toucher la wallet.</div>
        </div>
      </div>
      <div style="display:flex; gap:8px; flex-wrap:wrap;">
        <button class="btn" type="button" onclick="showView('help')">Aide</button>
        <button class="btn" type="button" data-tx-help-close="1">Masquer</button>
      </div>
    </div>`;
  const firstField = anchor.closest('.row') || anchor.closest('.field') || anchor;
  if (firstField && firstField.parentElement) firstField.parentElement.insertBefore(wrap, firstField);
  else host.insertBefore(wrap, host.firstChild);
  const close = wrap.querySelector('[data-tx-help-close]');
  if (close) close.onclick = () => { try { if (window.tbUxDismiss) window.tbUxDismiss('transactions_overview'); } catch(_) {} wrap.remove(); };
}

function _txInitFiltersOnce() {
  const list = _txEl("tx-list");
  if (!list || list._filtersInit) return;
  list._filtersInit = true;

  // Restore filters after selects exist
  const stored = _txLoadStoredFilters();
  if (stored) _txSetFilters(stored);

  _txEnsureShortcutsUI();
  _txEnsureHelpUI();
}

/* =========================
   Transactions view
   ========================= */
function fillFilterSelects() {
  const fWallet = document.getElementById("f-wallet");
  const fCat = document.getElementById("f-category");
  if (!fWallet || !fCat) return;

  // Preserve selections across re-renders (important UX fix)
  const prevWallet = fWallet.value;
  const prevCat = fCat.value;

  fWallet.innerHTML = `<option value="all">Tous</option>` + state.wallets.map((w) => `<option value="${w.id}">${w.name} (${w.currency})</option>`).join("");
  fCat.innerHTML = `<option value="all">Toutes</option>` + getCategories().map((c) => `<option value="${c}">${c}</option>`).join("");

  if (prevWallet && [...fWallet.options].some(o => o.value === prevWallet)) fWallet.value = prevWallet;
  if (prevCat && [...fCat.options].some(o => o.value === prevCat)) fCat.value = prevCat;
}


function _txCatColor(cat) {
  try {
    const key = String(cat || '').trim().toLowerCase();
    const c = state?.categoryColors?.[key];
    if (c && typeof c === 'string') return c;
  } catch (_) {}
  return null;
}
function _txCatBadge(cat) {
  const name = String(cat || '');
  const color = _txCatColor(name);
  if (!color) return escapeHTML(name);
  return `<span style="background:${color}; padding:2px 8px; border-radius:999px; font-size:12px;">${escapeHTML(name)}</span>`;
}

function renderTransactions() {
  const list = document.getElementById("tx-list");
  if (!list) return;

  fillFilterSelects();
  _txInitFiltersOnce();

  const from = document.getElementById("f-from").value;
  const to = document.getElementById("f-to").value;
  const walletId = document.getElementById("f-wallet").value;
  const cat = document.getElementById("f-category").value;
  const type = document.getElementById("f-type").value;
  const pay = document.getElementById("f-pay").value;
  const out = document.getElementById("f-out").value;
  const night = document.getElementById("f-night").value;
  const recurring = document.getElementById("f-recurring")?.value || "all";
  const q = (document.getElementById("f-q").value || "").toLowerCase().trim();

  // Persist filters (UX)
  _txSaveStoredFilters();

  let txs = state.transactions
  .filter(t => (t.travelId || t.travel_id) === state.activeTravelId)
  .slice()
  .sort((a, b) => b.createdAt - a.createdAt);
  const fromD = parseISODateOrNull(from);
  const toD = parseISODateOrNull(to);

  txs = txs.filter((tx) => {
    // Hide internal/shadow rows (e.g., Trip budget-only allocations).
    // These rows are tracked for split/budget logic but should not pollute the Transactions list.
    if (tx.isInternal) return false;



    

    const d = parseISODateOrNull(tx.dateStart);
    if (fromD && d && d < fromD) return false;
    if (toD && d && d > toD) return false;
    if (walletId !== "all" && tx.walletId !== walletId) return false;
    if (cat !== "all" && tx.category !== cat) return false;
    if (type === "expense" && tx.type !== "expense") return false;
    if (type === "income" && tx.type !== "income") return false;

    if (pay === "paid" && !tx.payNow) return false;
    if (pay === "unpaid" && tx.payNow) return false;

    if (out === "yes" && !tx.outOfBudget) return false;
    if (out === "no" && tx.outOfBudget) return false;

    if (night === "yes" && !tx.nightCovered) return false;
    if (night === "no" && tx.nightCovered) return false;

    const isRecurring = !!(tx.generatedByRule || tx.recurringRuleId);
    const recurringStatus = String(tx.recurringInstanceStatus || "").toLowerCase();
    if (recurring === "recurring" && !isRecurring) return false;
    if (recurring === "non_recurring" && isRecurring) return false;
    if (recurring === "generated" && recurringStatus !== "generated") return false;
    if (recurring === "confirmed" && recurringStatus !== "confirmed") return false;

    if (q) {
      const hay = `${tx.label || ""} ${tx.category || ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  if (!txs.length) {
    const w0 = state.wallets?.[0]?.id || null;
    list.innerHTML = `
      <div class="muted" style="margin-bottom:10px;">Aucune transaction pour ces filtres.</div>
      ${w0 ? `
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <button class="btn primary" onclick="openTxModal('expense','${w0}')">+ Dépense</button>
          <button class="btn" onclick="openTxModal('income','${w0}')">+ Entrée</button>
        </div>
      ` : ""}
    `;
  } else {
    list.innerHTML = "";
  }

  for (const tx of txs) {
    const w = findWallet(tx.walletId);
    const recurringTags = [];
    if (tx.generatedByRule || tx.recurringRuleId) recurringTags.push("récurrente");

    const st = String(tx.recurringInstanceStatus || "").toLowerCase();
    if (st === "generated") recurringTags.push("générée");
    if (st === "confirmed") recurringTags.push("confirmée");
    if (st === "detached") recurringTags.push("détachée");
    if (st === "skipped") recurringTags.push("sautée");

    const tags = [
      tx.type === "expense" ? (tx.payNow ? "payé" : "à payer") : "entrée",
      tx.outOfBudget ? "hors budget/jour" : null,
     tx.nightCovered ? "nuit couverte" : null,
     ...recurringTags,
    ].filter(Boolean);

    const div = document.createElement("div");
    div.className = "tx";
    div.innerHTML = `
      <div style="flex:1;">
        <div><strong>${tx.type === "expense" ? "Dépense" : "Entrée"}</strong> — ${tx.amount} ${tx.currency}</div>
        <div class="meta">
          ${tx.dateStart}${tx.dateEnd && tx.dateEnd !== tx.dateStart ? " → " + tx.dateEnd : ""}
          • ${w ? w.name : "Wallet"} • ${_txCatBadge(tx.category)} ${tx.label ? " • " + escapeHTML(tx.label) : ""}
        </div>
        <div class="tags">${tags.map((t) => `<span class="tag">${t}</span>`).join("")}</div>
      </div>

      <div style="display:flex; gap:8px; align-items:center;">
        ${(!tx.payNow && (tx.type === "expense" || tx.type === "income"))
          ? `<button class="btn small primary" onclick="markTxAsPaid(\'${tx.id}\')">✓ ${tx.type === "income" ? "Reçu" : "Payer"}</button>`
          : ""
        }
        <button class="btn small" onclick="openTxEditModal('${tx.id}')">✏️</button>
        <button class="btn small danger" onclick="deleteTx('${tx.id}')">🗑️</button>
      </div>
    `;
    list.appendChild(div);
  }

  const ids = ["f-from", "f-to", "f-wallet", "f-category", "f-type", "f-pay", "f-out", "f-night", "f-recurring", "f-q"];
  for (const id of ids) {
    const el = document.getElementById(id);
    if (el && !el._bound) {
      el._bound = true;
      el.addEventListener("input", renderTransactions);
      el.addEventListener("change", renderTransactions);
    }
  }
}
