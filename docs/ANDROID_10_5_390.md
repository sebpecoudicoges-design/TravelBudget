# Android 10.5.390 — 11 novembre 2026

Compilation debug pour essais internes. Elle inclut les sauvegardes Sport atomiques, les collections et suppressions Trip, la conservation de la provenance du paiement brut et l'intégration AdMob Android.

## Binaire vérifié

- Fichier : `travelbudget-10.5.390-20261110-130035-debug.apk`.
- Paquet : `com.travelbudget.app`, version `10.5.390`, code `10050390`.
- SDK minimum 24, cible 36. Capacitor Android 8.5.3.
- Taille : 12 229 146 octets.
- SHA-256 : `9144C58D1A0FEF66335FEB87F5C912E3665203BCCD727975E81EB50EB41FDBCF`.
- Signature APK v2 valide, certificat identique à la distribution précédente : `9074406b0e5e64ee0d317c833494cc8a9872ead546cccef821604629e7da5ac0`.
- Comparaison des scripts Trip, Sport, Nutrition, chargements, Analyse, constantes, service worker, pages Projet/confidentialité, index compilé et de tous les bundles JavaScript embarqués avec les sources de compilation. Aucun APK imbriqué.

## Validation

Chaîne qualité complète réussie, 1 185 tests sur 176 fichiers, puis contrat Android supplémentaire réussi. Douze scénarios E2E distincts réussis sur l'écran de lancement, les commandes de confidentialité, les liens de téléchargement et l'analyse Trip, à 1440/390 px et en clair/sombre. Audit npm des dépendances de production sans vulnérabilité signalée. Les tests visuels utilisent le navigateur, pas un SDK publicitaire réel.

Les blocs d'ouverture et de bannière ont été créés dans AdMob. L'APK debug choisit les unités de démonstration Google côté natif. Configuration et limites dans [AdMob Android](ADMOB_ANDROID.md).

La première compilation a échoué sur la résolution réseau de Google Maven. La reprise a réussi. Google Mobile Ads 25.4.0 et UMP 4.0.0 sont verrouillés dans Gradle.

Distribution Supabase vérifiée par téléchargement public et comparaison SHA-256 identique. [Télécharger l’APK](https://obznbrzarhvmlbprcfie.supabase.co/storage/v1/object/public/app-downloads/apk/travelbudget-10.5.390-20261110-130035-debug.apk). Installation en mise à jour et comportement publicitaire sur téléphone restent à valider. Aucun téléphone connecté pendant la livraison.
