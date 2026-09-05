-- Nutrition cooking V1: recipes, real cooking batches and consumed portions.
-- This extends the existing food library without overwriting foods. Recipe
-- batches keep snapshots so historical meals do not change when the library or
-- transformation factors are updated later.

create table if not exists public.nutrition_cooking_methods (
  code text primary key,
  label_fr text not null,
  label_en text not null,
  heat_type text not null default 'none',
  uses_water boolean not null default false,
  uses_fat boolean not null default false,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nutrition_cooking_methods_code_chk check (length(trim(code)) > 0)
);

insert into public.nutrition_cooking_methods (code, label_fr, label_en, heat_type, uses_water, uses_fat, description)
values
  ('raw', 'Cru / non cuit', 'Raw / uncooked', 'none', false, false, 'No cooking transformation.'),
  ('boiled', 'Bouilli', 'Boiled', 'wet', true, false, 'Cooked in water; drained or retained liquid must be explicit in the batch.'),
  ('steamed', 'Vapeur', 'Steamed', 'wet', true, false, 'Cooked with steam.'),
  ('roasted', 'Roti', 'Roasted', 'dry', false, false, 'Dry oven roasting.'),
  ('baked', 'Four', 'Baked', 'dry', false, false, 'Baked in oven.'),
  ('grilled', 'Grille', 'Grilled', 'dry', false, false, 'Direct dry heat.'),
  ('pan_fried', 'Poele', 'Pan fried', 'dry_fat', false, true, 'Pan cooking; absorbed or lost fat should be explicit.'),
  ('deep_fried', 'Friture', 'Deep fried', 'fat', false, true, 'Deep-fried cooking.'),
  ('stewed', 'Mijote', 'Stewed', 'wet', true, false, 'Liquid is usually retained in the dish.'),
  ('braised', 'Braise', 'Braised', 'wet', true, false, 'Mixed dry/wet cooking.'),
  ('microwaved', 'Micro-ondes', 'Microwaved', 'dry', false, false, 'Microwave cooking.'),
  ('pressure_cooked', 'Cuisson pression', 'Pressure cooked', 'wet', true, false, 'Pressure cooking.')
on conflict (code) do update
set label_fr = excluded.label_fr,
    label_en = excluded.label_en,
    heat_type = excluded.heat_type,
    uses_water = excluded.uses_water,
    uses_fat = excluded.uses_fat,
    description = excluded.description,
    updated_at = now();

create table if not exists public.nutrition_food_transformations (
  id uuid primary key default gen_random_uuid(),
  food_key text references public.nutrition_foods(key) on delete cascade,
  food_category text,
  initial_state text not null default 'raw',
  cooked_state text,
  cooking_method_code text not null references public.nutrition_cooking_methods(code) on delete restrict,
  yield_factor numeric,
  factor_scope text not null default 'none',
  confidence text not null default 'estimated',
  source_type text,
  source_reference text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nutrition_food_transformations_scope_chk check (factor_scope in ('exact_food','food_category','generic_method','none')),
  constraint nutrition_food_transformations_confidence_chk check (confidence in ('measured','reference','estimated','generic')),
  constraint nutrition_food_transformations_yield_chk check (yield_factor is null or yield_factor > 0),
  constraint nutrition_food_transformations_target_chk check (food_key is not null or food_category is not null)
);

create index if not exists nutrition_food_transformations_food_method_idx
  on public.nutrition_food_transformations(food_key, cooking_method_code, factor_scope);

create table if not exists public.nutrition_food_transformation_retention (
  id uuid primary key default gen_random_uuid(),
  transformation_id uuid not null references public.nutrition_food_transformations(id) on delete cascade,
  nutrient_code text not null,
  retention_factor numeric not null,
  source_type text,
  source_reference text,
  created_at timestamptz not null default now(),
  constraint nutrition_food_transformation_retention_unique unique (transformation_id, nutrient_code),
  constraint nutrition_food_transformation_retention_factor_chk check (retention_factor >= 0 and retention_factor <= 1.5)
);

create table if not exists public.nutrition_recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  default_servings integer not null default 1,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nutrition_recipes_name_chk check (length(trim(name)) > 0),
  constraint nutrition_recipes_servings_chk check (default_servings >= 1)
);

create index if not exists nutrition_recipes_user_updated_idx
  on public.nutrition_recipes(user_id, is_archived, updated_at desc);

create table if not exists public.nutrition_recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.nutrition_recipes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  food_key text references public.nutrition_foods(key) on delete set null,
  label text not null,
  quantity numeric not null default 0,
  unit text not null default 'g',
  quantity_grams numeric not null default 0,
  initial_state text not null default 'raw',
  cooking_method_code text not null default 'raw' references public.nutrition_cooking_methods(code) on delete restrict,
  sort_order integer not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nutrition_recipe_ingredients_quantity_chk check (quantity >= 0 and quantity_grams >= 0)
);

create index if not exists nutrition_recipe_ingredients_recipe_order_idx
  on public.nutrition_recipe_ingredients(recipe_id, sort_order);

create table if not exists public.nutrition_recipe_batches (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid references public.nutrition_recipes(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  cooked_at timestamptz not null default now(),
  name text not null,
  estimated_final_weight_g numeric,
  measured_final_weight_g numeric,
  final_weight_g numeric not null default 0,
  final_weight_source text not null default 'estimated',
  servings integer not null default 1,
  precision_level text not null default 'estimated',
  total_kcal numeric not null default 0,
  total_protein_g numeric not null default 0,
  total_carbs_g numeric not null default 0,
  total_fat_g numeric not null default 0,
  total_fiber_g numeric not null default 0,
  per_100g_snapshot jsonb not null default '{}'::jsonb,
  per_serving_snapshot jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nutrition_recipe_batches_name_chk check (length(trim(name)) > 0),
  constraint nutrition_recipe_batches_weight_chk check (final_weight_g >= 0 and (estimated_final_weight_g is null or estimated_final_weight_g >= 0) and (measured_final_weight_g is null or measured_final_weight_g >= 0)),
  constraint nutrition_recipe_batches_servings_chk check (servings >= 1),
  constraint nutrition_recipe_batches_weight_source_chk check (final_weight_source in ('measured','estimated','none')),
  constraint nutrition_recipe_batches_precision_chk check (precision_level in ('measured','reference','estimated','generic'))
);

create index if not exists nutrition_recipe_batches_user_cooked_idx
  on public.nutrition_recipe_batches(user_id, cooked_at desc);

create table if not exists public.nutrition_recipe_batch_ingredients (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.nutrition_recipe_batches(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  food_key text references public.nutrition_foods(key) on delete set null,
  label text not null,
  initial_weight_g numeric not null default 0,
  initial_state text not null default 'raw',
  cooking_method_code text not null default 'raw' references public.nutrition_cooking_methods(code) on delete restrict,
  nutrition_snapshot jsonb not null default '{}'::jsonb,
  yield_factor_used numeric,
  yield_source_used text,
  retention_factors_used jsonb not null default '{}'::jsonb,
  estimated_cooked_weight_g numeric,
  measured_cooked_weight_g numeric,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint nutrition_recipe_batch_ingredients_weight_chk check (initial_weight_g >= 0 and (yield_factor_used is null or yield_factor_used > 0) and (estimated_cooked_weight_g is null or estimated_cooked_weight_g >= 0) and (measured_cooked_weight_g is null or measured_cooked_weight_g >= 0))
);

create index if not exists nutrition_recipe_batch_ingredients_batch_order_idx
  on public.nutrition_recipe_batch_ingredients(batch_id, sort_order);

create table if not exists public.nutrition_recipe_batch_consumptions (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.nutrition_recipe_batches(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  meal_id uuid references public.nutrition_meals(id) on delete set null,
  consumed_at timestamptz not null default now(),
  consumed_weight_g numeric not null default 0,
  nutrition_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint nutrition_recipe_batch_consumptions_weight_chk check (consumed_weight_g >= 0)
);

create index if not exists nutrition_recipe_batch_consumptions_batch_idx
  on public.nutrition_recipe_batch_consumptions(batch_id, consumed_at desc);

alter table public.nutrition_cooking_methods enable row level security;
alter table public.nutrition_food_transformations enable row level security;
alter table public.nutrition_food_transformation_retention enable row level security;
alter table public.nutrition_recipes enable row level security;
alter table public.nutrition_recipe_ingredients enable row level security;
alter table public.nutrition_recipe_batches enable row level security;
alter table public.nutrition_recipe_batch_ingredients enable row level security;
alter table public.nutrition_recipe_batch_consumptions enable row level security;

drop policy if exists nutrition_cooking_methods_public_read on public.nutrition_cooking_methods;
create policy nutrition_cooking_methods_public_read on public.nutrition_cooking_methods
  for select to anon, authenticated using (true);

drop policy if exists nutrition_food_transformations_public_read on public.nutrition_food_transformations;
create policy nutrition_food_transformations_public_read on public.nutrition_food_transformations
  for select to anon, authenticated using (true);

drop policy if exists nutrition_food_transformation_retention_public_read on public.nutrition_food_transformation_retention;
create policy nutrition_food_transformation_retention_public_read on public.nutrition_food_transformation_retention
  for select to anon, authenticated using (true);

drop policy if exists nutrition_recipes_own on public.nutrition_recipes;
create policy nutrition_recipes_own on public.nutrition_recipes
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists nutrition_recipe_ingredients_own on public.nutrition_recipe_ingredients;
create policy nutrition_recipe_ingredients_own on public.nutrition_recipe_ingredients
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists nutrition_recipe_batches_own on public.nutrition_recipe_batches;
create policy nutrition_recipe_batches_own on public.nutrition_recipe_batches
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists nutrition_recipe_batch_ingredients_own on public.nutrition_recipe_batch_ingredients;
create policy nutrition_recipe_batch_ingredients_own on public.nutrition_recipe_batch_ingredients
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists nutrition_recipe_batch_consumptions_own on public.nutrition_recipe_batch_consumptions;
create policy nutrition_recipe_batch_consumptions_own on public.nutrition_recipe_batch_consumptions
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on table
  public.nutrition_cooking_methods,
  public.nutrition_food_transformations,
  public.nutrition_food_transformation_retention,
  public.nutrition_recipes,
  public.nutrition_recipe_ingredients,
  public.nutrition_recipe_batches,
  public.nutrition_recipe_batch_ingredients,
  public.nutrition_recipe_batch_consumptions
from public, anon, authenticated;

grant select on table
  public.nutrition_cooking_methods,
  public.nutrition_food_transformations,
  public.nutrition_food_transformation_retention
to anon, authenticated;

grant select, insert, update, delete on table
  public.nutrition_recipes,
  public.nutrition_recipe_ingredients,
  public.nutrition_recipe_batches,
  public.nutrition_recipe_batch_ingredients,
  public.nutrition_recipe_batch_consumptions
to authenticated;

grant all on table
  public.nutrition_cooking_methods,
  public.nutrition_food_transformations,
  public.nutrition_food_transformation_retention,
  public.nutrition_recipes,
  public.nutrition_recipe_ingredients,
  public.nutrition_recipe_batches,
  public.nutrition_recipe_batch_ingredients,
  public.nutrition_recipe_batch_consumptions
to service_role;
