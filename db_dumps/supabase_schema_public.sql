


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
    AS $$
begin
  new.updated_at = now();
  return new;
end $$;


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
declare
  v_user_id uuid;
  v_wallet_currency text;
  v_wallet_period_id uuid;
  v_period_id uuid;
  v_delta numeric;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Wallet must belong to user
  select currency, period_id
    into v_wallet_currency, v_wallet_period_id
  from public.wallets
  where id = p_wallet_id and user_id = v_user_id;

  if v_wallet_currency is null then
    raise exception 'Wallet not found';
  end if;

  -- period = the one that contains date_start
  select id into v_period_id
  from public.periods
  where user_id = v_user_id
    and p_date_start between start_date and end_date
  order by start_date desc
  limit 1;

  if v_period_id is null then
    raise exception 'No period matches date_start %', p_date_start;
  end if;

  -- Enforce consistency between wallet and computed period
  if v_wallet_period_id is distinct from v_period_id then
    raise exception 'period_id mismatch: tx=% wallet=%', v_period_id, v_wallet_period_id;
  end if;

  insert into public.transactions (
    user_id, wallet_id, period_id,
    type, amount, currency, category, label,
    date_start, date_end, pay_now, out_of_budget, night_covered
  ) values (
    v_user_id, p_wallet_id, v_period_id,
    p_type, p_amount, v_wallet_currency, p_category, p_label,
    p_date_start, p_date_end, p_pay_now, p_out_of_budget, p_night_covered
  );

  -- wallet balance update only if pay_now
  if p_pay_now then
    if p_type = 'expense' then
      v_delta := -p_amount;
    else
      v_delta := p_amount;
    end if;

    update public.wallets
    set balance = balance + v_delta
    where id = p_wallet_id and user_id = v_user_id;
  end if;
end;
$$;


ALTER FUNCTION "public"."apply_transaction"("p_wallet_id" "uuid", "p_type" "text", "p_amount" numeric, "p_currency" "text", "p_category" "text", "p_label" "text", "p_date_start" "date", "p_date_end" "date", "p_pay_now" boolean, "p_out_of_budget" boolean, "p_night_covered" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."apply_transaction"("p_amount" numeric, "p_category" "text", "p_currency" "text", "p_date_end" "date", "p_date_start" "date", "p_label" "text", "p_out_of_budget" boolean, "p_pay_now" boolean, "p_subcategory" "text", "p_trip_expense_id" "uuid", "p_trip_share_link_id" "uuid", "p_type" "text", "p_user_id" "uuid", "p_wallet_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
begin
  -- On ignore p_subcategory / trip ids ici: ton apply_transaction "court" ne les supporte pas.
  perform public.apply_transaction(
    p_wallet_id,                                  -- uuid
    coalesce(p_type, 'expense'),                  -- text
    p_amount,                                     -- numeric
    coalesce(p_currency, 'EUR'),                  -- text
    coalesce(p_category, 'Trip'),                 -- text
    coalesce(p_label, '[Trip]'),                  -- text
    p_date_start,                                 -- date
    p_date_end,                                   -- date
    coalesce(p_pay_now, true),                    -- boolean
    coalesce(p_out_of_budget, true),              -- boolean
    false                                         -- boolean (flag inutilisé / placeholder)
  );
end $$;


ALTER FUNCTION "public"."apply_transaction"("p_amount" numeric, "p_category" "text", "p_currency" "text", "p_date_end" "date", "p_date_start" "date", "p_label" "text", "p_out_of_budget" boolean, "p_pay_now" boolean, "p_subcategory" "text", "p_trip_expense_id" "uuid", "p_trip_share_link_id" "uuid", "p_type" "text", "p_user_id" "uuid", "p_wallet_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."apply_transaction_v2"("p_wallet_id" "uuid", "p_type" "text", "p_label" "text", "p_amount" numeric, "p_currency" "text", "p_date_start" "date", "p_date_end" "date", "p_category" "text", "p_subcategory" "text", "p_pay_now" boolean, "p_out_of_budget" boolean, "p_night_covered" boolean, "p_affects_budget" boolean, "p_trip_expense_id" "uuid", "p_trip_share_link_id" "uuid", "p_fx_rate_snapshot" numeric, "p_fx_source_snapshot" "text", "p_fx_snapshot_at" timestamp with time zone, "p_fx_base_currency_snapshot" "text", "p_fx_tx_currency_snapshot" "text", "p_user_id" "uuid" DEFAULT NULL::"uuid") RETURNS "uuid"
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
    category, subcategory,
    pay_now, out_of_budget, night_covered,
    affects_budget,
    trip_expense_id, trip_share_link_id,
    fx_rate_snapshot, fx_source_snapshot, fx_snapshot_at,
    fx_base_currency_snapshot, fx_tx_currency_snapshot
  ) values (
    v_user_id, p_wallet_id, v_period_id,
    p_type, p_label, p_amount, p_currency,
    p_date_start, p_date_end,
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


ALTER FUNCTION "public"."apply_transaction_v2"("p_wallet_id" "uuid", "p_type" "text", "p_label" "text", "p_amount" numeric, "p_currency" "text", "p_date_start" "date", "p_date_end" "date", "p_category" "text", "p_subcategory" "text", "p_pay_now" boolean, "p_out_of_budget" boolean, "p_night_covered" boolean, "p_affects_budget" boolean, "p_trip_expense_id" "uuid", "p_trip_share_link_id" "uuid", "p_fx_rate_snapshot" numeric, "p_fx_source_snapshot" "text", "p_fx_snapshot_at" timestamp with time zone, "p_fx_base_currency_snapshot" "text", "p_fx_tx_currency_snapshot" "text", "p_user_id" "uuid") OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."is_trip_participant"("p_trip_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  select exists (
    select 1 from public.trip_participants tp
    where tp.trip_id = p_trip_id
      and tp.auth_user_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."is_trip_participant"("p_trip_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_fx_snapshot_update"() RETURNS "trigger"
    LANGUAGE "plpgsql"
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


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tb_profiles_role_guard"() RETURNS "trigger"
    LANGUAGE "plpgsql"
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
    AS $$
begin
  new.updated_at = now();
  return new;
end$$;


ALTER FUNCTION "public"."tb_touch_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trip_accept_invite"("p_token" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
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


CREATE OR REPLACE FUNCTION "public"."trip_bind_member_to_auth"("p_trip_id" "uuid") RETURNS "uuid"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select public.bind_trip_member_to_auth(p_trip_id);
$$;


ALTER FUNCTION "public"."trip_bind_member_to_auth"("p_trip_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trip_role"("p_trip_id" "uuid") RETURNS "text"
    LANGUAGE "sql" STABLE
    AS $$
  select tp.role
  from public.trip_participants tp
  where tp.trip_id = p_trip_id
    and tp.auth_user_id = auth.uid()
  limit 1;
$$;


ALTER FUNCTION "public"."trip_role"("p_trip_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_transaction"("p_tx_id" "uuid", "p_wallet_id" "uuid", "p_type" "text", "p_amount" numeric, "p_currency" "text", "p_category" "text", "p_label" "text", "p_date_start" "date", "p_date_end" "date", "p_pay_now" boolean, "p_out_of_budget" boolean, "p_night_covered" boolean) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  o_wallet_id uuid;
  o_type text;
  o_amount numeric;
  o_pay_now boolean;
begin
  -- Load old tx (ownership check)
  select wallet_id, type, amount, pay_now
    into o_wallet_id, o_type, o_amount, o_pay_now
  from public.transactions
  where id = p_tx_id
    and user_id = auth.uid();

  if not found then
    raise exception 'Transaction introuvable ou non autorisée';
  end if;

  -- Also verify new wallet belongs to user
  if not exists (
    select 1 from public.wallets
    where id = p_wallet_id and user_id = auth.uid()
  ) then
    raise exception 'Wallet invalide';
  end if;

  -- 1) rollback old ONLY if it was paid
  if coalesce(o_pay_now, false) then
    if o_type = 'expense' then
      update public.wallets set balance = balance + o_amount
      where id = o_wallet_id and user_id = auth.uid();
    else
      update public.wallets set balance = balance - o_amount
      where id = o_wallet_id and user_id = auth.uid();
    end if;
  end if;

  -- 2) apply new ONLY if it is paid
  if coalesce(p_pay_now, false) then
    if p_type = 'expense' then
      update public.wallets set balance = balance - p_amount
      where id = p_wallet_id and user_id = auth.uid();
    else
      update public.wallets set balance = balance + p_amount
      where id = p_wallet_id and user_id = auth.uid();
    end if;
  end if;

  -- 3) update tx row (period_id ne bouge pas ici)
  update public.transactions
  set wallet_id = p_wallet_id,
      type = p_type,
      amount = p_amount,
      currency = p_currency,
      category = p_category,
      label = p_label,
      date_start = p_date_start,
      date_end = p_date_end,
      pay_now = p_pay_now,
      out_of_budget = p_out_of_budget,
      night_covered = p_night_covered,
      updated_at = now()
  where id = p_tx_id
    and user_id = auth.uid();
end;
$$;


ALTER FUNCTION "public"."update_transaction"("p_tx_id" "uuid", "p_wallet_id" "uuid", "p_type" "text", "p_amount" numeric, "p_currency" "text", "p_category" "text", "p_label" "text", "p_date_start" "date", "p_date_end" "date", "p_pay_now" boolean, "p_out_of_budget" boolean, "p_night_covered" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_transaction_v2"("p_id" "uuid", "p_wallet_id" "uuid", "p_type" "text", "p_amount" numeric, "p_currency" "text", "p_category" "text", "p_label" "text", "p_date_start" "date", "p_date_end" "date", "p_pay_now" boolean DEFAULT false, "p_out_of_budget" boolean DEFAULT false, "p_night_covered" boolean DEFAULT false, "p_user_id" "uuid" DEFAULT NULL::"uuid", "p_subcategory" "text" DEFAULT NULL::"text", "p_trip_expense_id" "uuid" DEFAULT NULL::"uuid", "p_trip_share_link_id" "uuid" DEFAULT NULL::"uuid", "p_fx_rate_snapshot" numeric DEFAULT NULL::numeric, "p_fx_source_snapshot" "text" DEFAULT NULL::"text", "p_fx_snapshot_at" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_fx_base_currency_snapshot" "text" DEFAULT NULL::"text", "p_fx_tx_currency_snapshot" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  -- Call existing RPC (your current implementation)
  perform public.update_transaction(
    p_id := p_id,
    p_user_id := p_user_id,
    p_wallet_id := p_wallet_id,
    p_type := p_type,
    p_label := p_label,
    p_amount := p_amount,
    p_currency := p_currency,
    p_date_start := p_date_start,
    p_date_end := p_date_end,
    p_category := p_category,
    p_subcategory := p_subcategory,
    p_pay_now := p_pay_now,
    p_out_of_budget := p_out_of_budget,
    p_night_covered := p_night_covered,
    p_trip_expense_id := p_trip_expense_id,
    p_trip_share_link_id := p_trip_share_link_id
  );

  -- Backfill snapshot fields if still NULL (never overwrite)
  update public.transactions
     set fx_rate_snapshot          = coalesce(fx_rate_snapshot, p_fx_rate_snapshot),
         fx_source_snapshot        = coalesce(fx_source_snapshot, p_fx_source_snapshot),
         fx_snapshot_at            = coalesce(fx_snapshot_at, p_fx_snapshot_at),
         fx_base_currency_snapshot = coalesce(fx_base_currency_snapshot, p_fx_base_currency_snapshot),
         fx_tx_currency_snapshot   = coalesce(fx_tx_currency_snapshot, p_fx_tx_currency_snapshot),
         updated_at                = now()
   where id = p_id;

end;
$$;


ALTER FUNCTION "public"."update_transaction_v2"("p_id" "uuid", "p_wallet_id" "uuid", "p_type" "text", "p_amount" numeric, "p_currency" "text", "p_category" "text", "p_label" "text", "p_date_start" "date", "p_date_end" "date", "p_pay_now" boolean, "p_out_of_budget" boolean, "p_night_covered" boolean, "p_user_id" "uuid", "p_subcategory" "text", "p_trip_expense_id" "uuid", "p_trip_share_link_id" "uuid", "p_fx_rate_snapshot" numeric, "p_fx_source_snapshot" "text", "p_fx_snapshot_at" timestamp with time zone, "p_fx_base_currency_snapshot" "text", "p_fx_tx_currency_snapshot" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_transaction_v2"("p_wallet_id" "uuid", "p_tx_id" "uuid", "p_type" "text", "p_label" "text", "p_amount" numeric, "p_currency" "text", "p_date_start" "date", "p_date_end" "date", "p_category" "text", "p_pay_now" boolean, "p_out_of_budget" boolean, "p_night_covered" boolean, "p_fx_rate_snapshot" numeric, "p_fx_source_snapshot" "text", "p_fx_snapshot_at" timestamp with time zone, "p_fx_base_currency_snapshot" "text", "p_fx_tx_currency_snapshot" "text", "p_affects_budget" boolean DEFAULT NULL::boolean, "p_trip_expense_id" "uuid" DEFAULT NULL::"uuid", "p_trip_share_link_id" "uuid" DEFAULT NULL::"uuid", "p_user_id" "uuid" DEFAULT NULL::"uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_period_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- period_id depuis wallet (si wallet change)
  select w.period_id into v_period_id
  from public.wallets w
  where w.id = p_wallet_id and w.user_id = v_user_id;

  if v_period_id is null then
    raise exception 'Wallet not found or not owned';
  end if;

  update public.transactions t
  set
    wallet_id = p_wallet_id,
    period_id = v_period_id,
    type = p_type,
    label = p_label,
    amount = p_amount,
    currency = p_currency,
    date_start = p_date_start,
    date_end = p_date_end,
    category = p_category,
    pay_now = p_pay_now,
    out_of_budget = p_out_of_budget,
    night_covered = p_night_covered,
    affects_budget = coalesce(p_affects_budget, t.affects_budget),
    trip_expense_id = p_trip_expense_id,
    trip_share_link_id = p_trip_share_link_id,
    -- snapshot : set ONLY if currently null (immutability friendly)
    fx_rate_snapshot = coalesce(t.fx_rate_snapshot, p_fx_rate_snapshot),
    fx_source_snapshot = coalesce(t.fx_source_snapshot, p_fx_source_snapshot),
    fx_snapshot_at = coalesce(t.fx_snapshot_at, p_fx_snapshot_at),
    fx_base_currency_snapshot = coalesce(t.fx_base_currency_snapshot, p_fx_base_currency_snapshot),
    fx_tx_currency_snapshot = coalesce(t.fx_tx_currency_snapshot, p_fx_tx_currency_snapshot),
    updated_at = now()
  where
    t.id = p_tx_id
    and t.user_id = v_user_id;

  if not found then
    raise exception 'Transaction not found or not owned';
  end if;
end;
$$;


ALTER FUNCTION "public"."update_transaction_v2"("p_wallet_id" "uuid", "p_tx_id" "uuid", "p_type" "text", "p_label" "text", "p_amount" numeric, "p_currency" "text", "p_date_start" "date", "p_date_end" "date", "p_category" "text", "p_pay_now" boolean, "p_out_of_budget" boolean, "p_night_covered" boolean, "p_fx_rate_snapshot" numeric, "p_fx_source_snapshot" "text", "p_fx_snapshot_at" timestamp with time zone, "p_fx_base_currency_snapshot" "text", "p_fx_tx_currency_snapshot" "text", "p_affects_budget" boolean, "p_trip_expense_id" "uuid", "p_trip_share_link_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


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
    CONSTRAINT "budget_segments_currency_ok" CHECK ((("char_length"("base_currency") >= 3) AND ("char_length"("base_currency") <= 6))),
    CONSTRAINT "budget_segments_dates_ok" CHECK (("end_date" >= "start_date")),
    CONSTRAINT "budget_segments_fx_mode_check" CHECK (("fx_mode" = ANY (ARRAY['live_ecb'::"text", 'fixed'::"text"])))
);


ALTER TABLE "public"."budget_segments" OWNER TO "postgres";


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
    CONSTRAINT "settings_base_currency_iso3_chk" CHECK ((("base_currency" IS NULL) OR ("base_currency" ~ '^[A-Z]{3}$'::"text")))
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
    CONSTRAINT "transactions_amount_check" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "transactions_currency_iso3_chk" CHECK (("currency" ~ '^[A-Z]{3}$'::"text")),
    CONSTRAINT "transactions_fx_snapshot_consistency" CHECK (((("fx_rate_snapshot" IS NULL) AND ("fx_source_snapshot" IS NULL)) OR (("fx_rate_snapshot" IS NOT NULL) AND ("fx_source_snapshot" IS NOT NULL)))),
    CONSTRAINT "transactions_type_check" CHECK (("type" = ANY (ARRAY['expense'::"text", 'income'::"text"])))
);


ALTER TABLE "public"."transactions" OWNER TO "postgres";


COMMENT ON COLUMN "public"."transactions"."is_internal" IS 'True for internal/shadow rows (Trip budget-only allocations). Hidden from main transactions view and excluded from wallet cashflow.';



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
    CONSTRAINT "wallets_currency_iso3_chk" CHECK (("currency" ~ '^[A-Z]{3}$'::"text")),
    CONSTRAINT "wallets_type_check" CHECK (("type" = ANY (ARRAY['cash'::"text", 'bank'::"text", 'card'::"text", 'savings'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."wallets" OWNER TO "postgres";


ALTER TABLE ONLY "public"."fx_rates" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."fx_rates_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."budget_segments"
    ADD CONSTRAINT "budget_segments_no_overlap" EXCLUDE USING "gist" ("period_id" WITH =, "daterange"("start_date", "end_date", '[]'::"text") WITH &&);



ALTER TABLE ONLY "public"."budget_segments"
    ADD CONSTRAINT "budget_segments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fx_manual_rates"
    ADD CONSTRAINT "fx_manual_rates_pkey" PRIMARY KEY ("user_id", "currency");



ALTER TABLE ONLY "public"."fx_rates"
    ADD CONSTRAINT "fx_rates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."periods"
    ADD CONSTRAINT "periods_no_overlap" EXCLUDE USING "gist" ("user_id" WITH =, "daterange"("start_date", ("end_date" + 1), '[]'::"text") WITH &&);



ALTER TABLE ONLY "public"."periods"
    ADD CONSTRAINT "periods_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



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



CREATE UNIQUE INDEX "categories_user_name_uq" ON "public"."categories" USING "btree" ("user_id", "lower"("name"));



CREATE INDEX "fx_rates_as_of_idx" ON "public"."fx_rates" USING "btree" ("as_of" DESC);



CREATE INDEX "idx_transactions_fx_snapshot_null" ON "public"."transactions" USING "btree" ((("fx_rate_snapshot" IS NULL)));



CREATE INDEX "idx_transactions_match_trip" ON "public"."transactions" USING "btree" ("user_id", "type", "currency", "amount", "date_start", "date_end") WHERE ("type" = 'expense'::"text");



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



CREATE INDEX "periods_user_idx" ON "public"."periods" USING "btree" ("user_id");



CREATE INDEX "transactions_affects_budget_idx" ON "public"."transactions" USING "btree" ("user_id", "affects_budget");



CREATE INDEX "transactions_date_start_idx" ON "public"."transactions" USING "btree" ("date_start");



CREATE INDEX "transactions_dup_match_idx" ON "public"."transactions" USING "btree" ("user_id", "type", "currency", "amount", "date_start", "date_end") WHERE ("type" = 'expense'::"text");



CREATE INDEX "transactions_is_internal_idx" ON "public"."transactions" USING "btree" ("user_id", "is_internal");



CREATE INDEX "transactions_period_id_idx" ON "public"."transactions" USING "btree" ("period_id");



CREATE INDEX "transactions_period_idx" ON "public"."transactions" USING "btree" ("user_id", "period_id");



CREATE INDEX "transactions_trip_expense_id_idx" ON "public"."transactions" USING "btree" ("trip_expense_id");



CREATE UNIQUE INDEX "transactions_trip_expense_id_uidx" ON "public"."transactions" USING "btree" ("trip_expense_id") WHERE ("trip_expense_id" IS NOT NULL);



CREATE INDEX "transactions_trip_match_idx" ON "public"."transactions" USING "btree" ("user_id", "type", "currency", "amount", "date_start", "date_end") WHERE ("type" = 'expense'::"text");



CREATE INDEX "transactions_trip_share_link_id_idx" ON "public"."transactions" USING "btree" ("trip_share_link_id");



CREATE INDEX "transactions_user_visible_idx" ON "public"."transactions" USING "btree" ("user_id") WHERE ("is_internal" = false);



CREATE INDEX "transactions_wallet_id_idx" ON "public"."transactions" USING "btree" ("wallet_id");



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



CREATE INDEX "wallets_user_period_idx" ON "public"."wallets" USING "btree" ("user_id", "period_id");



CREATE OR REPLACE TRIGGER "fx_manual_rates_touch" BEFORE UPDATE ON "public"."fx_manual_rates" FOR EACH ROW EXECUTE FUNCTION "public"."_touch_updated_at"();



CREATE OR REPLACE TRIGGER "set_categories_updated_at" BEFORE UPDATE ON "public"."categories" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "tb_profiles_role_guard_trg" BEFORE INSERT OR UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."tb_profiles_role_guard"();



CREATE OR REPLACE TRIGGER "trg_budget_segments_touch" BEFORE UPDATE ON "public"."budget_segments" FOR EACH ROW EXECUTE FUNCTION "public"."_touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_fx_manual_rates_touch" BEFORE UPDATE ON "public"."fx_manual_rates" FOR EACH ROW EXECUTE FUNCTION "public"."tb_touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_prevent_fx_snapshot_update" BEFORE UPDATE ON "public"."transactions" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_fx_snapshot_update"();



CREATE OR REPLACE TRIGGER "trg_tb_profiles_role_guard" BEFORE INSERT OR UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."tb_profiles_role_guard"();



CREATE OR REPLACE TRIGGER "trg_trip_groups_add_owner_participant" AFTER INSERT ON "public"."trip_groups" FOR EACH ROW EXECUTE FUNCTION "public"."trip_after_group_insert_add_owner"();



CREATE OR REPLACE TRIGGER "trg_tx_wallet_period_match" BEFORE INSERT OR UPDATE OF "wallet_id", "period_id" ON "public"."transactions" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_tx_wallet_period_match"();



ALTER TABLE ONLY "public"."budget_segments"
    ADD CONSTRAINT "budget_segments_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "public"."periods"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."budget_segments"
    ADD CONSTRAINT "budget_segments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."fx_manual_rates"
    ADD CONSTRAINT "fx_manual_rates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."periods"
    ADD CONSTRAINT "periods_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."settings"
    ADD CONSTRAINT "settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "public"."periods"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_trip_expense_fk" FOREIGN KEY ("trip_expense_id") REFERENCES "public"."trip_expenses"("id") DEFERRABLE INITIALLY DEFERRED;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_trip_share_link_fk" FOREIGN KEY ("trip_share_link_id") REFERENCES "public"."trip_expense_budget_links"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE CASCADE;



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
    ADD CONSTRAINT "wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Users can manage their trip expenses" ON "public"."trip_expenses" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can read their trip expenses" ON "public"."trip_expenses" FOR SELECT USING (("user_id" = "auth"."uid"()));



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



ALTER TABLE "public"."fx_manual_rates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "fx_manual_rates_select_own" ON "public"."fx_manual_rates" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "fx_manual_rates_write_own" ON "public"."fx_manual_rates" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."fx_rates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "fx_rates_select_authenticated" ON "public"."fx_rates" FOR SELECT TO "authenticated" USING (true);



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



GRANT ALL ON FUNCTION "public"."_touch_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."_touch_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."_touch_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."accept_trip_invite"("p_token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."accept_trip_invite"("p_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."accept_trip_invite"("p_token" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."apply_transaction"("p_wallet_id" "uuid", "p_type" "text", "p_amount" numeric, "p_currency" "text", "p_category" "text", "p_label" "text", "p_date_start" "date", "p_date_end" "date", "p_pay_now" boolean, "p_out_of_budget" boolean, "p_night_covered" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."apply_transaction"("p_wallet_id" "uuid", "p_type" "text", "p_amount" numeric, "p_currency" "text", "p_category" "text", "p_label" "text", "p_date_start" "date", "p_date_end" "date", "p_pay_now" boolean, "p_out_of_budget" boolean, "p_night_covered" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."apply_transaction"("p_wallet_id" "uuid", "p_type" "text", "p_amount" numeric, "p_currency" "text", "p_category" "text", "p_label" "text", "p_date_start" "date", "p_date_end" "date", "p_pay_now" boolean, "p_out_of_budget" boolean, "p_night_covered" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."apply_transaction"("p_amount" numeric, "p_category" "text", "p_currency" "text", "p_date_end" "date", "p_date_start" "date", "p_label" "text", "p_out_of_budget" boolean, "p_pay_now" boolean, "p_subcategory" "text", "p_trip_expense_id" "uuid", "p_trip_share_link_id" "uuid", "p_type" "text", "p_user_id" "uuid", "p_wallet_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."apply_transaction"("p_amount" numeric, "p_category" "text", "p_currency" "text", "p_date_end" "date", "p_date_start" "date", "p_label" "text", "p_out_of_budget" boolean, "p_pay_now" boolean, "p_subcategory" "text", "p_trip_expense_id" "uuid", "p_trip_share_link_id" "uuid", "p_type" "text", "p_user_id" "uuid", "p_wallet_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."apply_transaction_v2"("p_wallet_id" "uuid", "p_type" "text", "p_label" "text", "p_amount" numeric, "p_currency" "text", "p_date_start" "date", "p_date_end" "date", "p_category" "text", "p_subcategory" "text", "p_pay_now" boolean, "p_out_of_budget" boolean, "p_night_covered" boolean, "p_affects_budget" boolean, "p_trip_expense_id" "uuid", "p_trip_share_link_id" "uuid", "p_fx_rate_snapshot" numeric, "p_fx_source_snapshot" "text", "p_fx_snapshot_at" timestamp with time zone, "p_fx_base_currency_snapshot" "text", "p_fx_tx_currency_snapshot" "text", "p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."apply_transaction_v2"("p_wallet_id" "uuid", "p_type" "text", "p_label" "text", "p_amount" numeric, "p_currency" "text", "p_date_start" "date", "p_date_end" "date", "p_category" "text", "p_subcategory" "text", "p_pay_now" boolean, "p_out_of_budget" boolean, "p_night_covered" boolean, "p_affects_budget" boolean, "p_trip_expense_id" "uuid", "p_trip_share_link_id" "uuid", "p_fx_rate_snapshot" numeric, "p_fx_source_snapshot" "text", "p_fx_snapshot_at" timestamp with time zone, "p_fx_base_currency_snapshot" "text", "p_fx_tx_currency_snapshot" "text", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."apply_transaction_v2"("p_wallet_id" "uuid", "p_type" "text", "p_label" "text", "p_amount" numeric, "p_currency" "text", "p_date_start" "date", "p_date_end" "date", "p_category" "text", "p_subcategory" "text", "p_pay_now" boolean, "p_out_of_budget" boolean, "p_night_covered" boolean, "p_affects_budget" boolean, "p_trip_expense_id" "uuid", "p_trip_share_link_id" "uuid", "p_fx_rate_snapshot" numeric, "p_fx_source_snapshot" "text", "p_fx_snapshot_at" timestamp with time zone, "p_fx_base_currency_snapshot" "text", "p_fx_tx_currency_snapshot" "text", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."bind_trip_member_to_auth"("p_trip_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."bind_trip_member_to_auth"("p_trip_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."bind_trip_member_to_auth"("p_trip_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."delete_transaction"("p_tx_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."delete_transaction"("p_tx_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_transaction"("p_tx_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_tx_wallet_period_match"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_tx_wallet_period_match"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_tx_wallet_period_match"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_trip_participant"("p_trip_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_trip_participant"("p_trip_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_trip_participant"("p_trip_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_trip_participant"("p_trip_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_fx_snapshot_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_fx_snapshot_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_fx_snapshot_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."tb_profiles_role_guard"() TO "anon";
GRANT ALL ON FUNCTION "public"."tb_profiles_role_guard"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."tb_profiles_role_guard"() TO "service_role";



GRANT ALL ON FUNCTION "public"."tb_touch_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."tb_touch_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."tb_touch_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."trip_accept_invite"("p_token" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."trip_accept_invite"("p_token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."trip_accept_invite"("p_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."trip_accept_invite"("p_token" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."trip_after_group_insert_add_owner"() TO "anon";
GRANT ALL ON FUNCTION "public"."trip_after_group_insert_add_owner"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trip_after_group_insert_add_owner"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trip_bind_member_to_auth"("p_trip_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."trip_bind_member_to_auth"("p_trip_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."trip_bind_member_to_auth"("p_trip_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."trip_role"("p_trip_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."trip_role"("p_trip_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."trip_role"("p_trip_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."trip_role"("p_trip_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."update_transaction"("p_tx_id" "uuid", "p_wallet_id" "uuid", "p_type" "text", "p_amount" numeric, "p_currency" "text", "p_category" "text", "p_label" "text", "p_date_start" "date", "p_date_end" "date", "p_pay_now" boolean, "p_out_of_budget" boolean, "p_night_covered" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_transaction"("p_tx_id" "uuid", "p_wallet_id" "uuid", "p_type" "text", "p_amount" numeric, "p_currency" "text", "p_category" "text", "p_label" "text", "p_date_start" "date", "p_date_end" "date", "p_pay_now" boolean, "p_out_of_budget" boolean, "p_night_covered" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."update_transaction"("p_tx_id" "uuid", "p_wallet_id" "uuid", "p_type" "text", "p_amount" numeric, "p_currency" "text", "p_category" "text", "p_label" "text", "p_date_start" "date", "p_date_end" "date", "p_pay_now" boolean, "p_out_of_budget" boolean, "p_night_covered" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_transaction"("p_tx_id" "uuid", "p_wallet_id" "uuid", "p_type" "text", "p_amount" numeric, "p_currency" "text", "p_category" "text", "p_label" "text", "p_date_start" "date", "p_date_end" "date", "p_pay_now" boolean, "p_out_of_budget" boolean, "p_night_covered" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_transaction_v2"("p_id" "uuid", "p_wallet_id" "uuid", "p_type" "text", "p_amount" numeric, "p_currency" "text", "p_category" "text", "p_label" "text", "p_date_start" "date", "p_date_end" "date", "p_pay_now" boolean, "p_out_of_budget" boolean, "p_night_covered" boolean, "p_user_id" "uuid", "p_subcategory" "text", "p_trip_expense_id" "uuid", "p_trip_share_link_id" "uuid", "p_fx_rate_snapshot" numeric, "p_fx_source_snapshot" "text", "p_fx_snapshot_at" timestamp with time zone, "p_fx_base_currency_snapshot" "text", "p_fx_tx_currency_snapshot" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_transaction_v2"("p_id" "uuid", "p_wallet_id" "uuid", "p_type" "text", "p_amount" numeric, "p_currency" "text", "p_category" "text", "p_label" "text", "p_date_start" "date", "p_date_end" "date", "p_pay_now" boolean, "p_out_of_budget" boolean, "p_night_covered" boolean, "p_user_id" "uuid", "p_subcategory" "text", "p_trip_expense_id" "uuid", "p_trip_share_link_id" "uuid", "p_fx_rate_snapshot" numeric, "p_fx_source_snapshot" "text", "p_fx_snapshot_at" timestamp with time zone, "p_fx_base_currency_snapshot" "text", "p_fx_tx_currency_snapshot" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_transaction_v2"("p_id" "uuid", "p_wallet_id" "uuid", "p_type" "text", "p_amount" numeric, "p_currency" "text", "p_category" "text", "p_label" "text", "p_date_start" "date", "p_date_end" "date", "p_pay_now" boolean, "p_out_of_budget" boolean, "p_night_covered" boolean, "p_user_id" "uuid", "p_subcategory" "text", "p_trip_expense_id" "uuid", "p_trip_share_link_id" "uuid", "p_fx_rate_snapshot" numeric, "p_fx_source_snapshot" "text", "p_fx_snapshot_at" timestamp with time zone, "p_fx_base_currency_snapshot" "text", "p_fx_tx_currency_snapshot" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_transaction_v2"("p_wallet_id" "uuid", "p_tx_id" "uuid", "p_type" "text", "p_label" "text", "p_amount" numeric, "p_currency" "text", "p_date_start" "date", "p_date_end" "date", "p_category" "text", "p_pay_now" boolean, "p_out_of_budget" boolean, "p_night_covered" boolean, "p_fx_rate_snapshot" numeric, "p_fx_source_snapshot" "text", "p_fx_snapshot_at" timestamp with time zone, "p_fx_base_currency_snapshot" "text", "p_fx_tx_currency_snapshot" "text", "p_affects_budget" boolean, "p_trip_expense_id" "uuid", "p_trip_share_link_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."update_transaction_v2"("p_wallet_id" "uuid", "p_tx_id" "uuid", "p_type" "text", "p_label" "text", "p_amount" numeric, "p_currency" "text", "p_date_start" "date", "p_date_end" "date", "p_category" "text", "p_pay_now" boolean, "p_out_of_budget" boolean, "p_night_covered" boolean, "p_fx_rate_snapshot" numeric, "p_fx_source_snapshot" "text", "p_fx_snapshot_at" timestamp with time zone, "p_fx_base_currency_snapshot" "text", "p_fx_tx_currency_snapshot" "text", "p_affects_budget" boolean, "p_trip_expense_id" "uuid", "p_trip_share_link_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_transaction_v2"("p_wallet_id" "uuid", "p_tx_id" "uuid", "p_type" "text", "p_label" "text", "p_amount" numeric, "p_currency" "text", "p_date_start" "date", "p_date_end" "date", "p_category" "text", "p_pay_now" boolean, "p_out_of_budget" boolean, "p_night_covered" boolean, "p_fx_rate_snapshot" numeric, "p_fx_source_snapshot" "text", "p_fx_snapshot_at" timestamp with time zone, "p_fx_base_currency_snapshot" "text", "p_fx_tx_currency_snapshot" "text", "p_affects_budget" boolean, "p_trip_expense_id" "uuid", "p_trip_share_link_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."budget_segments" TO "anon";
GRANT ALL ON TABLE "public"."budget_segments" TO "authenticated";
GRANT ALL ON TABLE "public"."budget_segments" TO "service_role";



GRANT ALL ON TABLE "public"."categories" TO "anon";
GRANT ALL ON TABLE "public"."categories" TO "authenticated";
GRANT ALL ON TABLE "public"."categories" TO "service_role";



GRANT ALL ON TABLE "public"."fx_manual_rates" TO "anon";
GRANT ALL ON TABLE "public"."fx_manual_rates" TO "authenticated";
GRANT ALL ON TABLE "public"."fx_manual_rates" TO "service_role";



GRANT ALL ON TABLE "public"."fx_rates" TO "anon";
GRANT ALL ON TABLE "public"."fx_rates" TO "authenticated";
GRANT ALL ON TABLE "public"."fx_rates" TO "service_role";



GRANT ALL ON SEQUENCE "public"."fx_rates_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."fx_rates_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."fx_rates_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."periods" TO "anon";
GRANT ALL ON TABLE "public"."periods" TO "authenticated";
GRANT ALL ON TABLE "public"."periods" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."schema_version" TO "service_role";
GRANT SELECT ON TABLE "public"."schema_version" TO "authenticated";



GRANT ALL ON TABLE "public"."settings" TO "anon";
GRANT ALL ON TABLE "public"."settings" TO "authenticated";
GRANT ALL ON TABLE "public"."settings" TO "service_role";



GRANT ALL ON TABLE "public"."transactions" TO "anon";
GRANT ALL ON TABLE "public"."transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."transactions" TO "service_role";



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



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







