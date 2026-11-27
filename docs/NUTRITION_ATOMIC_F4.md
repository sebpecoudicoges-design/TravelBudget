# F4 : candidat de création atomique d’un repas

Le client actuel enregistre d’abord le repas puis son aliment dans une autre requête. Si la seconde échoue, le repas peut exister seul. Le prototype `scripts/audit-nutrition/atomic-meal.sql` écrit le repas et tous ses aliments dans une même transaction. Il n’est ni une migration, ni une RPC utilisée par l’application.

- L’identifiant d’opération est stable et propre au compte authentifié. La fonction conserve les droits de l’appelant et les politiques des tables ; elle ne reçoit pas d’identifiant de compte fourni par le client.
- `created` : l’en-tête et tous les aliments ont été enregistrés. Un échec de colonne, contrainte ou référence annule la création entière.
- `already_applied` : l’en-tête et la liste ordonnée d’aliments correspondent exactement. Le client pourra confirmer une réponse perdue sans réécrire.
- `conflict` : l’en-tête ou la liste diffère, y compris une ancienne ligne partielle. Ne rien remplacer, ne pas confirmer la saisie en attente. Les repas sans aliment, par exemple l’hydratation, restent acceptés. Ce contrat ne produit aucune mise à jour ou suppression.

## Preuve isolée et limites

Le banc exécute les tables et les politiques Nutrition de la migration fondatrice, le champ d’heure de consommation et les index versionnés, avec Auth et voyages synthétiques. Il n’exécute pas les anciennes corrections de données. Un deuxième aliment invalide laisse **zéro repas et zéro aliment**. Le même identifiant peut ensuite créer un repas à deux aliments ; un rejeu exact ne crée rien, tandis qu’un changement de quantité ou d’en-tête ne modifie rien. Le banc contrôle aussi l’hydratation seule, le maintien d’une ancienne ligne partielle, deux comptes fictifs qui utilisent la même clé et l’absence du droit d’exécution pour le rôle anonyme.

Exécuter avec PGlite `0.3.15` installé hors du dépôt :
```sh
node scripts/audit-nutrition/test-atomic-meal.mjs /chemin/vers/pglite/dist/index.js
```

## Deux connexions PostgreSQL indépendantes

Le second banc démarre un PostgreSQL 17.12 vierge sur l’adresse locale, avec un port temporaire et un mot de passe généré. Il charge le même schéma fictif. Il observe réellement le blocage entre deux sessions :

1. Après validation de la première transaction, le rejeu concurrent retrouve la même opération sans écrire de nouveau.
2. Après annulation de la première transaction, la session en attente crée un seul repas avec ses propres quantités.
3. Si l’autre session modifie l’en-tête du repas pendant le rejeu, celui-ci signale un conflit et ne touche ni l’édition ni les aliments.

Avec les binaires PostgreSQL et le module Node `pg` 8.16.3 installés hors du dépôt :
```sh
node scripts/audit-nutrition/test-atomic-meal-concurrency.mjs /chemin/vers/pg/bin /chemin/vers/node_modules/pg/lib/index.js
```

Ce banc ne teste pas PostgREST, une vraie perte de réponse HTTP, ni une ancienne édition qui modifie uniquement les aliments sans verrouiller l’en-tête. Tester la coordination avec ces écritures et le traitement client des résultats sur un banc Supabase isolé avant de brancher la RPC. Ne pas substituer un nouvel identifiant de rejeu à une saisie existante. Aucun changement de schéma ou de client en production.
