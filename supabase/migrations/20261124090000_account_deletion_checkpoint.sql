-- Deploy before the updated processor. Do not backfill: historical completion
-- of the data purge cannot be inferred from a missing Auth user.
alter table public.account_deletion_requests
  add column if not exists data_purged_at timestamptz,
  add column if not exists attempt_count smallint not null default 0;

comment on column public.account_deletion_requests.data_purged_at is
  'Server checkpoint written only after data cleanup succeeds and before Auth deletion. No user identity retained.';

comment on column public.account_deletion_requests.attempt_count is
  'Bounded count of claimed cleanup attempts; does not prevent reconciliation of an uncertain Auth outcome.';

-- A shared Trip expense can survive while its private wallet payment cannot.
-- Actual expense->transaction FKs are deferred NO ACTION. Clear just those
-- links and remove the departing user's transactions in one database call.
create or replace function public.purge_account_wallet_transactions(p_user_id uuid)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  removed bigint;
begin
  if p_user_id is null then
    raise exception 'Account id required';
  end if;

  update public.trip_expenses as expense
  set transaction_id = null
  from public.transactions as payment
  where expense.transaction_id = payment.id
    and payment.user_id = p_user_id;

  delete from public.transactions as payment
  where payment.user_id = p_user_id;
  get diagnostics removed = row_count;
  return removed;
end;
$function$;

revoke all on function public.purge_account_wallet_transactions(uuid) from public, anon, authenticated;
grant execute on function public.purge_account_wallet_transactions(uuid) to service_role;
