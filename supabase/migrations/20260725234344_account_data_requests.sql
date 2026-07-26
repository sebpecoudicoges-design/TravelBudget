create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'cancelled', 'processing', 'completed', 'failed')),
  requested_at timestamptz not null default now(),
  execute_after timestamptz not null default (now() + interval '7 days'),
  cancelled_at timestamptz,
  processing_started_at timestamptz,
  completed_at timestamptz,
  failure_reason text,
  requested_from text not null default 'app'
    check (requested_from in ('app', 'web', 'admin')),
  export_requested boolean not null default false,
  updated_at timestamptz not null default now()
);

create unique index if not exists account_deletion_requests_one_active_user
  on public.account_deletion_requests (user_id)
  where status in ('pending', 'processing');

create index if not exists account_deletion_requests_due_idx
  on public.account_deletion_requests (status, execute_after)
  where status = 'pending';

alter table public.account_deletion_requests enable row level security;

revoke all on table public.account_deletion_requests from anon, authenticated;
grant select, insert, update, delete on table public.account_deletion_requests to service_role;

comment on table public.account_deletion_requests is
  'Server-managed account deletion queue. Direct browser access is intentionally revoked.';
