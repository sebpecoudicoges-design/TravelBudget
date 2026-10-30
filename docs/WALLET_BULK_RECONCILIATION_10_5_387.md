# Pointage groupé du journal — 10.5.387

Priorité utilisateur du 31 octobre 2026, pendant la phase architecture/qualité.

Le journal propose **Tout pointer** et **Tout dépointer**, avec le nombre d'opérations à changer. Les actions portent sur l'intersection des filtres actifs : dates, recherche et statut de pointage, dans le wallet ouvert. Les opérations hors filtre, non payées ou internes ne sont pas ciblées. Un bouton sans cible est désactivé. Les coches devenues obsolètes après modification peuvent aussi être effacées avec Tout dépointer.

La liste ciblée est figée au clic : le filtre Non pointées ne fait donc pas sauter des opérations à mesure qu'elles sont enregistrées. Les filtres, le rafraîchissement et les boutons sont désactivés pendant le traitement ; Fermer reste disponible. Fermer ou changer de compte arrête les requêtes suivantes. Une requête déjà envoyée peut finir côté serveur et sera relue à la réouverture.

Chaque opération utilise la RPC de pointage existante, avec sa révision attendue. Ce traitement est séquentiel, pas une transaction atomique de groupe. Au premier échec, il s'arrête et indique le nombre de sauvegardes confirmées ; celles-ci restent visibles. Les cibles déjà dans l'état voulu ne sont pas renvoyées lors d'une nouvelle tentative. En cas de réponse réseau perdue après sauvegarde serveur, Actualiser permet de relire l'état réel. Les appels sont idempotents pour une même révision. Aucun montant ni solde n'est modifié ; aucune migration SQL nécessaire.

L'ancien gestionnaire de sauvegarde individuelle a été remplacé par un chemin commun individuel/groupe, sans perdre ses sélecteurs ni sa gestion d'erreur. Aucun second chemin de sauvegarde inutile n'est conservé.

Validation navigateur synthétique en clair/sombre à 1440/390 px : pointage et dépointage de deux opérations ciblées par date/recherche/statut, exclusion des autres lignes, compteur, absence de cible, erreur sur la deuxième sauvegarde, reprise sans renvoyer la première opération, persistance après réouverture et fermeture pendant une requête suspendue. Les scénarios individuels existants restent exécutés. Captures contrôlées ; tests sur compte réel et téléphone physique distincts.

Livraison prévue : APK debug `travelbudget-10.5.387-20261031-120000-debug.apk`, page Projet et Atlas. Signature, contenu embarqué, téléchargement public et déploiement vérifiés dans le suivi de livraison. Validation téléphone restante.
