insert into public.sport_exercises
  (key, goal, equipment, activity_key, name_fr, name_en, mode, default_reps, default_seconds, default_sets, default_rest_seconds, distance_m, met_value, tags, sort_order)
values
  ('dumbbell_reverse_fly', 'strength', 'dumbbell', 'strength', 'Oiseau halteres', 'Dumbbell reverse fly', 'reps', 12, null, 3, 60, null, 4.8, array['halteres','pull','epaules','source_compendium_2024'], 475),
  ('barbell_good_morning', 'strength', 'barbell', 'strength', 'Good morning barre', 'Barbell good morning', 'reps', 8, null, 3, 90, null, 5.5, array['barre','jambes','ischios','source_compendium_2024'], 514),
  ('barbell_close_grip_bench', 'strength', 'barbell', 'strength', 'Developpe serre barre', 'Close-grip barbell bench', 'reps', 8, null, 4, 105, null, 5.8, array['barre','push','triceps','source_compendium_2024'], 515),
  ('barbell_pendlay_row', 'strength', 'barbell', 'strength', 'Rowing Pendlay', 'Pendlay row', 'reps', 6, null, 4, 105, null, 5.8, array['barre','pull','dos','source_compendium_2024'], 516),
  ('plate_halo', 'mobility', 'plate', 'mobility', 'Halo plate', 'Plate halo', 'reps', 10, null, 3, 45, null, 4.4, array['plate','disque','mobilite','epaules','source_compendium_2024'], 581),
  ('plate_squat', 'strength', 'plate', 'strength', 'Squat plate', 'Plate squat', 'reps', 12, null, 3, 75, null, 5.8, array['plate','disque','jambes','source_compendium_2024'], 582),
  ('plate_lunge', 'strength', 'plate', 'strength', 'Fentes plate', 'Plate lunge', 'reps', 10, null, 3, 75, null, 5.8, array['plate','disque','jambes','unilateral','source_compendium_2024'], 583),
  ('band_assisted_pullup', 'strength', 'band', 'resistance_band_strength', 'Traction assistee elastique', 'Band-assisted pull-up', 'reps', 6, null, 4, 90, null, 5.8, array['elastique','pull','dos','source_compendium_2024'], 428),
  ('band_good_morning', 'strength', 'band', 'resistance_band_strength', 'Good morning elastique', 'Band good morning', 'reps', 15, null, 3, 60, null, 4.8, array['elastique','jambes','ischios','source_compendium_2024'], 429),
  ('band_pallof_press', 'strength', 'band', 'core_abs', 'Pallof press elastique', 'Band Pallof press', 'reps', 10, null, 3, 45, null, 4.4, array['elastique','core','anti-rotation','source_compendium_2024'], 430),
  ('machine_pec_deck', 'strength', 'machine', 'strength', 'Pec deck', 'Pec deck', 'reps', 12, null, 3, 60, null, 4.8, array['machine','push','pectoraux','source_compendium_2024'], 618),
  ('cable_low_row', 'strength', 'machine', 'strength', 'Rowing poulie basse', 'Cable low row', 'reps', 10, null, 3, 75, null, 5.0, array['machine','pull','dos','source_compendium_2024'], 619)
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
