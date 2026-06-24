insert into public.nutrition_foods
  (key, user_id, name, serving_grams, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g, water_ml_per_100g, tags)
values
  ('yogurt_hipro_vanilla', null, 'Yaourt HiPRO vanille', 160, 59, 10.0, 4.2, 0.2, 0.0, 0, array['laitage','proteines','yaourt','portion_estimee','source_etiquette']),
  ('yogurt_hipro_plain', null, 'Yaourt HiPRO nature', 160, 57, 10.0, 3.8, 0.2, 0.0, 0, array['laitage','proteines','yaourt','portion_estimee','source_etiquette']),
  ('pasta_curry_chicken', null, 'Pates curry poulet', 380, 178, 12.0, 23.0, 4.5, 2.2, 0, array['plat','pates','poulet','curry','portion_estimee','source_usda_fdc']),
  ('rice_zucchini_onion_salmon', null, 'Riz courgette oignon saumon', 380, 150, 11.0, 18.0, 4.8, 2.2, 0, array['plat','riz','saumon','legumes','portion_estimee','source_usda_fdc'])
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
