# Comptabilité personnelle détaillée TravelBudget

## Périmètre

Module chargé à la demande depuis Finances → Comptabilité, pour les administrateurs et testeurs. Il couvre les comptes et transactions du voyage actif, ainsi que ses biens et les biens sans voyage. Les devises sont consolidées avec les taux FX existants ; une vue en devise seule reste disponible. Les dates de lecture et le périmètre sont affichés.

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

## Bilan réel et contrôle indépendant

L’actif additionne les comptes positifs, biens nets, créances et charges constatées d’avance. Le passif additionne les découverts, dettes, produits constatés d’avance et **capitaux propres confirmés indépendamment**, résultats inclus à la date du bilan. Le résultat sélectionné n’est pas ajouté une seconde fois.

Les dettes/créances complémentaires, capitaux propres et référence de confirmation sont saisis par devise. Une case vide n’est pas zéro. Une ancienne date, une référence absente ou des sources à rapprocher restent signalées. Les compléments ne doivent jamais recompter les contreparties déjà calculées depuis les transactions, comptes et biens.

Le patrimoine net calculé reste un indicateur distinct : il n’alimente pas le passif pour forcer l’égalité. Le contrôle affiche quatre états : incomplet, écart réel, égalité à vérifier, équilibré et confirmé dans le périmètre recensé. Le dernier exige des valeurs connues, une égalité au centime et aucune alerte restante. La confirmation est celle des sources/déclarations de l’utilisateur ; ce n’est pas une certification externe. Les ouvertures, cessions et financements sans données ne sont pas inventés.

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
