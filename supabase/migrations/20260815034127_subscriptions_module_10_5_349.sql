-- Secure manual transaction <-> recurring rule linkage for the Abonnements module.
create index if not exists transactions_subscription_timeline_idx
  on public.transactions (user_id, travel_id, recurring_rule_id, occurrence_date)
  where recurring_rule_id is not null;

create or replace function public.link_transaction_to_recurring_rule(
  p_transaction_id uuid,
  p_recurring_rule_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_transaction public.transactions%rowtype;
  v_rule public.recurring_rules%rowtype;
begin
  if v_user_id is null then raise exception 'Not authenticated' using errcode = '42501'; end if;

  select * into v_transaction
  from public.transactions
  where id = p_transaction_id and user_id = v_user_id
  for update;
  if not found then raise exception 'Transaction not found or not owned' using errcode = '42501'; end if;

  if coalesce(v_transaction.generated_by_rule, false) then
    if p_recurring_rule_id is distinct from v_transaction.recurring_rule_id then
      raise exception 'Generated occurrences keep their automatic recurring rule link';
    end if;
    return v_transaction.id;
  end if;

  if p_recurring_rule_id is null then
    update public.transactions
    set recurring_rule_id = null,
        occurrence_date = null,
        recurring_instance_status = null,
        updated_at = now()
    where id = v_transaction.id and user_id = v_user_id;
    return v_transaction.id;
  end if;

  select * into v_rule
  from public.recurring_rules
  where id = p_recurring_rule_id
    and user_id = v_user_id
    and not coalesce(archived, false);
  if not found then raise exception 'Recurring rule not found or not owned' using errcode = '42501'; end if;
  if v_transaction.travel_id is distinct from v_rule.travel_id then raise exception 'Transaction and recurring rule must belong to the same travel'; end if;
  if lower(v_transaction.type) is distinct from lower(v_rule.type) then raise exception 'Transaction and recurring rule must use the same type'; end if;
  if upper(v_transaction.currency) is distinct from upper(v_rule.currency) then raise exception 'Transaction and recurring rule must use the same currency'; end if;

  update public.transactions
  set recurring_rule_id = v_rule.id,
      occurrence_date = coalesce(occurrence_date, date_start),
      generated_by_rule = false,
      recurring_instance_status = case when pay_now then 'confirmed' else 'generated' end,
      updated_at = now()
  where id = v_transaction.id and user_id = v_user_id;
  return v_transaction.id;
end;
$$;

revoke all on function public.link_transaction_to_recurring_rule(uuid, uuid) from public, anon;
grant execute on function public.link_transaction_to_recurring_rule(uuid, uuid) to authenticated, service_role;

-- Dedicated test campaign module and functional contracts for 10.5.349.
insert into public.app_test_modules (
  id, campaign_id, module_key, title, description, instructions, sort_order, status
)
select md5(campaign.id::text || ':subscriptions')::uuid,
       campaign.id,
       'subscriptions',
       'Abonnements',
       'Règles récurrentes, lecture prévu/réel et traçabilité des échéances.',
       'Teste les trois espaces Vue d ensemble, Échéances et Règles, puis le lien avec Transactions.',
       35,
       'in_test'
from public.app_test_campaigns campaign
where campaign.slug = 'stabilisation-modules-10-5-316'
on conflict (campaign_id, module_key) do update
set title = excluded.title,
    description = excluded.description,
    instructions = excluded.instructions,
    sort_order = excluded.sort_order,
    status = excluded.status,
    archived_at = null,
    archive_reason = null,
    updated_at = now();

insert into public.app_test_scenarios (
  id, campaign_id, module_id, title, instructions, expected_result, required, sort_order
)
select scenario.id, campaign.id, module.id, scenario.title, scenario.instructions, scenario.expected_result, true, scenario.sort_order
from public.app_test_campaigns campaign
join public.app_test_modules module on module.campaign_id = campaign.id and module.module_key = 'subscriptions'
cross join (values
  ('34900000-0000-4000-8000-000000000001'::uuid, 'Navigation et rendu Abonnements 10.5.349', 'Ouvre Abonnements en clair puis sombre, sur ordinateur et mobile. Parcours Vue d ensemble, Échéances et Règles.', 'Le module est distinct de Settings, les filtres restent utilisables et aucun contenu ne déborde.', 3491),
  ('34900000-0000-4000-8000-000000000002'::uuid, 'Prévu, réel et statuts 10.5.349', 'Choisis une période contenant des échéances payées, à payer et modifiées, puis compare la synthèse à la liste.', 'Prévu, réel, écart, retards et modifications concordent; les devises ne sont jamais additionnées implicitement.', 3492),
  ('34900000-0000-4000-8000-000000000003'::uuid, 'Création et modification de règle 10.5.349', 'Crée une règle, vérifie la première échéance calculée, puis modifie rythme, jour, montant et catégorie.', 'La prévisualisation est claire et seules les échéances générées non confirmées sont réconciliées; les paiements restent intacts.', 3493),
  ('34900000-0000-4000-8000-000000000004'::uuid, 'Lien Transaction vers Abonnement 10.5.349', 'Crée une transaction manuelle et sélectionne un abonnement compatible, puis ouvre cette ligne depuis Échéances et retire le lien.', 'Le lien est conservé, visible comme manuel, sécurisé au même voyage/type/devise et retirable; les échéances créées par règle gardent leur lien automatique.', 3494)
) as scenario(id, title, instructions, expected_result, sort_order)
where campaign.slug = 'stabilisation-modules-10-5-316'
on conflict (id) do update
set title = excluded.title,
    instructions = excluded.instructions,
    expected_result = excluded.expected_result,
    required = excluded.required,
    sort_order = excluded.sort_order;

update public.app_test_campaigns
set app_version = '10.5.349', updated_at = now()
where slug = 'stabilisation-modules-10-5-316';
