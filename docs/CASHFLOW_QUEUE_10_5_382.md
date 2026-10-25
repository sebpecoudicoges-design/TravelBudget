# File de rendu de la courbe — 10.5.382

## Défaut reproduit

Deux ordonnanceurs indépendants pilotaient le rendu ApexCharts. Un garde temporel de 1,2 seconde ignorait les demandes portant la même clé, sans inclure les filtres de catégories ni les options d'impayés. Le second ordonnanceur mémorisait sa clé avant la réussite du rendu, y compris lorsque le Dashboard était masqué. Sa lecture du scope utilisait aussi une constante hors de sa portée.

Reproduction navigateur sur le code 10.5.381 : après « Aucune », la somme des barres budgétaires reste à 1 200 au lieu de 0. Le test fige seulement `Date.now` après le premier rendu pour garantir que les actions restent dans la même fenêtre temporelle. Les temporisateurs et ApexCharts restent réels.

## Correction

Les deux entrées publiques, les événements de données et les commandes de la courbe passent maintenant par une seule file. Les demandes reçues avant la prochaine frame sont regroupées. Si ApexCharts travaille encore, les demandes attendent sa fin puis un nouveau rendu prend le dernier état disponible. Il n'y a plus de boucle de polling à délai nul ni de suppression basée sur le temps ou sur une clé incomplète. Une erreur est signalée et une demande ultérieure peut retenter le rendu.

Le cache local de séries est supprimé : le producteur enregistrait `actual`, `forecast`, `spentBars` et `budgetUsedVal`, mais le lecteur exigeait `series` et `options`, jamais produits. Ses lectures, sérialisations et écritures ne pouvaient donc éviter aucun calcul. Les anciennes entrées déjà présentes sur un appareil ne sont pas purgées par ce lot. Le helper de hooks non appelé et ses deux appels vers des fonctions inexistantes sont également retirés après recherche des usages.

La préparation budgétaire de 10.5.381 et les calculs financiers restent inchangés. Les contrôles, le conteneur, les catégories, les impayés, le zoom et les thèmes sont conservés.

## Validation

Six tests unitaires couvrent une rafale de 100 demandes regroupée en un rendu, l'absence de chevauchement, les changements pendant un rendu, les appels rapides successifs, la libération après erreur et le démarrage différé. Les contrats vérifient les deux entrées publiques et l'absence des mécanismes obsolètes.

Quatre scénarios navigateur avec 1 200 transactions synthétiques vérifient « Aucune » → « Tous » → changement de thème, en clair/sombre à 1440/390 px. Ils vérifient les montants de la vraie instance ApexCharts et l'absence d'écriture du cache supprimé. Les services externes restent simulés et bloqués ; seul le WebSocket local de développement Vite est autorisé pour ce test.

Mesure locale indicative, sans instrumentation CPU :

| Mesure | Avant | Après |
| --- | ---: | ---: |
| Dashboard prêt, desktop | 2,12 s | 1,12 s |
| JS cumulé, desktop | 1,19 s | 0,49 s |
| Dashboard prêt, mobile simulé | 8,40 s | 8,79 s |
| JS cumulé, mobile simulé | 2,38 s | 1,84 s |

Les quatre parcours terminent sans erreur. Les temps varient avec la machine et les travaux concurrents : ce lot corrige des actions perdues et réduit les mécanismes concurrents, sans garantir une amélioration du délai total sur téléphone.

APK du lot : `travelbudget-10.5.382-20261025-133000-debug.apk`, package `com.travelbudget.app`, versionCode `10050382`. La page Projet et l'Atlas sont actualisés ; les preuves de livraison sont consignées dans le suivi de l'audit. Les essais sur appareil et compte réel restent à effectuer. La phase architecture/qualité continue ; la phase base de données reste distincte.
