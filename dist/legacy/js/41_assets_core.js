/* TravelBudget V9.6.4 - Assets core
   Stock patrimonial only: no cashflow mutation, no budget mutation. */
(function(){
  function _num(v, fallback){ const n = Number(v); return Number.isFinite(n) ? n : (fallback || 0); }
  function _date(v){ const d = new Date(String(v || '').slice(0,10) + 'T00:00:00'); return Number.isFinite(d.getTime()) ? d : null; }
  function _monthsBetween(start, end){
    const s = _date(start); const e = end instanceof Date ? end : _date(end || new Date().toISOString().slice(0,10));
    if(!s || !e) return 0;
    let m = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
    if (e.getDate() < s.getDate()) m -= 1;
    return Math.max(0, m);
  }
  function clamp(v,min,max){ return Math.min(Math.max(v,min),max); }
  function computeLinearAssetValue(asset, atDate){
    const purchase = _num(asset && asset.purchase_value, 0);
    const residual = Math.min(_num(asset && asset.residual_value, 0), purchase);
    const months = Math.max(1, Math.round(_num(asset && asset.depreciation_months, 1)));
    const elapsed = _monthsBetween(asset && asset.purchase_date, atDate || new Date());
    const ratio = clamp(elapsed / months, 0, 1);
    return Math.max(residual, purchase - ((purchase - residual) * ratio));
  }
  function computeDepreciationProgress(asset, atDate){
    const months = Math.max(1, Math.round(_num(asset && asset.depreciation_months, 1)));
    const elapsed = clamp(_monthsBetween(asset && asset.purchase_date, atDate || new Date()), 0, months);
    return { elapsedMonths: elapsed, totalMonths: months, ratio: elapsed / months };
  }
  function computeOwnedValue(asset, ownershipPercent, atDate){
    return computeLinearAssetValue(asset, atDate) * (clamp(_num(ownershipPercent, 0),0,100) / 100);
  }
  function buildValueSeries(asset, points){
    const total = Math.max(1, Math.round(_num(asset && asset.depreciation_months, 1)));
    const n = Math.max(2, points || Math.min(24, total + 1));
    const out = [];
    const start = _date(asset && asset.purchase_date) || new Date();
    for(let i=0;i<n;i++){
      const month = Math.round((total * i) / (n - 1));
      const d = new Date(start.getFullYear(), start.getMonth() + month, start.getDate());
      out.push({ date: d.toISOString().slice(0,10), value: computeLinearAssetValue(asset, d) });
    }
    return out;
  }
  function normalizeAsset(row){
    return {
      id: String(row && row.id || ''),
      name: String(row && row.name || 'Asset'),
      asset_type: String(row && row.asset_type || row && row.type || 'other'),
      purchase_value: _num(row && row.purchase_value, 0),
      residual_value: _num(row && row.residual_value, 0),
      currency: String(row && row.currency || 'EUR').toUpperCase(),
      purchase_date: String(row && row.purchase_date || new Date().toISOString().slice(0,10)).slice(0,10),
      depreciation_months: Math.max(1, Math.round(_num(row && row.depreciation_months, 36))),
      status: String(row && row.status || 'active'),
      travel_id: row && row.travel_id || null,
    };
  }
  window.TBAssetsCore = Object.freeze({ computeLinearAssetValue, computeOwnedValue, computeDepreciationProgress, buildValueSeries, normalizeAsset });
})();
