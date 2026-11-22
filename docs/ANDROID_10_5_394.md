# Livraison web et Android 10.5.394 — 22 novembre 2026

Cette livraison intègre le correctif des quotes-parts Trip contenant « Avance », les protections de persistance et de bail de 10.5.393, puis la conservation des erreurs SQL, la suppression du nettoyage automatique au démarrage et le verrou navigateur par compte pour les synchronisations compatibles.

Les écritures concurrentes dans localStorage ne sont pas encore transactionnelles. Les anciens onglets et les environnements sans Web Locks utilisent le bail local existant. Aucune donnée financière distante n'est modifiée par cette livraison.

Artefact construit : `travelbudget-10.5.394-20261122-120000-debug.apk` (12 231 050 octets). Le suffixe identifie le lot de livraison du 22 novembre, pas l'heure de fin de compilation. Package debug vérifié : `com.travelbudget.app`, versionName `10.5.394`, versionCode `10050394`, mise à jour de l'APK existant. La variante Play `fr.pecloud.travelbudget` reste préparatoire, non publiée. Publicités de test conservées.

Signature v2 vérifiée ; certificat SHA-256 `9074406b0e5e64ee0d317c833494cc8a9872ead546cccef821604629e7da5ac0`, identique aux versions debug précédentes. Minimum SDK 24, cible 36. Les bundles JavaScript, scripts legacy concernés, index, service worker, page Projet et confidentialité embarqués correspondent aux sources compilées vérifiées. Aucun APK/AAB imbriqué. Empreinte SHA-256 de l'APK : `B883890574F49E1DF1BC5B19604461D46BC7CEE8FB269CBB43F63AAE3A8ADD98`.

Distribution vérifiée le 23 novembre 2026 : [téléchargement public de l'APK](https://obznbrzarhvmlbprcfie.supabase.co/storage/v1/object/public/app-downloads/apk/travelbudget-10.5.394-20261122-120000-debug.apk), taille et SHA-256 identiques au fichier local ci-dessus. Les premières tentatives réseau n'avaient pas confirmé le transfert ; le fichier public a ensuite été téléchargé et contrôlé. Aucun remplacement ni nettoyage d'ancien APK effectué.

Publication web demandée via Git/Netlify ; état distant à vérifier après push. Validation sur téléphone distincte et restante.

Validation locale : chaîne `quality` réussie, 1 240 tests / 179 fichiers, neuf parcours Chromium (Projet clair/sombre 1440/390, révisions persistées, deux onglets), contrôles sémantiques et budgets respectés. Audit npm au seuil critique réussi : zéro critique, quatre élevées et huit modérées restent dans la dette de dépendances. Aucun appareil ADB connecté lors du contrôle.
