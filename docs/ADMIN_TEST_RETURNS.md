# Retours tests membres admins

Objectif : conserver les anciens retours de test avant la campagne integree `10.5.316`.

Depuis `10.5.316`, les retours actifs sont saisis dans l onglet **Tests** et persistes dans Supabase. Ce fichier reste une archive et un espace de notes exceptionnelles admin.

Statut global : remplace par la campagne integree

## Mode d'emploi

- Ajouter une ligne par retour.
- Mettre `fini` uniquement si le comportement est valide.
- Mettre `non fini` si un point doit etre repris.
- Quand les retours sont saisis, prevenir Codex pour lecture et traitement.

| Date | Version | Admin | Appareil | Module | Test fait | Resultat attendu | Resultat reel | Console / capture | Decision |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
|  | 10.5.222 |  |  | KPI | Inclure impayes + date-a-date + cash/pilotage | Montants signes, Trip groupe, cash coherent |  |  | non fini |
|  | 10.5.222 |  |  | Projet | Espace Membres admins visible sur mobile et desktop | Bloc lisible, consigne retour claire |  |  | non fini |

## Points ouverts

- [ ] Lire les retours remplis.
- [ ] Corriger les points `non fini`.
- [ ] Passer le statut global a `fini` quand tous les retours sont valides.
