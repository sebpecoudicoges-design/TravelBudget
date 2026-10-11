# Audit critique TravelBudget — 10 octobre 2026

État audité : version 10.5.372, HEAD `6f1433a`, avec les modifications Trip locales déjà présentes. Date exprimée dans le fuseau Australia/Brisbane.

## Conclusion

Le projet a une richesse fonctionnelle et un socle de tests réels. Son principal problème est désormais la fiabilité des transitions : modification pendant synchronisation, réintégration dans le budget, sauvegarde partielle, chargement interrompu, changement de version ou d'appareil. Ajouter des fonctionnalités sans consolider ces transitions augmente le coût de maintenance et le risque de résultats silencieusement incomplets.

Priorités : corriger les pertes de données et le runtime Android vulnérable, sécuriser les invariants financiers, rendre la validation obligatoire avant livraison, puis poursuivre l'extraction du legacy. Une réécriture complète ne se justifie pas : les règles pures, les vues extraites et les contrats existants sont à conserver.

## Périmètre et degré de preuve

Inventaire transversal du dépôt, lecture approfondie des chemins critiques dans `src`, legacy, repositories, scripts, configuration, migrations et fonctions serveur. Consultation en lecture seule des advisors et de certaines définitions SQL du projet Supabase configuré dans le dépôt. Reproductions locales synthétiques sans données personnelles et tests automatisés existants.

Ce rapport ne prétend pas certifier chaque ligne des 616 fichiers suivis ni toutes les combinaisons fonctionnelles. Les binaires, dépendances tierces et archives ne sont pas une revue de code applicatif. La profondeur varie selon le risque ; la matrice ci-dessous la rend explicite. Aucune donnée distante modifiée, aucun correctif produit, commit, push ou déploiement effectué. Seuls les livrables de cet audit ont été ajoutés.

Non vérifiés : fonctionnement avec comptes réels distincts, cycle complet de suppression de compte, restauration réelle d'une sauvegarde, APK signé installé sur appareil, Safari/Firefox, état exact du déploiement web et de toutes les Edge Functions. Les E2E utilisent principalement des données et services simulés ; ils ne valident pas les autorisations SQL réelles.

## État mesuré

| Élément | Observation |
|---|---|
| Fichiers suivis par Git | 616 avant ajout de cet audit |
| Sources modernes | 105 fichiers sous `src`, dont 16 domaines `features` |
| Legacy JavaScript | 57 fichiers |
| Migrations SQL locales | 161 |
| Tests locaux | 146 fichiers : 139 fichiers Vitest et 7 fichiers E2E |
| Base distante liée | 83 tables publiques, 13 vues, 91 fonctions publiques |
| RLS | Activé sur les 83 tables publiques ; cela ne prouve pas à lui seul la justesse des politiques |
| Démarrage | 38 scripts legacy séquentiels, 862,7 KiB de source |
| Plus gros fichiers legacy | Sport 227 532 octets ; Trip 207 600 ; Nutrition 151 674 ; Réglages 118 942 |

## Validation exécutée

| Contrôle | Résultat et limite |
|---|---|
| `npm test -- --run` | 139 fichiers, 934 tests réussis |
| `npm run build` | Réussi ; 110 modules transformés |
| `npm run lint:syntax` | Réussi, 256 fichiers ; périmètre incomplet, voir F10 |
| `npm run perf:budget` après build | Réussi ; mesure partielle du démarrage, voir F9 |
| `npm run docs:check` | Échec : `project-inventory.json` différent et compteur tests de `public/project-atlas.json` obsolète, avant ajout de ce rapport |
| `npm run links:check` | Réussi : 7 liens locaux, 22 ancres, 2 externes, 5 mailto |
| `npm run test:e2e -- --project=desktop-chromium` | 66 réussis, 1 échec, 2,8 minutes ; plusieurs cas couvrent explicitement 1440/390 px et clair/sombre |
| `npm audit` | 13 dépendances signalées : 4 critiques, 6 élevées, 3 modérées ; ce ne sont pas 13 exploitations prouvées de l'application |
| Reproductions de cet audit | File concurrente, chargement après erreur, quota Nutrition et troncature Nutrition reproduits |

L'échec E2E est déterministe : `tests/e2e/critical-flows.spec.js:174` attend « BudgetPacker » dans le H1 de la page Projet ; le titre réel est « Ton budget, tes documents et tes objectifs. Un seul cockpit. ». Il démontre un contrat désynchronisé, pas un défaut de rendu. Les assertions qui suivent dans ce test ne sont donc pas exécutées.

## Constats prioritaires

P1 : à traiter avant une diffusion plus large ou avant de renforcer la promesse de fiabilité. P2 : consolidation prochaine. P3 : simplification et amélioration progressive. Aucun incident de compromission en production n'a été établi.

### F1 — P1 — Runtime Android vulnérable

**Vérifié :** `@capacitor/android` installé et verrouillé en 8.3.4 ; signalé critique par l'audit npm. L'avis officiel décrit le chargement de contenu distant sous l'origine de l'application via le proxy HTTP interne. Une activation de lien dans la WebView est une condition d'exploitation ; aucune exploitation de cette application n'a été tentée.

**Action :** mettre à niveau l'ensemble Capacitor de manière cohérente vers une version corrigée, synchroniser Android, reconstruire et redistribuer l'application. Ne pas considérer une simple publication web comme un correctif du runtime natif.

**Validation :** nouvelle analyse des dépendances, build Android, tests de connexion, liens entrants, documents et notifications sur un appareil. Source : [avis Capacitor](https://github.com/ionic-team/capacitor/security/advisories/GHSA-rvm3-566m-v7fv).

### F2 — P1 — Une nouvelle modification peut disparaître pendant la synchronisation

**Preuve :** `src/data/mutationQueueStore.js:76` fusionne une nouvelle action avec une action `syncing`, puis la remet `pending`. `flushMutationQueue`, ligne 189, supprime ensuite l'entrée par identifiant au succès de l'ancien envoi.

Reproduction : envoi d'un montant 10 ; pendant cet envoi, insertion du montant 20 avec la même clé ; résultat `sent=[10]`, file vide. Le dernier état n'est jamais envoyé. Le verrou global ne protège pas cette mise à jour pendant le `await`.

**Action :** révision immuable par tentative, acquittement conditionné à la révision envoyée, nouvelle révision conservée si elle est arrivée entre-temps. Tester aussi les singletons Nutrition/Sport. À moyen terme, stockage transactionnel et stratégie explicite entre onglets ; le verrou localStorage de 45 secondes n'est ni une transaction ni un bail renouvelé.

**Critère :** après l'acquittement de 10, 20 reste en attente puis est envoyé exactement une fois selon le contrat d'idempotence.

### F3 — P1 — Réintégrer une dépense dans le budget ne rétablit pas son impact

**Preuve statique et distante :** `supabase/migrations/20260815002750_reconcile_recurring_rule_updates.sql:415` et la définition distante actuelle de `update_transaction_v2` utilisent `case when p_out_of_budget then false else coalesce(t.affects_budget, true) end`.

Avec `affects_budget=false`, décocher « hors budget » conserve `false`. Aucun des triggers `transactions` inspectés ne rétablit ce drapeau. Le payload canonique d'édition ne transmet pas `p_affects_budget` (`src/core/transactionRpcPayload.js:53`). La dépense peut donc rester exclue du budget quotidien et de l'analyse malgré le changement de case. L'expression SQL a été évaluée en lecture seule ; aucune transaction réelle n'a été changée.

**Action :** définir les transitions autorisées entre exclusion volontaire, avance Trip et quote-part ; transmettre un impact explicite lorsque nécessaire. Ne pas remettre indistinctement tous les mouvements internes dans le budget.

**Critère :** aller-retour inclus → exclu → inclus sur dépense simple, quote-part Trip et avance, avec relecture SQL et cohérence des trois vues : wallet, budget quotidien, Analyse.

### F4 — P1 — Nutrition peut annoncer une sauvegarde inexistante

**Reproduit :** `src/data/nutritionRepository.js:30` ignore le résultat de `tbSafeLocalStorageSet`, qui retourne `{ok:false}` sans nécessairement lever d'exception (`src/app/bridge.js:100`, `src/data/storageQuota.js`). `writeJson` retourne alors `true`. Le diagnostic produit `reportedSuccess=true`, `persisted=null`.

**Action :** propager le résultat de persistance jusqu'à l'interface et empêcher tout statut « sauvegardé » si aucune copie durable n'existe.

**Critère :** quota saturé, stockage refusé et échec après tentative de nettoyage déclenchent un état récupérable avec les données encore visibles et exportables.

### F5 — P1 — Nutrition tronque la réserve locale à 200 entrées

**Reproduit :** `saveLocalNutritionRows` écrit `slice(0,200)` sans distinguer les entrées synchronisées ; `saveLocalNutritionRowsOnce` retourne néanmoins la liste complète. Avec 201 entrées, 201 sont retournées et 200 persistent. Une longue période hors ligne peut donc perdre une entrée au rechargement.

**Action :** séparer les écritures non acquittées du cache historique. Limiter le cache, jamais les opérations non synchronisées ; utiliser IndexedDB ou une limite explicitement bloquante avec export.

**Critère :** 201 puis plusieurs milliers d'entrées en attente survivent à un redémarrage, ou une limite empêche explicitement une nouvelle saisie sans perdre les précédentes.

### F6 — P1 — Sport peut considérer une séance partielle comme synchronisée

**Chemin de code vérifié, scénario de panne non injecté en base :** `src/data/sportRepository.js:56` écrit la séance, les exercices puis les séries en trois requêtes. Si la troisième échoue, la séance parent existe déjà. `public/legacy/js/45_sport_ui.js:4175` trouve ce parent au prochain essai et le marque synchronisé sans vérifier les enfants.

**Action :** RPC transactionnelle pour une séance complète, identifiant de synchronisation stable, ou protocole d'upsert qui répare tous les enfants avant acquittement.

**Critère :** panne après chaque étape, puis nouvelle tentative ; nombre de séries et valeurs identiques à la séance locale, aucun doublon.

### F7 — P1 — Trip charge des collections sans pagination et supprime en plusieurs étapes

**Vérifié dans le code :** `src/data/tripRepository.js:20` lit dépenses, parts et règlements sans boucle de pagination ; les liens utilisent un unique `.in(...)`. La taille de réponse maximale configurée peut couper une collection, notamment les parts qui croissent plus vite que les dépenses. Le seuil effectif distant n'a pas été vérifié.

`deleteTrip`, ligne 88, enchaîne plusieurs suppressions indépendantes et continue après un échec de déliaison enregistré dans `unlinkError`. Une panne intermédiaire peut laisser un état partiellement supprimé.

**Action :** lecture paginée avec ordre stable, découpage des listes d'identifiants, indicateur d'incomplétude ; suppression transactionnelle côté serveur avec contrôle d'appartenance. Ne pas extrapoler les soldes depuis des données tronquées.

**Critère :** jeu de données au-dessus de la limite API, avec plusieurs parts par dépense, et panne injectée à chaque étape de suppression.

### F8 — P2 — Un échec de chargement de module reste mémorisé

**Reproduit :** `src/main.js:359` réutilise une promesse rejetée de `legacyDomainPromises`, conservée ligne 370. `tbIsLegacyDomainLoaded` retourne vrai dès que la clé existe. Deux tentatives donnent un seul chargement et `reportedLoaded=true`, malgré l'erreur. `analysisModulesPromise` présente aussi une absence de remise à zéro sur rejet.

**Action :** distinguer absent, chargement, chargé et erreur ; effacer les promesses en échec et suivre les scripts déjà exécutés pour éviter les doubles gestionnaires lors d'une reprise partielle.

**Critère :** couper le réseau à l'ouverture d'un onglet, le rétablir, rouvrir sans recharger l'application ; un seul jeu de gestionnaires et une interface opérationnelle.

### F9 — P2 — Les mesures de performance donnent une image incomplète

**Vérifié :** `scripts/check-module-budgets.mjs:39` mesure `dist/assets` et assimile le plus gros JS au JS initial. Le budget séparé `boot-legacy` existe, mais les 862,7 KiB des 38 scripts du démarrage ne sont pas inclus dans la ligne « Initial JS: 270,9 KiB ». Les bibliothèques CDN et les imports anticipés de KPI ne sont pas davantage représentés dans ce total initial.

`index.html:20` charge Supabase via `@2`, ApexCharts sans version et ECharts via `@5`. Ces ressources bloquantes sont hors lockfile npm et leur origine distante n'est pas mise en cache par le service worker local.

**Action :** intégrer et verrouiller les dépendances, charger les graphiques à la demande, mesurer les requêtes réellement exécutées, le poids transféré et le coût de parsing sur mobile. Conserver les budgets par domaine mais les compléter avec un budget de parcours et du temps d'interactivité.

### F10 — P2 — La chaîne qualité laisse passer ses zones les plus risquées

**Vérifié :** `scripts/check-js-syntax.mjs:6` couvre `src`, `tests`, `scripts` et un seul fichier legacy (`42_assets_ui.js`). Les Edge Functions TypeScript ne sont pas vérifiées par cette commande. Vitest utilise l'environnement Node ; beaucoup de contrats UI vérifient des chaînes de source, pas un comportement utilisateur.

`netlify.toml` lance `npm ci && npm run build`, sans tests ni contrôle documentaire. Aucun workflow GitHub versionné n'est présent dans `.github`. Une protection distante ou une CI externe reste possible et n'a pas été inspectée.

**Action :** vérification syntaxique de tout le legacy, analyse TypeScript/Deno des fonctions, lint sémantique progressif ; pipeline reproductible avec tests, build, docs et E2E critiques. Ajouter des tests SQL d'isolation entre deux utilisateurs et des pannes réseau. Corriger le contrat Projet et régénérer l'Atlas dans un lot dédié.

### F11 — P2 — Dette mesurable de sécurité et de performance SQL

**Advisors distants :** 35 signatures de fonctions `SECURITY DEFINER` exécutables par des utilisateurs connectés ; protection contre mots de passe compromis désactivée. Les fonctions transactionnelles inspectées vérifient déjà `auth.uid()` et l'appartenance : leur caractère privilégié n'est pas à lui seul une faille.

Les deux tables RLS sans politique (`account_deletion_requests`, `assistant_request_quota`) correspondent à des traitements serveur réservés ; ne pas leur ajouter des politiques publiques pour simplement faire disparaître l'information.

**Performance :** 50 signalements de clés étrangères non couvertes par un index, 233 de réévaluation Auth dans RLS, 295 de politiques permissives multiples, 12 groupes d'index identiques, 53 index non utilisés. Ce sont des occurrences d'advisor, pas autant de tables ou d'incidents indépendants.

**Action :** vérifier les autorisations objet par objet sur les RPC sensibles ; traiter d'abord les index réellement identiques puis les politiques des grandes tables avec mesure avant/après. Ne pas supprimer les index « inutilisés » sans connaître la période statistique et les usages rares.

Sources de remédiation : [fonctions privilégiées](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [mots de passe compromis](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection), [index identiques](https://supabase.com/docs/guides/database/database-linter?lint=0009_duplicate_index), [RLS et appels Auth](https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan), [politiques multiples](https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies), [clés étrangères](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys).

### F12 — P2 — La CSP n'est pas une protection active

`netlify.toml:15` configure une politique `Content-Security-Policy-Report-Only`, avec `unsafe-inline`, `unsafe-eval` et des scripts HTTPS largement autorisés. Elle ne bloque pas les chargements. Les en-têtes nosniff et anti-frame sont néanmoins présents.

**Action :** commencer par le packaging des dépendances et l'extraction des scripts inline, observer les violations, puis activer une politique restrictive compatible. Examiner les interpolations HTML et les URL de documents sans assimiler tout `innerHTML` à une XSS prouvée. Validation du déploiement réel nécessaire : la configuration du dépôt n'est pas la preuve des en-têtes servis.

### F13 — P2 — Suppression différée sans reprise des traitements interrompus

`supabase/functions/process-account-deletions/index.ts:18` sélectionne seulement `pending`, passe ensuite à `processing`, et met les erreurs attrapées en `failed`. Aucun mécanisme de reprise d'un `processing` abandonné n'a été trouvé dans les fonctions inspectées. Un arrêt brutal peut donc laisser une demande bloquée ; un `failed` n'est pas repris automatiquement non plus.

**Action :** bail de traitement avec échéance, reprise idempotente par étape, suivi des erreurs et procédure explicite de relance. Vérifier les erreurs des mises à jour finales. Tester uniquement sur un compte dédié, avec fichiers et Trip partagé. L'existence d'un ordonnanceur de production n'a pas été vérifiée.

### F14 — P2 — Paramètres et données comptables manuels restent locaux

`src/features/accounting/accountingData.js:40` utilise localStorage par utilisateur/voyage. Le contrôleur annonce correctement « enregistré sur cet appareil uniquement ». Dette, rattachements et paramétrages ne forment donc pas encore un état partagé entre web et Android. Le hors-ligne comptable repose sur la dernière lecture dans la session.

**Action :** décider ce qui appartient au compte et le synchroniser avec version et résolution de conflits. Garantir export, restauration et migration des données manuelles avant de promettre une continuité multi-appareil. Conserver les états incomplets explicites et la traçabilité des FX, déjà bien conçus.

### F15 — P2 — Assistant, documentation et identité produit divergent

`supabase/functions/assistant-help/handler.js:7` dit explicitement que la comptabilité n'est pas implémentée ; son énumération de destinations l'omet aussi. Le module existe pourtant. La documentation Play Store annonce encore une version web 10.5.354 tandis que `package.json` est en 10.5.372. Le contrat H1 attend BudgetPacker alors que l'application utilise TravelBudget.

**Action :** registre commun des capacités réellement accessibles, décliné dans l'aide, l'assistant et la documentation. Définir un nom produit cohérent et un manifeste de livraison indiquant séparément web, APK, migrations et fonctions serveur.

## Revue de l'ensemble des domaines

| Domaine | Acquis à préserver | Axe d'amélioration et profondeur de revue |
|---|---|---|
| Dashboard / KPI | Règles dédiées, wallets détaillés, projection et budget quotidien | Revue du démarrage, règles de solde et E2E ; réduire le chargement initial, afficher date et complétude des données |
| Transactions / virements | RPC avec contrôles utilisateur, déduplication des créations | Revue approfondie payload/RPC/file ; F2/F3, vérifier tous les changements de drapeaux et snapshots |
| Analyse / FX | Drilldown, classifications, séparation quote-part/avance | Lecture des règles et E2E ; une seule normalisation et provenance de chaque chiffre, aucun zéro de remplacement trompeur |
| Abonnements | Règles extraites, suivi manuel distinct de génération | Revue migrations/contrats ; tester en base les frontières de période et leurs triggers, les changements de wallet, pause et reprise |
| Comptabilité | FX datés, montants incomplets explicites, détail, conservation des choix manuels | Revue approfondie data/FX/contrôleur et campagne E2E ; F14, restitution mobile plus progressive |
| Trip | Règles partagées, règlements annulés distingués, tests locaux récents | Revue approfondie repository/SQL/legacy ; F7, autorisations multi-utilisateur et cohérence des liens |
| Patrimoine | Règles extraites, acquisition distincte de consommation budgétaire | Revue des contrats et test chargement avant ouverture ; cycle complet acquisition, amortissement, cession, copropriété à vérifier en base |
| Documents | Vue/règles extraites, manifeste d'export Storage | Revue structure et cycle de compte ; tests réels upload interrompu, suppression fichier/ligne, expiration des liens et quotas |
| Inbox / WhatsApp | Signature Twilio contrôlée, vue et règles séparées | Revue du webhook et architecture ; déduplication des événements, état de traitement et visibilité des erreurs de pièces jointes |
| Sport / mesures corporelles | Couverture métier fournie, programme, timer, historique | Revue repository/synchronisation et contrats ; F6, session atomique, tester sommeil/reprise Android et changement de compte |
| Nutrition / cuisine | Sync IDs et mécanismes de reprise, recettes et portions | Revue stockage/repository/flux de sauvegarde ; F4/F5, sauvegarde durable avant accusé de succès |
| Travail / carrière | Vue et règles séparées | Revue structure et couverture ; renforcer E2E métier, unités/dates et cohérence avec dépenses énergétiques ; pas de panne métier démontrée |
| Notifications | Fonctions dédiées, préférences, journal des livraisons | Lecture des points d'entrée/requêtes ; vérifier idempotence d'envoi, timezone et reprise après envoi avant journalisation |
| Réglages / Auth / administration | Contrôle admin serveur inspecté, périmètres locaux identifiés | Lecture Auth/admin et E2E ; normaliser la purge ou conservation locale lors de la déconnexion, expliciter l'appareil partagé |
| Aide / assistant | Auth serveur, quota, taille requête bornée, repli local | Lecture handler et E2E ; F15, scénarios de refus et exactitude des capacités |
| Campagne de tests | Contrats anti-retour, scénarios manuels et interface testeurs | Suite exécutée ; passer d'un inventaire de tests à une matrice risques × preuve de validation |
| PWA / Android | Service worker, manifeste, builds signés prévus, backup Android désactivé | Revue configuration ; F1/F8/F9, test de mise à jour et lancement à froid hors ligne sur appareil |
| Exploitation / livraison | Scripts build, budgets et Atlas déjà disponibles | Revue scripts et exécution ; F10/F11/F13, pipeline et manifeste de versions déployées |

## Interface et produit

Les tests exécutés couvrent plusieurs rendus clair/sombre à 1440 et 390 px ; les captures Comptabilité 1440 clair et 390 sombre ont été examinées visuellement. Ce n'est pas une validation visuelle manuelle de tous les écrans.

La densité fonctionnelle est forte. Sur mobile, le bilan empile un long parcours : filtres, onglets, actif/passif, rattachements, dettes et compléments. Les détails ont une valeur réelle, mais le parcours gagnerait à commencer par la situation, les écarts à expliquer et une action principale, puis à proposer les détails progressivement. Préserver tous les identifiants et gestionnaires comme l'impose `docs/VISUAL_SYSTEM.md`.

L'application combine finance, documents, voyage et suivi quotidien. Clarifier un parcours initial centré sur « créer mon voyage, ajouter mes wallets, enregistrer ma première dépense, comprendre mon budget ». Les modules supplémentaires doivent pouvoir s'activer progressivement sans multiplier les états de données implicites.

Améliorations transversales : statuts cohérents « local / en attente / confirmé serveur / erreur », montant toujours associé à sa devise et à sa date, chemin visible vers les données sources, vocabulaire uniforme, tests clavier/focus et contrastes mesurés. Les styles inline du panneau hors ligne dans `src/app/pwa.js` restent hors des tokens et méritent une migration ciblée. Aucun défaut de contraste chiffré n'est affirmé sans mesure.

## Architecture, code mort et maintenabilité

La frontière V11 est pertinente mais inachevée. Les fichiers Sport, Trip, Nutrition et Réglages restent de gros orchestrateurs globaux. Les conventions snake_case/camelCase et les fallbacks RPC sont utiles à la compatibilité mais augmentent le nombre d'états possibles. Fixer des adaptateurs à l'entrée des domaines, puis réduire les alias internes.

Les contrats anti-retour existants interdisent déjà plusieurs anciens helpers. Aucune suppression n'est proposée sur la seule base d'un symbole peu référencé : le bridge et les appels dynamiques rendent une recherche textuelle insuffisante. Pour chaque extraction : inventorier appels, globals, attributs et événements, déplacer une responsabilité, couvrir le remplacement puis retirer le chemin devenu inutile. Pas de nettoyage massif pendant cet audit.

Introduire progressivement des types aux frontières financières : devise, montant, cash date, budget date, quote-part, statut de synchronisation. Les utilitaires monétaires utilisent des Number et souvent deux décimales ; formaliser les règles d'arrondi et la précision par devise, avec conservation des sommes après répartition, avant toute généralisation multi-devise. Aucun écart chiffré réel n'a été imputé ici aux flottants.

## Feuille de route proposée

| Lot | Livraison attendue | Condition de sortie |
|---|---|---|
| 1 — Fiabilité immédiate | Capacitor corrigé ; F2 à F6 ; reprise du loader | Reproductions converties en tests de non-régression, tests de panne, APK vérifié |
| 2 — Invariants financiers | Réintégration budget ; pagination Trip ; transactions atomiques ; tests inter-périodes | Jeux synthétiques de référence et relecture serveur concordante, y compris deux utilisateurs |
| 3 — Livraison contrôlée | Pipeline complet, E2E Projet corrigé, Atlas et manifeste de release | Aucun contrôle obligatoire ignoré ; distinction web/APK/SQL/Edge explicite |
| 4 — Serveur et exploitation | RPC auditées, index/politiques rationalisés, reprise des suppressions | Tests négatifs d'accès, mesures avant/après, purge démonstration récupérable et surveillée |
| 5 — Architecture et performance | Dépendances packagées ; chargement mesuré ; extraction par domaine | Démarrage réel plus léger, aucun retour de code retiré, fonctionnement hors ligne documenté |
| 6 — Cohérence produit | Comptabilité portable, aide exacte, parcours mobile progressifs | Reprise sur second appareil, validation clair/sombre 1440/390, fonctionnalités préservées |

Commencer par les pertes silencieuses de données et la sécurité native, avant une nouvelle refonte visuelle. La qualité doit se mesurer par la conservation et l'explicabilité des données lors des pannes, pas uniquement par le nombre de tests verts.

## Pièces de preuve

- `reproduce.mjs` : diagnostics synthétiques reproductibles, sans écritures réseau.
- `npm-audit.json` : résultat npm complet de la session.
- `supabase-advisors.json` : catégories, compteurs et remédiations des advisors distants.
- `e2e.log` : résultat de la campagne navigateur.
- Captures existantes : `test-results/accounting-1440-light.png` et `test-results/accounting-390-dark.png` ; elles sont temporaires et peuvent être remplacées par une nouvelle campagne.

