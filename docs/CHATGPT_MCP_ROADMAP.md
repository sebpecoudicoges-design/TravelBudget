# Connexion ChatGPT / MCP — feuille de route et premier socle

Demande du 31 octobre 2026, après lecture de la pièce jointe « Connecter TravelBudget à ChatGPT ».

## Choix confirmés

- Première version **lecture seule** : wallets, transactions, budgets et voyages.
- L'utilisateur utilise ChatGPT Pro. Cible : chaque utilisateur connecte son propre compte TravelBudget depuis son propre ChatGPT. Une restriction initiale au compte administrateur est acceptable ; elle ne doit jamais donner accès aux données des autres comptes.
- Nutrition, Sport et toutes les écritures restent hors de ce premier périmètre.
- Cette priorité s'ajoute au suivi d'audit ; elle ne clôt ni architecture/qualité ni l'audit général de la base.

## État effectivement livré

**Mise à jour du 1 novembre 2026 : serveur OAuth/MCP déployé en pilote administrateur.** Consentement et révocation disponibles sur [Connecter ChatGPT](https://stunning-dieffenbachia-2b2ed0.netlify.app/connect-chatgpt.html). Connexion effective depuis un compte ChatGPT réel encore à vérifier ; aucune autorisation personnelle n'a été créée pendant les tests. Les deux premiers lots ci-dessous décrivent les étapes préparatoires, désormais raccordées.

Pour le pilote : URL MCP `https://stunning-dieffenbachia-2b2ed0.netlify.app/mcp`, authentification OAuth, client public `travelbudget-chatgpt`, sans secret, scope `finance:read`. Le serveur annonce RFC 9207 et renvoie `iss` ; callback enregistré exact `https://chatgpt.com/connector_platform_oauth_redirect`. Vérifier que l'interface ChatGPT affiche ce callback avant l'essai ; aucune redirection générique ni joker n'est acceptée. Se connecter à TravelBudget dans le même navigateur pour retrouver sa session sur la page de consentement. Le pilote est limité à l'identifiant du compte administrateur existant, configuré côté serveur ; ce n'est pas un accès aux données des autres utilisateurs.

Un catalogue interne de quatre outils et leur adaptateur de lecture, avec tests, sont présents dans le dépôt :

| Outil préparé | Résultat | Limite explicite |
|---|---|---|
| get_accounts | Wallets, dont archivés, et soldes calculés | Réutilise computeWalletBalanceRows ; devise propre à chaque wallet |
| get_transactions | Page de transactions, dates et filtres wallet | Filtre date_start ; dates budgétaires distinctes exposées ; pagination à poursuivre |
| get_budget_configuration | Périodes et segments de budget configurés | Pas encore de synthèse de dépenses, amortissements, change ou projection |
| get_trips | Voyages et groupes Trip possédés | Pas de participants, dépenses de groupe ni groupes possédés par autrui |

Sources : [adaptateur](../src/data/mcpFinanceReadRepository.js), [catalogue et validation](../src/features/assistant/mcpReadTools.js), [tests](../tests/data/mcpFinanceRead.test.js).

Les modules sont maintenant utilisés par la fonction Edge `travelbudget-mcp`, sans alourdir le démarrage de l'application. L'assistant intégré reste distinct. La page web de consentement utilise le client Supabase déjà distribué et ses sessions existantes ; aucun nouveau formulaire de mot de passe. Aucun nouvel APK nécessaire pour cette connexion web.

## Lot serveur, consentement et lectures bornées

- Migration **20261031232255_mcp_scoped_reads appliquée**. Rôle `tb_mcp_reader` NOLOGIN, NOINHERIT, NOBYPASSRLS, uniquement SELECT sur les colonnes nécessaires. Politiques restrictives de propriété sur les six tables ; trois colonnes de participation Trip sont accessibles uniquement pour l'évaluation des politiques existantes, sans exposer la table participants comme outil ou résultat.
- La lecture passe par un wrapper SECURITY INVOKER réservé au serveur, puis une fonction privée SECURITY DEFINER possédée par ce rôle de lecture, pas par postgres/service_role. Cette frontière réduit volontairement les privilèges du serveur. Aucun droit d'écriture métier accordé. Le jeton opaque est revérifié en base à chaque page et détermine le propriétaire ; aucune identité fournie par le client tiers.
- Adaptateur `mcp-read-client.js` limité aux filtres autorisés, raccordé aux règles métier existantes. Aucun client service_role général injecté dans le repository financier. Les calculs de solde et les limites des budgets restent ceux du tableau ci-dessus.
- SDK officiel `@modelcontextprotocol/server@2.4.0`, compatible HTTP moderne et clients stateless antérieurs. Zod 4.6.7 fixé par archive officielle et intégrité npm : les métadonnées abrégées npm renvoyaient une version plus ancienne que le registre complet. Lockfiles npm/Deno conservés ; l'ancien SDK v1 et ses dépendances inutilisées ont été retirés. Audit npm : 12 alertes préexistantes, 8 modérées et 4 élevées, aucune critique et aucune nouvelle alerte liée au serveur MCP.
- Métadonnées de ressource et serveur OAuth, codes PKCE, échange/renouvellement/révocation, challenge 401. Routes Netlify vers la fonction Edge ; URLs d'émetteur/ressource fixes, contrôles des hôtes et origines, callback exact. Les POST de consentement/révocation propriétaire exigent JSON et Origin TravelBudget, avec Bearer de session vérifié côté serveur ; aucun cookie ambiant utilisé pour autoriser.
- Consentement explicite, refus possible sans connexion, compte affiché, détection d'un changement de compte, liste des accès et révocation. Aucun HTML construit à partir des données utilisateur. Clair/sombre et 1440/390 px testés.
- Corps entrants limités à 16 Kio et cinq secondes ; quotas persistants 120 requêtes/minute par IP reçue de la passerelle, 30 appels MCP/minute par utilisateur et 10 consentements/minute par utilisateur. L'IP est stockée sous empreinte, pas en clair. Les quotas ne remplacent pas une protection DDoS de la plateforme. Purge des familles expirées et vieux codes inutilisés lors des réservations ; empreintes de refresh conservées jusqu'à expiration de la famille pour détecter le rejeu.
- Réponses sans cache. La page de consentement appelle directement l'origine Supabase avec CORS limité à TravelBudget, pour contourner aussi les anciens service workers. Le service worker web exclut OAuth, MCP, consentement, Authorization et no-store ; il purge l'ancien cache de la même version. Les pages annexes ne remplacent plus index.html dans le cache hors ligne. Cinq contrats de non-régression couvrent ce périmètre. Aucun log de jeton, de libellé ou de montant ajouté. Variable `MCP_ENABLED=false` pour couper le serveur ; `MCP_ALLOWED_USERS` contrôle le pilote. Vérification JWT de la passerelle désactivée pour cette seule fonction car elle authentifie elle-même les jetons opaques ; les autres fonctions sont inchangées.

Validation : tests HTTP avec vrai SDK (consentement, échange, lecture, révocation, refus), SQL distant avec deux propriétaires synthétiques et ROLLBACK avant/après migration, six parcours navigateur. Zéro compte synthétique ou autorisation personnelle conservé. Métadonnées publiques 200 et challenge sans jeton 401 vérifiés sur la fonction déployée. Les tests financiers SQL utilisent seulement leurs fixtures ; aucun montant personnel lu ou modifié. L'essai complet dans ChatGPT réel et la comparaison des résultats avec le compte utilisateur restent à faire.

Advisors après ce lot : aucune nouvelle alerte WARN liée au MCP ; les notices INFO du registre fermé restent attendues. Les avertissements antérieurs de la base restent un chantier séparé.

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

Ces éléments du lot d'authentification ont ensuite été raccordés dans le lot serveur décrit plus haut. Le service OAuth natif Supabase n'est pas utilisé ni activé par ces changements ; son état distant n'a pas été vérifié.

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

1. **Raccordement des autorisations** : réalisé, avec rôle de lecture borné et consentement web.
2. **Serveur MCP** : déployé pour le pilote ; publication web et parcours ChatGPT à relire après chaque livraison.
3. **Validation d'isolation** : SQL réel sur deux propriétaires, expirations/révocation et refus de tables hors périmètre vérifiés ; HTTP/SDK et navigateur testés. Compléter par le client ChatGPT réel et une campagne concurrente multi-instance avant ouverture générale.
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
