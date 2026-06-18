with target_sessions as (
  select unnest(array[
    'c8c198de-8bcb-428e-831e-2c355d70a368'::uuid,
    '9df75b7d-1bee-4e16-afcc-689b0e15e2d4'::uuid
  ]) as session_id
),
work as (
  select s.id as session_id,
         coalesce(s.body_weight_kg, 70)::numeric as body_weight_kg,
         coalesce(s.duration_seconds, 0)::numeric as duration_seconds,
         sum(coalesce(st.duration_seconds, 0))::numeric as work_seconds,
         sum(
           greatest(coalesce(i.met_value, 1)::numeric, 1)
           * 3.5
           * (coalesce(s.body_weight_kg, 70)::numeric + greatest(coalesce(st.weight_kg, 0)::numeric, 0))
           / 200
           * (coalesce(st.duration_seconds, 0)::numeric / 60)
         ) as active_kcal,
         bool_or(i.activity_key in ('strength','bodyweight_strength','resistance_band_strength','core_abs','plank_core')
           or coalesce(i.equipment, '') in ('bodyweight','band','dumbbell','barbell','plate','kettlebell','machine')) as has_strength,
         bool_or(not (i.activity_key in ('strength','bodyweight_strength','resistance_band_strength','core_abs','plank_core')
           or coalesce(i.equipment, '') in ('bodyweight','band','dumbbell','barbell','plate','kettlebell','machine'))) as has_cardio
  from public.sport_sessions s
  join target_sessions t on t.session_id = s.id
  join public.sport_session_items i on i.session_id = s.id
  left join public.sport_sets st on st.item_id = i.id
  group by s.id, s.body_weight_kg, s.duration_seconds
),
calc as (
  select session_id,
         round(greatest(
           coalesce(active_kcal, 0)
           + ((1.3::numeric * 3.5 * body_weight_kg / 200)
             * (greatest(duration_seconds - coalesce(work_seconds, 0), 0) / 60)),
           case
             when has_strength and not has_cardio then
               (3.8::numeric * 3.5 * body_weight_kg / 200) * (duration_seconds / 60)
             when has_strength and has_cardio then
               (3.3::numeric * 3.5 * body_weight_kg / 200) * (duration_seconds / 60)
             else 0
           end
         ), 2) as estimated_kcal
  from work
)
update public.sport_sessions s
set estimated_kcal = calc.estimated_kcal
from calc
where s.id = calc.session_id;
