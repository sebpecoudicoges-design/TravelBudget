# Android 10.5.389

APK de test interne du 6 novembre 2026. Cette version embarque la modification atomique des dépenses Trip (commit ba6f6a93), le retour dans le budget des transactions ordinaires avec le serveur mis à jour, et la gestion des échecs de sauvegarde des repas et du sommeil.

Une modification Trip avec un paiement de 100 et une quote-part de 40 a été testée sur Supabase dans une transaction annulée. Une panne injectée après le retrait des anciennes écritures a restauré la dépense, le paiement et la quote-part. Les tests couvrent aussi les parts de 0 % et 100 %, le changement de payeur et la protection de la transaction d’un autre compte. L’édition nécessite un wallet de même devise lorsqu’un paiement ou une quote-part doit être enregistré.

## Vérifications

- Gradle a construit le paquet com.travelbudget.app, version 10.5.389, code 10050389, SDK minimal 24 et cible 36.
- Signature APK v2 vérifiée. Empreinte SHA-256 du certificat identique à celle de 10.5.388 : 9074406b0e5e64ee0d317c833494cc8a9872ead546cccef821604629e7da5ac0.
- SHA-256 de l’APK local : 77AB8709C2951D0E923B360B3FEC241EBEA0CA19C193E3884D28CC3133AF76CF.
- Comparaison par empreinte des scripts Trip, Nutrition, constantes, du service worker, de la page Projet, de l’index et du bundle principal embarqués. L’archive a aussi été contrôlée pour les APK ou AAB imbriqués.
- Le lot fonctionnel a passé 1 173 tests sur 173 fichiers et huit parcours Chromium. Après le changement de version, neuf tests ciblés et quatre parcours de la page Projet ont réussi. CI du lot fonctionnel réussie, run 42168137291.

La validation sur téléphone reste à faire, notamment l’installation en mise à jour, le pointage et la lecture des montants du wallet, du budget quotidien et d’Analyse après une édition. Les étapes sont dans [les tests manuels](MANUAL_TESTS.md). Les notifications aux participants sont postérieures à la confirmation de l’écriture financière.

## Distribution

[Télécharger l’APK 10.5.389](https://obznbrzarhvmlbprcfie.supabase.co/storage/v1/object/public/app-downloads/apk/travelbudget-10.5.389-20261106-152501-debug.apk). Le téléchargement public a restitué 7 883 064 octets avec la même empreinte SHA-256 que le paquet vérifié localement.
