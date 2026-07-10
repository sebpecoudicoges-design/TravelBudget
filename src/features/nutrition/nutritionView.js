function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function defaultEsc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function langText(fr, en, t) {
  return typeof t === 'function' ? t(fr, en) : fr;
}

export function formatMacro(value, unit = 'g') {
  return `${Math.round(num(value, 0) * 10) / 10}${unit}`;
}

export function progressPercent(current, target, max = 160) {
  const t = Math.max(1, num(target, 0));
  return Math.max(0, Math.min(max, (num(current, 0) / t) * 100));
}

export function renderProgressBar({ label, current = 0, target = 0, unit = '', esc = defaultEsc } = {}) {
  const percent = progressPercent(current, target);
  const over = num(current, 0) > num(target, 0);
  return `
      <div style="display:grid;gap:5px;">
        <div style="display:flex;justify-content:space-between;gap:8px;font-size:12px;">
          <span>${esc(label || '')}</span>
          <strong>${Math.round(num(current, 0))}/${Math.round(num(target, 0))}${esc(unit || '')}</strong>
        </div>
        <div style="height:8px;border:1px solid var(--border);border-radius:999px;overflow:hidden;background:rgba(148,163,184,.12);">
          <div style="height:100%;width:${Math.min(100, percent)}%;background:${over ? 'var(--danger,#ef4444)' : 'var(--accent,#22c55e)'};"></div>
        </div>
      </div>`;
}

export function mealTargetNote(target = {}, { t } = {}) {
  const delta = Math.round(num(target.kcal, 0) - num(target.baseKcal, target.kcal));
  if (Math.abs(delta) < 40) return langText('Objectif standard.', 'Standard target.', t);
  return delta > 0
    ? langText(`Ajuste +${delta} kcal car les repas precedents etaient plus legers.`, `Adjusted +${delta} kcal because previous meals were lighter.`, t)
    : langText(`Ajuste ${delta} kcal car les repas precedents etaient plus hauts.`, `Adjusted ${delta} kcal because previous meals were higher.`, t);
}

export function mealMomentSuggestion(type, consumed = {}, targetKcal = 0, total = {}, macroTargets = {}, { t } = {}) {
  const kcalGap = num(targetKcal, 0) - num(consumed.kcal, 0);
  const proteinGap = num(macroTargets.protein, 0) - num(total.protein, 0);
  const waterGap = 2000 - num(total.waterMl, 0);
  if (kcalGap <= -120) return langText('Deja haut en kcal : vise hydratation, legumes ou une option tres legere.', 'Already high in kcal: aim for hydration, vegetables or a very light option.', t);
  if (proteinGap > 25 && kcalGap > 100) return langText('Il te reste surtout des proteines : poulet, skyr, oeufs, thon ou tofu.', 'You mostly need protein: chicken, skyr, eggs, tuna or tofu.', t);
  if (waterGap > 700 && (type === 'afternoon_snack' || type === 'dinner')) return langText("Hydratation en retard : ajoute de l'eau avant de completer le repas.", 'Hydration is behind: add water before completing the meal.', t);
  if (kcalGap > 260) return langText('Repas a completer : une base + une proteine + un fruit/legume.', 'Meal to complete: a base + protein + fruit/vegetable.', t);
  if (kcalGap > 80) return langText('Petite marge : portion simple ou collation legere.', 'Small margin: simple portion or light snack.', t);
  return langText('Moment bien cale.', 'This moment is on track.', t);
}

export function buildWeekRows(history = [], selectedDay, { offsetDateISO } = {}) {
  const byDay = new Map((Array.isArray(history) ? history : []).map(row => [row.day, row]));
  const rows = [];
  for (let i = 6; i >= 0; i -= 1) {
    const day = typeof offsetDateISO === 'function' ? offsetDateISO(selectedDay, -i) : selectedDay;
    rows.push(byDay.get(day) || { day, kcal: 0, protein: 0, carbs: 0, fat: 0, waterMl: 0, alcoholDrinks: 0, alcoholGrams: 0, alcoholEntries: [], typeRows: [] });
  }
  return rows;
}

export function renderFoodChip(food = {}, kind = 'recent', { esc = defaultEsc } = {}) {
  const label = kind === 'favorite' ? '★' : '↺';
  return `<button class="tb-nutrition-food-chip" type="button" data-nutrition-pick-food="${esc(food.key)}" title="${esc(food.name)} · ${Math.round(num(food.servingGrams, 100))}g"><span>${label}</span> ${esc(food.name)}</button>`;
}

export function renderMealFavoriteChip(fav = {}, index = 0, { foodByKey, nutritionForGrams, t, esc = defaultEsc } = {}) {
  const kcal = (fav.items || []).reduce((sum, item) => {
    const food = typeof foodByKey === 'function' ? foodByKey(item.foodKey) : null;
    const values = typeof nutritionForGrams === 'function' ? nutritionForGrams(food || {}, num(item.grams, 0)) : { kcal: 0 };
    return sum + num(values.kcal, 0);
  }, 0);
  const title = (fav.items || []).map(item => `${item.label || item.foodKey} ${Math.round(num(item.grams, 0))}g`).join(' · ');
  return `<button class="tb-nutrition-food-chip" type="button" data-nutrition-apply-meal-fav="${index}" title="${esc(title)}"><span>☆</span> ${esc(fav.label || langText('Repas favori', 'Favorite meal', t))}<br><small>${Math.round(kcal)} kcal</small></button>`;
}

export function renderMealTypeOptions(activeMealType = 'meal', { t, esc = defaultEsc } = {}) {
  const options = [
    ['breakfast', langText('Petit-dej', 'Breakfast', t)],
    ['morning_snack', langText('Pause 10h', '10am snack', t)],
    ['lunch', langText('Dejeuner', 'Lunch', t)],
    ['afternoon_snack', langText('Gouter', 'Afternoon snack', t)],
    ['dinner', langText('Diner', 'Dinner', t)],
    ['snack', langText('Snack', 'Snack', t)],
    ['meal', langText('Repas libre', 'Free meal', t)],
  ];
  return options.map(([value, label]) => `<option value="${esc(value)}" ${activeMealType === value ? 'selected' : ''}>${esc(label)}</option>`).join('');
}

export function renderQuickAddPanel({
  editingItem = null,
  syncBadge = '',
  foodQuery = '',
  foodOptionsHtml = '',
  quickFoods = {},
  mealFavorites = [],
  activeMealType = 'meal',
  error = '',
  renderFoodChip: foodChip = renderFoodChip,
  renderMealFavoriteChip: mealFavoriteChip = renderMealFavoriteChip,
  esc = defaultEsc,
  t,
} = {}) {
  const favs = Array.isArray(quickFoods.favs) ? quickFoods.favs : [];
  const recent = Array.isArray(quickFoods.recent) ? quickFoods.recent : [];
  return `<div style="border:1px solid var(--border);border-radius:8px;padding:12px;background:var(--panel2);">
    <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:10px;">
      <h3 style="margin:0;">${esc(editingItem ? langText('Modifier', 'Edit', t) : langText('Ajout rapide', 'Quick add', t))}</h3>
      <span class="pill">${esc(syncBadge)}</span>
    </div>
    <div class="field"><label>${esc(langText('Chercher', 'Search', t))}</label><input id="nutrition-search" value="${esc(foodQuery)}" placeholder="${esc(langText('Riz, poulet, banane...', 'Rice, chicken, banana...', t))}"></div>
    <div class="field"><label>${esc(langText('Aliment', 'Food', t))}</label><select id="nutrition-food">${foodOptionsHtml}</select></div>
    <div class="tb-nutrition-chip-row">
      <button class="btn small" id="nutrition-toggle-favorite" type="button">★ ${esc(langText('Favori', 'Favorite', t))}</button>
      ${favs.map(food => foodChip(food, 'favorite')).join('')}
      ${recent.map(food => foodChip(food, 'recent')).join('')}
    </div>
    ${mealFavorites.length ? `<div class="tb-nutrition-chip-row" aria-label="${esc(langText('Repas favoris', 'Favorite meals', t))}">${mealFavorites.slice(0, 6).map((fav, index) => mealFavoriteChip(fav, index)).join('')}</div>` : ''}
    <div class="row tb-nutrition-form-row" style="gap:10px;">
      <div class="field" style="flex:1;"><label>${esc(langText('Mode', 'Mode', t))}</label><select id="nutrition-amount-mode"><option value="portion">${esc(langText('Portions', 'Servings', t))}</option><option value="grams">${esc(langText('Grammes', 'Grams', t))}</option></select></div>
      <div class="field" style="flex:1;"><label>${esc(langText('Quantite', 'Quantity', t))}</label><input id="nutrition-quantity" type="number" min="0" step="0.25" value="1"></div>
    </div>
    <div class="row tb-nutrition-form-row" style="gap:10px;">
      <div class="field" style="flex:1;"><label>${esc(langText('Grammes estimes', 'Estimated grams', t))}</label><input id="nutrition-grams" type="number" min="0" step="5" value="100"></div>
      <div class="field" style="flex:1;"><label>${esc(langText('Moment', 'Moment', t))}</label><select id="nutrition-type">${renderMealTypeOptions(activeMealType, { t, esc })}</select></div>
    </div>
    <div class="pill" id="nutrition-preview">0 kcal</div>
    <button class="btn primary" id="nutrition-save" type="button" style="width:100%;margin-top:10px;">${esc(editingItem ? langText('Enregistrer', 'Save', t) : langText('Ajouter', 'Add', t))}</button>
    ${editingItem ? `<button class="btn" id="nutrition-edit-cancel" type="button" style="width:100%;margin-top:8px;">${esc(langText('Annuler la modification', 'Cancel edit', t))}</button>` : ''}
    ${error ? `<div class="muted" style="margin-top:10px;">${esc(error)}</div>` : ''}
  </div>`;
}

export function renderHydrationPanel({ esc = defaultEsc, t } = {}) {
  return `<div style="border:1px solid var(--border);border-radius:8px;padding:12px;background:var(--panel2);">
    <h3 style="margin:0 0 10px;">${esc(langText('Hydratation', 'Hydration', t))}</h3>
    <div class="field"><label>${esc(langText('Eau ml', 'Water ml', t))}</label><input id="nutrition-water-ml" type="number" min="0" step="50" value="250"></div>
    <div class="tb-nutrition-water-grid">
      <button class="btn small" type="button" data-nutrition-water-quick="250">250</button>
      <button class="btn small" type="button" data-nutrition-water-quick="500">500</button>
      <button class="btn small" type="button" data-nutrition-water-quick="1000">1L</button>
      <button class="btn small" type="button" data-nutrition-water-quick="2000">2L</button>
    </div>
    <button class="btn primary" id="nutrition-water-only" type="button" style="width:100%;">${esc(langText('Ajouter eau', 'Add water', t))}</button>
  </div>`;
}

export function renderSleepPanel({
  sleep = {},
  sleepLabel = '',
  sleepNightLabel = '',
  day = '',
  sleepWeek = [],
  offsetDateISO,
  esc = defaultEsc,
  t,
} = {}) {
  const dateLabel = String(day || '').slice(5).replace('-', '/');
  return `<div style="border:1px solid var(--border);border-radius:8px;padding:12px;background:var(--panel2);">
    <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:10px;">
      <h3 style="margin:0;">${esc(langText('Sommeil', 'Sleep', t))}</h3>
      <span class="pill">${esc(sleepLabel)}</span>
    </div>
    <div class="muted" style="font-size:12px;margin:-4px 0 8px;">${esc(langText('Nuit du', 'Night of', t))} ${esc(sleepNightLabel)} → ${esc(dateLabel)}</div>
    <div class="row tb-nutrition-form-row" style="gap:10px;">
      <div class="field" style="flex:1;"><label>${esc(langText('Heures dormies', 'Hours slept', t))}</label><input id="nutrition-sleep-hours" type="number" min="0" max="14" step="0.25" value="${esc(String(sleep.hours || ''))}" placeholder="7.5"></div>
      <div class="field" style="flex:1;"><label>${esc(langText('Qualite', 'Quality', t))}</label><select id="nutrition-sleep-quality"><option value="bad" ${sleep.quality === 'bad' ? 'selected' : ''}>${esc(langText('Mauvaise', 'Bad', t))}</option><option value="ok" ${sleep.quality === 'ok' ? 'selected' : ''}>${esc(langText('Correcte', 'Ok', t))}</option><option value="good" ${sleep.quality === 'good' ? 'selected' : ''}>${esc(langText('Bonne', 'Good', t))}</option></select></div>
    </div>
    <button class="btn" id="nutrition-sleep-save" type="button" style="width:100%;margin-top:8px;">${esc(langText('Enregistrer sommeil', 'Save sleep', t))}</button>
    <div class="tb-nutrition-week-grid" style="margin-top:10px;margin-bottom:0;">
      ${(Array.isArray(sleepWeek) ? sleepWeek : []).map(row => {
        const sleepPct = Math.max(0, Math.min(100, (num(row.hours, 0) / 7.5) * 100));
        const height = Math.max(8, Math.min(74, sleepPct * 0.74));
        const active = row.day === day;
        const label = row.hours > 0 ? `${Math.round(row.hours * 10) / 10}h · ${row.quality}` : langText('non saisi', 'not set', t);
        const nightDay = row.nightDay || (typeof offsetDateISO === 'function' ? offsetDateISO(row.day, -1) : '');
        return `<button class="btn small" type="button" data-nutrition-history-date="${esc(row.day)}" title="${esc(langText('Nuit du', 'Night of', t))} ${esc(nightDay)} → ${esc(row.day)} · ${esc(label)} · objectif 7.5h" style="height:92px;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:4px;padding:5px;${active ? 'border-color:var(--accent);' : ''}">
          <span style="width:100%;height:${height}px;border-radius:6px 6px 3px 3px;background:linear-gradient(180deg,#8b5cf6,#38bdf8);"></span>
          <small>${esc(String(row.day || '').slice(5).replace('-', '/'))}</small>
        </button>`;
      }).join('')}
    </div>
    <div class="muted" style="font-size:12px;margin-top:8px;">${esc(langText('La saisie est rattachee a la nuit precedente de la date selectionnee et remonte dans le KPI Sante.', 'The entry is attached to the previous night of the selected date and feeds the Health KPI.', t))}</div>
  </div>`;
}

export function renderHistoryPanel({
  week = [],
  day = '',
  needsKcal = 1,
  mealTypeLabel,
  esc = defaultEsc,
  t,
} = {}) {
  return `<div style="border:1px solid var(--border);border-radius:8px;padding:12px;background:linear-gradient(180deg,rgba(56,189,248,.08),rgba(15,23,42,.02)),var(--panel2);">
    <h3 style="margin:0 0 10px;">${esc(langText('Historique', 'History', t))}</h3>
    <div class="tb-nutrition-week-grid">
      ${(Array.isArray(week) ? week : []).map(row => {
        const height = Math.max(8, Math.min(74, progressPercent(row.kcal, needsKcal, 100) * 0.74));
        const active = row.day === day;
        const detail = (row.typeRows || []).map(typeRow => `${typeof mealTypeLabel === 'function' ? mealTypeLabel(typeRow.type) : typeRow.type} ${Math.round(num(typeRow.kcal, 0))} kcal`).join(' · ');
        return `<button class="btn small" type="button" data-nutrition-history-date="${esc(row.day)}" title="${esc(row.day)} · ${Math.round(num(row.kcal, 0))} kcal · ${Math.round(num(row.waterMl, 0))} ml${detail ? ` · ${esc(detail)}` : ''}" style="height:98px;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:4px;padding:5px;${active ? 'border-color:var(--accent);' : ''}">
          <span style="width:100%;height:${height}px;border-radius:6px 6px 3px 3px;background:linear-gradient(180deg,#22c55e,#38bdf8);"></span>
          <small>${esc(String(row.day || '').slice(5).replace('-', '/'))}</small>
        </button>`;
      }).join('')}
    </div>
    <div class="muted" style="font-size:12px;">${esc(langText('Survole une barre pour le detail du jour.', 'Hover a bar for day details.', t))}</div>
  </div>`;
}

export function renderMealTimeline({
  mealTargets = [],
  typeTotals = {},
  items = [],
  total = {},
  drinkWaterMl = 0,
  macroTargets = {},
  itemMeal,
  mealTypeLabel,
  esc = defaultEsc,
  t,
} = {}) {
  const targetTypes = new Set((mealTargets || []).map(target => String(target.type || '')));
  const timeline = (mealTargets || []).map((target, index) => {
    const consumed = typeTotals[target.type] || { kcal: 0, protein: 0, carbs: 0, fat: 0 };
    const rowItems = (items || []).filter(item => String(itemMeal?.(item)?.meal_type || 'meal') === target.type);
    const rest = num(target.kcal, 0) - num(consumed.kcal, 0);
    const suggestion = mealMomentSuggestion(target.type, consumed, target.kcal, { ...total, waterMl: drinkWaterMl }, macroTargets, { t });
    return `<div class="tb-nutrition-timeline-row">
      <div style="display:grid;grid-template-rows:18px 1fr;justify-items:center;padding-top:4px;">
        <span style="width:16px;height:16px;border-radius:50%;background:${target.color};box-shadow:0 0 0 4px ${target.color}22;"></span>
        <span style="width:2px;background:${index === mealTargets.length - 1 ? 'transparent' : 'rgba(148,163,184,.35)'};"></span>
      </div>
      <div style="border:1px solid ${target.color}88;border-radius:8px;padding:12px;background:linear-gradient(135deg,${target.color}20,rgba(15,23,42,.02)),var(--panel2);">
        <button class="btn" type="button" data-nutrition-pick-type="${esc(target.type)}" style="width:100%;display:flex;justify-content:space-between;gap:10px;align-items:flex-start;text-align:left;border-color:${target.color};">
          <span><strong>${esc(typeof mealTypeLabel === 'function' ? mealTypeLabel(target.type) : target.type)}</strong><br><small class="muted">${Math.round(num(consumed.kcal, 0))} / ${Math.round(num(target.kcal, 0))} kcal</small></span>
          <span class="pill">${rest >= 0 ? esc(langText('reste', 'left', t)) : esc(langText('surplus', 'surplus', t))} ${Math.abs(Math.round(rest))}</span>
        </button>
        ${rowItems.length ? `<button class="btn small" type="button" data-nutrition-save-meal-fav="${esc(target.type)}" style="margin-top:8px;">☆ ${esc(langText('Garder en favori', 'Save as favorite', t))}</button>` : ''}
        <div style="margin:10px 0;">${renderProgressBar({ label: 'kcal', current: consumed.kcal, target: target.kcal, unit: '', esc })}</div>
        <div class="muted" style="font-size:12px;margin:-4px 0 8px;">${esc(mealTargetNote(target, { t }))}</div>
        <div class="pill" style="margin-bottom:8px;background:rgba(255,255,255,.06);">${esc(suggestion)}</div>
        ${rowItems.length ? rowItems.map(item => `
          <div style="display:flex;justify-content:space-between;gap:10px;border-top:1px solid rgba(148,163,184,.22);padding:8px 0;align-items:flex-start;flex-wrap:wrap;">
            <div><strong>${esc(item.label || item.food_key || 'Aliment')}</strong><div class="muted">${Math.round(num(item.grams, 0))}g · P ${formatMacro(item.protein_g)} · G ${formatMacro(item.carbs_g)} · L ${formatMacro(item.fat_g)}</div></div>
            <div style="display:flex;gap:6px;align-items:center;justify-content:flex-end;flex-wrap:wrap;"><strong>${Math.round(num(item.kcal, 0))} kcal</strong><button class="btn small" type="button" data-nutrition-edit="${esc(String(item.id || ''))}">${esc(langText('Modifier', 'Edit', t))}</button><button class="btn small" type="button" data-nutrition-delete="${esc(String(item.id || ''))}">${esc(langText('Supprimer', 'Delete', t))}</button></div>
          </div>`).join('') : `<div class="muted">${esc(langText('Aucun aliment sur ce moment.', 'No food for this moment.', t))}</div>`}
      </div>
    </div>`;
  }).join('');

  const otherItems = (items || []).filter(item => !targetTypes.has(String(itemMeal?.(item)?.meal_type || 'meal')));
  const other = otherItems.length ? `
    <div style="border:1px solid var(--border);border-radius:8px;padding:12px;background:var(--panel2);">
      <strong>${esc(langText('Autres ajouts', 'Other entries', t))}</strong>
      ${otherItems.map(item => `
        <div style="display:flex;justify-content:space-between;gap:10px;border-top:1px solid var(--border);padding:8px 0;"><span>${esc(item.label || item.food_key || 'Aliment')}</span><strong>${Math.round(num(item.kcal, 0))} kcal</strong></div>
      `).join('')}
    </div>` : '';

  return `${timeline}${other}`;
}
