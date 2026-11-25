-- Deploy before the updated processor. Do not backfill: historical completion
-- of the data purge cannot be inferred from a missing Auth user.
alter table public.account_deletion_requests
  add column if not exists data_purged_at timestamptz;

comment on column public.account_deletion_requests.data_purged_at is
  'Server checkpoint written only after data cleanup succeeds and before Auth deletion. No user identity retained.';
