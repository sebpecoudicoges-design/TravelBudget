# Connexion ChatGPT / MCP — feuille de route et premier socle

Demande du 31 octobre 2026, après lecture de la pièce jointe « Connecter TravelBudget à ChatGPT ».

## Choix confirmés

- Première version **lecture seule** : wallets, transactions, budgets et voyages.
- L'utilisateur utilise ChatGPT Pro. Cible : chaque utilisateur connecte son propre compte TravelBudget depuis son propre ChatGPT. Une restriction initiale au compte administrateur est acceptable ; elle ne doit jamais donner accès aux données des autres comptes.
- Nutrition, Sport et toutes les écritures restent hors de ce premier périmètre.
- Cette priorité s'ajoute au suivi d'audit ; elle ne clôt ni architecture/qualité ni l'audit général de la base.

## État effectivement livré

Un catalogue interne de quatre outils et leur adaptateur de lecture, avec tests, sont présents dans le dépôt :

| Outil préparé | Résultat | Limite explicite |
|---|---|---|
| get_accounts | Wallets, dont archivés, et soldes calculés | Réutilise computeWalletBalanceRows ; devise propre à chaque wallet |
| get_transactions | Page de transactions, dates et filtres wallet | Filtre date_start ; dates budgétaires distinctes exposées ; pagination à poursuivre |
| get_budget_configuration | Périodes et segments de budget configurés | Pas encore de synthèse de dépenses, amortissements, change ou projection |
| get_trips | Voyages et groupes Trip possédés | Pas de participants, dépenses de groupe ni groupes possédés par autrui |

Sources : [adaptateur](../src/data/mcpFinanceReadRepository.js), [catalogue et validation](../src/features/assistant/mcpReadTools.js), [tests](../tests/data/mcpFinanceRead.test.js).

**Ce socle n'est pas encore un serveur MCP connecté.** Aucun transport HTTP, endpoint public, consentement OAuth, jeton ou client ChatGPT n'est activé. Les modules ne sont pas importés par le démarrage de l'application ; ils sont exercés par les tests et préparent le futur serveur. L'assistant intégré existant conserve son fonctionnement : ce n'est pas un doublon à supprimer. Aucune nouvelle dépendance ni nouvelle migration. Aucun APK nécessaire pour ce lot préparatoire.

## Audit préalable constaté

Lecture du schéma distant uniquement, sans lire les transactions personnelles : les six tables wallets, transactions, periods, budget_segments, travels et trip_groups existent avec RLS actif. Comptage des politiques : respectivement 7, 8, 4, 5, 4 et 9. Aucune politique de ces six tables ne référence client_id. Les politiques wallets/transactions autorisent les écritures du propriétaire. Ces faits ne certifient pas l'ensemble des autorisations ni les RPC.

Le fichier local supabase/config.toml désactive auth.oauth_server et l'enregistrement dynamique. Cela ne prouve pas l'état de configuration Auth distant, qui reste à vérifier avant activation.

Point bloquant pour une activation réellement limitée à la lecture : les scopes OAuth Supabase portent sur les données OIDC et ne restreignent pas à eux seuls l'accès SQL. Transmettre un jeton utilisateur OAuth bénéficiant des droits habituels à un client tiers donnerait potentiellement plus de droits que les quatre outils proposés. Avant activation, contrôler les accès directs REST/Storage/Realtime et RPC, pas seulement les outils MCP. Référence : [Token Security & RLS](https://supabase.com/docs/guides/auth/oauth-server/token-security).

## Garanties et limites du socle

L'identité doit provenir d'une authentification vérifiée côté serveur ; le dispatcher ne prend pas de user_id fourni par un outil. L'adaptateur reçoit un client Supabase soumis au RLS de cet utilisateur, ajoute explicitement user_id à chaque requête et refuse une réponse contenant un autre propriétaire. Ce contrôle interne ne remplace pas OAuth et n'est pas un endpoint d'authentification. Aucune clé service_role n'est nécessaire à ces lectures.

Tables et colonnes sont en liste fermée. Les paramètres inconnus, y compris user_id, constructor et __proto__, sont refusés. Dates, UUID et bornes de pagination sont vérifiés. Les réponses sont reprojetées sur les colonnes autorisées pour exclure des champs ajoutés par erreur. Les libellés restent des données non fiables, jamais des instructions.

Lectures complètes paginées par 500, avec plafond explicite de 10 000 lignes : un échec intermédiaire ou un dépassement bloque le résultat plutôt que de retourner un faux solde. Les pages de transactions sont limitées à 100 lignes, avec next_offset ; les requêtes séparées ne constituent pas un snapshot transactionnel cohérent en présence d'écritures concurrentes.

Les dates de transaction, paiement et budget restent distinctes. Les lignes comptables brutes peuvent inclure une avance Trip et sa quote-part : leurs montants ne doivent pas être additionnés sans la règle métier correspondante. C'est pourquoi get_budget_summary est reporté au lot de réutilisation complète des règles budgétaires, plutôt que de présenter une somme simplifiée comme exacte.

Quinze tests synthétiques : catalogue lecture seule, refus des écritures et de l'identité injectée, dates/UUID/limites, isolation entre deux propriétaires fictifs, règles de snapshot wallet, devises, pagination au-delà de 500, panne de page, plafond, réduction des champs, configuration budgétaire sans faux total et périmètre des voyages. Ces tests ne prouvent pas encore l'isolation OAuth ni un échange avec ChatGPT réel.

## Étapes suivantes et critères de sortie

1. **Authentification et autorisations minimales** : choisir et tester la séparation des jetons MCP des sessions applicatives. Vérifier l'état Auth distant ; préparer le consentement et la révocation ; auditer les RPC accessibles et les politiques avant toute activation du serveur OAuth. Aucune désactivation générale de RLS ni exposition de service_role.
2. **Serveur MCP** : hébergement Supabase Edge envisagé, transport Streamable HTTP via SDK maintenu/verrouillé ; vérification du jeton à chaque appel (signature, issuer, audience, expiration, client autorisé et permissions), métadonnées de ressource protégée, quotas, bornes de requête et journal minimal d'accès. Aucune confiance dans user_metadata pour accorder un accès admin.
3. **Validation d'isolation réelle** : deux utilisateurs, propriétaire/non-propriétaire, jeton expiré/révoqué, client OAuth non autorisé, tentatives de lecture santé, écriture directe REST et appel RPC interdits. Tester aussi absence de jeton, panne API et collecte paginée.
4. **Pilote administrateur** : connexion réelle du compte Pro, relecture des soldes et transactions contre l'application ; consentement et révocation vérifiés. Pas de promesse de disponibilité avant ce test.
5. **Ouverture individuelle** : chaque utilisateur autorise son propre compte TravelBudget ; aucun partage de connexion administrateur. Valider les groupes partagés séparément avant de les inclure.
6. **Budgets calculés et suite** : reprendre les règles de dates budgétaires, devises, quotes-parts et patrimoine pour une synthèse comparable à l'application. Les écritures éventuelles nécessiteront un lot distinct explicitement demandé.

## Compatibilité ChatGPT vérifiée dans les docs

La pièce jointe est une proposition, pas une référence de disponibilité garantie. La documentation officielle consultée décrit l'ajout d'un serveur MCP personnalisé depuis ChatGPT web, OAuth et des outils de lecture/écriture soumis aux permissions du compte/espace. Elle ne permet pas de certifier ici l'accès réel de chaque abonnement. L'activation doit être vérifiée dans le compte Pro puis sur les comptes utilisateurs concernés.

- [Ajouter un serveur MCP personnalisé](https://developers.openai.com/api/docs/guides/custom-mcp-server)
- [Authentification des plugins : OAuth, PKCE, validation du jeton](https://developers.openai.com/plugins/build/auth)
- [MCP avec Supabase Auth](https://supabase.com/docs/guides/auth/oauth-server/mcp-authentication)

Aucun appel à l'API OpenAI n'est effectué par ce socle et aucune clé OpenAI n'est requise pour ses tests. Coûts d'hébergement/quotas et compatibilité finale restent à confirmer lors de l'activation.
