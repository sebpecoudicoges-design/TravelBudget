insert into public.sport_exercises
  (key, goal, equipment, activity_key, name_fr, name_en, mode, default_reps, default_seconds, default_sets, default_rest_seconds, distance_m, met_value, tags, sort_order)
values
  ('dumbbell_hammer_curl', 'strength', 'dumbbell', 'strength', 'Curl marteau halteres', 'Dumbbell hammer curl', 'reps', 12, null, 3, 60, null, 4.8, array['halteres','biceps','source_compendium_2024'], 473),
  ('dumbbell_skull_crusher', 'strength', 'dumbbell', 'strength', 'Barre au front halteres', 'Dumbbell skull crusher', 'reps', 10, null, 3, 60, null, 4.8, array['halteres','triceps','push','source_compendium_2024'], 474),
  ('barbell_incline_bench', 'strength', 'barbell', 'strength', 'Developpe incline barre', 'Barbell incline bench press', 'reps', 8, null, 4, 105, null, 6.1, array['barre','pectoraux','push','source_compendium_2024'], 511),
  ('barbell_lunge', 'strength', 'barbell', 'strength', 'Fentes barre', 'Barbell lunge', 'reps', 8, null, 3, 90, null, 6.2, array['barre','jambes','unilateral','source_compendium_2024'], 512),
  ('barbell_curl', 'strength', 'barbell', 'strength', 'Curl barre', 'Barbell curl', 'reps', 10, null, 3, 60, null, 4.8, array['barre','biceps','source_compendium_2024'], 513),
  ('plate_floor_press', 'strength', 'plate', 'strength', 'Developpe plate au sol', 'Plate floor press', 'reps', 12, null, 3, 75, null, 5.4, array['plate','disque','pectoraux','push','source_compendium_2024'], 575),
  ('plate_squeeze_press', 'strength', 'plate', 'strength', 'Squeeze press plate', 'Plate squeeze press', 'reps', 12, null, 3, 60, null, 5.2, array['plate','disque','pectoraux','push','source_compendium_2024'], 576),
  ('plate_overhead_press', 'strength', 'plate', 'strength', 'Developpe epaules plate', 'Plate overhead press', 'reps', 10, null, 3, 75, null, 5.2, array['plate','disque','epaules','push','source_compendium_2024'], 577),
  ('plate_front_raise', 'strength', 'plate', 'strength', 'Elevation frontale plate', 'Plate front raise', 'reps', 12, null, 3, 45, null, 4.6, array['plate','disque','epaules','source_compendium_2024'], 578),
  ('plate_russian_twist', 'strength', 'plate', 'core_abs', 'Russian twist plate', 'Plate Russian twist', 'reps', 20, null, 3, 45, null, 5.0, array['plate','disque','core','source_compendium_2024'], 579),
  ('plate_around_world', 'mobility', 'plate', 'mobility', 'Tour du monde plate', 'Plate around the world', 'reps', 8, null, 3, 45, null, 4.8, array['plate','disque','epaules','mobilite','source_compendium_2024'], 580)
on conflict (key) do update set
  goal = excluded.goal,
  equipment = excluded.equipment,
  activity_key = excluded.activity_key,
  name_fr = excluded.name_fr,
  name_en = excluded.name_en,
  mode = excluded.mode,
  default_reps = excluded.default_reps,
  default_seconds = excluded.default_seconds,
  default_sets = excluded.default_sets,
  default_rest_seconds = excluded.default_rest_seconds,
  distance_m = excluded.distance_m,
  met_value = excluded.met_value,
  tags = excluded.tags,
  sort_order = excluded.sort_order,
  is_active = true,
  updated_at = now();

-- Some live workouts were validated as checklist steps, which saved each set at
-- one second. Repair clearly-invalid durations from the planned exercise values,
-- then recalculate affected session kcal with the same work + recovery approach
-- used by the client.
with repaired_sets as (
  update public.sport_sets st
  set
    duration_seconds = case
      when i.mode = 'time' then greatest(1, coalesce(i.target_seconds, st.duration_seconds, 1))
      else greatest(15, round(coalesce(nullif(st.reps, 0), nullif(i.target_reps, 0), 10)::numeric * 2.5)::integer)
    end,
    notes = case
      when coalesce(st.notes, '') like '%duration_auto_repaired_20260617%' then st.notes
      else nullif(concat_ws(' | ', nullif(st.notes, ''), 'duration_auto_repaired_20260617'), '')
    end
  from public.sport_session_items i
  join public.sport_sessions s on s.id = i.session_id
  where st.item_id = i.id
    and coalesce(st.duration_seconds, 0) <= 5
    and coalesce(s.duration_seconds, 0) >= 600
  returning i.session_id
),
affected_sessions as (
  select distinct session_id from repaired_sets
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
