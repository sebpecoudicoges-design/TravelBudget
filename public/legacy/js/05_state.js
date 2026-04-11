/* =========================
   State
   ========================= */
function tbMakeInitialState() {
  return {
    exchangeRates: { "EUR-BASE": 35, "BASE-EUR": 1 / 35 },
    period: { id: null, start: "2026-02-10", end: "2026-02-28", baseCurrency: "THB", eurBaseRate: 35, dailyBudgetBase: 1000 },
    // User/account-level preferences loaded from `settings`
    user: {
      baseCurrency: "EUR",
      uiMode: "advanced",
    },
    // FX state (manual rates are a DB-backed fallback; auto rates are in localStorage)
    fx: {
      manualRates: {}, // { CUR: { rate:number, asOf:"YYYY-MM-DD" } }
    },
    wallets: [],
    walletBalances: [],
    walletBalanceMap: {},
    transactions: [],
    allocations: [],
    travels: [],          // V9
    activeTravelId: null, // V9
    recurringRules: [],   // V9
    periods: [],
    budgetSegments: [],
    categories: [],
    categoryColors: {},
    categorySubcategories: [],
    analyticCategoryMappings: [],
    hiddenCategories: [],
    analysisMappingAvailable: false,
    analysisAuditAvailable: false,
    analysisMappingRulesAvailable: false,
    analysisAuditRows: [],
    analysisMappingByTxId: {},
    categoriesRows: [],
  };
}

let state = tbMakeInitialState();
// ---- expose for plugins (do not remove) ----
Object.defineProperty(window, "state", { get: () => state, set: (v) => { state = v; } });

function tbResetClientSessionState(reason) {
  try {
    const hidden = Array.isArray(state?.hiddenCategories) ? state.hiddenCategories.slice() : [];
    state = tbMakeInitialState();
    state.hiddenCategories = hidden;
    window.__TB_REFRESH_TOKEN__ = (Number(window.__TB_REFRESH_TOKEN__ || 0) + 1);
    window.__TB_LAST_SESSION_RESET__ = { reason: String(reason || ''), at: Date.now() };
    if (window.__TB_STATE) window.__TB_STATE = {};
    if (window.__ANALYTIC_CACHE) window.__ANALYTIC_CACHE = {};
    try {
      if (window.tbBus && typeof window.tbBus.emit === 'function') {
        window.tbBus.emit('state:reset', { reason: String(reason || '') });
      }
    } catch (_) {}
  } catch (e) {
    console.warn('[TB] tbResetClientSessionState failed', e?.message || e);
  }
}

window.tbMakeInitialState = tbMakeInitialState;
window.tbResetClientSessionState = tbResetClientSessionState;

function tbNormalizeUiMode(v) {
  const raw = String(v || '').trim().toLowerCase();
  return raw === 'simple' ? 'simple' : 'advanced';
}

function tbGetUiMode() {
  try {
    const stateMode = tbNormalizeUiMode(window?.state?.user?.uiMode || state?.user?.uiMode || '');
    if (stateMode) return stateMode;
  } catch (_) {}
  try {
    const key = window.TB_CONST?.LS_KEYS?.ui_mode || 'travelbudget_ui_mode_v1';
    const lsMode = tbNormalizeUiMode(localStorage.getItem(key) || '');
    if (lsMode) return lsMode;
  } catch (_) {}
  return 'advanced';
}

function tbIsSimpleMode() { return tbGetUiMode() === 'simple'; }
function tbIsAdvancedMode() { return tbGetUiMode() === 'advanced'; }

function tbApplyUiModeToDocument() {
  try {
    const mode = tbGetUiMode();
    document.body.classList.toggle('tb-ui-mode-simple', mode === 'simple');
    document.body.classList.toggle('tb-ui-mode-advanced', mode !== 'simple');
    document.body.setAttribute('data-ui-mode', mode);
  } catch (_) {}
}

window.tbNormalizeUiMode = tbNormalizeUiMode;
window.tbGetUiMode = tbGetUiMode;
window.tbIsSimpleMode = tbIsSimpleMode;
window.tbIsAdvancedMode = tbIsAdvancedMode;
window.tbApplyUiModeToDocument = tbApplyUiModeToDocument;

const CATEGORY_DISPLAY_ORDER = [
  "Repas",
  "Logement",
  "Transport",
  "Transport Internationale",
  "Visa",
  "Sorties",
  "Santé",
  "Abonnement/Mobile",
  "Frais bancaire",
  "Laundry",
  "Course",
  "Projet Personnel",
  "Cadeau",
  "Souvenir",
  "Caution",
  "Revenu",
  "Autre",
  "Mouvement interne",
];

const DEFAULT_CATEGORIES = []; // V9.3.11.1: categories are SQL/user-scoped; no cross-account front defaults

const DEFAULT_SUBCATEGORY_MAP = {
  "Repas": ["Petit-déjeuner", "Déjeuner", "Dîner", "Snack", "Café", "Eau"],
  "Logement": ["Auberge", "Hôtel", "Guesthouse", "Airbnb", "Camping", "Loyer"],
  "Transport": ["Bus local", "Train local", "Métro", "Taxi / VTC", "Scooter", "Essence", "Ferry local", "Location vélo", "Parking", "Péage"],
  "Transport Internationale": ["Vol", "Bus international", "Train international", "Ferry international", "Frontière / passage", "Visa-run déplacement"],
  "Visa": ["e-Visa", "Visa à l’arrivée", "Extension visa", "Frais consulaires", "Photos / documents visa"],
  "Sorties": ["Culturel", "Sportive", "Verre", "Fête", "Café sortie", "Événement", "Cinéma", "Musée"],
  "Santé": ["Pharmacie", "Consultation", "Assurance santé", "Soins", "Hygiène"],
  "Abonnement/Mobile": ["Forfait mobile", "SIM", "Recharge data", "Abonnement app"],
  "Frais bancaire": ["Frais carte", "Retrait ATM", "Commission change", "Tenue de compte"],
  "Course": ["Supermarché", "Marché", "Eau", "Snacks", "Produits maison"],
  "Projet Personnel": ["Matériel", "Formation", "Logiciel", "Démarches"],
  "Cadeau": ["Famille", "Amis", "Hôte"],
  "Souvenir": ["Artisanat", "Vêtement", "Carte postale"],
  "Caution": ["Logement", "Location véhicule", "Autre caution"],
  "Revenu": ["Salaire", "Remboursement", "Vente", "Prime", "Autre revenu"],
  "Autre": ["Divers"],
  "Mouvement interne": ["Virement", "Transfert cash", "Change devise"],
};

function getCategories() {
  const raw = Array.isArray(state.categories) ? state.categories : [];
  const hidden = new Set(getHiddenCategories().map((x) => x.toLowerCase()));
  const merged = raw.filter((name) => !hidden.has(String(name || '').trim().toLowerCase()));

  // de-dupe (case-insensitive) while preserving first appearance
  const seen = new Set();
  const out = [];
  for (const c of merged) {
    const name = String(c || "").trim();
    if (!name) continue;
    const k = name.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(name);
  }

  const orderMap = Object.fromEntries(CATEGORY_DISPLAY_ORDER.map((name, idx) => [String(name).toLowerCase(), idx]));
  return out.slice().sort((a, b) => {
    const aKey = String(a || '').toLowerCase();
    const bKey = String(b || '').toLowerCase();
    const aIdx = Object.prototype.hasOwnProperty.call(orderMap, aKey) ? orderMap[aKey] : 999;
    const bIdx = Object.prototype.hasOwnProperty.call(orderMap, bKey) ? orderMap[bKey] : 999;
    return (aIdx - bIdx) || String(a).localeCompare(String(b), 'fr', { sensitivity: 'base' });
  });
}

function getHiddenCategories() {
  const arr = Array.isArray(state?.hiddenCategories) ? state.hiddenCategories : [];
  return arr.map((x) => String(x || '').trim()).filter(Boolean);
}

function isCategoryHidden(categoryName) {
  const n = String(categoryName || '').trim().toLowerCase();
  if (!n) return false;
  return getHiddenCategories().some((x) => x.toLowerCase() === n);
}

function setCategoryHidden(categoryName, hidden) {
  const n = String(categoryName || '').trim();
  if (!n) return;
  const current = getHiddenCategories();
  const filtered = current.filter((x) => x.toLowerCase() !== n.toLowerCase());
  state.hiddenCategories = hidden ? [...filtered, n] : filtered;
  try { localStorage.setItem(TB_HIDDEN_CATEGORIES_LS_KEY, JSON.stringify(state.hiddenCategories || [])); } catch (_) {}
}

function loadHiddenCategoriesFromLocalStorage() {
  try {
    const raw = localStorage.getItem(TB_HIDDEN_CATEGORIES_LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((x) => String(x || '').trim()).filter(Boolean) : [];
  } catch (_) {}
  return [];
}

const DEFAULT_CATEGORY_COLORS = {
  Repas: "#2f80ed",
  Logement: "#22c55e",
  Transport: "#f59e0b",
  Sorties: "#a855f7",
  Caution: "#06b6d4",
  Autre: "#94a3b8",
};

function getCategoryColors() {
  // Returns a merged map:
  // - defaults provide a baseline palette
  // - state.categoryColors overrides (if present)
  const m = (state && state.categoryColors && typeof state.categoryColors === "object") ? state.categoryColors : null;

  // If m is null OR an empty object, fallback to defaults
  const hasAny = m && Object.keys(m).length > 0;

  // Merge with case-insensitive override:
  // If state has {"caution":"#..."} it should override DEFAULT "Caution".
  const out = { ...DEFAULT_CATEGORY_COLORS };
  if (hasAny) {
    const keyMap = {};
    for (const k of Object.keys(out)) keyMap[k.toLowerCase()] = k;
    for (const [k, v] of Object.entries(m)) {
      const kk = String(k || "").trim();
      const vv = String(v || "").trim();
      if (!kk || !vv) continue;
      const canon = keyMap[kk.toLowerCase()] || kk;
      out[canon] = vv;
    }
  }
  return out;
}
function colorForCategory(cat) {
  const key = (cat || "").trim();
  const COLORS = getCategoryColors();
  return COLORS[key] || COLORS.Autre || "#94a3b8";
}

function getCategorySubcategories(categoryName, opts) {
  const name = String(categoryName || "").trim();
  if (!name) return [];
  const activeOnly = opts?.activeOnly !== false;
  const rows = Array.isArray(state?.categorySubcategories) ? state.categorySubcategories : [];
  const out = [];
  const seen = new Set();
  const push = (row) => {
    const subName = String(row?.name || row?.subcategory || "").trim();
    if (!subName) return;
    const key = subName.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push({
      id: row?.id || null,
      categoryName: name,
      name: subName,
      color: row?.color || null,
      sortOrder: Number(row?.sortOrder ?? row?.sort_order ?? 9999),
      isActive: row?.isActive !== false && row?.is_active !== false,
      source: row?.source || 'state'
    });
  };

  rows
    .filter((row) => {
      const rowCat = String(row?.categoryName || row?.category_name || "").trim();
      if (!rowCat) return false;
      if (rowCat.toLowerCase() !== name.toLowerCase()) return false;
      if (!activeOnly) return true;
      return row?.isActive !== false && row?.is_active !== false;
    })
    .slice()
    .sort((a, b) => {
      const aSort = Number(a?.sortOrder ?? a?.sort_order ?? 0);
      const bSort = Number(b?.sortOrder ?? b?.sort_order ?? 0);
      return (aSort - bSort) || String(a?.name || "").localeCompare(String(b?.name || ""), 'fr', { sensitivity: 'base' });
    })
    .forEach(push);

  const fallbackSources = [];
  if (Array.isArray(state?.transactions)) fallbackSources.push(...state.transactions);
  if (Array.isArray(state?.recurringRules)) fallbackSources.push(...state.recurringRules);
  fallbackSources.forEach((row) => {
    const rowCat = String(row?.category || "").trim();
    const sub = String(row?.subcategory || "").trim();
    if (!sub) return;
    if (rowCat.toLowerCase() !== name.toLowerCase()) return;
    push({
      id: null,
      categoryName: name,
      name: sub,
      color: null,
      sortOrder: 9998,
      isActive: true,
      source: 'fallback'
    });
  });

  const defaults = DEFAULT_SUBCATEGORY_MAP[name] || DEFAULT_SUBCATEGORY_MAP[Object.keys(DEFAULT_SUBCATEGORY_MAP).find((k) => k.toLowerCase() === name.toLowerCase())] || [];
  defaults.forEach((sub, idx) => {
    push({
      id: null,
      categoryName: name,
      name: sub,
      color: null,
      sortOrder: idx,
      isActive: true,
      source: 'default'
    });
  });

  return out.slice().sort((a, b) => {
    const aSort = Number(a?.sortOrder ?? 9999);
    const bSort = Number(b?.sortOrder ?? 9999);
    return (aSort - bSort) || String(a?.name || '').localeCompare(String(b?.name || ''), 'fr', { sensitivity: 'base' });
  });
}
window.getCategorySubcategories = getCategorySubcategories;


const TB_CATEGORIES_LS_KEY = "travelbudget_categories_v1";
const TB_CATEGORY_COLORS_LS_KEY = "travelbudget_category_colors_v1";
const TB_HIDDEN_CATEGORIES_LS_KEY = "travelbudget_hidden_categories_v1";
// legacy keys (<= v6.3) and fallbacks we may encounter
const TB_CATEGORIES_LS_KEYS_FALLBACK = [
  "travelbudget_categories_v2",
  "travelbudget_categories_v1",
  "travelbudget_categories",
  "tb_categories",
  "categories",
];
const TB_CATEGORY_COLORS_LS_KEYS_FALLBACK = [
  "travelbudget_category_colors_v2",
  "travelbudget_category_colors_v1",
  "travelbudget_category_colors",
  "tb_category_colors",
  "category_colors",
];


function _tryLoadFromStateBlob() {
  // Some versions stored categories/colors inside a full state blob.
  const keys = ["travelbudget_state_v1", "travelbudget_state_v2", "travelbudget_state", "tb_state"];
  for (const k of keys) {
    const raw = localStorage.getItem(k);
    if (!raw) continue;
    try {
      const obj = JSON.parse(raw);
      if (obj && typeof obj === "object") return obj;
    } catch (_) {}
  }
  return null;
}

function loadCategoriesFromLocalStorage() {
  // V9.3.11.1: categories are no longer restored from generic localStorage keys.
  // This avoids cross-account leakage on the same browser profile.
  return null;
}

function loadCategoryColorsFromLocalStorage() {
  // V9.3.11.1: category colors are user-scoped in SQL; no generic local fallback.
  return null;
}

function _unusedLegacyLoadCategoryColorsFromLocalStorageBackup() {
  try {
    let raw = null;
    for (const k of TB_CATEGORY_COLORS_LS_KEYS_FALLBACK) {
      raw = localStorage.getItem(k);
      if (raw) break;
    }
    if (!raw) {
      for (let i = 0; i < (localStorage?.length || 0); i++) {
        const k = localStorage.key(i);
        if (!k) continue;
        if (!/categor|color/i.test(k)) continue;
        const v = localStorage.getItem(k);
        if (!v) continue;
        let maybe = null;
        try { maybe = JSON.parse(v); } catch (_) { maybe = null; }
        if (maybe && typeof maybe === 'object' && !Array.isArray(maybe) && Object.keys(maybe).length) {
          raw = v; break;
        }
      }
    }
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (obj && typeof obj === "object") return obj;
  } catch (_) {}
  return null;
}

function persistCategoriesToLocalStorage() {
  // V9.3.11.1: do not persist categories/colors globally in localStorage.
  try { localStorage.setItem(TB_HIDDEN_CATEGORIES_LS_KEY, JSON.stringify(state.hiddenCategories || [])); } catch (_) {}
}

window.persistCategoriesToLocalStorage = persistCategoriesToLocalStorage;
window.isCategoryHidden = isCategoryHidden;
window.setCategoryHidden = setCategoryHidden;


/* =========================
   State integrity (V4.1)
   - normalizes shapes after DB refresh / import
   - prevents undefined/null surprises across modules
   ========================= */
function ensureStateIntegrity() {
  if (!state || typeof state !== "object") state = {};
  // required containers
  state.exchangeRates = (state.exchangeRates && typeof state.exchangeRates === "object") ? state.exchangeRates : { "EUR-BASE": 35, "BASE-EUR": 1 / 35 };
  state.period = (state.period && typeof state.period === "object") ? state.period : {};
  state.wallets = Array.isArray(state.wallets) ? state.wallets : [];
  state.transactions = Array.isArray(state.transactions) ? state.transactions : [];
  state.allocations = Array.isArray(state.allocations) ? state.allocations : [];
  state.periods = Array.isArray(state.periods) ? state.periods : [];
  state.budgetSegments = Array.isArray(state.budgetSegments) ? state.budgetSegments : [];
  state.categories = Array.isArray(state.categories) ? state.categories : [];
  state.categorySubcategories = Array.isArray(state.categorySubcategories) ? state.categorySubcategories : [];
  state.hiddenCategories = Array.isArray(state.hiddenCategories) ? state.hiddenCategories : [];
  if (state.hiddenCategories.length === 0) {
    const lsHidden = loadHiddenCategoriesFromLocalStorage();
    if (Array.isArray(lsHidden) && lsHidden.length) state.hiddenCategories = lsHidden;
  }
  state.categoryColors = (state.categoryColors && typeof state.categoryColors === "object") ? state.categoryColors : {};

  // After best-effort load/migration, persist into canonical keys so the UI is stable across versions.
  if (typeof persistCategoriesToLocalStorage === 'function') {
    try { persistCategoriesToLocalStorage(); } catch (_) {}
  }

  // period defaults
  const today = toLocalISODate(new Date());
  if (!state.period.start) state.period.start = today;
  if (!state.period.end) state.period.end = today;
  if (!state.period.baseCurrency) state.period.baseCurrency = "THB";
  state.period.eurBaseRate = _safeNumber(state.period.eurBaseRate, _safeNumber(state.exchangeRates["EUR-BASE"], 35));
  state.period.dailyBudgetBase = _safeNumber(state.period.dailyBudgetBase, 1000);

  // budget segments defaults (V6.4)
  // If no segments exist, we synthesize a single segment aligned with the period settings.
  if (!Array.isArray(state.budgetSegments)) state.budgetSegments = [];
  if (state.budgetSegments.length === 0) {
    state.budgetSegments = [{
      id: null,
      periodId: state.period.id || null,
      start: state.period.start,
      end: state.period.end,
      baseCurrency: state.period.baseCurrency,
      dailyBudgetBase: state.period.dailyBudgetBase,
      transportNightBudget: 400,
      transport_night_budget: 400,
      fxMode: "fixed",
      eurBaseRateFixed: state.period.eurBaseRate,
      sortOrder: 0,
    }];
  }

  // Normalize segments shape
  state.budgetSegments = state.budgetSegments
    .filter(Boolean)
    .map((seg, idx) => ({
      id: seg.id ?? null,
      periodId: seg.periodId ?? seg.period_id ?? state.period.id ?? null,
      travelId: seg.travelId ?? seg.travel_id ?? null,
      start: (seg.start ?? seg.start_date ?? state.period.start),
      end: (seg.end ?? seg.end_date ?? state.period.end),
      baseCurrency: String(seg.baseCurrency ?? seg.base_currency ?? state.period.baseCurrency ?? "EUR").toUpperCase(),
      dailyBudgetBase: _safeNumber(seg.dailyBudgetBase ?? seg.daily_budget_base, state.period.dailyBudgetBase),
      transportNightBudget: _safeNumber(seg.transportNightBudget ?? seg.transport_night_budget ?? seg.night_transport_budget, 400),
      transport_night_budget: _safeNumber(seg.transportNightBudget ?? seg.transport_night_budget ?? seg.night_transport_budget, 400),
      fxMode: String(seg.fxMode ?? seg.fx_mode ?? "fixed"),
      eurBaseRateFixed: _safeNumber(seg.eurBaseRateFixed ?? seg.eur_base_rate_fixed, null),
      sortOrder: _safeNumber(seg.sortOrder ?? seg.sort_order, idx),
    }))
    .sort((a, b) => (a.sortOrder - b.sortOrder) || String(a.start).localeCompare(String(b.start)));

  // keep legacy exchangeRates aligned
  const eurBase = _safeNumber(state.exchangeRates["EUR-BASE"], state.period.eurBaseRate || 35);
  state.exchangeRates["EUR-BASE"] = eurBase;
  state.exchangeRates["BASE-EUR"] = eurBase ? (1 / eurBase) : (1 / 35);

  // normalize wallet balances
  state.wallets.forEach(w => {
    if (!w) return;
    w.balance = _safeNumber(w.balance, 0);
    if (!w.currency) w.currency = state.period.baseCurrency;
  });

  // normalize transactions amounts
  state.transactions.forEach(t => {
    if (!t) return;
    t.amount = _safeNumber(t.amount, 0);
    if (!t.currency) t.currency = state.period.baseCurrency;
    if (t.date && typeof t.date === "string") t.date = t.date.slice(0,10);
    t.subcategory = (t.subcategory === undefined) ? null : (t.subcategory || null);
  });

  state.recurringRules = Array.isArray(state.recurringRules) ? state.recurringRules : [];
  state.recurringRules.forEach(r => {
    if (!r) return;
    r.subcategory = (r.subcategory === undefined) ? null : (r.subcategory || null);
  });

  state.categorySubcategories = state.categorySubcategories
    .filter(Boolean)
    .map((row, idx) => ({
      id: row.id ?? null,
      categoryId: row.categoryId ?? row.category_id ?? null,
      categoryName: String(row.categoryName ?? row.category_name ?? "").trim(),
      name: String(row.name ?? "").trim(),
      color: row.color || null,
      sortOrder: _safeNumber(row.sortOrder ?? row.sort_order, idx),
      isActive: row.isActive !== false && row.is_active !== false,
      createdAt: row.createdAt ?? row.created_at ?? null,
      updatedAt: row.updatedAt ?? row.updated_at ?? null,
    }))
    .filter((row) => row.categoryName && row.name)
    .sort((a, b) => (a.sortOrder - b.sortOrder) || a.categoryName.localeCompare(b.categoryName, 'fr', { sensitivity: 'base' }) || a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));

  return state;
}
window.ensureStateIntegrity = ensureStateIntegrity;

function findWallet(id) {
  return state.wallets.find((w) => w.id === id) || null;
}

function amountToBase(amount, currency) {
  const base = String(state?.period?.baseCurrency || "EUR").toUpperCase();
  const cur = String(currency || base).toUpperCase();
  const amt = Number(amount) || 0;

  if (cur === base) return amt;

  // Prefer the cross-rate FX engine (supports any currency pair via EUR pivot)
  if (typeof window.fxConvert === "function") {
    const rates = (typeof window.fxGetEurRates === "function") ? window.fxGetEurRates() : {};
    const out = window.fxConvert(amt, cur, base, rates);
    if (out !== null && isFinite(out)) return out;
  }

  // Legacy fallback (only EUR <-> base)
  if (cur === "EUR") return amt * (Number(state.exchangeRates["EUR-BASE"]) || 35);
  return amt;
}
function amountToEUR(amount, currency) {
  const cur = String(currency || "EUR").toUpperCase();
  const amt = Number(amount) || 0;
  if (cur === "EUR") return amt;

  // Prefer the cross-rate FX engine (supports any currency -> EUR)
  if (typeof window.fxConvert === "function") {
    const rates = (typeof window.fxGetEurRates === "function") ? window.fxGetEurRates() : {};
    const out = window.fxConvert(amt, cur, "EUR", rates);
    if (out !== null && isFinite(out)) return out;
  }

  // Legacy fallback (only base -> EUR)
  const base = String(state?.period?.baseCurrency || "EUR").toUpperCase();
  if (cur === base) return amt * (Number(state.exchangeRates["BASE-EUR"]) || (1 / 35));
  return amt;
}

function periodContains(dateStr) {
  const d = parseISODateOrNull(dateStr);
  const s = parseISODateOrNull(state.period.start);
  const e = parseISODateOrNull(state.period.end);
  if (!d || !s || !e) return false;
  return d >= s && d <= e;
}

function getBudgetSegmentForDate(dateStr) {
  const ds = String(dateStr || "");
  if (!ds) return null;
  const segs = Array.isArray(state.budgetSegments) ? state.budgetSegments : [];
  const activePeriodId = state && state.period && state.period.id ? String(state.period.id) : "";

  // Pass 1: prefer segments explicitly linked to the active period
  if (activePeriodId) {
    for (const seg of segs) {
      if (!seg) continue;
      const pid = seg.periodId != null ? String(seg.periodId) : "";
      if (pid && pid !== activePeriodId) continue;
      const s = String(seg.start || "");
      const e = String(seg.end || "");
      if (s && e && ds >= s && ds <= e) return seg;
    }
  }

  // Pass 2: legacy fallback (segments without periodId)
  for (const seg of segs) {
    if (!seg) continue;
    const pid = seg.periodId != null ? String(seg.periodId) : "";
    if (activePeriodId && pid && pid !== activePeriodId) continue;
    const s = String(seg.start || "");
    const e = String(seg.end || "");
    if (s && e && ds >= s && ds <= e) return seg;
  }
  return null;
}
/* =========================
   Display currency (V6.4)
   - By design we can choose a "display currency" for the dashboard.
   - Current rule: always use the segment currency of the displayed day (defaults to today).
   ========================= */

function getDisplayDateISO() {
  // If you later add a UI-selected date, set state.uiDateISO and it will be used automatically.
  const ui = state && state.uiDateISO ? String(state.uiDateISO).slice(0, 10) : "";
  if (ui && /^\d{4}-\d{2}-\d{2}$/.test(ui)) return ui;
  return toLocalISODate(new Date());
}

function getDisplaySegment(_dateStr) {
  // Display currency is ALWAYS the segment of the current display date (UI date / today),
  // not the segment of the queried date. This avoids mixing currencies across widgets.
  const disp = getDisplayDateISO();
  return getBudgetSegmentForDate(disp)
    || { baseCurrency: state.period.baseCurrency, fxMode: "fixed", eurBaseRateFixed: state.period.eurBaseRate };
}


function getDisplayCurrency(dateStr) {
  const seg = getDisplaySegment(dateStr);
  return String(seg?.baseCurrency || state.period.baseCurrency || "EUR").toUpperCase();
}

// Merge FX overrides from two segments (e.g. day segment + display segment)
function fxRatesForSegments(segA, segB) {
  const baseRates = (typeof window.fxGetEurRates === "function") ? window.fxGetEurRates() : {};
  let out = { ...(baseRates || {}) };

  function apply(seg) {
    if (!seg) return;
    const base = String(seg?.baseCurrency || "").toUpperCase();
    let mode = String(seg?.fxMode || "live_ecb");
    if (mode === "auto") mode = "live_ecb";

    // fixed: always override with manual EUR->BASE
    if (mode === "fixed") {
      const r = Number(seg?.eurBaseRateFixed);
      if (base && isFinite(r) && r > 0) out[base] = r;
      return;
    }

    // auto: use provider rate if available, otherwise fall back to fixed if provided
    if (mode === "live_ecb") {
      const hasLive = base && isFinite(Number(out[base])) && Number(out[base]) > 0;
      if (!hasLive) {
        const r = Number(seg?.eurBaseRateFixed);
        if (base && isFinite(r) && r > 0) out[base] = r;
      }
      return;
    }

    // auto: do nothing (relies on EUR_RATES). If missing, conversion may be null.
  }

  apply(segA);
  apply(segB);
  return out;
}

// Convert any amount to the dashboard display currency for a given day.
function amountToDisplayForDate(amount, currency, dateStr) {
  const daySeg = getBudgetSegmentForDate(dateStr) || null;
  const dispSeg = getDisplaySegment(dateStr);
  const toCur = getDisplayCurrency(dateStr);
  const fromCur = String(currency || toCur).toUpperCase();
  const amt = Number(amount) || 0;

  if (fromCur === toCur) return amt;

  if (typeof window.fxConvert === "function") {
    const rates = fxRatesForSegments(daySeg, dispSeg);
    const out = window.fxConvert(amt, fromCur, toCur, rates);
    if (out !== null && isFinite(out)) return out;
  }

  // last resort: try legacy EUR/base paths
  if (toCur === "EUR") return amountToEUR(amt, fromCur);
  if (fromCur === "EUR") return amountToBudgetBaseForDate(amt, "EUR", dateStr);
  return amt;
}

window.getDisplayDateISO = getDisplayDateISO;
window.getDisplayCurrency = getDisplayCurrency;
window.amountToDisplayForDate = amountToDisplayForDate;


// Build a EUR_RATES-like dict for a given segment (override EUR->base when fxMode=fixed)
function fxRatesForSegment(seg) {
  const base = String(seg?.baseCurrency || "").toUpperCase();
  const fxMode = String(seg?.fxMode || "fixed").toLowerCase();
  const rates = (typeof window.fxGetEurRates === "function") ? window.fxGetEurRates() : {};

  // Only fixed segments should override EUR->BASE
  if (fxMode === "fixed") {
    let r = Number(seg?.eurBaseRateFixed);

    // HARD fallback for safety: if fixed segment rate is missing, fallback to period eurBaseRate / exchangeRates
    if (!(isFinite(r) && r > 0)) {
      const periodBase = String(window.state?.period?.baseCurrency || "").toUpperCase();
      if (base && periodBase && base === periodBase) {
        const pr = Number(window.state?.period?.eurBaseRate);
        const er = Number(window.state?.exchangeRates?.["EUR-BASE"]);
        r = (isFinite(pr) && pr > 0) ? pr : ((isFinite(er) && er > 0) ? er : r);
      }
    }

    if (base && isFinite(r) && r > 0) {
      return { ...(rates || {}), [base]: r };
    }
  }

  return rates || {};
}

// Convert an amount from any currency to the segment base currency for the given date.
const __tbBudgetBaseCache = new Map();
const __tbDailyBudgetInfoCache = new Map();
function tbClearBudgetCaches() {
  try { __tbBudgetBaseCache.clear(); } catch (_) {}
  try { __tbDailyBudgetInfoCache.clear(); } catch (_) {}
}
window.tbClearBudgetCaches = tbClearBudgetCaches;

function amountToBudgetBaseForDate(amount, currency, dateStr) {
  const seg = getBudgetSegmentForDate(dateStr) || { baseCurrency: state.period.baseCurrency, fxMode: "fixed", eurBaseRateFixed: state.period.eurBaseRate };
  const base = String(seg.baseCurrency || state.period.baseCurrency || "EUR").toUpperCase();
  const a = Number(amount) || 0;
  const from = String(currency || base).toUpperCase();
  const rates = fxRatesForSegment(seg);
  const key = [String(dateStr || '').slice(0,10), a, from, base, String(seg.fxMode || seg.fx_mode || ''), Number(seg.eurBaseRateFixed || seg.eur_base_rate_fixed || 0), Number(rates?.[from] ?? 1), Number(rates?.[base] ?? 1)].join('|');
  if (__tbBudgetBaseCache.has(key)) return __tbBudgetBaseCache.get(key);
  let out = null;
  if (typeof window.fxConvert === "function") {
    out = window.fxConvert(a, from, base, rates);
    if (out !== null && isFinite(out)) {
      out = Number(out);
      __tbBudgetBaseCache.set(key, out);
      return out;
    }
  }
  if (from === base) out = a;
  else if (from === "EUR") out = a * (Number(seg.eurBaseRateFixed) || Number(state.exchangeRates["EUR-BASE"]) || 35);
  else out = a;
  out = Number(out) || 0;
  __tbBudgetBaseCache.set(key, out);
  return out;
}

// allocations are stored in the *segment base currency of their day* (field: baseCurrency).
function getAllocatedBaseForDate(dateStr) {
  const seg = getBudgetSegmentForDate(dateStr) || null;
  const base = String(seg?.baseCurrency || state.period.baseCurrency || "");
  return (state.allocations || [])
    .filter((a) => a && a.dateStr === dateStr && String(a.baseCurrency || base) === base)
    .reduce((sum, a) => sum + (Number(a.amountBase) || 0), 0);
}

// Returns remaining budget for dateStr in that day's segment base currency.
function getDailyBudgetForDate(dateStr) {
  const seg = getBudgetSegmentForDate(dateStr);
  if (!periodContains(dateStr) || !seg) return 0;
  const daily = Number(seg.dailyBudgetBase) || 0;
  return daily - getAllocatedBaseForDate(dateStr);
}

function getDailyBudgetInfoForDate(dateStr) {
  const seg = getBudgetSegmentForDate(dateStr);
  if (!periodContains(dateStr) || !seg) return { remaining: 0, daily: 0, baseCurrency: state.period.baseCurrency };
  const key = [String(window.__TB_DATA_REV || 0), String(dateStr || '').slice(0,10), String(seg.baseCurrency || state.period.baseCurrency || 'EUR').toUpperCase(), Number(seg.dailyBudgetBase || 0), String(seg.fxMode || 'fixed'), Number(seg.eurBaseRateFixed || 0)].join('|');
  if (__tbDailyBudgetInfoCache.has(key)) return __tbDailyBudgetInfoCache.get(key);
  const info = {
    remaining: getDailyBudgetForDate(dateStr),
    daily: Number(seg.dailyBudgetBase) || 0,
    baseCurrency: String(seg.baseCurrency || state.period.baseCurrency || "EUR").toUpperCase(),
    fxMode: String(seg.fxMode || "fixed"),
  };
  __tbDailyBudgetInfoCache.set(key, info);
  return info;
}

// Convenience: remaining budget converted to EUR (useful when multiple base currencies exist).
function getDailyBudgetForDateEUR(dateStr) {
  const info = getDailyBudgetInfoForDate(dateStr);
  const seg = getBudgetSegmentForDate(dateStr) || null;
  if (!seg) return 0;
  if (typeof window.fxConvert === "function") {
    const rates = fxRatesForSegment(seg);
    const out = window.fxConvert(info.remaining, info.baseCurrency, "EUR", rates);
    if (out !== null && isFinite(out)) return out;
  }
  // legacy: base->EUR only
  if (info.baseCurrency === "EUR") return info.remaining;
  if (info.baseCurrency === state.period.baseCurrency) return info.remaining * (Number(state.exchangeRates["BASE-EUR"]) || (1/35));
  return 0;
}
function totalInEUR() {
  let total = 0;
  for (const w of state.wallets) total += amountToEUR(w.balance, w.currency);
  return total;
}
function sumsPaidCommittedEUR() {
  let paid = 0;
  let committed = 0;
  for (const tx of state.transactions) {
    if (tx.type !== "expense") continue;
    const v = amountToEUR(tx.amount, tx.currency);
    if (tx.payNow) paid += v;
    else committed += v;
  }
  return { paid, committed };
}

