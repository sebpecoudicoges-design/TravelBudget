# Android 10.5.391 — 13 novembre 2026

APK debug de test. Corrige l'attente illimitée de la bannière derrière le chargement de l'annonce d'ouverture et affiche les étapes et erreurs publicitaires dans Réglages. Aucune erreur de consentement ne permet de contourner l'autorisation Google.

Les 1 188 tests sur 177 fichiers passent avec deux workers. Le premier passage parallèle a dépassé le délai de cinq secondes dans deux tests de contrôle sémantique ; aucune assertion métier n'a échoué. Huit scénarios E2E passent à 1440/390 px en clair/sombre. Contrôles sémantiques, documentation et budgets de taille validés.

Le test de l'APK précédent n'affichait aucune annonce. Un chargement d'ouverture bloqué est désormais couvert par un test de régression ; cela ne prouve pas la cause exacte sur le téléphone. Lire [le diagnostic AdMob et l'état du message Google](ADMOB_ANDROID.md). La validation sur appareil reste nécessaire.

Fichier : `travelbudget-10.5.391-20261113-121500-debug.apk`, paquet `com.travelbudget.app`, code `10050391`. SDK minimum 24, cible 36. Taille : 12 229 706 octets.

- SHA-256 : `F0B173957C19BF95FE2E38A72F6A9C8590C6B2A059099F39057B99EA20E37438`.
- Signature v2 vérifiée, certificat inchangé : `9074406b0e5e64ee0d317c833494cc8a9872ead546cccef821604629e7da5ac0`.
- Sources des scripts métier concernés, index, pages Projet/confidentialité, service worker et tous les bundles JavaScript comparés au contenu embarqué ; aucun APK imbriqué.
- Atlas embarqué 10.5.391 identique au contenu généré pour publication, hors horodatage de génération.

[Téléchargement public](https://obznbrzarhvmlbprcfie.supabase.co/storage/v1/object/public/app-downloads/apk/travelbudget-10.5.391-20261113-121500-debug.apk). Transfert réussi après une première erreur réseau ; téléchargement public effectué et SHA-256 identique au fichier local. Preuves locales dans `.codex/releases/10.5.391/`.
