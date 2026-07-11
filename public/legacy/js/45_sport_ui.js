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
  const LOAD_HISTORY_KEY = () => scopedKey("travelbudget_sport_load_history_v1");
  const SESSION_FAVORITES_KEY = () => scopedKey("travelbudget_sport_session_favorites_v1");
  const SPORT_PROGRAM_KEY = () => scopedKey("travelbudget_sport_program_v1");
  const TIMER_PREF_KEY = () => scopedKey("travelbudget_sport_timer_prefs_v1");
  const TIMER_STATE_KEY = () => scopedKey("travelbudget_sport_timer_state_v1");
  const BODY_MEASUREMENTS_KEY = () => scopedKey("travelbudget_health_body_measurements_v1");
  const HISTORY_KEY = () => scopedKey(baseHistoryKey());
  const ANON_HISTORY_KEY = () => `${baseHistoryKey()}::anon`;
  const EXERCISE_FAVORITES_KEY = () => scopedKey("travelbudget_sport_exercise_favorites_v1");
  const EXERCISE_RECENT_KEY = () => scopedKey("travelbudget_sport_exercise_recent_v1");
  const RECOVERY_MET = 1.3;

  const sportCatalog = window.Core?.sportCatalog;
  if (!sportCatalog) throw new Error("Sport catalog indisponible");
  const CATALOG = sportCatalog.CATALOG.map((row) => ({ ...row }));
  const EQUIPMENT = sportCatalog.EQUIPMENT.map((row) => row.slice());
  const GOALS = sportCatalog.GOALS.map((row) => row.slice());
  const LEVELS = sportCatalog.LEVELS.map((row) => row.slice());
  const SPORT_FAMILIES = sportCatalog.SPORT_FAMILIES.map((row) => row.slice());
  const PROGRAM_LOADS = sportCatalog.PROGRAM_LOADS.map((row) => row.slice());
  const EXERCISE_LIBRARY = sportCatalog.EXERCISE_LIBRARY.map((row) => ({ ...row }));
  const FALLBACK_EXERCISE_LIBRARY = EXERCISE_LIBRARY.map(row => Object.assign({}, row));
  const sportProgramRules = window.Core?.sportProgramRules;
  if (!sportProgramRules) throw new Error("Sport program rules indisponibles");
  const {
    currentProgramWeek,
    nextPlannedSportRow,
    plannedSportWeekRows,
    programDaysFromSqlSessions,
    sessionCode,
  } = sportProgramRules;

  const createSportStore = window.Data?.createSportStore;
  if (typeof createSportStore !== "function") throw new Error("Sport store indisponible");
  const sportStore = createSportStore({}, { entityStore: window.Data?.appStore, namespace: "sport" });
  const CACHE = sportStore.state;
  let sessionEditorModal = null;

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
  function sportRepository() {
    const repository = window.Data?.sportRepository;
    if (!repository) throw new Error("Sport repository indisponible");
    return repository;
  }
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
    sportStore.hydrateScope({
      localScope: scope,
      localSessions: loadLocalHistory(),
      pendingDeletes: loadPendingDeletes(),
      plan: loadPlan(),
    });
    CACHE.globalRestSeconds = loadGlobalRest();
    CACHE.circuit = loadCircuit();
    CACHE.program = loadSportProgram();
    CACHE.sqlSessionFavorites = [];
    CACHE.programLoaded = false;
    CACHE.programSource = "fallback";
    CACHE.timerBeepVolume = loadTimerPrefs().beepVolume;
    CACHE.timer = loadTimerState();
    if (CACHE.timer) startTicker();
    CACHE.bodyMeasurements = loadBodyMeasurementsLocal();
    CACHE.bodyMeasurementsLoaded = false;
  }
  reloadScopedLocalState(true);
  function activeTravelId() { return window.state?.activeTravelId || null; }
  function table(name) { return window.TB_CONST?.TABLES?.[name] || name; }
  function n(v, fallback) {
    if (v === "" || v == null) return fallback || 0;
    const x = Number(v);
    return Number.isFinite(x) ? x : (fallback || 0);
  }
  function persistSportCache(key, value) {
    try {
      if (typeof window.tbSafeLocalStorageSet === "function") return window.tbSafeLocalStorageSet(key, value);
      localStorage.setItem(key, value);
      return { ok: true };
    } catch (error) {
      return { ok: false, error };
    }
  }
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
        .select("key,goal,equipment,activity_key,name_fr,name_en,mode,default_reps,default_seconds,default_sets,default_rest_seconds,distance_m,met_value,tags,sort_order,default_weight_kg,load_label,rep_min,rep_max")
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
    const value = String(Math.max(1, n(v, 70)));
    try { localStorage.setItem(WEIGHT_KEY(), value); } catch (_) {}
    try { window.tbWriteScopedLocalStorage?.(window.TB_CONST?.LS_KEYS?.sport_body_weight || "travelbudget_sport_body_weight_v1", value); } catch (_) {}
    try { if (!window.state.user) window.state.user = {}; window.state.user.bodyWeightKg = Number(value); } catch (_) {}
  }
  function bodyHeight() {
    try { return n(localStorage.getItem(HEIGHT_KEY()), 175); } catch (_) { return 175; }
  }
  function saveBodyHeight(v) {
    const value = String(Math.max(60, n(v, 175)));
    try { localStorage.setItem(HEIGHT_KEY(), value); } catch (_) {}
    try { window.tbWriteScopedLocalStorage?.(window.TB_CONST?.LS_KEYS?.sport_body_height || "travelbudget_sport_body_height_v1", value); } catch (_) {}
    try { if (!window.state.user) window.state.user = {}; window.state.user.bodyHeightCm = Number(value); } catch (_) {}
  }
  function cleanOptionalNumber(value, min, max) {
    if (value === "" || value == null) return null;
    const out = Number(String(value).replace(",", "."));
    if (!Number.isFinite(out)) return null;
    return Math.max(min, Math.min(max, out));
  }
  function loadBodyMeasurementsLocal() {
    try {
      const rows = JSON.parse(localStorage.getItem(BODY_MEASUREMENTS_KEY()) || "[]");
      return Array.isArray(rows) ? rows.slice(0, 80) : [];
    } catch (_) { return []; }
  }
  function saveBodyMeasurementsLocal(rows) {
    const clean = (rows || [])
      .filter(row => row && row.measured_on)
      .sort((a, b) => String(b.measured_on || "").localeCompare(String(a.measured_on || "")))
      .slice(0, 80);
    try { localStorage.setItem(BODY_MEASUREMENTS_KEY(), JSON.stringify(clean)); } catch (_) {}
    CACHE.bodyMeasurements = clean;
    return clean;
  }
  function latestBodyMeasurement() {
    return (CACHE.bodyMeasurements || [])
      .slice()
      .sort((a, b) => String(b.measured_on || "").localeCompare(String(a.measured_on || "")))[0] || null;
  }
  async function ensureBodyMeasurementsLoaded(reason) {
    if (CACHE.bodyMeasurementsLoading || CACHE.bodyMeasurementsLoaded) return false;
    const c = client();
    if (!c || !uid()) {
      CACHE.bodyMeasurementsLoaded = true;
      return false;
    }
    const offline = (typeof window.tbShouldUseOfflineMode === "function")
      ? await window.tbShouldUseOfflineMode(`health:body_measurements:${reason || "render"}`)
      : ((typeof window.tbIsOfflineMode === "function" && window.tbIsOfflineMode()) || (navigator && navigator.onLine === false));
    if (offline) {
      CACHE.bodyMeasurementsLoaded = true;
      return false;
    }
    CACHE.bodyMeasurementsLoading = true;
    try {
      const res = await c
        .from(table("health_body_measurements"))
        .select("id,user_id,measured_on,source,weight_kg,body_fat_pct,muscle_mass_kg,body_water_pct,bone_mass_kg,visceral_fat_rating,bmr_kcal,metabolic_age,notes,created_at,updated_at")
        .eq("user_id", uid())
        .order("measured_on", { ascending: false })
        .limit(40);
      if (res.error) throw res.error;
      saveBodyMeasurementsLocal(res.data || []);
      return true;
    } catch (e) {
      if (!isOfflineSkipError(e)) console.warn("[sport] body measurements load failed", e?.message || e);
    } finally {
      CACHE.bodyMeasurementsLoading = false;
      CACHE.bodyMeasurementsLoaded = true;
    }
    return false;
  }
  function openBodyMeasurementEditor(row) {
    const latest = row || latestBodyMeasurement() || {};
    CACHE.bodyMeasurementEditor = {
      measured_on: String(row?.measured_on || todayISO()).slice(0, 10),
      source: latest.source || "impedance_scale",
      weight_kg: latest.weight_kg ?? bodyWeight(),
      body_fat_pct: latest.body_fat_pct ?? "",
      muscle_mass_kg: latest.muscle_mass_kg ?? "",
      body_water_pct: latest.body_water_pct ?? "",
      bone_mass_kg: latest.bone_mass_kg ?? "",
      visceral_fat_rating: latest.visceral_fat_rating ?? "",
      bmr_kcal: latest.bmr_kcal ?? "",
      metabolic_age: latest.metabolic_age ?? "",
      notes: latest.notes || "",
    };
  }
  function closeBodyMeasurementEditor() {
    CACHE.bodyMeasurementEditor = null;
  }
  function readBodyMeasurementFromDom(root) {
    const day = String(root.querySelector("#sport-body-date")?.value || todayISO()).slice(0, 10);
    return {
      user_id: uid(),
      measured_on: /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : todayISO(),
      source: "impedance_scale",
      weight_kg: cleanOptionalNumber(root.querySelector("#sport-body-weight")?.value, 20, 350),
      body_fat_pct: cleanOptionalNumber(root.querySelector("#sport-body-fat")?.value, 2, 70),
      muscle_mass_kg: cleanOptionalNumber(root.querySelector("#sport-body-muscle")?.value, 5, 200),
      body_water_pct: cleanOptionalNumber(root.querySelector("#sport-body-water")?.value, 20, 80),
      bone_mass_kg: cleanOptionalNumber(root.querySelector("#sport-body-bone")?.value, 0.5, 20),
      visceral_fat_rating: cleanOptionalNumber(root.querySelector("#sport-body-visceral")?.value, 1, 60),
      bmr_kcal: Math.round(cleanOptionalNumber(root.querySelector("#sport-body-bmr")?.value, 600, 6000) || 0) || null,
      metabolic_age: Math.round(cleanOptionalNumber(root.querySelector("#sport-body-age")?.value, 10, 120) || 0) || null,
      notes: String(root.querySelector("#sport-body-notes")?.value || "").trim().slice(0, 500) || null,
    };
  }
  function mergeBodyMeasurementLocal(payload, id) {
    const nextRow = Object.assign({}, payload, { id: id || payload.id || `local_${payload.measured_on}_${payload.source}` });
    const rows = (CACHE.bodyMeasurements || loadBodyMeasurementsLocal())
      .filter(row => !(String(row.measured_on) === String(nextRow.measured_on) && String(row.source || "impedance_scale") === String(nextRow.source || "impedance_scale")));
    rows.push(nextRow);
    saveBodyMeasurementsLocal(rows);
    if (nextRow.weight_kg) saveBodyWeight(nextRow.weight_kg);
  }
  async function saveBodyMeasurementFromDom(root) {
    const payload = readBodyMeasurementFromDom(root);
    if (!payload.weight_kg && !payload.body_fat_pct && !payload.muscle_mass_kg && !payload.body_water_pct) {
      sportFeedback(txt("Ajoute au moins une mesure", "Add at least one metric"), txt("Poids, masse grasse, muscle ou eau.", "Weight, body fat, muscle or water."), { toast: true });
      return false;
    }
    const c = client();
    if (!c || !uid()) {
      mergeBodyMeasurementLocal(Object.assign({}, payload, { user_id: uid() || "local" }));
      closeBodyMeasurementEditor();
      sportFeedback(txt("Mesure enregistree localement", "Measurement saved locally"), payload.measured_on, { toast: true });
      return true;
    }
    try {
      const res = await c
        .from(table("health_body_measurements"))
        .upsert(Object.assign({}, payload, { user_id: uid(), updated_at: new Date().toISOString() }), { onConflict: "user_id,measured_on,source" })
        .select("id,user_id,measured_on,source,weight_kg,body_fat_pct,muscle_mass_kg,body_water_pct,bone_mass_kg,visceral_fat_rating,bmr_kcal,metabolic_age,notes,created_at,updated_at")
        .maybeSingle();
      if (res.error) throw res.error;
      mergeBodyMeasurementLocal(res.data || payload, res.data?.id);
      closeBodyMeasurementEditor();
      sportFeedback(txt("Mesure impédancemètre enregistrée", "Body measurement saved"), payload.measured_on, { toast: true });
      return true;
    } catch (e) {
      console.warn("[sport] body measurement save failed", e?.message || e);
      mergeBodyMeasurementLocal(Object.assign({}, payload, { user_id: uid() || "local" }));
      closeBodyMeasurementEditor();
      sportFeedback(txt("Mesure gardee hors ligne", "Measurement kept offline"), txt("Elle reste disponible localement.", "It remains available locally."), { toast: true });
      return true;
    }
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
  function loadTimerPrefs() {
    try {
      const raw = JSON.parse(localStorage.getItem(TIMER_PREF_KEY()) || "{}");
      return {
        beepVolume: Math.max(0, Math.min(100, Math.round(n(raw.beepVolume, 70)))),
      };
    } catch (_) {
      return { beepVolume: 70 };
    }
  }
  function saveTimerPrefs(next) {
    const prefs = Object.assign({ beepVolume: 70 }, loadTimerPrefs(), next || {});
    prefs.beepVolume = Math.max(0, Math.min(100, Math.round(n(prefs.beepVolume, 70))));
    CACHE.timerBeepVolume = prefs.beepVolume;
    try { localStorage.setItem(TIMER_PREF_KEY(), JSON.stringify(prefs)); } catch (_) {}
    return prefs;
  }
  function normalizeTimerState(raw) {
    if (!raw || typeof raw !== "object" || !Array.isArray(raw.sequence) || !raw.sequence.length) return null;
    const timer = Object.assign({}, raw);
    timer.sequence = raw.sequence.slice(0, 500);
    timer.doneSets = Array.isArray(raw.doneSets) ? raw.doneSets.slice(0, 500) : [];
    timer.index = Math.max(0, Math.round(n(raw.index, 0)));
    timer.startedAt = Math.max(0, n(raw.startedAt, Date.now()));
    timer.stepStartedAt = Math.max(0, n(raw.stepStartedAt, timer.startedAt));
    timer.stepEndAt = raw.stepEndAt == null ? null : Math.max(0, n(raw.stepEndAt, 0));
    timer.timeCapEndAt = raw.timeCapEndAt == null ? null : Math.max(0, n(raw.timeCapEndAt, 0));
    timer.pauseStartedAt = raw.pauseStartedAt == null ? null : Math.max(0, n(raw.pauseStartedAt, 0));
    timer.paused = raw.paused === true;
    return timer;
  }
  function loadTimerState() {
    try { return normalizeTimerState(JSON.parse(localStorage.getItem(TIMER_STATE_KEY()) || "null")); }
    catch (_) { return null; }
  }
  function saveTimerState() {
    const timer = normalizeTimerState(CACHE.timer);
    if (!timer) return clearTimerState();
    persistSportCache(TIMER_STATE_KEY(), JSON.stringify({
      savedAt: new Date().toISOString(),
      sequence: timer.sequence,
      index: timer.index,
      startedAt: timer.startedAt,
      stepStartedAt: timer.stepStartedAt,
      stepEndAt: timer.stepEndAt,
      paused: timer.paused,
      pauseStartedAt: timer.pauseStartedAt,
      doneSets: timer.doneSets,
      roundsCompleted: timer.roundsCompleted || 0,
      timeCapEndAt: timer.timeCapEndAt,
      bodyWeightKg: timer.bodyWeightKg,
      bodyHeightCm: timer.bodyHeightCm,
      stepLoadKg: timer.stepLoadKg,
      stepReps: timer.stepReps,
    }));
  }
  function clearTimerState() {
    try { localStorage.removeItem(TIMER_STATE_KEY()); } catch (_) {}
    if (!CACHE.timer) syncTimerFocusLock();
  }
  function syncTimerFocusLock() {
    const enabled = !!(CACHE.timer && CACHE.timerFocus);
    try { document.documentElement.classList.toggle("tb-sport-focus-lock", enabled); } catch (_) {}
    try { document.body?.classList.toggle("tb-sport-focus-lock", enabled); } catch (_) {}
    try {
      if (enabled) document.body?.setAttribute("data-tb-sport-focus", "1");
      else document.body?.removeAttribute("data-tb-sport-focus");
    } catch (_) {}
  }
  function bmiValue(kg, cm) {
    const h = n(cm, 0) / 100;
    if (!h) return 0;
    return n(kg, 0) / (h * h);
  }
  function effectiveLoadKg(item, bodyKg) {
    if (!supportsExternalLoad(item)) return 0;
    return Math.max(0, n(item?.weightKg, 0));
  }
  function supportsExternalLoad(item) {
    const equipment = String(item?.equipment || "");
    return ["bodyweight", "dumbbell", "barbell", "plate", "kettlebell", "machine"].includes(equipment);
  }
  function exerciseLoadKey(item) {
    return String(item?.exerciseName || item?.key || item?.activityKey || "exercise")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 80);
  }
  function loadHistoryMap() {
    try {
      const raw = JSON.parse(localStorage.getItem(LOAD_HISTORY_KEY()) || "{}");
      return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    } catch (_) { return {}; }
  }
  function lastLoadForExercise(item, fallback) {
    if (!supportsExternalLoad(item)) return 0;
    const value = Number(loadHistoryMap()[exerciseLoadKey(item)]);
    return Number.isFinite(value) && value >= 0 ? value : Math.max(0, n(fallback, 0));
  }
  function rememberLoadForExercise(item, loadKg) {
    if (!supportsExternalLoad(item)) return;
    try {
      const map = loadHistoryMap();
      map[exerciseLoadKey(item)] = Math.max(0, n(loadKg, 0));
      localStorage.setItem(LOAD_HISTORY_KEY(), JSON.stringify(map));
    } catch (_) {}
  }
  function progressionRepRange(item) {
    if (!item || item.mode !== "reps") return null;
    const min = Math.max(1, Math.round(n(item.repMin || item.repsMin || item.targetRepsMin, 8)));
    const max = Math.max(min, Math.round(n(item.repMax || item.repsMax || item.targetRepsMax, 12)));
    return { min, max };
  }
  function progressionIncrementKg(item) {
    const rule = window.Core?.sportProgramRules?.progressionIncrementKg;
    return typeof rule === "function" ? rule(item) : 2;
  }
  function applyDoubleProgression(plan, doneSets) {
    const progressions = [];
    (plan || []).forEach((item, itemIndex) => {
      const range = progressionRepRange(item);
      if (!range || !supportsExternalLoad(item)) return;
      const sets = (doneSets || [])
        .filter(set => Math.round(n(set.itemIndex, 0)) === itemIndex)
        .slice()
        .sort((a, b) => n(a.setIndex, 0) - n(b.setIndex, 0));
      const plannedSets = Math.max(1, Math.round(n(item.sets, 1)));
      if (sets.length < plannedSets) return;
      const relevant = sets.slice(0, plannedSets);
      const currentLoad = Math.max(...relevant.map(set => n(set.weightKg, 0)), n(item.weightKg, 0), 0);
      if (currentLoad <= 0) return;
      const allAtTop = relevant.every(set => Math.round(n(set.reps, 0)) >= range.max);
      if (!allAtTop) return;
      const increment = progressionIncrementKg(item);
      const nextLoad = Math.round((currentLoad + increment) * 10) / 10;
      rememberLoadForExercise(item, nextLoad);
      progressions.push({
        itemIndex,
        exerciseName: item.exerciseName || labelActivity(item.activityKey),
        fromKg: currentLoad,
        toKg: nextLoad,
        incrementKg: increment,
        repMin: range.min,
        repMax: range.max,
      });
    });
    return progressions;
  }
  function setWorkSeconds(item, actualSeconds) {
    const planned = item?.mode === "time"
      ? Math.max(1, Math.round(n(item?.targetSeconds, 0)))
      : Math.max(15, Math.round(Math.max(1, Math.round(n(item?.targetReps, 10))) * 2.5));
    if (Number.isFinite(Number(actualSeconds)) && Number(actualSeconds) > 0) {
      const actual = Math.max(1, Math.round(Number(actualSeconds)));
      const minReliable = item?.mode === "time" ? Math.min(15, planned * 0.25) : Math.min(12, planned * 0.45);
      return actual < minReliable ? planned : actual;
    }
    if (item?.mode === "time") return planned;
    const reps = Math.max(1, Math.round(n(item?.targetReps, 10)));
    return Math.max(planned, Math.round(reps * 2.5));
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
      ["bodyweight", "band", "dumbbell", "barbell", "plate", "kettlebell", "machine"].includes(equipment);
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
    const rows = sportStore.setPlan(CACHE.plan || []);
    persistSportCache(PLAN_KEY(), JSON.stringify(rows));
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
    const clean = sportStore.setLocalSessions(rows);
    persistSportCache(HISTORY_KEY(), JSON.stringify(clean));
  }
  function saveAnonHistory(rows) {
    persistSportCache(ANON_HISTORY_KEY(), JSON.stringify((rows || []).slice(0, 50)));
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
    if (CACHE.localScope === sportStorageScope()) return Array.isArray(CACHE.pendingDeletes) ? CACHE.pendingDeletes.slice() : [];
    try {
      const rows = JSON.parse(localStorage.getItem(DELETE_QUEUE_KEY()) || "[]");
      return Array.isArray(rows) ? rows.map(String).filter(Boolean) : [];
    } catch (_) { return []; }
  }
  function savePendingDeletes(rows) {
    const clean = sportStore.setPendingDeletes(rows);
    try {
      if (clean.length) persistSportCache(DELETE_QUEUE_KEY(), JSON.stringify(clean));
      else localStorage.removeItem(DELETE_QUEUE_KEY());
    } catch (_) {}
    return clean;
  }
  function rememberPendingDelete(id) {
    const key = String(id || "");
    if (!key || key.startsWith("local_")) return;
    savePendingDeletes(sportStore.rememberPendingDelete(key));
  }
  function clearPendingDelete(id) {
    const key = String(id || "");
    if (!key) return;
    savePendingDeletes(sportStore.clearPendingDelete(key));
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
    const fingerprint = workoutFingerprint(summary);
    const existing = fingerprint
      ? (CACHE.localSessions || []).find(s => String(s.fingerprint || workoutFingerprint(s)) === fingerprint)
      : null;
    const id = summary.localId || existing?.localId || ("local_" + Date.now() + "_" + Math.random().toString(16).slice(2));
    const row = Object.assign({}, summary, {
      localId: id,
      fingerprint,
      localOnly: !synced,
      savedLocallyAt: new Date().toISOString(),
    });
    sportStore.rememberLocalWorkout(row);
    saveLocalHistory(CACHE.localSessions);
    return row;
  }
  function markLocalSynced(localId, remoteId) {
    if (!localId) return;
    sportStore.markLocalSynced(localId, remoteId);
    saveLocalHistory(CACHE.localSessions);
  }
  function isLocalWorkoutUnsynced(row) {
    return !!row && !String(row.remoteId || "").trim();
  }
  function primaryActivityForWorkout(row) {
    const plan = Array.isArray(row?.plan) ? row.plan : [];
    return plan[0]?.activityKey || row?.activity_type || "strength";
  }
  function workoutFingerprint(row) {
    const started = String(row?.startedAt || row?.started_at || "").slice(0, 19);
    const ended = String(row?.endedAt || row?.ended_at || "").slice(0, 19);
    const duration = Math.max(0, Math.round(n(row?.durationSeconds || row?.duration_seconds, 0)));
    const kcal = Math.max(0, Math.round(n(row?.estimatedKcal || row?.estimated_kcal, 0)));
    const plan = Array.isArray(row?.plan) ? row.plan : [];
    const doneSets = Array.isArray(row?.doneSets) ? row.doneSets : [];
    const activity = primaryActivityForWorkout(row);
    if (!started || !duration) return "";
    return [activity, started, ended, duration, kcal, plan.length, doneSets.length].join("|");
  }
  async function findExistingRemoteWorkout(c, userId, row) {
    if (!c || !userId || !row) return null;
    const started = row.startedAt || row.started_at;
    const duration = Math.max(0, Math.round(n(row.durationSeconds || row.duration_seconds, 0)));
    if (!started || !duration) return null;
    return sportRepository().findExistingWorkout({
      table: table("sport_sessions"),
      userId,
      activityType: primaryActivityForWorkout(row),
      startedAt: started,
      durationSeconds: duration,
    });
  }
  function removeLocalWorkout(id) {
    const key = String(id || "");
    sportStore.removeWorkout(key);
    saveLocalHistory(CACHE.localSessions);
    sportHistoryKeys().forEach(storageKey => removeWorkoutFromStoredHistory(storageKey, key));
  }
  function removeSessionFromRuntime(id) {
    const key = String(id || "");
    if (!key) return;
    sportStore.removeWorkout(key);
    publishSportHistory("delete-local");
  }
  function updateLocalWorkoutDate(id, newDate) {
    const changed = sportStore.updateLocalWorkoutDate(id, newDate);
    if (changed) saveLocalHistory(CACHE.localSessions);
    return changed;
  }
  function makePlanItem(activityKey, overrides) {
    const a = catalogItem(activityKey || "strength");
    const mode = overrides?.mode || a.mode;
    const intensity = overrides?.intensity || "moderate";
    return {
      tmpId: "tmp_" + Date.now() + "_" + Math.random().toString(16).slice(2),
      _sessionItemId: overrides?._sessionItemId || null,
      activityKey: a.key,
      exerciseName: overrides?.exerciseName || (lang() === "en" ? a.en : a.fr),
      equipment: overrides?.equipment || a.equipment,
      mode,
      targetReps: mode === "reps" ? n(overrides?.targetReps, 10) : 0,
      repMin: mode === "reps" ? n(overrides?.repMin ?? overrides?.repsMin ?? overrides?.targetRepsMin, overrides?.targetReps || 0) : 0,
      repMax: mode === "reps" ? n(overrides?.repMax ?? overrides?.repsMax ?? overrides?.targetRepsMax, overrides?.targetReps || 0) : 0,
      targetSeconds: mode === "time" ? n(overrides?.targetSeconds, 45) : n(overrides?.targetSeconds, 0),
      sets: Math.max(1, Math.round(n(overrides?.sets, 1))),
      restSeconds: Math.max(0, Math.round(n(overrides?.restSeconds, CACHE.globalRestSeconds || 60))),
      weightKg: n(overrides?.weightKg, 0),
      loadLabel: overrides?.loadLabel || "",
      distanceM: n(overrides?.distanceM, 0),
      intensity,
      intensityLabel: intensity === "light" ? txt("legere", "light") : intensity === "hard" ? txt("forte", "hard") : intensity === "max" ? txt("tres forte", "very hard") : txt("moderee", "moderate"),
      metValue: n(overrides?.metValue, a.met * intensityFactor(intensity)),
      notes: overrides?.notes || "",
    };
  }
  function programLoadForExercise(name) {
    const wanted = normalizedSearch(name);
    const exact = PROGRAM_LOADS.find(row => normalizedSearch(row[0]) === wanted);
    if (exact) return { weightKg: n(exact[1], 0), loadLabel: exact[2] || "" };
    const partial = PROGRAM_LOADS.find(row => wanted.includes(normalizedSearch(row[0])) || normalizedSearch(row[0]).includes(wanted));
    return partial ? { weightKg: n(partial[1], 0), loadLabel: partial[2] || "" } : { weightKg: 0, loadLabel: "" };
  }
  function exerciseLabel(ex) {
    return lang() === "en" ? ex.en : ex.fr;
  }
  function loadExerciseKeys(kind) {
    const key = kind === "favorite" ? EXERCISE_FAVORITES_KEY() : EXERCISE_RECENT_KEY();
    try {
      const rows = JSON.parse(localStorage.getItem(key) || "[]");
      return Array.isArray(rows) ? rows.map(String).filter(Boolean) : [];
    } catch (_) {
      return [];
    }
  }
  function saveExerciseKeys(kind, rows, limit) {
    const key = kind === "favorite" ? EXERCISE_FAVORITES_KEY() : EXERCISE_RECENT_KEY();
    const seen = new Set();
    const clean = [];
    (rows || []).forEach(row => {
      const v = String(row || "");
      if (!v || seen.has(v)) return;
      seen.add(v);
      clean.push(v);
    });
    try { localStorage.setItem(key, JSON.stringify(clean.slice(0, limit || 24))); } catch (_) {}
    return clean;
  }
  function toggleExerciseFavorite(key) {
    const k = String(key || "");
    if (!k) return;
    const rows = loadExerciseKeys("favorite");
    saveExerciseKeys("favorite", rows.includes(k) ? rows.filter(row => row !== k) : [k].concat(rows), 40);
  }
  function rememberExerciseRecent(key) {
    const k = String(key || "");
    if (!k) return;
    saveExerciseKeys("recent", [k].concat(loadExerciseKeys("recent")), 24);
  }
  function exerciseByKey(key) {
    return EXERCISE_LIBRARY.find(row => String(row.key) === String(key || "")) || null;
  }
  function quickExerciseRows(equipment) {
    const eq = String(equipment || "all");
    const family = String(CACHE.builderFamily || "all");
    const allow = ex => ex && (eq === "all" || ex.equipment === eq) && (family === "all" || exerciseFamily(ex) === family);
    const favs = loadExerciseKeys("favorite").map(exerciseByKey).filter(allow).slice(0, 8);
    const recents = loadExerciseKeys("recent").map(exerciseByKey).filter(allow).filter(ex => !favs.some(fav => fav.key === ex.key)).slice(0, 8);
    return { favs, recents };
  }
  function libraryToPlanItem(ex) {
    const load = programLoadForExercise(exerciseLabel(ex));
    return makePlanItem(ex.activityKey, {
      exerciseName: exerciseLabel(ex),
      equipment: ex.equipment,
      mode: ex.mode,
      targetReps: ex.repMin || ex.reps || 0,
      repMin: ex.repMin || 0,
      repMax: ex.repMax || 0,
      targetSeconds: ex.seconds || 0,
      sets: ex.sets || 1,
      restSeconds: ex.rest || 0,
      distanceM: ex.distanceM || 0,
      weightKg: n(ex.weightKg, load.weightKg),
      loadLabel: ex.loadLabel || load.loadLabel,
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
  function exerciseFamily(ex) {
    const hay = normalizedSearch(`${ex?.key || ""} ${ex?.fr || ""} ${ex?.en || ""} ${(ex?.tags || []).join(" ")} ${ex?.equipment || ""} ${ex?.activityKey || ""}`);
    if (String(ex?.goal || "") === "boxing" || hay.includes("boxing") || hay.includes("boxe") || hay.includes("sac")) return "boxing";
    if (String(ex?.goal || "") === "cardio" || ["running", "cycling", "walking", "hiking", "rowing", "jump_rope", "hiit", "swimming", "basketball"].includes(String(ex?.activityKey || ""))) return "cardio";
    if (String(ex?.goal || "") === "mobility" || hay.includes("mobilite") || hay.includes("stretch") || hay.includes("yoga")) return "mobility";
    if (String(ex?.activityKey || "") === "core_abs" || String(ex?.activityKey || "") === "plank_core" || hay.includes("crunch") || hay.includes("gainage") || hay.includes("plank") || hay.includes("twist") || hay.includes("core")) return "core";
    if (hay.includes("row") || hay.includes("rowing") || hay.includes("tirage") || hay.includes("traction") || hay.includes("pull") || hay.includes("curl") || hay.includes("biceps") || hay.includes("dos")) return "pull";
    if (hay.includes("squat") || hay.includes("lunge") || hay.includes("fente") || hay.includes("deadlift") || hay.includes("terre") || hay.includes("leg") || hay.includes("mollet") || hay.includes("calf") || hay.includes("hip thrust") || hay.includes("step-up") || hay.includes("jamb")) return "legs";
    if (hay.includes("press") || hay.includes("developpe") || hay.includes("push") || hay.includes("dip") || hay.includes("triceps") || hay.includes("epaules") || hay.includes("shoulder") || hay.includes("pector")) return "push";
    return "push";
  }
  function visibleExercises(equipment, query) {
    const eq = String(equipment || "all");
    const family = String(CACHE.builderFamily || "all");
    const q = normalizedSearch(query);
    const favs = loadExerciseKeys("favorite");
    const recents = loadExerciseKeys("recent");
    const rank = ex => {
      const key = String(ex?.key || "");
      const favIdx = favs.indexOf(key);
      const recentIdx = recents.indexOf(key);
      if (favIdx >= 0) return favIdx;
      if (recentIdx >= 0) return 100 + recentIdx;
      return 1000;
    };
    return EXERCISE_LIBRARY
      .filter(ex => (eq === "all" || ex.equipment === eq))
      .filter(ex => family === "all" || exerciseFamily(ex) === family)
      .filter(ex => {
        if (!q) return true;
        return normalizedSearch(`${ex.fr} ${ex.en} ${labelEquipment(ex.equipment)} ${exerciseFamily(ex)} ${(ex.tags || []).join(" ")}`).includes(q);
      })
      .slice()
      .sort((a, b) => rank(a) - rank(b) || exerciseLabel(a).localeCompare(exerciseLabel(b), lang() === "en" ? "en" : "fr", { sensitivity: "base" }));
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
  function familyOptions(selected) {
    return SPORT_FAMILIES.map(row => `<option value="${esc(row[0])}" ${row[0] === selected ? "selected" : ""}>${esc(lang() === "en" ? row[2] : row[1])}</option>`).join("");
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
    setVal("#sport-reps", ex.mode === "reps" ? n(ex.repMin || ex.reps, 0) : 0);
    setVal("#sport-rep-min", ex.mode === "reps" ? n(ex.repMin || ex.reps, 0) : 0);
    setVal("#sport-rep-max", ex.mode === "reps" ? n(ex.repMax || ex.repMin || ex.reps, 0) : 0);
    setVal("#sport-seconds", ex.mode === "time" ? n(ex.seconds, 45) : 45);
    setVal("#sport-sets", n(ex.sets, 1));
    setVal("#sport-rest", n(ex.rest, CACHE.globalRestSeconds || 60) || 60);
    setVal("#sport-distance", n(ex.distanceM, 0));
    const load = programLoadForExercise(exerciseLabel(ex));
    setVal("#sport-load", load.weightKg);
    const loadNote = root.querySelector("#sport-load-note");
    if (loadNote) {
      loadNote.textContent = load.loadLabel || "";
      loadNote.style.display = load.loadLabel ? "" : "none";
    }
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
    show("#sport-rep-max-wrap", !isTime);
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
    const defaultLoad = programLoadForExercise(exerciseName);
    const loadKg = n(root.querySelector("#sport-load")?.value, existing?.weightKg || defaultLoad.weightKg || 0);
    const repMin = Math.max(0, Math.round(n(root.querySelector("#sport-rep-min")?.value ?? root.querySelector("#sport-reps")?.value, existing?.repMin || existing?.targetReps || 0)));
    const repMax = Math.max(repMin, Math.round(n(root.querySelector("#sport-rep-max")?.value, existing?.repMax || repMin)));
    const item = Object.assign({}, existing || {}, {
      tmpId: existing?.tmpId || ("tmp_" + Date.now() + "_" + Math.random().toString(16).slice(2)),
      activityKey: a.key,
      exerciseName,
      equipment: String(root.querySelector("#sport-equipment")?.value || libraryEx?.equipment || (selectedEquipment && selectedEquipment !== "all" ? selectedEquipment : "") || existing?.equipment || a.equipment),
      mode,
      targetReps: mode === "reps" ? repMin : 0,
      repMin: mode === "reps" ? repMin : 0,
      repMax: mode === "reps" ? repMax : 0,
      targetSeconds: mode === "time" ? n(root.querySelector("#sport-seconds")?.value, existing?.targetSeconds || 0) : n(root.querySelector("#sport-seconds")?.value, 0),
      sets: Math.max(1, Math.round(n(root.querySelector("#sport-sets")?.value, existing?.sets || 1))),
      restSeconds: Math.max(0, Math.round(n(root.querySelector("#sport-rest")?.value, restSecondsForItem(existing || {})))),
      weightKg: loadKg,
      loadLabel: n(loadKg, 0) === n(defaultLoad.weightKg, 0) ? (existing?.loadLabel || defaultLoad.loadLabel || "") : (existing?.loadLabel || ""),
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
  function programReps(name, equipment, sets, repMin, repMax, restSeconds, opts) {
    const activityKey = opts?.activityKey || (equipment === "bodyweight" ? "bodyweight_strength" : "strength");
    const load = programLoadForExercise(name);
    return makePlanItem(activityKey, Object.assign({
      exerciseName: name,
      equipment,
      mode: "reps",
      targetReps: repMin,
      repMin,
      repMax,
      sets,
      restSeconds,
      weightKg: load.weightKg,
      loadLabel: load.loadLabel,
    }, opts || {}));
  }
  function programTime(name, sets, minSeconds, maxSeconds, restSeconds, opts) {
    const load = programLoadForExercise(name);
    return makePlanItem(opts?.activityKey || "plank_core", Object.assign({
      exerciseName: name,
      equipment: opts?.equipment || "bodyweight",
      mode: "time",
      targetSeconds: minSeconds,
      timeMin: minSeconds,
      timeMax: maxSeconds,
      sets,
      restSeconds,
      weightKg: load.weightKg,
      loadLabel: load.loadLabel,
    }, opts || {}));
  }
  function defaultSessionFavorites() {
    return [
      { id: "mass_a1", week: "A", name: "Semaine A - A1", days: ["Lundi"], plan: [
        programReps("Squat arriere", "barbell", 3, 6, 10, 180),
        programReps("Developpe couche", "barbell", 3, 6, 10, 180),
        programReps("Tractions pronation", "bodyweight", 3, 6, 10, 120),
        programReps("Developpe militaire halteres", "dumbbell", 2, 8, 12, 90),
        programReps("Curl halteres", "dumbbell", 2, 10, 15, 60),
        programTime("Gainage", 3, 30, 60, 60),
      ] },
      { id: "mass_a2", week: "A", name: "Semaine A - A2", days: ["Mercredi"], plan: [
        programReps("Souleve de terre", "barbell", 3, 6, 10, 180),
        programReps("Developpe incline halteres", "dumbbell", 3, 8, 12, 120),
        programReps("Rowing barre", "barbell", 3, 8, 12, 120),
        programReps("Elevations laterales", "dumbbell", 2, 12, 20, 60),
        programReps("Extension triceps haltere au-dessus de la tete", "dumbbell", 2, 10, 15, 60),
        programReps("Releves de jambes", "bodyweight", 3, 10, 20, 60, { activityKey: "core_abs" }),
      ] },
      { id: "mass_a3", week: "A", name: "Semaine A - A3", days: ["Vendredi"], plan: [
        programReps("Front squat ou Goblet squat", "barbell", 3, 8, 12, 120),
        programReps("Developpe couche prise serree", "barbell", 3, 8, 12, 120),
        programReps("Tractions supination", "bodyweight", 3, 6, 10, 120),
        programReps("Oiseau halteres", "dumbbell", 2, 12, 20, 60),
        programReps("Curl marteau", "dumbbell", 2, 10, 15, 60),
        programTime("Gainage lateral", 2, 30, 60, 60),
      ] },
      { id: "mass_b1", week: "B", name: "Semaine B - B1", days: ["Lundi"], plan: [
        programReps("Fentes bulgares", "dumbbell", 3, 8, 12, 120),
        programReps("Developpe incline barre", "barbell", 3, 6, 10, 180),
        programReps("Rowing haltere un bras", "dumbbell", 3, 8, 12, 90),
        programReps("Developpe militaire barre", "barbell", 2, 6, 10, 120),
        programReps("Curl barre", "barbell", 2, 10, 15, 60),
        programReps("Abdos", "bodyweight", 3, 10, 20, 60, { activityKey: "core_abs" }),
      ] },
      { id: "mass_b2", week: "B", name: "Semaine B - B2", days: ["Mercredi"], plan: [
        programReps("Souleve de terre roumain", "barbell", 3, 6, 10, 180),
        programReps("Developpe couche", "barbell", 3, 6, 10, 180),
        programReps("Tractions lestees ou poids du corps", "bodyweight", 3, 6, 10, 120),
        programReps("Elevations laterales", "dumbbell", 2, 12, 20, 60),
        programReps("Extension triceps", "dumbbell", 2, 10, 15, 60),
        programReps("Abdos", "bodyweight", 3, 10, 20, 60, { activityKey: "core_abs" }),
      ] },
      { id: "mass_b3", week: "B", name: "Semaine B - B3", days: ["Vendredi"], plan: [
        programReps("Squat arriere", "barbell", 3, 6, 10, 180),
        programReps("Developpe halteres ou pompes lestees", "dumbbell", 3, 8, 12, 120),
        programReps("Rowing barre", "barbell", 3, 8, 12, 120),
        programReps("Oiseau halteres", "dumbbell", 2, 12, 20, 60),
        programReps("Curl marteau", "dumbbell", 2, 10, 15, 60),
        programTime("Gainage", 3, 30, 60, 60),
      ] },
    ];
  }
  function loadCustomSessionFavorites() {
    try {
      const rows = JSON.parse(localStorage.getItem(SESSION_FAVORITES_KEY()) || "[]");
      return Array.isArray(rows) ? rows.filter(row => row && row.id && Array.isArray(row.plan)) : [];
    } catch (_) { return []; }
  }
  function saveCustomSessionFavorites(rows) {
    try { localStorage.setItem(SESSION_FAVORITES_KEY(), JSON.stringify((rows || []).slice(0, 30))); } catch (_) {}
  }
  function sessionFavoriteRows() {
    const defaults = defaultSessionFavorites();
    const sqlRows = Array.isArray(CACHE.sqlSessionFavorites) ? CACHE.sqlSessionFavorites : [];
    const custom = loadCustomSessionFavorites();
    const customById = new Map(custom.map(row => [String(row.id || ""), row]));
    const customByCode = new Map();
    custom.forEach(row => {
      const code = sessionCode(row);
      if (code && !customByCode.has(code)) customByCode.set(code, row);
    });
    if (sqlRows.length) {
      const sqlIds = new Set(sqlRows.map(row => String(row.id || "")));
      const sqlCodes = new Set(sqlRows.map(sessionCode).filter(Boolean));
      return sqlRows.map(row => customById.get(String(row.id || "")) || customByCode.get(sessionCode(row)) || row)
        .concat(custom.filter(row => !sqlIds.has(String(row.id || "")) && !sqlCodes.has(sessionCode(row))))
        .slice(0, 30);
    }
    const ids = new Set(defaults.map(row => row.id));
    const defaultCodes = new Set(defaults.map(sessionCode).filter(Boolean));
    return defaults.map(row => customById.get(String(row.id || "")) || customByCode.get(sessionCode(row)) || row)
      .concat(custom.filter(row => !ids.has(row.id) && !defaultCodes.has(sessionCode(row))))
      .slice(0, 30);
  }
  function clonePlan(plan) {
    return (plan || []).map(item => Object.assign({}, item, { tmpId: "tmp_" + Date.now() + "_" + Math.random().toString(16).slice(2) }));
  }
  function loadSessionFavorite(id) {
    const fav = sessionFavoriteRows().find(row => String(row.id) === String(id));
    if (!fav) return false;
    CACHE.builderGoal = "strength";
    CACHE.builderEquipment = "all";
    CACHE.builderFamily = "all";
    CACHE.circuit = Object.assign({}, CACHE.circuit || {}, { enabled: false });
    saveCircuit(CACHE.circuit);
    CACHE.plan = clonePlan(fav.plan);
    CACHE.editingPlanIndex = null;
    savePlan();
    sportFeedback(txt("Seance favorite chargee", "Favorite workout loaded"), fav.name, { toast: true });
    return true;
  }
  function beginEditSessionFavorite(id) {
    if (!loadSessionFavorite(id)) return false;
    const fav = sessionFavoriteRows().find(row => String(row.id) === String(id));
    CACHE.editingSessionFavoriteId = String(id || "");
    CACHE.editingSessionFavoriteName = fav?.name || "";
    CACHE.editingPlanIndex = null;
    sportFeedback(txt("Seance prete a modifier", "Workout ready to edit"), fav?.name || "", { toast: true });
    return true;
  }
  function saveEditingSessionFavorite() {
    const id = String(CACHE.editingSessionFavoriteId || "").trim();
    if (!id || !CACHE.plan?.length) return false;
    const existing = sessionFavoriteRows().find(row => String(row.id || "") === id) || {};
    const custom = loadCustomSessionFavorites().filter(row => String(row.id || "") !== id);
    custom.unshift(Object.assign({}, existing, {
      id,
      name: CACHE.editingSessionFavoriteName || existing.name || txt("Seance personnalisee", "Custom workout"),
      plan: clonePlan(CACHE.plan),
      source: "custom",
      updatedAt: new Date().toISOString(),
    }));
    saveCustomSessionFavorites(custom);
    CACHE.editingSessionFavoriteId = "";
    CACHE.editingSessionFavoriteName = "";
    sportFeedback(txt("Seance favorite mise a jour", "Favorite workout updated"), existing.name || "", { toast: true });
    return true;
  }
  function openSessionFavoriteEditor(id) {
    const fav = id ? sessionFavoriteRows().find(row => String(row.id || "") === String(id || "")) : null;
    const nextId = fav?.id || `custom_${Date.now().toString(36)}`;
    CACHE.sessionEditor = {
      id: String(nextId),
      sessionKey: fav?.sessionKey || sessionCode(fav) || "",
      isNew: !fav,
      name: fav?.name || txt("Nouvelle seance", "New workout"),
      week: fav?.week || "",
      days: Array.isArray(fav?.days) ? fav.days.slice() : [],
      plan: clonePlan(fav?.plan?.length ? fav.plan : [quickPlanItem("pushup")]),
    };
    sportFeedback(txt("Fenetre de seance ouverte", "Workout editor opened"), CACHE.sessionEditor.name, { toast: true });
    return true;
  }
  function closeSessionFavoriteEditor() {
    CACHE.sessionEditor = null;
  }
  function sessionEditorExerciseOptions(selectedKey) {
    return EXERCISE_LIBRARY
      .slice()
      .sort((a, b) => String(exerciseLabel(a)).localeCompare(String(exerciseLabel(b))))
      .map(ex => `<option value="${esc(ex.key)}" ${String(ex.key) === String(selectedKey || "") ? "selected" : ""}>${esc(exerciseLabel(ex))} · ${esc(labelEquipment(ex.equipment))}</option>`)
      .join("");
  }
  function readSessionEditorFromDom(root) {
    const editor = CACHE.sessionEditor;
    if (!editor || !root) return null;
    const rows = Array.from(root.querySelectorAll("[data-sport-session-editor-row]"));
    const existing = editor.plan || [];
    const plan = rows.map((row, position) => {
      const oldIndex = Math.max(0, Math.round(n(row.getAttribute("data-index"), position)));
      const base = existing[oldIndex] || quickPlanItem("pushup");
      const mode = row.querySelector("[data-field='mode']")?.value || base.mode || "reps";
      const repMin = Math.max(1, Math.round(n(row.querySelector("[data-field='repMin']")?.value, base.repMin || base.targetReps || 8)));
      const repMax = Math.max(repMin, Math.round(n(row.querySelector("[data-field='repMax']")?.value, base.repMax || repMin)));
      const targetSeconds = Math.max(1, Math.round(n(row.querySelector("[data-field='seconds']")?.value, base.targetSeconds || 45)));
      return Object.assign({}, base, {
        tmpId: base.tmpId || `tmp_${Date.now()}_${position}`,
        exerciseName: String(row.querySelector("[data-field='name']")?.value || base.exerciseName || "").trim() || sessionExerciseName(base),
        equipment: row.querySelector("[data-field='equipment']")?.value || base.equipment || "bodyweight",
        mode,
        targetReps: mode === "reps" ? repMin : 0,
        repMin: mode === "reps" ? repMin : 0,
        repMax: mode === "reps" ? repMax : 0,
        targetSeconds: mode === "time" ? targetSeconds : n(base.targetSeconds, 0),
        timeMin: mode === "time" ? Math.max(1, Math.round(n(row.querySelector("[data-field='timeMin']")?.value, base.timeMin || targetSeconds))) : 0,
        timeMax: mode === "time" ? Math.max(targetSeconds, Math.round(n(row.querySelector("[data-field='timeMax']")?.value, base.timeMax || targetSeconds))) : 0,
        sets: Math.max(1, Math.round(n(row.querySelector("[data-field='sets']")?.value, base.sets || 1))),
        restSeconds: Math.max(0, Math.round(n(row.querySelector("[data-field='rest']")?.value, restSecondsForItem(base)))),
        weightKg: Math.max(0, n(row.querySelector("[data-field='weight']")?.value, base.weightKg || 0)),
        loadLabel: String(row.querySelector("[data-field='loadLabel']")?.value || "").trim(),
        notes: String(row.querySelector("[data-field='notes']")?.value || "").trim(),
      });
    });
    editor.name = String(root.querySelector("#sport-session-editor-name")?.value || editor.name || "").trim() || txt("Seance personnalisee", "Custom workout");
    editor.week = String(root.querySelector("#sport-session-editor-week")?.value || "").trim().toUpperCase();
    editor.days = String(root.querySelector("#sport-session-editor-days")?.value || "")
      .split(",")
      .map(day => day.trim())
      .filter(Boolean);
    editor.plan = plan;
    return editor;
  }
  function saveSessionEditorFromDom(root) {
    const editor = readSessionEditorFromDom(root);
    if (!editor || !editor.plan.length) return false;
    const existing = sessionFavoriteRows().find(row => String(row.id || "") === String(editor.id || "")) || {};
    const custom = loadCustomSessionFavorites().filter(row => String(row.id || "") !== String(editor.id || ""));
    custom.unshift(Object.assign({}, existing, {
      id: editor.id,
      sessionKey: editor.sessionKey || sessionCode(existing) || sessionCode({ id: editor.id, name: editor.name }),
      name: editor.name,
      week: editor.week,
      days: editor.days,
      plan: clonePlan(editor.plan),
      source: "custom",
      updatedAt: new Date().toISOString(),
    }));
    saveCustomSessionFavorites(custom);
    CACHE.sessionEditor = null;
    sportFeedback(txt("Seance parametree enregistree", "Configured workout saved"), editor.name, { toast: true });
    return true;
  }
  function mutateSessionEditorFromDom(root, mutate) {
    const editor = readSessionEditorFromDom(root);
    if (!editor) return false;
    mutate(editor);
    CACHE.sessionEditor = editor;
    return true;
  }
  function resetSessionFavoriteOverride(id) {
    const before = loadCustomSessionFavorites();
    const next = before.filter(row => String(row.id || "") !== String(id || ""));
    saveCustomSessionFavorites(next);
    return before.length !== next.length;
  }
  function loadSportProgram() {
    try {
      const raw = JSON.parse(localStorage.getItem(SPORT_PROGRAM_KEY()) || "{}");
      return raw && raw.enabled ? raw : { enabled: false };
    } catch (_) { return { enabled: false }; }
  }
  function saveSportProgram(program) {
    const next = Object.assign({ enabled: true, startDate: todayISO(), days: { 1: "A1", 3: "A2", 5: "A3" } }, program || {});
    try { localStorage.setItem(SPORT_PROGRAM_KEY(), JSON.stringify(next)); } catch (_) {}
    return next;
  }
  function nextMondayISO(day) {
    return sportProgramRules.nextMondayISO(day || todayISO());
  }
  function activateMassProgram() {
    CACHE.program = saveSportProgram({
      enabled: true,
      startDate: nextMondayISO(todayISO()),
      cycle: "A/B",
      days: { 1: "A1/B1", 3: "A2/B2", 5: "A3/B3" },
    });
    sportFeedback(
      txt("Planning active", "Program activated"),
      txt("Alternance A/B le lundi, mercredi et vendredi.", "A/B rotation on Monday, Wednesday and Friday."),
      { toast: true }
    );
  }
  function sqlProgramExerciseToPlanItem(row) {
    const mode = String(row?.mode || "reps");
    return makePlanItem(row?.activity_key || "strength", {
      exerciseName: row?.exercise_name || "",
      equipment: row?.equipment || "mixed",
      mode,
      targetReps: mode === "reps" ? n(row?.target_reps ?? row?.rep_min, 0) : 0,
      repMin: mode === "reps" ? n(row?.rep_min, row?.target_reps || 0) : 0,
      repMax: mode === "reps" ? n(row?.rep_max, row?.target_reps || row?.rep_min || 0) : 0,
      targetSeconds: mode === "time" ? n(row?.target_seconds ?? row?.time_min_seconds, 0) : 0,
      timeMin: mode === "time" ? n(row?.time_min_seconds, row?.target_seconds || 0) : 0,
      timeMax: mode === "time" ? n(row?.time_max_seconds, row?.target_seconds || row?.time_min_seconds || 0) : 0,
      sets: n(row?.planned_sets, 1),
      restSeconds: n(row?.rest_seconds, 0),
      weightKg: n(row?.default_weight_kg, 0),
      loadLabel: row?.load_label || "",
      distanceM: n(row?.distance_m, 0),
      metValue: n(row?.met_value, 0),
      notes: row?.notes || "",
    });
  }
  async function ensureSportProgramsLoaded(reason) {
    if (CACHE.programLoading || CACHE.programLoaded) return false;
    const c = client();
    if (!c || !uid()) {
      CACHE.programLoaded = true;
      return false;
    }
    const offline = (typeof window.tbShouldUseOfflineMode === "function")
      ? await window.tbShouldUseOfflineMode(`sport:programs:${reason || "render"}`)
      : ((typeof window.tbIsOfflineMode === "function" && window.tbIsOfflineMode()) || (navigator && navigator.onLine === false));
    if (offline) {
      CACHE.programLoaded = true;
      return false;
    }
    CACHE.programLoading = true;
    try {
      const programs = await c
        .from(table("sport_programs"))
        .select("id,key,name,goal,cycle,start_date,is_active")
        .eq("key", "lean_bulk_ab")
        .eq("is_active", true)
        .maybeSingle();
      if (programs.error) throw programs.error;
      const program = programs.data;
      if (!program?.id) return false;
      const sessions = await c
        .from(table("sport_program_sessions"))
        .select("id,session_key,name,week_label,day_of_week,sort_order")
        .eq("program_id", program.id)
        .order("sort_order", { ascending: true });
      if (sessions.error) throw sessions.error;
      const sessionIds = (sessions.data || []).map(row => row.id).filter(Boolean);
      let exercises = { data: [], error: null };
      if (sessionIds.length) {
        exercises = await c
          .from(table("sport_program_exercises"))
          .select("id,session_id,exercise_key,exercise_name,activity_key,equipment,mode,target_reps,rep_min,rep_max,target_seconds,time_min_seconds,time_max_seconds,planned_sets,rest_seconds,default_weight_kg,load_label,distance_m,met_value,sort_order,notes")
          .in("session_id", sessionIds)
          .order("sort_order", { ascending: true });
        if (exercises.error) throw exercises.error;
      }
      CACHE.sqlSessionFavorites = (sessions.data || []).map(row => {
        const plan = (exercises.data || [])
          .filter(ex => String(ex.session_id) === String(row.id))
          .sort((a, b) => n(a.sort_order, 0) - n(b.sort_order, 0))
          .map(sqlProgramExerciseToPlanItem);
        return {
          id: `sql_${row.session_key}`,
          sessionKey: row.session_key,
          source: "sql",
          week: row.week_label,
          name: row.name,
          days: [dayNameFromNumber(row.day_of_week)],
          plan,
        };
      }).filter(row => row.plan.length);
      const sqlProgram = {
        enabled: true,
        source: "sql",
        startDate: String(program.start_date || todayISO()).slice(0, 10),
        cycle: program.cycle || "A/B",
        days: programDaysFromSqlSessions(sessions.data || []),
      };
      const localProgram = loadSportProgram();
      CACHE.program = saveSportProgram(Object.assign({}, sqlProgram, localProgram?.enabled ? localProgram : {}, {
        enabled: true,
        source: "sql",
        startDate: sqlProgram.startDate,
        cycle: sqlProgram.cycle,
        days: sqlProgram.days,
      }));
      CACHE.programSource = "sql";
      return CACHE.sqlSessionFavorites.length > 0;
    } catch (e) {
      if (!isOfflineSkipError(e)) console.warn("[sport] program load failed", e?.message || e);
    } finally {
      CACHE.programLoading = false;
      CACHE.programLoaded = true;
    }
    return false;
  }
  function dayNameFromNumber(day) {
    const fr = ["", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
    const en = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    const i = Math.max(1, Math.min(7, Math.round(n(day, 1))));
    return lang() === "en" ? en[i] : fr[i];
  }
  function sessionPlannedLoadSummary(session) {
    const rows = (session?.plan || [])
      .filter(item => item?.mode === "reps")
      .slice(0, 4)
      .map(item => {
        const load = lastLoadForExercise(item, effectiveLoadKg(item, bodyWeight()));
        const range = progressionRepRange(item);
        const loadLabel = item.loadLabel || item.load_label || (supportsExternalLoad(item) && load ? `${Math.round(load * 10) / 10} kg` : labelEquipment(item.equipment));
        const reps = range ? `${range.min}-${range.max}` : Math.round(n(item.targetReps, 0));
        return `${item.exerciseName || labelActivity(item.activityKey)} ${loadLabel} x ${reps}`;
      });
    return rows.length ? rows.join(" · ") : txt("Charges a preparer dans le timer.", "Loads to prepare in the timer.");
  }
  function sessionProgressionPreview(session) {
    const candidate = (session?.plan || []).find(item => progressionRepRange(item) && supportsExternalLoad(item));
    if (!candidate) return txt("Progression suivie sur les exercices avec charge.", "Progression is tracked on loaded exercises.");
    const range = progressionRepRange(candidate);
    const load = lastLoadForExercise(candidate, effectiveLoadKg(candidate, bodyWeight()));
    const inc = progressionIncrementKg(candidate);
    return txt(
      `${candidate.exerciseName || "Exercice"} : vise ${range.min}-${range.max} reps. Si toutes les series touchent ${range.max}, prochaine fois +${inc} kg.`,
      `${candidate.exerciseName || "Exercise"}: aim for ${range.min}-${range.max} reps. If every set reaches ${range.max}, next time +${inc} kg.`
    ) + (load ? ` ${txt("Charge actuelle", "Current load")}: ${Math.round(load * 10) / 10} kg.` : "");
  }
  function sessionExerciseName(item) {
    return item?.exerciseName || labelActivity(item?.activityKey || "strength");
  }
  function plannedExerciseLoadLabel(item) {
    const fallback = effectiveLoadKg(item, bodyWeight());
    const load = lastLoadForExercise(item, fallback);
    if (item?.loadLabel || item?.load_label) return item.loadLabel || item.load_label;
    if (supportsExternalLoad(item) && load) return `${Math.round(load * 10) / 10} kg`;
    return labelEquipment(item?.equipment);
  }
  function exerciseProgressionRows(session) {
    return (session?.plan || [])
      .filter(item => item?.mode === "reps")
      .slice(0, 8)
      .map(item => {
        const range = progressionRepRange(item);
        const inc = supportsExternalLoad(item) ? progressionIncrementKg(item) : 0;
        const load = lastLoadForExercise(item, effectiveLoadKg(item, bodyWeight()));
        return {
          name: sessionExerciseName(item),
          sets: Math.max(1, Math.round(n(item.sets, 1))),
          range,
          inc,
          load,
          loadLabel: plannedExerciseLoadLabel(item),
          restSeconds: restSecondsForItem(item),
          external: supportsExternalLoad(item),
        };
      });
  }
  function sessionDoneOnDay(row) {
    if (!row?.session) return null;
    const code = String(row.code || sessionCode(row.session) || "").toUpperCase();
    const day = String(row.day || "").slice(0, 10);
    const sameDay = (CACHE.sessions || []).concat((CACHE.localSessions || []).map(localToHistorySession))
      .filter(s => String(s.started_at || s.startedAt || "").slice(0, 10) === day);
    return sameDay.find(s => {
      const name = `${s.notes || ""} ${s.mood_after || ""} ${s.first_exercise || ""}`.toLowerCase();
      return code && name.includes(code.toLowerCase());
    }) || sameDay[0] || null;
  }
  function lastProgramSessionDone() {
    return (CACHE.sessions || []).concat((CACHE.localSessions || []).map(localToHistorySession))
      .filter(s => s && (s.started_at || s.startedAt))
      .slice()
      .sort((a, b) => String(b.started_at || b.startedAt || "").localeCompare(String(a.started_at || a.startedAt || "")))[0] || null;
  }
  function catchupPlannedSportRow(days, today) {
    const limit = String(today || todayISO()).slice(0, 10);
    return (days || [])
      .filter(row => row.planned && row.day < limit && !sessionDoneOnDay(row))
      .slice()
      .sort((a, b) => String(b.day || "").localeCompare(String(a.day || "")))[0] || null;
  }
  function renderProgramCockpit(days, program) {
    const weekLabel = days[0]?.weekLabel || currentProgramWeek(program);
    const today = todayISO();
    const todayRow = days.find(row => row.day === today);
    const next = nextPlannedSportRow(days, today);
    const target = todayRow?.session || next?.session || null;
    const targetRow = todayRow?.session ? todayRow : next;
    const catchup = catchupPlannedSportRow(days, today);
    const last = lastProgramSessionDone();
    const progressionRows = exerciseProgressionRows(target);
    const loads = (target?.plan || []).slice(0, 8);
    const todayLabel = todayRow?.session ? `${todayRow.code || ""} · ${todayRow.session.name}` : txt("Repos aujourd'hui", "Rest today");
    const nextLabel = next?.session ? `${next.day === today ? txt("Aujourd'hui", "Today") : shortWeekday(next.day)} · ${next.code || ""}` : txt("Aucune seance", "No workout");
    return `<div class="tb-sport-program-cockpit">
      <div class="tb-sport-program-head">
        <div>
          <span>${esc(txt("Programme V3", "Program V3"))}</span>
          <strong>${esc(txt("Cockpit entrainement", "Training cockpit"))}</strong>
          <small>${esc(txt(`Cycle ${weekLabel} actif, recurrence parametrable juste dessous.`, `Active ${weekLabel} cycle, recurrence can be edited below.`))}</small>
        </div>
        <div class="tb-sport-actions">
          ${todayRow?.session ? `<button class="btn small primary" type="button" data-sport-start-planned-today="${esc(todayRow.session.id)}">${esc(txt("Lancer aujourd'hui", "Start today"))}</button>` : ""}
          ${target ? `<button class="btn small" type="button" data-sport-load-session-favorite="${esc(target.id)}">${esc(txt("Preparer", "Prepare"))}</button>` : ""}
        </div>
      </div>
      <div class="tb-sport-program-kpis">
        <div><span>${esc(txt("Semaine", "Week"))}</span><strong>${esc(weekLabel)}</strong><small>${esc(txt("Alternance A/B", "A/B rotation"))}</small></div>
        <div><span>${esc(txt("Aujourd'hui", "Today"))}</span><strong>${esc(todayLabel)}</strong><small>${esc(todayRow?.session ? txt("Seance prevue", "Workout planned") : txt("Recuperation", "Recovery"))}</small></div>
        <div><span>${esc(txt("Prochaine", "Next"))}</span><strong>${esc(nextLabel)}</strong><small>${esc(next?.session?.name || txt("Planning a completer", "Planning to complete"))}</small></div>
        <div><span>${esc(txt("Derniere", "Last"))}</span><strong>${esc(last ? String(last.started_at || last.startedAt || "").slice(5, 10).replace("-", "/") : "-")}</strong><small>${esc(last ? `${Math.round(n(last.estimated_kcal, 0))} kcal` : txt("Aucune seance", "No workout"))}</small></div>
      </div>
      ${catchup?.session ? `<div class="tb-sport-program-catchup">
        <div><strong>${esc(txt("Seance a rattraper", "Workout to catch up"))}</strong><small>${esc(`${catchup.day} · ${catchup.code || catchup.session.name} · ${catchup.session.name}`)}</small></div>
        <button class="btn small" type="button" data-sport-load-session-favorite="${esc(catchup.session.id)}">${esc(txt("Charger", "Load"))}</button>
      </div>` : ""}
      ${target ? `<div class="tb-sport-program-focus">
        <div>
          <span>${esc(txt(targetRow?.day === today ? "Seance du jour" : "Prochaine seance", targetRow?.day === today ? "Today's workout" : "Next workout"))}</span>
          <strong>${esc(target.name)}</strong>
          <small>${esc(sessionPlannedLoadSummary(target))}</small>
        </div>
        <em>${esc(sessionProgressionPreview(target))}</em>
      </div>` : ""}
      ${loads.length ? `<div class="tb-sport-program-loads">
        ${loads.map(item => `<div>
          <span>${esc(sessionExerciseName(item))}</span>
          <strong>${esc(plannedExerciseLoadLabel(item))}</strong>
          <small>${esc(item.mode === "reps" ? `${Math.max(1, Math.round(n(item.sets, 1)))} x ${progressionRepRange(item) ? `${progressionRepRange(item).min}-${progressionRepRange(item).max}` : Math.round(n(item.targetReps, 0))} reps` : `${Math.max(1, Math.round(n(item.sets, 1)))} x ${fmtSec(item.targetSeconds || 0)}`)} · ${esc(txt("repos", "rest"))} ${esc(fmtSec(restSecondsForItem(item)))}</small>
        </div>`).join("")}
      </div>` : ""}
      ${progressionRows.length ? `<div class="tb-sport-program-progression">
        <strong>${esc(txt("Progression exercice par exercice", "Exercise-by-exercise progression"))}</strong>
        ${progressionRows.map(row => `<div>
          <span>${esc(row.name)}</span>
          <small>${esc(`${row.sets} x ${row.range ? `${row.range.min}-${row.range.max}` : "-"} · ${row.loadLabel}`)}</small>
          <b>${esc(row.external && row.range ? txt(`+${row.inc} kg quand toutes les series touchent ${row.range.max}`, `+${row.inc} kg when every set reaches ${row.range.max}`) : txt("Progression reps/temps", "Reps/time progression"))}</b>
        </div>`).join("")}
      </div>` : ""}
    </div>`;
  }
  function renderPlannedSportWeek(rows, program) {
    const days = plannedSportWeekRows(rows, program, todayISO());
    if (!days.length) return "";
    const weekLabel = days[0]?.weekLabel || currentProgramWeek(program);
    const today = todayISO();
    return `<div class="tb-sport-planned-week">
      ${renderProgramCockpit(days, program)}
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap;">
        <div>
          <strong>${esc(txt("Semaine planifiee", "Planned week"))}</strong>
          <div class="muted">${esc(txt(`Cycle ${weekLabel} actif : seance les lundi, mercredi et vendredi.`, `Active ${weekLabel} cycle: workout on Monday, Wednesday and Friday.`))}</div>
        </div>
        <span class="pill">${esc(txt("Semaine", "Week"))} ${esc(weekLabel)}</span>
      </div>
      <div class="tb-sport-planned-grid">
        ${days.map(row => {
          const isToday = row.day === today;
          const planned = Boolean(row.session);
          const label = planned ? (row.code || row.session.name) : txt("Repos", "Rest");
          const detail = planned ? row.session.name : txt("Jour de repos actuel", "Current rest day");
          return `<button class="tb-sport-planned-day ${planned ? "planned" : "rest"} ${isToday ? "today" : ""}" type="button" ${planned ? `data-sport-load-session-favorite="${esc(row.session.id)}"` : ""} title="${esc(`${row.day} | ${detail}`)}">
            <span>${esc(shortWeekday(row.day))}</span>
            <strong>${esc(label)}</strong>
            <small>${esc(detail)}</small>
          </button>`;
        }).join("")}
      </div>
    </div>`;
  }
  function programDayOptions(value) {
    const current = String(value || "");
    const options = [
      ["", txt("Repos", "Rest")],
      ["A1/B1", "A1 / B1"],
      ["A2/B2", "A2 / B2"],
      ["A3/B3", "A3 / B3"],
      ["A1", "A1"],
      ["A2", "A2"],
      ["A3", "A3"],
      ["B1", "B1"],
      ["B2", "B2"],
      ["B3", "B3"],
    ];
    return options.map(row => `<option value="${esc(row[0])}" ${row[0] === current ? "selected" : ""}>${esc(row[1])}</option>`).join("");
  }
  function renderProgramSettings(program) {
    const p = Object.assign({ enabled: false, startDate: nextMondayISO(todayISO()), cycle: "A/B", days: { 1: "A1/B1", 3: "A2/B2", 5: "A3/B3" } }, program || {});
    const dayLabels = [txt("Lun", "Mon"), txt("Mar", "Tue"), txt("Mer", "Wed"), txt("Jeu", "Thu"), txt("Ven", "Fri"), txt("Sam", "Sat"), txt("Dim", "Sun")];
    return `<details class="tb-sport-advanced" style="margin:10px 0;" ${p.enabled ? "open" : ""}>
      <summary>${esc(txt("Regler planning et recurrence", "Configure planning and recurrence"))}</summary>
      <div class="tb-sport-fields" style="margin-top:10px;">
        <div class="tb-sport-field"><label>${esc(txt("Actif", "Active"))}</label><select id="sport-program-enabled"><option value="on" ${p.enabled ? "selected" : ""}>${esc(txt("Actif", "Active"))}</option><option value="off" ${!p.enabled ? "selected" : ""}>${esc(txt("Pause", "Paused"))}</option></select></div>
        <div class="tb-sport-field"><label>${esc(txt("Debut cycle", "Cycle start"))}</label><input id="sport-program-start" type="date" value="${esc(String(p.startDate || p.start_date || todayISO()).slice(0, 10))}"></div>
        <div class="tb-sport-field"><label>${esc(txt("Cycle", "Cycle"))}</label><select id="sport-program-cycle"><option value="A/B" ${String(p.cycle || "A/B") === "A/B" ? "selected" : ""}>A/B</option><option value="A" ${String(p.cycle || "") === "A" ? "selected" : ""}>${esc(txt("Semaine A fixe", "Fixed week A"))}</option><option value="B" ${String(p.cycle || "") === "B" ? "selected" : ""}>${esc(txt("Semaine B fixe", "Fixed week B"))}</option></select></div>
        ${dayLabels.map((label, idx) => `<div class="tb-sport-field"><label>${esc(label)}</label><select data-sport-program-day="${idx + 1}">${programDayOptions(p.days?.[idx + 1])}</select></div>`).join("")}
      </div>
      <div class="tb-sport-actions" style="margin-top:10px;">
        <button class="btn small" type="button" id="sport-program-reset">${esc(txt("Planning A/B par defaut", "Default A/B planning"))}</button>
      </div>
    </details>`;
  }
  function renderSessionEditorModal() {
    const editor = CACHE.sessionEditor;
    if (!editor) return "";
    const plan = editor.plan || [];
    return `<div class="tb-sport-session-editor-meta">
          <label><span>${esc(txt("Nom", "Name"))}</span><input id="sport-session-editor-name" value="${esc(editor.name || "")}"></label>
          <label><span>${esc(txt("Semaine", "Week"))}</span><select id="sport-session-editor-week"><option value="" ${!editor.week ? "selected" : ""}>${esc(txt("Libre", "Free"))}</option><option value="A" ${editor.week === "A" ? "selected" : ""}>A</option><option value="B" ${editor.week === "B" ? "selected" : ""}>B</option></select></label>
          <label><span>${esc(txt("Jours", "Days"))}</span><input id="sport-session-editor-days" value="${esc((editor.days || []).join(", "))}" placeholder="${esc(txt("Lundi, Mercredi", "Monday, Wednesday"))}"></label>
        </div>
        <div class="tb-sport-session-editor-add">
          <label><span>${esc(txt("Ajouter depuis la bibliotheque", "Add from library"))}</span><select id="sport-session-editor-add-ex">${sessionEditorExerciseOptions("")}</select></label>
          <button class="btn primary" type="button" id="sport-session-editor-add-btn">+ ${esc(txt("Ajouter", "Add"))}</button>
        </div>
        <div class="tb-sport-session-editor-list">
          ${plan.map((item, idx) => {
            const range = progressionRepRange(item) || { min: n(item.targetReps, 8), max: n(item.targetReps, 8) };
            const seconds = Math.max(1, Math.round(n(item.targetSeconds, item.timeMin || 45)));
            return `<div class="tb-sport-session-editor-row" data-sport-session-editor-row data-index="${idx}">
              <div class="tb-sport-session-editor-row-head">
                <strong>${idx + 1}. ${esc(sessionExerciseName(item))}</strong>
                <div class="tb-sport-actions">
                  <button class="btn small" type="button" data-sport-session-editor-move="${idx}" data-dir="-1">↑</button>
                  <button class="btn small" type="button" data-sport-session-editor-move="${idx}" data-dir="1">↓</button>
                  <button class="btn small danger" type="button" data-sport-session-editor-remove="${idx}">${esc(txt("Supprimer", "Delete"))}</button>
                </div>
              </div>
              <div class="tb-sport-session-editor-grid">
                <label><span>${esc(txt("Nom exercice", "Exercise name"))}</span><input data-field="name" value="${esc(sessionExerciseName(item))}"></label>
                <label><span>${esc(txt("Materiel", "Equipment"))}</span><select data-field="equipment">${equipmentOptions(item.equipment || "bodyweight")}</select></label>
                <label><span>${esc(txt("Mode", "Mode"))}</span><select data-field="mode"><option value="reps" ${item.mode === "reps" ? "selected" : ""}>${esc(txt("Reps", "Reps"))}</option><option value="time" ${item.mode === "time" ? "selected" : ""}>${esc(txt("Temps", "Time"))}</option></select></label>
                <label><span>${esc(txt("Series", "Sets"))}</span><input data-field="sets" type="number" min="1" value="${esc(String(Math.max(1, Math.round(n(item.sets, 1)))))}"></label>
                <label><span>${esc(txt("Reps min", "Min reps"))}</span><input data-field="repMin" type="number" min="1" value="${esc(String(Math.max(1, Math.round(n(range.min, item.targetReps || 8)))))}"></label>
                <label><span>${esc(txt("Reps max", "Max reps"))}</span><input data-field="repMax" type="number" min="1" value="${esc(String(Math.max(1, Math.round(n(range.max, range.min || 8)))))}"></label>
                <label><span>${esc(txt("Secondes", "Seconds"))}</span><input data-field="seconds" type="number" min="1" value="${esc(String(seconds))}"></label>
                <label><span>${esc(txt("Temps min", "Min time"))}</span><input data-field="timeMin" type="number" min="1" value="${esc(String(Math.max(1, Math.round(n(item.timeMin, seconds)))))}"></label>
                <label><span>${esc(txt("Temps max", "Max time"))}</span><input data-field="timeMax" type="number" min="1" value="${esc(String(Math.max(1, Math.round(n(item.timeMax, item.timeMin || seconds)))))}"></label>
                <label><span>${esc(txt("Repos sec", "Rest sec"))}</span><input data-field="rest" type="number" min="0" value="${esc(String(restSecondsForItem(item)))}"></label>
                <label><span>${esc(txt("Charge kg", "Load kg"))}</span><input data-field="weight" type="number" step="0.5" min="0" value="${esc(String(Math.round(n(item.weightKg, 0) * 10) / 10))}"></label>
                <label><span>${esc(txt("Libelle charge", "Load label"))}</span><input data-field="loadLabel" value="${esc(item.loadLabel || "")}" placeholder="${esc(txt("ex: 2 x 16 kg", "e.g. 2 x 16 kg"))}"></label>
                <label class="wide"><span>${esc(txt("Notes", "Notes"))}</span><input data-field="notes" value="${esc(item.notes || "")}"></label>
              </div>
            </div>`;
          }).join("")}
        </div>`;
  }
  function bindSessionEditor(root) {
    if (!root) return;
    root.querySelectorAll("[data-sport-session-editor-close]").forEach(btn => {
      btn.onclick = () => sessionEditorModal?.close();
    });
    const save = root.querySelector("#sport-session-editor-save");
    if (save) save.onclick = () => {
      if (saveSessionEditorFromDom(root)) renderSport("session-editor-save");
    };
    const loadCurrent = root.querySelector("#sport-session-editor-load-current");
    if (loadCurrent) loadCurrent.onclick = () => {
      const editor = readSessionEditorFromDom(root);
      if (!editor?.plan?.length) return;
      CACHE.plan = clonePlan(editor.plan);
      CACHE.editingPlanIndex = null;
      CACHE.sessionEditor = null;
      savePlan();
      sportFeedback(txt("Seance chargee", "Workout loaded"), editor.name || "", { toast: true });
      renderSport("session-editor-load-current");
    };
    const add = root.querySelector("#sport-session-editor-add-btn");
    if (add) add.onclick = () => {
      mutateSessionEditorFromDom(root, editor => {
        const key = root.querySelector("#sport-session-editor-add-ex")?.value || "";
        const ex = EXERCISE_LIBRARY.find(row => row.key === key) || EXERCISE_LIBRARY[0];
        editor.plan.push(libraryToPlanItem(ex));
      });
      renderSport("session-editor-add");
    };
    root.querySelectorAll("[data-sport-session-editor-remove]").forEach(btn => {
      btn.onclick = () => {
        const idx = Math.round(n(btn.getAttribute("data-sport-session-editor-remove"), -1));
        mutateSessionEditorFromDom(root, editor => {
          if (idx >= 0 && idx < editor.plan.length) editor.plan.splice(idx, 1);
          if (!editor.plan.length) editor.plan.push(quickPlanItem("pushup"));
        });
        renderSport("session-editor-remove");
      };
    });
    root.querySelectorAll("[data-sport-session-editor-move]").forEach(btn => {
      btn.onclick = () => {
        const idx = Math.round(n(btn.getAttribute("data-sport-session-editor-move"), -1));
        const dir = Math.round(n(btn.getAttribute("data-dir"), 0));
        mutateSessionEditorFromDom(root, editor => {
          const next = idx + dir;
          if (idx < 0 || next < 0 || idx >= editor.plan.length || next >= editor.plan.length) return;
          const current = editor.plan[idx];
          editor.plan[idx] = editor.plan[next];
          editor.plan[next] = current;
        });
        renderSport("session-editor-move");
      };
    });
    const syncDraft = () => { readSessionEditorFromDom(root); };
    root.addEventListener("input", syncDraft);
    root.addEventListener("change", syncDraft);
  }
  function syncSessionEditorPortal() {
    if (sessionEditorModal) {
      sessionEditorModal.destroy();
      sessionEditorModal = null;
    }
    if (!CACHE.sessionEditor || !document?.body) return;
    sessionEditorModal = window.UI?.createModal?.({
      id: "tb-sport-session-editor-modal",
      size: "xl",
      panelClass: "tb-sport-session-editor",
      title: txt("Seance parametree", "Configured workout"),
      subtitle: txt("Modifie la seance sans toucher a la seance en cours. Sauvegarde quand tout est pret.", "Edit the workout without touching the current workout. Save when ready."),
      closeLabel: txt("Fermer", "Close"),
      initialFocus: "#sport-session-editor-name",
      contentHTML: renderSessionEditorModal(),
      actionsHTML: `<button class="btn" type="button" data-sport-session-editor-close>${esc(txt("Annuler", "Cancel"))}</button><button class="btn" type="button" id="sport-session-editor-load-current">${esc(txt("Charger dans la seance courante", "Load into current workout"))}</button><button class="btn primary" type="button" id="sport-session-editor-save">${esc(txt("Enregistrer", "Save"))}</button>`,
      onClose: () => {
        sessionEditorModal = null;
        closeSessionFavoriteEditor();
      },
    }) || null;
    if (sessionEditorModal) bindSessionEditor(sessionEditorModal.root);
  }
  function renderSessionFavorites() {
    const rows = sessionFavoriteRows();
    const program = CACHE.program || loadSportProgram();
    const sourceLabel = CACHE.programSource === "sql" ? txt("Synchronise SQL", "SQL synced") : txt("Fallback local", "Local fallback");
    return `<div class="tb-sport-simple" style="margin-top:12px;">
      <div class="tb-sport-simple-title">
        <div>
          <strong>${esc(txt("Seances favorites", "Favorite workouts"))}</strong>
          <div class="muted">${esc(txt("Programme prise de masse A/B : lundi, mercredi, vendredi, puis alternance.", "A/B lean bulk program: Monday, Wednesday, Friday, then rotate."))} · ${esc(sourceLabel)}</div>
        </div>
        <div class="tb-sport-actions">
          <button class="btn" type="button" id="sport-new-session-favorite">+ ${esc(txt("Nouvelle seance", "New workout"))}</button>
          <button class="btn" type="button" id="sport-activate-mass-program">${program.enabled ? esc(txt("Planning actif", "Program active")) : esc(txt("Activer planning", "Activate program"))}</button>
        </div>
      </div>
      ${renderPlannedSportWeek(rows, program)}
      ${renderProgramSettings(program)}
      <div class="tb-sport-library-grid">
        ${rows.map(row => {
          const custom = loadCustomSessionFavorites().some(customRow => String(customRow.id || "") === String(row.id || ""));
          return `<div class="btn" style="display:grid;text-align:left;gap:8px;">
            <div><strong>${esc(row.name)}</strong><br>
            <small class="muted">${esc(row.week ? `${txt("Semaine", "Week")} ${row.week} · ` : "")}${esc((row.days || []).join(", "))} · ${row.plan.length} ${esc(txt("exercices", "exercises"))}${custom ? ` · ${esc(txt("modifiee", "customized"))}` : ""}</small></div>
            <div class="tb-sport-actions">
              <button class="btn small primary" type="button" data-sport-load-session-favorite="${esc(row.id)}">${esc(txt("Charger", "Load"))}</button>
              <button class="btn small" type="button" data-sport-open-session-editor="${esc(row.id)}">${esc(txt("Parametrer", "Configure"))}</button>
              ${custom ? `<button class="btn small" type="button" data-sport-reset-session-favorite="${esc(row.id)}">${esc(txt("Reset", "Reset"))}</button>` : ""}
            </div>
          </div>`;
        }).join("")}
      </div>
      <div class="muted" style="font-size:12px;margin-top:8px;">${esc(txt("Progression : chaque exercice utilise sa propre plage de reps. Exemple 6-10, 10-15 ou 12-20.", "Progression: each exercise uses its own rep range, e.g. 6-10, 10-15 or 12-20."))}</div>
    </div>`;
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
      .tb-sport-card-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;margin-bottom:10px;}
      .tb-sport-profile-grid{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(280px,.65fr);gap:14px;}
      .tb-sport-radar-wrap{display:grid;grid-template-columns:minmax(230px,320px) minmax(0,1fr);gap:14px;align-items:center;}
      .tb-sport-radar{width:100%;max-width:320px;min-height:230px;}
      .tb-sport-radar text{font-size:12px;font-weight:950;fill:#334155;}
      .tb-sport-radar-side{display:grid;gap:9px;}
      .tb-sport-radar-side strong{font-size:18px;color:#0f172a;}
      .tb-sport-radar-side small{color:#64748b;font-weight:800;line-height:1.35;}
      .tb-sport-radar-bars{display:grid;gap:7px;}
      .tb-sport-radar-bars div{position:relative;border:1px solid rgba(148,163,184,.18);border-radius:14px;background:#f8fafc;min-height:34px;overflow:hidden;padding:8px 42px 8px 10px;}
      .tb-sport-radar-bars b{position:absolute;inset:0 auto 0 0;background:linear-gradient(90deg,rgba(34,197,94,.20),rgba(14,165,233,.22));border-radius:14px;z-index:0;}
      .tb-sport-radar-bars span,.tb-sport-radar-bars em{position:relative;z-index:1;font-size:12px;font-weight:950;color:#0f172a;font-style:normal;}
      .tb-sport-radar-bars em{position:absolute;right:10px;top:50%;transform:translateY(-50%);color:#2563eb;}
      .tb-sport-body-kpis{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;}
      .tb-sport-body-kpis>div{border:1px solid rgba(14,165,233,.16);border-radius:16px;background:linear-gradient(180deg,#f0f9ff,#fff);padding:10px;min-width:0;}
      .tb-sport-body-kpis span{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#64748b;font-weight:950;}
      .tb-sport-body-kpis strong{display:block;margin-top:5px;font-size:19px;color:#0f172a;line-height:1.05;overflow-wrap:anywhere;}
      .tb-sport-athletic{display:grid;gap:10px;margin-top:12px;border:1px solid rgba(37,99,235,.14);border-radius:18px;background:linear-gradient(135deg,#f8fafc,#ecfeff);padding:12px;}
      .tb-sport-athletic-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;}
      .tb-sport-athletic-head strong{display:block;font-size:18px;color:#0f172a;font-weight:950;}
      .tb-sport-athletic-head small{display:block;margin-top:3px;color:#64748b;font-weight:850;line-height:1.35;}
      .tb-sport-athletic-priority{border:1px solid rgba(14,165,233,.22);background:#fff;border-radius:14px;padding:8px 10px;color:#075985;font-weight:950;font-size:12px;max-width:260px;}
      .tb-sport-athletic-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;}
      .tb-sport-athletic-panel{display:grid;gap:5px;border:1px solid rgba(148,163,184,.16);border-radius:14px;background:rgba(255,255,255,.78);padding:10px;min-width:0;}
      .tb-sport-athletic-panel b{color:#0f172a;font-size:13px;}
      .tb-sport-athletic-panel span{font-size:12px;font-weight:850;line-height:1.35;color:#334155;}
      .tb-sport-athletic-panel .ok{color:#047857;}
      .tb-sport-athletic-panel .warn{color:#b45309;}
      .tb-sport-athletic-metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px;}
      .tb-sport-athletic-metrics>div{border:1px solid rgba(14,165,233,.16);border-radius:14px;background:#fff;padding:9px;}
      .tb-sport-athletic-metrics span,.tb-sport-athletic-metrics small{display:block;color:#64748b;font-size:11px;font-weight:850;}
      .tb-sport-athletic-metrics strong{display:block;color:#0f172a;font-size:18px;font-weight:950;margin:2px 0;}
      .tb-sport-athletic-balance{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;}
      .tb-sport-athletic-balance>div{border-radius:14px;background:#dbeafe;color:#1e3a8a;padding:9px 10px;font-weight:950;}
      .tb-sport-athletic-balance span{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#3b82f6;}
      .tb-sport-archetypes{display:grid;gap:7px;}
      .tb-sport-archetypes div{display:grid;grid-template-columns:96px minmax(0,1fr) 32px;align-items:center;gap:8px;font-size:12px;font-weight:950;color:#0f172a;}
      .tb-sport-archetypes b{height:10px;border-radius:999px;background:#e2e8f0;overflow:hidden;}
      .tb-sport-archetypes i{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#2563eb,#06b6d4,#22c55e);}
      .tb-sport-archetypes em{font-style:normal;color:#2563eb;text-align:right;}
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
      html.tb-sport-focus-lock,body.tb-sport-focus-lock{overflow:hidden!important;height:100%!important;overscroll-behavior:none!important;touch-action:none!important;}
      body.tb-sport-focus-lock .wrap,body.tb-sport-focus-lock #app,body.tb-sport-focus-lock main{overflow:hidden!important;max-height:100dvh!important;}
      body.tb-sport-focus-lock .mobile-bottom-nav,body.tb-sport-focus-lock .tabbar,body.tb-sport-focus-lock .tabs{display:none!important;}
      .tb-sport-timer{min-height:300px;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;gap:12px;border-radius:24px;background:radial-gradient(circle at 50% 0%,rgba(37,99,235,.18),transparent 38%),#0f172a;color:white;padding:18px;}
      .tb-sport-timer .kind{font-size:12px;text-transform:uppercase;letter-spacing:.12em;color:#93c5fd;font-weight:950;}
      .tb-sport-timer .name{font-size:34px;font-weight:950;line-height:1.05;}
      .tb-sport-timer .clock{font-size:56px;font-weight:950;letter-spacing:-.05em;}
      .tb-sport-timer .hint{color:#cbd5e1;font-weight:800;}
      .tb-sport-timer-card.focus{position:fixed;inset:0;z-index:100040;border-radius:0!important;padding:calc(8px + env(safe-area-inset-top,0px)) calc(8px + env(safe-area-inset-right,0px)) calc(8px + env(safe-area-inset-bottom,0px)) calc(8px + env(safe-area-inset-left,0px))!important;overflow:hidden;background:#020617;box-sizing:border-box;width:100vw;height:100dvh;max-width:100vw;max-height:100dvh;}
      .tb-sport-timer-card.focus h3{display:none;}
      .tb-sport-timer-card.focus .tb-sport-timer{height:calc(100dvh - 16px - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px));max-height:calc(100dvh - 16px - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px));min-height:0;border-radius:20px;box-sizing:border-box;display:grid;grid-template-rows:auto minmax(0,1fr) auto;overflow:hidden;gap:clamp(7px,1.2vh,14px);}
      .tb-sport-timer-card.focus .tb-sport-live-main{grid-template-columns:minmax(0,1.35fr) minmax(280px,.65fr);}
      .tb-sport-timer-card.focus .tb-sport-live-focus,.tb-sport-timer-card.focus .tb-sport-live-panel{min-height:0;overflow:hidden;}
      .tb-sport-timer-card.focus .tb-sport-live-focus .name{font-size:clamp(34px,5vw,74px);}
      .tb-sport-timer-card.focus .tb-sport-timer .clock{font-size:clamp(76px,12vw,170px);line-height:.9;}
      .tb-sport-timer-card.focus .tb-sport-live-kpi strong{font-size:clamp(18px,2.1vw,28px);}
      .tb-sport-timer-v2{align-items:stretch;text-align:left;justify-content:flex-start;background:linear-gradient(145deg,#07111f,#0f172a 48%,#0b3b57);overflow:hidden;position:relative;}
      .tb-sport-timer-v2:before{content:"";position:absolute;inset:-80px -40px auto auto;width:210px;height:210px;border-radius:50%;background:rgba(56,189,248,.18);filter:blur(10px);}
      .tb-sport-live-head{position:relative;display:flex;justify-content:space-between;gap:12px;align-items:flex-start;z-index:1;}
      .tb-sport-live-main{position:relative;z-index:1;display:grid;grid-template-columns:minmax(0,1.05fr) minmax(230px,.95fr);gap:12px;align-items:stretch;}
      .tb-sport-live-focus{border:1px solid rgba(255,255,255,.14);border-radius:20px;background:rgba(255,255,255,.08);padding:14px;display:grid;gap:8px;}
      .tb-sport-live-focus .name{font-size:30px;}
      .tb-sport-live-panel{border:1px solid rgba(255,255,255,.14);border-radius:20px;background:rgba(255,255,255,.07);padding:12px;display:grid;gap:9px;}
      .tb-sport-live-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;}
      .tb-sport-live-kpi{border:1px solid rgba(255,255,255,.12);border-radius:14px;background:rgba(255,255,255,.07);padding:9px;}
      .tb-sport-live-kpi span{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#bfdbfe;font-weight:900;}
      .tb-sport-live-kpi strong{display:block;margin-top:4px;color:white;font-size:16px;overflow-wrap:anywhere;}
      .tb-sport-timeline{position:relative;z-index:1;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px;margin-top:2px;}
      .tb-sport-time-step{border:1px solid rgba(255,255,255,.12);border-radius:13px;background:rgba(255,255,255,.06);padding:8px;min-height:54px;display:grid;gap:3px;color:#e0f2fe;}
      .tb-sport-time-step.active{border-color:#38bdf8;background:rgba(14,165,233,.20);}
      .tb-sport-time-step small{color:#93c5fd;font-weight:900;text-transform:uppercase;font-size:9px;}
      .tb-sport-time-step b{font-size:11px;line-height:1.15;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;}
      .tb-sport-control-row{display:flex;align-items:center;gap:8px;justify-content:flex-start;flex-wrap:wrap;}
      .tb-sport-control-row input{width:86px;min-height:34px;border-radius:999px;border:1px solid rgba(255,255,255,.24);background:rgba(255,255,255,.12);color:white;text-align:center;font-weight:900;}
      .tb-sport-volume-row{position:relative;z-index:1;display:flex;align-items:center;justify-content:center;gap:9px;flex-wrap:wrap;color:#dbeafe;font-weight:900;}
      .tb-sport-volume-row input[type="range"]{width:min(220px,48vw);accent-color:#38bdf8;}
      .tb-sport-next{border-radius:16px;padding:9px 11px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);color:#dbeafe;font-weight:850;}
      .tb-sport-modal-backdrop{position:fixed;inset:0;z-index:9998;background:rgba(15,23,42,.58);backdrop-filter:blur(14px);display:flex;align-items:center;justify-content:center;padding:18px;}
      .tb-sport-modal{width:min(560px,100%);border-radius:26px;background:linear-gradient(180deg,#fff,#f8fafc);box-shadow:0 30px 80px rgba(15,23,42,.28);border:1px solid rgba(148,163,184,.24);padding:18px;}
      .tb-sport-modal h3{margin:0 0 6px;font-size:22px;}
      .tb-sport-body-modal-backdrop{z-index:100050;align-items:flex-start;overflow:auto;padding:calc(16px + env(safe-area-inset-top,0px)) 14px calc(20px + env(safe-area-inset-bottom,0px));}
      .tb-sport-body-modal{max-height:calc(100dvh - 36px - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px));overflow:auto;-webkit-overflow-scrolling:touch;}
      .tb-sport-session-editor-meta,.tb-sport-session-editor-add{display:grid;grid-template-columns:1.5fr .55fr 1fr;gap:10px;margin-bottom:12px;}
      .tb-sport-session-editor-add{grid-template-columns:minmax(0,1fr) auto;align-items:end;border:1px solid rgba(37,99,235,.12);border-radius:16px;background:#eff6ff;padding:10px;}
      .tb-sport-session-editor label{display:grid;gap:5px;min-width:0;}
      .tb-sport-session-editor label span{font-size:11px;text-transform:uppercase;letter-spacing:.06em;font-weight:900;color:#64748b;}
      .tb-sport-session-editor input,.tb-sport-session-editor select{width:100%;box-sizing:border-box;border:1px solid rgba(148,163,184,.32);border-radius:12px;background:#fff;color:#0f172a;padding:9px 10px;font-weight:800;min-width:0;}
      .tb-sport-session-editor-list{display:grid;gap:10px;}
      .tb-sport-session-editor-row{border:1px solid rgba(148,163,184,.20);border-radius:18px;background:#fff;padding:12px;box-shadow:0 10px 24px rgba(15,23,42,.05);}
      .tb-sport-session-editor-row-head{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:10px;}
      .tb-sport-session-editor-row-head strong{font-size:16px;color:#0f172a;line-height:1.2;}
      .tb-sport-session-editor-grid{display:grid;grid-template-columns:1.25fr .75fr .62fr .55fr .55fr .55fr .6fr .6fr .6fr .58fr .58fr .8fr;gap:8px;align-items:end;}
      .tb-sport-session-editor-grid .wide{grid-column:span 2;}
      .tb-sport-choice-row{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0;}
      .tb-sport-choice{border:1px solid rgba(148,163,184,.28);border-radius:999px;background:#fff;padding:9px 12px;font-weight:900;cursor:pointer;}
      .tb-sport-choice.active{background:linear-gradient(135deg,#1d4ed8,#0891b2);color:white;border-color:transparent;}
      .tb-sport-history{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:10px;}
      .tb-sport-history-card{border:1px solid rgba(148,163,184,.18);border-radius:18px;background:#fff;padding:12px;}
      .tb-sport-session-details{margin-top:10px;border-top:1px solid rgba(148,163,184,.20);padding-top:10px;}
      .tb-sport-session-details summary{cursor:pointer;font-weight:950;color:#0f172a;}
      .tb-sport-session-content{display:grid;gap:8px;margin-top:9px;}
      .tb-sport-session-exercise{border:1px solid rgba(148,163,184,.18);border-radius:14px;background:#f8fafc;padding:10px;}
      .tb-sport-session-setline{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;}
      .tb-sport-session-setline span{border-radius:999px;background:#e0f2fe;color:#075985;padding:4px 8px;font-size:11px;font-weight:900;}
      .tb-sport-week{border:1px solid rgba(14,165,233,.18);border-radius:18px;padding:12px;background:linear-gradient(135deg,rgba(37,99,235,.10),rgba(34,197,94,.08)),#f8fafc;margin-top:10px;}
      .tb-sport-week-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:7px;align-items:end;margin-top:10px;}
      .tb-sport-week-day{border:0;background:transparent;color:inherit;padding:0;display:grid;gap:5px;align-items:end;min-width:0;}
      .tb-sport-week-bar{height:12px;border-radius:10px 10px 5px 5px;background:linear-gradient(180deg,#cbd5e1,#94a3b8);box-shadow:0 8px 18px rgba(15,23,42,.10);}
      .tb-sport-week-day.active .tb-sport-week-bar{background:linear-gradient(180deg,#22c55e,#2563eb);}
      .tb-sport-week-day strong{font-size:11px;line-height:1;}
      .tb-sport-week-day small{font-size:10px;color:#64748b;font-weight:850;}
      .tb-sport-planned-week{border:1px solid rgba(37,99,235,.14);border-radius:18px;background:linear-gradient(135deg,rgba(14,165,233,.10),rgba(34,197,94,.07));padding:12px;margin:12px 0;}
      .tb-sport-program-cockpit{border:1px solid rgba(15,23,42,.08);border-radius:20px;background:linear-gradient(135deg,#ffffff,#eef6ff 52%,#ecfdf5);box-shadow:0 16px 40px rgba(15,23,42,.08);padding:14px;margin-bottom:12px;display:grid;gap:12px;}
      .tb-sport-program-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;}
      .tb-sport-program-head span,.tb-sport-program-focus span{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#2563eb;font-weight:950;}
      .tb-sport-program-head strong{display:block;font-size:24px;line-height:1;color:#0f172a;margin-top:3px;}
      .tb-sport-program-head small,.tb-sport-program-focus small{display:block;margin-top:5px;color:#64748b;font-weight:800;line-height:1.35;}
      .tb-sport-program-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;}
      .tb-sport-program-kpis>div{border:1px solid rgba(148,163,184,.18);border-radius:15px;background:rgba(255,255,255,.82);padding:10px;min-width:0;}
      .tb-sport-program-kpis span{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#64748b;font-weight:950;}
      .tb-sport-program-kpis strong{display:block;margin-top:5px;font-size:17px;color:#0f172a;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      .tb-sport-program-kpis small{display:block;margin-top:4px;color:#64748b;font-size:11px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      .tb-sport-program-catchup{display:flex;justify-content:space-between;gap:10px;align-items:center;border:1px solid rgba(245,158,11,.24);border-radius:16px;background:#fffbeb;padding:10px 12px;color:#92400e;}
      .tb-sport-program-catchup strong{display:block;color:#78350f;}
      .tb-sport-program-catchup small{display:block;margin-top:2px;font-weight:800;color:#92400e;}
      .tb-sport-program-focus{display:grid;grid-template-columns:minmax(0,1fr) minmax(210px,.8fr);gap:12px;align-items:center;border:1px solid rgba(37,99,235,.16);border-radius:18px;background:linear-gradient(135deg,rgba(37,99,235,.10),rgba(14,165,233,.06)),#fff;padding:12px;}
      .tb-sport-program-focus strong{display:block;font-size:20px;color:#0f172a;margin-top:2px;}
      .tb-sport-program-focus em{font-style:normal;color:#1d4ed8;font-weight:900;line-height:1.35;font-size:13px;}
      .tb-sport-program-loads{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;}
      .tb-sport-program-loads>div{border:1px solid rgba(148,163,184,.18);border-radius:15px;background:#fff;padding:10px;min-width:0;}
      .tb-sport-program-loads span{display:block;color:#64748b;font-size:11px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      .tb-sport-program-loads strong{display:block;color:#0f172a;font-size:19px;margin-top:4px;line-height:1;}
      .tb-sport-program-loads small{display:block;color:#64748b;font-weight:800;font-size:11px;margin-top:5px;line-height:1.25;}
      .tb-sport-program-progression{border:1px solid rgba(34,197,94,.18);border-radius:18px;background:linear-gradient(180deg,#f0fdf4,#fff);padding:12px;display:grid;gap:8px;}
      .tb-sport-program-progression>strong{font-size:14px;color:#14532d;}
      .tb-sport-program-progression>div{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(180px,.9fr);gap:8px;align-items:center;border-top:1px solid rgba(34,197,94,.12);padding-top:8px;}
      .tb-sport-program-progression span{font-weight:950;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      .tb-sport-program-progression small{color:#64748b;font-weight:850;white-space:nowrap;}
      .tb-sport-program-progression b{font-size:12px;color:#15803d;text-align:right;}
      .tb-sport-planned-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:8px;margin-top:10px;}
      .tb-sport-planned-next{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;border:1px solid rgba(37,99,235,.18);border-radius:16px;background:linear-gradient(135deg,rgba(37,99,235,.12),rgba(34,197,94,.08)),#fff;padding:12px;margin-top:10px;}
      .tb-sport-planned-next strong{display:block;font-size:18px;color:#0f172a;margin:2px 0;}
      .tb-sport-planned-next small,.tb-sport-planned-next em{display:block;font-size:12px;color:#475569;line-height:1.35;}
      .tb-sport-planned-next em{font-style:normal;margin-top:4px;font-weight:850;color:#2563eb;}
      .tb-sport-planned-day{border:1px solid rgba(148,163,184,.22);border-radius:15px;background:#fff;color:#0f172a;min-height:92px;padding:9px 7px;display:grid;grid-template-rows:auto auto 1fr;gap:5px;text-align:left;cursor:pointer;min-width:0;}
      .tb-sport-planned-day span{font-size:10px;font-weight:950;text-transform:uppercase;color:#64748b;}
      .tb-sport-planned-day strong{font-size:16px;line-height:1.05;color:#0f172a;}
      .tb-sport-planned-day small{font-size:10px;line-height:1.15;color:#64748b;font-weight:850;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;}
      .tb-sport-planned-day.planned{border-color:rgba(37,99,235,.24);background:linear-gradient(180deg,#eff6ff,#fff);box-shadow:0 10px 24px rgba(37,99,235,.10);}
      .tb-sport-planned-day.rest{background:#f8fafc;}
      .tb-sport-planned-day.today{outline:3px solid rgba(34,197,94,.22);border-color:rgba(34,197,94,.45);}
      .tb-sport-status{border:1px solid rgba(14,165,233,.18);border-radius:16px;background:#e0f2fe;color:#075985;padding:10px 12px;font-weight:850;}
      body.theme-dark .tb-sport-card,body.theme-dark .tb-sport-item,body.theme-dark .tb-sport-history-card{background:#111827;color:#f8fafc;border-color:rgba(255,255,255,.12);}
      body.theme-dark .tb-sport-stat{background:#111827;border-color:rgba(255,255,255,.12);}
      body.theme-dark .tb-sport-stat strong{color:#f8fafc;}
      body.theme-dark .tb-sport-radar text{fill:#cbd5e1;}
      body.theme-dark .tb-sport-radar-side strong,body.theme-dark .tb-sport-radar-bars span,body.theme-dark .tb-sport-body-kpis strong{color:#f8fafc;}
      body.theme-dark .tb-sport-radar-bars div,body.theme-dark .tb-sport-body-kpis>div{background:#0f172a;border-color:rgba(255,255,255,.12);}
      body.theme-dark .tb-sport-body-kpis>div{background:linear-gradient(180deg,rgba(14,165,233,.12),#0f172a);}
      body.theme-dark .tb-sport-athletic{background:linear-gradient(135deg,rgba(15,23,42,.95),rgba(8,47,73,.45));border-color:rgba(125,211,252,.18);}
      body.theme-dark .tb-sport-athletic-head strong,body.theme-dark .tb-sport-athletic-panel b,body.theme-dark .tb-sport-athletic-metrics strong,body.theme-dark .tb-sport-archetypes div{color:#f8fafc;}
      body.theme-dark .tb-sport-athletic-panel,body.theme-dark .tb-sport-athletic-metrics>div,body.theme-dark .tb-sport-athletic-priority{background:#0f172a;border-color:rgba(255,255,255,.12);}
      body.theme-dark .tb-sport-athletic-balance>div{background:rgba(37,99,235,.18);color:#bfdbfe;}
      body.theme-dark .tb-sport-status{background:rgba(14,165,233,.14);color:#bae6fd;border-color:rgba(125,211,252,.20);}
      body.theme-dark .tb-sport-profile-note{background:rgba(14,165,233,.14);color:#bae6fd;border-color:rgba(125,211,252,.20);}
      body.theme-dark .tb-sport-library{background:rgba(14,165,233,.08);border-color:rgba(125,211,252,.18);}
      body.theme-dark .tb-sport-smart{background:rgba(37,99,235,.10);border-color:rgba(147,197,253,.16);}
      body.theme-dark .tb-sport-simple{background:rgba(14,165,233,.08);border-color:rgba(125,211,252,.18);}
      body.theme-dark .tb-sport-ex-card{background:#0f172a;color:#f8fafc;border-color:rgba(255,255,255,.12);}
      body.theme-dark .tb-sport-ex-card span{color:#94a3b8;}
      body.theme-dark .tb-sport-modal{background:linear-gradient(180deg,#111827,#0f172a);color:#f8fafc;border-color:rgba(255,255,255,.12);}
      body.theme-dark .tb-sport-session-editor-row-head strong{color:#f8fafc;}
      body.theme-dark .tb-sport-session-editor-row{background:#0f172a;border-color:rgba(255,255,255,.12);}
      body.theme-dark .tb-sport-session-editor-add{background:rgba(37,99,235,.14);border-color:rgba(125,211,252,.16);}
      body.theme-dark .tb-sport-session-editor input,body.theme-dark .tb-sport-session-editor select{background:#0f172a;color:#f8fafc;border-color:rgba(255,255,255,.14);}
      body.theme-dark .tb-sport-choice{background:#0f172a;color:#f8fafc;border-color:rgba(255,255,255,.14);}
      body.theme-dark .tb-sport-quick-btn{background:#0f172a;color:#f8fafc;border-color:rgba(255,255,255,.14);}
      body.theme-dark .tb-sport-advanced{background:rgba(15,23,42,.72);border-color:rgba(255,255,255,.12);}
      body.theme-dark .tb-sport-advanced summary{color:#f8fafc;}
      body.theme-dark .tb-sport-week{background:rgba(14,165,233,.08);border-color:rgba(125,211,252,.18);}
      body.theme-dark .tb-sport-week-day small{color:#94a3b8;}
      body.theme-dark .tb-sport-planned-week{background:rgba(14,165,233,.08);border-color:rgba(125,211,252,.18);}
      body.theme-dark .tb-sport-program-cockpit{background:linear-gradient(135deg,#0f172a,#082f49 55%,#052e2b);border-color:rgba(125,211,252,.16);}
      body.theme-dark .tb-sport-program-head strong,body.theme-dark .tb-sport-program-kpis strong,body.theme-dark .tb-sport-program-focus strong,body.theme-dark .tb-sport-program-loads strong,body.theme-dark .tb-sport-program-progression span{color:#f8fafc;}
      body.theme-dark .tb-sport-program-kpis>div,body.theme-dark .tb-sport-program-focus,body.theme-dark .tb-sport-program-loads>div{background:rgba(15,23,42,.74);border-color:rgba(125,211,252,.14);}
      body.theme-dark .tb-sport-program-progression{background:rgba(20,83,45,.18);border-color:rgba(134,239,172,.16);}
      body.theme-dark .tb-sport-program-catchup{background:rgba(120,53,15,.22);border-color:rgba(251,191,36,.20);}
      body.theme-dark .tb-sport-planned-day{background:#0f172a;color:#f8fafc;border-color:rgba(255,255,255,.12);}
      body.theme-dark .tb-sport-planned-day strong{color:#f8fafc;}
      body.theme-dark .tb-sport-planned-day span,body.theme-dark .tb-sport-planned-day small{color:#94a3b8;}
      body.theme-dark .tb-sport-planned-day.planned{background:linear-gradient(180deg,rgba(37,99,235,.22),#0f172a);}
      body.theme-dark .tb-sport-session-details summary{color:#f8fafc;}
      body.theme-dark .tb-sport-session-exercise{background:#0f172a;border-color:rgba(255,255,255,.12);}
      body.theme-dark .tb-sport-field input,body.theme-dark .tb-sport-field select,body.theme-dark .tb-sport-field textarea{background:#0f172a;color:#f8fafc;border-color:rgba(255,255,255,.14);}
      @media(max-width:980px){.tb-sport-grid,.tb-sport-profile-grid,.tb-sport-radar-wrap{grid-template-columns:1fr}.tb-sport-radar{margin:auto}.tb-sport-fields,.tb-sport-profile{grid-template-columns:repeat(2,minmax(0,1fr))}.tb-sport-hero{flex-direction:column}.tb-sport-program-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.tb-sport-program-focus{grid-template-columns:1fr}.tb-sport-program-progression>div{grid-template-columns:1fr}.tb-sport-program-progression small,.tb-sport-program-progression b{text-align:left;white-space:normal;}.tb-sport-session-editor-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.tb-sport-session-editor-meta{grid-template-columns:1fr 120px 1fr}}
      @media(max-width:620px){.tb-sport-fields,.tb-sport-profile,.tb-sport-body-kpis,.tb-sport-athletic-grid,.tb-sport-athletic-balance{grid-template-columns:1fr}.tb-sport-athletic-head{flex-direction:column}.tb-sport-athletic-priority{max-width:none;width:100%;}.tb-sport-archetypes div{grid-template-columns:84px minmax(0,1fr) 28px}.tb-sport-radar-wrap{gap:8px}.tb-sport-radar{max-width:280px}.tb-sport-timer .clock{font-size:44px}.tb-sport-timer .name{font-size:26px}.tb-sport-live-main{grid-template-columns:1fr}.tb-sport-timeline{grid-template-columns:1fr 1fr}.tb-sport-live-head{flex-direction:column}.tb-sport-live-grid{grid-template-columns:1fr 1fr}.tb-sport-planned-next{grid-template-columns:1fr}.tb-sport-planned-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.tb-sport-planned-day{min-height:76px}.tb-sport-program-cockpit{padding:10px}.tb-sport-program-head strong{font-size:21px}.tb-sport-program-kpis{grid-template-columns:1fr 1fr}.tb-sport-program-loads{grid-template-columns:1fr 1fr}.tb-sport-program-catchup{align-items:flex-start;flex-direction:column}.tb-sport-session-editor-meta,.tb-sport-session-editor-add,.tb-sport-session-editor-grid{grid-template-columns:1fr}.tb-sport-session-editor-grid .wide{grid-column:auto}.tb-sport-session-editor-row-head{align-items:flex-start;flex-direction:column}.tb-sport-timer-card.focus .tb-sport-live-main{grid-template-columns:1fr;gap:8px}.tb-sport-timer-card.focus .tb-sport-timer{height:calc(100dvh - 16px);min-height:0;border-radius:18px;padding:10px}.tb-sport-timer-card.focus .tb-sport-timer .clock{font-size:clamp(58px,18vw,84px)}.tb-sport-timer-card.focus .tb-sport-live-focus .name{font-size:clamp(24px,7vw,34px)}.tb-sport-timer-card.focus .tb-sport-actions{width:100%;justify-content:space-between!important}.tb-sport-timer-card.focus .tb-sport-timeline{max-height:70px;overflow:hidden}}
      @media(max-height:700px){.tb-sport-timer-card.focus .tb-sport-timer{gap:7px;padding:10px}.tb-sport-timer-card.focus .tb-sport-timeline{display:none}.tb-sport-timer-card.focus .tb-sport-live-grid{gap:6px}.tb-sport-timer-card.focus .tb-sport-live-kpi{padding:8px}.tb-sport-timer-card.focus .tb-sport-volume-row{display:none}}
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
      body.tb-capacitor-app[data-tb-view="sport"] .tb-sport-live-main{grid-template-columns:1fr!important;gap:8px!important;}
      body.tb-capacitor-app[data-tb-view="sport"] .tb-sport-timeline{grid-template-columns:repeat(2,minmax(0,1fr))!important;}
      body.tb-capacitor-app[data-tb-view="sport"] .tb-sport-live-focus,.tb-sport-live-panel{border-radius:16px!important;padding:10px!important;}
      body.tb-capacitor-app[data-tb-view="sport"] .tb-sport-timer-card.focus{position:fixed!important;inset:0!important;z-index:100020!important;border-radius:0!important;padding:calc(8px + env(safe-area-inset-top,0px)) 8px calc(8px + env(safe-area-inset-bottom,0px))!important;background:#020617!important;overflow:hidden!important;box-sizing:border-box!important;}
      body.tb-capacitor-app[data-tb-view="sport"] .tb-sport-timer-card.focus .tb-sport-timer{height:calc(100dvh - 16px - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px))!important;min-height:0!important;border-radius:20px!important;padding:clamp(10px,2.4vw,20px)!important;overflow:hidden!important;display:grid!important;grid-template-rows:auto minmax(0,1fr) auto!important;}
      body.tb-capacitor-app[data-tb-view="sport"] .tb-sport-timer-card.focus .tb-sport-live-main{grid-template-columns:1fr!important;gap:12px!important;}
      body.tb-capacitor-app[data-tb-view="sport"] .tb-sport-timer-card.focus .tb-sport-live-head{flex-direction:row!important;align-items:flex-start!important;}
      body.tb-capacitor-app[data-tb-view="sport"] .tb-sport-timer-card.focus .tb-sport-timer .clock{font-size:clamp(88px,23vw,180px)!important;line-height:.9!important;letter-spacing:0!important;}
      body.tb-capacitor-app[data-tb-view="sport"] .tb-sport-timer-card.focus .tb-sport-live-focus .name{font-size:clamp(34px,9vw,72px)!important;line-height:1.02!important;}
      body.tb-capacitor-app[data-tb-view="sport"] .tb-sport-timer-card.focus .tb-sport-live-kpi strong{font-size:clamp(18px,5vw,28px)!important;}
      body.tb-capacitor-app[data-tb-view="sport"] .tb-sport-timer-card.focus .tb-sport-timeline{grid-template-columns:repeat(3,minmax(0,1fr))!important;}
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
      Object.assign(state, sportStore.appSnapshot());
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
      sportStore.hydrateOffline(state || {});
      CACHE.status = txt("Historique restaure hors ligne.", "History restored offline.");
      publishSportHistory("offline");
      return;
    }
    if (!c || !userId) {
      sportStore.hydrateRemote({ sessions: [], items: [], sets: [] }, loadPendingDeletes());
      CACHE.status = txt("Historique local uniquement pour le moment.", "Local history only for now.");
      publishSportHistory("local");
      return;
    }
    CACHE.loading = true;
    CACHE.error = "";
    try {
      await syncPendingSportDeletes(c, userId);
      const history = await sportRepository().loadHistory({
        tables: {
          sessions: table("sport_sessions"),
          items: table("sport_session_items"),
          sets: table("sport_sets"),
        },
        userId,
        limit: 20,
      });
      const pendingDeletes = new Set(loadPendingDeletes());
      sportStore.hydrateRemote(history, Array.from(pendingDeletes));
      CACHE.status = CACHE.sessions.length
        ? txt(`Historique synchronise : ${CACHE.sessions.length} seance(s) SQL.`, `Synced history: ${CACHE.sessions.length} SQL workout(s).`)
        : txt("Aucune seance SQL pour ce compte. Les seances locales restent visibles tant qu'elles ne sont pas synchronisees.", "No SQL workout for this account. Local workouts remain visible until synced.");
      publishSportHistory("load");
    } catch (e) {
      CACHE.error = e?.message || String(e);
      CACHE.loaded = true;
      if (isOfflineSkipError(CACHE.error)) {
        sportStore.hydrateOffline(state || {});
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
    const quickRows = quickExerciseRows(selectedEquipment);
    const baseExercise = rows[0] || visibleExercises(selectedEquipment, "")[0] || EXERCISE_LIBRARY[0];
    const manualActivity = editing?.activityKey || baseExercise?.activityKey || "strength";
    const manualEquipment = editing?.equipment || baseExercise?.equipment || "bodyweight";
    const manualMode = editing?.mode || baseExercise?.mode || "reps";
    const manualName = editing?.exerciseName || exerciseLabel(baseExercise) || "Push-up";
    const manualLoad = editing ? { weightKg: n(editing.weightKg, 0), loadLabel: editing.loadLabel || "" } : programLoadForExercise(manualName);
    const manualRest = editing ? restSecondsForItem(editing) : n(CACHE.globalRestSeconds, 60);
    const manualRepMin = n(editing?.repMin ?? editing?.targetReps, baseExercise?.repMin || baseExercise?.reps || 10);
    const manualRepMax = Math.max(manualRepMin, n(editing?.repMax, baseExercise?.repMax || manualRepMin));
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
        ${CACHE.editingSessionFavoriteId ? `<div class="tb-sport-status" style="margin-bottom:10px;">${esc(txt("Edition de seance favorite", "Editing favorite workout"))}: ${esc(CACHE.editingSessionFavoriteName || "")}</div>` : ""}
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
            ${quickRows.favs.map(ex => `<button class="tb-sport-quick-btn" type="button" data-sport-quick="${esc(ex.key)}">★ ${esc(exerciseLabel(ex))}</button>`).join("")}
            ${quickRows.recents.map(ex => `<button class="tb-sport-quick-btn" type="button" data-sport-quick="${esc(ex.key)}">↺ ${esc(exerciseLabel(ex))}</button>`).join("")}
          </div>
          <div class="tb-sport-fields">
            <div class="tb-sport-field"><label>${esc(txt("Famille", "Family"))}</label><select id="sport-library-family">${familyOptions(CACHE.builderFamily || "all")}</select></div>
            <div class="tb-sport-field"><label>${esc(txt("Materiel", "Equipment"))}</label><select id="sport-library-equipment">${libraryEquipmentOptions(selectedEquipment)}</select></div>
            <div class="tb-sport-field"><label>${esc(txt("Recherche", "Search"))}</label><input id="sport-ex-search" type="search" value="${esc(search)}" placeholder="${esc(txt("Ecris le nom", "Type a name"))}"></div>
            <div class="tb-sport-field"><label>${esc(txt("Exercice", "Exercise"))}</label><select id="sport-library-ex">${libraryOptions("free", selectedEquipment, matchedExercise?.key || baseExercise?.key || "")}</select></div>
            <div class="tb-sport-field"><label>${esc(txt("Memoire", "Memory"))}</label><button class="btn" type="button" id="sport-toggle-favorite" style="width:100%;">★ ${esc(txt("Favori", "Favorite"))}</button></div>
            <div class="tb-sport-field"><label>${esc(txt("Nom", "Name"))}</label><input id="sport-ex-name" value="${esc(manualName)}"></div>
            <input id="sport-activity" type="hidden" value="${esc(manualActivity)}">
            <input id="sport-equipment" type="hidden" value="${esc(manualEquipment)}">
            <div class="tb-sport-field"><label>${esc(txt("Mode", "Mode"))}</label><select id="sport-mode"><option value="reps" ${manualMode === "reps" ? "selected" : ""}>${esc(txt("Repetitions", "Reps"))}</option><option value="time" ${manualMode === "time" ? "selected" : ""}>${esc(txt("Temps", "Time"))}</option></select></div>
            <div class="tb-sport-field" id="sport-reps-wrap"><label>${esc(txt("Reps min", "Min reps"))}</label><input id="sport-rep-min" type="number" min="1" value="${esc(String(manualRepMin || 10))}"><input id="sport-reps" type="hidden" value="${esc(String(manualRepMin || 10))}"></div>
            <div class="tb-sport-field" id="sport-rep-max-wrap"><label>${esc(txt("Reps max", "Max reps"))}</label><input id="sport-rep-max" type="number" min="1" value="${esc(String(manualRepMax || manualRepMin || 10))}"></div>
            <div class="tb-sport-field" id="sport-seconds-wrap"><label>${esc(txt("Temps exercice sec", "Exercise time sec"))}</label><input id="sport-seconds" type="number" min="1" value="${esc(String(manualSeconds || 45))}"></div>
            <div class="tb-sport-field"><label>${esc(txt("Series", "Sets"))}</label><input id="sport-sets" type="number" min="1" value="${esc(String(manualSets || 3))}"></div>
            <div class="tb-sport-field"><label>${esc(txt("Repos apres serie sec", "Rest after set sec"))}</label><input id="sport-rest" type="number" min="0" value="${esc(String(manualRest || 60))}"></div>
            <input id="sport-intensity" type="hidden" value="${esc(editing?.intensity || "moderate")}">
            <div class="tb-sport-field"><label>${esc(txt("Charge kg optionnelle", "Optional load kg"))}</label><input id="sport-load" type="number" step="0.5" value="${esc(String(n(manualLoad.weightKg, 0)))}"><span id="sport-load-note" class="muted" style="font-size:12px;${manualLoad.loadLabel ? "" : "display:none;"}">${esc(manualLoad.loadLabel || "")}</span></div>
            <div class="tb-sport-field"><label>${esc(txt("Distance m optionnelle", "Optional distance m"))}</label><input id="sport-distance" type="number" value="${esc(String(n(editing?.distanceM, baseExercise?.distanceM || 0)))}"></div>
            <div class="tb-sport-field"><label>${esc(txt("Repos par defaut sec", "Default rest sec"))}</label><input id="sport-global-rest" type="number" min="0" value="${esc(String(n(CACHE.globalRestSeconds, 60)))}"></div>
          </div>
          <div class="tb-sport-actions" style="margin-top:12px;">
            <button class="btn primary" type="button" id="sport-add-item">${editing ? esc(txt("Mettre a jour", "Update")) : `+ ${esc(txt("Ajouter l'exercice", "Add exercise"))}`}</button>
            ${editing ? `<button class="btn" type="button" id="sport-cancel-edit">${esc(txt("Annuler", "Cancel"))}</button>` : ""}
            ${CACHE.editingSessionFavoriteId ? `<button class="btn" type="button" id="sport-save-session-favorite">${esc(txt("Enregistrer la seance parametree", "Save configured workout"))}</button><button class="btn" type="button" id="sport-cancel-session-favorite-edit">${esc(txt("Quitter edition seance", "Exit workout edit"))}</button>` : ""}
            <button class="btn" type="button" id="sport-clear">${esc(txt("Vider", "Clear"))}</button>
          </div>
        </div>
        ${renderSessionFavorites()}
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
    return CACHE.plan.map((item, idx) => {
      const range = progressionRepRange(item);
      const timeRange = item.mode === "time" && n(item.timeMax, 0) > n(item.timeMin || item.targetSeconds, 0)
        ? `${n(item.timeMin || item.targetSeconds, 0)}-${n(item.timeMax, 0)} sec`
        : "";
      return `<div class="tb-sport-item">
        <div>
          <div class="tb-sport-item-title">${idx + 1}. ${esc(item.exerciseName || labelActivity(item.activityKey))}</div>
          <div class="tb-sport-meta">
            <span class="tb-sport-chip">${esc(labelActivity(item.activityKey))}</span>
            <span class="tb-sport-chip">${esc(labelEquipment(item.equipment))}</span>
            ${supportsExternalLoad(item) && n(item.weightKg, 0) ? `<span class="tb-sport-chip">${Math.round(n(item.weightKg, 0) * 10) / 10} kg${item.loadLabel ? ` · ${esc(item.loadLabel)}` : ""}</span>` : item.loadLabel ? `<span class="tb-sport-chip">${esc(item.loadLabel)}</span>` : ""}
            <span class="tb-sport-chip">${item.mode === "time" ? `${n(item.targetSeconds,0)} sec` : (range && range.max > range.min ? `${range.min}-${range.max} reps` : `${n(item.targetReps,0)} reps`)}</span>
            ${range && range.max > range.min ? `<span class="tb-sport-chip">${esc(txt("Progression", "Progression"))} ${range.min}-${range.max}</span>` : ""}
            ${timeRange ? `<span class="tb-sport-chip">${esc(txt("Cible", "Target"))} ${esc(timeRange)}</span>` : ""}
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
      </div>`;
    }).join("");
  }

  function makeSequence() {
    return window.Core?.sportRules?.buildWorkoutSequence(CACHE.plan, {
      circuitEnabled: Boolean(CACHE.circuit?.enabled),
      rounds: CACHE.circuit?.rounds,
      amrapMinutes: CACHE.circuit?.amrapMinutes,
      roundRestSeconds: CACHE.circuit?.roundRestSeconds,
      defaultRestSeconds: CACHE.globalRestSeconds,
    }) || [];
  }

  function completionExtraItem(kind) {
    const clean = String(kind || "");
    if (clean === "plank") {
      return makePlanItem("plank_core", { exerciseName: txt("Planche fin de seance", "End workout plank"), mode: "time", targetSeconds: 60, sets: 1, restSeconds: 0, metValue: 4.2 });
    }
    return makePlanItem("mobility", { exerciseName: txt("Stretch / mobilite", "Stretch / mobility"), mode: "time", targetSeconds: 300, sets: 1, restSeconds: 0, metValue: 2.0 });
  }

  function recalcWorkoutSummary(summary) {
    if (!summary) return summary;
    const durationSeconds = Math.max(1, Math.round(n(summary.durationSeconds, 0)));
    return Object.assign({}, summary, {
      durationSeconds,
      estimatedKcal: Math.max(1, Math.round(sessionKcalEstimate(summary.plan || [], summary.doneSets || [], n(summary.bodyWeightKg, bodyWeight()), durationSeconds))),
    });
  }

  function addCompletionExtra(summary, kind) {
    const base = Object.assign({}, summary || {});
    const plan = (base.plan || []).map(item => Object.assign({}, item));
    const doneSets = (base.doneSets || []).map(set => Object.assign({}, set));
    const item = completionExtraItem(kind);
    const itemIndex = plan.length;
    const seconds = setWorkSeconds(item);
    plan.push(item);
    doneSets.push({
      itemIndex,
      setIndex: 1,
      reps: null,
      durationSeconds: seconds,
      weightKg: 0,
      distanceM: 0,
      completedAt: base.endedAt || new Date().toISOString(),
    });
    return recalcWorkoutSummary(Object.assign({}, base, {
      plan,
      doneSets,
      durationSeconds: Math.max(1, Math.round(n(base.durationSeconds, 0) + seconds)),
    }));
  }

  function currentTimerStep() {
    return window.UI?.sportTimerController?.currentTimerStep?.(CACHE.timer) || null;
  }
  function sportTimerControllerOptions() {
    return {
      effectiveLoadKg,
      lastLoadForExercise,
      supportsExternalLoad,
      defaultRestSeconds: CACHE.globalRestSeconds,
    };
  }
  function stepLabel(step) {
    if (!step) return txt("Fin", "End");
    if (step.kind === "round_rest") return `${txt("Fin du tour", "End of round")} ${step.roundIndex}`;
    if (step.kind === "rest") return txt("Repos", "Rest");
    return step.item?.exerciseName || labelActivity(step.item?.activityKey || "strength");
  }
  function sportViewApi() {
    return {
      escapeHTML: esc,
      translate: txt,
      numberValue: n,
      formatSeconds: fmtSec,
      labelActivity,
      labelEquipment,
      localDateISO,
      todayISO,
      supportsExternalLoad,
      lastLoadForExercise,
      effectiveLoadKg,
      bodyWeight,
      progressionRepRange,
    };
  }

  function renderTimer() {
    return window.UI?.sportTimerView?.renderSportTimer?.({
      timer: CACHE.timer,
      plan: CACHE.plan,
      circuit: CACHE.circuit,
      timerFocus: CACHE.timerFocus,
      timerBeepVolume: CACHE.timerBeepVolume,
      currentStep: currentTimerStep(),
      api: sportViewApi(),
    }) || "";
  }

  function allVisibleSportSessions() {
    const remoteSessions = CACHE.sessions || [];
    const localSessions = CACHE.localSessions || [];
    return remoteSessions.concat(
      localSessions
        .filter(isLocalWorkoutUnsynced)
        .map(localToHistorySession)
    );
  }

  function renderHistory() {
    const remoteSessions = CACHE.sessions || [];
    const localSessions = CACHE.localSessions || [];
    const recoverableAnonCount = uid() && !localSessions.length ? loadAnonHistory().length : 0;
    const unsyncedLocal = localSessions.filter(isLocalWorkoutUnsynced);
    const sessions = remoteSessions.concat(unsyncedLocal.map(localToHistorySession))
      .sort((a, b) => String(b.started_at || "").localeCompare(String(a.started_at || "")));
    return window.UI?.sportHistoryView?.renderSportHistory?.({
      sessions,
      items: CACHE.items || [],
      sets: CACHE.sets || [],
      status: CACHE.status || "",
      error: CACHE.error || "",
      recoverableAnonCount,
      unsyncedLocalCount: uid() ? unsyncedLocal.length : 0,
      todayMergeCount: sessions.filter(s => window.UI?.sportHistoryView?.isTodaySession?.(s, sportViewApi())).length,
      planForSession: planFromStoredSession,
      doneSetsForSession: (sessionId) => doneSetsFromStoredSession(sessionId, 0),
      api: sportViewApi(),
    }) || "";
  }
  function shortWeekday(day) {
    const idx = new Date(`${String(day || todayISO()).slice(0, 10)}T12:00:00`).getDay();
    const fr = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
    const en = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return txt(fr[idx] || "", en[idx] || "");
  }
  function sportProfileRadarData() {
    const data = window.Core?.sportProfileRules?.buildSportProfileRadarData?.({
      sessions: allVisibleSportSessions(),
      planForSession: (sessionId) => planFromStoredSession(sessionId),
      doneSetsForSession: (sessionId) => doneSetsFromStoredSession(sessionId, 0),
      bodyWeightKg: bodyWeight(),
      sleepRows: window.state?.nutritionSleep || {},
      now: new Date(),
      api: {
        numberValue: n,
        labelActivity,
        localDateISO,
      },
    }) || { axes: [], sessions: [], weakest: null, bestLoads: [], uniqueDays: 0 };
    const labelMap = {
      lower: txt("Jambes", "Legs"),
      push: txt("Poussee", "Push"),
      pull: txt("Tirage", "Pull"),
      core: "Core",
      cardio: "Cardio",
      recovery: txt("Recup.", "Recovery"),
      force: txt("Force", "Strength"),
      endurance: txt("Endurance", "Endurance"),
      explosive: txt("Explosivite", "Explosiveness"),
      mobility: txt("Mobilite", "Mobility"),
    };
    const axes = (data.axes || []).map(axis => Object.assign({}, axis, { label: labelMap[axis.key] || axis.key }));
    return {
      axes,
      sessions: data.sessions || [],
      weakest: axes.find(axis => axis.key === data.weakest?.key) || axes.slice().sort((a, b) => a.value - b.value)[0] || axes[0],
      bestLoads: data.bestLoads || [],
      uniqueDays: data.uniqueDays || 0,
      athleticProfile: data.athleticProfile || null,
      classicAxes: data.classicAxes || [],
    };
  }
  function renderSportProfileDashboard() {
    return window.UI?.sportProfileView?.renderSportProfileDashboard?.({
      data: sportProfileRadarData(),
      latest: latestBodyMeasurement(),
      bodyWeightKg: bodyWeight(),
      api: sportViewApi(),
    }) || "";
  }
  function renderBodyMeasurementModal() {
    return window.UI?.sportProfileView?.renderBodyMeasurementModal?.({
      editor: CACHE.bodyMeasurementEditor,
      api: sportViewApi(),
    }) || "";
  }
  function clearBodyMeasurementPortal() {
    try { document.getElementById("tb-sport-body-measurement-portal")?.remove(); } catch (_) {}
  }
  function syncBodyMeasurementPortal() {
    clearBodyMeasurementPortal();
    if (!CACHE.bodyMeasurementEditor || !document?.body) return;
    const wrap = document.createElement("div");
    wrap.id = "tb-sport-body-measurement-portal";
    wrap.innerHTML = renderBodyMeasurementModal();
    document.body.appendChild(wrap);
    wrap.querySelectorAll("[data-sport-body-close]").forEach(btn => {
      btn.onclick = () => {
        closeBodyMeasurementEditor();
        clearBodyMeasurementPortal();
        renderSport("body-measurement-close");
      };
    });
    const save = wrap.querySelector("#sport-body-save");
    if (save) save.onclick = async () => {
      save.disabled = true;
      await saveBodyMeasurementFromDom(wrap);
      clearBodyMeasurementPortal();
      renderSport("body-measurement-save");
    };
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
  function sportStatsHTML() {
    const sessions = allVisibleSportSessions();
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
    syncTimerFocusLock();
    reloadScopedLocalState(false);
    syncTimerFocusLock();
    if (!CACHE.libraryLoaded && !CACHE.libraryLoading) {
      ensureSportLibraryLoaded(reason).then((changed) => {
        if (changed && (window.activeView || "") === "sport") renderSport("library-loaded");
      }).catch(() => {});
    }
    if (!CACHE.programLoaded && !CACHE.programLoading) {
      ensureSportProgramsLoaded(reason).then((changed) => {
        if (changed && (window.activeView || "") === "sport") renderSport("program-loaded");
      }).catch(() => {});
    }
    if (!CACHE.bodyMeasurementsLoaded && !CACHE.bodyMeasurementsLoading) {
      ensureBodyMeasurementsLoaded(reason).then((changed) => {
        if (changed && (window.activeView || "") === "sport") renderSport("body-measurements-loaded");
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
        ${renderSportProfileDashboard()}
        <div class="tb-sport-grid">
          ${renderBuilder()}
          ${renderTimer()}
        </div>
        ${renderHistory()}
      </div>`;
    bind(root);
    syncTimerFocusLock();
    syncSessionEditorPortal();
    syncBodyMeasurementPortal();
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
    const libraryFamily = root.querySelector("#sport-library-family");
    if (libraryFamily) libraryFamily.onchange = () => {
      CACHE.builderFamily = libraryFamily.value || "all";
      renderSport("library-family");
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
    const repMinInput = root.querySelector("#sport-rep-min");
    if (repMinInput) repMinInput.oninput = () => {
      const compat = root.querySelector("#sport-reps");
      if (compat) compat.value = repMinInput.value || "0";
      const maxInput = root.querySelector("#sport-rep-max");
      if (maxInput && n(maxInput.value, 0) < n(repMinInput.value, 0)) maxInput.value = repMinInput.value || "0";
    };
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
    const toggleFavorite = root.querySelector("#sport-toggle-favorite");
    if (toggleFavorite) toggleFavorite.onclick = () => {
      toggleExerciseFavorite(root.querySelector("#sport-library-ex")?.value || "");
      renderSport("exercise-favorite");
    };
    root.querySelectorAll("[data-sport-ex]").forEach(btn => {
      btn.onclick = () => {
        const ex = EXERCISE_LIBRARY.find(row => row.key === btn.getAttribute("data-sport-ex"));
        if (!ex) return;
        rememberExerciseRecent(ex.key);
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
    ["#sport-open-body-measurement", "#sport-open-body-measurement-2"].forEach(selector => {
      const btn = root.querySelector(selector);
      if (btn) btn.onclick = () => {
        openBodyMeasurementEditor();
        renderSport("body-measurement-open");
      };
    });
    const add = root.querySelector("#sport-add-item");
    if (add) add.onclick = () => {
      const editIdx = Number.isInteger(CACHE.editingPlanIndex) ? CACHE.editingPlanIndex : null;
      rememberExerciseRecent(root.querySelector("#sport-library-ex")?.value || "");
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
    root.querySelectorAll("[data-sport-load-session-favorite]").forEach(btn => {
      btn.onclick = () => {
        if (loadSessionFavorite(btn.getAttribute("data-sport-load-session-favorite"))) renderSport("session-favorite");
      };
    });
    root.querySelectorAll("[data-sport-start-planned-today]").forEach(btn => {
      btn.onclick = () => {
        if (!loadSessionFavorite(btn.getAttribute("data-sport-start-planned-today"))) return;
        savePlan();
        renderSport("planned-start");
        window.setTimeout(() => {
          try { startTimer(); } catch (_) {}
        }, 0);
      };
    });
    root.querySelectorAll("[data-sport-edit-session-favorite]").forEach(btn => {
      btn.onclick = () => {
        if (beginEditSessionFavorite(btn.getAttribute("data-sport-edit-session-favorite"))) renderSport("session-favorite-edit");
      };
    });
    root.querySelectorAll("[data-sport-open-session-editor]").forEach(btn => {
      btn.onclick = () => {
        if (openSessionFavoriteEditor(btn.getAttribute("data-sport-open-session-editor"))) renderSport("session-editor-open");
      };
    });
    const newSessionFavorite = root.querySelector("#sport-new-session-favorite");
    if (newSessionFavorite) newSessionFavorite.onclick = () => {
      openSessionFavoriteEditor("");
      renderSport("session-editor-new");
    };
    root.querySelectorAll("[data-sport-reset-session-favorite]").forEach(btn => {
      btn.onclick = () => {
        resetSessionFavoriteOverride(btn.getAttribute("data-sport-reset-session-favorite"));
        renderSport("session-favorite-reset");
      };
    });
    const saveSessionFavorite = root.querySelector("#sport-save-session-favorite");
    if (saveSessionFavorite) saveSessionFavorite.onclick = () => {
      if (saveEditingSessionFavorite()) renderSport("session-favorite-save");
    };
    const cancelSessionFavoriteEdit = root.querySelector("#sport-cancel-session-favorite-edit");
    if (cancelSessionFavoriteEdit) cancelSessionFavoriteEdit.onclick = () => {
      CACHE.editingSessionFavoriteId = "";
      CACHE.editingSessionFavoriteName = "";
      renderSport("session-favorite-cancel");
    };
    const activateProgram = root.querySelector("#sport-activate-mass-program");
    if (activateProgram) activateProgram.onclick = () => {
      activateMassProgram();
      renderSport("program-activate");
    };
    const saveProgramFromForm = () => {
      const days = {};
      root.querySelectorAll("[data-sport-program-day]").forEach(select => {
        const key = Number(select.getAttribute("data-sport-program-day"));
        if (select.value) days[key] = select.value;
      });
      CACHE.program = saveSportProgram({
        enabled: root.querySelector("#sport-program-enabled")?.value !== "off",
        startDate: root.querySelector("#sport-program-start")?.value || nextMondayISO(todayISO()),
        cycle: root.querySelector("#sport-program-cycle")?.value || "A/B",
        days,
      });
      renderSport("program-settings");
    };
    ["#sport-program-enabled", "#sport-program-start", "#sport-program-cycle"].forEach(selector => {
      const el = root.querySelector(selector);
      if (el) el.onchange = saveProgramFromForm;
    });
    root.querySelectorAll("[data-sport-program-day]").forEach(select => {
      select.onchange = saveProgramFromForm;
    });
    const programReset = root.querySelector("#sport-program-reset");
    if (programReset) programReset.onclick = () => {
      activateMassProgram();
      renderSport("program-reset");
    };
    root.querySelectorAll("[data-sport-quick]").forEach(btn => {
      btn.onclick = () => {
        const key = String(btn.getAttribute("data-sport-quick") || "pushup");
        const ex = EXERCISE_LIBRARY.find(row => row.key === key);
        if (!ex) return;
        rememberExerciseRecent(ex.key);
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
    if (clear) clear.onclick = () => {
      CACHE.plan = [];
      CACHE.editingPlanIndex = null;
      CACHE.editingSessionFavoriteId = "";
      CACHE.editingSessionFavoriteName = "";
      savePlan();
      renderSport("clear");
    };
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
    const addSet = root.querySelector("#sport-add-set");
    if (addSet) addSet.onclick = CACHE.circuit?.enabled ? addTimerCircuitRound : addTimerSetForCurrentExercise;
    const focus = root.querySelector("#sport-timer-focus");
    if (focus) focus.onclick = async () => {
      CACHE.timerFocus = !CACHE.timerFocus;
      const shouldFocus = CACHE.timerFocus;
      syncTimerFocusLock();
      renderSport("timer-focus");
      try {
        if (shouldFocus) await keepTimerFullscreen("toggle");
        else if (!shouldFocus) await exitTimerFullscreen();
      } catch (_) {}
      syncTimerFocusLock();
    };
    const beepVolume = root.querySelector("#sport-beep-volume");
    if (beepVolume) beepVolume.oninput = () => {
      saveTimerPrefs({ beepVolume: n(beepVolume.value, 70) });
      const label = root.querySelector(".tb-sport-volume-row span");
      if (label) label.textContent = `${txt("Bip", "Beep")} ${Math.round(n(beepVolume.value, 70))}%`;
    };
    const beepTest = root.querySelector("#sport-beep-test");
    if (beepTest) beepTest.onclick = () => beep("work");
    const stepLoad = root.querySelector("#sport-step-load");
    if (stepLoad) stepLoad.oninput = () => {
      if (CACHE.timer) CACHE.timer.stepLoadKg = n(stepLoad.value, 0);
    };
    const stepReps = root.querySelector("#sport-step-reps");
    if (stepReps) stepReps.oninput = () => {
      if (CACHE.timer) CACHE.timer.stepReps = Math.max(0, Math.round(n(stepReps.value, 0)));
    };
    root.querySelectorAll("[data-sport-reps-delta]").forEach(btn => {
      btn.onclick = () => {
        const input = root.querySelector("#sport-step-reps");
        if (!input) return;
        const next = Math.max(0, Math.round(n(input.value, 0) + n(btn.getAttribute("data-sport-reps-delta"), 0)));
        input.value = String(next);
        if (CACHE.timer) CACHE.timer.stepReps = next;
        renderSport("step-reps");
      };
    });
    root.querySelectorAll("[data-sport-load-delta]").forEach(btn => {
      btn.onclick = () => {
        const input = root.querySelector("#sport-step-load");
        if (!input) return;
        const next = Math.max(0, n(input.value, 0) + n(btn.getAttribute("data-sport-load-delta"), 0));
        input.value = String(Math.round(next * 10) / 10);
        if (CACHE.timer) CACHE.timer.stepLoadKg = n(input.value, 0);
      };
    });
    const skipRest = root.querySelector("#sport-skip-rest");
    if (skipRest) skipRest.onclick = skipRestStep;
    const minusTime = root.querySelector("#sport-minus-time");
    if (minusTime) minusTime.onclick = () => adjustCurrentStepSeconds(-15);
    const plusTime = root.querySelector("#sport-plus-time");
    if (plusTime) plusTime.onclick = () => adjustCurrentStepSeconds(30);
    const pause = root.querySelector("#sport-pause");
    if (pause) pause.onclick = togglePause;
    const finish = root.querySelector("#sport-finish");
    if (finish) finish.onclick = () => finishWorkout({ recordCurrent: false });
    root.querySelectorAll("[data-sport-delete-session]").forEach(btn => {
      btn.onclick = () => deleteSportSession(btn.getAttribute("data-sport-delete-session"));
    });
    root.querySelectorAll("[data-sport-repeat-session]").forEach(btn => {
      btn.onclick = () => repeatSportSession(btn.getAttribute("data-sport-repeat-session"));
    });
    root.querySelectorAll("[data-sport-edit-session]").forEach(btn => {
      btn.onclick = () => openSportSessionSandbox(btn.getAttribute("data-sport-edit-session"));
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
    const sessionItems = (CACHE.items || [])
      .filter(item => String(item.session_id || "") === id)
      .slice()
      .sort((a, b) => n(a.sort_order, 0) - n(b.sort_order, 0));
    if (Array.isArray(local?.plan) && local.plan.length) {
      return local.plan.map((item, index) => Object.assign({}, item, {
        _sessionItemId: sessionItems.find(row => Number(row.sort_order) === index)?.id || null,
      }));
    }
    return sessionItems.map(item => makePlanItem(item.activity_key || "strength", {
      _sessionItemId: item.id || null,
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
    if (Array.isArray(local?.doneSets) && !local?.remoteId) {
      return local.doneSets.map(set => Object.assign({}, set, { itemIndex: baseOffset + Math.max(0, Math.round(n(set.itemIndex, 0))) }));
    }
    const sessionItems = (CACHE.items || [])
      .filter(item => String(item.session_id || "") === id)
      .slice()
      .sort((a, b) => n(a.sort_order, 0) - n(b.sort_order, 0));
    const itemIndexById = new Map(sessionItems.map((item, idx) => [String(item.id || ""), idx]));
    const storedSets = (CACHE.sets || [])
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
        id: set.id || null,
        itemId: set.item_id || null,
        reps: set.reps ?? null,
        durationSeconds: n(set.duration_seconds, 0),
        weightKg: n(set.weight_kg, 0),
        distanceM: n(set.distance_m, 0),
        completedAt: set.completed_at || new Date().toISOString(),
      }));
    return storedSets;
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
    const createTimerState = window.UI?.sportTimerController?.createTimerState;
    if (typeof createTimerState !== "function") throw new Error("Sport timer controller indisponible");
    CACHE.timer = createTimerState(Object.assign({
      sequence: seq,
      now: Date.now(),
      bodyWeightKg: bodyWeight(),
      bodyHeightCm: bodyHeight(),
      timeCapMinutes: CACHE.circuit?.enabled ? n(CACHE.circuit?.amrapMinutes, 0) : 0,
    }, sportTimerControllerOptions()));
    requestWakeLock();
    saveTimerState();
    cancelTimerNotification();
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
    CACHE.timerFocus = false;
    syncTimerFocusLock();
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
      if (timer.timeCapEndAt && Date.now() >= timer.timeCapEndAt) return finishWorkout({ recordCurrent: true });
      if (step.duration && Date.now() >= timer.stepEndAt) completeStep();
      else if ((typeof activeView === "string" ? activeView : "") === "sport") {
        updateTimerDisplay();
      }
    }, 500);
  }
  function updateTimerDisplay() {
    const timer = CACHE.timer;
    const step = currentTimerStep();
    if (!timer || !step) return;
    const root = document.getElementById("sport-root");
    if (!root) return;
    const elapsed = Math.max(0, Math.round((Date.now() - timer.startedAt) / 1000));
    const remaining = step.duration ? Math.max(0, Math.ceil((timer.stepEndAt - Date.now()) / 1000)) : 0;
    const isRest = step.kind === "rest" || step.kind === "round_rest";
    const displayValue = isRest ? fmtSec(remaining) : (step.item?.mode === "time" ? fmtSec(remaining) : `${n(timer.stepReps ?? step.item?.targetReps, 0)} reps`);
    const clock = root.querySelector("[data-sport-timer-clock]");
    if (clock) clock.textContent = displayValue;
    const progress = root.querySelector("[data-sport-timer-progress]");
    if (progress) {
      const workDone = timer.doneSets.length;
      const totalWork = timer.sequence.filter(s => s.kind === "work").length;
      progress.textContent = `${txt("Progression", "Progress")}: ${workDone}/${totalWork} · ${txt("Temps total", "Total time")}: ${fmtSec(elapsed)}`;
    }
    const amrap = CACHE.circuit?.enabled && n(CACHE.circuit?.amrapMinutes, 0) > 0;
    const next = root.querySelector(".tb-sport-next");
    if (next && amrap && timer.timeCapEndAt) {
      next.textContent = `${txt("AMRAP", "AMRAP")}: ${fmtSec(Math.max(0, Math.ceil((timer.timeCapEndAt - Date.now()) / 1000)))} · ${txt("Tours", "Rounds")}: ${n(timer.roundsCompleted, 0)}`;
    }
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
  function currentTimerNotificationText() {
    const timer = CACHE.timer;
    const step = currentTimerStep();
    if (!timer || !step) return "";
    const remaining = step.duration ? Math.max(0, Math.ceil((timer.stepEndAt - Date.now()) / 1000)) : 0;
    const label = stepLabel(step);
    const target = step.kind === "work" && step.item?.mode === "reps"
      ? `${n(timer.stepReps ?? step.item?.targetReps, 0)} reps`
      : (step.duration ? fmtSec(remaining) : txt("a valider", "to validate"));
    return `${label} · ${target}`;
  }
  async function notifyTimerInBackground(reason) {
    if (!CACHE.timer || CACHE.timer.paused) return false;
    const body = currentTimerNotificationText();
    if (!body) return false;
    try {
      if (typeof window.tbSendLocalNotification === "function") {
        return await window.tbSendLocalNotification(
          txt("Timer sport en cours", "Sport timer running"),
          body,
          { view: "sport", tag: "sport-timer", source: "sport", reason: reason || "background" },
          { id: 1701 }
        );
      }
    } catch (_) {}
    return false;
  }
  async function cancelTimerNotification() {
    try {
      const LocalNotifications = window.Capacitor?.Plugins?.LocalNotifications || null;
      if (LocalNotifications?.cancel) await LocalNotifications.cancel({ notifications: [{ id: 1701 }] });
    } catch (_) {}
  }
  function beep(kind) {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      const ctx = new AC();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const volume = Math.max(0, Math.min(1, n(CACHE.timerBeepVolume, 70) / 100));
      const baseGain = kind === "finish" ? 0.24 : 0.18;
      osc.frequency.value = kind === "finish" ? 1046 : kind === "rest" ? 660 : 880;
      gain.gain.value = Math.max(0, Math.min(0.28, baseGain * volume));
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      setTimeout(() => { try { osc.stop(); ctx.close(); } catch (_) {} }, kind === "finish" ? 260 : 170);
    } catch (_) {}
  }
  function readTimerStepLoadKg(timer, step) {
    const el = document.getElementById("sport-step-load");
    if (el) timer.stepLoadKg = n(el.value, 0);
    if (!supportsExternalLoad(step?.item || {})) return 0;
    return n(timer?.stepLoadKg, lastLoadForExercise(step?.item || {}, effectiveLoadKg(step?.item || {}, timer?.bodyWeightKg || bodyWeight())));
  }
  function readTimerStepReps(timer, step) {
    if (step?.item?.mode !== "reps") return null;
    const el = document.getElementById("sport-step-reps");
    if (el) timer.stepReps = Math.max(0, Math.round(n(el.value, 0)));
    return Math.max(0, Math.round(n(timer?.stepReps, step?.item?.targetReps || 0)));
  }
  function setTimerStepDefaults(timer, step) {
    if (!timer) return timer;
    const applyDefaults = window.UI?.sportTimerController?.applyStepDefaults;
    if (typeof applyDefaults !== "function") return timer;
    const next = applyDefaults(timer, step, sportTimerControllerOptions());
    Object.assign(timer, next);
    return timer;
  }
  function recordWorkStep(timer, step, durationOverride, loadOverride, repsOverride) {
    if (!timer || !step || step.kind !== "work") return null;
    const record = window.UI?.sportTimerController?.recordWorkStep;
    if (typeof record !== "function") return null;
    const hasDurationOverride = Number.isFinite(Number(durationOverride)) && Number(durationOverride) > 0;
    const elapsedSeconds = (Date.now() - timer.stepStartedAt) / 1000;
    const result = record(timer, step, Object.assign({
      now: Date.now(),
      durationSeconds: hasDurationOverride ? Math.max(1, Math.round(Number(durationOverride))) : (step.item?.mode === "time" ? sequenceStepSeconds(step) : setWorkSeconds(step.item, elapsedSeconds)),
      loadKg: loadOverride,
      reps: repsOverride,
    }, sportTimerControllerOptions()));
    Object.assign(timer, result.timer);
    if (result.addedSet) rememberLoadForExercise(step.item, result.addedSet.weightKg || 0);
    return result.addedSet || null;
  }
  async function keepTimerFullscreen(reason) {
    if (!CACHE.timerFocus) return;
    syncTimerFocusLock();
    const target = document.querySelector(".tb-sport-timer-card.focus") || document.documentElement;
    const current = document.fullscreenElement || document.webkitFullscreenElement || null;
    if (current) return;
    const request = target?.requestFullscreen || target?.webkitRequestFullscreen || null;
    if (!request) return;
    try { await request.call(target, { navigationUI: "hide" }); }
    catch (_) { try { await request.call(target); } catch (_) {} }
  }
  async function exitTimerFullscreen() {
    syncTimerFocusLock();
    const current = document.fullscreenElement || document.webkitFullscreenElement || null;
    if (!current) return;
    const exit = document.exitFullscreen || document.webkitExitFullscreen || null;
    if (!exit) return;
    try { await exit.call(document); } catch (_) {}
  }
  function restoreTimerFullscreen(reason) {
    if (!CACHE.timerFocus) return;
    window.setTimeout(() => { keepTimerFullscreen(reason); }, 60);
  }
  function completeStep() {
    const timer = CACHE.timer;
    const step = currentTimerStep();
    if (!timer || !step) return;
    const complete = window.UI?.sportTimerController?.completeTimerStep;
    if (typeof complete !== "function") return;
    const result = complete(timer, Object.assign({
      now: Date.now(),
      loadKg: readTimerStepLoadKg(timer, step),
      reps: readTimerStepReps(timer, step),
    }, sportTimerControllerOptions()));
    CACHE.timer = result.timer;
    saveTimerState();
    if (result.addedSet) rememberLoadForExercise(step.item, result.addedSet.weightKg || 0);
    const next = result.nextStep;
    beep(next?.kind === "rest" ? "rest" : "work");
    if (result.looped) {
      sportFeedback(txt("Tour valide", "Round counted"), `${txt("Tour", "Round")} ${CACHE.timer.roundsCompleted} - ${stepLabel(next)}`, { persistNotification: true });
      renderSport("amrap-loop");
      restoreTimerFullscreen("amrap-loop");
      return;
    }
    if (result.finished) {
      finishWorkout();
      return;
    }
    sportFeedback(step.kind === "work" ? txt("Serie terminee", "Set complete") : txt("Repos termine", "Rest complete"), `${stepLabel(next)} - ${next.duration ? fmtSec(next.duration) : txt("a valider", "to validate")}`, { toast: step.kind === "rest", persistNotification: true });
    setTimerStepDefaults(timer, next);
    timer.stepStartedAt = Date.now();
    timer.stepEndAt = next.duration ? Date.now() + (next.duration * 1000) : null;
    renderSport("step");
    restoreTimerFullscreen("step");
  }
  function skipRestStep() {
    const timer = CACHE.timer;
    const step = currentTimerStep();
    if (!timer || !step || (step.kind !== "rest" && step.kind !== "round_rest")) return;
    const skip = window.UI?.sportTimerController?.skipRestStep;
    if (typeof skip !== "function") return;
    const result = skip(timer, Object.assign({ now: Date.now() }, sportTimerControllerOptions()));
    CACHE.timer = result.timer;
    saveTimerState();
    const next = result.nextStep;
    beep("work");
    if (result.finished) {
      finishWorkout();
      return;
    }
    sportFeedback(txt("Repos saute", "Rest skipped"), `${stepLabel(next)} - ${next.duration ? fmtSec(next.duration) : txt("a valider", "to validate")}`, { persistNotification: true });
    renderSport("skip-rest");
    restoreTimerFullscreen("skip-rest");
  }
  function adjustCurrentStepSeconds(delta) {
    const timer = CACHE.timer;
    const step = currentTimerStep();
    if (!timer || !step || !step.duration || timer.paused) return;
    const adjust = window.UI?.sportTimerController?.adjustCurrentStepSeconds;
    if (typeof adjust !== "function") return;
    const result = adjust(timer, delta, { now: Date.now() });
    CACHE.timer = result.timer;
    saveTimerState();
    if (result.adjusted) renderSport("adjust-time");
  }
  function addTimerSetForCurrentExercise() {
    const timer = CACHE.timer;
    const step = currentTimerStep();
    if (!timer || !step || !step.item) return;
    const addSet = window.UI?.sportTimerController?.addSetForCurrentExercise;
    if (typeof addSet !== "function") return;
    const result = addSet(timer, CACHE.plan, { defaultRestSeconds: CACHE.globalRestSeconds });
    if (!result.inserted) return;
    CACHE.timer = result.timer;
    CACHE.plan = result.plan;
    saveTimerState();
    const item = CACHE.plan[result.itemIndex] || result.item || step.item;
    savePlan();
    sportFeedback(txt("Serie ajoutee", "Set added"), `${item.exerciseName || labelActivity(item.activityKey)} · ${txt("serie", "set")} ${result.setIndex}`, { toast: true, persistNotification: true });
    renderSport("add-current-set");
  }
  function addTimerCircuitRound() {
    const timer = CACHE.timer;
    if (!timer || !CACHE.plan.length || !CACHE.circuit?.enabled) return;
    const addRound = window.UI?.sportTimerController?.addCircuitRound;
    if (typeof addRound !== "function") return;
    const result = addRound(timer, CACHE.plan, CACHE.circuit);
    CACHE.timer = result.timer;
    CACHE.plan = result.plan;
    CACHE.circuit = result.circuit;
    saveTimerState();
    saveCircuit(CACHE.circuit);
    savePlan();
    const order = CACHE.plan.map(item => item.exerciseName || labelActivity(item.activityKey)).join(" → ");
    sportFeedback(txt("Tour ajoute", "Round added"), `${txt("Tour", "Round")} ${result.roundIndex} · ${order}`, { toast: true, persistNotification: true });
    renderSport("add-circuit-round");
  }
  function togglePause() {
    const timer = CACHE.timer;
    if (!timer) return;
    const toggle = window.UI?.sportTimerController?.togglePause;
    if (typeof toggle !== "function") return;
    const result = toggle(timer, { now: Date.now() });
    CACHE.timer = result.timer;
    saveTimerState();
    if (result.paused) {
      sportFeedback(txt("Timer en pause", "Timer paused"), txt("Seance en pause.", "Workout paused."), { persistNotification: true });
    } else {
      sportFeedback(txt("Timer repris", "Timer resumed"), txt("Seance reprise.", "Workout resumed."), { persistNotification: true });
    }
    renderSport("pause");
  }
  async function finishWorkout(options) {
    const timer = CACHE.timer;
    if (!timer) return;
    stopTicker();
    releaseWakeLock();
    cancelTimerNotification();
    const endedAt = Date.now();
    const durationSeconds = Math.max(1, Math.round((endedAt - timer.startedAt) / 1000));
    const step = currentTimerStep();
    if (options?.recordCurrent && step && step.kind === "work") {
      const elapsedStepSeconds = Math.max(1, Math.round((endedAt - timer.stepStartedAt) / 1000));
      const cappedStepSeconds = step.duration ? Math.min(n(step.duration, elapsedStepSeconds), elapsedStepSeconds) : elapsedStepSeconds;
      recordWorkStep(timer, step, cappedStepSeconds, readTimerStepLoadKg(timer, step), readTimerStepReps(timer, step));
    }
    const finalize = window.Core?.sportRules?.finalizeWorkout;
    if (typeof finalize !== "function") throw new Error("Sport finalization rules indisponibles");
    const summary = finalize({
      plan: CACHE.plan,
      doneSets: timer.doneSets,
      startedAt: timer.startedAt,
      endedAt,
      durationSeconds,
      bodyWeightKg: timer.bodyWeightKg,
      bodyHeightCm: timer.bodyHeightCm,
      estimateKcal: ({ plan, doneSets, bodyWeightKg, durationSeconds: totalSeconds }) =>
        sessionKcalEstimate(plan, doneSets, bodyWeightKg, totalSeconds),
    });
    const progressions = applyDoubleProgression(CACHE.plan, timer.doneSets);
    if (progressions.length) {
      CACHE.plan = CACHE.plan.map((item, idx) => {
        const row = progressions.find(p => p.itemIndex === idx);
        return row ? Object.assign({}, item, { targetReps: row.repMin, weightKg: row.toKg }) : item;
      });
      savePlan();
      summary.progressions = progressions;
    }
    CACHE.timer = null;
    CACHE.timerFocus = false;
    syncTimerFocusLock();
    clearTimerState();
    CACHE.pendingSummary = summary;
    beep("finish");
    const progressionText = progressions.length ? ` · ${progressions.length} ${txt("progression", "progression")}` : "";
    sportFeedback(txt("Seance terminee", "Workout complete"), `${fmtSec(summary.durationSeconds)} - ${Math.round(n(summary.estimatedKcal, 0))} kcal${progressionText}`, { persistNotification: false });
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
        <div class="muted" id="sport-finish-summary-line">${fmtSec(summary.durationSeconds)} - ${Math.round(n(summary.estimatedKcal, 0))} kcal - ${summary.doneSets.length} ${esc(txt("series", "sets"))}</div>
        <div class="tb-sport-field" style="margin-top:12px;">
          <label>${esc(txt("Ajouter a la fin", "Add at the end"))}</label>
          <div class="tb-sport-choice-row">
            <button class="tb-sport-choice" type="button" id="sport-finish-add-plank">+ ${esc(txt("Planche 1 min", "Plank 1 min"))}</button>
            <button class="tb-sport-choice" type="button" id="sport-finish-add-stretch">+ ${esc(txt("Stretch 5 min", "Stretch 5 min"))}</button>
          </div>
        </div>
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
    let modalSummary = recalcWorkoutSummary(Object.assign({}, CACHE.pendingSummary || summary));
    const refreshFinishSummaryLine = () => {
      const line = wrap.querySelector("#sport-finish-summary-line");
      if (line) line.textContent = `${fmtSec(modalSummary.durationSeconds)} - ${Math.round(n(modalSummary.estimatedKcal, 0))} kcal - ${(modalSummary.doneSets || []).length} ${txt("series", "sets")}`;
      CACHE.pendingSummary = modalSummary;
    };
    const addPlank = wrap.querySelector("#sport-finish-add-plank");
    if (addPlank) addPlank.onclick = () => {
      modalSummary = addCompletionExtra(modalSummary, "plank");
      addPlank.disabled = true;
      refreshFinishSummaryLine();
    };
    const addStretch = wrap.querySelector("#sport-finish-add-stretch");
    if (addStretch) addStretch.onclick = () => {
      modalSummary = addCompletionExtra(modalSummary, "stretch");
      addStretch.disabled = true;
      refreshFinishSummaryLine();
    };
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
      cancel.disabled = true;
      if (save) save.disabled = true;
      const s = Object.assign({}, CACHE.pendingSummary || modalSummary, { moodAfter: "", perceivedEffort: null, notes: "" });
      CACHE.pendingSummary = null;
      closeFinishModal();
      await saveWorkout(s);
      renderSport("finish-skip");
    };
    const save = wrap.querySelector("#sport-finish-save");
    if (save) save.onclick = async () => {
      save.disabled = true;
      if (cancel) cancel.disabled = true;
      const s = Object.assign({}, CACHE.pendingSummary || modalSummary, {
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
    const fingerprint = workoutFingerprint(summary) || ("workout_" + Date.now());
    if (CACHE.savingWorkoutKeys.has(fingerprint)) return;
    CACHE.savingWorkoutKeys.add(fingerprint);
    const localRow = rememberLocalWorkout(summary, false);
    try {
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
      const existingRemoteId = await findExistingRemoteWorkout(c, userId, summary);
      if (existingRemoteId) {
        markLocalSynced(localRow.localId, existingRemoteId);
        CACHE.loaded = false;
        CACHE.status = txt("Seance deja synchronisee, doublon evite.", "Workout already synced, duplicate avoided.");
        await loadHistory();
        return;
      }
      try {
        const buildRows = window.Core?.sportRules?.buildSportPersistenceRows;
        if (typeof buildRows !== "function") throw new Error("Sport persistence rules indisponibles");
        const initialRows = buildRows(summary, { userId, travelId: activeTravelId() });
        const created = await sportRepository().createWorkout({
          tables: {
            sessions: table("sport_sessions"),
            items: table("sport_session_items"),
            sets: table("sport_sets"),
          },
          rows: initialRows,
        });
        const sessionId = created.sessionId;
        markLocalSynced(localRow.localId, sessionId);
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
    } finally {
      CACHE.savingWorkoutKeys.delete(fingerprint);
    }
  }

  async function syncLocalWorkoutRow(row) {
    const c = client();
    const userId = uid();
    if (!c || !userId || !row || row.remoteId) return false;
    const plan = Array.isArray(row.plan) ? row.plan : [];
    if (!plan.length) return false;
    const doneSets = Array.isArray(row.doneSets) ? row.doneSets : [];
    const existingRemoteId = await findExistingRemoteWorkout(c, userId, row);
    if (existingRemoteId) {
      markLocalSynced(row.localId || row.id, existingRemoteId);
      return true;
    }
    const buildRows = window.Core?.sportRules?.buildSportPersistenceRows;
    if (typeof buildRows !== "function") throw new Error("Sport persistence rules indisponibles");
    const summary = Object.assign({}, row, { plan, doneSets });
    const initialRows = buildRows(summary, { userId, travelId: activeTravelId() });
    const created = await sportRepository().createWorkout({
      tables: {
        sessions: table("sport_sessions"),
        items: table("sport_session_items"),
        sets: table("sport_sets"),
      },
      rows: initialRows,
    });
    const sessionId = created.sessionId;
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
    return sportRepository().deleteWorkout({
      tables: {
        sessions: table("sport_sessions"),
        items: table("sport_session_items"),
        sets: table("sport_sets"),
      },
      sessionId: key,
      itemIds,
    });
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
        await sportRepository().updateSessionDate({
          table: table("sport_sessions"),
          sessionId: id,
          startedAt,
          endedAt,
        });
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

  function sessionRuntimeRow(sessionId) {
    const id = String(sessionId || "");
    return (CACHE.sessions || []).find(s => String(s.id || "") === id)
      || (CACHE.localSessions || []).find(s => String(s.localId || s.id || "") === id || String(s.remoteId || "") === id)
      || null;
  }

  function closeSportSessionSandbox() {
    const old = document.getElementById("tb-sport-session-sandbox");
    if (old) old.remove();
  }

  function openSportSessionSandbox(sessionId) {
    const id = String(sessionId || "");
    const session = sessionRuntimeRow(id);
    const plan = planFromStoredSession(id);
    const doneSets = doneSetsFromStoredSession(id, 0);
    if (!session || !plan.length || !doneSets.length) {
      sportFeedback(txt("Modification impossible", "Edit unavailable"), txt("Aucune serie detaillee trouvee pour cette seance.", "No detailed set found for this workout."), { kind: "warn" });
      return;
    }
    closeSportSessionSandbox();
    const durationSeconds = n(session.duration_seconds || session.durationSeconds, doneSets.reduce((sum, set) => sum + n(set.durationSeconds, 0), 0));
    const weightKg = n(session.body_weight_kg || session.bodyWeightKg, bodyWeight());
    const sandboxRules = window.Core?.sportSessionSandboxRules || {};
    const sandboxRulesApi = () => ({
      numberValue: n,
      setWorkSeconds,
      supportsExternalLoad,
      lastLoadForExercise,
      effectiveLoadKg,
    });
    const modal = window.UI?.createModal?.({
      id: "tb-sport-session-sandbox",
      size: "lg",
      title: txt("Ajuster la seance", "Adjust workout"),
      subtitle: txt("Modifie uniquement les series reellement effectuees.", "Edit completed sets only."),
      closeLabel: txt("Fermer", "Close"),
      contentHTML: window.UI?.sportSessionSandboxView?.renderSandboxContent?.({
        session,
        plan,
        doneSets,
        weightKg,
        api: sportViewApi(),
      }) || "",
      actionsHTML: window.UI?.sportSessionSandboxView?.renderSandboxActions?.({ api: sportViewApi() }) || "",
    });
    if (!modal) return;
    const wrap = modal.root;
    const readNextSets = () => doneSets.map((set, idx) => {
      const item = plan[Math.max(0, Math.round(n(set.itemIndex, 0)))] || {};
      const isReps = item.mode === "reps" || set.reps != null;
      return Object.assign({}, set, {
        reps: isReps ? Math.max(0, Math.round(n(wrap.querySelector(`[data-sport-sandbox-reps="${idx}"]`)?.value, set.reps || item.targetReps || 0))) : null,
        durationSeconds: Math.max(0, Math.round(n(wrap.querySelector(`[data-sport-sandbox-seconds="${idx}"]`)?.value, set.durationSeconds || setWorkSeconds(item)))),
        weightKg: n(wrap.querySelector(`[data-sport-sandbox-load="${idx}"]`)?.value, 0),
      });
    });
    const refreshPreview = () => {
      const kcal = Math.max(1, Math.round(sessionKcalEstimate(plan, readNextSets(), weightKg, durationSeconds)));
      const out = wrap.querySelector("#sport-sandbox-kcal");
      if (out) out.textContent = `${kcal} kcal`;
      return kcal;
    };
    const renderSetList = () => {
      const normalizedSets = sandboxRules.normalizeSandboxSetIndexes?.(doneSets) || doneSets;
      doneSets.splice(0, doneSets.length, ...normalizedSets);
      const list = wrap.querySelector("#sport-sandbox-set-list");
      if (list) list.innerHTML = window.UI?.sportSessionSandboxView?.renderSandboxSetList?.({ doneSets, plan, api: sportViewApi() }) || "";
      const count = wrap.querySelector("#sport-sandbox-set-count");
      if (count) count.textContent = String(doneSets.length);
      wrap.querySelectorAll("[data-sport-sandbox-load],[data-sport-sandbox-reps],[data-sport-sandbox-seconds]").forEach(input => { input.oninput = refreshPreview; });
      wrap.querySelectorAll("[data-sport-sandbox-delete]").forEach(btn => {
        btn.onclick = () => {
          const idx = Math.max(0, Math.round(n(btn.getAttribute("data-sport-sandbox-delete"), 0)));
          const result = sandboxRules.removeSandboxSet?.({ plan, doneSets: readNextSets(), index: idx }) || { plan, doneSets };
          plan.splice(0, plan.length, ...(result.plan || plan));
          doneSets.splice(0, doneSets.length, ...(result.doneSets || doneSets));
          renderSetList();
          refreshPreview();
        };
      });
    };
    renderSetList();
    const addSetBtn = wrap.querySelector("#sport-sandbox-add-set");
    if (addSetBtn) addSetBtn.onclick = () => {
      const itemIndex = Math.max(0, Math.round(n(wrap.querySelector("#sport-sandbox-add-exercise")?.value, 0)));
      const result = sandboxRules.addSandboxSetToExercise?.({
        plan,
        doneSets: readNextSets(),
        itemIndex,
        weightKg,
        now: new Date().toISOString(),
        api: sandboxRulesApi(),
      });
      if (!result) return;
      plan.splice(0, plan.length, ...(result.plan || plan));
      doneSets.splice(0, doneSets.length, ...(result.doneSets || doneSets));
      renderSetList();
      refreshPreview();
      const addedSet = result.addedSet || {};
      const item = result.item || plan[itemIndex] || plan[0] || {};
      sportFeedback(txt("Serie ajoutee", "Set added"), `${item.exerciseName || labelActivity(item.activityKey)} · ${txt("serie", "set")} ${addedSet.setIndex || ""}`, { toast: true });
    };
    wrap.querySelector("#sport-sandbox-cancel").onclick = closeSportSessionSandbox;
    const originalSetIds = new Set(doneSets.map(set => String(set.id || "")).filter(Boolean));
    wrap.querySelector("#sport-sandbox-save").onclick = () => saveSportSessionSandbox(id, plan, readNextSets(), weightKg, durationSeconds, originalSetIds);
    refreshPreview();
  }

  async function saveSportSessionSandbox(sessionId, plan, nextSets, weightKg, durationSeconds, originalSetIds) {
    const id = String(sessionId || "");
    const completed = window.Core?.sportRules?.completedWorkout(plan, nextSets) || { plan, doneSets: nextSets };
    const estimatedKcal = Math.max(1, Math.round(sessionKcalEstimate(completed.plan, completed.doneSets, weightKg, durationSeconds)));
    const c = client();
    try {
      const localIdx = (CACHE.localSessions || []).findIndex(s => String(s.localId || s.id || "") === id || String(s.remoteId || "") === id);
      if (localIdx >= 0 && id.startsWith("local_")) {
        CACHE.localSessions[localIdx] = Object.assign({}, CACHE.localSessions[localIdx], {
          doneSets: nextSets,
          estimatedKcal,
          estimated_kcal: estimatedKcal,
        });
        saveLocalHistory(CACHE.localSessions);
      } else {
        if (!c) throw new Error("Supabase indisponible");
        const nextIds = new Set(nextSets.map(set => String(set.id || "")).filter(Boolean));
        const removedIds = Array.from(originalSetIds || []).filter(id => id && !nextIds.has(id));
        if (removedIds.length) {
          const del = await c.from(table("sport_sets")).delete().in("id", removedIds);
          if (del.error) throw del.error;
        }
        for (const set of nextSets) {
          if (!set.id && !set.itemId) continue;
          const payload = {
            reps: set.reps,
            duration_seconds: n(set.durationSeconds, 0),
            weight_kg: n(set.weightKg, 0) || null,
            distance_m: n(set.distanceM, 0) || null,
            completed_at: set.completedAt || new Date().toISOString(),
          };
          const res = set.id
            ? await c.from(table("sport_sets")).update(payload).eq("id", set.id)
            : await c.from(table("sport_sets")).insert(Object.assign({}, payload, { user_id: uid(), item_id: set.itemId, set_index: Math.max(1, Math.round(n(set.setIndex, 1))) }));
          if (res.error) throw res.error;
        }
        for (let itemIndex = 0; itemIndex < plan.length; itemIndex += 1) {
          const itemId = plan[itemIndex]?._sessionItemId || nextSets.find(set => Math.round(n(set.itemIndex, 0)) === itemIndex)?.itemId;
          if (!itemId) continue;
          const plannedSets = nextSets.filter(set => Math.round(n(set.itemIndex, 0)) === itemIndex).length;
          const res = plannedSets > 0
            ? await c.from(table("sport_session_items")).update({ planned_sets: plannedSets }).eq("id", itemId)
            : await c.from(table("sport_session_items")).delete().eq("id", itemId);
          if (res.error) throw res.error;
        }
        const sess = await c.from(table("sport_sessions")).update({ estimated_kcal: estimatedKcal }).eq("id", id);
        if (sess.error) throw sess.error;
      }
      nextSets.forEach(set => {
        const item = plan[Math.max(0, Math.round(n(set.itemIndex, 0)))] || {};
        rememberLoadForExercise(item, set.weightKg);
      });
      CACHE.loaded = false;
      CACHE.status = txt("Seance ajustee et kcal recalcules.", "Workout adjusted and calories recalculated.");
      closeSportSessionSandbox();
      await loadHistory();
    } catch (e) {
      CACHE.error = e?.message || String(e);
      CACHE.status = txt("Ajustement local impossible a synchroniser pour le moment.", "Adjustment could not sync for now.");
      console.warn("[sport] sandbox save failed", CACHE.error);
    }
    renderSport("session-sandbox-save");
  }

  async function requestWakeLock() {
    try {
      if (!CACHE.timer || document.visibilityState === "hidden") return;
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
  function handleTimerVisibilityChange(reason) {
    if (!CACHE.timer) return;
    saveTimerState();
    if (document.visibilityState === "visible") {
      cancelTimerNotification();
      requestWakeLock();
      startTicker();
      if (CACHE.timerFocus) restoreTimerFullscreen(reason || "visible");
      if ((window.activeView || "") === "sport") renderSport(reason || "visible");
    } else {
      notifyTimerInBackground(reason || "hidden");
    }
  }

  window.addEventListener("tb:auth_scope_changed", () => {
    sportStore.resetAccountScope();
    reloadScopedLocalState(true);
  });
  try { document.addEventListener("visibilitychange", () => handleTimerVisibilityChange("visibility")); } catch (_) {}
  try {
    const App = window.Capacitor?.Plugins?.App || window.Capacitor?.App;
    if (App?.addListener) {
      App.addListener("appStateChange", (state) => {
        if (state?.isActive) handleTimerVisibilityChange("app-active");
        else notifyTimerInBackground("app-background");
      });
      App.addListener("resume", () => handleTimerVisibilityChange("app-resume"));
    }
  } catch (_) {}

  window.renderSport = renderSport;
  window.tbSportPlannedWeekRows = function tbSportPlannedWeekRows(baseDay) {
    const rows = sessionFavoriteRows();
    const program = CACHE.program || loadSportProgram();
    return plannedSportWeekRows(rows, program, baseDay || todayISO()).map(row => ({
      day: row.day,
      weekday: row.weekday,
      code: row.code,
      weekLabel: row.weekLabel,
      planned: row.planned,
      sessionId: row.session?.id || "",
      sessionName: row.session?.name || "",
      exerciseCount: Array.isArray(row.session?.plan) ? row.session.plan.length : 0,
    }));
  };
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
