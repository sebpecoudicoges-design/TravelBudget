# Budgets performance V11

Objectif : suivre la reduction du legacy avec des chiffres simples avant de supprimer du code historique.

## Mesure actuelle

Commande :

```bash
npm run perf:budget
```

La mesure lit `config/module-size-budgets.json`, additionne les fichiers par domaine et controle le bundle `dist` apres `npm run build`.

Snapshot `10.5.230` :

- Boot legacy : 877.1 / 1500 KiB.
- Dashboard + Settings : 351.6 / 360 KiB.
- Trip : 299.0 / 340 KiB.
- Sport : 355.5 / 450 KiB.
- Nutrition : 193.2 / 235 KiB.
- Travail : 57.1 / 90 KiB.
- Patrimoine : 113.7 / 125 KiB.
- Bundle Vite JS initial : 362.5 / 370 KiB.
- Bundle Vite JS lazy : 121.4 / 125 KiB.
- Bundle Vite JS total : 484.0 / 485 KiB.
- Bundle Vite CSS total : 5.0 / 8 KiB.
- JS principal gzip : 99.8 / 110 KiB.

## Budgets actuels

- Bundle Vite JS initial : 370 KiB maximum.
- Bundle Vite JS lazy : 125 KiB maximum.
- Bundle Vite JS total : 485 KiB maximum.
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

Un lot qui ajoute du poids a un domaine doit expliquer pourquoi. Un lot qui extrait une responsabilite vers `src` doit verifier que le budget reste vert, puis ajuster le plafond uniquement si le gain est confirme par `npm run perf:budget`.
