-- Preserve old Trip shadow rows for traceability, but neutralize them only when
-- a linked replacement with the same accounting identity exists.
update public.transactions orphan
set is_internal = true,
    affects_budget = false,
    out_of_budget = true,
    recurring_instance_status = null,
    updated_at = now()
where orphan.type = 'expense'
  and orphan.pay_now = false
  and orphan.is_internal = false
  and left(coalesce(orphan.label, ''), 6) = '[Trip]'
  and not exists (
    select 1
    from public.trip_expense_budget_links orphan_link
    where orphan_link.transaction_id = orphan.id
  )
  and exists (
    select 1
    from public.transactions replacement
    join public.trip_expense_budget_links replacement_link
      on replacement_link.transaction_id = replacement.id
    where replacement.id <> orphan.id
      and replacement.user_id = orphan.user_id
      and replacement.type = orphan.type
      and replacement.pay_now = orphan.pay_now
      and replacement.is_internal = true
      and replacement.affects_budget = true
      and replacement.out_of_budget = false
      and replacement.amount = orphan.amount
      and upper(replacement.currency) = upper(orphan.currency)
      and coalesce(replacement.category, '') = coalesce(orphan.category, '')
      and coalesce(replacement.subcategory, '') = coalesce(orphan.subcategory, '')
      and coalesce(replacement.budget_date_start, replacement.date_start) = coalesce(orphan.budget_date_start, orphan.date_start)
      and coalesce(replacement.budget_date_end, replacement.date_end) = coalesce(orphan.budget_date_end, orphan.date_end)
  );

update public.app_test_modules module
set status = 'in_test', archived_at = null, archive_reason = null, updated_at = now()
from public.app_test_campaigns campaign
where module.campaign_id = campaign.id
  and campaign.slug = 'stabilisation-modules-10-5-316'
  and module.module_key in ('dashboard', 'analysis', 'transactions');

insert into public.app_test_scenarios (
  id, campaign_id, module_id, parent_scenario_id, title, instructions,
  expected_result, required, sort_order
)
select
  '35800000-0000-4000-8000-000000000001'::uuid,
  parent.campaign_id,
  parent.module_id,
  parent.id,
  'Signes du budget journalier 10.5.358',
  'Ouvre le budget journalier sur une journée avec une dépense, puis sur une journée où remboursements ou quote-parts reçues dépassent les dépenses.',
  'Chaque journée affiche un marqueur signé : moins rouge lorsque le budget est consommé, plus vert lorsqu il est recrédité. Le budget net utilisé et le restant gardent les mêmes montants.',
  true,
  3581
from public.app_test_scenarios parent
where parent.id = '35700000-0000-4000-8000-000000000001'::uuid
on conflict (id) do update
set parent_scenario_id = excluded.parent_scenario_id,
    title = excluded.title,
    instructions = excluded.instructions,
    expected_result = excluded.expected_result,
    required = excluded.required,
    sort_order = excluded.sort_order;

insert into public.app_test_scenarios (
  id, campaign_id, module_id, parent_scenario_id, title, instructions,
  expected_result, required, sort_order
)
select
  '35800000-0000-4000-8000-000000000002'::uuid,
  parent.campaign_id,
  parent.module_id,
  parent.id,
  'Transactions gérées par Trip 10.5.358',
  'Recherche une transaction issue d une dépense partagée Trip, notamment une ancienne ligne avec le libellé [Trip] Dépense partagée.',
  'La ligne source ou ombre ne propose jamais Payer, Dupliquer, Edit ou Del. Elle renvoie vers Trip. Le badge Confirmée reste réservé aux transactions réellement issues d une règle récurrente.',
  true,
  3582
from public.app_test_scenarios parent
where parent.id = '1477211e-f702-f2e5-f0db-7739431c95c0'::uuid
on conflict (id) do update
set parent_scenario_id = excluded.parent_scenario_id,
    title = excluded.title,
    instructions = excluded.instructions,
    expected_result = excluded.expected_result,
    required = excluded.required,
    sort_order = excluded.sort_order;

insert into public.app_test_scenarios (
  id, campaign_id, module_id, parent_scenario_id, title, instructions,
  expected_result, required, sort_order
)
select
  '35800000-0000-4000-8000-000000000003'::uuid,
  parent.campaign_id,
  parent.module_id,
  parent.id,
  'Lecture nette de la projection 10.5.358',
  'Dans Analyse, compare Budget net consommé vs projection avec une période contenant des entrées imputées à des catégories de dépense.',
  'La carte précise le montant des entrées budget déduites. Son numérateur correspond au net à date et reste identique au cumul du budget journalier.',
  true,
  3583
from public.app_test_scenarios parent
where parent.id = '35600000-0000-4000-8000-000000000001'::uuid
on conflict (id) do update
set parent_scenario_id = excluded.parent_scenario_id,
    title = excluded.title,
    instructions = excluded.instructions,
    expected_result = excluded.expected_result,
    required = excluded.required,
    sort_order = excluded.sort_order;

update public.app_test_campaigns
set app_version = '10.5.358', updated_at = now()
where slug = 'stabilisation-modules-10-5-316';
