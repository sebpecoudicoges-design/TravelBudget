# Dépendances — 10.5.377

## Périmètre du 22 octobre 2026

Vite passe de 5 à **7.3.6**, Vitest de 2 à **4.1.10**, versions exactes avec lockfile. Les dépendances transitives compatibles sont actualisées, notamment tar et xmldom. Capacitor reste en Android/CLI 8.5.3 et Core 8.5.0. Node 24 est déclaré dans package.json et Netlify, comme en CI.

La migration conserve explicitement les cibles de compilation historiques : ES2020, Chrome 87, Edge 88, Firefox 78 et Safari 14. Vite 7 relève autrement les cibles par défaut. Cela préserve le contrat de compilation, sans certifier les fonctions de l’application sur chaque ancien navigateur. Sources : [migration Vite 7](https://v7.vite.dev/guide/migration), [migration Vitest 4](https://v4.vitest.dev/guide/migration).

Le test qui lance réellement PowerShell possède maintenant une limite de processus de 15 secondes et une limite de test de 20 secondes. Les assertions sur le code de sortie et l’arrêt des étapes suivantes sont conservées. Sous Vitest 4, le lancement parallèle avait dépassé les cinq secondes par défaut.

## Résultat de l’audit npm et limites

| État | Critiques | Élevées | Modérées | Total de paquets signalés |
|---|---:|---:|---:|---:|
| Avant | 3 | 6 | 6 | 15 |
| Après | 0 | 4 | 5 | 9 |

Ces nombres décrivent le graphe npm local et les avis du registre à cette date, pas des exploitations démontrées. `npm audit --omit=dev` retourne zéro alerte, mais n’évalue ni les scripts CDN ni les dépendances Gradle. Les outils de compilation restent importants même s’ils sont des devDependencies.

Alertes restantes : Vite, Vitest, @vitest/mocker, brace-expansion, nanoid, source-map-js, uuid et ses parents xcode/@capacitor/cli. Le registre recommande notamment Vitest 5.0.3 et Vite 8.3.4, mais ces versions ne sont pas téléchargeables lors du contrôle. Les dernières versions consultables incluent Vitest 4.1.10, Vite 8.1.5 (et la branche précédente 7.3.6), nanoid 3.3.16, source-map-js 1.2.1, brace-expansion 5.0.7. Il faut recontrôler la disponibilité des correctifs. Aucun override de version majeure transitive ni rétrogradation Capacitor n’est appliqué pour masquer ces alertes.

`npm run audit:dependencies` signale toutes les alertes et échoue au niveau critique ; la CI l’exécute après `npm ci`. C’est un seuil de blocage explicite, pas une acceptation définitive des niveaux élevés/modérés. Une erreur d’accès au registre échoue également. La protection de branche et le déploiement Netlify indépendant ne sont pas modifiés.

Recherche de code mort liée au lot : les paquets tinypool et vite-node ne sont plus présents après migration (`npm ls`), l’ancien graphe est supprimé du lockfile. Aucun module applicatif n’est supprimé sur simple présomption d’inutilité.

## Livraison et suite

Validation locale : 326 fichiers passent le contrôle syntaxique, 959 tests dans 145 fichiers réussissent. Les 74 scénarios Playwright desktop-chromium réussissent, incluant les vues 1440/390 px clair/sombre, les wallets et la reprise des imports source/compilés. Construction web et contrôle documentaire réussis. Avec les cibles historiques conservées, le total JS compilé passe de 846,0 à 846,1 KiB ; le seuil total est explicitement ajusté de 846 à 846,2 KiB pour cette variation du compilateur. Les autres seuils restent identiques (entrée 271,9/272 KiB, différé 574,2/575 KiB, CSS 79,3/79,4 KiB, entrée gzip 78/110 KiB). Cela n’est pas une mesure du démarrage réel (F9 reste ouvert).

APK de ce lot : `travelbudget-10.5.377-20261022-170000-debug.apk`. Vérifier la signature, le package/version, l’égalité du bundle embarqué avec dist et l’empreinte distante avant clôture. Validation physique Android restante.

Le lot dépendances reste partiellement ouvert. F9 (mesure du chargement réel, incluant legacy et CDN), F8 (autres imports et moteurs) et l’extraction progressive restent à traiter dans la phase architecture/qualité, avant la base de données.
