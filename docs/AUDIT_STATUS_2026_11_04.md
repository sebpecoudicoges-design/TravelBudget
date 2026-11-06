# Point d’audit — 4 novembre 2026

Ce point complète le rapport du 10 octobre sans remplacer ses preuves historiques. Il distingue correction, publication et validation réelle. Les constats SQL non revérifiés ne sont pas présentés comme des mesures actuelles de production.

## Progression par étape

1. Android : runtime corrigé ; APK 10.5.388 reconstruit, signé et publié avec comparaison des sources et SHA-256 distant. CI du commit `d27e3435` réussie (run 41598663474). Validation sur téléphone encore à faire.
2. Architecture/qualité : avancée importante, encore ouverte. Reprise des chargements, isolation des réponses par compte, performance du Dashboard, contrôle des sources et protection des révisions hors ligne ont été traités. La persistance locale et la concurrence entre onglets restent à consolider.
3. Base de données : revue reprise le 5 novembre. Premier doublon d’index transactions retiré en production après contrôle des dépendances et essai annulé ; diagnostics actualisés dans [le point SQL](SQL_AUDIT_2026_11_05.md). La dette SQL générale reste ouverte.
4. Fonctionnel : plusieurs priorités utilisateur ont été corrigées (remboursements Trip, wallets, projections prépayées, comptabilité, pointage). Elles ne valent pas clôture de tous les constats fonctionnels de l’audit.

## État des quinze constats

| Constat | État et travail restant |
|---|---|
| F1 — Capacitor vulnérable | Runtime remplacé, APK distribué. Essais appareil réels restants. |
| F2 — Perte d’une modification pendant synchronisation | Révisions et tentatives protégées ; doubles démarrages et changement de compte traités. Stockage transactionnel entre onglets et renouvellement du verrou restants. |
| F3 — Réintégration dans le budget | Partiel : correction serveur appliquée le 5 novembre pour dépenses/entrées ordinaires, aller-retour SQL testé. Avances, quotes-parts et autres écritures source exclues de la réactivation automatique ; parcours Trip et trois vues sur compte réel restent à valider. |
| F4 — Fausse sauvegarde Nutrition | Partiel : résultat du stockage sécurisé respecté et ajouts de repas bloqués sur échec, avec export/reprise en mémoire isolés par compte. Complément du 5 novembre : modifications, suppressions, sommeil et acquittements locaux vérifiés ; champs conservés et optimisme annulé sur échec. Validation quota réel/appareil et concurrence pendant la synchronisation restantes. |
| F5 — Troncature à 200 repas | Correctif web : suppression de la limite des écritures en attente, y compris le secours legacy. Tests de 201 et 5 000 entrées avec rechargement. L’APK 10.5.388 publié ne contient pas ce nouveau lot ; quota plein couvert séparément par F4. |
| F6 — Sport partiellement synchronisé | Ouvert : rendre la sauvegarde complète atomique ou reprendre tous les enfants avant acquittement. |
| F7 — Collections et suppression Trip | Remboursements ciblés corrigés. Pagination des collections et suppression complète transactionnelle encore à traiter. |
| F8 — Chargement mémorisant un échec | Chargeurs, imports métier et bridge corrigés/testés. Erreurs d’évaluation, dépendances internes et autres moteurs restent à couvrir. |
| F9 — Mesures de performance incomplètes | Dépendances locales verrouillées, graphiques différés, parcours compilés anonymes/connectés synthétiques et optimisations Dashboard livrés. Validation téléphone/compte réel restante. |
| F10 — Chaîne qualité insuffisante | Syntaxe, types Edge, sémantique moderne/serveur et règles legacy intégrées ; CI, E2E et budgets actifs. Couverture sémantique legacy encore ciblée, tests SQL et appareils à compléter. |
| F11 — Dette SQL sécurité/performance | Premier lot appliqué le 5 novembre : doublon exact sur transactions.wallet_id retiré, index conservé vérifié. Groupes d’index identiques : 12 → 11. Autres diagnostics actualisés ; privilèges RPC, RLS et paramètres Auth encore à traiter. |
| F12 — CSP non active | Protection stricte du consentement MCP ajoutée ; CSP générale toujours en Report-Only. Déploiement progressif global restant. |
| F13 — Suppression de compte interrompue | Clôture non démontrée ; reprise idempotente et tests sur compte dédié nécessaires. |
| F14 — Comptabilité manuelle locale | Toujours une limite multi-appareil. Le partage au connecteur ne remplace pas une synchronisation complète avec conflits et restauration. |
| F15 — Aide et identité divergentes | Page Projet/Atlas et connecteur améliorés. L’assistant d’aide contient encore « The accounting module is not implemented » : alignement des capacités et déploiement serveur restants. |

## Prochaine séquence

Demande fonctionnelle différée : [connexion Google Agenda](BACKLOG.md#google-agenda). Elle est enregistrée pour plus tard et ne remplace pas les priorités de correction ci-dessous.

Le correctif F5 a passé les contrôles locaux et les six tests navigateur ciblés (détails dans `docs/QUALITY_PIPELINE.md`). Les principaux chemins locaux de F4 ont été protégés le 5 novembre ; conserver les limites de concurrence et validation réelle dans le suivi. Le premier lot F11 est appliqué ; poursuivre par les invariants de réintégration budgétaire F3, puis F6/F7, en conservant les contrôles d’isolation. Éviter de prolonger indéfiniment le nettoyage stylistique au détriment des risques de perte de données.

Les alertes npm de la livraison du 3 novembre restent un chantier séparé : 0 critique, 4 élevées, 8 modérées à cette date. Aucun pourcentage global de clôture n’est attribué : plusieurs constats ont des critères de validation encore ouverts.

6 novembre 2026 — F3/F7, édition Trip. La préparation de l’édition relit le paiement principal côté serveur et arrête le flux sur erreur de lecture ou de suppression. La suppression de chaque ancienne quote-part entraîne celle de son lien par la contrainte SQL ON DELETE CASCADE, vérifiée sur la base déployée. Une reprise relit les liens encore présents. Les tests injectent des pannes dans le chemin d’édition et vérifient la conservation du brouillon et du paiement. Les écritures déjà réussies avant une panne restent appliquées. Le remplacement complet des écritures en une transaction et les contrôles des trois vues restent ouverts.

6 novembre 2026 — Édition Trip atomique, migration 20261106052013. L’édition et sa reprise hors ligne appellent trip_edit_expense_atomic_v1. Le serveur verrouille la dépense et regroupe répartition, remplacement du paiement, quote-part personnelle et liens dans une transaction. Une erreur après le retrait des anciennes écritures restaure leurs identifiants et leurs montants. Les demandes aux participants partent après confirmation. Une écriture déjà validée sur le compte d’un autre participant bloque la modification pour préserver ses données. Pour un paiement ou une part personnelle à enregistrer, un wallet dans la bonne devise est requis.

Tests SQL sur données synthétiques annulées après chaque campagne, avant puis après application. Débit brut de 100, part personnelle de 40, sortie et retour dans le budget, part nulle, part intégrale, changement de payeur et de type, refus d’accès hors Trip, erreur FX après suppression et restauration des anciennes lignes. Rôle authenticated autorisé, anon refusé. Tests client sur conservation du brouillon, confirmation serveur et choix de wallet. La création de dépense et la suppression du Trip entier restent des parcours distincts. L’APK 10.5.388 utilise encore le parcours antérieur.
