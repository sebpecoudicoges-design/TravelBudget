# TravelBudget V11 - checklist de simplification

Objectif : rendre le projet plus lisible, plus testable et plus rapide sans reecriture brutale ni regression fonctionnelle.

## Regles du chantier

- [x] Conserver la migration progressive Vite + modules ES.
- [x] Mesurer l'existant avant de supprimer : 59 scripts legacy, environ 2,5 Mo de JavaScript.
- [ ] Ne plus ajouter de nouvelle regle metier dans `public/legacy/js`.
- [ ] Chaque extraction doit avoir des tests avant suppression du code historique.
- [ ] Une seule source de verite par calcul, synchronisation ou format de donnee.
- [ ] Mettre a jour cette checklist a chaque lot livre.

## Chantier 1 - Budget journalier et transactions

- [x] Creer `src/core/dailyBudgetRules.js` avec des fonctions pures.
- [x] Centraliser l'eligibilite budget, les mouvements internes et les parts Trip.
- [x] Centraliser la repartition d'une depense sur plusieurs jours.
- [x] Faire deleguer les helpers legacy au nouveau coeur.
- [x] Faire utiliser le meme recapitulatif par Dashboard et KPI.
- [x] Supprimer les calculs concurrents devenus inutiles.
- [x] Tester les depenses Trip, les depenses multi-jours et le patrimoine.
- [x] Verifier toute la suite de tests et le build de production.

Critere de fin : Dashboard, KPI et detail journalier lisent le meme resultat, et une depense Trip ne peut pas etre comptee deux fois.

## Chantier 2 - Couche de donnees et synchronisation

- [ ] Creer un repository commun Supabase/local pour les lectures et ecritures.
- [ ] Centraliser la file hors ligne, les retries et l'idempotence.
- [ ] Definir un format canonique pour transactions, repas et seances.
- [ ] Remplacer les caches locaux disperses par un store explicite.
- [ ] Ajouter des tests de reconnexion, doublon et conflit.

## Chantier 3 - Composants UI partages

- [ ] Extraire modales, boutons, champs, onglets, cartes KPI et graphiques.
- [ ] Centraliser les etats chargement, vide, erreur et hors ligne.
- [ ] Supprimer les styles inline repetes.
- [ ] Verifier mobile, tablette et grand ecran avec Playwright.

## Chantier 4 - Decoupage par domaine

- [ ] Trip : separer regles, repository, store et vues.
- [ ] Sport : separer bibliotheque, programme, timer, historique et calculs.
- [ ] Nutrition : separer catalogue, journal, objectifs et historique.
- [ ] Sante : separer score, tendances et saisies corporelles.
- [ ] Travail : separer periodes, missions, revenus et graphiques.
- [ ] Patrimoine : separer actifs, cout mensuel et integration budget.

## Chantier 5 - Performance et chargement

- [ ] Charger Dashboard et Settings au demarrage uniquement.
- [ ] Charger Trip, Sport, Nutrition, Sante et Travail a l'ouverture.
- [ ] Decouper les gros bundles par domaine.
- [ ] Mesurer temps de demarrage, taille du bundle et memoire mobile.

## Chantier 6 - Qualite et livraison

- [ ] Ajouter lint et formatage sans reformatage massif initial.
- [ ] Fixer un budget de taille par module.
- [ ] Ajouter les parcours critiques Playwright.
- [ ] Documenter architecture, conventions et procedure de migration.
- [ ] Retirer un fichier legacy uniquement quand son remplacement est valide.
- [ ] Maintenir `public/projet.html`, l'APK et Git a chaque livraison.

## Indicateurs

| Indicateur | Depart | Cible V11 |
| --- | ---: | ---: |
| Scripts legacy charges au demarrage | 59 | moins de 15 |
| JavaScript legacy | environ 2,5 Mo | moins de 1 Mo |
| Fichiers de plus de 2 000 lignes | 6 | 0 |
| Sources de calcul du budget journalier | 3 | 1 |
| Domaines charges a la demande | 0 | 5 |
