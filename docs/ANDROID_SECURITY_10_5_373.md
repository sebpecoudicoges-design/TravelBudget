# Android 10.5.373 — correction du runtime Capacitor

Correctif du 10 octobre 2026 pour GHSA-rvm3-566m-v7fv.

- Android : 8.3.4 → **8.5.3**.
- CLI : **8.5.3** ; Core : **8.5.0**, conforme à la dépendance attendue par Android.
- Versions exactes dans package.json et package-lock.json ; plugins Capacitor 8.0.0 compatibles conservés.
- Application : **10.5.373**, versionCode **10050373**, package `com.travelbudget.app`.
- Distribution : APK debug de test, pas une publication Google Play.

## Preuve du correctif

L'avis officiel décrit le chargement de contenu distant sous l'origine de l'application via le proxy HTTP interne. Le runtime installé contient désormais le refus de navigation vers ce proxy dans `Bridge.launchIntent` avant les plugins, ainsi que le contrôle d'activation de CapacitorHttp et le refus des requêtes document dans `WebViewLocalServer.shouldInterceptRequest`.

[Avis officiel](https://github.com/ionic-team/capacitor/security/advisories/GHSA-rvm3-566m-v7fv) — [release 8.5.3](https://github.com/ionic-team/capacitor/releases/tag/8.5.3).

Le contrat `tests/ui/androidSecurityContract.test.js` empêche un retour silencieux à un runtime antérieur à la base corrigée 8.5.1 et impose la concordance des versions exactes avec le lockfile. Il ne remplace pas un test d'exploitation sur appareil.

Les sources applicatives Trip déjà modifiées avant ce lot sont conservées et incluses dans l'APK ; il ne s'agit pas d'un build isolé de l'ancien commit.

## Validation

- Build web et `cap sync android` réussis ; Gradle `clean assembleDebug` réussi.
- 140 fichiers Vitest / **935 tests réussis** ; 4 E2E du lien de téléchargement, 1440/390 px et clair/sombre, FR/EN, réussis.
- Contrôle de syntaxe : 258 fichiers réussis. Budget de taille existant respecté.
- Audit npm : plus aucun signalement `@capacitor/android` ; 15 signalements restants dans l'outillage et ses dépendances (3 critiques, 6 élevés, 6 modérés), à traiter au lot architecture/qualité.
- APK **7 015 964 octets**, signature v2 vérifiée ; même certificat debug que l'APK 10.5.372 précédent.
- Publication Supabase Storage réussie ; téléchargement public relu et SHA-256 identique au fichier local : `68BC3312976FAB4565B18A1D35700C6487BC7B4B331D949DA63B114690F0C6AA`.
- [APK 10.5.373](https://obznbrzarhvmlbprcfie.supabase.co/storage/v1/object/public/app-downloads/apk/travelbudget-10.5.373-20261010-092634-debug.apk).
- Logs, audit npm et relecture distante conservés localement dans `.codex/releases/10.5.373/`, exclus de Git. Le contrat E2E historique du H1 de la page Projet, déjà défaillant lors de l'audit initial, n'est pas corrigé dans ce lot.

## Contrôles sur téléphone restant à effectuer

1. Installer en mise à jour de l'APK debug existant, sans désinstallation ni effacement des données.
2. Vérifier la version 10.5.373, la connexion et le retour OAuth.
3. Vérifier l'ouverture des documents et liens externes, les notifications et la reprise de l'application.
4. Vérifier les données conservées et l'accès hors ligne, puis le retour réseau.

Aucun appareil ADB n'était connecté lors de la préparation. Ne pas déclarer ces vérifications réalisées à partir du seul succès de compilation.

## Portée

Ce lot corrige le runtime natif. Les autres alertes npm, l'architecture, la base de données et les défauts fonctionnels restent suivis dans `.codex/audits/2026-10-10/SUIVI_CORRECTIONS.md`, dans l'ordre demandé. Les sources web mises à jour localement ne sont pas un déploiement web.
