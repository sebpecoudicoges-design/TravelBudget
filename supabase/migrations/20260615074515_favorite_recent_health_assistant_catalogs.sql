-- Nutrition source baseline: USDA FoodData Central / common label averages; portions are app estimates for practical logging.
-- Sport MET baseline: 2024 Compendium of Physical Activities; exercise defaults are practical app presets.

update public.nutrition_foods nf
set
  serving_grams = v.serving_grams,
  tags = array(select distinct unnest(coalesce(nf.tags, '{}') || v.tags)),
  updated_at = now()
from (values
  ('banana', 118::numeric, array['portion_revue','source_usda_fdc']::text[]),
  ('apple', 182::numeric, array['portion_revue','source_usda_fdc']::text[]),
  ('pear', 178::numeric, array['portion_revue','source_usda_fdc']::text[]),
  ('orange', 140::numeric, array['portion_revue','source_usda_fdc']::text[]),
  ('yogurt_natural', 125::numeric, array['portion_revue','pot_125g','source_usda_fdc']::text[]),
  ('skyr', 140::numeric, array['portion_revue','pot_140g','source_usda_fdc']::text[]),
  ('fromage_blanc_0', 100::numeric, array['portion_revue','portion_100g','source_usda_fdc']::text[]),
  ('rice_cake', 8::numeric, array['portion_revue','portion_une_galette','source_usda_fdc']::text[]),
  ('beer_blond_330', 330::numeric, array['portion_revue','canette_33cl','source_usda_fdc']::text[]),
  ('red_wine_150', 150::numeric, array['portion_revue','verre_15cl','source_usda_fdc']::text[])
) as v(key, serving_grams, tags)
where nf.key = v.key
  and nf.user_id is null;

insert into public.nutrition_foods
  (key, user_id, name, serving_grams, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g, water_ml_per_100g, tags)
values
  ('watermelon', null, 'Pasteque', 280, 30, 0.6, 7.6, 0.2, 0.4, 92, array['fruit','source_usda_fdc','portion_realiste']),
  ('pineapple', null, 'Ananas', 165, 50, 0.5, 13.1, 0.1, 1.4, 86, array['fruit','source_usda_fdc','portion_realiste']),
  ('dates_medjool', null, 'Dattes medjool', 48, 277, 1.8, 75.0, 0.2, 6.7, 21, array['fruit','snack','source_usda_fdc','portion_2_pieces']),
  ('cottage_cheese', null, 'Cottage cheese', 125, 98, 11.1, 3.4, 4.3, 0.0, 79, array['laitage','proteines','source_usda_fdc','portion_realiste']),
  ('mozzarella', null, 'Mozzarella', 60, 280, 18.0, 3.1, 22.0, 0.0, 50, array['fromage','laitage','source_usda_fdc','portion_realiste']),
  ('feta', null, 'Feta', 40, 264, 14.2, 4.1, 21.3, 0.0, 56, array['fromage','laitage','source_usda_fdc','portion_realiste']),
  ('cheddar_slice', null, 'Cheddar tranche', 22, 403, 25.0, 1.3, 33.0, 0.0, 37, array['fromage','burger','source_usda_fdc','portion_une_tranche']),
  ('whey_scoop', null, 'Whey dose', 30, 390, 78.0, 8.0, 6.0, 2.0, 4, array['proteines','snack','source_etiquette','portion_realiste']),
  ('bagel_plain', null, 'Bagel nature', 95, 275, 10.0, 53.0, 1.5, 2.3, 32, array['pain','feculent','source_usda_fdc','portion_realiste']),
  ('tortilla_chips', null, 'Chips tortilla', 45, 489, 7.0, 65.0, 23.0, 5.3, 2, array['snack','source_usda_fdc','portion_realiste']),
  ('hummus', null, 'Houmous', 50, 166, 7.9, 14.3, 9.6, 6.0, 65, array['proteines','vegetarien','snack','source_usda_fdc','portion_realiste']),
  ('guacamole', null, 'Guacamole', 50, 150, 2.0, 8.0, 13.0, 5.0, 72, array['snack','avocat','source_usda_fdc','portion_realiste']),
  ('mayonnaise', null, 'Mayonnaise', 15, 680, 1.0, 0.6, 75.0, 0.0, 21, array['sauce','source_usda_fdc','portion_realiste']),
  ('ketchup', null, 'Ketchup', 20, 112, 1.3, 26.0, 0.2, 0.3, 68, array['sauce','source_usda_fdc','portion_realiste']),
  ('soy_sauce', null, 'Sauce soja', 15, 53, 8.1, 4.9, 0.6, 0.8, 71, array['sauce','source_usda_fdc','portion_realiste']),
  ('protein_pancakes', null, 'Pancakes proteines', 220, 190, 13.0, 25.0, 5.5, 3.0, 58, array['plat','petit-dej','proteines','portion_estimee','source_usda_fdc']),
  ('porridge_banana', null, 'Porridge banane', 300, 115, 4.0, 20.0, 2.4, 3.0, 73, array['plat','petit-dej','avoine','portion_estimee','source_usda_fdc']),
  ('eggs_bacon_toast', null, 'Oeufs bacon toast', 260, 235, 14.0, 18.0, 12.5, 1.8, 55, array['plat','petit-dej','oeuf','portion_estimee','source_usda_fdc']),
  ('avocado_toast_egg', null, 'Avocado toast oeuf', 260, 205, 8.5, 20.0, 10.5, 5.0, 62, array['plat','petit-dej','oeuf','portion_estimee','source_usda_fdc']),
  ('ham_cheese_sandwich', null, 'Sandwich jambon fromage', 240, 260, 14.0, 29.0, 10.5, 2.0, 48, array['plat','sandwich','portion_estimee','source_usda_fdc']),
  ('tuna_mayo_sandwich', null, 'Sandwich thon mayo', 250, 245, 14.0, 26.0, 10.0, 2.0, 52, array['plat','sandwich','thon','portion_estimee','source_usda_fdc']),
  ('burrito_beef', null, 'Burrito boeuf', 380, 215, 12.0, 26.0, 7.0, 4.0, 58, array['plat','mexicain','boeuf','portion_estimee','source_usda_fdc']),
  ('chicken_noodle_soup', null, 'Soupe nouilles poulet', 450, 72, 5.0, 9.0, 2.0, 1.0, 86, array['plat','soupe','poulet','portion_estimee','source_usda_fdc']),
  ('moussaka', null, 'Moussaka', 350, 165, 8.0, 10.0, 10.0, 2.8, 68, array['plat','boeuf','portion_estimee','source_usda_fdc']),
  ('blanquette_rice', null, 'Blanquette de veau riz', 420, 160, 10.0, 18.0, 5.5, 1.6, 66, array['plat','riz','veau','portion_estimee','source_usda_fdc']),
  ('raclette_plate', null, 'Assiette raclette', 450, 240, 12.0, 16.0, 14.5, 1.8, 52, array['plat','fromage','portion_estimee','source_usda_fdc']),
  ('gnocchi_tomato_mozzarella', null, 'Gnocchi tomate mozzarella', 350, 180, 7.0, 27.0, 5.5, 2.5, 62, array['plat','feculent','fromage','portion_estimee','source_usda_fdc']),
  ('salad_nicoise', null, 'Salade nicoise', 380, 140, 9.0, 8.0, 8.0, 3.0, 76, array['plat','salade','thon','portion_estimee','source_usda_fdc']),
  ('chicken_satay_rice', null, 'Poulet satay riz', 420, 185, 11.0, 22.0, 6.5, 2.0, 62, array['plat','riz','poulet','portion_estimee','source_usda_fdc']),
  ('beef_ramen', null, 'Ramen boeuf', 520, 105, 6.5, 13.0, 3.0, 1.1, 86, array['plat','soupe','boeuf','portion_estimee','source_usda_fdc']),
  ('falafel_wrap', null, 'Wrap falafel', 320, 230, 8.0, 32.0, 8.0, 5.0, 55, array['plat','wrap','vegetarien','portion_estimee','source_usda_fdc']),
  ('smoothie_banana_yogurt', null, 'Smoothie banane yaourt', 300, 82, 3.4, 14.0, 1.8, 1.4, 82, array['boisson','fruit','laitage','portion_estimee','source_usda_fdc'])
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

insert into public.sport_exercises
  (key, goal, equipment, activity_key, name_fr, name_en, mode, default_reps, default_seconds, default_sets, default_rest_seconds, distance_m, met_value, tags, sort_order)
values
  ('dumbbell_bench_press', 'strength', 'dumbbell', 'strength', 'Developpe couche halteres', 'Dumbbell bench press', 'reps', 10, null, 3, 90, null, 5.8, array['halteres','pectoraux','push','source_compendium_2024'], 469),
  ('dumbbell_chest_supported_row', 'strength', 'dumbbell', 'strength', 'Rowing halteres banc incline', 'Chest-supported dumbbell row', 'reps', 10, null, 3, 75, null, 5.4, array['halteres','dos','pull','source_compendium_2024'], 470),
  ('dumbbell_bulgarian_split_squat', 'strength', 'dumbbell', 'strength', 'Bulgarian split squat halteres', 'Dumbbell Bulgarian split squat', 'reps', 8, null, 3, 90, null, 6.5, array['halteres','jambes','unilateral','source_compendium_2024'], 471),
  ('dumbbell_single_arm_snatch', 'cardio', 'dumbbell', 'hiit', 'Snatch haltere un bras', 'Single-arm dumbbell snatch', 'reps', 8, null, 5, 60, null, 8.5, array['halteres','hiit','puissance','source_compendium_2024'], 472),
  ('barbell_overhead_press', 'strength', 'barbell', 'strength', 'Developpe militaire barre', 'Barbell overhead press', 'reps', 6, null, 4, 120, null, 5.6, array['barre','epaules','push','source_compendium_2024'], 508),
  ('barbell_hip_thrust', 'strength', 'barbell', 'strength', 'Hip thrust barre', 'Barbell hip thrust', 'reps', 10, null, 4, 90, null, 5.6, array['barre','fessiers','source_compendium_2024'], 509),
  ('barbell_power_clean', 'cardio', 'barbell', 'hiit', 'Power clean barre', 'Barbell power clean', 'reps', 5, null, 5, 120, null, 8.0, array['barre','puissance','crossfit','source_compendium_2024'], 510),
  ('kettlebell_turkish_getup', 'strength', 'kettlebell', 'strength', 'Turkish get-up kettlebell', 'Kettlebell Turkish get-up', 'reps', 3, null, 3, 90, null, 5.8, array['kettlebell','core','source_compendium_2024'], 550),
  ('kettlebell_clean', 'strength', 'kettlebell', 'strength', 'Clean kettlebell', 'Kettlebell clean', 'reps', 8, null, 4, 75, null, 6.5, array['kettlebell','puissance','source_compendium_2024'], 551),
  ('machine_chest_press', 'strength', 'machine', 'strength', 'Chest press machine', 'Machine chest press', 'reps', 10, null, 3, 75, null, 5.2, array['machine','pectoraux','source_compendium_2024'], 615),
  ('machine_leg_extension', 'strength', 'machine', 'strength', 'Leg extension', 'Leg extension', 'reps', 12, null, 3, 60, null, 4.4, array['machine','quadriceps','source_compendium_2024'], 616),
  ('machine_calf_raise', 'strength', 'machine', 'strength', 'Mollets machine', 'Machine calf raise', 'reps', 15, null, 3, 45, null, 4.2, array['machine','mollets','source_compendium_2024'], 617),
  ('elliptical_easy', 'cardio', 'machine', 'cycling', 'Elliptique facile', 'Easy elliptical', 'time', null, 1200, 1, 0, null, 5.0, array['machine','cardio','source_compendium_2024'], 649),
  ('elliptical_intervals', 'cardio', 'machine', 'hiit', 'Elliptique intervalles', 'Elliptical intervals', 'time', null, 90, 8, 60, null, 7.5, array['machine','cardio','hiit','source_compendium_2024'], 650),
  ('battle_rope_intervals', 'cardio', 'mixed', 'hiit', 'Battle rope intervalles', 'Battle rope intervals', 'time', null, 30, 10, 30, null, 9.8, array['corde','hiit','source_compendium_2024'], 651),
  ('sled_push', 'cardio', 'mixed', 'hiit', 'Poussee sled', 'Sled push', 'time', null, 30, 8, 60, null, 9.5, array['crossfit','jambes','source_compendium_2024'], 652),
  ('wall_walk', 'strength', 'bodyweight', 'bodyweight_strength', 'Wall walk', 'Wall walk', 'reps', 4, null, 4, 90, null, 6.2, array['poids_du_corps','epaules','crossfit','source_compendium_2024'], 229),
  ('ring_row', 'strength', 'bodyweight', 'bodyweight_strength', 'Rowing anneaux', 'Ring row', 'reps', 10, null, 3, 75, null, 5.4, array['poids_du_corps','dos','pull','source_compendium_2024'], 230),
  ('dips_parallel_bars', 'strength', 'bodyweight', 'bodyweight_strength', 'Dips barres paralleles', 'Parallel bar dips', 'reps', 8, null, 4, 90, null, 6.0, array['poids_du_corps','triceps','push','source_compendium_2024'], 231),
  ('boxing_sparring_moderate', 'boxing', 'boxing', 'boxing', 'Sparring modere', 'Moderate sparring', 'time', null, 180, 5, 90, null, 10.0, array['boxe','sparring','source_compendium_2024'], 814),
  ('boxing_bag_volume_rounds', 'boxing', 'boxing', 'boxing', 'Rounds volume au sac', 'Heavy bag volume rounds', 'time', null, 180, 10, 60, null, 11.5, array['boxe','sac','volume','source_compendium_2024'], 815)
on conflict (key) do update set
  goal = excluded.goal,
  equipment = excluded.equipment,
  activity_key = excluded.activity_key,
  name_fr = excluded.name_fr,
  name_en = excluded.name_en,
  mode = excluded.mode,
  default_reps = excluded.default_reps,
  default_seconds = excluded.default_seconds,
  default_sets = excluded.default_sets,
  default_rest_seconds = excluded.default_rest_seconds,
  distance_m = excluded.distance_m,
  met_value = excluded.met_value,
  tags = excluded.tags,
  sort_order = excluded.sort_order,
  is_active = true,
  updated_at = now();
