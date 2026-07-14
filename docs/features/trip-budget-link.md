<!-- atlas-meta
{
  "id": "trip.budget-link",
  "dependencies": ["budget.transaction", "wallet.balance", "budget.daily", "analysis.budget-actual", "sync.offline"],
  "impacts": { "wallet": "required", "dailyBudget": "required", "analysis": "required", "trip": "required", "offline": "required", "android": "required" },
  "files": ["src/core/tripRules.js", "src/data/tripRepository.js", "src/features/trip/tripStore.js", "src/features/trip/tripView.js", "public/legacy/js/29_trip_v1.js", "supabase/migrations/20260606084112_harden_trip_budget_links_and_delete.sql", "supabase/migrations/20260630053802_repair_trip_linked_payment_budget_flags.sql"],
  "tests": ["tests/core/tripRules.test.js", "tests/data/tripRepository.test.js", "tests/features/trip/tripStore.test.js", "tests/features/trip/tripView.test.js", "tests/ui/tripDomainContract.test.js", "tests/ui/tripModalContract.test.js"],
  "validation": { "commit": "001c0abd6d568d0607d4a21960aed5c8465ba837", "date": "2026-07-14", "verifiedBy": "Codex repository inspection" }
}
-->
# trip.budget-link — Liaison entre dépense Trip et Budget

## Utilisateur

Partage > créer ou modifier une dépense, choisir le payeur, les parts, le wallet et l'inclusion au budget.

## Source de vérité

- Règles pures de partage : `src/core/tripRules.js`.
- Persistance et mutations atomiques : `src/data/tripRepository.js` et RPC Trip.
- État et vue moderne : `src/features/trip`.
- Orchestration historique : `public/legacy/js/29_trip_v1.js`.
- Intégrité définitive : fonctions, triggers, RLS et contraintes PostgreSQL.

## Données

- `trip_expenses`, `trip_expense_shares`, `trip_expense_budget_links`, `transactions`, `wallets`.
- Une avance peut débiter le wallet du total tout en n'affectant le budget personnel que selon la part retenue.
- Les IDs de synchronisation protègent le rejeu mobile/offline.

## Conséquences à vérifier

- Débit wallet égal au paiement réel.
- Budget journalier et Analyse limités à la bonne part.
- Édition et suppression cohérentes des deux côtés de la liaison.
- Remboursements et settlements inchangés.
- Rejeu offline idempotent et parcours Android complet.

## Risques connus

- Total wallet correct mais budget personnel doublé.
- Liaison orpheline après suppression.
- Mauvais voyage actif lors d'une liaison depuis Patrimoine.
