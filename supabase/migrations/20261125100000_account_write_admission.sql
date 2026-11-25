-- Private admission foundation. This migration alone does not start any
-- closure, admit an existing client through the new path or enable purging.
create schema if not exists account_lifecycle_private;
revoke all on schema account_lifecycle_private from public, anon, authenticated;
grant usage on schema account_lifecycle_private to authenticated;

create table account_lifecycle_private.closed_account_writes (
  user_id uuid primary key,
  closed_at timestamptz not null default pg_catalog.clock_timestamp()
);
comment on table account_lifecycle_private.closed_account_writes is
  'Operational closure guard, deliberately not FK-cascaded on Auth deletion. No client writes.';

create table account_lifecycle_private.active_account_writes (
  user_id uuid not null,
  ticket uuid not null default pg_catalog.gen_random_uuid(),
  admitted_at timestamptz not null default pg_catalog.clock_timestamp(),
  primary key(user_id, ticket)
);
comment on table account_lifecycle_private.active_account_writes is
  'Durable write admissions. Elapsed time alone does not prove a transfer stopped.';

alter table account_lifecycle_private.closed_account_writes enable row level security;
alter table account_lifecycle_private.active_account_writes enable row level security;
revoke all on all tables in schema account_lifecycle_private from public, anon, authenticated;

create function account_lifecycle_private.can_write_personal_storage()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select auth.uid() is not null and exists (select 1 from auth.users u where u.id = auth.uid())
    and not exists (
      select 1 from account_lifecycle_private.closed_account_writes g where g.user_id = auth.uid()
    );
$$;
revoke all on function account_lifecycle_private.can_write_personal_storage() from public, anon, authenticated;
grant execute on function account_lifecycle_private.can_write_personal_storage() to authenticated;

-- Kept separate from ownership policies; other buckets and reads are unchanged.
create policy f13_personal_document_insert_open on storage.objects
as restrictive for insert to authenticated with check (
  bucket_id <> 'personal-documents' or (select account_lifecycle_private.can_write_personal_storage())
);
create policy f13_personal_document_update_open on storage.objects
as restrictive for update to authenticated using (
  bucket_id <> 'personal-documents' or (select account_lifecycle_private.can_write_personal_storage())
) with check (
  bucket_id <> 'personal-documents' or (select account_lifecycle_private.can_write_personal_storage())
);
create policy f13_personal_document_delete_open on storage.objects
as restrictive for delete to authenticated using (
  bucket_id <> 'personal-documents' or (select account_lifecycle_private.can_write_personal_storage())
);

create function public.begin_account_file_write(p_user_id uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  new_ticket uuid;
begin
  if p_user_id is null then raise exception 'Account id required'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 134764219));
  if not exists (select 1 from auth.users u where u.id = p_user_id) or exists (
    select 1 from account_lifecycle_private.closed_account_writes g where g.user_id = p_user_id
  ) then
    return null;
  end if;
  insert into account_lifecycle_private.active_account_writes(user_id)
  values (p_user_id) returning ticket into new_ticket;
  return new_ticket;
end;
$$;

create function public.finish_account_file_write(p_user_id uuid, p_ticket uuid)
returns boolean
language sql security definer set search_path = ''
as $$
  with finished as (
    delete from account_lifecycle_private.active_account_writes a
    where a.user_id = p_user_id and a.ticket = p_ticket returning 1
  ) select exists (select 1 from finished);
$$;

create function public.close_account_file_admission(p_request_id uuid)
returns table (closed_at timestamptz, service_writes_drained boolean)
language plpgsql security definer set search_path = ''
as $$
declare
  account_id uuid;
begin
  select r.user_id into account_id from public.account_deletion_requests r
    where r.id = p_request_id and r.status = 'processing' for update;
  if account_id is null then raise exception 'Active deletion with account required'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(account_id::text, 134764219));
  insert into account_lifecycle_private.closed_account_writes(user_id) values (account_id)
    on conflict (user_id) do nothing;
  return query select g.closed_at, not exists (
    select 1 from account_lifecycle_private.active_account_writes a where a.user_id = account_id
  ) from account_lifecycle_private.closed_account_writes g where g.user_id = account_id;
end;
$$;

revoke all on function public.begin_account_file_write(uuid) from public, anon, authenticated;
revoke all on function public.finish_account_file_write(uuid, uuid) from public, anon, authenticated;
revoke all on function public.close_account_file_admission(uuid) from public, anon, authenticated;
grant execute on function public.begin_account_file_write(uuid) to service_role;
grant execute on function public.finish_account_file_write(uuid, uuid) to service_role;
grant execute on function public.close_account_file_admission(uuid) to service_role;
