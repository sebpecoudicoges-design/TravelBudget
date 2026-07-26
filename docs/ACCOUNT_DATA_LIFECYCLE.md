# Cycle de vie des données du compte

## Deux exports distincts

Le bouton historique `Export` conserve son rôle de backup réimportable pour la période active.

Le bouton `Exporter toutes mes données`, dans Réglages > Compte, appelle l'Edge Function `export-account-data` et produit un JSON contenant :

- le compte et le profil ;
- toutes les lignes détenues par l'utilisateur dans les domaines Budget, Trip, Documents, Sport, Nutrition, Santé, Travail, Patrimoine, Inbox et Notifications ;
- les données des Trips auxquels l'utilisateur participe ;
- les enfants sans `user_id` reliés à un programme Sport ou à un asset ;
- les données locales Travel Budget présentes sur l'appareil ;
- un manifeste des fichiers Storage avec des liens signés valables une heure.

Le JSON complet est un export de portabilité. Il n'est pas réimporté automatiquement par le backup historique.

## Demande de suppression

`request-account-deletion` accepte uniquement un JWT utilisateur vérifié côté serveur. L'identifiant du compte vient du JWT et jamais du corps de la requête.

Le mot `SUPPRIMER` est obligatoire. La demande est mise en attente pendant sept jours et peut être annulée depuis l'application.

La table `account_deletion_requests` n'est pas accessible directement aux rôles `anon` et `authenticated`. Les opérations passent par les Edge Functions avec la clé serveur conservée hors du client.

## Traitement différé

`process-account-deletions` traite au maximum dix demandes arrivées à échéance. Elle exige le secret serveur `ACCOUNT_DELETION_PROCESSOR_SECRET`.

Ordre de traitement :

1. supprimer les fichiers `personal-documents` et `inbox-documents` ;
2. transférer les Trips partagés à un autre participant lorsque cela est possible ;
3. dissocier l'identité de l'ancien membre dans l'historique partagé ;
4. supprimer les lignes personnelles et les références bloquantes ;
5. supprimer le compte Supabase Auth en dernier ;
6. conserver seulement le statut technique de traitement, sans `user_id`.

Le déclenchement planifié de `process-account-deletions` doit être configuré séparément après déploiement. Il ne faut pas activer la purge tant qu'un test complet n'a pas été réalisé sur un compte de démonstration.

## Ordre de mise en production

1. Appliquer la migration `account_data_requests`.
2. Définir `ACCOUNT_DELETION_PROCESSOR_SECRET`.
3. Déployer `export-account-data` et `request-account-deletion`.
4. Tester l'export et l'annulation avec un compte de démonstration.
5. Déployer `process-account-deletions`.
6. Tester une purge complète et vérifier Auth, tables, Storage et Trip partagé.
7. Configurer seulement ensuite l'appel planifié du processeur.
