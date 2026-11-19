# TravelBudget - chantier Play Store

Objectif : passer de l'APK de test a une publication Google Play propre, sans perdre la tracabilite deja installee dans le projet.

Statut : **préparation du test fermé reprise le 17 novembre 2026 à la demande de l'utilisateur**. Aucun test fermé TravelBudget lancé à ce stade.

Le 20 novembre, l'utilisateur demande de conserver cette préparation et de reprendre la publication après l'audit, l'amélioration visuelle et le chantier des publicités réelles. Voir [l'ordre du backlog](BACKLOG.md#ordre-demandé-le-20-novembre-2026). Les observations de console ci-dessous sont datées, sans nouvelle vérification distante le 20 novembre.

## Reprise du 17 novembre 2026

- Fiche boutique : descriptions française courte et complète enregistrées en brouillon, confirmation relue dans Play Console. Les visuels restent à fournir. Support public : `seb.pecoud.icoges@gmail.com`. Configuration précédemment constatée à 10/11.
- Identité Android préparée localement : release `fr.pecloud.travelbudget`, debug `com.travelbudget.app` conservé pour les mises à jour des installations existantes. Le namespace Java reste inchangé. Le JSON Firebase local contient les deux clients ; il reste exclu de Git.
- Retour OAuth choisi avec l'identifiant réellement installé (`App.getInfo`) et validé exactement avant échange de session. Les liens étrangers ou malformés ne ferment pas le navigateur ; les codes de connexion ne sont plus inclus dans le contexte de journalisation.
- Validation locale : 18 tests ciblés OAuth, transitions de connexion et contrat Android réussis. Gradle `processDebugMainManifest`, `processReleaseMainManifest`, `processDebugGoogleServices` et `processReleaseGoogleServices` réussis. Cette validation des manifestes et des clients Firebase est distincte de la production d'un AAB signé. Atlas régénéré et contrat documentaire validé.
- Restent avant soumission : autoriser et vérifier le nouveau retour OAuth dans Supabase, finaliser les visuels, préparer la clé d'envoi et l'AAB signé, relire les déclarations, configurer France et la piste fermée. Aucun nouveau bundle envoyé. La clé de signature gérée par Play n'a pas été modifiée.
- Les 12 testeurs restent à recruter par l'utilisateur. Aucun délai de test n'a commencé.

## Vérification du compte le 14 novembre 2026

- Compte personnel Pecloud accessible. Deux fiches distinctes existent : BudgetPacker (`com.travelbudget.app`) et TravelBudget (`fr.pecloud.travelbudget`). L'utilisateur choisit explicitement **la nouvelle fiche TravelBudget**.
- TravelBudget est en brouillon, configuration 9/11 : restent catégorie/coordonnées et fiche boutique. Les déclarations sont marquées terminées, mais leur contenu doit être relu avec les traitements actuels avant soumission.
- Zéro testeur inscrit ; l'utilisateur doit encore les recruter. La console exige au moins 12 inscrits pendant 14 jours continus.
- Play App Signing est déjà indiqué actif. L'utilisateur ne dispose pas de clé d'envoi ; vérifier le certificat enregistré avant de créer ou remplacer une clé.
- L'application Firebase `TravelBudget Play` / `fr.pecloud.travelbudget` a été enregistrée dans le projet existant `travelbudget-9f39c`, et le JSON téléchargé puis relu localement. Le code Android utilise encore `com.travelbudget.app`. Préparer le nouveau package et le retour OAuth avant de soumettre un AAB. La nouvelle installation ne reprend pas automatiquement les données uniquement locales de l'ancienne application.
- L'utilisateur choisit la France pour le test fermé et autorise `seb.pecoud.icoges@gmail.com` comme adresse publique de support.
- AdMob : consentement européen publié, paiement complet, validation du compte en cours et association boutique restante.

### Parcours proposé aux testeurs

Recruter idéalement 15 à 20 personnes Android pour garder au moins 12 inscriptions continues. Recueillir leur compte Google utilisé dans le Play Store, les ajouter au groupe autorisé puis partager le lien d'adhésion fourni par la piste fermée. L'ajout d'une adresse ne vaut pas adhésion. Le test commence après publication de la version et inscription effective des testeurs.

Scénario : installer via Play, se connecter, créer un voyage de démonstration et un wallet, ajouter/modifier une dépense, vérifier budget et analyse, tester une dépense partagée et son remboursement, consulter Sport/Nutrition/Documents avec des données fictives, puis tester réseau faible et retour du mode avion. Ne pas cliquer les annonces pour les tester. Relever version, appareil, étapes, résultat attendu/observé et date dans le suivi des retours. Ne pas inclure de données personnelles dans les captures partagées.

Conserver les retours réels et corrections durant la campagne ; la fin des 14 jours permet de demander l'accès production, elle ne garantit pas son approbation. Aucun message de recrutement envoyé par l'assistant.

## Etat actuel

- Version locale : `10.5.392`, avec Capacitor Android `8.5.3`. Correctif réseau lent : [suivi 10.5.392](ANDROID_10_5_392.md).
- APK distribué : `com.travelbudget.app` ; préparation locale Play : `fr.pecloud.travelbudget`.
- Version Android derivee de `package.json`.
- Historique sécurité : APK de test `travelbudget-10.5.373-20261010-092634-debug.apk` publié via Supabase Storage ; SHA-256 `68BC3312976FAB4565B18A1D35700C6487BC7B4B331D949DA63B114690F0C6AA`. Signature et relecture distante vérifiées ; validation téléphone restante. Voir [le lot sécurité Android](ANDROID_SECURITY_10_5_373.md).
- Workflow AAB disponible :
  - `npm run android:bundle-check`
  - `npm run android:bundle-release`
- AAB de controle `10.5.315` produit localement :
  - `public/downloads/travelbudget-10.5.315-20260801-163803-release.aab`
  - taille : `5 135 841` octets ;
  - SHA-256 : `1F27C146A4D4382D7E588D9EDC4087FFCFAFD6FBF5A38E7C44E216A5283ED4EA`.
- Liens publics verifies par `npm run links:check`.
- Politique de confidentialite FR/EN disponible dans `public/privacy.html`.
- Demande de suppression de compte documentee et preparee cote app.

## Regle de travail conservee

A chaque intervention sur un fichier ou domaine :

- chercher le code mort directement lie au perimetre touche ;
- verifier les appels avec une recherche globale ;
- supprimer uniquement si le remplacement est valide ;
- ajouter ou maintenir un test de contrat anti-retour quand le risque existe.

Cette regle remplace le chantier 6 comme garde permanente.

## Bloquants avant soumission Play Store

- Compte et fiche TravelBudget confirmés ; finaliser les éléments visuels de la fiche boutique.
- Vérifier le certificat d'envoi existant et retrouver la clé ou suivre la procédure de réinitialisation si nécessaire.
- Configurer une keystore release locale appropriée et renseigner les variables :
  - `TB_ANDROID_KEYSTORE_PATH`
  - `TB_ANDROID_KEYSTORE_PASSWORD`
  - `TB_ANDROID_KEY_ALIAS`
  - `TB_ANDROID_KEY_PASSWORD`
- Produire l'AAB signe avec `npm run android:bundle-release`.
- Completer Data safety avec les donnees exactes traitees par l'app.
- Declarer correctement les usages sante / sport / nutrition si Play Console les demande.
- Ajouter icone, feature graphic, captures telephone et textes de fiche.
- Tester la suppression de compte sur un compte demo.
- Faire relire la confidentialite et les textes de fiche.

## Test ferme

Pour un compte developpeur personnel recent, Google Play demande un test ferme avec au moins 12 testeurs opt-in pendant 14 jours continus avant l'acces production.

Source officielle : https://support.google.com/googleplay/android-developer/answer/14151465

Plan recommande :

- inviter 15 a 20 testeurs Android pour absorber les abandons ;
- preparer un scenario de test court : ouverture, connexion, Dashboard, Transactions, Analyse, Trip, Sport, Alimentation, Documents ;
- centraliser les retours dans `docs/ADMIN_TEST_RETURNS.md` ;
- corriger les anomalies bloquantes avant demande de production.

## Definition of done du chantier Play Store

- AAB release signe produit et verifie.
- Fiche Play Store complete.
- Data safety rempli depuis les traitements reels.
- Politique de confidentialite publique et liee.
- Suppression de compte testee.
- Test ferme termine avec retours consolides.
- Production access demande puis obtenu.
- URL Play Store ajoutee a `public/projet.html`.

Pointage et sélection Transactions : voir [lot 10.5.387](WALLET_JOURNAL_10_5_386.md).

Pointage groupé : voir [lot 10.5.387](WALLET_BULK_RECONCILIATION_10_5_387.md). Vérifier les filtres et une interruption réseau sur téléphone.
