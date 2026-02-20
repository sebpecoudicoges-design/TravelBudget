-- Travel Budget - schema versioning (optional but recommended)
-- Apply in Supabase SQL editor.

create table if not exists public.schema_version (
  key text primary key,
  version integer not null,
  updated_at timestamptz not null default now()
);

-- Initialize
insert into public.schema_version (key, version)
values ('travel_budget', 1)
on conflict (key) do nothing;
