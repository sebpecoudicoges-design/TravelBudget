# TravelBudget - chantier Play Store

Objectif : passer de l'APK de test a une publication Google Play propre, sans perdre la tracabilite deja installee dans le projet.

Statut : **en attente de la campagne de stabilisation module par module ouverte en `10.5.316`**. Les acquis AAB et conformite sont conserves ; la soumission reprend apres validation des modules critiques.

## Etat actuel

- Version web courante : `10.5.349` ; dernier APK de test : `10.5.341` (aucun APK genere pour les lots web `10.5.342` a `10.5.349`).
- Package Android : `com.travelbudget.app`.
- Version Android derivee de `package.json`.
- APK de test `travelbudget-10.5.341-20260810-192605-debug.apk` publie via Supabase Storage ; SHA-256 `3CC0F8597939B3F47AD9F325AD21C0C5E9C5DC3319B4B408E26F023FCAEDE37D`.
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

- Creer ou confirmer le compte Google Play Developer.
- Creer l'application dans Play Console.
- Configurer Play App Signing.
- Generer une keystore release locale et renseigner les variables :
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
