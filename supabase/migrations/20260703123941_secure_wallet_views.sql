-- Views must enforce the querying user's RLS policies, not the view owner's.
alter view public.v_wallet_transactions_effect set (security_invoker = true);
alter view public.v_wallet_balances set (security_invoker = true);
