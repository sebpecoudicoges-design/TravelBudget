/* =========================
   Settings: voyages + segments UI
   - Voyage = row in periods (dates only editable in UI)
   - Segments = budget_segments (daily budget + base currency + FX)
   ========================= */

/* ---------- helpers ---------- */

function _tbToastOk(msg){ try{ if(typeof toastOk==="function") return toastOk(msg); }catch(_){}
  try{ if(typeof toastInfo==="function") return toastInfo(msg); }catch(_){}
  try{ if(typeof toastWarn==="function") return toastWarn(msg); }catch(_){}
  try{ alert(msg); }catch(_){}
}

function _tbParseNum(v){
  if(v===null||v===undefined) return NaN;
  const s = String(v).replace(/\u00A0/g,' ').trim().replace(/\s+/g,'');
  if(!s) return NaN;
  return Number(s.replace(',', '.'));
}

function _tbISO(d){
  if(!d) return null;
  if(typeof d==="string") return d.slice(0,10);
  try{ return new Date(d).toISOString().slice(0,10); }catch(_){ return null; }
}

// Normalize a budget segment row coming either from:
// - state.budgetSegments (already normalized by loadFromSupabase)
// - raw Supabase rows (snake_case)
function _tbNormSeg(row){
  const r = row || {};
  const start = _tbISO(r.start || r.start_date || r.startDate);
  const end   = _tbISO(r.end   || r.end_date   || r.endDate);
  const baseCurrencyRaw = (r.baseCurrency || r.base_currency || r.base || r.currency || "");
  const dailyRaw = (r.dailyBudgetBase !== undefined) ? r.dailyBudgetBase : r.daily_budget_base;
  const fxModeRaw = (r.fxMode || r.fx_mode || r.fx || "");
  const rateRaw = (r.eurBaseRateFixed !== undefined) ? r.eurBaseRateFixed : r.eur_base_rate_fixed;
  const sortRaw = (r.sortOrder !== undefined) ? r.sortOrder : r.sort_order;

  const out = Object.assign({}, r);
  out.periodId = r.periodId || r.period_id || out.periodId || null;
  out.start = start;
  out.end = end;
  // keep snake_case mirrors too (some helpers still expect them)
  out.start_date = start;
  out.end_date = end;
  out.baseCurrency = String(baseCurrencyRaw || "").trim().toUpperCase();
  out.base_currency = out.baseCurrency;
  out.dailyBudgetBase = Number.isFinite(Number(dailyRaw)) ? Number(dailyRaw) : (dailyRaw ?? 0);
  out.daily_budget_base = out.dailyBudgetBase;
    // FX policy: Auto always wins; segment-fixed rates are deprecated.
  // Keep legacy values only for debugging/migration visibility.
  out._legacyFxMode = String(fxModeRaw || "").trim();
  out._legacyEurBaseRateFixed = (rateRaw === null || rateRaw === undefined || rateRaw === "") ? null : Number(rateRaw);

  out.fxMode = "live_ecb";
  out.fx_mode = out.fxMode;
  out.eurBaseRateFixed = null;
  out.eur_base_rate_fixed = null;
  const nightTransportRaw = (r.transportNightBudget !== undefined) ? r.transportNightBudget : (r.transport_night_budget !== undefined ? r.transport_night_budget : r.night_transport_budget);
  out.transportNightBudget = Number.isFinite(Number(nightTransportRaw)) ? Number(nightTransportRaw) : null;
  out.transport_night_budget = out.transportNightBudget;
  out.sortOrder = Number.isFinite(Number(sortRaw)) ? Number(sortRaw) : 0;
  out.sort_order = out.sortOrder;
  return out;
}



function _tbNightTransportBudgetMap(){
  try { return JSON.parse(localStorage.getItem("travelbudget_night_transport_budget_v1") || "{}") || {}; } catch (_) { return {}; }
}
function _tbGetNightTransportBudget(segId){
  const key = String(segId || '');
  const seg = (state?.budgetSegments || []).find(x => String(x.id) === key) || null;
  const sqlVal = Number(seg?.transportNightBudget ?? seg?.transport_night_budget ?? seg?.night_transport_budget);
  if (Number.isFinite(sqlVal) && sqlVal > 0) return sqlVal;
  const map = _tbNightTransportBudgetMap();
  const n = Number(map[key]);
  return Number.isFinite(n) && n > 0 ? n : 400;
}
function _tbSetNightTransportBudget(segId, amount){
  const key = String(segId || '');
  if (!key) return;
  const map = _tbNightTransportBudgetMap();
  const n = Number(amount);
  map[key] = Number.isFinite(n) && n > 0 ? n : 400;
  try { localStorage.setItem('travelbudget_night_transport_budget_v1', JSON.stringify(map)); } catch (_) {}
}

function _tbAddDays(iso, n){
  const dt = new Date(iso+"T00:00:00Z");
  dt.setUTCDate(dt.getUTCDate()+n);
  return dt.toISOString().slice(0,10);
}

function _tbCmpISO(a,b){
  return String(a||'').slice(0,10).localeCompare(String(b||'').slice(0,10));
}

function _tbManualFxMeta(cur){
  const c = String(cur||'').toUpperCase();
  try{
    const map = (typeof window.tbFxGetManualRates === "function") ? (window.tbFxGetManualRates() || {}) : {};
    const raw = map && map[c];
    const rate = Number(raw && raw.rate);
    const asOf = raw && raw.asOf ? String(raw.asOf).slice(0,10) : null;
    const refDay = (typeof window.tbFxRefDay === "function") ? String(window.tbFxRefDay()||'').slice(0,10) : null;
    const autoOk = (typeof window.tbFxIsAutoAvailable === "function") ? !!window.tbFxIsAutoAvailable(c) : false;
    const hasManual = Number.isFinite(rate) && rate > 0;
    const stale = c && c !== 'EUR' && ((!autoOk && !hasManual) || (!!hasManual && refDay && asOf && _tbCmpISO(asOf, refDay) < 0));
    return { cur:c, rate:hasManual ? rate : null, asOf, refDay, autoOk, hasManual, stale };
  }catch(_){ return { cur:c, rate:null, asOf:null, refDay:null, autoOk:false, hasManual:false, stale:false }; }
}

function _tbPickResolvedCountry(resolved, override, travel){
  const rows = Array.isArray(window.__tbBudgetRefCountries) ? window.__tbBudgetRefCountries : [];
  const wantedName = String(override?.country_name || resolved?.country_name || '').trim().toLowerCase();
  if (wantedName && rows.length) {
    const byName = rows.find(r => String(r.country_name || '').trim().toLowerCase() === wantedName);
    if (byName) return { country_code: String(byName.country_code || '').toUpperCase(), region_code: String(byName.region_code || '') };
  }
  const hasPeriodCountry = !!(override?.country_code || override?.country_name || override?.region_code || resolved?.resolved_country_code || resolved?.reference_country_code || resolved?.country_code || resolved?.country_name || resolved?.resolved_region_code || resolved?.reference_region_code || resolved?.region_code);
  const pairs = [
    [override?.country_code, override?.region_code],
    [resolved?.resolved_country_code, resolved?.resolved_region_code],
    [resolved?.reference_country_code, resolved?.reference_region_code],
    [resolved?.country_code, resolved?.region_code],
  ];
  if (!hasPeriodCountry) pairs.push([travel?.country_code, travel?.region_code]);
  for (const pair of pairs) {
    const code = String(pair?.[0] || '').trim().toUpperCase();
    if (code) return { country_code: code, region_code: String(pair?.[1] || '') };
  }
  return { country_code:'', region_code:'' };
}

function _tbGetSB(){
  try{ if(typeof sb!=="undefined" && sb && typeof sb.from==="function") return sb; }catch(_){}
  try{ if(window.sb && typeof window.sb.from==="function") return window.sb; }catch(_){}
  try{ if(window.supabase && typeof window.supabase.from==="function") return window.supabase; }catch(_){}
  try{ if(window.supabaseClient && typeof window.supabaseClient.from==="function") return window.supabaseClient; }catch(_){}
  return null;
}

async function _tbAuthUid(){
  try{
    if(window.state && state.session && state.session.user && state.session.user.id) return state.session.user.id;
  }catch(_){}
  const s = _tbGetSB();
  if(!s) return null;
  try{
    if(s.auth && typeof s.auth.getUser==="function"){
      const r = await s.auth.getUser();
      const u = r && r.data && r.data.user;
      if(u && u.id) return u.id;
    }
  }catch(_){}
  try{
    if(s.auth && typeof s.auth.getSession==="function"){
      const r = await s.auth.getSession();
      const ss = r && r.data && r.data.session;
      if(ss && ss.user && ss.user.id) return ss.user.id;
    }
  }catch(_){}
  try{
    if(s.auth && typeof s.auth.session==="function"){
      const ss = s.auth.session();
      if(ss && ss.user && ss.user.id) return ss.user.id;
    }
  }catch(_){}
  return null;
}

function _tbGetActiveTravelRow() {
  const tid = String(state?.activeTravelId || "");
  return (state.travels || []).find(t => String(t.id) === tid) || null;
}

function _tbGetTravelPrimaryPeriod(travelId) {
  const tid = String(travelId || "");
  if (!tid) return null;
  const rows = (state.periods || [])
    .filter(p => String(p.travelId || p.travel_id || "") === tid)
    .slice()
    .sort((a, b) => String(a.start || a.start_date || "").localeCompare(String(b.start || b.start_date || "")));
  return rows[0] || null;
}

function _tbGetVisibleTravels() {
  return (state.travels || [])
    .filter(t => !!_tbGetTravelPrimaryPeriod(t.id))
    .slice()
    .sort((a, b) => String(a.start || a.start_date || "").localeCompare(String(b.start || b.start_date || "")));
}

function _tbFormatTravelOptionLabel(t) {
  const row = t || {};
  const name = String(row.name || "").trim();
  const start = _tbISO(row.start || row.start_date);
  const end = _tbISO(row.end || row.end_date);
  const range = (start && end) ? `${start} → ${end}` : (start || end || "");
  return name || (`Voyage ${range}`.trim()) || "Voyage";
}

function _tbSetActiveTravelAndPeriod(travelId, periodId) {
  const tid = String(travelId || "");
  const pid = String(periodId || "");

  if (tid) {
    state.activeTravelId = tid;
    try { localStorage.setItem("travelbudget_active_travel_id_v1", tid); } catch (_) {}
  }

  if (pid) {
    const p = (state.periods || []).find(x => String(x.id) === pid);
    if (p) state.period = p;
    try { localStorage.setItem("travelbudget_active_period_id_v1", pid); } catch (_) {}
  }
}

async function _tbSaveActiveTravelName(name) {
  const s = _tbGetSB();
  if (!s) throw new Error("Supabase non prêt.");

  const tid = String(state?.activeTravelId || "");
  if (!tid) throw new Error("Aucun voyage actif.");

  const clean = String(name || "").trim();
  if (!clean) throw new Error("Nom du voyage requis.");

  const { error } = await s
    .from(TB_CONST.TABLES.travels)
    .update({
      name: clean,
      updated_at: new Date().toISOString()
    })
    .eq("id", tid);

  if (error) throw error;

  const row = (state.travels || []).find(t => String(t.id) === tid);
  if (row) row.name = clean;
}

/* ---------- data loaders ---------- */

async function loadPeriodsListIntoUI(){
  const sel = document.getElementById("s-period");
  if(!sel) return;

  sel.innerHTML = "";
  const travels = _tbGetVisibleTravels();
  travels.forEach(t=>{
    const opt = document.createElement("option");
    opt.value = t.id;
    opt.textContent = _tbFormatTravelOptionLabel(t);
    sel.appendChild(opt);
  });

  let activeTravelId = String(state?.activeTravelId || "");
  if (!travels.some(t => String(t.id) === activeTravelId)) {
    activeTravelId = String(travels[0]?.id || "");
    if (activeTravelId) {
      const activePeriod = _tbGetTravelPrimaryPeriod(activeTravelId);
      _tbSetActiveTravelAndPeriod(activeTravelId, activePeriod?.id || "");
    }
  }
  if(activeTravelId){
    sel.value = activeTravelId;
    const activePeriod = _tbGetTravelPrimaryPeriod(activeTravelId);
    if (activePeriod) state.period = activePeriod;
  }

  try {
    const inp = document.getElementById("s-period-name");
    if (inp) {
      const t = _tbGetActiveTravelRow();
      inp.value = t?.name || "";
    }
  } catch (_) {}

  sel.onchange = async ()=>{
    const travelId = String(sel.value || "");
    const p = _tbGetTravelPrimaryPeriod(travelId);
    if (!travelId || !p) return;

    _tbSetActiveTravelAndPeriod(travelId, p.id);

    try {
      const inp = document.getElementById("s-period-name");
      const t = _tbGetActiveTravelRow();
      if (inp) inp.value = String(t?.name || "").trim();
    } catch (_) {}

    if (typeof window.refreshFromServer === "function") {
      await window.refreshFromServer();
    } else if (typeof refreshFromServer === "function") {
      await refreshFromServer();
    }

    await refreshSegmentsForActivePeriod();
    renderSettings();
  };
}

async function refreshSegmentsForActivePeriod(){
  const s = _tbGetSB();
  if(!s) throw new Error("Supabase non prêt.");
  const pid = state.period && state.period.id;
  if(!pid) return;

  const { data, error } = await s
    .from(TB_CONST.TABLES.budget_segments)
    .select("*")
    .eq("period_id", pid)
    .order("start_date", { ascending: true })
    .order("sort_order", { ascending: true });

  if(error) throw error;
  state.budgetSegments = (data || []).map(_tbNormSeg);
}

/* ---------- render ---------- */


function _tbSettingsGetPanelState(key, fallbackOpen){
  return window.TBSettingsView?.getSettingsPanelState?.(key, fallbackOpen, localStorage) ?? !!fallbackOpen;
}

function _tbSettingsSetPanelState(key, isOpen){
  window.TBSettingsView?.setSettingsPanelState?.(key, isOpen, localStorage);
}

function _tbSettingsCardSummary(card){
  const T = window.tbT || ((k) => k);
  const title = String(card?.querySelector('h2')?.textContent || '').trim() || T('settings.hero.title');
  return window.TBSettingsView?.getSettingsCardSummary?.({
    id: String(card?.id || card?.className || ''),
    title,
    state,
    t: T,
  }) || { kicker:T('settings.hero.title'), summary:title, pills:[] };
}

function _tbSettingsEnsureHero(view){
  return window.TBSettingsView?.ensureSettingsHero?.(view, {
    state,
    t: window.tbT || ((k)=>k),
    esc: escapeHTML,
    documentRef: document,
  });
}

function _tbSettingsDecoratePanels(view){
  return window.TBSettingsView?.decorateSettingsPanels?.(view, {
    state,
    t: window.tbT || ((k)=>k),
    storage: localStorage,
    documentRef: document,
  });
}

function renderSettings(){
  const T = (window.tbT ? tbT : (k, vars) => {
    let s = String(k || "");
    if (vars && typeof vars === "object") Object.keys(vars).forEach((v) => { s = s.replaceAll(`{${v}}`, String(vars[v])); });
    return s;
  });
  const view = document.getElementById("view-settings");
  if(!view) return;

  // labels
  // Settings view now has multiple cards (Compte + Voyage + ...).
  // Ensure we only rename the Voyage card title.
  try {
    const h2s = Array.from(view.querySelectorAll('h2'));
    const voyageH2 = h2s.find(x => String(x.textContent||'').trim().toLowerCase() === 'voyage');
    if (voyageH2) voyageH2.textContent = (window.tbT ? tbT("settings.title") : "Voyage");
  } catch(_) {}

  const p = state.period;
  const segs = (state.budgetSegments || []).map(_tbNormSeg).slice().sort((a,b)=>String(a.start).localeCompare(String(b.start)));

  // Inject lightweight tooltips into the static Settings header labels (once)
  try {
    if (!view.__tbHelpInjected && typeof tbHelp === "function") {
      view.__tbHelpInjected = true;
      const labels = Array.from(view.querySelectorAll("label"));
      const helpDates = (window.tbT ? tbT("settings.help.trip_dates") : "");
      const helpName = (window.tbT ? tbT("settings.help.period_name") : "");
      const helpSegs = (window.tbT ? tbT("settings.help.segments") : "");

      labels.forEach((lab) => {
        const txt = String(lab.textContent || "").trim();
        if (!txt) return;
        if ((txt === "Début" || txt === "Fin") && helpDates) {
          lab.innerHTML = `${escapeHTML(txt)} ${tbHelp(helpDates)}`;
        }
      });

      // Add tooltip to the period name field label (robust: by element id, not label text)
      try {
        const nameInput = document.getElementById("s-period-name");
        const nameLabel = nameInput ? nameInput.closest(".field")?.querySelector("label") : null;
        if (nameLabel && helpName) {
          const baseTxt = String(nameLabel.textContent || "").trim() || "Nom";
          nameLabel.innerHTML = `${escapeHTML(baseTxt)} ${tbHelp(helpName)}`;
        }
      } catch (_) {}

      // Add a hint in the "Périodes du voyage" card title
      const h2s = Array.from(view.querySelectorAll("h2"));
      const periodsH2 = h2s.find(h => String(h.textContent||"").trim() === "Périodes du voyage");
      if (periodsH2 && helpSegs) {
        periodsH2.innerHTML = `${escapeHTML(periodsH2.textContent)} ${tbHelp(helpSegs)}`;
      }
    }
  } catch(_) {}

  // voyage dates reflect real bounds from segments when available
  const startISO = segs.length ? _tbISO(segs[0].start) : _tbISO(p && p.start);
  const endISO   = segs.length ? _tbISO(segs[segs.length-1].end) : _tbISO(p && p.end);

  const inStart = document.getElementById("s-start");
  const inEnd   = document.getElementById("s-end");
  if(inStart){ inStart.type="date"; inStart.value = startISO || ""; }
  if(inEnd){ inEnd.type="date"; inEnd.value = endISO || ""; }

  // ensure periods list
  loadPeriodsListIntoUI();

  try {
    const travelCard = document.getElementById("tb-travel-card");
    if (travelCard) {
      const headerTitle = travelCard.querySelector('h2');
      if (headerTitle) headerTitle.style.display = 'none';
      const topFields = document.getElementById('s-period')?.closest('.row');
      const topActions = travelCard.querySelector('.row[style*="justify-content:flex-end"]');
      if (topFields) topFields.style.display = 'none';
      if (topActions) topActions.style.display = 'none';
      let overview = document.getElementById("tb-travel-overview");
      if (!overview) {
        overview = document.createElement("div");
        overview.id = "tb-travel-overview";
        travelCard.appendChild(overview);
      }
      const travelDefault = window.__tbBudgetReferenceCache?.travelDefault || null;
      const segCount = segs.length;
      const budgetMeta = _tbTravelWeightedBudgetPerDay(segs);
      const budgetAvg = budgetMeta.amount;
      const budgetCur = budgetMeta.currency || String(state?.user?.baseCurrency || 'EUR').toUpperCase();
      const recoDay = Number(travelDefault?.recommended_daily_amount || 0);
      const recoCur = String(travelDefault?.currency_code || 'EUR').toUpperCase();
      const totalDays = budgetMeta.totalDays || 0;
      const budgetBaseCur = _tbSettingsBaseCurrency();
      const budgetDual = (budgetAvg!==null && budgetCur) ? _tbFmtDualAmount(budgetAvg, budgetCur, budgetBaseCur, 0, 2) : { main:'—', secondary:null };
      const recoDual = (Number.isFinite(recoDay)&&recoDay>0) ? _tbFmtDualAmount(recoDay, recoCur, budgetBaseCur, 2, 2) : { main:'—', secondary:null };
      const budgetBaseAmount = _tbTryConvert(budgetAvg, budgetCur, budgetBaseCur);
      const recoBaseAmount = _tbTryConvert(recoDay, recoCur, budgetBaseCur);
      const perPost = [
        ['Logement', travelDefault?.recommended_accommodation_daily_amount],
        ['Repas', travelDefault?.recommended_food_daily_amount],
        ['Transport', travelDefault?.recommended_transport_daily_amount],
        ['Activités', travelDefault?.recommended_activities_daily_amount],
      ].filter((x)=>Number.isFinite(Number(x[1])) && Number(x[1])>0);
      const settingsEn = typeof window.tbGetLang === 'function' && window.tbGetLang() === 'en';
      const st = (fr, en) => settingsEn ? en : fr;
      overview.innerHTML = window.TBSettingsView?.renderSettingsTravelOverview?.({
        travelName: String(_tbGetActiveTravelRow()?.name || ''),
        segmentCount: segCount,
        totalDays,
        baseCurrency: budgetBaseCur,
        budgetMain: budgetDual.main || '—',
        budgetSecondary: budgetDual.secondary,
        referenceMain: travelDefault?.country_name || travelDefault?.country_code || '—',
        referenceSub: travelDefault ? `${String(travelDefault.travel_profile||'solo')} · ${String(travelDefault.travel_style||'standard')}` : st('À définir', 'To define'),
        recommendationMain: recoDual.main,
        recommendationSecondary: recoDual.secondary,
        cadenceMain: (Number.isFinite(budgetBaseAmount) && Number.isFinite(recoBaseAmount)) ? (budgetBaseAmount <= recoBaseAmount ? st('Sous la reco', 'Below reco') : st('Au-dessus', 'Above')) : st('À calibrer', 'To calibrate'),
        cadenceSub: (Number.isFinite(budgetBaseAmount) && Number.isFinite(recoBaseAmount)) ? `${Math.abs(budgetBaseAmount-recoBaseAmount).toFixed(2)} ${budgetBaseCur} ${st("d'écart", 'gap')}` : st('Référence requise', 'Reference required'),
        startISO,
        endISO,
        countryOptionsHtml: _tbBudgetRefCountryOptions(travelDefault?.country_code, travelDefault?.region_code),
        profile: travelDefault?.travel_profile || 'solo',
        style: travelDefault?.travel_style || 'standard',
        adults: travelDefault?.adult_count ?? 1,
        children: travelDefault?.child_count ?? 0,
        posts: perPost.map(([label,val]) => ({
          label,
          amount: _tbBudgetRefFmtAmount(val,recoCur,2),
        })),
        lang: settingsEn ? 'en' : 'fr',
        esc: escapeHTML,
      }) || '';
      const sel = overview.querySelector('#tb-inline-travel-select');
      if (sel) {
        _tbGetVisibleTravels().forEach((t)=>{ const opt=document.createElement('option'); opt.value=t.id; opt.textContent=_tbFormatTravelOptionLabel(t); sel.appendChild(opt); });
        sel.value = String(state?.activeTravelId || '');
        sel.onchange = async ()=>{
          const travelId = String(sel.value || '');
          const p0 = _tbGetTravelPrimaryPeriod(travelId);
          if (!travelId || !p0) return;
          _tbSetActiveTravelAndPeriod(travelId, p0.id);
          await (window.refreshFromServer ? window.refreshFromServer() : refreshFromServer());
        };
      }
      const syncPairs = [
        ['tb-inline-travel-name','s-period-name'],
        ['tb-inline-travel-start','s-start'],
        ['tb-inline-travel-end','s-end'],
      ];
      syncPairs.forEach(([a,b])=>{ const A=overview.querySelector('#'+a), B=document.getElementById(b); if(A&&B){ A.oninput=()=>{ B.value=A.value; }; B.value=A.value; } });
      const saveBtn = overview.querySelector('#tb-inline-save-travel');
      if (saveBtn) saveBtn.onclick = ()=>safeCall('Enregistrer le voyage', ()=>saveSettings());
    }
  } catch(_) {}

  // =========================
  // Account section (email + base currency + reset password)
  // =========================
  try {
    const box = document.getElementById("tb-account-box");
    if (box) {
      const cur = String((state?.user?.baseCurrency) || "EUR").toUpperCase();
      const opts = (typeof window.tbGetAvailableCurrencies === "function") ? window.tbGetAvailableCurrencies() : ["EUR","USD","THB"];

      // Cashflow threshold stored as EUR reference so it auto-adjusts when base currency changes.
      // (Account-level preference; we keep it in localStorage for now to avoid a SQL migration.)
      const THR_KEY = (TB_CONST?.LS_KEYS?.cashflow_threshold_eur || "travelbudget_cashflow_threshold_eur_v1");
      let thrEur = 500;
      try {
        const raw = localStorage.getItem(THR_KEY);
        const n = Number(raw);
        if (Number.isFinite(n) && n > 0) thrEur = n;
      } catch(_) {}
      const thrInBase = (typeof window.safeFxConvert === "function")
        ? window.safeFxConvert(thrEur, "EUR", cur, null)
        : (typeof window.fxConvert === "function" ? window.fxConvert(thrEur, "EUR", cur) : null);
      const thrDisp = (thrInBase === null || !Number.isFinite(thrInBase)) ? "" : String(Math.round(thrInBase));
      const notifPrefs = (typeof window.tbGetNotificationPrefs === "function")
        ? window.tbGetNotificationPrefs()
        : { inbox:true, trip:true, dailyBudget:false, morningBudget:false, eveningSummary:false, serverPush:true, lowBudget:true, localDevice:false };
      const birthDateKey = TB_CONST?.LS_KEYS?.body_birthdate || "travelbudget_body_birthdate_v1";
      const bodyWeightKey = TB_CONST?.LS_KEYS?.sport_body_weight || "travelbudget_sport_body_weight_v1";
      const bodyHeightKey = TB_CONST?.LS_KEYS?.sport_body_height || "travelbudget_sport_body_height_v1";
      const savedBirthDate = (() => {
        try { return String(state?.user?.birthDate || localStorage.getItem(birthDateKey) || "").slice(0, 10); } catch (_) { return String(state?.user?.birthDate || "").slice(0, 10); }
      })();
      const savedBodyWeight = (() => {
        try { return String(state?.user?.bodyWeightKg || window.tbReadScopedLocalStorage?.(bodyWeightKey, "") || "").trim(); } catch (_) { return String(state?.user?.bodyWeightKg || "").trim(); }
      })();
      const savedBodyHeight = (() => {
        try { return String(state?.user?.bodyHeightCm || window.tbReadScopedLocalStorage?.(bodyHeightKey, "") || "").trim(); } catch (_) { return String(state?.user?.bodyHeightCm || "").trim(); }
      })();

      box.innerHTML = window.TBSettingsView?.renderSettingsAccountPanel?.({
        baseCurrency: cur,
        currencies: opts,
        savedBirthDate,
        savedBodyWeight,
        savedBodyHeight,
        thresholdDisplay: thrDisp,
        thresholdEur: thrEur,
        notificationPrefs: notifPrefs,
        simpleMode: (typeof window.tbIsSimpleMode === 'function' && window.tbIsSimpleMode()),
        t: T,
        esc: escapeHTML,
      }) || "";

      window.TBSettingsAccountController?.bindSettingsAccountPanel?.({
        box,
        state,
        constants: TB_CONST,
        thresholdKey: THR_KEY,
        currency: cur,
        notificationPrefs: notifPrefs,
        safeCall,
        getSupabase: () => {
          try {
            if (typeof window._tbSb === "function") return window._tbSb();
            if (window.__TB_SB__) return window.__TB_SB__;
            if (window.sb) return window.sb;
          } catch(_){ }
          throw new Error("Supabase client not found");
        },
        isOffline: () => {
          try { return (typeof window.tbIsOfflineMode === "function" && window.tbIsOfflineMode()) || (navigator && navigator.onLine === false); } catch (_) { return false; }
        },
        localStorageRef: localStorage,
        windowRef: window,
        navigatorRef: navigator,
        requestRenderAll: (typeof tbRequestRenderAll === "function") ? tbRequestRenderAll : null,
        renderAll,
        syncTabsForRole: (typeof syncTabsForRole === "function") ? syncTabsForRole : (() => {}),
        alertFn: (message) => alert(message),
        consoleRef: console,
      });
    }
  } catch (_) {}


  // segments area
  const host = document.getElementById("seg-list");
  if(host){
    host.innerHTML = "";
    host.classList.add("tb-period-stack");

    // --- FX status + custom rates ---


    const _fxHelp = (window.tbT ? tbT("settings.help.fx") : [
      "Taux automatique : mis à jour régulièrement (week-end ok).",
      "Taux perso : utilisé seulement si le taux auto est indisponible.",
      "Si aucun taux dispo : saisie requise."
    ].join("\n"));


    const fxStatus = (typeof window.tbFxAutoStatus === "function") ? window.tbFxAutoStatus() : null;
    const refDay = (typeof window.tbFxRefDay === "function") ? window.tbFxRefDay() : (function(){
      try {
        const asof = String(localStorage.getItem(TB_CONST.LS_KEYS.eur_rates_asof) || "").slice(0,10);
        if (asof) return asof;
      } catch(_){ }
      return (typeof toLocalISODate === "function") ? toLocalISODate(new Date()) : new Date().toISOString().slice(0,10);
    })();

    const ecbAsof = fxStatus ? fxStatus.asOf : (function(){ try { return String(localStorage.getItem(TB_CONST.LS_KEYS.eur_rates_asof) || "").slice(0,10) || null; } catch(_){ return null; } })();
    const ecbCount = fxStatus ? (fxStatus.count||0) : (function(){ try { return JSON.parse(localStorage.getItem(TB_CONST.LS_KEYS.eur_rates_keys) || "[]").length || 0; } catch(_){ return 0; } })();

    // Taux perso / change (bloc séparé du voyage et des périodes)
    let manualHost = document.getElementById('manual-fx-box');
    if (manualHost) {
      manualHost.innerHTML = '';
      const periodsCard = document.getElementById('tb-periods-card');
      if (periodsCard && manualHost.parentElement === periodsCard) {
        periodsCard.insertAdjacentElement('afterend', manualHost);
        manualHost.style.marginTop = '12px';
      }
    }
    const manualPanel = document.createElement("div");
    manualPanel.className = "card";
    manualPanel.style.marginBottom = "10px";
    manualPanel.style.borderRadius = '18px';
    manualPanel.style.background = 'linear-gradient(180deg, rgba(239,246,255,.92), rgba(255,255,255,.88))';

    let manualRates = {};
    try { manualRates = (typeof window.tbFxGetManualRates === "function") ? (window.tbFxGetManualRates() || {}) : {}; } catch(_) { manualRates = {}; }
    const manualList = window.TBSettingsView?.normalizeManualFxRates?.({
      manualRates,
      manualFxMeta: _tbManualFxMeta,
    }) || [];
    manualPanel.innerHTML = window.TBSettingsView?.renderSettingsManualFxPanel?.({
      manualList,
      t: T,
      esc: escapeHTML,
    }) || "";
    (manualHost || host).appendChild(manualPanel);

    const _mfAskCur = () => {
      const raw = prompt("Devise (ISO3) ?", "");
      if (raw === null) return null;
      const c = String(raw||"").trim().toUpperCase();
      if (!c || !/^[A-Z]{3}$/.test(c) || c === "EUR") {
        alert("Devise invalide (ISO3, ex: LAK, VND). EUR interdit.");
        return null;
      }
      return c;
    };

    manualPanel.querySelector('[data-act="mf-add"]').onclick = ()=>safeCall("Ajouter taux manuel", ()=>{
      if (typeof window.tbFxPromptManualRate !== "function") throw new Error("tbFxPromptManualRate() manquant");
      const c = _mfAskCur();
      if (!c) return;
      window.tbFxPromptManualRate(c, "Taux perso");
      renderSettings();
    });

    const mfToggle = manualPanel.querySelector('[data-act="mf-toggle"]');
    const mfList = manualPanel.querySelector('[data-manual-fx-list]');
    if (mfToggle && mfList) { const arrow = manualPanel.querySelector('[data-manual-fx-arrow]'); mfToggle.onclick = (ev)=>{ if (ev.target && ev.target.closest('[data-act="mf-add"]')) return; const open = (mfList.style.display === 'none'); mfList.style.display = open ? '' : 'none'; if (arrow) arrow.textContent = open ? '⌄' : '›'; }; }

    manualPanel.querySelectorAll('[data-act="mf-edit"]').forEach(btn=>{
      btn.onclick = ()=>safeCall("Modifier taux manuel", ()=>{
        const c = btn.getAttribute('data-cur');
        if (!c) return;
        if (typeof window.tbFxPromptManualRate !== "function") throw new Error("tbFxPromptManualRate() manquant");
        window.tbFxPromptManualRate(c, "Taux perso");
        renderSettings();
      });
    });

    manualPanel.querySelectorAll('[data-act="mf-del"]').forEach(btn=>{
      btn.onclick = ()=>safeCall("Supprimer taux manuel", ()=>{
        const c = btn.getAttribute('data-cur');
        if (!c) return;
        const ok = confirm(`Supprimer le taux perso EUR→${c} ?`);
        if (!ok) return;
        if (typeof window.tbFxDeleteManualRate !== "function") throw new Error("tbFxDeleteManualRate() manquant");
        window.tbFxDeleteManualRate(c);
        renderSettings();
      });
    });

    // --- Segments (period slices) ---
    const cache = window.__tbBudgetReferenceCache || {};
    const travel = (cache && cache.travelDefault) ? cache.travelDefault : null;
    if(!segs.length){
      host.innerHTML += '<div class="muted">Aucune période (segment) pour ce voyage.</div>';
    }else{
      segs.forEach((seg, idx)=>{
        const wrap = document.createElement("div");
        wrap.className = "card";
        wrap.style.marginBottom = "12px";
        wrap.style.border = "1px solid rgba(15,23,42,.08)";
        wrap.style.borderRadius = "20px";
        wrap.style.background = "linear-gradient(180deg, rgba(255,255,255,.98), rgba(248,250,252,.94))";
        wrap.style.boxShadow = "0 18px 40px rgba(15,23,42,.06)";
        const cur = String(seg.baseCurrency||"").toUpperCase();
        const ratesMerged = (typeof window.fxGetEurRates === "function") ? window.fxGetEurRates() : null;
        const usedRate = (typeof window.fxRate==="function" && ratesMerged) ? window.fxRate("EUR", cur, ratesMerged) : null;
        const rateDisplay = (usedRate!==null && usedRate!==undefined && Number.isFinite(Number(usedRate))) ? String(Number(usedRate).toFixed(2)) : "—";

        wrap.classList.add('tb-period-card');
        const defaultOpen = false;
        wrap.classList.toggle('is-collapsed', !defaultOpen);
        const baseCur = _tbSettingsBaseCurrency();
        const localDual = _tbFmtDualAmount(seg.dailyBudgetBase, cur, baseCur, 0, 2);
        const override = (cache && cache.segmentOverrides) ? (cache.segmentOverrides[String(seg.id)] || null) : null;
        const resolved = (cache && cache.segmentResolved) ? (cache.segmentResolved[String(seg.id)] || null) : null;
        const resolvedCountry = _tbPickResolvedCountry(resolved, override, travel);
        const fxMeta = _tbManualFxMeta(cur);
        const periodEn = typeof window.tbGetLang === 'function' && window.tbGetLang() === 'en';
        const pt = (fr, en) => periodEn ? en : fr;
        wrap.innerHTML = window.TBSettingsView?.renderSettingsPeriodCard?.({
          segment: { ...seg, start: _tbISO(seg.start), end: _tbISO(seg.end) },
          currency: cur,
          durationDays: _tbBudgetRefDurationDays(seg),
          countryLabel: resolved?.country_name || resolved?.country_code || override?.country_name || override?.country_code || travel?.country_name || travel?.country_code || "—",
          localAmountMain: localDual.main,
          rateDisplay,
          nightTransportBudget: _tbBudgetRefFmtAmount(_tbGetNightTransportBudget(seg.id), cur, 0),
          fxNeedsUpdate: !!fxMeta.stale,
          override,
          resolvedCountry,
          countryOptionsHtml: _tbBudgetRefCountryOptions(resolvedCountry.country_code, resolvedCountry.region_code),
          helpHtml: typeof tbHelp==='function' ? tbHelp(pt('Montant dédié aux nuits passées en transport.', 'Amount dedicated to nights spent in transport.')) : '',
          lang: periodEn ? 'en' : 'fr',
          t: T,
          esc: escapeHTML,
        }) || "";
        _tbBudgetRefWireSegmentMode(wrap);

        // handlers
        const toggleBtn = wrap.querySelector('[data-act="toggle-period"]');
        if (toggleBtn) {
          toggleBtn.onclick = ()=>{
            wrap.classList.toggle('is-collapsed');
          };
        }
        const editBtn = wrap.querySelector('[data-act="edit-seg"]');
        if (editBtn) editBtn.onclick = ()=>{ wrap.classList.add('is-editing'); wrap.classList.remove('is-collapsed'); try{ const y = wrap.getBoundingClientRect().top + window.scrollY - 176; window.scrollTo({ top: Math.max(0, y), behavior:'smooth' }); }catch(_){} };
        const cancelBtn = wrap.querySelector('[data-act="edit-cancel"]');
        if (cancelBtn) cancelBtn.onclick = ()=>{ wrap.classList.remove('is-editing'); };
        wrap.querySelector('[data-act="save"]').onclick = ()=>safeCall("Save période", async ()=>{ 
          await saveBudgetSegment(seg.id, wrap); 
          const mode = String(wrap.querySelector('[data-br="seg-mode"]')?.value || 'inherit');
          const s2 = _tbGetSB();
          if(mode !== 'custom'){
            const { error } = await s2.rpc(TB_CONST.RPCS.budget_reference_compute_for_budget_segment, { p_budget_segment_id: String(seg.id), p_save: false, p_disable_override: true });
            if (error) throw error;
          } else {
            const payload = _tbBudgetRefSegmentPayload(wrap, seg);
            if(!payload.p_country_code){
              const countrySel = wrap.querySelector('[data-br="seg-country"]');
              if (countrySel) {
                countrySel.focus();
                countrySel.classList.add('is-invalid');
                setTimeout(()=>countrySel.classList.remove('is-invalid'), 1400);
              }
              const modeField = wrap.querySelector('[data-br="seg-mode"]');
              if (modeField) modeField.focus();
              return;
            }
            const { error } = await s2.rpc(TB_CONST.RPCS.budget_reference_compute_for_budget_segment, payload);
            if (error) throw error;
          }
          wrap.classList.remove('is-editing'); 
          await window.tbRenderBudgetReferenceUI();
        });
        const fxBtn = wrap.querySelector('[data-act="fx"]');
        if(fxBtn){
          fxBtn.onclick = ()=>safeCall("Taux manuel", ()=>{ 
            if(typeof window.tbFxEnsureManualRateToday === "function") window.tbFxEnsureManualRateToday(cur, "Devise non fournie par les taux auto");
            renderSettings();
          });
        }
        wrap.querySelector('[data-act="del"]').onclick = () => {
          const readiness = window.TBSettingsView?.getBudgetSegmentDeleteReadiness?.({
            segments: state.budgetSegments || [],
            segmentId: seg.id,
          });
          if (readiness && !readiness.ok) {
            _tbToastOk(readiness.reason || "Suppression impossible.");
            return;
          }
          safeCall("Supprimer période", () => deleteBudgetSegment(seg.id));
        };
        host.appendChild(wrap);
      });
    }
  }

  try { window.tbRenderBudgetReferenceUI && window.tbRenderBudgetReferenceUI(); } catch (_) {}

  // Categories (Settings)
  try { renderCategoriesSettingsUI(); } catch (_) {}

  // Recurring rules (Settings)
  try {
    if (typeof window.renderRecurringRules === "function") {
      window.renderRecurringRules();
    }
  } catch (_) {}

  try {
    const hero = view.querySelector('.tb-settings-hero');
    if (hero) hero.remove();
    view.querySelectorAll('.tb-settings-panel').forEach((card)=>{ card.classList.remove('tb-settings-panel','is-collapsed'); });
    view.querySelectorAll('.tb-settings-panel-head,.tb-settings-divider').forEach((el)=>el.remove());
    view.querySelectorAll('.tb-settings-panel-body').forEach((body)=>{
      while (body.firstChild) body.parentNode.insertBefore(body.firstChild, body);
      body.remove();
    });
  } catch (_) {}
}



/* =========================
   Budget reference UI (travel default + visible period override)
   Visible "périodes" in Settings map to budget_segments in the current product.
   ========================= */

window.__tbBudgetReferenceCache = window.__tbBudgetReferenceCache || {
  countries: null,
  travelDefault: null,
  segmentOverrides: {},
  segmentResolved: {},
  travelId: null,
  loading: false,
  seq: 0,
};


function _tbSettingsBaseCurrency(){
  return String(state?.user?.baseCurrency || state?.period?.baseCurrency || 'EUR').toUpperCase();
}
function _tbTryConvert(amount, fromCur, toCur){
  const n = Number(amount);
  const from = String(fromCur||'').toUpperCase();
  const to = String(toCur||'').toUpperCase();
  if (!Number.isFinite(n) || !from || !to || from===to) return n;
  try { if (typeof window.safeFxConvert === 'function') { const out = window.safeFxConvert(n, from, to, null); if (Number.isFinite(out)) return Number(out); } } catch(_){}
  try { if (typeof window.fxConvert === 'function') { const out = window.fxConvert(n, from, to); if (Number.isFinite(out)) return Number(out); } } catch(_){}
  return null;
}
function _tbFmtDualAmount(amount, fromCur, toCur, fromDecimals=0, toDecimals=2){
  const main = _tbBudgetRefFmtAmount(amount, fromCur, fromDecimals);
  const conv = _tbTryConvert(amount, fromCur, toCur);
  if (conv===null || !Number.isFinite(conv) || String(fromCur||'').toUpperCase()===String(toCur||'').toUpperCase()) return { main, secondary:null };
  return { main, secondary:`≈ ${_tbBudgetRefFmtAmount(conv, toCur, toDecimals)}` };
}

function _tbBudgetRefStyle(){
  return {
    section:'margin-top:16px; padding-top:16px; border-top:1px solid var(--border);',
    chip:'display:inline-flex; align-items:center; gap:6px; padding:6px 11px; border-radius:999px; font-size:12px; font-weight:800; background:var(--accent-soft); color:var(--text); border:1px solid var(--border);',
    chipAlt:'display:inline-flex; align-items:center; gap:6px; padding:6px 11px; border-radius:999px; font-size:12px; font-weight:800; background:rgba(148,163,184,.10); color:var(--muted); border:1px solid var(--border);',
    metric:'display:flex; flex-direction:column; min-width:132px; padding:12px 14px; border-radius:16px; background:linear-gradient(180deg, rgba(255,255,255,.72), rgba(255,255,255,.44)); border:1px solid var(--border); box-shadow:0 12px 28px rgba(15,23,42,.05);',
    helper:'padding:11px 13px; border-radius:16px; background:rgba(37,99,235,.08); border:1px solid rgba(37,99,235,.12); color:var(--text);',
  };
}

async function _tbBudgetRefLoadCountries(){
  const cache = window.__tbBudgetReferenceCache;
  if (Array.isArray(cache.countries) && cache.countries.length) return cache.countries;
  if ((typeof window.tbIsOfflineMode === "function" && window.tbIsOfflineMode()) || (navigator && navigator.onLine === false)) return [];
  const s = _tbGetSB();
  if(!s) return [];
  const { data, error } = await s
    .from(TB_CONST.TABLES.v_country_budget_reference_latest)
    .select('country_code,country_name,region_code')
    .order('country_name', { ascending:true });
  if (error) throw error;
  const seen = new Set();
  cache.countries = (data || []).filter((row)=>{
    const key = `${String(row.country_code||'').toUpperCase()}|${String(row.region_code||'')}`;
    if(seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return cache.countries;
}

function _tbBudgetRefDurationDays(seg){
  const start = _tbISO(seg?.start || seg?.start_date);
  const end = _tbISO(seg?.end || seg?.end_date);
  if(!start || !end) return null;
  const a = new Date(start + 'T00:00:00Z');
  const b = new Date(end + 'T00:00:00Z');
  return Math.max(1, Math.round((b - a) / 86400000) + 1);
}

function _tbBudgetRefFmtAmount(amount, currency, digits){
  const n = Number(amount);
  const cur = String(currency || '').trim().toUpperCase();
  if (!Number.isFinite(n)) return '—';
  const d = Number.isFinite(Number(digits)) ? Number(digits) : 2;
  return `${n.toFixed(d)}${cur ? ' ' + cur : ''}`;
}

function _tbTravelWeightedBudgetPerDay(segs){
  const rows = Array.isArray(segs) ? segs : [];
  const target = String(state?.user?.baseCurrency || state?.period?.baseCurrency || 'EUR').toUpperCase();
  let total = 0;
  let totalDays = 0;
  rows.forEach((seg)=>{
    const days = Number(_tbBudgetRefDurationDays(seg) || 0);
    if (!days) return;
    const amount = Number(seg?.dailyBudgetBase || 0);
    const from = String(seg?.baseCurrency || '').toUpperCase();
    let converted = amount;
    try {
      if (typeof window.safeFxConvert === 'function' && from && target) {
        const maybe = window.safeFxConvert(amount, from, target, amount);
        if (Number.isFinite(Number(maybe))) converted = Number(maybe);
      }
    } catch(_) {}
    if (!Number.isFinite(converted)) return;
    total += converted * days;
    totalDays += days;
  });
  return { amount: totalDays ? total / totalDays : null, currency: target, totalDays };
}

function _tbBudgetRefCountryOptions(selectedCode, selectedRegion){
  const rows = Array.isArray(window.__tbBudgetReferenceCache?.countries) ? window.__tbBudgetReferenceCache.countries : [];
  const wanted = `${String(selectedCode||'').toUpperCase()}|${String(selectedRegion||'')}`;
  const opts = ['<option value="">Choisir un pays</option>'];
  rows.forEach((row)=>{
    const code = String(row.country_code || '').toUpperCase();
    const region = String(row.region_code || '');
    const value = `${code}|${region}`;
    const label = region ? `${row.country_name} — ${region}` : `${row.country_name} (${code})`;
    opts.push(`<option value="${escapeHTML(value)}" ${value===wanted?'selected':''}>${escapeHTML(label)}</option>`);
  });
  return opts.join('');
}

function _tbBudgetRefSummaryHtml(rec, label, inheritText){
  const st = _tbBudgetRefStyle();
  const amount = Number(rec?.recommended_daily_amount);
  const country = rec?.country_name || rec?.country_code || '—';
  const profile = rec?.travel_profile || 'solo';
  const style = rec?.travel_style || 'standard';
  const source = label || 'Configuration';
  const hint = inheritText ? `<div style="${st.helper}; margin-top:10px;">${escapeHTML(inheritText)}</div>` : '';
  return `
    <div class="row" style="gap:10px; flex-wrap:wrap; align-items:stretch;">
      <div style="${st.metric}">
        <span class="muted" style="font-size:12px;">Source</span>
        <strong>${escapeHTML(source)}</strong>
      </div>
      <div style="${st.metric}">
        <span class="muted" style="font-size:12px;">Pays</span>
        <strong>${escapeHTML(country)}</strong>
      </div>
      <div style="${st.metric}">
        <span class="muted" style="font-size:12px;">Profil</span>
        <strong>${escapeHTML(profile)} · ${escapeHTML(style)}</strong>
      </div>
      <div style="${st.metric}">
        <span class="muted" style="font-size:12px;">Reco / jour</span>
        <strong>${Number.isFinite(amount) ? escapeHTML(String(amount)) : '—'}</strong>
      </div>
    </div>
    ${hint}
  `;
}

async function _tbBudgetRefLoadState(){
  const s = _tbGetSB();
  if(!s) throw new Error('Supabase non prêt.');
  const tid = String(state?.activeTravelId || '');
  const pid = String(state?.period?.id || '');
  const segs = (state?.budgetSegments || []).slice();
  if(!tid || !pid) return;
  const cache = window.__tbBudgetReferenceCache;
  cache.travelId = tid;
  if ((typeof window.tbIsOfflineMode === "function" && window.tbIsOfflineMode()) || (navigator && navigator.onLine === false)) {
    cache.travelDefault = cache.travelDefault || null;
    cache.segmentOverrides = cache.segmentOverrides || {};
    cache.segmentResolved = cache.segmentResolved || {};
    return;
  }
  const segIds = segs.map((seg)=>String(seg.id)).filter(Boolean);
  const [travelDefaultRes, overridesRes] = await Promise.all([
    s.from(TB_CONST.TABLES.travel_budget_reference_profile).select('*').eq('travel_id', tid).maybeSingle(),
    segIds.length
      ? s.from(TB_CONST.TABLES.budget_segment_budget_reference_override).select('*').in('budget_segment_id', segIds)
      : Promise.resolve({ data: [], error: null })
  ]);
  if (travelDefaultRes.error) throw travelDefaultRes.error;
  if (overridesRes.error) throw overridesRes.error;
  cache.travelDefault = travelDefaultRes.data || null;
  cache.segmentOverrides = {};
  (overridesRes.data || []).forEach((row)=>{ cache.segmentOverrides[String(row.budget_segment_id)] = row; });
  cache.segmentResolved = {};
  const calls = segIds.map(async (segId)=>{
    const { data, error } = await s.rpc(TB_CONST.RPCS.budget_reference_resolve_for_budget_segment, { p_budget_segment_id: segId });
    if (error) throw error;
    cache.segmentResolved[segId] = Array.isArray(data) ? (data[0] || null) : data;
  });
  await Promise.all(calls);
}

function _tbBudgetRefTravelDefaultPayload(box){
  const root = box || document;
  const q = (sel)=> root.querySelector(sel) || document.querySelector(sel);
  const countryRaw = String(q('[data-br="travel-country"]')?.value || '');
  const [country_code, region_code_raw] = countryRaw.split('|');
  return {
    p_travel_id: String(state?.activeTravelId || ''),
    p_country_code: String(country_code || '').trim() || null,
    p_region_code: String(region_code_raw || '').trim() || null,
    p_travel_profile: String(q('[data-br="travel-profile"]')?.value || 'solo'),
    p_travel_style: String(q('[data-br="travel-style"]')?.value || 'standard'),
    p_adult_count: Number(q('[data-br="travel-adults"]')?.value || 1),
    p_child_count: Number(q('[data-br="travel-children"]')?.value || 0),
    p_save: true,
  };
}

function _tbBudgetRefSegmentPayload(wrap, seg){
  let countryRaw = String(wrap.querySelector('[data-br="seg-country"]')?.value || '');
  if (!countryRaw) {
    const travelDefault = window.__tbBudgetReferenceCache?.travelDefault || null;
    if (travelDefault?.country_code) countryRaw = `${String(travelDefault.country_code || '').toUpperCase()}|${String(travelDefault.region_code || '')}`;
  }
  const [country_code, region_code_raw] = countryRaw.split('|');
  return {
    p_budget_segment_id: String(seg?.id || ''),
    p_country_code: String(country_code || '').trim() || null,
    p_region_code: String(region_code_raw || '').trim() || null,
    p_travel_profile: String(wrap.querySelector('[data-br="seg-profile"]')?.value || 'solo'),
    p_travel_style: String(wrap.querySelector('[data-br="seg-style"]')?.value || 'standard'),
    p_adult_count: Number(wrap.querySelector('[data-br="seg-adults"]')?.value || 1),
    p_child_count: Number(wrap.querySelector('[data-br="seg-children"]')?.value || 0),
    p_trip_days: _tbBudgetRefDurationDays(seg),
    p_save: true,
  };
}

function _tbBudgetRefWireSegmentMode(wrap){
  const mode = wrap.querySelector('[data-br="seg-mode"]');
  const customFields = Array.from(wrap.querySelectorAll('[data-br="seg-custom"]'));
  if(!mode || !customFields.length) return;
  const ensureDefaults = ()=>{
    const cache = window.__tbBudgetReferenceCache || {};
    const travel = (cache && cache.travelDefault) ? cache.travelDefault : null;
    const travelDefault = cache.travelDefault || null;
    const resolvedCountry = wrap.querySelector('[data-br="seg-country"]');
    const profile = wrap.querySelector('[data-br="seg-profile"]');
    const style = wrap.querySelector('[data-br="seg-style"]');
    const adults = wrap.querySelector('[data-br="seg-adults"]');
    const children = wrap.querySelector('[data-br="seg-children"]');
    if (resolvedCountry) {
      const selectedCountry = String(resolvedCountry.getAttribute('data-selected-country') || '').toUpperCase();
      const selectedRegion = String(resolvedCountry.getAttribute('data-selected-region') || '');
      const inheritedValue = travelDefault?.country_code ? `${String(travelDefault.country_code || '').toUpperCase()}|${String(travelDefault.region_code || '')}` : '';
      const selectedValue = selectedCountry ? `${selectedCountry}|${selectedRegion}` : '';
      if (selectedValue) {
        resolvedCountry.innerHTML = _tbBudgetRefCountryOptions(selectedCountry, selectedRegion);
        resolvedCountry.value = selectedValue;
      } else if (inheritedValue && mode.value !== 'custom') {
        resolvedCountry.innerHTML = _tbBudgetRefCountryOptions(travelDefault?.country_code, travelDefault?.region_code);
        resolvedCountry.value = inheritedValue;
      }
    }
    if (profile && !profile.value && travelDefault?.travel_profile) profile.value = String(travelDefault.travel_profile || 'solo');
    if (style && !style.value && travelDefault?.travel_style) style.value = String(travelDefault.travel_style || 'standard');
    if (adults && (!adults.value || Number(adults.value) <= 0) && Number.isFinite(Number(travelDefault?.adult_count))) adults.value = String(Number(travelDefault.adult_count));
    if (children && (!children.value) && Number.isFinite(Number(travelDefault?.child_count))) children.value = String(Number(travelDefault.child_count));
  };
  const sync = ()=>{
    const customMode = mode.value === 'custom';
    ensureDefaults();
    customFields.forEach((node)=>{ node.style.display = customMode ? '' : 'none'; });
  };
  mode.onchange = sync;
  sync();
}

function _tbBudgetRefRenderSkeleton(host){
  host.innerHTML = `<div class="muted">Chargement du budget de référence…</div>`;
}


window.tbRenderBudgetReferenceUI = async function tbRenderBudgetReferenceUI(){
  const travelHost = document.getElementById('tb-travel-budget-reference-inline');
  const legacyCard = document.getElementById('tb-budget-reference-card');
  if (legacyCard) legacyCard.style.display = 'none';
  if(!travelHost) return;

  try {
    if ((typeof window.tbIsOfflineMode === "function" && window.tbIsOfflineMode()) || (navigator && navigator.onLine === false)) {
      travelHost.innerHTML = `<div class="muted">Mode hors ligne : référence budget en lecture locale indisponible.</div>`;
      return;
    }
    await _tbBudgetRefLoadCountries();
    await _tbBudgetRefLoadState();
    const cache = window.__tbBudgetReferenceCache;
    const travel = cache.travelDefault || null;
    const segs = (state?.budgetSegments || []).map(_tbNormSeg).slice().sort((a,b)=>String(a.start).localeCompare(String(b.start)));
    const st = _tbBudgetRefStyle();

    travelHost.innerHTML = '';
    const travelCountry = document.querySelector('[data-br="travel-country"]');
    const travelProfile = document.querySelector('[data-br="travel-profile"]');
    const travelStyle = document.querySelector('[data-br="travel-style"]');
    const travelAdults = document.querySelector('[data-br="travel-adults"]');
    const travelChildren = document.querySelector('[data-br="travel-children"]');
      if (travelCountry && !travelCountry.innerHTML) travelCountry.innerHTML = _tbBudgetRefCountryOptions(travel?.country_code, travel?.region_code);
    if (travelProfile) travelProfile.value = travel?.travel_profile || 'solo';
    if (travelStyle) travelStyle.value = travel?.travel_style || 'standard';
    if (travelAdults) travelAdults.value = String(travel?.adult_count ?? 1);
    if (travelChildren) travelChildren.value = String(travel?.child_count ?? 0);
      try {
        const refMain = document.getElementById('tb-travel-ref-main');
        const refSub = document.getElementById('tb-travel-ref-sub');
        const recoMainEl = document.getElementById('tb-travel-reco-main');
        const recoSecEl = document.getElementById('tb-travel-reco-secondary');
        const cadenceMain = document.getElementById('tb-travel-cadence-main');
        const cadenceSub = document.getElementById('tb-travel-cadence-sub');
        if (refMain) refMain.textContent = travel?.country_name || travel?.country_code || '—';
        if (refSub) refSub.textContent = travel ? `${String(travel.travel_profile||'solo')} · ${String(travel.travel_style||'standard')}` : 'Choisis un pays et un profil';
        if (recoMainEl) recoMainEl.textContent = Number.isFinite(Number(travel?.recommended_daily_amount)) ? _tbBudgetRefFmtAmount(Number(travel.recommended_daily_amount), String(travel?.currency_code || 'EUR'), 2) : '—';
        if (recoSecEl) {
          const dual = (Number.isFinite(Number(travel?.recommended_daily_amount))) ? _tbFmtDualAmount(Number(travel?.recommended_daily_amount), String(travel?.currency_code || 'EUR'), _tbSettingsBaseCurrency(), 2, 2) : { secondary:null };
          recoSecEl.textContent = dual.secondary ? `${dual.secondary} · base` : '';
          recoSecEl.style.display = dual.secondary ? '' : 'none';
        }
        const budgetText = document.getElementById('tb-travel-budget-main')?.textContent || '';
        const match = budgetText.match(/([0-9]+(?:[\.,][0-9]+)?)\s*([A-Z]{3})/);
        const budgetAmt = match ? Number(String(match[1]).replace(',', '.')) : NaN;
        const budgetCur = match ? match[2] : _tbSettingsBaseCurrency();
        const budgetBase2 = _tbTryConvert(budgetAmt, budgetCur, _tbSettingsBaseCurrency());
        const recoBase2 = _tbTryConvert(Number(travel?.recommended_daily_amount || NaN), String(travel?.currency_code || 'EUR'), _tbSettingsBaseCurrency());
        if (cadenceMain) cadenceMain.textContent = (Number.isFinite(budgetBase2) && Number.isFinite(recoBase2)) ? (budgetBase2 <= recoBase2 ? 'Sous la reco' : 'Au-dessus') : 'À calibrer';
        if (cadenceSub) cadenceSub.textContent = (Number.isFinite(budgetBase2) && Number.isFinite(recoBase2)) ? `${Math.abs(budgetBase2-recoBase2).toFixed(2)} ${_tbSettingsBaseCurrency()} d'écart` : 'Référence requise';
      } catch(_) {}
        const nameInline = document.getElementById('tb-inline-travel-name');
        const startInline = document.getElementById('tb-inline-travel-start');
        const endInline = document.getElementById('tb-inline-travel-end');
        if (nameInline) nameInline.value = String(_tbGetActiveTravelRow()?.name || '');
        if (startInline) startInline.value = _tbISO(_tbGetActiveTravelRow()?.start_date || _tbGetActiveTravelRow()?.start || document.getElementById('s-start')?.value || '');
        if (endInline) endInline.value = _tbISO(_tbGetActiveTravelRow()?.end_date || _tbGetActiveTravelRow()?.end || document.getElementById('s-end')?.value || '');


    segs.forEach((seg)=>{
      const wrap = document.querySelector(`[data-br-inline-seg-id="${String(seg.id).replace(/"/g,'\\"')}"]`);
      if(!wrap) return;
      const override = cache.segmentOverrides[String(seg.id)] || null;
      const resolved = cache.segmentResolved[String(seg.id)] || null;
      const sourceLabel = override ? 'Réglage propre à cette période' : (travel?.country_code ? 'Hérite du voyage' : 'À renseigner');
      const resolvedCountry = _tbPickResolvedCountry(resolved, override, travel);
      const localBaseCur = _tbSettingsBaseCurrency();
      const recoDual = (resolved?.recommended_daily_amount && resolved?.currency_code) ? _tbFmtDualAmount(resolved.recommended_daily_amount, resolved.currency_code, localBaseCur, 2, 2) : { main:'—', secondary:null };
      const plannedDual = _tbFmtDualAmount(seg.dailyBudgetBase, seg.baseCurrency || '', localBaseCur, 0, 2);
      const posts = [
        ['Logement', resolved?.recommended_accommodation_daily_amount],
        ['Repas', resolved?.recommended_food_daily_amount],
        ['Transport', resolved?.recommended_transport_daily_amount],
        ['Activités', resolved?.recommended_activities_daily_amount],
      ].filter((x)=>Number.isFinite(Number(x[1])) && Number(x[1])>0);
      const refEn = typeof window.tbGetLang === 'function' && window.tbGetLang() === 'en';
      const rt = (fr, en) => refEn ? en : fr;
      const modeText = override ? rt('Personnalise', 'Custom') : (travel?.country_code ? rt('Herite', 'Inherited') : rt('A definir', 'To define'));
      const plannedBaseAmount = Number(_tbTryConvert(seg.dailyBudgetBase, seg.baseCurrency || '', localBaseCur) || 0);
      const referenceBaseAmount = Number(_tbTryConvert(resolved?.recommended_daily_amount, resolved?.currency_code || 'EUR', localBaseCur) || 0);
      const plannedDiffAmount = plannedBaseAmount - referenceBaseAmount;
      const plannedDiff = Number.isFinite(Number(resolved?.recommended_daily_amount)) && Number.isFinite(Number(seg.dailyBudgetBase))
        ? `${plannedDiffAmount.toFixed(2)} ${localBaseCur} ${rt("d'ecart", 'gap')}`
        : '—';
      const postLabel = (label) => ({
        Logement: rt('Logement', 'Accommodation'),
        Repas: rt('Repas', 'Food'),
        Transport: rt('Transport', 'Transport'),
        Activites: rt('Activites', 'Activities'),
        'Activites': rt('Activites', 'Activities')
      })[label] || label;
      wrap.innerHTML = window.TBSettingsView?.renderSettingsPeriodReference?.({
        sourceLabel,
        inherited: !override,
        countryName: resolved?.country_name,
        countryCode: resolved?.country_code,
        profile: resolved?.travel_profile || 'solo',
        style: resolved?.travel_style || 'standard',
        recommendedMain: recoDual.main,
        recommendedSecondary: recoDual.secondary,
        plannedMain: plannedDual.main,
        plannedSecondary: plannedDual.secondary,
        modeText,
        plannedDiff,
        posts: posts.map(([label,val]) => ({
          label: postLabel(label),
          amount: _tbBudgetRefFmtAmount(val, resolved?.currency_code || 'EUR', 2),
        })),
        lang: refEn ? 'en' : 'fr',
        esc: escapeHTML,
      }) || '';
      _tbBudgetRefWireSegmentMode(wrap);
      const btnReset = wrap.querySelector('[data-br-act="seg-reset"]');
      const btnEdit = wrap.querySelector('[data-act="edit-seg"]');
      if (btnEdit) {
        btnEdit.onclick = ()=>{
          const card = wrap.closest('.tb-period-card');
          if (card) {
            card.classList.add('is-editing');
            card.classList.remove('is-collapsed');
            const modeSel = card.querySelector('[data-br="seg-mode"]');
            const countrySel = card.querySelector('[data-br="seg-country"]');
            if (modeSel) {
              modeSel.value = override ? 'custom' : 'inherit';
              if (modeSel.dispatchEvent) modeSel.dispatchEvent(new Event('change', { bubbles:true }));
            }
            if (countrySel) {
              const selectedCode = String(override?.country_code || resolvedCountry.country_code || '').toUpperCase();
              const selectedRegion = String(override?.region_code || resolvedCountry.region_code || '');
              countrySel.innerHTML = _tbBudgetRefCountryOptions(selectedCode, selectedRegion);
              const desiredValue = selectedCode ? `${selectedCode}|${selectedRegion}` : '';
              if (desiredValue) countrySel.value = desiredValue;
            }
          }
          const periodEditor = card?.querySelector('.tb-period-editor');
          if (card) {
            const y = card.getBoundingClientRect().top + window.scrollY - 196;
            window.scrollTo({ top: Math.max(0, y), behavior:'smooth' });
          }
        };
      }
      if(btnReset){
        btnReset.onclick = ()=>safeCall('Héritage période', async ()=>{
          const s = _tbGetSB();
          const { error } = await s.rpc(TB_CONST.RPCS.budget_reference_compute_for_budget_segment, { p_budget_segment_id: String(seg.id), p_save: false, p_disable_override: true });
          if (error) throw error;
          await window.tbRenderBudgetReferenceUI();
          _tbToastOk('La période hérite de nouveau du voyage.');
        });
      }
    });
    try {
      const travelSave = document.querySelector('#tb-travel-card button[onclick*="saveSettings"]');
      if (travelSave) travelSave.textContent = 'Enregistrer le voyage';
    } catch(_) {}
  } catch (err) {
    console.error('[TB][budget-reference]', err);
    travelHost.innerHTML = `<div class="muted">Budget de référence indisponible. ${escapeHTML(err?.message || String(err))}</div>`;
  }
};

/* ---------- voyage save / create / delete ---------- */

async function _saveSettingsImpl(){
  const s = _tbGetSB();
  if(!s) throw new Error("Supabase non prêt.");
  const tid = String(state?.activeTravelId || "");
  if (!tid) throw new Error("Voyage non sélectionné.");

  const pid = state.period && state.period.id;
  if(!pid) throw new Error("Période non sélectionnée.");

  const start = document.getElementById("s-start")?.value;
  const end   = document.getElementById("s-end")?.value;
  if(!start || !end) throw new Error("Dates invalides.");
  if(start > end) throw new Error("Date de début > date de fin.");

  // Patch period dates only
  const { error } = await s.from(TB_CONST.TABLES.periods).update({ start_date:start, end_date:end }).eq("id", pid);
  if(error) throw error;

if (tid) {
  const travelName = String(document.getElementById("s-period-name")?.value || "").trim() || "Mon voyage";
  const { error: tErr } = await s
    .from(TB_CONST.TABLES.travels)
    .update({
      name: travelName,
      start_date: start,
      end_date: end,
      updated_at: new Date().toISOString()
    })
    .eq("id", tid);
  if (tErr) throw tErr;

  const travelRefHost = document.getElementById('tb-travel-budget-reference-inline');
  if (travelRefHost) {
    const payload = _tbBudgetRefTravelDefaultPayload(travelRefHost);
    if (payload.p_country_code) {
      const { error: refErr } = await s.rpc(TB_CONST.RPCS.budget_reference_compute_for_travel, payload);
      if (refErr) throw refErr;
    }
  }
}

  // Ensure first/last segments align to voyage bounds (no holes overall)
  await _syncVoyageBoundsToSegments(pid, start, end);

  // reload
  if (typeof window.refreshFromServer === "function") {
    await window.refreshFromServer();
  } else if (typeof refreshFromServer === "function") {
    await refreshFromServer();
  }
  _tbToastOk("Voyage mis à jour.");
}

async function _createVoyagePromptImpl(){
  const s = _tbGetSB();
  if(!s) throw new Error("Supabase non prêt.");
  const uid = await _tbAuthUid();
  if(!uid) throw new Error("Not authenticated.");

  const { data: allPeriods, error: periodsErr } = await s
    .from(TB_CONST.TABLES.periods)
    .select("id,start_date,end_date")
    .eq("user_id", uid)
    .order("end_date", { ascending: true });
  if (periodsErr) throw periodsErr;

  const periods = allPeriods || [];
  const lastEnd = periods.length
    ? _tbISO(periods[periods.length - 1].end_date)
    : _tbISO(new Date());
  const sugStart = _tbAddDays(lastEnd, 1);
  const sugEnd = _tbAddDays(sugStart, 30);

  const modal = _tbEnsureModal();
  modal.setTitle("Nouveau voyage");
  modal.setBody(window.TBSettingsView?.renderCreateVoyageModalBody?.({
    start: sugStart,
    end: sugEnd,
    esc: escapeHTML,
  }) || '<div class="muted">Module Settings indisponible.</div>');

  modal.setActions([
    { label:"Annuler", className:"btn", onClick:()=>modal.close() },
    { label:"Créer", className:"btn primary", onClick:async ()=>{
      const start = document.getElementById("tb-vstart")?.value;
      const end = document.getElementById("tb-vend")?.value;
      if(!start||!end||start>end) throw new Error("Dates invalides.");

      const existing = allPeriods || [];
      for(const p of existing){
        const ps = _tbISO(p.start_date);
        const pe = _tbISO(p.end_date);
        if(!ps||!pe) continue;
        if(!(end < ps || start > pe)) throw new Error(`Chevauchement avec un voyage existant (${ps} → ${pe}).`);
      }

      const { data: travelData, error: travelErr } = await s
        .from(TB_CONST.TABLES.travels)
        .insert({
          user_id: uid,
          name: "Mon voyage",
          start_date: start,
          end_date: end,
          base_currency: "EUR"
        })
        .select("id")
        .single();
      if (travelErr) throw travelErr;
      const newTravelId = travelData.id;

      let newPid = null;
      try {
        const { data, error } = await s
          .from(TB_CONST.TABLES.periods)
          .insert({
            user_id: uid,
            travel_id: newTravelId,
            start_date: start,
            end_date: end,
            base_currency: "EUR",
            eur_base_rate: 1,
            daily_budget_base: 0
          })
          .select("id")
          .single();
        if(error) throw error;
        newPid = data.id;

        const segIns = {
          user_id: uid,
          period_id: newPid,
          start_date: start,
          end_date: end,
          base_currency: "EUR",
          daily_budget_base: 0,
          fx_mode: "live_ecb",
          sort_order: 0
        };
        const { error: e2 } = await s.from(TB_CONST.TABLES.budget_segments).insert(segIns);
        if(e2) throw e2;
      } catch (e) {
        try { await s.from(TB_CONST.TABLES.travels).delete().eq("id", newTravelId); } catch (_) {}
        throw e;
      }

      modal.close();
      if (typeof window.refreshFromServer === "function") {
        await window.refreshFromServer();
      } else if (typeof refreshFromServer === "function") {
        await refreshFromServer();
      }

      _tbSetActiveTravelAndPeriod(newTravelId, newPid);

      try {
        const inp = document.getElementById("s-period-name");
        const t = (state.travels || []).find(x => String(x.id) === String(newTravelId));
        if (inp) inp.value = String(t?.name || "Mon voyage").trim();
      } catch (_) {}

      await refreshSegmentsForActivePeriod();
      renderSettings();
      _tbToastOk("Voyage créé.");
    }}
  ]);
  modal.open();
}

async function _deleteActiveVoyageImpl(){
  const s = _tbGetSB();
  if(!s) throw new Error("Supabase non prêt.");

  const tid = String(state?.activeTravelId || "");
  if (!tid) throw new Error("Voyage non sélectionné.");

  // sécurité projet : ne jamais supprimer le vrai voyage actif utilisateur
  if (tid === "d6c3e70a-d31f-4647-91e8-e12830d0c00d") {
    throw new Error("Suppression refusée : ce voyage est protégé.");
  }

  const t = _tbGetActiveTravelRow();
  const label = t?.name || `Voyage ${_tbISO(t?.start)} → ${_tbISO(t?.end)}`;

  if(!confirm(`Supprimer ${label} ?

La suppression n'est autorisée que si le voyage n'a ni transactions, ni échéances, ni soldes wallet non nuls.`)) return;

  const primaryPeriod = _tbGetTravelPrimaryPeriod(tid);
  const pid = String(primaryPeriod?.id || "");

  // 1) transactions -> bloquant
  {
    const { count, error } = await s
      .from(TB_CONST.TABLES.transactions)
      .select("id", { count: "exact", head: true })
      .eq("travel_id", tid);

    if (error) throw error;
    if (Number(count || 0) > 0) {
      throw new Error("Suppression refusée : transactions liées au voyage.");
    }
  }

  // 2) règles récurrentes -> bloquant
  {
    const { count, error } = await s
      .from(TB_CONST.TABLES.recurring_rules)
      .select("id", { count: "exact", head: true })
      .eq("travel_id", tid)
      .eq("archived", false);

    if (error) throw error;
    if (Number(count || 0) > 0) {
      throw new Error("Suppression refusée : échéances périodiques liées au voyage.");
    }
  }

  // 3) wallets -> autorisés seulement si soldes tous à 0
  {
    const { data: wallets, error } = await s
      .from(TB_CONST.TABLES.wallets)
      .select("id,balance")
      .eq("travel_id", tid);

    if (error) throw error;

    const usedWallet = (wallets || []).some(w => Math.abs(Number(w?.balance || 0)) > 0.0000001);
    if (usedWallet) {
      throw new Error("Suppression refusée : wallets liés au voyage avec solde non nul.");
    }
  }

  // suppression en cascade manuelle
  {
    const { error: wErr } = await s.from(TB_CONST.TABLES.wallets).delete().eq("travel_id", tid);
    if (wErr) throw wErr;
  }

  if (pid) {
    const { error: segErr } = await s.from(TB_CONST.TABLES.budget_segments).delete().eq("period_id", pid);
    if (segErr) throw segErr;

    const { error: pErr } = await s.from(TB_CONST.TABLES.periods).delete().eq("id", pid);
    if (pErr) throw pErr;
  }

  {
    const { error: tErr } = await s.from(TB_CONST.TABLES.travels).delete().eq("id", tid);
    if (tErr) throw tErr;
  }

  try {
    localStorage.removeItem("travelbudget_active_travel_id_v1");
    localStorage.removeItem("travelbudget_active_period_id_v1");
  } catch (_) {}

  if (typeof window.refreshFromServer === "function") {
    await window.refreshFromServer();
  } else if (typeof refreshFromServer === "function") {
    await refreshFromServer();
  }

  renderSettings();
  _tbToastOk("Voyage supprimé.");
}

/* ---------- segments create / update / delete ---------- */

function _tbEnsureModal(){
  let handle = null;
  let title = "Modal";
  let body = "";
  let actions = [];
  let initialFocus = "input:not([disabled]),select:not([disabled]),textarea:not([disabled])";
  let onDismiss = null;
  let closingProgrammatically = false;

  const api = {
    open(){
      if(!window.UI?.createModal) throw new Error("Composant de fenetre indisponible.");
      handle = window.UI.createModal({
        id: "tb-settings-shared-modal",
        size: "lg",
        panelClass: "tb-settings-shared-modal",
        title,
        contentHTML: `<div class="tb-settings-modal-form">${body}</div>`,
        actionsHTML: actions.map((action, index) => `
          <button class="${escapeHTML(action.className || "btn")}" type="button" data-tb-settings-modal-action="${index}">${escapeHTML(action.label || "")}</button>
        `).join(""),
        initialFocus,
        closeLabel: "Fermer",
        onClose(){
          handle = null;
          if(!closingProgrammatically) onDismiss?.();
          closingProgrammatically = false;
        }
      });
      handle.root.querySelectorAll("[data-tb-settings-modal-action]").forEach(button => {
        button.addEventListener("click", async () => {
          const action = actions[Number(button.dataset.tbSettingsModalAction)];
          if(!action) return;
          button.disabled = true;
          try{ await action.onClick?.(); }
          catch(err){ console.error(err); _tbToastOk(err.message || String(err)); }
          finally{ if(button.isConnected) button.disabled = false; }
        });
      });
    },
    close(){
      if(!handle) return;
      closingProgrammatically = true;
      handle.close();
    },
    setTitle(value){ title = String(value || "Modal"); },
    setBody(html){ body = String(html || ""); },
    setActions(buttons){ actions = Array.isArray(buttons) ? buttons : []; },
    setInitialFocus(selector){ initialFocus = selector || initialFocus; },
    setOnDismiss(callback){ onDismiss = typeof callback === "function" ? callback : null; }
  };
  return api;
}

async function _createPeriodPromptImpl(){
  const s = _tbGetSB();
  if(!s) throw new Error("Supabase non prêt.");
  const uid = await _tbAuthUid();
  if(!uid) throw new Error("Not authenticated.");
  const tid = String(state?.activeTravelId || "");
  if (!tid) throw new Error("Voyage non sélectionné.");

  const pid = state.period && state.period.id;
  if(!pid) throw new Error("Période non sélectionnée.");

  const segs = (state.budgetSegments||[]).slice().sort((a,b)=>String(a.start).localeCompare(String(b.start)));
  if(!segs.length) throw new Error("Aucune période existante à découper.");

  const vStart = _tbISO(segs[0].start || segs[0].start_date || segs[0].startDate);
  const vEnd   = _tbISO(segs[segs.length-1].end || segs[segs.length-1].end_date || segs[segs.length-1].endDate);
  if(!vStart || !vEnd) throw new Error("Bornes voyage invalides (start/end).");

  const modal = _tbEnsureModal();
  modal.setTitle("Ajouter une période");
  modal.setBody(window.TBSettingsView?.renderCreatePeriodModalBody?.({
    start: vStart,
    end: vEnd,
    currency: segs[0].base_currency || "EUR",
    dailyBudget: segs[0].daily_budget_base ?? 0,
    esc: escapeHTML,
  }) || '<div class="muted">Module Settings indisponible.</div>');
  modal.setActions([
    { label:"Annuler", className:"btn", onClick:()=>modal.close() },
    { label:"Ajouter", className:"btn primary", onClick:async ()=>{
      const start = document.getElementById("tb-pstart")?.value;
      const end = document.getElementById("tb-pend")?.value;
      const cur = (document.getElementById("tb-pcur")?.value || "").trim().toUpperCase();
      const bud = _tbParseNum(document.getElementById("tb-pbud")?.value);
      if(!start||!end||start>end) throw new Error("Dates invalides.");
      if(start < vStart || end > vEnd) throw new Error("Hors bornes du voyage.");
      if(!cur) throw new Error("Devise requise.");
      if(!Number.isFinite(bud) || bud < 0) throw new Error("Budget/jour invalide.");

      await _tbInsertSegmentInsideExisting(uid, pid, start, end, cur, bud);

      modal.close();
      await refreshSegmentsForActivePeriod();
      renderSettings();
      _tbToastOk("Période ajoutée.");
    }}
  ]);
  modal.open();
}

async function _tbInsertSegmentInsideExisting(uid, pid, start, end, cur, bud){
  const s = _tbGetSB();
  if(!s) throw new Error("Supabase non prêt.");

  // We will "carve out" [start,end] from existing segments:
  // - any segment fully inside => deleted
  // - any segment overlapping left/right => trimmed
  // - any segment spanning across => split (update left part + insert right part)
  const segs = (state.budgetSegments||[]).slice().sort((a,b)=>String(a.start).localeCompare(String(b.start)));

  if(!segs.length) throw new Error("Aucune période existante.");

  const vStart = _tbISO(segs[0].start || segs[0].start_date || segs[0].startDate);
  const vEnd   = _tbISO(segs[segs.length-1].end || segs[segs.length-1].end_date || segs[segs.length-1].endDate);
  if(!vStart || !vEnd) throw new Error("Bornes voyage invalides (start/end).");
  if(start < vStart || end > vEnd) throw new Error("Hors bornes du voyage.");

  const rightPieces = [];
  const toDelete = [];
  const toUpdate = [];

  for(const seg of segs){
    const s0 = _tbISO(seg.start);
    const e0 = _tbISO(seg.end);
    if(!s0 || !e0) continue;

    // no overlap
    if(e0 < start || s0 > end) continue;

    // seg fully covered by new range
    if(s0 >= start && e0 <= end){
      toDelete.push(seg.id);
      continue;
    }

    // seg spans across new range => split
    if(s0 < start && e0 > end){
      const leftEnd = _tbAddDays(start, -1);
      const rightStart = _tbAddDays(end, 1);

      // update seg to left part
      toUpdate.push({ id: seg.id, patch: { end_date: leftEnd } });

      // insert right part as a clone
      if(rightStart <= e0){
        rightPieces.push({
          user_id: uid,
          period_id: pid,
          start_date: rightStart,
          end_date: e0,
          base_currency: seg.baseCurrency || "EUR",
          daily_budget_base: seg.dailyBudgetBase ?? 0,
          fx_mode: "live_ecb",
          eur_base_rate_fixed: null,
          sort_order: 0
        });
      }
      continue;
    }

    // overlap on left edge: trim end
    if(s0 < start && e0 >= start && e0 <= end){
      const leftEnd = _tbAddDays(start, -1);
      if(leftEnd < s0){
        toDelete.push(seg.id);
      }else{
        toUpdate.push({ id: seg.id, patch: { end_date: leftEnd } });
      }
      continue;
    }

    // overlap on right edge: trim start
    if(s0 >= start && s0 <= end && e0 > end){
      const rightStart = _tbAddDays(end, 1);
      if(rightStart > e0){
        toDelete.push(seg.id);
      }else{
        toUpdate.push({ id: seg.id, patch: { start_date: rightStart } });
      }
      continue;
    }
  }

  // Apply updates/deletes first (avoid exclusion conflicts)
  for(const u of toUpdate){
    const { error } = await s.from(TB_CONST.TABLES.budget_segments).update(u.patch).eq("id", u.id);
    if(error) throw error;
  }
  for(const id of toDelete){
    const { error } = await s.from(TB_CONST.TABLES.budget_segments).delete().eq("id", id);
    if(error) throw error;
  }

  // Insert new segment
  const newSeg = {
    user_id: uid,
    period_id: pid,
    start_date: start,
    end_date: end,
    base_currency: cur,
    daily_budget_base: bud,
    fx_mode: "live_ecb", // Auto only (manual segment deprecated)
    sort_order: 0
  };
  const { error: eNew } = await s.from(TB_CONST.TABLES.budget_segments).insert(newSeg);
  if(eNew) throw eNew;

  // Insert any right pieces from splits
  for(const rp of rightPieces){
    const { error } = await s.from(TB_CONST.TABLES.budget_segments).insert(rp);
    if(error) throw error;
  }

  // Recalc order + sync voyage bounds
  await _tbRecalcSegmentSortOrder(pid);
  await _syncSegmentsBoundsToPeriod(pid);
}

async function saveBudgetSegment(segId, wrapEl){
  const s = _tbGetSB();
  if(!s) throw new Error("Supabase non prêt.");
  const uid = await _tbAuthUid();
  if(!uid) throw new Error("Not authenticated.");
  const tid = String(state?.activeTravelId || "");
  if (!tid) throw new Error("Voyage non sélectionné.");

  const pid = state.period && state.period.id;
  if(!pid) throw new Error("Période non sélectionnée.");

  const segs = (state.budgetSegments||[]).slice().sort((a,b)=>String(a.start).localeCompare(String(b.start)));
  const idx = segs.findIndex(x=>x.id===segId);
  if(idx<0) throw new Error("Période introuvable.");

  const seg = segs[idx];
  const getVal = (k)=>wrapEl.querySelector(`[data-k="${k}"]`)?.value;

  const newStart = getVal("start_date");
  const newEnd = getVal("end_date");
  const newCur = (getVal("base_currency")||"").trim().toUpperCase();
  const newBud = _tbParseNum(getVal("daily_budget_base"));
  const newNightTransportBudget = _tbParseNum(getVal("night_transport_budget"));

  if(!newStart||!newEnd||newStart>newEnd) throw new Error("Dates invalides.");
    if(!newCur) throw new Error("Devise requise.");
  if(!Number.isFinite(newBud) || newBud < 0) throw new Error("Budget/jour invalide.");
  if(!Number.isFinite(newNightTransportBudget) || newNightTransportBudget < 0) throw new Error("Nuit transport invalide.");

// FX Option A: Auto is source of truth. If currency is not provided by auto FX, require a manual fallback.
const autoOk = (typeof window.tbFxIsAutoAvailable==="function") ? window.tbFxIsAutoAvailable(newCur) : false;
if(!autoOk){
  if(typeof window.tbFxEnsureManualRateToday === "function"){
    const out = window.tbFxEnsureManualRateToday(newCur, "Devise non fournie par les taux auto. Un taux manuel (fallback) est requis.");
    if(!out || out.ok !== true) throw new Error("Taux manuel requis pour cette devise.");
  }else if(typeof window.tbFxPromptManualRate === "function"){
    const r = window.tbFxPromptManualRate(newCur, "Devise non fournie par les taux auto. Un taux manuel est requis.");
    if(!r) throw new Error("Taux manuel requis pour cette devise.");
  }else{
    throw new Error("Taux manuel requis pour cette devise.");
  }
}

  // neighbors
  const prev = idx>0 ? segs[idx-1] : null;
  const next = idx<segs.length-1 ? segs[idx+1] : null;

  // phase A: shrink neighbors if we expand into them
  if(prev){
    const prevEnd = _tbISO(prev.end);
    if(prevEnd >= newStart){
      const newPrevEnd = _tbAddDays(newStart, -1);
      const { error } = await s.from(TB_CONST.TABLES.budget_segments).update({ end_date: newPrevEnd }).eq("id", prev.id);
      if(error) throw error;
    }
  }
  if(next){
    const nextStart = _tbISO(next.start);
    if(nextStart <= newEnd){
      const newNextStart = _tbAddDays(newEnd, 1);
      const { error } = await s.from(TB_CONST.TABLES.budget_segments).update({ start_date: newNextStart }).eq("id", next.id);
      if(error) throw error;
    }
  }

  // phase B: update current
  const patch = {
    start_date: newStart,
    end_date: newEnd,
    base_currency: newCur,
    daily_budget_base: newBud,
    fx_mode: "live_ecb",
    eur_base_rate_fixed: null,
    user_id: uid,
    period_id: pid
  };
  if (Object.prototype.hasOwnProperty.call(seg || {}, 'transportNightBudget') || Object.prototype.hasOwnProperty.call(seg || {}, 'transport_night_budget') || Object.prototype.hasOwnProperty.call(seg || {}, 'night_transport_budget')) {
    patch.transport_night_budget = newNightTransportBudget;
  }
  const { error: e2 } = await s.from(TB_CONST.TABLES.budget_segments).update(patch).eq("id", segId);
  if(e2) throw e2;
  _tbSetNightTransportBudget(segId, newNightTransportBudget);
  try {
    const liveSeg = (state?.budgetSegments || []).find(x => String(x.id) === String(segId));
    if (liveSeg) {
      liveSeg.transportNightBudget = newNightTransportBudget;
      liveSeg.transport_night_budget = newNightTransportBudget;
    }
  } catch (_) {}

  // phase C: fill gaps created by shrinking current (only immediate neighbors)
  if(prev){
    const prevEndNew = _tbISO((await _tbFetchSeg(prev.id)).end_date);
    const desiredPrevEnd = _tbAddDays(newStart, -1);
    if(prevEndNew < desiredPrevEnd){
      const { error } = await s.from(TB_CONST.TABLES.budget_segments).update({ end_date: desiredPrevEnd }).eq("id", prev.id);
      if(error) throw error;
    }
  }
  if(next){
    const nextStartNew = _tbISO((await _tbFetchSeg(next.id)).start_date);
    const desiredNextStart = _tbAddDays(newEnd, 1);
    if(nextStartNew > desiredNextStart){
      const { error } = await s.from(TB_CONST.TABLES.budget_segments).update({ start_date: desiredNextStart }).eq("id", next.id);
      if(error) throw error;
    }
  }

  await _tbRecalcSegmentSortOrder(pid);
  await _syncSegmentsBoundsToPeriod(pid);
  await refreshSegmentsForActivePeriod();
  _tbAssertSegmentsIntegrity("after refreshSegmentsForActivePeriod");
  renderSettings();
  _tbToastOk("Période enregistrée.");
}

async function _tbFetchSeg(id){
  const s = _tbGetSB();
  const { data, error } = await s.from(TB_CONST.TABLES.budget_segments).select("*").eq("id", id).single();
  if(error) throw error;
  return data;
}

async function deleteBudgetSegment(segId){
  const s = _tbGetSB();
  if(!s) throw new Error("Supabase non prêt.");
  const tid = String(state?.activeTravelId || "");
  if (!tid) throw new Error("Voyage non sélectionné.");

  const pid = state.period && state.period.id;
  if(!pid) throw new Error("Période non sélectionnée.");

  const segs = (state.budgetSegments||[]).slice().sort((a,b)=>String(a.start).localeCompare(String(b.start)));
  const readiness = window.TBSettingsView?.getBudgetSegmentDeleteReadiness?.({ segments: segs, segmentId: segId });
  if(readiness && !readiness.ok) throw new Error(readiness.reason || "Suppression impossible.");
  if(!readiness && segs.length<=1) throw new Error("Impossible: au moins 1 période requise.");

  const idx = segs.findIndex(x=>x.id===segId);
  if(idx<0) throw new Error("Période introuvable.");

  const seg = segs[idx];
  if(!confirm(`Supprimer la période ${_tbISO(seg.start)} → ${_tbISO(seg.end)} ?`)) return;

  const prev = idx>0 ? segs[idx-1] : null;
  const next = idx<segs.length-1 ? segs[idx+1] : null;

  // delete
  const { error } = await s.from(TB_CONST.TABLES.budget_segments).delete().eq("id", segId);
  if(error) throw error;

  // merge gap to neighbor (prefer prev)
  // merge: always fuse into previous when possible; if first segment, fuse into next
  if(prev && next){
    const newPrevEnd = _tbAddDays(_tbISO(next.start), -1);
    const { error: e1 } = await s.from(TB_CONST.TABLES.budget_segments).update({ end_date: newPrevEnd }).eq("id", prev.id);
    if(e1) throw e1;
  }else if(prev && !next){
    // deleting last: extend prev to deleted end (typically voyage end)
    const { error: e1 } = await s.from(TB_CONST.TABLES.budget_segments).update({ end_date: _tbISO(seg.end) }).eq("id", prev.id);
    if(e1) throw e1;
  }else if(!prev && next){
    // deleting first: extend next back to deleted start (typically voyage start)
    const { error: e1 } = await s.from(TB_CONST.TABLES.budget_segments).update({ start_date: _tbISO(seg.start) }).eq("id", next.id);
    if(e1) throw e1;
  }


  await _tbRecalcSegmentSortOrder(pid);
  await _syncSegmentsBoundsToPeriod(pid);
  await refreshSegmentsForActivePeriod();
  _tbAssertSegmentsIntegrity("after refreshSegmentsForActivePeriod");
  renderSettings();
  _tbToastOk("Période supprimée.");
}

async function _tbRecalcSegmentSortOrder(pid){
  const s = _tbGetSB();
  const { data, error } = await s.from(TB_CONST.TABLES.budget_segments).select("id,start_date").eq("period_id", pid).order("start_date", {ascending:true});
  if(error) throw error;
  const rows = data || [];
  for(let i=0;i<rows.length;i++){
    await s.from(TB_CONST.TABLES.budget_segments).update({ sort_order:i }).eq("id", rows[i].id);
  }
}

async function _syncSegmentsBoundsToPeriod(pid){
  const s = _tbGetSB();
  const { data, error } = await s.from(TB_CONST.TABLES.budget_segments).select("start_date,end_date").eq("period_id", pid).order("start_date",{ascending:true});
  if(error) throw error;
  const rows = data || [];
  if(!rows.length) return;
  const start = _tbISO(rows[0].start_date);
  const end = _tbISO(rows[rows.length-1].end_date);
  const { error: e2 } = await s.from(TB_CONST.TABLES.periods).update({ start_date:start, end_date:end }).eq("id", pid);
  if(e2) throw e2;
}

function _tbIsDebug(){
  try{
    const v = localStorage.getItem(TB_CONST.LS_KEYS.debug);
    return v === "1" || v === "true" || v === "on";
  }catch(_){ return false; }
}

// Dev-only integrity checks (segments continuity, bounds vs voyage)
function _tbAssertSegmentsIntegrity(ctx=""){
  if(!_tbIsDebug()) return true;
  try{
    const pid = state.period && state.period.id;
    const segs = (state.budgetSegments||[]).slice().sort((a,b)=>String(a.start).localeCompare(String(b.start)));
    if(!pid){ console.warn("[TB][segments] no active voyage", ctx); return false; }
    if(!segs.length){ console.warn("[TB][segments] no segments", ctx, pid); return false; }

    for(let i=0;i<segs.length;i++){
      const s = segs[i];
      if(!_tbISO(s.start) || !_tbISO(s.end)){
        console.warn("[TB][segments] invalid dates", ctx, s);
        return false;
      }
      if(_tbISO(s.end) < _tbISO(s.start)){
        console.warn("[TB][segments] end<start", ctx, s);
        return false;
      }
      if(i>0){
        const prev = segs[i-1];
        const expected = _tbAddDays(_tbISO(prev.end), 1);
        if(_tbISO(s.start) !== expected){
          console.warn("[TB][segments] continuity break", ctx, {prev:[prev.start,prev.end], cur:[s.start,s.end], expected});
          return false;
        }
      }
    }

    // bounds vs voyage (if available)
    if(state.period && state.period.start && state.period.end){
      if(_tbISO(segs[0].start) !== _tbISO(state.period.start)){
        console.warn("[TB][segments] first.start != voyage.start", ctx, {seg:segs[0].start, voyage:state.period.start});
        return false;
      }
      if(_tbISO(segs[segs.length-1].end) !== _tbISO(state.period.end)){
        console.warn("[TB][segments] last.end != voyage.end", ctx, {seg:segs[segs.length-1].end, voyage:state.period.end});
        return false;
      }
    }
    console.log("[TB][segments] integrity OK", ctx, {count:segs.length});
    return true;
  }catch(e){
    console.warn("[TB][segments] integrity check failed", ctx, e);
    return false;
  }
}


async function _syncVoyageBoundsToSegments(pid, start, end){
  const s = _tbGetSB();
  const { data, error } = await s.from(TB_CONST.TABLES.budget_segments).select("id,start_date,end_date").eq("period_id", pid).order("start_date",{ascending:true});
  if(error) throw error;
  const rows = data || [];
  if(!rows.length) return;

  const first = rows[0];
  const last = rows[rows.length-1];

  if(_tbISO(first.start) !== start){
    const { error: e1 } = await s.from(TB_CONST.TABLES.budget_segments).update({ start_date:start }).eq("id", first.id);
    if(e1) throw e1;
  }
  if(_tbISO(last.end) !== end){
    const { error: e2 } = await s.from(TB_CONST.TABLES.budget_segments).update({ end_date:end }).eq("id", last.id);
    if(e2) throw e2;
  }
  await _tbRecalcSegmentSortOrder(pid);
}

/* ---------- legacy globals expected by index.html ---------- */

window.renderSettings = renderSettings;
try {
  window.tbOnLangChange = window.tbOnLangChange || [];
  if (!window.__tbSettingsLangBound) {
    window.__tbSettingsLangBound = true;
    window.tbOnLangChange.push(() => {
      try { if (typeof renderSettings === "function") renderSettings(); } catch (_) {}
    });
  }
} catch (_) {}
window.saveSettings = ()=>safeCall("Enregistrer voyage", _saveSettingsImpl);
window.createPeriodPrompt = ()=>safeCall("Ajouter période", _createPeriodPromptImpl);
window.deleteActivePeriod = ()=>_tbToastOk("Suppression de période: utilise le bouton Supprimer sur une période.");
window.createVoyagePrompt = ()=>safeCall("Ajouter voyage", _createVoyagePromptImpl);
window.deleteActiveVoyage = ()=>safeCall("Supprimer voyage", _deleteActiveVoyageImpl);

// initial boot hook
(async function _tbSettingsInit(){
  try{
    // only run after supabase load is done (state.periods etc)
    if(typeof window.addEventListener==="function"){
      window.addEventListener("tb:afterLoad", async ()=>{
        try{ await refreshSegmentsForActivePeriod(); }catch(_){}
        renderSettings();
      });
    }
  }catch(_){}
})();


/* =========================
   Categories UI (Supabase)
   - Source of truth: public.categories
   ========================= */

function _categoryIdByName(categoryName) {
  const wanted = String(categoryName || '').trim().toLowerCase();
  if (!wanted) return null;
  const rows = Array.isArray(state?.categoriesRows) ? state.categoriesRows : [];
  const hit = rows.find((row) => String(row?.name || '').trim().toLowerCase() === wanted);
  return hit?.id || null;
}

function _subcategoriesForSettings(categoryName, includeInactive = true) {
  const rows = (typeof getCategorySubcategories === 'function')
    ? getCategorySubcategories(categoryName, { activeOnly: !includeInactive })
    : (Array.isArray(state?.categorySubcategories) ? state.categorySubcategories : []);
  return (rows || [])
    .filter((row) => {
      const rowCat = String(row?.categoryName || row?.category_name || '').trim().toLowerCase();
      if (rowCat !== String(categoryName || '').trim().toLowerCase()) return false;
      if (includeInactive) return true;
      return row?.isActive !== false && row?.is_active !== false;
    })
    .slice()
    .sort((a, b) => {
      const aSort = Number(a?.sortOrder ?? a?.sort_order ?? 0);
      const bSort = Number(b?.sortOrder ?? b?.sort_order ?? 0);
      return (aSort - bSort) || String(a?.name || '').localeCompare(String(b?.name || ''), 'fr', { sensitivity: 'base' });
    });
}


function _analyticFamilyLabel(family) {
  const key = String(family || '').trim().toLowerCase();
  if (key === 'accommodation') return 'Logement';
  if (key === 'food') return 'Repas';
  if (key === 'transport') return 'Transport';
  if (key === 'activities') return 'Activités';
  return 'À classer';
}

function _analyticSelectOptions(selectedValue, includeInherit = false) {
  const current = String(selectedValue || '');
  const opts = [];
  if (includeInherit) opts.push(`<option value="__inherit__" ${current === '__inherit__' ? 'selected' : ''}>Hériter de la catégorie</option>`);
  else opts.push(`<option value="__unmapped__" ${current === '__unmapped__' ? 'selected' : ''}>À classer</option>`);
  opts.push(`<option value="accommodation" ${current === 'accommodation' ? 'selected' : ''}>Logement</option>`);
  opts.push(`<option value="food" ${current === 'food' ? 'selected' : ''}>Repas</option>`);
  opts.push(`<option value="transport" ${current === 'transport' ? 'selected' : ''}>Transport</option>`);
  opts.push(`<option value="activities" ${current === 'activities' ? 'selected' : ''}>Activités</option>`);
  opts.push(`<option value="__excluded__" ${current === '__excluded__' ? 'selected' : ''}>Exclure</option>`);
  return opts.join('');
}

function _analyticRulesForSettings() {
  return Array.isArray(state?.analyticCategoryMappings) ? state.analyticCategoryMappings : [];
}

function _findAnalyticRule(categoryName, subcategoryName) {
  const cat = String(categoryName || '').trim().toLowerCase();
  const sub = (subcategoryName === undefined || subcategoryName === null) ? null : String(subcategoryName || '').trim().toLowerCase();
  return _analyticRulesForSettings().find((row) => {
    const rowCat = String(row?.categoryName || row?.category_name || '').trim().toLowerCase();
    const rowSubRaw = row?.subcategoryName ?? row?.subcategory_name ?? null;
    const rowSub = (rowSubRaw === undefined || rowSubRaw === null || String(rowSubRaw).trim() === '') ? null : String(rowSubRaw).trim().toLowerCase();
    return rowCat === cat && rowSub === sub;
  }) || null;
}

function _auditRowsForSettings() {
  return Array.isArray(state?.analysisAuditRows) ? state.analysisAuditRows : [];
}

function _auditUsageFor(categoryName, subcategoryName) {
  const cat = String(categoryName || '').trim().toLowerCase();
  const wantedSub = (subcategoryName === undefined || subcategoryName === null) ? null : String(subcategoryName || '').trim().toLowerCase();
  const rows = _auditRowsForSettings().filter((row) => {
    const rowCat = String(row?.category || '').trim().toLowerCase();
    const rowSubRaw = row?.subcategory ?? null;
    const rowSub = (rowSubRaw === undefined || rowSubRaw === null || String(rowSubRaw).trim() === '') ? null : String(rowSubRaw).trim().toLowerCase();
    if (rowCat !== cat) return false;
    if (wantedSub === null) return true;
    return rowSub === wantedSub;
  });
  const txCount = rows.reduce((sum, row) => sum + Number(row?.tx_count || 0), 0);
  const expenseAmountSum = rows.reduce((sum, row) => sum + Number(row?.expense_amount_sum || 0), 0);
  return { rows, txCount, expenseAmountSum };
}

function _effectiveAnalyticMappingFor(categoryName, subcategoryName) {
  const explicit = _findAnalyticRule(categoryName, subcategoryName);
  if (explicit) {
    return {
      explicit: true,
      inherited: false,
      mappingStatus: explicit.mappingStatus || explicit.mapping_status || 'unmapped',
      analyticFamily: explicit.analyticFamily || explicit.analytic_family || null,
      sourceLabel: subcategoryName ? 'Règle sous-catégorie' : 'Règle catégorie',
      row: explicit,
    };
  }
  if (subcategoryName !== undefined && subcategoryName !== null && String(subcategoryName || '').trim()) {
    const categoryRule = _findAnalyticRule(categoryName, null);
    if (categoryRule) {
      return {
        explicit: false,
        inherited: true,
        mappingStatus: categoryRule.mappingStatus || categoryRule.mapping_status || 'unmapped',
        analyticFamily: categoryRule.analyticFamily || categoryRule.analytic_family || null,
        sourceLabel: 'Hérité de la catégorie',
        row: categoryRule,
      };
    }
  }
  return {
    explicit: false,
    inherited: false,
    mappingStatus: 'unmapped',
    analyticFamily: null,
    sourceLabel: 'À classer',
    row: null,
  };
}

function _analyticStatusPillHtml(mapping) {
  const status = String(mapping?.mappingStatus || 'unmapped').trim().toLowerCase();
  const family = String(mapping?.analyticFamily || '').trim().toLowerCase();
  const positive = status === 'mapped';
  const muted = status === 'excluded';
  const label = status === 'mapped'
    ? `Mappé · ${_analyticFamilyLabel(family)}`
    : (status === 'excluded' ? 'Exclu' : 'À classer');
  return `<span class="tb-settings-pill ${positive ? 'tb-settings-pill--positive' : ''}" ${muted ? 'style="opacity:.85;"' : ''}>${escapeHTML(label)}</span>`;
}

function _analyticUsagePillHtml(txCount) {
  const count = Number(txCount || 0);
  return `<span class="tb-settings-pill">${escapeHTML(String(count))} usage${count > 1 ? 's' : ''}</span>`;
}

async function _deleteCategoryBundleViaRpc(categoryName) {
  const category = String(categoryName || '').trim();
  if (!category) throw new Error('Catégorie invalide.');
  try {
    const rpcName = TB_CONST?.RPCS?.delete_category_bundle || 'delete_category_bundle';
    const { error } = await sb.rpc(rpcName, { p_category_name: category });
    if (error) throw error;
    return;
  } catch (rpcErr) {
    console.warn('[categories] delete bundle RPC unavailable, fallback to direct deletes', rpcErr?.message || rpcErr);
  }

  const catLower = category.toLowerCase();
  const { error: mapErr } = await sb
    .from(TB_CONST.TABLES.analytic_category_mappings)
    .delete()
    .eq('user_id', sbUser.id)
    .ilike('category_name', category);
  if (mapErr) throw mapErr;

  const { error: subErr } = await sb
    .from(TB_CONST.TABLES.category_subcategories)
    .delete()
    .eq('user_id', sbUser.id)
    .ilike('category_name', category);
  if (subErr) throw subErr;

  const sqlRow = (Array.isArray(state?.categoriesRows) ? state.categoriesRows : []).find((row) => String(row?.name || '').trim().toLowerCase() === catLower);
  if (sqlRow) {
    const { error: delErr } = await sb
      .from(TB_CONST.TABLES.categories)
      .delete()
      .eq('user_id', sbUser.id)
      .eq('id', sqlRow.id);
    if (delErr) throw delErr;
  } else if (typeof setCategoryHidden === 'function') {
    setCategoryHidden(category, true);
  }
}

async function _saveAnalyticMappingRuleViaRpc(categoryName, subcategoryName, nextValue) {
  const draft = window.TBSettingsCategoriesView?.prepareAnalyticMappingRuleDraft?.({
    categoryName,
    subcategoryName,
    nextValue,
    userId: sbUser.id,
  });
  const category = draft?.category || String(categoryName || '').trim();
  const subcategory = draft
    ? draft.subcategory
    : ((subcategoryName === undefined || subcategoryName === null || String(subcategoryName || '').trim() === '') ? null : String(subcategoryName || '').trim());
  const value = draft?.value || String(nextValue || '').trim();
  if (draft && !draft.ok) throw new Error(draft.reason || 'Catégorie invalide.');
  if (!draft && !category) throw new Error('Catégorie invalide.');
  const mappingStatus = draft?.mappingStatus || ((value === '__unmapped__' || value === '__inherit__') ? 'unmapped' : (value === '__excluded__' ? 'excluded' : 'mapped'));
  const analyticFamily = draft ? draft.analyticFamily : (mappingStatus === 'mapped' ? value : null);
  const rpcPayload = draft?.rpcPayload || {
    p_user_id: sbUser.id,
    p_category_name: category,
    p_subcategory_name: subcategory,
    p_mapping_status: mappingStatus,
    p_analytic_family: analyticFamily,
  };

  try {
    const rpcName = TB_CONST?.RPCS?.save_analytic_mapping_rule || 'save_analytic_mapping_rule';
    const { error } = await sb.rpc(rpcName, rpcPayload);
    if (error) throw error;
    return;
  } catch (rpcErr) {
    console.warn('[analytic mapping] RPC unavailable, fallback to direct table write', rpcErr?.message || rpcErr);
  }

  const existing = _findAnalyticRule(category, subcategory);
  if (mappingStatus === 'unmapped') {
    if (existing?.id) {
      const { error } = await sb.from(TB_CONST.TABLES.analytic_category_mappings).delete().eq('id', existing.id).eq('user_id', sbUser.id);
      if (error) throw error;
    }
    return;
  }

  const payload = draft?.tablePayload || {
    user_id: sbUser.id,
    category_name: category,
    subcategory_name: subcategory,
    mapping_status: mappingStatus,
    analytic_family: analyticFamily,
    notes: null,
    updated_at: new Date().toISOString(),
  };
  if (existing?.id) {
    const { error } = await sb.from(TB_CONST.TABLES.analytic_category_mappings).update(payload).eq('id', existing.id).eq('user_id', sbUser.id);
    if (error) throw error;
  } else {
    const { error } = await sb.from(TB_CONST.TABLES.analytic_category_mappings).insert([payload]);
    if (error) throw error;
  }
}

function _openGuidedCategoryModal(defaults = {}) {
  return new Promise((resolve) => {
    const modal = _tbEnsureModal();
    modal.setOnDismiss(() => resolve(null));
    modal.setTitle(defaults.title || 'Nouvelle catégorie');
    modal.setBody(window.TBSettingsCategoriesView?.renderGuidedCategoryModalBody?.({
      name: defaults.name || '',
      color: defaults.color || '#94a3b8',
      mapping: defaults.mapping || '__unmapped__',
      analyticSelectOptions: _analyticSelectOptions,
      esc: escapeHTML,
    }) || '<div class="muted">Module catégories indisponible.</div>');
    modal.setActions([
      { label: 'Annuler', onClick: () => { modal.close(); resolve(null); } },
      { label: defaults.confirmLabel || 'Créer', className: 'btn primary', onClick: () => {
          const name = String(document.getElementById('tb-cat-create-name')?.value || '').trim();
          const color = String(document.getElementById('tb-cat-create-color')?.value || '#94a3b8').trim() || '#94a3b8';
          const mapping = String(document.getElementById('tb-cat-create-mapping')?.value || '__unmapped__').trim() || '__unmapped__';
          modal.close();
          resolve({ name, color, mapping });
        } }
    ]);
    modal.open();
    setTimeout(() => document.getElementById('tb-cat-create-name')?.focus(), 0);
  });
}

function _openGuidedSubcategoryModal(categoryName, defaults = {}) {
  return new Promise((resolve) => {
    const modal = _tbEnsureModal();
    modal.setOnDismiss(() => resolve(null));
    const category = String(categoryName || '').trim();
    modal.setTitle(defaults.title || `Nouvelle sous-catégorie · ${category}`);
    modal.setBody(window.TBSettingsCategoriesView?.renderGuidedSubcategoryModalBody?.({
      category,
      name: defaults.name || '',
      color: defaults.color || '',
      mapping: defaults.mapping || '__inherit__',
      analyticSelectOptions: _analyticSelectOptions,
      esc: escapeHTML,
    }) || '<div class="muted">Module catégories indisponible.</div>');
    modal.setActions([
      { label: 'Annuler', onClick: () => { modal.close(); resolve(null); } },
      { label: defaults.confirmLabel || 'Créer', className: 'btn primary', onClick: () => {
          const name = String(document.getElementById('tb-subcat-create-name')?.value || '').trim();
          const color = String(document.getElementById('tb-subcat-create-color')?.value || '').trim();
          const mapping = String(document.getElementById('tb-subcat-create-mapping')?.value || '__inherit__').trim() || '__inherit__';
          modal.close();
          resolve({ name, color, mapping });
        } }
    ]);
    modal.open();
    setTimeout(() => document.getElementById('tb-subcat-create-name')?.focus(), 0);
  });
}

async function saveAnalyticCategoryMapping(categoryName, nextValue) {
  return safeCall('Mapping analytique catégorie', async () => {
    const category = String(categoryName || '').trim();
    const value = String(nextValue || '').trim();
    if (!category) throw new Error('Catégorie invalide.');
    await _saveAnalyticMappingRuleViaRpc(category, null, value);
    await refreshFromServer();
    renderSettings();
  });
}

async function saveAnalyticSubcategoryMapping(categoryName, subcategoryName, nextValue) {
  return safeCall('Mapping analytique sous-catégorie', async () => {
    const category = String(categoryName || '').trim();
    const subcategory = String(subcategoryName || '').trim();
    const value = String(nextValue || '').trim();
    if (!category || !subcategory) throw new Error('Sous-catégorie invalide.');
    await _saveAnalyticMappingRuleViaRpc(category, subcategory, value);
    await refreshFromServer();
    renderSettings();
  });
}

function renderCategoriesSettingsUI() {
  const host = document.getElementById("cat-list");
  if (!host) return;

  const cats = (typeof getCategories === "function") ? getCategories() : (state.categories || []);
  const colors = (typeof getCategoryColors === "function") ? getCategoryColors() : (state.categoryColors || {});

  const simpleMode = (typeof window.tbIsSimpleMode === 'function') ? window.tbIsSimpleMode() : false;
  const renderOptions = {
    categories: cats,
    colors,
    simpleMode,
    getSubRows: (category) => _subcategoriesForSettings(category, true),
    getMapping: (category, subcategory) => _effectiveAnalyticMappingFor(category, subcategory),
    getUsage: (category, subcategory) => _auditUsageFor(category, subcategory),
    analyticSelectOptions: _analyticSelectOptions,
    analyticStatusPillHtml: _analyticStatusPillHtml,
    analyticUsagePillHtml: _analyticUsagePillHtml,
    analyticFamilyLabel: _analyticFamilyLabel,
    esc: escapeHTML,
  };
  const renderer = window.TBSettingsCategoriesView?.renderSettingsCategoriesList;
  if (typeof renderer === "function") {
    host.innerHTML = renderer(renderOptions);
    return;
  }
  host.innerHTML = `<div class="muted">Chargement des catégories…</div>`;
  if (typeof window.TBLoadSettingsCategoriesView === "function") {
    window.TBLoadSettingsCategoriesView()
      .then((view) => {
        if (document.getElementById("cat-list") !== host) return;
        const lazyRenderer = view?.renderSettingsCategoriesList;
        host.innerHTML = typeof lazyRenderer === "function"
          ? lazyRenderer(renderOptions)
          : `<div class="muted">Aucune catégorie. Ajoute-en une ci-dessus.</div>`;
      })
      .catch((err) => {
        console.warn("[TB][settings] categories view load failed", err);
        if (document.getElementById("cat-list") === host) host.innerHTML = `<div class="muted">Catégories indisponibles.</div>`;
      });
    return;
  }
  host.innerHTML = `<div class="muted">Aucune catégorie. Ajoute-en une ci-dessus.</div>`;
}

function _settingsValidationNotice(message) {
  const text = String(message || "Valeur invalide.").trim();
  if (!text) return;
  const notifier = window.TBSettingsCategoriesView?.notifySettingsValidation;
  if (typeof notifier === "function") {
    notifier({
      message: text,
      toastWarn: window.toastWarn,
      toastInfo: window.toastInfo,
      alertFn: (value) => alert(value),
    });
    return;
  }
  alert(text);
}

function addCategory() {
  safeCall("Add category", async () => {
    const nameEl = document.getElementById("cat-name");
    const colorEl = document.getElementById("cat-color");
    const defaults = {
      name: String(nameEl?.value || "").trim(),
      color: String(colorEl?.value || "#94a3b8"),
      mapping: '__unmapped__',
      title: 'Nouvelle catégorie',
      confirmLabel: 'Créer',
    };
    const result = await _openGuidedCategoryModal(defaults);
    if (!result) return;
    const categoryDraft = window.TBSettingsCategoriesView?.prepareCategoryUpsertDraft?.({
      name: result?.name,
      color: result?.color,
      categories: state.categories || [],
      userId: sbUser.id,
    });
    if (categoryDraft && !categoryDraft.ok) {
      _settingsValidationNotice(categoryDraft.reason || "Catégorie invalide.");
      return;
    }
    if (!categoryDraft) {
      _settingsValidationNotice("Module catégories indisponible.");
      return;
    }
    const name = categoryDraft.name;
    const color = categoryDraft.color;
    const mapping = String(result?.mapping || '__unmapped__').trim() || '__unmapped__';

    if (categoryDraft.mode === 'update') {
      const { error: upErr } = await sb
        .from(TB_CONST.TABLES.categories)
        .update(categoryDraft.payload)
        .eq("user_id", sbUser.id)
        .eq("name", categoryDraft.existingName);
      if (upErr) throw upErr;
    } else {
      const { error: insErr } = await sb
        .from(TB_CONST.TABLES.categories)
        .insert([categoryDraft.payload]);
      if (insErr) throw insErr;
    }

    if (typeof setCategoryHidden === "function") setCategoryHidden(name, false);
    await _saveAnalyticMappingRuleViaRpc(name, null, mapping);
    if (nameEl) nameEl.value = "";
    if (colorEl) colorEl.value = color;
    await refreshFromServer();
    renderSettings();
  });
}

function deleteCategory(name) {
  safeCall("Delete category", async () => {
    const n = String(name || "").trim();
    if (!n) return;
    if (!confirm(`Supprimer la catégorie "${n}" ?

Cela supprimera aussi ses sous-catégories SQL et ses règles analytiques liées.`)) return;
    await _deleteCategoryBundleViaRpc(n);
    await refreshFromServer();
    renderSettings();
  });
}

function setCategoryColor(name, color) {
  safeCall("Set category color", async () => {
    const categoryDraft = window.TBSettingsCategoriesView?.prepareCategoryUpsertDraft?.({
      name,
      color,
      categories: state.categories || [],
      userId: sbUser.id,
    });
    if (categoryDraft && !categoryDraft.ok) {
      _settingsValidationNotice(categoryDraft.reason || "Catégorie invalide.");
      return;
    }
    if (!categoryDraft) {
      _settingsValidationNotice("Module catégories indisponible.");
      return;
    }
    const { error: upErr } = await sb
      .from(TB_CONST.TABLES.categories)
      .update({ color: categoryDraft.color, updated_at: categoryDraft.payload.updated_at })
      .eq("user_id", sbUser.id)
      .eq("name", categoryDraft.existingName || categoryDraft.name);
    if (upErr) throw upErr;

    await refreshFromServer();
    renderSettings();
  });
}

async function importExistingSubcategory(categoryName, subcategoryName) {
  return safeCall("Import subcategory", async () => {
    const category = String(categoryName || '').trim();
    const name = String(subcategoryName || '').trim();
    const existingRows = _subcategoriesForSettings(category, true);
    const importDraft = window.TBSettingsCategoriesView?.prepareSubcategoryImportDraft?.({
      category,
      name,
      rows: existingRows,
      userId: sbUser.id,
      resolveCategoryId: _categoryIdByName,
    });
    if (importDraft && !importDraft.ok) {
      _settingsValidationNotice(importDraft.reason || 'Sous-catégorie invalide.');
      return;
    }
    if (!importDraft) {
      _settingsValidationNotice('Module catégories indisponible.');
      return;
    }
    const payload = importDraft.payload;
    const { error } = await sb.from(TB_CONST.TABLES.category_subcategories).insert([payload]);
    if (error) throw error;
    await refreshFromServer();
    renderSettings();
  });
}

async function addSubcategory(categoryName) {
  return safeCall("Add subcategory", async () => {
    const category = String(categoryName || '').trim();
    if (!category) {
      _settingsValidationNotice('Catégorie invalide.');
      return;
    }
    const result = await _openGuidedSubcategoryModal(category, { mapping: '__inherit__', title: `Nouvelle sous-catégorie · ${category}`, confirmLabel: 'Créer' });
    if (!result) return;
    const name = String(result?.name || '').trim();
    const color = String(result?.color || '').trim();
    const mapping = String(result?.mapping || '__inherit__').trim() || '__inherit__';
    const existingRows = _subcategoriesForSettings(category, true);
    const createDraft = window.TBSettingsCategoriesView?.prepareSubcategoryCreateDraft?.({
      category,
      name,
      color,
      rows: existingRows,
      userId: sbUser.id,
      resolveCategoryId: _categoryIdByName,
    });
    if (createDraft && !createDraft.ok) {
      _settingsValidationNotice(createDraft.reason || 'Sous-catégorie invalide.');
      return;
    }
    if (!createDraft) {
      _settingsValidationNotice('Module catégories indisponible.');
      return;
    }
    const payload = createDraft.payload;
    const { error } = await sb.from(TB_CONST.TABLES.category_subcategories).insert([payload]);
    if (error) throw error;
    await _saveAnalyticMappingRuleViaRpc(category, name, mapping);
    await refreshFromServer();
    renderSettings();
  });
}

async function editSubcategory(id) {
  return safeCall("Edit subcategory", async () => {
    const row = (Array.isArray(state?.categorySubcategories) ? state.categorySubcategories : []).find((x) => String(x?.id) === String(id));
    if (!row) {
      _settingsValidationNotice('Sous-catégorie introuvable.');
      return;
    }
    const category = String(row?.categoryName || row?.category_name || '').trim();
    const currentName = String(row?.name || '').trim();
    const currentMapping = _effectiveAnalyticMappingFor(category, currentName);
    const currentMappingValue = currentMapping?.explicit
      ? (currentMapping.mappingStatus === 'mapped' ? String(currentMapping.analyticFamily || '').trim().toLowerCase() : '__excluded__')
      : '__inherit__';
    const result = await _openGuidedSubcategoryModal(category, {
      name: currentName,
      color: String(row?.color || ''),
      mapping: currentMappingValue,
      title: `Modifier sous-catégorie · ${category}`,
      confirmLabel: 'Enregistrer',
    });
    if (!result) return;
    const name = String(result?.name || '').trim();
    const color = String(result?.color || '').trim();
    const mapping = String(result?.mapping || '__inherit__').trim() || '__inherit__';
    const editDraft = window.TBSettingsCategoriesView?.prepareSubcategoryEditDraft?.({
      row,
      name,
      color,
      rows: _subcategoriesForSettings(category, true),
      currentId: id,
      previousRule: _findAnalyticRule(category, currentName),
      resolveCategoryId: _categoryIdByName,
    });
    if (editDraft && !editDraft.ok) {
      _settingsValidationNotice(editDraft.reason || 'Sous-catégorie invalide.');
      return;
    }
    if (!editDraft) {
      _settingsValidationNotice('Module catégories indisponible.');
      return;
    }
    const { error } = await sb.from(TB_CONST.TABLES.category_subcategories).update(editDraft.payload).eq('id', id).eq('user_id', sbUser.id);
    if (error) throw error;
    if (editDraft.previousMappingRuleId) {
      const { error: delMapErr } = await sb
        .from(TB_CONST.TABLES.analytic_category_mappings)
        .delete()
        .eq('id', editDraft.previousMappingRuleId)
        .eq('user_id', sbUser.id);
      if (delMapErr) throw delMapErr;
    }
    await _saveAnalyticMappingRuleViaRpc(category, name, mapping);
    await refreshFromServer();
    renderSettings();
  });
}


async function moveSubcategory(id, direction) {
  const target = (Array.isArray(state?.categorySubcategories) ? state.categorySubcategories : []).find((x) => String(x?.id) === String(id));
  if (!target) return;

  const category = String(target?.categoryName || target?.category_name || '').trim();
  if (!category) return;

  const sqlRows = _subcategoriesForSettings(category, true).filter((row) => row?.id);
  const moveDraft = window.TBSettingsCategoriesView?.prepareSubcategoryMoveDraft?.({
    rows: sqlRows,
    id,
    direction,
  });
  if (!moveDraft?.ok) return;

  const previousSnapshot = (Array.isArray(state?.categorySubcategories) ? state.categorySubcategories : []).map((row) => ({
    ...row,
    sortOrder: row?.sortOrder,
    sort_order: row?.sort_order,
  }));

  const nextSortById = new Map(moveDraft.nextRows.map((row) => [String(row?.id || ''), row]));
  state.categorySubcategories = (Array.isArray(state?.categorySubcategories) ? state.categorySubcategories : []).map((row) => nextSortById.get(String(row?.id || '')) || row);

  renderSettings();

  try {
    const nowIso = new Date().toISOString();
    for (const row of moveDraft.updates) {
      const { error } = await sb
        .from(TB_CONST.TABLES.category_subcategories)
        .update({ sort_order: row.sort_order, updated_at: nowIso })
        .eq('id', row.id)
        .eq('user_id', sbUser.id);

      if (error) throw error;
    }
  } catch (e) {
    state.categorySubcategories = previousSnapshot;
    renderSettings();
    throw e;
  }
}

async function toggleSubcategoryActive(id, nextActive) {
  return safeCall("Toggle subcategory", async () => {
    const activeDraft = window.TBSettingsCategoriesView?.prepareSubcategoryActiveDraft?.({
      id,
      nextActive,
    });
    if (activeDraft && !activeDraft.ok) {
      _settingsValidationNotice(activeDraft.reason || 'Sous-catégorie introuvable.');
      return;
    }
    if (!activeDraft) {
      _settingsValidationNotice('Module catégories indisponible.');
      return;
    }
    const { error } = await sb
      .from(TB_CONST.TABLES.category_subcategories)
      .update(activeDraft.payload)
      .eq('id', activeDraft.id)
      .eq('user_id', sbUser.id);
    if (error) throw error;
    await refreshFromServer();
    renderSettings();
  });
}

window.addCategory = addCategory;
window.deleteCategory = deleteCategory;
window.setCategoryColor = setCategoryColor;
window.addSubcategory = addSubcategory;
window.editSubcategory = editSubcategory;
window.toggleSubcategoryActive = toggleSubcategoryActive;
window.moveSubcategory = moveSubcategory;
window.importExistingSubcategory = importExistingSubcategory;
window.saveAnalyticCategoryMapping = saveAnalyticCategoryMapping;
window.saveAnalyticSubcategoryMapping = saveAnalyticSubcategoryMapping;
