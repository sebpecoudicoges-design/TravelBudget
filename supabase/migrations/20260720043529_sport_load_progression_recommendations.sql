-- Performance-derived load progression. Program loads are only changed after an
-- explicit recommendation application; session history remains immutable.

alter table public.sport_program_exercises
  add column if not exists progression_increment_kg numeric not null default 2.5,
  add column if not exists training_max_percentage numeric not null default 0.95;

alter table public.sport_program_exercises
  drop constraint if exists sport_program_exercises_progression_increment_chk,
  add constraint sport_program_exercises_progression_increment_chk
    check (progression_increment_kg > 0),
  drop constraint if exists sport_program_exercises_training_max_percentage_chk,
  add constraint sport_program_exercises_training_max_percentage_chk
    check (training_max_percentage between 0.85 and 1.00);

create table if not exists public.sport_exercise_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id text not null references public.sport_exercises(key) on delete cascade,
  latest_weight_kg numeric,
  latest_reps integer,
  latest_e1rm_kg numeric,
  best_recent_weight_kg numeric,
  best_recent_reps integer,
  best_recent_e1rm_kg numeric,
  best_all_time_e1rm_kg numeric,
  smoothed_e1rm_kg numeric,
  training_max_percentage numeric not null default 0.95,
  training_max_kg numeric,
  reference_weight_kg numeric,
  recommended_weight_kg numeric,
  recommended_reps_min integer,
  recommended_reps_max integer,
  recommendation_reason text,
  recommendation_status text not null default 'pending',
  calculated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sport_exercise_metrics_user_exercise_unique unique (user_id, exercise_id),
  constraint sport_exercise_metrics_tm_percentage_chk check (training_max_percentage between 0.85 and 1.00),
  constraint sport_exercise_metrics_status_chk check (recommendation_status in ('pending','accepted','rejected','applied')),
  constraint sport_exercise_metrics_rep_range_chk check (recommended_reps_min is null or recommended_reps_max is null or recommended_reps_max >= recommended_reps_min)
);

create table if not exists public.sport_exercise_metric_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id text not null references public.sport_exercises(key) on delete cascade,
  session_id uuid references public.sport_sessions(id) on delete set null,
  set_id uuid references public.sport_sets(id) on delete set null,
  weight_kg numeric,
  reps integer,
  estimated_1rm_kg numeric,
  smoothed_1rm_kg numeric,
  training_max_kg numeric,
  reference_weight_kg numeric,
  recommended_weight_kg numeric,
  calculation_method text not null default 'epley',
  created_at timestamptz not null default now()
);

create table if not exists public.sport_load_recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id text not null references public.sport_exercises(key) on delete cascade,
  program_exercise_id uuid references public.sport_program_exercises(id) on delete set null,
  source_session_id uuid references public.sport_sessions(id) on delete set null,
  current_program_weight_kg numeric,
  heaviest_successful_weight_kg numeric,
  heaviest_attempted_weight_kg numeric,
  sets_at_heaviest_weight integer not null default 0,
  recommended_weight_kg numeric not null,
  increment_kg numeric not null,
  reason_code text not null,
  reason_text text not null,
  confidence text not null default 'medium',
  status text not null default 'pending',
  application_scope text,
  previous_program_weight_kg numeric,
  modification_source text,
  accepted_at timestamptz,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sport_load_recommendations_status_chk check (status in ('pending','accepted','rejected','applied')),
  constraint sport_load_recommendations_confidence_chk check (confidence in ('low','medium','high')),
  constraint sport_load_recommendations_scope_chk check (application_scope is null or application_scope in ('next_session','session_variant','compatible_occurrences')),
  constraint sport_load_recommendations_source_unique unique (user_id, exercise_id, source_session_id, program_exercise_id)
);

create index if not exists sport_exercise_metrics_user_updated_idx
  on public.sport_exercise_metrics(user_id, updated_at desc);
create index if not exists sport_exercise_metric_history_recent_idx
  on public.sport_exercise_metric_history(user_id, exercise_id, created_at desc);
create index if not exists sport_load_recommendations_pending_idx
  on public.sport_load_recommendations(user_id, status, created_at desc);

alter table public.sport_exercise_metrics enable row level security;
alter table public.sport_exercise_metric_history enable row level security;
alter table public.sport_load_recommendations enable row level security;

drop policy if exists sport_exercise_metrics_own on public.sport_exercise_metrics;
create policy sport_exercise_metrics_own on public.sport_exercise_metrics
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists sport_exercise_metric_history_own on public.sport_exercise_metric_history;
create policy sport_exercise_metric_history_own on public.sport_exercise_metric_history
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists sport_load_recommendations_own on public.sport_load_recommendations;
create policy sport_load_recommendations_own on public.sport_load_recommendations
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on table public.sport_exercise_metrics, public.sport_exercise_metric_history, public.sport_load_recommendations from public, anon;
grant select, insert, update, delete on table public.sport_exercise_metrics, public.sport_exercise_metric_history, public.sport_load_recommendations to authenticated;
grant all on table public.sport_exercise_metrics, public.sport_exercise_metric_history, public.sport_load_recommendations to service_role;
