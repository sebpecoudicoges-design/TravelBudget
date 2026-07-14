<!-- atlas-meta
{
  "id": "budget.daily",
  "dependencies": ["budget.transaction", "wallet.balance", "analysis.budget-actual", "trip.budget-link", "work.income"],
  "impacts": { "wallet": "possible", "dailyBudget": "required", "analysis": "required", "trip": "required", "offline": "required", "android": "required" },
  "files": ["src/core/dailyBudgetRules.js", "public/legacy/js/06_allocations.js", "public/legacy/js/05_state.js", "public/legacy/js/11_kpi_render_micro_animation.js", "public/legacy/js/12_dashboard_render.js"],
  "tests": ["tests/core/dailyBudgetRules.test.js", "tests/ui/legacyBusinessRulesContract.test.js", "tests/features/dashboard/dashboardView.test.js"],
  "validation": { "commit": "001c0abd6d568d0607d4a21960aed5c8465ba837", "date": "2026-07-14", "verifiedBy": "Codex repository inspection" }
}
-->
# budget.daily — Budget journalier

## Utilisateur

Dashboard, notifications quotidiennes et écrans qui affichent le budget utilisé ou restant.

## Source de vérité

- Calcul pur de synthèse : `src/core/dailyBudgetRules.js`.
- Construction des allocations : `public/legacy/js/06_allocations.js`.
- État et délégation : `05_state.js`.
- Rendu : Dashboard et KPI legacy, progressivement délégués aux vues modernes.

## Données

- Entrées : transactions, périodes, segments, budget par jour, allocations Trip et Patrimoine.
- Sorties : montant quotidien, utilisé, restant et lignes contributrices.
- Le calcul n'est pas persisté comme un solde autonome : il dépend des données du contexte actif.

## Conséquences à vérifier

- Même résultat dans les KPI, les lignes journalières et les notifications.
- Une dépense Trip ne compte que selon la politique de part personnelle.
- Les revenus Travail et allocations Patrimoine suivent leur politique budgétaire.
- Les périodes et segments utilisent la bonne devise et les bonnes bornes.
- Résultat identique après hydratation offline et sur Android.

## Risques connus

- Plusieurs renderers historiques peuvent consommer le même calcul.
- Une ligne non rattachée à une mission ou un segment peut être mal attribuée.
- Une transaction liée peut être comptée à la fois directement et par allocation.
