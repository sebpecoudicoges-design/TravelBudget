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
  categories: [],
  categoryColors: {},
};
// ---- expose for plugins (do not remove) ----
Object.defineProperty(window, "state", { get: () => state, set: (v) => { state = v; } });

const DEFAULT_CATEGORIES = ["Repas", "Logement", "Transport", "Sorties", "Caution", "Autre"];

function getCategories() {
  return Array.isArray(state.categories) && state.categories.length ? state.categories : DEFAULT_CATEGORIES;
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
  // state.categoryColors: { [name]: "#rrggbb" }
  const m = (state && state.categoryColors && typeof state.categoryColors === "object") ? state.categoryColors : null;
  return m || DEFAULT_CATEGORY_COLORS;
}

function colorForCategory(cat) {
  const key = (cat || "").trim();
  const COLORS = getCategoryColors();
  return COLORS[key] || COLORS.Autre || "#94a3b8";
}



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
  state.categories = Array.isArray(state.categories) ? state.categories : [];
  state.categoryColors = (state.categoryColors && typeof state.categoryColors === "object") ? state.categoryColors : {};

  // period defaults
  const today = toLocalISODate(new Date());
  if (!state.period.start) state.period.start = today;
  if (!state.period.end) state.period.end = today;
  if (!state.period.baseCurrency) state.period.baseCurrency = "THB";
  state.period.eurBaseRate = _safeNumber(state.period.eurBaseRate, _safeNumber(state.exchangeRates["EUR-BASE"], 35));
  state.period.dailyBudgetBase = _safeNumber(state.period.dailyBudgetBase, 1000);

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
  const base = state.period.baseCurrency;
  if (currency === base) return amount;
  if (currency === "EUR") return amount * state.exchangeRates["EUR-BASE"];
  return amount;
}
function amountToEUR(amount, currency) {
  const base = state.period.baseCurrency;
  if (currency === "EUR") return amount;
  if (currency === base) return amount * state.exchangeRates["BASE-EUR"];
  return amount;
}

function periodContains(dateStr) {
  const d = parseISODateOrNull(dateStr);
  const s = parseISODateOrNull(state.period.start);
  const e = parseISODateOrNull(state.period.end);
  if (!d || !s || !e) return false;
  return d >= s && d <= e;
}
function getAllocatedBaseForDate(dateStr) {
  return state.allocations.filter((a) => a.dateStr === dateStr).reduce((sum, a) => sum + a.amountBase, 0);
}
function getDailyBudgetForDate(dateStr) {
  if (!periodContains(dateStr)) return 0;
  return state.period.dailyBudgetBase - getAllocatedBaseForDate(dateStr);
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

