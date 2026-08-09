-- Reopen the finance modules that completed their validation cycle.
update public.app_test_modules
set status = 'open', updated_at = now()
where campaign_id = '20000000-0000-4000-8000-000000000001'::uuid
  and module_key in ('dashboard', 'transactions', 'analysis');

update public.app_test_scenarios
set closed_at = coalesce(closed_at, now()),
    closed_version = coalesce(closed_version, '10.5.328'),
    closure_notes = coalesce(closure_notes, 'Retest valide sans reserve puis clos globalement avant reouverture du module aux comptes standards.')
where id in (
  '32600000-0000-4000-8000-000000000001'::uuid,
  '32700000-0000-4000-8000-000000000001'::uuid,
  '32700000-0000-4000-8000-000000000002'::uuid
);

update public.app_test_results
set treated_at = coalesce(treated_at, now()),
    archived_at = coalesce(archived_at, now()),
    treated_version = coalesce(treated_version, '10.5.328'),
    treatment_notes = coalesce(treatment_notes, 'Retour OK sans note, valide et archive globalement avant reouverture du module.'),
    updated_at = now()
where scenario_id in (
  '32600000-0000-4000-8000-000000000001'::uuid,
  '32700000-0000-4000-8000-000000000001'::uuid,
  '32700000-0000-4000-8000-000000000002'::uuid
)
  and archived_at is null;

update public.app_test_module_reviews
set treated_at = coalesce(treated_at, now()),
    archived_at = coalesce(archived_at, now()),
    treated_version = coalesce(treated_version, '10.5.328'),
    treatment_notes = coalesce(treatment_notes, 'Module valide puis rouvert aux comptes standards en 10.5.328.'),
    updated_at = now()
where module_id in (
  select id from public.app_test_modules
  where campaign_id = '20000000-0000-4000-8000-000000000001'::uuid
    and module_key in ('dashboard', 'transactions', 'analysis')
)
  and archived_at is null;

-- Handle the original Trip note while preserving it as the parent of a focused retest.
update public.app_test_scenarios
set closed_at = coalesce(closed_at, now()),
    closed_version = coalesce(closed_version, '10.5.328'),
    closure_notes = coalesce(closure_notes, 'Moi est selectionne par defaut et un libelle vide recoit une valeur de secours explicite.')
where id = 'bb7a21fa-9fc7-a538-0a5a-2657ed8c80fb'::uuid;

update public.app_test_results
set treated_at = coalesce(treated_at, now()),
    archived_at = coalesce(archived_at, now()),
    treated_version = coalesce(treated_version, '10.5.328'),
    treatment_notes = coalesce(treatment_notes, 'Payeur ou receveur Moi preselectionne. Libelle vide accepte avec Depense partagee ou Entree partagee comme valeur de secours.'),
    updated_at = now()
where scenario_id = 'bb7a21fa-9fc7-a538-0a5a-2657ed8c80fb'::uuid
  and archived_at is null;

insert into public.app_test_scenarios (
  id, campaign_id, module_id, parent_scenario_id, title, instructions,
  expected_result, required, sort_order
)
select
  '32800000-0000-4000-8000-000000000001'::uuid,
  parent.campaign_id,
  parent.module_id,
  parent.id,
  'Retest saisie rapide Trip 10.5.328',
  'Ouvre une nouvelle depense puis une entree partagee. Verifie le participant selectionne et enregistre chaque ligne avec le champ Libelle vide.',
  'Moi est selectionne par defaut. Les deux lignes sont enregistrees sans erreur avec Depense partagee ou Entree partagee comme libelle de secours.',
  true,
  4
from public.app_test_scenarios parent
where parent.id = 'bb7a21fa-9fc7-a538-0a5a-2657ed8c80fb'::uuid
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
set app_version = '10.5.328', updated_at = now()
where id = '20000000-0000-4000-8000-000000000001'::uuid;
