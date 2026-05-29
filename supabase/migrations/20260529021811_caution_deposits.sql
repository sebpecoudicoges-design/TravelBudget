create table if not exists public.caution_deposits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  travel_id uuid references public.travels(id) on delete set null,
  label text not null,
  counterparty text,
  amount numeric not null check (amount >= 0),
  currency text not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  paid_date date,
  expected_return_date date,
  returned_date date,
  returned_amount numeric check (returned_amount is null or returned_amount >= 0),
  status text not null default 'held' check (status in ('held', 'partial', 'returned', 'lost')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.caution_deposits enable row level security;

create index if not exists caution_deposits_user_created_idx
  on public.caution_deposits (user_id, created_at desc);

create index if not exists caution_deposits_user_status_idx
  on public.caution_deposits (user_id, status);

create index if not exists caution_deposits_travel_idx
  on public.caution_deposits (travel_id);

drop policy if exists caution_deposits_select_own on public.caution_deposits;
create policy caution_deposits_select_own
  on public.caution_deposits
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists caution_deposits_insert_own on public.caution_deposits;
create policy caution_deposits_insert_own
  on public.caution_deposits
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists caution_deposits_update_own on public.caution_deposits;
create policy caution_deposits_update_own
  on public.caution_deposits
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists caution_deposits_delete_own on public.caution_deposits;
create policy caution_deposits_delete_own
  on public.caution_deposits
  for delete
  to authenticated
  using (auth.uid() = user_id);

revoke all on table public.caution_deposits from anon;
grant select, insert, update, delete on table public.caution_deposits to authenticated;
grant all on table public.caution_deposits to service_role;
