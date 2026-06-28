/* Work career V2: jobs, received income, status periods and Document folders. */
(function () {
  const DATA = { loaded:false, loading:false, engagements:[], incomes:[], statuses:[], folders:[], links:[], error:'' };
  const $ = (sel, root=document) => root.querySelector(sel);
  const txt = (fr,en) => String(window.TB_LANG||'fr').toLowerCase()==='en' ? en : fr;
  const esc = (value) => typeof window.escapeHTML === 'function' ? window.escapeHTML(value) : String(value||'').replace(/[&<>"']/g, ch=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]));
  const table = (name) => window.TB_CONST?.TABLES?.[name] || name;
  const sb = () => window.sb || null;
  const uid = () => window.sbUser?.id || null;
  const today = () => { try { return window.toLocalISODate(new Date()); } catch (_) { return new Date().toISOString().slice(0,10); } };
  const num = (v) => Number.isFinite(Number(v)) ? Number(v) : 0;
  const money = (v,c='AUD') => { try { return new Intl.NumberFormat(String(window.TB_LANG||'fr')==='en'?'en-AU':'fr-FR',{style:'currency',currency:c,maximumFractionDigits:0}).format(num(v)); } catch(_){ return `${Math.round(num(v))} ${c}`; } };
  const shortDate = (v) => { const raw=String(v||'').slice(0,10); if(!raw)return ''; try{return new Intl.DateTimeFormat(String(window.TB_LANG||'fr')==='en'?'en-AU':'fr-FR',{day:'2-digit',month:'short',year:'2-digit'}).format(new Date(`${raw}T12:00:00`));}catch(_){return raw;} };
  const jobById = (id) => DATA.engagements.find(row=>String(row.id)===String(id));

  function ensureStyles(){
    if ($('#tb-work-career-styles')) return;
    const style=document.createElement('style'); style.id='tb-work-career-styles'; style.textContent=`
      .tb-career{border:1px solid rgba(14,165,233,.22);border-radius:8px;background:var(--panel2);padding:14px;margin:14px 0}.tb-career-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap}.tb-career-actions{display:flex;gap:7px;flex-wrap:wrap}.tb-career-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:12px 0}.tb-career-kpi{padding:10px;border-radius:8px;background:var(--panel);border:1px solid var(--border)}.tb-career-kpi small{display:block;color:var(--muted);font-weight:750}.tb-career-kpi strong{display:block;font-size:20px;margin-top:3px}.tb-career-track{display:grid;grid-template-columns:130px 1fr;gap:10px;align-items:center;margin:7px 0}.tb-career-track-label{font-size:12px;font-weight:850;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.tb-career-rail{position:relative;height:28px;border-radius:7px;background:rgba(148,163,184,.16);overflow:hidden}.tb-career-bar{position:absolute;top:4px;height:20px;min-width:4px;border-radius:6px;box-shadow:0 5px 12px rgba(15,23,42,.12)}.tb-career-jobs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:12px}.tb-career-job{border:1px solid var(--border);border-radius:8px;padding:11px;background:var(--panel)}.tb-career-job-top{display:flex;justify-content:space-between;gap:8px}.tb-career-job-stats{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0}.tb-career-folder{display:flex;align-items:center;justify-content:space-between;gap:6px;padding:5px 7px;border-radius:6px;background:var(--panel2);font-size:12px;margin-top:5px}.tb-career-modal-bg{position:fixed;inset:0;z-index:10020;background:rgba(15,23,42,.52);display:grid;place-items:center;padding:14px}.tb-career-modal{width:min(680px,100%);max-height:calc(100dvh - 28px);overflow:auto;background:var(--panel,#fff);border:1px solid var(--border);border-radius:8px;padding:16px;box-shadow:0 28px 80px rgba(15,23,42,.28)}.tb-career-modal-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.tb-career-modal-head h3{margin:0}.tb-career-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:14px}.tb-career-form label{display:grid;gap:5px;font-size:12px;font-weight:800}.tb-career-form input,.tb-career-form select,.tb-career-form textarea{width:100%;box-sizing:border-box;border:1px solid var(--border);border-radius:7px;background:var(--panel2);color:inherit;padding:10px}.tb-career-form .wide{grid-column:1/-1}.tb-career-modal-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:14px}.tb-career-error{color:#be123c;font-size:12px;margin-top:8px}.tb-career-empty{padding:12px 0;color:var(--muted)}
      @media(max-width:720px){.tb-career-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.tb-career-jobs,.tb-career-form{grid-template-columns:1fr}.tb-career-track{grid-template-columns:85px 1fr}.tb-career-actions .btn{flex:1}.tb-work-grid{grid-template-columns:1fr!important}}
    `; document.head.appendChild(style);
  }

  async function load(force=false){
    if(DATA.loading || (DATA.loaded && !force)) return;
    const c=sb(); if(!c||!uid()){ DATA.loaded=true; return; }
    DATA.loading=true; DATA.error='';
    try{
      const [jobs,incomes,statuses,folders,links]=await Promise.all([
        c.from(table('work_engagements')).select('*').eq('user_id',uid()).order('start_date',{ascending:false}),
        c.from(table('work_income_events')).select('*').eq('user_id',uid()).order('received_date',{ascending:false}),
        c.from(table('work_status_periods')).select('*').eq('user_id',uid()).order('start_date',{ascending:false}),
        c.from(table('document_folders')).select('id,name,parent_id').eq('user_id',uid()).order('name',{ascending:true}),
        c.from(table('work_document_folders')).select('*').eq('user_id',uid()),
      ]);
      const failed=[jobs,incomes,statuses,folders,links].find(x=>x.error); if(failed) throw failed.error;
      DATA.engagements=jobs.data||[]; DATA.incomes=incomes.data||[]; DATA.statuses=statuses.data||[]; DATA.folders=folders.data||[]; DATA.links=links.data||[]; DATA.loaded=true;
    }catch(e){ DATA.error=e?.message||String(e); DATA.loaded=true; console.warn('[work-career] load failed',e); }
    finally{ DATA.loading=false; }
  }

  function summary(){
    return window.Core?.workRules?.summarizeWorkCareer?.({ engagements:DATA.engagements, days:window.state?.workDays||[], incomes:DATA.incomes }) || { totals:{netHours:0,totalReceived:0,hourlyNet:null,workDays:0},engagements:[] };
  }
  function range(){
    const dates=[]; [...DATA.engagements,...DATA.statuses].forEach(row=>{if(row.start_date)dates.push(row.start_date);if(row.end_date)dates.push(row.end_date);});
    dates.push(today()); dates.sort(); const start=new Date(`${dates[0]||today()}T12:00:00`); const end=new Date(`${dates[dates.length-1]||today()}T12:00:00`); if(end-start<86400000*30) end.setDate(end.getDate()+30); return {start,end,span:Math.max(1,end-start)};
  }
  function position(start,end,r){
    const s=new Date(`${String(start||today()).slice(0,10)}T12:00:00`); const e=new Date(`${String(end||today()).slice(0,10)}T12:00:00`); const left=Math.max(0,Math.min(100,((s-r.start)/r.span)*100)); const right=Math.max(left,Math.min(100,((e-r.start)/r.span)*100)); return {left,width:Math.max(1,right-left)};
  }
  function timeline(){
    const r=range(); const rows=[...DATA.engagements.map(x=>({...x,_kind:'job'})),...DATA.statuses.map(x=>({...x,_kind:'status'}))].sort((a,b)=>String(a.start_date).localeCompare(String(b.start_date)));
    if(!rows.length)return `<div class="tb-career-empty">${esc(txt('Ajoute une mission ou une période pour démarrer la fresque.','Add a job or period to start the timeline.'))}</div>`;
    return `<div aria-label="${esc(txt('Fresque professionnelle','Career timeline'))}">${rows.map(row=>{const p=position(row.start_date,row.end_date,r);const color=row.color||(row._kind==='status'?'#94a3b8':'#0ea5e9');return `<div class="tb-career-track"><div class="tb-career-track-label" title="${esc(row.name||row.label)}">${esc(row.name||row.label)}</div><div class="tb-career-rail" title="${esc(`${shortDate(row.start_date)} - ${row.end_date?shortDate(row.end_date):txt('en cours','ongoing')}`)}"><span class="tb-career-bar" style="left:${p.left}%;width:${p.width}%;background:${esc(color)}"></span></div></div>`;}).join('')}</div>`;
  }
  function folderRows(job){
    const links=DATA.links.filter(x=>String(x.engagement_id)===String(job.id));
    return links.map(link=>{const folder=DATA.folders.find(x=>String(x.id)===String(link.folder_id));return folder?`<div class="tb-career-folder"><span>📁 ${esc(folder.name)}</span><button class="btn small" data-career-unlink="${esc(link.id)}" type="button">×</button></div>`:'';}).join('');
  }
  function jobsHtml(s){
    return DATA.engagements.map(job=>{const item=s.engagements.find(x=>String(x.engagement?.id)===String(job.id))||{netHours:0,totalReceived:0,hourlyNet:null};return `<article class="tb-career-job"><div class="tb-career-job-top"><div><strong>${esc(job.name)}</strong><div class="muted">${esc(job.employer||job.role_title||'')} · ${esc(shortDate(job.start_date))}${job.end_date?` - ${esc(shortDate(job.end_date))}`:''}</div></div><span style="width:10px;height:10px;border-radius:50%;background:${esc(job.color||'#0ea5e9')}"></span></div><div class="tb-career-job-stats"><span class="pill">${Math.round(item.netHours*10)/10}h</span><span class="pill">${esc(money(item.totalReceived,job.currency))}</span><span class="pill">${item.hourlyNet==null?'--':esc(money(item.hourlyNet,job.currency))}/h</span></div>${folderRows(job)}<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px"><button class="btn small" data-career-edit-job="${esc(job.id)}" type="button">${esc(txt('Modifier','Edit'))}</button><button class="btn small" data-career-link-folder="${esc(job.id)}" type="button">${esc(txt('Lier un dossier','Link folder'))}</button><button class="btn small" data-career-delete-job="${esc(job.id)}" type="button">${esc(txt('Supprimer','Delete'))}</button></div></article>`;}).join('');
  }
  function activityHtml(){
    const rows=[
      ...DATA.incomes.map(row=>({kind:'income',id:row.id,date:row.received_date,title:jobById(row.engagement_id)?.name||txt('Revenu hors mission','Unassigned income'),detail:money(row.net_amount,row.currency),row})),
      ...DATA.statuses.map(row=>({kind:'status',id:row.id,date:row.start_date,title:row.label,detail:`${shortDate(row.start_date)}${row.end_date?` - ${shortDate(row.end_date)}`:` · ${txt('en cours','ongoing')}`}`,row})),
    ].sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,12);
    if(!rows.length)return '';
    return `<div style="margin-top:14px;border-top:1px solid var(--border);padding-top:10px"><strong>${esc(txt('Revenus et périodes','Income and periods'))}</strong>${rows.map(item=>`<div style="display:flex;justify-content:space-between;gap:8px;align-items:center;padding:7px 0;border-bottom:1px solid var(--border)"><div><b>${esc(item.title)}</b><div class="muted">${esc(shortDate(item.date))} · ${esc(item.detail)}</div></div><div style="display:flex;gap:5px"><button class="btn small" type="button" data-career-edit-${item.kind}="${esc(item.id)}">${esc(txt('Modifier','Edit'))}</button><button class="btn small" type="button" data-career-delete-${item.kind}="${esc(item.id)}">×</button></div></div>`).join('')}</div>`;
  }

  async function render(){
    ensureStyles(); const root=$('#work-career-root'); if(!root)return;
    if(!DATA.loaded&&!DATA.loading){root.innerHTML=`<div class="tb-career muted">${esc(txt('Chargement de la fresque...','Loading timeline...'))}</div>`;await load(); if(window.renderWork)window.renderWork('career-loaded');return;}
    const s=summary(),t=s.totals||{}; root.innerHTML=`<section class="tb-career"><div class="tb-career-head"><div><h3 style="margin:0">${esc(txt('Parcours professionnel','Career'))}</h3><div class="muted">${esc(txt('Temps travaillé, revenus reçus et périodes de transition.','Worked time, received income and transition periods.'))}</div></div><div class="tb-career-actions"><button class="btn primary" data-career-open="job" type="button">+ ${esc(txt('Mission','Job'))}</button><button class="btn" data-career-open="income" type="button">+ ${esc(txt('Revenu','Income'))}</button><button class="btn" data-career-open="status" type="button">+ ${esc(txt('Période','Period'))}</button></div></div>${DATA.error?`<div class="tb-career-error">${esc(DATA.error)}</div>`:''}<div class="tb-career-kpis"><div class="tb-career-kpi"><small>${esc(txt('Net reçu','Net received'))}</small><strong>${esc(money(t.totalReceived||0,DATA.engagements[0]?.currency||'AUD'))}</strong></div><div class="tb-career-kpi"><small>${esc(txt('Heures nettes','Net hours'))}</small><strong>${Math.round(num(t.netHours)*10)/10}h</strong></div><div class="tb-career-kpi"><small>${esc(txt('Taux net réel','Actual net rate'))}</small><strong>${t.hourlyNet==null?'--':esc(money(t.hourlyNet,DATA.engagements[0]?.currency||'AUD'))}/h</strong></div><div class="tb-career-kpi"><small>${esc(txt('Missions','Jobs'))}</small><strong>${DATA.engagements.length}</strong></div></div>${timeline()}<div class="tb-career-jobs">${jobsHtml(s)}</div>${activityHtml()}</section>`; bind(root);
  }

  function modal(kind,row={}){
    const isJob=kind==='job',isIncome=kind==='income',isStatus=kind==='status';
    const title=isJob?txt(row.id?'Modifier la mission':'Nouvelle mission',row.id?'Edit job':'New job'):isIncome?txt('Ajouter un revenu reçu','Add received income'):txt(row.id?'Modifier la période':'Nouvelle période',row.id?'Edit period':'New period');
    const jobOptions=`<option value="">${esc(txt('Sans mission / chômage','No job / unemployment'))}</option>`+DATA.engagements.map(x=>`<option value="${esc(x.id)}" ${String(row.engagement_id||'')===String(x.id)?'selected':''}>${esc(x.name)}</option>`).join('');
    const form=isJob?`<label>${esc(txt('Nom de la mission','Job name'))}<input name="name" required value="${esc(row.name||'')}"></label><label>${esc(txt('Employeur','Employer'))}<input name="employer" value="${esc(row.employer||'')}"></label><label>${esc(txt('Poste','Role'))}<input name="role_title" value="${esc(row.role_title||'')}"></label><label>${esc(txt('Lieu','Location'))}<input name="location" value="${esc(row.location||'')}"></label><label>${esc(txt('Début','Start'))}<input name="start_date" type="date" required value="${esc(row.start_date||today())}"></label><label>${esc(txt('Fin','End'))}<input name="end_date" type="date" value="${esc(row.end_date||'')}"></label><label>${esc(txt('Devise','Currency'))}<input name="currency" maxlength="3" value="${esc(row.currency||'AUD')}"></label><label>${esc(txt('Couleur','Color'))}<input name="color" type="color" value="${esc(row.color||'#0ea5e9')}"></label>`:isIncome?`<label>${esc(txt('Mission','Job'))}<select name="engagement_id">${jobOptions}</select></label><label>${esc(txt('Type','Type'))}<select name="income_type"><option value="salary">${esc(txt('Salaire','Salary'))}</option><option value="bonus">Bonus</option><option value="unemployment_benefit">${esc(txt('Allocation chômage','Unemployment benefit'))}</option><option value="other">${esc(txt('Autre','Other'))}</option></select></label><label>${esc(txt('Net reçu','Net received'))}<input name="net_amount" type="number" min="0" step="0.01" required></label><label>${esc(txt('Brut','Gross'))}<input name="gross_amount" type="number" min="0" step="0.01"></label><label>${esc(txt('Date reçue','Received date'))}<input name="received_date" type="date" required value="${today()}"></label><label>${esc(txt('Devise','Currency'))}<input name="currency" maxlength="3" value="AUD"></label><label>${esc(txt('Période début','Period start'))}<input name="period_start" type="date"></label><label>${esc(txt('Période fin','Period end'))}<input name="period_end" type="date"></label>`:`<label>${esc(txt('Libellé','Label'))}<input name="label" required value="${esc(row.label||txt('Chômage','Unemployment'))}"></label><label>${esc(txt('Type','Type'))}<select name="status_type"><option value="unemployment">${esc(txt('Chômage','Unemployment'))}</option><option value="leave">${esc(txt('Congé','Leave'))}</option><option value="training">${esc(txt('Formation','Training'))}</option><option value="other">${esc(txt('Autre','Other'))}</option></select></label><label>${esc(txt('Début','Start'))}<input name="start_date" type="date" required value="${esc(row.start_date||today())}"></label><label>${esc(txt('Fin','End'))}<input name="end_date" type="date" value="${esc(row.end_date||'')}"></label><label>${esc(txt('Mission liée (facultatif)','Linked job (optional)'))}<select name="engagement_id">${jobOptions}</select></label><label>${esc(txt('Couleur','Color'))}<input name="color" type="color" value="${esc(row.color||'#94a3b8')}"></label>`;
    document.body.insertAdjacentHTML('beforeend',`<div class="tb-career-modal-bg"><form class="tb-career-modal" data-career-form="${kind}" data-id="${esc(row.id||'')}"><div class="tb-career-modal-head"><div><h3>${esc(title)}</h3><div class="muted">${esc(isStatus?txt('Les périodes peuvent se chevaucher.','Periods may overlap.'):txt('Enregistré dans ton suivi Travail.','Saved in your Work tracking.'))}</div></div><button class="btn" data-career-close type="button">×</button></div><div class="tb-career-form">${form}<label class="wide">${esc(txt('Notes','Notes'))}<textarea name="notes" rows="2">${esc(row.notes||'')}</textarea></label></div><div class="tb-career-error" hidden></div><div class="tb-career-modal-actions"><button class="btn" data-career-close type="button">${esc(txt('Annuler','Cancel'))}</button><button class="btn primary" type="submit">${esc(txt('Enregistrer','Save'))}</button></div></form></div>`); const opened=$('[data-career-form]'); if(opened&&row.id){['income_type','status_type','engagement_id'].forEach(name=>{const el=opened.elements[name];if(el&&row[name]!=null)el.value=String(row[name]);});['net_amount','gross_amount','received_date','currency','period_start','period_end'].forEach(name=>{const el=opened.elements[name];if(el&&row[name]!=null)el.value=String(row[name]);});} bindModal();
  }
  function closeModal(){ $('.tb-career-modal-bg')?.remove(); }
  function value(fd,name){return String(fd.get(name)||'').trim();}
  async function linkUnassignedWorkDays(engagementId, startDate, endDate){
    const c=sb(); if(!c||!uid()||!engagementId||!startDate)return;
    let query=c.from(table('work_days')).update({engagement_id:engagementId})
      .eq('user_id',uid()).is('engagement_id',null).gte('work_date',startDate);
    if(endDate)query=query.lte('work_date',endDate);
    const {error}=await query; if(error)throw error;
  }
  async function saveForm(form){
    const kind=form.dataset.careerForm,id=form.dataset.id,c=sb(),fd=new FormData(form); if(!c||!uid())throw new Error(txt('Connexion requise.','Sign-in required.'));
    let target,payload;
    if(kind==='job'){target='work_engagements';payload={user_id:uid(),travel_id:window.state?.activeTravelId||null,name:value(fd,'name'),employer:value(fd,'employer')||null,role_title:value(fd,'role_title')||null,location:value(fd,'location')||null,start_date:value(fd,'start_date'),end_date:value(fd,'end_date')||null,currency:value(fd,'currency').toUpperCase()||'AUD',color:value(fd,'color')||'#0ea5e9',status:value(fd,'end_date')?'completed':'active',notes:value(fd,'notes')||null};}
    else if(kind==='income'){target='work_income_events';payload={user_id:uid(),engagement_id:value(fd,'engagement_id')||null,received_date:value(fd,'received_date'),period_start:value(fd,'period_start')||null,period_end:value(fd,'period_end')||null,net_amount:num(value(fd,'net_amount')),gross_amount:value(fd,'gross_amount')===''?null:num(value(fd,'gross_amount')),currency:value(fd,'currency').toUpperCase()||'AUD',income_type:value(fd,'income_type')||'salary',notes:value(fd,'notes')||null};}
    else{target='work_status_periods';payload={user_id:uid(),engagement_id:value(fd,'engagement_id')||null,status_type:value(fd,'status_type')||'unemployment',label:value(fd,'label'),start_date:value(fd,'start_date'),end_date:value(fd,'end_date')||null,color:value(fd,'color')||'#94a3b8',notes:value(fd,'notes')||null};}
    const q=(id?c.from(table(target)).update(payload).eq('id',id).eq('user_id',uid()):c.from(table(target)).insert(payload)).select('id').single();
    const {data,error}=await q;if(error)throw error;
    if(kind==='job'){
      await linkUnassignedWorkDays(data?.id||id,payload.start_date,payload.end_date);
      if(typeof window.tbReloadWorkDays==='function')await window.tbReloadWorkDays();
    }
    closeModal();await load(true);window.renderWork?.('career-save');
  }
  function bindModal(){const form=$('[data-career-form]');if(!form)return;form.querySelectorAll('[data-career-close]').forEach(x=>x.onclick=closeModal);form.onsubmit=async(ev)=>{ev.preventDefault();const error=$('.tb-career-error',form);try{await saveForm(form);}catch(e){error.hidden=false;error.textContent=e?.message||String(e);}};}
  async function linkFolder(jobId){
    const available=DATA.folders.filter(folder=>!DATA.links.some(link=>String(link.engagement_id)===String(jobId)&&String(link.folder_id)===String(folder.id))); if(!available.length){alert(txt('Aucun dossier disponible. Crée-le d’abord dans Documents.','No folder available. Create one in Documents first.'));return;}
    const names=available.map((x,i)=>`${i+1}. ${x.name}`).join('\n');const answer=prompt(`${txt('Numéro du dossier à lier','Folder number to link')}\n${names}`,'1');const folder=available[Number(answer)-1];if(!folder)return;const {error}=await sb().from(table('work_document_folders')).insert({user_id:uid(),engagement_id:jobId,folder_id:folder.id});if(error)throw error;await load(true);window.renderWork?.('career-folder');
  }
  async function remove(tableName,id,confirmText){if(!confirm(confirmText))return;const {error}=await sb().from(table(tableName)).delete().eq('id',id).eq('user_id',uid());if(error)throw error;await load(true);window.renderWork?.('career-delete');}
  function bind(root){
    root.querySelectorAll('[data-career-open]').forEach(btn=>btn.onclick=()=>modal(btn.dataset.careerOpen));
    root.querySelectorAll('[data-career-edit-job]').forEach(btn=>btn.onclick=()=>modal('job',jobById(btn.dataset.careerEditJob)||{}));
    root.querySelectorAll('[data-career-delete-job]').forEach(btn=>btn.onclick=()=>remove('work_engagements',btn.dataset.careerDeleteJob,txt('Supprimer cette mission et ses revenus liés ?','Delete this job and its linked income?')).catch(e=>alert(e.message)));
    root.querySelectorAll('[data-career-link-folder]').forEach(btn=>btn.onclick=()=>linkFolder(btn.dataset.careerLinkFolder).catch(e=>alert(e.message)));
    root.querySelectorAll('[data-career-unlink]').forEach(btn=>btn.onclick=()=>remove('work_document_folders',btn.dataset.careerUnlink,txt('Délier ce dossier ?','Unlink this folder?')).catch(e=>alert(e.message)));
    root.querySelectorAll('[data-career-edit-income]').forEach(btn=>btn.onclick=()=>modal('income',DATA.incomes.find(x=>String(x.id)===String(btn.dataset.careerEditIncome))||{}));
    root.querySelectorAll('[data-career-delete-income]').forEach(btn=>btn.onclick=()=>remove('work_income_events',btn.dataset.careerDeleteIncome,txt('Supprimer ce revenu ?','Delete this income?')).catch(e=>alert(e.message)));
    root.querySelectorAll('[data-career-edit-status]').forEach(btn=>btn.onclick=()=>modal('status',DATA.statuses.find(x=>String(x.id)===String(btn.dataset.careerEditStatus))||{}));
    root.querySelectorAll('[data-career-delete-status]').forEach(btn=>btn.onclick=()=>remove('work_status_periods',btn.dataset.careerDeleteStatus,txt('Supprimer cette période ?','Delete this period?')).catch(e=>alert(e.message)));
  }
  window.tbWorkCareerEngagements=()=>DATA.engagements.slice();
  window.renderWorkCareer=render;
  window.tbReloadWorkCareer=async()=>{await load(true);await render();};
  window.addEventListener('tb:auth_scope_changed',()=>{DATA.loaded=false;DATA.engagements=[];DATA.incomes=[];DATA.statuses=[];DATA.links=[];});
})();
