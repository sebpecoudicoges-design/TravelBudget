-- Programme prise de masse A/B : Poussee / Chaine posterieure / Variantes.
-- A = Volume, B = Intensite. Planning conserve : lundi, mercredi, vendredi.

with target_user as (
  select id as user_id
  from auth.users
  where lower(email) = lower('seb.pecoud.icoges@gmail.com')
  limit 1
), program_row as (
  update public.sport_programs p
  set
    name = 'Prise de masse A/B - Poussee, chaine posterieure, variantes',
    goal = 'lean_bulk',
    cycle = 'A/B',
    notes = 'Semaine A = volume 6-10 sur polyarticulaires. Semaine B = intensite 4-6. A1/B1 poussee, A2/B2 chaine posterieure, A3/B3 variantes. Isolation 10-15, gainage/abdos au format specifique.',
    updated_at = now()
  from target_user u
  where p.user_id = u.user_id
    and p.key = 'lean_bulk_ab'
  returning p.id
), session_seed(session_key, name, week_label, day_of_week, sort_order) as (
  values
    ('A1', 'Semaine A - A1 Poussee Volume', 'A', 1, 1),
    ('A2', 'Semaine A - A2 Chaine posterieure Volume', 'A', 3, 2),
    ('A3', 'Semaine A - A3 Variantes Volume', 'A', 5, 3),
    ('B1', 'Semaine B - B1 Poussee Intensite', 'B', 1, 4),
    ('B2', 'Semaine B - B2 Chaine posterieure Intensite', 'B', 3, 5),
    ('B3', 'Semaine B - B3 Variantes Intensite', 'B', 5, 6)
)
update public.sport_program_sessions ps
set
  name = s.name,
  week_label = s.week_label,
  day_of_week = s.day_of_week,
  sort_order = s.sort_order,
  updated_at = now()
from program_row p
join session_seed s on true
where ps.program_id = p.id
  and ps.session_key = s.session_key;

with target_user as (
  select id as user_id from auth.users where lower(email) = lower('seb.pecoud.icoges@gmail.com') limit 1
), program_row as (
  select p.id
  from public.sport_programs p
  join target_user u on u.user_id = p.user_id
  where p.key = 'lean_bulk_ab'
  limit 1
), exercise_seed(session_key, sort_order, exercise_key, exercise_name, activity_key, equipment, mode, rep_min, rep_max, target_seconds, time_min_seconds, time_max_seconds, planned_sets, rest_seconds, default_weight_kg, load_label, notes) as (
  values
    ('A1', 1, 'barbell_back_squat', 'Squat arriere', 'strength', 'barbell', 'reps', 6, 10, null::integer, null::integer, null::integer, 3, 180, 75::numeric, null::text, 'A1 poussee volume : 3x6-10.'),
    ('A1', 2, 'barbell_bench_press', 'Developpe couche', 'strength', 'barbell', 'reps', 6, 10, null, null, null, 3, 180, 60, null, 'A1 poussee volume : 3x6-10.'),
    ('A1', 3, 'pullup_pronation', 'Tractions pronation', 'bodyweight_strength', 'bodyweight', 'reps', 6, 10, null, null, null, 3, 150, 0, 'Poids du corps', 'A1 poussee volume : PDC jusqu a validation.'),
    ('A1', 4, 'barbell_overhead_press', 'Developpe militaire', 'strength', 'barbell', 'reps', 6, 10, null, null, null, 3, 180, 35, null, 'A1 poussee volume : 3x6-10.'),
    ('A1', 5, 'dumbbell_hammer_curl', 'Curl marteau', 'strength', 'dumbbell', 'reps', 10, 15, null, null, null, 3, 60, 17.5, null, 'Isolation : 3x10-15.'),
    ('A1', 6, 'plank_program', 'Gainage', 'plank_core', 'bodyweight', 'time', null, null, 60, 30, 90, 3, 60, 0, null, 'Format specifique conserve.'),

    ('A2', 1, 'barbell_deadlift', 'Souleve de terre', 'strength', 'barbell', 'reps', 6, 10, null, null, null, 3, 180, 115, null, 'A2 chaine posterieure volume : 3x6-10.'),
    ('A2', 2, 'dumbbell_incline_press', 'Developpe incline halteres', 'strength', 'dumbbell', 'reps', 6, 10, null, null, null, 3, 150, 40, '2 x 20 kg', 'A2 volume : 3x6-10.'),
    ('A2', 3, 'barbell_row', 'Rowing barre', 'strength', 'barbell', 'reps', 6, 10, null, null, null, 3, 150, 60, null, 'A2 volume : 3x6-10.'),
    ('A2', 4, 'dumbbell_lateral_raise', 'Elevations laterales', 'strength', 'dumbbell', 'reps', 10, 15, null, null, null, 3, 60, 7, null, 'Isolation : 3x10-15.'),
    ('A2', 5, 'triceps_extension', 'Extension triceps', 'strength', 'dumbbell', 'reps', 10, 15, null, null, null, 3, 60, 20, null, 'Isolation : 3x10-15.'),
    ('A2', 6, 'lying_leg_raise_ab', 'Releves de jambes', 'core_abs', 'bodyweight', 'reps', 10, 20, null, null, null, 3, 60, 0, null, 'Format abdos specifique conserve.'),

    ('A3', 1, 'barbell_front_squat', 'Front squat', 'strength', 'barbell', 'reps', 6, 10, null, null, null, 3, 180, 45, null, 'A3 variantes volume : 3x6-10.'),
    ('A3', 2, 'barbell_close_grip_bench_press', 'Developpe couche prise serree', 'strength', 'barbell', 'reps', 6, 10, null, null, null, 3, 180, 50, null, 'A3 variantes volume : 3x6-10.'),
    ('A3', 3, 'pullup_supination', 'Tractions supination', 'bodyweight_strength', 'bodyweight', 'reps', 6, 10, null, null, null, 3, 150, 0, 'Poids du corps', 'A3 variantes volume : PDC jusqu a validation.'),
    ('A3', 4, 'dumbbell_reverse_fly', 'Oiseau halteres', 'strength', 'dumbbell', 'reps', 10, 15, null, null, null, 3, 60, 6, null, 'Isolation : 2-3x10-15.'),
    ('A3', 5, 'dumbbell_hammer_curl', 'Curl marteau', 'strength', 'dumbbell', 'reps', 10, 15, null, null, null, 3, 60, 17.5, null, 'Isolation : 2-3x10-15.'),
    ('A3', 6, 'side_plank_program', 'Gainage lateral', 'plank_core', 'bodyweight', 'time', null, null, 30, 30, 60, 2, 60, 0, null, 'Format specifique conserve.'),

    ('B1', 1, 'barbell_back_squat', 'Squat arriere', 'strength', 'barbell', 'reps', 4, 6, null, null, null, 3, 240, 82.5, null, 'B1 poussee intensite : 3x4-6.'),
    ('B1', 2, 'barbell_bench_press', 'Developpe couche', 'strength', 'barbell', 'reps', 4, 6, null, null, null, 3, 240, 65, null, 'B1 poussee intensite : 3x4-6.'),
    ('B1', 3, 'pullup_weighted_or_bodyweight', 'Tractions pronation lestees', 'bodyweight_strength', 'bodyweight', 'reps', 4, 6, null, null, null, 3, 180, 5, '+5 kg ou PDC', 'B1 intensite : lest quand pertinent.'),
    ('B1', 4, 'barbell_overhead_press', 'Developpe militaire', 'strength', 'barbell', 'reps', 4, 6, null, null, null, 3, 210, 37.5, null, 'B1 poussee intensite : 3x4-6.'),
    ('B1', 5, 'dumbbell_hammer_curl', 'Curl marteau', 'strength', 'dumbbell', 'reps', 10, 15, null, null, null, 3, 60, 17.5, null, 'Isolation : 3x10-15.'),
    ('B1', 6, 'plank_program', 'Gainage', 'plank_core', 'bodyweight', 'time', null, null, 60, 30, 90, 3, 60, 0, null, 'Format specifique conserve.'),

    ('B2', 1, 'barbell_deadlift', 'Souleve de terre', 'strength', 'barbell', 'reps', 4, 6, null, null, null, 3, 240, 125, null, 'B2 chaine posterieure intensite : 3x4-6.'),
    ('B2', 2, 'dumbbell_incline_press', 'Developpe incline halteres', 'strength', 'dumbbell', 'reps', 4, 6, null, null, null, 3, 180, 45, '2 x 22.5 kg', 'B2 intensite : 3x4-6.'),
    ('B2', 3, 'barbell_row', 'Rowing barre', 'strength', 'barbell', 'reps', 4, 6, null, null, null, 3, 180, 67.5, null, 'B2 intensite : 3x4-6.'),
    ('B2', 4, 'dumbbell_lateral_raise', 'Elevations laterales', 'strength', 'dumbbell', 'reps', 10, 15, null, null, null, 3, 60, 7, null, 'Isolation : 3x10-15.'),
    ('B2', 5, 'triceps_extension', 'Extension triceps', 'strength', 'dumbbell', 'reps', 10, 15, null, null, null, 3, 60, 20, null, 'Isolation : 3x10-15.'),
    ('B2', 6, 'lying_leg_raise_ab', 'Releves de jambes', 'core_abs', 'bodyweight', 'reps', 10, 20, null, null, null, 3, 60, 0, null, 'Format abdos specifique conserve.'),

    ('B3', 1, 'barbell_front_squat', 'Front squat', 'strength', 'barbell', 'reps', 4, 6, null, null, null, 3, 240, 50, null, 'B3 variantes intensite : 3x4-6.'),
    ('B3', 2, 'barbell_close_grip_bench_press', 'Developpe couche prise serree', 'strength', 'barbell', 'reps', 4, 6, null, null, null, 3, 180, 55, null, 'B3 variantes intensite : 3x4-6.'),
    ('B3', 3, 'pullup_weighted_or_bodyweight', 'Tractions supination lestees', 'bodyweight_strength', 'bodyweight', 'reps', 4, 6, null, null, null, 3, 180, 5, '+5 kg ou PDC', 'B3 intensite : lest quand pertinent.'),
    ('B3', 4, 'dumbbell_reverse_fly', 'Oiseau halteres', 'strength', 'dumbbell', 'reps', 10, 15, null, null, null, 3, 60, 6, null, 'Isolation : 2-3x10-15.'),
    ('B3', 5, 'dumbbell_hammer_curl', 'Curl marteau', 'strength', 'dumbbell', 'reps', 10, 15, null, null, null, 3, 60, 17.5, null, 'Isolation : 2-3x10-15.'),
    ('B3', 6, 'side_plank_program', 'Gainage lateral', 'plank_core', 'bodyweight', 'time', null, null, 30, 30, 60, 2, 60, 0, null, 'Format specifique conserve.')
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
    when 'barbell_back_squat' then 75
    when 'barbell_bench_press' then 60
    when 'barbell_overhead_press' then 35
    when 'barbell_deadlift' then 115
    when 'dumbbell_incline_press' then 40
    when 'barbell_row' then 60
    when 'dumbbell_lateral_raise' then 7
    when 'triceps_extension' then 20
    when 'barbell_front_squat' then 45
    when 'barbell_close_grip_bench_press' then 50
    when 'dumbbell_reverse_fly' then 6
    when 'dumbbell_hammer_curl' then 17.5
    else default_weight_kg
  end,
  load_label = case key
    when 'pullup_pronation' then 'Poids du corps'
    when 'pullup_supination' then 'Poids du corps'
    when 'pullup_weighted_or_bodyweight' then '+5 kg ou PDC'
    else load_label
  end,
  updated_at = now()
where key in (
  'barbell_back_squat',
  'barbell_bench_press',
  'barbell_overhead_press',
  'barbell_deadlift',
  'dumbbell_incline_press',
  'barbell_row',
  'dumbbell_lateral_raise',
  'triceps_extension',
  'barbell_front_squat',
  'barbell_close_grip_bench_press',
  'dumbbell_reverse_fly',
  'dumbbell_hammer_curl',
  'pullup_pronation',
  'pullup_supination',
  'pullup_weighted_or_bodyweight',
  'lying_leg_raise_ab'
);
