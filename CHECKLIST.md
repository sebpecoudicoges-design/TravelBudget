## MAJ - Suivi (à cocher à chaque itération)

> Règles de travail (toujours vraies)
- [ ] Je reçois **soit** un ZIP complet (sans `.git`) **soit** uniquement le/les fichiers modifiés à remplacer.
- [ ] Je reçois les **commandes git** pour `add/commit/push`.
- [ ] **Zéro régression** : si un bug est corrigé, il ne revient pas.

### Roadmap (ordre imposé)

#### 1) Flux applicatifs (auth / sessions / chargement / FX)
- [ ] Réduire le temps de chargement (requêtes Supabase + rendu)
- [ ] Stabiliser auth + session (post-invite/recovery inclus)
- [ ] **FX source unique** (Edge `fx-latest`) + **MAJ quotidienne** (silent)

#### 2) Modèle de données (SQL)
- [x] Recevoir le SQL manquant : **RLS policies**, **indexes**, **functions/RPC**
- [ ] Corriger proprement : devises (checks), indexes perf, cohérence settings/periods

#### 3) Edge Functions (admin + fx)
- [ ] Durcir CORS (allowlist)
- [ ] Valider `redirectTo` (allowlist) sur les liens invite/recovery
- [ ] Logging minimal + rate-limit (si nécessaire)

#### 4) Points durs legacy (risques + conventions)
- [ ] Burn = **dépenses payées/jour** uniquement (définition unique)
- [ ] Séparer clairement Burn réel vs Burn budget (si affiché)

#### 5) Maintenance / Core extraction
- [ ] Mettre à jour cette checklist au fil des versions
- [ ] Extraire progressivement `Core.money` et `Core.tripRules` (testés)

---

## Journal des MAJ (à cocher quand c'est déployé/testé)

- [x] **6.6.55** — Retry RPC (stabilité réseau) + aucune régression
- [ ] **6.6.56** — Patch DB : devises ISO3 + verrouillage `profiles.role` (anti self-admin)
- [ ] **6.6.58** — FX Option A : source unique `fx-latest` (UI + onboarding), refresh quotidien silencieux, suppression des prompts, guard idle

- [ ] **6.6.67** — Périodes (segments) :
  - [ ] Bouton **Ajouter une période** → modal d’insertion (découpe automatique)
  - [ ] **Zéro trou** : la modification des dates d’un segment adapte les voisins (continuité)
  - [ ] Suppression UI du **Split** (workflow unique)
  - [ ] `sort_order` recalculé automatiquement après modifications

---

# TravelBudget — Smoke checklist (à chaque zip)

## 0) Boot
- [ ] `npm install` passe sans erreur
- [ ] `npm run build` passe sans erreur
- [ ] `npm run dev` démarre sans erreur
- [ ] `npm test` / `vitest run` passe, ou l’échec est diagnostiqué comme environnemental avant livraison
- [ ] Console: aucune erreur rouge au chargement
- [ ] Dans la console: `TB_DOCTOR()` => `ok: true`

## 1) Navigation
- [ ] Dashboard / Transactions / Settings / Trip / Membres: chaque onglet s’ouvre
- [ ] Aucun écran blanc

## 2) Settings
### Périodes
- [ ] Changer période active => dashboard se met à jour

### Segments
- [ ] Split segment (date strictement entre start/end) => 2 segments créés
- [ ] Edit devise/budget/jour + Enregistrer => dashboard “Aujourd’hui” reflète la devise du segment du jour

### Catégories
- [ ] Les catégories existantes + couleurs apparaissent
- [ ] Changer couleur => persiste après refresh
- [ ] Ajouter / supprimer => OK (et pas de crash)

## 3) Dashboard
- [ ] KPI “Aujourd’hui”, “Pilotage”, “Trésorerie” utilisent tous la devise du segment du jour
- [ ] Pas de valeurs absurdes (NaN / Infinity)

## 4) Transactions
- [ ] Ajout transaction (devise ≠ segment) => conversion OK dans les KPI

## 5) Trip
- [ ] L’onglet s’ouvre et n’affiche pas d’erreur console


## MAJ 6.6.68
- [ ] Settings voyages/segments: calendrier + modal + RLS/constraints fixes
- [ ] Ajouter voyage: dates non chevauchantes
- [ ] Ajouter période: split + fx_mode live_ecb


## Discipline versioning projet
- Mettre à jour `00_constants.js` / `window.__TB_BUILD` à chaque livraison.
- Réaligner `package.json` quand la version projet évolue.
- Réaligner le label d'entrée / build dans `src/main.js` si nécessaire.
- Mettre à jour `CHECKLIST.md` quand elle dérive du socle projet réel.
- Toujours réaligner ensemble :
  - `public/legacy/js/00_constants.js` (`window.__TB_BUILD`)
  - `package.json`
  - `package-lock.json`
  - `src/main.js` si le label d’entrée/version dérive
  - la checklist projet si elle n’est plus alignée


## V9.2.6

- Analyse : chargement multi-périodes du voyage actif (transactions + budget_segments)
- Sous-catégories : lecture bootstrap + modal transaction + récurrences
- SQL : sécurisation RLS de category_subcategories

## V9.2.5
- Nouvelle page Analyse budget dédiée (ECharts) sans modification du bloc KPI dashboard.
- Vérifier la navigation Analyse, les filtres voyage/période/périmètre et le rendu des graphiques modernes.


## V9.2.6.10
- Fix modal transaction add/edit crash (`tx is not defined`).
- Budget Analysis period selector now follows budget segments, so past/current/future periods reappear and active period no longer collapses to whole trip.
- Subcategory selects now fall back to existing transaction/rule values when the SQL table is empty or not yet populated.


## V9.2.7.3
- Settings catégories : afficher aussi les sous-catégories existantes issues du catalogue/fallback, avec action d'enregistrement SQL.
- Analyse : retirer le comportement sticky de la barre de filtres.
- Vérifier 00_constants.js, package.json, package-lock.json et src/main.js alignés sur 9.2.7.3.

- [x] **9.2.7.2** — Sous-catégories : ordre utilisateur haut/bas avec persistance SQL
- [x] **9.2.7.3** — Transactions : multi-sélection + recatégorisation / sous-catégorisation en masse

## Discipline UI / constantes
- Centralisation via `TB_CONST` si concerné.
- Aide utilisateur à jour si impact UI.
- Vérification UI FR/EN si un libellé, un bouton, un titre ou un texte change.
- Labels / titres / descriptions FR/EN réalignés si une feature UI change.


## V9.3.11.0
- Création guidée catégorie/sous-catégorie avec choix de mapping analytique à la création.
- Write-path analytique centralisé via RPC `save_analytic_mapping_rule` avec fallback front tolérant.
- `schema_version` attendu = `93110`.
- Vérifier zéro régression sur Settings > Catégories / Sous-catégories et Analyse.


## Notes V9.3.11.1
- Les catégories doivent rester strictement user-scoped en SQL : plus de restauration générique depuis localStorage.
- Si un compte n'a aucune catégorie SQL, le bootstrap peut déclencher un seed SQL utilisateur (`seed_default_categories_for_user`).
- La suppression d'une catégorie doit supprimer aussi le bundle lié : sous-catégories SQL + règles analytiques.


## Lot courant
- V9.4.0 : framework mode simple / avancé.
- V9.4.1 : correctif cashflow curve sur scope date à date (budgets/jour par date + conversion homogène).
- V9.4.1.4 : fiabilisation du solde réel historique de la courbe cashflow (impact wallet au jour de transaction, sans répartition budgétaire).
- Vérifier explicitement le switch de compte sans hard refresh.
- Vérifier le rechargement propre après SIGNED_OUT / SIGNED_IN.
