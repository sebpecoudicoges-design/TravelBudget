# Reprise des chargements KPI — 10.5.379

Le contrôle du démarrage connecté a révélé deux promesses conservées après leur achèvement dans `07_supabase_bootstrap.js` : Activité (Sport/Travail) et Nutrition. Le nettoyage comparait la promesse initiale à celle retournée par `finally`, qui est différente. Après un échec, les appels suivants réutilisaient donc le rejet sans requête réseau ; après un appel sans utilisateur ou hors ligne, ils pouvaient conserver le résultat ignoré.

La correction compare désormais la promesse effectivement enregistrée. Les appels concurrents restent partagés, le cache ne devient valide qu’après succès et une ancienne requête ne libère pas un rechargement forcé encore actif. Aucune relance automatique en boucle n’est ajoutée : le prochain appel du chargeur peut retenter.

Huit tests comportementaux exécutent le véritable script bootstrap dans un contexte isolé, avec réponses réseau synthétiques : erreur puis succès et cache, appel avant connexion, partage et rechargement forcé, hors ligne puis retour réseau, pour chacun des deux chargeurs. Les six premiers cas échouaient avant correction. Ces tests ne prouvent ni les autorisations SQL ni une session utilisateur réelle.

Recherche du code mort : les deux chargeurs ont des consommateurs actifs dans les KPI et Nutrition. Aucun consommateur supprimé ; les deux comparaisons inopérantes sont remplacées et couvertes contre régression. Les réponses concurrentes entre changements de compte et la mesure du parcours connecté complet restent à auditer.

APK prévu : `travelbudget-10.5.379-20261023-140000-debug.apk`, package `com.travelbudget.app`, versionCode `10050379`. Les preuves de validation et de distribution sont consignées dans le suivi de l’audit. Validation téléphone restante.

Le lot poursuit la phase architecture/qualité ; il ne clôt ni F8/F9 ni la phase base de données.
