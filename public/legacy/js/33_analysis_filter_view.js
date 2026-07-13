(function () {
  function esc(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  function tr(t, key) {
    return typeof t === 'function' ? t(key) : key;
  }
  function num(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  function renderCategoryFilterOptions({ categories = [], t, normalizeKey } = {}) {
    const norm = typeof normalizeKey === 'function' ? normalizeKey : (value) => String(value || '').trim().toLowerCase();
    const rows = (Array.isArray(categories) ? categories : [])
      .filter((cat) => norm(cat) !== 'revenu')
      .map((cat) => `<option value="${esc(cat)}">${esc(cat)}</option>`)
      .join('');
    return `<option value="all">${esc(tr(t, 'common.all'))}</option><option value="__income">${esc(tr(t, 'analysis.filter.income'))}</option>${rows}`;
  }
  function renderSubcategoryFilterOptions({ subcategories = [], t } = {}) {
    const rows = (Array.isArray(subcategories) ? subcategories : [])
      .map((sub) => `<option value="${esc(sub)}">${esc(sub)}</option>`)
      .join('');
    return `<option value="all">${esc(tr(t, 'common.all'))}</option><option value="__none__">${esc(tr(t, 'analysis.filter.no_subcategory'))}</option>${rows}`;
  }
  function renderPeriodFilterOptions({ periods = [], activeLabel = 'Période active' } = {}) {
    const rows = (Array.isArray(periods) ? periods : []).map((period, idx) => {
      const id = String(period?.id ?? '');
      const start = String(period?.start ?? '');
      const end = String(period?.end ?? '');
      const base = String(period?.base ?? '').trim().toUpperCase();
      const label = `Période ${idx + 1} • ${start} → ${end}${base ? ' • ' + base : ''}`;
      return `<option value="${esc(id)}">${esc(label)}</option>`;
    }).join('');
    return `<option value="active">${esc(activeLabel)}</option><option value="all">Tout le voyage</option>${rows}<option value="range">Date à date</option>`;
  }
  function buildCategoryExcludeSummary({ total = 0, count = 0 } = {}) {
    const safeTotal = Math.max(0, Math.round(num(total)));
    const safeCount = Math.max(0, Math.round(num(count)));
    if (!safeCount) return safeTotal ? `Aucune catégorie exclue • ${safeTotal} catégories disponibles` : 'Aucune catégorie';
    const included = Math.max(safeTotal - safeCount, 0);
    return `${safeCount} catégorie${safeCount > 1 ? 's' : ''} exclue${safeCount > 1 ? 's' : ''} • ${included} incluse${included > 1 ? 's' : ''}`;
  }
  function renderCategoryExcludeChips({ categories = [], excluded = [] } = {}) {
    const excludedSet = new Set((Array.isArray(excluded) ? excluded : []).map((value) => String(value || '').trim()).filter(Boolean));
    return (Array.isArray(categories) ? categories : []).map((cat) => {
      const name = String(cat || '').trim();
      if (!name) return '';
      const isExcluded = excludedSet.has(name);
      return `<button type="button" class="analysis-chip${isExcluded ? ' is-excluded' : ''}" data-cat="${esc(name)}"><span class="analysis-chip-dot"></span>${esc(name)}</button>`;
    }).join('');
  }
  window.TBAnalysisFilterView = {
    ...(window.TBAnalysisFilterView || {}),
    buildCategoryExcludeSummary,
    renderCategoryExcludeChips,
    renderCategoryFilterOptions,
    renderPeriodFilterOptions,
    renderSubcategoryFilterOptions,
  };
})();
