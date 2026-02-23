# TravelBudget — Smoke checklist (à chaque zip)

## 0) Boot
- [ ] `npm run dev` démarre sans erreur
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
