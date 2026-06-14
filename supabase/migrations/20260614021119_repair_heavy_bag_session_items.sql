-- Repair heavy-bag items that may have been synced from an older client/cache after
-- the first MET tuning migration.
update public.sport_exercises
set met_value = 12.8, updated_at = now()
where key in ('boxing_heavy_bag', 'boxing_bag_combo_rounds');

with affected_items as (
  update public.sport_session_items
  set met_value = 12.8
  where
    (
      lower(coalesce(exercise_name, '')) like '%sac de frappe%'
      or lower(coalesce(exercise_name, '')) like '%heavy bag%'
      or lower(coalesce(exercise_name, '')) like '%combo au sac%'
      or lower(coalesce(exercise_name, '')) like '%bag combo%'
    )
    and coalesce(met_value, 0) <> 12.8
  returning id, session_id
),
affected_sessions as (
  select distinct session_id
  from affected_items
  where session_id is not null
),
set_totals as (
  select
    i.session_id,
    sum(
      (coalesce(i.met_value, 12.8)::numeric * 3.5 * (coalesce(s.body_weight_kg, 70)::numeric + coalesce(st.weight_kg, 0)::numeric) / 200)
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
    case
      when coalesce(t.work_seconds, 0) > 0 then
        coalesce(t.work_kcal, 0)
        + ((1.3::numeric * 3.5 * coalesce(s.body_weight_kg, 70)::numeric / 200)
          * (greatest(coalesce(s.duration_seconds, 0) - coalesce(t.work_seconds, 0), 0)::numeric / 60))
      else
        (12.8::numeric * 3.5 * coalesce(s.body_weight_kg, 70)::numeric / 200)
        * (coalesce(s.duration_seconds, 0)::numeric / 60)
    end as estimated_kcal
  from public.sport_sessions s
  join affected_sessions a on a.session_id = s.id
  left join set_totals t on t.session_id = s.id
)
update public.sport_sessions s
set estimated_kcal = greatest(1, round(e.estimated_kcal, 2))
from session_estimates e
where s.id = e.id;
