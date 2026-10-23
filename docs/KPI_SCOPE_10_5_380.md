# Isolation des chargements KPI — 10.5.380

## Défaut reproduit

Les chargeurs Activité et Nutrition pouvaient publier une réponse lancée avant une déconnexion ou un changement de compte. Le cache Activité n’était pas invalidé par l’événement de changement de compte, contrairement au cache Nutrition. La remise à zéro générale de l’état dans le flux d’authentification ne suffisait pas : une réponse tardive pouvait encore remplir le nouvel état, déclencher son rendu et alimenter sa sauvegarde hors ligne.

Les tests synthétiques ont reproduit 13 échecs avant correction. Cela établit un défaut de concurrence côté client, sans démontrer une fuite entre comptes réels ou un contournement des politiques SQL.

## Correction

Chaque nouveau chargement capture son compte, son client, son objet d’état et une version propre au domaine. Une transition d’authentification invalide les deux versions, détache les promesses précédentes et vide les caches et indicateurs de chargement. Les contrôles après chaque attente empêchent les anciennes réponses de démarrer une étape de requêtes supplémentaire ou de modifier l’état, les snapshots et le rendu. Le cas A → B → A est couvert ; comparer seulement les identifiants utilisateur ne suffisait pas.

Un rechargement forcé invalide aussi la réponse précédente du même domaine. Les erreurs tardives devenues obsolètes sont ignorées ; les erreurs de la requête courante restent propagées et peuvent être retentées conformément au lot 10.5.379. Les requêtes déjà envoyées ne sont pas annulées côté serveur : leurs résultats ne sont plus publiés.

Le rendu KPI suit la promesse qu’il a démarrée : la fin d’un ancien appel ne peut plus effacer le verrou d’un appel du nouveau compte. Les deux chargeurs partagent la capture du contexte ; les fonctions de publication et les consommateurs restent utilisés. Recherche du code mort effectuée sur ce périmètre : l’ancien gestionnaire de remise à zéro Nutrition est étendu, sans gestionnaire doublonné ni suppression de commande.

## Validation

Le fichier de tests comportementaux comporte 25 cas, dont 17 ajoutés : cache après transition, déconnexion, retour au même compte, remplacement d’état, rechargement forcé, changement pendant le contrôle hors ligne, erreurs tardives et seconde étape des requêtes Nutrition. Quatre scénarios navigateur vérifient le vrai rendu KPI en clair/sombre à 1440/390 px, avec deux identités et des réponses synthétiques retardées. Ils vérifient aussi l’absence de publication dans les snapshots et la conservation du verrou du nouveau compte.

Ces tests ne remplacent pas une validation de connexion sur deux comptes réels, des autorisations SQL ou d’un téléphone. Le parcours connecté complet et l’extraction progressive du legacy restent ouverts dans la phase architecture/qualité ; la phase base de données n’est pas commencée.

APK du lot : `travelbudget-10.5.380-20261023-223000-debug.apk`, package `com.travelbudget.app`, versionCode `10050380`. Preuves de validation et distribution dans le suivi de l’audit.
