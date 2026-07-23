# Budgets performance V11

Objectif : suivre la reduction du legacy avec des chiffres simples avant de supprimer du code historique.

## Mesure actuelle

Commande :

```bash
npm run perf:budget
```

La mesure lit `config/module-size-budgets.json`, additionne les fichiers par domaine et controle le bundle `dist` apres `npm run build`.

Snapshot `10.5.251` :

- Boot legacy : 877.8 / 1500 KiB.
- Inbox : 111.9 / 112 KiB.
- Dashboard + Settings : 351.6 / 360 KiB.
- Trip : 309.4 / 340 KiB.
- Sport : 427.3 / 450 KiB.
- Nutrition : 193.2 / 235 KiB.
- Travail : 57.1 / 90 KiB.
- Patrimoine : 117.8 / 125 KiB.
- Bundle Vite JS initial : 252.2 / 260 KiB.
- Bundle Vite JS lazy : 332.0 / 335 KiB.
- Bundle Vite JS total : 584.2 / 585 KiB.
- Bundle Vite CSS total : 7.8 / 8 KiB.
- JS principal gzip : 72.2 / 110 KiB.

## Budgets actuels

- Bundle Vite JS initial : 260 KiB maximum.
- Bundle Vite JS lazy : 335 KiB maximum.
- Bundle Vite JS total : 585 KiB maximum.
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

Un lot qui ajoute du poids a un domaine doit expliquer pourquoi. Pour 10.5.251, le profil Sport est fractionne en sous-runtime : `sportProfileRules.js`, `sportProfileView.js` et `sportMobilityController.js` chargent apres l'ouverture de Sport, pendant que timer, programme, historique et catalogue restent disponibles. Le chunk `sportRuntime` descend a 91.6 KiB, le JS initial reste a 252.2 KiB et le main gzip reste a 72.2 KiB. Le lazy total monte tres legerement a 332.0 KiB a cause des chunks separes, toujours sous budget. Un lot qui extrait une responsabilite vers `src` doit verifier que le budget reste vert, puis ajuster le plafond uniquement si le gain de qualite est explicite ou si le gain de poids est confirme par `npm run perf:budget`.
