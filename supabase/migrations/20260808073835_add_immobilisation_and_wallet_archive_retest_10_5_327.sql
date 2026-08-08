-- Keep the default transaction taxonomy complete for existing and future users.
create or replace function public.seed_default_categories_for_user()
returns integer
language plpgsql
security definer
set search_path = public
as $$
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
    (v_user_id, 'Mouvement interne', null, 17),
    (v_user_id, 'Immobilisation', '#64748b', 18)
  on conflict do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.seed_default_categories_for_user() from public, anon;
grant execute on function public.seed_default_categories_for_user() to authenticated, service_role;

create or replace function public.seed_default_analytic_category_mappings()
returns integer
language plpgsql
security definer
set search_path = public
as $$
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
    (v_user_id, 'Logement', null, 'mapped', 'accommodation', 'Core accommodation category'),
    (v_user_id, 'Repas', null, 'mapped', 'food', 'Core food category'),
    (v_user_id, 'Transport', null, 'mapped', 'transport', 'Core transport category'),
    (v_user_id, 'Sorties', null, 'mapped', 'activities', 'Mapped to activities by product decision'),
    (v_user_id, 'Laundry', null, 'mapped', 'activities', 'Mapped to activities for now'),
    (v_user_id, 'Autre', null, 'mapped', 'activities', 'Temporary analytical fallback'),
    (v_user_id, 'Abonnement/Mobile', null, 'mapped', 'activities', 'Temporary analytical fallback'),
    (v_user_id, 'Transport Internationale', null, 'excluded', null, 'Excluded from local daily reference mix'),
    (v_user_id, 'Visa', null, 'excluded', null, 'Excluded from daily reference mix'),
    (v_user_id, 'Santé', null, 'excluded', null, 'Excluded from daily reference mix'),
    (v_user_id, 'Projet Personnel', null, 'excluded', null, 'Excluded from travel daily reference mix'),
    (v_user_id, 'Souvenir', null, 'excluded', null, 'Excluded from reference mix'),
    (v_user_id, 'Revenu', null, 'excluded', null, 'Income excluded from expense analytic mix'),
    (v_user_id, 'Frais bancaire', null, 'excluded', null, 'Excluded from daily reference mix'),
    (v_user_id, 'Caution', null, 'excluded', null, 'Excluded from daily reference mix'),
    (v_user_id, 'Immobilisation', null, 'excluded', null, 'Capital purchase excluded from daily reference mix')
  on conflict do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.seed_default_analytic_category_mappings() from public, anon;
grant execute on function public.seed_default_analytic_category_mappings() to authenticated, service_role;

insert into public.categories (user_id, name, color, sort_order)
select
  p.id,
  'Immobilisation',
  '#64748b',
  coalesce((select max(c.sort_order) + 1 from public.categories c where c.user_id = p.id), 0)
from public.profiles p
where not exists (
  select 1 from public.categories c
  where c.user_id = p.id and lower(c.name) = lower('Immobilisation')
)
on conflict do nothing;

insert into public.analytic_category_mappings
  (user_id, category_name, subcategory_name, mapping_status, analytic_family, notes)
select p.id, 'Immobilisation', null, 'excluded', null, 'Capital purchase excluded from daily reference mix'
from public.profiles p
where not exists (
  select 1 from public.analytic_category_mappings m
  where m.user_id = p.id
    and lower(m.category_name) = lower('Immobilisation')
    and m.subcategory_name is null
)
on conflict do nothing;

-- The Transactions note is now handled and gets a linked retest.
update public.app_test_scenarios
set closed_at = coalesce(closed_at, now()),
    closed_version = coalesce(closed_version, '10.5.327'),
    closure_notes = coalesce(closure_notes, 'Immobilisation est ajoutee aux categories SQL par defaut et retro-propagee sans doublon aux comptes existants.')
where id = '668d9edc-213a-3a01-e16e-6cbfa2c1f1e1'::uuid;

update public.app_test_results
set treated_at = coalesce(treated_at, now()),
    archived_at = coalesce(archived_at, now()),
    treated_version = coalesce(treated_version, '10.5.327'),
    treatment_notes = coalesce(treatment_notes, 'Categorie Immobilisation ajoutee aux valeurs par defaut et classee hors du mix analytique quotidien.'),
    updated_at = now()
where scenario_id = '668d9edc-213a-3a01-e16e-6cbfa2c1f1e1'::uuid
  and archived_at is null;

-- Reopen the visual Wallet issue reported after the previous closure and keep both histories linked.
insert into public.app_test_scenarios (
  id, campaign_id, module_id, parent_scenario_id, title, instructions,
  expected_result, required, sort_order
)
select child.id, parent.campaign_id, parent.module_id, parent.id, child.title,
       child.instructions, child.expected_result, true, child.sort_order
from (values
  (
    '32700000-0000-4000-8000-000000000001'::uuid,
    '52468719-2e78-3c71-98c4-3f66b7d254ea'::uuid,
    9,
    'Retest Archiver dans la carte wallet 10.5.327',
    'Verifie plusieurs wallets en theme clair et sombre sur desktop puis mobile, avec des noms et historiques de longueurs differentes.',
    'Le panneau d actions reste entierement dans chaque carte et Archiver ou Desarchiver occupe une ligne interne pleine largeur sur mobile.'
  ),
  (
    '32700000-0000-4000-8000-000000000002'::uuid,
    '668d9edc-213a-3a01-e16e-6cbfa2c1f1e1'::uuid,
    5,
    'Retest categorie Immobilisation 10.5.327',
    'Recharge l application, ouvre une creation de transaction puis la liste des categories dans Settings.',
    'Immobilisation est proposee sans doublon et reste disponible apres une nouvelle connexion.'
  )
) as child(id, parent_id, sort_order, title, instructions, expected_result)
join public.app_test_scenarios parent on parent.id = child.parent_id
on conflict (module_id, sort_order) do update set
  parent_scenario_id = excluded.parent_scenario_id,
  title = excluded.title,
  instructions = excluded.instructions,
  expected_result = excluded.expected_result,
  required = excluded.required,
  closed_at = null,
  closed_by = null,
  closed_version = null,
  closure_notes = null;

update public.app_test_campaigns
set app_version = '10.5.327', updated_at = now()
where id = '20000000-0000-4000-8000-000000000001';
