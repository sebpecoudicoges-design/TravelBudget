# Budgets performance V11

Objectif : suivre la reduction du legacy avec des chiffres simples avant de supprimer du code historique.

## Mesure actuelle

Commande :

```bash
npm run perf:budget
```

La mesure lit `config/module-size-budgets.json`, additionne les fichiers par domaine et controle le bundle `dist` apres `npm run build`.

Snapshot `10.5.279` :

- Boot legacy : 875.8 / 1500 KiB.
- Analyse : 159.7 / 160 KiB.
- Inbox : 110.5 / 112 KiB.
- Dashboard + Settings : 354.7 / 360 KiB.
- Trip : 309.4 / 340 KiB.
- Sport : 441.1 / 450 KiB.
- Nutrition : 187.0 / 235 KiB.
- Travail : 57.1 / 90 KiB.
- Patrimoine : 117.8 / 125 KiB.
- Documents : 107.8 / 115 KiB.
- Bundle Vite JS initial : 243.2 / 260 KiB.
- Bundle Vite JS lazy : 375.6 / 380 KiB.
- Bundle Vite JS total : 618.9 / 620 KiB.
- Bundle Vite CSS total : 7.8 / 8 KiB.
- JS principal gzip : 69.8 / 110 KiB.

## Budgets actuels

- Bundle Vite JS initial : 260 KiB maximum.
- Bundle Vite JS lazy : 380 KiB maximum.
- Bundle Vite JS total : 620 KiB maximum.
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

Le flux local de gestion du compte ajoute ensuite l'export complet, la demande et l'annulation de suppression, ainsi que leur etat dans Settings. Le bundle total passe a 617 KiB et le plafond total a 620 KiB. Le plafond initial reste a 260 KiB : le prochain chantier Settings devra deplacer la gestion de compte hors du chargement initial pour recuperer de la marge.

En 10.5.263, `settingsAccountController.js` quitte le bundle initial et charge via `TBLoadSettingsAccountController` lorsque le panneau Compte est rendu. Le JS initial baisse de 259.3 a 242.6 KiB et le JS principal gzip de 74.6 a 69.5 KiB. Le lazy monte a 374.5 KiB car le controleur devient un chunk separe ; le plafond lazy passe donc a 380 KiB en gardant le total a 620 KiB. Prochain axe : reduire `dashboard-settings` et fractionner un chunk lazy existant pour rebaisser ce plafond.

En 10.5.264, Analyse extrait la meta du graphique trajectoire vers `analysisView.js`. Le domaine Analyse atteint 160.0 / 160 KiB et le lazy passe a 374.7 KiB. Aucun plafond n'est augmente : le prochain lot Analyse doit supprimer du legacy ou deplacer un bloc vers un sous-module dedie avant toute nouvelle fonctionnalite.

En 10.5.265, les styles des modales Wallet Dashboard quittent `12_dashboard_render.js` vers `dashboardView.js`. Le boot legacy baisse de 878.8 a 877.5 KiB sans modifier les plafonds. Les modales restent injectees a la demande par `tbEnsureWalletDlgStyles`. Le total Vite monte a 618.7 / 620 KiB car `dashboardView.js` est dans le bundle initial : le prochain lot Dashboard devra supprimer du legacy mort ou fractionner une vue avant de deplacer d'autres blocs.

En 10.5.266, les wrappers morts Wallet Dashboard `tbEscHTML`, `tbInferWalletTypeFromName` et `tbWalletTypeLabel` sont supprimes du legacy. La correction de types appelle directement `dashboardWalletRules.js`. Boot legacy : 877.5 -> 877.1 KiB ; Dashboard + Settings : 359.1 -> 358.7 KiB. Les plafonds restent inchanges.

En 10.5.267, l'etat de pagination du budget journalier Dashboard quitte `12_dashboard_render.js` vers `dashboardDailyBudgetState.js`, charge a la demande. Le boot legacy passe a 877.0 KiB et Dashboard + Settings a 358.6 KiB, tout en sortant les helpers `_db*` du fichier historique. Le total JS atteint 620.0 / 620 KiB : le prochain lot devra d'abord supprimer ou fractionner avant tout nouveau module.

En 10.5.268, le meme module `dashboardDailyBudgetState.js` est compacte : les adaptateurs de date inutiles quittent le legacy et le module lazy. Boot legacy : 876.8 KiB ; Dashboard + Settings : 358.5 KiB ; total JS : 619.9 / 620 KiB. La marge redevient positive, mais reste minimale.

En 10.5.269, les doublons legacy `_norm`/`_normKey` dans Analyse et `todayISO` dans Inbox sont supprimes, puis l'etat lazy du budget journalier Dashboard est raccourci. Analyse baisse a 159.7 KiB, Inbox a 111.8 KiB, le lazy descend a 375.6 KiB et le total JS a 619.8 / 620 KiB.

En 10.5.270, des fallbacks legacy morts sont supprimes dans Inbox et Nutrition : helpers budget locaux Inbox et anciens panneaux Nutrition non appeles. Inbox baisse a 110.5 KiB et Nutrition a 187.5 KiB. Le bundle Vite reste stable a 619.8 / 620 KiB, ce qui recupere de la marge source sans changer le comportement utilisateur.

En 10.5.271, les anciennes actions batch Documents basees sur `prompt` sont supprimees : elles etaient ecrasees par les modales actuelles partager/deplacer/taguer. Documents baisse de 112.4 a 107.8 KiB, avec un contrat anti-retour qui impose une seule definition par action batch.

En 10.5.272, le panneau d'aide contextuelle Dashboard, devenu inatteignable, est retire du legacy et de `dashboardView.js`. Les helpers `tbUxDismiss` restent conserves pour Transactions et Trip. Dashboard + Settings baisse a 356.5 KiB, le JS initial a 243.2 KiB et le JS total a 618.9 / 620 KiB.

En 10.5.273, les anciens helpers Dashboard `tbMoveDashboardHeroToTop` et `tbMountExistingKpisIntoHero`, sans appel dans le projet, sont supprimes. Le DOM Dashboard garde sa structure fixe, Dashboard + Settings descend a 354.7 KiB et le boot legacy a 874.2 KiB.

En 10.5.274, l'ancien alias `window.renderHealth` et son wrapper Nutrition sont supprimes. La navigation `health` continue de rediriger vers Alimentation, mais Nutrition ne conserve plus ce point d'entree legacy. Nutrition baisse de 187.5 a 187.2 KiB.

En 10.5.275, les exports globaux Nutrition `tbSaveHealthGoal` et `tbHealthGoalTargets`, devenus sans appel, sont retires. `tbLoadHealthGoal` reste conserve pour les KPI. Nutrition baisse de 187.2 a 187.0 KiB.

En 10.5.276, le chantier Play Store ajoute `npm run links:check`. Ce controle verifie automatiquement les liens publics de `public/projet.html` et `public/privacy.html`, dont l'APK Supabase, les ancres de confidentialite et les liens locaux. Aucun bundle applicatif n'est alourdi.

En 10.5.277, le chantier Play Store ajoute le workflow AAB de production. `android:bundle-check` genere un bundle de controle local, `android:bundle-release` exige une keystore via variables d'environnement et verifie la signature avec `jarsigner`. Le changement touche Gradle et les scripts de livraison, sans alourdir le bundle web.

En 10.5.278, le chantier V11 reprend le boot initial : l'ecran de chargement affiche la version TB, une progression par phases et un passage a 100% avant disparition. Le boot legacy remonte a 878.5 KiB a cause du HTML/CSS/JS du loader, mais le budget reste tres large face au plafond de 1500 KiB. Le CSS dist reste proche du plafond a 7.8 / 8 KiB : le prochain lot visuel devra donc supprimer ou deplacer du style avant d'en ajouter.

En 10.5.279, le fallback du loader initial est compacte : le design complet reste dans `index.html`, tandis que `20_boot.js` ne garde qu'un style minimal de secours si le bloc doit etre recree. Boot legacy : 878.5 -> 875.8 KiB. L'UX normale du premier ecran ne change pas, et le contrat verifie que le CSS futuriste n'est plus duplique dans le legacy.
