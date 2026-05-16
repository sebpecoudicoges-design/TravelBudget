/* =========================
   FX Decision AUD/EUR V1
   - Weekly AUD income decision helper
   - Uses public historical AUD->EUR when available, fallback to local indicative series
   ========================= */
(function () {
  const LS = {
    weeklyIncome: "travelbudget_fx_decision_weekly_income_aud_v1",
    eurNeed: "travelbudget_fx_decision_eur_need_v1",
    audSafety: "travelbudget_fx_decision_aud_safety_v1",
    scaleMode: "travelbudget_fx_decision_scale_mode_v1",
    horizonDays: "travelbudget_fx_decision_horizon_days_v1",
    eurNeedAmount: "travelbudget_fx_decision_eur_need_amount_v1",
    audSafetyAmount: "travelbudget_fx_decision_aud_safety_amount_v1",
    historyCache: "travelbudget_fx_decision_aud_eur_history_cache_v1",
  };

  const esc = (value) => (typeof escapeHTML === "function" ? escapeHTML(value) : String(value ?? ""));
  const T = (key, vars) => (typeof window.tbT === "function" ? window.tbT(key, vars) : key);
  const money = (amount, currency) => (typeof _fmtMoney === "function" ? _fmtMoney(amount, currency) : `${Number(amount || 0).toFixed(2)} ${currency}`);
  const todayISO = () => {
    try { return toLocalISODate(new Date()); } catch (_) { return new Date().toISOString().slice(0, 10); }
  };
  const addDaysISO = (iso, days) => {
    const d = new Date(`${iso}T00:00:00`);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  };
  const readNumber = (key, fallback) => {
    try {
      const n = Number(localStorage.getItem(key));
      return Number.isFinite(n) ? n : fallback;
    } catch (_) {
      return fallback;
    }
  };
  const writeNumber = (key, value) => {
    try { localStorage.setItem(key, String(Number(value))); } catch (_) {}
  };
  const readText = (key, fallback) => {
    try {
      const value = String(localStorage.getItem(key) || "").trim();
      return value || fallback;
    } catch (_) {
      return fallback;
    }
  };
  const writeText = (key, value) => {
    try { localStorage.setItem(key, String(value || "")); } catch (_) {}
  };
  const clamp01 = (value) => Math.max(0, Math.min(1, Number(value) || 0));
  const readHorizonDays = () => {
    const n = Number(readNumber(LS.horizonDays, 90));
    return [30, 60, 90, 180].includes(n) ? n : 90;
  };

  function currentAudEurRate() {
    try {
      if (typeof window.fxRate === "function") {
        const r = Number(window.fxRate("AUD", "EUR"));
        if (Number.isFinite(r) && r > 0) return r;
      }
    } catch (_) {}
    try {
      const rates = typeof window.fxGetEurRates === "function" ? window.fxGetEurRates() : {};
      const aud = Number(rates?.AUD);
      if (Number.isFinite(aud) && aud > 0) return 1 / aud;
    } catch (_) {}
    return null;
  }

  function fallbackSeries(rate) {
    const base = Number(rate) > 0 ? Number(rate) : 0.61;
    const end = todayISO();
    const out = [];
    for (let i = 179; i >= 0; i -= 1) {
      const drift = (179 - i) * 0.00002;
      const wave = Math.sin((179 - i) / 13) * 0.006;
      out.push({ date: addDaysISO(end, -i), rate: Math.max(0.01, base - 0.003 + drift + wave) });
    }
    out[out.length - 1].rate = base;
    return out;
  }

  function normalizeAudEurRows(rows) {
    return (Array.isArray(rows) ? rows : [])
      .map((row) => ({ date: row?.date || row?.as_of || null, rate: Number(row?.rate) }))
      .filter((row) => row.date && Number.isFinite(row.rate) && row.rate > 0)
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }

  function readHistoryCache() {
    try {
      const parsed = JSON.parse(localStorage.getItem(LS.historyCache) || "null");
      const rows = normalizeAudEurRows(parsed?.rows);
      if (rows.length >= 20) return { rows, source: "cache" };
    } catch (_) {}
    return null;
  }

  function writeHistoryCache(rows) {
    try {
      localStorage.setItem(LS.historyCache, JSON.stringify({ asOf: todayISO(), rows: normalizeAudEurRows(rows) }));
    } catch (_) {}
  }

  async function fetchAudEurHistoryFromDb() {
    if (!window.sb?.from) return null;
    const end = todayISO();
    const start = addDaysISO(end, -180);
    const { data, error } = await window.sb
      .from(TB_CONST.TABLES.fx_rates)
      .select("as_of,base,rates,source")
      .eq("base", "EUR")
      .gte("as_of", start)
      .order("as_of", { ascending: true });
    if (error || !Array.isArray(data)) return null;
    const rows = normalizeAudEurRows(data.map((row) => {
      const audPerEur = Number(row?.rates?.AUD);
      return { date: row?.as_of, rate: audPerEur > 0 ? 1 / audPerEur : null };
    }));
    if (rows.length >= 60) return { rows, source: "db" };
    return null;
  }

  async function fetchAudEurHistoryFromMarket() {
    const end = todayISO();
    const start = addDaysISO(end, -180);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    try {
      const res = await fetch(`https://api.frankfurter.dev/v1/${start}..${end}?base=AUD&symbols=EUR`, {
        signal: controller.signal,
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const rows = normalizeAudEurRows(Object.entries(json?.rates || {})
        .map(([date, row]) => ({ date, rate: Number(row?.EUR) }))
      );
      if (rows.length < 20) throw new Error("history_too_short");
      return { rows, source: "frankfurter" };
    } finally {
      clearTimeout(timer);
    }
  }

  async function fetchAudEurHistory() {
    let fromDb = null;
    try { fromDb = await fetchAudEurHistoryFromDb(); } catch (_) { fromDb = null; }
    if (fromDb?.rows?.length) return fromDb;
    try {
      const fromMarket = await fetchAudEurHistoryFromMarket();
      writeHistoryCache(fromMarket.rows);
      return fromMarket;
    } catch (e) {
      const cached = readHistoryCache();
      if (cached) return cached;
      throw e;
    }
  }

  function sparkline(rows) {
    const list = Array.isArray(rows) ? rows : [];
    if (list.length < 2) return "";
    const values = list.map((r) => Number(r.rate)).filter(Number.isFinite);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = Math.max(0.000001, max - min);
    const width = 640;
    const height = 140;
    const points = list.map((row, idx) => {
      const x = (idx / Math.max(1, list.length - 1)) * width;
      const y = height - ((Number(row.rate) - min) / span) * (height - 12) - 6;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
    return `
      <div id="tb-fx-decision-chart" style="position:relative;">
      <svg id="tb-fx-decision-chart-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" style="width:100%;height:150px;display:block;touch-action:none;">
        <defs>
          <linearGradient id="tbFxDecisionLine" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stop-color="#0ea5e9"/>
            <stop offset="100%" stop-color="#7c3aed"/>
          </linearGradient>
        </defs>
        <polyline points="${points}" fill="none" stroke="url(#tbFxDecisionLine)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></polyline>
        <line id="tb-fx-decision-chart-line" x1="0" x2="0" y1="0" y2="${height}" stroke="rgba(15,23,42,.28)" stroke-width="1.5" style="display:none;"></line>
        <circle id="tb-fx-decision-chart-dot" cx="0" cy="0" r="5" fill="#111827" stroke="#fff" stroke-width="2" style="display:none;"></circle>
        <rect width="${width}" height="${height}" fill="transparent"></rect>
      </svg>
      <div id="tb-fx-decision-chart-tip" style="display:none;position:absolute;z-index:3;pointer-events:none;background:#111827;color:#fff;border-radius:10px;padding:7px 9px;font-size:12px;font-weight:800;box-shadow:0 10px 30px rgba(15,23,42,.2);white-space:nowrap;"></div>
      </div>
    `;
  }

  function bindChartTooltip(host, rows) {
    const list = normalizeAudEurRows(rows);
    if (list.length < 2) return;
    const svg = host.querySelector("#tb-fx-decision-chart-svg");
    const tip = host.querySelector("#tb-fx-decision-chart-tip");
    const dot = host.querySelector("#tb-fx-decision-chart-dot");
    const line = host.querySelector("#tb-fx-decision-chart-line");
    if (!svg || !tip || !dot || !line) return;
    const values = list.map((r) => Number(r.rate)).filter(Number.isFinite);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = Math.max(0.000001, max - min);
    const width = 640;
    const height = 140;
    const move = (ev) => {
      const rect = svg.getBoundingClientRect();
      if (!rect.width) return;
      const ratio = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
      const idx = Math.max(0, Math.min(list.length - 1, Math.round(ratio * (list.length - 1))));
      const row = list[idx];
      const x = (idx / Math.max(1, list.length - 1)) * width;
      const y = height - ((Number(row.rate) - min) / span) * (height - 12) - 6;
      line.setAttribute("x1", String(x));
      line.setAttribute("x2", String(x));
      line.style.display = "";
      dot.setAttribute("cx", String(x));
      dot.setAttribute("cy", String(y));
      dot.style.display = "";
      tip.textContent = `${row.date} - 1 AUD = ${Number(row.rate).toFixed(4)} EUR`;
      tip.style.display = "block";
      const tipX = Math.min(Math.max(8, ev.clientX - rect.left + 12), Math.max(8, rect.width - tip.offsetWidth - 8));
      tip.style.left = `${tipX}px`;
      tip.style.top = `${Math.max(8, y * (rect.height / height) - 34)}px`;
    };
    const leave = () => {
      tip.style.display = "none";
      dot.style.display = "none";
      line.style.display = "none";
    };
    svg.onmousemove = move;
    svg.onmouseleave = leave;
    svg.ontouchmove = (ev) => {
      if (ev.touches?.[0]) move(ev.touches[0]);
    };
    svg.ontouchend = leave;
  }

  function actionLabel(action) {
    if (action === "convert") return T("fxdecision.action.convert");
    if (action === "convert_partial") return T("fxdecision.action.convert_partial");
    if (action === "convert_small") return T("fxdecision.action.convert_small");
    return T("fxdecision.action.hold");
  }

  function confidenceLabel(level) {
    if (level === "high") return T("fxdecision.confidence.high");
    if (level === "low") return T("fxdecision.confidence.low");
    return T("fxdecision.confidence.medium");
  }

  function confidenceTone(level) {
    if (level === "high") return { bg: "rgba(16,185,129,.12)", border: "rgba(16,185,129,.28)", color: "#047857" };
    if (level === "low") return { bg: "rgba(245,158,11,.14)", border: "rgba(245,158,11,.32)", color: "#b45309" };
    return { bg: "rgba(14,165,233,.12)", border: "rgba(14,165,233,.28)", color: "#0369a1" };
  }

  function currentRateFromRows(rows) {
    const list = normalizeAudEurRows(rows);
    return Number(list[list.length - 1]?.rate) > 0 ? Number(list[list.length - 1].rate) : currentAudEurRate();
  }

  function readDecisionInputs(rows) {
    const weeklyIncomeAud = Math.max(0, readNumber(LS.weeklyIncome, 1200));
    const rate = currentRateFromRows(rows) || 0;
    const mode = readText(LS.scaleMode, "percent") === "amount" ? "amount" : "percent";
    const horizonDays = readHorizonDays();
    const weeklyIncomeEur = weeklyIncomeAud * rate;
    const defaultNeedAmount = weeklyIncomeEur * readNumber(LS.eurNeed, 0.5);
    const defaultSafetyAmount = weeklyIncomeAud * readNumber(LS.audSafety, 0.35);
    const eurNeedAmount = Math.max(0, readNumber(LS.eurNeedAmount, defaultNeedAmount));
    const audSafetyAmount = Math.max(0, readNumber(LS.audSafetyAmount, defaultSafetyAmount));
    const eurNeedRatio = mode === "amount" && weeklyIncomeEur > 0
      ? clamp01(eurNeedAmount / weeklyIncomeEur)
      : clamp01(readNumber(LS.eurNeed, 0.5));
    const localAudSafetyRatio = mode === "amount" && weeklyIncomeAud > 0
      ? clamp01(audSafetyAmount / weeklyIncomeAud)
      : clamp01(readNumber(LS.audSafety, 0.35));
    return { weeklyIncomeAud, mode, horizonDays, rate, weeklyIncomeEur, eurNeedAmount, audSafetyAmount, eurNeedRatio, localAudSafetyRatio };
  }

  function buildRecommendationExplanation(decision, inputs) {
    const metrics = decision.metrics || {};
    const pos90 = Number(metrics.positionHorizon ?? metrics.position90 ?? 0);
    const trend = Number(metrics.trendRatio || 0);
    const volatility = Number(metrics.volatilityHorizon ?? metrics.volatility90 ?? 0);
    const parts = [];
    if (pos90 >= 0.01) parts.push(T("fxdecision.reason.rate_strong", { percent: (pos90 * 100).toFixed(2), days: inputs.horizonDays || 90 }));
    else if (pos90 <= -0.01) parts.push(T("fxdecision.reason.rate_weak", { percent: Math.abs(pos90 * 100).toFixed(2), days: inputs.horizonDays || 90 }));
    else parts.push(T("fxdecision.reason.rate_neutral"));
    if (trend > 0.00008) parts.push(T("fxdecision.reason.trend_up"));
    else if (trend < -0.00008) parts.push(T("fxdecision.reason.trend_down"));
    else parts.push(T("fxdecision.reason.trend_flat"));
    if (inputs.eurNeedRatio >= 0.65) parts.push(T("fxdecision.reason.eur_need_high"));
    else if (inputs.eurNeedRatio <= 0.25) parts.push(T("fxdecision.reason.eur_need_low"));
    if (inputs.localAudSafetyRatio >= 0.6) parts.push(T("fxdecision.reason.aud_safety_high"));
    if (inputs.mode === "amount") parts.push(T("fxdecision.reason.target_hold", { amount: money(inputs.audSafetyAmount || 0, "AUD") }));
    if (volatility >= 0.03) parts.push(T("fxdecision.reason.volatility", { percent: (volatility * 100).toFixed(2) }));
    return parts;
  }

  function renderCard(host, decision, rows, source, inputs) {
    const metrics = decision.metrics || {};
    const rate = decision.currentRate;
    const sourceLabel = source === "db" ? T("fxdecision.source.db") : source === "frankfurter" ? T("fxdecision.source.market") : source === "cache" ? T("fxdecision.source.cache") : T("fxdecision.source.local");
    const sourceTone = source === "db" || source === "frankfurter" ? "rgba(16,185,129,.12)" : source === "cache" ? "rgba(14,165,233,.12)" : "rgba(245,158,11,.14)";
    const sourceBorder = source === "db" || source === "frankfurter" ? "rgba(16,185,129,.28)" : source === "cache" ? "rgba(14,165,233,.28)" : "rgba(245,158,11,.32)";
    const trendPct = Number(metrics.trendRatio || 0) * 100;
    const pos90Pct = Number(metrics.positionHorizon ?? metrics.position90 ?? 0) * 100;
    const volPct = Number(metrics.volatilityHorizon ?? metrics.volatility90 ?? 0) * 100;
    const weeklyIncomeEur = Number(decision.currentEur || 0);
    const convertAud = Number(decision.convertAud || 0);
    const convertEur = Number(decision.convertEur || 0);
    const holdAud = Number(decision.holdAud || 0);
    const holdEur = rate ? holdAud * rate : 0;
    const confidence = decision.confidence || { level: "medium", score: 55 };
    const confidenceStyle = confidenceTone(confidence.level);
    const effectiveInputs = inputs || readDecisionInputs(rows);
    const chartRows = normalizeAudEurRows(rows).slice(-effectiveInputs.horizonDays);
    const coverageStart = chartRows[0]?.date || rows[0]?.date || "";
    const coverageEnd = chartRows[chartRows.length - 1]?.date || rows[rows.length - 1]?.date || "";
    const countHorizon = chartRows.length;
    const scaleMode = effectiveInputs.mode === "amount" ? "amount" : "percent";
    const reasonParts = buildRecommendationExplanation(decision, effectiveInputs);
    const needPercent = Math.round(effectiveInputs.eurNeedRatio * 100);
    const safetyPercent = Math.round(effectiveInputs.localAudSafetyRatio * 100);
    const controlsHtml = scaleMode === "amount" ? `
          <div class="field">
            <label>${esc(T("fxdecision.eur_need_amount"))}</label>
            <input id="tb-fx-decision-eur-need-amount" type="number" min="0" step="10" value="${esc(Math.round(effectiveInputs.eurNeedAmount || 0))}" />
            <div class="muted" style="font-size:12px;margin-top:4px;">${esc(T("fxdecision.equivalent_percent", { percent: needPercent }))}</div>
          </div>
          <div class="field">
            <label>${esc(T("fxdecision.aud_hold_amount"))}</label>
            <input id="tb-fx-decision-aud-safety-amount" type="number" min="0" step="50" value="${esc(Math.round(effectiveInputs.audSafetyAmount || 0))}" />
            <div class="muted" style="font-size:12px;margin-top:4px;">${esc(T("fxdecision.equivalent_percent", { percent: safetyPercent }))}</div>
          </div>
    ` : `
          <div class="field">
            <label>${esc(T("fxdecision.eur_need"))} <span class="muted">${needPercent}%</span></label>
            <input id="tb-fx-decision-eur-need" type="range" min="0" max="100" step="5" value="${needPercent}" />
          </div>
          <div class="field">
            <label>${esc(T("fxdecision.aud_safety"))} <span class="muted">${safetyPercent}%</span></label>
            <input id="tb-fx-decision-aud-safety" type="range" min="0" max="100" step="5" value="${safetyPercent}" />
          </div>
    `;

    host.innerHTML = `
      <section class="card" style="margin-top:12px;overflow:hidden;">
        <div style="display:flex;justify-content:space-between;gap:14px;align-items:flex-start;flex-wrap:wrap;">
          <div style="min-width:260px;flex:1;">
            <div class="muted" style="font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;">${esc(T("fxdecision.kicker"))}</div>
            <h2 style="margin:4px 0 6px 0;">${esc(T("fxdecision.title"))}</h2>
            <div class="muted">${esc(T("fxdecision.subtitle"))}</div>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
            <span class="pill" style="background:${sourceTone};border:1px solid ${sourceBorder};">${esc(sourceLabel)}</span>
            <button class="btn" type="button" id="tb-fx-decision-refresh">${esc(T("fxdecision.refresh"))}</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:minmax(0,1.4fr) minmax(280px,.8fr);gap:16px;margin-top:14px;">
          <div style="min-width:0;">
            <div style="border:1px solid rgba(0,0,0,.08);border-radius:12px;padding:10px;background:rgba(248,250,252,.72);">
              ${sparkline(chartRows)}
              <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;" class="muted">
                <span>${esc(coverageStart)}</span>
                <span>${esc(T("fxdecision.chart_hint"))}</span>
                <span>${esc(coverageEnd)}</span>
              </div>
            </div>
            <div class="muted" style="font-size:12px;margin-top:8px;">${esc(T("fxdecision.coverage", { count: rows.length, count90: countHorizon, countHorizon, days: effectiveInputs.horizonDays, start: coverageStart, end: coverageEnd }))}</div>
          </div>

          <div style="display:grid;gap:10px;">
            <div style="border:1px solid rgba(0,0,0,.08);border-radius:12px;padding:12px;background:#fff;">
              <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">
                <div>
                  <div class="muted" style="font-size:12px;">${esc(T("fxdecision.recommendation"))}</div>
                  <div style="font-size:26px;font-weight:900;margin-top:4px;">${esc(actionLabel(decision.action))}</div>
                </div>
                <div class="pill" style="background:${confidenceStyle.bg};border:1px solid ${confidenceStyle.border};color:${confidenceStyle.color};font-weight:900;">${esc(confidenceLabel(confidence.level))}</div>
              </div>
              <div class="muted" style="margin-top:6px;">${esc(T("fxdecision.convert_percent", { percent: decision.convertPercent }))}</div>
              <div style="margin-top:10px;display:grid;gap:6px;">
                ${reasonParts.map((part) => `<div class="muted" style="font-size:12px;line-height:1.35;">${esc(part)}</div>`).join("")}
              </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
              <div style="border:1px solid rgba(0,0,0,.08);border-radius:12px;padding:10px;">
                <div class="muted" style="font-size:12px;">${esc(T("fxdecision.rate"))}</div>
                <strong>${rate ? rate.toFixed(4) : "--"} EUR</strong>
              </div>
              <div style="border:1px solid rgba(0,0,0,.08);border-radius:12px;padding:10px;">
                <div class="muted" style="font-size:12px;">${esc(T("fxdecision.score"))}</div>
                <strong>${decision.score}/100</strong>
              </div>
            </div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-top:12px;">
          <div class="field">
            <label>${esc(T("fxdecision.weekly_income"))}</label>
            <input id="tb-fx-decision-income" type="number" min="0" step="50" value="${esc(decision.weeklyIncomeAud)}" />
          </div>
          <div class="field">
            <label>${esc(T("fxdecision.scale_mode"))}</label>
            <select id="tb-fx-decision-scale-mode">
              <option value="percent"${scaleMode === "percent" ? " selected" : ""}>${esc(T("fxdecision.scale_percent"))}</option>
              <option value="amount"${scaleMode === "amount" ? " selected" : ""}>${esc(T("fxdecision.scale_amount"))}</option>
            </select>
          </div>
          <div class="field">
            <label>${esc(T("fxdecision.horizon"))}</label>
            <select id="tb-fx-decision-horizon">
              <option value="30"${effectiveInputs.horizonDays === 30 ? " selected" : ""}>${esc(T("fxdecision.horizon_30"))}</option>
              <option value="60"${effectiveInputs.horizonDays === 60 ? " selected" : ""}>${esc(T("fxdecision.horizon_60"))}</option>
              <option value="90"${effectiveInputs.horizonDays === 90 ? " selected" : ""}>${esc(T("fxdecision.horizon_90"))}</option>
              <option value="180"${effectiveInputs.horizonDays === 180 ? " selected" : ""}>${esc(T("fxdecision.horizon_180"))}</option>
            </select>
          </div>
          ${controlsHtml}
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-top:12px;">
          <div class="pill" style="justify-content:space-between;align-items:flex-start;border-radius:10px;"><span>${esc(T("fxdecision.if_all"))}</span><strong style="text-align:right;">${esc(money(decision.weeklyIncomeAud || 0, "AUD"))}<br>${esc(money(weeklyIncomeEur, "EUR"))}</strong></div>
          <div class="pill" style="justify-content:space-between;align-items:flex-start;border-radius:10px;"><span>${esc(T("fxdecision.convert_now"))}</span><strong style="text-align:right;">${esc(money(convertAud, "AUD"))}<br>${esc(money(convertEur, "EUR"))}</strong></div>
          <div class="pill" style="justify-content:space-between;align-items:flex-start;border-radius:10px;"><span>${esc(T("fxdecision.keep_aud"))}</span><strong style="text-align:right;">${esc(money(holdAud, "AUD"))}<br>${esc(money(holdEur, "EUR"))}</strong></div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin-top:12px;">
          <div style="border:1px solid rgba(0,0,0,.08);border-radius:12px;padding:12px;background:rgba(248,250,252,.72);">
            <div class="muted" style="font-size:12px;font-weight:800;text-transform:uppercase;">${esc(T("fxdecision.scenario.keep_all"))}</div>
            <strong style="display:block;margin-top:6px;">${esc(money(decision.weeklyIncomeAud || 0, "AUD"))}</strong>
            <div class="muted" style="font-size:12px;margin-top:4px;">${esc(T("fxdecision.scenario.eur_now", { amount: money(weeklyIncomeEur, "EUR") }))}</div>
          </div>
          <div style="border:1px solid rgba(0,0,0,.08);border-radius:12px;padding:12px;background:rgba(236,253,245,.72);">
            <div class="muted" style="font-size:12px;font-weight:800;text-transform:uppercase;">${esc(T("fxdecision.scenario.convert_now"))}</div>
            <strong style="display:block;margin-top:6px;">${esc(money(convertAud, "AUD"))}</strong>
            <div class="muted" style="font-size:12px;margin-top:4px;">${esc(T("fxdecision.scenario.receive_eur", { amount: money(convertEur, "EUR") }))}</div>
          </div>
          <div style="border:1px solid rgba(0,0,0,.08);border-radius:12px;padding:12px;background:rgba(239,246,255,.72);">
            <div class="muted" style="font-size:12px;font-weight:800;text-transform:uppercase;">${esc(T("fxdecision.scenario.after"))}</div>
            <strong style="display:block;margin-top:6px;">${esc(money(holdAud, "AUD"))}</strong>
            <div class="muted" style="font-size:12px;margin-top:4px;">${esc(T("fxdecision.scenario.eur_now", { amount: money(holdEur, "EUR") }))}</div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px;margin-top:12px;" class="muted">
          <span>${esc(T("fxdecision.avg30"))}: <strong>${Number(metrics.avg30 || 0).toFixed(4)}</strong></span>
          <span>${esc(T("fxdecision.avg_horizon", { days: effectiveInputs.horizonDays }))}: <strong>${Number(metrics.avgHorizon || metrics.avg90 || 0).toFixed(4)}</strong></span>
          <span>${esc(T("fxdecision.pos_horizon", { days: effectiveInputs.horizonDays }))}: <strong>${pos90Pct.toFixed(2)}%</strong></span>
          <span>${esc(T("fxdecision.trend"))}: <strong>${trendPct.toFixed(3)}%</strong></span>
          <span>${esc(T("fxdecision.volatility"))}: <strong>${volPct.toFixed(2)}%</strong></span>
        </div>

        <div class="muted" style="font-size:12px;margin-top:10px;">${esc(T("fxdecision.disclaimer"))}</div>
      </section>
    `;
    bindChartTooltip(host, chartRows);

    const rerender = () => {
      const income = Number(document.getElementById("tb-fx-decision-income")?.value || 1200);
      const mode = document.getElementById("tb-fx-decision-scale-mode")?.value === "amount" ? "amount" : "percent";
      const horizon = Number(document.getElementById("tb-fx-decision-horizon")?.value || readHorizonDays());
      const rateNow = currentRateFromRows(rows) || 0;
      writeNumber(LS.weeklyIncome, income);
      writeText(LS.scaleMode, mode);
      writeNumber(LS.horizonDays, horizon);
      if (mode === "amount") {
        const needEl = document.getElementById("tb-fx-decision-eur-need-amount");
        const safetyEl = document.getElementById("tb-fx-decision-aud-safety-amount");
        const needFromPercent = income * rateNow * (Number(document.getElementById("tb-fx-decision-eur-need")?.value || Math.round(readNumber(LS.eurNeed, 0.5) * 100)) / 100);
        const safetyFromPercent = income * (Number(document.getElementById("tb-fx-decision-aud-safety")?.value || Math.round(readNumber(LS.audSafety, 0.35) * 100)) / 100);
        writeNumber(LS.eurNeedAmount, needEl ? Number(needEl.value || 0) : needFromPercent);
        writeNumber(LS.audSafetyAmount, safetyEl ? Number(safetyEl.value || 0) : safetyFromPercent);
      } else {
        const needEl = document.getElementById("tb-fx-decision-eur-need");
        const safetyEl = document.getElementById("tb-fx-decision-aud-safety");
        const needFromAmount = income * rateNow > 0 ? readNumber(LS.eurNeedAmount, income * rateNow * 0.5) / (income * rateNow) : 0.5;
        const safetyFromAmount = income > 0 ? readNumber(LS.audSafetyAmount, income * 0.35) / income : 0.35;
        writeNumber(LS.eurNeed, needEl ? Number(needEl.value || 50) / 100 : clamp01(needFromAmount));
        writeNumber(LS.audSafety, safetyEl ? Number(safetyEl.value || 35) / 100 : clamp01(safetyFromAmount));
        writeNumber(LS.eurNeedAmount, income * rateNow * readNumber(LS.eurNeed, 0.5));
        writeNumber(LS.audSafetyAmount, income * readNumber(LS.audSafety, 0.35));
      }
      const nextInputs = readDecisionInputs(rows);
      const next = window.Core.fxDecisionRules.computeFxDecision({
        rates: rows,
        weeklyIncomeAud: nextInputs.weeklyIncomeAud,
        eurNeedRatio: nextInputs.eurNeedRatio,
        localAudSafetyRatio: nextInputs.localAudSafetyRatio,
        targetHoldAud: nextInputs.mode === "amount" ? nextInputs.audSafetyAmount : null,
        horizonDays: nextInputs.horizonDays,
      });
      renderCard(host, next, rows, source, nextInputs);
    };

    ["tb-fx-decision-income", "tb-fx-decision-scale-mode", "tb-fx-decision-horizon", "tb-fx-decision-eur-need", "tb-fx-decision-aud-safety", "tb-fx-decision-eur-need-amount", "tb-fx-decision-aud-safety-amount"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.onchange = rerender;
        el.oninput = id === "tb-fx-decision-eur-need" || id === "tb-fx-decision-aud-safety" ? rerender : null;
      }
    });
    const refresh = document.getElementById("tb-fx-decision-refresh");
    if (refresh) refresh.onclick = () => renderFxDecision(true);
  }

  async function renderFxDecision(force) {
    if (!window.Core?.fxDecisionRules) return;
    const dashHost = document.querySelector("#view-dashboard #tb-fx-decision");
    if (dashHost) dashHost.remove();
    const analysis = document.getElementById("view-analysis");
    if (!analysis) return;
    let host = document.getElementById("tb-fx-decision");
    if (!host) {
      host = document.createElement("div");
      host.id = "tb-fx-decision";
      const after = analysis.querySelector(".analysis-main-grid") || document.getElementById("analysis-summary") || document.getElementById("analysis-overview-strip") || analysis.querySelector(".analysis-hero");
      if (after?.parentElement) after.parentElement.insertBefore(host, after.nextSibling);
      else analysis.appendChild(host);
    }

    if (!force && host.dataset.ready === "1") return;
    host.dataset.ready = "1";
    host.innerHTML = `<section class="card" style="margin-top:12px;"><div class="muted">${esc(T("common.loading"))}</div></section>`;

    let source = "local";
    let rows = [];
    try {
      const fetched = await fetchAudEurHistory();
      rows = fetched.rows;
      source = fetched.source;
    } catch (e) {
      rows = fallbackSeries(currentAudEurRate());
      source = "local";
    }

    const inputs = readDecisionInputs(rows);
    const decision = window.Core.fxDecisionRules.computeFxDecision({
      rates: rows,
      weeklyIncomeAud: inputs.weeklyIncomeAud,
      eurNeedRatio: inputs.eurNeedRatio,
      localAudSafetyRatio: inputs.localAudSafetyRatio,
      targetHoldAud: inputs.mode === "amount" ? inputs.audSafetyAmount : null,
      horizonDays: inputs.horizonDays,
    });
    renderCard(host, decision, rows, source, inputs);
  }

  window.renderFxDecision = renderFxDecision;

  try {
    window.tbOnLangChange = window.tbOnLangChange || [];
    if (!window.__tbFxDecisionLangBound) {
      window.__tbFxDecisionLangBound = true;
      window.tbOnLangChange.push(() => {
        try {
          if ((typeof activeView === "string" ? activeView : "") !== "analysis") return;
          const host = document.getElementById("tb-fx-decision");
          if (host) host.dataset.ready = "0";
          if (typeof window.renderFxDecision === "function") window.renderFxDecision(false);
        } catch (_) {}
      });
    }
  } catch (_) {}
})();
