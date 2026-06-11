/* =========================
   Nutrition module
   - Food library, quick meals, kcal/macros, hydration
   ========================= */
(function () {
  const CACHE = { loaded: false, loading: false, foods: [], meals: [], items: [], error: "", foodQuery: "" };
  const FALLBACK_FOODS = [
    { key: "rice_cooked", name: "Riz cuit", servingGrams: 150, kcalPer100g: 130, proteinPer100g: 2.7, carbsPer100g: 28, fatPer100g: 0.3, fiberPer100g: 0.4 },
    { key: "rice_onion_zucchini", name: "Riz oignon courgette", servingGrams: 250, kcalPer100g: 112, proteinPer100g: 2.5, carbsPer100g: 22, fatPer100g: 1.8, fiberPer100g: 1.5 },
    { key: "pasta_cooked", name: "Pates cuites", servingGrams: 150, kcalPer100g: 157, proteinPer100g: 5.8, carbsPer100g: 30.9, fatPer100g: 0.9, fiberPer100g: 1.8 },
    { key: "pasta_chicken_onion_cream", name: "Pates creme fraiche oignon poulet", servingGrams: 300, kcalPer100g: 185, proteinPer100g: 12, carbsPer100g: 19, fatPer100g: 6.8, fiberPer100g: 1.2 },
    { key: "chicken_breast", name: "Blanc de poulet", servingGrams: 120, kcalPer100g: 165, proteinPer100g: 31, carbsPer100g: 0, fatPer100g: 3.6 },
    { key: "chicken_thigh", name: "Cuisse de poulet", servingGrams: 130, kcalPer100g: 209, proteinPer100g: 26, carbsPer100g: 0, fatPer100g: 10.9 },
    { key: "tuna_natural", name: "Thon naturel", servingGrams: 100, kcalPer100g: 116, proteinPer100g: 26, carbsPer100g: 0, fatPer100g: 1 },
    { key: "salmon", name: "Saumon", servingGrams: 120, kcalPer100g: 208, proteinPer100g: 20, carbsPer100g: 0, fatPer100g: 13 },
    { key: "egg", name: "Oeuf", servingGrams: 50, kcalPer100g: 143, proteinPer100g: 12.6, carbsPer100g: 0.7, fatPer100g: 9.5 },
    { key: "fresh_cream", name: "Creme fraiche", servingGrams: 30, kcalPer100g: 292, proteinPer100g: 2.4, carbsPer100g: 3.2, fatPer100g: 30 },
    { key: "butter", name: "Beurre", servingGrams: 10, kcalPer100g: 717, proteinPer100g: 0.9, carbsPer100g: 0.1, fatPer100g: 81 },
    { key: "milk", name: "Lait demi-ecreme", servingGrams: 200, kcalPer100g: 47, proteinPer100g: 3.4, carbsPer100g: 4.8, fatPer100g: 1.6, waterMlPer100g: 90 },
    { key: "yogurt_natural", name: "Yaourt nature", servingGrams: 125, kcalPer100g: 61, proteinPer100g: 3.5, carbsPer100g: 4.7, fatPer100g: 3.3 },
    { key: "yogurt_greek", name: "Yaourt grec", servingGrams: 125, kcalPer100g: 97, proteinPer100g: 9, carbsPer100g: 3.6, fatPer100g: 5 },
    { key: "yogurt_fruit", name: "Yaourt aux fruits", servingGrams: 125, kcalPer100g: 95, proteinPer100g: 3.5, carbsPer100g: 15, fatPer100g: 2.5 },
    { key: "fromage_blanc_0", name: "Fromage blanc 0%", servingGrams: 125, kcalPer100g: 45, proteinPer100g: 8, carbsPer100g: 4, fatPer100g: 0.2 },
    { key: "fromage_blanc_3", name: "Fromage blanc 3%", servingGrams: 125, kcalPer100g: 76, proteinPer100g: 7.7, carbsPer100g: 4, fatPer100g: 3 },
    { key: "skyr", name: "Skyr", servingGrams: 140, kcalPer100g: 63, proteinPer100g: 10, carbsPer100g: 4, fatPer100g: 0.2 },
    { key: "muesli", name: "Muesli", servingGrams: 45, kcalPer100g: 365, proteinPer100g: 10, carbsPer100g: 62, fatPer100g: 7, fiberPer100g: 8 },
    { key: "granola", name: "Granola", servingGrams: 45, kcalPer100g: 450, proteinPer100g: 9, carbsPer100g: 64, fatPer100g: 16, fiberPer100g: 7 },
    { key: "oats", name: "Flocons avoine", servingGrams: 50, kcalPer100g: 389, proteinPer100g: 16.9, carbsPer100g: 66.3, fatPer100g: 6.9, fiberPer100g: 10.6 },
    { key: "cornflakes", name: "Corn flakes", servingGrams: 35, kcalPer100g: 357, proteinPer100g: 7.5, carbsPer100g: 84, fatPer100g: 0.4, fiberPer100g: 3 },
    { key: "biscuit", name: "Biscuit", servingGrams: 20, kcalPer100g: 480, proteinPer100g: 6, carbsPer100g: 70, fatPer100g: 20, fiberPer100g: 2 },
    { key: "belvita", name: "Belvita", servingGrams: 12.5, kcalPer100g: 455, proteinPer100g: 7.4, carbsPer100g: 67, fatPer100g: 16, fiberPer100g: 6.5 },
    { key: "rice_cake", name: "Galette de riz", servingGrams: 8, kcalPer100g: 387, proteinPer100g: 7.5, carbsPer100g: 81, fatPer100g: 3, fiberPer100g: 3 },
    { key: "cake_slice", name: "Gateau part", servingGrams: 80, kcalPer100g: 380, proteinPer100g: 5, carbsPer100g: 55, fatPer100g: 16, fiberPer100g: 1.5 },
    { key: "chocolate_cake", name: "Gateau chocolat", servingGrams: 80, kcalPer100g: 410, proteinPer100g: 5.5, carbsPer100g: 52, fatPer100g: 20, fiberPer100g: 2.5 },
    { key: "cookie", name: "Cookie", servingGrams: 30, kcalPer100g: 490, proteinPer100g: 6, carbsPer100g: 64, fatPer100g: 24, fiberPer100g: 2 },
    { key: "dark_chocolate", name: "Chocolat noir", servingGrams: 20, kcalPer100g: 546, proteinPer100g: 4.9, carbsPer100g: 61, fatPer100g: 31, fiberPer100g: 7 },
    { key: "jam", name: "Confiture", servingGrams: 20, kcalPer100g: 250, proteinPer100g: 0.3, carbsPer100g: 60, fatPer100g: 0.1, fiberPer100g: 1 },
    { key: "honey", name: "Miel", servingGrams: 15, kcalPer100g: 304, proteinPer100g: 0.3, carbsPer100g: 82, fatPer100g: 0 },
    { key: "banana", name: "Banane", servingGrams: 120, kcalPer100g: 89, proteinPer100g: 1.1, carbsPer100g: 22.8, fatPer100g: 0.3, fiberPer100g: 2.6 },
    { key: "apple", name: "Pomme", servingGrams: 150, kcalPer100g: 52, proteinPer100g: 0.3, carbsPer100g: 13.8, fatPer100g: 0.2, fiberPer100g: 2.4 },
    { key: "orange", name: "Orange", servingGrams: 130, kcalPer100g: 47, proteinPer100g: 0.9, carbsPer100g: 11.8, fatPer100g: 0.1, fiberPer100g: 2.4 },
    { key: "kiwi", name: "Kiwi", servingGrams: 75, kcalPer100g: 61, proteinPer100g: 1.1, carbsPer100g: 14.7, fatPer100g: 0.5, fiberPer100g: 3 },
    { key: "strawberry", name: "Fraises", servingGrams: 150, kcalPer100g: 32, proteinPer100g: 0.7, carbsPer100g: 7.7, fatPer100g: 0.3, fiberPer100g: 2 },
    { key: "grape", name: "Raisin", servingGrams: 120, kcalPer100g: 69, proteinPer100g: 0.7, carbsPer100g: 18, fatPer100g: 0.2, fiberPer100g: 0.9 },
    { key: "pear", name: "Poire", servingGrams: 160, kcalPer100g: 57, proteinPer100g: 0.4, carbsPer100g: 15, fatPer100g: 0.1, fiberPer100g: 3.1 },
    { key: "peach", name: "Peche", servingGrams: 150, kcalPer100g: 39, proteinPer100g: 0.9, carbsPer100g: 9.5, fatPer100g: 0.3, fiberPer100g: 1.5 },
    { key: "zucchini", name: "Courgette", servingGrams: 150, kcalPer100g: 17, proteinPer100g: 1.2, carbsPer100g: 3.1, fatPer100g: 0.3, fiberPer100g: 1 },
    { key: "onion", name: "Oignon", servingGrams: 80, kcalPer100g: 40, proteinPer100g: 1.1, carbsPer100g: 9.3, fatPer100g: 0.1, fiberPer100g: 1.7 },
    { key: "tomato", name: "Tomate", servingGrams: 120, kcalPer100g: 18, proteinPer100g: 0.9, carbsPer100g: 3.9, fatPer100g: 0.2, fiberPer100g: 1.2 },
    { key: "carrot", name: "Carotte", servingGrams: 100, kcalPer100g: 41, proteinPer100g: 0.9, carbsPer100g: 9.6, fatPer100g: 0.2, fiberPer100g: 2.8 },
    { key: "broccoli", name: "Brocoli", servingGrams: 150, kcalPer100g: 34, proteinPer100g: 2.8, carbsPer100g: 6.6, fatPer100g: 0.4, fiberPer100g: 2.6 },
    { key: "green_beans", name: "Haricots verts", servingGrams: 150, kcalPer100g: 31, proteinPer100g: 1.8, carbsPer100g: 7, fatPer100g: 0.2, fiberPer100g: 3.4 },
    { key: "potato_cooked", name: "Pomme de terre cuite", servingGrams: 180, kcalPer100g: 87, proteinPer100g: 1.9, carbsPer100g: 20.1, fatPer100g: 0.1, fiberPer100g: 1.8 },
    { key: "sweet_potato", name: "Patate douce", servingGrams: 180, kcalPer100g: 86, proteinPer100g: 1.6, carbsPer100g: 20.1, fatPer100g: 0.1, fiberPer100g: 3 },
    { key: "avocado", name: "Avocat", servingGrams: 100, kcalPer100g: 160, proteinPer100g: 2, carbsPer100g: 8.5, fatPer100g: 14.7, fiberPer100g: 6.7 },
    { key: "bread", name: "Pain", servingGrams: 50, kcalPer100g: 265, proteinPer100g: 9, carbsPer100g: 49, fatPer100g: 3.2, fiberPer100g: 2.7 },
    { key: "cheese_grated", name: "Fromage rape", servingGrams: 30, kcalPer100g: 402, proteinPer100g: 25, carbsPer100g: 1.3, fatPer100g: 33 },
    { key: "lentils_cooked", name: "Lentilles cuites", servingGrams: 180, kcalPer100g: 116, proteinPer100g: 9, carbsPer100g: 20, fatPer100g: 0.4, fiberPer100g: 7.9 },
    { key: "chickpeas_cooked", name: "Pois chiches cuits", servingGrams: 150, kcalPer100g: 164, proteinPer100g: 8.9, carbsPer100g: 27.4, fatPer100g: 2.6, fiberPer100g: 7.6 },
    { key: "olive_oil", name: "Huile olive", servingGrams: 10, kcalPer100g: 884, proteinPer100g: 0, carbsPer100g: 0, fatPer100g: 100 },
    { key: "coffee", name: "Cafe", servingGrams: 200, kcalPer100g: 1, proteinPer100g: 0.1, carbsPer100g: 0, fatPer100g: 0, waterMlPer100g: 99 },
    { key: "tea", name: "The", servingGrams: 250, kcalPer100g: 1, proteinPer100g: 0, carbsPer100g: 0.2, fatPer100g: 0, waterMlPer100g: 99 },
    { key: "water", name: "Eau", servingGrams: 250, kcalPer100g: 0, proteinPer100g: 0, carbsPer100g: 0, fatPer100g: 0, waterMlPer100g: 100 },
  ];

  function txt(fr, en) { try { return String(window.TB_LANG || "fr").toLowerCase() === "en" ? en : fr; } catch (_) { return fr; } }
  function esc(s) {
    if (typeof window.escapeHTML === "function") return window.escapeHTML(s);
    return String(s || "").replace(/[&<>"']/g, ch => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[ch]));
  }
  function table(name) { return window.TB_CONST?.TABLES?.[name] || name; }
  function client() { return window.sb || null; }
  function uid() { return window.sbUser?.id || null; }
  function activeTravelId() { return window.state?.activeTravelId || null; }
  function todayISO() { try { return window.toLocalISODate(new Date()); } catch (_) { return new Date().toISOString().slice(0, 10); } }
  function localDateISO(value) {
    const raw = String(value || "");
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    const d = new Date(raw);
    if (Number.isFinite(d.getTime())) {
      try { if (typeof window.toLocalISODate === "function") return window.toLocalISODate(d); } catch (_) {}
      return d.toISOString().slice(0, 10);
    }
    return raw.slice(0, 10);
  }
  function n(v, fallback) { const x = Number(v); return Number.isFinite(x) ? x : (fallback || 0); }
  function foodCacheKey() { return window.TB_CONST?.LS_KEYS?.nutrition_food_cache || "travelbudget_nutrition_food_cache_v1"; }
  function localMealKey() { return `${window.TB_CONST?.LS_KEYS?.nutrition_local_meals || "travelbudget_nutrition_local_meals_v1"}::${uid() || "anon"}`; }
  function rules() { return window.Core?.nutritionRules || {}; }
  function normalizeFood(row) { return rules().normalizeFoodRow ? rules().normalizeFoodRow(row) : row; }
  function nutritionForGrams(food, grams) { return rules().nutritionForGrams ? rules().nutritionForGrams(food, grams) : { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, waterMl: 0 }; }
  function sumNutrition(items) { return rules().sumNutrition ? rules().sumNutrition(items) : { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, waterMl: 0 }; }
  function loadCachedFoods() {
    try { const rows = JSON.parse(localStorage.getItem(foodCacheKey()) || "[]"); return Array.isArray(rows) ? rows : []; } catch (_) { return []; }
  }
  function saveCachedFoods(rows) {
    try { localStorage.setItem(foodCacheKey(), JSON.stringify((rows || []).slice(0, 500))); } catch (_) {}
  }
  function loadLocalMeals() {
    try { const rows = JSON.parse(localStorage.getItem(localMealKey()) || "[]"); return Array.isArray(rows) ? rows : []; } catch (_) { return []; }
  }
  function saveLocalMeals(rows) {
    try { localStorage.setItem(localMealKey(), JSON.stringify((rows || []).slice(0, 200))); } catch (_) {}
  }
  function ensureNutritionShell() {
    const tabs = document.querySelector(".tabs") || document.querySelector(".app-tabs");
    if (tabs && !document.getElementById("tab-nutrition")) {
      const tab = document.createElement("div");
      tab.id = "tab-nutrition";
      tab.className = "tab";
      tab.textContent = txt("Alimentation", "Nutrition");
      tab.onclick = () => openNutritionView();
      const ref = document.getElementById("tab-work") || document.getElementById("tab-sport") || tabs.lastElementChild;
      if (ref?.parentNode === tabs) tabs.insertBefore(tab, ref.nextSibling);
      else tabs.appendChild(tab);
    }
    const wrap = document.querySelector(".wrap") || document.body;
    if (!document.getElementById("view-nutrition")) {
      const view = document.createElement("div");
      view.id = "view-nutrition";
      view.className = "hidden";
      view.innerHTML = '<div id="nutrition-root" class="card"></div>';
      const ref = document.getElementById("view-work") || document.getElementById("view-sport") || wrap.lastElementChild;
      if (ref?.parentNode === wrap) wrap.insertBefore(view, ref.nextSibling);
      else wrap.appendChild(view);
    }
  }
  function openNutritionView() {
    if (typeof window.showView === "function") {
      window.showView("nutrition");
      return;
    }
    try { if (typeof activeView !== "undefined") activeView = "nutrition"; } catch (_) {}
    try { window.activeView = "nutrition"; } catch (_) {}
    try { if (typeof window.setActiveTab === "function") window.setActiveTab("nutrition"); } catch (_) {}
    try {
      document.getElementById("tab-nutrition")?.classList.add("active");
      document.getElementById("view-nutrition")?.classList.remove("hidden");
    } catch (_) {}
    renderNutrition("tab-fallback");
  }
  function publishNutrition(reason) {
    if (!window.state) window.state = {};
    window.state.nutritionMeals = CACHE.meals.slice();
    window.state.nutritionMealItems = CACHE.items.slice();
    try { if (typeof window.tbSaveOfflineSnapshot === "function") window.tbSaveOfflineSnapshot(`nutrition:${reason || "load"}`); } catch (_) {}
  }
  async function loadNutrition(options = {}) {
    if (CACHE.loading || (CACHE.loaded && !options.force)) return false;
    CACHE.loading = true;
    CACHE.error = "";
    let changed = false;
    const cachedFoods = loadCachedFoods();
    CACHE.foods = (cachedFoods.length ? cachedFoods : FALLBACK_FOODS).map(normalizeFood).filter(Boolean);
    const c = client();
    try {
      if (c) {
        try {
          const foods = await c.from(table("nutrition_foods"))
            .select("key,name,brand,serving_grams,kcal_per_100g,protein_per_100g,carbs_per_100g,fat_per_100g,fiber_per_100g,water_ml_per_100g")
            .eq("is_active", true)
            .order("name", { ascending: true })
            .limit(500);
          if (foods.error) throw foods.error;
          const normalizedFoods = (foods.data || []).map(normalizeFood).filter(Boolean);
          if (normalizedFoods.length) {
            CACHE.foods = normalizedFoods;
            saveCachedFoods(normalizedFoods);
          }
        } catch (e) {
          CACHE.error = e?.message || String(e);
          console.warn("[nutrition] food library fallback", CACHE.error);
        }
      }
      if (c && uid()) {
        try {
          const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
          const meals = await c.from(table("nutrition_meals"))
            .select("id,user_id,travel_id,meal_date,meal_type,label,notes,water_ml,created_at")
            .eq("user_id", uid())
            .gte("meal_date", since)
            .order("meal_date", { ascending: false })
            .order("created_at", { ascending: false });
          if (meals.error) throw meals.error;
          CACHE.meals = meals.data || [];
          const mealIds = CACHE.meals.map(row => row.id).filter(Boolean);
          if (mealIds.length) {
            const items = await c.from(table("nutrition_meal_items"))
              .select("id,user_id,meal_id,food_key,label,grams,kcal,protein_g,carbs_g,fat_g,fiber_g,sort_order,created_at")
              .in("meal_id", mealIds)
              .order("sort_order", { ascending: true });
            if (items.error) throw items.error;
            CACHE.items = items.data || [];
          } else {
            CACHE.items = [];
          }
        } catch (e) {
          CACHE.error = CACHE.error || e?.message || String(e);
          const local = loadLocalMeals();
          CACHE.meals = local.map(row => row.meal).filter(Boolean);
          CACHE.items = local.map(row => row.item).filter(Boolean);
          console.warn("[nutrition] meals fallback", e?.message || e);
        }
      } else {
        const local = loadLocalMeals();
        CACHE.meals = local.map(row => row.meal).filter(Boolean);
        CACHE.items = local.map(row => row.item).filter(Boolean);
      }
      CACHE.loaded = true;
      changed = true;
    } catch (e) {
      CACHE.error = e?.message || String(e);
      CACHE.loaded = true;
      if (!CACHE.meals.length) {
        const local = loadLocalMeals();
        CACHE.meals = local.map(row => row.meal).filter(Boolean);
        CACHE.items = local.map(row => row.item).filter(Boolean);
      }
      console.warn("[nutrition] load failed", CACHE.error);
      changed = true;
    } finally {
      CACHE.loading = false;
      publishNutrition("load");
    }
    return changed;
  }
  function todayRows() {
    const day = todayISO();
    const meals = CACHE.meals.filter(row => localDateISO(row.meal_date) === day);
    const mealIds = new Set(meals.map(row => String(row.id || "")));
    const items = CACHE.items.filter(row => row && mealIds.has(String(row.meal_id || "")));
    return { meals, items };
  }
  function todaySportKcal() {
    const day = todayISO();
    return (window.state?.sportSessions || []).filter(s => localDateISO(s.started_at || s.startedAt) === day)
      .reduce((sum, s) => sum + n(s.estimated_kcal || s.estimatedKcal, 0), 0);
  }
  function todayWorkKcal() {
    const day = todayISO();
    return (window.state?.workDays || []).filter(w => localDateISO(w.work_date) === day)
      .reduce((sum, w) => sum + n(w.estimated_kcal, 0), 0);
  }
  function bodyBmr() {
    try { return Number(localStorage.getItem(window.TB_CONST?.LS_KEYS?.body_bmr || "travelbudget_body_bmr_v1")) || 0; } catch (_) { return 0; }
  }
  function foodOptions(selected) {
    const q = String(CACHE.foodQuery || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const rows = CACHE.foods.filter(food => !q || String(food.name || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(q)).slice(0, 80);
    return rows.map(food => `<option value="${esc(food.key)}" ${String(food.key) === String(selected || "") ? "selected" : ""}>${esc(food.name)} · ${Math.round(n(food.kcalPer100g, 0))} kcal/100g</option>`).join("");
  }
  function renderFoodOptions(root, preferredKey) {
    const select = root.querySelector("#nutrition-food");
    if (!select) return;
    const before = String(preferredKey || select.value || "");
    select.innerHTML = foodOptions(before);
    if (before && Array.from(select.options).some(opt => opt.value === before)) select.value = before;
  }
  function fmtMacro(v, unit) { return `${Math.round(n(v, 0) * 10) / 10}${unit || "g"}`; }
  function renderNutrition(reason) {
    ensureNutritionShell();
    const root = document.getElementById("nutrition-root");
    if (!root) return;
    if (!CACHE.loaded && !CACHE.loading) {
      loadNutrition().then((changed) => {
        if (changed && (window.activeView || "") === "nutrition") {
          if (root.contains(document.activeElement)) {
            renderFoodOptions(root, root.querySelector("#nutrition-food")?.value);
            updateNutritionPreview(root);
          } else {
            renderNutrition("loaded");
          }
        }
      }).catch(() => {});
    }
    const { meals, items } = todayRows();
    const total = sumNutrition(items.map(item => ({ nutrition: {
      kcal: item.kcal,
      protein: item.protein_g,
      carbs: item.carbs_g,
      fat: item.fat_g,
      fiber: item.fiber_g,
      waterMl: 0,
    } })));
    const waterMl = meals.reduce((sum, meal) => sum + n(meal.water_ml, 0), 0);
    const balance = rules().energyBalance
      ? rules().energyBalance({ consumedKcal: total.kcal, sportKcal: todaySportKcal(), workKcal: todayWorkKcal(), bmr: bodyBmr() })
      : { balanceKcal: total.kcal };
    root.innerHTML = `
      <section class="tb-nutrition-shell">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;">
          <div>
            <h2 style="margin:0;">${esc(txt("Alimentation", "Nutrition"))}</h2>
            <div class="muted" style="margin-top:4px;">${esc(txt("Repas, calories, macros et hydratation, sans lecture medicale.", "Meals, calories, macros and hydration, without medical interpretation."))}</div>
          </div>
          <button class="btn" type="button" id="nutrition-refresh">${esc(txt("Rafraichir", "Refresh"))}</button>
        </div>
        <div class="tb-work-grid" style="display:grid;grid-template-columns:minmax(280px,390px) 1fr;gap:14px;margin-top:14px;">
          <div style="border:1px solid var(--border);border-radius:8px;padding:12px;background:var(--panel2);">
            <h3 style="margin:0 0 10px;">${esc(txt("Ajout rapide", "Quick add"))}</h3>
            <div class="field"><label>${esc(txt("Chercher", "Search"))}</label><input id="nutrition-search" value="${esc(CACHE.foodQuery)}" placeholder="${esc(txt("Riz, poulet, banane...", "Rice, chicken, banana..."))}"></div>
            <div class="field"><label>${esc(txt("Aliment", "Food"))}</label><select id="nutrition-food">${foodOptions()}</select></div>
            <div class="row" style="gap:10px;">
              <div class="field" style="flex:1;"><label>${esc(txt("Mode", "Mode"))}</label><select id="nutrition-amount-mode"><option value="portion">${esc(txt("Portions", "Servings"))}</option><option value="grams">${esc(txt("Grammes", "Grams"))}</option></select></div>
              <div class="field" style="flex:1;"><label>${esc(txt("Quantite", "Quantity"))}</label><input id="nutrition-quantity" type="number" min="0" step="0.25" value="1"></div>
            </div>
            <div class="row" style="gap:10px;">
              <div class="field" style="flex:1;"><label>${esc(txt("Grammes estimes", "Estimated grams"))}</label><input id="nutrition-grams" type="number" min="0" step="5" value="100"></div>
              <div class="field" style="flex:1;"><label>${esc(txt("Repas", "Meal"))}</label><select id="nutrition-type"><option value="breakfast">${esc(txt("Petit-dej", "Breakfast"))}</option><option value="lunch">${esc(txt("Dejeuner", "Lunch"))}</option><option value="dinner">${esc(txt("Diner", "Dinner"))}</option><option value="snack">${esc(txt("Snack", "Snack"))}</option></select></div>
            </div>
            <div class="field"><label>${esc(txt("Eau ml", "Water ml"))}</label><input id="nutrition-water" type="number" min="0" step="50" value="0"></div>
            <div class="pill" id="nutrition-preview">0 kcal</div>
            <button class="btn primary" id="nutrition-save" type="button" style="width:100%;margin-top:10px;">${esc(txt("Ajouter", "Add"))}</button>
            <button class="btn" id="nutrition-water-only" type="button" style="width:100%;margin-top:8px;">${esc(txt("Ajouter seulement l'eau", "Add water only"))}</button>
            ${CACHE.error ? `<div class="muted" style="margin-top:10px;">${esc(CACHE.error)}</div>` : ""}
          </div>
          <div style="border:1px solid var(--border);border-radius:8px;padding:12px;background:var(--panel2);">
            <h3 style="margin:0 0 10px;">${esc(txt("Aujourd hui", "Today"))}</h3>
            <div class="tb-sport-stats" style="margin-bottom:12px;">
              <div class="tb-sport-stat"><span>kcal</span><strong>${Math.round(total.kcal)}</strong></div>
              <div class="tb-sport-stat"><span>${esc(txt("Proteines", "Protein"))}</span><strong>${fmtMacro(total.protein)}</strong></div>
              <div class="tb-sport-stat"><span>${esc(txt("Glucides", "Carbs"))}</span><strong>${fmtMacro(total.carbs)}</strong></div>
              <div class="tb-sport-stat"><span>${esc(txt("Lipides", "Fat"))}</span><strong>${fmtMacro(total.fat)}</strong></div>
              <div class="tb-sport-stat"><span>${esc(txt("Eau", "Water"))}</span><strong>${Math.round(waterMl)} ml</strong></div>
              <div class="tb-sport-stat"><span>${esc(txt("Balance", "Balance"))}</span><strong>${Math.round(balance.balanceKcal)} kcal</strong></div>
            </div>
            ${items.length ? items.map(item => `
              <div style="display:flex;justify-content:space-between;gap:10px;border-top:1px solid var(--border);padding:9px 0;align-items:flex-start;">
                <div><strong>${esc(item.label || item.food_key || "Aliment")}</strong><div class="muted">${Math.round(n(item.grams, 0))}g · P ${fmtMacro(item.protein_g)} · G ${fmtMacro(item.carbs_g)} · L ${fmtMacro(item.fat_g)}</div></div>
                <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end;"><strong>${Math.round(n(item.kcal, 0))} kcal</strong><button class="btn small" type="button" data-nutrition-delete="${esc(String(item.id || ""))}">${esc(txt("Supprimer", "Delete"))}</button></div>
              </div>`).join("") : `<div class="muted">${esc(txt("Aucun repas aujourd hui.", "No meal today."))}</div>`}
          </div>
        </div>
      </section>`;
    bindNutrition(root);
    updateNutritionPreview(root);
  }
  function selectedFood(root) {
    const key = String(root.querySelector("#nutrition-food")?.value || "");
    return CACHE.foods.find(food => String(food.key) === key) || CACHE.foods[0] || FALLBACK_FOODS[0];
  }
  function updateNutritionPreview(root) {
    const food = selectedFood(root);
    syncNutritionAmount(root);
    const grams = n(root.querySelector("#nutrition-grams")?.value, food?.servingGrams || 100);
    const values = nutritionForGrams(food, grams);
    const out = root.querySelector("#nutrition-preview");
    const mode = root.querySelector("#nutrition-amount-mode")?.value || "portion";
    const qty = n(root.querySelector("#nutrition-quantity")?.value, 1);
    const prefix = mode === "portion" ? `${qty} x ${Math.round(n(food?.servingGrams, 100))}g` : `${Math.round(grams)}g`;
    if (out) out.textContent = `${prefix} · ${Math.round(values.kcal)} kcal · P ${fmtMacro(values.protein)} · G ${fmtMacro(values.carbs)} · L ${fmtMacro(values.fat)}`;
  }
  function syncNutritionAmount(root) {
    const food = selectedFood(root);
    const mode = root.querySelector("#nutrition-amount-mode")?.value || "portion";
    const quantity = n(root.querySelector("#nutrition-quantity")?.value, 1);
    const grams = root.querySelector("#nutrition-grams");
    if (!grams) return;
    if (mode === "portion") {
      grams.value = Math.round(Math.max(0, quantity) * n(food?.servingGrams, 100));
      grams.readOnly = true;
    } else {
      grams.readOnly = false;
    }
  }
  function bindNutrition(root) {
    const search = root.querySelector("#nutrition-search");
    if (search) search.oninput = () => {
      CACHE.foodQuery = search.value || "";
      renderFoodOptions(root);
      updateNutritionPreview(root);
    };
    ["#nutrition-food", "#nutrition-grams", "#nutrition-quantity", "#nutrition-amount-mode"].forEach(sel => {
      const el = root.querySelector(sel);
      if (el) el.oninput = () => {
        if (sel === "#nutrition-food" && root.querySelector("#nutrition-quantity")) root.querySelector("#nutrition-quantity").value = "1";
        updateNutritionPreview(root);
      };
      if (el) el.onchange = () => {
        if (sel === "#nutrition-food" && root.querySelector("#nutrition-quantity")) root.querySelector("#nutrition-quantity").value = "1";
        updateNutritionPreview(root);
      };
    });
    const refresh = root.querySelector("#nutrition-refresh");
    if (refresh) refresh.onclick = async () => { await loadNutrition({ force: true }); renderNutrition("refresh"); };
    const save = root.querySelector("#nutrition-save");
    if (save) save.onclick = () => saveNutritionMeal(root);
    const waterOnly = root.querySelector("#nutrition-water-only");
    if (waterOnly) waterOnly.onclick = () => saveWaterOnly(root);
    root.querySelectorAll("[data-nutrition-delete]").forEach(btn => {
      btn.onclick = () => deleteNutritionItem(btn.getAttribute("data-nutrition-delete"));
    });
  }
  async function saveNutritionMeal(root) {
    const food = selectedFood(root);
    syncNutritionAmount(root);
    const grams = n(root.querySelector("#nutrition-grams")?.value, food?.servingGrams || 100);
    const nut = nutritionForGrams(food, grams);
    const waterMl = n(root.querySelector("#nutrition-water")?.value, 0) + n(nut.waterMl, 0);
    const c = client();
    try {
      if (c && uid()) {
        const meal = await c.from(table("nutrition_meals")).insert({
          user_id: uid(),
          travel_id: activeTravelId(),
          meal_date: todayISO(),
          meal_type: root.querySelector("#nutrition-type")?.value || "meal",
          label: food.name,
          water_ml: waterMl,
        }).select("id").single();
        if (meal.error) throw meal.error;
        if (grams > 0) {
          const item = await c.from(table("nutrition_meal_items")).insert({
            user_id: uid(),
            meal_id: meal.data.id,
            food_key: food.key,
            label: food.name,
            grams,
            kcal: nut.kcal,
            protein_g: nut.protein,
            carbs_g: nut.carbs,
            fat_g: nut.fat,
            fiber_g: nut.fiber,
          });
          if (item.error) throw item.error;
        }
      } else {
        const mealId = `local_meal_${Date.now()}`;
        const itemId = `local_item_${Date.now()}`;
        const rows = loadLocalMeals();
        rows.unshift({
          meal: { id: mealId, user_id: uid(), travel_id: activeTravelId(), meal_date: todayISO(), meal_type: root.querySelector("#nutrition-type")?.value || "meal", label: food.name, water_ml: waterMl, created_at: new Date().toISOString() },
          item: grams > 0 ? { id: itemId, user_id: uid(), meal_id: mealId, food_key: food.key, label: food.name, grams, kcal: nut.kcal, protein_g: nut.protein, carbs_g: nut.carbs, fat_g: nut.fat, fiber_g: nut.fiber, created_at: new Date().toISOString() } : null,
        });
        saveLocalMeals(rows);
      }
      await loadNutrition({ force: true });
      renderNutrition("save");
    } catch (e) {
      CACHE.error = e?.message || String(e);
      renderNutrition("save-error");
    }
  }
  async function saveWaterOnly(root) {
    const water = n(root.querySelector("#nutrition-water")?.value, 0) || n(selectedFood(root)?.servingGrams, 250);
    const c = client();
    try {
      if (c && uid()) {
        const meal = await c.from(table("nutrition_meals")).insert({
          user_id: uid(),
          travel_id: activeTravelId(),
          meal_date: todayISO(),
          meal_type: root.querySelector("#nutrition-type")?.value || "meal",
          label: txt("Eau", "Water"),
          water_ml: water,
        });
        if (meal.error) throw meal.error;
      } else {
        const rows = loadLocalMeals();
        rows.unshift({
          meal: { id: `local_meal_${Date.now()}`, user_id: uid(), travel_id: activeTravelId(), meal_date: todayISO(), meal_type: root.querySelector("#nutrition-type")?.value || "meal", label: txt("Eau", "Water"), water_ml: water, created_at: new Date().toISOString() },
          item: null,
        });
        saveLocalMeals(rows);
      }
      await loadNutrition({ force: true });
      renderNutrition("water-only");
    } catch (e) {
      CACHE.error = e?.message || String(e);
      renderNutrition("water-error");
    }
  }
  async function deleteNutritionItem(id) {
    const key = String(id || "");
    if (!key) return;
    const c = client();
    try {
      if (c && uid() && !key.startsWith("local_item_")) {
        const { error } = await c.from(table("nutrition_meal_items")).delete().eq("id", key).eq("user_id", uid());
        if (error) throw error;
      } else {
        saveLocalMeals(loadLocalMeals().filter(row => String(row.item?.id || "") !== key));
      }
      await loadNutrition({ force: true });
      renderNutrition("delete");
    } catch (e) {
      CACHE.error = e?.message || String(e);
      renderNutrition("delete-error");
    }
  }

  window.renderNutrition = renderNutrition;
  window.tbReloadNutrition = async function tbReloadNutrition() {
    await loadNutrition({ force: true });
    return { meals: CACHE.meals.slice(), items: CACHE.items.slice() };
  };
  window.addEventListener("tb:auth_scope_changed", () => { CACHE.loaded = false; CACHE.meals = []; CACHE.items = []; });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ensureNutritionShell);
  else ensureNutritionShell();
})();
