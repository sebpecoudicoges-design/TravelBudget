-- Qualify campaign_id against the result row; the previous policy expression
-- was normalized as a tautology by PostgreSQL name resolution.
drop policy if exists app_test_results_insert_own on public.app_test_results;
create policy app_test_results_insert_own on public.app_test_results
for insert to authenticated
with check (
  app_test_results.user_id = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and lower(coalesce(p.role, '')) in ('admin', 'test')
  )
  and exists (
    select 1 from public.app_test_scenarios s
    where s.id = app_test_results.scenario_id
      and s.campaign_id = app_test_results.campaign_id
      and s.closed_at is null
  )
);

drop policy if exists app_test_results_update_own on public.app_test_results;
create policy app_test_results_update_own on public.app_test_results
for update to authenticated
using (
  app_test_results.user_id = (select auth.uid())
  and exists (
    select 1 from public.app_test_scenarios s
    where s.id = app_test_results.scenario_id and s.closed_at is null
  )
)
with check (
  app_test_results.user_id = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and lower(coalesce(p.role, '')) in ('admin', 'test')
  )
  and exists (
    select 1 from public.app_test_scenarios s
    where s.id = app_test_results.scenario_id
      and s.campaign_id = app_test_results.campaign_id
      and s.closed_at is null
  )
);
