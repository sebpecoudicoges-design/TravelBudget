create table if not exists public.nutrition_sleep (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sleep_date date not null,
  hours numeric(4,2) not null,
  quality text not null default 'ok',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nutrition_sleep_user_date_unique unique (user_id, sleep_date),
  constraint nutrition_sleep_hours_chk check (hours >= 0 and hours <= 14),
  constraint nutrition_sleep_quality_chk check (quality in ('bad','ok','good'))
);

create index if not exists nutrition_sleep_user_date_idx
  on public.nutrition_sleep(user_id, sleep_date desc);

alter table public.nutrition_sleep enable row level security;

drop policy if exists nutrition_sleep_select_own on public.nutrition_sleep;
create policy nutrition_sleep_select_own
  on public.nutrition_sleep for select to authenticated
  using (user_id = auth.uid());

drop policy if exists nutrition_sleep_insert_own on public.nutrition_sleep;
create policy nutrition_sleep_insert_own
  on public.nutrition_sleep for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists nutrition_sleep_update_own on public.nutrition_sleep;
create policy nutrition_sleep_update_own
  on public.nutrition_sleep for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists nutrition_sleep_delete_own on public.nutrition_sleep;
create policy nutrition_sleep_delete_own
  on public.nutrition_sleep for delete to authenticated
  using (user_id = auth.uid());

revoke all on table public.nutrition_sleep from public;
revoke all on table public.nutrition_sleep from anon;
grant select, insert, update, delete on table public.nutrition_sleep to authenticated;
grant all on table public.nutrition_sleep to service_role;
