update public.app_test_module_reviews review
set treated_at = coalesce(review.treated_at, now()),
    archived_at = coalesce(review.archived_at, now()),
    treated_version = coalesce(review.treated_version, '10.5.330'),
    treatment_notes = coalesce(review.treatment_notes, 'Revue Settings traitee apres cloture des trois scenarios d origine. Le retest Categories reste actif et conserve la filiation.'),
    updated_at = now()
from public.app_test_modules module
where module.id = review.module_id
  and module.module_key = 'settings'
  and review.archived_at is null;
