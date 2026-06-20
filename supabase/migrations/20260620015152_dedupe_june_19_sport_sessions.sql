with candidate_sessions as (
  select
    s.id,
    s.created_at,
    count(i.id) as item_count
  from public.sport_sessions s
  join auth.users u on u.id = s.user_id
  left join public.sport_session_items i on i.session_id = s.id
  where u.email = 'seb.pecoud.icoges@gmail.com'
    and s.activity_type = 'mobility'
    and (s.started_at at time zone 'Australia/Brisbane')::timestamp(0) = timestamp '2026-06-19 16:58:24'
    and (s.ended_at at time zone 'Australia/Brisbane')::timestamp(0) = timestamp '2026-06-19 17:35:14'
    and s.duration_seconds = 2210
    and round(coalesce(s.estimated_kcal, 0)::numeric, 2) = 126.00
  group by s.id, s.created_at
),
keeper as (
  select id
  from candidate_sessions
  where item_count > 0
  order by created_at asc, id asc
  limit 1
),
victims as (
  select c.id
  from candidate_sessions c
  where not exists (select 1 from keeper k where k.id = c.id)
),
victim_items as (
  select i.id
  from public.sport_session_items i
  join victims v on v.id = i.session_id
),
deleted_sets as (
  delete from public.sport_sets st
  using victim_items vi
  where st.item_id = vi.id
  returning st.id
),
deleted_items as (
  delete from public.sport_session_items i
  using victims v
  where i.session_id = v.id
  returning i.id
)
delete from public.sport_sessions s
using victims v
where s.id = v.id;
