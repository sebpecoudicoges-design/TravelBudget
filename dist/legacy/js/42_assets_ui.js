/* TravelBudget V9.6.4 - Assets UI
   Patrimoine / assets: light premium cards + linear depreciation + create/edit/archive + multi-owners + share transfer events.
   Stock patrimonial only: no cashflow mutation, no budget mutation. */
(function(){
  const FALLBACK_ASSETS = [{ id:'demo-car', name:'Toyota X-Trail', asset_type:'car', purchase_value:5000, residual_value:1400, currency:'EUR', purchase_date:new Date(new Date().getFullYear(), Math.max(0,new Date().getMonth()-3), 1).toISOString().slice(0,10), depreciation_months:36, status:'active' }];
  const FALLBACK_OWNERS = [{ id:'demo-owner-me', asset_id:'demo-car', display_name:'Toi', ownership_percent:50 }, { id:'demo-owner-co', asset_id:'demo-car', display_name:'Co-owner', ownership_percent:50 }];
  const FALLBACK_EVENTS = [];
  let CACHE = { assets:[], owners:[], events:[], demo:false };

  function esc(v){ try { return escapeHTML(String(v ?? '')); } catch(_) { return String(v ?? '').replace(/[&<>\'"]/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[c])); } }
  function tr(k, vars){ try { return window.tbT ? window.tbT(k, vars) : k; } catch(_) { return k; } }
  function money(v, cur){ try { return fmtMoney(v, cur); } catch(_) { return `${Math.round(Number(v||0)).toLocaleString('fr-FR')} ${cur||''}`; } }
  function icon(t){ return ({ car:'🚗', real_estate:'🏠', equipment:'🎒', other:'💠' })[t] || '💠'; }
  function label(t){ return ({ car:tr('assets.type.car'), real_estate:tr('assets.type.real_estate'), equipment:tr('assets.type.equipment'), other:tr('assets.type.other') })[t] || tr('assets.type.other'); }
  function client(){ try{ if(typeof sb !== 'undefined' && sb && sb.from) return sb; }catch(_){} try{ if(window.sb && window.sb.from) return window.sb; }catch(_){} return null; }
  function activeTravelId(){ try{ return String(window.state?.activeTravelId || window.state?.period?.travel_id || '').trim(); }catch(_){ return ''; } }
  function today(){ return new Date().toISOString().slice(0,10); }
  function n(v, fallback){ const x=Number(v); return Number.isFinite(x) ? x : (fallback||0); }
  function table(name, fallback){ return (window.TB_CONST && window.TB_CONST.TABLES && window.TB_CONST.TABLES[name]) || fallback || name; }
  async function currentUserId(){
    try{ if(window.sbUser && window.sbUser.id) return window.sbUser.id; }catch(_){}
    const c = client();
    if(c && c.auth && typeof c.auth.getUser === 'function'){ const res = await c.auth.getUser(); return res && res.data && res.data.user && res.data.user.id ? res.data.user.id : ''; }
    return '';
  }

  async function loadAssets(){
    const c = client();
    if(!c) return { assets:FALLBACK_ASSETS, owners:FALLBACK_OWNERS, events:FALLBACK_EVENTS, demo:true, reason:'client-missing' };
    try{
      let q = c.from(table('assets','assets')).select('*').neq('status','archived').order('created_at',{ascending:false});
      const tid = activeTravelId(); if(tid) q = q.or(`travel_id.eq.${tid},travel_id.is.null`);
      const { data, error } = await q; if(error) throw error;
      const assets = (data||[]).map(window.TBAssetsCore.normalizeAsset);
      if(!assets.length){ CACHE = { assets:[], owners:[], events:[], demo:false, empty:true }; return CACHE; }
      const ids = assets.map(a=>a.id);
      const ownersRes = await c.from(table('asset_owners','asset_owners')).select('*').in('asset_id', ids).order('created_at',{ascending:true});
      let events = [];
      try{ const evRes = await c.from(table('asset_ownership_events','asset_ownership_events')).select('*').in('asset_id', ids).order('event_date',{ascending:false}).limit(50); events = evRes.error ? [] : (evRes.data||[]); }catch(_){ events = []; }
      CACHE = { assets, owners: ownersRes.error ? [] : (ownersRes.data||[]), events, demo:false, empty:false }; return CACHE;
    }catch(e){ console.warn('[TB][assets] fallback preview used', e); CACHE = { assets:FALLBACK_ASSETS, owners:FALLBACK_OWNERS, events:FALLBACK_EVENTS, demo:true, reason:e && (e.message || e.code) }; return CACHE; }
  }

  function findAsset(id){ return (CACHE.assets||[]).find(a=>String(a.id)===String(id)); }
  function ownerRows(assetOrId, owners){ const id = typeof assetOrId === 'object' ? assetOrId.id : assetOrId; return (owners||CACHE.owners||[]).filter(o=>String(o.asset_id)===String(id)); }
  function eventRows(assetOrId){ const id = typeof assetOrId === 'object' ? assetOrId.id : assetOrId; return (CACHE.events||[]).filter(e=>String(e.asset_id)===String(id)); }
  function minePercent(rows){ const me = rows.find(r=>/toi|moi/i.test(String(r.display_name||''))); return Number(me?.ownership_percent ?? rows[0]?.ownership_percent ?? 100); }
  function totalPercent(rows){ return Math.round((rows||[]).reduce((s,r)=>s+n(r.ownership_percent,0),0)*100)/100; }
  function eventLabel(t){ return ({ buy_share:'Rachat parts', sell_share:'Vente parts', transfer_share:'Transfert parts' })[t] || 'Mouvement parts'; }
  function isMeOwnerRow(r){
  return /toi|moi/i.test(String(r.display_name||'')) || (!!r.user_id && r.user_id === window.sbUser?.id);
}

function eventsForAsset(assetId){
  return (CACHE.events||[]).filter(e => String(e.asset_id) === String(assetId));
}

function realizedSalesForMe(assetId){
  // Sommes encaissées par "toi" quand tu es le vendeur
  const evs = eventsForAsset(assetId);
  return evs.reduce((sum,e)=>{
    if(!e) return sum;
    // vendeur = from_owner_id
    const from = (CACHE.owners||[]).find(o => String(o.id) === String(e.from_owner_id));
    if(from && isMeOwnerRow(from)){
      return sum + Number(e.amount || 0);
    }
    return sum;
  }, 0);
}

function initialCostForMe(asset, owners){
  // coût initial = purchase_value × ta part initiale (on prend la part actuelle comme approximation MVP)
  const rows = ownerRows(asset, owners);
  const ownPct = minePercent(rows);
  return Number(asset.purchase_value||0) * (Number(ownPct||0)/100);
}

function realizedPnLForMe(asset, owners){
  const proceeds = realizedSalesForMe(asset.id);
  const cost = initialCostForMe(asset, owners);
  return proceeds - cost; // positif = gain, négatif = perte
}

function isAssetSold(asset){
  return String(asset.status||'').toLowerCase() === 'sold';
}
  function txLabel(tx){
  const date = tx.date || tx.transaction_date || tx.created_at || '';
  const amount = tx.amount ?? tx.value ?? tx.total ?? '';
  const cur = tx.currency || tx.original_currency || '';
  const label = tx.label || tx.description || tx.note || tx.title || 'Transaction';
  return `${String(date).slice(0,10)} · ${amount} ${cur} · ${label}`;
}

async function loadRecentTransactions(){
  const c = client();
  if(!c) return [];
  try{
    let q = c.from(table('transactions','transactions')).select('*').order('created_at',{ascending:false}).limit(30);
    const tid = activeTravelId();
    if(tid) q = q.eq('travel_id', tid);
    const { data, error } = await q;
    if(error) throw error;
    return data || [];
  }catch(e){
    console.warn('[TB][assets] transactions candidates unavailable', e);
    return [];
  }
}
function portfolioSummary(assets, owners){
  const core = window.TBAssetsCore;
  const activeAssets = (assets || []).filter(a => String(a.status || 'active') === 'active');

  let totalCurrent = 0;
  let totalOwned = 0;
  let totalDepreciation = 0;
  let currency = activeAssets[0]?.currency || 'EUR';

  for(const asset of activeAssets){
    const current = core.computeLinearAssetValue(asset);
    const purchase = Number(asset.purchase_value || 0);
    const rows = ownerRows(asset, owners);
    const ownPct = minePercent(rows);

    totalCurrent += current;
    totalOwned += current * (Number(ownPct || 0) / 100);
    totalDepreciation += Math.max(0, purchase - current);

    if(asset.currency) currency = asset.currency;
  }

  return {
    count: activeAssets.length,
    currency,
    totalCurrent,
    totalOwned,
    totalDepreciation
  };
}

function portfolioSummaryHtml(assets, owners){
  const s = portfolioSummary(assets, owners);

  return `<div class="tb-assets-summary">
    <div class="tb-assets-summary-card primary">
      <small>${esc(tr('assets.summary.your_total'))}</small>
      <strong>${esc(money(s.totalOwned, s.currency))}</strong>
    </div>
    <div class="tb-assets-summary-card">
      <small>${esc(tr('assets.summary.total_assets'))}</small>
      <strong>${esc(money(s.totalCurrent, s.currency))}</strong>
    </div>
    <div class="tb-assets-summary-card">
      <small>${esc(tr('assets.summary.estimated_depreciation'))}</small>
      <strong class="depr">-${esc(money(s.totalDepreciation, s.currency))}</strong>
    </div>
    <div class="tb-assets-summary-card">
      <small>${esc(tr('assets.summary.active_assets'))}</small>
      <strong>${esc(s.count)}</strong>
    </div>
  </div>`;
}
  function card(asset, owners){
    const core = window.TBAssetsCore; const current = core.computeLinearAssetValue(asset); const progress = core.computeDepreciationProgress(asset);
    const pctLoss = asset.purchase_value ? Math.round(((asset.purchase_value-current)/asset.purchase_value)*100) : 0;
    const lossAmount = Math.max(0, Number(asset.purchase_value || 0) - Number(current || 0));
    const rows = ownerRows(asset, owners); const ownPct = minePercent(rows); const ownValue = core.computeOwnedValue(asset, ownPct); const width = Math.round(progress.ratio*100);
const monthlyDep = asset.depreciation_months ? (Number(asset.purchase_value || 0) - Number(asset.residual_value || 0)) / Number(asset.depreciation_months || 1) : 0;
const depreciationStatus = width >= 100 ? 'Amortissement terminé' : 'En amortissement';
    const total = totalPercent(rows); const warning = rows.length && Math.abs(total-100) > 0.01 ? `<span class="tb-asset-owner-warning">Total parts : ${esc(total)}%</span>` : '';
    const recent = eventRows(asset).slice(0,2);
    return `<section class="tb-asset-card" data-asset-id="${esc(asset.id)}">
      <div class="tb-asset-top"><div><div class="tb-asset-kicker">Asset</div><h3>${icon(asset.asset_type)} ${esc(asset.name)}</h3><p>Acheté le ${esc(asset.purchase_date)}</p></div><span>${esc(label(asset.asset_type))}</span></div>
      <div class="tb-asset-metrics"><div class="tb-asset-primary"><small>Ta valeur</small><strong>${esc(money(ownValue,asset.currency))}</strong><em>${ownPct}% de l’asset</em></div><div>
  <small>Valeur actuelle</small>
  <strong>${esc(money(current,asset.currency))}</strong>
  <em class="depr">
    Dépréciation : -${esc(money(lossAmount,asset.currency))} · -${pctLoss}%
  </em>
</div></div>
      <div class="tb-asset-facts">
  <span>Achat : <strong>${esc(money(asset.purchase_value,asset.currency))}</strong></span>
  <span>Valeur finale estimée : <strong>${esc(money(asset.residual_value,asset.currency))}</strong></span>
  <span>Coût mensuel estimé : <strong>${esc(money(monthlyDep,asset.currency))}/mois</strong></span>
  <span class="${width >= 100 ? 'done' : ''}">${esc(depreciationStatus)}</span>
</div>
<div class="tb-asset-progress"><div><small>Amortissement</small><small>${width >= 100 ? 'Amortissement terminé · valeur plancher atteinte' : width + '% utilisé'}</small></div><b><i style="width:${width}%"></i></b></div>
      <div class="tb-asset-chart" id="asset-chart-${esc(asset.id)}"></div>
      <div class="tb-asset-owners">${rows.length ? rows.map(r=>`<span>${esc(r.display_name)} · ${Number(r.ownership_percent||0)}%</span>`).join('') : '<span>Ownership non renseigné · 100%</span>'}${warning}</div>
      ${recent.length ? `<div class="tb-asset-events">${recent.map(e=>`<span>${esc(e.event_date||'')} · ${esc(eventLabel(e.event_type))} · ${esc(n(e.percent,0))}%</span>`).join('')}</div>` : ''}

${(() => {
  const pnl = realizedPnLForMe(asset, owners);
  const sold = isAssetSold(asset);

  return sold ? `
    <div class="tb-asset-pnl">
      <span>P&L réalisé</span>
      <strong class="${pnl >= 0 ? 'pos' : 'neg'}">
        ${pnl >= 0 ? '+' : ''}${esc(money(pnl, asset.currency))}
      </strong>
    </div>
  ` : '';
})()}

<div class="tb-asset-actions"><button type="button" data-tb-asset-edit="${esc(asset.id)}">Modifier</button><button type="button" data-tb-asset-owners="${esc(asset.id)}">Copropriétaires</button><button type="button" data-tb-asset-transfer="${esc(asset.id)}">Rachat / vente</button><button type="button" data-tb-asset-sell="${esc(asset.id)}">Vendre l’asset</button><button type="button" class="danger" data-tb-asset-archive="${esc(asset.id)}">Archiver</button></div>
    </section>`;
  }

  function emptyState(){ return `<section class="tb-assets-empty"><div><strong>${esc(tr('assets.empty.title'))}</strong><p>${esc(tr('assets.empty.body'))}</p></div><button class="tb-asset-add-btn" type="button" data-tb-asset-open>${esc(tr('assets.action.add_asset'))}</button></section>`; }
  function renderCharts(assets){ if(!window.echarts) return; for(const asset of assets){ const el = document.getElementById(`asset-chart-${asset.id}`); if(!el) continue; const old = window.echarts.getInstanceByDom ? window.echarts.getInstanceByDom(el) : null; if(old) old.dispose(); const series = window.TBAssetsCore.buildValueSeries(asset, 18); const chart = window.echarts.init(el, null, { renderer:'canvas' }); chart.setOption({ grid:{left:4,right:4,top:8,bottom:6}, xAxis:{type:'category',show:false,data:series.map(x=>x.date)}, yAxis:{type:'value',show:false,min:'dataMin'}, tooltip:{trigger:'axis', valueFormatter:v=>money(v, asset.currency)}, series:[{ type:'line', smooth:true, symbol:'none', lineStyle:{ width:4, color:'#22d3ee' }, areaStyle:{ color:{ type:'linear', x:0,y:0,x2:0,y2:1, colorStops:[{offset:0,color:'rgba(6,182,212,.22)'},{offset:1,color:'rgba(6,182,212,.02)'}] } }, data:series.map(x=>Math.round(x.value*100)/100) }] }); } }

  function assetFormHtml(mode, asset){ const a = asset || { name:'', asset_type:'car', purchase_value:'', residual_value:0, currency:'EUR', purchase_date:today(), depreciation_months:36 }; const isEdit = mode === 'edit'; return `<div class="tb-asset-modal-backdrop"><form class="tb-asset-modal" data-tb-asset-form="${isEdit?'edit':'create'}" ${isEdit?`data-asset-id="${esc(a.id)}"`:''}><div class="tb-asset-modal-head"><div><strong>${isEdit?'Modifier l’asset':'Ajouter un asset'}</strong><p>Stock patrimonial seul : aucun mouvement cash, aucune dépense budget.</p></div><button type="button" data-tb-asset-close>×</button></div><div class="tb-asset-form-grid"><label>Nom<input name="name" required placeholder="Toyota X-Trail" value="${esc(a.name)}"></label><label>Type<select name="asset_type"><option value="car" ${a.asset_type==='car'?'selected':''}>Voiture</option><option value="real_estate" ${a.asset_type==='real_estate'?'selected':''}>Immo</option><option value="equipment" ${a.asset_type==='equipment'?'selected':''}>Matériel</option><option value="other" ${a.asset_type==='other'?'selected':''}>Autre</option></select></label><label>Valeur d’achat<input name="purchase_value" required type="number" min="0" step="0.01" placeholder="5000" value="${esc(a.purchase_value)}"></label><label>Valeur estimée finale<input name="residual_value" type="number" min="0" step="0.01" value="${esc(a.residual_value)}"></label><label>Devise<input name="currency" required maxlength="3" value="${esc(a.currency||'EUR')}"></label><label>Date d’achat<input name="purchase_date" required type="date" value="${esc(a.purchase_date||today())}"></label><label>Amortissement, mois<input name="depreciation_months" required type="number" min="1" step="1" value="${esc(a.depreciation_months||36)}"></label>${isEdit?'':'<label>Ta part %<input name="ownership_percent" required type="number" min="0" max="100" step="0.01" value="100"></label>'}</div><div class="tb-asset-modal-error" data-tb-asset-error hidden></div><div class="tb-asset-modal-actions"><button type="button" data-tb-asset-close>Annuler</button><button type="submit">${isEdit?'Enregistrer':'Créer l’asset'}</button></div></form></div>`; }
  function ownerRowHtml(o){ return `<div class="tb-owner-row" data-owner-id="${esc(o.id||'')}"><input name="owner_name" required placeholder="Nom" value="${esc(o.display_name||'')}"><input name="owner_percent" required type="number" min="0" max="100" step="0.01" value="${esc(o.ownership_percent||0)}"><button type="button" data-tb-owner-remove>×</button></div>`; }
  function ownersModalHtml(asset){ const rows = ownerRows(asset); return `<div class="tb-asset-modal-backdrop"><form class="tb-asset-modal" data-tb-asset-owners-form data-asset-id="${esc(asset.id)}"><div class="tb-asset-modal-head"><div><strong>Copropriétaires</strong><p>${esc(asset.name)} · le total des parts doit faire 100%.</p></div><button type="button" data-tb-asset-close>×</button></div><div class="tb-owner-list" data-tb-owner-list>${rows.map(ownerRowHtml).join('') || ownerRowHtml({id:'', display_name:'Toi', ownership_percent:100})}</div><button type="button" class="tb-owner-add" data-tb-owner-add>+ Ajouter un copropriétaire</button><div class="tb-owner-total" data-tb-owner-total></div><div class="tb-asset-modal-error" data-tb-asset-error hidden></div><div class="tb-asset-modal-actions"><button type="button" data-tb-asset-close>Annuler</button><button type="submit">Enregistrer les parts</button></div></form></div>`; }
  function transferModalHtml(asset, transactions){
  const rows = ownerRows(asset);
  const opts = rows.map(r=>`<option value="${esc(r.id)}">${esc(r.display_name)} · ${Number(r.ownership_percent||0)}%</option>`).join('');
  const txOpts = (transactions||[]).map(tx=>`<option value="${esc(tx.id)}">${esc(txLabel(tx))}</option>`).join('');

  return `<div class="tb-asset-modal-backdrop">
    <form class="tb-asset-modal" data-tb-asset-transfer-form data-asset-id="${esc(asset.id)}">
      <div class="tb-asset-modal-head">
        <div>
          <strong>Rachat / vente de parts</strong>
          <p>Trace un mouvement d’ownership. Tu peux le lier à une transaction existante sans créer de nouveau cashflow.</p>
        </div>
        <button type="button" data-tb-asset-close>×</button>
      </div>

      <div class="tb-asset-form-grid">
        <label>Type
          <select name="event_type">
            <option value="transfer_share">Transfert de parts</option>
            <option value="buy_share">Rachat de parts</option>
            <option value="sell_share">Vente de parts</option>
          </select>
        </label>

        <label>Date
          <input name="event_date" type="date" required value="${today()}">
        </label>

        <label>Vendeur / source
          <select name="from_owner_id" required>${opts}</select>
        </label>

        <label>Acheteur / destination
          <select name="to_owner_id" required>${opts}</select>
        </label>

        <label>Part transférée %
          <input name="percent" required type="number" min="0.01" max="100" step="0.01" value="10">
        </label>

        <label>Montant payé
          <input name="amount" type="number" min="0" step="0.01" value="0">
        </label>

        <label>Devise
          <input name="currency" maxlength="3" value="${esc(asset.currency||'EUR')}">
        </label>

        <label>Transaction liée
          <select name="linked_transaction_id">
            <option value="">Aucune transaction liée</option>
            ${txOpts}
          </select>
        </label>

        <label>Note
          <input name="note" placeholder="Rachat part voiture">
        </label>
      </div>

      <div class="tb-asset-modal-error" data-tb-asset-error hidden></div>

      <div class="tb-asset-modal-actions">
        <button type="button" data-tb-asset-close>Annuler</button>
        <button type="submit">Valider le mouvement</button>
      </div>
    </form>
  </div>`;
}
function sellAssetModalHtml(asset, transactions){
  const txOpts = (transactions||[]).map(tx=>`<option value="${esc(tx.id)}">${esc(txLabel(tx))}</option>`).join('');

  return `<div class="tb-asset-modal-backdrop">
    <form class="tb-asset-modal" data-tb-asset-sell-form data-asset-id="${esc(asset.id)}">
      <div class="tb-asset-modal-head">
        <div>
          <strong>Vendre l’asset</strong>
          <p>Marque l’asset comme vendu. Le prix de vente est réparti selon les parts actuelles. Aucun cashflow n’est créé.</p>
        </div>
        <button type="button" data-tb-asset-close>×</button>
      </div>

      <div class="tb-asset-form-grid">
        <label>Date de vente
          <input name="event_date" type="date" required value="${today()}">
        </label>

        <label>Prix de vente total
          <input name="amount" type="number" min="0" step="0.01" required value="0">
        </label>

        <label>Devise
          <input name="currency" maxlength="3" required value="${esc(asset.currency||'EUR')}">
        </label>

        <label>Transaction liée
          <select name="linked_transaction_id">
            <option value="">Aucune transaction liée</option>
            ${txOpts}
          </select>
        </label>

        <label>Note
          <input name="note" placeholder="Vente totale de l’asset">
        </label>
      </div>

      <div class="tb-asset-modal-error" data-tb-asset-error hidden></div>

      <div class="tb-asset-modal-actions">
        <button type="button" data-tb-asset-close>Annuler</button>
        <button type="submit">Valider la vente</button>
      </div>
    </form>
  </div>`;
}

  function closeModal(){ document.querySelectorAll('.tb-asset-modal-backdrop').forEach(n=>n.remove()); }
  function openAssetModal(mode, assetId){ closeModal(); const asset = assetId ? findAsset(assetId) : null; document.body.insertAdjacentHTML('beforeend', assetFormHtml(mode, asset)); focusFirst(); }
  function openOwnersModal(assetId){ const asset=findAsset(assetId); if(!asset) return; closeModal(); document.body.insertAdjacentHTML('beforeend', ownersModalHtml(asset)); refreshOwnerTotal(); focusFirst(); }
  async function openTransferModal(assetId){
  const asset = findAsset(assetId);
  if(!asset) return;

  const rows = ownerRows(asset);
  if(rows.length < 2){
    alert('Ajoute au moins deux copropriétaires avant de transférer des parts.');
    return;
  }

  closeModal();
  const transactions = await loadRecentTransactions();
  document.body.insertAdjacentHTML('beforeend', transferModalHtml(asset, transactions));
  focusFirst();
}
async function openSellAssetModal(assetId){
  const asset = findAsset(assetId);
  if(!asset) return;

  const rows = ownerRows(asset);
  if(!rows.length){
    alert('Ajoute au moins un propriétaire avant de vendre l’asset.');
    return;
  }

  closeModal();
  const transactions = await loadRecentTransactions();
  document.body.insertAdjacentHTML('beforeend', sellAssetModalHtml(asset, transactions));
  focusFirst();
}
  function focusFirst(){ const el=document.querySelector('.tb-asset-modal input, .tb-asset-modal select'); if(el) setTimeout(()=>el.focus(),0); }
  function showFormError(msg){ const el=document.querySelector('[data-tb-asset-error]'); if(el){ el.hidden=false; el.textContent=String(msg || 'Erreur inconnue'); } }

  function readAssetPayload(form){ const fd = new FormData(form); const purchase = Number(fd.get('purchase_value') || 0); const residual = Number(fd.get('residual_value') || 0); const months = Math.round(Number(fd.get('depreciation_months') || 0)); const currency = String(fd.get('currency') || 'EUR').trim().toUpperCase(); const name = String(fd.get('name') || '').trim(); if(!name) throw new Error('Nom obligatoire.'); if(!Number.isFinite(purchase) || purchase < 0) throw new Error('Valeur d’achat invalide.'); if(!Number.isFinite(residual) || residual < 0 || residual > purchase) throw new Error('Valeur estimée finale invalide.'); if(!Number.isFinite(months) || months < 1) throw new Error('Durée d’amortissement invalide.'); if(!/^[A-Z]{3}$/.test(currency)) throw new Error('Devise invalide : utilise un code ISO à 3 lettres, ex. EUR.'); return { name, asset_type:String(fd.get('asset_type') || 'other'), purchase_value:purchase, residual_value:residual, currency, purchase_date:String(fd.get('purchase_date') || today()).slice(0,10), depreciation_months:months, status:'active' }; }
  async function createAssetFromForm(form){ const c = client(); if(!c) throw new Error('Client Supabase indisponible.'); const uid = await currentUserId(); if(!uid) throw new Error('Utilisateur non connecté.'); const payload = Object.assign(readAssetPayload(form), { user_id: uid, travel_id: activeTravelId() || null }); const ownership = Number(new FormData(form).get('ownership_percent') || 0); if(!Number.isFinite(ownership) || ownership < 0 || ownership > 100) throw new Error('Ta part doit être entre 0 et 100%.'); const res = await c.from(table('assets','assets')).insert([payload]).select('id').single(); if(res.error) throw res.error; const ownerPayload = { asset_id: res.data.id, user_id: uid, display_name: 'Toi', ownership_percent: ownership }; const ownerRes = await c.from(table('asset_owners','asset_owners')).insert([ownerPayload]); if(ownerRes.error) throw ownerRes.error; }
  async function updateAssetFromForm(form){ const c = client(); if(!c) throw new Error('Client Supabase indisponible.'); const assetId = form.getAttribute('data-asset-id'); if(!assetId) throw new Error('Asset introuvable.'); const res = await c.from(table('assets','assets')).update(readAssetPayload(form)).eq('id', assetId); if(res.error) throw res.error; }
  async function archiveAsset(assetId){ const c = client(); if(!c) throw new Error('Client Supabase indisponible.'); const res = await c.from(table('assets','assets')).update({ status:'archived' }).eq('id', assetId); if(res.error) throw res.error; }
  function readOwnerRows(form){ const rows = Array.from(form.querySelectorAll('.tb-owner-row')).map(row=>({ id: row.getAttribute('data-owner-id') || '', display_name: String(row.querySelector('[name="owner_name"]')?.value || '').trim(), ownership_percent: Number(row.querySelector('[name="owner_percent"]')?.value || 0) })).filter(r=>r.display_name); if(!rows.length) throw new Error('Ajoute au moins un propriétaire.'); rows.forEach(r=>{ if(!Number.isFinite(r.ownership_percent) || r.ownership_percent < 0 || r.ownership_percent > 100) throw new Error('Chaque part doit être entre 0 et 100%.'); }); const total = totalPercent(rows); if(Math.abs(total - 100) > 0.01) throw new Error(`Le total des parts doit faire 100%. Total actuel : ${total}%.`); return rows; }
  async function saveOwnersFromForm(form){ const c = client(); if(!c) throw new Error('Client Supabase indisponible.'); const assetId = form.getAttribute('data-asset-id'); if(!assetId) throw new Error('Asset introuvable.'); const uid = await currentUserId(); const rows = readOwnerRows(form); const existing = ownerRows(assetId); const keepIds = rows.filter(r=>r.id).map(r=>String(r.id)); for(const old of existing){ if(old.id && !keepIds.includes(String(old.id))){ const del = await c.from(table('asset_owners','asset_owners')).delete().eq('id', old.id); if(del.error) throw del.error; } } for(const r of rows){ const payload = { asset_id: assetId, display_name:r.display_name, ownership_percent:r.ownership_percent }; if(r.id){ const up = await c.from(table('asset_owners','asset_owners')).update(payload).eq('id', r.id); if(up.error) throw up.error; } else { const ins = await c.from(table('asset_owners','asset_owners')).insert([Object.assign(payload, /toi|moi/i.test(r.display_name) && uid ? { user_id:uid } : {})]); if(ins.error) throw ins.error; } } }
  async function saveTransferFromForm(form){ const c = client(); if(!c) throw new Error('Client Supabase indisponible.'); const assetId = form.getAttribute('data-asset-id'); const asset=findAsset(assetId); if(!asset) throw new Error('Asset introuvable.'); const fd = new FormData(form); const fromId = String(fd.get('from_owner_id')||''); const toId = String(fd.get('to_owner_id')||''); if(!fromId || !toId || fromId === toId) throw new Error('Choisis deux copropriétaires différents.'); const percent = Number(fd.get('percent')||0); if(!Number.isFinite(percent) || percent <= 0) throw new Error('Part transférée invalide.'); const rows = ownerRows(assetId); const from = rows.find(r=>String(r.id)===fromId); const to = rows.find(r=>String(r.id)===toId); if(!from || !to) throw new Error('Copropriétaire introuvable.'); if(n(from.ownership_percent,0) < percent) throw new Error(`${from.display_name} ne possède pas assez de parts.`); const nextFrom = Math.round((n(from.ownership_percent,0)-percent)*100)/100; const nextTo = Math.round((n(to.ownership_percent,0)+percent)*100)/100; const up1 = await c.from(table('asset_owners','asset_owners')).update({ ownership_percent: nextFrom }).eq('id', fromId); if(up1.error) throw up1.error; const up2 = await c.from(table('asset_owners','asset_owners')).update({ ownership_percent: nextTo }).eq('id', toId); if(up2.error) throw up2.error; const linkedTxId = String(fd.get('linked_transaction_id') || '').trim() || null;

const payload = {
  asset_id: assetId,
  from_owner_id: fromId,
  to_owner_id: toId,
  event_type: String(fd.get('event_type')||'transfer_share'),
  percent,
  amount: Number(fd.get('amount')||0),
  currency: String(fd.get('currency')||asset.currency||'EUR').trim().toUpperCase(),
  event_date: String(fd.get('event_date')||today()).slice(0,10),
  linked_transaction_id: linkedTxId,
  note: String(fd.get('note')||'').trim() || null
}; const ev = await c.from(table('asset_ownership_events','asset_ownership_events')).insert([payload]); if(ev.error) throw ev.error; }
async function saveTotalAssetSaleFromForm(form){
  const c = client();
  if(!c) throw new Error('Client Supabase indisponible.');

  const assetId = form.getAttribute('data-asset-id');
  const asset = findAsset(assetId);
  if(!asset) throw new Error('Asset introuvable.');

  const rows = ownerRows(assetId);
  if(!rows.length) throw new Error('Aucun copropriétaire trouvé.');

  const fd = new FormData(form);
  const totalAmount = Number(fd.get('amount') || 0);
  if(!Number.isFinite(totalAmount) || totalAmount < 0) throw new Error('Prix de vente invalide.');

  const currency = String(fd.get('currency') || asset.currency || 'EUR').trim().toUpperCase();
  if(!/^[A-Z]{3}$/.test(currency)) throw new Error('Devise invalide.');

  const eventDate = String(fd.get('event_date') || today()).slice(0,10);
  const linkedTxId = String(fd.get('linked_transaction_id') || '').trim() || null;
  const note = String(fd.get('note') || '').trim() || 'Vente totale asset';

  const total = totalPercent(rows);
  if(Math.abs(total - 100) > 0.01){
    throw new Error(`Impossible de vendre : le total des parts doit faire 100%. Total actuel : ${total}%.`);
  }

  for(const r of rows){
    const pct = Number(r.ownership_percent || 0);
    if(pct <= 0) continue;

    const ownerAmount = Math.round((totalAmount * pct / 100) * 100) / 100;

    const payload = {
      asset_id: assetId,
      from_owner_id: r.id,
      to_owner_id: null,
      event_type: 'sell_share',
      percent: pct,
      amount: ownerAmount,
      currency,
      event_date: eventDate,
      linked_transaction_id: linkedTxId,
      note: `[VENTE_TOTALE] ${note}`
    };

    const ev = await c.from(table('asset_ownership_events','asset_ownership_events')).insert([payload]);
    if(ev.error) throw ev.error;
  }

  const up = await c.from(table('assets','assets')).update({ status:'sold' }).eq('id', assetId);
  if(up.error) throw up.error;
}

  function refreshOwnerTotal(){ const form = document.querySelector('[data-tb-asset-owners-form]'); const box = document.querySelector('[data-tb-owner-total]'); if(!form || !box) return; const rows = Array.from(form.querySelectorAll('[name="owner_percent"]')).map(x=>Number(x.value||0)); const total = Math.round(rows.reduce((s,x)=>s+(Number.isFinite(x)?x:0),0)*100)/100; box.textContent = `Total : ${total}%`; box.classList.toggle('ok', Math.abs(total-100)<=0.01); }
  function bindOnce(){ if(window.__tbAssetsUiBound) return; window.__tbAssetsUiBound = true; document.addEventListener('click', async function(ev){ const open = ev.target && ev.target.closest && ev.target.closest('[data-tb-asset-open]'); if(open){ ev.preventDefault(); openAssetModal('create'); return; } const edit = ev.target && ev.target.closest && ev.target.closest('[data-tb-asset-edit]'); if(edit){ ev.preventDefault(); openAssetModal('edit', edit.getAttribute('data-tb-asset-edit')); return; } const owners = ev.target && ev.target.closest && ev.target.closest('[data-tb-asset-owners]'); if(owners){ ev.preventDefault(); openOwnersModal(owners.getAttribute('data-tb-asset-owners')); return; } const sellAsset = ev.target && ev.target.closest && ev.target.closest('[data-tb-asset-sell]');
if(sellAsset){
  ev.preventDefault();
  openSellAssetModal(sellAsset.getAttribute('data-tb-asset-sell'));
  return;
} const archive = ev.target && ev.target.closest && ev.target.closest('[data-tb-asset-archive]'); if(archive){ ev.preventDefault(); if(confirm('Archiver cet asset ? Il ne sera plus affiché, sans suppression de l’historique.')){ try{ await archiveAsset(archive.getAttribute('data-tb-asset-archive')); await renderAssets('asset-archived'); }catch(e){ alert(e && (e.message||e.code) || e); } } return; } const close = ev.target && ev.target.closest && ev.target.closest('[data-tb-asset-close]'); if(close){ ev.preventDefault(); closeModal(); return; } const addOwner = ev.target && ev.target.closest && ev.target.closest('[data-tb-owner-add]'); if(addOwner){ ev.preventDefault(); const list=document.querySelector('[data-tb-owner-list]'); if(list){ list.insertAdjacentHTML('beforeend', ownerRowHtml({id:'',display_name:'',ownership_percent:0})); refreshOwnerTotal(); } return; } const remOwner = ev.target && ev.target.closest && ev.target.closest('[data-tb-owner-remove]'); if(remOwner){ ev.preventDefault(); const row=remOwner.closest('.tb-owner-row'); if(row) row.remove(); refreshOwnerTotal(); return; } const backdrop = ev.target && ev.target.classList && ev.target.classList.contains('tb-asset-modal-backdrop'); if(backdrop){ ev.preventDefault(); closeModal(); } }); document.addEventListener('input', function(ev){ if(ev.target && ev.target.matches && ev.target.matches('[name="owner_percent"]')) refreshOwnerTotal(); }); document.addEventListener('submit', async function(ev){ const form = ev.target && ev.target.matches && ev.target.matches('[data-tb-asset-form], [data-tb-asset-owners-form], [data-tb-asset-transfer-form], [data-tb-asset-sell-form]') ? ev.target : null; if(!form) return; ev.preventDefault(); const submit = form.querySelector('button[type="submit"]'); const oldTxt = submit ? submit.textContent : ''; if(submit){ submit.disabled = true; submit.textContent = 'Enregistrement…'; } try{ if(form.matches('[data-tb-asset-owners-form]')) await saveOwnersFromForm(form); else if(form.matches('[data-tb-asset-transfer-form]')) await saveTransferFromForm(form);
else if(form.matches('[data-tb-asset-sell-form]')) await saveTotalAssetSaleFromForm(form);
else if(form.getAttribute('data-tb-asset-form') === 'edit') await updateAssetFromForm(form); else await createAssetFromForm(form); closeModal(); await renderAssets('asset-saved'); }catch(e){ console.error('[TB][assets] save failed', e); showFormError(e && (e.message || e.details || e.code) ? (e.message || e.details || e.code) : e); } finally{ if(submit){ submit.disabled = false; submit.textContent = oldTxt || 'Enregistrer'; } } }); }

  function styles(){ if(document.getElementById('tb-assets-style')) return; const st=document.createElement('style'); st.id='tb-assets-style'; st.textContent=`
.tb-assets-shell{position:relative;overflow:hidden;border:1px solid rgba(15,23,42,.08);border-radius:28px;padding:22px;background:linear-gradient(135deg,#ffffff,#f4f7fb);color:#0f172a;box-shadow:0 18px 45px rgba(15,23,42,.08)}
.tb-assets-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:18px}.tb-assets-head h2{margin:0;font-size:26px;color:#0f172a}.tb-assets-head p{margin:6px 0 0;color:#475569;font-size:13px;max-width:760px}.tb-assets-badge{border:1px solid rgba(8,145,178,.18);background:#e0f7fb;color:#0891b2;border-radius:999px;padding:8px 12px;font-size:12px;font-weight:800;white-space:nowrap}.tb-assets-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.tb-asset-add-btn{border:0;border-radius:999px;background:#0f172a;color:#fff;padding:9px 13px;font-size:12px;font-weight:900;cursor:pointer;box-shadow:0 14px 30px rgba(15,23,42,.16)}.tb-assets-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px}
.tb-assets-empty{display:flex;justify-content:space-between;align-items:center;gap:14px;border:1px dashed rgba(15,23,42,.18);border-radius:22px;background:#fff;padding:18px}.tb-assets-empty strong{display:block;font-size:16px}.tb-assets-empty p{margin:4px 0 0;color:#64748b;font-size:13px}
.tb-assets-summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:16px}
.tb-assets-summary-card{border:1px solid rgba(15,23,42,.08);border-radius:20px;background:linear-gradient(180deg,#ffffff,#f8fafc);padding:14px;box-shadow:0 12px 28px rgba(15,23,42,.06)}
.tb-assets-summary-card.primary{background:linear-gradient(135deg,#0f172a,#1e293b);color:#fff}
.tb-assets-summary-card small{display:block;color:#64748b;font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.08em}
.tb-assets-summary-card.primary small{color:#cbd5e1}
.tb-assets-summary-card strong{display:block;margin-top:6px;color:#0f172a;font-size:24px;letter-spacing:-.03em}
.tb-assets-summary-card.primary strong{color:#fff;font-size:28px}
.tb-assets-summary-card strong.depr{color:#ea580c}
.tb-asset-card{border:1px solid rgba(15,23,42,.08);border-radius:24px;background:linear-gradient(180deg,#ffffff,#f7f9fc);padding:18px;box-shadow:0 18px 40px rgba(15,23,42,.08);transition:transform .2s ease,box-shadow .2s ease}.tb-asset-card:hover{transform:scale(1.01);box-shadow:0 24px 60px rgba(15,23,42,.12)}.tb-asset-top{display:flex;justify-content:space-between;gap:12px}.tb-asset-kicker{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#64748b;font-weight:900}.tb-asset-top h3{margin:4px 0 3px;font-size:20px;color:#0f172a}.tb-asset-top p{margin:0;color:#64748b;font-size:12px}.tb-asset-top span{height:max-content;border-radius:999px;background:#e0f7fb;color:#0891b2;border:1px solid rgba(8,145,178,.16);padding:7px 10px;font-size:12px;font-weight:800}.tb-asset-metrics{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:16px}.tb-asset-metrics>div{border-radius:18px;background:linear-gradient(180deg,#f8fafc,#eef2f7);border:1px solid rgba(15,23,42,.06);padding:13px}.tb-asset-metrics small{display:block;color:#64748b;font-size:11px}.tb-asset-metrics strong{display:block;margin-top:4px;font-size:24px;letter-spacing:-.03em;color:#0f172a}.tb-asset-primary strong{font-size:30px}.tb-asset-metrics em{display:block;margin-top:3px;color:#0891b2;font-style:normal;font-size:12px}.tb-asset-metrics em.loss{color:#e11d48}
.tb-asset-facts{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
.tb-asset-facts span{font-size:11px;color:#475569;background:#f8fafc;border:1px solid rgba(15,23,42,.08);border-radius:999px;padding:6px 9px}
.tb-asset-facts strong{color:#0f172a}
.tb-asset-facts span.done{background:#ecfdf5;color:#047857;border-color:rgba(4,120,87,.18);font-weight:900}
.tb-asset-metrics em.depr{color:#ea580c}.tb-asset-progress{margin-top:16px}.tb-asset-progress div{display:flex;justify-content:space-between;color:#64748b;font-size:11px;margin-bottom:7px}.tb-asset-progress b{display:block;height:8px;background:#e2e8f0;border-radius:999px;overflow:hidden}.tb-asset-progress i{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#06b6d4,#8b5cf6)}.tb-asset-chart{height:86px;margin-top:14px;border-radius:18px;background:linear-gradient(180deg,#eef2f7,#e5eaf1);border:1px solid rgba(15,23,42,.07)}.tb-asset-owners{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.tb-asset-owners span{font-size:11px;color:#334155;border:1px solid rgba(15,23,42,.10);border-radius:999px;padding:6px 9px;background:#f8fafc}.tb-asset-owner-warning{background:#fff7ed!important;color:#c2410c!important;border-color:rgba(194,65,12,.22)!important}.tb-asset-events{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.tb-asset-events span{font-size:11px;color:#64748b;background:#eef2ff;border:1px solid rgba(99,102,241,.16);border-radius:999px;padding:6px 9px}.tb-asset-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.tb-asset-actions button{border:1px solid rgba(15,23,42,.10);background:#fff;color:#0f172a;border-radius:12px;padding:8px 10px;font-size:12px;font-weight:900;cursor:pointer}.tb-asset-actions button.danger{color:#be123c;background:#fff1f2;border-color:rgba(225,29,72,.20)}
.tb-asset-pnl{
  display:flex;
  justify-content:space-between;
  align-items:center;
  margin-top:10px;
  padding:10px 12px;
  border-radius:14px;
  background:#f8fafc;
  border:1px solid rgba(15,23,42,.08);
}

.tb-asset-pnl span{
  font-size:12px;
  color:#64748b;
  font-weight:800;
}

.tb-asset-pnl strong{
  font-size:16px;
}

.pos{color:#16a34a;}
.neg{color:#dc2626;}

.tb-asset-modal-backdrop{position:fixed;inset:0;z-index:9999;background:rgba(15,23,42,.42);display:flex;align-items:center;justify-content:center;padding:18px}.tb-asset-modal{width:min(800px,100%);max-height:92vh;overflow:auto;border-radius:26px;background:#fff;color:#0f172a;box-shadow:0 30px 90px rgba(15,23,42,.28);padding:20px}.tb-asset-modal-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:16px}.tb-asset-modal-head strong{font-size:22px}.tb-asset-modal-head p{margin:5px 0 0;color:#64748b;font-size:13px}.tb-asset-modal-head button{border:0;background:#f1f5f9;border-radius:999px;width:34px;height:34px;font-size:22px;line-height:1;cursor:pointer}.tb-asset-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.tb-asset-form-grid label{display:grid;gap:6px;color:#475569;font-size:12px;font-weight:800}.tb-asset-form-grid input,.tb-asset-form-grid select{width:100%;border:1px solid rgba(15,23,42,.12);border-radius:14px;background:#f8fafc;color:#0f172a;padding:10px 11px;font-size:14px}.tb-asset-modal-error{margin-top:12px;border:1px solid rgba(225,29,72,.25);background:#fff1f2;color:#be123c;border-radius:14px;padding:10px;font-size:13px}.tb-asset-modal-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:16px}.tb-asset-modal-actions button{border:0;border-radius:14px;padding:10px 13px;font-weight:900;cursor:pointer}.tb-asset-modal-actions button:first-child{background:#f1f5f9;color:#334155}.tb-asset-modal-actions button:last-child{background:#0f172a;color:#fff}.tb-asset-modal-actions button:disabled{opacity:.55;cursor:not-allowed}.tb-owner-list{display:grid;gap:10px}.tb-owner-row{display:grid;grid-template-columns:1fr 130px 38px;gap:8px}.tb-owner-row input{border:1px solid rgba(15,23,42,.12);border-radius:14px;background:#f8fafc;color:#0f172a;padding:10px 11px;font-size:14px}.tb-owner-row button,.tb-owner-add{border:0;border-radius:14px;background:#f1f5f9;color:#334155;font-weight:900;cursor:pointer}.tb-owner-add{margin-top:12px;padding:10px 12px}.tb-owner-total{margin-top:10px;font-size:13px;color:#be123c;font-weight:900}.tb-owner-total.ok{color:#0891b2}@media(max-width:720px){.tb-assets-head,.tb-assets-empty{flex-direction:column;align-items:stretch}.tb-asset-metrics,.tb-asset-form-grid,.tb-owner-row{grid-template-columns:1fr}.tb-assets-actions{align-items:flex-start}}
  `; document.head.appendChild(st); }

  async function renderAssets(reason){ styles(); bindOnce(); const root = document.getElementById('assets-root') || document.getElementById('view-assets'); if(!root) return; root.innerHTML = `<div class="tb-assets-shell"><div class="tb-assets-head"><div><h2>${esc(tr('assets.title'))}</h2><p>${esc(tr('common.loading'))}</p></div></div></div>`; const data = await loadAssets(); const summary = data.empty ? '' : portfolioSummaryHtml(data.assets, data.owners);
const content = data.empty ? emptyState() : `${summary}<div class="tb-assets-grid">${data.assets.map(a=>card(a,data.owners)).join('')}</div>`; root.innerHTML = `<div class="tb-assets-shell"><div class="tb-assets-head"><div><h2>${esc(tr('assets.title'))}</h2><p>${esc(tr('assets.subtitle'))} ${data.demo ? esc(tr('assets.demo_hint')) : ''}</p></div><div class="tb-assets-actions"><button class="tb-asset-add-btn" type="button" data-tb-asset-open>${esc(tr('assets.action.add'))}</button><div class="tb-assets-badge">V9.6.4 · Assets</div></div></div>${content}</div>`; if(!data.empty) setTimeout(()=>renderCharts(data.assets),0); }
  window.renderAssets = renderAssets;
  try {
    window.tbOnLangChange = window.tbOnLangChange || [];
    if (!window.__tbAssetsLangBound) {
      window.__tbAssetsLangBound = true;
      window.tbOnLangChange.push(() => {
        try {
          const view = document.getElementById('view-assets');
          if (view && !view.classList.contains('hidden')) renderAssets('lang');
        } catch (_) {}
      });
    }
  } catch (_) {}
})();
