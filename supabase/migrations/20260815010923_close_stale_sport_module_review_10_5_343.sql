update public.app_test_module_reviews review
set treated_at = coalesce(review.treated_at, now()),
    archived_at = coalesce(review.archived_at, now()),
    treated_version = coalesce(review.treated_version, '10.5.343'),
    treatment_notes = coalesce(
      nullif(btrim(review.treatment_notes), ''),
      'Revue globale devenue administrative : les retours Sport ont ete traites en 10.5.334 (historique et chargement), 10.5.335 (minuteur) et 10.5.337 (profil et mesures). Les retests encore ouverts restent a effectuer.'
    ),
    updated_at = now()
where review.id in (
  select review_match.id
  from public.app_test_module_reviews review_match
  join public.app_test_modules module on module.id = review_match.module_id
  join public.app_test_campaigns campaign on campaign.id = review_match.campaign_id
  where campaign.slug = 'stabilisation-modules-10-5-316'
    and module.module_key = 'sport'
    and review_match.status = 'completed_with_issues'
    and review_match.treated_at is null
);
