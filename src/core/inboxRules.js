export function normalizeInboxText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const CURRENCY_ALIASES = {
  '€': 'EUR',
  eur: 'EUR',
  euro: 'EUR',
  euros: 'EUR',
  aud: 'AUD',
  dollar: 'AUD',
  dollars: 'AUD',
  usd: 'USD',
  jpy: 'JPY',
  thb: 'THB',
  lak: 'LAK',
  vnd: 'VND',
  gbp: 'GBP',
  chf: 'CHF',
  cad: 'CAD',
  nzd: 'NZD',
  sgd: 'SGD',
};

export function parseInboxText(raw) {
  const text = String(raw || '').trim();
  if (!text) return null;

  const re = /(?:^|\s)(AUD|EUR|USD|JPY|THB|LAK|VND|GBP|CHF|CAD|NZD|SGD|€|eur|euro|aud|usd|jpy|thb|lak|vnd|gbp|chf|cad|nzd|sgd)?\s*([0-9]+(?:[,.][0-9]{1,2})?)\s*(AUD|EUR|USD|JPY|THB|LAK|VND|GBP|CHF|CAD|NZD|SGD|€|eur|euro|aud|usd|jpy|thb|lak|vnd|gbp|chf|cad|nzd|sgd)?\b/i;
  const match = text.match(re);
  if (!match) return null;

  const amount = Number(String(match[2] || '').replace(',', '.'));
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const prefix = String(match[1] || '').toLowerCase();
  const suffix = String(match[3] || '').toLowerCase();
  const currency = CURRENCY_ALIASES[prefix] || CURRENCY_ALIASES[suffix] || '';
  const label = text.replace(match[0], ' ').replace(/\s+/g, ' ').trim();

  return { amount, currency, label };
}

export function inferInboxDraft(item, options = {}) {
  const parsed = parseInboxText(item?.raw_text) || {};
  const text = normalizeInboxText(`${item?.raw_text || ''} ${item?.storage_path || ''} ${item?.media_content_type || ''}`);
  const categories = (options.categories || []).map(String).filter(Boolean);
  const findCategory = (needles, fallback) => {
    const existing = categories.find((cat) => needles.some((needle) => normalizeInboxText(cat).includes(needle)));
    return existing || fallback;
  };

  let category = options.defaultCategory || 'Autre';
  if (/\b(coles|woolworths|aldi|iga|supermarket|grocer|courses)\b/.test(text)) category = findCategory(['course', 'food', 'repas'], category);
  if (/\b(uber|taxi|train|bus|metro|opal|transport|flight|airline|boarding)\b/.test(text)) category = findCategory(['transport'], category);
  if (/\b(hotel|hostel|auberge|airbnb|booking|accommodation)\b/.test(text)) category = findCategory(['logement', 'hotel'], category);
  if (/\b(pay|salary|payslip|paie|salaire)\b/.test(text)) category = findCategory(['revenu', 'income', 'paie'], 'Revenu');

  return {
    amount: parsed.amount || '',
    currency: parsed.currency || '',
    label: parsed.label || String(item?.raw_text || '').trim() || '',
    category,
    type: normalizeInboxText(category).includes('revenu') || normalizeInboxText(category).includes('income') ? 'income' : 'expense',
  };
}

export function dateDistanceDays(a, b) {
  if (!a || !b) return null;
  const da = new Date(String(a).slice(0, 10));
  const db = new Date(String(b).slice(0, 10));
  if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return null;
  return Math.round(Math.abs(da - db) / 86400000);
}

export function scoreInboxTransaction(item, tx) {
  const parsed = parseInboxText(item?.raw_text) || {};
  const reasons = [];
  let score = 0;

  const amount = Number(parsed.amount);
  const txAmount = Number(tx?.amount);
  if (Number.isFinite(amount) && Number.isFinite(txAmount)) {
    const diff = Math.abs(amount - txAmount);
    const tolerance = Math.max(0.01, amount * 0.015);
    if (diff <= tolerance) {
      score += 42;
      reasons.push('amount');
    } else if (diff <= Math.max(1, amount * 0.08)) {
      score += 18;
      reasons.push('amount_close');
    }
  }

  const cur = String(parsed.currency || '').toUpperCase();
  const txCur = String(tx?.currency || tx?.currencyCode || '').toUpperCase();
  if (cur && txCur && cur === txCur) {
    score += 18;
    reasons.push('currency');
  }

  const txDate = tx?.dateStart || tx?.date_start || tx?.cashDate || tx?.date || tx?.created_at;
  const days = dateDistanceDays(item?.created_at, txDate);
  if (days !== null) {
    if (days <= 1) {
      score += 20;
      reasons.push('date');
    } else if (days <= 7) {
      score += 8;
      reasons.push('date_close');
    }
  }

  const inboxLabel = normalizeInboxText(parsed.label || item?.raw_text || '');
  const txLabel = normalizeInboxText(`${tx?.label || ''} ${tx?.description || ''} ${tx?.category || ''} ${tx?.subcategory || ''}`);
  if (inboxLabel && txLabel) {
    const words = inboxLabel.split(' ').filter((word) => word.length >= 3);
    const hits = words.filter((word) => txLabel.includes(word)).length;
    if (hits >= 2) {
      score += 20;
      reasons.push('label');
    } else if (hits === 1) {
      score += 8;
      reasons.push('label_part');
    }
  }

  return { score: Math.min(100, score), reasons };
}

export function sortInboxTransactionCandidates(item, transactions = [], limit = 80) {
  return (transactions || [])
    .map((tx) => ({ tx, match: scoreInboxTransaction(item, tx) }))
    .sort((a, b) => (b.match.score - a.match.score) || String(b.tx?.createdAt || b.tx?.created_at || '').localeCompare(String(a.tx?.createdAt || a.tx?.created_at || '')))
    .slice(0, limit);
}
