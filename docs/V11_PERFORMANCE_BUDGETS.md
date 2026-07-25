# Budgets performance V11

Objectif : suivre la reduction du legacy avec des chiffres simples avant de supprimer du code historique.

## Mesure actuelle

Commande :

```bash
npm run perf:budget
```

La mesure lit `config/module-size-budgets.json`, additionne les fichiers par domaine et controle le bundle `dist` apres `npm run build`.

Snapshot `10.5.256` :

- Boot legacy : 877.8 / 1500 KiB.
- Inbox : 111.9 / 112 KiB.
- Dashboard + Settings : 351.8 / 360 KiB.
- Trip : 309.4 / 340 KiB.
- Sport : 434.7 / 450 KiB.
- Nutrition : 193.2 / 235 KiB.
- Travail : 57.1 / 90 KiB.
- Patrimoine : 117.8 / 125 KiB.
- Documents : 111.3 / 115 KiB.
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

Un lot qui ajoute du poids a un domaine doit expliquer pourquoi. Pour 10.5.256, le legacy Documents baisse de 101.5 a 98.2 KiB en sortant la carte document vers `documentView.js`. Le build ajoute un chunk lazy dedie de 3.86 KiB, charge seulement avec le domaine Documents. Le plafond lazy passe de 345 a 350 KiB et le total JS de 598 a 605 KiB pour accepter cette extraction testee. Un lot qui extrait une responsabilite vers `src` doit verifier que le budget reste vert, puis ajuster le plafond uniquement si le gain de qualite est explicite ou si le gain de poids est confirme par `npm run perf:budget`.
