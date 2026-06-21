alter table public.sport_exercises
  add column if not exists default_weight_kg numeric,
  add column if not exists load_label text,
  add column if not exists rep_min integer,
  add column if not exists rep_max integer;

alter table public.sport_exercises
  drop constraint if exists sport_exercises_default_weight_kg_chk;

alter table public.sport_exercises
  add constraint sport_exercises_default_weight_kg_chk
  check (default_weight_kg is null or default_weight_kg >= 0);

alter table public.sport_exercises
  drop constraint if exists sport_exercises_rep_range_chk;

alter table public.sport_exercises
  add constraint sport_exercises_rep_range_chk
  check (
    (rep_min is null and rep_max is null)
    or (rep_min is not null and rep_max is not null and rep_min >= 0 and rep_max >= rep_min)
  );

create table if not exists public.sport_programs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  name text not null,
  goal text not null default 'lean_bulk',
  cycle text not null default 'A/B',
  start_date date,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sport_programs_key_not_blank_chk check (length(trim(key)) > 0),
  constraint sport_programs_name_not_blank_chk check (length(trim(name)) > 0),
  constraint sport_programs_user_key_unique unique (user_id, key)
);

create table if not exists public.sport_program_sessions (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.sport_programs(id) on delete cascade,
  session_key text not null,
  name text not null,
  week_label text not null,
  day_of_week integer not null,
  sort_order integer not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sport_program_sessions_day_chk check (day_of_week between 1 and 7),
  constraint sport_program_sessions_key_not_blank_chk check (length(trim(session_key)) > 0),
  constraint sport_program_sessions_program_key_unique unique (program_id, session_key)
);

create table if not exists public.sport_program_exercises (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sport_program_sessions(id) on delete cascade,
  exercise_key text references public.sport_exercises(key) on delete set null,
  exercise_name text not null,
  activity_key text not null default 'strength',
  equipment text not null default 'mixed',
  mode text not null default 'reps',
  target_reps integer,
  rep_min integer,
  rep_max integer,
  target_seconds integer,
  time_min_seconds integer,
  time_max_seconds integer,
  planned_sets integer not null default 1,
  rest_seconds integer not null default 0,
  default_weight_kg numeric,
  load_label text,
  distance_m numeric,
  met_value numeric,
  sort_order integer not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sport_program_exercises_mode_chk check (mode in ('reps','time')),
  constraint sport_program_exercises_reps_chk check (target_reps is null or target_reps >= 0),
  constraint sport_program_exercises_rep_range_chk check (
    (rep_min is null and rep_max is null)
    or (rep_min is not null and rep_max is not null and rep_min >= 0 and rep_max >= rep_min)
  ),
  constraint sport_program_exercises_seconds_chk check (target_seconds is null or target_seconds >= 0),
  constraint sport_program_exercises_time_range_chk check (
    (time_min_seconds is null and time_max_seconds is null)
    or (time_min_seconds is not null and time_max_seconds is not null and time_min_seconds >= 0 and time_max_seconds >= time_min_seconds)
  ),
  constraint sport_program_exercises_sets_chk check (planned_sets >= 1),
  constraint sport_program_exercises_rest_chk check (rest_seconds >= 0),
  constraint sport_program_exercises_weight_chk check (default_weight_kg is null or default_weight_kg >= 0),
  constraint sport_program_exercises_distance_chk check (distance_m is null or distance_m >= 0),
  constraint sport_program_exercises_met_chk check (met_value is null or met_value > 0)
);

create index if not exists sport_programs_user_active_idx
  on public.sport_programs(user_id, is_active, key);

create index if not exists sport_program_sessions_program_order_idx
  on public.sport_program_sessions(program_id, week_label, day_of_week, sort_order);

create index if not exists sport_program_exercises_session_order_idx
  on public.sport_program_exercises(session_id, sort_order);

alter table public.sport_programs enable row level security;
alter table public.sport_program_sessions enable row level security;
alter table public.sport_program_exercises enable row level security;

drop policy if exists sport_programs_select_own on public.sport_programs;
create policy sport_programs_select_own
  on public.sport_programs
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists sport_programs_insert_own on public.sport_programs;
create policy sport_programs_insert_own
  on public.sport_programs
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists sport_programs_update_own on public.sport_programs;
create policy sport_programs_update_own
  on public.sport_programs
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists sport_programs_delete_own on public.sport_programs;
create policy sport_programs_delete_own
  on public.sport_programs
  for delete
  to authenticated
  using (user_id = auth.uid());

drop policy if exists sport_program_sessions_select_own on public.sport_program_sessions;
create policy sport_program_sessions_select_own
  on public.sport_program_sessions
  for select
  to authenticated
  using (exists (
    select 1 from public.sport_programs p
    where p.id = sport_program_sessions.program_id
      and p.user_id = auth.uid()
  ));

drop policy if exists sport_program_sessions_insert_own on public.sport_program_sessions;
create policy sport_program_sessions_insert_own
  on public.sport_program_sessions
  for insert
  to authenticated
  with check (exists (
    select 1 from public.sport_programs p
    where p.id = sport_program_sessions.program_id
      and p.user_id = auth.uid()
  ));

drop policy if exists sport_program_sessions_update_own on public.sport_program_sessions;
create policy sport_program_sessions_update_own
  on public.sport_program_sessions
  for update
  to authenticated
  using (exists (
    select 1 from public.sport_programs p
    where p.id = sport_program_sessions.program_id
      and p.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.sport_programs p
    where p.id = sport_program_sessions.program_id
      and p.user_id = auth.uid()
  ));

drop policy if exists sport_program_sessions_delete_own on public.sport_program_sessions;
create policy sport_program_sessions_delete_own
  on public.sport_program_sessions
  for delete
  to authenticated
  using (exists (
    select 1 from public.sport_programs p
    where p.id = sport_program_sessions.program_id
      and p.user_id = auth.uid()
  ));

drop policy if exists sport_program_exercises_select_own on public.sport_program_exercises;
create policy sport_program_exercises_select_own
  on public.sport_program_exercises
  for select
  to authenticated
  using (exists (
    select 1
    from public.sport_program_sessions ps
    join public.sport_programs p on p.id = ps.program_id
    where ps.id = sport_program_exercises.session_id
      and p.user_id = auth.uid()
  ));

drop policy if exists sport_program_exercises_insert_own on public.sport_program_exercises;
create policy sport_program_exercises_insert_own
  on public.sport_program_exercises
  for insert
  to authenticated
  with check (exists (
    select 1
    from public.sport_program_sessions ps
    join public.sport_programs p on p.id = ps.program_id
    where ps.id = sport_program_exercises.session_id
      and p.user_id = auth.uid()
  ));

drop policy if exists sport_program_exercises_update_own on public.sport_program_exercises;
create policy sport_program_exercises_update_own
  on public.sport_program_exercises
  for update
  to authenticated
  using (exists (
    select 1
    from public.sport_program_sessions ps
    join public.sport_programs p on p.id = ps.program_id
    where ps.id = sport_program_exercises.session_id
      and p.user_id = auth.uid()
  ))
  with check (exists (
    select 1
    from public.sport_program_sessions ps
    join public.sport_programs p on p.id = ps.program_id
    where ps.id = sport_program_exercises.session_id
      and p.user_id = auth.uid()
  ));

drop policy if exists sport_program_exercises_delete_own on public.sport_program_exercises;
create policy sport_program_exercises_delete_own
  on public.sport_program_exercises
  for delete
  to authenticated
  using (exists (
    select 1
    from public.sport_program_sessions ps
    join public.sport_programs p on p.id = ps.program_id
    where ps.id = sport_program_exercises.session_id
      and p.user_id = auth.uid()
  ));

revoke all on table public.sport_programs from public;
revoke all on table public.sport_programs from anon;
revoke all on table public.sport_programs from authenticated;
grant select, insert, update, delete on table public.sport_programs to authenticated;
grant all on table public.sport_programs to service_role;

revoke all on table public.sport_program_sessions from public;
revoke all on table public.sport_program_sessions from anon;
revoke all on table public.sport_program_sessions from authenticated;
grant select, insert, update, delete on table public.sport_program_sessions to authenticated;
grant all on table public.sport_program_sessions to service_role;

revoke all on table public.sport_program_exercises from public;
revoke all on table public.sport_program_exercises from anon;
revoke all on table public.sport_program_exercises from authenticated;
grant select, insert, update, delete on table public.sport_program_exercises to authenticated;
grant all on table public.sport_program_exercises to service_role;

insert into public.sport_exercises
  (key, goal, equipment, activity_key, name_fr, name_en, mode, default_reps, default_seconds, default_sets, default_rest_seconds, met_value, tags, sort_order, default_weight_kg, load_label, rep_min, rep_max)
values
  ('barbell_back_squat', 'strength', 'barbell', 'strength', 'Squat arriere', 'Back squat', 'reps', 6, null, 3, 180, 6.0, array['jambes','barre','programme_ab'], 101, 60, null, 6, 10),
  ('barbell_romanian_deadlift', 'strength', 'barbell', 'strength', 'Souleve de terre roumain', 'Romanian deadlift', 'reps', 6, null, 3, 180, 6.0, array['jambes','ischios','barre','programme_ab'], 102, 80, null, 6, 10),
  ('barbell_front_squat', 'strength', 'barbell', 'strength', 'Front squat', 'Front squat', 'reps', 8, null, 3, 120, 5.8, array['jambes','barre','programme_ab'], 103, 45, null, 8, 12),
  ('dumbbell_bulgarian_split_squat', 'strength', 'dumbbell', 'strength', 'Fentes bulgares', 'Bulgarian split squat', 'reps', 8, null, 3, 120, 6.5, array['jambes','halteres','unilateral','programme_ab'], 104, 32, '2 x 16 kg', 8, 12),
  ('barbell_bench_press', 'strength', 'barbell', 'strength', 'Developpe couche', 'Bench press', 'reps', 6, null, 3, 180, 5.8, array['pectoraux','barre','push','programme_ab'], 111, 50, null, 6, 10),
  ('barbell_close_grip_bench_press', 'strength', 'barbell', 'strength', 'Developpe couche prise serree', 'Close-grip bench press', 'reps', 8, null, 3, 120, 5.6, array['pectoraux','triceps','barre','programme_ab'], 112, 45, null, 8, 12),
  ('barbell_incline_bench_press', 'strength', 'barbell', 'strength', 'Developpe incline barre', 'Incline barbell press', 'reps', 6, null, 3, 180, 5.8, array['pectoraux','barre','push','programme_ab'], 113, 45, null, 6, 10),
  ('dumbbell_incline_press', 'strength', 'dumbbell', 'strength', 'Developpe incline halteres', 'Incline dumbbell press', 'reps', 8, null, 3, 120, 5.8, array['pectoraux','halteres','push','programme_ab'], 114, 40, '2 x 20 kg', 8, 12),
  ('dumbbell_flat_press', 'strength', 'dumbbell', 'strength', 'Developpe halteres plat', 'Flat dumbbell press', 'reps', 8, null, 3, 120, 5.8, array['pectoraux','halteres','push','programme_ab'], 115, 40, '2 x 20 kg', 8, 12),
  ('pullup_pronation', 'strength', 'bodyweight', 'bodyweight_strength', 'Tractions pronation', 'Pronated pull-up', 'reps', 6, null, 3, 120, 6.0, array['dos','poids_du_corps','pull','programme_ab'], 121, 0, 'Poids du corps', 6, 10),
  ('pullup_supination', 'strength', 'bodyweight', 'bodyweight_strength', 'Tractions supination', 'Supinated pull-up', 'reps', 6, null, 3, 120, 6.0, array['dos','biceps','poids_du_corps','programme_ab'], 122, 0, 'Poids du corps', 6, 10),
  ('pullup_weighted_or_bodyweight', 'strength', 'bodyweight', 'bodyweight_strength', 'Tractions lestees ou poids du corps', 'Weighted or bodyweight pull-up', 'reps', 6, null, 3, 120, 6.2, array['dos','poids_du_corps','lest','programme_ab'], 123, 0, 'Poids du corps', 6, 10),
  ('barbell_row', 'strength', 'barbell', 'strength', 'Rowing barre', 'Barbell row', 'reps', 8, null, 3, 120, 5.5, array['dos','barre','pull','programme_ab'], 124, 60, null, 8, 12),
  ('dumbbell_one_arm_row', 'strength', 'dumbbell', 'strength', 'Rowing haltere un bras', 'One-arm dumbbell row', 'reps', 8, null, 3, 90, 5.4, array['dos','halteres','unilateral','programme_ab'], 125, 30, null, 8, 12),
  ('barbell_overhead_press', 'strength', 'barbell', 'strength', 'Developpe militaire barre', 'Barbell overhead press', 'reps', 6, null, 2, 120, 5.6, array['epaules','barre','push','programme_ab'], 131, 35, null, 6, 10),
  ('dumbbell_overhead_press', 'strength', 'dumbbell', 'strength', 'Developpe militaire halteres', 'Dumbbell overhead press', 'reps', 8, null, 2, 90, 5.4, array['epaules','halteres','push','programme_ab'], 132, 32, '2 x 16 kg', 8, 12),
  ('dumbbell_lateral_raise', 'strength', 'dumbbell', 'strength', 'Elevations laterales', 'Lateral raise', 'reps', 12, null, 2, 60, 4.8, array['epaules','halteres','programme_ab'], 133, 8, null, 12, 20),
  ('dumbbell_reverse_fly', 'strength', 'dumbbell', 'strength', 'Oiseau halteres', 'Dumbbell reverse fly', 'reps', 12, null, 2, 60, 4.8, array['epaules','arriere_epaule','halteres','programme_ab'], 134, 6, null, 12, 20),
  ('dumbbell_curl', 'strength', 'dumbbell', 'strength', 'Curl halteres', 'Dumbbell curl', 'reps', 10, null, 2, 60, 4.8, array['biceps','halteres','programme_ab'], 141, 14, null, 10, 15),
  ('dumbbell_hammer_curl', 'strength', 'dumbbell', 'strength', 'Curl marteau', 'Hammer curl', 'reps', 10, null, 2, 60, 4.8, array['biceps','halteres','programme_ab'], 142, 17.5, null, 10, 15),
  ('barbell_curl', 'strength', 'barbell', 'strength', 'Curl barre', 'Barbell curl', 'reps', 10, null, 2, 60, 4.8, array['biceps','barre','programme_ab'], 143, 30, null, 10, 15),
  ('dumbbell_overhead_triceps_extension', 'strength', 'dumbbell', 'strength', 'Extension triceps haltere au-dessus de la tete', 'Overhead dumbbell triceps extension', 'reps', 10, null, 2, 60, 4.8, array['triceps','halteres','programme_ab'], 151, 20, null, 10, 15),
  ('triceps_extension', 'strength', 'dumbbell', 'strength', 'Extension triceps', 'Triceps extension', 'reps', 10, null, 2, 60, 4.8, array['triceps','programme_ab'], 152, 20, null, 10, 15),
  ('lying_leg_raise_ab', 'strength', 'bodyweight', 'core_abs', 'Releves de jambes', 'Leg raises', 'reps', 10, null, 3, 60, 4.5, array['abdos','core','programme_ab'], 161, 0, null, 10, 20),
  ('abdos_program', 'strength', 'bodyweight', 'core_abs', 'Abdos', 'Abs', 'reps', 10, null, 3, 60, 4.5, array['abdos','core','programme_ab'], 162, 0, null, 10, 20),
  ('plank_program', 'strength', 'bodyweight', 'plank_core', 'Gainage', 'Plank', 'time', null, 30, 3, 60, 4.2, array['gainage','core','programme_ab'], 163, 0, null, null, null),
  ('side_plank_program', 'strength', 'bodyweight', 'plank_core', 'Gainage lateral', 'Side plank', 'time', null, 30, 2, 60, 4.2, array['gainage','core','programme_ab'], 164, 0, null, null, null)
on conflict (key) do update set
  goal = excluded.goal,
  equipment = excluded.equipment,
  activity_key = excluded.activity_key,
  name_fr = excluded.name_fr,
  name_en = excluded.name_en,
  mode = excluded.mode,
  default_reps = excluded.default_reps,
  default_seconds = excluded.default_seconds,
  default_sets = excluded.default_sets,
  default_rest_seconds = excluded.default_rest_seconds,
  met_value = excluded.met_value,
  tags = excluded.tags,
  sort_order = excluded.sort_order,
  default_weight_kg = excluded.default_weight_kg,
  load_label = excluded.load_label,
  rep_min = excluded.rep_min,
  rep_max = excluded.rep_max,
  is_active = true,
  updated_at = now();

with target_user as (
  select id as user_id
  from auth.users
  where lower(email) = lower('seb.pecoud.icoges@gmail.com')
  limit 1
), upsert_program as (
  insert into public.sport_programs (user_id, key, name, goal, cycle, start_date, is_active, notes)
  select user_id, 'lean_bulk_ab', 'Prise de masse A/B', 'lean_bulk', 'A/B', current_date, true,
         'Programme A/B lundi-mercredi-vendredi avec double progression par plage de reps.'
  from target_user
  on conflict (user_id, key) do update set
    name = excluded.name,
    goal = excluded.goal,
    cycle = excluded.cycle,
    is_active = true,
    notes = excluded.notes,
    updated_at = now()
  returning id, user_id
), program_row as (
  select id, user_id from upsert_program
  union all
  select p.id, p.user_id
  from public.sport_programs p
  join target_user u on u.user_id = p.user_id
  where p.key = 'lean_bulk_ab'
  limit 1
), session_seed(session_key, name, week_label, day_of_week, sort_order) as (
  values
    ('A1', 'Semaine A - A1', 'A', 1, 1),
    ('A2', 'Semaine A - A2', 'A', 3, 2),
    ('A3', 'Semaine A - A3', 'A', 5, 3),
    ('B1', 'Semaine B - B1', 'B', 1, 4),
    ('B2', 'Semaine B - B2', 'B', 3, 5),
    ('B3', 'Semaine B - B3', 'B', 5, 6)
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
), exercise_seed(session_key, sort_order, exercise_key, exercise_name, activity_key, equipment, mode, rep_min, rep_max, target_seconds, time_min_seconds, time_max_seconds, planned_sets, rest_seconds, default_weight_kg, load_label) as (
  values
    ('A1', 1, 'barbell_back_squat', 'Squat arriere', 'strength', 'barbell', 'reps', 6, 10, null::integer, null::integer, null::integer, 3, 180, 60::numeric, null::text),
    ('A1', 2, 'barbell_bench_press', 'Developpe couche', 'strength', 'barbell', 'reps', 6, 10, null, null, null, 3, 180, 50, null),
    ('A1', 3, 'pullup_pronation', 'Tractions pronation', 'bodyweight_strength', 'bodyweight', 'reps', 6, 10, null, null, null, 3, 120, 0, 'Poids du corps'),
    ('A1', 4, 'dumbbell_overhead_press', 'Developpe militaire halteres', 'strength', 'dumbbell', 'reps', 8, 12, null, null, null, 2, 90, 32, '2 x 16 kg'),
    ('A1', 5, 'dumbbell_curl', 'Curl halteres', 'strength', 'dumbbell', 'reps', 10, 15, null, null, null, 2, 60, 14, null),
    ('A1', 6, 'plank_program', 'Gainage', 'plank_core', 'bodyweight', 'time', null, null, 30, 30, 60, 3, 60, 0, null),

    ('A2', 1, 'barbell_romanian_deadlift', 'Souleve de terre roumain', 'strength', 'barbell', 'reps', 6, 10, null, null, null, 3, 180, 80, null),
    ('A2', 2, 'dumbbell_incline_press', 'Developpe incline halteres', 'strength', 'dumbbell', 'reps', 8, 12, null, null, null, 3, 120, 40, '2 x 20 kg'),
    ('A2', 3, 'barbell_row', 'Rowing barre', 'strength', 'barbell', 'reps', 8, 12, null, null, null, 3, 120, 60, null),
    ('A2', 4, 'dumbbell_lateral_raise', 'Elevations laterales', 'strength', 'dumbbell', 'reps', 12, 20, null, null, null, 2, 60, 8, null),
    ('A2', 5, 'dumbbell_overhead_triceps_extension', 'Extension triceps haltere au-dessus de la tete', 'strength', 'dumbbell', 'reps', 10, 15, null, null, null, 2, 60, 20, null),
    ('A2', 6, 'lying_leg_raise_ab', 'Releves de jambes', 'core_abs', 'bodyweight', 'reps', 10, 20, null, null, null, 3, 60, 0, null),

    ('A3', 1, 'barbell_front_squat', 'Front squat ou Goblet squat', 'strength', 'barbell', 'reps', 8, 12, null, null, null, 3, 120, 45, null),
    ('A3', 2, 'barbell_close_grip_bench_press', 'Developpe couche prise serree', 'strength', 'barbell', 'reps', 8, 12, null, null, null, 3, 120, 45, null),
    ('A3', 3, 'pullup_supination', 'Tractions supination', 'bodyweight_strength', 'bodyweight', 'reps', 6, 10, null, null, null, 3, 120, 0, 'Poids du corps'),
    ('A3', 4, 'dumbbell_reverse_fly', 'Oiseau halteres', 'strength', 'dumbbell', 'reps', 12, 20, null, null, null, 2, 60, 6, null),
    ('A3', 5, 'dumbbell_hammer_curl', 'Curl marteau', 'strength', 'dumbbell', 'reps', 10, 15, null, null, null, 2, 60, 17.5, null),
    ('A3', 6, 'side_plank_program', 'Gainage lateral', 'plank_core', 'bodyweight', 'time', null, null, 30, 30, 60, 2, 60, 0, null),

    ('B1', 1, 'dumbbell_bulgarian_split_squat', 'Fentes bulgares', 'strength', 'dumbbell', 'reps', 8, 12, null, null, null, 3, 120, 32, '2 x 16 kg'),
    ('B1', 2, 'barbell_incline_bench_press', 'Developpe incline barre', 'strength', 'barbell', 'reps', 6, 10, null, null, null, 3, 180, 45, null),
    ('B1', 3, 'dumbbell_one_arm_row', 'Rowing haltere un bras', 'strength', 'dumbbell', 'reps', 8, 12, null, null, null, 3, 90, 30, null),
    ('B1', 4, 'barbell_overhead_press', 'Developpe militaire barre', 'strength', 'barbell', 'reps', 6, 10, null, null, null, 2, 120, 35, null),
    ('B1', 5, 'barbell_curl', 'Curl barre', 'strength', 'barbell', 'reps', 10, 15, null, null, null, 2, 60, 30, null),
    ('B1', 6, 'abdos_program', 'Abdos', 'core_abs', 'bodyweight', 'reps', 10, 20, null, null, null, 3, 60, 0, null),

    ('B2', 1, 'barbell_romanian_deadlift', 'Souleve de terre roumain', 'strength', 'barbell', 'reps', 6, 10, null, null, null, 3, 180, 80, null),
    ('B2', 2, 'barbell_bench_press', 'Developpe couche', 'strength', 'barbell', 'reps', 6, 10, null, null, null, 3, 180, 50, null),
    ('B2', 3, 'pullup_weighted_or_bodyweight', 'Tractions lestees ou poids du corps', 'bodyweight_strength', 'bodyweight', 'reps', 6, 10, null, null, null, 3, 120, 0, 'Poids du corps'),
    ('B2', 4, 'dumbbell_lateral_raise', 'Elevations laterales', 'strength', 'dumbbell', 'reps', 12, 20, null, null, null, 2, 60, 8, null),
    ('B2', 5, 'triceps_extension', 'Extension triceps', 'strength', 'dumbbell', 'reps', 10, 15, null, null, null, 2, 60, 20, null),
    ('B2', 6, 'abdos_program', 'Abdos', 'core_abs', 'bodyweight', 'reps', 10, 20, null, null, null, 3, 60, 0, null),

    ('B3', 1, 'barbell_back_squat', 'Squat arriere', 'strength', 'barbell', 'reps', 6, 10, null, null, null, 3, 180, 60, null),
    ('B3', 2, 'dumbbell_flat_press', 'Developpe halteres ou pompes lestees', 'strength', 'dumbbell', 'reps', 8, 12, null, null, null, 3, 120, 40, '2 x 20 kg'),
    ('B3', 3, 'barbell_row', 'Rowing barre', 'strength', 'barbell', 'reps', 8, 12, null, null, null, 3, 120, 60, null),
    ('B3', 4, 'dumbbell_reverse_fly', 'Oiseau halteres', 'strength', 'dumbbell', 'reps', 12, 20, null, null, null, 2, 60, 6, null),
    ('B3', 5, 'dumbbell_hammer_curl', 'Curl marteau', 'strength', 'dumbbell', 'reps', 10, 15, null, null, null, 2, 60, 17.5, null),
    ('B3', 6, 'plank_program', 'Gainage', 'plank_core', 'bodyweight', 'time', null, null, 30, 30, 60, 3, 60, 0, null)
)
insert into public.sport_program_exercises (
  session_id, exercise_key, exercise_name, activity_key, equipment, mode,
  target_reps, rep_min, rep_max, target_seconds, time_min_seconds, time_max_seconds,
  planned_sets, rest_seconds, default_weight_kg, load_label, sort_order
)
select
  ps.id,
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
  e.sort_order
from exercise_seed e
join program_row p on true
join public.sport_program_sessions ps on ps.program_id = p.id and ps.session_key = e.session_key
where not exists (
  select 1
  from public.sport_program_exercises existing
  where existing.session_id = ps.id
    and existing.sort_order = e.sort_order
);
