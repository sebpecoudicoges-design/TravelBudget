create or replace function public.rename_category_bundle(
  p_old_name text,
  p_new_name text,
  p_color text default '#94a3b8'
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_old text := nullif(trim(p_old_name), '');
  v_new text := nullif(trim(p_new_name), '');
  v_color text := coalesce(nullif(trim(p_color), ''), '#94a3b8');
  v_category_id uuid;
  v_transactions integer := 0;
begin
  if v_actor is null then raise exception 'Not authenticated'; end if;
  if v_old is null or v_new is null then raise exception 'Category names are required'; end if;
  if v_color !~ '^#[0-9a-fA-F]{6}$' then raise exception 'Invalid category color'; end if;

  select id into v_category_id
  from public.categories
  where user_id = v_actor and lower(trim(name)) = lower(v_old)
  limit 1;
  if v_category_id is null then raise exception 'Category not found'; end if;
  if lower(v_old) <> lower(v_new) and exists (
    select 1 from public.categories where user_id = v_actor and lower(trim(name)) = lower(v_new)
  ) then raise exception 'Category name already exists'; end if;

  update public.categories
  set name = v_new, color = v_color, updated_at = now()
  where id = v_category_id and user_id = v_actor;
  update public.category_subcategories set category_name = v_new, updated_at = now()
  where user_id = v_actor and lower(trim(category_name)) = lower(v_old);
  update public.analytic_category_mappings set category_name = v_new, updated_at = now()
  where user_id = v_actor and lower(trim(category_name)) = lower(v_old);
  update public.transactions set category = v_new, updated_at = now()
  where user_id = v_actor and lower(trim(category)) = lower(v_old);
  get diagnostics v_transactions = row_count;
  update public.recurring_rules set category = v_new, updated_at = now()
  where user_id = v_actor and lower(trim(category)) = lower(v_old);
  update public.trip_expenses set category = v_new
  where user_id = v_actor and lower(trim(category)) = lower(v_old);
  update public.assets set budget_category = v_new, updated_at = now()
  where user_id = v_actor and lower(trim(budget_category)) = lower(v_old);
  update public.wallet_transfers set category = v_new, updated_at = now()
  where user_id = v_actor and lower(trim(category)) = lower(v_old);

  return jsonb_build_object('old_name', v_old, 'new_name', v_new, 'updated_transactions', v_transactions);
end;
$$;

revoke all on function public.rename_category_bundle(text, text, text) from public, anon;
grant execute on function public.rename_category_bundle(text, text, text) to authenticated;

create or replace function public.delete_subcategory_bundle(p_category_name text, p_subcategory_name text)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_category text := nullif(trim(p_category_name), '');
  v_subcategory text := nullif(trim(p_subcategory_name), '');
  v_deleted_mappings integer := 0;
  v_deleted_subcategories integer := 0;
begin
  if v_actor is null then raise exception 'Not authenticated'; end if;
  if v_category is null or v_subcategory is null then raise exception 'Category and subcategory are required'; end if;

  delete from public.analytic_category_mappings
  where user_id = v_actor
    and lower(trim(category_name)) = lower(v_category)
    and lower(trim(subcategory_name)) = lower(v_subcategory);
  get diagnostics v_deleted_mappings = row_count;
  delete from public.category_subcategories
  where user_id = v_actor
    and lower(trim(category_name)) = lower(v_category)
    and lower(trim(name)) = lower(v_subcategory);
  get diagnostics v_deleted_subcategories = row_count;

  return jsonb_build_object('category_name', v_category, 'subcategory_name', v_subcategory, 'deleted_mappings', v_deleted_mappings, 'deleted_subcategories', v_deleted_subcategories);
end;
$$;

revoke all on function public.delete_subcategory_bundle(text, text) from public, anon;
grant execute on function public.delete_subcategory_bundle(text, text) to authenticated;

update public.app_test_scenarios
set closed_at = coalesce(closed_at, now()),
    closed_version = coalesce(closed_version, '10.5.330'),
    closure_notes = coalesce(closure_notes, 'Retour Categories traite : renommage et ordre des categories, couleur guidee et suppression des sous-categories.')
where id = '3abf3a95-fb89-ab5f-6a7f-759a3d22ad63'::uuid;

update public.app_test_results
set treated_at = coalesce(treated_at, now()),
    archived_at = coalesce(archived_at, now()),
    treated_version = coalesce(treated_version, '10.5.330'),
    treatment_notes = 'Les refus utilisent la notice d erreur, les categories sont renommables et reordonnables, les sous-categories ont le meme selecteur de couleur et une suppression explicite.',
    updated_at = now()
where scenario_id = '3abf3a95-fb89-ab5f-6a7f-759a3d22ad63'::uuid
  and archived_at is null;

insert into public.app_test_scenarios (
  id, campaign_id, module_id, parent_scenario_id, title, instructions, expected_result, required, sort_order
)
select
  '33000000-0000-4000-8000-000000000001'::uuid,
  parent.campaign_id,
  parent.module_id,
  parent.id,
  'Retest gestion Categories Settings 10.5.330',
  'Cree une categorie de test, renomme-la, change sa couleur et son ordre. Cree une sous-categorie, change sa couleur, son ordre et son etat, puis supprime-la.',
  'Les erreurs sont explicites. Noms, couleurs et ordre persistent sans doublon. La suppression de sous-categorie est confirmee et les anciennes transactions conservent leur libelle.',
  true,
  4
from public.app_test_scenarios parent
where parent.id = '3abf3a95-fb89-ab5f-6a7f-759a3d22ad63'::uuid
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
set app_version = '10.5.330', updated_at = now()
where id = '20000000-0000-4000-8000-000000000001'::uuid;
