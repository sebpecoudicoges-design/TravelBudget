-- Keep extensions out of the exposed public schema while preserving existing
-- GiST exclusion constraints that depend on btree_gist operator classes.
create schema if not exists extensions;
alter extension btree_gist set schema extensions;
