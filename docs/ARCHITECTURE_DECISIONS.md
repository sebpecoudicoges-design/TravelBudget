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
