-- A generated occurrence may be deliberately reclassified, but it first
-- becomes a manual transaction so no future rule reconciliation can mutate it.
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

  if coalesce(v_transaction.generated_by_rule, false)
     and p_recurring_rule_id is not distinct from v_transaction.recurring_rule_id then
    return v_transaction.id;
  end if;

  if coalesce(v_transaction.generated_by_rule, false) then
    update public.transactions
    set generated_by_rule = false,
        recurring_instance_status = 'detached',
        updated_at = now()
    where id = v_transaction.id and user_id = v_user_id;
    v_transaction.generated_by_rule := false;
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
      recurring_instance_status = case when pay_now then 'confirmed' else 'detached' end,
      updated_at = now()
  where id = v_transaction.id and user_id = v_user_id;
  return v_transaction.id;
end;
$function$;

revoke all on function public.link_transaction_to_recurring_rule(uuid, uuid) from public, anon;
grant execute on function public.link_transaction_to_recurring_rule(uuid, uuid) to authenticated, service_role;

insert into public.app_test_scenarios (
  id, campaign_id, module_id, title, instructions, expected_result, required, sort_order
)
select '35100000-0000-4000-8000-000000000001'::uuid, campaign.id, module.id,
       'Reclasser une echeance generee 10.5.351',
       'Ouvre une transaction generee, change son abonnement et confirme le message de securite. Recommence depuis une selection multiple contenant une echeance generee.',
       'Le message explique le detachement. Apres confirmation la transaction rejoint le nouvel abonnement, devient manuelle et ne peut plus etre reecrite par la regle d origine.',
       true, 3511
from public.app_test_campaigns campaign
join public.app_test_modules module on module.campaign_id = campaign.id and module.module_key = 'subscriptions'
where campaign.slug = 'stabilisation-modules-10-5-316'
on conflict (id) do update set instructions = excluded.instructions, expected_result = excluded.expected_result;

insert into public.app_test_scenarios (
  id, campaign_id, module_id, title, instructions, expected_result, required, sort_order
)
select '35100000-0000-4000-8000-000000000002'::uuid, campaign.id, module.id,
       'Heroes Abonnements et rail admin 10.5.351',
       'Compare une entree et une sortie en clair/sombre a 1440 et 390 px, puis ouvre le rail avec le compte admin.',
       'Prevu, reel et difference partagent un seul hero; entrees et sorties sont nuancees, les cartes sont compactes et Membres reste en bas du rail sans logo parasite en haut.',
       true, 3512
from public.app_test_campaigns campaign
join public.app_test_modules module on module.campaign_id = campaign.id and module.module_key = 'subscriptions'
where campaign.slug = 'stabilisation-modules-10-5-316'
on conflict (id) do update set instructions = excluded.instructions, expected_result = excluded.expected_result;

update public.app_test_campaigns
set app_version = '10.5.351', updated_at = now()
where slug = 'stabilisation-modules-10-5-316';
