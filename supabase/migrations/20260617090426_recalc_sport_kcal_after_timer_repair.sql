with affected_sessions as (
  select distinct i.session_id
  from public.sport_session_items i
  join public.sport_sets st on st.item_id = i.id
  where coalesce(st.notes, '') like '%duration_auto_repaired_20260617%'
),
item_flags as (
  select
    i.session_id,
    bool_or(i.activity_key in ('strength','bodyweight_strength','resistance_band_strength','core_abs','plank_core')
      or i.equipment in ('bodyweight','band','dumbbell','barbell','plate','kettlebell','machine')) as has_strength,
    bool_or(not (i.activity_key in ('strength','bodyweight_strength','resistance_band_strength','core_abs','plank_core')
      or i.equipment in ('bodyweight','band','dumbbell','barbell','plate','kettlebell','machine'))) as has_cardio
  from public.sport_session_items i
  join affected_sessions a on a.session_id = i.session_id
  group by i.session_id
),
set_totals as (
  select
    i.session_id,
    sum(
      (greatest(coalesce(i.met_value, 1)::numeric, 1) * 3.5 * (coalesce(s.body_weight_kg, 70)::numeric + coalesce(st.weight_kg, 0)::numeric) / 200)
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
    greatest(
      coalesce(t.work_kcal, 0)
      + ((1.3::numeric * 3.5 * coalesce(s.body_weight_kg, 70)::numeric / 200)
        * (greatest(coalesce(s.duration_seconds, 0) - coalesce(t.work_seconds, 0), 0)::numeric / 60)),
      case
        when coalesce(f.has_strength, false) and not coalesce(f.has_cardio, false) then
          (3.8::numeric * 3.5 * coalesce(s.body_weight_kg, 70)::numeric / 200) * (coalesce(s.duration_seconds, 0)::numeric / 60)
        when coalesce(f.has_strength, false) and coalesce(f.has_cardio, false) then
          (3.3::numeric * 3.5 * coalesce(s.body_weight_kg, 70)::numeric / 200) * (coalesce(s.duration_seconds, 0)::numeric / 60)
        else 0
      end
    ) as estimated_kcal
  from public.sport_sessions s
  join affected_sessions a on a.session_id = s.id
  left join set_totals t on t.session_id = s.id
  left join item_flags f on f.session_id = s.id
)
update public.sport_sessions s
set estimated_kcal = greatest(1, round(e.estimated_kcal, 2))
from session_estimates e
where s.id = e.id;
