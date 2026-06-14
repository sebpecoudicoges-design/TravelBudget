-- Recalculate heavy-bag sessions after MET values are already repaired.
-- This is intentionally separated from the UPDATE because PostgreSQL may not expose
-- freshly updated values to sibling CTE reads in a predictable way.
with affected_sessions as (
  select distinct session_id
  from public.sport_session_items
  where
    lower(coalesce(exercise_name, '')) like '%sac de frappe%'
    or lower(coalesce(exercise_name, '')) like '%heavy bag%'
    or lower(coalesce(exercise_name, '')) like '%combo au sac%'
    or lower(coalesce(exercise_name, '')) like '%bag combo%'
),
set_totals as (
  select
    i.session_id,
    sum(
      (coalesce(i.met_value, 1)::numeric * 3.5 * (coalesce(s.body_weight_kg, 70)::numeric + coalesce(st.weight_kg, 0)::numeric) / 200)
      * (coalesce(st.duration_seconds, 0)::numeric / 60)
    ) as work_kcal,
    sum(coalesce(st.duration_seconds, 0)) as work_seconds
  from public.sport_session_items i
  join affected_sessions a on a.session_id = i.session_id
  join public.sport_sessions s on s.id = i.session_id
  left join public.sport_sets st on st.item_id = i.id
  group by i.session_id
),
session_estimates as (
  select
    s.id,
    coalesce(t.work_kcal, 0)
    + ((1.3::numeric * 3.5 * coalesce(s.body_weight_kg, 70)::numeric / 200)
      * (greatest(coalesce(s.duration_seconds, 0) - coalesce(t.work_seconds, 0), 0)::numeric / 60)) as estimated_kcal
  from public.sport_sessions s
  join affected_sessions a on a.session_id = s.id
  left join set_totals t on t.session_id = s.id
)
update public.sport_sessions s
set estimated_kcal = greatest(1, round(e.estimated_kcal, 2))
from session_estimates e
where s.id = e.id;
