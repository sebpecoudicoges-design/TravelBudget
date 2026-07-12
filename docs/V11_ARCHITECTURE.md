# Architecture V11

Objectif : reduire le legacy sans casser l'application mobile. Le legacy reste le shell d'integration, mais les regles metier, stores, repositories et vues nouvelles doivent vivre dans `src`.

## Couches

- `src/core` : fonctions pures et testables. Aucun acces DOM, Supabase ou `localStorage`.
- `src/data` : repositories et stores locaux generiques. Les acces Supabase et les files locales y sont centralises.
- `src/features/<domaine>` : stores de domaine, vues pures, controleurs UI ou regles specialisees.
- `src/app/bridge.js` : expose les modules modernes aux fichiers legacy via `window.Core`, `window.Data` et `window.UI`.
- `public/legacy/js` : orchestration historique, compatibilite globale et integration progressive. On n'y ajoute plus de nouvelle regle metier.

## Domaines verrouilles

Les domaines suivants ont un contrat de separation :

- Nutrition : `nutritionRules`, `nutritionRepository`, `nutritionStore`, `nutritionView`.
- Travail : `workRules`, `workView`.
- Patrimoine : `assetRules`, `assetView`.
- Trip : `tripRules`, `tripRepository`, `tripStore`, `tripView`.
- Sport : `sportRules`, `sportLibraryRules`, `sportRepository`, `sportStore`, `sportCatalog`, programme, timer, historique, sandbox et profil.

Les contrats sont dans `tests/ui/*DomainContract.test.js`. Toute nouvelle extraction doit ajouter ou etendre un test avant suppression de code legacy.

## Chargement

`src/main.js` garde au demarrage le shell global, Dashboard et Settings. Les domaines lourds sont charges a l'ouverture via `window.tbLoadLegacyDomain(domain)` :

- `nutrition` : `48_nutrition_ui.js`
- `work` : `47_work_ui.js`, `50_work_career_ui.js`
- `trip` : `29_trip_v1.js`, `30_members_admin.js`
- `sport` : `45_sport_ui.js`
- `assets`, `documents`, `cautions`, `notifications`, `help`

Le contrat est dans `tests/ui/legacyDomainLoader.test.js`.

## Procedure de migration

1. Identifier la responsabilite a sortir du legacy : regle, data, store, vue ou controleur.
2. Creer ou etendre le module dans `src`.
3. Ajouter un test cible sur le module et, si besoin, un contrat UI.
4. Faire deleguer le legacy vers `window.Core`, `window.Data` ou `window.UI`.
5. Verifier `npm test`, `npm run build`, APK Android et hash public/local.
6. Mettre a jour `docs/V11_REFACTOR_CHECKLIST.md`, `public/projet.html`, la version et pousser Git.

## Regles de garde

- Une seule source de verite par calcul, format de donnee ou synchronisation.
- Pas de nouvelle logique metier dans `public/legacy/js`.
- Pas de suppression legacy sans remplacement teste.
- Les changements SQL/Supabase doivent etre verifies et documentes.
- Les parcours mobiles critiques doivent rester fonctionnels pendant toute migration.
