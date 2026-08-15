-- A stable exercise identity joins catalog entries, workout history and program
-- progression. Technique variants (front squat, incline/close-grip press, RDL)
-- deliberately keep their own keys.
alter table public.sport_session_items
  add column if not exists exercise_key text references public.sport_exercises(key) on delete set null;

create index if not exists sport_session_items_user_exercise_recent_idx
  on public.sport_session_items(user_id, exercise_key, updated_at desc)
  where exercise_key is not null;

with canonical_names(name_key, equipment, exercise_key) as (values
  ('squat arriere','barbell','barbell_back_squat'), ('squat barre','barbell','barbell_back_squat'),
  ('barbell back squat','barbell','barbell_back_squat'), ('barbell squat','barbell','barbell_back_squat'),
  ('developpe couche','barbell','barbell_bench_press'), ('developpe couche barre','barbell','barbell_bench_press'),
  ('bench press','barbell','barbell_bench_press'), ('barbell bench press','barbell','barbell_bench_press'),
  ('developpe couche prise serree','barbell','barbell_close_grip_bench_press'),
  ('front squat','barbell','barbell_front_squat'), ('souleve de terre','barbell','barbell_deadlift'),
  ('souleve de terre roumain','barbell','barbell_romanian_deadlift'),
  ('developpe militaire','barbell','barbell_overhead_press'), ('developpe militaire barre','barbell','barbell_overhead_press'),
  ('rowing barre','barbell','barbell_row'), ('developpe incline halteres','dumbbell','dumbbell_incline_press'),
  ('curl marteau','dumbbell','dumbbell_hammer_curl'), ('elevations laterales','dumbbell','dumbbell_lateral_raise'),
  ('extension triceps','dumbbell','triceps_extension'), ('oiseau halteres','dumbbell','dumbbell_rear_delt_fly'),
  ('gainage','bodyweight','plank'), ('gainage lateral','bodyweight','side_plank'),
  ('releves de jambes','bodyweight','lying_leg_raise_ab'),
  ('tractions pronation','bodyweight','pullup_pronation'), ('tractions pronation lestees','bodyweight','pullup_pronation'),
  ('tractions supination','bodyweight','pullup_supination'), ('tractions supination lestees','bodyweight','pullup_supination')
), normalized_items as (
  select i.id, c.exercise_key
  from public.sport_session_items i
  join canonical_names c
    on c.name_key = trim(translate(lower(i.exercise_name),'éèêëàâäîïôöùûüç','eeeeaaaiioouuuc'))
   and c.equipment = lower(i.equipment)
)
update public.sport_session_items i
set exercise_key = n.exercise_key, updated_at = now()
from normalized_items n
where n.id = i.id and i.exercise_key is distinct from n.exercise_key;

-- The translate above intentionally covers stored French accents. Correct any
-- rows that used the two historical duplicate catalog keys before retiring them.
update public.sport_program_exercises
set exercise_key = case exercise_key
  when 'barbell_squat' then 'barbell_back_squat'
  when 'barbell_bench' then 'barbell_bench_press'
  when 'plank_program' then 'plank'
  when 'side_plank_program' then 'side_plank'
  when 'dumbbell_reverse_fly' then 'dumbbell_rear_delt_fly'
  else exercise_key end,
  updated_at = now()
where exercise_key in ('barbell_squat','barbell_bench','plank_program','side_plank_program','dumbbell_reverse_fly');

with canonical_names(name_key, equipment, exercise_key) as (values
  ('squat arriere','barbell','barbell_back_squat'), ('squat barre','barbell','barbell_back_squat'),
  ('developpe couche','barbell','barbell_bench_press'), ('developpe couche barre','barbell','barbell_bench_press'),
  ('developpe couche prise serree','barbell','barbell_close_grip_bench_press'),
  ('front squat','barbell','barbell_front_squat'), ('souleve de terre','barbell','barbell_deadlift'),
  ('developpe militaire','barbell','barbell_overhead_press'), ('rowing barre','barbell','barbell_row'),
  ('developpe incline halteres','dumbbell','dumbbell_incline_press'), ('curl marteau','dumbbell','dumbbell_hammer_curl'),
  ('elevations laterales','dumbbell','dumbbell_lateral_raise'), ('extension triceps','dumbbell','triceps_extension'),
  ('oiseau halteres','dumbbell','dumbbell_rear_delt_fly'), ('gainage','bodyweight','plank'),
  ('gainage lateral','bodyweight','side_plank'), ('releves de jambes','bodyweight','lying_leg_raise_ab'),
  ('tractions pronation','bodyweight','pullup_pronation'), ('tractions pronation lestees','bodyweight','pullup_pronation'),
  ('tractions supination','bodyweight','pullup_supination'), ('tractions supination lestees','bodyweight','pullup_supination')
)
update public.sport_program_exercises e
set exercise_key = c.exercise_key, updated_at = now()
from canonical_names c
where c.name_key = trim(translate(lower(e.exercise_name),'éèêëàâäîïôöùûüç','eeeeaaaiioouuuc'))
  and c.equipment = lower(e.equipment)
  and e.exercise_key is distinct from c.exercise_key;

-- Adapt only the matching program variant (same target rep floor) from the most
-- recent completed workout. A validated top-of-range workout earns one increment;
-- otherwise the actual latest load becomes the non-regression floor.
with latest_items as (
  select distinct on (i.user_id, i.exercise_key)
    i.user_id, i.exercise_key, i.id item_id, i.target_reps, se.started_at
  from public.sport_session_items i
  join public.sport_sessions se on se.id = i.session_id
  where i.exercise_key is not null
  order by i.user_id, i.exercise_key, se.started_at desc, i.sort_order desc
), latest_performance as (
  select li.user_id, li.exercise_key, li.target_reps,
    max(s.weight_kg) latest_weight_kg,
    min(s.weight_kg) min_weight_kg,
    min(s.reps) min_reps,
    count(*) filter (where s.weight_kg > 0 and s.reps > 0) valid_sets
  from latest_items li
  join public.sport_sets s on s.item_id = li.item_id
  where s.weight_kg > 0 and s.reps > 0
  group by li.user_id, li.exercise_key, li.target_reps
), adapted as (
  select e.id,
    case when lp.min_weight_kg = lp.latest_weight_kg
           and lp.valid_sets >= e.planned_sets
           and lp.min_reps >= coalesce(e.rep_max, e.target_reps, 1)
      then lp.latest_weight_kg + e.progression_increment_kg
      else lp.latest_weight_kg end next_weight_kg
  from public.sport_program_exercises e
  join public.sport_program_sessions ps on ps.id = e.session_id
  join public.sport_programs p on p.id = ps.program_id
  join latest_performance lp on lp.user_id = p.user_id and lp.exercise_key = e.exercise_key
  where coalesce(lp.target_reps, e.rep_min, e.target_reps) = coalesce(e.rep_min, e.target_reps)
)
update public.sport_program_exercises e
set default_weight_kg = greatest(coalesce(e.default_weight_kg, 0), a.next_weight_kg), updated_at = now()
from adapted a
where a.id = e.id and a.next_weight_kg > coalesce(e.default_weight_kg, 0);

comment on column public.sport_session_items.exercise_key is
  'Canonical sport_exercises key used to join aliases across history, progression and programs.';

insert into public.app_test_scenarios (
  id, campaign_id, module_id, title, instructions, expected_result, required, sort_order
)
select scenario.id, campaign.id, module.id, scenario.title, scenario.instructions, scenario.expected_result, true, scenario.sort_order
from public.app_test_campaigns campaign
join public.app_test_modules module on module.campaign_id = campaign.id and module.module_key = 'sport'
cross join (values
  ('34600000-0000-4000-8000-000000000001'::uuid, 'Retest exercices unifies Sport 10.5.346', 'Ajouter successivement Squat arriere, Squat barre et Barbell back squat puis verifier les favoris, l historique et la progression.', 'Les trois libelles utilisent une seule identite barbell_back_squat, sans doublon de progression; front squat reste distinct.', 3461),
  ('34600000-0000-4000-8000-000000000002'::uuid, 'Retest reprise de charge Sport 10.5.346', 'Ouvrir la prochaine seance contenant Squat arriere apres la seance validee a 100 kg.', 'La charge proposee ne retombe jamais a 82,5 kg : elle reprend au moins la derniere charge validee et affiche 102,5 kg lorsque toutes les series ont atteint le haut de plage.', 3462),
  ('34600000-0000-4000-8000-000000000003'::uuid, 'Retest adaptation programme Sport 10.5.346', 'Terminer un exercice de programme avec une charge superieure puis rouvrir Programme et la prochaine seance.', 'Seule la variante de programme correspondante progresse; sa charge augmente ou conserve le dernier plancher valide sans baisse automatique.', 3463)
) as scenario(id, title, instructions, expected_result, sort_order)
where campaign.slug = 'stabilisation-modules-10-5-316'
on conflict (id) do update set title=excluded.title, instructions=excluded.instructions,
  expected_result=excluded.expected_result, required=excluded.required, sort_order=excluded.sort_order;

update public.app_test_campaigns set app_version='10.5.346', updated_at=now()
where slug='stabilisation-modules-10-5-316';
