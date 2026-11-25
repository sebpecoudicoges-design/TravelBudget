# Passation TravelBudget — 25 novembre 2026

## Référence Git et consignes

- Dépôt public : https://github.com/sebpecoudicoges-design/TravelBudget
- Tête distante `main` vérifiée par `git ls-remote` le 25 novembre : `bf5daa6fd7d212d388330a0ae53083194dadfb9e` — `fix: preserve pending nutrition edits and unreadable data in 10.5.396`.
- Branche de passation préparée localement : `codex/handoff-audit-2026-11-25`. Aucun push autorisé dans cette étape ; ne pas supposer que cette branche existe sur GitHub.
- Aucun push sur main, aucun déploiement, aucune migration distante, aucune reconstruction Android pour cette passation.
- Le lot comprend uniquement code, tests, migration non appliquée et documentation. Journaux locaux, captures, fichiers .env, dumps, APK/AAB et signatures exclus. Les identifiants des fixtures sont fictifs.
- Les données personnelles de l'ancien exemple financier et l'adresse personnelle du backlog sont retirées de sa version préparée. L'historique déjà public du dépôt n'est pas réécrit.

## Corrections et preuves

| Audit | Travail contenu dans la branche locale | Validation réellement exécutée | Limites |
|---|---|---|---|
| F4 — Nutrition/Sommeil | Lecture stricte avant sauvegarde/fusion ; les historiques illisibles ne sont pas remplacés ; helper partagé avec les repas | Cinq cas de lecture invalide dans la suite finale | localStorage reste non transactionnel entre onglets ; conflits distants non résolus globalement |
| F13 — reprise de suppression | Acquisition conditionnelle, contrôle des erreurs, reprise après expiration, checkpoint avant Auth, réconciliation après disparition de l'utilisateur, réponse Auth perdue maintenue reprenable | Tests unitaires du point d'entrée/processeur/purge, migration exécutée deux fois et concurrence réelle à deux connexions PostgreSQL ; processeur réel via SDK Supabase 2.57.4 et PostgREST | Migration `20261124090000_account_deletion_checkpoint.sql` non appliquée à distance ; la déployer avant le processeur uniquement après validation restante |
| F13 — préservation Trip | Erreurs de nettoyage contrôlées ; liens budgétaires personnels non transférés ; contributions aux voyages de tiers conservées ; membre sortant anonymisé | Scénarios persistés avec interruptions/reprise, cas sans successeur, membre sans participant et véritable trigger d'intégrité des liens budgétaires | Fixtures de schéma minimales : pas toutes les contraintes/cascades/triggers ; changements concurrents de propriétaires/participants encore ouverts |
| F13 — inventaire/Storage | Dépassement de 50 000 lignes refusé ; chemins étrangers ou ambigus refusés avant suppression ou signature d'export | Limite exacte et dépassement testés ; sept refus de chemins reproduits avant correction, formats Documents/WhatsApp et export vérifiés | Auth/Storage restent simulés ; vérifier les chemins historiques et les objets réels en environnement isolé ; aucune exploitation démontrée |
| F15 — aide comptable | Suppression de l'affirmation erronée niant la Comptabilité ; destination accounting autorisée serveur/client ; bouton traduit | Contrat serveur-client et quatre parcours Playwright clair/sombre à 1440/390 px | Réponses IA simulées ; fonction et client non publiés ; autres capacités de l'aide à revoir |

Validation finale avant préparation de la passation : `npm run quality` réussi, **1 315 tests / 184 fichiers**, compilation, documentation et budgets compris. JS initial 278,9/279 KiB, total 879/879 KiB, plafonds inchangés. Quatre parcours `assistant-ai.spec.js` réussis, deux captures représentatives inspectées. Le timeout de lint observé dans un passage intermédiaire a été dépassé par cette validation complète réussie.

Le banc `npm run test:rest:account-deletion` a réussi après les changements Storage ; conteneurs nettoyés. Il importe le véritable processeur et la véritable purge, mais remplace les services Auth/Storage et l'authentification de la passerelle. Ne pas présenter ces résultats comme une validation de production ou une clôture de F13.

## Ce qui reste uniquement local

Périmètre préparé : **26 fichiers**. Revue des ajouts et scan ciblé des fichiers pour clés privées, jetons usuels/JWT, chemins de profil personnel, adresses non fictives et artefacts interdits : aucun signal restant. Ce contrôle concerne le lot de passation ; il ne certifie pas tout l'historique public.

- Données/client : `src/data/nutritionRepository.js`, `src/features/assistant/assistantAiClient.js`, `public/legacy/js/32_help_assistant.js`.
- Serveur : `supabase/functions/_shared/account-data.ts`, `supabase/functions/assistant-help/handler.js`, `supabase/functions/process-account-deletions/index.ts` et `processor.ts`.
- Migration préparée : `supabase/migrations/20261124090000_account_deletion_checkpoint.sql`.
- Banc isolé : `scripts/check-account-deletion-rest.ts`, `scripts/test-account-deletion-postgres.mjs`, commandes associées dans `package.json`.
- Tests : `tests/data/accountDeletionEndpoint.test.js`, `accountDeletionProcessor.test.js`, `accountPurgeFailure.test.js`, `nutritionPersistenceFailure.test.js` ; `tests/features/assistant/assistantAi.test.js` ; `tests/e2e/assistant-ai.spec.js`.
- Documentation : ce document, `ACCOUNT_DELETION_RECOVERY.md`, `ASSISTANT_AI_OPERATIONS.md`, `AUDIT_STATUS_2026_11_04.md`, `AUDIT_STATUS_2026_11_24.md`, `BACKLOG.md` ; inventaire JSON/Markdown dans `docs/generated` et `public/project-atlas.json`.

Tout le delta entre le commit distant ci-dessus et cette branche : correctifs Sommeil, F13, F15, tests, migration et suivis. Le backlog de revue complète d'Analyse est inscrit, mais cette revue n'a pas commencé. Les journaux de preuve et captures sont exclus de Git ; les commandes de reproduction et les limites sont conservées dans la documentation publique.

État de livraison consigné auparavant : web 10.5.396, APK 10.5.395 ; ce dernier n'inclut pas les ajouts locaux. Aucun déploiement ni APK n'a été revérifié pendant la préparation de cette passation. Ne pas confondre branche locale, push, web publié, APK distribué et validation appareil.

## Les trois prochaines priorités

1. **Achever F13 en environnement de test complet** : Auth/Storage réels, schéma métier et cascades, interruption/reprise, concurrence des propriétaires/participants, contrôle des chemins historiques, supervision des erreurs persistantes. Ne pas activer en production avant ces vérifications.
2. **Reprendre architecture et base de données** : F2/F4 (persistance transactionnelle, conflits et reprise entre onglets/appareils), puis F11 (advisors actuels, RLS et privilèges RPC). Les mesures SQL anciennes ne sont pas un état actuel.
3. **Revoir Analyse intégralement avec l'utilisateur** : matrice pour chaque KPI/graphique — besoin, sources, formule, dates, devises, inclusions/exclusions et rapprochement chiffré. Distinguer débit wallet brut, quote-part Trip, consommation budgétaire et résultat. Voir BACKLOG.md.

Visuels, publicités commerciales, Play Store, Google Agenda, sorties d'immobilisations et supports vidéo restent dans le backlog. Pas de publication implicite à la reprise.

## Synthèse à transmettre à Dot

Reprendre TravelBudget depuis la branche de passation seulement lorsqu'elle sera accessible, sinon depuis le workspace local. GitHub main est vérifié à bf5daa6fd7d212d388330a0ae53083194dadfb9e ; le lot de passation n'est pas poussé. Correctifs locaux : Sommeil protégé contre les lectures invalides, reprise et sécurité de purge de compte/Trip/Storage, aide comptable et navigation cohérentes. Quality : 1 315 tests/184 fichiers, build et budgets réussis ; 4 parcours aide clair/sombre desktop/mobile ; SQL/PostgREST réels mais Auth/Storage simulés. F13 reste ouvert. Priorités : test complet F13 isolé, architecture/persistance et revue SQL, puis Analyse graphique par graphique. Lire AGENTS.md, VISUAL_SYSTEM.md, ACCOUNT_DELETION_RECOVERY.md et AUDIT_STATUS_2026_11_24.md. Aucune publication, aucun push main, aucun déploiement sans nouvelle instruction explicite.

## Suite de la revue sur la branche cloud

- Les inventaires de purge parcourent toutes les pages, même lorsque l'API
  renvoie des pages plus courtes, et refusent les résultats incohérents.
- Une réponse Auth incertaine après checkpoint conserve la demande reprenable,
  sans empêcher le traitement des autres demandes déjà lues.
- Nouvelle validation Linux : 1 313 tests réussis ; 5 tests propres à
  Windows ignorés. Compilation web et APK debug de test vérifiés. Le contrôle
  des types Edge a expiré lors du téléchargement de dépendances.
- F13 reste ouvert : vérifier Auth, Storage et la conservation du contenu
  partagé avec le schéma complet, en environnement isolé. Ne pas appliquer
  la migration ni activer le processeur en production sur cette seule preuve.
