create table if not exists public.nutrition_foods (
  key text primary key,
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  brand text,
  serving_grams numeric not null default 100,
  kcal_per_100g numeric not null default 0,
  protein_per_100g numeric not null default 0,
  carbs_per_100g numeric not null default 0,
  fat_per_100g numeric not null default 0,
  fiber_per_100g numeric not null default 0,
  water_ml_per_100g numeric not null default 0,
  tags text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nutrition_foods_serving_grams_chk check (serving_grams > 0),
  constraint nutrition_foods_kcal_chk check (kcal_per_100g >= 0),
  constraint nutrition_foods_protein_chk check (protein_per_100g >= 0),
  constraint nutrition_foods_carbs_chk check (carbs_per_100g >= 0),
  constraint nutrition_foods_fat_chk check (fat_per_100g >= 0),
  constraint nutrition_foods_fiber_chk check (fiber_per_100g >= 0),
  constraint nutrition_foods_water_chk check (water_ml_per_100g >= 0)
);

create index if not exists nutrition_foods_user_name_idx
  on public.nutrition_foods(user_id, name)
  where is_active;

alter table public.nutrition_foods enable row level security;

drop policy if exists nutrition_foods_select_library_or_own on public.nutrition_foods;
create policy nutrition_foods_select_library_or_own
  on public.nutrition_foods
  for select
  to anon, authenticated
  using (is_active = true and (user_id is null or user_id = auth.uid()));

drop policy if exists nutrition_foods_insert_own on public.nutrition_foods;
create policy nutrition_foods_insert_own
  on public.nutrition_foods
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists nutrition_foods_update_own on public.nutrition_foods;
create policy nutrition_foods_update_own
  on public.nutrition_foods
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists nutrition_foods_delete_own on public.nutrition_foods;
create policy nutrition_foods_delete_own
  on public.nutrition_foods
  for delete
  to authenticated
  using (user_id = auth.uid());

revoke all on table public.nutrition_foods from public;
revoke all on table public.nutrition_foods from anon;
revoke all on table public.nutrition_foods from authenticated;
grant select on table public.nutrition_foods to anon, authenticated;
grant insert, update, delete on table public.nutrition_foods to authenticated;
grant all on table public.nutrition_foods to service_role;

create table if not exists public.nutrition_meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  travel_id uuid references public.travels(id) on delete set null,
  meal_date date not null default current_date,
  meal_type text not null default 'meal',
  label text,
  notes text,
  water_ml numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nutrition_meals_meal_type_chk check (meal_type in ('breakfast','lunch','dinner','snack','meal')),
  constraint nutrition_meals_water_ml_chk check (water_ml >= 0)
);

create index if not exists nutrition_meals_user_date_idx
  on public.nutrition_meals(user_id, meal_date desc, meal_type);

alter table public.nutrition_meals enable row level security;

drop policy if exists nutrition_meals_select_own on public.nutrition_meals;
create policy nutrition_meals_select_own on public.nutrition_meals for select to authenticated using (user_id = auth.uid());
drop policy if exists nutrition_meals_insert_own on public.nutrition_meals;
create policy nutrition_meals_insert_own on public.nutrition_meals for insert to authenticated with check (user_id = auth.uid());
drop policy if exists nutrition_meals_update_own on public.nutrition_meals;
create policy nutrition_meals_update_own on public.nutrition_meals for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists nutrition_meals_delete_own on public.nutrition_meals;
create policy nutrition_meals_delete_own on public.nutrition_meals for delete to authenticated using (user_id = auth.uid());

grant select, insert, update, delete on table public.nutrition_meals to authenticated;
grant all on table public.nutrition_meals to service_role;

create table if not exists public.nutrition_meal_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  meal_id uuid not null references public.nutrition_meals(id) on delete cascade,
  food_key text references public.nutrition_foods(key) on delete set null,
  label text,
  grams numeric not null default 100,
  kcal numeric,
  protein_g numeric,
  carbs_g numeric,
  fat_g numeric,
  fiber_g numeric,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint nutrition_meal_items_grams_chk check (grams >= 0),
  constraint nutrition_meal_items_kcal_chk check (kcal is null or kcal >= 0),
  constraint nutrition_meal_items_protein_chk check (protein_g is null or protein_g >= 0),
  constraint nutrition_meal_items_carbs_chk check (carbs_g is null or carbs_g >= 0),
  constraint nutrition_meal_items_fat_chk check (fat_g is null or fat_g >= 0),
  constraint nutrition_meal_items_fiber_chk check (fiber_g is null or fiber_g >= 0)
);

create index if not exists nutrition_meal_items_meal_order_idx
  on public.nutrition_meal_items(meal_id, sort_order);

alter table public.nutrition_meal_items enable row level security;

drop policy if exists nutrition_meal_items_select_own on public.nutrition_meal_items;
create policy nutrition_meal_items_select_own on public.nutrition_meal_items for select to authenticated using (user_id = auth.uid());
drop policy if exists nutrition_meal_items_insert_own on public.nutrition_meal_items;
create policy nutrition_meal_items_insert_own on public.nutrition_meal_items for insert to authenticated with check (user_id = auth.uid());
drop policy if exists nutrition_meal_items_update_own on public.nutrition_meal_items;
create policy nutrition_meal_items_update_own on public.nutrition_meal_items for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists nutrition_meal_items_delete_own on public.nutrition_meal_items;
create policy nutrition_meal_items_delete_own on public.nutrition_meal_items for delete to authenticated using (user_id = auth.uid());

grant select, insert, update, delete on table public.nutrition_meal_items to authenticated;
grant all on table public.nutrition_meal_items to service_role;

insert into public.nutrition_foods
  (key, user_id, name, serving_grams, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g, water_ml_per_100g, tags)
values
  ('rice_cooked', null, 'Riz cuit', 150, 130, 2.7, 28.0, 0.3, 0.4, 0, array['base','glucides']),
  ('pasta_cooked', null, 'Pates cuites', 150, 157, 5.8, 30.9, 0.9, 1.8, 0, array['base','glucides']),
  ('chicken_breast', null, 'Blanc de poulet', 120, 165, 31.0, 0.0, 3.6, 0.0, 0, array['proteines']),
  ('egg', null, 'Oeuf', 50, 143, 12.6, 0.7, 9.5, 0.0, 0, array['proteines']),
  ('banana', null, 'Banane', 120, 89, 1.1, 22.8, 0.3, 2.6, 0, array['fruit','snack']),
  ('apple', null, 'Pomme', 150, 52, 0.3, 13.8, 0.2, 2.4, 0, array['fruit','snack']),
  ('olive_oil', null, 'Huile olive', 10, 884, 0.0, 0.0, 100.0, 0.0, 0, array['lipides']),
  ('water', null, 'Eau', 250, 0, 0, 0, 0, 0, 100, array['hydratation'])
on conflict (key) do update set
  name = excluded.name,
  serving_grams = excluded.serving_grams,
  kcal_per_100g = excluded.kcal_per_100g,
  protein_per_100g = excluded.protein_per_100g,
  carbs_per_100g = excluded.carbs_per_100g,
  fat_per_100g = excluded.fat_per_100g,
  fiber_per_100g = excluded.fiber_per_100g,
  water_ml_per_100g = excluded.water_ml_per_100g,
  tags = excluded.tags,
  is_active = true,
  updated_at = now();
