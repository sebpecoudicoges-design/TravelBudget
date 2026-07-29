alter table public.trip_expenses
  add column if not exists kind text not null default 'expense';

alter table public.trip_expenses
  add column if not exists income_source text not null default 'external';

alter table public.trip_expenses
  add column if not exists income_due_back boolean not null default true;

alter table public.trip_expenses
  drop constraint if exists trip_expenses_kind_chk;

alter table public.trip_expenses
  add constraint trip_expenses_kind_chk
  check (kind in ('expense', 'income')) not valid;

alter table public.trip_expenses
  drop constraint if exists trip_expenses_income_source_chk;

alter table public.trip_expenses
  add constraint trip_expenses_income_source_chk
  check (income_source in ('external', 'participant')) not valid;

alter table public.trip_expenses
  validate constraint trip_expenses_kind_chk;

alter table public.trip_expenses
  validate constraint trip_expenses_income_source_chk;

create index if not exists trip_expenses_trip_kind_date_idx
  on public.trip_expenses(trip_id, kind, date desc);
