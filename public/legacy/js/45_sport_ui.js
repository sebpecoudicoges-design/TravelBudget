/* =========================
   Sport module (V1)
   - Sessions, guided timer, reps/time/rest, MET kcal estimates
   ========================= */
(function () {
  const baseHistoryKey = () => window.TB_CONST?.LS_KEYS?.sport_history || "travelbudget_sport_history_v1";
  const scopedKey = (key) => `${key}::${sportStorageScope()}`;
  const PLAN_KEY = () => scopedKey(window.TB_CONST?.LS_KEYS?.sport_plan || "travelbudget_sport_plan_v1");
  const WEIGHT_KEY = () => scopedKey(window.TB_CONST?.LS_KEYS?.sport_body_weight || "travelbudget_sport_body_weight_v1");
  const HEIGHT_KEY = () => scopedKey(window.TB_CONST?.LS_KEYS?.sport_body_height || "travelbudget_sport_body_height_v1");
  const GLOBAL_REST_KEY = () => scopedKey(window.TB_CONST?.LS_KEYS?.sport_global_rest || "travelbudget_sport_global_rest_v1");
  const LIBRARY_KEY = () => window.TB_CONST?.LS_KEYS?.sport_library || "travelbudget_sport_library_v1";
  const CIRCUIT_KEY = () => scopedKey("travelbudget_sport_circuit_v1");
  const DELETE_QUEUE_KEY = () => scopedKey("travelbudget_sport_delete_queue_v1");
  const HISTORY_KEY = () => scopedKey(baseHistoryKey());
  const ANON_HISTORY_KEY = () => `${baseHistoryKey()}::anon`;
  const RECOVERY_MET = 1.3;

  const CATALOG = [
    { key: "strength", fr: "Musculation", en: "Strength training", met: 5.0, mode: "reps", equipment: "bodyweight" },
    { key: "bodyweight_strength", fr: "Musculation poids du corps", en: "Bodyweight strength", met: 5.2, mode: "reps", equipment: "bodyweight" },
    { key: "resistance_band_strength", fr: "Renforcement elastique", en: "Resistance band strength", met: 4.8, mode: "reps", equipment: "band" },
    { key: "core_abs", fr: "Abdos / core", en: "Abs / core", met: 4.5, mode: "reps", equipment: "bodyweight" },
    { key: "plank_core", fr: "Gainage / core", en: "Core / plank", met: 4.2, mode: "time", equipment: "bodyweight" },
    { key: "running", fr: "Course a pied", en: "Running", met: 8.3, mode: "time", equipment: "outdoor" },
    { key: "cycling", fr: "Velo", en: "Cycling", met: 6.8, mode: "time", equipment: "outdoor" },
    { key: "swimming", fr: "Natation", en: "Swimming", met: 6.0, mode: "time", equipment: "pool" },
    { key: "climbing", fr: "Escalade", en: "Climbing", met: 8.0, mode: "time", equipment: "wall" },
    { key: "walking", fr: "Marche rapide", en: "Brisk walk", met: 3.8, mode: "time", equipment: "outdoor" },
    { key: "hiking", fr: "Randonnee", en: "Hiking", met: 6.0, mode: "time", equipment: "outdoor" },
    { key: "rowing", fr: "Rameur", en: "Rowing", met: 7.0, mode: "time", equipment: "machine" },
    { key: "jump_rope", fr: "Corde a sauter", en: "Jump rope", met: 12.0, mode: "time", equipment: "rope" },
    { key: "basketball", fr: "Basket", en: "Basketball", met: 6.5, mode: "time", equipment: "outdoor" },
    { key: "table_tennis", fr: "Ping-pong", en: "Table tennis", met: 4.0, mode: "time", equipment: "mixed" },
    { key: "boxing", fr: "Boxe", en: "Boxing", met: 12.8, mode: "time", equipment: "boxing" },
    { key: "hiit", fr: "HIIT", en: "HIIT", met: 7.8, mode: "time", equipment: "mixed" },
    { key: "yoga", fr: "Yoga", en: "Yoga", met: 2.5, mode: "time", equipment: "mat" },
    { key: "mobility", fr: "Mobilite", en: "Mobility", met: 2.0, mode: "time", equipment: "mat" },
  ];

  const EQUIPMENT = [
    ["bodyweight", "Poids du corps", "Bodyweight"],
    ["machine", "Machine", "Machine"],
    ["dumbbell", "Halteres", "Dumbbells"],
    ["barbell", "Barre", "Barbell"],
    ["band", "Elastique", "Resistance band"],
    ["kettlebell", "Kettlebell", "Kettlebell"],
    ["rope", "Corde a sauter", "Jump rope"],
    ["boxing", "Boxe", "Boxing"],
    ["outdoor", "Exterieur", "Outdoor"],
    ["pool", "Piscine", "Pool"],
    ["wall", "Mur / voie", "Wall / route"],
    ["mat", "Tapis", "Mat"],
    ["mixed", "Mixte", "Mixed"],
  ];

  const GOALS = [
    ["strength", "Force", "Strength"],
    ["cardio", "Cardio", "Cardio"],
    ["boxing", "Boxe", "Boxing"],
    ["basketball", "Basket", "Basketball"],
    ["mobility", "Mobilite", "Mobility"],
    ["climb", "Escalade", "Climbing"],
    ["swim", "Natation", "Swimming"],
    ["free", "Libre", "Free"],
  ];
  const LEVELS = [
    ["beginner", "Debutant", "Beginner"],
    ["regular", "Intermediaire", "Regular"],
    ["advanced", "Avance", "Advanced"],
  ];

  const EXERCISE_LIBRARY = [
    { key: "pushup", goal: "strength", equipment: "bodyweight", activityKey: "bodyweight_strength", fr: "Push-up", en: "Push-up", mode: "reps", reps: 15, sets: 3, rest: 60 },
    { key: "squat", goal: "strength", equipment: "bodyweight", activityKey: "bodyweight_strength", fr: "Squat", en: "Squat", mode: "reps", reps: 20, sets: 3, rest: 60 },
    { key: "lunge", goal: "strength", equipment: "bodyweight", activityKey: "bodyweight_strength", fr: "Fentes", en: "Lunges", mode: "reps", reps: 12, sets: 3, rest: 60 },
    { key: "plank", goal: "strength", equipment: "bodyweight", activityKey: "plank_core", fr: "Gainage", en: "Plank", mode: "time", seconds: 45, sets: 3, rest: 60 },
    { key: "incline_pushup", goal: "strength", equipment: "bodyweight", activityKey: "bodyweight_strength", fr: "Push-up incline", en: "Incline push-up", mode: "reps", reps: 12, sets: 3, rest: 60 },
    { key: "diamond_pushup", goal: "strength", equipment: "bodyweight", activityKey: "bodyweight_strength", fr: "Push-up serre", en: "Diamond push-up", mode: "reps", reps: 8, sets: 3, rest: 75 },
    { key: "glute_bridge", goal: "strength", equipment: "bodyweight", activityKey: "bodyweight_strength", fr: "Pont fessier", en: "Glute bridge", mode: "reps", reps: 15, sets: 3, rest: 45 },
    { key: "calf_raise", goal: "strength", equipment: "bodyweight", activityKey: "bodyweight_strength", fr: "Mollets debout", en: "Standing calf raise", mode: "reps", reps: 20, sets: 3, rest: 45 },
    { key: "side_plank", goal: "strength", equipment: "bodyweight", activityKey: "plank_core", fr: "Gainage lateral", en: "Side plank", mode: "time", seconds: 35, sets: 3, rest: 45 },
    { key: "dead_bug", goal: "strength", equipment: "bodyweight", activityKey: "plank_core", fr: "Dead bug", en: "Dead bug", mode: "reps", reps: 10, sets: 3, rest: 45 },
    { key: "pike_pushup", goal: "strength", equipment: "bodyweight", activityKey: "bodyweight_strength", fr: "Pike push-up", en: "Pike push-up", mode: "reps", reps: 8, sets: 3, rest: 75 },
    { key: "chair_dip", goal: "strength", equipment: "bodyweight", activityKey: "bodyweight_strength", fr: "Dips sur chaise", en: "Chair dips", mode: "reps", reps: 10, sets: 3, rest: 60 },
    { key: "single_leg_glute_bridge", goal: "strength", equipment: "bodyweight", activityKey: "bodyweight_strength", fr: "Pont fessier une jambe", en: "Single-leg glute bridge", mode: "reps", reps: 10, sets: 3, rest: 60 },
    { key: "wall_sit", goal: "strength", equipment: "bodyweight", activityKey: "plank_core", fr: "Chaise murale", en: "Wall sit", mode: "time", seconds: 45, sets: 3, rest: 60 },
    { key: "reverse_lunge", goal: "strength", equipment: "bodyweight", activityKey: "bodyweight_strength", fr: "Fente arriere", en: "Reverse lunge", mode: "reps", reps: 10, sets: 3, rest: 60 },
    { key: "step_up", goal: "strength", equipment: "bodyweight", activityKey: "bodyweight_strength", fr: "Step-up", en: "Step-up", mode: "reps", reps: 10, sets: 3, rest: 60 },
    { key: "hollow_hold", goal: "strength", equipment: "bodyweight", activityKey: "plank_core", fr: "Hollow hold", en: "Hollow hold", mode: "time", seconds: 30, sets: 3, rest: 45 },
    { key: "crunch", goal: "strength", equipment: "bodyweight", activityKey: "core_abs", fr: "Crunch", en: "Crunch", mode: "reps", reps: 20, sets: 3, rest: 45 },
    { key: "reverse_crunch", goal: "strength", equipment: "bodyweight", activityKey: "core_abs", fr: "Crunch inverse", en: "Reverse crunch", mode: "reps", reps: 15, sets: 3, rest: 45 },
    { key: "bicycle_crunch", goal: "strength", equipment: "bodyweight", activityKey: "core_abs", fr: "Crunch bicyclette", en: "Bicycle crunch", mode: "reps", reps: 20, sets: 3, rest: 45 },
    { key: "sit_up", goal: "strength", equipment: "bodyweight", activityKey: "core_abs", fr: "Sit-up", en: "Sit-up", mode: "reps", reps: 15, sets: 3, rest: 60 },
    { key: "lying_leg_raise", goal: "strength", equipment: "bodyweight", activityKey: "core_abs", fr: "Elevation jambes au sol", en: "Lying leg raise", mode: "reps", reps: 12, sets: 3, rest: 60 },
    { key: "hanging_knee_raise", goal: "strength", equipment: "bodyweight", activityKey: "core_abs", fr: "Elevation genoux sous barre", en: "Hanging knee raise", mode: "reps", reps: 10, sets: 3, rest: 75 },
    { key: "hanging_leg_raise", goal: "strength", equipment: "bodyweight", activityKey: "core_abs", fr: "Elevation jambes sous barre", en: "Hanging leg raise", mode: "reps", reps: 8, sets: 3, rest: 90 },
    { key: "toes_to_bar", goal: "strength", equipment: "bodyweight", activityKey: "core_abs", fr: "Pieds a la barre", en: "Toes to bar", mode: "reps", reps: 6, sets: 3, rest: 90 },
    { key: "flutter_kicks", goal: "strength", equipment: "bodyweight", activityKey: "core_abs", fr: "Battements de jambes", en: "Flutter kicks", mode: "time", seconds: 35, sets: 3, rest: 45 },
    { key: "v_up", goal: "strength", equipment: "bodyweight", activityKey: "core_abs", fr: "V-up", en: "V-up", mode: "reps", reps: 10, sets: 3, rest: 60 },
    { key: "russian_twist", goal: "strength", equipment: "bodyweight", activityKey: "core_abs", fr: "Russian twist", en: "Russian twist", mode: "reps", reps: 20, sets: 3, rest: 45 },
    { key: "mountain_climber", goal: "cardio", equipment: "bodyweight", activityKey: "hiit", fr: "Mountain climbers", en: "Mountain climbers", mode: "time", seconds: 40, sets: 6, rest: 20 },
    { key: "burpee", goal: "cardio", equipment: "bodyweight", activityKey: "hiit", fr: "Burpees", en: "Burpees", mode: "reps", reps: 8, sets: 5, rest: 45 },
    { key: "jumping_jack", goal: "cardio", equipment: "bodyweight", activityKey: "hiit", fr: "Jumping jacks", en: "Jumping jacks", mode: "time", seconds: 45, sets: 5, rest: 20 },
    { key: "jump_rope", goal: "cardio", equipment: "rope", activityKey: "jump_rope", fr: "Corde a sauter", en: "Jump rope", mode: "time", seconds: 60, sets: 10, rest: 30 },
    { key: "jump_rope_easy", goal: "cardio", equipment: "rope", activityKey: "jump_rope", fr: "Corde a sauter facile", en: "Easy jump rope", mode: "time", seconds: 45, sets: 8, rest: 45 },
    { key: "table_tennis", goal: "cardio", equipment: "mixed", activityKey: "table_tennis", fr: "Ping-pong", en: "Table tennis", mode: "time", seconds: 600, sets: 1, rest: 0 },
    { key: "band_row", goal: "strength", equipment: "band", activityKey: "resistance_band_strength", fr: "Tirage elastique", en: "Band row", mode: "reps", reps: 15, sets: 3, rest: 60 },
    { key: "band_curl", goal: "strength", equipment: "band", activityKey: "resistance_band_strength", fr: "Curl elastique", en: "Band curl", mode: "reps", reps: 15, sets: 3, rest: 45 },
    { key: "band_triceps", goal: "strength", equipment: "band", activityKey: "resistance_band_strength", fr: "Extension triceps elastique", en: "Band triceps extension", mode: "reps", reps: 15, sets: 3, rest: 45 },
    { key: "band_press", goal: "strength", equipment: "band", activityKey: "resistance_band_strength", fr: "Presse elastique", en: "Band chest press", mode: "reps", reps: 12, sets: 3, rest: 60 },
    { key: "band_face_pull", goal: "strength", equipment: "band", activityKey: "resistance_band_strength", fr: "Face pull elastique", en: "Band face pull", mode: "reps", reps: 15, sets: 3, rest: 45 },
    { key: "band_lateral_walk", goal: "strength", equipment: "band", activityKey: "resistance_band_strength", fr: "Marche laterale elastique", en: "Band lateral walk", mode: "reps", reps: 12, sets: 3, rest: 45 },
    { key: "band_pull_apart", goal: "mobility", equipment: "band", activityKey: "mobility", fr: "Ouverture epaules elastique", en: "Band pull-apart", mode: "reps", reps: 15, sets: 2, rest: 30 },
    { key: "band_squat", goal: "strength", equipment: "band", activityKey: "resistance_band_strength", fr: "Squat elastique", en: "Band squat", mode: "reps", reps: 15, sets: 3, rest: 60 },
    { key: "band_deadlift", goal: "strength", equipment: "band", activityKey: "resistance_band_strength", fr: "Souleve de terre elastique", en: "Band deadlift", mode: "reps", reps: 12, sets: 3, rest: 75 },
    { key: "band_overhead_press", goal: "strength", equipment: "band", activityKey: "resistance_band_strength", fr: "Developpe epaules elastique", en: "Band overhead press", mode: "reps", reps: 12, sets: 3, rest: 60 },
    { key: "band_lat_pulldown", goal: "strength", equipment: "band", activityKey: "resistance_band_strength", fr: "Tirage vertical elastique", en: "Band lat pulldown", mode: "reps", reps: 15, sets: 3, rest: 60 },
    { key: "band_hamstring_curl", goal: "strength", equipment: "band", activityKey: "resistance_band_strength", fr: "Leg curl elastique", en: "Band hamstring curl", mode: "reps", reps: 12, sets: 3, rest: 45 },
    { key: "band_glute_kickback", goal: "strength", equipment: "band", activityKey: "resistance_band_strength", fr: "Kickback fessier elastique", en: "Band glute kickback", mode: "reps", reps: 12, sets: 3, rest: 45 },
    { key: "band_external_rotation", goal: "mobility", equipment: "band", activityKey: "mobility", fr: "Rotation externe elastique", en: "Band external rotation", mode: "reps", reps: 12, sets: 2, rest: 25 },
    { key: "band_dislocates", goal: "mobility", equipment: "band", activityKey: "mobility", fr: "Passage epaules elastique", en: "Band shoulder pass-through", mode: "reps", reps: 10, sets: 2, rest: 25 },
    { key: "dumbbell_press", goal: "strength", equipment: "dumbbell", activityKey: "strength", fr: "Developpe halteres", en: "Dumbbell press", mode: "reps", reps: 10, sets: 3, rest: 75 },
    { key: "dumbbell_row", goal: "strength", equipment: "dumbbell", activityKey: "strength", fr: "Rowing haltere", en: "Dumbbell row", mode: "reps", reps: 10, sets: 3, rest: 75 },
    { key: "dumbbell_goblet_squat", goal: "strength", equipment: "dumbbell", activityKey: "strength", fr: "Goblet squat haltere", en: "Dumbbell goblet squat", mode: "reps", reps: 10, sets: 3, rest: 75 },
    { key: "dumbbell_rdl", goal: "strength", equipment: "dumbbell", activityKey: "strength", fr: "Souleve de terre roumain halteres", en: "Dumbbell Romanian deadlift", mode: "reps", reps: 10, sets: 3, rest: 90 },
    { key: "dumbbell_shoulder_press", goal: "strength", equipment: "dumbbell", activityKey: "strength", fr: "Developpe epaules halteres", en: "Dumbbell shoulder press", mode: "reps", reps: 10, sets: 3, rest: 75 },
    { key: "dumbbell_carry", goal: "strength", equipment: "dumbbell", activityKey: "strength", fr: "Farmer carry halteres", en: "Dumbbell farmer carry", mode: "time", seconds: 40, sets: 4, rest: 60 },
    { key: "dumbbell_lunge", goal: "strength", equipment: "dumbbell", activityKey: "strength", fr: "Fentes halteres", en: "Dumbbell lunges", mode: "reps", reps: 10, sets: 3, rest: 75 },
    { key: "dumbbell_step_up", goal: "strength", equipment: "dumbbell", activityKey: "strength", fr: "Step-up halteres", en: "Dumbbell step-up", mode: "reps", reps: 10, sets: 3, rest: 75 },
    { key: "dumbbell_floor_press", goal: "strength", equipment: "dumbbell", activityKey: "strength", fr: "Developpe au sol halteres", en: "Dumbbell floor press", mode: "reps", reps: 10, sets: 3, rest: 75 },
    { key: "dumbbell_fly", goal: "strength", equipment: "dumbbell", activityKey: "strength", fr: "Ecarte halteres", en: "Dumbbell fly", mode: "reps", reps: 10, sets: 3, rest: 75 },
    { key: "dumbbell_lateral_raise", goal: "strength", equipment: "dumbbell", activityKey: "strength", fr: "Elevation laterale halteres", en: "Dumbbell lateral raise", mode: "reps", reps: 12, sets: 3, rest: 60 },
    { key: "dumbbell_biceps_curl", goal: "strength", equipment: "dumbbell", activityKey: "strength", fr: "Curl biceps halteres", en: "Dumbbell biceps curl", mode: "reps", reps: 12, sets: 3, rest: 60 },
    { key: "dumbbell_triceps_extension", goal: "strength", equipment: "dumbbell", activityKey: "strength", fr: "Extension triceps haltere", en: "Dumbbell triceps extension", mode: "reps", reps: 12, sets: 3, rest: 60 },
    { key: "dumbbell_renegade_row", goal: "strength", equipment: "dumbbell", activityKey: "strength", fr: "Renegade row", en: "Renegade row", mode: "reps", reps: 8, sets: 3, rest: 90 },
    { key: "dumbbell_thruster", goal: "cardio", equipment: "dumbbell", activityKey: "hiit", fr: "Thruster halteres", en: "Dumbbell thruster", mode: "reps", reps: 10, sets: 4, rest: 60 },
    { key: "barbell_squat", goal: "strength", equipment: "barbell", activityKey: "strength", fr: "Squat barre", en: "Barbell squat", mode: "reps", reps: 6, sets: 4, rest: 120 },
    { key: "barbell_deadlift", goal: "strength", equipment: "barbell", activityKey: "strength", fr: "Souleve de terre barre", en: "Barbell deadlift", mode: "reps", reps: 5, sets: 4, rest: 150 },
    { key: "barbell_bench", goal: "strength", equipment: "barbell", activityKey: "strength", fr: "Developpe couche barre", en: "Barbell bench press", mode: "reps", reps: 6, sets: 4, rest: 120 },
    { key: "barbell_row", goal: "strength", equipment: "barbell", activityKey: "strength", fr: "Rowing barre", en: "Barbell row", mode: "reps", reps: 8, sets: 4, rest: 90 },
    { key: "kettlebell_swing", goal: "strength", equipment: "kettlebell", activityKey: "hiit", fr: "Swing kettlebell", en: "Kettlebell swing", mode: "reps", reps: 15, sets: 4, rest: 60 },
    { key: "kettlebell_goblet", goal: "strength", equipment: "kettlebell", activityKey: "strength", fr: "Goblet squat kettlebell", en: "Kettlebell goblet squat", mode: "reps", reps: 12, sets: 3, rest: 75 },
    { key: "kettlebell_clean_press", goal: "strength", equipment: "kettlebell", activityKey: "strength", fr: "Clean press kettlebell", en: "Kettlebell clean and press", mode: "reps", reps: 6, sets: 3, rest: 90 },
    { key: "machine_press", goal: "strength", equipment: "machine", activityKey: "strength", fr: "Presse machine", en: "Machine press", mode: "reps", reps: 10, sets: 3, rest: 90 },
    { key: "machine_leg_press", goal: "strength", equipment: "machine", activityKey: "strength", fr: "Presse a cuisses", en: "Leg press", mode: "reps", reps: 10, sets: 3, rest: 90 },
    { key: "machine_lat_pulldown", goal: "strength", equipment: "machine", activityKey: "strength", fr: "Tirage vertical", en: "Lat pulldown", mode: "reps", reps: 10, sets: 3, rest: 75 },
    { key: "machine_seated_row", goal: "strength", equipment: "machine", activityKey: "strength", fr: "Rowing assis machine", en: "Seated cable row", mode: "reps", reps: 10, sets: 3, rest: 75 },
    { key: "machine_leg_curl", goal: "strength", equipment: "machine", activityKey: "strength", fr: "Leg curl", en: "Leg curl", mode: "reps", reps: 12, sets: 3, rest: 60 },
    { key: "machine_cable_triceps", goal: "strength", equipment: "machine", activityKey: "strength", fr: "Triceps poulie", en: "Cable triceps pushdown", mode: "reps", reps: 12, sets: 3, rest: 60 },
    { key: "easy_run", goal: "cardio", equipment: "outdoor", activityKey: "running", fr: "Course facile", en: "Easy run", mode: "time", seconds: 1200, sets: 1, rest: 0, distanceM: 3000 },
    { key: "run_intervals", goal: "cardio", equipment: "outdoor", activityKey: "running", fr: "Intervalles course", en: "Run intervals", mode: "time", seconds: 60, sets: 8, rest: 60 },
    { key: "tempo_run", goal: "cardio", equipment: "outdoor", activityKey: "running", fr: "Course tempo", en: "Tempo run", mode: "time", seconds: 900, sets: 1, rest: 0, distanceM: 2500 },
    { key: "hill_repeats", goal: "cardio", equipment: "outdoor", activityKey: "running", fr: "Cotes repetees", en: "Hill repeats", mode: "time", seconds: 45, sets: 8, rest: 90 },
    { key: "brisk_walk", goal: "cardio", equipment: "outdoor", activityKey: "walking", fr: "Marche rapide", en: "Brisk walk", mode: "time", seconds: 1800, sets: 1, rest: 0, distanceM: 2500 },
    { key: "hike_block", goal: "cardio", equipment: "outdoor", activityKey: "hiking", fr: "Bloc randonnee", en: "Hiking block", mode: "time", seconds: 3600, sets: 1, rest: 0, distanceM: 5000 },
    { key: "cycling_easy", goal: "cardio", equipment: "outdoor", activityKey: "cycling", fr: "Velo facile", en: "Easy cycling", mode: "time", seconds: 1800, sets: 1, rest: 0 },
    { key: "cycling_intervals", goal: "cardio", equipment: "outdoor", activityKey: "cycling", fr: "Intervalles velo", en: "Cycling intervals", mode: "time", seconds: 120, sets: 6, rest: 90 },
    { key: "rowing", goal: "cardio", equipment: "machine", activityKey: "rowing", fr: "Rameur", en: "Rowing", mode: "time", seconds: 300, sets: 4, rest: 90 },
    { key: "rowing_easy", goal: "cardio", equipment: "machine", activityKey: "rowing", fr: "Rameur facile", en: "Easy rowing", mode: "time", seconds: 900, sets: 1, rest: 0 },
    { key: "basketball_1h", goal: "basketball", equipment: "outdoor", activityKey: "basketball", fr: "Basket", en: "Basketball", mode: "time", seconds: 3600, sets: 1, rest: 0 },
    { key: "basketball_shootaround", goal: "basketball", equipment: "outdoor", activityKey: "basketball", fr: "Shoot basket", en: "Basketball shootaround", mode: "time", seconds: 1800, sets: 1, rest: 0 },
    { key: "hiit_bodyweight", goal: "cardio", equipment: "bodyweight", activityKey: "hiit", fr: "HIIT poids du corps", en: "Bodyweight HIIT", mode: "time", seconds: 40, sets: 8, rest: 20 },
    { key: "hips", goal: "mobility", equipment: "mat", activityKey: "mobility", fr: "Mobilite hanches", en: "Hip mobility", mode: "time", seconds: 60, sets: 3, rest: 20 },
    { key: "shoulders", goal: "mobility", equipment: "mat", activityKey: "mobility", fr: "Mobilite epaules", en: "Shoulder mobility", mode: "time", seconds: 60, sets: 3, rest: 20 },
    { key: "breathing", goal: "mobility", equipment: "mat", activityKey: "yoga", fr: "Respiration / relachement", en: "Breathing / release", mode: "time", seconds: 180, sets: 1, rest: 0 },
    { key: "cat_cow", goal: "mobility", equipment: "mat", activityKey: "mobility", fr: "Dos rond dos creux", en: "Cat-cow", mode: "time", seconds: 45, sets: 2, rest: 15 },
    { key: "thoracic_rotation", goal: "mobility", equipment: "mat", activityKey: "mobility", fr: "Rotation thoracique", en: "Thoracic rotation", mode: "reps", reps: 8, sets: 2, rest: 20 },
    { key: "ankle_mobility", goal: "mobility", equipment: "mat", activityKey: "mobility", fr: "Mobilite chevilles", en: "Ankle mobility", mode: "time", seconds: 45, sets: 2, rest: 20 },
    { key: "hamstring_flow", goal: "mobility", equipment: "mat", activityKey: "yoga", fr: "Flow ischios", en: "Hamstring flow", mode: "time", seconds: 90, sets: 2, rest: 20 },
    { key: "world_greatest_stretch", goal: "mobility", equipment: "mat", activityKey: "mobility", fr: "World greatest stretch", en: "World's greatest stretch", mode: "time", seconds: 60, sets: 2, rest: 20 },
    { key: "couch_stretch", goal: "mobility", equipment: "mat", activityKey: "mobility", fr: "Etirement psoas", en: "Couch stretch", mode: "time", seconds: 60, sets: 2, rest: 20 },
    { key: "pigeon_stretch", goal: "mobility", equipment: "mat", activityKey: "yoga", fr: "Pigeon fessier", en: "Pigeon stretch", mode: "time", seconds: 60, sets: 2, rest: 20 },
    { key: "deep_squat_hold", goal: "mobility", equipment: "bodyweight", activityKey: "mobility", fr: "Squat profond tenu", en: "Deep squat hold", mode: "time", seconds: 60, sets: 2, rest: 30 },
    { key: "wrist_mobility", goal: "mobility", equipment: "mat", activityKey: "mobility", fr: "Mobilite poignets", en: "Wrist mobility", mode: "time", seconds: 45, sets: 2, rest: 15 },
    { key: "neck_mobility", goal: "mobility", equipment: "mat", activityKey: "mobility", fr: "Mobilite nuque", en: "Neck mobility", mode: "time", seconds: 45, sets: 2, rest: 15 },
    { key: "scapular_wall_slide", goal: "mobility", equipment: "bodyweight", activityKey: "mobility", fr: "Wall slide scapulaire", en: "Scapular wall slide", mode: "reps", reps: 10, sets: 2, rest: 25 },
    { key: "calf_stretch_flow", goal: "mobility", equipment: "mat", activityKey: "mobility", fr: "Flow mollets chevilles", en: "Calf and ankle flow", mode: "time", seconds: 60, sets: 2, rest: 20 },
    { key: "climb_easy", goal: "climb", equipment: "wall", activityKey: "climbing", fr: "Voies faciles", en: "Easy routes", mode: "time", seconds: 240, sets: 4, rest: 120 },
    { key: "climb_project", goal: "climb", equipment: "wall", activityKey: "climbing", fr: "Projet / essais", en: "Project attempts", mode: "time", seconds: 180, sets: 6, rest: 180 },
    { key: "finger_warmup", goal: "climb", equipment: "bodyweight", activityKey: "mobility", fr: "Echauffement doigts/epaules", en: "Finger/shoulder warm-up", mode: "time", seconds: 420, sets: 1, rest: 0 },
    { key: "climb_technique_feet", goal: "climb", equipment: "wall", activityKey: "climbing", fr: "Technique pieds", en: "Footwork technique", mode: "time", seconds: 180, sets: 4, rest: 90 },
    { key: "climb_endurance", goal: "climb", equipment: "wall", activityKey: "climbing", fr: "Volume endurance", en: "Endurance volume", mode: "time", seconds: 600, sets: 3, rest: 180 },
    { key: "climb_downclimb", goal: "climb", equipment: "wall", activityKey: "climbing", fr: "Montee descente controlee", en: "Controlled up/down climb", mode: "time", seconds: 240, sets: 3, rest: 120 },
    { key: "scap_pull", goal: "climb", equipment: "bodyweight", activityKey: "bodyweight_strength", fr: "Tractions scapulaires", en: "Scapular pulls", mode: "reps", reps: 8, sets: 3, rest: 60 },
    { key: "swim_warmup", goal: "swim", equipment: "pool", activityKey: "swimming", fr: "Echauffement nage", en: "Swim warm-up", mode: "time", seconds: 300, sets: 1, rest: 60, distanceM: 200 },
    { key: "swim_intervals", goal: "swim", equipment: "pool", activityKey: "swimming", fr: "Series nage", en: "Swim intervals", mode: "time", seconds: 120, sets: 6, rest: 45, distanceM: 50 },
    { key: "swim_cooldown", goal: "swim", equipment: "pool", activityKey: "swimming", fr: "Retour calme nage", en: "Swim cool down", mode: "time", seconds: 240, sets: 1, rest: 0, distanceM: 100 },
    { key: "swim_drill_kick", goal: "swim", equipment: "pool", activityKey: "swimming", fr: "Battements jambes", en: "Kick drill", mode: "time", seconds: 90, sets: 6, rest: 30, distanceM: 50 },
    { key: "swim_pull", goal: "swim", equipment: "pool", activityKey: "swimming", fr: "Pull nage", en: "Pull swim", mode: "time", seconds: 120, sets: 5, rest: 45, distanceM: 50 },
    { key: "swim_endurance", goal: "swim", equipment: "pool", activityKey: "swimming", fr: "Endurance continue", en: "Continuous endurance swim", mode: "time", seconds: 1200, sets: 1, rest: 0, distanceM: 800 },
    { key: "boxing_heavy_bag", goal: "boxing", equipment: "boxing", activityKey: "boxing", fr: "Sac de frappe", en: "Heavy bag rounds", mode: "time", seconds: 180, sets: 6, rest: 60, metValue: 12.8 },
    { key: "boxing_speed_bag", goal: "boxing", equipment: "boxing", activityKey: "boxing", fr: "Poire de vitesse", en: "Speed bag", mode: "time", seconds: 120, sets: 5, rest: 45, metValue: 5.8 },
    { key: "boxing_shadow", goal: "boxing", equipment: "bodyweight", activityKey: "boxing", fr: "Shadow boxing", en: "Shadow boxing", mode: "time", seconds: 180, sets: 5, rest: 45, metValue: 7.0 },
    { key: "boxing_mitts", goal: "boxing", equipment: "boxing", activityKey: "boxing", fr: "Pattes d ours", en: "Focus mitts", mode: "time", seconds: 180, sets: 6, rest: 60, metValue: 8.0 },
    { key: "boxing_light_sparring", goal: "boxing", equipment: "boxing", activityKey: "boxing", fr: "Sparring leger", en: "Light sparring", mode: "time", seconds: 180, sets: 4, rest: 90, metValue: 8.2 },
    { key: "boxing_footwork", goal: "boxing", equipment: "bodyweight", activityKey: "boxing", fr: "Footwork boxe", en: "Boxing footwork", mode: "time", seconds: 120, sets: 6, rest: 45, metValue: 6.5 },
    { key: "boxing_slips", goal: "boxing", equipment: "bodyweight", activityKey: "boxing", fr: "Esquives et slips", en: "Slips and defensive drills", mode: "time", seconds: 90, sets: 6, rest: 30, metValue: 5.8 },
    { key: "boxing_burpees", goal: "boxing", equipment: "bodyweight", activityKey: "hiit", fr: "Burpees boxe", en: "Boxing burpees", mode: "reps", reps: 8, sets: 5, rest: 45, metValue: 8.5 },
    { key: "boxing_jump_rope", goal: "boxing", equipment: "rope", activityKey: "jump_rope", fr: "Corde a sauter boxe", en: "Boxing jump rope", mode: "time", seconds: 180, sets: 5, rest: 45, metValue: 11.8 },
    { key: "boxing_bag_combo_rounds", goal: "boxing", equipment: "boxing", activityKey: "boxing", fr: "Rounds combo au sac", en: "Heavy bag combo rounds", mode: "time", seconds: 180, sets: 8, rest: 60, metValue: 12.8 },
    { key: "pullup", goal: "strength", equipment: "bodyweight", activityKey: "bodyweight_strength", fr: "Tractions", en: "Pull-up", mode: "reps", reps: 6, sets: 4, rest: 90, metValue: 6.0 },
    { key: "chinup", goal: "strength", equipment: "bodyweight", activityKey: "bodyweight_strength", fr: "Chin-up", en: "Chin-up", mode: "reps", reps: 6, sets: 4, rest: 90, metValue: 6.0 },
    { key: "australian_pullup", goal: "strength", equipment: "bodyweight", activityKey: "bodyweight_strength", fr: "Tractions australiennes", en: "Australian pull-up", mode: "reps", reps: 10, sets: 3, rest: 75, metValue: 5.4 },
    { key: "handstand_hold", goal: "strength", equipment: "bodyweight", activityKey: "plank_core", fr: "Appui renverse tenu", en: "Handstand hold", mode: "time", seconds: 30, sets: 4, rest: 75, metValue: 5.0 },
    { key: "box_jump", goal: "cardio", equipment: "bodyweight", activityKey: "hiit", fr: "Box jump", en: "Box jump", mode: "reps", reps: 10, sets: 5, rest: 60, metValue: 8.0 },
    { key: "wall_ball", goal: "cardio", equipment: "mixed", activityKey: "hiit", fr: "Wall ball", en: "Wall ball", mode: "reps", reps: 15, sets: 5, rest: 60, metValue: 7.6 },
  ];
  const FALLBACK_EXERCISE_LIBRARY = EXERCISE_LIBRARY.map(row => Object.assign({}, row));

  const CACHE = {
    loaded: false,
    loading: false,
    error: "",
    sessions: [],
    items: [],
    sets: [],
    localSessions: loadLocalHistory(),
    plan: loadPlan(),
    timer: null,
    pendingSummary: null,
    wakeLock: null,
    localScope: "",
    status: "",
    builderGoal: "strength",
    builderEquipment: "all",
    builderDuration: 35,
    builderLevel: "regular",
    exerciseSearch: "",
    globalRestSeconds: loadGlobalRest(),
    circuit: loadCircuit(),
    editingPlanIndex: null,
    libraryLoaded: false,
    libraryLoading: false,
    librarySource: "fallback",
  };

  function lang() {
    try { return String(window.TB_LANG || "fr").toLowerCase() === "en" ? "en" : "fr"; } catch (_) { return "fr"; }
  }
  function txt(fr, en) { return lang() === "en" ? en : fr; }
  function esc(s) {
    if (typeof window.escapeHTML === "function") return window.escapeHTML(s);
    return String(s || "").replace(/[&<>"']/g, ch => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[ch]));
  }
  function todayISO() {
    try { if (typeof window.toLocalISODate === "function") return window.toLocalISODate(new Date()); } catch (_) {}
    return new Date().toISOString().slice(0, 10);
  }
  function localDateISO(value) {
    const raw = String(value || "");
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    const d = new Date(raw);
    if (Number.isFinite(d.getTime())) {
      try { if (typeof window.toLocalISODate === "function") return window.toLocalISODate(d); } catch (_) {}
      return d.toISOString().slice(0, 10);
    }
    return raw.slice(0, 10);
  }
  function client() { return window.sb || null; }
  function currentUser() {
    try { if (window.sbUser && window.sbUser.id) return window.sbUser; } catch (_) {}
    try { if (sbUser && sbUser.id) return sbUser; } catch (_) {}
    return null;
  }
  function uid() { return currentUser()?.id || null; }
  function sportStorageScope() {
    const userId = uid();
    return userId ? `user:${userId}` : "anon";
  }
  function reloadScopedLocalState(force) {
    const scope = sportStorageScope();
    if (!force && CACHE.localScope === scope) return;
    CACHE.localScope = scope;
    CACHE.localSessions = loadLocalHistory();
    CACHE.plan = loadPlan();
    CACHE.globalRestSeconds = loadGlobalRest();
    CACHE.circuit = loadCircuit();
  }
  function activeTravelId() { return window.state?.activeTravelId || null; }
  function table(name) { return window.TB_CONST?.TABLES?.[name] || name; }
  function n(v, fallback) { const x = Number(v); return Number.isFinite(x) ? x : (fallback || 0); }
  function sportLibraryRules() { return window.Core?.sportLibraryRules || null; }
  function normalizeSportExercise(row) {
    const rules = sportLibraryRules();
    if (rules?.normalizeSportExerciseRow) return rules.normalizeSportExerciseRow(row);
    return row && row.key ? Object.assign({}, row) : null;
  }
  function mergeSportLibraries(fallback, remote) {
    const rules = sportLibraryRules();
    if (rules?.mergeSportExerciseLibraries) return rules.mergeSportExerciseLibraries(fallback, remote);
    const byKey = new Map();
    (fallback || []).forEach(row => { const ex = normalizeSportExercise(row); if (ex) byKey.set(ex.key, Object.assign({}, row, ex)); });
    (remote || []).forEach(row => { const ex = normalizeSportExercise(row); if (ex) byKey.set(ex.key, Object.assign({}, byKey.get(ex.key), ex, { source: "sql" })); });
    return Array.from(byKey.values());
  }
  function applySportLibrary(rows, source) {
    const merged = mergeSportLibraries(FALLBACK_EXERCISE_LIBRARY, rows || []);
    if (!merged.length) return false;
    EXERCISE_LIBRARY.splice(0, EXERCISE_LIBRARY.length, ...merged);
    CACHE.libraryLoaded = true;
    CACHE.librarySource = source || "fallback";
    return true;
  }
  function loadCachedSportLibrary() {
    try {
      const parsed = JSON.parse(localStorage.getItem(LIBRARY_KEY()) || "null");
      const rows = Array.isArray(parsed?.rows) ? parsed.rows : [];
      return rows.slice(0, 400);
    } catch (_) { return []; }
  }
  function saveCachedSportLibrary(rows) {
    try {
      localStorage.setItem(LIBRARY_KEY(), JSON.stringify({ savedAt: new Date().toISOString(), rows: (rows || []).slice(0, 400) }));
    } catch (_) {}
  }
  async function ensureSportLibraryLoaded(reason) {
    if (CACHE.libraryLoading) return false;
    const cached = loadCachedSportLibrary();
    if (cached.length && CACHE.librarySource === "fallback") applySportLibrary(cached, "cache");
    const c = client();
    if (!c) {
      CACHE.libraryLoaded = true;
      return false;
    }
    const offline = (typeof window.tbShouldUseOfflineMode === "function")
      ? await window.tbShouldUseOfflineMode(`sport:library:${reason || "render"}`)
      : ((typeof window.tbIsOfflineMode === "function" && window.tbIsOfflineMode()) || (navigator && navigator.onLine === false));
    if (offline) {
      CACHE.libraryLoaded = true;
      return false;
    }
    CACHE.libraryLoading = true;
    try {
      const res = await c
        .from(table("sport_exercises"))
        .select("key,goal,equipment,activity_key,name_fr,name_en,mode,default_reps,default_seconds,default_sets,default_rest_seconds,distance_m,met_value,tags,sort_order")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("name_fr", { ascending: true });
      if (res.error) throw res.error;
      const rows = (res.data || []).map(normalizeSportExercise).filter(Boolean);
      if (rows.length) {
        applySportLibrary(rows, "sql");
        saveCachedSportLibrary(rows);
        return true;
      }
    } catch (e) {
      if (!isOfflineSkipError(e)) console.warn("[sport] library load failed", e?.message || e);
    } finally {
      CACHE.libraryLoading = false;
      CACHE.libraryLoaded = true;
    }
    return false;
  }
  function isOfflineSkipError(err) {
    return /offline mode|supabase request skipped|failed to fetch|network/i.test(String(err?.message || err || ""));
  }
  function fmtSec(sec) {
    const s = Math.max(0, Math.round(Number(sec) || 0));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
  }
  function catalogItem(key) { return CATALOG.find(x => x.key === key) || CATALOG[0]; }
  function labelActivity(key) {
    const a = catalogItem(key);
    return lang() === "en" ? a.en : a.fr;
  }
  function labelEquipment(key) {
    const e = EQUIPMENT.find(x => x[0] === key);
    return e ? (lang() === "en" ? e[2] : e[1]) : key;
  }
  function bodyWeight() {
    try { return n(localStorage.getItem(WEIGHT_KEY()), 70); } catch (_) { return 70; }
  }
  function saveBodyWeight(v) {
    try { localStorage.setItem(WEIGHT_KEY(), String(Math.max(1, n(v, 70)))); } catch (_) {}
  }
  function bodyHeight() {
    try { return n(localStorage.getItem(HEIGHT_KEY()), 175); } catch (_) { return 175; }
  }
  function saveBodyHeight(v) {
    try { localStorage.setItem(HEIGHT_KEY(), String(Math.max(60, n(v, 175)))); } catch (_) {}
  }
  function loadGlobalRest() {
    try { return Math.max(0, Math.round(n(localStorage.getItem(GLOBAL_REST_KEY()), 60))); } catch (_) { return 60; }
  }
  function saveGlobalRest(v) {
    const seconds = Math.max(0, Math.round(n(v, 60)));
    CACHE.globalRestSeconds = seconds;
    try { localStorage.setItem(GLOBAL_REST_KEY(), String(seconds)); } catch (_) {}
    return seconds;
  }
  function loadCircuit() {
    try {
      const raw = JSON.parse(localStorage.getItem(CIRCUIT_KEY()) || "{}");
      return {
        enabled: raw.enabled === true,
        rounds: Math.max(1, Math.round(n(raw.rounds, 4))),
        roundRestSeconds: Math.max(0, Math.round(n(raw.roundRestSeconds, 60))),
        amrapMinutes: Math.max(0, Math.round(n(raw.amrapMinutes, 0))),
      };
    } catch (_) {
      return { enabled: false, rounds: 4, roundRestSeconds: 60, amrapMinutes: 0 };
    }
  }
  function saveCircuit(next) {
    CACHE.circuit = Object.assign({ enabled: false, rounds: 4, roundRestSeconds: 60, amrapMinutes: 0 }, CACHE.circuit || {}, next || {});
    CACHE.circuit.rounds = Math.max(1, Math.round(n(CACHE.circuit.rounds, 4)));
    CACHE.circuit.roundRestSeconds = Math.max(0, Math.round(n(CACHE.circuit.roundRestSeconds, 60)));
    CACHE.circuit.amrapMinutes = Math.max(0, Math.round(n(CACHE.circuit.amrapMinutes, 0)));
    try { localStorage.setItem(CIRCUIT_KEY(), JSON.stringify(CACHE.circuit)); } catch (_) {}
    return CACHE.circuit;
  }
  function bmiValue(kg, cm) {
    const h = n(cm, 0) / 100;
    if (!h) return 0;
    return n(kg, 0) / (h * h);
  }
  function effectiveLoadKg(item, bodyKg) {
    const equipment = String(item?.equipment || "");
    if (equipment === "band") return 0;
    return Math.max(0, n(item?.weightKg, 0));
  }
  function setWorkSeconds(item, actualSeconds) {
    if (Number.isFinite(Number(actualSeconds)) && Number(actualSeconds) > 0) return Math.max(1, Math.round(Number(actualSeconds)));
    if (item?.mode === "time") return Math.max(1, Math.round(n(item?.targetSeconds, 0)));
    const reps = Math.max(1, Math.round(n(item?.targetReps, 10)));
    return Math.max(15, Math.round(reps * 2.5));
  }
  function restSecondsForItem(item) {
    const raw = Number(item?.restSeconds);
    if (Number.isFinite(raw) && raw >= 0) return Math.round(raw);
    return Math.max(0, Math.round(n(CACHE.globalRestSeconds, 60)));
  }
  function sequenceStepSeconds(step) {
    if (!step) return 0;
    const direct = Number(step.duration);
    if (Number.isFinite(direct) && direct > 0) return Math.max(1, Math.round(direct));
    return step.kind === "work" ? setWorkSeconds(step.item) : 0;
  }
  function estimatedCompletionSequence() {
    const base = makeSequence();
    const capSeconds = CACHE.circuit?.enabled ? Math.max(0, Math.round(n(CACHE.circuit.amrapMinutes, 0) * 60)) : 0;
    if (!capSeconds || !base.length) return base;
    const baseSeconds = base.reduce((sum, step) => sum + sequenceStepSeconds(step), 0);
    if (baseSeconds <= 0) return base;
    const rounds = Math.max(1, Math.floor(capSeconds / baseSeconds));
    const out = [];
    for (let round = 1; round <= Math.min(rounds, 100); round += 1) {
      base.forEach(step => out.push(Object.assign({}, step, { setIndex: round, roundIndex: round, roundTotal: rounds })));
    }
    return out.length ? out : base;
  }
  function isStrengthLike(item) {
    const key = String(item?.activityKey || "");
    const equipment = String(item?.equipment || "");
    return key === "strength" || key === "bodyweight_strength" || key === "resistance_band_strength" || key === "core_abs" || key === "plank_core" ||
      ["bodyweight", "band", "dumbbell", "barbell", "kettlebell", "machine"].includes(equipment);
  }
  function calibratedMet(item) {
    const activity = catalogItem(item?.activityKey || "strength");
    const intensity = String(item?.intensity || "moderate");
    const base = n(item?.metValue, activity.met * intensityFactor(intensity));
    if (!isStrengthLike(item)) return Math.max(1, base);
    const floor = activity.met * intensityFactor(intensity);
    const loadBoost = Math.min(1.4, Math.max(0, n(item?.weightKg, 0)) / 35);
    const repsBoost = item?.mode === "reps" ? Math.min(0.7, Math.max(0, n(item?.targetReps, 0) - 8) / 35) : 0;
    return Math.max(4.2, base, floor + loadBoost + repsBoost);
  }
  function kcalEstimate(met, kg, seconds, loadKg) {
    const minutes = Math.max(0, n(seconds, 0)) / 60;
    const effectiveKg = Math.max(1, n(kg, 70) + Math.max(0, n(loadKg, 0)));
    return Math.max(0, (n(met, 1) * 3.5 * effectiveKg / 200) * minutes);
  }
  function kcalEstimateForItem(item, kg, seconds, loadKg) {
    return kcalEstimate(calibratedMet(item), kg, seconds, loadKg);
  }
  function sessionKcalEstimate(plan, doneSets, kg, durationSeconds) {
    const rows = Array.isArray(doneSets) ? doneSets : [];
    const workKcal = rows.reduce((sum, set) => {
      const item = (plan || [])[set.itemIndex];
      return sum + kcalEstimateForItem(item, kg, set.durationSeconds, set.weightKg);
    }, 0);
    const workSeconds = rows.reduce((sum, set) => sum + Math.max(0, n(set.durationSeconds, 0)), 0);
    const totalSeconds = Math.max(workSeconds, Math.max(0, n(durationSeconds, 0)));
    const recoverySeconds = Math.max(0, totalSeconds - workSeconds);
    const recoveryKcal = recoverySeconds ? kcalEstimate(RECOVERY_MET, kg, recoverySeconds, 0) : 0;
    const hasStrength = (plan || []).some(isStrengthLike);
    const hasCardio = (plan || []).some(item => !isStrengthLike(item));
    const floorMet = hasStrength && !hasCardio ? 3.8 : hasStrength && hasCardio ? 3.3 : 0;
    const floorKcal = floorMet ? kcalEstimate(floorMet, kg, totalSeconds, 0) : 0;
    return Math.max(0, workKcal + recoveryKcal, floorKcal);
  }
  function totalPlanSeconds(plan) {
    const rows = plan || [];
    if (CACHE.circuit?.enabled && rows.length) {
      const capSeconds = Math.max(0, Math.round(n(CACHE.circuit.amrapMinutes, 0) * 60));
      if (capSeconds > 0) return capSeconds;
      return makeSequence()
        .filter(step => step.kind === "work" || step.kind === "rest" || step.kind === "round_rest")
        .reduce((sum, step) => sum + sequenceStepSeconds(step), 0);
    }
    return rows.reduce((sum, item, idx) => {
      const work = setWorkSeconds(item) * n(item.sets, 1);
      const restSlots = Math.max(0, n(item.sets, 1) - 1) + (idx < rows.length - 1 ? 1 : 0);
      const rest = Math.max(0, restSecondsForItem(item) * restSlots);
      return sum + work + rest;
    }, 0);
  }
  function totalPlanKcal(plan, kg) {
    const circuitSeq = CACHE.circuit?.enabled ? estimatedCompletionSequence() : [];
    const workSeconds = CACHE.circuit?.enabled
      ? circuitSeq.filter(step => step.kind === "work").reduce((sum, step) => sum + sequenceStepSeconds(step), 0)
      : (plan || []).reduce((sum, item) => sum + setWorkSeconds(item) * n(item.sets, 1), 0);
    const workKcal = CACHE.circuit?.enabled
      ? circuitSeq.filter(step => step.kind === "work").reduce((sum, step) => sum + kcalEstimateForItem(step.item, kg, sequenceStepSeconds(step), effectiveLoadKg(step.item, kg)), 0)
      : (plan || []).reduce((sum, item) => {
          const seconds = setWorkSeconds(item) * n(item.sets, 1);
          return sum + kcalEstimateForItem(item, kg, seconds, effectiveLoadKg(item, kg));
        }, 0);
    return workKcal + kcalEstimate(RECOVERY_MET, kg, Math.max(0, totalPlanSeconds(plan) - workSeconds), 0);
  }
  function loadPlan() {
    try {
      const raw = localStorage.getItem(PLAN_KEY());
      const parsed = raw ? JSON.parse(raw) : null;
      return Array.isArray(parsed) ? parsed.slice(0, 80) : [];
    } catch (_) { return []; }
  }
  function savePlan() {
    try { localStorage.setItem(PLAN_KEY(), JSON.stringify(CACHE.plan || [])); } catch (_) {}
  }
  function loadLocalHistory() {
    try {
      const raw = localStorage.getItem(HISTORY_KEY());
      const parsed = raw ? JSON.parse(raw) : null;
      if (!Array.isArray(parsed)) return [];
      const migrated = recalibrateHeavyBagLocalWorkouts(parsed.slice(0, 50));
      if (migrated.changed) saveLocalHistory(migrated.rows);
      return migrated.rows;
    } catch (_) { return []; }
  }
  function loadAnonHistory() {
    try {
      const rows = [];
      [ANON_HISTORY_KEY(), baseHistoryKey()].forEach(key => {
        try {
          const raw = localStorage.getItem(key);
          const parsed = raw ? JSON.parse(raw) : null;
          if (Array.isArray(parsed)) rows.push(...parsed);
        } catch (_) {}
      });
      const seen = new Set();
      return rows.filter(row => {
        const id = String(row?.localId || row?.remoteId || row?.startedAt || row?.started_at || "");
        if (!id || seen.has(id)) return false;
        seen.add(id);
        return true;
      }).slice(0, 50);
    } catch (_) { return []; }
  }
  function saveLocalHistory(rows) {
    try { localStorage.setItem(HISTORY_KEY(), JSON.stringify((rows || []).slice(0, 50))); } catch (_) {}
  }
  function saveAnonHistory(rows) {
    try { localStorage.setItem(ANON_HISTORY_KEY(), JSON.stringify((rows || []).slice(0, 50))); } catch (_) {}
    try { localStorage.removeItem(baseHistoryKey()); } catch (_) {}
  }
  function isHeavyBagPlanItem(item) {
    const text = `${item?.exerciseName || ""} ${item?.label || ""} ${item?.key || ""}`.toLowerCase();
    return text.includes("sac de frappe") || text.includes("heavy bag") || text.includes("combo au sac") || text.includes("boxing_heavy_bag") || text.includes("boxing_bag_combo");
  }
  function recalibrateHeavyBagLocalWorkouts(rows) {
    let changed = false;
    const next = (rows || []).map(row => {
      const plan = Array.isArray(row?.plan) ? row.plan : [];
      if (!plan.some(isHeavyBagPlanItem)) return row;
      const nextPlan = plan.map(item => isHeavyBagPlanItem(item) ? Object.assign({}, item, { activityKey: item.activityKey || "boxing", metValue: 12.8 }) : item);
      const doneSets = Array.isArray(row?.doneSets) ? row.doneSets : [];
      const kg = n(row?.bodyWeightKg || row?.body_weight_kg, bodyWeight());
      const duration = n(row?.durationSeconds || row?.duration_seconds, 0);
      const estimatedKcal = Math.max(1, Math.round(sessionKcalEstimate(nextPlan, doneSets, kg, duration)));
      changed = changed || JSON.stringify(nextPlan) !== JSON.stringify(plan) || Math.round(n(row?.estimatedKcal || row?.estimated_kcal, 0)) !== estimatedKcal;
      return Object.assign({}, row, {
        plan: nextPlan,
        estimatedKcal,
        estimated_kcal: estimatedKcal,
      });
    });
    return { rows: next, changed };
  }
  function loadPendingDeletes() {
    try {
      const rows = JSON.parse(localStorage.getItem(DELETE_QUEUE_KEY()) || "[]");
      return Array.isArray(rows) ? rows.map(String).filter(Boolean) : [];
    } catch (_) { return []; }
  }
  function savePendingDeletes(rows) {
    const clean = Array.from(new Set((rows || []).map(String).filter(Boolean))).slice(0, 80);
    try {
      if (clean.length) localStorage.setItem(DELETE_QUEUE_KEY(), JSON.stringify(clean));
      else localStorage.removeItem(DELETE_QUEUE_KEY());
    } catch (_) {}
    return clean;
  }
  function rememberPendingDelete(id) {
    const key = String(id || "");
    if (!key || key.startsWith("local_")) return;
    savePendingDeletes(loadPendingDeletes().concat(key));
  }
  function clearPendingDelete(id) {
    const key = String(id || "");
    if (!key) return;
    savePendingDeletes(loadPendingDeletes().filter(x => x !== key));
  }
  function isPendingDeleted(id) {
    const key = String(id || "");
    return !!key && loadPendingDeletes().includes(key);
  }
  function sportHistoryKeys() {
    const keys = new Set([HISTORY_KEY(), ANON_HISTORY_KEY(), baseHistoryKey()]);
    try {
      const base = baseHistoryKey();
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (key && (key === base || key.startsWith(`${base}::`))) keys.add(key);
      }
    } catch (_) {}
    return Array.from(keys);
  }
  function removeWorkoutFromStoredHistory(storageKey, id) {
    const key = String(id || "");
    if (!key || !storageKey) return false;
    try {
      const raw = localStorage.getItem(storageKey);
      const parsed = raw ? JSON.parse(raw) : null;
      if (!Array.isArray(parsed)) return false;
      const next = parsed.filter(s =>
        String(s?.localId || s?.id || "") !== key &&
        String(s?.remoteId || "") !== key
      );
      if (next.length === parsed.length) return false;
      if (next.length) localStorage.setItem(storageKey, JSON.stringify(next.slice(0, 50)));
      else localStorage.removeItem(storageKey);
      return true;
    } catch (_) {
      return false;
    }
  }
  function importAnonLocalHistory() {
    const userId = uid();
    if (!userId) return;
    const rows = loadAnonHistory();
    if (!rows.length) return;
    const existing = CACHE.localSessions || [];
    const seen = new Set(existing.map(s => String(s.localId || s.remoteId || s.startedAt || s.started_at || "")));
    const imported = rows.filter(s => !seen.has(String(s.localId || s.remoteId || s.startedAt || s.started_at || "")));
    CACHE.localSessions = imported.concat(existing).slice(0, 50);
    saveLocalHistory(CACHE.localSessions);
    saveAnonHistory([]);
    CACHE.status = txt(`${imported.length} seance(s) locale(s) recuperee(s).`, `${imported.length} local workout(s) recovered.`);
  }
  function rememberLocalWorkout(summary, synced) {
    const id = summary.localId || ("local_" + Date.now() + "_" + Math.random().toString(16).slice(2));
    const row = Object.assign({}, summary, {
      localId: id,
      localOnly: !synced,
      savedLocallyAt: new Date().toISOString(),
    });
    CACHE.localSessions = [row].concat((CACHE.localSessions || []).filter(s => s.localId !== id)).slice(0, 50);
    saveLocalHistory(CACHE.localSessions);
    return row;
  }
  function markLocalSynced(localId, remoteId) {
    if (!localId) return;
    CACHE.localSessions = (CACHE.localSessions || []).map(s => String(s.localId) === String(localId)
      ? Object.assign({}, s, { localOnly: false, remoteId: remoteId || s.remoteId })
      : s);
    saveLocalHistory(CACHE.localSessions);
  }
  function isLocalWorkoutUnsynced(row) {
    return !!row && !String(row.remoteId || "").trim();
  }
  function removeLocalWorkout(id) {
    const key = String(id || "");
    CACHE.localSessions = (CACHE.localSessions || []).filter(s => String(s.localId || s.id || "") !== key && String(s.remoteId || "") !== key);
    saveLocalHistory(CACHE.localSessions);
    sportHistoryKeys().forEach(storageKey => removeWorkoutFromStoredHistory(storageKey, key));
  }
  function removeSessionFromRuntime(id) {
    const key = String(id || "");
    if (!key) return;
    const itemIds = new Set((CACHE.items || [])
      .filter(item => String(item.session_id || "") === key)
      .map(item => String(item.id || ""))
      .filter(Boolean));
    CACHE.sessions = (CACHE.sessions || []).filter(s => String(s.id || "") !== key);
    CACHE.items = (CACHE.items || []).filter(item => String(item.session_id || "") !== key);
    CACHE.sets = (CACHE.sets || []).filter(set => !itemIds.has(String(set.item_id || "")));
    publishSportHistory("delete-local");
  }
  function updateLocalWorkoutDate(id, newDate) {
    const key = String(id || "");
    const d = String(newDate || "").slice(0, 10);
    if (!key || !d) return false;
    let changed = false;
    CACHE.localSessions = (CACHE.localSessions || []).map(s => {
      if (String(s.localId || s.id || "") !== key && String(s.remoteId || "") !== key) return s;
      changed = true;
      const oldStart = String(s.startedAt || s.started_at || new Date().toISOString());
      const oldEnd = String(s.endedAt || s.ended_at || oldStart);
      return Object.assign({}, s, {
        startedAt: `${d}T${oldStart.slice(11, 19) || "00:00:00"}`,
        endedAt: `${d}T${oldEnd.slice(11, 19) || oldStart.slice(11, 19) || "00:00:00"}`,
      });
    });
    if (changed) saveLocalHistory(CACHE.localSessions);
    return changed;
  }
  function makePlanItem(activityKey, overrides) {
    const a = catalogItem(activityKey || "strength");
    const mode = overrides?.mode || a.mode;
    const intensity = overrides?.intensity || "moderate";
    return {
      tmpId: "tmp_" + Date.now() + "_" + Math.random().toString(16).slice(2),
      activityKey: a.key,
      exerciseName: overrides?.exerciseName || (lang() === "en" ? a.en : a.fr),
      equipment: overrides?.equipment || a.equipment,
      mode,
      targetReps: mode === "reps" ? n(overrides?.targetReps, 10) : 0,
      targetSeconds: mode === "time" ? n(overrides?.targetSeconds, 45) : n(overrides?.targetSeconds, 0),
      sets: Math.max(1, Math.round(n(overrides?.sets, 1))),
      restSeconds: Math.max(0, Math.round(n(overrides?.restSeconds, CACHE.globalRestSeconds || 60))),
      weightKg: n(overrides?.weightKg, 0),
      distanceM: n(overrides?.distanceM, 0),
      intensity,
      intensityLabel: intensity === "light" ? txt("legere", "light") : intensity === "hard" ? txt("forte", "hard") : intensity === "max" ? txt("tres forte", "very hard") : txt("moderee", "moderate"),
      metValue: n(overrides?.metValue, a.met * intensityFactor(intensity)),
      notes: overrides?.notes || "",
    };
  }
  function exerciseLabel(ex) {
    return lang() === "en" ? ex.en : ex.fr;
  }
  function libraryToPlanItem(ex) {
    return makePlanItem(ex.activityKey, {
      exerciseName: exerciseLabel(ex),
      equipment: ex.equipment,
      mode: ex.mode,
      targetReps: ex.reps || 0,
      targetSeconds: ex.seconds || 0,
      sets: ex.sets || 1,
      restSeconds: ex.rest || 0,
      distanceM: ex.distanceM || 0,
      weightKg: 0,
    });
  }
  function normalizedEquipmentForGoal(goal, equipment) {
    const g = String(goal || "strength");
    const eq = String(equipment || "all");
    if (g === "basketball") return eq === "all" || eq === "outdoor" ? eq : "outdoor";
    if (g === "swim") return eq === "all" || eq === "pool" ? eq : "pool";
    if (g === "climb") return eq === "all" || eq === "wall" ? eq : "wall";
    return eq;
  }
  function filteredExercises(goal, equipment) {
    const g = goal || "strength";
    const eq = normalizedEquipmentForGoal(g, equipment || "all");
    return EXERCISE_LIBRARY
      .filter(ex => (g === "free" || ex.goal === g || (g === "cardio" && ex.goal === "basketball")) && (eq === "all" || ex.equipment === eq))
      .slice()
      .sort((a, b) => exercisePriority(a, g) - exercisePriority(b, g));
  }
  function normalizedSearch(s) {
    return String(s || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }
  function visibleExercises(equipment, query) {
    const eq = String(equipment || "all");
    const q = normalizedSearch(query);
    return EXERCISE_LIBRARY
      .filter(ex => (eq === "all" || ex.equipment === eq))
      .filter(ex => {
        if (!q) return true;
        return normalizedSearch(`${ex.fr} ${ex.en} ${labelEquipment(ex.equipment)}`).includes(q);
      })
      .slice()
      .sort((a, b) => exerciseLabel(a).localeCompare(exerciseLabel(b), lang() === "en" ? "en" : "fr", { sensitivity: "base" }));
  }
  function exercisePriority(ex, goal) {
    if (goal === "cardio") {
      if (ex.activityKey === "running") return 0;
      if (ex.activityKey === "cycling") return 1;
      if (ex.activityKey === "walking" || ex.activityKey === "hiking") return 2;
      if (ex.activityKey === "rowing") return 3;
      if (ex.activityKey === "hiit") return 6;
    }
    if (goal === "basketball") {
      if (ex.key === "basketball_1h") return 0;
      if (ex.key === "basketball_shootaround") return 1;
    }
    if (goal === "strength") {
      if (ex.equipment === "bodyweight") return 0;
      if (ex.equipment === "band") return 1;
      if (ex.equipment === "dumbbell") return 2;
      if (ex.equipment === "machine") return 3;
    }
    return 5;
  }
  function goalOptions(selected) {
    return GOALS.map(g => `<option value="${esc(g[0])}" ${g[0] === selected ? "selected" : ""}>${esc(lang() === "en" ? g[2] : g[1])}</option>`).join("");
  }
  function levelOptions(selected) {
    return LEVELS.map(row => `<option value="${esc(row[0])}" ${row[0] === selected ? "selected" : ""}>${esc(lang() === "en" ? row[2] : row[1])}</option>`).join("");
  }
  function durationOptions(selected) {
    return [15, 25, 35, 45, 60, 75].map(v => `<option value="${v}" ${Number(selected) === v ? "selected" : ""}>${v} min</option>`).join("");
  }
  function libraryOptions(goal, equipment, selected) {
    const rows = visibleExercises(equipment, CACHE.exerciseSearch || "");
    return `<option value="">${esc(txt("Choisir un exercice", "Choose an exercise"))}</option>` + rows.map(ex => `<option value="${esc(ex.key)}" ${ex.key === selected ? "selected" : ""}>${esc(exerciseLabel(ex))}</option>`).join("");
  }
  function simpleExerciseOptions(goal, equipment, selected) {
    const rows = filteredExercises(goal, equipment);
    const list = rows.length ? rows : filteredExercises(goal, "all");
    return list.map(ex => `<option value="${esc(ex.key)}" ${ex.key === selected ? "selected" : ""}>${esc(exerciseLabel(ex))}</option>`).join("");
  }
  function defaultFormat(goal) {
    return goal === "strength" || goal === "free" ? "reps" : "time";
  }
  function formatOptions(selected) {
    const rows = [
      ["time", txt("Duree", "Duration")],
      ["reps", txt("Repetitions", "Reps")],
      ["max_reps", txt("Max reps", "Max reps")],
    ];
    return rows.map(row => `<option value="${esc(row[0])}" ${row[0] === selected ? "selected" : ""}>${esc(row[1])}</option>`).join("");
  }
  function libraryEquipmentOptions(selected) {
    const opts = [`<option value="all" ${selected === "all" ? "selected" : ""}>${esc(txt("Tous les materiels", "All equipment"))}</option>`];
    EQUIPMENT.forEach(row => {
      opts.push(`<option value="${esc(row[0])}" ${row[0] === selected ? "selected" : ""}>${esc(lang() === "en" ? row[2] : row[1])}</option>`);
    });
    return opts.join("");
  }
  function applyExerciseToForm(root, key) {
    const ex = EXERCISE_LIBRARY.find(row => row.key === key);
    if (!root || !ex) return;
    const setVal = (selector, value) => {
      const el = root.querySelector(selector);
      if (el) el.value = String(value ?? "");
    };
    setVal("#sport-activity", ex.activityKey);
    setVal("#sport-ex-name", exerciseLabel(ex));
    setVal("#sport-equipment", ex.equipment);
    setVal("#sport-mode", ex.mode);
    setVal("#sport-reps", ex.mode === "reps" ? n(ex.reps, 0) : 0);
    setVal("#sport-seconds", ex.mode === "time" ? n(ex.seconds, 45) : 45);
    setVal("#sport-sets", n(ex.sets, 1));
    setVal("#sport-rest", n(ex.rest, CACHE.globalRestSeconds || 60) || 60);
    setVal("#sport-distance", n(ex.distanceM, 0));
    setVal("#sport-load", 0);
    setVal("#sport-intensity", "moderate");
    syncLoadField(root);
    syncSimpleFields(root);
  }
  function refreshExercisePicker(root) {
    if (!root) return;
    const select = root.querySelector("#sport-library-ex");
    if (!select) return;
    const selected = select.value;
    select.innerHTML = libraryOptions("free", CACHE.builderEquipment || "all", selected);
    if (selected && EXERCISE_LIBRARY.some(ex => ex.key === selected)) select.value = selected;
    if (!select.value) {
      const first = visibleExercises(CACHE.builderEquipment || "all", CACHE.exerciseSearch || "")[0];
      if (first) {
        select.value = first.key;
        applyExerciseToForm(root, first.key);
      }
    }
  }
  function simplePlanItemFromForm(root) {
    const goal = CACHE.builderGoal || "strength";
    const key = root?.querySelector("#sport-simple-ex")?.value || "";
    const ex = EXERCISE_LIBRARY.find(row => row.key === key) || filteredExercises(goal, CACHE.builderEquipment || "all")[0] || EXERCISE_LIBRARY[0];
    const format = root?.querySelector("#sport-simple-format")?.value || defaultFormat(goal);
    const item = libraryToPlanItem(ex);
    const minutes = Math.max(1, n(root?.querySelector("#sport-simple-minutes")?.value, 45));
    const reps = Math.max(1, Math.round(n(root?.querySelector("#sport-simple-reps")?.value, item.targetReps || ex.reps || 10)));
    item.mode = format === "time" ? "time" : "reps";
    item.targetSeconds = format === "time" ? minutes * 60 : 0;
    item.targetReps = format === "time" ? 0 : reps;
    item.sets = format === "max_reps" ? 1 : Math.max(1, Math.round(n(root?.querySelector("#sport-simple-sets")?.value, item.sets || 3)));
    item.restSeconds = format === "max_reps" ? 0 : Math.max(0, Math.round(n(root?.querySelector("#sport-simple-rest")?.value, item.restSeconds || CACHE.globalRestSeconds || 60)));
    item.distanceM = Math.max(0, n(root?.querySelector("#sport-simple-distance")?.value, item.distanceM || 0));
    if (format === "max_reps") item.exerciseName = `${item.exerciseName} - ${txt("max reps", "max reps")}`;
    item.notes = format === "max_reps" ? txt("Serie max : saisis le nombre realise.", "Max set: enter completed reps.") : "";
    return item;
  }
  function syncSimpleFields(root) {
    const format = root?.querySelector("#sport-mode")?.value || root?.querySelector("#sport-simple-format")?.value || "time";
    const isTime = format === "time";
    const isMax = format === "max_reps";
    const show = (selector, visible) => {
      const el = root?.querySelector(selector);
      if (el) el.style.display = visible ? "" : "none";
    };
    show("#sport-reps-wrap", !isTime);
    show("#sport-seconds-wrap", isTime);
    show("#sport-simple-minutes-wrap", isTime);
    show("#sport-simple-distance-wrap", isTime);
    show("#sport-simple-reps-wrap", !isTime);
    show("#sport-simple-sets-wrap", !isTime && !isMax);
    show("#sport-simple-rest-wrap", !isTime && !isMax);
  }
  function planItemFromManualForm(root, existing) {
    const libraryKey = String(root.querySelector("#sport-library-ex")?.value || "");
    const libraryEx = EXERCISE_LIBRARY.find(row => row.key === libraryKey) || null;
    const a = catalogItem(root.querySelector("#sport-activity")?.value || libraryEx?.activityKey || existing?.activityKey || "strength");
    const intensity = String(root.querySelector("#sport-intensity")?.value || existing?.intensity || "moderate");
    const mode = String(root.querySelector("#sport-mode")?.value || existing?.mode || a.mode);
    const selectedEquipment = String(root.querySelector("#sport-library-equipment")?.value || "");
    const exerciseName = String(root.querySelector("#sport-ex-name")?.value || (libraryEx ? exerciseLabel(libraryEx) : "") || existing?.exerciseName || (lang() === "en" ? a.en : a.fr)).trim();
    const item = Object.assign({}, existing || {}, {
      tmpId: existing?.tmpId || ("tmp_" + Date.now() + "_" + Math.random().toString(16).slice(2)),
      activityKey: a.key,
      exerciseName,
      equipment: String(root.querySelector("#sport-equipment")?.value || libraryEx?.equipment || (selectedEquipment && selectedEquipment !== "all" ? selectedEquipment : "") || existing?.equipment || a.equipment),
      mode,
      targetReps: mode === "reps" ? n(root.querySelector("#sport-reps")?.value, existing?.targetReps || 0) : 0,
      targetSeconds: mode === "time" ? n(root.querySelector("#sport-seconds")?.value, existing?.targetSeconds || 0) : n(root.querySelector("#sport-seconds")?.value, 0),
      sets: Math.max(1, Math.round(n(root.querySelector("#sport-sets")?.value, existing?.sets || 1))),
      restSeconds: Math.max(0, Math.round(n(root.querySelector("#sport-rest")?.value, restSecondsForItem(existing || {})))),
      weightKg: n(root.querySelector("#sport-load")?.value, existing?.weightKg || 0),
      distanceM: n(root.querySelector("#sport-distance")?.value, existing?.distanceM || 0),
      intensity,
      intensityLabel: root.querySelector("#sport-intensity")?.selectedOptions?.[0]?.textContent || existing?.intensityLabel || txt("moderee", "moderate"),
      metValue: a.met * intensityFactor(intensity),
      notes: existing?.notes || "",
    });
    if (item.equipment === "band") item.weightKg = 0;
    item.metValue = calibratedMet(item);
    return item;
  }
  function goalFromTemplate(kind) {
    if (kind === "run") return "cardio";
    if (kind === "swim") return "swim";
    if (kind === "climb") return "climb";
    if (kind === "mobility") return "mobility";
    return "strength";
  }
  function tunedPlanItem(ex, level) {
    const item = libraryToPlanItem(ex);
    const lvl = level || "regular";
    if (lvl === "beginner") {
      item.sets = Math.max(1, Math.round(n(item.sets, 1) - 1));
      item.targetReps = item.mode === "reps" ? Math.max(5, Math.round(n(item.targetReps, 0) * 0.75)) : item.targetReps;
      item.targetSeconds = item.mode === "time" ? Math.max(25, Math.round(n(item.targetSeconds, 0) * 0.75)) : item.targetSeconds;
      item.restSeconds = Math.round(n(item.restSeconds, 0) * 1.15);
      item.intensity = "light";
      item.intensityLabel = txt("legere", "light");
    } else if (lvl === "advanced") {
      item.sets = Math.max(1, Math.round(n(item.sets, 1) + 1));
      item.targetReps = item.mode === "reps" ? Math.round(n(item.targetReps, 0) * 1.15) : item.targetReps;
      item.targetSeconds = item.mode === "time" ? Math.round(n(item.targetSeconds, 0) * 1.15) : item.targetSeconds;
      item.restSeconds = Math.max(15, Math.round(n(item.restSeconds, 0) * 0.9));
      item.intensity = "hard";
      item.intensityLabel = txt("forte", "hard");
    }
    const a = catalogItem(item.activityKey);
    item.metValue = a.met * intensityFactor(item.intensity);
    return item;
  }
  function smartWarmup(goal) {
    if (goal === "swim") return EXERCISE_LIBRARY.find(ex => ex.key === "swim_warmup");
    if (goal === "climb") return EXERCISE_LIBRARY.find(ex => ex.key === "finger_warmup");
    if (goal === "cardio") return EXERCISE_LIBRARY.find(ex => ex.key === "brisk_walk") || EXERCISE_LIBRARY.find(ex => ex.key === "hips");
    return EXERCISE_LIBRARY.find(ex => ex.key === "world_greatest_stretch") || EXERCISE_LIBRARY.find(ex => ex.key === "hips");
  }
  function smartCooldown(goal) {
    if (goal === "swim") return EXERCISE_LIBRARY.find(ex => ex.key === "swim_cooldown");
    if (goal === "cardio") return EXERCISE_LIBRARY.find(ex => ex.key === "breathing");
    return EXERCISE_LIBRARY.find(ex => ex.key === "hamstring_flow") || EXERCISE_LIBRARY.find(ex => ex.key === "breathing");
  }
  function generateSmartPlan() {
    const goal = CACHE.builderGoal || "strength";
    const equipment = normalizedEquipmentForGoal(goal, CACHE.builderEquipment || "all");
    const level = CACHE.builderLevel || "regular";
    const targetSeconds = Math.max(10, n(CACHE.builderDuration, 35)) * 60;
    const pool = filteredExercises(goal, equipment)
      .filter(ex => ex.key !== "breathing")
      .filter(ex => goal === "mobility" || ex.goal === goal);
    const fallback = filteredExercises(goal, "all");
    const candidates = (pool.length ? pool : fallback).filter(Boolean);
    const plan = [];
    const warm = smartWarmup(goal);
    if (warm && goal !== "free") plan.push(tunedPlanItem(warm, level));
    let idx = 0;
    while (candidates.length && totalPlanSeconds(plan) < targetSeconds * 0.82 && idx < 18) {
      const ex = candidates[idx % candidates.length];
      if (plan.some(item => String(item.exerciseName || "") === exerciseLabel(ex))) {
        idx += 1;
        if (idx > candidates.length * 2) break;
        continue;
      }
      plan.push(tunedPlanItem(ex, level));
      idx += 1;
    }
    const cool = smartCooldown(goal);
    if (cool && goal !== "free" && totalPlanSeconds(plan) < targetSeconds * 1.08) plan.push(tunedPlanItem(cool, "beginner"));
    if (plan.length) return plan;
    const sportFallback = filteredExercises(goal, "all")[0];
    return sportFallback ? [tunedPlanItem(sportFallback, level)] : [defaultPlanItem()];
  }
  function defaultPlanItem() {
    return makePlanItem("bodyweight_strength", { exerciseName: "Push-up", mode: "reps", targetReps: 30, sets: 3, restSeconds: 60 });
  }
  function templatePlan(kind) {
    if (kind === "run") {
      return [
        makePlanItem("mobility", { exerciseName: txt("Echauffement mobilite", "Mobility warm-up"), mode: "time", targetSeconds: 300, sets: 1, restSeconds: 0 }),
        makePlanItem("running", { exerciseName: txt("Course facile", "Easy run"), mode: "time", targetSeconds: 1200, sets: 1, restSeconds: 0, distanceM: 3000 }),
        makePlanItem("walking", { exerciseName: txt("Retour au calme", "Cool down"), mode: "time", targetSeconds: 300, sets: 1, restSeconds: 0 }),
      ];
    }
    if (kind === "swim") {
      return [
        makePlanItem("swimming", { exerciseName: txt("Echauffement nage", "Swim warm-up"), mode: "time", targetSeconds: 300, sets: 1, restSeconds: 60, distanceM: 200 }),
        makePlanItem("swimming", { exerciseName: txt("Series nage", "Swim intervals"), mode: "time", targetSeconds: 120, sets: 6, restSeconds: 45, distanceM: 50 }),
        makePlanItem("swimming", { exerciseName: txt("Retour calme nage", "Swim cool down"), mode: "time", targetSeconds: 240, sets: 1, restSeconds: 0, distanceM: 100 }),
      ];
    }
    if (kind === "climb") {
      return [
        makePlanItem("mobility", { exerciseName: txt("Echauffement doigts/epaules", "Finger/shoulder warm-up"), mode: "time", targetSeconds: 420, sets: 1, restSeconds: 0 }),
        makePlanItem("climbing", { exerciseName: txt("Voies faciles", "Easy routes"), mode: "time", targetSeconds: 240, sets: 4, restSeconds: 120 }),
        makePlanItem("climbing", { exerciseName: txt("Projet / essais", "Project attempts"), mode: "time", targetSeconds: 180, sets: 6, restSeconds: 180 }),
      ];
    }
    if (kind === "mobility") {
      return [
        makePlanItem("mobility", { exerciseName: txt("Mobilite hanches", "Hip mobility"), mode: "time", targetSeconds: 60, sets: 3, restSeconds: 20 }),
        makePlanItem("mobility", { exerciseName: txt("Mobilite epaules", "Shoulder mobility"), mode: "time", targetSeconds: 60, sets: 3, restSeconds: 20 }),
        makePlanItem("yoga", { exerciseName: txt("Respiration / relachement", "Breathing / release"), mode: "time", targetSeconds: 180, sets: 1, restSeconds: 0 }),
      ];
    }
    return [
      makePlanItem("bodyweight_strength", { exerciseName: "Push-up", mode: "reps", targetReps: 20, sets: 3, restSeconds: 60 }),
      makePlanItem("bodyweight_strength", { exerciseName: "Squat", mode: "reps", targetReps: 20, sets: 3, restSeconds: 60 }),
      makePlanItem("plank_core", { exerciseName: txt("Gainage", "Plank"), mode: "time", targetSeconds: 45, sets: 3, restSeconds: 90 }),
    ];
  }
  function quickPlanItem(kind) {
    const ex = EXERCISE_LIBRARY.find(row => row.key === kind || (kind === "pushup" && row.key === "pushup"));
    return libraryToPlanItem(ex || EXERCISE_LIBRARY[0]);
  }

  function ensureStyles() {
    if (document.getElementById("tb-sport-style")) return;
    const style = document.createElement("style");
    style.id = "tb-sport-style";
    style.textContent = `
      .tb-sport-shell{display:flex;flex-direction:column;gap:16px;}
      .tb-sport-hero{border-radius:26px;padding:22px;background:linear-gradient(135deg,#0f2e74,#2563eb 52%,#0ea5e9);color:white;display:flex;justify-content:space-between;gap:16px;align-items:flex-start;box-shadow:0 22px 60px rgba(37,99,235,.20);}
      .tb-sport-hero h2{margin:0;font-size:30px;line-height:1.05;}
      .tb-sport-hero p{margin:8px 0 0;color:rgba(255,255,255,.78);}
      .tb-sport-pill{display:inline-flex;align-items:center;gap:8px;border-radius:999px;padding:9px 12px;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.22);font-weight:900;}
      .tb-sport-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;}
      .tb-sport-stat{border:1px solid rgba(148,163,184,.18);border-radius:18px;background:linear-gradient(180deg,#fff,#f8fafc);padding:12px;box-shadow:0 10px 24px rgba(15,23,42,.05);}
      .tb-sport-stat span{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#64748b;font-weight:900;}
      .tb-sport-stat strong{display:block;margin-top:6px;font-size:22px;line-height:1;font-weight:950;color:#0f172a;}
      .tb-sport-grid{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(320px,.9fr);gap:14px;}
      .tb-sport-card{border:1px solid rgba(148,163,184,.20);border-radius:22px;background:linear-gradient(180deg,#fff,#f8fafc);box-shadow:0 14px 36px rgba(15,23,42,.06);padding:16px;}
      .tb-sport-card h3{margin:0 0 10px;font-size:18px;}
      .tb-sport-profile{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:12px;}
      .tb-sport-profile-note{border:1px solid rgba(14,165,233,.16);border-radius:16px;background:#e0f2fe;color:#075985;padding:10px 12px;font-weight:850;}
      .tb-sport-fields{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;}
      .tb-sport-field{display:flex;flex-direction:column;gap:6px;min-width:0;}
      .tb-sport-field label{font-size:11px;text-transform:uppercase;letter-spacing:.07em;font-weight:900;color:#64748b;}
      .tb-sport-field input,.tb-sport-field select,.tb-sport-field textarea{border:1px solid rgba(148,163,184,.32);border-radius:14px;background:#fff;padding:11px 12px;font-weight:800;color:#0f172a;box-sizing:border-box;width:100%;}
      .tb-sport-quick-row{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0;}
      .tb-sport-quick-btn{border:1px solid rgba(37,99,235,.16);border-radius:999px;background:#fff;color:#0f172a;padding:9px 12px;font-weight:950;cursor:pointer;box-shadow:0 8px 18px rgba(15,23,42,.05);}
      .tb-sport-library{margin-top:12px;border:1px solid rgba(14,165,233,.14);border-radius:18px;background:linear-gradient(180deg,#f0f9ff,#f8fafc);padding:12px;}
      .tb-sport-library-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:10px;flex-wrap:wrap;}
      .tb-sport-library-filters{display:flex;gap:8px;flex-wrap:wrap;align-items:end;}
      .tb-sport-library-filters .tb-sport-field{min-width:min(210px,100%);}
      .tb-sport-library-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;}
      .tb-sport-ex-card{border:1px solid rgba(148,163,184,.20);border-radius:15px;background:#fff;padding:10px;text-align:left;cursor:pointer;font-weight:900;color:#0f172a;}
      .tb-sport-ex-card span{display:block;margin-top:5px;color:#64748b;font-size:12px;font-weight:750;}
      .tb-sport-advanced{margin-top:10px;border:1px solid rgba(148,163,184,.18);border-radius:16px;background:rgba(248,250,252,.72);padding:10px;}
      .tb-sport-advanced summary{cursor:pointer;font-weight:950;color:#0f172a;}
      .tb-sport-plan{display:flex;flex-direction:column;gap:10px;margin-top:12px;}
      .tb-sport-item{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;border:1px solid rgba(148,163,184,.18);border-radius:18px;padding:12px;background:#fff;}
      .tb-sport-item-title{font-weight:950;color:#0f172a;}
      .tb-sport-meta{display:flex;gap:6px;flex-wrap:wrap;margin-top:7px;}
      .tb-sport-chip{border-radius:999px;padding:5px 9px;background:#e0f2fe;color:#075985;font-size:12px;font-weight:900;}
      .tb-sport-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center;}
      .tb-sport-template-row{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0 4px;}
      .tb-sport-smart{border:1px solid rgba(37,99,235,.16);border-radius:20px;background:linear-gradient(135deg,#eff6ff,#f8fafc);padding:12px;margin:12px 0;}
      .tb-sport-smart-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;margin-bottom:10px;flex-wrap:wrap;}
      .tb-sport-simple{border:1px solid rgba(14,165,233,.18);border-radius:22px;background:linear-gradient(180deg,#f0f9ff,#fff);padding:14px;margin:12px 0;}
      .tb-sport-simple-title{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap;margin-bottom:10px;}
      .tb-sport-timer{min-height:300px;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;gap:12px;border-radius:24px;background:radial-gradient(circle at 50% 0%,rgba(37,99,235,.18),transparent 38%),#0f172a;color:white;padding:18px;}
      .tb-sport-timer .kind{font-size:12px;text-transform:uppercase;letter-spacing:.12em;color:#93c5fd;font-weight:950;}
      .tb-sport-timer .name{font-size:34px;font-weight:950;line-height:1.05;}
      .tb-sport-timer .clock{font-size:56px;font-weight:950;letter-spacing:-.05em;}
      .tb-sport-timer .hint{color:#cbd5e1;font-weight:800;}
      .tb-sport-next{border-radius:16px;padding:9px 11px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);color:#dbeafe;font-weight:850;}
      .tb-sport-modal-backdrop{position:fixed;inset:0;z-index:9998;background:rgba(15,23,42,.58);backdrop-filter:blur(14px);display:flex;align-items:center;justify-content:center;padding:18px;}
      .tb-sport-modal{width:min(560px,100%);border-radius:26px;background:linear-gradient(180deg,#fff,#f8fafc);box-shadow:0 30px 80px rgba(15,23,42,.28);border:1px solid rgba(148,163,184,.24);padding:18px;}
      .tb-sport-modal h3{margin:0 0 6px;font-size:22px;}
      .tb-sport-choice-row{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0;}
      .tb-sport-choice{border:1px solid rgba(148,163,184,.28);border-radius:999px;background:#fff;padding:9px 12px;font-weight:900;cursor:pointer;}
      .tb-sport-choice.active{background:linear-gradient(135deg,#1d4ed8,#0891b2);color:white;border-color:transparent;}
      .tb-sport-history{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:10px;}
      .tb-sport-history-card{border:1px solid rgba(148,163,184,.18);border-radius:18px;background:#fff;padding:12px;}
      .tb-sport-status{border:1px solid rgba(14,165,233,.18);border-radius:16px;background:#e0f2fe;color:#075985;padding:10px 12px;font-weight:850;}
      body.theme-dark .tb-sport-card,body.theme-dark .tb-sport-item,body.theme-dark .tb-sport-history-card{background:#111827;color:#f8fafc;border-color:rgba(255,255,255,.12);}
      body.theme-dark .tb-sport-stat{background:#111827;border-color:rgba(255,255,255,.12);}
      body.theme-dark .tb-sport-stat strong{color:#f8fafc;}
      body.theme-dark .tb-sport-status{background:rgba(14,165,233,.14);color:#bae6fd;border-color:rgba(125,211,252,.20);}
      body.theme-dark .tb-sport-profile-note{background:rgba(14,165,233,.14);color:#bae6fd;border-color:rgba(125,211,252,.20);}
      body.theme-dark .tb-sport-library{background:rgba(14,165,233,.08);border-color:rgba(125,211,252,.18);}
      body.theme-dark .tb-sport-smart{background:rgba(37,99,235,.10);border-color:rgba(147,197,253,.16);}
      body.theme-dark .tb-sport-simple{background:rgba(14,165,233,.08);border-color:rgba(125,211,252,.18);}
      body.theme-dark .tb-sport-ex-card{background:#0f172a;color:#f8fafc;border-color:rgba(255,255,255,.12);}
      body.theme-dark .tb-sport-ex-card span{color:#94a3b8;}
      body.theme-dark .tb-sport-modal{background:linear-gradient(180deg,#111827,#0f172a);color:#f8fafc;border-color:rgba(255,255,255,.12);}
      body.theme-dark .tb-sport-choice{background:#0f172a;color:#f8fafc;border-color:rgba(255,255,255,.14);}
      body.theme-dark .tb-sport-quick-btn{background:#0f172a;color:#f8fafc;border-color:rgba(255,255,255,.14);}
      body.theme-dark .tb-sport-advanced{background:rgba(15,23,42,.72);border-color:rgba(255,255,255,.12);}
      body.theme-dark .tb-sport-advanced summary{color:#f8fafc;}
      body.theme-dark .tb-sport-field input,body.theme-dark .tb-sport-field select,body.theme-dark .tb-sport-field textarea{background:#0f172a;color:#f8fafc;border-color:rgba(255,255,255,.14);}
      @media(max-width:980px){.tb-sport-grid{grid-template-columns:1fr}.tb-sport-fields,.tb-sport-profile{grid-template-columns:repeat(2,minmax(0,1fr))}.tb-sport-hero{flex-direction:column}}
      @media(max-width:620px){.tb-sport-fields,.tb-sport-profile{grid-template-columns:1fr}.tb-sport-timer .clock{font-size:44px}.tb-sport-timer .name{font-size:26px}}
      body.tb-capacitor-app[data-tb-view="sport"] #sport-root{padding:0!important;background:transparent!important;border:0!important;box-shadow:none!important;}
      body.tb-capacitor-app[data-tb-view="sport"] .tb-sport-shell{gap:10px!important;}
      body.tb-capacitor-app[data-tb-view="sport"] .tb-sport-hero{border-radius:22px!important;padding:16px!important;min-height:0!important;box-shadow:0 16px 34px rgba(37,99,235,.16)!important;}
      body.tb-capacitor-app[data-tb-view="sport"] .tb-sport-hero h2{font-size:24px!important;line-height:1.05!important;}
      body.tb-capacitor-app[data-tb-view="sport"] .tb-sport-hero p{display:none!important;}
      body.tb-capacitor-app[data-tb-view="sport"] .tb-sport-pill{padding:7px 10px!important;font-size:12px!important;}
      body.tb-capacitor-app[data-tb-view="sport"] .tb-sport-stats{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important;}
      body.tb-capacitor-app[data-tb-view="sport"] .tb-sport-stat{border-radius:15px!important;padding:10px!important;}
      body.tb-capacitor-app[data-tb-view="sport"] .tb-sport-stat span{font-size:9px!important;letter-spacing:.06em!important;}
      body.tb-capacitor-app[data-tb-view="sport"] .tb-sport-stat strong{font-size:18px!important;}
      body.tb-capacitor-app[data-tb-view="sport"] .tb-sport-grid{grid-template-columns:1fr!important;gap:10px!important;}
      body.tb-capacitor-app[data-tb-view="sport"] .tb-sport-card{border-radius:18px!important;padding:12px!important;}
      body.tb-capacitor-app[data-tb-view="sport"] .tb-sport-card h3{font-size:16px!important;margin-bottom:8px!important;}
      body.tb-capacitor-app[data-tb-view="sport"] .tb-sport-profile{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important;margin-bottom:8px!important;}
      body.tb-capacitor-app[data-tb-view="sport"] .tb-sport-profile-note{grid-column:1 / -1!important;padding:8px 10px!important;font-size:11px!important;}
      body.tb-capacitor-app[data-tb-view="sport"] .tb-sport-fields{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important;}
      body.tb-capacitor-app[data-tb-view="sport"] .tb-sport-field label{font-size:9px!important;letter-spacing:.05em!important;}
      body.tb-capacitor-app[data-tb-view="sport"] .tb-sport-field input,
      body.tb-capacitor-app[data-tb-view="sport"] .tb-sport-field select,
      body.tb-capacitor-app[data-tb-view="sport"] .tb-sport-field textarea{min-height:38px!important;border-radius:13px!important;padding:8px 9px!important;font-size:12px!important;}
      body.tb-capacitor-app[data-tb-view="sport"] .tb-sport-simple{border-radius:18px!important;padding:11px!important;margin:9px 0!important;}
      body.tb-capacitor-app[data-tb-view="sport"] .tb-sport-simple-title{margin-bottom:8px!important;}
      body.tb-capacitor-app[data-tb-view="sport"] .tb-sport-simple-title .muted{display:none!important;}
      body.tb-capacitor-app[data-tb-view="sport"] .tb-sport-quick-row{display:grid!important;grid-template-columns:repeat(5,minmax(0,1fr))!important;gap:6px!important;margin:8px 0!important;}
      body.tb-capacitor-app[data-tb-view="sport"] .tb-sport-quick-btn{min-width:0!important;padding:8px 5px!important;font-size:10px!important;text-align:center!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;}
      body.tb-capacitor-app[data-tb-view="sport"] .tb-sport-smart,
      body.tb-capacitor-app[data-tb-view="sport"] .tb-sport-library,
      body.tb-capacitor-app[data-tb-view="sport"] .tb-sport-advanced{border-radius:16px!important;padding:9px!important;margin:8px 0!important;}
      body.tb-capacitor-app[data-tb-view="sport"] .tb-sport-library-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:7px!important;}
      body.tb-capacitor-app[data-tb-view="sport"] .tb-sport-ex-card{border-radius:13px!important;padding:9px!important;font-size:11px!important;}
      body.tb-capacitor-app[data-tb-view="sport"] .tb-sport-ex-card span{font-size:10px!important;}
      body.tb-capacitor-app[data-tb-view="sport"] .tb-sport-actions{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:7px!important;}
      body.tb-capacitor-app[data-tb-view="sport"] .tb-sport-actions .btn{width:100%!important;justify-content:center!important;min-height:34px!important;padding:7px 8px!important;font-size:11px!important;white-space:normal!important;}
      body.tb-capacitor-app[data-tb-view="sport"] .tb-sport-plan{gap:8px!important;margin-top:10px!important;}
      body.tb-capacitor-app[data-tb-view="sport"] .tb-sport-item{grid-template-columns:1fr!important;gap:8px!important;border-radius:16px!important;padding:10px!important;}
      body.tb-capacitor-app[data-tb-view="sport"] .tb-sport-item-title{font-size:13px!important;}
      body.tb-capacitor-app[data-tb-view="sport"] .tb-sport-meta{gap:4px!important;margin-top:5px!important;}
      body.tb-capacitor-app[data-tb-view="sport"] .tb-sport-chip{padding:4px 7px!important;font-size:10px!important;}
      body.tb-capacitor-app[data-tb-view="sport"] .tb-sport-timer{min-height:220px!important;border-radius:18px!important;padding:14px!important;}
      body.tb-capacitor-app[data-tb-view="sport"] .tb-sport-timer .name{font-size:24px!important;}
      body.tb-capacitor-app[data-tb-view="sport"] .tb-sport-timer .clock{font-size:42px!important;}
      body.tb-capacitor-app[data-tb-view="sport"] .tb-sport-history{grid-template-columns:1fr!important;gap:8px!important;}
      body.tb-capacitor-app[data-tb-view="sport"] .tb-sport-history-card{border-radius:16px!important;padding:10px!important;}
      body.tb-capacitor-app[data-tb-view="sport"] .tb-sport-history-card > div:first-child{align-items:center!important;}
      body.tb-capacitor-app[data-tb-view="sport"] .tb-sport-modal-backdrop{z-index:100030!important;align-items:flex-start!important;padding:calc(12px + env(safe-area-inset-top,0px)) 10px calc(82px + env(safe-area-inset-bottom,0px))!important;}
      body.tb-capacitor-app[data-tb-view="sport"] .tb-sport-modal{max-height:calc(100vh - 94px - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px))!important;overflow:auto!important;-webkit-overflow-scrolling:touch!important;border-radius:22px!important;padding:12px!important;}
      body.tb-capacitor-app[data-tb-view="sport"] .tb-sport-modal h3{position:sticky!important;top:-12px!important;z-index:2!important;margin:-12px -12px 8px!important;padding:12px!important;background:linear-gradient(180deg,rgba(255,255,255,.98),rgba(255,255,255,.90))!important;border-bottom:1px solid rgba(15,23,42,.06)!important;font-size:18px!important;}
      body.theme-dark.tb-capacitor-app[data-tb-view="sport"] .tb-sport-modal h3{background:linear-gradient(180deg,rgba(15,23,42,.98),rgba(15,23,42,.90))!important;}
      @media(max-width:380px){
        body.tb-capacitor-app[data-tb-view="sport"] .tb-sport-fields,
        body.tb-capacitor-app[data-tb-view="sport"] .tb-sport-profile{grid-template-columns:1fr!important;}
        body.tb-capacitor-app[data-tb-view="sport"] .tb-sport-quick-row{grid-template-columns:repeat(3,minmax(0,1fr))!important;}
      }
    `;
    document.head.appendChild(style);
  }

  function publishSportHistory(reason) {
    if (window.state) {
      state.sportSessions = Array.isArray(CACHE.sessions) ? CACHE.sessions : [];
      state.sportSessionItems = Array.isArray(CACHE.items) ? CACHE.items : [];
      state.sportSets = Array.isArray(CACHE.sets) ? CACHE.sets : [];
    }
    try { if (typeof window.renderKPI === "function") window.renderKPI(); } catch (_) {}
    try {
      if (reason && typeof window.tbSaveOfflineSnapshot === "function") window.tbSaveOfflineSnapshot(`sport:${reason}`);
    } catch (_) {}
  }

  async function loadHistory() {
    if (CACHE.loading) return;
    const c = client();
    const userId = uid();
    reloadScopedLocalState();
    const offline = (typeof window.tbShouldUseOfflineMode === "function")
      ? await window.tbShouldUseOfflineMode("sport:loadHistory")
      : ((typeof window.tbIsOfflineMode === "function" && window.tbIsOfflineMode()) || (navigator && navigator.onLine === false));
    if (offline) {
      CACHE.sessions = Array.isArray(state?.sportSessions) ? state.sportSessions : [];
      CACHE.items = Array.isArray(state?.sportSessionItems) ? state.sportSessionItems : [];
      CACHE.sets = Array.isArray(state?.sportSets) ? state.sportSets : [];
      CACHE.loaded = true;
      CACHE.loading = false;
      CACHE.error = "";
      CACHE.status = txt("Historique restaure hors ligne.", "History restored offline.");
      publishSportHistory("offline");
      return;
    }
    if (!c || !userId) {
      CACHE.loaded = true;
      CACHE.sessions = [];
      CACHE.items = [];
      CACHE.sets = [];
      CACHE.error = "";
      CACHE.status = txt("Historique local uniquement pour le moment.", "Local history only for now.");
      publishSportHistory("local");
      return;
    }
    CACHE.loading = true;
    CACHE.error = "";
    try {
      await syncPendingSportDeletes(c, userId);
      const sess = await c
        .from(table("sport_sessions"))
        .select("id,user_id,travel_id,activity_type,started_at,ended_at,duration_seconds,mood_before,mood_after,energy,fatigue,pain,body_weight_kg,notes,estimated_kcal,created_at")
        .eq("user_id", userId)
        .order("started_at", { ascending: false })
        .limit(20);
      if (sess.error) throw sess.error;
      const pendingDeletes = new Set(loadPendingDeletes());
      const filteredSessions = (sess.data || []).filter(s => !pendingDeletes.has(String(s.id || "")));
      const sessionIds = filteredSessions.map(s => s.id).filter(Boolean);
      let items = { data: [], error: null };
      let sets = { data: [], error: null };
      if (sessionIds.length) {
        items = await c
          .from(table("sport_session_items"))
          .select("id,user_id,session_id,activity_key,exercise_name,equipment,mode,target_reps,target_seconds,distance_m,planned_sets,rest_seconds,sort_order,met_value,notes")
          .in("session_id", sessionIds)
          .order("sort_order", { ascending: true });
        if (items.error) throw items.error;
        const itemIds = (items.data || []).map(i => i.id).filter(Boolean);
        if (itemIds.length) {
          sets = await c
            .from(table("sport_sets"))
            .select("id,user_id,item_id,set_index,reps,duration_seconds,weight_kg,distance_m,completed_at,perceived_effort,notes")
            .in("item_id", itemIds)
            .order("set_index", { ascending: true });
          if (sets.error) throw sets.error;
        }
      }
      CACHE.sessions = filteredSessions;
      CACHE.items = items.data || [];
      CACHE.sets = sets.data || [];
      CACHE.loaded = true;
      CACHE.status = CACHE.sessions.length
        ? txt(`Historique synchronise : ${CACHE.sessions.length} seance(s) SQL.`, `Synced history: ${CACHE.sessions.length} SQL workout(s).`)
        : txt("Aucune seance SQL pour ce compte. Les seances locales restent visibles tant qu'elles ne sont pas synchronisees.", "No SQL workout for this account. Local workouts remain visible until synced.");
      publishSportHistory("load");
    } catch (e) {
      CACHE.error = e?.message || String(e);
      CACHE.loaded = true;
      if (isOfflineSkipError(CACHE.error)) {
        CACHE.sessions = Array.isArray(state?.sportSessions) ? state.sportSessions : [];
        CACHE.items = Array.isArray(state?.sportSessionItems) ? state.sportSessionItems : [];
        CACHE.sets = Array.isArray(state?.sportSets) ? state.sportSets : [];
        CACHE.error = "";
        CACHE.status = txt("Historique restaure hors ligne.", "History restored offline.");
        publishSportHistory("fallback");
      } else {
        console.warn("[sport] load failed", CACHE.error);
      }
    } finally {
      CACHE.loading = false;
    }
  }

  function activityOptions(selected) {
    return CATALOG.map(a => `<option value="${esc(a.key)}" ${a.key === selected ? "selected" : ""}>${esc(lang() === "en" ? a.en : a.fr)}</option>`).join("");
  }
  function equipmentOptions(selected) {
    return EQUIPMENT.map(e => `<option value="${esc(e[0])}" ${e[0] === selected ? "selected" : ""}>${esc(lang() === "en" ? e[2] : e[1])}</option>`).join("");
  }
  function intensityOptions(selected) {
    const rows = [
      ["light", txt("Legere", "Light"), 0.82],
      ["moderate", txt("Moderee", "Moderate"), 1],
      ["hard", txt("Forte", "Hard"), 1.18],
      ["max", txt("Tres forte", "Very hard"), 1.35],
    ];
    return rows.map(r => `<option value="${esc(r[0])}" data-factor="${r[2]}" ${r[0] === selected ? "selected" : ""}>${esc(r[1])}</option>`).join("");
  }
  function intensityFactor(key) {
    if (key === "light") return 0.82;
    if (key === "hard") return 1.18;
    if (key === "max") return 1.35;
    return 1;
  }

  function renderBuilder() {
    const kg = bodyWeight();
    const height = bodyHeight();
    const bmi = bmiValue(kg, height);
    const planSec = totalPlanSeconds(CACHE.plan);
    const kcal = totalPlanKcal(CACHE.plan, kg);
    const selectedEquipment = CACHE.builderEquipment || "all";
    const search = CACHE.exerciseSearch || "";
    const editIdx = Number.isInteger(CACHE.editingPlanIndex) ? CACHE.editingPlanIndex : null;
    const editing = editIdx !== null ? CACHE.plan[editIdx] : null;
    const rows = visibleExercises(selectedEquipment, search);
    const baseExercise = rows[0] || visibleExercises(selectedEquipment, "")[0] || EXERCISE_LIBRARY[0];
    const manualActivity = editing?.activityKey || baseExercise?.activityKey || "strength";
    const manualEquipment = editing?.equipment || baseExercise?.equipment || "bodyweight";
    const manualMode = editing?.mode || baseExercise?.mode || "reps";
    const manualName = editing?.exerciseName || exerciseLabel(baseExercise) || "Push-up";
    const manualRest = editing ? restSecondsForItem(editing) : n(CACHE.globalRestSeconds, 60);
    const manualReps = n(editing?.targetReps, baseExercise?.reps || 10);
    const manualSeconds = n(editing?.targetSeconds, baseExercise?.seconds || 45);
    const manualSets = n(editing?.sets, baseExercise?.sets || 3);
    const circuit = CACHE.circuit || { enabled: false, rounds: 4, roundRestSeconds: 60, amrapMinutes: 0 };
    const matchedExercise = EXERCISE_LIBRARY.find(ex =>
      String(exerciseLabel(ex)).toLowerCase() === String(manualName).toLowerCase() ||
      String(ex.key) === String(editing?.libraryKey || "")
    );
    return `
      <div class="tb-sport-card">
        <h3>${esc(txt("Creer une seance", "Create workout"))}</h3>
        <div class="tb-sport-profile">
          <div class="tb-sport-field"><label>${esc(txt("Ton poids", "Your weight"))}</label><input id="sport-weight" type="number" step="0.1" value="${esc(String(kg))}"></div>
          <div class="tb-sport-field"><label>${esc(txt("Ta taille", "Your height"))}</label><input id="sport-height" type="number" step="1" value="${esc(String(height))}"></div>
          <div class="tb-sport-profile-note">
            ${esc(txt("Kcal basees sur ton profil", "Calories based on your profile"))}<br>
            <span style="font-size:12px;">${esc(txt("IMC indicatif", "Indicative BMI"))}: ${bmi ? bmi.toFixed(1) : "-"}</span>
          </div>
        </div>
        ${editing ? `<div class="tb-sport-status" style="margin-bottom:10px;">${esc(txt(`Edition de l'exercice ${editIdx + 1}`, `Editing exercise ${editIdx + 1}`))}</div>` : ""}
        <div class="tb-sport-simple">
          <div class="tb-sport-simple-title">
            <div>
              <strong>${esc(txt("Exercice a ajouter", "Exercise to add"))}</strong>
              <div class="muted">${esc(txt("Choisis le format : en repetitions seul le nombre de reps apparait, en temps seule la duree apparait.", "Choose the format: reps shows reps only, time shows duration only."))}</div>
            </div>
          </div>
          <div class="tb-sport-quick-row" aria-label="${esc(txt("Raccourcis sport", "Sport shortcuts"))}">
            <button class="tb-sport-quick-btn" type="button" data-sport-quick="brisk_walk">${esc(txt("Marche", "Walk"))}</button>
            <button class="tb-sport-quick-btn" type="button" data-sport-quick="easy_run">${esc(txt("Course", "Run"))}</button>
            <button class="tb-sport-quick-btn" type="button" data-sport-quick="jump_rope">${esc(txt("Corde", "Rope"))}</button>
            <button class="tb-sport-quick-btn" type="button" data-sport-quick="pushup">${esc(txt("Muscu", "Strength"))}</button>
            <button class="tb-sport-quick-btn" type="button" data-sport-quick="cycling_easy">${esc(txt("Velo", "Bike"))}</button>
          </div>
          <div class="tb-sport-fields">
            <div class="tb-sport-field"><label>${esc(txt("Materiel", "Equipment"))}</label><select id="sport-library-equipment">${libraryEquipmentOptions(selectedEquipment)}</select></div>
            <div class="tb-sport-field"><label>${esc(txt("Recherche", "Search"))}</label><input id="sport-ex-search" type="search" value="${esc(search)}" placeholder="${esc(txt("Ecris le nom", "Type a name"))}"></div>
            <div class="tb-sport-field"><label>${esc(txt("Exercice", "Exercise"))}</label><select id="sport-library-ex">${libraryOptions("free", selectedEquipment, matchedExercise?.key || baseExercise?.key || "")}</select></div>
            <div class="tb-sport-field"><label>${esc(txt("Nom", "Name"))}</label><input id="sport-ex-name" value="${esc(manualName)}"></div>
            <input id="sport-activity" type="hidden" value="${esc(manualActivity)}">
            <input id="sport-equipment" type="hidden" value="${esc(manualEquipment)}">
            <div class="tb-sport-field"><label>${esc(txt("Mode", "Mode"))}</label><select id="sport-mode"><option value="reps" ${manualMode === "reps" ? "selected" : ""}>${esc(txt("Repetitions", "Reps"))}</option><option value="time" ${manualMode === "time" ? "selected" : ""}>${esc(txt("Temps", "Time"))}</option></select></div>
            <div class="tb-sport-field" id="sport-reps-wrap"><label>${esc(txt("Repetitions", "Reps"))}</label><input id="sport-reps" type="number" min="1" value="${esc(String(manualReps || 10))}"></div>
            <div class="tb-sport-field" id="sport-seconds-wrap"><label>${esc(txt("Temps exercice sec", "Exercise time sec"))}</label><input id="sport-seconds" type="number" min="1" value="${esc(String(manualSeconds || 45))}"></div>
            <div class="tb-sport-field"><label>${esc(txt("Series", "Sets"))}</label><input id="sport-sets" type="number" min="1" value="${esc(String(manualSets || 3))}"></div>
            <div class="tb-sport-field"><label>${esc(txt("Repos apres serie sec", "Rest after set sec"))}</label><input id="sport-rest" type="number" min="0" value="${esc(String(manualRest || 60))}"></div>
            <input id="sport-intensity" type="hidden" value="${esc(editing?.intensity || "moderate")}">
            <div class="tb-sport-field"><label>${esc(txt("Charge kg optionnelle", "Optional load kg"))}</label><input id="sport-load" type="number" step="0.5" value="${esc(String(n(editing?.weightKg, 0)))}"></div>
            <div class="tb-sport-field"><label>${esc(txt("Distance m optionnelle", "Optional distance m"))}</label><input id="sport-distance" type="number" value="${esc(String(n(editing?.distanceM, baseExercise?.distanceM || 0)))}"></div>
            <div class="tb-sport-field"><label>${esc(txt("Repos par defaut sec", "Default rest sec"))}</label><input id="sport-global-rest" type="number" min="0" value="${esc(String(n(CACHE.globalRestSeconds, 60)))}"></div>
          </div>
          <div class="tb-sport-actions" style="margin-top:12px;">
            <button class="btn primary" type="button" id="sport-add-item">${editing ? esc(txt("Mettre a jour", "Update")) : `+ ${esc(txt("Ajouter l'exercice", "Add exercise"))}`}</button>
            ${editing ? `<button class="btn" type="button" id="sport-cancel-edit">${esc(txt("Annuler", "Cancel"))}</button>` : ""}
            <button class="btn" type="button" id="sport-clear">${esc(txt("Vider", "Clear"))}</button>
          </div>
        </div>
        <div class="tb-sport-simple" style="margin-top:12px;">
          <div class="tb-sport-simple-title">
            <div>
              <strong>${esc(txt("Tours / circuit", "Rounds / circuit"))}</strong>
              <div class="muted">${esc(txt("La liste d'exercices devient un tour. Repete-la ou lance un max de tours en X minutes.", "The exercise list becomes one round. Repeat it or run max rounds in X minutes."))}</div>
            </div>
          </div>
          <div class="tb-sport-fields">
            <div class="tb-sport-field"><label>${esc(txt("Mode tours", "Round mode"))}</label><select id="sport-circuit-enabled"><option value="off" ${!circuit.enabled ? "selected" : ""}>${esc(txt("Classique", "Classic"))}</option><option value="on" ${circuit.enabled ? "selected" : ""}>${esc(txt("Circuit", "Circuit"))}</option></select></div>
            <div class="tb-sport-field"><label>${esc(txt("Nombre de tours", "Round count"))}</label><input id="sport-circuit-rounds" type="number" min="1" value="${esc(String(n(circuit.rounds, 4)))}"></div>
            <div class="tb-sport-field"><label>${esc(txt("Repos entre tours sec", "Rest between rounds sec"))}</label><input id="sport-circuit-rest" type="number" min="0" value="${esc(String(n(circuit.roundRestSeconds, 60)))}"></div>
            <div class="tb-sport-field"><label>${esc(txt("AMRAP minutes", "AMRAP minutes"))}</label><input id="sport-circuit-amrap" type="number" min="0" value="${esc(String(n(circuit.amrapMinutes, 0)))}"></div>
          </div>
        </div>
        <div class="muted" style="margin-top:8px;">${esc(txt("Les kcal sont indicatives : poids, duree effective, type d'effort, intensite et charge externe si elle est portee. Un elastique ne s'ajoute pas a ton poids.", "Calories are indicative: weight, effective duration, effort type, intensity and external load when carried. Resistance bands are not added to body weight."))}</div>
        <div class="tb-sport-actions" style="margin-top:12px;">
          <button class="btn primary" type="button" id="sport-mark-done-builder" ${CACHE.plan.length ? "" : "disabled"}>${esc(txt("Marquer la seance faite", "Mark workout done"))}</button>
        </div>
        <div class="muted" style="margin-top:10px;">${esc(txt("Estimation", "Estimate"))}: ${fmtSec(planSec)} - ${Math.round(kcal)} kcal (${esc(txt("indicatif", "indicative"))})</div>
        <div class="tb-sport-plan">${renderPlan()}</div>
      </div>`;
  }

  function renderPlan() {
    if (!CACHE.plan.length) return `<div class="muted">${esc(txt("Ajoute un exercice pour lancer une seance guidee.", "Add an exercise to start a guided workout."))}</div>`;
    return CACHE.plan.map((item, idx) => `
      <div class="tb-sport-item">
        <div>
          <div class="tb-sport-item-title">${idx + 1}. ${esc(item.exerciseName || labelActivity(item.activityKey))}</div>
          <div class="tb-sport-meta">
            <span class="tb-sport-chip">${esc(labelActivity(item.activityKey))}</span>
            <span class="tb-sport-chip">${esc(labelEquipment(item.equipment))}</span>
            <span class="tb-sport-chip">${item.mode === "time" ? `${n(item.targetSeconds,0)} sec` : `${n(item.targetReps,0)} reps`}</span>
            <span class="tb-sport-chip">${n(item.sets,1)} ${esc(txt("series", "sets"))}</span>
            <span class="tb-sport-chip">${restSecondsForItem(item)} sec ${esc(txt("repos", "rest"))}</span>
            <span class="tb-sport-chip">${esc(txt("Intensite", "Intensity"))}: ${esc(item.intensityLabel || txt("moderee", "moderate"))}</span>
            <span class="tb-sport-chip">MET ${calibratedMet(item).toFixed(1)}</span>
          </div>
        </div>
        <div class="tb-sport-actions">
          <button class="btn small" type="button" data-sport-edit="${idx}">${esc(txt("Modifier", "Edit"))}</button>
          <button class="btn small" type="button" data-sport-move="${idx}" data-dir="-1">Up</button>
          <button class="btn small" type="button" data-sport-move="${idx}" data-dir="1">Down</button>
          <button class="btn small danger" type="button" data-sport-remove="${idx}">Del</button>
        </div>
      </div>`).join("");
  }

  function makeSequence() {
    const seq = [];
    if (CACHE.circuit?.enabled && CACHE.plan.length) {
      const rounds = CACHE.circuit.amrapMinutes > 0 ? 1 : Math.max(1, Math.round(n(CACHE.circuit.rounds, 4)));
      for (let roundIndex = 1; roundIndex <= rounds; roundIndex += 1) {
        CACHE.plan.forEach((item, itemIndex) => {
          seq.push({ kind: "work", item, itemIndex, setIndex: roundIndex, roundIndex, roundTotal: rounds, duration: item.mode === "time" ? n(item.targetSeconds, 0) : 0 });
          const rest = restSecondsForItem(item);
          const hasNextInRound = itemIndex < CACHE.plan.length - 1;
          if (hasNextInRound && rest > 0) seq.push({ kind: "rest", item, itemIndex, setIndex: roundIndex, roundIndex, roundTotal: rounds, duration: rest });
        });
        if (roundIndex < rounds && n(CACHE.circuit.roundRestSeconds, 0) > 0) {
          seq.push({ kind: "round_rest", roundIndex, roundTotal: rounds, duration: n(CACHE.circuit.roundRestSeconds, 60) });
        }
      }
      return seq;
    }
    CACHE.plan.forEach((item, itemIndex) => {
      const sets = Math.max(1, Math.round(n(item.sets, 1)));
      for (let setIndex = 1; setIndex <= sets; setIndex += 1) {
        seq.push({ kind: "work", item, itemIndex, setIndex, duration: item.mode === "time" ? n(item.targetSeconds, 0) : 0 });
        const rest = restSecondsForItem(item);
        const hasNextWork = setIndex < sets || itemIndex < CACHE.plan.length - 1;
        if (hasNextWork && rest > 0) seq.push({ kind: "rest", item, itemIndex, setIndex, duration: rest });
      }
    });
    return seq;
  }

  function currentTimerStep() {
    const timer = CACHE.timer;
    if (!timer) return null;
    return timer.sequence[timer.index] || null;
  }
  function stepLabel(step) {
    if (!step) return txt("Fin", "End");
    if (step.kind === "round_rest") return `${txt("Fin du tour", "End of round")} ${step.roundIndex}`;
    if (step.kind === "rest") return txt("Repos", "Rest");
    return step.item?.exerciseName || labelActivity(step.item?.activityKey || "strength");
  }
  function nextStepLabel() {
    const timer = CACHE.timer;
    if (!timer) return "";
    const next = timer.sequence[timer.index + 1];
    return next ? stepLabel(next) : txt("Fin de seance", "End of workout");
  }

  function renderTimer() {
    const timer = CACHE.timer;
    if (!timer) {
      return `
        <div class="tb-sport-card">
          <h3>${esc(txt("Timer guide", "Guided timer"))}</h3>
          <div class="tb-sport-timer">
            <div class="kind">${esc(txt("Pret", "Ready"))}</div>
            <div class="name">${esc(txt("Construis ta seance", "Build your workout"))}</div>
            <div class="hint">${esc(txt("Lance le timer apres avoir ajoute tes exercices.", "Start the timer after adding exercises."))}</div>
            <div class="tb-sport-actions" style="justify-content:center;">
              <button class="btn primary" type="button" id="sport-start" ${CACHE.plan.length ? "" : "disabled"}>${esc(txt("Lancer la seance", "Start workout"))}</button>
              <button class="btn" type="button" id="sport-mark-done" ${CACHE.plan.length ? "" : "disabled"}>${esc(txt("Marquer faite", "Mark done"))}</button>
            </div>
          </div>
        </div>`;
    }
    const step = currentTimerStep();
    const elapsed = Math.max(0, Math.round((Date.now() - timer.startedAt) / 1000));
    const remaining = step && step.duration ? Math.max(0, Math.ceil((timer.stepEndAt - Date.now()) / 1000)) : 0;
    const workDone = timer.doneSets.length;
    const totalWork = timer.sequence.filter(s => s.kind === "work").length;
    const isRest = step?.kind === "rest" || step?.kind === "round_rest";
    const displayValue = isRest ? fmtSec(remaining) : (step?.item?.mode === "time" ? fmtSec(remaining) : `${n(step?.item?.targetReps, 0)} reps`);
    const roundInfo = step?.roundIndex ? ` - ${esc(txt("Tour", "Round"))} ${step.roundIndex}${step.roundTotal ? `/${step.roundTotal}` : ""}` : "";
    const amrap = CACHE.circuit?.enabled && n(CACHE.circuit?.amrapMinutes, 0) > 0;
    const amrapRemaining = amrap && timer.timeCapEndAt ? Math.max(0, Math.ceil((timer.timeCapEndAt - Date.now()) / 1000)) : 0;
    return `
      <div class="tb-sport-card">
        <h3>${esc(txt("Timer guide", "Guided timer"))}</h3>
        <div class="tb-sport-timer">
          <div class="kind">${esc(isRest ? txt("Repos", "Rest") : txt("Travail", "Work"))}${roundInfo} - ${workDone}/${totalWork}</div>
          <div class="name">${esc(isRest ? stepLabel(step) : (step?.item?.exerciseName || ""))}</div>
          <div class="clock">${esc(displayValue)}</div>
          ${amrap ? `<div class="hint">${esc(txt("AMRAP restant", "AMRAP left"))}: ${fmtSec(amrapRemaining)} - ${esc(txt("Tours valides", "Rounds counted"))}: ${n(timer.roundsCompleted, 0)}</div>` : ""}
          <div class="hint">${esc(txt("Temps total", "Total time"))}: ${fmtSec(elapsed)} ${step?.kind === "work" ? `- ${esc(labelEquipment(step.item.equipment))}` : ""}</div>
          <div class="tb-sport-next">${esc(txt("Ensuite", "Next"))}: ${esc(nextStepLabel())}</div>
          <div class="tb-sport-actions" style="justify-content:center;">
            ${step?.kind === "work" && step?.item?.mode === "reps" ? `<button class="btn primary" type="button" id="sport-step-done">${esc(txt("Fini", "Done"))}</button>` : ""}
            ${amrap ? `<button class="btn primary" type="button" id="sport-round-count">+ ${esc(txt("Tour", "Round"))}</button>` : ""}
            ${isRest ? `<button class="btn primary" type="button" id="sport-skip-rest">${esc(txt("Sauter le repos", "Skip rest"))}</button>` : ""}
            ${step?.duration ? `<button class="btn" type="button" id="sport-minus-time">-15s</button><button class="btn" type="button" id="sport-plus-time">+30s</button>` : ""}
            <button class="btn" type="button" id="sport-pause">${timer.paused ? esc(txt("Reprendre", "Resume")) : esc(txt("Pause", "Pause"))}</button>
            <button class="btn danger" type="button" id="sport-finish">${esc(txt("Terminer", "Finish"))}</button>
          </div>
        </div>
      </div>`;
  }

  function renderHistory() {
    const remoteSessions = CACHE.sessions || [];
    const localSessions = CACHE.localSessions || [];
    const recoverableAnonCount = uid() && !localSessions.length ? loadAnonHistory().length : 0;
    const unsyncedLocal = localSessions.filter(isLocalWorkoutUnsynced);
    const sessions = remoteSessions.concat(unsyncedLocal.map(localToHistorySession))
      .sort((a, b) => String(b.started_at || "").localeCompare(String(a.started_at || "")));
    const todayMergeCount = sessions.filter(isTodaySession).length;
    const status = CACHE.status ? `<div class="tb-sport-status">${esc(CACHE.status)}</div>` : "";
    const recover = recoverableAnonCount
      ? `<div class="tb-sport-status" style="margin-top:10px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
          <span>${esc(txt(`${recoverableAnonCount} ancienne(s) seance(s) locale(s) peuvent etre recuperee(s).`, `${recoverableAnonCount} old local workout(s) can be recovered.`))}</span>
          <button class="btn" type="button" id="sport-import-anon-history">${esc(txt("Recuperer", "Recover"))}</button>
        </div>`
      : "";
    const sync = uid() && unsyncedLocal.length
      ? `<div class="tb-sport-status" style="margin-top:10px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
          <span>${esc(txt(`${unsyncedLocal.length} seance(s) locale(s) a synchroniser.`, `${unsyncedLocal.length} local workout(s) to sync.`))}</span>
          <button class="btn primary" type="button" id="sport-sync-local-history">${esc(txt("Synchroniser", "Sync"))}</button>
        </div>`
      : "";
    if (CACHE.error) {
      return `<div class="tb-sport-card"><h3>${esc(txt("Historique", "History"))}</h3>${status}${recover}${sync}<div class="muted" style="margin-top:10px;">${esc(txt("Synchro Supabase indisponible, historique local conserve.", "Supabase sync unavailable, local history kept."))} ${esc(CACHE.error)}</div>${renderHistoryGrid(sessions)}</div>`;
    }
    return `
      <div class="tb-sport-card">
        <h3>${esc(txt("Historique", "History"))}</h3>
        ${status}
        ${recover}
        ${sync}
        ${todayMergeCount >= 2 ? `<div class="tb-sport-status" style="margin-top:10px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
          <span>${esc(txt(`${todayMergeCount} seances aujourd hui peuvent etre fusionnees.`, `${todayMergeCount} workouts today can be merged.`))}</span>
          <button class="btn primary" type="button" id="sport-merge-today">${esc(txt("Fusionner aujourd hui", "Merge today"))}</button>
        </div>` : ""}
        ${renderHistoryGrid(sessions)}
      </div>`;
  }
  function isTodaySession(s) {
    return localDateISO(s?.started_at || s?.startedAt) === todayISO();
  }
  function localToHistorySession(s) {
    return {
      id: s.localId,
      activity_type: s.plan?.[0]?.activityKey || "strength",
      started_at: s.startedAt,
      duration_seconds: s.durationSeconds,
      estimated_kcal: s.estimatedKcal,
      mood_after: s.moodAfter,
      localOnly: s.localOnly,
      localPlanCount: Array.isArray(s.plan) ? s.plan.length : 0,
      localSetCount: Array.isArray(s.doneSets) ? s.doneSets.length : 0,
      first_exercise: s.plan?.[0]?.exerciseName || "",
      perceived_effort: s.perceivedEffort || null,
    };
  }
  function renderHistoryGrid(sessions) {
    const visibleSessions = (sessions || []).slice(0, 20);
    const hiddenCount = Math.max(0, (sessions || []).length - visibleSessions.length);
    return `<div class="tb-sport-history" style="margin-top:10px;">
      ${visibleSessions.length ? visibleSessions.map(s => {
        const items = s.localPlanCount
          ? new Array(s.localPlanCount).fill(null)
          : (CACHE.items || []).filter(i => String(i.session_id) === String(s.id));
        const itemIds = new Set(items.map(i => String(i?.id || "")).filter(Boolean));
        const setCount = s.localSetCount || (CACHE.sets || []).filter(set => itemIds.has(String(set.item_id || ""))).length;
        const firstExercise = s.first_exercise || items.find(Boolean)?.exercise_name || "";
        return `<div class="tb-sport-history-card">
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">
            <div style="font-weight:950;">${esc(labelActivity(s.activity_type || items[0]?.activity_key || "strength"))}</div>
            <span class="tb-sport-chip">${esc(s.localOnly ? txt("local", "local") : txt("sync", "synced"))}</span>
          </div>
          ${firstExercise ? `<div class="muted" style="margin-top:4px;">${esc(firstExercise)}</div>` : ""}
          <div class="muted">${esc(String(s.started_at || "").slice(0, 16).replace("T", " "))}</div>
          <div class="tb-sport-meta">
            <span class="tb-sport-chip">${fmtSec(s.duration_seconds || 0)}</span>
            <span class="tb-sport-chip">${Math.round(n(s.estimated_kcal, 0))} kcal</span>
            <span class="tb-sport-chip">${items.length} ${esc(txt("exercices", "exercises"))}</span>
            <span class="tb-sport-chip">${setCount} ${esc(txt("series", "sets"))}</span>
            ${s.perceived_effort ? `<span class="tb-sport-chip">RPE ${esc(String(s.perceived_effort))}/10</span>` : ""}
          </div>
          ${s.mood_after ? `<div class="muted" style="margin-top:8px;">${esc(txt("Apres", "After"))}: ${esc(s.mood_after)}</div>` : ""}
          <div class="tb-sport-actions" style="margin-top:10px;">
            <button class="btn primary" type="button" data-sport-repeat-session="${esc(String(s.id || ""))}">${esc(txt("Refaire", "Repeat"))}</button>
            <button class="btn" type="button" data-sport-edit-date="${esc(String(s.id || ""))}" data-sport-date="${esc(String(s.started_at || "").slice(0, 10))}">${esc(txt("Modifier date", "Edit date"))}</button>
            <button class="btn danger" type="button" data-sport-delete-session="${esc(String(s.id || ""))}">${esc(txt("Supprimer", "Delete"))}</button>
          </div>
        </div>`;
      }).join("") : `<div class="muted">${esc(txt("Aucune seance enregistree.", "No saved workout yet."))}</div>`}
      ${hiddenCount ? `<div class="muted" style="margin-top:10px;">${esc(txt(`+ ${hiddenCount} seance(s) plus ancienne(s) masquee(s).`, `+ ${hiddenCount} older workout(s) hidden.`))}</div>` : ""}
    </div>`;
  }

  function sportStatsHTML() {
    const remoteSessions = CACHE.sessions || [];
    const localSessions = CACHE.localSessions || [];
    const sessions = remoteSessions.concat(
      localSessions
        .filter(isLocalWorkoutUnsynced)
        .map(localToHistorySession)
    );
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const inRange = (s, minDate) => {
      const d = new Date(s.started_at || s.startedAt || 0);
      return Number.isFinite(d.getTime()) && d >= minDate && d <= now;
    };
    const sum = (rows, prop) => rows.reduce((acc, row) => acc + n(row[prop], 0), 0);
    const week = sessions.filter(s => inRange(s, weekAgo));
    const month = sessions.filter(s => inRange(s, monthAgo));
    return `
      <div class="tb-sport-stats">
        <div class="tb-sport-stat"><span>${esc(txt("7 jours", "7 days"))}</span><strong>${week.length}</strong></div>
        <div class="tb-sport-stat"><span>${esc(txt("Temps", "Time"))}</span><strong>${fmtSec(sum(week, "duration_seconds"))}</strong></div>
        <div class="tb-sport-stat"><span>${esc(txt("30 jours", "30 days"))}</span><strong>${month.length}</strong></div>
        <div class="tb-sport-stat"><span>${esc(txt("Kcal", "Kcal"))}</span><strong>${Math.round(sum(month, "estimated_kcal"))}</strong></div>
      </div>`;
  }

  function renderSport(reason) {
    const root = document.getElementById("sport-root");
    if (!root) return;
    ensureStyles();
    reloadScopedLocalState(false);
    if (!CACHE.libraryLoaded && !CACHE.libraryLoading) {
      ensureSportLibraryLoaded(reason).then((changed) => {
        if (changed && (window.activeView || "") === "sport") renderSport("library-loaded");
      }).catch(() => {});
    }
    const kg = bodyWeight();
    const planSec = totalPlanSeconds(CACHE.plan);
    const kcal = totalPlanKcal(CACHE.plan, kg);
    root.innerHTML = `
      <div class="tb-sport-shell">
        <div class="tb-sport-hero">
          <div>
            <div style="font-size:11px;text-transform:uppercase;letter-spacing:.1em;font-weight:950;color:rgba(255,255,255,.72);">Sport</div>
            <h2>${esc(txt("Seances et timer guide", "Workouts and guided timer"))}</h2>
            <p>${esc(txt("Construis une seance, enchaine reps/temps/repos, puis sauvegarde ton ressenti et les calories estimees.", "Build a workout, chain reps/time/rest, then save how you felt and estimated calories."))}</p>
          </div>
          <div class="tb-sport-pill">${fmtSec(planSec)} - ${Math.round(kcal)} kcal</div>
        </div>
        ${sportStatsHTML()}
        <div class="tb-sport-grid">
          ${renderBuilder()}
          ${renderTimer()}
        </div>
        ${renderHistory()}
      </div>`;
    bind(root);
    if (!CACHE.loaded && !CACHE.loading) {
      loadHistory().then(() => {
        if ((typeof activeView === "string" ? activeView : "") === "sport") renderSport("loaded");
      });
    }
  }

  function bind(root) {
    const goalSelect = root.querySelector("#sport-goal");
    if (goalSelect) goalSelect.onchange = () => {
      CACHE.builderGoal = goalSelect.value || "strength";
      CACHE.builderEquipment = normalizedEquipmentForGoal(CACHE.builderGoal, CACHE.builderEquipment || "all");
      renderSport("goal");
    };
    const libraryEquipment = root.querySelector("#sport-library-equipment");
    if (libraryEquipment) libraryEquipment.onchange = () => {
      CACHE.builderEquipment = libraryEquipment.value || "all";
      renderSport("library-equipment");
    };
    const exerciseSearch = root.querySelector("#sport-ex-search");
    if (exerciseSearch) exerciseSearch.oninput = () => {
      CACHE.exerciseSearch = exerciseSearch.value || "";
      refreshExercisePicker(root);
    };
    const simpleAdd = root.querySelector("#sport-simple-add");
    if (simpleAdd) simpleAdd.onclick = () => {
      const item = simplePlanItemFromForm(root);
      CACHE.plan.push(item);
      savePlan();
      renderSport("simple-add");
    };
    const simpleFormat = root.querySelector("#sport-simple-format");
    if (simpleFormat) simpleFormat.onchange = () => syncSimpleFields(root);
    const modeSelect = root.querySelector("#sport-mode");
    if (modeSelect) modeSelect.onchange = () => syncSimpleFields(root);
    syncSimpleFields(root);
    const globalRest = root.querySelector("#sport-global-rest");
    if (globalRest) globalRest.onchange = () => {
      saveGlobalRest(globalRest.value);
      CACHE.plan = (CACHE.plan || []).map(item => Object.assign({}, item, {
        restSeconds: CACHE.globalRestSeconds,
      }));
      savePlan();
      renderSport("global-rest");
    };
    const saveCircuitFromForm = () => {
      saveCircuit({
        enabled: root.querySelector("#sport-circuit-enabled")?.value === "on",
        rounds: root.querySelector("#sport-circuit-rounds")?.value,
        roundRestSeconds: root.querySelector("#sport-circuit-rest")?.value,
        amrapMinutes: root.querySelector("#sport-circuit-amrap")?.value,
      });
      renderSport("circuit");
    };
    ["#sport-circuit-enabled", "#sport-circuit-rounds", "#sport-circuit-rest", "#sport-circuit-amrap"].forEach((selector) => {
      const el = root.querySelector(selector);
      if (el) el.onchange = saveCircuitFromForm;
    });
    const builderDuration = root.querySelector("#sport-builder-duration");
    if (builderDuration) builderDuration.onchange = () => {
      CACHE.builderDuration = Math.max(10, n(builderDuration.value, 35));
    };
    const builderLevel = root.querySelector("#sport-builder-level");
    if (builderLevel) builderLevel.onchange = () => {
      CACHE.builderLevel = builderLevel.value || "regular";
    };
    const generate = root.querySelector("#sport-generate-plan");
    if (generate) generate.onclick = () => {
      CACHE.builderDuration = Math.max(10, n(root.querySelector("#sport-builder-duration")?.value, CACHE.builderDuration || 35));
      CACHE.builderLevel = root.querySelector("#sport-builder-level")?.value || CACHE.builderLevel || "regular";
      CACHE.plan = generateSmartPlan();
      savePlan();
      renderSport("smart-generate");
    };
    const librarySelect = root.querySelector("#sport-library-ex");
    if (librarySelect) librarySelect.onchange = () => applyExerciseToForm(root, librarySelect.value);
    root.querySelectorAll("[data-sport-ex]").forEach(btn => {
      btn.onclick = () => {
        const ex = EXERCISE_LIBRARY.find(row => row.key === btn.getAttribute("data-sport-ex"));
        if (!ex) return;
        CACHE.plan.push(libraryToPlanItem(ex));
        savePlan();
        renderSport("library-add");
      };
    });
    const activity = root.querySelector("#sport-activity");
    if (activity) activity.onchange = () => {
      const a = catalogItem(activity.value);
      const ex = root.querySelector("#sport-ex-name");
      const eq = root.querySelector("#sport-equipment");
      const mode = root.querySelector("#sport-mode");
      if (ex) ex.value = lang() === "en" ? a.en : a.fr;
      if (eq) eq.value = a.equipment;
      if (mode) mode.value = a.mode;
      syncLoadField(root);
      syncSimpleFields(root);
    };
    const equipment = root.querySelector("#sport-equipment");
    if (equipment) equipment.onchange = () => syncLoadField(root);
    syncLoadField(root);
    const weight = root.querySelector("#sport-weight");
    if (weight) weight.onchange = () => { saveBodyWeight(weight.value); renderSport("weight"); };
    const height = root.querySelector("#sport-height");
    if (height) height.onchange = () => { saveBodyHeight(height.value); renderSport("height"); };
    const add = root.querySelector("#sport-add-item");
    if (add) add.onclick = () => {
      const editIdx = Number.isInteger(CACHE.editingPlanIndex) ? CACHE.editingPlanIndex : null;
      const item = planItemFromManualForm(root, editIdx !== null ? CACHE.plan[editIdx] : null);
      if (editIdx !== null && CACHE.plan[editIdx]) {
        CACHE.plan[editIdx] = item;
        CACHE.editingPlanIndex = null;
        sportFeedback(txt("Ligne mise a jour", "Line updated"), item.exerciseName, { toast: true });
      } else {
        CACHE.plan.push(item);
      }
      savePlan();
      renderSport("add-item");
    };
    const cancelEdit = root.querySelector("#sport-cancel-edit");
    if (cancelEdit) cancelEdit.onclick = () => {
      CACHE.editingPlanIndex = null;
      renderSport("cancel-edit");
    };
    const sample = root.querySelector("#sport-sample");
    if (sample) sample.onclick = () => {
      CACHE.plan = templatePlan("body");
      savePlan();
      renderSport("sample");
    };
    root.querySelectorAll("[data-sport-template]").forEach(btn => {
      btn.onclick = () => {
        const kind = String(btn.getAttribute("data-sport-template") || "body");
        CACHE.builderGoal = goalFromTemplate(kind);
        CACHE.plan = templatePlan(kind);
        savePlan();
        renderSport("template");
      };
    });
    root.querySelectorAll("[data-sport-quick]").forEach(btn => {
      btn.onclick = () => {
        const key = String(btn.getAttribute("data-sport-quick") || "pushup");
        const ex = EXERCISE_LIBRARY.find(row => row.key === key);
        if (!ex) return;
        CACHE.builderEquipment = ex.equipment || CACHE.builderEquipment || "all";
        CACHE.exerciseSearch = exerciseLabel(ex);
        renderSport("quick-fill");
        setTimeout(() => {
          const nextRoot = document.getElementById("sport-root");
          applyExerciseToForm(nextRoot, key);
        }, 0);
      };
    });
    const clear = root.querySelector("#sport-clear");
    if (clear) clear.onclick = () => { CACHE.plan = []; CACHE.editingPlanIndex = null; savePlan(); renderSport("clear"); };
    root.querySelectorAll("[data-sport-edit]").forEach(btn => {
      btn.onclick = () => {
        const idx = Number(btn.getAttribute("data-sport-edit"));
        if (!CACHE.plan[idx]) return;
        CACHE.editingPlanIndex = idx;
        renderSport("edit-line");
      };
    });
    root.querySelectorAll("[data-sport-remove]").forEach(btn => {
      btn.onclick = () => {
        const idx = Number(btn.getAttribute("data-sport-remove"));
        CACHE.plan.splice(idx, 1);
        if (Number(CACHE.editingPlanIndex) === idx) CACHE.editingPlanIndex = null;
        savePlan();
        renderSport("remove");
      };
    });
    root.querySelectorAll("[data-sport-move]").forEach(btn => {
      btn.onclick = () => {
        const idx = Number(btn.getAttribute("data-sport-move"));
        const dir = Number(btn.getAttribute("data-dir"));
        const next = idx + dir;
        if (next < 0 || next >= CACHE.plan.length) return;
        const tmp = CACHE.plan[idx];
        CACHE.plan[idx] = CACHE.plan[next];
        CACHE.plan[next] = tmp;
        savePlan();
        renderSport("move");
      };
    });
    const start = root.querySelector("#sport-start");
    if (start) start.onclick = startTimer;
    root.querySelectorAll("#sport-mark-done,#sport-mark-done-builder").forEach(btn => {
      btn.onclick = completePlanWithoutTimer;
    });
    const done = root.querySelector("#sport-step-done");
    if (done) done.onclick = completeStep;
    const skipRest = root.querySelector("#sport-skip-rest");
    if (skipRest) skipRest.onclick = skipRestStep;
    const roundCount = root.querySelector("#sport-round-count");
    if (roundCount) roundCount.onclick = () => {
      if (!CACHE.timer) return;
      CACHE.timer.roundsCompleted = n(CACHE.timer.roundsCompleted, 0) + 1;
      sportFeedback(txt("Tour ajoute", "Round added"), `${txt("Tours valides", "Rounds counted")}: ${CACHE.timer.roundsCompleted}`, { toast: true, persistNotification: true });
      renderSport("round-count");
    };
    const minusTime = root.querySelector("#sport-minus-time");
    if (minusTime) minusTime.onclick = () => adjustCurrentStepSeconds(-15);
    const plusTime = root.querySelector("#sport-plus-time");
    if (plusTime) plusTime.onclick = () => adjustCurrentStepSeconds(30);
    const pause = root.querySelector("#sport-pause");
    if (pause) pause.onclick = togglePause;
    const finish = root.querySelector("#sport-finish");
    if (finish) finish.onclick = finishWorkout;
    root.querySelectorAll("[data-sport-delete-session]").forEach(btn => {
      btn.onclick = () => deleteSportSession(btn.getAttribute("data-sport-delete-session"));
    });
    root.querySelectorAll("[data-sport-repeat-session]").forEach(btn => {
      btn.onclick = () => repeatSportSession(btn.getAttribute("data-sport-repeat-session"));
    });
    root.querySelectorAll("[data-sport-edit-date]").forEach(btn => {
      btn.onclick = () => editSportSessionDate(btn.getAttribute("data-sport-edit-date"), btn.getAttribute("data-sport-date"));
    });
    const importAnon = root.querySelector("#sport-import-anon-history");
    if (importAnon) importAnon.onclick = () => {
      importAnonLocalHistory();
      renderSport("import-anon-history");
    };
    const syncLocal = root.querySelector("#sport-sync-local-history");
    if (syncLocal) syncLocal.onclick = () => syncLocalWorkouts();
    const mergeToday = root.querySelector("#sport-merge-today");
    if (mergeToday) mergeToday.onclick = () => mergeTodaySportSessions();
  }
  function syncLoadField(root) {
    const equipment = root?.querySelector("#sport-equipment");
    const libraryKey = String(root?.querySelector("#sport-library-ex")?.value || "");
    const libraryEquipment = EXERCISE_LIBRARY.find(row => row.key === libraryKey)?.equipment || "";
    const selectedEquipment = String(root?.querySelector("#sport-library-equipment")?.value || "");
    const load = root?.querySelector("#sport-load");
    if (!load) return;
    const isBand = String(equipment?.value || libraryEquipment || selectedEquipment || "") === "band";
    if (isBand) load.value = "0";
    load.disabled = isBand;
    load.title = isBand
      ? txt("L'elastique ajoute une resistance, pas un poids porte.", "Resistance bands add tension, not carried load.")
      : "";
  }

  function planFromStoredSession(sessionId) {
    const id = String(sessionId || "");
    const local = (CACHE.localSessions || []).find(s =>
      String(s.localId || s.id || "") === id || String(s.remoteId || "") === id
    );
    if (Array.isArray(local?.plan) && local.plan.length) return local.plan.map(item => Object.assign({}, item));

    const sessionItems = (CACHE.items || [])
      .filter(item => String(item.session_id || "") === id)
      .slice()
      .sort((a, b) => n(a.sort_order, 0) - n(b.sort_order, 0));
    return sessionItems.map(item => makePlanItem(item.activity_key || "strength", {
      exerciseName: item.exercise_name || labelActivity(item.activity_key || "strength"),
      equipment: item.equipment || catalogItem(item.activity_key || "strength").equipment,
      mode: item.mode || "time",
      targetReps: item.target_reps || 0,
      targetSeconds: item.target_seconds || 0,
      sets: item.planned_sets || 1,
      restSeconds: item.rest_seconds || CACHE.globalRestSeconds || 60,
      distanceM: item.distance_m || 0,
      weightKg: 0,
      metValue: item.met_value || null,
      notes: item.notes || "",
    }));
  }
  function doneSetsFromStoredSession(sessionId, offset) {
    const id = String(sessionId || "");
    const baseOffset = Math.max(0, Math.round(n(offset, 0)));
    const local = (CACHE.localSessions || []).find(s =>
      String(s.localId || s.id || "") === id || String(s.remoteId || "") === id
    );
    if (Array.isArray(local?.doneSets)) {
      return local.doneSets.map(set => Object.assign({}, set, { itemIndex: baseOffset + Math.max(0, Math.round(n(set.itemIndex, 0))) }));
    }
    const sessionItems = (CACHE.items || [])
      .filter(item => String(item.session_id || "") === id)
      .slice()
      .sort((a, b) => n(a.sort_order, 0) - n(b.sort_order, 0));
    const itemIndexById = new Map(sessionItems.map((item, idx) => [String(item.id || ""), idx]));
    return (CACHE.sets || [])
      .filter(set => itemIndexById.has(String(set.item_id || "")))
      .slice()
      .sort((a, b) => {
        const ai = itemIndexById.get(String(a.item_id || "")) || 0;
        const bi = itemIndexById.get(String(b.item_id || "")) || 0;
        if (ai !== bi) return ai - bi;
        return n(a.set_index, 0) - n(b.set_index, 0);
      })
      .map(set => ({
        itemIndex: baseOffset + (itemIndexById.get(String(set.item_id || "")) || 0),
        setIndex: n(set.set_index, 1),
        reps: set.reps ?? null,
        durationSeconds: n(set.duration_seconds, 0),
        weightKg: n(set.weight_kg, 0),
        distanceM: n(set.distance_m, 0),
        completedAt: set.completed_at || new Date().toISOString(),
      }));
  }
  async function mergeTodaySportSessions() {
    const all = (CACHE.sessions || []).concat((CACHE.localSessions || []).filter(isLocalWorkoutUnsynced).map(localToHistorySession));
    const rows = all.filter(isTodaySession).sort((a, b) => String(a.started_at || "").localeCompare(String(b.started_at || "")));
    if (rows.length < 2) return;
    if (!confirm(txt(`Fusionner ${rows.length} seances d aujourd hui ?`, `Merge ${rows.length} workouts from today?`))) return;
    const plan = [];
    const doneSets = [];
    rows.forEach((session) => {
      const sessionPlan = planFromStoredSession(session.id);
      const offset = plan.length;
      plan.push(...sessionPlan);
      doneSets.push(...doneSetsFromStoredSession(session.id, offset));
    });
    if (!plan.length) {
      sportFeedback(txt("Fusion impossible", "Merge unavailable"), txt("Aucun detail de seance a fusionner.", "No workout details to merge."), { kind: "warn" });
      return;
    }
    const starts = rows.map(s => String(s.started_at || "")).filter(Boolean).sort();
    const totalDuration = rows.reduce((sum, s) => sum + n(s.duration_seconds, 0), 0);
    const totalKcal = rows.reduce((sum, s) => sum + n(s.estimated_kcal, 0), 0);
    const merged = {
      startedAt: starts[0] || new Date().toISOString(),
      endedAt: new Date().toISOString(),
      durationSeconds: Math.max(1, Math.round(totalDuration)),
      bodyWeightKg: bodyWeight(),
      bodyHeightCm: bodyHeight(),
      moodAfter: txt("Fusion jour", "Day merge"),
      perceivedEffort: null,
      notes: txt(`Fusion automatique de ${rows.length} seances du jour.`, `Automatic merge of ${rows.length} workouts from today.`),
      estimatedKcal: Math.max(1, Math.round(totalKcal || sessionKcalEstimate(plan, doneSets, bodyWeight(), totalDuration))),
      doneSets,
      plan,
    };
    CACHE.status = txt("Fusion des seances du jour...", "Merging today's workouts...");
    renderSport("merge-today-start");
    await saveWorkout(merged);
    const c = client();
    for (const session of rows) {
      const id = String(session.id || "");
      removeLocalWorkout(id);
      removeSessionFromRuntime(id);
      if (id.startsWith("local_")) continue;
      rememberPendingDelete(id);
      try {
        await deleteRemoteSportSession(c, id);
        clearPendingDelete(id);
      } catch (e) {
        if (!isOfflineSkipError(e)) console.warn("[sport] merge delete failed", e?.message || e);
      }
    }
    CACHE.loaded = false;
    CACHE.status = txt("Seances du jour fusionnees.", "Today's workouts merged.");
    await loadHistory();
    renderSport("merge-today");
  }

  function repeatSportSession(sessionId) {
    const plan = planFromStoredSession(sessionId);
    if (!plan.length) {
      sportFeedback(txt("Seance introuvable", "Workout not found"), txt("Impossible de reconstruire cette seance.", "Unable to rebuild this workout."), { kind: "warn" });
      return;
    }
    CACHE.plan = plan;
    CACHE.editingPlanIndex = null;
    CACHE.exerciseSearch = "";
    savePlan();
    sportFeedback(txt("Seance prete", "Workout ready"), txt("La seance est rechargee. Tu peux la relancer ou l'ajuster.", "Workout reloaded. You can start or adjust it."), { toast: true });
    renderSport("repeat-session");
  }

  function startTimer() {
    if (!CACHE.plan.length) return;
    saveBodyWeight(document.getElementById("sport-weight")?.value || bodyWeight());
    saveBodyHeight(document.getElementById("sport-height")?.value || bodyHeight());
    const seq = makeSequence();
    CACHE.timer = {
      sequence: seq,
      index: 0,
      startedAt: Date.now(),
      stepStartedAt: Date.now(),
      stepEndAt: seq[0]?.duration ? Date.now() + (seq[0].duration * 1000) : null,
      paused: false,
      pauseStartedAt: null,
      doneSets: [],
      roundsCompleted: 0,
      timeCapEndAt: CACHE.circuit?.enabled && n(CACHE.circuit?.amrapMinutes, 0) > 0 ? Date.now() + n(CACHE.circuit.amrapMinutes, 0) * 60000 : null,
      bodyWeightKg: bodyWeight(),
      bodyHeightCm: bodyHeight(),
    };
    requestWakeLock();
    sportFeedback(txt("Seance lancee", "Workout started"), txt("Timer sport lance. Bon entrainement.", "Sport timer started. Good workout."), { persistNotification: true });
    beep("work");
    startTicker();
    renderSport("timer-start");
  }

  function completePlanWithoutTimer() {
    if (!CACHE.plan.length) return;
    saveBodyWeight(document.getElementById("sport-weight")?.value || bodyWeight());
    saveBodyHeight(document.getElementById("sport-height")?.value || bodyHeight());
    stopTicker();
    releaseWakeLock();

    const weightKg = bodyWeight();
    const heightCm = bodyHeight();
    const durationSeconds = Math.max(1, Math.round(totalPlanSeconds(CACHE.plan)));
    const endedAt = Date.now();
    const startedAt = endedAt - durationSeconds * 1000;
    let cursor = startedAt;
    const doneSets = [];

    const circuitSequence = CACHE.circuit?.enabled ? makeSequence().filter(step => step.kind === "work") : null;
    if (circuitSequence?.length) {
      estimatedCompletionSequence().forEach((step) => {
        const stepSeconds = sequenceStepSeconds(step);
        cursor += stepSeconds * 1000;
        if (step.kind === "work") {
          const item = step.item;
          doneSets.push({
            itemIndex: step.itemIndex,
            setIndex: step.setIndex,
            reps: item.mode === "reps" ? n(item.targetReps, 0) : null,
            durationSeconds: stepSeconds,
            weightKg: effectiveLoadKg(item, weightKg),
            distanceM: n(item.distanceM, 0),
            completedAt: new Date(Math.min(cursor, endedAt)).toISOString(),
          });
        }
      });
    } else {
    (CACHE.plan || []).forEach((item, itemIndex) => {
      const sets = Math.max(1, Math.round(n(item.sets, 1)));
      for (let setIndex = 0; setIndex < sets; setIndex += 1) {
        const workSeconds = setWorkSeconds(item);
        cursor += workSeconds * 1000;
        doneSets.push({
          itemIndex,
          setIndex,
          reps: item.mode === "reps" ? n(item.targetReps, 0) : null,
          durationSeconds: workSeconds,
          weightKg: effectiveLoadKg(item, weightKg),
          distanceM: n(item.distanceM, 0),
          completedAt: new Date(Math.min(cursor, endedAt)).toISOString(),
        });
        cursor += Math.max(0, restSecondsForItem(item)) * 1000;
      }
    });
    }

    const summary = {
      startedAt: new Date(startedAt).toISOString(),
      endedAt: new Date(endedAt).toISOString(),
      durationSeconds,
      bodyWeightKg: weightKg,
      bodyHeightCm: heightCm,
      moodAfter: "",
      perceivedEffort: null,
      notes: "",
      estimatedKcal: Math.max(1, Math.round(sessionKcalEstimate(CACHE.plan, doneSets, weightKg, durationSeconds))),
      doneSets,
      plan: CACHE.plan.slice(),
    };
    CACHE.timer = null;
    CACHE.pendingSummary = summary;
    renderSport("mark-done");
    openFinishModal(summary);
  }

  function startTicker() {
    stopTicker();
    CACHE.ticker = setInterval(() => {
      const timer = CACHE.timer;
      const step = currentTimerStep();
      if (!timer || timer.paused || !step) return;
      if (timer.timeCapEndAt && Date.now() >= timer.timeCapEndAt) return finishWorkout();
      if (step.duration && Date.now() >= timer.stepEndAt) completeStep();
      else if ((typeof activeView === "string" ? activeView : "") === "sport") {
        const root = document.getElementById("sport-root");
        const card = root?.querySelector(".tb-sport-grid .tb-sport-card:nth-child(2)");
        if (card) {
          const tmp = document.createElement("div");
          tmp.innerHTML = renderTimer();
          card.replaceWith(tmp.firstElementChild);
          bind(root);
        }
      }
    }, 500);
  }
  function stopTicker() {
    if (CACHE.ticker) clearInterval(CACHE.ticker);
    CACHE.ticker = null;
  }
  function sportToast(message, kind) {
    try {
      const text = String(message || "");
      if (!text) return;
      if (kind === "warn" && typeof window.toastWarn === "function") return window.toastWarn(text);
      if (typeof window.toastOk === "function") return window.toastOk(text);
      if (typeof window.toastInfo === "function") return window.toastInfo(text);
    } catch (_) {}
  }
  function syncSportNotification(title, body, persist) {
    try {
      if (typeof window.tbSetNotificationBucket !== "function") return;
      const row = persist ? [{
        notificationKey: "sport:timer",
        title,
        body,
        view: "sport",
        source: "sport",
      }] : [];
      window.tbSetNotificationBucket("sport_timer", row);
    } catch (_) {}
  }
  function sportFeedback(title, body, opts) {
    const text = body || title;
    CACHE.status = text || CACHE.status;
    if (opts?.toast !== false) sportToast(text, opts?.kind);
    syncSportNotification(title || txt("Sport", "Sport"), text || "", !!opts?.persistNotification);
  }
  function beep(kind) {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      const ctx = new AC();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = kind === "finish" ? 1046 : kind === "rest" ? 660 : 880;
      gain.gain.value = kind === "finish" ? 0.11 : 0.08;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      setTimeout(() => { try { osc.stop(); ctx.close(); } catch (_) {} }, kind === "finish" ? 220 : 140);
    } catch (_) {}
  }
  function recordWorkStep(timer, step, durationOverride) {
    if (!timer || !step || step.kind !== "work") return;
    const exists = timer.doneSets.some(done =>
      Number(done.itemIndex) === Number(step.itemIndex) && Number(done.setIndex) === Number(step.setIndex)
    );
    if (exists) return;
    const duration = Number.isFinite(Number(durationOverride))
      ? Math.max(1, Math.round(Number(durationOverride)))
      : setWorkSeconds(step.item, step.item.mode === "reps" ? (Date.now() - timer.stepStartedAt) / 1000 : null);
    timer.doneSets.push({
      itemIndex: step.itemIndex,
      setIndex: step.setIndex,
      reps: step.item.mode === "reps" ? n(step.item.targetReps, 0) : null,
      durationSeconds: duration,
      weightKg: effectiveLoadKg(step.item, timer.bodyWeightKg),
      distanceM: n(step.item.distanceM, 0),
      completedAt: new Date().toISOString(),
    });
  }
  function completeStep() {
    const timer = CACHE.timer;
    const step = currentTimerStep();
    if (!timer || !step) return;
    recordWorkStep(timer, step);
    timer.index += 1;
    const next = currentTimerStep();
    beep(next?.kind === "rest" ? "rest" : "work");
    if (!next && timer.timeCapEndAt && Date.now() < timer.timeCapEndAt) {
      timer.roundsCompleted = n(timer.roundsCompleted, 0) + 1;
      timer.index = 0;
      const first = currentTimerStep();
      sportFeedback(txt("Tour valide", "Round counted"), `${txt("Tour", "Round")} ${timer.roundsCompleted} - ${stepLabel(first)}`, { persistNotification: true });
      timer.stepStartedAt = Date.now();
      timer.stepEndAt = first?.duration ? Date.now() + (first.duration * 1000) : null;
      renderSport("amrap-loop");
      return;
    }
    if (!next) {
      finishWorkout();
      return;
    }
    sportFeedback(step.kind === "work" ? txt("Serie terminee", "Set complete") : txt("Repos termine", "Rest complete"), `${stepLabel(next)} - ${next.duration ? fmtSec(next.duration) : txt("a valider", "to validate")}`, { toast: step.kind === "rest", persistNotification: true });
    timer.stepStartedAt = Date.now();
    timer.stepEndAt = next.duration ? Date.now() + (next.duration * 1000) : null;
    renderSport("step");
  }
  function skipRestStep() {
    const timer = CACHE.timer;
    const step = currentTimerStep();
    if (!timer || !step || (step.kind !== "rest" && step.kind !== "round_rest")) return;
    timer.index += 1;
    const next = currentTimerStep();
    beep("work");
    if (!next) {
      finishWorkout();
      return;
    }
    sportFeedback(txt("Repos saute", "Rest skipped"), `${stepLabel(next)} - ${next.duration ? fmtSec(next.duration) : txt("a valider", "to validate")}`, { persistNotification: true });
    timer.stepStartedAt = Date.now();
    timer.stepEndAt = next.duration ? Date.now() + (next.duration * 1000) : null;
    renderSport("skip-rest");
  }
  function adjustCurrentStepSeconds(delta) {
    const timer = CACHE.timer;
    const step = currentTimerStep();
    if (!timer || !step || !step.duration || timer.paused) return;
    const now = Date.now();
    const nextEnd = Math.max(now + 1000, (timer.stepEndAt || now) + (Number(delta) * 1000));
    timer.stepEndAt = nextEnd;
    step.duration = Math.max(1, Math.round((nextEnd - timer.stepStartedAt) / 1000));
    renderSport("adjust-time");
  }
  function togglePause() {
    const timer = CACHE.timer;
    if (!timer) return;
    if (!timer.paused) {
      timer.paused = true;
      timer.pauseStartedAt = Date.now();
      sportFeedback(txt("Timer en pause", "Timer paused"), txt("Seance en pause.", "Workout paused."), { persistNotification: true });
    } else {
      const delta = Date.now() - (timer.pauseStartedAt || Date.now());
      timer.paused = false;
      timer.pauseStartedAt = null;
      if (timer.stepEndAt) timer.stepEndAt += delta;
      if (timer.timeCapEndAt) timer.timeCapEndAt += delta;
      sportFeedback(txt("Timer repris", "Timer resumed"), txt("Seance reprise.", "Workout resumed."), { persistNotification: true });
    }
    renderSport("pause");
  }
  async function finishWorkout() {
    const timer = CACHE.timer;
    if (!timer) return;
    stopTicker();
    releaseWakeLock();
    const endedAt = Date.now();
    const durationSeconds = Math.max(1, Math.round((endedAt - timer.startedAt) / 1000));
    const step = currentTimerStep();
    if (step && step.kind === "work") {
      const elapsedStepSeconds = Math.max(1, Math.round((endedAt - timer.stepStartedAt) / 1000));
      const cappedStepSeconds = step.duration ? Math.min(n(step.duration, elapsedStepSeconds), elapsedStepSeconds) : elapsedStepSeconds;
      recordWorkStep(timer, step, cappedStepSeconds);
    }
    const summary = {
      startedAt: new Date(timer.startedAt).toISOString(),
      endedAt: new Date(endedAt).toISOString(),
      durationSeconds,
      bodyWeightKg: timer.bodyWeightKg,
      bodyHeightCm: timer.bodyHeightCm,
      moodAfter: "",
      perceivedEffort: null,
      notes: "",
      estimatedKcal: Math.max(1, Math.round(sessionKcalEstimate(CACHE.plan, timer.doneSets, timer.bodyWeightKg, durationSeconds))),
      doneSets: timer.doneSets.slice(),
      plan: CACHE.plan.slice(),
    };
    CACHE.timer = null;
    CACHE.pendingSummary = summary;
    beep("finish");
    sportFeedback(txt("Seance terminee", "Workout complete"), `${fmtSec(summary.durationSeconds)} - ${Math.round(n(summary.estimatedKcal, 0))} kcal`, { persistNotification: false });
    renderSport("finish");
    openFinishModal(summary);
  }

  function openFinishModal(summary) {
    closeFinishModal();
    const wrap = document.createElement("div");
    wrap.className = "tb-sport-modal-backdrop";
    wrap.id = "tb-sport-finish-modal";
    wrap.innerHTML = `
      <div class="tb-sport-modal">
        <h3>${esc(txt("Seance terminee", "Workout complete"))}</h3>
        <div class="muted">${fmtSec(summary.durationSeconds)} - ${Math.round(n(summary.estimatedKcal, 0))} kcal - ${summary.doneSets.length} ${esc(txt("series", "sets"))}</div>
        <div class="tb-sport-field" style="margin-top:14px;">
          <label>${esc(txt("Comment tu te sens ?", "How do you feel?"))}</label>
          <div class="tb-sport-choice-row" id="sport-finish-mood">
            <button class="tb-sport-choice" type="button" data-mood="${esc(txt("Tres bien", "Great"))}">${esc(txt("Tres bien", "Great"))}</button>
            <button class="tb-sport-choice" type="button" data-mood="${esc(txt("OK", "OK"))}">${esc(txt("OK", "OK"))}</button>
            <button class="tb-sport-choice" type="button" data-mood="${esc(txt("Dur", "Hard"))}">${esc(txt("Dur", "Hard"))}</button>
            <button class="tb-sport-choice" type="button" data-mood="${esc(txt("Douleur", "Pain"))}">${esc(txt("Douleur", "Pain"))}</button>
          </div>
        </div>
        <div class="tb-sport-field">
          <label>${esc(txt("Effort ressenti /10", "Perceived effort /10"))}</label>
          <input id="sport-finish-effort" type="range" min="1" max="10" value="6">
          <div class="muted"><span id="sport-finish-effort-value">6</span>/10</div>
        </div>
        <div class="tb-sport-field" style="margin-top:10px;">
          <label>${esc(txt("Notes", "Notes"))}</label>
          <textarea id="sport-finish-notes" rows="3" placeholder="${esc(txt("Ex : bonne forme, epaule sensible, a refaire...", "E.g. felt good, shoulder sensitive, repeat this..."))}"></textarea>
        </div>
        <div class="tb-sport-actions" style="justify-content:flex-end;margin-top:14px;">
          <button class="btn" type="button" id="sport-finish-cancel">${esc(txt("Ignorer", "Skip"))}</button>
          <button class="btn primary" type="button" id="sport-finish-save">${esc(txt("Sauvegarder", "Save"))}</button>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    let mood = txt("OK", "OK");
    wrap.querySelectorAll("[data-mood]").forEach(btn => {
      btn.onclick = () => {
        mood = btn.getAttribute("data-mood") || mood;
        wrap.querySelectorAll("[data-mood]").forEach(b => b.classList.toggle("active", b === btn));
      };
    });
    const defaultMood = wrap.querySelector("[data-mood]");
    if (defaultMood) defaultMood.click();
    const effort = wrap.querySelector("#sport-finish-effort");
    const effortValue = wrap.querySelector("#sport-finish-effort-value");
    if (effort) effort.oninput = () => { if (effortValue) effortValue.textContent = String(effort.value || "6"); };
    const cancel = wrap.querySelector("#sport-finish-cancel");
    if (cancel) cancel.onclick = async () => {
      const s = Object.assign({}, CACHE.pendingSummary || summary, { moodAfter: "", perceivedEffort: null, notes: "" });
      CACHE.pendingSummary = null;
      closeFinishModal();
      await saveWorkout(s);
      renderSport("finish-skip");
    };
    const save = wrap.querySelector("#sport-finish-save");
    if (save) save.onclick = async () => {
      const s = Object.assign({}, CACHE.pendingSummary || summary, {
        moodAfter: mood,
        perceivedEffort: Math.max(1, Math.min(10, Math.round(n(effort?.value, 6)))),
        notes: String(wrap.querySelector("#sport-finish-notes")?.value || "").trim(),
      });
      CACHE.pendingSummary = null;
      closeFinishModal();
      await saveWorkout(s);
      renderSport("finish-save");
    };
  }
  function closeFinishModal() {
    const old = document.getElementById("tb-sport-finish-modal");
    if (old) old.remove();
  }

  async function saveWorkout(summary) {
    const c = client();
    const userId = uid();
    const localRow = rememberLocalWorkout(summary, false);
    CACHE.status = txt("Seance ajoutee a l'historique local. Synchro en cours...", "Workout added to local history. Syncing...");
    if (!c || !userId) {
      CACHE.status = txt("Seance sauvegardee localement. Connecte-toi pour synchroniser.", "Workout saved locally. Sign in to sync.");
      try {
        if (typeof window.tbOfflineQueueEnqueue === "function") {
          window.tbOfflineQueueEnqueue("sport.sync_local", {}, { label: "sport" });
        }
      } catch (_) {}
      return;
    }
    try {
      const primaryActivity = summary.plan[0]?.activityKey || "strength";
      const sess = await c
        .from(table("sport_sessions"))
        .insert([{
          user_id: userId,
          travel_id: activeTravelId(),
          activity_type: primaryActivity,
          started_at: summary.startedAt,
          ended_at: summary.endedAt,
          duration_seconds: summary.durationSeconds,
          mood_after: summary.moodAfter || null,
          fatigue: summary.perceivedEffort || null,
          body_weight_kg: summary.bodyWeightKg,
          notes: summary.notes || null,
          estimated_kcal: summary.estimatedKcal,
        }])
        .select("id")
        .single();
      if (sess.error) throw sess.error;
      const sessionId = sess.data?.id;
      markLocalSynced(localRow.localId, sessionId);
      const itemRows = summary.plan.map((item, idx) => ({
        user_id: userId,
        session_id: sessionId,
        activity_key: item.activityKey,
        exercise_name: item.exerciseName,
        equipment: item.equipment,
        mode: item.mode,
        target_reps: item.targetReps || null,
        target_seconds: item.targetSeconds || null,
        distance_m: item.distanceM || null,
        planned_sets: item.sets || 1,
        rest_seconds: item.restSeconds || 0,
        sort_order: idx,
        met_value: item.metValue || null,
        notes: item.notes || null,
      }));
      const items = await c
        .from(table("sport_session_items"))
        .insert(itemRows)
        .select("id,sort_order");
      if (items.error) throw items.error;
      const itemByIndex = new Map((items.data || []).map(row => [Number(row.sort_order), row.id]));
      const setRows = summary.doneSets.map(set => ({
        user_id: userId,
        item_id: itemByIndex.get(Number(set.itemIndex)),
        set_index: set.setIndex,
        reps: set.reps,
        duration_seconds: set.durationSeconds,
        weight_kg: set.weightKg || null,
        distance_m: set.distanceM || null,
        completed_at: set.completedAt,
      })).filter(row => row.item_id);
      if (setRows.length) {
        const savedSets = await c.from(table("sport_sets")).insert(setRows);
        if (savedSets.error) throw savedSets.error;
      }
      CACHE.loaded = false;
      CACHE.status = txt("Seance sauvegardee et synchronisee.", "Workout saved and synced.");
      await loadHistory();
    } catch (e) {
      CACHE.error = e?.message || String(e);
      CACHE.status = txt("Seance sauvegardee localement. Synchro Supabase a verifier.", "Workout saved locally. Supabase sync needs checking.");
      try {
        if (typeof window.tbOfflineQueueEnqueue === "function") {
          window.tbOfflineQueueEnqueue("sport.sync_local", {}, { label: "sport" });
        }
      } catch (_) {}
      console.warn("[sport] save failed", CACHE.error);
    }
  }

  async function syncLocalWorkoutRow(row) {
    const c = client();
    const userId = uid();
    if (!c || !userId || !row || row.remoteId) return false;
    const plan = Array.isArray(row.plan) ? row.plan : [];
    if (!plan.length) return false;
    const doneSets = Array.isArray(row.doneSets) ? row.doneSets : [];
    const primaryActivity = plan[0]?.activityKey || row.activity_type || "strength";
    const sess = await c
      .from(table("sport_sessions"))
      .insert([{
        user_id: userId,
        travel_id: activeTravelId(),
        activity_type: primaryActivity,
        started_at: row.startedAt || row.started_at || new Date().toISOString(),
        ended_at: row.endedAt || row.ended_at || row.startedAt || row.started_at || new Date().toISOString(),
        duration_seconds: row.durationSeconds || row.duration_seconds || 0,
        mood_after: row.moodAfter || row.mood_after || null,
        fatigue: row.perceivedEffort || row.fatigue || null,
        body_weight_kg: row.bodyWeightKg || row.body_weight_kg || null,
        notes: row.notes || null,
        estimated_kcal: row.estimatedKcal || row.estimated_kcal || 0,
      }])
      .select("id")
      .single();
    if (sess.error) throw sess.error;
    const sessionId = sess.data?.id;
    const itemRows = plan.map((item, idx) => ({
      user_id: userId,
      session_id: sessionId,
      activity_key: item.activityKey || primaryActivity,
      exercise_name: item.exerciseName || item.label || labelActivity(item.activityKey || primaryActivity),
      equipment: item.equipment || "mixed",
      mode: item.mode || "time",
      target_reps: item.targetReps || null,
      target_seconds: item.targetSeconds || null,
      distance_m: item.distanceM || null,
      planned_sets: item.sets || 1,
      rest_seconds: item.restSeconds || 0,
      sort_order: idx,
      met_value: item.metValue || null,
      notes: item.notes || null,
    }));
    const items = await c.from(table("sport_session_items")).insert(itemRows).select("id,sort_order");
    if (items.error) throw items.error;
    const itemByIndex = new Map((items.data || []).map(item => [Number(item.sort_order), item.id]));
    const setRows = doneSets.map(set => ({
      user_id: userId,
      item_id: itemByIndex.get(Number(set.itemIndex)),
      set_index: set.setIndex,
      reps: set.reps,
      duration_seconds: set.durationSeconds,
      weight_kg: set.weightKg || null,
      distance_m: set.distanceM || null,
      completed_at: set.completedAt || row.endedAt || row.ended_at || new Date().toISOString(),
    })).filter(set => set.item_id);
    if (setRows.length) {
      const savedSets = await c.from(table("sport_sets")).insert(setRows);
      if (savedSets.error) throw savedSets.error;
    }
    markLocalSynced(row.localId || row.id, sessionId);
    return true;
  }

  async function syncLocalWorkouts() {
    const rows = (CACHE.localSessions || []).filter(row => !row.remoteId);
    if (!rows.length) return;
    CACHE.status = txt("Synchronisation des seances locales...", "Syncing local workouts...");
    renderSport("sync-local-start");
    let ok = 0;
    let syncError = null;
    try {
      for (const row of rows) {
        if (await syncLocalWorkoutRow(row)) ok += 1;
      }
      if (ok < rows.length) {
        throw new Error(txt("Certaines seances locales restent en attente.", "Some local workouts are still pending."));
      }
      CACHE.loaded = false;
      CACHE.status = txt(`${ok} seance(s) synchronisee(s).`, `${ok} workout(s) synced.`);
      await loadHistory();
    } catch (e) {
      syncError = e;
      CACHE.error = e?.message || String(e);
      CACHE.status = txt(`${ok} seance(s) synchronisee(s), puis erreur Supabase.`, `${ok} workout(s) synced, then Supabase error.`);
      console.warn("[sport] local sync failed", CACHE.error);
    }
    renderSport("sync-local-done");
    if (syncError) throw syncError;
  }
  window.tbSportSyncLocalWorkouts = syncLocalWorkouts;

  async function deleteRemoteSportSession(c, id) {
    const key = String(id || "");
    if (!key || key.startsWith("local_")) return true;
    if (!c) throw new Error("Supabase indisponible");
    let itemIds = (CACHE.items || [])
      .filter(item => String(item.session_id || "") === key)
      .map(item => item.id)
      .filter(Boolean);
    if (!itemIds.length) {
      const found = await c.from(table("sport_session_items")).select("id").eq("session_id", key);
      if (found.error) throw found.error;
      itemIds = (found.data || []).map(item => item.id).filter(Boolean);
    }
    if (itemIds.length) {
      const sets = await c.from(table("sport_sets")).delete().in("item_id", itemIds);
      if (sets.error) throw sets.error;
    }
    const items = await c.from(table("sport_session_items")).delete().eq("session_id", key);
    if (items.error) throw items.error;
    const sess = await c.from(table("sport_sessions")).delete().eq("id", key);
    if (sess.error) throw sess.error;
    return true;
  }

  async function syncPendingSportDeletes(c, userId) {
    const ids = loadPendingDeletes();
    if (!c || !userId || !ids.length) return 0;
    let done = 0;
    for (const id of ids) {
      try {
        await deleteRemoteSportSession(c, id);
        clearPendingDelete(id);
        done += 1;
      } catch (e) {
        if (!isOfflineSkipError(e)) console.warn("[sport] pending delete failed", e?.message || e);
      }
    }
    return done;
  }

  async function deleteSportSession(sessionId) {
    const id = String(sessionId || "");
    if (!id) return;
    if (!confirm(txt("Supprimer cette seance ?", "Delete this workout?"))) return;
    const c = client();
    removeLocalWorkout(id);
    removeSessionFromRuntime(id);
    if (!id.startsWith("local_")) rememberPendingDelete(id);
    CACHE.status = txt("Suppression de la seance...", "Deleting workout...");
    renderSport("delete-session-optimistic");
    try {
      await deleteRemoteSportSession(c, id);
      clearPendingDelete(id);
      CACHE.loaded = false;
      CACHE.status = txt("Seance supprimee.", "Workout deleted.");
      await loadHistory();
    } catch (e) {
      CACHE.error = e?.message || String(e);
      CACHE.status = txt("Suppression locale effectuee. Synchro Supabase a verifier.", "Deleted locally. Supabase sync needs checking.");
      if (!isOfflineSkipError(e)) console.warn("[sport] delete failed", CACHE.error);
    }
    renderSport("delete-session");
  }

  async function editSportSessionDate(sessionId, currentDate) {
    const id = String(sessionId || "");
    if (!id) return;
    const nextDate = prompt(txt("Nouvelle date de seance (AAAA-MM-JJ)", "New workout date (YYYY-MM-DD)"), String(currentDate || todayISO()).slice(0, 10));
    const d = String(nextDate || "").trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return;
    const c = client();
    updateLocalWorkoutDate(id, d);
    const session = (CACHE.sessions || []).find(s => String(s.id || "") === id);
    const oldStart = String(session?.started_at || new Date().toISOString());
    const oldEnd = String(session?.ended_at || oldStart);
    const startedAt = `${d}T${oldStart.slice(11, 19) || "00:00:00"}`;
    const endedAt = `${d}T${oldEnd.slice(11, 19) || oldStart.slice(11, 19) || "00:00:00"}`;
    CACHE.status = txt("Date de seance mise a jour...", "Updating workout date...");
    try {
      if (c && !id.startsWith("local_")) {
        const res = await c
          .from(table("sport_sessions"))
          .update({ started_at: startedAt, ended_at: endedAt })
          .eq("id", id);
        if (res.error) throw res.error;
      }
      CACHE.loaded = false;
      CACHE.status = txt("Date de seance mise a jour.", "Workout date updated.");
      await loadHistory();
    } catch (e) {
      CACHE.error = e?.message || String(e);
      CACHE.status = txt("Date modifiee localement. Synchro Supabase a verifier.", "Date changed locally. Supabase sync needs checking.");
      console.warn("[sport] date update failed", CACHE.error);
    }
    renderSport("edit-session-date");
  }

  async function requestWakeLock() {
    try {
      if (!("wakeLock" in navigator) || !navigator.wakeLock?.request) return;
      if (CACHE.wakeLock) return;
      CACHE.wakeLock = await navigator.wakeLock.request("screen");
      CACHE.wakeLock.addEventListener?.("release", () => { CACHE.wakeLock = null; });
    } catch (_) {
      CACHE.wakeLock = null;
    }
  }
  function releaseWakeLock() {
    try { CACHE.wakeLock?.release?.(); } catch (_) {}
    CACHE.wakeLock = null;
  }

  window.addEventListener("tb:auth_scope_changed", () => {
    reloadScopedLocalState(true);
    CACHE.loaded = false;
    CACHE.sessions = [];
    CACHE.items = [];
    CACHE.sets = [];
    CACHE.error = "";
    CACHE.status = "";
  });

  window.renderSport = renderSport;
  window.tbReloadSportHistory = async function tbReloadSportHistory() {
    CACHE.loaded = false;
    await loadHistory();
    publishSportHistory("reload");
    return CACHE.sessions.slice();
  };
  try { document.addEventListener("tb:refresh:data_loaded", () => { try { window.tbReloadSportHistory(); } catch (_) {} }); } catch (_) {}
  setTimeout(() => { try { if (uid()) loadHistory().then(() => publishSportHistory("auto")).catch(() => {}); } catch (_) {} }, 450);
  window.tbSportCatalog = CATALOG.slice();
  window.tbReloadSportLibrary = async function tbReloadSportLibrary() {
    CACHE.libraryLoaded = false;
    CACHE.librarySource = "fallback";
    return ensureSportLibraryLoaded("manual");
  };
})();
