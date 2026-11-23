# Livraison 10.5.395 — 23 novembre 2026

Ce lot corrige le précache Android : Capacitor intercepte `/favicon.ico`, qui répond 404 sur le Galaxy A54 et fait échouer `Cache.addAll`. L'icône non essentielle est retirée des listes de précache et préchauffage. Le favicon web et l'icône PWA SVG restent disponibles. La liste corrigée a été mise en cache avec succès dans un cache de diagnostic temporaire sur l'appareil, puis ce cache a été supprimé.

Autres corrections incluses : refus des écritures de file fondées sur une lecture périmée ou un ancien compte ; formatage local des dates d'analyse, notamment lors du passage à UTC+13 en Nouvelle-Zélande. Le stockage localStorage n'est toujours pas transactionnel : F2 reste ouvert.

Validation avant livraison : quality complet réussi, 1 248 tests / 180 fichiers ; rechargement PWA et graphiques hors ligne réussi. Les cinq parcours de révision et synchronisation multi-onglets ont été validés dans le lot précédent. Plafonds de compilation inchangés.

Artefact construit : `travelbudget-10.5.395-20261123-090000-debug.apk` (12 231 438 octets). Le suffixe est un identifiant de livraison, pas l'heure de fin de build. Package debug historique `com.travelbudget.app`, versionName `10.5.395`, versionCode `10050395`, minimum SDK 24, cible 36. Publicités de test ; aucune publication Play Store.

Build Gradle réussi. Signature v2 vérifiée, certificat SHA-256 `9074406b0e5e64ee0d317c833494cc8a9872ead546cccef821604629e7da5ac0`, identique aux APK précédents. Les bundles compilés, scripts legacy concernés, index, service worker et page Projet embarqués correspondent au build local. Aucun APK/AAB imbriqué. SHA-256 de l'APK : `F294ECA2F94DB0D72DED36A388F290B54C14B15A84DCF1191830080A5EFB498D`.

Les quatre contrôles de page Projet (clair/sombre, 1440/390 px) passent. Téléphone débranché avant la fin de compilation : la 10.5.395 n'est pas installée sur l'appareil ; seul le test isolé de précache décrit ci-dessus a été effectué sur sa WebView 10.5.394.

Distribution Supabase vérifiée : [APK public](https://obznbrzarhvmlbprcfie.supabase.co/storage/v1/object/public/app-downloads/apk/travelbudget-10.5.395-20261123-090000-debug.apk) téléchargé, taille et SHA-256 identiques au fichier local. Aucun ancien APK supprimé. Publication web prévue via push Git et Netlify ; preuve distante à vérifier après livraison.
