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

-- A trusted operations process supplies evidence only after verifying that old
-- direct clients can no longer have an in-flight write for this closure.
-- Neither the HTTP worker nor its service-role credential can assert this.
create table account_lifecycle_private.legacy_upload_drains (
  request_id uuid primary key references public.account_deletion_requests(id) on delete cascade,
  observed_closed_at timestamptz not null,
  verified_at timestamptz not null default pg_catalog.clock_timestamp(),
  check (verified_at >= observed_closed_at)
);
alter table account_lifecycle_private.legacy_upload_drains enable row level security;
revoke all on account_lifecycle_private.legacy_upload_drains from public, anon, authenticated, service_role;

create function public.account_file_deletion_readiness(p_request_id uuid, p_started_at timestamptz)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  closure_time timestamptz;
  service_drained boolean;
begin
  perform 1 from public.account_deletion_requests r
    where r.id = p_request_id and r.status = 'processing'
      and r.processing_started_at = p_started_at and r.user_id is not null for update;
  if not found then raise exception 'Active deletion lease required'; end if;
  select report.closed_at, report.service_writes_drained into strict closure_time, service_drained
    from public.close_account_file_admission(p_request_id) as report;
  if not service_drained then return 'service_writes_pending'; end if;
  if not exists (
    select 1 from account_lifecycle_private.legacy_upload_drains d
    where d.request_id = p_request_id and d.observed_closed_at = closure_time
      and d.verified_at <= pg_catalog.clock_timestamp()
  ) then return 'legacy_upload_drain_unverified'; end if;
  return 'ready';
end;
$$;
revoke all on function public.account_file_deletion_readiness(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.account_file_deletion_readiness(uuid, timestamptz) to service_role;
