insert into public.nutrition_foods
  (key, user_id, name, serving_grams, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g, water_ml_per_100g, tags)
values
  (
    'mixed_red_berries',
    null,
    'Melange de fruits rouges',
    150,
    47,
    0.9,
    11.4,
    0.4,
    3.6,
    87,
    array['fruit','fruits_rouges','fraise','framboise','myrtille','portion_realiste','composition_egale','source_usda_fdc']
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
