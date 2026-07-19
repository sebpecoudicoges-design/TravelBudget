# TravelBudget - tests manuels

Objectif : conserver les vérifications utilisateur importantes après chaque APK, en complément des tests automatisés.

Statuts : `à faire`, `ok`, `à revoir`.

## Point actuel

- Version à valider : `10.5.226`.
- Bilan : 7 parcours `ok`, 1 parcours `à faire`.
- Retour corrigé à revalider : le changement de voyage dans Réglages doit rester actif après refresh, même si le voyage choisi n'est pas celui contenant la date du jour.
- Les 29 scénarios historiques ont été regroupés en 8 parcours de régression. La colonne **Versions couvertes** conserve la traçabilité des changements.
- Exécuter en priorité les parcours 1 à 3, qui couvrent la dernière version, les KPI et les wallets.
- Consigner les anomalies et retours détaillés dans `docs/ADMIN_TEST_RETURNS.md`.

## Parcours de régression condensés

| Priorité | Versions couvertes | Module | Parcours et étapes utilisateur | Résultat attendu | Console attendue | Statut |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 10.5.224 à 10.5.225 | Réglages + navigation + i18n | Ouvrir **Réglages > Règles récurrentes**, créer puis annuler une règle. Ouvrir ensuite Trip, Sport, Alimentation, Travail et Patrimoine. Tester aussi `showView("health")` depuis la console. Puis dans Réglages > Compte, passer la langue en anglais et revenir en français. | La modale partagée s'ouvre et se ferme proprement. Tous les domaines s'ouvrent sans blocage, `health` redirige vers Alimentation et le dictionnaire anglais se charge à la demande sans bloquer le boot. | `TB BUILD 10.5.225` ; aucun `Uncaught`, aucun `_tbEnsureModal` manquant, aucun `[i18n] lazy dictionary load failed`. | ok |
| 2 | 10.5.216, 10.5.220 à 10.5.223 | KPI + Santé + FX | Ouvrir KPI avec un wallet cash, des impayés, des transactions et un Trip actif. Vérifier Total wallets, Cash/Stock/Burn, Fin de période et budget recommandé. Activer **Inclure les impayés**, puis tester Segment, Période et Date à date avec **Appliquer**. Vérifier la carte Santé (nutrition, alcool, sommeil, sport/travail). Enfin, saisir `10` dans le convertisseur FX et inverser les devises. | Les montants, signes, regroupements Trip, pastilles cash et dates restent cohérents entre les scopes. Le calendrier attend la validation. Santé et projections s'affichent dès l'ouverture. Le convertisseur calcule et inverse les devises. | Aucun `Uncaught`, aucune fermeture immédiate du calendrier, aucun module `TBKpiProjectionRules`, `TBKpiCashRules` ou KPI manquant. | ok |
| 3 | 10.5.218 à 10.5.219 | Dashboard | Créer un wallet AUD, modifier son nom et son type, l'archiver puis le désarchiver. Tenter un nom vide, puis la suppression d'un wallet contenant des transactions. | Les mutations valides persistent. Le nom vide est refusé sans fermer brutalement la modale. La suppression d'un wallet utilisé est refusée proprement. | Aucun `Uncaught`, aucun `TBDashboardWalletRules` manquant, aucun payload wallet legacy régressif. | ok |
| 4 | 10.5.196, 10.5.217 | Analyse | Depuis un chargement frais avec le voyage BudgetTravel actif, ouvrir Dashboard puis Analyse. | Les données et le bloc FX Decision apparaissent sans rechargement manuel ; l'écran ne reste pas sur `Chargement analyse...`. | Aucun `Uncaught`, aucun `FX decision indisponible` ; un seul chargement des transactions par voyage dans le flux normal. | ok |
| 5 | 10.5.198 à 10.5.199, 10.5.214 à 10.5.215, 10.5.226 | Réglages : voyages et périodes | Ouvrir Réglages, changer de voyage si possible, rafraîchir la page, puis créer et annuler un voyage et une période. Ouvrir Budget de référence. Avec une seule période, tenter de la supprimer. | Le voyage sélectionné reste actif après refresh, même hors période courante. Les champs et libellés sont visibles, les modales s'annulent proprement et le budget reste utilisable. La dernière période n'est pas supprimée et un message clair s'affiche. | `TB BUILD 10.5.226` ; aucun `Uncaught`, aucun module Settings manquant, aucune double erreur après le refus. | à faire |
| 6 | 10.5.197, 10.5.205 à 10.5.211 | Réglages : catégories | Dans **Réglages > Catégories**, créer une catégorie et une sous-catégorie, changer couleur et mapping, modifier puis renommer la sous-catégorie, la réordonner, la désactiver/réactiver et rafraîchir. Si disponible, enregistrer une sous-catégorie détectée. | Les modales sont préremplies et sans prompt navigateur. Ordre, statut, couleur, nom et mappings persistent ; l'ancien mapping ne reste pas en doublon et les lignes détectées ne sont pas réordonnées. | Aucun `[safeCall/async]`, aucun `Uncaught`. | ok |
| 7 | 10.5.200, 10.5.202 à 10.5.204, 10.5.213 | Réglages : validations et suppression | Tenter de créer ou modifier une catégorie/sous-catégorie avec un nom vide, un doublon ou la couleur `blue`. Puis supprimer une catégorie SQL et, si disponible, une catégorie détectée ; rafraîchir. | Chaque saisie invalide est refusée avec un message lisible et sans écriture SQL. La suppression SQL retire catégorie, sous-catégories et mappings ; le fallback masque durablement la catégorie détectée. | Aucun `[safeCall/async]`, aucun `Uncaught`. | ok |
| 8 | 10.5.212, 10.5.222 | Page projet | Ouvrir `public/projet.html` sur mobile et desktop. Dans App, tester plusieurs filtres et ouvrir le détail d'une version. Vérifier le bloc Membres admins. | Fresque, spotlight et détail restent lisibles. Le bloc admins renvoie vers `docs/ADMIN_TEST_RETURNS.md` avec le statut `à finir`. | Aucun `Uncaught` et aucun message JavaScript affiché dans la page. | ok |

## À ajouter à chaque livraison

Ajouter un parcours uniquement si la livraison introduit une vérification utilisateur qui n'est pas déjà couverte. Sinon, étendre la ligne existante et ajouter la version dans **Versions couvertes**.

- Version livrée.
- Écran à ouvrir.
- Action principale ou nouveau cas limite.
- Résultat attendu observable.
- Attente console simple : aucune erreur non gérée, ou un log précis si utile.
- Statut et, en cas d'échec, lien vers le retour détaillé.
