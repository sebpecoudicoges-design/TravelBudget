-- Audit fixture only. No migration or API. The registry keeps no meal contents.
create schema audit_nutrition_private;
revoke all on schema audit_nutrition_private from public, anon, authenticated;
create table audit_nutrition_private.meal_keys (
  user_id uuid not null references auth.users(id) on delete cascade,
  sync_id text not null,
  deleted boolean not null default false,
  primary key (user_id, sync_id)
);
alter table audit_nutrition_private.meal_keys enable row level security;

-- The audited tables have already enforced ownership on the actual meal row.
-- The trigger is not an exposed RPC; it may write only the private key registry.
create function audit_nutrition_private.track_meal_key() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if row(new.user_id, new.sync_id) is distinct from row(old.user_id, old.sync_id) then
      raise exception 'Meal identity cannot change' using errcode = 'TBM02';
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    -- Auth deletion already removes the private registry via its foreign key.
    if old.sync_id is not null and exists (select 1 from auth.users u where u.id = old.user_id) then
      insert into audit_nutrition_private.meal_keys (user_id, sync_id, deleted)
      values (old.user_id, old.sync_id, true)
      on conflict (user_id, sync_id) do update set deleted = true;
    end if;
    return old;
  end if;
  if new.sync_id is not null then
    -- A real insert reaches this trigger only after the live meal's unique
    -- index has admitted it. Reserving its key cannot resurrect a retired key.
    insert into audit_nutrition_private.meal_keys (user_id, sync_id)
    values (new.user_id, new.sync_id)
    on conflict (user_id, sync_id) do nothing;
    if not found then
      raise exception 'Meal key is no longer available' using errcode = 'TBM01';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function audit_nutrition_private.track_meal_key() from public, anon, authenticated;

create trigger audit_meal_key_lifecycle
  after insert or delete or update of user_id, sync_id on public.nutrition_meals
  for each row execute function audit_nutrition_private.track_meal_key();
