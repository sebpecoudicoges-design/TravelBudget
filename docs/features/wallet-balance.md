<!-- atlas-meta
{
  "id": "wallet.balance",
  "dependencies": ["budget.transaction", "trip.budget-link", "assets.movement", "sync.offline"],
  "impacts": { "wallet": "required", "dailyBudget": "possible", "analysis": "possible", "trip": "possible", "offline": "required", "android": "required" },
  "files": ["src/core/walletBalanceRules.js", "public/legacy/js/31_wallet_balance.js", "public/legacy/js/15_wallet_adjust.js", "public/legacy/js/05_state.js"],
  "tests": ["tests/core/walletBalanceRules.test.js", "tests/features/dashboard/dashboardView.test.js", "tests/ui/dashboardViewContract.test.js"],
  "validation": { "commit": "001c0abd6d568d0607d4a21960aed5c8465ba837", "date": "2026-07-14", "verifiedBy": "Codex repository inspection" }
}
-->
# wallet.balance — Solde d'un wallet

## Utilisateur

Dashboard > cartes wallets, ajustements et transferts internes.

## Source de vérité

- Agrégation pure et normalisation : `src/core/walletBalanceRules.js`.
- Chargement et orchestration : `public/legacy/js/31_wallet_balance.js`.
- Ajustement explicite : `15_wallet_adjust.js`.
- Cohérence définitive des mutations : RPC et contraintes Supabase associées aux wallets et transactions.

## Données

- Tables : `wallets`, `transactions` et vues sécurisées de solde.
- État local : `state.walletBalances` et `state.walletBalanceMap`.
- Les opérations Trip, Patrimoine et transferts peuvent produire des transactions qui affectent le solde.

## Conséquences à vérifier

- Signe correct selon dépense, revenu, ajustement et transfert.
- Absence de double débit pour une dépense Trip.
- Devise et arrondis cohérents.
- Cartes Dashboard rafraîchies après mutation et reconnexion.
- Résultat identique sur le shell Android.

## Risques connus

- Cache de solde périmé après mutation partielle.
- Transaction liée supprimée d'un seul côté.
- Confusion entre solde natif du wallet et affichage converti.
