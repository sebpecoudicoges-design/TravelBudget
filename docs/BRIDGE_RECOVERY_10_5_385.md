# Reprise des imports du bridge — 10.5.385

Le registre du lot 10.5.384 protégeait les imports du point d’entrée, mais trois imports directs restaient dans le bridge : données budgétaires du patrimoine, client de l’assistant et règles de progression Sport. Le test injectant une coupure sur Sport échoue avant correction à la seconde tentative, après rétablissement du réseau.

Ces trois imports passent désormais par le même mécanisme de registre. Le module réussi reste disponible, les tentatives concurrentes sont partagées et seules les erreurs réseau reconnues sur une entrée attendue de même origine autorisent une nouvelle URL. Les opérations métier restent exécutées à chaque appel : conserver le client assistant chargé ne doit pas réutiliser la réponse d’une ancienne question. Les contrôles de changement de compte du chargement patrimonial sont conservés.

Six scénarios Chromium vérifient les trois services sur les sources et sur le build compilé : premier échec réseau, reprise, puis nouvel appel sans nouveau téléchargement du module. L’assistant utilise un faux client local et vérifie deux invocations métier après la reprise ; aucune question ni donnée réelle n’est envoyée. Le test patrimoine utilise le mode hors ligne pour isoler le chargement du code des données distantes. Le service worker est bloqué pour ne pas masquer la panne.

Un contrat empêche le retour des imports directs dans les appelants du bridge. La recherche des usages ne révèle aucun helper métier mort à supprimer ; les trois fonctions publiques restent nécessaires. Aucun calcul financier, source de données ou contrôle de l’interface n’est modifié.

Mesure locale : JS initial 274,9 KiB, différé 574,7 KiB, total 849,6 KiB, gzip principal 78,8 KiB. Les plafonds de 10.5.384 sont conservés. Les dépendances internes, les erreurs d’évaluation et les moteurs autres que Chromium restent hors de cette garantie de reprise ; F8 n’est pas déclaré clos universellement.

Livraison : `travelbudget-10.5.385-20261028-120000-debug.apk`, package `com.travelbudget.app`, versionCode `10050385`. Page Projet et Atlas actualisés ; preuves finales consignées dans le suivi de l’audit. Validation sur téléphone restante. La phase architecture/qualité continue avant la phase base de données.
