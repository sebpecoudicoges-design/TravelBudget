import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('nutrition domain extraction contract', () => {
  const bootstrap = fs.readFileSync('public/legacy/js/07_supabase_bootstrap.js', 'utf8');
  const bridge = fs.readFileSync('src/app/bridge.js', 'utf8');
  const main = fs.readFileSync('src/main.js', 'utf8');
  const legacy = fs.readFileSync('public/legacy/js/48_nutrition_ui.js', 'utf8');
  const repository = fs.readFileSync('src/data/nutritionRepository.js', 'utf8');
  const store = fs.readFileSync('src/features/nutrition/nutritionStore.js', 'utf8');
  const view = fs.readFileSync('src/features/nutrition/nutritionView.js', 'utf8');
  const offlineQueue = fs.readFileSync('public/legacy/js/00_offline_queue.js', 'utf8');
  const offlineState = fs.readFileSync('public/legacy/js/00_offline.js', 'utf8');
  const premiumTheme = fs.readFileSync('src/ui/premium-theme.css', 'utf8');
  const deepRefactorMigration = fs.readFileSync('supabase/migrations/20260815011706_nutrition_sections_and_hydration_time_10_5_344.sql', 'utf8');

  it('exposes repository, store and views through the modular bridge', () => {
    expect(bridge).toContain("import { createNutritionRepository } from '../data/nutritionRepository.js'");
    expect(bridge).toContain("import { createNutritionStore } from '../features/nutrition/nutritionStore.js'");
    expect(bridge).toContain('window.Data.nutritionRepository');
    expect(bridge).toContain('window.Data.nutritionStore');
    expect(main).toContain("import('./features/nutrition/nutritionView.js')");
    expect(main).toContain('window.UI.nutritionView');
    expect(bridge).not.toContain("import * as nutritionView from '../features/nutrition/nutritionView.js'");
  });

  it('keeps legacy Nutrition routed through repository, store and extracted view panels', () => {
    expect(legacy).toContain('window.Data?.nutritionRepository');
    expect(legacy).toContain('window.Data?.nutritionStore');
    expect(legacy).toContain('window.UI?.nutritionView');
    expect(legacy).toContain('window.tbLoadHealthGoal = loadNutritionGoal;');
    expect(legacy).not.toContain('window.tbSaveHealthGoal');
    expect(legacy).not.toContain('window.tbHealthGoalTargets');
    expect(legacy).toContain('nutritionStore()?.hydrateRemote');
    expect(legacy).toContain('nutritionStore()?.hydrateLocal');
    expect(legacy).toContain('view().renderNutritionShell');
    expect(legacy).toContain('view().renderNutritionSyncPanel');
    expect(legacy).toContain('view().renderGoalCockpit');
    expect(legacy).toContain('view().renderAlcoholPanel');
    expect(view).toContain('renderNutritionSectionTabs');
    expect(view).not.toContain('renderActiveWeekDashboard');
  });

  it('hydrates Sport and Work activity calories without loading their UI domains first', () => {
    expect(bootstrap).toContain('window.tbEnsureActivityData');
    expect(bootstrap).toContain('tables.sport_sessions');
    expect(bootstrap).toContain('tables.work_days');
    expect(bootstrap).toContain('window.tbActivityKcalForDay');
    expect(bootstrap).toContain('state.activityDataLoaded = true');
    expect(bootstrap).toContain('const canUseActivityCache = !force && window.state.activityDataLoaded === true;');
    expect(legacy).toContain('ensureActivityDataForNutrition');
    expect(legacy).toContain('window.tbEnsureActivityData({ reason: `nutrition:${reason || "render"}` })');
    expect(legacy).toContain('window.tbActivityKcalForDay(day)?.sportKcal');
    expect(legacy).toContain('window.tbActivityKcalForDay(day)?.workKcal');
  });

  it('hydrates Nutrition KPI rows without requiring a first visit to Nutrition', () => {
    expect(bootstrap).toContain('window.tbEnsureNutritionKpiData');
    expect(bootstrap).toContain('tables.nutrition_meals');
    expect(bootstrap).toContain('tables.nutrition_meal_items');
    expect(bootstrap).toContain('state.nutritionKpiDataLoaded = true');
    expect(bootstrap).toContain('window.addEventListener("tb:auth_scope_changed"');
    expect(bootstrap).toContain('index += 80');
    const kpi = fs.readFileSync('public/legacy/js/11_kpi_render_micro_animation.js', 'utf8');
    expect(kpi).toContain('window.tbEnsureNutritionKpiData({ reason: "kpi" })');
  });

  it('bounds Nutrition recovery work and chunks remote item requests', () => {
    expect(legacy).toContain('const rows = allRows.slice(0, 25);');
    expect(legacy).toContain('index += 80');
    expect(legacy).toContain('Promise.all(chunks.map(ids => c.from(table("nutrition_meal_items"))');
    expect(legacy).toContain('upsertOptimisticNutritionRow(row, { publish: false })');
    expect(legacy).toContain('publishNutrition("pending-merge")');
  });

  it('keeps meal and favorite additions responsive through one local batch and deferred sync', () => {
    expect(repository).toContain('export function saveLocalNutritionRowsOnce');
    expect(legacy).toContain('saveLocalNutritionRowsOnce([localRow])');
    expect(legacy).toContain('saveLocalNutritionRowsOnce(rows)');
    expect(legacy).toContain('rows.forEach(row => upsertOptimisticNutritionRow(row, { publish: false }))');
    expect(legacy).toContain('requestNutritionSync("meal-favorite")');
    expect(legacy).toContain('if (loadLocalMeals().length) enqueueNutritionSync();');
    expect(legacy).toContain('if (!loadLocalMeals().length) return false;');
    expect(legacy).toContain('nutritionQuickAddHasFocus()');
    expect(legacy).toContain('requestNutritionRefreshWhenIdle(reason || "mutation")');
    expect(legacy).toContain('function scheduleNutritionRender(reason)');
    expect(legacy).toContain('scheduleNutritionRender("save")');
    expect(legacy).toContain('scheduleNutritionRender("meal-favorite")');
    expect(legacy).toContain('renderFoodOptions(root, key)');
    expect(legacy).not.toContain('renderNutrition("food-pick")');
    expect(legacy).toContain('ev?.detail?.offline === false && loadLocalMeals().length');
    expect(offlineState).toContain('const wasUnavailable = Boolean(');
    expect(offlineState).toContain('if (wasUnavailable) {');
    expect(legacy).not.toContain('publishNutrition("save-local");\n        enqueueNutritionSync();');
    expect(legacy).not.toContain('publishNutrition("meal-favorite-local");\n      enqueueNutritionSync();');
    expect(offlineQueue).toContain('const needsGlobalRefresh = syncedKinds.some');
    expect(offlineQueue).toContain('window.tbNutritionRefreshAfterSync');
    expect(legacy).toContain('throw new Error("Nutrition sync incomplete: pending local rows remain")');
    expect(offlineQueue).not.toContain('window.tbSportRefreshAfterSync');
    expect(legacy).not.toContain('renderNutrition("save-optimistic")');
    expect(legacy).not.toContain('syncLocalNutritionRows("meal-favorite", { forceOnline: true })');
    expect(view).toContain('id="nutrition-meal-favorites"');
  });

  it('keeps the extracted modules responsible for their domain surfaces', () => {
    expect(repository).toContain('async syncLocalRow');
    expect(repository).toContain('async upsertMeal');
    expect(repository).toContain('async insertMealItem');
    expect(repository).toContain('mergeSleepRows');
    expect(store).toContain('hydrateRemote');
    expect(store).toContain('hydrateLocal');
    expect(store).toContain('appSnapshot');
    expect(view).toContain('renderQuickAddPanel');
    expect(view).toContain('renderNutritionShell');
    expect(view).toContain('renderNutritionSyncPanel');
    expect(view).toContain('renderMealTimeline');
    expect(view).toContain('renderHistoryPanel');
    expect(view).toContain('renderHydrationPanel');
    expect(view).toContain('renderSleepPanel');
    expect(view).toContain('data-nutrition-section');
    expect(view).toContain('data-nutrition-water-delete');
    expect(repository).toContain('consumed_time');
    expect(legacy).toContain('deleteWaterEntry');
    expect(legacy).toContain('.select("id,user_id,travel_id,meal_date,meal_type,label,notes,water_ml,consumed_time,created_at")');
    expect(view).toContain('renderGoalCockpit');
    expect(legacy).toContain('cookingEditorOpen');
    expect(legacy).toContain('id="nutrition-cook-start"');
    expect(legacy).toContain('id="nutrition-cook-editor"');
    expect(legacy).toContain('id="nutrition-cook-save"');
    expect(legacy).toContain('saveCookingPortion(root)');
    expect(legacy).toContain('publishNutrition("cooking-portion-local")');
    expect(legacy).not.toContain('Synchro alimentation en attente", "Pending nutrition sync');
    expect(legacy).not.toContain('rows.slice(0, 8).map((row, index)');
    expect(legacy).not.toContain('<section class="tb-nutrition-shell">');
    expect(legacy).not.toContain('Comparaison besoins / consomme');
  });

  it('contracts the deep Nutrition spaces, responsive navigation and hydration lineage', () => {
    expect(view).toContain("Object.freeze(['today', 'meals', 'recovery', 'history'])");
    expect(view).toContain('role="tablist"');
    expect(view).toContain('role="tabpanel"');
    expect(legacy).toContain("['ArrowLeft', 'ArrowRight', 'Home', 'End']");
    expect(premiumTheme).toContain('.tb-nutrition-section-tabs');
    expect(premiumTheme).toContain('overflow-x: auto');
    expect(premiumTheme).toContain('body.theme-dark .tb-nutrition-subcard');
    expect(premiumTheme).toContain('@media (max-width: 460px)');
    expect(deepRefactorMigration).toContain('add column if not exists consumed_time');
    expect(deepRefactorMigration).toContain('nutrition_meals_user_day_consumed_time_idx');
    expect(deepRefactorMigration).toContain('Retest journal hydratation 10.5.344');
  });
});
