<!-- atlas-meta
{
  "id": "budget.subscription",
  "dependencies": ["budget.transaction", "analysis.budget-actual", "wallet.balance", "sync.offline"],
  "impacts": { "wallet": "possible", "dailyBudget": "possible", "analysis": "required", "trip": "none", "offline": "required", "android": "required" },
  "files": ["src/core/subscriptionRules.js", "src/features/subscriptions/subscriptionView.js", "public/legacy/js/13_transactions_view.js", "public/legacy/js/15_recurring_rules_ui.js", "public/legacy/js/16_modal_add_edit_via_rpc.js", "supabase/migrations/20260815034127_subscriptions_module_10_5_349.sql", "supabase/migrations/20260815054038_subscription_tracking_and_bulk_link_10_5_350.sql", "supabase/migrations/20260815055028_harden_subscription_save_rpc_10_5_350.sql", "supabase/migrations/20260815074159_allow_safe_generated_subscription_relink_10_5_351.sql", "supabase/migrations/20260815075831_extend_subscription_cash_summary_test_10_5_351.sql", "supabase/migrations/20260815083326_allow_all_travel_subscription_links_10_5_352.sql", "supabase/migrations/20260816100004_fix_subscription_cash_summary_10_5_353.sql", "supabase/migrations/20260822003936_subscriptions_assisted_linking_10_5_354.sql"],
  "tests": ["tests/core/subscriptionRules.test.js", "tests/features/subscriptions/subscriptionView.test.js", "tests/ui/subscriptionsModuleContract.test.js", "tests/ui/transactionModalContract.test.js", "tests/ui/transactionsViewContract.test.js", "tests/ui/visualSystemContract.test.js", "tests/data/subscriptionsMigration.test.js"],
  "validation": { "commit": "d7c1d29", "date": "2026-08-22", "verifiedBy": "Codex automated tests, live test campaign update and responsive visual review" }
}
-->
# budget.subscription — Abonnements

Le module **Abonnements** reprend les anciennes règles récurrentes de Settings et les transforme en espace financier autonome.

## Espaces

- **Vue d'ensemble** : un résumé unique prévu/réel/différence séparant entrées et sorties, complété par le bilan réel total dépenses/total revenus/solde net, puis un hero compact et nuancé par abonnement.
- **Plages rapides** : période du voyage, mois civil précédent, semaine civile précédente ou dates personnalisées filtrent ensemble résumé, échéances et derniers mouvements.
- **Échéances** : chronologie des lignes créées par une règle, modifiées, payées ou rattachées manuellement.
- **À associer** : file des transactions non liées, suggestion explicable par libellé, montant, devise et date, puis confirmation humaine obligatoire. Un doublon probable avec une échéance générée bloque le rattachement direct.
- **Règles** : suivi manuel par nom ou automatisme complet, avec modification, pause, reprise et archivage.

Sur mobile, ces quatre espaces restent tous visibles dans une grille d onglets 2 x 2, sans carrousel horizontal.

## Source de vérité

- `recurring_rules` décrit un abonnement. `tracking_only = true` garde uniquement son nom et ne génère aucune échéance ; le mode automatique décrit aussi montant et rythme prévus.
- `transactions.recurring_rule_id` relie une transaction à sa règle.
- `generated_by_rule = true` identifie une échéance créée automatiquement.
- Une transaction créée depuis Transactions peut être liée manuellement par `link_transaction_to_recurring_rule`. Les trois sélecteurs affichent toutes les règles actives du voyage ; un écart de type ou de devise déclenche un avertissement explicite avant le rattachement.
- La sélection Transactions rattache ou détache jusqu'à 500 lignes atomiquement via `link_transactions_to_recurring_rule` ; les échéances générées exigent une confirmation de détachement.
- Une échéance générée peut être reclassée après confirmation : elle devient d'abord manuelle (`generated_by_rule = false`) afin que l'automatisme d'origine ne puisse plus la réécrire.
- Les totaux de devises différentes restent séparés : aucune addition ou conversion implicite.
- Entrées et sorties restent également séparées : aucune compensation visuelle entre un encaissement et une dépense.
- L'analyse par abonnement affiche le coût mensuel prévu (ou la moyenne réelle en suivi manuel), le total dépensé et la prochaine échéance connue ou estimée.
- **Voir la fiche** ouvre le prévu mensuel, le total réel, la prochaine échéance, le nombre de transactions liées et leur historique récent, avec accès à la modification de la règle et au rattachement.
- Les suggestions apprennent uniquement des libellés déjà liés par l utilisateur ; elles ne créent ni table d apprentissage ni liaison automatique. La validation utilise toujours le RPC existant et ses contrôles de propriétaire/voyage.
- Le prévu conserve le type et la devise de la règle ; le réel conserve ceux de la transaction liée. Une reclassification volontaire ne mélange donc jamais les flux ni les devises dans les totaux.

Les occurrences confirmées et les exceptions modifiées restent protégées lors d'une réconciliation de règle.

Le plan de consolidation suivant est maintenu dans [`docs/SUBSCRIPTIONS_NEXT_CHECKLIST.md`](../SUBSCRIPTIONS_NEXT_CHECKLIST.md) : association multiple, écarts avancés et finitions visuelles accessibles.
