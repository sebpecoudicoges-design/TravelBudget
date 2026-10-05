# Comptabilité personnelle détaillée TravelBudget

## Périmètre

Module chargé à la demande depuis Finances → Comptabilité, pour les administrateurs et testeurs. Il couvre les comptes et transactions du voyage actif, ainsi que ses biens et les biens sans voyage. Les soldes Trip personnels couvrent tous les groupes accessibles, distincts du voyage budgétaire actif ; ce périmètre est explicite dans le bilan. Les devises sont consolidées avec les taux FX existants ; une vue en devise seule reste disponible. Les dates de lecture et le périmètre sont affichés.

Les données sources ne sont pas modifiées. Les réglages sont locaux à l’appareil, isolés par utilisateur et voyage (`tb-accounting-v1`), non synchronisés et absents de l’export général. Aucun schéma SQL ni service distant n’est modifié par ce lot. Il ne s’agit pas d’un journal comptable clôturé ou d’états réglementaires d’entreprise.

## Plan et reclassement

Le plan contient **118 comptes à six chiffres**, des capitaux propres aux immobilisations, amortissements, créances, dettes, banques, charges et produits. Les familles sont inspirées du [plan de comptes ANC 2026](https://www.anc.gouv.fr/plan-comptable-general-0). Les subdivisions de consommation et revenus personnels sont des adaptations propres à TravelBudget, pas une promesse de conformité au PCG d’entreprise.

Une migration unique `classificationVersion=2` reclasse les anciens regroupements depuis les noms de catégorie/sous-catégorie. La sous-catégorie prime, puis les expressions les plus précises. Les anciens choix sont archivés sous `mappingBeforeDetailedChart`. Les affectations manuelles déjà à six chiffres et le choix explicite Auto sont conservés. Les décisions ambiguës restent signalées, y compris après enregistrement de la migration. Les affectations patrimoniales anciennes 471 sont conservées en 471000.

Les remboursements reçus avec une nature de charge identifiable sont comptés en diminution de la charge concernée. Les libellés de prêt, capital, cession, caution ou remboursement imprécis ne suffisent pas à fabriquer une écriture patrimoniale. Les comptes et sous-totaux sont triés par code puis catégorie, sous-catégorie et date ; les montants restent signés et sont additionnés en centimes.

## Dates budgétaires et rattachement

À la demande de l’utilisateur, le résultat utilise `budget_date_start` / `budget_date_end` ou leurs variantes camelCase, avec repli sur les dates historiques seulement si les champs budgétaires sont absents. Les helpers de dates sont ceux du domaine budget partagé. Les intervalles sont inclusifs et répartis au prorata des jours comme dans Analyse. Les différences de cumuls arrondis assurent la conservation des centimes entre périodes, y compris pour les annulations négatives et années bissextiles.

Exemple : 590 payés en décembre pour le 1er janvier au 28 février donnent 310 de charge en janvier et 280 en février. Au 31 janvier, la part future de 280 constitue une charge constatée d’avance. Une charge budgétaire échue non réglée est au résultat avec une dette 401000 ; un revenu dû non reçu crée une créance 411000. Les produits reçus d’avance sont en 487000. Ces contreparties proviennent des transactions et ne doivent pas être resaisies dans les compléments.

Les périodes futures sont plafonnées à la date de lecture ; les opérations simulées ou ignorées sont exclues. La fiche source expose les dates budgétaires, la date de trésorerie, le montant entier et la quote-part retenue. Les dates de trésorerie ne déterminent plus la période du résultat.

Les amortissements restent linéaires en fin de mois, à la quote-part personnelle, depuis `budget_start_date` du bien ou l’achat en son absence. Durée et valeur résiduelle sont conservées. Les achats liés sont exclus des charges courantes pour éviter le double compte. Biens sans propriétaire personnel identifiable, paramètres incomplets, ventes et financements non rapprochés sont signalés et empêchent de qualifier le bilan de confirmé.

## Exclusion des opérations internes

Toutes les lignes portant `is_internal` / `isInternal` ou un identifiant de transfert interne sont exclues du résultat et des régularisations, **sans exception pour les quotes-parts Trip internes**. Cette règle est propre à Comptabilité, conformément à la nouvelle demande ; la règle de quote-part de l’Analyse budgétaire reste inchangée. Les décaissements bruts Trip explicitement hors budget restent hors résultat personnel. Les positions bancaires sont les soldes réels calculés par le domaine de trésorerie, pas des soldes reconstruits à partir des seules charges du résultat.

L’ancien onglet Mouvements et sa branche de rendu ont été retirés. Les détails restent accessibles dans les comptes du résultat et du bilan. Les autres exclusions et rapprochements sont consultables depuis le résultat, sans réintroduire les opérations internes comme revenus ou charges.

## Bilan patrimonial et contrôle facultatif

L’actif additionne les comptes positifs, biens nets, créances (Trip et régularisations) et charges constatées d’avance. Les dettes comprennent les découverts, dettes suivies, soldes Trip à payer et régularisations. Les compléments manuels non saisis valent **0** à la demande de l’utilisateur. Les valeurs historiques restent conservées ; leur date ne déclenche plus de reconfirmation quotidienne.

Par défaut, **108000 · Capital personnel net calculé = actifs recensés − dettes recensées**. C’est aussi le patrimoine net. Le bilan est un bilan patrimonial calculé, équilibré par définition, sans prétendre prouver l’exhaustivité des sources ni créer une écriture fictive. Le résultat n’est pas ajouté une deuxième fois. En mode facultatif « Comparer à un capital déclaré », une référence indépendante permet de détecter un véritable écart. L’absence totale de référence rend ce contrôle non calculable ; les autres devises non renseignées valent 0.

Les positions Trip viennent de la vue existante `v_trip_user_net_balances`, sous l’identité authentifiée et avec `security_invoker`. Le signe distingue créance et dette, par groupe et devise ; les positions opposées de groupes différents ne sont pas compensées. Les règlements annulés et entrées non dues sont traités par la vue partagée déjà utilisée par le projet. Lecture paginée et ordonnée par `trip_id,currency`, conversion au taux du bilan. Le bilan expose les groupes et montants, sans créer de charge interne.

Une erreur de lecture Trip, un solde bancaire absent, une source invalide ou un taux FX manquant ne devient jamais zéro : le patrimoine net et les totaux dépendants restent incomplets. Les sous-totaux connus sont alors affichés distinctement.

La liste « Comprendre les données à confirmer » a été supprimée. Les compléments, devises et référence de capital sont dans une fenêtre facultative depuis Paramétrage. Les actions Ajouter une dette, Rembourser et Ajuster ouvrent des fenêtres natives accessibles au clavier ; l’historique reste dépliable sur chaque dette.

## Indicateurs et vues

Synthèse avec jauges accessibles et formules : épargne hors amortissements, marge nette et marge courante, autonomie de trésorerie, autonomie financière, poids des dettes, couverture globale des dettes, poids des immobilisations, couverture des charges financières et taux de classement détaillé. Les ratios sans dénominateur positif restent non calculables ; les signes négatifs restent affichés même si une jauge démarre à zéro.

Le compte de résultat distingue résultat courant hors financier/exceptionnel, résultat financier, charges exceptionnelles et résultat net, avec comparaison à la même période de l’année précédente. Résultat + amortissements est présenté comme solde potentiel avant investissements et variation du besoin de financement, jamais comme cash disponible. Le passif externe net de trésorerie est également affiché.

Le plan de comptes est consultable par familles. Le bilan détaille codes, sources et valeurs brutes/amorties/nettes, avec accès aux pièces sources de l’application.

## Conversion FX et qualité

Frankfurter v2 est réutilisé : requêtes publiques par paires/dates uniquement, sans montants ni libellés personnels. Conversion historique à la date de trésorerie si elle est passée ; pour une échéance future, début budgétaire acquis, sinon date de lecture. Le montant entier converti est ensuite réparti selon les dates budgétaires. Comptes et compléments : taux du bilan. Biens et dotations : taux historique d’acquisition.

Le dernier taux antérieur est admis dans une limite de sept jours ; les taux manuels datés du module FX peuvent servir de repli. Un taux manquant invalide les totaux concernés et ne devient jamais zéro. Les séries couvrent aussi les dates de paiement antérieures à la période affichée et les régularisations du bilan.

Lectures paginées, filtres utilisateur/voyage et chargement atomique conservés. Changement d’utilisateur : effacement des données et invalidation des lectures en vol. Hors ligne : dernière lecture du même périmètre, avec avertissement. Les erreurs d’enregistrement local préservent les réglages précédents.

## Validation et limites

Tests unitaires : reclassement, remboursements, exclusion interne stricte, prorata budgétaire, annulations, FX, amortissements, charges/produits d’avance, factures non réglées, indicateurs, bilan incomplet et écarts réels. Parcours navigateur : navigation par comptes, suppression de Mouvements, saisie/confirmation, persistance, isolation, clair/sombre et largeurs 1440/900/600/390 px.

Le code mort directement remplacé (ancien plan court, exception Trip interne, rendu Mouvements, règle de trésorerie pour le résultat et calcul automatique de capitaux propres par différence) a été retiré. Les paramètres historiques sont conservés seulement pour la migration documentée.

Restent hors périmètre : journal persistant en partie double, clôture, bilans historiques, amortissements dérogatoires, traitement automatique des cessions et financements, synchronisation des réglages et export réglementaire. Ils nécessitent des sources et rapprochements supplémentaires.


## Dettes individuelles et traçabilité (3 octobre 2026)

Le Bilan affiche les parts connues de l’actif et du passif lorsque des compléments ou taux restent inconnus. Ces sous-totaux ne valident pas le bilan : l’écart et les ratios restent non calculables si leurs sources manquent.

Une dette comporte un nom/créancier, une devise, un capital initial et une date de départ. Les références facultatives à un bien et/ou à une opération sont indépendantes. Une entrée d’argent liée est retirée des revenus (emprunt reçu) sans modifier la trésorerie source. Une dépense d’origine reste soumise aux règles habituelles de résultat/patrimoine. L’origine doit être réglée, dans la même devise et du même montant que le capital initial, datée au plus tard au départ du suivi. Une référence à un bien ne crée aucun actif supplémentaire.

Les remboursements sont rattachés à des dépenses externes réglées dans la même devise, depuis la date de départ. Une opération ne peut être affectée qu’une fois. Le capital est retiré des charges ; le reliquat conserve son classement et ses dates budgétaires (intérêts/frais à classer correctement). L’historique de dette suit les dates de règlement, distinctes de la reconnaissance budgétaire du résultat. Les remboursements en devise différente et les origines partielles nécessitent pour l’instant un rapprochement externe ; aucune conversion de capital implicite n’est inventée.

Des ajustements signés, datés et motivés augmentent/réduisent le capital, sans mouvement bancaire ni produit/charge automatique. Ils conservent aussi l’horodatage de saisie et se corrigent par un ajustement inverse. Ils modifient le capital net calculé sans flux bancaire ; en mode capital déclaré, leurs effets restent à rapprocher. À date égale les ajustements précèdent les remboursements, puis un identifiant stable départage les événements. Aucun solde intermédiaire négatif n’est accepté. L’historique présente le solde après chaque événement, en devise d’origine ; le bilan courant convertit le capital restant au FX de clôture disponible.

Une source absente, modifiée ou incompatible rend la dette non calculable et déclenche un rapprochement. Détacher un paiement conserve une trace locale de l’annulation ; retirer une dette l’archive avec son historique, hors calcul, et libère ses affectations. Les soldes complémentaires historiques restent séparés : ne pas y ressaisir les dettes individuelles, découverts ou factures déjà recensés.

Ces données restent dans le stockage local existant, isolées par utilisateur et voyage, sans synchronisation serveur ni export général. Le formulaire le précise. L’ancien prototype de saisie agrégée directe dans le Bilan a été remplacé par ce suivi individuel ; le paramétrage complémentaire existant est conservé.

Les sélecteurs d’opération d’origine et de remboursement proposent une recherche combinée sur montant, libellé, catégorie, sous-catégorie, devise, date de règlement et dates budgétaires. Accents ignorés ; montants français et dates JJ/MM/AAAA acceptés. Une sélection antérieure reste visible si elle ne correspond plus au filtre. Les anciennes déclarations sont conservées dans la fenêtre de compléments facultatifs ; aucun ancien montant renseigné n’est remplacé par zéro.


## Comptes de bilan et banques (5 octobre 2026)

Les catégories/sous-catégories accèdent aux comptes des classes 1 à 5 en plus des classes 6/7. Les catégories internes sont visibles et classables, tout en restant exclues des charges, revenus et régularisations. Une affectation de bilan ne crée aucun actif ni dette à partir du seul libellé ; les sources de comptes, biens, dettes et Trips déterminent les valeurs.

Chaque wallet reçoit un sous-compte 512xxx unique, conservé dans `walletAccounts` par utilisateur/voyage. Les codes existants du catalogue sont réservés ; une nouvelle banque ne renumérote pas les anciennes. Auto choisit le wallet de chaque opération interne, même si plusieurs banques partagent une catégorie. Une affectation manuelle explicite reste prioritaire. Le plan expose les sous-comptes bancaires nommés. Les anciennes suggestions automatiques des catégories internes cèdent la place à ce choix par wallet, sans modifier les choix manuels.


### Correspondances du catalogue personnel — 5 octobre 2026

La classification version 3 reprend les libellés du catalogue existant, sans renommer les catégories ni modifier les transactions. Au prochain chargement de la comptabilité, elle recalcule une seule fois les affectations automatiques existantes ; les choix manuels, sous-comptes bancaires et choix « automatique » sont conservés. Les nouvelles opérations bénéficient également de ces règles par déduction, même après cette migration. Les paramètres restent locaux à chaque appareil et voyage.

| Catégorie / sous-catégorie | Compte |
| --- | --- |
| Course / Eau, Marché, Snacks, Supermarché | 606310 — Alimentation |
| Course / Produits maison | 606320 — Hygiène et entretien |
| Repas / Eau | 625720 — Cafés et collations |
| Abonnement/Mobile / Abonnement app | 618120 — Logiciels et services numériques |
| Projet Personnel / Abonnement, Logiciel | 618120 — Logiciels et services numériques |
| Projet Personnel / Matériel | 606350 — Petit équipement non immobilisé |
| Transport / Location vélo | 613510 — Location de véhicule |
| Transport Internationale / Visa-run déplacement | 625190 — Autres transports |
| Souvenir / Vêtement | 651140 — Souvenirs |
| Caution versée / Logement, Location véhicule, Autre caution | 275000 — Dépôts et cautionnements |
| Immo / Voiture | 218200 — Véhicules |
| Immo / Matériel, Immobilisation | 218800 — Autres équipements |
| Mouvement interne / Change devise, Retrait, Transfert cash, Virement | 512xxx — Sous-compte du portefeuille |
| Ajustement wallet | 471000 — Contrepartie à identifier |

Les autres correspondances détaillées restent déduites des mots-clés du plan. Une caution reçue peut être un remboursement de dépôt ou une dette envers un tiers : elle reste à vérifier. « Retrait ATM » sous Frais bancaire vise les frais seuls et reste à vérifier pour éviter d'y comptabiliser le principal retiré. Les remboursements sans origine, ventes et libellés génériques restent à classifier. L'affectation à un compte de bilan n'invente aucun actif : les immobilisations et dépôts doivent être rapprochés des sources patrimoniales.
