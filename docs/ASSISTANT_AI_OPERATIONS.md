# Assistant GPT-6 — exploitation du pilote

## État et périmètre

Le réglage `.codex/config.toml` fixe Astra/high pour ce projet de confiance. Le réglage global observé était déjà Astra/low ; il reste inchangé. Un choix explicite dans une session peut prendre le dessus. Source : [configuration Codex](https://learn.chatgpt.com/docs/config-file/config-basic).

Le premier lot applicatif utilise GPT-6 Sol/low via Responses pour l'aide produit et la navigation. Le bouton Analyse rapide conserve ses calculs locaux. Aucune liste de transactions, montant, document ou conversation antérieure n'est jointe à la requête. La question saisie peut elle-même contenir des données personnelles : l'envoi est annoncé et demande l'activation de la case Aide IA en ligne.

La fonction accepte uniquement question, langue et vue. La réponse structurée contient un texte et une destination de navigation autorisée. L'IA ne peut ni modifier des données ni appeler des outils. La validation de schéma ne garantit pas l'exactitude des explications : une évaluation réelle reste obligatoire avant ouverture élargie.

## Configuration serveur

Projet identifié dans le dépôt : TravelBudget, référence `obznbrzarhvmlbprcfie`.

| Secret | Valeur |
|---|---|
| `OPENAI_API_KEY` | Présence vérifiée le 25 septembre 2026 ; valeur jamais affichée |
| `ASSISTANT_AI_ENABLED` | Actuellement `false` après échec du test de crédits ; `true` pour activer après résolution |
| `ASSISTANT_AI_ALLOWED_USERS` | Configuré pour le seul administrateur du projet ; vide interdit tous les appels |

Le serveur vérifie le JWT utilisateur via Auth avant la liste pilote. Il ne lit aucune donnée métier. L'usage de service_role est limité à Auth et à la réservation du quota ; la clé ne quitte pas le serveur.

La migration `20260925012905_assistant_ai_quota.sql` a été appliquée au projet distant et crée une table de compteurs et une RPC réservée à service_role. Le nom du fichier local correspond à la version distante. Elle modifie le schéma ; aucun montant patrimonial ou financier n'est modifié. Les clients anon/authenticated ne peuvent ni lire ni modifier ces compteurs. Les lignes utilisateur sont supprimées avec le compte. Le compteur global ne contient pas d'identité.

## Vérification distante du 25 septembre 2026

- `assistant-help` déployée ; requête non authentifiée refusée avec HTTP 401.
- RLS activée, lecture anon et écriture authenticated interdites, RPC réservée à service_role : vérifiés sur le serveur.
- Le dry-run global révèle de nombreuses migrations locales anciennes absentes de l'historique distant. Aucune de ces migrations n'a été appliquée et aucun historique existant n'a été réparé. Seule la nouvelle migration indépendante a été appliquée via l'API de migration, après validation isolée et vérification de l'absence des objets.
- Test réel Responses avec `gpt-6-sol` et une question fictive : HTTP 429, `error.code=credit_balance_exhausted`, `error.type=insufficient_quota`. Aucune réponse du modèle ; disponibilité du modèle pour ce compte encore non confirmée. L'activation a été remise à `false`.
- Fonction temporaire de diagnostic et secret temporaire supprimés après le test. La clé OpenAI reste uniquement dans Supabase.
- Le conseiller Supabase signale informativement l'absence de politique RLS sur le compteur : c'est intentionnel, tout accès client est refusé et seul service_role est utilisé. [Description de ce contrôle](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy). Les autres avertissements sur des fonctions préexistantes restent hors périmètre.
- Frontend non publié : le connecteur Netlify demande une reconnexion et les tentatives CLI ont rencontré des erreurs du cache npm Windows. Les correctifs d'amortissement restent locaux et testés.

Limites initiales : 20 tentatives par utilisateur et par jour UTC, 100 au total. Chaque tentative réserve le quota avant OpenAI, y compris en cas d'échec. La réservation est atomique, et un refus utilisateur annule également l'incrément global. Question : 1 500 caractères ; corps : 8 192 octets ; sortie : 1 200 tokens ; délai serveur : 20 secondes, client : 25 secondes. Pas de relance automatique. Ces bornes limitent la consommation ; elles ne constituent pas un plafond monétaire contractuel. Configurer également les contrôles de dépense du projet OpenAI.

## Mise en service à terminer

1. Rétablir des crédits API dans l'organisation OpenAI concernée. [Erreur officielle](https://developers.openai.com/api/docs/guides/error-codes).
2. Retester une question fictive, puis remettre `ASSISTANT_AI_ENABLED=true` pour la liste pilote existante. Le simple fait de disposer de la clé n'active pas l'IA.
3. Tester une requête non authentifiée (401), un compte hors pilote (503), un pilote autorisé et le quota (429). Ne pas afficher les secrets ou JWT dans les rapports.
4. Exécuter les cas de `assistant-ai-evaluation.md`, relever latence, consommation, réponse et verdict humain anonymisé. Le compte pilote et les seuils acceptables doivent être choisis avant l'ouverture.
5. Publier le frontend et vérifier le parcours réel web/Android. Les tests locaux à transport simulé ne valident pas l'accès réel au modèle.

Retour arrière immédiat : `ASSISTANT_AI_ENABLED=false`. Les réponses locales restent disponibles. La case IA est décochée à l'ouverture d'une nouvelle page et après changement de compte. Fermer le panneau, décocher ou annuler interrompt l'attente et ignore une réponse tardive ; une requête déjà acceptée par le serveur peut néanmoins consommer le quota réservé.

## Validation locale

- Tests Vitest du serveur : paramètres Responses, accès, liste pilote, quotas refusés, taille, réponses incomplètes, délais et absence de relance.
- Tests du client : minimisation, destinations autorisées et interruption même si le transport ignore le signal.
- Tests Playwright : fonctionnement local, réponse IA simulée, navigation, erreur, annulation, clair/sombre, 1440/390 px.
- Résultats du 25 septembre 2026 : 100 tests Vitest ciblés et 9 parcours Playwright réussis ; build, syntaxe, documentation Atlas et budgets de taille validés. Les plafonds du bundle ont été ajustés de quelques KiB pour les nouveaux composants, avec justification dans `V11_PERFORMANCE_BUDGETS.md`.
- Migration exécutée dans PostgreSQL embarqué PGlite 0.5.4, hors dépôt : limites utilisateur/global, annulation de la réservation, changement de jour, privilèges et suppression du compte. Ceci ne remplace pas la validation Supabase distante et un test de concurrence multi-connexions.

Les analyses financières contextuelles, l'escalade vers Astra, le routage Luna et la télémétrie fine des tokens restent des lots ultérieurs. L'évaluation comparative des modèles Codex n'a pas été effectuée ; le réglage est un point de départ.
