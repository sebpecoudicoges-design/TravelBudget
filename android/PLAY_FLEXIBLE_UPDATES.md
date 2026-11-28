# Google Play : mises à jour flexibles

Le parcours s’active uniquement pour `fr.pecloud.travelbudget` installé par Google Play. L’APK direct utilise `com.travelbudget.app` et n’affiche pas ces messages.

1. Une bannière propose une mise à jour que Google Play autorise en mode **flexible**. L’utilisateur peut continuer sans ouvrir le dialogue Play.
2. **Télécharger** ouvre le dialogue de consentement Google Play. Le téléchargement se fait en arrière-plan en cas d’accord.
3. Une autre bannière apparaît quand le fichier est prêt. **Redémarrer** demande l’installation ; ignorer la bannière n’interrompt pas l’utilisateur. Balayer une bannière met en pause le rappel pour cette version pendant 24 heures. Une invitation Google Play refusée ne se représente pas dans cet intervalle.
4. Au premier plan, l’app contrôle de nouveau l’état Play pour retrouver un téléchargement terminé quand elle était en arrière-plan. Une indisponibilité de Play n’empêche pas d’utiliser l’app.

## Vérification à prévoir sur Play

Éviter de téléverser sur le canal Alpha juste pour vérifier le branchement : [le partage interne Google Play](https://developer.android.com/guide/playcore/in-app-updates/test) prévoit un scénario de test séparé. Installer via Google Play une version de base contenant déjà ce code, avec un compte test autorisé. Ouvrir le lien Google Play d’une version compatible de code supérieur, sans l’installer manuellement, puis relancer l’ancienne version. Vérifier la bannière, le refus, puis l’acceptation et l’utilisation normale pendant le téléchargement. Passer l’app en arrière-plan, la rouvrir puis vérifier que le redémarrage n’arrive qu’après avoir appuyé sur **Redémarrer**. Vérifier que la mise à jour ne s’affiche pas sur l’APK direct. Les tests JVM ne prouvent pas l’éligibilité ni la distribution par Google Play.

Référence : [Guide Android Developers, mises à jour flexibles en Java](https://developer.android.com/guide/playcore/in-app-updates/kotlin-java).
