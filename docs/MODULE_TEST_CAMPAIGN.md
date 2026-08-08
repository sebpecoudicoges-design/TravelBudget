# TravelBudget - campagne de validation des modules

Version de depart : `10.5.316`. Version cible actuelle : `10.5.325`.

## Objectif

Figer temporairement les modules pour les comptes standards, puis les verifier et les refondre un par un avant la reprise du chantier Play Store.

## Roles

- `admin` : acces a tous les modules, a la campagne et a l administration Membres.
- `test` : acces a tous les modules et a l espace Tests, sans acces aux fonctions reservees aux admins.
- `user` / `member` : modules metier temporairement fermes ; Compte et Aide restent accessibles.

Le role est lu depuis `public.profiles.role`. Le verrou d interface ne remplace jamais les politiques RLS Supabase.

## Utilisation testeur

1. Se connecter avec le compte testeur.
2. Ouvrir l onglet **Tests**.
3. Commencer par **Dashboard**.
4. Ouvrir chaque scenario, realiser l action puis choisir `OK`, `Pas OK` ou `A refaire`.
5. Ajouter une note en cas d ecart : appareil, resultat reel, console et capture si utile.
6. Repondre a tous les scenarios obligatoires.
7. Terminer le module avec **tout est OK** ou **avec problemes**.
8. Si une nouvelle observation arrive, utiliser **Ajouter un nouveau retour** : elle suit le precedent sans l ecraser.
9. Une fois le traitement valide, un admin utilise **Clore pour tous** ; dates, version et notes restent consultables.

Les filtres **Actifs**, **A tester**, **Sans test** et **Archives** distinguent la file de travail des modules qui n ont rien a executer. **Afficher les tests archives** ouvre l historique sans recreer de tache.

Les resultats sont sauvegardes dans Supabase et restent rattaches au compte testeur.

## Ordre de campagne

1. Dashboard
2. Transactions
3. Settings
4. Analyse
5. Trip / Partage
6. Sport
7. Alimentation
8. Travail
9. Patrimoine
10. Documents
11. A traiter
12. Notifications
13. Aide
14. Interface generale

Cautions est retire de l application depuis `10.5.319`. Le module de campagne est archive et reste visible avec le filtre **Archives** ; ses donnees metier historiques soldees sont conservees.

## Donnees Supabase

- `app_test_campaigns` : campagne active et version cible.
- `app_test_modules` : ordre et statut global des modules.
- `app_test_scenarios` : instructions, filiation eventuelle et cloture globale.
- `app_test_results` : episodes successifs de reponse et note du testeur, avec filiation et dates de test/traitement.
- `app_test_module_reviews` : decision finale du testeur par module, traitement et archivage.

Les resultats actifs utilisent un index unique partiel : ajouter un retour remplace l episode editable, conserve le precedent dans l historique et relie les deux lignes.

En `10.5.325`, les scenarios deja valides sans reserve sont clos pour tous et quittent la file active. Quatre retests derives restent visibles : premier chargement Dashboard, notifications Transactions, grille Compte compacte et aides persistantes.

Les tables sont exposees uniquement aux utilisateurs authentifies autorises et protegees par RLS. Un testeur ne peut ecrire que ses propres resultats.

## Historique et cloture

- **Ajouter un nouveau retour** cree un episode relie au precedent sans ecraser les notes ni les dates.
- Un scenario derive affiche le test parent dont il decoule.
- **Clore pour tous** est reserve aux administrateurs : le scenario devient clos au niveau campagne et disparait des tests actifs de chaque testeur.
- Les retours precedents, traites et scenarios clos restent consultables avec **Afficher les tests archives**.

## Reprise Play Store

Le chantier Play Store reprend apres validation des modules critiques, correction des retours bloquants et passage transversal complet sur l AAB release candidate.
