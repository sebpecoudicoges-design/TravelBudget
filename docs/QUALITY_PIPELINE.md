# Validation des livraisons — 11 octobre 2026

## Commandes

Après les changements de sources et de documentation, exécuter `npm run atlas:generate`, puis `npm run quality`. Cette dernière commande arrête la chaîne au premier échec : syntaxe JavaScript, tests Vitest, cohérence documentaire, construction web, budgets de taille existants. La CI ne régénère pas l'Atlas : un inventaire oublié doit échouer.

`npm run test:e2e -- --project=desktop-chromium` exécute ensuite tous les scénarios navigateur. Plusieurs scénarios couvrent explicitement 1440/390 px et les thèmes clair/sombre. Les projets mobile/tablette restent disponibles séparément ; ce workflow ne prétend pas les exécuter.

`.github/workflows/quality.yml` exécute ces contrôles sur les push et pull requests vers main, avec Node 24, un historique Git complet pour les références documentaires et Chromium installé selon la [documentation Playwright](https://playwright.dev/docs/ci). Un job Windows teste aussi l'arrêt des commandes Android. Aucun secret de signature ni accès en écriture à la base n'est nécessaire.

## Corrections de ce lot

- Le contrôle syntaxique couvre tous les fichiers `.js`, `.mjs` et `.cjs` de `src`, `tests`, `scripts`, `public`, `netlify`, ainsi que les configurations à la racine. L'ancienne liste d'exception limitée à un script historique est supprimée. Les fichiers générés Android, `dist` et les dépendances ne sont pas relus comme des sources.
- Les constructions APK/AAB arrêtent désormais immédiatement la chaîne si npm, Capacitor ou Gradle échoue. Une vérification jarsigner en échec fait aussi échouer le script. Un test lance réellement un processus natif avec code 23 et vérifie que l'étape suivante ne s'exécute pas ; il ne construit ni ne publie d'APK.
- L'empreinte des fichiers texte de l'Atlas normalise les fins de ligne CRLF/LF pour être reproductible entre Windows et Linux, tout en détectant les modifications de contenu.

## Limites et suite de l'étape architecture/qualité

Validation locale du 11 octobre 2026 : `npm run quality` réussi, 322 fichiers contrôlés et 940 tests dans 142 fichiers réussis ; contrôle documentaire, construction web et budgets existants réussis. La campagne navigateur et l'exécution distante sont suivies séparément.

La création du workflow n'active pas à elle seule une protection de branche et n'empêche pas le déploiement Netlify indépendant. Les fonctions Edge TypeScript et les scripts inclus dans le HTML ne sont pas couverts par `node --check`. Les alertes des dépendances d'outillage, la mesure du vrai chargement initial et la reprise du chargeur de domaines restent à corriger. Les scripts Android conservent également leur configuration locale de SDK et leur nettoyage existant des anciennes copies dans `public/downloads`.

L'APK 10.5.373 déjà publié reste inchangé : ce lot porte sur les outils de contrôle, pas sur son code applicatif. Les contrôles sur téléphone restent nécessaires.
