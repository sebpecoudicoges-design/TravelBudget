# Plan GPT-6, amortissements et module comptable

Date : 25 septembre 2026. Statut : premier lot implémenté ; migration de quotas et fonction déployées, IA désactivée car les crédits OpenAI sont épuisés. Frontend encore local.
Périmètre confirmé : GPT-6 dans Codex pour développer TravelBudget ET IA intégrée dans l'application.
Ordre demandé : GPT-6, puis vérification des amortissements dans l'analyse, puis réflexion sur le module comptable.

## Avancement du premier lot

- Configuration projet Codex Astra/high ajoutée ; configuration globale inchangée.
- Assistant IA Sol/low, adaptateur Responses, liste pilote, quotas SQL et repli local implémentés. Voir [exploitation](ASSISTANT_AI_OPERATIONS.md) et [évaluation](assistant-ai-evaluation.md).
- Amortissements : chargement autonome pour l'analyse, arrêt au bon mois et exclusion des flux de trésorerie corrigés ; tests ajoutés. Le wrapper legacy lié au cache de Patrimoine a été retiré après recherche de ses appels.
- [Comptabilité personnelle](ACCOUNTING_MODULE_BRIEF.md) : premier module local implémenté après validation du périmètre personnel ; états de gestion navigables, paramètres locaux, sans déploiement.
- Les listes ci-dessous restent la feuille de route complète : le premier lot ne couvre pas encore l'analyse financière par IA, la télémétrie détaillée, les comparaisons de modèles ou une ouverture en production.

## 1. État constaté et choix des modèles

L'inspection du code applicatif n'a trouvé aucun appel OpenAI ni identifiant GPT actif. `package.json` ne contient pas de SDK OpenAI. L'assistant existant repose notamment sur `src/core/assistantRules.js` et `public/legacy/js/32_help_assistant.js`. L'intégration applicative sera donc un ajout, avec conservation de l'assistant local.

| Usage | Choix proposé | Motif et validation |
|---|---|---|
| Codex : architecture, diagnostic transversal, futur moteur comptable | GPT-6 Astra, effort high au départ | Priorité à la qualité sur ce dépôt hybride et ses règles métier ; comparer medium/high sur des tâches représentatives |
| Codex : corrections courantes et travaux bien délimités | GPT-6 Sol, effort medium | Compromis pour le travail quotidien |
| Assistant intégré | GPT-6 Sol, effort low au départ | Candidat principal ; comparer low/medium sur les explications et la navigation |
| Tâches applicatives simples et répétées | GPT-6 Luna, option ultérieure | À introduire seulement si les évaluations justifient un routage supplémentaire |
| Analyses applicatives complexes | GPT-6 Astra, option ultérieure | Usage explicite et plafonné après mesure du gain |

Ces choix sont une recommandation propre au projet. OpenAI présente Astra pour les travaux complexes, Sol pour l'équilibre qualité/coût et Luna pour les tâches économiques à volume élevé : [catalogue officiel](https://developers.openai.com/api/docs/models), [guide de sélection](https://developers.openai.com/api/docs/guides/model-selection).

L'accès effectif du compte, les quotas et le budget API restent à vérifier. L'utilisation de Codex et la consommation API applicative devront être suivies séparément. Aucun tarif ni engagement de latence n'est figé ici.

## 2. Plan GPT-6 dans Codex

- [ ] Vérifier la disponibilité d'Astra et Sol dans le sélecteur du compte et relever le réglage actuel pour permettre un retour arrière.
- [ ] Choisir Astra pour le chantier transversal ; garder Sol comme option quotidienne. Ne pas modifier les réglages globaux des autres projets.
- [ ] Relire les consignes du dépôt et les instructions accessibles au modèle ; préserver les règles métier, les contrats d'interface et le périmètre des demandes.
- [ ] Évaluer sur trois travaux représentatifs : compréhension d'un flux legacy vers core, correction bornée avec test de non-régression, revue d'une proposition comptable.
- [ ] Comparer qualité du résultat, régressions, temps total, volume de changements et consommation. Retenir le réglage le plus léger qui satisfait les critères.

Livrable : réglage retenu et courte fiche de résultats. Aucun remplacement automatique des dépendances ou de l'architecture n'est nécessaire pour changer le modèle de développement.

## 3. Plan IA intégrée à TravelBudget

### Lot A — Contrat fonctionnel et jeu d'évaluation

- [ ] Commencer par expliquer un écran, répondre sur les fonctions du produit et orienter vers une vue existante.
- [ ] Préparer 30 à 50 cas anonymisés FR/EN : données absentes, multi-devises, périodes, budget versus trésorerie, questions ambiguës, indisponibilité réseau et demandes hors périmètre.
- [ ] Réutiliser les instantanés et résultats des règles métier existantes. Chaque montant présenté doit provenir d'un calcul déterministe identifié ; l'IA explique et ne tient pas les comptes.
- [ ] Définir une réponse structurée : texte, références aux données, période, devise, limites et destination de navigation autorisée.

### Lot B — Adaptateur serveur et compatibilité

- [ ] Ajouter un adaptateur serveur dédié, configuration du modèle par environnement et drapeau d'activation ; aucune clé API dans le navigateur ou l'APK.
- [ ] Utiliser Responses API avec `gpt-6-sol`, effort initial `low`, limite de sortie et délai maximum. Vérifier le SDK et les schémas au moment de l'implémentation.
- [ ] Pour un raisonnement actif, omettre `temperature`, `top_p` et les paramètres de probabilités incompatibles. Utiliser Responses pour les outils avec raisonnement ; Astra ne prend pas en charge l'effort `none`.
- [ ] Ajouter contrôle d'accès aux seules données de l'utilisateur, minimisation du contexte, quotas par utilisateur, plafond de coût et journalisation technique sans contenu financier brut.
- [ ] Traiter erreurs, limitation de débit, réponse incomplète, annulation et délais dépassés. Revenir à l'assistant local sans boucle de réessais payants.
- [ ] Commencer avec des outils de lecture et de navigation limités ; les libellés et documents utilisateur doivent rester des données, jamais des instructions exécutables.

La compatibilité est fondée sur le [guide officiel GPT-6](https://developers.openai.com/api/docs/guides/latest-model) et son [guide de migration](https://developers.openai.com/api/docs/guides/latest-model/gpt-6-astra.md#migration-quickstart), consultés le 25 septembre 2026.

### Lot C — Intégration, évaluation et mise en service progressive

- [ ] Brancher l'adaptateur sur l'assistant existant, préserver son mode local et ses commandes utiles.
- [ ] Tester le contrat serveur avec réponses simulées, puis exécuter une évaluation API plafonnée lorsque l'accès est configuré.
- [ ] Mesurer coût par réponse, tokens, latence médiane/p95, erreurs, exactitude et qualité de navigation. Fixer les seuils de coût/latence avant toute ouverture élargie.
- [ ] Exiger zéro fuite entre utilisateurs, zéro mutation non sollicitée et concordance de tous les montants avec les sources sur le jeu de validation. Les réponses incomplètes doivent être détectées et traitées.
- [ ] Vérifier contrats fonctionnels, parcours hors ligne, thèmes clair/sombre et largeurs 1440/390 px selon `docs/VISUAL_SYSTEM.md`.
- [ ] Valider tests ciblés, build et budget de performance ; ouvrir d'abord à un périmètre pilote, puis élargir selon les mesures.

Retour arrière : désactiver le drapeau IA pour retrouver l'assistant local ; conserver séparément versions du prompt et du modèle. Rechercher le code mort directement lié à chaque fichier modifié et supprimer uniquement après vérification des appels, avec contrat anti-retour pertinent.

## 4. Ensuite — Vérifier les amortissements du patrimoine dans l'analyse

Signalement utilisateur : les amortissements semblent mal remonter. Statut : anomalie suspectée, cause non établie ; aucune correction effectuée dans ce plan.

Le générateur existe dans `src/core/assetRules.js` (`buildAssetBudgetTransactions`) ; `public/legacy/js/42_assets_ui.js` expose `tbAssetBudgetTransactionsForRange`. L'analyse appelle déjà cette fonction dans `public/legacy/js/33_budget_analysis.js`. Il faut donc vérifier la chaîne complète et ses filtres avant de proposer un correctif.

- [ ] Reproduire avec un actif connu, une période précise et un montant attendu calculé indépendamment.
- [ ] Suivre chargement des actifs et propriétaires, génération des lignes virtuelles, filtres de voyage/période/devise, agrégation et affichage détaillé.
- [ ] Vérifier inclusion au budget, début/fin d'amortissement, jours 29–31, valeur résiduelle, montant manuel, quotes-parts, vente et archivage, y compris consultation historique.
- [ ] Vérifier recalcul après modification, rechargement, synchronisation et utilisation hors ligne.
- [ ] Garantir l'absence de double comptage entre acquisition et amortissement ; une ligne `virtualBudgetOnly` ne doit pas débiter un portefeuille.
- [ ] Ajouter le cas reproduit aux tests core, aux contrats de l'analyse et au parcours navigateur concerné.

Acceptation : même montant attendu dans le total et le détail de l'analyse, respect des filtres, zéro impact indu sur la trésorerie. Points d'appui : `tests/core/assetRules.test.js`, `tests/core/budgetAnalysisRules.test.js`, `tests/e2e/analysis-audit.spec.js`.

Tant que ce contrôle n'est pas terminé, les évaluations de l'IA sur les amortissements utiliseront des fixtures vérifiées ; les données de production concernées ne constituent pas une vérité de référence.

## 5. Puis — Réfléchir au module comptable navigable

Cette étape commence par un cadrage produit et une maquette, après stabilisation des amortissements. Elle ne lance pas encore la construction du module.

| Bloc | Proposition à discuter |
|---|---|
| Paramétrage | Périmètre personnel/professionnel, exercice, devise de présentation, plan de comptes, correspondance catégories/comptes, soldes d'ouverture et règles d'amortissement |
| Compte de résultat | Synthèse produits/charges/résultat et vue détaillée par compte, période et origine |
| Bilan | Synthèse actif/passif, puis détail des actifs bruts, amortissements cumulés, valeurs nettes, trésorerie, dettes et capitaux propres |
| Navigation | Indicateur → rubrique → compte → écriture → opération ou actif source ; filtres conservés, fil d'Ariane et retour à la synthèse |
| Indicateurs | Résultat, charges et produits, dotations, patrimoine net, trésorerie, endettement ; marges, liquidité, BFR et capacité d'autofinancement uniquement si les données et le périmètre les rendent pertinents |
| Explication | Formule, période, devise et éléments sources accessibles pour chaque indicateur ; comparaison à la période précédente |

Questions à trancher lors du cadrage : suivi personnel ou comptabilité d'activité ; simple tableau de gestion ou tenue comptable complète ; référentiel/pays ; traitements des créances, dettes, taxes et opérations multi-devises ; gestion des corrections et clôtures. Ne pas déduire ces choix des seules catégories budgétaires existantes.

Socle proposé à étudier : journal d'écritures équilibrées, comptes, exercices, liens vers les opérations existantes, génération idempotente pour éviter les doublons et traçabilité des corrections. Prévoir les soldes d'ouverture et les données manquantes avant de présenter un bilan complet.

Critères du futur prototype : total synthétique égal à la somme des détails, équilibre du bilan selon le modèle retenu, rapprochement résultat/bilan, traçabilité jusqu'aux sources, distinction flux de trésorerie/charges calculées. Les indicateurs et états seront produits par le moteur métier ; GPT-6 pourra en expliquer le contenu.

## Prochain jalon

Valider le contrat fonctionnel minimal de l'assistant et les plafonds de coût/latence, puis exécuter les lots GPT-6. Conserver explicitement les deux étapes suivantes : contrôle des amortissements, puis atelier de conception comptable.
