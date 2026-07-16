function defaultEsc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderSettingsCategoriesList({
  categories = [],
  colors = {},
  simpleMode = false,
  getSubRows = () => [],
  getMapping = () => ({}),
  getUsage = () => ({}),
  analyticSelectOptions = () => '',
  analyticStatusPillHtml = () => '',
  analyticUsagePillHtml = () => '',
  analyticFamilyLabel = (value) => value,
  esc = defaultEsc,
} = {}) {
  const cats = Array.isArray(categories) ? categories : [];
  const simpleNote = simpleMode
    ? '<div class="tb-simple-mode-note">Mode simple : les réglages analytiques avancés sont masqués ici. Passe en mode avancé pour gouverner le mapping analytique.</div>'
    : '';
  const body = cats.map((category) => {
    const name = String(category || '').trim();
    const col = colors?.[name] || '#94a3b8';
    const subRows = Array.isArray(getSubRows(name)) ? getSubRows(name) : [];
    const activeCount = subRows.filter((row) => row?.isActive !== false && row?.is_active !== false).length;
    const categoryMapping = getMapping(name, null) || {};
    const categoryUsage = getUsage(name, null) || {};
    const categorySelectValue = categoryMapping.mappingStatus === 'mapped'
      ? String(categoryMapping.analyticFamily || '').trim().toLowerCase()
      : (categoryMapping.mappingStatus === 'excluded' ? '__excluded__' : '__unmapped__');
    const categoryUsageText = Number(categoryUsage.txCount) > 0
      ? ` · ${esc(String(categoryUsage.txCount))} transaction${Number(categoryUsage.txCount) > 1 ? 's' : ''}`
      : '';
    const subHtml = subRows.length
      ? subRows.map((row) => {
          const active = row?.isActive !== false && row?.is_active !== false;
          const isSql = !!row?.id;
          const source = String(row?.source || (isSql ? 'sql' : 'default')).toLowerCase();
          const sourceLabel = isSql ? 'Sauvegardée' : (source === 'fallback' ? 'Détectée' : 'Par défaut');
          const subColor = String(row?.color || '').trim();
          const subName = String(row?.name || '').trim();
          const subMapping = getMapping(name, subName) || {};
          const subUsage = getUsage(name, subName) || {};
          const subSelectValue = subMapping.explicit
            ? (subMapping.mappingStatus === 'mapped' ? String(subMapping.analyticFamily || '').trim().toLowerCase() : '__excluded__')
            : '__inherit__';
          return `
            <div class="tb-subcat-row">
              <div class="tb-subcat-main">
                <strong>${esc(subName)}</strong>
                <div class="tb-subcat-meta">
                  <span class="tb-settings-pill ${active ? 'tb-settings-pill--positive' : ''}">${active ? 'Active' : 'Inactive'}</span>
                  <span class="tb-settings-pill">${sourceLabel}</span>
                  <span class="tb-settings-pill tb-advanced-only">${esc(subMapping.sourceLabel || 'À classer')}</span>
                  <span class="tb-advanced-only">${analyticStatusPillHtml(subMapping)}</span>
                  <span class="tb-advanced-only">${analyticUsagePillHtml(subUsage.txCount)}</span>
                  ${subColor ? `<span class="tb-subcat-color" title="${esc(subColor)}" style="background:${esc(subColor)}"></span>` : ''}
                </div>
                <div class="muted tb-advanced-only" style="margin-top:6px;">Analyse : ${esc(subMapping.mappingStatus === 'mapped' ? analyticFamilyLabel(subMapping.analyticFamily) : (subMapping.mappingStatus === 'excluded' ? 'Exclue' : 'À classer'))}</div>
              </div>
              <div class="tb-subcat-actions" style="align-items:flex-end; gap:6px;">
                <select class="input tb-advanced-only" style="min-width:190px;" onchange="saveAnalyticSubcategoryMapping('${esc(name)}','${esc(subName)}', this.value)">${analyticSelectOptions(subSelectValue, true)}</select>
                <div style="display:flex; flex-wrap:wrap; gap:6px; justify-content:flex-end;">
                  ${isSql
                    ? `<button class="btn" onclick="moveSubcategory('${esc(String(row?.id || ''))}','up')">↑</button>
                       <button class="btn" onclick="moveSubcategory('${esc(String(row?.id || ''))}','down')">↓</button>
                       <button class="btn" onclick="editSubcategory('${esc(String(row?.id || ''))}')">Modifier</button>
                       <button class="btn" onclick="toggleSubcategoryActive('${esc(String(row?.id || ''))}', ${active ? 'false' : 'true'})">${active ? 'Désactiver' : 'Réactiver'}</button>`
                    : `<button class="btn" onclick="importExistingSubcategory('${esc(name)}','${esc(subName)}')">Enregistrer</button>`}
                </div>
              </div>
            </div>`;
        }).join('')
      : '<div class="muted" style="padding:8px 0;">Aucune sous-catégorie.</div>';

    return `
      <details class="tb-category-card" ${subRows.length ? '' : 'open'}>
        <summary class="tb-category-head">
          <div class="tb-category-head-left">
            <span class="tb-category-swatch" style="background:${esc(col)}"></span>
            <div>
              <div class="tb-category-name">${esc(name)}</div>
              <div class="tb-category-meta">${esc(String(subRows.length))} sous-catégorie${subRows.length > 1 ? 's' : ''} · ${esc(String(activeCount))} active${activeCount > 1 ? 's' : ''}${categoryUsageText}</div>
            </div>
          </div>
          <div class="tb-category-head-actions">
            <button class="btn" type="button" onclick="event.preventDefault(); event.stopPropagation(); addSubcategory('${esc(name)}')">+ Sous-catégorie</button>
            <button class="btn" type="button" onclick="event.preventDefault(); event.stopPropagation(); deleteCategory('${esc(name)}')">Supprimer</button>
          </div>
        </summary>
        <div class="tb-category-body">
          <div class="tb-category-toolbar" style="display:flex; flex-wrap:wrap; gap:8px; align-items:center; justify-content:space-between;">
            <div style="display:flex; flex-wrap:wrap; gap:8px; align-items:center;">
              <span class="muted">Couleur</span>
              <span class="tb-category-swatch" style="background:${esc(col)}"></span>
              <input type="color" value="${esc(col)}" style="width:44px;height:30px;padding:0;border:none;background:transparent;cursor:pointer;" onchange="setCategoryColor('${esc(name)}', this.value)" />
              <span class="tb-advanced-only">${analyticStatusPillHtml(categoryMapping)}</span>
              <span class="tb-advanced-only">${analyticUsagePillHtml(categoryUsage.txCount)}</span>
              <span class="tb-settings-pill tb-advanced-only">${esc(categoryMapping.sourceLabel || 'À classer')}</span>
            </div>
            <div class="tb-advanced-only" style="display:flex; gap:8px; align-items:center;">
              <span class="muted">Analyse</span>
              <select class="input" style="min-width:190px;" onchange="saveAnalyticCategoryMapping('${esc(name)}', this.value)">${analyticSelectOptions(categorySelectValue, false)}</select>
            </div>
          </div>
          <div class="tb-category-sublist">${subHtml}</div>
        </div>
      </details>`;
  }).join('');
  return simpleNote + (body || '<div class="muted">Aucune catégorie. Ajoute-en une ci-dessus.</div>');
}

export default { renderSettingsCategoriesList };
