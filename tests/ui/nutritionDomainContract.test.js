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
    expect(legacy).toContain('nutritionStore()?.hydrateRemote');
    expect(legacy).toContain('nutritionStore()?.hydrateLocal');
    expect(legacy).toContain('view().renderQuickAddPanel');
    expect(legacy).toContain('view().renderNutritionSyncPanel');
    expect(legacy).toContain('view().renderMealTimeline');
    expect(legacy).toContain('view().renderHydrationPanel');
    expect(legacy).toContain('view().renderSleepPanel');
    expect(legacy).toContain('view().renderGoalCockpit');
    expect(legacy).toContain('view().renderAlcoholPanel');
    expect(legacy).toContain('view().renderActiveWeekDashboard');
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

  it('keeps the extracted modules responsible for their domain surfaces', () => {
    expect(repository).toContain('async syncLocalRow');
    expect(repository).toContain('async upsertMeal');
    expect(repository).toContain('async insertMealItem');
    expect(repository).toContain('mergeSleepRows');
    expect(store).toContain('hydrateRemote');
    expect(store).toContain('hydrateLocal');
    expect(store).toContain('appSnapshot');
    expect(view).toContain('renderQuickAddPanel');
    expect(view).toContain('renderNutritionSyncPanel');
    expect(view).toContain('renderMealTimeline');
    expect(view).toContain('renderHistoryPanel');
    expect(view).toContain('renderHydrationPanel');
    expect(view).toContain('renderSleepPanel');
    expect(view).toContain('renderGoalCockpit');
    expect(legacy).not.toContain('Synchro alimentation en attente", "Pending nutrition sync');
    expect(legacy).not.toContain('rows.slice(0, 8).map((row, index)');
  });
});
