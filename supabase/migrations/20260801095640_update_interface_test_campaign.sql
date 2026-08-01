-- Extend the active campaign without touching existing tester results.
update public.app_test_campaigns
set app_version = '10.5.318',
    description = 'Teste chaque parcours reel, indique OK ou Pas OK et note precisement les ecarts. Les modifications livrees sont ajoutees dans cet onglet sans effacer les retours precedents.',
    updated_at = now()
where id = '20000000-0000-4000-8000-000000000001';

insert into public.app_test_modules (
  id, campaign_id, module_key, title, description, instructions, sort_order, status
)
values (
  md5('20000000-0000-4000-8000-000000000001' || 'project')::uuid,
  '20000000-0000-4000-8000-000000000001',
  'project',
  'Interface generale',
  'Page Projet publique et ecran de chargement initial.',
  'Teste la page Projet sur PC et mobile, puis recharge l application en clair et sombre.',
  15,
  'in_test'
)
on conflict (campaign_id, module_key) do update set
  title = excluded.title,
  description = excluded.description,
  instructions = excluded.instructions,
  sort_order = excluded.sort_order,
  status = excluded.status,
  updated_at = now();

with target_module as (
  select id, campaign_id
  from public.app_test_modules
  where campaign_id = '20000000-0000-4000-8000-000000000001'
    and module_key = 'project'
), seed as (
  select * from jsonb_to_recordset($scenarios$[
    {
      "sort_order": 1,
      "title": "Page Projet premium",
      "instructions": "Ouvre la page Projet, parcours le hero, la demo, l Atlas, les releases et le centre de confiance a 1440 px puis 390 px.",
      "expected_result": "La palette corail/lagon est coherente, aucun debordement horizontal n apparait, les sections Membres admins et Checklist de mise en ligne sont absentes et le lien proprietaire Pecloud ouvre pecloud.fr."
    },
    {
      "sort_order": 2,
      "title": "Chargement clair et sombre",
      "instructions": "Recharge completement l application en theme clair puis sombre et observe la progression jusqu au Dashboard.",
      "expected_result": "L ecran solaire affiche version, pourcentage, etapes et message de confidentialite, reste lisible dans les deux themes puis disparait a 100 %."
    }
  ]$scenarios$::jsonb) as x(sort_order int, title text, instructions text, expected_result text)
)
insert into public.app_test_scenarios (
  id, campaign_id, module_id, title, instructions, expected_result, required, sort_order
)
select md5(target_module.id::text || ':' || seed.sort_order::text)::uuid,
       target_module.campaign_id,
       target_module.id,
       seed.title,
       seed.instructions,
       seed.expected_result,
       true,
       seed.sort_order
from target_module
cross join seed
on conflict (module_id, sort_order) do update set
  title = excluded.title,
  instructions = excluded.instructions,
  expected_result = excluded.expected_result,
  required = excluded.required;
