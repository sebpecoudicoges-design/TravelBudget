<!-- atlas-meta
{
  "id": "budget.subscription",
  "dependencies": ["budget.transaction", "analysis.budget-actual", "wallet.balance", "sync.offline"],
  "impacts": { "wallet": "possible", "dailyBudget": "possible", "analysis": "required", "trip": "none", "offline": "required", "android": "required" },
  "files": ["src/core/subscriptionRules.js", "src/features/subscriptions/subscriptionView.js", "public/legacy/js/13_transactions_view.js", "public/legacy/js/15_recurring_rules_ui.js", "public/legacy/js/16_modal_add_edit_via_rpc.js", "supabase/migrations/20260815034127_subscriptions_module_10_5_349.sql", "supabase/migrations/20260815054038_subscription_tracking_and_bulk_link_10_5_350.sql", "supabase/migrations/20260815055028_harden_subscription_save_rpc_10_5_350.sql", "supabase/migrations/20260815074159_allow_safe_generated_subscription_relink_10_5_351.sql", "supabase/migrations/20260815075831_extend_subscription_cash_summary_test_10_5_351.sql"],
  "tests": ["tests/core/subscriptionRules.test.js", "tests/features/subscriptions/subscriptionView.test.js", "tests/ui/subscriptionsModuleContract.test.js", "tests/ui/transactionModalContract.test.js", "tests/ui/transactionsViewContract.test.js", "tests/ui/visualSystemContract.test.js", "tests/data/subscriptionsMigration.test.js"],
  "validation": { "commit": "6d237ad", "date": "2026-08-15", "verifiedBy": "Codex automated tests and visual review" }
}
-->
# budget.subscription — Abonnements

Le module **Abonnements** reprend les anciennes règles récurrentes de Settings et les transforme en espace financier autonome.

## Espaces

- **Vue d'ensemble** : un résumé unique prévu/réel/différence séparant entrées et sorties, complété par le bilan réel total dépenses/total revenus/solde net, puis un hero compact et nuancé par abonnement.
- **Plages rapides** : période du voyage, mois civil précédent, semaine civile précédente ou dates personnalisées filtrent ensemble résumé, échéances et derniers mouvements.
- **Échéances** : chronologie des lignes créées par une règle, modifiées, payées ou rattachées manuellement.
- **Règles** : suivi manuel par nom ou automatisme complet, avec modification, pause, reprise et archivage.

## Source de vérité

- `recurring_rules` décrit un abonnement. `tracking_only = true` garde uniquement son nom et ne génère aucune échéance ; le mode automatique décrit aussi montant et rythme prévus.
- `transactions.recurring_rule_id` relie une transaction à sa règle.
- `generated_by_rule = true` identifie une échéance créée automatiquement.
- Une transaction créée depuis Transactions peut être liée manuellement par `link_transaction_to_recurring_rule`. Un suivi manuel accepte tout mouvement du même voyage ; un automatisme impose aussi type et devise compatibles.
- La sélection Transactions rattache ou détache jusqu'à 500 lignes atomiquement via `link_transactions_to_recurring_rule` ; les échéances générées exigent une confirmation de détachement.
- Une échéance générée peut être reclassée après confirmation : elle devient d'abord manuelle (`generated_by_rule = false`) afin que l'automatisme d'origine ne puisse plus la réécrire.
- Les totaux de devises différentes restent séparés : aucune addition ou conversion implicite.
- Entrées et sorties restent également séparées : aucune compensation visuelle entre un encaissement et une dépense.
- L'analyse par abonnement affiche le coût mensuel prévu (ou la moyenne réelle en suivi manuel), le total dépensé et la prochaine échéance connue ou estimée.

Les occurrences confirmées et les exceptions modifiées restent protégées lors d'une réconciliation de règle.
