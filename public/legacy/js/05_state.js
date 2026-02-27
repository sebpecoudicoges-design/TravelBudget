/* =========================
   State
   ========================= */
let state = {
  exchangeRates: { "EUR-BASE": 35, "BASE-EUR": 1 / 35 },
  period: { id: null, start: "2026-02-10", end: "2026-02-28", baseCurrency: "THB", eurBaseRate: 35, dailyBudgetBase: 1000 },
  wallets: [],
  transactions: [],
  allocations: [],
  periods: [],
  budgetSegments: [],
  categories: [],
  categoryColors: {},
};
// ---- expose for plugins (do not remove) ----
Object.defineProperty(window, "state", { get: () => state, set: (v) => { state = v; } });

const DEFAULT_CATEGORIES = ["Repas", "Logement", "Transport", "Sorties", "Caution", "Autre"];

function getCategories() {
  // Always include defaults (so UI doesn't "lose" categories if state has only a subset)
  const raw = Array.isArray(state.categories) ? state.categories : [];
  const merged = [...DEFAULT_CATEGORIES, ...raw];

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
  return out;
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



const TB_CATEGORIES_LS_KEY = "travelbudget_categories_v1";
const TB_CATEGORY_COLORS_LS_KEY = "travelbudget_category_colors_v1";
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
  try {
    // 1) Try several keys
    let raw = null;
    for (const k of TB_CATEGORIES_LS_KEYS_FALLBACK) {
      raw = localStorage.getItem(k);
      if (raw) break;
    }
    // 1bis) If nothing matched, do a best-effort scan (helps when key names changed across versions)
    if (!raw) {
      for (let i = 0; i < (localStorage?.length || 0); i++) {
        const k = localStorage.key(i);
        if (!k) continue;
        if (!/categor/i.test(k)) continue;
        const v = localStorage.getItem(k);
        if (!v) continue;
        // accept only JSON arrays
        let maybe = null;
        try { maybe = JSON.parse(v); } catch (_) { maybe = null; }
        if (Array.isArray(maybe) && maybe.length) { raw = v; break; }
      }
    }
    if (!raw) {
      const blob = _tryLoadFromStateBlob();
      const arr = blob && (blob.categories || blob.category_list || (blob.state && blob.state.categories));
      if (Array.isArray(arr) && arr.length) {
        // mimic v1 array format
        raw = JSON.stringify(arr);
      }
    }
    if (!raw) {
      const blob = _tryLoadFromStateBlob();
      const m = blob && (blob.categoryColors || blob.category_colors || (blob.state && (blob.state.categoryColors || blob.state.category_colors)));
      if (m && typeof m === "object" && Object.keys(m).length) {
        raw = JSON.stringify(m);
      }
    }
    if (!raw) {
      const blob = _tryLoadFromStateBlob();
      const m = blob && (blob.categoryColors || blob.category_colors || (blob.state && (blob.state.categoryColors || blob.state.category_colors)));
      if (m && typeof m === "object" && Object.keys(m).length) {
        raw = JSON.stringify(m);
      }
    }
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;

    // Support both:
    // - ["Repas", "Transport"]
    // - [{name:"Repas", color:"#..."}, ...]
    const names = [];
    const colors = {};
    for (const item of parsed) {
      if (typeof item === "string") {
        const n = item.trim();
        if (n) names.push(n);
      } else if (item && typeof item === "object") {
        const n = String(item.name ?? item.label ?? item.title ?? "").trim();
        if (n) {
          names.push(n);
          const c = String(item.color ?? item.hex ?? "").trim();
          if (c) colors[n] = c;
        }
      }
    }

    // If we found colors embedded, merge them into existing stored colors
    if (Object.keys(colors).length) {
      state.categoryColors = (state.categoryColors && typeof state.categoryColors === "object") ? state.categoryColors : {};
      state.categoryColors = { ...state.categoryColors, ...colors };
    }

    return names.map(String).map(s => s.trim()).filter(Boolean);
  } catch (_) {}
  return null;
}

function loadCategoryColorsFromLocalStorage() {
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
  try { localStorage.setItem(TB_CATEGORIES_LS_KEY, JSON.stringify(state.categories || [])); } catch (_) {}
  try { localStorage.setItem(TB_CATEGORY_COLORS_LS_KEY, JSON.stringify(state.categoryColors || {})); } catch (_) {}
}

window.persistCategoriesToLocalStorage = persistCategoriesToLocalStorage;


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
  // local-only categories persistence (V6.4)
  if (state.categories.length === 0) {
    const lsCats = loadCategoriesFromLocalStorage();
    if (Array.isArray(lsCats) && lsCats.length) state.categories = lsCats;
  }
  state.categoryColors = (state.categoryColors && typeof state.categoryColors === "object") ? state.categoryColors : {};
  if (Object.keys(state.categoryColors || {}).length === 0) {
    const lsColors = loadCategoryColorsFromLocalStorage();
    if (lsColors && typeof lsColors === "object") state.categoryColors = lsColors;
  }

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
      start: (seg.start ?? seg.start_date ?? state.period.start),
      end: (seg.end ?? seg.end_date ?? state.period.end),
      baseCurrency: String(seg.baseCurrency ?? seg.base_currency ?? state.period.baseCurrency ?? "EUR").toUpperCase(),
      dailyBudgetBase: _safeNumber(seg.dailyBudgetBase ?? seg.daily_budget_base, state.period.dailyBudgetBase),
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
  });

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
    const mode = String(seg?.fxMode || "auto");

    // fixed: always override with manual EUR->BASE
    if (mode === "fixed") {
      const r = Number(seg?.eurBaseRateFixed);
      if (base && isFinite(r) && r > 0) out[base] = r;
      return;
    }

    // auto: use ECB if available, otherwise fall back to fixed if provided
    if (mode === "auto") {
      const hasLive = base && isFinite(Number(out[base])) && Number(out[base]) > 0;
      if (!hasLive) {
        const r = Number(seg?.eurBaseRateFixed);
        if (base && isFinite(r) && r > 0) out[base] = r;
      }
      return;
    }

    // live_ecb: do nothing (relies on EUR_RATES). If missing, conversion may be null.
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
function amountToBudgetBaseForDate(amount, currency, dateStr) {
  const seg = getBudgetSegmentForDate(dateStr) || { baseCurrency: state.period.baseCurrency, fxMode: "fixed", eurBaseRateFixed: state.period.eurBaseRate };
  const base = String(seg.baseCurrency || state.period.baseCurrency || "EUR").toUpperCase();

  // Prefer FX cross-rate engine if available
  if (typeof window.fxConvert === "function") {
    const rates = fxRatesForSegment(seg);
    const out = window.fxConvert(amount, currency, base, rates);
    if (out !== null && isFinite(out)) return out;
  }

  // Fallback to legacy
  if (currency === base) return Number(amount) || 0;
  if (currency === "EUR") return (Number(amount) || 0) * (Number(seg.eurBaseRateFixed) || Number(state.exchangeRates["EUR-BASE"]) || 35);
  return Number(amount) || 0;
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
  return {
    remaining: getDailyBudgetForDate(dateStr),
    daily: Number(seg.dailyBudgetBase) || 0,
    baseCurrency: String(seg.baseCurrency || state.period.baseCurrency || "EUR").toUpperCase(),
    fxMode: String(seg.fxMode || "fixed"),
  };
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
  for (const w of state.wallets) {
    const bal = (typeof window.tbGetWalletEffectiveBalance === "function")
      ? window.tbGetWalletEffectiveBalance(w.id)
      : (w.balance || 0);
    total += amountToEUR(bal, w.currency);
  }
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

