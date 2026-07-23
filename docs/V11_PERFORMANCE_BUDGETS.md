# Budgets performance V11

Objectif : suivre la reduction du legacy avec des chiffres simples avant de supprimer du code historique.

## Mesure actuelle

Commande :

```bash
npm run perf:budget
```

La mesure lit `config/module-size-budgets.json`, additionne les fichiers par domaine et controle le bundle `dist` apres `npm run build`.

Snapshot `10.5.245` :

- Boot legacy : 877.8 / 1500 KiB.
- Inbox : 111.9 / 112 KiB.
- Dashboard + Settings : 351.6 / 360 KiB.
- Trip : 309.4 / 340 KiB.
- Sport : 420.8 / 450 KiB.
- Nutrition : 193.2 / 235 KiB.
- Travail : 57.1 / 90 KiB.
- Patrimoine : 117.8 / 125 KiB.
- Bundle Vite JS initial : 317.4 / 325 KiB.
- Bundle Vite JS lazy : 254.5 / 258 KiB.
- Bundle Vite JS total : 571.9 / 575 KiB.
- Bundle Vite CSS total : 7.8 / 8 KiB.
- JS principal gzip : 86.4 / 110 KiB.

## Budgets actuels

- Bundle Vite JS initial : 325 KiB maximum.
- Bundle Vite JS lazy : 258 KiB maximum.
- Bundle Vite JS total : 575 KiB maximum.
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

Un lot qui ajoute du poids a un domaine doit expliquer pourquoi. Pour 10.5.245, Sport gagne le controleur mobilite, l'analyse VMA et les tendances impedancemetriques : le JS initial reste stable a 317.4 KiB, le lazy monte a 254.5 KiB et le total a 571.9 KiB. Le plafond lazy/total est releve pour absorber cette fonctionnalite durable, tout en gardant Sport sous son budget domaine de 450 KiB. Un lot qui extrait une responsabilite vers `src` doit verifier que le budget reste vert, puis ajuster le plafond uniquement si le gain est confirme par `npm run perf:budget`.
