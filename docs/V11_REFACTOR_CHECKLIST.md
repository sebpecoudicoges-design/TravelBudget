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

- [x] Creer un repository commun Supabase/local pour les lectures et ecritures.
- [x] Centraliser la file hors ligne, les retries et l'idempotence.
- [x] Definir un format canonique pour transactions, repas et seances.
- [x] Introduire un store explicite et y migrer l'etat de la file hors ligne.
- [ ] Migrer les caches locaux Sport, Nutrition et Trip pendant leur decoupage par domaine.
- [x] Ajouter des tests de reconnexion, doublon et conflit.
- [x] Recuperer automatiquement un quota local sature sans supprimer les mutations, repas ou seances en attente.

Critere de fin du socle : une action en erreur reste rejouable sans bloquer les suivantes, les doublons possedent une protection locale et serveur, et les nouveaux modules passent par `src/data`.

## Chantier 3 - Composants UI partages

- [x] Creer le socle partage pour modales et etats chargement, vide, erreur et hors ligne.
- [x] Migrer la fenetre Sport `Ajuster` vers la modale partagee.
- [x] Retirer les styles inline structurels de cette fenetre et de ses lignes de series.
- [x] Verifier cette modale sur desktop et mobile avec Playwright, sans debordement horizontal.
- [x] Migrer la fenetre Sport de creation/modification des seances parametrees vers la modale partagee.
- [x] Verifier cette deuxieme modale sur mobile, tablette et grand ecran, avec focus et fermeture clavier.
- [x] Migrer les formulaires Travail Mission, Revenu et Periode vers la modale partagee.
- [x] Verifier les trois formulaires Travail sur mobile, tablette et grand ecran, avec soumission et erreurs integrees.
- [x] Migrer les cinq fenetres Patrimoine : actif, proprietaires, transfert, vente et documents.
- [x] Retablir l'ouverture du transfert et rendre les documents lies consultables depuis l'instantane hors ligne.
- [x] Verifier Patrimoine sur mobile, tablette et grand ecran, avec footer, focus et fermeture clavier.
- [x] Migrer la fenetre Transactions creation, modification et duplication vers la modale partagee.
- [x] Supprimer l'ancien couple global overlay/modal et adapter le rendu mobile Capacitor.
- [x] Verifier les categories dynamiques, le verrou Trip et les trois formats d'ecran.
- [x] Migrer les formulaires Settings Voyage, Periode, Categorie et Sous-categorie vers la modale partagee.
- [x] Supprimer l'ancien helper `#tb-modal` et gerer focus, clavier, attente et annulation avec le composant commun.
- [x] Migrer les fenetres Trip Depense, Rapprochement, Reglement, Detail et Documents vers la modale partagee.
- [x] Verifier les cinq fenetres Trip sur mobile, tablette et grand ecran.
- [ ] Migrer les autres modales, boutons, champs, onglets, cartes KPI et graphiques.
- [x] Verifier les composants suivants sur mobile, tablette et grand ecran.

Critere du premier lot : un composant partage doit etre utilise par un vrai parcours, accessible, responsive et teste avant la migration de la fenetre suivante.

## Chantier 4 - Decoupage par domaine

- [x] Trip : creer un repository dedie et y migrer le chargement de l'agregat actif.
- [x] Trip : extraire le store, la normalisation SQL et l'hydratation offline de l'agregat actif.
- [x] Trip : migrer les mutations Groupe et Participants vers le repository dedie.
- [x] Trip : migrer les reglements et les suppressions/deplacements de depenses vers le repository.
- [x] Trip : migrer l'upsert, la lecture, la deduplication offline et les liens Depense-Transaction.
- [x] Trip : extraire les vues Invitations et Formulaire Depense dans un module pur teste.
- [x] Trip : separer regles, repository, store et vues.
- [x] Sport : separer bibliotheque, programme, timer, historique et calculs.
  - [x] Extraire le catalogue fallback, les MET, familles, materiels et charges de reference.
  - [x] Extraire les regles de cycle A/B, semaine planifiee, jours de repos et correspondance des seances.
  - [x] Extraire la construction serie/repos et l'insertion d'une serie au bon exercice.
  - [x] Unifier la finalisation et les payloads d'historique entre sauvegarde immediate et resynchronisation.
  - [x] Centraliser historique, creation, deduplication, suppression et modification de date dans `src/data/sportRepository.js`.
  - [x] Extraire le store Sport et migrer plan, historique local, hydratation offline/SQL et suppressions en attente vers `entityStore`.
  - [x] Extraire les vues Timer et Historique hors du fichier legacy.
  - [x] Extraire la vue de la fenetre `Ajuster` hors du fichier legacy.
  - [x] Extraire les regles pures de la fenetre `Ajuster` : renumerotation, suppression et ajout de series.
  - [x] Extraire les regles du radar forces/faiblesses et durcir les comparaisons par axe.
  - [x] Extraire la vue du profil forces/faiblesses et de la modale impedancemetre.
  - [x] Extraire les handlers du timer : demarrage, serie terminee, repos, pause, ajout de serie et ajout de tour circuit.
  - [x] Transformer le radar en profil athletique : percentiles, ratios PDC, equilibres, potentiel, archetypes et priorite automatique.
- [x] Nutrition : separer catalogue, journal, objectifs et historique.
  - [x] Extraire les regles pures du catalogue, des totaux par repas, du journal quotidien, des objectifs et des cibles par moment.
  - [x] Extraire le socle repository local/offline Nutrition : cache aliments, lignes locales, sync_id, sommeil et erreurs de synchro.
  - [x] Extraire le repository Nutrition : aliments, repas, items, sommeil et synchro offline.
  - [x] Extraire le store Nutrition : cache aliments, date selectionnee, repas locaux et publication KPI.
  - [x] Extraire les vues Nutrition : saisie, timeline, historique, eau, sommeil et objectif.
    - [x] Extraire les composants de vue : barres, chips favoris/recents, suggestions repas, semaine et timeline repas.
    - [x] Extraire les panneaux de vue : saisie rapide, hydratation, sommeil et historique semaine.
    - [x] Extraire les vues objectif et alcool : cockpit objectif, moyenne 7 jours et barres alcool hebdomadaires.
- [x] Sante : supprimer le chantier autonome et garder les indicateurs dans Nutrition, Sport, Travail, notifications et KPI.
  - [x] Retirer l'onglet, la vue et le rendu Sante autonomes du runtime ; rediriger les anciens appels vers Nutrition.
- [x] Travail : separer periodes, missions, revenus et graphiques.
  - [x] Extraire le rendu du parcours professionnel : fresque, KPI, missions, revenus, periodes et dossiers lies.
- [x] Patrimoine : separer actifs, cout mensuel et integration budget.
  - [x] Extraire la carte actif : valeur, amortissement, cout mensuel budget, proprietaires, evenements, documents, actions et P&L realise.
  - [x] Extraire les formulaires actif et proprietaires vers `assetView`.
  - [x] Extraire les formulaires transfert, vente et documents vers des vues pures testees.
  - [x] Lier assets, transactions et depenses Trip avec exclusion budget optionnelle pour eviter le double comptage achat/amortissement.

## Audit transversal - Regles recurrentes

- [x] Resoudre automatiquement la periode budget depuis la date de chaque occurrence.
- [x] Preserver les dates budget personnalisees, y compris les repartitions sur plusieurs jours.
- [x] Reparer les occurrences generees non payees apres une modification des periodes.
- [x] Conserver les occurrences confirmees comme historique immuable.
- [x] Faire respecter `max_occurrences` pendant la generation SQL.
- [x] Afficher et valider la couverture des periodes budget dans le formulaire de regle.
- [x] Verifier les regles existantes et leurs occurrences directement sur la base distante.

## Chantier 5 - Performance et chargement

- [x] Charger Dashboard et Settings au demarrage uniquement.
- [x] Charger Trip, Sport, Nutrition et Travail a l'ouverture.
- [x] Lancer le chargement differe pilote pour Patrimoine : `41_assets_core.js` et `42_assets_ui.js` charges a l'ouverture de l'onglet.
  - [x] Sortir Nutrition du boot : `48_nutrition_ui.js` charge au premier affichage de l'onglet Alimentation.
  - [x] Sortir Travail du boot : `47_work_ui.js` et `50_work_career_ui.js` charges au premier affichage de l'onglet Travail.
  - [x] Sortir Trip du boot : `29_trip_v1.js` et `30_members_admin.js` charges au premier affichage de Partage ou Membres.
  - [x] Sortir Sport du boot : `45_sport_ui.js` charge au premier affichage de l'onglet Sport, avec replay offline qui charge le domaine avant synchro.
  - [x] Sortir Notifications du boot : `49_notifications_ui.js` charge au premier affichage de l'onglet Notifications.
  - [x] Sortir Documents et Cautions du boot : `43_documents_ui.js` et `46_cautions_ui.js` chargent au premier affichage, avec liens Patrimoine/Inbox compatibles lazy.
  - [x] Sortir la FAQ Aide du boot : `31_help_faq.js` charge a l'ouverture de l'onglet Aide, tout en gardant l'assistant et le guide global au demarrage.
- [ ] Decouper les gros bundles par domaine.
  - [x] Extraire le shell visuel Settings : hero, resumes de cartes et accordéons quittent `14_settings_periods_ui.js` vers `src/features/settings/settingsView.js`.
  - [x] Extraire le rendu du panneau Compte Settings : profil, santé, devise, mode UI, seuil cashflow et raccourcis notifications quittent le template inline legacy.
  - [x] Extraire les handlers Compte Settings : hydratation profil, WhatsApp, santé, devise, mode UI, reset mot de passe, notifications et seuil cashflow passent dans `settingsAccountController.js`.
  - [x] Extraire le rendu FX manuel Settings : normalisation des taux, badges, tableau, actions stables et etat vide passent dans `settingsView.js`.
  - [x] Extraire le rendu des cartes Periode Settings : entete, recap, edition budget/devise, reference pays et actions passent dans `settingsView.js`.
  - [x] Supprimer l'ancien rendu FX manuel inline `renderManualFxBox`, remplace par le panneau Settings deja extrait et teste.
  - [x] Extraire le rendu Reference de periode Settings : pays, recommandation, prevu, ecart, postes et actions passent dans `settingsView.js`.
  - [x] Extraire l'overview Voyage Settings : resume voyage, reference, cadence, champs editables et postes quittent `14_settings_periods_ui.js`.
  - [x] Demarrer l'extraction Dashboard : le rendu onboarding quitte `12_dashboard_render.js` vers `dashboardView.js`.
- [x] Mesurer temps de demarrage, taille du bundle et memoire mobile.

## Chantier 6 - Qualite et livraison

- [x] Ajouter lint et formatage sans reformatage massif initial.
- [x] Fixer un budget de taille par module.
- [x] Ajouter les parcours critiques Playwright.
- [x] Documenter architecture, conventions et procedure de migration.
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
