-- Audit-only projection. One read statement for header and ordered items.
create function public.audit_nutrition_read_meal_v1(p_meal_id uuid, p_sync_id text)
returns table (user_id uuid, sync_id text, meal_id uuid, revision text, snapshot jsonb)
language sql
stable
security invoker
set search_path = ''
as $$
  select m.user_id, m.sync_id, m.id,
    'meal-v1:' || pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(view.snapshot::text, 'UTF8')), 'hex'),
    view.snapshot
  from public.nutrition_meals m
  cross join lateral (
    select jsonb_build_object(
      'header', jsonb_build_object('travel_id', m.travel_id, 'meal_date', m.meal_date, 'meal_type', m.meal_type,
        'label', m.label, 'notes', m.notes, 'water_ml', m.water_ml, 'consumed_time', m.consumed_time),
      'items', coalesce(jsonb_agg(jsonb_build_object(
        'id', i.id, 'food_key', i.food_key, 'label', i.label, 'grams', i.grams, 'kcal', i.kcal,
        'protein_g', i.protein_g, 'carbs_g', i.carbs_g, 'fat_g', i.fat_g, 'fiber_g', i.fiber_g,
        'sort_order', i.sort_order
      ) order by i.sort_order, i.id), '[]'::jsonb)
    ) as snapshot
    from public.nutrition_meal_items i
    where i.meal_id = m.id and i.user_id = m.user_id
  ) view
  where m.id = p_meal_id and m.sync_id = p_sync_id and m.user_id = auth.uid();
$$;

revoke all on function public.audit_nutrition_read_meal_v1(uuid, text) from public, anon, authenticated;
grant execute on function public.audit_nutrition_read_meal_v1(uuid, text) to authenticated;
