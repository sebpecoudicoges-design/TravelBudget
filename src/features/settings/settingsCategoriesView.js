const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function defaultEsc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ESC[char]);
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
    ? '<div class="tb-simple-mode-note">Mode simple : mapping analytique masqué. Passe en mode avancé pour le gérer.</div>'
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
          const id = esc(String(row?.id || ''));
          const actions = isSql
            ? `<button class="btn" onclick="moveSubcategory('${id}','up')">↑</button><button class="btn" onclick="moveSubcategory('${id}','down')">↓</button><button class="btn" onclick="editSubcategory('${id}')">Modifier</button><button class="btn" onclick="toggleSubcategoryActive('${id}',${active ? 'false' : 'true'})">${active ? 'Désactiver' : 'Réactiver'}</button>`
            : `<button class="btn" onclick="importExistingSubcategory('${esc(name)}','${esc(subName)}')">Enregistrer</button>`;
          return `<div class="tb-subcat-row"><div class="tb-subcat-main"><strong>${esc(subName)}</strong><div class="tb-subcat-meta"><span class="tb-settings-pill ${active ? 'tb-settings-pill--positive' : ''}">${active ? 'Active' : 'Inactive'}</span><span class="tb-settings-pill">${sourceLabel}</span><span class="tb-settings-pill tb-advanced-only">${esc(subMapping.sourceLabel || 'À classer')}</span><span class="tb-advanced-only">${analyticStatusPillHtml(subMapping)}</span><span class="tb-advanced-only">${analyticUsagePillHtml(subUsage.txCount)}</span>${subColor ? `<span class="tb-subcat-color" title="${esc(subColor)}" style="background:${esc(subColor)}"></span>` : ''}</div><div class="muted tb-advanced-only" style="margin-top:6px">Analyse : ${esc(subMapping.mappingStatus === 'mapped' ? analyticFamilyLabel(subMapping.analyticFamily) : (subMapping.mappingStatus === 'excluded' ? 'Exclue' : 'À classer'))}</div></div><div class="tb-subcat-actions" style="align-items:flex-end;gap:6px"><select class="input tb-advanced-only" style="min-width:190px" onchange="saveAnalyticSubcategoryMapping('${esc(name)}','${esc(subName)}',this.value)">${analyticSelectOptions(subSelectValue, true)}</select><div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:flex-end">${actions}</div></div></div>`;
        }).join('')
      : '<div class="muted" style="padding:8px 0;">Aucune sous-catégorie.</div>';

    return `<details class="tb-category-card" ${subRows.length ? '' : 'open'}><summary class="tb-category-head"><div class="tb-category-head-left"><span class="tb-category-swatch" style="background:${esc(col)}"></span><div><div class="tb-category-name">${esc(name)}</div><div class="tb-category-meta">${esc(String(subRows.length))} sous-catégorie${subRows.length > 1 ? 's' : ''} · ${esc(String(activeCount))} active${activeCount > 1 ? 's' : ''}${categoryUsageText}</div></div></div><div class="tb-category-head-actions"><button class="btn" type="button" onclick="event.preventDefault();event.stopPropagation();addSubcategory('${esc(name)}')">+ Sous-catégorie</button><button class="btn" type="button" onclick="event.preventDefault();event.stopPropagation();deleteCategory('${esc(name)}')">Supprimer</button></div></summary><div class="tb-category-body"><div class="tb-category-toolbar" style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between"><div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center"><span class="muted">Couleur</span><span class="tb-category-swatch" style="background:${esc(col)}"></span><input type="color" value="${esc(col)}" style="width:44px;height:30px;padding:0;border:none;background:transparent;cursor:pointer" onchange="setCategoryColor('${esc(name)}',this.value)" /><span class="tb-advanced-only">${analyticStatusPillHtml(categoryMapping)}</span><span class="tb-advanced-only">${analyticUsagePillHtml(categoryUsage.txCount)}</span><span class="tb-settings-pill tb-advanced-only">${esc(categoryMapping.sourceLabel || 'À classer')}</span></div><div class="tb-advanced-only" style="display:flex;gap:8px;align-items:center"><span class="muted">Analyse</span><select class="input" style="min-width:190px" onchange="saveAnalyticCategoryMapping('${esc(name)}',this.value)">${analyticSelectOptions(categorySelectValue, false)}</select></div></div><div class="tb-category-sublist">${subHtml}</div></div></details>`;
  }).join('');
  return simpleNote + (body || '<div class="muted">Aucune catégorie. Ajoute-en une ci-dessus.</div>');
}

export function renderGuidedCategoryModalBody({
  name = '',
  color = '#94a3b8',
  mapping = '__unmapped__',
  analyticSelectOptions = () => '',
  esc = defaultEsc,
} = {}) {
  return `<div class="row"><div class="field" style="flex:1;min-width:220px"><label for="tb-cat-create-name">Nom</label><input id="tb-cat-create-name" class="input" type="text" placeholder="Ex: Santé" value="${esc(name)}" /></div><div class="field" style="min-width:160px"><label for="tb-cat-create-color">Couleur</label><input id="tb-cat-create-color" class="input" type="color" value="${esc(color || '#94a3b8')}" /></div></div><div class="field"><label for="tb-cat-create-mapping">Mapping analytique</label><select id="tb-cat-create-mapping" class="input">${analyticSelectOptions(mapping || '__unmapped__', false)}</select></div><div class="muted" style="margin-top:8px">Choisis le rattachement analytique. “À classer” ne crée aucune règle SQL.</div>`;
}

export function renderGuidedSubcategoryModalBody({
  category = '',
  name = '',
  color = '',
  mapping = '__inherit__',
  analyticSelectOptions = () => '',
  esc = defaultEsc,
} = {}) {
  return `<div class="field"><label>Catégorie</label><input class="input" type="text" value="${esc(category)}" disabled /></div><div class="row"><div class="field" style="flex:1;min-width:220px"><label for="tb-subcat-create-name">Nom</label><input id="tb-subcat-create-name" class="input" type="text" placeholder="Ex: Visa" value="${esc(name)}" /></div><div class="field" style="min-width:160px"><label for="tb-subcat-create-color">Couleur optionnelle</label><input id="tb-subcat-create-color" class="input" type="text" placeholder="#94a3b8" value="${esc(color)}" /></div></div><div class="field"><label for="tb-subcat-create-mapping">Mapping analytique</label><select id="tb-subcat-create-mapping" class="input">${analyticSelectOptions(mapping || '__inherit__', true)}</select></div><div class="muted" style="margin-top:8px">Par défaut, héritage du mapping catégorie. Aucune règle SQL en héritage.</div>`;
}

export function validateCategoryDraft({
  name = '',
  color = '#94a3b8',
} = {}) {
  const cleanName = String(name || '').trim();
  const cleanColor = String(color || '#94a3b8').trim() || '#94a3b8';
  if (!cleanName) return { ok: false, reason: 'Nom de catégorie vide.' };
  if (!/^#[0-9a-fA-F]{6}$/.test(cleanColor)) return { ok: false, reason: 'Couleur invalide.' };
  return { ok: true, reason: '', name: cleanName, color: cleanColor };
}

export function prepareCategoryUpsertDraft({
  name = '',
  color = '#94a3b8',
  categories = [],
  userId = '',
  now = () => new Date().toISOString(),
} = {}) {
  const readiness = validateCategoryDraft({ name, color });
  if (!readiness.ok) return readiness;
  const existingName = (Array.isArray(categories) ? categories : [])
    .find((category) => String(category || '').trim().toLowerCase() === readiness.name.toLowerCase()) || null;
  const timestamp = now();
  if (existingName) {
    return {
      ok: true,
      reason: '',
      mode: 'update',
      name: readiness.name,
      existingName,
      color: readiness.color,
      payload: {
        color: readiness.color,
        updated_at: timestamp,
      },
    };
  }
  return {
    ok: true,
    reason: '',
    mode: 'insert',
    name: readiness.name,
    existingName: null,
    color: readiness.color,
    payload: {
      user_id: String(userId || '').trim(),
      name: readiness.name,
      color: readiness.color,
      sort_order: Array.isArray(categories) ? categories.length : 0,
      created_at: timestamp,
      updated_at: timestamp,
    },
  };
}

export function notifySettingsValidation({
  message = '',
  toastWarn = null,
  toastInfo = null,
  alertFn = null,
} = {}) {
  const text = String(message || 'Valeur invalide.').trim();
  if (!text) return { ok: false, method: 'none', message: '' };
  if (typeof toastWarn === 'function') {
    toastWarn(text);
    return { ok: true, method: 'toastWarn', message: text };
  }
  if (typeof toastInfo === 'function') {
    toastInfo(text);
    return { ok: true, method: 'toastInfo', message: text };
  }
  if (typeof alertFn === 'function') {
    alertFn(text);
    return { ok: true, method: 'alert', message: text };
  }
  return { ok: false, method: 'none', message: text };
}

export function prepareSubcategoryEditDraft({
  row = null,
  name = '',
  color = '',
  rows = [],
  currentId = '',
  resolveCategoryId = () => null,
  now = () => new Date().toISOString(),
} = {}) {
  if (!row) return { ok: false, reason: 'Sous-catégorie introuvable.' };
  const category = String(row?.categoryName || row?.category_name || '').trim();
  const cleanName = String(name || '').trim();
  const cleanColor = String(color || '').trim();
  if (!cleanName) return { ok: false, reason: 'Nom de sous-catégorie vide.' };
  const readiness = validateSubcategoryDraft({
    category,
    name: cleanName,
    color: cleanColor,
    rows,
    currentId,
  });
  if (!readiness.ok) return readiness;
  return {
    ok: true,
    reason: '',
    category,
    name: readiness.name,
    color: readiness.color,
    payload: {
      name: readiness.name,
      color: readiness.color || null,
      category_id: row?.categoryId || row?.category_id || resolveCategoryId(category),
      category_name: category,
      updated_at: now(),
    },
  };
}

export function prepareAnalyticMappingRuleDraft({
  categoryName = '',
  subcategoryName = null,
  nextValue = '',
  userId = '',
  now = () => new Date().toISOString(),
} = {}) {
  const category = String(categoryName || '').trim();
  const subcategory = (subcategoryName === undefined || subcategoryName === null || String(subcategoryName || '').trim() === '')
    ? null
    : String(subcategoryName || '').trim();
  const value = String(nextValue || '').trim();
  const cleanUserId = String(userId || '').trim();
  if (!category) return { ok: false, reason: 'Catégorie invalide.' };
  const mappingStatus = (value === '__unmapped__' || value === '__inherit__')
    ? 'unmapped'
    : (value === '__excluded__' ? 'excluded' : 'mapped');
  const analyticFamily = mappingStatus === 'mapped' ? value : null;
  return {
    ok: true,
    reason: '',
    category,
    subcategory,
    value,
    mappingStatus,
    analyticFamily,
    rpcPayload: {
      p_user_id: cleanUserId,
      p_category_name: category,
      p_subcategory_name: subcategory,
      p_mapping_status: mappingStatus,
      p_analytic_family: analyticFamily,
    },
    tablePayload: {
      user_id: cleanUserId,
      category_name: category,
      subcategory_name: subcategory,
      mapping_status: mappingStatus,
      analytic_family: analyticFamily,
      notes: null,
      updated_at: now(),
    },
  };
}

function prepareSubcategoryInsertDraft({
  category = '',
  name = '',
  color = '',
  rows = [],
  userId = '',
  resolveCategoryId = () => null,
  now = () => new Date().toISOString(),
  sqlOnly = false,
} = {}) {
  const list = Array.isArray(rows) ? rows : [];
  const readiness = validateSubcategoryDraft({
    category,
    name,
    color,
    rows: list,
    sqlOnly,
  });
  if (!readiness.ok) return readiness;
  const sortOrder = list.reduce((max, row) => Math.max(max, Number(row?.sortOrder ?? row?.sort_order ?? 0)), -1) + 1;
  const payload = {
    user_id: String(userId || '').trim(),
    category_id: resolveCategoryId(readiness.category),
    category_name: readiness.category,
    name: readiness.name,
    sort_order: sortOrder,
    is_active: true,
    updated_at: now(),
  };
  if (!sqlOnly) payload.color = readiness.color || null;
  const draft = {
    ok: true,
    reason: '',
    category: readiness.category,
    name: readiness.name,
    sortOrder,
    payload,
  };
  if (!sqlOnly) draft.color = readiness.color;
  return draft;
}

export function prepareSubcategoryImportDraft(options = {}) {
  return prepareSubcategoryInsertDraft({ ...options, sqlOnly: true });
}

export function prepareSubcategoryCreateDraft(options = {}) {
  return prepareSubcategoryInsertDraft({ ...options, sqlOnly: false });
}

export function prepareSubcategoryMoveDraft({
  rows = [],
  id = '',
  direction = '',
} = {}) {
  const list = (Array.isArray(rows) ? rows : []).filter((row) => row?.id);
  if (list.length <= 1) return { ok: false, reason: 'Ordre inchangé.' };
  const targetId = String(id || '');
  const currentIndex = list.findIndex((row) => String(row?.id) === targetId);
  if (currentIndex < 0) return { ok: false, reason: 'Sous-catégorie introuvable.' };
  const swapIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
  if (swapIndex < 0 || swapIndex >= list.length) return { ok: false, reason: 'Déplacement impossible.' };
  const ordered = list.slice();
  [ordered[currentIndex], ordered[swapIndex]] = [ordered[swapIndex], ordered[currentIndex]];
  const updates = ordered.map((row, index) => ({
    id: row.id,
    sort_order: (index + 1) * 10,
  }));
  const sortById = new Map(updates.map((row) => [String(row.id), row.sort_order]));
  const nextRows = (Array.isArray(rows) ? rows : []).map((row) => {
    const nextSort = sortById.get(String(row?.id || ''));
    return nextSort === undefined
      ? row
      : { ...row, sortOrder: nextSort, sort_order: nextSort };
  });
  return {
    ok: true,
    reason: '',
    updates,
    nextRows,
  };
}

export function validateSubcategoryDraft({
  category = '',
  name = '',
  color = '',
  rows = [],
  currentId = '',
  sqlOnly = false,
} = {}) {
  const cleanCategory = String(category || '').trim();
  const cleanName = String(name || '').trim();
  const cleanColor = String(color || '').trim();
  const current = String(currentId || '');
  const list = Array.isArray(rows) ? rows : [];
  if (!cleanCategory || !cleanName) return { ok: false, reason: 'Sous-catégorie invalide.' };
  if (cleanColor && !/^#[0-9a-fA-F]{6}$/.test(cleanColor)) return { ok: false, reason: 'Couleur invalide.' };
  const duplicate = list.find((row) => {
    if (current && String(row?.id || '') === current) return false;
    if (sqlOnly && !row?.id) return false;
    return String(row?.name || '').trim().toLowerCase() === cleanName.toLowerCase();
  });
  if (duplicate) {
    return {
      ok: false,
      reason: sqlOnly
        ? 'Cette sous-catégorie existe déjà en SQL pour cette catégorie.'
        : (current ? 'Une autre sous-catégorie porte déjà ce nom dans cette catégorie.' : 'Cette sous-catégorie existe déjà pour cette catégorie.'),
    };
  }
  return { ok: true, reason: '', category: cleanCategory, name: cleanName, color: cleanColor };
}
