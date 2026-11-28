# Release Android : candidate d’optimisation R8

Sur la version Play 10.5.398, la release était compilée avec la minification désactivée. Le [run expérimental sur la même source 10.5.398](https://github.com/sebpecoudicoges-design/TravelBudget/actions/runs/45971145097) comparait deux bundles non signés : DEX non compressé de 18 734 416 à 5 357 336 octets, avec optimisation 91,53 %, obscurcissement 92 % et réduction 91,84 % côté R8. Il ne s’agit pas des scores du bundle déjà publié. [Mesurer les scores DEX](https://developer.android.com/google/play/vitals/code-optimization).

## Préparer le prochain candidat, sans changer le canal Play

1. Construire deux AAB sur le même arbre, avec le même SDK et les mêmes dépendances, sans clé de production. Construire le témoin avec `bundleRelease` et le candidat avec `bundleRelease -PtbEnableR8=true` ; copier le témoin avant de lancer le candidat. Cela active conjointement la minification et le fichier ProGuard Android optimisé sur le candidat. Le profil debug, le package, les écrans et la réduction des ressources ne changent pas.
2. Comparer la taille non compressée des DEX et examiner l’AAB candidat avec `android analyze`. Vérifier le mapping, son association au DEX exact et la présence des symboles natifs disponibles. Conserver le mapping correspondant au futur binaire signé hors de Git.
3. Avant d’utiliser ce profil pour la publication, vérifier le pont Capacitor, la connexion Google, les documents, les publicités de test et le parcours de mise à jour flexible. L’option peut être passée au script Windows existant par la variable de processus `ORG_GRADLE_PROJECT_tbEnableR8=true`. Ne pas publier sous le code de version déjà utilisé sur Play.
4. Ne pas fermer le suivi Vitals mémoire à partir de la taille DEX. L’ancien banc .398 relève au démarrage la mémoire du processus principal : médiane PSS 84 025 → 72 942 Kio ; RSS total 227 696 → 215 344 Kio. Play suit une autre mesure, notamment l’anonyme RSS + swap, ventilée par état de l’app et tranche de RAM. Isoler le parcours en cause avant de déclarer une correction. [Indicateurs mémoire Android](https://developer.android.com/topic/performance/memory/metrics).

Aucune de ces vérifications locales ne confirme la disparition d’une alerte dans Play Console.

## Résultat du candidat local avec mises à jour flexibles

Vérification du 28 novembre 2026, avec le même paquet et le même index Web embarqué dans les deux AAB non signés. Les quatre tests Gradle JVM sont passés. Les deux assemblages de diagnostic ont exclu le lint de publication, bloqué lors de la résolution locale de ses dépendances ; ni signature, ni exécution du candidat sur un appareil, ni dépôt dans Play.

- Témoin : SHA-256 `f04876a1482f3ee40320488fd5f7a493ef7e8630efc47e63f3afac598a83fb94` ; 22 034 416 octets DEX, sans mapping ni métadonnée R8.
- Candidat : SHA-256 `571467334a37c54a8e97ac9db6fcad196b982f93530c6ab7470ce1405ca3bcd5` ; 5 979 444 octets DEX (−72,86 %). Analyse du binaire exact : 91,09 % d’optimisation, 91,56 % d’obscurcissement, 91,38 % de réduction ; métadonnée R8 associée exactement à ses DEX. Mapping embarqué identique au fichier produit, inventaire des bibliothèques natives inchangé, pas de symboles natifs dans l’AAB.
- Sur la Console actuelle, le détail mémoire n’est pas affiché pour la .398 : seul l’état « Comportement insatisfaisant » est visible. L’analyse DEX précédente et ce résultat n’établissent pas le percentile mémoire du candidat.
