-- Bind existing SQL references at definition time, retaining SECURITY INVOKER.
-- The restricted reader has EXECUTE on auth.uid(), but intentionally no access
-- to auth tables. This avoids runtime parsing of the auth schema by SQL strings.
create or replace function public.is_trip_participant(p_trip_id uuid)
returns boolean language sql stable security invoker set search_path='public'
begin atomic
 select exists(select 1 from public.trip_participants tp where tp.trip_id=p_trip_id and tp.auth_user_id=auth.uid());
end;
create or replace function public.trip_role(p_trip_id uuid)
returns text language sql stable security invoker set search_path='public'
begin atomic
 select tp.role from public.trip_participants tp where tp.trip_id=p_trip_id and tp.auth_user_id=auth.uid() limit 1;
end;
