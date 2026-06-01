create table if not exists public.mobile_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null,
  platform text not null default 'android',
  device_label text,
  app_version text,
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (token)
);

alter table public.mobile_push_tokens enable row level security;

create policy "mobile_push_tokens_select_own"
on public.mobile_push_tokens
for select
to authenticated
using (user_id = auth.uid());

create policy "mobile_push_tokens_insert_own"
on public.mobile_push_tokens
for insert
to authenticated
with check (user_id = auth.uid());

create policy "mobile_push_tokens_update_own"
on public.mobile_push_tokens
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create index if not exists mobile_push_tokens_user_active_idx
on public.mobile_push_tokens(user_id, revoked_at, last_seen_at desc);

revoke all on table public.mobile_push_tokens from public;
grant select, insert, update on table public.mobile_push_tokens to authenticated;
grant all on table public.mobile_push_tokens to service_role;

comment on table public.mobile_push_tokens is
  'FCM/APNS mobile push tokens registered by authenticated mobile apps.';
