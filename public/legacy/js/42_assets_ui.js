/* TravelBudget V9.6.0 - Assets UI
   Futuristic asset cards + linear depreciation preview. Safe if SQL tables are not deployed yet. */
(function(){
  const FALLBACK_ASSETS = [{
    id:'demo-car', name:'Toyota X-Trail', asset_type:'car', purchase_value:5000, residual_value:1400,
    currency:'EUR', purchase_date:new Date(new Date().getFullYear(), Math.max(0,new Date().getMonth()-22), 1).toISOString().slice(0,10), depreciation_months:36, status:'active'
  }];
  const FALLBACK_OWNERS = [{ asset_id:'demo-car', display_name:'Toi', ownership_percent:50 }, { asset_id:'demo-car', display_name:'Co-owner', ownership_percent:50 }];
  function esc(v){ try { return escapeHTML(String(v ?? '')); } catch(_) { return String(v ?? '').replace(/[&<>'"]/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[c])); } }
  function money(v, cur){ try { return fmtMoney(v, cur); } catch(_) { return `${Math.round(Number(v||0)).toLocaleString('fr-FR')} ${cur||''}`; } }
  function icon(t){ return ({ car:'🚗', real_estate:'🏠', equipment:'🎒', other:'💠' })[t] || '💠'; }
  function label(t){ return ({ car:'Voiture', real_estate:'Immo', equipment:'Matériel', other:'Autre' })[t] || 'Autre'; }
  function client(){ try{ if(typeof sb !== 'undefined' && sb && sb.from) return sb; }catch(_){} try{ if(window.sb && window.sb.from) return window.sb; }catch(_){} return null; }
  function activeTravelId(){ try{ return String(window.state?.activeTravelId || window.state?.period?.travel_id || '').trim(); }catch(_){ return ''; } }
  async function loadAssets(){
    const c = client();
    if(!c) return { assets:FALLBACK_ASSETS, owners:FALLBACK_OWNERS, demo:true, reason:'client-missing' };
    try{
      let q = c.from(TB_CONST.TABLES.assets).select('*').order('created_at',{ascending:false});
      const tid = activeTravelId(); if(tid) q = q.or(`travel_id.eq.${tid},travel_id.is.null`);
      const { data, error } = await q;
      if(error) throw error;
      const assets = (data||[]).map(window.TBAssetsCore.normalizeAsset);
      if(!assets.length) return { assets:FALLBACK_ASSETS, owners:FALLBACK_OWNERS, demo:true, reason:'empty' };
      const ids = assets.map(a=>a.id);
      const ownersRes = await c.from(TB_CONST.TABLES.asset_owners).select('*').in('asset_id', ids);
      return { assets, owners: ownersRes.error ? [] : (ownersRes.data||[]), demo:false };
    }catch(e){
      console.warn('[TB][assets] fallback preview used', e);
      return { assets:FALLBACK_ASSETS, owners:FALLBACK_OWNERS, demo:true, reason:e && (e.message || e.code) };
    }
  }
  function ownerRows(asset, owners){ return (owners||[]).filter(o=>String(o.asset_id)===String(asset.id)); }
  function minePercent(rows){ const me = rows.find(r=>/toi|moi/i.test(String(r.display_name||''))); return Number(me?.ownership_percent ?? rows[0]?.ownership_percent ?? 100); }
  function card(asset, owners){
  const core = window.TBAssetsCore;
  const current = core.computeLinearAssetValue(asset);
  const progress = core.computeDepreciationProgress(asset);
  const pctLoss = asset.purchase_value ? Math.round(((asset.purchase_value-current)/asset.purchase_value)*100) : 0;
  const lossAmount = Math.max(0, Number(asset.purchase_value || 0) - Number(current || 0));
  const rows = ownerRows(asset, owners);
  const ownPct = minePercent(rows);
  const ownValue = core.computeOwnedValue(asset, ownPct);
  const width = Math.round(progress.ratio*100);

  return `<section class="tb-asset-card" data-asset-id="${esc(asset.id)}">
    <div class="tb-asset-top">
      <div>
        <div class="tb-asset-kicker">Asset</div>
        <h3>${icon(asset.asset_type)} ${esc(asset.name)}</h3>
        <p>Acheté le ${esc(asset.purchase_date)}</p>
      </div>
      <span>${esc(label(asset.asset_type))}</span>
    </div>

    <div class="tb-asset-metrics">
      <div class="tb-asset-primary">
        <small>Ta valeur</small>
        <strong>${esc(money(ownValue,asset.currency))}</strong>
        <em>${ownPct}% de l’asset</em>
      </div>
      <div>
        <small>Valeur actuelle</small>
        <strong>${esc(money(current,asset.currency))}</strong>
        <em class="loss">-${esc(money(lossAmount,asset.currency))} · -${pctLoss}%</em>
      </div>
    </div>

    <div class="tb-asset-progress">
      <div>
        <small>Amortissement</small>
        <small>${width}% utilisé</small>
      </div>
      <b><i style="width:${width}%"></i></b>
    </div>

    <div class="tb-asset-chart" id="asset-chart-${esc(asset.id)}"></div>

    <div class="tb-asset-owners">
      ${rows.length ? rows.map(r=>`<span>${esc(r.display_name)} · ${Number(r.ownership_percent||0)}%</span>`).join('') : '<span>Ownership non renseigné · 100%</span>'}
    </div>
  </section>`;
}
  function renderCharts(assets){
    if(!window.echarts) return;
    for(const asset of assets){
      const el = document.getElementById(`asset-chart-${asset.id}`); if(!el) continue;
      const series = window.TBAssetsCore.buildValueSeries(asset, 18);
      const chart = window.echarts.init(el, null, { renderer:'canvas' });
      chart.setOption({
  grid:{left:4,right:4,top:8,bottom:6},
  xAxis:{type:'category',show:false,data:series.map(x=>x.date)},
  yAxis:{type:'value',show:false,min:'dataMin'},
  tooltip:{trigger:'axis', valueFormatter:v=>money(v, asset.currency)},
  series:[{
    type:'line',
    smooth:true,
    symbol:'none',
    lineStyle:{
      width:4,
      color:'#22d3ee'
    },
    areaStyle:{
      color:{
        type:'linear',
        x:0,y:0,x2:0,y2:1,
        colorStops:[
          {offset:0,color:'rgba(6,182,212,.22)'},
          {offset:1,color:'rgba(6,182,212,.02)'}
        ]
      }
    },
    data:series.map(x=>Math.round(x.value*100)/100)
  }]
});
    }
  }
  function styles(){ if(document.getElementById('tb-assets-style')) return; const st=document.createElement('style'); st.id='tb-assets-style'; st.textContent=`
    .tb-assets-shell{position:relative;overflow:hidden;border:1px solid rgba(15,23,42,.08);border-radius:28px;padding:22px;background:linear-gradient(135deg,#ffffff,#f4f7fb);color:#0f172a;box-shadow:0 18px 45px rgba(15,23,42,.08)}
.tb-assets-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:18px}
.tb-assets-head h2{margin:0;font-size:26px;color:#0f172a}
.tb-assets-head p{margin:6px 0 0;color:#475569;font-size:13px;max-width:760px}
.tb-assets-badge{border:1px solid rgba(8,145,178,.18);background:#e0f7fb;color:#0891b2;border-radius:999px;padding:8px 12px;font-size:12px;font-weight:800}
.tb-assets-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px}

.tb-asset-card{border:1px solid rgba(15,23,42,.08);border-radius:24px;background:linear-gradient(180deg,#ffffff,#f7f9fc);padding:18px;box-shadow:0 18px 40px rgba(15,23,42,.08);transition:transform .2s ease,box-shadow .2s ease}
.tb-asset-card:hover{transform:scale(1.01);box-shadow:0 24px 60px rgba(15,23,42,.12)}
.tb-asset-top{display:flex;justify-content:space-between;gap:12px}
.tb-asset-kicker{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#64748b;font-weight:900}
.tb-asset-top h3{margin:4px 0 3px;font-size:20px;color:#0f172a}
.tb-asset-top p{margin:0;color:#64748b;font-size:12px}
.tb-asset-top span{height:max-content;border-radius:999px;background:#e0f7fb;color:#0891b2;border:1px solid rgba(8,145,178,.16);padding:7px 10px;font-size:12px;font-weight:800}

.tb-asset-metrics{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:16px}
.tb-asset-metrics>div{border-radius:18px;background:linear-gradient(180deg,#f8fafc,#eef2f7);border:1px solid rgba(15,23,42,.06);padding:13px}
.tb-asset-metrics small{display:block;color:#64748b;font-size:11px}
.tb-asset-metrics strong{display:block;margin-top:4px;font-size:24px;letter-spacing:-.03em;color:#0f172a}
.tb-asset-primary strong{font-size:30px}
.tb-asset-metrics em{display:block;margin-top:3px;color:#0891b2;font-style:normal;font-size:12px}
.tb-asset-metrics em.loss{color:#e11d48}

.tb-asset-progress{margin-top:16px}
.tb-asset-progress div{display:flex;justify-content:space-between;color:#64748b;font-size:11px;margin-bottom:7px}
.tb-asset-progress b{display:block;height:8px;background:#e2e8f0;border-radius:999px;overflow:hidden}
.tb-asset-progress i{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#06b6d4,#8b5cf6)}

.tb-asset-chart{height:86px;margin-top:14px;border-radius:18px;background:linear-gradient(180deg,#eef2f7,#e5eaf1);border:1px solid rgba(15,23,42,.07)}

.tb-asset-owners{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
.tb-asset-owners span{font-size:11px;color:#334155;border:1px solid rgba(15,23,42,.10);border-radius:999px;padding:6px 9px;background:#f8fafc}
  `; document.head.appendChild(st); }
  async function renderAssets(reason){
    styles();
    const root = document.getElementById('assets-root') || document.getElementById('view-assets'); if(!root) return;
    root.innerHTML = '<div class="tb-assets-shell"><div class="tb-assets-head"><div><h2>Patrimoine</h2><p>Chargement des assets…</p></div></div></div>';
    const data = await loadAssets();
    root.innerHTML = `<div class="tb-assets-shell"><div class="tb-assets-head"><div><h2>Patrimoine</h2><p>Stocks patrimoniaux séparés du cashflow : valeur actuelle, amortissement linéaire et ownership. ${data.demo ? 'Aperçu de démonstration tant que les tables SQL ne sont pas déployées ou qu’aucun asset n’existe.' : ''}</p></div><div class="tb-assets-badge">V9.6.0 · Assets</div></div><div class="tb-assets-grid">${data.assets.map(a=>card(a,data.owners)).join('')}</div></div>`;
    setTimeout(()=>renderCharts(data.assets),0);
  }
  window.renderAssets = renderAssets;
})();
