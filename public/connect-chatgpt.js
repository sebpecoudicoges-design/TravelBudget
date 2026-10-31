/* Browser consent uses the existing TravelBudget session, never a password form. */
(async () => {
  const byId = id => document.getElementById(id);
  const status = message => { byId('status').textContent = message; };
  document.body.classList.toggle('theme-dark', matchMedia('(prefers-color-scheme: dark)').matches);
  byId('theme-toggle').addEventListener('click',()=>document.body.classList.toggle('theme-dark'));
  let sb, request, displayedUser, busy = false;
  const api = '/mcp-auth';
  async function session() { const { data, error } = await sb.auth.getSession(); if (error) throw new Error('Session indisponible.'); return data.session; }
  async function call(path, { method = 'GET', data, authenticated = false } = {}) {
    const headers = { 'Content-Type':'application/json' };
    if (authenticated) {
      const current = await session();
      if (!current) throw new Error('Connecte-toi à TravelBudget, puis actualise cette page.');
      if (path === '/authorize' && current.user.id !== displayedUser) throw new Error('Le compte a changé. Actualise la page avant de confirmer.');
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
  byId('refresh-session').addEventListener('click',()=>refresh().catch(error=>status(error.message)));
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
  } catch (error) { status(error.message); byId('approve').disabled = true; }
})();
