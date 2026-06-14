alter table public.settings
  add column if not exists body_weight_kg numeric(6,2),
  add column if not exists body_height_cm numeric(6,2);

comment on column public.settings.body_weight_kg is
  'Body weight in kilograms used for BMR, nutrition, work and sport calculations.';

comment on column public.settings.body_height_cm is
  'Body height in centimeters used for BMR, nutrition, work and sport calculations.';

alter table public.settings
  drop constraint if exists settings_body_weight_kg_chk,
  drop constraint if exists settings_body_height_cm_chk;

alter table public.settings
  add constraint settings_body_weight_kg_chk check (body_weight_kg is null or body_weight_kg > 0),
  add constraint settings_body_height_cm_chk check (body_height_cm is null or body_height_cm >= 60);

insert into public.settings (user_id, birth_date, body_weight_kg, body_height_cm, updated_at)
select u.id, date '1997-06-22', 59, 162, now()
from auth.users u
where lower(u.email) = lower('seb.pecoud.icoges@gmail.com')
on conflict (user_id)
do update set
  birth_date = excluded.birth_date,
  body_weight_kg = excluded.body_weight_kg,
  body_height_cm = excluded.body_height_cm,
  updated_at = now();
