export const WALLET_TYPES = Object.freeze(['cash', 'bank', 'card', 'savings', 'other']);
const LABELS = { cash: 'Cash (espèces)', bank: 'Banque', card: 'Carte', savings: 'Épargne', other: 'Autre' };
const ok = (value) => ({ ok: true, value });
const err = (error) => ({ ok: false, error });

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
  return LABELS[value] || LABELS.other;
}

export function validateWalletCreateInput(input = {}) {
  const name = String(input.name || '').trim();
  if (!name) return err('Nom requis.');

  const currency = String(input.currency || '').trim().toUpperCase();
  if (!currency) return err('Devise requise.');
  if (!/^[A-Z]{3,6}$/.test(currency)) return err('Devise invalide (ex: EUR, THB).');

  const type = normalizeWalletType(input.type);
  if (!type) return err('Type invalide.');

  const balance = Number(String(input.balance ?? '0').replace(',', '.').trim());
  if (!Number.isFinite(balance)) return err('Solde invalide.');

  return ok({ name, currency, type, balance });
}

export function validateWalletEditInput(input = {}) {
  const name = String(input.name || '').trim();
  if (!name) return err('Nom requis.');

  const type = normalizeWalletType(input.type);
  if (!type) return err('Type invalide.');

  return ok({ name, type });
}

export function buildWalletCreateRow(input = {}, context = {}) {
  const result = validateWalletCreateInput(input);
  if (!result.ok) return result;

  const userId = String(context.userId || '').trim();
  if (!userId) return err('Utilisateur introuvable.');

  const travelId = String(context.travelId || '').trim();
  if (!travelId) return err('Aucun voyage actif (travel_id introuvable).');

  return ok({
    user_id: userId,
    travel_id: travelId,
    period_id: context.periodId ? String(context.periodId) : null,
    name: result.value.name,
    currency: result.value.currency,
    type: result.value.type,
    balance: result.value.balance,
  });
}

export function buildWalletEditPatch(input = {}) {
  const result = validateWalletEditInput(input);
  if (!result.ok) return result;
  return ok({ name: result.value.name, type: result.value.type });
}

export function buildWalletArchivePatch({ archived = true, now = () => new Date().toISOString() } = {}) {
  const isArchived = archived !== false;
  return {
    archived: isArchived,
    archived_at: isArchived ? now() : null,
  };
}

export function canDeleteWallet({ transactions = [] } = {}) {
  return Array.isArray(transactions) && transactions.length
    ? err('Impossible de supprimer : des transactions existent sur ce wallet.')
    : { ok: true };
}

export function normalizeWalletTypeUpdates(updates = []) {
  const rows = [];
  for (const update of Array.isArray(updates) ? updates : []) {
    const walletId = String(update?.wid || update?.walletId || '').trim();
    const type = normalizeWalletType(update?.type);
    if (!walletId) return err('Wallet introuvable.');
    if (!type) return err(`Type invalide pour ${walletId}`);
    rows.push({ wid: walletId, type });
  }
  return ok(rows);
}
