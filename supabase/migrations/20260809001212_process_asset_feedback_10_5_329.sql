-- Archive the three reviewed Assets episodes and keep focused child retests.
update public.app_test_scenarios
set closed_at = coalesce(closed_at, now()),
    closed_version = coalesce(closed_version, '10.5.329'),
    closure_notes = coalesce(closure_notes, 'Retour Patrimoine traite : commandes clarifiees, liens regroupes et documents consultables ou modifiables directement.')
where id in (
  'aeaa6419-581d-af42-669a-a4a5a0ae1c70'::uuid,
  '24ad8b95-a412-e43d-8ce2-0b094838bce2'::uuid,
  '557bab35-de8b-ccf8-45f3-5c0c5b51ca00'::uuid
);

update public.app_test_results
set treated_at = coalesce(treated_at, now()),
    archived_at = coalesce(archived_at, now()),
    treated_version = coalesce(treated_version, '10.5.329'),
    treatment_notes = case scenario_id
      when 'aeaa6419-581d-af42-669a-a4a5a0ae1c70'::uuid then 'La case budget explique maintenant ses deux etats et les commandes sont rangees par Valeur, Propriete, Liens et Cycle de vie.'
      when '24ad8b95-a412-e43d-8ce2-0b094838bce2'::uuid then 'Une seule commande Liens et documents ouvre deux sections de meme niveau. Fermer remplace Annuler lorsque rien ne doit etre annule.'
      when '557bab35-de8b-ccf8-45f3-5c0c5b51ca00'::uuid then 'Progression d upload conservee, CSP PDF limitee a Supabase, apercu et modification des informations accessibles directement depuis Patrimoine.'
      else treatment_notes
    end,
    updated_at = now()
where scenario_id in (
  'aeaa6419-581d-af42-669a-a4a5a0ae1c70'::uuid,
  '24ad8b95-a412-e43d-8ce2-0b094838bce2'::uuid,
  '557bab35-de8b-ccf8-45f3-5c0c5b51ca00'::uuid
)
  and archived_at is null;

with retests(id, parent_id, sort_order, title, instructions, expected_result) as (
  values
    (
      '32900000-0000-4000-8000-000000000001'::uuid,
      'aeaa6419-581d-af42-669a-a4a5a0ae1c70'::uuid,
      4,
      'Retest clarte cycle actif Patrimoine 10.5.329',
      'Ouvre un actif, observe les commandes de sa carte puis modifie la case d inclusion budget et enregistre.',
      'Une seule action principale est visible. Les commandes sont rangees par fonction et le texte explique exactement l effet coche ou decoche sur l amortissement mensuel.'
    ),
    (
      '32900000-0000-4000-8000-000000000002'::uuid,
      '24ad8b95-a412-e43d-8ce2-0b094838bce2'::uuid,
      5,
      'Retest liens financiers Patrimoine 10.5.329',
      'Depuis la carte d un actif, ouvre Liens et documents, lie ou modifie une transaction puis ferme la fenetre.',
      'Transactions, Trip et documents sont regroupes dans deux sections numerotees. Le lien reste modifiable, l exclusion budget reste explicite et le bouton de sortie indique Fermer.'
    ),
    (
      '32900000-0000-4000-8000-000000000003'::uuid,
      '557bab35-de8b-ccf8-45f3-5c0c5b51ca00'::uuid,
      6,
      'Retest documents Patrimoine 10.5.329',
      'Ajoute ou lie un PDF, ouvre son apercu puis Modifier les infos depuis Patrimoine. Refais le parcours sur mobile.',
      'La progression reste visible, le PDF s affiche sans alerte CSP, l apercu ne change pas de module et les informations sont modifiables sans debordement mobile.'
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
set app_version = '10.5.329', updated_at = now()
where id = '20000000-0000-4000-8000-000000000001'::uuid;
