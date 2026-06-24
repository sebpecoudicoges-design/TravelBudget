revoke execute on function public.apply_transaction_v2(
  uuid, text, text, numeric, text, date, date, text, text, boolean, boolean, boolean, boolean,
  uuid, uuid, numeric, text, timestamptz, text, text, uuid, date, date, text
) from public;

revoke execute on function public.apply_transaction_v2(
  uuid, text, text, numeric, text, date, date, text, text, boolean, boolean, boolean, boolean,
  uuid, uuid, numeric, text, timestamptz, text, text, uuid, date, date, text
) from anon;

grant execute on function public.apply_transaction_v2(
  uuid, text, text, numeric, text, date, date, text, text, boolean, boolean, boolean, boolean,
  uuid, uuid, numeric, text, timestamptz, text, text, uuid, date, date, text
) to authenticated, service_role;
