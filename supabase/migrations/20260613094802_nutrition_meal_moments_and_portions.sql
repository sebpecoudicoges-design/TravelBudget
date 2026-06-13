alter table public.nutrition_meals
  drop constraint if exists nutrition_meals_meal_type_chk;

alter table public.nutrition_meals
  add constraint nutrition_meals_meal_type_chk
  check (meal_type in ('breakfast','morning_snack','lunch','afternoon_snack','dinner','snack','meal'));

-- Portion defaults are practical household portions, not medical advice.
-- Nutrition values remain per 100g/100ml so users can still switch to grams.
insert into public.nutrition_foods
  (key, user_id, name, serving_grams, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g, water_ml_per_100g, tags)
values
  ('espresso', null, 'Espresso', 40, 2, 0.1, 0.0, 0.0, 0.0, 98, array['boisson','cafe']),
  ('cappuccino', null, 'Cappuccino', 180, 45, 2.5, 4.8, 1.8, 0.0, 88, array['boisson','cafe','laitage']),
  ('latte', null, 'Cafe latte', 250, 55, 3.0, 5.5, 2.2, 0.0, 87, array['boisson','cafe','laitage']),
  ('smoothie_fruit', null, 'Smoothie fruits', 250, 62, 1.0, 14.0, 0.3, 1.7, 84, array['boisson','fruit']),
  ('protein_shake_milk', null, 'Shake whey lait', 330, 95, 12.0, 6.0, 2.2, 0.0, 78, array['boisson','proteines','sport']),
  ('bagel_plain', null, 'Bagel nature', 90, 270, 10.0, 53.0, 1.7, 2.0, 0, array['pain','petit-dej']),
  ('english_muffin', null, 'Muffin anglais', 65, 227, 8.0, 44.0, 2.0, 2.0, 0, array['pain','petit-dej']),
  ('toast_avocado_egg', null, 'Toast avocat oeuf', 180, 205, 8.0, 18.0, 11.0, 4.5, 0, array['plat','petit-dej']),
  ('porridge_milk', null, 'Porridge lait', 250, 95, 4.0, 15.0, 2.5, 2.0, 70, array['petit-dej','cereales']),
  ('overnight_oats', null, 'Overnight oats', 220, 150, 6.0, 24.0, 4.0, 4.0, 55, array['petit-dej','cereales']),
  ('omelette_cheese', null, 'Omelette fromage', 180, 190, 13.0, 1.5, 14.5, 0.0, 0, array['plat','oeuf','fromage']),
  ('scrambled_eggs', null, 'Oeufs brouilles', 150, 166, 11.0, 1.6, 12.5, 0.0, 0, array['plat','oeuf']),
  ('fruit_salad', null, 'Salade de fruits', 180, 55, 0.7, 13.0, 0.2, 2.0, 82, array['fruit','dessert']),
  ('apple_sauce_no_sugar', null, 'Compote sans sucres ajoutes', 100, 52, 0.2, 12.0, 0.1, 1.8, 0, array['fruit','dessert']),
  ('trail_mix', null, 'Melange fruits secs noix', 35, 480, 12.0, 38.0, 30.0, 7.0, 0, array['snack','oleagineux']),
  ('dates', null, 'Dattes', 30, 282, 2.5, 75.0, 0.4, 8.0, 0, array['fruit','snack']),
  ('babybel', null, 'Mini fromage type Babybel', 22, 318, 22.0, 0.0, 25.0, 0.0, 0, array['laitage','fromage','snack']),
  ('emmental_slice', null, 'Tranche emmental', 25, 380, 28.0, 0.5, 30.0, 0.0, 0, array['laitage','fromage']),
  ('ham_slice', null, 'Tranche jambon', 40, 115, 20.0, 1.0, 3.5, 0.0, 0, array['proteines','charcuterie']),
  ('chicken_slice', null, 'Tranche blanc de poulet', 40, 105, 22.0, 1.0, 1.5, 0.0, 0, array['proteines','volaille']),
  ('hard_boiled_egg', null, 'Oeuf dur', 50, 143, 12.6, 0.7, 9.5, 0.0, 0, array['proteines','oeuf']),
  ('wrap_tuna', null, 'Wrap thon crudites', 230, 175, 12.0, 22.0, 5.0, 2.0, 0, array['plat','wrap','poisson']),
  ('sandwich_tuna', null, 'Sandwich thon crudites', 180, 210, 13.0, 27.0, 6.0, 2.2, 0, array['plat','sandwich','poisson']),
  ('sandwich_chicken', null, 'Sandwich poulet crudites', 190, 215, 14.0, 28.0, 6.0, 2.4, 0, array['plat','sandwich','poulet']),
  ('burrito_beef', null, 'Burrito boeuf', 300, 205, 11.0, 25.0, 7.0, 4.0, 0, array['plat','mexicain','boeuf']),
  ('tacos_chicken', null, 'Tacos poulet', 250, 230, 12.0, 22.0, 11.0, 2.0, 0, array['plat','fast-food','poulet']),
  ('kebab_sandwich', null, 'Kebab sandwich', 350, 240, 13.0, 25.0, 10.0, 2.0, 0, array['plat','fast-food']),
  ('nuggets_chicken', null, 'Nuggets poulet', 100, 295, 15.0, 18.0, 18.0, 1.0, 0, array['plat','fast-food','poulet']),
  ('rice_bowl_chicken_veg', null, 'Bowl riz poulet legumes', 400, 145, 10.0, 20.0, 3.5, 2.0, 0, array['plat','riz','poulet']),
  ('pasta_pesto', null, 'Pates pesto', 300, 220, 7.0, 27.0, 9.0, 2.0, 0, array['plat','pates']),
  ('pasta_tuna_tomato', null, 'Pates thon tomate', 320, 155, 10.0, 22.0, 3.0, 2.0, 0, array['plat','pates','poisson']),
  ('rice_salmon_avocado', null, 'Riz saumon avocat', 350, 180, 9.0, 20.0, 7.0, 2.5, 0, array['plat','riz','poisson']),
  ('couscous_chicken', null, 'Couscous poulet legumes', 400, 135, 9.0, 18.0, 3.5, 3.0, 0, array['plat','semoule','poulet']),
  ('stir_fry_noodles_chicken', null, 'Nouilles sautees poulet', 350, 165, 10.0, 22.0, 5.0, 2.0, 0, array['plat','pates','poulet']),
  ('fried_rice_egg', null, 'Riz saute oeuf', 300, 170, 6.0, 25.0, 5.0, 1.5, 0, array['plat','riz','oeuf']),
  ('soup_miso', null, 'Soupe miso', 250, 35, 2.5, 4.0, 1.2, 0.8, 92, array['soupe','asiatique']),
  ('gazpacho', null, 'Gaspacho', 250, 35, 1.0, 5.0, 1.2, 1.5, 90, array['soupe','legumes']),
  ('salad_goat_cheese', null, 'Salade chevre', 300, 160, 7.0, 10.0, 10.0, 3.0, 0, array['plat','salade','fromage']),
  ('salad_caesar_chicken', null, 'Salade cesar poulet', 350, 180, 12.0, 8.0, 11.0, 2.0, 0, array['plat','salade','poulet']),
  ('chocolate_bar', null, 'Barre chocolat', 45, 535, 7.0, 58.0, 30.0, 3.0, 0, array['snack','chocolat']),
  ('muffin_chocolate', null, 'Muffin chocolat', 90, 420, 6.0, 55.0, 19.0, 2.0, 0, array['snack','gateau']),
  ('donut', null, 'Donut', 60, 430, 5.0, 51.0, 23.0, 1.5, 0, array['snack','gateau']),
  ('waffle', null, 'Gaufre', 70, 330, 7.0, 38.0, 16.0, 1.5, 0, array['dessert','petit-dej']),
  ('crepe_nutella', null, 'Crepe chocolat noisette', 110, 330, 6.0, 43.0, 15.0, 2.0, 0, array['dessert','snack']),
  ('popcorn_plain', null, 'Popcorn nature', 30, 387, 12.0, 78.0, 4.0, 14.0, 0, array['snack']),
  ('popcorn_sweet', null, 'Popcorn sucre', 50, 420, 6.0, 75.0, 10.0, 8.0, 0, array['snack']),
  ('beer_pint', null, 'Pinte biere blonde', 500, 43, 0.5, 3.6, 0.0, 0.0, 90, array['boisson','alcool','biere']),
  ('cider', null, 'Cidre', 250, 47, 0.1, 5.5, 0.0, 0.0, 89, array['boisson','alcool']),
  ('energy_drink', null, 'Boisson energisante', 250, 45, 0.0, 11.0, 0.0, 0.0, 88, array['boisson','sucre']),
  ('isotonic_drink', null, 'Boisson sport isotonique', 500, 26, 0.0, 6.4, 0.0, 0.0, 93, array['boisson','sport'])
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

update public.nutrition_foods
set serving_grams = v.serving_grams,
    updated_at = now()
from (values
  ('rice_cooked', 150), ('basmati_rice_cooked', 150), ('brown_rice_cooked', 150),
  ('pasta_cooked', 150), ('pasta_wholewheat_cooked', 150), ('quinoa_cooked', 150),
  ('chicken_breast', 120), ('turkey_breast', 120), ('beef_steak', 120),
  ('tofu_firm', 120), ('salmon', 120), ('cod', 120), ('shrimp', 100),
  ('fromage_blanc_0', 125), ('fromage_blanc_3', 125), ('skyr', 140),
  ('yogurt_natural', 125), ('yogurt_greek', 125), ('yogurt_fruit', 125),
  ('banana', 120), ('apple', 150), ('pear', 160), ('orange', 130),
  ('zucchini', 150), ('broccoli', 150), ('green_beans', 150), ('carrot', 100),
  ('bread', 50), ('baguette', 60), ('wholemeal_bread', 50),
  ('burger_simple', 220), ('burger_maison', 280), ('cheeseburger', 250),
  ('beer_blond', 250), ('beer_blond_330', 330), ('beer_blond_500', 500)
) as v(key, serving_grams)
where public.nutrition_foods.key = v.key
  and public.nutrition_foods.user_id is null;
