-- Administrative connection, then genuine authenticated role with a synthetic workout.
begin;
select set_config('request.jwt.claim.sub',(select id::text from auth.users limit 1),true);
set local role authenticated;
do $test$
declare
  uid uuid := auth.uid();
  k text := gen_random_uuid()::text;
  started timestamptz := '1981-03-14 09:01:27Z';
  sid uuid;
  iid uuid;
  setid uuid;
  failed boolean;
  bad jsonb;
  s jsonb := jsonb_build_object('user_id',uid,'activity_type','strength','started_at',started,
    'ended_at',started+interval '10 minutes','duration_seconds',600,'estimated_kcal',50);
  i jsonb := '{"activity_key":"strength","exercise_name":"Audit","equipment":"mixed","mode":"reps","planned_sets":2,"rest_seconds":0,"sort_order":0}';
  z jsonb := jsonb_build_object('itemIndex',0,'set_index',1,'reps',12,'weight_kg',15,'duration_seconds',10,'completed_at',started);
  rows jsonb := jsonb_build_object('session',s,'items',jsonb_build_array(i),'sets',jsonb_build_array(z,z||'{"set_index":2,"reps":8}'));
begin
  foreach bad in array array[
    jsonb_set(rows,'{items,0,sort_order}','3'),
    jsonb_set(rows,'{sets,0,reps}','"bad"'),
    jsonb_set(rows,'{sets,1,itemIndex}','5')
  ] loop
    failed := false;
    begin perform public.sport_save_workout_v1(k,bad);
    exception when raise_exception or invalid_text_representation then failed:=true; end;
    if not failed or exists(select 1 from public.sport_sessions where sync_key=k) then raise exception 'Partial save'; end if;
  end loop;
  -- The previous client may have committed just the parent.
  insert into public.sport_sessions(user_id,activity_type,started_at,ended_at,duration_seconds,estimated_kcal)
    values(uid,'strength',started,started+interval '10 minutes',600,50) returning id into sid;
  if public.sport_save_workout_v1(k,rows)<>sid then raise exception 'Duplicated historical session'; end if;
  select id into strict iid from public.sport_session_items where session_id=sid;
  select id into strict setid from public.sport_sets where item_id=iid and set_index=1 and reps=12 and weight_kg=15;
  -- Simulate a prior partial set collection, then a lost acknowledgement.
  delete from public.sport_sets where item_id=iid and set_index=2;
  perform public.sport_save_workout_v1(k,rows);
  perform public.sport_save_workout_v1(k,rows);
  if (select count(*) from public.sport_sets where item_id=iid)<>2
    or not exists(select 1 from public.sport_sets where id=setid)
    or not exists(select 1 from public.sport_sets where item_id=iid and set_index=2 and reps=8 and weight_kg=15)
    then raise exception 'Missing or duplicated sets after retry'; end if;
  failed:=false;
  begin perform public.sport_save_workout_v1(k,jsonb_set(rows,'{sets,0,reps}','99'));
  exception when raise_exception then failed:=true; end;
  if not failed or (select reps from public.sport_sets where id=setid)<>12 then raise exception 'Conflicting payload accepted'; end if;
  failed:=false;
  begin perform public.sport_save_workout_v1(k,jsonb_set(rows,'{session,user_id}',to_jsonb(gen_random_uuid())));
  exception when raise_exception then failed:=true; end;
  if not failed then raise exception 'Foreign user accepted'; end if;
end; $test$;
rollback;
select 'sport atomic regression passed; all writes rolled back' as result;
