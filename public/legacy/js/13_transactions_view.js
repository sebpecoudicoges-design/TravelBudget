const TB_TX_BULK = window.__TB_TX_BULK || (window.__TB_TX_BULK = {
  selectedIds: new Set(),
  visibleIds: [],
});

function _txT(k, vars) {
  try { return window.tbT ? window.tbT(k, vars) : k; } catch (_) { return k; }
}

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
  _txBulkSetMessage('');
  if (checked) TB_TX_BULK.selectedIds.add(key);
  else TB_TX_BULK.selectedIds.delete(key);
  renderTransactions();
}

function _txBulkToggleAll(checked) {
  _txBulkSetMessage('');
  const visibleIds = Array.isArray(TB_TX_BULK.visibleIds) ? TB_TX_BULK.visibleIds : [];
  if (checked) visibleIds.forEach((id) => TB_TX_BULK.selectedIds.add(id));
  else visibleIds.forEach((id) => TB_TX_BULK.selectedIds.delete(id));
  renderTransactions();
}

function _txBulkSelectedRows() {
  const selected = TB_TX_BULK.selectedIds || new Set();
  return (Array.isArray(state?.transactions) ? state.transactions : []).filter((tx) => selected.has(String(tx?.id || '')));
}

function _txBulkSelectedLockedRows() {
  const getLock = window.Core?.transactionGuards?.getTransactionLockState;
  const walletAdjustmentCategory = TB_CONST?.CATS?.wallet_adjustment || 'Ajustement wallet';
  return _txBulkSelectedRows().filter((tx) => {
    try {
      if (typeof getLock === 'function') return !!getLock(tx, { walletAdjustmentCategory })?.locked;
    } catch (_) {}
    return !!(tx?.tripExpenseId || tx?.trip_expense_id || String(tx?.category || '').trim().toLowerCase() === String(walletAdjustmentCategory).toLowerCase());
  });
}

function _txBulkSelectedCommonCategory() {
  const rows = _txBulkSelectedRows().filter((tx) => !tx?.isInternal);
  if (!rows.length) return '';
  const categories = [...new Set(rows.map((tx) => String(tx?.category || '').trim()).filter(Boolean))];
  return categories.length === 1 ? categories[0] : '';
}

function _txBulkSetMessage(message, type = 'warn') {
  const text = String(message || '').trim();
  try {
    const el = document.getElementById('tx-bulk-message');
    if (!el) {
      if (text && typeof toastWarn === 'function') toastWarn(text);
      return;
    }
    el.textContent = text;
    el.style.display = text ? 'block' : 'none';
    el.style.borderColor = type === 'success' ? 'rgba(34,197,94,.35)' : 'rgba(245,158,11,.38)';
    el.style.background = type === 'success' ? 'rgba(34,197,94,.10)' : 'rgba(245,158,11,.12)';
  } catch (_) {}
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
  _txBulkSetMessage('');
  try {
    const selectedIds = [...(TB_TX_BULK.selectedIds || new Set())];
    const lockedRows = _txBulkSelectedLockedRows();
    if (lockedRows.length) {
      _txBulkSetMessage(_txT('transactions.bulk.error.locked', { count: lockedRows.length }));
      return;
    }
    if (!selectedIds.length) {
      _txBulkSetMessage(_txT('transactions.bulk.error.none'));
      return;
    }
    if (!selectedIds.length) throw new Error('Aucune transaction sélectionnée.');

    const catEl = document.getElementById('tx-bulk-category');
    const subEl = document.getElementById('tx-bulk-subcategory');
    const chosenCategory = String(catEl?.value || '').trim();
    const chosenSubcategory = String(subEl?.value || '').trim();
    const commonCategory = _txBulkSelectedCommonCategory();

    if (!chosenCategory && !chosenSubcategory) {
      _txBulkSetMessage(_txT('transactions.bulk.error.choose'));
      return;
    }
    if (!chosenCategory && chosenSubcategory && !commonCategory) {
      _txBulkSetMessage(_txT('transactions.bulk.error.subcategory_common'));
      return;
    }

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
    _txBulkSetMessage(_txT('transactions.bulk.success', { count: selectedIds.length }), 'success');
    if (typeof window.tbAfterMutationRefresh === 'function') await window.tbAfterMutationRefresh('tx:bulk_classification');
    else await refreshFromServer();
  } catch (e) {
    const msg = (typeof normalizeSbError === 'function') ? normalizeSbError(e) : (e?.message || String(e));
    console.warn('[transactions bulk]', msg);
    _txBulkSetMessage(msg);
  }
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

function _fmtMoney(v, cur){
  try { return fmtMoney(v, cur); }
  catch (_) {
    const n = Number(v);
    return `${Number.isFinite(n) ? n.toFixed(2) : '0.00'} ${cur || ''}`.trim();
  }
}

try {
  window.tbOnLangChange = window.tbOnLangChange || [];
  if (!window.__tbTransactionsLangBound) {
    window.__tbTransactionsLangBound = true;
    window.tbOnLangChange.push(() => {
      try { if (typeof renderTransactions === "function") renderTransactions(); } catch (_) {}
    });
  }
} catch (_) {}

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
    invoice: _txEl("f-invoice")?.value || "all",
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
  if (_txEl("f-invoice")) _txEl("f-invoice").value = f.invoice ?? "all";
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

  wrap.appendChild(mkBtn(_txT("transactions.shortcut.today"), () => {
    const d = toLocalISODate(new Date());
    setRange(d, d);
  }));

  wrap.appendChild(mkBtn(_txT("transactions.shortcut.days7"), () => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 6);
    setRange(toLocalISODate(start), toLocalISODate(end));
  }));

  wrap.appendChild(mkBtn(_txT("transactions.shortcut.trip"), () => {
    const t = (state?.travels || []).find(x => String(x.id) === String(state?.activeTravelId || ""));
    setRange(t?.start || state?.period?.start || "", t?.end || state?.period?.end || "");
  }));

  wrap.appendChild(mkBtn(_txT("transactions.shortcut.all"), () => {
    setRange("", "");
  }));

  // Small separator
  const sep = document.createElement("span");
  sep.className = "muted";
  sep.style.margin = "0 4px";
  sep.textContent = "•";
  wrap.appendChild(sep);

  wrap.appendChild(mkBtn(_txT("transactions.shortcut.paid"), () => {
    if (_txEl("f-pay")) _txEl("f-pay").value = "paid";
    renderTransactions();
  }));
  wrap.appendChild(mkBtn(_txT("transactions.shortcut.unpaid"), () => {
    if (_txEl("f-pay")) _txEl("f-pay").value = "unpaid";
    renderTransactions();
  }));
  wrap.appendChild(mkBtn(_txT("transactions.shortcut.all_m"), () => {
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


function _txEnsureInvoiceFilterUI() {
  if (_txEl("f-invoice")) return;
  const anchor = _txEl("f-recurring") || _txEl("f-q") || _txEl("f-type") || _txEl("tx-list");
  if (!anchor) return;
  const row = anchor.closest(".row") || anchor.parentElement;
  if (!row) return;

  const field = document.createElement("div");
  field.className = "field";
  field.setAttribute("data-tx-invoice-filter", "1");
  field.style.minWidth = "150px";
  field.innerHTML = `
    <label>${_txT("transactions.filters.invoice")}</label>
    <select id="f-invoice">
      <option value="all">${_txT("transactions.invoice_filter.all")}</option>
      <option value="with">${_txT("transactions.invoice_filter.with")}</option>
      <option value="without">${_txT("transactions.invoice_filter.without")}</option>
    </select>
  `;

  const anchorField = anchor.closest(".field") || anchor;
  if (anchorField && anchorField.parentElement === row) {
    anchorField.insertAdjacentElement("afterend", field);
  } else {
    row.appendChild(field);
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
        <div style="font-weight:700; margin-bottom:6px;">${_txT("transactions.help.title")}</div>
        <div class="muted">
          <div>• ${_txT("transactions.help.paid")}</div>
          <div>• ${_txT("transactions.help.unpaid")}</div>
          <div>• ${_txT("transactions.help.out")}</div>
        </div>
      </div>
      <div style="display:flex; gap:8px; flex-wrap:wrap;">
        <button class="btn" type="button" onclick="showView('help')">${_txT("nav.help")}</button>
        <button class="btn" type="button" data-tx-help-close="1">${_txT("transactions.help.hide")}</button>
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

  // Add optional filter controls before restoring persisted values.
  _txEnsureInvoiceFilterUI();

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
    fSub.innerHTML = `<option value="all">${_txT("transactions.option.all_f")}</option>`;
    fSub.value = "all";
    fSub.disabled = true;
    return;
  }

  const rows = (typeof getCategorySubcategories === "function")
    ? getCategorySubcategories(activeCategory)
    : [];

  const options = [
    `<option value="all">${_txT("transactions.option.all_f")}</option>`,
    `<option value="__none__">${_txT("transactions.option.none_f")}</option>`
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

  fWallet.innerHTML = `<option value="all">${_txT("transactions.option.all_m")}</option>` + state.wallets.map((w) => `<option value="${w.id}">${w.name} (${w.currency})</option>`).join("");
  fCat.innerHTML = `<option value="all">${_txT("transactions.option.all_f")}</option>` + getCategories().map((c) => `<option value="${c}">${c}</option>`).join("");

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

window.tbOpenTransactionFromTrip = function tbOpenTransactionFromTrip(txId) {
  const id = String(txId || '').trim();
  if (!id) return;
  window.__tbFocusTransactionId = id;
  if (typeof showView === "function") showView("transactions");
};

window.tbOpenTripExpenseFromTransaction = function tbOpenTripExpenseFromTransaction(expenseId) {
  const id = String(expenseId || '').trim();
  if (!id) return;
  window.__tbFocusTripExpenseId = id;
  if (typeof showView === "function") showView("trip");
};


/* =========================
   Transaction documents / invoices bridge
   V9.7.5 safe: dedicated modal, visible linked-document count, invoice filter, i18n, constants, no financial mutation.
   Requires SQL table public.transaction_documents.
   ========================= */

const TB_TX_DOC_BUCKET = window.TB_CONST?.DOCUMENTS?.BUCKETS?.personal_documents || 'personal-documents';
const TB_TX_DOC_FOLDER_NAME = window.TB_CONST?.DOCUMENTS?.FOLDERS?.invoices || 'Factures';

const TB_TX_DOC_COUNTS = window.__TB_TX_DOC_COUNTS || (window.__TB_TX_DOC_COUNTS = {
  map: new Map(),
  loading: false,
});

function _txDocT(k, vars){
  try { return window.tbT ? window.tbT(k, vars) : k; } catch (_) { return k; }
}

function _txDocClient(){
  try { if (typeof sb !== 'undefined' && sb && sb.from) return sb; } catch (_) {}
  try { if (window.sb && window.sb.from) return window.sb; } catch (_) {}
  return null;
}

function _txDocTable(name, fallback){
  return (window.TB_CONST && window.TB_CONST.TABLES && window.TB_CONST.TABLES[name]) || fallback || name;
}

function _txDocEsc(v){
  try { return escapeHTML(String(v ?? '')); }
  catch (_) { return String(v ?? '').replace(/[&<>'"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[c])); }
}

function _txDocCleanFilename(name){
  return String(name || 'document')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120) || 'document';
}

function _txDocRelationLabel(type){
  const key = String(type || 'invoice').trim() || 'invoice';
  return _txDocT(`documents.relation.${key}`);
}

function _txDocEnsureStyles(){
  if (document.getElementById('tb-tx-doc-style')) return;
  const st = document.createElement('style');
  st.id = 'tb-tx-doc-style';
  st.textContent = `
    .tb-tx-doc-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.58);z-index:10000;display:flex;align-items:center;justify-content:center;padding:18px;}
    .tb-tx-doc-modal{width:min(560px,96vw);max-height:92vh;overflow:auto;border-radius:22px;background:var(--card,#fff);box-shadow:0 24px 80px rgba(0,0,0,.35);padding:16px;color:inherit;}
    .dark .tb-tx-doc-modal{background:#15151d;color:#f8fafc;}
    .tb-tx-doc-modal h3{margin:0 0 12px;font-size:20px;}
    .tb-tx-doc-form{display:flex;flex-direction:column;gap:10px;border:1px dashed rgba(127,127,127,.28);border-radius:16px;padding:12px;background:rgba(127,127,127,.055);}
    .tb-tx-doc-list{margin-top:12px;display:flex;flex-direction:column;gap:8px;max-height:320px;overflow:auto;}
    .tb-tx-doc-row{font-size:12px;word-break:break-word;border:1px solid rgba(127,127,127,.18);border-radius:12px;padding:9px;background:rgba(127,127,127,.06);}
    .tb-tx-doc-empty{border:1px dashed rgba(127,127,127,.30);border-radius:14px;padding:18px;text-align:center;color:var(--muted,#6b7280);}
    .tb-tx-doc-msg{border:1px solid rgba(79,70,229,.22);background:rgba(79,70,229,.08);border-radius:14px;padding:9px 11px;margin-bottom:10px;font-size:13px;font-weight:700;}
    .tb-tx-doc-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:14px;flex-wrap:wrap;}
    .tb-tx-doc-hidden-input{display:none!important;}
  `;
  document.head.appendChild(st);
}

async function _txDocCurrentUserId(){
  try { if (window.sbUser && window.sbUser.id) return window.sbUser.id; } catch (_) {}
  const c = _txDocClient();
  if (c && c.auth && typeof c.auth.getUser === 'function') {
    const res = await c.auth.getUser();
    return res && res.data && res.data.user && res.data.user.id ? res.data.user.id : '';
  }
  return '';
}

function _txDocFindTx(txId){
  const id = String(txId || '');
  return (Array.isArray(state?.transactions) ? state.transactions : []).find((tx) => String(tx?.id || '') === id) || null;
}

async function _txDocEnsureInvoicesFolder(){
  const c = _txDocClient();
  if (!c) throw new Error(_txDocT('common.supabase_unavailable'));
  const uid = await _txDocCurrentUserId();
  if (!uid) throw new Error(_txDocT('transactions.documents.user_missing'));

  const folderTable = _txDocTable('document_folders', 'document_folders');
  const existing = await c
    .from(folderTable)
    .select('id,name,parent_id')
    .eq('user_id', uid)
    .is('parent_id', null)
    .ilike('name', TB_TX_DOC_FOLDER_NAME)
    .maybeSingle();

  if (existing.error && existing.error.code !== 'PGRST116') throw existing.error;
  if (existing.data && existing.data.id) return existing.data.id;

  const created = await c
    .from(folderTable)
    .insert({ user_id: uid, name: TB_TX_DOC_FOLDER_NAME, parent_id: null })
    .select('id')
    .single();

  if (created.error) throw created.error;
  return created.data.id;
}

async function _txDocFetchLinks(txId){
  const c = _txDocClient();
  if (!c) throw new Error(_txDocT('common.supabase_unavailable'));
  const linkTable = _txDocTable('transaction_documents', 'transaction_documents');
  const docTable = _txDocTable('documents', 'documents');

  const linksRes = await c
    .from(linkTable)
    .select('*')
    .eq('transaction_id', txId)
    .order('created_at', { ascending: false });

  if (linksRes.error) throw linksRes.error;
  const links = linksRes.data || [];
  const docIds = links.map((x) => x.document_id).filter(Boolean);
  if (!docIds.length) return [];

  const docsRes = await c
    .from(docTable)
    .select('*')
    .in('id', docIds);

  if (docsRes.error) throw docsRes.error;
  const docsById = new Map((docsRes.data || []).map((d) => [String(d.id), d]));

  return links.map((link) => ({ link, doc: docsById.get(String(link.document_id)) || null }));
}

async function _txDocFetchTripExpenseLinksForTx(txId){
  const c = _txDocClient();
  if (!c) throw new Error(_txDocT('common.supabase_unavailable'));

  const tx = _txDocFindTx(txId);
  const expenseId = String(tx?.tripExpenseId || tx?.trip_expense_id || '').trim();

  if (!expenseId) return [];

  const linkTable = _txDocTable('trip_expense_documents', 'trip_expense_documents');
  const docTable = _txDocTable('documents', 'documents');

  const linksRes = await c
    .from(linkTable)
    .select('*')
    .eq('expense_id', expenseId)
    .order('created_at', { ascending: false });

  if (linksRes.error) throw linksRes.error;

  const links = linksRes.data || [];
  const docIds = links.map((x) => x.document_id).filter(Boolean);

  if (!docIds.length) return [];

  const docsRes = await c
    .from(docTable)
    .select('*')
    .in('id', docIds);

  if (docsRes.error) throw docsRes.error;

  const docsById = new Map((docsRes.data || []).map((d) => [String(d.id), d]));

  return links.map((link) => ({
    link,
    doc: docsById.get(String(link.document_id)) || null,
    source: 'trip',
  }));
}

async function _txDocFetchCountsForTransactions(txIds){
  const ids = Array.from(new Set((txIds || []).map((id) => String(id || '').trim()).filter(Boolean)));
  const wanted = new Set(ids);
  const counts = new Map();
  ids.forEach((id) => counts.set(id, 0));
  if (!ids.length) return counts;

  const c = _txDocClient();
  if (!c) return counts;

  const directTable = _txDocTable('transaction_documents', 'transaction_documents');

  const directRes = await c
    .from(directTable)
    .select('transaction_id');

  if (directRes.error) throw directRes.error;

  for (const row of (directRes.data || [])) {
    const key = String(row?.transaction_id || '').trim();
    if (!key || !wanted.has(key)) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  const visibleTxs = (Array.isArray(state?.transactions) ? state.transactions : [])
    .filter(tx => wanted.has(String(tx?.id || '')));

  const txByExpense = new Map();

  for (const tx of visibleTxs) {
    const txId = String(tx?.id || '');
    const expenseId = String(tx?.tripExpenseId || tx?.trip_expense_id || '').trim();
    if (!txId || !expenseId) continue;
    if (!txByExpense.has(expenseId)) txByExpense.set(expenseId, []);
    txByExpense.get(expenseId).push(txId);
  }

  const expenseIds = Array.from(txByExpense.keys());

  if (expenseIds.length) {
    const tripTable = _txDocTable('trip_expense_documents', 'trip_expense_documents');

    const tripRes = await c
      .from(tripTable)
      .select('expense_id')
      .in('expense_id', expenseIds);

    if (tripRes.error) throw tripRes.error;

    for (const row of (tripRes.data || [])) {
      const expenseId = String(row?.expense_id || '').trim();
      const txIdsForExpense = txByExpense.get(expenseId) || [];

      for (const txId of txIdsForExpense) {
        counts.set(txId, (counts.get(txId) || 0) + 1);
      }
    }
  }

  return counts;
}

function _txDocCachedCount(txId){
  const id = String(txId || '').trim();
  if (!id) return { known: false, count: 0 };
  const map = TB_TX_DOC_COUNTS.map instanceof Map ? TB_TX_DOC_COUNTS.map : (TB_TX_DOC_COUNTS.map = new Map());
  return { known: map.has(id), count: Number(map.get(id) || 0) };
}

async function _txDocEnsureCachedCounts(txs, options = {}){
  const ids = Array.from(new Set((txs || []).map((tx) => String(tx?.id || '').trim()).filter(Boolean)));
  if (!ids.length) return;
  const map = TB_TX_DOC_COUNTS.map instanceof Map ? TB_TX_DOC_COUNTS.map : (TB_TX_DOC_COUNTS.map = new Map());
  const missing = ids.filter((id) => !map.has(id));
  if (!missing.length) return;
  if (TB_TX_DOC_COUNTS.loading) return;

  TB_TX_DOC_COUNTS.loading = true;
  try {
    const counts = await _txDocFetchCountsForTransactions(missing);
    missing.forEach((id) => map.set(id, counts.get(id) || 0));
    if (options.rerender && typeof renderTransactions === 'function') {
      renderTransactions();
    }
  } catch (e) {
    console.warn('[TB][tx-doc] count cache failed', e);
  } finally {
    TB_TX_DOC_COUNTS.loading = false;
  }
}

function _txDocApplyCountToButton(txId, count){
  const id = String(txId || '').trim();
  if (!id) return;
  const safeId = (window.CSS && typeof CSS.escape === 'function') ? CSS.escape(id) : id.replace(/"/g, '\\"');
  const btn = document.querySelector(`[data-tx-doc-btn="${safeId}"]`);
  if (!btn) return;
  const n = Number(count || 0);
  const base = _txDocT('transactions.action.invoice');
  const label = n > 0
    ? _txDocT('transactions.action.invoice_count', { count: n })
    : base;
  btn.innerHTML = `📎 ${_txDocEsc(label)}`;
  btn.title = n > 0
    ? _txDocT('transactions.documents.count_title', { count: n })
    : _txDocT('transactions.documents.empty');
  btn.classList.toggle('primary', n > 0);
}

async function _txDocRefreshVisibleCounts(txs){
  const ids = (txs || []).map((tx) => String(tx?.id || '').trim()).filter(Boolean);
  if (!ids.length) return;
  try {
    const counts = await _txDocFetchCountsForTransactions(ids);
    const map = TB_TX_DOC_COUNTS.map instanceof Map ? TB_TX_DOC_COUNTS.map : (TB_TX_DOC_COUNTS.map = new Map());
    ids.forEach((id) => {
      const count = counts.get(id) || 0;
      map.set(id, count);
      _txDocApplyCountToButton(id, count);
    });
  } catch (e) {
    console.warn('[TB][tx-doc] count refresh failed', e);
  }
}

async function _txDocCreateSignedUrl(doc){
  const c = _txDocClient();
  if (!c) throw new Error(_txDocT('common.supabase_unavailable'));
  const res = await c.storage.from(doc.storage_bucket || TB_TX_DOC_BUCKET).createSignedUrl(doc.storage_path, 60 * 10);
  if (res.error) throw res.error;
  return res.data && res.data.signedUrl;
}

async function _txDocUploadAndLink(txId, files){
  const list = Array.from(files || []);
  if (!list.length) return;
  const tx = _txDocFindTx(txId);
  if (!tx) throw new Error(_txDocT('transactions.error.not_found'));

  const c = _txDocClient();
  if (!c) throw new Error(_txDocT('common.supabase_unavailable'));
  const uid = await _txDocCurrentUserId();
  if (!uid) throw new Error(_txDocT('transactions.documents.user_missing'));

  const folderId = await _txDocEnsureInvoicesFolder();
  const docTable = _txDocTable('documents', 'documents');
  const linkTable = _txDocTable('transaction_documents', 'transaction_documents');

  for (const file of list) {
    const docId = (crypto && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const safe = _txDocCleanFilename(file.name || 'facture');
    const path = `${uid}/${docId}/${safe}`;
    const up = await c.storage.from(TB_TX_DOC_BUCKET).upload(path, file, { upsert: false, contentType: file.type || undefined });
    if (up.error) throw up.error;

    const baseName = String(file.name || _txDocT('documents.relation.invoice')).replace(/\.[a-z0-9]{1,8}$/i, '');
    const txLabel = String(tx.label || tx.category || '').trim();
    const docName = txLabel ? `${baseName || _txDocT('documents.relation.invoice')} — ${txLabel}` : (baseName || _txDocT('documents.relation.invoice'));

    const insDoc = await c.from(docTable).insert({
      id: docId,
      user_id: uid,
      folder_id: folderId,
      name: docName,
      original_filename: file.name || safe,
      storage_bucket: TB_TX_DOC_BUCKET,
      storage_path: path,
      mime_type: file.type || '',
      size_bytes: file.size || 0,
      tags: [_txDocT('documents.relation.invoice')]
    });
    if (insDoc.error) throw insDoc.error;

    const insLink = await c.from(linkTable).insert({
      user_id: uid,
      transaction_id: txId,
      document_id: docId,
      relation_type: window.TB_CONST?.DOCUMENTS?.RELATION_TYPES?.invoice || 'invoice'
    });
    if (insLink.error) throw insLink.error;
  }
}

async function _txDocUnlink(linkId){
  const c = _txDocClient();
  if (!c) throw new Error(_txDocT('common.supabase_unavailable'));
  const linkTable = _txDocTable('transaction_documents', 'transaction_documents');
  const { error } = await c.from(linkTable).delete().eq('id', linkId);
  if (error) throw error;
}

function _txDocRenderModal(txId, rows, message){
  _txDocEnsureStyles();
  const tx = _txDocFindTx(txId);
  const wrap = document.getElementById('tb-tx-doc-modal') || document.createElement('div');
  wrap.id = 'tb-tx-doc-modal';
  wrap.className = 'tb-tx-doc-backdrop';
  wrap.onclick = (e) => { if (e.target === wrap) wrap.remove(); };

  const title = tx
    ? `${tx.dateStart || ''} · ${tx.amount || ''} ${tx.currency || ''} · ${tx.label || tx.category || 'Transaction'}`
    : 'Transaction';

  wrap.innerHTML = `
    <div class="tb-tx-doc-modal" role="dialog" aria-modal="true">
      <h3>${_txDocEsc(_txDocT('transactions.documents.title'))}</h3>
      <p class="muted" style="font-size:13px;margin-top:-6px;">${_txDocEsc(title)}</p>
      ${message ? `<div class="tb-tx-doc-msg">${_txDocEsc(message)}</div>` : ''}
      <div class="tb-tx-doc-form">
        <strong>${_txDocEsc(_txDocT('transactions.documents.add'))}</strong>
        <input id="tb-tx-doc-file-input" class="tb-tx-doc-hidden-input" type="file" multiple accept="application/pdf,image/*" />
        <button class="btn primary" type="button" id="tb-tx-doc-upload-btn">${_txDocEsc(_txDocT('transactions.documents.upload'))}</button>
        <p class="muted" style="font-size:12px;margin:0;">${_txDocEsc(_txDocT('transactions.documents.upload_hint'))}</p>
      </div>
      <div class="tb-tx-doc-list">
        ${rows && rows.length ? rows.map(({ link, doc, source }) => `
          <div class="tb-tx-doc-row">
            <strong>${_txDocEsc(doc?.name || doc?.original_filename || 'Document')}</strong><br>
            <span class="muted">
  ${_txDocEsc(doc?.created_at ? new Date(doc.created_at).toLocaleDateString('fr-FR') : '')}
  · ${_txDocEsc(_txDocRelationLabel(link?.relation_type))}
  ${source === 'trip' ? ' · Source Trip' : ''}
</span>
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;">
              <button class="btn small primary" type="button" onclick="window.tbTxDocPreview('${_txDocEsc(doc?.id || '')}')">${_txDocEsc(_txDocT('transactions.documents.open'))}</button>
${source === 'trip'
  ? `<button class="btn small" type="button" onclick="window.tbOpenTripExpenseFromTransaction('${_txDocEsc(link?.expense_id || '')}')">Ouvrir Trip</button>`
  : `<button class="btn small" type="button" onclick="window.tbTxDocUnlink('${_txDocEsc(link?.id || '')}', '${_txDocEsc(txId)}')">${_txDocEsc(_txDocT('transactions.documents.unlink'))}</button>`
}
            </div>
          </div>
        `).join('') : `<div class="tb-tx-doc-empty">${_txDocEsc(_txDocT('transactions.documents.empty'))}</div>`}
      </div>
      <div class="tb-tx-doc-actions">
        <button class="btn" type="button" onclick="document.getElementById('tb-tx-doc-modal')?.remove()">${_txDocEsc(_txDocT('transactions.documents.close'))}</button>
      </div>
    </div>
  `;

  if (!wrap.parentNode) document.body.appendChild(wrap);

  const input = document.getElementById('tb-tx-doc-file-input');
  const uploadBtn = document.getElementById('tb-tx-doc-upload-btn');
  if (uploadBtn && input && !uploadBtn._tbBound) {
    uploadBtn._tbBound = true;
    uploadBtn.addEventListener('click', () => input.click());
  }
  if (input && !input._tbBound) {
    input._tbBound = true;
    input.addEventListener('change', async () => {
      const files = input.files;
      if (!files || !files.length) return;
      try {
        _txDocRenderModal(txId, rows || [], _txDocT('transactions.documents.uploading', { count: files.length }));
        await _txDocUploadAndLink(txId, files);
        try { TB_TX_DOC_COUNTS.map?.delete?.(String(txId)); } catch (_) {}
        await window.tbTxDocOpen(txId, _txDocT('transactions.documents.added'));
      } catch (e) {
        console.warn('[TB][tx-doc]', e);
        _txDocRenderModal(txId, rows || [], e?.message || String(e));
      }
    });
  }
}

window.tbTxDocOpen = async function tbTxDocOpen(txId, message){
  try {
    const directRows = await _txDocFetchLinks(txId);
const tripRows = await _txDocFetchTripExpenseLinksForTx(txId);
const rows = [
  ...directRows.map(row => ({ ...row, source: 'transaction' })),
  ...tripRows
];

window.__tbTxDocRows = rows;
_txDocApplyCountToButton(txId, rows.length);
_txDocRenderModal(txId, rows, message || '');
  } catch (e) {
    console.warn('[TB][tx-doc] open failed', e);
    _txDocRenderModal(txId, [], e?.message || String(e));
  }
};

window.tbTxDocPreview = async function tbTxDocPreview(docId){
  try {
    const rows = Array.isArray(window.__tbTxDocRows) ? window.__tbTxDocRows : [];
    const doc = rows.map((x) => x.doc).find((d) => String(d?.id || '') === String(docId || ''));
    if (!doc) throw new Error('Document introuvable.');
    const url = await _txDocCreateSignedUrl(doc);
    window.open(url, '_blank', 'noopener,noreferrer');
  } catch (e) {
    alert(e?.message || String(e));
  }
};

window.tbTxDocUnlink = async function tbTxDocUnlink(linkId, txId){
  if (!linkId) return;
  if (!confirm(_txDocT('transactions.documents.unlink_confirm'))) return;
  try {
    await _txDocUnlink(linkId);
    try { TB_TX_DOC_COUNTS.map?.delete?.(String(txId)); } catch (_) {}
    await window.tbTxDocOpen(txId, _txDocT('transactions.documents.unlinked'));
  } catch (e) {
    alert(e?.message || String(e));
  }
};

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
  const invoice = document.getElementById("f-invoice")?.value || "all";
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
    const hasInternalTransferId = !!(tx.internal_transfer_id || tx.internalTransferId);
const isBudgetOnlyInternalTransferFee =
  hasInternalTransferId &&
  tx.type === 'expense' &&
  tx.payNow === false &&
  tx.outOfBudget === false &&
  (tx.affectsBudget === true || tx.affects_budget === true);

if (isBudgetOnlyInternalTransferFee) return false;



    

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

  _txDocEnsureCachedCounts(txs, { rerender: invoice !== "all" });
  if (invoice !== "all") {
    txs = txs.filter((tx) => {
      const cached = _txDocCachedCount(tx?.id);
      if (!cached.known) return true; // Temporary pass while counts load; render refresh applies the filter.
      return invoice === "with" ? cached.count > 0 : cached.count <= 0;
    });
  }

  _txBulkPruneSelection(txs);

  const bulkCount = _txBulkVisibleSelectionCount();
  const bulkAllChecked = !!(txs.length && bulkCount === txs.length);
  const bulkCommonCategory = _txBulkSelectedCommonCategory();
  const bulkCategoryOptions = [`<option value="">${_txT("transactions.bulk.keep_category")}</option>`]
    .concat(getCategories().map((c) => `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`))
    .join('');
  const bulkSubcategoryOptions = _txBulkSubcategoryOptionsHtml(bulkCommonCategory, '');

  const bulkToolbarHtml = `
    <div class="card" style="margin-bottom:10px;padding:12px;display:grid;gap:10px;">
      <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
        <label style="display:flex;align-items:center;gap:8px;font-weight:600;">
          <input type="checkbox" ${bulkAllChecked ? 'checked' : ''} onchange="_txBulkToggleAll(this.checked)" />
          ${_txT("transactions.bulk.select_visible")}
        </label>
        <span class="muted">${_txT("transactions.bulk.selection")} : <strong id="tx-bulk-count">${bulkCount}</strong></span>
        <span class="muted">${_txT("transactions.bulk.common_category")} : <strong id="tx-bulk-common-category">${escapeHTML(bulkCommonCategory || _txT("transactions.bulk.mixed"))}</strong></span>
      </div>
      <div style="display:flex;gap:8px;align-items:end;flex-wrap:wrap;">
        <div class="field" style="min-width:220px;">
          <label>${_txT("transactions.bulk.new_category")}</label>
          <select id="tx-bulk-category" onchange="_txBulkSyncControls()">${bulkCategoryOptions}</select>
        </div>
        <div class="field" style="min-width:220px;">
          <label>${_txT("transactions.bulk.new_subcategory")}</label>
          <select id="tx-bulk-subcategory">${bulkSubcategoryOptions}</select>
        </div>
        <button class="btn primary" type="button" onclick="applyBulkTxClassification()" ${bulkCount ? '' : 'disabled'}>${_txT("transactions.bulk.apply")}</button>
        <button class="btn" type="button" onclick="openInternalTransferModal()">
          ↔ ${_txT("transactions.action.internal_transfer")}
        </button>
      </div>
      <div class="muted" style="font-size:12px;">
        ${_txT("transactions.bulk.hint")}
      </div>
      <div id="tx-bulk-message" role="status" style="display:none;border:1px solid rgba(245,158,11,.38);background:rgba(245,158,11,.12);border-radius:8px;padding:8px 10px;font-size:13px;font-weight:700;"></div>
    </div>`;

  if (!txs.length) {
    const w0 = state.wallets?.[0]?.id || null;
    list.innerHTML = bulkToolbarHtml + `
      <div class="muted" style="margin-bottom:10px;">${_txT("transactions.empty.filtered")}</div>
      ${w0 ? `
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <button class="btn primary" onclick="openTxModal('expense','${w0}')">${_txT("transactions.action.add_expense")}</button>
          <button class="btn" onclick="openTxModal('income','${w0}')">${_txT("transactions.action.add_income")}</button>
          <button class="btn" onclick="openInternalTransferModal()">
           ↔ ${_txT("transactions.action.internal_transfer")}
          </button>
        </div>
      ` : ""}
    `;
  } else {
    list.innerHTML = bulkToolbarHtml;
  }

  for (const tx of txs) {
    const internalTransferId =
  tx.internal_transfer_id
  || tx.internalTransferId
  || '';
    const isInternalTransfer = !!internalTransferId;
    const w = findWallet(tx.walletId);
    const recurringTags = [];
    if (tx.generatedByRule || tx.recurringRuleId) recurringTags.push(_txT("transactions.tag.recurring"));

    const st = String(tx.recurringInstanceStatus || "").toLowerCase();
    if (st === "generated") recurringTags.push(_txT("transactions.tag.generated"));
    if (st === "confirmed") recurringTags.push(_txT("transactions.tag.confirmed"));
    if (st === "detached") recurringTags.push(_txT("transactions.tag.detached"));
    if (st === "skipped") recurringTags.push(_txT("transactions.tag.skipped"));

    const tags = [
      tx.type === "expense" ? (tx.payNow ? _txT("transactions.tag.paid") : _txT("transactions.tag.unpaid")) : _txT("transactions.tag.income"),
      tx.outOfBudget ? _txT("transactions.tag.out_budget") : null,
      isInternalTransfer ? '↔ Mouvement interne' : null,
     tx.nightCovered ? _txT("transactions.tag.night") : null,
     tx.tripExpenseId || tx.trip_expense_id ? _txT("transactions.tag.trip_linked") : null,
     tx.tripShareLinkId || tx.trip_share_link_id ? _txT("transactions.tag.trip_share") : null,
     ...recurringTags,
    ].filter(Boolean);

    const div = document.createElement("div");
    div.className = "tx";
    div.setAttribute("data-tx-id", String(tx.id || ""));
    const txChecked = TB_TX_BULK.selectedIds.has(String(tx.id));
    const linkedExpenseId = String(tx.tripExpenseId || tx.trip_expense_id || "");
    const linkedTripShareId = String(tx.tripShareLinkId || tx.trip_share_link_id || "");
    const insightDisplayCurrency = String(state?.user?.baseCurrency || state?.user?.base_currency || state?.period?.baseCurrency || tx.currency || "EUR").toUpperCase();
    const nightInsight = (tx.nightCovered && typeof window.tbGetNightCoveredInsightForTx === "function")
      ? window.tbGetNightCoveredInsightForTx(tx, insightDisplayCurrency)
      : null;
    const transferFeeTx = isInternalTransfer
  ? (state.transactions || []).find((candidate) =>
      String(candidate.internalTransferId || candidate.internal_transfer_id || '') === String(internalTransferId)
      && candidate.type === 'expense'
      && candidate.payNow === false
      && candidate.outOfBudget === false
      && (candidate.affectsBudget === true || candidate.affects_budget === true)
    )
  : null;
    div.innerHTML = `
      <div style="display:flex;align-items:flex-start;gap:10px;">
        <input type="checkbox" style="margin-top:4px;" ${txChecked ? 'checked' : ''} onchange="_txBulkToggleOne('${escapeHTML(String(tx.id))}', this.checked)" />
        <div style="flex:1;">
        <div><strong>${tx.type === "expense" ? _txT("transactions.type.expense") : _txT("transactions.type.income")}</strong> — ${tx.amount} ${tx.currency}</div>
        <div class="meta">
          ${tx.dateStart}${tx.dateEnd && tx.dateEnd !== tx.dateStart ? " → " + tx.dateEnd : ""}
          • ${w ? w.name : "Wallet"} • ${_txCatBadge(tx.category)} ${
  isInternalTransfer
    ? ` • ↔ ${escapeHTML(tx.label || "Mouvement interne")}`
    : (tx.label ? " • " + escapeHTML(tx.label) : "")
}
        </div>
        <div class="tags">${tags.map((t) => `<span class="tag">${t}</span>`).join("")}</div>
        ${nightInsight ? `<div class="muted" style="margin-top:6px;font-size:12px;line-height:1.45;">${escapeHTML(_txT("transactions.night_insight", { amount: _fmtMoney(nightInsight.amount, nightInsight.currency) }))}</div>` : ``}
        ${transferFeeTx ? `
  <div class="muted" style="margin-top:6px;font-size:12px;line-height:1.45;">
    Frais estimés inclus budget : ${escapeHTML(_fmtMoney(transferFeeTx.amount, transferFeeTx.currency))}
  </div>
` : ``}
        </div>
      </div>

      <div style="display:flex; gap:8px; align-items:center;">
        ${linkedExpenseId
          ? `<button class="btn small" type="button" onclick="tbOpenTripExpenseFromTransaction('${escapeHTML(linkedExpenseId)}')">${escapeHTML(_txT("transactions.action.open_trip"))}</button>`
          : linkedTripShareId
            ? `<button class="btn small" type="button" onclick="showView('trip')">${escapeHTML(_txT("transactions.action.open_trip"))}</button>`
          : ""
        }
        ${(!tx.payNow && (tx.type === "expense" || tx.type === "income"))
          ? `<button class="btn small primary" onclick="markTxAsPaid(\'${tx.id}\')">✓ ${tx.type === "income" ? _txT("transactions.action.received") : _txT("transactions.action.pay")}</button>`
          : ""
        }
        <button class="btn small" type="button" data-tx-doc-btn="${escapeHTML(String(tx.id))}" onclick="window.tbTxDocOpen('${escapeHTML(String(tx.id))}')">📎 ${escapeHTML(_txT("transactions.action.invoice"))}</button>
        <button class="btn small" onclick="openTxEditModal('${tx.id}')">✏️</button>
        ${
  isInternalTransfer
    ? `<button class="btn small danger" onclick="deleteInternalTransfer('${escapeHTML(String(internalTransferId))}')">🗑️</button>`
    : `<button class="btn small danger" onclick="deleteTx('${tx.id}')">🗑️</button>`
}
      </div>
    `;
    list.appendChild(div);
  }

  _txDocRefreshVisibleCounts(txs);

  try {
    const focusId = String(window.__tbFocusTransactionId || "");
    if (focusId) {
      const safeId = (window.CSS && typeof CSS.escape === "function") ? CSS.escape(focusId) : focusId.replace(/"/g, '\\"');
      const target = list.querySelector(`[data-tx-id="${safeId}"]`);
      if (target) {
        window.__tbFocusTransactionId = "";
        target.scrollIntoView({ behavior: "smooth", block: "center" });
        target.style.boxShadow = "0 0 0 3px rgba(124,58,237,.35)";
        setTimeout(() => { try { target.style.boxShadow = ""; } catch (_) {} }, 2200);
      }
    }
  } catch (_) {}

  const ids = ["f-from", "f-to", "f-wallet", "f-category", "f-subcategory", "f-type", "f-pay", "f-out", "f-night", "f-recurring", "f-invoice", "f-q"];
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
window.openInternalTransferModal = function openInternalTransferModal() {
  if (typeof window.tbOpenInternalTransferModal === 'function') {
    return window.tbOpenInternalTransferModal();
  }

  alert('Internal transfer modal not loaded.');
};