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

export function normalizeAnalysisKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function affectsBudgetAnalysisDataset(tx = {}) {
  if (!tx || typeof tx !== 'object') return false;
  const flag = tx.affectsBudget ?? tx.affects_budget;
  if (flag === false) return false;
  if (String(tx.type || '').toLowerCase() !== 'expense') return false;
  return true;
}

export function sqlAnalyticFamilyToBucket(family) {
  const f = normalizeAnalysisKey(family);
  if (f === 'accommodation') return 'Logement';
  if (f === 'food') return 'Repas';
  if (f === 'transport') return 'Transport';
  if (f === 'activities') return 'Activités';
  return null;
}

export function mapToSourcedBucket({ categoryName = '', tx = null, mappingByTxId = {}, fallbackMapping = {} } = {}) {
  const byTx = tx?.analyticMapping || (tx?.id ? mappingByTxId?.[String(tx.id)] : null) || null;
  const key = normalizeAnalysisKey(categoryName);

  if (byTx) {
    const status = String(byTx.mappingStatus || byTx.mapping_status || '').trim().toLowerCase();
    const family = byTx.analyticFamily || byTx.analytic_family || null;
    const bucket = sqlAnalyticFamilyToBucket(family);
    if (status === 'mapped' && bucket) return { mode: 'mapped', bucket, key, source: 'sql' };
    if (status === 'excluded') return { mode: 'excluded', key, source: 'sql' };
    if (status === 'unmapped') return { mode: 'unmapped', key, source: 'sql' };
  }

  const meta = fallbackMapping?.[key] || null;
  if (!meta) return { mode: 'unmapped', key, source: 'fallback' };
  const compareMode = String(meta.compare_mode || meta.mode || '').trim().toLowerCase();
  const bucket = String(meta.sourced_bucket || meta.bucket || '').trim() || null;
  if (compareMode === 'mapped' && bucket) return { mode: 'mapped', bucket, key, source: 'fallback' };
  if (compareMode === 'excluded') return { mode: 'excluded', key, source: 'fallback' };
  return { mode: 'unmapped', key, source: 'fallback' };
}

export function analysisBucketOrder({ fallbackMapping = {}, baseOrder = [] } = {}) {
  const dynamic = Object.values(fallbackMapping || {})
    .filter((meta) => String(meta?.compare_mode || meta?.mode || '').trim().toLowerCase() === 'mapped' && String(meta?.sourced_bucket || meta?.bucket || '').trim())
    .map((meta) => String(meta.sourced_bucket || meta.bucket || '').trim());
  return Array.from(new Set([...(Array.isArray(baseOrder) ? baseOrder : []), ...dynamic]));
}
