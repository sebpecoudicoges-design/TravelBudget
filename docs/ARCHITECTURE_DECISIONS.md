# Décisions d'architecture

Ce journal contient uniquement les décisions transversales nécessaires pour orienter une modification. Les détails d'architecture restent dans [V11_ARCHITECTURE.md](V11_ARCHITECTURE.md).

## ADR-001 — L'architecture V11 reste la référence

- **Statut :** acceptée
- **Décision :** `src/core` contient les règles pures, `src/data` les accès et files de données, `src/features` les responsabilités de domaine, `src/app/bridge.js` le pont, et le legacy l'intégration historique.
- **Conséquence :** aucune règle métier nouvelle ne doit être ajoutée dans `public/legacy/js`.
- **Source :** [Architecture V11](V11_ARCHITECTURE.md).

## ADR-002 — L'Atlas sépare faits générés et jugement humain

- **Statut :** acceptée
- **Décision :** version, commit, fichiers, scripts, écrans et inventaires sont générés ; sources de vérité, risques et impacts restent dans les fiches revues humainement.
- **Conséquence :** le générateur ne produit aucun statut « stable », « complet » ou « couvert ».
- **Source :** [Project Atlas](PROJECT_ATLAS.md).

## ADR-003 — Le registre initial est limité à dix fonctions

- **Statut :** acceptée
- **Décision :** documenter en priorité les dix fonctions dont les conséquences traversent plusieurs couches ou domaines.
- **Conséquence :** un nouveau bouton ou écran n'entraîne pas automatiquement une nouvelle fiche. Le registre ne grandit qu'en présence d'un besoin de maintenance durable.
- **Source :** [Registre critique](PROJECT_ATLAS.md#registre-critique-initial).

## ADR-004 — Préparer une connexion ChatGPT individuelle en lecture seule

- **Statut :** pilote administrateur connecté à ChatGPT, extension aux analyses, Trip détaillé, comptabilité et documents sélectionnés.
- **Décision :** identité issue du compte TravelBudget de chaque utilisateur, outils fermés finance uniquement, aucun accès administrateur partagé. Pilote limité au compte administrateur possible.
- **Conséquence :** les scopes OAuth ne suffisent pas à restreindre les jetons Supabase. La connexion utilise des jetons opaques propres à MCP, stockés sous forme d'empreintes, avec renouvellement atomique et révocation. Aucun jeton de session Supabase confié à ChatGPT. Les lectures passent par une fonction privée possédée par un rôle SELECT seul sans bypass RLS, puis par les règles métier existantes. Les wrappers publics sont réservés au serveur ; pas d'accès RPC direct pour le client tiers. L'ouverture générale attend la validation du pilote.
- **Source :** [Feuille de route ChatGPT/MCP](CHATGPT_MCP_ROADMAP.md).

L'extension se fait par préférences personnelles vérifiées en base : activation financière explicite, sélection de versions documentaires, synchronisation volontaire des réglages comptables locaux. Le modèle ne peut modifier ces choix. Les calculs restent déterministes et utilisent les règles existantes ; taux FX ou positions manquants produisent des avertissements et des totaux indisponibles, jamais une estimation silencieuse. Les contenus documentaires restent des données non fiables, pas des instructions.
