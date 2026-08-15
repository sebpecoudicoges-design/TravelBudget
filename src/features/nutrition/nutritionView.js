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

export function shortNutritionDate(value) {
  const day = String(value || '');
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? `${day.slice(8, 10)}/${day.slice(5, 7)}` : day;
}

export const NUTRITION_SECTIONS = Object.freeze(['today', 'meals', 'recovery', 'history']);

export function normalizeNutritionSection(value) {
  const section = String(value || '').trim().toLowerCase();
  return NUTRITION_SECTIONS.includes(section) ? section : 'today';
}

export function renderNutritionSectionTabs(activeSection = 'today', { esc = defaultEsc, t } = {}) {
  const active = normalizeNutritionSection(activeSection);
  const sections = [
    { key: 'today', icon: '◎', fr: "Aujourd'hui", en: 'Today' },
    { key: 'meals', icon: '🍽️', fr: 'Repas', en: 'Meals' },
    { key: 'recovery', icon: '💧', fr: 'Hydratation & récupération', en: 'Hydration & recovery' },
    { key: 'history', icon: '↗', fr: 'Historique', en: 'History' },
  ];
  return `<nav class="tb-nutrition-section-tabs" role="tablist" aria-label="${esc(langText('Espaces Alimentation', 'Nutrition sections', t))}">
    ${sections.map(section => `<button class="tb-nutrition-section-tab ${section.key === active ? 'active' : ''}" type="button" role="tab" id="nutrition-tab-${section.key}" aria-selected="${section.key === active ? 'true' : 'false'}" aria-controls="nutrition-panel-${section.key}" data-nutrition-section="${section.key}"><span aria-hidden="true">${section.icon}</span>${esc(langText(section.fr, section.en, t))}</button>`).join('')}
  </nav>`;
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
  if (Math.abs(delta) < 40) return langText('Objectif de ce repas, deja inclus dans l objectif calorique du jour.', 'This meal target is already included in the daily calorie target.', t);
  return delta > 0
    ? langText(`Objectif du repas reajuste de +${delta} kcal apres des repas plus legers, sans changer l objectif du jour.`, `Meal target adjusted by +${delta} kcal after lighter meals, without changing the daily target.`, t)
    : langText(`Objectif du repas reajuste de ${delta} kcal apres des repas plus hauts, sans changer l objectif du jour.`, `Meal target adjusted by ${delta} kcal after higher meals, without changing the daily target.`, t);
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

export function renderNutritionSyncPanel({
  rows = [],
  globalPendingCount = 0,
  syncStatus = '',
  selectedDate = '',
  localNutritionRowKey = (_row, index) => `idx_${index}`,
  localDateISO = (value) => String(value || '').slice(0, 10),
  mealTypeLabel = (type) => type,
  esc = defaultEsc,
  t,
} = {}) {
  const safeRows = Array.isArray(rows) ? rows : [];
  if (!safeRows.length) return '';
  const pendingCount = Math.max(0, Math.round(num(globalPendingCount, 0)));
  const metaParts = [
    `${safeRows.length} ${langText('ajout(s) local(aux)', 'local entry/entries', t)}`,
    pendingCount ? `${pendingCount} ${langText('action(s) file offline', 'offline queue action(s)', t)}` : '',
    syncStatus || '',
  ].filter(Boolean);

  return `<div style="margin-top:12px;border:1px solid rgba(245,158,11,.38);border-radius:12px;padding:12px;background:linear-gradient(135deg,rgba(245,158,11,.14),rgba(56,189,248,.06)),var(--panel2);">
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap;">
        <div>
          <strong>${esc(langText('Synchro alimentation en attente', 'Pending nutrition sync', t))}</strong>
          <div class="muted" style="font-size:12px;margin-top:3px;">${esc(metaParts.join(' · '))}</div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn small primary" type="button" id="nutrition-sync-pending">${esc(langText('Synchroniser', 'Sync', t))}</button>
          <button class="btn small danger" type="button" id="nutrition-clear-pending">${esc(langText('Vider', 'Clear', t))}</button>
        </div>
      </div>
      <div style="display:grid;gap:6px;margin-top:10px;">
        ${safeRows.slice(0, 8).map((row, index) => {
          const meal = row?.meal || {};
          const item = row?.item || {};
          const key = localNutritionRowKey(row, index);
          const label = item.label || meal.label || langText('Ajout nutrition', 'Nutrition entry', t);
          const amount = num(item.kcal, 0) > 0 ? `${Math.round(num(item.kcal, 0))} kcal` : `${Math.round(num(meal.water_ml, 0))} ml`;
          const meta = `${localDateISO(meal.meal_date) || selectedDate} · ${mealTypeLabel(meal.meal_type || 'meal')} · ${amount}`;
          return `<div style="display:flex;justify-content:space-between;gap:10px;align-items:center;border-top:1px solid rgba(148,163,184,.22);padding-top:6px;">
            <span><strong>${esc(label)}</strong><br><small class="muted">${esc(meta)}${row?.syncError ? ` · ${esc(row.syncError)}` : ''}</small></span>
            <button class="btn small" type="button" data-nutrition-discard-local="${esc(key)}">${esc(langText('Supprimer', 'Delete', t))}</button>
          </div>`;
        }).join('')}
        ${safeRows.length > 8 ? `<div class="muted" style="font-size:12px;">+${safeRows.length - 8} ${esc(langText('autre(s) attente(s)', 'other pending entry/entries', t))}</div>` : ''}
      </div>
    </div>`;
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
    <div id="nutrition-meal-favorites">${mealFavorites.length ? `<div class="tb-nutrition-chip-row" aria-label="${esc(langText('Repas favoris', 'Favorite meals', t))}">${mealFavorites.slice(0, 6).map((fav, index) => mealFavoriteChip(fav, index)).join('')}</div>` : ''}</div>
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

export function renderHydrationPanel({ waterEntries = [], waterTime = '12:00', totalWaterMl = 0, esc = defaultEsc, t } = {}) {
  const entries = Array.isArray(waterEntries) ? waterEntries : [];
  return `<section class="tb-nutrition-subcard tb-nutrition-hydration-card">
    <div class="tb-nutrition-subcard-heading">
      <div><h3>${esc(langText('Hydratation', 'Hydration', t))}</h3><p>${esc(langText('Chaque prise est horodatée et reste corrigeable.', 'Every drink is timestamped and can be corrected.', t))}</p></div>
      <span class="pill">${Math.round(num(totalWaterMl, 0))} / 2000 ml</span>
    </div>
    <div class="tb-nutrition-water-form">
      <div class="field"><label>${esc(langText('Quantité (ml)', 'Amount (ml)', t))}</label><input id="nutrition-water-ml" type="number" min="0" step="50" value="250"></div>
      <div class="field"><label>${esc(langText('Heure', 'Time', t))}</label><input id="nutrition-water-time" type="time" value="${esc(waterTime)}"></div>
    </div>
    <div class="tb-nutrition-water-grid">
      <button class="btn small" type="button" data-nutrition-water-quick="250">250</button>
      <button class="btn small" type="button" data-nutrition-water-quick="500">500</button>
      <button class="btn small" type="button" data-nutrition-water-quick="1000">1L</button>
      <button class="btn small" type="button" data-nutrition-water-quick="2000">2L</button>
    </div>
    <button class="btn primary" id="nutrition-water-only" type="button">${esc(langText('Ajouter cette prise', 'Add this drink', t))}</button>
    <div class="tb-nutrition-water-log" aria-label="${esc(langText("Prises d'eau du jour", "Today's water log", t))}">
      <div class="tb-nutrition-water-log-title"><strong>${esc(langText("Journal du jour", "Today's log", t))}</strong><span>${entries.length} ${esc(langText('prise(s)', 'drink(s)', t))}</span></div>
      ${entries.length ? entries.map(entry => `<div class="tb-nutrition-water-entry">
        <div><strong>${esc(entry.time || '--:--')}</strong><span>${Math.round(num(entry.amountMl, 0))} ml${entry.pending ? ` · ${esc(langText('en attente', 'pending', t))}` : ''}</span></div>
        <button class="btn small danger" type="button" data-nutrition-water-delete="${esc(entry.id || '')}" aria-label="${esc(langText(`Supprimer la prise de ${Math.round(num(entry.amountMl, 0))} ml à ${entry.time || ''}`, `Delete ${Math.round(num(entry.amountMl, 0))} ml drink at ${entry.time || ''}`, t))}">${esc(langText('Supprimer', 'Delete', t))}</button>
      </div>`).join('') : `<div class="tb-nutrition-empty">${esc(langText("Aucune prise d'eau enregistrée pour cette date.", 'No water logged for this date.', t))}</div>`}
    </div>
  </section>`;
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
  const dateLabel = shortNutritionDate(day);
  return `<section class="tb-nutrition-subcard">
    <div class="tb-nutrition-subcard-heading">
      <div><h3>${esc(langText('Sommeil', 'Sleep', t))}</h3><p>${esc(langText('La nuit précédente alimente la récupération du jour sélectionné.', 'The previous night feeds the selected day recovery.', t))}</p></div>
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
          <small>${esc(shortNutritionDate(row.day))}</small>
        </button>`;
      }).join('')}
    </div>
    <div class="muted" style="font-size:12px;margin-top:8px;">${esc(langText('Cette mesure remonte aussi dans le KPI Santé.', 'This measure also feeds the Health KPI.', t))}</div>
  </section>`;
}

export function renderHistoryPanel({
  week = [],
  day = '',
  needsKcal = 1,
  mealTypeLabel,
  esc = defaultEsc,
  t,
} = {}) {
  const rows = Array.isArray(week) ? week : [];
  const selected = rows.find(row => row.day === day) || { day, kcal: 0, protein: 0, carbs: 0, fat: 0, waterMl: 0, alcoholDrinks: 0, typeRows: [] };
  return `<section class="tb-nutrition-subcard tb-nutrition-history-card">
    <div class="tb-nutrition-subcard-heading"><div><h3>${esc(langText('Historique sur 7 jours', '7-day history', t))}</h3><p>${esc(langText('Choisis un jour pour retrouver ses repas et ses repères.', 'Choose a day to review its meals and targets.', t))}</p></div><span class="pill">${esc(day)}</span></div>
    <div class="tb-nutrition-week-grid">
      ${rows.map(row => {
        const height = Math.max(8, Math.min(74, progressPercent(row.kcal, needsKcal, 100) * 0.74));
        const active = row.day === day;
        const detail = (row.typeRows || []).map(typeRow => `${typeof mealTypeLabel === 'function' ? mealTypeLabel(typeRow.type) : typeRow.type} ${Math.round(num(typeRow.kcal, 0))} kcal`).join(' · ');
        return `<button class="btn small" type="button" data-nutrition-history-date="${esc(row.day)}" title="${esc(row.day)} · ${Math.round(num(row.kcal, 0))} kcal · ${Math.round(num(row.waterMl, 0))} ml${detail ? ` · ${esc(detail)}` : ''}" style="height:98px;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:4px;padding:5px;${active ? 'border-color:var(--accent);' : ''}">
          <span style="width:100%;height:${height}px;border-radius:6px 6px 3px 3px;background:linear-gradient(180deg,#22c55e,#38bdf8);"></span>
          <small>${esc(shortNutritionDate(row.day))}</small>
        </button>`;
      }).join('')}
    </div>
    <div class="tb-nutrition-history-summary">
      <div><span>kcal</span><strong>${Math.round(num(selected.kcal, 0))}</strong></div>
      <div><span>${esc(langText('Protéines', 'Protein', t))}</span><strong>${formatMacro(selected.protein)}</strong></div>
      <div><span>${esc(langText('Glucides', 'Carbs', t))}</span><strong>${formatMacro(selected.carbs)}</strong></div>
      <div><span>${esc(langText('Lipides', 'Fat', t))}</span><strong>${formatMacro(selected.fat)}</strong></div>
      <div><span>${esc(langText('Eau', 'Water', t))}</span><strong>${Math.round(num(selected.waterMl, 0))} ml</strong></div>
      <div><span>${esc(langText('Alcool', 'Alcohol', t))}</span><strong>${Math.round(num(selected.alcoholDrinks, 0) * 10) / 10}</strong></div>
    </div>
    <div class="tb-nutrition-history-meals">
      <strong>${esc(langText('Répartition des repas', 'Meal breakdown', t))}</strong>
      ${(selected.typeRows || []).length ? (selected.typeRows || []).map(typeRow => `<button class="btn" type="button" data-nutrition-history-type="${esc(selected.day)}::${esc(typeRow.type)}"><span>${esc(typeof mealTypeLabel === 'function' ? mealTypeLabel(typeRow.type) : typeRow.type)}</span><strong>${Math.round(num(typeRow.kcal, 0))} kcal</strong></button>`).join('') : `<div class="tb-nutrition-empty">${esc(langText('Aucun repas enregistré ce jour.', 'No meal logged for this day.', t))}</div>`}
    </div>
  </section>`;
}

export function macroSummaryText(targets = {}) {
  return `${Math.round(num(targets.protein, 0))}g P · ${Math.round(num(targets.carbs, 0))}g G · ${Math.round(num(targets.fat, 0))}g L`;
}

export function goalSevenDayInsight(goal = {}, targets = {}, week = [], { t } = {}) {
  const rows = (Array.isArray(week) ? week : []).filter(row => num(row.kcal, 0) > 0);
  if (!rows.length) return langText('Alerte 7 jours disponible des que plusieurs journees sont saisies.', '7-day alert appears once several days are logged.', t);
  const avg = rows.reduce((sum, row) => sum + num(row.kcal, 0), 0) / rows.length;
  const delta = Math.round(avg - num(targets.targetKcal, 0));
  if (goal.mode === 'bulk') {
    if (delta < -180) return langText(`Trop bas sur 7 jours : moyenne ${Math.round(avg)} kcal, ajoute une collation simple.`, `Too low over 7 days: ${Math.round(avg)} kcal average, add a simple snack.`, t);
    if (delta > 250) return langText(`Surplus fort : moyenne ${Math.round(avg)} kcal, reduis un peu les extras.`, `Strong surplus: ${Math.round(avg)} kcal average, trim extras a bit.`, t);
    return langText(`Rythme propre : moyenne ${Math.round(avg)} kcal, objectif prise de masse sous controle.`, `Clean pace: ${Math.round(avg)} kcal average, lean bulk on track.`, t);
  }
  if (goal.mode === 'cut' && delta > 180) return langText(`Trop haut sur 7 jours : moyenne ${Math.round(avg)} kcal, reajuste les prochains repas.`, `Too high over 7 days: ${Math.round(avg)} kcal average, adjust upcoming meals.`, t);
  return langText(`Moyenne 7 jours : ${Math.round(avg)} kcal, ecart ${delta > 0 ? '+' : ''}${delta} kcal.`, `7-day average: ${Math.round(avg)} kcal, gap ${delta > 0 ? '+' : ''}${delta} kcal.`, t);
}

export function renderGoalCockpit({
  goal = {},
  targets = {},
  week = [],
  total = {},
  sportKcal = 0,
  workKcal = 0,
  currentWeight = 0,
  goalLabel = '',
  esc = defaultEsc,
  t,
} = {}) {
  const targetWeight = num(goal.targetWeightKg, currentWeight);
  const remainingKg = Math.round((targetWeight - num(currentWeight, 0)) * 10) / 10;
  const weeklyRate = num(goal.weeklyRateKg, 0.25);
  const weeks = weeklyRate > 0 ? Math.max(0, Math.ceil(Math.abs(remainingKg) / weeklyRate)) : 0;
  const kcalLeft = Math.round(num(targets.targetKcal, 0) - num(total.kcal, 0));
  const insight = goalSevenDayInsight(goal, targets, week, { t });
  return `<div class="tb-nutrition-goal-cockpit">
    <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap;">
      <div><strong>${esc(langText('Cockpit objectif', 'Goal cockpit', t))}</strong><div class="muted" style="font-size:12px;">${esc(insight)}</div></div>
      <span class="pill">${esc(goalLabel || goal.mode || '')}</span>
    </div>
    <div class="tb-nutrition-goal-kpis">
      <div><span>${esc(langText('Poids cible', 'Target weight', t))}</span><strong>${Math.round(targetWeight * 10) / 10} kg</strong><small>${remainingKg >= 0 ? '+' : ''}${remainingKg} kg · ~${weeks} sem.</small></div>
      <div><span>${esc(langText('Rythme', 'Pace', t))}</span><strong>${weeklyRate} kg/sem.</strong><small>${esc(langText('simple et controlable', 'simple and controllable', t))}</small></div>
      <div><span>${esc(langText('Reste jour', 'Left today', t))}</span><strong>${kcalLeft >= 0 ? '+' : ''}${kcalLeft}</strong><small>kcal</small></div>
      <div><span>${esc(langText('Charge', 'Load', t))}</span><strong>${Math.round(num(sportKcal, 0) + num(workKcal, 0))}</strong><small>sport + ${esc(langText('travail', 'work', t))}</small></div>
    </div>
  </div>`;
}

export function renderAlcoholPanel({
  alcoholJudge = {},
  alcoholToday = {},
  alcoholWeekTotal = 0,
  alcoholDrinkingDays = 0,
  week = [],
  day = '',
  esc = defaultEsc,
  t,
} = {}) {
  const color = alcoholJudge.color || '#22c55e';
  const entries = Array.isArray(alcoholToday.entries) ? alcoholToday.entries : [];
  return `<section class="tb-nutrition-subcard tb-nutrition-alcohol-card" style="--tb-nutrition-status:${color};">
    <div class="tb-nutrition-subcard-heading">
      <div>
        <h3>${esc(langText('Alcool', 'Alcohol', t))}</h3>
        <p>${esc(langText('Lecture informative des aliments alcoolisés ajoutés aux repas.', 'Informative view of alcoholic foods added to meals.', t))}</p>
      </div>
      <span class="pill" style="border-color:${color};color:${color};">${esc(alcoholJudge.label || '')}</span>
    </div>
    <div class="tb-sport-stats" style="margin-bottom:10px;">
      <div class="tb-sport-stat"><span>${esc(langText("Aujourd'hui", 'Today', t))}</span><strong>${Math.round(num(alcoholToday.standardDrinks, 0) * 10) / 10} ${esc(langText('verres', 'drinks', t))}</strong></div>
      <div class="tb-sport-stat"><span>${esc(langText('Semaine', 'Week', t))}</span><strong>${Math.round(num(alcoholWeekTotal, 0) * 10) / 10} / 10</strong></div>
      <div class="tb-sport-stat"><span>${esc(langText('Jours avec alcool', 'Drinking days', t))}</span><strong>${num(alcoholDrinkingDays, 0)} / 7</strong></div>
    </div>
    <div class="tb-nutrition-week-grid" style="margin-bottom:8px;">
      ${(Array.isArray(week) ? week : []).map(row => {
        const drinks = num(row.alcoholDrinks, 0);
        const height = Math.max(6, Math.min(74, (drinks / 2) * 74));
        const barColor = drinks > 2.01 ? '#ef4444' : drinks > 0.05 ? '#f59e0b' : '#22c55e';
        const detail = `${row.day} · ${Math.round(drinks * 10) / 10} verre(s) standard`;
        return `<button class="btn small" type="button" data-nutrition-history-date="${esc(row.day)}" title="${esc(detail)}" style="height:92px;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:4px;padding:5px;${row.day === day ? `border-color:${barColor};` : ''}">
          <span style="width:100%;height:${height}px;border-radius:6px 6px 3px 3px;background:linear-gradient(180deg,${barColor},#38bdf8);"></span>
          <small>${esc(shortNutritionDate(row.day))}</small>
        </button>`;
      }).join('')}
    </div>
    <div class="muted" style="font-size:12px;margin-bottom:8px;">${esc(alcoholJudge.note || '')} ${esc(langText("Calcul: 1 verre standard = 10 g d'alcool pur.", 'Calculation: 1 standard drink = 10 g pure alcohol.', t))}</div>
    ${entries.length ? `<div style="display:grid;gap:6px;">
      ${entries.map(entry => `<div style="display:flex;justify-content:space-between;gap:8px;border-top:1px solid rgba(148,163,184,.22);padding-top:6px;">
        <span>${esc(entry.label)} <small class="muted">${Math.round(num(entry.grams, 0))} ml/g</small></span>
        <strong>${Math.round(num(entry.standardDrinks, 0) * 10) / 10} ${esc(langText('verres', 'drinks', t))}</strong>
      </div>`).join('')}
    </div>` : `<div class="muted">${esc(langText('Aucun aliment alcoolise lie au jour selectionne.', 'No alcoholic food linked to the selected day.', t))}</div>`}
  </section>`;
}

export function renderNutritionShell({
  day = '',
  activeSection = 'today',
  base = {},
  goalLabel = '',
  goalTargets = {},
  goalSettings = {},
  syncPanelHtml = '',
  kcalRingColor = '#22c55e',
  kcalPct = 0,
  consumedKcal = 0,
  needsKcal = 0,
  kcalTargetLabel = '',
  kcalDelta = 0,
  drinkWaterMl = 0,
  foodWaterMl = 0,
  proteinTarget = 0,
  carbsTarget = 0,
  fatTarget = 0,
  total = {},
  sportKcal = 0,
  workKcal = 0,
  neatKcal = 0,
  tefKcal = 0,
  goalCockpitHtml = '',
  quickAdd = {},
  hydrationPanelHtml = '',
  sleepPanelHtml = '',
  historyPanelHtml = '',
  alcoholPanelHtml = '',
  sleepLabel = '',
  spentKcal = 0,
  objectiveBalanceKcal = 0,
  balanceLabel = '',
  mealTimelineHtml = '',
  esc = defaultEsc,
  t,
} = {}) {
  const active = normalizeNutritionSection(activeSection);
  return `<section class="tb-nutrition-shell">
    <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;">
      <div>
        <h2 style="margin:0;">${esc(langText('Alimentation', 'Nutrition', t))}</h2>
        <div class="muted" style="margin-top:4px;">${esc(langText('Repas, calories, macros et hydratation, sans lecture medicale.', 'Meals, calories, macros and hydration, without medical interpretation.', t))}</div>
      </div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        <label class="pill" style="display:flex;align-items:center;gap:6px;">${esc(langText('Date', 'Date', t))} <input id="nutrition-date" type="date" value="${esc(day)}" style="width:142px;"></label>
        <span class="pill">${esc(langText('Base', 'Base', t))} ${Math.round(num(base.bmr, 0))} kcal</span>
        <span class="pill">${esc(goalLabel)}${num(goalTargets.offsetKcal, 0) ? ` ${num(goalTargets.offsetKcal, 0) > 0 ? '+' : ''}${Math.round(num(goalTargets.offsetKcal, 0))} kcal` : ''}</span>
        <button class="btn" type="button" id="nutrition-refresh">${esc(langText('Rafraichir', 'Refresh', t))}</button>
      </div>
    </div>
    ${syncPanelHtml}
    ${renderNutritionSectionTabs(active, { esc, t })}
    <div class="tb-nutrition-section-panel" id="nutrition-panel-today" role="tabpanel" aria-labelledby="nutrition-tab-today" data-nutrition-panel="today" ${active === 'today' ? '' : 'hidden'}>
    <div class="tb-nutrition-top">
      <div style="border:1px solid var(--border);border-radius:8px;padding:14px;background:linear-gradient(145deg,rgba(34,197,94,.10),rgba(56,189,248,.08)),var(--panel2);display:grid;place-items:center;">
        <div style="width:min(210px,72vw);aspect-ratio:1;border-radius:50%;background:conic-gradient(${kcalRingColor} ${Math.max(0, Math.min(100, num(kcalPct, 0)))}%, rgba(148,163,184,.18) 0);display:grid;place-items:center;box-shadow:0 18px 44px rgba(15,23,42,.18);">
          <div style="width:68%;aspect-ratio:1;border-radius:50%;background:var(--panel2);display:grid;place-items:center;text-align:center;border:1px solid var(--border);">
            <div>
              <div class="muted" style="font-size:12px;">${esc(langText("Aujourd'hui", 'Today', t))}</div>
              <strong style="display:block;font-size:32px;line-height:1;">${Math.round(num(consumedKcal, 0))}</strong>
              <span class="muted">/ ${Math.round(num(needsKcal, 0))} kcal</span>
              <div class="pill" style="margin-top:8px;color:${kcalRingColor};border-color:${kcalRingColor};">${esc(kcalTargetLabel)} ${Math.abs(Math.round(num(kcalDelta, 0)))}</div>
            </div>
          </div>
        </div>
      </div>
      <div class="tb-nutrition-macro-grid">
        <div style="border:1px solid rgba(56,189,248,.35);border-radius:8px;padding:12px;background:rgba(56,189,248,.10);">${renderProgressBar({ label: langText('Eau bue', 'Drunk water', t), current: drinkWaterMl, target: 2000, unit: 'ml', esc })}</div>
        <div style="border:1px solid rgba(34,197,94,.35);border-radius:8px;padding:12px;background:rgba(34,197,94,.10);">${renderProgressBar({ label: langText('Proteines', 'Protein', t), current: total.protein, target: proteinTarget, unit: 'g', esc })}</div>
        <div style="border:1px solid rgba(245,158,11,.35);border-radius:8px;padding:12px;background:rgba(245,158,11,.10);">${renderProgressBar({ label: langText('Glucides', 'Carbs', t), current: total.carbs, target: carbsTarget, unit: 'g', esc })}</div>
        <div style="border:1px solid rgba(251,113,133,.35);border-radius:8px;padding:12px;background:rgba(251,113,133,.10);">${renderProgressBar({ label: langText('Lipides', 'Fat', t), current: total.fat, target: fatTarget, unit: 'g', esc })}</div>
        <div style="border:1px solid var(--border);border-radius:8px;padding:12px;background:var(--panel2);grid-column:1/-1;">
          <div class="muted" style="font-size:12px;">${esc(langText('Besoin calcule', 'Calculated need', t))}</div>
          <strong>${Math.round(num(base.bmr, 0))} ${esc(langText('base', 'base', t))} + ${Math.round(num(neatKcal, 0))} NEAT + ${Math.round(num(sportKcal, 0))} sport + ${Math.round(num(workKcal, 0))} ${esc(langText('travail', 'work', t))} + ${Math.round(num(tefKcal, 0))} TEF${num(goalTargets.offsetKcal, 0) ? ` ${num(goalTargets.offsetKcal, 0) > 0 ? '+' : '-'} ${Math.abs(Math.round(num(goalTargets.offsetKcal, 0)))} ${esc(langText('objectif', 'goal', t))}` : ''} = ${Math.round(num(needsKcal, 0))} kcal</strong>
          <div class="muted" style="font-size:12px;margin-top:6px;">${esc(langText('NEAT : activite quotidienne hors sport et hors travail saisi. Le travail a la ferme reste dans Travail. TEF : cout estime de la digestion.', 'NEAT: daily activity excluding sport and logged work. Farm work stays under Work. TEF: estimated digestion cost.', t))}</div>
          <div class="muted" style="font-size:12px;margin-top:6px;">${esc(langText('Hydratation : objectif 2 L en eau bue. Eau des aliments', 'Hydration: 2 L target from drunk water. Food water', t))} ${Math.round(num(foodWaterMl, 0))} ml.</div>
          <div class="tb-nutrition-energy-settings" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin-top:10px;">
            <label style="display:grid;gap:4px;"><span class="muted" style="font-size:12px;">${esc(langText('Objectif', 'Goal', t))}</span><select id="nutrition-goal-mode"><option value="bulk" ${goalTargets.mode === 'bulk' ? 'selected' : ''}>${esc(langText('Prise de masse douce', 'Lean bulk', t))}</option><option value="maintenance" ${goalTargets.mode === 'maintenance' ? 'selected' : ''}>${esc(langText('Maintien / recomposition', 'Maintenance / recomp', t))}</option><option value="cut" ${goalTargets.mode === 'cut' ? 'selected' : ''}>${esc(langText('Perte de gras douce', 'Gentle fat loss', t))}</option></select></label>
            <label style="display:grid;gap:4px;"><span class="muted" style="font-size:12px;">${esc(langText('Surplus kcal', 'Kcal surplus', t))}</span><select id="nutrition-goal-surplus" ${goalTargets.mode === 'bulk' ? '' : 'disabled'}><option value="300" ${goalTargets.surplusKcal === 300 ? 'selected' : ''}>+300</option><option value="350" ${goalTargets.surplusKcal === 350 ? 'selected' : ''}>+350</option><option value="400" ${goalTargets.surplusKcal === 400 ? 'selected' : ''}>+400</option><option value="500" ${goalTargets.surplusKcal === 500 ? 'selected' : ''}>+500</option></select></label>
            <label style="display:grid;gap:4px;"><span class="muted" style="font-size:12px;">${esc(langText('Deficit kcal', 'Kcal deficit', t))}</span><select id="nutrition-goal-deficit" ${goalTargets.mode === 'cut' ? '' : 'disabled'}><option value="250" ${goalTargets.deficitKcal === 250 ? 'selected' : ''}>-250</option><option value="300" ${goalTargets.deficitKcal === 300 ? 'selected' : ''}>-300</option><option value="400" ${goalTargets.deficitKcal === 400 ? 'selected' : ''}>-400</option><option value="500" ${goalTargets.deficitKcal === 500 ? 'selected' : ''}>-500</option></select></label>
            <label style="display:grid;gap:4px;"><span class="muted" style="font-size:12px;">${esc(langText('NEAT quotidien (kcal)', 'Daily NEAT (kcal)', t))}</span><input id="nutrition-goal-neat" type="number" min="0" max="2000" step="25" value="${esc(String(num(goalSettings.neatKcal, 300)))}"></label>
            <label style="display:grid;gap:4px;"><span class="muted" style="font-size:12px;">TEF</span><select id="nutrition-goal-tef"><option value="8" ${num(goalSettings.tefRatePct, 10) === 8 ? 'selected' : ''}>8 %</option><option value="10" ${num(goalSettings.tefRatePct, 10) === 10 ? 'selected' : ''}>10 %</option><option value="12" ${num(goalSettings.tefRatePct, 10) === 12 ? 'selected' : ''}>12 %</option></select></label>
            <label style="display:grid;gap:4px;"><span class="muted" style="font-size:12px;">${esc(langText('Poids cible', 'Target weight', t))}</span><input id="nutrition-goal-weight" type="number" min="35" max="180" step="0.1" value="${esc(String(num(goalSettings.targetWeightKg, 0)))}"></label>
            <label style="display:grid;gap:4px;"><span class="muted" style="font-size:12px;">${esc(langText('Rythme kg/sem.', 'Pace kg/week', t))}</span><input id="nutrition-goal-rate" type="number" min="0.1" max="0.8" step="0.05" value="${esc(String(num(goalSettings.weeklyRateKg, 0.25)))}"></label>
          </div>
          ${goalCockpitHtml}
        </div>
      </div>
    </div>
    </div>
    <div class="tb-nutrition-section-panel" id="nutrition-panel-meals" role="tabpanel" aria-labelledby="nutrition-tab-meals" data-nutrition-panel="meals" ${active === 'meals' ? '' : 'hidden'}>
    <div class="tb-nutrition-layout">
      <div style="display:flex;flex-direction:column;gap:12px;">
        ${renderQuickAddPanel({ ...quickAdd, esc, t })}
      </div>
      <div style="border:1px solid var(--border);border-radius:8px;padding:12px;background:var(--panel2);">
        <h3 style="margin:0 0 10px;">${esc(langText('Jour selectionne', 'Selected day', t))} · ${esc(day)}</h3>
        <div class="tb-sport-stats" style="margin-bottom:12px;">
          <div class="tb-sport-stat"><span>kcal</span><strong>${Math.round(num(total.kcal, 0))}</strong></div>
          <div class="tb-sport-stat"><span>${esc(langText('Proteines', 'Protein', t))}</span><strong>${formatMacro(total.protein)}</strong></div>
          <div class="tb-sport-stat"><span>${esc(langText('Glucides', 'Carbs', t))}</span><strong>${formatMacro(total.carbs)}</strong></div>
          <div class="tb-sport-stat"><span>${esc(langText('Lipides', 'Fat', t))}</span><strong>${formatMacro(total.fat)}</strong></div>
          <div class="tb-sport-stat"><span>${esc(langText('Eau bue', 'Drunk water', t))}</span><strong>${Math.round(num(drinkWaterMl, 0))} ml</strong></div>
          <div class="tb-sport-stat"><span>${esc(langText('Sommeil', 'Sleep', t))}</span><strong>${esc(sleepLabel)}</strong></div>
          <div class="tb-sport-stat"><span>${esc(langText('Balance', 'Balance', t))}</span><strong>${Math.round(num(objectiveBalanceKcal, 0))} kcal</strong></div>
        </div>
        <div class="muted" style="margin:-4px 0 12px;">
          ${esc(langText('Depense estimee', 'Estimated spend', t))}: ${Math.round(num(spentKcal, 0))} kcal =
          ${esc(langText('base', 'base', t))} ${Math.round(num(base.bmr, 0))}
          + NEAT ${Math.round(num(neatKcal, 0))}
          + sport ${Math.round(num(sportKcal, 0))}
          + ${esc(langText('travail', 'work', t))} ${Math.round(num(workKcal, 0))}
          + TEF ${Math.round(num(tefKcal, 0))}.
          ${esc(langText('Tu es', 'You are', t))} ${esc(balanceLabel)} ${Math.abs(Math.round(num(objectiveBalanceKcal, 0)))} kcal.
        </div>
        <div style="display:grid;gap:10px;margin-top:12px;">
          <h3 style="margin:0;">${esc(langText('Timeline repas', 'Meal timeline', t))}</h3>
          ${mealTimelineHtml}
        </div>
      </div>
    </div>
    </div>
    <div class="tb-nutrition-section-panel tb-nutrition-recovery-layout" id="nutrition-panel-recovery" role="tabpanel" aria-labelledby="nutrition-tab-recovery" data-nutrition-panel="recovery" ${active === 'recovery' ? '' : 'hidden'}>
      ${hydrationPanelHtml}
      ${sleepPanelHtml}
      ${alcoholPanelHtml}
    </div>
    <div class="tb-nutrition-section-panel" id="nutrition-panel-history" role="tabpanel" aria-labelledby="nutrition-tab-history" data-nutrition-panel="history" ${active === 'history' ? '' : 'hidden'}>
      ${historyPanelHtml}
    </div>
  </section>`;
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
