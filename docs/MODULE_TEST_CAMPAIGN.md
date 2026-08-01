# TravelBudget - campagne de validation des modules

Version de depart : `10.5.316`.

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
10. Cautions
11. Documents
12. A traiter
13. Notifications
14. Aide

## Donnees Supabase

- `app_test_campaigns` : campagne active et version cible.
- `app_test_modules` : ordre et statut global des modules.
- `app_test_scenarios` : instructions et resultats attendus.
- `app_test_results` : reponse et note du testeur par scenario.
- `app_test_module_reviews` : decision finale du testeur par module.

Les tables sont exposees uniquement aux utilisateurs authentifies autorises et protegees par RLS. Un testeur ne peut ecrire que ses propres resultats.

## Reprise Play Store

Le chantier Play Store reprend apres validation des modules critiques, correction des retours bloquants et passage transversal complet sur l AAB release candidate.
