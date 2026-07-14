<!-- atlas-meta
{
  "id": "assets.movement",
  "dependencies": ["budget.transaction", "wallet.balance", "budget.daily", "analysis.budget-actual", "trip.budget-link", "sync.offline"],
  "impacts": { "wallet": "required", "dailyBudget": "required", "analysis": "required", "trip": "possible", "offline": "required", "android": "required" },
  "files": ["src/core/assetRules.js", "src/features/assets/assetView.js", "public/legacy/js/41_assets_core.js", "public/legacy/js/42_assets_ui.js", "supabase/migrations/20260628002020_asset_budget_and_work_career_v2.sql", "supabase/migrations/20260712004235_asset_transaction_links_budget_policy.sql"],
  "tests": ["tests/core/assetRules.test.js", "tests/features/assets/assetView.test.js", "tests/data/assetTransactionLinksMigration.test.js", "tests/ui/assetsDomainContract.test.js", "tests/ui/assetsModalContract.test.js"],
  "validation": { "commit": "001c0abd6d568d0607d4a21960aed5c8465ba837", "date": "2026-07-14", "verifiedBy": "Codex repository inspection" }
}
-->
# assets.movement — Achat, transfert, vente et amortissement d'un actif

## Utilisateur

Patrimoine > créer un actif, enregistrer un mouvement, gérer les propriétaires et lier une transaction Budget ou Trip.

## Source de vérité

- Calculs purs de valeur, amortissement et parts : `src/core/assetRules.js`.
- Rendus de formulaires et cartes : `src/features/assets/assetView.js`.
- Orchestration et persistance actuelles : scripts Patrimoine legacy et Supabase.
- Politique d'inclusion budgétaire des liens : schéma/migrations PostgreSQL.

## Données

- `assets`, `asset_owners`, `asset_ownership_events`, `asset_transaction_links`.
- Lien optionnel vers une transaction wallet ou une dépense Trip.
- Politique d'inclusion et amortissement mensuel proratisé par part de propriété.

## Conséquences à vérifier

- Transaction ou dépense Trip liée au bon actif et au bon voyage.
- Débit wallet et budget conformes à la politique d'inclusion.
- Amortissement et Analyse non doublés avec le prix d'achat.
- Transfert et vente conservent l'historique de propriété.
- Modales et actions disponibles sur Android et après reconnexion.

## Risques connus

- Achat compté immédiatement puis de nouveau via amortissement.
- Lien ancien non rechargé par ID.
- Mauvais Trip actif lors de la création d'un mouvement lié.
