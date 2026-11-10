# Publicités Android

Deux blocs ont été créés dans le compte AdMob TravelBudget.

| Usage | Identifiant |
|---|---|
| Application | ca-app-pub-4442850970011184~9582263891 |
| Ouverture | ca-app-pub-4442850970011184/3365349065 |
| Bannière | ca-app-pub-4442850970011184/2941681387 |

Plugin Capacitor Community AdMob 8.3.0. Android uniquement. Les builds debuggables utilisent les blocs de démonstration Google, déterminés côté natif. Ces APK ne génèrent pas de recettes publicitaires.

Une tentative à l'ouverture du processus lorsque le réseau est disponible, sur un écran de chargement limité à cinq secondes. Après expiration, retour réseau ou formulaire de consentement, seule la bannière est admissible. Les retours depuis une annonce, une authentification ou une autre application ne déclenchent pas une nouvelle annonce d'ouverture.

Le SDK UMP actualise le consentement avant initialisation. Sans canRequestAds, aucune annonce n'est demandée. Le bouton « Confidentialité des annonces » apparaît dans Réglages quand UMP le demande. Une modification retire la bannière puis réévalue l'autorisation. Une erreur de consentement ou de réseau laisse l'application utilisable.

La bannière adaptative utilise un espace natif sous la WebView. Toute la fenêtre web, y compris ses commandes fixes et ses dialogues, est redimensionnée. La hauteur est restituée en cas d'échec ou de retrait. Aucun contenu financier, document, repas ou séance n'est envoyé aux annonces par le code applicatif.

Avant diffusion commerciale, configurer et publier les messages requis dans AdMob > Confidentialité et messages, vérifier l'état d'approbation de l'application, sa fiche boutique et app-ads.txt, puis actualiser les déclarations de confidentialité de la boutique. La création des blocs ne prouve pas ces validations.

Validation appareil restante : ouverture en ligne/hors ligne, consentement requis/refus/retrait, absence de remplissage, rotation, clavier, navigation inférieure et dialogues, retour d'authentification, fermeture/réouverture et mise à jour de l'APK précédent. Vérifier que les créations portent le marquage test sur l'APK debug.

Références : [plugin](https://github.com/capacitor-community/admob), [consentement](https://developers.google.com/admob/android/privacy), [annonces de test](https://developers.google.com/admob/android/test-ads), [ouverture](https://developers.google.com/admob/android/app-open).

Budget mesuré du lot : 277,6 KiB JS initial, 599,2 KiB différé et 876,7 KiB total. Le plafond initial reste 278 KiB. Les plafonds différé/total passent à 601/879 KiB pour le module publicitaire et ses dépendances, CSS à 81,5 KiB.
