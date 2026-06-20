do $$
declare
  target_session_id uuid := 'd47e984f-854f-4330-ab2d-8aa58f7e6d08';
begin
  update public.sport_session_items
  set
    exercise_name = 'Rowing haltere un bras',
    equipment = 'dumbbell',
    notes = trim(both ' ' from concat_ws(' ', nullif(notes, ''), 'Correction 19/06: 30 kg, repetitions par cote.')),
    updated_at = now()
  where session_id = target_session_id
    and exercise_name = 'Rowing barre';

  with ranked_items as (
    select
      i.id,
      i.user_id,
      i.mode,
      i.target_reps,
      i.target_seconds,
      i.distance_m,
      i.planned_sets,
      i.exercise_name,
      coalesce(max(st.set_index), 0) as existing_sets
    from public.sport_session_items i
    left join public.sport_sets st on st.item_id = i.id
    where i.session_id = target_session_id
    group by i.id
  ),
  missing_sets as (
    select
      ri.*,
      gs as set_index
    from ranked_items ri
    cross join lateral generate_series(ri.existing_sets + 1, greatest(ri.existing_sets, coalesce(ri.planned_sets, 1))) as gs
    where ri.existing_sets < coalesce(ri.planned_sets, 1)
  )
  insert into public.sport_sets (
    user_id,
    item_id,
    set_index,
    reps,
    duration_seconds,
    weight_kg,
    distance_m,
    completed_at,
    perceived_effort,
    notes
  )
  select
    user_id,
    id,
    set_index,
    case when mode = 'reps' then target_reps else null end,
    coalesce(target_seconds, case when mode = 'reps' then 45 else 0 end),
    case when exercise_name = 'Rowing haltere un bras' then 30 else null end,
    nullif(distance_m, 0),
    timestamp with time zone '2026-06-19 07:35:13.627+00',
    null,
    case
      when exercise_name = 'Rowing haltere un bras' then 'Backfill 19/06: 30 kg, reps par cote.'
      else 'Backfill 19/06: serie planifiee reconstruite.'
    end
  from missing_sets
  order by exercise_name, set_index;
end $$;
