-- The 10.5.342 modal interaction retest exposed a deeper projection issue.
-- Close that UI-focused step globally and keep the functional retest in lineage.
update public.app_test_scenarios
set closed_at = coalesce(closed_at, now()),
    closed_version = coalesce(closed_version, '10.5.343'),
    closure_notes = coalesce(
      closure_notes,
      'Teste le 15/08/2026 puis traite le 15/08/2026. Les champs de la modale restaient interactifs et la cadence etait bien enregistree, mais les anciennes projections n etaient pas reconciliees et une echeance personnalisee pouvait encore etre ecrasee. Le retest fonctionnel enfant couvre ces deux ecarts.'
    )
where id = '34200000-0000-4000-8000-000000000003'::uuid;

insert into public.app_test_scenarios (
  id, campaign_id, module_id, parent_scenario_id, title, instructions,
  expected_result, required, sort_order
)
select
  '34300000-0000-4000-8000-000000000001'::uuid,
  parent.campaign_id,
  parent.module_id,
  parent.id,
  'Retest reconciliation des regles recurrentes 10.5.343',
  'Dans Settings, modifie d abord une echeance future generee sans la marquer payee, par exemple sa date ou son montant. Modifie ensuite sa regle : choisis toutes les 2 semaines, jeudi, avec un debut un lundi, puis raccourcis au besoin la date de fin pour retirer une ancienne echeance.',
  'L echeance personnalisee reste strictement inchangee et devient independante de la regle. Toutes les autres projections obsoletes disparaissent. Avec un debut le lundi 17/08/2026, les nouvelles dates commencent le jeudi 20/08 puis continuent les 03/09, 17/09, etc., jamais chaque lundi ni chaque semaine.',
  true,
  6
from public.app_test_scenarios parent
where parent.id = '34200000-0000-4000-8000-000000000003'::uuid
on conflict (id) do update set
  parent_scenario_id = excluded.parent_scenario_id,
  title = excluded.title,
  instructions = excluded.instructions,
  expected_result = excluded.expected_result,
  required = excluded.required,
  sort_order = excluded.sort_order,
  closed_at = null,
  closed_by = null,
  closed_version = null,
  closure_notes = null;

update public.app_test_campaigns
set app_version = '10.5.343', updated_at = now()
where id = '20000000-0000-4000-8000-000000000001'::uuid;
