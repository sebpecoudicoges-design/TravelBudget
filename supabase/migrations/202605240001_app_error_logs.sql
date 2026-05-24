create table if not exists public.app_error_logs (
  id text primary key,
  user_id uuid references auth.users(id) on delete set null,
  email text,
  version text,
  build_label text,
  platform text,
  view text,
  url text,
  online boolean not null default true,
  offline boolean not null default false,
  type text not null,
  severity text not null default 'error',
  section text,
  message text not null,
  stack text,
  filename text,
  lineno integer,
  colno integer,
  user_agent text,
  device jsonb not null default '{}'::jsonb,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.app_error_logs enable row level security;

create index if not exists app_error_logs_user_created_idx
  on public.app_error_logs (user_id, created_at desc);

create index if not exists app_error_logs_created_idx
  on public.app_error_logs (created_at desc);

drop policy if exists "Users can insert own error logs" on public.app_error_logs;
create policy "Users can insert own error logs"
  on public.app_error_logs
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can read own error logs" on public.app_error_logs;
create policy "Users can read own error logs"
  on public.app_error_logs
  for select
  to authenticated
  using (auth.uid() = user_id);

grant insert, select on public.app_error_logs to authenticated;
