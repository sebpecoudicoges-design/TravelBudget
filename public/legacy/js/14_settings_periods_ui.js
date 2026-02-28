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
  const periods = (state.periods || []).slice().sort((a,b)=>String(a.start_date).localeCompare(String(b.start_date)));
  periods.forEach(p=>{
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = (p.name && String(p.name).trim())
      ? String(p.name).trim()
      : `Voyage ${_tbISO(p.start_date)} → ${_tbISO(p.end_date)}`;
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
    .from("budget_segments")
    .select("*")
    .eq("period_id", pid)
    .order("start_date", { ascending: true })
    .order("sort_order", { ascending: true });

  if(error) throw error;
  state.budgetSegments = data || [];
}

/* ---------- render ---------- */

function renderSettings(){
  const view = document.getElementById("view-settings");
  if(!view) return;

  // labels
  const h2 = view.querySelector('h2');
  if(h2) h2.textContent = "Voyage";

  const p = state.period;
  const segs = (state.budgetSegments || []).slice().sort((a,b)=>String(a.start_date).localeCompare(String(b.start_date)));

  // voyage dates reflect real bounds from segments when available
  const startISO = segs.length ? _tbISO(segs[0].start_date) : _tbISO(p && p.start_date);
  const endISO   = segs.length ? _tbISO(segs[segs.length-1].end_date) : _tbISO(p && p.end_date);

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
    if(!segs.length){
      host.innerHTML = '<div class="muted">Aucune période (segment) pour ce voyage.</div>';
    }else{
      segs.forEach((seg, idx)=>{
        const wrap = document.createElement("div");
        wrap.className = "card";
        wrap.style.marginBottom = "10px";
        wrap.innerHTML = `
          <div class="row" style="align-items:flex-end;">
            <div class="field">
              <label>Début</label>
              <input type="date" data-k="start_date" value="${_tbISO(seg.start_date)||""}" />
            </div>
            <div class="field">
              <label>Fin</label>
              <input type="date" data-k="end_date" value="${_tbISO(seg.end_date)||""}" />
            </div>
            <div class="field">
              <label>Devise</label>
              <input data-k="base_currency" value="${(seg.base_currency||"").toUpperCase()}" />
            </div>
            <div class="field">
              <label>Budget/jour</label>
              <input data-k="daily_budget_base" value="${seg.daily_budget_base ?? ""}" />
            </div>
            <div class="field" style="min-width:160px;">
              <label>Taux EUR→Devise</label>
              <input data-k="eur_base_rate_fixed" value="${seg.eur_base_rate_fixed ?? ""}" placeholder="auto si dispo" />
            </div>
            <div style="flex:1"></div>
            <button class="btn primary" data-act="save">Enregistrer</button>
            <button class="btn danger" data-act="del">Supprimer</button>
          </div>
          <div class="muted" style="margin-top:6px;">
            FX: <b>${seg.fx_mode === "fixed" ? "Manuel" : "Auto"}</b>
            ${seg.fx_last_updated_at ? ` • maj: ${String(seg.fx_last_updated_at).slice(0,10)}` : ""}
          </div>
        `;
        // handlers
        wrap.querySelector('[data-act="save"]').onclick = ()=>safeCall(()=>saveBudgetSegment(seg.id, wrap));
        wrap.querySelector('[data-act="del"]').onclick = ()=>safeCall(()=>deleteBudgetSegment(seg.id));
        host.appendChild(wrap);
      });
    }
  }
}

/* ---------- voyage save / create / delete ---------- */

async function saveSettings(){
  const s = _tbGetSB();
  if(!s) throw new Error("Supabase non prêt.");
  const pid = state.period && state.period.id;
  if(!pid) throw new Error("Voyage non sélectionné.");

  const start = document.getElementById("s-start")?.value;
  const end   = document.getElementById("s-end")?.value;
  if(!start || !end) throw new Error("Dates invalides.");
  if(start > end) throw new Error("Date de début > date de fin.");

  // Patch period dates only
  const { error } = await s.from("periods").update({ start_date:start, end_date:end }).eq("id", pid);
  if(error) throw error;

  // Ensure first/last segments align to voyage bounds (no holes overall)
  await _syncVoyageBoundsToSegments(pid, start, end);

  // reload
  await bootRefreshFromServer?.();
  _tbToastOk("Dates du voyage enregistrées.");
}

async function createVoyagePrompt(){
  const s = _tbGetSB();
  if(!s) throw new Error("Supabase non prêt.");
  const uid = await _tbAuthUid();
  if(!uid) throw new Error("Not authenticated.");

  // Suggest non-overlapping dates after last voyage
  const periods = (state.periods || []).slice().sort((a,b)=>String(a.end_date).localeCompare(String(b.end_date)));
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
      const existing = (state.periods||[]).filter(p=>p.user_id===uid || true);
      for(const p of existing){
        const ps=_tbISO(p.start_date), pe=_tbISO(p.end_date);
        if(!ps||!pe) continue;
        if(!(end < ps || start > pe)) throw new Error("Chevauchement avec un voyage existant.");
      }


      // insert period (defaults for base_currency/eur_base_rate/daily_budget_base ok)
      const ins = { user_id: uid, start_date:start, end_date:end };
      const { data, error } = await s.from("periods").insert(ins).select("id").single();
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
      const { error: e2 } = await s.from("budget_segments").insert(segIns);
      if(e2) throw e2;

      modal.close();
      await bootRefreshFromServer?.();
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

  const label = `Voyage ${_tbISO(state.period.start_date)} → ${_tbISO(state.period.end_date)}`;
  if(!confirm(`Supprimer ${label} ?\n\nRefusé si des données y sont liées.`)) return;

  const { error } = await s.from("periods").delete().eq("id", pid);
  if(error) throw error;
  await bootRefreshFromServer?.();
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

async function createPeriodPrompt(){
  const s = _tbGetSB();
  if(!s) throw new Error("Supabase non prêt.");
  const uid = await _tbAuthUid();
  if(!uid) throw new Error("Not authenticated.");
  const pid = state.period && state.period.id;
  if(!pid) throw new Error("Voyage non sélectionné.");

  const segs = (state.budgetSegments||[]).slice().sort((a,b)=>String(a.start_date).localeCompare(String(b.start_date)));
  if(!segs.length) throw new Error("Aucune période existante à découper.");

  const vStart = _tbISO(segs[0].start_date);
  const vEnd   = _tbISO(segs[segs.length-1].end_date);

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
  const segs = (state.budgetSegments||[]).slice().sort((a,b)=>String(a.start_date).localeCompare(String(b.start_date)));

  const host = segs.find(x=>_tbISO(x.start_date) <= start && _tbISO(x.end_date) >= end);
  if(!host) throw new Error("Aucune période existante ne couvre cet intervalle.");

  const hostStart = _tbISO(host.start_date);
  const hostEnd   = _tbISO(host.end_date);

  // compute before/after
  const beforeEnd = _tbAddDays(start, -1);
  const afterStart = _tbAddDays(end, 1);

  // shrink host to "before" if needed
  if(hostStart <= beforeEnd){
    const { error } = await s.from("budget_segments")
      .update({ end_date: beforeEnd })
      .eq("id", host.id);
    if(error) throw error;
  }else{
    // host has no room before; we will delete host and recreate after if needed
    const { error } = await s.from("budget_segments").delete().eq("id", host.id);
    if(error) throw error;
  }

  // insert new segment
  const newSeg = {
    user_id: uid,
    period_id: pid,
    start_date: start,
    end_date: end,
    base_currency: cur,
    daily_budget_base: bud,
    fx_mode: "live_ecb",
    sort_order: 0
  };
  const { error: e2 } = await s.from("budget_segments").insert(newSeg);
  if(e2) throw e2;

  // insert after segment if needed
  if(afterStart <= hostEnd){
    const afterSeg = {
      user_id: uid,
      period_id: pid,
      start_date: afterStart,
      end_date: hostEnd,
      base_currency: host.base_currency || "EUR",
      daily_budget_base: host.daily_budget_base ?? 0,
      fx_mode: host.fx_mode || "live_ecb",
      eur_base_rate_fixed: host.eur_base_rate_fixed ?? null,
      sort_order: 0
    };
    const { error: e3 } = await s.from("budget_segments").insert(afterSeg);
    if(e3) throw e3;
  }

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

  const segs = (state.budgetSegments||[]).slice().sort((a,b)=>String(a.start_date).localeCompare(String(b.start_date)));
  const idx = segs.findIndex(x=>x.id===segId);
  if(idx<0) throw new Error("Période introuvable.");

  const seg = segs[idx];
  const getVal = (k)=>wrapEl.querySelector(`[data-k="${k}"]`)?.value;

  const newStart = getVal("start_date");
  const newEnd = getVal("end_date");
  const newCur = (getVal("base_currency")||"").trim().toUpperCase();
  const newBud = _tbParseNum(getVal("daily_budget_base"));
  const newRate = _tbParseNum(getVal("eur_base_rate_fixed"));

  if(!newStart||!newEnd||newStart>newEnd) throw new Error("Dates invalides.");
  if(!newCur) throw new Error("Devise requise.");
  if(!Number.isFinite(newBud) || newBud < 0) throw new Error("Budget/jour invalide.");

  // neighbors
  const prev = idx>0 ? segs[idx-1] : null;
  const next = idx<segs.length-1 ? segs[idx+1] : null;

  // phase A: shrink neighbors if we expand into them
  if(prev){
    const prevEnd = _tbISO(prev.end_date);
    if(prevEnd >= newStart){
      const newPrevEnd = _tbAddDays(newStart, -1);
      const { error } = await s.from("budget_segments").update({ end_date: newPrevEnd }).eq("id", prev.id);
      if(error) throw error;
    }
  }
  if(next){
    const nextStart = _tbISO(next.start_date);
    if(nextStart <= newEnd){
      const newNextStart = _tbAddDays(newEnd, 1);
      const { error } = await s.from("budget_segments").update({ start_date: newNextStart }).eq("id", next.id);
      if(error) throw error;
    }
  }

  // phase B: update current
  const patch = {
    start_date: newStart,
    end_date: newEnd,
    base_currency: newCur,
    daily_budget_base: newBud,
    fx_mode: (Number.isFinite(newRate) && newRate>0) ? "fixed" : "live_ecb",
    eur_base_rate_fixed: (Number.isFinite(newRate) && newRate>0) ? newRate : null,
    user_id: uid,
    period_id: pid
  };
  const { error: e2 } = await s.from("budget_segments").update(patch).eq("id", segId);
  if(e2) throw e2;

  // phase C: fill gaps created by shrinking current (only immediate neighbors)
  if(prev){
    const prevEndNew = _tbISO((await _tbFetchSeg(prev.id)).end_date);
    const desiredPrevEnd = _tbAddDays(newStart, -1);
    if(prevEndNew < desiredPrevEnd){
      const { error } = await s.from("budget_segments").update({ end_date: desiredPrevEnd }).eq("id", prev.id);
      if(error) throw error;
    }
  }
  if(next){
    const nextStartNew = _tbISO((await _tbFetchSeg(next.id)).start_date);
    const desiredNextStart = _tbAddDays(newEnd, 1);
    if(nextStartNew > desiredNextStart){
      const { error } = await s.from("budget_segments").update({ start_date: desiredNextStart }).eq("id", next.id);
      if(error) throw error;
    }
  }

  await _tbRecalcSegmentSortOrder(pid);
  await _syncSegmentsBoundsToPeriod(pid);
  await refreshSegmentsForActivePeriod();
  renderSettings();
  _tbToastOk("Période enregistrée.");
}

async function _tbFetchSeg(id){
  const s = _tbGetSB();
  const { data, error } = await s.from("budget_segments").select("*").eq("id", id).single();
  if(error) throw error;
  return data;
}

async function deleteBudgetSegment(segId){
  const s = _tbGetSB();
  if(!s) throw new Error("Supabase non prêt.");
  const pid = state.period && state.period.id;
  if(!pid) throw new Error("Voyage non sélectionné.");

  const segs = (state.budgetSegments||[]).slice().sort((a,b)=>String(a.start_date).localeCompare(String(b.start_date)));
  if(segs.length<=1) throw new Error("Impossible: au moins 1 période requise.");

  const idx = segs.findIndex(x=>x.id===segId);
  if(idx<0) throw new Error("Période introuvable.");

  const seg = segs[idx];
  if(!confirm(`Supprimer la période ${_tbISO(seg.start_date)} → ${_tbISO(seg.end_date)} ?`)) return;

  const prev = idx>0 ? segs[idx-1] : null;
  const next = idx<segs.length-1 ? segs[idx+1] : null;

  // delete
  const { error } = await s.from("budget_segments").delete().eq("id", segId);
  if(error) throw error;

  // merge gap to neighbor (prefer prev)
  if(prev && next){
    // extend prev to cover until next.start-1, then shift next.start if needed
    const newPrevEnd = _tbAddDays(_tbISO(next.start_date), -1);
    const { error: e1 } = await s.from("budget_segments").update({ end_date: newPrevEnd }).eq("id", prev.id);
    if(e1) throw e1;
  }else if(prev && !next){
    // extend prev to voyage end (will sync)
  }else if(!prev && next){
    // extend next backward to voyage start (will sync)
  }

  await _tbRecalcSegmentSortOrder(pid);
  await _syncSegmentsBoundsToPeriod(pid);
  await refreshSegmentsForActivePeriod();
  renderSettings();
  _tbToastOk("Période supprimée.");
}

async function _tbRecalcSegmentSortOrder(pid){
  const s = _tbGetSB();
  const { data, error } = await s.from("budget_segments").select("id,start_date").eq("period_id", pid).order("start_date", {ascending:true});
  if(error) throw error;
  const rows = data || [];
  for(let i=0;i<rows.length;i++){
    await s.from("budget_segments").update({ sort_order:i }).eq("id", rows[i].id);
  }
}

async function _syncSegmentsBoundsToPeriod(pid){
  const s = _tbGetSB();
  const { data, error } = await s.from("budget_segments").select("start_date,end_date").eq("period_id", pid).order("start_date",{ascending:true});
  if(error) throw error;
  const rows = data || [];
  if(!rows.length) return;
  const start = _tbISO(rows[0].start_date);
  const end = _tbISO(rows[rows.length-1].end_date);
  const { error: e2 } = await s.from("periods").update({ start_date:start, end_date:end }).eq("id", pid);
  if(e2) throw e2;
}

async function _syncVoyageBoundsToSegments(pid, start, end){
  const s = _tbGetSB();
  const { data, error } = await s.from("budget_segments").select("id,start_date,end_date").eq("period_id", pid).order("start_date",{ascending:true});
  if(error) throw error;
  const rows = data || [];
  if(!rows.length) return;

  const first = rows[0];
  const last = rows[rows.length-1];

  if(_tbISO(first.start_date) !== start){
    const { error: e1 } = await s.from("budget_segments").update({ start_date:start }).eq("id", first.id);
    if(e1) throw e1;
  }
  if(_tbISO(last.end_date) !== end){
    const { error: e2 } = await s.from("budget_segments").update({ end_date:end }).eq("id", last.id);
    if(e2) throw e2;
  }
  await _tbRecalcSegmentSortOrder(pid);
}

/* ---------- legacy globals expected by index.html ---------- */

window.renderSettings = renderSettings;
window.saveSettings = ()=>safeCall(saveSettings);
window.createPeriodPrompt = ()=>safeCall(createPeriodPrompt);
window.deleteActivePeriod = ()=>_tbToastOk("Suppression de période: utilise le bouton Supprimer sur une période.");
window.createVoyagePrompt = ()=>safeCall(createVoyagePrompt);
window.deleteActiveVoyage = ()=>safeCall(deleteActiveVoyage);

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
            ? entries.map(([c, r]) => `
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;padding:8px 0;border-top:1px solid var(--border);">
            <div><b>${escapeHTML(c)}</b> : 1 EUR = ${escapeHTML(String(r))} ${escapeHTML(c)}
              ${(() => { 
                try { 
                  const d = (typeof tbFxManualAsof === "function") ? tbFxManualAsof(c) : null; 
                  return d ? `<span class="muted" style="font-size:12px;">(${escapeHTML(String(d))})</span>` : ""; 
                } catch(_) { return ""; } 
              })()}
            </div>
            <button class="btn" onclick="tbManualFxDel('${escapeHTML(c)}')">Supprimer</button>
          </div>
        `).join("")
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
