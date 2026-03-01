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
  out.sortOrder = Number.isFinite(Number(sortRaw)) ? Number(sortRaw) : 0;
  out.sort_order = out.sortOrder;
  return out;
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

/* ---------- data loaders ---------- */

async function loadPeriodsListIntoUI(){
  const sel = document.getElementById("s-period");
  if(!sel) return;

  sel.innerHTML = "";
  const periods = (state.periods || []).slice().sort((a,b)=>String(a.start).localeCompare(String(b.start)));
  periods.forEach(p=>{
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = (p.name && String(p.name).trim())
      ? String(p.name).trim()
      : `Voyage ${_tbISO(p.start)} → ${_tbISO(p.end)}`;
    sel.appendChild(opt);
  });

  const active = state.period && state.period.id ? state.period.id : (periods[0] ? periods[0].id : "");
  if(active){
    sel.value = active;
    if(!state.period || state.period.id!==active){
      const p = periods.find(x=>x.id===active);
      if(p) state.period = p;
    }
  }

  sel.onchange = async ()=>{
    const id = sel.value;
    const p = (state.periods||[]).find(x=>x.id===id);
    if(p) state.period = p;
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

function renderSettings(){
  const view = document.getElementById("view-settings");
  if(!view) return;

  // labels
  const h2 = view.querySelector('h2');
  if(h2) h2.textContent = "Voyage";

  const p = state.period;
  const segs = (state.budgetSegments || []).map(_tbNormSeg).slice().sort((a,b)=>String(a.start).localeCompare(String(b.start)));

  // voyage dates reflect real bounds from segments when available
  const startISO = segs.length ? _tbISO(segs[0].start) : _tbISO(p && p.start);
  const endISO   = segs.length ? _tbISO(segs[segs.length-1].end) : _tbISO(p && p.end);

  const inStart = document.getElementById("s-start");
  const inEnd   = document.getElementById("s-end");
  if(inStart){ inStart.type="date"; inStart.value = startISO || ""; }
  if(inEnd){ inEnd.type="date"; inEnd.value = endISO || ""; }

  // ensure periods list
  loadPeriodsListIntoUI();


  // segments area
  const host = document.getElementById("seg-list");
  if(host){
    host.innerHTML = "";

    // --- FX status (ECB) + Manual fallback panel (audit) ---


    const _fxHelp = [
      "Auto (ECB) : taux officiel BCE, date = refDay (jour de publication, week-end ok).",
      "Manuel fallback : utilisé uniquement si l'ECB ne fournit pas la devise.",
      "Manquant : taux requis non disponible → saisie requise."
    ].join("\n");


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
          <b>FX (ECB)</b>
          <span class="muted">• asOf <b>${ecbAsof || "—"}</b> • <b>${ecbCount}</b> devises • refDay <b>${refDay || "—"}</b>
            <span title="${escapeHTML(_fxHelp)}" style="cursor:help; user-select:none; padding-left:6px;">(?)</span>
          </span>
        </div>
      </div>
    `;
    host.appendChild(fxTop);

    // Manual fallback audit panel
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
          <b>Manuels fallback</b>
          <span class="muted">• audit/edit • utilisés seulement si la devise est absente de l'ECB</span>
        </div>
        <button class="btn" data-act="mf-add" title="Ajouter/mettre à jour un taux manuel fallback">Ajouter</button>
      </div>
      <div style="margin-top:8px; overflow:auto;">
        ${manualList.length ? `
          <table class="table" style="width:100%; min-width:520px;">
            <thead><tr>
              <th>Devise</th><th>Taux EUR→Devise</th><th>Date</th><th style="text-align:right;">Actions</th>
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
        ` : `<div class="muted">Aucun taux manuel fallback enregistré.</div>`}
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
      window.tbFxPromptManualRate(c, "Ajout/MAJ manuel fallback");
      renderSettings();
    });

    manualPanel.querySelectorAll('[data-act="mf-edit"]').forEach(btn=>{
      btn.onclick = ()=>safeCall("Modifier taux manuel", ()=>{
        const c = btn.getAttribute('data-cur');
        if (!c) return;
        if (typeof window.tbFxPromptManualRate !== "function") throw new Error("tbFxPromptManualRate() manquant");
        window.tbFxPromptManualRate(c, "MAJ manuel fallback");
        renderSettings();
      });
    });

    manualPanel.querySelectorAll('[data-act="mf-del"]').forEach(btn=>{
      btn.onclick = ()=>safeCall("Supprimer taux manuel", ()=>{
        const c = btn.getAttribute('data-cur');
        if (!c) return;
        const ok = confirm(`Supprimer le taux manuel fallback EUR→${c} ?`);
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
        wrap.style.marginBottom = "10px";
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
        const srcLabel = autoAvail ? "ECB Auto" : (manualRate ? "Manuel fallback" : "Manquant");
        const srcMeta = autoAvail
          ? (autoAsof2?` • asOf: ${autoAsof2}`: "")
          : (manualRate ? (` • asOf: ${manualAsof || "—"}${stale ? " (à confirmer)" : ""}`) : "");
        const fxLineHelp = `Auto (ECB) : taux officiel BCE. Date de référence (refDay) = ${refDay2}.\n`+
                           `Manuel fallback : utilisé uniquement si l'ECB ne fournit pas la devise.\n`+
                           `"à confirmer" : le manuel est plus ancien que refDay (asOf < refDay).`;

        wrap.innerHTML = `
          <div class="row" style="align-items:flex-end;">
            <div class="field">
              <label>Début</label>
              <input type="date" data-k="start_date" value="${_tbISO(seg.start)||""}" />
            </div>
            <div class="field">
              <label>Fin</label>
              <input type="date" data-k="end_date" value="${_tbISO(seg.end)||""}" />
            </div>
            <div class="field">
              <label>Devise</label>
              <input data-k="base_currency" value="${(seg.baseCurrency||"").toUpperCase()}" />
            </div>
            <div class="field">
              <label>Budget/jour</label>
              <input data-k="daily_budget_base" value="${seg.dailyBudgetBase ?? ""}" />
            </div>
            <div class="field" style="min-width:180px;">
              <label>Taux EUR→Devise</label>
              <input value="${rateDisplay}" placeholder="${autoAvail ? "auto" : (manualRate ? "manuel fallback" : "manquant")}" readonly />
            </div>
            ${(!autoAvail) ? `<button class="btn" data-act="fx" title="Définir/mettre à jour un taux manuel fallback pour cette devise">${manualRate ? "Mettre à jour taux" : "Saisir taux"}</button>` : ""}
            <div style="flex:1"></div>
            <button class="btn primary" data-act="save">Enregistrer</button>
            <button class="btn danger" data-act="del">Supprimer</button>
          </div>
          <div class="muted" style="margin-top:6px;">
            FX: <b>${srcLabel}</b>
            <span title="${escapeHTML(fxLineHelp)}" style="cursor:help; user-select:none; padding-left:6px;">(?)</span>
            • Taux: <b>${(rateDisplay || "") || "—"}</b>
            • Source: <b>${srcLabel}</b>${srcMeta}
            • refDay: <b>${escapeHTML(String(refDay2||"—").slice(0,10))}</b>
            ${seg.fx_last_updated_at ? ` • maj: ${String(seg.fx_last_updated_at).slice(0,10)}` : ""}
          </div>
        `;

        // handlers
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

  // Categories (Settings)
  try { renderCategoriesSettingsUI(); } catch (_) {}
}

/* ---------- voyage save / create / delete ---------- */

async function _saveSettingsImpl(){
  const s = _tbGetSB();
  if(!s) throw new Error("Supabase non prêt.");
  const pid = state.period && state.period.id;
  if(!pid) throw new Error("Voyage non sélectionné.");

  const start = document.getElementById("s-start")?.value;
  const end   = document.getElementById("s-end")?.value;
  if(!start || !end) throw new Error("Dates invalides.");
  if(start > end) throw new Error("Date de début > date de fin.");

  // Patch period dates only
  const { error } = await s.from(TB_CONST.TABLES.periods).update({ start_date:start, end_date:end }).eq("id", pid);
  if(error) throw error;

  // Ensure first/last segments align to voyage bounds (no holes overall)
  await _syncVoyageBoundsToSegments(pid, start, end);

  // reload
  if (typeof window.refreshFromServer === "function") {
    await window.refreshFromServer();
  } else if (typeof refreshFromServer === "function") {
    await refreshFromServer();
  }
  _tbToastOk("Dates du voyage enregistrées.");
}

async function createVoyagePrompt(){
  const s = _tbGetSB();
  if(!s) throw new Error("Supabase non prêt.");
  const uid = await _tbAuthUid();
  if(!uid) throw new Error("Not authenticated.");

  // Suggest non-overlapping dates after last voyage
  const periods = (state.periods || []).slice().sort((a,b)=>String(a.end).localeCompare(String(b.end)));
  const lastEnd = periods.length ? _tbISO(periods[periods.length-1].end_date) : _tbISO(new Date());
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
      // local overlap check (client-side) to avoid periods_no_overlap
      const existing = (state.periods||[]).filter(p=>p.user_id===uid);
      for(const p of existing){
        const ps=_tbISO(p.start), pe=_tbISO(p.end);
        if(!ps||!pe) continue;
        if(!(end < ps || start > pe)) throw new Error("Chevauchement avec un voyage existant.");
      }


      // insert period (defaults for base_currency/eur_base_rate/daily_budget_base ok)
      const ins = { user_id: uid, start_date:start, end_date:end };
      const { data, error } = await s.from(TB_CONST.TABLES.periods).insert(ins).select("id").single();
      if(error) throw error;
      const newPid = data.id;

      // create one default segment covering whole voyage
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

      modal.close();
      if (typeof window.refreshFromServer === "function") {
    await window.refreshFromServer();
  } else if (typeof refreshFromServer === "function") {
    await refreshFromServer();
  }
      // activate new voyage
      const p = (state.periods||[]).find(x=>x.id===newPid);
      if(p) state.period = p;
      await refreshSegmentsForActivePeriod();
      renderSettings();
      _tbToastOk("Voyage créé.");
    }}
  ]);
  modal.open();
}

async function deleteActiveVoyage(){
  const s = _tbGetSB();
  if(!s) throw new Error("Supabase non prêt.");
  const pid = state.period && state.period.id;
  if(!pid) throw new Error("Voyage non sélectionné.");

  const label = `Voyage ${_tbISO(state.period.start)} → ${_tbISO(state.period.end)}`;
  if(!confirm(`Supprimer ${label} ?\n\nRefusé si des données y sont liées.`)) return;

  const { error } = await s.from(TB_CONST.TABLES.periods).delete().eq("id", pid);
  if(error) throw error;
  if (typeof window.refreshFromServer === "function") {
    await window.refreshFromServer();
  } else if (typeof refreshFromServer === "function") {
    await refreshFromServer();
  }
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
  const pid = state.period && state.period.id;
  if(!pid) throw new Error("Voyage non sélectionné.");

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
  const pid = state.period && state.period.id;
  if(!pid) throw new Error("Voyage non sélectionné.");

  const segs = (state.budgetSegments||[]).slice().sort((a,b)=>String(a.start).localeCompare(String(b.start)));
  const idx = segs.findIndex(x=>x.id===segId);
  if(idx<0) throw new Error("Période introuvable.");

  const seg = segs[idx];
  const getVal = (k)=>wrapEl.querySelector(`[data-k="${k}"]`)?.value;

  const newStart = getVal("start_date");
  const newEnd = getVal("end_date");
  const newCur = (getVal("base_currency")||"").trim().toUpperCase();
  const newBud = _tbParseNum(getVal("daily_budget_base"));

  if(!newStart||!newEnd||newStart>newEnd) throw new Error("Dates invalides.");
    if(!newCur) throw new Error("Devise requise.");
  if(!Number.isFinite(newBud) || newBud < 0) throw new Error("Budget/jour invalide.");

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
  const { error: e2 } = await s.from(TB_CONST.TABLES.budget_segments).update(patch).eq("id", segId);
  if(e2) throw e2;

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
  const pid = state.period && state.period.id;
  if(!pid) throw new Error("Voyage non sélectionné.");

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
window.createVoyagePrompt = ()=>safeCall("Ajouter voyage", createVoyagePrompt);
window.deleteActiveVoyage = ()=>safeCall("Supprimer voyage", deleteActiveVoyage);

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

function renderCategoriesSettingsUI() {
  const host = document.getElementById("cat-list");
  if (!host) return;

  const cats = (typeof getCategories === "function") ? getCategories() : (state.categories || []);
  const colors = (typeof getCategoryColors === "function") ? getCategoryColors() : (state.categoryColors || {});

  host.innerHTML = (cats || []).map((c) => {
    const col = colors[c] || "#94a3b8";
    return `
      <div class="card" style="padding:10px; margin:8px 0; display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
        <div style="min-width:180px; font-weight:700;">${escapeHTML(c)}</div>

        <span title="${escapeHTML(col)}" style="display:inline-block;width:18px;height:18px;border-radius:5px;background:${escapeHTML(col)};border:1px solid rgba(0,0,0,.20);"></span>
        <div class="muted" style="min-width:84px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; font-size:12px;">
          ${escapeHTML(col)}
        </div>

        <input type="color"
               value="${escapeHTML(col)}"
               style="width:44px;height:30px;padding:0;border:none;background:transparent;cursor:pointer;"
               onchange="setCategoryColor('${escapeHTML(c)}', this.value)" />

        <button class="btn" onclick="deleteCategory('${escapeHTML(c)}')">Supprimer</button>
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

window.addCategory = addCategory;
window.deleteCategory = deleteCategory;
window.setCategoryColor = setCategoryColor;

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
      <h3 style="margin:0 0 8px 0;">Taux manuels (fallback)</h3>
      <div class="muted" style="margin-bottom:10px;">
        Utilisés uniquement si la source Auto FX ne fournit pas EUR→DEV.
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;margin-bottom:10px;">
        <div style="min-width:120px;">
          <div class="label">Devise</div>
          <input id="tbManualFxCur" class="input" placeholder="ex: IDR" maxlength="3" />
        </div>
        <div style="min-width:180px;">
          <div class="label">Taux EUR → Devise</div>
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