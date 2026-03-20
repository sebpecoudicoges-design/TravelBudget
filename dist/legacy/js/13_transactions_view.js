const TB_TX_BULK = window.__TB_TX_BULK || (window.__TB_TX_BULK = {
  selectedIds: new Set(),
  visibleIds: [],
});

function _txBulkVisibleSelectionCount() {
  return (TB_TX_BULK.visibleIds || []).filter((id) => TB_TX_BULK.selectedIds.has(id)).length;
}

function _txBulkPruneSelection(visibleTxs) {
  const visibleIds = (visibleTxs || []).map((tx) => String(tx?.id || '')).filter(Boolean);
  TB_TX_BULK.visibleIds = visibleIds;
  const visibleSet = new Set(visibleIds);
  TB_TX_BULK.selectedIds = new Set([...TB_TX_BULK.selectedIds].filter((id) => visibleSet.has(id)));
}

function _txBulkToggleOne(id, checked) {
  const key = String(id || '');
  if (!key) return;
  if (checked) TB_TX_BULK.selectedIds.add(key);
  else TB_TX_BULK.selectedIds.delete(key);
  renderTransactions();
}

function _txBulkToggleAll(checked) {
  const visibleIds = Array.isArray(TB_TX_BULK.visibleIds) ? TB_TX_BULK.visibleIds : [];
  if (checked) visibleIds.forEach((id) => TB_TX_BULK.selectedIds.add(id));
  else visibleIds.forEach((id) => TB_TX_BULK.selectedIds.delete(id));
  renderTransactions();
}

function _txBulkSelectedRows() {
  const selected = TB_TX_BULK.selectedIds || new Set();
  return (Array.isArray(state?.transactions) ? state.transactions : []).filter((tx) => selected.has(String(tx?.id || '')));
}

function _txBulkSelectedCommonCategory() {
  const rows = _txBulkSelectedRows().filter((tx) => !tx?.isInternal);
  if (!rows.length) return '';
  const categories = [...new Set(rows.map((tx) => String(tx?.category || '').trim()).filter(Boolean))];
  return categories.length === 1 ? categories[0] : '';
}

function _txBulkSubcategoryOptionsHtml(category, selectedValue) {
  const current = String(category || '').trim();
  if (!current) return '<option value="">Choisir d’abord une catégorie</option>';
  const rows = (typeof getCategorySubcategories === 'function') ? getCategorySubcategories(current) : [];
  const options = ['<option value="">Aucune</option>'];
  rows.forEach((row) => {
    const name = String(row?.name || '').trim();
    if (!name) return;
    const selected = name === String(selectedValue || '') ? ' selected' : '';
    options.push(`<option value="${escapeHTML(name)}"${selected}>${escapeHTML(name)}</option>`);
  });
  return options.join('');
}

function _txBulkSyncControls() {
  const catEl = document.getElementById('tx-bulk-category');
  const subEl = document.getElementById('tx-bulk-subcategory');
  const countEl = document.getElementById('tx-bulk-count');
  const commonEl = document.getElementById('tx-bulk-common-category');
  if (countEl) countEl.textContent = String(_txBulkVisibleSelectionCount());
  const commonCategory = _txBulkSelectedCommonCategory();
  if (commonEl) commonEl.textContent = commonCategory || 'mixte';
  if (!catEl || !subEl) return;
  const sourceCategory = String(catEl.value || '').trim() || commonCategory;
  const prev = String(subEl.value || '').trim();
  subEl.innerHTML = _txBulkSubcategoryOptionsHtml(sourceCategory, prev);
  subEl.disabled = !sourceCategory;
}

async function applyBulkTxClassification() {
  return safeCall('Bulk update transactions', async () => {
    const selectedIds = [...(TB_TX_BULK.selectedIds || new Set())];
    if (!selectedIds.length) throw new Error('Aucune transaction sélectionnée.');

    const catEl = document.getElementById('tx-bulk-category');
    const subEl = document.getElementById('tx-bulk-subcategory');
    const chosenCategory = String(catEl?.value || '').trim();
    const chosenSubcategory = String(subEl?.value || '').trim();
    const commonCategory = _txBulkSelectedCommonCategory();

    if (!chosenCategory && !chosenSubcategory) throw new Error('Choisis une catégorie et/ou une sous-catégorie.');
    if (!chosenCategory && chosenSubcategory && !commonCategory) {
      throw new Error('Pour changer seulement la sous-catégorie, les transactions sélectionnées doivent partager la même catégorie.');
    }

    const payload = chosenCategory
      ? { category: chosenCategory, subcategory: chosenSubcategory || null }
      : { subcategory: chosenSubcategory || null };

    for (const id of selectedIds) {
      const { error } = await sb
        .from(TB_CONST.TABLES.transactions)
        .update(payload)
        .eq('id', id)
        .eq('travel_id', state.activeTravelId);
      if (error) throw error;
    }

    TB_TX_BULK.selectedIds.clear();
    await refreshFromServer();
    renderTransactions();
  });
}

window._txBulkToggleOne = _txBulkToggleOne;
window._txBulkToggleAll = _txBulkToggleAll;
window._txBulkSyncControls = _txBulkSyncControls;
window.applyBulkTxClassification = applyBulkTxClassification;

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
    subcategory: _txEl("f-subcategory")?.value || "all",
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
  if (_txEl("f-subcategory")) _txEl("f-subcategory").value = f.subcategory ?? "all";
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

function _txFillSubcategoryFilterSelect(categoryValue, preserveValue) {
  const fSub = document.getElementById("f-subcategory");
  if (!fSub) return;

  const cat = String(categoryValue || "").trim();
  const activeCategory = cat && cat !== "all" ? cat : "";

  if (!activeCategory) {
    fSub.innerHTML = `<option value="all">Toutes</option>`;
    fSub.value = "all";
    fSub.disabled = true;
    return;
  }

  const rows = (typeof getCategorySubcategories === "function")
    ? getCategorySubcategories(activeCategory)
    : [];

  const options = [
    `<option value="all">Toutes</option>`,
    `<option value="__none__">Aucune</option>`
  ];
  rows.forEach((row) => {
    const name = String(row?.name || "").trim();
    if (!name) return;
    options.push(`<option value="${escapeHTML(name)}">${escapeHTML(name)}</option>`);
  });

  fSub.innerHTML = options.join("");
  fSub.disabled = false;

  const wanted = String(preserveValue || "").trim();
  const exists = [...fSub.options].some((o) => o.value === wanted);
  fSub.value = exists ? wanted : "all";
}

function fillFilterSelects() {
  const fWallet = document.getElementById("f-wallet");
  const fCat = document.getElementById("f-category");
  const fSub = document.getElementById("f-subcategory");
  if (!fWallet || !fCat) return;

  const prevWallet = fWallet.value;
  const prevCat = fCat.value;
  const prevSub = fSub ? fSub.value : "all";

  fWallet.innerHTML = `<option value="all">Tous</option>` + state.wallets.map((w) => `<option value="${w.id}">${w.name} (${w.currency})</option>`).join("");
  fCat.innerHTML = `<option value="all">Toutes</option>` + getCategories().map((c) => `<option value="${c}">${c}</option>`).join("");

  if (prevWallet && [...fWallet.options].some(o => o.value === prevWallet)) fWallet.value = prevWallet;
  if (prevCat && [...fCat.options].some(o => o.value === prevCat)) fCat.value = prevCat;

  _txFillSubcategoryFilterSelect(fCat.value, prevSub);
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
  const subcategory = document.getElementById("f-subcategory")?.value || "all";
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
    if (subcategory === "__none__" && String(tx.subcategory || "") !== "") return false;
    if (subcategory !== "all" && subcategory !== "__none__" && String(tx.subcategory || "") !== subcategory) return false;
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
    if (recurring === "recurring_generated" && !(isRecurring && recurringStatus === "generated")) return false;
    if (recurring === "recurring_confirmed" && !(isRecurring && recurringStatus === "confirmed")) return false;
    if (recurring === "generated" && recurringStatus !== "generated") return false;
    if (recurring === "confirmed" && recurringStatus !== "confirmed") return false;

    if (q) {
      const hay = `${tx.label || ""} ${tx.category || ""} ${tx.subcategory || ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  _txBulkPruneSelection(txs);

  const bulkCount = _txBulkVisibleSelectionCount();
  const bulkAllChecked = !!(txs.length && bulkCount === txs.length);
  const bulkCommonCategory = _txBulkSelectedCommonCategory();
  const bulkCategoryOptions = [`<option value="">Catégorie inchangée</option>`]
    .concat(getCategories().map((c) => `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`))
    .join('');
  const bulkSubcategoryOptions = _txBulkSubcategoryOptionsHtml(bulkCommonCategory, '');

  const bulkToolbarHtml = `
    <div class="card" style="margin-bottom:10px;padding:12px;display:grid;gap:10px;">
      <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
        <label style="display:flex;align-items:center;gap:8px;font-weight:600;">
          <input type="checkbox" ${bulkAllChecked ? 'checked' : ''} onchange="_txBulkToggleAll(this.checked)" />
          Tout sélectionner (vue filtrée)
        </label>
        <span class="muted">Sélection : <strong id="tx-bulk-count">${bulkCount}</strong></span>
        <span class="muted">Catégorie commune : <strong id="tx-bulk-common-category">${escapeHTML(bulkCommonCategory || 'mixte')}</strong></span>
      </div>
      <div style="display:flex;gap:8px;align-items:end;flex-wrap:wrap;">
        <div class="field" style="min-width:220px;">
          <label>Nouvelle catégorie</label>
          <select id="tx-bulk-category" onchange="_txBulkSyncControls()">${bulkCategoryOptions}</select>
        </div>
        <div class="field" style="min-width:220px;">
          <label>Nouvelle sous-catégorie</label>
          <select id="tx-bulk-subcategory">${bulkSubcategoryOptions}</select>
        </div>
        <button class="btn primary" type="button" onclick="applyBulkTxClassification()" ${bulkCount ? '' : 'disabled'}>Appliquer aux sélectionnées</button>
      </div>
      <div class="muted" style="font-size:12px;">
        Catégorie seule = la sous-catégorie est vidée. Sous-catégorie seule = uniquement si la sélection partage déjà la même catégorie.
      </div>
    </div>`;

  if (!txs.length) {
    const w0 = state.wallets?.[0]?.id || null;
    list.innerHTML = bulkToolbarHtml + `
      <div class="muted" style="margin-bottom:10px;">Aucune transaction pour ces filtres.</div>
      ${w0 ? `
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <button class="btn primary" onclick="openTxModal('expense','${w0}')">+ Dépense</button>
          <button class="btn" onclick="openTxModal('income','${w0}')">+ Entrée</button>
        </div>
      ` : ""}
    `;
  } else {
    list.innerHTML = bulkToolbarHtml;
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
    const txChecked = TB_TX_BULK.selectedIds.has(String(tx.id));
    div.innerHTML = `
      <div style="display:flex;align-items:flex-start;gap:10px;">
        <input type="checkbox" style="margin-top:4px;" ${txChecked ? 'checked' : ''} onchange="_txBulkToggleOne('${escapeHTML(String(tx.id))}', this.checked)" />
        <div style="flex:1;">
        <div><strong>${tx.type === "expense" ? "Dépense" : "Entrée"}</strong> — ${tx.amount} ${tx.currency}</div>
        <div class="meta">
          ${tx.dateStart}${tx.dateEnd && tx.dateEnd !== tx.dateStart ? " → " + tx.dateEnd : ""}
          • ${w ? w.name : "Wallet"} • ${_txCatBadge(tx.category)} ${tx.label ? " • " + escapeHTML(tx.label) : ""}
        </div>
        <div class="tags">${tags.map((t) => `<span class="tag">${t}</span>`).join("")}</div>
        </div>
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

  const ids = ["f-from", "f-to", "f-wallet", "f-category", "f-subcategory", "f-type", "f-pay", "f-out", "f-night", "f-recurring", "f-q"];
  _txBulkSyncControls();

  for (const id of ids) {
    const el = document.getElementById(id);
    if (el && !el._bound) {
      el._bound = true;
      el.addEventListener("input", renderTransactions);
      el.addEventListener("change", renderTransactions);
    }
  }
}
