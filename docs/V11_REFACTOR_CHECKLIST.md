# TravelBudget V11 - checklist de simplification

Objectif : rendre le projet plus lisible, plus testable et plus rapide sans reecriture brutale ni regression fonctionnelle.

## Regles du chantier

- [x] Conserver la migration progressive Vite + modules ES.
- [x] Mesurer l'existant avant de supprimer : 59 scripts legacy, environ 2,5 Mo de JavaScript.
- [x] Ne plus ajouter de nouvelle regle metier dans `public/legacy/js`.
- [ ] Chaque extraction doit avoir des tests avant suppression du code historique.
- [ ] Une seule source de verite par calcul, synchronisation ou format de donnee.
  - [x] Aligner les calories d'activite KPI sur le loader transversal Sport/Travail deja utilise par Nutrition.
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
- [x] Migrer les caches locaux Sport, Nutrition et Trip pendant leur decoupage par domaine.
  - [x] Centraliser le voyage Trip actif et l'onglet Trip dans `tripStore`, avec fallbacks legacy limites.
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
- [x] Trip : rendre le split Montants intelligent avec reste partage automatiquement entre les participants non saisis.
- [x] Trip : extraire le panneau d'aide contexte vers `tripView` et supprimer le `onclick` inline associe.
- [x] Trip : extraire la carte d'audit des liens budget/transactions vers `tripView`.
- [x] Trip : extraire le contenu de la fenetre Documents de depense vers une vue chargee a la demande.
  - [x] Extraire le rendu des onglets Recap/Historique vers `tripView`.
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
  - [x] Ajouter le chrono libre : choix d'exercice, grand ecran, persistance locale, notification arriere-plan, saisie reps/charge/distance et sauvegarde historique.
  - [x] Extraire le CSS mobile/fullscreen Sport Capacitor vers `sport_mobile.css`.
  - [x] Extraire le CSS general Sport vers `sport.css` et supprimer le style inline du legacy.
  - [x] Realigner le programme SQL A/B en trois dominantes : Poussee, Chaine posterieure et Variantes.
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
  - [x] Sortir Analyse du boot : filtres, tiroir et page Analyse chargent a l'ouverture, avec modules Vite Analyse importes a la demande.
  - [x] Sortir Cashflow du boot : `27_cashflow_curve.js` charge a la demande sur Dashboard via `tbEnsureCashflowCurve`, avec theme, KPI, boot-release et navigation compatibles lazy.
  - [x] Ajouter un loader transversal Sport/Travail leger pour que Nutrition, KPI et notifications lisent les calories d'activite sans ouvrir les onglets Sport ou Travail.
- [ ] Decouper les gros bundles par domaine.
  - [x] Extraire le shell visuel Settings : hero, resumes de cartes et accordéons quittent `14_settings_periods_ui.js` vers `src/features/settings/settingsView.js`.
  - [x] Extraire le rendu du panneau Compte Settings : profil, santé, devise, mode UI, seuil cashflow et raccourcis notifications quittent le template inline legacy.
  - [x] Extraire les handlers Compte Settings : hydratation profil, WhatsApp, santé, devise, mode UI, reset mot de passe, notifications et seuil cashflow passent dans `settingsAccountController.js`.
  - [x] Extraire le rendu FX manuel Settings : normalisation des taux, badges, tableau, actions stables et etat vide passent dans `settingsView.js`.
  - [x] Extraire le rendu des cartes Periode Settings : entete, recap, edition budget/devise, reference pays et actions passent dans `settingsView.js`.
  - [x] Supprimer l'ancien rendu FX manuel inline `renderManualFxBox`, remplace par le panneau Settings deja extrait et teste.
  - [x] Extraire le rendu Reference de periode Settings : pays, recommandation, prevu, ecart, postes et actions passent dans `settingsView.js`.
  - [x] Extraire l'overview Voyage Settings : resume voyage, reference, cadence, champs editables et postes quittent `14_settings_periods_ui.js`.
  - [x] Extraire le rendu Categories/Sous-categories Settings : cartes, actions, mapping analytique et sous-listes quittent `14_settings_periods_ui.js`.
  - [x] Demarrer l'extraction Dashboard : le rendu onboarding quitte `12_dashboard_render.js` vers `dashboardView.js`.
  - [x] Demarrer l'extraction Analyse : l'overview de lecture quitte `33_budget_analysis.js` vers `analysisView.js`.
  - [x] Extraire les insights Analyse : messages de tendance, reference, categorie dominante et projection quittent `33_budget_analysis.js`.
  - [x] Extraire le panneau Analyse Transports de nuit : economies potentielles, moyenne et lignes detaillees quittent `33_budget_analysis.js`.
  - [x] Extraire la liste Analyse Sous-categories : lignes cliquables, montants et etat vide quittent `33_budget_analysis.js`.
  - [x] Extraire le panneau Analyse Reference pays : resume, contexte, grille de comparaison et etat vide quittent `33_budget_analysis.js`.
  - [x] Extraire les options ECharts Analyse : trajectoire, categories, cadence et heatmap quittent `33_budget_analysis.js`.
  - [x] Extraire les filtres Analyse : options categorie/sous-categorie, resume et chips d'exclusion quittent `33_budget_analysis.js` vers `33_analysis_filter_view.js`.
  - [x] Extraire le tiroir de transactions Analyse : CSS, titre, et lignes de detail quittent `33_budget_analysis.js` vers `33_analysis_drilldown_view.js`.
  - [x] Extraire les options de periode Analyse : periode active, tout le voyage, periodes datees et date-a-date passent dans `33_analysis_filter_view.js`.
  - [x] Extraire les cartes de progression Analyse : cartes liquides, delta budget/reference et assemblage quittent `33_budget_analysis.js` vers `analysisView.js`.
  - [x] Extraire les panneaux Analyse cashflow et tresorerie pure : lecture projetee, reste budget, categories cash et couverture quittent `33_budget_analysis.js`.
  - [x] Nettoyer Dashboard : supprimer le rendu wallet activity duplique et les helpers morts associes, avec contrat anti-doublon.
  - [x] Extraire les etats d'aide et d'onboarding Dashboard : aide contexte, etat aucun wallet et onboarding rapide quittent `12_dashboard_render.js`.
  - [x] Extraire le rendu des cartes wallet Dashboard : contenu, actions, archive et barre budget quittent `12_dashboard_render.js`.
  - [x] Extraire le rendu du budget journalier Dashboard : controles de periode et lignes jour quittent `12_dashboard_render.js`.
  - [x] Extraire les dialogues wallet Dashboard : creation, edition et correction des types quittent `12_dashboard_render.js`.
  - [x] Extraire le rendu des transactions recentes des cartes wallet Dashboard vers `dashboardView.js`.
  - [x] Extraire la barre d actions Wallet Dashboard : creation, transfert interne, archives et correction des types quittent `12_dashboard_render.js`.
  - [x] Supprimer l'ancien rendu onboarding Dashboard mort, remplace par le rendu delegue unique.
  - [x] Supprimer le double rendu KPI pendant `renderWallets`, avec contrat anti-retour.
  - [x] Extraire le rendu visuel KPI Sante et les styles responsive KPI vers `kpiView.js`.
  - [x] Extraire le detail des projections KPI impayees et Trip vers `kpiView.js`.
  - [x] Extraire les mini-cartes KPI repetees vers `kpiView.js`.
  - [x] Extraire le panneau KPI Aujourd'hui, pilotage et cash vers `kpiView.js`.
  - [x] Extraire l'en-tete KPI, le selecteur date-a-date et le convertisseur FX vers `kpiView.js`.
  - [x] Durcir le boot mobile : le module KPI et sa CSS publique ne bloquent plus l'ecran de chargement.
  - [x] Extraire le detail du budget du jour KPI vers `kpiView.js`.
  - [x] Extraire le toggle KPI des impayes/projections vers `kpiView.js`.
  - [x] Extraire les options de portee KPI, segments et date-a-date vers `kpiView.js`.
  - [x] Extraire le layout principal KPI vers `kpiView.js`.
  - [x] Extraire l'option Voyage actif KPI vers `kpiView.js`.
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
