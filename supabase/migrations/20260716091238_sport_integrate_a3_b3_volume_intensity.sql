-- Correction A3/B3 : integration des seances dediees Volume/Intensite.

with target_user as (
  select id as user_id
  from auth.users
  where lower(email) = lower('seb.pecoud.icoges@gmail.com')
  limit 1
), target_sessions as (
  select ps.id, ps.session_key
  from public.sport_programs p
  join target_user u on u.user_id = p.user_id
  join public.sport_program_sessions ps on ps.program_id = p.id
  where p.key = 'lean_bulk_ab'
    and ps.session_key in ('A3', 'B3')
), exercise_seed(session_key, sort_order, exercise_key, exercise_name, activity_key, equipment, mode, rep_min, rep_max, target_seconds, time_min_seconds, time_max_seconds, planned_sets, rest_seconds, default_weight_kg, load_label, notes) as (
  values
    ('A3', 1, 'barbell_front_squat', 'Front squat ou Goblet squat', 'strength', 'barbell', 'reps', 6, 10, null::integer, null::integer, null::integer, 3, 180, 45::numeric, null::text, 'Volume : polyarticulaire 6-10 reps. +5 kg quand 3x10 est valide.'),
    ('A3', 2, 'barbell_close_grip_bench_press', 'Developpe couche prise serree', 'strength', 'barbell', 'reps', 6, 10, null, null, null, 3, 180, 50, null, 'Volume : polyarticulaire 6-10 reps. +2,5 kg quand 3x10 est valide.'),
    ('A3', 3, 'pullup_supination', 'Tractions supination', 'bodyweight_strength', 'bodyweight', 'reps', 6, 10, null, null, null, 3, 150, 0, 'Poids du corps', 'Progression jusqu a 3x10 avant lest.'),
    ('A3', 4, 'dumbbell_reverse_fly', 'Oiseau halteres', 'strength', 'dumbbell', 'reps', 10, 15, null, null, null, 2, 60, 6, null, 'Isolation : 10-15 reps.'),
    ('A3', 5, 'dumbbell_hammer_curl', 'Curl marteau', 'strength', 'dumbbell', 'reps', 10, 15, null, null, null, 2, 60, 17.5, null, 'Isolation : 10-15 reps.'),
    ('A3', 6, 'side_plank_program', 'Gainage lateral', 'plank_core', 'bodyweight', 'time', null, null, 30, 30, 60, 2, 60, 0, null, 'Format specifique conserve.'),

    ('B3', 1, 'barbell_back_squat', 'Squat arriere', 'strength', 'barbell', 'reps', 4, 6, null, null, null, 3, 240, 82.5, null, 'Intensite : polyarticulaire 4-6 reps. +5 kg quand 3x6 est valide.'),
    ('B3', 2, 'dumbbell_flat_press', 'Developpe halteres ou pompes lestees', 'strength', 'dumbbell', 'reps', 4, 6, null, null, null, 3, 180, 45, '45 kg', 'Intensite : polyarticulaire 4-6 reps.'),
    ('B3', 3, 'barbell_row', 'Rowing barre', 'strength', 'barbell', 'reps', 4, 6, null, null, null, 3, 210, 70, null, 'Intensite : polyarticulaire 4-6 reps. +2,5 kg quand 3x6 est valide.'),
    ('B3', 4, 'dumbbell_reverse_fly', 'Oiseau halteres', 'strength', 'dumbbell', 'reps', 10, 15, null, null, null, 2, 60, 6, null, 'Isolation : 10-15 reps.'),
    ('B3', 5, 'dumbbell_hammer_curl', 'Curl marteau', 'strength', 'dumbbell', 'reps', 10, 15, null, null, null, 2, 60, 17.5, null, 'Isolation : 10-15 reps.'),
    ('B3', 6, 'plank_program', 'Gainage', 'plank_core', 'bodyweight', 'time', null, null, 30, 30, 60, 3, 60, 0, null, 'Format specifique conserve.')
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
