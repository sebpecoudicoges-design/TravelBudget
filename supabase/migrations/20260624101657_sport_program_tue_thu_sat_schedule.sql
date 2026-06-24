with target_program as (
  select p.id
  from public.sport_programs p
  join auth.users u on u.id = p.user_id
  where lower(u.email) = lower('seb.pecoud.icoges@gmail.com')
    and p.key = 'lean_bulk_ab'
  limit 1
)
update public.sport_programs p
set
  start_date = date '2026-06-22',
  cycle = 'A/B',
  is_active = true,
  updated_at = now()
from target_program tp
where p.id = tp.id;

with target_program as (
  select p.id
  from public.sport_programs p
  join auth.users u on u.id = p.user_id
  where lower(u.email) = lower('seb.pecoud.icoges@gmail.com')
    and p.key = 'lean_bulk_ab'
  limit 1
), schedule(session_key, day_of_week, sort_order) as (
  values
    ('A1', 2, 1),
    ('A2', 4, 2),
    ('A3', 6, 3),
    ('B1', 2, 4),
    ('B2', 4, 5),
    ('B3', 6, 6)
)
update public.sport_program_sessions s
set
  day_of_week = schedule.day_of_week,
  sort_order = schedule.sort_order,
  updated_at = now()
from target_program tp, schedule
where s.program_id = tp.id
  and schedule.session_key = s.session_key;
