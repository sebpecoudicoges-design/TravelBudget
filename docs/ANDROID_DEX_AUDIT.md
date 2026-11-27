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

Le [run R8 45908969275](https://github.com/sebpecoudicoges-design/TravelBudget/actions/runs/45908969275)
a mesuré **5 357 336 octets de DEX** côté candidat (−71,40 %),
avec mapping et métadonnées R8, sans symboles natifs. Ce gain de taille
n’est pas le score d’obscurcissement Play.

### Vérification de compatibilité hors ligne

Le même workflow assemble aussi les deux APK release pour un émulateur
API 35. Il signe uniquement ces APK avec une clé jetable du runner.
Après activation du mode avion et coupure des radios, chaque installation
part de zéro : l’écran de connexion doit réellement être rendu dans
WebView, le processus doit être actif et la route de retour OAuth doit
résoudre l’activité Android attendue. Les APK ne sont pas en téléversement.

Ce contrôle n’ouvre pas Google, ne valide pas Firebase ni un retour OAuth
complet, et ne teste pas les écrans après authentification. Il ne suffit
pas à décider de l’activation de R8 pour le prochain AAB Play.

Le [run 45918982007](https://github.com/sebpecoudicoges-design/TravelBudget/actions/runs/45918982007)
a passé ce contrôle pour le témoin et pour R8.

### Mémoire : référence locale reproductible

Le workflow relève séparément le PSS et le RSS totaux du **processus
principal** avec [dumpsys meminfo](https://developer.android.com/tools/dumpsys).
Même émulateur et même version Android, trois réinstallations par variante,
ordre alterné, mesure trois secondes après observation de l’écran de
connexion hors ligne, avec vérification du PID. Il rapporte les six
valeurs et la médiane par variante. Le fournisseur WebView est identifié,
mais les processus de rendu isolés ne sont pas imputés au processus
principal et ne sont pas inclus dans ces chiffres.

Ces relevés ne sont ni un pic mémoire ni la mesure
[Android vitals](https://developer.android.com/google/play/vitals/memory-usage)
(RSS anonyme + swap, par état du processus, tranche de RAM et percentile).
Ils ne couvrent pas encore une session ouverte, la navigation entre
modules ni les documents. Avant toute correction, relever la série et la
tranche de mémoire concernées dans Play, puis isoler chaque parcours avec
des données fictives. Une variation sur émulateur ne résout pas l’alerte Play.

Run mémoire [45920499637](https://github.com/sebpecoudicoges-design/TravelBudget/actions/runs/45920499637),
WebView 124.0.6367.219 : médiane PSS du processus principal
**84 869 → 71 982 Kio**, RSS total **224 412 → 212 556 Kio**.
Trois démarrages par version donnent un repère local, pas un P90 Play.

### Mesurer les trois scores DEX

Android CLI 1.1.16919734 et son pack d’optimisation sont épinglés par
empreinte. La CI analyse les deux AAB expérimentaux sans publicité
de leurs fichiers, sans connexion Play, et sans télémétrie du CLI.
Elle contrôle la taille contre l’inventaire ZIP et sépare les trois
scores de la métadonnée R8 des estimations d’obscurcissement. Un score
absent est affiché comme inconnu, non comme zéro. Le statut de correspondance
des DEX indique si la métadonnée peut être associée au binaire analysé.

[Google Play](https://support.google.com/googleplay/android-developer/answer/17492799?hl=en)
annonce pour février 2027 un minimum de 25 % par catégorie pour les apps
avec plus de 10 Mo de DEX ; la documentation Android déclenche l’alerte
dès 10 Mo. Ce calendrier général ne prouve pas une date spécifique
affichée dans la console. Les scores obtenus ici ne sont pas ceux de
l’AAB publié. Google recommande le dernier patch de la branche AGP pour
la fiabilité de la métadonnée ; mesurer 8.13.2 séparément si nécessaire.

Résultat [45926145115](https://github.com/sebpecoudicoges-design/TravelBudget/actions/runs/45926145115) :
AAB d’audit R8, **91,53 % optimisation / 92 % obscurcissement /
91,84 % réduction**, 5 357 336 octets DEX, métadonnée avec checksum DEX
exact. Le témoin n’a pas de scores R8. Aucun résultat ne porte sur .398 Play.

### Navigation native sans données réelles

Le premier essai de chaque variante valide aussi le parcours local
Connexion → formulaire de récupération → Connexion, en tapant les
contrôles réels via leur arbre d’accessibilité. Il vérifie que la page
bascule dans WebView et ne renseigne ni ne soumet aucun champ. Le relevé
mémoire est fait avant cette interaction. Il reste à tester les écrans
authentifiés et les documents à partir d’un environnement fictif séparé ;
les contrôles ne déclenchent pas de connexion ni de récupération réelle.

La CI [45931471995](https://github.com/sebpecoudicoges-design/TravelBudget/actions/runs/45931471995)
confirme ce parcours sur les deux versions. Un contrôle Chromium distinct
ouvre le vrai coffre documentaire avec des réponses fictives : affichage
d’une image, fermeture de l’aperçu, création d’un lien de courte durée
et ouverture effective du lien de repli pour le PDF à 390 et 1 440 px
en clair et sombre. Le clic déclenche une navigation distincte vers
l’URL attendue, à laquelle le banc sert un PDF fictif réel. Il ne
contacte pas le stockage et ne vérifie ni le rendu visuel du PDF dans
l’onglet ni l’ouverture et le rendu dans Android WebView. Le parcours
Android reste à reproduire dans un environnement isolé.

### Banc PDF Android isolé

Le workflow d’audit PDF embarque uniquement une page de test et un PDF
fictif dans le shell Capacitor de référence 10.5.397. La page utilise le
gabarit documentaire de cette version ; son style est simplifié. L’APK
debug utilise un identifiant d’application de test distinct et reste
sur le runner. L’émulateur API 35 est hors ligne. Le test capture la
WebView avant et après le clic sur le lien de repli et note l’activité
Android au premier plan. Le rectangle rouge du PDF permet de vérifier
visuellement son rendu, séparément du simple clic. Une exécution verte
prouve la capture, pas le rendu. L’URL du PDF est locale au shell :
l’ouverture d’un document signé via un lecteur externe et un stockage
réel reste une validation distincte. Aucun compte ni service réel n’est utilisé.

Résultat : [exécution Android 45956244692](https://github.com/sebpecoudicoges-design/TravelBudget/actions/runs/45956244692),
API 35, WebView 124.0.6367.219. Le modal et son lien sont visibles,
mais le cadre PDF reste blanc (aucune trace du rectangle rouge attendu).
Quatre secondes après le clic, l’écran est toujours sur le même modal,
sans PDF affiché ni activité externe au premier plan. C’est le résultat
sur le PDF interne du banc, pas une mesure du lien HTTPS signé vers
un stockage distant. La CI est verte pour la capture ; le rendu dans
la WebView n’est pas validé.

Prochain contrôle : mesurer séparément l’ouverture externe d’un lien
HTTPS servi par un hôte de test et le rendu embarqué, sans réutiliser
une URL de production. Ne pas supprimer le repli navigateur observé
par l’utilisateur et ne pas présenter le cadre blanc comme un aperçu
fonctionnel. Pour une correction, comparer une ouverture externe
Android explicite et un vrai moteur d’aperçu ; vérifier téléchargement,
erreur et retour dans l’app avant d’en faire le chemin par défaut.
