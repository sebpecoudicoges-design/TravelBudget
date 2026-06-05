-- Trigger helpers are internal integrity guards. They are executed by table
-- triggers only and must not be exposed through the Supabase RPC surface.

revoke execute on function public.trip_validate_expense_share_integrity() from public;
revoke execute on function public.trip_validate_expense_share_integrity() from anon;
revoke execute on function public.trip_validate_expense_share_integrity() from authenticated;

revoke execute on function public.trip_validate_settlement_integrity() from public;
revoke execute on function public.trip_validate_settlement_integrity() from anon;
revoke execute on function public.trip_validate_settlement_integrity() from authenticated;
