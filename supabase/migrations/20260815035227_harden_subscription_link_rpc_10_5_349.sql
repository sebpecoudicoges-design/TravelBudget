-- The function only touches rows already protected by user-owned RLS policies.
-- SECURITY INVOKER keeps those policies active and clears the advisor warning.
alter function public.link_transaction_to_recurring_rule(uuid, uuid) security invoker;

revoke all on function public.link_transaction_to_recurring_rule(uuid, uuid) from public, anon;
grant execute on function public.link_transaction_to_recurring_rule(uuid, uuid) to authenticated, service_role;
