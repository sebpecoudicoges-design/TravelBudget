window.__TB_BUILD = '9.4.1.8';
/* =========================
   Constants
   - Single source of truth for DB identifiers & UI labels
   - No raw table/column/localStorage keys in UI code (use TB_CONST.*)
   ========================= */
(function () {
  const TABLES = Object.freeze({
    profiles: "profiles",
    settings: "settings",
    travels: "travels",
    periods: "periods",
    wallets: "wallets",
    transactions: "transactions",
    recurring_rules: "recurring_rules",
    categories: "categories",
    category_subcategories: "category_subcategories",
    budget_segments: "budget_segments",
    trip_groups: "trip_groups",
    trip_expenses: "trip_expenses",
    trip_participants: "trip_participants",
    trip_members: "trip_members",
    schema_version: "schema_version",

    trip_invites: "trip_invites",
    trip_expense_shares: "trip_expense_shares",
    trip_expense_budget_links: "trip_expense_budget_links",
    trip_settlements: "trip_settlements",
    trip_settlement_events: "trip_settlement_events",
    v_trip_user_net_balances: "v_trip_user_net_balances",
    v_wallet_balances: "v_wallet_balances",
    v_wallet_transactions_effect: "v_wallet_transactions_effect",
    analytic_category_mappings: "analytic_category_mappings",
    v_transaction_analytic_mapping: "v_transaction_analytic_mapping",
    v_analytic_mapping_audit: "v_analytic_mapping_audit",
    v_transaction_analytic_expenses: "v_transaction_analytic_expenses",

    fx_manual_rates: "fx_manual_rates",
    travel_budget_reference_profile: "travel_budget_reference_profile",
    budget_segment_budget_reference_override: "budget_segment_budget_reference_override",
    v_country_budget_reference_latest: "v_country_budget_reference_latest",
  });

  const COLS = Object.freeze({
    id: "id",
    user_id: "user_id",
    created_at: "created_at",
    updated_at: "updated_at",

    name: "name",

    start_date: "start_date",
    end_date: "end_date",

    travel_id: "travel_id",
    period_id: "period_id",
    wallet_id: "wallet_id",

    currency: "currency",
    base_currency: "base_currency",

    amount: "amount",
    type: "type",
    category: "category",
    subcategory: "subcategory",
    label: "label",

    fx_mode: "fx_mode",
    fx_rate_eur_to_base: "fx_rate_eur_to_base",
    fx_source: "fx_source",
    fx_last_updated_at: "fx_last_updated_at",
    fx_rate_snapshot: "fx_rate_snapshot",
    fx_source_snapshot: "fx_source_snapshot",

    recurring_rule_id: "recurring_rule_id",
    occurrence_date: "occurrence_date",
    generated_by_rule: "generated_by_rule",
    recurring_instance_status: "recurring_instance_status",

    archived: "archived",
    archived_at: "archived_at",

    is_active: "is_active",
    next_due_at: "next_due_at",

    date_start: "date_start",
    date_end: "date_end",
    transport_night_budget: "transport_night_budget",
  });

  const RPCS = Object.freeze({
    accept_trip_invite: "accept_trip_invite",
    bind_trip_member_to_auth: "bind_trip_member_to_auth",
    apply_transaction_v2: "apply_transaction_v2",
    apply_transaction: "apply_transaction",
    delete_transaction: "delete_transaction",

    trip_get_balances_v1: "trip_get_balances_v1",
    trip_apply_expense_v1: "trip_apply_expense_v1",
    trip_apply_expense_v2: "trip_apply_expense_v2",
    trip_delete_expense_v1: "trip_delete_expense_v1",
    trip_suggest_settlements_v1: "trip_suggest_settlements_v1",
    trip_create_settlement_v1: "trip_create_settlement_v1",
    trip_cancel_settlement_v1: "trip_cancel_settlement_v1",

    recurring_generate_all_active: "recurring_generate_all_active",
    recurring_generate_for_rule: "recurring_generate_for_rule",
    recurring_delete_rule: "recurring_delete_rule",
    recurring_delete_rule_admin: "recurring_delete_rule_admin",

    budget_reference_compute_for_travel: "rpc_budget_reference_compute_for_travel",
    budget_reference_compute_for_budget_segment: "rpc_budget_reference_compute_for_budget_segment",
    budget_reference_resolve_for_budget_segment: "rpc_budget_reference_resolve_for_budget_segment",
    save_analytic_mapping_rule: "save_analytic_mapping_rule",
    delete_category_bundle: "delete_category_bundle",
    seed_default_categories_for_user: "seed_default_categories_for_user",
    seed_default_analytic_category_mappings: "seed_default_analytic_category_mappings",

    // legacy fallback (older DB)
    trip_accept_invite: "trip_accept_invite",
    trip_bind_member_to_auth: "trip_bind_member_to_auth",
  });

  const TRIP = Object.freeze({
    ROLES: Object.freeze({
      owner: "owner",
      admin: "admin",
      member: "member",
      viewer: "viewer",
    }),
    SETTLEMENT_METHODS: Object.freeze({
      cash: "cash",
      revolut: "revolut",
      paypal: "paypal",
      lydia: "lydia",
      other: "other",
    }),
  });

  const RECURRING = Object.freeze({
    INSTANCE_STATUS: Object.freeze({
      generated: "generated",
      confirmed: "confirmed",
      detached: "detached",
      skipped: "skipped",
    }),
    DELETE_MODES: Object.freeze({
      rule_only: "rule_only",
      rule_and_future: "rule_and_future",
      rule_and_future_and_unconfirmed_past: "rule_and_future_and_unconfirmed_past",
    }),
  });

  // Common category labels used by legacy flows (keep centralized: no magic strings)
  const CATS = Object.freeze({
    internal_movement: "Mouvement interne",
    trip: "Trip",
    other: "Autre",
    wallet_adjustment: "Ajustement wallet",
  });

  const LS_KEYS = Object.freeze({
    theme: "travelbudget_theme_v1",
    palette: "travelbudget_palette_v1",
    preset: "travelbudget_palette_preset_v1",

    // Auto FX (EUR→XXX) cache
    eur_rates: "EUR_RATES",
    eur_rates_asof: "travelbudget_fx_eur_rates_asof_v1",
    eur_rates_keys: "travelbudget_fx_eur_rates_keys_v1",
    fx_last_daily: "travelbudget_fx_last_daily_v1",

    // Manual FX fallbacks (EUR→XXX)
    fx_manual_rates: "travelbudget_fx_manual_rates_v1",
    fx_manual_asof: "travelbudget_fx_manual_asof_v1",
    fx_manual_prompted_day: "travelbudget_fx_manual_prompted_day_v1",

    // Charts filtering
    pie_excluded_cats: "travelbudget_pie_excluded_categories_v1",

    // Cashflow chart threshold (stored as EUR reference, converted to account base currency)
    cashflow_threshold_eur: "travelbudget_cashflow_threshold_eur_v1",

    // Dashboard wallets order
    wallet_order: "travelbudget_wallet_order_v2",

    // Debug
    debug: "travelbudget_debug_v1",

    // KPIs scope (single source of truth for scope across KPI + cashflow curve)
    kpi_projection_scope: "travelbudget_kpi_projection_scope_v1",
    kpi_projection_include_unpaid: "travelbudget_kpi_projection_include_unpaid_v1",

    // Period names (local fallback, since DB periods table has no name column)
    period_names: "travelbudget_period_names_v1",

    // Assistant (offline) persistence
    assist_thread: "travelbudget_assist_thread_v1",
    assist_open: "travelbudget_assist_open_v1",
    assist_ctx_open: "travelbudget_assist_ctx_open_v1",

    // KPI FX calculator (local-only)
    fx_calc_amount: "travelbudget_fx_calc_amount_v1",
    fx_calc_from: "travelbudget_fx_calc_from_v1",
    fx_calc_to: "travelbudget_fx_calc_to_v1",

    // UX contextual help / onboarding dismiss state
    ux_help_dismissed: "travelbudget_ux_help_dismissed_v1",

    // UI mode
    ui_mode: "travelbudget_ui_mode_v1",
  });



  const ANALYSIS = Object.freeze({
    SOURCED_CATEGORY_MAPPING: Object.freeze({
      logement: Object.freeze({ compare_mode: "mapped", sourced_bucket: "Logement" }),
      repas: Object.freeze({ compare_mode: "mapped", sourced_bucket: "Repas" }),
      course: Object.freeze({ compare_mode: "mapped", sourced_bucket: "Repas" }),
      transport: Object.freeze({ compare_mode: "mapped", sourced_bucket: "Transport" }),

      sorties: Object.freeze({ compare_mode: "mapped", sourced_bucket: "Activités" }),
      cadeau: Object.freeze({ compare_mode: "mapped", sourced_bucket: "Activités" }),
      laundry: Object.freeze({ compare_mode: "mapped", sourced_bucket: "Activités" }),
      autre: Object.freeze({ compare_mode: "mapped", sourced_bucket: "Activités" }),
      "abonnement/mobile": Object.freeze({ compare_mode: "mapped", sourced_bucket: "Activités" }),

      "transport internationale": Object.freeze({ compare_mode: "excluded" }),
      "transport international": Object.freeze({ compare_mode: "excluded" }),
      visa: Object.freeze({ compare_mode: "excluded" }),
      santé: Object.freeze({ compare_mode: "excluded" }),
      sante: Object.freeze({ compare_mode: "excluded" }),
      "projet personnel": Object.freeze({ compare_mode: "excluded" }),
      souvenir: Object.freeze({ compare_mode: "excluded" }),
      caution: Object.freeze({ compare_mode: "excluded" }),
      revenu: Object.freeze({ compare_mode: "excluded" }),
      "frais bancaire": Object.freeze({ compare_mode: "excluded" }),
    }),
  });

  const UI_LABELS = Object.freeze({
    voyage: "Voyage",
    periode: "Période",
    segments: "Périodes",
    travels: "Voyages",
    recurring_rules: "Échéances périodiques",
  });

  // DB schema_version is stored as an integer in public.schema_version.version
  // Convention: 9.0.0 => 900
  const EXPECTED_SCHEMA_VERSION = 94000;

  window.TB_CONST = Object.freeze({
    TABLES,
    COLS,
    LS_KEYS,
    RPCS,
    TRIP,
    RECURRING,
    CATS,
    UI_LABELS,
    ANALYSIS,
    EXPECTED_SCHEMA_VERSION,
  });

  // Convenience aliases (avoid raw strings in code):
  // - Prefer TB_CONST.TABLES / TB_CONST.LS_KEYS directly.
  // - TB_TABLES / TB_KEYS are provided for readability in legacy files.
  window.TB_TABLES = window.TB_CONST.TABLES;
  window.TB_COLS = window.TB_CONST.COLS;
  window.TB_KEYS = window.TB_CONST.LS_KEYS;

  window.tbResolveTransactionTravelId = function tbResolveTransactionTravelId(tx) {
    try {
      const direct = String(tx?.travel_id || tx?.travelId || '').trim();
      if (direct) return direct;
      const periodId = String(tx?.period_id || tx?.periodId || '').trim();
      if (!periodId) return '';
      const periods = Array.isArray(window.state?.periods) ? window.state.periods : [];
      const row = periods.find((p) => String(p?.id || p?.periodId || '').trim() === periodId);
      return String(row?.travel_id || row?.travelId || '').trim();
    } catch (_) {
      return '';
    }
  };
})();