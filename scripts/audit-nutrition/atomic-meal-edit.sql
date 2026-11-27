-- Audit only: synchronous edit of the header and existing items, never an upsert.
create function public.audit_nutrition_edit_meal_v1(
  p_meal_id uuid, p_sync_id text, p_expected_revision text,
  p_meal_date date, p_meal_type text, p_label text, p_water_ml numeric, p_items jsonb
)
returns table (status text, revision text)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_current text;
  v_count integer;
  v_item record;
  v_updated integer;
begin
  if v_user is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_meal_id is null or p_sync_id is null or p_sync_id = ''
    or p_expected_revision is null or p_expected_revision !~ '^meal-v1:[0-9a-f]{64}$'
    or jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'Invalid meal edit payload' using errcode = '22023';
  end if;
  if jsonb_array_length(p_items) > 100 then
    raise exception 'Too many food items' using errcode = '22023';
  end if;

  perform 1 from public.nutrition_meals m
    where m.id = p_meal_id and m.sync_id = p_sync_id and m.user_id = v_user for update;
  if not found then
    return query select 'unavailable'::text, null::text;
    return;
  end if;

  perform 1 from public.nutrition_meal_items i
    where i.meal_id = p_meal_id and i.user_id = v_user order by i.id for update;
  select s.revision into v_current from public.audit_nutrition_read_meal_v1(p_meal_id, p_sync_id) s;
  if v_current is distinct from p_expected_revision then
    return query select 'conflict'::text, v_current;
    return;
  end if;

  -- This contract edits the exact current item set in place; no implicit
  -- deletion, row creation, or reordering because of an incomplete draft.
  select count(*) into v_count from public.nutrition_meal_items i
    where i.meal_id = p_meal_id and i.user_id = v_user;
  if v_count <> jsonb_array_length(p_items) or v_count <> (
    select count(distinct i.id) from jsonb_to_recordset(p_items) as i(id uuid)
  ) then
    raise exception 'Edit requires exactly the existing items' using errcode = '22023';
  end if;

  update public.nutrition_meals m
    set meal_date = p_meal_date, meal_type = p_meal_type, label = p_label, water_ml = p_water_ml
    where m.id = p_meal_id and m.sync_id = p_sync_id and m.user_id = v_user;
  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception 'Meal change not applied' using errcode = '40001';
  end if;

  for v_item in
    select spec.* from jsonb_to_recordset(p_items) as spec(
      id uuid, food_key text, label text, grams numeric, kcal numeric, protein_g numeric,
      carbs_g numeric, fat_g numeric, fiber_g numeric
    )
    left join public.nutrition_meal_items cur
      on cur.id = spec.id and cur.meal_id = p_meal_id and cur.user_id = v_user
    order by cur.sort_order, spec.id
  loop
    update public.nutrition_meal_items i set
      food_key = v_item.food_key, label = v_item.label, grams = v_item.grams, kcal = v_item.kcal,
      protein_g = v_item.protein_g, carbs_g = v_item.carbs_g, fat_g = v_item.fat_g, fiber_g = v_item.fiber_g
    where i.id = v_item.id and i.meal_id = p_meal_id and i.user_id = v_user
      and (i.food_key is not distinct from v_item.food_key or v_item.food_key is null
        or exists (select 1 from public.nutrition_foods f where f.key = v_item.food_key));
    get diagnostics v_updated = row_count;
    if v_updated <> 1 then
      raise exception 'Item change not applied' using errcode = '22023';
    end if;
  end loop;
  return query select 'updated'::text, s.revision from public.audit_nutrition_read_meal_v1(p_meal_id, p_sync_id) s;
end;
$$;

revoke all on function public.audit_nutrition_edit_meal_v1(uuid,text,text,date,text,text,numeric,jsonb)
  from public, anon, authenticated;
grant execute on function public.audit_nutrition_edit_meal_v1(uuid,text,text,date,text,text,numeric,jsonb)
  to authenticated;
