# V11 - couche de donnees

## Objectif

Les modules UI ne doivent plus implementer eux-memes les appels Supabase, la file hors ligne, les retries ou la normalisation des donnees.

## Modules

- `src/data/supabaseRepository.js` : enveloppe commune pour `select`, `insert`, `upsert`, `update`, `delete` et `rpc`. Une erreur Supabase devient toujours une exception.
- `src/data/mutationQueueStore.js` : stockage utilisateur, verrou inter-onglets, deduplication, reprise d'une synchronisation interrompue et backoff.
- `src/data/entityStore.js` : etat explicite observable pour remplacer progressivement les caches globaux.
- `src/data/sportRepository.js` : historique agrege, creation complete d'une seance, garde anti-doublon, suppression des enfants et modification de date.
- `src/features/sport/sportStore.js` : source de verite Sport dans `entityStore` pour le plan, l'historique SQL/local, l'hydratation offline et les suppressions en attente.
- `src/features/sport/sportTimerView.js`, `src/features/sport/sportHistoryView.js` et `src/features/sport/sportSessionSandboxView.js` : rendu pur du Timer guide, de la semaine sport, des cartes d'historique, du detail des series et de la fenetre `Ajuster`.
- `src/features/sport/sportSessionSandboxRules.js` : regles pures de la fenetre `Ajuster` pour renumeroter, supprimer et ajouter des series au bon exercice.
- `src/core/canonicalRecords.js` : formats canoniques pour transaction, entree nutrition et seance sport.

Le fichier `public/legacy/js/00_offline_queue.js` est maintenant un adaptateur : il conserve les handlers metier historiques, mais delegue l'infrastructure a `src/data`.

## Contrat de synchronisation

1. Une mutation recoit une cle de deduplication quand l'action possede une identite stable.
2. Une mutation identique deja en attente est mise a jour, pas dupliquee.
3. Un verrou empeche deux onglets de vider la meme file simultanement.
4. Une erreur temporaire conserve la mutation et programme un nouvel essai : 5 s, 30 s, 2 min puis 10 min.
5. Une mutation en erreur ne bloque pas les suivantes.
6. Une erreur metier permanente retire uniquement l'action non rejouable.
7. Une ligne optimiste est retiree uniquement apres la reussite de sa mutation.

## Idempotence serveur verifiee

- Transactions : index unique `transactions_user_offline_dedupe_key_uidx` sur `(user_id, offline_dedupe_key)`.
- Nutrition : index unique `nutrition_meal_items_exact_dedupe_idx` sur l'identite exacte d'un aliment dans un repas.

La protection locale ameliore l'experience. Les contraintes Postgres restent la protection finale contre deux appareils ou deux requetes concurrentes.

## Migration restante

Le repository, le store et les vues Timer/Historique/Ajuster Sport sont branches sur les lectures, mutations, caches locaux et reprises offline principales. Le prochain lot Sport peut isoler les handlers du timer et de l'ajustement des seances. Nutrition et les derniers caches Trip suivront pendant leur decoupage, avec leurs propres tests et parcours offline.
