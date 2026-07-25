# Budgets performance V11

Objectif : suivre la reduction du legacy avec des chiffres simples avant de supprimer du code historique.

## Mesure actuelle

Commande :

```bash
npm run perf:budget
```

La mesure lit `config/module-size-budgets.json`, additionne les fichiers par domaine et controle le bundle `dist` apres `npm run build`.

Snapshot `10.5.258` :

- Boot legacy : 878.5 / 1500 KiB.
- Inbox : 111.9 / 112 KiB.
- Dashboard + Settings : 352.5 / 360 KiB.
- Trip : 309.4 / 340 KiB.
- Sport : 434.7 / 450 KiB.
- Nutrition : 193.2 / 235 KiB.
- Travail : 57.1 / 90 KiB.
- Patrimoine : 117.8 / 125 KiB.
- Documents : 112.4 / 115 KiB.
- Bundle Vite JS initial : 252.5 / 260 KiB.
- Bundle Vite JS lazy : 348.7 / 350 KiB.
- Bundle Vite JS total : 601.2 / 605 KiB.
- Bundle Vite CSS total : 7.8 / 8 KiB.
- JS principal gzip : 72.3 / 110 KiB.

## Budgets actuels

- Bundle Vite JS initial : 260 KiB maximum.
- Bundle Vite JS lazy : 350 KiB maximum.
- Bundle Vite JS total : 605 KiB maximum.
- Bundle Vite CSS total : 8 KiB maximum.
- JS principal gzip : 110 KiB maximum.
- Boot legacy : 1500 KiB maximum.
- Dashboard + Settings : 360 KiB maximum.
- Trip : 340 KiB maximum.
- Sport : 450 KiB maximum.
- Nutrition : 235 KiB maximum.
- Travail : 90 KiB maximum.
- Patrimoine : 125 KiB maximum.
- Documents : 115 KiB maximum.

Ces plafonds ne sont pas des objectifs finaux. Ils sont volontairement proches de l'existant pour detecter les regressions pendant le decoupage. Chaque extraction reussie doit permettre de baisser progressivement le budget du domaine concerne.

## Regle de suivi

Un lot qui ajoute du poids a un domaine doit expliquer pourquoi. Pour 10.5.258, la preparation des transactions recentes wallet quitte `12_dashboard_render.js` vers `dashboardView.js` : le boot legacy descend de 881.2 a 878.5 KiB, tandis que Dashboard + Settings monte legerement a 352.5 KiB car la logique devient testee dans le module deja charge avec Dashboard. Un lot qui extrait une responsabilite vers `src` doit verifier que le budget reste vert, puis ajuster le plafond uniquement si le gain de qualite est explicite ou si le gain de poids est confirme par `npm run perf:budget`.
