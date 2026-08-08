-- Appending touches only the caller's open result; existing RLS policies are
-- sufficient, so this RPC does not need owner privileges.
alter function public.append_app_test_feedback(uuid) security invoker;
