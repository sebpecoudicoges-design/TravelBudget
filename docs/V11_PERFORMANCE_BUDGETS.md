# Budgets performance V11

Objectif : suivre la reduction du legacy avec des chiffres simples avant de supprimer du code historique.

## Mesure actuelle

Commande :

```bash
npm run perf:budget
```

La mesure lit `config/module-size-budgets.json`, additionne les fichiers par domaine et controle le bundle `dist` apres `npm run build`.

Snapshot `10.5.252` :

- Boot legacy : 877.8 / 1500 KiB.
- Inbox : 111.9 / 112 KiB.
- Dashboard + Settings : 351.6 / 360 KiB.
- Trip : 309.4 / 340 KiB.
- Sport : 430.2 / 450 KiB.
- Nutrition : 193.2 / 235 KiB.
- Travail : 57.1 / 90 KiB.
- Patrimoine : 117.8 / 125 KiB.
- Bundle Vite JS initial : 252.2 / 260 KiB.
- Bundle Vite JS lazy : 339.2 / 340 KiB.
- Bundle Vite JS total : 591.4 / 592 KiB.
- Bundle Vite CSS total : 7.8 / 8 KiB.
- JS principal gzip : 72.2 / 110 KiB.

## Budgets actuels

- Bundle Vite JS initial : 260 KiB maximum.
- Bundle Vite JS lazy : 340 KiB maximum.
- Bundle Vite JS total : 592 KiB maximum.
- Bundle Vite CSS total : 8 KiB maximum.
- JS principal gzip : 110 KiB maximum.
- Boot legacy : 1500 KiB maximum.
- Dashboard + Settings : 360 KiB maximum.
- Trip : 340 KiB maximum.
- Sport : 450 KiB maximum.
- Nutrition : 235 KiB maximum.
- Travail : 90 KiB maximum.
- Patrimoine : 125 KiB maximum.

Ces plafonds ne sont pas des objectifs finaux. Ils sont volontairement proches de l'existant pour detecter les regressions pendant le decoupage. Chaque extraction reussie doit permettre de baisser progressivement le budget du domaine concerne.

## Regle de suivi

Un lot qui ajoute du poids a un domaine doit expliquer pourquoi. Pour 10.5.252, la lecture, sauvegarde locale, upsert SQL et preparation des mesures impedancemetriques quittent `45_sport_ui.js` vers `sportBodyMeasurementController.js`, charge avec le sous-runtime profil. Le legacy Sport descend de 227.2 a 220.8 KiB. Le domaine Sport mesure completement monte de 427.3 a 430.2 KiB, car le code devient un module teste au lieu de rester dans le legacy public. Le JS initial reste a 252.2 KiB. Le budget Vite lazy est releve de 335 a 340 KiB et le total de 585 a 592 KiB pour accepter cette extraction qualite chargee a la demande. Un lot qui extrait une responsabilite vers `src` doit verifier que le budget reste vert, puis ajuster le plafond uniquement si le gain de qualite est explicite ou si le gain de poids est confirme par `npm run perf:budget`.
