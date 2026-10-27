# Registre des modules différés — 10.5.384

## Défaut et correction

Après une erreur réseau au premier import de Comptabilité, Chromium conservait l’échec de l’URL et la deuxième ouverture échouait sans nouvelle requête, même après rétablissement du réseau. Ce défaut a été reproduit avec le code 10.5.383 avant correction. La protection existante concernait seulement l’entrée Analyse.

Les 22 imports différés déclarés par `src/main.js` passent maintenant par `src/app/moduleRegistry.js`. Le registre partage les tentatives concurrentes et conserve les modules réussis. Après un échec réseau reconnu, il réutilise le mécanisme de reprise existant avec une URL distincte, limitée à l’entrée attendue et à la même origine. Les chemins source et les noms des chunks compilés sont explicitement bornés. Un message d’erreur ne peut pas demander le chargement d’une autre entrée, même enregistrée.

La seconde table de promesses des domaines est supprimée après recherche des usages ; l’installation des domaines utilise le chargeur partagé déjà testé. Un contrat interdit le retour de cette table et des imports directs dans les appelants. Les points d’entrée publics, la navigation, les globals des domaines et les fonctionnalités restent conservés. Les calculs comptables de 10.5.383 restent inchangés.

## Validation et limites

Les tests unitaires couvrent concurrence, état chargé, cache des succès, reprise des URL source/compilée, indépendance des autres modules, refus d’une dépendance ou entrée inattendue et déclaration invalide. Les tests Chromium injectent un échec réseau sur Analyse, Comptabilité, Nutrition, Travail et une entrée Trip, puis retentent sans recharger la page, sur les sources et le build compilé. Le service worker est bloqué pour ces tests afin que le cache ne masque pas l’échec.

Cette reprise est ciblée sur les erreurs réseau d’entrée reconnues dans Chromium. Elle ne rejoue pas les erreurs d’exécution et ne contourne pas l’échec d’une dépendance interne. Les imports propres au bridge, les autres moteurs et la validation Android sur appareil restent à traiter séparément : F8 n’est pas déclaré clos partout.

Mesure du build avant livraison : JS initial 274,7 KiB contre 272,5, total 849,4 contre 847,1 ; gzip du principal 78,7 contre 78,2. Les plafonds passent explicitement à 275 KiB pour l’initial et 849,7 KiB pour le total. Aucun relèvement du plafond différé ; aucune promesse d’accélération du démarrage.

APK du lot : `travelbudget-10.5.384-20261027-100000-debug.apk`, package `com.travelbudget.app`, versionCode `10050384`. Page Projet et Atlas actualisés. Les résultats finaux et preuves de livraison sont consignés dans le suivi de l’audit. La phase architecture/qualité continue ; la phase base de données reste distincte.
