-- A stable key belongs to an account. Historical rows are claimed only on a matching retry.
alter table public.sport_sessions add column sync_key text;
create unique index sport_sessions_user_sync_key on public.sport_sessions(user_id,sync_key)
  where sync_key is not null;

create function public.sport_save_workout_v1(p_key text,p_rows jsonb)
returns uuid language plpgsql security invoker set search_path='' as $$
declare
  uid uuid := auth.uid();
  s public.sport_sessions;
  existing public.sport_sessions;
  i public.sport_session_items;
  saved public.sport_session_items;
  sid uuid;
  iid uuid;
  raw jsonb;
  wanted jsonb;
  actual jsonb;
  item_count int := 0;
begin
  if uid is null or (p_rows->'session'->>'user_id')::uuid is distinct from uid then
    raise exception 'Compte Sport invalide';
  end if;
  if nullif(trim(p_key),'') is null or length(p_key)>300
    or jsonb_typeof(p_rows->'items') is distinct from 'array'
    or jsonb_typeof(p_rows->'sets') is distinct from 'array' then raise exception 'Séance Sport invalide'; end if;
  s := jsonb_populate_record(null::public.sport_sessions,p_rows->'session');
  if s.started_at is null then raise exception 'Date de séance requise'; end if;
  -- Serialize even before a legacy parent acquires its first sync key.
  perform pg_advisory_xact_lock(hashtextextended(uid::text || ':' || extract(epoch from s.started_at)::text,0));
  select * into existing from public.sport_sessions where user_id=uid and sync_key=p_key for update;
  if not found then
    begin
      select * into strict existing from public.sport_sessions where user_id=uid and sync_key is null
        and started_at=s.started_at and activity_type=s.activity_type and duration_seconds=s.duration_seconds for update;
    exception when no_data_found then null;
      when too_many_rows then raise exception 'Plusieurs séances historiques correspondent';
    end;
  end if;
  if existing.id is null then
    insert into public.sport_sessions(user_id,sync_key,travel_id,activity_type,started_at,ended_at,duration_seconds,
      mood_after,fatigue,body_weight_kg,notes,estimated_kcal)
    values(uid,p_key,s.travel_id,s.activity_type,s.started_at,s.ended_at,s.duration_seconds,
      s.mood_after,s.fatigue,s.body_weight_kg,s.notes,s.estimated_kcal) returning id into sid;
  else
    if (existing.activity_type,existing.started_at,existing.ended_at,existing.duration_seconds,existing.mood_after,
      existing.fatigue,existing.body_weight_kg,existing.notes,existing.estimated_kcal) is distinct from
      (s.activity_type,s.started_at,s.ended_at,s.duration_seconds,s.mood_after,s.fatigue,s.body_weight_kg,s.notes,s.estimated_kcal)
      then raise exception 'La séance existante diffère de la copie locale'; end if;
    sid := existing.id;
    if existing.sync_key is null then update public.sport_sessions set sync_key=p_key where id=sid; end if;
  end if;

  for raw in select value from jsonb_array_elements(p_rows->'items') loop
    i := jsonb_populate_record(null::public.sport_session_items,raw);
    if i.sort_order is distinct from item_count then raise exception 'Ordre des exercices invalide'; end if;
    item_count := item_count+1;
    begin
      select * into strict saved from public.sport_session_items
        where user_id=uid and session_id=sid and sort_order=i.sort_order for update;
      if (saved.exercise_key,saved.activity_key,saved.exercise_name,saved.equipment,saved.mode,saved.target_reps,
        saved.target_seconds,saved.distance_m,saved.planned_sets,saved.rest_seconds,saved.met_value,saved.notes)
        is distinct from (i.exercise_key,i.activity_key,i.exercise_name,i.equipment,i.mode,i.target_reps,
        i.target_seconds,i.distance_m,i.planned_sets,i.rest_seconds,i.met_value,i.notes)
        then raise exception 'Exercice existant différent'; end if;
      iid := saved.id;
    exception when no_data_found then
      insert into public.sport_session_items(user_id,session_id,exercise_key,activity_key,exercise_name,equipment,mode,
        target_reps,target_seconds,distance_m,planned_sets,rest_seconds,sort_order,met_value,notes)
      values(uid,sid,i.exercise_key,i.activity_key,i.exercise_name,i.equipment,i.mode,i.target_reps,i.target_seconds,
        i.distance_m,i.planned_sets,i.rest_seconds,i.sort_order,i.met_value,i.notes) returning id into iid;
    end;
    -- Compare persisted values, including repeated sets. Preserve existing row identifiers.
    select coalesce(jsonb_agg(jsonb_build_array(x.set_index,x.reps,x.duration_seconds,x.weight_kg,x.distance_m,x.completed_at)),'[]') into wanted
      from jsonb_array_elements(p_rows->'sets') r cross join lateral jsonb_populate_record(null::public.sport_sets,r) x
      where (r->>'itemIndex')::int=i.sort_order;
    select coalesce(jsonb_agg(jsonb_build_array(x.set_index,x.reps,x.duration_seconds,x.weight_kg,x.distance_m,x.completed_at)),'[]') into actual
      from public.sport_sets x where x.item_id=iid and x.user_id=uid;
    if exists(select value from jsonb_array_elements(actual) except all select value from jsonb_array_elements(wanted))
      then raise exception 'Séries existantes différentes'; end if;
    insert into public.sport_sets(user_id,item_id,set_index,reps,duration_seconds,weight_kg,distance_m,completed_at)
      select uid,iid,(v->>0)::int,(v->>1)::int,(v->>2)::int,(v->>3)::numeric,(v->>4)::numeric,(v->>5)::timestamptz
      from (select value as v from jsonb_array_elements(wanted) except all select value from jsonb_array_elements(actual)) missing;
  end loop;
  if exists(select 1 from jsonb_array_elements(p_rows->'sets') r where r->>'itemIndex' is null
      or (r->>'itemIndex')::int not between 0 and item_count-1)
    or (select count(*) from public.sport_session_items where user_id=uid and session_id=sid)<>item_count then
    raise exception 'Exercice absent ou supplémentaire';
  end if;
  return sid;
end; $$;
revoke all on function public.sport_save_workout_v1(text,jsonb) from public,anon;
grant execute on function public.sport_save_workout_v1(text,jsonb) to authenticated;
