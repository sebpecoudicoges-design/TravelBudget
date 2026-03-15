/* =========================
   Budget Analysis — immersive ECharts page
   V9.2.2: metric fix + segment-aligned scopes + category filter
   ========================= */
(function () {
  const LS_KEY = 'tb_budget_analysis_filters_v2';
  const charts = { trajectory: null, category: null, velocity: null, heatmap: null };
  let resizeBound = false;

  function _el(id){ return document.getElementById(id); }
  function _safeNum(v){ const n = Number(v); return Number.isFinite(n) ? n : 0; }
  function _norm(s){ return String(s || '').trim(); }
  function _upper(s){ return _norm(s).toUpperCase(); }
  function _iso(d){ try { return toLocalISODate(d); } catch (_) { return new Date(d).toISOString().slice(0,10); } }
  function _parse(iso){ try { return parseISODateOrNull(iso); } catch (_) { return iso ? new Date(iso+'T00:00:00') : null; } }
  function _fmtMoney(v, cur){ try { return fmtMoney(v, cur); } catch (_) { return `${(_safeNum(v)).toFixed(2)} ${cur || ''}`.trim(); } }
  function _isUUID(v){ return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v || '')); }
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
  function _themeText(){ return getComputedStyle(document.body).getPropertyValue('--text').trim() || '#e5e7eb'; }
  function _themeMuted(){ return getComputedStyle(document.body).getPropertyValue('--muted').trim() || '#94a3b8'; }
  function _themeGrid(){ return getComputedStyle(document.body).getPropertyValue('--gridline').trim() || 'rgba(148,163,184,.18)'; }
  function _themeAccent(){ return getComputedStyle(document.body).getPropertyValue('--accent').trim() || '#3b82f6'; }
  function _themeGood(){ return getComputedStyle(document.body).getPropertyValue('--good').trim() || '#22c55e'; }
  function _themeWarn(){ return getComputedStyle(document.body).getPropertyValue('--warn').trim() || '#f59e0b'; }
  function _themeBad(){ return getComputedStyle(document.body).getPropertyValue('--bad').trim() || '#ef4444'; }

  function _travelList(){ return Array.isArray(state?.travels) ? state.travels : []; }
  function _periodRecords(){ return Array.isArray(state?.periods) ? state.periods : []; }
  function _segmentRecords(){ return Array.isArray(state?.budgetSegments) ? state.budgetSegments : []; }
  function _periodMap(){ return new Map(_periodRecords().map(p => [String(p.id || ''), p])); }
  function _getSelectedTravelId(){ return _el('analysis-travel')?.value || String(state?.activeTravelId || ''); }
  function _getSelectedTravel(){ return _travelList().find(t => String(t.id) === String(_getSelectedTravelId())) || _travelList()[0] || null; }
  function _selectedScope(){ return _el('analysis-scope')?.value || 'budget'; }
  function _selectedMode(){ return _el('analysis-mode')?.value || 'expenses'; }
  function _selectedCategory(){ return _el('analysis-category')?.value || 'all'; }

  function _segmentTravelId(seg){
    const p = _periodMap().get(String(seg?.periodId || ''));
    return String(p?.travelId || p?.travel_id || '');
  }
  function _travelBounds(travelId){
    const t = _travelList().find(x => String(x.id) === String(travelId || '')) || _getSelectedTravel();
    return {
      start: _norm(t?.start_date || t?.start || ''),
      end: _norm(t?.end_date || t?.end || '')
    };
  }
  function _segmentsForTravel(travelId){
    const wanted = String(travelId || _getSelectedTravelId() || '');
    const bounds = _travelBounds(wanted);
    return _segmentRecords()
      .filter(seg => {
        const pidTravel = _segmentTravelId(seg);
        if (pidTravel) return pidTravel === wanted;
        const s = _norm(seg?.start || seg?.start_date || '');
        const e = _norm(seg?.end || seg?.end_date || '');
        return !!wanted && !!s && !!e && (!bounds.start || e >= bounds.start) && (!bounds.end || s <= bounds.end);
      })
      .slice()
      .sort((a,b)=>String(a.start || a.start_date || '').localeCompare(String(b.start || b.start_date || '')));
  }
  function _segmentId(seg){ return String(seg?.id || ''); }
  function _segmentLabel(seg, idx){
    const s = _norm(seg?.start || seg?.start_date || '');
    const e = _norm(seg?.end || seg?.end_date || '');
    const base = _upper(seg?.baseCurrency || seg?.base_currency || '');
    return `Période ${idx+1} • ${s} → ${e}${base ? ' • ' + base : ''}`;
  }
  function _segmentForDate(dateISO, travelId){
    const ds = _norm(dateISO);
    if (!ds) return null;
    const list = _segmentsForTravel(travelId);
    return list.find(seg => {
      const s = _norm(seg?.start || seg?.start_date || '');
      const e = _norm(seg?.end || seg?.end_date || '');
      return s && e && ds >= s && ds <= e;
    }) || null;
  }
  function _getSelectedPeriodId(){ return _el('analysis-period')?.value || 'active'; }
  function _getSelectedSegment(){
    const pid = _getSelectedPeriodId();
    if (pid === 'all' || pid === 'active' || pid === 'range') return null;
    return _segmentsForTravel(_getSelectedTravelId()).find(seg => _segmentId(seg) === String(pid)) || null;
  }
  function _getActiveSegmentForTravel(travelId){
    const today = _iso(new Date());
    const list = _segmentsForTravel(travelId);
    return list.find(seg => {
      const s = _norm(seg?.start || seg?.start_date || '');
      const e = _norm(seg?.end || seg?.end_date || '');
      return s && e && today >= s && today <= e;
    }) || list[0] || null;
  }

  function _rangeInputs(){
    return {
      start: _el('analysis-range-start'),
      end: _el('analysis-range-end'),
      box: _el('analysis-range-box')
    };
  }
  function _analysisRange(){
    const travel = _getSelectedTravel();
    const pid = _getSelectedPeriodId();
    const seg = _getSelectedSegment();
    const activeSeg = _getActiveSegmentForTravel(_getSelectedTravelId());
    const travelStart = _norm(travel?.start_date || travel?.start || '');
    const travelEnd = _norm(travel?.end_date || travel?.end || '');
    if (pid === 'range') {
      const ri = _rangeInputs();
      let start = _norm(ri.start?.value || '') || travelStart;
      let end = _norm(ri.end?.value || '') || travelEnd;
      if (travelStart && start < travelStart) start = travelStart;
      if (travelEnd && end > travelEnd) end = travelEnd;
      if (start && end && start > end) [start, end] = [end, start];
      return { start, end };
    }
    if (pid === 'active') {
      return {
        start: _norm(activeSeg?.start || activeSeg?.start_date || travelStart),
        end: _norm(activeSeg?.end || activeSeg?.end_date || travelEnd)
      };
    }
    if (pid === 'all') return { start: travelStart, end: travelEnd };
    return {
      start: _norm(seg?.start || seg?.start_date || travelStart),
      end: _norm(seg?.end || seg?.end_date || travelEnd)
    };
  }

  function _resolveAnalysisCurrency(startISO, endISO){
    const segs = _segmentsForTravel(_getSelectedTravelId()).filter(seg => {
      const s = _norm(seg?.start || seg?.start_date || '');
      const e = _norm(seg?.end || seg?.end_date || '');
      return s && e && (!startISO || e >= startISO) && (!endISO || s <= endISO);
    });
    const bases = new Set(segs.map(seg => _upper(seg?.baseCurrency || seg?.base_currency || '')).filter(Boolean));
    if (bases.size > 1) return 'EUR';
    if (bases.size === 1) return [...bases][0];
    const activeSeg = _getActiveSegmentForTravel(_getSelectedTravelId());
    return _upper(activeSeg?.baseCurrency || activeSeg?.base_currency || _getSelectedTravel()?.base_currency || 'EUR');
  }

  function _loadFilters(){
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}') || {}; } catch (_) { return {}; }
  }
  function _saveFilters(){
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({
        travelId: _getSelectedTravelId(),
        periodId: _getSelectedPeriodId(),
        rangeStart: _el('analysis-range-start')?.value || '',
        rangeEnd: _el('analysis-range-end')?.value || '',
        scope: _selectedScope(),
        mode: _selectedMode(),
        category: _selectedCategory()
      }));
    } catch (_) {}
  }

  function _txDate(tx){ return _norm(tx?.dateStart || tx?.date_start || tx?.occurrence_date || tx?.date || tx?.created_at?.slice?.(0,10)); }
  function _txType(tx){ return String(tx?.type || '').toLowerCase(); }
  function _txPaid(tx){ return !!(tx?.payNow ?? tx?.pay_now); }
  function _txOut(tx){ return !!(tx?.outOfBudget ?? tx?.out_of_budget); }
  function _txCategory(tx){ return _norm(tx?.category || 'Autre'); }
  function _isTripLinked(tx){ return !!(tx?.tripExpenseId || tx?.trip_expense_id || tx?.tripShareLinkId || tx?.trip_share_link_id); }
  function _isInternalMovement(tx){
    const c = _txCategory(tx).toLowerCase();
    return !!tx?.isInternal || !!tx?.is_internal || c === 'mouvement interne';
  }
  function _isTransportInternational(cat){
    const c = _norm(cat).toLowerCase();
    return c === 'transport internationale' || c === 'transport international' || /^transport\s+inter/.test(c);
  }
  function _txCategoryFilterMatch(tx){
    const selected = _selectedCategory();
    if (!selected || selected === 'all') return true;
    return _txCategory(tx) === selected;
  }
  function _shouldIncludeBudgetTx(tx){
    if (_txType(tx) !== 'expense') return false;
    if (_isTripLinked(tx)) return false;
    if (_isInternalMovement(tx)) return false;
    if (!_txCategoryFilterMatch(tx)) return false;
    const scope = _selectedScope();
    if (scope === 'budget' && _txOut(tx)) return false;
    if (scope === 'out' && !_txOut(tx)) return false;
    const mode = _selectedMode();
    if (mode === 'expenses' && !_txPaid(tx)) return false;
    return true;
  }
  function _ratesForDate(dateISO, travelId){
    try {
      const seg = _segmentForDate(dateISO, travelId);
      if (seg && typeof window.fxRatesForSegment === 'function') return window.fxRatesForSegment(seg);
    } catch (_) {}
    return (typeof window.fxGetEurRates === 'function') ? window.fxGetEurRates() : {};
  }
  function _convert(amount, fromCur, toCur, dateISO, travelId){
    const a = _safeNum(amount);
    const from = _upper(fromCur || toCur || 'EUR');
    const to = _upper(toCur || from || 'EUR');
    if (!a) return 0;
    if (from === to) return a;
    try {
      if (typeof window.fxConvert === 'function') {
        const out = window.fxConvert(a, from, to, _ratesForDate(dateISO, travelId));
        if (out !== null && Number.isFinite(Number(out))) return Number(out);
      }
    } catch (_) {}
    try {
      if (from !== 'EUR' && typeof amountToEUR === 'function') {
        const eur = amountToEUR(a, from);
        if (to === 'EUR') return _safeNum(eur);
        if (typeof eurToAmount === 'function') return _safeNum(eurToAmount(eur, to));
      }
    } catch (_) {}
    return 0;
  }
  function _dailyNominalForDate(dateISO, analysisBase, travelId){
    const seg = _segmentForDate(dateISO, travelId);
    if (!seg) return 0;
    const segBase = _upper(seg?.baseCurrency || seg?.base_currency || analysisBase || 'EUR');
    const daily = _safeNum(seg?.dailyBudgetBase || seg?.daily_budget_base || seg?.daily || seg?.daily_budget);
    return _convert(daily, segBase, analysisBase, dateISO, travelId);
  }

  function _buildCategoryOptions(){
    const values = new Set();
    try {
      if (typeof getCategories === 'function') {
        (getCategories() || []).forEach(c => values.add(_norm(c)));
      }
    } catch (_) {}
    (Array.isArray(state?.categories) ? state.categories : []).forEach(c => values.add(_norm(c?.name || c)));
    (Array.isArray(state?.transactions) ? state.transactions : []).forEach(tx => {
      const cat = _txCategory(tx);
      if (!cat || /^\[trip\]/i.test(cat) || /^cat(é|e)gorie$/i.test(cat) || /^category$/i.test(cat)) return;
      if (_isTripLinked(tx)) return;
      if (_isInternalMovement(tx)) return;
      values.add(cat);
    });
    const out = [...values].filter(Boolean).sort((a,b)=>a.localeCompare(b, 'fr', { sensitivity:'base' }));
    const sel = _el('analysis-category');
    if (!sel) return;
    const current = _selectedCategory();
    sel.innerHTML = `<option value="all">Toutes les catégories</option>` + out.map(c => `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`).join('');
    if ([...sel.options].some(o => o.value === current)) sel.value = current;
  }

  function _filteredTransactionsForRange(start, end){
    const travelId = _getSelectedTravelId();
    return (Array.isArray(state?.transactions) ? state.transactions : []).filter(tx => {
      const ds = _txDate(tx);
      const txTravelId = String(tx?.travelId || tx?.travel_id || '');
      if (travelId && txTravelId && txTravelId !== String(travelId)) return false;
      if (!ds || (start && ds < start) || (end && ds > end)) return false;
      return _shouldIncludeBudgetTx(tx);
    });
  }
  function _outTransactionsForRange(start, end){
    const travelId = _getSelectedTravelId();
    const mode = _selectedMode();
    return (Array.isArray(state?.transactions) ? state.transactions : []).filter(tx => {
      const ds = _txDate(tx);
      const txTravelId = String(tx?.travelId || tx?.travel_id || '');
      if (travelId && txTravelId && txTravelId !== String(travelId)) return false;
      if (_txType(tx) !== 'expense') return false;
      if (_isTripLinked(tx) || _isInternalMovement(tx)) return false;
      if (!_txOut(tx)) return false;
      if (!_txCategoryFilterMatch(tx)) return false;
      if (!ds || (start && ds < start) || (end && ds > end)) return false;
      if (mode === 'expenses' && !_txPaid(tx)) return false;
      return true;
    });
  }

  function _computeModel(){
    const travelId = _getSelectedTravelId();
    const { start, end } = _analysisRange();
    const days = _daysInclusive(start, end);
    const base = _resolveAnalysisCurrency(start, end);
    const txs = _filteredTransactionsForRange(start, end);
    const outTxs = _outTransactionsForRange(start, end);
    const dailyActual = Object.fromEntries(days.map(d => [d, 0]));
    const dailyPaidOnly = Object.fromEntries(days.map(d => [d, 0]));
    const dailyNominal = Object.fromEntries(days.map(d => [d, _dailyNominalForDate(d, base, travelId)]));
    const catMap = new Map();
    let spent = 0;
    let paidSpent = 0;

    for (const tx of txs) {
      const ds = _txDate(tx);
      const amt = _convert(tx?.amount, tx?.currency || base, base, ds, travelId);
      spent += amt;
      dailyActual[ds] = _safeNum(dailyActual[ds]) + amt;
      if (_txPaid(tx)) {
        paidSpent += amt;
        dailyPaidOnly[ds] = _safeNum(dailyPaidOnly[ds]) + amt;
      }
      const cat = _txCategory(tx);
      catMap.set(cat, (catMap.get(cat) || 0) + amt);
    }

    const nominalSeries = days.map(d => Number(_safeNum(dailyNominal[d]).toFixed(2)));
    const actualSeries = days.map(d => Number(_safeNum(dailyActual[d]).toFixed(2)));
    const heatSeries = days.map((d, idx) => [idx, 0, Number(_safeNum(dailyPaidOnly[d] || dailyActual[d]).toFixed(2))]);
    const totalBudget = nominalSeries.reduce((a,b)=>a+b,0);

    let runActual = 0;
    let runTarget = 0;
    const cumSpent = [];
    const cumTarget = [];
    days.forEach((d, idx) => {
      runActual += actualSeries[idx];
      runTarget += nominalSeries[idx];
      cumSpent.push(Number(runActual.toFixed(2)));
      cumTarget.push(Number(runTarget.toFixed(2)));
    });

    const todayISO = _iso(new Date());
    const todayClamped = (!start || todayISO >= start) ? (!end || todayISO <= end ? todayISO : end) : start;
    const pastDays = days.filter(d => d <= todayClamped);
    const futureDays = days.filter(d => d > todayClamped);
    const actualToToday = pastDays.reduce((sum, d) => sum + _safeNum(dailyActual[d]), 0);
    const nominalToToday = pastDays.reduce((sum, d) => sum + _safeNum(dailyNominal[d]), 0);
    const nominalAfterToday = futureDays.reduce((sum, d) => sum + _safeNum(dailyNominal[d]), 0);

    let projection = spent;
    if (end && todayISO < start) projection = totalBudget;
    else if (end && todayISO > end) projection = spent;
    else projection = Math.max(actualToToday, nominalToToday) + nominalAfterToday;

    const remaining = totalBudget - spent;
    const pct = totalBudget > 0 ? (spent / totalBudget) * 100 : 0;
    const elapsedDays = Math.max(1, pastDays.length || days.length || 1);
    const avgPerDay = (days.length && todayISO < start)
      ? totalBudget / Math.max(days.length,1)
      : spent / elapsedDays;
    const budgetPerDay = (days.length && todayISO < start)
      ? totalBudget / Math.max(days.length,1)
      : nominalToToday / elapsedDays || totalBudget / Math.max(days.length,1);
    const outAmount = outTxs.reduce((sum, tx) => sum + _convert(tx?.amount, tx?.currency || base, base, _txDate(tx), travelId), 0);
    const topCategories = [...catMap.entries()].sort((a,b)=>b[1]-a[1]).slice(0, 8);

    return {
      base, start, end, days, txs, outTxs,
      spent, paidSpent, totalBudget, remaining, pct,
      avgPerDay, budgetPerDay, projection, outAmount,
      cumSpent, cumTarget, velocity: actualSeries, heat: heatSeries,
      topCategories,
      actualToToday, nominalToToday, nominalAfterToday,
      todayClamped,
    };
  }

  function _buildSummary(model){
    const host = _el('analysis-summary');
    if (!host) return;
    const health = model.totalBudget > 0 ? Math.max(0, Math.min(100, model.pct)) : 0;
    const cards = [
      { label:'Budget prévu', value:_fmtMoney(model.totalBudget, model.base), meta:`${model.days.length} jours analysés`, pct:100 },
      { label:'Dépensé', value:_fmtMoney(model.spent, model.base), meta:`${health.toFixed(1)}% du budget consommé`, pct:health },
      { label:'Restant', value:_fmtMoney(model.remaining, model.base), meta:model.remaining >= 0 ? 'Encore de la marge' : 'Dépassement constaté', pct: model.totalBudget ? Math.max(0, 100 - health) : 0 },
      { label:'Hors budget', value:_fmtMoney(model.outAmount, model.base), meta:'Visible sans polluer le pilotage principal', pct: model.totalBudget ? Math.min(100, (model.outAmount / Math.max(model.totalBudget,1))*100) : 0 },
      { label:'Moyenne / jour', value:_fmtMoney(model.avgPerDay, model.base), meta:`Cible ${_fmtMoney(model.budgetPerDay, model.base)}/j`, pct: model.budgetPerDay ? Math.min(100, (model.avgPerDay / Math.max(model.budgetPerDay,0.0001)) * 100) : 0 },
      { label:'Projection fin période', value:_fmtMoney(model.projection, model.base), meta:model.projection > model.totalBudget ? 'Au-dessus du cap' : 'Dans la trajectoire', pct: model.totalBudget ? Math.min(100, (model.projection / Math.max(model.totalBudget,0.0001)) * 100) : 0 },
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

  function _ensureChart(name, id){
    const el = _el(id);
    if (!el || !window.echarts) return null;
    if (!charts[name] || charts[name].isDisposed()) charts[name] = window.echarts.init(el, null, { renderer:'canvas' });
    return charts[name];
  }
  function _renderTrajectory(model){
    const chart = _ensureChart('trajectory','analysis-trajectory-chart');
    if (!chart) return;
    chart.setOption({
      animationDuration: 900,
      animationEasing: 'cubicOut',
      tooltip: { trigger:'axis', backgroundColor:'rgba(15,23,42,.92)', borderWidth:0, textStyle:{ color:'#fff' } },
      legend: { top: 0, textStyle:{ color:_themeMuted() }, data:['Réel cumulé','Cible cumulée'] },
      grid: { left: 24, right: 20, top: 42, bottom: 26, containLabel:true },
      xAxis: { type:'category', boundaryGap:false, data:model.days.map(d=>d.slice(5)), axisLine:{ lineStyle:{ color:_themeGrid() } }, axisLabel:{ color:_themeMuted() } },
      yAxis: { type:'value', axisLabel:{ color:_themeMuted(), formatter:(v)=>_fmtMoney(v, model.base) }, splitLine:{ lineStyle:{ color:_themeGrid() } } },
      series: [
        {
          name:'Cible cumulée', type:'line', smooth:true, symbol:'none',
          lineStyle:{ width:2, type:'dashed', color:'#8b5cf6' },
          data:model.cumTarget
        },
        {
          name:'Réel cumulé', type:'line', smooth:true, symbol:'circle', symbolSize:5,
          lineStyle:{ width:4, color:_themeAccent() },
          areaStyle:{ color: { type:'linear', x:0,y:0,x2:0,y2:1, colorStops:[{ offset:0, color:'rgba(59,130,246,.28)' },{ offset:1, color:'rgba(59,130,246,.03)' }] } },
          emphasis:{ focus:'series' },
          data:model.cumSpent,
          markLine: model.todayClamped ? {
            silent:true,
            symbol:['none','none'],
            lineStyle:{ color:'rgba(148,163,184,.5)', type:'dashed' },
            data:[{ xAxis: model.days.indexOf(model.todayClamped) }]
          } : undefined,
          markPoint:{ symbol:'circle', symbolSize:16, itemStyle:{ color:_themeAccent(), shadowBlur:18, shadowColor:'rgba(59,130,246,.45)' }, data: model.cumSpent.length ? [{ coord:[model.days.length-1, model.cumSpent[model.cumSpent.length-1]] }] : [] }
        }
      ]
    });
    const meta = _el('analysis-trajectory-meta');
    if (meta) meta.innerHTML = `${escapeHTML(model.start || '—')} → ${escapeHTML(model.end || '—')}<br>${escapeHTML(model.days.length + ' jours')}`;
  }
  function _renderCategory(model){
    const chart = _ensureChart('category','analysis-category-chart');
    if (!chart) return;
    const palette = [_themeAccent(), '#8b5cf6', '#06b6d4', '#22c55e', '#f59e0b', '#ef4444', '#14b8a6', '#f472b6'];
    const data = model.topCategories.map((it, idx) => ({ name: it[0], value: Number(it[1].toFixed(2)), itemStyle:{ color: palette[idx % palette.length] } }));
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
        { type:'line', smooth:true, symbol:'none', data:model.days.map(()=>Number(model.budgetPerDay.toFixed(2))), lineStyle:{ color:'#8b5cf6', width:2, type:'dashed' } }
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
  function _renderInsights(model){
    const host = _el('analysis-insights');
    const delta = model.projection - model.totalBudget;
    const top = model.topCategories[0];
    const insights = [
      {
        icon: model.avgPerDay > model.budgetPerDay ? '⚠️' : '✅',
        title: model.avgPerDay > model.budgetPerDay ? 'Cadence au-dessus de la cible' : 'Cadence maîtrisée',
        body: model.avgPerDay > model.budgetPerDay
          ? `Tu tournes à ${_fmtMoney(model.avgPerDay, model.base)}/jour pour une cible de ${_fmtMoney(model.budgetPerDay, model.base)}/jour.`
          : `Tu restes sous la cible avec ${_fmtMoney(model.avgPerDay, model.base)}/jour contre ${_fmtMoney(model.budgetPerDay, model.base)}/jour visés.`
      },
      {
        icon: top ? '🧲' : '•',
        title: top ? `Catégorie dominante : ${top[0]}` : 'Aucune catégorie dominante',
        body: top ? `${_fmtMoney(top[1], model.base)} engagés, soit ${((top[1]/Math.max(model.spent,1))*100).toFixed(1)}% du total analysé.` : `Ajoute quelques dépenses sur la plage pour faire émerger les tendances.`
      },
      {
        icon: delta > 0 ? '📈' : '🌿',
        title: delta > 0 ? 'Projection au-dessus du cap' : 'Projection dans la trajectoire',
        body: delta > 0 ? `Au rythme mixte actuel, tu finirais à ${_fmtMoney(model.projection, model.base)}, soit ${_fmtMoney(delta, model.base)} au-dessus du budget.` : `La projection termine à ${_fmtMoney(model.projection, model.base)}. Tu gardes une marge d’environ ${_fmtMoney(Math.abs(delta), model.base)}.`
      },
      {
        icon: model.outAmount > 0 ? '🎯' : '🧭',
        title: model.outAmount > 0 ? 'Hors budget visible' : 'Lecture budgétaire propre',
        body: model.outAmount > 0 ? `${_fmtMoney(model.outAmount, model.base)} hors budget sur la plage. Tu peux basculer le filtre pour isoler ces dépenses.` : `Aucune dépense hors budget notable sur la plage courante.`
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

  function _toggleRangeBox(){
    const pid = _getSelectedPeriodId();
    const { box, start, end } = _rangeInputs();
    if (!box) return;
    const bounds = _travelBounds(_getSelectedTravelId());
    box.style.display = (pid === 'range') ? 'grid' : 'none';
    if (pid === 'range') {
      if (start && !start.value) start.value = bounds.start;
      if (end && !end.value) end.value = bounds.end;
      if (start) { start.min = bounds.start; start.max = bounds.end || ''; }
      if (end) { end.min = bounds.start; end.max = bounds.end || ''; }
    }
  }
  function _fillPeriodSelect(travelId, wanted){
    const sel = _el('analysis-period');
    if (!sel) return;
    const segs = _segmentsForTravel(travelId);
    const activeSeg = _getActiveSegmentForTravel(travelId);
    const activeLabel = activeSeg ? `Période active (${_norm(activeSeg.start || activeSeg.start_date)} → ${_norm(activeSeg.end || activeSeg.end_date)})` : 'Période active';
    sel.innerHTML = `<option value="active">${escapeHTML(activeLabel)}</option><option value="all">Tout le voyage</option>` + segs.map((seg, idx) => `<option value="${escapeHTML(_segmentId(seg))}">${escapeHTML(_segmentLabel(seg, idx))}</option>`).join('') + `<option value="range">Date à date</option>`;
    const candidate = wanted || 'active';
    if ([...sel.options].some(o => o.value === candidate)) sel.value = candidate;
    _toggleRangeBox();
  }

  function _renderAll(){
    if (!_el('view-analysis')) return;
    _saveFilters();
    const model = _computeModel();
    _buildSummary(model);
    _renderTrajectory(model);
    _renderCategory(model);
    _renderVelocity(model);
    _renderHeatmap(model);
    _renderInsights(model);
  }
  function _ensureEvents(){
    ['analysis-travel','analysis-period','analysis-scope','analysis-mode','analysis-range-start','analysis-range-end','analysis-category'].forEach(id => {
      const el = _el(id);
      if (!el || el._tbBound) return;
      el._tbBound = true;
      el.addEventListener('change', () => {
        if (id === 'analysis-travel') {
          const f = _loadFilters();
          const rs = _el('analysis-range-start');
          const re = _el('analysis-range-end');
          if (rs) rs.value = f.rangeStart || '';
          if (re) re.value = f.rangeEnd || '';
          _fillPeriodSelect(_getSelectedTravelId(), 'active');
        }
        if (id === 'analysis-period') _toggleRangeBox();
        _renderAll();
      });
    });
    const refresh = _el('analysis-refresh');
    if (refresh && !refresh._tbBound) {
      refresh._tbBound = true;
      refresh.addEventListener('click', _renderAll);
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
    if (_el('analysis-mode')) _el('analysis-mode').value = ['expenses','planned'].includes(filters.mode) ? filters.mode : 'expenses';
    _buildCategoryOptions();
    if (_el('analysis-category')) _el('analysis-category').value = filters.category || 'all';
    _ensureEvents();
    _renderAll();
  };
})();
