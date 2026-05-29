insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'app-downloads',
  'app-downloads',
  true,
  157286400,
  array[
    'application/vnd.android.package-archive',
    'application/octet-stream'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists app_downloads_public_read on storage.objects;
create policy app_downloads_public_read
  on storage.objects
  for select
  to public
  using (bucket_id = 'app-downloads');
