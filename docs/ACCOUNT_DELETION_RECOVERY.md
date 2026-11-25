# Reprise des suppressions de compte — lot local du 24 novembre 2026

Constat F13 : le processeur ne sélectionnait que les demandes `pending`. Une interruption après passage à `processing` laissait donc la demande sans reprise. Les erreurs de prise en charge et d'écriture des états finaux étaient aussi ignorées.

Le traitement est extrait dans `process-account-deletions/processor.ts`, avec dépendances injectables pour tester sans compte réel. Il sélectionne les demandes échues `pending` et les demandes `processing` démarrées depuis plus de 30 minutes, dont l'utilisateur est encore identifié. La prise en charge compare l'identifiant, l'utilisateur, le statut et, pour une reprise, le début de traitement précédemment lu. Les écritures finales exigent le statut `processing` et le début de traitement de la tentative propriétaire. Toute erreur de prise en charge ou d'acquittement remonte au point d'entrée HTTP ; un échec de l'acquittement final n'est pas reclassé comme un échec de la purge.

Le délai de 30 minutes est une marge par rapport à la [durée maximale documentée des Edge Functions hébergées](https://supabase.com/docs/guides/functions/limits), actuellement 400 secondes pour les offres payantes. Cette hypothèse doit être revue avant usage sur un runtime non borné ou si les limites hébergées changent. Ce n'est pas un mécanisme de clôture des requêtes externes déjà envoyées.

## Vérifications locales

Huit tests couvrent demandes échues/actives/futures/annulées/échouées, deux acquisitions concurrentes depuis pending et processing, erreurs de prise en charge/acquittement/échec, perte du propriétaire et erreur de purge. Faux client et purge simulée uniquement. Types Edge et sémantique serveur validés. Le chemin de traitement historique a été retiré du point d'entrée, qui conserve ses contrôles de méthode et de secret.

## Limites avant activation

- Aucun déploiement de fonction, aucune migration distante et aucune suppression de compte réel effectués. Les migrations de la file sont désormais testées dans un conteneur PostgreSQL isolé.
- Les demandes `failed`, `processing` sans date ou sans utilisateur et sans preuve de nettoyage ne sont pas reprises automatiquement. Une demande ancienne sans utilisateur peut être clôturée seulement si `data_purged_at` prouve que le nettoyage applicatif avait été confirmé avant la suppression Auth. Aucun remplissage rétroactif de cette preuve.
- La purge multi-services elle-même reste à éprouver sur un compte dédié : reprise Storage, conservation des données Trip partagées et opérations d'anonymisation. Les cinq écritures de nettoyage dont les erreurs étaient ignorées sont désormais contrôlées localement ; un échec arrête le parcours avant la suppression Auth. Les écritures antérieures réussies ne sont pas annulées.
- Les prédicats du processeur sont testés avec un faux client ; les invariants d'acquisition et d'acquittement SQL sont aussi vérifiés avec deux connexions PostgreSQL réelles. Le parcours intégré via PostgREST, Auth et Storage reste à valider.
- Aucun index supplémentaire n'est proposé avant mesure de la requête en base.

F13 est donc partiellement corrigé localement, pas clos. Ne pas activer ce lot en production avant les validations et la revue des cas partiels ci-dessus.

Complément du 24 novembre : cinq pannes de nettoyage reproduites avant correction (membres Trip, participants, propriétaires de biens et auteur de clôture). Six tests de la purge, avec faux client uniquement, vérifient l'arrêt avant Auth et la réussite du parcours sans erreur. Avec les huit tests du processeur, 14 scénarios ciblés passent. Aucun autre code mort directement lié identifié ; les appels nécessaires sont conservés et leurs résultats contrôlés.

Validation finale locale : chaîne quality complète réussie, 1 284 tests / 183 fichiers, types Edge (16 sources), sémantique serveur (25 sources), compilation et budgets réussis. Aucun déploiement, aucune requête de purge réelle et aucune migration effectués.

## Étape enregistrée avant Auth — complément local

Migration préparée `20261124090000_account_deletion_checkpoint.sql`, non appliquée : colonne nullable `data_purged_at`, sans identifiant utilisateur supplémentaire ni changement des droits. À appliquer avant la fonction mise à jour. La purge attend l'enregistrement de cette étape, conditionné au propriétaire du traitement, avant de supprimer Auth. En cas d'échec, Auth n'est pas appelé. Le point d'entrée de purge administrateur conserve son fonctionnement sans cette étape optionnelle.

Si l'acquittement final échoue après la suppression Auth, la reprise après expiration clôture uniquement la demande avec preuve, sans rejouer une purge avec un identifiant nul. Les anciennes demandes sans preuve restent exclues. Tests supplémentaires : ordre étape/Auth, erreur de persistance, panne après suppression Auth puis réconciliation, exclusion de la demande sans preuve.

Huit critères de sélection ont été évalués sur PostgreSQL avec un SELECT de valeurs synthétiques uniquement : tous correspondent au résultat attendu. Aucune table utilisateur lue ou modifiée. Docker local indisponible (moteur arrêté) ; concurrence SQL à deux connexions et exécution réelle de la migration restent non validées.

Lors d'une reprise avec utilisateur encore présent, l'ancienne valeur data_purged_at est remise à null avant la nouvelle purge : elle ne peut pas servir de preuve pour un nettoyage interrompu ultérieurement. Cas couvert par un test dédié. 19 tests ciblés du processeur et de la purge passent.

Validation après ce complément : **quality complet réussi, 1 289 tests / 183 fichiers**, contrôles de types et de sémantique, documentation, compilation et budgets inclus. Ces résultats remplacent le décompte intermédiaire de 1 284 tests ci-dessus. Le lot demeure local : migration non appliquée, fonction non déployée et aucune suppression réelle. La concurrence PostgreSQL et le parcours multi-services restent les prochaines validations nécessaires.

## Validation PostgreSQL isolée — suite du 24 novembre

Docker a pu démarrer. Le script `npm run test:sql:account-deletion` crée un conteneur PostgreSQL 17.6 à image fixée par digest, sans réseau externe ni port publié. Il applique les fichiers réels de création de la file et d'ajout de `data_purged_at`, ce dernier deux fois. Il utilise une table Auth minimale et des UUID fictifs ; il ne restaure aucune donnée utilisateur. Seuls ce conteneur et ses volumes anonymes sont supprimés à la fin.

Résultats réussis : migration idempotente sans remplissage rétroactif, RLS conservée, droits refusés à anon/authenticated, droit d'écriture de service_role sur la nouvelle colonne, acquisition concurrente depuis pending et processing avec attente sur verrou observée, rejet de l'acquittement par l'ancien propriétaire, conservation du checkpoint lors du `ON DELETE SET NULL` de la clé étrangère Auth.

Cette vérification dépasse les simulations SQL précédentes, mais les requêtes d'acquisition sont exprimées directement en SQL dans le script : elle ne teste pas la traduction du client PostgREST ni l'API Auth. Le parcours complet Storage/Trip/Auth avec le véritable processeur sur compte de test reste nécessaire avant activation. Aucune modification distante. Le script est volontairement séparé de quality, car Docker doit être disponible ; `DOCKER_BIN` permet de préciser le chemin de son exécutable.

Limite du dernier passage : après le premier succès complet et son nettoyage confirmé, un second lancement avec image fixée par digest et connexion TCP interne a validé migration/droits et concurrence pending, puis le moteur Docker est devenu indisponible. L'exécutable Windows a ensuite disparu du chemin installé. Ce second passage n'est pas validé et son nettoyage n'a pas pu être confirmé. À la remise à disposition de Docker, identifier le conteneur résiduel `tb-f13-test-*` de cet essai, vérifier son identité avant suppression, puis relancer le script. Les 1 289 tests applicatifs précédents ne sont pas affectés par cette panne d'environnement ; aucun code applicatif n'a été modifié dans cette étape de vérification SQL.

## Revalidation du 25 novembre 2026

Docker est de nouveau disponible. Le conteneur résiduel `tb-f13-test-3ec6fac2-873a-4227-83b4-f618eeeadd6e` a été inspecté (image PostgreSQL attendue, réseau none, aucun port publié, volume anonyme), puis supprimé avec son volume. Leur absence a été vérifiée. Le script final utilisant le digest fixé et la connexion TCP interne passe intégralement ; le nettoyage de ses conteneurs est confirmé.

Deux contrôles supplémentaires couvrent l'annulation avec les prédicats SQL du point d'entrée existant : une annulation validée pendant que le processeur attend le verrou empêche sa prise en charge ; une annulation demandée après passage à processing ne modifie aucune ligne. Les courses pending/processing, l'acquittement périmé, la migration idempotente, les droits et la clé étrangère restent validés. Journal local : `.codex/releases/diagnostics/account-deletion-postgres-20261125.log`.

La réserve Docker du 24 novembre est levée. Cette étape n'a modifié que le test SQL et le suivi, pas le processeur applicatif. Les tests SQL directs ne valident toujours pas le parcours intégré PostgREST/Auth/Storage ; aucune activation ni migration distante effectuée.

## Inventaire plafonné — correctif local du 25 novembre

La lecture partagée `selectAll` retournait silencieusement les 50 000 premières lignes. Une purge pouvait donc poursuivre le nettoyage des tables et Auth après un inventaire incomplet des fichiers ou groupes Trip. Le dépassement est reproduit par un test avec 50 001 documents avant correction. La lecture vérifie maintenant une ligne supplémentaire et lève une erreur explicite si le plafond est dépassé ; un inventaire de 50 000 lignes exactement reste accepté. La purge s'arrête alors avant Auth. Ce garde-fou ne permet pas encore de traiter ces très grands comptes.

Deux tests supplémentaires passent, soit 21 scénarios ciblés. Types Edge (16 sources) et sémantique serveur (25 sources) validés. Le helper reste utilisé par l'export : les lectures qui y sont capturées comme avertissements produisent désormais un avertissement explicite plutôt qu'une liste tronquée silencieuse. Aucun helper inutilisé identifié dans ce périmètre. L'inventaire ne constitue toujours pas un instantané transactionnel en cas d'écritures concurrentes ; le parcours intégré multi-services reste ouvert. Correction locale uniquement.

Validation globale après correction : 1 291 tests / 183 fichiers réussis. Documentation et Atlas régénérés et vérifiés. La chaîne quality complète n'a pas été relancée pour ce seul changement serveur ; les tests applicatifs complets et les contrôles Edge/serveur ont été exécutés.

## Processeur réel via PostgREST — 25 novembre 2026

`npm run test:rest:account-deletion` réussit. Il reprend les contrôles PostgreSQL, puis lance PostgREST v14.13 (image fixée par digest) sur un port aléatoire lié uniquement à `127.0.0.1`. PostgreSQL n'a aucun port publié. Le script Deno `scripts/check-account-deletion-rest.ts` importe le véritable processeur et `supabase-js@2.57.4`, comme les Edge Functions, avec le verrou de dépendances existant gelé.

Vérifications réussies : sélection des demandes échues, expirées et réconciliables ; exclusion des demandes actives, futures, annulées, échouées, sans date ou sans preuve ; deux processeurs concurrents via HTTP ne déclenchent qu'une purge ; checkpoint écrit en base, échec injecté du PATCH final, puis réconciliation sans nouvel appel de purge. Le typage du nouveau script a aussi été vérifié. Journal local : `.codex/releases/diagnostics/account-deletion-rest-20261125.log`. Les deux conteneurs et leurs volumes ont été supprimés et leur absence contrôlée.

Portée précise : PostgREST utilise `service_role` comme rôle anonyme uniquement dans ce serveur de test local ; les en-têtes d'authentification sont retirés par l'adaptateur de test. Ce test ne valide ni JWT ni garde HTTP de la fonction. La purge injectée reste simulée et la disparition Auth est représentée par une mise à null en base. Il reste donc à éprouver `purgeAccount` avec les véritables services Auth/Storage, les données Trip partagées et les interruptions entre services. Aucune migration distante, aucun déploiement et aucune suppression de compte réel.

## Purge réelle sur fixtures Trip persistées — suite du 25 novembre

Le test REST appelle maintenant aussi la véritable fonction `purgeAccount`, avec ses requêtes PostgREST exécutées sur des tables PostgreSQL de test. Un groupe appartenant au compte à supprimer, deux participants, un membre identifié, deux dépenses de 42 et 17 et une quote-part de 21 sont persistés. Les tables sont des fixtures minimales construites à partir de la liste explicite des tables du code, pas une copie du schéma de production.

Scénarios réussis : erreur Storage simulée avant toute mutation Trip ; erreur HTTP injectée au transfert des dépenses après transfert de la quote-part ; reprise réussie, groupe et lignes transférés au successeur, montants conservés sans doublon, membre anonymisé, participant sortant retiré, participant restant conservé et document supprimé de la table. Le checkpoint et l'appel Auth simulé ne surviennent qu'après les nettoyages ; ils ne sont pas appelés pendant les deux échecs.

`npm run test:rest:account-deletion` complet et typage Deno réussis. Journal : `.codex/releases/diagnostics/account-deletion-purge-rest-20261125.log`. Conteneurs supprimés. Aucun changement applicatif dans cette étape, seulement le banc de test.

Limites maintenues : Auth et Storage restent des doubles de test ; les contraintes, cascades, triggers et politiques métier réelles ne sont pas reproduits par les fixtures minimales. Ce scénario ne couvre que le groupe possédé par le compte sortant avec successeur identifié. Examiner aussi les données du compte dans des groupes possédés par d'autres, l'absence de successeur et les changements concurrents de participants avant clôture de F13. Aucun déploiement ni traitement de données personnelles.

## Conflit avec le garde-fou des liens budgétaires — 25 novembre

La revue des migrations a révélé que le transfert de `trip_expense_budget_links.user_id` au successeur violait `trip_validate_budget_link_integrity` : la transaction personnelle liée appartient toujours au compte sortant. Le banc REST applique maintenant la définition réelle de cette fonction et de son trigger depuis `20260606084112_harden_trip_budget_links_and_delete.sql`. Une dépense partagée avec deux liens et deux transactions appartenant à des utilisateurs distincts reproduit l'erreur avant correction : `Trip budget link transaction does not belong to user`.

Correction locale : retrait des liens budgétaires de la liste des lignes transférées. Leur suppression reste assurée par `DELETE_ORDER`, avec filtre sur le compte sortant, avant suppression de ses transactions. Les liens et transactions de l'autre participant sont conservés. Aucune réattribution de budget personnel au successeur. Les appels d'export et de suppression nécessaires sont conservés ; seule l'opération de transfert incorrecte a été retirée.

Le test REST complet passe après correction, y compris les interruptions précédentes. Il vérifie les identifiants, propriétaires et montants du lien et de la transaction restants. Journaux locaux : `account-budget-link-before-20261125.log` et `account-budget-link-after-20261125.log` dans `.codex/releases/diagnostics/`. Ce trigger est désormais couvert réellement ; les autres contraintes/triggers, les cas de groupes possédés par d'autres et les services Auth/Storage restent à éprouver. Aucun déploiement.

## Contributions à un voyage appartenant à un tiers — 25 novembre

Défaut reproduit sur PostgreSQL/PostgREST : les dépenses du compte sortant dans un groupe appartenant à un tiers étaient supprimées, car la préservation ne parcourait que ses propres groupes. Le test fait disparaître la ligne de participant avant la purge pour vérifier que cette seule relation n'est pas nécessaire à la découverte du voyage.

Correction locale : découverte des groupes à partir des lignes partagées possédées par le compte (dépenses, quotes-parts, membres, remboursements et liens documentaires), en complément des groupes possédés. Pour un groupe appartenant à un tiers, le propriétaire existant reçoit la propriété technique de ces lignes ; le groupe lui-même ne change pas de propriétaire et n'incrémente pas le compteur des groupes transférés. Les liens budgétaires personnels restent supprimés selon le correctif précédent. La même liste de tables sert à la découverte et au transfert, sans duplication de logique de nettoyage.

Le scénario REST complet passe : dépense de 53, quote-part de 26,5 et remboursement de 12 conservés, membre anonymisé, propriétaire du voyage inchangé. Journaux locaux : `account-contributor-before-20261125.log` (perte reproduite) et `account-contributor-after-20261125.log` (correction validée), dans `.codex/releases/diagnostics/`. Les 21 tests ciblés passent également. Aucun déploiement ni modification de données utilisateur.

Limites restantes : schéma métier complet et ses autres contraintes/triggers, Auth/Storage réels, groupes sans successeur et mutations concurrentes de propriété/participants. La découverte et le transfert ne constituent pas encore une transaction atomique sur l'ensemble des services. F13 n'est pas clos.

## Découverte et absence de successeur — complément du 25 novembre

Trois scénarios supplémentaires passent dans le banc PostgreSQL/PostgREST avec la véritable purge :

- Échec HTTP lors de la lecture des groupes auxquels le compte a contribué : aucune suppression de ligne partagée, aucun checkpoint et aucun appel Auth ; les références du membre et de la dépense restent intactes. Storage est traité auparavant, ce test ne prouve donc pas l'absence de toute mutation externe.
- Voyage possédé par le compte, avec seulement un membre invité non authentifié et sans successeur : suppression des lignes privées du voyage, sans modifier les dépenses des autres groupes.
- Absence de ligne de participant, mais présence d'un membre authentifié restant : transfert au membre identifié, conservation de son identité et de la dépense partagée.

Commande complète `npm run test:rest:account-deletion` et typage Deno réussis ; journal `.codex/releases/diagnostics/account-trip-edgecases-20261125.log`. Nettoyage des conteneurs terminé. Aucun changement applicatif dans ce complément : il valide les branches existantes. Le scénario sans successeur est couvert sur fixtures, pas sur toutes les cascades du schéma réel. Auth/Storage réels, contraintes restantes et changements concurrents de propriété/participants restent ouverts. Aucun déploiement.

## Contrôle d'accès du point d'entrée — 25 novembre

Onze tests importent le véritable `process-account-deletions/index.ts` et capturent son handler `Deno.serve`. Ils vérifient le refus avant création du client administrateur pour secret absent/vide/incorrect, configuration serveur absente/vide et méthodes GET/PUT/DELETE ; OPTIONS ne lance aucun traitement. Le POST autorisé invoque une seule fois le processeur, et une erreur de persistance renvoie 500 sans réponse de succès.

Les 32 tests ciblés (point d'entrée, processeur, purge) passent. Les appels au backend sont remplacés par des doubles et le serveur HTTP Deno n'est pas démarré : cette couverture valide le garde-fou du code, pas la passerelle Edge déployée, les JWT, la distribution/rotation du secret ou les services Auth/Storage. Aucun changement applicatif nécessaire dans ce lot. Les contrôles de méthode et de secret existants restent utilisés ; aucun code mort directement lié identifié.

## Réponse Auth perdue après nettoyage — 25 novembre

Deux tests reproduisent un blocage supplémentaire : une erreur après le checkpoint, notamment une réponse Auth perdue, classait la demande en `failed`, exclue des reprises, que l'utilisateur ait effectivement disparu ou non.

Le processeur mémorise maintenant la confirmation du checkpoint pour la tentative courante. Une erreur ultérieure conserve `processing`, enregistre son motif et remonte une erreur HTTP ; elle ne déclare pas la suppression réussie. Après expiration du délai de reprise, la demande avec utilisateur disparu est réconciliée sans purge supplémentaire ; celle dont l'utilisateur existe encore reprend le nettoyage. Les erreurs antérieures au checkpoint restent traitées comme échecs de purge. Un ancien checkpoint est toujours invalidé lors d'une nouvelle tentative avec utilisateur présent.

Validation : 34 tests ciblés réussis ; suite complète **1 304 tests / 184 fichiers** réussie. Le scénario PostgreSQL/PostgREST vérifie également l'erreur après checkpoint et disparition simulée de l'utilisateur, puis la réconciliation. Journaux locaux `account-auth-response-20261125.log` et `account-auth-response-tests-20261125.log`. Conteneurs nettoyés par le banc de test. Auth/Storage ne sont toujours pas des services réels dans ce banc.

Limite opérationnelle : une erreur Auth persistante après checkpoint reste reprenable et pourra donc se répéter à chaque expiration du délai ; le motif est conservé, mais aucun plafond de tentatives ni mécanisme d'alerte n'est ajouté dans ce correctif. Aucun déploiement ni modification de compte réel.

## Périmètre des fichiers Storage — 25 novembre

La purge et l'export transmettaient les références `storage_bucket`/`storage_path` des lignes applicatives au client administrateur sans contrôle du chemin. Des références étrangères ont été reproduites dans les tests : elles étaient acceptées pour suppression. Cela démontre l'absence de garde-fou dans ce code, pas une exploitation ou la possibilité effective de modifier ces références sur le déploiement courant.

Une validation partagée limite maintenant les opérations privilégiées aux formats produits par les uploads du dépôt : `personal-documents/<userId>/…` et `inbox-documents/whatsapp/<userId>/…`. Les documents issus d'Inbox conservent ce second format. Buckets non prévus, préfixes d'un autre compte, segments vides/`.`/`..`, caractères de contrôle, antislashs et encodages `%` sont refusés avant l'appel Storage. La purge valide tout son inventaire avant la première suppression de fichier. L'export vérifie également le chemin avant de créer chaque lien signé.

Sept refus ont été reproduits avant correction. Après correction, ces refus, les deux formats autorisés, la déduplication document/Inbox et l'absence de lien signé pour un chemin étranger sont validés : 44 tests F13 ciblés passent. La référence documentaire du banc REST utilise désormais le format réellement généré par l'application. Le contrôle est partagé plutôt que dupliqué ; les appels d'export/purge utiles sont conservés.

Limite : les chemins historiques ou buckets non reconnus bloquent explicitement l'opération et nécessiteront une vérification, pas une suppression automatique. Les droits et objets Storage réels n'ont pas été interrogés pour ces tests ; aucun fichier utilisateur touché. Correctif local, non déployé.

Validation finale du lot : scénario PostgreSQL/PostgREST complet réussi avec le chemin documentaire corrigé, typage Edge et script Deno, sémantique serveur et 44 tests ciblés réussis. Suite globale : 1 313 tests réussis et un timeout du contrôle `serverSemanticLint` à 5 secondes ; les quatre tests de ce fichier passent à la relance isolée en 1 seconde, sans changement du code ni du délai. Ne pas présenter ce premier passage global comme entièrement vert. Journaux : `account-storage-boundary-tests-20261125.log` et `account-storage-boundary-rest-20261125.log`. Nettoyage du banc terminé.
