create table if not exists public.mobile_notification_campaigns (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 120),
  body text not null check (char_length(trim(body)) between 1 and 500),
  target text not null default 'all' check (target in ('all', 'admins', 'test')),
  status text not null default 'draft' check (status in ('draft', 'ready', 'sent', 'archived')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  scheduled_at timestamptz,
  sent_at timestamptz
);

alter table public.mobile_notification_campaigns enable row level security;

create or replace function public.is_current_user_admin()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and lower(coalesce(p.role, '')) = 'admin'
  );
$$;

create policy "mobile_notification_campaigns_admin_select"
  on public.mobile_notification_campaigns
  for select
  to authenticated
  using (public.is_current_user_admin());

create policy "mobile_notification_campaigns_admin_insert"
  on public.mobile_notification_campaigns
  for insert
  to authenticated
  with check (public.is_current_user_admin() and created_by = auth.uid());

create policy "mobile_notification_campaigns_admin_update"
  on public.mobile_notification_campaigns
  for update
  to authenticated
  using (public.is_current_user_admin())
  with check (public.is_current_user_admin());

create policy "mobile_notification_campaigns_admin_delete"
  on public.mobile_notification_campaigns
  for delete
  to authenticated
  using (public.is_current_user_admin());

create index if not exists mobile_notification_campaigns_created_at_idx
  on public.mobile_notification_campaigns (created_at desc);

create index if not exists mobile_notification_campaigns_status_idx
  on public.mobile_notification_campaigns (status);

grant select, insert, update, delete on table public.mobile_notification_campaigns to authenticated;
grant all on table public.mobile_notification_campaigns to service_role;
grant execute on function public.is_current_user_admin() to authenticated;
grant execute on function public.is_current_user_admin() to service_role;
