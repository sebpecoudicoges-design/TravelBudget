# Budgets performance V11

Objectif : suivre la reduction du legacy avec des chiffres simples avant de supprimer du code historique.

## Mesure actuelle

Commande :

```bash
npm run perf:budget
```

La mesure lit `config/module-size-budgets.json`, additionne les fichiers par domaine et controle le bundle `dist` apres `npm run build`.

Snapshot `10.5.315` :

- Boot legacy : 871.3 / 1500 KiB.
- Analyse : 159.0 / 160 KiB.
- Inbox : 110.5 / 112 KiB.
- Dashboard + Settings : 363.3 / 365 KiB.
- Trip : 317.9 / 340 KiB.
- Sport : 439.9 / 450 KiB.
- Nutrition : 187.0 / 235 KiB.
- Travail : 57.1 / 90 KiB.
- Assets : 117.8 / 125 KiB.
- Documents : 111.8 / 115 KiB.
- Initial JS : 254.3 / 260 KiB.
- Lazy JS : 397.3 / 400 KiB.
- JS total : 651.6 / 655 KiB.
- CSS total : 22.2 / 23 KiB.
- Main JS gzip : 72.2 / 110 KiB.

## Budgets actuels

- Bundle Vite JS initial : 260 KiB maximum.
- Bundle Vite JS lazy : 400 KiB maximum.
- Bundle Vite JS total : 655 KiB maximum.
- Bundle Vite CSS total : 23 KiB maximum.
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

En 10.5.293, l'ancien fallback `23_cashflow_chart.js` est supprime du depot. Il n'etait plus reference par `src/main.js`, les budgets, les tests ou les docs, et le cashflow actuel reste porte par `27_cashflow_curve.js` charge a la demande. Retrait : 115 lignes, 4.0 KiB source ; fichiers legacy : 59 -> 58 ; legacy total restant : 2069.3 KiB. La meme livraison ajoute les entrees Trip partagees sans nouveau fichier legacy : type `expense/income`, source externe ou participant, option `non du` pour ne pas modifier les balances. Le bundle initial mesure 249.7 KiB et reste sous plafond ; le plafond total distribue passe de 645 a 650 KiB pour absorber ce cas metier tout en conservant les budgets par domaine.

En 10.5.294, le formulaire Trip d'entree partagee gagne la bascule UX complete : champs revenu masques en mode depense, libelle `Recu par`, bouton `Ajouter entree` et textes d'aide wallet adaptes. Trip passe de 315.9 a 317.7 KiB et le total JS de 646.8 a 647.2 KiB ; les plafonds restent inchanges.

En 10.5.295, les actions wallet Dashboard quittent les `onclick` inline des cartes pour passer par des hooks `data-*` et une delegation d'evenements testee. Le lot augmente legerement la source Dashboard + Settings de 354.7 a 356.2 KiB et le JS initial de 250.0 a 250.3 KiB, mais garde tous les plafonds verts et prepare une extraction plus propre des handlers Dashboard.

En 10.5.296, les actions d'onboarding Dashboard quittent a leur tour les `onclick` inline. Guide, Masquer, Reglages, Aide, Creation wallet et Ajout transaction passent par un routeur delegue unique et des hooks `data-*`. Le lot ajoute un peu de code de routage, Dashboard + Settings passe de 356.2 a 357.1 KiB et le JS initial de 250.3 a 250.4 KiB, tous plafonds verts.

En 10.5.297, le FX manuel Settings retire le `prompt()` navigateur pour ajouter une devise. Le panneau integre un champ ISO3, une validation avec notice utilisateur et conserve les actions Ajouter/Modifier/Supprimer. Dashboard + Settings passe de 357.1 a 357.6 KiB ; le JS initial reste a 250.4 KiB et tous les plafonds restent verts.

En 10.5.298, les actions de l'overview Voyage Settings quittent les `onclick` inline pour des hooks `data-settings-action` et une delegation testee. Nouveau voyage, Supprimer voyage et Ajouter periode restent exposes via les fonctions existantes. Dashboard + Settings passe de 357.6 a 358.1 KiB et le JS initial de 250.4 a 250.8 KiB ; tous les plafonds restent verts, mais ce domaine doit etre reduit au prochain lot.

En 10.5.299, le fallback HTML statique Settings Voyage s'aligne sur les memes hooks `data-settings-action`, y compris Enregistrer le voyage, et le dernier selecteur `button[onclick*="saveSettings"]` est retire. Boot legacy baisse de 869.8 a 869.5 KiB et Dashboard + Settings de 358.1 a 357.8 KiB. Le JS initial reste a 250.8 KiB.

En 10.5.300, l'export global mort `window.deleteActivePeriod` est retire. La suppression de periode reste portee par les cartes periode et leur garde testee. Boot legacy baisse de 869.5 a 869.4 KiB et Dashboard + Settings de 357.8 a 357.7 KiB.

En 10.5.301, l'export debug Documents `window.tbDocumentsRenderOnly` est retire. Le rendu Documents reste porte par `renderDocuments/ensureLoaded` et les contrats Documents couvrent le non-retour. Documents baisse de 113.1 a 113.0 KiB ; les autres budgets restent stables.

En 10.5.302, l'IIFE d'initialisation Settings perd son nom interne `_tbSettingsInit`, jamais appele ni reference. Le hook `tb:afterLoad` reste identique ; les budgets restent stables a l'arrondi : boot legacy 869.4 KiB et Dashboard + Settings 357.7 KiB.

En 10.5.303, les sept helpers theme Analyse sont remplaces par un lookup unique `_theme(name)` avec les memes variables CSS et fallbacks. Analyse baisse de 159.4 a 159.0 KiB, ce qui recupere de la marge sous le plafond 160 KiB.

En 10.5.304, les appels repetes au loader `TBLoadDashboardWalletRules` sont factorises dans `_loadDashboardWalletRules()`. Les dialogues creation/edition, correction de type, archivage et suppression gardent le meme comportement, avec un seul point de chargement teste. Dashboard + Settings baisse de 357.7 a 357.3 KiB et le boot legacy de 869.4 a 869.1 KiB.

En 10.5.305, la detection de langue Analyse est centralisee dans `_analysisIsEnglish()`. Les rendus progression et insights ne recopient plus l'expression `tbGetLang`, avec un contrat anti-retour. Les budgets restent verts : Analyse 159.0 / 160 KiB, boot legacy 869.1 / 1500 KiB et JS total 648.0 / 650 KiB.

En 10.5.306, la detection de langue Settings est centralisee dans `_tbSettingsIsEnglish()`, `_tbSettingsLang()` et `_tbSettingsTxt()`. Les blocs Voyage, Periodes et Reference budget ne recopient plus `tbGetLang`. `14_settings_periods_ui.js` descend a 117.02 KiB ; Dashboard + Settings mesure 357.0 / 360 KiB, boot legacy 868.7 / 1500 KiB et JS total 648.0 / 650 KiB.

En 10.5.307, le systeme visuel premium V1 devient officiel : `VISUAL_SYSTEM.md`, `AGENTS.md`, theme partage, navigation groupee, Dashboard et KPI modernises. Les fonctionnalites conservees sont explicites : wallets detailles, archiver/desarchiver, budget journalier semaine, projection et convertisseur. Les plafonds evoluent pour integrer cette base visuelle : Dashboard + Settings 364.1 / 365 KiB, JS total 651.3 / 655 KiB et CSS total 21.0 / 22 KiB.

En 10.5.308, le chantier 6 ajoute la checklist de refonte visuelle par lots et corrige le formulaire Trip depense/entree. Les champs `Source entree` et `Balance Trip` sont forces caches en mode depense partagee, y compris lorsque les regles mobile imposent des grilles. Trip mesure 317.9 / 340 KiB et le JS total 651.4 / 655 KiB.

En 10.5.309, le rendu onboarding Dashboard retire ses styles inline lourds au profit de classes premium courtes dans `premium-theme.css`. Les actions existantes restent portees par `data-dashboard-action`. Dashboard + Settings baisse de 363.5 a 363.3 / 365 KiB, l'initial JS de 253.5 a 253.3 / 260 KiB, et le CSS reste juste dans le plafond a 22.0 / 22 KiB.

En 10.5.310, le panneau d'aide Transactions quitte le HTML inline legacy vers `transactionView.js`. Les actions Aide/Masquer passent par des hooks `data-tx-*`, sans `onclick` inline. Boot legacy baisse de 872.0 a 871.3 KiB ; l'initial JS passe de 253.3 a 254.3 / 260 KiB car la vue est exposee par le bridge Vite. Le CSS reste stable a 22.0 / 22 KiB et tous les budgets restent verts.

En 10.5.311, le style premium des boutons Archiver wallet retire `margin-top:auto` sur `.tb-wallet-archive-btn`. Les boutons restent dans la colonne d'actions de leur carte wallet, sans ligne blanche separee entre les cartes. Les budgets restent identiques cote JS ; le CSS dist baisse legerement a 21.9 / 22 KiB.

En 10.5.312, le panneau filtres principal de Transactions retire son style inline de `index.html`. Le rendu premium est porte par `.tx-workspace-card` dans `premium-theme.css`, tandis que les champs et hooks existants (`f-from`, `f-wallet`, `f-category`, `f-q`, etc.) restent inchanges. Les budgets restent verts : boot legacy 871.3 / 1500 KiB, Dashboard + Settings 363.3 / 365 KiB, Initial JS 254.3 / 260 KiB, JS total 651.6 / 655 KiB et CSS total 21.9 / 22 KiB.

En 10.5.313, le champ Recherche des filtres Transactions quitte l'attribut `style="min-width:220px"` et le layout s'appuie sur la classe explicite `.tx-filter-search`, y compris en rendu mobile Capacitor. Les IDs et hooks restent inchanges. Le plafond CSS passe de 22 a 23 KiB pour absorber la base premium mesuree a 22.2 KiB, avec surveillance maintenue.

En 10.5.314, les derniers fallbacks HTML Documents pour shell, dossiers, cartes, apercu, infos, partage, batch, transactions et assets passent par le helper unique `docView(...)`. Le legacy ne porte plus de templates concurrents pour ces rendus extraits ; `43_documents_ui.js` passe de 75.28 a 74.09 KiB et le domaine Documents reste vert a 111.8 / 115 KiB.

En 10.5.315, le chantier 6 est clos : la recherche de code mort devient une regle permanente dans `AGENTS.md` et la checklist V11. Aucun nouveau code runtime n'est ajoute par ce lot ; le prochain chantier officiel devient la preparation Play Store avec `docs/PLAY_STORE_READINESS.md` et un AAB de controle produit localement par `npm run android:bundle-check`.

En 10.5.316, la campagne de stabilisation ajoute un domaine `testing` charge a la demande : garde centrale des modules, scenarios Supabase, resultats OK/Pas OK, notes et cloture par module. Le bundle initial reste sous son plafond a environ 255.5 / 260 KiB. Le nouveau chunk lazy mesure environ 12.4 KiB ; les plafonds lazy, JS total et CSS passent respectivement a 415, 670 et 28 KiB, avec un budget source dedie `testing-domain` de 35 KiB pour isoler toute regression future de ce chantier.

En 10.5.317, le chantier 1 Dashboard ajoute les variantes sombres explicites du Hero premium et force le re-rendu ApexCharts lorsque le theme change. Le CSS dist reste sous son plafond a environ 27.5 / 28 KiB ; JS initial 255.5 / 260 KiB et JS total 664.9 / 670 KiB restent stables.

En 10.5.318, la page Projet publique et l ecran de chargement adoptent le systeme visuel premium. Les anciens panneaux Membres admins et Checklist publique quittent HTML, traductions, CSS et JavaScript. Le domaine Tests gagne l ouverture de la page Projet et mesure 23.0 / 35 KiB ; initial JS 255.5 / 260 KiB, lazy 409.5 / 415 KiB, total JS 665.0 / 670 KiB et CSS 27.5 / 28 KiB restent sous plafond.

En 10.5.319, le domaine Tests conserve les cycles traites avec dates, notes et version, ajoute les filtres A tester/Sans test/Archives et autorise un retest actif sans ecraser l historique. Sa source mesure 35.3 / 36 KiB. Le nouveau rendu date des archives porte le lazy a 416.6 / 420 KiB, le total JS a 672.1 / 675 KiB et le CSS a 29.4 / 30 KiB ; les plafonds sont ajustes au palier entier suivant, tandis que l initial reste stable a 255.4 / 260 KiB. Cautions quitte en parallele le runtime et son script legacy est supprime.

En 10.5.320, le lot groupe de retours ajoute une relance bornee au premier rendu Dashboard et centralise la detection des transferts internes dans les gardes du coeur. Le code mort situe apres le verrou Trip est retire. Tous les plafonds restent inchanges et verts : Dashboard + Settings 364.4 / 365 KiB, Analyse 159.0 / 160 KiB, initial JS 255.8 / 260 KiB, lazy 416.6 / 420 KiB, total JS 672.4 / 675 KiB et CSS 29.4 / 30 KiB.

En 10.5.321, Aide gagne un demarrage rapide persistant et un diagnostic explicatif, tandis que Documents modernise son rail lateral en conservant ses commandes. La base premium mesure 32.4 KiB de CSS ; le plafond passe de 30 a 33 KiB, soit le palier entier immediat sans marge supplementaire. Documents reste sous son plafond a environ 112.6 / 115 KiB, l initial a 255.8 / 260 KiB, le lazy a 417.4 / 420 KiB et le total JS a 673.2 / 675 KiB.

En 10.5.322, Settings Compte remplace quatre sauvegardes visibles par une action globale pre-validee et retire le panneau Notifications mobile duplique avec son controleur mort. Dashboard + Settings baisse a 361.1 / 365 KiB, l initial a 253.8 / 260 KiB, le lazy a 416.2 / 420 KiB et le total JS a 670.0 / 675 KiB. La grille premium responsive porte le CSS a 33.8 KiB ; son plafond passe au palier entier immediat de 34 KiB.

En 10.5.323, Settings Voyages/periodes ajoute une barre d action responsive et un champ monetaire avec devise separee. Dashboard + Settings reste sous plafond a 364.3 / 365 KiB, l initial a 255.1 / 260 KiB, le lazy a 416.2 / 420 KiB et le total JS a 671.3 / 675 KiB. Le CSS atteint 35.0 KiB ; son plafond passe au palier entier immediat de 35 KiB.

En 10.5.324, la campagne de tests conserve la filiation des retours et porte la cloture au niveau scenario ; son groupe atteint 38.6 KiB et son plafond passe au palier entier de 39 KiB. L ajout NEAT/TEF et les contraintes responsive portent le total JS a 675.1 / 676 KiB et le CSS a 35.6 / 36 KiB. L initial reste a 255.3 / 260 KiB et le lazy a 419.8 / 420 KiB.

En 10.5.325, le retour visuel partage rouge/vert est disponible des le boot et les aides contextuelles deviennent persistantes. L initial reste sous plafond a 257.1 / 260 KiB et le lazy a 419.8 / 420 KiB. Le total atteint 676.9 KiB et le CSS 38.2 KiB ; leurs plafonds passent aux paliers immediatement superieurs de 678 et 39 KiB, sans relever les limites initiale, lazy ou gzip.

En 10.5.329, Patrimoine regroupe ses commandes et ses liens sans relever les plafonds. Les libelles bilingues nouveaux rejoignent les dictionnaires existants et le CSS embarque touche est compacte. Le domaine Assets mesure 118.4 / 125 KiB, l initial 257.3 / 260 KiB, le lazy 420.0 / 420 KiB, le total JS 677.3 / 678 KiB et le CSS 38.9 / 39 KiB.

En 10.5.330, Settings Categories ajoute renommage propage, ordre et suppression guidee sans relever les plafonds. Les anciens fallbacks directs de suppression et de mapping, devenus morts depuis le deploiement des RPC, ainsi que le controle couleur duplique sont retires. Dashboard + Settings mesure 361.7 / 365 KiB, l initial 257.3 / 260 KiB, le lazy 420.0 / 420 KiB et le total JS 677.3 / 678 KiB.

En 10.5.274, l'ancien alias `window.renderHealth` et son wrapper Nutrition sont supprimes. La navigation `health` continue de rediriger vers Alimentation, mais Nutrition ne conserve plus ce point d'entree legacy. Nutrition baisse de 187.5 a 187.2 KiB.

En 10.5.275, les exports globaux Nutrition `tbSaveHealthGoal` et `tbHealthGoalTargets`, devenus sans appel, sont retires. `tbLoadHealthGoal` reste conserve pour les KPI. Nutrition baisse de 187.2 a 187.0 KiB.

En 10.5.276, le chantier Play Store ajoute `npm run links:check`. Ce controle verifie automatiquement les liens publics de `public/projet.html` et `public/privacy.html`, dont l'APK Supabase, les ancres de confidentialite et les liens locaux. Aucun bundle applicatif n'est alourdi.

En 10.5.277, le chantier Play Store ajoute le workflow AAB de production. `android:bundle-check` genere un bundle de controle local, `android:bundle-release` exige une keystore via variables d'environnement et verifie la signature avec `jarsigner`. Le changement touche Gradle et les scripts de livraison, sans alourdir le bundle web.

En 10.5.278, le chantier V11 reprend le boot initial : l'ecran de chargement affiche la version TB, une progression par phases et un passage a 100% avant disparition. Le boot legacy remonte a 878.5 KiB a cause du HTML/CSS/JS du loader, mais le budget reste tres large face au plafond de 1500 KiB. Le CSS dist reste proche du plafond a 7.8 / 8 KiB : le prochain lot visuel devra donc supprimer ou deplacer du style avant d'en ajouter.

En 10.5.279, le fallback du loader initial est compacte : le design complet reste dans `index.html`, tandis que `20_boot.js` ne garde qu'un style minimal de secours si le bloc doit etre recree. Boot legacy : 878.5 -> 875.8 KiB. L'UX normale du premier ecran ne change pas, et le contrat verifie que le CSS futuriste n'est plus duplique dans le legacy.

En 10.5.280, le fallback inline des onglets Trip Recap/Historique est supprime du legacy. `29_trip_v1.js` appelle uniquement `tripView.renderTripTabs`, deja expose par le bridge et teste. Trip baisse de 309.4 a 309.1 KiB, sans modifier le comportement attendu des onglets.

En 10.5.281, les modales Documents de liaison transactions, depenses Trip et assets quittent `43_documents_ui.js` vers `documentView.js`. Le fichier legacy Documents baisse fortement, de 93.6 a 87.2 KiB. Le domaine Documents passe de 107.8 a 108.2 KiB car le rendu est maintenant dans un module pur teste. Le chunk Vite lazy passe a 381.2 KiB et le total JS a 624.5 KiB ; leurs plafonds sont ajustes a 385 et 625 KiB, sans toucher au plafond initial.

En 10.5.282, le shell Documents, la navigation dossiers et le panneau principal quittent `43_documents_ui.js` vers `documentView.js`. Le legacy Documents baisse de 87.2 a 80.5 KiB. Le domaine Documents passe de 108.2 a 110.9 KiB, le lazy a 389.3 KiB et le total JS a 632.5 KiB, car le rendu est maintenant teste dans le runtime Documents. Les plafonds lazy/total passent a 390/635 KiB, sans toucher au bundle initial.

En 10.5.283, les modales batch Documents de partage, resultat de partage, deplacement et ajout de tag quittent `43_documents_ui.js` vers `documentView.js`. Le legacy Documents baisse de 80.5 a 77.2 KiB. Le domaine Documents monte a 112.3 / 115 KiB car le rendu est teste dans la vue Documents. Le lazy passe a 393.7 KiB et le total JS a 637.0 KiB ; les plafonds montent a 395/640 KiB en gardant le bundle initial stable.

En 10.5.284, les modales Documents d'aperçu fichier et de metadonnees quittent `43_documents_ui.js` vers `documentView.js`. Le legacy Documents baisse de 77.2 a 75.4 KiB. Le domaine Documents monte a 113.2 / 115 KiB et le lazy a 396.1 KiB car le rendu est maintenant teste dans le runtime Documents ; le plafond lazy passe a 400 KiB, tandis que le total reste sous son plafond existant a 639.4 / 640 KiB.

En 10.5.285, le shell principal Trip quitte `29_trip_v1.js` vers `tripView.js`. Le legacy Trip baisse de 200.7 a 199.3 KiB. Le domaine Trip monte a 310.8 / 340 KiB, l'initial a 245.8 KiB et le total JS a 641.9 KiB car le rendu devient modulaire et teste ; le plafond total passe a 645 KiB en gardant le plafond initial stable.

En 10.5.286, le shell principal Sport quitte `45_sport_ui.js` vers `sportView.js` et le bandeau flottant Invitations Trip quitte `29_trip_v1.js` vers `tripView.js`. Trip legacy baisse de 199.3 a 199.1 KiB, Sport legacy reste a 214.4 KiB mais possede une nouvelle frontiere testee pour extraire les sous-panneaux suivants. Les budgets restent verts : initial 246.3 / 260 KiB, lazy 397.2 / 400 KiB, total 643.4 / 645 KiB. La marge totale est volontairement surveillee de pres : le prochain lot devra supprimer ou fractionner avant d'ajouter du rendu.

En 10.5.287, le chantier 6 demarre par suppression de code mort verifiee : anciens RPC Trip balances/suggestions non appeles, ancien chemin settlement wallet non appele, et wrappers d'options Sport builder inutilises. `29_trip_v1.js` baisse de 199.1 a 192.1 KiB, `45_sport_ui.js` de 214.4 a 213.3 KiB, soit environ 8.1 KiB de legacy direct retire et 261 lignes nettes supprimees. Les domaines mesurés passent a Trip 304.2 / 340 KiB et Sport 439.9 / 450 KiB. Les bundles distribues restent stables : initial 246.3 / 260 KiB, lazy 397.2 / 400 KiB, total 643.4 / 645 KiB.

En 10.5.288, le nettoyage continue sur Analyse et Documents avec deux helpers sans appel retires. `33_budget_analysis.js` baisse de 88.50 a 88.16 KiB, `43_documents_ui.js` de 75.40 a 75.32 KiB. Les groupes restent sous plafond : Analyse 159.4 / 160 KiB et Documents 113.1 / 115 KiB. Un contrat anti-retour verrouille l'absence de `_referenceDailyForDate` et `extFromName`.

En 10.5.289, l'ancien script de contexte voyage `06_travel_context.js` quitte totalement le boot. Les fonctions `getActiveTravel`, `filterByActiveTravel` et `loadTravelContext` n'avaient plus d'appel depuis la migration vers l'etat voyage centralise. Le boot legacy baisse de 875.8 a 874.7 KiB, et le contrat verifie que le fichier ne revient ni dans `src/main.js`, ni dans les budgets.

En 10.5.290, `31_wallet_balance.js` quitte le boot et le depot. L'ancien `computeWalletBalance` n'etait plus appele : les soldes passent par les regles centrales et les helpers effectifs existants. Boot legacy : 874.7 -> 874.2 KiB ; JS initial : 246.3 -> 246.2 KiB. Le contrat anti-retour verifie que le fichier ne revient pas dans le boot ni dans les budgets.

En 10.5.291, `22_budget_consistency_audit.js` quitte le boot et le depot. Cet ancien badge flottant `Budget OK/anomalies` utilisait un audit local obsolete, non raccorde aux vues Analyse/KPI actuelles et sans appel direct. Boot legacy : 874.2 -> 870.8 KiB. Le contrat anti-retour verifie que le fichier ne revient pas dans le boot ni dans les budgets.

En 10.5.292, `25_health_check.js` quitte le boot et le depot. Cet ancien badge flottant `Donnees OK/alertes` patchait `refreshAll` et doublonnait les diagnostics modernes sans point d'appel direct dans les vues. Boot legacy : 870.8 -> 867.2 KiB ; JS total : 643.4 -> 643.3 KiB. Le contrat anti-retour verifie que le fichier ne revient pas dans le boot ni dans les budgets.
