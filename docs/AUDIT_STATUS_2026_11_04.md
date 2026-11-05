# Point d’audit — 4 novembre 2026

Ce point complète le rapport du 10 octobre sans remplacer ses preuves historiques. Il distingue correction, publication et validation réelle. Les constats SQL non revérifiés ne sont pas présentés comme des mesures actuelles de production.

## Progression par étape

1. Android : runtime corrigé ; APK 10.5.388 reconstruit, signé et publié avec comparaison des sources et SHA-256 distant. CI du commit `d27e3435` réussie (run 41598663474). Validation sur téléphone encore à faire.
2. Architecture/qualité : avancée importante, encore ouverte. Reprise des chargements, isolation des réponses par compte, performance du Dashboard, contrôle des sources et protection des révisions hors ligne ont été traités. La persistance locale et la concurrence entre onglets restent à consolider.
3. Base de données : revue systématique restante. Des interventions ciblées Trip et MCP ont été livrées ; elles ne ferment pas la dette SQL générale.
4. Fonctionnel : plusieurs priorités utilisateur ont été corrigées (remboursements Trip, wallets, projections prépayées, comptabilité, pointage). Elles ne valent pas clôture de tous les constats fonctionnels de l’audit.

## État des quinze constats

| Constat | État et travail restant |
|---|---|
| F1 — Capacitor vulnérable | Runtime remplacé, APK distribué. Essais appareil réels restants. |
| F2 — Perte d’une modification pendant synchronisation | Révisions et tentatives protégées ; doubles démarrages et changement de compte traités. Stockage transactionnel entre onglets et renouvellement du verrou restants. |
| F3 — Réintégration dans le budget | Clôture non démontrée. Vérifier la transition SQL et les distinctions dépense/avance/quote-part avant correction. |
| F4 — Fausse sauvegarde Nutrition | Partiel : résultat du stockage sécurisé respecté et ajouts de repas bloqués sur échec, avec export/reprise en mémoire isolés par compte. Complément du 5 novembre : modifications, suppressions, sommeil et acquittements locaux vérifiés ; champs conservés et optimisme annulé sur échec. Validation quota réel/appareil et concurrence pendant la synchronisation restantes. |
| F5 — Troncature à 200 repas | Correctif web : suppression de la limite des écritures en attente, y compris le secours legacy. Tests de 201 et 5 000 entrées avec rechargement. L’APK 10.5.388 publié ne contient pas ce nouveau lot ; quota plein couvert séparément par F4. |
| F6 — Sport partiellement synchronisé | Ouvert : rendre la sauvegarde complète atomique ou reprendre tous les enfants avant acquittement. |
| F7 — Collections et suppression Trip | Remboursements ciblés corrigés. Pagination des collections et suppression complète transactionnelle encore à traiter. |
| F8 — Chargement mémorisant un échec | Chargeurs, imports métier et bridge corrigés/testés. Erreurs d’évaluation, dépendances internes et autres moteurs restent à couvrir. |
| F9 — Mesures de performance incomplètes | Dépendances locales verrouillées, graphiques différés, parcours compilés anonymes/connectés synthétiques et optimisations Dashboard livrés. Validation téléphone/compte réel restante. |
| F10 — Chaîne qualité insuffisante | Syntaxe, types Edge, sémantique moderne/serveur et règles legacy intégrées ; CI, E2E et budgets actifs. Couverture sémantique legacy encore ciblée, tests SQL et appareils à compléter. |
| F11 — Dette SQL sécurité/performance | Revue générale à mener : privilèges RPC, RLS, index et paramètres Auth. Les anciens nombres d’advisors nécessitent une nouvelle mesure. |
| F12 — CSP non active | Protection stricte du consentement MCP ajoutée ; CSP générale toujours en Report-Only. Déploiement progressif global restant. |
| F13 — Suppression de compte interrompue | Clôture non démontrée ; reprise idempotente et tests sur compte dédié nécessaires. |
| F14 — Comptabilité manuelle locale | Toujours une limite multi-appareil. Le partage au connecteur ne remplace pas une synchronisation complète avec conflits et restauration. |
| F15 — Aide et identité divergentes | Page Projet/Atlas et connecteur améliorés. L’assistant d’aide contient encore « The accounting module is not implemented » : alignement des capacités et déploiement serveur restants. |

## Prochaine séquence

Demande fonctionnelle différée : [connexion Google Agenda](BACKLOG.md#google-agenda). Elle est enregistrée pour plus tard et ne remplace pas les priorités de correction ci-dessous.

Le correctif F5 a passé les contrôles locaux et les six tests navigateur ciblés (détails dans `docs/QUALITY_PIPELINE.md`). Les principaux chemins locaux de F4 ont été protégés le 5 novembre ; conserver les limites de concurrence et validation réelle dans le suivi. Ouvrir ensuite un lot SQL borné et mesuré (F11, avec les invariants F3/F6/F7), en conservant les contrôles d’isolation. Éviter de prolonger indéfiniment le nettoyage stylistique au détriment des risques de perte de données.

Les alertes npm de la livraison du 3 novembre restent un chantier séparé : 0 critique, 4 élevées, 8 modérées à cette date. Aucun pourcentage global de clôture n’est attribué : plusieurs constats ont des critères de validation encore ouverts.
