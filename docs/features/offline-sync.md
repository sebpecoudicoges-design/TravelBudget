<!-- atlas-meta
{
  "id": "sync.offline",
  "dependencies": ["budget.transaction", "trip.budget-link", "sport.session", "nutrition.meal", "assets.movement", "work.income"],
  "impacts": { "wallet": "required", "dailyBudget": "required", "analysis": "possible", "trip": "required", "offline": "required", "android": "required" },
  "files": ["src/data/mutationQueueStore.js", "src/data/entityStore.js", "src/data/supabaseRepository.js", "public/legacy/js/00_offline.js", "public/legacy/js/00_offline_queue.js", "docs/V11_DATA_LAYER.md"],
  "tests": ["tests/data/mutationQueueStore.test.js", "tests/data/entityStore.test.js", "tests/data/supabaseRepository.test.js", "tests/ui/errorBusContract.test.js", "tests/ui/legacyDomainLoader.test.js"],
  "validation": { "commit": "001c0abd6d568d0607d4a21960aed5c8465ba837", "date": "2026-07-14", "verifiedBy": "Codex repository inspection" }
}
-->
# sync.offline — File locale, idempotence et reconnexion

## Utilisateur

Comportement transversal lorsque le réseau disparaît, revient ou que l'application Android reprend après interruption.

## Source de vérité

- File générique et déduplication locale : `src/data/mutationQueueStore.js`.
- Cache d'entités : `src/data/entityStore.js`.
- Accès Supabase centralisé : `src/data/supabaseRepository.js`.
- Détection offline, snapshot et rejeu historique : scripts `00_offline*`.
- Idempotence définitive : clés serveur, contraintes uniques et RPC Supabase par domaine.

## Données

- Snapshot local allégé de l'état applicatif.
- File de mutations persistée avec type, payload, identifiant et statut.
- Clés `sync_id` ou idempotency key selon le domaine.

## Conséquences à vérifier

- Mutation visible localement sans attendre le réseau.
- Rejeu unique, ordre conservé et confirmation du résultat distant.
- Conflit ou erreur non destructive, avec possibilité de reprise.
- Un message de doublon, de clé étrangère ou de répartition Trip invalide ne prouve pas une réussite distante : le rejeu conserve l'action en erreur avec son contenu et son délai de reprise. Seule une confirmation de réussite ou une suppression explicitement demandée permet de la retirer.
- Le démarrage ne purge pas les erreurs Trip. Le nettoyage reste une commande explicite.
- Si Web Locks est disponible, une synchronisation prend un verrou exclusif par compte pour toute la durée du rejeu. Un autre onglet abandonne immédiatement cette tentative ; le bail local reste utilisé pour compatibilité avec les anciens clients. Un refus du gestionnaire de verrous ne déclenche pas de rejeu de secours sans verrou.
- Wallet, budget, Trip, Sport, Nutrition, Travail et Patrimoine resynchronisés.
- Chargement du bridge et du domaine lazy avant le rejeu sur Android. Sport et Nutrition conservent leur action en attente si le gestionnaire est indisponible ; une vérification du compte et du bail après le chargement évite de lancer le rejeu dans un autre contexte.
- Les compteurs de synchronisation et les notifications reflètent uniquement la révision dont le résultat a été enregistré dans la file. La réponse d’une ancienne révision remplacée ou retirée n’est ni un succès affiché ni une erreur de la nouvelle saisie. Un échec d’enregistrement de l’accusé n’est pas reclassé en échec de la requête distante.

## Risques connus

- Mutation rejouée deux fois après un redémarrage.
- Identifiant enfant absent lors d'une suppression distante.
- Snapshot partiel pris pour une source complète.
- Domaine lazy non chargé au moment de la réconciliation.
- Le verrou de synchronisation ne rend pas transactionnelles les écritures concurrentes dans localStorage : saisies/suppressions entre onglets restent à migrer vers une persistance transactionnelle. Sans Web Locks, seul le bail local protège le rejeu ; un ancien onglet n'acquiert pas le nouveau verrou navigateur.
- Les écritures fondées sur une lecture conservée vérifient son compte et son contenu brut avant sauvegarde. Une différence provoque un refus sans nettoyage optimiste. Cette détection ne supprime pas la fenêtre entre contrôle et écriture : ce n'est pas un compare-and-swap atomique.
