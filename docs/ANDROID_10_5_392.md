# Android 10.5.392 — réseau lent

Le contrôle de disponibilité attend désormais dix secondes par tentative et confirme un échec par un second contrôle en lecture seule. Une réponse lente, un premier échec ou une annulation volontaire ne suffisent plus à désactiver toutes les opérations. Une connexion réussie est réutilisée trente secondes ; un ancien contrôle échoué ne remplace pas une réussite plus récente. Les écritures échouées ne sont jamais rejouées par ce mécanisme.

L'ancien export global `tbMarkNetworkUnavailable` a été retiré après recherche des appels. Les deux appelants passent par `tbReportNetworkFailure`, qui déclenche une confirmation. Le marquage interne reste utilisé après confirmation ou lorsque le navigateur indique explicitement une absence de réseau.

Neuf tests de régression couvrent réseau lent, double échec, récupération, annulation, cache, contrôles concurrents et configuration tardive. Les 1 197 tests de 178 fichiers passent, ainsi que huit scénarios E2E en clair/sombre à 1440/390 px. Syntaxe, contrôles sémantiques, types Edge, documentation et budgets de taille validés. Retest téléphone requis, notamment connexion mobile faible, mode avion, retour réseau et absence de double transaction après une erreur.

APK debug `travelbudget-10.5.392-20261113-211349-debug.apk` : 12 230 110 octets, paquet `com.travelbudget.app`, code `10050392`, version `10.5.392`, min SDK 24, cible 36. Signature v2 vérifiée, certificat inchangé `9074406b0e5e64ee0d317c833494cc8a9872ead546cccef821604629e7da5ac0`. Scripts modifiés et tous les bundles JavaScript comparés aux sources embarquées ; aucun APK imbriqué.

SHA-256 local et téléchargement public identiques le 15 novembre : `F8622FEF9215E8926526C2A84708A9461A53EF32A1077FBAD5DE67079D6B7EEC`.

[Télécharger l'APK correctif](https://obznbrzarhvmlbprcfie.supabase.co/storage/v1/object/public/app-downloads/apk/travelbudget-10.5.392-20261113-211349-debug.apk). Le nom conserve l'horodatage UTC de préparation ; il ne constitue pas une preuve de publication à cette date. Ce fichier reste destiné au test direct et ne constitue pas un AAB Play Store.

Le 14 novembre, l'utilisateur a confirmé le fonctionnement de la bannière et de l'annonce d'ouverture de la version précédente. La cible Google Play retenue est `fr.pecloud.travelbudget`, distincte de l'APK historique `com.travelbudget.app`. Voir [préparation Play Store](PLAY_STORE_READINESS.md).
