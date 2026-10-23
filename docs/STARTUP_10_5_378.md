# Démarrage et bibliothèques locales — 10.5.378

## Corrections du 23 octobre 2026

Les trois scripts CDN bloquants ont été retirés de index.html. Supabase 2.110.6, ApexCharts 8.4.1 et ECharts 6.1.0 sont verrouillés dans package.json et package-lock.json. Le script vendors:prepare copie leurs distributions navigateur, licences et notices dans public/vendor ; les noms incluent les versions et manifest.json fournit les empreintes SHA-256. Les fichiers sont générés avant dev/build, embarqués dans l’APK et servis depuis la même origine sur le web. Aucun téléchargement CDN n’est nécessaire à leur exécution.

Supabase charge avant les scripts legacy qui créent son client. ECharts charge avant Analyse/Patrimoine, ApexCharts avant la courbe de trésorerie. Le chargeur existant partage les demandes concurrentes et efface les échecs réseau pour permettre une reprise. La courbe ne demande plus sa bibliothèque avant qu’un utilisateur soit identifié ; le rendu après connexion reste déclenché par le bootstrap et renderAll.

Le registre annonçait Supabase 2.110.8 mais sa dépendance @supabase/phoenix@0.4.5 était introuvable. La version installable 2.110.6 est utilisée sans override. Le CDN non verrouillé annonçait 2.118.0 lors de l’inspection : ce changement de distribution impose un retest de connexion/session sur téléphone, en plus des vérifications automatisées.

ECharts 5.6.0, auparavant fourni par le CDN, est concerné par [GHSA-fgmj-fm8m-jvvx](https://github.com/advisories/GHSA-fgmj-fm8m-jvvx). La version 6.1.0 corrige cet avis ; le thème v5 et les deux appels init existants conservent les réglages visuels précédents suivant le [guide de migration officiel](https://echarts.apache.org/handbook/en/basics/release-note/v6-upgrade-guide/). Aucun scénario d’exploitation de l’application n’a été établi. L’audit npm revient à neuf alertes d’outillage (zéro critique) après cette correction ; elles restent suivies dans le lot précédent.

## Mesures et garde-fous

Le rapport de taille lit désormais le graphe des imports statiques du manifeste Vite, au lieu de considérer le plus gros fichier comme l’entrée. « Initial JS (static ESM only) » ne prétend plus représenter tout le démarrage. Les bibliothèques distribuées dans vendor ont un budget séparé ; elles étaient auparavant invisibles au contrôle de taille.

`npm run perf:startup` sert dist en HTTP local avec gzip, lance Chromium dans deux contextes neufs sans service worker/cache, ouvre le parcours anonyme jusqu’au chargement legacy puis observe 1,5 seconde supplémentaire. Il consigne les requêtes, statuts, octets JavaScript décompressés, octets réseau reçus et temps cumulé d’exécution JavaScript. Le profil mobile simule une largeur de 390 px, un CPU ralenti ×4, 40 ms de latence et 10 Mbit/s en réception. Ce n’est ni un téléphone réel, ni une mesure de TTI, ni un parcours connecté avec des milliers de transactions. Le temps JavaScript ne mesure pas isolément le parsing.

Première mesure locale : 44 scripts, 1 372,6 KiB de JavaScript décompressé, environ 428 KiB transférés pour l’ensemble des ressources observées. Entrée legacy prête vers 1,82 s desktop / 3,72 s mobile simulé ; JavaScript cumulé 38 / 167 ms. Les temps fluctuent avec la machine. Avant le garde utilisateur, le même parcours local chargeait inutilement ApexCharts et le domaine cashflow (2 350,8 KiB JS observés) ; ce n’est pas une comparaison exhaustive avec l’ancien déploiement CDN.

La CI bloque sur un échec de démarrage, une erreur JavaScript, un script distant/absent, un graphique chargé sur le parcours anonyme, plus de 60 scripts ou plus de 1 500 KiB JS. Les durées sont enregistrées sans seuil matériel fragile. Le rapport JSON est publié comme artefact CI.

Coût du nouveau chargeur : entrée ESM 272,4 KiB (seuil 272,6), total ESM 846,6 KiB (seuil 847) ; les seuils précédents étaient 272 et 846,2. Bibliothèques locales, thème inclus : 2 236,7 KiB, budget séparé 2 340 KiB. Les graphiques constituent l’essentiel de ce volume et sont différés. Les autres seuils ne changent pas.

## Validation et limites

Les nouveaux tests utilisent les vrais moteurs graphiques, dont les options de trajectoire Analyse, aux largeurs 1440/390 en clair/sombre. Ils couvrent la bibliothèque partagée, l’échec puis la reprise réseau, et le rechargement PWA hors ligne après une visite contrôlée ayant rempli les caches. Une première visite hors ligne sans cache reste impossible sur le web ; les bibliothèques sont en revanche embarquées dans l’APK.

Code mort lié au périmètre : scripts CDN et anciennes interceptions CDN des tests supprimés ; le générateur retire seulement les anciens fichiers déclarés dans son propre manifeste. Les consommateurs des deux moteurs sont conservés. L’empreinte Atlas inclut désormais config, notamment le manifeste des bibliothèques et les budgets.

APK de ce lot : `travelbudget-10.5.378-20261023-090100-debug.apk`. Vérifications de signature, version, bundle/Atlas/vendor embarqués et empreinte distante requises avant clôture. Validation téléphone et session authentifiée réelle restantes.

F9 est partiellement traité : dépendances locales verrouillées et parcours anonyme mesuré. Restent le parcours connecté représentatif, les appareils réels et la réduction progressive des 38 scripts legacy. F8 reste partiellement ouvert pour les autres imports/moteurs. La phase base de données n’est pas commencée par ce lot.

Validation de la chaîne locale : 961 tests unitaires dans 146 fichiers réussis, contrôle syntaxique, documentation, build et budgets réussis. Les preuves de publication et la campagne navigateur complète sont consignées dans le suivi de corrections de l'audit.
