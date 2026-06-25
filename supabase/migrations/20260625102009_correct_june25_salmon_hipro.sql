insert into public.nutrition_foods
  (key, user_id, name, serving_grams, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g, water_ml_per_100g, tags)
values
  ('rice_zucchini_onion_cream_salmon', null, 'Riz courgette oignon creme fraiche saumon', 400, 183, 8.2, 12.5, 9.2, 1.2, 63, array['plat','riz','saumon','creme','legumes','portion_estimee','source_usda_fdc'])
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

with target_user as (
  select id as user_id
  from auth.users
  where email = 'seb.pecoud.icoges@gmail.com'
),
target_meal as (
  update public.nutrition_meals m
  set
    label = 'Riz courgette oignon creme fraiche saumon',
    water_ml = 252,
    updated_at = now()
  from target_user u
  where m.user_id = u.user_id
    and m.meal_date = date '2026-06-25'
    and m.meal_type = 'dinner'
    and (
      m.sync_id = 'nutrition_1782379792189_381debf5da5108'
      or m.label = 'Riz carotte brocoli oignon agneau'
    )
  returning m.id, m.user_id
)
update public.nutrition_meal_items i
set
  food_key = 'rice_zucchini_onion_cream_salmon',
  label = 'Riz courgette oignon creme fraiche saumon',
  grams = 400,
  kcal = 732,
  protein_g = 32.8,
  carbs_g = 50,
  fat_g = 36.8,
  fiber_g = 4.8
from target_meal tm
where i.meal_id = tm.id
  and i.user_id = tm.user_id;

with target_user as (
  select id as user_id
  from auth.users
  where email = 'seb.pecoud.icoges@gmail.com'
),
hipro_meal as (
  insert into public.nutrition_meals
    (user_id, travel_id, meal_date, meal_type, label, water_ml, sync_id, notes)
  select
    u.user_id,
    null,
    date '2026-06-25',
    'afternoon_snack',
    'Yaourt HiPRO vanille',
    0,
    'codex_20260625_afternoon_hipro',
    'Ajout Codex: yaourt proteine au gouter du 25/06.'
  from target_user u
  on conflict (user_id, sync_id) do update set
    meal_date = excluded.meal_date,
    meal_type = excluded.meal_type,
    label = excluded.label,
    water_ml = excluded.water_ml,
    notes = excluded.notes,
    updated_at = now()
  returning id, user_id
)
insert into public.nutrition_meal_items
  (user_id, meal_id, food_key, label, grams, kcal, protein_g, carbs_g, fat_g, fiber_g)
select
  hm.user_id,
  hm.id,
  'yogurt_hipro_vanilla',
  'Yaourt HiPRO vanille',
  160,
  94.4,
  16,
  6.72,
  0.32,
  0
from hipro_meal hm
where not exists (
  select 1
  from public.nutrition_meal_items i
  where i.meal_id = hm.id
    and i.food_key = 'yogurt_hipro_vanilla'
    and i.grams = 160
);
