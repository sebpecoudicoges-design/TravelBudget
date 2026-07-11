import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('nutrition domain extraction contract', () => {
  const bridge = fs.readFileSync('src/app/bridge.js', 'utf8');
  const legacy = fs.readFileSync('public/legacy/js/48_nutrition_ui.js', 'utf8');
  const repository = fs.readFileSync('src/data/nutritionRepository.js', 'utf8');
  const store = fs.readFileSync('src/features/nutrition/nutritionStore.js', 'utf8');
  const view = fs.readFileSync('src/features/nutrition/nutritionView.js', 'utf8');

  it('exposes repository, store and views through the modular bridge', () => {
    expect(bridge).toContain("import { createNutritionRepository } from '../data/nutritionRepository.js'");
    expect(bridge).toContain("import { createNutritionStore } from '../features/nutrition/nutritionStore.js'");
    expect(bridge).toContain("import * as nutritionView from '../features/nutrition/nutritionView.js'");
    expect(bridge).toContain('window.Data.nutritionRepository');
    expect(bridge).toContain('window.Data.nutritionStore');
    expect(bridge).toContain('window.UI.nutritionView = nutritionView');
  });

  it('keeps legacy Nutrition routed through repository, store and extracted view panels', () => {
    expect(legacy).toContain('window.Data?.nutritionRepository');
    expect(legacy).toContain('window.Data?.nutritionStore');
    expect(legacy).toContain('window.UI?.nutritionView');
    expect(legacy).toContain('nutritionStore()?.hydrateRemote');
    expect(legacy).toContain('nutritionStore()?.hydrateLocal');
    expect(legacy).toContain('view().renderQuickAddPanel');
    expect(legacy).toContain('view().renderMealTimeline');
    expect(legacy).toContain('view().renderHydrationPanel');
    expect(legacy).toContain('view().renderSleepPanel');
    expect(legacy).toContain('view().renderGoalCockpit');
    expect(legacy).toContain('view().renderAlcoholPanel');
    expect(legacy).toContain('view().renderActiveWeekDashboard');
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
    expect(view).toContain('renderMealTimeline');
    expect(view).toContain('renderHistoryPanel');
    expect(view).toContain('renderHydrationPanel');
    expect(view).toContain('renderSleepPanel');
    expect(view).toContain('renderGoalCockpit');
  });
});
