create table if not exists public.mobile_notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  notification_key text not null,
  slot text not null default 'manual',
  sent_for_date date not null default current_date,
  status text not null default 'sent',
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint mobile_notification_deliveries_slot_chk check (slot in ('morning','evening','manual','test')),
  constraint mobile_notification_deliveries_status_chk check (status in ('sent','skipped','failed'))
);

create unique index if not exists mobile_notification_deliveries_user_key_uidx
  on public.mobile_notification_deliveries(user_id, notification_key);

create index if not exists mobile_notification_deliveries_user_date_idx
  on public.mobile_notification_deliveries(user_id, sent_for_date desc, slot);

alter table public.mobile_notification_deliveries enable row level security;

drop policy if exists "mobile_notification_deliveries_select_own" on public.mobile_notification_deliveries;
create policy "mobile_notification_deliveries_select_own"
  on public.mobile_notification_deliveries
  for select
  to authenticated
  using (user_id = auth.uid());

revoke all on table public.mobile_notification_deliveries from public;
revoke all on table public.mobile_notification_deliveries from anon;
revoke all on table public.mobile_notification_deliveries from authenticated;
grant select on table public.mobile_notification_deliveries to authenticated;
grant all on table public.mobile_notification_deliveries to service_role;

create table if not exists public.work_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  travel_id uuid references public.travels(id) on delete set null,
  work_date date not null,
  activity_key text not null default 'farm_harvest_moderate',
  label text not null default 'Travail',
  duration_minutes integer not null default 0,
  break_minutes integer not null default 0,
  met_value numeric(6,2) not null default 4.80,
  body_weight_kg numeric(10,2),
  estimated_kcal numeric(12,2) not null default 0,
  perceived_effort integer,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint work_days_duration_chk check (duration_minutes >= 0),
  constraint work_days_break_chk check (break_minutes >= 0 and break_minutes <= duration_minutes),
  constraint work_days_met_chk check (met_value > 0),
  constraint work_days_body_weight_chk check (body_weight_kg is null or body_weight_kg > 0),
  constraint work_days_kcal_chk check (estimated_kcal >= 0),
  constraint work_days_rpe_chk check (perceived_effort is null or (perceived_effort between 1 and 10))
);

create index if not exists work_days_user_date_idx on public.work_days(user_id, work_date desc);
create index if not exists work_days_travel_date_idx on public.work_days(travel_id, work_date desc);

alter table public.work_days enable row level security;

drop policy if exists "work_days_select_own" on public.work_days;
create policy "work_days_select_own"
  on public.work_days for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "work_days_insert_own" on public.work_days;
create policy "work_days_insert_own"
  on public.work_days for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "work_days_update_own" on public.work_days;
create policy "work_days_update_own"
  on public.work_days for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "work_days_delete_own" on public.work_days;
create policy "work_days_delete_own"
  on public.work_days for delete to authenticated
  using (user_id = auth.uid());

revoke all on table public.work_days from public;
revoke all on table public.work_days from anon;
revoke all on table public.work_days from authenticated;
grant select, insert, update, delete on table public.work_days to authenticated;
grant all on table public.work_days to service_role;

comment on table public.work_days is 'Physical work days tracked separately from sport sessions.';
comment on table public.mobile_notification_deliveries is 'Idempotency log for server-driven mobile notification dispatch.';
