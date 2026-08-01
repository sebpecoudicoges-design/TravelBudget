# Consigne graphique du dépôt

Toute intervention sur l’interface doit lire et respecter [`docs/VISUAL_SYSTEM.md`](docs/VISUAL_SYSTEM.md).

Règles prioritaires :

- partir de l’interface existante et préserver toutes les fonctionnalités utiles ;
- déplacer ou regrouper les commandes si nécessaire, sans supprimer leurs identifiants, attributs `data-*` ou gestionnaires ;
- utiliser en priorité les tokens et composants de `src/ui/premium-theme.css` ;
- vérifier les thèmes clair et sombre ainsi que les largeurs 1440 px et 390 px ;
- maintenir ou ajouter les tests de contrat visuel et fonctionnel avant de considérer la modification terminée.
- lors de toute intervention sur un fichier ou domaine, chercher le code mort directement lié au périmètre touché ; le supprimer seulement après vérification des appels et avec un contrat anti-retour quand c'est pertinent.

Une maquette est une direction visuelle, pas une autorisation de supprimer les comportements absents de son aperçu.
