<!-- atlas-meta
{
  "id": "analysis.budget-actual",
  "dependencies": ["budget.transaction", "budget.daily", "trip.budget-link", "work.income", "assets.movement"],
  "impacts": { "wallet": "none", "dailyBudget": "required", "analysis": "required", "trip": "required", "offline": "possible", "android": "required" },
  "files": ["src/core/budgetAnalysisRules.js", "src/features/analysis/analysisRuntime.js", "src/features/analysis/analysisView.js", "src/features/analysis/analysisChartOptions.js", "public/legacy/js/33_budget_analysis.js", "public/legacy/js/33_analysis_filter_view.js", "public/legacy/js/33_analysis_drilldown_view.js"],
  "tests": ["tests/core/budgetAnalysisRules.test.js", "tests/features/analysis/analysisView.test.js", "tests/features/analysis/analysisChartOptions.test.js", "tests/ui/analysisViewContract.test.js", "tests/ui/analysisFilterViewContract.test.js", "tests/ui/analysisDrilldownViewContract.test.js"],
  "validation": { "commit": "001c0abd6d568d0607d4a21960aed5c8465ba837", "date": "2026-07-14", "verifiedBy": "Codex repository inspection" }
}
-->
# analysis.budget-actual — Analyse budget/réel

## Utilisateur

Analyse > vue d'ensemble, catégories, sous-catégories, tendances, références pays et détail des transactions.

## Source de vérité

- Calculs purs extraits : `src/core/budgetAnalysisRules.js`.
- Rendus et options graphiques : `src/features/analysis`.
- Hydratation, filtres et orchestration restante : scripts `33_*` chargés à la demande.
- Données définitives : transactions et références budgétaires Supabase.

## Données

- Transactions, catégories, périodes, segments, taux FX et références pays.
- Allocations Trip, Travail et Patrimoine selon leurs politiques d'inclusion.
- L'Analyse consomme des données ; elle ne doit pas devenir une seconde implémentation du budget journalier.

## Conséquences à vérifier

- Totaux budget/réel identiques au périmètre Dashboard sélectionné.
- Exclusions hors budget, parts Trip et allocations d'actifs appliquées une seule fois.
- Drilldown égal au total agrégé.
- Filtres, graphiques et vue mobile Android restent exploitables.
- État offline dégradé explicite si des données manquent.

## Risques connus

- Double calcul entre legacy et modules modernes pendant l'extraction.
- Divergence entre graphique, résumé et détail.
- Mauvaise conversion lors d'un voyage multi-devises.
