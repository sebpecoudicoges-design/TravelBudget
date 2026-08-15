insert into public.app_test_scenarios (
  id, campaign_id, module_id, title, instructions, expected_result, required, sort_order
)
select scenario.id, campaign.id, module.id, scenario.title, scenario.instructions, scenario.expected_result, true, scenario.sort_order
from public.app_test_campaigns campaign
join public.app_test_modules module on module.campaign_id=campaign.id and module.module_key='sport'
cross join (values
  ('34700000-0000-4000-8000-000000000001'::uuid, 'Retest progression par seance Sport 10.5.347', 'Ouvrir Profil et progression puis comparer le nombre de seances connues pour Squat, Bench et Deadlift avec le nombre affiche.', 'Chaque entrainement produit un seul point par exercice, calcule depuis la meilleure serie valide de cette seance; les series et les alias ne creent aucun doublon.', 3471),
  ('34700000-0000-4000-8000-000000000002'::uuid, 'Retest lisibilite courbes Sport 10.5.347', 'Observer plusieurs exercices en clair et sombre, sur ordinateur puis mobile, et utiliser le filtre exercice.', 'Depart, derniere seance, record, dates et evolution totale sont immediatement lisibles; chaque courbe a sa propre echelle et aucun bloc ne deborde.', 3472)
) as scenario(id,title,instructions,expected_result,sort_order)
where campaign.slug='stabilisation-modules-10-5-316'
on conflict (id) do update set title=excluded.title,instructions=excluded.instructions,
  expected_result=excluded.expected_result,required=excluded.required,sort_order=excluded.sort_order;

update public.app_test_campaigns set app_version='10.5.347',updated_at=now()
where slug='stabilisation-modules-10-5-316';
