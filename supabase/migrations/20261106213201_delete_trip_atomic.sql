-- Whole-Trip deletion retains wallet transactions (unlike deleting an individual expense).
create function public.trip_delete_group_v1(p_trip_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Connexion requise'; end if;
  perform 1 from public.trip_groups g where g.id=p_trip_id
    and (g.user_id=uid or exists(select 1 from public.trip_participants p
      where p.trip_id=g.id and p.auth_user_id=uid and p.role='owner')) for update of g;
  if not found then raise exception 'Trip introuvable ou suppression non autorisée'; end if;
  -- Prevent new expense references while detaching all transactions, including reverse-only links.
  perform 1 from public.trip_expenses where trip_id=p_trip_id order by id for update;
  update public.transactions t set trip_expense_id=null from public.trip_expenses e
    where e.trip_id=p_trip_id and t.trip_expense_id=e.id;
  -- Remove expenses before members because payer/member FKs can be RESTRICT.
  delete from public.trip_expenses where trip_id=p_trip_id;
  delete from public.trip_groups where id=p_trip_id;
  if not found then raise exception 'Suppression du Trip non confirmée'; end if;
  return p_trip_id;
end; $$;
revoke all on function public.trip_delete_group_v1(uuid) from public,anon;
grant execute on function public.trip_delete_group_v1(uuid) to authenticated;
