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
4. Le rejeu verrouille aussi les lignes d’aliments existantes. Il attend une écriture directe en cours sur un aliment : ajout, modification ou suppression validée donne un conflit ; modification annulée permet de confirmer. Si le rejeu a déjà verrouillé les aliments, une modification directe attend sa fin, puis s’applique normalement. Aucun changement n’est perdu. Ces cas utilisent l’isolation PostgreSQL `READ COMMITTED` et le compte fictif existant.

Avec les binaires PostgreSQL et le module Node `pg` 8.16.3 installés hors du dépôt :
```sh
node scripts/audit-nutrition/test-atomic-meal-concurrency.mjs /chemin/vers/pg/bin /chemin/vers/node_modules/pg/lib/index.js
```

## Perte de la réponse HTTP

Un troisième banc utilise PostgREST 14.7 et PostgreSQL 17.12 isolés. Le serveur reçoit un jeton de test éphémère pour le compte fictif. Un proxy local attend le résultat de création, puis coupe la connexion avec le client sans lui transmettre la réponse. La base contient déjà le repas et ses deux aliments lorsque le client constate l’erreur réseau. Avec la même clé, la requête suivante renvoie `already_applied` et le même identifiant ; avec une autre quantité, elle renvoie `conflict` sans changer les quantités enregistrées. Un aliment invalide renvoie une erreur de contrainte et n’ajoute aucune ligne.

Avec PostgREST et les mêmes binaires PostgreSQL et module Node installés hors du dépôt :
```sh
node scripts/audit-nutrition/test-atomic-meal-rest.mjs /chemin/vers/pg/bin /chemin/vers/node_modules/pg/lib/index.js /chemin/vers/postgrest
```

## Contrat client de rejeu (isolé)

Le module `scripts/audit-nutrition/atomic-meal-client.mjs` transmet uniquement la RPC atomique. Il n’efface pas lui-même la file. Il distingue les réponses `created` et `already_applied`, seules capables de confirmer la saisie, de `conflict`, qui reste en attente. Une réponse absente ou inconnue, une erreur de transport, un autre compte ou une révision devenue obsolète ne confirment rien et ne déclenchent aucune écriture de secours. Les nouvelles tentatives repartent de la même saisie enregistrée, avec le même identifiant et la même liste ordonnée. Une ancienne saisie sans compte, date ou voyage explicite (éventuellement nul), ou dont les identifiants divergent, nécessite une revue plutôt qu’une déduction depuis l’écran actuel.

Le transport du banc est lié au jeton synthétique d’un seul compte, pas à la session active d’un client global. Un futur branchement devra conserver cette propriété et supprimer la saisie uniquement sous le contrôle de la révision locale. Le banc PostgREST passe par ce module pour constater successivement l’erreur réseau, le rejeu confirmé et le conflit laissé en attente. Les tests unitaires vérifient aussi un changement de révision pendant la réponse et l’absence de repli si la RPC est indisponible.

```sh
node --test scripts/audit-nutrition/test-atomic-meal-client.mjs
```

Ces tests ne rendent pas atomique l’ancienne édition qui envoie l’en-tête et l’aliment dans deux requêtes. Ils ne couvrent pas non plus le déplacement entre repas ou la suppression de l’en-tête au moment du rejeu. Il reste à concevoir une édition à transaction unique, à traiter la suppression d’un repas en attente de rejeu, puis à valider le branchement de la file et l’interface de résolution d’un conflit. Aucun changement de schéma ni d’application en production.

## Choix explicite en cas de conflit (isolé)

Le protocole client prépare une prévisualisation pour un seul compte, une seule saisie et deux révisions : celle de la saisie locale et celle du repas distant complet, aliments compris. Sans choix, la saisie reste en attente. Si la personne choisit « garder la version distante », le protocole relit le repas distant puis demande à la file de retirer la seule saisie conflictuelle revue, à condition que sa révision corresponde toujours. Si le repas distant est absent ou différent, il faut revoir la prévisualisation ; une erreur de lecture, un changement de compte ou de saisie et un échec de stockage ne sont pas des confirmations. Le protocole ne modifie jamais le repas distant et ne crée ni nouvelle saisie ni nouvel identifiant. Une édition distante après la relecture reste une édition distante normale : cette procédure n’est pas une transaction répartie.

Les premiers tests utilisent des adaptateurs fictifs. Le banc PostgREST vérifie désormais une lecture cohérente de l’ensemble du repas. Le banc IndexedDB ci-dessous vérifie compte, conflit et révision dans la même transaction locale que le retrait. Ce contrat ne prouve pas que l’ancien localStorage réalise cette transaction ni qu’une interface affiche déjà le choix.

```sh
node --test scripts/audit-nutrition/test-atomic-meal-conflict.mjs
```

### Instantané de comparaison

La fonction de lecture d’audit projette en une requête l’en-tête et les aliments triés par ordre puis identifiant. Elle utilise le compte authentifié, l’identifiant du repas et la clé de synchronisation, avec les politiques SQL existantes comme garde supplémentaire. La révision `meal-v1:` est une empreinte des valeurs projetées, non un historique des modifications. Elle ne dépend pas de l’horodatage de l’en-tête et change si un aliment ou son ordre change. Le banc REST vérifie qu’une édition non validée n’est pas visible, qu’une édition validée force une nouvelle prévisualisation, puis qu’un nouveau choix confirmé ne change pas le repas distant. Dans ce banc REST le retrait local reste simulé ; le banc navigateur le teste séparément.

### Retrait local transactionnel

Le magasin d’audit IndexedDB identifie une saisie par compte et clé de synchronisation. Une transaction lit la révision et le statut `conflict`, contrôle le contexte et ne retire que la saisie revue. Le client attend la validation de la transaction, pas le seul succès de la requête de suppression. Dans Chromium avec deux onglets, un seul peut confirmer un retrait ; la clé identique d’un autre compte est conservée. Une révision ou un statut changé n’est pas supprimé. Un abandon de transaction après succès de la requête de suppression garde le brouillon pour le prochain onglet.

```sh
npm run test:e2e -- tests/e2e/nutrition-conflict-storage-audit.spec.js --project=desktop-chromium
```

Ce magasin ne lit ni ne migre l’ancienne file du produit. Les écritures localStorage des anciennes versions ne participent pas à la transaction. Il reste à vérifier interface, transition et compatibilité avant tout raccordement.

### Comparaison visuelle isolée

La maquette FR/EN présente la saisie locale et la version synchronisée, avec leurs quantités, aliments et énergie. Le choix par défaut laisse la saisie en attente. Une version distante modifiée désactive la confirmation jusqu’à actualisation ; le nouveau choix revient à « laisser en attente ». Une lecture en échec n’affiche aucun succès. Trois parcours Chromium vérifient le clavier, le focus du résultat annoncé, une vue de 320 px sans défilement horizontal, l’actualisation et l’erreur. Le navigateur utilise des repas fictifs et ne monte pas l’application.

```sh
npm run test:e2e -- tests/e2e/nutrition-conflict-review-audit.spec.js --project=desktop-chromium
```

Avant intégration, raccorder la lecture et le retrait déjà validés séparément, définir la projection utilisateur des notes et références de voyages et empêcher que l’ancien client écrive dans la file pendant la transition.
