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

**Ce socle n'est pas encore un serveur MCP connecté.** Aucun transport HTTP, endpoint OAuth public, écran de consentement ou client ChatGPT n'est activé. Les modules ne sont pas importés par le démarrage de l'application ; ils sont exercés par les tests et préparent le futur serveur. L'assistant intégré existant conserve son fonctionnement : ce n'est pas un doublon à supprimer. Aucune nouvelle dépendance. Le second lot ajoute le registre privé décrit ci-dessous. Aucun nouvel APK nécessaire.

## Lot authentification — 1 novembre 2026

Le cycle serveur des autorisations est implémenté dans [mcp-oauth.js](../supabase/functions/_shared/mcp-oauth.js), avec [vérification d'identité](../supabase/functions/_shared/mcp-identity.js) et [adaptateur de stockage](../supabase/functions/_shared/mcp-oauth-store.js). Ce sont des modules internes, pas encore des handlers HTTP déployés.

- Codes aléatoires à usage unique, valables cinq minutes ; PKCE S256 obligatoire ; client, adresse de retour exacte et ressource liés au code. Refus des scopes autres que finance:read et des paramètres inconnus. State conservé dans la redirection.
- Jetons opaques distincts des JWT Supabase, aléatoires sur 256 bits. Seules leurs empreintes SHA-256 sont stockées. Aucun mot de passe, access_token ou refresh_token Supabase conservé ou transmis au client ChatGPT.
- Accès quinze minutes maximum ; famille de renouvellement trente jours fixes. Rotation à chaque renouvellement, ancien accès invalidé. Rejeu d'un code déjà consommé ou d'un ancien refresh : révocation de toute la famille, persistée malgré le refus. Verrou de ligne PostgreSQL autour des échanges.
- Révocation par jeton ou par propriétaire vérifié. Retrait du pilote n'empêche pas le propriétaire de révoquer. Vérification du compte distant à chaque accès ; pilote fermé par défaut et limité à une liste explicite d'identifiants configurée côté serveur. Aucune décision basée sur user_metadata.
- La vérification de session utilise Auth getUser côté serveur ; elle ne se contente pas de décoder le JWT. La connexion MCP est une autorisation distincte de la session d'application : une déconnexion de l'application ne révoque pas automatiquement la famille MCP. La révocation MCP, la suppression/suspension du compte et le retrait du pilote sont contrôlés séparément.

Migration **20261031230109_mcp_oauth_grants.sql appliquée** : deux tables dans mcp_private, RLS actif sans politique publique, schéma refusé à anon/authenticated ; RPC SECURITY INVOKER accessible seulement à service_role. La clé privilégiée est réservée au serveur pour ce registre ; elle ne doit jamais être envoyée au navigateur/ChatGPT ni être injectée dans l'adaptateur de lectures utilisateur. Aucune politique financière existante modifiée.

Validation : 24 tests JavaScript du cycle et des adaptateurs ; assertions PostgreSQL réelles avant puis après migration, avec deux comptes synthétiques et ROLLBACK. Vérification des droits des rôles anon/authenticated, PKCE, liaisons client/ressource/redirection, expiration, rotation, rejeu et révocation. Contrôle final : zéro autorisation, zéro empreinte de renouvellement et zéro compte synthétique conservé. Le verrouillage concurrent est implémenté ; aucun test distant avec deux connexions simultanées n'est revendiqué.

Advisors Supabase : deux notices INFO « RLS enabled, no policy » pour le registre sont attendues, les accès utilisateur étant volontairement fermés. Les 36 avertissements existants sur les RPC SECURITY DEFINER et la protection contre les mots de passe compromis restent dans l'audit général ; le nouveau RPC est SECURITY INVOKER et inaccessible aux utilisateurs.

Avant exposition : ajouter le transport OAuth/MCP, la page de consentement avec protection CSRF et liaison à la demande, les métadonnées OAuth, les limites de requêtes et quotas, la purge des autorisations expirées, le raccordement aux lectures financières sous une identité bornée et les essais du flux complet. Aucun client ni callback réel n'est préenregistré. Le service OAuth natif Supabase n'est pas activé par ce lot ; son état distant n'a pas été vérifié.

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

1. **Raccordement des autorisations** : cycle de jetons opaques et registre privé réalisés. Brancher le consentement protégé et les lectures financières sans donner au client tiers de session Supabase ni de clé serveur. Préserver l'isolation utilisateur avec tests réels ; ne pas passer un client service_role au repository de lectures prévu pour RLS.
2. **Serveur MCP** : hébergement Supabase Edge envisagé, transport Streamable HTTP via SDK maintenu/verrouillé ; vérification de l'empreinte du jeton à chaque appel (ressource, expiration, révocation, client autorisé et permissions), métadonnées de ressource protégée, quotas, bornes de requête, purge et journal minimal d'accès. Aucune confiance dans user_metadata pour accorder un accès admin.
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

Vérification HTTP complémentaire du 1 novembre : un jeton au format opaque MCP est rejeté avec HTTP 401 sur GET /rest/v1/wallets?select=id&limit=0 et POST /rest/v1/rpc/mcp_oauth_state_v1 (opération authenticate). Aucune ligne financière lue. Ce contrôle vérifie le refus par la passerelle Supabase, pas encore le futur serveur MCP.
