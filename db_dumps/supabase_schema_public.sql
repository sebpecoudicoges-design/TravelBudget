


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."_touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."_touch_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."accept_trip_invite"("p_token" "text") RETURNS TABLE("trip_id" "uuid", "member_id" "uuid", "role" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_trip_id uuid;
  v_role text;
  v_member_id uuid;
  v_existing_role text;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select ti.trip_id, ti.role, ti.member_id
    into v_trip_id, v_role, v_member_id
  from public.trip_invites ti
  where ti.token = p_token
    and ti.used_at is null
    and ti.expires_at > now()
  for update;

  if v_trip_id is null then
    raise exception 'invalid/expired/used token';
  end if;

  -- Ensure participant (RLS authority)
  select tp.role into v_existing_role
  from public.trip_participants tp
  where tp.trip_id = v_trip_id
    and tp.auth_user_id = v_uid
  limit 1;

  if v_existing_role is null then
    insert into public.trip_participants(trip_id, auth_user_id, role)
    values (v_trip_id, v_uid, v_role);
  else
    update public.trip_participants tp
    set role = case
      when tp.role = 'owner' then 'owner'
      when tp.role = 'member' then 'member'
      when v_role = 'member' then 'member'
      else 'viewer'
    end
    where tp.trip_id = v_trip_id
      and tp.auth_user_id = v_uid;
  end if;

  -- Bind placeholder member if provided
  if v_member_id is not null then
    update public.trip_members tm
    set auth_user_id = v_uid,
        user_id = v_uid, -- satisfy NOT NULL
        email = coalesce(nullif(v_email,''), tm.email),
        is_me = false
    where tm.id = v_member_id
      and tm.trip_id = v_trip_id
    returning tm.id into v_member_id;

    if v_member_id is null then
      v_member_id := null;
    end if;
  end if;

  -- fallback: create/reuse member for this auth user
  if v_member_id is null then
    insert into public.trip_members(trip_id, auth_user_id, user_id, name, email, is_me)
    values (v_trip_id, v_uid, v_uid, coalesce(nullif(v_email,''), 'Me'), nullif(v_email,''), false)
    on conflict on constraint trip_members_trip_auth_user_key
    do update set
      auth_user_id = excluded.auth_user_id,
      user_id = excluded.user_id,
      email = coalesce(excluded.email, public.trip_members.email)
    returning id into v_member_id;
  end if;

  update public.trip_invites
  set used_at = now()
  where token = p_token
    and used_at is null;

  return query select v_trip_id, v_member_id, v_role;
end;
$$;


ALTER FUNCTION "public"."accept_trip_invite"("p_token" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."apply_transaction"("p_wallet_id" "uuid", "p_type" "text", "p_amount" numeric, "p_currency" "text", "p_category" "text", "p_label" "text", "p_date_start" "date", "p_date_end" "date", "p_pay_now" boolean, "p_out_of_budget" boolean, "p_night_covered" boolean) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  perform public.apply_transaction_v2(
    p_wallet_id => p_wallet_id,
    p_type => coalesce(p_type, 'expense'),
    p_label => coalesce(p_label, ''),
    p_amount => p_amount,
    p_currency => coalesce(p_currency, 'EUR'),
    p_date_start => p_date_start,
    p_date_end => coalesce(p_date_end, p_date_start),
    p_category => coalesce(p_category, 'Autre'),
    p_subcategory => null,
    p_pay_now => coalesce(p_pay_now, false),
    p_out_of_budget => coalesce(p_out_of_budget, false),
    p_night_covered => coalesce(p_night_covered, false),
    p_affects_budget => case when coalesce(p_out_of_budget, false) then false else true end,
    p_trip_expense_id => null,
    p_trip_share_link_id => null,
    p_fx_rate_snapshot => null,
    p_fx_source_snapshot => null,
    p_fx_snapshot_at => null,
    p_fx_base_currency_snapshot => null,
    p_fx_tx_currency_snapshot => null,
    p_user_id => null,
    p_budget_date_start => p_date_start,
    p_budget_date_end => coalesce(p_date_end, p_date_start)
  );
end;
$$;


ALTER FUNCTION "public"."apply_transaction"("p_wallet_id" "uuid", "p_type" "text", "p_amount" numeric, "p_currency" "text", "p_category" "text", "p_label" "text", "p_date_start" "date", "p_date_end" "date", "p_pay_now" boolean, "p_out_of_budget" boolean, "p_night_covered" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."apply_transaction"("p_amount" numeric, "p_category" "text", "p_currency" "text", "p_date_end" "date", "p_date_start" "date", "p_label" "text", "p_out_of_budget" boolean, "p_pay_now" boolean, "p_subcategory" "text", "p_trip_expense_id" "uuid", "p_trip_share_link_id" "uuid", "p_type" "text", "p_user_id" "uuid", "p_wallet_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  perform public.apply_transaction_v2(
    p_wallet_id => p_wallet_id,
    p_type => coalesce(p_type, 'expense'),
    p_label => coalesce(p_label, ''),
    p_amount => p_amount,
    p_currency => coalesce(p_currency, 'EUR'),
    p_date_start => p_date_start,
    p_date_end => coalesce(p_date_end, p_date_start),
    p_category => coalesce(p_category, 'Autre'),
    p_subcategory => nullif(trim(coalesce(p_subcategory, '')), ''),
    p_pay_now => coalesce(p_pay_now, false),
    p_out_of_budget => coalesce(p_out_of_budget, false),
    p_night_covered => false,
    p_affects_budget => case when coalesce(p_out_of_budget, false) then false else true end,
    p_trip_expense_id => nullif(p_trip_expense_id, '00000000-0000-0000-0000-000000000000'::uuid),
    p_trip_share_link_id => nullif(p_trip_share_link_id, '00000000-0000-0000-0000-000000000000'::uuid),
    p_fx_rate_snapshot => null,
    p_fx_source_snapshot => null,
    p_fx_snapshot_at => null,
    p_fx_base_currency_snapshot => null,
    p_fx_tx_currency_snapshot => null,
    p_user_id => null,
    p_budget_date_start => p_date_start,
    p_budget_date_end => coalesce(p_date_end, p_date_start)
  );
end;
$$;


ALTER FUNCTION "public"."apply_transaction"("p_amount" numeric, "p_category" "text", "p_currency" "text", "p_date_end" "date", "p_date_start" "date", "p_label" "text", "p_out_of_budget" boolean, "p_pay_now" boolean, "p_subcategory" "text", "p_trip_expense_id" "uuid", "p_trip_share_link_id" "uuid", "p_type" "text", "p_user_id" "uuid", "p_wallet_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."apply_transaction_v2"("p_wallet_id" "uuid", "p_type" "text", "p_label" "text", "p_amount" numeric, "p_currency" "text", "p_date_start" "date", "p_date_end" "date", "p_category" "text", "p_subcategory" "text", "p_pay_now" boolean, "p_out_of_budget" boolean, "p_night_covered" boolean, "p_affects_budget" boolean, "p_trip_expense_id" "uuid", "p_trip_share_link_id" "uuid", "p_fx_rate_snapshot" numeric, "p_fx_source_snapshot" "text", "p_fx_snapshot_at" timestamp with time zone, "p_fx_base_currency_snapshot" "text", "p_fx_tx_currency_snapshot" "text", "p_user_id" "uuid" DEFAULT NULL::"uuid", "p_budget_date_start" "date" DEFAULT NULL::"date", "p_budget_date_end" "date" DEFAULT NULL::"date") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_period_id uuid;
  v_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select w.period_id into v_period_id
  from public.wallets w
  where w.id = p_wallet_id and w.user_id = v_user_id;

  if v_period_id is null then
    raise exception 'Wallet not found or not owned';
  end if;

  insert into public.transactions (
    user_id, wallet_id, period_id,
    type, label, amount, currency,
    date_start, date_end,
    budget_date_start, budget_date_end,
    category, subcategory,
    pay_now, out_of_budget, night_covered,
    affects_budget,
    trip_expense_id, trip_share_link_id,
    fx_rate_snapshot, fx_source_snapshot, fx_snapshot_at,
    fx_base_currency_snapshot, fx_tx_currency_snapshot
  ) values (
    v_user_id, p_wallet_id, v_period_id,
    p_type, p_label, p_amount, p_currency,
    p_date_start, coalesce(p_date_end, p_date_start),
    coalesce(p_budget_date_start, p_date_start),
    coalesce(p_budget_date_end, p_budget_date_start, p_date_end, p_date_start),
    p_category, p_subcategory,
    p_pay_now, p_out_of_budget, p_night_covered,
    p_affects_budget,
    nullif(p_trip_expense_id, '00000000-0000-0000-0000-000000000000'::uuid),
    nullif(p_trip_share_link_id, '00000000-0000-0000-0000-000000000000'::uuid),
    p_fx_rate_snapshot, p_fx_source_snapshot, p_fx_snapshot_at,
    p_fx_base_currency_snapshot, p_fx_tx_currency_snapshot
  )
  returning id into v_id;

  return v_id;
end;
$$;


ALTER FUNCTION "public"."apply_transaction_v2"("p_wallet_id" "uuid", "p_type" "text", "p_label" "text", "p_amount" numeric, "p_currency" "text", "p_date_start" "date", "p_date_end" "date", "p_category" "text", "p_subcategory" "text", "p_pay_now" boolean, "p_out_of_budget" boolean, "p_night_covered" boolean, "p_affects_budget" boolean, "p_trip_expense_id" "uuid", "p_trip_share_link_id" "uuid", "p_fx_rate_snapshot" numeric, "p_fx_source_snapshot" "text", "p_fx_snapshot_at" timestamp with time zone, "p_fx_base_currency_snapshot" "text", "p_fx_tx_currency_snapshot" "text", "p_user_id" "uuid", "p_budget_date_start" "date", "p_budget_date_end" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bind_trip_member_to_auth"("p_trip_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_member_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  -- already bound by auth_user_id
  select id into v_member_id
  from public.trip_members
  where trip_id = p_trip_id
    and auth_user_id = v_uid
  limit 1;

  if v_member_id is not null then
    update public.trip_members
    set user_id = v_uid,
        email = coalesce(nullif(v_email,''), email)
    where id = v_member_id;
    return v_member_id;
  end if;

  -- If a placeholder exists with same email, bind it instead of inserting
  if v_email <> '' then
    select id into v_member_id
    from public.trip_members
    where trip_id = p_trip_id
      and lower(email) = v_email
    order by created_at asc
    limit 1;

    if v_member_id is not null then
      update public.trip_members
      set auth_user_id = v_uid,
          user_id = v_uid,
          email = v_email
      where id = v_member_id;

      return v_member_id;
    end if;
  end if;

  -- Otherwise create a new member row
  insert into public.trip_members(trip_id, auth_user_id, user_id, name, email, is_me)
  values (
    p_trip_id,
    v_uid,
    v_uid,
    coalesce(nullif(v_email,''), 'Me'),
    nullif(v_email,''),
    false
  )
  on conflict on constraint trip_members_trip_auth_user_key
  do update set
    auth_user_id = excluded.auth_user_id,
    user_id = excluded.user_id,
    email = coalesce(excluded.email, public.trip_members.email)
  returning id into v_member_id;

  return v_member_id;
end;
$$;


ALTER FUNCTION "public"."bind_trip_member_to_auth"("p_trip_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_access_travel"("p_travel_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.travels t
    where t.id = p_travel_id
      and t.user_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."can_access_travel"("p_travel_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_category_bundle"("p_category_name" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_actor uuid := auth.uid();
  v_category text := nullif(trim(p_category_name), '');
  v_deleted_mappings integer := 0;
  v_deleted_subcategories integer := 0;
  v_deleted_categories integer := 0;
begin
  if v_actor is null then
    raise exception 'Not authenticated';
  end if;

  if v_category is null then
    raise exception 'category_name is required';
  end if;

  delete from public.analytic_category_mappings m
  where m.user_id = v_actor
    and lower(trim(m.category_name)) = lower(v_category);
  get diagnostics v_deleted_mappings = row_count;

  delete from public.category_subcategories s
  where s.user_id = v_actor
    and lower(trim(s.category_name)) = lower(v_category);
  get diagnostics v_deleted_subcategories = row_count;

  delete from public.categories c
  where c.user_id = v_actor
    and lower(trim(c.name)) = lower(v_category);
  get diagnostics v_deleted_categories = row_count;

  return jsonb_build_object(
    'category_name', v_category,
    'deleted_mappings', v_deleted_mappings,
    'deleted_subcategories', v_deleted_subcategories,
    'deleted_categories', v_deleted_categories
  );
end;
$$;


ALTER FUNCTION "public"."delete_category_bundle"("p_category_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_transaction"("p_tx_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_count int;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  delete from public.transactions t
  where t.id = p_tx_id
    and t.user_id = v_user_id;

  get diagnostics v_count = row_count;

  if v_count = 0 then
    raise exception 'Transaction not found or not owned';
  end if;
end;
$$;


ALTER FUNCTION "public"."delete_transaction"("p_tx_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_tx_wallet_period_match"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  w_period uuid;
begin
  select period_id into w_period
  from public.wallets
  where id = new.wallet_id;

  if w_period is null then
    raise exception 'Wallet introuvable';
  end if;

  if new.period_id is null then
    raise exception 'Transaction.period_id manquant';
  end if;

  if new.period_id <> w_period then
    raise exception 'period_id mismatch: tx=% wallet=%', new.period_id, w_period;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."enforce_tx_wallet_period_match"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_period_for_travel_date"("p_travel_id" "uuid", "p_date" "date") RETURNS "uuid"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public'
    AS $$
declare
  v_period_id uuid;
begin
  if p_travel_id is null then
    return null;
  end if;

  if p_date is null then
    return null;
  end if;

  select p.id
    into v_period_id
  from public.periods p
  where p.travel_id = p_travel_id
    and p_date between p.start_date and p.end_date
  order by p.start_date desc
  limit 1;

  return v_period_id;
end;
$$;


ALTER FUNCTION "public"."get_period_for_travel_date"("p_travel_id" "uuid", "p_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_unmapped_transaction_categories"() RETURNS TABLE("category" "text", "subcategory" "text", "tx_count" bigint, "expense_amount_sum" numeric)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    v.category,
    v.subcategory,
    count(*) as tx_count,
    coalesce(sum(case when v.type = 'expense' then v.amount else 0 end), 0) as expense_amount_sum
  from public.v_transaction_analytic_mapping v
  where v.user_id = auth.uid()
    and v.mapping_status = 'unmapped'
  group by v.category, v.subcategory
  order by tx_count desc, category asc, subcategory asc nulls first;
$$;


ALTER FUNCTION "public"."get_unmapped_transaction_categories"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_trip_participant"("p_trip_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1 from public.trip_participants tp
    where tp.trip_id = p_trip_id
      and tp.auth_user_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."is_trip_participant"("p_trip_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."nth_weekday_of_month"("p_year" integer, "p_month" integer, "p_weekday" integer, "p_week_of_month" integer) RETURNS "date"
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
declare
  v_first_day date;
  v_first_weekday integer;
  v_offset integer;
  v_result date;
begin
  if p_month < 1 or p_month > 12 then
    raise exception 'invalid month %', p_month;
  end if;

  if p_weekday < 0 or p_weekday > 6 then
    raise exception 'invalid weekday %', p_weekday;
  end if;

  if p_week_of_month < 1 or p_week_of_month > 5 then
    raise exception 'invalid week_of_month %', p_week_of_month;
  end if;

  v_first_day := make_date(p_year, p_month, 1);
  v_first_weekday := extract(dow from v_first_day)::integer;

  v_offset := (p_weekday - v_first_weekday + 7) % 7;
  v_result := v_first_day + v_offset + ((p_week_of_month - 1) * 7);

  if extract(month from v_result)::integer <> p_month then
    return null;
  end if;

  return v_result;
end;
$$;


ALTER FUNCTION "public"."nth_weekday_of_month"("p_year" integer, "p_month" integer, "p_weekday" integer, "p_week_of_month" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_fx_snapshot_update"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  -- For each snapshot field:
  -- - if old is NOT NULL and new differs => forbidden
  -- - if old is NULL => allow fill

  if old.fx_rate_snapshot is not null and new.fx_rate_snapshot is distinct from old.fx_rate_snapshot then
    raise exception 'FX snapshot is immutable once set (fx_rate_snapshot)';
  end if;

  if old.fx_source_snapshot is not null and new.fx_source_snapshot is distinct from old.fx_source_snapshot then
    raise exception 'FX snapshot is immutable once set (fx_source_snapshot)';
  end if;

  if old.fx_snapshot_at is not null and new.fx_snapshot_at is distinct from old.fx_snapshot_at then
    raise exception 'FX snapshot is immutable once set (fx_snapshot_at)';
  end if;

  if old.fx_base_currency_snapshot is not null and new.fx_base_currency_snapshot is distinct from old.fx_base_currency_snapshot then
    raise exception 'FX snapshot is immutable once set (fx_base_currency_snapshot)';
  end if;

  if old.fx_tx_currency_snapshot is not null and new.fx_tx_currency_snapshot is distinct from old.fx_tx_currency_snapshot then
    raise exception 'FX snapshot is immutable once set (fx_tx_currency_snapshot)';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."prevent_fx_snapshot_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recurring_cleanup_rule_occurrences"("p_rule_id" "uuid", "p_mode" "text") RETURNS TABLE("rule_id" "uuid", "deleted_count" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_rule public.recurring_rules%rowtype;
  v_deleted integer := 0;
  v_today date := current_date;
begin
  select *
    into v_rule
  from public.recurring_rules
  where id = p_rule_id;

  if not found then
    raise exception 'recurring rule not found';
  end if;

  if p_mode not in ('rule_only','rule_and_future','rule_and_future_and_unconfirmed_past') then
    raise exception 'invalid cleanup mode %', p_mode;
  end if;

  if p_mode = 'rule_only' then
    return query select v_rule.id, 0;
    return;
  end if;

  if p_mode = 'rule_and_future' then
    delete from public.transactions t
    where t.recurring_rule_id = v_rule.id
      and t.occurrence_date >= v_today
      and coalesce(t.pay_now, false) = false
      and coalesce(t.recurring_instance_status, 'generated') in ('generated', 'skipped');

    get diagnostics v_deleted = row_count;
    return query select v_rule.id, v_deleted;
    return;
  end if;

  delete from public.transactions t
  where t.recurring_rule_id = v_rule.id
    and coalesce(t.pay_now, false) = false
    and coalesce(t.recurring_instance_status, 'generated') in ('generated', 'skipped');

  get diagnostics v_deleted = row_count;
  return query select v_rule.id, v_deleted;
end;
$$;


ALTER FUNCTION "public"."recurring_cleanup_rule_occurrences"("p_rule_id" "uuid", "p_mode" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recurring_delete_rule"("p_rule_id" "uuid", "p_mode" "text" DEFAULT 'rule_only'::"text") RETURNS TABLE("rule_id" "uuid", "deleted_occurrences" integer, "deleted_rule" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_rule public.recurring_rules%rowtype;
  v_deleted integer := 0;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select *
    into v_rule
  from public.recurring_rules r
  where r.id = p_rule_id
    and r.user_id = v_uid;

  if not found then
    raise exception 'recurring rule not found or not owned';
  end if;

  select deleted_count
    into v_deleted
  from public.recurring_cleanup_rule_occurrences(v_rule.id, p_mode);

  update public.recurring_rules r
  set
    is_active = false,
    archived = true,
    archived_at = now(),
    updated_at = now()
  where r.id = v_rule.id
    and r.user_id = v_uid;

  return query
  select v_rule.id, coalesce(v_deleted, 0), true;
end;
$$;


ALTER FUNCTION "public"."recurring_delete_rule"("p_rule_id" "uuid", "p_mode" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recurring_delete_rule_admin"("p_rule_id" "uuid", "p_mode" "text" DEFAULT 'rule_only'::"text") RETURNS TABLE("rule_id" "uuid", "deleted_occurrences" integer, "deleted_rule" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_rule public.recurring_rules%rowtype;
  v_deleted integer := 0;
begin
  select *
    into v_rule
  from public.recurring_rules r
  where r.id = p_rule_id;

  if not found then
    raise exception 'recurring rule not found';
  end if;

  select deleted_count
    into v_deleted
  from public.recurring_cleanup_rule_occurrences(v_rule.id, p_mode);

  update public.recurring_rules r
  set
    is_active = false,
    archived = true,
    archived_at = now(),
    updated_at = now()
  where r.id = v_rule.id;

  return query
  select v_rule.id, coalesce(v_deleted, 0), true;
end;
$$;


ALTER FUNCTION "public"."recurring_delete_rule_admin"("p_rule_id" "uuid", "p_mode" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recurring_generate_all_active"() RETURNS TABLE("rule_id" "uuid", "inserted_count" integer, "skipped_duplicates" integer, "generated_until" "date", "next_due_at" "date")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  rec record;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  for rec in
    select r.id
    from public.recurring_rules r
    where r.user_id = v_uid
      and r.is_active = true
      and coalesce(r.archived, false) = false
    order by r.created_at asc
  loop
    return query
    select *
    from public.recurring_generate_for_rule(rec.id);
  end loop;
end;
$$;


ALTER FUNCTION "public"."recurring_generate_all_active"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recurring_generate_for_rule"("p_rule_id" "uuid") RETURNS TABLE("rule_id" "uuid", "inserted_count" integer, "skipped_duplicates" integer, "generated_until" "date", "next_due_at" "date")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  r public.recurring_rules%rowtype;
  v_travel_end date;
  v_horizon date;
  v_due date;
  v_next_due date;
  v_period_id uuid;
  v_inserted integer := 0;
  v_skipped integer := 0;
begin
  select * into r
  from public.recurring_rules
  where id = p_rule_id;

  if not found then
    raise exception 'recurring rule not found';
  end if;

  if not r.is_active or coalesce(r.archived, false) then
    return query
    select r.id, 0, 0, r.generated_until, r.next_due_at;
    return;
  end if;

  select t.end_date into v_travel_end
  from public.travels t
  where t.id = r.travel_id
    and t.user_id = r.user_id;

  if not found then
    raise exception 'travel not found for recurring rule';
  end if;

  if v_travel_end is null then
    raise exception 'travel.end_date is required';
  end if;

  v_horizon := v_travel_end;
  if r.end_date is not null and r.end_date < v_horizon then
    v_horizon := r.end_date;
  end if;

  v_due := coalesce(r.next_due_at, r.start_date);
  if v_due < r.start_date then
    v_due := r.start_date;
  end if;

  while v_due is not null and v_due <= v_horizon loop

    v_period_id := public.get_period_for_travel_date(r.travel_id, v_due);

    if v_period_id is null then
      raise exception 'no period for date %', v_due;
    end if;

    begin
      insert into public.transactions (
        user_id,
        wallet_id,
        period_id,
        travel_id,
        type,
        amount,
        currency,
        category,
        subcategory,
        label,
        date_start,
        date_end,
        budget_date_start,
        budget_date_end,
        pay_now,
        out_of_budget,
        night_covered,
        affects_budget,
        created_at,
        updated_at,
        recurring_rule_id,
        occurrence_date,
        generated_by_rule,
        recurring_instance_status,
        is_internal
      ) values (
        r.user_id,
        r.wallet_id,
        v_period_id,
        r.travel_id,
        r.type,
        r.amount,
        r.currency,
        coalesce(r.category, case when r.type = 'income' then 'Revenu' else 'Autre' end),
        r.subcategory,
        r.label,
        v_due,
        v_due,
        v_due, -- 🔥 FIX
        v_due, -- 🔥 FIX
        false,
        coalesce(r.out_of_budget, false),
        false,
        not coalesce(r.out_of_budget, false),
        now(),
        now(),
        r.id,
        v_due,
        true,
        'generated',
        false
      );

      v_inserted := v_inserted + 1;

    exception
      when unique_violation then
        v_skipped := v_skipped + 1;
    end;

    v_next_due := public.recurring_next_occurrence(
      r.rule_type,
      r.interval_count,
      r.weekday,
      r.monthday,
      r.week_of_month,
      v_due
    );

    if v_next_due is null then
      exit;
    end if;

    v_due := v_next_due;

  end loop;

  update public.recurring_rules rr
  set generated_until = v_horizon,
      next_due_at = case when v_due is null then rr.next_due_at else v_due end,
      updated_at = now()
  where rr.id = r.id;

  return query
  select r.id, v_inserted, v_skipped, v_horizon, v_due;

end;
$$;


ALTER FUNCTION "public"."recurring_generate_for_rule"("p_rule_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recurring_next_occurrence"("p_rule_type" "text", "p_interval_count" integer, "p_weekday" integer, "p_monthday" integer, "p_week_of_month" integer, "p_current" "date") RETURNS "date"
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
declare
  v_current date := p_current;
  v_candidate date;
  v_target_month date;
  v_year integer;
  v_month integer;
  v_last_day integer;
begin
  if v_current is null then
    return null;
  end if;

  if p_interval_count is null or p_interval_count < 1 then
    raise exception 'interval_count must be >= 1';
  end if;

  case p_rule_type
    when 'daily' then
      return v_current + p_interval_count;

    when 'weekly' then
      return v_current + (7 * p_interval_count);

    when 'monthly' then
      v_target_month := (date_trunc('month', v_current)::date
                        + make_interval(months => p_interval_count))::date;
      v_last_day := extract(day from ((date_trunc('month', v_target_month)::date + interval '1 month - 1 day')::date))::integer;
      return make_date(
        extract(year from v_target_month)::integer,
        extract(month from v_target_month)::integer,
        least(extract(day from v_current)::integer, v_last_day)
      );

    when 'every_x_months' then
      v_target_month := (date_trunc('month', v_current)::date
                        + make_interval(months => p_interval_count))::date;
      v_last_day := extract(day from ((date_trunc('month', v_target_month)::date + interval '1 month - 1 day')::date))::integer;
      return make_date(
        extract(year from v_target_month)::integer,
        extract(month from v_target_month)::integer,
        least(coalesce(p_monthday, extract(day from v_current)::integer), v_last_day)
      );

    when 'yearly' then
      v_year := extract(year from v_current)::integer + p_interval_count;
      v_month := extract(month from v_current)::integer;
      v_last_day := extract(day from ((make_date(v_year, v_month, 1) + interval '1 month - 1 day')::date))::integer;
      return make_date(
        v_year,
        v_month,
        least(extract(day from v_current)::integer, v_last_day)
      );

    when 'nth_weekday_month' then
      v_target_month := (date_trunc('month', v_current)::date
                        + make_interval(months => p_interval_count))::date;
      v_candidate := public.nth_weekday_of_month(
        extract(year from v_target_month)::integer,
        extract(month from v_target_month)::integer,
        p_weekday,
        p_week_of_month
      );
      return v_candidate;

    else
      raise exception 'unsupported rule_type %', p_rule_type;
  end case;
end;
$$;


ALTER FUNCTION "public"."recurring_next_occurrence"("p_rule_type" "text", "p_interval_count" integer, "p_weekday" integer, "p_monthday" integer, "p_week_of_month" integer, "p_current" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recurring_pause_rule"("p_rule_id" "uuid") RETURNS TABLE("rule_id" "uuid", "is_active" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_rule_id uuid;
  v_is_active boolean;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  update public.recurring_rules r
  set is_active = false,
      updated_at = now()
  where r.id = p_rule_id
    and r.user_id = v_uid
  returning r.id, r.is_active
  into v_rule_id, v_is_active;

  if not found then
    raise exception 'recurring rule not found or not owned';
  end if;

  return query
  select v_rule_id, v_is_active;
end;
$$;


ALTER FUNCTION "public"."recurring_pause_rule"("p_rule_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recurring_pause_rule_admin"("p_rule_id" "uuid") RETURNS TABLE("rule_id" "uuid", "is_active" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_rule public.recurring_rules%rowtype;
begin
  select *
    into v_rule
  from public.recurring_rules r
  where r.id = p_rule_id;

  if not found then
    raise exception 'recurring rule not found';
  end if;

  update public.recurring_rules r
  set is_active = false,
      updated_at = now()
  where r.id = v_rule.id;

  return query
  select v_rule.id, false;
end;
$$;


ALTER FUNCTION "public"."recurring_pause_rule_admin"("p_rule_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recurring_resume_rule"("p_rule_id" "uuid") RETURNS TABLE("rule_id" "uuid", "is_active" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_rule public.recurring_rules%rowtype;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select *
    into v_rule
  from public.recurring_rules r
  where r.id = p_rule_id
    and r.user_id = v_uid;

  if not found then
    raise exception 'recurring rule not found or not owned';
  end if;

  update public.recurring_rules r
  set is_active = true,
      next_due_at = coalesce(r.next_due_at, r.start_date),
      updated_at = now()
  where r.id = v_rule.id
    and r.user_id = v_uid;

  perform public.recurring_generate_for_rule(v_rule.id);

  return query
  select v_rule.id, true;
end;
$$;


ALTER FUNCTION "public"."recurring_resume_rule"("p_rule_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recurring_resume_rule_admin"("p_rule_id" "uuid") RETURNS TABLE("rule_id" "uuid", "is_active" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_rule public.recurring_rules%rowtype;
begin
  select *
    into v_rule
  from public.recurring_rules r
  where r.id = p_rule_id;

  if not found then
    raise exception 'recurring rule not found';
  end if;

  update public.recurring_rules r
  set is_active = true,
      next_due_at = coalesce(r.next_due_at, r.start_date),
      updated_at = now()
  where r.id = v_rule.id;

  return query
  select v_rule.id, true;
end;
$$;


ALTER FUNCTION "public"."recurring_resume_rule_admin"("p_rule_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recurring_rules_consistency_guard"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_wallet_user_id uuid;
  v_wallet_travel_id uuid;
  v_travel_end_date date;
  v_cap date;
begin
  select w.user_id, w.travel_id
    into v_wallet_user_id, v_wallet_travel_id
  from public.wallets w
  where w.id = new.wallet_id;

  if v_wallet_user_id is null then
    raise exception 'recurring_rule.wallet_id invalid';
  end if;

  if v_wallet_user_id <> new.user_id then
    raise exception 'recurring_rule wallet user_id mismatch';
  end if;

  if v_wallet_travel_id <> new.travel_id then
    raise exception 'recurring_rule wallet travel_id mismatch';
  end if;

  select t.end_date
    into v_travel_end_date
  from public.travels t
  where t.id = new.travel_id
    and t.user_id = new.user_id;

  if not found then
    raise exception 'recurring_rule travel invalid or not owned';
  end if;

  if new.end_date is not null and new.end_date < new.start_date then
    raise exception 'recurring_rule end_date before start_date';
  end if;

  if new.next_due_at is null or new.next_due_at < new.start_date then
    new.next_due_at := new.start_date;
  end if;

  v_cap := v_travel_end_date;
  if new.end_date is not null and (v_cap is null or new.end_date < v_cap) then
    v_cap := new.end_date;
  end if;

  if new.generated_until is not null and v_cap is not null and new.generated_until > v_cap then
    new.generated_until := v_cap;
  end if;

  if new.next_due_at is not null and v_cap is not null and new.next_due_at > v_cap then
    new.next_due_at := v_cap;
  end if;

  if new.end_date is not null and v_travel_end_date is not null and new.end_date > v_travel_end_date then
    raise exception 'recurring_rule end_date exceeds travel end_date';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."recurring_rules_consistency_guard"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_budget_reference_compute_for_budget_segment"("p_budget_segment_id" "uuid", "p_country_code" "text" DEFAULT NULL::"text", "p_region_code" "text" DEFAULT NULL::"text", "p_travel_profile" "text" DEFAULT NULL::"text", "p_travel_style" "text" DEFAULT NULL::"text", "p_adult_count" integer DEFAULT NULL::integer, "p_child_count" integer DEFAULT NULL::integer, "p_trip_days" integer DEFAULT NULL::integer, "p_traveler_age_min" integer DEFAULT NULL::integer, "p_traveler_age_max" integer DEFAULT NULL::integer, "p_save" boolean DEFAULT false, "p_disable_override" boolean DEFAULT false) RETURNS TABLE("budget_segment_id" "uuid", "period_id" "uuid", "travel_id" "uuid", "resolution_level" "text", "reference_id" "uuid", "country_code" "text", "country_name" "text", "region_code" "text", "source_name" "text", "source_url" "text", "source_year" integer, "currency_code" "text", "travel_profile" "text", "travel_style" "text", "adult_count" integer, "child_count" integer, "trip_days" integer, "traveler_age_min" integer, "traveler_age_max" integer, "base_daily_reference_amount" numeric, "profile_multiplier" numeric, "style_multiplier" numeric, "duration_multiplier" numeric, "recommended_daily_amount" numeric, "recommended_accommodation_daily_amount" numeric, "recommended_food_daily_amount" numeric, "recommended_transport_daily_amount" numeric, "recommended_activities_daily_amount" numeric, "recommended_misc_daily_amount" numeric, "source_mode" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_request_uid uuid := auth.uid();
  v_seg record;
  v_travel_default public.travel_budget_reference_profile%rowtype;
  v_eff_country text;
  v_eff_region text;
  v_eff_profile text;
  v_eff_style text;
  v_eff_adult integer;
  v_eff_child integer;
  v_eff_trip_days integer;
  v_eff_age_min integer;
  v_eff_age_max integer;
  v_calc record;
  v_resolution text := 'travel_default';
begin
  select bs.id as budget_segment_id,
         bs.period_id,
         bs.start_date,
         bs.end_date,
         p.travel_id,
         t.user_id
    into v_seg
  from public.budget_segments bs
  join public.periods p on p.id = bs.period_id
  join public.travels t on t.id = p.travel_id
  where bs.id = p_budget_segment_id
    and (v_request_uid is null or t.user_id = v_request_uid)
  limit 1;

  if not found then
    raise exception 'Budget segment not found or not owned by current user';
  end if;

  select * into v_travel_default
  from public.travel_budget_reference_profile tbr
  where tbr.travel_id = v_seg.travel_id
  limit 1;

  if p_disable_override then
    delete from public.budget_segment_budget_reference_override bro
    where bro.budget_segment_id = v_seg.budget_segment_id
      and bro.user_id = v_seg.user_id;

    return query
    select
      resolved.budget_segment_id,
      resolved.period_id,
      resolved.travel_id,
      resolved.resolution_level,
      resolved.reference_id,
      resolved.country_code,
      resolved.country_name,
      resolved.region_code,
      resolved.source_name,
      resolved.source_url,
      resolved.source_year,
      resolved.currency_code,
      resolved.travel_profile,
      resolved.travel_style,
      resolved.adult_count,
      resolved.child_count,
      resolved.trip_days,
      resolved.traveler_age_min,
      resolved.traveler_age_max,
      resolved.base_daily_reference_amount,
      resolved.profile_multiplier,
      resolved.style_multiplier,
      resolved.duration_multiplier,
      resolved.recommended_daily_amount,
      resolved.recommended_accommodation_daily_amount,
      resolved.recommended_food_daily_amount,
      resolved.recommended_transport_daily_amount,
      resolved.recommended_activities_daily_amount,
      resolved.recommended_misc_daily_amount,
      resolved.source_mode
    from public.rpc_budget_reference_resolve_for_budget_segment(v_seg.budget_segment_id) resolved;
    return;
  end if;

  v_eff_country := coalesce(nullif(trim(p_country_code), ''), v_travel_default.country_code);
  v_eff_region := coalesce(nullif(trim(p_region_code), ''), v_travel_default.region_code);
  v_eff_profile := coalesce(nullif(trim(p_travel_profile), ''), v_travel_default.travel_profile, 'solo');
  v_eff_style := coalesce(nullif(trim(p_travel_style), ''), v_travel_default.travel_style, 'standard');
  v_eff_adult := coalesce(p_adult_count, v_travel_default.adult_count, 1);
  v_eff_child := coalesce(p_child_count, v_travel_default.child_count, 0);
  v_eff_trip_days := coalesce(p_trip_days, (v_seg.end_date - v_seg.start_date + 1));
  v_eff_age_min := coalesce(p_traveler_age_min, v_travel_default.traveler_age_min);
  v_eff_age_max := coalesce(p_traveler_age_max, v_travel_default.traveler_age_max);

  if v_eff_country is null then
    raise exception 'No effective country reference found for this visible period. Configure the travel default or provide a segment country.';
  end if;

  select * into v_calc
  from public.rpc_budget_reference_compute_values(
    v_eff_country,
    v_eff_region,
    v_eff_profile,
    v_eff_style,
    v_eff_adult,
    v_eff_child,
    v_eff_trip_days,
    v_eff_age_min,
    v_eff_age_max
  );

  if p_save then
    insert into public.budget_segment_budget_reference_override (
      user_id,
      budget_segment_id,
      period_id,
      travel_id,
      reference_id,
      is_enabled,
      country_code,
      region_code,
      travel_profile,
      travel_style,
      adult_count,
      child_count,
      trip_days,
      traveler_age_min,
      traveler_age_max,
      base_daily_reference_amount,
      style_multiplier,
      profile_multiplier,
      duration_multiplier,
      recommended_daily_amount,
      recommended_accommodation_daily_amount,
      recommended_food_daily_amount,
      recommended_transport_daily_amount,
      recommended_activities_daily_amount,
      recommended_misc_daily_amount,
      source_mode
    ) values (
      v_seg.user_id,
      v_seg.budget_segment_id,
      v_seg.period_id,
      v_seg.travel_id,
      v_calc.reference_id,
      true,
      v_calc.country_code,
      v_calc.region_code,
      v_eff_profile,
      v_eff_style,
      v_eff_adult,
      v_eff_child,
      v_eff_trip_days,
      v_eff_age_min,
      v_eff_age_max,
      v_calc.base_daily_reference_amount,
      v_calc.style_multiplier,
      v_calc.profile_multiplier,
      v_calc.duration_multiplier,
      v_calc.recommended_daily_amount,
      v_calc.recommended_accommodation_daily_amount,
      v_calc.recommended_food_daily_amount,
      v_calc.recommended_transport_daily_amount,
      v_calc.recommended_activities_daily_amount,
      v_calc.recommended_misc_daily_amount,
      'reference_applied'
    )
    on conflict on constraint budget_segment_budget_reference_override_one_per_segment
    do update set
      user_id = excluded.user_id,
      period_id = excluded.period_id,
      travel_id = excluded.travel_id,
      reference_id = excluded.reference_id,
      is_enabled = excluded.is_enabled,
      country_code = excluded.country_code,
      region_code = excluded.region_code,
      travel_profile = excluded.travel_profile,
      travel_style = excluded.travel_style,
      adult_count = excluded.adult_count,
      child_count = excluded.child_count,
      trip_days = excluded.trip_days,
      traveler_age_min = excluded.traveler_age_min,
      traveler_age_max = excluded.traveler_age_max,
      base_daily_reference_amount = excluded.base_daily_reference_amount,
      style_multiplier = excluded.style_multiplier,
      profile_multiplier = excluded.profile_multiplier,
      duration_multiplier = excluded.duration_multiplier,
      recommended_daily_amount = excluded.recommended_daily_amount,
      recommended_accommodation_daily_amount = excluded.recommended_accommodation_daily_amount,
      recommended_food_daily_amount = excluded.recommended_food_daily_amount,
      recommended_transport_daily_amount = excluded.recommended_transport_daily_amount,
      recommended_activities_daily_amount = excluded.recommended_activities_daily_amount,
      recommended_misc_daily_amount = excluded.recommended_misc_daily_amount,
      source_mode = excluded.source_mode,
      updated_at = now();
    v_resolution := 'segment_override';
  end if;

  return query
  select
    v_seg.budget_segment_id,
    v_seg.period_id,
    v_seg.travel_id,
    v_resolution,
    v_calc.reference_id,
    v_calc.country_code,
    v_calc.country_name,
    v_calc.region_code,
    v_calc.source_name,
    v_calc.source_url,
    v_calc.source_year,
    v_calc.currency_code,
    v_eff_profile,
    v_eff_style,
    v_eff_adult,
    v_eff_child,
    v_eff_trip_days,
    v_eff_age_min,
    v_eff_age_max,
    v_calc.base_daily_reference_amount,
    v_calc.profile_multiplier,
    v_calc.style_multiplier,
    v_calc.duration_multiplier,
    v_calc.recommended_daily_amount,
    v_calc.recommended_accommodation_daily_amount,
    v_calc.recommended_food_daily_amount,
    v_calc.recommended_transport_daily_amount,
    v_calc.recommended_activities_daily_amount,
    v_calc.recommended_misc_daily_amount,
    'reference_applied';
end;
$$;


ALTER FUNCTION "public"."rpc_budget_reference_compute_for_budget_segment"("p_budget_segment_id" "uuid", "p_country_code" "text", "p_region_code" "text", "p_travel_profile" "text", "p_travel_style" "text", "p_adult_count" integer, "p_child_count" integer, "p_trip_days" integer, "p_traveler_age_min" integer, "p_traveler_age_max" integer, "p_save" boolean, "p_disable_override" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_budget_reference_compute_for_period"("p_period_id" "uuid", "p_country_code" "text" DEFAULT NULL::"text", "p_region_code" "text" DEFAULT NULL::"text", "p_travel_profile" "text" DEFAULT NULL::"text", "p_travel_style" "text" DEFAULT NULL::"text", "p_adult_count" integer DEFAULT NULL::integer, "p_child_count" integer DEFAULT NULL::integer, "p_trip_days" integer DEFAULT NULL::integer, "p_traveler_age_min" integer DEFAULT NULL::integer, "p_traveler_age_max" integer DEFAULT NULL::integer, "p_save" boolean DEFAULT false, "p_use_period_override" boolean DEFAULT true, "p_disable_period_override" boolean DEFAULT false) RETURNS TABLE("period_id" "uuid", "travel_id" "uuid", "reference_id" "uuid", "country_code" "text", "country_name" "text", "region_code" "text", "source_name" "text", "source_url" "text", "source_year" integer, "currency_code" "text", "base_daily_reference_amount" numeric, "profile_multiplier" numeric, "style_multiplier" numeric, "duration_multiplier" numeric, "recommended_daily_amount" numeric, "recommended_accommodation_daily_amount" numeric, "recommended_food_daily_amount" numeric, "recommended_transport_daily_amount" numeric, "recommended_activities_daily_amount" numeric, "recommended_misc_daily_amount" numeric, "source_mode" "text", "has_period_override" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_request_uid uuid := auth.uid();
  v_period public.periods%rowtype;
  v_travel public.travels%rowtype;
  v_default public.travel_budget_reference_profile%rowtype;
  v_override public.period_budget_reference_override%rowtype;
  v_country_code text;
  v_region_code text;
  v_travel_profile text;
  v_travel_style text;
  v_adult_count integer;
  v_child_count integer;
  v_trip_days integer;
  v_age_min integer;
  v_age_max integer;
  v_calc record;
  v_has_override boolean := false;
begin
  select *
    into v_period
  from public.periods p
  where p.id = p_period_id
    and (v_request_uid is null or p.user_id = v_request_uid)
  limit 1;

  if not found then
    raise exception 'Period not found or not owned by current user';
  end if;

  select * into v_travel
  from public.travels t
  where t.id = v_period.travel_id;

  select * into v_default
  from public.travel_budget_reference_profile tbp
  where tbp.travel_id = v_period.travel_id
    and tbp.user_id = v_period.user_id;

  select * into v_override
  from public.period_budget_reference_override pbo
  where pbo.period_id = v_period.id
    and pbo.user_id = v_period.user_id;

  if p_disable_period_override then
    if p_save then
      delete from public.period_budget_reference_override
      where period_id = v_period.id
        and user_id = v_period.user_id;
    end if;
    v_override := null;
  end if;

  v_has_override := (v_override.id is not null and coalesce(v_override.is_enabled, true));

  v_country_code := coalesce(
    p_country_code,
    case when p_use_period_override and v_has_override then v_override.country_code end,
    v_default.country_code
  );
  v_region_code := coalesce(
    p_region_code,
    case when p_use_period_override and v_has_override then v_override.region_code end,
    v_default.region_code
  );
  v_travel_profile := coalesce(
    p_travel_profile,
    case when p_use_period_override and v_has_override then v_override.travel_profile end,
    v_default.travel_profile,
    'solo'
  );
  v_travel_style := coalesce(
    p_travel_style,
    case when p_use_period_override and v_has_override then v_override.travel_style end,
    v_default.travel_style,
    'standard'
  );
  v_adult_count := coalesce(
    p_adult_count,
    case when p_use_period_override and v_has_override then v_override.adult_count end,
    v_default.adult_count,
    1
  );
  v_child_count := coalesce(
    p_child_count,
    case when p_use_period_override and v_has_override then v_override.child_count end,
    v_default.child_count,
    0
  );
  v_trip_days := coalesce(
    p_trip_days,
    case when p_use_period_override and v_has_override then v_override.trip_days end,
    v_default.trip_days,
    (v_period.end_date - v_period.start_date + 1)
  );
  v_age_min := coalesce(
    p_traveler_age_min,
    case when p_use_period_override and v_has_override then v_override.traveler_age_min end,
    v_default.traveler_age_min
  );
  v_age_max := coalesce(
    p_traveler_age_max,
    case when p_use_period_override and v_has_override then v_override.traveler_age_max end,
    v_default.traveler_age_max
  );

  if v_country_code is null or btrim(v_country_code) = '' then
    raise exception 'No budget reference country configured for this period or its parent travel';
  end if;

  select *
    into v_calc
  from public.rpc_budget_reference_compute_values(
    v_country_code,
    v_region_code,
    v_travel_profile,
    v_travel_style,
    v_adult_count,
    v_child_count,
    v_trip_days,
    v_age_min,
    v_age_max
  );

  if p_save then
    insert into public.period_budget_reference_override (
      user_id,
      period_id,
      travel_id,
      reference_id,
      is_enabled,
      country_code,
      region_code,
      travel_profile,
      travel_style,
      adult_count,
      child_count,
      trip_days,
      traveler_age_min,
      traveler_age_max,
      base_daily_reference_amount,
      style_multiplier,
      profile_multiplier,
      duration_multiplier,
      recommended_daily_amount,
      recommended_accommodation_daily_amount,
      recommended_food_daily_amount,
      recommended_transport_daily_amount,
      recommended_activities_daily_amount,
      recommended_misc_daily_amount,
      source_mode
    ) values (
      v_period.user_id,
      v_period.id,
      v_period.travel_id,
      v_calc.reference_id,
      true,
      v_country_code,
      v_region_code,
      v_travel_profile,
      v_travel_style,
      v_adult_count,
      v_child_count,
      v_trip_days,
      v_age_min,
      v_age_max,
      v_calc.base_daily_reference_amount,
      v_calc.style_multiplier,
      v_calc.profile_multiplier,
      v_calc.duration_multiplier,
      v_calc.recommended_daily_amount,
      v_calc.recommended_accommodation_daily_amount,
      v_calc.recommended_food_daily_amount,
      v_calc.recommended_transport_daily_amount,
      v_calc.recommended_activities_daily_amount,
      v_calc.recommended_misc_daily_amount,
      'reference_applied'
    )
    on conflict (period_id)
    do update set
      user_id = excluded.user_id,
      travel_id = excluded.travel_id,
      reference_id = excluded.reference_id,
      is_enabled = excluded.is_enabled,
      country_code = excluded.country_code,
      region_code = excluded.region_code,
      travel_profile = excluded.travel_profile,
      travel_style = excluded.travel_style,
      adult_count = excluded.adult_count,
      child_count = excluded.child_count,
      trip_days = excluded.trip_days,
      traveler_age_min = excluded.traveler_age_min,
      traveler_age_max = excluded.traveler_age_max,
      base_daily_reference_amount = excluded.base_daily_reference_amount,
      style_multiplier = excluded.style_multiplier,
      profile_multiplier = excluded.profile_multiplier,
      duration_multiplier = excluded.duration_multiplier,
      recommended_daily_amount = excluded.recommended_daily_amount,
      recommended_accommodation_daily_amount = excluded.recommended_accommodation_daily_amount,
      recommended_food_daily_amount = excluded.recommended_food_daily_amount,
      recommended_transport_daily_amount = excluded.recommended_transport_daily_amount,
      recommended_activities_daily_amount = excluded.recommended_activities_daily_amount,
      recommended_misc_daily_amount = excluded.recommended_misc_daily_amount,
      source_mode = excluded.source_mode,
      updated_at = now();

    v_has_override := true;
  end if;

  return query
  select
    v_period.id,
    v_period.travel_id,
    v_calc.reference_id,
    v_calc.country_code,
    v_calc.country_name,
    v_calc.region_code,
    v_calc.source_name,
    v_calc.source_url,
    v_calc.source_year,
    v_calc.currency_code,
    v_calc.base_daily_reference_amount,
    v_calc.profile_multiplier,
    v_calc.style_multiplier,
    v_calc.duration_multiplier,
    v_calc.recommended_daily_amount,
    v_calc.recommended_accommodation_daily_amount,
    v_calc.recommended_food_daily_amount,
    v_calc.recommended_transport_daily_amount,
    v_calc.recommended_activities_daily_amount,
    v_calc.recommended_misc_daily_amount,
    case when p_save then 'reference_applied' else v_calc.source_mode end,
    v_has_override;
end;
$$;


ALTER FUNCTION "public"."rpc_budget_reference_compute_for_period"("p_period_id" "uuid", "p_country_code" "text", "p_region_code" "text", "p_travel_profile" "text", "p_travel_style" "text", "p_adult_count" integer, "p_child_count" integer, "p_trip_days" integer, "p_traveler_age_min" integer, "p_traveler_age_max" integer, "p_save" boolean, "p_use_period_override" boolean, "p_disable_period_override" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_budget_reference_compute_for_travel"("p_travel_id" "uuid", "p_country_code" "text", "p_region_code" "text" DEFAULT NULL::"text", "p_travel_profile" "text" DEFAULT 'solo'::"text", "p_travel_style" "text" DEFAULT 'standard'::"text", "p_adult_count" integer DEFAULT 1, "p_child_count" integer DEFAULT 0, "p_trip_days" integer DEFAULT NULL::integer, "p_traveler_age_min" integer DEFAULT NULL::integer, "p_traveler_age_max" integer DEFAULT NULL::integer, "p_save" boolean DEFAULT false) RETURNS TABLE("travel_id" "uuid", "reference_id" "uuid", "country_code" "text", "country_name" "text", "region_code" "text", "source_name" "text", "source_url" "text", "source_year" integer, "currency_code" "text", "base_daily_reference_amount" numeric, "profile_multiplier" numeric, "style_multiplier" numeric, "duration_multiplier" numeric, "recommended_daily_amount" numeric, "recommended_accommodation_daily_amount" numeric, "recommended_food_daily_amount" numeric, "recommended_transport_daily_amount" numeric, "recommended_activities_daily_amount" numeric, "recommended_misc_daily_amount" numeric, "source_mode" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_request_uid uuid := auth.uid();
  v_travel public.travels%rowtype;
  v_calc record;
begin
  select *
    into v_travel
  from public.travels t
  where t.id = p_travel_id
    and (v_request_uid is null or t.user_id = v_request_uid)
  limit 1;

  if not found then
    raise exception 'Travel not found or not owned by current user';
  end if;

  select *
    into v_calc
  from public.rpc_budget_reference_compute_values(
    p_country_code,
    p_region_code,
    p_travel_profile,
    p_travel_style,
    p_adult_count,
    p_child_count,
    coalesce(p_trip_days, (v_travel.end_date - v_travel.start_date + 1)),
    p_traveler_age_min,
    p_traveler_age_max
  );

  if p_save then
    insert into public.travel_budget_reference_profile (
      user_id,
      travel_id,
      reference_id,
      country_code,
      region_code,
      travel_profile,
      travel_style,
      adult_count,
      child_count,
      trip_days,
      traveler_age_min,
      traveler_age_max,
      base_daily_reference_amount,
      style_multiplier,
      profile_multiplier,
      duration_multiplier,
      recommended_daily_amount,
      recommended_accommodation_daily_amount,
      recommended_food_daily_amount,
      recommended_transport_daily_amount,
      recommended_activities_daily_amount,
      recommended_misc_daily_amount,
      source_mode
    ) values (
      v_travel.user_id,
      v_travel.id,
      v_calc.reference_id,
      v_calc.country_code,
      v_calc.region_code,
      p_travel_profile,
      p_travel_style,
      p_adult_count,
      p_child_count,
      coalesce(p_trip_days, (v_travel.end_date - v_travel.start_date + 1)),
      p_traveler_age_min,
      p_traveler_age_max,
      v_calc.base_daily_reference_amount,
      v_calc.style_multiplier,
      v_calc.profile_multiplier,
      v_calc.duration_multiplier,
      v_calc.recommended_daily_amount,
      v_calc.recommended_accommodation_daily_amount,
      v_calc.recommended_food_daily_amount,
      v_calc.recommended_transport_daily_amount,
      v_calc.recommended_activities_daily_amount,
      v_calc.recommended_misc_daily_amount,
      'reference_applied'
    )
    on conflict on constraint travel_budget_reference_profile_one_per_travel
    do update set
      user_id = excluded.user_id,
      reference_id = excluded.reference_id,
      country_code = excluded.country_code,
      region_code = excluded.region_code,
      travel_profile = excluded.travel_profile,
      travel_style = excluded.travel_style,
      adult_count = excluded.adult_count,
      child_count = excluded.child_count,
      trip_days = excluded.trip_days,
      traveler_age_min = excluded.traveler_age_min,
      traveler_age_max = excluded.traveler_age_max,
      base_daily_reference_amount = excluded.base_daily_reference_amount,
      style_multiplier = excluded.style_multiplier,
      profile_multiplier = excluded.profile_multiplier,
      duration_multiplier = excluded.duration_multiplier,
      recommended_daily_amount = excluded.recommended_daily_amount,
      recommended_accommodation_daily_amount = excluded.recommended_accommodation_daily_amount,
      recommended_food_daily_amount = excluded.recommended_food_daily_amount,
      recommended_transport_daily_amount = excluded.recommended_transport_daily_amount,
      recommended_activities_daily_amount = excluded.recommended_activities_daily_amount,
      recommended_misc_daily_amount = excluded.recommended_misc_daily_amount,
      source_mode = excluded.source_mode,
      updated_at = now();
  end if;

  return query
  select
    v_travel.id,
    v_calc.reference_id,
    v_calc.country_code,
    v_calc.country_name,
    v_calc.region_code,
    v_calc.source_name,
    v_calc.source_url,
    v_calc.source_year,
    v_calc.currency_code,
    v_calc.base_daily_reference_amount,
    v_calc.profile_multiplier,
    v_calc.style_multiplier,
    v_calc.duration_multiplier,
    v_calc.recommended_daily_amount,
    v_calc.recommended_accommodation_daily_amount,
    v_calc.recommended_food_daily_amount,
    v_calc.recommended_transport_daily_amount,
    v_calc.recommended_activities_daily_amount,
    v_calc.recommended_misc_daily_amount,
    case when p_save then 'reference_applied' else v_calc.source_mode end;
end;
$$;


ALTER FUNCTION "public"."rpc_budget_reference_compute_for_travel"("p_travel_id" "uuid", "p_country_code" "text", "p_region_code" "text", "p_travel_profile" "text", "p_travel_style" "text", "p_adult_count" integer, "p_child_count" integer, "p_trip_days" integer, "p_traveler_age_min" integer, "p_traveler_age_max" integer, "p_save" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_budget_reference_compute_values"("p_country_code" "text", "p_region_code" "text" DEFAULT NULL::"text", "p_travel_profile" "text" DEFAULT 'solo'::"text", "p_travel_style" "text" DEFAULT 'standard'::"text", "p_adult_count" integer DEFAULT 1, "p_child_count" integer DEFAULT 0, "p_trip_days" integer DEFAULT NULL::integer, "p_traveler_age_min" integer DEFAULT NULL::integer, "p_traveler_age_max" integer DEFAULT NULL::integer) RETURNS TABLE("reference_id" "uuid", "country_code" "text", "country_name" "text", "region_code" "text", "source_name" "text", "source_url" "text", "source_year" integer, "currency_code" "text", "base_daily_reference_amount" numeric, "profile_multiplier" numeric, "style_multiplier" numeric, "duration_multiplier" numeric, "recommended_daily_amount" numeric, "recommended_accommodation_daily_amount" numeric, "recommended_food_daily_amount" numeric, "recommended_transport_daily_amount" numeric, "recommended_activities_daily_amount" numeric, "recommended_misc_daily_amount" numeric, "source_mode" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_ref public.country_budget_reference%rowtype;

  v_people_count integer := greatest(coalesce(p_adult_count, 1), 1) + greatest(coalesce(p_child_count, 0), 0);

  v_base numeric;
  v_profile_mult numeric := 1.0000;
  v_style_mult numeric := 1.0000;
  v_duration_mult numeric := 1.0000;

  v_recommended_daily numeric;

  v_breakdown_total numeric := 0;
  v_weight_accommodation numeric := 0;
  v_weight_food numeric := 0;
  v_weight_transport numeric := 0;
  v_weight_activities numeric := 0;
  v_weight_misc numeric := 0;

  v_rec_accommodation numeric;
  v_rec_food numeric;
  v_rec_transport numeric;
  v_rec_activities numeric;
  v_rec_misc numeric;

  v_source_mode text := 'reference_suggested';
begin
  if p_country_code is null or btrim(p_country_code) = '' then
    raise exception 'country_code is required';
  end if;

  if p_travel_profile not in ('solo','couple','family') then
    raise exception 'Invalid travel_profile: %', p_travel_profile;
  end if;

  if p_travel_style not in ('budget','standard','comfort') then
    raise exception 'Invalid travel_style: %', p_travel_style;
  end if;

  if coalesce(p_adult_count, 0) < 1 then
    raise exception 'adult_count must be >= 1';
  end if;

  if coalesce(p_child_count, 0) < 0 then
    raise exception 'child_count must be >= 0';
  end if;

  select cbr.*
    into v_ref
  from public.v_country_budget_reference_latest cbr
  where cbr.country_code = upper(trim(p_country_code))
    and (
      (p_region_code is null and cbr.region_code is null)
      or cbr.region_code = p_region_code
    )
  order by
    case when p_region_code is not null and cbr.region_code = p_region_code then 0 else 1 end,
    cbr.source_published_at desc nulls last,
    cbr.created_at desc
  limit 1;

  if not found then
    raise exception 'No active budget reference found for country_code=%', p_country_code;
  end if;

  /*
    Base totale résolue:
    - solo: solo_daily_amount si dispo, sinon daily_budget_amount
    - couple: couple_per_person_daily_amount * nb adultes si dispo, sinon daily_budget_amount * nb adultes
    - family: family_per_person_daily_amount * nb personnes si dispo, sinon daily_budget_amount * nb personnes

    NB:
    - on ne "double" pas via profile_multiplier ensuite
    - le multiplicateur de profil reste informatif = 1.00
  */
  if p_travel_profile = 'solo' then
    v_base := coalesce(v_ref.solo_daily_amount, v_ref.daily_budget_amount);

  elsif p_travel_profile = 'couple' then
    if v_ref.couple_per_person_daily_amount is not null then
      v_base := v_ref.couple_per_person_daily_amount * greatest(coalesce(p_adult_count, 2), 2);
    else
      v_base := coalesce(v_ref.daily_budget_amount, 0) * greatest(coalesce(p_adult_count, 2), 2);
    end if;

  elsif p_travel_profile = 'family' then
    if v_ref.family_per_person_daily_amount is not null then
      v_base := v_ref.family_per_person_daily_amount * v_people_count;
    else
      v_base := coalesce(v_ref.daily_budget_amount, 0) * v_people_count;
    end if;
  end if;

  if v_base is null then
    raise exception 'Reference found but no usable daily amount for country_code=%', p_country_code;
  end if;

  v_profile_mult := 1.00;

  v_style_mult :=
    case p_travel_style
      when 'budget' then 0.85
      when 'standard' then 1.00
      when 'comfort' then 1.25
      else 1.00
    end;

  if p_trip_days is not null then
    if p_trip_days <= 14 then
      if v_ref.short_trip_daily_amount is not null and v_ref.daily_budget_amount is not null and v_ref.daily_budget_amount > 0 then
        v_duration_mult := v_ref.short_trip_daily_amount / v_ref.daily_budget_amount;
      else
        v_duration_mult := 1.10;
      end if;
    elsif p_trip_days >= 90 then
      if v_ref.long_trip_daily_amount is not null and v_ref.daily_budget_amount is not null and v_ref.daily_budget_amount > 0 then
        v_duration_mult := v_ref.long_trip_daily_amount / v_ref.daily_budget_amount;
      else
        v_duration_mult := 0.90;
      end if;
    else
      v_duration_mult := 1.00;
    end if;
  end if;

  v_recommended_daily := round((v_base * v_style_mult * v_duration_mult)::numeric, 2);

  /*
    Nouveau principe:
    les catégories détaillées représentent la structure du budget de base "daily_budget_amount".
    On re-proratise donc leur poids sur le total résolu final.
  */
  v_breakdown_total :=
      coalesce(v_ref.accommodation_daily_amount, 0)
    + coalesce(v_ref.food_daily_amount, 0)
    + coalesce(v_ref.transport_daily_amount, 0)
    + coalesce(v_ref.activities_daily_amount, 0)
    + coalesce(v_ref.misc_daily_amount, 0);

  if v_breakdown_total > 0 then
    v_weight_accommodation := coalesce(v_ref.accommodation_daily_amount, 0) / v_breakdown_total;
    v_weight_food          := coalesce(v_ref.food_daily_amount, 0) / v_breakdown_total;
    v_weight_transport     := coalesce(v_ref.transport_daily_amount, 0) / v_breakdown_total;
    v_weight_activities    := coalesce(v_ref.activities_daily_amount, 0) / v_breakdown_total;
    v_weight_misc          := coalesce(v_ref.misc_daily_amount, 0) / v_breakdown_total;

    v_rec_accommodation := round((v_recommended_daily * v_weight_accommodation)::numeric, 2);
    v_rec_food          := round((v_recommended_daily * v_weight_food)::numeric, 2);
    v_rec_transport     := round((v_recommended_daily * v_weight_transport)::numeric, 2);
    v_rec_activities    := round((v_recommended_daily * v_weight_activities)::numeric, 2);

    -- misc = reste pour garantir la somme exacte
    v_rec_misc := round((
        v_recommended_daily
      - coalesce(v_rec_accommodation, 0)
      - coalesce(v_rec_food, 0)
      - coalesce(v_rec_transport, 0)
      - coalesce(v_rec_activities, 0)
    )::numeric, 2);
  else
    v_rec_accommodation := null;
    v_rec_food := null;
    v_rec_transport := null;
    v_rec_activities := null;
    v_rec_misc := null;
  end if;

  return query
  select
    v_ref.id,
    v_ref.country_code,
    v_ref.country_name,
    v_ref.region_code,
    v_ref.source_name,
    v_ref.source_url,
    v_ref.source_year,
    v_ref.currency_code,
    v_base,
    v_profile_mult,
    v_style_mult,
    v_duration_mult,
    v_recommended_daily,
    v_rec_accommodation,
    v_rec_food,
    v_rec_transport,
    v_rec_activities,
    v_rec_misc,
    v_source_mode;
end;
$$;


ALTER FUNCTION "public"."rpc_budget_reference_compute_values"("p_country_code" "text", "p_region_code" "text", "p_travel_profile" "text", "p_travel_style" "text", "p_adult_count" integer, "p_child_count" integer, "p_trip_days" integer, "p_traveler_age_min" integer, "p_traveler_age_max" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_budget_reference_resolve_for_budget_segment"("p_budget_segment_id" "uuid") RETURNS TABLE("budget_segment_id" "uuid", "period_id" "uuid", "travel_id" "uuid", "start_date" "date", "end_date" "date", "resolution_level" "text", "reference_id" "uuid", "country_code" "text", "country_name" "text", "region_code" "text", "source_name" "text", "source_url" "text", "source_year" integer, "currency_code" "text", "travel_profile" "text", "travel_style" "text", "adult_count" integer, "child_count" integer, "trip_days" integer, "traveler_age_min" integer, "traveler_age_max" integer, "base_daily_reference_amount" numeric, "profile_multiplier" numeric, "style_multiplier" numeric, "duration_multiplier" numeric, "recommended_daily_amount" numeric, "recommended_accommodation_daily_amount" numeric, "recommended_food_daily_amount" numeric, "recommended_transport_daily_amount" numeric, "recommended_activities_daily_amount" numeric, "recommended_misc_daily_amount" numeric, "source_mode" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_request_uid uuid := auth.uid();
  v_seg record;
  v_travel_default public.travel_budget_reference_profile%rowtype;
  v_override public.budget_segment_budget_reference_override%rowtype;
  v_eff_country text;
  v_eff_region text;
  v_eff_profile text;
  v_eff_style text;
  v_eff_adult integer;
  v_eff_child integer;
  v_eff_trip_days integer;
  v_eff_age_min integer;
  v_eff_age_max integer;
  v_calc record;
  v_resolution text := 'none';
begin
  select bs.id as budget_segment_id,
         bs.period_id,
         bs.start_date,
         bs.end_date,
         p.travel_id,
         t.user_id
    into v_seg
  from public.budget_segments bs
  join public.periods p on p.id = bs.period_id
  join public.travels t on t.id = p.travel_id
  where bs.id = p_budget_segment_id
    and (v_request_uid is null or t.user_id = v_request_uid)
  limit 1;

  if not found then
    raise exception 'Budget segment not found or not owned by current user';
  end if;

  select * into v_travel_default
  from public.travel_budget_reference_profile tbr
  where tbr.travel_id = v_seg.travel_id
  limit 1;

  select * into v_override
  from public.budget_segment_budget_reference_override bro
  where bro.budget_segment_id = v_seg.budget_segment_id
    and bro.is_enabled = true
  limit 1;

  if found then
    v_resolution := 'segment_override';
  elsif v_travel_default.id is not null then
    v_resolution := 'travel_default';
  end if;

  v_eff_country := coalesce(v_override.country_code, v_travel_default.country_code);
  v_eff_region := coalesce(v_override.region_code, v_travel_default.region_code);
  v_eff_profile := coalesce(v_override.travel_profile, v_travel_default.travel_profile, 'solo');
  v_eff_style := coalesce(v_override.travel_style, v_travel_default.travel_style, 'standard');
  v_eff_adult := coalesce(v_override.adult_count, v_travel_default.adult_count, 1);
  v_eff_child := coalesce(v_override.child_count, v_travel_default.child_count, 0);
  v_eff_trip_days := coalesce(v_override.trip_days, (v_seg.end_date - v_seg.start_date + 1));
  v_eff_age_min := coalesce(v_override.traveler_age_min, v_travel_default.traveler_age_min);
  v_eff_age_max := coalesce(v_override.traveler_age_max, v_travel_default.traveler_age_max);

  if v_eff_country is null then
    return query
    select
      v_seg.budget_segment_id,
      v_seg.period_id,
      v_seg.travel_id,
      v_seg.start_date,
      v_seg.end_date,
      v_resolution,
      null::uuid,
      null::text,
      null::text,
      null::text,
      null::text,
      null::text,
      null::integer,
      null::text,
      v_eff_profile,
      v_eff_style,
      v_eff_adult,
      v_eff_child,
      v_eff_trip_days,
      v_eff_age_min,
      v_eff_age_max,
      null::numeric,
      null::numeric,
      null::numeric,
      null::numeric,
      null::numeric,
      null::numeric,
      null::numeric,
      null::numeric,
      null::numeric,
      null::numeric,
      'reference_suggested'::text;
    return;
  end if;

  select * into v_calc
  from public.rpc_budget_reference_compute_values(
    v_eff_country,
    v_eff_region,
    v_eff_profile,
    v_eff_style,
    v_eff_adult,
    v_eff_child,
    v_eff_trip_days,
    v_eff_age_min,
    v_eff_age_max
  );

  return query
  select
    v_seg.budget_segment_id,
    v_seg.period_id,
    v_seg.travel_id,
    v_seg.start_date,
    v_seg.end_date,
    v_resolution,
    v_calc.reference_id,
    v_calc.country_code,
    v_calc.country_name,
    v_calc.region_code,
    v_calc.source_name,
    v_calc.source_url,
    v_calc.source_year,
    v_calc.currency_code,
    v_eff_profile,
    v_eff_style,
    v_eff_adult,
    v_eff_child,
    v_eff_trip_days,
    v_eff_age_min,
    v_eff_age_max,
    v_calc.base_daily_reference_amount,
    v_calc.profile_multiplier,
    v_calc.style_multiplier,
    v_calc.duration_multiplier,
    v_calc.recommended_daily_amount,
    v_calc.recommended_accommodation_daily_amount,
    v_calc.recommended_food_daily_amount,
    v_calc.recommended_transport_daily_amount,
    v_calc.recommended_activities_daily_amount,
    v_calc.recommended_misc_daily_amount,
    case when v_resolution = 'segment_override' then 'reference_applied' else v_calc.source_mode end;
end;
$$;


ALTER FUNCTION "public"."rpc_budget_reference_resolve_for_budget_segment"("p_budget_segment_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_budget_reference_resolve_for_period"("p_period_id" "uuid") RETURNS TABLE("period_id" "uuid", "travel_id" "uuid", "has_period_override" boolean, "resolved_country_code" "text", "resolved_region_code" "text", "resolved_travel_profile" "text", "resolved_travel_style" "text", "resolved_adult_count" integer, "resolved_child_count" integer, "resolved_trip_days" integer, "resolved_traveler_age_min" integer, "resolved_traveler_age_max" integer, "resolved_source_mode" "text", "travel_recommended_daily_amount" numeric, "period_recommended_daily_amount" numeric)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    v.period_id,
    v.travel_id,
    v.has_period_override,
    v.resolved_country_code,
    v.resolved_region_code,
    v.resolved_travel_profile,
    v.resolved_travel_style,
    v.resolved_adult_count,
    v.resolved_child_count,
    v.resolved_trip_days,
    v.resolved_traveler_age_min,
    v.resolved_traveler_age_max,
    v.resolved_source_mode,
    v.travel_recommended_daily_amount,
    v.period_recommended_daily_amount
  from public.v_period_budget_reference_resolved v
  where v.period_id = p_period_id
    and (auth.uid() is null or v.user_id = auth.uid());
$$;


ALTER FUNCTION "public"."rpc_budget_reference_resolve_for_period"("p_period_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."save_analytic_mapping_rule"("p_user_id" "uuid", "p_category_name" "text", "p_subcategory_name" "text", "p_mapping_status" "text", "p_analytic_family" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_actor uuid := auth.uid();
  v_category text := nullif(trim(p_category_name), '');
  v_subcategory text := nullif(trim(p_subcategory_name), '');
  v_existing_id uuid;
begin
  if v_actor is null then
    raise exception 'Not authenticated';
  end if;

  if p_user_id is null or p_user_id <> v_actor then
    raise exception 'p_user_id must match auth.uid()';
  end if;

  if v_category is null then
    raise exception 'category_name is required';
  end if;

  if p_mapping_status not in ('mapped', 'excluded', 'unmapped') then
    raise exception 'invalid mapping_status: %', p_mapping_status;
  end if;

  if p_mapping_status = 'mapped' and p_analytic_family not in ('accommodation', 'food', 'transport', 'activities') then
    raise exception 'invalid analytic_family for mapped status: %', p_analytic_family;
  end if;

  if p_mapping_status <> 'mapped' then
    p_analytic_family := null;
  end if;

  select m.id
    into v_existing_id
  from public.analytic_category_mappings m
  where m.user_id = p_user_id
    and lower(trim(m.category_name)) = lower(v_category)
    and lower(trim(coalesce(m.subcategory_name, ''))) = lower(trim(coalesce(v_subcategory, '')))
  limit 1;

  if p_mapping_status = 'unmapped' then
    if v_existing_id is not null then
      delete from public.analytic_category_mappings
      where id = v_existing_id
        and user_id = p_user_id;
    end if;
    return;
  end if;

  if v_existing_id is not null then
    update public.analytic_category_mappings
    set
      category_name = v_category,
      subcategory_name = v_subcategory,
      mapping_status = p_mapping_status,
      analytic_family = p_analytic_family,
      updated_at = now()
    where id = v_existing_id
      and user_id = p_user_id;
  else
    insert into public.analytic_category_mappings (
      user_id,
      category_name,
      subcategory_name,
      mapping_status,
      analytic_family
    )
    values (
      p_user_id,
      v_category,
      v_subcategory,
      p_mapping_status,
      p_analytic_family
    );
  end if;
end;
$$;


ALTER FUNCTION "public"."save_analytic_mapping_rule"("p_user_id" "uuid", "p_category_name" "text", "p_subcategory_name" "text", "p_mapping_status" "text", "p_analytic_family" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."seed_default_analytic_category_mappings"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_count integer := 0;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.analytic_category_mappings
    (user_id, category_name, subcategory_name, mapping_status, analytic_family, notes)
  values
    -- mapped
    (v_user_id, 'Logement', null, 'mapped', 'accommodation', 'Core accommodation category'),
    (v_user_id, 'Repas', null, 'mapped', 'food', 'Core food category'),
    (v_user_id, 'Transport', null, 'mapped', 'transport', 'Core transport category'),
    (v_user_id, 'Sorties', null, 'mapped', 'activities', 'Mapped to activities by product decision'),
    (v_user_id, 'Laundry', null, 'mapped', 'activities', 'Mapped to activities for now'),
    (v_user_id, 'Autre', null, 'mapped', 'activities', 'Temporary analytical fallback'),
    (v_user_id, 'Abonnement/Mobile', null, 'mapped', 'activities', 'Temporary analytical fallback'),

    -- excluded
    (v_user_id, 'Transport Internationale', null, 'excluded', null, 'Excluded from local daily reference mix'),
    (v_user_id, 'Visa', null, 'excluded', null, 'Excluded from daily reference mix'),
    (v_user_id, 'Santé', null, 'excluded', null, 'Excluded from daily reference mix'),
    (v_user_id, 'Projet Personnel', null, 'excluded', null, 'Excluded from travel daily reference mix'),
    (v_user_id, 'Souvenir', null, 'excluded', null, 'Excluded from reference mix'),
    (v_user_id, 'Revenu', null, 'excluded', null, 'Income excluded from expense analytic mix'),
    (v_user_id, 'Frais bancaire', null, 'excluded', null, 'Excluded from daily reference mix'),
    (v_user_id, 'Caution', null, 'excluded', null, 'Excluded from daily reference mix')
  on conflict do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;


ALTER FUNCTION "public"."seed_default_analytic_category_mappings"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."seed_default_analytic_category_mappings_admin"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_count integer := 0;
begin
  insert into public.analytic_category_mappings
    (user_id, category_name, subcategory_name, mapping_status, analytic_family, notes)
  select *
  from (
    select distinct
      t.user_id,
      x.category_name,
      x.subcategory_name,
      x.mapping_status,
      x.analytic_family,
      x.notes
    from public.transactions t
    cross join (
      values
        ('Logement', null, 'mapped', 'accommodation', 'Core accommodation category'),
        ('Repas', null, 'mapped', 'food', 'Core food category'),
        ('Transport', null, 'mapped', 'transport', 'Core transport category'),
        ('Sorties', null, 'mapped', 'activities', 'Mapped to activities by product decision'),
        ('Laundry', null, 'mapped', 'activities', 'Mapped to activities for now'),
        ('Autre', null, 'mapped', 'activities', 'Temporary analytical fallback'),
        ('Abonnement/Mobile', null, 'mapped', 'activities', 'Temporary analytical fallback'),
        ('Transport Internationale', null, 'excluded', null, 'Excluded from local daily reference mix'),
        ('Visa', null, 'excluded', null, 'Excluded from daily reference mix'),
        ('Santé', null, 'excluded', null, 'Excluded from daily reference mix'),
        ('Projet Personnel', null, 'excluded', null, 'Excluded from travel daily reference mix'),
        ('Souvenir', null, 'excluded', null, 'Excluded from reference mix'),
        ('Revenu', null, 'excluded', null, 'Income excluded from expense analytic mix'),
        ('Frais bancaire', null, 'excluded', null, 'Excluded from daily reference mix'),
        ('Caution', null, 'excluded', null, 'Excluded from daily reference mix')
    ) as x(category_name, subcategory_name, mapping_status, analytic_family, notes)
  ) s
  on conflict do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;


ALTER FUNCTION "public"."seed_default_analytic_category_mappings_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."seed_default_categories_for_user"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_count integer := 0;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.categories (user_id, name, color, sort_order)
  values
    (v_user_id, 'Repas', '#2f80ed', 0),
    (v_user_id, 'Logement', '#22c55e', 1),
    (v_user_id, 'Transport', '#f59e0b', 2),
    (v_user_id, 'Transport Internationale', null, 3),
    (v_user_id, 'Visa', null, 4),
    (v_user_id, 'Sorties', '#a855f7', 5),
    (v_user_id, 'Santé', null, 6),
    (v_user_id, 'Abonnement/Mobile', null, 7),
    (v_user_id, 'Frais bancaire', null, 8),
    (v_user_id, 'Laundry', null, 9),
    (v_user_id, 'Course', null, 10),
    (v_user_id, 'Projet Personnel', null, 11),
    (v_user_id, 'Cadeau', null, 12),
    (v_user_id, 'Souvenir', null, 13),
    (v_user_id, 'Caution', '#06b6d4', 14),
    (v_user_id, 'Revenu', null, 15),
    (v_user_id, 'Autre', '#94a3b8', 16),
    (v_user_id, 'Mouvement interne', null, 17)
  on conflict do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;


ALTER FUNCTION "public"."seed_default_categories_for_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_current_timestamp_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_current_timestamp_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tb_profiles_role_guard"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_is_service boolean := false;
begin
  -- Detect service role / elevated contexts:
  -- In Supabase, service role calls may not have auth.uid();
  -- We only enforce restrictions when v_uid is NOT NULL (i.e., a normal authenticated client request).
  if v_uid is not null then
    -- INSERT: force role to 'user' unless already present AND equals 'user'
    if tg_op = 'INSERT' then
      v_role := coalesce(nullif(trim(NEW.role), ''), 'user');
      v_role := lower(v_role);
      if v_role <> 'user' then
        -- client cannot create admins
        NEW.role := 'user';
      else
        NEW.role := 'user';
      end if;
      return NEW;
    end if;

    -- UPDATE: disallow role changes
    if tg_op = 'UPDATE' then
      if NEW.role is distinct from OLD.role then
        raise exception 'role is immutable';
      end if;
      return NEW;
    end if;
  end if;

  -- Service/elevated contexts: do nothing
  return NEW;
end;
$$;


ALTER FUNCTION "public"."tb_profiles_role_guard"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tb_touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  new.updated_at = now();
  return new;
end$$;


ALTER FUNCTION "public"."tb_touch_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."transactions_travel_consistency_guard"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_period_travel_id uuid;
  v_wallet_user_id uuid;
  v_wallet_travel_id uuid;
  v_rule_user_id uuid;
  v_rule_travel_id uuid;
begin
  -- period_id is still mandatory in current schema
  if new.period_id is null then
    raise exception 'transaction.period_id is required';
  end if;

  select p.travel_id
    into v_period_travel_id
  from public.periods p
  where p.id = new.period_id;

  if v_period_travel_id is null then
    raise exception 'transaction.period_id invalid or period.travel_id missing';
  end if;

  -- auto-fill / validate travel_id from period_id
  if new.travel_id is null then
    new.travel_id := v_period_travel_id;
  elsif new.travel_id <> v_period_travel_id then
    raise exception 'transaction travel_id mismatch with period_id';
  end if;

  -- wallet must belong to same user and same travel
  select w.user_id, w.travel_id
    into v_wallet_user_id, v_wallet_travel_id
  from public.wallets w
  where w.id = new.wallet_id;

  if v_wallet_user_id is null then
    raise exception 'transaction.wallet_id invalid';
  end if;

  if new.user_id is not null and v_wallet_user_id <> new.user_id then
    raise exception 'transaction wallet user_id mismatch';
  end if;

  if v_wallet_travel_id is null then
    raise exception 'wallet.travel_id missing';
  end if;

  if v_wallet_travel_id <> new.travel_id then
    raise exception 'transaction wallet travel_id mismatch';
  end if;

  -- if linked to recurring rule, enforce same user + travel
  if new.recurring_rule_id is not null then
    select r.user_id, r.travel_id
      into v_rule_user_id, v_rule_travel_id
    from public.recurring_rules r
    where r.id = new.recurring_rule_id;

    if v_rule_user_id is null then
      raise exception 'transaction.recurring_rule_id invalid';
    end if;

    if new.user_id is not null and v_rule_user_id <> new.user_id then
      raise exception 'transaction recurring rule user_id mismatch';
    end if;

    if v_rule_travel_id <> new.travel_id then
      raise exception 'transaction recurring rule travel_id mismatch';
    end if;

    if new.generated_by_rule and new.occurrence_date is null then
      raise exception 'generated recurring transaction requires occurrence_date';
    end if;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."transactions_travel_consistency_guard"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."travel_day_context_for_date"("p_travel_id" "uuid", "p_log_date" "date") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public'
    AS $$
declare
  v_current jsonb;
  v_previous jsonb;
begin
  select to_jsonb(l)
    into v_current
  from public.v_travel_day_ui l
  where l.travel_id = p_travel_id
    and l.log_date = p_log_date;

  select to_jsonb(x)
    into v_previous
  from public.travel_day_last_known_location(p_travel_id, p_log_date) x;

  return jsonb_build_object(
    'current_day', coalesce(v_current, '{}'::jsonb),
    'previous_location', coalesce(v_previous, '{}'::jsonb)
  );
end;
$$;


ALTER FUNCTION "public"."travel_day_context_for_date"("p_travel_id" "uuid", "p_log_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."travel_day_last_known_location"("p_travel_id" "uuid", "p_before_date" "date") RETURNS TABLE("log_id" "uuid", "log_date" "date", "end_place_label" "text", "end_country_code" "text", "end_lat" numeric, "end_lng" numeric, "travel_mode_main" "text", "overnight_mode" "text")
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  select
    l.id as log_id,
    l.log_date,
    l.end_place_label,
    l.end_country_code,
    l.end_lat,
    l.end_lng,
    l.travel_mode_main,
    l.overnight_mode
  from public.travel_day_logs l
  where l.travel_id = p_travel_id
    and l.log_date < p_before_date
    and (
      l.end_place_label is not null
      or l.end_country_code is not null
      or l.end_lat is not null
      or l.end_lng is not null
    )
  order by l.log_date desc
  limit 1;
$$;


ALTER FUNCTION "public"."travel_day_last_known_location"("p_travel_id" "uuid", "p_before_date" "date") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."travel_day_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "travel_id" "uuid" NOT NULL,
    "log_date" "date" NOT NULL,
    "end_place_label" "text",
    "end_country_code" "text",
    "end_lat" numeric(9,6),
    "end_lng" numeric(9,6),
    "travel_mode_main" "text",
    "overnight_mode" "text",
    "no_move_declared" boolean DEFAULT false NOT NULL,
    "crossed_border" boolean DEFAULT false NOT NULL,
    "is_rest_day" boolean DEFAULT false NOT NULL,
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "travel_day_logs_country_code_chk" CHECK ((("end_country_code" IS NULL) OR ("end_country_code" ~ '^[A-Z]{2,3}$'::"text"))),
    CONSTRAINT "travel_day_logs_end_lat_chk" CHECK ((("end_lat" IS NULL) OR (("end_lat" >= ('-90'::integer)::numeric) AND ("end_lat" <= (90)::numeric)))),
    CONSTRAINT "travel_day_logs_end_lng_chk" CHECK ((("end_lng" IS NULL) OR (("end_lng" >= ('-180'::integer)::numeric) AND ("end_lng" <= (180)::numeric)))),
    CONSTRAINT "travel_day_logs_overnight_mode_chk" CHECK ((("overnight_mode" IS NULL) OR ("overnight_mode" = ANY (ARRAY['hostel'::"text", 'hotel'::"text", 'guesthouse'::"text", 'apartment'::"text", 'friends_family'::"text", 'couchsurfing'::"text", 'camping'::"text", 'wild_camping'::"text", 'night_transport'::"text", 'boat'::"text", 'van'::"text", 'outside'::"text", 'other'::"text"])))),
    CONSTRAINT "travel_day_logs_travel_mode_main_chk" CHECK ((("travel_mode_main" IS NULL) OR ("travel_mode_main" = ANY (ARRAY['none'::"text", 'walk'::"text", 'bike'::"text", 'motorbike'::"text", 'car'::"text", 'bus'::"text", 'train'::"text", 'boat'::"text", 'flight'::"text", 'hitchhiking'::"text", 'mixed'::"text", 'other'::"text"]))))
);


ALTER TABLE "public"."travel_day_logs" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."travel_day_log_upsert"("p_travel_id" "uuid", "p_log_date" "date", "p_end_place_label" "text" DEFAULT NULL::"text", "p_end_country_code" "text" DEFAULT NULL::"text", "p_end_lat" numeric DEFAULT NULL::numeric, "p_end_lng" numeric DEFAULT NULL::numeric, "p_travel_mode_main" "text" DEFAULT NULL::"text", "p_overnight_mode" "text" DEFAULT NULL::"text", "p_no_move_declared" boolean DEFAULT false, "p_crossed_border" boolean DEFAULT false, "p_is_rest_day" boolean DEFAULT false, "p_note" "text" DEFAULT NULL::"text") RETURNS "public"."travel_day_logs"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_row public.travel_day_logs;
  v_last record;
  v_same_place record;

  v_end_place_label text := p_end_place_label;
  v_end_country_code text := p_end_country_code;
  v_end_lat numeric := p_end_lat;
  v_end_lng numeric := p_end_lng;
begin
  -- 1) If "no move" and no place provided, inherit last known location
  if p_no_move_declared = true
     and p_end_place_label is null
     and p_end_country_code is null
     and p_end_lat is null
     and p_end_lng is null
  then
    select *
      into v_last
    from public.travel_day_last_known_location(p_travel_id, p_log_date);

    if found then
      v_end_place_label := v_last.end_place_label;
      v_end_country_code := v_last.end_country_code;
      v_end_lat := v_last.end_lat;
      v_end_lng := v_last.end_lng;
    end if;
  end if;

  -- 2) If place is provided but coords missing, reuse last known coords for same place
  if (v_end_lat is null or v_end_lng is null)
     and (v_end_place_label is not null or v_end_country_code is not null)
  then
    select
      l.end_lat,
      l.end_lng
    into v_same_place
    from public.travel_day_logs l
    where l.travel_id = p_travel_id
      and l.log_date < p_log_date
      and l.end_lat is not null
      and l.end_lng is not null
      and coalesce(lower(trim(l.end_place_label)), '') = coalesce(lower(trim(v_end_place_label)), '')
      and coalesce(l.end_country_code, '') = coalesce(v_end_country_code, '')
    order by l.log_date desc
    limit 1;

    if found then
      v_end_lat := coalesce(v_end_lat, v_same_place.end_lat);
      v_end_lng := coalesce(v_end_lng, v_same_place.end_lng);
    end if;
  end if;

  insert into public.travel_day_logs (
    user_id,
    travel_id,
    log_date,
    end_place_label,
    end_country_code,
    end_lat,
    end_lng,
    travel_mode_main,
    overnight_mode,
    no_move_declared,
    crossed_border,
    is_rest_day,
    note
  )
  values (
    auth.uid(),
    p_travel_id,
    p_log_date,
    v_end_place_label,
    v_end_country_code,
    v_end_lat,
    v_end_lng,
    p_travel_mode_main,
    p_overnight_mode,
    p_no_move_declared,
    p_crossed_border,
    p_is_rest_day,
    p_note
  )
  on conflict (travel_id, log_date)
  do update set
    end_place_label   = excluded.end_place_label,
    end_country_code  = excluded.end_country_code,
    end_lat           = excluded.end_lat,
    end_lng           = excluded.end_lng,
    travel_mode_main  = excluded.travel_mode_main,
    overnight_mode    = excluded.overnight_mode,
    no_move_declared  = excluded.no_move_declared,
    crossed_border    = excluded.crossed_border,
    is_rest_day       = excluded.is_rest_day,
    note              = excluded.note,
    updated_at        = now()
  returning * into v_row;

  return v_row;
end;
$$;


ALTER FUNCTION "public"."travel_day_log_upsert"("p_travel_id" "uuid", "p_log_date" "date", "p_end_place_label" "text", "p_end_country_code" "text", "p_end_lat" numeric, "p_end_lng" numeric, "p_travel_mode_main" "text", "p_overnight_mode" "text", "p_no_move_declared" boolean, "p_crossed_border" boolean, "p_is_rest_day" boolean, "p_note" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."travel_day_logs_apply_no_move_defaults"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  if new.no_move_declared = true and new.travel_mode_main is null then
    new.travel_mode_main := 'none';
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."travel_day_logs_apply_no_move_defaults"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."travel_day_logs_validate_no_move"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_move_count integer;
begin
  if new.no_move_declared then
    select count(*)
      into v_move_count
    from public.travel_day_moves m
    where m.travel_day_log_id = new.id;

    if v_move_count > 0 then
      raise exception 'Cannot set no_move_declared=true when moves already exist for this day.';
    end if;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."travel_day_logs_validate_no_move"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."travel_day_moves_block_if_no_move_declared"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_no_move boolean;
begin
  select l.no_move_declared
    into v_no_move
  from public.travel_day_logs l
  where l.id = new.travel_day_log_id;

  if coalesce(v_no_move, false) then
    raise exception 'Cannot insert a move on a day declared as no movement.';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."travel_day_moves_block_if_no_move_declared"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."travel_day_moves_sync_user_id"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  select l.user_id
    into new.user_id
  from public.travel_day_logs l
  where l.id = new.travel_day_log_id;

  return new;
end;
$$;


ALTER FUNCTION "public"."travel_day_moves_sync_user_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trip_accept_invite"("p_token" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_trip uuid;
  v_role text;
begin
  select trip_id, role into v_trip, v_role
  from public.trip_invites
  where token = p_token
    and used_at is null
    and expires_at > now();

  if v_trip is null then
    raise exception 'Invalid/expired invite';
  end if;

  insert into public.trip_participants(trip_id, auth_user_id, role)
  values (v_trip, auth.uid(), v_role)
  on conflict do nothing;

  update public.trip_invites
  set used_at = now()
  where token = p_token;
end $$;


ALTER FUNCTION "public"."trip_accept_invite"("p_token" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trip_after_group_insert_add_owner"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.trip_participants(trip_id, auth_user_id, role)
  values (new.id, auth.uid(), 'owner')
  on conflict do nothing;
  return new;
end $$;


ALTER FUNCTION "public"."trip_after_group_insert_add_owner"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trip_apply_expense_v1"("p_trip_id" "uuid", "p_payload" "jsonb") RETURNS TABLE("expense_id" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_uid uuid;
  v_expense_id uuid;
  v_date date;
  v_label text;
  v_amount numeric;
  v_currency text;
  v_paid_by uuid;
  v_sum numeric;
  v_category text;
  v_subcategory text;
  v_budget_date_start date;
  v_budget_date_end date;
begin
  v_uid := auth.uid();

  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if p_trip_id is null then
    raise exception 'trip_id required';
  end if;

  if not exists (
    select 1 from public.trip_participants tp
    where tp.trip_id = p_trip_id
      and tp.auth_user_id = v_uid
  ) then
    raise exception 'not authorized';
  end if;

  v_expense_id := nullif(p_payload->>'expense_id','')::uuid;
  v_date := (p_payload->>'date')::date;
  v_label := coalesce(p_payload->>'label','');
  v_amount := (p_payload->>'amount')::numeric;
  v_currency := coalesce(p_payload->>'currency','');
  v_paid_by := nullif(p_payload->>'paid_by_member_id','')::uuid;
  v_category := nullif(trim(coalesce(p_payload->>'category','')), '');
  v_subcategory := nullif(trim(coalesce(p_payload->>'subcategory','')), '');
  v_budget_date_start := coalesce((p_payload->>'budget_date_start')::date, v_date);
  v_budget_date_end := coalesce((p_payload->>'budget_date_end')::date, v_budget_date_start, v_date);

  if v_date is null or v_label = '' or v_amount is null or v_currency = '' or v_paid_by is null then
    raise exception 'missing fields';
  end if;

  if v_budget_date_end < v_budget_date_start then
    raise exception 'budget_date_end before budget_date_start';
  end if;

  if v_expense_id is null then
    insert into public.trip_expenses (
      user_id, trip_id, date, label, amount, currency, paid_by_member_id,
      category, subcategory, budget_date_start, budget_date_end,
      created_at, transaction_id
    ) values (
      v_uid, p_trip_id, v_date, v_label, v_amount, v_currency, v_paid_by,
      v_category, v_subcategory, v_budget_date_start, v_budget_date_end,
      now(), null
    ) returning id into v_expense_id;
  else
    update public.trip_expenses e
    set date = v_date,
        label = v_label,
        amount = v_amount,
        currency = v_currency,
        paid_by_member_id = v_paid_by,
        category = v_category,
        subcategory = v_subcategory,
        budget_date_start = v_budget_date_start,
        budget_date_end = v_budget_date_end
    where e.id = v_expense_id
      and e.trip_id = p_trip_id
    returning e.id into v_expense_id;

    if v_expense_id is null then
      raise exception 'expense not found';
    end if;

    delete from public.trip_expense_shares s
    where s.expense_id = v_expense_id
      and s.trip_id = p_trip_id;
  end if;

  insert into public.trip_expense_shares (
    user_id, trip_id, expense_id, member_id, share_amount, created_at
  )
  select v_uid,
         p_trip_id,
         v_expense_id,
         (x->>'member_id')::uuid,
         (x->>'share_amount')::numeric,
         now()
  from jsonb_array_elements(coalesce(p_payload->'shares','[]'::jsonb)) as x;

  select coalesce(sum(s.share_amount),0)
    into v_sum
  from public.trip_expense_shares s
  where s.expense_id = v_expense_id
    and s.trip_id = p_trip_id;

  if abs(v_sum - v_amount) > 0.01 then
    raise exception 'shares_sum_mismatch: sum=% amount=%', v_sum, v_amount;
  end if;

  return query select v_expense_id;
end;
$$;


ALTER FUNCTION "public"."trip_apply_expense_v1"("p_trip_id" "uuid", "p_payload" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trip_apply_expense_v2"("p_trip_id" "uuid", "p_payload" "jsonb") RETURNS TABLE("expense_id" "uuid", "transaction_id" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_uid uuid;
  v_expense_id uuid;
  v_existing_tx_id uuid;
  v_tx_id uuid;

  v_date date;
  v_label text;
  v_amount numeric;
  v_currency text;
  v_paid_by_member_id uuid;
  v_sum numeric;
  v_category text;
  v_subcategory text;
  v_budget_date_start date;
  v_budget_date_end date;

  v_wallet_enabled boolean;
  v_wallet_id uuid;
  v_tx_type text;
  v_pay_now boolean;
  v_out_of_budget boolean;
  v_night_covered boolean;
  v_affects_budget boolean;

  v_fx_rate_snapshot numeric;
  v_fx_source_snapshot text;
  v_fx_snapshot_at timestamptz;
  v_fx_base_currency_snapshot text;
  v_fx_tx_currency_snapshot text;
begin
  v_uid := auth.uid();

  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if p_trip_id is null then
    raise exception 'trip_id required';
  end if;

  if not exists (
    select 1
    from public.trip_participants tp
    where tp.trip_id = p_trip_id
      and tp.auth_user_id = v_uid
  ) then
    raise exception 'not authorized';
  end if;

  v_expense_id := nullif(p_payload->>'expense_id', '')::uuid;
  v_date := (p_payload->>'date')::date;
  v_label := coalesce(p_payload->>'label', '');
  v_amount := (p_payload->>'amount')::numeric;
  v_currency := coalesce(p_payload->>'currency', '');
  v_paid_by_member_id := nullif(p_payload->>'paid_by_member_id', '')::uuid;
  v_category := nullif(trim(coalesce(p_payload->>'category', '')), '');
  v_subcategory := nullif(trim(coalesce(p_payload->>'subcategory', '')), '');
  v_budget_date_start := coalesce((p_payload->>'budget_date_start')::date, v_date);
  v_budget_date_end := coalesce((p_payload->>'budget_date_end')::date, v_budget_date_start, v_date);

  if v_date is null or v_label = '' or v_amount is null or v_currency = '' or v_paid_by_member_id is null then
    raise exception 'missing fields';
  end if;

  if v_budget_date_end < v_budget_date_start then
    raise exception 'budget_date_end before budget_date_start';
  end if;

  if not exists (
    select 1
    from public.trip_members tm
    where tm.id = v_paid_by_member_id
      and tm.trip_id = p_trip_id
  ) then
    raise exception 'paid_by_member_id invalid';
  end if;

  if v_expense_id is null then
    insert into public.trip_expenses(
      id,
      user_id,
      trip_id,
      date,
      label,
      amount,
      currency,
      paid_by_member_id,
      category,
      subcategory,
      budget_date_start,
      budget_date_end,
      created_at,
      transaction_id
    )
    values(
      gen_random_uuid(),
      v_uid,
      p_trip_id,
      v_date,
      v_label,
      v_amount,
      v_currency,
      v_paid_by_member_id,
      v_category,
      v_subcategory,
      v_budget_date_start,
      v_budget_date_end,
      now(),
      null
    )
    returning trip_expenses.id, trip_expenses.transaction_id
    into v_expense_id, v_existing_tx_id;
  else
    update public.trip_expenses e
    set
      date = v_date,
      label = v_label,
      amount = v_amount,
      currency = v_currency,
      paid_by_member_id = v_paid_by_member_id,
      category = v_category,
      subcategory = v_subcategory,
      budget_date_start = v_budget_date_start,
      budget_date_end = v_budget_date_end
    where e.id = v_expense_id
      and e.trip_id = p_trip_id
    returning e.transaction_id
    into v_existing_tx_id;

    if not found then
      raise exception 'expense not found';
    end if;

    delete from public.trip_expense_shares s
    where s.trip_id = p_trip_id
      and s.expense_id = v_expense_id;

    delete from public.trip_expense_budget_links l
    where l.trip_id = p_trip_id
      and l.expense_id = v_expense_id;
  end if;

  insert into public.trip_expense_shares(
    id,
    user_id,
    expense_id,
    member_id,
    share_amount,
    created_at,
    trip_id
  )
  select
    gen_random_uuid(),
    v_uid,
    v_expense_id,
    (x->>'member_id')::uuid,
    (x->>'share_amount')::numeric,
    now(),
    p_trip_id
  from jsonb_array_elements(coalesce(p_payload->'shares', '[]'::jsonb)) as x;

  select coalesce(sum(s.share_amount), 0)
  into v_sum
  from public.trip_expense_shares s
  where s.trip_id = p_trip_id
    and s.expense_id = v_expense_id;

  if abs(v_sum - v_amount) > 0.01 then
    raise exception 'shares_sum_mismatch: sum=% amount=%', v_sum, v_amount;
  end if;

  v_wallet_enabled := coalesce((p_payload->'wallet_tx'->>'enabled')::boolean, false);
  v_tx_id := null;

  if v_wallet_enabled then
    v_wallet_id := nullif(p_payload->'wallet_tx'->>'wallet_id', '')::uuid;
    v_tx_type := coalesce(p_payload->'wallet_tx'->>'type', 'expense');
    v_pay_now := coalesce((p_payload->'wallet_tx'->>'pay_now')::boolean, true);
    v_out_of_budget := coalesce((p_payload->'wallet_tx'->>'out_of_budget')::boolean, false);
    v_night_covered := coalesce((p_payload->'wallet_tx'->>'night_covered')::boolean, false);
    v_affects_budget := coalesce((p_payload->'wallet_tx'->>'affects_budget')::boolean, true);

    if v_wallet_id is null then
      raise exception 'wallet_id required when wallet_tx.enabled=true';
    end if;

    if not exists (
      select 1
      from public.wallets w
      where w.id = v_wallet_id
        and w.user_id = v_uid
    ) then
      raise exception 'wallet_id invalid';
    end if;

    v_fx_rate_snapshot := nullif(p_payload->'wallet_tx'->>'fx_rate_snapshot', '')::numeric;
    v_fx_source_snapshot := nullif(p_payload->'wallet_tx'->>'fx_source_snapshot', '');
    v_fx_snapshot_at := nullif(p_payload->'wallet_tx'->>'fx_snapshot_at', '')::timestamptz;
    v_fx_base_currency_snapshot := nullif(p_payload->'wallet_tx'->>'fx_base_currency_snapshot', '');
    v_fx_tx_currency_snapshot := nullif(p_payload->'wallet_tx'->>'fx_tx_currency_snapshot', '');

    if v_existing_tx_id is not null then
      perform public.delete_transaction(v_existing_tx_id);
      v_existing_tx_id := null;
    end if;

    select public.apply_transaction_v2(
      v_wallet_id,
      v_tx_type,
      v_label,
      v_amount,
      v_currency,
      v_date,
      v_date,
      coalesce(v_category, 'Partage'),
      v_subcategory,
      v_pay_now,
      v_out_of_budget,
      v_night_covered,
      v_affects_budget,
      v_expense_id,
      null,
      v_fx_rate_snapshot,
      v_fx_source_snapshot,
      v_fx_snapshot_at,
      v_fx_base_currency_snapshot,
      v_fx_tx_currency_snapshot,
      v_uid,
      v_budget_date_start,
      v_budget_date_end
    )
    into v_tx_id;

    update public.trip_expenses e
    set transaction_id = v_tx_id
    where e.id = v_expense_id
      and e.trip_id = p_trip_id;

    insert into public.trip_expense_budget_links(
      id,
      user_id,
      trip_id,
      expense_id,
      member_id,
      transaction_id,
      created_at
    )
    values(
      gen_random_uuid(),
      v_uid,
      p_trip_id,
      v_expense_id,
      v_paid_by_member_id,
      v_tx_id,
      now()
    );
  else
    if v_existing_tx_id is not null then
      perform public.delete_transaction(v_existing_tx_id);

      update public.trip_expenses e
      set transaction_id = null
      where e.id = v_expense_id
        and e.trip_id = p_trip_id;
    end if;
  end if;

  return query
  select v_expense_id, v_tx_id;
end;
$$;


ALTER FUNCTION "public"."trip_apply_expense_v2"("p_trip_id" "uuid", "p_payload" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trip_bind_member_to_auth"("p_trip_id" "uuid") RETURNS "uuid"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select public.bind_trip_member_to_auth(p_trip_id);
$$;


ALTER FUNCTION "public"."trip_bind_member_to_auth"("p_trip_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trip_cancel_settlement_v1"("p_event_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_uid uuid;
  v_trip uuid;
begin
  v_uid := auth.uid();

  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select trip_id
  into v_trip
  from trip_settlement_events
  where id = p_event_id;

  if not exists (
    select 1
    from trip_participants
    where trip_id = v_trip
      and auth_user_id = v_uid
  ) then
    raise exception 'not participant';
  end if;

  update trip_settlement_events
  set cancelled_at = now()
  where id = p_event_id;
end;
$$;


ALTER FUNCTION "public"."trip_cancel_settlement_v1"("p_event_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trip_create_settlement_v1"("p_trip_id" "uuid", "p_currency" "text", "p_amount" numeric, "p_from_member_id" "uuid", "p_to_member_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_event_id uuid;
  v_uid uuid;
begin
  -- utilisateur courant
  v_uid := auth.uid();

  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  -- vérifier que l'utilisateur appartient au trip
  if not exists (
    select 1
    from trip_participants tp
    where tp.trip_id = p_trip_id
      and tp.auth_user_id = v_uid
  ) then
    raise exception 'not participant';
  end if;

  insert into trip_settlement_events(
    id,
    trip_id,
    currency,
    amount,
    from_member_id,
    to_member_id,
    created_by,
    created_at
  )
  values (
    gen_random_uuid(),
    p_trip_id,
    p_currency,
    p_amount,
    p_from_member_id,
    p_to_member_id,
    v_uid,
    now()
  )
  returning id into v_event_id;

  return v_event_id;
end;
$$;


ALTER FUNCTION "public"."trip_create_settlement_v1"("p_trip_id" "uuid", "p_currency" "text", "p_amount" numeric, "p_from_member_id" "uuid", "p_to_member_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trip_debug_auth_v1"("p_trip_id" "uuid") RETURNS TABLE("jwt_uid" "uuid", "has_participant" boolean, "trip_role" "text")
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    auth.uid() as jwt_uid,
    exists (
      select 1
      from public.trip_participants tp
      where tp.trip_id = p_trip_id
        and tp.auth_user_id = auth.uid()
    ) as has_participant,
    (
      select tp.role
      from public.trip_participants tp
      where tp.trip_id = p_trip_id
        and tp.auth_user_id = auth.uid()
      limit 1
    ) as trip_role
$$;


ALTER FUNCTION "public"."trip_debug_auth_v1"("p_trip_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trip_delete_expense_v1"("p_trip_id" "uuid", "p_expense_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_uid uuid;
  v_main_tx_id uuid;
  v_budget_tx_ids uuid[] := '{}';
begin
  v_uid := auth.uid();

  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if p_trip_id is null or p_expense_id is null then
    raise exception 'trip_id and expense_id required';
  end if;

  if not exists (
    select 1
    from public.trip_participants tp
    where tp.trip_id = p_trip_id
      and tp.auth_user_id = v_uid
  ) then
    raise exception 'not authorized';
  end if;

  -- 1) lock the expense row and read the main linked tx
  select te.transaction_id
    into v_main_tx_id
  from public.trip_expenses te
  where te.id = p_expense_id
    and te.trip_id = p_trip_id
  for update;

  if not found then
    raise exception 'expense not found';
  end if;

  -- 2) collect linked budget tx ids (simple array aggregation, no FOR UPDATE here)
  select coalesce(array_agg(distinct l.transaction_id), '{}')
    into v_budget_tx_ids
  from public.trip_expense_budget_links l
  where l.trip_id = p_trip_id
    and l.expense_id = p_expense_id
    and l.transaction_id is not null;

  -- 3) break direct links first
  update public.trip_expenses te
  set transaction_id = null
  where te.id = p_expense_id
    and te.trip_id = p_trip_id;

  update public.transactions t
  set trip_expense_id = null
  where t.trip_expense_id = p_expense_id;

  -- 4) delete relational rows first
  delete from public.trip_expense_budget_links l
  where l.trip_id = p_trip_id
    and l.expense_id = p_expense_id;

  delete from public.trip_expense_shares s
  where s.trip_id = p_trip_id
    and s.expense_id = p_expense_id;

  delete from public.trip_expenses te
  where te.id = p_expense_id
    and te.trip_id = p_trip_id;

  -- 5) delete budget txs
  if coalesce(array_length(v_budget_tx_ids, 1), 0) > 0 then
    delete from public.transactions t
    where t.id = any(v_budget_tx_ids);
  end if;

  -- 6) delete main wallet tx last, only if distinct from budget txs
  if v_main_tx_id is not null
     and not (v_main_tx_id = any(v_budget_tx_ids)) then
    delete from public.transactions t
    where t.id = v_main_tx_id;
  end if;
end;
$$;


ALTER FUNCTION "public"."trip_delete_expense_v1"("p_trip_id" "uuid", "p_expense_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trip_get_balances_v1"("p_trip_id" "uuid") RETURNS TABLE("currency" "text", "member_id" "uuid", "name" "text", "email" "text", "paid" numeric, "owed" numeric, "net_raw" numeric, "adj" numeric, "net" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if p_trip_id is null then
    raise exception 'trip_id required';
  end if;

  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1
    from public.trip_participants tp
    where tp.trip_id = p_trip_id
      and tp.auth_user_id = auth.uid()
  ) then
    raise exception 'not authorized';
  end if;

  return query
    select
      v.currency,
      v.member_id,
      v.name,
      v.email,
      v.paid,
      v.owed,
      v.net_raw,
      v.adj,
      v.net
    from public.v_trip_balances v
    where v.trip_id = p_trip_id
    order by v.currency, v.name;
end;
$$;


ALTER FUNCTION "public"."trip_get_balances_v1"("p_trip_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trip_role"("p_trip_id" "uuid") RETURNS "text"
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  select tp.role
  from public.trip_participants tp
  where tp.trip_id = p_trip_id
    and tp.auth_user_id = auth.uid()
  limit 1;
$$;


ALTER FUNCTION "public"."trip_role"("p_trip_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trip_suggest_settlements_v1"("p_trip_id" "uuid", "p_use_net_raw" boolean DEFAULT true) RETURNS TABLE("out_currency" "text", "from_member_id" "uuid", "to_member_id" "uuid", "amount" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1
    from public.trip_participants tp
    where tp.trip_id = p_trip_id
      and tp.auth_user_id = auth.uid()
  ) then
    raise exception 'not authorized';
  end if;

  return query
  with b as (
    select
      v.currency as cur,
      v.member_id,
      case when p_use_net_raw then v.net_raw else v.net end as bal
    from public.v_trip_balances v
    where v.trip_id = p_trip_id
  ),
  creditors as (
    select cur, member_id, bal
    from b
    where bal > 0
    order by cur, bal desc
  ),
  debtors as (
    select cur, member_id, (-bal) as bal
    from b
    where bal < 0
    order by cur, (-bal) desc
  ),
  c as (
    select cur, member_id, bal,
           sum(bal) over (partition by cur order by bal desc, member_id) as c_cum
    from creditors
  ),
  d as (
    select cur, member_id, bal,
           sum(bal) over (partition by cur order by bal desc, member_id) as d_cum
    from debtors
  ),
  pairs as (
    select
      d.cur,
      d.member_id as from_member_id,
      c.member_id as to_member_id,
      greatest(
        0,
        least(d.d_cum, c.c_cum)
        - greatest(d.d_cum - d.bal, c.c_cum - c.bal)
      ) as amt
    from d
    join c on c.cur = d.cur
  )
  select
    pairs.cur::text as out_currency,
    pairs.from_member_id,
    pairs.to_member_id,
    round(pairs.amt::numeric, 2) as amount
  from pairs
  where pairs.amt > 0.009
  order by pairs.cur, pairs.amt desc;

end;
$$;


ALTER FUNCTION "public"."trip_suggest_settlements_v1"("p_trip_id" "uuid", "p_use_net_raw" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_transaction"("p_tx_id" "uuid", "p_wallet_id" "uuid", "p_type" "text", "p_amount" numeric, "p_currency" "text", "p_category" "text", "p_label" "text", "p_date_start" "date", "p_date_end" "date", "p_pay_now" boolean, "p_out_of_budget" boolean, "p_night_covered" boolean) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  perform public.update_transaction_v2(
    p_id => p_tx_id,
    p_wallet_id => p_wallet_id,
    p_type => p_type,
    p_amount => p_amount,
    p_currency => p_currency,
    p_category => p_category,
    p_label => p_label,
    p_date_start => p_date_start,
    p_date_end => p_date_end,
    p_pay_now => coalesce(p_pay_now, false),
    p_out_of_budget => coalesce(p_out_of_budget, false),
    p_night_covered => coalesce(p_night_covered, false),
    p_user_id => null,
    p_subcategory => null,
    p_trip_expense_id => null,
    p_trip_share_link_id => null,
    p_fx_rate_snapshot => null,
    p_fx_source_snapshot => null,
    p_fx_snapshot_at => null,
    p_fx_base_currency_snapshot => null,
    p_fx_tx_currency_snapshot => null,
    p_budget_date_start => p_date_start,
    p_budget_date_end => coalesce(p_date_end, p_date_start)
  );
end;
$$;


ALTER FUNCTION "public"."update_transaction"("p_tx_id" "uuid", "p_wallet_id" "uuid", "p_type" "text", "p_amount" numeric, "p_currency" "text", "p_category" "text", "p_label" "text", "p_date_start" "date", "p_date_end" "date", "p_pay_now" boolean, "p_out_of_budget" boolean, "p_night_covered" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_transaction_v2"("p_id" "uuid", "p_wallet_id" "uuid", "p_type" "text", "p_amount" numeric, "p_currency" "text", "p_category" "text", "p_label" "text", "p_date_start" "date", "p_date_end" "date", "p_pay_now" boolean DEFAULT false, "p_out_of_budget" boolean DEFAULT false, "p_night_covered" boolean DEFAULT false, "p_user_id" "uuid" DEFAULT NULL::"uuid", "p_subcategory" "text" DEFAULT NULL::"text", "p_trip_expense_id" "uuid" DEFAULT NULL::"uuid", "p_trip_share_link_id" "uuid" DEFAULT NULL::"uuid", "p_fx_rate_snapshot" numeric DEFAULT NULL::numeric, "p_fx_source_snapshot" "text" DEFAULT NULL::"text", "p_fx_snapshot_at" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_fx_base_currency_snapshot" "text" DEFAULT NULL::"text", "p_fx_tx_currency_snapshot" "text" DEFAULT NULL::"text", "p_budget_date_start" "date" DEFAULT NULL::"date", "p_budget_date_end" "date" DEFAULT NULL::"date") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_existing public.transactions%rowtype;
  v_period_id uuid;
  v_new_status text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select *
  into v_existing
  from public.transactions
  where id = p_id
    and user_id = v_user_id;

  if not found then
    raise exception 'Transaction introuvable';
  end if;

  select w.period_id
  into v_period_id
  from public.wallets w
  where w.id = p_wallet_id
    and w.user_id = v_user_id;

  if v_period_id is null then
    raise exception 'Wallet invalide';
  end if;

  v_new_status := v_existing.recurring_instance_status;

  if coalesce(v_existing.generated_by_rule, false) then
    if coalesce(p_pay_now, false) then
      v_new_status := 'confirmed';
    elsif coalesce(v_existing.recurring_instance_status, 'generated') = 'confirmed' then
      v_new_status := 'generated';
    elsif v_new_status is null then
      v_new_status := 'generated';
    end if;
  end if;

  update public.transactions t
  set wallet_id = p_wallet_id,
      period_id = v_period_id,
      type = p_type,
      amount = p_amount,
      currency = p_currency,
      category = p_category,
      subcategory = p_subcategory,
      label = p_label,
      date_start = p_date_start,
      date_end = p_date_end,
      budget_date_start = coalesce(p_budget_date_start, p_date_start),
      budget_date_end = coalesce(p_budget_date_end, p_budget_date_start, p_date_end, p_date_start),
      pay_now = p_pay_now,
      out_of_budget = p_out_of_budget,
      night_covered = p_night_covered,
      affects_budget = case
        when p_out_of_budget then false
        else coalesce(t.affects_budget, true)
      end,
      trip_expense_id = p_trip_expense_id,
      trip_share_link_id = p_trip_share_link_id,
      recurring_instance_status = v_new_status,
      fx_rate_snapshot = coalesce(t.fx_rate_snapshot, p_fx_rate_snapshot),
      fx_source_snapshot = coalesce(t.fx_source_snapshot, p_fx_source_snapshot),
      fx_snapshot_at = coalesce(t.fx_snapshot_at, p_fx_snapshot_at),
      fx_base_currency_snapshot = coalesce(t.fx_base_currency_snapshot, p_fx_base_currency_snapshot),
      fx_tx_currency_snapshot = coalesce(t.fx_tx_currency_snapshot, p_fx_tx_currency_snapshot),
      updated_at = now()
  where t.id = p_id
    and t.user_id = v_user_id;
end;
$$;


ALTER FUNCTION "public"."update_transaction_v2"("p_id" "uuid", "p_wallet_id" "uuid", "p_type" "text", "p_amount" numeric, "p_currency" "text", "p_category" "text", "p_label" "text", "p_date_start" "date", "p_date_end" "date", "p_pay_now" boolean, "p_out_of_budget" boolean, "p_night_covered" boolean, "p_user_id" "uuid", "p_subcategory" "text", "p_trip_expense_id" "uuid", "p_trip_share_link_id" "uuid", "p_fx_rate_snapshot" numeric, "p_fx_source_snapshot" "text", "p_fx_snapshot_at" timestamp with time zone, "p_fx_base_currency_snapshot" "text", "p_fx_tx_currency_snapshot" "text", "p_budget_date_start" "date", "p_budget_date_end" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."wallets_travel_consistency_guard"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_period_travel_id uuid;
begin
  if new.period_id is null then
    raise exception 'wallet.period_id is required';
  end if;

  select p.travel_id
    into v_period_travel_id
  from public.periods p
  where p.id = new.period_id;

  if v_period_travel_id is null then
    raise exception 'wallet.period_id invalid or period.travel_id missing';
  end if;

  if new.travel_id is null then
    new.travel_id := v_period_travel_id;
  elsif new.travel_id <> v_period_travel_id then
    raise exception 'wallet travel_id mismatch with period_id';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."wallets_travel_consistency_guard"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."analytic_category_mappings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "category_name" "text" NOT NULL,
    "subcategory_name" "text",
    "mapping_status" "text" DEFAULT 'unmapped'::"text" NOT NULL,
    "analytic_family" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "analytic_category_mappings_category_name_chk" CHECK (("length"(TRIM(BOTH FROM "category_name")) > 0)),
    CONSTRAINT "analytic_category_mappings_family_chk" CHECK ((("analytic_family" IS NULL) OR ("analytic_family" = ANY (ARRAY['accommodation'::"text", 'food'::"text", 'transport'::"text", 'activities'::"text"])))),
    CONSTRAINT "analytic_category_mappings_status_chk" CHECK (("mapping_status" = ANY (ARRAY['mapped'::"text", 'excluded'::"text", 'unmapped'::"text"]))),
    CONSTRAINT "analytic_category_mappings_status_family_consistency_chk" CHECK (((("mapping_status" = 'mapped'::"text") AND ("analytic_family" IS NOT NULL)) OR (("mapping_status" = ANY (ARRAY['excluded'::"text", 'unmapped'::"text"])) AND ("analytic_family" IS NULL)))),
    CONSTRAINT "analytic_category_mappings_subcategory_name_chk" CHECK ((("subcategory_name" IS NULL) OR ("length"(TRIM(BOTH FROM "subcategory_name")) > 0)))
);


ALTER TABLE "public"."analytic_category_mappings" OWNER TO "postgres";


COMMENT ON TABLE "public"."analytic_category_mappings" IS 'SQL source of truth for mapping user transaction categories/subcategories to analytic families.';



COMMENT ON COLUMN "public"."analytic_category_mappings"."category_name" IS 'User transaction category name as stored on transactions.category.';



COMMENT ON COLUMN "public"."analytic_category_mappings"."subcategory_name" IS 'Optional user transaction subcategory name as stored on transactions.subcategory.';



COMMENT ON COLUMN "public"."analytic_category_mappings"."mapping_status" IS 'mapped | excluded | unmapped';



COMMENT ON COLUMN "public"."analytic_category_mappings"."analytic_family" IS 'Target analytic family when mapping_status = mapped: accommodation | food | transport | activities';



CREATE TABLE IF NOT EXISTS "public"."asset_owners" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "asset_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "trip_member_id" "uuid",
    "display_name" "text" NOT NULL,
    "ownership_percent" numeric NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "asset_owners_ownership_percent_check" CHECK ((("ownership_percent" >= (0)::numeric) AND ("ownership_percent" <= (100)::numeric)))
);


ALTER TABLE "public"."asset_owners" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."asset_ownership_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "asset_id" "uuid" NOT NULL,
    "from_owner_id" "uuid",
    "to_owner_id" "uuid",
    "event_type" "text" NOT NULL,
    "percent" numeric NOT NULL,
    "amount" numeric DEFAULT 0 NOT NULL,
    "currency" "text" NOT NULL,
    "event_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "asset_ownership_events_amount_check" CHECK (("amount" >= (0)::numeric)),
    CONSTRAINT "asset_ownership_events_currency_check" CHECK (("currency" ~ '^[A-Z]{3}$'::"text")),
    CONSTRAINT "asset_ownership_events_event_type_check" CHECK (("event_type" = ANY (ARRAY['buy_share'::"text", 'sell_share'::"text", 'transfer_share'::"text"]))),
    CONSTRAINT "asset_ownership_events_percent_check" CHECK ((("percent" > (0)::numeric) AND ("percent" <= (100)::numeric)))
);


ALTER TABLE "public"."asset_ownership_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."assets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "travel_id" "uuid",
    "name" "text" NOT NULL,
    "asset_type" "text" NOT NULL,
    "purchase_value" numeric NOT NULL,
    "residual_value" numeric DEFAULT 0 NOT NULL,
    "currency" "text" NOT NULL,
    "purchase_date" "date" NOT NULL,
    "depreciation_months" integer NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "assets_asset_type_check" CHECK (("asset_type" = ANY (ARRAY['car'::"text", 'real_estate'::"text", 'equipment'::"text", 'other'::"text"]))),
    CONSTRAINT "assets_currency_check" CHECK (("currency" ~ '^[A-Z]{3}$'::"text")),
    CONSTRAINT "assets_depreciation_months_check" CHECK (("depreciation_months" > 0)),
    CONSTRAINT "assets_purchase_value_check" CHECK (("purchase_value" >= (0)::numeric)),
    CONSTRAINT "assets_residual_value_check" CHECK (("residual_value" >= (0)::numeric)),
    CONSTRAINT "assets_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'sold'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."assets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."budget_segment_budget_reference_override" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "budget_segment_id" "uuid" NOT NULL,
    "period_id" "uuid" NOT NULL,
    "travel_id" "uuid" NOT NULL,
    "reference_id" "uuid",
    "is_enabled" boolean DEFAULT true NOT NULL,
    "country_code" "text",
    "region_code" "text",
    "travel_profile" "text",
    "travel_style" "text",
    "adult_count" integer,
    "child_count" integer,
    "trip_days" integer,
    "traveler_age_min" integer,
    "traveler_age_max" integer,
    "base_daily_reference_amount" numeric(12,2),
    "style_multiplier" numeric(8,4) DEFAULT 1.0000 NOT NULL,
    "profile_multiplier" numeric(8,4) DEFAULT 1.0000 NOT NULL,
    "duration_multiplier" numeric(8,4) DEFAULT 1.0000 NOT NULL,
    "recommended_daily_amount" numeric(12,2),
    "recommended_accommodation_daily_amount" numeric(12,2),
    "recommended_food_daily_amount" numeric(12,2),
    "recommended_transport_daily_amount" numeric(12,2),
    "recommended_activities_daily_amount" numeric(12,2),
    "recommended_misc_daily_amount" numeric(12,2),
    "source_mode" "text" DEFAULT 'reference_suggested'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "budget_segment_budget_reference_override_adult_chk" CHECK ((("adult_count" IS NULL) OR ("adult_count" >= 1))),
    CONSTRAINT "budget_segment_budget_reference_override_age_max_chk" CHECK ((("traveler_age_max" IS NULL) OR ("traveler_age_max" >= 0))),
    CONSTRAINT "budget_segment_budget_reference_override_age_min_chk" CHECK ((("traveler_age_min" IS NULL) OR ("traveler_age_min" >= 0))),
    CONSTRAINT "budget_segment_budget_reference_override_child_chk" CHECK ((("child_count" IS NULL) OR ("child_count" >= 0))),
    CONSTRAINT "budget_segment_budget_reference_override_country_code_chk" CHECK ((("country_code" IS NULL) OR ("country_code" ~ '^[A-Z]{2,3}$'::"text"))),
    CONSTRAINT "budget_segment_budget_reference_override_profile_chk" CHECK ((("travel_profile" IS NULL) OR ("travel_profile" = ANY (ARRAY['solo'::"text", 'couple'::"text", 'family'::"text"])))),
    CONSTRAINT "budget_segment_budget_reference_override_source_mode_chk" CHECK (("source_mode" = ANY (ARRAY['manual_only'::"text", 'reference_suggested'::"text", 'reference_applied'::"text", 'reference_modified'::"text"]))),
    CONSTRAINT "budget_segment_budget_reference_override_style_chk" CHECK ((("travel_style" IS NULL) OR ("travel_style" = ANY (ARRAY['budget'::"text", 'standard'::"text", 'comfort'::"text"])))),
    CONSTRAINT "budget_segment_budget_reference_override_trip_days_chk" CHECK ((("trip_days" IS NULL) OR ("trip_days" >= 1)))
);


ALTER TABLE "public"."budget_segment_budget_reference_override" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."budget_segments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "period_id" "uuid" NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "base_currency" "text" NOT NULL,
    "daily_budget_base" numeric DEFAULT 0 NOT NULL,
    "fx_mode" "text" DEFAULT 'fixed'::"text" NOT NULL,
    "eur_base_rate_fixed" numeric,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "fx_rate_eur_to_base" numeric,
    "fx_source" "text",
    "fx_last_updated_at" timestamp with time zone,
    "transport_night_budget" numeric DEFAULT 400,
    CONSTRAINT "budget_segments_currency_ok" CHECK ((("char_length"("base_currency") >= 3) AND ("char_length"("base_currency") <= 6))),
    CONSTRAINT "budget_segments_dates_ok" CHECK (("end_date" >= "start_date")),
    CONSTRAINT "budget_segments_fx_mode_check" CHECK (("fx_mode" = ANY (ARRAY['live_ecb'::"text", 'fixed'::"text"]))),
    CONSTRAINT "budget_segments_transport_night_budget_check" CHECK ((("transport_night_budget" IS NULL) OR ("transport_night_budget" >= (0)::numeric)))
);


ALTER TABLE "public"."budget_segments" OWNER TO "postgres";


COMMENT ON COLUMN "public"."budget_segments"."transport_night_budget" IS 'Night transport budget stored per budget segment, expressed in the segment base currency.';



CREATE TABLE IF NOT EXISTS "public"."categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "name" "text" NOT NULL,
    "color" "text",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "categories_color_hex" CHECK ((("color" IS NULL) OR ("color" ~ '^#[0-9a-fA-F]{6}$'::"text"))),
    CONSTRAINT "categories_name_nonempty" CHECK (("length"(TRIM(BOTH FROM "name")) > 0))
);


ALTER TABLE "public"."categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."category_subcategories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "category_id" "uuid",
    "category_name" "text" NOT NULL,
    "name" "text" NOT NULL,
    "color" "text",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "category_subcategories_category_name_chk" CHECK (("length"(TRIM(BOTH FROM "category_name")) > 0)),
    CONSTRAINT "category_subcategories_color_check" CHECK ((("color" IS NULL) OR ("color" ~ '^#[0-9a-fA-F]{6}$'::"text"))),
    CONSTRAINT "category_subcategories_name_chk" CHECK (("length"(TRIM(BOTH FROM "name")) > 0))
);


ALTER TABLE "public"."category_subcategories" OWNER TO "postgres";


COMMENT ON TABLE "public"."category_subcategories" IS 'User-owned registry of subcategories grouped under a parent category.';



COMMENT ON COLUMN "public"."category_subcategories"."category_id" IS 'Optional normalized parent category id for future migration to category ids.';



COMMENT ON COLUMN "public"."category_subcategories"."category_name" IS 'Denormalized parent category name kept for compatibility with the current category-name based front-end.';



CREATE TABLE IF NOT EXISTS "public"."country_budget_reference" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "country_code" "text" NOT NULL,
    "country_name" "text" NOT NULL,
    "region_code" "text",
    "region_name" "text",
    "source_name" "text" DEFAULT 'tourdumondiste'::"text" NOT NULL,
    "source_url" "text" NOT NULL,
    "source_label" "text",
    "source_published_at" "date",
    "source_year" integer,
    "currency_code" "text" DEFAULT 'EUR'::"text" NOT NULL,
    "daily_budget_amount" numeric(12,2),
    "solo_daily_amount" numeric(12,2),
    "couple_per_person_daily_amount" numeric(12,2),
    "family_per_person_daily_amount" numeric(12,2),
    "short_trip_daily_amount" numeric(12,2),
    "long_trip_daily_amount" numeric(12,2),
    "accommodation_daily_amount" numeric(12,2),
    "food_daily_amount" numeric(12,2),
    "transport_daily_amount" numeric(12,2),
    "activities_daily_amount" numeric(12,2),
    "misc_daily_amount" numeric(12,2),
    "sample_size" integer,
    "methodology_note" "text",
    "raw_notes" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "fetched_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "country_budget_reference_country_code_chk" CHECK (("country_code" ~ '^[A-Z]{2,3}$'::"text")),
    CONSTRAINT "country_budget_reference_currency_code_chk" CHECK (("currency_code" ~ '^[A-Z]{3}$'::"text"))
);


ALTER TABLE "public"."country_budget_reference" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."fx_manual_rates" (
    "user_id" "uuid" NOT NULL,
    "currency" "text" NOT NULL,
    "rate_to_eur" numeric NOT NULL,
    "as_of" "date" DEFAULT CURRENT_DATE NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "fx_manual_rates_rate_to_eur_check" CHECK (("rate_to_eur" > (0)::numeric))
);


ALTER TABLE "public"."fx_manual_rates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."fx_rates" (
    "id" bigint NOT NULL,
    "base" "text" DEFAULT 'EUR'::"text" NOT NULL,
    "as_of" "date" NOT NULL,
    "rates" "jsonb" NOT NULL,
    "source" "text" DEFAULT 'ECB'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."fx_rates" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."fx_rates_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."fx_rates_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."fx_rates_id_seq" OWNED BY "public"."fx_rates"."id";



CREATE TABLE IF NOT EXISTS "public"."period_budget_reference_override" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "period_id" "uuid" NOT NULL,
    "travel_id" "uuid" NOT NULL,
    "reference_id" "uuid",
    "is_enabled" boolean DEFAULT true NOT NULL,
    "country_code" "text",
    "region_code" "text",
    "travel_profile" "text",
    "travel_style" "text",
    "adult_count" integer,
    "child_count" integer,
    "trip_days" integer,
    "traveler_age_min" integer,
    "traveler_age_max" integer,
    "base_daily_reference_amount" numeric(12,2),
    "style_multiplier" numeric(8,4) DEFAULT 1.0000 NOT NULL,
    "profile_multiplier" numeric(8,4) DEFAULT 1.0000 NOT NULL,
    "duration_multiplier" numeric(8,4) DEFAULT 1.0000 NOT NULL,
    "recommended_daily_amount" numeric(12,2),
    "recommended_accommodation_daily_amount" numeric(12,2),
    "recommended_food_daily_amount" numeric(12,2),
    "recommended_transport_daily_amount" numeric(12,2),
    "recommended_activities_daily_amount" numeric(12,2),
    "recommended_misc_daily_amount" numeric(12,2),
    "source_mode" "text" DEFAULT 'reference_suggested'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "period_budget_reference_override_adult_chk" CHECK ((("adult_count" IS NULL) OR ("adult_count" >= 1))),
    CONSTRAINT "period_budget_reference_override_age_max_chk" CHECK ((("traveler_age_max" IS NULL) OR ("traveler_age_max" >= 0))),
    CONSTRAINT "period_budget_reference_override_age_min_chk" CHECK ((("traveler_age_min" IS NULL) OR ("traveler_age_min" >= 0))),
    CONSTRAINT "period_budget_reference_override_child_chk" CHECK ((("child_count" IS NULL) OR ("child_count" >= 0))),
    CONSTRAINT "period_budget_reference_override_country_code_chk" CHECK ((("country_code" IS NULL) OR ("country_code" ~ '^[A-Z]{2,3}$'::"text"))),
    CONSTRAINT "period_budget_reference_override_profile_chk" CHECK ((("travel_profile" IS NULL) OR ("travel_profile" = ANY (ARRAY['solo'::"text", 'couple'::"text", 'family'::"text"])))),
    CONSTRAINT "period_budget_reference_override_source_mode_chk" CHECK (("source_mode" = ANY (ARRAY['manual_only'::"text", 'reference_suggested'::"text", 'reference_applied'::"text", 'reference_modified'::"text"]))),
    CONSTRAINT "period_budget_reference_override_style_chk" CHECK ((("travel_style" IS NULL) OR ("travel_style" = ANY (ARRAY['budget'::"text", 'standard'::"text", 'comfort'::"text"])))),
    CONSTRAINT "period_budget_reference_override_trip_days_chk" CHECK ((("trip_days" IS NULL) OR ("trip_days" >= 1)))
);


ALTER TABLE "public"."period_budget_reference_override" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."periods" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "base_currency" "text" NOT NULL,
    "eur_base_rate" numeric DEFAULT 35 NOT NULL,
    "daily_budget_base" numeric DEFAULT 1000 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "travel_id" "uuid",
    CONSTRAINT "periods_base_currency_iso3_chk" CHECK (("base_currency" ~ '^[A-Z]{3}$'::"text")),
    CONSTRAINT "periods_date_check" CHECK (("end_date" >= "start_date"))
);


ALTER TABLE "public"."periods" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text",
    "role" "text" DEFAULT 'member'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recurring_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "travel_id" "uuid" NOT NULL,
    "wallet_id" "uuid" NOT NULL,
    "label" "text" NOT NULL,
    "type" "text" NOT NULL,
    "amount" numeric NOT NULL,
    "currency" "text" NOT NULL,
    "category" "text",
    "subcategory" "text",
    "rule_type" "text" NOT NULL,
    "interval_count" integer DEFAULT 1 NOT NULL,
    "weekday" integer,
    "monthday" integer,
    "week_of_month" integer,
    "start_date" "date" NOT NULL,
    "end_date" "date",
    "max_occurrences" integer,
    "next_due_at" "date",
    "generated_until" "date",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "archived" boolean DEFAULT false NOT NULL,
    "archived_at" timestamp with time zone,
    "out_of_budget" boolean DEFAULT false NOT NULL,
    CONSTRAINT "recurring_rules_amount_check" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "recurring_rules_currency_check" CHECK (("currency" ~ '^[A-Z]{3}$'::"text")),
    CONSTRAINT "recurring_rules_dates_ok" CHECK ((("end_date" IS NULL) OR ("end_date" >= "start_date"))),
    CONSTRAINT "recurring_rules_interval_count_check" CHECK (("interval_count" > 0)),
    CONSTRAINT "recurring_rules_label_nonempty" CHECK (("length"(TRIM(BOTH FROM "label")) > 0)),
    CONSTRAINT "recurring_rules_max_occurrences_check" CHECK ((("max_occurrences" IS NULL) OR ("max_occurrences" > 0))),
    CONSTRAINT "recurring_rules_monthday_check" CHECK ((("monthday" >= 1) AND ("monthday" <= 31))),
    CONSTRAINT "recurring_rules_rule_type_check" CHECK (("rule_type" = ANY (ARRAY['daily'::"text", 'weekly'::"text", 'monthly'::"text", 'every_x_months'::"text", 'yearly'::"text", 'nth_weekday_month'::"text"]))),
    CONSTRAINT "recurring_rules_type_check" CHECK (("type" = ANY (ARRAY['expense'::"text", 'income'::"text"]))),
    CONSTRAINT "recurring_rules_week_of_month_check" CHECK ((("week_of_month" >= 1) AND ("week_of_month" <= 5))),
    CONSTRAINT "recurring_rules_weekday_check" CHECK ((("weekday" >= 0) AND ("weekday" <= 6)))
);


ALTER TABLE "public"."recurring_rules" OWNER TO "postgres";


COMMENT ON COLUMN "public"."recurring_rules"."subcategory" IS 'Optional subcategory attached to the selected category for recurring rules.';



CREATE TABLE IF NOT EXISTS "public"."schema_version" (
    "key" "text" NOT NULL,
    "version" integer NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."schema_version" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."settings" (
    "user_id" "uuid" NOT NULL,
    "period_start" "date",
    "period_end" "date",
    "daily_budget_thb" numeric DEFAULT 1000 NOT NULL,
    "eur_thb_rate" numeric DEFAULT 35 NOT NULL,
    "theme" "text" DEFAULT 'light'::"text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "periods" "jsonb",
    "palette_json" "jsonb",
    "palette_preset" "text",
    "base_currency" "text" DEFAULT 'EUR'::"text",
    "ui_mode" "text" DEFAULT 'advanced'::"text" NOT NULL,
    CONSTRAINT "settings_base_currency_iso3_chk" CHECK ((("base_currency" IS NULL) OR ("base_currency" ~ '^[A-Z]{3}$'::"text"))),
    CONSTRAINT "settings_ui_mode_chk" CHECK (("ui_mode" = ANY (ARRAY['simple'::"text", 'advanced'::"text"])))
);


ALTER TABLE "public"."settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "wallet_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "amount" numeric NOT NULL,
    "currency" "text" NOT NULL,
    "category" "text" NOT NULL,
    "label" "text",
    "date_start" "date" NOT NULL,
    "date_end" "date" NOT NULL,
    "pay_now" boolean DEFAULT true NOT NULL,
    "out_of_budget" boolean DEFAULT false NOT NULL,
    "night_covered" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "period_id" "uuid" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "trip_expense_id" "uuid",
    "affects_budget" boolean DEFAULT true NOT NULL,
    "trip_share_link_id" "uuid",
    "is_internal" boolean DEFAULT false NOT NULL,
    "fx_rate_snapshot" numeric,
    "fx_source_snapshot" "text",
    "fx_snapshot_at" timestamp with time zone DEFAULT "now"(),
    "fx_base_currency_snapshot" "text",
    "fx_tx_currency_snapshot" "text",
    "subcategory" "text",
    "travel_id" "uuid",
    "recurring_rule_id" "uuid",
    "occurrence_date" "date",
    "generated_by_rule" boolean DEFAULT false NOT NULL,
    "recurring_instance_status" "text" DEFAULT 'confirmed'::"text",
    "budget_date_start" "date" NOT NULL,
    "budget_date_end" "date" NOT NULL,
    CONSTRAINT "transactions_amount_check" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "transactions_budget_date_order_chk" CHECK (("budget_date_end" >= "budget_date_start")),
    CONSTRAINT "transactions_currency_iso3_chk" CHECK (("currency" ~ '^[A-Z]{3}$'::"text")),
    CONSTRAINT "transactions_fx_snapshot_consistency" CHECK (((("fx_rate_snapshot" IS NULL) AND ("fx_source_snapshot" IS NULL)) OR (("fx_rate_snapshot" IS NOT NULL) AND ("fx_source_snapshot" IS NOT NULL)))),
    CONSTRAINT "transactions_recurring_instance_status_chk" CHECK (("recurring_instance_status" = ANY (ARRAY['generated'::"text", 'confirmed'::"text", 'detached'::"text", 'skipped'::"text"]))),
    CONSTRAINT "transactions_type_check" CHECK (("type" = ANY (ARRAY['expense'::"text", 'income'::"text"])))
);


ALTER TABLE "public"."transactions" OWNER TO "postgres";


COMMENT ON COLUMN "public"."transactions"."is_internal" IS 'True for internal/shadow rows (Trip budget-only allocations). Hidden from main transactions view and excluded from wallet cashflow.';



COMMENT ON COLUMN "public"."transactions"."subcategory" IS 'Optional subcategory attached to the selected category.';



CREATE TABLE IF NOT EXISTS "public"."travel_budget_reference_profile" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "travel_id" "uuid" NOT NULL,
    "reference_id" "uuid",
    "country_code" "text" NOT NULL,
    "region_code" "text",
    "travel_profile" "text" NOT NULL,
    "travel_style" "text" NOT NULL,
    "adult_count" integer DEFAULT 1 NOT NULL,
    "child_count" integer DEFAULT 0 NOT NULL,
    "trip_days" integer,
    "traveler_age_min" integer,
    "traveler_age_max" integer,
    "base_daily_reference_amount" numeric(12,2),
    "style_multiplier" numeric(8,4) DEFAULT 1.0000 NOT NULL,
    "profile_multiplier" numeric(8,4) DEFAULT 1.0000 NOT NULL,
    "duration_multiplier" numeric(8,4) DEFAULT 1.0000 NOT NULL,
    "recommended_daily_amount" numeric(12,2),
    "recommended_accommodation_daily_amount" numeric(12,2),
    "recommended_food_daily_amount" numeric(12,2),
    "recommended_transport_daily_amount" numeric(12,2),
    "recommended_activities_daily_amount" numeric(12,2),
    "recommended_misc_daily_amount" numeric(12,2),
    "source_mode" "text" DEFAULT 'reference_suggested'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "travel_budget_reference_profile_adult_count_check" CHECK (("adult_count" >= 1)),
    CONSTRAINT "travel_budget_reference_profile_child_count_check" CHECK (("child_count" >= 0)),
    CONSTRAINT "travel_budget_reference_profile_country_code_chk" CHECK (("country_code" ~ '^[A-Z]{2,3}$'::"text")),
    CONSTRAINT "travel_budget_reference_profile_source_mode_check" CHECK (("source_mode" = ANY (ARRAY['manual_only'::"text", 'reference_suggested'::"text", 'reference_applied'::"text", 'reference_modified'::"text"]))),
    CONSTRAINT "travel_budget_reference_profile_travel_profile_check" CHECK (("travel_profile" = ANY (ARRAY['solo'::"text", 'couple'::"text", 'family'::"text"]))),
    CONSTRAINT "travel_budget_reference_profile_travel_style_check" CHECK (("travel_style" = ANY (ARRAY['budget'::"text", 'standard'::"text", 'comfort'::"text"]))),
    CONSTRAINT "travel_budget_reference_profile_traveler_age_max_check" CHECK ((("traveler_age_max" IS NULL) OR ("traveler_age_max" >= 0))),
    CONSTRAINT "travel_budget_reference_profile_traveler_age_min_check" CHECK ((("traveler_age_min" IS NULL) OR ("traveler_age_min" >= 0))),
    CONSTRAINT "travel_budget_reference_profile_trip_days_check" CHECK ((("trip_days" IS NULL) OR ("trip_days" >= 1)))
);


ALTER TABLE "public"."travel_budget_reference_profile" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."travel_day_moves" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "travel_day_log_id" "uuid" NOT NULL,
    "seq_no" integer DEFAULT 1 NOT NULL,
    "move_kind" "text" DEFAULT 'transfer'::"text" NOT NULL,
    "departure_place_label" "text",
    "departure_country_code" "text",
    "departure_lat" numeric(9,6),
    "departure_lng" numeric(9,6),
    "arrival_place_label" "text",
    "arrival_country_code" "text",
    "arrival_lat" numeric(9,6),
    "arrival_lng" numeric(9,6),
    "travel_mode" "text" NOT NULL,
    "distance_km" numeric(9,2),
    "duration_minutes" integer,
    "is_border_crossing" boolean DEFAULT false NOT NULL,
    "is_main_move" boolean DEFAULT false NOT NULL,
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "travel_day_moves_distance_chk" CHECK ((("distance_km" IS NULL) OR ("distance_km" >= (0)::numeric))),
    CONSTRAINT "travel_day_moves_duration_chk" CHECK ((("duration_minutes" IS NULL) OR ("duration_minutes" >= 0))),
    CONSTRAINT "travel_day_moves_move_kind_chk" CHECK (("move_kind" = ANY (ARRAY['transfer'::"text", 'outing'::"text", 'return'::"text", 'detour'::"text", 'other'::"text"]))),
    CONSTRAINT "travel_day_moves_seq_positive_chk" CHECK (("seq_no" >= 1)),
    CONSTRAINT "travel_day_moves_travel_mode_chk" CHECK (("travel_mode" = ANY (ARRAY['walk'::"text", 'bike'::"text", 'motorbike'::"text", 'car'::"text", 'bus'::"text", 'train'::"text", 'boat'::"text", 'flight'::"text", 'hitchhiking'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."travel_day_moves" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."travels" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "base_currency" "text",
    "start_date" "date",
    "end_date" "date",
    "is_default" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "travels_base_currency_iso3_chk" CHECK ((("base_currency" IS NULL) OR ("base_currency" ~ '^[A-Z]{3}$'::"text"))),
    CONSTRAINT "travels_date_check" CHECK ((("end_date" IS NULL) OR ("start_date" IS NULL) OR ("end_date" >= "start_date"))),
    CONSTRAINT "travels_name_nonempty" CHECK (("length"(TRIM(BOTH FROM "name")) > 0))
);


ALTER TABLE "public"."travels" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trip_expense_budget_links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "trip_id" "uuid" NOT NULL,
    "expense_id" "uuid" NOT NULL,
    "member_id" "uuid" NOT NULL,
    "transaction_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."trip_expense_budget_links" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trip_expense_shares" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "expense_id" "uuid" NOT NULL,
    "member_id" "uuid" NOT NULL,
    "share_amount" numeric NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "trip_id" "uuid" NOT NULL,
    CONSTRAINT "trip_expense_shares_share_amount_check" CHECK (("share_amount" >= (0)::numeric))
);


ALTER TABLE "public"."trip_expense_shares" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trip_expenses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "label" "text" NOT NULL,
    "amount" numeric NOT NULL,
    "currency" "text" NOT NULL,
    "paid_by_member_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "trip_id" "uuid" NOT NULL,
    "transaction_id" "uuid",
    "category" "text",
    "subcategory" "text",
    "budget_date_start" "date",
    "budget_date_end" "date",
    CONSTRAINT "trip_expenses_amount_check" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "trip_expenses_currency_iso3_chk" CHECK (("currency" ~ '^[A-Z]{3}$'::"text"))
);


ALTER TABLE "public"."trip_expenses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trip_groups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "period_id" "uuid",
    "name" "text" NOT NULL,
    "base_currency" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "trip_groups_base_currency_iso3_chk" CHECK (("base_currency" ~ '^[A-Z]{3}$'::"text"))
);


ALTER TABLE "public"."trip_groups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trip_invites" (
    "token" "text" NOT NULL,
    "trip_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "used_at" timestamp with time zone,
    "member_id" "uuid",
    CONSTRAINT "trip_invites_role_check" CHECK (("role" = ANY (ARRAY['member'::"text", 'viewer'::"text"])))
);


ALTER TABLE "public"."trip_invites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trip_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "is_me" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "trip_id" "uuid" NOT NULL,
    "auth_user_id" "uuid",
    "email" "text"
);


ALTER TABLE "public"."trip_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trip_participants" (
    "trip_id" "uuid" NOT NULL,
    "auth_user_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "trip_participants_role_check" CHECK (("role" = ANY (ARRAY['owner'::"text", 'member'::"text", 'viewer'::"text"])))
);


ALTER TABLE "public"."trip_participants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trip_settlement_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "trip_id" "uuid" NOT NULL,
    "currency" "text" NOT NULL,
    "amount" numeric NOT NULL,
    "from_member_id" "uuid" NOT NULL,
    "to_member_id" "uuid" NOT NULL,
    "transaction_id" "uuid",
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "cancelled_at" timestamp with time zone,
    CONSTRAINT "trip_settlement_events_amount_check" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "trip_settlement_events_currency_check" CHECK (("currency" ~ '^[A-Z]{3}$'::"text"))
);


ALTER TABLE "public"."trip_settlement_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trip_settlements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "amount" numeric NOT NULL,
    "currency" "text" NOT NULL,
    "direction" "text" NOT NULL,
    "wallet_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "trip_id" "uuid" NOT NULL,
    "mode" "text" NOT NULL,
    CONSTRAINT "trip_settlements_amount_check" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "trip_settlements_currency_iso3_chk" CHECK (("currency" ~ '^[A-Z]{3}$'::"text")),
    CONSTRAINT "trip_settlements_direction_check" CHECK (("direction" = ANY (ARRAY['in'::"text", 'out'::"text"]))),
    CONSTRAINT "trip_settlements_mode_check" CHECK (("mode" = ANY (ARRAY['cash'::"text", 'virtual'::"text"])))
);


ALTER TABLE "public"."trip_settlements" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_transaction_analytic_mapping" WITH ("security_invoker"='true') AS
 WITH "tx" AS (
         SELECT "t"."id" AS "transaction_id",
            "t"."user_id",
            "t"."travel_id",
            "t"."period_id",
            "t"."wallet_id",
            "t"."type",
            "t"."amount",
            "t"."currency",
            "t"."category",
            "t"."subcategory",
            "t"."label",
            "t"."date_start",
            "t"."date_end",
            "t"."pay_now",
            "t"."out_of_budget",
            "t"."affects_budget",
            "t"."is_internal",
            "t"."night_covered"
           FROM "public"."transactions" "t"
        ), "subcategory_match" AS (
         SELECT "tx"."transaction_id",
            "m"."id" AS "mapping_id",
            "m"."mapping_status",
            "m"."analytic_family"
           FROM ("tx"
             JOIN "public"."analytic_category_mappings" "m" ON ((("m"."user_id" = "tx"."user_id") AND ("lower"(TRIM(BOTH FROM "m"."category_name")) = "lower"(TRIM(BOTH FROM "tx"."category"))) AND ("lower"(TRIM(BOTH FROM COALESCE("m"."subcategory_name", ''::"text"))) = "lower"(TRIM(BOTH FROM COALESCE("tx"."subcategory", ''::"text")))) AND ("tx"."subcategory" IS NOT NULL))))
        ), "category_match" AS (
         SELECT "tx"."transaction_id",
            "m"."id" AS "mapping_id",
            "m"."mapping_status",
            "m"."analytic_family"
           FROM ("tx"
             JOIN "public"."analytic_category_mappings" "m" ON ((("m"."user_id" = "tx"."user_id") AND ("lower"(TRIM(BOTH FROM "m"."category_name")) = "lower"(TRIM(BOTH FROM "tx"."category"))) AND ("m"."subcategory_name" IS NULL))))
        ), "resolved" AS (
         SELECT "tx"."transaction_id",
            "tx"."user_id",
            "tx"."travel_id",
            "tx"."period_id",
            "tx"."wallet_id",
            "tx"."type",
            "tx"."amount",
            "tx"."currency",
            "tx"."category",
            "tx"."subcategory",
            "tx"."label",
            "tx"."date_start",
            "tx"."date_end",
            "tx"."pay_now",
            "tx"."out_of_budget",
            "tx"."affects_budget",
            "tx"."is_internal",
            "tx"."night_covered",
            "sm"."mapping_id" AS "subcategory_mapping_id",
            "sm"."mapping_status" AS "subcategory_mapping_status",
            "sm"."analytic_family" AS "subcategory_analytic_family",
            "cm"."mapping_id" AS "category_mapping_id",
            "cm"."mapping_status" AS "category_mapping_status",
            "cm"."analytic_family" AS "category_analytic_family"
           FROM (("tx"
             LEFT JOIN "subcategory_match" "sm" ON (("sm"."transaction_id" = "tx"."transaction_id")))
             LEFT JOIN "category_match" "cm" ON (("cm"."transaction_id" = "tx"."transaction_id")))
        )
 SELECT "transaction_id",
    "user_id",
    "travel_id",
    "period_id",
    "wallet_id",
    "type",
    "amount",
    "currency",
    "category",
    "subcategory",
    "label",
    "date_start",
    "date_end",
    "pay_now",
    "out_of_budget",
    "affects_budget",
    "is_internal",
    "night_covered",
    COALESCE("subcategory_mapping_id", "category_mapping_id") AS "mapping_id",
    COALESCE("subcategory_mapping_status", "category_mapping_status", 'unmapped'::"text") AS "mapping_status",
    COALESCE("subcategory_analytic_family", "category_analytic_family") AS "analytic_family",
        CASE
            WHEN ("subcategory_mapping_id" IS NOT NULL) THEN 'subcategory_exact'::"text"
            WHEN ("category_mapping_id" IS NOT NULL) THEN 'category_only'::"text"
            ELSE 'fallback_unmapped'::"text"
        END AS "mapping_source"
   FROM "resolved" "r";


ALTER VIEW "public"."v_transaction_analytic_mapping" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_analytic_mapping_audit" WITH ("security_invoker"='true') AS
 SELECT "user_id",
    "category",
    "subcategory",
    "mapping_status",
    "analytic_family",
    "mapping_source",
    "count"(*) AS "tx_count",
    "count"(*) FILTER (WHERE ("type" = 'expense'::"text")) AS "expense_count",
    "count"(*) FILTER (WHERE ("type" = 'income'::"text")) AS "income_count",
    COALESCE("sum"(
        CASE
            WHEN ("type" = 'expense'::"text") THEN "amount"
            ELSE (0)::numeric
        END), (0)::numeric) AS "expense_amount_sum",
    COALESCE("sum"(
        CASE
            WHEN ("type" = 'income'::"text") THEN "amount"
            ELSE (0)::numeric
        END), (0)::numeric) AS "income_amount_sum",
    "min"("date_start") AS "first_seen_date",
    "max"("date_start") AS "last_seen_date"
   FROM "public"."v_transaction_analytic_mapping" "v"
  GROUP BY "user_id", "category", "subcategory", "mapping_status", "analytic_family", "mapping_source";


ALTER VIEW "public"."v_analytic_mapping_audit" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_country_budget_reference_latest" WITH ("security_invoker"='true') AS
 SELECT "id",
    "country_code",
    "country_name",
    "region_code",
    "region_name",
    "source_name",
    "source_url",
    "source_label",
    "source_published_at",
    "source_year",
    "currency_code",
    "daily_budget_amount",
    "solo_daily_amount",
    "couple_per_person_daily_amount",
    "family_per_person_daily_amount",
    "short_trip_daily_amount",
    "long_trip_daily_amount",
    "accommodation_daily_amount",
    "food_daily_amount",
    "transport_daily_amount",
    "activities_daily_amount",
    "misc_daily_amount",
    "sample_size",
    "methodology_note",
    "raw_notes",
    "is_active",
    "fetched_at",
    "created_at",
    "updated_at",
    "rn"
   FROM ( SELECT "cbr"."id",
            "cbr"."country_code",
            "cbr"."country_name",
            "cbr"."region_code",
            "cbr"."region_name",
            "cbr"."source_name",
            "cbr"."source_url",
            "cbr"."source_label",
            "cbr"."source_published_at",
            "cbr"."source_year",
            "cbr"."currency_code",
            "cbr"."daily_budget_amount",
            "cbr"."solo_daily_amount",
            "cbr"."couple_per_person_daily_amount",
            "cbr"."family_per_person_daily_amount",
            "cbr"."short_trip_daily_amount",
            "cbr"."long_trip_daily_amount",
            "cbr"."accommodation_daily_amount",
            "cbr"."food_daily_amount",
            "cbr"."transport_daily_amount",
            "cbr"."activities_daily_amount",
            "cbr"."misc_daily_amount",
            "cbr"."sample_size",
            "cbr"."methodology_note",
            "cbr"."raw_notes",
            "cbr"."is_active",
            "cbr"."fetched_at",
            "cbr"."created_at",
            "cbr"."updated_at",
            "row_number"() OVER (PARTITION BY "cbr"."country_code", COALESCE("cbr"."region_code", ''::"text") ORDER BY COALESCE("cbr"."source_published_at", "make_date"(COALESCE("cbr"."source_year", 1900), 1, 1)) DESC, "cbr"."created_at" DESC) AS "rn"
           FROM "public"."country_budget_reference" "cbr"
          WHERE ("cbr"."is_active" = true)) "x"
  WHERE ("rn" = 1);


ALTER VIEW "public"."v_country_budget_reference_latest" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_period_budget_reference_resolved" WITH ("security_invoker"='true') AS
 SELECT "p"."id" AS "period_id",
    "p"."user_id",
    "p"."travel_id",
    "p"."start_date",
    "p"."end_date",
    "p"."base_currency" AS "period_base_currency",
    "t"."name" AS "travel_name",
    "t"."base_currency" AS "travel_base_currency",
        CASE
            WHEN (("pbo"."id" IS NOT NULL) AND "pbo"."is_enabled") THEN true
            ELSE false
        END AS "has_period_override",
    COALESCE(
        CASE
            WHEN "pbo"."is_enabled" THEN "pbo"."country_code"
            ELSE NULL::"text"
        END, "tbp"."country_code") AS "resolved_country_code",
    COALESCE(
        CASE
            WHEN "pbo"."is_enabled" THEN "pbo"."region_code"
            ELSE NULL::"text"
        END, "tbp"."region_code") AS "resolved_region_code",
    COALESCE(
        CASE
            WHEN "pbo"."is_enabled" THEN "pbo"."travel_profile"
            ELSE NULL::"text"
        END, "tbp"."travel_profile") AS "resolved_travel_profile",
    COALESCE(
        CASE
            WHEN "pbo"."is_enabled" THEN "pbo"."travel_style"
            ELSE NULL::"text"
        END, "tbp"."travel_style") AS "resolved_travel_style",
    COALESCE(
        CASE
            WHEN "pbo"."is_enabled" THEN "pbo"."adult_count"
            ELSE NULL::integer
        END, "tbp"."adult_count", 1) AS "resolved_adult_count",
    COALESCE(
        CASE
            WHEN "pbo"."is_enabled" THEN "pbo"."child_count"
            ELSE NULL::integer
        END, "tbp"."child_count", 0) AS "resolved_child_count",
    COALESCE(
        CASE
            WHEN "pbo"."is_enabled" THEN "pbo"."trip_days"
            ELSE NULL::integer
        END, "tbp"."trip_days", (("p"."end_date" - "p"."start_date") + 1)) AS "resolved_trip_days",
    COALESCE(
        CASE
            WHEN "pbo"."is_enabled" THEN "pbo"."traveler_age_min"
            ELSE NULL::integer
        END, "tbp"."traveler_age_min") AS "resolved_traveler_age_min",
    COALESCE(
        CASE
            WHEN "pbo"."is_enabled" THEN "pbo"."traveler_age_max"
            ELSE NULL::integer
        END, "tbp"."traveler_age_max") AS "resolved_traveler_age_max",
    "tbp"."id" AS "travel_profile_id",
    "pbo"."id" AS "period_override_id",
    "tbp"."reference_id" AS "travel_reference_id",
    "pbo"."reference_id" AS "period_reference_id",
    "tbp"."recommended_daily_amount" AS "travel_recommended_daily_amount",
    "pbo"."recommended_daily_amount" AS "period_recommended_daily_amount",
    COALESCE(
        CASE
            WHEN "pbo"."is_enabled" THEN "pbo"."source_mode"
            ELSE NULL::"text"
        END, "tbp"."source_mode") AS "resolved_source_mode"
   FROM ((("public"."periods" "p"
     JOIN "public"."travels" "t" ON (("t"."id" = "p"."travel_id")))
     LEFT JOIN "public"."travel_budget_reference_profile" "tbp" ON ((("tbp"."travel_id" = "p"."travel_id") AND ("tbp"."user_id" = "p"."user_id"))))
     LEFT JOIN "public"."period_budget_reference_override" "pbo" ON ((("pbo"."period_id" = "p"."id") AND ("pbo"."user_id" = "p"."user_id"))));


ALTER VIEW "public"."v_period_budget_reference_resolved" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_transaction_analytic_expenses" WITH ("security_invoker"='true') AS
 SELECT "transaction_id",
    "user_id",
    "travel_id",
    "period_id",
    "wallet_id",
    "type",
    "amount",
    "currency",
    "category",
    "subcategory",
    "label",
    "date_start",
    "date_end",
    "pay_now",
    "out_of_budget",
    "affects_budget",
    "is_internal",
    "night_covered",
    "mapping_id",
    "mapping_status",
    "analytic_family",
    "mapping_source"
   FROM "public"."v_transaction_analytic_mapping"
  WHERE (("type" = 'expense'::"text") AND (COALESCE("is_internal", false) = false) AND ("mapping_status" = 'mapped'::"text"));


ALTER VIEW "public"."v_transaction_analytic_expenses" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_travel_day_summary" WITH ("security_invoker"='true') AS
 WITH "move_agg" AS (
         SELECT "m"."travel_day_log_id",
            "count"("m"."id") AS "move_count",
            COALESCE("sum"("m"."distance_km"), (0)::numeric) AS "total_distance_km",
            COALESCE("sum"("m"."duration_minutes"), (0)::bigint) AS "total_duration_minutes"
           FROM "public"."travel_day_moves" "m"
          GROUP BY "m"."travel_day_log_id"
        ), "first_move" AS (
         SELECT DISTINCT ON ("m"."travel_day_log_id") "m"."travel_day_log_id",
            "m"."departure_place_label" AS "first_departure_place_label",
            "m"."departure_country_code" AS "first_departure_country_code",
            "m"."departure_lat" AS "first_departure_lat",
            "m"."departure_lng" AS "first_departure_lng"
           FROM "public"."travel_day_moves" "m"
          ORDER BY "m"."travel_day_log_id", "m"."seq_no", "m"."created_at"
        ), "last_move" AS (
         SELECT DISTINCT ON ("m"."travel_day_log_id") "m"."travel_day_log_id",
            "m"."arrival_place_label" AS "last_arrival_place_label",
            "m"."arrival_country_code" AS "last_arrival_country_code",
            "m"."arrival_lat" AS "last_arrival_lat",
            "m"."arrival_lng" AS "last_arrival_lng"
           FROM "public"."travel_day_moves" "m"
          ORDER BY "m"."travel_day_log_id", "m"."seq_no" DESC, "m"."created_at" DESC
        )
 SELECT "l"."id",
    "l"."travel_id",
    "l"."user_id",
    "l"."log_date",
    "l"."end_place_label",
    "l"."end_country_code",
    "l"."end_lat",
    "l"."end_lng",
    "l"."travel_mode_main",
    "l"."overnight_mode",
    "l"."no_move_declared",
    "l"."crossed_border",
    "l"."is_rest_day",
    "l"."note",
    COALESCE("ma"."move_count", (0)::bigint) AS "move_count",
    COALESCE("ma"."total_distance_km", (0)::numeric) AS "total_distance_km",
    COALESCE("ma"."total_duration_minutes", (0)::bigint) AS "total_duration_minutes",
    "f"."first_departure_place_label",
    "f"."first_departure_country_code",
    "f"."first_departure_lat",
    "f"."first_departure_lng",
    "lm"."last_arrival_place_label",
    "lm"."last_arrival_country_code",
    "lm"."last_arrival_lat",
    "lm"."last_arrival_lng",
        CASE
            WHEN ("l"."no_move_declared" = true) THEN 'stationary'::"text"
            WHEN (COALESCE("ma"."move_count", (0)::bigint) = 0) THEN 'unknown'::"text"
            WHEN (COALESCE("ma"."move_count", (0)::bigint) = 1) THEN
            CASE
                WHEN ((COALESCE("lower"(TRIM(BOTH FROM "f"."first_departure_place_label")), ''::"text") = COALESCE("lower"(TRIM(BOTH FROM "lm"."last_arrival_place_label")), ''::"text")) AND (COALESCE("f"."first_departure_country_code", ''::"text") = COALESCE("lm"."last_arrival_country_code", ''::"text"))) THEN 'round_trip'::"text"
                ELSE 'one_way'::"text"
            END
            ELSE
            CASE
                WHEN ((COALESCE("lower"(TRIM(BOTH FROM "f"."first_departure_place_label")), ''::"text") = COALESCE("lower"(TRIM(BOTH FROM "lm"."last_arrival_place_label")), ''::"text")) AND (COALESCE("f"."first_departure_country_code", ''::"text") = COALESCE("lm"."last_arrival_country_code", ''::"text"))) THEN 'round_trip'::"text"
                ELSE 'multi_stop'::"text"
            END
        END AS "day_pattern"
   FROM ((("public"."travel_day_logs" "l"
     LEFT JOIN "move_agg" "ma" ON (("ma"."travel_day_log_id" = "l"."id")))
     LEFT JOIN "first_move" "f" ON (("f"."travel_day_log_id" = "l"."id")))
     LEFT JOIN "last_move" "lm" ON (("lm"."travel_day_log_id" = "l"."id")));


ALTER VIEW "public"."v_travel_day_summary" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_travel_day_ui" WITH ("security_invoker"='true') AS
 WITH "base" AS (
         SELECT "s"."id",
            "s"."travel_id",
            "s"."user_id",
            "s"."log_date",
            "s"."end_place_label",
            "s"."end_country_code",
            "s"."end_lat",
            "s"."end_lng",
            "s"."travel_mode_main",
            "s"."overnight_mode",
            "s"."no_move_declared",
            "s"."crossed_border",
            "s"."is_rest_day",
            "s"."note",
            "s"."move_count",
            "s"."total_distance_km",
            "s"."total_duration_minutes",
            "s"."first_departure_place_label",
            "s"."first_departure_country_code",
            "s"."first_departure_lat",
            "s"."first_departure_lng",
            "s"."last_arrival_place_label",
            "s"."last_arrival_country_code",
            "s"."last_arrival_lat",
            "s"."last_arrival_lng",
            "s"."day_pattern",
            (("s"."end_place_label" IS NOT NULL) OR ("s"."end_country_code" IS NOT NULL)) AS "has_end_place"
           FROM "public"."v_travel_day_summary" "s"
        ), "resolved" AS (
         SELECT "b"."id",
            "b"."travel_id",
            "b"."user_id",
            "b"."log_date",
            "b"."end_place_label",
            "b"."end_country_code",
            "b"."end_lat",
            "b"."end_lng",
            "b"."travel_mode_main",
            "b"."overnight_mode",
            "b"."no_move_declared",
            "b"."crossed_border",
            "b"."is_rest_day",
            "b"."note",
            "b"."move_count",
            "b"."total_distance_km",
            "b"."total_duration_minutes",
            "b"."first_departure_place_label",
            "b"."first_departure_country_code",
            "b"."first_departure_lat",
            "b"."first_departure_lng",
            "b"."last_arrival_place_label",
            "b"."last_arrival_country_code",
            "b"."last_arrival_lat",
            "b"."last_arrival_lng",
            "b"."day_pattern",
            "b"."has_end_place",
            "sp"."end_lat" AS "same_place_fallback_lat",
            "sp"."end_lng" AS "same_place_fallback_lng"
           FROM ("base" "b"
             LEFT JOIN LATERAL ( SELECT "l"."end_lat",
                    "l"."end_lng"
                   FROM "public"."travel_day_logs" "l"
                  WHERE (("l"."travel_id" = "b"."travel_id") AND ("l"."log_date" < "b"."log_date") AND ("l"."end_lat" IS NOT NULL) AND ("l"."end_lng" IS NOT NULL) AND (COALESCE("lower"(TRIM(BOTH FROM "l"."end_place_label")), ''::"text") = COALESCE("lower"(TRIM(BOTH FROM "b"."end_place_label")), ''::"text")) AND (COALESCE("l"."end_country_code", ''::"text") = COALESCE("b"."end_country_code", ''::"text")))
                  ORDER BY "l"."log_date" DESC
                 LIMIT 1) "sp" ON (true))
        )
 SELECT "id",
    "travel_id",
    "user_id",
    "log_date",
    "end_place_label",
    "end_country_code",
    "end_lat",
    "end_lng",
    COALESCE("end_lat", "same_place_fallback_lat") AS "resolved_end_lat",
    COALESCE("end_lng", "same_place_fallback_lng") AS "resolved_end_lng",
    "travel_mode_main",
    "overnight_mode",
    "no_move_declared",
    "crossed_border",
    "is_rest_day",
    "note",
    "move_count",
    "total_distance_km",
    "total_duration_minutes",
    "first_departure_place_label",
    "first_departure_country_code",
    "first_departure_lat",
    "first_departure_lng",
    "last_arrival_place_label",
    "last_arrival_country_code",
    "last_arrival_lat",
    "last_arrival_lng",
        CASE
            WHEN "no_move_declared" THEN 'stationary'::"text"
            WHEN (("move_count" = 0) AND "has_end_place" AND ("overnight_mode" IS NOT NULL)) THEN 'stationary'::"text"
            ELSE "day_pattern"
        END AS "day_pattern",
        CASE
            WHEN "no_move_declared" THEN true
            WHEN ("move_count" > 0) THEN true
            WHEN ("has_end_place" AND ("overnight_mode" IS NOT NULL)) THEN true
            ELSE false
        END AS "is_day_completed",
        CASE
            WHEN "no_move_declared" THEN 'no_move'::"text"
            WHEN (("move_count" = 0) AND "has_end_place" AND ("overnight_mode" IS NOT NULL)) THEN 'stay'::"text"
            WHEN ("move_count" = 0) THEN 'draft'::"text"
            WHEN ("move_count" = 1) THEN 'simple'::"text"
            ELSE 'detailed'::"text"
        END AS "entry_mode",
    ((COALESCE("end_lat", "same_place_fallback_lat") IS NOT NULL) AND (COALESCE("end_lng", "same_place_fallback_lng") IS NOT NULL)) AS "has_resolved_coordinates"
   FROM "resolved" "r";


ALTER VIEW "public"."v_travel_day_ui" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_trip_balances" WITH ("security_invoker"='true') AS
 WITH "paid" AS (
         SELECT "e"."trip_id",
            "e"."currency",
            "e"."paid_by_member_id" AS "member_id",
            "sum"("e"."amount") AS "paid"
           FROM "public"."trip_expenses" "e"
          WHERE ("e"."paid_by_member_id" IS NOT NULL)
          GROUP BY "e"."trip_id", "e"."currency", "e"."paid_by_member_id"
        ), "owed" AS (
         SELECT "s"."trip_id",
            "e"."currency",
            "s"."member_id",
            "sum"("s"."share_amount") AS "owed"
           FROM ("public"."trip_expense_shares" "s"
             JOIN "public"."trip_expenses" "e" ON (("e"."id" = "s"."expense_id")))
          GROUP BY "s"."trip_id", "e"."currency", "s"."member_id"
        ), "settle" AS (
         SELECT "ev"."trip_id",
            "ev"."currency",
            "ev"."from_member_id" AS "member_id",
            "sum"("ev"."amount") AS "adj"
           FROM "public"."trip_settlement_events" "ev"
          WHERE ("ev"."cancelled_at" IS NULL)
          GROUP BY "ev"."trip_id", "ev"."currency", "ev"."from_member_id"
        UNION ALL
         SELECT "ev"."trip_id",
            "ev"."currency",
            "ev"."to_member_id" AS "member_id",
            (- "sum"("ev"."amount")) AS "adj"
           FROM "public"."trip_settlement_events" "ev"
          WHERE ("ev"."cancelled_at" IS NULL)
          GROUP BY "ev"."trip_id", "ev"."currency", "ev"."to_member_id"
        ), "unioned" AS (
         SELECT "paid"."trip_id",
            "paid"."currency",
            "paid"."member_id",
            "paid"."paid",
            (0)::numeric AS "owed",
            (0)::numeric AS "adj"
           FROM "paid"
        UNION ALL
         SELECT "owed"."trip_id",
            "owed"."currency",
            "owed"."member_id",
            0,
            "owed"."owed",
            0
           FROM "owed"
        UNION ALL
         SELECT "settle"."trip_id",
            "settle"."currency",
            "settle"."member_id",
            0,
            0,
            "settle"."adj"
           FROM "settle"
        ), "agg" AS (
         SELECT "unioned"."trip_id",
            "unioned"."currency",
            "unioned"."member_id",
            "sum"("unioned"."paid") AS "paid",
            "sum"("unioned"."owed") AS "owed",
            "sum"("unioned"."adj") AS "adj"
           FROM "unioned"
          GROUP BY "unioned"."trip_id", "unioned"."currency", "unioned"."member_id"
        )
 SELECT "a"."trip_id",
    "a"."currency",
    "m"."id" AS "member_id",
    "m"."name",
    "m"."email",
    COALESCE("a"."paid", (0)::numeric) AS "paid",
    COALESCE("a"."owed", (0)::numeric) AS "owed",
    (COALESCE("a"."paid", (0)::numeric) - COALESCE("a"."owed", (0)::numeric)) AS "net_raw",
    COALESCE("a"."adj", (0)::numeric) AS "adj",
    ((COALESCE("a"."paid", (0)::numeric) - COALESCE("a"."owed", (0)::numeric)) + COALESCE("a"."adj", (0)::numeric)) AS "net"
   FROM ("agg" "a"
     JOIN "public"."trip_members" "m" ON ((("m"."id" = "a"."member_id") AND ("m"."trip_id" = "a"."trip_id"))));


ALTER VIEW "public"."v_trip_balances" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_trip_budget_potential_duplicates" WITH ("security_invoker"='true') AS
 SELECT "te"."id" AS "trip_expense_id",
    "t"."id" AS "transaction_id",
    "te"."user_id",
    "te"."trip_id",
    "te"."date",
    "te"."amount",
    "te"."currency"
   FROM ("public"."trip_expenses" "te"
     JOIN "public"."transactions" "t" ON ((("t"."user_id" = "te"."user_id") AND ("t"."type" = 'expense'::"text") AND ("t"."currency" = "te"."currency") AND ("t"."amount" = "te"."amount") AND ("t"."date_start" = "te"."date") AND ("t"."date_end" = "te"."date"))))
  WHERE (("te"."transaction_id" IS NULL) AND ("t"."trip_expense_id" IS NULL) AND ("te"."user_id" = "auth"."uid"()) AND ("t"."user_id" = "auth"."uid"()));


ALTER VIEW "public"."v_trip_budget_potential_duplicates" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_trip_expense_budget_links" WITH ("security_invoker"='true') AS
 SELECT "l"."expense_id",
    "l"."member_id",
    "l"."transaction_id"
   FROM ("public"."trip_expense_budget_links" "l"
     JOIN "public"."trip_expenses" "te" ON (("te"."id" = "l"."expense_id")))
  WHERE ("te"."user_id" = "auth"."uid"());


ALTER VIEW "public"."v_trip_expense_budget_links" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_trip_user_net_balances" WITH ("security_invoker"='true') AS
 WITH "my_members" AS (
         SELECT "tm"."trip_id",
            "tm"."id" AS "member_id"
           FROM "public"."trip_members" "tm"
          WHERE ("tm"."auth_user_id" = "auth"."uid"())
        ), "accessible_trips" AS (
         SELECT "tg"."id" AS "trip_id",
            "tg"."name" AS "trip_name"
           FROM "public"."trip_groups" "tg"
          WHERE (EXISTS ( SELECT 1
                   FROM "public"."trip_participants" "tp"
                  WHERE (("tp"."trip_id" = "tg"."id") AND ("tp"."auth_user_id" = "auth"."uid"()))))
        ), "paid" AS (
         SELECT "te"."trip_id",
            "te"."currency",
            "sum"("te"."amount") AS "paid_amount"
           FROM ("public"."trip_expenses" "te"
             JOIN "my_members" "mm" ON ((("mm"."trip_id" = "te"."trip_id") AND ("mm"."member_id" = "te"."paid_by_member_id"))))
          GROUP BY "te"."trip_id", "te"."currency"
        ), "owed" AS (
         SELECT "te"."trip_id",
            "te"."currency",
            "sum"("ts"."share_amount") AS "owed_amount"
           FROM (("public"."trip_expense_shares" "ts"
             JOIN "public"."trip_expenses" "te" ON (("te"."id" = "ts"."expense_id")))
             JOIN "my_members" "mm" ON ((("mm"."trip_id" = "te"."trip_id") AND ("mm"."member_id" = "ts"."member_id"))))
          GROUP BY "te"."trip_id", "te"."currency"
        ), "settle_from" AS (
         SELECT "se"."trip_id",
            "se"."currency",
            "sum"("se"."amount") AS "settle_from_amount"
           FROM ("public"."trip_settlement_events" "se"
             JOIN "my_members" "mm" ON ((("mm"."trip_id" = "se"."trip_id") AND ("mm"."member_id" = "se"."from_member_id"))))
          WHERE ("se"."cancelled_at" IS NULL)
          GROUP BY "se"."trip_id", "se"."currency"
        ), "settle_to" AS (
         SELECT "se"."trip_id",
            "se"."currency",
            "sum"("se"."amount") AS "settle_to_amount"
           FROM ("public"."trip_settlement_events" "se"
             JOIN "my_members" "mm" ON ((("mm"."trip_id" = "se"."trip_id") AND ("mm"."member_id" = "se"."to_member_id"))))
          WHERE ("se"."cancelled_at" IS NULL)
          GROUP BY "se"."trip_id", "se"."currency"
        ), "currencies" AS (
         SELECT "paid"."trip_id",
            "paid"."currency"
           FROM "paid"
        UNION
         SELECT "owed"."trip_id",
            "owed"."currency"
           FROM "owed"
        UNION
         SELECT "settle_from"."trip_id",
            "settle_from"."currency"
           FROM "settle_from"
        UNION
         SELECT "settle_to"."trip_id",
            "settle_to"."currency"
           FROM "settle_to"
        )
 SELECT "at"."trip_id",
    "at"."trip_name",
    "c"."currency",
    COALESCE("p"."paid_amount", (0)::numeric) AS "paid",
    COALESCE("o"."owed_amount", (0)::numeric) AS "owed",
    COALESCE("sf"."settle_from_amount", (0)::numeric) AS "settled_out",
    COALESCE("st"."settle_to_amount", (0)::numeric) AS "settled_in",
    (((COALESCE("p"."paid_amount", (0)::numeric) - COALESCE("o"."owed_amount", (0)::numeric)) + COALESCE("sf"."settle_from_amount", (0)::numeric)) - COALESCE("st"."settle_to_amount", (0)::numeric)) AS "net"
   FROM ((((("accessible_trips" "at"
     JOIN "currencies" "c" ON (("c"."trip_id" = "at"."trip_id")))
     LEFT JOIN "paid" "p" ON ((("p"."trip_id" = "at"."trip_id") AND ("p"."currency" = "c"."currency"))))
     LEFT JOIN "owed" "o" ON ((("o"."trip_id" = "at"."trip_id") AND ("o"."currency" = "c"."currency"))))
     LEFT JOIN "settle_from" "sf" ON ((("sf"."trip_id" = "at"."trip_id") AND ("sf"."currency" = "c"."currency"))))
     LEFT JOIN "settle_to" "st" ON ((("st"."trip_id" = "at"."trip_id") AND ("st"."currency" = "c"."currency"))));


ALTER VIEW "public"."v_trip_user_net_balances" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wallets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "currency" "text" NOT NULL,
    "balance" numeric DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "type" "text" DEFAULT 'cash'::"text" NOT NULL,
    "period_id" "uuid" NOT NULL,
    "balance_snapshot_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "travel_id" "uuid",
    CONSTRAINT "wallets_currency_iso3_chk" CHECK (("currency" ~ '^[A-Z]{3}$'::"text")),
    CONSTRAINT "wallets_type_check" CHECK (("type" = ANY (ARRAY['cash'::"text", 'bank'::"text", 'card'::"text", 'savings'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."wallets" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_wallet_transactions_effect" WITH ("security_invoker"='true') AS
 SELECT "t"."id" AS "transaction_id",
    "t"."user_id",
    "t"."period_id",
    "t"."wallet_id",
    "w"."name" AS "wallet_name",
    "w"."currency" AS "wallet_currency",
    "w"."balance_snapshot_at",
    "t"."created_at",
    "t"."date_start",
    "t"."type",
    "t"."amount",
    "t"."currency" AS "tx_currency",
    COALESCE("t"."pay_now", true) AS "pay_now",
    COALESCE("t"."is_internal", false) AS "is_internal",
    "t"."out_of_budget",
    "t"."affects_budget",
    "t"."trip_expense_id",
    "t"."trip_share_link_id",
        CASE
            WHEN (NOT COALESCE("t"."pay_now", true)) THEN false
            WHEN COALESCE("t"."is_internal", false) THEN false
            WHEN (("w"."balance_snapshot_at" IS NOT NULL) AND ("t"."created_at" < "w"."balance_snapshot_at")) THEN false
            ELSE true
        END AS "included_in_wallet_balance",
        CASE
            WHEN (NOT COALESCE("t"."pay_now", true)) THEN 'unpaid'::"text"
            WHEN COALESCE("t"."is_internal", false) THEN 'internal'::"text"
            WHEN (("w"."balance_snapshot_at" IS NOT NULL) AND ("t"."created_at" < "w"."balance_snapshot_at")) THEN 'pre_snapshot'::"text"
            ELSE NULL::"text"
        END AS "exclusion_reason",
        CASE
            WHEN ("t"."type" = 'income'::"text") THEN "t"."amount"
            WHEN ("t"."type" = 'expense'::"text") THEN (- "t"."amount")
            ELSE (0)::numeric
        END AS "signed_amount",
        CASE
            WHEN (NOT COALESCE("t"."pay_now", true)) THEN (0)::numeric
            WHEN COALESCE("t"."is_internal", false) THEN (0)::numeric
            WHEN (("w"."balance_snapshot_at" IS NOT NULL) AND ("t"."created_at" < "w"."balance_snapshot_at")) THEN (0)::numeric
            WHEN ("t"."type" = 'income'::"text") THEN "t"."amount"
            WHEN ("t"."type" = 'expense'::"text") THEN (- "t"."amount")
            ELSE (0)::numeric
        END AS "effective_signed_amount"
   FROM ("public"."transactions" "t"
     JOIN "public"."wallets" "w" ON ((("w"."id" = "t"."wallet_id") AND ("w"."user_id" = "t"."user_id"))))
  WHERE (("t"."user_id" = "auth"."uid"()) AND ("w"."user_id" = "auth"."uid"()));


ALTER VIEW "public"."v_wallet_transactions_effect" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_wallet_transactions_effect" IS 'Debug view for wallet balance computation. Shows which transactions are included/excluded from effective wallet balances.';



CREATE OR REPLACE VIEW "public"."v_wallet_balances" WITH ("security_invoker"='true') AS
 SELECT "w"."id" AS "wallet_id",
    "w"."user_id",
    "w"."period_id",
    "w"."name" AS "wallet_name",
    "w"."currency" AS "wallet_currency",
    "w"."type" AS "wallet_type",
    "w"."balance" AS "baseline_balance",
    "w"."balance_snapshot_at",
    COALESCE("sum"("v"."effective_signed_amount"), (0)::numeric) AS "transactions_delta",
    ("w"."balance" + COALESCE("sum"("v"."effective_signed_amount"), (0)::numeric)) AS "effective_balance",
    "count"("v"."transaction_id") FILTER (WHERE "v"."included_in_wallet_balance") AS "included_tx_count",
    "count"("v"."transaction_id") FILTER (WHERE ("v"."exclusion_reason" = 'internal'::"text")) AS "excluded_internal_count",
    "count"("v"."transaction_id") FILTER (WHERE ("v"."exclusion_reason" = 'unpaid'::"text")) AS "excluded_unpaid_count",
    "count"("v"."transaction_id") FILTER (WHERE ("v"."exclusion_reason" = 'pre_snapshot'::"text")) AS "excluded_pre_snapshot_count",
    "max"("v"."created_at") FILTER (WHERE "v"."included_in_wallet_balance") AS "last_tx_created_at"
   FROM ("public"."wallets" "w"
     LEFT JOIN "public"."v_wallet_transactions_effect" "v" ON (("v"."wallet_id" = "w"."id")))
  WHERE ("w"."user_id" = "auth"."uid"())
  GROUP BY "w"."id", "w"."user_id", "w"."period_id", "w"."name", "w"."currency", "w"."type", "w"."balance", "w"."balance_snapshot_at";


ALTER VIEW "public"."v_wallet_balances" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_wallet_balances" IS 'Effective wallet balances = wallet baseline snapshot + included paid non-internal transactions after balance_snapshot_at.';



ALTER TABLE ONLY "public"."fx_rates" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."fx_rates_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."analytic_category_mappings"
    ADD CONSTRAINT "analytic_category_mappings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."asset_owners"
    ADD CONSTRAINT "asset_owners_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."asset_ownership_events"
    ADD CONSTRAINT "asset_ownership_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."assets"
    ADD CONSTRAINT "assets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."budget_segment_budget_reference_override"
    ADD CONSTRAINT "budget_segment_budget_reference_override_one_per_segment" UNIQUE ("budget_segment_id");



ALTER TABLE ONLY "public"."budget_segment_budget_reference_override"
    ADD CONSTRAINT "budget_segment_budget_reference_override_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."budget_segments"
    ADD CONSTRAINT "budget_segments_no_overlap" EXCLUDE USING "gist" ("period_id" WITH =, "daterange"("start_date", "end_date", '[]'::"text") WITH &&);



ALTER TABLE ONLY "public"."budget_segments"
    ADD CONSTRAINT "budget_segments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."category_subcategories"
    ADD CONSTRAINT "category_subcategories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."category_subcategories"
    ADD CONSTRAINT "category_subcategories_unique" UNIQUE ("user_id", "category_name", "name");



ALTER TABLE ONLY "public"."country_budget_reference"
    ADD CONSTRAINT "country_budget_reference_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fx_manual_rates"
    ADD CONSTRAINT "fx_manual_rates_pkey" PRIMARY KEY ("user_id", "currency");



ALTER TABLE ONLY "public"."fx_rates"
    ADD CONSTRAINT "fx_rates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."period_budget_reference_override"
    ADD CONSTRAINT "period_budget_reference_override_period_id_key" UNIQUE ("period_id");



ALTER TABLE ONLY "public"."period_budget_reference_override"
    ADD CONSTRAINT "period_budget_reference_override_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."periods"
    ADD CONSTRAINT "periods_no_overlap" EXCLUDE USING "gist" ("user_id" WITH =, "daterange"("start_date", "end_date", '[]'::"text") WITH &&);



ALTER TABLE ONLY "public"."periods"
    ADD CONSTRAINT "periods_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recurring_rules"
    ADD CONSTRAINT "recurring_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."schema_version"
    ADD CONSTRAINT "schema_version_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."settings"
    ADD CONSTRAINT "settings_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_trip_expense_id_uniq" UNIQUE ("trip_expense_id");



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_trip_expense_unique" UNIQUE ("trip_expense_id");



ALTER TABLE ONLY "public"."travel_budget_reference_profile"
    ADD CONSTRAINT "travel_budget_reference_profile_one_per_travel" UNIQUE ("travel_id");



ALTER TABLE ONLY "public"."travel_budget_reference_profile"
    ADD CONSTRAINT "travel_budget_reference_profile_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."travel_day_logs"
    ADD CONSTRAINT "travel_day_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."travel_day_logs"
    ADD CONSTRAINT "travel_day_logs_unique_travel_date" UNIQUE ("travel_id", "log_date");



ALTER TABLE ONLY "public"."travel_day_moves"
    ADD CONSTRAINT "travel_day_moves_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."travel_day_moves"
    ADD CONSTRAINT "travel_day_moves_unique_seq" UNIQUE ("travel_day_log_id", "seq_no");



ALTER TABLE ONLY "public"."travels"
    ADD CONSTRAINT "travels_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trip_expense_budget_links"
    ADD CONSTRAINT "trip_expense_budget_links_expense_member_uq" UNIQUE ("expense_id", "member_id");



ALTER TABLE ONLY "public"."trip_expense_budget_links"
    ADD CONSTRAINT "trip_expense_budget_links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trip_expense_shares"
    ADD CONSTRAINT "trip_expense_shares_expense_id_member_id_key" UNIQUE ("expense_id", "member_id");



ALTER TABLE ONLY "public"."trip_expense_shares"
    ADD CONSTRAINT "trip_expense_shares_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trip_expenses"
    ADD CONSTRAINT "trip_expenses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trip_expenses"
    ADD CONSTRAINT "trip_expenses_transaction_id_uniq" UNIQUE ("transaction_id");



ALTER TABLE ONLY "public"."trip_expenses"
    ADD CONSTRAINT "trip_expenses_transaction_unique" UNIQUE ("transaction_id");



ALTER TABLE ONLY "public"."trip_groups"
    ADD CONSTRAINT "trip_groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trip_invites"
    ADD CONSTRAINT "trip_invites_pkey" PRIMARY KEY ("token");



ALTER TABLE ONLY "public"."trip_members"
    ADD CONSTRAINT "trip_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trip_members"
    ADD CONSTRAINT "trip_members_trip_auth_user_key" UNIQUE ("trip_id", "auth_user_id");



ALTER TABLE ONLY "public"."trip_participants"
    ADD CONSTRAINT "trip_participants_pkey" PRIMARY KEY ("trip_id", "auth_user_id");



ALTER TABLE ONLY "public"."trip_participants"
    ADD CONSTRAINT "trip_participants_trip_auth_unique" UNIQUE ("trip_id", "auth_user_id");



ALTER TABLE ONLY "public"."trip_settlement_events"
    ADD CONSTRAINT "trip_settlement_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trip_settlements"
    ADD CONSTRAINT "trip_settlements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wallets"
    ADD CONSTRAINT "wallets_pkey" PRIMARY KEY ("id");



CREATE UNIQUE INDEX "analytic_category_mappings_user_cat_subcat_uidx" ON "public"."analytic_category_mappings" USING "btree" ("user_id", "lower"(TRIM(BOTH FROM "category_name")), "lower"(TRIM(BOTH FROM COALESCE("subcategory_name", ''::"text"))));



CREATE INDEX "analytic_category_mappings_user_family_idx" ON "public"."analytic_category_mappings" USING "btree" ("user_id", "analytic_family");



CREATE INDEX "analytic_category_mappings_user_idx" ON "public"."analytic_category_mappings" USING "btree" ("user_id");



CREATE INDEX "analytic_category_mappings_user_status_idx" ON "public"."analytic_category_mappings" USING "btree" ("user_id", "mapping_status");



CREATE UNIQUE INDEX "categories_user_name_uq" ON "public"."categories" USING "btree" ("user_id", "lower"("name"));



CREATE INDEX "fx_rates_as_of_idx" ON "public"."fx_rates" USING "btree" ("as_of" DESC);



CREATE INDEX "idx_asset_owners_asset_id" ON "public"."asset_owners" USING "btree" ("asset_id");



CREATE INDEX "idx_asset_ownership_events_asset_id" ON "public"."asset_ownership_events" USING "btree" ("asset_id");



CREATE INDEX "idx_asset_ownership_events_event_date" ON "public"."asset_ownership_events" USING "btree" ("event_date" DESC);



CREATE INDEX "idx_assets_travel_id" ON "public"."assets" USING "btree" ("travel_id");



CREATE INDEX "idx_assets_user_id" ON "public"."assets" USING "btree" ("user_id");



CREATE INDEX "idx_budget_segment_budget_reference_override_country" ON "public"."budget_segment_budget_reference_override" USING "btree" ("country_code");



CREATE INDEX "idx_budget_segment_budget_reference_override_period" ON "public"."budget_segment_budget_reference_override" USING "btree" ("period_id");



CREATE INDEX "idx_budget_segment_budget_reference_override_travel" ON "public"."budget_segment_budget_reference_override" USING "btree" ("travel_id");



CREATE INDEX "idx_budget_segment_budget_reference_override_user" ON "public"."budget_segment_budget_reference_override" USING "btree" ("user_id");



CREATE INDEX "idx_category_subcategories_user_category" ON "public"."category_subcategories" USING "btree" ("user_id", "category_name", "sort_order", "name");



CREATE INDEX "idx_category_subcategories_user_category_id" ON "public"."category_subcategories" USING "btree" ("user_id", "category_id");



CREATE INDEX "idx_country_budget_reference_active" ON "public"."country_budget_reference" USING "btree" ("is_active");



CREATE INDEX "idx_country_budget_reference_country" ON "public"."country_budget_reference" USING "btree" ("country_code");



CREATE INDEX "idx_country_budget_reference_country_region_active" ON "public"."country_budget_reference" USING "btree" ("country_code", "region_code", "is_active");



CREATE INDEX "idx_country_budget_reference_region" ON "public"."country_budget_reference" USING "btree" ("region_code");



CREATE INDEX "idx_period_budget_reference_override_country" ON "public"."period_budget_reference_override" USING "btree" ("country_code");



CREATE INDEX "idx_period_budget_reference_override_travel" ON "public"."period_budget_reference_override" USING "btree" ("travel_id");



CREATE INDEX "idx_period_budget_reference_override_user" ON "public"."period_budget_reference_override" USING "btree" ("user_id");



CREATE INDEX "idx_transactions_fx_snapshot_null" ON "public"."transactions" USING "btree" ((("fx_rate_snapshot" IS NULL)));



CREATE INDEX "idx_transactions_match_trip" ON "public"."transactions" USING "btree" ("user_id", "type", "currency", "amount", "date_start", "date_end") WHERE ("type" = 'expense'::"text");



CREATE INDEX "idx_travel_budget_reference_profile_country" ON "public"."travel_budget_reference_profile" USING "btree" ("country_code");



CREATE INDEX "idx_travel_budget_reference_profile_travel" ON "public"."travel_budget_reference_profile" USING "btree" ("travel_id");



CREATE INDEX "idx_travel_budget_reference_profile_user" ON "public"."travel_budget_reference_profile" USING "btree" ("user_id");



CREATE INDEX "idx_travel_day_logs_travel_date" ON "public"."travel_day_logs" USING "btree" ("travel_id", "log_date");



CREATE INDEX "idx_travel_day_moves_log_seq" ON "public"."travel_day_moves" USING "btree" ("travel_day_log_id", "seq_no");



CREATE INDEX "idx_trip_expenses_date" ON "public"."trip_expenses" USING "btree" ("date");



CREATE INDEX "idx_trip_expenses_trip" ON "public"."trip_expenses" USING "btree" ("trip_id");



CREATE INDEX "idx_trip_expenses_trip_id" ON "public"."trip_expenses" USING "btree" ("trip_id");



CREATE INDEX "idx_trip_expenses_user" ON "public"."trip_expenses" USING "btree" ("user_id");



CREATE INDEX "idx_trip_expenses_user_trip_date" ON "public"."trip_expenses" USING "btree" ("user_id", "trip_id", "date" DESC);



CREATE INDEX "idx_trip_groups_period" ON "public"."trip_groups" USING "btree" ("period_id");



CREATE INDEX "idx_trip_groups_user" ON "public"."trip_groups" USING "btree" ("user_id");



CREATE INDEX "idx_trip_members_trip" ON "public"."trip_members" USING "btree" ("trip_id");



CREATE INDEX "idx_trip_members_trip_id" ON "public"."trip_members" USING "btree" ("trip_id");



CREATE INDEX "idx_trip_members_user" ON "public"."trip_members" USING "btree" ("user_id");



CREATE INDEX "idx_trip_settlement_events_trip_active" ON "public"."trip_settlement_events" USING "btree" ("trip_id") WHERE ("cancelled_at" IS NULL);



CREATE INDEX "idx_trip_settlement_events_trip_from" ON "public"."trip_settlement_events" USING "btree" ("trip_id", "from_member_id") WHERE ("cancelled_at" IS NULL);



CREATE INDEX "idx_trip_settlement_events_trip_to" ON "public"."trip_settlement_events" USING "btree" ("trip_id", "to_member_id") WHERE ("cancelled_at" IS NULL);



CREATE INDEX "idx_trip_settlements_trip" ON "public"."trip_settlements" USING "btree" ("trip_id");



CREATE INDEX "idx_trip_settlements_trip_id" ON "public"."trip_settlements" USING "btree" ("trip_id");



CREATE INDEX "idx_trip_settlements_user" ON "public"."trip_settlements" USING "btree" ("user_id");



CREATE INDEX "idx_trip_settlements_user_id" ON "public"."trip_settlements" USING "btree" ("user_id");



CREATE INDEX "idx_trip_shares_expense" ON "public"."trip_expense_shares" USING "btree" ("expense_id");



CREATE INDEX "idx_trip_shares_trip" ON "public"."trip_expense_shares" USING "btree" ("trip_id");



CREATE INDEX "idx_trip_shares_user" ON "public"."trip_expense_shares" USING "btree" ("user_id");



CREATE INDEX "idx_tx_user" ON "public"."transactions" USING "btree" ("user_id");



CREATE INDEX "idx_tx_wallet" ON "public"."transactions" USING "btree" ("wallet_id");



CREATE INDEX "idx_wallets_user" ON "public"."wallets" USING "btree" ("user_id");



CREATE INDEX "periods_dates_idx" ON "public"."periods" USING "btree" ("user_id", "start_date", "end_date");



CREATE INDEX "periods_travel_id_idx" ON "public"."periods" USING "btree" ("travel_id");



CREATE INDEX "periods_user_idx" ON "public"."periods" USING "btree" ("user_id");



CREATE INDEX "recurring_rules_active_due_idx" ON "public"."recurring_rules" USING "btree" ("is_active", "next_due_at");



CREATE INDEX "recurring_rules_travel_idx" ON "public"."recurring_rules" USING "btree" ("travel_id");



CREATE INDEX "recurring_rules_user_idx" ON "public"."recurring_rules" USING "btree" ("user_id");



CREATE INDEX "recurring_rules_wallet_idx" ON "public"."recurring_rules" USING "btree" ("wallet_id");



CREATE INDEX "transactions_affects_budget_idx" ON "public"."transactions" USING "btree" ("user_id", "affects_budget");



CREATE INDEX "transactions_date_start_idx" ON "public"."transactions" USING "btree" ("date_start");



CREATE INDEX "transactions_dup_match_idx" ON "public"."transactions" USING "btree" ("user_id", "type", "currency", "amount", "date_start", "date_end") WHERE ("type" = 'expense'::"text");



CREATE INDEX "transactions_is_internal_idx" ON "public"."transactions" USING "btree" ("user_id", "is_internal");



CREATE INDEX "transactions_occurrence_date_idx" ON "public"."transactions" USING "btree" ("occurrence_date");



CREATE INDEX "transactions_period_id_idx" ON "public"."transactions" USING "btree" ("period_id");



CREATE INDEX "transactions_period_idx" ON "public"."transactions" USING "btree" ("user_id", "period_id");



CREATE INDEX "transactions_recurring_rule_idx" ON "public"."transactions" USING "btree" ("recurring_rule_id");



CREATE UNIQUE INDEX "transactions_recurring_rule_occurrence_uidx" ON "public"."transactions" USING "btree" ("recurring_rule_id", "occurrence_date") WHERE (("recurring_rule_id" IS NOT NULL) AND ("occurrence_date" IS NOT NULL));



CREATE INDEX "transactions_travel_id_idx" ON "public"."transactions" USING "btree" ("travel_id");



CREATE INDEX "transactions_trip_expense_id_idx" ON "public"."transactions" USING "btree" ("trip_expense_id");



CREATE UNIQUE INDEX "transactions_trip_expense_id_uidx" ON "public"."transactions" USING "btree" ("trip_expense_id") WHERE ("trip_expense_id" IS NOT NULL);



CREATE INDEX "transactions_trip_match_idx" ON "public"."transactions" USING "btree" ("user_id", "type", "currency", "amount", "date_start", "date_end") WHERE ("type" = 'expense'::"text");



CREATE INDEX "transactions_trip_share_link_id_idx" ON "public"."transactions" USING "btree" ("trip_share_link_id");



CREATE INDEX "transactions_user_visible_idx" ON "public"."transactions" USING "btree" ("user_id") WHERE ("is_internal" = false);



CREATE INDEX "transactions_wallet_id_idx" ON "public"."transactions" USING "btree" ("wallet_id");



CREATE UNIQUE INDEX "travels_one_default_per_user_idx" ON "public"."travels" USING "btree" ("user_id") WHERE ("is_default" = true);



CREATE INDEX "travels_user_idx" ON "public"."travels" USING "btree" ("user_id");



CREATE UNIQUE INDEX "trip_expense_budget_links_expense_member_uniq" ON "public"."trip_expense_budget_links" USING "btree" ("expense_id", "member_id");



CREATE INDEX "trip_expense_budget_links_transaction_id_idx" ON "public"."trip_expense_budget_links" USING "btree" ("transaction_id");



CREATE UNIQUE INDEX "trip_expense_budget_links_transaction_uniq" ON "public"."trip_expense_budget_links" USING "btree" ("transaction_id");



CREATE INDEX "trip_expense_budget_links_trip_id_idx" ON "public"."trip_expense_budget_links" USING "btree" ("trip_id");



CREATE INDEX "trip_expense_budget_links_user_trip_idx" ON "public"."trip_expense_budget_links" USING "btree" ("user_id", "trip_id");



CREATE INDEX "trip_expense_shares_expense_idx" ON "public"."trip_expense_shares" USING "btree" ("expense_id");



CREATE INDEX "trip_expense_shares_member_idx" ON "public"."trip_expense_shares" USING "btree" ("member_id");



CREATE UNIQUE INDEX "trip_expenses_transaction_id_uidx" ON "public"."trip_expenses" USING "btree" ("transaction_id") WHERE ("transaction_id" IS NOT NULL);



CREATE INDEX "trip_expenses_user_trip_date_idx" ON "public"."trip_expenses" USING "btree" ("user_id", "trip_id", "date" DESC);



CREATE INDEX "trip_groups_user_period_idx" ON "public"."trip_groups" USING "btree" ("user_id", "period_id");



CREATE INDEX "trip_invites_trip_idx" ON "public"."trip_invites" USING "btree" ("trip_id");



CREATE INDEX "trip_members_auth_user_idx" ON "public"."trip_members" USING "btree" ("trip_id", "auth_user_id");



CREATE UNIQUE INDEX "trip_members_one_me_per_trip_uidx" ON "public"."trip_members" USING "btree" ("trip_id") WHERE ("is_me" = true);



CREATE UNIQUE INDEX "trip_members_trip_auth_user_uniq" ON "public"."trip_members" USING "btree" ("trip_id", "auth_user_id") WHERE ("auth_user_id" IS NOT NULL);



CREATE INDEX "trip_members_trip_email_idx" ON "public"."trip_members" USING "btree" ("trip_id", "lower"("email")) WHERE ("email" IS NOT NULL);



CREATE UNIQUE INDEX "trip_members_trip_email_uniq" ON "public"."trip_members" USING "btree" ("trip_id", "lower"("email")) WHERE ("email" IS NOT NULL);



CREATE INDEX "trip_members_user_trip_idx" ON "public"."trip_members" USING "btree" ("user_id", "trip_id");



CREATE INDEX "trip_participants_user_idx" ON "public"."trip_participants" USING "btree" ("auth_user_id");



CREATE INDEX "trip_settlement_events_from_idx" ON "public"."trip_settlement_events" USING "btree" ("from_member_id");



CREATE INDEX "trip_settlement_events_to_idx" ON "public"."trip_settlement_events" USING "btree" ("to_member_id");



CREATE INDEX "trip_settlement_events_trip_idx" ON "public"."trip_settlement_events" USING "btree" ("trip_id");



CREATE INDEX "trip_shares_user_trip_expense_idx" ON "public"."trip_expense_shares" USING "btree" ("user_id", "trip_id", "expense_id");



CREATE UNIQUE INDEX "ux_transactions_trip_share_link_id" ON "public"."transactions" USING "btree" ("trip_share_link_id") WHERE ("trip_share_link_id" IS NOT NULL);



CREATE INDEX "wallets_travel_id_idx" ON "public"."wallets" USING "btree" ("travel_id");



CREATE INDEX "wallets_user_period_idx" ON "public"."wallets" USING "btree" ("user_id", "period_id");



CREATE OR REPLACE TRIGGER "fx_manual_rates_touch" BEFORE UPDATE ON "public"."fx_manual_rates" FOR EACH ROW EXECUTE FUNCTION "public"."_touch_updated_at"();



CREATE OR REPLACE TRIGGER "set_analytic_category_mappings_updated_at" BEFORE UPDATE ON "public"."analytic_category_mappings" FOR EACH ROW EXECUTE FUNCTION "public"."set_current_timestamp_updated_at"();



CREATE OR REPLACE TRIGGER "set_categories_updated_at" BEFORE UPDATE ON "public"."categories" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "tb_profiles_role_guard_trg" BEFORE INSERT OR UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."tb_profiles_role_guard"();



CREATE OR REPLACE TRIGGER "trg_budget_segment_budget_reference_override_touch_updated_at" BEFORE UPDATE ON "public"."budget_segment_budget_reference_override" FOR EACH ROW EXECUTE FUNCTION "public"."_touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_budget_segments_touch" BEFORE UPDATE ON "public"."budget_segments" FOR EACH ROW EXECUTE FUNCTION "public"."_touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_category_subcategories_updated_at" BEFORE UPDATE ON "public"."category_subcategories" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_country_budget_reference_touch_updated_at" BEFORE UPDATE ON "public"."country_budget_reference" FOR EACH ROW EXECUTE FUNCTION "public"."_touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_fx_manual_rates_touch" BEFORE UPDATE ON "public"."fx_manual_rates" FOR EACH ROW EXECUTE FUNCTION "public"."tb_touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_period_budget_reference_override_touch_updated_at" BEFORE UPDATE ON "public"."period_budget_reference_override" FOR EACH ROW EXECUTE FUNCTION "public"."_touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_prevent_fx_snapshot_update" BEFORE UPDATE ON "public"."transactions" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_fx_snapshot_update"();



CREATE OR REPLACE TRIGGER "trg_recurring_rules_consistency_guard" BEFORE INSERT OR UPDATE ON "public"."recurring_rules" FOR EACH ROW EXECUTE FUNCTION "public"."recurring_rules_consistency_guard"();



CREATE OR REPLACE TRIGGER "trg_recurring_rules_touch_updated_at" BEFORE UPDATE ON "public"."recurring_rules" FOR EACH ROW EXECUTE FUNCTION "public"."_touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_tb_profiles_role_guard" BEFORE INSERT OR UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."tb_profiles_role_guard"();



CREATE OR REPLACE TRIGGER "trg_transactions_travel_consistency_guard" BEFORE INSERT OR UPDATE ON "public"."transactions" FOR EACH ROW EXECUTE FUNCTION "public"."transactions_travel_consistency_guard"();



CREATE OR REPLACE TRIGGER "trg_travel_budget_reference_profile_touch_updated_at" BEFORE UPDATE ON "public"."travel_budget_reference_profile" FOR EACH ROW EXECUTE FUNCTION "public"."_touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_travel_day_logs_apply_no_move_defaults" BEFORE INSERT OR UPDATE OF "no_move_declared", "travel_mode_main" ON "public"."travel_day_logs" FOR EACH ROW EXECUTE FUNCTION "public"."travel_day_logs_apply_no_move_defaults"();



CREATE OR REPLACE TRIGGER "trg_travel_day_logs_set_updated_at" BEFORE UPDATE ON "public"."travel_day_logs" FOR EACH ROW EXECUTE FUNCTION "public"."set_current_timestamp_updated_at"();



CREATE OR REPLACE TRIGGER "trg_travel_day_logs_validate_no_move" BEFORE UPDATE OF "no_move_declared" ON "public"."travel_day_logs" FOR EACH ROW EXECUTE FUNCTION "public"."travel_day_logs_validate_no_move"();



CREATE OR REPLACE TRIGGER "trg_travel_day_moves_block_if_no_move_declared" BEFORE INSERT OR UPDATE OF "travel_day_log_id" ON "public"."travel_day_moves" FOR EACH ROW EXECUTE FUNCTION "public"."travel_day_moves_block_if_no_move_declared"();



CREATE OR REPLACE TRIGGER "trg_travel_day_moves_set_updated_at" BEFORE UPDATE ON "public"."travel_day_moves" FOR EACH ROW EXECUTE FUNCTION "public"."set_current_timestamp_updated_at"();



CREATE OR REPLACE TRIGGER "trg_travel_day_moves_sync_user_id" BEFORE INSERT OR UPDATE OF "travel_day_log_id" ON "public"."travel_day_moves" FOR EACH ROW EXECUTE FUNCTION "public"."travel_day_moves_sync_user_id"();



CREATE OR REPLACE TRIGGER "trg_travels_touch_updated_at" BEFORE UPDATE ON "public"."travels" FOR EACH ROW EXECUTE FUNCTION "public"."_touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_trip_groups_add_owner_participant" AFTER INSERT ON "public"."trip_groups" FOR EACH ROW EXECUTE FUNCTION "public"."trip_after_group_insert_add_owner"();



CREATE OR REPLACE TRIGGER "trg_tx_wallet_period_match" BEFORE INSERT OR UPDATE OF "wallet_id", "period_id" ON "public"."transactions" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_tx_wallet_period_match"();



CREATE OR REPLACE TRIGGER "trg_wallets_travel_consistency_guard" BEFORE INSERT OR UPDATE ON "public"."wallets" FOR EACH ROW EXECUTE FUNCTION "public"."wallets_travel_consistency_guard"();



ALTER TABLE ONLY "public"."asset_owners"
    ADD CONSTRAINT "asset_owners_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."asset_owners"
    ADD CONSTRAINT "asset_owners_trip_member_id_fkey" FOREIGN KEY ("trip_member_id") REFERENCES "public"."trip_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."asset_owners"
    ADD CONSTRAINT "asset_owners_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."asset_ownership_events"
    ADD CONSTRAINT "asset_ownership_events_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."asset_ownership_events"
    ADD CONSTRAINT "asset_ownership_events_from_owner_id_fkey" FOREIGN KEY ("from_owner_id") REFERENCES "public"."asset_owners"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."asset_ownership_events"
    ADD CONSTRAINT "asset_ownership_events_to_owner_id_fkey" FOREIGN KEY ("to_owner_id") REFERENCES "public"."asset_owners"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."assets"
    ADD CONSTRAINT "assets_travel_id_fkey" FOREIGN KEY ("travel_id") REFERENCES "public"."travels"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."assets"
    ADD CONSTRAINT "assets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."budget_segment_budget_reference_override"
    ADD CONSTRAINT "budget_segment_budget_reference_override_budget_segment_id_fkey" FOREIGN KEY ("budget_segment_id") REFERENCES "public"."budget_segments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."budget_segment_budget_reference_override"
    ADD CONSTRAINT "budget_segment_budget_reference_override_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "public"."periods"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."budget_segment_budget_reference_override"
    ADD CONSTRAINT "budget_segment_budget_reference_override_reference_id_fkey" FOREIGN KEY ("reference_id") REFERENCES "public"."country_budget_reference"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."budget_segment_budget_reference_override"
    ADD CONSTRAINT "budget_segment_budget_reference_override_travel_id_fkey" FOREIGN KEY ("travel_id") REFERENCES "public"."travels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."budget_segment_budget_reference_override"
    ADD CONSTRAINT "budget_segment_budget_reference_override_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."budget_segments"
    ADD CONSTRAINT "budget_segments_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "public"."periods"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."budget_segments"
    ADD CONSTRAINT "budget_segments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."category_subcategories"
    ADD CONSTRAINT "category_subcategories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fx_manual_rates"
    ADD CONSTRAINT "fx_manual_rates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."period_budget_reference_override"
    ADD CONSTRAINT "period_budget_reference_override_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "public"."periods"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."period_budget_reference_override"
    ADD CONSTRAINT "period_budget_reference_override_reference_id_fkey" FOREIGN KEY ("reference_id") REFERENCES "public"."country_budget_reference"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."period_budget_reference_override"
    ADD CONSTRAINT "period_budget_reference_override_travel_id_fkey" FOREIGN KEY ("travel_id") REFERENCES "public"."travels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."period_budget_reference_override"
    ADD CONSTRAINT "period_budget_reference_override_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."periods"
    ADD CONSTRAINT "periods_travel_id_fkey" FOREIGN KEY ("travel_id") REFERENCES "public"."travels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."periods"
    ADD CONSTRAINT "periods_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recurring_rules"
    ADD CONSTRAINT "recurring_rules_travel_id_fkey" FOREIGN KEY ("travel_id") REFERENCES "public"."travels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recurring_rules"
    ADD CONSTRAINT "recurring_rules_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recurring_rules"
    ADD CONSTRAINT "recurring_rules_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."settings"
    ADD CONSTRAINT "settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "public"."periods"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_recurring_rule_id_fkey" FOREIGN KEY ("recurring_rule_id") REFERENCES "public"."recurring_rules"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_travel_id_fkey" FOREIGN KEY ("travel_id") REFERENCES "public"."travels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_trip_expense_fk" FOREIGN KEY ("trip_expense_id") REFERENCES "public"."trip_expenses"("id") DEFERRABLE INITIALLY DEFERRED;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_trip_share_link_fk" FOREIGN KEY ("trip_share_link_id") REFERENCES "public"."trip_expense_budget_links"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."travel_budget_reference_profile"
    ADD CONSTRAINT "travel_budget_reference_profile_reference_id_fkey" FOREIGN KEY ("reference_id") REFERENCES "public"."country_budget_reference"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."travel_budget_reference_profile"
    ADD CONSTRAINT "travel_budget_reference_profile_travel_id_fkey" FOREIGN KEY ("travel_id") REFERENCES "public"."travels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."travel_budget_reference_profile"
    ADD CONSTRAINT "travel_budget_reference_profile_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."travel_day_logs"
    ADD CONSTRAINT "travel_day_logs_travel_id_fkey" FOREIGN KEY ("travel_id") REFERENCES "public"."travels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."travel_day_moves"
    ADD CONSTRAINT "travel_day_moves_travel_day_log_id_fkey" FOREIGN KEY ("travel_day_log_id") REFERENCES "public"."travel_day_logs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."travels"
    ADD CONSTRAINT "travels_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_expense_budget_links"
    ADD CONSTRAINT "trip_expense_budget_links_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "public"."trip_expenses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_expense_budget_links"
    ADD CONSTRAINT "trip_expense_budget_links_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."trip_members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_expense_budget_links"
    ADD CONSTRAINT "trip_expense_budget_links_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_expense_budget_links"
    ADD CONSTRAINT "trip_expense_budget_links_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."trip_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_expense_budget_links"
    ADD CONSTRAINT "trip_expense_budget_links_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."trip_expense_shares"
    ADD CONSTRAINT "trip_expense_shares_expense_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."trip_expenses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_expense_shares"
    ADD CONSTRAINT "trip_expense_shares_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "public"."trip_expenses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_expense_shares"
    ADD CONSTRAINT "trip_expense_shares_member_fk" FOREIGN KEY ("member_id") REFERENCES "public"."trip_members"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."trip_expense_shares"
    ADD CONSTRAINT "trip_expense_shares_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."trip_members"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."trip_expense_shares"
    ADD CONSTRAINT "trip_expense_shares_trip_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trip_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_expense_shares"
    ADD CONSTRAINT "trip_expense_shares_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_expenses"
    ADD CONSTRAINT "trip_expenses_paid_by_fk" FOREIGN KEY ("paid_by_member_id") REFERENCES "public"."trip_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."trip_expenses"
    ADD CONSTRAINT "trip_expenses_paid_by_member_id_fkey" FOREIGN KEY ("paid_by_member_id") REFERENCES "public"."trip_members"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."trip_expenses"
    ADD CONSTRAINT "trip_expenses_transaction_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") DEFERRABLE INITIALLY DEFERRED;



ALTER TABLE ONLY "public"."trip_expenses"
    ADD CONSTRAINT "trip_expenses_transaction_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") DEFERRABLE INITIALLY DEFERRED;



ALTER TABLE ONLY "public"."trip_expenses"
    ADD CONSTRAINT "trip_expenses_trip_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trip_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_expenses"
    ADD CONSTRAINT "trip_expenses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_groups"
    ADD CONSTRAINT "trip_groups_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "public"."periods"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_groups"
    ADD CONSTRAINT "trip_groups_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_invites"
    ADD CONSTRAINT "trip_invites_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_invites"
    ADD CONSTRAINT "trip_invites_member_fk" FOREIGN KEY ("member_id") REFERENCES "public"."trip_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."trip_invites"
    ADD CONSTRAINT "trip_invites_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."trip_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_members"
    ADD CONSTRAINT "trip_members_auth_user_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."trip_members"
    ADD CONSTRAINT "trip_members_trip_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trip_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_members"
    ADD CONSTRAINT "trip_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_participants"
    ADD CONSTRAINT "trip_participants_auth_user_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_participants"
    ADD CONSTRAINT "trip_participants_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."trip_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_settlement_events"
    ADD CONSTRAINT "trip_settlement_events_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_settlement_events"
    ADD CONSTRAINT "trip_settlement_events_from_member_id_fkey" FOREIGN KEY ("from_member_id") REFERENCES "public"."trip_members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_settlement_events"
    ADD CONSTRAINT "trip_settlement_events_to_member_id_fkey" FOREIGN KEY ("to_member_id") REFERENCES "public"."trip_members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_settlement_events"
    ADD CONSTRAINT "trip_settlement_events_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."trip_settlement_events"
    ADD CONSTRAINT "trip_settlement_events_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "public"."trip_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_settlements"
    ADD CONSTRAINT "trip_settlements_trip_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trip_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_settlements"
    ADD CONSTRAINT "trip_settlements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_settlements"
    ADD CONSTRAINT "trip_settlements_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."trip_expense_shares"
    ADD CONSTRAINT "trip_shares_expense_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."trip_expenses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_expense_shares"
    ADD CONSTRAINT "trip_shares_member_fk" FOREIGN KEY ("member_id") REFERENCES "public"."trip_members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trip_expense_shares"
    ADD CONSTRAINT "trip_shares_trip_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trip_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wallets"
    ADD CONSTRAINT "wallets_period_fk" FOREIGN KEY ("period_id") REFERENCES "public"."periods"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wallets"
    ADD CONSTRAINT "wallets_travel_id_fkey" FOREIGN KEY ("travel_id") REFERENCES "public"."travels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wallets"
    ADD CONSTRAINT "wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Users can manage their trip expenses" ON "public"."trip_expenses" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can read their trip expenses" ON "public"."trip_expenses" FOR SELECT USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."analytic_category_mappings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "analytic_category_mappings_delete_own" ON "public"."analytic_category_mappings" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "analytic_category_mappings_insert_own" ON "public"."analytic_category_mappings" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "analytic_category_mappings_select_own" ON "public"."analytic_category_mappings" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "analytic_category_mappings_update_own" ON "public"."analytic_category_mappings" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."asset_owners" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "asset_owners_delete_own_asset" ON "public"."asset_owners" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."assets" "a"
  WHERE (("a"."id" = "asset_owners"."asset_id") AND ("a"."user_id" = "auth"."uid"())))));



CREATE POLICY "asset_owners_insert_own_asset" ON "public"."asset_owners" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."assets" "a"
  WHERE (("a"."id" = "asset_owners"."asset_id") AND ("a"."user_id" = "auth"."uid"())))));



CREATE POLICY "asset_owners_select_own_asset" ON "public"."asset_owners" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."assets" "a"
  WHERE (("a"."id" = "asset_owners"."asset_id") AND ("a"."user_id" = "auth"."uid"())))));



CREATE POLICY "asset_owners_update_own_asset" ON "public"."asset_owners" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."assets" "a"
  WHERE (("a"."id" = "asset_owners"."asset_id") AND ("a"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."assets" "a"
  WHERE (("a"."id" = "asset_owners"."asset_id") AND ("a"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."asset_ownership_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "asset_ownership_events_insert_own_assets" ON "public"."asset_ownership_events" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."assets" "a"
  WHERE (("a"."id" = "asset_ownership_events"."asset_id") AND ("a"."user_id" = "auth"."uid"())))));



CREATE POLICY "asset_ownership_events_select_own_assets" ON "public"."asset_ownership_events" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."assets" "a"
  WHERE (("a"."id" = "asset_ownership_events"."asset_id") AND ("a"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."assets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "assets_delete_own" ON "public"."assets" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "assets_insert_own" ON "public"."assets" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "assets_select_own" ON "public"."assets" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "assets_update_own" ON "public"."assets" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."budget_segment_budget_reference_override" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "budget_segment_budget_reference_override_delete_own" ON "public"."budget_segment_budget_reference_override" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "budget_segment_budget_reference_override_insert_own" ON "public"."budget_segment_budget_reference_override" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "budget_segment_budget_reference_override_select_own" ON "public"."budget_segment_budget_reference_override" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "budget_segment_budget_reference_override_update_own" ON "public"."budget_segment_budget_reference_override" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."budget_segments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "budget_segments_delete_own" ON "public"."budget_segments" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "budget_segments_insert_own" ON "public"."budget_segments" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "budget_segments_select_own" ON "public"."budget_segments" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "budget_segments_update_own" ON "public"."budget_segments" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "budget_segments_write_own" ON "public"."budget_segments" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."categories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "categories_delete_own" ON "public"."categories" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "categories_insert_own" ON "public"."categories" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "categories_owner_select" ON "public"."categories" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "categories_owner_write" ON "public"."categories" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "categories_select_own" ON "public"."categories" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "categories_update_own" ON "public"."categories" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "categories_write_own" ON "public"."categories" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."category_subcategories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "category_subcategories_delete_own" ON "public"."category_subcategories" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "category_subcategories_insert_own" ON "public"."category_subcategories" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "category_subcategories_owner_select" ON "public"."category_subcategories" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "category_subcategories_owner_write" ON "public"."category_subcategories" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "category_subcategories_select_own" ON "public"."category_subcategories" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "category_subcategories_update_own" ON "public"."category_subcategories" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "category_subcategories_write_own" ON "public"."category_subcategories" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."country_budget_reference" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "country_budget_reference_select_authenticated" ON "public"."country_budget_reference" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."fx_manual_rates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "fx_manual_rates_select_own" ON "public"."fx_manual_rates" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "fx_manual_rates_write_own" ON "public"."fx_manual_rates" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."fx_rates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "fx_rates_select_authenticated" ON "public"."fx_rates" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."period_budget_reference_override" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "period_budget_reference_override_delete_own" ON "public"."period_budget_reference_override" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "period_budget_reference_override_insert_own" ON "public"."period_budget_reference_override" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "period_budget_reference_override_select_own" ON "public"."period_budget_reference_override" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "period_budget_reference_override_update_own" ON "public"."period_budget_reference_override" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."periods" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "periods_owner_select" ON "public"."periods" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "periods_owner_write" ON "public"."periods" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "periods_select_own" ON "public"."periods" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "periods_write_own" ON "public"."periods" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_insert_self" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("id" = "auth"."uid"()));



CREATE POLICY "profiles_select_own" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "profiles_select_self" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("id" = "auth"."uid"()));



CREATE POLICY "profiles_update_self" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));



CREATE POLICY "profiles_write_own" ON "public"."profiles" USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



ALTER TABLE "public"."recurring_rules" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "recurring_rules_delete_own" ON "public"."recurring_rules" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "recurring_rules_insert_own" ON "public"."recurring_rules" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "recurring_rules_select_own" ON "public"."recurring_rules" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "recurring_rules_update_own" ON "public"."recurring_rules" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."schema_version" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "schema_version_read_authenticated" ON "public"."schema_version" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "schema_version_select" ON "public"."schema_version" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "settings_insert_own" ON "public"."settings" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "settings_owner_select" ON "public"."settings" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "settings_owner_write" ON "public"."settings" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "settings_select_own" ON "public"."settings" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "settings_update_own" ON "public"."settings" FOR UPDATE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "settings_write_own" ON "public"."settings" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."transactions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "transactions_owner_select" ON "public"."transactions" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "transactions_owner_write" ON "public"."transactions" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "transactions_select_own" ON "public"."transactions" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "transactions_write_own" ON "public"."transactions" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."travel_budget_reference_profile" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "travel_budget_reference_profile_delete_own" ON "public"."travel_budget_reference_profile" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "travel_budget_reference_profile_insert_own" ON "public"."travel_budget_reference_profile" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "travel_budget_reference_profile_select_own" ON "public"."travel_budget_reference_profile" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "travel_budget_reference_profile_update_own" ON "public"."travel_budget_reference_profile" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."travel_day_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "travel_day_logs_delete" ON "public"."travel_day_logs" FOR DELETE USING ("public"."can_access_travel"("travel_id"));



CREATE POLICY "travel_day_logs_insert" ON "public"."travel_day_logs" FOR INSERT WITH CHECK ((("user_id" = "auth"."uid"()) AND "public"."can_access_travel"("travel_id")));



CREATE POLICY "travel_day_logs_select" ON "public"."travel_day_logs" FOR SELECT USING ("public"."can_access_travel"("travel_id"));



CREATE POLICY "travel_day_logs_update" ON "public"."travel_day_logs" FOR UPDATE USING ("public"."can_access_travel"("travel_id")) WITH CHECK ((("user_id" = "auth"."uid"()) AND "public"."can_access_travel"("travel_id")));



ALTER TABLE "public"."travel_day_moves" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "travel_day_moves_delete" ON "public"."travel_day_moves" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."travel_day_logs" "l"
  WHERE (("l"."id" = "travel_day_moves"."travel_day_log_id") AND "public"."can_access_travel"("l"."travel_id")))));



CREATE POLICY "travel_day_moves_insert" ON "public"."travel_day_moves" FOR INSERT WITH CHECK ((("user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."travel_day_logs" "l"
  WHERE (("l"."id" = "travel_day_moves"."travel_day_log_id") AND "public"."can_access_travel"("l"."travel_id"))))));



CREATE POLICY "travel_day_moves_select" ON "public"."travel_day_moves" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."travel_day_logs" "l"
  WHERE (("l"."id" = "travel_day_moves"."travel_day_log_id") AND "public"."can_access_travel"("l"."travel_id")))));



CREATE POLICY "travel_day_moves_update" ON "public"."travel_day_moves" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."travel_day_logs" "l"
  WHERE (("l"."id" = "travel_day_moves"."travel_day_log_id") AND "public"."can_access_travel"("l"."travel_id"))))) WITH CHECK ((("user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."travel_day_logs" "l"
  WHERE (("l"."id" = "travel_day_moves"."travel_day_log_id") AND "public"."can_access_travel"("l"."travel_id"))))));



ALTER TABLE "public"."travels" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "travels_delete_own" ON "public"."travels" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "travels_insert_own" ON "public"."travels" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "travels_select_own" ON "public"."travels" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "travels_update_own" ON "public"."travels" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."trip_expense_budget_links" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "trip_expense_budget_links_delete_member" ON "public"."trip_expense_budget_links" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM ("public"."trip_expenses" "te"
     JOIN "public"."trip_participants" "tp" ON (("tp"."trip_id" = "te"."trip_id")))
  WHERE (("te"."id" = "trip_expense_budget_links"."expense_id") AND ("tp"."auth_user_id" = "auth"."uid"()) AND ("tp"."role" = ANY (ARRAY['owner'::"text", 'member'::"text"]))))));



CREATE POLICY "trip_expense_budget_links_select_participant" ON "public"."trip_expense_budget_links" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."trip_expenses" "te"
     JOIN "public"."trip_participants" "tp" ON (("tp"."trip_id" = "te"."trip_id")))
  WHERE (("te"."id" = "trip_expense_budget_links"."expense_id") AND ("tp"."auth_user_id" = "auth"."uid"())))));



CREATE POLICY "trip_expense_budget_links_write_member" ON "public"."trip_expense_budget_links" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."trip_expenses" "te"
     JOIN "public"."trip_participants" "tp" ON (("tp"."trip_id" = "te"."trip_id")))
  WHERE (("te"."id" = "trip_expense_budget_links"."expense_id") AND ("tp"."auth_user_id" = "auth"."uid"()) AND ("tp"."role" = ANY (ARRAY['owner'::"text", 'member'::"text"]))))));



ALTER TABLE "public"."trip_expense_shares" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "trip_expense_shares_owner" ON "public"."trip_expense_shares" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."trip_expenses" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "trip_expenses_delete_member" ON "public"."trip_expenses" FOR DELETE USING (("public"."trip_role"("trip_id") = ANY (ARRAY['owner'::"text", 'member'::"text"])));



CREATE POLICY "trip_expenses_delete_own" ON "public"."trip_expenses" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "trip_expenses_insert_member" ON "public"."trip_expenses" FOR INSERT WITH CHECK (("public"."trip_role"("trip_id") = ANY (ARRAY['owner'::"text", 'member'::"text"])));



CREATE POLICY "trip_expenses_insert_own" ON "public"."trip_expenses" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "trip_expenses_owner" ON "public"."trip_expenses" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "trip_expenses_select_own" ON "public"."trip_expenses" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "trip_expenses_select_participant" ON "public"."trip_expenses" FOR SELECT USING ("public"."is_trip_participant"("trip_id"));



CREATE POLICY "trip_expenses_update_member" ON "public"."trip_expenses" FOR UPDATE USING (("public"."trip_role"("trip_id") = ANY (ARRAY['owner'::"text", 'member'::"text"]))) WITH CHECK (("public"."trip_role"("trip_id") = ANY (ARRAY['owner'::"text", 'member'::"text"])));



CREATE POLICY "trip_expenses_write_own" ON "public"."trip_expenses" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."trip_groups" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "trip_groups_delete_own" ON "public"."trip_groups" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "trip_groups_delete_owner" ON "public"."trip_groups" FOR DELETE USING ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."trip_participants" "tp"
  WHERE (("tp"."trip_id" = "trip_groups"."id") AND ("tp"."auth_user_id" = "auth"."uid"()) AND ("tp"."role" = 'owner'::"text"))))));



CREATE POLICY "trip_groups_insert_own" ON "public"."trip_groups" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "trip_groups_insert_owner" ON "public"."trip_groups" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "trip_groups_select_own" ON "public"."trip_groups" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "trip_groups_select_participant" ON "public"."trip_groups" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."trip_participants" "tp"
  WHERE (("tp"."trip_id" = "trip_groups"."id") AND ("tp"."auth_user_id" = "auth"."uid"())))));



CREATE POLICY "trip_groups_update_own" ON "public"."trip_groups" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "trip_groups_update_owner" ON "public"."trip_groups" FOR UPDATE USING ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."trip_participants" "tp"
  WHERE (("tp"."trip_id" = "trip_groups"."id") AND ("tp"."auth_user_id" = "auth"."uid"()) AND ("tp"."role" = 'owner'::"text")))))) WITH CHECK ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."trip_participants" "tp"
  WHERE (("tp"."trip_id" = "trip_groups"."id") AND ("tp"."auth_user_id" = "auth"."uid"()) AND ("tp"."role" = 'owner'::"text"))))));



CREATE POLICY "trip_groups_write_own" ON "public"."trip_groups" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."trip_invites" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "trip_invites_delete_owner" ON "public"."trip_invites" FOR DELETE USING (("public"."trip_role"("trip_id") = 'owner'::"text"));



CREATE POLICY "trip_invites_insert_owner" ON "public"."trip_invites" FOR INSERT WITH CHECK ((("created_by" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."trip_participants" "tp"
  WHERE (("tp"."trip_id" = "trip_invites"."trip_id") AND ("tp"."auth_user_id" = "auth"."uid"()) AND ("tp"."role" = 'owner'::"text"))))));



CREATE POLICY "trip_invites_select_owner" ON "public"."trip_invites" FOR SELECT USING ((("created_by" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."trip_participants" "tp"
  WHERE (("tp"."trip_id" = "trip_invites"."trip_id") AND ("tp"."auth_user_id" = "auth"."uid"()) AND ("tp"."role" = 'owner'::"text"))))));



CREATE POLICY "trip_invites_update_owner" ON "public"."trip_invites" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."trip_participants" "tp"
  WHERE (("tp"."trip_id" = "trip_invites"."trip_id") AND ("tp"."auth_user_id" = "auth"."uid"()) AND ("tp"."role" = 'owner'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."trip_participants" "tp"
  WHERE (("tp"."trip_id" = "trip_invites"."trip_id") AND ("tp"."auth_user_id" = "auth"."uid"()) AND ("tp"."role" = 'owner'::"text")))));



ALTER TABLE "public"."trip_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "trip_members_delete_member" ON "public"."trip_members" FOR DELETE USING (("public"."trip_role"("trip_id") = ANY (ARRAY['owner'::"text", 'member'::"text"])));



CREATE POLICY "trip_members_delete_own" ON "public"."trip_members" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "trip_members_insert_own" ON "public"."trip_members" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "trip_members_owner" ON "public"."trip_members" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "trip_members_select_own" ON "public"."trip_members" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "trip_members_select_participant" ON "public"."trip_members" FOR SELECT USING ("public"."is_trip_participant"("trip_id"));



CREATE POLICY "trip_members_update_member" ON "public"."trip_members" FOR UPDATE USING (("public"."trip_role"("trip_id") = ANY (ARRAY['owner'::"text", 'member'::"text"]))) WITH CHECK (("public"."trip_role"("trip_id") = ANY (ARRAY['owner'::"text", 'member'::"text"])));



CREATE POLICY "trip_members_write_member" ON "public"."trip_members" FOR INSERT WITH CHECK (("public"."trip_role"("trip_id") = ANY (ARRAY['owner'::"text", 'member'::"text"])));



CREATE POLICY "trip_members_write_own" ON "public"."trip_members" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."trip_participants" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "trip_participants_delete_self" ON "public"."trip_participants" FOR DELETE USING (("auth_user_id" = "auth"."uid"()));



CREATE POLICY "trip_participants_insert_self" ON "public"."trip_participants" FOR INSERT WITH CHECK (("auth_user_id" = "auth"."uid"()));



CREATE POLICY "trip_participants_select_own" ON "public"."trip_participants" FOR SELECT USING (("auth"."uid"() = "auth_user_id"));



CREATE POLICY "trip_participants_select_self" ON "public"."trip_participants" FOR SELECT USING (("auth_user_id" = "auth"."uid"()));



CREATE POLICY "trip_participants_write_own" ON "public"."trip_participants" USING (("auth"."uid"() = "auth_user_id")) WITH CHECK (("auth"."uid"() = "auth_user_id"));



ALTER TABLE "public"."trip_settlement_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "trip_settlement_events_delete_owner" ON "public"."trip_settlement_events" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."trip_participants" "tp"
  WHERE (("tp"."trip_id" = "trip_settlement_events"."trip_id") AND ("tp"."auth_user_id" = "auth"."uid"()) AND ("tp"."role" = 'owner'::"text")))));



CREATE POLICY "trip_settlement_events_insert_member" ON "public"."trip_settlement_events" FOR INSERT WITH CHECK ((("created_by" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."trip_participants" "tp"
  WHERE (("tp"."trip_id" = "trip_settlement_events"."trip_id") AND ("tp"."auth_user_id" = "auth"."uid"()) AND ("tp"."role" = ANY (ARRAY['owner'::"text", 'member'::"text"])))))));



CREATE POLICY "trip_settlement_events_select_participant" ON "public"."trip_settlement_events" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."trip_participants" "tp"
  WHERE (("tp"."trip_id" = "trip_settlement_events"."trip_id") AND ("tp"."auth_user_id" = "auth"."uid"())))));



CREATE POLICY "trip_settlement_events_update_owner_or_creator" ON "public"."trip_settlement_events" FOR UPDATE USING (((EXISTS ( SELECT 1
   FROM "public"."trip_participants" "tp"
  WHERE (("tp"."trip_id" = "trip_settlement_events"."trip_id") AND ("tp"."auth_user_id" = "auth"."uid"()) AND ("tp"."role" = 'owner'::"text")))) OR ("created_by" = "auth"."uid"()))) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."trip_participants" "tp"
  WHERE (("tp"."trip_id" = "trip_settlement_events"."trip_id") AND ("tp"."auth_user_id" = "auth"."uid"()) AND ("tp"."role" = 'owner'::"text")))) OR ("created_by" = "auth"."uid"())));



ALTER TABLE "public"."trip_settlements" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "trip_settlements_delete_own" ON "public"."trip_settlements" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "trip_settlements_insert_own" ON "public"."trip_settlements" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "trip_settlements_owner_select" ON "public"."trip_settlements" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "trip_settlements_owner_write" ON "public"."trip_settlements" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "trip_settlements_select_own" ON "public"."trip_settlements" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "trip_settlements_select_participant" ON "public"."trip_settlements" FOR SELECT USING ("public"."is_trip_participant"("trip_id"));



CREATE POLICY "trip_settlements_write_member" ON "public"."trip_settlements" FOR INSERT WITH CHECK (("public"."trip_role"("trip_id") = ANY (ARRAY['owner'::"text", 'member'::"text"])));



CREATE POLICY "trip_shares_delete_member" ON "public"."trip_expense_shares" FOR DELETE USING (("public"."trip_role"("trip_id") = ANY (ARRAY['owner'::"text", 'member'::"text"])));



CREATE POLICY "trip_shares_delete_own" ON "public"."trip_expense_shares" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "trip_shares_insert_own" ON "public"."trip_expense_shares" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "trip_shares_select_own" ON "public"."trip_expense_shares" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "trip_shares_select_participant" ON "public"."trip_expense_shares" FOR SELECT USING ("public"."is_trip_participant"("trip_id"));



CREATE POLICY "trip_shares_update_member" ON "public"."trip_expense_shares" FOR UPDATE USING (("public"."trip_role"("trip_id") = ANY (ARRAY['owner'::"text", 'member'::"text"]))) WITH CHECK (("public"."trip_role"("trip_id") = ANY (ARRAY['owner'::"text", 'member'::"text"])));



CREATE POLICY "trip_shares_write_member" ON "public"."trip_expense_shares" FOR INSERT WITH CHECK (("public"."trip_role"("trip_id") = ANY (ARRAY['owner'::"text", 'member'::"text"])));



CREATE POLICY "tx_delete_own" ON "public"."transactions" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "tx_insert_own" ON "public"."transactions" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "tx_select_own" ON "public"."transactions" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "tx_update_own" ON "public"."transactions" FOR UPDATE USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."wallets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "wallets_delete_own" ON "public"."wallets" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "wallets_insert_own" ON "public"."wallets" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "wallets_owner_select" ON "public"."wallets" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "wallets_owner_write" ON "public"."wallets" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "wallets_select_own" ON "public"."wallets" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "wallets_update_own" ON "public"."wallets" FOR UPDATE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "wallets_write_own" ON "public"."wallets" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."_touch_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."_touch_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."accept_trip_invite"("p_token" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."accept_trip_invite"("p_token" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."apply_transaction"("p_wallet_id" "uuid", "p_type" "text", "p_amount" numeric, "p_currency" "text", "p_category" "text", "p_label" "text", "p_date_start" "date", "p_date_end" "date", "p_pay_now" boolean, "p_out_of_budget" boolean, "p_night_covered" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."apply_transaction"("p_wallet_id" "uuid", "p_type" "text", "p_amount" numeric, "p_currency" "text", "p_category" "text", "p_label" "text", "p_date_start" "date", "p_date_end" "date", "p_pay_now" boolean, "p_out_of_budget" boolean, "p_night_covered" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."apply_transaction"("p_amount" numeric, "p_category" "text", "p_currency" "text", "p_date_end" "date", "p_date_start" "date", "p_label" "text", "p_out_of_budget" boolean, "p_pay_now" boolean, "p_subcategory" "text", "p_trip_expense_id" "uuid", "p_trip_share_link_id" "uuid", "p_type" "text", "p_user_id" "uuid", "p_wallet_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."apply_transaction"("p_amount" numeric, "p_category" "text", "p_currency" "text", "p_date_end" "date", "p_date_start" "date", "p_label" "text", "p_out_of_budget" boolean, "p_pay_now" boolean, "p_subcategory" "text", "p_trip_expense_id" "uuid", "p_trip_share_link_id" "uuid", "p_type" "text", "p_user_id" "uuid", "p_wallet_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."apply_transaction_v2"("p_wallet_id" "uuid", "p_type" "text", "p_label" "text", "p_amount" numeric, "p_currency" "text", "p_date_start" "date", "p_date_end" "date", "p_category" "text", "p_subcategory" "text", "p_pay_now" boolean, "p_out_of_budget" boolean, "p_night_covered" boolean, "p_affects_budget" boolean, "p_trip_expense_id" "uuid", "p_trip_share_link_id" "uuid", "p_fx_rate_snapshot" numeric, "p_fx_source_snapshot" "text", "p_fx_snapshot_at" timestamp with time zone, "p_fx_base_currency_snapshot" "text", "p_fx_tx_currency_snapshot" "text", "p_user_id" "uuid", "p_budget_date_start" "date", "p_budget_date_end" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."apply_transaction_v2"("p_wallet_id" "uuid", "p_type" "text", "p_label" "text", "p_amount" numeric, "p_currency" "text", "p_date_start" "date", "p_date_end" "date", "p_category" "text", "p_subcategory" "text", "p_pay_now" boolean, "p_out_of_budget" boolean, "p_night_covered" boolean, "p_affects_budget" boolean, "p_trip_expense_id" "uuid", "p_trip_share_link_id" "uuid", "p_fx_rate_snapshot" numeric, "p_fx_source_snapshot" "text", "p_fx_snapshot_at" timestamp with time zone, "p_fx_base_currency_snapshot" "text", "p_fx_tx_currency_snapshot" "text", "p_user_id" "uuid", "p_budget_date_start" "date", "p_budget_date_end" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."apply_transaction_v2"("p_wallet_id" "uuid", "p_type" "text", "p_label" "text", "p_amount" numeric, "p_currency" "text", "p_date_start" "date", "p_date_end" "date", "p_category" "text", "p_subcategory" "text", "p_pay_now" boolean, "p_out_of_budget" boolean, "p_night_covered" boolean, "p_affects_budget" boolean, "p_trip_expense_id" "uuid", "p_trip_share_link_id" "uuid", "p_fx_rate_snapshot" numeric, "p_fx_source_snapshot" "text", "p_fx_snapshot_at" timestamp with time zone, "p_fx_base_currency_snapshot" "text", "p_fx_tx_currency_snapshot" "text", "p_user_id" "uuid", "p_budget_date_start" "date", "p_budget_date_end" "date") TO "service_role";



REVOKE ALL ON FUNCTION "public"."bind_trip_member_to_auth"("p_trip_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."bind_trip_member_to_auth"("p_trip_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."bind_trip_member_to_auth"("p_trip_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_access_travel"("p_travel_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_access_travel"("p_travel_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."delete_category_bundle"("p_category_name" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."delete_category_bundle"("p_category_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_category_bundle"("p_category_name" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."delete_transaction"("p_tx_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."delete_transaction"("p_tx_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_transaction"("p_tx_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_tx_wallet_period_match"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_tx_wallet_period_match"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_period_for_travel_date"("p_travel_id" "uuid", "p_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_period_for_travel_date"("p_travel_id" "uuid", "p_date" "date") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_unmapped_transaction_categories"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_unmapped_transaction_categories"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_unmapped_transaction_categories"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_trip_participant"("p_trip_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_trip_participant"("p_trip_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_trip_participant"("p_trip_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."nth_weekday_of_month"("p_year" integer, "p_month" integer, "p_weekday" integer, "p_week_of_month" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."nth_weekday_of_month"("p_year" integer, "p_month" integer, "p_weekday" integer, "p_week_of_month" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_fx_snapshot_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_fx_snapshot_update"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."recurring_cleanup_rule_occurrences"("p_rule_id" "uuid", "p_mode" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."recurring_cleanup_rule_occurrences"("p_rule_id" "uuid", "p_mode" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."recurring_delete_rule"("p_rule_id" "uuid", "p_mode" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."recurring_delete_rule"("p_rule_id" "uuid", "p_mode" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."recurring_delete_rule"("p_rule_id" "uuid", "p_mode" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."recurring_delete_rule_admin"("p_rule_id" "uuid", "p_mode" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."recurring_delete_rule_admin"("p_rule_id" "uuid", "p_mode" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."recurring_generate_all_active"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."recurring_generate_all_active"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."recurring_generate_for_rule"("p_rule_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."recurring_generate_for_rule"("p_rule_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."recurring_next_occurrence"("p_rule_type" "text", "p_interval_count" integer, "p_weekday" integer, "p_monthday" integer, "p_week_of_month" integer, "p_current" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."recurring_next_occurrence"("p_rule_type" "text", "p_interval_count" integer, "p_weekday" integer, "p_monthday" integer, "p_week_of_month" integer, "p_current" "date") TO "service_role";



REVOKE ALL ON FUNCTION "public"."recurring_pause_rule"("p_rule_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."recurring_pause_rule"("p_rule_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."recurring_pause_rule"("p_rule_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."recurring_pause_rule_admin"("p_rule_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."recurring_pause_rule_admin"("p_rule_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."recurring_resume_rule"("p_rule_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."recurring_resume_rule"("p_rule_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."recurring_resume_rule"("p_rule_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."recurring_resume_rule_admin"("p_rule_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."recurring_resume_rule_admin"("p_rule_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."recurring_rules_consistency_guard"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."recurring_rules_consistency_guard"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."rpc_budget_reference_compute_for_budget_segment"("p_budget_segment_id" "uuid", "p_country_code" "text", "p_region_code" "text", "p_travel_profile" "text", "p_travel_style" "text", "p_adult_count" integer, "p_child_count" integer, "p_trip_days" integer, "p_traveler_age_min" integer, "p_traveler_age_max" integer, "p_save" boolean, "p_disable_override" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rpc_budget_reference_compute_for_budget_segment"("p_budget_segment_id" "uuid", "p_country_code" "text", "p_region_code" "text", "p_travel_profile" "text", "p_travel_style" "text", "p_adult_count" integer, "p_child_count" integer, "p_trip_days" integer, "p_traveler_age_min" integer, "p_traveler_age_max" integer, "p_save" boolean, "p_disable_override" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_budget_reference_compute_for_budget_segment"("p_budget_segment_id" "uuid", "p_country_code" "text", "p_region_code" "text", "p_travel_profile" "text", "p_travel_style" "text", "p_adult_count" integer, "p_child_count" integer, "p_trip_days" integer, "p_traveler_age_min" integer, "p_traveler_age_max" integer, "p_save" boolean, "p_disable_override" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."rpc_budget_reference_compute_for_period"("p_period_id" "uuid", "p_country_code" "text", "p_region_code" "text", "p_travel_profile" "text", "p_travel_style" "text", "p_adult_count" integer, "p_child_count" integer, "p_trip_days" integer, "p_traveler_age_min" integer, "p_traveler_age_max" integer, "p_save" boolean, "p_use_period_override" boolean, "p_disable_period_override" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rpc_budget_reference_compute_for_period"("p_period_id" "uuid", "p_country_code" "text", "p_region_code" "text", "p_travel_profile" "text", "p_travel_style" "text", "p_adult_count" integer, "p_child_count" integer, "p_trip_days" integer, "p_traveler_age_min" integer, "p_traveler_age_max" integer, "p_save" boolean, "p_use_period_override" boolean, "p_disable_period_override" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_budget_reference_compute_for_period"("p_period_id" "uuid", "p_country_code" "text", "p_region_code" "text", "p_travel_profile" "text", "p_travel_style" "text", "p_adult_count" integer, "p_child_count" integer, "p_trip_days" integer, "p_traveler_age_min" integer, "p_traveler_age_max" integer, "p_save" boolean, "p_use_period_override" boolean, "p_disable_period_override" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."rpc_budget_reference_compute_for_travel"("p_travel_id" "uuid", "p_country_code" "text", "p_region_code" "text", "p_travel_profile" "text", "p_travel_style" "text", "p_adult_count" integer, "p_child_count" integer, "p_trip_days" integer, "p_traveler_age_min" integer, "p_traveler_age_max" integer, "p_save" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rpc_budget_reference_compute_for_travel"("p_travel_id" "uuid", "p_country_code" "text", "p_region_code" "text", "p_travel_profile" "text", "p_travel_style" "text", "p_adult_count" integer, "p_child_count" integer, "p_trip_days" integer, "p_traveler_age_min" integer, "p_traveler_age_max" integer, "p_save" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_budget_reference_compute_for_travel"("p_travel_id" "uuid", "p_country_code" "text", "p_region_code" "text", "p_travel_profile" "text", "p_travel_style" "text", "p_adult_count" integer, "p_child_count" integer, "p_trip_days" integer, "p_traveler_age_min" integer, "p_traveler_age_max" integer, "p_save" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."rpc_budget_reference_compute_values"("p_country_code" "text", "p_region_code" "text", "p_travel_profile" "text", "p_travel_style" "text", "p_adult_count" integer, "p_child_count" integer, "p_trip_days" integer, "p_traveler_age_min" integer, "p_traveler_age_max" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rpc_budget_reference_compute_values"("p_country_code" "text", "p_region_code" "text", "p_travel_profile" "text", "p_travel_style" "text", "p_adult_count" integer, "p_child_count" integer, "p_trip_days" integer, "p_traveler_age_min" integer, "p_traveler_age_max" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_budget_reference_compute_values"("p_country_code" "text", "p_region_code" "text", "p_travel_profile" "text", "p_travel_style" "text", "p_adult_count" integer, "p_child_count" integer, "p_trip_days" integer, "p_traveler_age_min" integer, "p_traveler_age_max" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."rpc_budget_reference_resolve_for_budget_segment"("p_budget_segment_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rpc_budget_reference_resolve_for_budget_segment"("p_budget_segment_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_budget_reference_resolve_for_budget_segment"("p_budget_segment_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rpc_budget_reference_resolve_for_period"("p_period_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rpc_budget_reference_resolve_for_period"("p_period_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_budget_reference_resolve_for_period"("p_period_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."save_analytic_mapping_rule"("p_user_id" "uuid", "p_category_name" "text", "p_subcategory_name" "text", "p_mapping_status" "text", "p_analytic_family" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."save_analytic_mapping_rule"("p_user_id" "uuid", "p_category_name" "text", "p_subcategory_name" "text", "p_mapping_status" "text", "p_analytic_family" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."save_analytic_mapping_rule"("p_user_id" "uuid", "p_category_name" "text", "p_subcategory_name" "text", "p_mapping_status" "text", "p_analytic_family" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."seed_default_analytic_category_mappings"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."seed_default_analytic_category_mappings"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."seed_default_analytic_category_mappings_admin"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."seed_default_analytic_category_mappings_admin"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."seed_default_categories_for_user"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."seed_default_categories_for_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."seed_default_categories_for_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_current_timestamp_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_current_timestamp_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."tb_profiles_role_guard"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."tb_profiles_role_guard"() TO "service_role";



GRANT ALL ON FUNCTION "public"."tb_touch_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."tb_touch_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."transactions_travel_consistency_guard"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."transactions_travel_consistency_guard"() TO "service_role";



GRANT ALL ON FUNCTION "public"."travel_day_context_for_date"("p_travel_id" "uuid", "p_log_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."travel_day_context_for_date"("p_travel_id" "uuid", "p_log_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."travel_day_last_known_location"("p_travel_id" "uuid", "p_before_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."travel_day_last_known_location"("p_travel_id" "uuid", "p_before_date" "date") TO "service_role";



GRANT ALL ON TABLE "public"."travel_day_logs" TO "anon";
GRANT ALL ON TABLE "public"."travel_day_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."travel_day_logs" TO "service_role";



GRANT ALL ON FUNCTION "public"."travel_day_log_upsert"("p_travel_id" "uuid", "p_log_date" "date", "p_end_place_label" "text", "p_end_country_code" "text", "p_end_lat" numeric, "p_end_lng" numeric, "p_travel_mode_main" "text", "p_overnight_mode" "text", "p_no_move_declared" boolean, "p_crossed_border" boolean, "p_is_rest_day" boolean, "p_note" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."travel_day_log_upsert"("p_travel_id" "uuid", "p_log_date" "date", "p_end_place_label" "text", "p_end_country_code" "text", "p_end_lat" numeric, "p_end_lng" numeric, "p_travel_mode_main" "text", "p_overnight_mode" "text", "p_no_move_declared" boolean, "p_crossed_border" boolean, "p_is_rest_day" boolean, "p_note" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."travel_day_logs_apply_no_move_defaults"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."travel_day_logs_apply_no_move_defaults"() TO "service_role";



GRANT ALL ON FUNCTION "public"."travel_day_logs_validate_no_move"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."travel_day_logs_validate_no_move"() TO "service_role";



GRANT ALL ON FUNCTION "public"."travel_day_moves_block_if_no_move_declared"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."travel_day_moves_block_if_no_move_declared"() TO "service_role";



GRANT ALL ON FUNCTION "public"."travel_day_moves_sync_user_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."travel_day_moves_sync_user_id"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."trip_accept_invite"("p_token" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."trip_accept_invite"("p_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."trip_accept_invite"("p_token" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."trip_after_group_insert_add_owner"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."trip_after_group_insert_add_owner"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."trip_apply_expense_v1"("p_trip_id" "uuid", "p_payload" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."trip_apply_expense_v1"("p_trip_id" "uuid", "p_payload" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."trip_apply_expense_v1"("p_trip_id" "uuid", "p_payload" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."trip_apply_expense_v2"("p_trip_id" "uuid", "p_payload" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."trip_apply_expense_v2"("p_trip_id" "uuid", "p_payload" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."trip_apply_expense_v2"("p_trip_id" "uuid", "p_payload" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."trip_bind_member_to_auth"("p_trip_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."trip_bind_member_to_auth"("p_trip_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."trip_bind_member_to_auth"("p_trip_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."trip_cancel_settlement_v1"("p_event_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."trip_cancel_settlement_v1"("p_event_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."trip_cancel_settlement_v1"("p_event_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."trip_create_settlement_v1"("p_trip_id" "uuid", "p_currency" "text", "p_amount" numeric, "p_from_member_id" "uuid", "p_to_member_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."trip_create_settlement_v1"("p_trip_id" "uuid", "p_currency" "text", "p_amount" numeric, "p_from_member_id" "uuid", "p_to_member_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."trip_create_settlement_v1"("p_trip_id" "uuid", "p_currency" "text", "p_amount" numeric, "p_from_member_id" "uuid", "p_to_member_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."trip_debug_auth_v1"("p_trip_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."trip_debug_auth_v1"("p_trip_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."trip_delete_expense_v1"("p_trip_id" "uuid", "p_expense_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."trip_delete_expense_v1"("p_trip_id" "uuid", "p_expense_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."trip_delete_expense_v1"("p_trip_id" "uuid", "p_expense_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."trip_get_balances_v1"("p_trip_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."trip_get_balances_v1"("p_trip_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."trip_get_balances_v1"("p_trip_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."trip_role"("p_trip_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."trip_role"("p_trip_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."trip_role"("p_trip_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."trip_suggest_settlements_v1"("p_trip_id" "uuid", "p_use_net_raw" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."trip_suggest_settlements_v1"("p_trip_id" "uuid", "p_use_net_raw" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."trip_suggest_settlements_v1"("p_trip_id" "uuid", "p_use_net_raw" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."update_transaction"("p_tx_id" "uuid", "p_wallet_id" "uuid", "p_type" "text", "p_amount" numeric, "p_currency" "text", "p_category" "text", "p_label" "text", "p_date_start" "date", "p_date_end" "date", "p_pay_now" boolean, "p_out_of_budget" boolean, "p_night_covered" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_transaction"("p_tx_id" "uuid", "p_wallet_id" "uuid", "p_type" "text", "p_amount" numeric, "p_currency" "text", "p_category" "text", "p_label" "text", "p_date_start" "date", "p_date_end" "date", "p_pay_now" boolean, "p_out_of_budget" boolean, "p_night_covered" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."update_transaction_v2"("p_id" "uuid", "p_wallet_id" "uuid", "p_type" "text", "p_amount" numeric, "p_currency" "text", "p_category" "text", "p_label" "text", "p_date_start" "date", "p_date_end" "date", "p_pay_now" boolean, "p_out_of_budget" boolean, "p_night_covered" boolean, "p_user_id" "uuid", "p_subcategory" "text", "p_trip_expense_id" "uuid", "p_trip_share_link_id" "uuid", "p_fx_rate_snapshot" numeric, "p_fx_source_snapshot" "text", "p_fx_snapshot_at" timestamp with time zone, "p_fx_base_currency_snapshot" "text", "p_fx_tx_currency_snapshot" "text", "p_budget_date_start" "date", "p_budget_date_end" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_transaction_v2"("p_id" "uuid", "p_wallet_id" "uuid", "p_type" "text", "p_amount" numeric, "p_currency" "text", "p_category" "text", "p_label" "text", "p_date_start" "date", "p_date_end" "date", "p_pay_now" boolean, "p_out_of_budget" boolean, "p_night_covered" boolean, "p_user_id" "uuid", "p_subcategory" "text", "p_trip_expense_id" "uuid", "p_trip_share_link_id" "uuid", "p_fx_rate_snapshot" numeric, "p_fx_source_snapshot" "text", "p_fx_snapshot_at" timestamp with time zone, "p_fx_base_currency_snapshot" "text", "p_fx_tx_currency_snapshot" "text", "p_budget_date_start" "date", "p_budget_date_end" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_transaction_v2"("p_id" "uuid", "p_wallet_id" "uuid", "p_type" "text", "p_amount" numeric, "p_currency" "text", "p_category" "text", "p_label" "text", "p_date_start" "date", "p_date_end" "date", "p_pay_now" boolean, "p_out_of_budget" boolean, "p_night_covered" boolean, "p_user_id" "uuid", "p_subcategory" "text", "p_trip_expense_id" "uuid", "p_trip_share_link_id" "uuid", "p_fx_rate_snapshot" numeric, "p_fx_source_snapshot" "text", "p_fx_snapshot_at" timestamp with time zone, "p_fx_base_currency_snapshot" "text", "p_fx_tx_currency_snapshot" "text", "p_budget_date_start" "date", "p_budget_date_end" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."wallets_travel_consistency_guard"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."wallets_travel_consistency_guard"() TO "service_role";



GRANT ALL ON TABLE "public"."analytic_category_mappings" TO "anon";
GRANT ALL ON TABLE "public"."analytic_category_mappings" TO "authenticated";
GRANT ALL ON TABLE "public"."analytic_category_mappings" TO "service_role";



GRANT ALL ON TABLE "public"."asset_owners" TO "anon";
GRANT ALL ON TABLE "public"."asset_owners" TO "authenticated";
GRANT ALL ON TABLE "public"."asset_owners" TO "service_role";



GRANT ALL ON TABLE "public"."asset_ownership_events" TO "anon";
GRANT ALL ON TABLE "public"."asset_ownership_events" TO "authenticated";
GRANT ALL ON TABLE "public"."asset_ownership_events" TO "service_role";



GRANT ALL ON TABLE "public"."assets" TO "anon";
GRANT ALL ON TABLE "public"."assets" TO "authenticated";
GRANT ALL ON TABLE "public"."assets" TO "service_role";



GRANT ALL ON TABLE "public"."budget_segment_budget_reference_override" TO "anon";
GRANT ALL ON TABLE "public"."budget_segment_budget_reference_override" TO "authenticated";
GRANT ALL ON TABLE "public"."budget_segment_budget_reference_override" TO "service_role";



GRANT ALL ON TABLE "public"."budget_segments" TO "anon";
GRANT ALL ON TABLE "public"."budget_segments" TO "authenticated";
GRANT ALL ON TABLE "public"."budget_segments" TO "service_role";



GRANT ALL ON TABLE "public"."categories" TO "anon";
GRANT ALL ON TABLE "public"."categories" TO "authenticated";
GRANT ALL ON TABLE "public"."categories" TO "service_role";



GRANT ALL ON TABLE "public"."category_subcategories" TO "anon";
GRANT ALL ON TABLE "public"."category_subcategories" TO "authenticated";
GRANT ALL ON TABLE "public"."category_subcategories" TO "service_role";



GRANT ALL ON TABLE "public"."country_budget_reference" TO "anon";
GRANT ALL ON TABLE "public"."country_budget_reference" TO "authenticated";
GRANT ALL ON TABLE "public"."country_budget_reference" TO "service_role";



GRANT ALL ON TABLE "public"."fx_manual_rates" TO "anon";
GRANT ALL ON TABLE "public"."fx_manual_rates" TO "authenticated";
GRANT ALL ON TABLE "public"."fx_manual_rates" TO "service_role";



GRANT ALL ON TABLE "public"."fx_rates" TO "anon";
GRANT ALL ON TABLE "public"."fx_rates" TO "authenticated";
GRANT ALL ON TABLE "public"."fx_rates" TO "service_role";



GRANT ALL ON SEQUENCE "public"."fx_rates_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."fx_rates_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."fx_rates_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."period_budget_reference_override" TO "anon";
GRANT ALL ON TABLE "public"."period_budget_reference_override" TO "authenticated";
GRANT ALL ON TABLE "public"."period_budget_reference_override" TO "service_role";



GRANT ALL ON TABLE "public"."periods" TO "anon";
GRANT ALL ON TABLE "public"."periods" TO "authenticated";
GRANT ALL ON TABLE "public"."periods" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."recurring_rules" TO "anon";
GRANT ALL ON TABLE "public"."recurring_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."recurring_rules" TO "service_role";



GRANT ALL ON TABLE "public"."schema_version" TO "service_role";
GRANT SELECT ON TABLE "public"."schema_version" TO "authenticated";



GRANT ALL ON TABLE "public"."settings" TO "anon";
GRANT ALL ON TABLE "public"."settings" TO "authenticated";
GRANT ALL ON TABLE "public"."settings" TO "service_role";



GRANT ALL ON TABLE "public"."transactions" TO "anon";
GRANT ALL ON TABLE "public"."transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."transactions" TO "service_role";



GRANT ALL ON TABLE "public"."travel_budget_reference_profile" TO "anon";
GRANT ALL ON TABLE "public"."travel_budget_reference_profile" TO "authenticated";
GRANT ALL ON TABLE "public"."travel_budget_reference_profile" TO "service_role";



GRANT ALL ON TABLE "public"."travel_day_moves" TO "anon";
GRANT ALL ON TABLE "public"."travel_day_moves" TO "authenticated";
GRANT ALL ON TABLE "public"."travel_day_moves" TO "service_role";



GRANT ALL ON TABLE "public"."travels" TO "anon";
GRANT ALL ON TABLE "public"."travels" TO "authenticated";
GRANT ALL ON TABLE "public"."travels" TO "service_role";



GRANT ALL ON TABLE "public"."trip_expense_budget_links" TO "anon";
GRANT ALL ON TABLE "public"."trip_expense_budget_links" TO "authenticated";
GRANT ALL ON TABLE "public"."trip_expense_budget_links" TO "service_role";



GRANT ALL ON TABLE "public"."trip_expense_shares" TO "anon";
GRANT ALL ON TABLE "public"."trip_expense_shares" TO "authenticated";
GRANT ALL ON TABLE "public"."trip_expense_shares" TO "service_role";



GRANT ALL ON TABLE "public"."trip_expenses" TO "anon";
GRANT ALL ON TABLE "public"."trip_expenses" TO "authenticated";
GRANT ALL ON TABLE "public"."trip_expenses" TO "service_role";



GRANT ALL ON TABLE "public"."trip_groups" TO "anon";
GRANT ALL ON TABLE "public"."trip_groups" TO "authenticated";
GRANT ALL ON TABLE "public"."trip_groups" TO "service_role";



GRANT ALL ON TABLE "public"."trip_invites" TO "anon";
GRANT ALL ON TABLE "public"."trip_invites" TO "authenticated";
GRANT ALL ON TABLE "public"."trip_invites" TO "service_role";



GRANT ALL ON TABLE "public"."trip_members" TO "anon";
GRANT ALL ON TABLE "public"."trip_members" TO "authenticated";
GRANT ALL ON TABLE "public"."trip_members" TO "service_role";



GRANT ALL ON TABLE "public"."trip_participants" TO "anon";
GRANT ALL ON TABLE "public"."trip_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."trip_participants" TO "service_role";



GRANT ALL ON TABLE "public"."trip_settlement_events" TO "anon";
GRANT ALL ON TABLE "public"."trip_settlement_events" TO "authenticated";
GRANT ALL ON TABLE "public"."trip_settlement_events" TO "service_role";



GRANT ALL ON TABLE "public"."trip_settlements" TO "anon";
GRANT ALL ON TABLE "public"."trip_settlements" TO "authenticated";
GRANT ALL ON TABLE "public"."trip_settlements" TO "service_role";



GRANT ALL ON TABLE "public"."v_transaction_analytic_mapping" TO "anon";
GRANT ALL ON TABLE "public"."v_transaction_analytic_mapping" TO "authenticated";
GRANT ALL ON TABLE "public"."v_transaction_analytic_mapping" TO "service_role";



GRANT ALL ON TABLE "public"."v_analytic_mapping_audit" TO "anon";
GRANT ALL ON TABLE "public"."v_analytic_mapping_audit" TO "authenticated";
GRANT ALL ON TABLE "public"."v_analytic_mapping_audit" TO "service_role";



GRANT ALL ON TABLE "public"."v_country_budget_reference_latest" TO "anon";
GRANT ALL ON TABLE "public"."v_country_budget_reference_latest" TO "authenticated";
GRANT ALL ON TABLE "public"."v_country_budget_reference_latest" TO "service_role";



GRANT ALL ON TABLE "public"."v_period_budget_reference_resolved" TO "anon";
GRANT ALL ON TABLE "public"."v_period_budget_reference_resolved" TO "authenticated";
GRANT ALL ON TABLE "public"."v_period_budget_reference_resolved" TO "service_role";



GRANT ALL ON TABLE "public"."v_transaction_analytic_expenses" TO "anon";
GRANT ALL ON TABLE "public"."v_transaction_analytic_expenses" TO "authenticated";
GRANT ALL ON TABLE "public"."v_transaction_analytic_expenses" TO "service_role";



GRANT ALL ON TABLE "public"."v_travel_day_summary" TO "anon";
GRANT ALL ON TABLE "public"."v_travel_day_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."v_travel_day_summary" TO "service_role";



GRANT ALL ON TABLE "public"."v_travel_day_ui" TO "anon";
GRANT ALL ON TABLE "public"."v_travel_day_ui" TO "authenticated";
GRANT ALL ON TABLE "public"."v_travel_day_ui" TO "service_role";



GRANT ALL ON TABLE "public"."v_trip_balances" TO "anon";
GRANT ALL ON TABLE "public"."v_trip_balances" TO "authenticated";
GRANT ALL ON TABLE "public"."v_trip_balances" TO "service_role";



GRANT ALL ON TABLE "public"."v_trip_budget_potential_duplicates" TO "anon";
GRANT ALL ON TABLE "public"."v_trip_budget_potential_duplicates" TO "authenticated";
GRANT ALL ON TABLE "public"."v_trip_budget_potential_duplicates" TO "service_role";



GRANT ALL ON TABLE "public"."v_trip_expense_budget_links" TO "anon";
GRANT ALL ON TABLE "public"."v_trip_expense_budget_links" TO "authenticated";
GRANT ALL ON TABLE "public"."v_trip_expense_budget_links" TO "service_role";



GRANT ALL ON TABLE "public"."v_trip_user_net_balances" TO "anon";
GRANT ALL ON TABLE "public"."v_trip_user_net_balances" TO "authenticated";
GRANT ALL ON TABLE "public"."v_trip_user_net_balances" TO "service_role";



GRANT ALL ON TABLE "public"."wallets" TO "anon";
GRANT ALL ON TABLE "public"."wallets" TO "authenticated";
GRANT ALL ON TABLE "public"."wallets" TO "service_role";



GRANT ALL ON TABLE "public"."v_wallet_transactions_effect" TO "anon";
GRANT ALL ON TABLE "public"."v_wallet_transactions_effect" TO "authenticated";
GRANT ALL ON TABLE "public"."v_wallet_transactions_effect" TO "service_role";



GRANT ALL ON TABLE "public"."v_wallet_balances" TO "anon";
GRANT ALL ON TABLE "public"."v_wallet_balances" TO "authenticated";
GRANT ALL ON TABLE "public"."v_wallet_balances" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







