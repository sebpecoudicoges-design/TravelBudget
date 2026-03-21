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
  function _txDate(tx){ return _norm(tx?.dateStart || tx?.date_start || tx?.occurrence_date || tx?.date || tx?.created_at?.slice?.(0,10) || tx?.createdAt?.slice?.(0,10)); }
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

function _mapToSourcedBucket(categoryName) {
  const key = _normKey(categoryName);
  const meta = TB_SOURCED_CATEGORY_MAPPING[key] || null;
  if (!meta) return { mode: 'unmapped' };
  const compareMode = String(meta.compare_mode || meta.mode || '').trim().toLowerCase();
  const bucket = meta.sourced_bucket || meta.bucket || null;
  if (compareMode === 'mapped' && bucket) return { mode: 'mapped', bucket };
  if (compareMode === 'excluded') return { mode: 'excluded' };
  return { mode: 'unmapped' };
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
      const ds = _txDate(tx);
      if (!ds) return false;
      if (start && ds < start) return false;
      if (end && ds > end) return false;
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
      const ds = _txDate(tx);
      const amt = _convert(tx?.amount, tx?.currency || base, ds, base);
      spent += amt;
      if (_txPaid(tx)) paidSpent += amt;
      dailyMap[ds] = _safeNum(dailyMap[ds]) + amt;
      if (_txPaid(tx)) paidMap[ds] = _safeNum(paidMap[ds]) + amt;
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

    const referenceCategoryMap = new Map([
      ['Logement', 0],
      ['Repas', 0],
      ['Transport', 0],
      ['Activités', 0],
      ['Autre', 0],
    ]);
    const coveredDaySet = new Set(coveredDays);
    const todayIso = _iso(new Date());
    const effectiveEnd = end < todayIso ? end : todayIso;
    const elapsedDaysList = days.filter((d) => d <= effectiveEnd);
    const elapsedComparableDaysList = coveredDays.filter((d) => d <= effectiveEnd);
    const comparableDays = Math.max(1, elapsedComparableDaysList.length || elapsedDaysList.length || days.length);
    const referenceContext = _buildReferenceContext(days, effectiveEnd);
    let comparableSpent = 0;
    let comparableMappedSpent = 0;
    const comparableCategoryMap = new Map([['Logement',0],['Repas',0],['Transport',0],['Activités',0]]);
    for (const tx of txs) {
      const ds = _txDate(tx);
      if (ds > effectiveEnd) continue;
      if (!coveredDaySet.size || coveredDaySet.has(ds)) {
        const amt = _convert(tx?.amount, tx?.currency || base, ds, base);
        const raw = _norm(tx?.category || 'Autre');
        const mapping = _mapToSourcedBucket(raw);

        comparableSpent += amt;

        if (mapping.mode !== 'mapped') continue;

        comparableMappedSpent += amt;
        comparableCategoryMap.set(
          mapping.bucket,
          comparableCategoryMap.get(mapping.bucket) + amt
        );
      }
    }
    const totalBudget = targetDaily
      .filter((_, idx) => days[idx] <= effectiveEnd)
      .reduce((a,b)=>a+b,0);
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
      referenceCategoryMap.set('Autre', refSums.Autre / referenceCoverageDays);
    }

    const unmappedComparableSpent = Math.max(0, comparableSpent - comparableMappedSpent);
    const unmappedPerDay = comparableDays > 0 ? (unmappedComparableSpent / comparableDays) : 0;
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
    const outAmount = _outBudgetTransactions().reduce((sum, tx) => sum + _convert(tx?.amount, tx?.currency || base, _txDate(tx), base), 0);
    const referenceCategorySeries = [...referenceCategoryMap.entries()].map(([name, actual]) => ({ name, actual, color: _categoryColor(name) }));
    const referenceComparisonSeries = _buildReferenceComparisonSeries(comparableCategoryMap, referenceCategoryMap, elapsedComparableDaysList.length || comparableDays);

    return { base, start, end, days, txs, spent, paidSpent, totalBudget, totalReference, totalReferenceElapsed, totalReferencePeriod, remaining, pct, referencePct, avgPerDay, budgetPerDay, referencePerDay, referenceMiscPerDay, unmappedPerDay, projection,
      cumSpent, cumTarget, cumReference, velocity, heat, topCategories, categorySeries, subcategorySeries, referenceCategorySeries, referenceComparisonSeries, outAmount, spentToToday, targetToToday, referenceToToday, referenceGap, referenceCoverageDays, referenceContext };
        }
  function _buildReferenceComparisonSeries(actualMap, referenceCategoryMap, comparableDays){
    const map = (actualMap instanceof Map)
      ? actualMap
      : new Map((actualMap || []).map((row) => [String(row?.name || '').trim(), _safeNum(row?.actual)]));

    const days = Math.max(1, Number(comparableDays) || 1);
    const mappings = [
      { name:'Logement', actualKey:'Logement', referenceKey:'Logement' },
      { name:'Repas', actualKey:'Repas', referenceKey:'Repas' },
      { name:'Transport', actualKey:'Transport', referenceKey:'Transport' },
      { name:'Activités', actualKey:'Activités', referenceKey:'Activités' },
    ];

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
    const health = model.totalBudget > 0 ? Math.max(0, Math.min(100, model.pct)) : 0;
    const cards = [
      { label:'Budget prévu app', value:_fmtMoney(model.totalBudget, model.base), meta:`${model.days.length} jours analysés`, pct:100 },
      { label:'Sourcé total période', value:_fmtMoney(model.totalReferencePeriod, model.base), pct: model.totalReferencePeriod ? 100 : 0 },
      { label:'Dépensé cumulé', value:_fmtMoney(model.spentToToday, model.base), meta:`${health.toFixed(1)}% du budget app consommé sur les jours écoulés`, pct:health },
      { label:'Sourcé cumulé écoulé', value:_fmtMoney(model.totalReferenceElapsed, model.base), meta:'Base de comparaison du réel écoulé', pct: model.totalReferenceElapsed ? 100 : 0 },
      { label:'Hors budget', value:_fmtMoney(model.outAmount, model.base), meta:'Visible sans polluer le pilotage principal', pct: model.totalBudget ? Math.min(100, (model.outAmount / Math.max(model.totalBudget,1))*100) : 0 },
      { label:'Projection fin période', value:_fmtMoney(model.projection, model.base), meta:model.projection > model.totalReferencePeriod && model.totalReferencePeriod > 0 ? 'Au-dessus de la source totale' : (model.projection > model.totalBudget ? 'Au-dessus du cap app' : 'Dans la trajectoire'), pct: model.totalBudget ? Math.min(100, (model.projection / model.totalBudget) * 100) : 0 },
    ];
    host.innerHTML = cards.map((c, idx) => `
      <div class="analysis-stat" style="animation:analysisGrow .55s ease ${idx*60}ms both;">
        <div class="analysis-stat-label">${escapeHTML(c.label)}</div>
        <div class="analysis-stat-value">${escapeHTML(c.value)}</div>
        <div class="analysis-stat-meta">${escapeHTML(c.meta)}</div>
        <div class="analysis-stat-bar"><span style="width:${Math.max(6, Math.min(100, c.pct || 0))}%"></span></div>
      </div>
    `).join('');
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
    const deltaTone = model.referenceGap <= 0 ? 'Sous la référence' : 'Au-dessus de la référence';
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
          <strong>${escapeHTML(_fmtMoney(model.avgPerDay, model.base))}</strong>
        </div>
        <div class="analysis-reference-stat">
          <span>Écart / jour</span>
          <strong>${escapeHTML(_fmtMoney(model.avgPerDay - model.referencePerDay, model.base))}</strong>
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
        <div class="analysis-reference-metal analysis-reference-metal--neutral">
          <div class="analysis-reference-metal-head">
            <span>Non référencé</span>
            <strong>${escapeHTML(_fmtMoney(model.unmappedPerDay, model.base))}</strong>
          </div>
          <div class="analysis-reference-metal-body">
            <div><small>Réel / jour</small><b>${escapeHTML(_fmtMoney(model.unmappedPerDay, model.base))}</b></div>
            <div><small>Sourcé / jour</small><b>${escapeHTML(_fmtMoney(0, model.base))}</b></div>
          </div>
        </div>
      </div>`;
  }

  function _renderInsights(model){
    const host = _el('analysis-insights');
    const delta = model.projection - model.totalBudget;
    const sourcedGap = model.avgPerDay - model.referencePerDay;
    const top = model.topCategories[0];
    const insights = [
      {
        icon: sourcedGap > 0 ? '🧭' : '🌿',
        title: sourcedGap > 0 ? 'Réel au-dessus du sourcé' : 'Réel sous le sourcé',
        body: sourcedGap > 0
          ? `Tu dépenses ${_fmtMoney(model.avgPerDay, model.base)}/jour contre une référence pays de ${_fmtMoney(model.referencePerDay, model.base)}/jour, soit ${_fmtMoney(sourcedGap, model.base)}/jour au-dessus.`
          : `Tu dépenses ${_fmtMoney(model.avgPerDay, model.base)}/jour contre une référence pays de ${_fmtMoney(model.referencePerDay, model.base)}/jour, soit ${_fmtMoney(Math.abs(sourcedGap), model.base)}/jour en dessous.`
      },
      {
        icon: model.avgPerDay > model.budgetPerDay ? '⚠️' : '✅',
        title: model.avgPerDay > model.budgetPerDay ? 'Cadence au-dessus de la cible' : 'Cadence maîtrisée',
        body: model.avgPerDay > model.budgetPerDay
          ? `Tu tournes à ${_fmtMoney(model.avgPerDay, model.base)}/jour pour une cible app de ${_fmtMoney(model.budgetPerDay, model.base)}/jour, avec une source pays de ${_fmtMoney(model.referencePerDay, model.base)}/jour.`
          : `Tu restes sous la cible avec ${_fmtMoney(model.avgPerDay, model.base)}/jour contre ${_fmtMoney(model.budgetPerDay, model.base)}/jour visés, pour une source pays à ${_fmtMoney(model.referencePerDay, model.base)}/jour.`
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
        icon: model.outAmount > 0 ? '🎯' : '🧭',
        title: model.outAmount > 0 ? 'Hors budget visible' : 'Lecture budgétaire propre',
        body: model.outAmount > 0 ? `${_fmtMoney(model.outAmount, model.base)} hors budget sur la plage. Tu peux exclure des catégories sans polluer la trajectoire.` : `Aucune dépense hors budget notable sur la plage courante.`
      }
    ];
    if (host) host.innerHTML = insights.map(i => `
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
})();
