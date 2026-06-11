create table if not exists public.sport_exercises (
  key text primary key,
  goal text not null default 'free',
  equipment text not null default 'mixed',
  activity_key text not null default 'strength',
  name_fr text not null,
  name_en text not null,
  mode text not null default 'time',
  default_reps integer,
  default_seconds integer,
  default_sets integer not null default 1,
  default_rest_seconds integer not null default 0,
  distance_m numeric,
  met_value numeric,
  tags text[] not null default '{}',
  sort_order integer not null default 1000,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sport_exercises_mode_chk check (mode in ('reps','time')),
  constraint sport_exercises_default_reps_chk check (default_reps is null or default_reps >= 0),
  constraint sport_exercises_default_seconds_chk check (default_seconds is null or default_seconds >= 0),
  constraint sport_exercises_default_sets_chk check (default_sets >= 1),
  constraint sport_exercises_default_rest_seconds_chk check (default_rest_seconds >= 0),
  constraint sport_exercises_distance_m_chk check (distance_m is null or distance_m >= 0),
  constraint sport_exercises_met_value_chk check (met_value is null or met_value > 0)
);

create index if not exists sport_exercises_goal_equipment_idx
  on public.sport_exercises(goal, equipment, sort_order, name_fr)
  where is_active;

alter table public.sport_exercises enable row level security;

drop policy if exists sport_exercises_public_read on public.sport_exercises;
create policy sport_exercises_public_read
  on public.sport_exercises
  for select
  to anon, authenticated
  using (is_active = true);

revoke all on table public.sport_exercises from public;
revoke all on table public.sport_exercises from anon;
revoke all on table public.sport_exercises from authenticated;
grant select on table public.sport_exercises to anon, authenticated;
grant all on table public.sport_exercises to service_role;

create table if not exists public.sport_exercise_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_key text not null references public.sport_exercises(key) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, exercise_key)
);

alter table public.sport_exercise_favorites enable row level security;

drop policy if exists sport_exercise_favorites_select_own on public.sport_exercise_favorites;
create policy sport_exercise_favorites_select_own
  on public.sport_exercise_favorites
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists sport_exercise_favorites_insert_own on public.sport_exercise_favorites;
create policy sport_exercise_favorites_insert_own
  on public.sport_exercise_favorites
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists sport_exercise_favorites_delete_own on public.sport_exercise_favorites;
create policy sport_exercise_favorites_delete_own
  on public.sport_exercise_favorites
  for delete
  to authenticated
  using (user_id = auth.uid());

revoke all on table public.sport_exercise_favorites from public;
revoke all on table public.sport_exercise_favorites from anon;
revoke all on table public.sport_exercise_favorites from authenticated;
grant select, insert, delete on table public.sport_exercise_favorites to authenticated;
grant all on table public.sport_exercise_favorites to service_role;

insert into public.sport_exercises
  (key, goal, equipment, activity_key, name_fr, name_en, mode, default_reps, default_seconds, default_sets, default_rest_seconds, distance_m, met_value, tags, sort_order)
values
  ('boxing_heavy_bag', 'boxing', 'boxing', 'boxing', 'Sac de frappe', 'Heavy bag rounds', 'time', null, 180, 6, 60, null, 7.8, array['boxe','cardio','sac'], 10),
  ('boxing_speed_bag', 'boxing', 'boxing', 'boxing', 'Poire de vitesse', 'Speed bag', 'time', null, 120, 5, 45, null, 5.8, array['boxe','coordination'], 20),
  ('boxing_shadow', 'boxing', 'bodyweight', 'boxing', 'Shadow boxing', 'Shadow boxing', 'time', null, 180, 5, 45, null, 7.0, array['boxe','technique','cardio'], 30),
  ('boxing_mitts', 'boxing', 'boxing', 'boxing', 'Pattes d ours', 'Focus mitts', 'time', null, 180, 6, 60, null, 8.0, array['boxe','partenaire','explosivite'], 40),
  ('boxing_light_sparring', 'boxing', 'boxing', 'boxing', 'Sparring leger', 'Light sparring', 'time', null, 180, 4, 90, null, 8.2, array['boxe','sparring'], 50),
  ('boxing_footwork', 'boxing', 'bodyweight', 'boxing', 'Footwork boxe', 'Boxing footwork', 'time', null, 120, 6, 45, null, 6.5, array['boxe','deplacements'], 60),
  ('boxing_slips', 'boxing', 'bodyweight', 'boxing', 'Esquives et slips', 'Slips and defensive drills', 'time', null, 90, 6, 30, null, 5.8, array['boxe','defense'], 70),
  ('boxing_burpees', 'boxing', 'bodyweight', 'hiit', 'Burpees boxe', 'Boxing burpees', 'reps', 8, null, 5, 45, null, 8.5, array['boxe','hiit'], 80),
  ('boxing_jump_rope', 'boxing', 'rope', 'jump_rope', 'Corde a sauter boxe', 'Boxing jump rope', 'time', null, 180, 5, 45, null, 11.8, array['boxe','corde','cardio'], 90),
  ('boxing_bag_combo_rounds', 'boxing', 'boxing', 'boxing', 'Rounds combo au sac', 'Heavy bag combo rounds', 'time', null, 180, 8, 60, null, 8.3, array['boxe','sac','combos'], 100),
  ('pullup', 'strength', 'bodyweight', 'bodyweight_strength', 'Tractions', 'Pull-up', 'reps', 6, null, 4, 90, null, 6.0, array['dos','pull','street'], 210),
  ('chinup', 'strength', 'bodyweight', 'bodyweight_strength', 'Chin-up', 'Chin-up', 'reps', 6, null, 4, 90, null, 6.0, array['dos','biceps','street'], 220),
  ('australian_pullup', 'strength', 'bodyweight', 'bodyweight_strength', 'Tractions australiennes', 'Australian pull-up', 'reps', 10, null, 3, 75, null, 5.4, array['dos','pull','street'], 230),
  ('handstand_hold', 'strength', 'bodyweight', 'plank_core', 'Appui renverse tenu', 'Handstand hold', 'time', null, 30, 4, 75, null, 5.0, array['push','epaules','street'], 240),
  ('box_jump', 'cardio', 'bodyweight', 'hiit', 'Box jump', 'Box jump', 'reps', 10, null, 5, 60, null, 8.0, array['jambes','crossfit','plyo'], 310),
  ('wall_ball', 'cardio', 'mixed', 'hiit', 'Wall ball', 'Wall ball', 'reps', 15, null, 5, 60, null, 7.6, array['crossfit','jambes','push'], 320)
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
  distance_m = excluded.distance_m,
  met_value = excluded.met_value,
  tags = excluded.tags,
  sort_order = excluded.sort_order,
  is_active = true,
  updated_at = now();
