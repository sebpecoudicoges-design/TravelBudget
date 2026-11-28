# Android 15+ : avertissement Play Console sur les découpes d’écran

Relevé du 28 novembre 2026. Ne pas confondre le signal statique sur les bibliothèques embarquées avec un défaut d’affichage déjà reproduit sur un téléphone.

## Attribution et vérification

TravelBudget cible l’API 36. Aucun appel ou paramètre explicite `layoutInDisplayCutoutMode` n’a été trouvé dans ses propres sources et thèmes. Le compilateur peut intégrer `LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES` comme la valeur entière `1`, donc rechercher le nom de la constante dans l’application ne suffit pas.

Inspection en lecture seule des classes JVM dans les AAR de Google Maven (`javap -c -p` sur les deux classes signalées) :

| Classe et méthode | Dépendance de la configuration actuelle | Comparaison | Résultat |
| --- | --- | --- | --- |
| `com.google.android.gms.ads.internal.overlay.zzm.zzj` | `com.google.android.gms:play-services-ads:25.4.0` | `25.5.0` | Les deux versions écrivent `1` dans `WindowManager.LayoutParams.layoutInDisplayCutoutMode`. |
| `com.google.android.play.core.hsdp.service.HsdpShimActivity.onCreate` | `com.google.android.play:hsdp:2.0.1`, dépendance transitive de `play-services-ads-api:25.4.0` | `hsdp:2.2.0` et POM `play-services-ads-api:25.5.0` | `2.2.0` écrit encore `1` ; le POM Ads API `25.5.0` référence toujours `2.0.1`. |

Le nouveau mécanisme de mise à jour flexible utilise `com.google.android.play:app-update:2.1.0` et ne fournit pas `HsdpShimActivity`. HSDP est un SDK d’installation intégrée distinct. Aucune mise à niveau, exclusion forcée, suppression de publicité ou modification de ces AAR n’a été retenue pour traiter cet avertissement. Désactiver une publicité dans l’interface ne retire pas son SDK du binaire.

## Suite

- Garder l’avertissement ouvert tant qu’un SDK corrigé ou une alternative validée n’a pas été inspecté. Refaire le contrôle sur le prochain AAB exact avant de conclure à une disparition sur Play Console.
- Vérifier séparément le rendu sur Android 15 et 16, portrait et paysage avec découpe simulée, navigation par gestes et par boutons. Parcours : démarrage et connexion, menu mobile et formulaire de transaction avec clavier, navigation après fermeture d’une publicité de test, bannière de mise à jour. N’activer que les identifiants publicitaires de test sur émulateur ; aucune invitation Play ni Galaxy dans ce lot.
- Corriger les marges de la fenêtre et des zones tactiles si un défaut est mesuré. Ne pas baisser la cible ni désactiver le bord à bord pour masquer le signal : sur Android 15 avec une cible 35+, le mode SHORT_EDGES est traité comme ALWAYS pour les fenêtres non flottantes.

Sources : [Android 15 : bord à bord et découpes](https://developer.android.com/about/versions/15/behavior-changes-15), [notes Google Mobile Ads](https://developers.google.com/admob/android/rel-notes), [notes Google Play Inline Install](https://developer.android.com/reference/com/google/android/play/core/release-notes-hsdp).
