alter table public.settings
  add column if not exists birth_date date;

comment on column public.settings.birth_date is
  'User birth date used to derive age for health, nutrition, work and BMR calculations.';

insert into public.settings (user_id, birth_date, updated_at)
select u.id, date '1997-06-22', now()
from auth.users u
where lower(u.email) = lower('seb.pecoud.icoges@gmail.com')
on conflict (user_id)
do update set
  birth_date = excluded.birth_date,
  updated_at = now();
