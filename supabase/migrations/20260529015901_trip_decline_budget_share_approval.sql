create or replace function public.trip_decline_payer_approval(p_inbox_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_item public.inbox_items%rowtype;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select *
    into v_item
  from public.inbox_items
  where id = p_inbox_id
    and user_id = v_uid
    and source = 'trip_payer_approval'
    and target_type = 'trip_expense'
    and status in ('pending', 'snoozed')
  for update;

  if not found then
    raise exception 'Approval request not found';
  end if;

  update public.inbox_items
    set status = 'error',
        processed_at = now(),
        snoozed_until = null,
        error_message = coalesce(nullif(trim(p_reason), ''), 'Refusé par le participant')
  where id = p_inbox_id
    and user_id = v_uid;
end;
$$;

revoke all on function public.trip_decline_payer_approval(uuid, text) from public;
grant execute on function public.trip_decline_payer_approval(uuid, text) to authenticated;
grant execute on function public.trip_decline_payer_approval(uuid, text) to service_role;
