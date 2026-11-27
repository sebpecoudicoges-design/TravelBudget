-- Audit prototype. Load only into the isolated fixture, not as a migration.
create function public.audit_nutrition_create_meal_v1(
  p_sync_id text,
  p_travel_id uuid,
  p_meal_date date,
  p_meal_type text,
  p_label text,
  p_notes text,
  p_water_ml numeric,
  p_consumed_time time,
  p_items jsonb
)
returns table (meal_id uuid, status text)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_meal public.nutrition_meals%rowtype;
  v_requested jsonb;
  v_stored jsonb;
begin
  if v_user is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_sync_id is null or p_sync_id !~ '^[A-Za-z0-9_-]{1,128}$'
    or jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'Invalid meal replay payload' using errcode = '22023';
  end if;
  if jsonb_array_length(p_items) > 100 then
    raise exception 'Too many food items' using errcode = '22023';
  end if;
  if p_travel_id is not null and not exists (
    select 1 from public.travels t where t.id = p_travel_id and t.user_id = v_user
  ) then
    raise exception 'Travel unavailable' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(jsonb_build_array(
    i.food_key, i.label, i.grams, i.kcal, i.protein_g, i.carbs_g, i.fat_g, i.fiber_g, e.ord - 1
  ) order by e.ord), '[]'::jsonb)
  into v_requested
  from jsonb_array_elements(p_items) with ordinality as e(item, ord)
  cross join lateral jsonb_to_record(e.item) as i(
    food_key text, label text, grams numeric, kcal numeric,
    protein_g numeric, carbs_g numeric, fat_g numeric, fiber_g numeric
  );

  insert into public.nutrition_meals (user_id, sync_id, travel_id, meal_date,
    meal_type, label, notes, water_ml, consumed_time)
  values (v_user, p_sync_id, p_travel_id, p_meal_date, p_meal_type, p_label, p_notes, p_water_ml, p_consumed_time)
  on conflict (user_id, sync_id) do nothing
  returning * into v_meal;

  if found then
    -- Let any constraint failure abort the whole request, including this meal row.
    insert into public.nutrition_meal_items (user_id, meal_id, food_key, label,
      grams, kcal, protein_g, carbs_g, fat_g, fiber_g, sort_order)
    select v_user, v_meal.id, i.food_key, i.label, i.grams, i.kcal, i.protein_g,
      i.carbs_g, i.fat_g, i.fiber_g, (e.ord - 1)::integer
    from jsonb_array_elements(p_items) with ordinality as e(item, ord)
    cross join lateral jsonb_to_record(e.item) as i(
      food_key text, label text, grams numeric, kcal numeric,
      protein_g numeric, carbs_g numeric, fat_g numeric, fiber_g numeric
    )
    where i.food_key is null or exists (
      select 1 from public.nutrition_foods f where f.key = i.food_key
    );
    -- A reference hidden by catalog policies is not equivalent to an omitted item.
    if (select count(*) from public.nutrition_meal_items m
        where m.meal_id = v_meal.id and m.user_id = v_user) <> jsonb_array_length(p_items) then
      raise exception 'Food unavailable' using errcode = '42501';
    end if;
    return query select v_meal.id, 'created'::text;
    return;
  end if;

  select m.* into v_meal from public.nutrition_meals m
    where m.user_id = v_user and m.sync_id = p_sync_id for update;
  if not found then
    raise exception 'Meal changed while confirming replay' using errcode = '40001';
  end if;
  select coalesce(jsonb_agg(jsonb_build_array(
    i.food_key, i.label, i.grams, i.kcal, i.protein_g, i.carbs_g, i.fat_g, i.fiber_g, i.sort_order
  ) order by i.sort_order, i.id), '[]'::jsonb)
  into v_stored
  from (
    -- The parent lock protects membership against later FK inserts. Protect
    -- existing rows too so a direct item update/delete is ordered before or
    -- after confirmation, rather than comparing an earlier committed value.
    select item.* from public.nutrition_meal_items item
    where item.user_id = v_user and item.meal_id = v_meal.id
    order by item.id for update
  ) i;

  if row(v_meal.travel_id, v_meal.meal_date, v_meal.meal_type, v_meal.label,
    v_meal.notes, v_meal.water_ml, v_meal.consumed_time) is distinct from
    row(p_travel_id, p_meal_date, p_meal_type, p_label, p_notes, p_water_ml, p_consumed_time)
    or v_stored is distinct from v_requested then
    return query select v_meal.id, 'conflict'::text;
  else
    return query select v_meal.id, 'already_applied'::text;
  end if;
end;
$$;

revoke all on function public.audit_nutrition_create_meal_v1(text, uuid, date, text, text, text, numeric, time, jsonb)
  from public, anon, authenticated;
grant execute on function public.audit_nutrition_create_meal_v1(text, uuid, date, text, text, text, numeric, time, jsonb)
  to authenticated;
