alter table public.settings
  add column if not exists notification_prefs jsonb not null default '{}'::jsonb;

comment on column public.settings.notification_prefs is
  'User-configurable notification preferences for in-app/mobile reminders.';
