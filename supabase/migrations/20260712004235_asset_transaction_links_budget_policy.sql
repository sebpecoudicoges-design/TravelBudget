create table if not exists public.asset_transaction_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete cascade,
  transaction_id uuid references public.transactions(id) on delete set null,
  trip_expense_id uuid references public.trip_expenses(id) on delete set null,
  relation_type text not null default 'purchase',
  exclude_from_budget boolean not null default false,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint asset_transaction_links_target_chk check (transaction_id is not null or trip_expense_id is not null),
  constraint asset_transaction_links_relation_chk check (relation_type in ('purchase','extra_cost','sale','maintenance','insurance','financing','trip_expense','other'))
);

create unique index if not exists asset_transaction_links_asset_tx_uidx
  on public.asset_transaction_links(asset_id, transaction_id)
  where transaction_id is not null;

create unique index if not exists asset_transaction_links_asset_trip_expense_uidx
  on public.asset_transaction_links(asset_id, trip_expense_id)
  where trip_expense_id is not null;

create index if not exists asset_transaction_links_user_asset_idx
  on public.asset_transaction_links(user_id, asset_id, created_at desc);

create index if not exists asset_transaction_links_transaction_idx
  on public.asset_transaction_links(transaction_id)
  where transaction_id is not null;

create index if not exists asset_transaction_links_trip_expense_idx
  on public.asset_transaction_links(trip_expense_id)
  where trip_expense_id is not null;

alter table public.asset_transaction_links enable row level security;

drop policy if exists asset_transaction_links_own on public.asset_transaction_links;
create policy asset_transaction_links_own on public.asset_transaction_links
  for all to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.assets a
      where a.id = asset_id
        and a.user_id = (select auth.uid())
    )
  )
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.assets a
      where a.id = asset_id
        and a.user_id = (select auth.uid())
    )
    and (
      transaction_id is null
      or exists (
        select 1 from public.transactions t
        where t.id = transaction_id
          and t.user_id = (select auth.uid())
      )
    )
    and (
      trip_expense_id is null
      or exists (
        select 1
        from public.trip_expenses e
        join public.trip_members m on m.trip_id = e.trip_id
        where e.id = trip_expense_id
          and m.user_id = (select auth.uid())
      )
    )
  );

revoke all on table public.asset_transaction_links from public, anon, authenticated;
grant select, insert, update, delete on table public.asset_transaction_links to authenticated;
grant all on table public.asset_transaction_links to service_role;

comment on table public.asset_transaction_links is
  'Links one asset to wallet transactions or Trip expenses. Purchase links may exclude the raw acquisition transaction from budget analysis so amortization is not double counted.';

comment on column public.asset_transaction_links.exclude_from_budget is
  'When true, the linked wallet transaction should be kept in cashflow but excluded from daily budget/analysis; extra costs remain independent from amortization.';
