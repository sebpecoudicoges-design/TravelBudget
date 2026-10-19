# Trip et wallets — correctif 10.5.374 du 17 octobre 2026

## Incident et nettoyage ciblé

Six crédits Trip de 50 AUD datés du 17 octobre étaient encore présents malgré l'annulation de leurs six règlements. Les liens entre événements annulés et transactions ont été vérifiés avant suppression. Les six transactions (300 AUD) ont été supprimées avec la fonction applicative de suppression, dans une transaction SQL vérifiant exactement six correspondances. La relecture confirme zéro transaction restante parmi ces six identifiants. Aucun identifiant personnel n'est inclus dans ce document.

## Causes et corrections

- **Création répétée** : chaque clic pouvait créer un nouvel événement, puis une transaction distincte ; la liaison finale était seulement tentée après coup. La nouvelle RPC `trip_apply_settlement_v2` crée et lie les deux objets dans une seule transaction SQL. Un identifiant de requête conservé pendant les reprises et un verrou serveur empêchent le rejeu du même paiement. Les contrôles du formulaire sont désactivés pendant l'enregistrement ; un échec de rafraîchissement après succès ne relance pas le paiement. Le montant partiel réellement saisi est conservé.
- **Annulation incomplète** : `trip_cancel_settlement_v1` ne renseignait que `cancelled_at`. Elle supprime désormais la transaction liée et annule l'événement atomiquement, y compris si l'événement était déjà annulé par un ancien client. Seuls le créateur ou le propriétaire du Trip participant peuvent annuler ; la transaction doit appartenir au créateur. Une répétition de l'annulation est sans effet supplémentaire. Les anciens chemins de création/liaison/annulation séparées du repository ont été retirés avec contrat anti-retour.
- **Bouton Archiver déplacé** : le script de tri sélectionnait les descendants `[data-wallet-id]`, donc aussi les boutons. La carte et ses six boutons partageant le même identifiant, la restauration de l'ordre finissait par déplacer le bouton Archiver directement sous la liste. Le tri porte désormais uniquement sur les cartes `.wallet` enfants directs ; les gestionnaires de glisser-déposer sont liés une seule fois par élément. Les commandes et leurs attributs restent inchangés.

## Vérifications

- Reproduction navigateur avant correction : deux boutons déplacés hors des deux cartes après restauration d'un ordre sauvegardé.
- Après correction : 16 variantes wallets (1440/900/600/390 px, clair/sombre, web/Android simulé), ordre sauvegardé avec doublon, appels de réinitialisation répétés, cartes actives/archivées et clic Archiver.
- Tests JavaScript de clics concurrents, réponse perdue puis reprise avec la même requête, montant partiel, rafraîchissement en échec et règlement sans wallet.
- `tests/db/trip-settlement-atomic.sql` exécuté contre le serveur avec annulation de toutes les écritures de test : reprise sans doublon, erreur après insertion sans événement orphelin, rejet d'un tiers, annulation répétée, impossibilité de recréer un paiement annulé et absence de droit anonyme.
- Migration appliquée et enregistrée : `20261017015741_trip_settlement_atomic.sql`. Les avis de sécurité ont été relus ; les RPC restent volontairement exécutables par les utilisateurs authentifiés, avec contrôles d'identité et de participation dans leur corps.

## Distribution

La version web et l'APK 10.5.374 contiennent les corrections clientes. La correction serveur est déployée séparément. Le nouvel APK doit être installé sur les appareils utilisant une version antérieure ; la simulation Android dans Chromium ne remplace pas une validation physique sur téléphone.
