> Fichier généré automatiquement. Ne pas modifier manuellement.
> Commit analysé : `c1e3d3797d917b8770272593cada904ea93deddf`
> Empreinte du snapshot : `6dc5c6c5717f396cdc8fac2cd02c32e203ecb1b8a66f163bae89466289a8e188`
> Généré le : `2026-07-19T06:18:25.648Z`

# Inventaire du projet TravelBudget

Cet inventaire décrit uniquement des éléments détectables dans le dépôt. Il n'évalue ni la stabilité fonctionnelle, ni la qualité des tests, ni la complétude d'un domaine. Le commit est la base Git au moment de la génération ; l'empreinte identifie le contenu inventorié, y compris les changements locaux.

## Résumé factuel

| Élément | Valeur |
|---|---:|
| Version | `10.5.220` |
| Écrans déclarés | 14 |
| Scripts legacy référencés | 62 |
| Modules core | 24 |
| Modules data | 7 |
| Modules features | 26 |
| Fichiers de tests | 93 |
| Migrations Supabase | 86 |
| Fonctions Edge | 8 |
| Projet Android présent | Oui |

## Scripts npm

| Script | Commande |
|---|---|
| `dev` | `vite` |
| `build` | `vite build` |
| `preview` | `vite preview --port 4173` |
| `test` | `vitest run` |
| `test:watch` | `vitest` |
| `test:e2e` | `node scripts/run-playwright.mjs` |
| `atlas:generate` | `node scripts/generate-project-atlas.mjs` |
| `docs:check` | `node scripts/check-project-docs.mjs` |
| `perf:budget` | `node scripts/check-module-budgets.mjs` |
| `lint:syntax` | `node scripts/check-js-syntax.mjs` |
| `lint:db` | `node scripts/lint_db_strings.cjs` |
| `cap:sync` | `npm run build && npx cap sync android` |
| `android:open` | `npx cap open android` |
| `android:build-debug` | `powershell -ExecutionPolicy Bypass -File scripts/build-android-debug.ps1` |
| `android:release-debug` | `powershell -ExecutionPolicy Bypass -File scripts/build-android-debug.ps1 -UploadSupabase` |

## Écrans déclarés dans index.html

- `analysis`
- `assets`
- `cautions`
- `dashboard`
- `documents`
- `help`
- `members`
- `notifications`
- `nutrition`
- `settings`
- `sport`
- `transactions`
- `trip`
- `work`

## Onglets de navigation déclarés

- `analysis`
- `assets`
- `cautions`
- `dashboard`
- `documents`
- `help`
- `members`
- `notifications`
- `nutrition`
- `settings`
- `sport`
- `transactions`
- `trip`
- `work`

## Domaines legacy chargés à la demande

- `analysis`
- `assets`
- `cashflow`
- `cautions`
- `documents`
- `help`
- `notifications`
- `nutrition`
- `sport`
- `trip`
- `work`

## Scripts legacy référencés par le chargeur

- `public/legacy/js/00_constants.js`
- `public/legacy/js/00_i18n.js`
- `public/legacy/js/00_offline.js`
- `public/legacy/js/00_offline_queue.js`
- `public/legacy/js/00_perf.js`
- `public/legacy/js/00_supabase_config.js`
- `public/legacy/js/01_helpers.js`
- `public/legacy/js/02_palette_local_server_sync_robuste.js`
- `public/legacy/js/03_ui_auth.js`
- `public/legacy/js/04_theme.js`
- `public/legacy/js/05_state.js`
- `public/legacy/js/06_allocations.js`
- `public/legacy/js/06_travel_context.js`
- `public/legacy/js/07_supabase_bootstrap.js`
- `public/legacy/js/08_refresh.js`
- `public/legacy/js/09_fx.js`
- `public/legacy/js/09_fx_snapshot.js`
- `public/legacy/js/10_navigation.js`
- `public/legacy/js/11_kpi_controller.js`
- `public/legacy/js/11_kpi_render_micro_animation.js`
- `public/legacy/js/12_dashboard_render.js`
- `public/legacy/js/13_transactions_view.js`
- `public/legacy/js/14_settings_periods_ui.js`
- `public/legacy/js/15_recurring_rules_ui.js`
- `public/legacy/js/15_wallet_adjust.js`
- `public/legacy/js/16_modal_add_edit_via_rpc.js`
- `public/legacy/js/17_charts.js`
- `public/legacy/js/17_internal_transfers.js`
- `public/legacy/js/18_main_render.js`
- `public/legacy/js/19_backup_export_import.js`
- `public/legacy/js/20_boot.js`
- `public/legacy/js/21_dashboard_drag.js`
- `public/legacy/js/22_budget_consistency_audit.js`
- `public/legacy/js/24_tx_fx_snapshot.js`
- `public/legacy/js/25_health_check.js`
- `public/legacy/js/26_fx_crossrate.js`
- `public/legacy/js/27_cashflow_curve.js`
- `public/legacy/js/28_data_updated_bus.js`
- `public/legacy/js/29_trip_document_view.js`
- `public/legacy/js/29_trip_v1.js`
- `public/legacy/js/30_members_admin.js`
- `public/legacy/js/31_help_faq.js`
- `public/legacy/js/31_wallet_balance.js`
- `public/legacy/js/32_help_assistant.js`
- `public/legacy/js/33_analysis_drilldown_view.js`
- `public/legacy/js/33_analysis_filter_view.js`
- `public/legacy/js/33_budget_analysis.js`
- `public/legacy/js/34_fx_decision.js`
- `public/legacy/js/35_guided_tour.js`
- `public/legacy/js/41_assets_core.js`
- `public/legacy/js/42_assets_ui.js`
- `public/legacy/js/43_documents_ui.js`
- `public/legacy/js/44_inbox_ui.js`
- `public/legacy/js/45_sport_ui.js`
- `public/legacy/js/46_cautions_ui.js`
- `public/legacy/js/47_work_ui.js`
- `public/legacy/js/48_nutrition_ui.js`
- `public/legacy/js/49_notifications_ui.js`
- `public/legacy/js/50_work_career_ui.js`
- `public/legacy/js/97_ui_errors.js`
- `public/legacy/js/98_error_bus.js`
- `public/legacy/js/99_doctor.js`

## Modules src/core

- `src/core/assetRules.js`
- `src/core/assistantRules.js`
- `src/core/bodyEnergyRules.js`
- `src/core/budgetAnalysisRules.js`
- `src/core/canonicalRecords.js`
- `src/core/dailyBudgetRules.js`
- `src/core/documentRules.js`
- `src/core/frankfurterRules.js`
- `src/core/fxDecisionRules.js`
- `src/core/fxRules.js`
- `src/core/inboxRules.js`
- `src/core/money.js`
- `src/core/notificationRules.js`
- `src/core/nutritionRules.js`
- `src/core/recurringRules.js`
- `src/core/sportLibraryRules.js`
- `src/core/sportRules.js`
- `src/core/transactionGuards.js`
- `src/core/transactionRpcPayload.js`
- `src/core/transactionRules.js`
- `src/core/tripRules.js`
- `src/core/walletBalanceRules.js`
- `src/core/webhookSecurityRules.js`
- `src/core/workRules.js`

## Modules src/data

- `src/data/entityStore.js`
- `src/data/mutationQueueStore.js`
- `src/data/nutritionRepository.js`
- `src/data/sportRepository.js`
- `src/data/storageQuota.js`
- `src/data/supabaseRepository.js`
- `src/data/tripRepository.js`

## Domaines et modules src/features

Domaines :

- `analysis`
- `assets`
- `dashboard`
- `kpi`
- `nutrition`
- `settings`
- `sport`
- `trip`
- `work`

Modules :

- `src/features/analysis/analysisChartOptions.js`
- `src/features/analysis/analysisRuntime.js`
- `src/features/analysis/analysisView.js`
- `src/features/assets/assetView.js`
- `src/features/dashboard/dashboardView.js`
- `src/features/dashboard/dashboardWalletRules.js`
- `src/features/kpi/kpiHealthRules.js`
- `src/features/kpi/kpiView.js`
- `src/features/nutrition/nutritionStore.js`
- `src/features/nutrition/nutritionView.js`
- `src/features/settings/settingsAccountController.js`
- `src/features/settings/settingsCategoriesView.js`
- `src/features/settings/settingsView.js`
- `src/features/sport/sportCatalog.js`
- `src/features/sport/sportHistoryView.js`
- `src/features/sport/sportProfileRules.js`
- `src/features/sport/sportProfileView.js`
- `src/features/sport/sportProgramRules.js`
- `src/features/sport/sportSessionSandboxRules.js`
- `src/features/sport/sportSessionSandboxView.js`
- `src/features/sport/sportStore.js`
- `src/features/sport/sportTimerController.js`
- `src/features/sport/sportTimerView.js`
- `src/features/trip/tripStore.js`
- `src/features/trip/tripView.js`
- `src/features/work/workView.js`

## Tests

### Contrats de domaine et d'interface

- `tests/ui/analysisDrilldownViewContract.test.js`
- `tests/ui/analysisFilterViewContract.test.js`
- `tests/ui/analysisViewContract.test.js`
- `tests/ui/architectureDocsContract.test.js`
- `tests/ui/assetsDomainContract.test.js`
- `tests/ui/assetsModalContract.test.js`
- `tests/ui/cspContract.test.js`
- `tests/ui/dashboardViewContract.test.js`
- `tests/ui/errorBusContract.test.js`
- `tests/ui/kpiRangePickerContract.test.js`
- `tests/ui/kpiViewContract.test.js`
- `tests/ui/legacyBusinessRulesContract.test.js`
- `tests/ui/moduleSizeBudgetsContract.test.js`
- `tests/ui/nutritionDomainContract.test.js`
- `tests/ui/settingsModalContract.test.js`
- `tests/ui/settingsViewContract.test.js`
- `tests/ui/sportDomainContract.test.js`
- `tests/ui/sportFullscreenContract.test.js`
- `tests/ui/sportProfileRulesContract.test.js`
- `tests/ui/sportProfileViewContract.test.js`
- `tests/ui/sportProgramContract.test.js`
- `tests/ui/sportSessionSandboxContract.test.js`
- `tests/ui/sportSessionSandboxRulesContract.test.js`
- `tests/ui/sportStoreContract.test.js`
- `tests/ui/sportTimerControllerContract.test.js`
- `tests/ui/sportViewsContract.test.js`
- `tests/ui/syntaxLintContract.test.js`
- `tests/ui/transactionModalContract.test.js`
- `tests/ui/tripDomainContract.test.js`
- `tests/ui/tripModalContract.test.js`
- `tests/ui/workCareerModalContract.test.js`
- `tests/ui/workDomainContract.test.js`

### Parcours Playwright

- `tests/e2e/critical-flows.spec.js`

### Tous les fichiers de tests

- `tests/core/assetRules.test.js`
- `tests/core/assistantRules.test.js`
- `tests/core/budgetAnalysisRules.test.js`
- `tests/core/canonicalRecords.test.js`
- `tests/core/dailyBudgetRules.test.js`
- `tests/core/documentRules.test.js`
- `tests/core/frankfurterRules.test.js`
- `tests/core/fxDecisionRules.test.js`
- `tests/core/fxRules.test.js`
- `tests/core/i18nRules.test.js`
- `tests/core/inboxRules.test.js`
- `tests/core/money.test.js`
- `tests/core/notificationRules.test.js`
- `tests/core/nutritionRules.test.js`
- `tests/core/recurringRules.test.js`
- `tests/core/sportLibraryRules.test.js`
- `tests/core/sportRules.test.js`
- `tests/core/transactionGuards.test.js`
- `tests/core/transactionRpcPayload.test.js`
- `tests/core/transactionRules.test.js`
- `tests/core/tripRules.test.js`
- `tests/core/walletBalanceRules.test.js`
- `tests/core/webhookSecurityRules.test.js`
- `tests/core/workRules.test.js`
- `tests/data/assetTransactionLinksMigration.test.js`
- `tests/data/entityStore.test.js`
- `tests/data/mutationQueueStore.test.js`
- `tests/data/nutritionRepository.test.js`
- `tests/data/recurringBudgetPeriodMigration.test.js`
- `tests/data/sportRepository.test.js`
- `tests/data/storageQuota.test.js`
- `tests/data/supabaseRepository.test.js`
- `tests/data/tripRepository.test.js`
- `tests/e2e/critical-flows.spec.js`
- `tests/features/analysis/analysisChartOptions.test.js`
- `tests/features/analysis/analysisView.test.js`
- `tests/features/assets/assetView.test.js`
- `tests/features/dashboard/dashboardView.test.js`
- `tests/features/dashboard/dashboardWalletRules.test.js`
- `tests/features/kpi/kpiController.test.js`
- `tests/features/kpi/kpiHealthRules.test.js`
- `tests/features/kpi/kpiView.test.js`
- `tests/features/nutrition/nutritionStore.test.js`
- `tests/features/nutrition/nutritionView.test.js`
- `tests/features/settings/settingsAccountController.test.js`
- `tests/features/settings/settingsView.test.js`
- `tests/features/sport/sportCatalog.test.js`
- `tests/features/sport/sportProfileRules.test.js`
- `tests/features/sport/sportProfileView.test.js`
- `tests/features/sport/sportProgramRules.test.js`
- `tests/features/sport/sportSessionSandboxRules.test.js`
- `tests/features/sport/sportSessionSandboxView.test.js`
- `tests/features/sport/sportStore.test.js`
- `tests/features/sport/sportTimerController.test.js`
- `tests/features/sport/sportViews.test.js`
- `tests/features/trip/tripStore.test.js`
- `tests/features/trip/tripView.test.js`
- `tests/features/work/workView.test.js`
- `tests/ui/analysisDrilldownViewContract.test.js`
- `tests/ui/analysisFilterViewContract.test.js`
- `tests/ui/analysisViewContract.test.js`
- `tests/ui/architectureDocsContract.test.js`
- `tests/ui/assetsDomainContract.test.js`
- `tests/ui/assetsModalContract.test.js`
- `tests/ui/components.test.js`
- `tests/ui/cspContract.test.js`
- `tests/ui/dashboardViewContract.test.js`
- `tests/ui/errorBusContract.test.js`
- `tests/ui/kpiRangePickerContract.test.js`
- `tests/ui/kpiViewContract.test.js`
- `tests/ui/legacyBusinessRulesContract.test.js`
- `tests/ui/legacyDomainLoader.test.js`
- `tests/ui/moduleSizeBudgetsContract.test.js`
- `tests/ui/nutritionDomainContract.test.js`
- `tests/ui/settingsModalContract.test.js`
- `tests/ui/settingsViewContract.test.js`
- `tests/ui/sportDomainContract.test.js`
- `tests/ui/sportFullscreenContract.test.js`
- `tests/ui/sportProfileRulesContract.test.js`
- `tests/ui/sportProfileViewContract.test.js`
- `tests/ui/sportProgramContract.test.js`
- `tests/ui/sportSessionSandboxContract.test.js`
- `tests/ui/sportSessionSandboxRulesContract.test.js`
- `tests/ui/sportStoreContract.test.js`
- `tests/ui/sportTimerControllerContract.test.js`
- `tests/ui/sportViewsContract.test.js`
- `tests/ui/standaloneHealthNavigation.test.js`
- `tests/ui/syntaxLintContract.test.js`
- `tests/ui/transactionModalContract.test.js`
- `tests/ui/tripDomainContract.test.js`
- `tests/ui/tripModalContract.test.js`
- `tests/ui/workCareerModalContract.test.js`
- `tests/ui/workDomainContract.test.js`

## Supabase

### Fonctions Edge

- `admin-generate-invite-link`
- `admin-generate-recovery-link`
- `admin-invite`
- `admin-wipe-user`
- `dispatch-mobile-notifications`
- `fx-latest`
- `send-mobile-notification`
- `whatsapp-inbox`

### Migrations

- `supabase/migrations/202605240001_app_error_logs.sql`
- `supabase/migrations/202605240002_harden_anon_grants.sql`
- `supabase/migrations/20260525003243_trip_pending_invites.sql`
- `supabase/migrations/20260525005406_harden_trip_pending_invites_email_lookup.sql`
- `supabase/migrations/20260525010455_fix_trip_invite_accept_and_dedupe.sql`
- `supabase/migrations/20260525011025_trip_payer_approval_inbox.sql`
- `supabase/migrations/20260527061936_budget_only_trip_payer_approval.sql`
- `supabase/migrations/20260527081227_trip_budget_share_approval_for_participants.sql`
- `supabase/migrations/20260527082155_trip_payer_accept_creates_cash_payment.sql`
- `supabase/migrations/20260529015901_trip_decline_budget_share_approval.sql`
- `supabase/migrations/20260529021811_caution_deposits.sql`
- `supabase/migrations/20260529023415_app_downloads_storage_bucket.sql`
- `supabase/migrations/20260530013921_caution_deposit_reconciliation.sql`
- `supabase/migrations/20260530032457_caution_multi_links_documents.sql`
- `supabase/migrations/20260531000433_mobile_notification_campaigns.sql`
- `supabase/migrations/20260601051646_user_notification_prefs.sql`
- `supabase/migrations/20260601054806_mobile_push_tokens.sql`
- `supabase/migrations/20260602041922_harden_recurring_paid_instances.sql`
- `supabase/migrations/20260603082105_harden_security_stabilization.sql`
- `supabase/migrations/20260605055707_move_btree_gist_extension.sql`
- `supabase/migrations/20260605062713_reduce_executable_security_definer_helpers.sql`
- `supabase/migrations/20260605065638_harden_transaction_wallet_rpcs.sql`
- `supabase/migrations/20260605070817_harden_trip_rpc_integrity.sql`
- `supabase/migrations/20260605072111_restrict_trip_trigger_helpers.sql`
- `supabase/migrations/20260606081231_harden_recurring_rule_integrity.sql`
- `supabase/migrations/20260606082644_remove_duplicate_recurring_integrity_guard.sql`
- `supabase/migrations/20260606082955_harden_wallet_transfer_integrity.sql`
- `supabase/migrations/20260606084112_harden_trip_budget_links_and_delete.sql`
- `supabase/migrations/20260606085204_filter_trip_delete_transaction_updates.sql`
- `supabase/migrations/20260608084811_notification_dispatch_work_days.sql`
- `supabase/migrations/20260611090500_sport_exercise_library.sql`
- `supabase/migrations/20260611091500_nutrition_foundation.sql`
- `supabase/migrations/20260611205500_expand_nutrition_food_library.sql`
- `supabase/migrations/20260612032908_expand_nutrition_foods_level_1_sources.sql`
- `supabase/migrations/20260612034416_expand_nutrition_foods_level_1_5_travel_sports_dishes.sql`
- `supabase/migrations/20260613010240_nutrition_level_1_5_fast_food_batch_a.sql`
- `supabase/migrations/20260613010503_nutrition_level_1_5_world_sport_batch_b.sql`
- `supabase/migrations/20260613090540_expand_nutrition_food_library_core_v2.sql`
- `supabase/migrations/20260613094802_nutrition_meal_moments_and_portions.sql`
- `supabase/migrations/20260613115137_expand_nutrition_dishes_catalog.sql`
- `supabase/migrations/20260613232223_add_pain_perdu_nutrition_food.sql`
- `supabase/migrations/20260614004007_tune_heavy_bag_met_recalculate_sessions.sql`
- `supabase/migrations/20260614021119_repair_heavy_bag_session_items.sql`
- `supabase/migrations/20260614045156_recalc_heavy_bag_sessions_after_met_repair.sql`
- `supabase/migrations/20260614051647_enrich_dumbbell_sport_library.sql`
- `supabase/migrations/20260614053427_enrich_global_sport_library_and_repair_jump_rope_sets.sql`
- `supabase/migrations/20260614061214_add_settings_birth_date.sql`
- `supabase/migrations/20260614061432_recalculate_work_days_net_met_kcal.sql`
- `supabase/migrations/20260614092947_add_settings_body_profile.sql`
- `supabase/migrations/20260614094157_add_nutrition_sleep.sql`
- `supabase/migrations/20260615072607_expand_realistic_sport_nutrition_libraries.sql`
- `supabase/migrations/20260615074515_favorite_recent_health_assistant_catalogs.sql`
- `supabase/migrations/20260617090001_sport_timer_series_plate_repair.sql`
- `supabase/migrations/20260617090426_recalc_sport_kcal_after_timer_repair.sql`
- `supabase/migrations/20260617094022_sport_library_v2_families.sql`
- `supabase/migrations/20260618080021_repair_sport_timer_time_sets_and_kcal.sql`
- `supabase/migrations/20260618080325_recalc_repaired_sport_sessions.sql`
- `supabase/migrations/20260620015152_dedupe_june_19_sport_sessions.sql`
- `supabase/migrations/20260620031950_merge_june_19_sport_sessions.sql`
- `supabase/migrations/20260620034424_backfill_june_19_sport_sets.sql`
- `supabase/migrations/20260621030244_sport_programs_reference_loads.sql`
- `supabase/migrations/20260621101106_notification_templates_manager.sql`
- `supabase/migrations/20260624073154_add_hipro_and_chicken_curry_foods.sql`
- `supabase/migrations/20260624080119_server_idempotency_sport_health_v2.sql`
- `supabase/migrations/20260624082449_restrict_apply_transaction_v2_idempotent_execute.sql`
- `supabase/migrations/20260624101657_sport_program_tue_thu_sat_schedule.sql`
- `supabase/migrations/20260624102259_health_body_measurements.sql`
- `supabase/migrations/20260625090342_add_lamb_rice_deadlift_a2_capacity.sql`
- `supabase/migrations/20260625101456_dedupe_exact_nutrition_items.sql`
- `supabase/migrations/20260625102009_correct_june25_salmon_hipro.sql`
- `supabase/migrations/20260627225157_fix_trip_rpc_mobile_online_and_photo_foods.sql`
- `supabase/migrations/20260627233128_add_mixed_red_berries_food.sql`
- `supabase/migrations/20260628002020_asset_budget_and_work_career_v2.sql`
- `supabase/migrations/20260628051630_link_work_days_and_add_beef_stew.sql`
- `supabase/migrations/20260630053802_repair_trip_linked_payment_budget_flags.sql`
- `supabase/migrations/20260702082000_track_transaction_paid_at.sql`
- `supabase/migrations/20260703122116_harden_recurring_budget_periods.sql`
- `supabase/migrations/20260703123153_trim_recurring_occurrences_over_limit.sql`
- `supabase/migrations/20260703123941_secure_wallet_views.sql`
- `supabase/migrations/20260704223726_preserve_recurring_budget_dates.sql`
- `supabase/migrations/20260706083000_complete_a1_workout_progression.sql`
- `supabase/migrations/20260712004235_asset_transaction_links_budget_policy.sql`
- `supabase/migrations/20260716090801_sport_volume_intensity_program.sql`
- `supabase/migrations/20260716091238_sport_integrate_a3_b3_volume_intensity.sql`
- `supabase/migrations/20260716092537_sport_tune_volume_intensity_loads.sql`
- `supabase/migrations/20260716101927_sport_update_ab_program_push_posterior_variant.sql`

## Android et budgets de modules

- Dossier Android : présent
- Configuration Capacitor : présente
- Projet Gradle : présent
- Contrôle des budgets de modules : présent
- Documentation des budgets : présente

## Documents d'architecture et de navigation

- `docs/ARCHITECTURE_DECISIONS.md`
- `docs/MANUAL_TESTS.md`
- `docs/PROJECT_ATLAS.md`
- `docs/README.md`
- `docs/V11_ARCHITECTURE.md`
- `docs/V11_DATA_LAYER.md`
- `docs/V11_PERFORMANCE_BUDGETS.md`
- `docs/V11_REFACTOR_CHECKLIST.md`
- `docs/V11_UI_COMPONENTS.md`
- `docs/deployment_settings_checklist.md`

## Matrice d'impact déclarée

Cette matrice est générée à partir des impacts validés humainement dans les dix fiches critiques. Le script ne les infère pas depuis le code.

| Fonction critique | Wallet | Budget journalier | Analyse | Trip | Offline | Android |
|---|---|---|---|---|---|---|
| [`analysis.budget-actual`](../features/budget-analysis.md) | — | ✓ | ✓ | ✓ | Possible | ✓ |
| [`assets.movement`](../features/asset-movement.md) | ✓ | ✓ | ✓ | Possible | ✓ | ✓ |
| [`budget.daily`](../features/daily-budget.md) | Possible | ✓ | ✓ | ✓ | ✓ | ✓ |
| [`budget.transaction`](../features/transactions.md) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| [`nutrition.meal`](../features/nutrition-meal.md) | — | — | KPI | — | ✓ | ✓ |
| [`sport.session`](../features/sport-session.md) | — | — | KPI | — | ✓ | ✓ |
| [`sync.offline`](../features/offline-sync.md) | ✓ | ✓ | Possible | ✓ | ✓ | ✓ |
| [`trip.budget-link`](../features/trip-budget-link.md) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| [`wallet.balance`](../features/wallet-balance.md) | ✓ | Possible | Possible | Possible | ✓ | ✓ |
| [`work.income`](../features/work-income.md) | Possible | ✓ | ✓ | — | ✓ | ✓ |
