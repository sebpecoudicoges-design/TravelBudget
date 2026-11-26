# Android : référence DEX de la version 10.5.397

La Console Play signale 0 % d’obscurcissement pour le test fermé
`fr.pecloud.travelbudget`, versionCode `10050397`. Le seuil affiché est
25 %. La source du lot `6a66c81aaa50317cb8b6b5be0b37f772ac08cd8d`
utilise AGP 8.13.0, Gradle 8.14.3, et `minifyEnabled false` en release :
ce réglage est cohérent avec l’alerte, mais ne mesure pas le binaire
soumis. Le fichier APK debug distribué séparément n’est pas ce binaire.

## Relever une base comparable

- Le workflow d’audit reconstruit une release **non signée** depuis ce
  commit dans un checkout isolé, sans `google-services.json`, clé ou accès
  Play, et sans déposer le bundle dans un stockage partagé. Ce témoin
  ne prouve ni l’identité du binaire soumis ni le bon fonctionnement de
  Firebase ou de la connexion Google. Les scores Play exacts doivent
  être relevés sur l’AAB correspondant à la soumission.
- `python3 scripts/android/dex_inventory.py fichier.aab` (Python 3.11+)
  extrait le SHA-256, la taille non compressée des DEX normalisés par
  module, le volume des bibliothèques par ABI et la présence des
  métadonnées de symboles, mapping et R8. L’inventaire n’exécute pas le
  fichier et ne déduit aucun pourcentage de la taille. Commande de
  référence pour les scores : `android analyze --format=json fichier.aab`.
  Voir [la documentation Android](https://developer.android.com/google/play/vitals/code-optimization)
  et [le format de sortie de l’analyseur](https://developer.android.com/tools/agents/android-cli/commands/analyze).
- Pour comparer, garder le même commit, le même SDK et les mêmes
  dépendances. Si une mise à jour du patch AGP est nécessaire pour les
  métadonnées R8, appliquer le même patch au témoin et au candidat.
  Évaluer à part le changement minimal vers `minifyEnabled true` avec
  `proguard-android-optimize.txt`. Ne pas modifier le build debug.
- Côté compatibilité, Capacitor embarque des règles de consommation qui
  préservent ses classes de plugins et points d’entrée annotés. Examiner
  la configuration fusionnée avant d’ajouter des règles. Vérifier sur
  émulateur le démarrage, le pont WebView/Capacitor, la navigation, les
  documents et le retour légitime à l’app avec données fictives, avant
  toute promotion. Conserver le mapping exact du candidat et les symboles
  natifs disponibles, sans les publier dans Git.
- La consommation de mémoire fait l’objet d’une mesure distincte :
  pas de conclusion sur la P90 de Play ni sur WebView à partir des tailles DEX.

Aucun réglage de compilation, déploiement ou binaire Play ne change dans
ce lot de mesure.

Contrôle séparé sur l’APK de téléchargement direct 10.5.397
(`com.travelbudget.app`, SHA-256
`49fd0e9e917e999642e24e4be1a52702648bbb6f7442959f895361976c70c2c2`) :
15 DEX, 22 245 916 octets non compressés. Ce constat n’est pas
transposable à l’AAB Play ; il vérifie l’inventaire sur un vrai APK
et justifie de mesurer le vrai bundle au lieu de déduire sa taille
depuis celle du ZIP.

## Référence contrôlée et expérience R8

Le [run de référence 45902982660](https://github.com/sebpecoudicoges-design/TravelBudget/actions/runs/45902982660)
a reconstruit la release non signée : **18 734 444 octets de DEX**
non compressés, sans mapping, `r8.json` ni symboles natifs détectés.
SHA-256 du témoin :
`07046a778445b6bb6b78df11a7ab9f55fbadea82ecaaad83e5094e7d91ad40fd`.

Le workflow compare maintenant, sur le même runner et le même checkout
jetable, ce témoin avec une compilation R8 qui ne modifie que les lignes
`minifyEnabled` et `getDefaultProguardFile`. Pas de réduction des ressources
dans cette expérience, afin d’isoler le changement. La vérification exige
un mapping non vide et embarqué, une baisse des octets DEX et un inventaire
natif de taille inchangé. Le workflow n’envoie ni les bundles ni le mapping ;
il affiche les empreintes et, si disponible, les scores via `android analyze`.
Les vérifications sur émulateur et l’AAB exact de Play restent distincts de
cette expérience ; la release du dépôt et l’Alpha ne sont pas modifiés.
