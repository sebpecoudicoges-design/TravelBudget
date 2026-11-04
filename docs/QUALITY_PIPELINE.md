# Validation des livraisons — 11 octobre 2026

## Commandes

Après les changements de sources et de documentation, exécuter `npm run atlas:generate`, puis `npm run quality`. Cette dernière commande arrête la chaîne au premier échec : syntaxe JavaScript/TypeScript et HTML inline, types des fonctions Edge, tests Vitest, cohérence documentaire, construction web, budgets de taille existants. La CI ne régénère pas l'Atlas : un inventaire oublié doit échouer.

`npm run test:e2e -- --project=desktop-chromium` exécute ensuite tous les scénarios navigateur. Plusieurs scénarios couvrent explicitement 1440/390 px et les thèmes clair/sombre. Les projets mobile/tablette restent disponibles séparément ; ce workflow ne prétend pas les exécuter.

`.github/workflows/quality.yml` exécute ces contrôles sur les push et pull requests vers main, avec Node 24, un historique Git complet pour les références documentaires et Chromium installé selon la [documentation Playwright](https://playwright.dev/docs/ci). Un job Windows teste aussi l'arrêt des commandes Android. Aucun secret de signature ni accès en écriture à la base n'est nécessaire.

## Corrections de ce lot

- Le contrôle syntaxique couvre tous les fichiers `.js`, `.mjs` et `.cjs` de `src`, `tests`, `scripts`, `public`, `netlify`, ainsi que les configurations à la racine. L'ancienne liste d'exception limitée à un script historique est supprimée. Les fichiers générés Android, `dist` et les dépendances ne sont pas relus comme des sources.
- Les constructions APK/AAB arrêtent désormais immédiatement la chaîne si npm, Capacitor ou Gradle échoue. Une vérification jarsigner en échec fait aussi échouer le script. Un test lance réellement un processus natif avec code 23 et vérifie que l'étape suivante ne s'exécute pas ; il ne construit ni ne publie d'APK.
- L'empreinte des fichiers texte de l'Atlas normalise les fins de ligne CRLF/LF pour être reproductible entre Windows et Linux, tout en détectant les modifications de contenu. Elle exclut les dumps et métadonnées Supabase locaux ignorés par Git ; les migrations, fonctions et la configuration restent suivies.

## Limites et suite de l'étape architecture/qualité

Validation locale du 11 octobre 2026 : `npm run quality` réussi, 322 fichiers contrôlés et 940 tests dans 142 fichiers réussis ; contrôle documentaire, construction web et budgets existants réussis. La campagne navigateur et l'exécution distante sont suivies séparément.

La création du workflow n'active pas à elle seule une protection de branche et n'empêche pas le déploiement Netlify indépendant. Les fonctions Edge TypeScript et les scripts inclus dans le HTML ne sont pas couverts par `node --check`. Les alertes des dépendances d'outillage, la mesure du vrai chargement initial et la reprise du chargeur de domaines restent à corriger. Les scripts Android conservent également leur configuration locale de SDK et leur nettoyage existant des anciennes copies dans `public/downloads`.

L'APK 10.5.373 déjà publié reste inchangé : ce lot porte sur les outils de contrôle, pas sur son code applicatif. Les contrôles sur téléphone restent nécessaires.

## Actualisation du 22 octobre 2026

Le lot 10.5.377 migre vers Vite 7.3.6 et Vitest 4.1.10, aligne Netlify sur Node 24 et ajoute le contrôle npm critique en CI. Les neuf alertes restantes, les limites et les preuves sont détaillées dans [Dépendances 10.5.377](DEPENDENCIES_10_5_377.md). La reprise des chargeurs a fait l'objet du [lot 10.5.376](LOADER_RECOVERY_10_5_376.md) ; sa couverture reste partielle. La mesure complète du démarrage reste ouverte.

## Actualisation du 23 octobre 2026

La CI mesure aussi le parcours compilé anonyme via npm run perf:startup et conserve son rapport JSON. Les requêtes et volumes réels complètent les budgets de fichiers. Les bibliothèques sont préparées depuis npm avant dev/build ; config est désormais inclus dans l'empreinte Atlas. Voir [Démarrage 10.5.378](STARTUP_10_5_378.md).

## Actualisation du 25 octobre 2026

`npm run perf:startup` exécute désormais quatre parcours : anonyme et connecté synthétique, chacun sur desktop et mobile simulé. Le parcours connecté utilise le vrai client, le bootstrap et les graphiques compilés avec 1 200 transactions fictives, sans accès aux services réels. Les seuils et limites sont détaillés dans [Mesure du démarrage connecté](CONNECTED_STARTUP.md). Les transferts des fichiers locaux sont séparés des octets des réponses API synthétiques. Le rapport reste disponible dans l’artefact CI `startup-report`.

## Actualisation du 29 octobre 2026 — publication Android

La branche `-UploadSupabase` supprimait l'objet distant du même nom avant la copie. Une panne de copie après cette suppression pouvait rendre un lien publié indisponible. Cette commande de suppression est retirée ; la copie cible explicitement le projet lié avec `--linked`. Une copie en échec arrête le script avant le message de publication. Utiliser un nouveau `BuildStamp` pour chaque livraison ; ne pas réutiliser une URL publiée pour remplacer un binaire. Le script ne fait pas de nettoyage des APK distants.

Trois tests Windows exécutent la vraie branche de publication extraite par le parseur PowerShell, avec une commande Supabase simulée : réussite, échec et refus. Ils interdisent la suppression et vérifient l'absence de message de réussite après erreur. Ils échouaient tous avant la correction. Le contrat multiplateforme interdit aussi le retour de `storage rm` ou `storage mv`. Ces tests sont inclus dans le job Windows existant ; ils ne nécessitent ni SDK, ni secret, ni écriture distante. L'ancien chemin de suppression est le seul code retiré ; les autres étapes de construction restent utilisées.

Référence de commande : [Supabase CLI — copie Storage](https://supabase.com/docs/reference/cli/supabase-storage-cp), aide locale CLI 2.108.0 vérifiée. Les tests ne prouvent pas le comportement d'écrasement interne du service : la règle reste une URL neuve par livraison. La vérification de signature, des fichiers embarqués et du SHA-256 téléchargé reste obligatoire avant d'annoncer une livraison.

Lot d'outillage : application et APK 10.5.385 inchangés, aucune reconstruction ni écriture Storage nécessaire. Page Projet et Atlas web actualisés ; leur copie embarquée dans l'APK reste celle du lot 10.5.385. La phase architecture/qualité reste ouverte.

## Contrôle Edge du 29 octobre 2026

Le contrôle syntaxique inclut désormais `supabase/functions`, ses sources JavaScript et TypeScript, ainsi que le module partagé. Node 24 vérifie leur syntaxe sans exécuter les handlers ni résoudre les imports. Deux tests de couverture échouaient avant correction : les fichiers étaient entièrement ignorés.

`npm run lint:edge`, inclus dans `npm run quality` et donc dans le job web GitHub, lance un véritable `deno check` sur tous les fichiers TypeScript du dossier. Deno 2.9.6 est verrouillé par npm ; `config/edge-check.lock` fige le graphe de contrôle, avec `--frozen=true` en validation. Les imports actuels sont tous explicites (URL/npm/jsr) ; `--no-config` évite de charger les alias de déploiement inutilisés de certains sous-dossiers. Une évolution vers des imports par alias devra adapter ce contrôle explicitement. Pour actualiser volontairement son lock : `npx deno check --no-config --lock=config/edge-check.lock <liste des fichiers TypeScript>` puis relancer la validation figée.

Le premier diagnostic Deno comportait 62 erreurs. Les signatures `ReturnType<typeof createClient>` déduisaient un client générique incompatible dans les notifications ; elles utilisent maintenant le type public `SupabaseClient`. Le paramètre JavaScript `allowedUsers` est documenté comme `string[]` au lieu d'être inféré `never[]`. L'accès au message d'erreur d'administration est annoté, sans modifier son expression exécutée. Après ces corrections, Deno a également révélé deux comparaisons inaccessibles sous une constante `mode = "maintenance"` : ces branches et l'offset nul ont été retirés. Le coefficient existant 1,6 et le plancher sont conservés, avec tests de résultat et contrat anti-retour.

Des tests synthétiques prouvent que le contrôle accepte des types corrects, refuse une affectation `string` vers `number` et n'exécute pas le code. Les 14 fichiers TypeScript passent. Le JavaScript importé participe à l'inférence, mais `checkJs` n'est pas activé globalement : cela ne certifie pas tous les types internes de l'assistant. Le schéma SQL n'est pas généré dans ces types ; les autorisations, la persistance et les réponses réelles restent à auditer séparément.

Ce lot modifie l'outillage et les sources serveur : aucun déploiement Edge, aucune requête de données, aucun envoi de notification et aucun nouvel APK. La page Projet et l'Atlas web reflètent l'avancement du dépôt, pas une mise à jour des fonctions en production. Référence : [Deno check](https://docs.deno.com/runtime/reference/cli/check/).

## Publication Netlify — 31 octobre 2026

La commande Netlify exécutait seulement `npm ci && npm run build` : un build réussi pouvait être publié avant qu'un test GitHub échoue. Elle exécute désormais, dans l'ordre, l'installation verrouillée, la préparation de l'historique Git, `audit:dependencies` et `quality`. Les opérateurs `&&` arrêtent la chaîne au premier échec ; aucun second build simplifié ne contourne les contrôles. Le seuil de dépendances reste critique, comme en CI ; les alertes modérées/élevées restantes ne sont pas présentées comme résolues.

`scripts/ensure-build-history.mjs` détecte un checkout tronqué et récupère son historique depuis origin, sans checkout ni modification de HEAD. Cela permet à `docs:check` de vérifier ses anciens commits de référence. L'échec de récupération bloque la commande ; aucun contrôle documentaire n'est supprimé. Un dépôt complet ne provoque aucune requête Git. Les tests créent de vrais petits dépôts locaux, clonés avec depth=1 : récupération d'un ancien commit, conservation de HEAD et d'un fichier local, absence de remote sur dépôt complet et échec explicite sur dépôt tronqué sans remote. Le contrat Netlify échouait avant la correction.

Le chemin de publication build seul a été retiré. Aucun autre code mort directement lié n'a été identifié. L'Atlas n'est pas régénéré dans le build distant : il doit être commité à jour. Les parcours navigateur et les mesures de démarrage restent exécutés par GitHub séparément ; cette modification n'instaure pas une dépendance Netlify envers leur résultat ni une protection de branche. Référence : [configuration des builds Netlify](https://docs.netlify.com/build/configure-builds/overview/).

Lot d'outillage : application et APK 10.5.386 conservés ; page Projet et Atlas web actualisés, sans reconstruction Android ni modification de données.


## Analyse sémantique des règles métier — 31 octobre 2026

`npm run lint:core` utilise le Deno 2.9.6 déjà verrouillé, sans nouvelle dépendance, sur les 27 modules `src/core/**/*.js`. La commande est obligatoire dans `quality`, donc dans GitHub et la publication Netlify. Les dix-neuf règles explicites ciblent notamment références inconnues, variables locales inutilisées, code inaccessible, clés/branches/cas dupliqués, affectations invalides, finally dangereux et comparaisons NaN/typeof invalides. Ce contrôle complète la syntaxe et les tests ; il ne prouve pas les résultats financiers.

La configuration est dans `config/deno-core-lint.json`, déjà couvert par l'empreinte Atlas. Les règles no-window et no-node-globals complètent les globals reconnus par Deno. Aucun formatage ni correctif automatique n'est appliqué. Les exceptions de ligne doivent nommer une règle connue et rester utiles ; une exclusion de fichier demeure techniquement possible et doit être revue. Aucun fichier core n'en contient actuellement.

Deux calculs sans consommateur ont été retirés de `notificationRules.js` (workCount, fmtPct), après recherche de leurs usages. Les paramètres pctText, restMinutes et restMet restent acceptés sous leurs noms publics ; leurs bindings locaux prennent un préfixe underscore pour expliciter leur non-utilisation. Les valeurs par défaut et règles de calories de travail sont conservées. La déstructuration itemIndex dans Sport retire volontairement ce champ du payload serveur ; seul son binding local est renommé, et le test existant de sauvegarde des séries vérifie cette exclusion. Messages de notification et signatures publiques conservés.

Quatre tests du contrôle injectent plusieurs défauts synthétiques, vérifient les diagnostics sans exécuter les sources ni charger leurs imports, contrôlent les exceptions de ligne et couvrent tous les modules métier. Le contrôle des variables inutilisées empêche le retour des deux calculs retirés. Les tests Notifications/Sport/Travail restent exécutés.

Périmètre progressif : vues, repositories, bridge, scripts legacy et HTML ne sont pas encore couverts par ces règles sémantiques. Les Edge TypeScript restent contrôlées séparément par Deno check. Référence : [Deno lint](https://docs.deno.com/runtime/reference/cli/lint/).

Lot de qualité sans évolution fonctionnelle annoncée : sources nettoyées, page Projet et Atlas web actualisés ; APK 10.5.387 conservé, aucune nouvelle compilation Android ni écriture de données. Son code embarqué conserve les deux calculs inutilisés.

## Analyse sémantique des accès aux données — 2 novembre 2026

La commande obligatoire `lint:data` étend le contrôle à tous les modules JavaScript de `src/data`, sous-dossiers compris, notamment aux repositories MCP, Sport et Nutrition. Elle partage le moteur de validation de `lint:core` ; le lancement Deno dupliqué est évité. Références inconnues, calculs inutilisés, code inaccessible, clés dupliquées et finally dangereux bloquent désormais aussi la publication pour ces modules.

La configuration reprend les règles core, sauf no-window : l’adaptateur Nutrition utilise légitimement window.localStorage et le wrapper de stockage existant. Ce chemin n’est ni supprimé ni réécrit pour satisfaire le linter. Un test interdit toute autre divergence silencieuse des règles. Aucun code mort directement lié n’a été détecté dans les repositories.

Quatre nouveaux tests couvrent les défauts injectés dans un sous-dossier, les imports non résolus sans exécution, le refus de sources absentes/vides et la couverture du répertoire avec intégration obligatoire dans quality. Le contrôle ne certifie ni le schéma SQL, ni la sécurité RLS, ni les résultats métier. L’interface applicative et l’APK restent inchangés ; page Projet et Atlas web actualisés.


## Analyse sémantique des modules fonctionnels — 3 novembre 2026

La commande `lint:features` couvre les 64 fichiers JavaScript de `src/features`, sous-dossiers compris, avec le moteur partagé et les mêmes règles que `lint:data`. Elle est obligatoire dans `quality`, donc dans GitHub et la publication Netlify. Les tests injectent des références inconnues, du code mort et un finally dangereux, vérifient les dossiers absents/vides et les imports sans exécution.

Le calcul local de traduction inutilisé de `renderSettingsPeriodCard` a été retiré après vérification des usages. Les paramètres publics `t`, `daily` et la position de `timer` sont conservés, avec des bindings locaux explicitement inutilisés. Le catch Analyse ne capture plus une erreur jamais consommée. Les références au DOM dans le journal bancaire et la campagne de tests utilisent `globalThis.document` au moment de chaque appel, sans capturer le document à l’import. Aucun identifiant, gestionnaire ou contenu rendu n’est supprimé. Le linter empêche le retour des bindings morts.

Ce contrôle ne valide ni les résultats financiers ni les autorisations SQL. Les scripts legacy, le bridge et les autres répertoires restent hors de ce périmètre sémantique. Aucun nouvel APK : le binaire 10.5.387 conserve les anciennes écritures équivalentes ; les nettoyages concernent les sources web de ce lot.

Validation locale du lot : 1 123 tests dans 165 fichiers, chaîne quality complète et 130 scénarios Chromium réussis, dont wallets et journal bancaire en clair/sombre à 1440/390 px. Preuves : `.codex/releases/10.5.387/feature-quality.log` et `feature-e2e.log`. Aucun résultat de CI distante ou de déploiement déduit de ces contrôles locaux.


## Couverture de tout le JavaScript moderne — 3 novembre 2026

`lint:src` vérifie les 110 fichiers JavaScript de `src`, y compris `main.js`, le bridge, les chargeurs, la PWA et les composants partagés. Dans `quality`, il remplace les deux passages partiels `lint:data` et `lint:features` ; ces commandes restent disponibles pour les diagnostics ciblés. `lint:core` reste obligatoire en complément, car il interdit aussi les globals navigateur dans les règles pures. Un nouveau sous-répertoire de src est inclus automatiquement. Les tests injectent des défauts dans main.js, un chargeur imbriqué et un composant UI ; ils vérifient aussi les répertoires absents/vides et l’absence d’exécution des sources.

Les accès DOM concernés utilisent `globalThis.document` au moment de chaque utilisation. Ils ne capturent pas le document à l’import ; les contrôles existants de disponibilité sont conservés. L’identifiant `__TB_VERSION__` est remplacé par Vite : une exception no-undef limitée à sa ligne de lecture est documentée, avec le fallback de version conservé. Les exceptions inutilisées ou inconnues restent interdites. Aucun code mort directement lié identifié dans ce lot, aucun gestionnaire ou rendu retiré.

Ce lot ferme la lacune de couverture sémantique de src, pas celle des scripts legacy, des scripts de livraison ou du JavaScript serveur. Il ne certifie pas les règles financières, la persistance ou les droits SQL. Pas de nouvelle dépendance ni de nouvel APK ; le binaire 10.5.387 conserve ses écritures DOM équivalentes.

Validation locale : quality réussie, 1 127 tests / 166 fichiers, 130 scénarios Chromium réussis (clair/sombre et 1440/390 inclus), quatre parcours de démarrage anonymes/connectés synthétiques sans erreur. Budgets conservés : JS initial 276,9 / 277 KiB, JS total 859,7 / 860 KiB. Preuves : `.codex/releases/10.5.387/source-quality.log`, `source-e2e.log`, `source-startup.log`. Validation sur appareil réel et publication distante distinctes.


## Contrôle sémantique serveur — 3 novembre 2026

`lint:server` devient obligatoire dans `quality`, en complément de `lint:edge` (types TypeScript). Le moteur partagé accepte maintenant une liste explicite d’extensions ; ses appels existants gardent le filtre .js. Les deux arbres supabase/functions et netlify/functions sont obligatoires et contrôlés récursivement : 24 fichiers actuels, JavaScript et TypeScript, modules partagés inclus. Un répertoire absent ou vide échoue. Les imports ne sont ni exécutés ni résolus par ce contrôle.

La configuration core interdit notamment les références inconnues, variables inutilisées, finally dangereux et globals navigateur/Node implicites. Quatre tests injectent des erreurs dans les deux arbres, couvrent JS/TS, les dossiers vides/absents et l’intégration dans quality. Le contrôle TypeScript reste distinct et obligatoire ; un lint réussi ne prouve pas la correction des types, des résultats ou des autorisations.

Dans dispatch-mobile-notifications, totalBudget n’avait aucun consommateur ; periodDays servait uniquement à ce calcul. Les deux calculs locaux ont été retirés après recherche des usages. dayCountInclusive reste utilisé pour les dépenses et les jours écoulés. Les paramètres req/context de la fonction ECB sont conservés dans leur ordre, avec des noms locaux préfixés par underscore. Aucun code mort supplémentaire identifié dans le périmètre. Le contrôle no-unused-vars empêche le retour de ces calculs.

Aucun appel de notification, aucune donnée de production modifiée, aucune migration ni nouvel APK. La suppression des calculs concerne les sources : aucun déploiement Supabase effectué dans ce lot. La fonction ECB suit le déploiement web Netlify, dont la disponibilité doit être vérifiée séparément. Les scripts legacy restent hors du lint sémantique. Référence d’organisation serveur : [documentation Supabase](https://supabase.com/docs/guides/functions/development-tips).

Validation locale : quality réussie, 1 131 tests / 167 fichiers, types Edge et lint des 24 sources serveur validés, documentation/build/budgets réussis. Page Projet 1440/390 clair/sombre validée après relance (premier essai arrêté au timeout de démarrage du serveur local). Preuves : `.codex/releases/10.5.387/server-quality.log` et `server-project-e2e-retry.log`. Campagne navigateur complète non relancée dans ce lot sans changement d’interface applicative.


## Flux du code historique — 3 novembre 2026

`lint:legacy-flow` vérifie les 57 scripts historiques avec treize règles ciblées sur le flux, les affectations et les exceptions de lint. Il est obligatoire dans quality. Le diagnostic large a aussi relevé 3 071 références inconnues, 129 bindings inutilisés, une réaffectation de fonction et une clé dupliquée. Ces occurrences ne sont pas autant de bugs établis : les scripts classiques partagent de nombreux globals. Elles ne sont pas présentées comme résolues ; no-undef, no-unused-vars, no-func-assign et no-dupe-keys ne font pas partie de ce premier périmètre. Leurs règles restent actives sur les sources modernes/serveur.

Défaut reproduit dans refreshFromServer : le return du finally remplaçait le rejet de la première tentative par le résultat de la relance manuelle. La relance se déroule désormais après la libération des verrous, et la première erreur reste rejetée ; si les deux tentatives échouent, un AggregateError conserve les deux erreurs. Le regroupement des appels automatiques, la relance manuelle unique et le nettoyage de la file sont conservés. Le retour dangereux a été supprimé, avec contrat anti-retour par lint ; aucun autre code mort directement lié identifié.

Cinq scénarios exécutent le vrai coordinateur dans une VM avec chargement simulé : deux échecs reproduits avant correction, cinq succès après. Ce changement concerne les exceptions qui sortent de _runRefreshFromServer ; il ne modifie pas son traitement interne existant des erreurs réseau ou sa restauration hors ligne. Aucun incident de perte de données en production démontré. Trois tests vérifient le lint, les globals classiques sans exécution et la couverture du répertoire.

Sources web et documentation actualisées. Aucun changement SQL ou serveur. Aucun nouvel APK dans ce lot : le binaire 10.5.387 conserve l’ancien coordinateur ; la correction Android devra être embarquée lors d’une reconstruction ultérieure.

Validation finale locale : 1 139 tests / 169 fichiers et 130 scénarios Chromium réussis, dont clair/sombre et 1440/390 px. Quality complète, documentation, build et budgets validés. Deux tests du coordinateur échouaient avant correction ; cinq passent après. Preuves : `.codex/releases/10.5.387/legacy-flow-quality.log` et `legacy-flow-e2e.log`. Publication web et distribution Android restent des états distincts.


## Assistant initial et traduction des catégories — 3 novembre 2026

L’ancienne déclaration de showFirstTimeWizardModal était remplacée dans le même script, avant tout appel : sa première implémentation est retirée. La fonction actuelle garde le nom public showFirstTimeWizardModal, son contenu, ses identifiants, gestionnaires et payload. Aucun appel externe au nom interne showFirstTimeWizardModalFintech identifié. Le helper upperCurrencyInput, sans appel, est aussi retiré. Un contrat interdit le retour de cette implémentation écrasée et du helper mort.

Dans la référence budgétaire, la seconde clé Activites dupliquée devient Activités : le libellé accentué, effectivement fourni par posts, est désormais traduit en anglais. La variante sans accent et les libellés inconnus restent pris en charge. Le défaut anglais et la réaffectation sont reproduits par deux tests en échec avant correction.

Les règles no-func-assign et no-dupe-keys sont désormais obligatoires sur les 57 scripts historiques (quinze règles ciblées). Les références globales et bindings inutilisés restent hors de ce périmètre. Quatre nouveaux scénarios navigateur exercent le véritable script avec un taux synthétique : dates invalides, saisie, FX, désactivation du cash, payload bancaire, annulation et réouverture en anglais, clair/sombre 1440/390. Aucun compte ni wallet créé en base.

Sources web et page Projet actualisées ; aucun nouvel APK ni déploiement Supabase. La suppression du code mort et la traduction devront être intégrées à la prochaine reconstruction Android, ainsi que la correction précédente du coordinateur d’actualisation.

Validation finale locale : quality complète réussie, 1 142 tests / 170 fichiers, 134 scénarios Chromium réussis, dont quatre nouveaux parcours de première configuration. Comparaison avant/après : corps de l’assistant actif identique hors helper sans appel. Boot legacy mesuré à 856 KiB, sous le plafond inchangé. Preuves : `.codex/releases/10.5.387/legacy-setup-quality.log`, `legacy-setup-targeted.log` et `legacy-setup-e2e.log`. Publication web et reconstruction Android distinctes.


## Révisions de la file hors ligne — 3 novembre 2026

F2 reproduit : un payload 10 remplacé par 20 pendant l’envoi était supprimé au succès de l’ancien envoi. Sept scénarios échouaient avant correction (succès, erreur temporaire/permanente, singletons Sport/Nutrition, retrait d’une action et changement de compte). La file locale v4 ajoute une révision par modification et un identifiant par tentative. La suppression, le report d’erreur et les callbacks de nettoyage vérifient la tentative et le compte visés ; une nouvelle révision reste pending, même à horodatage identique. Les entrées v3 sont normalisées sans effacer leur payload.

Le flush ne rejoue plus une entrée disparue depuis sa sélection et s’arrête avant l’action suivante si le compte change. Le nettoyage optimiste Trip est déplacé du replay vers le callback conditionnel : un ancien succès ne retire plus l’affichage local d’une modification récente. Le fallback qui rejouait l’ancien snapshot malgré une entrée supprimée est retiré ; les tests de concurrence en empêchent le retour. Aucune nouvelle révision n’est envoyée implicitement deux fois dans le même passage : elle reste disponible pour le passage suivant. Le compteur synced compte les tentatives réussies, pas la disparition de toute révision plus récente.

Onze nouveaux tests couvrent aussi la reprise après rechargement du store, les changements pendant un callback, les tentatives périmées, les anciennes entrées et le véritable adaptateur Trip. Trois parcours Chromium vérifient avec localStorage que 20 survit à l’envoi de 10, au rechargement de la page, puis est envoyé une fois lors du passage suivant. Données exclusivement synthétiques, aucun RPC réel.

Limites : localStorage reste non transactionnel entre onglets et le bail de verrou n’est pas renouvelé. Ce lot ne garantit pas exactly-once côté serveur : l’idempotence des RPC, les écritures propres aux domaines Sport/Nutrition et leurs sauvegardes partielles restent des sujets distincts. Une ancienne version déjà ouverte ne dispose pas de ces gardes. Au changement de compte, l’entrée en cours de l’ancien compte est conservée pour la récupération de tentative périmée.

Le build ajoute environ 0,7 KiB au JS initial pour les gardes de révision/tentative/compte : plafond initial 277 → 278 KiB et total 860 → 861 KiB, plafonds différés/CSS/gzip inchangés. Hausse ciblée et justifiée par la prévention de perte d’une modification. Page Projet et Atlas actualisés. Aucun schéma SQL ni service distant modifié ; APK 10.5.387 inchangé, reconstruction Android nécessaire pour embarquer ce correctif et les lots web précédents.


Validation finale locale : quality complète réussie, 1 153 tests / 171 fichiers et 137 scénarios Chromium réussis, dont trois nouveaux parcours de persistance après rechargement. JS initial 277,6 / 278 KiB et total 860,4 / 861 KiB. Preuves : `.codex/releases/10.5.387/queue-quality.log`, `queue-targeted-e2e.log` et `queue-e2e.log`. Publication web non vérifiée ; reconstruction et validation Android restantes.

4 novembre 2026 — F5 : suppression de la troncature à 200 repas en attente dans le repository et le secours legacy. Le paramètre limit sans usage appelant est retiré ; limite du cache aliments conservée. Deux échecs reproduits avant correction ; trois tests couvrent 201/5 000 entrées, édition, suppression et secours legacy. Deux scénarios Chromium vérifient le rechargement réel localStorage ; quatre scénarios de page Projet/Android réussissent en clair/sombre 1440/390.

Validation : contrôles syntaxiques/types/sémantiques réussis ; 1 159 tests réussis sur 1 160, puis test d’outillage en timeout validé par relance isolée (deux tests réussis). Docs, build et budgets validés sans hausse de plafond. Preuves : .codex/releases/10.5.388/nutrition-quality-retry.log, nutrition-syntax-retry.log, nutrition-build.log et nutrition-e2e.log. La première campagne interrompue reste archivée, sans être comptée comme réussie. Quota saturé et faux succès de persistance restent ouverts sous F4. APK 10.5.388 inchangé ; ce lot doit être embarqué dans une prochaine reconstruction.
