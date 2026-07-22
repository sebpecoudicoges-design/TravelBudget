# TravelBudget V11 - checklist de simplification

Objectif : rendre le projet plus lisible, plus testable et plus rapide sans reecriture brutale ni regression fonctionnelle.

## Regles du chantier

- [x] Conserver la migration progressive Vite + modules ES.
- [x] Mesurer l'existant avant de supprimer : 59 scripts legacy, environ 2,5 Mo de JavaScript.
- [x] Ne plus ajouter de nouvelle regle metier dans `public/legacy/js`.
- [ ] Chaque extraction doit avoir des tests avant suppression du code historique.
- [ ] Une seule source de verite par calcul, synchronisation ou format de donnee.
  - [x] Aligner les calories d'activite KPI sur le loader transversal Sport/Travail deja utilise par Nutrition.
- [x] Mettre a jour cette checklist a chaque lot livre.
- [x] Ajouter a chaque livraison une verification utilisateur simple : ecran a ouvrir, action a faire, resultat attendu, console attendue si pertinent.
- [x] Remplacer la liste brute des APK de `public/projet.html` par une fresque chronologique interactive, detaillee et filtrable.
- [x] Realigner le contrat Settings Modal sur les modules extraits et verifier la suite complete : 89 fichiers, 459 tests.
- [x] Extraire les interactions KPI date-a-date, scope, impayes et convertisseur FX vers un controleur module, avec tests.
- [x] Sortir FX Decision du boot et le charger avec le domaine Analyse : boot legacy 1085.3 -> 1044.9 KiB.
- [x] Extraire les regles Wallet Dashboard : validation creation/edition, type automatique et libelles passent dans `dashboardWalletRules.js`.
- [x] Extraire les payloads Wallet Dashboard : creation, edition, archivage, suppression et correction de types passent dans `dashboardWalletRules.js`.
- [x] Extraire les regles KPI Sante/Nutrition/Sommeil/Alcool vers `kpiHealthRules.js`.
- [x] Extraire les helpers KPI budget/cash/trip pending vers `kpiHealthRules.js`.
- [x] Extraire les regles KPI projection impayes, regroupement Trip et format de montants vers `kpiProjectionRules.js`.
- [x] Extraire les regles KPI scope date-a-date, horizon, pastilles cash et signe vers `kpiProjectionRules.js`.
- [x] Extraire les regles KPI wallets cash, conversion fiable, runway et couverture prudente vers `kpiCashRules.js`.
- [x] Extraire les calculs KPI budget restant, impayes nets, wallets display et soldes Trip pivot vers `kpiProjectionRules.js`.
- [x] Ajouter un espace de retours membres admins avec fichier stable `docs/ADMIN_TEST_RETURNS.md`.

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
- [x] Migrer les autres modales prioritaires, boutons, champs, onglets, cartes KPI et graphiques vers les composants partages ou les vues de domaine.
- [x] Migrer la fenetre Regles recurrentes vers la modale partagee.
- [x] Verifier les composants suivants sur mobile, tablette et grand ecran.

Critere ferme : les parcours critiques Dashboard, KPI, Settings, Transactions, Trip, Sport, Travail, Patrimoine et Regles recurrentes utilisent les composants partages ou des vues de domaine testees. Les micro-composants restants relevent maintenant du decoupage performance/qualite.

## Chantier 4 - Decoupage par domaine

- [x] Trip : creer un repository dedie et y migrer le chargement de l'agregat actif.
- [x] Trip : extraire le store, la normalisation SQL et l'hydratation offline de l'agregat actif.
- [x] Trip : migrer les mutations Groupe et Participants vers le repository dedie.
- [x] Trip : migrer les reglements et les suppressions/deplacements de depenses vers le repository.
- [x] Trip : migrer l'upsert, la lecture, la deduplication offline et les liens Depense-Transaction.
- [x] Trip : extraire les vues Invitations et Formulaire Depense dans un module pur teste.
- [x] Trip : rendre le split Montants intelligent avec reste partage automatiquement entre les participants non saisis.
  - [x] Extraire le rendu des participants du split Trip vers `tripView`, avec hooks stables et contrat anti-retour legacy.
  - [x] Extraire le tableau Equal/Pourcentage/Montant du split Trip vers `tripView`, en gardant calculs et evenements dans le legacy.
  - [x] Extraire le rendu Analyse Trip categories/participants vers `tripView`, avec contrat anti-retour legacy.
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
  - [x] Extraire les options du builder Sport vers `sportFormView.js` : objectifs, niveaux, familles, durees, formats, materiels et exercices.
- [x] Nutrition : separer catalogue, journal, objectifs et historique.
  - [x] Extraire les regles pures du catalogue, des totaux par repas, du journal quotidien, des objectifs et des cibles par moment.
  - [x] Extraire le socle repository local/offline Nutrition : cache aliments, lignes locales, sync_id, sommeil et erreurs de synchro.
  - [x] Extraire le repository Nutrition : aliments, repas, items, sommeil et synchro offline.
  - [x] Extraire le store Nutrition : cache aliments, date selectionnee, repas locaux et publication KPI.
  - [x] Extraire les vues Nutrition : saisie, timeline, historique, eau, sommeil et objectif.
    - [x] Extraire les composants de vue : barres, chips favoris/recents, suggestions repas, semaine et timeline repas.
    - [x] Extraire les panneaux de vue : saisie rapide, hydratation, sommeil et historique semaine.
    - [x] Extraire les vues objectif et alcool : cockpit objectif, moyenne 7 jours et barres alcool hebdomadaires.
  - [x] Extraire le panneau Synchro alimentation en attente vers `nutritionView.js`, avec actions sync/vider/supprimer conservees.
  - [x] Extraire le shell principal Nutrition vers `nutritionView.js` : en-tete, anneau kcal, macros, objectif, comparaison et slots de panneaux.
- [x] Sante : supprimer le chantier autonome et garder les indicateurs dans Nutrition, Sport, Travail, notifications et KPI.
  - [x] Retirer l'onglet, la vue et le rendu Sante autonomes du runtime ; rediriger les anciens appels vers Nutrition.
- [x] Travail : separer periodes, missions, revenus et graphiques.
  - [x] Extraire le rendu du parcours professionnel : fresque, KPI, missions, revenus, periodes et dossiers lies.
- [x] Patrimoine : separer actifs, cout mensuel et integration budget.
  - [x] Extraire la carte actif : valeur, amortissement, cout mensuel budget, proprietaires, evenements, documents, actions et P&L realise.
  - [x] Extraire les formulaires actif et proprietaires vers `assetView`.
  - [x] Extraire les formulaires transfert, vente et documents vers des vues pures testees.
  - [x] Lier assets, transactions et depenses Trip avec exclusion budget optionnelle pour eviter le double comptage achat/amortissement.

Critere ferme : les domaines Trip, Sport, Nutrition, Travail et Patrimoine ont un repository/store/vue ou des regles dediees, et l'ancien onglet Sante autonome est supprime au profit des indicateurs transversaux.

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
  - [x] Rendre la navigation Analyse deterministe : attendre les donnees differees/gouvernance avant rendu.
  - [x] Ajouter une file de rendu Analyse (`tbRequestAnalysisRender`) avec retry DOM et relance apres donnees chargees.
  - [x] Eviter le double refresh Analyse : un seul filet SQL transactions par voyage et chargement du domaine lazy avant rendu.
  - [x] Stabiliser Analyse quand les donnees/filtres locaux sont incoherents : refresh si transactions absentes et auto-elargissement des filtres vides.
  - [x] Stabiliser le boot mobile/PWA : log `TB BUILD`, cache service worker versionne et refresh Analyse lie aux transactions du voyage actif.
  - [x] Sortir Cashflow du boot : `27_cashflow_curve.js` charge a la demande sur Dashboard via `tbEnsureCashflowCurve`, avec theme, KPI, boot-release et navigation compatibles lazy.
  - [x] Ajouter un loader transversal Sport/Travail leger pour que Nutrition, KPI et notifications lisent les calories d'activite sans ouvrir les onglets Sport ou Travail.
  - [x] Charger `workView.js` et `assetView.js` avec leurs domaines lazy au lieu du bridge initial.
  - [x] Retirer le pre-cache CDN du service worker pour supprimer les violations CSP `connect-src` sur `cdn.jsdelivr.net`.
  - [x] Sortir FX Decision du boot : `34_fx_decision.js` charge avec Analyse et possede un budget dedie.
  - [x] Stabiliser le changement manuel de voyage Settings : le voyage choisi reste actif apres refresh, meme si un autre voyage contient la date du jour.
  - [x] Sortir Inbox / A traiter du boot : `44_inbox_ui.js` charge a l'ouverture de l'onglet, avec onglet HTML stable et budget dedie.
- [ ] Decouper les gros bundles par domaine.
  - [x] Extraire le shell visuel Settings : hero, resumes de cartes et accordéons quittent `14_settings_periods_ui.js` vers `src/features/settings/settingsView.js`.
  - [x] Extraire le rendu du panneau Compte Settings : profil, santé, devise, mode UI, seuil cashflow et raccourcis notifications quittent le template inline legacy.
  - [x] Extraire les handlers Compte Settings : hydratation profil, WhatsApp, santé, devise, mode UI, reset mot de passe, notifications et seuil cashflow passent dans `settingsAccountController.js`.
  - [x] Extraire le rendu FX manuel Settings : normalisation des taux, badges, tableau, actions stables et etat vide passent dans `settingsView.js`.
  - [x] Extraire le rendu des cartes Periode Settings : entete, recap, edition budget/devise, reference pays et actions passent dans `settingsView.js`.
  - [x] Supprimer l'ancien rendu FX manuel inline `renderManualFxBox`, remplace par le panneau Settings deja extrait et teste.
  - [x] Extraire le rendu Reference de periode Settings : pays, recommandation, prevu, ecart, postes et actions passent dans `settingsView.js`.
  - [x] Extraire l'overview Voyage Settings : resume voyage, reference, cadence, champs editables et postes quittent `14_settings_periods_ui.js`.
  - [x] Centraliser la garde de suppression des periodes Settings : derniere periode refusee avant `safeCall`, sans erreur console non attrapee.
  - [x] Extraire le rendu Categories/Sous-categories Settings : cartes, actions, mapping analytique et sous-listes quittent `14_settings_periods_ui.js`.
  - [x] Extraire les corps des modales guidees Categories/Sous-categories Settings vers `settingsCategoriesView.js`.
  - [x] Centraliser la validation des categories Settings : nom et couleur avant ecriture SQL.
  - [x] Centraliser la validation des sous-categories Settings : categorie, nom, couleur et doublons avant ecriture SQL.
  - [x] Afficher les refus de validation Settings comme messages utilisateur sans `safeCall/async` ni `Uncaught`.
  - [x] Extraire le routage des notices de validation Categories/Sous-categories vers `settingsCategoriesView.js`.
  - [x] Extraire la preparation du payload d'edition Sous-categorie vers `settingsCategoriesView.js`.
  - [x] Remplacer les prompts d'edition Sous-categorie par la modale guidee partagee.
  - [x] Extraire la preparation des regles de mapping analytique Categories/Sous-categories vers `settingsCategoriesView.js`.
  - [x] Extraire la preparation des payloads creation/import Sous-categorie vers `settingsCategoriesView.js`.
  - [x] Extraire la preparation des payloads creation/mise a jour Categorie vers `settingsCategoriesView.js`.
  - [x] Extraire la preparation du reordonnancement Sous-categorie vers `settingsCategoriesView.js`.
  - [x] Extraire la preparation du payload activation Sous-categorie vers `settingsCategoriesView.js`.
  - [x] Extraire la decision de nettoyage de l'ancien mapping apres renommage Sous-categorie vers `settingsCategoriesView.js`.
  - [x] Extraire la preparation de suppression Categorie (confirmation, SQL/fallback) vers `settingsCategoriesView.js`.
  - [x] Extraire les corps des modales Creation voyage et Creation periode Settings vers `settingsView.js`.
  - [x] Extraire les etats Reference budget Settings : hors ligne, synchronisation et indisponible passent dans `settingsView.js`.
  - [x] Extraire le cockpit programme Sport : semaine A/B, charges prevues, progression et reglages recurrence passent dans `sportProgramView.js`.
  - [x] Ajouter le moteur progression Sport : e1RM Epley, lissage, Training Max, recommandations SQL et application explicite.
  - [x] Extraire le rendu des recommandations de charge Sport vers `sportProgramView.js`.
  - [x] Extraire les fenetres Trip matching transaction et reglement : contenus et actions passent dans `tripView.js`.
  - [x] Stabiliser la modale mobile Depense partagee Trip : formulaire en grille CSS, split responsive et actions collantes.
  - [x] Extraire le detail de depense Trip vers `tripExpenseDetailView.js` : repartition, liens budget/wallet, audit et ouverture transaction passent par hooks `data-*`.
  - [x] Retirer le fichier legacy `29_trip_document_view.js` : le rendu Documents de depense Trip passe dans `src/features/trip/tripDocumentView.js`.
  - [x] Extraire le rendu de gestion du partage Trip : voyage actif, creation/suppression, participants et invitations passent dans `tripView.js`.
  - [x] Extraire le rendu Récap Trip : balances, règlements suggérés et historique des règlements passent dans `tripRecapView.js`.
  - [x] Extraire la toolbar Historique Trip : filtres catégorie, participant, dates, montants et recherche passent dans `tripRecapView.js`.
  - [x] Supprimer les helpers Settings morts : wrappers panneaux obsoletes, sauvegarde nom voyage inutilisee, resume/skeleton budget reference.
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
  - [x] Extraire le panneau Analyse impayes : lignes a payer, montant visible, budget range et libelles quittent `33_budget_analysis.js`.
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
  - [x] Extraire l'assemblage des cartes KPI vers `kpiView.js`.
  - [x] Extraire les bindings KPI : date-a-date, scope, toggle impayes et convertisseur FX vers `11_kpi_controller.js`.
  - [x] Extraire les regles Wallet Dashboard : validation creation/edition, type automatique et libelles quittent `12_dashboard_render.js`.
  - [x] Extraire les mutations Wallet Dashboard : payloads SQL, archivage, garde de suppression et normalisation des corrections de type quittent `12_dashboard_render.js`.
  - [x] Extraire les regles KPI Sante/Nutrition/Sommeil/Alcool et classification budget/cash/trip pending vers `kpiHealthRules.js`.
  - [x] Extraire les regles KPI projection/pending, Trip net, scopes et pastilles cash vers `kpiProjectionRules.js`.
  - [x] Extraire les regles KPI wallets cash, runway et couverture prudente vers `kpiCashRules.js`.
  - [x] Sortir le dictionnaire anglais i18n du boot : `00_i18n.js` garde le francais, `00_i18n_en.js` charge l'anglais a la demande ; boot legacy 1025.3 -> 977.2 KiB.
  - [x] Extraire le rendu Inbox / A traiter : shell, previews, cartes WhatsApp/documents et cartes Trip passent dans `inboxView.js`.
- [x] Mesurer temps de demarrage, taille du bundle et memoire mobile.

## Chantier 6 - Qualite et livraison

- [x] Ajouter lint et formatage sans reformatage massif initial.
- [x] Fixer un budget de taille par module.
- [x] Ajouter les parcours critiques Playwright.
- [x] Documenter architecture, conventions et procedure de migration.
- [x] Retirer un fichier legacy uniquement quand son remplacement est valide.
- [ ] Maintenir `public/projet.html`, l'APK et Git a chaque livraison.

## Indicateurs

| Indicateur | Depart | Cible V11 |
| --- | ---: | ---: |
| Scripts legacy charges au demarrage | 59 | moins de 15 |
| JavaScript legacy | environ 2,5 Mo | moins de 1 Mo |
| Fichiers de plus de 2 000 lignes | 6 | 0 |
| Sources de calcul du budget journalier | 3 | 1 |
| Domaines charges a la demande | 0 | 5 |
