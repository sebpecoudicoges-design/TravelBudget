create table if not exists public.notification_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  slot text not null default 'morning',
  channel text not null default 'mobile',
  enabled boolean not null default true,
  send_time time not null default '08:30',
  days_of_week integer[] not null default array[0,1,2,3,4,5,6],
  emoji text,
  title_template text not null check (char_length(trim(title_template)) between 1 and 120),
  body_template text not null check (char_length(trim(body_template)) between 1 and 500),
  variables jsonb not null default '[]'::jsonb,
  last_preview jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_templates_slot_chk check (slot in ('morning','midday','evening','health','manual','custom')),
  constraint notification_templates_channel_chk check (channel in ('mobile','local','inbox')),
  constraint notification_templates_days_chk check (
    array_length(days_of_week, 1) between 1 and 7
    and days_of_week <@ array[0,1,2,3,4,5,6]
  )
);

alter table public.notification_templates enable row level security;

drop policy if exists "notification_templates_select_own" on public.notification_templates;
create policy "notification_templates_select_own"
  on public.notification_templates for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "notification_templates_insert_own" on public.notification_templates;
create policy "notification_templates_insert_own"
  on public.notification_templates for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "notification_templates_update_own" on public.notification_templates;
create policy "notification_templates_update_own"
  on public.notification_templates for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "notification_templates_delete_own" on public.notification_templates;
create policy "notification_templates_delete_own"
  on public.notification_templates for delete to authenticated
  using (user_id = auth.uid());

create index if not exists notification_templates_user_enabled_idx
  on public.notification_templates(user_id, enabled, send_time);

create unique index if not exists notification_templates_user_name_uidx
  on public.notification_templates(user_id, lower(trim(name)));

revoke all on table public.notification_templates from public;
revoke all on table public.notification_templates from anon;
revoke all on table public.notification_templates from authenticated;
grant select, insert, update, delete on table public.notification_templates to authenticated;
grant all on table public.notification_templates to service_role;

alter table public.mobile_notification_deliveries
  add column if not exists template_id uuid references public.notification_templates(id) on delete set null,
  add column if not exists title text,
  add column if not exists body text,
  add column if not exists scheduled_for timestamptz,
  add column if not exists payload jsonb not null default '{}'::jsonb;

alter table public.mobile_notification_deliveries
  drop constraint if exists mobile_notification_deliveries_slot_chk;

alter table public.mobile_notification_deliveries
  add constraint mobile_notification_deliveries_slot_chk
  check (slot in ('morning','midday','evening','health','manual','test','custom'));

create index if not exists mobile_notification_deliveries_template_idx
  on public.mobile_notification_deliveries(template_id, sent_for_date desc);

insert into public.notification_templates (
  user_id, name, slot, channel, enabled, send_time, days_of_week, emoji,
  title_template, body_template, variables
)
select
  u.id,
  seed.name,
  seed.slot,
  'mobile',
  true,
  seed.send_time::time,
  array[0,1,2,3,4,5,6],
  seed.emoji,
  seed.title_template,
  seed.body_template,
  seed.variables::jsonb
from auth.users u
cross join (
  values
    (
      'Budget du matin',
      'morning',
      '08:30',
      '🌅',
      'Budget du jour',
      'Il te reste /budgetrestant sur /budgetdujour. Déjà utilisé : /depensesjour.',
      '["/budgetdujour","/budgetrestant","/depensesjour"]'
    ),
    (
      'Bilan du soir',
      'evening',
      '20:30',
      '🌙',
      'Bilan du soir',
      'Budget restant : /budgetrestant. Sport : /sportkcal, travail : /travailkcal.',
      '["/budgetrestant","/sportkcal","/travailkcal"]'
    ),
    (
      'Point santé déjeuner',
      'health',
      '12:30',
      '🍽️',
      'Point santé',
      'À cette heure : /kcalconsommees / /kcalobjectif, eau /eau, protéines /proteines.',
      '["/kcalconsommees","/kcalobjectif","/eau","/proteines"]'
    )
) as seed(name, slot, send_time, emoji, title_template, body_template, variables)
where lower(u.email) = 'seb.pecoud.icoges@gmail.com'
on conflict do nothing;

comment on table public.notification_templates is 'User-editable mobile notification templates with slash variables rendered at send time.';
