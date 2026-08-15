-- The RPC only mutates rows covered by the caller's ownership policies.
-- Keep the authenticated Data API surface under RLS instead of bypassing it.
alter function public.save_subscription_rule_v3(
  uuid, uuid, uuid, text, boolean, text, numeric, text, text, text, text,
  integer, integer, integer, date, date, integer, boolean
) security invoker;

revoke all on function public.save_subscription_rule_v3(
  uuid, uuid, uuid, text, boolean, text, numeric, text, text, text, text,
  integer, integer, integer, date, date, integer, boolean
) from public, anon;
grant execute on function public.save_subscription_rule_v3(
  uuid, uuid, uuid, text, boolean, text, numeric, text, text, text, text,
  integer, integer, integer, date, date, integer, boolean
) to authenticated, service_role;
