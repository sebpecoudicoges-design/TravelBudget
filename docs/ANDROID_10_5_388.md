# Android 10.5.388 — fiabilité et qualité

Date : 3 novembre 2026, Australia/Brisbane. APK debug destiné aux tests internes.

## Changements embarqués

- File hors ligne : une modification reçue pendant un envoi conserve sa révision ; les acquittements et le nettoyage Trip ne suppriment plus les modifications plus récentes.
- Synchronisation : protection contre deux démarrages pendant la vérification réseau, arrêt au changement de compte pendant cette vérification et libération du verrou du compte d’origine.
- Journal bancaire : le pointage groupé s’arrête à la fermeture du journal, même si sa suppression du DOM est différée. L’ancien contrôle de présence seul est remplacé par une vérification de l’état ouvert et de la présence ; les appels à cette garde restent inchangés.
- Corrections web accumulées : propagation des erreurs du coordinateur d’actualisation, suppression de la première implémentation écrasée de l’assistant initial et traduction de la catégorie Activités.
- Contrôles sémantiques étendus aux sources modernes, serveurs et scripts historiques.

Quatre régressions reproduites avant le dernier correctif ; vingt tests ciblés passent ensuite. Le déplacement de l’affectation `syncing` retire la fenêtre de réentrance ; l’ancienne affectation tardive est supprimée. Les appels des fonctions de verrou ont été recherchés avant modification.

Limites : localStorage reste non transactionnel entre onglets ; le bail de verrou n’est pas renouvelé et ce lot ne garantit pas l’idempotence serveur. Aucune migration SQL ni fonction Supabase déployée. Les corrections de fonctions serveur restent distinctes de la distribution Android.

## Validation

Compilation Gradle réussie. Identité : `com.travelbudget.app`, versionName `10.5.388`, versionCode `10050388`, SDK minimal 24, cible 36. Signature APK v2 validée, certificat identique à 10.5.387 (`9074406b0e5e64ee0d317c833494cc8a9872ead546cccef821604629e7da5ac0`).

Les 123 fichiers embarqués sont identiques au build web et aux deux fichiers Cordova générés par Capacitor. Les 57 scripts legacy correspondent aux sources et les marqueurs de révision/tentative/compte sont présents dans le bundle. Aucun APK imbriqué.

- Fichier : `travelbudget-10.5.388-20261103-183000-debug.apk`.
- SHA-256 : `4E29F72DFCE78125803895E1A20568E124AD72B14F91CE799BCCBF92092B3705`.
- [Téléchargement APK](https://obznbrzarhvmlbprcfie.supabase.co/storage/v1/object/public/app-downloads/apk/travelbudget-10.5.388-20261103-183000-debug.apk).
- 1 157 tests unitaires : campagne réussie après adaptation du test PWA au numéro courant ; lors de la dernière passe, timeout du processus d’analyse serveur, puis ses quatre tests réussis en relance isolée.
- 137 scénarios navigateur : 136 réussis au premier passage ; échec réel sur fermeture du journal corrigé, puis huit scénarios du journal réussis en clair/sombre, 1440/390. Les autres scénarios n’ont pas été rejoués après cette correction ciblée.
- Contrôles syntaxiques, sémantiques, types Edge, documentation et budgets validés ; plafonds inchangés par ce lot (initial 278 KiB, total 861 KiB).
- Audit npm : aucune alerte critique, 4 élevées et 8 modérées restantes. Aucune alerte sur `@capacitor/android` 8.5.3 ; alerte modérée indirecte sur le CLI.

Publication Storage vérifiée par téléchargement public : empreinte SHA-256 identique au fichier local.

Preuves locales : `.codex/releases/10.5.388/` (`quality-resume.log`, `quality-final.log`, `server-retry.log`, `e2e.log`, `journal-retry.log`, `android-final.log`, `apk-verified.log`, `dependencies.json`).

Validation sur appareil réel à faire : installation en mise à jour, connexion, conservation des données, file hors ligne, changement de compte, documents, notifications, première configuration, catégories et fermeture pendant le pointage groupé. Il s’agit d’un APK debug de test, pas d’une publication Play Store.
