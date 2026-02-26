/* =========================
   Charts
   ========================= */

// Pie (expenses by category) filtering (local-only)
// - Default excludes "Mouvement interne"
// - User can toggle categories directly from the pie legend UI
const PIE_EXCLUDED_CATS_KEY = "travelbudget_pie_excluded_categories_v1";

function _normCat(s) {
  return String(s || "").trim().toLowerCase();
}

function getPieExcludedCats() {
  try {
    const raw = localStorage.getItem(PIE_EXCLUDED_CATS_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set(arr.map(_normCat).filter(Boolean));
    }
  } catch (_) {}
  // default: exclude internal movements
  return new Set([_normCat("Mouvement interne")]);
}

function setPieExcludedCats(setNormCats) {
  try {
    localStorage.setItem(PIE_EXCLUDED_CATS_KEY, JSON.stringify(Array.from(setNormCats || [])));
  } catch (_) {}
}

function getBudgetSeries() {
  const __k = TB_CHART_CACHE.key("line");
  const __cached = TB_CHART_CACHE.get(__k);
  if (__cached) return __cached;
  const __out = (function(){

  const start = parseISODateOrNull(state.period.start);
  const end = parseISODateOrNull(state.period.end);
  if (!start || !end) return [];
  const series = [];

  const segs = Array.isArray(state.budgetSegments) ? state.budgetSegments : [];
  const distinctBases = new Set(segs.map(s => String(s?.baseCurrency || "").toUpperCase()).filter(Boolean));
  const multiBase = distinctBases.size > 1;

  const outBase = multiBase
    ? "EUR"
    : (distinctBases.size === 1 ? Array.from(distinctBases)[0] : (state.period.baseCurrency || "EUR"));

  // Attach metadata to the returned array (used by chart labeling).
  series.__base = outBase;

  forEachDateInclusive(start, end, (d) => {
    const ds = toLocalISODate(d);
    const y = (multiBase && typeof getDailyBudgetForDateEUR === "function")
      ? getDailyBudgetForDateEUR(ds)
      : getDailyBudgetForDate(ds);
    series.push({ x: ds, y });
  });

  return series;

  })();
  return TB_CHART_CACHE.set(__k, __out);
}

function getExpenseByCategoryBase() {
  const __k = TB_CHART_CACHE.key("pie");
  const __cached = TB_CHART_CACHE.get(__k);
  if (__cached) return __cached;
  const __out = (function(){

  // Pie = expenses by category within active period.
  // If segments use multiple base currencies, aggregate in EUR to stay consistent.
  const start = parseISODateOrNull(state.period.start);
  const end = parseISODateOrNull(state.period.end);
  const map = new Map();
  if (!start || !end) return map;

  const segs = Array.isArray(state.budgetSegments) ? state.budgetSegments : [];
  const distinctBases = new Set(segs.map(s => String(s?.baseCurrency || "").toUpperCase()).filter(Boolean));
  const multiBase = distinctBases.size > 1;

  // Currency used for pie values/labels
  const outBase = multiBase
    ? "EUR"
    : (distinctBases.size === 1 ? Array.from(distinctBases)[0] : (state.period.baseCurrency || "EUR"));

  // Meta used by drawPieChart() for labels
  map.__base = outBase;

  for (const tx of state.transactions) {
    if (tx.type !== "expense") continue;

    // Default: only include paid-now expenses in the pie (cash view).
    if (tx.payNow === false) continue;

    const dateRaw = tx.dateStart || tx.date || tx.date_end || tx.dateEnd;
    const d = parseISODateOrNull(dateRaw);
    if (!d || d < start || d > end) continue;

    let amt;

    if (outBase === "EUR") {
      // Aggregate to EUR (stable pivot)
      if (typeof window.fxConvert === "function") {
        const rates = (typeof window.fxGetEurRates === "function") ? window.fxGetEurRates() : {};
        const out = window.fxConvert(tx.amount, tx.currency, "EUR", rates);
        amt = (out !== null && isFinite(out)) ? out : amountToEUR(tx.amount, tx.currency);
      } else {
        amt = amountToEUR(tx.amount, tx.currency);
      }
    } else {
      // Aggregate to legacy base
      amt = amountToBase(tx.amount, tx.currency);
    }

    const k = (tx.category || "Autre").trim();
    map.set(k, (map.get(k) || 0) + (Number(amt) || 0));
  }

  return map;

  })();
  return TB_CHART_CACHE.set(__k, __out);
}

function drawLineChart(canvasId, series) {
  const c = document.getElementById(canvasId);
  if (!c) return;
  const ctx = c.getContext("2d");

  const dpr = window.devicePixelRatio || 1;
  const cssW = c.clientWidth || 900;
  const cssH = 260;
  c.style.height = cssH + "px";
  c.width = Math.floor(cssW * dpr);
  c.height = Math.floor(cssH * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  ctx.clearRect(0, 0, cssW, cssH);

  const pad = { l: 46, r: 16, t: 14, b: 28 };
  const W = cssW, H = cssH;

  ctx.fillStyle = "rgba(255,255,255,0.03)";
  ctx.fillRect(0, 0, W, H);

  if (!series.length) {
    ctx.fillStyle = "rgba(127,127,127,0.8)";
    ctx.fillText("Aucune donnée", pad.l, pad.t + 20);
    return;
  }

  const ys = series.map((p) => p.y);
  let yMin = Math.min(...ys), yMax = Math.max(...ys);
  if (yMin === yMax) { yMin -= 1; yMax += 1; }

  const xCount = series.length;
  const plotW = W - pad.l - pad.r;
  const plotH = H - pad.t - pad.b;

  const xAt = (i) => pad.l + (xCount === 1 ? 0 : (i / (xCount - 1)) * plotW);
  const yAt = (v) => pad.t + (1 - (v - yMin) / (yMax - yMin)) * plotH;

  ctx.strokeStyle = cssVar("--gridline", "rgba(0,0,0,0.1)");
  ctx.lineWidth = 1;
  for (let k = 0; k <= 4; k++) {
    const y = pad.t + (k / 4) * plotH;
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
  }

  ctx.fillStyle = "rgba(127,127,127,0.9)";
  ctx.font = "12px system-ui";
  for (let k = 0; k <= 4; k++) {
    const v = yMax - (k / 4) * (yMax - yMin);
    const y = pad.t + (k / 4) * plotH;
    ctx.fillText(`${Math.round(v)}`, 8, y + 4);
  }

  ctx.strokeStyle = cssVar("--accent", "#2563eb");
  ctx.lineWidth = 2;
  ctx.beginPath();
  series.forEach((p, i) => {
    const x = xAt(i), y = yAt(p.y);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  ctx.fillStyle = cssVar("--good", "#16a34a");
  series.forEach((p, i) => {
    const x = xAt(i), y = yAt(p.y);
    ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
  });

  ctx.fillStyle = "rgba(127,127,127,0.9)";
  const idxs = [0, Math.floor((xCount - 1) / 2), xCount - 1].filter((v, i, a) => a.indexOf(v) === i);
  idxs.forEach((i) => {
    const x = xAt(i);
    ctx.fillText(series[i].x.slice(5), x - 16, H - 10);
  });

  const segs = Array.isArray(state.budgetSegments) ? state.budgetSegments : [];
  const distinctBases = new Set(segs.map(s => String(s?.baseCurrency || "").toUpperCase()).filter(Boolean));
  const baseLabel = (distinctBases.size > 1) ? "EUR" : (state.period.baseCurrency || "EUR");
  ctx.fillStyle = "rgba(127,127,127,0.95)";
  ctx.fillText(`Budget dispo (${baseLabel})`, pad.l, 14);
}

function drawPieChart(canvasId, legendId, mapCat) {
  const c = document.getElementById(canvasId);
  const legend = document.getElementById(legendId);
  if (!c || !legend) return;

  const ctx = c.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const cssW = c.clientWidth || 900;
  const cssH = 260;
  c.style.height = cssH + "px";
  c.width = Math.floor(cssW * dpr);
  c.height = Math.floor(cssH * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  ctx.clearRect(0, 0, cssW, cssH);
  ctx.fillStyle = "rgba(255,255,255,0.03)";
  ctx.fillRect(0, 0, cssW, cssH);

  const excluded = getPieExcludedCats();
  const allCats = Array.from(mapCat.keys()).map((k) => String(k || "Autre").trim());
  const allCatsSorted = Array.from(new Set(allCats)).sort((a, b) => a.localeCompare(b));

  // Filter UI (checkboxes)
  legend.innerHTML = "";

  // Context line (range + rules)
  const ctxLine = document.createElement("div");
  ctxLine.style.margin = "2px 0 8px";
  ctxLine.style.fontSize = "12px";
  ctxLine.style.color = "var(--muted)";
  const s0 = state?.period?.start || "";
  const e0 = state?.period?.end || "";
  ctxLine.textContent = `Période: ${s0} → ${e0} · Dépenses payées (payNow)`;
  legend.appendChild(ctxLine);

  const filterWrap = document.createElement("div");
  filterWrap.style.display = "flex";
  filterWrap.style.flexWrap = "wrap";
  filterWrap.style.gap = "8px";
  filterWrap.style.margin = "6px 0 10px";
  filterWrap.style.color = "var(--muted)";
  filterWrap.style.fontSize = "12px";
  const filterLabel = document.createElement("div");
  filterLabel.textContent = "Filtrer :";
  filterLabel.style.marginRight = "4px";
  filterWrap.appendChild(filterLabel);

  allCatsSorted.forEach((cat) => {
    const norm = _normCat(cat);
    const lb = document.createElement("label");
    lb.style.display = "inline-flex";
    lb.style.alignItems = "center";
    lb.style.gap = "6px";
    lb.style.padding = "4px 8px";
    lb.style.borderRadius = "999px";
    lb.style.border = "1px solid var(--border)";
    lb.style.background = "rgba(2,6,23,.04)";
    lb.style.cursor = "pointer";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = !excluded.has(norm);
    cb.onchange = () => {
      const ex = getPieExcludedCats();
      if (cb.checked) ex.delete(norm);
      else ex.add(norm);
      setPieExcludedCats(ex);
      redrawCharts();
    };

    const sw = document.createElement("span");
    sw.className = "swatch";
    sw.style.background = colorForCategory(cat);

    const txt = document.createElement("span");
    txt.textContent = cat;

    lb.appendChild(cb);
    lb.appendChild(sw);
    lb.appendChild(txt);
    filterWrap.appendChild(lb);
  });

  legend.appendChild(filterWrap);

  const entries = Array.from(mapCat.entries())
    .filter(([cat, v]) => v > 0 && !excluded.has(_normCat(cat)))
    .sort((a, b) => b[1] - a[1]);

  if (!entries.length) {
    ctx.fillStyle = "rgba(127,127,127,0.85)";
    ctx.fillText("Aucune dépense (filtre actif)", 16, 28);
    return;
  }

  const total = entries.reduce((s, [, v]) => s + v, 0);

  const cx = cssW * 0.32;
  const cy = cssH * 0.52;
  const r = Math.min(cssH * 0.38, cssW * 0.25);

  let start = -Math.PI / 2;
  const base = (mapCat && mapCat.__base) ? mapCat.__base : (state.period.baseCurrency || "EUR");

  entries.forEach(([cat, val]) => {
    const frac = val / total;
    const end = start + frac * 2 * Math.PI;
    const color = colorForCategory(cat);

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, start, end);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();

    const pct = (frac * 100).toFixed(1);
    const item = document.createElement("div");
    item.className = "legendItem";
    item.innerHTML = `<span class="swatch" style="background:${color}"></span>${cat} • ${Math.round(val)} ${base} • ${pct}%`;
    legend.appendChild(item);

    start = end;
  });

  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
  ctx.fillStyle = cssVar("--panel", "rgba(255,255,255,0.85)");
  ctx.fill();

  ctx.fillStyle = "rgba(127,127,127,0.9)";
  ctx.font = "12px system-ui";
  ctx.fillText("Total", cx - 14, cy - 6);
  ctx.font = "bold 14px system-ui";
  ctx.fillText(`${Math.round(total)} ${base}`, cx - 40, cy + 14);
}

function redrawCharts() {
  if (activeView !== "dashboard") return;
  if (redrawPending) return;
  redrawPending = true;

  const _do = () => {
    // Run on next frame to keep UI responsive
    requestAnimationFrame(() => {
      try {
        if (window.TB_PERF && TB_PERF.enabled) TB_PERF.mark("charts:redraw");
        drawLineChart("chart-budget", getBudgetSeries());
        drawPieChart("chart-pie", "pie-legend", getExpenseByCategoryBase());
        if (window.TB_PERF && TB_PERF.enabled) TB_PERF.end("charts:redraw");
      } finally {
        redrawPending = false;
      }
    });
  };

  // Heavy charts => idle coalescing (keeps TTI low)
  if (window.TB_DEFER && typeof TB_DEFER.coalesceIdle === "function") {
    TB_DEFER.coalesceIdle(_do, 900);
  } else {
    _do();
  }
}