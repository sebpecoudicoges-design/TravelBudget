-- Keep recurring rules internally consistent even when they are written
-- directly through the Data API. The generation RPC is SECURITY DEFINER, so
-- table-level guards are the durable enforcement point.

create or replace function public.recurring_validate_rule_integrity()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.user_id is null or new.travel_id is null or new.wallet_id is null then
    raise exception 'Recurring rule requires user_id, travel_id and wallet_id';
  end if;

  if not exists (
    select 1
    from public.travels t
    where t.id = new.travel_id
      and t.user_id = new.user_id
  ) then
    raise exception 'Recurring rule travel does not belong to user';
  end if;

  if not exists (
    select 1
    from public.wallets w
    where w.id = new.wallet_id
      and w.user_id = new.user_id
      and (w.travel_id is null or w.travel_id = new.travel_id)
  ) then
    raise exception 'Recurring rule wallet does not belong to user/travel';
  end if;

  new.currency := upper(trim(new.currency));
  new.category := nullif(trim(coalesce(new.category, '')), '');
  new.subcategory := nullif(trim(coalesce(new.subcategory, '')), '');
  new.label := trim(new.label);

  return new;
end;
$function$;

drop trigger if exists recurring_rules_integrity_guard on public.recurring_rules;
create trigger recurring_rules_integrity_guard
before insert or update on public.recurring_rules
for each row execute function public.recurring_validate_rule_integrity();

revoke execute on function public.recurring_validate_rule_integrity() from public;
revoke execute on function public.recurring_validate_rule_integrity() from anon;
revoke execute on function public.recurring_validate_rule_integrity() from authenticated;
