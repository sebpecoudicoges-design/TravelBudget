-- Keep Error Bus retries idempotent while preserving per-user isolation.
grant update on table public.app_error_logs to authenticated;

drop policy if exists "Users can update own error logs" on public.app_error_logs;
create policy "Users can update own error logs"
on public.app_error_logs
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

insert into public.app_test_scenarios (
  id, campaign_id, module_id, parent_scenario_id, title, instructions, expected_result, required, sort_order
)
select
  '33600000-0000-4000-8000-000000000001'::uuid,
  parent.campaign_id,
  parent.module_id,
  parent.id,
  'Stabilite web Alimentation 10.5.336',
  'Sur le web, ouvre Alimentation avec plusieurs jours de repas deja saisis. Navigue dans l historique, ajoute un aliment et de l eau, puis change plusieurs fois de module pendant et apres la synchronisation. Surveille aussi la console.',
  'Les commandes restent reactives, la navigation permet toujours de quitter Alimentation, les donnees se synchronisent et aucun flot repetitif de POST app_error_logs en 403 ne remplit la console.',
  true,
  3
from public.app_test_scenarios parent
where parent.id = '3824488c-c550-a004-9212-728caea9540d'::uuid
on conflict (module_id, sort_order) do update set
  parent_scenario_id = excluded.parent_scenario_id,
  title = excluded.title,
  instructions = excluded.instructions,
  expected_result = excluded.expected_result,
  required = excluded.required,
  closed_at = null,
  closed_by = null,
  closed_version = null,
  closure_notes = null;

update public.app_test_campaigns
set app_version = '10.5.336', updated_at = now()
where id = '20000000-0000-4000-8000-000000000001'::uuid;
