insert into public.nutrition_foods
  (key, user_id, name, serving_grams, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g, water_ml_per_100g, tags)
values
  ('rice_carrot_broccoli_onion_lamb', null, 'Riz carotte brocoli oignon agneau', 430, 158, 9.5, 18.5, 5.2, 2.6, 64, array['plat','riz','agneau','legumes','carotte','brocoli','oignon','portion_estimee','source_usda_fdc'])
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
  (key, goal, equipment, activity_key, name_fr, name_en, mode, default_reps, default_seconds, default_sets, default_rest_seconds, distance_m, met_value, tags, sort_order, default_weight_kg, load_label, rep_min, rep_max)
values
  ('barbell_deadlift', 'strength', 'barbell', 'strength', 'Souleve de terre', 'Deadlift', 'reps', 6, null, 3, 180, null, 6.8, array['barre','jambes','chaine_posterieure','programme_ab','source_compendium_2024'], 102, 100, null, 6, 10)
on conflict (key) do update set
  name_fr = excluded.name_fr,
  name_en = excluded.name_en,
  default_reps = excluded.default_reps,
  default_sets = excluded.default_sets,
  default_rest_seconds = excluded.default_rest_seconds,
  met_value = excluded.met_value,
  tags = excluded.tags,
  sort_order = excluded.sort_order,
  default_weight_kg = excluded.default_weight_kg,
  load_label = excluded.load_label,
  rep_min = excluded.rep_min,
  rep_max = excluded.rep_max;

update public.sport_program_exercises e
set
  exercise_key = 'barbell_deadlift',
  exercise_name = 'Souleve de terre',
  activity_key = 'strength',
  equipment = 'barbell',
  mode = 'reps',
  target_reps = 6,
  rep_min = 6,
  rep_max = 10,
  planned_sets = 3,
  rest_seconds = 180,
  default_weight_kg = 100,
  load_label = null,
  met_value = 6.8,
  notes = coalesce(nullif(e.notes, ''), 'A2 remplace le souleve de terre roumain par le souleve de terre.')
from public.sport_program_sessions s
join public.sport_programs p on p.id = s.program_id
where e.session_id = s.id
  and p.key = 'lean_bulk_ab'
  and s.session_key = 'A2'
  and e.sort_order = 1;

update public.sport_session_items i
set
  exercise_name = 'Souleve de terre',
  activity_key = 'strength',
  equipment = 'barbell',
  mode = 'reps',
  target_reps = 6,
  planned_sets = 3,
  rest_seconds = 180,
  met_value = 6.8,
  notes = coalesce(nullif(i.notes, ''), 'Corrige le mouvement : souleve de terre, series/reps/charges conservees.')
from public.sport_sessions s
where i.session_id = s.id
  and s.user_id = (select id from auth.users where email = 'seb.pecoud.icoges@gmail.com')
  and (s.started_at at time zone 'Australia/Brisbane')::date = date '2026-06-25'
  and i.sort_order = 0
  and lower(i.exercise_name) like '%souleve de terre roumain%';

update public.sport_sessions s
set estimated_kcal = greatest(1, round(coalesce(s.estimated_kcal, 0) + 5))
where s.user_id = (select id from auth.users where email = 'seb.pecoud.icoges@gmail.com')
  and (s.started_at at time zone 'Australia/Brisbane')::date = date '2026-06-25'
  and exists (
    select 1
    from public.sport_session_items i
    where i.session_id = s.id
      and i.sort_order = 0
      and i.exercise_name = 'Souleve de terre'
      and i.met_value = 6.8
  );
