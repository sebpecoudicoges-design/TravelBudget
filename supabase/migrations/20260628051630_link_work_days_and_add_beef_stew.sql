insert into public.nutrition_foods
  (key, user_id, name, serving_grams, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g, water_ml_per_100g, tags)
values
  (
    'beef_stew_carrot_leek_tomato_onion_rice',
    null,
    'Boeuf mijote carotte poireau tomate oignon riz',
    450,
    137,
    8.1,
    12.8,
    5.6,
    1.8,
    70,
    array['plat','boeuf','mijote','riz','carotte','poireau','tomate','oignon','portion_realiste','recette_estimee','source_ciqual_2025','source_usda_fdc']
  )
on conflict (key) do update set
  name = excluded.name,
  serving_grams = excluded.serving_grams,
  kcal_per_100g = excluded.kcal_per_100g,
  protein_per_100g = excluded.protein_per_100g,
  carbs_per_100g = excluded.carbs_per_100g,
  fat_per_100g = excluded.fat_per_100g,
  fiber_per_100g = excluded.fiber_per_100g,
  water_ml_per_100g = excluded.water_ml_per_100g,
  tags = excluded.tags,
  is_active = true,
  updated_at = now();

-- Existing work days predate the career module. Link an unassigned day only
-- when exactly one engagement contains its date, so overlaps stay explicit.
with unique_matches as (
  select
    wd.id as work_day_id,
    (array_agg(e.id order by e.start_date desc))[1] as engagement_id
  from public.work_days wd
  join public.work_engagements e
    on e.user_id = wd.user_id
   and wd.work_date >= e.start_date
   and (e.end_date is null or wd.work_date <= e.end_date)
  where wd.engagement_id is null
  group by wd.id
  having count(*) = 1
)
update public.work_days wd
set engagement_id = matched.engagement_id,
    updated_at = now()
from unique_matches matched
where wd.id = matched.work_day_id;
