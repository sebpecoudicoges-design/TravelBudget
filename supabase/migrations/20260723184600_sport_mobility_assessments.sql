create table if not exists public.mobility_assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  performed_at timestamptz not null default now(),
  test_code text not null,
  body_region text not null,
  left_value numeric,
  right_value numeric,
  central_value numeric,
  unit text not null,
  left_pain smallint,
  right_pain smallint,
  central_pain smallint,
  warmup_completed boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  constraint mobility_left_pain_range check (left_pain is null or left_pain between 0 and 10),
  constraint mobility_right_pain_range check (right_pain is null or right_pain between 0 and 10),
  constraint mobility_central_pain_range check (central_pain is null or central_pain between 0 and 10),
  constraint mobility_unit_allowed check (unit in ('cm', 'degrees', 'level', 'seconds')),
  constraint mobility_simple_level_range check (unit <> 'level' or central_value is null or central_value between 0 and 4)
);

create index if not exists mobility_assessments_user_date_idx
  on public.mobility_assessments(user_id, performed_at desc);

alter table public.mobility_assessments enable row level security;

drop policy if exists mobility_assessments_select_own on public.mobility_assessments;
create policy mobility_assessments_select_own
  on public.mobility_assessments for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists mobility_assessments_insert_own on public.mobility_assessments;
create policy mobility_assessments_insert_own
  on public.mobility_assessments for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists mobility_assessments_update_own on public.mobility_assessments;
create policy mobility_assessments_update_own
  on public.mobility_assessments for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists mobility_assessments_delete_own on public.mobility_assessments;
create policy mobility_assessments_delete_own
  on public.mobility_assessments for delete to authenticated
  using (auth.uid() = user_id);

revoke all on table public.mobility_assessments from public;
revoke all on table public.mobility_assessments from anon;
grant select, insert, update, delete on table public.mobility_assessments to authenticated;
grant all on table public.mobility_assessments to service_role;
