/* TravelBudget V9.6.4 - Assets UI
   Patrimoine / assets: light premium cards + linear depreciation + create/edit/archive + multi-owners + share transfer events.
   Stock patrimonial only: no cashflow mutation, no budget mutation. */
(function(){
  const FALLBACK_ASSETS = [{ id:'demo-car', name:'Toyota X-Trail', asset_type:'car', purchase_value:5000, residual_value:1400, currency:'EUR', purchase_date:new Date(new Date().getFullYear(), Math.max(0,new Date().getMonth()-3), 1).toISOString().slice(0,10), depreciation_months:36, status:'active' }];
  const FALLBACK_OWNERS = [{ id:'demo-owner-me', asset_id:'demo-car', display_name:'Toi', ownership_percent:50 }, { id:'demo-owner-co', asset_id:'demo-car', display_name:'Co-owner', ownership_percent:50 }];
  const FALLBACK_EVENTS = [];
  let CACHE = { assets:[], owners:[], events:[], documentLinks:[], transactionLinks:[], demo:false };
  let TRIP_EXPENSE_CACHE = new Map();
  let assetModal = null;

  function esc(v){ try { return escapeHTML(String(v ?? '')); } catch(_) { return String(v ?? '').replace(/[&<>\'"]/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[c])); } }
  function tr(k, vars){ try { return window.tbT ? window.tbT(k, vars) : k; } catch(_) { return k; } }
  function money(v, cur){ try { return fmtMoney(v, cur); } catch(_) { return `${Math.round(Number(v||0)).toLocaleString('fr-FR')} ${cur||''}`; } }
  function icon(t){ return ({ car:'🚗', real_estate:'🏠', equipment:'🎒', other:'💠' })[t] || '💠'; }
  function label(t){ return ({ car:tr('assets.type.car'), real_estate:tr('assets.type.real_estate'), equipment:tr('assets.type.equipment'), other:tr('assets.type.other') })[t] || tr('assets.type.other'); }
  function client(){ try{ if(typeof sb !== 'undefined' && sb && sb.from) return sb; }catch(_){} try{ if(window.sb && window.sb.from) return window.sb; }catch(_){} return null; }
  function activeTravelId(){ try{ return String(window.state?.activeTravelId || window.state?.period?.travel_id || '').trim(); }catch(_){ return ''; } }
  function activeTripId(){ try{ return String(window.__tripState?.activeTripId || window.tripState?.activeTripId || '').trim(); }catch(_){ return ''; } }
  function today(){ return new Date().toISOString().slice(0,10); }
  function n(v, fallback){ const x=Number(v); return Number.isFinite(x) ? x : (fallback||0); }
  function table(name, fallback){ return (window.TB_CONST && window.TB_CONST.TABLES && window.TB_CONST.TABLES[name]) || fallback || name; }
  function atxt(fr, en){ try { return (typeof window.tbGetLang === 'function' && window.tbGetLang() === 'en') ? en : fr; } catch(_) { return fr; } }
  function portfolioCurrency(){
    try{
      const c = String(window.state?.user?.baseCurrency || window.state?.user?.base_currency || window.state?.settings?.base_currency || '').toUpperCase();
      if(/^[A-Z]{3}$/.test(c)) return c;
    }catch(_){}
    try{
      if(typeof window.getDisplayCurrency === 'function') return String(window.getDisplayCurrency(today()) || '').toUpperCase() || 'EUR';
    }catch(_){}
    try{ return String(window.state?.period?.baseCurrency || window.state?.user?.baseCurrency || 'EUR').toUpperCase(); }catch(_){ return 'EUR'; }
  }
  function convertAssetAmount(amount, fromCurrency, toCurrency){
    const amt = Number(amount || 0);
    const from = String(fromCurrency || toCurrency || 'EUR').toUpperCase();
    const to = String(toCurrency || from || 'EUR').toUpperCase();
    if(!Number.isFinite(amt) || from === to) return amt;
    try{
      if(typeof window.amountToDisplayForDate === 'function' && to === portfolioCurrency()){
        const out = window.amountToDisplayForDate(amt, from, today());
        if(out !== null && Number.isFinite(out)) return out;
      }
    }catch(_){}
    try{
      if(typeof window.fxConvert === 'function'){
        const rates = typeof window.fxGetEurRates === 'function' ? window.fxGetEurRates() : undefined;
        const out = window.fxConvert(amt, from, to, rates);
        if(out !== null && Number.isFinite(out)) return out;
      }
    }catch(_){}
    return null;
  }
  async function currentUserId(){
    try{ if(window.sbUser && window.sbUser.id) return window.sbUser.id; }catch(_){}
    try{ if(typeof sbUser !== 'undefined' && sbUser && sbUser.id) return sbUser.id; }catch(_){}
    if ((typeof window.tbIsOfflineMode === "function" && window.tbIsOfflineMode()) || (navigator && navigator.onLine === false)) return '';
    const c = client();
    if(c && c.auth && typeof c.auth.getUser === 'function'){ const res = await c.auth.getUser(); return res && res.data && res.data.user && res.data.user.id ? res.data.user.id : ''; }
    return '';
  }

  async function loadAssets(){
    if ((typeof window.tbIsOfflineMode === "function" && window.tbIsOfflineMode()) || (navigator && navigator.onLine === false)) {
      CACHE = {
        assets: Array.isArray(state?.assets) ? state.assets : [],
        owners: Array.isArray(state?.assetOwners) ? state.assetOwners : [],
        events: Array.isArray(state?.assetEvents) ? state.assetEvents : [],
        documentLinks: Array.isArray(state?.assetDocuments) ? state.assetDocuments : [],
        transactionLinks: Array.isArray(state?.assetTransactionLinks) ? state.assetTransactionLinks : [],
        demo: false,
        empty: !(Array.isArray(state?.assets) && state.assets.length)
      };
      return CACHE;
    }
    const c = client();
    if(!c) return { assets:FALLBACK_ASSETS, owners:FALLBACK_OWNERS, events:FALLBACK_EVENTS, demo:true, reason:'client-missing' };
    try{
      let q = c.from(table('assets','assets')).select('*').neq('status','archived').order('created_at',{ascending:false});
      const tid = activeTravelId(); if(tid) q = q.or(`travel_id.eq.${tid},travel_id.is.null`);
      const { data, error } = await q; if(error) throw error;
      const assets = (data||[]).map(window.TBAssetsCore.normalizeAsset);
      if(!assets.length){ CACHE = { assets:[], owners:[], events:[], documentLinks:[], transactionLinks:[], demo:false, empty:true }; if(window.state){ state.assets=[]; state.assetOwners=[]; state.assetTransactionLinks=[]; } return CACHE; }
      const ids = assets.map(a=>a.id);
      const ownersRes = await c.from(table('asset_owners','asset_owners')).select('*').in('asset_id', ids).order('created_at',{ascending:true});
      let events = [];
      try{ const evRes = await c.from(table('asset_ownership_events','asset_ownership_events')).select('*').in('asset_id', ids).order('event_date',{ascending:false}).limit(50); events = evRes.error ? [] : (evRes.data||[]); }catch(_){ events = []; }
      let documentLinks = [];
      try{ const docRes = await c.from(table('asset_documents','asset_documents')).select('*').in('asset_id', ids).order('created_at',{ascending:false}); documentLinks = docRes.error ? [] : (docRes.data||[]); }catch(e){ console.warn('[TB][assets] document links unavailable', e); documentLinks = []; }
      let transactionLinks = [];
      try{ const txLinkRes = await c.from(table('asset_transaction_links','asset_transaction_links')).select('*').in('asset_id', ids).order('created_at',{ascending:false}); transactionLinks = txLinkRes.error ? [] : (txLinkRes.data||[]); }catch(e){ console.warn('[TB][assets] transaction links unavailable', e); transactionLinks = []; }
      CACHE = { assets, owners: ownersRes.error ? [] : (ownersRes.data||[]), events, documentLinks, transactionLinks, demo:false, empty:false };
      try {
        if (window.state) {
          state.assets = CACHE.assets;
          state.assetOwners = CACHE.owners;
          state.assetEvents = CACHE.events;
          state.assetDocuments = CACHE.documentLinks;
          state.assetTransactionLinks = CACHE.transactionLinks;
        }
        if (typeof window.tbSaveOfflineSnapshot === 'function') window.tbSaveOfflineSnapshot('assets:load');
        if (typeof window.renderKPI === 'function') window.renderKPI();
      } catch (_) {}
      return CACHE;
    }catch(e){ console.warn('[TB][assets] fallback preview used', e); CACHE = { assets:FALLBACK_ASSETS, owners:FALLBACK_OWNERS, events:FALLBACK_EVENTS, documentLinks:[], transactionLinks:[], demo:true, reason:e && (e.message || e.code) }; return CACHE; }
  }

  function assetBudgetRows(start, end){
    try {
      return window.Core?.assetRules?.buildAssetBudgetTransactions?.({
        assets: CACHE.assets || window.state?.assets || [],
        owners: CACHE.owners || window.state?.assetOwners || [],
        rangeStart: start,
        rangeEnd: end,
      }) || [];
    } catch (_) { return []; }
  }

  function findAsset(id){ return (CACHE.assets||[]).find(a=>String(a.id)===String(id)); }
  function ownerRows(assetOrId, owners){ const id = typeof assetOrId === 'object' ? assetOrId.id : assetOrId; return (owners||CACHE.owners||[]).filter(o=>String(o.asset_id)===String(id)); }
  function assetDocumentRows(assetOrId){ const id = typeof assetOrId === 'object' ? assetOrId.id : assetOrId; return (CACHE.documentLinks||[]).filter(x=>String(x.asset_id)===String(id)); }
  function assetDocLinkTable(){ return table('asset_documents','asset_documents'); }
  function docLabel(doc){ if(!doc) return 'Document'; const name = doc.name || doc.original_filename || 'Document'; const tags = Array.isArray(doc.tags) ? doc.tags.join(', ') : ''; const date = String(doc.created_at || '').slice(0,10); return [name, tags, date].filter(Boolean).join(' · '); }
  function docNameLabel(doc){
    if(!doc) return 'Document';
    return doc.name || doc.original_filename || 'Document';
  }
  function minePercent(rows){ const me = rows.find(r=>/toi|moi/i.test(String(r.display_name||''))); return Number(me?.ownership_percent ?? rows[0]?.ownership_percent ?? 100); }
  function totalPercent(rows){ return Math.round((rows||[]).reduce((s,r)=>s+n(r.ownership_percent,0),0)*100)/100; }
  function eventLabel(t){ return ({ buy_share:tr('assets.event.buy_share'), sell_share:tr('assets.event.sell_share'), transfer_share:tr('assets.event.transfer_share') })[t] || tr('assets.event.share_movement'); }
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
async function loadTransactionsByIds(ids){
  const wanted = Array.from(new Set((ids || []).map(id => String(id || '').trim()).filter(Boolean)));
  if(!wanted.length) return [];

  const existing = Array.isArray(window.state?.transactions)
    ? window.state.transactions.filter(tx => wanted.includes(String(tx?.id || '')))
    : [];
  const existingIds = new Set(existing.map(tx => String(tx?.id || '')));
  const missing = wanted.filter(id => !existingIds.has(id));
  if(!missing.length) return existing;

  const c = client();
  if(!c) return existing;

  try{
    const { data, error } = await c
      .from(table('transactions','transactions'))
      .select('*')
      .in('id', missing);
    if(error) throw error;
    const rows = data || [];
    if(window.state){
      state.transactions = Array.isArray(state.transactions) ? state.transactions : [];
      const known = new Set(state.transactions.map(tx => String(tx?.id || '')));
      for(const row of rows){
        if(!known.has(String(row?.id || ''))) state.transactions.push(row);
      }
    }
    return existing.concat(rows);
  }catch(e){
    console.warn('[TB][assets] linked transactions unavailable', e);
    return existing;
  }
}
function portfolioSummary(assets, owners){
  const core = window.TBAssetsCore;
  const currency = portfolioCurrency();

  if(window.Core?.assetRules?.summarizeAssetPortfolio){
    const rates = typeof window.fxGetEurRates === 'function' ? window.fxGetEurRates() : {};
    const fallbackCurrency = String(window.state?.period?.baseCurrency || '').toUpperCase();
    const fallbackPivotToCurrencyRate = Number(window.state?.period?.eurBaseRate || window.state?.exchangeRates?.["EUR-BASE"] || 0);
    return window.Core.assetRules.summarizeAssetPortfolio(assets, owners, {
      baseCurrency: currency,
      rates,
      fallbackCurrency,
      fallbackPivotToCurrencyRate,
      computeCurrentValue: (asset) => core.computeLinearAssetValue(asset),
      ownerPercent: (asset) => minePercent(ownerRows(asset, owners)),
    });
  }

  const activeAssets = (assets || []).filter(a => String(a.status || 'active') === 'active');
  let totalCurrent = 0;
  let totalOwned = 0;
  let totalDepreciation = 0;
  let convertedCount = 0;
  const missingCurrencies = [];

  for(const asset of activeAssets){
    const current = core.computeLinearAssetValue(asset);
    const purchase = Number(asset.purchase_value || 0);
    const assetCurrency = String(asset.currency || currency).toUpperCase();
    const currentInPortfolioCurrency = convertAssetAmount(current, assetCurrency, currency);
    const purchaseInPortfolioCurrency = convertAssetAmount(purchase, assetCurrency, currency);
    if(currentInPortfolioCurrency === null || purchaseInPortfolioCurrency === null){
      if(!missingCurrencies.includes(assetCurrency)) missingCurrencies.push(assetCurrency);
      continue;
    }
    const rows = ownerRows(asset, owners);
    const ownPct = minePercent(rows);

    totalCurrent += currentInPortfolioCurrency;
    totalOwned += currentInPortfolioCurrency * (Number(ownPct || 0) / 100);
    totalDepreciation += Math.max(0, purchaseInPortfolioCurrency - currentInPortfolioCurrency);
    convertedCount += 1;
  }

  return {
    count: activeAssets.length,
    currency,
    totalCurrent,
    totalOwned,
    totalDepreciation,
    convertedCount,
    missingCurrencies
  };
}

function portfolioSummaryHtml(assets, owners){
  const s = portfolioSummary(assets, owners);
  if (window.UI?.assetView?.renderPortfolioSummary) {
    return window.UI.assetView.renderPortfolioSummary({ summary: s, money, tr, t: atxt, esc });
  }
  return "";
}
  function card(asset, owners){
    const core = window.TBAssetsCore;
    if(window.UI?.assetView?.renderAssetCard){
      return window.UI.assetView.renderAssetCard({
        asset,
        owners,
        events:CACHE.events,
        documentLinks:CACHE.documentLinks,
        userId:window.sbUser?.id || '',
        computeCurrentValue:(row)=>core.computeLinearAssetValue(row),
        computeDepreciationProgress:(row)=>core.computeDepreciationProgress(row),
        computeOwnedValue:(row,pct)=>core.computeOwnedValue(row,pct),
        monthlyBudgetAmount:window.Core?.assetRules?.assetMonthlyBudgetAmount
          ? ((row, ownerRowsArg)=>window.Core.assetRules.assetMonthlyBudgetAmount(row, ownerRowsArg))
          : undefined,
        money,
        tr,
        t:atxt,
        esc,
        icon,
        label,
        eventLabel,
      });
    }
    return '';
  }

  function emptyState(){ return `<section class="tb-assets-empty"><div><strong>${esc(tr('assets.empty.title'))}</strong><p>${esc(tr('assets.empty.body'))}</p></div><button class="tb-asset-add-btn" type="button" data-tb-asset-open>${esc(tr('assets.action.add_asset'))}</button></section>`; }
  function renderCharts(assets){ if(!window.echarts) return; for(const asset of assets){ const el = document.getElementById(`asset-chart-${asset.id}`); if(!el) continue; const old = window.echarts.getInstanceByDom ? window.echarts.getInstanceByDom(el) : null; if(old) old.dispose(); const series = window.TBAssetsCore.buildValueSeries(asset, 18); const chart = window.echarts.init(el, null, { renderer:'canvas' }); chart.setOption({ grid:{left:4,right:4,top:8,bottom:6}, xAxis:{type:'category',show:false,data:series.map(x=>x.date)}, yAxis:{type:'value',show:false,min:'dataMin'}, tooltip:{trigger:'axis', valueFormatter:v=>money(v, asset.currency)}, series:[{ type:'line', smooth:true, symbol:'none', lineStyle:{ width:4, color:'#22d3ee' }, areaStyle:{ color:{ type:'linear', x:0,y:0,x2:0,y2:1, colorStops:[{offset:0,color:'rgba(6,182,212,.22)'},{offset:1,color:'rgba(6,182,212,.02)'}] } }, data:series.map(x=>Math.round(x.value*100)/100) }] }); } }

  function assetModalSpec({ key, title, subtitle, formAttrs, contentHTML, submitLabel, extraActionsHTML='', size='lg' }){
    return window.UI?.assetView?.assetModalSpec?.({ key, title, subtitle, formAttrs, contentHTML, submitLabel, extraActionsHTML, size, tr, esc }) || {};
  }

  function mountAssetModal(spec){
    closeModal();
    assetModal=window.UI?.createModal?.({
      id:'tb-assets-shared-modal',
      size:spec.size||'lg',
      panelClass:'tb-assets-shared-modal',
      title:spec.title,
      subtitle:spec.subtitle,
      closeLabel:atxt('Fermer','Close'),
      initialFocus:'input:not([type="color"]), select',
      contentHTML:spec.contentHTML,
      actionsHTML:spec.actionsHTML,
      onClose:()=>{assetModal=null;},
    });
    if(!assetModal)throw new Error('Shared modal unavailable.');
    return assetModal;
  }

  function assetFormHtml(mode, asset){
    return window.UI?.assetView?.renderAssetEditorModalSpec?.({ mode, asset, today, tr, t:atxt, esc });
  }
  function ownerRowHtml(o){ return window.UI?.assetView?.renderAssetOwnerRow?.(o, { tr, esc }) || ''; }
  function ownersModalHtml(asset){ return window.UI?.assetView?.renderAssetOwnersModalSpec?.({ asset, owners:CACHE.owners, tr, esc }); }
  function transferModalHtml(asset, transactions){
  return window.UI?.assetView?.renderAssetTransferModalSpec?.({
    asset,
    owners:CACHE.owners,
    transactions,
    today,
    tr,
    esc,
    txLabel,
  });
}
function sellAssetModalHtml(asset, transactions){
  return window.UI?.assetView?.renderAssetSaleModalSpec?.({
    asset,
    transactions,
    today,
    t:atxt,
    tr,
    esc,
    txLabel,
  });
}

  function closeModal(){assetModal?.close();}
  function openAssetModal(mode, assetId){const asset=assetId?findAsset(assetId):null;mountAssetModal(assetFormHtml(mode,asset));}
  function openOwnersModal(assetId){const asset=findAsset(assetId);if(!asset)return;mountAssetModal(ownersModalHtml(asset));refreshOwnerTotal();}
  async function openTransferModal(assetId){
  const asset = findAsset(assetId);
  if(!asset) return;

  const rows = ownerRows(asset);
  if(rows.length < 2){
    alert(tr('assets.error.need_two_owners'));
    return;
  }

  const transactions = await loadRecentTransactions();
  mountAssetModal(transferModalHtml(asset, transactions));
}
async function openSellAssetModal(assetId){
  const asset = findAsset(assetId);
  if(!asset) return;

  const rows = ownerRows(asset);
  if(!rows.length){
    alert(tr('assets.error.need_one_owner_sale'));
    return;
  }

  const transactions = await loadRecentTransactions();
  mountAssetModal(sellAssetModalHtml(asset, transactions));
}

async function loadDocumentCandidates(){
  const c = client();
  if(!c) return Array.isArray(window.state?.documents) ? window.state.documents : [];
  try{
    const { data, error } = await c.from(table('documents','documents')).select('*').order('created_at',{ascending:false}).limit(200);
    if(error) throw error;
    return data || [];
  }catch(e){
    console.warn('[TB][assets] documents candidates unavailable', e);
    return [];
  }
}

async function fetchAssetDocumentLinks(assetId){
  const c = client();
  if(!c) return (CACHE.documentLinks||[]).filter(link=>String(link.asset_id||'')===String(assetId));
  const { data, error } = await c.from(assetDocLinkTable()).select('*').eq('asset_id', assetId).order('created_at',{ascending:false});
  if(error) throw error;
  return data || [];
}

async function fetchDocumentTransactionLinksForDocs(docIds){
  const ids = (docIds || []).map(String).filter(Boolean);
  if(!ids.length) return [];
  const c = client();
  if(!c) return (Array.isArray(window.state?.transactionDocuments)?window.state.transactionDocuments:[]).filter(link=>ids.includes(String(link.document_id||'')));

  const { data, error } = await c
    .from(table('transaction_documents','transaction_documents'))
    .select('*')
    .in('document_id', ids)
    .order('created_at', { ascending:false });

  if(error) throw error;
  return data || [];
}

async function fetchDocumentTripExpenseLinksForDocs(docIds){
  const ids = (docIds || []).map(String).filter(Boolean);
  if(!ids.length) return [];
  const c = client();
  if(!c) return (Array.isArray(window.state?.tripExpenseDocuments)?window.state.tripExpenseDocuments:[]).filter(link=>ids.includes(String(link.document_id||'')));

  const { data, error } = await c
    .from(table('trip_expense_documents','trip_expense_documents'))
    .select('*')
    .in('document_id', ids)
    .order('created_at', { ascending:false });

  if(error) throw error;
  await cacheTripExpensesForLinks(data || []);
  return data || [];
}

function normalizeTripExpenseRow(row){
  if(!row) return null;
  return {
    ...row,
    paidByMemberId: row.paidByMemberId || row.paid_by_member_id || null,
    transactionId: row.transactionId || row.transaction_id || null,
    budgetDateStart: row.budgetDateStart || row.budget_date_start || row.date || null,
    budgetDateEnd: row.budgetDateEnd || row.budget_date_end || row.budget_date_start || row.date || null,
  };
}

function rememberTripExpenses(rows){
  for(const row of rows || []){
    const ex = normalizeTripExpenseRow(row);
    if(ex?.id) TRIP_EXPENSE_CACHE.set(String(ex.id), ex);
  }
}

async function cacheTripExpensesForLinks(links){
  const ids = Array.from(new Set((links || []).map(l => String(l.expense_id || '')).filter(Boolean)));
  if(!ids.length) return;

  try{ rememberTripExpenses(window.__tripState?.expenses || []); }catch(_){}

  const missing = ids.filter(id => !TRIP_EXPENSE_CACHE.has(String(id)));
  if(!missing.length) return;

  const c = client();
  if(!c) return;

  try{
    const { data, error } = await c
      .from(table('trip_expenses','trip_expenses'))
      .select('id,date,label,amount,currency,category,subcategory,paid_by_member_id,transaction_id,budget_date_start,budget_date_end,trip_id')
      .in('id', missing);
    if(error) throw error;
    rememberTripExpenses(data || []);
  }catch(e){
    console.warn('[TB][assets] trip expense details unavailable', e);
  }
}

async function loadTripExpensesByIds(ids){
  const wanted = Array.from(new Set((ids || []).map(id => String(id || '').trim()).filter(Boolean)));
  if(!wanted.length) return [];

  try{ rememberTripExpenses(window.__tripState?.expenses || []); }catch(_){}
  const existing = wanted.map(id => TRIP_EXPENSE_CACHE.get(id)).filter(Boolean);
  const existingIds = new Set(existing.map(ex => String(ex?.id || '')));
  const missing = wanted.filter(id => !existingIds.has(id));
  if(!missing.length) return existing.map(normalizeTripExpenseRow);

  const c = client();
  if(!c) return existing.map(normalizeTripExpenseRow);

  try{
    const { data, error } = await c
      .from(table('trip_expenses','trip_expenses'))
      .select('id,date,label,amount,currency,category,subcategory,paid_by_member_id,transaction_id,budget_date_start,budget_date_end,trip_id')
      .in('id', missing);
    if(error) throw error;
    rememberTripExpenses(data || []);
    return wanted.map(id => TRIP_EXPENSE_CACHE.get(id)).filter(Boolean).map(normalizeTripExpenseRow);
  }catch(e){
    console.warn('[TB][assets] linked trip expenses unavailable', e);
    return existing.map(normalizeTripExpenseRow);
  }
}

function findTxById(id){
  const sid = String(id || '');
  return (Array.isArray(window.state?.transactions) ? window.state.transactions : [])
    .find(tx => String(tx?.id || '') === sid) || null;
}
function isTripLinkedTransaction(tx){
  if(!tx) return false;

  return !!(
    tx.trip_id ||
    tx.tripId ||
    tx.trip_expense_id ||
    tx.tripExpenseId ||
    tx.source === 'trip' ||
    tx.source_type === 'trip' ||
    tx.origin === 'trip' ||
    tx.generated_from === 'trip'
  );
}
function txDocLine(tx){
  if(!tx) return atxt('Transaction introuvable', 'Transaction not found');

  const date = tx.dateStart || tx.date_start || tx.date || '';
  const amount = tx.amount != null ? `${tx.amount} ${tx.currency || ''}`.trim() : '';
  const label = tx.label || tx.category || 'Transaction';

  return [date, label, amount].filter(Boolean).join(' · ');
}

function assetTransactionLinkTable(){ return table('asset_transaction_links','asset_transaction_links'); }

async function fetchAssetTransactionLinks(assetId){
  const c = client();
  if(!c) return (CACHE.transactionLinks||[]).filter(link=>String(link.asset_id||'')===String(assetId));
  const { data, error } = await c.from(assetTransactionLinkTable()).select('*').eq('asset_id', assetId).order('created_at',{ascending:false});
  if(error) throw error;
  return data || [];
}

async function loadTripExpenseCandidates(){
  const c = client();
  if(!c) return [];
  try{
    let q = c.from(table('trip_expenses','trip_expenses'))
      .select('id,date,label,amount,currency,category,subcategory,paid_by_member_id,transaction_id,budget_date_start,budget_date_end,trip_id')
      .order('date',{ascending:false})
      .limit(60);
    const tid = activeTripId();
    if(tid) q = q.eq('trip_id', tid);
    const { data, error } = await q;
    if(error) throw error;
    rememberTripExpenses(data || []);
    return (data || []).map(normalizeTripExpenseRow);
  }catch(e){
    console.warn('[TB][assets] trip expense candidates unavailable', e);
    return [];
  }
}

function transactionBudgetPatchForAssetLink(link){
  try{
    return window.Core?.assetRules?.buildAssetLinkedTransactionBudgetPatch?.(link) || { out_of_budget:false, affects_budget:true };
  }catch(_){
    const relation = String(link?.relation_type || '').toLowerCase();
    const exclude = !!link?.exclude_from_budget;
    return exclude && ['purchase','sale','financing'].includes(relation)
      ? { out_of_budget:true, affects_budget:false }
      : { out_of_budget:false, affects_budget:true };
  }
}

async function updateLinkedTransactionBudgetFlags(transactionId, link){
  const txId = String(transactionId || '').trim();
  if(!txId) return;
  const c = client();
  if(!c) return;
  const patch = transactionBudgetPatchForAssetLink(link);
  if(!patch.out_of_budget) return;
  const { error } = await c.from(table('transactions','transactions')).update(patch).eq('id', txId);
  if(error) throw error;
  try{
    const row = (Array.isArray(window.state?.transactions) ? window.state.transactions : []).find(tx => String(tx?.id || '') === txId);
    if(row){
      row.outOfBudget = patch.out_of_budget;
      row.out_of_budget = patch.out_of_budget;
      row.affectsBudget = patch.affects_budget;
      row.affects_budget = patch.affects_budget;
      row.assetBudgetExcluded = true;
      row.asset_budget_excluded = true;
    }
  }catch(_){}
}

function findTripExpenseById(id){
  const sid = String(id || '');

  try{
    if(Array.isArray(window.__tripState?.expenses)){
      return window.__tripState.expenses.find(ex => String(ex?.id || '') === sid) || null;
    }
  }catch(_){}

  if(TRIP_EXPENSE_CACHE.has(sid)) return TRIP_EXPENSE_CACHE.get(sid);

  return null;
}

function tripDocLine(ex){
  if(!ex) return atxt('Dépense Trip introuvable', 'Trip expense not found');

  const date = ex.date || '';
  const amount = ex.amount != null ? `${ex.amount} ${ex.currency || ''}`.trim() : '';
  const label = ex.label || ex.category || 'Dépense Trip';

  return [date, label, amount].filter(Boolean).join(' · ');
}

function assetDocsModalHtml(asset, docs, links, message, txLinks, tripLinks, assetTransactionLinks, transactions, tripExpenses){
  return window.UI?.assetView?.renderAssetDocumentsModalSpec?.({
    asset,
    docs,
    links,
    message,
    txLinks,
    tripLinks,
    assetTransactionLinks,
    transactions,
    tripExpenses,
    tr,
    t:atxt,
    esc,
    docLabel,
    docNameLabel,
    findTxById,
    findTripExpenseById,
    isTripLinkedTransaction,
    txDocLine,
    tripDocLine,
  });
}

async function openAssetDocumentsModal(assetId, message){
  const asset = findAsset(assetId);
  if(!asset) return;

  closeModal();

  const docs = await loadDocumentCandidates();
  const links = await fetchAssetDocumentLinks(assetId);
  const docIds = links.map(l => String(l.document_id || '')).filter(Boolean);
  const assetTransactionLinks = await fetchAssetTransactionLinks(assetId);
  const transactions = await loadRecentTransactions();
  const tripExpenses = await loadTripExpenseCandidates();
  const linkedTxIds = assetTransactionLinks.map(link => String(link.transaction_id || link.transactionId || '').trim()).filter(Boolean);
  const linkedTripIds = assetTransactionLinks.map(link => String(link.trip_expense_id || link.tripExpenseId || '').trim()).filter(Boolean);
  const explicitTransactions = await loadTransactionsByIds(linkedTxIds);
  const explicitTripExpenses = await loadTripExpensesByIds(linkedTripIds);
  const transactionMap = new Map(transactions.concat(explicitTransactions).map(tx => [String(tx?.id || ''), tx]));
  const tripMap = new Map(tripExpenses.concat(explicitTripExpenses).map(ex => [String(ex?.id || ''), ex]));

  let txLinks = [];
  let tripLinks = [];

  try{
    txLinks = await fetchDocumentTransactionLinksForDocs(docIds);
  }catch(e){
    console.warn('[TB][assets] document transaction links unavailable', e);
  }

  try{
    tripLinks = await fetchDocumentTripExpenseLinksForDocs(docIds);
  }catch(e){
    console.warn('[TB][assets] document trip links unavailable', e);
  }

  mountAssetModal(assetDocsModalHtml(asset,docs,links,message||'',txLinks,tripLinks,assetTransactionLinks,Array.from(transactionMap.values()),Array.from(tripMap.values())));
}

async function linkAssetDocumentFromForm(form){
  const c = client();
  if(!c) throw new Error(tr('common.supabase_unavailable'));

  const uid = await currentUserId();
  if(!uid) throw new Error(tr('transactions.documents.user_missing'));

  const assetId = form.getAttribute('data-asset-id');
  const asset = findAsset(assetId);

  const fd = new FormData(form);
  const docId = String(fd.get('document_id') || '').trim();

  if(!assetId || !docId) throw new Error(atxt('Choisis un document.', 'Choose a document.'));

  const payload = {
    user_id: uid,
    asset_id: assetId,
    document_id: docId,
    relation_type: String(fd.get('relation_type') || 'proof')
  };

  const { error } = await c.from(assetDocLinkTable()).insert([payload]);
  if(error) throw error;

  if(typeof window.tbDocumentsAddAssetTags === 'function'){
    await window.tbDocumentsAddAssetTags(docId, asset);
  }
}

async function unlinkAssetDocument(linkId){
  const c = client();
  if(!c) throw new Error(tr('common.supabase_unavailable'));
  const { error } = await c.from(assetDocLinkTable()).delete().eq('id', linkId);
  if(error) throw error;
}

async function linkAssetMovementFromForm(form){
  const c = client();
  if(!c) throw new Error(tr('common.supabase_unavailable'));

  const uid = await currentUserId();
  if(!uid) throw new Error(tr('transactions.documents.user_missing'));

  const assetId = form.getAttribute('data-asset-id');
  const fd = new FormData(form);
  const relationType = String(fd.get('asset_movement_relation_type') || 'purchase');
  const txId = String(fd.get('asset_movement_transaction_id') || '').trim();
  const tripExpenseId = String(fd.get('asset_movement_trip_expense_id') || '').trim();
  if(!assetId || (!txId && !tripExpenseId)) throw new Error(atxt('Choisis une transaction ou une dépense Trip.', 'Choose a transaction or Trip expense.'));

  let resolvedTxId = txId || null;
  if(!resolvedTxId && tripExpenseId){
    const trip = findTripExpenseById(tripExpenseId);
    resolvedTxId = String(trip?.transactionId || trip?.transaction_id || '').trim() || null;
  }

  const payload = {
    user_id: uid,
    asset_id: assetId,
    transaction_id: resolvedTxId,
    trip_expense_id: tripExpenseId || null,
    relation_type: tripExpenseId && relationType === 'purchase' ? 'trip_expense' : relationType,
    exclude_from_budget: fd.get('asset_movement_exclude_budget') === 'on',
  };

  const { error } = await c.from(assetTransactionLinkTable()).insert([payload]);
  if(error) throw error;
  await updateLinkedTransactionBudgetFlags(resolvedTxId, payload);
}

async function unlinkAssetMovement(linkId){
  const c = client();
  if(!c) throw new Error(tr('common.supabase_unavailable'));
  const { error } = await c.from(assetTransactionLinkTable()).delete().eq('id', linkId);
  if(error) throw error;
}

async function openLinkedTransactionEditor(txId){
  const id = String(txId || '').trim();
  if(!id) return;
  await loadTransactionsByIds([id]);
  closeModal();
  if(typeof window.openTxEditModal === 'function'){
    window.openTxEditModal(id);
    return;
  }
  window.__tbFocusTransactionId = id;
  if(typeof showView === 'function') showView('transactions');
}

async function openLinkedTripExpenseEditor(expenseId){
  const id = String(expenseId || '').trim();
  if(!id) return;
  const rows = await loadTripExpensesByIds([id]);
  const expense = rows.find(row => String(row?.id || '') === id) || findTripExpenseById(id);
  closeModal();
  if(typeof showView === 'function') showView('trip');
  try{
    if(typeof window.tbLoadLegacyDomain === 'function') await window.tbLoadLegacyDomain('trip');
  }catch(_){}
  if(typeof window.tbTripEditExpense === 'function'){
    await window.tbTripEditExpense(id, { tripId: expense?.trip_id || expense?.tripId || null });
    return;
  }
  window.__tbFocusTripExpenseId = id;
}

  function showFormError(msg){ const el=assetModal?.root?.querySelector('[data-tb-asset-error]'); if(el){ el.hidden=false; el.textContent=String(msg || tr('assets.error.unknown')); } }

  function readAssetPayload(form){ const fd = new FormData(form); const purchase = Number(fd.get('purchase_value') || 0); const residual = Number(fd.get('residual_value') || 0); const months = Math.round(Number(fd.get('depreciation_months') || 0)); const currency = String(fd.get('currency') || 'EUR').trim().toUpperCase(); const name = String(fd.get('name') || '').trim(); const purchaseDate=String(fd.get('purchase_date') || today()).slice(0,10); const budgetMethod=String(fd.get('budget_method')||'linear'); const overrideRaw=String(fd.get('monthly_budget_override')||'').trim(); const override=overrideRaw===''?null:Number(overrideRaw); const budgetDay=Math.round(Number(fd.get('budget_day')||String(purchaseDate).slice(8,10)||1)); if(!name) throw new Error(tr('assets.error.name_required')); if(!Number.isFinite(purchase) || purchase < 0) throw new Error(tr('assets.error.invalid_purchase')); if(!Number.isFinite(residual) || residual < 0 || residual > purchase) throw new Error(tr('assets.error.invalid_residual')); if(!Number.isFinite(months) || months < 1) throw new Error(tr('assets.error.invalid_months')); if(!/^[A-Z]{3}$/.test(currency)) throw new Error(tr('assets.error.invalid_currency')); if(budgetMethod==='manual' && (!Number.isFinite(override)||override<0)) throw new Error(atxt('Saisis un montant mensuel valide.', 'Enter a valid monthly amount.')); if(!Number.isFinite(budgetDay)||budgetDay<1||budgetDay>31) throw new Error(atxt('Le jour mensuel doit être compris entre 1 et 31.', 'Monthly day must be between 1 and 31.')); return { name, asset_type:String(fd.get('asset_type') || 'other'), purchase_value:purchase, residual_value:residual, currency, purchase_date:purchaseDate, depreciation_months:months, status:'active', include_in_budget:fd.get('include_in_budget')==='on', budget_method:budgetMethod, monthly_budget_override:override, budget_start_date:String(fd.get('budget_start_date')||purchaseDate).slice(0,10), budget_end_date:String(fd.get('budget_end_date')||'').slice(0,10)||null, budget_day:budgetDay, budget_category:'Patrimoine', budget_subcategory:'Amortissement' }; }
  async function createAssetFromForm(form){ const c = client(); if(!c) throw new Error(tr('common.supabase_unavailable')); const uid = await currentUserId(); if(!uid) throw new Error(tr('assets.error.user_disconnected')); const payload = Object.assign(readAssetPayload(form), { user_id: uid, travel_id: activeTravelId() || null }); const ownership = Number(new FormData(form).get('ownership_percent') || 0); if(!Number.isFinite(ownership) || ownership < 0 || ownership > 100) throw new Error(tr('assets.error.share_between_0_100')); const res = await c.from(table('assets','assets')).insert([payload]).select('id').single(); if(res.error) throw res.error; const ownerPayload = { asset_id: res.data.id, user_id: uid, display_name: tr('assets.owner.me'), ownership_percent: ownership }; const ownerRes = await c.from(table('asset_owners','asset_owners')).insert([ownerPayload]); if(ownerRes.error) throw ownerRes.error; }
async function updateAssetFromForm(form){
  const c = client();
  if(!c) throw new Error(tr('common.supabase_unavailable'));

  const assetId = form.getAttribute('data-asset-id');
  if(!assetId) throw new Error(tr('transactions.error.not_found'));

  const oldAsset = findAsset(assetId);
  const oldName = String(oldAsset?.name || '').trim();

  const payload = readAssetPayload(form);
  const newName = String(payload.name || '').trim();

  const res = await c.from(table('assets','assets'))
    .update(payload)
    .eq('id', assetId);

  if(res.error) throw res.error;

  if(typeof window.tbDocumentsSyncAssetRename === 'function'){
    await window.tbDocumentsSyncAssetRename(assetId, oldName, newName);
  }
}
  async function archiveAsset(assetId){ const c = client(); if(!c) throw new Error(tr('common.supabase_unavailable')); const res = await c.from(table('assets','assets')).update({ status:'archived' }).eq('id', assetId); if(res.error) throw res.error; }
  function readOwnerRows(form){ const rows = Array.from(form.querySelectorAll('.tb-owner-row')).map(row=>({ id: row.getAttribute('data-owner-id') || '', display_name: String(row.querySelector('[name="owner_name"]')?.value || '').trim(), ownership_percent: Number(row.querySelector('[name="owner_percent"]')?.value || 0) })).filter(r=>r.display_name); if(!rows.length) throw new Error(tr('assets.error.owner_required')); rows.forEach(r=>{ if(!Number.isFinite(r.ownership_percent) || r.ownership_percent < 0 || r.ownership_percent > 100) throw new Error(tr('assets.error.owner_share_between_0_100')); }); const total = totalPercent(rows); if(Math.abs(total - 100) > 0.01) throw new Error(tr('assets.error.total_shares', { total })); return rows; }
  async function saveOwnersFromForm(form){ const c = client(); if(!c) throw new Error(tr('common.supabase_unavailable')); const assetId = form.getAttribute('data-asset-id'); if(!assetId) throw new Error(tr('transactions.error.not_found')); const uid = await currentUserId(); const rows = readOwnerRows(form); const existing = ownerRows(assetId); const keepIds = rows.filter(r=>r.id).map(r=>String(r.id)); for(const old of existing){ if(old.id && !keepIds.includes(String(old.id))){ const del = await c.from(table('asset_owners','asset_owners')).delete().eq('id', old.id); if(del.error) throw del.error; } } for(const r of rows){ const payload = { asset_id: assetId, display_name:r.display_name, ownership_percent:r.ownership_percent }; if(r.id){ const up = await c.from(table('asset_owners','asset_owners')).update(payload).eq('id', r.id); if(up.error) throw up.error; } else { const ins = await c.from(table('asset_owners','asset_owners')).insert([Object.assign(payload, /toi|moi/i.test(r.display_name) && uid ? { user_id:uid } : {})]); if(ins.error) throw ins.error; } } }
  async function saveTransferFromForm(form){ const c = client(); if(!c) throw new Error(tr('common.supabase_unavailable')); const assetId = form.getAttribute('data-asset-id'); const asset=findAsset(assetId); if(!asset) throw new Error(tr('transactions.error.not_found')); const fd = new FormData(form); const fromId = String(fd.get('from_owner_id')||''); const toId = String(fd.get('to_owner_id')||''); if(!fromId || !toId || fromId === toId) throw new Error(tr('assets.error.choose_two_owners')); const percent = Number(fd.get('percent')||0); if(!Number.isFinite(percent) || percent <= 0) throw new Error(tr('assets.error.invalid_transfer_share')); const rows = ownerRows(assetId); const from = rows.find(r=>String(r.id)===fromId); const to = rows.find(r=>String(r.id)===toId); if(!from || !to) throw new Error(tr('assets.error.owner_not_found')); if(n(from.ownership_percent,0) < percent) throw new Error(tr('assets.error.owner_not_enough_share', { name: from.display_name })); const nextFrom = Math.round((n(from.ownership_percent,0)-percent)*100)/100; const nextTo = Math.round((n(to.ownership_percent,0)+percent)*100)/100; const up1 = await c.from(table('asset_owners','asset_owners')).update({ ownership_percent: nextFrom }).eq('id', fromId); if(up1.error) throw up1.error; const up2 = await c.from(table('asset_owners','asset_owners')).update({ ownership_percent: nextTo }).eq('id', toId); if(up2.error) throw up2.error; const linkedTxId = String(fd.get('linked_transaction_id') || '').trim() || null;

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
  if(!c) throw new Error(tr('common.supabase_unavailable'));

  const assetId = form.getAttribute('data-asset-id');
  const asset = findAsset(assetId);
  if(!asset) throw new Error(tr('transactions.error.not_found'));

  const rows = ownerRows(assetId);
  if(!rows.length) throw new Error(tr('assets.error.no_coowner_found'));

  const fd = new FormData(form);
  const totalAmount = Number(fd.get('amount') || 0);
  if(!Number.isFinite(totalAmount) || totalAmount < 0) throw new Error(tr('assets.error.invalid_sale_price'));

  const currency = String(fd.get('currency') || asset.currency || 'EUR').trim().toUpperCase();
  if(!/^[A-Z]{3}$/.test(currency)) throw new Error(tr('assets.error.invalid_currency'));

  const eventDate = String(fd.get('event_date') || today()).slice(0,10);
  const linkedTxId = String(fd.get('linked_transaction_id') || '').trim() || null;
  const note = String(fd.get('note') || '').trim() || 'Full asset sale';

  const total = totalPercent(rows);
  if(Math.abs(total - 100) > 0.01){
    throw new Error(tr('assets.error.sale_total_shares', { total }));
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
  function bindOnce(){ if(window.__tbAssetsUiBound) return; window.__tbAssetsUiBound = true; document.addEventListener('click', async function(ev){ const open = ev.target && ev.target.closest && ev.target.closest('[data-tb-asset-open]'); if(open){ ev.preventDefault(); openAssetModal('create'); return; } const edit = ev.target && ev.target.closest && ev.target.closest('[data-tb-asset-edit]'); if(edit){ ev.preventDefault(); openAssetModal('edit', edit.getAttribute('data-tb-asset-edit')); return; } const owners = ev.target && ev.target.closest && ev.target.closest('[data-tb-asset-owners]'); if(owners){ ev.preventDefault(); openOwnersModal(owners.getAttribute('data-tb-asset-owners')); return; } const transfer = ev.target && ev.target.closest && ev.target.closest('[data-tb-asset-transfer]'); if(transfer){ ev.preventDefault(); await openTransferModal(transfer.getAttribute('data-tb-asset-transfer')); return; }
  const docs = ev.target && ev.target.closest && ev.target.closest('[data-tb-asset-docs]'); if(docs){ ev.preventDefault(); openAssetDocumentsModal(docs.getAttribute('data-tb-asset-docs')); return; } 
  const uploadAssetDoc = ev.target && ev.target.closest && ev.target.closest('[data-tb-asset-doc-upload]');
if(uploadAssetDoc){
  ev.preventDefault();
  addDocumentToAsset(uploadAssetDoc.getAttribute('data-tb-asset-doc-upload'));
  return;
}
const linkMovement = ev.target && ev.target.closest && ev.target.closest('[data-tb-asset-link-movement]');
if(linkMovement){
  ev.preventDefault();
  const form = linkMovement.closest('[data-tb-asset-docs-form]');
  const aid = form?.getAttribute('data-asset-id') || '';
  try{
    await linkAssetMovementFromForm(form);
    await renderAssets('asset-movement-linked');
    await openAssetDocumentsModal(aid, atxt('Mouvement lié à l’asset.', 'Movement linked to asset.'));
  }catch(e){
    alert(e && (e.message || e.code) || e);
  }
  return;
}
const unlinkMovement = ev.target && ev.target.closest && ev.target.closest('[data-tb-asset-unlink-movement]');
if(unlinkMovement){
  ev.preventDefault();
  const form = unlinkMovement.closest('[data-tb-asset-docs-form]');
  const aid = form?.getAttribute('data-asset-id') || '';
  if(confirm(atxt('Délier ce mouvement ?', 'Unlink this movement?'))){
    try{
      await unlinkAssetMovement(unlinkMovement.getAttribute('data-tb-asset-unlink-movement'));
      await renderAssets('asset-movement-unlinked');
      await openAssetDocumentsModal(aid, atxt('Mouvement délié.', 'Movement unlinked.'));
    }catch(e){
      alert(e && (e.message || e.code) || e);
    }
  }
  return;
}
  
  const openDoc = ev.target && ev.target.closest && ev.target.closest('[data-tb-asset-open-doc]'); if(openDoc){ ev.preventDefault(); const docId=openDoc.getAttribute('data-tb-asset-open-doc'); closeModal(); if(typeof showView==='function') showView('documents'); try{ if(typeof window.tbDocumentsPreview !== 'function' && typeof window.tbLoadLegacyDomain === 'function') await window.tbLoadLegacyDomain('documents'); window.tbDocumentsPreview?.(docId); }catch(_){} return; } const unlinkDoc = ev.target && ev.target.closest && ev.target.closest('[data-tb-asset-unlink-doc]'); if(unlinkDoc){ ev.preventDefault(); const form=unlinkDoc.closest('[data-tb-asset-docs-form]'); const aid=form?.getAttribute('data-asset-id')||''; if(confirm(atxt('Délier ce document ?', 'Unlink this document?'))){ try{ await unlinkAssetDocument(unlinkDoc.getAttribute('data-tb-asset-unlink-doc')); await renderAssets('asset-doc-unlinked'); await openAssetDocumentsModal(aid, atxt('Document délié.', 'Document unlinked.')); }catch(e){ alert(e && (e.message||e.code) || e); } } return; } const sellAsset = ev.target && ev.target.closest && ev.target.closest('[data-tb-asset-sell]');
if(sellAsset){
  ev.preventDefault();
  openSellAssetModal(sellAsset.getAttribute('data-tb-asset-sell'));
  return;
} 
const openTx = ev.target && ev.target.closest && ev.target.closest('[data-tb-asset-open-tx]');
if(openTx){
  ev.preventDefault();
  const txId = openTx.getAttribute('data-tb-asset-open-tx');
  await openLinkedTransactionEditor(txId);
  return;
}

const openTripExpense = ev.target && ev.target.closest && ev.target.closest('[data-tb-asset-open-trip-expense]');
if(openTripExpense){
  ev.preventDefault();
  const expenseId = openTripExpense.getAttribute('data-tb-asset-open-trip-expense');
  await openLinkedTripExpenseEditor(expenseId);
  return;
}
const archive = ev.target && ev.target.closest && ev.target.closest('[data-tb-asset-archive]'); if(archive){ ev.preventDefault(); if(confirm(tr('assets.confirm.archive'))){ try{ await archiveAsset(archive.getAttribute('data-tb-asset-archive')); await renderAssets('asset-archived'); }catch(e){ alert(e && (e.message||e.code) || e); } } return; } const close = ev.target && ev.target.closest && ev.target.closest('[data-tb-asset-close]'); if(close){ ev.preventDefault(); closeModal(); return; } const addOwner = ev.target && ev.target.closest && ev.target.closest('[data-tb-owner-add]'); if(addOwner){ ev.preventDefault(); const list=document.querySelector('[data-tb-owner-list]'); if(list){ list.insertAdjacentHTML('beforeend', ownerRowHtml({id:'',display_name:'',ownership_percent:0})); refreshOwnerTotal(); } return; } const remOwner = ev.target && ev.target.closest && ev.target.closest('[data-tb-owner-remove]'); if(remOwner){ ev.preventDefault(); const row=remOwner.closest('.tb-owner-row'); if(row) row.remove(); refreshOwnerTotal(); return; } }); document.addEventListener('input', function(ev){ if(ev.target && ev.target.matches && ev.target.matches('[name="owner_percent"]')) refreshOwnerTotal(); }); document.addEventListener('submit', async function(ev){ const form = ev.target && ev.target.matches && ev.target.matches('[data-tb-asset-form], [data-tb-asset-owners-form], [data-tb-asset-transfer-form], [data-tb-asset-sell-form], [data-tb-asset-docs-form]') ? ev.target : null; if(!form) return; ev.preventDefault(); const submit = assetModal?.root?.querySelector('[data-tb-asset-submit]') || form.querySelector('button[type="submit"]'); const oldTxt = submit ? submit.textContent : ''; if(submit){ submit.disabled = true; submit.textContent = tr('common.saving'); } try{ if(form.matches('[data-tb-asset-owners-form]')) await saveOwnersFromForm(form); else if(form.matches('[data-tb-asset-docs-form]')){ const aid=form.getAttribute('data-asset-id'); await linkAssetDocumentFromForm(form); await renderAssets('asset-doc-linked'); await openAssetDocumentsModal(aid, atxt('Document lié.', 'Document linked.')); return; } else if(form.matches('[data-tb-asset-transfer-form]')) await saveTransferFromForm(form);
else if(form.matches('[data-tb-asset-sell-form]')) await saveTotalAssetSaleFromForm(form);
else if(form.getAttribute('data-tb-asset-form') === 'edit') await updateAssetFromForm(form); else await createAssetFromForm(form); closeModal(); await renderAssets('asset-saved'); }catch(e){ console.error('[TB][assets] save failed', e); showFormError(e && (e.message || e.details || e.code) ? (e.message || e.details || e.code) : e); } finally{ if(submit){ submit.disabled = false; submit.textContent = oldTxt || tr('documents.action.save'); } } }); }
async function addDocumentToAsset(assetId){
  const input = document.createElement('input');
  input.type = 'file';
  input.multiple = true;
  input.accept = 'image/*,application/pdf,.pdf,.jpg,.jpeg,.png,.webp,.heic,.doc,.docx,.xls,.xlsx';

  input.onchange = async function(){
    const files = input.files;
    if(!files || !files.length) return;

    try{
      if(typeof window.tbDocumentsUploadAndLinkAsset !== 'function' && typeof window.tbLoadLegacyDomain === 'function'){
        await window.tbLoadLegacyDomain('documents');
      }
      if(typeof window.tbDocumentsUploadAndLinkAsset !== 'function'){
        throw new Error('Module Documents non chargé.');
      }

      const asset = findAsset(assetId);
      await window.tbDocumentsUploadAndLinkAsset(files, asset);
      await renderAssets('asset-doc-uploaded');
      await openAssetDocumentsModal(assetId, atxt('Document ajouté et lié.', 'Document uploaded and linked.'));
    }catch(e){
      alert(e && (e.message || e.code) || e);
    }
  };

  input.click();
}

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
.tb-assets-summary-note{grid-column:1/-1;border:1px solid rgba(245,158,11,.24);background:#fffbeb;color:#92400e;border-radius:14px;padding:9px 11px;font-size:12px;font-weight:800}
.tb-asset-card{border:1px solid rgba(15,23,42,.08);border-radius:24px;background:linear-gradient(180deg,#ffffff,#f7f9fc);padding:18px;box-shadow:0 18px 40px rgba(15,23,42,.08);transition:transform .2s ease,box-shadow .2s ease}.tb-asset-card:hover{transform:scale(1.01);box-shadow:0 24px 60px rgba(15,23,42,.12)}.tb-asset-top{display:flex;justify-content:space-between;gap:12px}.tb-asset-kicker{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#64748b;font-weight:900}.tb-asset-top h3{margin:4px 0 3px;font-size:20px;color:#0f172a}.tb-asset-top p{margin:0;color:#64748b;font-size:12px}.tb-asset-top span{height:max-content;border-radius:999px;background:#e0f7fb;color:#0891b2;border:1px solid rgba(8,145,178,.16);padding:7px 10px;font-size:12px;font-weight:800}.tb-asset-metrics{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:16px}.tb-asset-metrics>div{border-radius:18px;background:linear-gradient(180deg,#f8fafc,#eef2f7);border:1px solid rgba(15,23,42,.06);padding:13px}.tb-asset-metrics small{display:block;color:#64748b;font-size:11px}.tb-asset-metrics strong{display:block;margin-top:4px;font-size:24px;letter-spacing:-.03em;color:#0f172a}.tb-asset-primary strong{font-size:30px}.tb-asset-metrics em{display:block;margin-top:3px;color:#0891b2;font-style:normal;font-size:12px}.tb-asset-metrics em.loss{color:#e11d48}
.tb-asset-facts{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
.tb-asset-facts span{font-size:11px;color:#475569;background:#f8fafc;border:1px solid rgba(15,23,42,.08);border-radius:999px;padding:6px 9px}
.tb-asset-facts strong{color:#0f172a}
.tb-asset-facts span.done{background:#ecfdf5;color:#047857;border-color:rgba(4,120,87,.18);font-weight:900}
.tb-asset-metrics em.depr{color:#ea580c}.tb-asset-progress{margin-top:16px}.tb-asset-progress div{display:flex;justify-content:space-between;color:#64748b;font-size:11px;margin-bottom:7px}.tb-asset-progress b{display:block;height:8px;background:#e2e8f0;border-radius:999px;overflow:hidden}.tb-asset-progress i{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#06b6d4,#8b5cf6)}.tb-asset-chart{height:86px;margin-top:14px;border-radius:18px;background:linear-gradient(180deg,#eef2f7,#e5eaf1);border:1px solid rgba(15,23,42,.07)}.tb-asset-owners{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.tb-asset-owners span{font-size:11px;color:#334155;border:1px solid rgba(15,23,42,.10);border-radius:999px;padding:6px 9px;background:#f8fafc}.tb-asset-owner-warning{background:#fff7ed!important;color:#c2410c!important;border-color:rgba(194,65,12,.22)!important}.tb-asset-events{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.tb-asset-events span{font-size:11px;color:#64748b;background:#eef2ff;border:1px solid rgba(99,102,241,.16);border-radius:999px;padding:6px 9px}.tb-assets-help,.tb-asset-action-hint{border:1px solid rgba(14,165,233,.22);background:#ecfeff;color:#075985;border-radius:12px;padding:10px 12px;font-size:12px;font-weight:800;line-height:1.35}.tb-assets-help{display:flex;justify-content:space-between;gap:10px;margin:0 0 14px}.tb-assets-help strong{font-size:13px;color:#0f172a}.tb-asset-action-hint{margin-top:12px}.tb-asset-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.tb-asset-actions button{border:1px solid rgba(15,23,42,.10);background:#fff;color:#0f172a;border-radius:12px;padding:8px 10px;font-size:12px;font-weight:900;cursor:pointer}.tb-asset-actions button.primary{background:#0f172a;color:#fff;border-color:#0f172a}.tb-asset-actions button.primary.soft{background:#e0f2fe;color:#075985;border-color:rgba(14,165,233,.32)}.tb-asset-actions button.danger{color:#be123c;background:#fff1f2;border-color:rgba(225,29,72,.20)}
.tb-asset-doc-list{display:grid;gap:8px;max-height:260px;overflow:auto}.tb-asset-doc-row{display:flex;justify-content:space-between;gap:10px;align-items:center;border:1px solid rgba(15,23,42,.08);border-radius:16px;background:#f8fafc;padding:10px}.tb-asset-doc-row strong{font-size:13px;color:#0f172a}.tb-asset-doc-row span{font-size:12px;color:#64748b}.tb-asset-doc-row>div:last-child{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}.tb-asset-doc-row button{border:1px solid rgba(15,23,42,.10);background:#fff;color:#0f172a;border-radius:12px;padding:7px 9px;font-size:12px;font-weight:900;cursor:pointer}.tb-asset-doc-empty{border:1px dashed rgba(15,23,42,.16);border-radius:16px;background:#f8fafc;padding:12px;color:#64748b;font-size:13px}
.tb-asset-doc-row.tree{
  align-items:flex-start;
}

.tb-asset-doc-linked-tree{
  margin-top:10px;
  display:grid;
  gap:6px;
  padding:9px;
  border-radius:14px;
  background:#fff;
  border:1px solid rgba(15,23,42,.08);
}

.tb-asset-doc-linked-tree strong{
  font-size:11px;
  color:#64748b;
  text-transform:uppercase;
  letter-spacing:.08em;
}

.tb-asset-doc-linked-line{
  display:flex;
  align-items:center;
  gap:8px;
  flex-wrap:wrap;
}

.tb-asset-doc-linked-line span{
  font-size:11px;
  font-weight:900;
  color:#0891b2;
  border:1px solid rgba(8,145,178,.16);
  background:#e0f7fb;
  border-radius:999px;
  padding:4px 7px;
}

.tb-asset-doc-linked-line span.trip{
  color:#7c3aed;
  border-color:rgba(124,58,237,.18);
  background:#ede9fe;
}

.tb-asset-doc-linked-line button{
  border:0;
  background:transparent;
  color:#0f172a;
  padding:0;
  font-size:12px;
  font-weight:800;
  text-align:left;
  cursor:pointer;
}

.tb-asset-doc-linked-line button:hover{
  text-decoration:underline;
}

.tb-asset-doc-linked-empty{
  margin-top:8px;
  font-size:12px;
  color:#94a3b8;
}
.tb-asset-movement-panel{display:grid;gap:12px;border:1px solid rgba(14,165,233,.16);border-radius:18px;background:linear-gradient(180deg,#f0fdfa,#f8fafc);padding:12px;margin-bottom:14px}
.tb-asset-movement-head{display:grid;gap:4px}.tb-asset-movement-head strong{font-size:14px;color:#0f172a}.tb-asset-movement-head span{font-size:12px;color:#64748b;line-height:1.35}.tb-asset-movement-list{display:grid;gap:8px}.tb-asset-movement-row{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;border:1px solid rgba(15,23,42,.08);border-radius:14px;background:#fff;padding:10px}.tb-asset-movement-row div{display:grid;gap:3px}.tb-asset-movement-row strong{font-size:13px;color:#0f172a}.tb-asset-movement-row span,.tb-asset-movement-row em{font-size:12px;color:#64748b;font-style:normal}.tb-asset-movement-row em{color:#0f766e;font-weight:800}.tb-asset-movement-actions{display:flex!important;flex-wrap:wrap;justify-content:flex-end;gap:6px;min-width:130px}.tb-asset-movement-row button,.tb-asset-link-movement-btn{border:1px solid rgba(15,23,42,.10);background:#fff;color:#0f172a;border-radius:12px;padding:7px 9px;font-size:12px;font-weight:900;cursor:pointer}.tb-asset-link-movement-btn{justify-self:flex-start;background:#0f172a;color:#fff}
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

.tb-assets-shared-modal .tb-ui-modal__body{background:var(--panel,#fff)}.tb-asset-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.tb-asset-form-grid label{display:grid;gap:6px;color:var(--muted,#475569);font-size:12px;font-weight:800}.tb-asset-form-grid input,.tb-asset-form-grid select{width:100%;border:1px solid var(--border,rgba(15,23,42,.12));border-radius:8px;background:var(--panel2,#f8fafc);color:var(--text,#0f172a);padding:10px 11px;font-size:14px}.tb-asset-form-grid .tb-asset-check{display:flex;align-items:center;gap:9px;padding:10px 11px;border:1px solid rgba(14,165,233,.22);border-radius:8px;background:rgba(14,165,233,.07)}.tb-asset-form-grid .tb-asset-check input{width:18px;height:18px;margin:0}.tb-asset-budget-toggle{grid-column:1/-1}.tb-asset-budget-toggle span{display:grid;gap:3px}.tb-asset-budget-toggle small{font-size:12px;color:#64748b;line-height:1.35}.tb-asset-modal-error{margin-top:12px;border:1px solid rgba(225,29,72,.25);background:#fff1f2;color:#be123c;border-radius:8px;padding:10px;font-size:13px}.tb-asset-doc-message{border-color:rgba(8,145,178,.25);background:#ecfeff;color:#0e7490}.tb-owner-list{display:grid;gap:10px}.tb-owner-row{display:grid;grid-template-columns:1fr 130px 38px;gap:8px}.tb-owner-row input{border:1px solid var(--border,rgba(15,23,42,.12));border-radius:8px;background:var(--panel2,#f8fafc);color:var(--text,#0f172a);padding:10px 11px;font-size:14px}.tb-owner-row button,.tb-owner-add{border:0;border-radius:8px;background:var(--panel2,#f1f5f9);color:var(--text,#334155);font-weight:900;cursor:pointer}.tb-owner-add{margin-top:12px;padding:10px 12px}.tb-owner-total{margin-top:10px;font-size:13px;color:#be123c;font-weight:900}.tb-owner-total.ok{color:#0891b2}@media(max-width:720px){.tb-assets-head,.tb-assets-empty{flex-direction:column;align-items:stretch}.tb-asset-metrics,.tb-asset-form-grid,.tb-owner-row{grid-template-columns:1fr}.tb-assets-actions{align-items:flex-start}}
  `; document.head.appendChild(st); }

  async function renderAssets(reason){ styles(); bindOnce(); const root = document.getElementById('assets-root') || document.getElementById('view-assets'); if(!root) return; root.innerHTML = `<div class="tb-assets-shell"><div class="tb-assets-head"><div><h2>${esc(tr('assets.title'))}</h2><p>${esc(tr('common.loading'))}</p></div></div></div>`; const data = await loadAssets(); const summary = data.empty ? '' : portfolioSummaryHtml(data.assets, data.owners);
const help = `<div class="tb-assets-help"><strong>${esc(atxt('Patrimoine V2', 'Assets V2'))}</strong><span>${esc(atxt('Budget / amortissement modifie l’inclusion budget. Achats liés et Dépenses annexes ouvrent les transactions, Trip et documents liés à l’asset.', 'Budget / depreciation edits budget inclusion. Linked purchases and Annex expenses open transactions, Trip expenses and documents linked to the asset.'))}</span></div>`;
const content = data.empty ? emptyState() : `${summary}${help}<div class="tb-assets-grid">${data.assets.map(a=>card(a,data.owners)).join('')}</div>`; const buildLabel = window.TB_BUILD_LABEL || 'V9'; root.innerHTML = `<div class="tb-assets-shell"><div class="tb-assets-head"><div><h2>${esc(tr('assets.title'))}</h2><p>${esc(tr('assets.subtitle'))} ${data.demo ? esc(tr('assets.demo_hint')) : ''}</p></div><div class="tb-assets-actions"><button class="tb-asset-add-btn" type="button" data-tb-asset-open>${esc(tr('assets.action.add'))}</button><div class="tb-assets-badge">${esc(buildLabel)} · Assets</div></div></div>${content}</div>`; if(!data.empty) setTimeout(()=>renderCharts(data.assets),0); }
  window.renderAssets = renderAssets;
  window.tbLoadAssets = loadAssets;
  window.tbAssetBudgetTransactionsForRange = assetBudgetRows;
  window.addEventListener('tb:auth_scope_changed', () => {
    CACHE = { assets:[], owners:[], events:[], documentLinks:[], transactionLinks:[], demo:false, empty:true };
    loadAssets().then(() => { try { window.tbRequestRenderAll?.('assets:auth'); } catch (_) {} }).catch(() => {});
  });
  setTimeout(() => {
    currentUserId().then(id => id ? loadAssets() : null).then(() => { try { window.renderKPI?.(); } catch (_) {} }).catch(() => {});
  }, 700);
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
