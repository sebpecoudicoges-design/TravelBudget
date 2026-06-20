do $$
declare
  target_user_id uuid;
  merged_session_id uuid;
  source_count int;
begin
  select id
    into target_user_id
  from auth.users
  where email = 'seb.pecoud.icoges@gmail.com'
  limit 1;

  if target_user_id is null then
    return;
  end if;

  select id
    into merged_session_id
  from public.sport_sessions
  where user_id = target_user_id
    and (started_at at time zone 'Australia/Brisbane')::date = date '2026-06-19'
    and notes like 'Fusion SQL 19/06/2026:%'
  order by created_at asc
  limit 1;

  select count(*)
    into source_count
  from public.sport_sessions
  where user_id = target_user_id
    and id in (
      '6334d2e4-f3ae-4125-a2a9-fa5e061cd447',
      '48f21bb7-d820-4317-8fd5-7c21db38aa47',
      '81f2c230-9a16-4d70-97e0-4362ec375b57'
    );

  if merged_session_id is null and source_count >= 2 then
    insert into public.sport_sessions (
      user_id,
      travel_id,
      activity_type,
      started_at,
      ended_at,
      duration_seconds,
      mood_before,
      mood_after,
      energy,
      fatigue,
      pain,
      body_weight_kg,
      notes,
      estimated_kcal
    )
    select
      target_user_id,
      (array_agg(travel_id order by started_at asc nulls last))[1],
      'hiit',
      min(started_at),
      max(ended_at),
      sum(coalesce(duration_seconds, 0))::int,
      null,
      'Fusion 19/06',
      null,
      max(fatigue),
      null,
      max(body_weight_kg),
      'Fusion SQL 19/06/2026: mobilite + corde a sauter + gainage.',
      round(sum(coalesce(estimated_kcal, 0))::numeric, 2)
    from public.sport_sessions
    where user_id = target_user_id
      and id in (
        '6334d2e4-f3ae-4125-a2a9-fa5e061cd447',
        '48f21bb7-d820-4317-8fd5-7c21db38aa47',
        '81f2c230-9a16-4d70-97e0-4362ec375b57'
      )
    returning id into merged_session_id;

    create temp table if not exists tmp_sport_item_merge_map (
      old_item_id uuid primary key,
      new_item_id uuid not null,
      user_id uuid not null,
      activity_key text,
      exercise_name text,
      equipment text,
      mode text,
      target_reps numeric,
      target_seconds int,
      distance_m numeric,
      planned_sets int,
      rest_seconds int,
      sort_order int,
      met_value numeric,
      notes text
    ) on commit drop;

    truncate table tmp_sport_item_merge_map;

    insert into tmp_sport_item_merge_map (
      old_item_id,
      new_item_id,
      user_id,
      activity_key,
      exercise_name,
      equipment,
      mode,
      target_reps,
      target_seconds,
      distance_m,
      planned_sets,
      rest_seconds,
      sort_order,
      met_value,
      notes
    )
    select
      i.id,
      gen_random_uuid(),
      i.user_id,
      i.activity_key,
      i.exercise_name,
      i.equipment,
      i.mode,
      i.target_reps,
      i.target_seconds,
      i.distance_m,
      i.planned_sets,
      i.rest_seconds,
      (row_number() over (order by s.started_at, i.sort_order, i.created_at, i.id) - 1)::int,
      i.met_value,
      i.notes
    from public.sport_session_items i
    join public.sport_sessions s on s.id = i.session_id
    where s.user_id = target_user_id
      and s.id in (
        '6334d2e4-f3ae-4125-a2a9-fa5e061cd447',
        '48f21bb7-d820-4317-8fd5-7c21db38aa47',
        '81f2c230-9a16-4d70-97e0-4362ec375b57'
      );

    insert into public.sport_session_items (
      id,
      user_id,
      session_id,
      activity_key,
      exercise_name,
      equipment,
      mode,
      target_reps,
      target_seconds,
      distance_m,
      planned_sets,
      rest_seconds,
      sort_order,
      met_value,
      notes
    )
    select
      new_item_id,
      user_id,
      merged_session_id,
      activity_key,
      exercise_name,
      equipment,
      mode,
      target_reps,
      target_seconds,
      distance_m,
      planned_sets,
      rest_seconds,
      sort_order,
      met_value,
      notes
    from tmp_sport_item_merge_map
    order by sort_order;

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
      st.user_id,
      m.new_item_id,
      st.set_index,
      st.reps,
      st.duration_seconds,
      st.weight_kg,
      st.distance_m,
      st.completed_at,
      st.perceived_effort,
      st.notes
    from public.sport_sets st
    join tmp_sport_item_merge_map m on m.old_item_id = st.item_id
    order by m.sort_order, st.set_index, st.completed_at;
  end if;

  delete from public.sport_sets st
  using public.sport_session_items i
  where st.item_id = i.id
    and i.session_id in (
      '6334d2e4-f3ae-4125-a2a9-fa5e061cd447',
      '48f21bb7-d820-4317-8fd5-7c21db38aa47',
      '81f2c230-9a16-4d70-97e0-4362ec375b57'
    );

  delete from public.sport_session_items
  where session_id in (
    '6334d2e4-f3ae-4125-a2a9-fa5e061cd447',
    '48f21bb7-d820-4317-8fd5-7c21db38aa47',
    '81f2c230-9a16-4d70-97e0-4362ec375b57'
  );

  delete from public.sport_sessions
  where user_id = target_user_id
    and id in (
      '6334d2e4-f3ae-4125-a2a9-fa5e061cd447',
      '48f21bb7-d820-4317-8fd5-7c21db38aa47',
      '81f2c230-9a16-4d70-97e0-4362ec375b57'
    );
end $$;
