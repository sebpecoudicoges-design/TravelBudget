# TravelBudget - campagne de validation des modules

Version de depart : `10.5.316`. Version cible actuelle : `10.5.322`.

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
8. Une fois le retour traite, l archiver : sa date de test, sa date de traitement, la version et les notes restent consultables.

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
- `app_test_scenarios` : instructions et resultats attendus.
- `app_test_results` : reponse et note du testeur par scenario, dates de test/traitement et archivage.
- `app_test_module_reviews` : decision finale du testeur par module, traitement et archivage.

Les resultats actifs utilisent un index unique partiel : archiver un resultat libere le scenario pour un retest sans perdre son historique.

Les tables sont exposees uniquement aux utilisateurs authentifies autorises et protegees par RLS. Un testeur ne peut ecrire que ses propres resultats.

## Reprise Play Store

Le chantier Play Store reprend apres validation des modules critiques, correction des retours bloquants et passage transversal complet sur l AAB release candidate.
