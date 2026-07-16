-- Refonte programme Sport : alternance Volume (A) / Intensite (B), 3 jours par semaine.
-- Le moteur actuel planifie une cle de seance par jour. A3 et B3 sont donc des rappels
-- du haut du corps A1/B1 pour garder lundi, mercredi et vendredi sans changer le schema.

with target_user as (
  select id as user_id
  from auth.users
  where lower(email) = lower('seb.pecoud.icoges@gmail.com')
  limit 1
), upsert_program as (
  insert into public.sport_programs (user_id, key, name, goal, cycle, start_date, is_active, notes)
  select
    user_id,
    'lean_bulk_ab',
    'Prise de masse Volume / Intensite',
    'lean_bulk',
    'A/B',
    date '2026-07-20',
    true,
    'Semaine A = volume 6-10 sur polyarticulaires, RPE 7-8. Semaine B = intensite 4-6, RPE 8-9. Lundi/mercredi/vendredi.'
  from target_user
  on conflict (user_id, key) do update set
    name = excluded.name,
    goal = excluded.goal,
    cycle = excluded.cycle,
    start_date = excluded.start_date,
    is_active = true,
    notes = excluded.notes,
    updated_at = now()
  returning id
), program_row as (
  select id from upsert_program
  union all
  select p.id
  from public.sport_programs p
  join target_user u on u.user_id = p.user_id
  where p.key = 'lean_bulk_ab'
  limit 1
), session_seed(session_key, name, week_label, day_of_week, sort_order) as (
  values
    ('A1', 'Semaine A - A1 Volume haut', 'A', 1, 1),
    ('A2', 'Semaine A - A2 Volume bas', 'A', 3, 2),
    ('A3', 'Semaine A - A3 Volume haut', 'A', 5, 3),
    ('B1', 'Semaine B - B1 Intensite haut', 'B', 1, 4),
    ('B2', 'Semaine B - B2 Intensite bas', 'B', 3, 5),
    ('B3', 'Semaine B - B3 Intensite haut', 'B', 5, 6)
)
insert into public.sport_program_sessions (program_id, session_key, name, week_label, day_of_week, sort_order)
select p.id, s.session_key, s.name, s.week_label, s.day_of_week, s.sort_order
from program_row p
cross join session_seed s
on conflict (program_id, session_key) do update set
  name = excluded.name,
  week_label = excluded.week_label,
  day_of_week = excluded.day_of_week,
  sort_order = excluded.sort_order,
  updated_at = now();

with target_user as (
  select id as user_id from auth.users where lower(email) = lower('seb.pecoud.icoges@gmail.com') limit 1
), program_row as (
  select p.id
  from public.sport_programs p
  join target_user u on u.user_id = p.user_id
  where p.key = 'lean_bulk_ab'
), exercise_seed(session_key, sort_order, exercise_key, exercise_name, activity_key, equipment, mode, rep_min, rep_max, target_seconds, time_min_seconds, time_max_seconds, planned_sets, rest_seconds, default_weight_kg, load_label, notes) as (
  values
    ('A1', 1, 'barbell_bench_press', 'Developpe couche', 'strength', 'barbell', 'reps', 6, 10, null::integer, null::integer, null::integer, 3, 180, 60::numeric, null::text, 'Volume polyarticulaire : monter seulement quand 3x10 est valide a RPE <= 8.'),
    ('A1', 2, 'barbell_row', 'Rowing barre', 'strength', 'barbell', 'reps', 6, 10, null, null, null, 3, 180, 65, null, 'Volume polyarticulaire : +2,5 kg quand 3x10 est valide.'),
    ('A1', 3, 'barbell_overhead_press', 'Developpe militaire', 'strength', 'barbell', 'reps', 6, 10, null, null, null, 3, 180, 35, null, 'Volume polyarticulaire : +2,5 kg quand 3x10 est valide.'),
    ('A1', 4, 'pullup_pronation', 'Tractions', 'bodyweight_strength', 'bodyweight', 'reps', 6, 10, null, null, null, 3, 150, 0, 'Poids du corps', 'Progression jusqu a 3x10 avant lest.'),
    ('A1', 5, 'dumbbell_hammer_curl', 'Curl marteau', 'strength', 'dumbbell', 'reps', 10, 15, null, null, null, 3, 60, 17.5, null, 'Isolation : monter quand 3x15 est valide.'),
    ('A1', 6, 'triceps_extension', 'Extension triceps', 'strength', 'dumbbell', 'reps', 10, 15, null, null, null, 3, 60, 20, null, 'Isolation : monter quand 3x15 est valide.'),
    ('A1', 7, 'dumbbell_lateral_raise', 'Elevations laterales', 'strength', 'dumbbell', 'reps', 10, 15, null, null, null, 3, 60, 8, null, 'Isolation : monter quand 3x15 est valide.'),

    ('A2', 1, 'barbell_back_squat', 'Squat arriere', 'strength', 'barbell', 'reps', 6, 10, null, null, null, 3, 180, 75, null, 'Volume polyarticulaire bas : +5 kg quand 3x10 est valide.'),
    ('A2', 2, 'barbell_deadlift', 'Souleve de terre', 'strength', 'barbell', 'reps', 6, 10, null, null, null, 3, 180, 120, null, 'Volume polyarticulaire bas : +5 kg quand 3x10 est valide.'),
    ('A2', 3, 'dumbbell_bulgarian_split_squat', 'Fentes bulgares', 'strength', 'dumbbell', 'reps', 8, 12, null, null, null, 3, 120, 32, '2 x 16 kg', 'Assistance jambes : rester propre, sans echec.'),
    ('A2', 4, 'machine_calf_raise', 'Mollets', 'strength', 'machine', 'reps', 10, 15, null, null, null, 3, 60, 0, 'Charge actuelle', 'Isolation : monter quand 3x15 est valide.'),
    ('A2', 5, 'plank_program', 'Gainage', 'plank_core', 'bodyweight', 'time', null, null, 60, 30, 90, 3, 60, 0, null, 'Core : progresser au temps avant de charger.'),

    ('A3', 1, 'barbell_bench_press', 'Developpe couche', 'strength', 'barbell', 'reps', 6, 10, null, null, null, 3, 180, 60, null, 'Rappel A1 Volume.'),
    ('A3', 2, 'barbell_row', 'Rowing barre', 'strength', 'barbell', 'reps', 6, 10, null, null, null, 3, 180, 65, null, 'Rappel A1 Volume.'),
    ('A3', 3, 'barbell_overhead_press', 'Developpe militaire', 'strength', 'barbell', 'reps', 6, 10, null, null, null, 3, 180, 35, null, 'Rappel A1 Volume.'),
    ('A3', 4, 'pullup_pronation', 'Tractions', 'bodyweight_strength', 'bodyweight', 'reps', 6, 10, null, null, null, 3, 150, 0, 'Poids du corps', 'Rappel A1 Volume.'),
    ('A3', 5, 'dumbbell_hammer_curl', 'Curl marteau', 'strength', 'dumbbell', 'reps', 10, 15, null, null, null, 3, 60, 17.5, null, 'Rappel A1 Volume.'),
    ('A3', 6, 'triceps_extension', 'Extension triceps', 'strength', 'dumbbell', 'reps', 10, 15, null, null, null, 3, 60, 20, null, 'Rappel A1 Volume.'),
    ('A3', 7, 'dumbbell_lateral_raise', 'Elevations laterales', 'strength', 'dumbbell', 'reps', 10, 15, null, null, null, 3, 60, 8, null, 'Rappel A1 Volume.'),

    ('B1', 1, 'barbell_bench_press', 'Developpe couche', 'strength', 'barbell', 'reps', 4, 6, null, null, null, 3, 240, 65, null, 'Intensite : monter seulement quand 3x6 est valide, RPE <= 8-9.'),
    ('B1', 2, 'barbell_row', 'Rowing barre', 'strength', 'barbell', 'reps', 4, 6, null, null, null, 3, 210, 70, null, 'Intensite : +2,5 kg quand 3x6 est valide.'),
    ('B1', 3, 'barbell_overhead_press', 'Developpe militaire', 'strength', 'barbell', 'reps', 4, 6, null, null, null, 3, 210, 37.5, null, 'Intensite : +2,5 kg quand 3x6 est valide.'),
    ('B1', 4, 'pullup_weighted_or_bodyweight', 'Tractions lestees', 'bodyweight_strength', 'bodyweight', 'reps', 4, 6, null, null, null, 3, 180, 5, '+5 kg ou PDC', 'Utiliser PDC tant que le lest n est pas pertinent.'),
    ('B1', 5, 'dumbbell_hammer_curl', 'Curl marteau', 'strength', 'dumbbell', 'reps', 10, 15, null, null, null, 3, 60, 17.5, null, 'Isolation : identique entre A et B.'),
    ('B1', 6, 'triceps_extension', 'Extension triceps', 'strength', 'dumbbell', 'reps', 10, 15, null, null, null, 3, 60, 20, null, 'Isolation : identique entre A et B.'),
    ('B1', 7, 'dumbbell_lateral_raise', 'Elevations laterales', 'strength', 'dumbbell', 'reps', 10, 15, null, null, null, 3, 60, 8, null, 'Isolation : identique entre A et B.'),

    ('B2', 1, 'barbell_back_squat', 'Squat arriere', 'strength', 'barbell', 'reps', 4, 6, null, null, null, 3, 240, 82.5, null, 'Intensite bas : +5 kg quand 3x6 est valide.'),
    ('B2', 2, 'barbell_deadlift', 'Souleve de terre', 'strength', 'barbell', 'reps', 4, 6, null, null, null, 3, 240, 125, null, 'Intensite bas : +5 kg quand 3x6 est valide.'),
    ('B2', 3, 'dumbbell_bulgarian_split_squat', 'Fentes bulgares', 'strength', 'dumbbell', 'reps', 8, 12, null, null, null, 3, 120, 32, '2 x 16 kg', 'Assistance jambes : rester propre, sans echec.'),
    ('B2', 4, 'machine_calf_raise', 'Mollets', 'strength', 'machine', 'reps', 10, 15, null, null, null, 3, 60, 0, 'Charge actuelle', 'Isolation : monter quand 3x15 est valide.'),
    ('B2', 5, 'plank_program', 'Gainage', 'plank_core', 'bodyweight', 'time', null, null, 60, 30, 90, 3, 60, 0, null, 'Core : progresser au temps avant de charger.'),

    ('B3', 1, 'barbell_bench_press', 'Developpe couche', 'strength', 'barbell', 'reps', 4, 6, null, null, null, 3, 240, 65, null, 'Rappel B1 Intensite.'),
    ('B3', 2, 'barbell_row', 'Rowing barre', 'strength', 'barbell', 'reps', 4, 6, null, null, null, 3, 210, 70, null, 'Rappel B1 Intensite.'),
    ('B3', 3, 'barbell_overhead_press', 'Developpe militaire', 'strength', 'barbell', 'reps', 4, 6, null, null, null, 3, 210, 37.5, null, 'Rappel B1 Intensite.'),
    ('B3', 4, 'pullup_weighted_or_bodyweight', 'Tractions lestees', 'bodyweight_strength', 'bodyweight', 'reps', 4, 6, null, null, null, 3, 180, 5, '+5 kg ou PDC', 'Rappel B1 Intensite.'),
    ('B3', 5, 'dumbbell_hammer_curl', 'Curl marteau', 'strength', 'dumbbell', 'reps', 10, 15, null, null, null, 3, 60, 17.5, null, 'Rappel B1 Intensite.'),
    ('B3', 6, 'triceps_extension', 'Extension triceps', 'strength', 'dumbbell', 'reps', 10, 15, null, null, null, 3, 60, 20, null, 'Rappel B1 Intensite.'),
    ('B3', 7, 'dumbbell_lateral_raise', 'Elevations laterales', 'strength', 'dumbbell', 'reps', 10, 15, null, null, null, 3, 60, 8, null, 'Rappel B1 Intensite.')
), target_sessions as (
  select ps.id, ps.session_key
  from public.sport_program_sessions ps
  join program_row p on p.id = ps.program_id
  where ps.session_key in ('A1', 'A2', 'A3', 'B1', 'B2', 'B3')
), cleared as (
  delete from public.sport_program_exercises e
  using target_sessions s
  where e.session_id = s.id
  returning e.id
)
insert into public.sport_program_exercises (
  session_id, exercise_key, exercise_name, activity_key, equipment, mode,
  target_reps, rep_min, rep_max, target_seconds, time_min_seconds, time_max_seconds,
  planned_sets, rest_seconds, default_weight_kg, load_label, sort_order, notes
)
select
  s.id,
  e.exercise_key,
  e.exercise_name,
  e.activity_key,
  e.equipment,
  e.mode,
  e.rep_min,
  e.rep_min,
  e.rep_max,
  e.target_seconds,
  e.time_min_seconds,
  e.time_max_seconds,
  e.planned_sets,
  e.rest_seconds,
  e.default_weight_kg,
  e.load_label,
  e.sort_order,
  e.notes
from exercise_seed e
join target_sessions s on s.session_key = e.session_key;

update public.sport_exercises
set
  default_weight_kg = case key
    when 'barbell_bench_press' then 60
    when 'barbell_back_squat' then 75
    when 'barbell_deadlift' then 120
    when 'barbell_row' then 65
    when 'barbell_overhead_press' then 35
    when 'pullup_weighted_or_bodyweight' then 5
    when 'dumbbell_hammer_curl' then 17.5
    when 'dumbbell_lateral_raise' then 8
    when 'triceps_extension' then 20
    else default_weight_kg
  end,
  load_label = case key
    when 'pullup_pronation' then 'Poids du corps'
    when 'pullup_weighted_or_bodyweight' then '+5 kg ou PDC'
    else load_label
  end,
  updated_at = now()
where key in (
  'barbell_bench_press',
  'barbell_back_squat',
  'barbell_deadlift',
  'barbell_row',
  'barbell_overhead_press',
  'pullup_pronation',
  'pullup_weighted_or_bodyweight',
  'dumbbell_hammer_curl',
  'dumbbell_lateral_raise',
  'triceps_extension'
);
