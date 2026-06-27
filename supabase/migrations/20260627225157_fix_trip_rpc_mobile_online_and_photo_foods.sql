drop function if exists public.apply_transaction_v2(
  uuid, text, text, numeric, text, date, date, text, text, boolean, boolean, boolean, boolean,
  uuid, uuid, numeric, text, timestamptz, text, text, uuid, date, date
);

revoke execute on function public.apply_transaction_v2(
  uuid, text, text, numeric, text, date, date, text, text, boolean, boolean, boolean, boolean,
  uuid, uuid, numeric, text, timestamptz, text, text, uuid, date, date, text
) from public, anon;

grant execute on function public.apply_transaction_v2(
  uuid, text, text, numeric, text, date, date, text, text, boolean, boolean, boolean, boolean,
  uuid, uuid, numeric, text, timestamptz, text, text, uuid, date, date, text
) to authenticated, service_role;

insert into public.nutrition_foods
  (key, user_id, name, serving_grams, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g, water_ml_per_100g, tags)
values
  (
    'tinaberries_macadamia_toasted_muesli', null, 'Tinaberries Macadamias Toasted Muesli',
    30, 461, 9.5, 46.4, 25.4, 0, 0,
    array['petit-dej','cereales','muesli','macadamia','source_etiquette','photo_2026_06_28']
  ),
  (
    'strawberry_soft_serve_large_cone', null, 'Grand cornet glace fraise',
    250, 209, 4.1, 25.2, 10.5, 0.3, 55.8,
    array['dessert','glace','fraise','cornet','portion_estimee_photo','source_afcd_release_3']
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

notify pgrst, 'reload schema';
