-- F11: one proven duplicate, not an unused-index cleanup.
-- Keep the equivalent, valid wallet lookup index and every constraint.
-- Bound the brief exclusive lock required by transactional DROP INDEX.
set local lock_timeout = '2s';
set local statement_timeout = '5s';
lock table public.transactions in access exclusive mode;

do $migration$
declare
  kept oid := to_regclass('public.transactions_wallet_id_idx');
  redundant oid := to_regclass('public.idx_tx_wallet');
begin
  if kept is null or not exists (
    select 1 from pg_index i
    where i.indexrelid = kept and i.indrelid = 'public.transactions'::regclass
      and i.indisvalid and i.indisready and i.indislive
      and not i.indisunique and not i.indisprimary
  ) or pg_get_indexdef(kept) <> 'CREATE INDEX transactions_wallet_id_idx ON public.transactions USING btree (wallet_id)' then
    raise exception 'Expected valid retained wallet index is missing or changed';
  end if;

  -- A second execution is harmless, but still checks the retained index.
  if redundant is null then return; end if;

  if not exists (
    select 1 from pg_index i
    where i.indexrelid = redundant and i.indrelid = 'public.transactions'::regclass
      and i.indisvalid and i.indisready and i.indislive
      and not i.indisunique and not i.indisprimary
      and not i.indisreplident and not i.indisclustered
  ) or pg_get_indexdef(redundant) <> 'CREATE INDEX idx_tx_wallet ON public.transactions USING btree (wallet_id)' then
    raise exception 'Redundant index definition or role changed; refusing removal';
  end if;
  if exists (select 1 from pg_constraint where conindid = redundant)
     or exists (select 1 from pg_depend where refclassid = 'pg_class'::regclass and refobjid = redundant)
     or exists (select 1 from pg_depend where classid = 'pg_class'::regclass and objid = redundant and deptype = 'e') then
    raise exception 'Redundant index has dependencies; refusing removal';
  end if;

  drop index public.idx_tx_wallet;
end;
$migration$;

-- Manual rollback if needed (do not run as part of this migration):
-- CREATE INDEX idx_tx_wallet ON public.transactions USING btree (wallet_id);
