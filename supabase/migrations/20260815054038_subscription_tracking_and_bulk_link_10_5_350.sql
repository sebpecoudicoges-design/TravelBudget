-- Manual subscription tracking, reliable recurring inserts and bulk transaction linkage.

alter table public.recurring_rules
  add column if not exists tracking_only boolean not null default false;

alter table public.recurring_rules
  drop constraint if exists recurring_rules_amount_check;
alter table public.recurring_rules
  add constraint recurring_rules_amount_check
  check (
    (tracking_only and amount >= 0)
    or (not tracking_only and amount > 0)
  );

-- The trigger must be able to call the private scheduling helper even though
-- authenticated clients cannot execute that helper directly.
alter function public.recurring_align_rule_first_due() security definer;
revoke all on function public.recurring_align_rule_first_due() from public, anon, authenticated;

create or replace function public.save_subscription_rule_v3(
  p_rule_id uuid,
  p_travel_id uuid,
  p_wallet_id uuid,
  p_label text,
  p_tracking_only boolean,
  p_type text,
  p_amount numeric,
  p_currency text,
  p_category text,
  p_subcategory text,
  p_rule_type text,
  p_interval_count integer,
  p_weekday integer,
  p_monthday integer,
  p_start_date date,
  p_end_date date,
  p_max_occurrences integer,
  p_out_of_budget boolean
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_uid uuid := auth.uid();
  v_rule_id uuid;
  v_tracking boolean := coalesce(p_tracking_only, false);
  v_label text := nullif(trim(coalesce(p_label, '')), '');
  v_type text := lower(trim(coalesce(p_type, 'expense')));
  v_currency text := upper(trim(coalesce(p_currency, '')));
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if v_label is null then raise exception 'subscription name is required'; end if;
  if not exists (
    select 1 from public.travels t
    where t.id = p_travel_id and t.user_id = v_uid
  ) then raise exception 'travel not found or not owned' using errcode = '42501'; end if;
  if not exists (
    select 1 from public.wallets w
    where w.id = p_wallet_id
      and w.user_id = v_uid
      and (w.travel_id is null or w.travel_id = p_travel_id)
  ) then raise exception 'wallet not found in subscription travel' using errcode = '42501'; end if;
  if v_type not in ('expense', 'income') then raise exception 'invalid transaction type'; end if;
  if v_currency !~ '^[A-Z]{3}$' then raise exception 'invalid currency'; end if;

  if p_rule_id is null then
    insert into public.recurring_rules (
      user_id, travel_id, wallet_id, label, tracking_only, type, amount,
      currency, category, subcategory, rule_type, interval_count, weekday,
      monthday, week_of_month, start_date, next_due_at, end_date,
      max_occurrences, is_active, archived, out_of_budget
    ) values (
      v_uid, p_travel_id, p_wallet_id, v_label, v_tracking, v_type,
      case when v_tracking then 0 else p_amount end,
      v_currency, case when v_tracking then null else nullif(trim(coalesce(p_category, '')), '') end,
      case when v_tracking then null else nullif(trim(coalesce(p_subcategory, '')), '') end,
      case when v_tracking then 'monthly' else p_rule_type end,
      case when v_tracking then 1 else p_interval_count end,
      case when v_tracking then null else p_weekday end,
      case when v_tracking then null else p_monthday end,
      null, coalesce(p_start_date, current_date), coalesce(p_start_date, current_date),
      case when v_tracking then null else p_end_date end,
      case when v_tracking then null else p_max_occurrences end,
      not v_tracking, false, case when v_tracking then false else coalesce(p_out_of_budget, false) end
    ) returning id into v_rule_id;

    if v_tracking then
      update public.recurring_rules
      set next_due_at = null, generated_until = null
      where id = v_rule_id;
    else
      perform public.recurring_generate_for_rule(v_rule_id);
    end if;
    return v_rule_id;
  end if;

  select r.id into v_rule_id
  from public.recurring_rules r
  where r.id = p_rule_id and r.user_id = v_uid and r.travel_id = p_travel_id
  for update;
  if v_rule_id is null then raise exception 'subscription not found or not owned' using errcode = '42501'; end if;

  if v_tracking then
    delete from public.transactions t
    where t.recurring_rule_id = v_rule_id
      and t.user_id = v_uid
      and coalesce(t.generated_by_rule, false)
      and not coalesce(t.pay_now, false)
      and coalesce(t.recurring_instance_status, 'generated') = 'generated';

    update public.recurring_rules
    set wallet_id = p_wallet_id,
        label = v_label,
        tracking_only = true,
        type = v_type,
        amount = 0,
        currency = v_currency,
        category = null,
        subcategory = null,
        is_active = false,
        next_due_at = null,
        generated_until = null,
        updated_at = now()
    where id = v_rule_id and user_id = v_uid;
    return v_rule_id;
  end if;

  if coalesce(p_amount, 0) <= 0 then raise exception 'amount must be positive'; end if;
  update public.recurring_rules
  set tracking_only = false, is_active = true, updated_at = now()
  where id = v_rule_id and user_id = v_uid;

  perform public.recurring_update_rule_v2(
    v_rule_id, p_wallet_id, v_label, p_amount, v_currency, v_type,
    p_category, p_subcategory, p_rule_type, p_interval_count, p_weekday,
    p_monthday, p_start_date, p_end_date, p_max_occurrences,
    coalesce(p_out_of_budget, false)
  );
  return v_rule_id;
end;
$function$;

revoke all on function public.save_subscription_rule_v3(
  uuid, uuid, uuid, text, boolean, text, numeric, text, text, text, text,
  integer, integer, integer, date, date, integer, boolean
) from public, anon;
grant execute on function public.save_subscription_rule_v3(
  uuid, uuid, uuid, text, boolean, text, numeric, text, text, text, text,
  integer, integer, integer, date, date, integer, boolean
) to authenticated, service_role;

create or replace function public.link_transaction_to_recurring_rule(
  p_transaction_id uuid,
  p_recurring_rule_id uuid default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $function$
declare
  v_user_id uuid := auth.uid();
  v_transaction public.transactions%rowtype;
  v_rule public.recurring_rules%rowtype;
begin
  if v_user_id is null then raise exception 'Not authenticated' using errcode = '42501'; end if;
  select * into v_transaction from public.transactions
  where id = p_transaction_id and user_id = v_user_id for update;
  if not found then raise exception 'Transaction not found or not owned' using errcode = '42501'; end if;

  if coalesce(v_transaction.generated_by_rule, false) then
    if p_recurring_rule_id is distinct from v_transaction.recurring_rule_id then
      raise exception 'Generated occurrences keep their automatic recurring rule link';
    end if;
    return v_transaction.id;
  end if;

  if p_recurring_rule_id is null then
    update public.transactions
    set recurring_rule_id = null, occurrence_date = null,
        recurring_instance_status = null, updated_at = now()
    where id = v_transaction.id and user_id = v_user_id;
    return v_transaction.id;
  end if;

  select * into v_rule from public.recurring_rules
  where id = p_recurring_rule_id and user_id = v_user_id
    and not coalesce(archived, false);
  if not found then raise exception 'Subscription not found or not owned' using errcode = '42501'; end if;
  if v_transaction.travel_id is distinct from v_rule.travel_id then
    raise exception 'Transaction and subscription must belong to the same travel';
  end if;
  if not coalesce(v_rule.tracking_only, false) then
    if lower(v_transaction.type) is distinct from lower(v_rule.type) then
      raise exception 'Transaction and recurring rule must use the same type';
    end if;
    if upper(v_transaction.currency) is distinct from upper(v_rule.currency) then
      raise exception 'Transaction and recurring rule must use the same currency';
    end if;
  end if;

  update public.transactions
  set recurring_rule_id = v_rule.id,
      occurrence_date = coalesce(occurrence_date, date_start),
      generated_by_rule = false,
      recurring_instance_status = case when pay_now then 'confirmed' else 'generated' end,
      updated_at = now()
  where id = v_transaction.id and user_id = v_user_id;
  return v_transaction.id;
end;
$function$;

revoke all on function public.link_transaction_to_recurring_rule(uuid, uuid) from public, anon;
grant execute on function public.link_transaction_to_recurring_rule(uuid, uuid) to authenticated, service_role;

create or replace function public.link_transactions_to_recurring_rule(
  p_transaction_ids uuid[],
  p_recurring_rule_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $function$
declare
  v_id uuid;
  v_count integer := 0;
begin
  if auth.uid() is null then raise exception 'Not authenticated' using errcode = '42501'; end if;
  if coalesce(array_length(p_transaction_ids, 1), 0) = 0 then raise exception 'No transaction selected'; end if;
  if array_length(p_transaction_ids, 1) > 500 then raise exception 'Too many transactions selected'; end if;
  foreach v_id in array p_transaction_ids loop
    perform public.link_transaction_to_recurring_rule(v_id, p_recurring_rule_id);
    v_count := v_count + 1;
  end loop;
  return jsonb_build_object('linked_count', v_count, 'rule_id', p_recurring_rule_id);
end;
$function$;

revoke all on function public.link_transactions_to_recurring_rule(uuid[], uuid) from public, anon;
grant execute on function public.link_transactions_to_recurring_rule(uuid[], uuid) to authenticated, service_role;

update public.app_test_scenarios
set instructions = 'Ajoute un abonnement avec son nom uniquement, puis rattache une transaction depuis Transactions. Cree aussi une regle automatique avec un montant et controle la premiere echeance.',
    expected_result = 'Le suivi manuel se cree sans montant ni 403 et ne genere aucune transaction. La regle automatique cree ses echeances et les deux modes restent modifiables.'
where id = '34900000-0000-4000-8000-000000000003'::uuid;

insert into public.app_test_scenarios (
  id, campaign_id, module_id, title, instructions, expected_result, required, sort_order
)
select '35000000-0000-4000-8000-000000000001'::uuid, campaign.id, module.id,
       'Analyse par abonnement 10.5.350',
       'Rattache plusieurs paiements a un abonnement puis ouvre sa Vue d ensemble.',
       'Une carte hero affiche le cout mensuel, le total depense, le nombre de paiements et la prochaine echeance sans melanger les devises.',
       true, 3501
from public.app_test_campaigns campaign
join public.app_test_modules module on module.campaign_id = campaign.id and module.module_key = 'subscriptions'
where campaign.slug = 'stabilisation-modules-10-5-316'
on conflict (id) do update set instructions = excluded.instructions, expected_result = excluded.expected_result;

insert into public.app_test_scenarios (
  id, campaign_id, module_id, title, instructions, expected_result, required, sort_order
)
select '35000000-0000-4000-8000-000000000002'::uuid, campaign.id, module.id,
       'Rattachement multiple Transactions 10.5.350',
       'Filtre les transactions, utilise Tout selectionner ou coche plusieurs lignes, choisis un abonnement puis applique le rattachement.',
       'Toutes les lignes compatibles sont rattachees atomiquement. Une echeance generee ou un lot invalide bloque le lot avec un message clair.',
       true, 3502
from public.app_test_campaigns campaign
join public.app_test_modules module on module.campaign_id = campaign.id and module.module_key = 'subscriptions'
where campaign.slug = 'stabilisation-modules-10-5-316'
on conflict (id) do update set instructions = excluded.instructions, expected_result = excluded.expected_result;

update public.app_test_campaigns
set app_version = '10.5.350', updated_at = now()
where slug = 'stabilisation-modules-10-5-316';
