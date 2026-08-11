-- Close the previously validated Settings category retest for every tester.
update public.app_test_scenarios
set closed_at = coalesce(closed_at, now()),
    closed_version = coalesce(closed_version, '10.5.342'),
    closure_notes = coalesce(closure_notes, 'Teste le 08/08/2026 puis traite le 11/08/2026. Le retour Categories Settings etait OK; le scenario est maintenant clos globalement avant le retest cible des regles recurrentes.')
where id = '32500000-0000-4000-8000-000000000003'::uuid;

with retests(id, parent_id, title, instructions, expected_result, sort_order) as (
  values
    (
      '34200000-0000-4000-8000-000000000001'::uuid,
      '32700000-0000-4000-8000-000000000001'::uuid,
      'Retest actions internes aux wallets 10.5.342',
      'Ouvre Dashboard avec plusieurs wallets, puis verifie Archiver ou Desarchiver en theme clair et sombre a 1440 px et 390 px.',
      'Chaque bouton Archiver ou Desarchiver reste visuellement et tactilement dans sa propre carte wallet, y compris sur mobile et avec un nom long.',
      10
    ),
    (
      '34200000-0000-4000-8000-000000000002'::uuid,
      '4f587a2b-cfad-a7e4-ba81-417e48643cee'::uuid,
      'Retest perimetre KPI et courbe 10.5.342',
      'Sur Dashboard, ouvre le filtre de periode et selectionne successivement Tout le voyage, deux periodes distinctes et Date a date.',
      'Le choix actif est visible et chaque clic recalcule immediatement les KPI et la courbe sur le meme perimetre; Tout le voyage couvre les dates completes du voyage.',
      11
    ),
    (
      '34200000-0000-4000-8000-000000000003'::uuid,
      '32500000-0000-4000-8000-000000000003'::uuid,
      'Retest sous-categorie des regles recurrentes 10.5.342',
      'Dans Settings, cree ou modifie une regle recurrente. Choisis une categorie puis une sous-categorie, change la frequence et enregistre.',
      'La liste des sous-categories devient selectionnable apres le choix de categorie; frequence, wallet, devise et sous-categorie restent interactifs et la regle enregistree conserve ces valeurs.',
      5
    ),
    (
      '34200000-0000-4000-8000-000000000004'::uuid,
      '32600000-0000-4000-8000-000000000001'::uuid,
      'Retest connexion sans gel 10.5.342',
      'Deconnecte-toi puis reconnecte-toi sur web et mobile. Pendant puis apres les bulles de synchronisation, tente de naviguer, cliquer et saisir sans recharger la page.',
      'Une seule initialisation est executee; le chargement disparait, Dashboard devient interactif et aucune synchronisation automatique concurrente ne fige les commandes.',
      12
    )
)
insert into public.app_test_scenarios (
  id, campaign_id, module_id, parent_scenario_id, title, instructions,
  expected_result, required, sort_order
)
select
  retests.id,
  parent.campaign_id,
  parent.module_id,
  parent.id,
  retests.title,
  retests.instructions,
  retests.expected_result,
  true,
  retests.sort_order
from retests
join public.app_test_scenarios parent on parent.id = retests.parent_id
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
set app_version = '10.5.342', updated_at = now()
where id = '20000000-0000-4000-8000-000000000001'::uuid;
