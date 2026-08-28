-- Reopen Analysis with a focused descendant test for Trip-generated cash and
-- personal budget shares. Existing ownership and RLS policies are unchanged.
update public.app_test_modules module
set status = 'in_test', archived_at = null, archive_reason = null, updated_at = now()
from public.app_test_campaigns campaign
where module.campaign_id = campaign.id
  and campaign.slug = 'stabilisation-modules-10-5-316'
  and module.module_key = 'analysis';

update public.app_test_scenarios
set instructions = 'Dans Analyse, sélectionne Périmètre Budget puis vérifie Trésorerie pure en modes Flux réel et Planifié avec plusieurs sous-catégories.',
    expected_result = 'Les catégories et sous-catégories des entrées et sorties sont visibles côte à côte dans tout le périmètre Budget. La ventilation détaillée disparaît dans les autres périmètres.'
where id = '35500000-0000-4000-8000-000000000004'::uuid;

insert into public.app_test_scenarios (
  id, campaign_id, module_id, parent_scenario_id, title, instructions,
  expected_result, required, sort_order
)
select
  '35600000-0000-4000-8000-000000000001'::uuid,
  parent.campaign_id,
  parent.module_id,
  parent.id,
  'Trip : trésorerie et budget 10.5.356',
  'Depuis Trip, crée ou utilise une dépense partagée en Transport / Essence avec une avance et une entrée reçue. Dans Analyse, sélectionne la période et le périmètre Budget puis compare la Trésorerie pure et le budget Transport / Essence.',
  'La trésorerie affiche le montant intégral réellement encaissé et débité sous Transport puis Transport › Essence. Le budget déduit uniquement la quote-part personnelle reçue de la dépense personnelle, sans double comptage. Catégories et sous-catégories restent visibles côte à côte.',
  true,
  3561
from public.app_test_scenarios parent
where parent.id = '35500000-0000-4000-8000-000000000003'::uuid
on conflict (id) do update
set parent_scenario_id = excluded.parent_scenario_id,
    title = excluded.title,
    instructions = excluded.instructions,
    expected_result = excluded.expected_result,
    required = excluded.required,
    sort_order = excluded.sort_order;

update public.app_test_campaigns
set app_version = '10.5.356', updated_at = now()
where slug = 'stabilisation-modules-10-5-316';
