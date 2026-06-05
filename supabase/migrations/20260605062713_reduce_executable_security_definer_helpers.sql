-- Reduce Data API exposure for SECURITY DEFINER helpers that are not called
-- directly by the browser app. Service-role/internal usage remains available.
revoke execute on function public.get_unmapped_transaction_categories() from authenticated;
revoke execute on function public.rpc_budget_reference_compute_values(text, text, text, text, integer, integer, integer, integer, integer) from authenticated;
revoke execute on function public.rpc_budget_reference_compute_for_period(uuid, text, text, text, text, integer, integer, integer, integer, integer, boolean, boolean, boolean) from authenticated;
revoke execute on function public.rpc_budget_reference_resolve_for_period(uuid) from authenticated;
revoke execute on function public.tb_fx_rate_to_eur_v1(uuid, text, date) from authenticated;
