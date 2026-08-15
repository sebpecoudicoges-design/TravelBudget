-- Subscription classification is a user-owned analytical link. Keep ownership
-- and travel boundaries strict, but allow a different flow or currency after
-- the explicit client-side warning so foreign-currency payments remain linkable.
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

update public.app_test_scenarios
set instructions = 'Compare une entree et une sortie en clair/sombre a 1440 et 390 px. Verifie que les cartes de Ce que chaque abonnement coute vraiment sont compactes. Ouvre ensuite le rail admin sans le faire defiler.',
    expected_result = 'Les cartes tiennent sur une ligne compacte en desktop et restent lisibles en mobile. Membres reste dans la colonne du rail et est visible dans la hauteur initiale de l ecran.'
where id = '35100000-0000-4000-8000-000000000002'::uuid;

insert into public.app_test_scenarios (
  id, campaign_id, module_id, title, instructions, expected_result, required, sort_order
)
select '35200000-0000-4000-8000-000000000001'::uuid, campaign.id, module.id,
       'Liste complete des abonnements 10.5.352',
       'Ouvre une transaction puis la liste Abonnement. Verifie les suivis manuels et automatismes du voyage, y compris avec une autre devise. Recommence avec une selection multiple.',
       'Toute la liste active du voyage est visible dans les deux parcours. Un choix de flux ou devise differente affiche un avertissement puis reste enregistrable.',
       true, 3521
from public.app_test_campaigns campaign
join public.app_test_modules module on module.campaign_id = campaign.id and module.module_key = 'subscriptions'
where campaign.slug = 'stabilisation-modules-10-5-316'
on conflict (id) do update set instructions = excluded.instructions, expected_result = excluded.expected_result;

update public.app_test_campaigns
set app_version = '10.5.352', updated_at = now()
where slug = 'stabilisation-modules-10-5-316';
