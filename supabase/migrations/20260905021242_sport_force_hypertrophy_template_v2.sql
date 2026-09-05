-- Programme musculation V2: template Force / Hypertrophie.
-- Important: the program stores structure only. Loads are deliberately null so
-- progression recommendations derive the next target from real user history.

alter table public.sport_program_exercises
  add column if not exists week_type text,
  add column if not exists progression_type text,
  add column if not exists target_rir_min numeric,
  add column if not exists target_rir_max numeric;

alter table public.sport_program_exercises
  drop constraint if exists sport_program_exercises_week_type_chk,
  add constraint sport_program_exercises_week_type_chk
    check (week_type is null or week_type in ('FORCE','HYPERTROPHY')),
  drop constraint if exists sport_program_exercises_progression_type_chk,
  add constraint sport_program_exercises_progression_type_chk
    check (progression_type is null or progression_type in ('MAIN_COMPOUND','SECONDARY_COMPOUND','ISOLATION','STATIC_CORE')),
  drop constraint if exists sport_program_exercises_target_rir_chk,
  add constraint sport_program_exercises_target_rir_chk
    check (
      (target_rir_min is null and target_rir_max is null)
      or (
        target_rir_min is not null
        and target_rir_max is not null
        and target_rir_min >= 0
        and target_rir_max >= target_rir_min
      )
    );

with program_rows as (
  update public.sport_programs p
  set
    name = 'Musculation V2 - Force / Hypertrophie',
    goal = 'strength_hypertrophy',
    cycle = 'A/B',
    notes = 'Template permanent 2 semaines : A = FORCE, B = HYPERTROPHIE. Les charges ne sont pas codees en dur ; le moteur calcule la prochaine occurrence depuis les performances, reps, RIR et historique.',
    updated_at = now()
  where p.key = 'lean_bulk_ab'
  returning p.id
), session_seed(session_key, name, week_label, day_of_week, sort_order, notes) as (
  values
    ('A1', 'FORCE A - Squat / Bench / Tractions', 'A', 1, 1, 'Semaine FORCE : mouvements de reference, RIR 1-2.'),
    ('A2', 'FORCE B - Deadlift / Incline / Row', 'A', 3, 2, 'Semaine FORCE : hinge et haut du corps, RIR 1-2.'),
    ('A3', 'FORCE C - Front Squat / Vertical', 'A', 5, 3, 'Semaine FORCE : front squat, vertical push/pull, RIR 1-2.'),
    ('B1', 'HYPERTROPHIE A - Quadriceps / Pecs / Dos', 'B', 1, 4, 'Semaine HYPERTROPHIE : volume, variantes, RIR 1-3.'),
    ('B2', 'HYPERTROPHIE B - Chaine posterieure / Pecs / Dos', 'B', 3, 5, 'Semaine HYPERTROPHIE : chaine posterieure et volume, RIR 1-3.'),
    ('B3', 'HYPERTROPHIE C - Jambes / Push / Pull', 'B', 5, 6, 'Semaine HYPERTROPHIE : unilateraux, push/pull, RIR 1-3.')
)
insert into public.sport_program_sessions (
  program_id, session_key, name, week_label, day_of_week, sort_order, notes, updated_at
)
select p.id, s.session_key, s.name, s.week_label, s.day_of_week, s.sort_order, s.notes, now()
from program_rows p
cross join session_seed s
on conflict (program_id, session_key) do update
set name = excluded.name,
    week_label = excluded.week_label,
    day_of_week = excluded.day_of_week,
    sort_order = excluded.sort_order,
    notes = excluded.notes,
    updated_at = now();

with program_rows as (
  select p.id
  from public.sport_programs p
  where p.key = 'lean_bulk_ab'
), target_sessions as (
  select s.id, s.session_key
  from public.sport_program_sessions s
  join program_rows p on p.id = s.program_id
  where s.session_key in ('A1','A2','A3','B1','B2','B3')
), removed as (
  delete from public.sport_program_exercises e
  using target_sessions s
  where e.session_id = s.id
), exercise_seed(session_key, sort_order, exercise_key, exercise_name, activity_key, equipment, mode, rep_min, rep_max, target_seconds, time_min_seconds, time_max_seconds, planned_sets, rest_seconds, load_label, notes, week_type, progression_type, target_rir_min, target_rir_max, increment_kg) as (
  values
    ('A1', 1, 'barbell_back_squat', 'Squat arriere', 'strength', 'barbell', 'reps', 4, 6, null::integer, null::integer, null::integer, 3, 240, null::text, null::text, 'FORCE', 'MAIN_COMPOUND', 1::numeric, 2::numeric, 5::numeric),
    ('A1', 2, 'barbell_bench_press', 'Developpe couche barre', 'strength', 'barbell', 'reps', 4, 6, null, null, null, 3, 180, null, null, 'FORCE', 'MAIN_COMPOUND', 1, 2, 2.5),
    ('A1', 3, 'pullup_pronation', 'Tractions pronation lestees', 'bodyweight_strength', 'bodyweight', 'reps', 4, 6, null, null, null, 3, 180, 'Lest si calibre, sinon poids du corps', null, 'FORCE', 'MAIN_COMPOUND', 1, 2, 2.5),
    ('A1', 4, 'barbell_overhead_press', 'Developpe militaire barre', 'strength', 'barbell', 'reps', 5, 8, null, null, null, 3, 180, null, null, 'FORCE', 'SECONDARY_COMPOUND', 1, 2, 2.5),
    ('A1', 5, 'barbell_curl', 'Curl barre', 'strength', 'barbell', 'reps', 6, 10, null, null, null, 3, 120, null, null, 'FORCE', 'ISOLATION', 1, 2, 1),
    ('A1', 6, null, 'Ab Wheel', 'core_abs', 'bodyweight', 'reps', 6, 12, null, null, null, 3, 90, null, null, 'FORCE', 'STATIC_CORE', 1, 2, 1),
    ('A2', 1, 'barbell_deadlift', 'Souleve de terre', 'strength', 'barbell', 'reps', 4, 6, null, null, null, 3, 240, null, null, 'FORCE', 'MAIN_COMPOUND', 1, 2, 5),
    ('A2', 2, 'barbell_incline_bench', 'Developpe incline barre', 'strength', 'barbell', 'reps', 5, 8, null, null, null, 3, 180, null, null, 'FORCE', 'SECONDARY_COMPOUND', 1, 2, 2.5),
    ('A2', 3, 'barbell_row', 'Rowing barre', 'strength', 'barbell', 'reps', 5, 8, null, null, null, 3, 180, null, null, 'FORCE', 'SECONDARY_COMPOUND', 1, 2, 2.5),
    ('A2', 4, 'dumbbell_bulgarian_split_squat', 'Bulgarian Split Squat leste', 'strength', 'dumbbell', 'reps', 6, 8, null, null, null, 3, 120, null, 'Reps par jambe.', 'FORCE', 'SECONDARY_COMPOUND', 1, 2, 2),
    ('A2', 5, 'barbell_close_grip_bench_press', 'Developpe couche prise serree', 'strength', 'barbell', 'reps', 6, 8, null, null, null, 3, 120, null, null, 'FORCE', 'SECONDARY_COMPOUND', 1, 2, 2.5),
    ('A2', 6, 'plank', 'Gainage leste', 'plank_core', 'bodyweight', 'time', null, null, 90, 90, 120, 3, 120, null, null, 'FORCE', 'STATIC_CORE', 1, 2, 1),
    ('A3', 1, 'barbell_front_squat', 'Front squat', 'strength', 'barbell', 'reps', 5, 8, null, null, null, 3, 180, null, null, 'FORCE', 'SECONDARY_COMPOUND', 1, 2, 5),
    ('A3', 2, 'barbell_overhead_press', 'Developpe militaire barre', 'strength', 'barbell', 'reps', 5, 8, null, null, null, 3, 180, null, null, 'FORCE', 'SECONDARY_COMPOUND', 1, 2, 2.5),
    ('A3', 3, 'pullup_supination', 'Tractions supination lestees', 'bodyweight_strength', 'bodyweight', 'reps', 5, 8, null, null, null, 3, 180, 'Lest si calibre, sinon poids du corps', null, 'FORCE', 'SECONDARY_COMPOUND', 1, 2, 2.5),
    ('A3', 4, 'dumbbell_bench_press', 'Developpe couche halteres', 'strength', 'dumbbell', 'reps', 6, 10, null, null, null, 3, 120, null, null, 'FORCE', 'SECONDARY_COMPOUND', 1, 2, 2),
    ('A3', 5, 'dumbbell_row_one_arm', 'Rowing haltere unilateral', 'strength', 'dumbbell', 'reps', 6, 10, null, null, null, 3, 120, null, 'Reps par cote.', 'FORCE', 'SECONDARY_COMPOUND', 1, 2, 2),
    ('A3', 6, 'dumbbell_hammer_curl', 'Curl marteau', 'strength', 'dumbbell', 'reps', 8, 12, null, null, null, 3, 90, null, null, 'FORCE', 'ISOLATION', 1, 2, 1),
    ('A3', 7, null, 'Releves de jambes suspendu', 'core_abs', 'bodyweight', 'reps', 8, 15, null, null, null, 3, 90, null, null, 'FORCE', 'STATIC_CORE', 1, 2, 1),
    ('B1', 1, null, 'Squat avec pause', 'strength', 'barbell', 'reps', 8, 10, null, null, null, 3, 180, null, null, 'HYPERTROPHY', 'SECONDARY_COMPOUND', 1, 3, 5),
    ('B1', 2, 'dumbbell_bench_press', 'Developpe couche halteres', 'strength', 'dumbbell', 'reps', 8, 12, null, null, null, 3, 120, null, null, 'HYPERTROPHY', 'SECONDARY_COMPOUND', 1, 3, 2),
    ('B1', 3, 'pullup_pronation', 'Tractions pronation au poids du corps', 'bodyweight_strength', 'bodyweight', 'reps', 8, 12, null, null, null, 3, 120, 'Poids du corps puis lest apres validation', null, 'HYPERTROPHY', 'SECONDARY_COMPOUND', 1, 2, 2.5),
    ('B1', 4, null, 'Arnold Press', 'strength', 'dumbbell', 'reps', 10, 12, null, null, null, 3, 120, null, null, 'HYPERTROPHY', 'SECONDARY_COMPOUND', 1, 3, 2),
    ('B1', 5, 'dumbbell_lateral_raise', 'Elevations laterales', 'strength', 'dumbbell', 'reps', 12, 20, null, null, null, 3, 90, null, null, 'HYPERTROPHY', 'ISOLATION', 1, 2, 1),
    ('B1', 6, null, 'Curl incline halteres', 'strength', 'dumbbell', 'reps', 10, 15, null, null, null, 3, 90, null, null, 'HYPERTROPHY', 'ISOLATION', 1, 2, 1),
    ('B1', 7, null, 'Ab Wheel', 'core_abs', 'bodyweight', 'reps', 8, 15, null, null, null, 3, 90, null, null, 'HYPERTROPHY', 'STATIC_CORE', 1, 2, 1),
    ('B2', 1, 'barbell_romanian_deadlift', 'Romanian Deadlift', 'strength', 'barbell', 'reps', 8, 10, null, null, null, 3, 180, null, null, 'HYPERTROPHY', 'SECONDARY_COMPOUND', 1, 3, 5),
    ('B2', 2, 'dumbbell_incline_press', 'Developpe incline halteres', 'strength', 'dumbbell', 'reps', 8, 12, null, null, null, 3, 120, null, null, 'HYPERTROPHY', 'SECONDARY_COMPOUND', 1, 3, 2),
    ('B2', 3, 'dumbbell_row_one_arm', 'Rowing haltere unilateral', 'strength', 'dumbbell', 'reps', 10, 12, null, null, null, 3, 120, null, 'Reps par cote.', 'HYPERTROPHY', 'SECONDARY_COMPOUND', 1, 2, 2),
    ('B2', 4, 'dumbbell_reverse_lunge', 'Fentes arriere halteres', 'strength', 'dumbbell', 'reps', 8, 12, null, null, null, 3, 120, null, 'Reps par jambe.', 'HYPERTROPHY', 'SECONDARY_COMPOUND', 1, 3, 2),
    ('B2', 5, 'dumbbell_rear_delt_fly', 'Oiseau halteres', 'strength', 'dumbbell', 'reps', 12, 20, null, null, null, 3, 90, null, null, 'HYPERTROPHY', 'ISOLATION', 1, 2, 1),
    ('B2', 6, 'triceps_extension', 'Extension triceps haltere', 'strength', 'dumbbell', 'reps', 10, 15, null, null, null, 3, 90, null, null, 'HYPERTROPHY', 'ISOLATION', 1, 2, 1),
    ('B2', 7, 'side_plank', 'Gainage lateral leste', 'plank_core', 'bodyweight', 'time', null, null, 90, 90, 120, 3, 90, null, 'Par cote.', 'HYPERTROPHY', 'STATIC_CORE', 1, 2, 1),
    ('B3', 1, 'dumbbell_bulgarian_split_squat', 'Bulgarian Split Squat', 'strength', 'dumbbell', 'reps', 8, 12, null, null, null, 3, 120, null, 'Reps par jambe.', 'HYPERTROPHY', 'SECONDARY_COMPOUND', 1, 3, 2),
    ('B3', 2, null, 'Dips', 'bodyweight_strength', 'bodyweight', 'reps', 8, 12, null, null, null, 3, 120, 'Poids du corps puis lest apres validation', null, 'HYPERTROPHY', 'SECONDARY_COMPOUND', 1, 2, 2.5),
    ('B3', 3, 'pullup_supination', 'Tractions supination', 'bodyweight_strength', 'bodyweight', 'reps', 8, 12, null, null, null, 3, 120, 'Poids du corps puis lest apres validation', null, 'HYPERTROPHY', 'SECONDARY_COMPOUND', 1, 2, 2.5),
    ('B3', 4, 'barbell_hip_thrust', 'Hip Thrust barre', 'strength', 'barbell', 'reps', 8, 12, null, null, null, 3, 120, null, null, 'HYPERTROPHY', 'SECONDARY_COMPOUND', 1, 3, 5),
    ('B3', 5, null, 'Ecartes halteres', 'strength', 'dumbbell', 'reps', 12, 15, null, null, null, 3, 90, null, null, 'HYPERTROPHY', 'ISOLATION', 1, 2, 1),
    ('B3', 6, null, 'Curl concentration', 'strength', 'dumbbell', 'reps', 10, 15, null, null, null, 3, 90, null, 'Reps par bras.', 'HYPERTROPHY', 'ISOLATION', 1, 2, 1),
    ('B3', 7, 'dumbbell_lateral_raise', 'Elevations laterales', 'strength', 'dumbbell', 'reps', 15, 20, null, null, null, 3, 60, null, null, 'HYPERTROPHY', 'ISOLATION', 1, 2, 1),
    ('B3', 8, null, 'Releves de jambes suspendu', 'core_abs', 'bodyweight', 'reps', 10, 15, null, null, null, 3, 90, null, null, 'HYPERTROPHY', 'STATIC_CORE', 1, 2, 1)
)
insert into public.sport_program_exercises (
  session_id,
  exercise_key,
  exercise_name,
  activity_key,
  equipment,
  mode,
  target_reps,
  rep_min,
  rep_max,
  target_seconds,
  time_min_seconds,
  time_max_seconds,
  planned_sets,
  rest_seconds,
  default_weight_kg,
  load_label,
  sort_order,
  notes,
  week_type,
  progression_type,
  target_rir_min,
  target_rir_max,
  progression_increment_kg
)
select
  s.id,
  case
    when e.exercise_key is not null and exists (select 1 from public.sport_exercises x where x.key = e.exercise_key)
      then e.exercise_key
    else null
  end,
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
  null::numeric,
  e.load_label,
  e.sort_order,
  e.notes,
  e.week_type,
  e.progression_type,
  e.target_rir_min,
  e.target_rir_max,
  e.increment_kg
from exercise_seed e
join target_sessions s on s.session_key = e.session_key;
