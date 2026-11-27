import { readFileSync } from 'node:fs';

const migration = name => readFileSync(new URL(`../../supabase/migrations/${name}`, import.meta.url), 'utf8');
const id = n => `a4100000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export const [userA, userB, travelA] = [id(1), id(2), id(3)];

// Uses only versioned DDL slices plus synthetic identity and travel fixtures.
export async function loadNutritionAuditFixture(db) {
  await db.exec(`
    create role authenticated; create role anon; create role service_role;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to authenticated, anon;
    create table public.travels(id uuid primary key, user_id uuid not null references auth.users);
    alter table public.travels enable row level security;
    grant select on public.travels to authenticated;
    create policy travel_owner on public.travels for select to authenticated using (user_id = auth.uid());
  `);
  await db.query('insert into auth.users values ($1),($2)', [userA, userB]);
  await db.query('insert into public.travels values ($1,$2)', [travelA, userA]);
  await db.exec(migration('20260611091500_nutrition_foundation.sql'));
  const hydration = migration('20260815011706_nutrition_sections_and_hydration_time_10_5_344.sql');
  await db.exec(hydration.slice(0, hydration.indexOf('update public.app_test_module_reviews')));
  const syncIndex = migration('20260624080119_server_idempotency_sport_health_v2.sql');
  await db.exec(syncIndex.slice(syncIndex.indexOf('alter table public.nutrition_meals'), syncIndex.indexOf('create or replace function public.apply_transaction_v2')));
  const itemIndex = migration('20260625101456_dedupe_exact_nutrition_items.sql');
  await db.exec(itemIndex.slice(itemIndex.indexOf('create unique index if not exists nutrition_meal_items_exact_dedupe_idx')));
  await db.exec(readFileSync(new URL('./atomic-meal.sql', import.meta.url), 'utf8'));
}
