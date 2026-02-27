window.__TB_BUILD = '6.6.42';
/* =========================
   Constants (V6.5)
   - Single source of truth for DB identifiers & UI labels
   - No raw table/column/localStorage keys in UI code (use TB_CONST.*)
   ========================= */
(function () {
  const TABLES = Object.freeze({
    profiles: "profiles",
    settings: "settings",
    periods: "periods",
    wallets: "wallets",
    transactions: "transactions",
    categories: "categories",
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
  });

  const COLS = Object.freeze({
    id: "id",
    user_id: "user_id",
    created_at: "created_at",
    updated_at: "updated_at",
    start_date: "start_date",
    end_date: "end_date",
    period_id: "period_id",
    wallet_id: "wallet_id",
    currency: "currency",
    amount: "amount",
    type: "type",
    category: "category",
    label: "label",
    fx_mode: "fx_mode",
    fx_rate_eur_to_base: "fx_rate_eur_to_base",
    fx_source: "fx_source",
    fx_last_updated_at: "fx_last_updated_at",
    fx_rate_snapshot: "fx_rate_snapshot",
    fx_source_snapshot: "fx_source_snapshot",
  });

  const LS_KEYS = Object.freeze({
    theme: "travelbudget_theme_v1",
    palette: "travelbudget_palette_v1",
    preset: "travelbudget_palette_preset_v1",
    eur_rates: "EUR_RATES",
    pie_excluded_cats: "travelbudget_pie_excluded_categories_v1",
    debug: "travelbudget_debug_v1",
  });

  const UI_LABELS = Object.freeze({
    voyage: "Voyage",
    periode: "Période",
    segments: "Périodes",
  });

  // DB schema_version is stored as an integer in public.schema_version.version (see SQL.sql context)
  // Convention: 6.5.0 => 650
  const EXPECTED_SCHEMA_VERSION = 650;

  window.TB_CONST = Object.freeze({
    TABLES,
    COLS,
    LS_KEYS,
    UI_LABELS,
    EXPECTED_SCHEMA_VERSION,
  });
})();
