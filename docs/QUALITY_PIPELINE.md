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
