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
- Wallet, budget, Trip, Sport, Nutrition, Travail et Patrimoine resynchronisés.
- Chargement du bridge et du domaine lazy avant le rejeu sur Android.

## Risques connus

- Mutation rejouée deux fois après un redémarrage.
- Identifiant enfant absent lors d'une suppression distante.
- Snapshot partiel pris pour une source complète.
- Domaine lazy non chargé au moment de la réconciliation.
