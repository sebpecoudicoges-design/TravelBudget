/* =========================
   Budget Analysis — immersive ECharts page
   ========================= */
(function () {
  const LS_KEY = 'tb_budget_analysis_filters_v1';
  const charts = { trajectory: null, category: null, categoryBars: null, velocity: null, heatmap: null, referenceMix: null };
  const referenceCache = { key: '', bySegment: {}, loaded: false };
  let resizeBound = false;
  let excludedCats = new Set();
  let excludePanelOpen = false;

  const TB_SOURCED_CATEGORY_MAPPING = Object.freeze((window.TB_CONST && window.TB_CONST.ANALYSIS && window.TB_CONST.ANALYSIS.SOURCED_CATEGORY_MAPPING) || {});
  const TB_SOURCED_BUCKET_ORDER = Object.freeze(['Logement', 'Repas', 'Transport', 'Activités']);

  function _el(id){ return document.getElementById(id); }
  function _safeNum(v){ const n = Number(v); return Number.isFinite(n) ? n : 0; }
  function _norm(s){ return String(s || '').trim(); }
  function _upper(s){ return _norm(s).toUpperCase(); }
    function _normKey(s){
    return String(s || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }
  function _isUUID(v){ return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v || '')); }
  function _iso(d){ try { return toLocalISODate(d); } catch (_) { return new Date(d).toISOString().slice(0,10); } }
  function _parse(iso){ try { return parseISODateOrNull(iso); } catch (_) { return iso ? new Date(iso+'T00:00:00') : null; } }
  function _daysInclusive(startISO, endISO){
    const out = [];
    const start = _parse(startISO); const end = _parse(endISO);
    if (!start || !end || start > end) return out;
    const d = new Date(start.getTime());
    while (d <= end) {
      out.push(_iso(d));
      d.setDate(d.getDate()+1);
    }
    return out;
  }
  function _fmtMoney(v, cur){ try { return fmtMoney(v, cur); } catch (_) { return `${(_safeNum(v)).toFixed(2)} ${cur || ''}`.trim(); } }
  function _rangeInputs(){
    return {
      start: _el('analysis-range-start'),
      end: _el('analysis-range-end'),
      box: _el('analysis-range-box')
    };
  }
  function _allSegments(){ return Array.isArray(state?.budgetSegments) ? state.budgetSegments.filter(Boolean) : []; }
  function _segmentsForTravel(travelId){
    const wanted = String(travelId || state?.activeTravelId || '');
    const periodTravelMap = Object.fromEntries((Array.isArray(state?.periods) ? state.periods : []).map((p) => [String(p.id), String(p.travel_id || p.travelId || '')]));
    return _allSegments().filter(s => {
      const direct = String(s.travel_id || s.travelId || '');
      if (direct) return direct === wanted;
      const byPeriod = periodTravelMap[String(s.period_id || s.periodId || '')] || '';
      return byPeriod === wanted;
    });
  }
  function _getActivePeriodForTravel(travelId){
    const list = _periodList(travelId).slice().sort((a,b)=>String(a.start_date || a.start || '').localeCompare(String(b.start_date || b.start || '')));
    if (!list.length) return null;
    const today = _iso(new Date());
    const containing = list.filter(p => {
      const a = _norm(p.start_date || p.start);
      const b = _norm(p.end_date || p.end);
      return a && b && today >= a && today <= b;
    });
    if (containing.length) {
      return containing.slice().sort((a,b) => String(b.start_date || b.start || '').localeCompare(String(a.start_date || a.start || '')))[0];
    }
    const activePeriodId = String(state?.period?.id || '');
    if (String(state?.activeTravelId || '') === String(travelId || '') && activePeriodId) {
      const byId = list.find(p => String(p.id) === activePeriodId || String(p.periodId || '') === activePeriodId);
      if (byId) return byId;
    }
    return list[0] || null;
  }
  function _travelList(){ return Array.isArray(state?.travels) ? state.travels : []; }
  function _periodList(travelId){
    const wanted = String(travelId || state?.activeTravelId || '');
    const segs = _segmentsForTravel(wanted)
      .filter(s => _norm(s.start || s.start_date || s.startDate) && _norm(s.end || s.end_date || s.endDate))
      .map((s) => ({
        id: s.id,
        periodId: s.periodId || s.period_id || null,
        travelId: wanted,
        start: s.start || s.start_date || s.startDate,
        end: s.end || s.end_date || s.endDate,
        baseCurrency: s.baseCurrency || s.base_currency || '',
        isSegment: true,
      }));
    if (segs.length) {
      return segs.sort((a,b)=>String(a.start || '').localeCompare(String(b.start || '')));
    }
    return (Array.isArray(state?.periods) ? state.periods : []).filter(p => String(p.travel_id || p.travelId || '') === wanted);
  }
  function _getSelectedTravelId(){ return _el('analysis-travel')?.value || String(state?.activeTravelId || ''); }
  function _getSelectedPeriodId(){ return _el('analysis-period')?.value || 'active'; }
  function _getSelectedTravel(){ return _travelList().find(t => String(t.id) === String(_getSelectedTravelId())) || _travelList()[0] || null; }
  function _getSelectedPeriodObj(){
    const pid = _getSelectedPeriodId();
    if (pid === 'all' || pid === 'range') return null;
    if (pid === 'active') return _getActivePeriodForTravel(_getSelectedTravelId());
    return _periodList(_getSelectedTravelId()).find(p => String(p.id) === String(pid)) || null;
  }
  function _analysisRange(){
    const travel = _getSelectedTravel();
    const pid = _getSelectedPeriodId();
    const period = _getSelectedPeriodObj();
    if (pid === 'range') {
      const ri = _rangeInputs();
      const tStart = _norm(travel?.start_date || travel?.start || state?.period?.start);
      const tEnd = _norm(travel?.end_date || travel?.end || state?.period?.end);
      let start = _norm(ri.start?.value || '') || tStart;
      let end = _norm(ri.end?.value || '') || tEnd;
      if (tStart && start < tStart) start = tStart;
      if (tEnd && end > tEnd) end = tEnd;
      if (start && end && start > end) [start, end] = [end, start];
      return { start, end };
    }
    const start = _norm(period?.start_date || period?.start || travel?.start_date || travel?.start || state?.period?.start);
    const end = _norm(period?.end_date || period?.end || travel?.end_date || travel?.end || state?.period?.end);
    return { start, end };
  }
  function _loadFilters(){ try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}') || {}; } catch (_) { return {}; } }
  function _saveFilters(){
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({
        travelId: _getSelectedTravelId(),
        periodId: _getSelectedPeriodId(),
        rangeStart: _el('analysis-range-start')?.value || '',
        rangeEnd: _el('analysis-range-end')?.value || '',
        scope: _el('analysis-scope')?.value || 'budget',
        mode: _el('analysis-mode')?.value || 'planned',
        currencyMode: _el('analysis-currency')?.value || 'period',
        excludedCats: Array.from(excludedCats)
      }));
    } catch (_) {}
  }

  function _selectedCurrencyMode(){ return _el('analysis-currency')?.value || 'period'; }
  function _excludedCategorySet(){ return new Set(Array.from(excludedCats)); }
  function _segmentForDate(dateISO){
    const ds = _norm(dateISO);
    const travelSeg = _segmentsForTravel(_getSelectedTravelId()).find(s => {
      const a = _norm(s.start || s.start_date || s.startDate);
      const b = _norm(s.end || s.end_date || s.endDate);
      return a && b && ds >= a && ds <= b;
    });
    if (travelSeg) return travelSeg;
    try { if (typeof getBudgetSegmentForDate === 'function') return getBudgetSegmentForDate(dateISO); } catch (_) {}
    return null;
  }
  function _getSB(){
    try { if (typeof window._tbGetSB === 'function') return window._tbGetSB(); } catch (_) {}
    try { if (typeof _tbGetSB === 'function') return _tbGetSB(); } catch (_) {}
    try { if (window.sb) return window.sb; } catch (_) {}
    return null;
  }
  async function _loadReferenceCache(){
    const s = _getSB();
    const travelId = _getSelectedTravelId();
    const segs = _segmentsForTravel(travelId);
    const key = `${travelId}|${segs.map(s => String(s.id)).sort().join(',')}`;
    if (referenceCache.key === key && referenceCache.loaded) return;
    referenceCache.key = key;
    referenceCache.bySegment = {};
    referenceCache.loaded = true;
    if (!s || !segs.length || !TB_CONST?.RPCS?.budget_reference_resolve_for_budget_segment) return;
    await Promise.all(segs.map(async (seg) => {
      try {
        const { data, error } = await s.rpc(TB_CONST.RPCS.budget_reference_resolve_for_budget_segment, { p_budget_segment_id: String(seg.id) });
        if (error) throw error;
        referenceCache.bySegment[String(seg.id)] = Array.isArray(data) ? (data[0] || null) : (data || null);
      } catch (_) {
        referenceCache.bySegment[String(seg.id)] = null;
      }
    }));
  }
  function _referenceRowForDate(dateISO){
    const seg = _segmentForDate(dateISO);
    if (!seg) return null;
    return referenceCache.bySegment[String(seg.id)] || null;
  }
  function _referenceDailyForDate(dateISO, analysisBase){
    const row = _referenceRowForDate(dateISO);
    const amount = _safeNum(row?.recommended_daily_amount);
    const cur = _upper(row?.currency_code || '');
    if (!amount || !cur) return 0;
    return _convert(amount, cur, dateISO, analysisBase);
  }

    function _hasReferenceForDate(dateISO){
    const row = _referenceRowForDate(dateISO);
    return !!(_safeNum(row?.recommended_daily_amount) > 0 && _upper(row?.currency_code || ''));
  }
  function _titleCase(value){
    return String(value || '').trim().replace(/[_-]+/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
  }
  function _buildReferenceContext(days, effectiveEnd){
    const dayList = Array.isArray(days) ? days : [];
    const rows = dayList
      .filter((d) => !effectiveEnd || d <= effectiveEnd)
      .map((d) => _referenceRowForDate(d))
      .filter((row) => row && _safeNum(row?.recommended_daily_amount) > 0 && _upper(row?.currency_code || ''));
    const uniq = (picker) => [...new Set(rows.map(picker).filter((v) => String(v || '').trim() !== ''))];
    const profiles = uniq((row) => String(row?.travel_profile || '').trim().toLowerCase());
    const styles = uniq((row) => String(row?.travel_style || '').trim().toLowerCase());
    const adults = uniq((row) => String(Number(row?.adult_count ?? '') || '').trim());
    const children = uniq((row) => String(Number(row?.child_count ?? '') || '').trim());
    const countries = uniq((row) => String(row?.country_name || row?.country_code || '').trim());
    const profileLabel = profiles.length === 1 ? _titleCase(profiles[0]) : (profiles.length > 1 ? 'Profil mixte' : 'Profil —');
    const styleLabel = styles.length === 1 ? _titleCase(styles[0]) : (styles.length > 1 ? 'Style mixte' : 'Style —');
    const adultsLabel = adults.length === 1 ? `${adults[0] || '0'} ad.` : (adults.length > 1 ? 'ad. variables' : 'ad. —');
    const childrenLabel = children.length === 1 ? `${children[0] || '0'} enf.` : (children.length > 1 ? 'enf. variables' : 'enf. —');
    const countryLabel = countries.length === 1 ? countries[0] : (countries.length > 1 ? 'Pays multiples' : 'Pays —');
    return {
      rows,
      profileLabel,
      styleLabel,
      adultsLabel,
      childrenLabel,
      countryLabel,
      shortLabel: rows.length ? `${profileLabel} · ${styleLabel} · ${adultsLabel} · ${childrenLabel}` : 'Aucune référence pays active',
      longLabel: rows.length ? `${countryLabel} · ${profileLabel} · ${styleLabel} · ${adultsLabel} · ${childrenLabel}` : 'Aucune référence pays active sur la plage'
    };
  }

  function _segmentsInRange(startISO, endISO){
    return _segmentsForTravel(_getSelectedTravelId()).filter(s => {
      const a = _norm(s.start || s.start_date || s.startDate);
      const b = _norm(s.end || s.end_date || s.endDate);
      if (!a || !b) return false;
      return (!startISO || b >= startISO) && (!endISO || a <= endISO);
    });
  }
  function _periodCurrency(){
    const { start, end } = _analysisRange();
    const segs = _segmentsInRange(start, end);
    const bases = [...new Set(segs.map(s => _upper(s.baseCurrency || s.base_currency || '')).filter(Boolean))];
    if (bases.length === 1) return bases[0];
    if (bases.length > 1) {
      const first = segs.slice().sort((a,b)=>String(a.start || a.start_date || '').localeCompare(String(b.start || b.start_date || '')))[0];
      if (first) return _upper(first.baseCurrency || first.base_currency || '');
    }
    const travel = _getSelectedTravel();
    return _upper(travel?.base_currency || travel?.baseCurrency || state?.period?.baseCurrency || state?.user?.baseCurrency || 'EUR');
  }
  function _resolveAnalysisCurrency(startISO, endISO){
    const mode = _selectedCurrencyMode();
    if (mode === 'account') return _upper(state?.user?.baseCurrency || state?.user?.base_currency || _getSelectedTravel()?.base_currency || 'EUR');
    return _periodCurrency(startISO, endISO);
  }
  function _currency(){ const r = _analysisRange(); return _resolveAnalysisCurrency(r.start, r.end); }

  function _isTripLinked(tx){ return !!(tx?.trip_expense_id || tx?.tripExpenseId || tx?.trip_share_link_id || tx?.tripShareLinkId); }
  function _isInternalMovement(tx){ return String(tx?.category || '').trim().toLowerCase() === 'mouvement interne'; }
  function _txCashDate(tx){ return _norm(tx?.dateStart || tx?.date_start || tx?.occurrence_date || tx?.date || tx?.created_at?.slice?.(0,10) || tx?.createdAt?.slice?.(0,10)); }
  function _txBudgetStart(tx){ return _norm(tx?.budgetDateStart || tx?.budget_date_start || tx?.dateStart || tx?.date_start || tx?.occurrence_date || tx?.date || tx?.created_at?.slice?.(0,10) || tx?.createdAt?.slice?.(0,10)); }
  function _txBudgetEnd(tx){ return _norm(tx?.budgetDateEnd || tx?.budget_date_end || tx?.dateEnd || tx?.date_end || _txBudgetStart(tx)); }
  function _txType(tx){ return String(tx?.type || '').toLowerCase(); }
  function _txPaid(tx){
    if (typeof tx?.payNow === 'boolean') return tx.payNow;
    if (typeof tx?.pay_now === 'boolean') return tx.pay_now;
    return !!tx?.payNow || !!tx?.pay_now;
  }
  function _txOut(tx){
    if (typeof tx?.outOfBudget === 'boolean') return tx.outOfBudget;
    if (typeof tx?.out_of_budget === 'boolean') return tx.out_of_budget;
    return !!tx?.outOfBudget || !!tx?.out_of_budget;
  }
  function _categoryColor(name){
    try {
      if (typeof colorForCategory === 'function') return colorForCategory(name);
      if (typeof getCategoryColors === 'function') {
        const m = getCategoryColors() || {};
        return m[name] || m[_norm(name)] || '#94a3b8';
      }
    } catch (_) {}
    return '#94a3b8';
  }
  function _norm(s){ 
  return String(s || '').trim(); 
}

function _normKey(s){
  return String(s || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

function _sqlAnalyticFamilyToBucket(family) {
  const f = _normKey(family);
  if (f === 'accommodation') return 'Logement';
  if (f === 'food') return 'Repas';
  if (f === 'transport') return 'Transport';
  if (f === 'activities') return 'Activités';
  return null;
}

function _mapToSourcedBucket(categoryName, tx) {
  const byTx = tx?.analyticMapping || (tx?.id ? state?.analysisMappingByTxId?.[String(tx.id)] : null) || null;
  if (byTx) {
    const status = String(byTx.mappingStatus || byTx.mapping_status || '').trim().toLowerCase();
    const family = byTx.analyticFamily || byTx.analytic_family || null;
    const bucket = _sqlAnalyticFamilyToBucket(family);
    const key = _normKey(categoryName);
    if (status === 'mapped' && bucket) return { mode: 'mapped', bucket, key, source: 'sql' };
    if (status === 'excluded') return { mode: 'excluded', key, source: 'sql' };
    if (status === 'unmapped') return { mode: 'unmapped', key, source: 'sql' };
  }
  const key = _normKey(categoryName);
  const meta = TB_SOURCED_CATEGORY_MAPPING[key] || null;
  if (!meta) return { mode: 'unmapped', key, source: 'fallback' };
  const compareMode = String(meta.compare_mode || meta.mode || '').trim().toLowerCase();
  const bucket = String(meta.sourced_bucket || meta.bucket || '').trim() || null;
  if (compareMode === 'mapped' && bucket) return { mode: 'mapped', bucket, key, source: 'fallback' };
  if (compareMode === 'excluded') return { mode: 'excluded', key, source: 'fallback' };
  return { mode: 'unmapped', key, source: 'fallback' };
}

function _analysisBucketOrder(){
  const dynamic = Object.values(TB_SOURCED_CATEGORY_MAPPING || {})
    .filter((meta) => String(meta?.compare_mode || meta?.mode || '').trim().toLowerCase() === 'mapped' && String(meta?.sourced_bucket || meta?.bucket || '').trim())
    .map((meta) => String(meta.sourced_bucket || meta.bucket || '').trim());
  return Array.from(new Set([...TB_SOURCED_BUCKET_ORDER, ...dynamic]));
}
  function _allAnalysisCategories(){
    const out = [];
    const seen = new Set();
    const add = (v) => {
  const raw = String(v || '').trim();
  if (!raw) return;
  if (/^\[trip\]/i.test(raw)) return;
  if (/^cat[eé]gorie$/i.test(raw) || /^category$/i.test(raw)) return;

  const k = _normKey(raw);
  if (seen.has(k)) return;
  seen.add(k);
  out.push(raw);
};
    try { if (typeof getCategories === 'function') (getCategories() || []).forEach(add); } catch (_) {}
    (Array.isArray(state?.categories) ? state.categories : []).forEach(add);
    (Array.isArray(state?.transactions) ? state.transactions : []).forEach(tx => {
      if (_isTripLinked(tx)) return;
      if (_txType(tx) !== 'expense') return;
      add(tx?.category);
    });
    return out.sort((a,b) => a.localeCompare(b, 'fr', { sensitivity:'base' }));
  }
  function _updateCategoryExcludeSummary(){
    const summary = _el('analysis-category-summary');
    const badge = _el('analysis-category-count');
    const toggle = _el('analysis-category-toggle');
    const total = _allAnalysisCategories().length;
    const count = excludedCats.size;
    if (summary) {
      if (!count) summary.textContent = total ? `Aucune catégorie exclue • ${total} catégories disponibles` : 'Aucune catégorie';
      else summary.textContent = `${count} catégorie${count > 1 ? 's' : ''} exclue${count > 1 ? 's' : ''} • ${Math.max(total - count, 0)} incluse${(total - count) > 1 ? 's' : ''}`;
    }
    if (badge) badge.textContent = String(count);
    if (toggle) toggle.textContent = excludePanelOpen ? 'Masquer' : 'Gérer';
    const panel = _el('analysis-category-panel');
    if (panel) panel.style.display = excludePanelOpen ? 'block' : 'none';
  }

  function _renderCategoryExcludeChips(wanted){
    excludedCats = new Set(Array.isArray(wanted) ? wanted.map(v => _norm(v)).filter(Boolean) : Array.from(excludedCats));
    const host = _el('analysis-category-exclude-box');
    if (!host) return;
    const categories = _allAnalysisCategories();
    host.innerHTML = categories.map(cat => {
      const excluded = excludedCats.has(cat);
      const color = _categoryColor(cat);
      return `<button type="button" class="analysis-chip${excluded ? ' is-excluded' : ''}" data-cat="${escapeHTML(cat)}" style="border-color:${escapeHTML(color)}44;background:linear-gradient(180deg, ${escapeHTML(color)}22, rgba(255,255,255,.03));box-shadow:inset 0 0 0 1px ${escapeHTML(color)}22;"><span class="analysis-chip-dot" style="background:${escapeHTML(color)};"></span>${escapeHTML(cat)}</button>`;
    }).join('');
    host.querySelectorAll('[data-cat]').forEach(btn => {
      btn.onclick = () => {
        const cat = _norm(btn.getAttribute('data-cat'));
        if (!cat) return;
        if (excludedCats.has(cat)) excludedCats.delete(cat); else excludedCats.add(cat);
        _renderCategoryExcludeChips(Array.from(excludedCats));
        _renderAll();
      };
    });
    _updateCategoryExcludeSummary();
  }

  function _convert(amount, cur, dateISO, forcedBase){
    const base = _upper(forcedBase || _currency());
    const a = _safeNum(amount);
    const from = _upper(cur || base);
    if (!a) return 0;
    if (from === base) return a;
    const seg = (typeof getBudgetSegmentForDate === 'function') ? getBudgetSegmentForDate(dateISO) : null;
    try {
      if (typeof window.fxConvert === 'function' && seg && typeof window.fxRatesForSegment === 'function') {
        const rates = window.fxRatesForSegment(seg);
        const out = window.fxConvert(a, from, base, rates);
        if (out !== null && Number.isFinite(Number(out))) return Number(out);
      }
    } catch (_) {}
    try {
      if (typeof window.amountToBudgetBaseForDate === 'function' && seg) {
        const inSegBase = window.amountToBudgetBaseForDate(a, from, dateISO);
        const segBase = _upper(seg.baseCurrency || seg.base_currency || state?.period?.baseCurrency || 'EUR');
        if (segBase === base) return _safeNum(inSegBase);
        if (typeof window.fxConvert === 'function' && typeof window.fxRatesForSegment === 'function') {
          const rates = window.fxRatesForSegment(seg);
          const out = window.fxConvert(inSegBase, segBase, base, rates);
          if (out !== null && Number.isFinite(Number(out))) return Number(out);
        }
      }
    } catch (_) {}
    try {
      if (typeof _toBaseForDate === 'function' && base === _upper(state?.user?.baseCurrency || 'EUR')) {
        return _safeNum(_toBaseForDate(a, from, dateISO));
      }
    } catch (_) {}
    return 0;
  }
  function _dailyBudgetForDate(dateISO, analysisBase){
    const base = _upper(analysisBase || _currency());
    const seg = _segmentForDate(dateISO);
    const segCur = _upper(seg?.baseCurrency || seg?.base_currency || state?.period?.baseCurrency || 'EUR');
    const dailyNominal = _safeNum(seg?.dailyBudgetBase ?? seg?.daily_budget_base ?? state?.period?.dailyBudgetBase ?? 0);
    return _convert(dailyNominal, segCur, dateISO, base);
  }
  function _baseExpenseTransactions(){
    const travelId = _getSelectedTravelId();
    const { start, end } = _analysisRange();
    return (Array.isArray(state?.transactions) ? state.transactions : []).filter(tx => {
      const txTravelId = String(tx?.travel_id || tx?.travelId || '');
      if (travelId && txTravelId && txTravelId !== String(travelId)) return false;
      if (_txType(tx) !== 'expense') return false;
      if (_isTripLinked(tx)) return false;
      if (_isInternalMovement(tx)) return false;
      const bs = _txBudgetStart(tx);
      const be = _txBudgetEnd(tx);
      if (!bs || !be) return false;
      if (start && be < start) return false;
      if (end && bs > end) return false;
      return true;
    });
  }
  function _filteredTransactions(){
    const scope = _el('analysis-scope')?.value || 'budget';
    const mode = _el('analysis-mode')?.value || 'planned';
    const excluded = _excludedCategorySet();
    return _baseExpenseTransactions().filter(tx => {
      if (scope === 'budget' && _txOut(tx)) return false;
      if (scope === 'out' && !_txOut(tx)) return false;
      if (mode === 'expenses' && !_txPaid(tx)) return false;
      if (excluded.size && excluded.has(_norm(tx?.category || 'Autre'))) return false;
      return true;
    });
  }
  function _outBudgetTransactions(){
    const mode = _el('analysis-mode')?.value || 'planned';
    const excluded = _excludedCategorySet();
    return _baseExpenseTransactions().filter(tx => {
      if (!_txOut(tx)) return false;
      if (mode === 'expenses' && !_txPaid(tx)) return false;
      if (excluded.size && excluded.has(_norm(tx?.category || 'Autre'))) return false;
      return true;
    });
  }

  function _computeModel(){
    const txs = _filteredTransactions();
    const { start, end } = _analysisRange();
    const base = _resolveAnalysisCurrency(start, end);
    const days = _daysInclusive(start, end);
    const dailyMap = Object.fromEntries(days.map(d => [d, 0]));
    const paidMap = Object.fromEntries(days.map(d => [d, 0]));
    const catMap = new Map();
    const subcatMap = new Map();
    let spent = 0;
    let paidSpent = 0;
    for (const tx of txs) {
      const cashDate = _txCashDate(tx);
      const budgetStart = _txBudgetStart(tx);
      const budgetEnd = _txBudgetEnd(tx);

      const budgetDays = _daysInclusive(budgetStart, budgetEnd)
        .filter(d => dailyMap[d] !== undefined);

      if (!budgetDays.length) continue;

      const amt = _convert(tx?.amount, tx?.currency || base, cashDate || budgetStart, base);
      const perDay = amt / budgetDays.length;

      spent += amt;
      if (_txPaid(tx)) paidSpent += amt;

      for (const d of budgetDays) {
        dailyMap[d] = _safeNum(dailyMap[d]) + perDay;
        if (_txPaid(tx)) paidMap[d] = _safeNum(paidMap[d]) + perDay;
      }

      const cat = _norm(tx?.category || 'Autre');
      const sub = _norm(tx?.subcategory || '');
      catMap.set(cat, (catMap.get(cat) || 0) + amt);
      if (sub) {
        const key = `${cat}|||${sub}`;
        subcatMap.set(key, (subcatMap.get(key) || 0) + amt);
      }
    }

    const targetDaily = days.map(d => _dailyBudgetForDate(d, base));
    const coveredDays = [];
    const referenceDaily = days.map((d) => {
      const row = _referenceRowForDate(d);
      const cur = _upper(row?.currency_code || '');
      const hasRef = !!(_safeNum(row?.recommended_daily_amount) > 0 && cur);
      if (hasRef) coveredDays.push(d);
      return _safeNum(_convert(row?.recommended_daily_amount || 0, cur || base, d, base));
    });

    const analysisBuckets = _analysisBucketOrder();
    const referenceCategoryMap = new Map(analysisBuckets.map((bucket) => [bucket, 0]));
    const coveredDaySet = new Set(coveredDays);
    const todayIso = _iso(new Date());
    const effectiveEnd = end < todayIso ? end : todayIso;
    const elapsedDaysList = days.filter((d) => d <= effectiveEnd);
    const elapsedComparableDaysList = coveredDays.filter((d) => d <= effectiveEnd);
    const comparableDays = Math.max(1, elapsedComparableDaysList.length || elapsedDaysList.length || days.length);
    const referenceContext = _buildReferenceContext(days, effectiveEnd);
    let comparableIncludedSpent = 0;
    let comparableMappedSpent = 0;
    let comparableExcludedSpent = 0;
    const comparableCategoryMap = new Map(analysisBuckets.map((bucket) => [bucket, 0]));
    const unmappedCategoryMap = new Map();
    for (const tx of txs) {
      const cashDate = _txCashDate(tx);
      const budgetStart = _txBudgetStart(tx);
      const budgetEnd = _txBudgetEnd(tx);
      const comparableBudgetDays = _daysInclusive(budgetStart, budgetEnd)
        .filter((d) => d <= effectiveEnd && (!coveredDaySet.size || coveredDaySet.has(d)));

      if (!comparableBudgetDays.length) continue;

      const amt = _convert(tx?.amount, tx?.currency || base, cashDate || budgetStart, base);
      const raw = _norm(tx?.category || 'Autre');
      const mapping = _mapToSourcedBucket(raw, tx);

      if (mapping.mode === 'excluded') {
        comparableExcludedSpent += amt;
        continue;
      }

      comparableIncludedSpent += amt;

      if (mapping.mode !== 'mapped') {
        const unmappedKey = String(tx?.category || 'Autre').trim() || 'Autre';
        unmappedCategoryMap.set(unmappedKey, (unmappedCategoryMap.get(unmappedKey) || 0) + amt);
        continue;
      }

      comparableMappedSpent += amt;
      comparableCategoryMap.set(
        mapping.bucket,
        (comparableCategoryMap.get(mapping.bucket) || 0) + amt
      );
    }
    const totalBudget = targetDaily.reduce((a,b)=>a+b,0);
    const totalReferencePeriod = referenceDaily.reduce((a,b)=>a+b,0);
    const totalReferenceElapsed = referenceDaily
      .filter((_, idx) => days[idx] <= effectiveEnd)
      .reduce((a,b)=>a+b,0);
    const totalReference = totalReferenceElapsed;
    let referenceCoverageDays = 0;
    const cumSpent = [];
    const cumTarget = [];
    const cumReference = [];
    const velocity = [];
    const heat = [];
    let runSpent = 0;
    let runTarget = 0;
    let runReference = 0;
    let targetToToday = 0;
    let spentToToday = 0;
    let referenceToToday = 0;
    days.forEach((d, idx) => {
      runSpent += _safeNum(dailyMap[d]);
      runTarget += _safeNum(targetDaily[idx]);
      runReference += _safeNum(referenceDaily[idx]);
      if (d <= todayIso) {
        targetToToday = runTarget;
        spentToToday = runSpent;
        referenceToToday = runReference;
      }
      cumSpent.push(Number(runSpent.toFixed(2)));
      cumTarget.push(Number(runTarget.toFixed(2)));
      cumReference.push(Number(runReference.toFixed(2)));
      velocity.push(Number((_safeNum(dailyMap[d])).toFixed(2)));
      heat.push([idx, 0, Number((_safeNum(paidMap[d] || dailyMap[d])).toFixed(2))]);
    });

    const periodDays = Math.max(days.length, 1);
    const elapsedDays = Math.max(1, elapsedDaysList.length || periodDays);
    const avgPerDay = spentToToday / elapsedDays;
    const budgetPerDay = totalBudget / periodDays;

    const activeReferenceDays = days.filter((d) => d <= effectiveEnd && _hasReferenceForDate(d));
    referenceCoverageDays = Math.max(0, activeReferenceDays.length);

    let referencePerDay = 0;
    let referenceMiscPerDay = 0;

    if (referenceCoverageDays > 0) {
      const refSums = {
        daily: 0,
        misc: 0,
        Logement: 0,
        Repas: 0,
        Transport: 0,
        Activités: 0,
        Autre: 0,
      };

      activeReferenceDays.forEach((d) => {
        const row = _referenceRowForDate(d);
        const cur = _upper(row?.currency_code || '');
        if (!row || !cur) return;

        refSums.daily += _safeNum(_convert(row?.recommended_daily_amount || 0, cur, d, base));
        refSums.misc += _safeNum(_convert(row?.recommended_misc_daily_amount || 0, cur, d, base));
        refSums.Logement += _safeNum(_convert(row?.recommended_accommodation_daily_amount || 0, cur, d, base));
        refSums.Repas += _safeNum(_convert(row?.recommended_food_daily_amount || 0, cur, d, base));
        refSums.Transport += _safeNum(_convert(row?.recommended_transport_daily_amount || 0, cur, d, base));
        refSums.Activités += _safeNum(_convert(row?.recommended_activities_daily_amount || 0, cur, d, base));
        refSums.Autre += _safeNum(_convert(row?.recommended_misc_daily_amount || 0, cur, d, base));
      });

      referencePerDay = refSums.daily / referenceCoverageDays;
      referenceMiscPerDay = refSums.misc / referenceCoverageDays;

      referenceCategoryMap.set('Logement', refSums.Logement / referenceCoverageDays);
      referenceCategoryMap.set('Repas', refSums.Repas / referenceCoverageDays);
      referenceCategoryMap.set('Transport', refSums.Transport / referenceCoverageDays);
      referenceCategoryMap.set('Activités', refSums.Activités / referenceCoverageDays);
    }

    const unmappedComparableSpent = Math.max(0, comparableIncludedSpent - comparableMappedSpent);
    const comparablePerDay = comparableDays > 0 ? (comparableIncludedSpent / comparableDays) : 0;
    const unmappedPerDay = comparableDays > 0 ? (unmappedComparableSpent / comparableDays) : 0;
    const excludedPerDay = comparableDays > 0 ? (comparableExcludedSpent / comparableDays) : 0;
    let projection = spent;
    if (end < todayIso) projection = spent;
    else if (start > todayIso) projection = totalBudget;
    else projection = Math.max(spentToToday, targetToToday) + Math.max(0, totalBudget - targetToToday);
    const remaining = totalBudget - projection;
    const referenceGap = spentToToday - totalReferenceElapsed;
    const pct = totalBudget > 0 ? (spentToToday / totalBudget) * 100 : 0;
    const referencePct = totalReferenceElapsed > 0 ? (spentToToday / totalReferenceElapsed) * 100 : 0;
    const topCategories = [...catMap.entries()].sort((a,b)=>b[1]-a[1]).slice(0, 8);
    const categorySeries = [...catMap.entries()].sort((a,b)=>b[1]-a[1]).map(([name, actual]) => ({ name, actual, color: _categoryColor(name) }));
    const subcategorySeries = [...subcatMap.entries()]
      .sort((a,b)=>b[1]-a[1])
      .map(([key, actual]) => {
        const [categoryName, subcategoryName] = String(key || '').split('|||');
        return {
          key,
          categoryName,
          subcategoryName,
          label: `${subcategoryName} · ${categoryName}`,
          actual,
          color: _categoryColor(categoryName)
        };
      });
    const outAmount = _outBudgetTransactions().reduce((sum, tx) => sum + _convert(tx?.amount, tx?.currency || base, _txCashDate(tx) || _txBudgetStart(tx), base), 0);
    const referenceCategorySeries = [...referenceCategoryMap.entries()].map(([name, actual]) => ({ name, actual, color: _categoryColor(name) }));
    const referenceComparisonSeries = _buildReferenceComparisonSeries(comparableCategoryMap, referenceCategoryMap, elapsedComparableDaysList.length || comparableDays);
    const unmappedCategorySeries = [...unmappedCategoryMap.entries()]
      .sort((a,b)=>b[1]-a[1])
      .map(([name, actual]) => ({ name, actual, color: _categoryColor(name) }));
    const nightCoveredRows = [];
    let nightCoveredCount = 0;
    let nightCoveredPotentialSavings = 0;
    let nightCoveredTransportSpent = 0;
    for (const tx of txs) {
      if (!tx?.nightCovered) continue;
      const eligible = (typeof window.tbIsNightCoveredEligibleCategory === 'function')
        ? window.tbIsNightCoveredEligibleCategory(tx?.category)
        : /^transport( internationale?| international)?$/i.test(String(tx?.category || '').trim());
      if (!eligible) continue;
      const insight = (typeof window.tbGetNightCoveredInsightForTx === 'function')
        ? window.tbGetNightCoveredInsightForTx(tx, base)
        : null;
      const bs = _txBudgetStart(tx);
      const budgetDate = _txBudgetStart(tx) || _txCashDate(tx);
      const spentAmt = _convert(tx?.amount, tx?.currency || base, _txCashDate(tx) || budgetDate, base);
      nightCoveredCount += 1;
      nightCoveredTransportSpent += spentAmt;
      if (insight && Number.isFinite(insight.amount)) {
        nightCoveredPotentialSavings += insight.amount;
        nightCoveredRows.push({
          id: String(tx?.id || nightCoveredRows.length + 1),
          date: budgetDate,
          label: String(tx?.label || tx?.category || 'Transport'),
          category: String(tx?.category || 'Transport'),
          spent: Number(spentAmt.toFixed(2)),
          saving: Number(Number(insight.amount || 0).toFixed(2)),
          currency: base
        });
      }
    }
    nightCoveredRows.sort((a,b) => String(a.date).localeCompare(String(b.date)));
    const nightCoveredAverageSaving = nightCoveredCount > 0 ? (nightCoveredPotentialSavings / nightCoveredCount) : 0;
    const nightCoveredShareOfSpent = nightCoveredTransportSpent > 0 ? (nightCoveredPotentialSavings / nightCoveredTransportSpent) * 100 : 0;

    return { base, start, end, days, txs, spent, paidSpent, totalBudget, totalReference, totalReferenceElapsed, totalReferencePeriod, remaining, pct, referencePct, avgPerDay, budgetPerDay, referencePerDay, referenceMiscPerDay, comparablePerDay, unmappedPerDay, excludedPerDay, projection,
      cumSpent, cumTarget, cumReference, velocity, heat, topCategories, categorySeries, subcategorySeries, referenceCategorySeries, referenceComparisonSeries, unmappedCategorySeries, outAmount, spentToToday, targetToToday, referenceToToday, referenceGap, referenceCoverageDays, referenceContext, comparableDays, comparableIncludedSpent, comparableExcludedSpent, unmappedComparableSpent, nightCoveredCount, nightCoveredPotentialSavings, nightCoveredAverageSaving, nightCoveredTransportSpent, nightCoveredShareOfSpent, nightCoveredRows };
        }
  function _buildReferenceComparisonSeries(actualMap, referenceCategoryMap, comparableDays){
    const map = (actualMap instanceof Map)
      ? actualMap
      : new Map((actualMap || []).map((row) => [String(row?.name || '').trim(), _safeNum(row?.actual)]));

    const days = Math.max(1, Number(comparableDays) || 1);
    const mappings = _analysisBucketOrder().map((bucket) => ({ name: bucket, actualKey: bucket, referenceKey: bucket }));

    return mappings.map((row) => {
      const actual = _safeNum(map.get(row.actualKey));
      const referenceDaily = _safeNum(referenceCategoryMap.get(row.referenceKey));
      const actualPerDay = actual / days;

      return {
        name: row.name,
        actual: Number(actual.toFixed(2)),
        reference: Number(referenceDaily.toFixed(2)),
        actualPerDay: Number(actualPerDay.toFixed(2)),
        referencePerDay: Number(referenceDaily.toFixed(2)),
        deltaPerDay: Number((actualPerDay - referenceDaily).toFixed(2)),
        delta: Number((actual - (referenceDaily * days)).toFixed(2)),
        color: _categoryColor(row.name)
      };
    }).filter((row) => _safeNum(row.actualPerDay) > 0 || _safeNum(row.referencePerDay) > 0);
  }

  function _buildSummary(model){
    const host = _el('analysis-summary');
    if (!host) return;

    const ensureFluidStyles = () => {
      if (document.getElementById('tb-analysis-fluid-kpis')) return;
      const style = document.createElement('style');
      style.id = 'tb-analysis-fluid-kpis';
      style.textContent = `
  @keyframes tbWaveDriftBack {
    0% { transform: translateX(0); }
    100% { transform: translateX(-120px); }
  }
  @keyframes tbWaveDriftFront {
    0% { transform: translateX(0); }
    100% { transform: translateX(-160px); }
  }
  @keyframes tbWaterGlow {
    0% { transform: translateX(-120%) skewX(-10deg); opacity:.10; }
    50% { opacity:.22; }
    100% { transform: translateX(160%) skewX(-10deg); opacity:.08; }
  }
  @keyframes tbBubbleRise {
    0% { transform: translateY(0) scale(.8); opacity:0; }
    15% { opacity:.18; }
    70% { opacity:.14; }
    100% { transform: translateY(-42px) scale(1.08); opacity:0; }
  }
  @media (prefers-reduced-motion: reduce) {
    .tb-water-wave-back,
    .tb-water-wave-front,
    .tb-water-glow,
    .tb-water-bubble { animation: none !important; }
  }
`;
      document.head.appendChild(style);
    };
    ensureFluidStyles();

    const clampPct = (value) => Math.max(0, Math.min(100, Number(value) || 0));
    const signedPct = (current, target) => {
      if (!target) return 0;
      return ((current - target) / target) * 100;
    };
    const ratioText = (current, total) => `${_fmtMoney(current, model.base)} / ${_fmtMoney(total, model.base)}`;
    const deltaBudgetPct = signedPct(model.projection, model.totalBudget);
    const deltaReferencePct = signedPct(model.projection, model.totalReferencePeriod);
    const deltaBudgetTone = deltaBudgetPct > 0 ? _themeBad() : (deltaBudgetPct < 0 ? _themeGood() : _themeMuted());
    const deltaReferenceTone = deltaReferencePct > 0 ? _themeBad() : (deltaReferencePct < 0 ? _themeGood() : _themeMuted());

    const progressCards = [
      {
        label:'Rythme budget app',
        title:'Part du budget app déjà ouverte à date dans la période analysée',
        value: ratioText(model.targetToToday, model.totalBudget),
        hint:'Budget prévu à date comparé au budget total.',
        pct: model.totalBudget > 0 ? clampPct((model.targetToToday / model.totalBudget) * 100) : 0,
        footer:`Cible de dépense sur ${model.days.length} jours analysés`,
        tint:'rose',
        liquid:'linear-gradient(180deg, rgba(251,113,133,.34) 0%, rgba(244,114,182,.46) 34%, rgba(236,72,153,.54) 70%, rgba(219,39,119,.66) 100%)',
        liquidAlt:'linear-gradient(180deg, rgba(255,255,255,.00) 0%, rgba(255,255,255,.18) 22%, rgba(255,255,255,.00) 55%, rgba(255,255,255,.12) 100%)',
        glow:'rgba(244,114,182,.22)',
        shell:'rgba(251,207,232,.72)',
        haze:'linear-gradient(180deg, rgba(255,255,255,.82), rgba(255,255,255,.42))'
      },
      {
        label:'Rythme référence pays',
        title:'Part de la référence pays déjà consommée à date sur la période analysée',
        value: ratioText(model.totalReferenceElapsed, model.totalReferencePeriod),
        hint:'Référence à date comparée à la référence totale.',
        pct: model.totalReferencePeriod > 0 ? clampPct((model.totalReferenceElapsed / model.totalReferencePeriod) * 100) : 0,
        footer:'Repère externe basé sur les jours déjà écoulés',
        tint:'green',
        liquid:'linear-gradient(180deg, rgba(110,231,183,.30) 0%, rgba(74,222,128,.44) 34%, rgba(34,197,94,.52) 70%, rgba(22,163,74,.62) 100%)',
        liquidAlt:'linear-gradient(180deg, rgba(255,255,255,.00) 0%, rgba(255,255,255,.20) 24%, rgba(255,255,255,.00) 58%, rgba(255,255,255,.10) 100%)',
        glow:'rgba(74,222,128,.20)',
        shell:'rgba(187,247,208,.78)',
        haze:'linear-gradient(180deg, rgba(255,255,255,.82), rgba(236,253,245,.40))'
      },
      {
        label:'Réalisé vs projection',
        title:'Part du réalisé déjà absorbée dans la projection de fin de période',
        value: ratioText(model.spentToToday, model.projection),
        hint:'Dépensé cumulé comparé à la projection finale.',
        pct: model.projection > 0 ? clampPct((model.spentToToday / model.projection) * 100) : 0,
        footer: model.projection > model.totalBudget ? 'Tendance finale au-dessus du budget app' : 'Tendance finale contenue dans le budget app',
        tint:'blue',
        liquid:'linear-gradient(180deg, rgba(147,197,253,.30) 0%, rgba(125,211,252,.42) 34%, rgba(56,189,248,.52) 70%, rgba(14,165,233,.62) 100%)',
        liquidAlt:'linear-gradient(180deg, rgba(255,255,255,.00) 0%, rgba(255,255,255,.22) 24%, rgba(255,255,255,.00) 60%, rgba(255,255,255,.10) 100%)',
        glow:'rgba(56,189,248,.20)',
        shell:'rgba(186,230,253,.76)',
        haze:'linear-gradient(180deg, rgba(255,255,255,.84), rgba(239,246,255,.40))'
      }
    ];

    const renderGlassCard = (c, idx) => {
      const pct = clampPct(c.pct);
      const liquidTop = Math.max(0, 100 - pct);
      return `
      <div class="analysis-stat analysis-stat--glass analysis-stat--glass-${escapeHTML(c.tint)}" title="${escapeHTML(c.title)}" style="animation:analysisGrow .55s ease ${idx*60}ms both; position:relative; isolation:isolate; overflow:hidden; padding:18px 18px 16px; border-radius:24px; border:1px solid rgba(255,255,255,.74); background:linear-gradient(180deg, rgba(255,255,255,.98), rgba(255,255,255,.90)); box-shadow:0 14px 34px rgba(148,163,184,.16), inset 0 1px 0 rgba(255,255,255,.88); min-height:196px; display:flex; flex-direction:column; justify-content:space-between; gap:14px;">
        <span aria-hidden="true" style="position:absolute; inset:0; border-radius:inherit; background:radial-gradient(circle at 20% 12%, rgba(255,255,255,.94), rgba(255,255,255,0) 36%), radial-gradient(circle at 82% 18%, ${escapeHTML(c.glow)}, rgba(255,255,255,0) 38%), linear-gradient(180deg, rgba(255,255,255,.76), rgba(255,255,255,.36)); pointer-events:none;"></span>
        <span aria-hidden="true" style="position:absolute; left:10px; right:10px; bottom:10px; top:10px; border-radius:20px; background:rgba(255,255,255,.16); border:1px solid ${escapeHTML(c.shell)}; box-shadow:inset 0 0 0 1px rgba(255,255,255,.24); pointer-events:none;"></span>
        <span aria-hidden="true" style="position:absolute; left:10px; right:10px; bottom:10px; height:${pct}%; min-height:${pct > 0 ? 20 : 0}px; border-radius:0 0 20px 20px; overflow:hidden; pointer-events:none;">
  <span style="position:absolute; inset:0; background:${escapeHTML(c.liquid)};"></span>

  <span class="tb-water-glow" style="position:absolute; inset:0; background:linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,.18), rgba(255,255,255,0)); filter:blur(1px); animation:tbWaterGlow 6.2s linear infinite;"></span>

  <svg class="tb-water-wave-back" viewBox="0 0 240 28" preserveAspectRatio="none"
    style="position:absolute; left:-6px; bottom:0px; width:calc(100% + 140px); height:36px; opacity:.55; animation:tbWaveDriftBack 7.2s linear infinite;">
    <path d="M0,16 C20,8 40,8 60,16 C80,24 100,24 120,16 C140,8 160,8 180,16 C200,24 220,24 240,16 L240,28 L0,28 Z"
      fill="rgba(255,255,255,.45)"></path>
  </svg>

  <svg class="tb-water-wave-front" viewBox="0 0 320 34" preserveAspectRatio="none"
    style="position:absolute; left:-8px; bottom:0px; width:calc(100% + 180px); height:42px; opacity:.92; animation:tbWaveDriftFront 5.1s linear infinite;">
    <path d="M0,18 C24,8 48,8 72,18 C96,28 120,28 144,18 C168,8 192,8 216,18 C240,28 264,28 288,18 C304,12 312,12 320,18 L320,34 L0,34 Z"
      fill="rgba(255,255,255,.65)"></path>
  </svg>

  <span class="tb-water-bubble" style="position:absolute; left:18%; bottom:12px; width:6px; height:6px; border-radius:999px; background:rgba(255,255,255,.14); animation:tbBubbleRise 5.0s ease-in infinite;"></span>
  <span class="tb-water-bubble" style="position:absolute; left:61%; bottom:10px; width:4px; height:4px; border-radius:999px; background:rgba(255,255,255,.12); animation:tbBubbleRise 6.0s ease-in infinite 1.2s;"></span>
  <span class="tb-water-bubble" style="position:absolute; left:77%; bottom:14px; width:5px; height:5px; border-radius:999px; background:rgba(255,255,255,.10); animation:tbBubbleRise 5.6s ease-in infinite 2.0s;"></span>
</span>
<span aria-hidden="true" style="position:absolute; left:10px; right:10px; top:calc(${liquidTop}% - 2px); height:24px; pointer-events:none; opacity:${pct > 3 ? '.98' : '0'};">
  <svg viewBox="0 0 320 24" preserveAspectRatio="none" style="width:100%; height:100%; display:block;">
    <path d="M0,14 C28,6 56,6 84,14 C112,22 140,22 168,14 C196,6 224,6 252,14 C280,22 300,22 320,14"
      fill="none" stroke="rgba(255,255,255,.95)" stroke-width="4" stroke-linecap="round"></path>
    <path d="M0,16 C28,9 56,9 84,16 C112,23 140,23 168,16 C196,9 224,9 252,16 C280,23 300,23 320,16"
      fill="none" stroke="rgba(255,255,255,.34)" stroke-width="6" stroke-linecap="round" style="filter:blur(2px);"></path>
  </svg>
</span>
        <span aria-hidden="true" style="position:absolute; left:26px; top:26px; bottom:26px; width:18px; border-radius:999px; background:${escapeHTML(c.haze)}; opacity:.58; pointer-events:none;"></span>
        <div style="position:relative; z-index:1; display:flex; align-items:flex-start; justify-content:space-between; gap:10px;">
          <div>
            <div class="analysis-stat-label" style="font-size:12px; letter-spacing:.06em; text-transform:uppercase; color:rgba(15,23,42,.72);">${escapeHTML(c.label)}</div>
            <div class="analysis-stat-meta" style="margin-top:4px; font-size:12px; color:rgba(15,23,42,.58);">${escapeHTML(c.hint)}</div>
          </div>
          <div style="font-size:11px; font-weight:800; color:rgba(15,23,42,.60);">${pct.toFixed(0)}%</div>
        </div>
        <div style="position:relative; z-index:1; display:flex; flex-direction:column; justify-content:flex-end; gap:8px; min-width:0; flex:1;">
          <div class="analysis-stat-value" style="font-size:25px; line-height:1.14; color:#0f172a; text-shadow:0 1px 0 rgba(255,255,255,.40);">${escapeHTML(c.value)}</div>
          <div class="analysis-stat-meta" style="font-size:12px; color:rgba(15,23,42,.66);">${escapeHTML(c.footer)}</div>
        </div>
      </div>`;
    };

    const renderDeltaCard = (idx) => `
      <div class="analysis-stat analysis-stat--delta" style="animation:analysisGrow .55s ease ${idx*60}ms both; position:relative; overflow:hidden; padding:18px 18px 16px; border-radius:24px; border:1px solid rgba(255,255,255,.68); background:linear-gradient(180deg, rgba(255,255,255,.96), rgba(255,255,255,.88)); box-shadow:0 14px 34px rgba(148,163,184,.16), inset 0 1px 0 rgba(255,255,255,.84); min-height:196px; display:flex; flex-direction:column; justify-content:space-between; gap:14px;">
        <span aria-hidden="true" style="position:absolute; inset:0; border-radius:inherit; background:radial-gradient(circle at 18% 14%, rgba(255,255,255,.92), rgba(255,255,255,0) 34%), linear-gradient(180deg, rgba(255,255,255,.72), rgba(255,255,255,.34)); pointer-events:none;"></span>
        <div style="position:relative; z-index:1;">
          <div class="analysis-stat-label" style="font-size:12px; letter-spacing:.06em; text-transform:uppercase; color:rgba(15,23,42,.72);">Écart de tendance</div>
          <div class="analysis-stat-meta" style="margin-top:4px; font-size:12px; color:rgba(15,23,42,.58);">Projection finale comparée au budget app et à la référence pays.</div>
        </div>
        <div style="position:relative; z-index:1; display:flex; flex-direction:column; gap:12px;">
          <div style="padding:12px 14px; border-radius:16px; background:linear-gradient(180deg, rgba(255,255,255,.72), rgba(255,255,255,.38)); border:1px solid rgba(255,255,255,.78); box-shadow:inset 0 1px 0 rgba(255,255,255,.78);">
            <div style="font-size:12px; color:rgba(15,23,42,.58);">Vs budget app</div>
            <div style="margin-top:4px; font-size:24px; font-weight:800; color:${escapeHTML(deltaBudgetTone)};">${deltaBudgetPct >= 0 ? '+' : ''}${deltaBudgetPct.toFixed(0)} %</div>
          </div>
          <div style="padding:12px 14px; border-radius:16px; background:linear-gradient(180deg, rgba(255,255,255,.72), rgba(255,255,255,.38)); border:1px solid rgba(255,255,255,.78); box-shadow:inset 0 1px 0 rgba(255,255,255,.78);">
            <div style="font-size:12px; color:rgba(15,23,42,.58);">Vs référence pays</div>
            <div style="margin-top:4px; font-size:24px; font-weight:800; color:${escapeHTML(deltaReferenceTone)};">${deltaReferencePct >= 0 ? '+' : ''}${deltaReferencePct.toFixed(0)} %</div>
          </div>
        </div>
      </div>`;

    host.style.display = 'grid';
    host.style.gridTemplateColumns = 'repeat(auto-fit, minmax(250px, 1fr))';
    host.style.gap = '16px';
    host.style.alignItems = 'stretch';

    host.innerHTML = progressCards.map((c, idx) => renderGlassCard(c, idx)).join('') + renderDeltaCard(progressCards.length);
  }

  function _themeText(){ return getComputedStyle(document.body).getPropertyValue('--text').trim() || '#e5e7eb'; }
  function _themeMuted(){ return getComputedStyle(document.body).getPropertyValue('--muted').trim() || '#94a3b8'; }
  function _themeGrid(){ return getComputedStyle(document.body).getPropertyValue('--gridline').trim() || 'rgba(148,163,184,.18)'; }
  function _themeAccent(){ return getComputedStyle(document.body).getPropertyValue('--accent').trim() || '#3b82f6'; }
  function _themeGood(){ return getComputedStyle(document.body).getPropertyValue('--good').trim() || '#22c55e'; }
  function _themeWarn(){ return getComputedStyle(document.body).getPropertyValue('--warn').trim() || '#f59e0b'; }
  function _themeBad(){ return getComputedStyle(document.body).getPropertyValue('--bad').trim() || '#ef4444'; }
  function _ensureChart(name, id){
    const el = _el(id);
    if (!el || !window.echarts) return null;
    if (!charts[name] || charts[name].isDisposed()) charts[name] = window.echarts.init(el, null, { renderer:'canvas' });
    return charts[name];
  }
  function _renderTrajectory(model){
    const chart = _ensureChart('trajectory','analysis-trajectory-chart');
    if (!chart) return;
    const todayLabel = _iso(new Date()).slice(5);
    chart.setOption({
      animationDuration: 900,
      animationEasing: 'cubicOut',
      tooltip: { trigger:'axis', backgroundColor:'rgba(15,23,42,.92)', borderWidth:0, textStyle:{ color:'#fff' } },
      legend: { top: 6, textStyle:{ color:_themeMuted(), fontSize:11 }, itemWidth:14, itemHeight:8, data:['Réel cumulé','Cible cumulée'] },
      grid: { left: 24, right: 24, top: 52, bottom: 30, containLabel:true },
      xAxis: { type:'category', boundaryGap:false, data:model.days.map(d=>d.slice(5)), axisLine:{ lineStyle:{ color:_themeGrid() } }, axisLabel:{ color:_themeMuted(), fontSize:10, margin:8 } },
      yAxis: { type:'value', axisLabel:{ color:_themeMuted(), fontSize:10, formatter:(v)=>_fmtMoney(v, model.base) }, splitLine:{ lineStyle:{ color:_themeGrid() } } },
      series: [
        { name:'Cible cumulée', type:'line', smooth:false, symbol:'none', lineStyle:{ width:3, color:_themeGood(), opacity:.95, type:'dashed' }, areaStyle:{ color:'transparent' }, data:model.cumTarget,
          markLine: model.days.length ? { symbol:'none', lineStyle:{ type:'dashed', color:_themeGrid() }, label:{ show:false }, data:[{ xAxis: todayLabel }] } : undefined },
        { name:'Réel cumulé', type:'line', smooth:true, symbol:'circle', symbolSize:6, lineStyle:{ width:4, color:_themeAccent() }, areaStyle:{ color: { type:'linear', x:0,y:0,x2:0,y2:1, colorStops:[{ offset:0, color:'rgba(59,130,246,.34)' },{ offset:1, color:'rgba(59,130,246,.03)' }] } }, emphasis:{ focus:'series' }, data:model.cumSpent,
          markPoint:{ symbol:'circle', symbolSize:16, itemStyle:{ color:_themeAccent(), shadowBlur:18, shadowColor:'rgba(59,130,246,.45)' }, data: model.cumSpent.length ? [{ coord:[model.days.length-1, model.cumSpent[model.cumSpent.length-1]] }] : [] }
        }
      ]
    });
    const meta = _el('analysis-trajectory-meta');
    if (meta) {
      meta.innerHTML = `<div style="display:flex;flex-wrap:wrap;gap:.6rem 1rem;align-items:center;">
        <span>${escapeHTML(model.start || '—')} → ${escapeHTML(model.end || '—')}</span>
        <span>${escapeHTML(model.days.length + ' jours')}</span>
        <span>${escapeHTML(model.base)}</span>
      </div>`;
      meta.style.marginTop = '.65rem';
    }
  }
  function _renderCategory(model){
    const chart = _ensureChart('category','analysis-category-chart');
    if (!chart) return;
    const data = model.topCategories.map((it) => ({ name: it[0], value: Number(it[1].toFixed(2)), itemStyle:{ color: _categoryColor(it[0]) } }));
    chart.setOption({
      animationDuration: 1000,
      tooltip: { trigger:'item', backgroundColor:'rgba(15,23,42,.92)', borderWidth:0, textStyle:{ color:'#fff' }, formatter:(p)=>`${p.name}<br>${_fmtMoney(p.value, model.base)} • ${p.percent}%` },
      series:[{
        type:'pie', radius:['34%','78%'], center:['50%','56%'], roseType:'area', avoidLabelOverlap:true,
        itemStyle:{ borderRadius:10, borderColor:'rgba(255,255,255,.06)', borderWidth:2 },
        label:{ color:_themeText(), formatter:(p)=>`${p.name}\n${p.percent}%`, fontWeight:700 },
        labelLine:{ length:10, length2:8 },
        data: data.length ? data : [{ name:'Aucune dépense', value:1, itemStyle:{ color:'rgba(148,163,184,.25)' }, label:{ color:_themeMuted() } }]
      }]
    });
  }
  function _renderCategoryBars(model){
    const chart = _ensureChart('categoryBars','analysis-category-bars-chart');
    if (!chart) return;
    const rows = (model.categorySeries || []).slice(0, 12).reverse();
    chart.setOption({
      animationDuration: 900,
      tooltip:{ trigger:'axis', axisPointer:{ type:'shadow' }, backgroundColor:'rgba(15,23,42,.92)', borderWidth:0, textStyle:{ color:'#fff' }, formatter:(p)=>`${p?.[0]?.axisValue || ''}<br>${_fmtMoney(p?.[0]?.value || 0, model.base)}` },
      grid:{ left: 110, right: 20, top: 10, bottom: 20, containLabel:false },
      xAxis:{ type:'value', axisLabel:{ color:_themeMuted(), formatter:(v)=>_fmtMoney(v, model.base) }, splitLine:{ lineStyle:{ color:_themeGrid() } } },
      yAxis:{ type:'category', data: rows.map(r => r.name), axisLabel:{ color:_themeText() } },
      series:[{ name:'Réel', type:'bar', data: rows.map(r => ({ value:Number(r.actual.toFixed(2)), itemStyle:{ color:r.color || _themeAccent(), borderRadius:[0,10,10,0] } })), barMaxWidth:18 }]
    });
  }

  function _renderSubcategoryBreakdown(model){
    const host = _el('analysis-subcategory-breakdown');
    if (!host) return;
    const rows = (model.subcategorySeries || []).slice(0, 10);
    if (!rows.length) {
      host.innerHTML = `<div class="muted">Aucune sous-catégorie exploitée sur la plage actuelle.</div>`;
      return;
    }
    host.innerHTML = rows.map((row, idx) => `
      <div style="display:flex;align-items:center;gap:10px;justify-content:space-between;padding:8px 0;border-top:${idx ? '1px solid var(--border)' : 'none'};">
        <div style="display:flex;align-items:center;gap:10px;min-width:0;">
          <span style="display:inline-block;width:10px;height:10px;border-radius:999px;background:${escapeHTML(row.color || _themeAccent())};flex:0 0 auto;"></span>
          <div style="min-width:0;">
            <div style="font-weight:600;">${escapeHTML(row.subcategoryName || 'Sans sous-catégorie')}</div>
            <div class="muted" style="font-size:12px;">${escapeHTML(row.categoryName || 'Autre')}</div>
          </div>
        </div>
        <div style="font-weight:700;white-space:nowrap;">${escapeHTML(_fmtMoney(row.actual, model.base))}</div>
      </div>
    `).join('');
  }
  function _renderVelocity(model){
    const chart = _ensureChart('velocity','analysis-velocity-chart');
    if (!chart) return;
    chart.setOption({
      animationDuration: 900,
      tooltip:{ trigger:'axis', backgroundColor:'rgba(15,23,42,.92)', borderWidth:0, textStyle:{ color:'#fff' } },
      grid:{ left:18, right:12, top:12, bottom:24, containLabel:true },
      xAxis:{ type:'category', data:model.days.map(d=>d.slice(5)), axisLabel:{ color:_themeMuted() }, axisLine:{ lineStyle:{ color:_themeGrid() } } },
      yAxis:{ type:'value', axisLabel:{ color:_themeMuted(), formatter:(v)=>_fmtMoney(v, model.base) }, splitLine:{ lineStyle:{ color:_themeGrid() } } },
      series:[
        { type:'bar', barMaxWidth:22, data:model.velocity, itemStyle:{ borderRadius:[8,8,0,0], color: new window.echarts.graphic.LinearGradient(0,0,0,1,[{ offset:0,color:_themeAccent() },{ offset:1,color:'rgba(59,130,246,.25)' }]) } },
        { type:'line', smooth:true, symbol:'none', data:model.days.map(()=>Number(model.budgetPerDay.toFixed(2))), lineStyle:{ color:_themeWarn(), width:2, type:'dashed' } }
      ]
    });
  }
  function _renderHeatmap(model){
    const chart = _ensureChart('heatmap','analysis-heatmap-chart');
    if (!chart) return;
    chart.setOption({
      animationDuration: 950,
      tooltip:{ position:'top', backgroundColor:'rgba(15,23,42,.92)', borderWidth:0, textStyle:{ color:'#fff' }, formatter:(p)=>`${model.days[p.data[0]]}<br>${_fmtMoney(p.data[2], model.base)}` },
      grid:{ left:8, right:8, top:10, bottom:22, containLabel:true },
      xAxis:{ type:'category', data:model.days.map(d=>d.slice(5)), splitArea:{ show:false }, axisLabel:{ color:_themeMuted(), interval: Math.max(0, Math.floor(model.days.length/10)) }, axisLine:{ lineStyle:{ color:_themeGrid() } } },
      yAxis:{ type:'category', data:['Intensité'], axisLabel:{ color:_themeMuted() }, axisLine:{ lineStyle:{ color:_themeGrid() } } },
      visualMap:{ min:0, max:Math.max(...model.heat.map(h=>h[2]), 1), show:false, inRange:{ color:['rgba(30,41,59,.18)', 'rgba(59,130,246,.28)', 'rgba(59,130,246,.92)'] } },
      series:[{ type:'heatmap', data:model.heat, label:{ show:false }, itemStyle:{ borderRadius:8, borderColor:'rgba(255,255,255,.05)', borderWidth:2 } }]
    });
  }
  function _wrapAxisLabel(label){
    const txt = String(label || '');
    if (txt.length <= 14) return txt;
    const words = txt.split(/\s+/).filter(Boolean);
    if (words.length <= 1) return txt;
    const lines = [];
    let line = '';
    words.forEach((word) => {
      const next = line ? `${line} ${word}` : word;
      if (next.length > 14 && line) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    });
    if (line) lines.push(line);
    return lines.slice(0, 2).join('\n');
  }

  function _renderReferencePanel(model){
    const summary = _el('analysis-reference-summary');
    const chartEl = _el('analysis-reference-mix-chart');
    const chart = charts.referenceMix;
    const rows = (model.referenceComparisonSeries || []).filter(r => _safeNum(r.actualPerDay) > 0 || _safeNum(r.referencePerDay) > 0);
    const coverage = model.referenceCoverageDays && model.days.length ? `${model.referenceCoverageDays}/${model.days.length} jours couverts` : 'Aucune source active';
    const deltaTone = (model.comparablePerDay - model.referencePerDay) <= 0 ? 'Sous la référence' : 'Au-dessus de la référence';
    const referenceCountry = model.referenceContext?.countryLabel && model.referenceContext.countryLabel !== 'Pays —'
      ? model.referenceContext.countryLabel
      : 'Aucune référence pays active';

    const referenceProfile = model.referenceContext?.profileLabel && model.referenceContext.profileLabel !== 'Profil —'
      ? model.referenceContext.profileLabel
      : null;

    const referenceStyle = model.referenceContext?.styleLabel && model.referenceContext.styleLabel !== 'Style —'
      ? model.referenceContext.styleLabel
      : null;

    const referenceAdults = model.referenceContext?.adultsLabel && model.referenceContext.adultsLabel !== 'ad. —'
      ? model.referenceContext.adultsLabel.replace('ad.', 'adulte(s)')
      : null;

    const referenceChildren = model.referenceContext?.childrenLabel && model.referenceContext.childrenLabel !== 'enf. —'
      ? model.referenceContext.childrenLabel.replace('enf.', 'enfant(s)')
      : null;

    const referenceContextLabel = [
      referenceCountry,
      referenceProfile && `Profil ${referenceProfile}`,
      referenceStyle && `Style ${referenceStyle}`,
      referenceAdults,
      referenceChildren
    ].filter(Boolean).join(' • ');
    if (summary) {
      summary.innerHTML = `
        <div class="analysis-reference-stat">
          <span>Sourcé / jour</span>
          <strong>${escapeHTML(_fmtMoney(model.referencePerDay, model.base))}</strong>
          <small>${escapeHTML(coverage)}</small>
        </div>
        <div class="analysis-reference-stat">
          <span>Réel / jour</span>
          <strong>${escapeHTML(_fmtMoney(model.comparablePerDay, model.base))}</strong>
          <small>Comparatif net des catégories exclues</small>
        </div>
        <div class="analysis-reference-stat">
          <span>Écart / jour</span>
          <strong>${escapeHTML(_fmtMoney(model.comparablePerDay - model.referencePerDay, model.base))}</strong>
          <small>${escapeHTML(deltaTone)}</small>
        </div>
                <div class="analysis-reference-inline">
          <div class="analysis-reference-context" style="font-size:1rem;font-weight:700;line-height:1.35;padding:.7rem .9rem;border-radius:16px;background:rgba(148,163,184,.10);border:1px solid rgba(148,163,184,.18);">
            Contexte : ${escapeHTML(referenceContextLabel)}
          </div>
        </div>`;
    }
    if (chart && chart.dispose) { try { chart.dispose(); } catch(_) {} delete charts.referenceMix; }
    if (!chartEl) return;
    if (!rows.length) {
      chartEl.innerHTML = `<div class="analysis-reference-empty">Aucune référence pays active sur cette plage.</div>`;
      return;
    }
    chartEl.innerHTML = `
      <div class="analysis-reference-metal-grid">
        ${rows.map((row)=>{
          const ref = _safeNum(row.referencePerDay);
          const actual = _safeNum(row.actualPerDay);
          const diff = actual - ref;
          const tone = diff <= 0 ? 'good' : 'warn';
          return `<div class="analysis-reference-metal analysis-reference-metal--${tone}">
            <div class="analysis-reference-metal-head">
              <span>${escapeHTML(row.name)}</span>
              <strong>${escapeHTML(_fmtMoney(diff, model.base))}</strong>
            </div>
            <div class="analysis-reference-metal-body">
              <div><small>Réel / jour</small><b>${escapeHTML(_fmtMoney(actual, model.base))}</b></div>
              <div><small>Sourcé / jour</small><b>${escapeHTML(_fmtMoney(ref, model.base))}</b></div>
            </div>
          </div>`;
        }).join('')}
        ${model.unmappedPerDay > 0 ? `<div class="analysis-reference-metal analysis-reference-metal--neutral">
          <div class="analysis-reference-metal-head">
            <span>Non référencé</span>
            <strong>${escapeHTML(_fmtMoney(model.unmappedPerDay, model.base))}</strong>
          </div>
          <div class="analysis-reference-metal-body">
            <div><small>Réel / jour</small><b>${escapeHTML(_fmtMoney(model.unmappedPerDay, model.base))}</b></div>
            <div><small>Sourcé / jour</small><b>${escapeHTML(_fmtMoney(0, model.base))}</b></div>
          </div>
        </div>` : ''}
        ${model.excludedPerDay > 0 ? `<div class="analysis-reference-metal analysis-reference-metal--neutral">
          <div class="analysis-reference-metal-head">
            <span>Exclu du comparatif</span>
            <strong>${escapeHTML(_fmtMoney(model.excludedPerDay, model.base))}</strong>
          </div>
          <div class="analysis-reference-metal-body">
            <div><small>Réel / jour</small><b>${escapeHTML(_fmtMoney(model.excludedPerDay, model.base))}</b></div>
            <div><small>Traitement</small><b>Hors comparaison sourcée</b></div>
          </div>
        </div>` : ''}
      </div>`;
  }

  function _renderNightCovered(model){
    const host = _el('analysis-night-covered');
    if (!host) return;
    const count = Number(model?.nightCoveredCount || 0);
    if (!count) {
      host.innerHTML = `<div class="muted">Aucun transport marqué comme remplaçant une nuit d'hébergement sur la plage analysée.</div>`;
      return;
    }
    const rows = (model.nightCoveredRows || []).slice().sort((a,b)=> String(b.date).localeCompare(String(a.date))).slice(0,6);
    host.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:14px;">
        <div style="padding:12px 14px;border:1px solid var(--border);border-radius:18px;background:linear-gradient(180deg, rgba(59,130,246,.08), rgba(255,255,255,.5));">
          <div class="muted" style="font-size:12px;">Transports concernés</div>
          <div style="font-size:24px;font-weight:800;">${count}</div>
        </div>
        <div style="padding:12px 14px;border:1px solid var(--border);border-radius:18px;background:linear-gradient(180deg, rgba(16,185,129,.10), rgba(255,255,255,.5));">
          <div class="muted" style="font-size:12px;">Économie potentielle logement</div>
          <div style="font-size:24px;font-weight:800;">${escapeHTML(_fmtMoney(model.nightCoveredPotentialSavings, model.base))}</div>
        </div>
        <div style="padding:12px 14px;border:1px solid var(--border);border-radius:18px;background:linear-gradient(180deg, rgba(245,158,11,.10), rgba(255,255,255,.5));">
          <div class="muted" style="font-size:12px;">Moyenne par nuit remplacée</div>
          <div style="font-size:24px;font-weight:800;">${escapeHTML(_fmtMoney(model.nightCoveredAverageSaving, model.base))}</div>
        </div>
      </div>
      <div class="muted" style="margin-bottom:10px;font-size:12px;line-height:1.45;">Signal analytique uniquement : ces montants n'altèrent ni le budget, ni les KPI, ni la projection. Ils servent à expliquer le logement potentiellement évité par des transports de nuit.</div>
      <div style="display:grid;gap:8px;">
        ${rows.map((row) => `
          <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;padding:10px 0;border-top:1px solid var(--border);">
            <div style="min-width:0;">
              <div style="font-weight:700;">${escapeHTML(row.label)}</div>
              <div class="muted" style="font-size:12px;">${escapeHTML(row.date)} • ${escapeHTML(row.category)}</div>
            </div>
            <div style="text-align:right;white-space:nowrap;">
              <div style="font-weight:700;">${escapeHTML(_fmtMoney(row.saving, model.base))}</div>
              <div class="muted" style="font-size:12px;">transport ${escapeHTML(_fmtMoney(row.spent, model.base))}</div>
            </div>
          </div>`).join('')}
      </div>`;
  }

  function _renderInsights(model){
    const host = _el('analysis-insights');
    if (!host) return;
    const delta = model.projection - model.totalBudget;
    const sourcedGap = model.comparablePerDay - model.referencePerDay;
    const top = model.topCategories[0];
    const topUnmapped = (model.unmappedCategorySeries || [])[0] || null;
    const nightLine = Number(model?.nightCoveredCount || 0) > 0
      ? {
          icon: '🌙',
          title: `Transports de nuit : ${model.nightCoveredCount} cas`,
          body: `${_fmtMoney(model.nightCoveredPotentialSavings, model.base)} d'économie potentielle logement restent visibles à part, sans corriger le budget principal.`
        }
      : null;
    const insights = [
      ...(nightLine ? [nightLine] : []),
      {
        icon: sourcedGap > 0 ? '🧭' : '🌿',
        title: sourcedGap > 0 ? 'Réel au-dessus du sourcé' : 'Réel sous le sourcé',
        body: sourcedGap > 0
          ? `Sur le périmètre comparable, tu dépenses ${_fmtMoney(model.comparablePerDay, model.base)}/jour contre une référence pays de ${_fmtMoney(model.referencePerDay, model.base)}/jour, soit ${_fmtMoney(sourcedGap, model.base)}/jour au-dessus.`
          : `Sur le périmètre comparable, tu dépenses ${_fmtMoney(model.comparablePerDay, model.base)}/jour contre une référence pays de ${_fmtMoney(model.referencePerDay, model.base)}/jour, soit ${_fmtMoney(Math.abs(sourcedGap), model.base)}/jour en dessous.`
      },
      {
        icon: model.avgPerDay > model.budgetPerDay ? '⚠️' : '✅',
        title: model.avgPerDay > model.budgetPerDay ? 'Cadence au-dessus de la cible' : 'Cadence maîtrisée',
        body: model.avgPerDay > model.budgetPerDay
          ? `Globalement, tu tournes à ${_fmtMoney(model.avgPerDay, model.base)}/jour pour une cible app de ${_fmtMoney(model.budgetPerDay, model.base)}/jour. Sur le comparable sourcé, tu es à ${_fmtMoney(model.comparablePerDay, model.base)}/jour.`
          : `Globalement, tu restes sous la cible avec ${_fmtMoney(model.avgPerDay, model.base)}/jour contre ${_fmtMoney(model.budgetPerDay, model.base)}/jour visés. Sur le comparable sourcé, tu es à ${_fmtMoney(model.comparablePerDay, model.base)}/jour.`
      },
      {
        icon: top ? '🧲' : '•',
        title: top ? `Catégorie dominante : ${top[0]}` : 'Aucune catégorie dominante',
        body: top ? `${_fmtMoney(top[1], model.base)} engagés, soit ${((top[1]/Math.max(model.spent,1))*100).toFixed(1)}% du total analysé.` : `Ajoute quelques dépenses pour faire émerger les tendances.`
      },
      {
        icon: delta > 0 ? '📈' : '🌿',
        title: delta > 0 ? 'Projection au-dessus du cap' : 'Projection dans la trajectoire',
        body: delta > 0 ? `Au rythme actuel, tu finirais à ${_fmtMoney(model.projection, model.base)}, soit ${_fmtMoney(delta, model.base)} au-dessus du budget.` : `La projection termine à ${_fmtMoney(model.projection, model.base)}. Tu gardes une marge d’environ ${_fmtMoney(Math.abs(delta), model.base)}.`
      },
      {
        icon: topUnmapped ? '🧩' : (model.excludedPerDay > 0 ? '🪶' : (model.outAmount > 0 ? '🎯' : '🧭')),
        title: topUnmapped ? `À mapper ensuite : ${topUnmapped.name}` : (model.excludedPerDay > 0 ? 'Comparatif nettoyé des exclus' : (model.outAmount > 0 ? 'Hors budget visible' : 'Lecture budgétaire propre')),
        body: topUnmapped
          ? `${_fmtMoney(topUnmapped.actual, model.base)} restent dans une catégorie non référencée. Elle est visible à part et ne se mélange pas au comparatif mappé.`
          : (model.excludedPerDay > 0
            ? `${_fmtMoney(model.excludedPerDay, model.base)}/jour sont exclus du comparatif sourcé selon le mapping centralisé, tout en restant visibles dans le pilotage global.`
            : (model.outAmount > 0
              ? `${_fmtMoney(model.outAmount, model.base)} hors budget sur la plage. Tu peux exclure des catégories sans polluer la trajectoire.`
              : `Aucune dépense hors budget notable sur la plage courante.`))
      }
    ];
    host.innerHTML = insights.map(i => `
      <div class="analysis-insight">
        <div class="analysis-insight-badge">${i.icon}</div>
        <div>
          <p class="analysis-insight-title">${escapeHTML(i.title)}</p>
          <p class="analysis-insight-body">${escapeHTML(i.body)}</p>
        </div>
      </div>
    `).join('');
    const pill = _el('analysis-live-pill');
    if (pill) pill.textContent = `${model.txs.length} dépenses • ${model.days.length} jours • ${model.base}`;
  }

  function _renderAll(){
    if (!_el('view-analysis')) return;
    _saveFilters();
    const model = _computeModel();

    _buildSummary(model);
    _renderNightCovered(model);
    _renderInsights(model);
    _renderCategory(model);
    _renderCategoryBars(model);
    _renderSubcategoryBreakdown(model);
    _renderTrajectory(model);
    _renderReferencePanel(model);
    _renderVelocity(model);
    _renderHeatmap(model);

    const view = _el('view-analysis');
    if (!view) return;

    const insightsHost = _el('analysis-insights');
    const categoryHost = _el('analysis-category-chart');
    const categoryBarsHost = _el('analysis-category-bars-chart');
    const subcategoryHost = _el('analysis-subcategory-breakdown');
    const trajectoryHost = _el('analysis-trajectory-chart');
    const referenceSummaryHost = _el('analysis-reference-summary');
    const referenceMixHost = _el('analysis-reference-mix-chart');
    const velocityHost = _el('analysis-velocity-chart');
    const heatmapHost = _el('analysis-heatmap-chart');
    const summaryHost = _el('analysis-summary');

    function _cardFor(host){
      if (!host) return null;
      return host.closest('.analysis-card, .card, section, .panel') || host.parentElement;
    }

    const summaryCard = _cardFor(summaryHost);
    const insightsCard = _cardFor(insightsHost);
    const categoryCard = _cardFor(categoryHost);
    const categoryBarsCard = _cardFor(categoryBarsHost);
    const subcategoryCard = _cardFor(subcategoryHost);
    const trajectoryCard = _cardFor(trajectoryHost);
    const referenceCard = _cardFor(referenceSummaryHost) || _cardFor(referenceMixHost);
    const velocityCard = _cardFor(velocityHost);
    const heatmapCard = _cardFor(heatmapHost);

    let layout = _el('analysis-custom-layout');
    if (!layout) {
      layout = document.createElement('div');
      layout.id = 'analysis-custom-layout';
      layout.style.display = 'grid';
      layout.style.gridTemplateColumns = 'repeat(2, minmax(0, 1fr))';
      layout.style.gap = '18px';
      layout.style.alignItems = 'stretch';
      layout.style.width = '100%';
      layout.style.marginTop = '18px';

      if (summaryCard && summaryCard.parentElement === view) {
        summaryCard.insertAdjacentElement('afterend', layout);
      } else {
        view.appendChild(layout);
      }
    }

    const orderedCards = [
      insightsCard,
      categoryCard,
      categoryBarsCard,
      subcategoryCard,
      trajectoryCard,
      referenceCard,
      velocityCard,
      heatmapCard
    ].filter(Boolean);

    const oldContainers = [];

    orderedCards.forEach((card) => {
      if (!card) return;
      const oldParent = card.parentElement;
      if (oldParent && oldParent !== layout) oldContainers.push(oldParent);

      layout.appendChild(card);
      card.style.gridColumn = '';
      card.style.minHeight = '';
      card.style.width = '100%';
      card.style.maxWidth = '100%';
      card.style.alignSelf = 'stretch';
      card.style.margin = '0';
      card.style.boxSizing = 'border-box';
    });

    if (trajectoryCard) {
      trajectoryCard.style.gridColumn = '1 / -1';
      trajectoryCard.style.minHeight = '560px';
    }

    if (referenceCard) {
      referenceCard.style.gridColumn = '1 / -1';
    }

    if (trajectoryHost) {
      trajectoryHost.style.height = '430px';
      trajectoryHost.style.width = '100%';
    }

    if (heatmapHost) {
      heatmapHost.style.height = '320px';
      heatmapHost.style.width = '100%';
    }

    oldContainers.forEach((node) => {
      if (!node || node === layout || node.contains(layout)) return;
      if (node.children.length === 0 || node.textContent.trim() === '') {
        node.style.display = 'none';
        node.style.minHeight = '0';
        node.style.height = '0';
        node.style.margin = '0';
        node.style.padding = '0';
        node.style.border = '0';
      }
    });

    try { charts.trajectory && charts.trajectory.resize(); } catch (_) {}
    try { charts.category && charts.category.resize(); } catch (_) {}
    try { charts.categoryBars && charts.categoryBars.resize(); } catch (_) {}
    try { charts.velocity && charts.velocity.resize(); } catch (_) {}
    try { charts.heatmap && charts.heatmap.resize(); } catch (_) {}
  }

  function _toggleRangeBox(){
    const pid = _getSelectedPeriodId();
    const { box, start, end } = _rangeInputs();
    if (!box) return;
    const travel = _getSelectedTravel();
    const tStart = _norm(travel?.start_date || travel?.start || '');
    const tEnd = _norm(travel?.end_date || travel?.end || '');
    box.style.display = (pid === 'range') ? 'grid' : 'none';
    if (pid === 'range') {
      if (start && !start.value) start.value = tStart;
      if (end && !end.value) end.value = tEnd;
      if (start) { start.min = tStart; start.max = tEnd || ''; }
      if (end) { end.min = tStart; end.max = tEnd || ''; }
    }
  }
  function _fillPeriodSelect(travelId, wanted){
    const sel = _el('analysis-period');
    if (!sel) return;
    const periods = _periodList(travelId).slice().sort((a,b)=>String(a.start_date || a.start || '').localeCompare(String(b.start_date || b.start || '')));
    const activePeriod = _getActivePeriodForTravel(travelId);
    const activeLabel = activePeriod
      ? `Période active (${_norm(activePeriod.start_date || activePeriod.start)} → ${_norm(activePeriod.end_date || activePeriod.end)})`
      : 'Période active';
    sel.innerHTML = `<option value="active">${escapeHTML(activeLabel)}</option><option value="all">Tout le voyage</option>` + periods.map((p, idx) => {
      const s = _norm(p.start_date || p.start);
      const e = _norm(p.end_date || p.end);
      const base = _upper(p.base_currency || p.baseCurrency || '');
      return `<option value="${escapeHTML(String(p.id))}">${escapeHTML(`Période ${idx+1} • ${s} → ${e}${base ? ' • ' + base : ''}`)}</option>`;
    }).join('') + `<option value="range">Date à date</option>`;
    const candidate = wanted || 'active';
    if ([...sel.options].some(o => o.value === candidate)) sel.value = candidate;
    _toggleRangeBox();
  }

  function _ensureEvents(){
    ['analysis-travel','analysis-period','analysis-scope','analysis-mode','analysis-range-start','analysis-range-end','analysis-currency'].forEach(id => {
      const el = _el(id);
      if (!el || el._tbBound) return;
      el._tbBound = true;
      el.addEventListener('change', async () => {
        if (id === 'analysis-travel') {
          const f = _loadFilters();
          const rs = _el('analysis-range-start');
          const re = _el('analysis-range-end');
          if (rs) rs.value = f.rangeStart || '';
          if (re) re.value = f.rangeEnd || '';
          _fillPeriodSelect(_getSelectedTravelId(), 'active');
          _renderCategoryExcludeChips(Array.from(excludedCats));
        }
        if (id === 'analysis-period') _toggleRangeBox();
        await _loadReferenceCache();
        _renderAll();
      });
    });
    const refresh = _el('analysis-refresh');
    if (refresh && !refresh._tbBound) {
      refresh._tbBound = true;
      refresh.addEventListener('click', async () => { await _loadReferenceCache(); _renderAll(); });
    }
    const toggleBtn = _el('analysis-category-toggle');
    if (toggleBtn && !toggleBtn._tbBound) {
      toggleBtn._tbBound = true;
      toggleBtn.onclick = () => {
        excludePanelOpen = !excludePanelOpen;
        _updateCategoryExcludeSummary();
      };
    }
    const allBtn = _el('analysis-cat-all');
    if (allBtn && !allBtn._tbBound) {
      allBtn._tbBound = true;
      allBtn.onclick = () => { excludedCats.clear(); _renderCategoryExcludeChips([]); _renderAll(); };
    }
    const noneBtn = _el('analysis-cat-none');
    if (noneBtn && !noneBtn._tbBound) {
      noneBtn._tbBound = true;
      noneBtn.onclick = () => { excludedCats = new Set(_allAnalysisCategories()); _renderCategoryExcludeChips(Array.from(excludedCats)); _renderAll(); };
    }
    if (!resizeBound) {
      resizeBound = true;
      window.addEventListener('resize', () => {
        Object.values(charts).forEach(ch => { try { ch && ch.resize(); } catch (_) {} });
      });
    }
  }

  window.renderBudgetAnalysis = async function renderBudgetAnalysis(){
    const travelSel = _el('analysis-travel');
    if (!travelSel) return;
    const filters = _loadFilters();
    const travels = _travelList();
    travelSel.innerHTML = travels.map(t => `<option value="${escapeHTML(String(t.id))}">${escapeHTML(String(t.name || 'Voyage'))}</option>`).join('');
    const wantedTravel = (_isUUID(filters.travelId) && travels.some(t => String(t.id) === String(filters.travelId))) ? filters.travelId : (state?.activeTravelId || travels[0]?.id || '');
    if (wantedTravel && [...travelSel.options].some(o => o.value === String(wantedTravel))) travelSel.value = String(wantedTravel);
    _fillPeriodSelect(travelSel.value, filters.periodId || 'active');
    const range = _rangeInputs();
    if (range.start) range.start.value = filters.rangeStart || '';
    if (range.end) range.end.value = filters.rangeEnd || '';
    _toggleRangeBox();
    if (_el('analysis-scope')) _el('analysis-scope').value = ['budget','out','all'].includes(filters.scope) ? filters.scope : 'budget';
    if (_el('analysis-mode')) _el('analysis-mode').value = ['expenses','planned'].includes(filters.mode) ? filters.mode : 'planned';
    if (_el('analysis-currency')) _el('analysis-currency').value = ['period','account'].includes(filters.currencyMode) ? filters.currencyMode : 'period';
    excludePanelOpen = false;
    _renderCategoryExcludeChips(Array.isArray(filters.excludedCats) ? filters.excludedCats : []);
    _ensureEvents();
    await _loadReferenceCache();
    _renderAll();
  };
})();function forceSingleColumnMobile() {
  if (window.innerWidth < 640) {
    document.querySelectorAll(".kpi-grid").forEach(el => {
      el.style.gridTemplateColumns = "1fr";
    });
  }
}

window.addEventListener("resize", forceSingleColumnMobile);
forceSingleColumnMobile();
