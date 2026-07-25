# Budgets performance V11

Objectif : suivre la reduction du legacy avec des chiffres simples avant de supprimer du code historique.

## Mesure actuelle

Commande :

```bash
npm run perf:budget
```

La mesure lit `config/module-size-budgets.json`, additionne les fichiers par domaine et controle le bundle `dist` apres `npm run build`.

Snapshot `10.5.261` :

- Boot legacy : 878.5 / 1500 KiB.
- Inbox : 111.9 / 112 KiB.
- Dashboard + Settings : 352.5 / 360 KiB.
- Trip : 309.4 / 340 KiB.
- Sport : 441.1 / 450 KiB.
- Nutrition : 193.2 / 235 KiB.
- Travail : 57.1 / 90 KiB.
- Patrimoine : 117.8 / 125 KiB.
- Documents : 112.4 / 115 KiB.
- Bundle Vite JS initial : 254.7 / 260 KiB.
- Bundle Vite JS lazy : 357.7 / 360 KiB.
- Bundle Vite JS total : 612.4 / 615 KiB.
- Bundle Vite CSS total : 7.8 / 8 KiB.
- JS principal gzip : 73 / 110 KiB.

## Budgets actuels

- Bundle Vite JS initial : 260 KiB maximum.
- Bundle Vite JS lazy : 360 KiB maximum.
- Bundle Vite JS total : 615 KiB maximum.
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

Un lot qui ajoute du poids a un domaine doit expliquer pourquoi. Pour 10.5.260, le domaine Sport monte a 443.7 KiB car l'impedancemetre ajoute la modification des pesees recentes, le remplacement local/SQL et la prevention des doublons en cas de changement de date. Tous les budgets restent verts. Un lot qui extrait une responsabilite vers `src` doit verifier que le budget reste vert, puis ajuster le plafond uniquement si le gain de qualite est explicite ou si le gain de poids est confirme par `npm run perf:budget`.

En 10.5.261, le rendu du plan builder Sport est extrait vers `sportFormView.js`. Le legacy Sport baisse de 443.7 a 441.1 KiB, mais le poids Vite lazy monte de 354.7 a 357.7 KiB car ce rendu devient un module teste du runtime Sport. Le palier lazy/total est donc ajuste a 360/615 KiB, avec objectif de le rebaisser au prochain decoupage qui sortira un pan de runtime ou supprimera du template duplique.
