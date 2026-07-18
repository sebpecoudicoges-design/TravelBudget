(function () {
  const LS_KEY = 'tb_budget_analysis_filters_v1';
  const charts = { trajectory: null, category: null, categoryBars: null, velocity: null, heatmap: null, referenceMix: null };
  const referenceCache = { key: '', bySegment: {}, loaded: false };
  let resizeBound = false;
  let excludedCats = new Set();
  let excludePanelOpen = false;
  let lastAnalysisModel = null;

  const TB_SOURCED_CATEGORY_MAPPING = Object.freeze((window.TB_CONST && window.TB_CONST.ANALYSIS && window.TB_CONST.ANALYSIS.SOURCED_CATEGORY_MAPPING) || {});
  const TB_SOURCED_BUCKET_ORDER = Object.freeze(['Logement', 'Repas', 'Transport', 'Activités']);

  function _el(id){ return document.getElementById(id); }
  function _t(key, vars){
    const fn = window.tbT || ((k) => k);
    return fn(key, vars);
  }
  function _safeNum(v){ const n = Number(v); return Number.isFinite(n) ? n : 0; }
  function _norm(s){ return String(s || '').trim(); }
  function _upper(s){ return _norm(s).toUpperCase(); }
  function _normKey(s){
    const core = window.TBCore?.budgetAnalysisRules;
    if (core?.normalizeAnalysisKey) return core.normalizeAnalysisKey(s);
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
  function _signedPct(current, target){
    const c = _safeNum(current), t = _safeNum(target);
    if (!t) return 0;
    return ((c - t) / t) * 100;
  }
  function _analysisNotificationSummaryFromModel(model){
    if (!model) return null;
    const today = _iso(new Date());
    const addDays = (iso, days) => {
      const d = _parse(iso) || new Date();
      d.setDate(d.getDate() + (Number(days) || 0));
      return _iso(d);
    };
    const pendingRows = Array.isArray(model.unpaidTxDetails) ? model.unpaidTxDetails : [];
    const pendingSum = (mode, maxDate) => pendingRows.reduce((sum, row) => {
      const due = String(row?.cashDate || row?.budgetStart || '').slice(0, 10);
      if (!due) return sum;
      if (mode === 'overdue' && due >= today) return sum;
      if (mode === 'future' && (due < today || due > maxDate)) return sum;
      return sum + _safeNum(row?.visibleAmount);
    }, 0);
    const pendingCount = (mode, maxDate) => pendingRows.reduce((count, row) => {
      const due = String(row?.cashDate || row?.budgetStart || '').slice(0, 10);
      if (!due) return count;
      if (mode === 'overdue') return count + (due < today ? 1 : 0);
      return count + (due >= today && due <= maxDate ? 1 : 0);
    }, 0);
    const deltaBudgetAmount = _safeNum(model.spentToToday) - _safeNum(model.targetToToday);
    const deltaBudgetPct = _signedPct(model.spentToToday, model.targetToToday);
    const deltaReferenceAmount = _safeNum(model.spentToToday) - _safeNum(model.referenceToToday);
    const deltaReferencePct = _signedPct(model.spentToToday, model.referenceToToday);
    const elapsedDays = Math.max(1, _safeNum(model.elapsedDays) || 1);
    const outAmount = _safeNum(model.outAmount);
    const spentToToday = _safeNum(model.spentToToday);
    const remainingToday = (typeof window.getDailyBudgetInfoForDate === 'function')
      ? _safeNum(window.getDailyBudgetInfoForDate(_iso(new Date()))?.remaining)
      : _safeNum(model.remaining);
    return {
      base: model.base,
      remainingToday,
      deltaBudgetAmount,
      deltaBudgetPct,
      deltaReferenceAmount,
      deltaReferencePct,
      spentToToday,
      targetToToday: _safeNum(model.targetToToday),
      referenceToToday: _safeNum(model.referenceToToday),
      projection: _safeNum(model.projection),
      totalBudget: _safeNum(model.totalBudget),
      paceAppPct: _safeNum(model.targetToToday) > 0 ? (spentToToday / _safeNum(model.targetToToday)) * 100 : 0,
      paceReferencePct: _safeNum(model.referenceToToday) > 0 ? (spentToToday / _safeNum(model.referenceToToday)) * 100 : 0,
      avgBudgetPerDay: spentToToday / elapsedDays,
      avgOutPerDay: outAmount / elapsedDays,
      avgAllPerDay: (spentToToday + outAmount) / elapsedDays,
      outAmount,
      excludedPerDay: _safeNum(model.excludedPerDay),
      unmappedPerDay: _safeNum(model.unmappedPerDay),
      comparablePerDay: _safeNum(model.comparablePerDay),
      referencePerDay: _safeNum(model.referencePerDay),
      budgetPerDay: _safeNum(model.budgetPerDay),
      pendingJ1Amount: pendingSum('future', addDays(today, 1)),
      pendingJ1Count: pendingCount('future', addDays(today, 1)),
      pendingJ7Amount: pendingSum('future', addDays(today, 7)),
      pendingJ7Count: pendingCount('future', addDays(today, 7)),
      pendingOverdueAmount: pendingSum('overdue'),
      pendingOverdueCount: pendingCount('overdue'),
      elapsedDays,
      filters: _loadFilters(),
    };
  }
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
  function _travelList(){
    const direct = Array.isArray(state?.travels) ? state.travels.filter(Boolean) : [];
    if (direct.length) return direct;

    const byId = new Map();
    const push = (id, name) => {
      const key = String(id || '').trim();
      if (!key) return;
      if (!byId.has(key)) byId.set(key, { id: key, name: String(name || 'Voyage').trim() || 'Voyage' });
    };

    const activeTravelId = String(state?.activeTravelId || '').trim();
    const activeTravelName = String(state?.travel?.name || state?.travelName || '').trim();
    if (activeTravelId) push(activeTravelId, activeTravelName || 'Voyage actif');

    for (const p of (Array.isArray(state?.periods) ? state.periods : [])) {
      push(p?.travel_id || p?.travelId, p?.travel_name || p?.travelName || p?.name || 'Voyage');
    }
    for (const seg of (Array.isArray(state?.budgetSegments) ? state.budgetSegments : [])) {
      push(seg?.travel_id || seg?.travelId, seg?.travel_name || seg?.travelName || 'Voyage');
    }
    for (const r of [].concat(state?.wallets || [], state?.transactions || [])) push(r?.travel_id || r?.travelId);

    return Array.from(byId.values());
  }
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
    function _analysisCutoffEnd(){
    const { end } = _analysisRange();
    const today = _iso(new Date());

    if (_getSelectedPeriodId() === 'active' && end && today && end > today) {
      return today;
    }
    return end;
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
        currencyMode: _el('analysis-currency')?.value || 'account',
        categoryFilter: _el('analysis-category-filter')?.value || 'all',
        subcategoryFilter: _el('analysis-subcategory-filter')?.value || 'all',
        excludedCats: Array.from(excludedCats)
      }));
    } catch (_) {}
  }

  function _selectedCurrencyMode(){ return _el('analysis-currency')?.value || 'account'; }
  function _excludedCategorySet(){ return new Set(Array.from(excludedCats)); }
  function _selectedCategoryFilter(){ return _el('analysis-category-filter')?.value || 'all'; }
  function _selectedSubcategoryFilter(){ return _el('analysis-subcategory-filter')?.value || 'all'; }
  function _txCategory(tx){ return _norm(tx?.category || (_txType(tx) === 'income' ? 'Revenu' : 'Autre')); }
  function _txSubcategory(tx){ return _norm(tx?.subcategory || ''); }
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
    const segsRaw = _segmentsForTravel(travelId);
    const segs = segsRaw.filter(seg => _isUUID(seg?.id));
    const key = `${travelId}|${segs.map(s => String(s.id)).sort().join(',')}`;

    if (referenceCache.key === key && referenceCache.loaded) return;

    referenceCache.key = key;
    referenceCache.bySegment = {};
    referenceCache.loaded = true;

    const offline = (typeof window.tbShouldUseOfflineMode === "function")
      ? await window.tbShouldUseOfflineMode("analysis-reference")
      : ((typeof window.tbIsOfflineMode === "function" && window.tbIsOfflineMode()) || (navigator && navigator.onLine === false));
    if (offline) return;
    if (!s || !segs.length || !TB_CONST?.RPCS?.budget_reference_resolve_for_budget_segment) return;

    for (const seg of segs) {
      try {
        const segId = String(seg.id);

        const { data, error } = await s.rpc(
          TB_CONST.RPCS.budget_reference_resolve_for_budget_segment,
          { p_budget_segment_id: segId }
        );

        if (error) {
          console.warn('[analysis] reference RPC error', { segId, error });
          referenceCache.bySegment[segId] = null;
          continue;
        }

        referenceCache.bySegment[segId] = Array.isArray(data) ? (data[0] || null) : (data || null);
      } catch (err) {
        if ((typeof window.tbIsOfflineMode === "function" && window.tbIsOfflineMode()) || (navigator && navigator.onLine === false)) {
          referenceCache.bySegment[String(seg?.id || '')] = null;
          continue;
        }
        console.warn('[analysis] reference RPC failed', {
          segId: String(seg?.id || ''),
          err
        });
        referenceCache.bySegment[String(seg?.id || '')] = null;
      }
    }
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
  function _isTripBudgetShare(tx){
    if (!tx) return false;
    if (String(tx?.type || '').toLowerCase() !== 'expense') return false;
    const payNow = (tx?.payNow ?? tx?.pay_now);
    const isPaid = (payNow === undefined) ? true : !!payNow;
    if (isPaid) return false;
    const affectsBudget = (tx?.affectsBudget ?? tx?.affects_budget);
    if (affectsBudget === false) return false;
    const outOfBudget = !!(tx?.outOfBudget ?? tx?.out_of_budget);
    if (outOfBudget) return false;
    const tripShareLinkId = tx?.trip_share_link_id || tx?.tripShareLinkId || null;
    if (tripShareLinkId) return true;
    return /^\[trip\]/i.test(String(tx?.label || '').trim());
  }
  function _isTripAnalyticRealExpense(tx){
  const label = String(tx?.label || '').trim();
  if (!/^\[trip\]/i.test(label)) return false;
  if (_txType(tx) !== 'expense') return false;
  if (_txOut(tx)) return false;
  return true;
  }
  function _isInternalMovement(tx){ return String(tx?.category || '').trim().toLowerCase() === 'mouvement interne'; }
  function _isInternalTransferLinked(tx){ return !!(tx?.internal_transfer_id || tx?.internalTransferId); }
  function _isAnalysisInternalMovement(tx) {
    if (_isTripBudgetShare(tx)) return false;
    if (_isInternalTransferLinked(tx)) return true;
    if (tx?.is_internal === true || tx?.isInternal === true) return true;
    return typeof window.tbIsInternalMovement === 'function' ? window.tbIsInternalMovement(tx) : _isInternalMovement(tx);
  }
  function _txCashDate(tx){
    if (typeof window.tbTxCashDate === 'function') return window.tbTxCashDate(tx);
    return _norm(tx?.dateStart || tx?.date_start || tx?.occurrence_date || tx?.date || tx?.created_at?.slice?.(0,10) || tx?.createdAt?.slice?.(0,10));
  }
  function _txBudgetStart(tx){
    if (typeof window.tbTxBudgetStart === 'function') return window.tbTxBudgetStart(tx);
    return _norm(tx?.budgetDateStart || tx?.budget_date_start || tx?.dateStart || tx?.date_start || tx?.occurrence_date || tx?.date || tx?.created_at?.slice?.(0,10) || tx?.createdAt?.slice?.(0,10));
  }
  function _txBudgetEnd(tx){
    if (typeof window.tbTxBudgetEnd === 'function') return window.tbTxBudgetEnd(tx);
    return _norm(tx?.budgetDateEnd || tx?.budget_date_end || tx?.dateEnd || tx?.date_end || _txBudgetStart(tx));
  }
  function _txType(tx){ return String(tx?.type || '').toLowerCase(); }
  function _txPaid(tx){
    if (typeof tx?.payNow === 'boolean') return tx.payNow;
    if (typeof tx?.pay_now === 'boolean') return tx.pay_now;
    return !!tx?.payNow || !!tx?.pay_now;
  }
  function _txAnalysisPaid(tx){
    return _txPaid(tx) || _isTripAnalyticRealExpense(tx);
  }
  function _txOut(tx){
    if (typeof tx?.outOfBudget === 'boolean') return tx.outOfBudget;
    if (typeof tx?.out_of_budget === 'boolean') return tx.out_of_budget;
    return !!tx?.outOfBudget || !!tx?.out_of_budget;
  }
  function _txAffectsAnalysisDataset(tx){
    const core = window.TBCore?.budgetAnalysisRules;
    if (core?.affectsBudgetAnalysisDataset) return !!core.affectsBudgetAnalysisDataset(tx);
    if (!tx || typeof tx !== 'object') return false;
    const flag = tx.affectsBudget ?? tx.affects_budget;
    if (flag === false) return false;
    return _txType(tx) === 'expense';
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
  const core = window.TBCore?.budgetAnalysisRules;
  if (core?.normalizeAnalysisKey) return core.normalizeAnalysisKey(s);
  return String(s || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

function _sqlAnalyticFamilyToBucket(family) {
  const core = window.TBCore?.budgetAnalysisRules;
  if (core?.sqlAnalyticFamilyToBucket) return core.sqlAnalyticFamilyToBucket(family);
  const f = _normKey(family);
  if (f === 'accommodation') return 'Logement';
  if (f === 'food') return 'Repas';
  if (f === 'transport') return 'Transport';
  if (f === 'activities') return 'Activités';
  return null;
}

function _mapToSourcedBucket(categoryName, tx) {
  const core = window.TBCore?.budgetAnalysisRules;
  if (core?.mapToSourcedBucket) {
    return core.mapToSourcedBucket({
      categoryName,
      tx,
      mappingByTxId: state?.analysisMappingByTxId || {},
      fallbackMapping: TB_SOURCED_CATEGORY_MAPPING,
    });
  }
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
  const core = window.TBCore?.budgetAnalysisRules;
  if (core?.analysisBucketOrder) {
    return core.analysisBucketOrder({
      fallbackMapping: TB_SOURCED_CATEGORY_MAPPING,
      baseOrder: TB_SOURCED_BUCKET_ORDER,
    });
  }
  const dynamic = Object.values(TB_SOURCED_CATEGORY_MAPPING || {})
    .filter((meta) => String(meta?.compare_mode || meta?.mode || '').trim().toLowerCase() === 'mapped' && String(meta?.sourced_bucket || meta?.bucket || '').trim())
    .map((meta) => String(meta.sourced_bucket || meta.bucket || '').trim());
  return Array.from(new Set([...TB_SOURCED_BUCKET_ORDER, ...dynamic]));
}
  function _analysisTransactions(){
    const base = Array.isArray(state?.transactions) ? state.transactions : [];
    try {
      const range = _analysisRange();
      const virtualRows = window.tbAssetBudgetTransactionsForRange?.(range.start, range.end) || [];
      return virtualRows.length ? base.concat(virtualRows) : base;
    } catch (_) { return base; }
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
    add('Revenu');
    try { if (typeof getCategories === 'function') (getCategories() || []).forEach(add); } catch (_) {}
    (Array.isArray(state?.categories) ? state.categories : []).forEach(add);
    _analysisTransactions().forEach(tx => {
      if (_isTripLinked(tx) && !_isTripBudgetShare(tx)) return;
      if (_txType(tx) === 'income') add('Revenu');
      else if (_txType(tx) === 'expense' && _txAffectsAnalysisDataset(tx)) add(tx?.category);
    });
    return out.sort((a,b) => a.localeCompare(b, 'fr', { sensitivity:'base' }));
  }
  function _allAnalysisSubcategories(){
    const catFilter = _selectedCategoryFilter();
    const out = [];
    const seen = new Set();
    const add = (v) => {
      const raw = String(v || '').trim();
      if (!raw) return;
      const k = _normKey(raw);
      if (seen.has(k)) return;
      seen.add(k);
      out.push(raw);
    };
    _analysisTransactions().forEach(tx => {
      if (_isTripLinked(tx) && !_isTripBudgetShare(tx)) return;
      const type = _txType(tx);
      if (type !== 'expense' && type !== 'income') return;
      if (type === 'expense' && !_txAffectsAnalysisDataset(tx)) return;
      if (catFilter === '__income' && type !== 'income') return;
      if (catFilter !== 'all' && catFilter !== '__income' && _norm(tx?.category || 'Autre') !== catFilter) return;
      add(tx?.subcategory);
    });
    return out.sort((a,b) => a.localeCompare(b, 'fr', { sensitivity:'base' }));
  }
  function _renderAnalysisFilterSelects(){
    const catSel = _el('analysis-category-filter');
    const subSel = _el('analysis-subcategory-filter');
    const analysisFilterView = window.TBAnalysisFilterView;
    if (catSel) {
      const current = catSel.value || 'all';
      const cats = _allAnalysisCategories();
      catSel.innerHTML = analysisFilterView?.renderCategoryFilterOptions?.({
        categories: cats,
        t: _t,
        normalizeKey: _normKey,
      }) || '';
      catSel.value = [...catSel.options].some(o => o.value === current) ? current : 'all';
    }
    if (subSel) {
      const current = subSel.value || 'all';
      const subs = _allAnalysisSubcategories();
      subSel.innerHTML = analysisFilterView?.renderSubcategoryFilterOptions?.({
        subcategories: subs,
        t: _t,
      }) || '';
      subSel.value = [...subSel.options].some(o => o.value === current) ? current : 'all';
    }
  }
  function _updateCategoryExcludeSummary(){
    const summary = _el('analysis-category-summary');
    const badge = _el('analysis-category-count');
    const toggle = _el('analysis-category-toggle');
    const total = _allAnalysisCategories().length;
    const count = excludedCats.size;
    if (summary) {
      summary.textContent = window.TBAnalysisFilterView?.buildCategoryExcludeSummary?.({ total, count }) || '';
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
    host.innerHTML = window.TBAnalysisFilterView?.renderCategoryExcludeChips?.({
      categories,
      excluded: Array.from(excludedCats),
    }) || '';
    host.querySelectorAll('[data-cat]').forEach(btn => {
      const color = _categoryColor(btn.getAttribute('data-cat'));
      try {
        btn.style.setProperty('--c', color);
        btn.style.borderColor = `${color}44`;
        btn.style.background = `${color}22`;
        const dot = btn.querySelector('.analysis-chip-dot');
        if (dot) dot.style.background = color;
      } catch (_) {}
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

  const seg = (typeof getBudgetSegmentForDate === 'function')
    ? getBudgetSegmentForDate(dateISO)
    : null;

  try {
    if (typeof window.amountToBudgetBaseForDate === 'function' && seg) {
      const inSegBase = window.amountToBudgetBaseForDate(a, from, dateISO);
      const segBase = _upper(seg.baseCurrency || seg.base_currency || state?.period?.baseCurrency || 'EUR');

      if (segBase === base) return _safeNum(inSegBase);

      if (typeof window.tbFxConvertForDateCached === 'function') {
        const out = window.tbFxConvertForDateCached(inSegBase, segBase, base, dateISO);
        if (out !== null && Number.isFinite(Number(out))) return Number(out);
      }
    }
  } catch (_) {}

  try {
    if (typeof window.tbFxConvertForDateCached === 'function') {
      const out = window.tbFxConvertForDateCached(a, from, base, dateISO);
      if (out !== null && Number.isFinite(Number(out))) return Number(out);
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
    return _analysisTransactions().filter(tx => {
      const txTravelId = String(tx?.travel_id || tx?.travelId || '');
      if (travelId && txTravelId && txTravelId !== String(travelId)) return false;
      if (_txType(tx) !== 'expense') return false;
      if (!_txAffectsAnalysisDataset(tx)) return false;
      if (_isAnalysisInternalMovement(tx)) return false;
      const bs = _txBudgetStart(tx);
      const be = _txBudgetEnd(tx);
      if (!bs || !be) return false;
      if (start && be < start) return false;
      if (end && bs > end) return false;
      return true;
    });
  }
  function _baseIncomeTransactions(){
  const travelId = _getSelectedTravelId();
  const { start, end } = _analysisRange();

  return (Array.isArray(state?.transactions) ? state.transactions : []).filter(tx => {
    const txTravelId = String(tx?.travel_id || tx?.travelId || '');
    if (travelId && txTravelId && txTravelId !== String(travelId)) return false;

    if (_txType(tx) !== 'income') return false;

    const bs = _txBudgetStart(tx);
    const be = _txBudgetEnd(tx);
    if (!bs || !be) return false;

    if (start && be < start) return false;
    if (end && bs > end) return false;

    return true;
  });
}
function _incomeSplit(txs){
  const real = [];
  const planned = [];

  txs.forEach(tx => {
    if (_txPaid(tx)) real.push(tx);
    else planned.push(tx);
  });

  return { real, planned };
}
function _sumTxArray(txs, base){
  return txs.reduce((sum, tx) => {
    const cashDate = _txCashDate(tx);
    return sum + _convert(tx.amount, tx.currency || base, cashDate, base);
  }, 0);
}
  function _filteredIncomeTransactions(){
  const scope = _el('analysis-scope')?.value || 'budget';
  const mode = _el('analysis-mode')?.value || 'planned';
  const excluded = _excludedCategorySet();
  const catFilter = _selectedCategoryFilter();
  const subFilter = _selectedSubcategoryFilter();

  return _baseIncomeTransactions().filter(tx => {
    const cat = _txCategory(tx);
    const catKey = _normKey(cat);
    const sub = _txSubcategory(tx);

    if (scope === 'budget' && _txOut(tx)) return false;
    if (scope === 'out' && !_txOut(tx)) return false;
    if (mode === 'expenses' && !_txPaid(tx)) return false;
    if (catFilter && catFilter !== 'all' && catFilter !== '__income' && cat !== catFilter) return false;
    if (subFilter === '__none__' && sub) return false;
    if (subFilter && subFilter !== 'all' && subFilter !== '__none__' && sub !== subFilter) return false;
    if (excluded.size && excluded.has(cat)) return false;

    if (_isAnalysisInternalMovement(tx)) return false;
    if (catKey === 'mouvement interne') return false;
    if (catKey === 'ajustement wallet') return false;

    return true;
  });
}
  function _filteredTransactions(){
    const scope = _el('analysis-scope')?.value || 'budget';
    const mode = _el('analysis-mode')?.value || 'planned';
    const excluded = _excludedCategorySet();
    const catFilter = _selectedCategoryFilter();
    const subFilter = _selectedSubcategoryFilter();
    return _baseExpenseTransactions().filter(tx => {
      const cat = _txCategory(tx);
      const sub = _txSubcategory(tx);
      if (scope === 'budget' && _txOut(tx)) return false;
      if (scope === 'out' && !_txOut(tx)) return false;
      if (mode === 'expenses' && !_txAnalysisPaid(tx)) return false;
      if (catFilter === '__income') return false;
      if (catFilter && catFilter !== 'all' && cat !== catFilter) return false;
      if (subFilter === '__none__' && sub) return false;
      if (subFilter && subFilter !== 'all' && subFilter !== '__none__' && sub !== subFilter) return false;
      if (excluded.size && excluded.has(cat)) return false;
      return true;
    });
  }
  function _autoBroadenEmptyAnalysis(){
    const id = String(_getSelectedTravelId() || '');
    const any = _analysisTransactions().some(tx => {
      const tid = String(tx?.travel_id || tx?.travelId || ''), type = _txType(tx);
      return (!id || !tid || tid === id) && ['expense','income'].includes(type) && (type !== 'expense' || (_txAffectsAnalysisDataset(tx) && !_isAnalysisInternalMovement(tx))) && _txBudgetStart(tx) && _txBudgetEnd(tx);
    });
    if (_filteredTransactions().length || _filteredIncomeTransactions().length || !any) return false;
    let changed = false;
    for (const [id, val] of [['analysis-period','all'],['analysis-scope','all'],['analysis-mode','planned'],['analysis-category-filter','all'],['analysis-subcategory-filter','all']]) {
      const el = _el(id);
      if (el && el.value !== val && [...el.options].some(o => o.value === val)) { el.value = val; changed = true; }
    }
    if (excludedCats.size) { excludedCats.clear(); changed = true; _renderCategoryExcludeChips([]); }
    if (changed) _toggleRangeBox();
    return changed;
  }
  function _outBudgetTransactions(){
    const mode = _el('analysis-mode')?.value || 'planned';
    const excluded = _excludedCategorySet();
    const catFilter = _selectedCategoryFilter();
    const subFilter = _selectedSubcategoryFilter();
    return _baseExpenseTransactions().filter(tx => {
      const cat = _txCategory(tx);
      const sub = _txSubcategory(tx);
      if (!_txOut(tx)) return false;
      if (mode === 'expenses' && !_txAnalysisPaid(tx)) return false;
      if (catFilter === '__income') return false;
      if (catFilter && catFilter !== 'all' && cat !== catFilter) return false;
      if (subFilter === '__none__' && sub) return false;
      if (subFilter && subFilter !== 'all' && subFilter !== '__none__' && sub !== subFilter) return false;
      if (excluded.size && excluded.has(cat)) return false;
      return true;
    });
  }

  function _computeModel(){
    const txs = _filteredTransactions();
    const { start, end } = _analysisRange();
    const cutoffEnd = _analysisCutoffEnd();
    const base = _resolveAnalysisCurrency(start, end);
    const incomeTxs = _filteredIncomeTransactions();
    const { real: incomeReal, planned: incomePlanned } = _incomeSplit(incomeTxs);

    const incomeRealAmount = _sumTxArray(incomeReal, base);
    const incomePlannedAmount = _sumTxArray(incomePlanned, base);
    const days = _daysInclusive(start, end);
    const daySet = new Set(days);
    const dailyMap = Object.fromEntries(days.map(d => [d, 0]));
    const paidMap = Object.fromEntries(days.map(d => [d, 0]));
    const catMap = new Map();
    const subcatMap = new Map();
    const categoryTxMap = new Map();
    const subcategoryTxMap = new Map();
    const unpaidTxDetails = [];
    let spent = 0;
    let paidSpent = 0;

    function _txAmountInVisibleWindow(tx){
      const cashDate = _txCashDate(tx);
      const budgetStart = _txBudgetStart(tx);
      const budgetEnd = _txBudgetEnd(tx);

      const fullBudgetDays = _daysInclusive(budgetStart, budgetEnd);

if (!fullBudgetDays.length) {
  return { amount: 0, fullBudgetDays: [], visibleBudgetDays: [], perDay: 0, cashDate, budgetStart, budgetEnd };
}

const visibleBudgetDays = fullBudgetDays
  .filter(d => daySet.has(d))
  .filter(d => !cutoffEnd || d <= cutoffEnd);

      if (!visibleBudgetDays.length) {
        return { amount: 0, fullBudgetDays, visibleBudgetDays: [], perDay: 0, cashDate, budgetStart, budgetEnd };
      }

      const fullAmount = _convert(tx?.amount, tx?.currency || base, cashDate || budgetStart, base);
      const perDay = fullAmount / fullBudgetDays.length;
      const visibleAmount = perDay * visibleBudgetDays.length;

      return {
        amount: visibleAmount,
        fullBudgetDays,
        visibleBudgetDays,
        perDay,
        cashDate,
        budgetStart,
        budgetEnd
      };
    }

    for (const tx of txs) {
      const alloc = _txAmountInVisibleWindow(tx);
      if (!alloc.visibleBudgetDays.length) continue;

      spent += alloc.amount;
      if (_txAnalysisPaid(tx)) paidSpent += alloc.amount;

      for (const d of alloc.visibleBudgetDays) {
        dailyMap[d] = _safeNum(dailyMap[d]) + alloc.perDay;
        if (_txAnalysisPaid(tx)) paidMap[d] = _safeNum(paidMap[d]) + alloc.perDay;
      }

      const cat = _txCategory(tx);
const sub = _txSubcategory(tx);

const txDetail = {
  tx,
  visibleAmount: alloc.amount,
  perDay: alloc.perDay,
  visibleBudgetDays: alloc.visibleBudgetDays,
  fullBudgetDays: alloc.fullBudgetDays,
  cashDate: alloc.cashDate,
  budgetStart: alloc.budgetStart,
  budgetEnd: alloc.budgetEnd
};

if (!_txAnalysisPaid(tx)) {
  unpaidTxDetails.push(txDetail);
}

catMap.set(cat, (catMap.get(cat) || 0) + alloc.amount);

if (!categoryTxMap.has(cat)) categoryTxMap.set(cat, []);
categoryTxMap.get(cat).push(txDetail);

if (sub) {
  const key = `${cat}|||${sub}`;
  subcatMap.set(key, (subcatMap.get(key) || 0) + alloc.amount);

  if (!subcategoryTxMap.has(key)) subcategoryTxMap.set(key, []);
  subcategoryTxMap.get(key).push(txDetail);
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
    const comparableDaySet = coveredDaySet.size
      ? new Set(days.filter((d) => d <= effectiveEnd && coveredDaySet.has(d)))
      : new Set(days.filter((d) => d <= effectiveEnd));
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
        .filter((d) => comparableDaySet.has(d));

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
    const outAmount = _outBudgetTransactions().reduce((sum, tx) => {
      const budgetStart = _txBudgetStart(tx);
      const budgetEnd = _txBudgetEnd(tx);
      const cashDate = _txCashDate(tx);

      const fullBudgetDays = _daysInclusive(budgetStart, budgetEnd);

if (!fullBudgetDays.length) return sum;

const visibleBudgetDays = fullBudgetDays
  .filter(d => daySet.has(d))
  .filter(d => !cutoffEnd || d <= cutoffEnd);

      if (!visibleBudgetDays.length) return sum;

      const fullAmount = _convert(tx?.amount, tx?.currency || base, cashDate || budgetStart, base);
      const perDay = fullAmount / fullBudgetDays.length;
      return sum + (perDay * visibleBudgetDays.length);
    }, 0);
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

const cashflowScope = _el('analysis-scope')?.value || 'budget';
const cashflowMode = _el('analysis-mode')?.value || 'planned';

const todayIdx = days.indexOf(todayIso);
const todayBudget = todayIdx >= 0 ? _safeNum(targetDaily[todayIdx]) : 0;

const todayBudgetConsumed = todayIdx >= 0
  ? txs.reduce((sum, tx) => {
      if (cashflowMode === 'expenses' && !_txAnalysisPaid(tx)) return sum;

      const budgetStart = _txBudgetStart(tx);
      const budgetEnd = _txBudgetEnd(tx);
      if (!budgetStart || !budgetEnd) return sum;
      if (todayIso < budgetStart || todayIso > budgetEnd) return sum;

      const cashDate = _txCashDate(tx);

      const fullBudgetDays = _daysInclusive(budgetStart, budgetEnd);

      if (!fullBudgetDays.length) return sum;

      const fullAmount = _convert(tx?.amount, tx?.currency || base, cashDate || budgetStart, base);
      const perDay = fullAmount / fullBudgetDays.length;

      return sum + perDay;
    }, 0)
  : 0;

const futureBudget = days.reduce((sum, d, idx) => {
  if (d > todayIso) return sum + _safeNum(targetDaily[idx]);
  return sum;
}, 0);

const budgetRemaining = cashflowScope === 'out'
  ? 0
  : futureBudget + Math.max(0, todayBudget - todayBudgetConsumed);

const expenseUnpaid = Math.max(0, spent - paidSpent);
const expenseRemaining = expenseUnpaid;

const deltaProjectedWithBudget =
  (incomeRealAmount - paidSpent) +
  incomePlannedAmount -
  expenseRemaining -
  budgetRemaining;

const cashIncomeByCategory = new Map();
const cashExpenseByCategory = new Map();
incomeReal.forEach(tx => {
  const key = _txCategory(tx) || 'Revenu';
  cashIncomeByCategory.set(key, (cashIncomeByCategory.get(key) || 0) + _convert(tx?.amount, tx?.currency || base, _txCashDate(tx), base));
});
txs.forEach(tx => {
  if (!_txAnalysisPaid(tx)) return;
  const key = _txCategory(tx);
  cashExpenseByCategory.set(key, (cashExpenseByCategory.get(key) || 0) + _convert(tx?.amount, tx?.currency || base, _txCashDate(tx), base));
});
const cashIncomeCategories = [...cashIncomeByCategory.entries()].sort((a,b)=>b[1]-a[1]).slice(0, 5);
const cashExpenseCategories = [...cashExpenseByCategory.entries()].sort((a,b)=>b[1]-a[1]).slice(0, 5);

return {
  base, start, end, days, txs, spent, paidSpent,

  incomeReal: incomeRealAmount,
  incomeToDate: incomeRealAmount,
  incomePlanned: incomePlannedAmount,
  expenseReal: paidSpent,
expenseToDate: spentToToday,
budgetRemaining,

expensePlanned: expenseRemaining,

deltaReal: incomeRealAmount - paidSpent,
deltaPlanned: -expenseRemaining,
deltaProjected: (incomeRealAmount - paidSpent) + incomePlannedAmount - expenseRemaining,
deltaProjectedWithBudget,
  totalBudget, totalReference, totalReferenceElapsed, totalReferencePeriod,
  remaining, pct, referencePct, avgPerDay, budgetPerDay, referencePerDay,
  referenceMiscPerDay, comparablePerDay, unmappedPerDay, excludedPerDay,
  projection, cumSpent, cumTarget, cumReference, velocity, heat,
  topCategories, categorySeries, subcategorySeries, referenceCategorySeries,
  referenceComparisonSeries, unmappedCategorySeries, outAmount,
  spentToToday, targetToToday, referenceToToday, referenceGap,
  referenceCoverageDays, referenceContext, comparableDays,
  elapsedDays, periodDays,
  comparableIncludedSpent, comparableExcludedSpent, unmappedComparableSpent,
  nightCoveredCount, nightCoveredPotentialSavings, nightCoveredAverageSaving,
  nightCoveredTransportSpent, nightCoveredShareOfSpent, nightCoveredRows,
categoryTxMap, subcategoryTxMap
  , cashIncomeCategories, cashExpenseCategories,
  unpaidTxDetails: unpaidTxDetails
    .slice()
    .sort((a,b) => String(a?.budgetStart || a?.cashDate || '').localeCompare(String(b?.budgetStart || b?.cashDate || '')))
};
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


  function _renderOverviewStrip(model){
    const host = _el('analysis-overview-strip');
    if (!host) return;
    const travel = _getSelectedTravel();
    const periodId = _getSelectedPeriodId();
    const scope = _el('analysis-scope')?.value || 'budget';
    const mode = _el('analysis-mode')?.value || 'planned';
    const currencyMode = _el('analysis-currency')?.value || 'account';
    host.innerHTML = window.TBAnalysisView?.renderAnalysisOverviewStrip?.({
      model,
      travel,
      periodId,
      scope,
      mode,
      currencyMode,
      t: _t,
    }) || '';
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
    const deltaBudgetPct = signedPct(model.spentToToday, model.targetToToday);
    const deltaReferencePct = signedPct(model.spentToToday, model.totalReferenceElapsed);
    const deltaBudgetTone = deltaBudgetPct > 0 ? _themeBad() : (deltaBudgetPct < 0 ? _themeGood() : _themeMuted());
    const deltaReferenceTone = deltaReferencePct > 0 ? _themeBad() : (deltaReferencePct < 0 ? _themeGood() : _themeMuted());
    const deltaBudgetAmount = _safeNum(model.spentToToday) - _safeNum(model.targetToToday);
    const deltaReferenceAmount = _safeNum(model.spentToToday) - _safeNum(model.totalReferenceElapsed);
    const isEn = typeof window.tbGetLang === 'function' && window.tbGetLang() === 'en';
    const trA = (fr, en) => isEn ? en : fr;
    const dayWord = trA('jours', 'days');

    const progressCards = [
      {
        label: trA('Rythme budget app', 'App budget pace'),
        title: trA('Part du budget app déjà ouverte à date dans la période analysée', 'Share of app budget already opened to date in the analyzed period'),
        value: ratioText(model.targetToToday, model.totalBudget),
        hint: trA('Budget prévu à date comparé au budget total.', 'Planned budget to date compared with the total budget.'),
        pct: model.totalBudget > 0 ? clampPct((model.targetToToday / model.totalBudget) * 100) : 0,
        footer: trA(`Cible de dépense sur ${model.days.length} jours analysés`, `Spending target over ${model.days.length} analyzed ${dayWord}`),
        tint:'rose',
        liquid:'linear-gradient(180deg, rgba(251,113,133,.34) 0%, rgba(244,114,182,.46) 34%, rgba(236,72,153,.54) 70%, rgba(219,39,119,.66) 100%)',
        liquidAlt:'linear-gradient(180deg, rgba(255,255,255,.00) 0%, rgba(255,255,255,.18) 22%, rgba(255,255,255,.00) 55%, rgba(255,255,255,.12) 100%)',
        glow:'rgba(244,114,182,.22)',
        shell:'rgba(251,207,232,.72)',
        haze:'linear-gradient(180deg, rgba(255,255,255,.82), rgba(255,255,255,.42))'
      },
      {
        label: trA('Rythme référence pays', 'Country reference pace'),
        title: trA('Part de la référence pays déjà consommée à date sur la période analysée', 'Share of the country reference already consumed to date in the analyzed period'),
        value: ratioText(model.totalReferenceElapsed, model.totalReferencePeriod),
        hint: trA('Référence à date comparée à la référence totale.', 'Reference to date compared with the total reference.'),
        pct: model.totalReferencePeriod > 0 ? clampPct((model.totalReferenceElapsed / model.totalReferencePeriod) * 100) : 0,
        footer: trA('Repère externe basé sur les jours déjà écoulés', 'External benchmark based on elapsed days'),
        tint:'green',
        liquid:'linear-gradient(180deg, rgba(110,231,183,.30) 0%, rgba(74,222,128,.44) 34%, rgba(34,197,94,.52) 70%, rgba(22,163,74,.62) 100%)',
        liquidAlt:'linear-gradient(180deg, rgba(255,255,255,.00) 0%, rgba(255,255,255,.20) 24%, rgba(255,255,255,.00) 58%, rgba(255,255,255,.10) 100%)',
        glow:'rgba(74,222,128,.20)',
        shell:'rgba(187,247,208,.78)',
        haze:'linear-gradient(180deg, rgba(255,255,255,.82), rgba(236,253,245,.40))'
      },
      {
        label: trA('Budget consommé vs projection', 'Budget used vs projection'),
        title: trA('Part du budget alloué à la période déjà consommée dans la projection', 'Share of period-allocated budget already consumed in the projection'),
        value: ratioText(model.spentToToday, model.projection),
        hint: trA('Budget ventilé sur les dates analysées comparé à la projection finale.', 'Budget allocated over analyzed dates compared with the final projection.'),
        pct: model.projection > 0 ? clampPct((model.spentToToday / model.projection) * 100) : 0,
        footer: model.projection > model.totalBudget ? trA('Tendance finale au-dessus du budget app', 'Final trend above app budget') : trA('Tendance finale contenue dans le budget app', 'Final trend within app budget'),
        tint:'blue',
        liquid:'linear-gradient(180deg, rgba(147,197,253,.30) 0%, rgba(125,211,252,.42) 34%, rgba(56,189,248,.52) 70%, rgba(14,165,233,.62) 100%)',
        liquidAlt:'linear-gradient(180deg, rgba(255,255,255,.00) 0%, rgba(255,255,255,.22) 24%, rgba(255,255,255,.00) 60%, rgba(255,255,255,.10) 100%)',
        glow:'rgba(56,189,248,.20)',
        shell:'rgba(186,230,253,.76)',
        haze:'linear-gradient(180deg, rgba(255,255,255,.84), rgba(239,246,255,.40))'
      }
    ];

    const progressView = window.TBAnalysisView;

    host.style.display = 'grid';
    host.style.gridTemplateColumns = 'repeat(auto-fit, minmax(250px, 1fr))';
    host.style.gap = '16px';
    host.style.alignItems = 'stretch';

    const cashflowBlock = progressView?.renderAnalysisCashflowBlock?.({
      model,
      formatCurrency: _fmtMoney,
      isEn,
    }) || '';
    const cashOnlyBlock = progressView?.renderAnalysisCashOnlyBlock?.({
      model,
      formatCurrency: _fmtMoney,
      isEn,
    }) || '';

    const unpaidBlock = progressView?.renderAnalysisUnpaidBlock?.({
      model,
      formatCurrency: _fmtMoney,
      isEn,
      categoryLabel: _txCategory,
      subcategoryLabel: _txSubcategory,
      tripLabel: _entryTripLabel,
    }) || '';

host.innerHTML = progressView?.renderAnalysisProgressPanels?.({
  progressCards,
  delta: {
    deltaBudgetTone,
    deltaBudgetPct,
    deltaBudgetAmount,
    deltaReferenceTone,
    deltaReferencePct,
    deltaReferenceAmount,
  },
  cashflowBlock,
  unpaidBlock,
  cashOnlyBlock,
  formatCurrency: _fmtMoney,
  currency: model.base,
  isEn,
}) || '';
  }
  function _txDrilldownId(tx, idx){
  return String(tx?.id || tx?.transaction_id || tx?.local_id || `${_txBudgetStart(tx)}|${tx?.label || ''}|${tx?.amount || ''}|${idx || 0}`);
}

function _entryTripLabel(tx){
  return (_isTripLinked(tx) || /^\[trip\]/i.test(String(tx?.label || '').trim())) ? 'Trip' : 'Standard';
}

function _entryBudgetLabel(tx){
  return _txOut(tx) ? 'Hors budget' : 'Budget';
}

function _entryPaidLabel(tx){
  if (_txPaid(tx)) return 'Payé';
  if (_isTripAnalyticRealExpense(tx)) return 'Part Trip réelle';
  return 'À payer';
}

function _ensureTxDrilldownStyles(){
  if (document.getElementById('tb-analysis-tx-drilldown-style')) return;

  const style = document.createElement('style');
  style.id = 'tb-analysis-tx-drilldown-style';
  style.textContent = window.TBAnalysisDrilldownView?.getTransactionDrilldownStyles?.() || '';
  document.head.appendChild(style);
}

function _openTxDrilldown(kind, key, model){
  _ensureTxDrilldownStyles();

  const sourceModel = model || lastAnalysisModel || {};
  const isSub = kind === 'subcategory';
  const map = isSub ? sourceModel.subcategoryTxMap : sourceModel.categoryTxMap;
  const entries = map instanceof Map ? (map.get(key) || []) : [];
  const base = sourceModel.base || _currency();

  const title = window.TBAnalysisDrilldownView?.buildTransactionDrilldownTitle?.(kind, key)
    || String(key || 'Catégorie');

  const total = entries.reduce((sum, row) => sum + _safeNum(row?.visibleAmount), 0);
  const sorted = entries.slice().sort((a,b) =>
    String(a?.budgetStart || a?.cashDate || '').localeCompare(String(b?.budgetStart || b?.cashDate || ''))
  );

  let overlay = document.getElementById('tb-analysis-tx-drilldown');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'tb-analysis-tx-drilldown';
    overlay.className = 'tb-analysis-tx-overlay';
    document.body.appendChild(overlay);
  }

  const rows = sorted.map((row, idx) => {
    const tx = row.tx || {};
    const budgetRange = row.budgetStart && row.budgetEnd && row.budgetStart !== row.budgetEnd
      ? `${row.budgetStart} → ${row.budgetEnd}`
      : (row.budgetStart || '—');
    const visibleRange = Array.isArray(row.visibleBudgetDays) && row.visibleBudgetDays.length
      ? (row.visibleBudgetDays.length === 1
        ? row.visibleBudgetDays[0]
        : `${row.visibleBudgetDays[0]} → ${row.visibleBudgetDays[row.visibleBudgetDays.length - 1]}`)
      : '—';
    return {
      id: _txDrilldownId(tx, idx),
      label: tx.label || tx.category || 'Transaction',
      budgetRange,
      visibleRange,
      cashDate: row.cashDate || _txCashDate(tx) || '—',
      paidLabel: _entryPaidLabel(tx),
      budgetLabel: _entryBudgetLabel(tx),
      tripLabel: _entryTripLabel(tx),
      visibleAmount: _fmtMoney(row.visibleAmount, base),
      originalAmount: `${_safeNum(tx.amount).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} ${_upper(tx.currency || base)}`,
    };
  });

  overlay.innerHTML = window.TBAnalysisDrilldownView?.renderTransactionDrilldown?.({
    title,
    rows,
    total: _fmtMoney(total, base),
    start: sourceModel.start,
    end: sourceModel.end,
  }) || '';

  const close = () => { overlay.remove(); };
  overlay.querySelector('[data-close]')?.addEventListener('click', close);
  overlay.addEventListener('click', (ev) => { if (ev.target === overlay) close(); });

  const onKey = (ev) => {
    if (ev.key === 'Escape') {
      close();
      window.removeEventListener('keydown', onKey);
    }
  };
  window.addEventListener('keydown', onKey);
}
  function _themeText(){ return getComputedStyle(document.body).getPropertyValue('--text').trim() || '#e5e7eb'; }
  function _themeMuted(){ return getComputedStyle(document.body).getPropertyValue('--muted').trim() || '#94a3b8'; }
  function _themeGrid(){ return getComputedStyle(document.body).getPropertyValue('--gridline').trim() || 'rgba(148,163,184,.18)'; }
  function _themeAccent(){ return getComputedStyle(document.body).getPropertyValue('--accent').trim() || '#3b82f6'; }
  function _themeGood(){ return getComputedStyle(document.body).getPropertyValue('--good').trim() || '#22c55e'; }
  function _themeWarn(){ return getComputedStyle(document.body).getPropertyValue('--warn').trim() || '#f59e0b'; }
  function _themeBad(){ return getComputedStyle(document.body).getPropertyValue('--bad').trim() || '#ef4444'; }
  function _analysisChartTheme(){
    return {
      text: _themeText(),
      muted: _themeMuted(),
      grid: _themeGrid(),
      accent: _themeAccent(),
      good: _themeGood(),
      warn: _themeWarn(),
      bad: _themeBad(),
    };
  }
  function _ensureChart(name, id){
    const el = _el(id);
    if (!el || !window.echarts) return null;
    if (!charts[name] || charts[name].isDisposed()) charts[name] = window.echarts.init(el, null, { renderer:'canvas' });
    return charts[name];
  }
  function _renderTrajectory(model){
    const chart = _ensureChart('trajectory','analysis-trajectory-chart');
    if (!chart) return;
    chart.setOption(window.TBAnalysisCharts?.buildAnalysisTrajectoryOption?.({
      model,
      todayLabel: _iso(new Date()).slice(5),
      theme: _analysisChartTheme(),
      formatCurrency: _fmtMoney,
    }) || {});
    const meta = _el('analysis-trajectory-meta');
    if (meta) {
      const detail = window.TBAnalysisCharts?.buildAnalysisTrajectoryMeta?.(model) || {};
      meta.innerHTML = `<div style="display:flex;flex-wrap:wrap;gap:.6rem 1rem;align-items:center;">
        <span>${escapeHTML(detail.start || '—')} → ${escapeHTML(detail.end || '—')}</span>
        <span>${escapeHTML((detail.days || 0) + ' jours')}</span>
        <span>${escapeHTML(detail.currency || model.base || '')}</span>
      </div>`;
      meta.style.marginTop = '.65rem';
    }
  }
  function _renderCategory(model){
  const chart = _ensureChart('category','analysis-category-chart');
  if (!chart) return;

  chart.setOption(window.TBAnalysisCharts?.buildAnalysisCategoryPieOption?.({
    model,
    categoryColor: _categoryColor,
    theme: _analysisChartTheme(),
    formatCurrency: _fmtMoney,
  }) || {});

  try {
    chart.off('click');
    chart.on('click', (params) => {
      const name = _norm(params?.name || '');
      if (!name || name === 'Aucune dépense') return;
      _openTxDrilldown('category', name, model);
    });
  } catch (_) {}
}
  function _renderCategoryBars(model){
  const chart = _ensureChart('categoryBars','analysis-category-bars-chart');
  if (!chart) return;

  chart.setOption(window.TBAnalysisCharts?.buildAnalysisCategoryBarsOption?.({
    model,
    theme: _analysisChartTheme(),
    formatCurrency: _fmtMoney,
  }) || {});

  try {
    chart.off('click');
    chart.on('click', (params) => {
      const name = _norm(params?.name || params?.axisValue || '');
      if (!name) return;
      _openTxDrilldown('category', name, model);
    });
  } catch (_) {}
}

  function _renderSubcategoryBreakdown(model){
  const host = _el('analysis-subcategory-breakdown');
  if (!host) return;

  host.innerHTML = window.TBAnalysisView?.renderAnalysisSubcategoryBreakdown?.({
    model,
    formatCurrency: _fmtMoney,
    accent: _themeAccent(),
  }) || '';

  if (!(model.subcategorySeries || []).length) return;
  _ensureTxDrilldownStyles();

  host.querySelectorAll('[data-subkey]').forEach((node) => {
    node.addEventListener('click', (ev) => {
      ev.preventDefault();
      const key = node.getAttribute('data-subkey') || '';
      if (key) _openTxDrilldown('subcategory', key, model);
    });
  });
}
  function _renderVelocity(model){
    const chart = _ensureChart('velocity','analysis-velocity-chart');
    if (!chart) return;
    chart.setOption(window.TBAnalysisCharts?.buildAnalysisVelocityOption?.({
      model,
      theme: _analysisChartTheme(),
      formatCurrency: _fmtMoney,
    }) || {});
  }
  function _renderHeatmap(model){
    const chart = _ensureChart('heatmap','analysis-heatmap-chart');
    if (!chart) return;
    chart.setOption(window.TBAnalysisCharts?.buildAnalysisHeatmapOption?.({
      model,
      theme: _analysisChartTheme(),
      formatCurrency: _fmtMoney,
    }) || {});
  }
  function _renderReferencePanel(model){
    const summary = _el('analysis-reference-summary');
    const chartEl = _el('analysis-reference-mix-chart');
    const chart = charts.referenceMix;
    const analysisView = window.TBAnalysisView;
    if (summary) {
      summary.innerHTML = analysisView?.renderAnalysisReferenceSummary?.({
        model,
        formatCurrency: _fmtMoney,
      }) || '';
    }
    if (chart && chart.dispose) { try { chart.dispose(); } catch(_) {} delete charts.referenceMix; }
    if (!chartEl) return;
    chartEl.innerHTML = analysisView?.renderAnalysisReferenceMix?.({
      model,
      formatCurrency: _fmtMoney,
    }) || '';
  }

  function _renderNightCovered(model){
    const host = _el('analysis-night-covered');
    if (!host) return;
    host.innerHTML = window.TBAnalysisView?.renderAnalysisNightCovered?.({
      model,
      formatCurrency: _fmtMoney,
    }) || '';
  }

  function _renderInsights(model){
    const host = _el('analysis-insights');
    if (!host) return;
    const isEn = typeof window.tbGetLang === 'function' && window.tbGetLang() === 'en';
    const analysisView = window.TBAnalysisView;
    host.innerHTML = analysisView?.renderAnalysisInsights?.({
      model,
      isEn,
      formatCurrency: _fmtMoney,
    }) || '';
    const pill = _el('analysis-live-pill');
    if (pill) {
      const meta = analysisView?.buildAnalysisInsights?.({ model, isEn, formatCurrency: _fmtMoney });
      pill.textContent = meta?.livePill || '';
    }
  }

  function _renderAll(){
    if (!_el('view-analysis')) return;
    _saveFilters();
    let model;
    try {
      model = _computeModel();
    lastAnalysisModel = model;
    window.__tbLastBudgetAnalysisNotificationSummary = _analysisNotificationSummaryFromModel(model);
    } catch (err) {
      console.warn('[analysis] compute failed', err);
      const host = _el('analysis-summary');
      if (host) host.innerHTML = `<div class="muted">Impossible de calculer l’analyse pour le moment.</div>`;
      return;
    }

    const safe = (label, fn) => {
      try { fn(model); } catch (err) { console.warn(`[analysis] ${label} failed`, err); }
    };

    safe('overview-strip', _renderOverviewStrip);
    safe('summary', _buildSummary);
    safe('night-covered', _renderNightCovered);
    safe('insights', _renderInsights);
    safe('category', _renderCategory);
    safe('category-bars', _renderCategoryBars);
    safe('subcategory-breakdown', _renderSubcategoryBreakdown);
    safe('trajectory', _renderTrajectory);
    safe('reference-panel', _renderReferencePanel);
    safe('velocity', _renderVelocity);
    safe('heatmap', _renderHeatmap);

    const view = _el('view-analysis');
    const summaryHostPre = _el('analysis-summary');
    if (summaryHostPre && model && Array.isArray(model.txs) && model.txs.length === 0) {
      summaryHostPre.innerHTML = `<div class="muted">Aucune dépense visible pour ce scope, cette plage, ou ces filtres.</div>`;
    }
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
    sel.innerHTML = window.TBAnalysisFilterView?.renderPeriodFilterOptions?.({
      activeLabel,
      periods: periods.map((p) => ({
        id: p.id,
        start: _norm(p.start_date || p.start),
        end: _norm(p.end_date || p.end),
        base: _upper(p.base_currency || p.baseCurrency || ''),
      })),
    }) || '';
    const candidate = wanted || 'active';
    if ([...sel.options].some(o => o.value === candidate)) sel.value = candidate;
    _toggleRangeBox();
  }

  function _ensureEvents(){
    ['analysis-travel','analysis-period','analysis-scope','analysis-mode','analysis-range-start','analysis-range-end','analysis-currency','analysis-category-filter','analysis-subcategory-filter'].forEach(id => {
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
        if (id === 'analysis-category-filter') _renderAnalysisFilterSelects();
        await _loadReferenceCache();
        _renderAll();
      });
    });
    const refresh = _el('analysis-refresh');
    if (refresh && !refresh._tbBound) {
      refresh._tbBound = true;
      refresh.addEventListener('click', async () => {
        try {
          if (typeof refreshFromServer === 'function') {
            await refreshFromServer({
              includeDeferredData: true,
              includeGovernance: true,
              skipRender: true,
              skipFinancialRender: true,
              force: true,
              silent: true,
            });
          }
        } catch (err) {
          console.warn('[analysis] manual refresh failed', err?.message || err);
        }
        referenceCache.loaded = false;
        await _loadReferenceCache();
        _renderAnalysisFilterSelects();
        _renderAll();
      });
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

  let ensureAnalysisDeferredPromise = null;
  async function _ensureAnalysisDeferredData(){
    try {
      if (typeof window.tbIsOfflineMode === "function" && window.tbIsOfflineMode()) return;
      if (typeof window.tbLoadAssets === "function") await window.tbLoadAssets();
      const tid = String(state?.activeTravelId || state?.period?.travel_id || state?.period?.travelId || "").trim();
      if (tid && String(window.__tbDeferredDataLoadedForTravel || "") === tid && state?.transactions?.some((tx) => String(tx?.travel_id || tx?.travelId || "") === tid)) return;
      if (ensureAnalysisDeferredPromise) {
        await ensureAnalysisDeferredPromise;
        return;
      }
      if (typeof refreshFromServer !== "function") return;
      ensureAnalysisDeferredPromise = refreshFromServer({
        includeDeferredData: true,
        includeGovernance: true,
        skipRender: true,
        skipFinancialRender: true,
      });
      await ensureAnalysisDeferredPromise;
    } catch (err) {
      console.warn("[analysis] deferred mapping refresh failed", err?.message || err);
    } finally {
      ensureAnalysisDeferredPromise = null;
    }
  }

  let analysisRenderTimer = null;
  let analysisRenderPromise = null;

  window.tbRequestAnalysisRender = function tbRequestAnalysisRender(reason){
    try {
      if (analysisRenderTimer) clearTimeout(analysisRenderTimer);
      analysisRenderTimer = setTimeout(() => {
        analysisRenderTimer = null;
        const view = (typeof activeView === 'string' && activeView) ? activeView : (window.activeView || '');
        if (view !== 'analysis') return;
        if (analysisRenderPromise) return;
        analysisRenderPromise = Promise.resolve()
          .then(() => window.renderBudgetAnalysis?.(reason || 'request'))
          .catch((err) => console.warn('[analysis] requested render failed', err?.message || err))
          .finally(() => { analysisRenderPromise = null; });
      }, 30);
      return true;
    } catch (_) {
      return false;
    }
  };

  window.renderBudgetAnalysis = async function renderBudgetAnalysis(reason){
    const travelSel = _el('analysis-travel');
    if (!travelSel) {
      if (reason !== 'dom-retry') setTimeout(() => window.tbRequestAnalysisRender?.('dom-retry'), 60);
      return;
    }
    await _ensureAnalysisDeferredData();
    const filters = _loadFilters();
    const travels = _travelList();
    if (!travels.length) {
      const fallbackId = String(state?.activeTravelId || state?.period?.travel_id || state?.period?.travelId || '').trim();
      const fallbackName = String(state?.travel?.name || state?.travelName || 'Voyage actif').trim() || 'Voyage actif';
      travelSel.innerHTML = fallbackId ? `<option value="${escapeHTML(fallbackId)}">${escapeHTML(fallbackName)}</option>` : '<option value="">Aucun voyage disponible</option>';
      if (fallbackId) travelSel.value = fallbackId;
    } else {
      travelSel.innerHTML = travels.map(t => `<option value="${escapeHTML(String(t.id))}">${escapeHTML(String(t.name || 'Voyage'))}</option>`).join('');
      const wantedTravel = (_isUUID(filters.travelId) && travels.some(t => String(t.id) === String(filters.travelId))) ? filters.travelId : (state?.activeTravelId || travels[0]?.id || '');
      if (wantedTravel && [...travelSel.options].some(o => o.value === String(wantedTravel))) travelSel.value = String(wantedTravel);
      else if (!travelSel.value && travels[0]?.id) travelSel.value = String(travels[0].id);
    }
    _fillPeriodSelect(travelSel.value || String(state?.activeTravelId || ''), filters.periodId || 'active');
    const range = _rangeInputs();
    if (range.start) range.start.value = filters.rangeStart || '';
    if (range.end) range.end.value = filters.rangeEnd || '';
    _toggleRangeBox();
    if (_el('analysis-scope')) _el('analysis-scope').value = ['budget','out','all'].includes(filters.scope) ? filters.scope : 'budget';
    if (_el('analysis-mode')) _el('analysis-mode').value = ['expenses','planned'].includes(filters.mode) ? filters.mode : 'planned';
    if (_el('analysis-currency')) _el('analysis-currency').value = ['period','account'].includes(filters.currencyMode) ? filters.currencyMode : 'account';
    _renderAnalysisFilterSelects();
    if (_el('analysis-category-filter')) _el('analysis-category-filter').value = [..._el('analysis-category-filter').options].some(o => o.value === filters.categoryFilter) ? filters.categoryFilter : 'all';
    _renderAnalysisFilterSelects();
    if (_el('analysis-subcategory-filter')) _el('analysis-subcategory-filter').value = [..._el('analysis-subcategory-filter').options].some(o => o.value === filters.subcategoryFilter) ? filters.subcategoryFilter : 'all';
    excludePanelOpen = false;
    _renderCategoryExcludeChips(Array.isArray(filters.excludedCats) ? filters.excludedCats : []);
    _ensureEvents();
    if (_autoBroadenEmptyAnalysis()) _renderAnalysisFilterSelects();
    await _loadReferenceCache();
    _renderAll();
  };

  window.tbGetBudgetAnalysisNotificationSummary = async function tbGetBudgetAnalysisNotificationSummary(){
    try {
      await _ensureAnalysisDeferredData();
      const travelSel = _el('analysis-travel');
      if (!lastAnalysisModel || (travelSel && !travelSel.options.length)) {
        await window.renderBudgetAnalysis();
        if (window.__tbLastBudgetAnalysisNotificationSummary) return window.__tbLastBudgetAnalysisNotificationSummary;
      }
      await _loadReferenceCache();
      const model = _computeModel();
      lastAnalysisModel = model;
      window.__tbLastBudgetAnalysisNotificationSummary = _analysisNotificationSummaryFromModel(model);
      return window.__tbLastBudgetAnalysisNotificationSummary;
    } catch (err) {
      console.warn('[analysis] notification summary failed', err);
      return window.__tbLastBudgetAnalysisNotificationSummary || _analysisNotificationSummaryFromModel(lastAnalysisModel);
    }
  };

  try {
    window.tbOnLangChange = window.tbOnLangChange || [];
    if (!window.__tbAnalysisLangBound) {
      window.__tbAnalysisLangBound = true;
      window.tbOnLangChange.push(() => {
        try {
          if (document.getElementById('view-analysis') && !document.getElementById('view-analysis').classList.contains('hidden')) {
            window.renderBudgetAnalysis && window.renderBudgetAnalysis();
          }
        } catch (_) {}
      });
    }
  } catch (_) {}
  try {
    if (!window.__tbAnalysisRefreshBound) {
      window.__tbAnalysisRefreshBound = true;
      document.addEventListener('tb:financial:data_loaded', () => {
        referenceCache.loaded = false;
        const view = (typeof activeView === 'string' && activeView) ? activeView : (window.activeView || '');
        if (view !== 'analysis') return;
        window.tbRequestAnalysisRender?.('data-loaded');
      });
    }
  } catch (_) {}
})();
