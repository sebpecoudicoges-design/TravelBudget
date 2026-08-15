alter table public.nutrition_meals
  add column if not exists consumed_time time without time zone;

alter table public.nutrition_meals
  drop constraint if exists nutrition_meals_consumed_time_chk;

alter table public.nutrition_meals
  add constraint nutrition_meals_consumed_time_chk
  check (consumed_time is null or (consumed_time >= time '00:00:00' and consumed_time < time '24:00:00'));

create index if not exists nutrition_meals_user_day_consumed_time_idx
  on public.nutrition_meals (user_id, meal_date desc, consumed_time desc)
  where water_ml > 0;

update public.app_test_module_reviews review
set treated_at = coalesce(review.treated_at, now()),
    archived_at = coalesce(review.archived_at, now()),
    treated_version = coalesce(review.treated_version, '10.5.344'),
    treatment_notes = coalesce(
      nullif(btrim(review.treatment_notes), ''),
      'Refonte Alimentation par espaces Aujourd hui, Repas, Hydratation et recuperation, Historique. Ajout du journal d eau horodate et clarification Sommeil et Alcool.'
    ),
    updated_at = now()
where review.id in (
  select review_match.id
  from public.app_test_module_reviews review_match
  join public.app_test_modules module on module.id = review_match.module_id
  join public.app_test_campaigns campaign on campaign.id = review_match.campaign_id
  where campaign.slug = 'stabilisation-modules-10-5-316'
    and module.module_key = 'nutrition'
    and review_match.treated_at is null
);

insert into public.app_test_scenarios (
  id, campaign_id, module_id, title, instructions, expected_result, required, sort_order
)
select scenario.id, campaign.id, module.id, scenario.title, scenario.instructions, scenario.expected_result, true, scenario.sort_order
from public.app_test_campaigns campaign
join public.app_test_modules module
  on module.campaign_id = campaign.id
 and module.module_key = 'nutrition'
cross join (values
  ('34400000-0000-4000-8000-000000000001'::uuid, 'Retest espaces Alimentation 10.5.344', 'Ouvrir successivement Aujourd hui, Repas, Hydratation et recuperation, puis Historique sur ordinateur et mobile.', 'Chaque espace est distinct, conserve la date selectionnee et expose toutes les commandes attendues sans debordement.', 3441),
  ('34400000-0000-4000-8000-000000000002'::uuid, 'Retest journal hydratation 10.5.344', 'Ajouter plusieurs prises d eau avec des heures differentes, verifier la liste du jour puis supprimer une entree.', 'Le total et le journal se mettent a jour sans rechargement; chaque ligne affiche heure et quantite et la suppression cible uniquement la prise choisie.', 3442),
  ('34400000-0000-4000-8000-000000000003'::uuid, 'Retest recuperation Alimentation 10.5.344', 'Saisir une nuit de sommeil puis consulter les reperes Alcool et les details du jour.', 'Sommeil et Alcool sont regroupes et expliques clairement, avec les donnees du jour et de la semaine.', 3443),
  ('34400000-0000-4000-8000-000000000004'::uuid, 'Retest historique Alimentation 10.5.344', 'Changer de jour depuis Historique et verifier les calories, macros, eau, repas et alcool affiches.', 'Le detail selectionne reste lisible et les donnees correspondent au jour choisi.', 3444)
) as scenario(id, title, instructions, expected_result, sort_order)
where campaign.slug = 'stabilisation-modules-10-5-316'
on conflict (id) do update
set title = excluded.title,
    instructions = excluded.instructions,
    expected_result = excluded.expected_result,
    required = excluded.required,
    sort_order = excluded.sort_order;

update public.app_test_campaigns
set app_version = '10.5.344',
    updated_at = now()
where slug = 'stabilisation-modules-10-5-316';
