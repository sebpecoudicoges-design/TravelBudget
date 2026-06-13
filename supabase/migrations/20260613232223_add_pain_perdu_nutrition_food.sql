insert into public.nutrition_foods (
  key,
  user_id,
  name,
  serving_grams,
  kcal_per_100g,
  protein_per_100g,
  carbs_per_100g,
  fat_per_100g,
  fiber_per_100g,
  water_ml_per_100g,
  tags,
  is_active
) values (
  'pain_perdu',
  null,
  'Pain perdu',
  160,
  230,
  7.5,
  31,
  8.5,
  1.5,
  0,
  array['petit-dej', 'dessert', 'plat', 'pain'],
  true
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
  is_active = excluded.is_active,
  updated_at = now();
