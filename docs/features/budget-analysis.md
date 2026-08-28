<!-- atlas-meta
{
  "id": "analysis.budget-actual",
  "dependencies": ["budget.transaction", "budget.daily", "trip.budget-link", "work.income", "assets.movement"],
  "impacts": { "wallet": "none", "dailyBudget": "required", "analysis": "required", "trip": "required", "offline": "possible", "android": "required" },
  "files": ["src/core/budgetAnalysisRules.js", "src/features/analysis/analysisRuntime.js", "src/features/analysis/analysisView.js", "src/features/analysis/analysisChartOptions.js", "src/features/analysis/analysisCashBreakdown.js", "public/legacy/js/33_budget_analysis.js", "public/legacy/js/33_analysis_filter_view.js", "public/legacy/js/33_analysis_drilldown_view.js"],
  "tests": ["tests/core/budgetAnalysisRules.test.js", "tests/features/analysis/analysisView.test.js", "tests/features/analysis/analysisChartOptions.test.js", "tests/features/analysis/analysisCashBreakdown.test.js", "tests/ui/analysisViewContract.test.js", "tests/ui/analysisFilterViewContract.test.js", "tests/ui/analysisDrilldownViewContract.test.js"],
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
- Une entrée portant une catégorie déjà utilisée par une dépense est traitée comme un avoir pour le budget : elle réduit la consommation de cette catégorie, tout en restant une entrée brute dans la lecture de trésorerie.

## Conséquences à vérifier

- Totaux budget/réel identiques au périmètre Dashboard sélectionné.
- Exemple contractuel : sortie Essence 100 + entrée Essence 25 = dépense budgétaire nette 75, mais trésorerie brute 100 sorti / 25 entré / -75 net.
- En périmètre Budget, la trésorerie pure garde côte à côte les catégories et sous-catégories des entrées et sorties, y compris lorsque le filtre général affiche les flux planifiés ; les autres périmètres gardent la lecture agrégée.
- Pour Trip, l'avance et l'encaissement complets alimentent uniquement la trésorerie réelle. La quote-part personnelle générée par Trip réduit uniquement le budget de sa catégorie et de sa sous-catégorie.
- La qualification des avoirs vient du moteur partagé `dailyBudgetRules` afin que Dashboard, budget journalier, courbe et Analyse appliquent le même signe.
- Exclusions hors budget, parts Trip et allocations d'actifs appliquées une seule fois, sans compenser le montant cash intégral par une quote-part personnelle.
- Drilldown égal au total agrégé.
- Filtres, graphiques et vue mobile Android restent exploitables.
- État offline dégradé explicite si des données manquent.

## Risques connus

- Double calcul entre legacy et modules modernes pendant l'extraction.
- Divergence entre graphique, résumé et détail.
- Mauvaise conversion lors d'un voyage multi-devises.
