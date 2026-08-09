-- Close the successful Trip retest and the three treated Assets retests globally.
update public.app_test_scenarios
set closed_at = coalesce(closed_at, now()),
    closed_version = coalesce(closed_version, '10.5.331'),
    closure_notes = case id
      when '32800000-0000-4000-8000-000000000001'::uuid then 'Retest Trip valide sans note supplementaire.'
      when '32900000-0000-4000-8000-000000000001'::uuid then 'Texte budget raccourci : coche signifie inclus et decoche signifie exclu.'
      when '32900000-0000-4000-8000-000000000002'::uuid then 'Liaison de document replacee dans les justificatifs et relation avec les transactions clarifiee.'
      when '32900000-0000-4000-8000-000000000003'::uuid then 'Le cache Documents est charge avant l ouverture de Modifier les infos depuis Patrimoine.'
      else closure_notes
    end
where id in (
  '32800000-0000-4000-8000-000000000001'::uuid,
  '32900000-0000-4000-8000-000000000001'::uuid,
  '32900000-0000-4000-8000-000000000002'::uuid,
  '32900000-0000-4000-8000-000000000003'::uuid
);

update public.app_test_results
set treated_at = coalesce(treated_at, now()),
    archived_at = coalesce(archived_at, now()),
    treated_version = coalesce(treated_version, '10.5.331'),
    treatment_notes = case scenario_id
      when '32800000-0000-4000-8000-000000000001'::uuid then 'Retour Trip OK sans note : saisie rapide validee et archivee globalement.'
      when '32900000-0000-4000-8000-000000000001'::uuid then 'La case explique brievement les deux etats : amortissement inclus ou exclu du budget.'
      when '32900000-0000-4000-8000-000000000002'::uuid then 'Lier ce document est dans Documents justificatifs. Le texte distingue justificatif, lien direct et exclusion budget.'
      when '32900000-0000-4000-8000-000000000003'::uuid then 'Modifier les infos attend le chargement du cache Documents avant d ouvrir la fiche.'
      else treatment_notes
    end,
    updated_at = now()
where scenario_id in (
  '32800000-0000-4000-8000-000000000001'::uuid,
  '32900000-0000-4000-8000-000000000001'::uuid,
  '32900000-0000-4000-8000-000000000002'::uuid,
  '32900000-0000-4000-8000-000000000003'::uuid
)
  and archived_at is null;

-- The module review is treated with this complete grouped follow-up.
update public.app_test_module_reviews review
set treated_at = coalesce(review.treated_at, now()),
    archived_at = coalesce(review.archived_at, now()),
    treated_version = coalesce(review.treated_version, '10.5.331'),
    treatment_notes = coalesce(review.treatment_notes, 'Les trois retests Patrimoine ont ete lus, corriges et prolonges par des retests descendants.'),
    updated_at = now()
from public.app_test_modules module
where module.id = review.module_id
  and module.module_key = 'assets'
  and review.archived_at is null;

with retests(id, parent_id, sort_order, title, instructions, expected_result) as (
  values
    (
      '33100000-0000-4000-8000-000000000001'::uuid,
      '32900000-0000-4000-8000-000000000001'::uuid,
      7,
      'Retest etat budget Patrimoine 10.5.331',
      'Ouvre la modification d un actif, lis l aide de la case budget, change son etat puis enregistre.',
      'L aide indique clairement coche : amortissement inclus et decoche : amortissement exclu. L etat choisi persiste apres enregistrement.'
    ),
    (
      '33100000-0000-4000-8000-000000000002'::uuid,
      '32900000-0000-4000-8000-000000000002'::uuid,
      8,
      'Retest justificatifs et mouvements Patrimoine 10.5.331',
      'Ouvre Liens et documents. Lie un document existant dans Documents justificatifs puis modifie l exclusion budget d une transaction liee directement.',
      'Lier ce document reste dans le bloc justificatifs. L interface explique qu un document ne relie pas deux fois ses transactions. Seul le mouvement direct expose l exclusion budget.'
    ),
    (
      '33100000-0000-4000-8000-000000000003'::uuid,
      '32900000-0000-4000-8000-000000000003'::uuid,
      9,
      'Retest modification document Patrimoine 10.5.331',
      'Depuis un chargement frais, ouvre Patrimoine puis Liens et documents et clique Modifier les infos sur un justificatif sans visiter Documents avant.',
      'La fiche d informations du document s ouvre au premier clic et reste modifiable sans changer de module.'
    )
)
insert into public.app_test_scenarios (
  id, campaign_id, module_id, parent_scenario_id, title, instructions,
  expected_result, required, sort_order
)
select retests.id, parent.campaign_id, parent.module_id, parent.id,
       retests.title, retests.instructions, retests.expected_result, true, retests.sort_order
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
set app_version = '10.5.331', updated_at = now()
where id = '20000000-0000-4000-8000-000000000001'::uuid;
