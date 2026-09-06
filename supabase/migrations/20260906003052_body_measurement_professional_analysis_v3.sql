-- Body composition V3: persist skeletal muscle values as first-class metrics.
-- Older Renpho imports stored them in notes; keep those notes and backfill only
-- values explicitly present there. No clinical inference is introduced.

alter table public.health_body_measurements
  add column if not exists skeletal_muscle_pct numeric,
  add column if not exists skeletal_muscle_kg numeric;

alter table public.health_body_measurements
  drop constraint if exists health_body_measurements_skeletal_muscle_pct_chk,
  drop constraint if exists health_body_measurements_skeletal_muscle_kg_chk,
  add constraint health_body_measurements_skeletal_muscle_pct_chk
    check (skeletal_muscle_pct is null or (skeletal_muscle_pct >= 5 and skeletal_muscle_pct <= 80)),
  add constraint health_body_measurements_skeletal_muscle_kg_chk
    check (skeletal_muscle_kg is null or (skeletal_muscle_kg >= 2 and skeletal_muscle_kg <= 220));

with parsed as (
  select id,
    nullif(replace((regexp_match(notes, 'Muscle squelettique:\s*([0-9]+(?:[.,][0-9]+)?)\s*kg', 'i'))[1], ',', '.'), '')::numeric as muscle_kg,
    nullif(replace(coalesce(
      (regexp_match(notes, 'Muscle squelettique:.*\(([0-9]+(?:[.,][0-9]+)?)\s*%', 'i'))[1],
      (regexp_match(notes, 'Muscle squelettique:\s*([0-9]+(?:[.,][0-9]+)?)\s*%', 'i'))[1]
    ), ',', '.'), '')::numeric as muscle_pct
  from public.health_body_measurements
  where notes ~* 'Muscle squelettique:'
)
update public.health_body_measurements as measurement
set skeletal_muscle_kg = coalesce(measurement.skeletal_muscle_kg, parsed.muscle_kg),
    skeletal_muscle_pct = coalesce(measurement.skeletal_muscle_pct, parsed.muscle_pct),
    updated_at = case
      when (measurement.skeletal_muscle_kg is null and parsed.muscle_kg is not null)
        or (measurement.skeletal_muscle_pct is null and parsed.muscle_pct is not null)
      then now()
      else measurement.updated_at
    end
from parsed
where measurement.id = parsed.id
  and (parsed.muscle_kg is not null or parsed.muscle_pct is not null);

comment on column public.health_body_measurements.skeletal_muscle_pct is
  'Skeletal muscle percentage supplied by the measuring device; never inferred from total muscle mass.';
comment on column public.health_body_measurements.skeletal_muscle_kg is
  'Skeletal muscle mass in kilograms supplied by the measuring device; never inferred when absent.';

update public.app_test_modules module
set status = 'in_test', archived_at = null, archive_reason = null, updated_at = now()
from public.app_test_campaigns campaign
where module.campaign_id = campaign.id
  and campaign.slug = 'stabilisation-modules-10-5-316'
  and module.module_key in ('nutrition', 'sport');

insert into public.app_test_scenarios (
  id, campaign_id, module_id, parent_scenario_id, title, instructions,
  expected_result, required, sort_order
)
select
  md5(parent.campaign_id::text || ':nutrition-cooking-10.5.361')::uuid,
  parent.campaign_id, parent.module_id, parent.id,
  'Atelier cuisine complet 10.5.361',
  'Dans Alimentation > Repas, ouvre Je cuisine. Nomme une recette, ajoute plusieurs aliments du catalogue avec poids et cuisson, renseigne le poids final puis ajoute la portion. Recharge ensuite la page et utilise la recette recente.',
  'La previsualisation se met a jour sans bloquer la saisie. La recette et son batch restent disponibles apres rechargement, la portion rejoint le journal une seule fois, et le parcours reste utilisable a 390 px en clair et sombre.',
  true, 3611
from public.app_test_scenarios parent
join public.app_test_modules module on module.id = parent.module_id
join public.app_test_campaigns campaign on campaign.id = parent.campaign_id
where campaign.slug = 'stabilisation-modules-10-5-316'
  and module.module_key = 'nutrition'
  and parent.title = 'Repas et eau'
on conflict (id) do nothing;

insert into public.app_test_scenarios (
  id, campaign_id, module_id, parent_scenario_id, title, instructions,
  expected_result, required, sort_order
)
select
  md5(parent.campaign_id::text || ':sport-body-analysis-10.5.361')::uuid,
  parent.campaign_id, parent.module_id, parent.id,
  'Analyse impedancemetrique interactive 10.5.361',
  'Dans Sport > Profil, controle les indicateurs de la derniere pesee puis change la metrique de la courbe et les periodes 12, 30 et Tout. Ouvre aussi la saisie d une mesure.',
  'Toutes les valeurs sources disponibles remontent, dont muscle squelettique en pourcentage et kg. Les trous sont annonces sans valeur inventee, le graphique et les deltas changent avec les filtres, et les champs restent utilisables a 390 px en clair et sombre.',
  true, 3612
from public.app_test_scenarios parent
join public.app_test_modules module on module.id = parent.module_id
join public.app_test_campaigns campaign on campaign.id = parent.campaign_id
where campaign.slug = 'stabilisation-modules-10-5-316'
  and module.module_key = 'sport'
  and parent.title = 'Profil et mesures'
on conflict (id) do nothing;

with tester as (
  select id from auth.users where lower(email) = lower('seb.pecoud@gmail.com') limit 1
), scenarios as (
  select id, campaign_id from public.app_test_scenarios
  where title in ('Atelier cuisine complet 10.5.361', 'Analyse impedancemetrique interactive 10.5.361')
)
insert into public.app_test_results (campaign_id, scenario_id, user_id, status, notes, completed_at)
select scenarios.campaign_id, scenarios.id, tester.id, 'pending', null, null
from scenarios cross join tester
where not exists (
  select 1 from public.app_test_results result
  where result.scenario_id = scenarios.id
    and result.user_id = tester.id
    and result.archived_at is null
);

update public.app_test_campaigns
set app_version = '10.5.361', updated_at = now()
where slug = 'stabilisation-modules-10-5-316';
