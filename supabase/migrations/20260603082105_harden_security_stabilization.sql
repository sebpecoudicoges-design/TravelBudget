-- Stabilization hardening pass: keep the existing access model, but remove
-- broad public/anon grants from sensitive recent tables and make storage APK
-- read access explicit.

alter table if exists public.app_error_logs enable row level security;
alter table if exists public.mobile_notification_campaigns enable row level security;
alter table if exists public.mobile_push_tokens enable row level security;

revoke all on table public.app_error_logs from public;
revoke all on table public.app_error_logs from anon;
revoke all on table public.app_error_logs from authenticated;
grant select, insert on table public.app_error_logs to authenticated;
grant all on table public.app_error_logs to service_role;

revoke all on table public.mobile_notification_campaigns from public;
revoke all on table public.mobile_notification_campaigns from anon;
revoke all on table public.mobile_notification_campaigns from authenticated;
grant select, insert, update, delete on table public.mobile_notification_campaigns to authenticated;
grant all on table public.mobile_notification_campaigns to service_role;

revoke all on table public.mobile_push_tokens from public;
revoke all on table public.mobile_push_tokens from anon;
revoke all on table public.mobile_push_tokens from authenticated;
grant select, insert, update on table public.mobile_push_tokens to authenticated;
grant all on table public.mobile_push_tokens to service_role;

revoke all on function public.is_current_user_admin() from public;
revoke all on function public.is_current_user_admin() from anon;
grant execute on function public.is_current_user_admin() to authenticated;
grant execute on function public.is_current_user_admin() to service_role;

update storage.buckets
set
  public = true,
  file_size_limit = 157286400,
  allowed_mime_types = array[
    'application/vnd.android.package-archive',
    'application/octet-stream'
  ]
where id = 'app-downloads';

drop policy if exists app_downloads_public_read on storage.objects;
