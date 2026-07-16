-- Ajustement prudent des charges du programme Volume / Intensite.
-- Objectif : coller aux performances observees et limiter les sauts de charge trop ambitieux.

with target_user as (
  select id as user_id
  from auth.users
  where lower(email) = lower('seb.pecoud.icoges@gmail.com')
  limit 1
), target_program as (
  select p.id as program_id
  from public.sport_programs p
  join target_user u on u.user_id = p.user_id
  where p.key = 'lean_bulk_ab'
  limit 1
), load_patch(session_key, exercise_key, exercise_name, default_weight_kg, load_label, notes) as (
  values
    ('A1', 'barbell_row', 'Rowing barre', 60::numeric, null::text, 'Volume : charge prudente basee sur 60x12 valide. +2,5 kg quand 3x10 est valide.'),
    ('A1', 'dumbbell_lateral_raise', 'Elevations laterales', 7::numeric, null::text, 'Isolation : 10-15 reps, progression quand 3x15 est valide.'),
    ('A2', 'barbell_deadlift', 'Souleve de terre', 115::numeric, null::text, 'Volume : 115 kg conserve apres 115x10x3. Monter a 120 kg apres validation.'),
    ('B1', 'barbell_row', 'Rowing barre', 67.5::numeric, null::text, 'Intensite : 67,5 kg plus coherent avec 60x12 que 70 kg. +2,5 kg quand 3x6 est valide.'),
    ('B1', 'dumbbell_lateral_raise', 'Elevations laterales', 7::numeric, null::text, 'Isolation : identique entre A et B.'),
    ('B3', 'barbell_front_squat', 'Front squat', 50::numeric, null::text, 'Variante intensite : front squat pour eviter deux back squats lourds en semaine B.'),
    ('B3', 'barbell_row', 'Rowing barre', 67.5::numeric, null::text, 'Intensite : 67,5 kg plus coherent avec 60x12 que 70 kg. +2,5 kg quand 3x6 est valide.')
)
update public.sport_program_exercises e
set
  exercise_key = p.exercise_key,
  exercise_name = p.exercise_name,
  default_weight_kg = p.default_weight_kg,
  load_label = p.load_label,
  notes = p.notes,
  updated_at = now()
from public.sport_program_sessions s
join target_program tp on tp.program_id = s.program_id
join load_patch p on p.session_key = s.session_key
where e.session_id = s.id
  and (
    (p.session_key = 'B3' and p.exercise_key = 'barbell_front_squat' and e.sort_order = 1)
    or (p.session_key = 'B3' and p.exercise_key = 'barbell_row' and e.exercise_key = 'barbell_row')
    or (p.session_key <> 'B3' and e.exercise_key = p.exercise_key)
  );

update public.sport_exercises
set
  default_weight_kg = case key
    when 'barbell_row' then 60
    when 'barbell_deadlift' then 115
    when 'dumbbell_lateral_raise' then 7
    when 'barbell_front_squat' then 45
    else default_weight_kg
  end,
  updated_at = now()
where key in ('barbell_row', 'barbell_deadlift', 'dumbbell_lateral_raise', 'barbell_front_squat');
