const tooltipTheme = { backgroundColor: 'rgba(15,23,42,.92)', borderWidth: 0, textStyle: { color: '#fff' } };

function safeNum(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function defaultMoney(value, currency) {
  return `${safeNum(value).toFixed(2)} ${String(currency || '').trim()}`.trim();
}

function moneyFormatter(formatCurrency) {
  return typeof formatCurrency === 'function' ? formatCurrency : defaultMoney;
}

function themeValue(theme, key, fallback) {
  return String(theme?.[key] || fallback);
}

function linearGradient(stops) {
  return { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: stops };
}

function dateAxisLabels(days, theme) {
  const compact = days.at(0)?.slice(0, 4) === days.at(-1)?.slice(0, 4);
  return {
    color: themeValue(theme, 'muted', '#94a3b8'),
    hideOverlap: true,
    formatter: (date) => compact ? date.slice(5) : date,
  };
}

export function buildAnalysisTrajectoryMeta(model = {}) {
  const days = Array.isArray(model.days) ? model.days.length : 0;
  return {
    start: model.start || '-',
    end: model.end || '-',
    days,
    currency: String(model.base || '').toUpperCase(),
  };
}

export function buildAnalysisTrajectoryOption({
  model = {},
  todayDate = '',
  labels = {},
  theme = {},
  formatCurrency,
} = {}) {
  const fmt = moneyFormatter(formatCurrency);
  const { spent = 'Dépenses cumulées', target = 'Cible cumulée' } = labels;
  const days = Array.isArray(model.days) ? model.days : [];
  const cumTarget = Array.isArray(model.cumTarget) ? model.cumTarget : [];
  const cumSpent = Array.isArray(model.cumSpent) ? model.cumSpent : [];
  const accent = themeValue(theme, 'accent', '#3b82f6');
  const grid = themeValue(theme, 'grid', 'rgba(148,163,184,.18)');

  return {
    animationDuration: 900,
    animationEasing: 'cubicOut',
    tooltip: { trigger: 'axis', ...tooltipTheme },
    legend: { top: 6, textStyle: { color: themeValue(theme, 'muted', '#94a3b8'), fontSize: 11 }, itemWidth: 14, itemHeight: 8, data: [spent, target] },
    grid: { left: 24, right: 24, top: 52, bottom: 30, containLabel: true },
    xAxis: { type: 'category', boundaryGap: false, data: days, axisLine: { lineStyle: { color: grid } }, axisLabel: { ...dateAxisLabels(days, theme), fontSize: 10, margin: 8 } },
    yAxis: { type: 'value', axisLabel: { color: themeValue(theme, 'muted', '#94a3b8'), fontSize: 10, formatter: (v) => fmt(v, model.base) }, splitLine: { lineStyle: { color: grid } } },
    series: [
      {
        id: 'target', name: target,
        type: 'line',
        smooth: false,
        symbol: 'none',
        lineStyle: { width: 3, color: themeValue(theme, 'good', '#22c55e'), opacity: 0.95, type: 'dashed' },
        areaStyle: { color: 'transparent' },
        data: cumTarget,
        markLine: { symbol: 'none', lineStyle: { type: 'dashed', color: grid }, label: { show: false }, data: days.includes(todayDate) ? [{ xAxis: todayDate }] : [] },
      },
      {
        id: 'spent', name: spent,
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { width: 4, color: accent },
        areaStyle: { color: linearGradient([{ offset: 0, color: 'rgba(59,130,246,.34)' }, { offset: 1, color: 'rgba(59,130,246,.03)' }]) },
        emphasis: { focus: 'series' },
        data: cumSpent,
        markPoint: {
          symbol: 'circle',
          symbolSize: 16,
          itemStyle: { color: accent, shadowBlur: 18, shadowColor: 'rgba(59,130,246,.45)' },
          data: cumSpent.length ? [{ coord: [Math.max(0, days.length - 1), cumSpent[cumSpent.length - 1]] }] : [],
        },
      },
    ],
  };
}

export function buildAnalysisCategoryPieOption({
  model = {},
  groupedLabel = 'Autres catégories (groupées)',
  theme = {},
  formatCurrency,
} = {}) {
  const fmt = moneyFormatter(formatCurrency);
  const positive = (model.categorySeries || []).filter((row) => safeNum(row.actual) > 0);
  const data = positive.slice(0, 8).map(({ name, actual, color }) => ({
    name, value: safeNum(actual), itemStyle: { color },
  }));
  if (positive.length > 8) {
    data.push({
      name: groupedLabel, grouped: true,
      value: positive.slice(8).reduce((sum, row) => sum + safeNum(row.actual), 0),
      itemStyle: { color: themeValue(theme, 'muted', '#94a3b8') },
    });
  }

  return {
    animationDuration: 1000,
    tooltip: {
      trigger: 'item',
      ...tooltipTheme,
      renderMode: 'richText',
      formatter: (p) => `${p.name}\n${fmt(p.value, model.base)} • ${p.percent}%`,
    },
    series: [{
      type: 'pie',
      radius: ['34%', '78%'],
      center: ['50%', '56%'],
      avoidLabelOverlap: true,
      itemStyle: { borderRadius: 10, borderColor: 'rgba(255,255,255,.06)', borderWidth: 2 },
      label: { color: themeValue(theme, 'text', '#e5e7eb'), formatter: (p) => `${p.name}\n${p.percent}%`, fontWeight: 700 },
      labelLine: { length: 10, length2: 8 },
      data,
    }],
  };
}

export function buildAnalysisCategoryBarsOption({
  model = {},
  theme = {},
  formatCurrency,
} = {}) {
  const fmt = moneyFormatter(formatCurrency);
  const rows = (Array.isArray(model.categorySeries) ? [...model.categorySeries] : []).reverse();
  const muted = themeValue(theme, 'muted', '#94a3b8');
  const grid = themeValue(theme, 'grid', 'rgba(148,163,184,.18)');

  return {
    animationDuration: 900,
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      ...tooltipTheme,
      formatter: (p) => `${p?.[0]?.axisValue || ''}<br>${fmt(p?.[0]?.value || 0, model.base)}`,
    },
    grid: { left: 110, right: 20, top: 10, bottom: 20, containLabel: false },
    xAxis: { type: 'value', axisLabel: { color: muted, hideOverlap: true, formatter: (v) => fmt(v, model.base) }, splitLine: { lineStyle: { color: grid } } },
    yAxis: { type: 'category', data: rows.map((r) => r.name), axisLabel: { color: themeValue(theme, 'text', '#e5e7eb'), interval: 0, width: 100, overflow: 'truncate' } },
    series: [{
      name: 'Réel',
      type: 'bar',
      data: rows.map((r) => ({ value: Number(safeNum(r.actual).toFixed(2)), itemStyle: { color: r.color || themeValue(theme, 'accent', '#3b82f6'), borderRadius: [0, 10, 10, 0] } })),
      barMaxWidth: 18,
    }],
  };
}

export function buildAnalysisVelocityOption({
  model = {},
  labels = {},
  theme = {},
  formatCurrency,
} = {}) {
  const fmt = moneyFormatter(formatCurrency);
  const { spent = 'Dépenses du jour', target = 'Budget moyen/jour' } = labels;
  const days = Array.isArray(model.days) ? model.days : [];
  const velocity = Array.isArray(model.velocity) ? model.velocity : [];

  return {
    animationDuration: 900,
    tooltip: { trigger: 'axis', ...tooltipTheme },
    legend: { top: 6, textStyle: { color: themeValue(theme, 'muted', '#94a3b8'), fontSize: 11 }, data: [spent, target] },
    grid: { left: 18, right: 12, top: 54, bottom: 24, containLabel: true },
    xAxis: { type: 'category', data: days, axisLabel: dateAxisLabels(days, theme), axisLine: { lineStyle: { color: themeValue(theme, 'grid', 'rgba(148,163,184,.18)') } } },
    yAxis: { type: 'value', axisLabel: { color: themeValue(theme, 'muted', '#94a3b8'), formatter: (v) => fmt(v, model.base) }, splitLine: { lineStyle: { color: themeValue(theme, 'grid', 'rgba(148,163,184,.18)') } } },
    series: [
      { id: 'spent', name: spent, type: 'bar', barMaxWidth: 22, data: velocity, itemStyle: { borderRadius: [8, 8, 0, 0], color: linearGradient([{ offset: 0, color: themeValue(theme, 'accent', '#3b82f6') }, { offset: 1, color: 'rgba(59,130,246,.25)' }]) } },
      { id: 'target', name: target, type: 'line', smooth: true, symbol: 'none', data: days.map(() => Number(safeNum(model.budgetPerDay).toFixed(2))), lineStyle: { color: themeValue(theme, 'warn', '#f59e0b'), width: 2, type: 'dashed' } },
    ],
  };
}
