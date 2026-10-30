create table public.wallet_transaction_reconciliation (
  transaction_id uuid primary key references public.transactions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  wallet_id uuid not null references public.wallets(id) on delete cascade,
  transaction_updated_at timestamptz,
  reconciled_at timestamptz not null default now()
);
create index wallet_transaction_reconciliation_user_wallet_idx
  on public.wallet_transaction_reconciliation(user_id, wallet_id);
create index wallet_transaction_reconciliation_wallet_idx
  on public.wallet_transaction_reconciliation(wallet_id);
alter table public.wallet_transaction_reconciliation enable row level security;
grant select, insert, update, delete on public.wallet_transaction_reconciliation to authenticated;
create policy own_reconciliation on public.wallet_transaction_reconciliation
for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()) and exists (
  select 1 from public.transactions t join public.wallets w on w.id = t.wallet_id
  where t.id = transaction_id and t.wallet_id = wallet_transaction_reconciliation.wallet_id
    and t.user_id = (select auth.uid()) and w.user_id = (select auth.uid())
));

create function public.set_wallet_transaction_reconciliation(
  p_transaction_id uuid, p_reconciled boolean, p_expected_updated_at timestamptz
) returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  v_tx public.transactions%rowtype;
  v_mark public.wallet_transaction_reconciliation%rowtype;
begin
  if auth.uid() is null then raise exception 'Not authenticated' using errcode = '42501'; end if;
  select * into v_tx from public.transactions
    where id = p_transaction_id and user_id = auth.uid() for update;
  if not found or not exists (select 1 from public.wallets where id = v_tx.wallet_id and user_id = auth.uid()) then
    raise exception 'Transaction unavailable' using errcode = '42501';
  end if;
  if v_tx.updated_at is distinct from p_expected_updated_at then
    raise exception 'Transaction changed: reload the journal' using errcode = '40001';
  end if;
  if p_reconciled is true then
    if v_tx.pay_now is false or v_tx.is_internal is true then
      raise exception 'Only paid bank movements can be reconciled';
    end if;
    insert into public.wallet_transaction_reconciliation(transaction_id, user_id, wallet_id, transaction_updated_at)
      values(v_tx.id, auth.uid(), v_tx.wallet_id, v_tx.updated_at)
      on conflict(transaction_id) do update set transaction_updated_at = excluded.transaction_updated_at,
        wallet_id = excluded.wallet_id, reconciled_at = now()
      returning * into v_mark;
    return to_jsonb(v_mark);
  elsif p_reconciled is false then
    delete from public.wallet_transaction_reconciliation where transaction_id = v_tx.id and user_id = auth.uid();
    return null;
  end if;
  raise exception 'Missing reconciliation state';
end;
$$;
revoke all on function public.set_wallet_transaction_reconciliation(uuid, boolean, timestamptz) from public, anon;
grant execute on function public.set_wallet_transaction_reconciliation(uuid, boolean, timestamptz) to authenticated;
