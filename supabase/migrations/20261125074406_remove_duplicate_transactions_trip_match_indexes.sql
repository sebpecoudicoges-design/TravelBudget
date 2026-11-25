-- F11. Preserve the exact same partial lookup index; remove only two verified copies.
-- This block runs transactionally. If the table is busy, fail without changes.
set local lock_timeout = '2s';
set local statement_timeout = '5s';
lock table public.transactions in access exclusive mode;

do $migration$
declare
  target oid := 'public.transactions'::regclass;
  retained_name constant text := 'transactions_trip_match_idx';
  redundant_names constant text[] := array['idx_transactions_match_trip','transactions_dup_match_idx'];
  expected_suffix constant text :=
    ' ON public.transactions USING btree (user_id, type, currency, amount, date_start, date_end) WHERE (type = ''expense''::text)';
  name_to_check text;
  index_oid oid;
begin
  -- Validate everything before issuing any DROP. When rerun, missing copies are
  -- fine, but the known-good retained index must still be present and exact.
  foreach name_to_check in array array_prepend(retained_name, redundant_names) loop
    index_oid := to_regclass(format('public.%I', name_to_check));
    if index_oid is null and name_to_check <> retained_name then continue; end if;
    if index_oid is null or not exists (
      select 1 from pg_index i join pg_class c on c.oid = i.indexrelid
      where i.indexrelid = index_oid and i.indrelid = target and c.relkind = 'i'
        and i.indisvalid and i.indisready and i.indislive
        and not i.indisunique and not i.indisprimary and not i.indisexclusion
        and not i.indisreplident and not i.indisclustered
        and c.reloptions is null and c.reltablespace = 0
    ) or pg_get_indexdef(index_oid) <> 'CREATE INDEX ' || name_to_check || expected_suffix then
      raise exception 'Trip matching index % is missing or differs; refusing cleanup', name_to_check;
    end if;
    if name_to_check <> retained_name and (
      exists (select 1 from pg_constraint where conindid = index_oid)
      or exists (select 1 from pg_depend where refclassid = 'pg_class'::regclass and refobjid = index_oid)
      or exists (select 1 from pg_depend where classid = 'pg_class'::regclass and objid = index_oid and deptype = 'e')
    ) then
      raise exception 'Trip matching index % has dependencies; refusing cleanup', name_to_check;
    end if;
  end loop;

  foreach name_to_check in array redundant_names loop
    if to_regclass(format('public.%I', name_to_check)) is not null then
      execute format('drop index public.%I restrict', name_to_check);
    end if;
  end loop;
end;
$migration$;

-- Manual rollback, each statement separately outside a transaction when appropriate:
-- CREATE INDEX CONCURRENTLY idx_transactions_match_trip ON public.transactions USING btree
--   (user_id, type, currency, amount, date_start, date_end) WHERE (type = 'expense'::text);
-- CREATE INDEX CONCURRENTLY transactions_dup_match_idx ON public.transactions USING btree
--   (user_id, type, currency, amount, date_start, date_end) WHERE (type = 'expense'::text);
