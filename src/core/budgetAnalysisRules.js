function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function computeTrendGap({ projection = 0, budget = 0, currency = 'EUR' }) {
  const projected = num(projection, 0);
  const totalBudget = num(budget, 0);
  const delta = projected - totalBudget;
  const percent = totalBudget > 0 ? (delta / totalBudget) * 100 : 0;
  return {
    projection: projected,
    budget: totalBudget,
    delta,
    percent,
    currency: String(currency || 'EUR').toUpperCase(),
    status: delta <= 0 ? 'under' : 'over',
  };
}

export function formatSignedPercent(value) {
  const n = num(value, 0);
  const rounded = Math.round(n);
  return `${rounded > 0 ? '+' : ''}${rounded} %`;
}

export function formatSignedMoney(value, currency = 'EUR') {
  const n = num(value, 0);
  const abs = Math.abs(n).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${n > 0 ? '+' : n < 0 ? '-' : ''}${abs} ${String(currency || 'EUR').toUpperCase()}`;
}
