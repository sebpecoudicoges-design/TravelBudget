insert into public.sport_exercises
  (key, goal, equipment, activity_key, name_fr, name_en, mode, default_reps, default_seconds, default_sets, default_rest_seconds, distance_m, met_value, tags, sort_order)
values
  -- Poids du corps / force
  ('pushup', 'strength', 'bodyweight', 'bodyweight_strength', 'Pompes', 'Push-up', 'reps', 15, null, 3, 60, null, 5.2, array['poids_du_corps','push','pectoraux'], 200),
  ('incline_pushup', 'strength', 'bodyweight', 'bodyweight_strength', 'Pompes inclinees', 'Incline push-up', 'reps', 12, null, 3, 60, null, 4.8, array['poids_du_corps','push','pectoraux'], 201),
  ('diamond_pushup', 'strength', 'bodyweight', 'bodyweight_strength', 'Pompes serrees', 'Diamond push-up', 'reps', 8, null, 3, 75, null, 5.6, array['poids_du_corps','push','triceps'], 202),
  ('pike_pushup', 'strength', 'bodyweight', 'bodyweight_strength', 'Pike push-up', 'Pike push-up', 'reps', 8, null, 3, 75, null, 5.8, array['poids_du_corps','push','epaules'], 203),
  ('chair_dip', 'strength', 'bodyweight', 'bodyweight_strength', 'Dips sur chaise', 'Chair dips', 'reps', 10, null, 3, 60, null, 5.4, array['poids_du_corps','push','triceps'], 204),
  ('squat', 'strength', 'bodyweight', 'bodyweight_strength', 'Squat', 'Squat', 'reps', 20, null, 3, 60, null, 5.0, array['poids_du_corps','jambes','squat'], 205),
  ('lunge', 'strength', 'bodyweight', 'bodyweight_strength', 'Fentes', 'Lunges', 'reps', 12, null, 3, 60, null, 5.2, array['poids_du_corps','jambes','unilateral'], 206),
  ('reverse_lunge', 'strength', 'bodyweight', 'bodyweight_strength', 'Fentes arriere', 'Reverse lunge', 'reps', 10, null, 3, 60, null, 5.2, array['poids_du_corps','jambes','unilateral'], 207),
  ('step_up', 'strength', 'bodyweight', 'bodyweight_strength', 'Step-up', 'Step-up', 'reps', 10, null, 3, 60, null, 5.8, array['poids_du_corps','jambes','unilateral'], 208),
  ('glute_bridge', 'strength', 'bodyweight', 'bodyweight_strength', 'Pont fessier', 'Glute bridge', 'reps', 15, null, 3, 45, null, 4.0, array['poids_du_corps','fessiers'], 209),
  ('single_leg_glute_bridge', 'strength', 'bodyweight', 'bodyweight_strength', 'Pont fessier une jambe', 'Single-leg glute bridge', 'reps', 10, null, 3, 60, null, 4.6, array['poids_du_corps','fessiers','unilateral'], 210),
  ('wall_sit', 'strength', 'bodyweight', 'plank_core', 'Chaise murale', 'Wall sit', 'time', null, 45, 3, 60, null, 4.4, array['poids_du_corps','jambes','isometrique'], 211),
  ('calf_raise', 'strength', 'bodyweight', 'bodyweight_strength', 'Mollets debout', 'Standing calf raise', 'reps', 20, null, 3, 45, null, 3.8, array['poids_du_corps','mollets'], 212),
  ('pullup', 'strength', 'bodyweight', 'bodyweight_strength', 'Tractions', 'Pull-up', 'reps', 6, null, 4, 90, null, 6.0, array['poids_du_corps','dos','pull'], 220),
  ('chinup', 'strength', 'bodyweight', 'bodyweight_strength', 'Chin-up', 'Chin-up', 'reps', 6, null, 4, 90, null, 6.0, array['poids_du_corps','dos','biceps'], 221),
  ('australian_pullup', 'strength', 'bodyweight', 'bodyweight_strength', 'Tractions australiennes', 'Australian pull-up', 'reps', 10, null, 3, 75, null, 5.4, array['poids_du_corps','dos','pull'], 222),
  ('scap_pull', 'climb', 'bodyweight', 'bodyweight_strength', 'Tractions scapulaires', 'Scapular pulls', 'reps', 8, null, 3, 60, null, 4.8, array['poids_du_corps','dos','escalade'], 223),

  -- Core
  ('plank', 'strength', 'bodyweight', 'plank_core', 'Gainage', 'Plank', 'time', null, 45, 3, 60, null, 4.2, array['core','gainage'], 300),
  ('side_plank', 'strength', 'bodyweight', 'plank_core', 'Gainage lateral', 'Side plank', 'time', null, 35, 3, 45, null, 4.2, array['core','gainage'], 301),
  ('hollow_hold', 'strength', 'bodyweight', 'plank_core', 'Hollow hold', 'Hollow hold', 'time', null, 30, 3, 45, null, 4.4, array['core','gainage'], 302),
  ('dead_bug', 'strength', 'bodyweight', 'plank_core', 'Dead bug', 'Dead bug', 'reps', 10, null, 3, 45, null, 3.5, array['core','controle'], 303),
  ('crunch', 'strength', 'bodyweight', 'core_abs', 'Crunch', 'Crunch', 'reps', 20, null, 3, 45, null, 4.0, array['core','abdos'], 304),
  ('reverse_crunch', 'strength', 'bodyweight', 'core_abs', 'Crunch inverse', 'Reverse crunch', 'reps', 15, null, 3, 45, null, 4.2, array['core','abdos'], 305),
  ('bicycle_crunch', 'strength', 'bodyweight', 'core_abs', 'Crunch bicyclette', 'Bicycle crunch', 'reps', 20, null, 3, 45, null, 4.6, array['core','abdos'], 306),
  ('sit_up', 'strength', 'bodyweight', 'core_abs', 'Sit-up', 'Sit-up', 'reps', 15, null, 3, 60, null, 4.5, array['core','abdos'], 307),
  ('lying_leg_raise', 'strength', 'bodyweight', 'core_abs', 'Elevation jambes au sol', 'Lying leg raise', 'reps', 12, null, 3, 60, null, 4.3, array['core','abdos'], 308),
  ('hanging_knee_raise', 'strength', 'bodyweight', 'core_abs', 'Elevation genoux suspendu', 'Hanging knee raise', 'reps', 10, null, 3, 75, null, 5.0, array['core','barre'], 309),
  ('hanging_leg_raise', 'strength', 'bodyweight', 'core_abs', 'Elevation jambes suspendu', 'Hanging leg raise', 'reps', 8, null, 3, 90, null, 5.4, array['core','barre'], 310),
  ('toes_to_bar', 'strength', 'bodyweight', 'core_abs', 'Pieds a la barre', 'Toes to bar', 'reps', 6, null, 3, 90, null, 6.0, array['core','barre'], 311),
  ('flutter_kicks', 'strength', 'bodyweight', 'core_abs', 'Battements de jambes', 'Flutter kicks', 'time', null, 35, 3, 45, null, 4.5, array['core','abdos'], 312),
  ('v_up', 'strength', 'bodyweight', 'core_abs', 'V-up', 'V-up', 'reps', 10, null, 3, 60, null, 4.8, array['core','abdos'], 313),
  ('russian_twist', 'strength', 'bodyweight', 'core_abs', 'Russian twist', 'Russian twist', 'reps', 20, null, 3, 45, null, 4.4, array['core','rotation'], 314),

  -- Elastiques
  ('band_row', 'strength', 'band', 'resistance_band_strength', 'Tirage elastique', 'Band row', 'reps', 15, null, 3, 60, null, 4.8, array['elastique','dos','pull'], 400),
  ('band_lat_pulldown', 'strength', 'band', 'resistance_band_strength', 'Tirage vertical elastique', 'Band lat pulldown', 'reps', 15, null, 3, 60, null, 4.8, array['elastique','dos','pull'], 401),
  ('band_face_pull', 'strength', 'band', 'resistance_band_strength', 'Face pull elastique', 'Band face pull', 'reps', 15, null, 3, 45, null, 4.4, array['elastique','epaules','prehab'], 402),
  ('band_pull_apart', 'mobility', 'band', 'mobility', 'Ouverture epaules elastique', 'Band pull-apart', 'reps', 15, null, 2, 30, null, 3.2, array['elastique','epaules','mobilite'], 403),
  ('band_press', 'strength', 'band', 'resistance_band_strength', 'Presse elastique', 'Band chest press', 'reps', 12, null, 3, 60, null, 4.8, array['elastique','push','pectoraux'], 404),
  ('band_overhead_press', 'strength', 'band', 'resistance_band_strength', 'Developpe epaules elastique', 'Band overhead press', 'reps', 12, null, 3, 60, null, 4.8, array['elastique','push','epaules'], 405),
  ('band_curl', 'strength', 'band', 'resistance_band_strength', 'Curl elastique', 'Band curl', 'reps', 15, null, 3, 45, null, 4.0, array['elastique','bras','biceps'], 406),
  ('band_triceps', 'strength', 'band', 'resistance_band_strength', 'Extension triceps elastique', 'Band triceps extension', 'reps', 15, null, 3, 45, null, 4.0, array['elastique','bras','triceps'], 407),
  ('band_squat', 'strength', 'band', 'resistance_band_strength', 'Squat elastique', 'Band squat', 'reps', 15, null, 3, 60, null, 4.8, array['elastique','jambes','squat'], 408),
  ('band_deadlift', 'strength', 'band', 'resistance_band_strength', 'Souleve de terre elastique', 'Band deadlift', 'reps', 12, null, 3, 75, null, 5.0, array['elastique','jambes','chaine_posterieure'], 409),
  ('band_lateral_walk', 'strength', 'band', 'resistance_band_strength', 'Marche laterale elastique', 'Band lateral walk', 'reps', 12, null, 3, 45, null, 4.2, array['elastique','fessiers'], 410),
  ('band_hamstring_curl', 'strength', 'band', 'resistance_band_strength', 'Leg curl elastique', 'Band hamstring curl', 'reps', 12, null, 3, 45, null, 4.0, array['elastique','ischios'], 411),
  ('band_glute_kickback', 'strength', 'band', 'resistance_band_strength', 'Kickback fessier elastique', 'Band glute kickback', 'reps', 12, null, 3, 45, null, 4.0, array['elastique','fessiers'], 412),
  ('band_external_rotation', 'mobility', 'band', 'mobility', 'Rotation externe elastique', 'Band external rotation', 'reps', 12, null, 2, 25, null, 3.0, array['elastique','epaules','prehab'], 413),
  ('band_dislocates', 'mobility', 'band', 'mobility', 'Passage epaules elastique', 'Band shoulder pass-through', 'reps', 10, null, 2, 25, null, 3.0, array['elastique','epaules','mobilite'], 414),

  -- Haltères additionnels
  ('dumbbell_fly', 'strength', 'dumbbell', 'strength', 'Ecarte halteres', 'Dumbbell fly', 'reps', 10, null, 3, 75, null, 5.2, array['halteres','pectoraux','push'], 463),

  -- Barre
  ('barbell_squat', 'strength', 'barbell', 'strength', 'Squat barre', 'Barbell squat', 'reps', 6, null, 4, 120, null, 6.5, array['barre','jambes','squat'], 500),
  ('barbell_deadlift', 'strength', 'barbell', 'strength', 'Souleve de terre barre', 'Barbell deadlift', 'reps', 5, null, 4, 150, null, 6.8, array['barre','jambes','chaine_posterieure'], 501),
  ('barbell_bench', 'strength', 'barbell', 'strength', 'Developpe couche barre', 'Barbell bench press', 'reps', 6, null, 4, 120, null, 6.4, array['barre','pectoraux','push'], 502),
  ('barbell_row', 'strength', 'barbell', 'strength', 'Rowing barre', 'Barbell row', 'reps', 8, null, 4, 90, null, 6.2, array['barre','dos','pull'], 503),
  ('barbell_overhead_press', 'strength', 'barbell', 'strength', 'Developpe militaire barre', 'Barbell overhead press', 'reps', 6, null, 4, 120, null, 6.2, array['barre','epaules','push'], 504),
  ('barbell_hip_thrust', 'strength', 'barbell', 'strength', 'Hip thrust barre', 'Barbell hip thrust', 'reps', 8, null, 4, 90, null, 5.8, array['barre','fessiers'], 505),

  -- Kettlebell
  ('kettlebell_swing', 'strength', 'kettlebell', 'hiit', 'Swing kettlebell', 'Kettlebell swing', 'reps', 15, null, 4, 60, null, 7.4, array['kettlebell','chaine_posterieure','cardio'], 560),
  ('kettlebell_goblet', 'strength', 'kettlebell', 'strength', 'Goblet squat kettlebell', 'Kettlebell goblet squat', 'reps', 12, null, 3, 75, null, 6.0, array['kettlebell','jambes','squat'], 561),
  ('kettlebell_clean_press', 'strength', 'kettlebell', 'strength', 'Clean press kettlebell', 'Kettlebell clean and press', 'reps', 6, null, 3, 90, null, 7.0, array['kettlebell','full_body','push'], 562),
  ('kettlebell_turkish_getup', 'strength', 'kettlebell', 'strength', 'Turkish get-up kettlebell', 'Kettlebell Turkish get-up', 'reps', 4, null, 3, 90, null, 5.8, array['kettlebell','gainage','controle'], 563),

  -- Machines / salle
  ('machine_press', 'strength', 'machine', 'strength', 'Presse machine', 'Machine press', 'reps', 10, null, 3, 90, null, 5.4, array['machine','push','pectoraux'], 600),
  ('machine_leg_press', 'strength', 'machine', 'strength', 'Presse a cuisses', 'Leg press', 'reps', 10, null, 3, 90, null, 5.8, array['machine','jambes'], 601),
  ('machine_lat_pulldown', 'strength', 'machine', 'strength', 'Tirage vertical', 'Lat pulldown', 'reps', 10, null, 3, 75, null, 5.4, array['machine','dos','pull'], 602),
  ('machine_seated_row', 'strength', 'machine', 'strength', 'Rowing assis machine', 'Seated cable row', 'reps', 10, null, 3, 75, null, 5.4, array['machine','dos','pull'], 603),
  ('machine_leg_curl', 'strength', 'machine', 'strength', 'Leg curl', 'Leg curl', 'reps', 12, null, 3, 60, null, 4.8, array['machine','ischios'], 604),
  ('machine_leg_extension', 'strength', 'machine', 'strength', 'Leg extension', 'Leg extension', 'reps', 12, null, 3, 60, null, 4.8, array['machine','quadriceps'], 605),
  ('machine_cable_triceps', 'strength', 'machine', 'strength', 'Triceps poulie', 'Cable triceps pushdown', 'reps', 12, null, 3, 60, null, 4.6, array['machine','bras','triceps'], 606),
  ('machine_cable_curl', 'strength', 'machine', 'strength', 'Curl poulie', 'Cable curl', 'reps', 12, null, 3, 60, null, 4.6, array['machine','bras','biceps'], 607),
  ('machine_chest_fly', 'strength', 'machine', 'strength', 'Pec deck', 'Pec deck', 'reps', 12, null, 3, 60, null, 4.8, array['machine','pectoraux'], 608),
  ('machine_calf_raise', 'strength', 'machine', 'strength', 'Mollets machine', 'Machine calf raise', 'reps', 15, null, 3, 45, null, 4.2, array['machine','mollets'], 609),
  ('machine_treadmill', 'cardio', 'machine', 'running', 'Tapis de course', 'Treadmill run', 'time', null, 1200, 1, 0, 3000, 8.3, array['machine','cardio','course'], 640),
  ('machine_bike', 'cardio', 'machine', 'cycling', 'Velo d appartement', 'Stationary bike', 'time', null, 1800, 1, 0, null, 6.8, array['machine','cardio','velo'], 641),
  ('machine_elliptical', 'cardio', 'machine', 'hiit', 'Elliptique', 'Elliptical', 'time', null, 1200, 1, 0, null, 5.8, array['machine','cardio'], 642),
  ('rowing', 'cardio', 'machine', 'rowing', 'Rameur', 'Rowing machine', 'time', null, 300, 4, 90, null, 7.0, array['machine','cardio','rameur'], 643),
  ('rowing_easy', 'cardio', 'machine', 'rowing', 'Rameur facile', 'Easy rowing', 'time', null, 900, 1, 0, null, 5.8, array['machine','cardio','rameur'], 644),

  -- Cardio / extérieur / HIIT
  ('jump_rope', 'cardio', 'rope', 'jump_rope', 'Corde a sauter', 'Jump rope', 'time', null, 60, 10, 30, null, 12.0, array['cardio','corde','intense'], 700),
  ('jump_rope_easy', 'cardio', 'rope', 'jump_rope', 'Corde a sauter facile', 'Easy jump rope', 'time', null, 45, 8, 45, null, 9.8, array['cardio','corde'], 701),
  ('easy_run', 'cardio', 'outdoor', 'running', 'Course facile', 'Easy run', 'time', null, 1200, 1, 0, 3000, 8.3, array['cardio','course'], 720),
  ('run_intervals', 'cardio', 'outdoor', 'running', 'Intervalles course', 'Run intervals', 'time', null, 60, 8, 60, null, 10.5, array['cardio','course','intervalles'], 721),
  ('tempo_run', 'cardio', 'outdoor', 'running', 'Course tempo', 'Tempo run', 'time', null, 900, 1, 0, 2500, 9.8, array['cardio','course'], 722),
  ('hill_repeats', 'cardio', 'outdoor', 'running', 'Cotes repetees', 'Hill repeats', 'time', null, 45, 8, 90, null, 11.0, array['cardio','course','cotes'], 723),
  ('brisk_walk', 'cardio', 'outdoor', 'walking', 'Marche rapide', 'Brisk walk', 'time', null, 1800, 1, 0, 2500, 3.8, array['cardio','marche'], 724),
  ('hike_block', 'cardio', 'outdoor', 'hiking', 'Bloc randonnee', 'Hiking block', 'time', null, 3600, 1, 0, 5000, 6.0, array['cardio','randonnee'], 725),
  ('cycling_easy', 'cardio', 'outdoor', 'cycling', 'Velo facile', 'Easy cycling', 'time', null, 1800, 1, 0, null, 6.8, array['cardio','velo'], 726),
  ('cycling_intervals', 'cardio', 'outdoor', 'cycling', 'Intervalles velo', 'Cycling intervals', 'time', null, 120, 6, 90, null, 8.6, array['cardio','velo','intervalles'], 727),
  ('mountain_climber', 'cardio', 'bodyweight', 'hiit', 'Mountain climbers', 'Mountain climbers', 'time', null, 40, 6, 20, null, 8.0, array['hiit','core','cardio'], 740),
  ('burpee', 'cardio', 'bodyweight', 'hiit', 'Burpees', 'Burpees', 'reps', 8, null, 5, 45, null, 8.8, array['hiit','full_body'], 741),
  ('jumping_jack', 'cardio', 'bodyweight', 'hiit', 'Jumping jacks', 'Jumping jacks', 'time', null, 45, 5, 20, null, 7.2, array['hiit','cardio'], 742),
  ('hiit_bodyweight', 'cardio', 'bodyweight', 'hiit', 'HIIT poids du corps', 'Bodyweight HIIT', 'time', null, 40, 8, 20, null, 7.8, array['hiit','poids_du_corps'], 743),
  ('box_jump', 'cardio', 'bodyweight', 'hiit', 'Box jump', 'Box jump', 'reps', 10, null, 5, 60, null, 8.0, array['hiit','jambes','plyo'], 744),
  ('wall_ball', 'cardio', 'mixed', 'hiit', 'Wall ball', 'Wall ball', 'reps', 15, null, 5, 60, null, 7.6, array['hiit','jambes','push'], 745),
  ('table_tennis', 'cardio', 'mixed', 'table_tennis', 'Ping-pong', 'Table tennis', 'time', null, 600, 1, 0, null, 4.0, array['cardio','coordination'], 760),
  ('basketball_1h', 'basketball', 'outdoor', 'basketball', 'Basket', 'Basketball', 'time', null, 3600, 1, 0, null, 6.5, array['basket','cardio'], 770),
  ('basketball_shootaround', 'basketball', 'outdoor', 'basketball', 'Shoot basket', 'Basketball shootaround', 'time', null, 1800, 1, 0, null, 4.5, array['basket','technique'], 771),

  -- Boxe
  ('boxing_heavy_bag', 'boxing', 'boxing', 'boxing', 'Sac de frappe', 'Heavy bag rounds', 'time', null, 180, 6, 60, null, 12.8, array['boxe','sac','intense'], 800),
  ('boxing_bag_combo_rounds', 'boxing', 'boxing', 'boxing', 'Rounds combo au sac', 'Heavy bag combo rounds', 'time', null, 180, 8, 60, null, 12.8, array['boxe','sac','combos'], 801),
  ('boxing_speed_bag', 'boxing', 'boxing', 'boxing', 'Poire de vitesse', 'Speed bag', 'time', null, 120, 5, 45, null, 5.8, array['boxe','coordination'], 802),
  ('boxing_shadow', 'boxing', 'bodyweight', 'boxing', 'Shadow boxing', 'Shadow boxing', 'time', null, 180, 5, 45, null, 7.0, array['boxe','technique','cardio'], 803),
  ('boxing_mitts', 'boxing', 'boxing', 'boxing', 'Pattes d ours', 'Focus mitts', 'time', null, 180, 6, 60, null, 8.0, array['boxe','partenaire','explosivite'], 804),
  ('boxing_light_sparring', 'boxing', 'boxing', 'boxing', 'Sparring leger', 'Light sparring', 'time', null, 180, 4, 90, null, 8.2, array['boxe','sparring'], 805),
  ('boxing_footwork', 'boxing', 'bodyweight', 'boxing', 'Footwork boxe', 'Boxing footwork', 'time', null, 120, 6, 45, null, 6.5, array['boxe','deplacements'], 806),
  ('boxing_slips', 'boxing', 'bodyweight', 'boxing', 'Esquives et slips', 'Slips and defensive drills', 'time', null, 90, 6, 30, null, 5.8, array['boxe','defense'], 807),
  ('boxing_burpees', 'boxing', 'bodyweight', 'hiit', 'Burpees boxe', 'Boxing burpees', 'reps', 8, null, 5, 45, null, 8.5, array['boxe','hiit'], 808),
  ('boxing_jump_rope', 'boxing', 'rope', 'jump_rope', 'Corde a sauter boxe', 'Boxing jump rope', 'time', null, 180, 5, 45, null, 11.8, array['boxe','corde','cardio'], 809),

  -- Mobilite / recup
  ('hips', 'mobility', 'mat', 'mobility', 'Mobilite hanches', 'Hip mobility', 'time', null, 60, 3, 20, null, 2.5, array['mobilite','hanches'], 900),
  ('shoulders', 'mobility', 'mat', 'mobility', 'Mobilite epaules', 'Shoulder mobility', 'time', null, 60, 3, 20, null, 2.3, array['mobilite','epaules'], 901),
  ('breathing', 'mobility', 'mat', 'yoga', 'Respiration / relachement', 'Breathing / release', 'time', null, 180, 1, 0, null, 1.8, array['recuperation','respiration'], 902),
  ('cat_cow', 'mobility', 'mat', 'mobility', 'Dos rond dos creux', 'Cat-cow', 'time', null, 45, 2, 15, null, 2.0, array['mobilite','dos'], 903),
  ('thoracic_rotation', 'mobility', 'mat', 'mobility', 'Rotation thoracique', 'Thoracic rotation', 'reps', 8, null, 2, 20, null, 2.2, array['mobilite','dos'], 904),
  ('ankle_mobility', 'mobility', 'mat', 'mobility', 'Mobilite chevilles', 'Ankle mobility', 'time', null, 45, 2, 20, null, 2.1, array['mobilite','chevilles'], 905),
  ('hamstring_flow', 'mobility', 'mat', 'yoga', 'Flow ischios', 'Hamstring flow', 'time', null, 90, 2, 20, null, 2.3, array['mobilite','ischios'], 906),
  ('world_greatest_stretch', 'mobility', 'mat', 'mobility', 'World greatest stretch', 'World greatest stretch', 'time', null, 60, 2, 20, null, 2.6, array['mobilite','full_body'], 907),
  ('couch_stretch', 'mobility', 'mat', 'mobility', 'Etirement psoas', 'Couch stretch', 'time', null, 60, 2, 20, null, 2.0, array['mobilite','psoas'], 908),
  ('deep_squat_hold', 'mobility', 'bodyweight', 'mobility', 'Squat profond tenu', 'Deep squat hold', 'time', null, 60, 2, 30, null, 2.6, array['mobilite','hanches','chevilles'], 909),
  ('wrist_mobility', 'mobility', 'mat', 'mobility', 'Mobilite poignets', 'Wrist mobility', 'time', null, 45, 2, 15, null, 2.0, array['mobilite','poignets'], 910),
  ('neck_mobility', 'mobility', 'mat', 'mobility', 'Mobilite nuque', 'Neck mobility', 'time', null, 45, 2, 15, null, 1.8, array['mobilite','nuque'], 911),
  ('scapular_wall_slide', 'mobility', 'bodyweight', 'mobility', 'Wall slide scapulaire', 'Scapular wall slide', 'reps', 10, null, 2, 25, null, 2.4, array['mobilite','epaules'], 912),
  ('calf_stretch_flow', 'mobility', 'mat', 'mobility', 'Flow mollets chevilles', 'Calf and ankle flow', 'time', null, 60, 2, 20, null, 2.2, array['mobilite','mollets','chevilles'], 913)
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

-- Repair the 2026-06-12 synced workout that had items but no persisted set rows.
insert into public.sport_sets
  (user_id, item_id, set_index, reps, duration_seconds, weight_kg, distance_m, completed_at, notes)
select
  i.user_id,
  i.id,
  gs.set_index,
  case when i.mode = 'reps' then i.target_reps else null end,
  coalesce(i.target_seconds, case when i.mode = 'reps' then 45 else null end),
  null,
  i.distance_m,
  s.started_at + make_interval(secs => (
    greatest(i.sort_order, 0) * 600
    + (gs.set_index - 1) * (coalesce(i.target_seconds, 45) + coalesce(i.rest_seconds, 0))
  )),
  'Serie reconstruite depuis le plan synchronise du 2026-06-12.'
from public.sport_sessions s
join public.sport_session_items i on i.session_id = s.id
cross join lateral generate_series(1, greatest(coalesce(i.planned_sets, 1), 1)) as gs(set_index)
where s.id = '8c8c9041-7d13-40a7-bad6-c12b78333c9b'
  and not exists (
    select 1
    from public.sport_sets existing
    where existing.item_id = i.id
      and existing.set_index = gs.set_index
  );
