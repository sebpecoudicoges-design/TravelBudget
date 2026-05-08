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
  tagFilter: '',
  uploading: '',
  onlyFavorites: false,
  onlyExpiring: false,
  collapsedFolderIds: [],
  selectedIds: []
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
  const core = window.Core?.documentRules;
  if(core?.normalizeTags) return core.normalizeTags(v);
  return String(v || '')
    .split(',')
    .map(x => x.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function tagKey(v){
  const core = window.Core?.documentRules;
  if(core?.tagKey) return core.tagKey(v);
  return String(v || '').trim().toLowerCase();
}

function docTags(doc){
  const core = window.Core?.documentRules;
  if(core?.docTags) return core.docTags(doc);
  return Array.isArray(doc?.tags) ? doc.tags.map(String).filter(Boolean) : [];
}

function allDocumentTags(){
  const core = window.Core?.documentRules;
  if(core?.allDocumentTags) return core.allDocumentTags(CACHE.documents || []);
  const map = new Map();
  for(const doc of (CACHE.documents || [])){
    for(const tag of docTags(doc)){
      const key = tagKey(tag);
      if(key && !map.has(key)) map.set(key, tag);
    }
  }
  return Array.from(map.values()).sort((a,b)=>String(a).localeCompare(String(b), 'fr'));
}

function selectedTagFilter(){
  try {
    return CACHE.tagFilter || localStorage.getItem(key('documents_tag','travelbudget_documents_tag_v1')) || '';
  } catch(_) {
    return CACHE.tagFilter || '';
  }
}

function setSelectedTagFilter(v){
  CACHE.tagFilter = String(v || '').trim();
  try {
    localStorage.setItem(key('documents_tag','travelbudget_documents_tag_v1'), CACHE.tagFilter);
  } catch(_) {}
}

function normalizeLookupText(v){
  const core = window.Core?.documentRules;
  if(core?.normalizeLookupText) return core.normalizeLookupText(v);
  return String(v || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function normalizeTagMatchText(v){
  const core = window.Core?.documentRules;
  if(core?.normalizeTagMatchText) return core.normalizeTagMatchText(v);
  return normalizeLookupText(v)
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanDocBaseName(doc){
  const core = window.Core?.documentRules;
  if(core?.cleanDocBaseName) return core.cleanDocBaseName(doc);
  return String(doc?.name || doc?.original_filename || '')
    .replace(/\.[a-z0-9]{1,8}$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleTag(v){
  const core = window.Core?.documentRules;
  if(core?.titleTag) return core.titleTag(v);
  const raw = String(v || '').replace(/\s+/g, ' ').trim();
  if(!raw) return '';
  if(/[A-Z]{2,}/.test(raw)) return raw;
  return raw.replace(/\b[\p{L}\p{N}][\p{L}\p{N}'-]*/gu, word => {
    const lower = word.toLowerCase();
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  });
}

function suggestEmployerFromPayrollName(doc){
  const core = window.Core?.documentRules;
  if(core?.suggestEmployerFromPayrollName) return core.suggestEmployerFromPayrollName(doc);
  const raw = cleanDocBaseName(doc);
  const lookup = normalizeLookupText(raw);
  if(!/(bulletin de paie|fiche de paie|payslip|pay slip|salaire|paie)/.test(lookup)) return '';

  let candidate = raw;
  candidate = candidate.replace(/.*?(bulletin\s+de\s+paie|fiche\s+de\s+paie|payslip|pay\s+slip|salaire|paie)/i, '');
  candidate = candidate.replace(/\b(janvier|fevrier|février|mars|avril|mai|mais|juin|juillet|aout|août|septembre|octobre|novembre|decembre|décembre|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/ig, ' ');
  candidate = candidate.replace(/\b(19|20)\d{2}\b/g, ' ');
  candidate = candidate.replace(/\b\d{1,2}\b/g, ' ');
  candidate = candidate.replace(/^[\s,.;:()'"]+|[\s,.;:()'"]+$/g, '').replace(/\s+/g, ' ').trim();

  if(candidate.length < 3) return '';
  if(candidate.split(/\s+/).length > 5) return '';
  return titleTag(candidate);
}

function suggestExistingTagsFromName(doc){
  const core = window.Core?.documentRules;
  if(core?.suggestExistingTagsFromName) return core.suggestExistingTagsFromName(doc, allDocumentTags());
  const name = normalizeTagMatchText(`${doc?.name || ''} ${doc?.original_filename || ''}`);
  if(!name) return [];

  return allDocumentTags()
    .filter(tag => {
      const tagText = normalizeTagMatchText(tag);
      if(!tagText || tagText.length < 2) return false;
      return (` ${name} `).includes(` ${tagText} `);
    })
    .sort((a,b) => {
      const aw = normalizeTagMatchText(a).split(' ').length;
      const bw = normalizeTagMatchText(b).split(' ').length;
      return aw - bw || String(a).localeCompare(String(b), 'fr');
    });
}

function suggestTagsForDocument(doc){
  const core = window.Core?.documentRules;
  if(core?.suggestTagsForDocument) return core.suggestTagsForDocument(doc, { knownTags: allDocumentTags() });
  const name = normalizeLookupText(`${doc?.name || ''} ${doc?.original_filename || ''}`);
  const mime = String(doc?.mime_type || '').toLowerCase();
  const out = [];
  const add = (tag) => {
    const key = tagKey(tag);
    if(!key) return;
    if(out.some(x => tagKey(x) === key)) return;
    if(docTags(doc).some(x => tagKey(x) === key)) return;
    out.push(tag);
  };

  for(const tag of suggestExistingTagsFromName(doc)) add(tag);

  const rules = [
    ['Bulletin de Paie', ['bulletin de paie','fiche de paie','payslip','pay slip']],
    ['STC', ['solde de tout compte','stc']],
    ['Passeport', ['passeport','passport']],
    ['Visa', ['visa','eta','esta']],
    ['Banque', ['banque','bank','rib','iban','releve','statement','account']],
    ['Assurance', ['assurance','insurance','attestation']],
    ['Sante', ['sante','health','medical','vaccin','ordonnance']],
    ['Transport', ['billet','ticket','flight','vol','train','bus','boarding','embarquement']],
    ['Logement', ['hotel','booking','airbnb','reservation','bail','lease']],
    ['Identite', ['identite','identity','id-card','idcard','carte-identite']],
    ['Permis', ['permis','licence','license','driver']],
    ['Impots', ['impot','tax','fiscal']],
    ['Facture', ['facture','invoice','receipt','recu']],
    ['Contrat', ['contrat','contract']],
  ];

  for(const [tag, needles] of rules){
    if(needles.some(n => name.includes(n))) add(tag);
  }

  const employer = suggestEmployerFromPayrollName(doc);
  if(employer) add(employer);

  const hasMeaningfulSuggestion = out.length > 0;
  if(!hasMeaningfulSuggestion && (/pdf/i.test(mime) || /\.pdf$/i.test(String(doc?.original_filename || '')))) add('PDF');
  if(!hasMeaningfulSuggestion && /^image\//i.test(mime)) add('Image');

  return out.slice(0, 6);
}
  function isSelected(id){
  return (CACHE.selectedIds || []).some(x => String(x) === String(id));
}

function selectedDocs(){
  const ids = new Set((CACHE.selectedIds || []).map(String));
  return (CACHE.documents || []).filter(d => ids.has(String(d.id)));
}

function clearSelection(){
  CACHE.selectedIds = [];
  renderShell();
}

function collapsedFolderIds(){
  try {
    const raw = localStorage.getItem(key('documents_collapsed_folders','travelbudget_documents_collapsed_folders_v1')) || '[]';
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.map(String) : [];
  } catch(_) {
    return Array.isArray(CACHE.collapsedFolderIds) ? CACHE.collapsedFolderIds.map(String) : [];
  }
}

function setCollapsedFolderIds(ids){
  const core = window.Core?.documentRules;
  CACHE.collapsedFolderIds = core?.normalizeCollapsedFolderIds
    ? core.normalizeCollapsedFolderIds(ids)
    : Array.from(new Set((ids || []).map(String).filter(Boolean)));
  try {
    localStorage.setItem(key('documents_collapsed_folders','travelbudget_documents_collapsed_folders_v1'), JSON.stringify(CACHE.collapsedFolderIds));
  } catch(_) {}
}

function isFolderCollapsed(id){
  return collapsedFolderIds().includes(String(id || ''));
}

function toggleFolderCollapsed(id){
  const sid = String(id || '');
  if(!sid) return;
  const core = window.Core?.documentRules;
  const ids = collapsedFolderIds();
  const next = core?.toggleCollapsedFolderId
    ? core.toggleCollapsedFolderId(ids, sid)
    : (ids.includes(sid) ? ids.filter(x => x !== sid) : [...ids, sid]);
  setCollapsedFolderIds(next);
  renderShell();
}

function selectVisibleDocuments(){
  const docs = visibleDocs();
  const core = window.Core?.documentRules;
  if(core?.selectVisibleDocumentIds){
    CACHE.selectedIds = core.selectVisibleDocumentIds(CACHE.selectedIds || [], docs);
  } else {
    const ids = new Set((CACHE.selectedIds || []).map(String));
    for(const doc of docs) ids.add(String(doc.id));
    CACHE.selectedIds = Array.from(ids);
  }
  renderShell();
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
      .tb-doc-card > select.input{display:none;}
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
      .tb-doc-note{font-size:12px;color:var(--muted,#6b7280);line-height:1.25;border-left:3px solid rgba(127,127,127,.22);padding-left:8px;}
      .tb-doc-modal-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.58);z-index:10000;display:flex;align-items:center;justify-content:center;padding:18px;}
      .tb-doc-modal{width:min(520px,96vw);border-radius:22px;background:var(--card,#fff);box-shadow:0 24px 80px rgba(0,0,0,.35);padding:16px;}
      .dark .tb-doc-modal{background:#15151d;color:#f8fafc;}
      .tb-doc-modal h3{margin:0 0 12px;font-size:20px;}
      .tb-doc-form{display:flex;flex-direction:column;gap:10px;}
      .tb-doc-form label{font-size:12px;font-weight:800;color:var(--muted,#6b7280);}
      .tb-doc-form input,.tb-doc-form textarea,.tb-doc-form select{width:100%;}
      .tb-doc-form textarea{min-height:92px;resize:vertical;}
      .tb-doc-modal-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:14px;}
      .tb-doc-modal-actions.between{justify-content:space-between;align-items:center;flex-wrap:wrap;}
      .tb-doc-select{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:800;}
      .tb-doc-batchbar{position:sticky;top:8px;z-index:20;margin-bottom:12px;border:1px solid rgba(79,70,229,.22);background:rgba(79,70,229,.10);backdrop-filter:blur(10px);border-radius:16px;padding:10px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;}
      .tb-doc-batchbar strong{font-size:13px;}
      .tb-doc-share-links{display:flex;flex-direction:column;gap:8px;margin-top:10px;max-height:220px;overflow:auto;}
      .tb-doc-share-link{font-size:12px;word-break:break-all;border:1px solid rgba(127,127,127,.18);border-radius:12px;padding:8px;background:rgba(127,127,127,.06);}
      .tb-doc-share-body{width:100%;min-height:170px;margin-top:10px;font-size:12px;line-height:1.35;}
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
  function rootFolders(){
    const core = window.Core?.documentRules;
    if(core?.rootFolders) return core.rootFolders(CACHE.folders || []);
    return (CACHE.folders || []).filter(f => !f.parent_id);
  }
  function childFolders(parentId){
    const core = window.Core?.documentRules;
    if(core?.childFolders) return core.childFolders(CACHE.folders || [], parentId);
    return (CACHE.folders || []).filter(f => String(f.parent_id || '') === String(parentId || ''));
  }
  function folderLabel(folder){
    const core = window.Core?.documentRules;
    if(core?.folderLabel) return core.folderLabel(folder, CACHE.folders || []);
    if(!folder) return 'Non classe';
    const parent = folder.parent_id ? (CACHE.folders || []).find(f => String(f.id) === String(folder.parent_id)) : null;
    return parent ? `${parent.name} / ${folder.name}` : folder.name;
  }
  function folderOptionsHTML(selectedId){
    const selected = String(selectedId || '');
    const roots = rootFolders();
    const out = [`<option value="" ${!selected ? 'selected' : ''}>Non classe</option>`];
    for(const f of roots){
      out.push(`<option value="${esc(f.id)}" ${String(f.id)===selected?'selected':''}>${esc(f.name)}</option>`);
      for(const sub of childFolders(f.id)){
        out.push(`<option value="${esc(sub.id)}" ${String(sub.id)===selected?'selected':''}>- ${esc(f.name)} / ${esc(sub.name)}</option>`);
      }
    }
    return out.join('');
  }
  function visibleDocs(){
  const core = window.Core?.documentRules;
  if(core?.filterVisibleDocuments){
    return core.filterVisibleDocuments(CACHE.documents || [], {
      selectedFolderId: CACHE.selectedFolderId,
      search: CACHE.search,
      tagFilter: selectedTagFilter(),
      onlyFavorites: CACHE.onlyFavorites,
      onlyExpiring: CACHE.onlyExpiring
    });
  }

  let rows = CACHE.documents || [];

  const folder = CACHE.selectedFolderId;
  if(folder) rows = rows.filter(d => String(d.folder_id||'') === String(folder));

  const q = String(CACHE.search || '').trim().toLowerCase();
  if(q){
    rows = rows.filter(d => {
      const tags = docTags(d).join(' ');
      return `${d.name||''} ${d.original_filename||''} ${d.mime_type||''} ${tags}`.toLowerCase().includes(q);
    });
  }

  const tag = selectedTagFilter();
  if(tag){
    const wanted = tagKey(tag);
    rows = rows.filter(d => docTags(d).some(t => tagKey(t) === wanted));
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
  const folders = rootFolders();
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

    ${folders.map(f=>{
      const children = childFolders(f.id);
      const collapsed = isFolderCollapsed(f.id);
      return `
      <div style="display:flex;gap:6px;align-items:center;">
        ${children.length ? `<button class="btn" type="button" title="${collapsed ? 'Deplier' : 'Replier'}" onclick="window.tbDocumentsToggleFolderCollapsed('${esc(f.id)}')">${collapsed ? '+' : '-'}</button>` : `<span style="width:34px;"></span>`}
        <button class="tb-doc-folder${String(f.id)===String(CACHE.selectedFolderId)?' active':''}"
          type="button"
          style="flex:1;"
          onclick="window.tbDocumentsSelectFolder('${esc(f.id)}')">
          <span>📂 ${esc(f.name)}</span>
          <small>${esc(folderCount(f.id))}</small>
        </button>

        <button class="btn"
          type="button"
          title="Sous-dossier"
          onclick="window.tbDocumentsCreateSubFolder('${esc(f.id)}')">
          +
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
      ${collapsed ? '' : children.map(sub => `
        <div style="display:flex;gap:6px;align-items:center;margin-left:18px;">
          <button class="tb-doc-folder${String(sub.id)===String(CACHE.selectedFolderId)?' active':''}"
            type="button"
            style="flex:1;"
            onclick="window.tbDocumentsSelectFolder('${esc(sub.id)}')">
            <span>-- ${esc(sub.name)}</span>
            <small>${esc(folderCount(sub.id))}</small>
          </button>
          <button class="btn" type="button" title="Renommer" onclick="window.tbDocumentsRenameFolder('${esc(sub.id)}')">Edit</button>
          <button class="btn" type="button" title="Supprimer" onclick="window.tbDocumentsDeleteFolder('${esc(sub.id)}')">Del</button>
        </div>
      `).join('')}
    `}).join('')}
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
  const notePreview = String(d.notes || '').trim();

  return `<article class="tb-doc-card" data-doc-id="${esc(d.id)}">
    <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start;">
  <label class="tb-doc-select">
    <input type="checkbox"
      ${isSelected(d.id) ? 'checked' : ''}
      onchange="window.tbDocumentsToggleSelect('${esc(d.id)}')" />
  </label>

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
    ${notePreview ? `<div class="tb-doc-note">${esc(notePreview.length > 90 ? notePreview.slice(0,90) + '…' : notePreview)}</div>` : ''}

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
  const tags = allDocumentTags();
  const tagFilter = selectedTagFilter();

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
      <button class="btn primary" type="button" onclick="event.stopPropagation(); document.getElementById('tb-doc-file-input')?.click()">Ajouter</button>
    </div>
    <div class="tb-doc-filters">
  <select class="input" onchange="window.tbDocumentsSetTagFilter(this.value)" title="Filtrer par tag">
    <option value="" ${!tagFilter ? 'selected' : ''}>Tous les tags</option>
    ${tags.map(t => `<option value="${esc(t)}" ${tagKey(t) === tagKey(tagFilter) ? 'selected' : ''}>${esc(t)}</option>`).join('')}
  </select>
  <button class="btn ${CACHE.onlyFavorites ? 'primary' : ''}" type="button" onclick="window.tbDocumentsToggleFavoritesFilter()">
    ⭐ Favoris
  </button>
  <button class="btn ${CACHE.onlyExpiring ? 'primary' : ''}" type="button" onclick="window.tbDocumentsToggleExpiringFilter()">
    ⏳ Expire bientôt
  </button>
  ${tagFilter ? `<button class="btn" type="button" onclick="window.tbDocumentsSetTagFilter('')">Tag: ${esc(tagFilter)} x</button>` : ''}
</div>
    ${(CACHE.selectedIds || []).length ? `
  <div class="tb-doc-batchbar">
    <strong>${esc((CACHE.selectedIds || []).length)} document(s) sélectionné(s)</strong>
    <div style="display:flex;gap:6px;flex-wrap:wrap;">
      <button class="btn" type="button" onclick="window.tbDocumentsSelectVisible()">Tout sélectionner</button>
      <button class="btn primary" type="button" onclick="window.tbDocumentsShareSelected()">Partager</button>
      <button class="btn" type="button" onclick="window.tbDocumentsAddTagSelected()">Ajouter tag</button>
      <button class="btn" type="button" onclick="window.tbDocumentsMoveSelected()">Déplacer</button>
      <button class="btn" type="button" onclick="window.tbDocumentsDeleteSelected()">Supprimer</button>
      <button class="btn" type="button" onclick="window.tbDocumentsClearSelection()">Annuler</button>
    </div>
  </div>
` : ''}
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

  async function createFolder(parentId = null){
    const c = client(); if(!c) return alert('Client Supabase indisponible.');
    const name = String(prompt('Nom du dossier ?') || '').trim(); if(!name) return;
    const uid = await currentUserId(); if(!uid) return alert('Utilisateur non connecté.');
    const guard = window.Core?.documentRules?.canCreateSubFolder
      ? window.Core.documentRules.canCreateSubFolder(parentId, CACHE.folders || [])
      : { ok: true };
    if(!guard.ok) return alert(guard.reason || 'Sous-dossier invalide.');
    const { error } = await c.from(table('document_folders','document_folders')).insert({ user_id: uid, name, parent_id: parentId || null });
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
  const uploadedIds = [];
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
      uploadedIds.push(docId);
    }catch(e){
      console.warn('[TB][documents] upload failed', e);
      alert(`Upload impossible pour ${file.name || 'document'} : ${e.message || e}`);
    }
  }

  CACHE.uploading = '';
  await ensureLoaded();
  if(uploadedIds.length === 1){
    const doc = (CACHE.documents || []).find(d => String(d.id) === String(uploadedIds[0]));
    if(doc) setTimeout(() => openInfoModal(doc), 0);
  }
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

function openInfoModal(doc){
  const currentTags = Array.isArray(doc.tags) ? doc.tags.join(', ') : '';
  const currentExpiry = doc.expires_at ? String(doc.expires_at).slice(0,10) : '';
  const currentNotes = String(doc.notes || '');
  const suggestions = suggestTagsForDocument(doc);

  const wrap = document.createElement('div');
  wrap.className = 'tb-doc-modal-backdrop';
  wrap.onclick = (e)=>{ if(e.target === wrap) wrap.remove(); };

  wrap.innerHTML = `
    <div class="tb-doc-modal">
      <h3>Infos document</h3>

      <div class="tb-doc-form">
        <div>
          <label>Tags</label>
          <input id="tb-doc-info-tags" class="input" type="text" value="${esc(currentTags)}" placeholder="Australie, WHV, Banque" />
          ${suggestions.length ? `
            <div class="tb-doc-tags" style="margin-top:8px;">
              ${suggestions.map(t => `<button class="btn" type="button" data-tag="${esc(t)}" onclick="window.tbDocumentsToggleSuggestedTag(this.dataset.tag)">${esc(t)}</button>`).join('')}
            </div>
            <div class="muted" style="font-size:12px;margin-top:4px;">Suggestions d'apres le nom du fichier. Clique pour ajouter, puis valide.</div>
          ` : ''}
        </div>

        <div>
          <label>Dossier</label>
          <select id="tb-doc-info-folder" class="input">
            ${folderOptionsHTML(doc.folder_id || '')}
          </select>
        </div>

        <div>
          <label>Date d'expiration</label>
          <input id="tb-doc-info-expiry" class="input" type="date" value="${esc(currentExpiry)}" />
        </div>

        <div>
          <label>Note libre</label>
          <textarea id="tb-doc-info-notes" class="input" placeholder="Ex : original papier chez parents, contrat à renouveler…">${esc(currentNotes)}</textarea>
        </div>
      </div>

      <div class="tb-doc-modal-actions">
        <button class="btn" type="button" onclick="this.closest('.tb-doc-modal-backdrop').remove()">Annuler</button>
        <button class="btn primary" type="button" onclick="window.tbDocumentsSaveInfo('${esc(doc.id)}')">Enregistrer</button>
      </div>
    </div>
  `;

  document.body.appendChild(wrap);
}

function editMeta(id){
  const doc = (CACHE.documents||[]).find(d=>String(d.id)===String(id));
  if(!doc) return;
  openInfoModal(doc);
}

async function saveInfo(id){
  const c = client();
  if(!c) return alert('Client Supabase indisponible.');

  const tagsInput = document.getElementById('tb-doc-info-tags')?.value || '';
  const folderId = document.getElementById('tb-doc-info-folder')?.value || '';
  const expires_at_raw = document.getElementById('tb-doc-info-expiry')?.value || '';
const notes_raw = document.getElementById('tb-doc-info-notes')?.value || '';

const expires_at = expires_at_raw.trim() || null;
const notes = notes_raw.trim() || null;

  const { error } = await c
    .from(table('documents','documents'))
    .update({
      tags: normalizeTags(tagsInput),
      folder_id: folderId || null,
      expires_at,
      notes
    })
    .eq('id', id);

  if(error) return alert(error.message || String(error));

  document.querySelector('.tb-doc-modal-backdrop')?.remove();
  await ensureLoaded();
}
  function toggleSelect(id){
  const sid = String(id);
  const current = new Set((CACHE.selectedIds || []).map(String));

  if(current.has(sid)){
    current.delete(sid);
  } else {
    current.add(sid);
  }

  CACHE.selectedIds = Array.from(current);
  renderShell();
}

async function createShareLinksForDocs(docs, expiresInSeconds){
  const c = client();
  if(!c) throw new Error('Client Supabase indisponible.');

  const rows = [];

  for(const doc of docs){
    const res = await c.storage
      .from(doc.storage_bucket || BUCKET)
      .createSignedUrl(doc.storage_path, expiresInSeconds || 3600);

    if(res.error) throw res.error;

    rows.push({
      name: doc.name || doc.original_filename || 'Document',
      url: res.data && res.data.signedUrl
    });
  }

  return rows;
}

function setSharePayload(bodyText, mailto){
  window.__tbDocumentsShareBody = bodyText || '';
  window.__tbDocumentsShareMailto = mailto || '';
}

async function shareSelected(){
  const docs = selectedDocs();
  if(!docs.length) return alert('Sélectionne au moins un document.');

  const duration = String(prompt('Durée du lien temporaire ? 10m, 1h ou 24h', '1h') || '1h').trim().toLowerCase();

  const seconds =
    duration === '10m' ? 600 :
    duration === '24h' ? 86400 :
    3600;

  try{
    const links = await createShareLinksForDocs(docs, seconds);

    const subject = encodeURIComponent(`Documents partagés (${links.length})`);
    const bodyText = [
      'Bonjour,',
      '',
      'Voici les documents via liens temporaires :',
      '',
      ...links.map(x => `- ${x.name} : ${x.url}`),
      '',
      `Durée approximative : ${duration || '1h'}.`
    ].join('\n');

    const mailto = `mailto:?subject=${subject}&body=${encodeURIComponent(bodyText)}`;
    setSharePayload(bodyText, mailto);
    window.__tbDocumentsShareLinksOnly = links
  .map(x => x.url)
  .filter(Boolean)
  .join('\n');

    const wrap = document.createElement('div');
    wrap.className = 'tb-doc-modal-backdrop';
    wrap.onclick = (e)=>{ if(e.target === wrap) wrap.remove(); };

    wrap.innerHTML = `
      <div class="tb-doc-modal">
        <h3>Partager ${esc(links.length)} document(s)</h3>
        <p class="muted" style="font-size:13px;margin-top:-4px;">
          Liens privés temporaires. Évite de les partager publiquement.
        </p>

        <div class="tb-doc-modal-actions" style="justify-content:flex-start;margin-top:10px;">
          <button class="btn primary" type="button" onclick="window.tbDocumentsOpenShareEmail()">Préparer un email</button>
<button class="btn" type="button" onclick="window.tbDocumentsCopyShareLinks()">Copier les liens</button>
        </div>

        <div class="tb-doc-share-links">
          ${links.map(x=>`
            <div class="tb-doc-share-link">
              <strong>${esc(x.name)}</strong><br>
              ${esc(x.url || '')}
            </div>
          `).join('')}
        </div>

        <div class="tb-doc-modal-actions">
          <button class="btn" type="button" onclick="this.closest('.tb-doc-modal-backdrop').remove()">Fermer</button>
        </div>
      </div>
    `;

    document.body.appendChild(wrap);
  }catch(e){
    alert(e.message || String(e));
  }
}

async function moveSelected(){
  const docs = selectedDocs();
  if(!docs.length) return alert('Sélectionne au moins un document.');

  const folderOptions = [
    ['','Non classé'],
    ...(CACHE.folders || []).map(f => [String(f.id), folderLabel(f)])
  ];

  const label = folderOptions.map((x,i)=>`${i}. ${x[1]}`).join('\n');
  const choice = prompt(`Déplacer vers :\n${label}`, '0');

  if(choice === null) return;

  const idx = Number(choice);
  if(!Number.isInteger(idx) || idx < 0 || idx >= folderOptions.length){
    return alert('Choix invalide.');
  }

  const folderId = folderOptions[idx][0] || null;
  const c = client();
  if(!c) return alert('Client Supabase indisponible.');

  for(const doc of docs){
    const { error } = await c
      .from(table('documents','documents'))
      .update({ folder_id: folderId })
      .eq('id', doc.id);

    if(error) return alert(error.message || String(error));
  }

  CACHE.selectedIds = [];
  await ensureLoaded();
}

async function addTagSelected(){
  const docs = selectedDocs();
  if(!docs.length) return alert('Selectionne au moins un document.');

  const raw = String(prompt('Tag a ajouter aux documents selectionnes ?') || '').trim();
  const tag = normalizeTags(raw)[0] || '';
  if(!tag) return;

  const c = client();
  if(!c) return alert('Client Supabase indisponible.');

  for(const doc of docs){
    const tags = docTags(doc);
    if(tags.some(t => tagKey(t) === tagKey(tag))) continue;
    const nextTags = window.Core?.documentRules?.mergeTags
      ? window.Core.documentRules.mergeTags(tags, [tag])
      : normalizeTags([...tags, tag].join(', '));
    const { error } = await c
      .from(table('documents','documents'))
      .update({ tags: nextTags })
      .eq('id', doc.id);

    if(error) return alert(error.message || String(error));
  }

  await ensureLoaded();
}

async function shareSelected(){
  const docs = selectedDocs();
  if(!docs.length) return alert('Sélectionne au moins un document.');

  const wrap = document.createElement('div');
  wrap.className = 'tb-doc-modal-backdrop';
  wrap.onclick = (e)=>{ if(e.target === wrap) wrap.remove(); };
  wrap.innerHTML = `
    <div class="tb-doc-modal">
      <h3>Partager ${esc(docs.length)} document(s)</h3>
      <div class="tb-doc-form">
        <label for="tb-doc-share-duration">Durée des liens temporaires</label>
        <select id="tb-doc-share-duration" class="input">
          <option value="10m">10 minutes</option>
          <option value="1h" selected>1 heure</option>
          <option value="24h">24 heures</option>
        </select>
        <p class="muted" style="font-size:13px;margin:0;">
          Les liens donnent accès aux fichiers sélectionnés pendant la durée choisie.
        </p>
      </div>
      <div class="tb-doc-modal-actions">
        <button class="btn" type="button" onclick="this.closest('.tb-doc-modal-backdrop').remove()">Annuler</button>
        <button class="btn primary" type="button" onclick="window.tbDocumentsGenerateShareLinks()">Créer les liens</button>
      </div>
    </div>
  `;
  document.body.appendChild(wrap);
}

async function generateShareLinksSelected(){
  const docs = selectedDocs();
  if(!docs.length) return alert('Sélectionne au moins un document.');

  const duration = String(document.getElementById('tb-doc-share-duration')?.value || '1h').trim().toLowerCase();
  const seconds = window.Core?.documentRules?.shareDurationSeconds
    ? window.Core.documentRules.shareDurationSeconds(duration)
    : (duration === '10m' ? 600 : duration === '24h' ? 86400 : 3600);

  try{
    const links = await createShareLinksForDocs(docs, seconds);
    const subject = encodeURIComponent(`Documents partagés (${links.length})`);
    const bodyText = [
      'Bonjour,',
      '',
      'Voici les documents via liens temporaires :',
      '',
      ...links.map(x => `- ${x.name} : ${x.url}`),
      '',
      `Durée approximative : ${duration || '1h'}.`
    ].join('\n');

    const mailto = `mailto:?subject=${subject}&body=${encodeURIComponent(bodyText)}`;
    setSharePayload(bodyText, mailto);
    window.__tbDocumentsShareLinksOnly = links.map(x => x.url).filter(Boolean).join('\n');

    const wrap = document.querySelector('.tb-doc-modal-backdrop') || document.createElement('div');
    wrap.className = 'tb-doc-modal-backdrop';
    wrap.onclick = (e)=>{ if(e.target === wrap) wrap.remove(); };
    wrap.innerHTML = `
      <div class="tb-doc-modal">
        <h3>Partager ${esc(links.length)} document(s)</h3>
        <p class="muted" style="font-size:13px;margin-top:-4px;">
          Liens privés temporaires. Évite de les partager publiquement.
        </p>
        <div class="tb-doc-modal-actions between" style="margin-top:10px;">
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button class="btn primary" type="button" onclick="window.tbDocumentsOpenShareEmail()">Préparer un email</button>
            <button class="btn" type="button" onclick="window.tbDocumentsCopyShareLinks()">Copier les liens</button>
            <button class="btn" type="button" onclick="window.tbDocumentsCopyShareBody()">Copier le message</button>
          </div>
          <small class="muted">${esc(duration || '1h')}</small>
        </div>
        <textarea class="input tb-doc-share-body" readonly>${esc(bodyText)}</textarea>
        <div class="tb-doc-share-links">
          ${links.map(x=>`
            <div class="tb-doc-share-link">
              <strong>${esc(x.name)}</strong><br>
              ${esc(x.url || '')}
            </div>
          `).join('')}
        </div>
        <div class="tb-doc-modal-actions">
          <button class="btn" type="button" onclick="window.tbDocumentsShareSelected()">Recréer</button>
          <button class="btn" type="button" onclick="this.closest('.tb-doc-modal-backdrop').remove()">Fermer</button>
        </div>
      </div>
    `;
    if(!wrap.parentNode) document.body.appendChild(wrap);
  }catch(e){
    alert(e.message || String(e));
  }
}

async function moveSelected(){
  const docs = selectedDocs();
  if(!docs.length) return alert('Sélectionne au moins un document.');

  const folderOptions = [
    ['','Non classé'],
    ...(CACHE.folders || []).map(f => [String(f.id), folderLabel(f)])
  ];

  const wrap = document.createElement('div');
  wrap.className = 'tb-doc-modal-backdrop';
  wrap.onclick = (e)=>{ if(e.target === wrap) wrap.remove(); };
  wrap.innerHTML = `
    <div class="tb-doc-modal">
      <h3>Déplacer ${esc(docs.length)} document(s)</h3>
      <div class="tb-doc-form">
        <label for="tb-doc-batch-folder">Dossier de destination</label>
        <select id="tb-doc-batch-folder" class="input">
          ${folderOptions.map(([id,label]) => `<option value="${esc(id)}">${esc(label)}</option>`).join('')}
        </select>
      </div>
      <div class="tb-doc-modal-actions">
        <button class="btn" type="button" onclick="this.closest('.tb-doc-modal-backdrop').remove()">Annuler</button>
        <button class="btn primary" type="button" onclick="window.tbDocumentsApplyMoveSelected()">Déplacer</button>
      </div>
    </div>
  `;
  document.body.appendChild(wrap);
}

async function applyMoveSelected(){
  const docs = selectedDocs();
  if(!docs.length) return alert('Sélectionne au moins un document.');

  const folderId = document.getElementById('tb-doc-batch-folder')?.value || null;
  const c = client();
  if(!c) return alert('Client Supabase indisponible.');

  for(const doc of docs){
    const { error } = await c
      .from(table('documents','documents'))
      .update({ folder_id: folderId })
      .eq('id', doc.id);

    if(error) return alert(error.message || String(error));
  }

  CACHE.selectedIds = [];
  document.querySelector('.tb-doc-modal-backdrop')?.remove();
  await ensureLoaded();
}

async function addTagSelected(){
  const docs = selectedDocs();
  if(!docs.length) return alert('Sélectionne au moins un document.');

  const tags = allDocumentTags();
  const wrap = document.createElement('div');
  wrap.className = 'tb-doc-modal-backdrop';
  wrap.onclick = (e)=>{ if(e.target === wrap) wrap.remove(); };
  wrap.innerHTML = `
    <div class="tb-doc-modal">
      <h3>Ajouter un tag à ${esc(docs.length)} document(s)</h3>
      <div class="tb-doc-form">
        <label for="tb-doc-batch-tag">Tag</label>
        <input id="tb-doc-batch-tag" class="input" list="tb-doc-known-tags" placeholder="Ex: Contrat" autocomplete="off" />
        <datalist id="tb-doc-known-tags">
          ${tags.map(t => `<option value="${esc(t)}"></option>`).join('')}
        </datalist>
        <p class="muted" style="font-size:13px;margin:0;">
          Si le tag existe déjà sur un document, il sera simplement ignoré pour ce document.
        </p>
      </div>
      <div class="tb-doc-modal-actions">
        <button class="btn" type="button" onclick="this.closest('.tb-doc-modal-backdrop').remove()">Annuler</button>
        <button class="btn primary" type="button" onclick="window.tbDocumentsApplyAddTagSelected()">Ajouter</button>
      </div>
    </div>
  `;
  document.body.appendChild(wrap);
  setTimeout(()=>document.getElementById('tb-doc-batch-tag')?.focus(), 0);
}

async function applyAddTagSelected(){
  const docs = selectedDocs();
  if(!docs.length) return alert('Sélectionne au moins un document.');

  const raw = String(document.getElementById('tb-doc-batch-tag')?.value || '').trim();
  const tag = normalizeTags(raw)[0] || '';
  if(!tag) return;

  const c = client();
  if(!c) return alert('Client Supabase indisponible.');

  for(const doc of docs){
    const tags = docTags(doc);
    if(tags.some(t => tagKey(t) === tagKey(tag))) continue;
    const nextTags = window.Core?.documentRules?.mergeTags
      ? window.Core.documentRules.mergeTags(tags, [tag])
      : normalizeTags([...tags, tag].join(', '));
    const { error } = await c
      .from(table('documents','documents'))
      .update({ tags: nextTags })
      .eq('id', doc.id);

    if(error) return alert(error.message || String(error));
  }

  document.querySelector('.tb-doc-modal-backdrop')?.remove();
  await ensureLoaded();
}

async function deleteSelected(){
  const docs = selectedDocs();
  if(!docs.length) return alert('Sélectionne au moins un document.');

  if(!confirm(`Supprimer ${docs.length} document(s) ?`)) return;

  const c = client();
  if(!c) return alert('Client Supabase indisponible.');

  for(const doc of docs){
    try{
      await c.storage.from(doc.storage_bucket || BUCKET).remove([doc.storage_path]);
    }catch(e){
      console.warn('[TB][documents] batch storage remove failed', e);
    }

    const { error } = await c
      .from(table('documents','documents'))
      .delete()
      .eq('id', doc.id);

    if(error) return alert(error.message || String(error));
  }

  CACHE.selectedIds = [];
  await ensureLoaded();
}
  window.renderDocuments = function renderDocuments(){ ensureLoaded(); };
  window.tbDocumentsRenderOnly = renderShell;
  window.tbDocumentsSetSearch = function(v){ CACHE.search = String(v || ''); renderShell(); }; 
  window.tbDocumentsSetTagFilter = function(v){ setSelectedTagFilter(v); renderShell(); };
  window.tbDocumentsSelectFolder = function(id){ setSelectedFolderId(id); renderShell(); };
  window.tbDocumentsCreateFolder = createFolder;
  window.tbDocumentsCreateSubFolder = function(parentId){ createFolder(parentId); };
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
window.tbDocumentsSaveInfo = saveInfo;
window.tbDocumentsToggleSuggestedTag = function(tag){
  const input = document.getElementById('tb-doc-info-tags');
  if(!input) return;
  const tags = normalizeTags(input.value);
  const wanted = tagKey(tag);
  const current = tags.findIndex(t => tagKey(t) === wanted);
  if(current >= 0) tags.splice(current, 1);
  else tags.push(String(tag || '').trim());
  input.value = normalizeTags(tags.join(', ')).join(', ');
  input.focus();
};

window.tbDocumentsToggleFavoritesFilter = function(){
  CACHE.onlyFavorites = !CACHE.onlyFavorites;
  renderShell();
};

window.tbDocumentsToggleExpiringFilter = function(){
  CACHE.onlyExpiring = !CACHE.onlyExpiring;
  renderShell();
};
window.tbDocumentsToggleSelect = toggleSelect;
window.tbDocumentsClearSelection = clearSelection;
window.tbDocumentsSelectVisible = selectVisibleDocuments;
window.tbDocumentsToggleFolderCollapsed = toggleFolderCollapsed;
window.tbDocumentsShareSelected = shareSelected;
window.tbDocumentsGenerateShareLinks = generateShareLinksSelected;
window.tbDocumentsAddTagSelected = addTagSelected;
window.tbDocumentsApplyAddTagSelected = applyAddTagSelected;
window.tbDocumentsMoveSelected = moveSelected;
window.tbDocumentsApplyMoveSelected = applyMoveSelected;
window.tbDocumentsDeleteSelected = deleteSelected;
window.tbDocumentsOpenShareEmail = function(){
  const body = window.__tbDocumentsShareBody || '';

  if(!body){
    return alert('Aucun email de partage prêt.');
  }

  const url =
    'https://mail.google.com/mail/?view=cm&fs=1'
    + '&su=' + encodeURIComponent('Documents partagés')
    + '&body=' + encodeURIComponent(body);

  window.open(url, '_blank', 'noopener,noreferrer');
};

window.tbDocumentsCopyShareLinks = async function(){
  const text = window.__tbDocumentsShareLinksOnly || '';

  if(!text){
    return alert('Aucun lien à copier.');
  }

  try{
    await navigator.clipboard.writeText(text);
    alert('Lien(s) copié(s).');
  }catch(e){
    console.error(e);

    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';

    document.body.appendChild(ta);

    ta.focus();
    ta.select();

    try{
      document.execCommand('copy');
      alert('Lien(s) copié(s).');
    }catch(_){
      alert('Copie impossible.');
    }

    ta.remove();
  }
};

window.tbDocumentsCopyShareBody = async function(){
  const text = window.__tbDocumentsShareBody || '';

  if(!text){
    return alert('Aucun message à copier.');
  }

  try{
    await navigator.clipboard.writeText(text);
    alert('Message copié.');
  }catch(e){
    console.error(e);

    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';

    document.body.appendChild(ta);

    ta.focus();
    ta.select();

    try{
      document.execCommand('copy');
      alert('Message copié.');
    }catch(_){
      alert('Copie impossible.');
    }

    ta.remove();
  }
};
})();
