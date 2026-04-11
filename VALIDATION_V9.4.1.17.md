# V9.4.1.17 — validation réelle multi-scopes

## Corrections intégrées

- KPI budget journalier réaligné sur `budget_date_start` / `budget_date_end` au lieu de `date_start` / `date_end`.
- KPI budget / pending / cash runway filtrés sur le `travel_id` actif quand présent.
- Cash runway limité aux wallets cash réels et aux transactions cash réellement payées.
- Cashflow curve filtré sur le voyage actif pour les agrégations budget/cash.
- Wallet effects cashflow filtrés sur le voyage actif.

## Règles désormais alignées

- Cash réel: `tbTxAffectsCash(tx)` + cash date.
- Budget / Analyse: `tbTxAffectsBudget(tx)` + budget dates.
- Mouvements internes: exclus via `tbIsInternalMovement(tx)`.
- Trip budget-only: inclus dans budget/analyse, exclus du cash réel.

## Validation technique

- `npm install` exécuté.
- Build validé via `node node_modules/vite/bin/vite.js build`.
