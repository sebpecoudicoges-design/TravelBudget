// Core money utilities (extracted from legacy helpers)
// Pure functions; safe for unit testing.

// Internal: parse number safely (handles null/undefined/NaN/string)
function _safeNumber(v, fallback=0){
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function moneyRound(n, decimals=2){
  const x = _safeNumber(n, 0);
  const p = Math.pow(10, decimals);
  return Math.round((x + Number.EPSILON) * p) / p;
}

function moneyAdd(a,b,decimals=2){
  return moneyRound(_safeNumber(a,0)+_safeNumber(b,0), decimals);
}

function fmtMoney(v, cur) {
  const n = Number(v);
  if (!Number.isFinite(n)) return `0 ${cur}`;
  return `${n.toFixed(2)} ${cur}`;
}

export { moneyRound, moneyAdd, fmtMoney };
