-- Harden public Data API exposure for unauthenticated clients.
-- Authenticated users keep their explicit grants and remain protected by RLS.

revoke all privileges on all tables in schema public from anon;
revoke all privileges on all sequences in schema public from anon;
revoke execute on all functions in schema public from anon;

-- Some functions are executable through PUBLIC by default; remove that broad path too.
revoke execute on all functions in schema public from public;

-- Keep future objects opt-in for browser roles.
alter default privileges for role postgres in schema public
  revoke select, insert, update, delete on tables from anon;

alter default privileges for role postgres in schema public
  revoke usage, select on sequences from anon;

alter default privileges for role postgres in schema public
  revoke execute on functions from anon;

alter default privileges for role postgres in schema public
  revoke execute on functions from public;
