<!-- atlas-meta
{
  "id": "work.income",
  "dependencies": ["budget.transaction", "budget.daily", "analysis.budget-actual", "sync.offline"],
  "impacts": { "wallet": "possible", "dailyBudget": "required", "analysis": "required", "trip": "none", "offline": "required", "android": "required" },
  "files": ["src/core/workRules.js", "src/features/work/workView.js", "public/legacy/js/47_work_ui.js", "public/legacy/js/50_work_career_ui.js", "supabase/migrations/20260628002020_asset_budget_and_work_career_v2.sql", "supabase/migrations/20260628051630_link_work_days_and_add_beef_stew.sql"],
  "tests": ["tests/core/workRules.test.js", "tests/features/work/workView.test.js", "tests/ui/workDomainContract.test.js", "tests/ui/workCareerModalContract.test.js"],
  "validation": { "commit": "001c0abd6d568d0607d4a21960aed5c8465ba837", "date": "2026-07-14", "verifiedBy": "Codex repository inspection" }
}
-->
# work.income — Missions, périodes et revenus

## Utilisateur

Travail > journées travaillées, missions, carrière, revenus et charge hebdomadaire.

## Source de vérité

- Calculs purs et rattachement par plage : `src/core/workRules.js`.
- Vues extraites : `src/features/work/workView.js`.
- Saisie et persistance actuelles : scripts Travail legacy et tables Supabase.
- Autorisation : RLS sur les données Travail.

## Données

- `work_days`, `work_engagements` et transactions/revenus éventuellement liés.
- Les journées historiques peuvent être automatiquement rattachées à une mission couvrant leur date.
- Les revenus et allocations suivent une politique distincte des métriques de carrière.

## Conséquences à vérifier

- Journée rattachée à la bonne mission et au bon voyage.
- Revenu inclus une seule fois dans le budget et l'Analyse.
- Taux horaire professionnel excluant les revenus non professionnels.
- Mutation conservée après reconnexion et utilisable sur Android.

## Risques connus

- Journée legacy sans `engagement_id`.
- Revenu compté comme allocation et transaction simultanément.
- Indicateur de carrière influencé par un revenu hors activité.
