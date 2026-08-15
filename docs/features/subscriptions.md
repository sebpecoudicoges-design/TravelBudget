<!-- atlas-meta
{
  "id": "budget.subscription",
  "dependencies": ["budget.transaction", "analysis.budget-actual", "wallet.balance", "sync.offline"],
  "impacts": { "wallet": "possible", "dailyBudget": "possible", "analysis": "required", "trip": "none", "offline": "required", "android": "required" },
  "files": ["src/core/subscriptionRules.js", "src/features/subscriptions/subscriptionView.js", "public/legacy/js/15_recurring_rules_ui.js", "public/legacy/js/16_modal_add_edit_via_rpc.js", "supabase/migrations/20260815034127_subscriptions_module_10_5_349.sql"],
  "tests": ["tests/core/subscriptionRules.test.js", "tests/features/subscriptions/subscriptionView.test.js", "tests/ui/subscriptionsModuleContract.test.js", "tests/data/subscriptionsMigration.test.js"],
  "validation": { "commit": "f3407d46f198", "date": "2026-08-15", "verifiedBy": "Codex repository inspection" }
}
-->
# budget.subscription — Abonnements

Le module **Abonnements** reprend les anciennes règles récurrentes de Settings et les transforme en espace financier autonome.

## Espaces

- **Vue d'ensemble** : prévu, réel payé, écart par devise et échéances à surveiller.
- **Échéances** : chronologie des lignes créées par une règle, modifiées, payées ou rattachées manuellement.
- **Règles** : création, modification, pause, reprise et archivage des automatismes.

## Source de vérité

- `recurring_rules` décrit le montant et le rythme prévus.
- `transactions.recurring_rule_id` relie une transaction à sa règle.
- `generated_by_rule = true` identifie une échéance créée automatiquement.
- Une transaction créée depuis Transactions peut être liée manuellement par `link_transaction_to_recurring_rule` si voyage, type et devise correspondent.
- Les totaux de devises différentes restent séparés : aucune addition ou conversion implicite.

Les occurrences confirmées et les exceptions modifiées restent protégées lors d'une réconciliation de règle.
