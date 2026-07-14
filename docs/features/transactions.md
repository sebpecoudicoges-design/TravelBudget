<!-- atlas-meta
{
  "id": "budget.transaction",
  "dependencies": ["wallet.balance", "budget.daily", "analysis.budget-actual", "trip.budget-link", "assets.movement", "sync.offline"],
  "impacts": { "wallet": "required", "dailyBudget": "required", "analysis": "required", "trip": "required", "offline": "required", "android": "required" },
  "files": ["src/core/transactionRules.js", "src/core/transactionGuards.js", "src/core/transactionRpcPayload.js", "public/legacy/js/16_modal_add_edit_via_rpc.js", "public/legacy/js/13_transactions_view.js", "public/legacy/js/00_offline_queue.js"],
  "tests": ["tests/core/transactionRules.test.js", "tests/core/transactionGuards.test.js", "tests/core/transactionRpcPayload.test.js", "tests/ui/transactionModalContract.test.js"],
  "validation": { "commit": "001c0abd6d568d0607d4a21960aed5c8465ba837", "date": "2026-07-14", "verifiedBy": "Codex repository inspection" }
}
-->
# budget.transaction — Transactions Budget

## Utilisateur

Transactions > Ajouter, modifier, dupliquer ou supprimer une transaction.

## Source de vérité

- Validation pure et normalisation : `src/core/transactionRules.js`, `transactionGuards.js` et `transactionRpcPayload.js`.
- Persistance définitive : RPC `apply_transaction_v2` et `delete_transaction`, avec contraintes PostgreSQL.
- Synchronisation différée : file de mutations offline et clé d'idempotence transmise au serveur.
- Autorisation : RLS et fonctions Supabase.
- Affichage et orchestration historique : modale et liste Transactions legacy.

## Données

- Tables principales : `transactions`, `wallets`, `periods`, `budget_segments`, `categories`.
- Liaisons possibles : `trip_expense_budget_links`, `asset_transaction_links`, documents.
- Cache local : état applicatif et file de mutations offline.

## Conséquences à vérifier

- Solde et devise du wallet après création, modification et suppression.
- Attribution à la bonne période et au bon segment.
- Budget journalier, KPI Dashboard et Analyse budget/réel.
- Conservation ou suppression des liaisons Trip et Patrimoine.
- Rejeu offline sans double création.
- Modale utilisable sur Android/Capacitor.

## Risques connus

- Double comptage d'une avance Trip.
- Changement involontaire de période ou de snapshot FX.
- Rejeu d'une mutation après reconnexion.
- Suppression d'une transaction encore liée.
