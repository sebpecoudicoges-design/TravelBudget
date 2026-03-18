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
  try {
    const raw = localStorage.getItem(`tb_settings_open_${key}`);
    if (raw === '1') return true;
    if (raw === '0') return false;
  } catch(_) {}
  return !!fallbackOpen;
}

function _tbSettingsSetPanelState(key, isOpen){
  try { localStorage.setItem(`tb_settings_open_${key}`, isOpen ? '1' : '0'); } catch(_) {}
}

function _tbSettingsCardSummary(card){
  const id = String(card?.id || '');
  if (id === 'tb-account-card') {
    const base = String(state?.user?.baseCurrency || 'EUR').toUpperCase();
    return { kicker:'Compte', summary:`Devise de base ${base} · sécurité et préférences`, pills:[base] };
  }
  if (id === 'tb-travel-card') {
    const travel = (state?.travels || []).find(t => String(t?.id||'') === String(state?.activeTravelId||''));
    const name = String(travel?.name || state?.period?.name || 'Voyage actif');
    return { kicker:'Voyage', summary:`${name} · réglages généraux et budget de référence`, pills:[name] };
  }
  if (id === 'tb-periods-card') {
    const count = Array.isArray(state?.budgetSegments) ? state.budgetSegments.length : 0;
    return { kicker:'Périodes', summary:`${count} période${count>1?'s':''} visible${count>1?'s':''} · devise, budget/jour et héritage`, pills:[`${count} période${count>1?'s':''}`] };
  }
  if (id === 'tb-recurring-card') {
    const count = Array.isArray(state?.recurringRules) ? state.recurringRules.length : 0;
    return { kicker:'Échéances', summary:`${count} règle${count>1?'s':''} récurrente${count>1?'s':''}`, pills:[`${count} règle${count>1?'s':''}`] };
  }
  if (id.includes('palette')) return { kicker:'Palette', summary:'Couleurs et apparence générale', pills:['Visuel'] };
  if (id.includes('categories')) return { kicker:'Catégories', summary:'Catégories et sous-catégories utilisées dans l’app', pills:['Classement'] };
  const title = String(card?.querySelector('h2')?.textContent || '').trim() || 'Réglages';
  return { kicker:'Réglages', summary:title, pills:[] };
}

function _tbSettingsEnsureHero(view){
  if(!view) return;
  const travel = (state?.travels || []).find(t => String(t?.id||'') === String(state?.activeTravelId||''));
  const segCount = Array.isArray(state?.budgetSegments) ? state.budgetSegments.length : 0;
  const rrCount = Array.isArray(state?.recurringRules) ? state.recurringRules.length : 0;
  let hero = view.querySelector('.tb-settings-hero');
  if (!hero) {
    hero = document.createElement('div');
    hero.className = 'tb-settings-hero';
    view.insertBefore(hero, view.firstChild);
  }
  hero.innerHTML = `
    <div>
      <div class="tb-settings-hero-title">Réglages</div>
      <div class="tb-settings-hero-copy">Un espace plus simple à parcourir : ouvre uniquement le bloc utile, garde les textes courts, et concentre-toi sur le voyage actif.</div>
    </div>
    <div class="tb-settings-hero-chips">
      <span class="tb-settings-hero-chip">${escapeHTML(String(travel?.name || 'Voyage actif'))}</span>
      <span class="tb-settings-hero-chip">${escapeHTML(String(segCount))} période${segCount>1?'s':''}</span>
      <span class="tb-settings-hero-chip">${escapeHTML(String(rrCount))} échéance${rrCount>1?'s':''}</span>
    </div>`;
}

function _tbSettingsDecoratePanels(view){
  if(!view) return;
  const cards = Array.from(view.querySelectorAll('#tb-account-card, #tb-travel-card, #tb-periods-card, #tb-recurring-card, .tb-settings-card--palette, .tb-settings-card--categories'));
  cards.forEach((card)=>{
    card.classList.add('tb-settings-panel');
    const id = String(card.id || card.className || 'settings');
    const meta = _tbSettingsCardSummary(card);
    let h2 = card.querySelector(':scope > h2');
    if (!h2) h2 = card.querySelector('h2');
    if (!h2) return;
    let body = card.querySelector(':scope > .tb-settings-panel-body');
    if (!body) {
      body = document.createElement('div');
      body.className = 'tb-settings-panel-body';
      const nodes = [];
      let n = h2.nextSibling;
      while (n) { const next = n.nextSibling; nodes.push(n); n = next; }
      nodes.forEach(node => body.appendChild(node));
      const head = document.createElement('button');
      head.type = 'button';
      head.className = 'tb-settings-panel-head';
      head.innerHTML = `
        <span class="tb-settings-panel-head-main">
          <span class="tb-settings-panel-kicker"></span>
          <span class="tb-settings-panel-title"></span>
          <span class="tb-settings-panel-summary"></span>
        </span>
        <span class="tb-settings-panel-side">
          <span class="tb-settings-pill tb-settings-panel-pill"></span>
          <span class="tb-settings-panel-arrow">⌄</span>
        </span>`;
      head.onclick = ()=>{
        const isCollapsed = card.classList.toggle('is-collapsed');
        _tbSettingsSetPanelState(id, !isCollapsed);
      };
      card.insertBefore(head, h2);
      const divider = document.createElement('div');
      divider.className = 'tb-settings-divider';
      card.insertBefore(divider, body);
      card.appendChild(body);
      h2.style.display = 'none';
    }
    const head = card.querySelector(':scope > .tb-settings-panel-head');
    if (head) {
      const titleEl = head.querySelector('.tb-settings-panel-title');
      const kickerEl = head.querySelector('.tb-settings-panel-kicker');
      const summaryEl = head.querySelector('.tb-settings-panel-summary');
      const pillEl = head.querySelector('.tb-settings-panel-pill');
      if (titleEl) titleEl.textContent = String(h2.textContent || '').trim();
      if (kickerEl) kickerEl.textContent = meta.kicker || 'Réglages';
      if (summaryEl) summaryEl.textContent = meta.summary || '';
      if (pillEl) {
        pillEl.textContent = meta.pills?.[0] || 'Ouvrir';
        pillEl.style.display = (meta.pills && meta.pills.length) ? '' : 'none';
      }
    }
    const shouldOpen = _tbSettingsGetPanelState(id, id === 'tb-travel-card' || id === 'tb-periods-card');
    card.classList.toggle('is-collapsed', !shouldOpen);
  });
}

function renderSettings(){
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
      let overview = document.getElementById("tb-travel-overview");
      if (!overview) {
        overview = document.createElement("div");
        overview.id = "tb-travel-overview";
        const budgetHost = document.getElementById("tb-travel-budget-reference-inline");
        travelCard.insertBefore(overview, budgetHost || travelCard.children[1] || null);
      }
      const travelDefault = window.__tbBudgetReferenceCache?.travelDefault || null;
      const segCount = segs.length;
      const budgetMeta = _tbTravelWeightedBudgetPerDay(segs);
      const budgetAvg = budgetMeta.amount;
      const budgetCur = budgetMeta.currency || String(state?.user?.baseCurrency || 'EUR').toUpperCase();
      const recoDay = Number(travelDefault?.recommended_daily_amount || 0);
      const recoCur = String(travelDefault?.currency_code || 'EUR').toUpperCase();
      const totalDays = budgetMeta.totalDays || 0;
      const mainCurrency = (()=>{
        const counts = new Map();
        segs.forEach((seg)=>{
          const cur = String(seg?.baseCurrency || '').toUpperCase();
          if (!cur) return;
          counts.set(cur, (counts.get(cur) || 0) + Number(_tbBudgetRefDurationDays(seg) || 1));
        });
        return [...counts.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0] || String(state?.period?.baseCurrency || '—').toUpperCase();
      })();
      overview.innerHTML = `
        <div class="tb-settings-summary">
          <div class="tb-settings-summary-head">
            <div>
              <div class="tb-settings-summary-title">Vue d’ensemble du voyage</div>
              <div class="tb-settings-summary-copy">Le voyage, le budget prévu et la référence pays au même endroit.</div>
            </div>
            <div class="tb-settings-summary-chips">
              <span class="tb-settings-pill">${escapeHTML(String(segCount))} période${segCount>1?'s':''}</span>
              <span class="tb-settings-pill">${escapeHTML(String(totalDays||0))} jours</span>
            </div>
          </div>
          <div class="tb-budget-summary-grid">
            <div class="tb-settings-stat"><span class="tb-settings-stat-label">Budget prévu / jour</span><strong>${budgetAvg!==null?escapeHTML(_tbBudgetRefFmtAmount(budgetAvg, budgetCur, 0)):'—'}</strong></div>
            <div class="tb-settings-stat"><span class="tb-settings-stat-label">Référence voyage</span><strong>${escapeHTML(travelDefault?.country_name || travelDefault?.country_code || 'À définir')}</strong></div>
            <div class="tb-settings-stat"><span class="tb-settings-stat-label">Recommandé / jour</span><strong>${Number.isFinite(recoDay)&&recoDay>0?escapeHTML(_tbBudgetRefFmtAmount(recoDay, recoCur, 2)):'—'}</strong></div>
            <div class="tb-settings-stat"><span class="tb-settings-stat-label">Devise la plus utilisée</span><strong>${escapeHTML(mainCurrency)}</strong></div>
          </div>
        </div>`;
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

      box.innerHTML = `
        <div class="muted" style="margin-bottom:10px;">Devise de base, seuil d’alerte et mot de passe.</div>

        <div class="row" style="gap:12px; align-items:end; flex-wrap:wrap;">
          <div class="field" style="min-width:260px;">
            <label>Email</label>
            <input id="tb-account-email" type="text" value="—" disabled />
          </div>

          <div class="field" style="min-width:160px;">
            <label>Devise de base</label>
            <select id="tb-user-basecur">
              ${opts.map(c=>`<option value="${escapeHTML(c)}" ${String(c).toUpperCase()===cur?"selected":""}>${escapeHTML(c)}</option>`).join("")}
            </select>
          </div>

          <button class="btn" id="tb-user-basecur-save" type="button">Enregistrer</button>
          <button class="btn" id="tb-user-resetpwd" type="button">Reset mot de passe</button>
        </div>

        <div class="row" style="gap:12px; align-items:end; flex-wrap:wrap; margin-top:10px;">
          <div class="field" style="min-width:220px;">
            <label>Seuil courbe trésorerie</label>
            <input id="tb-user-cfthr" type="number" min="1" step="1" value="${escapeHTML(thrDisp || "")}" />
          </div>
          <div class="muted" style="padding-bottom:6px;">Référence ${escapeHTML(String(Math.round(thrEur)))} EUR · ajustée si tu changes la devise de base</div>
          <button class="btn" id="tb-user-cfthr-save" type="button">Enregistrer seuil</button>
        </div>
      `;

      const _getSb = () => {
        try {
          if (typeof window._tbSb === "function") return window._tbSb();
          if (window.__TB_SB__) return window.__TB_SB__;
          if (window.sb) return window.sb;
        } catch(_){ }
        throw new Error("Supabase client not found");
      };

      const btnSave = box.querySelector("#tb-user-basecur-save");
      if (btnSave) {
        btnSave.onclick = () => safeCall("Enregistrer devise de base", async () => {
          const s = _getSb();
          const v = String(box.querySelector("#tb-user-basecur")?.value || "").trim().toUpperCase();
          if (!v || !/^[A-Z]{3}$/.test(v)) throw new Error("Devise invalide (ISO3 attendu)");
          const u = (await s.auth.getUser()).data?.user;
          const uid = u?.id;
          if (!uid) throw new Error("Non authentifié");
          await s.from(TB_CONST.TABLES.settings).upsert({ user_id: uid, base_currency: v }, { onConflict: "user_id" });
          if (!state.user) state.user = {};
          state.user.baseCurrency = v;
          if (typeof tbRequestRenderAll === "function") tbRequestRenderAll("settings:base_currency"); else renderAll();
        });
      }

      const btnReset = box.querySelector("#tb-user-resetpwd");
      if (btnReset) {
        btnReset.onclick = () => safeCall("Reset mot de passe", async () => {
          const s = _getSb();
          const u = (await s.auth.getUser()).data?.user;
          const em = String(u?.email || "").trim();
          if (!em) throw new Error("Email introuvable");
          await s.auth.resetPasswordForEmail(em);
          alert("Email de réinitialisation envoyé.");
        });
      }

      // Fill email asynchronously (sbUser is not guaranteed on window)
      (async () => {
        try {
          const s = _getSb();
          const u = (await s.auth.getUser()).data?.user;
          const em = String(u?.email || "—");
          const inp = box.querySelector("#tb-account-email");
          if (inp) inp.value = em;
        } catch(_) {}
      })();

      // Save cashflow threshold (EUR reference)
      const btnThr = box.querySelector("#tb-user-cfthr-save");
      if (btnThr) {
        btnThr.onclick = () => safeCall("Enregistrer seuil trésorerie", async () => {
          const v = Number(box.querySelector("#tb-user-cfthr")?.value);
          if (!Number.isFinite(v) || v <= 0) throw new Error("Seuil invalide");
          const eur = (typeof window.safeFxConvert === "function")
            ? window.safeFxConvert(v, cur, "EUR", null)
            : (typeof window.fxConvert === "function" ? window.fxConvert(v, cur, "EUR") : null);
          if (eur === null || !Number.isFinite(eur) || eur <= 0) throw new Error("Conversion FX impossible");
          try { localStorage.setItem(THR_KEY, String(Math.round(eur))); } catch(_) {}
          if (typeof tbRequestRenderAll === "function") tbRequestRenderAll("settings:cashflow_threshold"); else renderAll();
        });
      }
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

    const fxTop = document.createElement("div");
    fxTop.className = "card";
    fxTop.style.marginBottom = "10px";
    fxTop.innerHTML = `
      <div class="row" style="align-items:center; justify-content:space-between;">
        <div>
          <b>Taux de change</b>
          <span class="muted">Automatique ${typeof tbHelp === 'function' ? tbHelp(_fxHelp) : `<span title="${escapeHTML(_fxHelp)}" style="cursor:help; user-select:none; padding-left:6px;">(?)</span>`}</span>
        </div>
      </div>
    `;
    host.appendChild(fxTop);

    // Taux perso (avancé)
    const manualPanel = document.createElement("div");
    manualPanel.className = "card";
    manualPanel.style.marginBottom = "10px";

    let manualRates = {};
    try { manualRates = (typeof window.tbFxGetManualRates === "function") ? (window.tbFxGetManualRates() || {}) : {}; } catch(_) { manualRates = {}; }

    const manualList = Object.entries(manualRates || {})
      .map(([c,v]) => ({ c:String(c||"").toUpperCase(), rate:Number(v && v.rate), asOf: (v && v.asOf ? String(v.asOf).slice(0,10) : null) }))
      .filter(x => x.c && x.c !== "EUR" && Number.isFinite(x.rate) && x.rate > 0)
      .sort((a,b)=>a.c.localeCompare(b.c));

    manualPanel.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:space-between; gap:8px;">
        <div>
          <b>Taux perso</b>
          <span class="muted">• optionnel</span>
        </div>
        <button class="btn" data-act="mf-add" title="Ajouter/mettre à jour un taux perso">Ajouter</button>
      </div>
      <div style="margin-top:8px; overflow:auto;">
        ${manualList.length ? `
          <table class="table" style="width:100%; min-width:520px;">
            <thead><tr>
              <th>Devise</th><th>Taux</th><th>Date</th><th style="text-align:right;">Actions</th>
            </tr></thead>
            <tbody>
              ${manualList.map(x => `
                <tr>
                  <td><b>${escapeHTML(x.c)}</b></td>
                  <td>${escapeHTML(String(Number(x.rate).toFixed(6)).replace(/\.0+$/,''))}</td>
                  <td>${escapeHTML(x.asOf || "—")}</td>
                  <td style="text-align:right; white-space:nowrap;">
                    <button class="btn" data-act="mf-edit" data-cur="${escapeHTML(x.c)}">Modifier</button>
                    <button class="btn danger" data-act="mf-del" data-cur="${escapeHTML(x.c)}">Supprimer</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : `<div class="muted">Aucun taux perso enregistré.</div>`}
      </div>
    `;
    host.appendChild(manualPanel);

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
        const autoAvail = (typeof window.tbFxIsAutoAvailable==="function") ? window.tbFxIsAutoAvailable(cur) : false;
        let manualObj = null; let manualRate = null; let manualAsof = null;
        try { if (typeof window.tbFxGetManualRates==="function") manualObj = (window.tbFxGetManualRates()||{})[cur] ?? null; } catch(_) {}
        manualRate = manualObj && typeof manualObj === 'object' ? Number(manualObj.rate) : null;
        manualAsof = manualObj && typeof manualObj === 'object' ? (manualObj.asOf || null) : null;
        let autoAsof2 = null; try { autoAsof2 = localStorage.getItem(TB_CONST.LS_KEYS.eur_rates_asof) || null; } catch(_) {}
        const todayISO = (typeof toLocalISODate === "function") ? toLocalISODate(new Date()) : new Date().toISOString().slice(0,10);
        const ratesMerged = (typeof window.fxGetEurRates === "function") ? window.fxGetEurRates() : null;
        const usedRate = (typeof window.fxRate==="function" && ratesMerged) ? window.fxRate("EUR", cur, ratesMerged) : null;
        const rateDisplay = (usedRate!==null && usedRate!==undefined && Number.isFinite(Number(usedRate))) ? String(Number(usedRate).toFixed(2)) : "";

        const refDay2 = (typeof window.tbFxRefDay === "function") ? window.tbFxRefDay() : (autoAsof2 || todayISO);
        const stale = (!autoAvail && manualRate && (!manualAsof || String(manualAsof).slice(0,10) < String(refDay2).slice(0,10)));
        const srcLabel = autoAvail ? "Auto" : (manualRate ? "Taux perso" : "Manquant");
        const srcMeta = autoAvail
          ? (autoAsof2?` • asOf: ${autoAsof2}`: "")
          : (manualRate ? (` • asOf: ${manualAsof || "—"}${stale ? " (à confirmer)" : ""}`) : "");
        const fxLineHelp = `Taux automatique si disponible. Sinon, tu peux saisir un taux perso.`;
        const fxUiMode = autoAvail ? "Taux automatique" : (manualRate ? "Taux perso" : "Taux");
        const fxUiStatus = autoAvail ? "À jour" : (manualRate ? (stale ? "Mise à jour recommandée" : "À jour") : "À renseigner");

        wrap.classList.add('tb-period-card');
        const defaultOpen = idx === 0;
        wrap.classList.toggle('is-collapsed', !defaultOpen);
        wrap.innerHTML = `
          <button type="button" class="tb-period-head" data-act="toggle-period">
            <span class="tb-period-head-main">
              <span class="tb-period-title">Période ${escapeHTML(_tbISO(seg.start)||"—")} → ${escapeHTML(_tbISO(seg.end)||"—")}</span>
              <span class="tb-period-subtitle">${escapeHTML(String(_tbBudgetRefDurationDays(seg) || ""))} jours · ${escapeHTML(String(seg.baseCurrency||"").toUpperCase())} · budget ${escapeHTML(_tbBudgetRefFmtAmount(seg.dailyBudgetBase, (seg.baseCurrency||"").toUpperCase(), 0))}</span>
            </span>
            <span class="tb-period-head-side">
              <span class="tb-period-status">${escapeHTML(fxUiMode)} · ${escapeHTML((rateDisplay || "") || "—")}</span>
              <span class="tb-period-status">${escapeHTML(fxUiStatus)}</span>
              <span class="tb-period-arrow">⌄</span>
            </span>
          </button>
          <div class="tb-period-body">
            <div class="tb-period-topgrid">
              <div class="tb-settings-stat"><span class="tb-settings-stat-label">Budget prévu / jour</span><strong>${escapeHTML(_tbBudgetRefFmtAmount(seg.dailyBudgetBase, (seg.baseCurrency||"").toUpperCase(), 0))}</strong></div>
              <div class="tb-settings-stat"><span class="tb-settings-stat-label">Devise</span><strong>${escapeHTML((seg.baseCurrency||"").toUpperCase())}</strong></div>
              <div class="tb-settings-stat"><span class="tb-settings-stat-label">Taux</span><strong>${escapeHTML((rateDisplay || "") || "—")}</strong></div>
              <div class="tb-settings-stat is-wide"><span class="tb-settings-stat-label">Période</span><strong>${escapeHTML(_tbISO(seg.start)||"—")} → ${escapeHTML(_tbISO(seg.end)||"—")}</strong></div>
            </div>
            <div data-br-inline-seg-id="${escapeHTML(String(seg.id))}" style="margin-top:14px;"></div>
            <div class="tb-period-ref-editor">
              <div class="tb-settings-subgrid">
                <div class="field field--span-2">
                  <label>Début</label>
                  <input type="date" data-k="start_date" value="${_tbISO(seg.start)||""}" />
                </div>
                <div class="field field--span-2">
                  <label>Fin</label>
                  <input type="date" data-k="end_date" value="${_tbISO(seg.end)||""}" />
                </div>
                <div class="field field--span-2">
                  <label>Devise</label>
                  <input data-k="base_currency" value="${(seg.baseCurrency||"").toUpperCase()}" />
                </div>
                <div class="field field--span-2">
                  <label>Budget / jour</label>
                  <input data-k="daily_budget_base" value="${seg.dailyBudgetBase ?? ""}" />
                </div>
                <div class="field field--span-2">
                  <label>Nuit transport</label>
                  <input data-k="night_transport_budget" value="${_tbGetNightTransportBudget(seg.id)}" />
                </div>
                ${(!autoAvail) ? `<div class="field field--span-2"><label>Taux perso</label><button class="btn" data-act="fx" title="Définir ou mettre à jour un taux perso pour cette devise">${manualRate ? "Modifier" : "Ajouter"}</button></div>` : ``}
              </div>
              <div class="tb-settings-actions">
                <button class="btn primary" data-act="save">Enregistrer</button>
                <button class="btn danger" data-act="del">Supprimer</button>
              </div>
            </div>
          </div>
        `;

        // handlers
        const toggleBtn = wrap.querySelector('[data-act="toggle-period"]');
        if (toggleBtn) {
          toggleBtn.onclick = ()=>{
            wrap.classList.toggle('is-collapsed');
          };
        }
        wrap.querySelector('[data-act="save"]').onclick = ()=>safeCall("Save période", ()=>saveBudgetSegment(seg.id, wrap));
        const fxBtn = wrap.querySelector('[data-act="fx"]');
        if(fxBtn){
          fxBtn.onclick = ()=>safeCall("Taux manuel", ()=>{ 
            if(typeof window.tbFxEnsureManualRateToday === "function") window.tbFxEnsureManualRateToday(cur, "Devise non fournie par les taux auto");
            renderSettings();
          });
        }
        wrap.querySelector('[data-act="del"]').onclick = ()=>safeCall("Supprimer période", ()=>deleteBudgetSegment(seg.id));
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
  const countryRaw = String(box.querySelector('[data-br="travel-country"]')?.value || '');
  const [country_code, region_code_raw] = countryRaw.split('|');
  return {
    p_travel_id: String(state?.activeTravelId || ''),
    p_country_code: String(country_code || '').trim() || null,
    p_region_code: String(region_code_raw || '').trim() || null,
    p_travel_profile: String(box.querySelector('[data-br="travel-profile"]')?.value || 'solo'),
    p_travel_style: String(box.querySelector('[data-br="travel-style"]')?.value || 'standard'),
    p_adult_count: Number(box.querySelector('[data-br="travel-adults"]')?.value || 1),
    p_child_count: Number(box.querySelector('[data-br="travel-children"]')?.value || 0),
    p_save: true,
  };
}

function _tbBudgetRefSegmentPayload(wrap, seg){
  const countryRaw = String(wrap.querySelector('[data-br="seg-country"]')?.value || '');
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
  const custom = wrap.querySelector('[data-br="seg-custom"]');
  if(!mode || !custom) return;
  const sync = ()=>{ const customMode = mode.value === 'custom'; custom.style.display = customMode ? '' : 'none'; const resetBtn = wrap.querySelector('[data-br-act="seg-reset"]'); if (resetBtn) resetBtn.style.display = customMode ? '' : 'none'; };
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
    await _tbBudgetRefLoadCountries();
    await _tbBudgetRefLoadState();
    const cache = window.__tbBudgetReferenceCache;
    const travel = cache.travelDefault || null;
    const segs = (state?.budgetSegments || []).map(_tbNormSeg).slice().sort((a,b)=>String(a.start).localeCompare(String(b.start)));
    const st = _tbBudgetRefStyle();

    travelHost.innerHTML = `
      <div class="tb-settings-merge-block">
        <div class="tb-settings-merge-head">
          <div>
            <div class="tb-settings-merge-title">Référence voyage</div>
            <div class="tb-settings-merge-copy">Un réglage simple pour tout le voyage. Chaque période peut ensuite le reprendre ou le personnaliser.</div>
          </div>
          <span style="${travel?.country_code ? st.chip : st.chipAlt};">${escapeHTML(travel?.country_code ? 'Par défaut sur le voyage' : 'À définir')}</span>
        </div>
        <div class="tb-budget-summary-grid" style="margin-top:10px;">
          <div class="tb-settings-stat"><span class="tb-settings-stat-label">Pays</span><strong>${escapeHTML(travel?.country_name || travel?.country_code || '—')}</strong></div>
          <div class="tb-settings-stat"><span class="tb-settings-stat-label">Profil</span><strong>${escapeHTML((travel?.travel_profile || 'solo'))} · ${escapeHTML((travel?.travel_style || 'standard'))}</strong></div>
          <div class="tb-settings-stat"><span class="tb-settings-stat-label">Reco / jour</span><strong>${Number.isFinite(Number(travel?.recommended_daily_amount)) ? escapeHTML(String(Number(travel?.recommended_daily_amount).toFixed(2))) : '—'}</strong></div>
          <div class="tb-settings-stat"><span class="tb-settings-stat-label">Héritage</span><strong>${escapeHTML(travel?.country_code ? 'Actif' : 'Inactif')}</strong></div>
        </div>
        <div class="tb-settings-inline-grid" style="margin-top:12px; align-items:end;">
          <div class="field field--span-4">
            <label>Pays de référence</label>
            <select data-br="travel-country">${_tbBudgetRefCountryOptions(travel?.country_code, travel?.region_code)}</select>
          </div>
          <div class="field field--span-2">
            <label>Profil</label>
            <select data-br="travel-profile">
              <option value="solo" ${travel?.travel_profile==='solo'?'selected':''}>Solo</option>
              <option value="couple" ${travel?.travel_profile==='couple'?'selected':''}>Couple</option>
              <option value="family" ${travel?.travel_profile==='family'?'selected':''}>Famille</option>
            </select>
          </div>
          <div class="field field--span-2">
            <label>Style</label>
            <select data-br="travel-style">
              <option value="budget" ${travel?.travel_style==='budget'?'selected':''}>Budget</option>
              <option value="standard" ${(!travel?.travel_style || travel?.travel_style==='standard')?'selected':''}>Standard</option>
              <option value="comfort" ${travel?.travel_style==='comfort'?'selected':''}>Confort</option>
            </select>
          </div>
          <div class="field field--span-2">
            <label>Adultes</label>
            <input data-br="travel-adults" type="number" min="1" step="1" value="${escapeHTML(String(travel?.adult_count ?? 1))}" />
          </div>
          <div class="field field--span-2">
            <label>Enfants</label>
            <input data-br="travel-children" type="number" min="0" step="1" value="${escapeHTML(String(travel?.child_count ?? 0))}" />
          </div>
        </div>
        <div class="tb-settings-actions">
          <button class="btn" data-br-act="travel-clear">Retirer le défaut</button>
          <button class="btn primary" data-br-act="travel-save">Appliquer au voyage</button>
        </div>
      </div>
    `;
    const travelSave = travelHost.querySelector('[data-br-act="travel-save"]');
    const travelClear = travelHost.querySelector('[data-br-act="travel-clear"]');
    if(travelSave){
      travelSave.onclick = ()=>safeCall('Budget ref voyage', async ()=>{
        const s = _tbGetSB();
        const payload = _tbBudgetRefTravelDefaultPayload(travelHost);
        if(!payload.p_country_code) throw new Error('Pays de référence requis.');
        const { error } = await s.rpc(TB_CONST.RPCS.budget_reference_compute_for_travel, payload);
        if (error) throw error;
        await window.tbRenderBudgetReferenceUI();
        _tbToastOk('Budget de référence voyage enregistré.');
      });
    }
    if(travelClear){
      travelClear.onclick = ()=>safeCall('Retirer défaut voyage', async ()=>{
        const s = _tbGetSB();
        const tid2 = String(state?.activeTravelId || '');
        if(!tid2) throw new Error('Voyage non sélectionné.');
        const { error } = await s.from(TB_CONST.TABLES.travel_budget_reference_profile).delete().eq('travel_id', tid2);
        if (error) throw error;
        await window.tbRenderBudgetReferenceUI();
        _tbToastOk('Défaut voyage retiré.');
      });
    }

    segs.forEach((seg)=>{
      const wrap = document.querySelector(`[data-br-inline-seg-id="${String(seg.id).replace(/"/g,'\\"')}"]`);
      if(!wrap) return;
      const override = cache.segmentOverrides[String(seg.id)] || null;
      const resolved = cache.segmentResolved[String(seg.id)] || null;
      const sourceLabel = override ? 'Réglage propre à cette période' : (travel?.country_code ? 'Hérite du voyage' : 'À renseigner');
      wrap.innerHTML = `
        <div class="tb-settings-merge-block tb-settings-merge-block--segment" style="${st.section}">
          <div class="tb-settings-summary-head">
            <div>
              <div class="tb-settings-summary-title">Budget sourcé de la période</div>
              <div class="tb-settings-summary-copy">Budget prévu et recommandation dans la même lecture.</div>
            </div>
            <span style="${override ? st.chip : st.chipAlt};">${escapeHTML(sourceLabel)}</span>
          </div>
          <div class="tb-budget-summary-grid" style="margin-top:10px;">
            <div class="tb-settings-stat"><span class="tb-settings-stat-label">Pays</span><strong>${escapeHTML(resolved?.country_name || resolved?.country_code || '—')}</strong></div>
            <div class="tb-settings-stat"><span class="tb-settings-stat-label">Recommandé / jour</span><strong>${escapeHTML(_tbBudgetRefFmtAmount(resolved?.recommended_daily_amount, resolved?.currency_code || 'EUR', 2))}</strong></div>
            <div class="tb-settings-stat"><span class="tb-settings-stat-label">Budget prévu / jour</span><strong>${escapeHTML(_tbBudgetRefFmtAmount(seg.dailyBudgetBase, seg.baseCurrency || '', 0))}</strong></div>
            <div class="tb-settings-stat"><span class="tb-settings-stat-label">Mode</span><strong>${escapeHTML(override ? 'Personnalisé' : 'Hérité')}</strong></div>
          </div>
          <div class="tb-period-ref-editor">
            <div class="tb-settings-inline-grid" style="align-items:end;">
              <div class="field field--span-3">
                <label>Mode</label>
                <select data-br="seg-mode">
                  <option value="inherit" ${override ? '' : 'selected'}>Reprendre le voyage</option>
                  <option value="custom" ${override ? 'selected' : ''}>Personnaliser</option>
                </select>
              </div>
              <div data-br="seg-custom" class="field field--span-9" style="display:${override ? '' : 'none'};">
                <div class="tb-settings-inline-grid" style="align-items:end;">
                  <div class="field field--span-4">
                    <label>Pays</label>
                    <select data-br="seg-country">${_tbBudgetRefCountryOptions(override?.country_code || resolved?.country_code, override?.region_code || resolved?.region_code)}</select>
                  </div>
                  <div class="field field--span-2">
                    <label>Profil</label>
                    <select data-br="seg-profile">
                      <option value="solo" ${((override?.travel_profile || resolved?.travel_profile || 'solo')==='solo')?'selected':''}>Solo</option>
                      <option value="couple" ${((override?.travel_profile || resolved?.travel_profile)==='couple')?'selected':''}>Couple</option>
                      <option value="family" ${((override?.travel_profile || resolved?.travel_profile)==='family')?'selected':''}>Famille</option>
                    </select>
                  </div>
                  <div class="field field--span-2">
                    <label>Style</label>
                    <select data-br="seg-style">
                      <option value="budget" ${((override?.travel_style || resolved?.travel_style)==='budget')?'selected':''}>Budget</option>
                      <option value="standard" ${((override?.travel_style || resolved?.travel_style || 'standard')==='standard')?'selected':''}>Standard</option>
                      <option value="comfort" ${((override?.travel_style || resolved?.travel_style)==='comfort')?'selected':''}>Confort</option>
                    </select>
                  </div>
                  <div class="field field--span-2">
                    <label>Adultes</label>
                    <input data-br="seg-adults" type="number" min="1" step="1" value="${escapeHTML(String(override?.adult_count ?? resolved?.adult_count ?? travel?.adult_count ?? 1))}" />
                  </div>
                  <div class="field field--span-2">
                    <label>Enfants</label>
                    <input data-br="seg-children" type="number" min="0" step="1" value="${escapeHTML(String(override?.child_count ?? resolved?.child_count ?? travel?.child_count ?? 0))}" />
                  </div>
                </div>
              </div>
            </div>
            <div class="tb-settings-actions">
              <button class="btn" data-br-act="seg-reset" style="display:${override ? "" : "none"};">Revenir à l'héritage</button>
              <button class="btn primary" data-br-act="seg-save">Enregistrer la période</button>
            </div>
          </div>
        </div>
      `;
      _tbBudgetRefWireSegmentMode(wrap);
      const btnSave = wrap.querySelector('[data-br-act="seg-save"]');
      const btnReset = wrap.querySelector('[data-br-act="seg-reset"]');
      if(btnSave){
        btnSave.onclick = ()=>safeCall('Budget ref période', async ()=>{
          const mode = String(wrap.querySelector('[data-br="seg-mode"]')?.value || 'inherit');
          const s = _tbGetSB();
          if(mode !== 'custom'){
            const { error } = await s.rpc(TB_CONST.RPCS.budget_reference_compute_for_budget_segment, { p_budget_segment_id: String(seg.id), p_save: false, p_disable_override: true });
            if (error) throw error;
            await window.tbRenderBudgetReferenceUI();
            _tbToastOk('Période repassée en héritage.');
            return;
          }
          const payload = _tbBudgetRefSegmentPayload(wrap, seg);
          if(!payload.p_country_code) throw new Error('Pays de référence requis pour personnaliser cette période.');
          const { error } = await s.rpc(TB_CONST.RPCS.budget_reference_compute_for_budget_segment, payload);
          if (error) throw error;
          await window.tbRenderBudgetReferenceUI();
          _tbToastOk('Budget de référence période enregistré.');
        });
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
  modal.setBody(`
    <div class="row">
      <div class="field"><label>Début</label><input id="tb-vstart" type="date" value="${sugStart}" /></div>
      <div class="field"><label>Fin</label><input id="tb-vend" type="date" value="${sugEnd}" /></div>
    </div>
    <div class="muted" style="margin-top:8px;">Le voyage doit être non chevauchant.</div>
  `);

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
  // very small modal helper (no dependency)
  let el = document.getElementById("tb-modal");
  if(!el){
    el = document.createElement("div");
    el.id = "tb-modal";
    el.style.position="fixed";
    el.style.left="0"; el.style.top="0"; el.style.right="0"; el.style.bottom="0";
    el.style.background="rgba(0,0,0,0.45)";
    el.style.display="none";
    el.style.zIndex="9999";
    el.innerHTML = `
      <div style="max-width:520px;margin:10vh auto;background:#fff;border-radius:12px;padding:14px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
          <h3 id="tb-modal-title" style="margin:0;font-size:18px;">Modal</h3>
          <button class="btn" id="tb-modal-x">X</button>
        </div>
        <div id="tb-modal-body"></div>
        <div id="tb-modal-actions" style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px;"></div>
      </div>`;
    document.body.appendChild(el);
    el.querySelector("#tb-modal-x").onclick = ()=>{ el.style.display="none"; };
    el.addEventListener("click", (e)=>{ if(e.target===el) el.style.display="none"; });
  }
  return {
    open(){ el.style.display="block"; },
    close(){ el.style.display="none"; },
    setTitle(t){ el.querySelector("#tb-modal-title").textContent = t; },
    setBody(html){ el.querySelector("#tb-modal-body").innerHTML = html; },
    setActions(btns){
      const host = el.querySelector("#tb-modal-actions");
      host.innerHTML="";
      (btns||[]).forEach(b=>{
        const bt = document.createElement("button");
        bt.className = b.className || "btn";
        bt.textContent = b.label;
        bt.onclick = async ()=>{
          try{ await b.onClick?.(); }catch(err){ console.error(err); _tbToastOk(err.message||String(err)); }
        };
        host.appendChild(bt);
      });
    }
  };
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
  modal.setBody(`
    <div class="row">
      <div class="field"><label>Début</label><input id="tb-pstart" type="date" value="${vStart}" min="${vStart}" max="${vEnd}" /></div>
      <div class="field"><label>Fin</label><input id="tb-pend" type="date" value="${vEnd}" min="${vStart}" max="${vEnd}" /></div>
    </div>
    <div class="row">
      <div class="field"><label>Devise</label><input id="tb-pcur" value="${(segs[0].base_currency||"EUR").toUpperCase()}" /></div>
      <div class="field"><label>Budget/jour</label><input id="tb-pbud" value="${segs[0].daily_budget_base ?? 0}" /></div>
    </div>
    <div class="muted" style="margin-top:8px;">La nouvelle période doit être incluse dans une période existante (split automatique).</div>
  `);
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
  if(segs.length<=1) throw new Error("Impossible: au moins 1 période requise.");

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

function renderCategoriesSettingsUI() {
  const host = document.getElementById("cat-list");
  if (!host) return;

  const cats = (typeof getCategories === "function") ? getCategories() : (state.categories || []);
  const colors = (typeof getCategoryColors === "function") ? getCategoryColors() : (state.categoryColors || {});

  host.innerHTML = (cats || []).map((c) => {
    const col = colors[c] || "#94a3b8";
    const subRows = _subcategoriesForSettings(c, true);
    const subHtml = subRows.length
      ? subRows.map((row) => {
          const active = row?.isActive !== false && row?.is_active !== false;
          const isSql = !!row?.id;
          const source = String(row?.source || (isSql ? 'sql' : 'default')).toLowerCase();
          const badge = active ? 'Actif' : 'Inactif';
          const badgeBg = active ? 'rgba(34,197,94,.12)' : 'rgba(148,163,184,.15)';
          const badgeCol = active ? '#16a34a' : '#64748b';
          const sourceLabel = isSql ? 'Sauvegardée' : (source === 'fallback' ? 'Détectée' : 'Par défaut');
          const sourceBg = isSql ? 'rgba(37,99,235,.10)' : 'rgba(168,85,247,.10)';
          const sourceCol = isSql ? '#2563eb' : '#7c3aed';
          const subColor = String(row?.color || '').trim();
          return `
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:8px 10px;border:1px solid var(--border);border-radius:12px;background:rgba(255,255,255,.02);">
              <div style="font-weight:600;min-width:160px;">${escapeHTML(row?.name || '')}</div>
              <span style="display:inline-flex;align-items:center;padding:3px 8px;border-radius:999px;background:${badgeBg};color:${badgeCol};font-size:12px;font-weight:700;">${badge}</span>
              <span style="display:inline-flex;align-items:center;padding:3px 8px;border-radius:999px;background:${sourceBg};color:${sourceCol};font-size:12px;font-weight:700;">${sourceLabel}</span>
              <span class="muted" style="font-size:12px;">Position ${escapeHTML(String(Number(row?.sortOrder ?? row?.sort_order ?? 0)))}</span>
              ${subColor ? `<span title="${escapeHTML(subColor)}" style="display:inline-block;width:14px;height:14px;border-radius:4px;background:${escapeHTML(subColor)};border:1px solid rgba(0,0,0,.20);"></span>` : ''}
              <div style="flex:1"></div>
              ${isSql
                ? `<button class="btn" onclick="moveSubcategory('${escapeHTML(String(row?.id || ''))}','up')" ${subRows.length > 1 ? '' : 'disabled'}>↑</button>
                   <button class="btn" onclick="moveSubcategory('${escapeHTML(String(row?.id || ''))}','down')" ${subRows.length > 1 ? '' : 'disabled'}>↓</button>
                   <button class="btn" onclick="editSubcategory('${escapeHTML(String(row?.id || ''))}')">Modifier</button>
                   <button class="btn" onclick="toggleSubcategoryActive('${escapeHTML(String(row?.id || ''))}', ${active ? 'false' : 'true'})">${active ? 'Désactiver' : 'Réactiver'}</button>`
                : `<button class="btn" onclick="importExistingSubcategory('${escapeHTML(c)}','${escapeHTML(String(row?.name || ''))}')">Enregistrer</button>`}
            </div>
          `;
        }).join('')
      : `<div class="muted" style="padding:8px 0;">Aucune sous-catégorie SQL pour cette catégorie.</div>`;

    return `
      <div class="card" style="padding:12px; margin:8px 0; display:flex; flex-direction:column; gap:10px;">
        <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
          <div style="min-width:180px; font-weight:700;">${escapeHTML(c)}</div>

          <span title="${escapeHTML(col)}" style="display:inline-block;width:18px;height:18px;border-radius:5px;background:${escapeHTML(col)};border:1px solid rgba(0,0,0,.20);"></span>
          <div class="muted" style="min-width:84px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; font-size:12px;">
            ${escapeHTML(col)}
          </div>

          <input type="color"
                 value="${escapeHTML(col)}"
                 style="width:44px;height:30px;padding:0;border:none;background:transparent;cursor:pointer;"
                 onchange="setCategoryColor('${escapeHTML(c)}', this.value)" />

          <button class="btn" onclick="addSubcategory('${escapeHTML(c)}')">+ Sous-catégorie</button>
          <button class="btn" onclick="deleteCategory('${escapeHTML(c)}')">Supprimer</button>
        </div>
        <div style="display:grid;gap:8px;">
          ${subHtml}
        </div>
      </div>
    `;
  }).join("");

  if (!host.innerHTML) host.innerHTML = `<div class="muted">Aucune catégorie. Ajoute-en une ci-dessus.</div>`;
}

function addCategory() {
  safeCall("Add category", async () => {
    const nameEl = document.getElementById("cat-name");
    const colorEl = document.getElementById("cat-color");
    const name = String(nameEl?.value || "").trim();
    const color = String(colorEl?.value || "#94a3b8");
    if (!name) throw new Error("Nom de catégorie vide.");

    const existing = (state.categories || []).find(c => String(c).toLowerCase() === name.toLowerCase()) || null;
    if (existing) {
      const { error: upErr } = await sb
        .from(TB_CONST.TABLES.categories)
        .update({ color, updated_at: new Date().toISOString() })
        .eq("user_id", sbUser.id)
        .eq("name", existing);
      if (upErr) throw upErr;
    } else {
      const maxSort = (state.categories || []).length;
      const { error: insErr } = await sb
        .from(TB_CONST.TABLES.categories)
        .insert([{ user_id: sbUser.id, name, color, sort_order: maxSort, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }]);
      if (insErr) throw insErr;
    }

    if (nameEl) nameEl.value = "";
    await refreshFromServer();
    renderSettings();
  });
}

function deleteCategory(name) {
  safeCall("Delete category", async () => {
    const n = String(name || "").trim();
    if (!n) return;
    if (!confirm(`Supprimer la catégorie "${n}" ?`)) return;
    const existing = (state.categories || []).find(c => String(c).toLowerCase() === n.toLowerCase()) || n;
    const { error: delErr } = await sb
      .from(TB_CONST.TABLES.categories)
      .delete()
      .eq("user_id", sbUser.id)
      .eq("name", existing);
    if (delErr) throw delErr;

    await refreshFromServer();
    renderSettings();
  });
}

function setCategoryColor(name, color) {
  safeCall("Set category color", async () => {
    const n = String(name || "").trim();
    if (!n) return;
    const existing = (state.categories || []).find(c => String(c).toLowerCase() === n.toLowerCase()) || n;
    const { error: upErr } = await sb
      .from(TB_CONST.TABLES.categories)
      .update({ color: String(color || "#94a3b8"), updated_at: new Date().toISOString() })
      .eq("user_id", sbUser.id)
      .eq("name", existing);
    if (upErr) throw upErr;

    await refreshFromServer();
    renderSettings();
  });
}

async function importExistingSubcategory(categoryName, subcategoryName) {
  return safeCall("Import subcategory", async () => {
    const category = String(categoryName || '').trim();
    const name = String(subcategoryName || '').trim();
    if (!category || !name) throw new Error('Sous-catégorie invalide.');
    const existingRows = _subcategoriesForSettings(category, true);
    const duplicateSql = existingRows.find((row) => row?.id && String(row?.name || '').trim().toLowerCase() === name.toLowerCase());
    if (duplicateSql) throw new Error('Cette sous-catégorie existe déjà en SQL pour cette catégorie.');
    const sortOrder = existingRows.reduce((max, row) => Math.max(max, Number(row?.sortOrder ?? row?.sort_order ?? 0)), -1) + 1;
    const payload = {
      user_id: sbUser.id,
      category_id: _categoryIdByName(category),
      category_name: category,
      name,
      sort_order: sortOrder,
      is_active: true,
      updated_at: new Date().toISOString(),
    };
    const { error } = await sb.from(TB_CONST.TABLES.category_subcategories).insert([payload]);
    if (error) throw error;
    await refreshFromServer();
    renderSettings();
  });
}

async function addSubcategory(categoryName) {
  return safeCall("Add subcategory", async () => {
    const category = String(categoryName || '').trim();
    if (!category) throw new Error('Catégorie invalide.');
    const rawName = prompt(`Nouvelle sous-catégorie pour "${category}"`, '');
    if (rawName === null) return;
    const name = String(rawName || '').trim();
    if (!name) throw new Error('Nom de sous-catégorie vide.');
    const existingRows = _subcategoriesForSettings(category, true);
    const duplicate = existingRows.find((row) => String(row?.name || '').trim().toLowerCase() === name.toLowerCase());
    if (duplicate) throw new Error('Cette sous-catégorie existe déjà pour cette catégorie.');
    const sortOrder = existingRows.reduce((max, row) => Math.max(max, Number(row?.sortOrder ?? row?.sort_order ?? 0)), -1) + 1;
    const payload = {
      user_id: sbUser.id,
      category_id: _categoryIdByName(category),
      category_name: category,
      name,
      sort_order: sortOrder,
      is_active: true,
      updated_at: new Date().toISOString(),
    };
    const { error } = await sb.from(TB_CONST.TABLES.category_subcategories).insert([payload]);
    if (error) throw error;
    await refreshFromServer();
    renderSettings();
  });
}

async function editSubcategory(id) {
  return safeCall("Edit subcategory", async () => {
    const row = (Array.isArray(state?.categorySubcategories) ? state.categorySubcategories : []).find((x) => String(x?.id) === String(id));
    if (!row) throw new Error('Sous-catégorie introuvable.');
    const category = String(row?.categoryName || row?.category_name || '').trim();
    const currentName = String(row?.name || '').trim();
    const rawName = prompt(`Renommer la sous-catégorie de "${category}"`, currentName);
    if (rawName === null) return;
    const name = String(rawName || '').trim();
    if (!name) throw new Error('Nom de sous-catégorie vide.');
    const colorRaw = prompt('Couleur hexadécimale optionnelle (ex: #94a3b8). Laisse vide pour aucune couleur.', String(row?.color || ''));
    if (colorRaw === null) return;
    const color = String(colorRaw || '').trim();
    if (color && !/^#[0-9a-fA-F]{6}$/.test(color)) throw new Error('Couleur invalide.');
    const duplicate = _subcategoriesForSettings(category, true).find((x) => String(x?.id) !== String(id) && String(x?.name || '').trim().toLowerCase() === name.toLowerCase());
    if (duplicate) throw new Error('Une autre sous-catégorie porte déjà ce nom dans cette catégorie.');
    const payload = {
      name,
      color: color || null,
      category_id: row?.categoryId || row?.category_id || _categoryIdByName(category),
      category_name: category,
      updated_at: new Date().toISOString(),
    };
    const { error } = await sb.from(TB_CONST.TABLES.category_subcategories).update(payload).eq('id', id).eq('user_id', sbUser.id);
    if (error) throw error;
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
  if (sqlRows.length <= 1) return;

  const currentIndex = sqlRows.findIndex((row) => String(row?.id) === String(id));
  if (currentIndex < 0) return;

  const swapIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
  if (swapIndex < 0 || swapIndex >= sqlRows.length) return;

  const ordered = sqlRows.slice();
  const tmp = ordered[currentIndex];
  ordered[currentIndex] = ordered[swapIndex];
  ordered[swapIndex] = tmp;

  const updates = ordered.map((row, idx) => ({
    id: row.id,
    sort_order: (idx + 1) * 10,
  }));

  const byId = new Map(updates.map((x) => [String(x.id), x.sort_order]));

  const previousSnapshot = (Array.isArray(state?.categorySubcategories) ? state.categorySubcategories : []).map((row) => ({
    ...row,
    sortOrder: row?.sortOrder,
    sort_order: row?.sort_order,
  }));

  state.categorySubcategories = (Array.isArray(state?.categorySubcategories) ? state.categorySubcategories : []).map((row) => {
    const nextSort = byId.get(String(row?.id || ''));
    if (nextSort === undefined) return row;
    return {
      ...row,
      sortOrder: nextSort,
      sort_order: nextSort,
    };
  });

  renderSettings();

  try {
    const nowIso = new Date().toISOString();
    for (const row of updates) {
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
    const { error } = await sb
      .from(TB_CONST.TABLES.category_subcategories)
      .update({ is_active: !!nextActive, updated_at: new Date().toISOString() })
      .eq('id', id)
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

/* =========================
   Manual FX UI (fallback rates EUR->XXX)
   ========================= */

function renderManualFxBox() {
  const host = document.getElementById("manual-fx-box");
  if (!host) return;

  const rates = (typeof tbFxGetManualRates === "function") ? tbFxGetManualRates() : {};
  const entries = Object.entries(rates || {}).sort((a, b) => a[0].localeCompare(b[0]));

  host.innerHTML = `
    <div class="card" style="padding:12px;">
      <h3 style="margin:0 0 8px 0;">Taux perso</h3>
      <div class="muted" style="margin-bottom:10px;">
        Utilisé seulement si le taux automatique est indisponible.
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;margin-bottom:10px;">
        <div style="min-width:120px;">
          <div class="label">Devise</div>
          <input id="tbManualFxCur" class="input" placeholder="ex: IDR" maxlength="3" />
        </div>
        <div style="min-width:180px;">
          <div class="label">Taux</div>
          <input id="tbManualFxRate" class="input" placeholder="ex: 17000" inputmode="decimal" />
        </div>
        <button class="btn" onclick="tbManualFxAdd()">Ajouter</button>
      </div>

      <div id="tbManualFxList">
        ${
          entries.length
            ? entries.map(([c, r]) => {
            const rate = (r && typeof r === 'object') ? r.rate : r;
            const asOf = (r && typeof r === 'object') ? r.asOf : ((typeof tbFxManualAsof === "function") ? tbFxManualAsof(c) : null);
            return `
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;padding:8px 0;border-top:1px solid var(--border);">
            <div><b>${escapeHTML(c)}</b> : 1 EUR = ${escapeHTML(String(rate))} ${escapeHTML(c)}
              ${(() => { 
                try { 
                  const d = asOf; 
                  return d ? `<span class="muted" style="font-size:12px;">(${escapeHTML(String(d))})</span>` : ""; 
                } catch(_) { return ""; } 
              })()}
            </div>
            <button class="btn" onclick="tbManualFxDel('${escapeHTML(c)}')">Supprimer</button>
          </div>
        `;
          }).join("")
            : `<div class="muted">Aucun taux manuel.</div>`
        }
      </div>
    </div>
  `;

  // Prefill rate from Auto FX when user types a currency
  try {
    const curEl = document.getElementById("tbManualFxCur");
    const rateEl = document.getElementById("tbManualFxRate");
    if (curEl && rateEl) {
      curEl.addEventListener("input", () => {
        const c = String(curEl.value || "").trim().toUpperCase();
        if (!c || rateEl.value) return;
        try {
          const m = (typeof window.fxGetEurRates === "function") ? window.fxGetEurRates() : {};
          const live = (c === "EUR") ? 1 : (m && m[c]);
          if (live) rateEl.value = String(live);
        } catch (_) {}
      });
    }
  } catch (_) {}
}
function tbManualFxAdd() {
  try {
    const curEl = document.getElementById("tbManualFxCur");
    const rateEl = document.getElementById("tbManualFxRate");
    const c = String(curEl?.value || "").trim().toUpperCase();
    const r = Number(String(rateEl?.value || "").replace(",", "."));
    if (typeof tbFxSetManualRate !== "function") throw new Error("FX manual not available");
    tbFxSetManualRate(c, r);
    if (typeof renderSettings === "function") renderSettings(); else renderManualFxBox();
  } catch (e) {
    alert(e?.message || e);
  }
}

function tbManualFxDel(c) {
  try {
    if (typeof tbFxDeleteManualRate !== "function") throw new Error("FX manual not available");
    tbFxDeleteManualRate(c);
    if (typeof renderSettings === "function") renderSettings(); else renderManualFxBox();
  } catch (e) {
    alert(e?.message || e);
  }
}