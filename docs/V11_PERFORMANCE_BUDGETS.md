# Budgets performance V11

Objectif : suivre la reduction du legacy avec des chiffres simples avant de supprimer du code historique.

## Mesure actuelle

Commande :

```bash
npm run perf:budget
```

La mesure lit `config/module-size-budgets.json`, additionne les fichiers par domaine et controle le bundle `dist` apres `npm run build`.

Snapshot `10.5.255` :

- Boot legacy : 877.8 / 1500 KiB.
- Inbox : 111.9 / 112 KiB.
- Dashboard + Settings : 351.8 / 360 KiB.
- Trip : 309.4 / 340 KiB.
- Sport : 434.7 / 450 KiB.
- Nutrition : 193.2 / 235 KiB.
- Travail : 57.1 / 90 KiB.
- Patrimoine : 117.8 / 125 KiB.
- Bundle Vite JS initial : 252.3 / 260 KiB.
- Bundle Vite JS lazy : 345.0 / 345 KiB.
- Bundle Vite JS total : 597.3 / 598 KiB.
- Bundle Vite CSS total : 7.8 / 8 KiB.
- JS principal gzip : 72.3 / 110 KiB.

## Budgets actuels

- Bundle Vite JS initial : 260 KiB maximum.
- Bundle Vite JS lazy : 345 KiB maximum.
- Bundle Vite JS total : 598 KiB maximum.
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

Un lot qui ajoute du poids a un domaine doit expliquer pourquoi. Pour 10.5.255, le legacy Sport baisse de 217.9 a 216.6 KiB en sortant l'estimation de completion vers `sportTimerController.js`, mais la mesure globale Sport monte a 434.7 KiB car le module teste porte maintenant cette responsabilite. Les plafonds restent verts : JS initial 252.3 KiB, lazy JS 345.0 KiB et total dist 597.3 KiB. Un lot qui extrait une responsabilite vers `src` doit verifier que le budget reste vert, puis ajuster le plafond uniquement si le gain de qualite est explicite ou si le gain de poids est confirme par `npm run perf:budget`.
