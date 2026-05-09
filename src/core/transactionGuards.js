import {
  isTripLinkedTransaction,
  isWalletAdjustmentTransaction,
  validateTransactionInput,
} from './transactionRules.js';

export function getTransactionLockState(tx, options = {}) {
  if (!tx) return { locked: false, readonly: false, kind: null, reason: null };

  if (isWalletAdjustmentTransaction(tx, options)) {
    return {
      locked: true,
      readonly: true,
      kind: 'wallet_adjustment',
      reason: "Transaction d'ajustement wallet : modification verrouillee. Utilise l'action Ajuster solde pour creer un nouvel ajustement.",
    };
  }

  if (isTripLinkedTransaction(tx)) {
    return {
      locked: true,
      readonly: true,
      kind: 'trip_linked',
      reason: "Transaction liee a une depense Trip : modification verrouillee. Modifie la depense depuis l'onglet Trip.",
    };
  }

  return { locked: false, readonly: false, kind: null, reason: null };
}

export function validateTransactionMutation(nextTx, context = {}) {
  const validation = validateTransactionInput(nextTx, context);
  if (!validation.ok) return validation;

  if (context.mode === 'edit') {
    const lock = getTransactionLockState(context.currentTx, context);
    if (lock.locked) return { ok: false, reason: lock.reason, lock };
  }

  if (context.wallet && nextTx?.walletId && String(context.wallet.id || '') !== String(nextTx.walletId)) {
    return { ok: false, reason: 'Wallet invalide.' };
  }

  if (context.wallet?.currency && nextTx?.currency) {
    const walletCurrency = String(context.wallet.currency || '').toUpperCase();
    const txCurrency = String(nextTx.currency || '').toUpperCase();
    if (walletCurrency && txCurrency && walletCurrency !== txCurrency) {
      return { ok: false, reason: 'Devise transaction incoherente avec le wallet.' };
    }
  }

  return { ok: true };
}

export function validateTransactionAction(tx, action, context = {}) {
  const lock = getTransactionLockState(tx, context);
  if (!lock.locked) return { ok: true, action, lock };

  const actionReasons = {
    delete: 'Action impossible : cette transaction est verrouillee. Modifie ou supprime-la depuis son module source.',
    mark_paid: 'Action impossible : cette transaction est verrouillee. Marque-la comme payee depuis son module source.',
    edit: lock.reason,
  };

  return {
    ok: false,
    action,
    lock,
    reason: actionReasons[action] || lock.reason,
  };
}
