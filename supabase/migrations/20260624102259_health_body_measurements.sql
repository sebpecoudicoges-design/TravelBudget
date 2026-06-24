create table if not exists public.health_body_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  measured_on date not null default current_date,
  source text not null default 'impedance_scale',
  weight_kg numeric(6,2),
  body_fat_pct numeric(5,2),
  muscle_mass_kg numeric(6,2),
  body_water_pct numeric(5,2),
  bone_mass_kg numeric(5,2),
  visceral_fat_rating numeric(5,2),
  bmr_kcal integer,
  metabolic_age integer,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint health_body_measurements_user_day_source_unique unique (user_id, measured_on, source),
  constraint health_body_measurements_weight_chk check (weight_kg is null or (weight_kg >= 20 and weight_kg <= 350)),
  constraint health_body_measurements_body_fat_chk check (body_fat_pct is null or (body_fat_pct >= 2 and body_fat_pct <= 70)),
  constraint health_body_measurements_muscle_chk check (muscle_mass_kg is null or (muscle_mass_kg >= 5 and muscle_mass_kg <= 200)),
  constraint health_body_measurements_water_chk check (body_water_pct is null or (body_water_pct >= 20 and body_water_pct <= 80)),
  constraint health_body_measurements_bone_chk check (bone_mass_kg is null or (bone_mass_kg >= 0.5 and bone_mass_kg <= 20)),
  constraint health_body_measurements_visceral_chk check (visceral_fat_rating is null or (visceral_fat_rating >= 1 and visceral_fat_rating <= 60)),
  constraint health_body_measurements_bmr_chk check (bmr_kcal is null or (bmr_kcal >= 600 and bmr_kcal <= 6000)),
  constraint health_body_measurements_age_chk check (metabolic_age is null or (metabolic_age >= 10 and metabolic_age <= 120))
);

create index if not exists health_body_measurements_user_date_idx
  on public.health_body_measurements(user_id, measured_on desc);

alter table public.health_body_measurements enable row level security;

drop policy if exists health_body_measurements_select_own on public.health_body_measurements;
create policy health_body_measurements_select_own
  on public.health_body_measurements for select to authenticated
  using (user_id = auth.uid());

drop policy if exists health_body_measurements_insert_own on public.health_body_measurements;
create policy health_body_measurements_insert_own
  on public.health_body_measurements for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists health_body_measurements_update_own on public.health_body_measurements;
create policy health_body_measurements_update_own
  on public.health_body_measurements for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists health_body_measurements_delete_own on public.health_body_measurements;
create policy health_body_measurements_delete_own
  on public.health_body_measurements for delete to authenticated
  using (user_id = auth.uid());

revoke all on table public.health_body_measurements from public;
revoke all on table public.health_body_measurements from anon;
grant select, insert, update, delete on table public.health_body_measurements to authenticated;
grant all on table public.health_body_measurements to service_role;
