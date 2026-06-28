alter table public.assets
  add column if not exists include_in_budget boolean not null default true,
  add column if not exists budget_method text not null default 'linear',
  add column if not exists monthly_budget_override numeric(14,2),
  add column if not exists budget_start_date date,
  add column if not exists budget_end_date date,
  add column if not exists budget_day smallint,
  add column if not exists budget_category text not null default 'Patrimoine',
  add column if not exists budget_subcategory text not null default 'Amortissement';

update public.assets
set budget_start_date = coalesce(budget_start_date, purchase_date),
    budget_day = coalesce(budget_day, extract(day from purchase_date)::smallint)
where budget_start_date is null or budget_day is null;

alter table public.assets drop constraint if exists assets_budget_method_chk;
alter table public.assets add constraint assets_budget_method_chk
  check (budget_method in ('linear', 'manual'));
alter table public.assets drop constraint if exists assets_monthly_budget_override_chk;
alter table public.assets add constraint assets_monthly_budget_override_chk
  check (monthly_budget_override is null or monthly_budget_override >= 0);
alter table public.assets drop constraint if exists assets_budget_day_chk;
alter table public.assets add constraint assets_budget_day_chk
  check (budget_day is null or budget_day between 1 and 31);
alter table public.assets drop constraint if exists assets_budget_dates_chk;
alter table public.assets add constraint assets_budget_dates_chk
  check (budget_end_date is null or budget_start_date is null or budget_end_date >= budget_start_date);

create table if not exists public.work_engagements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  travel_id uuid references public.travels(id) on delete set null,
  name text not null,
  employer text,
  role_title text,
  location text,
  start_date date not null,
  end_date date,
  currency text not null default 'AUD',
  color text not null default '#0ea5e9',
  status text not null default 'active',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint work_engagements_dates_chk check (end_date is null or end_date >= start_date),
  constraint work_engagements_currency_chk check (currency ~ '^[A-Z]{3}$'),
  constraint work_engagements_status_chk check (status in ('active','completed','paused','draft'))
);

create index if not exists work_engagements_user_dates_idx
  on public.work_engagements(user_id, start_date desc, end_date);

create table if not exists public.work_income_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  engagement_id uuid references public.work_engagements(id) on delete cascade,
  received_date date not null,
  period_start date,
  period_end date,
  net_amount numeric(14,2) not null default 0,
  gross_amount numeric(14,2),
  currency text not null default 'AUD',
  income_type text not null default 'salary',
  transaction_id uuid references public.transactions(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint work_income_events_amount_chk check (net_amount >= 0 and (gross_amount is null or gross_amount >= 0)),
  constraint work_income_events_dates_chk check (period_end is null or period_start is null or period_end >= period_start),
  constraint work_income_events_currency_chk check (currency ~ '^[A-Z]{3}$'),
  constraint work_income_events_type_chk check (income_type in ('salary','bonus','unemployment_benefit','other'))
);

create index if not exists work_income_events_user_received_idx
  on public.work_income_events(user_id, received_date desc);
create index if not exists work_income_events_engagement_idx
  on public.work_income_events(engagement_id, received_date desc);

create table if not exists public.work_status_periods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  engagement_id uuid references public.work_engagements(id) on delete set null,
  status_type text not null default 'unemployment',
  label text not null default 'Chomage',
  start_date date not null,
  end_date date,
  color text not null default '#94a3b8',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint work_status_periods_dates_chk check (end_date is null or end_date >= start_date),
  constraint work_status_periods_type_chk check (status_type in ('unemployment','leave','training','other'))
);

create index if not exists work_status_periods_user_dates_idx
  on public.work_status_periods(user_id, start_date desc, end_date);

create table if not exists public.work_document_folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  engagement_id uuid not null references public.work_engagements(id) on delete cascade,
  folder_id uuid not null references public.document_folders(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (engagement_id, folder_id)
);

create index if not exists work_document_folders_user_idx
  on public.work_document_folders(user_id, engagement_id);

alter table public.work_days
  add column if not exists engagement_id uuid references public.work_engagements(id) on delete set null;
create index if not exists work_days_engagement_date_idx
  on public.work_days(engagement_id, work_date desc);

alter table public.work_engagements enable row level security;
alter table public.work_income_events enable row level security;
alter table public.work_status_periods enable row level security;
alter table public.work_document_folders enable row level security;

drop policy if exists work_engagements_own on public.work_engagements;
create policy work_engagements_own on public.work_engagements
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists work_income_events_own on public.work_income_events;
create policy work_income_events_own on public.work_income_events
  for all to authenticated
  using ((select auth.uid()) = user_id
    and (engagement_id is null or exists (
      select 1 from public.work_engagements e
      where e.id = engagement_id and e.user_id = (select auth.uid())
    )))
  with check ((select auth.uid()) = user_id
    and (engagement_id is null or exists (
      select 1 from public.work_engagements e
      where e.id = engagement_id and e.user_id = (select auth.uid())
    )));

drop policy if exists work_status_periods_own on public.work_status_periods;
create policy work_status_periods_own on public.work_status_periods
  for all to authenticated
  using ((select auth.uid()) = user_id
    and (engagement_id is null or exists (
      select 1 from public.work_engagements e
      where e.id = engagement_id and e.user_id = (select auth.uid())
    )))
  with check ((select auth.uid()) = user_id
    and (engagement_id is null or exists (
      select 1 from public.work_engagements e
      where e.id = engagement_id and e.user_id = (select auth.uid())
    )));

drop policy if exists work_document_folders_own on public.work_document_folders;
create policy work_document_folders_own on public.work_document_folders
  for all to authenticated
  using ((select auth.uid()) = user_id
    and exists (
      select 1 from public.work_engagements e
      where e.id = engagement_id and e.user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.document_folders f
      where f.id = folder_id and f.user_id = (select auth.uid())
    ))
  with check ((select auth.uid()) = user_id
    and exists (
      select 1 from public.work_engagements e
      where e.id = engagement_id and e.user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.document_folders f
      where f.id = folder_id and f.user_id = (select auth.uid())
    ));

revoke all on table public.work_engagements from public, anon, authenticated;
revoke all on table public.work_income_events from public, anon, authenticated;
revoke all on table public.work_status_periods from public, anon, authenticated;
revoke all on table public.work_document_folders from public, anon, authenticated;
grant select, insert, update, delete on table public.work_engagements to authenticated;
grant select, insert, update, delete on table public.work_income_events to authenticated;
grant select, insert, update, delete on table public.work_status_periods to authenticated;
grant select, insert, update, delete on table public.work_document_folders to authenticated;
grant all on table public.work_engagements to service_role;
grant all on table public.work_income_events to service_role;
grant all on table public.work_status_periods to service_role;
grant all on table public.work_document_folders to service_role;

comment on column public.assets.include_in_budget is 'Adds virtual monthly asset cost to budget analysis only; never mutates wallet cashflow.';
comment on table public.work_engagements is 'Jobs and missions used by the professional work timeline.';
comment on table public.work_income_events is 'Net amounts received for a job or unemployment period, optionally linked to a real transaction.';
comment on table public.work_status_periods is 'Overlapping employment-status periods such as unemployment, leave or training.';
comment on table public.work_document_folders is 'Links one or more Document Hub folders to a work engagement.';
