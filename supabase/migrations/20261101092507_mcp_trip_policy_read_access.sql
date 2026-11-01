-- Existing Trip SELECT policies call these read-only SECURITY INVOKER helpers.
-- The reader remains subject to its restrictive owned-group and participant policies.
grant execute on function public.is_trip_participant(uuid), public.trip_role(uuid) to tb_mcp_reader;
