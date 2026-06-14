/* =========================
   Nutrition module
   - Food library, quick meals, kcal/macros, hydration
   ========================= */
(function () {
  const CACHE = { loaded: false, loading: false, foods: [], meals: [], items: [], error: "", foodQuery: "", foodCategory: "all", selectedDate: "", expandedHistory: "", editingItemId: "" };
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
    { key: "cereal_bar", name: "Barre cereales", servingGrams: 25, kcalPer100g: 390, proteinPer100g: 6, carbsPer100g: 68, fatPer100g: 10, fiberPer100g: 5 },
    { key: "protein_bar", name: "Barre proteinee", servingGrams: 60, kcalPer100g: 350, proteinPer100g: 30, carbsPer100g: 35, fatPer100g: 11, fiberPer100g: 8 },
    { key: "jam", name: "Confiture", servingGrams: 20, kcalPer100g: 250, proteinPer100g: 0.3, carbsPer100g: 60, fatPer100g: 0.1, fiberPer100g: 1 },
    { key: "honey", name: "Miel", servingGrams: 15, kcalPer100g: 304, proteinPer100g: 0.3, carbsPer100g: 82, fatPer100g: 0 },
    { key: "pain_perdu", name: "Pain perdu", servingGrams: 160, kcalPer100g: 230, proteinPer100g: 7.5, carbsPer100g: 31, fatPer100g: 8.5, fiberPer100g: 1.5, tags: ["petit-dej", "dessert", "plat", "pain"] },
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
    { key: "burger_simple", name: "Burger simple", servingGrams: 220, kcalPer100g: 295, proteinPer100g: 14, carbsPer100g: 28, fatPer100g: 15, fiberPer100g: 1.7 },
    { key: "burger_maison", name: "Burger maison", servingGrams: 280, kcalPer100g: 255, proteinPer100g: 14, carbsPer100g: 22, fatPer100g: 13, fiberPer100g: 1.8 },
    { key: "cheeseburger", name: "Cheeseburger", servingGrams: 250, kcalPer100g: 305, proteinPer100g: 15, carbsPer100g: 27, fatPer100g: 16, fiberPer100g: 1.6 },
    { key: "double_cheeseburger", name: "Double cheeseburger", servingGrams: 330, kcalPer100g: 310, proteinPer100g: 18, carbsPer100g: 20, fatPer100g: 19, fiberPer100g: 1.4 },
    { key: "chicken_burger", name: "Burger poulet", servingGrams: 260, kcalPer100g: 250, proteinPer100g: 13, carbsPer100g: 28, fatPer100g: 10, fiberPer100g: 2 },
    { key: "veggie_burger", name: "Burger vegetarien", servingGrams: 250, kcalPer100g: 220, proteinPer100g: 9, carbsPer100g: 31, fatPer100g: 7, fiberPer100g: 5 },
    { key: "croque_monsieur", name: "Croque monsieur", servingGrams: 200, kcalPer100g: 285, proteinPer100g: 14, carbsPer100g: 24, fatPer100g: 15, fiberPer100g: 1.6 },
    { key: "club_sandwich_chicken", name: "Club sandwich poulet", servingGrams: 260, kcalPer100g: 230, proteinPer100g: 13, carbsPer100g: 24, fatPer100g: 9, fiberPer100g: 2 },
    { key: "pizza_4_cheese", name: "Pizza 4 fromages", servingGrams: 300, kcalPer100g: 295, proteinPer100g: 13, carbsPer100g: 30, fatPer100g: 14, fiberPer100g: 2 },
    { key: "pizza_pepperoni", name: "Pizza pepperoni", servingGrams: 300, kcalPer100g: 300, proteinPer100g: 13, carbsPer100g: 31, fatPer100g: 14.5, fiberPer100g: 2.2 },
    { key: "gratin_dauphinois", name: "Gratin dauphinois", servingGrams: 250, kcalPer100g: 160, proteinPer100g: 4, carbsPer100g: 17, fatPer100g: 8.5, fiberPer100g: 1.5 },
    { key: "hachis_parmentier", name: "Hachis parmentier", servingGrams: 350, kcalPer100g: 145, proteinPer100g: 8, carbsPer100g: 15, fatPer100g: 5.5, fiberPer100g: 2 },
    { key: "tartiflette", name: "Tartiflette", servingGrams: 350, kcalPer100g: 220, proteinPer100g: 9, carbsPer100g: 15, fatPer100g: 14, fiberPer100g: 1.5 },
    { key: "steak_fries", name: "Steak frites", servingGrams: 380, kcalPer100g: 220, proteinPer100g: 13, carbsPer100g: 20, fatPer100g: 10, fiberPer100g: 2.5 },
    { key: "fish_and_chips", name: "Fish and chips", servingGrams: 350, kcalPer100g: 240, proteinPer100g: 11, carbsPer100g: 25, fatPer100g: 11, fiberPer100g: 2 },
    { key: "paella_chicken_seafood", name: "Paella poulet fruits de mer", servingGrams: 380, kcalPer100g: 145, proteinPer100g: 9, carbsPer100g: 19, fatPer100g: 4, fiberPer100g: 2 },
    { key: "risotto_mushroom", name: "Risotto champignons", servingGrams: 320, kcalPer100g: 150, proteinPer100g: 5, carbsPer100g: 22, fatPer100g: 5, fiberPer100g: 1.5 },
    { key: "chicken_tikka_masala_rice", name: "Poulet tikka masala riz", servingGrams: 400, kcalPer100g: 165, proteinPer100g: 10, carbsPer100g: 21, fatPer100g: 5, fiberPer100g: 1.8 },
    { key: "dahl_lentils_rice", name: "Dahl lentilles riz", servingGrams: 380, kcalPer100g: 125, proteinPer100g: 6, carbsPer100g: 20, fatPer100g: 2.5, fiberPer100g: 5 },
    { key: "vegetable_curry_rice", name: "Curry legumes riz", servingGrams: 380, kcalPer100g: 125, proteinPer100g: 4, carbsPer100g: 20, fatPer100g: 3.5, fiberPer100g: 4 },
    { key: "falafel_plate", name: "Assiette falafels", servingGrams: 350, kcalPer100g: 210, proteinPer100g: 8, carbsPer100g: 24, fatPer100g: 9, fiberPer100g: 5 },
    { key: "buddha_bowl_chicken", name: "Buddha bowl poulet", servingGrams: 420, kcalPer100g: 150, proteinPer100g: 10, carbsPer100g: 17, fatPer100g: 4.5, fiberPer100g: 4 },
    { key: "salmon_potatoes_greenbeans", name: "Saumon pommes de terre haricots verts", servingGrams: 380, kcalPer100g: 145, proteinPer100g: 12, carbsPer100g: 13, fatPer100g: 6, fiberPer100g: 2.5 },
    { key: "chicken_potatoes_vegetables", name: "Poulet pommes de terre legumes", servingGrams: 400, kcalPer100g: 135, proteinPer100g: 12, carbsPer100g: 15, fatPer100g: 3.5, fiberPer100g: 2.8 },
    { key: "beef_bourguignon_pasta", name: "Boeuf bourguignon pates", servingGrams: 400, kcalPer100g: 155, proteinPer100g: 11, carbsPer100g: 18, fatPer100g: 4.5, fiberPer100g: 2 },
    { key: "couscous_royal", name: "Couscous royal", servingGrams: 450, kcalPer100g: 150, proteinPer100g: 10, carbsPer100g: 17, fatPer100g: 5, fiberPer100g: 3 },
    { key: "lasagna_vegetable", name: "Lasagnes legumes", servingGrams: 300, kcalPer100g: 145, proteinPer100g: 7, carbsPer100g: 15, fatPer100g: 6, fiberPer100g: 2.5 },
    { key: "ravioli_beef_tomato", name: "Raviolis boeuf sauce tomate", servingGrams: 300, kcalPer100g: 150, proteinPer100g: 7, carbsPer100g: 22, fatPer100g: 4, fiberPer100g: 2 },
    { key: "ramen_chicken", name: "Ramen poulet", servingGrams: 500, kcalPer100g: 95, proteinPer100g: 6, carbsPer100g: 12, fatPer100g: 2.5, fiberPer100g: 1.2, waterMlPer100g: 88 },
    { key: "pad_thai_chicken", name: "Pad thai poulet", servingGrams: 380, kcalPer100g: 185, proteinPer100g: 10, carbsPer100g: 24, fatPer100g: 5.5, fiberPer100g: 2 },
    { key: "bo_bun_beef", name: "Bo bun boeuf", servingGrams: 420, kcalPer100g: 150, proteinPer100g: 9, carbsPer100g: 20, fatPer100g: 4, fiberPer100g: 3 },
    { key: "fajitas_chicken", name: "Fajitas poulet", servingGrams: 330, kcalPer100g: 185, proteinPer100g: 11, carbsPer100g: 22, fatPer100g: 6, fiberPer100g: 3 },
    { key: "quesadilla_cheese_chicken", name: "Quesadilla poulet fromage", servingGrams: 280, kcalPer100g: 260, proteinPer100g: 14, carbsPer100g: 24, fatPer100g: 12, fiberPer100g: 2 },
    { key: "hot_dog", name: "Hot dog", servingGrams: 180, kcalPer100g: 285, proteinPer100g: 11, carbsPer100g: 30, fatPer100g: 13, fiberPer100g: 1.5 },
    { key: "chicken_wings", name: "Chicken wings", servingGrams: 180, kcalPer100g: 285, proteinPer100g: 20, carbsPer100g: 5, fatPer100g: 20, fiberPer100g: 0.5 },
    { key: "sushi_mixed_box", name: "Plateau sushi mixte", servingGrams: 260, kcalPer100g: 150, proteinPer100g: 7, carbsPer100g: 26, fatPer100g: 2.2, fiberPer100g: 0.8 },
    { key: "olive_oil", name: "Huile olive", servingGrams: 10, kcalPer100g: 884, proteinPer100g: 0, carbsPer100g: 0, fatPer100g: 100 },
    { key: "coffee", name: "Cafe", servingGrams: 200, kcalPer100g: 1, proteinPer100g: 0.1, carbsPer100g: 0, fatPer100g: 0, waterMlPer100g: 99 },
    { key: "tea", name: "The", servingGrams: 250, kcalPer100g: 1, proteinPer100g: 0, carbsPer100g: 0.2, fatPer100g: 0, waterMlPer100g: 99 },
    { key: "beer_blond_330", name: "Biere blonde 33cl", servingGrams: 330, kcalPer100g: 43, proteinPer100g: 0.5, carbsPer100g: 3.6, fatPer100g: 0, waterMlPer100g: 90 },
    { key: "beer_ipa", name: "Biere IPA", servingGrams: 330, kcalPer100g: 55, proteinPer100g: 0.6, carbsPer100g: 5, fatPer100g: 0, waterMlPer100g: 88 },
    { key: "beer_alcohol_free", name: "Biere sans alcool", servingGrams: 330, kcalPer100g: 23, proteinPer100g: 0.3, carbsPer100g: 5, fatPer100g: 0, waterMlPer100g: 94 },
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
  function selectedDateISO() {
    if (!CACHE.selectedDate) CACHE.selectedDate = todayISO();
    return /^\d{4}-\d{2}-\d{2}$/.test(CACHE.selectedDate) ? CACHE.selectedDate : todayISO();
  }
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
  function offsetDateISO(day, offsetDays) {
    const base = /^\d{4}-\d{2}-\d{2}$/.test(String(day || "")) ? String(day) : todayISO();
    const [y, m, d0] = base.split("-").map(Number);
    const d = new Date(Date.UTC(y, (m || 1) - 1, d0 || 1));
    d.setUTCDate(d.getUTCDate() + (Number(offsetDays) || 0));
    return d.toISOString().slice(0, 10);
  }
  function n(v, fallback) { const x = Number(v); return Number.isFinite(x) ? x : (fallback || 0); }
  function mealTypeLabel(type) {
    const key = String(type || "meal");
    const labels = {
      breakfast: txt("Petit dejeuner", "Breakfast"),
      morning_snack: txt("Pause 10h", "10am snack"),
      lunch: txt("Dejeuner", "Lunch"),
      afternoon_snack: txt("Gouter", "Afternoon snack"),
      dinner: txt("Diner", "Dinner"),
      snack: txt("Snack", "Snack"),
      meal: txt("Repas", "Meal"),
    };
    return labels[key] || key;
  }
  function foodCacheKey() { return window.TB_CONST?.LS_KEYS?.nutrition_food_cache || "travelbudget_nutrition_food_cache_v1"; }
  function localMealKey() { return `${window.TB_CONST?.LS_KEYS?.nutrition_local_meals || "travelbudget_nutrition_local_meals_v1"}::${uid() || "anon"}`; }
  function sleepKey() { return `${window.TB_CONST?.LS_KEYS?.nutrition_sleep || "travelbudget_nutrition_sleep_v1"}::${uid() || "anon"}`; }
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
  function loadSleepRows() {
    try {
      const raw = JSON.parse(localStorage.getItem(sleepKey()) || "{}");
      return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    } catch (_) {
      return {};
    }
  }
  function saveSleepRows(rows) {
    try { localStorage.setItem(sleepKey(), JSON.stringify(rows || {})); } catch (_) {}
  }
  function sleepForDay(day) {
    const targetDay = String(day || selectedDateISO());
    const nightDay = offsetDateISO(targetDay, -1);
    const rows = loadSleepRows();
    const row = rows[nightDay] || rows[targetDay] || {};
    return { hours: n(row.hours, 0), quality: String(row.quality || "ok"), updatedAt: row.updatedAt || "", nightDay };
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
  function ensureNutritionStyles() {
    if (document.getElementById("tbNutritionResponsiveStyles")) return;
    const style = document.createElement("style");
    style.id = "tbNutritionResponsiveStyles";
    style.textContent = `
      .tb-nutrition-top { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(240px,100%),1fr)); gap:12px; align-items:stretch; }
      .tb-nutrition-layout { display:grid; grid-template-columns:minmax(280px,390px) 1fr; gap:14px; margin-top:14px; }
      .tb-nutrition-macro-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:10px; }
      .tb-nutrition-catalog-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:8px; }
      .tb-nutrition-water-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:6px; margin-bottom:8px; }
      .tb-nutrition-week-grid { display:grid; grid-template-columns:repeat(7,minmax(26px,1fr)); gap:6px; align-items:end; margin-bottom:12px; }
      .tb-nutrition-history-type-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:6px; margin-top:6px; }
      .tb-nutrition-timeline-row { display:grid; grid-template-columns:24px 1fr; gap:10px; align-items:stretch; }
      .tb-nutrition-shell button { min-width:0; }
      .tb-nutrition-shell .btn { white-space:normal; }
      @media (max-width: 860px) {
        #nutrition-root { padding:12px !important; }
        .tb-nutrition-shell { margin:-4px -4px 0; }
        .tb-nutrition-layout { grid-template-columns:1fr; }
        .tb-nutrition-form-row { flex-direction:column; align-items:stretch !important; }
        .tb-nutrition-form-row .field { min-width:0 !important; width:100%; }
        .tb-nutrition-water-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
        .tb-nutrition-week-grid { gap:4px; }
        .tb-nutrition-history-type-grid { grid-template-columns:1fr; }
        .tb-nutrition-timeline-row { grid-template-columns:18px minmax(0,1fr); gap:8px; }
        .tb-nutrition-shell .tb-sport-stats { grid-template-columns:repeat(2,minmax(0,1fr)); }
      }
      @media (max-width: 460px) {
        .tb-nutrition-top,
        .tb-nutrition-macro-grid,
        .tb-nutrition-catalog-grid,
        .tb-nutrition-shell .tb-sport-stats { grid-template-columns:1fr; }
        .tb-nutrition-week-grid button { padding:6px 3px !important; font-size:10px !important; }
      }
    `;
    document.head.appendChild(style);
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
    window.state.nutritionSleep = loadSleepRows();
    try { if (typeof window.tbSaveOfflineSnapshot === "function") window.tbSaveOfflineSnapshot(`nutrition:${reason || "load"}`); } catch (_) {}
    try { if (typeof window.renderKPI === "function") window.renderKPI(); } catch (_) {}
    try { document.dispatchEvent(new CustomEvent("tb:nutrition:data_loaded", { detail: { reason: reason || "load" } })); } catch (_) {}
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
            .select("key,name,brand,serving_grams,kcal_per_100g,protein_per_100g,carbs_per_100g,fat_per_100g,fiber_per_100g,water_ml_per_100g,tags")
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
          const recentSince = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
          const selectedSince = offsetDateISO(selectedDateISO(), -1);
          const since = selectedSince < recentSince ? selectedSince : recentSince;
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
  function selectedRows() {
    const day = selectedDateISO();
    const meals = CACHE.meals.filter(row => localDateISO(row.meal_date) === day);
    const mealIds = new Set(meals.map(row => String(row.id || "")));
    const items = CACHE.items.filter(row => row && mealIds.has(String(row.meal_id || "")));
    return { meals, items };
  }
  function dailySummaries() {
    const byDay = new Map();
    const typeOrder = ["breakfast", "morning_snack", "lunch", "afternoon_snack", "dinner", "snack", "meal"];
    function ensureType(row, type) {
      const key = typeOrder.includes(type) ? type : "meal";
      if (!row.types[key]) row.types[key] = { type: key, meals: [], items: [], kcal: 0, protein: 0, carbs: 0, fat: 0, waterMl: 0 };
      return row.types[key];
    }
    CACHE.meals.forEach(meal => {
      const day = localDateISO(meal.meal_date);
      if (!day) return;
      if (!byDay.has(day)) byDay.set(day, { day, meals: [], waterMl: 0, kcal: 0, protein: 0, carbs: 0, fat: 0, types: {} });
      const row = byDay.get(day);
      const typeRow = ensureType(row, String(meal.meal_type || "meal"));
      row.meals.push(meal);
      row.waterMl += n(meal.water_ml, 0);
      typeRow.meals.push(meal);
      typeRow.waterMl += n(meal.water_ml, 0);
    });
    const mealToDay = new Map();
    const mealToType = new Map();
    CACHE.meals.forEach(meal => {
      mealToDay.set(String(meal.id || ""), localDateISO(meal.meal_date));
      mealToType.set(String(meal.id || ""), String(meal.meal_type || "meal"));
    });
    CACHE.items.forEach(item => {
      const mealId = String(item.meal_id || "");
      const day = mealToDay.get(mealId);
      const row = day ? byDay.get(day) : null;
      if (!row) return;
      const typeRow = ensureType(row, mealToType.get(mealId) || "meal");
      typeRow.items.push(item);
      typeRow.kcal += n(item.kcal, 0);
      typeRow.protein += n(item.protein_g, 0);
      typeRow.carbs += n(item.carbs_g, 0);
      typeRow.fat += n(item.fat_g, 0);
      row.kcal += n(item.kcal, 0);
      row.protein += n(item.protein_g, 0);
      row.carbs += n(item.carbs_g, 0);
      row.fat += n(item.fat_g, 0);
    });
    return Array.from(byDay.values()).map(row => ({
      ...row,
      typeRows: typeOrder.map(type => row.types[type]).filter(Boolean),
    })).sort((a, b) => String(b.day).localeCompare(String(a.day))).slice(0, 21);
  }
  function todaySportKcal() {
    const day = selectedDateISO();
    return (window.state?.sportSessions || []).filter(s => localDateISO(s.started_at || s.startedAt) === day)
      .reduce((sum, s) => sum + n(s.estimated_kcal || s.estimatedKcal, 0), 0);
  }
  function todayWorkKcal() {
    const day = selectedDateISO();
    return (window.state?.workDays || []).filter(w => localDateISO(w.work_date) === day)
      .reduce((sum, w) => sum + n(w.estimated_kcal, 0), 0);
  }
  function bodyWeight() {
    try { return Number(window.tbReadScopedLocalStorage?.(window.TB_CONST?.LS_KEYS?.sport_body_weight || "travelbudget_sport_body_weight_v1", 70)) || 70; } catch (_) { return 70; }
  }
  function bodyHeight() {
    try { return Number(window.tbReadScopedLocalStorage?.(window.TB_CONST?.LS_KEYS?.sport_body_height || "travelbudget_sport_body_height_v1", 175)) || 175; } catch (_) { return 175; }
  }
  function bodyBirthDate() {
    try { return localStorage.getItem(window.TB_CONST?.LS_KEYS?.body_birthdate || "travelbudget_body_birthdate_v1") || ""; } catch (_) { return ""; }
  }
  function ageFromBirthDate(v) {
    if (window.Core?.bodyEnergyRules?.ageFromBirthDate) return window.Core.bodyEnergyRules.ageFromBirthDate(v);
    const m = String(v || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return 0;
    const now = new Date();
    let age = now.getFullYear() - Number(m[1]);
    const month = Number(m[2]);
    const day = Number(m[3]);
    const currentMonth = now.getMonth() + 1;
    if (currentMonth < month || (currentMonth === month && now.getDate() < day)) age -= 1;
    return age > 0 && age < 130 ? age : 0;
  }
  function bodyAge() {
    const fromBirthDate = ageFromBirthDate(bodyBirthDate());
    if (fromBirthDate) return fromBirthDate;
    try { return Number(localStorage.getItem(window.TB_CONST?.LS_KEYS?.body_age || "travelbudget_body_age_v1")) || 30; } catch (_) { return 30; }
  }
  function bodySex() {
    try { return localStorage.getItem(window.TB_CONST?.LS_KEYS?.body_sex || "travelbudget_body_sex_v1") || "male"; } catch (_) { return "male"; }
  }
  function baseline() {
    const customBmr = (() => { try { return Number(localStorage.getItem(window.TB_CONST?.LS_KEYS?.body_bmr || "travelbudget_body_bmr_v1")) || 0; } catch (_) { return 0; } })();
    if (window.Core?.bodyEnergyRules?.resolveDailyBaselineKcal) {
      return window.Core.bodyEnergyRules.resolveDailyBaselineKcal({
        customBmr,
        kg: bodyWeight(),
        heightCm: bodyHeight(),
        birthDate: bodyBirthDate(),
        age: bodyAge(),
        sex: bodySex(),
        activityFactor: 1,
      });
    }
    const kg = bodyWeight();
    const heightCm = bodyHeight();
    const age = bodyAge();
    const offset = String(bodySex()).toLowerCase().startsWith("f") ? -161 : 5;
    const bmr = customBmr > 0 ? customBmr : (10 * kg) + (6.25 * heightCm) - (5 * age) + offset;
    return { bmr: Math.max(0, bmr), bmi: 0, maintenanceKcal: Math.max(0, bmr), source: customBmr > 0 ? "manual" : "estimated" };
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
  function pct(current, target) {
    const t = Math.max(1, n(target, 0));
    return Math.max(0, Math.min(160, (n(current, 0) / t) * 100));
  }
  function progressBar(label, current, target, unit) {
    const percent = pct(current, target);
    const over = n(current, 0) > n(target, 0);
    return `
      <div style="display:grid;gap:5px;">
        <div style="display:flex;justify-content:space-between;gap:8px;font-size:12px;">
          <span>${esc(label)}</span>
          <strong>${Math.round(n(current, 0))}/${Math.round(n(target, 0))}${esc(unit || "")}</strong>
        </div>
        <div style="height:8px;border:1px solid var(--border);border-radius:999px;overflow:hidden;background:rgba(148,163,184,.12);">
          <div style="height:100%;width:${Math.min(100, percent)}%;background:${over ? "var(--danger,#ef4444)" : "var(--accent,#22c55e)"};"></div>
        </div>
      </div>`;
  }
  function mealMomentTargets(needsKcal) {
    const rows = [
      { type: "breakfast", pct: 0.25, color: "#38bdf8" },
      { type: "morning_snack", pct: 0.10, color: "#a78bfa" },
      { type: "lunch", pct: 0.35, color: "#22c55e" },
      { type: "afternoon_snack", pct: 0.10, color: "#f59e0b" },
      { type: "dinner", pct: 0.20, color: "#fb7185" },
    ];
    return rows.map(row => ({ ...row, kcal: Math.round(n(needsKcal, 0) * row.pct) }));
  }
  function typeTotalsForDay(meals, items) {
    const mealTypes = new Map();
    meals.forEach(meal => mealTypes.set(String(meal.id || ""), String(meal.meal_type || "meal")));
    return items.reduce((acc, item) => {
      const type = mealTypes.get(String(item.meal_id || "")) || "meal";
      if (!acc[type]) acc[type] = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
      acc[type].kcal += n(item.kcal, 0);
      acc[type].protein += n(item.protein_g, 0);
      acc[type].carbs += n(item.carbs_g, 0);
      acc[type].fat += n(item.fat_g, 0);
      return acc;
    }, {});
  }
  function normalizeText(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  }
  function foodCategory(food) {
    const tags = Array.isArray(food?.tags) ? food.tags.map(normalizeText) : [];
    if (tags.includes("plat")) return "dishes";
    if (tags.includes("fruit")) return "fruits";
    if (tags.some(tag => ["laitage", "fromage"].includes(tag))) return "dairy";
    if (tags.some(tag => ["base", "riz", "pates", "semoule", "glucides", "pain"].includes(tag))) return "carbs";
    if (tags.some(tag => ["proteines", "boeuf", "poulet", "poisson", "oeuf", "vegetarien"].includes(tag))) return "protein";
    if (tags.some(tag => ["snack", "gateau", "chocolat"].includes(tag))) return "snacks";
    if (tags.includes("boisson")) return "drinks";
    const s = normalizeText(`${food?.key || ""} ${food?.name || ""}`);
    if (/banane|pomme|poire|orange|kiwi|fraise|raisin|peche|mangue|melon|pasteque|fruit|compote|datte|myrtille|framboise/.test(s)) return "fruits";
    if (/yaourt|fromage|skyr|lait|mozzarella|emmental|cheddar|feta|chevre|cottage|laitage/.test(s)) return "dairy";
    if (/riz|pate|pain|baguette|quinoa|semoule|couscous|boulgour|pomme de terre|tortilla|bagel|porridge|avoine|muesli|granola|cereale/.test(s)) return "carbs";
    if (/poulet|dinde|boeuf|steak|thon|saumon|cabillaud|crevette|oeuf|tofu|tempeh|lentille|pois chiche|whey|proteine/.test(s)) return "protein";
    if (/biscuit|gateau|belvita|barre|chocolat|cookie|chips|cracker|donut|muffin|gaufre|snack|galette/.test(s)) return "snacks";
    if (/eau|cafe|the|biere|cidre|jus|cola|boisson|latte|cappuccino|smoothie/.test(s)) return "drinks";
    if (/burger|sandwich|wrap|bowl|pizza|salade|soupe|curry|chili|lasagne|kebab|tacos|burrito|omelette|plat|croque|panini|gratin|hachis|tartiflette|raclette|paella|risotto|dahl|falafel|shakshuka|saumon pommes|poulet pommes|bourguignon|blanquette|couscous|moussaka|ravioli|gnocchi|ramen|pad thai|bo bun|fajitas|quesadilla|hot dog|sushi/.test(s)) return "dishes";
    return "all";
  }
  function foodCategoryLabel(cat) {
    return ({
      all: txt("Tous", "All"),
      fruits: txt("Fruits", "Fruits"),
      dairy: txt("Laitages", "Dairy"),
      carbs: txt("Feculents", "Carbs"),
      protein: txt("Proteines", "Protein"),
      snacks: txt("Snacks", "Snacks"),
      drinks: txt("Boissons", "Drinks"),
      dishes: txt("Plats", "Dishes"),
    })[cat] || cat;
  }
  function catalogFoods() {
    const q = normalizeText(CACHE.foodQuery);
    const cat = String(CACHE.foodCategory || "all");
    return CACHE.foods.filter(food => {
      const matchesText = !q || normalizeText(food.name).includes(q) || normalizeText(food.key).includes(q);
      const matchesCat = cat === "all" || foodCategory(food) === cat;
      return matchesText && matchesCat;
    }).slice(0, 18);
  }
  function mealMomentSuggestion(type, consumed, targetKcal, total, macroTargets) {
    const kcalGap = n(targetKcal, 0) - n(consumed?.kcal, 0);
    const proteinGap = n(macroTargets?.protein, 0) - n(total?.protein, 0);
    const waterGap = 2000 - n(total?.waterMl, 0);
    if (kcalGap <= -120) return txt("Deja haut en kcal : vise hydratation, legumes ou une option tres legere.", "Already high in kcal: aim for hydration, vegetables or a very light option.");
    if (proteinGap > 25 && kcalGap > 100) return txt("Il te reste surtout des proteines : poulet, skyr, oeufs, thon ou tofu.", "You mostly need protein: chicken, skyr, eggs, tuna or tofu.");
    if (waterGap > 700 && (type === "afternoon_snack" || type === "dinner")) return txt("Hydratation en retard : ajoute de l'eau avant de completer le repas.", "Hydration is behind: add water before completing the meal.");
    if (kcalGap > 260) return txt("Repas a completer : une base + une proteine + un fruit/legume.", "Meal to complete: a base + protein + fruit/vegetable.");
    if (kcalGap > 80) return txt("Petite marge : portion simple ou collation legere.", "Small margin: simple portion or light snack.");
    return txt("Moment bien cale.", "This moment is on track.");
  }
  function weekRows(history, selectedDay) {
    const byDay = new Map(history.map(row => [row.day, row]));
    const rows = [];
    for (let i = 6; i >= 0; i -= 1) {
      const day = offsetDateISO(selectedDay, -i);
      rows.push(byDay.get(day) || { day, kcal: 0, protein: 0, carbs: 0, fat: 0, waterMl: 0, typeRows: [] });
    }
    return rows;
  }
  function itemMeal(item) {
    const mealId = String(item?.meal_id || "");
    return CACHE.meals.find(meal => String(meal.id || "") === mealId) || null;
  }
  function isWaterOnlyMeal(meal, itemsForDay) {
    if (!meal) return false;
    const mealId = String(meal.id || "");
    const hasItem = (itemsForDay || CACHE.items || []).some(item => String(item?.meal_id || "") === mealId);
    const label = String(meal.label || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    return !hasItem && (label === "eau" || label === "water");
  }
  function renderNutrition(reason) {
    ensureNutritionShell();
    ensureNutritionStyles();
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
    const day = selectedDateISO();
    const { meals, items } = selectedRows();
    const history = dailySummaries();
    const total = sumNutrition(items.map(item => ({ nutrition: {
      kcal: item.kcal,
      protein: item.protein_g,
      carbs: item.carbs_g,
      fat: item.fat_g,
      fiber: item.fiber_g,
      waterMl: 0,
    } })));
    const drinkWaterMl = meals.reduce((sum, meal) => sum + (isWaterOnlyMeal(meal, items) ? n(meal.water_ml, 0) : 0), 0);
    const foodWaterMl = Math.max(0, meals.reduce((sum, meal) => sum + n(meal.water_ml, 0), 0) - drinkWaterMl);
    const waterMl = drinkWaterMl;
    const base = baseline();
    const sportKcal = todaySportKcal();
    const workKcal = todayWorkKcal();
    const balance = rules().energyBalance
      ? rules().energyBalance({ consumedKcal: total.kcal, sportKcal, workKcal, bmr: base.bmr })
      : { spentKcal: base.bmr + sportKcal + workKcal, balanceKcal: total.kcal - (base.bmr + sportKcal + workKcal) };
    const balanceLabel = balance.balanceKcal >= 0 ? txt("au-dessus", "above") : txt("en-dessous", "below");
    const needsKcal = Math.max(0, n(balance.spentKcal, base.bmr + sportKcal + workKcal));
    const consumedKcal = Math.max(0, n(total.kcal, 0));
    const kcalDelta = consumedKcal - needsKcal;
    const kcalTargetLabel = kcalDelta >= 0 ? txt("surplus", "surplus") : txt("reste", "left");
    const kg = bodyWeight();
    const proteinTarget = Math.max(70, kg * 1.6);
    const fatTarget = Math.max(45, kg * 0.8);
    const carbsTarget = Math.max(120, (needsKcal - (proteinTarget * 4) - (fatTarget * 9)) / 4);
    const mealTargets = mealMomentTargets(needsKcal);
    const typeTotals = typeTotalsForDay(meals, items);
    const kcalPct = Math.min(100, pct(consumedKcal, needsKcal));
    const kcalRingColor = kcalDelta > 250 ? "#ef4444" : (kcalDelta < -350 ? "#f59e0b" : "#22c55e");
    const week = weekRows(history, day);
    const sleep = sleepForDay(day);
    const sleepWeek = week.map(row => ({ day: row.day, ...sleepForDay(row.day) }));
    const sleepLabel = sleep.hours > 0 ? `${Math.round(sleep.hours * 10) / 10}h` : txt("non saisi", "not set");
    const sleepNightLabel = sleep.nightDay ? sleep.nightDay.slice(5).replace("-", "/") : offsetDateISO(day, -1).slice(5).replace("-", "/");
    const editingItem = CACHE.editingItemId ? items.find(item => String(item.id || "") === String(CACHE.editingItemId)) : null;
    root.innerHTML = `
      <section class="tb-nutrition-shell">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;">
          <div>
            <h2 style="margin:0;">${esc(txt("Alimentation", "Nutrition"))}</h2>
            <div class="muted" style="margin-top:4px;">${esc(txt("Repas, calories, macros et hydratation, sans lecture medicale.", "Meals, calories, macros and hydration, without medical interpretation."))}</div>
          </div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
            <label class="pill" style="display:flex;align-items:center;gap:6px;">${esc(txt("Date", "Date"))} <input id="nutrition-date" type="date" value="${esc(day)}" style="width:142px;"></label>
            <span class="pill">${esc(txt("Base", "Base"))} ${Math.round(base.bmr || 0)} kcal</span>
            <button class="btn" type="button" id="nutrition-refresh">${esc(txt("Rafraichir", "Refresh"))}</button>
          </div>
        </div>
        <div class="tb-nutrition-top" style="margin-top:14px;">
          <div style="border:1px solid var(--border);border-radius:8px;padding:14px;background:linear-gradient(145deg,rgba(34,197,94,.10),rgba(56,189,248,.08)),var(--panel2);display:grid;place-items:center;">
            <div style="width:min(210px,72vw);aspect-ratio:1;border-radius:50%;background:conic-gradient(${kcalRingColor} ${kcalPct}%, rgba(148,163,184,.18) 0);display:grid;place-items:center;box-shadow:0 18px 44px rgba(15,23,42,.18);">
              <div style="width:68%;aspect-ratio:1;border-radius:50%;background:var(--panel2);display:grid;place-items:center;text-align:center;border:1px solid var(--border);">
                <div>
                  <div class="muted" style="font-size:12px;">${esc(txt("Aujourd'hui", "Today"))}</div>
                  <strong style="display:block;font-size:32px;line-height:1;">${Math.round(consumedKcal)}</strong>
                  <span class="muted">/ ${Math.round(needsKcal)} kcal</span>
                  <div class="pill" style="margin-top:8px;color:${kcalRingColor};border-color:${kcalRingColor};">${esc(kcalTargetLabel)} ${Math.abs(Math.round(kcalDelta))}</div>
                </div>
              </div>
            </div>
          </div>
          <div class="tb-nutrition-macro-grid">
            <div style="border:1px solid rgba(56,189,248,.35);border-radius:8px;padding:12px;background:rgba(56,189,248,.10);">${progressBar(txt("Eau bue", "Drunk water"), drinkWaterMl, 2000, "ml")}</div>
            <div style="border:1px solid rgba(34,197,94,.35);border-radius:8px;padding:12px;background:rgba(34,197,94,.10);">${progressBar(txt("Proteines", "Protein"), total.protein, proteinTarget, "g")}</div>
            <div style="border:1px solid rgba(245,158,11,.35);border-radius:8px;padding:12px;background:rgba(245,158,11,.10);">${progressBar(txt("Glucides", "Carbs"), total.carbs, carbsTarget, "g")}</div>
            <div style="border:1px solid rgba(251,113,133,.35);border-radius:8px;padding:12px;background:rgba(251,113,133,.10);">${progressBar(txt("Lipides", "Fat"), total.fat, fatTarget, "g")}</div>
            <div style="border:1px solid var(--border);border-radius:8px;padding:12px;background:var(--panel2);grid-column:1/-1;">
              <div class="muted" style="font-size:12px;">${esc(txt("Besoin calcule", "Calculated need"))}</div>
              <strong>${Math.round(base.bmr || 0)} ${esc(txt("base", "base"))} + ${Math.round(sportKcal)} sport + ${Math.round(workKcal)} ${esc(txt("travail", "work"))} = ${Math.round(needsKcal)} kcal</strong>
              <div class="muted" style="font-size:12px;margin-top:6px;">${esc(txt("Hydratation : objectif 2 L en eau bue. Eau des aliments", "Hydration: 2 L target from drunk water. Food water"))} ${Math.round(foodWaterMl)} ml.</div>
            </div>
          </div>
        </div>
        <div class="tb-nutrition-layout">
          <div style="display:flex;flex-direction:column;gap:12px;">
            <div style="border:1px solid var(--border);border-radius:8px;padding:12px;background:var(--panel2);">
              <h3 style="margin:0 0 10px;">${esc(editingItem ? txt("Modifier", "Edit") : txt("Ajout rapide", "Quick add"))}</h3>
              <div class="field"><label>${esc(txt("Chercher", "Search"))}</label><input id="nutrition-search" value="${esc(CACHE.foodQuery)}" placeholder="${esc(txt("Riz, poulet, banane...", "Rice, chicken, banana..."))}"></div>
              <div class="field"><label>${esc(txt("Aliment", "Food"))}</label><select id="nutrition-food">${foodOptions()}</select></div>
              <div class="row tb-nutrition-form-row" style="gap:10px;">
                <div class="field" style="flex:1;"><label>${esc(txt("Mode", "Mode"))}</label><select id="nutrition-amount-mode"><option value="portion">${esc(txt("Portions", "Servings"))}</option><option value="grams">${esc(txt("Grammes", "Grams"))}</option></select></div>
                <div class="field" style="flex:1;"><label>${esc(txt("Quantite", "Quantity"))}</label><input id="nutrition-quantity" type="number" min="0" step="0.25" value="1"></div>
              </div>
              <div class="row tb-nutrition-form-row" style="gap:10px;">
                <div class="field" style="flex:1;"><label>${esc(txt("Grammes estimes", "Estimated grams"))}</label><input id="nutrition-grams" type="number" min="0" step="5" value="100"></div>
                <div class="field" style="flex:1;"><label>${esc(txt("Moment", "Moment"))}</label><select id="nutrition-type"><option value="breakfast">${esc(txt("Petit-dej", "Breakfast"))}</option><option value="morning_snack">${esc(txt("Pause 10h", "10am snack"))}</option><option value="lunch">${esc(txt("Dejeuner", "Lunch"))}</option><option value="afternoon_snack">${esc(txt("Gouter", "Afternoon snack"))}</option><option value="dinner">${esc(txt("Diner", "Dinner"))}</option><option value="snack">${esc(txt("Snack", "Snack"))}</option><option value="meal">${esc(txt("Repas libre", "Free meal"))}</option></select></div>
              </div>
              <div class="pill" id="nutrition-preview">0 kcal</div>
              <button class="btn primary" id="nutrition-save" type="button" style="width:100%;margin-top:10px;">${esc(editingItem ? txt("Enregistrer", "Save") : txt("Ajouter", "Add"))}</button>
              ${editingItem ? `<button class="btn" id="nutrition-edit-cancel" type="button" style="width:100%;margin-top:8px;">${esc(txt("Annuler la modification", "Cancel edit"))}</button>` : ""}
              ${CACHE.error ? `<div class="muted" style="margin-top:10px;">${esc(CACHE.error)}</div>` : ""}
            </div>
            <div style="border:1px solid var(--border);border-radius:8px;padding:12px;background:var(--panel2);">
              <h3 style="margin:0 0 10px;">${esc(txt("Hydratation", "Hydration"))}</h3>
              <div class="field"><label>${esc(txt("Eau ml", "Water ml"))}</label><input id="nutrition-water-ml" type="number" min="0" step="50" value="250"></div>
              <div class="tb-nutrition-water-grid">
                <button class="btn small" type="button" data-nutrition-water-quick="250">250</button>
                <button class="btn small" type="button" data-nutrition-water-quick="500">500</button>
                <button class="btn small" type="button" data-nutrition-water-quick="1000">1L</button>
                <button class="btn small" type="button" data-nutrition-water-quick="2000">2L</button>
              </div>
              <button class="btn primary" id="nutrition-water-only" type="button" style="width:100%;">${esc(txt("Ajouter eau", "Add water"))}</button>
            </div>
            <div style="border:1px solid var(--border);border-radius:8px;padding:12px;background:var(--panel2);">
              <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:10px;">
                <h3 style="margin:0;">${esc(txt("Sommeil", "Sleep"))}</h3>
                <span class="pill">${esc(sleepLabel)}</span>
              </div>
              <div class="muted" style="font-size:12px;margin:-4px 0 8px;">${esc(txt("Nuit du", "Night of"))} ${esc(sleepNightLabel)} → ${esc(day.slice(5).replace("-", "/"))}</div>
              <div class="row tb-nutrition-form-row" style="gap:10px;">
                <div class="field" style="flex:1;"><label>${esc(txt("Heures dormies", "Hours slept"))}</label><input id="nutrition-sleep-hours" type="number" min="0" max="14" step="0.25" value="${esc(String(sleep.hours || ""))}" placeholder="7.5"></div>
                <div class="field" style="flex:1;"><label>${esc(txt("Qualite", "Quality"))}</label><select id="nutrition-sleep-quality"><option value="bad" ${sleep.quality === "bad" ? "selected" : ""}>${esc(txt("Mauvaise", "Bad"))}</option><option value="ok" ${sleep.quality === "ok" ? "selected" : ""}>${esc(txt("Correcte", "Ok"))}</option><option value="good" ${sleep.quality === "good" ? "selected" : ""}>${esc(txt("Bonne", "Good"))}</option></select></div>
              </div>
              <button class="btn" id="nutrition-sleep-save" type="button" style="width:100%;margin-top:8px;">${esc(txt("Enregistrer sommeil", "Save sleep"))}</button>
              <div class="tb-nutrition-week-grid" style="margin-top:10px;margin-bottom:0;">
                ${sleepWeek.map(row => {
                  const sleepPct = Math.max(0, Math.min(100, (n(row.hours, 0) / 7.5) * 100));
                  const height = Math.max(8, Math.min(74, sleepPct * 0.74));
                  const active = row.day === day;
                  const label = row.hours > 0 ? `${Math.round(row.hours * 10) / 10}h · ${row.quality}` : txt("non saisi", "not set");
                  return `<button class="btn small" type="button" data-nutrition-history-date="${esc(row.day)}" title="${esc(txt("Nuit du", "Night of"))} ${esc(row.nightDay || offsetDateISO(row.day, -1))} → ${esc(row.day)} · ${esc(label)} · objectif 7.5h" style="height:92px;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:4px;padding:5px;${active ? "border-color:var(--accent);" : ""}">
                    <span style="width:100%;height:${height}px;border-radius:6px 6px 3px 3px;background:linear-gradient(180deg,#8b5cf6,#38bdf8);"></span>
                    <small>${esc(row.day.slice(5).replace("-", "/"))}</small>
                  </button>`;
                }).join("")}
              </div>
              <div class="muted" style="font-size:12px;margin-top:8px;">${esc(txt("La saisie est rattachee a la nuit precedente de la date selectionnee et remonte dans le KPI Sante.", "The entry is attached to the previous night of the selected date and feeds the Health KPI."))}</div>
            </div>
            <div style="border:1px solid var(--border);border-radius:8px;padding:12px;background:linear-gradient(180deg,rgba(56,189,248,.08),rgba(15,23,42,.02)),var(--panel2);">
              <h3 style="margin:0 0 10px;">${esc(txt("Historique", "History"))}</h3>
              <div class="tb-nutrition-week-grid">
                ${week.map(row => {
                  const height = Math.max(8, Math.min(74, pct(row.kcal, needsKcal) * 0.74));
                  const active = row.day === day;
                  const detail = row.typeRows.map(typeRow => `${mealTypeLabel(typeRow.type)} ${Math.round(typeRow.kcal)} kcal`).join(" · ");
                  return `<button class="btn small" type="button" data-nutrition-history-date="${esc(row.day)}" title="${esc(row.day)} · ${Math.round(row.kcal)} kcal · ${Math.round(row.waterMl)} ml${detail ? ` · ${esc(detail)}` : ""}" style="height:98px;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:4px;padding:5px;${active ? "border-color:var(--accent);" : ""}">
                    <span style="width:100%;height:${height}px;border-radius:6px 6px 3px 3px;background:linear-gradient(180deg,#22c55e,#38bdf8);"></span>
                    <small>${esc(row.day.slice(5).replace("-", "/"))}</small>
                  </button>`;
                }).join("")}
              </div>
              <div class="muted" style="font-size:12px;">${esc(txt("Survole une barre pour le detail du jour.", "Hover a bar for day details."))}</div>
            </div>
          </div>
          <div style="border:1px solid var(--border);border-radius:8px;padding:12px;background:var(--panel2);">
            <h3 style="margin:0 0 10px;">${esc(txt("Jour selectionne", "Selected day"))} · ${esc(day)}</h3>
            <div style="border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:12px;background:rgba(15,23,42,.04);">
              <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;margin-bottom:10px;">
                <div>
                  <div class="muted" style="font-size:12px;">${esc(txt("Comparaison besoins / consomme", "Needs / consumed comparison"))}</div>
                  <strong style="font-size:22px;">${Math.round(consumedKcal)} / ${Math.round(needsKcal)} kcal</strong>
                </div>
                <div class="pill">${esc(kcalTargetLabel)} ${Math.abs(Math.round(kcalDelta))} kcal</div>
              </div>
              <div style="display:grid;gap:10px;">
                ${progressBar("kcal", consumedKcal, needsKcal, "")}
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;">
                  ${progressBar(txt("Proteines", "Protein"), total.protein, proteinTarget, "g")}
                  ${progressBar(txt("Glucides", "Carbs"), total.carbs, carbsTarget, "g")}
                  ${progressBar(txt("Lipides", "Fat"), total.fat, fatTarget, "g")}
                </div>
              </div>
              <div class="muted" style="margin-top:10px;">
                ${esc(txt("Besoins calcules", "Calculated needs"))}: ${Math.round(base.bmr || 0)} ${esc(txt("base", "base"))} + ${Math.round(sportKcal)} sport + ${Math.round(workKcal)} ${esc(txt("travail", "work"))}.
              </div>
            </div>
            <div class="tb-sport-stats" style="margin-bottom:12px;">
              <div class="tb-sport-stat"><span>kcal</span><strong>${Math.round(total.kcal)}</strong></div>
              <div class="tb-sport-stat"><span>${esc(txt("Proteines", "Protein"))}</span><strong>${fmtMacro(total.protein)}</strong></div>
              <div class="tb-sport-stat"><span>${esc(txt("Glucides", "Carbs"))}</span><strong>${fmtMacro(total.carbs)}</strong></div>
              <div class="tb-sport-stat"><span>${esc(txt("Lipides", "Fat"))}</span><strong>${fmtMacro(total.fat)}</strong></div>
              <div class="tb-sport-stat"><span>${esc(txt("Eau bue", "Drunk water"))}</span><strong>${Math.round(drinkWaterMl)} ml</strong></div>
              <div class="tb-sport-stat"><span>${esc(txt("Sommeil", "Sleep"))}</span><strong>${esc(sleepLabel)}</strong></div>
              <div class="tb-sport-stat"><span>${esc(txt("Balance", "Balance"))}</span><strong>${Math.round(balance.balanceKcal)} kcal</strong></div>
            </div>
            <div class="muted" style="margin:-4px 0 12px;">
              ${esc(txt("Depense estimee", "Estimated spend"))}: ${Math.round(balance.spentKcal || 0)} kcal =
              ${esc(txt("base", "base"))} ${Math.round(base.bmr || 0)}
              + sport ${Math.round(sportKcal)}
              + ${esc(txt("travail", "work"))} ${Math.round(workKcal)}.
              ${esc(txt("Tu es", "You are"))} ${esc(balanceLabel)} ${Math.abs(Math.round(balance.balanceKcal || 0))} kcal.
            </div>
            <div style="display:grid;gap:10px;margin-top:12px;">
              <h3 style="margin:0;">${esc(txt("Timeline repas", "Meal timeline"))}</h3>
              ${mealTargets.map((target, index) => {
                const consumed = typeTotals[target.type] || { kcal: 0, protein: 0, carbs: 0, fat: 0 };
                const rowItems = items.filter(item => String(itemMeal(item)?.meal_type || "meal") === target.type);
                const rest = target.kcal - n(consumed.kcal, 0);
                const suggestion = mealMomentSuggestion(target.type, consumed, target.kcal, { ...total, waterMl: drinkWaterMl }, { protein: proteinTarget, carbs: carbsTarget, fat: fatTarget });
                return `<div class="tb-nutrition-timeline-row">
                  <div style="display:grid;grid-template-rows:18px 1fr;justify-items:center;padding-top:4px;">
                    <span style="width:16px;height:16px;border-radius:50%;background:${target.color};box-shadow:0 0 0 4px ${target.color}22;"></span>
                    <span style="width:2px;background:${index === mealTargets.length - 1 ? "transparent" : "rgba(148,163,184,.35)"};"></span>
                  </div>
                  <div style="border:1px solid ${target.color}88;border-radius:8px;padding:12px;background:linear-gradient(135deg,${target.color}20,rgba(15,23,42,.02)),var(--panel2);">
                    <button class="btn" type="button" data-nutrition-pick-type="${esc(target.type)}" style="width:100%;display:flex;justify-content:space-between;gap:10px;align-items:flex-start;text-align:left;border-color:${target.color};">
                      <span><strong>${esc(mealTypeLabel(target.type))}</strong><br><small class="muted">${Math.round(n(consumed.kcal, 0))} / ${target.kcal} kcal</small></span>
                      <span class="pill">${rest >= 0 ? esc(txt("reste", "left")) : esc(txt("surplus", "surplus"))} ${Math.abs(Math.round(rest))}</span>
                    </button>
                    <div style="margin:10px 0;">${progressBar("kcal", consumed.kcal, target.kcal, "")}</div>
                    <div class="pill" style="margin-bottom:8px;background:rgba(255,255,255,.06);">${esc(suggestion)}</div>
                    ${rowItems.length ? rowItems.map(item => `
                      <div style="display:flex;justify-content:space-between;gap:10px;border-top:1px solid rgba(148,163,184,.22);padding:8px 0;align-items:flex-start;flex-wrap:wrap;">
                        <div><strong>${esc(item.label || item.food_key || "Aliment")}</strong><div class="muted">${Math.round(n(item.grams, 0))}g · P ${fmtMacro(item.protein_g)} · G ${fmtMacro(item.carbs_g)} · L ${fmtMacro(item.fat_g)}</div></div>
                        <div style="display:flex;gap:6px;align-items:center;justify-content:flex-end;flex-wrap:wrap;"><strong>${Math.round(n(item.kcal, 0))} kcal</strong><button class="btn small" type="button" data-nutrition-edit="${esc(String(item.id || ""))}">${esc(txt("Modifier", "Edit"))}</button><button class="btn small" type="button" data-nutrition-delete="${esc(String(item.id || ""))}">${esc(txt("Supprimer", "Delete"))}</button></div>
                      </div>`).join("") : `<div class="muted">${esc(txt("Aucun aliment sur ce moment.", "No food for this moment."))}</div>`}
                  </div>
                </div>`;
              }).join("")}
              ${items.filter(item => !mealTargets.some(target => target.type === String(itemMeal(item)?.meal_type || "meal"))).length ? `
                <div style="border:1px solid var(--border);border-radius:8px;padding:12px;background:var(--panel2);">
                  <strong>${esc(txt("Autres ajouts", "Other entries"))}</strong>
                  ${items.filter(item => !mealTargets.some(target => target.type === String(itemMeal(item)?.meal_type || "meal"))).map(item => `
                    <div style="display:flex;justify-content:space-between;gap:10px;border-top:1px solid var(--border);padding:8px 0;"><span>${esc(item.label || item.food_key || "Aliment")}</span><strong>${Math.round(n(item.kcal, 0))} kcal</strong></div>
                  `).join("")}
                </div>` : ""}
            </div>
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
    const editingItem = CACHE.editingItemId ? CACHE.items.find(item => String(item.id || "") === String(CACHE.editingItemId)) : null;
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
    root.querySelectorAll("[data-nutrition-pick-type]").forEach(btn => {
      btn.onclick = () => {
        const select = root.querySelector("#nutrition-type");
        if (select) select.value = btn.getAttribute("data-nutrition-pick-type") || "meal";
        root.querySelector("#nutrition-search")?.focus();
      };
    });
    root.querySelectorAll("[data-nutrition-food-filter]").forEach(btn => {
      btn.onclick = () => {
        CACHE.foodCategory = btn.getAttribute("data-nutrition-food-filter") || "all";
        renderNutrition("food-filter");
      };
    });
    root.querySelectorAll("[data-nutrition-pick-food]").forEach(btn => {
      btn.onclick = () => {
        const key = btn.getAttribute("data-nutrition-pick-food") || "";
        const food = CACHE.foods.find(row => String(row.key) === key);
        CACHE.foodQuery = food?.name || "";
        CACHE.foodCategory = "all";
        renderNutrition("food-pick");
      };
    });
    const dateInput = root.querySelector("#nutrition-date");
    if (dateInput) dateInput.onchange = async () => {
      CACHE.selectedDate = dateInput.value || todayISO();
      await loadNutrition({ force: true });
      renderNutrition("date");
    };
    const save = root.querySelector("#nutrition-save");
    if (save) save.onclick = () => saveNutritionMeal(root);
    const cancel = root.querySelector("#nutrition-edit-cancel");
    if (cancel) cancel.onclick = () => { CACHE.editingItemId = ""; renderNutrition("edit-cancel"); };
    const waterOnly = root.querySelector("#nutrition-water-only");
    if (waterOnly) waterOnly.onclick = () => saveWaterOnly(root);
    const sleepSave = root.querySelector("#nutrition-sleep-save");
    if (sleepSave) sleepSave.onclick = () => saveSleep(root);
    root.querySelectorAll("[data-nutrition-water-quick]").forEach(btn => {
      btn.onclick = () => {
        const input = root.querySelector("#nutrition-water-ml");
        if (input) input.value = btn.getAttribute("data-nutrition-water-quick") || "250";
        saveWaterOnly(root);
      };
    });
    root.querySelectorAll("[data-nutrition-history-date]").forEach(btn => {
      btn.onclick = async () => {
        const picked = btn.getAttribute("data-nutrition-history-date") || todayISO();
        CACHE.selectedDate = picked;
        CACHE.expandedHistory = CACHE.expandedHistory === picked ? "" : picked;
        await loadNutrition({ force: true });
        renderNutrition("history-date");
      };
    });
    root.querySelectorAll("[data-nutrition-history-type]").forEach(btn => {
      btn.onclick = async () => {
        const [picked] = String(btn.getAttribute("data-nutrition-history-type") || "").split("::");
        CACHE.selectedDate = picked || todayISO();
        CACHE.expandedHistory = picked || "";
        await loadNutrition({ force: true });
        renderNutrition("history-type");
      };
    });
    root.querySelectorAll("[data-nutrition-delete]").forEach(btn => {
      btn.onclick = () => deleteNutritionItem(btn.getAttribute("data-nutrition-delete"));
    });
    root.querySelectorAll("[data-nutrition-edit]").forEach(btn => {
      btn.onclick = () => startNutritionEdit(root, btn.getAttribute("data-nutrition-edit"));
    });
    if (editingItem) hydrateNutritionEdit(root, editingItem);
  }
  function hydrateNutritionEdit(root, item) {
    const food = CACHE.foods.find(row => String(row.key) === String(item.food_key || ""));
    const meal = itemMeal(item);
    if (food) {
      const select = root.querySelector("#nutrition-food");
      if (select && Array.from(select.options).some(opt => opt.value === food.key)) select.value = food.key;
    }
    const mode = root.querySelector("#nutrition-amount-mode");
    if (mode) mode.value = "grams";
    const grams = root.querySelector("#nutrition-grams");
    if (grams) {
      grams.readOnly = false;
      grams.value = Math.round(n(item.grams, food?.servingGrams || 100));
    }
    const type = root.querySelector("#nutrition-type");
    if (type) type.value = meal?.meal_type || "meal";
    updateNutritionPreview(root);
  }
  function startNutritionEdit(root, id) {
    CACHE.editingItemId = String(id || "");
    CACHE.foodQuery = "";
    renderNutrition("edit");
  }
  async function saveNutritionMeal(root) {
    const food = selectedFood(root);
    syncNutritionAmount(root);
    const grams = n(root.querySelector("#nutrition-grams")?.value, food?.servingGrams || 100);
    const nut = nutritionForGrams(food, grams);
    const waterMl = n(nut.waterMl, 0);
    const c = client();
    try {
      if (c && uid() && CACHE.editingItemId) {
        const existing = CACHE.items.find(item => String(item.id || "") === String(CACHE.editingItemId));
        const meal = itemMeal(existing);
        if (meal?.id) {
          const mealUpdate = await c.from(table("nutrition_meals")).update({
            meal_date: selectedDateISO(),
            meal_type: root.querySelector("#nutrition-type")?.value || "meal",
            label: food.name,
            water_ml: waterMl,
          }).eq("id", meal.id).eq("user_id", uid());
          if (mealUpdate.error) throw mealUpdate.error;
        }
        const itemUpdate = await c.from(table("nutrition_meal_items")).update({
          food_key: food.key,
          label: food.name,
          grams,
          kcal: nut.kcal,
          protein_g: nut.protein,
          carbs_g: nut.carbs,
          fat_g: nut.fat,
          fiber_g: nut.fiber,
        }).eq("id", CACHE.editingItemId).eq("user_id", uid());
        if (itemUpdate.error) throw itemUpdate.error;
        CACHE.editingItemId = "";
      } else if (c && uid()) {
        const meal = await c.from(table("nutrition_meals")).insert({
          user_id: uid(),
          travel_id: activeTravelId(),
          meal_date: selectedDateISO(),
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
      } else if (CACHE.editingItemId) {
        const rows = loadLocalMeals();
        const edited = rows.map(row => {
          if (String(row.item?.id || "") !== String(CACHE.editingItemId)) return row;
          return {
            meal: { ...(row.meal || {}), meal_date: selectedDateISO(), meal_type: root.querySelector("#nutrition-type")?.value || "meal", label: food.name, water_ml: waterMl },
            item: { ...(row.item || {}), food_key: food.key, label: food.name, grams, kcal: nut.kcal, protein_g: nut.protein, carbs_g: nut.carbs, fat_g: nut.fat, fiber_g: nut.fiber },
          };
        });
        saveLocalMeals(edited);
        CACHE.editingItemId = "";
      } else {
        const mealId = `local_meal_${Date.now()}`;
        const itemId = `local_item_${Date.now()}`;
        const rows = loadLocalMeals();
        rows.unshift({
          meal: { id: mealId, user_id: uid(), travel_id: activeTravelId(), meal_date: selectedDateISO(), meal_type: root.querySelector("#nutrition-type")?.value || "meal", label: food.name, water_ml: waterMl, created_at: new Date().toISOString() },
          item: grams > 0 ? { id: itemId, user_id: uid(), meal_id: mealId, food_key: food.key, label: food.name, grams, kcal: nut.kcal, protein_g: nut.protein, carbs_g: nut.carbs, fat_g: nut.fat, fiber_g: nut.fiber, created_at: new Date().toISOString() } : null,
        });
        saveLocalMeals(rows);
      }
      await loadNutrition({ force: true });
      try { if (typeof window.renderKPI === "function") window.renderKPI(); } catch (_) {}
      try { if (typeof window.tbSyncPreferenceDrivenNotifications === "function") window.tbSyncPreferenceDrivenNotifications(); } catch (_) {}
      renderNutrition("save");
    } catch (e) {
      CACHE.error = e?.message || String(e);
      renderNutrition("save-error");
    }
  }
  async function saveWaterOnly(root) {
    const water = n(root.querySelector("#nutrition-water-ml")?.value, 0) || 250;
    const c = client();
    try {
      if (c && uid()) {
        const meal = await c.from(table("nutrition_meals")).insert({
          user_id: uid(),
          travel_id: activeTravelId(),
          meal_date: selectedDateISO(),
          meal_type: root.querySelector("#nutrition-type")?.value || "meal",
          label: txt("Eau", "Water"),
          water_ml: water,
        });
        if (meal.error) throw meal.error;
      } else {
        const rows = loadLocalMeals();
        rows.unshift({
          meal: { id: `local_meal_${Date.now()}`, user_id: uid(), travel_id: activeTravelId(), meal_date: selectedDateISO(), meal_type: root.querySelector("#nutrition-type")?.value || "meal", label: txt("Eau", "Water"), water_ml: water, created_at: new Date().toISOString() },
          item: null,
        });
        saveLocalMeals(rows);
      }
      await loadNutrition({ force: true });
      try { if (typeof window.renderKPI === "function") window.renderKPI(); } catch (_) {}
      try { if (typeof window.tbSyncPreferenceDrivenNotifications === "function") window.tbSyncPreferenceDrivenNotifications(); } catch (_) {}
      renderNutrition("water-only");
    } catch (e) {
      CACHE.error = e?.message || String(e);
      renderNutrition("water-error");
    }
  }
  function saveSleep(root) {
    const hours = Math.max(0, Math.min(14, n(root.querySelector("#nutrition-sleep-hours")?.value, 0)));
    const quality = String(root.querySelector("#nutrition-sleep-quality")?.value || "ok");
    const rows = loadSleepRows();
    const nightDay = offsetDateISO(selectedDateISO(), -1);
    if (hours > 0) {
      rows[nightDay] = { hours, quality, updatedAt: new Date().toISOString() };
    } else {
      delete rows[nightDay];
    }
    saveSleepRows(rows);
    publishNutrition("sleep");
    try { if (typeof window.renderKPI === "function") window.renderKPI(); } catch (_) {}
    renderNutrition("sleep");
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
  try { document.addEventListener("tb:refresh:data_loaded", () => { try { window.tbReloadNutrition(); } catch (_) {} }); } catch (_) {}
  setTimeout(() => { try { if (uid()) loadNutrition().catch(() => {}); } catch (_) {} }, 450);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ensureNutritionShell);
  else ensureNutritionShell();
})();
