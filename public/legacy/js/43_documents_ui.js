/* TravelBudget V9.6.5 - Documents UI
   V1 coffre documentaire: dossiers, upload, renommage, suppression, preview PDF/image.
   No OCR, no entity links, no financial mutation. */
(function(){
  const BUCKET = 'personal-documents';
  let CACHE = {
  folders: [],
  documents: [],
  selectedFolderId: '',
  loading: false,
  error: '',
  search: '',
  sort: '',
  uploading: '',
  onlyFavorites: false,
  onlyExpiring: false
};

  function esc(v){ try { return escapeHTML(String(v ?? '')); } catch(_) { return String(v ?? '').replace(/[&<>'"]/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[c])); } }
  function client(){ try{ if(typeof sb !== 'undefined' && sb && sb.from) return sb; }catch(_){} try{ if(window.sb && window.sb.from) return window.sb; }catch(_){} return null; }
  function table(name, fallback){ return (window.TB_CONST && window.TB_CONST.TABLES && window.TB_CONST.TABLES[name]) || fallback || name; }
  function key(name, fallback){ return (window.TB_CONST && window.TB_CONST.LS_KEYS && window.TB_CONST.LS_KEYS[name]) || fallback || name; }
  function fmtDate(v){ if(!v) return '—'; try { return new Date(v).toLocaleDateString('fr-FR'); } catch(_) { return String(v).slice(0,10); } }
  function fmtSize(bytes){ const n = Number(bytes||0); if(!n) return '—'; if(n < 1024) return `${n} o`; if(n < 1024*1024) return `${Math.round(n/102.4)/10} Ko`; return `${Math.round(n/1024/102.4)/10} Mo`; }
  function fmtExpiry(v){
  if(!v) return '';
  try{
    const today = new Date();
    today.setHours(0,0,0,0);

    const dt = new Date(v);
    dt.setHours(0,0,0,0);

    const days = Math.round((dt - today) / 86400000);

    if(days < 0) return `Expiré depuis ${Math.abs(days)} j`;
    if(days === 0) return 'Expire aujourd’hui';
    if(days <= 60) return `Expire dans ${days} j`;

    return `Expire le ${fmtDate(v)}`;
  }catch(_){
    return `Expire le ${String(v).slice(0,10)}`;
  }
}

function normalizeTags(v){
  return String(v || '')
    .split(',')
    .map(x => x.trim())
    .filter(Boolean)
    .slice(0, 12);
}
  function isImg(m){ return /^image\//i.test(String(m||'')); }
  function isPdf(m, name){ return /pdf/i.test(String(m||'')) || /\.pdf$/i.test(String(name||'')); }
  function root(){ return document.getElementById('documents-root'); }
  function selectedFolderId(){ try { return localStorage.getItem(key('documents_folder','travelbudget_documents_folder_v1')) || ''; } catch(_) { return CACHE.selectedFolderId || ''; } }
  function setSelectedFolderId(id){ CACHE.selectedFolderId = String(id||''); try { localStorage.setItem(key('documents_folder','travelbudget_documents_folder_v1'), CACHE.selectedFolderId); } catch(_) {} }
function selectedSort(){
  try {
    return CACHE.sort || localStorage.getItem(key('documents_sort','travelbudget_documents_sort_v1')) || 'date_desc';
  } catch(_) {
    return CACHE.sort || 'date_desc';
  }
}

function setSelectedSort(v){
  CACHE.sort = String(v || 'date_desc');

  try {
    localStorage.setItem(
      key('documents_sort','travelbudget_documents_sort_v1'),
      CACHE.sort
    );
  } catch(_) {}
}

  async function currentUserId(){
    try{ if(window.sbUser && window.sbUser.id) return window.sbUser.id; }catch(_){}
    const c = client();
    if(c && c.auth && typeof c.auth.getUser === 'function'){
      const res = await c.auth.getUser();
      return res && res.data && res.data.user && res.data.user.id ? res.data.user.id : '';
    }
    return '';
  }

  function injectStyles(){
    if(document.getElementById('tb-documents-style')) return;
    const st = document.createElement('style');
    st.id = 'tb-documents-style';
    st.textContent = `
      .tb-doc-shell{position:relative;overflow:hidden;border-radius:24px;background:linear-gradient(135deg,rgba(255,255,255,.92),rgba(255,255,255,.72));}
      .dark .tb-doc-shell{background:linear-gradient(135deg,rgba(24,24,30,.96),rgba(16,16,22,.82));}
      .tb-doc-hero{position:relative;display:flex;justify-content:space-between;gap:18px;align-items:flex-start;padding:18px;border-radius:22px;background:radial-gradient(circle at 15% 0%,rgba(120,119,198,.18),transparent 36%),radial-gradient(circle at 100% 0%,rgba(34,197,94,.13),transparent 34%);border:1px solid rgba(127,127,127,.18);}
      .tb-doc-kicker{text-transform:uppercase;letter-spacing:.14em;font-size:11px;font-weight:800;color:var(--muted,#6b7280);}
      .tb-doc-hero h2{margin:4px 0 4px;font-size:28px;line-height:1.05;}
      .tb-doc-hero p{margin:0;max-width:680px;color:var(--muted,#6b7280);font-size:14px;line-height:1.35;}
      .tb-doc-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end;}
      .tb-doc-layout{display:grid;grid-template-columns:245px minmax(0,1fr);gap:14px;margin-top:14px;}
      .tb-doc-sidebar,.tb-doc-main{border:1px solid rgba(127,127,127,.18);border-radius:20px;background:rgba(255,255,255,.62);padding:12px;}
      .dark .tb-doc-sidebar,.dark .tb-doc-main{background:rgba(255,255,255,.04);}
      .tb-doc-folder{width:100%;display:flex;justify-content:space-between;align-items:center;gap:8px;border:0;border-radius:14px;background:transparent;padding:10px 11px;text-align:left;cursor:pointer;color:inherit;}
      .tb-doc-folder:hover{background:rgba(127,127,127,.10);}
      .tb-doc-folder.active{background:rgba(79,70,229,.13);box-shadow:inset 0 0 0 1px rgba(79,70,229,.20);}
      .tb-doc-folder small{opacity:.62;}
      .tb-doc-toolbar{display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin-bottom:12px;}
      .tb-doc-search{min-width:220px;flex:1;max-width:420px;}
      .tb-doc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:12px;}
      .tb-doc-card{border:1px solid rgba(127,127,127,.18);border-radius:18px;background:rgba(255,255,255,.76);padding:12px;display:flex;flex-direction:column;gap:10px;min-height:168px;}
      .dark .tb-doc-card{background:rgba(255,255,255,.045);}
      .tb-doc-thumb{height:74px;border-radius:14px;background:linear-gradient(135deg,rgba(127,127,127,.12),rgba(127,127,127,.04));display:flex;align-items:center;justify-content:center;font-size:30px;overflow:hidden;}
      .tb-doc-thumb img{width:100%;height:100%;object-fit:cover;}
      .tb-doc-name{font-weight:800;line-height:1.15;word-break:break-word;}
      .tb-doc-meta{font-size:12px;color:var(--muted,#6b7280);display:flex;gap:6px;flex-wrap:wrap;}
      .tb-doc-card-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:auto;}
      .tb-doc-empty{border:1px dashed rgba(127,127,127,.30);border-radius:18px;padding:28px;text-align:center;color:var(--muted,#6b7280);}
      .tb-doc-preview-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.62);z-index:9999;display:flex;align-items:center;justify-content:center;padding:18px;}
      .tb-doc-preview{width:min(980px,96vw);height:min(780px,92vh);border-radius:22px;background:var(--card,#fff);box-shadow:0 24px 80px rgba(0,0,0,.35);display:flex;flex-direction:column;overflow:hidden;}
      .dark .tb-doc-preview{background:#15151d;color:#f8fafc;}
      .tb-doc-preview-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 14px;border-bottom:1px solid rgba(127,127,127,.18);}
      .tb-doc-preview-body{flex:1;min-height:0;background:rgba(127,127,127,.08);display:flex;align-items:center;justify-content:center;}
      .tb-doc-preview-body iframe{width:100%;height:100%;border:0;background:white;}
      .tb-doc-preview-body img{max-width:100%;max-height:100%;object-fit:contain;}
      .tb-doc-hidden-input{display:none!important;}
      .tb-doc-dropzone{border:1px dashed rgba(127,127,127,.34);border-radius:18px;padding:14px;margin-bottom:12px;background:rgba(127,127,127,.055);display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;}
      .tb-doc-dropzone:hover{background:rgba(79,70,229,.08);border-color:rgba(79,70,229,.35);}
      .tb-doc-dropzone strong{display:block;font-size:14px;}
      .tb-doc-dropzone span{display:block;font-size:12px;color:var(--muted,#6b7280);margin-top:2px;}
      .tb-doc-uploading{border:1px solid rgba(79,70,229,.22);background:rgba(79,70,229,.08);border-radius:14px;padding:10px 12px;margin-bottom:12px;font-size:13px;font-weight:700;}
      .tb-doc-tags{display:flex;gap:5px;flex-wrap:wrap;}
      .tb-doc-tag{font-size:11px;font-weight:700;border-radius:999px;padding:3px 7px;background:rgba(127,127,127,.12);}
      .tb-doc-expiry{font-size:12px;font-weight:800;border-radius:999px;padding:4px 8px;background:rgba(245,158,11,.12);color:#b45309;width:max-content;}
      .dark .tb-doc-expiry{color:#fbbf24;}
      .tb-doc-fav{border:0;background:transparent;font-size:20px;cursor:pointer;line-height:1;}
      .tb-doc-filters{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;}
      @media(max-width:820px){.tb-doc-hero{flex-direction:column}.tb-doc-layout{grid-template-columns:1fr}.tb-doc-actions{justify-content:flex-start}.tb-doc-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(st);
  }

  async function loadDocuments(){
    const c = client();
    if(!c) throw new Error('Client Supabase indisponible.');
    const foldersRes = await c.from(table('document_folders','document_folders')).select('*').order('name',{ascending:true});
    if(foldersRes.error) throw foldersRes.error;
    const docsRes = await c.from(table('documents','documents')).select('*').order('created_at',{ascending:false});
    if(docsRes.error) throw docsRes.error;
    CACHE.folders = foldersRes.data || [];
    CACHE.documents = docsRes.data || [];
    CACHE.selectedFolderId = selectedFolderId();
    if(CACHE.selectedFolderId && !CACHE.folders.some(f=>String(f.id)===String(CACHE.selectedFolderId))) setSelectedFolderId('');
    CACHE.error = '';
    return CACHE;
  }

  async function ensureLoaded(){
    CACHE.loading = true; renderShell();
    try { await loadDocuments(); }
    catch(e){ CACHE.error = e && (e.message || e.code) ? String(e.message || e.code) : String(e); console.warn('[TB][documents] load failed', e); }
    CACHE.loading = false; renderShell();
  }

  function folderCount(id){ return (CACHE.documents||[]).filter(d => String(d.folder_id||'') === String(id||'')).length; }
  function selectedFolder(){ return (CACHE.folders||[]).find(f=>String(f.id)===String(CACHE.selectedFolderId)); }
  function visibleDocs(){
  let rows = CACHE.documents || [];

  const folder = CACHE.selectedFolderId;
  if(folder) rows = rows.filter(d => String(d.folder_id||'') === String(folder));

  const q = String(CACHE.search || '').trim().toLowerCase();
  if(q){
    rows = rows.filter(d => {
      const tags = Array.isArray(d.tags) ? d.tags.join(' ') : '';
      return `${d.name||''} ${d.original_filename||''} ${d.mime_type||''} ${tags}`.toLowerCase().includes(q);
    });
  }

  if(CACHE.onlyFavorites){
    rows = rows.filter(d => !!d.is_favorite);
  }

  if(CACHE.onlyExpiring){
    const now = new Date();
    const limit = new Date();
    limit.setDate(limit.getDate() + 60);

    rows = rows.filter(d => {
      if(!d.expires_at) return false;
      const dt = new Date(d.expires_at);
      return dt >= now && dt <= limit;
    });
  }

  return rows;
}

 function renderFolders(){
  const folders = CACHE.folders || [];
  const allActive = !CACHE.selectedFolderId ? ' active' : '';
  return `<div class="tb-doc-sidebar">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
      <strong>Dossiers</strong>
      <button class="btn" type="button" onclick="window.tbDocumentsCreateFolder()">+ Dossier</button>
    </div>

    <button class="tb-doc-folder${allActive}" type="button" onclick="window.tbDocumentsSelectFolder('')">
      <span>📁 Tous les documents</span>
      <small>${esc((CACHE.documents||[]).length)}</small>
    </button>

    ${folders.map(f=>`
      <div style="display:flex;gap:6px;align-items:center;">
        <button class="tb-doc-folder${String(f.id)===String(CACHE.selectedFolderId)?' active':''}"
          type="button"
          style="flex:1;"
          onclick="window.tbDocumentsSelectFolder('${esc(f.id)}')">
          <span>📂 ${esc(f.name)}</span>
          <small>${esc(folderCount(f.id))}</small>
        </button>

        <button class="btn"
          type="button"
          title="Renommer"
          onclick="window.tbDocumentsRenameFolder('${esc(f.id)}')">
          ✏️
        </button>

        <button class="btn"
          type="button"
          title="Supprimer"
          onclick="window.tbDocumentsDeleteFolder('${esc(f.id)}')">
          🗑️
        </button>
      </div>
    `).join('')}
  </div>`;
}

  function renderDocCard(d){
  const name = d.name || d.original_filename || 'Document';
  const mime = d.mime_type || '';

  const icon =
    isPdf(mime,name)
      ? '📄'
      : (isImg(mime) ? '🖼️' : '📎');

  const moveOptions = [
    `<option value="">Non classé</option>`,
    ...(CACHE.folders || []).map(f=>`
      <option
        value="${esc(f.id)}"
        ${String(f.id)===String(d.folder_id||'')?'selected':''}>
        ${esc(f.name)}
      </option>
    `)
  ].join('');

  const thumb = isImg(mime)
    ? `<div class="tb-doc-thumb" data-thumb-path="${esc(d.storage_path)}" data-thumb-bucket="${esc(d.storage_bucket || BUCKET)}">${icon}</div>`
    : `<div class="tb-doc-thumb">${icon}</div>`;

  const tags = Array.isArray(d.tags) ? d.tags : [];
  const expiry = fmtExpiry(d.expires_at);

  return `<article class="tb-doc-card" data-doc-id="${esc(d.id)}">
    <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start;">
      ${thumb}
      <button class="tb-doc-fav"
        type="button"
        title="Favori"
        onclick="window.tbDocumentsToggleFavorite('${esc(d.id)}')">
        ${d.is_favorite ? '⭐' : '☆'}
      </button>
    </div>

    <div class="tb-doc-name">${esc(name)}</div>

    <div class="tb-doc-meta">
      <span>${esc(fmtDate(d.created_at))}</span>
      <span>·</span>
      <span>${esc(fmtSize(d.size_bytes))}</span>
    </div>

    ${tags.length ? `<div class="tb-doc-tags">${tags.map(t=>`<span class="tb-doc-tag">${esc(t)}</span>`).join('')}</div>` : ''}

    ${expiry ? `<div class="tb-doc-expiry">${esc(expiry)}</div>` : ''}

    <select class="input"
      title="Déplacer vers"
      onchange="window.tbDocumentsMove('${esc(d.id)}', this.value)">
      ${moveOptions}
    </select>

    <div class="tb-doc-card-actions">
      <button class="btn primary" type="button" onclick="window.tbDocumentsPreview('${esc(d.id)}')">Ouvrir</button>
      <button class="btn" type="button" onclick="window.tbDocumentsRename('${esc(d.id)}')">Renommer</button>
      <button class="btn" type="button" onclick="window.tbDocumentsEditMeta('${esc(d.id)}')">Infos</button>
      <button class="btn" type="button" onclick="window.tbDocumentsDelete('${esc(d.id)}')">Supprimer</button>
    </div>
  </article>`;
}

  function renderMain(){
  const folder = selectedFolder();

  let docs = visibleDocs();

  const sort = selectedSort();

  docs = [...docs].sort((a,b)=>{
    if(sort === 'name_asc'){
      return String(a.name||'').localeCompare(String(b.name||''), 'fr');
    }

    if(sort === 'size_desc'){
      return Number(b.size_bytes||0) - Number(a.size_bytes||0);
    }

    return new Date(b.created_at||0) - new Date(a.created_at||0);
  });

  return `<div class="tb-doc-main"
    ondragover="event.preventDefault()"
    ondrop="event.preventDefault(); window.tbDocumentsHandleDrop(event)">

    <div class="tb-doc-toolbar">
      <div>
        <strong>${esc(folder ? folder.name : 'Tous les documents')}</strong>
        <div class="muted" style="font-size:12px;">
          ${esc(docs.length)} document(s)
        </div>
      </div>

      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        <select class="input"
          onchange="window.tbDocumentsSetSort(this.value)">
          <option value="date_desc" ${sort==='date_desc'?'selected':''}>
            Plus récents
          </option>
          <option value="name_asc" ${sort==='name_asc'?'selected':''}>
            Nom A → Z
          </option>
          <option value="size_desc" ${sort==='size_desc'?'selected':''}>
            Taille
          </option>
        </select>

        <input
          id="tb-doc-search"
          class="tb-doc-search"
          type="search"
          value="${esc(CACHE.search||'')}"
          placeholder="Rechercher par nom…"
          oninput="window.tbDocumentsSetSearch(this.value)"
        />
      </div>
    </div>

    <div class="tb-doc-dropzone"
      onclick="document.getElementById('tb-doc-file-input')?.click()">
      <div>
        <strong>Glisse tes PDF ou images ici</strong>
        <span>${esc(folder ? `Ajout dans « ${folder.name} »` : 'Ajout dans Non classé')}</span>
      </div>
      <button class="btn primary" type="button">Ajouter</button>
    </div>
    <div class="tb-doc-filters">
  <button class="btn ${CACHE.onlyFavorites ? 'primary' : ''}" type="button" onclick="window.tbDocumentsToggleFavoritesFilter()">
    ⭐ Favoris
  </button>
  <button class="btn ${CACHE.onlyExpiring ? 'primary' : ''}" type="button" onclick="window.tbDocumentsToggleExpiringFilter()">
    ⏳ Expire bientôt
  </button>
</div>

    ${CACHE.uploading ? `<div class="tb-doc-uploading">${esc(CACHE.uploading)}</div>` : ''}

    ${CACHE.loading ? '<div class="tb-doc-empty">Chargement des documents…</div>' : ''}

    ${CACHE.error ? `
      <div class="tb-doc-empty">
        <strong>Module Documents non initialisé.</strong>
        <br><br>
        ${esc(CACHE.error)}
        <br><br>
        <span>
          Applique d’abord le patch SQL V9.6.5,
          puis recharge l’application.
        </span>
      </div>
    ` : ''}

    ${(!CACHE.loading && !CACHE.error && !docs.length)
      ? '<div class="tb-doc-empty">Aucun document ici.</div>'
      : ''}

    ${(!CACHE.loading && !CACHE.error && docs.length)
      ? `<div class="tb-doc-grid">${docs.map(renderDocCard).join('')}</div>`
      : ''}
  </div>`;
}

  function renderShell(){
    injectStyles();
    const el = root(); if(!el) return;
    el.className = 'card tb-doc-shell';
    el.innerHTML = `<div class="tb-doc-hero">
      <div><div class="tb-doc-kicker">Coffre documentaire</div><h2>Documents</h2><p>Un espace simple pour stocker, nommer et retrouver tes documents personnels. V1 volontairement légère : dossiers, upload, preview, renommage.</p></div>
      <div class="tb-doc-actions">
        <button class="btn" type="button" onclick="window.tbDocumentsCreateFolder()">+ Dossier</button>
        <button class="btn primary" type="button" onclick="document.getElementById('tb-doc-file-input')?.click()">+ Ajouter document</button>
        <input id="tb-doc-file-input" class="tb-doc-hidden-input" type="file" multiple accept="application/pdf,image/*" onchange="window.tbDocumentsUpload(this.files); this.value=''" />
      </div>
    </div>
    <div class="tb-doc-layout">${renderFolders()}${renderMain()}</div>`;
    setTimeout(hydrateImageThumbs, 0);
  }

  async function hydrateImageThumbs(){
  const c = client();
  if(!c) return;

  const nodes = Array.from(document.querySelectorAll('.tb-doc-thumb[data-thumb-path]'));

  for(const node of nodes){
    if(node.dataset.loaded === '1') continue;

    const path = node.getAttribute('data-thumb-path');
    const bucket = node.getAttribute('data-thumb-bucket') || BUCKET;
    if(!path) continue;

    try{
      const res = await c.storage.from(bucket).createSignedUrl(path, 60 * 10);
      if(res.error) throw res.error;

      const url = res.data && res.data.signedUrl;
      if(!url) continue;

      node.dataset.loaded = '1';
      node.innerHTML = `<img src="${esc(url)}" alt="" loading="lazy" />`;
    }catch(e){
      console.warn('[TB][documents] thumbnail failed', e);
    }
  }
}

  async function createFolder(){
    const c = client(); if(!c) return alert('Client Supabase indisponible.');
    const name = String(prompt('Nom du dossier ?') || '').trim(); if(!name) return;
    const uid = await currentUserId(); if(!uid) return alert('Utilisateur non connecté.');
    const { error } = await c.from(table('document_folders','document_folders')).insert({ user_id: uid, name });
    if(error) return alert(error.message || String(error));
    await ensureLoaded();
  }

  function cleanFilename(name){ return String(name||'document').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'').slice(0,120) || 'document'; }
  function extFromName(name){ const m = String(name||'').match(/\.([a-z0-9]{1,8})$/i); return m ? `.${m[1].toLowerCase()}` : ''; }

  async function upload(files){
  const list = Array.from(files || []); if(!list.length) return;
  const c = client(); if(!c) return alert('Client Supabase indisponible.');
  const uid = await currentUserId(); if(!uid) return alert('Utilisateur non connecté.');
  const folderId = CACHE.selectedFolderId || null;

  let done = 0;
  CACHE.uploading = `${list.length} fichier(s) en upload…`;
  renderShell();

  for(const file of list){
    try{
      done += 1;
      CACHE.uploading = `Upload ${done}/${list.length} — ${file.name || 'document'}`;
      renderShell();

      const docId = (crypto && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const safe = cleanFilename(file.name || 'document');
      const path = `${uid}/${docId}/${safe}`;
      const up = await c.storage.from(BUCKET).upload(path, file, { upsert:false, contentType:file.type || undefined });
      if(up.error) throw up.error;

      const baseName = String(file.name || 'Document').replace(/\.[a-z0-9]{1,8}$/i,'');

      const ins = await c.from(table('documents','documents')).insert({
        id: docId,
        user_id: uid,
        folder_id: folderId,
        name: baseName || 'Document',
        original_filename: file.name || safe,
        storage_bucket: BUCKET,
        storage_path: path,
        mime_type: file.type || '',
        size_bytes: file.size || 0
      });

      if(ins.error) throw ins.error;
    }catch(e){
      console.warn('[TB][documents] upload failed', e);
      alert(`Upload impossible pour ${file.name || 'document'} : ${e.message || e}`);
    }
  }

  CACHE.uploading = '';
  await ensureLoaded();
}

  async function signedUrl(doc){
    const c = client(); if(!c) throw new Error('Client Supabase indisponible.');
    const res = await c.storage.from(doc.storage_bucket || BUCKET).createSignedUrl(doc.storage_path, 60 * 10);
    if(res.error) throw res.error;
    return res.data && res.data.signedUrl;
  }

  async function preview(id){
    const doc = (CACHE.documents||[]).find(d=>String(d.id)===String(id)); if(!doc) return;
    try{
      const url = await signedUrl(doc);
      const name = doc.name || doc.original_filename || 'Document';
      const body = isImg(doc.mime_type) ? `<img src="${esc(url)}" alt="${esc(name)}" />` : (isPdf(doc.mime_type, doc.original_filename) ? `<iframe src="${esc(url)}" title="${esc(name)}"></iframe>` : `<div style="padding:24px;text-align:center;"><p>Aperçu non disponible pour ce type de fichier.</p><a class="btn primary" href="${esc(url)}" target="_blank" rel="noopener">Ouvrir / télécharger</a></div>`);
      const wrap = document.createElement('div');
      wrap.className = 'tb-doc-preview-backdrop';
      wrap.onclick = (e)=>{ if(e.target === wrap) wrap.remove(); };
      wrap.innerHTML = `<div class="tb-doc-preview"><div class="tb-doc-preview-head"><strong>${esc(name)}</strong><div style="display:flex;gap:8px;"><a class="btn" href="${esc(url)}" target="_blank" rel="noopener">Nouvel onglet</a><button class="btn" type="button" onclick="this.closest('.tb-doc-preview-backdrop').remove()">Fermer</button></div></div><div class="tb-doc-preview-body">${body}</div></div>`;
      document.body.appendChild(wrap);
    }catch(e){ alert(e.message || String(e)); }
  }

  async function rename(id){
    const c = client(); if(!c) return alert('Client Supabase indisponible.');
    const doc = (CACHE.documents||[]).find(d=>String(d.id)===String(id)); if(!doc) return;
    const name = String(prompt('Nouveau nom du document ?', doc.name || doc.original_filename || '') || '').trim(); if(!name) return;
    const { error } = await c.from(table('documents','documents')).update({ name }).eq('id', id);
    if(error) return alert(error.message || String(error));
    await ensureLoaded();
  }

  async function removeDoc(id){
    const c = client(); if(!c) return alert('Client Supabase indisponible.');
    const doc = (CACHE.documents||[]).find(d=>String(d.id)===String(id)); if(!doc) return;
    if(!confirm(`Supprimer « ${doc.name || doc.original_filename || 'Document'} » ?`)) return;
    try{ await c.storage.from(doc.storage_bucket || BUCKET).remove([doc.storage_path]); }catch(e){ console.warn('[TB][documents] storage remove failed', e); }
    const { error } = await c.from(table('documents','documents')).delete().eq('id', id);
    if(error) return alert(error.message || String(error));
    await ensureLoaded();
  }

  async function renameFolder(id){
  const c = client();
  if(!c) return alert('Client Supabase indisponible.');

  const folder = (CACHE.folders||[]).find(f=>String(f.id)===String(id));
  if(!folder) return;

  const name = String(prompt('Nouveau nom du dossier ?', folder.name || '') || '').trim();
  if(!name) return;

  const { error } = await c
    .from(table('document_folders','document_folders'))
    .update({ name })
    .eq('id', id);

  if(error) return alert(error.message || String(error));

  await ensureLoaded();
}

async function deleteFolder(id){
  const c = client();
  if(!c) return alert('Client Supabase indisponible.');

  const folder = (CACHE.folders||[]).find(f=>String(f.id)===String(id));
  if(!folder) return;

  const count = folderCount(id);

  if(count > 0){
    return alert('Ce dossier contient encore des documents. Déplace ou supprime-les avant de supprimer le dossier.');
  }

  if(!confirm(`Supprimer le dossier « ${folder.name} » ?`)) return;

  const { error } = await c
    .from(table('document_folders','document_folders'))
    .delete()
    .eq('id', id);

  if(error) return alert(error.message || String(error));

  if(String(CACHE.selectedFolderId) === String(id)){
    setSelectedFolderId('');
  }

  await ensureLoaded();
}
  window.tbDocumentsSetSort = function(v){
  setSelectedSort(v);
  renderShell();
};
  async function moveDocument(id, folderId){
  const c = client();

  if(!c){
    return alert('Client Supabase indisponible.');
  }

  const { error } = await c
    .from(table('documents','documents'))
    .update({
      folder_id: folderId || null
    })
    .eq('id', id);

  if(error){
    return alert(error.message || String(error));
  }

  await ensureLoaded();
}
  async function toggleFavorite(id){
  const c = client();
  if(!c) return alert('Client Supabase indisponible.');

  const doc = (CACHE.documents||[]).find(d=>String(d.id)===String(id));
  if(!doc) return;

  const { error } = await c
    .from(table('documents','documents'))
    .update({ is_favorite: !doc.is_favorite })
    .eq('id', id);

  if(error) return alert(error.message || String(error));

  await ensureLoaded();
}

async function editMeta(id){
  const c = client();
  if(!c) return alert('Client Supabase indisponible.');

  const doc = (CACHE.documents||[]).find(d=>String(d.id)===String(id));
  if(!doc) return;

  const currentTags = Array.isArray(doc.tags) ? doc.tags.join(', ') : '';
  const tagsInput = prompt('Tags séparés par des virgules :', currentTags);
  if(tagsInput === null) return;

  const currentExpiry = doc.expires_at ? String(doc.expires_at).slice(0,10) : '';
  const expiryInput = prompt('Date d’expiration au format YYYY-MM-DD, ou vide :', currentExpiry);
  if(expiryInput === null) return;

  const expires_at = String(expiryInput || '').trim() || null;

  if(expires_at && !/^\d{4}-\d{2}-\d{2}$/.test(expires_at)){
    return alert('Format invalide. Utilise YYYY-MM-DD, par exemple 2027-05-31.');
  }

  const { error } = await c
    .from(table('documents','documents'))
    .update({
      tags: normalizeTags(tagsInput),
      expires_at
    })
    .eq('id', id);

  if(error) return alert(error.message || String(error));

  await ensureLoaded();
}
  window.renderDocuments = function renderDocuments(){ ensureLoaded(); };
  window.tbDocumentsRenderOnly = renderShell;
  window.tbDocumentsSetSearch = function(v){ CACHE.search = String(v || ''); renderShell(); }; 
  window.tbDocumentsSelectFolder = function(id){ setSelectedFolderId(id); renderShell(); };
  window.tbDocumentsCreateFolder = createFolder;
  window.tbDocumentsUpload = upload;
  window.tbDocumentsPreview = preview;
  window.tbDocumentsRename = rename;
  window.tbDocumentsRenameFolder = renameFolder;
  window.tbDocumentsDeleteFolder = deleteFolder;
  window.tbDocumentsDelete = removeDoc;
  window.tbDocumentsMove = moveDocument;
  window.tbDocumentsHandleDrop = function(event){
  const files = event && event.dataTransfer && event.dataTransfer.files
    ? event.dataTransfer.files
    : null;

  if(files && files.length){
    upload(files);
  }
};
window.tbDocumentsToggleFavorite = toggleFavorite;
window.tbDocumentsEditMeta = editMeta;

window.tbDocumentsToggleFavoritesFilter = function(){
  CACHE.onlyFavorites = !CACHE.onlyFavorites;
  renderShell();
};

window.tbDocumentsToggleExpiringFilter = function(){
  CACHE.onlyExpiring = !CACHE.onlyExpiring;
  renderShell();
};
})();
