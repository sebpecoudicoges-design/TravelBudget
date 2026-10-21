# Audit F8 — reprise du chargement, 21 octobre 2026

## Lot architecture et qualité

Un chargement refusé restait mémorisé et `tbIsLegacyDomainLoaded` assimilait une promesse présente à un module chargé. La reprise d'un domaine partiellement exécuté pouvait aussi réinstaller les gestionnaires de ses premiers scripts.

Le chargeur partagé `src/app/retryableLoader.js` conserve les succès, mutualise les appels concurrents et oublie les échecs. Le statut chargé ne devient vrai qu'après la résolution de toute l'initialisation. Les scripts classiques ont chacun leur suivi ; un script chargé avec succès n'est pas réexécuté lors de la reprise du domaine. L'élément script en erreur réseau est retiré. Le délai d'attente du bridge ne laisse plus de promesse rejetée permanente.

L'import d'Analyse utilise le même cycle de tentative. Chromium ayant reproduit un échec réseau mémorisé dans son cache de modules, la reprise de cet import utilise une URL distincte uniquement pour l'entrée Analyse attendue, sur la même origine. Aucun import depuis une autre origine ou un chemin arbitraire n'est accepté. Les erreurs d'évaluation ne sont pas rejouées. Voir les [règles de cache des imports dynamiques](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/import).

## Preuves et limites

- Tests unitaires : état pendant chargement, appels concurrents, succès conservé, erreurs synchrones/asynchrones, reprise partielle, URL de production autorisée, rejet des URL externes et arrêt après erreur d'évaluation.
- Tests Chromium : interruption du deuxième script Travail, reprise sans double exécution du premier ; interruption de l'entrée Analyse puis reprise sans recharger la page, sur les sources Vite et sur le bundle compilé de production. Le service worker est bloqué dans ces tests de panne pour que le cache hors ligne ne masque pas l'échec injecté.
- Les contrôles de navigation existants sont conservés. Aucun identifiant, commande ou disposition de l'interface n'a été modifié.
- Le contournement du cache ESM est ciblé sur l'entrée Analyse et le message d'erreur Chromium observé. Les erreurs de dépendances internes, les autres imports ESM, les autres moteurs et les erreurs d'exécution nécessitent encore des scénarios dédiés : F8 n'est pas déclaré clos dans tous les environnements.
- La reprise des données hors ligne (F2, F4, F5, F6) reste un chantier distinct ; aucune donnée distante modifiée dans ce lot.

## Coût et livraison

Mesure avant changement : JS initial 270,9 KiB, gzip 77,5 KiB. Après correction : 271,8 KiB, gzip 78 KiB. Le plafond initial passe explicitement de 271 à 272 KiB pour ce mécanisme de reprise ; les plafonds des domaines et du JS total restent inchangés. La mesure exhaustive du démarrage F9 reste ouverte.

Version de ce lot : 10.5.376 pour le web et l'APK reconstruit. La validation sur appareil Android reste séparée des tests Chromium et de la vérification du binaire.
