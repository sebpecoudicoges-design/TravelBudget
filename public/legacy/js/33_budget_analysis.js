/* =========================
   Budget Analysis — immersive ECharts page
   ========================= */
(function () {
  const LS_KEY = 'tb_budget_analysis_filters_v1';
  const charts = { trajectory: null, category: null, velocity: null, heatmap: null };
  let resizeBound = false;

  function _el(id){ return document.getElementById(id); }
  function _safeNum(v){ const n = Number(v); return Number.isFinite(n) ? n : 0; }
  function _norm(s){ return String(s || '').trim(); }
  function _upper(s){ return _norm(s).toUpperCase(); }
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
  function _currency(){
    const travel = _getSelectedTravel();
    const period = _getSelectedPeriodObj();
    return _upper(period?.base_currency || period?.baseCurrency || travel?.base_currency || travel?.baseCurrency || state?.period?.baseCurrency || state?.user?.baseCurrency || 'EUR');
  }
  function _travelList(){ return Array.isArray(state?.travels) ? state.travels : []; }
  function _periodList(travelId){
    return (Array.isArray(state?.periods) ? state.periods : []).filter(p => String(p.travel_id || p.travelId || '') === String(travelId || state?.activeTravelId || ''));
  }
  function _getSelectedTravelId(){ return _el('analysis-travel')?.value || String(state?.activeTravelId || ''); }
  function _getSelectedPeriodId(){ return _el('analysis-period')?.value || 'active'; }
  function _getSelectedTravel(){ return _travelList().find(t => String(t.id) === String(_getSelectedTravelId())) || _travelList()[0] || null; }
  function _getSelectedPeriodObj(){
    const pid = _getSelectedPeriodId();
    if (pid === 'all') return null;
    if (pid === 'active') return state?.period || null;
    return _periodList(_getSelectedTravelId()).find(p => String(p.id) === String(pid)) || null;
  }
  function _analysisRange(){
    const travel = _getSelectedTravel();
    const period = _getSelectedPeriodObj();
    const start = _norm(period?.start_date || period?.start || travel?.start_date || travel?.start || state?.period?.start);
    const end = _norm(period?.end_date || period?.end || travel?.end_date || travel?.end || state?.period?.end);
    return { start, end };
  }
  function _loadFilters(){
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}') || {}; } catch (_) { return {}; }
  }
  function _saveFilters(){
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({
        travelId: _getSelectedTravelId(),
        periodId: _getSelectedPeriodId(),
        scope: _el('analysis-scope')?.value || 'budget',
        mode: _el('analysis-mode')?.value || 'expenses'
      }));
    } catch (_) {}
  }
  function _isTripLinked(tx){ return !!(tx?.trip_expense_id || tx?.tripExpenseId || tx?.trip_share_link_id || tx?.tripShareLinkId); }
  function _isInternalMovement(tx){ return String(tx?.category || '').trim().toLowerCase() === 'mouvement interne'; }
  function _txDate(tx){
    return _norm(tx?.dateStart || tx?.date_start || tx?.occurrence_date || tx?.date || tx?.created_at?.slice?.(0,10) || tx?.createdAt?.slice?.(0,10));
  }
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
  function _convert(amount, cur, dateISO){
    const base = _currency();
    const a = _safeNum(amount);
    const from = _upper(cur || base);
    if (!a) return 0;
    if (from === base) return a;
    try {
      if (typeof _toBaseForDate === 'function') return _safeNum(_toBaseForDate(a, from, dateISO));
    } catch (_) {}
    try {
      if (typeof fxConvert === 'function') {
        const out = fxConvert(a, from, base);
        if (out !== null && Number.isFinite(Number(out))) return Number(out);
      }
    } catch (_) {}
    if (from === 'EUR') {
      const r = _safeNum(state?.exchangeRates?.['EUR-BASE']);
      if (r) return a * r;
    }
    return 0;
  }
  function _dailyBudgetForDate(dateISO){
    const pid = _getSelectedPeriodId();
    if (pid !== 'all') {
      const p = _getSelectedPeriodObj();
      return _safeNum(p?.daily_budget_base || p?.dailyBudgetBase || state?.period?.dailyBudgetBase || 0);
    }
    try {
      if (typeof getBudgetSegmentForDate === 'function') {
        const seg = getBudgetSegmentForDate(dateISO);
        if (seg) return _safeNum(seg?.daily_budget_base || seg?.dailyBudgetBase || 0);
      }
    } catch (_) {}
    return _safeNum(state?.period?.dailyBudgetBase || 0);
  }
  function _filteredTransactions(){
    const travelId = _getSelectedTravelId();
    const { start, end } = _analysisRange();
    const scope = _el('analysis-scope')?.value || 'budget';
    const mode = _el('analysis-mode')?.value || 'expenses';
    return (Array.isArray(state?.transactions) ? state.transactions : []).filter(tx => {
      const txTravelId = String(tx?.travel_id || tx?.travelId || '');
      if (travelId && txTravelId && txTravelId !== String(travelId)) return false;
      const type = _txType(tx);
      if (type !== 'expense') return false;
      if (_isTripLinked(tx)) return false;
      if (_isInternalMovement(tx)) return false;
      const ds = _txDate(tx);
      if (!ds) return false;
      if (start && ds < start) return false;
      if (end && ds > end) return false;
      if (scope === 'budget' && _txOut(tx)) return false;
      if (scope === 'out' && !_txOut(tx)) return false;
      if (mode === 'expenses' && !_txPaid(tx)) return false;
      return true;
    });
  }
  function _computeModel(){
    const travelId = _getSelectedTravelId();
    const txs = _filteredTransactions();
    const { start, end } = _analysisRange();
    const base = _currency();
    const days = _daysInclusive(start, end);
    const dailyMap = Object.fromEntries(days.map(d => [d, 0]));
    const paidMap = Object.fromEntries(days.map(d => [d, 0]));
    const catMap = new Map();
    let spent = 0;
    let paidSpent = 0;
    for (const tx of txs) {
      const ds = _txDate(tx);
      const amt = _convert(tx?.amount, tx?.currency || base, ds);
      spent += amt;
      if (_txPaid(tx)) paidSpent += amt;
      if (dailyMap[ds] == null) dailyMap[ds] = 0;
      dailyMap[ds] += amt;
      if (_txPaid(tx)) { if (paidMap[ds] == null) paidMap[ds] = 0; paidMap[ds] += amt; }
      const cat = _norm(tx?.category || 'Autre');
      catMap.set(cat, (catMap.get(cat) || 0) + amt);
    }
    const targetDaily = days.map(d => _dailyBudgetForDate(d));
    const totalBudget = targetDaily.reduce((a,b)=>a+b,0);
    const cumSpent = [];
    const cumTarget = [];
    const velocity = [];
    const heat = [];
    let runSpent = 0;
    let runTarget = 0;
    days.forEach((d, idx) => {
      runSpent += _safeNum(dailyMap[d]);
      runTarget += _safeNum(targetDaily[idx]);
      cumSpent.push(Number(runSpent.toFixed(2)));
      cumTarget.push(Number(runTarget.toFixed(2)));
      velocity.push(Number((_safeNum(dailyMap[d])).toFixed(2)));
      heat.push([idx, 0, Number((_safeNum(paidMap[d] || dailyMap[d])).toFixed(2))]);
    });
    const remaining = totalBudget - spent;
    const pct = totalBudget > 0 ? (spent / totalBudget) * 100 : 0;
    const periodDays = Math.max(days.length, 1);
    const avgPerDay = spent / periodDays;
    const budgetPerDay = totalBudget / periodDays;
    const projection = avgPerDay * periodDays;
    const topCategories = [...catMap.entries()].sort((a,b)=>b[1]-a[1]).slice(0, 8);
    return {
      base, start, end, days, txs, spent, paidSpent, totalBudget, remaining, pct, avgPerDay, budgetPerDay, projection,
      cumSpent, cumTarget, velocity, heat, topCategories,
      outAmount: (Array.isArray(state?.transactions) ? state.transactions : []).filter(tx => {
        const txTravelId = String(tx?.travel_id || tx?.travelId || '');
        if (travelId && txTravelId && txTravelId !== String(travelId)) return false;
        const type = _txType(tx);
        if (type !== 'expense') return false;
        const ds = _txDate(tx);
        if (!ds || (start && ds < start) || (end && ds > end)) return false;
        if (!_txOut(tx)) return false;
        if (_isTripLinked(tx) || _isInternalMovement(tx)) return false;
        return true;
      }).reduce((sum, tx) => sum + _convert(tx?.amount, tx?.currency || base, _txDate(tx)), 0)
    };
  }

  function _buildSummary(model){
    const host = _el('analysis-summary');
    if (!host) return;
    const health = model.totalBudget > 0 ? Math.max(0, Math.min(100, model.pct)) : 0;
    const cards = [
      { label:'Budget prévu', value:_fmtMoney(model.totalBudget, model.base), meta:`${model.days.length} jours analysés`, pct:100 },
      { label:'Dépensé', value:_fmtMoney(model.spent, model.base), meta:`${health.toFixed(1)}% du budget consommé`, pct:health },
      { label:'Restant', value:_fmtMoney(model.remaining, model.base), meta:model.remaining >= 0 ? 'Encore de la marge' : 'Dépassement projeté', pct: model.totalBudget ? Math.max(0, 100 - health) : 0 },
      { label:'Hors budget', value:_fmtMoney(model.outAmount, model.base), meta:'Visible sans polluer le pilotage principal', pct: model.totalBudget ? Math.min(100, (model.outAmount / Math.max(model.totalBudget,1))*100) : 0 },
      { label:'Moyenne / jour', value:_fmtMoney(model.avgPerDay, model.base), meta:`Cible ${_fmtMoney(model.budgetPerDay, model.base)}/j`, pct: model.budgetPerDay ? Math.min(100, (model.avgPerDay / model.budgetPerDay) * 100) : 0 },
      { label:'Projection fin période', value:_fmtMoney(model.projection, model.base), meta:model.projection > model.totalBudget ? 'Au-dessus du cap' : 'Dans la trajectoire', pct: model.totalBudget ? Math.min(100, (model.projection / model.totalBudget) * 100) : 0 },
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
    chart.setOption({
      animationDuration: 900,
      animationEasing: 'cubicOut',
      tooltip: { trigger:'axis', backgroundColor:'rgba(15,23,42,.92)', borderWidth:0, textStyle:{ color:'#fff' } },
      legend: { top: 0, textStyle:{ color:_themeMuted() }, data:['Réel','Budget cible'] },
      grid: { left: 20, right: 20, top: 42, bottom: 26, containLabel:true },
      xAxis: { type:'category', boundaryGap:false, data:model.days.map(d=>d.slice(5)), axisLine:{ lineStyle:{ color:_themeGrid() } }, axisLabel:{ color:_themeMuted() } },
      yAxis: { type:'value', axisLabel:{ color:_themeMuted(), formatter:(v)=>_fmtMoney(v, model.base) }, splitLine:{ lineStyle:{ color:_themeGrid() } } },
      series: [
        { name:'Budget cible', type:'line', smooth:true, symbol:'none', lineStyle:{ width:2, type:'dashed', color:_themeWarn() }, areaStyle:{ color:'transparent' }, data:model.cumTarget },
        { name:'Réel', type:'line', smooth:true, symbol:'circle', symbolSize:6, lineStyle:{ width:4, color:_themeAccent() }, areaStyle:{ color: { type:'linear', x:0,y:0,x2:0,y2:1, colorStops:[{ offset:0, color:'rgba(59,130,246,.34)' },{ offset:1, color:'rgba(59,130,246,.03)' }] } }, emphasis:{ focus:'series' }, data:model.cumSpent,
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
        body: top ? `${_fmtMoney(top[1], model.base)} engagés, soit ${((top[1]/Math.max(model.spent,1))*100).toFixed(1)}% du total analysé.` : `Ajoute quelques dépenses payées pour faire émerger les tendances.`
      },
      {
        icon: delta > 0 ? '📈' : '🌿',
        title: delta > 0 ? 'Projection au-dessus du cap' : 'Projection dans la trajectoire',
        body: delta > 0 ? `Au rythme actuel, tu finirais à ${_fmtMoney(model.projection, model.base)}, soit ${_fmtMoney(delta, model.base)} au-dessus du budget.` : `La projection termine à ${_fmtMoney(model.projection, model.base)}. Tu gardes une marge d’environ ${_fmtMoney(Math.abs(delta), model.base)}.`
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

  function _fillPeriodSelect(travelId, wanted){
    const sel = _el('analysis-period');
    if (!sel) return;
    const periods = _periodList(travelId).slice().sort((a,b)=>String(a.start_date || a.start || '').localeCompare(String(b.start_date || b.start || '')));
    const activeLabel = state?.period?.start && state?.period?.end
      ? `Période active (${state.period.start} → ${state.period.end})`
      : 'Période active';
    sel.innerHTML = `<option value="active">${escapeHTML(activeLabel)}</option><option value="all">Tout le voyage</option>` + periods.map(p => {
      const s = _norm(p.start_date || p.start);
      const e = _norm(p.end_date || p.end);
      const base = _upper(p.base_currency || p.baseCurrency || '');
      return `<option value="${escapeHTML(String(p.id))}">${escapeHTML((p.name || 'Période') + ' • ' + s + ' → ' + e + (base ? ' • ' + base : ''))}</option>`;
    }).join('');
    const candidate = wanted || 'active';
    if ([...sel.options].some(o => o.value === candidate)) sel.value = candidate;
  }

  function _ensureEvents(){
    ['analysis-travel','analysis-period','analysis-scope','analysis-mode'].forEach(id => {
      const el = _el(id);
      if (!el || el._tbBound) return;
      el._tbBound = true;
      el.addEventListener('change', () => {
        if (id === 'analysis-travel') _fillPeriodSelect(_getSelectedTravelId(), 'active');
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
    if (_el('analysis-scope')) _el('analysis-scope').value = ['budget','out','all'].includes(filters.scope) ? filters.scope : 'budget';
    if (_el('analysis-mode')) _el('analysis-mode').value = ['expenses','planned'].includes(filters.mode) ? filters.mode : 'expenses';
    _ensureEvents();
    _renderAll();
  };
})();
