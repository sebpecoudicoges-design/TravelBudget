-- Treat the three Work feedback threads while preserving descendant retests.
with treatments(scenario_id, notes) as (
  values
    ('8239732f-7a9a-6578-6066-291533e7f1b2'::uuid, 'Travail suit maintenant la langue active et le bloc BMR, hors sujet dans ce module, a ete retire.'),
    ('0150ccd6-1c0e-8add-22df-a7e8df50bec4'::uuid, 'Les revenus affichent net, brut et periode et les totaux restent separes par devise sans additionner AUD et EUR.')
)
update public.app_test_scenarios s
set closed_at = coalesce(s.closed_at, now()),
    closed_version = coalesce(s.closed_version, '10.5.333'),
    closure_notes = coalesce(s.closure_notes, treatments.notes)
from treatments
where s.id = treatments.scenario_id;

with treatments(scenario_id, notes) as (
  values
    ('8239732f-7a9a-6578-6066-291533e7f1b2'::uuid, 'FR/EN reactive et BMR retire du formulaire Travail.'),
    ('0150ccd6-1c0e-8add-22df-a7e8df50bec4'::uuid, 'Revenus clarifies et agregats multidevises corriges.')
)
update public.app_test_results r
set treated_at = coalesce(r.treated_at, now()),
    archived_at = coalesce(r.archived_at, now()),
    treated_version = coalesce(r.treated_version, '10.5.333'),
    treatment_notes = coalesce(r.treatment_notes, treatments.notes),
    updated_at = now()
from treatments
where r.scenario_id = treatments.scenario_id
  and r.archived_at is null;

update public.app_test_module_reviews
set treated_at = coalesce(treated_at, now()),
    archived_at = coalesce(archived_at, now()),
    treated_version = coalesce(treated_version, '10.5.333'),
    treatment_notes = coalesce(treatment_notes, 'Les dossiers Documents sont consultables depuis Travail, acceptent un ajout et peuvent etre lies a une mission, un revenu ou une periode.'),
    updated_at = now()
where id = '137e77f7-d937-4c1d-a655-a7245a294aa4'::uuid
  and archived_at is null;

insert into public.app_test_scenarios (
  id, campaign_id, module_id, parent_scenario_id, title, instructions,
  expected_result, required, sort_order
)
select child.id, parent.campaign_id, parent.module_id, child.parent_id,
       child.title, child.instructions, child.expected_result, true, child.sort_order
from (values
  ('33300000-0000-4000-8000-000000000001'::uuid, '8239732f-7a9a-6578-6066-291533e7f1b2'::uuid, 4, 'Retest langue et formulaire Travail 10.5.333', 'Ouvre Travail, bascule FR puis EN et cree ou modifie une mission et une periode.', 'L onglet et le contenu changent de langue sans quitter le module. Aucun champ ni KPI BMR n apparait et les donnees persistent.'),
  ('33300000-0000-4000-8000-000000000002'::uuid, '0150ccd6-1c0e-8add-22df-a7e8df50bec4'::uuid, 5, 'Retest revenus multidevises 10.5.333', 'Ajoute ou modifie un revenu avec net, brut, devise et periode, puis conserve au moins un revenu AUD et un EUR.', 'Chaque ligne garde net, brut et periode. Le KPI Net recu affiche un total distinct pour AUD et EUR.'),
  ('33300000-0000-4000-8000-000000000003'::uuid, '8239732f-7a9a-6578-6066-291533e7f1b2'::uuid, 6, 'Retest Documents Travail 10.5.333', 'Lie un dossier a une mission, un revenu puis une periode. Ouvre un document existant et ajoute un fichier depuis Travail.', 'Les trois liaisons persistent. Ouvrir lance l apercu du document et ajouter ouvre Documents dans le bon dossier avec le selecteur de fichier.')
) as child(id, parent_id, sort_order, title, instructions, expected_result)
join public.app_test_scenarios parent on parent.id = child.parent_id
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
set app_version = '10.5.333', updated_at = now()
where id = '20000000-0000-4000-8000-000000000001'::uuid;
