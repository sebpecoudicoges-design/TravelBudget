# TravelBudget - tests utilisateur a faire

Objectif : conserver les verifications manuelles importantes apres chaque APK, en complement des tests automatises.

Statuts proposes : `a faire`, `ok`, `a revoir`.

| Version | Module | Scenario | Etapes utilisateur | Resultat attendu | Console attendue | Statut |
| --- | --- | --- | --- | --- | --- | --- |
| 10.5.202 | Settings | Refus propre validation categories | Ouvrir Reglages > Categories, creer une categorie sans nom, puis ajouter/editer une sous-categorie avec `blue` comme couleur. | Message utilisateur propre : nom vide ou couleur invalide. Aucune ecriture SQL. | Aucun `[safeCall/async]`, aucun `Uncaught`. | a faire |
| 10.5.200 | Settings | Validation sous-categorie | Ouvrir Reglages > Categories, tenter d'ajouter une sous-categorie sans nom puis avec une couleur invalide via le champ texte. | Refus lisible avant ecriture SQL : sous-categorie invalide ou couleur invalide. | Aucun `Uncaught`; pas de bruit `safeCall/async` non gere. | a faire |
| 10.5.199 | Settings | Suppression derniere periode | Ouvrir Reglages > Periodes avec une seule periode, cliquer Supprimer. | Toast ou message propre : `Impossible: au moins 1 periode requise.` La periode reste visible. | Aucun `Uncaught`; pas de double erreur apres le toast. | a faire |
| 10.5.198 | Settings | Modales voyage/periode | Ouvrir Reglages, cliquer Nouveau voyage puis Ajouter periode. | Les champs Debut/Fin apparaissent pour le voyage, puis Debut/Fin/Devise/Budget jour pour la periode. Annuler ferme proprement. | Aucun `Uncaught`. | a faire |
| 10.5.197 | Settings | Modales categorie/sous-categorie | Ouvrir Reglages > Categories, ajouter une categorie puis une sous-categorie. | Les modales guidees affichent Nom, Couleur, Mapping analytique et les actions creer/annuler. | Aucun `Uncaught`. | a faire |
| 10.5.196 | Analyse | Chargement sans double refresh | Ouvrir Analyse depuis un chargement frais, avec le voyage BudgetTravel actif. | Les donnees s'affichent, l'ecran ne reste pas sur `Chargement analyse...`. | Un seul chargement transactions par voyage dans le flux normal. | a faire |

## Test a ajouter a chaque livraison

- Version livree.
- Ecran a ouvrir.
- Action principale.
- Resultat attendu.
- Attente console simple : aucune erreur non geree, ou log precis si utile.
