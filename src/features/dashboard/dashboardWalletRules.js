export const WALLET_TYPES = Object.freeze(['cash', 'bank', 'card', 'savings', 'other']);

export function normalizeWalletType(value) {
  const type = String(value || '').trim().toLowerCase();
  return WALLET_TYPES.includes(type) ? type : '';
}

export function inferWalletTypeFromName(name) {
  const raw = String(name || '');
  let normalized = raw.toLowerCase();
  try {
    normalized = normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  } catch (_) {}
  const text = normalized.replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const has = (word) => text.includes(word);

  if (has('cash') || has('espece') || has('especes') || has('liquide') || has('billet') || has('poche')) return 'cash';
  if (has('bank') || has('banque') || has('compte') || has('rib') || has('bnp') || has('revolut') || has('wise') || has('n26')) return 'bank';
  if (has('card') || has('carte') || has('cb') || has('visa') || has('mastercard')) return 'card';
  if (has('savings') || has('epargne') || has('livret') || has('saving')) return 'savings';

  return 'other';
}

export function walletTypeLabel(type, translate) {
  const value = normalizeWalletType(type) || 'other';
  if (typeof translate === 'function') {
    const key = `wallet.type.${value}`;
    const translated = translate(key);
    if (translated && translated !== key) return translated;
  }
  if (value === 'cash') return 'Cash (espèces)';
  if (value === 'bank') return 'Banque';
  if (value === 'card') return 'Carte';
  if (value === 'savings') return 'Épargne';
  return 'Autre';
}

export function validateWalletCreateInput(input = {}) {
  const name = String(input.name || '').trim();
  if (!name) return { ok: false, error: 'Nom requis.' };

  const currency = String(input.currency || '').trim().toUpperCase();
  if (!currency) return { ok: false, error: 'Devise requise.' };
  if (!/^[A-Z]{3,6}$/.test(currency)) return { ok: false, error: 'Devise invalide (ex: EUR, THB).' };

  const type = normalizeWalletType(input.type);
  if (!type) return { ok: false, error: 'Type invalide.' };

  const balance = Number(String(input.balance ?? '0').replace(',', '.').trim());
  if (!Number.isFinite(balance)) return { ok: false, error: 'Solde invalide.' };

  return { ok: true, value: { name, currency, type, balance } };
}

export function validateWalletEditInput(input = {}) {
  const name = String(input.name || '').trim();
  if (!name) return { ok: false, error: 'Nom requis.' };

  const type = normalizeWalletType(input.type);
  if (!type) return { ok: false, error: 'Type invalide.' };

  return { ok: true, value: { name, type } };
}
