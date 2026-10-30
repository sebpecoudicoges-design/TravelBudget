# Transactions et journal bancaire — 10.5.386

Priorité utilisateur du 30 octobre 2026, avant reprise de l'audit.

## Transactions

La sélection affiche total net, moyenne nette par opération, entrées et dépenses, séparément pour chaque devise. Aucune conversion implicite entre EUR et AUD. Les calculs portent uniquement sur les opérations sélectionnées ; la sélection continue d'être limitée aux lignes visibles après filtrage.

Le filtre Sous-catégorie → Aucune fonctionne désormais même si la catégorie est Toutes. L'ancienne branche qui désactivait ce filtre a été supprimée. Les valeurs nulles, vides et composées d'espaces sont traitées comme non renseignées.

## Journal par wallet

Le bouton Journal / pointage ouvre les opérations payées du wallet, tous voyages confondus, avec filtres par date, recherche et statut pointé/non pointé. Les mouvements internes de répartition et les opérations non payées sont exclus. Les dates affichées sont les dates de transaction, pas les dates budgétaires.

Les coches sont enregistrées dans une table dédiée `wallet_transaction_reconciliation`, sans modifier le montant, le solde ou l'impact budgétaire des transactions. Le pointage est relu à chaque ouverture et avec Actualiser. Les chargements sont paginés ; une page échouée ne produit pas un journal présenté comme complet. Une erreur de sauvegarde restaure la coche précédente et affiche l'erreur. La déconnexion ou le changement de compte ferme le journal.

Le solde actuel du relevé saisi est une comparaison temporaire avec le solde calculé actuel du wallet, selon la règle existante de snapshot. Il ne modifie aucun solde et ne représente pas un rapprochement historique à une date de clôture. Les filtres de dates portent sur la liste et ne changent pas cette comparaison actuelle. Les transactions modifiées après leur pointage redeviennent « à vérifier » ; la RPC refuse un pointage effectué sur une version déjà modifiée.

## Persistance et validation

Migration additive `20261030082844_wallet_transaction_reconciliation.sql` appliquée. Table protégée par RLS, ownership transaction et wallet contrôlé ; RPC SECURITY INVOKER non exécutable par anon. Suppression en cascade avec la transaction, le wallet ou le compte. Tests SQL transactionnels puis ROLLBACK : propriétaire peut pointer/lire/dépointer, version obsolète refusée, autre utilisateur ne peut ni lire ni dépointer. Relecture : zéro pointage de test conservé, RLS actif, anon exclu. Aucune transaction financière modifiée.

Tests : sommes/devises/moyennes, exclusion des lignes internes/non payées, invalidation d'une coche, pagination à 1 201 lignes et erreur intermédiaire ; parcours navigateur de sélection/filtre, pointage puis réouverture, non-pointées, erreur réseau et fermeture lors de la déconnexion. Thèmes clair/sombre, 1440/390 px ; contrats wallets également à 900/600 px avec simulation native. Captures contrôlées visuellement.

Le journal est chargé à la demande. Budgets ajustés pour cette nouvelle fonctionnalité : JS initial 277 KiB, différé 583 KiB, total 860 KiB, CSS 81 KiB ; groupe source journal 14 KiB. Les autres plafonds restent inchangés.

L'outillage de syntaxe HTML commencé avant cette priorité est conservé : `lint:inline` contrôle 38 scripts/gestionnaires dans six pages avec parse5 8.0.1, sans exécuter le code. Les tests distinguent scripts, modules, gestionnaires et blocs de données. Aucune erreur existante n'a été détectée dans ces blocs. Ce contrôle n'est pas une analyse sémantique ni une validation des URL `javascript:` ou du HTML généré à l'exécution.

APK prévu : `travelbudget-10.5.386-20261030-180000-debug.apk`. Livraison web, migration et APK à vérifier séparément. Validation sur téléphone physique restante.
