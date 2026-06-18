-- Repair timer sessions where automatic time-based steps were stored as 1s
-- because null duration overrides were treated as valid numeric overrides.
with repaired_sets as (
  update public.sport_sets st
  set duration_seconds = greatest(1, coalesce(i.target_seconds, st.duration_seconds))
  from public.sport_session_items i
  where st.item_id = i.id
    and i.mode = 'time'
    and coalesce(i.target_seconds, 0) > 1
    and coalesce(st.duration_seconds, 0) <= 1
    and i.session_id in ('c8c198de-8bcb-428e-831e-2c355d70a368'::uuid)
  returning i.session_id
),
repaired_reps as (
  update public.sport_sets st
  set reps = 10
  from public.sport_session_items i
  where st.item_id = i.id
    and i.session_id = '9df75b7d-1bee-4e16-afcc-689b0e15e2d4'::uuid
    and lower(i.exercise_name) in ('developpe au sol halteres', 'dumbbell floor press')
    and i.mode = 'reps'
    and coalesce(st.reps, 0) = 0
  returning i.session_id
),
repaired_items as (
  update public.sport_session_items i
  set target_reps = 10
  where i.session_id = '9df75b7d-1bee-4e16-afcc-689b0e15e2d4'::uuid
    and lower(i.exercise_name) in ('developpe au sol halteres', 'dumbbell floor press')
    and i.mode = 'reps'
    and i.target_reps is null
  returning i.session_id
),
affected as (
  select session_id from repaired_sets
  union
  select session_id from repaired_reps
  union
  select session_id from repaired_items
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
  join affected a on a.session_id = s.id
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
