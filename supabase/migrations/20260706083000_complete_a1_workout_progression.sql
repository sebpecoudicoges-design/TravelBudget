-- Complete the verified A1 workout of 2026-07-06 and persist its next loads.
with target_user as (
  select id as user_id
  from auth.users
  where lower(email) = lower('seb.pecoud.icoges@gmail.com')
  limit 1
)
update public.sport_sessions s
set
  body_weight_kg = 59,
  estimated_kcal = 170,
  updated_at = now()
from target_user u
where s.id = '2e643688-3b29-426d-8b87-797049b37351'
  and s.user_id = u.user_id
  and s.duration_seconds = 2602;

with target_user as (
  select id as user_id
  from auth.users
  where lower(email) = lower('seb.pecoud.icoges@gmail.com')
  limit 1
), a1 as (
  select ps.id
  from public.sport_programs p
  join target_user u on u.user_id = p.user_id
  join public.sport_program_sessions ps on ps.program_id = p.id
  where p.key = 'lean_bulk_ab'
    and ps.session_key = 'A1'
)
update public.sport_program_exercises e
set
  default_weight_kg = case e.exercise_key
    when 'barbell_back_squat' then 80
    when 'barbell_bench_press' then 55
    when 'dumbbell_overhead_press' then 32
    when 'dumbbell_curl' then 15
    else e.default_weight_kg
  end,
  load_label = case e.exercise_key
    when 'dumbbell_overhead_press' then '2 x 16 kg'
    else e.load_label
  end,
  updated_at = now()
from a1
where e.session_id = a1.id
  and e.exercise_key in (
    'barbell_back_squat',
    'barbell_bench_press',
    'dumbbell_overhead_press',
    'dumbbell_curl'
  );
