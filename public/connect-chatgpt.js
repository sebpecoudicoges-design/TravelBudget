/* Browser consent uses the existing TravelBudget session, never a password form. */
(async () => {
  const byId = id => document.getElementById(id);
  const status = message => { byId('status').textContent = message; };
  document.body.classList.toggle('theme-dark', matchMedia('(prefers-color-scheme: dark)').matches);
  byId('theme-toggle').addEventListener('click',()=>document.body.classList.toggle('theme-dark'));
  let sb, request, displayedUser, busy = false;
  let sharingUser=null, selectedDocuments=new Set(), savingSharing=false;
  // Cross-origin calls bypass old installed app service workers as well.
  const api = 'https://obznbrzarhvmlbprcfie.supabase.co/functions/v1/travelbudget-mcp';
  navigator.serviceWorker?.getRegistration().then(registration=>registration?.update()).catch(()=>{});
  async function session() { const { data, error } = await sb.auth.getSession(); if (error) throw new Error('Session indisponible.'); return data.session; }
  async function call(path, { method = 'GET', data, authenticated = false } = {}) {
    const headers = { 'Content-Type':'application/json' };
    if (authenticated) {
      const current = await session();
      if (!current) throw new Error('Connecte-toi à TravelBudget, puis actualise cette page.');
      if (path === '/authorize' && current.user.id !== displayedUser) throw new Error('Le compte a changé. Actualise la page avant de confirmer.');
      if(path==='/sharing' && method==='POST' && current.user.id!==sharingUser)throw new Error('Le compte a changé. Actualise la page avant de partager.');
      headers.Authorization = 'Bearer '+current.access_token;
    }
    const response = await fetch(api+path,{method,headers,credentials:'omit',cache:'no-store',body:data?JSON.stringify(data):undefined});
    const result = await response.json();
    if (!response.ok) throw new Error(response.status===403?'Accès refusé : ce compte ne fait pas partie du pilote ou la session doit être renouvelée.':response.status===429?'Trop de demandes. Réessaie dans une minute.':'Connexion indisponible. Réessaie après avoir vérifié ta session.');
    return result;
  }
  async function refresh() {
    const current = await session();
    displayedUser = current?.user.id;
    byId('account').textContent = current ? 'Compte connecté : '+(current.user.email || current.user.id) : 'Aucun compte connecté';
    byId('login').hidden = !!current;
    byId('approve').disabled = !current || !request || busy;
    const container = byId('connections'); container.replaceChildren();
    if (!current) { container.textContent = 'Connecte-toi pour consulter tes accès.'; return; }
    const grants = await call('/connections',{authenticated:true});
    if (!grants.length) container.textContent = 'Aucun accès actif.';
    for (const grant of grants) {
      const row = document.createElement('div'); row.className = 'tb-connect-grant';
      const text = document.createElement('p'); text.textContent = 'ChatGPT — autorisé le '+new Date(grant.created_at).toLocaleDateString('fr-FR')+', expire le '+new Date(grant.expires_at).toLocaleDateString('fr-FR');
      const button = document.createElement('button'); button.type = 'button'; button.textContent = 'Révoquer cet accès';
      button.addEventListener('click',async()=>{
        button.disabled = true;
        try { await call('/disconnect',{method:'POST',data:{grant_id:grant.id},authenticated:true}); status('Accès révoqué.'); await refresh(); }
        catch (error) { status(error.message); button.disabled = false; }
      });
      row.append(text,button); container.append(row);
    }
  }
  async function loadSharing(){
    byId('sharing-panel').hidden=true;sharingUser=null;selectedDocuments=new Set();
    const current=await session();if(!current)return;
    const prefs=await call('/sharing',{authenticated:true});
    if((await session())?.user.id!==current.user.id)return;
    sharingUser=current.user.id;selectedDocuments=new Set(prefs.document_ids||[]);
    byId('finance-sharing').checked=prefs.finance_enabled===true;
    byId('sport-sharing').checked=prefs.sport_enabled===true;
    byId('nutrition-sharing').checked=prefs.nutrition_enabled===true;
    byId('all-documents-sharing').checked=prefs.all_documents===true;
    byId('accounting-sharing').checked=false;
    byId('settings-sync-state').textContent=prefs.settings_synced_at?'Dernière synchronisation comptable : '+new Date(prefs.settings_synced_at).toLocaleString():'Aucun réglage comptable local partagé : les rapports utilisent la classification automatique.';
    const list=byId('sharing-documents');list.replaceChildren();
    for(const doc of prefs.documents||[]){
      const label=document.createElement('label');label.className='tb-connect-choice';
      const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.value=doc.id;checkbox.checked=selectedDocuments.has(doc.id);
      checkbox.addEventListener('change',()=>checkbox.checked?selectedDocuments.add(doc.id):selectedDocuments.delete(doc.id));
      const text=document.createElement('span');text.textContent=doc.name||doc.original_filename||'Document';
      const detail=document.createElement('small');detail.textContent=(doc.mime_type||'Format inconnu')+' · '+Math.ceil(Number(doc.size_bytes||0)/1024)+' Kio';text.append(detail);
      label.append(checkbox,text);list.append(label);
    }
    if(!prefs.documents?.length)list.textContent='Aucun document disponible.';
    byId('sharing-status').textContent=prefs.documents_truncated?'Les 500 documents les plus récents sont affichés. Les sélections antérieures restent conservées.':'';
    byId('sharing-panel').hidden=false;syncDocumentMode();
  }
  function syncDocumentMode(){byId('sharing-documents').querySelectorAll('input').forEach(input=>input.disabled=savingSharing||byId('all-documents-sharing').checked);}
  byId('all-documents-sharing').addEventListener('change',syncDocumentMode);
  byId('save-sharing').addEventListener('click',async()=>{
    if(savingSharing)return;savingSharing=true;byId('save-sharing').disabled=true;
    const controls=[...byId('sharing-panel').querySelectorAll('input')];controls.forEach(input=>input.disabled=true);
    try{
      const current=await session();if(!current||current.user.id!==sharingUser)throw new Error('Le compte a changé. Actualise la page avant de partager.');
      if(!byId('all-documents-sharing').checked&&selectedDocuments.size>100)throw new Error('Choisis au maximum 100 documents.');
      const data={finance_enabled:byId('finance-sharing').checked,sport_enabled:byId('sport-sharing').checked,nutrition_enabled:byId('nutrition-sharing').checked,all_documents:byId('all-documents-sharing').checked,document_ids:byId('all-documents-sharing').checked?[]:[...selectedDocuments]};
      if(byId('accounting-sharing').checked){
        const prefix='tb-accounting-v1:'+encodeURIComponent(current.user.id)+':';data.accounting_settings={};
        for(let i=0;i<localStorage.length;i++){
          const key=localStorage.key(i);if(!key.startsWith(prefix))continue;
          const travelId=decodeURIComponent(key.slice(prefix.length));
          if(!/^[0-9a-f-]{36}$/i.test(travelId))continue;
          const value=JSON.parse(localStorage.getItem(key));
          if(value&&typeof value==='object'&&!Array.isArray(value))data.accounting_settings[travelId]=value;
        }
      }
      if(new TextEncoder().encode(JSON.stringify(data)).length>15000)throw new Error('Réglages trop volumineux pour cette synchronisation. Décoche les réglages comptables pour enregistrer les autres choix.');
      await call('/sharing',{method:'POST',data,authenticated:true});
      await loadSharing();byId('sharing-status').textContent='Choix enregistrés. Actualise les outils du plugin dans ChatGPT pour utiliser les nouvelles lectures.';
    }catch(error){byId('sharing-status').textContent=error.message;}
    finally{savingSharing=false;byId('save-sharing').disabled=false;controls.forEach(input=>input.disabled=false);syncDocumentMode();}
  });
  byId('clear-shared-documents').addEventListener('click',()=>{
    if(savingSharing)return;selectedDocuments.clear();byId('all-documents-sharing').checked=false;syncDocumentMode();
    byId('sharing-documents').querySelectorAll('input').forEach(input=>input.checked=false);
    byId('sharing-status').textContent='Aucun document sélectionné. Enregistre pour appliquer ce retrait.';
  });
  async function decide(approved) {
    if (busy || !request) return;
    busy = true; byId('approve').disabled = true; byId('deny').disabled = true;
    try {
      const result = await call('/authorize',{method:'POST',data:{...request,approved},authenticated:approved});
      const target = new URL(result.redirect_uri);
      // Additional browser guard; the server enforces the exact registered callback.
      if (target.origin !== 'https://chatgpt.com' || target.pathname !== '/connector_platform_oauth_redirect') throw new Error('Adresse de retour refusée.');
      location.replace(target.href);
    } catch (error) { status(error.message); busy=false; byId('deny').disabled=false; byId('approve').disabled=!(await session()); }
  }
  byId('approve').addEventListener('click',()=>decide(true));
  byId('deny').addEventListener('click',()=>decide(false));
  byId('refresh-session').addEventListener('click',()=>refresh().then(loadSharing).catch(error=>status(error.message)));
  try {
    const config = await call('/config');
    if (config.supabaseUrl !== 'https://obznbrzarhvmlbprcfie.supabase.co') throw new Error('Configuration de connexion invalide.');
    sb = window.supabase.createClient(config.supabaseUrl,config.publishableKey,{auth:{detectSessionInUrl:false,persistSession:true,autoRefreshToken:true}});
    const hash = location.hash.slice(1);
    if (hash) {
      const inspected = await call('/request?'+hash);
      request = Object.freeze(inspected.request); byId('consent').hidden = false;
      status('Vérifie le compte et les données partagées avant de choisir.');
    } else status('Démarre la connexion depuis ChatGPT pour autoriser un nouvel accès.');
    await refresh();
    await loadSharing().catch(()=>{byId('sharing-panel').hidden=true;status('Les options de partage n’ont pas pu être chargées. Actualise cette page pour réessayer.');});
  } catch (error) { status(error.message); byId('approve').disabled = true; }
})();
