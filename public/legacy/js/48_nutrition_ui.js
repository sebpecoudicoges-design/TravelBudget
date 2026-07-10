/* =========================
   Nutrition module
   - Food library, quick meals, kcal/macros, hydration
   ========================= */
(function () {
  const NUTRITION_STORE = window.Data?.nutritionStore || null;
  const CACHE = NUTRITION_STORE?.state || { loaded: false, loading: false, syncingLocal: false, foods: [], meals: [], items: [], sleep: {}, localRows: [], error: "", syncStatus: "", syncPhase: "", foodQuery: "", foodCategory: "all", selectedMealType: "", selectedDate: "", expandedHistory: "", editingItemId: "" };
  const FALLBACK_FOODS = [
    { key: "rice_cooked", name: "Riz cuit", servingGrams: 150, kcalPer100g: 130, proteinPer100g: 2.7, carbsPer100g: 28, fatPer100g: 0.3, fiberPer100g: 0.4 },
    { key: "rice_onion_zucchini", name: "Riz oignon courgette", servingGrams: 250, kcalPer100g: 112, proteinPer100g: 2.5, carbsPer100g: 22, fatPer100g: 1.8, fiberPer100g: 1.5 },
    { key: "rice_zucchini_onion_salmon", name: "Riz courgette oignon saumon", servingGrams: 380, kcalPer100g: 150, proteinPer100g: 11, carbsPer100g: 18, fatPer100g: 4.8, fiberPer100g: 2.2, tags: ["plat", "riz", "saumon", "legumes", "portion_estimee"] },
    { key: "rice_zucchini_onion_cream_salmon", name: "Riz courgette oignon creme fraiche saumon", servingGrams: 400, kcalPer100g: 183, proteinPer100g: 8.2, carbsPer100g: 12.5, fatPer100g: 9.2, fiberPer100g: 1.2, waterMlPer100g: 63, tags: ["plat", "riz", "saumon", "creme", "legumes", "portion_estimee", "source_usda_fdc"] },
    { key: "rice_carrot_broccoli_onion_lamb", name: "Riz carotte brocoli oignon agneau", servingGrams: 430, kcalPer100g: 158, proteinPer100g: 9.5, carbsPer100g: 18.5, fatPer100g: 5.2, fiberPer100g: 2.6, tags: ["plat", "riz", "agneau", "legumes", "portion_estimee", "source_usda_fdc"] },
    { key: "beef_stew_carrot_leek_tomato_onion_rice", name: "Boeuf mijote carotte poireau tomate oignon riz", servingGrams: 450, kcalPer100g: 137, proteinPer100g: 8.1, carbsPer100g: 12.8, fatPer100g: 5.6, fiberPer100g: 1.8, waterMlPer100g: 70, tags: ["plat", "boeuf", "mijote", "riz", "carotte", "poireau", "tomate", "oignon", "portion_realiste", "recette_estimee", "source_ciqual_2025", "source_usda_fdc"] },
    { key: "pasta_cooked", name: "Pates cuites", servingGrams: 150, kcalPer100g: 157, proteinPer100g: 5.8, carbsPer100g: 30.9, fatPer100g: 0.9, fiberPer100g: 1.8 },
    { key: "pasta_chicken_onion_cream", name: "Pates creme fraiche oignon poulet", servingGrams: 300, kcalPer100g: 185, proteinPer100g: 12, carbsPer100g: 19, fatPer100g: 6.8, fiberPer100g: 1.2 },
    { key: "pasta_curry_chicken", name: "Pates curry poulet", servingGrams: 380, kcalPer100g: 178, proteinPer100g: 12, carbsPer100g: 23, fatPer100g: 4.5, fiberPer100g: 2.2, tags: ["plat", "pates", "poulet", "curry", "portion_estimee"] },
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
    { key: "yogurt_hipro_vanilla", name: "Yaourt HiPRO vanille", servingGrams: 160, kcalPer100g: 59, proteinPer100g: 10, carbsPer100g: 4.2, fatPer100g: 0.2, tags: ["laitage", "proteines", "yaourt", "portion_estimee"] },
    { key: "yogurt_hipro_plain", name: "Yaourt HiPRO nature", servingGrams: 160, kcalPer100g: 57, proteinPer100g: 10, carbsPer100g: 3.8, fatPer100g: 0.2, tags: ["laitage", "proteines", "yaourt", "portion_estimee"] },
    { key: "fromage_blanc_0", name: "Fromage blanc 0%", servingGrams: 125, kcalPer100g: 45, proteinPer100g: 8, carbsPer100g: 4, fatPer100g: 0.2 },
    { key: "fromage_blanc_3", name: "Fromage blanc 3%", servingGrams: 125, kcalPer100g: 76, proteinPer100g: 7.7, carbsPer100g: 4, fatPer100g: 3 },
    { key: "skyr", name: "Skyr", servingGrams: 140, kcalPer100g: 63, proteinPer100g: 10, carbsPer100g: 4, fatPer100g: 0.2 },
    { key: "muesli", name: "Muesli", servingGrams: 45, kcalPer100g: 365, proteinPer100g: 10, carbsPer100g: 62, fatPer100g: 7, fiberPer100g: 8 },
    { key: "tinaberries_macadamia_toasted_muesli", name: "Tinaberries Macadamias Toasted Muesli", servingGrams: 30, kcalPer100g: 461, proteinPer100g: 9.5, carbsPer100g: 46.4, fatPer100g: 25.4, fiberPer100g: 0 },
    { key: "strawberry_soft_serve_large_cone", name: "Grand cornet glace fraise", servingGrams: 250, kcalPer100g: 209, proteinPer100g: 4.1, carbsPer100g: 25.2, fatPer100g: 10.5, fiberPer100g: 0.3 },
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
    { key: "mixed_red_berries", name: "Melange de fruits rouges", servingGrams: 150, kcalPer100g: 47, proteinPer100g: 0.9, carbsPer100g: 11.4, fatPer100g: 0.4, fiberPer100g: 3.6, waterMlPer100g: 87 },
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
  function nutritionPrefsKey(kind) { return `travelbudget_nutrition_${kind}_v1::${uid() || "anon"}`; }
  function nutritionMealFavoritesKey() { return `travelbudget_nutrition_meal_favorites_v1::${uid() || "anon"}`; }
  function healthGoalKey() { return `${window.TB_CONST?.LS_KEYS?.health_goal || "travelbudget_health_goal_v1"}::${uid() || "anon"}`; }
  function nutritionGoalKey() { return healthGoalKey(); }
  function rules() { return window.Core?.nutritionRules || {}; }
  function repository() { return window.Data?.nutritionRepository || {}; }
  function nutritionStore() { return window.Data?.nutritionStore || NUTRITION_STORE || null; }
  function view() { return window.UI?.nutritionView || {}; }
  function normalizeFood(row) { return rules().normalizeFoodRow ? rules().normalizeFoodRow(row) : row; }
  function nutritionForGrams(food, grams) { return rules().nutritionForGrams ? rules().nutritionForGrams(food, grams) : { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, waterMl: 0 }; }
  function sumNutrition(items) { return rules().sumNutrition ? rules().sumNutrition(items) : { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, waterMl: 0 }; }
  function loadNutritionGoal() {
    try {
      const raw = JSON.parse(localStorage.getItem(nutritionGoalKey()) || "{}");
      const modeRaw = String(raw.mode || "bulk");
      const mode = ["bulk", "maintenance", "cut"].includes(modeRaw) ? modeRaw : "maintenance";
      const surplusKcal = Math.max(300, Math.min(500, Math.round(n(raw.surplusKcal, 350))));
      const deficitKcal = Math.max(250, Math.min(500, Math.round(n(raw.deficitKcal, 300))));
      return {
        mode,
        surplusKcal,
        deficitKcal,
        targetWeightKg: Math.max(35, Math.min(180, n(raw.targetWeightKg, bodyWeight() + 3))),
        weeklyRateKg: Math.max(0.1, Math.min(0.8, n(raw.weeklyRateKg, 0.25))),
      };
    } catch (_) {
      return { mode: "bulk", surplusKcal: 350, deficitKcal: 300, targetWeightKg: bodyWeight() + 3, weeklyRateKg: 0.25 };
    }
  }
  function saveNutritionGoal(next) {
    const goal = Object.assign(loadNutritionGoal(), next || {});
    goal.mode = ["bulk", "maintenance", "cut"].includes(String(goal.mode || "")) ? String(goal.mode) : "maintenance";
    goal.surplusKcal = Math.max(300, Math.min(500, Math.round(n(goal.surplusKcal, 350))));
    goal.deficitKcal = Math.max(250, Math.min(500, Math.round(n(goal.deficitKcal, 300))));
    goal.targetWeightKg = Math.max(35, Math.min(180, Math.round(n(goal.targetWeightKg, bodyWeight() + 3) * 10) / 10));
    goal.weeklyRateKg = Math.max(0.1, Math.min(0.8, Math.round(n(goal.weeklyRateKg, 0.25) * 100) / 100));
    try { localStorage.setItem(nutritionGoalKey(), JSON.stringify(goal)); } catch (_) {}
    try { document.dispatchEvent(new CustomEvent("tb:nutrition:goal_changed", { detail: goal })); } catch (_) {}
    try { if (typeof window.renderKPI === "function") window.renderKPI(); } catch (_) {}
    return goal;
  }
  function nutritionGoalLabel(goal = loadNutritionGoal()) {
    if (goal.mode === "bulk") return txt("Prise de masse douce", "Lean bulk");
    if (goal.mode === "cut") return txt("Perte de gras douce", "Gentle fat loss");
    return txt("Maintien / recomposition", "Maintenance / recomposition");
  }
  function nutritionGoalOffset(goal = loadNutritionGoal()) {
    if (goal.mode === "bulk") return n(goal.surplusKcal, 350);
    if (goal.mode === "cut") return -n(goal.deficitKcal, 300);
    return 0;
  }
  function nutritionGoalTargets(spentKcal, kg) {
    const goal = loadNutritionGoal();
    if (rules().nutritionGoalTargets) return rules().nutritionGoalTargets({
      spentKcal,
      weightKg: kg,
      mode: goal.mode,
      surplusKcal: goal.surplusKcal,
      deficitKcal: goal.deficitKcal,
    });
    const spent = Math.max(0, n(spentKcal, 0));
    const offset = nutritionGoalOffset(goal);
    const targetKcal = Math.max(1200, Math.round(spent + offset));
    const kgClean = Math.max(30, n(kg, 70));
    const proteinPerKg = goal.mode === "bulk" ? 1.8 : goal.mode === "cut" ? 1.9 : 1.6;
    const fatPerKg = goal.mode === "bulk" ? 0.9 : goal.mode === "cut" ? 0.75 : 0.8;
    const protein = Math.max(70, Math.round(kgClean * proteinPerKg));
    const fat = Math.max(42, Math.round(kgClean * fatPerKg));
    return {
      mode: goal.mode,
      surplusKcal: goal.mode === "bulk" ? goal.surplusKcal : 0,
      deficitKcal: goal.mode === "cut" ? goal.deficitKcal : 0,
      offsetKcal: offset,
      targetKcal,
      protein,
      proteinPerKg,
      fat,
      fatPerKg,
      carbs: Math.max(90, Math.round((targetKcal - protein * 4 - fat * 9) / 4)),
    };
  }
  function foodForItem(item) {
    const key = String(item?.food_key || item?.foodKey || "");
    return CACHE.foods.find(food => String(food.key || "") === key) || { key, name: item?.label || key, tags: [] };
  }
  function alcoholForGrams(food, grams) {
    if (rules().alcoholForGrams) return rules().alcoholForGrams(food, grams);
    const f = normalizeFood(food) || {};
    const text = normalizeText(`${f.key || ""} ${f.name || ""} ${(f.tags || []).join(" ")}`);
    if (/sans alcool|alcohol[-_ ]?free|0\s?%/.test(text)) return { gramsAlcohol: 0, standardDrinks: 0 };
    const isAlcohol = (Array.isArray(f.tags) && f.tags.some(tag => ["alcool", "alcohol"].includes(normalizeText(tag))))
      || /\b(biere|beer|ipa|pinte|vin|wine|cidre|cider|whisky|vodka|rhum|gin|cocktail)\b/.test(text);
    if (!isAlcohol) return { gramsAlcohol: 0, standardDrinks: 0 };
    const abv = /vin|wine/.test(text) ? 0.125 : (/whisky|vodka|rhum|rum|gin|spiritueux/.test(text) ? 0.40 : (/ipa/.test(text) ? 0.06 : 0.05));
    const gramsAlcohol = Math.max(0, n(grams, f.servingGrams || 0)) * abv * 0.789;
    return { gramsAlcohol, standardDrinks: gramsAlcohol / 10 };
  }
  function alcoholSummaryForItems(items) {
    const entries = (items || []).map(item => {
      const food = foodForItem(item);
      const alcohol = alcoholForGrams(food, n(item?.grams, food?.servingGrams || 0));
      if (n(alcohol.standardDrinks, 0) <= 0) return null;
      return {
        item,
        food,
        label: item?.label || food?.name || food?.key || txt("Alcool", "Alcohol"),
        grams: n(item?.grams, food?.servingGrams || 0),
        gramsAlcohol: n(alcohol.gramsAlcohol, 0),
        standardDrinks: n(alcohol.standardDrinks, 0),
      };
    }).filter(Boolean);
    return {
      entries,
      gramsAlcohol: entries.reduce((sum, row) => sum + row.gramsAlcohol, 0),
      standardDrinks: entries.reduce((sum, row) => sum + row.standardDrinks, 0),
    };
  }
  function alcoholJudgement(dayDrinks, weekDrinks, drinkingDays) {
    if (dayDrinks > 2.01) return { level: "bad", color: "#ef4444", label: txt("Au-dessus du repere jour", "Above daily guide"), note: txt("Le repere francais est maximum 2 verres standard sur une journee.", "French guide is a maximum of 2 standard drinks in a day.") };
    if (weekDrinks > 10.01) return { level: "bad", color: "#ef4444", label: txt("Semaine trop haute", "Week too high"), note: txt("Le repere francais est maximum 10 verres standard par semaine.", "French guide is a maximum of 10 standard drinks per week.") };
    if (drinkingDays >= 6 && weekDrinks > 0.1) return { level: "warn", color: "#f59e0b", label: txt("Pas tous les jours", "Not every day"), note: txt("Le repere recommande aussi des jours sans alcool.", "The guide also recommends alcohol-free days.") };
    if (dayDrinks > 0.05 || weekDrinks > 0.05) return { level: "warn", color: "#f59e0b", label: txt("Dans les reperes", "Within guide"), note: txt("Reste sous 2 verres/jour et 10/semaine, avec jours sans alcool.", "Stay below 2/day and 10/week, with alcohol-free days.") };
    return { level: "good", color: "#22c55e", label: txt("Aucun alcool detecte", "No alcohol detected"), note: txt("Aucun aliment alcoolise lie a cette periode.", "No alcoholic food linked to this period.") };
  }
  function loadCachedFoods() {
    const repo = repository();
    if (typeof repo.loadCachedFoods === "function") return repo.loadCachedFoods({ storage: localStorage, key: foodCacheKey() });
    try { const rows = JSON.parse(localStorage.getItem(foodCacheKey()) || "[]"); return Array.isArray(rows) ? rows : []; } catch (_) { return []; }
  }
  function saveCachedFoods(rows) {
    const repo = repository();
    if (typeof repo.saveCachedFoods === "function") return repo.saveCachedFoods({ storage: localStorage, key: foodCacheKey(), rows });
    try { localStorage.setItem(foodCacheKey(), JSON.stringify((rows || []).slice(0, 500))); } catch (_) {}
    return false;
  }
  function loadLocalMeals() {
    const repo = repository();
    if (typeof repo.loadLocalNutritionRows === "function") return repo.loadLocalNutritionRows({ storage: localStorage, key: localMealKey() });
    try { const rows = JSON.parse(localStorage.getItem(localMealKey()) || "[]"); return Array.isArray(rows) ? rows : []; } catch (_) { return []; }
  }
  function saveLocalMeals(rows) {
    const repo = repository();
    if (typeof repo.saveLocalNutritionRows === "function") return repo.saveLocalNutritionRows({ storage: localStorage, key: localMealKey(), rows });
    try { localStorage.setItem(localMealKey(), JSON.stringify((rows || []).slice(0, 200))); } catch (_) {}
    return false;
  }
  function localNutritionRowKey(row, index) {
    const repo = repository();
    if (typeof repo.localNutritionRowKey === "function") return repo.localNutritionRowKey(row, index);
    const raw = String(row?.syncId || row?.meal?.sync_id || row?.meal?.id || row?.item?.id || "").trim();
    return raw || `idx_${Math.max(0, n(index, 0))}`;
  }
  function discardNutritionQueue() {
    try { if (typeof window.tbOfflineQueueDiscardKind === "function") window.tbOfflineQueueDiscardKind("nutrition.sync_local"); } catch (_) {}
    try { if (typeof window.tbOfflineQueueDiscardFailed === "function") window.tbOfflineQueueDiscardFailed("nutrition.sync_local"); } catch (_) {}
  }
  function discardLocalNutritionRow(key) {
    const repo = repository();
    const result = typeof repo.discardLocalNutritionRow === "function"
      ? repo.discardLocalNutritionRow({ storage: localStorage, key: localMealKey(), rowKey: key })
      : null;
    if (result) {
      if (!result.remaining.length) discardNutritionQueue();
      return result.removed;
    }
    const wanted = String(key || "");
    const rows = loadLocalMeals();
    const next = rows.filter((row, index) => localNutritionRowKey(row, index) !== wanted);
    saveLocalMeals(next);
    if (!next.length) discardNutritionQueue();
    return rows.length - next.length;
  }
  function discardAllLocalNutritionRows() {
    const repo = repository();
    const count = typeof repo.discardAllLocalNutritionRows === "function"
      ? repo.discardAllLocalNutritionRows({ storage: localStorage, key: localMealKey() })
      : loadLocalMeals().length;
    if (typeof repo.discardAllLocalNutritionRows !== "function") saveLocalMeals([]);
    discardNutritionQueue();
    CACHE.syncStatus = count ? txt("Attentes nutrition supprimees.", "Nutrition pending entries removed.") : "";
    return count;
  }
  function renderNutritionSyncPanel() {
    const rows = loadLocalMeals();
    if (!rows.length) return "";
    const globalPending = (() => {
      try {
        return typeof window.tbOfflineQueuePending === "function"
          ? window.tbOfflineQueuePending().filter(item => String(item?.kind || "") === "nutrition.sync_local")
          : [];
      } catch (_) { return []; }
    })();
    return `<div style="margin-top:12px;border:1px solid rgba(245,158,11,.38);border-radius:12px;padding:12px;background:linear-gradient(135deg,rgba(245,158,11,.14),rgba(56,189,248,.06)),var(--panel2);">
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap;">
        <div>
          <strong>${esc(txt("Synchro alimentation en attente", "Pending nutrition sync"))}</strong>
          <div class="muted" style="font-size:12px;margin-top:3px;">${rows.length} ${esc(txt("ajout(s) local(aux)", "local entry/entries"))}${globalPending.length ? ` · ${globalPending.length} ${esc(txt("action(s) file offline", "offline queue action(s)"))}` : ""}${CACHE.syncStatus ? ` · ${esc(CACHE.syncStatus)}` : ""}</div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn small primary" type="button" id="nutrition-sync-pending">${esc(txt("Synchroniser", "Sync"))}</button>
          <button class="btn small danger" type="button" id="nutrition-clear-pending">${esc(txt("Vider", "Clear"))}</button>
        </div>
      </div>
      <div style="display:grid;gap:6px;margin-top:10px;">
        ${rows.slice(0, 8).map((row, index) => {
          const meal = row.meal || {};
          const item = row.item || {};
          const key = localNutritionRowKey(row, index);
          const label = item.label || meal.label || txt("Ajout nutrition", "Nutrition entry");
          const amount = n(item.kcal, 0) > 0 ? `${Math.round(n(item.kcal, 0))} kcal` : `${Math.round(n(meal.water_ml, 0))} ml`;
          const meta = `${localDateISO(meal.meal_date) || selectedDateISO()} · ${mealTypeLabel(meal.meal_type || "meal")} · ${amount}`;
          return `<div style="display:flex;justify-content:space-between;gap:10px;align-items:center;border-top:1px solid rgba(148,163,184,.22);padding-top:6px;">
            <span><strong>${esc(label)}</strong><br><small class="muted">${esc(meta)}${row.syncError ? ` · ${esc(row.syncError)}` : ""}</small></span>
            <button class="btn small" type="button" data-nutrition-discard-local="${esc(key)}">${esc(txt("Supprimer", "Delete"))}</button>
          </div>`;
        }).join("")}
        ${rows.length > 8 ? `<div class="muted" style="font-size:12px;">+${rows.length - 8} ${esc(txt("autre(s) attente(s)", "other pending entry/entries"))}</div>` : ""}
      </div>
    </div>`;
  }
  function isOfflineSkipError(err) {
    const repo = repository();
    if (typeof repo.isOfflineSkipError === "function") return repo.isOfflineSkipError(err);
    return /offline mode|supabase request skipped|failed to fetch|network/i.test(String(err?.message || err || ""));
  }
  function isDuplicateNutritionError(err) {
    const repo = repository();
    if (typeof repo.isDuplicateNutritionError === "function") return repo.isDuplicateNutritionError(err);
    return String(err?.code || "") === "23505" || /duplicate key|unique constraint|nutrition_meal_items_exact_dedupe/i.test(String(err?.message || err || ""));
  }
  function enqueueNutritionSync() {
    try {
      if (typeof window.tbOfflineQueueEnqueue === "function") {
        window.tbOfflineQueueEnqueue("nutrition.sync_local", {}, { label: "nutrition" });
      }
    } catch (_) {}
  }
  function nutritionSyncMarker(syncId) {
    const repo = repository();
    if (typeof repo.nutritionSyncMarker === "function") return repo.nutritionSyncMarker(syncId);
    const id = String(syncId || "").trim();
    return id ? `tb_sync:${id}` : "";
  }
  function nutritionSyncId(row) {
    const repo = repository();
    if (typeof repo.nutritionSyncId === "function") return repo.nutritionSyncId(row);
    return String(row?.syncId || row?.meal?.sync_id || row?.meal?.id || "").trim();
  }
  function notesWithNutritionSyncId(notes, syncId) {
    const repo = repository();
    if (typeof repo.notesWithNutritionSyncId === "function") return repo.notesWithNutritionSyncId(notes, syncId);
    const marker = nutritionSyncMarker(syncId);
    const base = String(notes || "").trim();
    if (!marker) return base || null;
    if (base.includes(marker)) return base;
    return [base, marker].filter(Boolean).join(" ");
  }
  function makeLocalNutritionRow({ food, grams, nut, waterMl, mealType, mealDate, label, syncId }) {
    const repo = repository();
    if (typeof repo.makeLocalNutritionRow === "function") {
      return repo.makeLocalNutritionRow({
        food, grams, nut, waterMl, mealType, mealDate: mealDate || selectedDateISO(), label, syncId,
        userId: uid(), travelId: activeTravelId(),
      });
    }
    const stamp = String(syncId || "").replace(/^nutrition_/, "") || (Date.now() + "_" + Math.random().toString(16).slice(2));
    const mealId = `local_meal_${stamp}`;
    const itemId = `local_item_${stamp}`;
    const rowSyncId = syncId || `nutrition_${stamp}`;
    return {
      syncId: rowSyncId,
      meal: {
        id: mealId,
        sync_id: rowSyncId,
        user_id: uid(),
        travel_id: activeTravelId(),
        meal_date: mealDate || selectedDateISO(),
        meal_type: mealType || "meal",
        label: label || food?.name || txt("Repas", "Meal"),
        water_ml: n(waterMl, 0),
        notes: notesWithNutritionSyncId("", rowSyncId),
        created_at: new Date().toISOString(),
      },
      item: grams > 0 ? {
        id: itemId,
        user_id: uid(),
        meal_id: mealId,
        food_key: food?.key || null,
        label: label || food?.name || "Aliment",
        grams,
        kcal: n(nut?.kcal, 0),
        protein_g: n(nut?.protein, 0),
        carbs_g: n(nut?.carbs, 0),
        fat_g: n(nut?.fat, 0),
        fiber_g: n(nut?.fiber, 0),
        created_at: new Date().toISOString(),
      } : null,
    };
  }
  function upsertOptimisticNutritionRow(row) {
    try {
      if (!row?.meal) return;
      const store = nutritionStore();
      if (typeof store?.mergeOptimisticRow === "function") {
        store.mergeOptimisticRow(row);
        publishNutrition("optimistic");
        return;
      }
      const meal = Object.assign({}, row.meal, { localOnly: true, offlinePending: true });
      const item = row.item ? Object.assign({}, row.item, { localOnly: true, offlinePending: true }) : null;
      CACHE.meals = Array.isArray(CACHE.meals) ? CACHE.meals.filter(existing => String(existing.id || "") !== String(meal.id || "")) : [];
      CACHE.items = Array.isArray(CACHE.items) ? CACHE.items.filter(existing => String(existing.id || "") !== String(item?.id || "")) : [];
      CACHE.meals.unshift(meal);
      if (item) CACHE.items.unshift(item);
      CACHE.loaded = true;
      publishNutrition("optimistic");
    } catch (_) {}
  }
  function confirmNutritionRow(localRow, remoteMeal, remoteItem) {
    try {
      const store = nutritionStore();
      if (typeof store?.confirmLocalRow === "function") {
        store.confirmLocalRow(localRow, remoteMeal, remoteItem);
        publishNutrition("confirm");
        return;
      }
      const syncId = nutritionSyncId(localRow);
      const localMealId = String(localRow?.meal?.id || "");
      const localItemId = String(localRow?.item?.id || "");
      const meal = Object.assign({}, localRow?.meal || {}, remoteMeal || {}, {
        localOnly: false,
        offlinePending: false,
      });
      const item = remoteItem || localRow?.item ? Object.assign({}, localRow?.item || {}, remoteItem || {}, {
        meal_id: meal.id || remoteItem?.meal_id || localRow?.item?.meal_id,
        localOnly: false,
        offlinePending: false,
      }) : null;
      CACHE.meals = Array.isArray(CACHE.meals) ? CACHE.meals.filter(existing => {
        const id = String(existing?.id || "");
        const existingSync = String(existing?.sync_id || "");
        return id !== localMealId && id !== String(meal.id || "") && (!syncId || existingSync !== syncId);
      }) : [];
      CACHE.items = Array.isArray(CACHE.items) ? CACHE.items.filter(existing => {
        const id = String(existing?.id || "");
        const mealId = String(existing?.meal_id || "");
        return id !== localItemId && id !== String(item?.id || "") && mealId !== localMealId && mealId !== String(meal.id || "");
      }) : [];
      CACHE.meals.unshift(meal);
      if (item) CACHE.items.unshift(item);
      CACHE.loaded = true;
      publishNutrition("confirm");
    } catch (_) {}
  }
  function mergePendingNutritionRowsIntoCache() {
    loadLocalMeals().forEach(row => upsertOptimisticNutritionRow(row));
  }
  function saveLocalNutritionRowOnce(row) {
    if (!row) return;
    const repo = repository();
    if (typeof repo.saveLocalNutritionRowOnce === "function") {
      repo.saveLocalNutritionRowOnce({ storage: localStorage, key: localMealKey(), row });
      return;
    }
    const key = localNutritionRowKey(row, 0);
    const rows = loadLocalMeals().filter(existing => localNutritionRowKey(existing, 0) !== key);
    rows.unshift(row);
    saveLocalMeals(rows);
  }
  async function syncLocalNutritionRows(reason, options = {}) {
    const c = client();
    const userId = uid();
    if (!c || !userId || CACHE.syncingLocal) return 0;
    const rows = loadLocalMeals();
    if (!rows.length) return 0;
    const forceOnlineAttempt = options.forceOnline === true || reason === "manual";
    const offline = forceOnlineAttempt && navigator?.onLine !== false ? false : (typeof window.tbShouldUseOfflineMode === "function")
      ? await window.tbShouldUseOfflineMode(`nutrition:sync:${reason || "manual"}`)
      : ((typeof window.tbIsOfflineMode === "function" && window.tbIsOfflineMode()) || (navigator && navigator.onLine === false));
    if (offline) {
      CACHE.syncStatus = txt("Hors ligne, attente conservee.", "Offline, pending entries kept.");
      CACHE.syncPhase = "offline";
      return 0;
    }
    CACHE.syncingLocal = true;
    CACHE.syncPhase = "syncing";
    CACHE.syncStatus = txt("Synchronisation en cours...", "Syncing...");
    publishNutrition("sync-start");
    const remaining = [];
    let synced = 0;
    try {
      for (const row of rows) {
        try {
          const meal = row.meal || {};
          const syncId = nutritionSyncId(row);
          const mealDate = localDateISO(meal.meal_date) || selectedDateISO();
          const repo = repository();
          if (typeof repo.syncLocalRow === "function") {
            await repo.syncLocalRow({
              tables: { meals: table("nutrition_meals"), items: table("nutrition_meal_items") },
              row,
              userId,
              travelId: activeTravelId(),
              fallbackDate: mealDate,
            });
          } else {
            const mealNotes = notesWithNutritionSyncId(meal.notes, syncId);
            let mealId = "";
            let existingMealLabel = "";
            if (syncId) {
              const existingMeal = await c.from(table("nutrition_meals"))
                .select("id,label")
                .eq("user_id", userId)
                .eq("sync_id", syncId)
                .maybeSingle();
              if (existingMeal.error) throw existingMeal.error;
              mealId = existingMeal.data?.id || "";
              existingMealLabel = existingMeal.data?.label || "";
            }
            if (!mealId) {
              const insertedMeal = syncId
                ? await c.from(table("nutrition_meals")).upsert({
                  user_id: userId,
                  travel_id: meal.travel_id || activeTravelId(),
                  meal_date: mealDate,
                  meal_type: meal.meal_type || "meal",
                  label: meal.label || txt("Repas", "Meal"),
                  notes: mealNotes,
                  sync_id: syncId,
                  water_ml: n(meal.water_ml, 0),
                }, { onConflict: "user_id,sync_id" }).select("id").single()
                : await c.from(table("nutrition_meals")).insert({
                user_id: userId,
                travel_id: meal.travel_id || activeTravelId(),
                meal_date: mealDate,
                meal_type: meal.meal_type || "meal",
                label: meal.label || txt("Repas", "Meal"),
                notes: mealNotes,
                water_ml: n(meal.water_ml, 0),
              }).select("id").single();
              if (insertedMeal.error) throw insertedMeal.error;
              mealId = insertedMeal.data.id;
            }
            if (row.item) {
              const item = row.item;
              const itemLabel = item.label || meal.label || "Aliment";
              if (existingMealLabel && itemLabel && existingMealLabel !== itemLabel) {
                synced += 1;
                continue;
              }
              const existingItems = await c.from(table("nutrition_meal_items"))
                .select("id")
                .eq("user_id", userId)
                .eq("meal_id", mealId)
                .eq("label", itemLabel)
                .eq("grams", n(item.grams, 0))
                .eq("kcal", n(item.kcal, 0))
                .limit(1);
              if (existingItems.error) throw existingItems.error;
              if (!(existingItems.data || []).length) {
                const insertedItem = await c.from(table("nutrition_meal_items")).insert({
                  user_id: userId,
                  meal_id: mealId,
                  food_key: item.food_key || null,
                  label: itemLabel,
                  grams: n(item.grams, 0),
                  kcal: n(item.kcal, 0),
                  protein_g: n(item.protein_g, 0),
                  carbs_g: n(item.carbs_g, 0),
                  fat_g: n(item.fat_g, 0),
                  fiber_g: n(item.fiber_g, 0),
                });
                if (insertedItem.error && !isDuplicateNutritionError(insertedItem.error)) throw insertedItem.error;
              }
            }
          }
          synced += 1;
        } catch (e) {
          const msg = e?.message || String(e);
          remaining.push(Object.assign({}, row, {
            syncError: msg,
            syncAttempts: Math.max(0, n(row.syncAttempts, 0)) + 1,
            syncUpdatedAt: new Date().toISOString(),
          }));
          if (!isOfflineSkipError(e)) console.warn("[nutrition] local sync failed", msg);
        }
      }
      saveLocalMeals(remaining);
      CACHE.syncStatus = remaining.length
        ? txt(`${synced} synchronise(s), ${remaining.length} encore en attente.`, `${synced} synced, ${remaining.length} still pending.`)
        : (synced ? txt(`${synced} ajout(s) synchronise(s).`, `${synced} entry/entries synced.`) : "");
      CACHE.syncPhase = remaining.length ? "pending" : "done";
      if (!remaining.length) discardNutritionQueue();
      return synced;
    } finally {
      CACHE.syncingLocal = false;
    }
  }
  function loadFoodKeys(kind) {
    try {
      const rows = JSON.parse(localStorage.getItem(nutritionPrefsKey(kind)) || "[]");
      return Array.isArray(rows) ? rows.map(String).filter(Boolean) : [];
    } catch (_) {
      return [];
    }
  }
  function saveFoodKeys(kind, rows, limit) {
    const seen = new Set();
    const clean = [];
    (rows || []).forEach(key => {
      const v = String(key || "");
      if (!v || seen.has(v)) return;
      seen.add(v);
      clean.push(v);
    });
    try { localStorage.setItem(nutritionPrefsKey(kind), JSON.stringify(clean.slice(0, limit || 18))); } catch (_) {}
    return clean;
  }
  function toggleFoodFavorite(key) {
    const k = String(key || "");
    if (!k) return;
    const favs = loadFoodKeys("favorites");
    saveFoodKeys("favorites", favs.includes(k) ? favs.filter(row => row !== k) : [k].concat(favs), 30);
  }
  function rememberFoodRecent(key) {
    const k = String(key || "");
    if (!k || k === "water") return;
    saveFoodKeys("recent", [k].concat(loadFoodKeys("recent")), 18);
  }
  function foodByKey(key) {
    const k = String(key || "");
    return CACHE.foods.find(food => String(food.key) === k) || null;
  }
  function loadMealFavorites() {
    try {
      const rows = JSON.parse(localStorage.getItem(nutritionMealFavoritesKey()) || "[]");
      return Array.isArray(rows) ? rows.filter(row => row && Array.isArray(row.items) && row.items.length) : [];
    } catch (_) {
      return [];
    }
  }
  function saveMealFavorites(rows) {
    try { localStorage.setItem(nutritionMealFavoritesKey(), JSON.stringify((rows || []).slice(0, 12))); } catch (_) {}
  }
  function mealFavoriteLabel(type, items) {
    const names = (items || []).slice(0, 3).map(item => item.label || item.food_key).filter(Boolean).join(" + ");
    return `${mealTypeLabel(type)} · ${names || txt("repas", "meal")}`;
  }
  function saveFavoriteMealFromType(type) {
    const mealType = String(type || currentMealType());
    const { items } = selectedRows();
    const rows = items.filter(item => String(itemMeal(item)?.meal_type || "meal") === mealType && item.food_key);
    if (!rows.length) return;
    const favorite = {
      id: `meal_fav_${Date.now()}`,
      mealType,
      label: mealFavoriteLabel(mealType, rows),
      items: rows.map(item => ({
        foodKey: item.food_key,
        label: item.label,
        grams: n(item.grams, 0),
      })),
      createdAt: new Date().toISOString(),
    };
    const next = [favorite].concat(loadMealFavorites().filter(row => row.label !== favorite.label));
    saveMealFavorites(next);
  }
  function loadSleepRows() {
    const repo = repository();
    if (typeof repo.loadSleepRows === "function") return repo.loadSleepRows({ storage: localStorage, key: sleepKey() });
    try {
      const raw = JSON.parse(localStorage.getItem(sleepKey()) || "{}");
      return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    } catch (_) {
      return {};
    }
  }
  function saveSleepRows(rows) {
    const repo = repository();
    if (typeof repo.saveSleepRows === "function") return repo.saveSleepRows({ storage: localStorage, key: sleepKey(), rows });
    try { localStorage.setItem(sleepKey(), JSON.stringify(rows || {})); } catch (_) {}
    return false;
  }
  function mergeSleepRows(rows) {
    const repo = repository();
    if (typeof repo.mergeSleepRows === "function") return repo.mergeSleepRows({ storage: localStorage, key: sleepKey(), rows });
    const current = loadSleepRows();
    Object.entries(rows || {}).forEach(([day, row]) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(day || ""))) return;
      current[day] = { hours: n(row.hours, 0), quality: String(row.quality || "ok"), updatedAt: row.updatedAt || row.updated_at || new Date().toISOString() };
    });
    saveSleepRows(current);
    return current;
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
    if (tabs && !document.getElementById("tab-health")) {
      const tab = document.createElement("div");
      tab.id = "tab-health";
      tab.className = "tab";
      tab.textContent = txt("Sante", "Health");
      tab.onclick = () => openHealthView();
      const ref = document.getElementById("tab-nutrition") || document.getElementById("tab-work") || document.getElementById("tab-sport") || tabs.lastElementChild;
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
    if (!document.getElementById("view-health")) {
      const view = document.createElement("div");
      view.id = "view-health";
      view.className = "hidden";
      view.innerHTML = '<div id="health-root" class="card"></div>';
      const ref = document.getElementById("view-nutrition") || document.getElementById("view-work") || document.getElementById("view-sport") || wrap.lastElementChild;
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
      .tb-nutrition-chip-row { display:flex; flex-wrap:wrap; gap:6px; margin:8px 0 10px; }
      .tb-nutrition-food-chip { border:1px solid var(--border); border-radius:999px; background:rgba(255,255,255,.08); color:inherit; padding:7px 9px; font-weight:850; cursor:pointer; max-width:100%; }
      .tb-nutrition-food-chip strong { display:block; max-width:150px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .tb-nutrition-health-strip { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:8px; margin-bottom:10px; }
      .tb-nutrition-health-day { display:grid; grid-template-columns:46px 1fr; gap:9px; align-items:center; padding:9px; border:1px solid rgba(148,163,184,.22); border-radius:8px; background:rgba(255,255,255,.04); }
      .tb-nutrition-health-bars { display:grid; grid-template-columns:1.4fr 1fr 1fr; gap:5px; align-items:end; height:42px; }
      .tb-nutrition-health-bars span { display:block; border-radius:5px 5px 2px 2px; min-height:5px; }
      .tb-nutrition-goal-cockpit { border:1px solid rgba(34,197,94,.24); border-radius:14px; padding:12px; background:linear-gradient(135deg,rgba(34,197,94,.12),rgba(56,189,248,.08)),var(--panel2); margin-top:10px; display:grid; gap:10px; }
      .tb-nutrition-goal-kpis { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:8px; }
      .tb-nutrition-goal-kpis div { border:1px solid var(--border); border-radius:12px; background:rgba(255,255,255,.06); padding:9px; min-width:0; }
      .tb-nutrition-goal-kpis span { display:block; color:var(--muted); font-size:10px; text-transform:uppercase; font-weight:900; }
      .tb-nutrition-goal-kpis strong { display:block; margin-top:4px; font-size:18px; line-height:1.05; }
      .tb-nutrition-goal-kpis small { display:block; margin-top:4px; color:var(--muted); font-size:11px; font-weight:750; }
      .tb-health-hero { display:grid; grid-template-columns:minmax(220px,.72fr) minmax(280px,1.28fr); gap:14px; align-items:stretch; }
      .tb-health-ring { width:min(230px,72vw); aspect-ratio:1; border-radius:50%; display:grid; place-items:center; margin:auto; box-shadow:0 20px 54px rgba(15,23,42,.16); }
      .tb-health-ring-inner { width:68%; aspect-ratio:1; border-radius:50%; display:grid; place-items:center; text-align:center; border:1px solid var(--border); background:var(--panel2); }
      .tb-health-week { display:grid; grid-template-columns:repeat(8,minmax(0,1fr)); gap:8px; align-items:end; }
      .tb-health-bar { min-height:112px; border:1px solid var(--border); border-radius:10px; background:rgba(255,255,255,.04); display:flex; flex-direction:column; justify-content:flex-end; align-items:center; gap:5px; padding:7px 5px; cursor:pointer; }
      .tb-health-bar span { width:100%; border-radius:7px 7px 3px 3px; min-height:8px; }
      .tb-health-focus-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:10px; }
      .tb-health-focus-card { border:1px solid var(--border); border-radius:12px; padding:11px; background:rgba(255,255,255,.05); display:grid; gap:7px; }
      .tb-health-focus-card strong { font-size:15px; }
      .tb-health-pillars { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:8px; }
      .tb-health-pillar { border:1px solid rgba(148,163,184,.24); border-radius:12px; padding:10px; background:rgba(255,255,255,.04); display:grid; gap:7px; }
      .tb-health-pillar-track { height:8px; border-radius:999px; background:rgba(148,163,184,.18); overflow:hidden; border:1px solid rgba(148,163,184,.20); }
      .tb-health-pillar-track span { display:block; height:100%; border-radius:999px; }
      .tb-health-goal { border:1px solid rgba(56,189,248,.20); border-radius:14px; padding:14px; background:linear-gradient(135deg,rgba(37,99,235,.10),rgba(34,197,94,.08)),var(--panel2); margin-top:14px; }
      .tb-health-goal-grid { display:grid; grid-template-columns:1.2fr repeat(3,minmax(120px,.7fr)); gap:10px; align-items:end; margin-top:12px; }
      .tb-health-goal select { width:100%; border:1px solid var(--border); border-radius:12px; padding:9px 10px; background:var(--panel); color:var(--text); font-weight:850; }
      .tb-health-weekboard { border:1px solid rgba(139,92,246,.18); border-radius:14px; padding:14px; background:linear-gradient(180deg,rgba(139,92,246,.08),rgba(56,189,248,.05)),var(--panel2); margin-top:14px; }
      .tb-health-weekboard-kpis { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:8px; margin-bottom:10px; }
      .tb-health-weekboard-kpis div { border:1px solid var(--border); border-radius:12px; background:rgba(255,255,255,.06); padding:9px 10px; min-width:0; }
      .tb-health-weekboard-kpis span { display:block; color:var(--muted); font-size:10px; text-transform:uppercase; font-weight:900; }
      .tb-health-weekboard-kpis strong { display:block; margin-top:3px; font-size:15px; line-height:1.05; }
      .tb-health-weekboard-grid { display:grid; grid-template-columns:repeat(7,minmax(0,1fr)); gap:8px; align-items:stretch; }
      .tb-health-weekboard-day { min-height:154px; border:1px solid var(--border); border-radius:12px; background:rgba(255,255,255,.04); color:inherit; padding:9px 7px; display:grid; grid-template-rows:auto auto 1fr auto; gap:6px; text-align:left; cursor:pointer; min-width:0; }
      .tb-health-weekboard-day.active { border-color:var(--accent); box-shadow:0 10px 28px rgba(37,99,235,.10); }
      .tb-health-weekboard-day strong { font-size:12px; line-height:1.15; overflow:hidden; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; }
      .tb-health-weekboard-day small { font-size:10px; color:var(--muted); }
      .tb-health-weekboard-bars { display:grid; grid-template-columns:repeat(8,1fr); gap:3px; align-items:end; min-height:62px; }
      .tb-health-weekboard-bars i { display:block; min-height:6px; border-radius:7px 7px 3px 3px; }
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
        .tb-nutrition-health-strip { grid-template-columns:repeat(2,minmax(0,1fr)); }
        .tb-nutrition-goal-kpis { grid-template-columns:repeat(2,minmax(0,1fr)); }
        .tb-health-hero { grid-template-columns:1fr; }
        .tb-health-goal-grid { grid-template-columns:1fr 1fr; }
        .tb-health-week { grid-template-columns:repeat(4,minmax(0,1fr)); }
        .tb-health-weekboard-kpis { grid-template-columns:repeat(2,minmax(0,1fr)); }
        .tb-health-weekboard-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
        .tb-nutrition-shell .tb-sport-stats { grid-template-columns:repeat(2,minmax(0,1fr)); }
      }
      @media (max-width: 460px) {
        .tb-nutrition-top,
        .tb-nutrition-macro-grid,
        .tb-nutrition-catalog-grid,
        .tb-nutrition-shell .tb-sport-stats { grid-template-columns:1fr; }
        .tb-nutrition-week-grid button { padding:6px 3px !important; font-size:10px !important; }
        .tb-nutrition-goal-kpis { grid-template-columns:1fr; }
        .tb-health-week { grid-template-columns:repeat(2,minmax(0,1fr)); }
        .tb-health-goal-grid { grid-template-columns:1fr; }
        .tb-health-weekboard-kpis { grid-template-columns:1fr; }
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
  function openHealthView() {
    if (typeof window.showView === "function") {
      window.showView("health");
      return;
    }
    try { if (typeof activeView !== "undefined") activeView = "health"; } catch (_) {}
    try { window.activeView = "health"; } catch (_) {}
    try { if (typeof window.setActiveTab === "function") window.setActiveTab("health"); } catch (_) {}
    try {
      document.getElementById("tab-health")?.classList.add("active");
      document.getElementById("view-health")?.classList.remove("hidden");
    } catch (_) {}
    renderHealth("tab-fallback");
  }
  function publishNutrition(reason) {
    if (!window.state) window.state = {};
    const store = nutritionStore();
    if (store?.replace) store.replace({ sleep: loadSleepRows() });
    const snapshot = typeof store?.appSnapshot === "function" ? store.appSnapshot() : {
      nutritionMeals: CACHE.meals.slice(),
      nutritionMealItems: CACHE.items.slice(),
      nutritionFoods: CACHE.foods.slice(),
      nutritionSleep: loadSleepRows(),
    };
    Object.assign(window.state, snapshot);
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
    try { nutritionStore()?.hydrateFoods?.(CACHE.foods); } catch (_) {}
    const c = client();
    try {
      if (c) {
        try {
          const foods = await c.from(table("nutrition_foods"))
            .select("key,name,brand,serving_grams,kcal_per_100g,protein_per_100g,carbs_per_100g,fat_per_100g,fiber_per_100g,water_ml_per_100g,tags")
            .eq("is_active", true)
            .order("name", { ascending: true })
            .limit(900);
          if (foods.error) throw foods.error;
          const normalizedFoods = (foods.data || []).map(normalizeFood).filter(Boolean);
          if (normalizedFoods.length) {
            CACHE.foods = normalizedFoods;
            try { nutritionStore()?.hydrateFoods?.(normalizedFoods); } catch (_) {}
            saveCachedFoods(normalizedFoods);
          }
        } catch (e) {
          CACHE.error = e?.message || String(e);
          console.warn("[nutrition] food library fallback", CACHE.error);
        }
      }
      if (c && uid()) {
        await syncLocalNutritionRows("load");
        try {
          const sleepSince = offsetDateISO(selectedDateISO(), -21);
          const sleep = await c.from(table("nutrition_sleep"))
            .select("sleep_date,hours,quality,updated_at")
            .eq("user_id", uid())
            .gte("sleep_date", sleepSince)
            .order("sleep_date", { ascending: false });
          if (!sleep.error) {
            const remoteSleep = {};
            (sleep.data || []).forEach(row => {
              const sleepDay = localDateISO(row.sleep_date);
              if (sleepDay) remoteSleep[sleepDay] = { hours: n(row.hours, 0), quality: String(row.quality || "ok"), updatedAt: row.updated_at || "" };
            });
            mergeSleepRows(remoteSleep);
            try { nutritionStore()?.replace?.({ sleep: loadSleepRows() }); } catch (_) {}
          }
        } catch (e) {
          console.warn("[nutrition] sleep fallback", e?.message || e);
        }
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
          try { nutritionStore()?.hydrateRemote?.({ meals: CACHE.meals, items: CACHE.items, sleep: loadSleepRows() }); } catch (_) {}
        } catch (e) {
          CACHE.error = CACHE.error || e?.message || String(e);
          const local = loadLocalMeals();
          if (typeof nutritionStore()?.hydrateLocal === "function") nutritionStore().hydrateLocal(local);
          else {
            CACHE.meals = local.map(row => row.meal).filter(Boolean);
            CACHE.items = local.map(row => row.item).filter(Boolean);
          }
          console.warn("[nutrition] meals fallback", e?.message || e);
        }
      } else {
        const local = loadLocalMeals();
        if (typeof nutritionStore()?.hydrateLocal === "function") nutritionStore().hydrateLocal(local);
        else {
          CACHE.meals = local.map(row => row.meal).filter(Boolean);
          CACHE.items = local.map(row => row.item).filter(Boolean);
        }
      }
      CACHE.loaded = true;
      changed = true;
    } catch (e) {
      CACHE.error = e?.message || String(e);
      CACHE.loaded = true;
      if (!CACHE.meals.length) {
        const local = loadLocalMeals();
        if (typeof nutritionStore()?.hydrateLocal === "function") nutritionStore().hydrateLocal(local);
        else {
          CACHE.meals = local.map(row => row.meal).filter(Boolean);
          CACHE.items = local.map(row => row.item).filter(Boolean);
        }
      }
      console.warn("[nutrition] load failed", CACHE.error);
      changed = true;
    } finally {
      CACHE.loading = false;
      mergePendingNutritionRowsIntoCache();
      publishNutrition("load");
    }
    return changed;
  }
  function selectedRows() {
    const day = selectedDateISO();
    const store = nutritionStore();
    if (typeof store?.selectedRows === "function") return store.selectedRows(day, localDateISO);
    const meals = CACHE.meals.filter(row => localDateISO(row.meal_date) === day);
    const mealIds = new Set(meals.map(row => String(row.id || "")));
    const items = CACHE.items.filter(row => row && mealIds.has(String(row.meal_id || "")));
    return { meals, items };
  }
  function dailySummaries() {
    if (rules().buildDailyNutritionSummaries) {
      return rules().buildDailyNutritionSummaries({
        meals: CACHE.meals,
        items: CACHE.items,
        foods: CACHE.foods,
        toDay: localDateISO,
      });
    }
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
      if (!byDay.has(day)) byDay.set(day, { day, meals: [], waterMl: 0, kcal: 0, protein: 0, carbs: 0, fat: 0, alcoholDrinks: 0, alcoholGrams: 0, alcoholEntries: [], types: {} });
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
      const alcohol = alcoholSummaryForItems([item]);
      if (alcohol.standardDrinks > 0) {
        row.alcoholDrinks += alcohol.standardDrinks;
        row.alcoholGrams += alcohol.gramsAlcohol;
        row.alcoholEntries.push(...alcohol.entries);
        typeRow.alcoholDrinks = n(typeRow.alcoholDrinks, 0) + alcohol.standardDrinks;
      }
    });
    return Array.from(byDay.values()).map(row => ({
      ...row,
      typeRows: typeOrder.map(type => row.types[type]).filter(Boolean),
    })).sort((a, b) => String(b.day).localeCompare(String(a.day))).slice(0, 21);
  }
  function sportKcalForDay(day) {
    const targetDay = String(day || selectedDateISO()).slice(0, 10);
    return (window.state?.sportSessions || []).filter(s => localDateISO(s.started_at || s.startedAt) === targetDay)
      .reduce((sum, s) => sum + n(s.estimated_kcal || s.estimatedKcal, 0), 0);
  }
  function todaySportKcal() { return sportKcalForDay(selectedDateISO()); }
  function workKcalForDay(day) {
    const targetDay = String(day || selectedDateISO()).slice(0, 10);
    return (window.state?.workDays || []).filter(w => localDateISO(w.work_date || w.workDate) === targetDay)
      .reduce((sum, w) => sum + n(w.estimated_kcal || w.estimatedKcal, 0), 0);
  }
  function todayWorkKcal() { return workKcalForDay(selectedDateISO()); }
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
    const favs = loadFoodKeys("favorites");
    const recent = loadFoodKeys("recent");
    const rank = food => {
      const key = String(food?.key || "");
      const favIdx = favs.indexOf(key);
      const recentIdx = recent.indexOf(key);
      if (favIdx >= 0) return favIdx;
      if (recentIdx >= 0) return 100 + recentIdx;
      return 1000;
    };
    const rows = CACHE.foods
      .filter(food => !q || String(food.name || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(q))
      .slice()
      .sort((a, b) => rank(a) - rank(b) || String(a.name || "").localeCompare(String(b.name || ""), "fr", { sensitivity: "base" }))
      .slice(0, 80);
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
    if (typeof view().progressPercent === "function") return view().progressPercent(current, target);
    const t = Math.max(1, n(target, 0));
    return Math.max(0, Math.min(160, (n(current, 0) / t) * 100));
  }
  function progressBar(label, current, target, unit) {
    if (typeof view().renderProgressBar === "function") return view().renderProgressBar({ label, current, target, unit, esc });
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
  function mealMomentTargets(needsKcal, typeTotals, day) {
    if (rules().mealMomentTargets) {
      const today = todayISO();
      const targetType = String(day || today) === today ? currentMealType() : "dinner";
      return rules().mealMomentTargets({ needsKcal, typeTotals, currentType: targetType });
    }
    const rows = [
      { type: "breakfast", pct: 0.22, minPct: 0.14, maxPct: 0.30, color: "#38bdf8" },
      { type: "morning_snack", pct: 0.08, minPct: 0.04, maxPct: 0.14, color: "#a78bfa" },
      { type: "lunch", pct: 0.35, minPct: 0.24, maxPct: 0.44, color: "#22c55e" },
      { type: "afternoon_snack", pct: 0.10, minPct: 0.05, maxPct: 0.16, color: "#f59e0b" },
      { type: "dinner", pct: 0.25, minPct: 0.16, maxPct: 0.34, color: "#fb7185" },
    ];
    const totalNeed = Math.max(0, n(needsKcal, 0));
    const baseRows = rows.map(row => {
      const baseKcal = Math.round(totalNeed * row.pct);
      return { ...row, baseKcal, kcal: baseKcal };
    });
    const today = todayISO();
    const targetType = String(day || today) === today ? currentMealType() : "dinner";
    const currentIndex = Math.max(0, baseRows.findIndex(row => row.type === targetType));
    const passedRows = baseRows.slice(0, currentIndex);
    const futureRows = baseRows.slice(currentIndex);
    const passedBase = passedRows.reduce((sum, row) => sum + n(row.baseKcal, 0), 0);
    const passedConsumed = passedRows.reduce((sum, row) => sum + n(typeTotals?.[row.type]?.kcal, 0), 0);
    const adjustment = passedBase - passedConsumed;
    const futureBase = futureRows.reduce((sum, row) => sum + n(row.baseKcal, 0), 0);
    if (!futureBase || Math.abs(adjustment) < 40) return baseRows;
    return baseRows.map((row, idx) => {
      if (idx < currentIndex) return row;
      const share = n(row.baseKcal, 0) / futureBase;
      const adapted = n(row.baseKcal, 0) + adjustment * share;
      const min = totalNeed * n(row.minPct, row.pct * 0.65);
      const max = totalNeed * n(row.maxPct, row.pct * 1.35);
      return { ...row, kcal: Math.round(Math.max(min, Math.min(max, adapted))), adjustedKcal: Math.round(adapted) };
    });
  }
  function mealTargetNote(target) {
    if (typeof view().mealTargetNote === "function") return view().mealTargetNote(target, { t: txt });
    const delta = Math.round(n(target?.kcal, 0) - n(target?.baseKcal, target?.kcal));
    if (Math.abs(delta) < 40) return txt("Objectif standard.", "Standard target.");
    return delta > 0
      ? txt(`Ajuste +${delta} kcal car les repas precedents etaient plus legers.`, `Adjusted +${delta} kcal because previous meals were lighter.`)
      : txt(`Ajuste ${delta} kcal car les repas precedents etaient plus hauts.`, `Adjusted ${delta} kcal because previous meals were higher.`);
  }
  function typeTotalsForDay(meals, items) {
    if (rules().buildTypeTotalsForDay) return rules().buildTypeTotalsForDay(meals, items);
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
    if (rules().normalizeNutritionText) return rules().normalizeNutritionText(value);
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  }
  function foodCategory(food) {
    if (rules().foodCategory) return rules().foodCategory(food);
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
    if (rules().filterCatalogFoods) return rules().filterCatalogFoods({
      foods: CACHE.foods,
      query: CACHE.foodQuery,
      category: CACHE.foodCategory,
      limit: 18,
    });
    const q = normalizeText(CACHE.foodQuery);
    const cat = String(CACHE.foodCategory || "all");
    return CACHE.foods.filter(food => {
      const matchesText = !q || normalizeText(food.name).includes(q) || normalizeText(food.key).includes(q);
      const matchesCat = cat === "all" || foodCategory(food) === cat;
      return matchesText && matchesCat;
    }).slice(0, 18);
  }
  function mealMomentSuggestion(type, consumed, targetKcal, total, macroTargets) {
    if (typeof view().mealMomentSuggestion === "function") return view().mealMomentSuggestion(type, consumed, targetKcal, total, macroTargets, { t: txt });
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
    if (typeof view().buildWeekRows === "function") return view().buildWeekRows(history, selectedDay, { offsetDateISO });
    const byDay = new Map(history.map(row => [row.day, row]));
    const rows = [];
    for (let i = 6; i >= 0; i -= 1) {
      const day = offsetDateISO(selectedDay, -i);
      rows.push(byDay.get(day) || { day, kcal: 0, protein: 0, carbs: 0, fat: 0, waterMl: 0, alcoholDrinks: 0, alcoholGrams: 0, alcoholEntries: [], typeRows: [] });
    }
    return rows;
  }
  function quickFoodRows() {
    const favs = loadFoodKeys("favorites").map(foodByKey).filter(Boolean);
    const recent = loadFoodKeys("recent").map(foodByKey).filter(Boolean).filter(food => !favs.some(row => row.key === food.key));
    return { favs: favs.slice(0, 8), recent: recent.slice(0, 8) };
  }
  function mealFavoriteChipHTML(fav, index) {
    if (typeof view().renderMealFavoriteChip === "function") return view().renderMealFavoriteChip(fav, index, { foodByKey, nutritionForGrams, t: txt, esc });
    const kcal = (fav.items || []).reduce((sum, item) => {
      const food = foodByKey(item.foodKey);
      return sum + n(nutritionForGrams(food || {}, n(item.grams, 0)).kcal, 0);
    }, 0);
    return `<button class="tb-nutrition-food-chip" type="button" data-nutrition-apply-meal-fav="${index}" title="${esc((fav.items || []).map(item => `${item.label || item.foodKey} ${Math.round(n(item.grams, 0))}g`).join(" · "))}"><span>☆</span> ${esc(fav.label || txt("Repas favori", "Favorite meal"))}<br><small>${Math.round(kcal)} kcal</small></button>`;
  }
  function foodChipHTML(food, kind) {
    if (typeof view().renderFoodChip === "function") return view().renderFoodChip(food, kind, { esc });
    const label = kind === "favorite" ? "★" : "↺";
    return `<button class="tb-nutrition-food-chip" type="button" data-nutrition-pick-food="${esc(food.key)}" title="${esc(food.name)} · ${Math.round(n(food.servingGrams, 100))}g"><span>${label}</span> ${esc(food.name)}</button>`;
  }
  function currentMealType() {
    if (rules().mealTypeFromHour) return rules().mealTypeFromHour(new Date().getHours());
    const h = new Date().getHours();
    if (h < 10) return "breakfast";
    if (h < 12) return "morning_snack";
    if (h < 15) return "lunch";
    if (h < 18) return "afternoon_snack";
    return "dinner";
  }
  function selectedMealType(root) {
    const value = String(root?.querySelector("#nutrition-type")?.value || CACHE.selectedMealType || currentMealType() || "meal");
    CACHE.selectedMealType = value;
    return value;
  }
  function healthWeekInsight(rows) {
    const avg = rows.length ? rows.reduce((sum, row) => sum + n(row.score, 0), 0) / rows.length : 0;
    const waterDays = rows.filter(row => n(row.health?.drinkWaterMl ?? row.waterMl, 0) >= 2000).length;
    const sleepAvg = rows.length ? rows.reduce((sum, row) => sum + n(row.health?.sleepHours, sleepForDay(row.day).hours), 0) / rows.length : 0;
    const alcoholWeekDrinks = rows.reduce((sum, row) => sum + n(row.health?.alcoholDrinks, row.alcoholDrinks), 0);
    const alcoholDays = rows.filter(row => n(row.health?.alcoholDrinks, row.alcoholDrinks) > 0.05).length;
    const kcalDays = rows.filter(row => {
      const kcal = n(row.health?.kcal, row.kcal);
      const need = Math.max(1, n(row.needsKcal, 0));
      return kcal >= need * 0.85 && kcal <= need * 1.12;
    }).length;
    const trend = rows.length > 3 ? n(rows[rows.length - 1]?.score, 0) - n(rows[0]?.score, 0) : 0;
    let advice = txt("Semaine stable : continue a garder eau, sommeil et proteines lisibles.", "Stable week: keep water, sleep and protein readable.");
    if (alcoholWeekDrinks > 10.01) advice = txt("Priorite semaine : redescendre sous 10 verres standard et ajouter des jours sans alcool.", "Weekly priority: get below 10 standard drinks and add alcohol-free days.");
    else if (alcoholDays >= 6 && alcoholWeekDrinks > 0.1) advice = txt("Priorite semaine : garder des jours sans alcool.", "Weekly priority: keep alcohol-free days.");
    else if (waterDays < Math.ceil(rows.length * 0.55)) advice = txt("Priorite semaine : remonter l'eau bue, l'objectif reste 2 L hors eau des aliments.", "Weekly priority: bring drunk water back up, target remains 2 L excluding food water.");
    else if (sleepAvg && sleepAvg < 7) advice = txt("Priorite semaine : sommeil. Vise une routine plus reguliere avant d'optimiser les kcal.", "Weekly priority: sleep. Aim for a steadier routine before optimizing kcal.");
    else if (kcalDays < Math.ceil(rows.length * 0.45)) advice = txt("Priorite semaine : rapprocher l'energie consommee du besoin reel, sans chercher le parfait.", "Weekly priority: bring consumed energy closer to real need, without chasing perfect.");
    return { avg, waterDays, sleepAvg, kcalDays, alcoholWeekDrinks, alcoholDays, trend, advice };
  }
  function healthHistoryRows(history, selectedDay) {
    const byDay = new Map(history.map(row => [row.day, row]));
    const rows = [];
    for (let i = 7; i >= 0; i -= 1) {
      const rowDay = offsetDateISO(selectedDay, -i);
      const nutrition = byDay.get(rowDay) || { day: rowDay, kcal: 0, protein: 0, carbs: 0, fat: 0, waterMl: 0, typeRows: [] };
      const activity = { sportKcal: sportKcalForDay(rowDay), workKcal: workKcalForDay(rowDay) };
      const health = typeof window.tbComputeHealthSummaryForDate === "function" ? window.tbComputeHealthSummaryForDate(rowDay, activity) : null;
      const fallbackSpent = baseline().bmr + activity.sportKcal + activity.workKcal;
      const fallbackTargets = nutritionGoalTargets(fallbackSpent, bodyWeight());
      const needsKcal = health?.needsKcal || Math.max(1200, fallbackTargets.targetKcal);
      const kcalScore = Math.min(42, (n(nutrition.kcal, 0) / Math.max(1, needsKcal)) * 42);
      const waterScore = Math.min(24, (n(health?.drinkWaterMl ?? nutrition.waterMl, 0) / 2000) * 24);
      const proteinScore = Math.min(18, (n(nutrition.protein, 0) / Math.max(70, bodyWeight() * 1.35)) * 18);
      const score = health?.score ?? Math.round(Math.max(0, Math.min(100, kcalScore + waterScore + proteinScore + 16)));
      const level = health?.level || (score >= 78 ? "good" : score >= 58 ? "warn" : "bad");
      rows.push({ ...nutrition, ...activity, health, needsKcal, score, level, alcoholDrinks: n(health?.alcoholDrinks, nutrition.alcoholDrinks), alcoholGrams: n(health?.alcoholGrams, nutrition.alcoholGrams), alcoholEntries: health?.alcoholEntries || nutrition.alcoholEntries || [], color: health?.color || (level === "good" ? "#22c55e" : level === "warn" ? "#f59e0b" : "#ef4444") });
    }
    return rows;
  }
  function healthPillarRows(row, h, proteinTarget) {
    const kcal = n(h?.kcal, row?.kcal);
    const need = Math.max(1, n(row?.needsKcal, h?.needsKcal));
    const water = n(h?.drinkWaterMl, row?.waterMl);
    const protein = n(h?.protein, row?.protein);
    const sleepHours = n(h?.sleepHours, sleepForDay(row?.day).hours);
    const load = n(row?.sportKcal, 0) + n(row?.workKcal, 0);
    const alcohol = n(h?.alcoholDrinks, row?.alcoholDrinks);
    const alcoholWeek = n(h?.alcoholWeeklyDrinks, 0);
    const alcoholNote = alcohol > 2.01 ? txt("jour haut", "high day") : alcoholWeek > 10.01 ? txt("semaine haute", "high week") : alcohol > 0.05 ? txt("modere", "moderate") : txt("zero", "zero");
    return [
      { key: "energy", label: txt("Energie", "Energy"), value: `${Math.round(kcal)} / ${Math.round(need)} kcal`, pct: Math.min(100, Math.abs(kcal / need) * 100), color: "#22c55e", note: kcal > need * 1.12 ? txt("au-dessus", "above") : kcal < need * 0.85 ? txt("a completer", "to complete") : txt("cale", "on track") },
      { key: "water", label: txt("Eau bue", "Drunk water"), value: `${Math.round(water)} / 2000 ml`, pct: Math.min(100, (water / 2000) * 100), color: "#38bdf8", note: water >= 2000 ? txt("OK", "OK") : txt("a boire", "to drink") },
      { key: "protein", label: txt("Proteines", "Protein"), value: `${Math.round(protein)} / ${Math.round(proteinTarget)} g`, pct: Math.min(100, (protein / Math.max(1, proteinTarget)) * 100), color: "#a78bfa", note: protein >= proteinTarget * 0.9 ? txt("OK", "OK") : txt("a renforcer", "to improve") },
      { key: "sleep", label: txt("Sommeil", "Sleep"), value: sleepHours ? `${Math.round(sleepHours * 10) / 10}h / 7.5h` : txt("non saisi", "not set"), pct: Math.min(100, (sleepHours / 7.5) * 100), color: "#8b5cf6", note: sleepHours >= 7 ? txt("recup OK", "recovery OK") : txt("recup basse", "low recovery") },
      { key: "alcohol", label: txt("Alcool", "Alcohol"), value: `${Math.round(alcohol * 10) / 10} / 2 ${txt("verres", "drinks")}`, pct: Math.min(100, (alcohol / 2) * 100), color: alcohol > 2.01 || alcoholWeek > 10.01 ? "#ef4444" : (alcohol > 0.05 ? "#f59e0b" : "#22c55e"), note: alcoholNote },
      { key: "load", label: txt("Charge", "Load"), value: `${Math.round(load)} kcal`, pct: Math.min(100, (load / 700) * 100), color: "#f59e0b", note: load > 500 ? txt("jour actif", "active day") : txt("charge calme", "quiet load") },
    ];
  }
  function healthFocusCards(row, h, proteinTarget) {
    const cards = [];
    const kcal = n(h?.kcal, row?.kcal);
    const need = Math.max(1, n(row?.needsKcal, h?.needsKcal));
    const water = n(h?.drinkWaterMl, row?.waterMl);
    const protein = n(h?.protein, row?.protein);
    const sleepHours = n(h?.sleepHours, sleepForDay(row?.day).hours);
    const alcohol = n(h?.alcoholDrinks, row?.alcoholDrinks);
    const alcoholWeek = n(h?.alcoholWeeklyDrinks, 0);
    if (water < 2000) cards.push({ title: txt("Hydratation", "Hydration"), body: txt(`Encore ${Math.round(2000 - water)} ml d'eau bue a viser.`, `Aim for ${Math.round(2000 - water)} ml more drunk water.`), color: "#38bdf8" });
    if (protein < proteinTarget * 0.9) cards.push({ title: txt("Proteines", "Protein"), body: txt(`Il manque environ ${Math.round(proteinTarget - protein)} g : skyr, fromage blanc, poulet, oeufs ou thon.`, `About ${Math.round(proteinTarget - protein)} g missing: skyr, fromage blanc, chicken, eggs or tuna.`), color: "#a78bfa" });
    if (kcal < need * 0.85) cards.push({ title: txt("Energie", "Energy"), body: txt("Journee basse : complete avec un repas simple, pas seulement du snack.", "Low day: complete with a simple meal, not only snacks."), color: "#22c55e" });
    if (kcal > need * 1.12) cards.push({ title: txt("Energie", "Energy"), body: txt("Journee haute : garde le prochain repas leger, hydratation et legumes.", "High day: keep the next meal light, hydration and vegetables."), color: "#f59e0b" });
    if (sleepHours && sleepHours < 7) cards.push({ title: txt("Recuperation", "Recovery"), body: txt("Sommeil court : evite de sur-optimiser les kcal, priorite routine ce soir.", "Short sleep: avoid over-optimizing kcal, prioritize routine tonight."), color: "#8b5cf6" });
    if (alcohol > 2.01) cards.push({ title: txt("Alcool", "Alcohol"), body: txt("Au-dessus du repere jour : vise eau, repas simple et un jour sans alcool.", "Above daily guide: aim for water, simple meals and an alcohol-free day."), color: "#ef4444" });
    else if (alcoholWeek > 10.01) cards.push({ title: txt("Alcool semaine", "Weekly alcohol"), body: txt("Semaine au-dessus du repere : planifie plusieurs jours sans alcool.", "Week above guide: plan several alcohol-free days."), color: "#ef4444" });
    if (!cards.length) cards.push({ title: txt("Journee lisible", "Readable day"), body: txt("Les grands axes sont bien alignes. Continue simple : eau, proteines, sommeil.", "The main axes are aligned. Keep it simple: water, protein, sleep."), color: "#22c55e" });
    return cards.slice(0, 3);
  }
  function macroSummaryText(targets) {
    return `${Math.round(n(targets.protein, 0))}g P · ${Math.round(n(targets.carbs, 0))}g G · ${Math.round(n(targets.fat, 0))}g L`;
  }
  function goalSevenDayInsight(goal, targets, week) {
    const rows = (week || []).filter(row => n(row.kcal, 0) > 0);
    if (!rows.length) return txt("Alerte 7 jours disponible des que plusieurs journees sont saisies.", "7-day alert appears once several days are logged.");
    const avg = rows.reduce((sum, row) => sum + n(row.kcal, 0), 0) / rows.length;
    const delta = Math.round(avg - n(targets.targetKcal, 0));
    if (goal.mode === "bulk") {
      if (delta < -180) return txt(`Trop bas sur 7 jours : moyenne ${Math.round(avg)} kcal, ajoute une collation simple.`, `Too low over 7 days: ${Math.round(avg)} kcal average, add a simple snack.`);
      if (delta > 250) return txt(`Surplus fort : moyenne ${Math.round(avg)} kcal, reduis un peu les extras.`, `Strong surplus: ${Math.round(avg)} kcal average, trim extras a bit.`);
      return txt(`Rythme propre : moyenne ${Math.round(avg)} kcal, objectif prise de masse sous controle.`, `Clean pace: ${Math.round(avg)} kcal average, lean bulk on track.`);
    }
    if (goal.mode === "cut" && delta > 180) return txt(`Trop haut sur 7 jours : moyenne ${Math.round(avg)} kcal, reajuste les prochains repas.`, `Too high over 7 days: ${Math.round(avg)} kcal average, adjust upcoming meals.`);
    return txt(`Moyenne 7 jours : ${Math.round(avg)} kcal, ecart ${delta > 0 ? "+" : ""}${delta} kcal.`, `7-day average: ${Math.round(avg)} kcal, gap ${delta > 0 ? "+" : ""}${delta} kcal.`);
  }
  function goalCockpitHTML(goal, targets, week, total, sportKcal, workKcal) {
    const currentWeight = bodyWeight();
    const targetWeight = n(goal.targetWeightKg, currentWeight);
    const remainingKg = Math.round((targetWeight - currentWeight) * 10) / 10;
    const weeklyRate = n(goal.weeklyRateKg, 0.25);
    const weeks = weeklyRate > 0 ? Math.max(0, Math.ceil(Math.abs(remainingKg) / weeklyRate)) : 0;
    const kcalLeft = Math.round(n(targets.targetKcal, 0) - n(total.kcal, 0));
    const insight = goalSevenDayInsight(goal, targets, week);
    return `<div class="tb-nutrition-goal-cockpit">
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap;">
        <div><strong>${esc(txt("Cockpit objectif", "Goal cockpit"))}</strong><div class="muted" style="font-size:12px;">${esc(insight)}</div></div>
        <span class="pill">${esc(nutritionGoalLabel(goal))}</span>
      </div>
      <div class="tb-nutrition-goal-kpis">
        <div><span>${esc(txt("Poids cible", "Target weight"))}</span><strong>${Math.round(targetWeight * 10) / 10} kg</strong><small>${remainingKg >= 0 ? "+" : ""}${remainingKg} kg · ~${weeks} sem.</small></div>
        <div><span>${esc(txt("Rythme", "Pace"))}</span><strong>${weeklyRate} kg/sem.</strong><small>${esc(txt("simple et controlable", "simple and controllable"))}</small></div>
        <div><span>${esc(txt("Reste jour", "Left today"))}</span><strong>${kcalLeft >= 0 ? "+" : ""}${kcalLeft}</strong><small>kcal</small></div>
        <div><span>${esc(txt("Charge", "Load"))}</span><strong>${Math.round(n(sportKcal, 0) + n(workKcal, 0))}</strong><small>sport + ${esc(txt("travail", "work"))}</small></div>
      </div>
      <div class="tb-nutrition-goal-kpis">
        <div><span>${esc(txt("Proteines", "Protein"))}</span><strong>${Math.round(targets.protein)}g</strong><small>${Math.round(n(targets.proteinPerKg, 0) * 10) / 10} g/kg</small></div>
        <div><span>${esc(txt("Glucides", "Carbs"))}</span><strong>${Math.round(targets.carbs)}g</strong><small>${esc(txt("ajustes par les kcal", "adjusted by kcal"))}</small></div>
        <div><span>${esc(txt("Lipides", "Fat"))}</span><strong>${Math.round(targets.fat)}g</strong><small>${Math.round(n(targets.fatPerKg, 0) * 10) / 10} g/kg</small></div>
        <div><span>${esc(txt("Objectif", "Target"))}</span><strong>${Math.round(targets.targetKcal)}</strong><small>kcal</small></div>
      </div>
    </div>`;
  }
  function nextMealTarget(day, targets, total) {
    const type = currentMealType();
    const weights = { breakfast: 0.22, morning_snack: 0.10, lunch: 0.30, afternoon_snack: 0.12, dinner: 0.26 };
    const order = ["breakfast", "morning_snack", "lunch", "afternoon_snack", "dinner"];
    const consumed = n(total?.kcal, 0);
    const target = n(targets?.targetKcal, 0);
    const currentIndex = Math.max(0, order.indexOf(type));
    const plannedBefore = order.slice(0, currentIndex).reduce((sum, key) => sum + target * n(weights[key], 0), 0);
    const base = target * n(weights[type], 0.18);
    const adjustment = Math.max(-220, Math.min(260, plannedBefore - consumed));
    return { type, label: mealTypeLabel(type), kcal: Math.max(120, Math.round(base + adjustment)) };
  }
  function healthGoalAdvice(goal, targets, total, activityKcal, sleepHours) {
    const proteinGap = Math.round(n(targets.protein, 0) - n(total.protein, 0));
    const kcalGap = Math.round(n(targets.targetKcal, 0) - n(total.kcal, 0));
    if (goal.mode === "bulk" && kcalGap > 500) return txt("Objectif prise de masse : complete sans forcer avec glucides utiles + proteines, surtout autour des seances.", "Lean bulk: complete gently with useful carbs + protein, especially around workouts.");
    if (goal.mode === "cut" && kcalGap < 150) return txt("Objectif perte douce : garde le prochain repas dense en proteines, legumes et hydratation.", "Gentle cut: keep the next meal protein-dense, vegetables and hydration.");
    if (proteinGap > 25) return txt("Priorite proteines : fromage blanc/skyr, oeufs, poulet, thon ou tofu.", "Protein priority: fromage blanc/skyr, eggs, chicken, tuna or tofu.");
    if (activityKcal > 550 && goal.mode !== "cut") return txt("Jour charge : prevois recuperation, glucides simples a digerer et sommeil.", "High-load day: plan recovery, easy carbs and sleep.");
    if (sleepHours && sleepHours < 7) return txt("Sommeil bas : garde l'objectif simple aujourd'hui, regularite avant optimisation.", "Low sleep: keep today simple, consistency before optimization.");
    return txt("Objectif bien cale : suis le prochain repas cible et garde eau/proteines visibles.", "Goal on track: follow the next meal target and keep water/protein visible.");
  }
  function healthWeekDashboardRows(healthWeek) {
    let planned = [];
    try { if (typeof window.tbSportPlannedWeekRows === "function") planned = window.tbSportPlannedWeekRows(selectedDateISO()) || []; } catch (_) {}
    const plannedByDay = new Map((planned || []).map(row => [row.day, row]));
    return (healthWeek || []).slice(-7).map(row => {
      const plan = plannedByDay.get(row.day) || {};
      const kcal = n(row.health?.kcal, row.kcal);
      const need = Math.max(1, n(row.needsKcal, 0));
      const water = n(row.health?.drinkWaterMl, row.waterMl);
      const sleep = n(row.health?.sleepHours, sleepForDay(row.day).hours);
      const protein = n(row.health?.protein, row.protein);
      const sport = n(row.sportKcal, 0);
      const work = n(row.workKcal, 0);
      const alcohol = n(row.health?.alcoholDrinks, row.alcoholDrinks);
      const score = n(row.score, row.health?.score);
      const load = sport + work;
      return { row, plan, kcal, need, water, sleep, protein, sport, work, alcohol, score, load };
    });
  }
  function renderHealthWeekDashboard(healthWeek, selectedDay) {
    const rows = healthWeekDashboardRows(healthWeek);
    const count = Math.max(1, rows.length);
    const avgScore = rows.reduce((sum, r) => sum + n(r.score, 0), 0) / count;
    const avgKcal = rows.reduce((sum, r) => sum + n(r.kcal, 0), 0) / count;
    const avgNeed = rows.reduce((sum, r) => sum + n(r.need, 0), 0) / count;
    const avgProtein = rows.reduce((sum, r) => sum + n(r.protein, 0), 0) / count;
    const avgWater = rows.reduce((sum, r) => sum + n(r.water, 0), 0) / count;
    const avgSleep = rows.reduce((sum, r) => sum + n(r.sleep, 0), 0) / count;
    const sportTotal = rows.reduce((sum, r) => sum + n(r.sport, 0), 0);
    const workTotal = rows.reduce((sum, r) => sum + n(r.work, 0), 0);
    const alcoholTotal = rows.reduce((sum, r) => sum + n(r.alcohol, 0), 0);
    return `<div class="tb-health-weekboard">
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap;margin-bottom:10px;">
        <div>
          <h3 style="margin:0;">${esc(txt("Semaine active", "Active week"))}</h3>
          <div class="muted" style="font-size:12px;">${esc(txt("Kcal, proteines, eau, sommeil, sport, travail, alcool et score au meme endroit.", "Kcal, protein, water, sleep, sport, work, alcohol and score in one place."))}</div>
        </div>
        <span class="pill">${esc(txt("7 jours", "7 days"))}</span>
      </div>
      <div class="tb-health-weekboard-kpis">
        <div><span>${esc(txt("Score", "Score"))}</span><strong>${Math.round(avgScore)}/100</strong></div>
        <div><span>${esc(txt("Kcal", "Kcal"))}</span><strong>${Math.round(avgKcal)} / ${Math.round(avgNeed)}</strong></div>
        <div><span>${esc(txt("Proteines", "Protein"))}</span><strong>${Math.round(avgProtein)}g/j</strong></div>
        <div><span>${esc(txt("Eau", "Water"))}</span><strong>${Math.round(avgWater)}ml/j</strong></div>
        <div><span>${esc(txt("Sommeil", "Sleep"))}</span><strong>${Math.round(avgSleep * 10) / 10}h/j</strong></div>
        <div><span>${esc(txt("Sport", "Sport"))}</span><strong>${Math.round(sportTotal)} kcal</strong></div>
        <div><span>${esc(txt("Travail", "Work"))}</span><strong>${Math.round(workTotal)} kcal</strong></div>
        <div><span>${esc(txt("Alcool", "Alcohol"))}</span><strong>${Math.round(alcoholTotal * 10) / 10} verres</strong></div>
      </div>
      <div class="tb-health-weekboard-grid">
        ${rows.map(({ row, plan, kcal, need, water, sleep, protein, sport, work, alcohol, score, load }) => {
          const kcalPct = Math.max(0, Math.min(100, (kcal / need) * 100));
          const proteinPct = Math.max(0, Math.min(100, (protein / Math.max(70, bodyWeight() * 1.35)) * 100));
          const waterPct = Math.max(0, Math.min(100, (water / 2000) * 100));
          const sleepPct = Math.max(0, Math.min(100, (sleep / 7.5) * 100));
          const sportPct = Math.max(0, Math.min(100, (sport / 650) * 100));
          const workPct = Math.max(0, Math.min(100, (work / 650) * 100));
          const alcoholPct = Math.max(0, Math.min(100, (alcohol / 3) * 100));
          const scorePct = Math.max(0, Math.min(100, score));
          const plannedLabel = plan.planned ? `${plan.code || ""} ${plan.sessionName || ""}`.trim() : txt("Repos", "Rest");
          const detail = `${row.day} | ${plannedLabel} | score ${Math.round(score)}/100 | kcal ${Math.round(kcal)}/${Math.round(need)} | proteines ${Math.round(protein)}g | eau ${Math.round(water)} ml | sommeil ${sleep ? Math.round(sleep * 10) / 10 : "-"}h | sport ${Math.round(sport)} kcal | travail ${Math.round(work)} kcal | alcool ${Math.round(alcohol * 10) / 10} verre(s)`;
          return `<button class="tb-health-weekboard-day ${row.day === selectedDay ? "active" : ""}" type="button" data-health-date="${esc(row.day)}" title="${esc(detail)}">
            <span class="muted">${esc(row.day.slice(5).replace("-", "/"))}</span>
            <strong>${esc(plannedLabel)}</strong>
            <div class="tb-health-weekboard-bars">
              <i style="height:${Math.max(6, scorePct * .56)}px;background:#0f172a;"></i>
              <i style="height:${Math.max(6, kcalPct * .56)}px;background:#22c55e;"></i>
              <i style="height:${Math.max(6, proteinPct * .56)}px;background:#14b8a6;"></i>
              <i style="height:${Math.max(6, waterPct * .56)}px;background:#38bdf8;"></i>
              <i style="height:${Math.max(6, sleepPct * .56)}px;background:#8b5cf6;"></i>
              <i style="height:${Math.max(6, sportPct * .56)}px;background:#f59e0b;"></i>
              <i style="height:${Math.max(6, workPct * .56)}px;background:#ef4444;"></i>
              <i style="height:${Math.max(3, alcoholPct * .56)}px;background:#64748b;"></i>
            </div>
            <small>${Math.round(kcal)} kcal · ${Math.round(row.score || 0)}/100</small>
          </button>`;
        }).join("")}
      </div>
      <div class="muted" style="font-size:11px;margin-top:8px;">${esc(txt("Barres : score, kcal, proteines, eau, sommeil, sport, travail, alcool.", "Bars: score, kcal, protein, water, sleep, sport, work, alcohol."))}</div>
    </div>`;
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
  function renderHealth(reason) {
    ensureNutritionShell();
    ensureNutritionStyles();
    const root = document.getElementById("health-root");
    if (!root) return;
    if (!CACHE.loaded && !CACHE.loading) {
      loadNutrition().then(() => {
        if ((window.activeView || "") === "health") renderHealth("loaded");
      }).catch(() => {});
    }
    const day = selectedDateISO();
    const history = dailySummaries();
    const healthWeek = healthHistoryRows(history, day);
    const todayRow = healthWeek.find(row => row.day === day) || healthWeek[healthWeek.length - 1] || {};
    const h = todayRow.health || {};
    const kcal = n(h.kcal, todayRow.kcal);
    const needsKcal = Math.max(1, n(todayRow.needsKcal, h.needsKcal));
    const water = n(h.drinkWaterMl, todayRow.waterMl);
    const sleepHours = n(h.sleepHours, sleepForDay(day).hours);
    const protein = n(h.protein, todayRow.protein);
    const proteinTarget = n(h.proteinTarget, Math.max(70, bodyWeight() * 1.35));
    const insight = healthWeekInsight(healthWeek);
    const alcoholDrinks = n(h.alcoholDrinks, todayRow.alcoholDrinks);
    const alcoholWeeklyDrinks = n(h.alcoholWeeklyDrinks, insight?.alcoholWeekDrinks);
    const score = Math.round(n(todayRow.score, h.score));
    const color = todayRow.color || h.color || (score >= 78 ? "#22c55e" : score >= 58 ? "#f59e0b" : "#ef4444");
    const balance = kcal - needsKcal;
    const kcalNow = n(h.expectedKcalNow, needsKcal);
    const balanceNow = n(h.currentBalance, kcal - kcalNow);
    const scoreLabel = h.label || (score >= 78 ? txt("Equilibre", "Balanced") : score >= 58 ? txt("A surveiller", "Watch") : txt("A corriger", "To correct"));
    const pillars = healthPillarRows(todayRow, h, proteinTarget);
    const focusCards = healthFocusCards(todayRow, h, proteinTarget);
    const goal = loadNutritionGoal();
    const goalSpentKcal = Math.max(0, n(h.baseline, baseline().bmr) + n(todayRow.sportKcal, 0) + n(todayRow.workKcal, 0));
    const goalTargets = nutritionGoalTargets(goalSpentKcal, bodyWeight());
    const mealTarget = nextMealTarget(day, goalTargets, todayRow);
    const goalAdvice = healthGoalAdvice(goal, goalTargets, todayRow, n(todayRow.sportKcal, 0) + n(todayRow.workKcal, 0), sleepHours);
    root.innerHTML = `
      <section class="tb-nutrition-shell">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;">
          <div>
            <h2 style="margin:0;">${esc(txt("Sante", "Health"))}</h2>
            <div class="muted" style="margin-top:4px;">${esc(txt("Score lisible reliant alimentation, sommeil, sport et travail.", "Readable score linking nutrition, sleep, sport and work."))}</div>
          </div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
            <label class="pill" style="display:flex;align-items:center;gap:6px;">${esc(txt("Date", "Date"))} <input id="health-date" type="date" value="${esc(day)}" style="width:142px;"></label>
            <button class="btn" type="button" id="health-open-nutrition">${esc(txt("Saisir alimentation / sommeil", "Enter nutrition / sleep"))}</button>
            <button class="btn" type="button" id="health-refresh">${esc(txt("Rafraichir", "Refresh"))}</button>
          </div>
        </div>
        <div class="tb-health-goal">
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap;">
            <div>
              <h3 style="margin:0;">${esc(txt("Objectif actif", "Active goal"))}</h3>
              <div class="muted" style="font-size:12px;margin-top:4px;">${esc(goalAdvice)}</div>
            </div>
            <span class="pill">${esc(nutritionGoalLabel(goal))}${nutritionGoalOffset(goal) ? ` ${nutritionGoalOffset(goal) > 0 ? "+" : ""}${Math.round(nutritionGoalOffset(goal))} kcal` : ""}</span>
          </div>
          <div class="tb-health-goal-grid">
            <label><span class="muted" style="font-size:12px;font-weight:850;">${esc(txt("Mode", "Mode"))}</span><select id="health-goal-mode"><option value="bulk" ${goal.mode === "bulk" ? "selected" : ""}>${esc(txt("Prise de masse douce", "Lean bulk"))}</option><option value="maintenance" ${goal.mode === "maintenance" ? "selected" : ""}>${esc(txt("Maintien / recomposition", "Maintenance / recomp"))}</option><option value="cut" ${goal.mode === "cut" ? "selected" : ""}>${esc(txt("Perte de gras douce", "Gentle fat loss"))}</option></select></label>
            <label><span class="muted" style="font-size:12px;font-weight:850;">${esc(txt("Surplus", "Surplus"))}</span><select id="health-goal-surplus" ${goal.mode === "bulk" ? "" : "disabled"}><option value="300" ${goal.surplusKcal === 300 ? "selected" : ""}>+300 kcal</option><option value="350" ${goal.surplusKcal === 350 ? "selected" : ""}>+350 kcal</option><option value="400" ${goal.surplusKcal === 400 ? "selected" : ""}>+400 kcal</option><option value="500" ${goal.surplusKcal === 500 ? "selected" : ""}>+500 kcal</option></select></label>
            <label><span class="muted" style="font-size:12px;font-weight:850;">${esc(txt("Deficit", "Deficit"))}</span><select id="health-goal-deficit" ${goal.mode === "cut" ? "" : "disabled"}><option value="250" ${goal.deficitKcal === 250 ? "selected" : ""}>-250 kcal</option><option value="300" ${goal.deficitKcal === 300 ? "selected" : ""}>-300 kcal</option><option value="400" ${goal.deficitKcal === 400 ? "selected" : ""}>-400 kcal</option><option value="500" ${goal.deficitKcal === 500 ? "selected" : ""}>-500 kcal</option></select></label>
            <div style="border:1px solid var(--border);border-radius:12px;padding:9px 10px;background:rgba(255,255,255,.05);">
              <span class="muted" style="font-size:12px;font-weight:850;">${esc(txt("Cible jour", "Daily target"))}</span>
              <strong style="display:block;margin-top:3px;">${Math.round(goalTargets.targetKcal)} kcal</strong>
              <small class="muted">${esc(macroSummaryText(goalTargets))}</small>
            </div>
          </div>
          <div class="tb-health-focus-grid" style="margin-top:10px;">
            <div class="tb-health-focus-card" style="border-color:#22c55e66;"><strong style="color:#22c55e;">${esc(txt("Prochain moment", "Next moment"))}</strong><div class="muted" style="font-size:12px;">${esc(mealTarget.label)} : ${Math.round(mealTarget.kcal)} kcal visees, a adapter selon ce que tu as deja mange.</div></div>
            <div class="tb-health-focus-card" style="border-color:#38bdf866;"><strong style="color:#38bdf8;">${esc(txt("Plan simple", "Simple plan"))}</strong><div class="muted" style="font-size:12px;">${esc(txt("Sport planifie + nutrition + sommeil restent controles dans cette page.", "Planned sport + nutrition + sleep stay controlled on this page."))}</div></div>
          </div>
        </div>
        <div class="tb-health-hero" style="margin-top:14px;">
          <div style="border:1px solid var(--border);border-radius:14px;padding:16px;background:linear-gradient(145deg,rgba(56,189,248,.12),rgba(34,197,94,.08)),var(--panel2);">
            <div class="tb-health-ring" style="background:conic-gradient(${color} ${Math.max(0, Math.min(100, score))}%, rgba(148,163,184,.18) 0);">
              <div class="tb-health-ring-inner">
                <div>
                  <div class="muted" style="font-size:12px;">${esc(scoreLabel)}</div>
                  <strong style="font-size:44px;line-height:1;">${score}</strong>
                  <div class="muted">/100</div>
                </div>
              </div>
            </div>
            <div class="muted" style="margin-top:12px;text-align:center;">${esc(h.advice || insight.advice)}</div>
          </div>
          <div style="display:grid;gap:10px;">
            <div class="tb-sport-stats">
              <div class="tb-sport-stat"><span>${esc(txt("Energie maintenant", "Energy now"))}</span><strong>${Math.round(kcal)} / ${Math.round(kcalNow)} kcal</strong></div>
              <div class="tb-sport-stat"><span>${esc(txt("Jour complet", "Full day"))}</span><strong>${Math.round(kcal)} / ${Math.round(needsKcal)} kcal</strong></div>
              <div class="tb-sport-stat"><span>${esc(txt("Balance actuelle", "Current balance"))}</span><strong>${Math.round(balanceNow)} kcal</strong></div>
              <div class="tb-sport-stat"><span>${esc(txt("Balance jour", "Day balance"))}</span><strong>${Math.round(balance)} kcal</strong></div>
              <div class="tb-sport-stat"><span>${esc(txt("Eau bue", "Drunk water"))}</span><strong>${Math.round(water)} / 2000 ml</strong></div>
              <div class="tb-sport-stat"><span>${esc(txt("Proteines", "Protein"))}</span><strong>${Math.round(protein)} / ${Math.round(proteinTarget)} g</strong></div>
              <div class="tb-sport-stat"><span>${esc(txt("Sommeil", "Sleep"))}</span><strong>${sleepHours ? `${Math.round(sleepHours * 10) / 10}h` : "-"}</strong></div>
              <div class="tb-sport-stat"><span>${esc(txt("Alcool", "Alcohol"))}</span><strong>${Math.round(alcoholDrinks * 10) / 10} j / ${Math.round(alcoholWeeklyDrinks * 10) / 10} sem.</strong></div>
              <div class="tb-sport-stat"><span>${esc(txt("Charge", "Load"))}</span><strong>${Math.round(n(todayRow.sportKcal, 0) + n(todayRow.workKcal, 0))} kcal</strong></div>
            </div>
            <div class="tb-health-pillars">
              ${pillars.map(row => `<div class="tb-health-pillar">
                <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start;">
                  <strong>${esc(row.label)}</strong>
                  <small class="muted">${esc(row.note)}</small>
                </div>
                <div class="muted" style="font-size:12px;">${esc(row.value)}</div>
                <div class="tb-health-pillar-track"><span style="width:${Math.max(0, Math.min(100, row.pct))}%;background:${row.color};"></span></div>
              </div>`).join("")}
            </div>
            <div class="tb-health-focus-grid">
              ${focusCards.map(card => `<div class="tb-health-focus-card" style="border-color:${card.color}66;">
                <strong style="color:${card.color};">${esc(card.title)}</strong>
                <div class="muted" style="font-size:12px;">${esc(card.body)}</div>
              </div>`).join("")}
            </div>
            <details open style="border:1px solid var(--border);border-radius:12px;padding:12px;background:var(--panel2);">
              <summary style="cursor:pointer;font-weight:900;">${esc(txt("Comprendre le score", "Understand the score"))}</summary>
              <div class="tb-sport-stats" style="margin-top:10px;">
                <div class="tb-sport-stat"><span>${esc(txt("Energie", "Energy"))}</span><strong>${Math.round(n(h.kcalScore, 0))} / 42</strong></div>
                <div class="tb-sport-stat"><span>${esc(txt("Eau", "Water"))}</span><strong>${Math.round(n(h.hydrationScore, 0))} / 24</strong></div>
                <div class="tb-sport-stat"><span>${esc(txt("Proteines", "Protein"))}</span><strong>${Math.round(n(h.proteinScore, 0))} / 18</strong></div>
                <div class="tb-sport-stat"><span>${esc(txt("Sommeil", "Sleep"))}</span><strong>${Math.round(n(h.sleepScore, 0))} / 18</strong></div>
                <div class="tb-sport-stat"><span>${esc(txt("Alcool", "Alcohol"))}</span><strong>${Math.round(n(h.alcoholScore, 0))} / 10</strong></div>
                <div class="tb-sport-stat"><span>${esc(txt("Base metabolique", "BMR"))}</span><strong>${Math.round(n(h.baseline, baseline().bmr))} kcal</strong></div>
                <div class="tb-sport-stat"><span>${esc(txt("Sport + travail", "Sport + work"))}</span><strong>${Math.round(n(h.activityKcal, todayRow.sportKcal + todayRow.workKcal))} kcal</strong></div>
              </div>
            </details>
          </div>
        </div>
        ${renderHealthWeekDashboard(healthWeek, day)}
        <div style="border:1px solid var(--border);border-radius:14px;padding:14px;background:linear-gradient(180deg,rgba(139,92,246,.08),rgba(56,189,248,.05)),var(--panel2);margin-top:14px;">
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap;margin-bottom:12px;">
            <div>
              <h3 style="margin:0;">${esc(txt("Tendance semaine", "Weekly trend"))}</h3>
              <div class="muted" style="font-size:12px;margin-top:3px;">${esc(insight.advice)}</div>
            </div>
            <span class="pill" style="border-color:${insight.trend >= 0 ? "#22c55e" : "#f59e0b"};color:${insight.trend >= 0 ? "#22c55e" : "#f59e0b"};">${insight.trend >= 0 ? "+" : ""}${Math.round(insight.trend)} pts</span>
          </div>
          <div class="tb-health-week">
            ${healthWeek.map(row => {
              const rowColor = row.color || "#38bdf8";
              const height = Math.max(8, Math.min(92, n(row.score, 0) * 0.92));
              const detail = `${row.day} | score ${Math.round(row.score)}/100 | kcal ${Math.round(n(row.health?.kcal, row.kcal))}/${Math.round(row.needsKcal)} | eau ${Math.round(n(row.health?.drinkWaterMl, row.waterMl))} ml | sommeil ${n(row.health?.sleepHours, sleepForDay(row.day).hours) || "-"}h | alcool ${Math.round(n(row.health?.alcoholDrinks, row.alcoholDrinks) * 10) / 10} verre(s) | charge ${Math.round(n(row.sportKcal, 0) + n(row.workKcal, 0))} kcal`;
              return `<button class="tb-health-bar" type="button" data-health-date="${esc(row.day)}" title="${esc(detail)}" style="${row.day === day ? `border-color:${rowColor};` : ""}">
                <span style="height:${height}px;background:linear-gradient(180deg,${rowColor},#38bdf8);"></span>
                <strong>${Math.round(row.score)}</strong>
                <small>${esc(row.day.slice(5).replace("-", "/"))}</small>
              </button>`;
            }).join("")}
          </div>
        </div>
      </section>`;
    const dateInput = root.querySelector("#health-date");
    if (dateInput) dateInput.onchange = () => {
      CACHE.selectedDate = String(dateInput.value || todayISO()).slice(0, 10);
      renderHealth("date");
    };
    root.querySelectorAll("[data-health-date]").forEach(btn => {
      btn.onclick = () => {
        CACHE.selectedDate = btn.getAttribute("data-health-date") || day;
        renderHealth("bar");
      };
    });
    const openNutrition = root.querySelector("#health-open-nutrition");
    if (openNutrition) openNutrition.onclick = () => openNutritionView();
    const refresh = root.querySelector("#health-refresh");
    if (refresh) refresh.onclick = async () => {
      await loadNutrition({ force: true });
      renderHealth("refresh");
    };
    const healthGoalMode = root.querySelector("#health-goal-mode");
    if (healthGoalMode) healthGoalMode.onchange = () => {
      saveNutritionGoal({ mode: healthGoalMode.value || "maintenance" });
      renderHealth("goal-mode");
      try { if ((window.activeView || "") === "nutrition") renderNutrition("goal-mode"); } catch (_) {}
    };
    const healthGoalSurplus = root.querySelector("#health-goal-surplus");
    if (healthGoalSurplus) healthGoalSurplus.onchange = () => {
      saveNutritionGoal({ surplusKcal: n(healthGoalSurplus.value, 350) });
      renderHealth("goal-surplus");
      try { if ((window.activeView || "") === "nutrition") renderNutrition("goal-surplus"); } catch (_) {}
    };
    const healthGoalDeficit = root.querySelector("#health-goal-deficit");
    if (healthGoalDeficit) healthGoalDeficit.onchange = () => {
      saveNutritionGoal({ deficitKcal: n(healthGoalDeficit.value, 300) });
      renderHealth("goal-deficit");
      try { if ((window.activeView || "") === "nutrition") renderNutrition("goal-deficit"); } catch (_) {}
    };
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
    const spentKcal = Math.max(0, n(balance.spentKcal, base.bmr + sportKcal + workKcal));
    const kg = bodyWeight();
    const goalTargets = nutritionGoalTargets(spentKcal, kg);
    const needsKcal = Math.max(0, n(goalTargets.targetKcal, spentKcal));
    const objectiveBalanceKcal = total.kcal - needsKcal;
    const balanceLabel = objectiveBalanceKcal >= 0 ? txt("au-dessus", "above") : txt("en-dessous", "below");
    const consumedKcal = Math.max(0, n(total.kcal, 0));
    const kcalDelta = consumedKcal - needsKcal;
    const kcalTargetLabel = kcalDelta >= 0 ? txt("surplus", "surplus") : txt("reste", "left");
    const proteinTarget = goalTargets.protein;
    const fatTarget = goalTargets.fat;
    const carbsTarget = goalTargets.carbs;
    const goalLabel = nutritionGoalLabel(goalTargets);
    const typeTotals = typeTotalsForDay(meals, items);
    const mealTargets = mealMomentTargets(needsKcal, typeTotals, day);
    const kcalPct = Math.min(100, pct(consumedKcal, needsKcal));
    const kcalRingColor = kcalDelta > 250 ? "#ef4444" : (kcalDelta < -350 ? "#f59e0b" : "#22c55e");
    const week = weekRows(history, day);
    const alcoholToday = alcoholSummaryForItems(items);
    const alcoholWeekTotal = week.reduce((sum, row) => sum + n(row.alcoholDrinks, 0), 0);
    const alcoholDrinkingDays = week.filter(row => n(row.alcoholDrinks, 0) > 0.05).length;
    const alcoholJudge = alcoholJudgement(alcoholToday.standardDrinks, alcoholWeekTotal, alcoholDrinkingDays);
    const sleep = sleepForDay(day);
    const sleepWeek = week.map(row => ({ day: row.day, ...sleepForDay(row.day) }));
    const sleepLabel = sleep.hours > 0 ? `${Math.round(sleep.hours * 10) / 10}h` : txt("non saisi", "not set");
    const sleepNightLabel = sleep.nightDay ? sleep.nightDay.slice(5).replace("-", "/") : offsetDateISO(day, -1).slice(5).replace("-", "/");
    const editingItem = CACHE.editingItemId ? items.find(item => String(item.id || "") === String(CACHE.editingItemId)) : null;
    const quickFoods = quickFoodRows();
    const mealFavorites = loadMealFavorites();
    const activeMealType = CACHE.selectedMealType || currentMealType();
    const syncBadge = CACHE.syncingLocal
      ? txt("Sync en cours", "Syncing")
      : loadLocalMeals().length
        ? txt("Ajouts en attente", "Pending entries")
        : txt("A jour", "Up to date");
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
            <span class="pill">${esc(goalLabel)}${goalTargets.offsetKcal ? ` ${goalTargets.offsetKcal > 0 ? "+" : ""}${Math.round(goalTargets.offsetKcal)} kcal` : ""}</span>
            <button class="btn" type="button" id="nutrition-refresh">${esc(txt("Rafraichir", "Refresh"))}</button>
          </div>
        </div>
        ${renderNutritionSyncPanel()}
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
              <strong>${Math.round(base.bmr || 0)} ${esc(txt("base", "base"))} + ${Math.round(sportKcal)} sport + ${Math.round(workKcal)} ${esc(txt("travail", "work"))}${goalTargets.offsetKcal ? ` ${goalTargets.offsetKcal > 0 ? "+" : "-"} ${Math.abs(Math.round(goalTargets.offsetKcal))} ${esc(txt("objectif", "goal"))}` : ""} = ${Math.round(needsKcal)} kcal</strong>
              <div class="muted" style="font-size:12px;margin-top:6px;">${esc(txt("Hydratation : objectif 2 L en eau bue. Eau des aliments", "Hydration: 2 L target from drunk water. Food water"))} ${Math.round(foodWaterMl)} ml.</div>
              <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin-top:10px;">
                <label style="display:grid;gap:4px;"><span class="muted" style="font-size:12px;">${esc(txt("Objectif", "Goal"))}</span><select id="nutrition-goal-mode"><option value="bulk" ${goalTargets.mode === "bulk" ? "selected" : ""}>${esc(txt("Prise de masse douce", "Lean bulk"))}</option><option value="maintenance" ${goalTargets.mode === "maintenance" ? "selected" : ""}>${esc(txt("Maintien / recomposition", "Maintenance / recomp"))}</option><option value="cut" ${goalTargets.mode === "cut" ? "selected" : ""}>${esc(txt("Perte de gras douce", "Gentle fat loss"))}</option></select></label>
                <label style="display:grid;gap:4px;"><span class="muted" style="font-size:12px;">${esc(txt("Surplus kcal", "Kcal surplus"))}</span><select id="nutrition-goal-surplus" ${goalTargets.mode === "bulk" ? "" : "disabled"}><option value="300" ${goalTargets.surplusKcal === 300 ? "selected" : ""}>+300</option><option value="350" ${goalTargets.surplusKcal === 350 ? "selected" : ""}>+350</option><option value="400" ${goalTargets.surplusKcal === 400 ? "selected" : ""}>+400</option><option value="500" ${goalTargets.surplusKcal === 500 ? "selected" : ""}>+500</option></select></label>
                <label style="display:grid;gap:4px;"><span class="muted" style="font-size:12px;">${esc(txt("Deficit kcal", "Kcal deficit"))}</span><select id="nutrition-goal-deficit" ${goalTargets.mode === "cut" ? "" : "disabled"}><option value="250" ${goalTargets.deficitKcal === 250 ? "selected" : ""}>-250</option><option value="300" ${goalTargets.deficitKcal === 300 ? "selected" : ""}>-300</option><option value="400" ${goalTargets.deficitKcal === 400 ? "selected" : ""}>-400</option><option value="500" ${goalTargets.deficitKcal === 500 ? "selected" : ""}>-500</option></select></label>
                <label style="display:grid;gap:4px;"><span class="muted" style="font-size:12px;">${esc(txt("Poids cible", "Target weight"))}</span><input id="nutrition-goal-weight" type="number" min="35" max="180" step="0.1" value="${esc(String(n(loadNutritionGoal().targetWeightKg, bodyWeight() + 3)))}"></label>
                <label style="display:grid;gap:4px;"><span class="muted" style="font-size:12px;">${esc(txt("Rythme kg/sem.", "Pace kg/week"))}</span><input id="nutrition-goal-rate" type="number" min="0.1" max="0.8" step="0.05" value="${esc(String(n(loadNutritionGoal().weeklyRateKg, 0.25)))}"></label>
              </div>
              ${goalCockpitHTML(loadNutritionGoal(), goalTargets, week, total, sportKcal, workKcal)}
            </div>
          </div>
        </div>
        <div class="tb-nutrition-layout">
          <div style="display:flex;flex-direction:column;gap:12px;">
            ${view().renderQuickAddPanel({
              editingItem,
              syncBadge,
              foodQuery: CACHE.foodQuery,
              foodOptionsHtml: foodOptions(),
              quickFoods,
              mealFavorites,
              activeMealType,
              error: CACHE.error,
              renderFoodChip: (food, kind) => foodChipHTML(food, kind),
              renderMealFavoriteChip: (fav, index) => mealFavoriteChipHTML(fav, index),
              esc,
              t: txt,
            })}
            ${view().renderHydrationPanel({ esc, t: txt })}
            ${view().renderSleepPanel({ sleep, sleepLabel, sleepNightLabel, day, sleepWeek, offsetDateISO, esc, t: txt })}
            ${view().renderHistoryPanel({ week, day, needsKcal, mealTypeLabel, esc, t: txt })}
            <div style="border:1px solid ${alcoholJudge.color}66;border-radius:8px;padding:12px;background:linear-gradient(180deg,${alcoholJudge.color}14,rgba(15,23,42,.02)),var(--panel2);">
              <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap;margin-bottom:8px;">
                <div>
                  <h3 style="margin:0;">${esc(txt("Alcool", "Alcohol"))}</h3>
                  <div class="muted" style="font-size:12px;margin-top:3px;">${esc(txt("Repere: 2 verres/jour, 10/semaine, pas tous les jours.", "Guide: 2 drinks/day, 10/week, not every day."))}</div>
                </div>
                <span class="pill" style="border-color:${alcoholJudge.color};color:${alcoholJudge.color};">${esc(alcoholJudge.label)}</span>
              </div>
              <div class="tb-sport-stats" style="margin-bottom:10px;">
                <div class="tb-sport-stat"><span>${esc(txt("Aujourd'hui", "Today"))}</span><strong>${Math.round(alcoholToday.standardDrinks * 10) / 10} ${esc(txt("verres", "drinks"))}</strong></div>
                <div class="tb-sport-stat"><span>${esc(txt("Semaine", "Week"))}</span><strong>${Math.round(alcoholWeekTotal * 10) / 10} / 10</strong></div>
                <div class="tb-sport-stat"><span>${esc(txt("Jours avec alcool", "Drinking days"))}</span><strong>${alcoholDrinkingDays} / 7</strong></div>
              </div>
              <div class="tb-nutrition-week-grid" style="margin-bottom:8px;">
                ${week.map(row => {
                  const drinks = n(row.alcoholDrinks, 0);
                  const height = Math.max(6, Math.min(74, (drinks / 2) * 74));
                  const barColor = drinks > 2.01 ? "#ef4444" : drinks > 0.05 ? "#f59e0b" : "#22c55e";
                  const detail = `${row.day} · ${Math.round(drinks * 10) / 10} verre(s) standard`;
                  return `<button class="btn small" type="button" data-nutrition-history-date="${esc(row.day)}" title="${esc(detail)}" style="height:92px;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:4px;padding:5px;${row.day === day ? `border-color:${barColor};` : ""}">
                    <span style="width:100%;height:${height}px;border-radius:6px 6px 3px 3px;background:linear-gradient(180deg,${barColor},#38bdf8);"></span>
                    <small>${esc(row.day.slice(5).replace("-", "/"))}</small>
                  </button>`;
                }).join("")}
              </div>
              <div class="muted" style="font-size:12px;margin-bottom:8px;">${esc(alcoholJudge.note)} ${esc(txt("Calcul: 1 verre standard = 10 g d'alcool pur.", "Calculation: 1 standard drink = 10 g pure alcohol."))}</div>
              ${alcoholToday.entries.length ? `<div style="display:grid;gap:6px;">
                ${alcoholToday.entries.map(entry => `<div style="display:flex;justify-content:space-between;gap:8px;border-top:1px solid rgba(148,163,184,.22);padding-top:6px;">
                  <span>${esc(entry.label)} <small class="muted">${Math.round(entry.grams)} ml/g</small></span>
                  <strong>${Math.round(entry.standardDrinks * 10) / 10} ${esc(txt("verres", "drinks"))}</strong>
                </div>`).join("")}
              </div>` : `<div class="muted">${esc(txt("Aucun aliment alcoolise lie au jour selectionne.", "No alcoholic food linked to the selected day."))}</div>`}
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
                ${esc(txt("Besoins calcules", "Calculated needs"))}: ${Math.round(base.bmr || 0)} ${esc(txt("base", "base"))} + ${Math.round(sportKcal)} sport + ${Math.round(workKcal)} ${esc(txt("travail", "work"))}${goalTargets.offsetKcal ? ` ${goalTargets.offsetKcal > 0 ? "+" : "-"} ${Math.abs(Math.round(goalTargets.offsetKcal))} ${esc(txt("objectif", "goal"))}` : ""}.
              </div>
            </div>
            <div class="tb-sport-stats" style="margin-bottom:12px;">
              <div class="tb-sport-stat"><span>kcal</span><strong>${Math.round(total.kcal)}</strong></div>
              <div class="tb-sport-stat"><span>${esc(txt("Proteines", "Protein"))}</span><strong>${fmtMacro(total.protein)}</strong></div>
              <div class="tb-sport-stat"><span>${esc(txt("Glucides", "Carbs"))}</span><strong>${fmtMacro(total.carbs)}</strong></div>
              <div class="tb-sport-stat"><span>${esc(txt("Lipides", "Fat"))}</span><strong>${fmtMacro(total.fat)}</strong></div>
              <div class="tb-sport-stat"><span>${esc(txt("Eau bue", "Drunk water"))}</span><strong>${Math.round(drinkWaterMl)} ml</strong></div>
              <div class="tb-sport-stat"><span>${esc(txt("Sommeil", "Sleep"))}</span><strong>${esc(sleepLabel)}</strong></div>
              <div class="tb-sport-stat"><span>${esc(txt("Balance", "Balance"))}</span><strong>${Math.round(objectiveBalanceKcal)} kcal</strong></div>
            </div>
            <div class="muted" style="margin:-4px 0 12px;">
              ${esc(txt("Depense estimee", "Estimated spend"))}: ${Math.round(spentKcal || 0)} kcal =
              ${esc(txt("base", "base"))} ${Math.round(base.bmr || 0)}
              + sport ${Math.round(sportKcal)}
              + ${esc(txt("travail", "work"))} ${Math.round(workKcal)}.
              ${esc(txt("Tu es", "You are"))} ${esc(balanceLabel)} ${Math.abs(Math.round(objectiveBalanceKcal || 0))} kcal.
            </div>
            <div style="display:grid;gap:10px;margin-top:12px;">
              <h3 style="margin:0;">${esc(txt("Timeline repas", "Meal timeline"))}</h3>
              ${typeof view().renderMealTimeline === "function" ? view().renderMealTimeline({
                mealTargets,
                typeTotals,
                items,
                total,
                drinkWaterMl,
                macroTargets: { protein: proteinTarget, carbs: carbsTarget, fat: fatTarget },
                itemMeal,
                mealTypeLabel,
                esc,
                t: txt,
              }) : ""}
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
    const typeSelect = root.querySelector("#nutrition-type");
    if (typeSelect) typeSelect.onchange = () => {
      CACHE.selectedMealType = typeSelect.value || "meal";
      updateNutritionPreview(root);
    };
    const refresh = root.querySelector("#nutrition-refresh");
    if (refresh) refresh.onclick = async () => { await loadNutrition({ force: true }); renderNutrition("refresh"); };
    const syncPending = root.querySelector("#nutrition-sync-pending");
    if (syncPending) syncPending.onclick = async () => {
      syncPending.disabled = true;
      await syncLocalNutritionRows("manual", { forceOnline: true });
      await loadNutrition({ force: true });
      renderNutrition("sync-pending");
    };
    const clearPending = root.querySelector("#nutrition-clear-pending");
    if (clearPending) clearPending.onclick = async () => {
      discardAllLocalNutritionRows();
      await loadNutrition({ force: true });
      renderNutrition("clear-pending");
    };
    root.querySelectorAll("[data-nutrition-discard-local]").forEach(btn => {
      btn.onclick = async () => {
        discardLocalNutritionRow(btn.getAttribute("data-nutrition-discard-local"));
        await loadNutrition({ force: true });
        renderNutrition("discard-local");
      };
    });
    const goalMode = root.querySelector("#nutrition-goal-mode");
    if (goalMode) goalMode.onchange = () => {
      saveNutritionGoal({ mode: goalMode.value || "maintenance" });
      renderNutrition("goal-mode");
    };
    const goalSurplus = root.querySelector("#nutrition-goal-surplus");
    if (goalSurplus) goalSurplus.onchange = () => {
      saveNutritionGoal({ surplusKcal: n(goalSurplus.value, 350) });
      renderNutrition("goal-surplus");
    };
    const goalDeficit = root.querySelector("#nutrition-goal-deficit");
    if (goalDeficit) goalDeficit.onchange = () => {
      saveNutritionGoal({ deficitKcal: n(goalDeficit.value, 300) });
      renderNutrition("goal-deficit");
    };
    const goalWeight = root.querySelector("#nutrition-goal-weight");
    if (goalWeight) goalWeight.onchange = () => {
      saveNutritionGoal({ targetWeightKg: n(goalWeight.value, bodyWeight() + 3) });
      renderNutrition("goal-weight");
    };
    const goalRate = root.querySelector("#nutrition-goal-rate");
    if (goalRate) goalRate.onchange = () => {
      saveNutritionGoal({ weeklyRateKg: n(goalRate.value, 0.25) });
      renderNutrition("goal-rate");
    };
    root.querySelectorAll("[data-nutrition-pick-type]").forEach(btn => {
      btn.onclick = () => {
        const select = root.querySelector("#nutrition-type");
        CACHE.selectedMealType = btn.getAttribute("data-nutrition-pick-type") || "meal";
        if (select) select.value = CACHE.selectedMealType;
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
        rememberFoodRecent(key);
        renderNutrition("food-pick");
      };
    });
    root.querySelectorAll("[data-nutrition-save-meal-fav]").forEach(btn => {
      btn.onclick = () => {
        saveFavoriteMealFromType(btn.getAttribute("data-nutrition-save-meal-fav"));
        renderNutrition("meal-fav-save");
      };
    });
    root.querySelectorAll("[data-nutrition-apply-meal-fav]").forEach(btn => {
      btn.onclick = () => applyMealFavorite(btn.getAttribute("data-nutrition-apply-meal-fav"));
    });
    const favorite = root.querySelector("#nutrition-toggle-favorite");
    if (favorite) favorite.onclick = () => {
      toggleFoodFavorite(selectedFood(root)?.key);
      renderNutrition("favorite");
    };
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
    if (type) {
      type.value = meal?.meal_type || "meal";
      CACHE.selectedMealType = type.value;
    }
    updateNutritionPreview(root);
  }
  function startNutritionEdit(root, id) {
    CACHE.editingItemId = String(id || "");
    CACHE.foodQuery = "";
    renderNutrition("edit");
  }
  async function saveNutritionMeal(root) {
    const saveBtn = root?.querySelector("#nutrition-save");
    if (saveBtn) saveBtn.disabled = true;
    const food = selectedFood(root);
    rememberFoodRecent(food?.key);
    syncNutritionAmount(root);
    const grams = n(root.querySelector("#nutrition-grams")?.value, food?.servingGrams || 100);
    const nut = nutritionForGrams(food, grams);
    const waterMl = n(nut.waterMl, 0);
    const c = client();
    const syncId = `nutrition_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const mealType = selectedMealType(root);
    const localRow = makeLocalNutritionRow({ food, grams, nut, waterMl, mealType, syncId });
    try {
      if (c && uid() && CACHE.editingItemId) {
        const existing = CACHE.items.find(item => String(item.id || "") === String(CACHE.editingItemId));
        const meal = itemMeal(existing);
        if (meal?.id) {
          const mealUpdate = await c.from(table("nutrition_meals")).update({
            meal_date: selectedDateISO(),
            meal_type: mealType,
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
        upsertOptimisticNutritionRow(localRow);
        renderNutrition("save-optimistic");
        const meal = await c.from(table("nutrition_meals")).insert({
          user_id: uid(),
          travel_id: activeTravelId(),
          meal_date: selectedDateISO(),
          meal_type: mealType,
          label: food.name,
          notes: notesWithNutritionSyncId("", syncId),
          sync_id: syncId,
          water_ml: waterMl,
        }).select("id,user_id,travel_id,meal_date,meal_type,label,notes,water_ml,created_at,sync_id").single();
        if (meal.error) throw meal.error;
        let insertedItem = null;
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
          }).select("id,user_id,meal_id,food_key,label,grams,kcal,protein_g,carbs_g,fat_g,fiber_g,sort_order,created_at").single();
          if (item.error) throw item.error;
          insertedItem = item.data || null;
        }
        confirmNutritionRow(localRow, meal.data, insertedItem);
      } else if (CACHE.editingItemId) {
        const rows = loadLocalMeals();
        const edited = rows.map(row => {
          if (String(row.item?.id || "") !== String(CACHE.editingItemId)) return row;
          return {
            meal: { ...(row.meal || {}), meal_date: selectedDateISO(), meal_type: mealType, label: food.name, water_ml: waterMl },
            item: { ...(row.item || {}), food_key: food.key, label: food.name, grams, kcal: nut.kcal, protein_g: nut.protein, carbs_g: nut.carbs, fat_g: nut.fat, fiber_g: nut.fiber },
          };
        });
        saveLocalMeals(edited);
        CACHE.editingItemId = "";
      } else {
        saveLocalNutritionRowOnce(localRow);
        upsertOptimisticNutritionRow(localRow);
        enqueueNutritionSync();
      }
      try { if (typeof window.renderKPI === "function") window.renderKPI(); } catch (_) {}
      try { if (typeof window.tbSyncPreferenceDrivenNotifications === "function") window.tbSyncPreferenceDrivenNotifications(); } catch (_) {}
      try { if ((window.activeView || "") === "health") renderHealth("save"); } catch (_) {}
      renderNutrition("save");
      setTimeout(() => loadNutrition({ force: true }).then(() => {
        if ((window.activeView || "") === "nutrition") renderNutrition("save-refresh");
      }).catch(() => {}), 350);
    } catch (e) {
      CACHE.error = e?.message || String(e);
      if (!CACHE.editingItemId && isOfflineSkipError(e)) {
        saveLocalNutritionRowOnce(localRow);
        upsertOptimisticNutritionRow(localRow);
        enqueueNutritionSync();
        mergePendingNutritionRowsIntoCache();
      }
      renderNutrition("save-error");
    } finally {
      try { if (saveBtn) saveBtn.disabled = false; } catch (_) {}
    }
  }
  async function applyMealFavorite(index) {
    const fav = loadMealFavorites()[Math.max(0, Math.round(n(index, 0)))];
    if (!fav) return;
    const type = rootMealTypeValue() || fav.mealType || currentMealType();
    for (const entry of fav.items || []) {
      const food = foodByKey(entry.foodKey);
      if (!food) continue;
      const grams = Math.max(0, n(entry.grams, food.servingGrams || 100));
      const nut = nutritionForGrams(food, grams);
      const syncId = `nutrition_${Date.now()}_${Math.random().toString(16).slice(2)}`;
      const localRow = makeLocalNutritionRow({ food, grams, nut, waterMl: n(nut.waterMl, 0), mealType: type, syncId });
      saveLocalNutritionRowOnce(localRow);
      upsertOptimisticNutritionRow(localRow);
    }
    enqueueNutritionSync();
    renderNutrition("meal-favorite");
    syncLocalNutritionRows("meal-favorite", { forceOnline: true }).then(() => {
      loadNutrition({ force: true }).then(() => renderNutrition("meal-favorite-sync")).catch(() => {});
    }).catch(() => {});
  }
  function rootMealTypeValue() {
    return String(document.getElementById("nutrition-type")?.value || CACHE.selectedMealType || "");
  }
  async function saveWaterOnly(root) {
    const waterBtn = root?.querySelector("#nutrition-water-only");
    if (waterBtn) waterBtn.disabled = true;
    const water = n(root.querySelector("#nutrition-water-ml")?.value, 0) || 250;
    const c = client();
    const syncId = `nutrition_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const mealType = selectedMealType(root);
    const localRow = makeLocalNutritionRow({ food: { key: "water", name: txt("Eau", "Water") }, grams: 0, nut: {}, waterMl: water, mealType, label: txt("Eau", "Water"), syncId });
    try {
      if (c && uid()) {
        upsertOptimisticNutritionRow(localRow);
        renderNutrition("water-optimistic");
        const meal = await c.from(table("nutrition_meals")).insert({
          user_id: uid(),
          travel_id: activeTravelId(),
          meal_date: selectedDateISO(),
          meal_type: mealType,
          label: txt("Eau", "Water"),
          notes: notesWithNutritionSyncId("", syncId),
          sync_id: syncId,
          water_ml: water,
        }).select("id,user_id,travel_id,meal_date,meal_type,label,notes,water_ml,created_at,sync_id").single();
        if (meal.error) throw meal.error;
        confirmNutritionRow(localRow, meal.data, null);
      } else {
        saveLocalNutritionRowOnce(localRow);
        upsertOptimisticNutritionRow(localRow);
        enqueueNutritionSync();
      }
      await loadNutrition({ force: true });
      try { if (typeof window.renderKPI === "function") window.renderKPI(); } catch (_) {}
      try { if (typeof window.tbSyncPreferenceDrivenNotifications === "function") window.tbSyncPreferenceDrivenNotifications(); } catch (_) {}
      try { if ((window.activeView || "") === "health") renderHealth("water-only"); } catch (_) {}
      renderNutrition("water-only");
    } catch (e) {
      CACHE.error = e?.message || String(e);
      if (isOfflineSkipError(e)) {
        saveLocalNutritionRowOnce(localRow);
        upsertOptimisticNutritionRow(localRow);
        enqueueNutritionSync();
        mergePendingNutritionRowsIntoCache();
      }
      renderNutrition("water-error");
    } finally {
      try { if (waterBtn) waterBtn.disabled = false; } catch (_) {}
    }
  }
  async function saveSleep(root) {
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
    const c = client();
    if (c && uid()) {
      try {
        if (hours > 0) {
          const { error } = await c.from(table("nutrition_sleep")).upsert({
            user_id: uid(),
            sleep_date: nightDay,
            hours,
            quality,
            updated_at: new Date().toISOString(),
          }, { onConflict: "user_id,sleep_date" });
          if (error) throw error;
        } else {
          const { error } = await c.from(table("nutrition_sleep")).delete().eq("user_id", uid()).eq("sleep_date", nightDay);
          if (error) throw error;
        }
      } catch (e) {
        CACHE.error = e?.message || String(e);
      }
    }
    publishNutrition("sleep");
    try { if (typeof window.renderKPI === "function") window.renderKPI(); } catch (_) {}
    try { if (typeof window.tbSyncPreferenceDrivenNotifications === "function") window.tbSyncPreferenceDrivenNotifications(); } catch (_) {}
    try { if ((window.activeView || "") === "health") renderHealth("sleep"); } catch (_) {}
    renderNutrition("sleep");
  }
  async function deleteNutritionItem(id) {
    const key = String(id || "");
    if (!key) return;
    const c = client();
    const removedItem = CACHE.items.find(item => String(item.id || "") === key);
    CACHE.items = CACHE.items.filter(item => String(item.id || "") !== key);
    publishNutrition("delete-optimistic");
    renderNutrition("delete-optimistic");
    try {
      if (c && uid() && !key.startsWith("local_item_")) {
        const { error } = await c.from(table("nutrition_meal_items")).delete().eq("id", key).eq("user_id", uid());
        if (error) throw error;
      } else {
        saveLocalMeals(loadLocalMeals().filter(row => String(row.item?.id || "") !== key));
      }
      setTimeout(() => loadNutrition({ force: true }).then(() => {
        if ((window.activeView || "") === "nutrition") renderNutrition("delete-refresh");
      }).catch(() => {}), 250);
      try { if ((window.activeView || "") === "health") renderHealth("delete"); } catch (_) {}
      renderNutrition("delete");
    } catch (e) {
      if (removedItem) CACHE.items.unshift(removedItem);
      CACHE.error = e?.message || String(e);
      renderNutrition("delete-error");
    }
  }

  window.renderNutrition = renderNutrition;
  window.renderHealth = renderHealth;
  window.tbLoadHealthGoal = loadNutritionGoal;
  window.tbSaveHealthGoal = saveNutritionGoal;
  window.tbHealthGoalTargets = function tbHealthGoalTargets(spentKcal, kg) {
    return nutritionGoalTargets(spentKcal, kg || bodyWeight());
  };
  window.tbReloadNutrition = async function tbReloadNutrition() {
    await loadNutrition({ force: true });
    return { meals: CACHE.meals.slice(), items: CACHE.items.slice() };
  };
  window.addEventListener("tb:auth_scope_changed", () => {
    if (typeof nutritionStore()?.resetAccountScope === "function") nutritionStore().resetAccountScope();
    else { CACHE.loaded = false; CACHE.meals = []; CACHE.items = []; }
  });
  try { document.addEventListener("tb:refresh:data_loaded", () => { try { window.tbReloadNutrition(); } catch (_) {} }); } catch (_) {}
  try { window.addEventListener("tb:offline_state_changed", (ev) => { if (ev?.detail?.offline === false) syncLocalNutritionRows("online").then(() => loadNutrition({ force: true })).catch(() => {}); }); } catch (_) {}
  window.tbNutritionSyncLocal = syncLocalNutritionRows;
  window.tbNutritionDiscardPending = discardAllLocalNutritionRows;
  setTimeout(() => { try { if (uid()) loadNutrition().catch(() => {}); } catch (_) {} }, 450);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ensureNutritionShell);
  else ensureNutritionShell();
})();
